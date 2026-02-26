// Allow unused code in encryption.rs - encryption features are planned for future use
#![allow(dead_code)]

use crate::error::{KiyyaError, Result};
use crate::security_logging::{log_security_event, SecurityEvent};
use aes_gcm::{
    aead::{generic_array::GenericArray, Aead},
    Aes256Gcm, KeyInit, Nonce,
};
use base64::{engine::general_purpose, Engine as _};
use keyring::Entry;
use rand::RngCore;
use std::path::Path;
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt, SeekFrom};
use tracing::{info, warn};

const KEYRING_SERVICE: &str = "Kiyya";
const KEYRING_USER: &str = "encryption_key";
const NONCE_SIZE: usize = 12;
const KEY_SIZE: usize = 32;

#[derive(Debug, Clone)]
struct ChunkInfo {
    file_offset: u64,
    encrypted_size: u64,
}

pub struct EncryptionManager {
    cipher: Option<Aes256Gcm>,
}

impl EncryptionManager {
    pub fn new() -> Result<Self> {
        Ok(Self { cipher: None })
    }

    pub fn is_encryption_enabled(&self) -> bool {
        self.cipher.is_some()
    }

    pub fn enable_encryption(&mut self, passphrase: &str) -> Result<()> {
        // Derive key from passphrase (in production, use proper PBKDF2)
        let key = Self::derive_key_from_passphrase(passphrase)?;

        // Store key in OS keystore
        match self.store_key_in_keystore(&key) {
            Ok(_) => {
                log_security_event(SecurityEvent::EncryptionKeyOperation {
                    operation: "generate".to_string(),
                    success: true,
                    details: Some("Key stored in OS keystore".to_string()),
                });
            }
            Err(e) => {
                log_security_event(SecurityEvent::EncryptionKeyOperation {
                    operation: "generate".to_string(),
                    success: false,
                    details: Some(format!("Failed to store key: {}", e)),
                });
                return Err(e);
            }
        }

        // Initialize cipher
        let key_array = GenericArray::from_slice(&key);
        self.cipher = Some(Aes256Gcm::new(key_array));

        info!("Encryption enabled successfully");
        Ok(())
    }

    pub fn load_encryption_from_keystore(&mut self) -> Result<bool> {
        match self.load_key_from_keystore() {
            Ok(key) => {
                let key_array = GenericArray::from_slice(&key);
                self.cipher = Some(Aes256Gcm::new(key_array));

                log_security_event(SecurityEvent::EncryptionKeyOperation {
                    operation: "access".to_string(),
                    success: true,
                    details: Some("Key loaded from OS keystore".to_string()),
                });

                info!("Encryption key loaded from keystore");
                Ok(true)
            }
            Err(e) => {
                log_security_event(SecurityEvent::EncryptionKeyOperation {
                    operation: "access".to_string(),
                    success: false,
                    details: Some(format!("Key not found in keystore: {}", e)),
                });

                info!("No encryption key found in keystore");
                Ok(false)
            }
        }
    }

    pub fn disable_encryption(&mut self) -> Result<()> {
        self.cipher = None;

        // Remove key from keystore
        match self.remove_key_from_keystore() {
            Ok(_) => {
                log_security_event(SecurityEvent::EncryptionKeyOperation {
                    operation: "delete".to_string(),
                    success: true,
                    details: Some("Key removed from OS keystore".to_string()),
                });
            }
            Err(e) => {
                log_security_event(SecurityEvent::EncryptionKeyOperation {
                    operation: "delete".to_string(),
                    success: false,
                    details: Some(format!("Failed to remove key: {}", e)),
                });
                warn!("Failed to remove key from keystore: {}", e);
            }
        }

        info!("Encryption disabled");
        Ok(())
    }

    pub async fn encrypt_file(&self, input_path: &Path, output_path: &Path) -> Result<()> {
        let cipher = self.cipher.as_ref().ok_or_else(|| KiyyaError::Encryption {
            message: "Encryption not enabled".to_string(),
        })?;

        let mut input_file = File::open(input_path).await?;
        let mut output_file = File::create(output_path).await?;

        // Generate random nonce
        let mut nonce_bytes = [0u8; NONCE_SIZE];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let _nonce: &GenericArray<u8, aes_gcm::aead::consts::U12> = Nonce::from_slice(&nonce_bytes);

        // Write nonce to beginning of file
        output_file.write_all(&nonce_bytes).await?;

        // Encrypt file in chunks
        const CHUNK_SIZE: usize = 64 * 1024; // 64KB chunks
        let mut buffer = vec![0u8; CHUNK_SIZE];
        let mut chunk_counter = 0u64;

        loop {
            let bytes_read = input_file.read(&mut buffer).await?;
            if bytes_read == 0 {
                break;
            }

            // Create unique nonce for each chunk by combining base nonce with counter
            let mut chunk_nonce_bytes = nonce_bytes;
            let counter_bytes = chunk_counter.to_le_bytes();
            for (i, &byte) in counter_bytes.iter().enumerate() {
                if i < NONCE_SIZE {
                    chunk_nonce_bytes[i] ^= byte;
                }
            }
            let chunk_nonce = Nonce::from_slice(&chunk_nonce_bytes);

            let encrypted_chunk =
                cipher
                    .encrypt(chunk_nonce, &buffer[..bytes_read])
                    .map_err(|e| KiyyaError::Encryption {
                        message: format!("Encryption failed: {}", e),
                    })?;

            // Write chunk size and encrypted data
            output_file
                .write_all(&(encrypted_chunk.len() as u32).to_le_bytes())
                .await?;
            output_file.write_all(&encrypted_chunk).await?;

            chunk_counter += 1;
        }

        output_file.flush().await?;
        info!("File encrypted successfully: {:?}", output_path);
        Ok(())
    }

    pub async fn decrypt_file(&self, input_path: &Path, output_path: &Path) -> Result<()> {
        let cipher = self.cipher.as_ref().ok_or_else(|| KiyyaError::Encryption {
            message: "Encryption not enabled".to_string(),
        })?;

        let mut input_file = File::open(input_path).await?;
        let mut output_file = File::create(output_path).await?;

        // Read nonce from beginning of file
        let mut nonce_bytes = [0u8; NONCE_SIZE];
        input_file.read_exact(&mut nonce_bytes).await?;

        // Decrypt file in chunks
        let mut chunk_counter = 0u64;

        loop {
            // Read chunk size
            let mut size_bytes = [0u8; 4];
            match input_file.read_exact(&mut size_bytes).await {
                Ok(_) => {}
                Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
                Err(e) => return Err(e.into()),
            }

            let chunk_size = u32::from_le_bytes(size_bytes) as usize;
            let mut encrypted_chunk = vec![0u8; chunk_size];
            input_file.read_exact(&mut encrypted_chunk).await?;

            // Create chunk nonce
            let mut chunk_nonce_bytes = nonce_bytes;
            let counter_bytes = chunk_counter.to_le_bytes();
            for (i, &byte) in counter_bytes.iter().enumerate() {
                if i < NONCE_SIZE {
                    chunk_nonce_bytes[i] ^= byte;
                }
            }
            let chunk_nonce = Nonce::from_slice(&chunk_nonce_bytes);

            let decrypted_chunk = cipher
                .decrypt(chunk_nonce, encrypted_chunk.as_slice())
                .map_err(|e| KiyyaError::Encryption {
                    message: format!("Decryption failed: {}", e),
                })?;

            output_file.write_all(&decrypted_chunk).await?;
            chunk_counter += 1;
        }

        output_file.flush().await?;
        info!("File decrypted successfully: {:?}", output_path);
        Ok(())
    }

    pub async fn decrypt_range(&self, input_path: &Path, start: u64, end: u64) -> Result<Vec<u8>> {
        let cipher = self.cipher.as_ref().ok_or_else(|| KiyyaError::Encryption {
            message: "Encryption not enabled".to_string(),
        })?;

        let mut input_file = File::open(input_path).await?;

        // Read nonce from beginning of file
        let mut nonce_bytes = [0u8; NONCE_SIZE];
        input_file.read_exact(&mut nonce_bytes).await?;

        // Build chunk index to find which chunks contain the requested range
        const CHUNK_SIZE: usize = 64 * 1024; // Must match encryption chunk size
        let chunk_index = self.build_chunk_index(&mut input_file).await?;

        if chunk_index.is_empty() {
            return Ok(Vec::new());
        }

        // Calculate which chunks we need to decrypt
        let start_chunk = (start / CHUNK_SIZE as u64) as usize;
        let end_chunk = (end / CHUNK_SIZE as u64) as usize;

        // Validate chunk range
        if start_chunk >= chunk_index.len() {
            return Ok(Vec::new());
        }

        let end_chunk = std::cmp::min(end_chunk, chunk_index.len() - 1);

        // Decrypt only the required chunks
        let mut result = Vec::new();

        for chunk_idx in start_chunk..=end_chunk {
            let chunk_info = &chunk_index[chunk_idx];

            // Seek to chunk position
            input_file
                .seek(SeekFrom::Start(chunk_info.file_offset))
                .await?;

            // Read chunk size
            let mut size_bytes = [0u8; 4];
            input_file.read_exact(&mut size_bytes).await?;
            let chunk_size = u32::from_le_bytes(size_bytes) as usize;

            // Read encrypted chunk
            let mut encrypted_chunk = vec![0u8; chunk_size];
            input_file.read_exact(&mut encrypted_chunk).await?;

            // Create chunk nonce
            let mut chunk_nonce_bytes = nonce_bytes;
            let counter_bytes = (chunk_idx as u64).to_le_bytes();
            for (i, &byte) in counter_bytes.iter().enumerate() {
                if i < NONCE_SIZE {
                    chunk_nonce_bytes[i] ^= byte;
                }
            }
            let chunk_nonce = Nonce::from_slice(&chunk_nonce_bytes);

            // Decrypt chunk
            let decrypted_chunk = cipher
                .decrypt(chunk_nonce, encrypted_chunk.as_slice())
                .map_err(|e| KiyyaError::Encryption {
                    message: format!("Decryption failed for chunk {}: {}", chunk_idx, e),
                })?;

            // Calculate which bytes from this chunk we need
            let chunk_start_pos = chunk_idx as u64 * CHUNK_SIZE as u64;
            let chunk_end_pos = chunk_start_pos + decrypted_chunk.len() as u64 - 1;

            let copy_start = if start > chunk_start_pos {
                (start - chunk_start_pos) as usize
            } else {
                0
            };

            let copy_end = if end < chunk_end_pos {
                (end - chunk_start_pos + 1) as usize
            } else {
                decrypted_chunk.len()
            };

            // Append the relevant portion of this chunk
            if copy_start < decrypted_chunk.len() && copy_start < copy_end {
                result.extend_from_slice(&decrypted_chunk[copy_start..copy_end]);
            }
        }

        Ok(result)
    }

    async fn build_chunk_index(&self, file: &mut File) -> Result<Vec<ChunkInfo>> {
        let mut index = Vec::new();
        let mut file_offset = NONCE_SIZE as u64; // Start after nonce

        file.seek(SeekFrom::Start(file_offset)).await?;

        loop {
            // Try to read chunk size
            let mut size_bytes = [0u8; 4];
            match file.read_exact(&mut size_bytes).await {
                Ok(_) => {}
                Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
                Err(e) => return Err(e.into()),
            }

            let chunk_size = u32::from_le_bytes(size_bytes) as u64;

            index.push(ChunkInfo {
                file_offset,
                encrypted_size: chunk_size,
            });

            // Skip to next chunk (4 bytes for size + chunk data)
            file_offset += 4 + chunk_size;
            file.seek(SeekFrom::Start(file_offset)).await?;
        }

        Ok(index)
    }

    fn derive_key_from_passphrase(passphrase: &str) -> Result<[u8; KEY_SIZE]> {
        // TODO: Use proper PBKDF2 with salt in production
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        passphrase.hash(&mut hasher);
        let hash = hasher.finish();

        let mut key = [0u8; KEY_SIZE];
        let hash_bytes = hash.to_le_bytes();

        // Repeat hash to fill key
        for (i, &byte) in hash_bytes.iter().cycle().take(KEY_SIZE).enumerate() {
            key[i] = byte;
        }

        Ok(key)
    }

    fn store_key_in_keystore(&self, key: &[u8; KEY_SIZE]) -> Result<()> {
        let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
        let key_b64 = general_purpose::STANDARD.encode(key);
        entry.set_password(&key_b64)?;
        Ok(())
    }

    fn load_key_from_keystore(&self) -> Result<[u8; KEY_SIZE]> {
        let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
        let key_b64 = entry.get_password()?;
        let key_bytes = general_purpose::STANDARD.decode(&key_b64)?;

        if key_bytes.len() != KEY_SIZE {
            return Err(KiyyaError::Encryption {
                message: "Invalid key size".to_string(),
            });
        }

        let mut key = [0u8; KEY_SIZE];
        key.copy_from_slice(&key_bytes);
        Ok(key)
    }

    fn remove_key_from_keystore(&self) -> Result<()> {
        let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
        entry.delete_password()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use tokio::fs::write;

    #[tokio::test]
    async fn test_encryption_manager_creation() {
        let manager = EncryptionManager::new();
        assert!(manager.is_ok());

        let manager = manager.unwrap();
        assert!(!manager.is_encryption_enabled());
    }

    #[tokio::test]
    async fn test_enable_encryption() {
        let mut manager = EncryptionManager::new().unwrap();

        let result = manager.enable_encryption("test_passphrase_123");
        assert!(result.is_ok());
        assert!(manager.is_encryption_enabled());

        // Clean up keystore
        let _ = manager.disable_encryption();
    }

    #[tokio::test]
    async fn test_disable_encryption() {
        let mut manager = EncryptionManager::new().unwrap();

        manager.enable_encryption("test_passphrase_123").unwrap();
        assert!(manager.is_encryption_enabled());

        let result = manager.disable_encryption();
        assert!(result.is_ok());
        assert!(!manager.is_encryption_enabled());
    }

    #[tokio::test]
    async fn test_encrypt_decrypt_file_round_trip() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("input.txt");
        let encrypted_path = temp_dir.path().join("encrypted.bin");
        let decrypted_path = temp_dir.path().join("decrypted.txt");

        // Create test file
        let original_content = b"Hello, World! This is a test file for encryption.";
        write(&input_path, original_content).await.unwrap();

        // Enable encryption
        let mut manager = EncryptionManager::new().unwrap();
        manager.enable_encryption("test_passphrase_123").unwrap();

        // Encrypt file
        let result = manager.encrypt_file(&input_path, &encrypted_path).await;
        assert!(result.is_ok());
        assert!(encrypted_path.exists());

        // Decrypt file
        let result = manager.decrypt_file(&encrypted_path, &decrypted_path).await;
        assert!(result.is_ok());
        assert!(decrypted_path.exists());

        // Verify content matches
        let decrypted_content = tokio::fs::read(&decrypted_path).await.unwrap();
        assert_eq!(decrypted_content, original_content);

        // Clean up
        let _ = manager.disable_encryption();
    }

    #[tokio::test]
    async fn test_encrypt_decrypt_large_file() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("large_input.bin");
        let encrypted_path = temp_dir.path().join("large_encrypted.bin");
        let decrypted_path = temp_dir.path().join("large_decrypted.bin");

        // Create large test file (200KB - multiple chunks)
        let original_content: Vec<u8> = (0..200_000).map(|i| (i % 256) as u8).collect();
        write(&input_path, &original_content).await.unwrap();

        // Enable encryption
        let mut manager = EncryptionManager::new().unwrap();
        manager.enable_encryption("test_passphrase_456").unwrap();

        // Encrypt file
        let result = manager.encrypt_file(&input_path, &encrypted_path).await;
        assert!(result.is_ok());

        // Decrypt file
        let result = manager.decrypt_file(&encrypted_path, &decrypted_path).await;
        assert!(result.is_ok());

        // Verify content matches
        let decrypted_content = tokio::fs::read(&decrypted_path).await.unwrap();
        assert_eq!(decrypted_content.len(), original_content.len());
        assert_eq!(decrypted_content, original_content);

        // Clean up
        let _ = manager.disable_encryption();
    }

    #[tokio::test]
    async fn test_decrypt_range_first_chunk() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("input.bin");
        let encrypted_path = temp_dir.path().join("encrypted.bin");

        // Create test file with known content
        let original_content: Vec<u8> = (0..100_000).map(|i| (i % 256) as u8).collect();
        write(&input_path, &original_content).await.unwrap();

        // Enable encryption and encrypt file
        let mut manager = EncryptionManager::new().unwrap();
        manager.enable_encryption("test_passphrase_789").unwrap();
        manager
            .encrypt_file(&input_path, &encrypted_path)
            .await
            .unwrap();

        // Decrypt first 1000 bytes
        let result = manager.decrypt_range(&encrypted_path, 0, 999).await;
        assert!(result.is_ok());

        let decrypted_range = result.unwrap();
        assert_eq!(decrypted_range.len(), 1000);
        assert_eq!(decrypted_range, &original_content[0..1000]);

        // Clean up
        let _ = manager.disable_encryption();
    }

    #[tokio::test]
    async fn test_decrypt_range_middle_chunk() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("input.bin");
        let encrypted_path = temp_dir.path().join("encrypted.bin");

        // Create test file
        let original_content: Vec<u8> = (0..100_000).map(|i| (i % 256) as u8).collect();
        write(&input_path, &original_content).await.unwrap();

        // Enable encryption and encrypt file
        let mut manager = EncryptionManager::new().unwrap();
        manager.enable_encryption("test_passphrase_abc").unwrap();
        manager
            .encrypt_file(&input_path, &encrypted_path)
            .await
            .unwrap();

        // Decrypt middle range (50000-50999)
        let result = manager.decrypt_range(&encrypted_path, 50_000, 50_999).await;
        assert!(result.is_ok());

        let decrypted_range = result.unwrap();
        assert_eq!(decrypted_range.len(), 1000);
        assert_eq!(decrypted_range, &original_content[50_000..51_000]);

        // Clean up
        let _ = manager.disable_encryption();
    }

    #[tokio::test]
    async fn test_decrypt_range_last_chunk() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("input.bin");
        let encrypted_path = temp_dir.path().join("encrypted.bin");

        // Create test file
        let original_content: Vec<u8> = (0..100_000).map(|i| (i % 256) as u8).collect();
        write(&input_path, &original_content).await.unwrap();

        // Enable encryption and encrypt file
        let mut manager = EncryptionManager::new().unwrap();
        manager.enable_encryption("test_passphrase_def").unwrap();
        manager
            .encrypt_file(&input_path, &encrypted_path)
            .await
            .unwrap();

        // Decrypt last 1000 bytes
        let result = manager.decrypt_range(&encrypted_path, 99_000, 99_999).await;
        assert!(result.is_ok());

        let decrypted_range = result.unwrap();
        assert_eq!(decrypted_range.len(), 1000);
        assert_eq!(decrypted_range, &original_content[99_000..100_000]);

        // Clean up
        let _ = manager.disable_encryption();
    }

    #[tokio::test]
    async fn test_decrypt_range_spanning_multiple_chunks() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("input.bin");
        let encrypted_path = temp_dir.path().join("encrypted.bin");

        // Create test file (150KB - spans multiple 64KB chunks)
        let original_content: Vec<u8> = (0..150_000).map(|i| (i % 256) as u8).collect();
        write(&input_path, &original_content).await.unwrap();

        // Enable encryption and encrypt file
        let mut manager = EncryptionManager::new().unwrap();
        manager.enable_encryption("test_passphrase_ghi").unwrap();
        manager
            .encrypt_file(&input_path, &encrypted_path)
            .await
            .unwrap();

        // Decrypt range spanning multiple chunks (60000-80000)
        // This spans from chunk 0 into chunk 1
        let result = manager.decrypt_range(&encrypted_path, 60_000, 80_000).await;
        assert!(result.is_ok());

        let decrypted_range = result.unwrap();
        assert_eq!(decrypted_range.len(), 20_001); // 80000 - 60000 + 1
        assert_eq!(decrypted_range, &original_content[60_000..80_001]);

        // Clean up
        let _ = manager.disable_encryption();
    }

    #[tokio::test]
    async fn test_decrypt_range_single_byte() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("input.bin");
        let encrypted_path = temp_dir.path().join("encrypted.bin");

        // Create test file
        let original_content: Vec<u8> = (0..10_000).map(|i| (i % 256) as u8).collect();
        write(&input_path, &original_content).await.unwrap();

        // Enable encryption and encrypt file
        let mut manager = EncryptionManager::new().unwrap();
        manager.enable_encryption("test_passphrase_jkl").unwrap();
        manager
            .encrypt_file(&input_path, &encrypted_path)
            .await
            .unwrap();

        // Decrypt single byte at position 5000
        let result = manager.decrypt_range(&encrypted_path, 5_000, 5_000).await;
        assert!(result.is_ok());

        let decrypted_range = result.unwrap();
        assert_eq!(decrypted_range.len(), 1);
        assert_eq!(decrypted_range[0], original_content[5_000]);

        // Clean up
        let _ = manager.disable_encryption();
    }

    #[tokio::test]
    async fn test_decrypt_range_entire_file() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("input.bin");
        let encrypted_path = temp_dir.path().join("encrypted.bin");

        // Create test file
        let original_content: Vec<u8> = (0..50_000).map(|i| (i % 256) as u8).collect();
        write(&input_path, &original_content).await.unwrap();

        // Enable encryption and encrypt file
        let mut manager = EncryptionManager::new().unwrap();
        manager.enable_encryption("test_passphrase_mno").unwrap();
        manager
            .encrypt_file(&input_path, &encrypted_path)
            .await
            .unwrap();

        // Decrypt entire file using range
        let result = manager.decrypt_range(&encrypted_path, 0, 49_999).await;
        assert!(result.is_ok());

        let decrypted_range = result.unwrap();
        assert_eq!(decrypted_range.len(), 50_000);
        assert_eq!(decrypted_range, original_content);

        // Clean up
        let _ = manager.disable_encryption();
    }

    #[tokio::test]
    async fn test_decrypt_range_beyond_file_size() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("input.bin");
        let encrypted_path = temp_dir.path().join("encrypted.bin");

        // Create small test file
        let original_content: Vec<u8> = (0..1_000).map(|i| (i % 256) as u8).collect();
        write(&input_path, &original_content).await.unwrap();

        // Enable encryption and encrypt file
        let mut manager = EncryptionManager::new().unwrap();
        manager.enable_encryption("test_passphrase_pqr").unwrap();
        manager
            .encrypt_file(&input_path, &encrypted_path)
            .await
            .unwrap();

        // Try to decrypt range beyond file size
        let result = manager.decrypt_range(&encrypted_path, 5_000, 10_000).await;
        assert!(result.is_ok());

        let decrypted_range = result.unwrap();
        assert_eq!(decrypted_range.len(), 0); // Should return empty

        // Clean up
        let _ = manager.disable_encryption();
    }

    #[tokio::test]
    async fn test_decrypt_range_partial_last_chunk() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("input.bin");
        let encrypted_path = temp_dir.path().join("encrypted.bin");

        // Create test file that doesn't align with chunk boundaries
        let original_content: Vec<u8> = (0..70_000).map(|i| (i % 256) as u8).collect();
        write(&input_path, &original_content).await.unwrap();

        // Enable encryption and encrypt file
        let mut manager = EncryptionManager::new().unwrap();
        manager.enable_encryption("test_passphrase_stu").unwrap();
        manager
            .encrypt_file(&input_path, &encrypted_path)
            .await
            .unwrap();

        // Decrypt range that includes partial last chunk
        let result = manager.decrypt_range(&encrypted_path, 65_000, 69_999).await;
        assert!(result.is_ok());

        let decrypted_range = result.unwrap();
        assert_eq!(decrypted_range.len(), 5_000);
        assert_eq!(decrypted_range, &original_content[65_000..70_000]);

        // Clean up
        let _ = manager.disable_encryption();
    }

    #[tokio::test]
    async fn test_decrypt_range_without_encryption_enabled() {
        let temp_dir = TempDir::new().unwrap();
        let encrypted_path = temp_dir.path().join("encrypted.bin");

        // Create dummy encrypted file
        write(&encrypted_path, b"dummy encrypted content")
            .await
            .unwrap();

        // Try to decrypt without enabling encryption
        let manager = EncryptionManager::new().unwrap();
        let result = manager.decrypt_range(&encrypted_path, 0, 10).await;

        assert!(result.is_err());
        match result {
            Err(KiyyaError::Encryption { message }) => {
                assert!(message.contains("Encryption not enabled"));
            }
            _ => panic!("Expected encryption error"),
        }
    }

    #[tokio::test]
    async fn test_build_chunk_index() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("input.bin");
        let encrypted_path = temp_dir.path().join("encrypted.bin");

        // Create test file with multiple chunks (200KB)
        let original_content: Vec<u8> = (0..200_000).map(|i| (i % 256) as u8).collect();
        write(&input_path, &original_content).await.unwrap();

        // Enable encryption and encrypt file
        let mut manager = EncryptionManager::new().unwrap();
        manager.enable_encryption("test_passphrase_vwx").unwrap();
        manager
            .encrypt_file(&input_path, &encrypted_path)
            .await
            .unwrap();

        // Build chunk index
        let mut file = File::open(&encrypted_path).await.unwrap();
        let result = manager.build_chunk_index(&mut file).await;
        assert!(result.is_ok());

        let index = result.unwrap();

        // Should have at least 3 chunks (200KB / 64KB chunks)
        assert!(index.len() >= 3);

        // Verify chunk offsets are sequential
        for i in 1..index.len() {
            assert!(index[i].file_offset > index[i - 1].file_offset);
        }

        // Clean up
        let _ = manager.disable_encryption();
    }

    #[tokio::test]
    async fn test_concurrent_range_decryption() {
        use std::sync::Arc;
        use tokio::sync::Mutex;

        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("input.bin");
        let encrypted_path = temp_dir.path().join("encrypted.bin");

        // Create test file
        let original_content: Vec<u8> = (0..100_000).map(|i| (i % 256) as u8).collect();
        write(&input_path, &original_content).await.unwrap();

        // Enable encryption and encrypt file
        let mut manager = EncryptionManager::new().unwrap();
        manager
            .enable_encryption("test_passphrase_concurrent")
            .unwrap();
        manager
            .encrypt_file(&input_path, &encrypted_path)
            .await
            .unwrap();

        // Simulate concurrent range requests (like video seeking)
        let manager = Arc::new(Mutex::new(manager));
        let encrypted_path = Arc::new(encrypted_path);
        let original_content = Arc::new(original_content);

        let mut handles = vec![];

        // Request 1: First 1000 bytes
        let manager1 = manager.clone();
        let path1 = encrypted_path.clone();
        let content1 = original_content.clone();
        let handle1 = tokio::spawn(async move {
            let mgr = manager1.lock().await;
            let result = mgr.decrypt_range(&path1, 0, 999).await.unwrap();
            assert_eq!(result, &content1[0..1000]);
        });
        handles.push(handle1);

        // Request 2: Middle 1000 bytes
        let manager2 = manager.clone();
        let path2 = encrypted_path.clone();
        let content2 = original_content.clone();
        let handle2 = tokio::spawn(async move {
            let mgr = manager2.lock().await;
            let result = mgr.decrypt_range(&path2, 50_000, 50_999).await.unwrap();
            assert_eq!(result, &content2[50_000..51_000]);
        });
        handles.push(handle2);

        // Request 3: Last 1000 bytes
        let manager3 = manager.clone();
        let path3 = encrypted_path.clone();
        let content3 = original_content.clone();
        let handle3 = tokio::spawn(async move {
            let mgr = manager3.lock().await;
            let result = mgr.decrypt_range(&path3, 99_000, 99_999).await.unwrap();
            assert_eq!(result, &content3[99_000..100_000]);
        });
        handles.push(handle3);

        // Wait for all requests to complete
        for handle in handles {
            handle.await.unwrap();
        }

        // Clean up
        let mut mgr = manager.lock().await;
        let _ = mgr.disable_encryption();
    }

    #[tokio::test]
    async fn test_keystore_operations() {
        let mut manager = EncryptionManager::new().unwrap();

        // Enable encryption (stores key in keystore)
        manager
            .enable_encryption("test_keystore_passphrase")
            .unwrap();
        assert!(manager.is_encryption_enabled());

        // Create new manager and load from keystore
        let mut manager2 = EncryptionManager::new().unwrap();
        assert!(!manager2.is_encryption_enabled());

        let result = manager2.load_encryption_from_keystore();
        assert!(result.is_ok());
        assert!(result.unwrap()); // Should return true (key found)
        assert!(manager2.is_encryption_enabled());

        // Disable encryption (removes from keystore)
        manager2.disable_encryption().unwrap();

        // Try to load again - should not find key
        let mut manager3 = EncryptionManager::new().unwrap();
        let result = manager3.load_encryption_from_keystore();
        assert!(result.is_ok());
        assert!(!result.unwrap()); // Should return false (key not found)
        assert!(!manager3.is_encryption_enabled());
    }

    // ========== Additional Comprehensive Round-Trip Tests ==========

    #[tokio::test]
    async fn test_round_trip_empty_file() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("empty.txt");
        let encrypted_path = temp_dir.path().join("empty_encrypted.bin");
        let decrypted_path = temp_dir.path().join("empty_decrypted.txt");

        // Create empty file
        write(&input_path, b"").await.unwrap();

        let mut manager = EncryptionManager::new().unwrap();
        manager.enable_encryption("test_empty_file").unwrap();

        // Encrypt empty file
        let result = manager.encrypt_file(&input_path, &encrypted_path).await;
        assert!(result.is_ok());

        // Decrypt empty file
        let result = manager.decrypt_file(&encrypted_path, &decrypted_path).await;
        assert!(result.is_ok());

        // Verify empty content
        let decrypted_content = tokio::fs::read(&decrypted_path).await.unwrap();
        assert_eq!(decrypted_content.len(), 0);

        let _ = manager.disable_encryption();
    }

    #[tokio::test]
    async fn test_round_trip_single_byte() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("single.txt");
        let encrypted_path = temp_dir.path().join("single_encrypted.bin");
        let decrypted_path = temp_dir.path().join("single_decrypted.txt");

        // Create single byte file
        let original_content = b"X";
        write(&input_path, original_content).await.unwrap();

        let mut manager = EncryptionManager::new().unwrap();
        manager.enable_encryption("test_single_byte").unwrap();

        manager
            .encrypt_file(&input_path, &encrypted_path)
            .await
            .unwrap();
        manager
            .decrypt_file(&encrypted_path, &decrypted_path)
            .await
            .unwrap();

        let decrypted_content = tokio::fs::read(&decrypted_path).await.unwrap();
        assert_eq!(decrypted_content, original_content);

        let _ = manager.disable_encryption();
    }

    #[tokio::test]
    async fn test_round_trip_exact_chunk_boundary() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("exact_chunk.bin");
        let encrypted_path = temp_dir.path().join("exact_chunk_encrypted.bin");
        let decrypted_path = temp_dir.path().join("exact_chunk_decrypted.bin");

        // Create file exactly 64KB (one chunk)
        const CHUNK_SIZE: usize = 64 * 1024;
        let original_content: Vec<u8> = (0..CHUNK_SIZE).map(|i| (i % 256) as u8).collect();
        write(&input_path, &original_content).await.unwrap();

        let mut manager = EncryptionManager::new().unwrap();
        manager.enable_encryption("test_exact_chunk").unwrap();

        manager
            .encrypt_file(&input_path, &encrypted_path)
            .await
            .unwrap();
        manager
            .decrypt_file(&encrypted_path, &decrypted_path)
            .await
            .unwrap();

        let decrypted_content = tokio::fs::read(&decrypted_path).await.unwrap();
        assert_eq!(decrypted_content.len(), original_content.len());
        assert_eq!(decrypted_content, original_content);

        let _ = manager.disable_encryption();
    }

    #[tokio::test]
    async fn test_round_trip_multiple_exact_chunks() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("multi_exact.bin");
        let encrypted_path = temp_dir.path().join("multi_exact_encrypted.bin");
        let decrypted_path = temp_dir.path().join("multi_exact_decrypted.bin");

        // Create file exactly 3 chunks (192KB)
        const CHUNK_SIZE: usize = 64 * 1024;
        let original_content: Vec<u8> = (0..(CHUNK_SIZE * 3)).map(|i| (i % 256) as u8).collect();
        write(&input_path, &original_content).await.unwrap();

        let mut manager = EncryptionManager::new().unwrap();
        manager.enable_encryption("test_multi_exact").unwrap();

        manager
            .encrypt_file(&input_path, &encrypted_path)
            .await
            .unwrap();
        manager
            .decrypt_file(&encrypted_path, &decrypted_path)
            .await
            .unwrap();

        let decrypted_content = tokio::fs::read(&decrypted_path).await.unwrap();
        assert_eq!(decrypted_content.len(), original_content.len());
        assert_eq!(decrypted_content, original_content);

        let _ = manager.disable_encryption();
    }

    #[tokio::test]
    async fn test_round_trip_all_zeros() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("zeros.bin");
        let encrypted_path = temp_dir.path().join("zeros_encrypted.bin");
        let decrypted_path = temp_dir.path().join("zeros_decrypted.bin");

        // Create file with all zeros
        let original_content = vec![0u8; 100_000];
        write(&input_path, &original_content).await.unwrap();

        let mut manager = EncryptionManager::new().unwrap();
        manager.enable_encryption("test_all_zeros").unwrap();

        manager
            .encrypt_file(&input_path, &encrypted_path)
            .await
            .unwrap();
        manager
            .decrypt_file(&encrypted_path, &decrypted_path)
            .await
            .unwrap();

        let decrypted_content = tokio::fs::read(&decrypted_path).await.unwrap();
        assert_eq!(decrypted_content.len(), original_content.len());
        assert_eq!(decrypted_content, original_content);

        let _ = manager.disable_encryption();
    }

    #[tokio::test]
    async fn test_round_trip_all_ones() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("ones.bin");
        let encrypted_path = temp_dir.path().join("ones_encrypted.bin");
        let decrypted_path = temp_dir.path().join("ones_decrypted.bin");

        // Create file with all 0xFF bytes
        let original_content = vec![0xFFu8; 100_000];
        write(&input_path, &original_content).await.unwrap();

        let mut manager = EncryptionManager::new().unwrap();
        manager.enable_encryption("test_all_ones").unwrap();

        manager
            .encrypt_file(&input_path, &encrypted_path)
            .await
            .unwrap();
        manager
            .decrypt_file(&encrypted_path, &decrypted_path)
            .await
            .unwrap();

        let decrypted_content = tokio::fs::read(&decrypted_path).await.unwrap();
        assert_eq!(decrypted_content.len(), original_content.len());
        assert_eq!(decrypted_content, original_content);

        let _ = manager.disable_encryption();
    }

    #[tokio::test]
    async fn test_round_trip_random_data() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("random.bin");
        let encrypted_path = temp_dir.path().join("random_encrypted.bin");
        let decrypted_path = temp_dir.path().join("random_decrypted.bin");

        // Create file with random data
        let mut original_content = vec![0u8; 100_000];
        rand::thread_rng().fill_bytes(&mut original_content);
        write(&input_path, &original_content).await.unwrap();

        let mut manager = EncryptionManager::new().unwrap();
        manager.enable_encryption("test_random_data").unwrap();

        manager
            .encrypt_file(&input_path, &encrypted_path)
            .await
            .unwrap();
        manager
            .decrypt_file(&encrypted_path, &decrypted_path)
            .await
            .unwrap();

        let decrypted_content = tokio::fs::read(&decrypted_path).await.unwrap();
        assert_eq!(decrypted_content.len(), original_content.len());
        assert_eq!(decrypted_content, original_content);

        let _ = manager.disable_encryption();
    }

    #[tokio::test]
    async fn test_round_trip_text_data() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("text.txt");
        let encrypted_path = temp_dir.path().join("text_encrypted.bin");
        let decrypted_path = temp_dir.path().join("text_decrypted.txt");

        // Create file with text data including unicode
        let original_content = "Hello, World! 🌍\nThis is a test file.\nIt contains multiple lines.\n日本語\nEmoji: 😀🎉\n".repeat(1000);
        write(&input_path, original_content.as_bytes())
            .await
            .unwrap();

        let mut manager = EncryptionManager::new().unwrap();
        manager.enable_encryption("test_text_data").unwrap();

        manager
            .encrypt_file(&input_path, &encrypted_path)
            .await
            .unwrap();
        manager
            .decrypt_file(&encrypted_path, &decrypted_path)
            .await
            .unwrap();

        let decrypted_content = tokio::fs::read_to_string(&decrypted_path).await.unwrap();
        assert_eq!(decrypted_content, original_content);

        let _ = manager.disable_encryption();
    }

    #[tokio::test]
    async fn test_round_trip_very_large_file() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("large.bin");
        let encrypted_path = temp_dir.path().join("large_encrypted.bin");
        let decrypted_path = temp_dir.path().join("large_decrypted.bin");

        // Create 1MB file (multiple chunks)
        let original_content: Vec<u8> = (0..1_000_000).map(|i| (i % 256) as u8).collect();
        write(&input_path, &original_content).await.unwrap();

        let mut manager = EncryptionManager::new().unwrap();
        manager.enable_encryption("test_very_large").unwrap();

        manager
            .encrypt_file(&input_path, &encrypted_path)
            .await
            .unwrap();
        manager
            .decrypt_file(&encrypted_path, &decrypted_path)
            .await
            .unwrap();

        let decrypted_content = tokio::fs::read(&decrypted_path).await.unwrap();
        assert_eq!(decrypted_content.len(), original_content.len());
        assert_eq!(decrypted_content, original_content);

        let _ = manager.disable_encryption();
    }

    #[tokio::test]
    async fn test_round_trip_different_passphrases() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("input.txt");
        let encrypted1_path = temp_dir.path().join("encrypted1.bin");
        let encrypted2_path = temp_dir.path().join("encrypted2.bin");
        let decrypted1_path = temp_dir.path().join("decrypted1.txt");
        let decrypted2_path = temp_dir.path().join("decrypted2.txt");

        let original_content = b"Test content for different passphrases";
        write(&input_path, original_content).await.unwrap();

        // Encrypt with first passphrase
        let mut manager1 = EncryptionManager::new().unwrap();
        manager1.enable_encryption("passphrase_one").unwrap();
        manager1
            .encrypt_file(&input_path, &encrypted1_path)
            .await
            .unwrap();
        manager1
            .decrypt_file(&encrypted1_path, &decrypted1_path)
            .await
            .unwrap();

        // Encrypt with second passphrase
        let mut manager2 = EncryptionManager::new().unwrap();
        manager2.enable_encryption("passphrase_two").unwrap();
        manager2
            .encrypt_file(&input_path, &encrypted2_path)
            .await
            .unwrap();
        manager2
            .decrypt_file(&encrypted2_path, &decrypted2_path)
            .await
            .unwrap();

        // Both should decrypt correctly
        let decrypted1 = tokio::fs::read(&decrypted1_path).await.unwrap();
        let decrypted2 = tokio::fs::read(&decrypted2_path).await.unwrap();
        assert_eq!(decrypted1, original_content);
        assert_eq!(decrypted2, original_content);

        // Encrypted files should be different
        let encrypted1 = tokio::fs::read(&encrypted1_path).await.unwrap();
        let encrypted2 = tokio::fs::read(&encrypted2_path).await.unwrap();
        assert_ne!(encrypted1, encrypted2);

        let _ = manager1.disable_encryption();
        let _ = manager2.disable_encryption();
    }

    #[tokio::test]
    async fn test_decrypt_with_wrong_key_fails() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("input.txt");
        let encrypted_path = temp_dir.path().join("encrypted.bin");
        let decrypted_path = temp_dir.path().join("decrypted.txt");

        let original_content = b"Secret content that should not decrypt with wrong key";
        write(&input_path, original_content).await.unwrap();

        // Encrypt with first passphrase
        let mut manager1 = EncryptionManager::new().unwrap();
        manager1.enable_encryption("correct_passphrase").unwrap();
        manager1
            .encrypt_file(&input_path, &encrypted_path)
            .await
            .unwrap();
        let _ = manager1.disable_encryption();

        // Try to decrypt with different passphrase
        let mut manager2 = EncryptionManager::new().unwrap();
        manager2.enable_encryption("wrong_passphrase").unwrap();
        let result = manager2
            .decrypt_file(&encrypted_path, &decrypted_path)
            .await;

        // Should fail to decrypt
        assert!(result.is_err());
        match result {
            Err(KiyyaError::Encryption { message }) => {
                assert!(message.contains("Decryption failed"));
            }
            _ => panic!("Expected decryption error"),
        }

        let _ = manager2.disable_encryption();
    }

    #[tokio::test]
    async fn test_round_trip_preserves_binary_data() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("binary.bin");
        let encrypted_path = temp_dir.path().join("binary_encrypted.bin");
        let decrypted_path = temp_dir.path().join("binary_decrypted.bin");

        // Create binary data with all possible byte values
        let original_content: Vec<u8> = (0..=255).cycle().take(10_000).collect();
        write(&input_path, &original_content).await.unwrap();

        let mut manager = EncryptionManager::new().unwrap();
        manager.enable_encryption("test_binary_data").unwrap();

        manager
            .encrypt_file(&input_path, &encrypted_path)
            .await
            .unwrap();
        manager
            .decrypt_file(&encrypted_path, &decrypted_path)
            .await
            .unwrap();

        let decrypted_content = tokio::fs::read(&decrypted_path).await.unwrap();
        assert_eq!(decrypted_content.len(), original_content.len());

        // Verify every byte matches
        for (i, (&original, &decrypted)) in original_content
            .iter()
            .zip(decrypted_content.iter())
            .enumerate()
        {
            assert_eq!(original, decrypted, "Byte mismatch at position {}", i);
        }

        let _ = manager.disable_encryption();
    }

    #[tokio::test]
    async fn test_encrypted_file_is_different_from_original() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("input.txt");
        let encrypted_path = temp_dir.path().join("encrypted.bin");

        let original_content = b"This content should be encrypted and look different";
        write(&input_path, original_content).await.unwrap();

        let mut manager = EncryptionManager::new().unwrap();
        manager
            .enable_encryption("test_encryption_changes_data")
            .unwrap();

        manager
            .encrypt_file(&input_path, &encrypted_path)
            .await
            .unwrap();

        let encrypted_content = tokio::fs::read(&encrypted_path).await.unwrap();

        // Encrypted file should be different from original
        assert_ne!(encrypted_content, original_content);

        // Encrypted file should be larger (includes nonce and chunk metadata)
        assert!(encrypted_content.len() > original_content.len());

        let _ = manager.disable_encryption();
    }

    #[tokio::test]
    async fn test_multiple_sequential_round_trips() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("input.txt");

        let original_content = b"Content for multiple round trips";
        write(&input_path, original_content).await.unwrap();

        let mut manager = EncryptionManager::new().unwrap();
        manager.enable_encryption("test_multiple_trips").unwrap();

        // Perform 5 sequential encrypt-decrypt cycles
        for i in 0..5 {
            let encrypted_path = temp_dir.path().join(format!("encrypted_{}.bin", i));
            let decrypted_path = temp_dir.path().join(format!("decrypted_{}.txt", i));

            manager
                .encrypt_file(&input_path, &encrypted_path)
                .await
                .unwrap();
            manager
                .decrypt_file(&encrypted_path, &decrypted_path)
                .await
                .unwrap();

            let decrypted_content = tokio::fs::read(&decrypted_path).await.unwrap();
            assert_eq!(
                decrypted_content, original_content,
                "Round trip {} failed",
                i
            );
        }

        let _ = manager.disable_encryption();
    }
}
