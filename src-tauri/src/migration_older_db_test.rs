/// Tests to verify that database migrations work correctly with older database versions
/// 
/// These tests ensure that:
/// 1. Migrations can upgrade from version 0 (no migrations table) to current
/// 2. Migrations can upgrade from version 1 (initial schema) to current
/// 3. Migrations can upgrade from any intermediate version to current
/// 4. Data is preserved during migration upgrades
/// 5. Schema changes are applied correctly for each version

#[cfg(test)]
mod migration_older_db_tests {
    use crate::database::Database;
    use crate::migrations::MigrationRunner;
    use rusqlite::Connection;
    use tempfile::TempDir;
    use std::path::PathBuf;

    /// Helper function to create a test database path
    fn create_test_db_path() -> (TempDir, PathBuf) {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test.db");
        (temp_dir, db_path)
    }

    /// Helper function to get current migration version
    fn get_current_version(db_path: &PathBuf) -> Result<u32, rusqlite::Error> {
        let conn = Connection::open(db_path)?;
        let version: u32 = conn.query_row(
            "SELECT COALESCE(MAX(version), 0) FROM migrations",
            [],
            |row| row.get(0)
        ).unwrap_or(0);
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

    /// Helper function to check if a column exists in a table
    fn column_exists(db_path: &PathBuf, table_name: &str, column_name: &str) -> Result<bool, rusqlite::Error> {
        let conn = Connection::open(db_path)?;
        let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table_name))?;
        let columns: Vec<String> = stmt.query_map([], |row| row.get(1))?
            .collect::<Result<Vec<String>, _>>()?;
        Ok(columns.iter().any(|col| col == column_name))
    }

    /// Creates a database with version 0 schema (no migrations table, basic tables only)
    fn create_v0_database(db_path: &PathBuf) -> Result<(), rusqlite::Error> {
        let conn = Connection::open(db_path)?;

        // Create basic tables without migrations table
        conn.execute(
            r#"CREATE TABLE IF NOT EXISTS favorites (
                claimId TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                thumbnailUrl TEXT,
                insertedAt INTEGER NOT NULL
            )"#,
            []
        )?;

        conn.execute(
            r#"CREATE TABLE IF NOT EXISTS progress (
                claimId TEXT PRIMARY KEY,
                positionSeconds INTEGER NOT NULL,
                quality TEXT NOT NULL,
                updatedAt INTEGER NOT NULL
            )"#,
            []
        )?;

        conn.execute(
            r#"CREATE TABLE IF NOT EXISTS offline_meta (
                claimId TEXT NOT NULL,
                quality TEXT NOT NULL,
                filename TEXT NOT NULL,
                fileSize INTEGER NOT NULL,
                encrypted BOOLEAN DEFAULT FALSE,
                addedAt INTEGER NOT NULL,
                PRIMARY KEY (claimId, quality)
            )"#,
            []
        )?;

        conn.execute(
            r#"CREATE TABLE IF NOT EXISTS local_cache (
                claimId TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                titleLower TEXT NOT NULL,
                description TEXT,
                descriptionLower TEXT,
                tags TEXT NOT NULL,
                thumbnailUrl TEXT,
                videoUrls TEXT NOT NULL,
                compatibility TEXT NOT NULL,
                updatedAt INTEGER NOT NULL
            )"#,
            []
        )?;

        // Insert some test data
        conn.execute(
            "INSERT INTO favorites (claimId, title, insertedAt) VALUES (?1, ?2, ?3)",
            ["v0-favorite-1", "V0 Favorite Movie", "1234567890"]
        )?;

        conn.execute(
            "INSERT INTO progress (claimId, positionSeconds, quality, updatedAt) VALUES (?1, ?2, ?3, ?4)",
            ["v0-progress-1", "120", "720p", "1234567890"]
        )?;

        Ok(())
    }

    /// Creates a database with version 1 schema (migrations table exists, but only v1 applied)
    fn create_v1_database(db_path: &PathBuf) -> Result<(), rusqlite::Error> {
        let conn = Connection::open(db_path)?;

        // Create migrations table
        conn.execute(
            r#"CREATE TABLE IF NOT EXISTS migrations (
                version INTEGER PRIMARY KEY,
                description TEXT NOT NULL,
                applied_at INTEGER NOT NULL,
                checksum TEXT
            )"#,
            []
        )?;

        // Record migration 1
        conn.execute(
            "INSERT INTO migrations (version, description, applied_at) VALUES (?1, ?2, ?3)",
            ["1", "Initial schema setup", "1234567890"]
        )?;

        // Create v1 schema tables
        create_v0_database(db_path)?;

        // Add playlists tables (part of v1)
        conn.execute(
            r#"CREATE TABLE IF NOT EXISTS playlists (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                claimId TEXT NOT NULL,
                seasonNumber INTEGER,
                seriesKey TEXT,
                updatedAt INTEGER NOT NULL
            )"#,
            []
        )?;

        conn.execute(
            r#"CREATE TABLE IF NOT EXISTS playlist_items (
                playlistId TEXT NOT NULL,
                claimId TEXT NOT NULL,
                position INTEGER NOT NULL,
                episodeNumber INTEGER,
                seasonNumber INTEGER,
                PRIMARY KEY (playlistId, claimId),
                FOREIGN KEY (playlistId) REFERENCES playlists(id)
            )"#,
            []
        )?;

        // Insert test data
        conn.execute(
            "INSERT INTO favorites (claimId, title, insertedAt) VALUES (?1, ?2, ?3)",
            ["v1-favorite-1", "V1 Favorite Movie", "1234567890"]
        )?;

        Ok(())
    }

    /// Creates a database with version 5 schema (intermediate version)
    fn create_v5_database(db_path: &PathBuf) -> Result<(), rusqlite::Error> {
        // Start with v1
        create_v1_database(db_path)?;

        let conn = Connection::open(db_path)?;

        // Apply migrations 2-5
        conn.execute(
            "INSERT INTO migrations (version, description, applied_at) VALUES (?1, ?2, ?3)",
            ["2", "Add performance indexes", "1234567891"]
        )?;

        conn.execute(
            "INSERT INTO migrations (version, description, applied_at) VALUES (?1, ?2, ?3)",
            ["3", "Enhanced playlist support with series management", "1234567892"]
        )?;

        // Add columns from migration 3
        conn.execute("ALTER TABLE playlists ADD COLUMN totalDuration INTEGER DEFAULT 0", [])?;
        conn.execute("ALTER TABLE playlists ADD COLUMN createdAt INTEGER DEFAULT 0", [])?;
        conn.execute("ALTER TABLE playlist_items ADD COLUMN duration INTEGER", [])?;
        conn.execute("ALTER TABLE playlist_items ADD COLUMN addedAt INTEGER DEFAULT 0", [])?;

        conn.execute(
            "INSERT INTO migrations (version, description, applied_at) VALUES (?1, ?2, ?3)",
            ["4", "User preferences and application settings", "1234567893"]
        )?;

        // Create user_preferences table from migration 4
        conn.execute(
            r#"CREATE TABLE IF NOT EXISTS user_preferences (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                type TEXT NOT NULL DEFAULT 'string',
                description TEXT,
                updated_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            )"#,
            []
        )?;

        conn.execute(
            "INSERT INTO migrations (version, description, applied_at) VALUES (?1, ?2, ?3)",
            ["5", "Content compatibility and codec tracking", "1234567894"]
        )?;

        // Add columns from migration 5
        conn.execute("ALTER TABLE local_cache ADD COLUMN codec_info TEXT", [])?;
        conn.execute("ALTER TABLE local_cache ADD COLUMN hls_support BOOLEAN DEFAULT FALSE", [])?;
        conn.execute("ALTER TABLE local_cache ADD COLUMN last_compatibility_check INTEGER", [])?;
        conn.execute("ALTER TABLE local_cache ADD COLUMN platform_compatibility TEXT", [])?;

        // Insert test data
        conn.execute(
            "INSERT INTO favorites (claimId, title, insertedAt) VALUES (?1, ?2, ?3)",
            ["v5-favorite-1", "V5 Favorite Movie", "1234567890"]
        )?;

        conn.execute(
            "INSERT INTO user_preferences (key, value, type, updated_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            ["theme", "dark", "string", "1234567890", "1234567890"]
        )?;

        Ok(())
    }

    #[tokio::test]
    async fn test_upgrade_from_v0_to_current() {
        let (_temp_dir, db_path) = create_test_db_path();

        // Create v0 database
        create_v0_database(&db_path)
            .expect("Failed to create v0 database");

        // Verify v0 state
        assert!(
            !table_exists(&db_path, "migrations").expect("Failed to check migrations table"),
            "Migrations table should not exist in v0"
        );
        assert!(
            table_exists(&db_path, "favorites").expect("Failed to check favorites table"),
            "Favorites table should exist in v0"
        );

        // Verify test data exists
        let conn = Connection::open(&db_path).expect("Failed to open database");
        let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM favorites WHERE claimId = ?1",
            ["v0-favorite-1"],
            |row| row.get(0)
        ).expect("Failed to query test data");
        assert_eq!(count, 1, "Test data should exist in v0");
        drop(conn);

        // Manually run migrations on the old database
        // This simulates upgrading an existing v0 database
        let conn = Connection::open(&db_path).expect("Failed to open database");
        
        // Ensure migrations table exists
        let runner = MigrationRunner::new();
        runner.ensure_migrations_table(&conn).expect("Failed to ensure migrations table");
        
        // Run all migrations
        runner.run_migrations(&conn).expect("Migrations should succeed from v0 to current");
        drop(conn);

        // Now create Database instance (which will call initialize, but tables already exist)
        let db = Database::new_with_path(&db_path)
            .await
            .expect("Failed to create database");

        // Verify migrations table now exists
        assert!(
            table_exists(&db_path, "migrations").expect("Failed to check migrations table"),
            "Migrations table should exist after upgrade"
        );

        // Verify current version is up to date
        let version = get_current_version(&db_path)
            .expect("Failed to get current version");
        assert!(version >= 13, "Should be at latest version (13+), got {}", version);

        // Verify test data is preserved
        let conn = Connection::open(&db_path).expect("Failed to open database");
        let title: String = conn.query_row(
            "SELECT title FROM favorites WHERE claimId = ?1",
            ["v0-favorite-1"],
            |row| row.get(0)
        ).expect("Test data should be preserved");
        assert_eq!(title, "V0 Favorite Movie", "Test data should be preserved");

        // Verify new tables exist
        assert!(
            table_exists(&db_path, "user_preferences").expect("Failed to check user_preferences"),
            "New tables should exist after upgrade"
        );
        assert!(
            table_exists(&db_path, "gateway_stats").expect("Failed to check gateway_stats"),
            "New tables should exist after upgrade"
        );

        println!("✓ Successfully upgraded from v0 to current version {}", version);
    }

    #[tokio::test]
    async fn test_upgrade_from_v1_to_current() {
        let (_temp_dir, db_path) = create_test_db_path();

        // Create v1 database
        create_v1_database(&db_path)
            .expect("Failed to create v1 database");

        // Verify v1 state
        let version = get_current_version(&db_path)
            .expect("Failed to get version");
        assert_eq!(version, 1, "Should be at version 1");

        // Verify test data exists
        let conn = Connection::open(&db_path).expect("Failed to open database");
        let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM favorites WHERE claimId = ?1",
            ["v1-favorite-1"],
            |row| row.get(0)
        ).expect("Failed to query test data");
        assert_eq!(count, 1, "Test data should exist in v1");
        drop(conn);

        // Manually run migrations on the old database
        let conn = Connection::open(&db_path).expect("Failed to open database");
        let runner = MigrationRunner::new();
        runner.run_migrations(&conn).expect("Migrations should succeed from v1 to current");
        drop(conn);

        // Now create Database instance
        let db = Database::new_with_path(&db_path)
            .await
            .expect("Failed to create database");

        // Verify current version
        let new_version = get_current_version(&db_path)
            .expect("Failed to get current version");
        assert!(new_version >= 13, "Should be at latest version (13+), got {}", new_version);

        // Verify test data is preserved
        let conn = Connection::open(&db_path).expect("Failed to open database");
        let title: String = conn.query_row(
            "SELECT title FROM favorites WHERE claimId = ?1",
            ["v1-favorite-1"],
            |row| row.get(0)
        ).expect("Test data should be preserved");
        assert_eq!(title, "V1 Favorite Movie", "Test data should be preserved");

        // Verify new columns exist in playlists table (from migration 3)
        assert!(
            column_exists(&db_path, "playlists", "totalDuration").expect("Failed to check column"),
            "New columns should exist after upgrade"
        );
        assert!(
            column_exists(&db_path, "playlists", "createdAt").expect("Failed to check column"),
            "New columns should exist after upgrade"
        );

        // Verify new tables exist
        assert!(
            table_exists(&db_path, "user_preferences").expect("Failed to check user_preferences"),
            "New tables should exist after upgrade"
        );

        println!("✓ Successfully upgraded from v1 to current version {}", new_version);
    }

    #[tokio::test]
    async fn test_upgrade_from_v5_to_current() {
        let (_temp_dir, db_path) = create_test_db_path();

        // Create v5 database
        create_v5_database(&db_path)
            .expect("Failed to create v5 database");

        // Verify v5 state
        let version = get_current_version(&db_path)
            .expect("Failed to get version");
        assert_eq!(version, 5, "Should be at version 5");

        // Verify test data exists
        let conn = Connection::open(&db_path).expect("Failed to open database");
        let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM favorites WHERE claimId = ?1",
            ["v5-favorite-1"],
            |row| row.get(0)
        ).expect("Failed to query test data");
        assert_eq!(count, 1, "Test data should exist in v5");

        let pref_count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM user_preferences WHERE key = ?1",
            ["theme"],
            |row| row.get(0)
        ).expect("Failed to query preferences");
        assert_eq!(pref_count, 1, "Preferences should exist in v5");
        drop(conn);

        // Manually run migrations on the old database
        let conn = Connection::open(&db_path).expect("Failed to open database");
        let runner = MigrationRunner::new();
        runner.run_migrations(&conn).expect("Migrations should succeed from v5 to current");
        drop(conn);

        // Now create Database instance
        let db = Database::new_with_path(&db_path)
            .await
            .expect("Failed to create database");

        // Verify current version
        let new_version = get_current_version(&db_path)
            .expect("Failed to get current version");
        assert!(new_version >= 13, "Should be at latest version (13+), got {}", new_version);

        // Verify test data is preserved
        let conn = Connection::open(&db_path).expect("Failed to open database");
        let title: String = conn.query_row(
            "SELECT title FROM favorites WHERE claimId = ?1",
            ["v5-favorite-1"],
            |row| row.get(0)
        ).expect("Test data should be preserved");
        assert_eq!(title, "V5 Favorite Movie", "Test data should be preserved");

        let theme: String = conn.query_row(
            "SELECT value FROM user_preferences WHERE key = ?1",
            ["theme"],
            |row| row.get(0)
        ).expect("Preferences should be preserved");
        assert_eq!(theme, "dark", "Preferences should be preserved");

        // Verify new tables exist (from migrations 6-12)
        assert!(
            table_exists(&db_path, "gateway_stats").expect("Failed to check gateway_stats"),
            "New tables should exist after upgrade"
        );
        assert!(
            table_exists(&db_path, "download_queue").expect("Failed to check download_queue"),
            "New tables should exist after upgrade"
        );
        assert!(
            table_exists(&db_path, "search_history").expect("Failed to check search_history"),
            "New tables should exist after upgrade"
        );

        println!("✓ Successfully upgraded from v5 to current version {}", new_version);
    }

    #[tokio::test]
    async fn test_data_integrity_after_upgrade() {
        let (_temp_dir, db_path) = create_test_db_path();

        // Create v1 database with comprehensive test data
        create_v1_database(&db_path)
            .expect("Failed to create v1 database");

        let conn = Connection::open(&db_path).expect("Failed to open database");

        // Insert multiple favorites
        for i in 1..=5 {
            conn.execute(
                "INSERT INTO favorites (claimId, title, insertedAt) VALUES (?1, ?2, ?3)",
                [&format!("claim-{}", i), &format!("Movie {}", i), "1234567890"]
            ).expect("Failed to insert favorite");
        }

        // Insert multiple progress records
        for i in 1..=5 {
            conn.execute(
                "INSERT INTO progress (claimId, positionSeconds, quality, updatedAt) VALUES (?1, ?2, ?3, ?4)",
                [&format!("claim-{}", i), &format!("{}", i * 60), "720p", "1234567890"]
            ).expect("Failed to insert progress");
        }

        // Insert offline content
        for i in 1..=3 {
            conn.execute(
                "INSERT INTO offline_meta (claimId, quality, filename, fileSize, addedAt) VALUES (?1, ?2, ?3, ?4, ?5)",
                [&format!("claim-{}", i), "720p", &format!("movie-{}.mp4", i), "1000000", "1234567890"]
            ).expect("Failed to insert offline meta");
        }

        drop(conn);

        // Manually run migrations
        let conn = Connection::open(&db_path).expect("Failed to open database");
        let runner = MigrationRunner::new();
        runner.run_migrations(&conn).expect("Migrations should succeed");
        drop(conn);

        // Now create Database instance
        let db = Database::new_with_path(&db_path)
            .await
            .expect("Failed to create database");

        // Verify all data is preserved
        let conn = Connection::open(&db_path).expect("Failed to open database");

        let fav_count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM favorites",
            [],
            |row| row.get(0)
        ).expect("Failed to count favorites");
        assert_eq!(fav_count, 6, "All favorites should be preserved (5 + 1 from v1)");

        let prog_count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM progress",
            [],
            |row| row.get(0)
        ).expect("Failed to count progress");
        assert_eq!(prog_count, 6, "All progress records should be preserved (5 + 1 from v0)");

        let offline_count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM offline_meta",
            [],
            |row| row.get(0)
        ).expect("Failed to count offline meta");
        assert_eq!(offline_count, 3, "All offline content should be preserved");

        // Verify specific data integrity
        let title: String = conn.query_row(
            "SELECT title FROM favorites WHERE claimId = ?1",
            ["claim-3"],
            |row| row.get(0)
        ).expect("Failed to query specific favorite");
        assert_eq!(title, "Movie 3", "Specific data should be intact");

        let position: i32 = conn.query_row(
            "SELECT positionSeconds FROM progress WHERE claimId = ?1",
            ["claim-4"],
            |row| row.get(0)
        ).expect("Failed to query specific progress");
        assert_eq!(position, 240, "Specific progress should be intact");

        println!("✓ All data integrity preserved after upgrade");
    }

    #[tokio::test]
    async fn test_schema_evolution_correctness() {
        let (_temp_dir, db_path) = create_test_db_path();

        // Create v1 database
        create_v1_database(&db_path)
            .expect("Failed to create v1 database");

        // Verify v1 schema doesn't have new columns
        assert!(
            !column_exists(&db_path, "playlists", "totalDuration").expect("Failed to check column"),
            "totalDuration should not exist in v1"
        );
        assert!(
            !column_exists(&db_path, "local_cache", "codec_info").expect("Failed to check column"),
            "codec_info should not exist in v1"
        );

        // Manually run migrations
        let conn = Connection::open(&db_path).expect("Failed to open database");
        let runner = MigrationRunner::new();
        runner.run_migrations(&conn).expect("Migrations should succeed");
        drop(conn);

        // Now create Database instance
        let db = Database::new_with_path(&db_path)
            .await
            .expect("Failed to create database");

        // Verify new columns exist after migration
        assert!(
            column_exists(&db_path, "playlists", "totalDuration").expect("Failed to check column"),
            "totalDuration should exist after migration 3"
        );
        assert!(
            column_exists(&db_path, "playlists", "createdAt").expect("Failed to check column"),
            "createdAt should exist after migration 3"
        );
        assert!(
            column_exists(&db_path, "local_cache", "codec_info").expect("Failed to check column"),
            "codec_info should exist after migration 5"
        );
        assert!(
            column_exists(&db_path, "local_cache", "hls_support").expect("Failed to check column"),
            "hls_support should exist after migration 5"
        );

        println!("✓ Schema evolution applied correctly");
    }

    #[tokio::test]
    async fn test_migration_history_after_upgrade() {
        let (_temp_dir, db_path) = create_test_db_path();

        // Create v5 database
        create_v5_database(&db_path)
            .expect("Failed to create v5 database");

        // Manually run migrations
        let conn = Connection::open(&db_path).expect("Failed to open database");
        let runner = MigrationRunner::new();
        runner.run_migrations(&conn).expect("Migrations should succeed");
        drop(conn);

        // Now create Database instance
        let db = Database::new_with_path(&db_path)
            .await
            .expect("Failed to create database");

        // Verify migration history
        let conn = Connection::open(&db_path).expect("Failed to open database");
        let runner = MigrationRunner::new();
        let history = runner.get_migration_history(&conn)
            .expect("Failed to get migration history");

        // Should have all migrations from 1 to current
        assert!(history.len() >= 12, "Should have at least 13 migrations");

        // Verify migrations are in order
        for i in 0..history.len() - 1 {
            assert!(
                history[i].version < history[i + 1].version,
                "Migrations should be in order"
            );
        }

        // Verify all migrations have timestamps
        for migration in &history {
            assert!(
                migration.applied_at > 0,
                "Migration {} should have applied_at timestamp",
                migration.version
            );
        }

        println!("✓ Migration history correctly tracked after upgrade");
        println!("✓ Total migrations applied: {}", history.len());
    }

    #[tokio::test]
    async fn test_foreign_key_integrity_after_upgrade() {
        let (_temp_dir, db_path) = create_test_db_path();

        // Create v1 database with related data
        create_v1_database(&db_path)
            .expect("Failed to create v1 database");

        let conn = Connection::open(&db_path).expect("Failed to open database");

        // Insert playlist and items
        conn.execute(
            "INSERT INTO playlists (id, title, claimId, updatedAt) VALUES (?1, ?2, ?3, ?4)",
            ["playlist-1", "Test Series Season 1", "series-claim-1", "1234567890"]
        ).expect("Failed to insert playlist");

        conn.execute(
            "INSERT INTO playlist_items (playlistId, claimId, position) VALUES (?1, ?2, ?3)",
            ["playlist-1", "episode-1", "1"]
        ).expect("Failed to insert playlist item");

        drop(conn);

        // Manually run migrations
        let conn = Connection::open(&db_path).expect("Failed to open database");
        let runner = MigrationRunner::new();
        runner.run_migrations(&conn).expect("Migrations should succeed");
        drop(conn);

        // Now create Database instance
        let db = Database::new_with_path(&db_path)
            .await
            .expect("Failed to create database");

        // Verify foreign key integrity
        let conn = Connection::open(&db_path).expect("Failed to open database");

        let mut stmt = conn.prepare("PRAGMA foreign_key_check")
            .expect("Failed to prepare foreign key check");
        
        let violations: Vec<String> = stmt.query_map([], |row| row.get(0))
            .expect("Failed to query foreign key violations")
            .collect::<Result<Vec<String>, _>>()
            .expect("Failed to collect foreign key violations");

        assert!(
            violations.is_empty(),
            "No foreign key violations should exist after upgrade. Found: {:?}",
            violations
        );

        // Verify related data still exists
        let item_count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM playlist_items WHERE playlistId = ?1",
            ["playlist-1"],
            |row| row.get(0)
        ).expect("Failed to count playlist items");
        assert_eq!(item_count, 1, "Playlist items should be preserved");

        println!("✓ Foreign key integrity maintained after upgrade");
    }
}
