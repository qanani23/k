#[cfg(test)]
mod database_optimization_tests {
    use crate::database::tests::create_test_database_with_ttl;
    use crate::models::{CacheQuery, CompatibilityInfo, ContentItem, VideoUrl};
    use chrono::Utc;
    use rusqlite::Connection;
    use std::collections::HashMap;

    fn create_test_content_item(
        claim_id: &str,
        tags: Vec<String>,
        release_time: i64,
    ) -> ContentItem {
        let mut video_urls = HashMap::new();
        video_urls.insert(
            "720p".to_string(),
            VideoUrl {
                url: format!("https://example.com/{}.mp4", claim_id),
                quality: "720p".to_string(),
                url_type: "mp4".to_string(),
                codec: Some("h264".to_string()),
            },
        );

        let mut item = ContentItem {
            claim_id: claim_id.to_string(),
            title: format!("Test Content {}", claim_id),
            description: Some(format!("Description for {}", claim_id)),
            tags,
            thumbnail_url: Some(format!("https://example.com/{}.jpg", claim_id)),
            duration: Some(3600),
            release_time,
            video_urls,
            compatibility: CompatibilityInfo::compatible(),
            etag: None,
            content_hash: None,
            raw_json: None,
        };

        item.update_content_hash();
        item
    }

    #[tokio::test]
    async fn test_indices_exist() {
        let (db, _temp_dir, db_path) = create_test_database_with_ttl(30 * 60);

        let indices = tokio::task::spawn_blocking(move || {
            let conn = Connection::open(&db_path).unwrap();

            let mut stmt = conn
                .prepare("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name")
                .unwrap();

            let rows = stmt.query_map([], |row| row.get::<_, String>(0)).unwrap();

            let mut index_names = Vec::new();
            for row in rows {
                index_names.push(row.unwrap());
            }

            index_names
        })
        .await
        .unwrap();

        // Verify critical indices exist for the tables we created
        assert!(
            indices.contains(&"idx_localcache_cleanup".to_string()),
            "Composite index for cleanup query should exist"
        );
        assert!(
            indices.contains(&"idx_localcache_tags_release".to_string()),
            "Composite index for tag filtering with time ordering should exist"
        );
        assert!(
            indices.contains(&"idx_localcache_ttl_tags".to_string()),
            "Composite index for TTL-based queries with tag filtering should exist"
        );
        assert!(
            indices.contains(&"idx_offline_meta_encrypted".to_string()),
            "Index on encrypted column should exist"
        );

        // Verify basic single-column indices
        assert!(
            indices.contains(&"idx_localcache_titleLower".to_string()),
            "Index on titleLower should exist"
        );
        assert!(
            indices.contains(&"idx_localcache_tags".to_string()),
            "Index on tags should exist"
        );
        assert!(
            indices.contains(&"idx_localcache_releaseTime".to_string()),
            "Index on releaseTime should exist"
        );
    }

    #[tokio::test]
    async fn test_query_uses_index() {
        let (db, _temp_dir, _db_path) = create_test_database_with_ttl(30 * 60);

        // Insert test data
        let now = Utc::now().timestamp();
        let items = vec![
            create_test_content_item("claim1", vec!["movie".to_string()], now - 1000),
            create_test_content_item("claim2", vec!["movie".to_string()], now - 2000),
            create_test_content_item("claim3", vec!["series".to_string()], now - 3000),
        ];

        db.store_content_items(items).await.unwrap();

        // Analyze a query that should use the composite index
        let query = "SELECT * FROM local_cache WHERE tags LIKE '%movie%' ORDER BY releaseTime DESC LIMIT 10";
        let plan = db.analyze_query(query).await.unwrap();

        // The query plan should mention using an index
        let plan_text = plan.join(" ");
        assert!(
            plan_text.to_lowercase().contains("index")
                || plan_text.to_lowercase().contains("using"),
            "Query should use an index. Plan: {:?}",
            plan
        );
    }

    #[tokio::test]
    async fn test_cleanup_query_performance() {
        let (db, _temp_dir, _db_path) = create_test_database_with_ttl(30 * 60);

        // Insert multiple items with different access patterns
        let now = Utc::now().timestamp();
        let mut items = Vec::new();
        for i in 0..50 {
            items.push(create_test_content_item(
                &format!("claim{}", i),
                vec!["movie".to_string()],
                now - (i * 100),
            ));
        }

        db.store_content_items(items).await.unwrap();

        // Analyze the cleanup query
        let cleanup_query =
            "SELECT claimId FROM local_cache ORDER BY lastAccessed ASC, accessCount ASC LIMIT 10";
        let plan = db.analyze_query(cleanup_query).await.unwrap();

        // The query plan should use the composite index for cleanup
        let plan_text = plan.join(" ");
        assert!(
            plan_text.to_lowercase().contains("index")
                || plan_text.contains("idx_localcache_cleanup"),
            "Cleanup query should use composite index. Plan: {:?}",
            plan
        );
    }

    #[tokio::test]
    async fn test_optimize_database() {
        let (db, _temp_dir, _db_path) = create_test_database_with_ttl(30 * 60);

        // Insert some test data
        let now = Utc::now().timestamp();
        let items = vec![
            create_test_content_item("claim1", vec!["movie".to_string()], now),
            create_test_content_item("claim2", vec!["series".to_string()], now),
        ];

        db.store_content_items(items).await.unwrap();

        // Run optimization
        let result = db.optimize().await;
        assert!(result.is_ok(), "Database optimization should succeed");
    }

    #[tokio::test]
    async fn test_tag_filtering_with_composite_index() {
        let (db, _temp_dir, _db_path) = create_test_database_with_ttl(30 * 60);

        // Insert items with different tags and release times
        let now = Utc::now().timestamp();
        let items = vec![
            create_test_content_item(
                "movie1",
                vec!["movie".to_string(), "action".to_string()],
                now - 1000,
            ),
            create_test_content_item(
                "movie2",
                vec!["movie".to_string(), "comedy".to_string()],
                now - 2000,
            ),
            create_test_content_item("series1", vec!["series".to_string()], now - 3000),
            create_test_content_item("movie3", vec!["movie".to_string()], now - 4000),
        ];

        db.store_content_items(items).await.unwrap();

        // Query with tag filter
        let query = CacheQuery {
            tags: Some(vec!["movie".to_string()]),
            text_search: None,
            order_by: Some("releaseTime DESC".to_string()),
            limit: Some(10),
            offset: None,
        };

        let results = db.get_cached_content(query).await.unwrap();

        // Should return 3 movies in descending order by release time
        assert_eq!(results.len(), 3, "Should return 3 movies");
        assert_eq!(
            results[0].claim_id, "movie1",
            "First result should be most recent"
        );
        assert_eq!(
            results[1].claim_id, "movie2",
            "Second result should be second most recent"
        );
        assert_eq!(
            results[2].claim_id, "movie3",
            "Third result should be oldest"
        );
    }

    #[tokio::test]
    async fn test_encrypted_filter_performance() {
        let (db, _temp_dir, _db_path) = create_test_database_with_ttl(30 * 60);

        // Analyze query that filters by encrypted status
        let query = "SELECT * FROM offline_meta WHERE encrypted = 1";
        let plan = db.analyze_query(query).await.unwrap();

        // The query plan should use the encrypted index
        let plan_text = plan.join(" ");
        assert!(
            plan_text.to_lowercase().contains("index") || plan_text.contains("encrypted"),
            "Encrypted filter query should use index. Plan: {:?}",
            plan
        );
    }
}
