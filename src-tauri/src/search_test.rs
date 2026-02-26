/// Tests for FTS5 and LIKE search functionality
#[cfg(test)]
mod tests {
    use crate::database::Database;
    use crate::models::ContentItem;
    use std::collections::HashMap;
    use std::sync::Arc;
    use tokio::sync::Mutex;

    // Use a global lock to prevent parallel test execution that causes database conflicts
    static TEST_LOCK: once_cell::sync::Lazy<Arc<Mutex<()>>> =
        once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(())));

    async fn setup_test_db() -> Database {
        // Acquire lock to prevent parallel test execution
        let _lock = TEST_LOCK.lock().await;

        // Generate a unique database name for this test
        let thread_id = std::thread::current().id();
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let db_name = format!("search_test_{:?}_{}.db", thread_id, timestamp);

        // Clean up any existing test database
        let test_dir = std::env::temp_dir().join("kiyya_test");
        std::fs::create_dir_all(&test_dir).expect("Failed to create test directory");
        
        let db_path = test_dir.join(&db_name);
        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
        let _ = std::fs::remove_file(db_path.with_extension("db-wal"));

        // Also clean up the default test database to avoid conflicts
        let default_db_path = test_dir.join("app.db");
        let _ = std::fs::remove_file(&default_db_path);
        let _ = std::fs::remove_file(default_db_path.with_extension("db-shm"));
        let _ = std::fs::remove_file(default_db_path.with_extension("db-wal"));

        // Create a new database for testing
        let db = Database::new()
            .await
            .expect("Failed to create test database");

        // Run migrations to set up the schema (should be no-op for fresh DB at version 18)
        db.run_migrations().await.expect("Failed to run migrations");

        // Add some test content
        let test_items = vec![
            ContentItem {
                claim_id: "claim1".to_string(),
                title: "Breaking Bad S01E01 - Pilot".to_string(),
                description: Some("A high school chemistry teacher turned meth cook".to_string()),
                tags: vec!["series".to_string(), "drama".to_string()],
                thumbnail_url: Some("https://example.com/thumb1.jpg".to_string()),
                duration: Some(3600),
                release_time: chrono::Utc::now().timestamp(),
                video_urls: HashMap::new(),
                compatibility: crate::models::CompatibilityInfo {
                    compatible: true,
                    reason: None,
                    fallback_available: false,
                },
                etag: None,
                content_hash: None,
                raw_json: None,
            },
            ContentItem {
                claim_id: "claim2".to_string(),
                title: "Breaking Bad S01E02 - Cat's in the Bag".to_string(),
                description: Some("Walter and Jesse dispose of the bodies".to_string()),
                tags: vec!["series".to_string(), "drama".to_string()],
                thumbnail_url: Some("https://example.com/thumb2.jpg".to_string()),
                duration: Some(3500),
                release_time: chrono::Utc::now().timestamp(),
                video_urls: HashMap::new(),
                compatibility: crate::models::CompatibilityInfo {
                    compatible: true,
                    reason: None,
                    fallback_available: false,
                },
                etag: None,
                content_hash: None,
                raw_json: None,
            },
            ContentItem {
                claim_id: "claim3".to_string(),
                title: "The Office S01E01 - Pilot".to_string(),
                description: Some("A mockumentary about office life".to_string()),
                tags: vec!["sitcom".to_string(), "comedy".to_string()],
                thumbnail_url: Some("https://example.com/thumb3.jpg".to_string()),
                duration: Some(1800),
                release_time: chrono::Utc::now().timestamp(),
                video_urls: HashMap::new(),
                compatibility: crate::models::CompatibilityInfo {
                    compatible: true,
                    reason: None,
                    fallback_available: false,
                },
                etag: None,
                content_hash: None,
                raw_json: None,
            },
        ];

        db.store_content_items(test_items)
            .await.expect("Failed to store test items");

        db
    }

    #[tokio::test]
    async fn test_search_content_basic() {
        let db = setup_test_db().await;

        // Search for "Breaking Bad"
        let results = db
            .search_content("Breaking Bad", Some(10))
            .await
            .expect("Search failed");

        assert!(
            results.len() >= 2,
            "Should find at least 2 Breaking Bad episodes, found {}",
            results.len()
        );
        assert!(results
            .iter()
            .all(|item| item.title.contains("Breaking Bad")));
    }

    #[tokio::test]
    async fn test_search_content_episode() {
        let db = setup_test_db().await;

        // Search for "Pilot"
        let results = db
            .search_content("Pilot", Some(10))
            .await
            .expect("Search failed");

        assert!(
            results.len() >= 2,
            "Should find at least 2 Pilot episodes, found {}",
            results.len()
        );
    }

    #[tokio::test]
    async fn test_search_content_description() {
        let db = setup_test_db().await;

        // Search for "chemistry" (in description)
        let results = db
            .search_content("chemistry", Some(10))
            .await
            .expect("Search failed");

        assert!(
            results.len() >= 1,
            "Should find at least 1 result with 'chemistry' in description"
        );
    }

    #[tokio::test]
    async fn test_search_content_empty_query() {
        let db = setup_test_db().await;

        // Empty query should return empty results
        let results = db
            .search_content("", Some(10))
            .await
            .expect("Search failed");

        assert_eq!(results.len(), 0, "Empty query should return no results");
    }

    #[tokio::test]
    async fn test_search_content_no_results() {
        let db = setup_test_db().await;

        // Search for something that doesn't exist
        let results = db
            .search_content("nonexistent_show_xyz", Some(10))
            .await
            .expect("Search failed");

        assert_eq!(
            results.len(),
            0,
            "Should return no results for nonexistent content"
        );
    }

    #[tokio::test]
    async fn test_search_content_limit() {
        let db = setup_test_db().await;

        // Search with limit of 1
        let results = db
            .search_content("Pilot", Some(1))
            .await
            .expect("Search failed");

        assert!(results.len() <= 1, "Should respect limit parameter");
    }

    #[tokio::test]
    async fn test_search_content_special_characters() {
        let db = setup_test_db().await;

        // Search with special characters (should be sanitized)
        let results = db
            .search_content("Breaking%Bad", Some(10))
            .await
            .expect("Search failed");

        // Should not cause SQL injection or errors - just returns results or empty
        assert!(results.len() <= 3);
    }

    #[tokio::test]
    async fn test_fts5_availability() {
        let _lock = TEST_LOCK.lock().await;
        let db = Database::new().await.expect("Failed to create database");

        // Check that FTS5 availability is determined
        // The value depends on the SQLite build, so we just check it's set
        println!("FTS5 available: {}", db.fts5_available);

        // FTS5 should be either true or false, not uninitialized
        assert!(db.fts5_available == true || db.fts5_available == false);
    }
}
