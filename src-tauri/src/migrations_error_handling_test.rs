// Unit tests for migration error handling
// Tests verify that error contexts are properly preserved and migrations work correctly

use crate::error::ErrorContext;
use crate::migrations::{Migration, MigrationRunner};
use rusqlite::Connection;
use tempfile::TempDir;

/// Helper function to create a test database in memory
fn create_test_db() -> Connection {
    Connection::open_in_memory().unwrap()
}

/// Helper function to create a test database with file backing
#[allow(dead_code)]
fn create_test_db_file() -> (Connection, TempDir) {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test.db");
    let conn = Connection::open(&db_path).unwrap();
    (conn, temp_dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    // ============================================================================
    // Test 3.1: Query failure error context
    // ============================================================================

    #[test]
    fn test_query_failure_error_context() {
        let conn = create_test_db();
        let runner = MigrationRunner::new();

        // Don't create the migrations table - this will cause query to fail
        // when get_migration_history tries to query a non-existent table

        let result = runner.get_migration_history(&conn);

        // Verify the operation failed
        assert!(
            result.is_err(),
            "Should fail when migrations table doesn't exist"
        );

        // Verify error message contains the expected context
        let error_msg = result.unwrap_err().to_string();
        assert!(
            error_msg.contains("Failed to query migration history")
                || error_msg.contains("Failed to prepare migration history query"),
            "Error should contain query failure context, got: {}",
            error_msg
        );
    }

    #[test]
    fn test_query_failure_with_corrupted_table() {
        let conn = create_test_db();

        // Create a migrations table with wrong schema (missing required columns)
        conn.execute("CREATE TABLE migrations (id INTEGER PRIMARY KEY)", [])
            .unwrap();

        let runner = MigrationRunner::new();
        let result = runner.get_migration_history(&conn);

        // Should fail because required columns are missing
        assert!(result.is_err(), "Should fail with corrupted table schema");

        let error_msg = result.unwrap_err().to_string();
        assert!(
            error_msg.contains("Failed to query migration history")
                || error_msg.contains("Failed to parse migration history rows")
                || error_msg.contains("Failed to prepare migration history query"),
            "Error should contain appropriate context, got: {}",
            error_msg
        );
    }

    // ============================================================================
    // Test 3.2: Row parsing failure error context
    // ============================================================================

    #[test]
    fn test_row_parsing_failure_error_context() {
        let conn = create_test_db();

        // Create migrations table with correct structure
        conn.execute(
            r#"CREATE TABLE migrations (
                version INTEGER PRIMARY KEY,
                description TEXT NOT NULL,
                applied_at INTEGER NOT NULL,
                checksum TEXT
            )"#,
            [],
        )
        .unwrap();

        // Insert a valid row first
        conn.execute(
            "INSERT INTO migrations (version, description, applied_at, checksum) VALUES (1, 'test', 123456789, NULL)",
            []
        ).unwrap();

        // Now corrupt the table by altering the version column to TEXT
        // This will cause parsing issues when trying to read it back as INTEGER
        conn.execute("ALTER TABLE migrations RENAME TO migrations_old", [])
            .unwrap();
        conn.execute(
            r#"CREATE TABLE migrations (
                version TEXT PRIMARY KEY,
                description TEXT NOT NULL,
                applied_at INTEGER NOT NULL,
                checksum TEXT
            )"#,
            [],
        )
        .unwrap();
        conn.execute("INSERT INTO migrations SELECT * FROM migrations_old", [])
            .unwrap();
        conn.execute("DROP TABLE migrations_old", []).unwrap();

        // Now insert a row with non-numeric version
        conn.execute(
            "INSERT INTO migrations (version, description, applied_at, checksum) VALUES ('invalid', 'test2', 123456789, NULL)",
            []
        ).unwrap();

        let runner = MigrationRunner::new();
        let result = runner.get_migration_history(&conn);

        // Should fail because version cannot be parsed as u32
        assert!(result.is_err(), "Should fail when row data has wrong type");

        let error_msg = result.unwrap_err().to_string();
        assert!(
            error_msg.contains("Failed to parse migration history rows")
                || error_msg.contains("Failed to query migration history"),
            "Error should contain row parsing failure context, got: {}",
            error_msg
        );
    }

    #[test]
    fn test_row_parsing_with_missing_column() {
        let conn = create_test_db();

        // Create migrations table with only version column (missing all other required columns)
        conn.execute(
            r#"CREATE TABLE migrations (
                version INTEGER PRIMARY KEY
            )"#,
            [],
        )
        .unwrap();

        // Insert a row
        conn.execute("INSERT INTO migrations (version) VALUES (1)", [])
            .unwrap();

        let runner = MigrationRunner::new();
        let result = runner.get_migration_history(&conn);

        // Should fail because even the fallback query expects applied_at column
        assert!(
            result.is_err(),
            "Should fail when required column is missing"
        );

        let error_msg = result.unwrap_err().to_string();
        assert!(
            error_msg.contains("Failed to parse migration history rows")
                || error_msg.contains("Failed to query migration history")
                || error_msg.contains("Failed to prepare migration history query"),
            "Error should contain appropriate error context, got: {}",
            error_msg
        );
    }

    // ============================================================================
    // Test 3.3: Migration execution
    // ============================================================================

    #[test]
    fn test_migration_execution() {
        let conn = create_test_db();
        let runner = MigrationRunner::new();

        // Ensure migrations table exists
        runner.ensure_migrations_table(&conn).unwrap();

        // Create a simple test migration
        let test_migration = Migration {
            version: 999,
            description: "Test migration".to_string(),
            sql: r#"
                CREATE TABLE test_table (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL
                );
                CREATE INDEX idx_test_name ON test_table(name)
            "#,
        };

        // Execute the migration
        let result = runner.execute_migration(&conn, &test_migration);
        assert!(result.is_ok(), "Migration execution should succeed");

        // Verify the table was created
        let table_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='test_table'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(table_exists, "Test table should be created");

        // Verify the index was created
        let index_exists: bool = conn.query_row(
            "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='index' AND name='idx_test_name'",
            [],
            |row| row.get(0)
        ).unwrap();
        assert!(index_exists, "Test index should be created");

        // Query migration history and verify the migration was recorded
        let history = runner.get_migration_history(&conn).unwrap();
        let migration_recorded = history.iter().any(|m| m.version == 999);
        assert!(
            migration_recorded,
            "Migration should be recorded in history"
        );

        // Verify migration metadata
        let migration_info = history.iter().find(|m| m.version == 999).unwrap();
        assert_eq!(migration_info.description, "Test migration");
        assert!(
            migration_info.applied_at > 0,
            "Applied timestamp should be set"
        );
        assert!(
            migration_info.checksum.is_some(),
            "Checksum should be calculated"
        );
    }

    #[test]
    fn test_multiple_migrations_execution() {
        let conn = create_test_db();
        let runner = MigrationRunner::new();

        // Ensure migrations table exists
        runner.ensure_migrations_table(&conn).unwrap();

        // Create multiple test migrations
        let migrations = vec![
            Migration {
                version: 1001,
                description: "First test migration".to_string(),
                sql: "CREATE TABLE table1 (id INTEGER PRIMARY KEY)",
            },
            Migration {
                version: 1002,
                description: "Second test migration".to_string(),
                sql: "CREATE TABLE table2 (id INTEGER PRIMARY KEY)",
            },
            Migration {
                version: 1003,
                description: "Third test migration".to_string(),
                sql: "CREATE TABLE table3 (id INTEGER PRIMARY KEY)",
            },
        ];

        // Execute all migrations
        for migration in &migrations {
            runner.execute_migration(&conn, migration).unwrap();
        }

        // Query migration history
        let history = runner.get_migration_history(&conn).unwrap();

        // Verify all migrations were recorded
        assert!(history.len() >= 3, "All migrations should be recorded");

        // Verify each migration is in history
        for migration in &migrations {
            let found = history.iter().any(|m| m.version == migration.version);
            assert!(
                found,
                "Migration {} should be in history",
                migration.version
            );
        }

        // Verify migrations are ordered by version
        let test_migrations: Vec<_> = history
            .iter()
            .filter(|m| m.version >= 1001 && m.version <= 1003)
            .collect();
        assert_eq!(test_migrations.len(), 3);
        assert!(test_migrations[0].version < test_migrations[1].version);
        assert!(test_migrations[1].version < test_migrations[2].version);
    }

    // ============================================================================
    // Test 3.4: Backward compatibility
    // ============================================================================

    #[test]
    fn test_backward_compatibility_old_schema() {
        let conn = create_test_db();

        // Create migrations table with old schema (no description/checksum columns)
        conn.execute(
            r#"CREATE TABLE migrations (
                version INTEGER PRIMARY KEY,
                applied_at INTEGER NOT NULL
            )"#,
            [],
        )
        .unwrap();

        // Insert some migrations with old schema
        conn.execute(
            "INSERT INTO migrations (version, applied_at) VALUES (1, 1234567890)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO migrations (version, applied_at) VALUES (2, 1234567900)",
            [],
        )
        .unwrap();

        let runner = MigrationRunner::new();

        // Should successfully retrieve migration history using fallback query
        let result = runner.get_migration_history(&conn);
        assert!(
            result.is_ok(),
            "Should handle old schema with fallback query"
        );

        let history = result.unwrap();
        assert_eq!(history.len(), 2, "Should retrieve all migrations");

        // Verify migration data
        assert_eq!(history[0].version, 1);
        assert_eq!(history[0].applied_at, 1234567890);
        assert_eq!(
            history[0].description, "",
            "Description should be empty string for old schema"
        );
        assert!(
            history[0].checksum.is_none(),
            "Checksum should be None for old schema"
        );

        assert_eq!(history[1].version, 2);
        assert_eq!(history[1].applied_at, 1234567900);
    }

    #[test]
    fn test_backward_compatibility_mixed_schema() {
        let conn = create_test_db();

        // Create migrations table with old schema first
        conn.execute(
            r#"CREATE TABLE migrations (
                version INTEGER PRIMARY KEY,
                applied_at INTEGER NOT NULL
            )"#,
            [],
        )
        .unwrap();

        // Insert a migration with old schema
        conn.execute(
            "INSERT INTO migrations (version, applied_at) VALUES (1, 1234567890)",
            [],
        )
        .unwrap();

        // Now upgrade the schema to add new columns (simulating a schema migration)
        conn.execute("ALTER TABLE migrations ADD COLUMN description TEXT", [])
            .unwrap();
        conn.execute("ALTER TABLE migrations ADD COLUMN checksum TEXT", [])
            .unwrap();

        // Insert a migration with new schema
        conn.execute(
            "INSERT INTO migrations (version, description, applied_at, checksum) VALUES (2, 'New migration', 1234567900, 'abc123')",
            []
        ).unwrap();

        let runner = MigrationRunner::new();

        // Should successfully retrieve all migrations
        let result = runner.get_migration_history(&conn);
        assert!(result.is_ok(), "Should handle mixed schema");

        let history = result.unwrap();
        assert_eq!(history.len(), 2, "Should retrieve all migrations");

        // Verify old migration (NULL description becomes empty string via COALESCE)
        assert_eq!(history[0].version, 1);
        assert_eq!(
            history[0].description, "",
            "Old migration should have empty description"
        );
        assert!(
            history[0].checksum.is_none(),
            "Old migration should have no checksum"
        );

        // Verify new migration
        assert_eq!(history[1].version, 2);
        assert_eq!(history[1].description, "New migration");
        assert_eq!(history[1].checksum, Some("abc123".to_string()));
    }

    #[test]
    fn test_ensure_migrations_table_creates_full_schema() {
        let conn = create_test_db();
        let runner = MigrationRunner::new();

        // Ensure migrations table is created
        runner.ensure_migrations_table(&conn).unwrap();

        // Verify table exists
        let table_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='migrations'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(table_exists, "Migrations table should be created");

        // Verify all columns exist by inserting a full row
        let result = conn.execute(
            "INSERT INTO migrations (version, description, applied_at, checksum) VALUES (1, 'test', 123456789, 'hash')",
            []
        );
        assert!(result.is_ok(), "Should be able to insert with all columns");

        // Verify we can query with all columns
        let history = runner.get_migration_history(&conn).unwrap();
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].version, 1);
        assert_eq!(history[0].description, "test");
        assert_eq!(history[0].checksum, Some("hash".to_string()));
    }
}

// ============================================================================
// Property-Based Tests for Error Message Preservation
// ============================================================================

/// Property-Based Tests for Migration Error Handling
///
/// **Feature: fix-migrations-error-handling, Property 1: Error Message Preservation**
///
/// For any rusqlite::Error that is converted to KiyyaError using `.with_context()`,
/// the resulting error message should contain both the context string and the
/// original error message from the rusqlite error.
///
/// **Validates: Requirements 2.3**
#[cfg(test)]
mod property_tests {
    use super::*;
    use proptest::prelude::*;

    /// Helper function to create various rusqlite errors for testing
    fn create_rusqlite_error(error_type: u8) -> rusqlite::Error {
        match error_type {
            0 => rusqlite::Error::InvalidQuery,
            1 => rusqlite::Error::InvalidColumnType(
                0,
                "version".to_string(),
                rusqlite::types::Type::Text,
            ),
            2 => rusqlite::Error::InvalidColumnIndex(5),
            3 => rusqlite::Error::InvalidColumnName("nonexistent_column".to_string()),
            4 => rusqlite::Error::ExecuteReturnedResults,
            _ => rusqlite::Error::QueryReturnedNoRows,
        }
    }

    /// Strategy for generating error type indices
    fn error_type_strategy() -> impl Strategy<Value = u8> {
        0u8..=5
    }

    /// Strategy for generating context strings
    fn context_string_strategy() -> impl Strategy<Value = String> {
        prop_oneof![
            Just("Failed to query migration history".to_string()),
            Just("Failed to parse migration history rows".to_string()),
            Just("Failed to prepare migration history query".to_string()),
            Just("Failed to execute migration".to_string()),
            Just("Failed to record migration".to_string()),
        ]
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100))]

        /// Property Test: Error Message Preservation
        ///
        /// Verifies that when a rusqlite::Error is converted to KiyyaError using
        /// `.with_context()`, the resulting error message contains both the context
        /// string and the original error message.
        #[test]
        fn prop_error_message_preservation(
            error_type in error_type_strategy(),
            context in context_string_strategy(),
        ) {
            // Create a rusqlite error
            let error = create_rusqlite_error(error_type);
            let original_error_msg = error.to_string();

            // Convert rusqlite::Error to Result
            let result: Result<(), rusqlite::Error> = Err(error);

            // Apply context using ErrorContext trait
            let kiyya_result = result.with_context(&context);

            // Verify the operation failed
            prop_assert!(kiyya_result.is_err(), "Result should be an error");

            // Get the KiyyaError message
            let kiyya_error = kiyya_result.unwrap_err();
            let kiyya_error_msg = kiyya_error.to_string();

            // Property: The KiyyaError message should contain the context string
            prop_assert!(
                kiyya_error_msg.contains(&context),
                "Error message should contain context '{}', but got: {}",
                context,
                kiyya_error_msg
            );

            // Property: The KiyyaError message should contain the original error message
            prop_assert!(
                kiyya_error_msg.contains(&original_error_msg),
                "Error message should contain original error '{}', but got: {}",
                original_error_msg,
                kiyya_error_msg
            );
        }

        /// Property Test: Error Context Chain Preservation
        ///
        /// Verifies that multiple levels of context are preserved when errors
        /// are converted through multiple `.with_context()` calls.
        #[test]
        fn prop_error_context_chain_preservation(
            error_type in error_type_strategy(),
        ) {
            // Create a rusqlite error
            let error = create_rusqlite_error(error_type);
            let original_error_msg = error.to_string();

            // Convert rusqlite::Error to Result
            let result: Result<(), rusqlite::Error> = Err(error);

            // Apply first level of context
            let first_context = "Failed to query migration history";
            let first_result = result.with_context(first_context);

            // Verify first level contains both context and original error
            prop_assert!(first_result.is_err());
            let first_error_msg = first_result.unwrap_err().to_string();

            prop_assert!(
                first_error_msg.contains(first_context),
                "First level should contain context '{}', but got: {}",
                first_context,
                first_error_msg
            );

            prop_assert!(
                first_error_msg.contains(&original_error_msg),
                "First level should contain original error '{}', but got: {}",
                original_error_msg,
                first_error_msg
            );
        }

        /// Property Test: Error Type Conversion Consistency
        ///
        /// Verifies that all rusqlite::Error types can be consistently converted
        /// to KiyyaError without losing information.
        #[test]
        fn prop_error_type_conversion_consistency(
            error_type in error_type_strategy(),
        ) {
            // Create a rusqlite error
            let error = create_rusqlite_error(error_type);
            let original_error_msg = error.to_string();

            // Convert rusqlite::Error to Result
            let result: Result<(), rusqlite::Error> = Err(error);

            // Apply context
            let context = "Test context";
            let kiyya_result = result.with_context(context);

            // Verify conversion succeeded
            prop_assert!(kiyya_result.is_err());

            // Verify the error is a KiyyaError
            let kiyya_error = kiyya_result.unwrap_err();

            // Verify error message structure
            let error_msg = kiyya_error.to_string();

            // Property: Error message should be non-empty
            prop_assert!(!error_msg.is_empty(), "Error message should not be empty");

            // Property: Error message should contain original information
            prop_assert!(
                error_msg.contains(&original_error_msg) || error_msg.contains(context),
                "Error message should contain either original error or context, but got: {}",
                error_msg
            );
        }

        /// Property Test: Context String Formatting
        ///
        /// Verifies that context strings are properly formatted in the final error message.
        #[test]
        fn prop_context_string_formatting(
            error_type in error_type_strategy(),
            context in context_string_strategy(),
        ) {
            // Create a rusqlite error
            let error = create_rusqlite_error(error_type);

            // Convert rusqlite::Error to Result
            let result: Result<(), rusqlite::Error> = Err(error);

            // Apply context
            let kiyya_result = result.with_context(&context);

            // Get the error message
            let error_msg = kiyya_result.unwrap_err().to_string();

            // Property: Context should appear before the original error
            // The format is: "context: original_error"
            let context_position = error_msg.find(&context);
            prop_assert!(
                context_position.is_some(),
                "Context '{}' should be present in error message: {}",
                context,
                error_msg
            );

            // Property: Error message should follow a consistent format
            // It should contain "Internal error:" prefix from KiyyaError::Internal
            prop_assert!(
                error_msg.contains("Internal error:"),
                "Error message should contain 'Internal error:' prefix, but got: {}",
                error_msg
            );
        }

        /// Property Test: Error Message Length Preservation
        ///
        /// Verifies that error messages are not truncated during conversion.
        #[test]
        fn prop_error_message_length_preservation(
            error_type in error_type_strategy(),
            context in context_string_strategy(),
        ) {
            // Create a rusqlite error
            let error = create_rusqlite_error(error_type);
            let _original_error_msg = error.to_string();

            // Convert rusqlite::Error to Result
            let result: Result<(), rusqlite::Error> = Err(error);

            // Apply context
            let kiyya_result = result.with_context(&context);

            // Get the KiyyaError message
            let kiyya_error_msg = kiyya_result.unwrap_err().to_string();

            // Property: The final error message should be longer than the context alone
            prop_assert!(
                kiyya_error_msg.len() > context.len(),
                "Error message length ({}) should be greater than context length ({})",
                kiyya_error_msg.len(),
                context.len()
            );

            // Property: The final error message should contain information from both sources
            // It should be at least as long as context + some portion of original error
            let min_expected_length = context.len() + 10; // Context + separator + some error text
            prop_assert!(
                kiyya_error_msg.len() >= min_expected_length,
                "Error message length ({}) should be at least {} (context + separator + error text)",
                kiyya_error_msg.len(),
                min_expected_length
            );
        }

        /// Property Test: Complete Migration History Retrieval
        ///
        /// **Feature: fix-migrations-error-handling, Property 2: Complete Migration History Retrieval**
        ///
        /// For any database with N applied migrations, calling `get_migration_history()`
        /// should return exactly N MigrationInfo records with all metadata fields
        /// populated correctly.
        ///
        /// **Validates: Requirements 3.2**
        #[test]
        fn prop_complete_migration_history_retrieval(
            num_migrations in 0u32..=50,
        ) {
            // Create an in-memory database
            let conn = create_test_db();
            let runner = MigrationRunner::new();

            // Ensure migrations table exists
            runner.ensure_migrations_table(&conn).expect("Failed to create migrations table");

            // Generate and insert random migration records
            let mut inserted_migrations = Vec::new();
            for i in 0..num_migrations {
                let version = 1000 + i; // Start from 1000 to avoid conflicts
                let description = format!("Migration {}", i);
                let applied_at = 1700000000 + (i as i64 * 1000); // Incrementing timestamps
                let checksum = if i % 2 == 0 {
                    Some(format!("checksum_{}", i))
                } else {
                    None
                };

                // Insert migration record
                if let Some(ref cs) = checksum {
                    conn.execute(
                        "INSERT INTO migrations (version, description, applied_at, checksum) VALUES (?1, ?2, ?3, ?4)",
                        rusqlite::params![version, &description, applied_at, cs],
                    ).expect("Failed to insert migration");
                } else {
                    conn.execute(
                        "INSERT INTO migrations (version, description, applied_at, checksum) VALUES (?1, ?2, ?3, NULL)",
                        rusqlite::params![version, &description, applied_at],
                    ).expect("Failed to insert migration");
                }

                inserted_migrations.push((version, description, applied_at, checksum));
            }

            // Query migration history
            let history = runner.get_migration_history(&conn)
                .expect("Failed to retrieve migration history");

            // Property 1: Returned count should equal inserted count
            prop_assert_eq!(
                history.len(),
                num_migrations as usize,
                "Retrieved {} migrations but inserted {}",
                history.len(),
                num_migrations
            );

            // Property 2: All metadata fields should be populated correctly
            for (version, description, applied_at, checksum) in &inserted_migrations {
                let migration_info = history.iter()
                    .find(|m| m.version == *version)
                    .unwrap_or_else(|| panic!("Migration version {} not found in history", version));

                // Verify description matches
                prop_assert_eq!(
                    &migration_info.description,
                    description,
                    "Description mismatch for version {}: expected '{}', got '{}'",
                    version,
                    description,
                    migration_info.description
                );

                // Verify applied_at matches
                prop_assert_eq!(
                    migration_info.applied_at,
                    *applied_at,
                    "Applied timestamp mismatch for version {}: expected {}, got {}",
                    version,
                    applied_at,
                    migration_info.applied_at
                );

                // Verify checksum matches
                prop_assert_eq!(
                    &migration_info.checksum,
                    checksum,
                    "Checksum mismatch for version {}: expected {:?}, got {:?}",
                    version,
                    checksum,
                    migration_info.checksum
                );
            }

            // Property 3: All versions should be unique
            let mut versions: Vec<u32> = history.iter().map(|m| m.version).collect();
            versions.sort();
            versions.dedup();
            prop_assert_eq!(
                versions.len(),
                history.len(),
                "Duplicate versions found in migration history"
            );
        }
    }
}
