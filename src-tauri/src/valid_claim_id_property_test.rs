/// Property-Based Tests for Valid claim_id CDN Playback URL Generation
///
/// **Feature: odysee-cdn-playback-standardization, Property 2: Valid claim_id Always Produces CDN Playback URL**
///
/// For any claim metadata containing a non-empty claim_id string and stream type, the CDN builder
/// should produce a playback URL that:
/// - Is a non-empty string
/// - Starts with the configured gateway base URL
/// - Contains the claim_id in the path
/// - Ends with `/master.m3u8`
/// - Produces the same URL when called multiple times with the same inputs (deterministic)
///
/// **Validates: Requirements 1.1, 1.2, 1.4**
#[cfg(test)]
mod valid_claim_id_property_tests {
    use crate::commands::{get_cdn_gateway, parse_claim_item};
    use proptest::prelude::*;
    use serde_json::json;

    /// Strategy for generating valid claim IDs (alphanumeric, 20-40 chars)
    fn claim_id_strategy() -> impl Strategy<Value = String> {
        prop_oneof![
            // Standard claim IDs (alphanumeric, typical length)
            "[a-zA-Z0-9]{20,40}".prop_map(|s| s),
            // Short claim IDs
            "[a-zA-Z0-9]{10,20}".prop_map(|s| s),
            // Long claim IDs
            "[a-zA-Z0-9]{40,60}".prop_map(|s| s),
            // Claim IDs with mixed case
            "[a-z]{10,20}[A-Z]{10,20}".prop_map(|s| s),
            // Claim IDs with numbers only
            "[0-9]{20,40}".prop_map(|s| s),
            // Real-world examples
            Just("abc123def456ghi789jkl012".to_string()),
            Just("1234567890abcdefghij".to_string()),
            Just("ClaimIdWithMixedCase123".to_string()),
            Just("a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6".to_string()),
        ]
    }

    /// Strategy for generating valid titles
    fn title_strategy() -> impl Strategy<Value = String> {
        prop_oneof![
            "[A-Za-z0-9 ]{5,100}", // Normal titles
            Just("Test Movie".to_string()),
            Just("Series Episode 1".to_string()),
            Just("Documentary Film".to_string()),
            Just("Action Movie 2024".to_string()),
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
                Just("action".to_string()),
                Just("comedy".to_string()),
                "[a-z_]{3,20}",
            ],
            0..10,
        )
    }

    /// Strategy for generating optional thumbnail URLs
    fn thumbnail_url_strategy() -> impl Strategy<Value = Option<String>> {
        prop_oneof![
            Just(None),
            Just(Some(
                "https://thumbnails.odysee.com/thumb123.jpg".to_string()
            )),
            Just(Some("https://cdn.example.com/image.png".to_string())),
            Just(Some("https://spee.ch/thumbnail.webp".to_string())),
        ]
    }

    /// Strategy for generating optional duration
    fn duration_strategy() -> impl Strategy<Value = Option<u32>> {
        prop_oneof![
            Just(None),
            (60u32..7200u32).prop_map(Some),
            Just(Some(120)),
            Just(Some(3600)),
        ]
    }

    /// Strategy for generating optional description
    fn description_strategy() -> impl Strategy<Value = Option<String>> {
        prop_oneof![
            Just(None),
            Just(Some("A great movie about adventure".to_string())),
            Just(Some("Documentary exploring nature".to_string())),
            Just(Some("".to_string())),
        ]
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100))]

        /// Property Test 1: Valid claim_id with explicit stream type produces CDN URL
        /// Verifies that any valid claim_id with value_type="stream" produces a valid CDN playback URL
        #[test]
        fn prop_valid_claim_id_produces_cdn_url(
            claim_id in claim_id_strategy(),
            title in title_strategy(),
            tags in tags_strategy(),
            thumbnail_url in thumbnail_url_strategy(),
            duration in duration_strategy(),
            description in description_strategy()
        ) {
            // Create claim with valid claim_id and explicit stream type
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

            // Property: Should succeed and return ContentItem
            let result = parse_claim_item(&item);
            prop_assert!(
                result.is_ok(),
                "Valid claim_id with stream type should succeed. claim_id: {}, Error: {:?}",
                claim_id,
                result.err()
            );

            if let Ok(content) = result {
                // Property: Should have claim_id
                prop_assert_eq!(&content.claim_id, &claim_id, "Claim ID should match");

                // Property: Should have title
                prop_assert_eq!(&content.title, &title, "Title should match");

                // Property: Should have at least one video URL
                prop_assert!(
                    !content.video_urls.is_empty(),
                    "Should have at least one video URL"
                );

                // Property: Should have "master" quality entry
                prop_assert!(
                    content.video_urls.contains_key("master"),
                    "Should have 'master' quality entry"
                );

                // Property: CDN URL should be non-empty
                if let Some(master_url) = content.video_urls.get("master") {
                    prop_assert!(
                        !master_url.url.is_empty(),
                        "CDN URL should be non-empty"
                    );

                    // Property: CDN URL should start with gateway base URL
                    prop_assert!(
                        master_url.url.starts_with("https://"),
                        "CDN URL should start with https://"
                    );

                    // Property: CDN URL should contain the claim_id
                    prop_assert!(
                        master_url.url.contains(&claim_id),
                        "CDN URL should contain claim_id. claim_id: {}, URL: {}",
                        claim_id,
                        master_url.url
                    );

                    // Property: CDN URL should end with master.m3u8
                    prop_assert!(
                        master_url.url.ends_with("master.m3u8"),
                        "CDN URL should end with master.m3u8. Got: {}",
                        master_url.url
                    );

                    // Property: CDN URL should contain /content/ path
                    prop_assert!(
                        master_url.url.contains("/content/"),
                        "CDN URL should contain /content/ path. Got: {}",
                        master_url.url
                    );

                    // Property: URL type should be "hls"
                    prop_assert_eq!(
                        &master_url.url_type,
                        "hls",
                        "URL type should be 'hls'"
                    );

                    // Property: Quality should be "master"
                    prop_assert_eq!(
                        &master_url.quality,
                        "master",
                        "Quality should be 'master'"
                    );
                }
            }
        }

        /// Property Test 2: Valid claim_id produces deterministic CDN URL
        /// Verifies that the same claim_id produces the same CDN URL when processed multiple times
        #[test]
        fn prop_valid_claim_id_deterministic(
            claim_id in claim_id_strategy(),
            title in title_strategy()
        ) {
            // Create claim with valid claim_id
            let item = json!({
                "claim_id": claim_id,
                "value_type": "stream",
                "value": {
                    "title": title,
                }
            });

            // Process the same claim multiple times
            let result1 = parse_claim_item(&item);
            let result2 = parse_claim_item(&item);
            let result3 = parse_claim_item(&item);

            // Property: All results should succeed
            prop_assert!(result1.is_ok(), "First parse should succeed");
            prop_assert!(result2.is_ok(), "Second parse should succeed");
            prop_assert!(result3.is_ok(), "Third parse should succeed");

            // Property: All should produce identical CDN URLs
            let url1 = result1.unwrap().video_urls.get("master").unwrap().url.clone();
            let url2 = result2.unwrap().video_urls.get("master").unwrap().url.clone();
            let url3 = result3.unwrap().video_urls.get("master").unwrap().url.clone();

            prop_assert_eq!(
                &url1,
                &url2,
                "First and second parse should produce identical URLs"
            );
            prop_assert_eq!(
                &url2,
                &url3,
                "Second and third parse should produce identical URLs"
            );
        }

        /// Property Test 3: Valid claim_id with inferred stream type produces CDN URL
        /// Verifies that claims with source.sd_hash but no explicit value_type produce CDN URLs
        #[test]
        fn prop_valid_claim_id_inferred_stream_type(
            claim_id in claim_id_strategy(),
            title in title_strategy()
        ) {
            // Create claim with valid claim_id and inferred stream type (has source.sd_hash)
            let item = json!({
                "claim_id": claim_id,
                "value": {
                    "title": title,
                    "source": {
                        "sd_hash": "abc123def456ghi789jkl012mno345pqr678stu901vwx234yz"
                    }
                }
            });

            // Property: Should succeed with inferred stream type
            let result = parse_claim_item(&item);
            prop_assert!(
                result.is_ok(),
                "Valid claim_id with inferred stream type should succeed. Error: {:?}",
                result.err()
            );

            if let Ok(content) = result {
                // Property: Should have CDN URL
                prop_assert!(
                    content.video_urls.contains_key("master"),
                    "Should have CDN-constructed master URL"
                );

                // Property: CDN URL should contain claim_id
                if let Some(master_url) = content.video_urls.get("master") {
                    prop_assert!(
                        master_url.url.contains(&claim_id),
                        "CDN URL should contain claim_id"
                    );
                }
            }
        }

        /// Property Test 4: CDN URL format follows expected pattern
        /// Verifies that generated CDN URLs follow the pattern: {gateway}/content/{claim_id}/master.m3u8
        #[test]
        fn prop_cdn_url_format_pattern(
            claim_id in claim_id_strategy(),
            title in title_strategy()
        ) {
            // Create claim with valid claim_id
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
                if let Some(master_url) = content.video_urls.get("master") {
                    // Property: URL should match pattern {gateway}/content/{claim_id}/master.m3u8
                    let expected_pattern = format!("/content/{}/master.m3u8", claim_id);
                    prop_assert!(
                        master_url.url.contains(&expected_pattern),
                        "CDN URL should contain pattern /content/{}/master.m3u8. Got: {}",
                        claim_id,
                        master_url.url
                    );

                    // Property: URL should start with configured gateway
                    let gateway = get_cdn_gateway();
                    prop_assert!(
                        master_url.url.starts_with(gateway),
                        "CDN URL should start with gateway. Expected: {}, Got: {}",
                        gateway,
                        master_url.url
                    );
                }
            }
        }

        /// Property Test 5: Multiple valid claim_ids produce unique CDN URLs
        /// Verifies that different claim_ids produce different CDN URLs
        #[test]
        fn prop_multiple_claim_ids_unique_urls(
            claim_ids in prop::collection::vec(claim_id_strategy(), 2..10),
            title in title_strategy()
        ) {
            // Process multiple claims with different claim_ids
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

            // Property: Different claim_ids should produce different CDN URLs
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
                            "Different claim_ids should produce different CDN URLs. claim_id1: {}, claim_id2: {}",
                            claim_ids[i],
                            claim_ids[j]
                        );
                    }
                }
            }

            // Property: Same claim_id should produce same URL
            for i in 0..results.len() {
                for j in (i+1)..results.len() {
                    if claim_ids[i] == claim_ids[j] {
                        let url_i = results[i].1.as_ref().unwrap()
                            .video_urls.get("master").unwrap().url.clone();
                        let url_j = results[j].1.as_ref().unwrap()
                            .video_urls.get("master").unwrap().url.clone();

                        prop_assert_eq!(
                            url_i,
                            url_j,
                            "Same claim_id should produce identical CDN URLs"
                        );
                    }
                }
            }
        }

        /// Property Test 6: CDN URL construction with minimal claim metadata
        /// Verifies that only claim_id and title are required for CDN URL generation
        #[test]
        fn prop_cdn_url_minimal_metadata(
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

            // Property: Should succeed with minimal metadata
            let result = parse_claim_item(&item);
            prop_assert!(
                result.is_ok(),
                "Should succeed with minimal metadata. Error: {:?}",
                result.err()
            );

            if let Ok(content) = result {
                // Property: Should have CDN URL
                prop_assert!(
                    content.video_urls.contains_key("master"),
                    "Should have CDN URL with minimal metadata"
                );

                // Property: CDN URL should be valid
                if let Some(master_url) = content.video_urls.get("master") {
                    prop_assert!(
                        !master_url.url.is_empty(),
                        "CDN URL should be non-empty"
                    );
                    prop_assert!(
                        master_url.url.contains(&claim_id),
                        "CDN URL should contain claim_id"
                    );
                }
            }
        }

        /// Property Test 7: CDN URL construction with maximal claim metadata
        /// Verifies that CDN URL generation works with all optional fields present
        #[test]
        fn prop_cdn_url_maximal_metadata(
            claim_id in claim_id_strategy(),
            title in title_strategy(),
            tags in tags_strategy(),
            thumbnail_url in thumbnail_url_strategy(),
            duration in duration_strategy(),
            description in description_strategy()
        ) {
            // Create claim with all optional fields
            let mut value_obj = json!({
                "title": title,
                "tags": tags,
            });

            if let Some(desc) = description {
                value_obj["description"] = json!(desc);
            }
            if let Some(dur) = duration {
                value_obj["video"] = json!({ "duration": dur });
            }
            if let Some(thumb) = thumbnail_url {
                value_obj["thumbnail"] = json!({ "url": thumb });
            }

            let item = json!({
                "claim_id": claim_id,
                "value_type": "stream",
                "value": value_obj,
                "release_time": 1234567890,
            });

            // Property: Should succeed with maximal metadata
            let result = parse_claim_item(&item);
            prop_assert!(
                result.is_ok(),
                "Should succeed with maximal metadata. Error: {:?}",
                result.err()
            );

            if let Ok(content) = result {
                // Property: Should have CDN URL
                prop_assert!(
                    content.video_urls.contains_key("master"),
                    "Should have CDN URL with maximal metadata"
                );

                // Property: CDN URL should be valid
                if let Some(master_url) = content.video_urls.get("master") {
                    prop_assert!(
                        master_url.url.contains(&claim_id),
                        "CDN URL should contain claim_id"
                    );
                    prop_assert!(
                        master_url.url.ends_with("master.m3u8"),
                        "CDN URL should end with master.m3u8"
                    );
                }
            }
        }

        /// Property Test 8: CDN URL construction is independent of metadata order
        /// Verifies that field order in JSON doesn't affect CDN URL generation
        #[test]
        fn prop_cdn_url_independent_of_field_order(
            claim_id in claim_id_strategy(),
            title in title_strategy()
        ) {
            // Create claim with fields in different orders
            let item1 = json!({
                "claim_id": claim_id,
                "value_type": "stream",
                "value": {
                    "title": title,
                }
            });

            let item2 = json!({
                "value_type": "stream",
                "claim_id": claim_id,
                "value": {
                    "title": title,
                }
            });

            let item3 = json!({
                "value": {
                    "title": title,
                },
                "value_type": "stream",
                "claim_id": claim_id,
            });

            // Property: All should succeed
            let result1 = parse_claim_item(&item1);
            let result2 = parse_claim_item(&item2);
            let result3 = parse_claim_item(&item3);

            prop_assert!(result1.is_ok(), "First order should succeed");
            prop_assert!(result2.is_ok(), "Second order should succeed");
            prop_assert!(result3.is_ok(), "Third order should succeed");

            // Property: All should produce identical CDN URLs
            let url1 = result1.unwrap().video_urls.get("master").unwrap().url.clone();
            let url2 = result2.unwrap().video_urls.get("master").unwrap().url.clone();
            let url3 = result3.unwrap().video_urls.get("master").unwrap().url.clone();

            prop_assert_eq!(&url1, &url2, "Different field orders should produce identical URLs");
            prop_assert_eq!(&url2, &url3, "Different field orders should produce identical URLs");
        }

        /// Property Test 9: CDN URL construction with special characters in claim_id
        /// Verifies that claim_ids with various characters are handled correctly
        #[test]
        fn prop_cdn_url_special_characters(
            base_claim_id in "[a-zA-Z0-9]{15,30}",
            title in title_strategy()
        ) {
            // Test with alphanumeric claim_id (most common case)
            let item = json!({
                "claim_id": base_claim_id,
                "value_type": "stream",
                "value": {
                    "title": title,
                }
            });

            let result = parse_claim_item(&item);

            // Property: Should succeed with alphanumeric claim_id
            prop_assert!(
                result.is_ok(),
                "Should succeed with alphanumeric claim_id. Error: {:?}",
                result.err()
            );

            if let Ok(content) = result {
                // Property: CDN URL should contain the claim_id
                if let Some(master_url) = content.video_urls.get("master") {
                    prop_assert!(
                        master_url.url.contains(&base_claim_id),
                        "CDN URL should contain claim_id exactly. claim_id: {}, URL: {}",
                        base_claim_id,
                        master_url.url
                    );
                }
            }
        }

        /// Property Test 10: CDN URL construction preserves claim_id exactly
        /// Verifies that the claim_id appears in the URL without modification
        #[test]
        fn prop_cdn_url_preserves_claim_id_exactly(
            claim_id in claim_id_strategy(),
            title in title_strategy()
        ) {
            // Create claim with valid claim_id
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
                if let Some(master_url) = content.video_urls.get("master") {
                    // Property: claim_id should appear exactly in the URL
                    let expected_pattern = format!("/content/{}/master.m3u8", claim_id);
                    prop_assert!(
                        master_url.url.contains(&expected_pattern),
                        "CDN URL should contain exact claim_id in pattern /content/{}/master.m3u8. claim_id: {}, URL: {}",
                        claim_id,
                        claim_id,
                        master_url.url
                    );

                    // Property: claim_id should not be modified (no encoding, no transformation)
                    prop_assert!(
                        master_url.url.contains(&claim_id),
                        "CDN URL should contain unmodified claim_id"
                    );
                }
            }
        }
    }
}
