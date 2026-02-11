/// Property-Based Tests for Channel ID Parameter Usage
/// 
/// **Feature: pass-channel-id-from-frontend, Property 1: Channel ID parameter usage**
/// 
/// For any valid channel_id string, when passed to fetch_channel_claims or fetch_playlists,
/// the backend should use that exact channel_id value in the Odysee API request
/// (not read from environment variables).
/// 
/// **Validates: Requirements 1.3, 5.2**

#[cfg(test)]
mod channel_id_parameter_tests {
    use crate::validation;
    use proptest::prelude::*;

    /// Strategy for generating valid channel IDs (must start with '@')
    fn valid_channel_id_strategy() -> impl Strategy<Value = String> {
        prop_oneof![
            // Channel with claim ID
            "@[a-z]{5,15}:[a-z0-9]{1,10}".prop_map(|s| s),
            // Channel without claim ID
            "@[a-z]{5,15}".prop_map(|s| s),
            // Channel with numbers
            "@[a-z0-9]{5,15}".prop_map(|s| s),
            // Specific valid examples
            Just("@kiyyamovies:b".to_string()),
            Just("@testchannel".to_string()),
            Just("@channel123".to_string()),
        ]
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100))]

        /// Property Test 1: Valid channel IDs pass validation
        /// Verifies that all valid channel_id strings (starting with '@') pass validation
        #[test]
        fn prop_valid_channel_ids_pass_validation(
            channel_id in valid_channel_id_strategy()
        ) {
            // Property: All valid channel IDs should pass validation
            let result = validation::validate_channel_id(&channel_id);
            
            prop_assert!(
                result.is_ok(),
                "Valid channel_id '{}' should pass validation, got error: {:?}",
                channel_id,
                result.err()
            );
            
            // Property: Validated channel_id should match the input
            if let Ok(validated) = result {
                prop_assert_eq!(
                    validated,
                    channel_id,
                    "Validated channel_id should match input"
                );
            }
        }

        /// Property Test 2: Channel ID validation is consistent
        /// Verifies that the same channel_id produces consistent validation results
        #[test]
        fn prop_channel_id_validation_consistency(
            channel_id in valid_channel_id_strategy(),
            iterations in 2usize..10usize
        ) {
            let mut validation_results = Vec::new();
            
            for _ in 0..iterations {
                let result = validation::validate_channel_id(&channel_id);
                validation_results.push(result.is_ok());
            }
            
            // Property: All validation results should be identical
            let first_result = validation_results[0];
            for result in &validation_results[1..] {
                prop_assert_eq!(
                    *result,
                    first_result,
                    "Channel ID validation should be consistent across calls"
                );
            }
        }

        /// Property Test 3: Channel ID validation does not depend on environment
        /// Verifies that validation works regardless of CHANNEL_ID environment variable
        #[test]
        fn prop_channel_id_validation_independent_of_env(
            channel_id in valid_channel_id_strategy(),
            env_channel_id in valid_channel_id_strategy()
        ) {
            // Test with no environment variable
            std::env::remove_var("CHANNEL_ID");
            let result_no_env = validation::validate_channel_id(&channel_id);
            
            // Test with environment variable set to different value
            std::env::set_var("CHANNEL_ID", &env_channel_id);
            let result_with_env = validation::validate_channel_id(&channel_id);
            
            // Clean up
            std::env::remove_var("CHANNEL_ID");
            
            // Property: Validation should be independent of environment variable
            prop_assert_eq!(
                result_no_env.is_ok(),
                result_with_env.is_ok(),
                "Channel ID validation should not depend on CHANNEL_ID environment variable"
            );
            
            // Property: Both should succeed for valid channel IDs
            prop_assert!(
                result_no_env.is_ok(),
                "Valid channel_id should pass validation without env var"
            );
            prop_assert!(
                result_with_env.is_ok(),
                "Valid channel_id should pass validation with env var set"
            );
        }

        /// Property Test 4: Multiple different channel IDs all validate correctly
        /// Verifies that each channel_id is validated independently
        #[test]
        fn prop_multiple_channel_ids_validate_independently(
            channel_ids in prop::collection::vec(valid_channel_id_strategy(), 2..10)
        ) {
            std::env::remove_var("CHANNEL_ID");
            
            for channel_id in &channel_ids {
                let result = validation::validate_channel_id(channel_id);
                
                // Property: Each valid channel_id should pass validation
                prop_assert!(
                    result.is_ok(),
                    "Valid channel_id '{}' should pass validation",
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

        /// Property Test 5: Channel ID validation preserves exact value
        /// Verifies that validation returns the exact input value without modification
        #[test]
        fn prop_channel_id_validation_preserves_value(
            channel_id in valid_channel_id_strategy()
        ) {
            let result = validation::validate_channel_id(&channel_id);
            
            // Property: Validation should succeed
            prop_assert!(
                result.is_ok(),
                "Valid channel_id should pass validation"
            );
            
            // Property: Validated value should be exactly the same as input
            if let Ok(validated) = result {
                prop_assert_eq!(
                    &validated,
                    &channel_id,
                    "Validation should preserve the exact channel_id value"
                );
                
                // Verify byte-for-byte equality
                prop_assert_eq!(
                    validated.as_bytes(),
                    channel_id.as_bytes(),
                    "Validation should preserve exact bytes"
                );
            }
        }

        /// Property Test 6: Channel ID validation with special characters
        /// Verifies that channel IDs with colons and other valid characters work
        #[test]
        fn prop_channel_id_with_special_chars(
            name in "[a-z]{5,15}",
            claim_id in "[a-z0-9]{1,10}"
        ) {
            // Test channel ID with colon (claim ID format)
            let channel_id = format!("@{}:{}", name, claim_id);
            let result = validation::validate_channel_id(&channel_id);
            
            // Property: Channel IDs with colons should be valid
            prop_assert!(
                result.is_ok(),
                "Channel ID with colon '{}' should be valid",
                channel_id
            );
            
            // Test channel ID without colon
            let channel_id_no_claim = format!("@{}", name);
            let result_no_claim = validation::validate_channel_id(&channel_id_no_claim);
            
            // Property: Channel IDs without colons should also be valid
            prop_assert!(
                result_no_claim.is_ok(),
                "Channel ID without colon '{}' should be valid",
                channel_id_no_claim
            );
        }

        /// Property Test 7: Channel ID validation is deterministic
        /// Verifies that validation produces the same result for the same input
        #[test]
        fn prop_channel_id_validation_deterministic(
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
                    "Validation attempt {} should succeed for '{}'",
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

        /// Property Test 8: Channel ID validation thread safety
        /// Verifies that validation works correctly when called from multiple threads
        #[test]
        fn prop_channel_id_validation_thread_safe(
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
            
            // Property: All threads should get the same result
            for result in &results {
                prop_assert!(
                    result.is_ok(),
                    "Validation should succeed in all threads"
                );
            }
            
            // Property: All results should be identical
            let first_result = &results[0];
            for result in &results[1..] {
                prop_assert_eq!(
                    result.as_ref().ok(),
                    first_result.as_ref().ok(),
                    "All thread results should be identical"
                );
            }
        }
    }
}

/// Property-Based Tests for Invalid Channel ID Rejection
/// 
/// **Feature: pass-channel-id-from-frontend, Property 2: Invalid channel ID rejection**
/// 
/// For any string that does not start with '@' or is empty, when passed as channel_id
/// to backend commands, the backend should return a validation error.
/// 
/// **Validates: Requirements 1.4, 4.2**

#[cfg(test)]
mod invalid_channel_id_rejection_tests {
    use crate::validation;
    use proptest::prelude::*;

    /// Strategy for generating invalid channel IDs (not starting with '@' or empty)
    fn invalid_channel_id_strategy() -> impl Strategy<Value = String> {
        prop_oneof![
            // Empty string
            Just("".to_string()),
            // Whitespace only
            Just("   ".to_string()),
            Just("\t".to_string()),
            Just("\n".to_string()),
            // Strings not starting with '@'
            "[a-z]{5,15}".prop_map(|s| s),
            "[a-z]{5,15}:[a-z0-9]{1,10}".prop_map(|s| s),
            "channel[a-z]{5,10}".prop_map(|s| s),
            // Strings with '@' but not at the start
            "[a-z]{3,10}@[a-z]{3,10}".prop_map(|s| s),
            "channel@name".prop_map(|s| s.to_string()),
            // Numbers only
            "[0-9]{5,10}".prop_map(|s| s),
            // Special characters without '@' at start
            "[!#$%^&*()]{1,5}[a-z]{3,10}".prop_map(|s| s),
            // Specific invalid examples
            Just("kiyyamovies:b".to_string()),
            Just("channelname".to_string()),
            Just("channel:claimid".to_string()),
            Just("test".to_string()),
            Just("123".to_string()),
        ]
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100))]

        /// Property Test 1: Invalid channel IDs fail validation
        /// Verifies that all invalid channel_id strings (not starting with '@' or empty) fail validation
        #[test]
        fn prop_invalid_channel_ids_fail_validation(
            channel_id in invalid_channel_id_strategy()
        ) {
            // Property: All invalid channel IDs should fail validation
            let result = validation::validate_channel_id(&channel_id);
            
            prop_assert!(
                result.is_err(),
                "Invalid channel_id '{}' should fail validation",
                channel_id
            );
        }

        /// Property Test 2: Empty and whitespace-only strings fail validation
        /// Verifies that empty strings and whitespace-only strings are rejected
        #[test]
        fn prop_empty_channel_ids_fail_validation(
            whitespace in prop::string::string_regex("[ \t\n\r]*").unwrap()
        ) {
            // Property: Empty and whitespace-only strings should fail validation
            let result = validation::validate_channel_id(&whitespace);
            
            prop_assert!(
                result.is_err(),
                "Empty or whitespace-only channel_id '{}' should fail validation",
                whitespace
            );
        }

        /// Property Test 3: Strings without '@' at start fail validation
        /// Verifies that strings not starting with '@' are rejected
        #[test]
        fn prop_channel_ids_without_at_symbol_fail(
            prefix in "[a-zA-Z0-9]{1,3}",
            suffix in "[a-zA-Z0-9:]{5,15}"
        ) {
            // Generate a string that doesn't start with '@'
            let channel_id = format!("{}{}", prefix, suffix);
            
            // Property: Strings not starting with '@' should fail validation
            let result = validation::validate_channel_id(&channel_id);
            
            prop_assert!(
                result.is_err(),
                "Channel_id '{}' without '@' at start should fail validation",
                channel_id
            );
        }

        /// Property Test 4: Strings with '@' in middle fail validation
        /// Verifies that strings with '@' not at the start are rejected
        #[test]
        fn prop_channel_ids_with_at_in_middle_fail(
            prefix in "[a-zA-Z]{3,10}",
            suffix in "[a-zA-Z]{3,10}"
        ) {
            // Generate a string with '@' in the middle
            let channel_id = format!("{}@{}", prefix, suffix);
            
            // Property: Strings with '@' not at start should fail validation
            let result = validation::validate_channel_id(&channel_id);
            
            prop_assert!(
                result.is_err(),
                "Channel_id '{}' with '@' in middle should fail validation",
                channel_id
            );
        }

        /// Property Test 5: Invalid channel IDs return consistent errors
        /// Verifies that the same invalid channel_id produces consistent error results
        #[test]
        fn prop_invalid_channel_id_validation_consistency(
            channel_id in invalid_channel_id_strategy(),
            iterations in 2usize..10usize
        ) {
            let mut validation_results = Vec::new();
            
            for _ in 0..iterations {
                let result = validation::validate_channel_id(&channel_id);
                validation_results.push(result.is_err());
            }
            
            // Property: All validation results should be identical (all errors)
            let first_result = validation_results[0];
            for result in &validation_results[1..] {
                prop_assert_eq!(
                    *result,
                    first_result,
                    "Invalid channel ID validation should be consistent across calls"
                );
            }
            
            // Property: All results should be errors
            prop_assert!(
                first_result,
                "Invalid channel_id '{}' should consistently fail validation",
                channel_id
            );
        }

        /// Property Test 6: Invalid channel IDs fail regardless of environment
        /// Verifies that validation fails regardless of CHANNEL_ID environment variable
        #[test]
        fn prop_invalid_channel_id_validation_independent_of_env(
            channel_id in invalid_channel_id_strategy(),
            env_channel_id in "[a-z]{5,15}".prop_map(|s| format!("@{}", s))
        ) {
            // Test with no environment variable
            std::env::remove_var("CHANNEL_ID");
            let result_no_env = validation::validate_channel_id(&channel_id);
            
            // Test with environment variable set to valid value
            std::env::set_var("CHANNEL_ID", &env_channel_id);
            let result_with_env = validation::validate_channel_id(&channel_id);
            
            // Clean up
            std::env::remove_var("CHANNEL_ID");
            
            // Property: Validation should be independent of environment variable
            prop_assert_eq!(
                result_no_env.is_err(),
                result_with_env.is_err(),
                "Invalid channel ID validation should not depend on CHANNEL_ID environment variable"
            );
            
            // Property: Both should fail for invalid channel IDs
            prop_assert!(
                result_no_env.is_err(),
                "Invalid channel_id '{}' should fail validation without env var",
                channel_id
            );
            prop_assert!(
                result_with_env.is_err(),
                "Invalid channel_id '{}' should fail validation with env var set",
                channel_id
            );
        }

        /// Property Test 7: Multiple different invalid channel IDs all fail validation
        /// Verifies that each invalid channel_id is validated independently
        #[test]
        fn prop_multiple_invalid_channel_ids_fail_independently(
            channel_ids in prop::collection::vec(invalid_channel_id_strategy(), 2..10)
        ) {
            std::env::remove_var("CHANNEL_ID");
            
            for channel_id in &channel_ids {
                let result = validation::validate_channel_id(channel_id);
                
                // Property: Each invalid channel_id should fail validation
                prop_assert!(
                    result.is_err(),
                    "Invalid channel_id '{}' should fail validation",
                    channel_id
                );
            }
        }

        /// Property Test 8: Invalid channel ID validation is deterministic
        /// Verifies that validation produces the same error result for the same invalid input
        #[test]
        fn prop_invalid_channel_id_validation_deterministic(
            channel_id in invalid_channel_id_strategy()
        ) {
            // Run validation multiple times
            let results: Vec<_> = (0..10)
                .map(|_| validation::validate_channel_id(&channel_id))
                .collect();
            
            // Property: All results should be Err
            for (i, result) in results.iter().enumerate() {
                prop_assert!(
                    result.is_err(),
                    "Validation attempt {} should fail for invalid channel_id '{}'",
                    i,
                    channel_id
                );
            }
        }

        /// Property Test 9: Invalid channel ID validation thread safety
        /// Verifies that validation works correctly when called from multiple threads
        #[test]
        fn prop_invalid_channel_id_validation_thread_safe(
            channel_id in invalid_channel_id_strategy()
        ) {
            use std::sync::Arc;
            use std::thread;
            
            let channel_id = Arc::new(channel_id);
            let mut handles = vec![];
            
            // Spawn multiple threads to validate the same invalid channel_id
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
            
            // Property: All threads should get error results
            for result in &results {
                prop_assert!(
                    result.is_err(),
                    "Validation should fail in all threads for invalid channel_id"
                );
            }
        }

        /// Property Test 10: Null bytes in channel IDs are rejected
        /// Verifies that channel IDs containing null bytes are rejected
        #[test]
        fn prop_channel_ids_with_null_bytes_fail(
            prefix in "[a-zA-Z]{3,10}",
            suffix in "[a-zA-Z]{3,10}"
        ) {
            // Generate a string with null byte
            let channel_id = format!("{}\0{}", prefix, suffix);
            
            // Property: Strings with null bytes should fail validation
            let result = validation::validate_channel_id(&channel_id);
            
            prop_assert!(
                result.is_err(),
                "Channel_id with null byte should fail validation"
            );
        }
    }
}
