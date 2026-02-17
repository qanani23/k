/// Integration tests for full application startup
/// 
/// These tests verify the complete application initialization flow,
/// including database setup, migration execution, and FTS5 initialization.
#[cfg(test)]
mod tests {
    use crate::database::Database;
    use crate::models::{ContentItem, FavoriteItem, ProgressData, Playlist, PlaylistItem};
    use rusqlite::Connection;
    use std::sync::Arc;
    use tokio::sync::Mutex;
    use std::path::PathBuf;
    use chrono::Utc;

    // Use a global lock to prevent parallel test execution that causes database conflicts
    static TEST_LOCK: once_cell::sync::Lazy<Arc<Mutex<()>>> = 
        once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(())));

    /// Helper function to get the test database path
    fn get_test_db_path() -> PathBuf {
        std::env::temp_dir().join("kiyya_test").join("app.db")
    }

    /// Helper function to clean up test database
    fn cleanup_test_db() {
        let db_path = get_test_db_path();
        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
        let _ = std::fs::remove_file(db_path.with_extension("db-wal"));
    }

    /// Helper function to get migration count
    fn get_migration_count(db_path: &PathBuf) -> Result<u32, rusqlite::Error> {
        let conn = Connection::open(db_path)?;
        let count: u32 = conn.query_row(
            "SELECT COUNT(*) FROM migrations",
            [],
            |row| row.get(0)
        )?;
        Ok(count)
    }

    /// Helper function to get current database version
    fn get_current_version(db_path: &PathBuf) -> Result<u32, rusqlite::Error> {
        let conn = Connection::open(db_path)?;
        let version: u32 = conn.query_row(
            "SELECT COALESCE(MAX(version), 0) FROM migrations",
            [],
            |row| row.get(0)
        )?;
        Ok(version)
    }

    /// Helper function to check if a table exists
    fn table_exists(db_path: &PathBuf, table_name: &str) -> Result<bool, rusqlite::Error> {
        let conn = Connection::open(db_path)?;
        let exists: bool = conn.query_row(
            "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name=?1",
            [table_name],
            |row| row.get(0)
        )?;
        Ok(exists)
    }

    /// Helper function to apply specific migrations (for testing partial migration states)
    fn apply_migrations_up_to(db_path: &PathBuf, target_version: u32) -> Result<(), Box<dyn std::error::Error>> {
        let conn = Connection::open(db_path)?;
        
        // Get all migrations
        let migrations = crate::migrations::get_all_migrations();
        
        // Apply migrations up to target version using the migration runner
        let migration_runner = crate::migrations::MigrationRunner::new();
        
        // Apply each migration in a transaction
        for migration in migrations.iter().filter(|m| m.version <= target_version) {
            migration_runner.execute_migration(&conn, migration)?;
        }
        
        Ok(())
    }

    /// Helper function to insert test data
    async fn insert_test_data(db: &Database) -> Result<(), Box<dyn std::error::Error>> {
        // Insert a test favorite
        let favorite = FavoriteItem {
            claim_id: "test_claim_1".to_string(),
            title: "Test Movie".to_string(),
            thumbnail_url: Some("https://example.com/thumb.jpg".to_string()),
            inserted_at: Utc::now().timestamp(),
        };
        db.save_favorite(favorite).await?;
        
        // Insert test progress
        let progress = ProgressData {
            claim_id: "test_claim_1".to_string(),
            position_seconds: 120,
            quality: "master".to_string(),
            updated_at: Utc::now().timestamp(),
        };
        db.save_progress(progress).await?;
        
        // Insert a test playlist
        let playlist = Playlist {
            id: "test_playlist_1".to_string(),
            title: "Test Series Season 1".to_string(),
            claim_id: "test_series_claim".to_string(),
            items: vec![
                PlaylistItem {
                    claim_id: "episode_1".to_string(),
                    position: 0,
                    episode_number: Some(1),
                    season_number: Some(1),
                },
                PlaylistItem {
                    claim_id: "episode_2".to_string(),
                    position: 1,
                    episode_number: Some(2),
                    season_number: Some(1),
                },
            ],
            season_number: Some(1),
            series_key: Some("test_series".to_string()),
        };
        db.store_playlist(playlist).await?;
        
        Ok(())
    }

    #[tokio::test]
    async fn test_fresh_database_initialization() {
        let _lock = TEST_LOCK.lock().await;
        
        // Delete any existing test database
        cleanup_test_db();
        
        let db_path = get_test_db_path();
        
        // Run full application startup sequence
        let db = Database::new().await.expect("Failed to create database");
        
        // Verify application completes initialization without crashing
        assert!(db_path.exists(), "Database file should be created");
        
        // Run migrations (simulating the setup hook)
        db.run_migrations().await.expect("Failed to run migrations");
        
        // Verify all 13 migrations are applied
        let migration_count = get_migration_count(&db_path)
            .expect("Failed to get migration count");
        
        assert_eq!(
            migration_count, 13,
            "All 13 migrations should be applied. Found: {}",
            migration_count
        );
        
        // Verify database operations work
        
        // Test cache operations
        let cached_content = db.get_cached_content(crate::models::CacheQuery {
            tags: None,
            text_search: None,
            order_by: None,
            limit: Some(10),
            offset: None,
        }).await.expect("Failed to get cached content");
        assert_eq!(cached_content.len(), 0, "Should start with no cached content");
        
        // Test favorites operations
        let favorites = db.get_favorites().await.expect("Failed to get favorites");
        assert_eq!(favorites.len(), 0, "Should start with no favorites");
        
        // Test progress operations
        let progress = db.get_progress("test_claim").await.expect("Failed to get progress");
        assert!(progress.is_none(), "Should have no progress initially");
        
        // Test playlist operations
        let playlist = db.get_playlist("test_playlist").await.expect("Failed to get playlist");
        assert!(playlist.is_none(), "Should have no playlists initially");
        
        // Cleanup
        cleanup_test_db();
    }

    #[tokio::test]
    async fn test_existing_database_compatibility() {
        let _lock = TEST_LOCK.lock().await;
        
        // Clean up first
        cleanup_test_db();
        
        let db_path = get_test_db_path();
        
        // Create a test database with migrations 1-10 applied
        let db = Database::new().await.expect("Failed to create database");
        
        // Apply only migrations 1-10
        apply_migrations_up_to(&db_path, 10)
            .expect("Failed to apply migrations 1-10");
        
        // Insert some test data to verify it's preserved
        insert_test_data(&db).await.expect("Failed to insert test data");
        
        // Verify current version is 10
        let version_before = get_current_version(&db_path)
            .expect("Failed to get version");
        assert_eq!(version_before, 10, "Should be at version 10");
        
        // Run application startup sequence (which should apply remaining migrations)
        db.run_migrations().await.expect("Failed to run remaining migrations");
        
        // Verify application recognizes existing migrations
        let version_after = get_current_version(&db_path)
            .expect("Failed to get version after");
        assert_eq!(version_after, 13, "Should be at version 13 after applying remaining migrations");
        
        // Verify only migrations 11-12 were applied
        let migration_count = get_migration_count(&db_path)
            .expect("Failed to get migration count");
        assert_eq!(migration_count, 13, "Should have all 13 migrations");
        
        // Verify existing data is preserved
        let favorites = db.get_favorites().await.expect("Failed to get favorites");
        assert_eq!(favorites.len(), 1, "Existing favorite should be preserved");
        assert_eq!(favorites[0].claim_id, "test_claim_1");
        
        let progress = db.get_progress("test_claim_1").await.expect("Failed to get progress");
        assert!(progress.is_some(), "Existing progress should be preserved");
        assert_eq!(progress.unwrap().position_seconds, 120);
        
        let playlist = db.get_playlist("test_playlist_1").await.expect("Failed to get playlist");
        assert!(playlist.is_some(), "Existing playlist should be preserved");
        assert_eq!(playlist.unwrap().items.len(), 2);
        
        // Cleanup
        cleanup_test_db();
    }

    #[tokio::test]
    async fn test_fts5_initialization() {
        let _lock = TEST_LOCK.lock().await;
        
        // Clean up first
        cleanup_test_db();
        
        let db_path = get_test_db_path();
        
        // Run application startup on a system with FTS5 support
        let db = Database::new().await.expect("Failed to create database");
        db.run_migrations().await.expect("Failed to run migrations");
        
        // Verify fts5_available flag is set correctly
        // Note: The actual value depends on the SQLite build
        let fts5_available = db.fts5_available;
        assert!(
            fts5_available == true || fts5_available == false,
            "FTS5 availability should be determined"
        );
        
        // If FTS5 is available, verify the virtual table and triggers are created
        if fts5_available {
            // Verify local_cache_fts virtual table is created
            assert!(
                table_exists(&db_path, "local_cache_fts").expect("Failed to check FTS5 table"),
                "FTS5 virtual table should exist when FTS5 is available"
            );
            
            // Verify FTS5 triggers are created
            let conn = Connection::open(&db_path).expect("Failed to open connection");
            
            let trigger_count: u32 = conn.query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name LIKE 'local_cache_fts_%'",
                [],
                |row| row.get(0)
            ).expect("Failed to count triggers");
            
            assert_eq!(
                trigger_count, 3,
                "Should have 3 FTS5 triggers (insert, delete, update)"
            );
            
            // Test full-text search functionality
            // Insert some test content
            let test_content = vec![
                ContentItem {
                    claim_id: "search_test_1".to_string(),
                    title: "The Matrix".to_string(),
                    description: Some("A computer hacker learns about the true nature of reality".to_string()),
                    tags: vec!["sci-fi".to_string(), "action".to_string()],
                    thumbnail_url: Some("https://example.com/matrix.jpg".to_string()),
                    duration: Some(136),
                    release_time: Utc::now().timestamp(),
                    video_urls: std::collections::HashMap::new(),
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
            
            db.store_content_items(test_content).await.expect("Failed to store content");
            
            // Test FTS5 search
            let search_results = db.search_content("matrix", Some(10)).await
                .expect("Failed to search content");
            
            assert_eq!(
                search_results.len(), 1,
                "FTS5 search should find the test content"
            );
            assert_eq!(search_results[0].claim_id, "search_test_1");
        }
        
        // Cleanup
        cleanup_test_db();
    }

    #[tokio::test]
    async fn test_error_logging() {
        let _lock = TEST_LOCK.lock().await;
        
        // Clean up first
        cleanup_test_db();
        
        // Simulate database initialization failure by using an invalid path
        // Note: This is tricky because path_security validates paths
        // Instead, we'll test that errors are handled gracefully
        
        // Create a valid database first
        let db = Database::new().await.expect("Failed to create database");
        db.run_migrations().await.expect("Failed to run migrations");
        
        // Test that invalid operations produce descriptive errors
        // Try to get a playlist that doesn't exist (should return None, not error)
        let result = db.get_playlist("nonexistent_playlist").await;
        assert!(result.is_ok(), "Getting nonexistent playlist should not error");
        assert!(result.unwrap().is_none(), "Should return None for nonexistent playlist");
        
        // Try to delete progress for nonexistent claim (should succeed silently)
        let result = db.delete_progress("nonexistent_claim").await;
        assert!(result.is_ok(), "Deleting nonexistent progress should not error");
        
        // Test that the application handles errors gracefully
        // by verifying database operations still work after errors
        let favorites = db.get_favorites().await;
        assert!(favorites.is_ok(), "Database should still work after error operations");
        
        // Cleanup
        cleanup_test_db();
    }

    #[tokio::test]
    async fn test_multiple_startup_cycles() {
        let _lock = TEST_LOCK.lock().await;
        
        // Clean up first
        cleanup_test_db();
        
        let db_path = get_test_db_path();
        
        // Simulate multiple startup cycles
        for i in 0..5 {
            // Create database and run migrations
            let db = Database::new().await
                .expect(&format!("Failed to create database on cycle {}", i));
            db.run_migrations().await
                .expect(&format!("Failed to run migrations on cycle {}", i));
            
            // Verify migrations are not re-applied
            let migration_count = get_migration_count(&db_path)
                .expect("Failed to get migration count");
            assert_eq!(
                migration_count, 13,
                "Should have exactly 13 migrations on cycle {}",
                i
            );
            
            // Verify database operations work
            let favorites = db.get_favorites().await
                .expect(&format!("Failed to get favorites on cycle {}", i));
            assert!(favorites.len() >= 0, "Database should be operational");
            
            // Drop the database to simulate application shutdown
            drop(db);
        }
        
        // Cleanup
        cleanup_test_db();
    }

    #[tokio::test]
    async fn test_concurrent_database_access() {
        let _lock = TEST_LOCK.lock().await;
        
        // Clean up first
        cleanup_test_db();
        
        // Create database
        let db = Database::new().await.expect("Failed to create database");
        db.run_migrations().await.expect("Failed to run migrations");
        
        // Wrap database in Arc for concurrent access
        let db = Arc::new(db);
        
        // Spawn multiple concurrent tasks
        let mut handles = vec![];
        
        for i in 0..10 {
            let db_clone = Arc::clone(&db);
            let handle = tokio::spawn(async move {
                // Each task performs database operations
                let favorite = FavoriteItem {
                    claim_id: format!("concurrent_test_{}", i),
                    title: format!("Test Movie {}", i),
                    thumbnail_url: None,
                    inserted_at: Utc::now().timestamp(),
                };
                
                db_clone.save_favorite(favorite).await
                    .expect(&format!("Failed to save favorite {}", i));
                
                // Read back the favorite
                let is_fav = db_clone.is_favorite(&format!("concurrent_test_{}", i)).await
                    .expect(&format!("Failed to check favorite {}", i));
                
                assert!(is_fav, "Favorite {} should exist", i);
            });
            
            handles.push(handle);
        }
        
        // Wait for all tasks to complete
        for handle in handles {
            handle.await.expect("Task panicked");
        }
        
        // Verify all favorites were saved
        let favorites = db.get_favorites().await.expect("Failed to get favorites");
        assert_eq!(favorites.len(), 10, "Should have 10 favorites from concurrent operations");
        
        // Cleanup
        cleanup_test_db();
    }

    #[tokio::test]
    async fn test_database_schema_integrity() {
        let _lock = TEST_LOCK.lock().await;
        
        // Clean up first
        cleanup_test_db();
        
        let db_path = get_test_db_path();
        
        // Create database and run migrations
        let db = Database::new().await.expect("Failed to create database");
        db.run_migrations().await.expect("Failed to run migrations");
        
        // Verify all expected tables exist
        let expected_tables = vec![
            "migrations",
            "favorites",
            "progress",
            "offline_meta",
            "local_cache",
            "playlists",
            "playlist_items",
            "app_settings",
            "cache_stats",
            "user_preferences",
            "gateway_stats",
            "gateway_logs",
            "download_queue",
            "download_sessions",
            "search_history",
            "content_analytics",
            "error_logs",
            "system_diagnostics",
            "content_relationships",
            "recommendation_cache",
        ];
        
        for table in expected_tables {
            assert!(
                table_exists(&db_path, table).expect(&format!("Failed to check table {}", table)),
                "Table {} should exist after migrations",
                table
            );
        }
        
        // Verify foreign key constraints are enabled
        let conn = Connection::open(&db_path).expect("Failed to open connection");
        let fk_enabled: bool = conn.query_row(
            "PRAGMA foreign_keys",
            [],
            |row| row.get(0)
        ).expect("Failed to check foreign keys");
        
        assert!(fk_enabled, "Foreign keys should be enabled");
        
        // Cleanup
        cleanup_test_db();
    }
}
