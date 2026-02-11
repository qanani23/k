# Design Document: Fix Database Initialization Stack Overflow

## Overview

This design addresses a critical stack overflow bug in the Kiyya Desktop application caused by double execution of database migrations during startup. The fix involves removing the automatic migration call from `Database::new()` and ensuring migrations run only once through the setup hook.

The root cause is clear: migrations are executed twice—once in the `Database::new()` constructor (line 54 of database.rs) and again in the `.setup()` hook (line 173 of main.rs). Each migration execution spawns blocking tasks using `task::spawn_blocking`, and the double execution combined with the migration system's call stack depth causes stack overflow before the application can complete initialization.

The solution is straightforward: remove the `db.run_migrations().await?;` call from `Database::new()` and rely solely on the explicit migration call in the setup hook. This ensures migrations run exactly once and eliminates the redundant execution path.

## Architecture

### Current Flow (Problematic)

```
main()
  └─> initialize_app_state()
       └─> Database::new()
            ├─> initialize() [creates base schema]
            └─> run_migrations() [FIRST EXECUTION - spawns blocking tasks]
  └─> tauri::Builder::setup()
       └─> run_startup_migrations()
            └─> db.run_migrations() [SECOND EXECUTION - spawns blocking tasks]
                                     [STACK OVERFLOW OCCURS HERE]
```

### Fixed Flow (Proposed)

```
main()
  └─> initialize_app_state()
       └─> Database::new()
            └─> initialize() [creates base schema including migrations table]
  └─> tauri::Builder::setup()
       └─> run_startup_migrations()
            └─> db.run_migrations() [SINGLE EXECUTION - safe]
```

### Key Changes

1. **Remove automatic migration execution** from `Database::new()`
2. **Keep explicit migration execution** in the setup hook
3. **Maintain base schema initialization** in `Database::new()` (migrations table must exist)
4. **Preserve all existing functionality** (FTS5, connection pooling, etc.)

## Components and Interfaces

### Database Component

**Modified Methods:**

```rust
impl Database {
    /// Creates a new database instance with connection pooling
    /// NOTE: Does NOT run migrations - caller must explicitly call run_migrations()
    pub async fn new() -> Result<Self> {
        // ... existing code ...
        
        // Initialize database schema (base tables only)
        db.initialize().await?;
        
        // REMOVED: db.run_migrations().await?;
        
        // Check if FTS5 is available
        db.fts5_available = db.check_fts5_available().await?;
        
        // Initialize FTS5 if available
        if db.fts5_available {
            db.initialize_fts5().await?;
        }
        
        info!("Database initialized successfully at {:?} (FTS5: {})", db_path, db.fts5_available);
        Ok(db)
    }
    
    /// Runs pending database migrations using the new migration system
    /// This method is PUBLIC and must be called explicitly after Database::new()
    pub async fn run_migrations(&self) -> Result<()> {
        // ... existing implementation unchanged ...
    }
}
```

**Unchanged Methods:**
- `initialize()` - Creates base schema including migrations table
- `check_fts5_available()` - Tests FTS5 support
- `initialize_fts5()` - Sets up full-text search
- All other database operations remain unchanged

### Main Application Component

**Modified Flow:**

```rust
async fn main() {
    // ... logging and emergency disable checks ...
    
    // Initialize application state (Database::new() no longer runs migrations)
    let app_state = initialize_app_state().await
        .expect("Failed to initialize application state");

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(/* ... */)
        .setup(|app| {
            // Run database migrations on startup (SINGLE EXECUTION POINT)
            let app_handle = app.handle();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = run_startup_migrations(&app_handle).await {
                    tracing::error!("Failed to run database migrations: {}", e);
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

async fn run_startup_migrations(app_handle: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let state: State<AppState> = app_handle.state();
    let db = state.db.lock().await;
    
    // This is now the ONLY place migrations are executed
    db.run_migrations().await?;
    Ok(())
}
```

### Migration Runner Component

**No Changes Required:**

The `MigrationRunner` component in `migrations.rs` requires no modifications. It already:
- Validates migration checksums
- Executes migrations in transactions
- Handles rollback on failure
- Records migration history

The issue is not with the migration runner itself, but with it being called twice.

## Data Models

No changes to data models are required. All existing tables, schemas, and migrations remain unchanged:

- `migrations` table - tracks applied migrations
- `favorites` table - user favorites
- `progress` table - playback progress
- `offline_meta` table - downloaded content metadata
- `local_cache` table - content cache with FTS5 support
- `playlists` and `playlist_items` tables - playlist management
- All other tables defined in migrations 1-12

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the acceptance criteria analysis, we identify the following correctness properties:

### Property 1: Single Migration Execution

*For any* application startup sequence, migrations should be executed exactly once, regardless of how many times Database::new() is called or how the initialization flow proceeds.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Sequential Migration Application

*For any* set of pending migrations, when the Migration_Runner executes them, they should be applied in sequential version order (N, N+1, N+2, ...) without skipping versions.

**Validates: Requirements 3.1**

### Property 3: Migration Failure Rollback

*For any* migration that fails during execution, the Migration_Runner should rollback the transaction completely, leaving the database in its pre-migration state, and report a descriptive error.

**Validates: Requirements 3.2**

### Property 4: Migration Recording

*For any* migration that completes successfully, the Database should record an entry in the migrations table with the version, description, timestamp, and checksum.

**Validates: Requirements 3.3**

### Property 5: Checksum Validation

*For any* previously applied migration, if its checksum in the code differs from the recorded checksum in the database, the Migration_Runner should detect and report the discrepancy during validation.

**Validates: Requirements 3.4**

### Property 6: Backward Compatibility

*For any* existing database file with previously applied migrations, when opened by the fixed code, the Database should correctly recognize the applied migrations and only execute pending migrations.

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 7: Error Context Reporting

*For any* initialization or migration failure (connection failure, migration execution failure, etc.), the error message should include specific context about what failed, including version numbers, SQL statements, or connection details as appropriate.

**Validates: Requirements 7.1, 7.2, 7.3**

### Example-Based Tests

The following scenarios should be tested with specific examples:

**Example 1: Successful Application Startup**
- Start the application with a fresh database
- Verify it completes initialization without crashing
- Verify all 12 migrations are applied
- Verify the application is ready to handle commands
- **Validates: Requirements 1.1, 4.1**

**Example 2: Database::new() Does Not Run Migrations**
- Call Database::new() directly
- Verify the migrations table exists (base schema)
- Verify no migrations have been applied (migrations table is empty or at version 0)
- Verify connection pool is initialized
- **Validates: Requirements 1.2, 2.1, 2.2**

**Example 3: Setup Hook Executes Migrations**
- Initialize database with Database::new()
- Manually call run_startup_migrations() (simulating setup hook)
- Verify all pending migrations are applied
- **Validates: Requirements 1.3**

**Example 4: All Database Operations Work**
- Start the application successfully
- Test cache operations (store_content_items, get_cached_content)
- Test favorites operations (save_favorite, get_favorites)
- Test progress operations (save_progress, get_progress)
- Test playlist operations (create playlist, add items)
- Verify all operations complete successfully
- **Validates: Requirements 4.2**

**Example 5: FTS5 Initialization**
- Start the application on a system with FTS5 support
- Verify fts5_available flag is true
- Verify local_cache_fts virtual table exists
- Verify FTS5 triggers are created
- **Validates: Requirements 4.3**

**Example 6: Error Logging**
- Simulate a database initialization failure
- Verify error is logged with descriptive message
- Verify application handles the error gracefully
- **Validates: Requirements 7.4**

## Error Handling

### Migration Execution Errors

**Current Behavior (Preserved):**
- Each migration executes within a transaction
- On failure, transaction is rolled back
- Error includes migration version and failure reason
- Application logs the error and may exit

**No Changes Required:**
The existing error handling in `MigrationRunner::execute_migration()` is robust and should be preserved.

### Database Connection Errors

**Current Behavior (Preserved):**
- Connection failures include context about the database path
- Errors are wrapped with `ErrorContext` trait for additional information
- Application logs connection errors and exits

**No Changes Required:**
The existing error handling in `Database::get_connection()` and related methods is sufficient.

### Initialization Errors

**Current Behavior (Preserved):**
- `initialize_app_state()` returns Result and propagates errors
- Main function expects initialization to succeed or panics with descriptive message
- All errors are logged before propagation

**No Changes Required:**
The existing error handling in `main()` is appropriate.

## Testing Strategy

### Dual Testing Approach

This fix requires both unit tests and integration tests to ensure correctness:

**Unit Tests:**
- Test Database::new() in isolation
- Test that run_migrations() can be called independently
- Test migration runner behavior with various database states
- Test error conditions (connection failures, migration failures)

**Integration Tests:**
- Test full application startup sequence
- Test with existing database files (backward compatibility)
- Test with fresh database (first-time initialization)
- Test FTS5 initialization flow
- Test all database operations after initialization

### Property-Based Testing

For properties that involve "for any" statements, we will use property-based testing with the `proptest` crate (Rust's property testing library). Each property test should run a minimum of 100 iterations.

**Property Test Configuration:**
```rust
use proptest::prelude::*;

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    #[test]
    fn test_property_name(/* generated inputs */) {
        // Test implementation
        // Tag: Feature: fix-database-initialization-stack-overflow, Property N: [property text]
    }
}
```

**Property Tests to Implement:**

1. **Sequential Migration Application** (Property 2)
   - Generate random sets of pending migrations
   - Verify they execute in version order
   - Tag: `Feature: fix-database-initialization-stack-overflow, Property 2: Sequential migration application`

2. **Migration Failure Rollback** (Property 3)
   - Generate migrations that fail at random points
   - Verify database state is unchanged after rollback
   - Tag: `Feature: fix-database-initialization-stack-overflow, Property 3: Migration failure rollback`

3. **Migration Recording** (Property 4)
   - Generate random successful migrations
   - Verify each is recorded in migrations table
   - Tag: `Feature: fix-database-initialization-stack-overflow, Property 4: Migration recording`

4. **Checksum Validation** (Property 5)
   - Generate migrations with modified checksums
   - Verify validation detects discrepancies
   - Tag: `Feature: fix-database-initialization-stack-overflow, Property 5: Checksum validation`

5. **Backward Compatibility** (Property 6)
   - Generate databases with random migration states
   - Verify correct recognition and pending migration execution
   - Tag: `Feature: fix-database-initialization-stack-overflow, Property 6: Backward compatibility`

6. **Error Context Reporting** (Property 7)
   - Generate random failure scenarios
   - Verify error messages contain required context
   - Tag: `Feature: fix-database-initialization-stack-overflow, Property 7: Error context reporting`

### Test Organization

```
src-tauri/src/
├── database.rs (modified)
├── main.rs (modified)
├── migrations.rs (unchanged)
└── tests/
    ├── database_initialization_test.rs (new - unit tests)
    ├── migration_property_test.rs (new - property tests)
    └── integration_test.rs (new - integration tests)
```

### Existing Tests

All existing tests should continue to pass:
- `logging_test.rs`
- `emergency_disable_test.rs`
- `sql_injection_test.rs`
- `input_validation_test.rs`
- `search_test.rs`
- `monitoring_local_test.rs`
- `api_parsing_test.rs`
- `cache_ttl_property_test.rs`
- `gateway_failover_property_test.rs`
- `http_range_property_test.rs`
- `content_parsing_property_test.rs`
- `migrations_error_handling_test.rs`
- All channel ID property tests

### Manual Testing

After implementing the fix:

1. **Fresh Installation Test:**
   - Delete existing database file
   - Run `npm run tauri:dev`
   - Verify application starts without crashing
   - Verify all 12 migrations are applied
   - Verify application is functional

2. **Existing Database Test:**
   - Use an existing database file from a previous version
   - Run `npm run tauri:dev`
   - Verify application starts without crashing
   - Verify only new migrations (if any) are applied
   - Verify existing data is preserved

3. **Stress Test:**
   - Start and stop the application multiple times
   - Verify no stack overflow occurs
   - Verify migrations are not re-applied

## Implementation Notes

### Critical Changes

1. **database.rs line 54:** Remove `db.run_migrations().await?;`
2. **main.rs line 173:** Keep the existing `run_startup_migrations()` call in setup hook

### Non-Critical Changes

None. The fix is minimal and surgical—only removing one line of code.

### Rollback Plan

If the fix causes issues:
1. Revert the single line removal in database.rs
2. The application will return to its previous (crashing) state
3. Investigate alternative solutions (e.g., migration runner optimization)

### Performance Considerations

**Expected Improvements:**
- Faster startup time (migrations run once instead of twice)
- Reduced memory usage (fewer blocking tasks spawned)
- Lower stack usage (no redundant call stack depth)

**No Performance Degradation:**
The fix removes redundant work, so there should be no performance degradation.

### Security Considerations

No security implications. The fix does not change:
- SQL injection prevention (sanitization still in place)
- Path security (validation still in place)
- Encryption (unchanged)
- Authentication (unchanged)

### Compatibility Considerations

**Backward Compatible:**
- Existing database files work without modification
- Migration history is preserved
- All existing features continue to work

**Forward Compatible:**
- New migrations can be added using the existing system
- Migration runner behavior is unchanged
- Database schema evolution continues as before
