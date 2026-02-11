# Implementation Plan: Fix Database Initialization Stack Overflow

## Overview

This implementation plan addresses the critical stack overflow bug by removing the redundant migration execution from `Database::new()`. The fix is surgical—removing a single line of code—but requires comprehensive testing to ensure no regressions are introduced.

## Tasks

- [x] 1. Remove redundant migration call from Database::new()
  - Open `src-tauri/src/database.rs`
  - Locate the `Database::new()` method (around line 30-60)
  - Remove the line `db.run_migrations().await?;` (around line 54)
  - Update the doc comment to clarify that migrations are NOT run automatically
  - Add a note that callers must explicitly call `run_migrations()` after initialization
  - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.2_

- [x] 2. Verify setup hook migration execution remains intact
  - Open `src-tauri/src/main.rs`
  - Verify the `.setup()` hook still contains the `run_startup_migrations()` call (around line 173)
  - Ensure no changes are needed to the setup hook
  - Verify the async spawn is correctly structured
  - _Requirements: 1.3_

- [x] 3. Add unit tests for Database initialization
  - [x] 3.1 Create test file for database initialization
    - Create `src-tauri/src/tests/database_initialization_test.rs`
    - Set up test module with necessary imports
    - Add helper functions for creating test databases
    - _Requirements: 1.2, 2.1, 2.2_
  
  - [x] 3.2 Write test: Database::new() does not run migrations
    - Create a test that calls Database::new()
    - Verify the migrations table exists but is empty (or at version 0)
    - Verify connection pool is initialized
    - Verify base schema tables exist
    - _Requirements: 1.2, 2.1_
  
  - [x] 3.3 Write test: run_migrations() can be called independently
    - Create a test that calls Database::new() then run_migrations()
    - Verify migrations are applied after the explicit call
    - Verify all 12 migrations are recorded
    - _Requirements: 1.3, 2.3_
  
  - [x] 3.4 Write test: Successful application startup
    - Simulate the full startup sequence (Database::new() + run_migrations())
    - Verify no crashes occur
    - Verify all migrations are applied
    - Verify database is ready for operations
    - _Requirements: 1.1, 4.1_

- [x] 4. Add property-based tests for migration behavior
  - [x] 4.1 Create test file for migration properties
    - Create `src-tauri/src/tests/migration_property_test.rs`
    - Add proptest dependency configuration
    - Set up test module with proptest imports
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [x] 4.2 Write property test: Sequential migration application
    - **Property 2: Sequential Migration Application**
    - Generate random sets of pending migrations with different version numbers
    - Execute migrations and verify they are applied in sequential order
    - Verify no versions are skipped
    - Tag: `Feature: fix-database-initialization-stack-overflow, Property 2: Sequential migration application`
    - **Validates: Requirements 3.1**
  
  - [x] 4.3 Write property test: Migration failure rollback
    - **Property 3: Migration Failure Rollback**
    - Generate migrations that fail at random points (invalid SQL, constraint violations)
    - Verify database state is unchanged after rollback
    - Verify error is reported with migration version
    - Tag: `Feature: fix-database-initialization-stack-overflow, Property 3: Migration failure rollback`
    - **Validates: Requirements 3.2**
  
  - [x] 4.4 Write property test: Migration recording
    - **Property 4: Migration Recording**
    - Generate random successful migrations
    - Verify each migration is recorded in the migrations table
    - Verify version, description, timestamp, and checksum are stored
    - Tag: `Feature: fix-database-initialization-stack-overflow, Property 4: Migration recording`
    - **Validates: Requirements 3.3**
  
  - [x] 4.5 Write property test: Checksum validation
    - **Property 5: Checksum Validation**
    - Generate migrations and record them with specific checksums
    - Modify the checksums in the database
    - Verify validation detects the discrepancy
    - Tag: `Feature: fix-database-initialization-stack-overflow, Property 5: Checksum validation`
    - **Validates: Requirements 3.4**
  
  - [x] 4.6 Write property test: Backward compatibility
    - **Property 6: Backward Compatibility**
    - Generate databases with random migration states (versions 0-12)
    - Open each database with the fixed code
    - Verify previously applied migrations are recognized
    - Verify only pending migrations are executed
    - Tag: `Feature: fix-database-initialization-stack-overflow, Property 6: Backward compatibility`
    - **Validates: Requirements 6.1, 6.2, 6.3**
  
  - [x] 4.7 Write property test: Error context reporting
    - **Property 7: Error Context Reporting**
    - Generate random failure scenarios (connection failures, migration failures)
    - Verify error messages contain specific context (version, SQL, path)
    - Verify error messages are descriptive and actionable
    - Tag: `Feature: fix-database-initialization-stack-overflow, Property 7: Error context reporting`
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [x] 5. Add integration tests for full application startup
  - [x] 5.1 Create integration test file
    - Create `src-tauri/src/tests/integration_test.rs`
    - Set up test module for integration testing
    - Add helpers for simulating full application startup
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 5.2 Write integration test: Fresh database initialization
    - Delete any existing test database
    - Run full application startup sequence
    - Verify application completes initialization without crashing
    - Verify all 12 migrations are applied
    - Verify database operations work (cache, favorites, progress, playlists)
    - _Requirements: 4.1, 4.2_
  
  - [x] 5.3 Write integration test: Existing database compatibility
    - Create a test database with migrations 1-10 applied
    - Run application startup sequence
    - Verify application recognizes existing migrations
    - Verify only migrations 11-12 are applied
    - Verify existing data is preserved
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [x] 5.4 Write integration test: FTS5 initialization
    - Run application startup on a system with FTS5 support
    - Verify fts5_available flag is set correctly
    - Verify local_cache_fts virtual table is created
    - Verify FTS5 triggers are created
    - Test full-text search functionality
    - _Requirements: 4.3_
  
  - [x] 5.5 Write integration test: Error logging
    - Simulate database initialization failure (invalid path, permissions)
    - Verify error is logged with descriptive message
    - Verify application handles error gracefully
    - _Requirements: 7.4_

- [x] 6. Checkpoint - Run all tests and verify no regressions
  - Run `cargo test` to execute all unit and integration tests
  - Verify all new tests pass
  - Verify all existing tests still pass (no regressions)
  - Fix any test failures before proceeding
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Manual testing with the application
  - [x] 7.1 Test fresh installation
    - Delete existing database file (`~/.kiyya/app.db` or equivalent)
    - Run `npm run tauri:dev`
    - Verify application starts without stack overflow
    - Verify application UI loads correctly
    - Test basic functionality (browse content, search, favorites)
    - _Requirements: 1.1, 4.1, 4.2_
  
  - [x] 7.2 Test with existing database
    - Use an existing database file from a previous version
    - Run `npm run tauri:dev`
    - Verify application starts without stack overflow
    - Verify existing data is preserved (favorites, progress, playlists)
    - Verify new migrations (if any) are applied
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [x] 7.3 Test multiple startup cycles
    - Start the application
    - Close the application
    - Repeat 5-10 times
    - Verify no stack overflow occurs on any startup
    - Verify migrations are not re-applied
    - _Requirements: 1.1, 5.1, 5.2, 5.3, 5.4_

- [x] 8. Update documentation
  - [x] 8.1 Update Database::new() documentation
    - Add clear documentation that migrations are NOT run automatically
    - Document that callers must explicitly call run_migrations()
    - Add example usage showing the correct initialization pattern
    - _Requirements: 2.3, 2.4_
  
  - [x] 8.2 Update main.rs comments
    - Add comment explaining why migrations run in setup hook
    - Document the single execution point for migrations
    - Add reference to the bug fix
    - _Requirements: 1.1, 1.3_

- [x] 9. Final checkpoint - Comprehensive verification
  - Run full test suite: `cargo test`
  - Run application manually: `npm run tauri:dev`
  - Verify no stack overflow occurs
  - Verify all functionality works as expected
  - Verify no performance regressions
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive bug fix and test coverage
- The core fix is in task 1 (removing one line of code)
- Tasks 3-5 provide comprehensive test coverage to prevent regressions
- Tasks 6-9 ensure the fix works in practice and is well-documented
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties
- Integration tests validate end-to-end functionality
