/// Property-Based Tests for Missing claim_id
/// 
/// **Feature: odysee-cdn-playback-standardization, Property 3: Missing claim_id Returns Error**
/// 
/// For any claim metadata where claim_id is missing, empty, or null, the extract_video_urls
/// function should return an error and not produce a ContentItem.
/// 
/// **Validates: Requirements 2.4**

#[cfg(test)]
mod missing_claim_id_property_tests {
    use crate::commands::parse_claim_item;
    use serde_json::json;
    use proptest::prelude::*;

    /// Strategy for generating valid titles
    fn title_strategy() -> impl Strategy<Value = String> {
        prop_oneof![
            "[A-Za-z0-9 ]{5,100}",  // Normal titles
            Just("Test Movie".to_string()),
            Just("Series Episode 1".to_string()),
            Just("Documentary Film".to_string()),
        ]
    }

    /// Strategy for generating optional tags
    fn tags_strategy() -> impl Strategy<Value = Vec<String>> {
        prop::collection::vec(
            prop_oneof![
                Just("movie".to_string()),
                Just("series".to_string()),
                Just("documentary".to_string()),
                Just("hero_trailer".to_string()),
                "[a-z_]{3,20}",
            ],
            0..10
        )
    }

    /// Strategy for generating optional thumbnail URLs
    fn thumbnail_url_strategy() -> impl Strategy<Value = Option<String>> {
        prop_oneof![
            Just(None),
            Just(Some("https://thumbnails.odysee.com/thumb123.jpg".to_string())),
            Just(Some("https://cdn.example.com/image.png".to_string())),
        ]
    }

    /// Strategy for generating optional duration
    fn duration_strategy() -> impl Strategy<Value = Option<u32>> {
        prop_oneof![
            Just(None),
            (60u32..7200u32).prop_map(Some),
        ]
    }

    /// Strategy for generating optional description
    fn description_strategy() -> impl Strategy<Value = Option<String>> {
        prop_oneof![
            Just(None),
            Just(Some("A great movie".to_string())),
            Just(Some("".to_string())),
        ]
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100))]

        /// Property Test 1: Missing claim_id field entirely
        /// Verifies that claims without claim_id field return error
        #[test]
        fn prop_missing_claim_id_field(
            title in title_strategy(),
            tags in tags_strategy(),
            thumbnail_url in thumbnail_url_strategy(),
            duration in duration_strategy(),
            description in description_strategy()
        ) {
            // Create claim with explicit stream type but NO claim_id field
            let mut value_obj = json!({
                "title": title,
            });

            // Add optional fields
            if let Some(desc) = description {
                value_obj["description"] = json!(desc);
            }
            if let Some(dur) = duration {
                value_obj["video"] = json!({ "duration": dur });
            }

            let mut item = json!({
                "value_type": "stream",
                "value": value_obj,
                // NO claim_id field
            });

            if !tags.is_empty() {
                item["value"]["tags"] = json!(tags);
            }
            if let Some(thumb) = thumbnail_url {
                item["value"]["thumbnail"] = json!({ "url": thumb });
            }

            // Property: Should return error when claim_id is missing
            let result = parse_claim_item(&item);
            prop_assert!(
                result.is_err(),
                "Should return error when claim_id field is missing"
            );
        }

        /// Property Test 2: Empty claim_id string
        /// Verifies that claims with empty claim_id string return error
        #[test]
        fn prop_empty_claim_id_string(
            title in title_strategy(),
            tags in tags_strategy()
        ) {
            // Create claim with explicit stream type but EMPTY claim_id
            let item = json!({
                "claim_id": "",  // Empty string
                "value_type": "stream",
                "value": {
                    "title": title,
                    "tags": tags,
                }
            });

            // Property: Should return error when claim_id is empty
            let result = parse_claim_item(&item);
            prop_assert!(
                result.is_err(),
                "Should return error when claim_id is empty string"
            );
        }

        /// Property Test 3: Null claim_id value
        /// Verifies that claims with null claim_id return error
        #[test]
        fn prop_null_claim_id_value(
            title in title_strategy()
        ) {
            // Create claim with explicit stream type but NULL claim_id
            let item = json!({
                "claim_id": null,  // Null value
                "value_type": "stream",
                "value": {
                    "title": title,
                }
            });

            // Property: Should return error when claim_id is null
            let result = parse_claim_item(&item);
            prop_assert!(
                result.is_err(),
                "Should return error when claim_id is null"
            );
        }

        /// Property Test 4: Whitespace-only claim_id
        /// Verifies that claims with whitespace-only claim_id return error
        #[test]
        fn prop_whitespace_claim_id(
            title in title_strategy(),
            whitespace in prop_oneof![
                Just("   ".to_string()),
                Just("\t".to_string()),
                Just("\n".to_string()),
                Just("  \t\n  ".to_string()),
            ]
        ) {
            // Create claim with explicit stream type but whitespace-only claim_id
            let item = json!({
                "claim_id": whitespace,
                "value_type": "stream",
                "value": {
                    "title": title,
                }
            });

            // Property: Should return error when claim_id is whitespace-only
            let result = parse_claim_item(&item);
            prop_assert!(
                result.is_err(),
                "Should return error when claim_id is whitespace-only"
            );
        }

        /// Property Test 5: Missing claim_id with inferred stream type
        /// Verifies that even with source.sd_hash, missing claim_id returns error
        #[test]
        fn prop_missing_claim_id_with_inferred_stream(
            title in title_strategy()
        ) {
            // Create claim with NO value_type but HAS source.sd_hash (inferred stream)
            // but NO claim_id
            let item = json!({
                "value": {
                    "title": title,
                    "source": {
                        "sd_hash": "abc123def456ghi789jkl012mno345pqr678stu901vwx234yz"
                    }
                },
                // NO claim_id field
            });

            // Property: Should return error even with inferred stream type
            let result = parse_claim_item(&item);
            prop_assert!(
                result.is_err(),
                "Should return error when claim_id is missing, even with inferred stream type"
            );
        }

        /// Property Test 6: Missing claim_id with all other valid fields
        /// Verifies that even with all other fields valid, missing claim_id returns error
        #[test]
        fn prop_missing_claim_id_with_all_valid_fields(
            title in title_strategy(),
            tags in tags_strategy(),
            thumbnail_url in thumbnail_url_strategy(),
            duration in duration_strategy(),
            description in description_strategy()
        ) {
            // Create claim with ALL fields valid EXCEPT claim_id
            let mut value_obj = json!({
                "title": title,
            });

            if let Some(desc) = description {
                value_obj["description"] = json!(desc);
            }
            if let Some(dur) = duration {
                value_obj["video"] = json!({ "duration": dur });
            }

            let mut item = json!({
                "value_type": "stream",
                "value": value_obj,
                // NO claim_id field
            });

            if !tags.is_empty() {
                item["value"]["tags"] = json!(tags);
            }
            if let Some(thumb) = thumbnail_url {
                item["value"]["thumbnail"] = json!({ "url": thumb });
            }

            // Property: Should return error despite all other fields being valid
            let result = parse_claim_item(&item);
            prop_assert!(
                result.is_err(),
                "Should return error when claim_id is missing, even with all other fields valid"
            );
        }

        /// Property Test 7: Empty claim_id with non-stream type
        /// Verifies that empty claim_id returns error regardless of claim type
        #[test]
        fn prop_empty_claim_id_with_non_stream_type(
            title in title_strategy(),
            claim_type in prop_oneof![
                Just("channel".to_string()),
                Just("repost".to_string()),
                Just("collection".to_string()),
            ]
        ) {
            // Create claim with non-stream type and empty claim_id
            let item = json!({
                "claim_id": "",  // Empty string
                "value_type": claim_type,
                "value": {
                    "title": title,
                }
            });

            // Property: Should return error (either for empty claim_id or non-stream type)
            let result = parse_claim_item(&item);
            prop_assert!(
                result.is_err(),
                "Should return error when claim_id is empty, regardless of claim type"
            );
        }

        /// Property Test 8: Null claim_id with all optional metadata
        /// Verifies that null claim_id returns error even with rich metadata
        #[test]
        fn prop_null_claim_id_with_metadata(
            title in title_strategy(),
            tags in tags_strategy(),
            description in description_strategy()
        ) {
            // Create claim with rich metadata but null claim_id
            let mut value_obj = json!({
                "title": title,
                "tags": tags,
            });

            if let Some(desc) = description {
                value_obj["description"] = json!(desc);
            }

            let item = json!({
                "claim_id": null,  // Null value
                "value_type": "stream",
                "value": value_obj,
            });

            // Property: Should return error despite rich metadata
            let result = parse_claim_item(&item);
            prop_assert!(
                result.is_err(),
                "Should return error when claim_id is null, even with rich metadata"
            );
        }

        /// Property Test 9: Missing claim_id in batch processing
        /// Verifies that missing claim_id doesn't crash batch processing
        #[test]
        fn prop_missing_claim_id_in_batch(
            titles in prop::collection::vec(title_strategy(), 2..10)
        ) {
            // Create multiple claims, some with claim_id, some without
            let mut results = Vec::new();
            
            for (i, title) in titles.iter().enumerate() {
                let item = if i % 2 == 0 {
                    // Even index: has claim_id
                    json!({
                        "claim_id": format!("claim{}", i),
                        "value_type": "stream",
                        "value": {
                            "title": title,
                        }
                    })
                } else {
                    // Odd index: missing claim_id
                    json!({
                        "value_type": "stream",
                        "value": {
                            "title": title,
                        }
                    })
                };

                let result = parse_claim_item(&item);
                results.push((i, result));
            }

            // Property: Claims with claim_id should succeed
            for (i, result) in &results {
                if i % 2 == 0 {
                    prop_assert!(
                        result.is_ok(),
                        "Claim {} with claim_id should succeed",
                        i
                    );
                } else {
                    // Claims without claim_id should fail
                    prop_assert!(
                        result.is_err(),
                        "Claim {} without claim_id should fail",
                        i
                    );
                }
            }
        }

        /// Property Test 10: claim_id as non-string type
        /// Verifies that claim_id as number or boolean returns error
        #[test]
        fn prop_claim_id_wrong_type(
            title in title_strategy(),
            wrong_type in prop_oneof![
                Just(json!(123)),
                Just(json!(true)),
                Just(json!(false)),
                Just(json!([])),
                Just(json!({})),
            ]
        ) {
            // Create claim with claim_id as wrong type
            let item = json!({
                "claim_id": wrong_type,
                "value_type": "stream",
                "value": {
                    "title": title,
                }
            });

            // Property: Should return error when claim_id is not a string
            let result = parse_claim_item(&item);
            prop_assert!(
                result.is_err(),
                "Should return error when claim_id is not a string type"
            );
        }
    }
}
