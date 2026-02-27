/// Property-Based Tests for CDN Builder Determinism
///
/// **Feature: odysee-cdn-playback-standardization, Property 7: CDN URL Construction Is Idempotent**
///
/// For any claim_id and gateway configuration, calling the CDN builder multiple times should
/// produce identical URLs (no randomness, no state dependency).
///
/// **Validates: Requirements 1.4**
#[cfg(test)]
mod cdn_builder_determinism_tests {
    use crate::commands::build_cdn_playback_url;
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
            // Claim IDs with mixed case
            "[a-z]{10,20}[A-Z]{10,20}".prop_map(|s| s),
            // Claim IDs with numbers
            "[0-9]{20,40}".prop_map(|s| s),
            // Real-world examples
            Just("abc123def456ghi789jkl012".to_string()),
            Just("1234567890abcdefghij".to_string()),
            Just("ClaimIdWithMixedCase123".to_string()),
        ]
    }

    /// Strategy for generating valid gateway URLs
    fn gateway_strategy() -> impl Strategy<Value = String> {
        prop_oneof![
            // Default gateway
            Just("https://cloud.odysee.live".to_string()),
            // Custom gateways
            Just("https://cdn.example.com".to_string()),
            Just("https://custom-gateway.net".to_string()),
            Just("https://gateway.odysee.com".to_string()),
            // Gateways with ports
            Just("https://localhost:8080".to_string()),
            Just("https://cdn.example.com:443".to_string()),
            // Gateways with paths (should work)
            Just("https://example.com/cdn".to_string()),
        ]
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100))]

        /// Property Test 1: CDN URL construction is idempotent with default gateway
        /// Verifies that calling build_cdn_playback_url multiple times with the same claim_id
        /// produces identical URLs when using the default gateway
        #[test]
        fn prop_cdn_url_idempotent_default_gateway(
            claim_id in claim_id_strategy(),
            iterations in 2usize..10usize
        ) {
            // Call build_cdn_playback_url multiple times with default gateway
            let default_gateway = "https://cloud.odysee.live";
            let urls: Vec<String> = (0..iterations)
                .map(|_| build_cdn_playback_url(&claim_id, default_gateway))
                .collect();

            // Property: All URLs should be identical
            let first_url = &urls[0];
            for (i, url) in urls.iter().enumerate().skip(1) {
                prop_assert_eq!(
                    url,
                    first_url,
                    "URL from iteration {} should match first URL. claim_id: {}",
                    i,
                    claim_id
                );
            }

            // Property: URL should be non-empty
            prop_assert!(
                !first_url.is_empty(),
                "Generated URL should not be empty"
            );
        }

        /// Property Test 2: CDN URL construction is idempotent with custom gateway
        /// Verifies that calling build_cdn_playback_url multiple times with the same claim_id
        /// and custom gateway produces identical URLs
        #[test]
        fn prop_cdn_url_idempotent_custom_gateway(
            claim_id in claim_id_strategy(),
            gateway in gateway_strategy(),
            iterations in 2usize..10usize
        ) {
            // Call build_cdn_playback_url multiple times with custom gateway
            let urls: Vec<String> = (0..iterations)
                .map(|_| build_cdn_playback_url(&claim_id, &gateway))
                .collect();

            // Property: All URLs should be identical
            let first_url = &urls[0];
            for (i, url) in urls.iter().enumerate().skip(1) {
                prop_assert_eq!(
                    url,
                    first_url,
                    "URL from iteration {} should match first URL. claim_id: {}, gateway: {}",
                    i,
                    claim_id,
                    gateway
                );
            }

            // Property: URL should be non-empty
            prop_assert!(
                !first_url.is_empty(),
                "Generated URL should not be empty"
            );
        }

        /// Property Test 3: CDN URL construction is deterministic across function calls
        /// Verifies that the same inputs always produce the same output
        #[test]
        fn prop_cdn_url_deterministic(
            claim_id in claim_id_strategy(),
            gateway in gateway_strategy()
        ) {
            // Generate URL twice with same inputs
            let url1 = build_cdn_playback_url(&claim_id, &gateway);
            let url2 = build_cdn_playback_url(&claim_id, &gateway);

            // Property: Both URLs should be identical
            prop_assert_eq!(
                url1,
                url2,
                "Same inputs should produce identical URLs. claim_id: {}, gateway: {}",
                claim_id,
                gateway
            );
        }

        /// Property Test 4: CDN URL format is consistent
        /// Verifies that generated URLs follow the expected pattern
        #[test]
        fn prop_cdn_url_format_consistent(
            claim_id in claim_id_strategy(),
            gateway in gateway_strategy()
        ) {
            let url = build_cdn_playback_url(&claim_id, &gateway);

            // Property: URL should start with gateway
            prop_assert!(
                url.starts_with(&gateway),
                "URL should start with gateway. Expected: {}, Got: {}",
                gateway,
                url
            );

            // Property: URL should contain the claim_id
            prop_assert!(
                url.contains(&claim_id),
                "URL should contain claim_id. claim_id: {}, URL: {}",
                claim_id,
                url
            );

            // Property: URL should end with master.m3u8
            prop_assert!(
                url.ends_with("master.m3u8"),
                "URL should end with master.m3u8. Got: {}",
                url
            );

            // Property: URL should contain /content/ path
            prop_assert!(
                url.contains("/content/"),
                "URL should contain /content/ path. Got: {}",
                url
            );
        }

        /// Property Test 5: CDN URL construction is independent of call order
        /// Verifies that the order of function calls doesn't affect the output
        #[test]
        fn prop_cdn_url_independent_of_call_order(
            claim_ids in prop::collection::vec(claim_id_strategy(), 2..5),
            gateway in gateway_strategy()
        ) {
            // Generate URLs in original order
            let urls_forward: Vec<String> = claim_ids.iter()
                .map(|id| build_cdn_playback_url(id, &gateway))
                .collect();

            // Generate URLs in reverse order
            let urls_backward: Vec<String> = claim_ids.iter().rev()
                .map(|id| build_cdn_playback_url(id, &gateway))
                .collect();

            // Property: Each claim_id should produce the same URL regardless of call order
            for (i, claim_id) in claim_ids.iter().enumerate() {
                let forward_url = &urls_forward[i];
                let backward_idx = claim_ids.len() - 1 - i;
                let backward_url = &urls_backward[backward_idx];

                prop_assert_eq!(
                    forward_url,
                    backward_url,
                    "URL for claim_id {} should be identical regardless of call order",
                    claim_id
                );
            }
        }

        /// Property Test 6: CDN URL construction has no side effects
        /// Verifies that calling the function doesn't modify any state
        #[test]
        fn prop_cdn_url_no_side_effects(
            claim_id in claim_id_strategy(),
            gateway in gateway_strategy()
        ) {
            // Generate URL multiple times
            let url1 = build_cdn_playback_url(&claim_id, &gateway);
            let url2 = build_cdn_playback_url(&claim_id, &gateway);
            let url3 = build_cdn_playback_url(&claim_id, &gateway);

            // Property: All URLs should be identical (no state changes)
            prop_assert_eq!(&url1, &url2, "First and second calls should produce identical URLs");
            prop_assert_eq!(&url2, &url3, "Second and third calls should produce identical URLs");
            prop_assert_eq!(&url1, &url3, "First and third calls should produce identical URLs");
        }

        /// Property Test 7: CDN URL construction is thread-safe
        /// Verifies that concurrent calls produce consistent results
        #[test]
        fn prop_cdn_url_thread_safe(
            claim_id in claim_id_strategy(),
            gateway in gateway_strategy()
        ) {
            use std::sync::Arc;
            use std::thread;

            let claim_id = Arc::new(claim_id);
            let gateway = Arc::new(gateway);
            let mut handles = vec![];

            // Spawn multiple threads to generate URLs
            for _ in 0..5 {
                let claim_id_clone = Arc::clone(&claim_id);
                let gateway_clone = Arc::clone(&gateway);
                let handle = thread::spawn(move || {
                    build_cdn_playback_url(&claim_id_clone, &gateway_clone)
                });
                handles.push(handle);
            }

            // Collect results
            let urls: Vec<String> = handles.into_iter()
                .map(|h| h.join().unwrap())
                .collect();

            // Property: All threads should produce identical URLs
            let first_url = &urls[0];
            for (i, url) in urls.iter().enumerate().skip(1) {
                prop_assert_eq!(
                    url,
                    first_url,
                    "Thread {} should produce identical URL",
                    i
                );
            }
        }

        /// Property Test 8: CDN URL construction preserves claim_id exactly
        /// Verifies that the claim_id appears in the URL without modification
        #[test]
        fn prop_cdn_url_preserves_claim_id(
            claim_id in claim_id_strategy(),
            gateway in gateway_strategy()
        ) {
            let url = build_cdn_playback_url(&claim_id, &gateway);

            // Property: URL should contain the exact claim_id
            prop_assert!(
                url.contains(&claim_id),
                "URL should contain exact claim_id. claim_id: {}, URL: {}",
                claim_id,
                url
            );

            // Property: claim_id should appear between /content/ and /master.m3u8
            let expected_pattern = format!("/content/{}/master.m3u8", claim_id);
            prop_assert!(
                url.contains(&expected_pattern),
                "URL should contain pattern /content/{}/master.m3u8. Got: {}",
                claim_id,
                url
            );
        }

        /// Property Test 9: CDN URL construction with default gateway
        /// Verifies that default gateway produces expected result
        #[test]
        fn prop_cdn_url_default_gateway(
            claim_id in claim_id_strategy()
        ) {
            let default_gateway = "https://cloud.odysee.live";
            let url = build_cdn_playback_url(&claim_id, default_gateway);

            // Property: URL should start with default gateway
            prop_assert!(
                url.starts_with(default_gateway),
                "URL should start with default gateway"
            );
        }

        /// Property Test 10: CDN URL construction is consistent across multiple claim_ids
        /// Verifies that each claim_id produces a unique but consistent URL
        #[test]
        fn prop_cdn_url_consistent_across_claim_ids(
            claim_ids in prop::collection::vec(claim_id_strategy(), 2..10),
            gateway in gateway_strategy()
        ) {
            // Generate URLs for all claim_ids
            let urls: Vec<String> = claim_ids.iter()
                .map(|id| build_cdn_playback_url(id, &gateway))
                .collect();

            // Property: Each claim_id should produce a consistent URL
            for (i, claim_id) in claim_ids.iter().enumerate() {
                let url_again = build_cdn_playback_url(claim_id, &gateway);
                prop_assert_eq!(
                    &urls[i],
                    &url_again,
                    "claim_id {} should produce consistent URL",
                    claim_id
                );
            }

            // Property: Different claim_ids should produce different URLs
            for i in 0..claim_ids.len() {
                for j in (i+1)..claim_ids.len() {
                    if claim_ids[i] != claim_ids[j] {
                        prop_assert_ne!(
                            &urls[i],
                            &urls[j],
                            "Different claim_ids should produce different URLs. claim_id1: {}, claim_id2: {}",
                            claim_ids[i],
                            claim_ids[j]
                        );
                    }
                }
            }
        }
    }
}
