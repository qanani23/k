/// Tests to verify that database migrations run cleanly
/// 
/// These tests ensure that:
/// 1. Migrations run successfully on a fresh database
/// 2. Migrations run successfully on an existing database
/// 3. All migrations are idempotent (can be run multiple times safely)
/// 4. Migration history is properly tracked
/// 5. Database schema is correct after all migrations

#[cfg(test)]
mod migration_clean_run_tests {
    use crate::database::Database;
    use crate::migrations::MigrationRunner;
    use rusqlite::Connection;
    use tempfile::TempDir;
    use std::path::PathBuf;

    /// Helper function to create a test database
    async fn create_test_db() -> (Database, TempDir, PathBuf) {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test.db");
        let db = Database::new_with_path(&db_path)
            .await
            .expect("Failed to create database");
        (db, temp_dir, db_path)
    }

    /// Helper function to get migration count from database
    fn get_migration_count(db_path: &PathBuf) -> Result<u32, rusqlite::Error> {
        let conn = Connection::open(db_path)?;
        let count: u32 = conn.query_row(
            "SELECT COUNT(*) FROM migrations",
            [],
            |row| row.get(0)
        )?;
        Ok(count)
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

    /// Helper function to get all table names
    fn get_all_tables(db_path: &PathBuf) -> Result<Vec<String>, rusqlite::Error> {
        let conn = Connection::open(db_path)?;
        let mut stmt = conn.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )?;
        let tables = stmt.query_map([], |row| row.get(0))?
            .collect::<Result<Vec<String>, _>>()?;
        Ok(tables)
    }

    #[tokio::test]
    async fn test_migrations_run_cleanly_on_fresh_database() {
        let (db, _temp_dir, db_path) = create_test_db().await;

        // Verify base schema exists (from Database::new())
        assert!(
            table_exists(&db_path, "migrations").expect("Failed to check migrations table"),
            "Migrations table should exist"
        );
        assert!(
            table_exists(&db_path, "favorites").expect("Failed to check favorites table"),
            "Favorites table should exist"
        );
        assert!(
            table_exists(&db_path, "local_cache").expect("Failed to check local_cache table"),
            "Local cache table should exist"
        );

        // Run migrations
        db.run_migrations()
            .await
            .expect("Migrations should run successfully on fresh database");

        // Verify migrations were applied
        let migration_count = get_migration_count(&db_path)
            .expect("Failed to get migration count");
        
        assert!(
            migration_count > 0,
            "At least one migration should be applied. Found: {}",
            migration_count
        );

        // Verify all expected tables exist after migrations
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
                table_exists(&db_path, table).expect(&format!("Failed to check {} table", table)),
                "Table '{}' should exist after migrations",
                table
            );
        }

        println!("✓ All migrations ran cleanly on fresh database");
        println!("✓ {} migrations applied", migration_count);
    }

    #[tokio::test]
    async fn test_migrations_are_idempotent() {
        let (db, _temp_dir, db_path) = create_test_db().await;

        // Run migrations first time
        db.run_migrations()
            .await
            .expect("First migration run should succeed");

        let first_count = get_migration_count(&db_path)
            .expect("Failed to get migration count");

        // Run migrations second time (should be no-op)
        db.run_migrations()
            .await
            .expect("Second migration run should succeed");

        let second_count = get_migration_count(&db_path)
            .expect("Failed to get migration count");

        assert_eq!(
            first_count, second_count,
            "Migration count should not change on second run"
        );

        // Run migrations third time (should still be no-op)
        db.run_migrations()
            .await
            .expect("Third migration run should succeed");

        let third_count = get_migration_count(&db_path)
            .expect("Failed to get migration count");

        assert_eq!(
            first_count, third_count,
            "Migration count should not change on third run"
        );

        println!("✓ Migrations are idempotent (can be run multiple times safely)");
    }

    #[tokio::test]
    async fn test_migration_history_tracking() {
        let (db, _temp_dir, db_path) = create_test_db().await;

        // Run migrations
        db.run_migrations()
            .await
            .expect("Migrations should run successfully");

        // Verify migration history is tracked
        let conn = Connection::open(&db_path)
            .expect("Failed to open database");

        let runner = MigrationRunner::new();
        let history = runner.get_migration_history(&conn)
            .expect("Failed to get migration history");

        assert!(
            !history.is_empty(),
            "Migration history should not be empty"
        );

        // Verify each migration has required fields
        for migration_info in history {
            assert!(
                migration_info.version > 0,
                "Migration version should be positive"
            );
            assert!(
                migration_info.applied_at > 0,
                "Migration applied_at timestamp should be positive"
            );
            assert!(
                !migration_info.description.is_empty(),
                "Migration description should not be empty"
            );
        }

        println!("✓ Migration history is properly tracked");
    }

    #[tokio::test]
    async fn test_all_indices_created() {
        let (db, _temp_dir, db_path) = create_test_db().await;

        // Run migrations
        db.run_migrations()
            .await
            .expect("Migrations should run successfully");

        // Verify indices exist
        let conn = Connection::open(&db_path)
            .expect("Failed to open database");

        let mut stmt = conn.prepare(
            "SELECT name FROM sqlite_master WHERE type='index' ORDER BY name"
        ).expect("Failed to prepare index query");

        let indices: Vec<String> = stmt.query_map([], |row| row.get(0))
            .expect("Failed to query indices")
            .collect::<Result<Vec<String>, _>>()
            .expect("Failed to collect indices");

        // Verify some critical indices exist
        let expected_indices = vec![
            "idx_localcache_titleLower",
            "idx_localcache_tags",
            "idx_localcache_updatedAt",
            "idx_progress_updatedAt",
            "idx_playlist_items_position",
            "idx_favorites_insertedAt",
            "idx_offline_meta_addedAt",
        ];

        for expected_index in expected_indices {
            assert!(
                indices.iter().any(|idx| idx == expected_index),
                "Index '{}' should exist after migrations",
                expected_index
            );
        }

        println!("✓ All critical indices created successfully");
        println!("✓ Total indices: {}", indices.len());
    }

    #[tokio::test]
    async fn test_database_schema_integrity() {
        let (db, _temp_dir, db_path) = create_test_db().await;

        // Run migrations
        db.run_migrations()
            .await
            .expect("Migrations should run successfully");

        // Run PRAGMA integrity_check
        let conn = Connection::open(&db_path)
            .expect("Failed to open database");

        let integrity: String = conn.query_row(
            "PRAGMA integrity_check",
            [],
            |row| row.get(0)
        ).expect("Failed to run integrity check");

        assert_eq!(
            integrity, "ok",
            "Database integrity check should pass"
        );

        // Run PRAGMA foreign_key_check
        let mut stmt = conn.prepare("PRAGMA foreign_key_check")
            .expect("Failed to prepare foreign key check");
        
        let violations: Vec<String> = stmt.query_map([], |row| row.get(0))
            .expect("Failed to query foreign key violations")
            .collect::<Result<Vec<String>, _>>()
            .expect("Failed to collect foreign key violations");

        assert!(
            violations.is_empty(),
            "No foreign key violations should exist. Found: {:?}",
            violations
        );

        println!("✓ Database schema integrity verified");
    }

    #[tokio::test]
    async fn test_migrations_run_cleanly_on_existing_database() {
        let (db, _temp_dir, db_path) = create_test_db().await;

        // Run migrations first time
        db.run_migrations()
            .await
            .expect("First migration run should succeed");

        // Insert some test data
        let conn = Connection::open(&db_path)
            .expect("Failed to open database");

        conn.execute(
            "INSERT INTO favorites (claimId, title, insertedAt) VALUES (?1, ?2, ?3)",
            ["test-claim-id", "Test Title", "1234567890"]
        ).expect("Failed to insert test data");

        drop(conn);

        // Create a new database instance pointing to the same file
        let db2 = Database::new_with_path(&db_path)
            .await
            .expect("Failed to create second database instance");

        // Run migrations again (should be no-op)
        db2.run_migrations()
            .await
            .expect("Second migration run should succeed on existing database");

        // Verify test data still exists
        let conn = Connection::open(&db_path)
            .expect("Failed to open database");

        let title: String = conn.query_row(
            "SELECT title FROM favorites WHERE claimId = ?1",
            ["test-claim-id"],
            |row| row.get(0)
        ).expect("Test data should still exist after migrations");

        assert_eq!(title, "Test Title", "Test data should be preserved");

        println!("✓ Migrations run cleanly on existing database");
        println!("✓ Existing data preserved");
    }

    #[tokio::test]
    async fn test_all_tables_have_proper_schema() {
        let (db, _temp_dir, db_path) = create_test_db().await;

        // Run migrations
        db.run_migrations()
            .await
            .expect("Migrations should run successfully");

        let conn = Connection::open(&db_path)
            .expect("Failed to open database");

        // Get all tables
        let tables = get_all_tables(&db_path)
            .expect("Failed to get tables");

        // Verify each table has at least one column
        for table in tables {
            if table.starts_with("sqlite_") {
                continue; // Skip SQLite internal tables
            }

            let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table))
                .expect(&format!("Failed to get table info for {}", table));

            let columns: Vec<String> = stmt.query_map([], |row| row.get(1))
                .expect(&format!("Failed to query columns for {}", table))
                .collect::<Result<Vec<String>, _>>()
                .expect(&format!("Failed to collect columns for {}", table));

            assert!(
                !columns.is_empty(),
                "Table '{}' should have at least one column",
                table
            );
        }

        println!("✓ All tables have proper schema");
    }
}
