/// Input validation module for all user inputs
///
/// This module provides comprehensive validation for all user inputs to prevent
/// injection attacks, invalid data, and security violations.
use crate::error::{KiyyaError, Result};
use crate::sanitization;
use crate::security_logging::{log_security_event, SecurityEvent};

/// Validates a claim ID format
///
/// Claim IDs should be alphanumeric with hyphens, typically 40 characters
pub fn validate_claim_id(claim_id: &str) -> Result<String> {
    // Check for null bytes
    if claim_id.contains('\0') {
        log_security_event(SecurityEvent::InputValidationFailure {
            input_type: "claim_id".to_string(),
            reason: "Contains null bytes".to_string(),
            source: "validate_claim_id".to_string(),
        });

        return Err(KiyyaError::InvalidInput {
            message: "Claim ID contains null bytes".to_string(),
        });
    }

    // Check for empty
    if claim_id.trim().is_empty() {
        return Err(KiyyaError::InvalidInput {
            message: "Claim ID cannot be empty".to_string(),
        });
    }

    // Check length (Odysee claim IDs are typically 40 characters)
    if claim_id.len() > 100 {
        return Err(KiyyaError::InvalidInput {
            message: "Claim ID exceeds maximum length of 100 characters".to_string(),
        });
    }

    // Validate format: alphanumeric, hyphens, and @ for URIs
    if !claim_id
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '@' || c == ':' || c == '#' || c == '/')
    {
        log_security_event(SecurityEvent::InputValidationFailure {
            input_type: "claim_id".to_string(),
            reason: format!("Invalid characters in claim ID: '{}'", claim_id),
            source: "validate_claim_id".to_string(),
        });

        return Err(KiyyaError::InvalidInput {
            message: format!("Invalid claim ID format: '{}'. Must contain only alphanumeric characters, hyphens, and URI characters", claim_id),
        });
    }

    Ok(claim_id.to_string())
}

/// Validates a channel ID format
///
/// Channel IDs must start with '@' and be non-empty
pub fn validate_channel_id(channel_id: &str) -> Result<String> {
    // Check for null bytes
    if channel_id.contains('\0') {
        log_security_event(SecurityEvent::InputValidationFailure {
            input_type: "channel_id".to_string(),
            reason: "Contains null bytes".to_string(),
            source: "validate_channel_id".to_string(),
        });

        return Err(KiyyaError::InvalidInput {
            message: "Channel ID contains null bytes".to_string(),
        });
    }

    // Check for empty
    if channel_id.trim().is_empty() {
        log_security_event(SecurityEvent::InputValidationFailure {
            input_type: "channel_id".to_string(),
            reason: "Channel ID is empty".to_string(),
            source: "validate_channel_id".to_string(),
        });

        return Err(KiyyaError::InvalidInput {
            message: "Channel ID cannot be empty".to_string(),
        });
    }

    // Validate that channel_id starts with '@'
    if !channel_id.starts_with('@') {
        log_security_event(SecurityEvent::InputValidationFailure {
            input_type: "channel_id".to_string(),
            reason: format!("Channel ID does not start with '@': '{}'", channel_id),
            source: "validate_channel_id".to_string(),
        });

        return Err(KiyyaError::InvalidInput {
            message: "Channel ID must start with '@'".to_string(),
        });
    }

    Ok(channel_id.to_string())
}

/// Validates a quality string
///
/// Quality should be one of the predefined values
/// In the new CDN-first architecture, we only use "master" quality for HLS adaptive streaming
pub fn validate_quality(quality: &str) -> Result<String> {
    const VALID_QUALITIES: &[&str] = &["master"];

    // Check for null bytes
    if quality.contains('\0') {
        return Err(KiyyaError::InvalidInput {
            message: "Quality contains null bytes".to_string(),
        });
    }

    // Check for empty
    if quality.trim().is_empty() {
        return Err(KiyyaError::InvalidInput {
            message: "Quality cannot be empty".to_string(),
        });
    }

    // Normalize to lowercase
    let normalized = quality.to_lowercase();

    // Check if valid
    if !VALID_QUALITIES.contains(&normalized.as_str()) {
        return Err(KiyyaError::InvalidInput {
            message: format!(
                "Invalid quality: '{}'. Must be one of: {:?}",
                quality, VALID_QUALITIES
            ),
        });
    }

    Ok(normalized)
}

/// Validates a URL for downloads
///
/// URLs must be HTTPS and from approved domains
pub fn validate_download_url(url: &str) -> Result<String> {
    // Check for null bytes
    if url.contains('\0') {
        return Err(KiyyaError::InvalidInput {
            message: "URL contains null bytes".to_string(),
        });
    }

    // Check for empty
    if url.trim().is_empty() {
        return Err(KiyyaError::InvalidInput {
            message: "URL cannot be empty".to_string(),
        });
    }

    // Check length
    if url.len() > 2048 {
        return Err(KiyyaError::InvalidInput {
            message: "URL exceeds maximum length of 2048 characters".to_string(),
        });
    }

    // Must start with https:// (security requirement)
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err(KiyyaError::InvalidInput {
            message: "URL must use HTTP or HTTPS protocol".to_string(),
        });
    }

    // Parse URL to validate format
    url::Url::parse(url).map_err(|e| KiyyaError::InvalidInput {
        message: format!("Invalid URL format: {}", e),
    })?;

    Ok(url.to_string())
}

/// Validates an external URL for opening in browser
///
/// External URLs must be HTTPS and from approved domains
pub fn validate_external_url(url: &str) -> Result<String> {
    // Check for null bytes
    if url.contains('\0') {
        log_security_event(SecurityEvent::InputValidationFailure {
            input_type: "external_url".to_string(),
            reason: "Contains null bytes".to_string(),
            source: "validate_external_url".to_string(),
        });

        return Err(KiyyaError::InvalidInput {
            message: "URL contains null bytes".to_string(),
        });
    }

    // Check for empty
    if url.trim().is_empty() {
        return Err(KiyyaError::InvalidInput {
            message: "URL cannot be empty".to_string(),
        });
    }

    // Check length
    if url.len() > 2048 {
        return Err(KiyyaError::InvalidInput {
            message: "URL exceeds maximum length of 2048 characters".to_string(),
        });
    }

    // Must start with https:// (security requirement for external URLs)
    if !url.starts_with("https://") {
        log_security_event(SecurityEvent::NetworkViolation {
            attempted_url: url.to_string(),
            reason: "External URL must use HTTPS protocol".to_string(),
            source: "validate_external_url".to_string(),
        });

        return Err(KiyyaError::InvalidInput {
            message: "External URL must use HTTPS protocol".to_string(),
        });
    }

    // Parse URL to validate format
    let parsed_url = url::Url::parse(url).map_err(|e| KiyyaError::InvalidInput {
        message: format!("Invalid URL format: {}", e),
    })?;

    // Check for approved domains (GitHub for updates, Odysee for content)
    let host = parsed_url
        .host_str()
        .ok_or_else(|| KiyyaError::InvalidInput {
            message: "URL must have a valid host".to_string(),
        })?;

    const APPROVED_DOMAINS: &[&str] = &[
        "github.com",
        "raw.githubusercontent.com",
        "odysee.com",
        "lbry.tv",
        "api.odysee.com",
        "api.lbry.tv",
        "api.na-backend.odysee.com",
    ];

    let is_approved = APPROVED_DOMAINS
        .iter()
        .any(|domain| host == *domain || host.ends_with(&format!(".{}", domain)));

    if !is_approved {
        log_security_event(SecurityEvent::NetworkViolation {
            attempted_url: url.to_string(),
            reason: format!("Domain '{}' is not in approved list", host),
            source: "validate_external_url".to_string(),
        });

        return Err(KiyyaError::SecurityViolation {
            message: format!("URL domain '{}' is not in approved list", host),
        });
    }

    Ok(url.to_string())
}

/// Validates a title string
///
/// Titles should not be empty and have reasonable length
pub fn validate_title(title: &str) -> Result<String> {
    // Check for null bytes
    if title.contains('\0') {
        return Err(KiyyaError::InvalidInput {
            message: "Title contains null bytes".to_string(),
        });
    }

    // Check for empty
    if title.trim().is_empty() {
        return Err(KiyyaError::InvalidInput {
            message: "Title cannot be empty".to_string(),
        });
    }

    // Check length
    if title.len() > 500 {
        return Err(KiyyaError::InvalidInput {
            message: "Title exceeds maximum length of 500 characters".to_string(),
        });
    }

    Ok(title.to_string())
}

/// Validates a text search query
///
/// Empty search text is allowed (represents "no search filter")
/// Search queries have reasonable length limits
pub fn validate_search_text(text: &str) -> Result<String> {
    // Empty search text is valid - it means "no search filter"
    if text.trim().is_empty() {
        return Ok(String::new());
    }

    // Check for null bytes
    if text.contains('\0') {
        log_security_event(SecurityEvent::InputValidationFailure {
            input_type: "search_text".to_string(),
            reason: "Contains null bytes".to_string(),
            source: "validate_search_text".to_string(),
        });

        return Err(KiyyaError::InvalidInput {
            message: "Search text contains null bytes".to_string(),
        });
    }

    // Check length
    if text.len() > 200 {
        return Err(KiyyaError::InvalidInput {
            message: "Search text exceeds maximum length of 200 characters".to_string(),
        });
    }

    // Sanitize for SQL LIKE patterns
    sanitization::sanitize_like_pattern(text)
}

/// Validates an array of tags
///
/// Each tag must be valid according to tag rules
/// Empty array is allowed (represents "no tag filter")
pub fn validate_tags(tags: &[String]) -> Result<Vec<String>> {
    // Empty array is valid - it means "no tag filter, show all content"
    if tags.is_empty() {
        return Ok(Vec::new());
    }

    if tags.len() > 50 {
        return Err(KiyyaError::InvalidInput {
            message: "Tags array exceeds maximum length of 50".to_string(),
        });
    }

    let mut validated_tags = Vec::new();
    for tag in tags {
        let validated = sanitization::sanitize_tag(tag)?;
        validated_tags.push(validated);
    }

    Ok(validated_tags)
}

/// Validates a position in seconds for video progress
///
/// Position must be non-negative and reasonable
pub fn validate_position_seconds(position: u32) -> Result<u32> {
    // Maximum video length: 24 hours (86400 seconds)
    const MAX_POSITION: u32 = 86400;

    if position > MAX_POSITION {
        return Err(KiyyaError::InvalidInput {
            message: format!(
                "Position {} exceeds maximum of {} seconds (24 hours)",
                position, MAX_POSITION
            ),
        });
    }

    Ok(position)
}

/// Validates a setting key
///
/// Setting keys should be from a predefined list
pub fn validate_setting_key(key: &str) -> Result<String> {
    const VALID_KEYS: &[&str] = &[
        "theme",
        "last_used_quality",
        "encrypt_downloads",
        "auto_upgrade_quality",
        "cache_ttl_minutes",
        "max_cache_items",
    ];

    // Check for null bytes
    if key.contains('\0') {
        return Err(KiyyaError::InvalidInput {
            message: "Setting key contains null bytes".to_string(),
        });
    }

    // Check if valid
    if !VALID_KEYS.contains(&key) {
        return Err(KiyyaError::InvalidInput {
            message: format!(
                "Invalid setting key: '{}'. Must be one of: {:?}",
                key, VALID_KEYS
            ),
        });
    }

    Ok(key.to_string())
}

/// Validates a setting value based on the key
///
/// Different keys have different validation rules
pub fn validate_setting_value(key: &str, value: &str) -> Result<String> {
    // Check for null bytes
    if value.contains('\0') {
        return Err(KiyyaError::InvalidInput {
            message: "Setting value contains null bytes".to_string(),
        });
    }

    match key {
        "theme" => {
            if value != "dark" && value != "light" {
                return Err(KiyyaError::InvalidInput {
                    message: format!(
                        "Invalid theme value: '{}'. Must be 'dark' or 'light'",
                        value
                    ),
                });
            }
        }
        "last_used_quality" => {
            validate_quality(value)?;
        }
        "encrypt_downloads" | "auto_upgrade_quality" => {
            if value != "true" && value != "false" {
                return Err(KiyyaError::InvalidInput {
                    message: format!(
                        "Invalid boolean value: '{}'. Must be 'true' or 'false'",
                        value
                    ),
                });
            }
        }
        "cache_ttl_minutes" => {
            let minutes: u32 = value.parse().map_err(|_| KiyyaError::InvalidInput {
                message: format!(
                    "Invalid cache_ttl_minutes value: '{}'. Must be a positive integer",
                    value
                ),
            })?;
            if minutes == 0 || minutes > 1440 {
                return Err(KiyyaError::InvalidInput {
                    message: format!(
                        "cache_ttl_minutes must be between 1 and 1440 (24 hours), got {}",
                        minutes
                    ),
                });
            }
        }
        "max_cache_items" => {
            let items: u32 = value.parse().map_err(|_| KiyyaError::InvalidInput {
                message: format!(
                    "Invalid max_cache_items value: '{}'. Must be a positive integer",
                    value
                ),
            })?;
            if items == 0 || items > 10000 {
                return Err(KiyyaError::InvalidInput {
                    message: format!("max_cache_items must be between 1 and 10000, got {}", items),
                });
            }
        }
        _ => {
            // Unknown key, should have been caught by validate_setting_key
            return Err(KiyyaError::InvalidInput {
                message: format!("Unknown setting key: '{}'", key),
            });
        }
    }

    Ok(value.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_claim_id() {
        // Valid claim IDs
        assert!(validate_claim_id("abc123-def456-ghi789").is_ok());
        assert!(validate_claim_id("@channel:1/video:2").is_ok());

        // Invalid claim IDs
        assert!(validate_claim_id("").is_err());
        assert!(validate_claim_id("   ").is_err());
        assert!(validate_claim_id("claim\0id").is_err());
        assert!(validate_claim_id("claim; DROP TABLE").is_err());
        assert!(validate_claim_id(&"a".repeat(101)).is_err());
    }

    #[test]
    fn test_validate_channel_id() {
        // Valid channel IDs
        assert!(validate_channel_id("@kiyyamovies:b").is_ok());
        assert!(validate_channel_id("@channelname").is_ok());
        assert!(validate_channel_id("@channel:claimid").is_ok());
        assert!(validate_channel_id("@a").is_ok());

        // Invalid channel IDs - empty
        assert!(validate_channel_id("").is_err());
        assert!(validate_channel_id("   ").is_err());

        // Invalid channel IDs - doesn't start with '@'
        assert!(validate_channel_id("channelname").is_err());
        assert!(validate_channel_id("kiyyamovies:b").is_err());
        assert!(validate_channel_id("channel@name").is_err());

        // Invalid channel IDs - null bytes
        assert!(validate_channel_id("@channel\0id").is_err());
    }

    #[test]
    fn test_validate_quality() {
        // Valid qualities (only "master" in new CDN-first architecture)
        assert_eq!(validate_quality("master").unwrap(), "master");
        assert_eq!(validate_quality("MASTER").unwrap(), "master");

        // Invalid qualities (including old quality-specific values)
        assert!(validate_quality("").is_err());
        assert!(validate_quality("invalid").is_err());
        assert!(validate_quality("720p").is_err());
        assert!(validate_quality("1080p").is_err());
        assert!(validate_quality("master\0").is_err());
    }

    #[test]
    fn test_validate_download_url() {
        // Valid URLs
        assert!(validate_download_url("https://example.com/video.mp4").is_ok());
        assert!(validate_download_url("http://example.com/video.mp4").is_ok());

        // Invalid URLs
        assert!(validate_download_url("").is_err());
        assert!(validate_download_url("ftp://example.com/video.mp4").is_err());
        assert!(validate_download_url("not a url").is_err());
        assert!(
            validate_download_url(&format!("https://example.com/{}", "a".repeat(2048))).is_err()
        );
    }

    #[test]
    fn test_validate_external_url() {
        // Valid URLs
        assert!(validate_external_url("https://github.com/user/repo").is_ok());
        assert!(validate_external_url("https://odysee.com/@channel").is_ok());

        // Invalid URLs
        assert!(validate_external_url("http://github.com/user/repo").is_err()); // Not HTTPS
        assert!(validate_external_url("https://evil.com/malware").is_err()); // Not approved domain
    }

    #[test]
    fn test_validate_title() {
        // Valid titles
        assert!(validate_title("My Movie Title").is_ok());

        // Invalid titles
        assert!(validate_title("").is_err());
        assert!(validate_title("   ").is_err());
        assert!(validate_title("title\0").is_err());
        assert!(validate_title(&"a".repeat(501)).is_err());
    }

    #[test]
    fn test_validate_search_text() {
        // Valid search text
        assert!(validate_search_text("action movies").is_ok());

        // Invalid search text
        assert!(validate_search_text("").is_err());
        assert!(validate_search_text("   ").is_err());
        assert!(validate_search_text(&"a".repeat(201)).is_err());
    }

    #[test]
    fn test_validate_tags() {
        // Valid tags
        assert!(validate_tags(&["movie".to_string(), "action".to_string()]).is_ok());
        
        // Empty array is now valid (represents "no tag filter")
        assert!(validate_tags(&[]).is_ok());
        
        // Invalid tags
        assert!(validate_tags(&["tag; DROP TABLE".to_string()]).is_err());
        assert!(validate_tags(&vec!["tag".to_string(); 51]).is_err());
    }

    #[test]
    fn test_validate_position_seconds() {
        // Valid positions
        assert_eq!(validate_position_seconds(0).unwrap(), 0);
        assert_eq!(validate_position_seconds(3600).unwrap(), 3600);

        // Invalid positions
        assert!(validate_position_seconds(86401).is_err());
    }

    #[test]
    fn test_validate_setting_key() {
        // Valid keys
        assert!(validate_setting_key("theme").is_ok());
        assert!(validate_setting_key("encrypt_downloads").is_ok());

        // Invalid keys
        assert!(validate_setting_key("invalid_key").is_err());
        assert!(validate_setting_key("key\0").is_err());
    }

    #[test]
    fn test_validate_setting_value() {
        // Valid values
        assert!(validate_setting_value("theme", "dark").is_ok());
        assert!(validate_setting_value("theme", "light").is_ok());
        assert!(validate_setting_value("encrypt_downloads", "true").is_ok());
        assert!(validate_setting_value("cache_ttl_minutes", "30").is_ok());

        // Invalid values
        assert!(validate_setting_value("theme", "invalid").is_err());
        assert!(validate_setting_value("encrypt_downloads", "yes").is_err());
        assert!(validate_setting_value("cache_ttl_minutes", "0").is_err());
        assert!(validate_setting_value("cache_ttl_minutes", "2000").is_err());
    }
}
