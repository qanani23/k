/// Integration tests for input validation in Tauri commands
///
/// This test module verifies that all user inputs are properly validated
/// before being processed by the application.

#[cfg(test)]
mod tests {
    use crate::validation;
    use crate::sanitization;

    #[test]
    fn test_claim_id_validation_prevents_injection() {
        // Valid claim IDs should pass
        assert!(validation::validate_claim_id("abc123-def456").is_ok());
        assert!(validation::validate_claim_id("@channel:1/video:2").is_ok());
        
        // SQL injection attempts should fail
        assert!(validation::validate_claim_id("'; DROP TABLE users--").is_err());
        assert!(validation::validate_claim_id("1' OR '1'='1").is_err());
        
        // Null bytes should fail
        assert!(validation::validate_claim_id("claim\0id").is_err());
        
        // Empty strings should fail
        assert!(validation::validate_claim_id("").is_err());
        assert!(validation::validate_claim_id("   ").is_err());
    }

    #[test]
    fn test_quality_validation_prevents_invalid_values() {
        // Valid qualities should pass
        assert!(validation::validate_quality("720p").is_ok());
        assert!(validation::validate_quality("1080p").is_ok());
        assert!(validation::validate_quality("480p").is_ok());
        
        // Case insensitive
        assert!(validation::validate_quality("720P").is_ok());
        assert!(validation::validate_quality("1080P").is_ok());
        
        // Invalid qualities should fail
        assert!(validation::validate_quality("invalid").is_err());
        assert!(validation::validate_quality("9999p").is_err());
        assert!(validation::validate_quality("").is_err());
        
        // Injection attempts should fail
        assert!(validation::validate_quality("720p; DROP TABLE").is_err());
    }

    #[test]
    fn test_url_validation_prevents_malicious_urls() {
        // Valid download URLs should pass
        assert!(validation::validate_download_url("https://example.com/video.mp4").is_ok());
        assert!(validation::validate_download_url("http://example.com/video.mp4").is_ok());
        
        // Invalid protocols should fail
        assert!(validation::validate_download_url("ftp://example.com/video.mp4").is_err());
        assert!(validation::validate_download_url("file:///etc/passwd").is_err());
        assert!(validation::validate_download_url("javascript:alert(1)").is_err());
        
        // Malformed URLs should fail
        assert!(validation::validate_download_url("not a url").is_err());
        assert!(validation::validate_download_url("").is_err());
        
        // Null bytes should fail
        assert!(validation::validate_download_url("https://example.com\0/video.mp4").is_err());
    }

    #[test]
    fn test_external_url_validation_enforces_https() {
        // Valid HTTPS URLs to approved domains should pass
        assert!(validation::validate_external_url("https://github.com/user/repo").is_ok());
        assert!(validation::validate_external_url("https://odysee.com/@channel").is_ok());
        assert!(validation::validate_external_url("https://raw.githubusercontent.com/user/repo/main/file.json").is_ok());
        
        // HTTP should fail (must be HTTPS)
        assert!(validation::validate_external_url("http://github.com/user/repo").is_err());
        
        // Unapproved domains should fail
        assert!(validation::validate_external_url("https://evil.com/malware").is_err());
        assert!(validation::validate_external_url("https://attacker.com/phishing").is_err());
    }

    #[test]
    fn test_title_validation_prevents_injection() {
        // Valid titles should pass
        assert!(validation::validate_title("My Movie Title").is_ok());
        assert!(validation::validate_title("Series S01E01 - Episode Name").is_ok());
        
        // Empty titles should fail
        assert!(validation::validate_title("").is_err());
        assert!(validation::validate_title("   ").is_err());
        
        // Null bytes should fail
        assert!(validation::validate_title("Title\0").is_err());
        
        // Excessively long titles should fail
        assert!(validation::validate_title(&"a".repeat(501)).is_err());
    }

    #[test]
    fn test_search_text_validation_prevents_injection() {
        // Valid search text should pass
        assert!(validation::validate_search_text("action movies").is_ok());
        assert!(validation::validate_search_text("season 1").is_ok());
        
        // Empty search should fail
        assert!(validation::validate_search_text("").is_err());
        assert!(validation::validate_search_text("   ").is_err());
        
        // Null bytes should fail
        assert!(validation::validate_search_text("search\0term").is_err());
        
        // Excessively long search should fail
        assert!(validation::validate_search_text(&"a".repeat(201)).is_err());
        
        // SQL special characters should be escaped
        let result = validation::validate_search_text("test%pattern");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "test\\%pattern");
    }

    #[test]
    fn test_tags_validation_prevents_injection() {
        // Valid tags should pass
        assert!(validation::validate_tags(&vec!["movie".to_string(), "action".to_string()]).is_ok());
        assert!(validation::validate_tags(&vec!["series".to_string()]).is_ok());
        
        // Empty array should fail
        assert!(validation::validate_tags(&vec![]).is_err());
        
        // Too many tags should fail
        assert!(validation::validate_tags(&vec!["tag".to_string(); 51]).is_err());
        
        // Invalid tag formats should fail
        assert!(validation::validate_tags(&vec!["tag; DROP TABLE".to_string()]).is_err());
        assert!(validation::validate_tags(&vec!["tag%".to_string()]).is_err());
        assert!(validation::validate_tags(&vec!["tag\0".to_string()]).is_err());
    }

    #[test]
    fn test_position_seconds_validation_prevents_overflow() {
        // Valid positions should pass
        assert!(validation::validate_position_seconds(0).is_ok());
        assert!(validation::validate_position_seconds(3600).is_ok());
        assert!(validation::validate_position_seconds(86400).is_ok()); // 24 hours
        
        // Positions beyond 24 hours should fail
        assert!(validation::validate_position_seconds(86401).is_err());
        assert!(validation::validate_position_seconds(u32::MAX).is_err());
    }

    #[test]
    fn test_setting_key_validation_prevents_arbitrary_keys() {
        // Valid setting keys should pass
        assert!(validation::validate_setting_key("theme").is_ok());
        assert!(validation::validate_setting_key("encrypt_downloads").is_ok());
        assert!(validation::validate_setting_key("cache_ttl_minutes").is_ok());
        
        // Invalid keys should fail
        assert!(validation::validate_setting_key("arbitrary_key").is_err());
        assert!(validation::validate_setting_key("malicious_key").is_err());
        assert!(validation::validate_setting_key("").is_err());
        
        // Null bytes should fail
        assert!(validation::validate_setting_key("key\0").is_err());
    }

    #[test]
    fn test_setting_value_validation_enforces_constraints() {
        // Theme values
        assert!(validation::validate_setting_value("theme", "dark").is_ok());
        assert!(validation::validate_setting_value("theme", "light").is_ok());
        assert!(validation::validate_setting_value("theme", "invalid").is_err());
        
        // Boolean values
        assert!(validation::validate_setting_value("encrypt_downloads", "true").is_ok());
        assert!(validation::validate_setting_value("encrypt_downloads", "false").is_ok());
        assert!(validation::validate_setting_value("encrypt_downloads", "yes").is_err());
        assert!(validation::validate_setting_value("encrypt_downloads", "1").is_err());
        
        // Numeric values with ranges
        assert!(validation::validate_setting_value("cache_ttl_minutes", "30").is_ok());
        assert!(validation::validate_setting_value("cache_ttl_minutes", "1440").is_ok());
        assert!(validation::validate_setting_value("cache_ttl_minutes", "0").is_err());
        assert!(validation::validate_setting_value("cache_ttl_minutes", "2000").is_err());
        assert!(validation::validate_setting_value("cache_ttl_minutes", "invalid").is_err());
        
        // Quality values
        assert!(validation::validate_setting_value("last_used_quality", "720p").is_ok());
        assert!(validation::validate_setting_value("last_used_quality", "invalid").is_err());
    }

    #[test]
    fn test_limit_sanitization_prevents_excessive_queries() {
        // Valid limits should pass
        assert!(sanitization::sanitize_limit(1).is_ok());
        assert!(sanitization::sanitize_limit(100).is_ok());
        assert!(sanitization::sanitize_limit(1000).is_ok());
        
        // Zero should fail
        assert!(sanitization::sanitize_limit(0).is_err());
        
        // Excessive limits should fail
        assert!(sanitization::sanitize_limit(1001).is_err());
        assert!(sanitization::sanitize_limit(10000).is_err());
    }

    #[test]
    fn test_offset_sanitization_prevents_excessive_pagination() {
        // Valid offsets should pass
        assert!(sanitization::sanitize_offset(0).is_ok());
        assert!(sanitization::sanitize_offset(100).is_ok());
        assert!(sanitization::sanitize_offset(100_000).is_ok());
        
        // Excessive offsets should fail
        assert!(sanitization::sanitize_offset(100_001).is_err());
        assert!(sanitization::sanitize_offset(1_000_000).is_err());
    }

    #[test]
    fn test_order_by_sanitization_prevents_sql_injection() {
        // Valid ORDER BY clauses should pass
        assert!(sanitization::sanitize_order_by("releaseTime").is_ok());
        assert!(sanitization::sanitize_order_by("releaseTime DESC").is_ok());
        assert!(sanitization::sanitize_order_by("title ASC, releaseTime DESC").is_ok());
        
        // SQL injection attempts should fail
        assert!(sanitization::sanitize_order_by("releaseTime; DROP TABLE users--").is_err());
        assert!(sanitization::sanitize_order_by("releaseTime' OR '1'='1").is_err());
        
        // Invalid column names should fail
        assert!(sanitization::sanitize_order_by("malicious_column").is_err());
        
        // Invalid directions should fail
        assert!(sanitization::sanitize_order_by("releaseTime INVALID").is_err());
        
        // Empty string should fail
        assert!(sanitization::sanitize_order_by("").is_err());
    }

    #[test]
    fn test_like_pattern_sanitization_escapes_special_chars() {
        // Normal text should pass through
        assert_eq!(sanitization::sanitize_like_pattern("test").unwrap(), "test");
        
        // Special characters should be escaped
        assert_eq!(sanitization::sanitize_like_pattern("test%pattern").unwrap(), "test\\%pattern");
        assert_eq!(sanitization::sanitize_like_pattern("test_pattern").unwrap(), "test\\_pattern");
        assert_eq!(sanitization::sanitize_like_pattern("test[pattern").unwrap(), "test\\[pattern");
        
        // Null bytes should fail
        assert!(sanitization::sanitize_like_pattern("test\0pattern").is_err());
    }

    #[test]
    fn test_tag_sanitization_enforces_format() {
        // Valid tags should pass
        assert!(sanitization::sanitize_tag("movie").is_ok());
        assert!(sanitization::sanitize_tag("action_movies").is_ok());
        assert!(sanitization::sanitize_tag("comedy-series").is_ok());
        
        // Empty tags should fail
        assert!(sanitization::sanitize_tag("").is_err());
        assert!(sanitization::sanitize_tag("   ").is_err());
        
        // Invalid characters should fail
        assert!(sanitization::sanitize_tag("movie; DROP TABLE").is_err());
        assert!(sanitization::sanitize_tag("movie%").is_err());
        assert!(sanitization::sanitize_tag("movie@").is_err());
        
        // Null bytes should fail
        assert!(sanitization::sanitize_tag("test\0tag").is_err());
    }

    #[test]
    fn test_channel_id_validation_rejects_empty_string() {
        // Test that empty string returns validation error
        let result = validation::validate_channel_id("");
        assert!(result.is_err(), "Empty channel ID should return an error");
        
        // Verify error message
        let err = result.unwrap_err();
        let err_msg = format!("{}", err);
        assert!(
            err_msg.contains("Channel ID cannot be empty"),
            "Error message should indicate channel ID cannot be empty, got: {}",
            err_msg
        );
    }

    #[test]
    fn test_channel_id_validation_rejects_whitespace_only() {
        // Test that whitespace-only string returns validation error
        let result = validation::validate_channel_id("   ");
        assert!(result.is_err(), "Whitespace-only channel ID should return an error");
        
        // Verify error message
        let err = result.unwrap_err();
        let err_msg = format!("{}", err);
        assert!(
            err_msg.contains("Channel ID cannot be empty"),
            "Error message should indicate channel ID cannot be empty, got: {}",
            err_msg
        );
    }

    #[test]
    fn test_channel_id_validation_rejects_without_at_symbol() {
        // Test that strings not starting with '@' return validation error
        let test_cases = vec![
            "channelname",
            "channelname:claimid",
            "kiyyamovies:b",
            "invalid-channel",
            "123channel",
        ];
        
        for channel_id in test_cases {
            let result = validation::validate_channel_id(channel_id);
            assert!(
                result.is_err(),
                "Channel ID '{}' without '@' should return an error",
                channel_id
            );
            
            // Verify error message
            let err = result.unwrap_err();
            let err_msg = format!("{}", err);
            assert!(
                err_msg.contains("Channel ID must start with '@'"),
                "Error message should indicate channel ID must start with '@', got: {}",
                err_msg
            );
        }
    }

    #[test]
    fn test_channel_id_validation_accepts_valid_formats() {
        // Test '@channelname:claimid' format
        let result = validation::validate_channel_id("@kiyyamovies:b");
        assert!(result.is_ok(), "Channel ID '@kiyyamovies:b' should be valid");
        assert_eq!(result.unwrap(), "@kiyyamovies:b");
        
        let result = validation::validate_channel_id("@channelname:abc123def456");
        assert!(result.is_ok(), "Channel ID '@channelname:abc123def456' should be valid");
        assert_eq!(result.unwrap(), "@channelname:abc123def456");
        
        // Test '@channelname' format (without claim ID)
        let result = validation::validate_channel_id("@kiyyamovies");
        assert!(result.is_ok(), "Channel ID '@kiyyamovies' should be valid");
        assert_eq!(result.unwrap(), "@kiyyamovies");
        
        let result = validation::validate_channel_id("@channelname");
        assert!(result.is_ok(), "Channel ID '@channelname' should be valid");
        assert_eq!(result.unwrap(), "@channelname");
        
        // Test minimal valid format
        let result = validation::validate_channel_id("@a");
        assert!(result.is_ok(), "Channel ID '@a' should be valid");
        assert_eq!(result.unwrap(), "@a");
    }

    #[test]
    fn test_comprehensive_input_validation_coverage() {
        // This test ensures all critical input types are validated
        
        // String inputs
        assert!(validation::validate_claim_id("test-claim").is_ok());
        assert!(validation::validate_quality("720p").is_ok());
        assert!(validation::validate_title("Test Title").is_ok());
        assert!(validation::validate_search_text("test search").is_ok());
        
        // URL inputs
        assert!(validation::validate_download_url("https://example.com/video.mp4").is_ok());
        assert!(validation::validate_external_url("https://github.com/user/repo").is_ok());
        
        // Array inputs
        assert!(validation::validate_tags(&vec!["movie".to_string()]).is_ok());
        
        // Numeric inputs
        assert!(validation::validate_position_seconds(100).is_ok());
        assert!(sanitization::sanitize_limit(50).is_ok());
        assert!(sanitization::sanitize_offset(0).is_ok());
        
        // Settings inputs
        assert!(validation::validate_setting_key("theme").is_ok());
        assert!(validation::validate_setting_value("theme", "dark").is_ok());
        
        // SQL inputs
        assert!(sanitization::sanitize_order_by("releaseTime DESC").is_ok());
        assert!(sanitization::sanitize_like_pattern("test").is_ok());
        assert!(sanitization::sanitize_tag("movie").is_ok());
    }
}
