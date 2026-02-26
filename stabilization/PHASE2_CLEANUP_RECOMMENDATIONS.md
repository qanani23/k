# Phase 2 Cleanup Recommendations - Implementation Guide

**Date:** 2026-02-22  
**Purpose:** Actionable recommendations for Phase 2 cleanup implementation  
**Source:** Comprehensive Audit Report (Task 5.4)  
**Status:** Ready for Implementation

---

## Overview

This document provides detailed, actionable recommendations for implementing Phase 2 cleanup based on the comprehensive audit findings. All recommendations are organized by priority and include specific file paths, line numbers, verification commands, and safety checks.

**Total Cleanup Potential:** ~3,454 lines  
**Estimated Effort:** 4 weeks  
**Risk Level:** LOW (with proper safety measures)

---

## Quick Reference

| Category | Items | Lines | Priority | Effort |
|----------|-------|-------|----------|--------|
| Safe to Delete | 33 | ~1,247 | HIGH | 2 weeks |
| Incomplete Features (Remove) | 6 | ~1,472 | HIGH | 1 week |
| Incomplete Features (Keep) | 3 | ~270 | MEDIUM | 1 day |
| Possibly Legacy | 12 | ~465 | MEDIUM | User decision |

---

## Safety Checklist (MANDATORY)

Before deleting ANY code, complete these steps:

- [ ] Create database backup: `make snapshot`
- [ ] Verify backup restoration on test database
- [ ] Create canary PR (do not merge)
- [ ] Run full test suite in CI
- [ ] Allow 48 hours for reviewer verification
- [ ] Run grep to verify zero usage
- [ ] Check for dynamic invocation patterns
- [ ] Document evidence in DELETIONS.md
- [ ] Run tests after deletion
- [ ] Verify no regressions

---

## Priority 1: High-Impact Safe Deletions

### 1.1 Remove PlayerModal.refactored.tsx (600 lines)

**Location:** `src/components/PlayerModal.refactored.tsx`  
**Reason:** Complete refactoring never deployed, never imported  
**Impact:** 48% of total dead code  
**Risk:** VERY LOW  
**Effort:** 5 minutes

**Verification:**
```bash
rg "PlayerModal\.refactored" --type ts --type tsx
# Expected: Zero matches
```

**Implementation:**
```bash
# Delete file
rm src/components/PlayerModal.refactored.tsx

# Verify no imports
rg "from.*PlayerModal\.refactored" src/

# Run tests
npm test

# Document
echo "Removed PlayerModal.refactored.tsx (600 lines) - never imported" >> stabilization/DELETIONS.md
```

**Rollback:**
```bash
git checkout src/components/PlayerModal.refactored.tsx
```

---

### 1.2 Remove PlayerAdapter.ts (337 lines)

**Location:** `src/lib/player/PlayerAdapter.ts`  
**Reason:** Only used by unused PlayerModal.refactored.tsx  
**Impact:** 27% of total dead code  
**Risk:** VERY LOW  
**Effort:** 5 minutes

**Verification:**
```bash
rg "PlayerAdapter|createPlayerAdapter" --type ts --type tsx
# Expected: Only used in PlayerModal.refactored.tsx (which is being deleted)
```

**Implementation:**
```bash
# Delete file
rm src/lib/player/PlayerAdapter.ts

# Verify no imports
rg "from.*PlayerAdapter" src/

# Run tests
npm test

# Document
echo "Removed PlayerAdapter.ts (337 lines) - only used by deleted refactored player" >> stabilization/DELETIONS.md
```

**Rollback:**
```bash
git checkout src/lib/player/PlayerAdapter.ts
```

---

### 1.3 Remove ErrorContext Struct (50 lines)

**Location:** `src-tauri/src/error.rs`  
**Reason:** Never constructed, all 5 methods unused  
**Impact:** 4% of total dead code  
**Risk:** LOW  
**Effort:** 10 minutes

**Verification:**
```bash
rg "ErrorContext" src-tauri --type rust | grep -v "^src-tauri/src/error.rs"
# Expected: Zero matches outside error.rs
```

**Implementation:**
```rust
// In src-tauri/src/error.rs
// Remove these items:
// - pub struct ErrorContext { ... }
// - impl ErrorContext { ... } (all 5 methods)
```

**Specific Lines to Remove:**
- ErrorContext struct definition (~10 lines)
- ErrorContext::new() (~8 lines)
- ErrorContext::with_user_action() (~6 lines)
- ErrorContext::with_context() (~6 lines)
- ErrorContext::with_stack_trace() (~8 lines)
- ErrorContext::to_json() (~12 lines)

**Commands:**
```bash
# Build to verify
cd src-tauri && cargo build

# Run tests
cargo test

# Document
echo "Removed ErrorContext struct and 5 methods (50 lines) - never constructed" >> stabilization/DELETIONS.md
```

**Rollback:**
```bash
git checkout src-tauri/src/error.rs
```

---

### 1.4 Remove RangeRequest Struct (40 lines)

**Location:** `src-tauri/src/gateway.rs`  
**Reason:** HTTP range request feature never integrated  
**Impact:** 3% of total dead code  
**Risk:** LOW  
**Effort:** 10 minutes

**Verification:**
```bash
rg "RangeRequest" src-tauri --type rust | grep -v "^src-tauri/src/gateway.rs"
# Expected: Zero matches outside gateway.rs
```

**Implementation:**
```rust
// In src-tauri/src/gateway.rs
// Remove these items:
// - pub struct RangeRequest { ... }
// - impl RangeRequest { ... } (all 4 methods)
```

**Specific Lines to Remove:**
- RangeRequest struct definition (~8 lines)
- RangeRequest::from_header() (~10 lines)
- RangeRequest::to_content_range() (~8 lines)
- RangeRequest::actual_end() (~6 lines)
- RangeRequest::byte_count() (~8 lines)

**Commands:**
```bash
# Build to verify
cd src-tauri && cargo build

# Run tests
cargo test

# Document
echo "Removed RangeRequest struct and 4 methods (40 lines) - HTTP range feature never integrated" >> stabilization/DELETIONS.md
```

**Rollback:**
```bash
git checkout src-tauri/src/gateway.rs
```

---

## Priority 2: Medium-Impact Safe Deletions

### 2.1 Remove Unused Database Methods (90 lines)

**Location:** `src-tauri/src/database.rs`  
**Methods:** 4 unused methods  
**Risk:** LOW  
**Effort:** 20 minutes

#### 2.1.1 Remove update_content_access()

**Lines:** ~15  
**Reason:** LRU cache tracking never used

**Verification:**
```bash
rg "\.update_content_access\(" src-tauri
# Expected: Zero matches
```

**Implementation:**
```rust
// In src-tauri/src/database.rs
// Remove method: pub async fn update_content_access(&self, item_id: &str) -> Result<()>
```

#### 2.1.2 Remove invalidate_cache_before()

**Lines:** ~20  
**Reason:** Manual cache invalidation never used

**Verification:**
```bash
rg "\.invalidate_cache_before\(" src-tauri
# Expected: Zero matches
```

**Implementation:**
```rust
// In src-tauri/src/database.rs
// Remove method: pub async fn invalidate_cache_before(&self, timestamp: i64) -> Result<()>
```

#### 2.1.3 Remove cleanup_all()

**Lines:** ~25  
**Reason:** Comprehensive maintenance never called

**Verification:**
```bash
rg "\.cleanup_all\(" src-tauri
# Expected: Zero matches
```

**Implementation:**
```rust
// In src-tauri/src/database.rs
// Remove method: pub async fn cleanup_all(&self) -> Result<()>
```

**Alternative:** Consider exposing as Tauri command for user-triggered maintenance

#### 2.1.4 Remove rerun_migration()

**Lines:** ~30  
**Reason:** Migration debugging utility never used, potentially dangerous

**Verification:**
```bash
rg "\.rerun_migration\(" src-tauri
# Expected: Zero matches
```

**Implementation:**
```rust
// In src-tauri/src/database.rs
// Remove method: pub async fn rerun_migration(&self, version: i32) -> Result<()>
```

**Commands:**
```bash
# Build to verify
cd src-tauri && cargo build

# Run tests
cargo test

# Document
echo "Removed 4 unused database methods (90 lines): update_content_access, invalidate_cache_before, cleanup_all, rerun_migration" >> stabilization/DELETIONS.md
```

---

### 2.2 Remove Unused Download Methods (45 lines)

**Location:** `src-tauri/src/download.rs`  
**Methods:** 3 unused methods + 2 fields + 1 import  
**Risk:** LOW  
**Effort:** 15 minutes

#### 2.2.1 Remove Connection Pooling Fields

**Implementation:**
```rust
// In src-tauri/src/download.rs
// Remove from DownloadManager struct:
// - connection_pool: Arc<Mutex<Vec<Client>>>
// - max_connections: usize
```

#### 2.2.2 Remove Connection Pooling Methods

**Methods to Remove:**
- get_connection() (~15 lines)
- return_connection() (~10 lines)
- get_content_length() (~20 lines)

**Verification:**
```bash
rg "\.get_connection\(|\.return_connection\(|\.get_content_length\(" src-tauri/src/download.rs
# Expected: Only definitions, no calls
```

#### 2.2.3 Remove Unused Import

**Implementation:**
```rust
// In src-tauri/src/download.rs
// Remove: use futures_util::StreamExt;
```

**Commands:**
```bash
# Build to verify
cd src-tauri && cargo build

# Run tests
cargo test

# Document
echo "Removed connection pooling code from download.rs (45 lines): 2 fields, 3 methods, 1 import" >> stabilization/DELETIONS.md
```

---

### 2.3 Remove Unused Gateway Structs (55 lines)

**Location:** `src-tauri/src/gateway.rs`  
**Items:** 2 structs + 1 field + 2 imports  
**Risk:** LOW  
**Effort:** 15 minutes

#### 2.3.1 Remove GatewayConfig Struct

**Lines:** ~15  
**Reason:** Never constructed

**Verification:**
```bash
rg "GatewayConfig" src-tauri --type rust | grep -v "^src-tauri/src/gateway.rs"
# Expected: Zero matches
```

#### 2.3.2 Remove Unused Field

**Implementation:**
```rust
// In src-tauri/src/gateway.rs
// Remove from GatewayClient struct:
// - current_gateway: String
```

#### 2.3.3 Remove Unused Imports

**Implementation:**
```rust
// In src-tauri/src/gateway.rs
// Remove these imports (only if not used elsewhere in file):
// - use crate::security_logging::SecurityEvent;
// - use crate::security_logging::log_security_event;
```

**Note:** These imports ARE used in validation.rs, just not in gateway.rs

**Commands:**
```bash
# Build to verify
cd src-tauri && cargo build

# Run tests
cargo test

# Document
echo "Removed unused gateway code (55 lines): GatewayConfig struct, 1 field, 2 imports" >> stabilization/DELETIONS.md
```

---

### 2.4 Remove Unused Logging Structs (45 lines)

**Location:** `src-tauri/src/logging.rs`  
**Items:** 1 struct + 1 function  
**Risk:** LOW  
**Effort:** 10 minutes

#### 2.4.1 Remove LoggingConfig Struct

**Lines:** ~15  
**Reason:** Never constructed

**Verification:**
```bash
rg "LoggingConfig" src-tauri --type rust | grep -v "^src-tauri/src/logging.rs"
# Expected: Zero matches
```

#### 2.4.2 Remove init_logging_with_config()

**Lines:** ~30  
**Reason:** Never called

**Verification:**
```bash
rg "init_logging_with_config" src-tauri
# Expected: Zero matches
```

**Commands:**
```bash
# Build to verify
cd src-tauri && cargo build

# Run tests
cargo test

# Document
echo "Removed unused logging code (45 lines): LoggingConfig struct, init_logging_with_config function" >> stabilization/DELETIONS.md
```

---

## Priority 3: Low-Impact Safe Deletions

### 3.1 Remove Unused Imports (5 items)

**Effort:** 10 minutes total

#### commands.rs
```rust
// Remove if unused:
// use crate::database::Database;
// use crate::download::DownloadManager;
// use crate::gateway::GatewayClient;
// use crate::server::LocalServer;
// use tracing::debug;
```

#### models.rs
```rust
// Remove if unused:
// use chrono::{DateTime, Utc};
// use uuid::Uuid;
```

**Verification:**
```bash
# For each import, verify it's not used
rg "Database::" src-tauri/src/commands.rs
rg "DownloadManager::" src-tauri/src/commands.rs
# etc.
```

**Commands:**
```bash
cd src-tauri && cargo build
cargo test
echo "Removed 5 unused imports from commands.rs and models.rs" >> stabilization/DELETIONS.md
```

---

### 3.2 Remove Unused Struct Fields (6 items)

**Effort:** 15 minutes total

**Fields to Remove:**
1. `DownloadManager.connection_pool` (download.rs)
2. `DownloadManager.max_connections` (download.rs)
3. `EncryptedData.encrypted_size` (encryption.rs)
4. `GatewayClient.current_gateway` (gateway.rs)
5. `LocalServer.vault_path` (server.rs)

**Verification:**
```bash
rg "\.connection_pool" src-tauri
rg "\.max_connections" src-tauri
rg "\.encrypted_size" src-tauri
rg "\.current_gateway" src-tauri
rg "\.vault_path" src-tauri
# Expected: Only definitions, no reads
```

---

### 3.3 Remove Unused Constants (3 items)

**Location:** `src-tauri/src/encryption.rs`  
**Effort:** 5 minutes

**Constants to Remove:**
```rust
// Remove:
// const KEYRING_SERVICE: &str = "...";
// const KEYRING_USER: &str = "...";
// const KEY_SIZE: usize = 32;
```

**Verification:**
```bash
rg "KEYRING_SERVICE|KEYRING_USER|KEY_SIZE" src-tauri
# Expected: Only definitions
```

---

### 3.4 Fix Unused Variables (3 items)

**Effort:** 10 minutes total

#### src/lib/idle.ts
```typescript
// Remove:
// type IdleCallback = ...;
```

#### src/lib/memoryManager.ts
```typescript
// Remove or use:
// const now = Date.now();
```

#### src/hooks/useContent.ts
```typescript
// Remove or use:
// const seriesKey = ...;
```

**Commands:**
```bash
npm run lint
npm test
echo "Fixed 3 unused variables in TypeScript files" >> stabilization/DELETIONS.md
```

---

### 3.5 Remove Unused Cargo Dependencies (12 items)

**Location:** `src-tauri/Cargo.toml`  
**Effort:** 20 minutes  
**Impact:** 2-5 MB binary size reduction, 10-20% faster builds

**Dependencies to Remove:**
```toml
# Remove from [dependencies]:
tokio-stream = "0.1"
anyhow = "1.0"
log = "0.4"
env_logger = "0.10"
dirs = "5.0"
regex = "1.10"
url = "2.4"
mime_guess = "2.0"
sha2 = "0.10"
once_cell = "1.19"

# Remove from [dev-dependencies]:
futures = "0.3"
wiremock = "0.5"

# Fix duplicate:
# Remove reqwest from [dev-dependencies] (keep in [dependencies])
```

**Verification:**
```bash
# For each dependency, verify not used
rg "tokio_stream" src-tauri --type rust
rg "anyhow" src-tauri --type rust
# etc.
```

**Commands:**
```bash
cd src-tauri
cargo build
cargo test
echo "Removed 12 unused Cargo dependencies" >> stabilization/DELETIONS.md
```

---

## Priority 4: Remove Incomplete Features

### 4.1 Remove Error Logging Write System (200 lines)

**Location:** `src-tauri/src/error_logging.rs`  
**Reason:** Read functions integrated, write functions unused  
**Risk:** LOW  
**Effort:** 30 minutes

**Keep These (Used in diagnostics.rs):**
- get_error_stats()
- get_recent_errors()

**Remove These (Never Called):**
- log_error() (~25 lines)
- log_error_simple() (~20 lines)
- log_result_error() (~15 lines)
- log_result_error_simple() (~15 lines)
- mark_error_resolved() (~20 lines)
- cleanup_old_errors() (~25 lines)

**Verification:**
```bash
rg "log_error\(|log_error_simple\(|log_result_error\(|mark_error_resolved\(|cleanup_old_errors\(" src-tauri --type rust | grep -v "error_logging\.rs"
# Expected: Zero matches outside error_logging.rs
```

**Implementation:**
```rust
// In src-tauri/src/error_logging.rs
// Remove all write functions listed above
// Keep read functions: get_error_stats, get_recent_errors
```

**Commands:**
```bash
cd src-tauri && cargo build
cargo test
echo "Removed error logging write functions (200 lines) - read-only diagnostics sufficient" >> stabilization/DELETIONS.md
```

**Update LOGGING_DECISION.md:**
```markdown
## Error Logging Decision

**Decision:** Read-only diagnostics  
**Rationale:** Write functions never integrated, read functions provide sufficient diagnostics  
**Date:** 2026-02-22

**Kept:**
- get_error_stats() - Used in diagnostics
- get_recent_errors() - Used in diagnostics

**Removed:**
- All write functions (log_error, log_error_simple, etc.)
- Reason: Never called in production code
```

---

### 4.2 Remove Delta Update System (180 lines)

**Location:** `src-tauri/src/database.rs`  
**Reason:** Premature optimization, never integrated  
**Risk:** LOW  
**Effort:** 30 minutes

**Methods to Remove:**
- get_content_hash() (~20 lines)
- get_content_hashes() (~25 lines)
- store_content_items_delta() (~40 lines)
- get_changed_items() (~35 lines)

**Tests to Remove:**
- test_delta_update_no_changes() (~40 lines)
- test_delta_update_with_changes() (~40 lines)
- test_delta_update_new_items() (~40 lines)
- test_get_changed_items() (~40 lines)

**Verification:**
```bash
rg "\.get_content_hash\(|\.store_content_items_delta\(|\.get_changed_items\(" src-tauri --type rust | grep -v "test"
# Expected: Only used in tests
```

**Implementation:**
```rust
// In src-tauri/src/database.rs
// Remove all delta update methods
// Remove all delta update tests (lines 3760-3938)
```

**Commands:**
```bash
cd src-tauri && cargo build
cargo test
echo "Removed delta update system (180 lines) - premature optimization" >> stabilization/DELETIONS.md
```

**Update DECISIONS.md:**
```markdown
## Delta Update System Decision

**Decision:** Removed  
**Rationale:** Premature optimization, current catalog sizes don't justify complexity  
**Date:** 2026-02-22

**Impact:** Removed ~180 lines of code and tests  
**Future:** Can be re-added if content catalogs grow to thousands of items
```

---

### 4.3 Remove Chunked Query System (40 lines)

**Location:** `src-tauri/src/database.rs:2245`  
**Reason:** Memory optimization never used  
**Risk:** LOW  
**Effort:** 10 minutes

**Method to Remove:**
- query_content_chunked() (~40 lines)

**Verification:**
```bash
rg "\.query_content_chunked\(" src-tauri
# Expected: Zero matches
```

**Implementation:**
```rust
// In src-tauri/src/database.rs
// Remove method: pub async fn query_content_chunked<F>(&self, ...) -> Result<()>
```

**Commands:**
```bash
cd src-tauri && cargo build
cargo test
echo "Removed chunked query system (40 lines) - memory optimization not needed" >> stabilization/DELETIONS.md
```

---

### 4.4 Remove Connection Pooling System (60 lines)

**Location:** `src-tauri/src/download.rs`  
**Reason:** Incomplete implementation, never used  
**Risk:** LOW  
**Effort:** 15 minutes

**Already covered in Priority 2, Section 2.2**

---

### 4.5 Remove HTTP Range Request System (55 lines)

**Location:** `src-tauri/src/gateway.rs`  
**Reason:** Feature never integrated  
**Risk:** LOW  
**Effort:** 15 minutes

**Already covered in Priority 1, Section 1.4**

---

### 4.6 Remove Refactored Player System (937 lines)

**Location:** `src/components/PlayerModal.refactored.tsx` + `src/lib/player/PlayerAdapter.ts`  
**Reason:** Complete refactor never deployed  
**Risk:** VERY LOW  
**Effort:** 10 minutes

**Already covered in Priority 1, Sections 1.1 and 1.2**

---

## Priority 5: Keep Incomplete Features (Document)

### 5.1 Series/Season/Episode System (150 lines)

**Location:** `src-tauri/src/models.rs`  
**Action:** KEEP with `#[allow(dead_code)]`  
**Reason:** Valuable future feature, well-designed  
**Effort:** 15 minutes

**Implementation:**
```rust
// In src-tauri/src/models.rs
// Add above SeriesInfo struct:
#[allow(dead_code)]
pub struct SeriesInfo {
    // ...
}

// Add above Season struct:
#[allow(dead_code)]
pub struct Season {
    // ...
}

// Add above Episode struct:
#[allow(dead_code)]
pub struct Episode {
    // ...
}

// Add above ParsedSeries struct:
#[allow(dead_code)]
pub struct ParsedSeries {
    // ...
}

// Add above functions:
#[allow(dead_code)]
pub fn parse_series_title(title: &str) -> Option<ParsedSeries> {
    // ...
}

#[allow(dead_code)]
pub fn generate_series_key(series_name: &str, season: Option<u32>) -> String {
    // ...
}
```

**Add Documentation:**
```rust
/// Series/Season/Episode System
/// 
/// This is a planned feature for organizing TV series content.
/// 
/// **Status:** Not yet integrated
/// **Planned Use:** Organize content by series, seasons, and episodes
/// **Integration Points:**
/// - Content parsing: Detect series from titles
/// - Database: Store series relationships
/// - UI: Display series-based navigation
/// 
/// **GitHub Issue:** #XXX (create issue)
```

**Create GitHub Issue:**
```markdown
Title: Integrate Series/Season/Episode System

Description:
The codebase includes a complete data model for TV series organization (SeriesInfo, Season, Episode structs) with parsing utilities. This feature needs integration:

1. Add series detection to content parsing
2. Add series tables to database schema
3. Add series UI components
4. Add series-based navigation

Estimated Effort: 40-60 hours
Priority: Medium
Labels: enhancement, future-feature
```

---

### 5.2 Tag-Based Filtering System (80 lines)

**Location:** `src-tauri/src/models.rs`  
**Action:** KEEP with `#[allow(dead_code)]`  
**Reason:** Valuable for content discovery  
**Effort:** 10 minutes

**Implementation:**
```rust
// In src-tauri/src/models.rs
// Add above tag constants:
#[allow(dead_code)]
pub const BASE_TAGS: [&str; 5] = ["series", "movies", "sitcom", "kids", "hero-trailer"];

#[allow(dead_code)]
pub const FILTER_TAGS: [&str; 15] = [
    "comedy-movies", "action-movies", "romance-movies",
    // ... etc
];

// Add above tag functions:
#[allow(dead_code)]
pub fn is_base_tag(tag: &str) -> bool {
    // ...
}

#[allow(dead_code)]
pub fn is_filter_tag(tag: &str) -> bool {
    // ...
}

#[allow(dead_code)]
pub fn base_tag_for_filter(filter_tag: &str) -> Option<&'static str> {
    // ...
}
```

**Add Documentation:**
```rust
/// Tag-Based Filtering System
/// 
/// This is a planned feature for content discovery and filtering.
/// 
/// **Status:** Not yet integrated
/// **Planned Use:** Filter content by tags (comedy, action, romance, etc.)
/// **Integration Points:**
/// - Content items: Add tags field
/// - Database: Store and query by tags
/// - UI: Add tag filter controls
/// 
/// **GitHub Issue:** #XXX (create issue)
```

---

### 5.3 Quality Level Management (40 lines)

**Location:** `src-tauri/src/models.rs`  
**Action:** KEEP with `#[allow(dead_code)]`  
**Reason:** Useful for video playback optimization  
**Effort:** 10 minutes

**Implementation:**
```rust
// In src-tauri/src/models.rs
// Add above quality constants:
#[allow(dead_code)]
pub const QUALITY_LEVELS: [&str; 5] = ["2160p", "1080p", "720p", "480p", "360p"];

// Add above quality functions:
#[allow(dead_code)]
pub fn is_valid_quality(quality: &str) -> bool {
    // ...
}

#[allow(dead_code)]
pub fn next_lower_quality(quality: &str) -> Option<&'static str> {
    // ...
}

#[allow(dead_code)]
pub fn quality_score(quality: &str) -> u32 {
    // ...
}
```

**Add Documentation:**
```rust
/// Quality Level Management System
/// 
/// This is a planned feature for video quality selection and fallback.
/// 
/// **Status:** Not yet integrated
/// **Planned Use:** Adaptive quality selection, quality fallback
/// **Integration Points:**
/// - Video URL extraction: Detect available qualities
/// - Player: Add quality selection UI
/// - Playback: Implement quality fallback logic
/// 
/// **GitHub Issue:** #XXX (create issue)
```

---

## Priority 6: Possibly Legacy Items (User Decision Required)

### 6.1 cleanup_all() - Database Maintenance

**Location:** `src-tauri/src/database.rs`  
**Lines:** ~25  
**Current Status:** Unused  
**Options:**

#### Option A: Expose as Tauri Command (RECOMMENDED)
```rust
// In src-tauri/src/commands.rs
#[tauri::command]
pub async fn run_maintenance(state: State<'_, AppState>) -> Result<String, String> {
    let db = &state.db;
    db.cleanup_all().await
        .map_err(|e| format!("Maintenance failed: {}", e))?;
    Ok("Maintenance completed successfully".to_string())
}

// Register in main.rs:
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    run_maintenance,
])
```

**Effort:** 30 minutes  
**Benefit:** Users can trigger maintenance manually  
**Risk:** VERY LOW

#### Option B: Remove as Unused
```rust
// Remove method from database.rs
```

**Effort:** 5 minutes  
**Benefit:** Cleaner codebase  
**Risk:** LOW

#### Option C: Keep with #[allow(dead_code)]
```rust
#[allow(dead_code)]
pub async fn cleanup_all(&self) -> Result<()> {
    // ...
}
```

**Effort:** 2 minutes  
**Benefit:** Available for future use  
**Risk:** VERY LOW

**Recommendation:** Option A - Expose as Tauri command

---

### 6.2 rerun_migration() - Migration Debugging

**Location:** `src-tauri/src/database.rs`  
**Lines:** ~30  
**Current Status:** Unused, potentially dangerous  
**Options:**

#### Option A: Remove as Dangerous (RECOMMENDED)
```rust
// Remove method from database.rs
```

**Effort:** 5 minutes  
**Benefit:** Removes dangerous utility  
**Risk:** VERY LOW  
**Rationale:** Migration system has idempotency, this is redundant and risky

#### Option B: Keep for Debug Builds Only
```rust
#[cfg(debug_assertions)]
pub async fn rerun_migration(&self, version: i32) -> Result<()> {
    // ...
}
```

**Effort:** 5 minutes  
**Benefit:** Available for development debugging  
**Risk:** LOW

#### Option C: Keep with #[allow(dead_code)]
```rust
#[allow(dead_code)]
pub async fn rerun_migration(&self, version: i32) -> Result<()> {
    // ...
}
```

**Effort:** 2 minutes  
**Benefit:** Available for emergencies  
**Risk:** MEDIUM (could cause data corruption if misused)

**Recommendation:** Option A - Remove as dangerous

---

### 6.3 Error Logging Helpers

**Location:** `src-tauri/src/error_logging.rs`  
**Functions:** log_result_error(), log_result_error_simple()  
**Lines:** ~30  
**Current Status:** Well-designed but unused  
**Options:**

#### Option A: Keep with #[allow(dead_code)] (RECOMMENDED)
```rust
#[allow(dead_code)]
pub async fn log_result_error<T, E: std::fmt::Display>(
    result: Result<T, E>,
    db: &Database,
) -> Result<T, E> {
    // ...
}

#[allow(dead_code)]
pub async fn log_result_error_simple<T, E: std::fmt::Display>(
    result: Result<T, E>,
    db: &Database,
) -> Result<T, E> {
    // ...
}
```

**Effort:** 5 minutes  
**Benefit:** Available for future error handling improvements  
**Risk:** VERY LOW

#### Option B: Remove as Unused
```rust
// Remove both functions
```

**Effort:** 5 minutes  
**Benefit:** Cleaner codebase  
**Risk:** LOW

**Recommendation:** Option A - Keep with allow annotation (well-designed utilities)

---

### 6.4 Security Event Variants

**Location:** `src-tauri/src/security_logging.rs`  
**Variants:** PathViolation, SqlInjectionAttempt, AuthenticationFailure, AuthorizationFailure, SuspiciousActivity  
**Lines:** ~50  
**Current Status:** Part of complete security model, some variants unused  
**Options:**

#### Option A: Keep All with #[allow(dead_code)] (RECOMMENDED)
```rust
#[allow(dead_code)]
pub enum SecurityEvent {
    InputValidationFailure { /* ... */ },  // USED
    NetworkViolation { /* ... */ },        // USED
    EncryptionKeyOperation { /* ... */ },  // USED
    RateLimitTriggered { /* ... */ },      // USED
    PathViolation { /* ... */ },           // UNUSED - Keep for complete model
    SqlInjectionAttempt { /* ... */ },     // UNUSED - Keep for complete model
    AuthenticationFailure { /* ... */ },   // UNUSED - Keep for complete model
    AuthorizationFailure { /* ... */ },    // UNUSED - Keep for complete model
    SuspiciousActivity { /* ... */ },      // UNUSED - Keep for complete model
}
```

**Effort:** 5 minutes  
**Benefit:** Complete security taxonomy, no runtime cost  
**Risk:** VERY LOW

#### Option B: Remove Unused Variants
```rust
// Remove 5 unused variants
```

**Effort:** 10 minutes  
**Benefit:** Cleaner enum  
**Risk:** LOW

**Recommendation:** Option A - Keep complete security model

---

### 6.5 log_security_events() Batch Function

**Location:** `src-tauri/src/security_logging.rs`  
**Lines:** ~15  
**Current Status:** Batch function unused, singular function heavily used  
**Options:**

#### Option A: Keep with #[allow(dead_code)] (RECOMMENDED)
```rust
#[allow(dead_code)]
pub async fn log_security_events(events: Vec<SecurityEvent>) {
    // ...
}
```

**Effort:** 2 minutes  
**Benefit:** Available for future batch operations  
**Risk:** VERY LOW

#### Option B: Remove as Unused
```rust
// Remove function
```

**Effort:** 5 minutes  
**Benefit:** Cleaner codebase  
**Risk:** LOW

**Recommendation:** Option A - Keep with allow annotation

---

## Implementation Timeline

### Week 1: Pre-Cleanup and High-Impact Deletions

**Monday:**
- [ ] Create database backup: `make snapshot`
- [ ] Verify backup restoration
- [ ] Create canary PR branch
- [ ] Document rollback procedures

**Tuesday:**
- [ ] Remove PlayerModal.refactored.tsx (600 lines)
- [ ] Remove PlayerAdapter.ts (337 lines)
- [ ] Run tests, document in DELETIONS.md

**Wednesday:**
- [ ] Remove ErrorContext struct (50 lines)
- [ ] Remove RangeRequest struct (40 lines)
- [ ] Run tests, document in DELETIONS.md

**Thursday:**
- [ ] Remove unused database methods (90 lines)
- [ ] Run tests, document in DELETIONS.md

**Friday:**
- [ ] Remove unused download methods (45 lines)
- [ ] Remove unused gateway structs (55 lines)
- [ ] Remove unused logging structs (45 lines)
- [ ] Run tests, document in DELETIONS.md
- [ ] Create canary PR for review

---

### Week 2: Incomplete Features and Low-Impact Deletions

**Monday:**
- [ ] Wait for canary PR review (48 hours)
- [ ] Remove unused imports (5 items)
- [ ] Remove unused fields (6 items)
- [ ] Remove unused constants (3 items)

**Tuesday:**
- [ ] Fix unused variables (3 items)
- [ ] Remove unused Cargo dependencies (12 items)
- [ ] Run tests, document in DELETIONS.md

**Wednesday:**
- [ ] Remove Error Logging Write System (200 lines)
- [ ] Update LOGGING_DECISION.md
- [ ] Run tests, document in DELETIONS.md

**Thursday:**
- [ ] Remove Delta Update System (180 lines)
- [ ] Remove Chunked Query System (40 lines)
- [ ] Update DECISIONS.md
- [ ] Run tests, document in DELETIONS.md

**Friday:**
- [ ] Review week's progress
- [ ] Run full test suite
- [ ] Update documentation

---

### Week 3: Possibly Legacy Items and Future Features

**Monday:**
- [ ] Get user decisions on possibly legacy items
- [ ] Implement decisions (expose, remove, or keep)

**Tuesday:**
- [ ] Add #[allow(dead_code)] to Series system
- [ ] Add #[allow(dead_code)] to Tag system
- [ ] Add #[allow(dead_code)] to Quality system
- [ ] Add documentation comments

**Wednesday:**
- [ ] Create GitHub issues for future features
- [ ] Update ARCHITECTURE.md with future features section

**Thursday:**
- [ ] Update DECISIONS.md with all decisions
- [ ] Update DELETIONS.md with final list
- [ ] Review all documentation

**Friday:**
- [ ] Run full test suite
- [ ] Run security audit: `cargo audit`
- [ ] Verify no regressions

---

### Week 4: Final Verification and Completion

**Monday:**
- [ ] Run `cargo build` - verify zero new warnings
- [ ] Run `cargo clippy` - verify zero new warnings
- [ ] Run `cargo test` - verify all tests pass

**Tuesday:**
- [ ] Run `npm run lint` - verify zero errors
- [ ] Run `npm test` - verify all tests pass
- [ ] Manual application testing

**Wednesday:**
- [ ] Test core features (playback, favorites, playlists)
- [ ] Test with existing user data
- [ ] Verify no functionality lost

**Thursday:**
- [ ] Final documentation review
- [ ] Create Phase 2 completion summary
- [ ] Prepare for Phase 3

**Friday:**
- [ ] Create tag: `v-stabilize-phase2-complete`
- [ ] Push tag to repository
- [ ] Celebrate! 🎉

---

## Verification Commands

### Before Starting
```bash
# Create backup
make snapshot

# Verify backup
ls -lh backups/

# Create canary branch
git checkout -b feature/stabilize/phase2-canary
```

### After Each Deletion
```bash
# Build backend
cd src-tauri && cargo build

# Run backend tests
cargo test

# Build frontend
cd .. && npm run build

# Run frontend tests
npm test

# Run linter
npm run lint
```

### Final Verification
```bash
# Full build
make build-backend
make build-frontend

# Full test suite
make test

# Security audit
cd src-tauri && cargo audit

# Coverage check
make coverage

# Manual testing
npm run tauri:dev
```

---

## Documentation Updates

### DELETIONS.md Format

For each deletion, document:
```markdown
### [Date] - [Item Name]

**File:** [file path]
**Lines:** [line numbers or count]
**Reason:** [why it was removed]
**Evidence:**
```bash
$ rg "item_name" src-tauri
# No results
```
**Safety Check:** ✓ Passed
**Tests:** ✓ All passed
**Reviewer:** [name]
```

### DECISIONS.md Format

For each decision, document:
```markdown
## [Feature/System Name] Decision

**Date:** YYYY-MM-DD
**Decision:** [Integrate / Remove / Keep with allow]
**Rationale:** [why this decision was made]
**Implementation:** [what was done]
**Impact:** [lines removed/kept, warnings reduced]
**Future:** [if applicable, when to revisit]
```

### LOGGING_DECISION.md Updates

Document logging system decisions:
```markdown
## Error Logging Decision

**Decision:** Read-only diagnostics
**Date:** 2026-02-22

**Kept:**
- get_error_stats() - Used in diagnostics
- get_recent_errors() - Used in diagnostics

**Removed:**
- All write functions (log_error, log_error_simple, etc.)
- Reason: Never called in production code

**Rationale:** Read functions provide sufficient diagnostics value without the complexity of write functions.
```

---

## Rollback Procedures

### If Tests Fail After Deletion

```bash
# Rollback specific file
git checkout [file_path]

# Rebuild
cd src-tauri && cargo build

# Retest
cargo test
```

### If Application Breaks

```bash
# Find last stable tag
git tag -l "v-stabilize-*" | tail -1

# Rollback code
git reset --hard [tag]

# Restore database
cp backups/[timestamp]-db.sqlite ~/.kiyya/app.db

# Verify
npm run tauri:dev
```

### If Canary PR Reveals Issues

```bash
# Do NOT merge canary PR
# Re-categorize problematic items
# Create new cleanup PR with conservative approach
# Document issues in DECISIONS.md
```

---

## Success Criteria

Phase 2 is complete when:

- [ ] All safe-to-delete items removed (~1,247 lines)
- [ ] All incomplete features resolved (remove or document)
- [ ] All possibly legacy items resolved (user decisions)
- [ ] All tests passing
- [ ] Zero new warnings introduced
- [ ] Security audit passing
- [ ] Manual testing successful
- [ ] All documentation updated
- [ ] Tag created: `v-stabilize-phase2-complete`

---

## Expected Outcomes

### Code Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Total Lines | ~50,000 | ~46,546 | -3,454 lines (6.9%) |
| Warnings | 360 | ~50-100 | -260-310 (72-86%) |
| Dead Code | ~1,247 | 0 | -1,247 lines |
| Incomplete Features | ~1,742 | ~270 | -1,472 lines |
| Binary Size | ~15 MB | ~12-13 MB | -2-3 MB (13-20%) |
| Compile Time | ~120s | ~96-108s | -12-24s (10-20%) |

### Quality Improvements

- ✅ Clearer codebase (less unused code)
- ✅ Easier to understand (no confusing incomplete features)
- ✅ Lower maintenance burden
- ✅ Better onboarding for new developers
- ✅ Faster builds and smaller binaries
- ✅ Foundation ready for Phase 3 (re-stabilization)

---

## Risk Mitigation

### Low Risk Items (Can Delete Immediately)
- PlayerModal.refactored.tsx
- PlayerAdapter.ts
- ErrorContext struct
- RangeRequest struct
- Unused imports
- Unused constants
- Unused variables

### Medium Risk Items (Verify Carefully)
- Database methods (verify no hidden usage)
- Download methods (verify no dynamic calls)
- Gateway structs (verify no reflection)
- Logging structs (verify no config loading)

### High Risk Items (User Decision Required)
- cleanup_all() - Could be useful as Tauri command
- rerun_migration() - Dangerous but potentially useful for debugging
- Error logging helpers - Well-designed, may be useful later
- Security event variants - Complete security model

---

## Contact and Support

**Questions or Issues:**
- Review this document first
- Check DECISIONS.md for previous decisions
- Check DELETIONS.md for deletion evidence
- Consult with team lead before major decisions

**Emergency Rollback:**
- Use rollback procedures above
- Document issue in DECISIONS.md
- Create GitHub issue for investigation

**Phase 2 Owners:**
- Primary: [Name]
- Reviewer: [Name]
- Backup: [Name]

---

## Appendices

### Appendix A: Complete File List

**Files to Delete:**
- src/components/PlayerModal.refactored.tsx
- src/lib/player/PlayerAdapter.ts

**Files to Modify:**
- src-tauri/src/database.rs
- src-tauri/src/error_logging.rs
- src-tauri/src/download.rs
- src-tauri/src/gateway.rs
- src-tauri/src/logging.rs
- src-tauri/src/error.rs
- src-tauri/src/encryption.rs
- src-tauri/src/server.rs
- src-tauri/src/models.rs
- src-tauri/src/commands.rs
- src-tauri/Cargo.toml
- src/lib/idle.ts
- src/lib/memoryManager.ts
- src/hooks/useContent.ts

### Appendix B: Grep Commands Reference

```bash
# Verify function unused
rg "function_name\b" src-tauri

# Verify struct unused
rg "StructName" src-tauri --type rust | grep -v "^src-tauri/src/file.rs"

# Verify import unused
rg "ImportName::" src-tauri/src/file.rs

# Verify field unused
rg "\.field_name" src-tauri

# Verify constant unused
rg "CONSTANT_NAME" src-tauri

# Check for dynamic invocation
rg "invoke\(|window.__TAURI__\.invoke" src
rg "fetch_\${.*}|\['fetch',.*\].join" src
```

### Appendix C: Test Commands Reference

```bash
# Backend tests
cd src-tauri
cargo test
cargo test --release

# Frontend tests
npm test
npm run test:unit
npm run test:integration

# Linting
npm run lint
cd src-tauri && cargo clippy

# Coverage
cd src-tauri && cargo tarpaulin --out Html

# Security
cd src-tauri && cargo audit
```

---

**Document Status:** ✅ COMPLETE  
**Ready for Implementation:** YES  
**Estimated Total Effort:** 4 weeks  
**Expected Impact:** ~3,454 lines removed, 72-86% warning reduction  
**Risk Level:** LOW (with proper safety measures)

---

**Created:** 2026-02-22  
**Last Updated:** 2026-02-22  
**Version:** 1.0  
**Author:** Kiro AI Assistant
