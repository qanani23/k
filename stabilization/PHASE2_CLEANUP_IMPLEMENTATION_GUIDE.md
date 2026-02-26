# Phase 2 Cleanup Implementation Guide

**Date:** 2026-02-22  
**Purpose:** Consolidated implementation guide for Phase 2 cleanup tasks  
**Source Documents:**
- TASK_5.1_SAFE_TO_DELETE_LIST.md
- TASK_5.2_POSSIBLY_LEGACY_LIST.md
- TASK_5.3_INCOMPLETE_FEATURE_LIST.md

## Overview

This guide provides step-by-step instructions for implementing Phase 2 cleanup based on audit findings. All recommendations are organized by priority and include specific file locations, line numbers, and verification commands.

**Total Items to Process:** 103 items  
**Estimated Cleanup Time:** 8-12 hours  
**Expected Lines Removed:** ~2,700 lines

---

## Quick Reference Summary

### Items to Remove (Priority 1)
- **Safe to Delete:** 33 items (~1,247 lines)
- **Incomplete Features:** 6 features (~1,472 lines)
- **Total Removal:** 39 items (~2,719 lines)

### Items to Keep with Annotations (Priority 2)
- **Possibly Legacy:** 12 items (~465 lines) - Add `#[allow(dead_code)]`
- **Future Features:** 3 features (~270 lines) - Add `#[allow(dead_code)]`
- **Total Annotated:** 15 items (~735 lines)

### Items to Integrate (Priority 3)
- **Maintenance Utilities:** 1 item (`cleanup_all()`) - Expose as Tauri command

---

## Phase 2 Implementation Order

### Step 1: Create Canary PR (MANDATORY)
### Step 2: Remove Safe-to-Delete Items (Priority 1)
### Step 3: Remove Incomplete Features (Priority 1)
### Step 4: Add Allow Annotations (Priority 2)
### Step 5: Integrate Useful Utilities (Priority 3)
### Step 6: Verification and Testing
### Step 7: Documentation Updates

---

## STEP 1: Create Canary PR (MANDATORY)

**Purpose:** Verify deletions are safe before merging

**Actions:**
1. Create new branch: `feature/stabilize/phase2-canary`
2. Include ALL proposed deletions from Steps 2-3
3. Run full test suite in CI
4. Allow reviewers 48 hours to verify
5. **DO NOT MERGE** - Use only for verification

**Verification:**
```bash
# Create canary branch
git checkout -b feature/stabilize/phase2-canary

# Make all deletions (Steps 2-3)
# ... perform deletions ...

# Run tests
cargo test
npm test

# Push for CI verification
git push origin feature/stabilize/phase2-canary

# Create PR with label "canary-pr-do-not-merge"
```

**Success Criteria:**
- All tests pass in CI
- No hidden dependencies discovered
- Reviewers approve safety of deletions

---

## STEP 2: Remove Safe-to-Delete Items

**Total:** 33 items, ~1,247 lines  
**Estimated Time:** 3-4 hours



### 2.1 Backend - commands.rs

**File:** `src-tauri/src/commands.rs`

#### Remove: validate_cdn_reachability()
- **Location:** Line 206
- **Lines:** ~20
- **Reason:** No grep hits in codebase

```rust
// DELETE THIS FUNCTION:
pub fn validate_cdn_reachability(url: &str) -> Result<bool> {
    // ... entire function ...
}
```

**Verification:**
```bash
rg "validate_cdn_reachability" src-tauri
# Should return: 0 hits after deletion
```

---

### 2.2 Backend - database.rs

**File:** `src-tauri/src/database.rs`

#### Remove: update_content_access()
- **Location:** Line 902
- **Lines:** ~15
- **Reason:** No grep hits in codebase

#### Remove: invalidate_cache_before()
- **Location:** Line 1859
- **Lines:** ~20
- **Reason:** No grep hits in codebase

#### Remove: cleanup_all()
- **Location:** Line 1890
- **Lines:** ~25
- **Reason:** Will be re-added as Tauri command in Step 5

#### Remove: rerun_migration()
- **Location:** Line 1941
- **Lines:** ~30
- **Reason:** Dangerous and unused

**Verification:**
```bash
rg "\.update_content_access\(|\.invalidate_cache_before\(|\.cleanup_all\(|\.rerun_migration\(" src-tauri
# Should return: 0 hits after deletion
```

---

### 2.3 Backend - download.rs

**File:** `src-tauri/src/download.rs`

#### Remove: Unused Import
```rust
// DELETE THIS IMPORT:
use futures_util::StreamExt;
```

#### Remove: Unused Struct Fields
```rust
pub struct DownloadManager {
    client: Client,
    // DELETE THESE FIELDS:
    connection_pool: Arc<Mutex<Vec<Client>>>,
    max_connections: usize,
}
```

#### Remove: Unused Methods
- `get_connection()` (~15 lines)
- `return_connection()` (~10 lines)
- `get_content_length()` (~20 lines)

**Verification:**
```bash
rg "connection_pool|max_connections|get_connection|return_connection|get_content_length" src-tauri/src/download.rs
# Should return: 0 hits after deletion
```

---

### 2.4 Backend - encryption.rs

**File:** `src-tauri/src/encryption.rs`

#### Remove: Unused Constants
```rust
// DELETE THESE CONSTANTS:
const KEYRING_SERVICE: &str = "kiyya-desktop";
const KEYRING_USER: &str = "default";
const KEY_SIZE: usize = 32;
```

#### Remove: Unused Struct Field
```rust
pub struct EncryptedData {
    pub data: Vec<u8>,
    pub nonce: Vec<u8>,
    // DELETE THIS FIELD:
    encrypted_size: usize,
}
```

#### Remove: Unused Struct
```rust
// DELETE THIS ENTIRE STRUCT:
pub struct EncryptionConfig {
    // ... entire struct ...
}
```

**Verification:**
```bash
rg "KEYRING_SERVICE|KEYRING_USER|KEY_SIZE|EncryptionConfig|encrypted_size" src-tauri/src/encryption.rs
# Should return: 0 hits after deletion
```

---

### 2.5 Backend - error.rs

**File:** `src-tauri/src/error.rs`

#### Remove: ErrorContext Struct
```rust
// DELETE THIS ENTIRE STRUCT AND ALL METHODS:
pub struct ErrorContext {
    // ... entire struct ...
}

impl ErrorContext {
    pub fn new() { /* ... */ }
    pub fn with_user_action() { /* ... */ }
    pub fn with_context() { /* ... */ }
    pub fn with_stack_trace() { /* ... */ }
    pub fn to_json() { /* ... */ }
}
```

#### Remove: get_error_code()
```rust
// DELETE THIS FUNCTION:
pub fn get_error_code(error: &KiyyaError) -> String {
    // ... entire function ...
}
```

**Verification:**
```bash
rg "ErrorContext|get_error_code" src-tauri --type rust | grep -v "^src-tauri/src/error.rs"
# Should return: 0 hits after deletion
```

---

### 2.6 Backend - gateway.rs

**File:** `src-tauri/src/gateway.rs`

#### Remove: Unused Imports
```rust
// DELETE THESE IMPORTS:
use crate::security_logging::{SecurityEvent, log_security_event};
```

#### Remove: Unused Struct Field
```rust
pub struct GatewayClient {
    client: Client,
    // DELETE THIS FIELD:
    current_gateway: Arc<Mutex<String>>,
}
```

#### Remove: Unused Structs
```rust
// DELETE THESE ENTIRE STRUCTS:
pub struct GatewayConfig {
    // ... entire struct ...
}

pub struct RangeRequest {
    // ... entire struct ...
}

impl RangeRequest {
    pub fn from_header() { /* ... */ }
    pub fn to_content_range() { /* ... */ }
    pub fn actual_end() { /* ... */ }
    pub fn byte_count() { /* ... */ }
}
```

**Verification:**
```bash
rg "GatewayConfig|RangeRequest|current_gateway" src-tauri/src/gateway.rs
# Should return: 0 hits after deletion
```

---

### 2.7 Backend - logging.rs

**File:** `src-tauri/src/logging.rs`

#### Remove: LoggingConfig Struct
```rust
// DELETE THIS ENTIRE STRUCT:
pub struct LoggingConfig {
    // ... entire struct ...
}
```

#### Remove: init_logging_with_config()
```rust
// DELETE THIS FUNCTION:
pub fn init_logging_with_config(config: LoggingConfig) -> Result<()> {
    // ... entire function ...
}
```

**Verification:**
```bash
rg "LoggingConfig|init_logging_with_config" src-tauri --type rust | grep -v "^src-tauri/src/logging.rs"
# Should return: 0 hits after deletion
```

---

### 2.8 Backend - server.rs

**File:** `src-tauri/src/server.rs`

#### Remove: Unused Struct Field
```rust
pub struct LocalServer {
    // ... other fields ...
    // DELETE THIS FIELD:
    vault_path: PathBuf,
}
```

**Verification:**
```bash
rg "\.vault_path" src-tauri
# Should return: 0 hits after deletion
```

---

### 2.9 Frontend - Delete Entire Files

#### Delete: PlayerModal.refactored.tsx
- **File:** `src/components/PlayerModal.refactored.tsx`
- **Lines:** ~600
- **Reason:** Never imported or used

```bash
# DELETE FILE:
rm src/components/PlayerModal.refactored.tsx
```

#### Delete: PlayerAdapter.ts
- **File:** `src/lib/player/PlayerAdapter.ts`
- **Lines:** ~337
- **Reason:** Only used by unused PlayerModal.refactored.tsx

```bash
# DELETE FILE:
rm src/lib/player/PlayerAdapter.ts
```

**Verification:**
```bash
rg "PlayerModal\.refactored|PlayerAdapter" src --type ts --type tsx
# Should return: 0 hits after deletion
```

---

### 2.10 Frontend - Fix Unused Variables

**File:** `src/lib/idle.ts`

#### Remove: IdleCallback Type
```typescript
// DELETE THIS TYPE:
type IdleCallback = () => void;
```

**File:** `src/lib/memoryManager.ts`

#### Remove: now Variable
```typescript
// Line 200 - DELETE THIS VARIABLE:
const now = Date.now();  // ← Never used
```

**File:** `src/hooks/useContent.ts`

#### Remove: seriesKey Variable
```typescript
// Line 603 - DELETE THIS VARIABLE:
const seriesKey = generateSeriesKey(item);  // ← Never used
```

**Verification:**
```bash
npx eslint . --ext ts,tsx | grep "never used"
# Should return: 0 warnings after fixes
```

---

## STEP 3: Remove Incomplete Features

**Total:** 6 features, ~1,472 lines  
**Estimated Time:** 2-3 hours

### 3.1 Remove Error Logging Write Functions

**File:** `src-tauri/src/error_logging.rs`

#### Remove These Functions:
- `log_error()` (Line 399, ~15 lines)
- `log_error_simple()` (~15 lines)
- `log_result_error()` (~15 lines)
- `log_result_error_simple()` (~15 lines)
- `mark_error_resolved()` (~20 lines)
- `cleanup_old_errors()` (~25 lines)

#### Keep These Functions:
- ✅ `get_error_stats()` - Used by diagnostics
- ✅ `get_recent_errors()` - Used by diagnostics

**Verification:**
```bash
rg "log_error\(|log_error_simple\(|log_result_error\(|mark_error_resolved\(|cleanup_old_errors\(" src-tauri --type rust
# Should return: 0 hits after deletion (except in tests)
```

---

### 3.2 Remove Delta Update System

**File:** `src-tauri/src/database.rs`

#### Remove These Methods:
- `get_content_hash()` (~20 lines)
- `get_content_hashes()` (~25 lines)
- `store_content_items_delta()` (~40 lines)
- `get_changed_items()` (~30 lines)

#### Remove These Tests:
- `test_delta_update_no_changes()` (database.rs:3760)
- `test_delta_update_with_changes()`
- `test_delta_update_new_items()`
- `test_get_changed_items()`

**Total Removal:** ~180 lines

**Verification:**
```bash
rg "get_content_hash|store_content_items_delta|get_changed_items" src-tauri --type rust
# Should return: 0 hits after deletion
```

---

### 3.3 Remove Chunked Query System

**File:** `src-tauri/src/database.rs`

#### Remove This Method:
- `query_content_chunked()` (Line 2245, ~40 lines)

**Verification:**
```bash
rg "query_content_chunked" src-tauri
# Should return: 0 hits after deletion
```

---

### 3.4 Remove Connection Pooling System

**File:** `src-tauri/src/download.rs`

**Already covered in Step 2.3** - No additional action needed

---

### 3.5 Remove HTTP Range Request System

**File:** `src-tauri/src/gateway.rs`

**Already covered in Step 2.6** - No additional action needed

---

### 3.6 Remove Refactored Player System

**Already covered in Step 2.9** - No additional action needed

---

## STEP 4: Add Allow Annotations

**Total:** 15 items, ~735 lines  
**Estimated Time:** 1-2 hours

### 4.1 Possibly Legacy Items (database.rs)

**File:** `src-tauri/src/database.rs`

#### Add Annotations to Raw SQL Methods:
```rust
#[allow(dead_code)]
pub fn execute_sql(&self, sql: &str) -> Result<()> {
    // Note: Used by error_logging.rs for error log queries
    // ... existing code ...
}

#[allow(dead_code)]
pub fn query_sql(&self, sql: &str) -> Result<Vec<Row>> {
    // Note: Used by error_logging.rs for error log queries
    // ... existing code ...
}

#[allow(dead_code)]
pub fn query_one_sql(&self, sql: &str) -> Result<Option<Row>> {
    // Note: Reserved for future advanced queries
    // ... existing code ...
}
```

---

### 4.2 Security Logging Unused Variants

**File:** `src-tauri/src/security_logging.rs`

#### Add Annotation to Enum:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]  // ← ADD THIS
pub enum SecurityEvent {
    // Used variants:
    InputValidationFailure { /* ... */ },
    NetworkViolation { /* ... */ },
    EncryptionKeyOperation { /* ... */ },
    RateLimitTriggered { /* ... */ },
    
    // Future use variants:
    PathViolation { /* ... */ },
    SqlInjectionAttempt { /* ... */ },
    AuthenticationFailure { /* ... */ },
    AuthorizationFailure { /* ... */ },
    SuspiciousActivity { /* ... */ },
}
```

#### Add Annotation to Batch Function:
```rust
#[allow(dead_code)]  // ← ADD THIS
pub fn log_security_events(events: Vec<SecurityEvent>) {
    // Note: Batch logging for future performance optimization
    // ... existing code ...
}
```

---

### 4.3 Future Features (models.rs)

**File:** `src-tauri/src/models.rs`

#### Add Annotations to Series System:
```rust
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeriesInfo {
    // Note: Planned feature for TV series organization
    // ... existing code ...
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Season {
    // Note: Planned feature for TV series organization
    // ... existing code ...
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Episode {
    // Note: Planned feature for TV series organization
    // ... existing code ...
}

#[allow(dead_code)]
pub fn parse_series_title(title: &str) -> Option<ParsedSeries> {
    // Note: Planned feature for TV series organization
    // ... existing code ...
}
```

#### Add Annotations to Tag System:
```rust
// Note: Planned feature for content filtering
#[allow(dead_code)]
pub const SERIES: &str = "series";
#[allow(dead_code)]
pub const MOVIE: &str = "movies";
// ... all other tag constants ...

#[allow(dead_code)]
pub fn is_base_tag(tag: &str) -> bool {
    // Note: Planned feature for content filtering
    // ... existing code ...
}
```

#### Add Annotations to Quality System:
```rust
// Note: Planned feature for adaptive quality selection
#[allow(dead_code)]
pub const QUALITY_LEVELS: &[&str] = &["2160p", "1080p", "720p", "480p", "360p"];

#[allow(dead_code)]
pub fn is_valid_quality(quality: &str) -> bool {
    // Note: Planned feature for adaptive quality selection
    // ... existing code ...
}
```

---

## STEP 5: Integrate Useful Utilities

**Total:** 1 item  
**Estimated Time:** 1 hour

### 5.1 Expose cleanup_all() as Tauri Command

**File:** `src-tauri/src/commands.rs`

#### Add New Tauri Command:
```rust
#[tauri::command]
pub async fn run_maintenance(
    state: State<'_, AppState>,
) -> Result<String, String> {
    let db = state.db.lock().await;
    
    // Run all cleanup operations
    db.cleanup_expired_cache().await
        .map_err(|e| format!("Cache cleanup failed: {}", e))?;
    
    db.cleanup_old_progress().await
        .map_err(|e| format!("Progress cleanup failed: {}", e))?;
    
    db.optimize_database().await
        .map_err(|e| format!("Database optimization failed: {}", e))?;
    
    Ok("Maintenance completed successfully".to_string())
}
```

**File:** `src-tauri/src/main.rs`

#### Register Command:
```rust
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // ... existing commands ...
            run_maintenance,  // ← ADD THIS
        ])
        // ... rest of setup ...
}
```

**Verification:**
```bash
# Test command in DevTools Console:
window.__TAURI__.invoke('run_maintenance')
  .then(res => console.log('Maintenance:', res))
  .catch(err => console.error('Error:', err));
```

---

## STEP 6: Verification and Testing

**Estimated Time:** 1-2 hours

### 6.1 Build Verification

```bash
# Backend build
cd src-tauri
cargo build

# Expected: Zero errors, significantly fewer warnings
# Before: 88 warnings
# After: ~7 warnings (with allow annotations)
```

### 6.2 Test Verification

```bash
# Backend tests
cd src-tauri
cargo test

# Expected: All tests pass
```

### 6.3 Frontend Verification

```bash
# Frontend lint
npm run lint

# Expected: Zero errors, zero unused variable warnings
```

### 6.4 Clippy Verification

```bash
# Run clippy
cd src-tauri
cargo clippy

# Expected: Zero warnings (or only allow-annotated items)
```

### 6.5 IPC Smoke Test

```bash
# Run IPC smoke test
node scripts/ipc_smoke_test.js

# Expected: Test passes, all commands respond
```

### 6.6 Manual Testing Checklist

- [ ] App starts successfully
- [ ] Content fetching works
- [ ] Video playback works
- [ ] Search works
- [ ] Favorites work
- [ ] Settings work
- [ ] Maintenance command works (new)

---

## STEP 7: Documentation Updates

**Estimated Time:** 1 hour

### 7.1 Update DELETIONS.md

Add all removed items with evidence:

```markdown
## Phase 2 Cleanup - 2026-02-22

### Backend Deletions

#### commands.rs
- Removed: validate_cdn_reachability() (~20 lines)
- Evidence: rg "validate_cdn_reachability" returned 0 hits
- Reason: Dead code, never called

#### database.rs
- Removed: update_content_access() (~15 lines)
- Removed: invalidate_cache_before() (~20 lines)
- Removed: rerun_migration() (~30 lines)
- Removed: Delta update system (~180 lines)
- Removed: query_content_chunked() (~40 lines)
- Evidence: grep verification showed 0 usage
- Reason: Unused optimization features

... (continue for all deletions)
```

### 7.2 Update DECISIONS.md

Document decisions made:

```markdown
## Phase 2 Cleanup Decisions - 2026-02-22

### Removed Features

1. **Error Logging Write Functions**
   - Decision: Remove write functions, keep read-only diagnostics
   - Rationale: Read functions provide value, write functions unused
   - Impact: Simplified error handling, ~200 lines removed

2. **Delta Update System**
   - Decision: Remove as premature optimization
   - Rationale: Current catalog sizes don't justify complexity
   - Impact: ~180 lines removed, can re-add if needed

... (continue for all decisions)
```

### 7.3 Update ARCHITECTURE.md

Update to reflect removed systems:

```markdown
## Database Layer

### Cache Management
- TTL-based cache expiration
- Automatic cleanup on startup
- Manual maintenance via `run_maintenance` command
- ~~Delta updates~~ (removed - not needed for current scale)

### Content Storage
- Full content item storage
- ~~Chunked queries~~ (removed - memory usage acceptable)
```

### 7.4 Create GitHub Issues for Future Features

Create issues for kept features:

**Issue 1: Implement Series/Season/Episode Organization**
```markdown
Title: Feature: TV Series Organization System

Description:
Implement the series organization system that is currently dormant in models.rs.

Components:
- SeriesInfo, Season, Episode structs
- parse_series_title() function
- Database schema for series relationships
- UI for series navigation

Code Location: src-tauri/src/models.rs (marked with #[allow(dead_code)])

Estimated Effort: 40-60 hours
```

**Issue 2: Implement Tag-Based Content Filtering**
```markdown
Title: Feature: Tag-Based Content Filtering

Description:
Implement the tag-based filtering system that is currently dormant in models.rs.

Components:
- Tag constants (SERIES, MOVIE, COMEDY, etc.)
- Tag validation functions
- Database schema for tags
- UI for tag filters

Code Location: src-tauri/src/models.rs (marked with #[allow(dead_code)])

Estimated Effort: 20-30 hours
```

**Issue 3: Implement Quality Level Management**
```markdown
Title: Feature: Adaptive Quality Selection

Description:
Implement the quality level management system that is currently dormant in models.rs.

Components:
- Quality level constants
- Quality validation and scoring
- Quality fallback logic
- UI for quality selection

Code Location: src-tauri/src/models.rs (marked with #[allow(dead_code)])

Estimated Effort: 8-12 hours
```

---

## Rollback Procedures

### If Cleanup Breaks Tests

```bash
# Rollback to pre-cleanup state
git reset --hard v-stabilize-phase1-complete

# Restore database if needed
cp backups/<timestamp>-db.sqlite ~/.kiyya/app.db

# Verify restoration
npm run tauri:dev
```

### If Specific Deletion Causes Issues

```bash
# Revert specific file
git checkout v-stabilize-phase1-complete -- src-tauri/src/<file>.rs

# Rebuild
cargo build

# Test
cargo test
```

---

## Success Criteria

### Quantitative Metrics

- [ ] Compiler warnings reduced from 88 to ~7
- [ ] ~2,700 lines of code removed
- [ ] All tests pass (cargo test, npm test)
- [ ] Zero clippy warnings (except allow-annotated)
- [ ] IPC smoke test passes

### Qualitative Metrics

- [ ] Codebase is easier to understand
- [ ] No confusing dead code
- [ ] Clear documentation of future features
- [ ] Maintenance burden reduced

---

## Timeline Estimate

| Step | Task | Time | Cumulative |
|------|------|------|------------|
| 1 | Create Canary PR | 1h | 1h |
| 2 | Remove Safe-to-Delete Items | 3-4h | 4-5h |
| 3 | Remove Incomplete Features | 2-3h | 6-8h |
| 4 | Add Allow Annotations | 1-2h | 7-10h |
| 5 | Integrate Utilities | 1h | 8-11h |
| 6 | Verification and Testing | 1-2h | 9-13h |
| 7 | Documentation Updates | 1h | 10-14h |

**Total Estimated Time:** 10-14 hours

---

## Checklist for Implementation

### Pre-Implementation
- [ ] Read this entire guide
- [ ] Review source documents (TASK_5.1, 5.2, 5.3)
- [ ] Create backup: `./scripts/db_snapshot.sh`
- [ ] Create tag: `git tag v-stabilize-phase2-start`

### During Implementation
- [ ] Step 1: Create Canary PR
- [ ] Step 2: Remove Safe-to-Delete Items
- [ ] Step 3: Remove Incomplete Features
- [ ] Step 4: Add Allow Annotations
- [ ] Step 5: Integrate Utilities
- [ ] Step 6: Verification and Testing
- [ ] Step 7: Documentation Updates

### Post-Implementation
- [ ] All tests pass
- [ ] Manual testing complete
- [ ] Documentation updated
- [ ] Create tag: `git tag v-stabilize-phase2-complete`
- [ ] Create PR for review

---

## Contact and Support

**Questions or Issues?**
- Review source documents in `stabilization/` directory
- Check DECISIONS.md for rationale
- Consult ARCHITECTURE.md for system overview

**Emergency Rollback:**
```bash
git reset --hard v-stabilize-phase2-start
cp backups/<timestamp>-db.sqlite ~/.kiyya/app.db
```

---

**Document Status:** ✅ READY FOR IMPLEMENTATION  
**Last Updated:** 2026-02-22  
**Version:** 1.0

