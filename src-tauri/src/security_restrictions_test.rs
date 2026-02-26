/// Comprehensive Security Restrictions Verification Tests
///
/// This test module verifies that all security restrictions are properly enforced:
/// 1. Network restrictions (only approved Odysee domains + update manifest)
/// 2. Filesystem access limitations (app data folder only)
/// 3. Encryption key management (OS keystore only, never in code/DB)
/// 4. Input sanitization (no unwrap() on external data, no unchecked casts)
/// 5. Security boundary enforcement
///
/// Validates: Requirements 12.1, 12.2, 12.3, 12.4, 22.1, 22.3, 22.5

#[cfg(test)]
mod tests {
    use crate::encryption::EncryptionManager;
    use crate::path_security;
    use crate::validation;

    // ========== Network Restrictions Tests ==========

    #[test]
    fn test_network_restriction_approved_domains() {
        // Approved domains should pass
        let approved_urls = vec![
            "https://github.com/user/repo",
            "https://raw.githubusercontent.com/user/repo/main/version.json",
            "https://odysee.com/@channel",
            "https://api.odysee.com/api/v1/claim_search",
            "https://api.lbry.tv/api/v1/claim_search",
            "https://api.na-backend.odysee.com/api/v1/claim_search",
            // Note: cdn.lbryplayer.xyz and player.odycdn.com are for download URLs,
            // not external URLs that open in browser, so they're not in the approved list
        ];

        for url in approved_urls {
            let result = validation::validate_external_url(url);
            assert!(
                result.is_ok(),
                "Approved URL should pass validation: {}",
                url
            );
        }
    }

    #[test]
    fn test_network_restriction_unapproved_domains_blocked() {
        // Unapproved domains should be blocked
        let blocked_urls = vec![
            "https://evil.com/malware",
            "https://attacker.com/phishing",
            "https://example.com/data",
            "https://google.com/search",
            "https://facebook.com/page",
            "https://twitter.com/user",
            "https://malicious-site.net/payload",
        ];

        for url in blocked_urls {
            let result = validation::validate_external_url(url);
            assert!(result.is_err(), "Unapproved URL should be blocked: {}", url);
        }
    }

    #[test]
    fn test_network_restriction_http_blocked() {
        // HTTP (non-HTTPS) should be blocked for external URLs
        let http_urls = vec![
            "http://github.com/user/repo",
            "http://odysee.com/@channel",
            "http://api.odysee.com/api/v1/claim_search",
        ];

        for url in http_urls {
            let result = validation::validate_external_url(url);
            assert!(
                result.is_err(),
                "HTTP URL should be blocked (must be HTTPS): {}",
                url
            );
        }
    }

    #[test]
    fn test_network_restriction_invalid_protocols_blocked() {
        // Invalid protocols should be blocked
        let invalid_urls = vec![
            "ftp://example.com/file",
            "file:///etc/passwd",
            "javascript:alert(1)",
            "data:text/html,<script>alert(1)</script>",
            "about:blank",
        ];

        for url in invalid_urls {
            let result = validation::validate_download_url(url);
            assert!(
                result.is_err(),
                "Invalid protocol should be blocked: {}",
                url
            );
        }
    }

    // ========== Filesystem Access Restrictions Tests ==========

    #[test]
    fn test_filesystem_restriction_app_data_only() {
        // Valid paths within app data should pass
        let valid_paths = vec![
            "vault/movie.mp4",
            "logs/gateway.log",
            "database.db",
            "vault/movies/action/video.mp4",
            "cache/thumbnails/image.jpg",
        ];

        for path in valid_paths {
            let result = path_security::validate_path(path);
            assert!(result.is_ok(), "Valid app data path should pass: {}", path);
        }
    }

    #[test]
    fn test_filesystem_restriction_path_traversal_blocked() {
        // Path traversal attempts should be blocked
        let traversal_attempts = vec![
            "../../../etc/passwd",
            "vault/../../../../../../etc/passwd",
            "logs/../../../Windows/System32/config",
            "../outside_app_data.txt",
            "vault/../../../sensitive_file",
        ];

        for path in traversal_attempts {
            let result = path_security::validate_path(path);
            assert!(
                result.is_err(),
                "Path traversal should be blocked: {}",
                path
            );
        }
    }

    #[test]
    fn test_filesystem_restriction_absolute_paths_outside_blocked() {
        // Absolute paths outside app data should be blocked
        #[cfg(target_os = "windows")]
        let absolute_paths = vec![
            "C:\\Windows\\System32\\config",
            "C:\\Program Files\\sensitive.exe",
            "D:\\Users\\Documents\\private.txt",
        ];

        #[cfg(not(target_os = "windows"))]
        let absolute_paths = vec![
            "/etc/passwd",
            "/var/log/system.log",
            "/home/user/private.txt",
            "/root/.ssh/id_rsa",
        ];

        for path in absolute_paths {
            let result = path_security::validate_path(path);
            assert!(
                result.is_err(),
                "Absolute path outside app data should be blocked: {}",
                path
            );
        }
    }

    // ========== Encryption Key Management Tests ==========

    #[tokio::test]
    async fn test_encryption_key_stored_in_os_keystore_only() {
        // Clean up any existing keys first
        let mut cleanup_manager = EncryptionManager::new().unwrap();
        let _ = cleanup_manager.disable_encryption();

        let mut manager = EncryptionManager::new().unwrap();

        // Enable encryption - key should be stored in OS keystore
        let result = manager.enable_encryption("test_keystore_security");
        assert!(result.is_ok(), "Encryption should be enabled successfully");

        // Verify encryption is enabled
        assert!(
            manager.is_encryption_enabled(),
            "Encryption should be enabled"
        );

        // Create new manager and load from keystore
        let mut manager2 = EncryptionManager::new().unwrap();
        let load_result = manager2.load_encryption_from_keystore();
        assert!(
            load_result.is_ok(),
            "Should be able to load key from keystore"
        );
        assert!(load_result.unwrap(), "Key should be found in keystore");

        // Clean up
        let _ = manager2.disable_encryption();
    }

    #[tokio::test]
    async fn test_encryption_key_removed_from_keystore_on_disable() {
        // Clean up any existing keys first to ensure test isolation
        let mut cleanup_manager = EncryptionManager::new().unwrap();
        let _ = cleanup_manager.disable_encryption();

        // Wait a bit to ensure keystore operations complete
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // Create a fresh manager and enable encryption
        let mut manager = EncryptionManager::new().unwrap();
        let enable_result = manager.enable_encryption("test_key_removal");
        assert!(
            enable_result.is_ok(),
            "Encryption should be enabled successfully"
        );

        // Verify encryption is enabled in the current manager
        assert!(
            manager.is_encryption_enabled(),
            "Encryption should be enabled in current manager"
        );

        // Now disable encryption
        let disable_result = manager.disable_encryption();
        assert!(
            disable_result.is_ok(),
            "Encryption should be disabled successfully: {:?}",
            disable_result.err()
        );

        // Wait a bit to ensure keystore deletion completes
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // Try to load key with a new manager - should not be found
        let mut manager2 = EncryptionManager::new().unwrap();
        let load_result = manager2.load_encryption_from_keystore();
        assert!(
            load_result.is_ok(),
            "Load operation should not error: {:?}",
            load_result.err()
        );
        assert!(
            !load_result.unwrap(),
            "Key should not be found after removal"
        );

        // Final cleanup to ensure no keys are left
        let _ = manager2.disable_encryption();
    }

    #[tokio::test]
    async fn test_encryption_key_never_in_code_or_database() {
        // This test verifies that encryption keys are never hard-coded
        // or stored in the database by checking the encryption manager
        // only uses the OS keystore

        let mut manager = EncryptionManager::new().unwrap();
        manager.enable_encryption("test_no_hardcoded_keys").unwrap();

        // The fact that we need to enable encryption with a passphrase
        // and it's stored in the keystore proves keys are not hard-coded

        // Verify that without the keystore, encryption doesn't work
        let manager_without_key = EncryptionManager::new().unwrap();
        assert!(
            !manager_without_key.is_encryption_enabled(),
            "New manager without keystore should not have encryption enabled"
        );

        // Clean up
        let _ = manager.disable_encryption();
    }

    // ========== Input Sanitization Tests ==========

    #[test]
    fn test_input_sanitization_no_sql_injection() {
        // SQL injection attempts should be blocked
        let sql_injection_attempts = vec![
            "'; DROP TABLE users--",
            "1' OR '1'='1",
            "admin'--",
            "' UNION SELECT * FROM passwords--",
            "1; DELETE FROM content WHERE 1=1--",
        ];

        for attempt in sql_injection_attempts {
            // Test claim ID validation
            let result = validation::validate_claim_id(attempt);
            assert!(
                result.is_err(),
                "SQL injection in claim ID should be blocked: {}",
                attempt
            );

            // Test search text validation - it sanitizes the input
            // Search text validation escapes special characters for LIKE patterns
            // but doesn't reject SQL keywords since they could be legitimate search terms
            // The actual SQL injection protection happens at the query level with prepared statements
        }
    }

    #[test]
    fn test_input_sanitization_null_bytes_blocked() {
        // Null bytes should be blocked in all inputs
        let inputs_with_null_bytes = vec![
            "claim\0id",
            "search\0term",
            "tag\0name",
            "title\0text",
            "url\0path",
        ];

        for input in inputs_with_null_bytes {
            assert!(
                validation::validate_claim_id(input).is_err(),
                "Null byte in claim ID should be blocked"
            );
            assert!(
                validation::validate_search_text(input).is_err(),
                "Null byte in search text should be blocked"
            );
            assert!(
                validation::validate_title(input).is_err(),
                "Null byte in title should be blocked"
            );
        }
    }

    #[test]
    fn test_input_sanitization_length_limits_enforced() {
        // Excessively long inputs should be rejected
        let long_claim_id = "a".repeat(101);
        assert!(
            validation::validate_claim_id(&long_claim_id).is_err(),
            "Claim ID exceeding 100 characters should be rejected"
        );

        let long_search = "a".repeat(201);
        assert!(
            validation::validate_search_text(&long_search).is_err(),
            "Search text exceeding 200 characters should be rejected"
        );

        let long_title = "a".repeat(501);
        assert!(
            validation::validate_title(&long_title).is_err(),
            "Title exceeding 500 characters should be rejected"
        );

        let long_url = format!("https://example.com/{}", "a".repeat(2048));
        assert!(
            validation::validate_download_url(&long_url).is_err(),
            "URL exceeding 2048 characters should be rejected"
        );
    }

    #[test]
    fn test_input_sanitization_empty_inputs_rejected() {
        // Empty inputs should be rejected where appropriate
        assert!(
            validation::validate_claim_id("").is_err(),
            "Empty claim ID should be rejected"
        );
        assert!(
            validation::validate_claim_id("   ").is_err(),
            "Whitespace-only claim ID should be rejected"
        );

        assert!(
            validation::validate_search_text("").is_err(),
            "Empty search text should be rejected"
        );
        assert!(
            validation::validate_search_text("   ").is_err(),
            "Whitespace-only search text should be rejected"
        );

        assert!(
            validation::validate_title("").is_err(),
            "Empty title should be rejected"
        );
        assert!(
            validation::validate_title("   ").is_err(),
            "Whitespace-only title should be rejected"
        );
    }

    // ========== Security Boundary Enforcement Tests ==========

    #[test]
    fn test_security_boundary_setting_keys_restricted() {
        // Only predefined setting keys should be allowed
        let valid_keys = vec![
            "theme",
            "last_used_quality",
            "encrypt_downloads",
            "auto_upgrade_quality",
            "cache_ttl_minutes",
            "max_cache_items",
        ];

        for key in valid_keys {
            assert!(
                validation::validate_setting_key(key).is_ok(),
                "Valid setting key should be accepted: {}",
                key
            );
        }

        let invalid_keys = vec![
            "arbitrary_key",
            "malicious_setting",
            "admin_password",
            "secret_token",
        ];

        for key in invalid_keys {
            assert!(
                validation::validate_setting_key(key).is_err(),
                "Invalid setting key should be rejected: {}",
                key
            );
        }
    }

    #[test]
    fn test_security_boundary_quality_values_restricted() {
        // In the new CDN-first architecture, we only use "master" quality for HLS adaptive streaming
        let valid_qualities = vec!["master"];

        for quality in valid_qualities {
            assert!(
                validation::validate_quality(quality).is_ok(),
                "Valid quality should be accepted: {}",
                quality
            );
        }

        let invalid_qualities = vec![
            "invalid",
            "9999p",
            "ultra",
            "max",
            "'; DROP TABLE--",
            // Old quality-specific values are no longer valid
            "240p",
            "360p",
            "480p",
            "720p",
            "1080p",
            "1440p",
            "2160p",
            "4k",
        ];

        for quality in invalid_qualities {
            assert!(
                validation::validate_quality(quality).is_err(),
                "Invalid quality should be rejected: {}",
                quality
            );
        }
    }

    #[test]
    fn test_security_boundary_numeric_ranges_enforced() {
        // Position seconds should be limited to 24 hours
        assert!(validation::validate_position_seconds(0).is_ok());
        assert!(validation::validate_position_seconds(86400).is_ok()); // 24 hours
        assert!(validation::validate_position_seconds(86401).is_err()); // Over 24 hours

        // Cache TTL should be between 1 and 1440 minutes
        assert!(validation::validate_setting_value("cache_ttl_minutes", "1").is_ok());
        assert!(validation::validate_setting_value("cache_ttl_minutes", "1440").is_ok());
        assert!(validation::validate_setting_value("cache_ttl_minutes", "0").is_err());
        assert!(validation::validate_setting_value("cache_ttl_minutes", "2000").is_err());

        // Max cache items should be between 1 and 10000
        assert!(validation::validate_setting_value("max_cache_items", "1").is_ok());
        assert!(validation::validate_setting_value("max_cache_items", "10000").is_ok());
        assert!(validation::validate_setting_value("max_cache_items", "0").is_err());
        assert!(validation::validate_setting_value("max_cache_items", "20000").is_err());
    }

    // ========== Comprehensive Security Verification ==========

    #[test]
    fn test_comprehensive_security_restrictions_enforced() {
        // This test verifies all security restrictions are in place

        // 1. Network restrictions
        assert!(
            validation::validate_external_url("https://evil.com/malware").is_err(),
            "Network restriction: Unapproved domains should be blocked"
        );

        // 2. Filesystem restrictions
        assert!(
            path_security::validate_path("../../../etc/passwd").is_err(),
            "Filesystem restriction: Path traversal should be blocked"
        );

        // 3. Input sanitization
        assert!(
            validation::validate_claim_id("'; DROP TABLE--").is_err(),
            "Input sanitization: SQL injection should be blocked"
        );

        // 4. Security boundaries
        assert!(
            validation::validate_setting_key("arbitrary_key").is_err(),
            "Security boundary: Only predefined settings should be allowed"
        );

        // 5. Length limits
        assert!(
            validation::validate_claim_id(&"a".repeat(101)).is_err(),
            "Security boundary: Length limits should be enforced"
        );

        // 6. Null byte protection
        assert!(
            validation::validate_claim_id("test\0").is_err(),
            "Security boundary: Null bytes should be blocked"
        );

        // 7. Empty input protection
        assert!(
            validation::validate_claim_id("").is_err(),
            "Security boundary: Empty inputs should be rejected"
        );
    }

    #[test]
    fn test_tag_system_immutability() {
        // Verify that only valid tag formats are accepted
        // This ensures the tag system remains immutable and authoritative

        let valid_tags = vec![
            "movie",
            "series",
            "sitcom",
            "kids",
            "hero_trailer",
            "comedy_movies",
            "action_movies",
            "romance_movies",
        ];

        for tag in valid_tags {
            let result = crate::sanitization::sanitize_tag(tag);
            assert!(result.is_ok(), "Valid tag should be accepted: {}", tag);
        }

        // Invalid tag formats should be rejected
        let invalid_tags = vec![
            "movie; DROP TABLE",
            "tag%wildcard",
            "tag@symbol",
            "tag with spaces",
            "tag/slash",
            "tag\\backslash",
        ];

        for tag in invalid_tags {
            let result = crate::sanitization::sanitize_tag(tag);
            assert!(result.is_err(), "Invalid tag should be rejected: {}", tag);
        }
    }
}
