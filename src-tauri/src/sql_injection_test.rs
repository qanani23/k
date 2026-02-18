/// Property-Based Tests for SQL Injection Prevention
/// 
/// **Feature: kiyya-desktop-streaming, Property 11: SQL Injection Prevention**
/// 
/// For any user input used in SQL queries, the sanitization functions should either
/// accept valid inputs and properly escape/validate them, or reject malicious inputs
/// that could lead to SQL injection attacks.
/// 
/// Validates: Requirements 14.1, 14.2, 14.3, 14.4

use crate::sanitization;
use proptest::prelude::*;

/// Simple test to verify test discovery works
#[test]
fn test_discovery_works() {
    assert_eq!(1 + 1, 2);
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(200))]

    /// Property Test 1: ORDER BY Injection Attempts Are Blocked
    /// Verifies that malicious ORDER BY clauses are rejected
    #[test]
    fn prop_order_by_injection_blocked(
        malicious_suffix in prop::string::string_regex("[;'\"\\-\\(\\)\\[\\]\\{\\}].*").unwrap()
    ) {
        // Try to inject SQL after a valid column name
        let malicious_input = format!("releaseTime{}", malicious_suffix);
        let result = sanitization::sanitize_order_by(&malicious_input);
        
        // Should be rejected (either invalid column or invalid format)
        prop_assert!(result.is_err(), "Malicious ORDER BY should be blocked: {}", malicious_input);
    }

    /// Property Test 2: Valid ORDER BY Clauses Are Accepted
    /// Verifies that valid ORDER BY clauses work correctly
    #[test]
    fn prop_valid_order_by_accepted(
        column in prop::sample::select(vec![
            "releaseTime", "title", "titleLower", "duration", 
            "updatedAt", "lastAccessed", "accessCount", "insertedAt"
        ]),
        direction in prop::sample::select(vec!["ASC", "DESC", "asc", "desc", ""])
    ) {
        let input = if direction.is_empty() {
            column.to_string()
        } else {
            format!("{} {}", column, direction)
        };
        
        let result = sanitization::sanitize_order_by(&input);
        prop_assert!(result.is_ok(), "Valid ORDER BY should be accepted: {}", input);
        
        // Verify the output is properly formatted
        let sanitized = result.unwrap();
        prop_assert!(sanitized.contains(&column));
        prop_assert!(sanitized.contains("ASC") || sanitized.contains("DESC"));
    }

    /// Property Test 3: Tag Injection Attempts Are Blocked
    /// Verifies that tags with special SQL characters are rejected
    #[test]
    fn prop_tag_injection_blocked(
        special_char in prop::sample::select(vec![
            ';', '\'', '"', '%', '(', ')', '[', ']', '{', '}',
            '|', '\\', ':', '<', '>', '?', '!', '~', '`', '@',
            '#', '$', '&', '*', '/', '.', ' '
        ])
    ) {
        let malicious_tag = format!("movie{}tag", special_char);
        let result = sanitization::sanitize_tag(&malicious_tag);
        
        prop_assert!(result.is_err(), "Tag with special character should be blocked: {}", malicious_tag);
    }

    /// Property Test 4: Valid Tags Are Accepted
    /// Verifies that alphanumeric tags with underscores and hyphens work
    #[test]
    fn prop_valid_tags_accepted(
        tag in "[a-zA-Z0-9_-]{1,50}"
    ) {
        let result = sanitization::sanitize_tag(&tag);
        prop_assert!(result.is_ok(), "Valid tag should be accepted: {}", tag);
        prop_assert_eq!(result.unwrap(), tag);
    }

    /// Property Test 5: LIKE Pattern Escaping
    /// Verifies that SQL LIKE special characters are properly escaped
    #[test]
    fn prop_like_pattern_escaping(
        text in "\\PC{0,100}" // Any printable characters
    ) {
        // Skip null bytes (they should be rejected)
        if text.contains('\0') {
            let result = sanitization::sanitize_like_pattern(&text);
            prop_assert!(result.is_err(), "Null bytes should be rejected");
            return Ok(());
        }
        
        let result = sanitization::sanitize_like_pattern(&text);
        prop_assert!(result.is_ok(), "Valid text should be escapable");
        
        let escaped = result.unwrap();
        
        // Verify special characters are escaped
        if text.contains('%') {
            prop_assert!(escaped.contains("\\%"), "Percent should be escaped");
        }
        if text.contains('_') {
            prop_assert!(escaped.contains("\\_"), "Underscore should be escaped");
        }
        if text.contains('[') {
            prop_assert!(escaped.contains("\\["), "Bracket should be escaped");
        }
        if text.contains('\\') {
            prop_assert!(escaped.contains("\\\\"), "Backslash should be escaped");
        }
    }

    /// Property Test 6: Limit Validation
    /// Verifies that only valid limit values are accepted
    #[test]
    fn prop_limit_validation(limit in any::<u32>()) {
        let result = sanitization::sanitize_limit(limit);
        
        if limit == 0 || limit > 1000 {
            prop_assert!(result.is_err(), "Invalid limit should be rejected: {}", limit);
        } else {
            prop_assert!(result.is_ok(), "Valid limit should be accepted: {}", limit);
            prop_assert_eq!(result.unwrap(), limit);
        }
    }

    /// Property Test 7: Offset Validation
    /// Verifies that only valid offset values are accepted
    #[test]
    fn prop_offset_validation(offset in any::<u32>()) {
        let result = sanitization::sanitize_offset(offset);
        
        if offset > 100_000 {
            prop_assert!(result.is_err(), "Invalid offset should be rejected: {}", offset);
        } else {
            prop_assert!(result.is_ok(), "Valid offset should be accepted: {}", offset);
            prop_assert_eq!(result.unwrap(), offset);
        }
    }

    /// Property Test 8: FTS5 Query Escaping
    /// Verifies that FTS5 queries are properly escaped
    #[test]
    fn prop_fts5_query_escaping(
        query in "\\PC{1,100}" // Non-empty printable characters
    ) {
        // Skip null bytes and empty strings
        if query.contains('\0') || query.trim().is_empty() {
            let result = sanitization::sanitize_fts5_query(&query);
            prop_assert!(result.is_err(), "Invalid query should be rejected");
            return Ok(());
        }
        
        let result = sanitization::sanitize_fts5_query(&query);
        prop_assert!(result.is_ok(), "Valid query should be escapable: {}", query);
        
        let escaped = result.unwrap();
        
        // Verify query is wrapped in quotes
        prop_assert!(escaped.starts_with('"'), "Query should start with quote");
        prop_assert!(escaped.ends_with('"'), "Query should end with quote");
        
        // Verify internal quotes are escaped
        if query.contains('"') {
            prop_assert!(escaped.contains("\"\""), "Internal quotes should be escaped");
        }
    }
}
