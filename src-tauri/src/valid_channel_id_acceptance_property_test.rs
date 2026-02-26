/// Property-Based Tests for Valid Channel ID Acceptance
///
/// **Feature: pass-channel-id-from-frontend, Property 4: Valid channel ID acceptance**
///
/// For any channel_id string that starts with '@' and is non-empty, when passed to backend
/// commands, the backend should proceed with the API request using the validated channel_id.
///
/// **Validates: Requirements 4.4**

#[cfg(test)]
mod valid_channel_id_acceptance_tests {
    use crate::validation;
    use proptest::prelude::*;

    /// Strategy for generating valid channel IDs (must start with '@' and be non-empty)
    fn valid_channel_id_strategy() -> impl Strategy<Value = String> {
        prop_oneof![
            // Standard channel with claim ID
            "@[a-zA-Z0-9_-]{3,20}:[a-z0-9]{1,10}".prop_map(|s| s),
            // Channel without claim ID
            "@[a-zA-Z0-9_-]{3,20}".prop_map(|s| s),
            // Short channel names
            "@[a-z]{1,5}".prop_map(|s| s),
            // Long channel names
            "@[a-zA-Z0-9_-]{20,50}".prop_map(|s| s),
            // Channel with numbers
            "@[0-9]{3,10}".prop_map(|s| s),
            // Channel with mixed case
            "@[A-Z]{3,10}[a-z]{3,10}".prop_map(|s| s),
            // Channel with underscores and hyphens
            "@[a-z_-]{5,15}".prop_map(|s| s),
            // Just '@' (minimal valid case)
            Just("@".to_string()),
            // Real-world examples
            Just("@kiyyamovies:b".to_string()),
            Just("@testchannel".to_string()),
            Just("@channel123".to_string()),
            Just("@MyChannel".to_string()),
            Just("@my-channel_name".to_string()),
        ]
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100))]

        /// Property Test 1: All valid channel IDs are accepted by validation
        /// Verifies that validation accepts all strings starting with '@' and non-empty
        #[test]
        fn prop_valid_channel_ids_are_accepted(
            channel_id in valid_channel_id_strategy()
        ) {
            let result = validation::validate_channel_id(&channel_id);

            // Property: All valid channel IDs should be accepted (validation passes)
            prop_assert!(
                result.is_ok(),
                "Valid channel_id '{}' should be accepted by validation, got error: {:?}",
                channel_id,
                result.err()
            );
        }

        /// Property Test 2: Validated channel ID matches input exactly
        /// Verifies that validation preserves the exact input value
        #[test]
        fn prop_validated_channel_id_matches_input(
            channel_id in valid_channel_id_strategy()
        ) {
            let result = validation::validate_channel_id(&channel_id);

            // Property: Validation should succeed
            prop_assert!(
                result.is_ok(),
                "Valid channel_id should pass validation"
            );

            // Property: Validated value should match input exactly
            if let Ok(validated) = result {
                prop_assert_eq!(
                    validated,
                    channel_id,
                    "Validated channel_id should match input exactly"
                );
            }
        }

        /// Property Test 3: Valid channel IDs with various lengths are accepted
        /// Verifies that validation accepts valid channel IDs regardless of length
        #[test]
        fn prop_valid_channel_ids_length_independent(
            length in 1usize..100usize
        ) {
            // Generate valid channel ID of given length (@ + alphanumeric characters)
            let channel_id = format!("@{}", "a".repeat(length));
            let result = validation::validate_channel_id(&channel_id);

            // Property: Valid channel IDs should be accepted regardless of length
            prop_assert!(
                result.is_ok(),
                "Valid channel_id of length {} should be accepted",
                length + 1
            );

            // Property: Validated value should match input
            if let Ok(validated) = result {
                prop_assert_eq!(
                    validated,
                    channel_id,
                    "Validated channel_id should match input"
                );
            }
        }

        /// Property Test 4: Valid channel IDs with special characters are accepted
        /// Verifies that validation accepts channel IDs with colons, hyphens, underscores
        #[test]
        fn prop_valid_channel_ids_with_special_chars_accepted(
            name in "[a-zA-Z0-9_-]{5,15}",
            claim_id in "[a-z0-9]{1,10}"
        ) {
            // Test with colon (claim ID format)
            let channel_id_with_colon = format!("@{}:{}", name, claim_id);
            let result_with_colon = validation::validate_channel_id(&channel_id_with_colon);

            // Property: Channel IDs with colons should be accepted
            prop_assert!(
                result_with_colon.is_ok(),
                "Valid channel_id with colon '{}' should be accepted",
                channel_id_with_colon
            );

            // Test without colon
            let channel_id_without_colon = format!("@{}", name);
            let result_without_colon = validation::validate_channel_id(&channel_id_without_colon);

            // Property: Channel IDs without colons should be accepted
            prop_assert!(
                result_without_colon.is_ok(),
                "Valid channel_id without colon '{}' should be accepted",
                channel_id_without_colon
            );
        }

        /// Property Test 5: Valid channel IDs are accepted consistently
        /// Verifies that the same valid channel_id is accepted every time
        #[test]
        fn prop_valid_channel_id_acceptance_consistent(
            channel_id in valid_channel_id_strategy(),
            iterations in 2usize..10usize
        ) {
            let results: Vec<_> = (0..iterations)
                .map(|_| validation::validate_channel_id(&channel_id))
                .collect();

            // Property: All results should be Ok (accepted)
            for (i, result) in results.iter().enumerate() {
                prop_assert!(
                    result.is_ok(),
                    "Validation attempt {} should accept valid channel_id '{}'",
                    i,
                    channel_id
                );
            }

            // Property: All validated values should be identical
            let first_validated = results[0].as_ref().ok();
            for result in &results[1..] {
                prop_assert_eq!(
                    result.as_ref().ok(),
                    first_validated,
                    "All validation results should be identical"
                );
            }
        }

        /// Property Test 6: Valid channel IDs with uppercase letters are accepted
        /// Verifies that validation accepts channel IDs with mixed case
        #[test]
        fn prop_valid_channel_ids_case_variations_accepted(
            name in "[a-zA-Z]{5,15}"
        ) {
            // Test lowercase
            let lowercase_id = format!("@{}", name.to_lowercase());
            let result_lower = validation::validate_channel_id(&lowercase_id);

            // Test uppercase
            let uppercase_id = format!("@{}", name.to_uppercase());
            let result_upper = validation::validate_channel_id(&uppercase_id);

            // Test mixed case
            let mixed_id = format!("@{}", name);
            let result_mixed = validation::validate_channel_id(&mixed_id);

            // Property: All case variations should be accepted
            prop_assert!(
                result_lower.is_ok(),
                "Lowercase channel_id '{}' should be accepted",
                lowercase_id
            );
            prop_assert!(
                result_upper.is_ok(),
                "Uppercase channel_id '{}' should be accepted",
                uppercase_id
            );
            prop_assert!(
                result_mixed.is_ok(),
                "Mixed case channel_id '{}' should be accepted",
                mixed_id
            );
        }

        /// Property Test 7: Valid channel IDs are accepted regardless of environment
        /// Verifies that validation doesn't depend on environment variables
        #[test]
        fn prop_valid_channel_id_acceptance_independent_of_env(
            channel_id in valid_channel_id_strategy(),
            env_value in "[a-z]{5,15}".prop_map(|s| format!("@{}", s))
        ) {
            // Test without environment variable
            std::env::remove_var("CHANNEL_ID");
            let result_no_env = validation::validate_channel_id(&channel_id);

            // Test with environment variable set
            std::env::set_var("CHANNEL_ID", &env_value);
            let result_with_env = validation::validate_channel_id(&channel_id);

            // Clean up
            std::env::remove_var("CHANNEL_ID");

            // Property: Both should accept valid channel IDs
            prop_assert!(
                result_no_env.is_ok(),
                "Valid channel_id should be accepted without env var"
            );
            prop_assert!(
                result_with_env.is_ok(),
                "Valid channel_id should be accepted with env var set"
            );

            // Property: Results should be identical
            prop_assert_eq!(
                result_no_env.as_ref().ok(),
                result_with_env.as_ref().ok(),
                "Validation should be independent of environment variable"
            );
        }

        /// Property Test 8: Multiple valid channel IDs are all accepted
        /// Verifies that each valid channel_id is accepted independently
        #[test]
        fn prop_multiple_valid_channel_ids_all_accepted(
            channel_ids in prop::collection::vec(valid_channel_id_strategy(), 2..10)
        ) {
            for channel_id in &channel_ids {
                let result = validation::validate_channel_id(channel_id);

                // Property: Each valid channel_id should be accepted
                prop_assert!(
                    result.is_ok(),
                    "Valid channel_id '{}' should be accepted",
                    channel_id
                );

                // Property: Validated value should match input
                if let Ok(validated) = result {
                    prop_assert_eq!(
                        &validated,
                        channel_id,
                        "Validated channel_id should match input"
                    );
                }
            }
        }

        /// Property Test 9: Valid channel IDs preserve byte-level equality
        /// Verifies that validation doesn't modify the input at byte level
        #[test]
        fn prop_valid_channel_id_preserves_bytes(
            channel_id in valid_channel_id_strategy()
        ) {
            let result = validation::validate_channel_id(&channel_id);

            // Property: Validation should succeed
            prop_assert!(
                result.is_ok(),
                "Valid channel_id should be accepted"
            );

            // Property: Validated value should have identical bytes
            if let Ok(validated) = result {
                prop_assert_eq!(
                    validated.as_bytes(),
                    channel_id.as_bytes(),
                    "Validated channel_id should preserve exact bytes"
                );
            }
        }

        /// Property Test 10: Valid channel IDs are accepted in concurrent contexts
        /// Verifies that validation works correctly when called from multiple threads
        #[test]
        fn prop_valid_channel_id_acceptance_thread_safe(
            channel_id in valid_channel_id_strategy()
        ) {
            use std::sync::Arc;
            use std::thread;

            let channel_id = Arc::new(channel_id);
            let mut handles = vec![];

            // Spawn multiple threads to validate the same channel_id
            for _ in 0..5 {
                let channel_id_clone = Arc::clone(&channel_id);
                let handle = thread::spawn(move || {
                    validation::validate_channel_id(&channel_id_clone)
                });
                handles.push(handle);
            }

            // Collect results
            let results: Vec<_> = handles.into_iter()
                .map(|h| h.join().unwrap())
                .collect();

            // Property: All threads should accept the valid channel_id
            for (i, result) in results.iter().enumerate() {
                prop_assert!(
                    result.is_ok(),
                    "Thread {} should accept valid channel_id",
                    i
                );
            }

            // Property: All results should be identical
            let first_result = results[0].as_ref().ok();
            for result in &results[1..] {
                prop_assert_eq!(
                    result.as_ref().ok(),
                    first_result,
                    "All thread results should be identical"
                );
            }
        }

        /// Property Test 11: Valid channel IDs with numbers are accepted
        /// Verifies that channel IDs containing only numbers (after '@') are accepted
        #[test]
        fn prop_valid_channel_ids_with_numbers_accepted(
            numbers in "[0-9]{3,15}"
        ) {
            let channel_id = format!("@{}", numbers);
            let result = validation::validate_channel_id(&channel_id);

            // Property: Channel IDs with numbers should be accepted
            prop_assert!(
                result.is_ok(),
                "Valid channel_id with numbers '{}' should be accepted",
                channel_id
            );

            // Property: Validated value should match input
            if let Ok(validated) = result {
                prop_assert_eq!(
                    validated,
                    channel_id,
                    "Validated channel_id should match input"
                );
            }
        }

        /// Property Test 12: Minimal valid channel ID '@' is accepted
        /// Verifies that the shortest valid channel ID (just '@') is accepted
        #[test]
        fn prop_minimal_valid_channel_id_accepted(_unit in 0u8..1u8) {
            let channel_id = "@";
            let result = validation::validate_channel_id(channel_id);

            // Property: Minimal valid channel_id '@' should be accepted
            prop_assert!(
                result.is_ok(),
                "Minimal valid channel_id '@' should be accepted"
            );

            // Property: Validated value should match input
            if let Ok(validated) = result {
                prop_assert_eq!(
                    validated,
                    channel_id,
                    "Validated channel_id should match input"
                );
            }
        }

        /// Property Test 13: Valid channel IDs are deterministic
        /// Verifies that validation produces the same result for the same input
        #[test]
        fn prop_valid_channel_id_acceptance_deterministic(
            channel_id in valid_channel_id_strategy()
        ) {
            // Run validation multiple times
            let results: Vec<_> = (0..10)
                .map(|_| validation::validate_channel_id(&channel_id))
                .collect();

            // Property: All results should be Ok
            for (i, result) in results.iter().enumerate() {
                prop_assert!(
                    result.is_ok(),
                    "Validation attempt {} should accept valid channel_id '{}'",
                    i,
                    channel_id
                );
            }

            // Property: All results should be identical
            let first_result = &results[0];
            for result in &results[1..] {
                prop_assert_eq!(
                    result.as_ref().ok(),
                    first_result.as_ref().ok(),
                    "All validation results should be identical"
                );
            }
        }

        /// Property Test 14: Valid channel IDs with whitespace after '@' are accepted
        /// Verifies that channel IDs with spaces after '@' are accepted (if non-empty after trim)
        #[test]
        fn prop_valid_channel_ids_with_trailing_content_accepted(
            name in "[a-zA-Z0-9]{3,15}",
            trailing in "[ ]{0,3}"
        ) {
            let channel_id = format!("@{}{}", name, trailing);
            let result = validation::validate_channel_id(&channel_id);

            // Property: Valid channel IDs should be accepted
            prop_assert!(
                result.is_ok(),
                "Valid channel_id '{}' should be accepted",
                channel_id
            );
        }

        /// Property Test 15: Valid channel IDs with various special characters are accepted
        /// Verifies that channel IDs with dots, slashes, and other characters are accepted
        #[test]
        fn prop_valid_channel_ids_with_various_chars_accepted(
            base in "[a-zA-Z]{3,10}",
            special in prop::sample::select(vec![".", "/", ":", "_", "-"])
        ) {
            let channel_id = format!("@{}{}{}", base, special, base);
            let result = validation::validate_channel_id(&channel_id);

            // Property: Valid channel IDs with special characters should be accepted
            prop_assert!(
                result.is_ok(),
                "Valid channel_id with special character '{}' should be accepted",
                channel_id
            );
        }
    }
}
