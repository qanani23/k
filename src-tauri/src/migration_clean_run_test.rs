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
    use std::path::PathBuf;
    use tempfile::TempDir;

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
        let count: u32 = conn.query_row("SELECT COUNT(*) FROM migrations", [], |row| row.get(0))?;
        Ok(count)
    }

    /// Helper function to check if a table exists
    fn table_exists(db_path: &PathBuf, table_name: &str) -> Result<bool, rusqlite::Error> {
        let conn = Connection::open(db_path)?;
        let exists: bool = conn.query_row(
            "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name=?1",
            [table_name],
            |row| row.get(0),
        )?;
        Ok(exists)
    }

    /// Helper function to get all table names
    fn get_all_tables(db_path: &PathBuf) -> Result<Vec<String>, rusqlite::Error> {
        let conn = Connection::open(db_path)?;
        let mut stmt =
            conn.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")?;
        let tables = stmt
            .query_map([], |row| row.get(0))?
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
        let migration_count = get_migration_count(&db_path).expect("Failed to get migration count");

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
                table_exists(&db_path, table).unwrap_or_else(|_| panic!("Failed to check {} table", table)),
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

        let first_count = get_migration_count(&db_path).expect("Failed to get migration count");

        // Run migrations second time (should be no-op)
        db.run_migrations()
            .await
            .expect("Second migration run should succeed");

        let second_count = get_migration_count(&db_path).expect("Failed to get migration count");

        assert_eq!(
            first_count, second_count,
            "Migration count should not change on second run"
        );

        // Run migrations third time (should still be no-op)
        db.run_migrations()
            .await
            .expect("Third migration run should succeed");

        let third_count = get_migration_count(&db_path).expect("Failed to get migration count");

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
        let conn = Connection::open(&db_path).expect("Failed to open database");

        let runner = MigrationRunner::new();
        let history = runner
            .get_migration_history(&conn)
            .expect("Failed to get migration history");

        assert!(!history.is_empty(), "Migration history should not be empty");

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
    async fn test_is_migration_applied_function() {
        let (db, _temp_dir, db_path) = create_test_db().await;

        // Run migrations
        db.run_migrations()
            .await
            .expect("Migrations should run successfully");

        // Open connection and create runner
        let conn = Connection::open(&db_path).expect("Failed to open database");
        let runner = MigrationRunner::new();

        // Get the list of applied migrations
        let history = runner
            .get_migration_history(&conn)
            .expect("Failed to get migration history");

        // Verify is_migration_applied returns true for all applied migrations
        for migration_info in &history {
            let is_applied = runner
                .is_migration_applied(&conn, migration_info.version)
                .expect("Failed to check if migration is applied");

            assert!(
                is_applied,
                "Migration {} should be marked as applied",
                migration_info.version
            );
        }

        // Verify is_migration_applied returns false for non-existent migration
        let non_existent_version = 99999;
        let is_applied = runner
            .is_migration_applied(&conn, non_existent_version)
            .expect("Failed to check if migration is applied");

        assert!(
            !is_applied,
            "Non-existent migration {} should not be marked as applied",
            non_existent_version
        );

        println!("✓ is_migration_applied() correctly identifies applied migrations");
    }

    #[tokio::test]
    async fn test_duplicate_migration_execution_prevented() {
        let (db, _temp_dir, db_path) = create_test_db().await;

        // Run migrations first time
        db.run_migrations()
            .await
            .expect("First migration run should succeed");

        let conn = Connection::open(&db_path).expect("Failed to open database");
        let runner = MigrationRunner::new();

        // Get initial migration count and history
        let initial_count = get_migration_count(&db_path).expect("Failed to get migration count");
        let initial_history = runner
            .get_migration_history(&conn)
            .expect("Failed to get migration history");

        // Verify all migrations are marked as applied
        for migration_info in &initial_history {
            let is_applied = runner
                .is_migration_applied(&conn, migration_info.version)
                .expect("Failed to check if migration is applied");

            assert!(
                is_applied,
                "Migration {} should be marked as applied after first run",
                migration_info.version
            );
        }

        // Run migrations second time
        db.run_migrations()
            .await
            .expect("Second migration run should succeed");

        // Verify migration count hasn't changed
        let second_count = get_migration_count(&db_path).expect("Failed to get migration count");
        assert_eq!(
            initial_count, second_count,
            "Migration count should not change on second run"
        );

        // Verify migration history hasn't changed (no duplicate entries)
        let second_history = runner
            .get_migration_history(&conn)
            .expect("Failed to get migration history");

        assert_eq!(
            initial_history.len(),
            second_history.len(),
            "Migration history length should not change on second run"
        );

        // Verify each migration version appears only once
        for migration_info in &second_history {
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM migrations WHERE version = ?1",
                    [migration_info.version],
                    |row| row.get(0),
                )
                .expect("Failed to count migration entries");

            assert_eq!(
                count, 1,
                "Migration {} should appear exactly once in migrations table",
                migration_info.version
            );
        }

        // Run migrations third time to ensure continued idempotency
        db.run_migrations()
            .await
            .expect("Third migration run should succeed");

        let third_count = get_migration_count(&db_path).expect("Failed to get migration count");
        assert_eq!(
            initial_count, third_count,
            "Migration count should not change on third run"
        );

        println!("✓ Duplicate migration execution is prevented by idempotency check");
    }

    #[tokio::test]
    async fn test_migrations_table_tracks_versions_correctly() {
        let (db, _temp_dir, db_path) = create_test_db().await;

        // Run migrations
        db.run_migrations()
            .await
            .expect("Migrations should run successfully");

        let conn = Connection::open(&db_path).expect("Failed to open database");
        let runner = MigrationRunner::new();

        // Get migration history
        let history = runner
            .get_migration_history(&conn)
            .expect("Failed to get migration history");

        // Verify migrations table has correct schema
        let table_info: Vec<(String, String)> = conn
            .prepare("PRAGMA table_info(migrations)")
            .expect("Failed to prepare table_info query")
            .query_map([], |row| Ok((row.get(1)?, row.get(2)?)))
            .expect("Failed to query table_info")
            .collect::<Result<Vec<_>, _>>()
            .expect("Failed to collect table_info");

        // Verify required columns exist
        let column_names: Vec<String> = table_info.iter().map(|(name, _)| name.clone()).collect();
        assert!(
            column_names.contains(&"version".to_string()),
            "migrations table should have version column"
        );
        assert!(
            column_names.contains(&"description".to_string()),
            "migrations table should have description column"
        );
        assert!(
            column_names.contains(&"applied_at".to_string()),
            "migrations table should have applied_at column"
        );
        assert!(
            column_names.contains(&"checksum".to_string()),
            "migrations table should have checksum column"
        );

        // Verify version is primary key
        let version_is_pk: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM pragma_table_info('migrations') WHERE name='version' AND pk=1",
                [],
                |row| row.get(0),
            )
            .expect("Failed to check if version is primary key");

        assert!(
            version_is_pk,
            "version column should be the primary key"
        );

        // Verify versions are sequential and unique
        let mut versions: Vec<u32> = history.iter().map(|m| m.version).collect();
        versions.sort();

        for i in 0..versions.len() {
            if i > 0 {
                assert!(
                    versions[i] > versions[i - 1],
                    "Migration versions should be unique and increasing"
                );
            }
        }

        // Verify all migrations have checksums
        for migration_info in &history {
            assert!(
                migration_info.checksum.is_some(),
                "Migration {} should have a checksum",
                migration_info.version
            );
        }

        // Verify current version matches max version
        let current_version = runner
            .get_current_version(&conn)
            .expect("Failed to get current version");

        let max_version = versions.iter().max().copied().unwrap_or(0);
        assert_eq!(
            current_version, max_version,
            "Current version should match maximum applied migration version"
        );

        println!("✓ Migrations table correctly tracks versions with proper schema");
    }

    #[tokio::test]
    async fn test_all_indices_created() {
        let (db, _temp_dir, db_path) = create_test_db().await;

        // Run migrations
        db.run_migrations()
            .await
            .expect("Migrations should run successfully");

        // Verify indices exist
        let conn = Connection::open(&db_path).expect("Failed to open database");

        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name")
            .expect("Failed to prepare index query");

        let indices: Vec<String> = stmt
            .query_map([], |row| row.get(0))
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
        let conn = Connection::open(&db_path).expect("Failed to open database");

        let integrity: String = conn
            .query_row("PRAGMA integrity_check", [], |row| row.get(0))
            .expect("Failed to run integrity check");

        assert_eq!(integrity, "ok", "Database integrity check should pass");

        // Run PRAGMA foreign_key_check
        let mut stmt = conn
            .prepare("PRAGMA foreign_key_check")
            .expect("Failed to prepare foreign key check");

        let violations: Vec<String> = stmt
            .query_map([], |row| row.get(0))
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
        let conn = Connection::open(&db_path).expect("Failed to open database");

        conn.execute(
            "INSERT INTO favorites (claimId, title, insertedAt) VALUES (?1, ?2, ?3)",
            ["test-claim-id", "Test Title", "1234567890"],
        )
        .expect("Failed to insert test data");

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
        let conn = Connection::open(&db_path).expect("Failed to open database");

        let title: String = conn
            .query_row(
                "SELECT title FROM favorites WHERE claimId = ?1",
                ["test-claim-id"],
                |row| row.get(0),
            )
            .expect("Test data should still exist after migrations");

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

        let conn = Connection::open(&db_path).expect("Failed to open database");

        // Get all tables
        let tables = get_all_tables(&db_path).expect("Failed to get tables");

        // Verify each table has at least one column
        for table in tables {
            if table.starts_with("sqlite_") {
                continue; // Skip SQLite internal tables
            }

            let mut stmt = conn
                .prepare(&format!("PRAGMA table_info({})", table))
                .unwrap_or_else(|_| panic!("Failed to get table info for {}", table));

            let columns: Vec<String> = stmt
                .query_map([], |row| row.get(1))
                .unwrap_or_else(|_| panic!("Failed to query columns for {}", table))
                .collect::<Result<Vec<String>, _>>()
                .unwrap_or_else(|_| panic!("Failed to collect columns for {}", table));

            assert!(
                !columns.is_empty(),
                "Table '{}' should have at least one column",
                table
            );
        }

        println!("✓ All tables have proper schema");
    }
}
