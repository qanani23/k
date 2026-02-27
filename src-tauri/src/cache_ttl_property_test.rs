/// Property-Based Tests for Cache TTL Behavior
///
/// **Feature: kiyya-desktop-streaming, Property 2: Cache TTL Behavior**
///
/// For any cached content item, if the TTL has not expired, the item should be
/// returned from local cache without making a remote API call, and if the TTL
/// has expired, a fresh API call should be made and the cache updated.
///
/// Validates: Requirements 1.3, 7.6, 13.1
#[cfg(test)]
mod cache_ttl_property_tests {
    use crate::database::tests::create_test_database_with_ttl;
    use crate::models::{CacheQuery, CompatibilityInfo, ContentItem};
    use chrono::Utc;
    use proptest::prelude::*;
    use std::collections::HashMap;

    /// Helper to create a content item with specific claim_id
    fn create_content_item(claim_id: String, title: String) -> ContentItem {
        let mut item = ContentItem {
            claim_id,
            title,
            description: Some("Test description".to_string()),
            tags: vec!["movie".to_string()],
            thumbnail_url: Some("https://example.com/thumb.jpg".to_string()),
            duration: Some(3600),
            release_time: Utc::now().timestamp(),
            video_urls: HashMap::new(),
            compatibility: CompatibilityInfo {
                compatible: true,
                reason: None,
                fallback_available: false,
            },
            etag: None,
            content_hash: None,
            raw_json: None,
        };
        item.update_content_hash();
        item
    }

    /// Strategy for generating valid claim IDs
    fn claim_id_strategy() -> impl Strategy<Value = String> {
        "[a-f0-9]{40}".prop_map(|s| s)
    }

    /// Strategy for generating valid titles
    fn title_strategy() -> impl Strategy<Value = String> {
        "[A-Za-z0-9 ]{5,50}".prop_map(|s| s)
    }

    /// Strategy for generating TTL values (in seconds)
    fn ttl_strategy() -> impl Strategy<Value = i64> {
        prop_oneof![
            Just(10),   // 10 seconds (short but reasonable)
            Just(60),   // 1 minute
            Just(300),  // 5 minutes
            Just(1800), // 30 minutes (default)
            Just(3600), // 1 hour
        ]
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(20))]

        /// Property: Content within TTL should be returned from cache
        #[test]
        fn prop_content_within_ttl_returned_from_cache(
            claim_id in claim_id_strategy(),
            title in title_strategy(),
            ttl_seconds in ttl_strategy(),
        ) {
            let runtime = tokio::runtime::Runtime::new().unwrap();
            runtime.block_on(async {
                let (db, _temp_dir, _db_path) = create_test_database_with_ttl(ttl_seconds);

                // Store content item
                let item = create_content_item(claim_id.clone(), title.clone());
                db.store_content_items(vec![item]).await.unwrap();

                // Immediately query (should be within TTL)
                let query = CacheQuery {
                    tags: None,
                    text_search: None,
                    limit: Some(10),
                    offset: Some(0),
                    order_by: Some("releaseTime DESC".to_string()),
                };

                let results = db.get_cached_content(query).await.unwrap();

                // Property: Content should be returned from cache
                prop_assert_eq!(results.len(), 1, "Content within TTL should be returned");
                prop_assert_eq!(&results[0].claim_id, &claim_id, "Correct content should be returned");
                prop_assert_eq!(&results[0].title, &title, "Content title should match");

                Ok(())
            })?;
        }

        /// Property: Content beyond TTL should not be returned from cache
        #[test]
        fn prop_content_beyond_ttl_not_returned(
            claim_id in claim_id_strategy(),
            title in title_strategy(),
            ttl_seconds in ttl_strategy(),
        ) {
            let runtime = tokio::runtime::Runtime::new().unwrap();
            runtime.block_on(async {
                let (db, _temp_dir, db_path) = create_test_database_with_ttl(ttl_seconds);

                // Store content item
                let item = create_content_item(claim_id.clone(), title.clone());
                db.store_content_items(vec![item]).await.unwrap();

                // Manually set the updatedAt timestamp to be beyond TTL
                let expired_timestamp = Utc::now().timestamp() - ttl_seconds - 1;
                let test_claim_id = claim_id.clone();

                tokio::task::spawn_blocking(move || {
                    let conn = rusqlite::Connection::open(&db_path).unwrap();
                    conn.execute(
                        "UPDATE local_cache SET updatedAt = ?1 WHERE claimId = ?2",
                        rusqlite::params![expired_timestamp, test_claim_id]
                    ).unwrap();
                }).await.unwrap();

                // Query should not return expired content
                let query = CacheQuery {
                    tags: None,
                    text_search: None,
                    limit: Some(10),
                    offset: Some(0),
                    order_by: Some("releaseTime DESC".to_string()),
                };

                let results = db.get_cached_content(query).await.unwrap();

                // Property: Expired content should not be returned
                prop_assert_eq!(results.len(), 0, "Content beyond TTL should not be returned");

                Ok(())
            })?;
        }

        /// Property: Cleanup should remove only expired items
        #[test]
        fn prop_cleanup_removes_only_expired_items(
            fresh_claim_id in claim_id_strategy(),
            expired_claim_id in claim_id_strategy(),
            ttl_seconds in ttl_strategy(),
        ) {
            // Ensure claim IDs are different
            prop_assume!(fresh_claim_id != expired_claim_id);

            let runtime = tokio::runtime::Runtime::new().unwrap();
            runtime.block_on(async {
                let (db, _temp_dir, db_path) = create_test_database_with_ttl(ttl_seconds);

                // Store two items
                let fresh_item = create_content_item(fresh_claim_id.clone(), "Fresh Item".to_string());
                let expired_item = create_content_item(expired_claim_id.clone(), "Expired Item".to_string());

                db.store_content_items(vec![fresh_item, expired_item]).await.unwrap();

                // Make one item expired
                let expired_timestamp = Utc::now().timestamp() - ttl_seconds - 1;
                let expired_id = expired_claim_id.clone();

                tokio::task::spawn_blocking(move || {
                    let conn = rusqlite::Connection::open(&db_path).unwrap();
                    conn.execute(
                        "UPDATE local_cache SET updatedAt = ?1 WHERE claimId = ?2",
                        rusqlite::params![expired_timestamp, expired_id]
                    ).unwrap();
                }).await.unwrap();

                // Run cleanup
                let removed_count = db.cleanup_expired_cache().await.unwrap();

                // Property: Exactly one item should be removed
                prop_assert_eq!(removed_count, 1, "Cleanup should remove exactly 1 expired item");

                // Verify fresh item is still there
                let query = CacheQuery {
                    tags: None,
                    text_search: None,
                    limit: Some(10),
                    offset: Some(0),
                    order_by: Some("releaseTime DESC".to_string()),
                };

                let results = db.get_cached_content(query).await.unwrap();
                prop_assert_eq!(results.len(), 1, "Fresh item should remain after cleanup");
                prop_assert_eq!(&results[0].claim_id, &fresh_claim_id, "Fresh item should be the one that remains");

                Ok(())
            })?;
        }

        /// Property: Multiple queries within TTL return consistent results
        #[test]
        fn prop_multiple_queries_within_ttl_consistent(
            claim_id in claim_id_strategy(),
            title in title_strategy(),
            ttl_seconds in ttl_strategy(),
            num_queries in 2..10usize,
        ) {
            let runtime = tokio::runtime::Runtime::new().unwrap();
            runtime.block_on(async {
                let (db, _temp_dir, _db_path) = create_test_database_with_ttl(ttl_seconds);

                // Store content item
                let item = create_content_item(claim_id.clone(), title.clone());
                db.store_content_items(vec![item]).await.unwrap();

                let query = CacheQuery {
                    tags: None,
                    text_search: None,
                    limit: Some(10),
                    offset: Some(0),
                    order_by: Some("releaseTime DESC".to_string()),
                };

                // Perform multiple queries
                let mut all_results = Vec::new();
                for _ in 0..num_queries {
                    let results = db.get_cached_content(query.clone()).await.unwrap();
                    all_results.push(results);
                }

                // Property: All queries should return the same content
                for results in &all_results {
                    prop_assert_eq!(results.len(), 1, "Each query should return 1 item");
                    prop_assert_eq!(&results[0].claim_id, &claim_id, "Each query should return the same item");
                }

                Ok(())
            })?;
        }

        /// Property: TTL boundary behavior is correct
        #[test]
        fn prop_ttl_boundary_behavior(
            claim_id in claim_id_strategy(),
            title in title_strategy(),
            ttl_seconds in ttl_strategy(),
        ) {
            let runtime = tokio::runtime::Runtime::new().unwrap();
            runtime.block_on(async {
                let (db, _temp_dir, db_path) = create_test_database_with_ttl(ttl_seconds);

                // Store content item
                let item = create_content_item(claim_id.clone(), title.clone());
                db.store_content_items(vec![item]).await.unwrap();

                let query = CacheQuery {
                    tags: None,
                    text_search: None,
                    limit: Some(10),
                    offset: Some(0),
                    order_by: Some("releaseTime DESC".to_string()),
                };

                // Test well beyond TTL boundary (should be expired)
                let expired_timestamp = Utc::now().timestamp() - ttl_seconds - 10;
                let test_claim_id = claim_id.clone();
                let db_path_clone = db_path.clone();

                tokio::task::spawn_blocking(move || {
                    let conn = rusqlite::Connection::open(&db_path_clone).unwrap();
                    conn.execute(
                        "UPDATE local_cache SET updatedAt = ?1 WHERE claimId = ?2",
                        rusqlite::params![expired_timestamp, test_claim_id]
                    ).unwrap();
                }).await.unwrap();

                let results = db.get_cached_content(query.clone()).await.unwrap();

                // Property: Content well beyond TTL should not be returned
                prop_assert_eq!(results.len(), 0, "Content beyond TTL boundary should not be returned");

                // Test well within TTL boundary (should be valid)
                let within_ttl = Utc::now().timestamp() - ttl_seconds + 10;
                let test_claim_id = claim_id.clone();

                tokio::task::spawn_blocking(move || {
                    let conn = rusqlite::Connection::open(&db_path).unwrap();
                    conn.execute(
                        "UPDATE local_cache SET updatedAt = ?1 WHERE claimId = ?2",
                        rusqlite::params![within_ttl, test_claim_id]
                    ).unwrap();
                }).await.unwrap();

                let results = db.get_cached_content(query).await.unwrap();

                // Property: Content well within TTL should be returned
                prop_assert_eq!(results.len(), 1, "Content within TTL boundary should be returned");

                Ok(())
            })?;
        }

        /// Property: Cache stats are updated correctly after operations
        #[test]
        fn prop_cache_stats_updated_correctly(
            claim_ids in prop::collection::vec(claim_id_strategy(), 1..5),
            ttl_seconds in ttl_strategy(),
        ) {
            let runtime = tokio::runtime::Runtime::new().unwrap();
            runtime.block_on(async {
                let (db, _temp_dir, _db_path) = create_test_database_with_ttl(ttl_seconds);

                // Store multiple items
                let items: Vec<ContentItem> = claim_ids.iter()
                    .map(|id| create_content_item(id.clone(), format!("Title {}", id)))
                    .collect();

                let item_count = items.len();
                db.store_content_items(items).await.unwrap();

                // Get cache stats
                let stats = db.get_cache_stats().await.unwrap();

                // Property: Total items should match stored count
                prop_assert_eq!(stats.total_items as usize, item_count, "Cache stats should reflect stored item count");

                Ok(())
            })?;
        }
    }
}
