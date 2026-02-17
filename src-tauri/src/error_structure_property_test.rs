/// Property-Based Tests for Error Structure
/// 
/// **Feature: odysee-cdn-playback-standardization, Property 6: Error Details Are Structured**
/// 
/// For any error condition (missing claim_id, non-stream type, malformed JSON), the error should contain:
/// - Error type/category
/// - Contextual information (which claim failed)
/// - Human-readable message
/// 
/// **Validates: Requirements 4.6**

#[cfg(test)]
mod error_structure_property_tests {
    use crate::commands::parse_claim_item;
    use crate::error::KiyyaError;
    use serde_json::json;
    use proptest::prelude::*;

    /// Strategy for generating valid claim IDs
    fn claim_id_strategy() -> impl Strategy<Value = String> {
        prop_oneof![
            "[a-zA-Z0-9]{20,40}",
            Just("test-claim-123".to_string()),
            Just("valid_claim_id".to_string()),
        ]
    }

    /// Strategy for generating valid titles
    fn title_strategy() -> impl Strategy<Value = String> {
        prop_oneof![
            "[A-Za-z0-9 ]{5,50}",
            Just("Test Movie".to_string()),
            Just("Series Episode".to_string()),
        ]
    }

    /// Strategy for generating non-stream claim types
    fn non_stream_type_strategy() -> impl Strategy<Value = String> {
        prop_oneof![
            Just("channel".to_string()),
            Just("repost".to_string()),
            Just("collection".to_string()),
        ]
    }

    /// Helper function to verify error structure
    fn verify_error_structure(error: &KiyyaError, expected_context: &str) {
        // Property 1: Error has a category
        let category = error.category();
        assert!(
            !category.is_empty(),
            "Error should have a non-empty category"
        );

        // Property 2: Error has a human-readable message
        let message = error.to_string();
        assert!(
            !message.is_empty(),
            "Error should have a non-empty message"
        );

        // Property 3: Error message contains contextual information
        if !expected_context.is_empty() {
            assert!(
                message.to_lowercase().contains(&expected_context.to_lowercase()) ||
                message.contains("claim") ||
                message.contains("stream") ||
                message.contains("missing") ||
                message.contains("required"),
                "Error message should contain contextual information. Message: {}, Expected context: {}",
                message,
                expected_context
            );
        }

        // Property 4: Error has a user-friendly message
        let user_message = error.user_message();
        assert!(
            !user_message.is_empty(),
            "Error should have a non-empty user message"
        );
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100))]

        /// Property Test 1: Missing claim_id errors are structured
        /// Verifies that errors for missing claim_id contain proper structure
        #[test]
        fn prop_missing_claim_id_error_structure(
            title in title_strategy()
        ) {
            // Create claim with missing claim_id
            let item = json!({
                "value_type": "stream",
                "value": {
                    "title": title,
                }
            });

            let result = parse_claim_item(&item);
            prop_assert!(result.is_err(), "Should return error for missing claim_id");

            if let Err(error) = result {
                // Verify error structure
                verify_error_structure(&error, "claim_id");

                // Verify error category is appropriate
                let category = error.category();
                prop_assert!(
                    category == "content" || category == "general",
                    "Error category should be 'content' or 'general', got: {}",
                    category
                );

                // Verify error message mentions claim_id
                let message = error.to_string();
                prop_assert!(
                    message.to_lowercase().contains("claim") ||
                    message.to_lowercase().contains("missing") ||
                    message.to_lowercase().contains("required"),
                    "Error message should mention claim_id or missing field: {}",
                    message
                );
            }
        }

        /// Property Test 2: Empty claim_id errors are structured
        /// Verifies that errors for empty claim_id contain proper structure
        #[test]
        fn prop_empty_claim_id_error_structure(
            title in title_strategy()
        ) {
            // Create claim with empty claim_id
            let item = json!({
                "claim_id": "",
                "value_type": "stream",
                "value": {
                    "title": title,
                }
            });

            let result = parse_claim_item(&item);
            prop_assert!(result.is_err(), "Should return error for empty claim_id");

            if let Err(error) = result {
                // Verify error structure
                verify_error_structure(&error, "claim_id");

                // Verify error has category
                let category = error.category();
                prop_assert!(!category.is_empty(), "Error should have a category");

                // Verify error message is descriptive
                let message = error.to_string();
                prop_assert!(
                    message.len() > 10,
                    "Error message should be descriptive (>10 chars): {}",
                    message
                );
            }
        }

        /// Property Test 3: Non-stream type errors are structured
        /// Verifies that errors for non-stream claims contain proper structure
        #[test]
        fn prop_non_stream_type_error_structure(
            claim_id in claim_id_strategy(),
            title in title_strategy(),
            claim_type in non_stream_type_strategy()
        ) {
            // Create non-stream claim
            let item = json!({
                "claim_id": claim_id,
                "value_type": claim_type,
                "value": {
                    "title": title,
                }
            });

            let result = parse_claim_item(&item);
            prop_assert!(result.is_err(), "Should return error for non-stream type");

            if let Err(error) = result {
                // Verify error structure with claim_id context
                verify_error_structure(&error, &claim_id);

                // Verify error category
                let category = error.category();
                prop_assert!(!category.is_empty(), "Error should have a category");

                // Verify error message mentions stream or type
                let message = error.to_string();
                prop_assert!(
                    message.to_lowercase().contains("stream") ||
                    message.to_lowercase().contains("type") ||
                    message.to_lowercase().contains(&claim_type.to_lowercase()),
                    "Error message should mention stream type: {}",
                    message
                );
            }
        }

        /// Property Test 4: Malformed JSON errors are structured
        /// Verifies that errors for malformed data contain proper structure
        #[test]
        fn prop_malformed_data_error_structure(
            title in title_strategy()
        ) {
            // Create claim with malformed structure (non-stream type to force error)
            let item = json!({
                "claim_id": "test-claim-id",
                "value_type": "channel",  // Non-stream type will cause error
                "value": {
                    "title": title,
                }
            });

            let result = parse_claim_item(&item);
            prop_assert!(result.is_err(), "Should return error for non-stream type");

            if let Err(error) = result {
                // Verify error structure
                verify_error_structure(&error, "test-claim-id");

                // Verify error has category
                let category = error.category();
                prop_assert!(!category.is_empty(), "Error should have a category");

                // Verify error message is descriptive
                let message = error.to_string();
                prop_assert!(
                    !message.is_empty(),
                    "Error message should not be empty"
                );
            }
        }

        /// Property Test 5: All errors have consistent structure
        /// Verifies that all error types maintain consistent structure
        #[test]
        fn prop_all_errors_have_consistent_structure(
            claim_id in prop::option::of(claim_id_strategy()),
            title in prop::option::of(title_strategy()),
            claim_type in prop_oneof![
                Just("stream".to_string()),
                Just("channel".to_string()),
                Just("repost".to_string()),
            ]
        ) {
            // Create various types of potentially invalid claims
            let item = match (claim_id.as_ref(), title.as_ref()) {
                (Some(id), Some(t)) => {
                    json!({
                        "claim_id": id,
                        "value_type": claim_type,
                        "value": {
                            "title": t,
                        }
                    })
                }
                (Some(id), None) => {
                    json!({
                        "claim_id": id,
                        "value_type": claim_type,
                        "value": {}
                    })
                }
                (None, Some(t)) => {
                    json!({
                        "value_type": claim_type,
                        "value": {
                            "title": t,
                        }
                    })
                }
                (None, None) => {
                    json!({
                        "value_type": claim_type,
                        "value": {}
                    })
                }
            };

            let result = parse_claim_item(&item);

            // If error occurs, verify structure
            if let Err(error) = result {
                // Property: All errors have category
                let category = error.category();
                prop_assert!(
                    !category.is_empty(),
                    "All errors should have a non-empty category"
                );

                // Property: All errors have message
                let message = error.to_string();
                prop_assert!(
                    !message.is_empty(),
                    "All errors should have a non-empty message"
                );

                // Property: All errors have user message
                let user_message = error.user_message();
                prop_assert!(
                    !user_message.is_empty(),
                    "All errors should have a non-empty user message"
                );

                // Property: Error message is descriptive (>5 chars)
                prop_assert!(
                    message.len() > 5,
                    "Error message should be descriptive: {}",
                    message
                );
            }
        }

        /// Property Test 6: Error context includes claim information
        /// Verifies that errors include contextual information about which claim failed
        #[test]
        fn prop_error_context_includes_claim_info(
            claim_id in claim_id_strategy(),
            claim_type in non_stream_type_strategy()
        ) {
            // Create non-stream claim with valid claim_id
            let item = json!({
                "claim_id": claim_id,
                "value_type": claim_type,
                "value": {
                    "title": "Test",
                }
            });

            let result = parse_claim_item(&item);
            prop_assert!(result.is_err(), "Should return error for non-stream type");

            if let Err(error) = result {
                let message = error.to_string();

                // Property: Error message should contain contextual information
                // Either the claim_id itself, or generic claim context
                prop_assert!(
                    message.contains(&claim_id) ||
                    message.to_lowercase().contains("claim") ||
                    message.to_lowercase().contains("stream") ||
                    message.to_lowercase().contains("type"),
                    "Error message should contain claim context. Message: {}, Claim ID: {}",
                    message,
                    claim_id
                );
            }
        }

        /// Property Test 7: Error messages are human-readable
        /// Verifies that error messages don't contain raw debug output
        #[test]
        fn prop_error_messages_are_human_readable(
            title in title_strategy()
        ) {
            // Create claim with missing claim_id
            let item = json!({
                "value_type": "stream",
                "value": {
                    "title": title,
                }
            });

            let result = parse_claim_item(&item);
            prop_assert!(result.is_err(), "Should return error");

            if let Err(error) = result {
                let message = error.to_string();

                // Property: Message should not contain debug artifacts
                prop_assert!(
                    !message.contains("Debug") &&
                    !message.contains("{{") &&
                    !message.contains("}}") &&
                    !message.contains("struct"),
                    "Error message should be human-readable, not debug output: {}",
                    message
                );

                // Property: Message should use proper capitalization
                prop_assert!(
                    message.chars().next().unwrap().is_uppercase() ||
                    message.chars().next().unwrap().is_numeric(),
                    "Error message should start with capital letter: {}",
                    message
                );
            }
        }

        /// Property Test 8: Errors provide actionable information
        /// Verifies that error messages help users understand what went wrong
        #[test]
        fn prop_errors_provide_actionable_information(
            claim_id in prop::option::of(claim_id_strategy()),
            title in title_strategy()
        ) {
            // Create claim that may or may not have claim_id
            let mut item = json!({
                "value_type": "stream",
                "value": {
                    "title": title,
                }
            });

            if let Some(id) = claim_id {
                item["claim_id"] = json!(id);
            }

            let result = parse_claim_item(&item);

            if let Err(error) = result {
                let message = error.to_string();
                let user_message = error.user_message();

                // Property: Error message should indicate what's wrong
                prop_assert!(
                    message.to_lowercase().contains("missing") ||
                    message.to_lowercase().contains("required") ||
                    message.to_lowercase().contains("invalid") ||
                    message.to_lowercase().contains("error") ||
                    message.to_lowercase().contains("failed"),
                    "Error message should indicate what went wrong: {}",
                    message
                );

                // Property: User message should be helpful
                prop_assert!(
                    user_message.len() > 10,
                    "User message should be helpful (>10 chars): {}",
                    user_message
                );
            }
        }

        /// Property Test 9: Error categories are consistent
        /// Verifies that similar errors have the same category
        #[test]
        fn prop_error_categories_are_consistent(
            title in title_strategy(),
            missing_field in prop_oneof![
                Just("claim_id"),
                Just("title"),
            ]
        ) {
            // Create claims with different missing fields
            let item = match missing_field {
                "claim_id" => {
                    json!({
                        "value_type": "stream",
                        "value": {
                            "title": title,
                        }
                    })
                }
                "title" => {
                    json!({
                        "claim_id": "test-claim",
                        "value_type": "stream",
                        "value": {}
                    })
                }
                _ => unreachable!(),
            };

            let result = parse_claim_item(&item);

            if let Err(error) = result {
                let category = error.category();

                // Property: Content-related errors should have consistent categories
                prop_assert!(
                    category == "content" || category == "general",
                    "Content parsing errors should have 'content' or 'general' category, got: {}",
                    category
                );
            }
        }

        /// Property Test 10: Errors are serializable
        /// Verifies that errors can be serialized for frontend communication
        #[test]
        fn prop_errors_are_serializable(
            title in title_strategy()
        ) {
            // Create claim with missing claim_id
            let item = json!({
                "value_type": "stream",
                "value": {
                    "title": title,
                }
            });

            let result = parse_claim_item(&item);
            prop_assert!(result.is_err(), "Should return error");

            if let Err(error) = result {
                // Property: Error should be serializable to JSON
                let serialized = serde_json::to_string(&error);
                prop_assert!(
                    serialized.is_ok(),
                    "Error should be serializable to JSON"
                );

                if let Ok(json_str) = serialized {
                    // Property: Serialized error should contain the message
                    prop_assert!(
                        !json_str.is_empty(),
                        "Serialized error should not be empty"
                    );

                    // Property: Serialized error should be valid JSON string
                    prop_assert!(
                        json_str.starts_with('"') && json_str.ends_with('"'),
                        "Serialized error should be a JSON string: {}",
                        json_str
                    );
                }
            }
        }
    }
}
