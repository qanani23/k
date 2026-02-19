/// Property-Based Tests for Partial Success When Processing Multiple Claims
/// 
/// **Feature: odysee-cdn-playback-standardization, Property 5: Partial Success When Processing Multiple Claims**
/// 
/// For any list of claim metadata where some claims have valid claim_id and stream type and others
/// have missing claim_id or non-stream type, the parsing function should:
/// - Return ContentItems for all claims with valid claim_id and stream type
/// - Not fail the entire batch due to individual claim failures
/// - Produce a result list with length equal to the number of valid stream claims
/// 
/// **Validates: Requirements 5.1, 5.2, 5.5**

#[cfg(test)]
mod partial_success_property_tests {
    use crate::commands::parse_claim_search_response;
    use crate::models::OdyseeResponse;
    use serde_json::json;
    use proptest::prelude::*;

    /// Strategy for generating valid claim IDs (alphanumeric, 20-40 chars)
    fn claim_id_strategy() -> impl Strategy<Value = String> {
        prop_oneof![
            "[a-zA-Z0-9]{20,40}",
            "[a-zA-Z0-9]{10,20}",
            Just("abc123def456ghi789jkl012".to_string()),
            Just("valid_claim_id_12345".to_string()),
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

    /// Strategy for generating claim types
    fn claim_type_strategy() -> impl Strategy<Value = String> {
        prop_oneof![
            Just("stream".to_string()),
            Just("channel".to_string()),
            Just("repost".to_string()),
            Just("collection".to_string()),
        ]
    }

    /// Enum representing different types of claims for testing
    #[derive(Debug, Clone)]
    enum ClaimVariant {
        ValidStream { claim_id: String, title: String },
        MissingClaimId { title: String },
        EmptyClaimId { title: String },
        NonStreamType { claim_id: String, title: String, claim_type: String },
    }

    /// Strategy for generating a mix of valid and invalid claims
    fn claim_variant_strategy() -> impl Strategy<Value = ClaimVariant> {
        prop_oneof![
            // Valid stream claims (should succeed)
            (claim_id_strategy(), title_strategy()).prop_map(|(id, title)| {
                ClaimVariant::ValidStream { claim_id: id, title }
            }),
            // Missing claim_id (should be skipped)
            title_strategy().prop_map(|title| {
                ClaimVariant::MissingClaimId { title }
            }),
            // Empty claim_id (should be skipped)
            title_strategy().prop_map(|title| {
                ClaimVariant::EmptyClaimId { title }
            }),
            // Non-stream type (should be skipped)
            (claim_id_strategy(), title_strategy(), claim_type_strategy()).prop_map(|(id, title, claim_type)| {
                // Filter out "stream" type to ensure this is non-stream
                let non_stream_type = if claim_type == "stream" {
                    "channel".to_string()
                } else {
                    claim_type
                };
                ClaimVariant::NonStreamType { claim_id: id, title, claim_type: non_stream_type }
            }),
        ]
    }

    /// Convert ClaimVariant to JSON value
    fn claim_variant_to_json(variant: &ClaimVariant) -> serde_json::Value {
        match variant {
            ClaimVariant::ValidStream { claim_id, title } => {
                json!({
                    "claim_id": claim_id,
                    "value_type": "stream",
                    "value": {
                        "title": title,
                    },
                    "timestamp": 1234567890
                })
            }
            ClaimVariant::MissingClaimId { title } => {
                json!({
                    "value_type": "stream",
                    "value": {
                        "title": title,
                    },
                    "timestamp": 1234567890
                })
            }
            ClaimVariant::EmptyClaimId { title } => {
                json!({
                    "claim_id": "",
                    "value_type": "stream",
                    "value": {
                        "title": title,
                    },
                    "timestamp": 1234567890
                })
            }
            ClaimVariant::NonStreamType { claim_id, title, claim_type } => {
                json!({
                    "claim_id": claim_id,
                    "value_type": claim_type,
                    "value": {
                        "title": title,
                    },
                    "timestamp": 1234567890
                })
            }
        }
    }

    /// Check if a claim variant is expected to succeed
    fn is_valid_claim(variant: &ClaimVariant) -> bool {
        matches!(variant, ClaimVariant::ValidStream { .. })
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100))]

        /// Property Test 1: Partial success with mixed valid and invalid claims
        /// Verifies that valid claims are processed even when some claims fail
        #[test]
        fn prop_partial_success_mixed_claims(
            claims in prop::collection::vec(claim_variant_strategy(), 2..20)
        ) {
            // Count expected valid claims
            let expected_valid_count = claims.iter().filter(|c| is_valid_claim(c)).count();

            // Convert claims to JSON
            let items: Vec<serde_json::Value> = claims.iter()
                .map(claim_variant_to_json)
                .collect();

            let response = OdyseeResponse {
                success: true,
                error: None,
                data: Some(json!({
                    "items": items
                })),
            };

            // Property: Should not fail the entire batch
            let result = parse_claim_search_response(response);
            prop_assert!(
                result.is_ok(),
                "Should not fail entire batch due to individual claim failures"
            );

            if let Ok(content_items) = result {
                // Property: Result length should equal number of valid claims
                prop_assert_eq!(
                    content_items.len(),
                    expected_valid_count,
                    "Result should contain exactly {} valid claims, got {}",
                    expected_valid_count,
                    content_items.len()
                );

                // Property: All returned items should have valid claim_ids
                for item in &content_items {
                    prop_assert!(
                        !item.claim_id.is_empty(),
                        "All returned items should have non-empty claim_id"
                    );
                }

                // Property: All returned items should have video URLs
                for item in &content_items {
                    prop_assert!(
                        !item.video_urls.is_empty(),
                        "All returned items should have video URLs"
                    );
                    prop_assert!(
                        item.video_urls.contains_key("master"),
                        "All returned items should have 'master' quality entry"
                    );
                }
            }
        }

        /// Property Test 2: All valid claims should succeed
        /// Verifies that when all claims are valid, all are returned
        #[test]
        fn prop_all_valid_claims_succeed(
            claim_ids in prop::collection::vec(claim_id_strategy(), 1..15),
            titles in prop::collection::vec(title_strategy(), 1..15)
        ) {
            // Ensure we have matching counts
            let count = claim_ids.len().min(titles.len());
            let claim_ids = &claim_ids[..count];
            let titles = &titles[..count];

            let items: Vec<serde_json::Value> = claim_ids.iter()
                .zip(titles.iter())
                .map(|(id, title)| {
                    json!({
                        "claim_id": id,
                        "value_type": "stream",
                        "value": {
                            "title": title,
                        },
                        "timestamp": 1234567890
                    })
                })
                .collect();

            let response = OdyseeResponse {
                success: true,
                error: None,
                data: Some(json!({
                    "items": items
                })),
            };

            let result = parse_claim_search_response(response);
            prop_assert!(result.is_ok(), "Should succeed with all valid claims");

            if let Ok(content_items) = result {
                // Property: Should return all claims
                prop_assert_eq!(
                    content_items.len(),
                    count,
                    "Should return all {} valid claims",
                    count
                );

                // Property: Claim IDs should match
                for (i, item) in content_items.iter().enumerate() {
                    prop_assert_eq!(
                        &item.claim_id,
                        &claim_ids[i],
                        "Claim ID at index {} should match",
                        i
                    );
                }
            }
        }

        /// Property Test 3: All invalid claims should return empty array
        /// Verifies that when all claims are invalid, an empty array is returned (not error)
        #[test]
        fn prop_all_invalid_claims_return_empty(
            count in 1usize..10
        ) {
            // Generate all invalid claims (mix of missing claim_id and non-stream types)
            let items: Vec<serde_json::Value> = (0..count)
                .map(|i| {
                    if i % 2 == 0 {
                        // Missing claim_id
                        json!({
                            "value_type": "stream",
                            "value": {
                                "title": format!("Invalid {}", i),
                            }
                        })
                    } else {
                        // Non-stream type
                        json!({
                            "claim_id": format!("invalid-{}", i),
                            "value_type": "channel",
                            "value": {
                                "title": format!("Invalid {}", i),
                            }
                        })
                    }
                })
                .collect();

            let response = OdyseeResponse {
                success: true,
                error: None,
                data: Some(json!({
                    "items": items
                })),
            };

            let result = parse_claim_search_response(response);
            
            // Property: Should not fail (should return Ok with empty array)
            prop_assert!(
                result.is_ok(),
                "Should not fail when all claims are invalid"
            );

            if let Ok(content_items) = result {
                // Property: Should return empty array
                prop_assert_eq!(
                    content_items.len(),
                    0,
                    "Should return empty array when all claims are invalid"
                );
            }
        }

        /// Property Test 4: Single valid claim among many invalid
        /// Verifies that even one valid claim is returned successfully
        #[test]
        fn prop_single_valid_among_invalid(
            valid_claim_id in claim_id_strategy(),
            valid_title in title_strategy(),
            invalid_count in 1usize..10
        ) {
            let mut items = Vec::new();

            // Add invalid claims before
            for i in 0..invalid_count/2 {
                items.push(json!({
                    "value_type": "stream",
                    "value": {
                        "title": format!("Invalid {}", i),
                    }
                }));
            }

            // Add the single valid claim
            items.push(json!({
                "claim_id": valid_claim_id,
                "value_type": "stream",
                "value": {
                    "title": valid_title,
                },
                "timestamp": 1234567890
            }));

            // Add invalid claims after
            for i in invalid_count/2..invalid_count {
                items.push(json!({
                    "claim_id": format!("invalid-{}", i),
                    "value_type": "channel",
                    "value": {
                        "title": format!("Invalid {}", i),
                    }
                }));
            }

            let response = OdyseeResponse {
                success: true,
                error: None,
                data: Some(json!({
                    "items": items
                })),
            };

            let result = parse_claim_search_response(response);
            prop_assert!(result.is_ok(), "Should succeed with one valid claim");

            if let Ok(content_items) = result {
                // Property: Should return exactly one item
                prop_assert_eq!(
                    content_items.len(),
                    1,
                    "Should return exactly one valid claim"
                );

                // Property: The returned item should be the valid one
                prop_assert_eq!(
                    &content_items[0].claim_id,
                    &valid_claim_id,
                    "Returned claim should be the valid one"
                );
                prop_assert_eq!(
                    &content_items[0].title,
                    &valid_title,
                    "Returned title should match"
                );
            }
        }

        /// Property Test 5: Order preservation for valid claims
        /// Verifies that valid claims maintain their relative order
        #[test]
        fn prop_order_preservation(
            valid_claims in prop::collection::vec(
                (claim_id_strategy(), title_strategy()),
                2..10
            ),
            invalid_positions in prop::collection::vec(0usize..100, 0..5)
        ) {
            let mut items = Vec::new();
            let mut expected_order = Vec::new();

            // Build items list with valid claims and invalid claims at specified positions
            let mut invalid_iter = invalid_positions.iter();
            
            for (i, (claim_id, title)) in valid_claims.iter().enumerate() {
                // Maybe insert an invalid claim before this valid one
                if let Some(&pos) = invalid_iter.next() {
                    if pos % 2 == 0 {
                        items.push(json!({
                            "value_type": "stream",
                            "value": {
                                "title": format!("Invalid at {}", i),
                            }
                        }));
                    }
                }

                // Add valid claim
                items.push(json!({
                    "claim_id": claim_id,
                    "value_type": "stream",
                    "value": {
                        "title": title,
                    },
                    "timestamp": 1234567890
                }));
                expected_order.push(claim_id.clone());
            }

            let response = OdyseeResponse {
                success: true,
                error: None,
                data: Some(json!({
                    "items": items
                })),
            };

            let result = parse_claim_search_response(response);
            prop_assert!(result.is_ok(), "Should succeed with mixed claims");

            if let Ok(content_items) = result {
                // Property: Should have all valid claims
                prop_assert_eq!(
                    content_items.len(),
                    expected_order.len(),
                    "Should have all valid claims"
                );

                // Property: Order should be preserved
                for (i, item) in content_items.iter().enumerate() {
                    prop_assert_eq!(
                        &item.claim_id,
                        &expected_order[i],
                        "Claim order should be preserved at index {}",
                        i
                    );
                }
            }
        }

        /// Property Test 6: Batch processing doesn't fail on first error
        /// Verifies that processing continues after encountering invalid claims
        #[test]
        fn prop_continues_after_errors(
            valid_before in prop::collection::vec((claim_id_strategy(), title_strategy()), 1..5),
            valid_after in prop::collection::vec((claim_id_strategy(), title_strategy()), 1..5)
        ) {
            let mut items = Vec::new();

            // Add valid claims before
            for (claim_id, title) in &valid_before {
                items.push(json!({
                    "claim_id": claim_id,
                    "value_type": "stream",
                    "value": {
                        "title": title,
                    },
                    "timestamp": 1234567890
                }));
            }

            // Add multiple invalid claims in the middle
            items.push(json!({
                "value_type": "stream",
                "value": {
                    "title": "Missing claim_id",
                }
            }));
            items.push(json!({
                "claim_id": "",
                "value_type": "stream",
                "value": {
                    "title": "Empty claim_id",
                }
            }));
            items.push(json!({
                "claim_id": "non-stream",
                "value_type": "channel",
                "value": {
                    "title": "Non-stream type",
                }
            }));

            // Add valid claims after
            for (claim_id, title) in &valid_after {
                items.push(json!({
                    "claim_id": claim_id,
                    "value_type": "stream",
                    "value": {
                        "title": title,
                    },
                    "timestamp": 1234567890
                }));
            }

            let response = OdyseeResponse {
                success: true,
                error: None,
                data: Some(json!({
                    "items": items
                })),
            };

            let result = parse_claim_search_response(response);
            prop_assert!(result.is_ok(), "Should succeed despite errors in middle");

            if let Ok(content_items) = result {
                let expected_count = valid_before.len() + valid_after.len();
                
                // Property: Should have all valid claims (before and after errors)
                prop_assert_eq!(
                    content_items.len(),
                    expected_count,
                    "Should have all valid claims from before and after errors"
                );

                // Property: First items should match valid_before
                for (i, (claim_id, _)) in valid_before.iter().enumerate() {
                    prop_assert_eq!(
                        &content_items[i].claim_id,
                        claim_id,
                        "Claim before errors should match at index {}",
                        i
                    );
                }

                // Property: Last items should match valid_after
                let offset = valid_before.len();
                for (i, (claim_id, _)) in valid_after.iter().enumerate() {
                    prop_assert_eq!(
                        &content_items[offset + i].claim_id,
                        claim_id,
                        "Claim after errors should match at index {}",
                        offset + i
                    );
                }
            }
        }
    }
}
