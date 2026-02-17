/// Property-Based Tests for Missing Direct URLs
/// 
/// **Feature: odysee-cdn-playback-standardization, Property 1: Missing Direct URL Fields Do Not Cause Errors**
/// 
/// For any claim metadata that contains a valid claim_id and is a stream type but is missing
/// direct URL fields (hd_url, sd_url, streams, video.url), processing the claim should succeed
/// and return a valid ContentItem with CDN-constructed playback URL.
/// 
/// **Validates: Requirements 4.6, 4.7**

#[cfg(test)]
mod missing_direct_urls_property_tests {
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

    /// Strategy for generating optional sd_hash (for stream type inference)
    fn sd_hash_strategy() -> impl Strategy<Value = Option<String>> {
        prop_oneof![
            Just(Some("abc123def456ghi789jkl012mno345pqr678stu901vwx234yz".to_string())),
            "[a-f0-9]{96}".prop_map(Some),
        ]
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100))]

        /// Property Test 1: Missing all direct URL fields with explicit stream type
        /// Verifies that claims with value_type="stream" but no direct URLs succeed
        #[test]
        fn prop_missing_direct_urls_with_explicit_stream_type(
            claim_id in claim_id_strategy(),
            title in title_strategy(),
            tags in tags_strategy(),
            thumbnail_url in thumbnail_url_strategy(),
            duration in duration_strategy(),
            description in description_strategy()
        ) {
            // Create claim with explicit value_type="stream" but NO direct URL fields
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

            // Property: Should succeed and return ContentItem with CDN URL
            let result = parse_claim_item(&item);
            prop_assert!(
                result.is_ok(),
                "Should succeed with explicit stream type and no direct URLs. Error: {:?}",
                result.err()
            );

            if let Ok(content) = result {
                // Property: Should have claim_id
                prop_assert_eq!(&content.claim_id, &claim_id, "Claim ID should match");

                // Property: Should have title
                prop_assert_eq!(&content.title, &title, "Title should match");

                // Property: Should have at least one video URL (CDN URL)
                prop_assert!(
                    !content.video_urls.is_empty(),
                    "Should have at least one video URL (CDN-constructed)"
                );

                // Property: Should have "master" quality entry
                prop_assert!(
                    content.video_urls.contains_key("master"),
                    "Should have 'master' quality entry"
                );

                // Property: CDN URL should be valid
                if let Some(master_url) = content.video_urls.get("master") {
                    prop_assert!(
                        master_url.url.starts_with("https://"),
                        "CDN URL should start with https://"
                    );
                    prop_assert!(
                        master_url.url.contains(&claim_id),
                        "CDN URL should contain claim_id"
                    );
                    prop_assert!(
                        master_url.url.ends_with("master.m3u8"),
                        "CDN URL should end with master.m3u8"
                    );
                    prop_assert_eq!(
                        &master_url.url_type,
                        "hls",
                        "URL type should be 'hls'"
                    );
                    prop_assert_eq!(
                        &master_url.quality,
                        "master",
                        "Quality should be 'master'"
                    );
                }
            }
        }

        /// Property Test 2: Missing all direct URL fields with inferred stream type
        /// Verifies that claims with source.sd_hash but no value_type succeed
        #[test]
        fn prop_missing_direct_urls_with_inferred_stream_type(
            claim_id in claim_id_strategy(),
            title in title_strategy(),
            sd_hash in sd_hash_strategy()
        ) {
            // Create claim with NO value_type but HAS source.sd_hash (inferred stream)
            let mut value_obj = json!({
                "title": title,
            });

            // Add source with sd_hash for stream type inference
            let has_sd_hash = sd_hash.is_some();
            if let Some(hash) = sd_hash {
                value_obj["source"] = json!({
                    "sd_hash": hash
                });
            }

            let item = json!({
                "claim_id": claim_id,
                "value": value_obj,
            });

            let result = parse_claim_item(&item);

            // Property: Should succeed with inferred stream type
            if has_sd_hash {
                prop_assert!(
                    result.is_ok(),
                    "Should succeed with inferred stream type (has sd_hash). Error: {:?}",
                    result.err()
                );

                if let Ok(content) = result {
                    // Property: Should have CDN-constructed URL
                    prop_assert!(
                        !content.video_urls.is_empty(),
                        "Should have CDN-constructed video URL"
                    );
                    prop_assert!(
                        content.video_urls.contains_key("master"),
                        "Should have 'master' quality entry"
                    );
                }
            } else {
                // Without sd_hash and without value_type, should fail
                prop_assert!(
                    result.is_err(),
                    "Should fail without value_type and without sd_hash"
                );
            }
        }

        /// Property Test 3: Missing hd_url field specifically
        /// Verifies that missing hd_url doesn't cause errors
        #[test]
        fn prop_missing_hd_url_field(
            claim_id in claim_id_strategy(),
            title in title_strategy()
        ) {
            // Create claim with explicit stream type but specifically NO hd_url
            let item = json!({
                "claim_id": claim_id,
                "value_type": "stream",
                "value": {
                    "title": title,
                    // Explicitly no hd_url field
                }
            });

            let result = parse_claim_item(&item);

            // Property: Missing hd_url should not cause error
            prop_assert!(
                result.is_ok(),
                "Missing hd_url should not cause error. Error: {:?}",
                result.err()
            );

            if let Ok(content) = result {
                // Property: Should have CDN URL instead
                prop_assert!(
                    content.video_urls.contains_key("master"),
                    "Should have CDN-constructed master URL"
                );
            }
        }

        /// Property Test 4: Missing sd_url field specifically
        /// Verifies that missing sd_url doesn't cause errors
        #[test]
        fn prop_missing_sd_url_field(
            claim_id in claim_id_strategy(),
            title in title_strategy()
        ) {
            // Create claim with explicit stream type but specifically NO sd_url
            let item = json!({
                "claim_id": claim_id,
                "value_type": "stream",
                "value": {
                    "title": title,
                    // Explicitly no sd_url field
                }
            });

            let result = parse_claim_item(&item);

            // Property: Missing sd_url should not cause error
            prop_assert!(
                result.is_ok(),
                "Missing sd_url should not cause error. Error: {:?}",
                result.err()
            );

            if let Ok(content) = result {
                // Property: Should have CDN URL instead
                prop_assert!(
                    content.video_urls.contains_key("master"),
                    "Should have CDN-constructed master URL"
                );
            }
        }

        /// Property Test 5: Missing streams array field
        /// Verifies that missing streams array doesn't cause errors
        #[test]
        fn prop_missing_streams_array(
            claim_id in claim_id_strategy(),
            title in title_strategy()
        ) {
            // Create claim with explicit stream type but NO streams array
            let item = json!({
                "claim_id": claim_id,
                "value_type": "stream",
                "value": {
                    "title": title,
                    // Explicitly no streams array
                }
            });

            let result = parse_claim_item(&item);

            // Property: Missing streams array should not cause error
            prop_assert!(
                result.is_ok(),
                "Missing streams array should not cause error. Error: {:?}",
                result.err()
            );

            if let Ok(content) = result {
                // Property: Should have CDN URL instead
                prop_assert!(
                    content.video_urls.contains_key("master"),
                    "Should have CDN-constructed master URL"
                );
            }
        }

        /// Property Test 6: Missing video.url field
        /// Verifies that missing video.url doesn't cause errors
        #[test]
        fn prop_missing_video_url_field(
            claim_id in claim_id_strategy(),
            title in title_strategy(),
            duration in duration_strategy()
        ) {
            // Create claim with explicit stream type and video object but NO video.url
            let mut video_obj = json!({});
            if let Some(dur) = duration {
                video_obj["duration"] = json!(dur);
            }

            let item = json!({
                "claim_id": claim_id,
                "value_type": "stream",
                "value": {
                    "title": title,
                    "video": video_obj,
                    // Explicitly no video.url field
                }
            });

            let result = parse_claim_item(&item);

            // Property: Missing video.url should not cause error
            prop_assert!(
                result.is_ok(),
                "Missing video.url should not cause error. Error: {:?}",
                result.err()
            );

            if let Ok(content) = result {
                // Property: Should have CDN URL instead
                prop_assert!(
                    content.video_urls.contains_key("master"),
                    "Should have CDN-constructed master URL"
                );
            }
        }

        /// Property Test 7: Missing ALL direct URL fields simultaneously
        /// Verifies that missing all possible direct URL fields doesn't cause errors
        #[test]
        fn prop_missing_all_direct_url_fields(
            claim_id in claim_id_strategy(),
            title in title_strategy(),
            tags in tags_strategy()
        ) {
            // Create claim with explicit stream type but NO direct URL fields at all
            let item = json!({
                "claim_id": claim_id,
                "value_type": "stream",
                "value": {
                    "title": title,
                    "tags": tags,
                    // Explicitly no hd_url, sd_url, streams, video.url, 720p_url, etc.
                }
            });

            let result = parse_claim_item(&item);

            // Property: Missing all direct URL fields should not cause error
            prop_assert!(
                result.is_ok(),
                "Missing all direct URL fields should not cause error. Error: {:?}",
                result.err()
            );

            if let Ok(content) = result {
                // Property: Should have exactly one video URL (CDN master)
                prop_assert!(
                    !content.video_urls.is_empty(),
                    "Should have at least one video URL"
                );

                // Property: Should have "master" quality entry
                prop_assert!(
                    content.video_urls.contains_key("master"),
                    "Should have 'master' quality entry"
                );

                // Property: CDN URL should be properly formatted
                if let Some(master_url) = content.video_urls.get("master") {
                    let expected_pattern = format!("/content/{}/master.m3u8", claim_id);
                    prop_assert!(
                        master_url.url.contains(&expected_pattern),
                        "CDN URL should contain pattern /content/{}/master.m3u8",
                        claim_id
                    );
                }
            }
        }

        /// Property Test 8: Empty streams array (not missing, but empty)
        /// Verifies that empty streams array doesn't cause errors
        #[test]
        fn prop_empty_streams_array(
            claim_id in claim_id_strategy(),
            title in title_strategy()
        ) {
            // Create claim with explicit stream type and EMPTY streams array
            let item = json!({
                "claim_id": claim_id,
                "value_type": "stream",
                "value": {
                    "title": title,
                    "streams": [],  // Empty array, not missing
                }
            });

            let result = parse_claim_item(&item);

            // Property: Empty streams array should not cause error
            prop_assert!(
                result.is_ok(),
                "Empty streams array should not cause error. Error: {:?}",
                result.err()
            );

            if let Ok(content) = result {
                // Property: Should have CDN URL instead
                prop_assert!(
                    content.video_urls.contains_key("master"),
                    "Should have CDN-constructed master URL"
                );
            }
        }

        /// Property Test 9: Null direct URL fields
        /// Verifies that null direct URL fields don't cause errors
        #[test]
        fn prop_null_direct_url_fields(
            claim_id in claim_id_strategy(),
            title in title_strategy()
        ) {
            // Create claim with explicit stream type and NULL direct URL fields
            let item = json!({
                "claim_id": claim_id,
                "value_type": "stream",
                "value": {
                    "title": title,
                    "hd_url": null,
                    "sd_url": null,
                    "streams": null,
                }
            });

            let result = parse_claim_item(&item);

            // Property: Null direct URL fields should not cause error
            prop_assert!(
                result.is_ok(),
                "Null direct URL fields should not cause error. Error: {:?}",
                result.err()
            );

            if let Ok(content) = result {
                // Property: Should have CDN URL instead
                prop_assert!(
                    content.video_urls.contains_key("master"),
                    "Should have CDN-constructed master URL"
                );
            }
        }

        /// Property Test 10: CDN URL construction is consistent across multiple claims
        /// Verifies that each claim with missing direct URLs gets a consistent CDN URL
        #[test]
        fn prop_cdn_url_consistent_for_missing_direct_urls(
            claim_ids in prop::collection::vec(claim_id_strategy(), 2..10),
            title in title_strategy()
        ) {
            // Process multiple claims with missing direct URLs
            let mut results = Vec::new();
            
            for claim_id in &claim_ids {
                let item = json!({
                    "claim_id": claim_id,
                    "value_type": "stream",
                    "value": {
                        "title": &title,
                        // No direct URL fields
                    }
                });

                let result = parse_claim_item(&item);
                results.push((claim_id.clone(), result));
            }

            // Property: All claims should succeed
            for (claim_id, result) in &results {
                prop_assert!(
                    result.is_ok(),
                    "Claim {} should succeed with missing direct URLs",
                    claim_id
                );
            }

            // Property: Each claim should have a unique CDN URL based on its claim_id
            for i in 0..results.len() {
                for j in (i+1)..results.len() {
                    if claim_ids[i] != claim_ids[j] {
                        let url_i = results[i].1.as_ref().unwrap()
                            .video_urls.get("master").unwrap().url.clone();
                        let url_j = results[j].1.as_ref().unwrap()
                            .video_urls.get("master").unwrap().url.clone();
                        
                        prop_assert_ne!(
                            url_i,
                            url_j,
                            "Different claim_ids should produce different CDN URLs"
                        );
                    }
                }
            }
        }
    }
}
