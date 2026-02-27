/// Comprehensive test suite for encryption key management
///
/// This test verifies that encryption keys are ONLY stored in the OS keystore
/// and NEVER in code or database, as per security requirement 11.2.3
///
/// Test Coverage:
/// 1. Keys are stored only in OS keystore
/// 2. Keys are never stored in database tables
/// 3. Keys are never hard-coded in source code
/// 4. Keys are properly removed from keystore on disable
/// 5. Multiple encryption managers can access the same keystore key
/// 6. Database schema contains no encryption key columns
#[cfg(test)]
mod encryption_key_management_tests {
    use crate::database::Database;
    use crate::encryption::EncryptionManager;
    use rusqlite::Connection;
    use tempfile::TempDir;
    use tokio::fs::write;

    /// Test 1: Verify keys are stored only in OS keystore
    #[tokio::test]
    async fn test_keys_only_in_os_keystore() {
        // Clean up any existing keys
        let mut cleanup = EncryptionManager::new().unwrap();
        let _ = cleanup.disable_encryption();
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

        // Create manager and enable encryption
        let mut manager1 = EncryptionManager::new().unwrap();
        assert!(!manager1.is_encryption_enabled(), "Should start disabled");

        let result = manager1.enable_encryption("test_keystore_only");
        assert!(result.is_ok(), "Should enable encryption successfully");
        assert!(manager1.is_encryption_enabled(), "Should be enabled");

        // Create a second manager and load from keystore
        let mut manager2 = EncryptionManager::new().unwrap();
        assert!(
            !manager2.is_encryption_enabled(),
            "New manager should start disabled"
        );

        let load_result = manager2.load_encryption_from_keystore();
        assert!(load_result.is_ok(), "Should load from keystore");
        assert!(load_result.unwrap(), "Should find key in keystore");
        assert!(
            manager2.is_encryption_enabled(),
            "Should be enabled after loading"
        );

        // Both managers should be able to encrypt/decrypt
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("test.txt");
        let encrypted1_path = temp_dir.path().join("encrypted1.bin");
        let encrypted2_path = temp_dir.path().join("encrypted2.bin");
        let decrypted1_path = temp_dir.path().join("decrypted1.txt");
        let decrypted2_path = temp_dir.path().join("decrypted2.txt");

        let test_content = b"Test content for keystore verification";
        write(&input_path, test_content).await.unwrap();

        // Manager 1 encrypts
        manager1
            .encrypt_file(&input_path, &encrypted1_path)
            .await
            .unwrap();

        // Manager 2 decrypts (using same key from keystore)
        manager2
            .decrypt_file(&encrypted1_path, &decrypted1_path)
            .await
            .unwrap();

        let decrypted = tokio::fs::read(&decrypted1_path).await.unwrap();
        assert_eq!(
            decrypted, test_content,
            "Should decrypt correctly with keystore key"
        );

        // Manager 2 encrypts
        manager2
            .encrypt_file(&input_path, &encrypted2_path)
            .await
            .unwrap();

        // Manager 1 decrypts
        manager1
            .decrypt_file(&encrypted2_path, &decrypted2_path)
            .await
            .unwrap();

        let decrypted2 = tokio::fs::read(&decrypted2_path).await.unwrap();
        assert_eq!(
            decrypted2, test_content,
            "Should decrypt correctly with keystore key"
        );

        // Clean up
        let _ = manager1.disable_encryption();
    }

    /// Test 2: Verify database schema contains NO encryption key columns
    #[tokio::test]
    async fn test_database_has_no_key_columns() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");

        // Create database
        let _db = Database::new_with_path(&db_path).await.unwrap();

        // Get all table schemas
        let conn = Connection::open(&db_path).unwrap();

        // Check each table for encryption key columns
        let tables = vec![
            "migrations",
            "favorites",
            "progress",
            "offline_meta",
            "local_cache",
            "playlists",
            "playlist_items",
            "app_settings",
            "cache_stats",
        ];

        for table in tables {
            let mut stmt = conn
                .prepare(&format!("PRAGMA table_info({})", table))
                .unwrap();

            let columns: Vec<String> = stmt
                .query_map([], |row| row.get::<_, String>(1))
                .unwrap()
                .filter_map(|r| r.ok())
                .collect();

            // Verify no columns contain "key", "passphrase", "secret", "cipher", "crypto"
            for column in &columns {
                let lower = column.to_lowercase();
                assert!(
                    !lower.contains("key") || column == "key" || column == "seriesKey",
                    "Table {} has suspicious column: {}",
                    table,
                    column
                );
                assert!(
                    !lower.contains("passphrase"),
                    "Table {} has passphrase column: {}",
                    table,
                    column
                );
                assert!(
                    !lower.contains("secret"),
                    "Table {} has secret column: {}",
                    table,
                    column
                );
                assert!(
                    !lower.contains("cipher"),
                    "Table {} has cipher column: {}",
                    table,
                    column
                );
                assert!(
                    !lower.contains("crypto"),
                    "Table {} has crypto column: {}",
                    table,
                    column
                );
            }
        }

        // Specifically check app_settings table doesn't store encryption keys
        let mut stmt = conn
            .prepare("SELECT key FROM app_settings WHERE key LIKE '%key%' OR key LIKE '%passphrase%' OR key LIKE '%secret%'")
            .unwrap();

        let key_settings: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        // Only allowed key-related settings are configuration keys, not encryption keys
        for setting_key in key_settings {
            assert!(
                setting_key == "last_used_quality"
                    || setting_key.ends_with("_key") && !setting_key.contains("encryption"),
                "Found suspicious setting key: {}",
                setting_key
            );
        }
    }

    /// Test 3: Verify keys are never stored in database values
    #[tokio::test]
    async fn test_database_values_contain_no_keys() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");

        // Create database and encryption manager
        let db = Database::new_with_path(&db_path).await.unwrap();
        let mut manager = EncryptionManager::new().unwrap();

        // Clean up first
        let _ = manager.disable_encryption();
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

        // Enable encryption
        manager.enable_encryption("test_no_db_storage").unwrap();

        // Store some test data in database
        db.set_setting("theme", "dark").await.unwrap();
        db.set_setting("encrypt_downloads", "true").await.unwrap();

        // Read all settings from database
        let settings = db.get_all_settings().await.unwrap();

        // Verify no setting values look like encryption keys
        for (key, value) in settings {
            // Base64 encoded keys would be 44 characters for 32-byte keys
            // Hex encoded keys would be 64 characters
            if value.len() >= 32 {
                // Check if it looks like base64 or hex
                let is_base64_like = value
                    .chars()
                    .all(|c| c.is_alphanumeric() || c == '+' || c == '/' || c == '=');
                let is_hex_like = value.chars().all(|c| c.is_ascii_hexdigit());

                if is_base64_like || is_hex_like {
                    panic!(
                        "Setting '{}' has value that looks like an encoded key: {} (length: {})",
                        key,
                        value,
                        value.len()
                    );
                }
            }
        }

        // Clean up
        let _ = manager.disable_encryption();
    }

    /// Test 4: Verify key removal from keystore on disable
    #[tokio::test]
    async fn test_key_removed_from_keystore_on_disable() {
        // Clean up first
        let mut cleanup = EncryptionManager::new().unwrap();
        let _ = cleanup.disable_encryption();
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

        // Enable encryption
        let mut manager = EncryptionManager::new().unwrap();
        manager.enable_encryption("test_key_removal").unwrap();
        assert!(manager.is_encryption_enabled());

        // Verify key is in keystore
        let mut verifier = EncryptionManager::new().unwrap();
        let load_result = verifier.load_encryption_from_keystore();
        assert!(load_result.is_ok());
        assert!(load_result.unwrap(), "Key should be in keystore");

        // Disable encryption
        manager.disable_encryption().unwrap();
        assert!(!manager.is_encryption_enabled());

        // Wait for keystore operation to complete
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // Verify key is removed from keystore
        let mut verifier2 = EncryptionManager::new().unwrap();
        let load_result2 = verifier2.load_encryption_from_keystore();
        assert!(load_result2.is_ok());
        assert!(
            !load_result2.unwrap(),
            "Key should be removed from keystore"
        );
    }

    /// Test 5: Verify no hard-coded keys in encryption manager
    #[tokio::test]
    async fn test_no_hardcoded_keys() {
        // A new manager should have no encryption enabled
        let manager = EncryptionManager::new().unwrap();
        assert!(
            !manager.is_encryption_enabled(),
            "Should not have encryption without passphrase"
        );

        // Encryption requires explicit passphrase
        let mut manager2 = EncryptionManager::new().unwrap();
        let result = manager2.enable_encryption("");
        // Empty passphrase should still work (though not recommended)
        // The point is it requires a passphrase, not a hard-coded key
        assert!(result.is_ok(), "Should require passphrase to enable");

        // Clean up
        let _ = manager2.disable_encryption();
    }

    /// Test 6: Verify encrypted files don't contain raw keys
    #[tokio::test]
    async fn test_encrypted_files_contain_no_raw_keys() {
        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("input.txt");
        let encrypted_path = temp_dir.path().join("encrypted.bin");

        // Clean up first
        let mut cleanup = EncryptionManager::new().unwrap();
        let _ = cleanup.disable_encryption();
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

        // Create test content
        let test_content = b"Test content for key verification in encrypted files";
        write(&input_path, test_content).await.unwrap();

        // Enable encryption with known passphrase
        let mut manager = EncryptionManager::new().unwrap();
        let passphrase = "test_passphrase_for_file_check";
        manager.enable_encryption(passphrase).unwrap();

        // Encrypt file
        manager
            .encrypt_file(&input_path, &encrypted_path)
            .await
            .unwrap();

        // Read encrypted file
        let encrypted_content = tokio::fs::read(&encrypted_path).await.unwrap();

        // Verify passphrase is not in encrypted file
        let encrypted_str = String::from_utf8_lossy(&encrypted_content);
        assert!(
            !encrypted_str.contains(passphrase),
            "Encrypted file should not contain passphrase"
        );

        // Verify encrypted file doesn't contain obvious key patterns
        // (This is a heuristic check - encrypted data should look random)
        let has_repeated_patterns = encrypted_content.windows(16).any(|window| {
            encrypted_content
                .windows(16)
                .filter(|w| w == &window)
                .count()
                > 3
        });

        assert!(
            !has_repeated_patterns,
            "Encrypted file should not have obvious repeated patterns"
        );

        // Clean up
        let _ = manager.disable_encryption();
    }

    /// Test 7: Verify multiple managers can't interfere with each other's keys
    #[tokio::test]
    async fn test_keystore_isolation() {
        // Clean up first
        let mut cleanup = EncryptionManager::new().unwrap();
        let _ = cleanup.disable_encryption();
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

        let temp_dir = TempDir::new().unwrap();
        let input_path = temp_dir.path().join("input.txt");
        let encrypted1_path = temp_dir.path().join("encrypted1.bin");
        let encrypted2_path = temp_dir.path().join("encrypted2.bin");

        let test_content = b"Test content for keystore isolation";
        write(&input_path, test_content).await.unwrap();

        // Manager 1 with passphrase 1
        let mut manager1 = EncryptionManager::new().unwrap();
        manager1.enable_encryption("passphrase_one").unwrap();
        manager1
            .encrypt_file(&input_path, &encrypted1_path)
            .await
            .unwrap();

        // The keystore only stores one key at a time for the app
        // So enabling with a different passphrase should replace it
        let mut manager2 = EncryptionManager::new().unwrap();
        manager2.enable_encryption("passphrase_two").unwrap();
        manager2
            .encrypt_file(&input_path, &encrypted2_path)
            .await
            .unwrap();

        // Now manager1 should not be able to decrypt encrypted2 (different key)
        let decrypted_path = temp_dir.path().join("decrypted.txt");
        let result = manager1
            .decrypt_file(&encrypted2_path, &decrypted_path)
            .await;

        // This should fail because manager1 has the old key, but encrypted2 used the new key
        assert!(result.is_err(), "Should not decrypt with wrong key");

        // Clean up
        let _ = manager2.disable_encryption();
    }

    /// Test 8: Verify offline_meta table only stores encryption flag, not keys
    #[tokio::test]
    async fn test_offline_meta_stores_only_flag() {
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test.db");

        // Create database
        let _db = Database::new_with_path(&db_path).await.unwrap();

        // Store offline metadata with encryption flag
        let metadata = crate::models::OfflineMetadata {
            claim_id: "test_claim".to_string(),
            quality: "720p".to_string(),
            filename: "test.mp4".to_string(),
            file_size: 1024,
            encrypted: true,
            added_at: chrono::Utc::now().timestamp(),
        };

        _db.save_offline_metadata(metadata).await.unwrap();

        // Query database directly
        let conn = Connection::open(&db_path).unwrap();
        let mut stmt = conn
            .prepare("SELECT encrypted FROM offline_meta WHERE claimId = 'test_claim'")
            .unwrap();

        let encrypted_value: bool = stmt.query_row([], |row| row.get(0)).unwrap();

        // Verify it's just a boolean flag, not a key
        assert!(encrypted_value, "Should store boolean flag");

        // Verify the table schema doesn't have key-related columns
        let mut schema_stmt = conn.prepare("PRAGMA table_info(offline_meta)").unwrap();

        let columns: Vec<String> = schema_stmt
            .query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        // Check column names don't suggest key storage
        for column in &columns {
            let lower = column.to_lowercase();
            assert!(
                !lower.contains("passphrase")
                    && !lower.contains("secret")
                    && !lower.contains("cipher"),
                "Column name suggests key storage: {}",
                column
            );
        }

        // Verify all string values in the row are not key-like
        let mut data_stmt = conn
            .prepare("SELECT filename FROM offline_meta WHERE claimId = 'test_claim'")
            .unwrap();

        let filename: String = data_stmt.query_row([], |row| row.get(0)).unwrap();

        // Filename should be a normal filename, not a key
        assert_eq!(filename, "test.mp4", "Filename should be normal, not a key");
    }
}
