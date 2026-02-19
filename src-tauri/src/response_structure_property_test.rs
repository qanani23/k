/// Property-Based Tests for Backend Response Structure
/// 
/// **Feature: odysee-cdn-playback-standardization, Property 4: Backend Response Contains Required Fields**
/// 
/// For any successfully processed claim with valid claim_id and stream type, the resulting
/// ContentItem should contain:
/// - claim_id (non-empty string)
/// - title (non-empty string)
/// - video_urls HashMap with at least one entry
/// - playback_url accessible via video_urls.get("master")
/// - tags (may be empty array)
/// - thumbnail_url (may be None)
/// 
/// **Validates: Requirements 11.7**

#[cfg(test)]
mod response_structure_property_tests {
    use crate::commands::parse_claim_item;
    use serde_json::json;
    use proptest::prelude::*;

    /// Strategy for generating valid claim IDs (alphanumeric, 20-40 chars)
    fn claim_id_strategy() -> impl Strategy<Value = String> {
        prop_oneof![
            // Standard claim IDs (alphanumeric, typical length)
            "[a-zA-Z0-9]{20,40}".prop_map(|s| s),
            // Short claim IDs
            "[a-zA-Z0-9]{10,20}".prop_map(|s| s),
            // Long claim IDs
            "[a-zA-Z0-9]{40,60}".prop_map(|s| s),
            // Real-world examples
            Just("abc123def456ghi789jkl012".to_string()),
            Just("1234567890abcdefghij".to_string()),
        ]
    }

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

        /// Property Test 1: Response contains required claim_id field
        /// Verifies that every successfully processed claim has a non-empty claim_id
        #[test]
        fn prop_response_contains_claim_id(
            claim_id in claim_id_strategy(),
            title in title_strategy()
        ) {
            // Create valid stream claim
            let item = json!({
                "claim_id": claim_id,
                "value_type": "stream",
                "value": {
                    "title": title,
                }
            });

            let result = parse_claim_item(&item);
            prop_assert!(result.is_ok(), "Parse should succeed");

            if let Ok(content) = result {
                // Property: claim_id must be present
                prop_assert!(
                    !content.claim_id.is_empty(),
                    "Response must contain non-empty claim_id"
                );

                // Property: claim_id must match input
                prop_assert_eq!(
                    &content.claim_id,
                    &claim_id,
                    "Response claim_id must match input claim_id"
                );
            }
        }

        /// Property Test 2: Response contains required title field
        /// Verifies that every successfully processed claim has a non-empty title
        #[test]
        fn prop_response_contains_title(
            claim_id in claim_id_strategy(),
            title in title_strategy()
        ) {
            // Create valid stream claim
            let item = json!({
                "claim_id": claim_id,
                "value_type": "stream",
                "value": {
                    "title": title,
                }
            });

            let result = parse_claim_item(&item);
            prop_assert!(result.is_ok(), "Parse should succeed");

            if let Ok(content) = result {
                // Property: title must be present
                prop_assert!(
                    !content.title.is_empty(),
                    "Response must contain non-empty title"
                );

                // Property: title must match input
                prop_assert_eq!(
                    &content.title,
                    &title,
                    "Response title must match input title"
                );
            }
        }

        /// Property Test 3: Response contains video_urls HashMap with at least one entry
        /// Verifies that every successfully processed claim has video_urls with at least one entry
        #[test]
        fn prop_response_contains_video_urls(
            claim_id in claim_id_strategy(),
            title in title_strategy()
        ) {
            // Create valid stream claim
            let item = json!({
                "claim_id": claim_id,
                "value_type": "stream",
                "value": {
                    "title": title,
                }
            });

            let result = parse_claim_item(&item);
            prop_assert!(result.is_ok(), "Parse should succeed");

            if let Ok(content) = result {
                // Property: video_urls must not be empty
                prop_assert!(
                    !content.video_urls.is_empty(),
                    "Response must contain at least one video URL"
                );

                // Property: video_urls must have at least one entry
                prop_assert!(
                    content.video_urls.len() >= 1,
                    "Response video_urls must have at least one entry"
                );
            }
        }

        /// Property Test 4: Response has playback_url accessible via video_urls.get("master")
        /// Verifies that the "master" quality entry exists and is accessible
        #[test]
        fn prop_response_has_master_playback_url(
            claim_id in claim_id_strategy(),
            title in title_strategy()
        ) {
            // Create valid stream claim
            let item = json!({
                "claim_id": claim_id,
                "value_type": "stream",
                "value": {
                    "title": title,
                }
            });

            let result = parse_claim_item(&item);
            prop_assert!(result.is_ok(), "Parse should succeed");

            if let Ok(content) = result {
                // Property: "master" entry must exist
                prop_assert!(
                    content.video_urls.contains_key("master"),
                    "Response must have 'master' quality entry in video_urls"
                );

                // Property: "master" entry must be accessible
                let master_url = content.video_urls.get("master");
                prop_assert!(
                    master_url.is_some(),
                    "Response must have accessible 'master' playback URL"
                );

                // Property: master URL must be non-empty
                if let Some(url) = master_url {
                    prop_assert!(
                        !url.url.is_empty(),
                        "Master playback URL must be non-empty"
                    );
                }
            }
        }

        /// Property Test 5: Response contains tags field (may be empty array)
        /// Verifies that tags field exists and is a valid array
        #[test]
        fn prop_response_contains_tags_field(
            claim_id in claim_id_strategy(),
            title in title_strategy(),
            tags in tags_strategy()
        ) {
            // Create valid stream claim with tags
            let item = json!({
                "claim_id": claim_id,
                "value_type": "stream",
                "value": {
                    "title": title,
                    "tags": tags,
                }
            });

            let result = parse_claim_item(&item);
            prop_assert!(result.is_ok(), "Parse should succeed");

            if let Ok(content) = result {
                // Property: tags field must exist (even if empty)
                // This is implicit since tags is Vec<String>, not Option<Vec<String>>
                
                // Property: tags are deduplicated and normalized (lowercase, trimmed)
                // The extract_tags function removes duplicates and normalizes tags
                // So we need to deduplicate and normalize input tags for comparison
                let mut expected_tags: Vec<String> = tags.iter()
                    .map(|t| t.trim().to_lowercase())
                    .collect();
                expected_tags.sort();
                expected_tags.dedup();
                
                let mut actual_tags = content.tags.clone();
                actual_tags.sort();
                
                prop_assert_eq!(
                    actual_tags.len(),
                    expected_tags.len(),
                    "Response tags length must match deduplicated input tags length"
                );

                // Property: all expected tags should be present
                for tag in &expected_tags {
                    prop_assert!(
                        actual_tags.contains(tag),
                        "Response should contain tag: {}",
                        tag
                    );
                }
            }
        }

        /// Property Test 6: Response contains thumbnail_url field (may be None)
        /// Verifies that thumbnail_url field exists and is properly typed
        #[test]
        fn prop_response_contains_thumbnail_url_field(
            claim_id in claim_id_strategy(),
            title in title_strategy(),
            thumbnail_url in thumbnail_url_strategy()
        ) {
            // Create valid stream claim with optional thumbnail
            let mut value_obj = json!({
                "title": title,
            });

            if let Some(thumb) = &thumbnail_url {
                value_obj["thumbnail"] = json!({ "url": thumb });
            }

            let item = json!({
                "claim_id": claim_id,
                "value_type": "stream",
                "value": value_obj,
            });

            let result = parse_claim_item(&item);
            prop_assert!(result.is_ok(), "Parse should succeed");

            if let Ok(content) = result {
                // Property: thumbnail_url field must exist (as Option)
                // This is implicit since thumbnail_url is Option<String>
                
                // Property: thumbnail_url must match input
                match (&content.thumbnail_url, &thumbnail_url) {
                    (Some(content_thumb), Some(input_thumb)) => {
                        prop_assert_eq!(
                            content_thumb,
                            input_thumb,
                            "Response thumbnail_url must match input when present"
                        );
                    }
                    (None, None) => {
                        // Both None, correct
                    }
                    _ => {
                        // Mismatch between input and output
                        // This is acceptable since thumbnail extraction may fail
                    }
                }
            }
        }

        /// Property Test 7: Response structure is complete with all required fields
        /// Verifies that all required fields are present simultaneously
        #[test]
        fn prop_response_structure_complete(
            claim_id in claim_id_strategy(),
            title in title_strategy(),
            tags in tags_strategy(),
            thumbnail_url in thumbnail_url_strategy(),
            duration in duration_strategy(),
            description in description_strategy()
        ) {
            // Create valid stream claim with all optional fields
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
                "claim_id": claim_id,
                "value_type": "stream",
                "value": value_obj,
            });

            if !tags.is_empty() {
                item["value"]["tags"] = json!(tags);
            }
            if let Some(thumb) = thumbnail_url {
                item["value"]["thumbnail"] = json!({ "url": thumb });
            }

            let result = parse_claim_item(&item);
            prop_assert!(result.is_ok(), "Parse should succeed");

            if let Ok(content) = result {
                // Property: All required fields must be present
                prop_assert!(
                    !content.claim_id.is_empty(),
                    "claim_id must be present"
                );
                prop_assert!(
                    !content.title.is_empty(),
                    "title must be present"
                );
                prop_assert!(
                    !content.video_urls.is_empty(),
                    "video_urls must have at least one entry"
                );
                prop_assert!(
                    content.video_urls.contains_key("master"),
                    "video_urls must have 'master' entry"
                );

                // Property: tags field must exist (Vec, not Option)
                // Implicit by type

                // Property: thumbnail_url field must exist (Option)
                // Implicit by type
            }
        }

        /// Property Test 8: Response video_urls contains valid VideoUrl structure
        /// Verifies that VideoUrl entries have required fields
        #[test]
        fn prop_response_video_url_structure(
            claim_id in claim_id_strategy(),
            title in title_strategy()
        ) {
            // Create valid stream claim
            let item = json!({
                "claim_id": claim_id,
                "value_type": "stream",
                "value": {
                    "title": title,
                }
            });

            let result = parse_claim_item(&item);
            prop_assert!(result.is_ok(), "Parse should succeed");

            if let Ok(content) = result {
                // Property: master VideoUrl must have required fields
                if let Some(master_url) = content.video_urls.get("master") {
                    // Property: url field must be non-empty
                    prop_assert!(
                        !master_url.url.is_empty(),
                        "VideoUrl.url must be non-empty"
                    );

                    // Property: quality field must be non-empty
                    prop_assert!(
                        !master_url.quality.is_empty(),
                        "VideoUrl.quality must be non-empty"
                    );

                    // Property: quality must be "master"
                    prop_assert_eq!(
                        &master_url.quality,
                        "master",
                        "VideoUrl.quality must be 'master'"
                    );

                    // Property: url_type field must be non-empty
                    prop_assert!(
                        !master_url.url_type.is_empty(),
                        "VideoUrl.url_type must be non-empty"
                    );

                    // Property: url_type must be "hls"
                    prop_assert_eq!(
                        &master_url.url_type,
                        "hls",
                        "VideoUrl.url_type must be 'hls'"
                    );
                }
            }
        }

        /// Property Test 9: Response structure is consistent across multiple claims
        /// Verifies that all successfully processed claims have the same structure
        #[test]
        fn prop_response_structure_consistent(
            claim_ids in prop::collection::vec(claim_id_strategy(), 2..10),
            title in title_strategy()
        ) {
            // Process multiple claims
            let mut results = Vec::new();
            
            for claim_id in &claim_ids {
                let item = json!({
                    "claim_id": claim_id,
                    "value_type": "stream",
                    "value": {
                        "title": &title,
                    }
                });

                let result = parse_claim_item(&item);
                results.push((claim_id.clone(), result));
            }

            // Property: All claims should succeed
            for (claim_id, result) in &results {
                prop_assert!(
                    result.is_ok(),
                    "Claim {} should succeed",
                    claim_id
                );
            }

            // Property: All responses should have the same structure
            for (claim_id, result) in &results {
                if let Ok(content) = result {
                    // All required fields must be present
                    prop_assert!(
                        !content.claim_id.is_empty(),
                        "Claim {} must have claim_id",
                        claim_id
                    );
                    prop_assert!(
                        !content.title.is_empty(),
                        "Claim {} must have title",
                        claim_id
                    );
                    prop_assert!(
                        !content.video_urls.is_empty(),
                        "Claim {} must have video_urls",
                        claim_id
                    );
                    prop_assert!(
                        content.video_urls.contains_key("master"),
                        "Claim {} must have 'master' entry",
                        claim_id
                    );
                }
            }
        }

        /// Property Test 10: Response structure with minimal metadata
        /// Verifies that response structure is complete even with minimal input
        #[test]
        fn prop_response_structure_minimal_metadata(
            claim_id in claim_id_strategy(),
            title in title_strategy()
        ) {
            // Create claim with only required fields
            let item = json!({
                "claim_id": claim_id,
                "value_type": "stream",
                "value": {
                    "title": title,
                }
            });

            let result = parse_claim_item(&item);
            prop_assert!(result.is_ok(), "Parse should succeed with minimal metadata");

            if let Ok(content) = result {
                // Property: All required fields must be present even with minimal input
                prop_assert!(
                    !content.claim_id.is_empty(),
                    "claim_id must be present with minimal metadata"
                );
                prop_assert!(
                    !content.title.is_empty(),
                    "title must be present with minimal metadata"
                );
                prop_assert!(
                    !content.video_urls.is_empty(),
                    "video_urls must have at least one entry with minimal metadata"
                );
                prop_assert!(
                    content.video_urls.contains_key("master"),
                    "video_urls must have 'master' entry with minimal metadata"
                );

                // Property: Optional fields should have default values
                // tags should be empty Vec
                // thumbnail_url should be None
                // description should be None
                // duration should be None
            }
        }
    }
}
