/// Property-Based Tests for Channel ID Format Validation
/// 
/// **Feature: pass-channel-id-from-frontend, Property 3: Channel ID format validation**
/// 
/// For any channel_id string, the validation should pass if and only if the string
/// starts with '@' and is non-empty.
/// 
/// **Validates: Requirements 1.5, 4.1**

#[cfg(test)]
mod channel_id_format_validation_tests {
    use crate::validation;
    use proptest::prelude::*;

    /// Strategy for generating arbitrary strings (both valid and invalid)
    fn arbitrary_string_strategy() -> impl Strategy<Value = String> {
        prop_oneof![
            // Valid channel IDs (start with '@', non-empty)
            "@[a-zA-Z0-9:_-]{1,50}".prop_map(|s| s),
            // Invalid: empty string
            Just("".to_string()),
            // Invalid: whitespace only
            "[ \t\n\r]{1,5}".prop_map(|s| s),
            // Invalid: doesn't start with '@'
            "[a-zA-Z0-9]{1,20}".prop_map(|s| s),
            // Invalid: starts with other characters
            "[!#$%^&*()]{1}[a-zA-Z0-9]{0,20}".prop_map(|s| s),
            // Invalid: '@' in middle or end
            "[a-zA-Z]{3,10}@[a-zA-Z]{0,10}".prop_map(|s| s),
            // Invalid: null bytes
            "[a-zA-Z]{3,10}\0[a-zA-Z]{0,10}".prop_map(|s| s),
            // Edge cases
            Just("@".to_string()), // Just '@' - should be valid (non-empty, starts with '@')
            Just(" @channel".to_string()), // Leading whitespace
            Just("@channel ".to_string()), // Trailing whitespace
        ]
    }

    /// Helper function to check if a string should be valid according to the specification
    fn should_be_valid(s: &str) -> bool {
        // Valid if and only if: starts with '@' AND is non-empty (after trim)
        !s.trim().is_empty() && s.starts_with('@') && !s.contains('\0')
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100))]

        /// Property Test 1: Validation passes if and only if string starts with '@' and is non-empty
        /// This is the core property that defines correct validation behavior
        #[test]
        fn prop_validation_iff_starts_with_at_and_non_empty(
            channel_id in arbitrary_string_strategy()
        ) {
            let result = validation::validate_channel_id(&channel_id);
            let expected_valid = should_be_valid(&channel_id);
            
            // Property: Validation result should match expected validity
            prop_assert_eq!(
                result.is_ok(),
                expected_valid,
                "Channel_id '{}' validation result ({}) should match expected ({})",
                channel_id,
                result.is_ok(),
                expected_valid
            );
        }

        /// Property Test 2: All strings starting with '@' and non-empty pass validation
        /// Verifies the "if" direction: starts with '@' and non-empty => passes validation
        #[test]
        fn prop_valid_format_passes(
            suffix in "[a-zA-Z0-9:_-]{1,50}"
        ) {
            let channel_id = format!("@{}", suffix);
            let result = validation::validate_channel_id(&channel_id);
            
            // Property: All strings starting with '@' and non-empty should pass
            prop_assert!(
                result.is_ok(),
                "Channel_id '{}' starts with '@' and is non-empty, should pass validation",
                channel_id
            );
            
            // Property: Validated value should match input
            if let Ok(validated) = result {
                prop_assert_eq!(
                    validated,
                    channel_id,
                    "Validated value should match input"
                );
            }
        }

        /// Property Test 3: All strings not starting with '@' fail validation
        /// Verifies the "only if" direction (part 1): doesn't start with '@' => fails validation
        #[test]
        fn prop_not_starting_with_at_fails(
            first_char in "[a-zA-Z0-9!#$%^&*()_+=\\-\\[\\]{}|;:,.<>?/~`]",
            rest in "[a-zA-Z0-9:_-]{0,20}"
        ) {
            let channel_id = format!("{}{}", first_char, rest);
            
            // Skip if it accidentally starts with '@' (shouldn't happen with our regex)
            prop_assume!(!channel_id.starts_with('@'));
            
            let result = validation::validate_channel_id(&channel_id);
            
            // Property: Strings not starting with '@' should fail validation
            prop_assert!(
                result.is_err(),
                "Channel_id '{}' doesn't start with '@', should fail validation",
                channel_id
            );
        }

        /// Property Test 4: All empty or whitespace-only strings fail validation
        /// Verifies the "only if" direction (part 2): empty => fails validation
        #[test]
        fn prop_empty_or_whitespace_fails(
            whitespace in "[ \t\n\r]{0,10}"
        ) {
            let result = validation::validate_channel_id(&whitespace);
            
            // Property: Empty or whitespace-only strings should fail validation
            prop_assert!(
                result.is_err(),
                "Empty or whitespace-only channel_id '{}' should fail validation",
                whitespace
            );
        }

        /// Property Test 5: Validation is consistent across multiple calls
        /// Verifies that the same input produces the same validation result
        #[test]
        fn prop_validation_is_consistent(
            channel_id in arbitrary_string_strategy(),
            iterations in 2usize..10usize
        ) {
            let results: Vec<_> = (0..iterations)
                .map(|_| validation::validate_channel_id(&channel_id).is_ok())
                .collect();
            
            // Property: All results should be identical
            let first_result = results[0];
            for (i, result) in results.iter().enumerate().skip(1) {
                prop_assert_eq!(
                    *result,
                    first_result,
                    "Validation call {} should match first call for channel_id '{}'",
                    i,
                    channel_id
                );
            }
        }

        /// Property Test 6: Validation with '@' only (edge case)
        /// Verifies that a string containing only '@' is valid (non-empty, starts with '@')
        #[test]
        fn prop_at_symbol_only_is_valid(_unit in 0u8..1u8) {
            let channel_id = "@";
            let result = validation::validate_channel_id(channel_id);
            
            // Property: '@' alone should be valid (non-empty and starts with '@')
            prop_assert!(
                result.is_ok(),
                "Channel_id '@' should be valid (non-empty and starts with '@')"
            );
        }

        /// Property Test 7: Validation with '@' followed by various characters
        /// Verifies that any non-null character after '@' is accepted
        #[test]
        fn prop_at_followed_by_any_char_is_valid(
            c in "[a-zA-Z0-9:_\\-.,!#$%^&*()+=\\[\\]{}|;:<>?/~` ]"
        ) {
            let channel_id = format!("@{}", c);
            let result = validation::validate_channel_id(&channel_id);
            
            // Property: '@' followed by any character (except null) should be valid
            prop_assert!(
                result.is_ok(),
                "Channel_id '{}' starts with '@' and is non-empty, should be valid",
                channel_id
            );
        }

        /// Property Test 8: Strings with null bytes always fail
        /// Verifies that null bytes are rejected regardless of other format
        #[test]
        fn prop_null_bytes_always_fail(
            prefix in "[a-zA-Z0-9@]{0,10}",
            suffix in "[a-zA-Z0-9]{0,10}"
        ) {
            let channel_id = format!("{}\0{}", prefix, suffix);
            let result = validation::validate_channel_id(&channel_id);
            
            // Property: Strings with null bytes should always fail
            prop_assert!(
                result.is_err(),
                "Channel_id with null byte should fail validation"
            );
        }

        /// Property Test 9: Validation result matches manual check
        /// Verifies that validation logic matches the specification exactly
        #[test]
        fn prop_validation_matches_specification(
            channel_id in arbitrary_string_strategy()
        ) {
            let result = validation::validate_channel_id(&channel_id);
            
            // Manual check according to specification
            let is_non_empty = !channel_id.trim().is_empty();
            let starts_with_at = channel_id.starts_with('@');
            let no_null_bytes = !channel_id.contains('\0');
            let should_pass = is_non_empty && starts_with_at && no_null_bytes;
            
            // Property: Validation result should match manual specification check
            prop_assert_eq!(
                result.is_ok(),
                should_pass,
                "Channel_id '{}': validation ({}) should match specification check ({}). \
                 Non-empty: {}, Starts with '@': {}, No null bytes: {}",
                channel_id,
                result.is_ok(),
                should_pass,
                is_non_empty,
                starts_with_at,
                no_null_bytes
            );
        }

        /// Property Test 10: Bidirectional validation property
        /// Verifies both directions: valid <=> (starts with '@' AND non-empty AND no null bytes)
        #[test]
        fn prop_validation_bidirectional(
            channel_id in arbitrary_string_strategy()
        ) {
            let result = validation::validate_channel_id(&channel_id);
            let is_valid = result.is_ok();
            
            let is_non_empty = !channel_id.trim().is_empty();
            let starts_with_at = channel_id.starts_with('@');
            let no_null_bytes = !channel_id.contains('\0');
            
            if is_valid {
                // Forward direction: valid => starts with '@' AND non-empty AND no null bytes
                prop_assert!(
                    starts_with_at,
                    "Valid channel_id '{}' must start with '@'",
                    channel_id
                );
                prop_assert!(
                    is_non_empty,
                    "Valid channel_id '{}' must be non-empty",
                    channel_id
                );
                prop_assert!(
                    no_null_bytes,
                    "Valid channel_id '{}' must not contain null bytes",
                    channel_id
                );
            } else {
                // Backward direction: invalid => NOT (starts with '@' AND non-empty AND no null bytes)
                prop_assert!(
                    !starts_with_at || !is_non_empty || !no_null_bytes,
                    "Invalid channel_id '{}' must fail at least one condition. \
                     Starts with '@': {}, Non-empty: {}, No null bytes: {}",
                    channel_id,
                    starts_with_at,
                    is_non_empty,
                    no_null_bytes
                );
            }
        }

        /// Property Test 11: Length independence
        /// Verifies that validation depends only on format, not length (within reason)
        #[test]
        fn prop_validation_length_independent(
            length in 1usize..100usize
        ) {
            // Generate valid channel ID of given length
            let channel_id = format!("@{}", "a".repeat(length - 1));
            let result = validation::validate_channel_id(&channel_id);
            
            // Property: Valid format should pass regardless of length
            prop_assert!(
                result.is_ok(),
                "Channel_id of length {} with valid format should pass validation",
                length
            );
        }

        /// Property Test 12: Case sensitivity
        /// Verifies that validation works with both uppercase and lowercase
        #[test]
        fn prop_validation_case_insensitive(
            name in "[a-zA-Z]{5,15}"
        ) {
            let lowercase_id = format!("@{}", name.to_lowercase());
            let uppercase_id = format!("@{}", name.to_uppercase());
            let mixed_id = format!("@{}", name);
            
            let result_lower = validation::validate_channel_id(&lowercase_id);
            let result_upper = validation::validate_channel_id(&uppercase_id);
            let result_mixed = validation::validate_channel_id(&mixed_id);
            
            // Property: All case variations should be valid
            prop_assert!(
                result_lower.is_ok(),
                "Lowercase channel_id '{}' should be valid",
                lowercase_id
            );
            prop_assert!(
                result_upper.is_ok(),
                "Uppercase channel_id '{}' should be valid",
                uppercase_id
            );
            prop_assert!(
                result_mixed.is_ok(),
                "Mixed case channel_id '{}' should be valid",
                mixed_id
            );
        }
    }
}
