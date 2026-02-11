/// Input sanitization module for SQL queries
/// 
/// This module provides functions to sanitize user inputs before they are used in SQL queries,
/// preventing SQL injection attacks while preserving intended functionality.

use crate::error::{KiyyaError, Result};
use crate::security_logging::{log_security_event, SecurityEvent};

/// Validates and sanitizes an ORDER BY clause
/// 
/// Only allows specific column names and sort directions to prevent SQL injection.
/// Returns a sanitized ORDER BY clause or an error if the input is invalid.
pub fn sanitize_order_by(order_by: &str) -> Result<String> {
    // Allowed column names for ordering
    const ALLOWED_COLUMNS: &[&str] = &[
        "releaseTime",
        "title",
        "titleLower",
        "duration",
        "updatedAt",
        "lastAccessed",
        "accessCount",
        "insertedAt",
        "addedAt",
        "positionSeconds",
    ];
    
    // Allowed sort directions
    const ALLOWED_DIRECTIONS: &[&str] = &["ASC", "DESC"];
    
    // Trim whitespace
    let order_by = order_by.trim();
    
    // Empty string is not allowed
    if order_by.is_empty() {
        return Err(KiyyaError::InvalidInput {
            message: "ORDER BY clause cannot be empty".to_string(),
        });
    }
    
    // Split by comma to handle multiple columns (e.g., "title ASC, releaseTime DESC")
    let parts: Vec<&str> = order_by.split(',').map(|s| s.trim()).collect();
    
    let mut sanitized_parts = Vec::new();
    
    for part in parts {
        // Split each part into column and direction
        let tokens: Vec<&str> = part.split_whitespace().collect();
        
        if tokens.is_empty() {
            return Err(KiyyaError::InvalidInput {
                message: "Invalid ORDER BY clause: empty part".to_string(),
            });
        }
        
        // First token should be the column name
        let column = tokens[0];
        
        // Check if column is allowed
        if !ALLOWED_COLUMNS.contains(&column) {
            log_security_event(SecurityEvent::SqlInjectionAttempt {
                input: order_by.to_string(),
                context: "ORDER BY clause".to_string(),
                source: "sanitize_order_by".to_string(),
            });
            
            return Err(KiyyaError::InvalidInput {
                message: format!("Invalid ORDER BY column: '{}'. Allowed columns: {:?}", column, ALLOWED_COLUMNS),
            });
        }
        
        // Second token (if present) should be the direction
        let direction = if tokens.len() > 1 {
            let dir = tokens[1].to_uppercase();
            if !ALLOWED_DIRECTIONS.contains(&dir.as_str()) {
                return Err(KiyyaError::InvalidInput {
                    message: format!("Invalid ORDER BY direction: '{}'. Allowed: ASC, DESC", tokens[1]),
                });
            }
            dir
        } else {
            // Default to ASC if no direction specified
            "ASC".to_string()
        };
        
        // Check for extra tokens (potential injection attempt)
        if tokens.len() > 2 {
            return Err(KiyyaError::InvalidInput {
                message: format!("Invalid ORDER BY clause: too many tokens in '{}'", part),
            });
        }
        
        sanitized_parts.push(format!("{} {}", column, direction));
    }
    
    Ok(sanitized_parts.join(", "))
}

/// Validates that a string contains only safe characters for SQL LIKE patterns
/// 
/// Escapes special SQL characters and validates the input to prevent injection.
pub fn sanitize_like_pattern(input: &str) -> Result<String> {
    // Check for null bytes (potential injection)
    if input.contains('\0') {
        return Err(KiyyaError::InvalidInput {
            message: "Input contains null bytes".to_string(),
        });
    }
    
    // Escape SQL LIKE special characters
    let escaped = input
        .replace('\\', "\\\\")  // Escape backslash first
        .replace('%', "\\%")    // Escape percent
        .replace('_', "\\_")    // Escape underscore
        .replace('[', "\\[");   // Escape bracket
    
    Ok(escaped)
}

/// Validates that a tag name is safe to use in SQL queries
/// 
/// Tags should only contain alphanumeric characters, underscores, and hyphens.
pub fn sanitize_tag(tag: &str) -> Result<String> {
    // Check for null bytes
    if tag.contains('\0') {
        log_security_event(SecurityEvent::InputValidationFailure {
            input_type: "tag".to_string(),
            reason: "Contains null bytes".to_string(),
            source: "sanitize_tag".to_string(),
        });
        
        return Err(KiyyaError::InvalidInput {
            message: "Tag contains null bytes".to_string(),
        });
    }
    
    // Check for empty tag
    if tag.trim().is_empty() {
        return Err(KiyyaError::InvalidInput {
            message: "Tag cannot be empty".to_string(),
        });
    }
    
    // Validate tag format: alphanumeric, underscore, hyphen only
    if !tag.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-') {
        log_security_event(SecurityEvent::SqlInjectionAttempt {
            input: tag.to_string(),
            context: "tag validation".to_string(),
            source: "sanitize_tag".to_string(),
        });
        
        return Err(KiyyaError::InvalidInput {
            message: format!("Invalid tag format: '{}'. Tags must contain only alphanumeric characters, underscores, and hyphens", tag),
        });
    }
    
    Ok(tag.to_string())
}

/// Validates a limit value for pagination
pub fn sanitize_limit(limit: u32) -> Result<u32> {
    const MAX_LIMIT: u32 = 1000;
    
    if limit == 0 {
        return Err(KiyyaError::InvalidInput {
            message: "LIMIT must be greater than 0".to_string(),
        });
    }
    
    if limit > MAX_LIMIT {
        return Err(KiyyaError::InvalidInput {
            message: format!("LIMIT exceeds maximum allowed value of {}", MAX_LIMIT),
        });
    }
    
    Ok(limit)
}

/// Validates an offset value for pagination
pub fn sanitize_offset(offset: u32) -> Result<u32> {
    const MAX_OFFSET: u32 = 100_000;
    
    if offset > MAX_OFFSET {
        return Err(KiyyaError::InvalidInput {
            message: format!("OFFSET exceeds maximum allowed value of {}", MAX_OFFSET),
        });
    }
    
    Ok(offset)
}

/// Sanitizes FTS5 query to prevent injection attacks
/// 
/// FTS5 has its own query syntax with special characters that need to be handled carefully.
/// This function escapes special FTS5 characters and validates the query.
pub fn sanitize_fts5_query(query: &str) -> Result<String> {
    // Check for null bytes
    if query.contains('\0') {
        log_security_event(SecurityEvent::InputValidationFailure {
            input_type: "fts5_query".to_string(),
            reason: "Contains null bytes".to_string(),
            source: "sanitize_fts5_query".to_string(),
        });
        
        return Err(KiyyaError::InvalidInput {
            message: "FTS5 query contains null bytes".to_string(),
        });
    }
    
    // Check for empty query
    if query.trim().is_empty() {
        return Err(KiyyaError::InvalidInput {
            message: "FTS5 query cannot be empty".to_string(),
        });
    }
    
    // FTS5 special characters that need escaping: " (quotes)
    // We'll wrap the entire query in quotes and escape internal quotes
    let escaped = query.replace('"', "\"\"");
    
    // Wrap in quotes to treat as a phrase search (safer than allowing complex FTS5 syntax)
    Ok(format!("\"{}\"", escaped))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_order_by_valid() {
        // Single column, no direction
        assert_eq!(sanitize_order_by("releaseTime").unwrap(), "releaseTime ASC");
        
        // Single column with ASC
        assert_eq!(sanitize_order_by("releaseTime ASC").unwrap(), "releaseTime ASC");
        
        // Single column with DESC
        assert_eq!(sanitize_order_by("releaseTime DESC").unwrap(), "releaseTime DESC");
        
        // Multiple columns
        assert_eq!(
            sanitize_order_by("title ASC, releaseTime DESC").unwrap(),
            "title ASC, releaseTime DESC"
        );
        
        // Case insensitive direction
        assert_eq!(sanitize_order_by("title desc").unwrap(), "title DESC");
    }

    #[test]
    fn test_sanitize_order_by_invalid() {
        // Invalid column name
        assert!(sanitize_order_by("malicious_column").is_err());
        
        // SQL injection attempt
        assert!(sanitize_order_by("releaseTime; DROP TABLE users--").is_err());
        
        // Invalid direction
        assert!(sanitize_order_by("releaseTime INVALID").is_err());
        
        // Empty string
        assert!(sanitize_order_by("").is_err());
        
        // Too many tokens
        assert!(sanitize_order_by("releaseTime DESC EXTRA").is_err());
    }

    #[test]
    fn test_sanitize_like_pattern() {
        // Normal text
        assert_eq!(sanitize_like_pattern("test").unwrap(), "test");
        
        // Text with special characters
        assert_eq!(sanitize_like_pattern("test%pattern").unwrap(), "test\\%pattern");
        assert_eq!(sanitize_like_pattern("test_pattern").unwrap(), "test\\_pattern");
        assert_eq!(sanitize_like_pattern("test[pattern").unwrap(), "test\\[pattern");
        
        // Null byte should fail
        assert!(sanitize_like_pattern("test\0pattern").is_err());
    }

    #[test]
    fn test_sanitize_tag() {
        // Valid tags
        assert_eq!(sanitize_tag("movie").unwrap(), "movie");
        assert_eq!(sanitize_tag("action_movies").unwrap(), "action_movies");
        assert_eq!(sanitize_tag("comedy-series").unwrap(), "comedy-series");
        
        // Invalid tags
        assert!(sanitize_tag("").is_err());
        assert!(sanitize_tag("   ").is_err());
        assert!(sanitize_tag("movie; DROP TABLE").is_err());
        assert!(sanitize_tag("movie%").is_err());
        assert!(sanitize_tag("test\0tag").is_err());
    }

    #[test]
    fn test_sanitize_limit() {
        // Valid limits
        assert_eq!(sanitize_limit(1).unwrap(), 1);
        assert_eq!(sanitize_limit(100).unwrap(), 100);
        assert_eq!(sanitize_limit(1000).unwrap(), 1000);
        
        // Invalid limits
        assert!(sanitize_limit(0).is_err());
        assert!(sanitize_limit(1001).is_err());
        assert!(sanitize_limit(10000).is_err());
    }

    #[test]
    fn test_sanitize_offset() {
        // Valid offsets
        assert_eq!(sanitize_offset(0).unwrap(), 0);
        assert_eq!(sanitize_offset(100).unwrap(), 100);
        assert_eq!(sanitize_offset(100_000).unwrap(), 100_000);
        
        // Invalid offsets
        assert!(sanitize_offset(100_001).is_err());
        assert!(sanitize_offset(1_000_000).is_err());
    }

    #[test]
    fn test_sanitize_fts5_query() {
        // Normal text
        assert_eq!(sanitize_fts5_query("test").unwrap(), "\"test\"");
        
        // Text with quotes (should be escaped)
        assert_eq!(sanitize_fts5_query("test \"quoted\" text").unwrap(), "\"test \"\"quoted\"\" text\"");
        
        // Empty query should fail
        assert!(sanitize_fts5_query("").is_err());
        assert!(sanitize_fts5_query("   ").is_err());
        
        // Null byte should fail
        assert!(sanitize_fts5_query("test\0query").is_err());
        
        // Complex query
        assert_eq!(sanitize_fts5_query("season 1 episode 5").unwrap(), "\"season 1 episode 5\"");
    }
}
