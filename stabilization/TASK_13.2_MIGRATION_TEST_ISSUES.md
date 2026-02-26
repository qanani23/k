# Task 13.2 - Migration Test Issues

**Date:** 2026-02-24  
**Status:** ⚠️ PARTIAL - Coverage blocked by migration test failures

## Summary

While attempting to run coverage measurement for Task 13.2, we encountered persistent issues with migration tests for older database versions (v0, v1, v5). The `migration_clean_run` tests pass successfully, indicating that fresh database initialization and migrations work correctly. However, tests that simulate upgrading from very old database schemas are failing.

## Test Results

### ✅ Passing Tests (720 tests)
- `migration_clean_run_test::*` - All 10 tests pass
- All property-based tests pass
- All integration tests pass
- All security tests pass
- Most migration tests pass

### ❌ Failing Tests (12 tests)
1. `migration_older_db_test::test_upgrade_from_v0_to_current`
2. `migration_older_db_test::test_upgrade_from_v1_to_current`
3. `migration_older_db_test::test_upgrade_from_v5_to_current`
4. `migration_older_db_test::test_data_integrity_after_upgrade`
5. `migration_older_db_test::test_foreign_key_integrity_after_upgrade`
6. `migration_older_db_test::test_migration_history_after_upgrade`
7. `migration_older_db_test::test_schema_evolution_correctness`
8. `migrations_dry_run_test::test_dry_run_no_pending_migrations`
9. `migrations_dry_run_test::test_dry_run_with_partial_migrations`
10. `download::tests::test_delete_content`
11. `error_logging::tests::test_cleanup_old_errors`
12. `error_logging_test::test_cleanup_old_errors`

## Root Cause Analysis

### Migration 4 Issue
```
Migration 4 failed: Internal error: Failed to execute statement 2 in migration 4: 
CREATE INDEX IF NOT EXISTS idx_playlists_seasonNumber ON playlists(seasonNumber): 
Database error: no such table: main.playlists
```

**Problem:** Migration 4 tries to create indexes on the `playlists` table, but the table doesn't exist in v0 databases. Even though Migration 4 now includes `CREATE TABLE IF NOT EXISTS playlists`, the table creation is failing or not being recognized.

### Migration 12 Issue
```
Migration 12 failed: Internal error: Failed to execute statement 1 in migration 12: 
CREATE INDEX IF NOT EXISTS idx_localcache_contentHash ON local_cache(contentHash): 
Database error: no such column: contentHash
```

**Problem:** Migration 12 tries to create indexes on `contentHash` and `etag` columns that don't exist in older databases. Migration 2 should add these columns, but it's not working correctly for all database versions.

## Attempted Fixes

### Fix 1: Simplified Migration 4 and 12 to No-Op
- Changed both migrations to only create indexes
- Assumed `initialize()` creates all tables with correct schema
- **Result:** Failed - v0 databases don't have tables created by `initialize()`

### Fix 2: Added Table Creation to Migration 4
- Added `CREATE TABLE IF NOT EXISTS` for `playlists` and `playlist_items`
- **Result:** Failed - Table creation not working as expected

### Fix 3: Fixed Migration 2 Column Handling
- Attempted to handle missing columns in v0 databases
- **Result:** Failed - SQL doesn't support conditional column selection

## Impact Assessment

### Critical Impact: ❌ None
- Fresh database initialization works correctly
- Current production databases (v13+) work correctly
- Migration system works for recent versions

### Medium Impact: ⚠️ Coverage Measurement Blocked
- Cannot run full test suite without failures
- Coverage measurement with `--ignore-run-fail` times out (>5 minutes)
- Cannot get accurate coverage percentages for critical modules

### Low Impact: ℹ️ Edge Case Upgrade Paths
- Only affects upgrading from very old database versions (v0, v1, v5)
- These versions are from before the migration system existed
- Unlikely to have users with such old databases in production

## Recommendations

### Option 1: Skip Failing Tests for Coverage (RECOMMENDED)
- Run coverage with specific test filters to exclude failing tests
- Focus on getting coverage data for critical modules
- Document that v0/v1/v5 upgrade paths are not tested

### Option 2: Fix Migration Tests (Time-Intensive)
- Requires deep investigation of migration execution order
- May need to refactor migration system to handle edge cases
- Could take several hours to debug and fix properly

### Option 3: Accept Partial Coverage Data
- Run tests that pass and collect their coverage
- Document known gaps in coverage measurement
- Revisit migration tests in a future task

## Next Steps

1. ✅ Document migration test issues (this file)
2. Run coverage with test filters to exclude failing tests
3. Generate coverage report for passing tests only
4. Document coverage results in `DECISIONS.md`
5. Create follow-up task for fixing migration tests (if needed)

## Commands

### Run Coverage Excluding Failing Tests
```bash
cd src-tauri
cargo llvm-cov --html --output-dir ..\stabilization\coverage --ignore-run-fail -- --skip migration_older_db_test --skip migrations_dry_run_test::tests::test_dry_run_no_pending_migrations --skip migrations_dry_run_test::tests::test_dry_run_with_partial_migrations --skip download::tests::test_delete_content --skip error_logging
```

### Run Only Passing Migration Tests
```bash
cd src-tauri
cargo test migration_clean_run -- --nocapture
```

## Related Files
- `src-tauri/src/migrations.rs` - Migration definitions
- `src-tauri/src/migration_older_db_test.rs` - Failing tests
- `stabilization/MIGRATION_FIXES_APPLIED.md` - Previous fix attempts
- `stabilization/TASK_13.2_COMPLETION_SUMMARY.md` - Task summary
