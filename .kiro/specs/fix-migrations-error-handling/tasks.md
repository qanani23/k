# Implementation Plan: Fix Migrations Error Handling

## Overview

This plan fixes the compilation error in `src-tauri/src/migrations.rs` by correcting the error handling in the `get_migration_history` method. The fix ensures proper error type conversion from `rusqlite::Error` to `KiyyaError` without breaking the type chain.

## Tasks

- [x] 1. Fix error handling in `get_migration_history` method
  - Replace manual iteration with `.collect()` to handle error conversion uniformly
  - Remove the manual loop that calls `.with_context()` on individual row results
  - Use `.collect::<std::result::Result<Vec<_>, _>>()` followed by `.with_context()` for proper error conversion
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Verify compilation success
  - Run `cargo build` to verify the application compiles without errors
  - Check that no type conversion errors exist in migrations.rs
  - Verify the build completes successfully
  - _Requirements: 1.1, 4.1, 4.2, 4.3_

- [x] 3. Write unit tests for error handling
  - [x] 3.1 Test query failure error context
    - Create a test that forces a query failure
    - Verify error message contains "Failed to query migration history"
    - _Requirements: 2.1_
  
  - [x] 3.2 Test row parsing failure error context
    - Create a test with invalid data types in migrations table
    - Verify error message contains "Failed to parse migration history rows"
    - _Requirements: 2.2_
  
  - [x] 3.3 Test migration execution
    - Apply migrations to a fresh in-memory database
    - Verify all migrations execute successfully
    - Query migration history and verify results
    - _Requirements: 3.1_
  
  - [x] 3.4 Test backward compatibility
    - Create a database with old schema (no description/checksum columns)
    - Verify fallback query logic works correctly
    - Verify migration history is retrieved successfully
    - _Requirements: 3.3_

- [x] 4. Write property tests for error handling
  - [x] 4.1 Property test: Error message preservation
    - **Property 1: Error Message Preservation**
    - Generate various rusqlite errors (connection errors, query errors, type errors)
    - Convert each to KiyyaError using `.with_context()`
    - Verify original error message is preserved in the KiyyaError message
    - Configure test to run minimum 100 iterations
    - **Validates: Requirements 2.3**
  
  - [x] 4.2 Property test: Complete migration history retrieval
    - **Property 2: Complete Migration History Retrieval**
    - Generate in-memory databases with random numbers of applied migrations (0-50)
    - For each database, insert random migration records
    - Query migration history using `get_migration_history()`
    - Verify returned count equals inserted count
    - Verify all metadata fields (version, description, applied_at, checksum) are populated correctly
    - Configure test to run minimum 100 iterations
    - **Validates: Requirements 3.2**

- [x] 5. Final verification
  - Run all tests to ensure they pass
  - Run `cargo build` to confirm compilation success
  - Verify no regressions in existing migration functionality
  - _Requirements: 1.1, 3.1, 3.2, 3.3_

## Notes

- The core fix is in task 1 - this is the minimal change needed to resolve the compilation error
- Task 2 verifies the fix works
- Tasks 3 and 4 provide comprehensive test coverage
- Property tests use a minimum of 100 iterations for thorough randomized testing
- Each property test references its design document property for traceability
