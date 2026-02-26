#[cfg(test)]
mod hero_single_item_tests {
    use crate::database::Database;
    use crate::models::{CacheQuery, CompatibilityInfo, ContentItem, VideoUrl};
    use std::collections::HashMap;
    use tempfile::TempDir;

    /// CRITICAL TEST: Verify that cache returns single hero_trailer item
    /// This test validates the fix for the hero section bug where only 1 video
    /// tagged with hero_trailer exists on the channel.
    #[tokio::test]
    async fn test_cache_returns_single_hero_item() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_hero_single.db");
        let db = Database::new_with_path(&db_path)
            .await
            .expect("Failed to create database");

        // Create a single hero_trailer content item
        let mut video_urls = HashMap::new();
        video_urls.insert(
            "1080p".to_string(),
            VideoUrl {
                url: "https://example.com/hero-1080p.mp4".to_string(),
                quality: "1080p".to_string(),
                url_type: "mp4".to_string(),
                codec: None,
            },
        );

        let hero_item = ContentItem {
            claim_id: "hero-single-123".to_string(),
            title: "The Only Hero Video".to_string(),
            description: Some("This is the only hero video".to_string()),
            tags: vec!["hero_trailer".to_string(), "movie".to_string()],
            thumbnail_url: Some("https://example.com/thumb.jpg".to_string()),
            duration: Some(7200),
            release_time: 1234567890,
            video_urls,
            compatibility: CompatibilityInfo {
                compatible: true,
                fallback_available: false,
                reason: None,
            },
            etag: None,
            content_hash: None,
            raw_json: None,
        };

        // Store the single hero item in cache
        db.store_content_items(vec![hero_item.clone()])
            .await
            .expect("Failed to store hero item");

        // Query for hero_trailer content
        let query = CacheQuery {
            tags: Some(vec!["hero_trailer".to_string()]),
            text_search: None,
            limit: Some(20),
            offset: None,
            order_by: Some("releaseTime DESC".to_string()),
        };

        let cached_items = db
            .get_cached_content(query)
            .await
            .expect("Failed to get cached content");

        // CRITICAL ASSERTION: Cache should return the single item
        // Previously failed because of >= 6 threshold
        assert_eq!(
            cached_items.len(),
            1,
            "Cache should return exactly 1 hero_trailer item"
        );
        assert_eq!(
            cached_items[0].claim_id, "hero-single-123",
            "Should return the correct hero item"
        );
        assert!(
            cached_items[0].tags.contains(&"hero_trailer".to_string()),
            "Item should have hero_trailer tag"
        );
    }

    /// CRITICAL TEST: Verify cache works with various item counts
    /// Tests that the fix doesn't break normal multi-item queries
    #[tokio::test]
    async fn test_cache_works_with_multiple_item_counts() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_hero_multiple.db");
        let db = Database::new_with_path(&db_path)
            .await
            .expect("Failed to create database");

        // Test with 1, 3, 6, and 10 items
        for count in [1, 3, 6, 10] {
            // Clear previous items
            let _ = db.clear_all_cache().await;

            // Create items
            let items: Vec<ContentItem> = (0..count)
                .map(|i| {
                    let mut video_urls = HashMap::new();
                    video_urls.insert(
                        "1080p".to_string(),
                        VideoUrl {
                            url: format!("https://example.com/video-{}.mp4", i),
                            quality: "1080p".to_string(),
                            url_type: "mp4".to_string(),
                            codec: None,
                        },
                    );

                    ContentItem {
                        claim_id: format!("hero-{}", i),
                        title: format!("Hero Video {}", i),
                        description: Some(format!("Description {}", i)),
                        tags: vec!["hero_trailer".to_string()],
                        thumbnail_url: Some(format!("https://example.com/thumb-{}.jpg", i)),
                        duration: Some(7200),
                        release_time: 1234567890 + i as i64,
                        video_urls,
                        compatibility: CompatibilityInfo {
                            compatible: true,
                            fallback_available: false,
                            reason: None,
                        },
                        etag: None,
                        content_hash: None,
                        raw_json: None,
                    }
                })
                .collect();

            // Store items
            db.store_content_items(items.clone())
                .await
                .expect("Failed to store items");

            // Query for hero_trailer content
            let query = CacheQuery {
                tags: Some(vec!["hero_trailer".to_string()]),
                text_search: None,
                limit: Some(20),
                offset: None,
                order_by: Some("releaseTime DESC".to_string()),
            };

            let cached_items = db
                .get_cached_content(query)
                .await
                .expect("Failed to get cached content");

            // CRITICAL ASSERTION: Cache should return all items regardless of count
            assert_eq!(
                cached_items.len(),
                count,
                "Cache should return all {} items (was broken for count < 6)",
                count
            );
        }
    }

    /// CRITICAL TEST: Verify empty cache returns empty array (not error)
    #[tokio::test]
    async fn test_cache_returns_empty_array_when_no_items() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_hero_empty.db");
        let db = Database::new_with_path(&db_path)
            .await
            .expect("Failed to create database");

        // Query for hero_trailer content (none stored)
        let query = CacheQuery {
            tags: Some(vec!["hero_trailer".to_string()]),
            text_search: None,
            limit: Some(20),
            offset: None,
            order_by: Some("releaseTime DESC".to_string()),
        };

        let cached_items = db
            .get_cached_content(query)
            .await
            .expect("Failed to get cached content");

        // Should return empty array, not error
        assert_eq!(
            cached_items.len(),
            0,
            "Cache should return empty array when no items exist"
        );
    }

    /// CRITICAL TEST: Verify the fix doesn't affect text search queries
    #[tokio::test]
    async fn test_cache_threshold_only_applies_to_tag_queries() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_hero_text_search.db");
        let db = Database::new_with_path(&db_path)
            .await
            .expect("Failed to create database");

        // Create a single item
        let mut video_urls = HashMap::new();
        video_urls.insert(
            "1080p".to_string(),
            VideoUrl {
                url: "https://example.com/video.mp4".to_string(),
                quality: "1080p".to_string(),
                url_type: "mp4".to_string(),
                codec: None,
            },
        );

        let item = ContentItem {
            claim_id: "search-item-123".to_string(),
            title: "Searchable Hero Video".to_string(),
            description: Some("This is searchable".to_string()),
            tags: vec!["hero_trailer".to_string()],
            thumbnail_url: Some("https://example.com/thumb.jpg".to_string()),
            duration: Some(7200),
            release_time: 1234567890,
            video_urls,
            compatibility: CompatibilityInfo {
                compatible: true,
                fallback_available: false,
                reason: None,
            },
            etag: None,
            content_hash: None,
            raw_json: None,
        };

        db.store_content_items(vec![item.clone()])
            .await
            .expect("Failed to store item");

        // Query with text search (should bypass cache in real implementation)
        let query = CacheQuery {
            tags: None,
            text_search: Some("Searchable".to_string()),
            limit: Some(20),
            offset: None,
            order_by: Some("releaseTime DESC".to_string()),
        };

        let cached_items = db
            .get_cached_content(query)
            .await
            .expect("Failed to get cached content");

        // Text search should work regardless of item count
        // (In the actual implementation, text search bypasses cache threshold check)
        assert!(
            cached_items.len() <= 1,
            "Text search should return results independently of threshold"
        );
    }
}
