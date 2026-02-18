# Design Document: Codebase Stabilization Audit

## Overview

This design defines a comprehensive three-phase approach to stabilize the Kiyya Desktop codebase by eliminating architectural drift, removing dead code, and establishing a clean foundation for future development. The stabilization process will audit the entire codebase, enforce zero-warning compilation, and produce accurate documentation reflecting the actual system architecture.

The goal is not to add features or redesign systems, but to achieve a clean, minimal, deterministic codebase that is easy to understand, maintain, and debug.

## Top-Priority Additions Summary

Before beginning Phase 2 cleanup, the following infrastructure must be in place:

1. **CI Pipeline** - GitHub Actions workflow enforcing testing matrix and phase gates
2. **IPC/Tauri Smoke Test** - Automated verification that Tauri commands work (Phase 1 requirement)
3. **DB Migration Safety** - Backup, idempotency, rollback hooks
4. **PR Template & Tagging Rules** - No force-push after tags, structured PR reviews
5. **Automated Audit Scripts** - Concrete grep commands generating structured audit reports
6. **Reproducible Claim Example** - Known working Odysee claim stored in repo for Phase 6
7. **Observability Decision** - Structured logging format or removal documentation
8. **Test Scaffolding** - Unit, integration, and property test quotas with coverage targets
9. **Safety Commands** - `test_connection` and `build_cdn_playback_url_test` Tauri commands
10. **Developer Tooling** - Makefile, scripts, formatting rules, pre-commit hooks

## Architecture

### Three-Phase Approach with Gates

```
PHASE 0: Infrastructure Setup (MUST COMPLETE BEFORE PHASE 1)
  ├─> Create CI/CD pipeline (GitHub Actions)
  ├─> Add IPC smoke test infrastructure
  ├─> Create DB backup scripts
  ├─> Add PR template and branch protection rules
  ├─> Create automated audit scripts
  ├─> Add test Tauri commands (test_connection, build_cdn_playback_url_test)
  ├─> Store reproducible claim example
  ├─> Set up Makefile and developer tooling
  └─> Create deliverables directory structure

PHASE 1: Full Codebase Audit (GATE: CI must pass + IPC smoke test)
  ├─> Run automated audit scripts
  ├─> Identify unused code (functions, structs, enums, imports)
  ├─> Identify dead modules and orphaned utilities
  ├─> Identify unregistered Tauri commands
  ├─> Identify redundant files and duplicate logic
  ├─> Categorize findings (safe to delete, legacy, incomplete)
  ├─> Run IPC smoke test (MANDATORY)
  └─> Generate structured audit report

PHASE 2: Clean Build Enforcement (GATE: DB backup + idempotency verified)
  ├─> Backup database before any changes
  ├─> Enable strict compilation (zero warnings)
  ├─> Resolve logging system status (integrate or remove)
  ├─> Resolve migration system status (verify or remove)
  ├─> Resolve security logging status (integrate or remove)
  ├─> Verify Tauri command registration
  ├─> Remove all dead code and unused imports
  └─> Verify DB migration idempotency

PHASE 3: Architecture Re-Stabilization (GATE: All tests pass + coverage >= 60%)
  ├─> Verify all Tauri commands work properly
  ├─> Confirm no command hangs or async issues
  ├─> Produce clean build (zero warnings)
  ├─> Update architecture documentation
  ├─> Run security audit (cargo audit)
  └─> Verify test coverage quotas

PHASE 4: Odysee Debug Preparation (GATE: Reproducible claim test passes)
  ├─> Test with known working claim from fixtures
  ├─> Add tracing to content pipeline
  ├─> Create ODYSEE_DEBUG_PLAYBOOK.md
  └─> Prepare foundation for precise debugging
```

### Audit Scope

The audit will cover:

1. **Rust Backend:**
   - src-tauri/src/*.rs (all modules)
   - Unused functions, structs, enums
   - Unused imports and dead modules
   - Tauri command registration

2. **Tauri Configuration:**
   - tauri.conf.json
   - Cargo.toml dependencies
   - Build configuration

3. **Frontend:**
   - React components
   - TypeScript modules
   - API layer integration
   - Player integration
   - State management

4. **Logging Systems:**
   - error_logging.rs
   - security_logging.rs
   - logging.rs
   - Database-backed logging
   - log_result_error helpers

5. **Migration System:**
   - migrations.rs
   - get_migrations usage
   - run_migrations usage
   - Database initialization flow

6. **Security Logging:**
   - SecurityEvent variants
   - log_security_events usage

### CI/CD Pipeline Requirements

**GitHub Actions Workflow** (`.github/workflows/stabilization.yml`):

```yaml
name: Stabilization CI

on:
  pull_request:
    branches:
      - 'feature/stabilize/*'
  push:
    branches:
      - main

jobs:
  stabilization-checks:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Setup Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          
      - name: Install dependencies
        run: npm ci
        
      - name: Lint frontend
        run: npm run lint
        
      - name: Build frontend
        run: npm run build
        
      - name: Build backend
        run: cd src-tauri && cargo build
        
      - name: Run backend tests
        run: cd src-tauri && cargo test
        
      - name: Run clippy (Phase 5+)
        run: cd src-tauri && cargo clippy -- -D warnings
        continue-on-error: ${{ github.event.pull_request.head.ref != 'feature/stabilize/phase5' }}
        
      - name: Run security audit
        run: cd src-tauri && cargo audit
        
      - name: Run IPC smoke test
        run: npm run test:ipc-smoke
        
      - name: Check test coverage
        run: cd src-tauri && cargo tarpaulin --out Xml
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

**Enforcement Rules:**
- All checks must pass before PR can be merged
- Clippy warnings allowed until Phase 5
- IPC smoke test is mandatory from Phase 1
- Security audit must pass (no critical vulnerabilities)
- Test coverage must be >= 60% by Phase 3

## Components and Interfaces

### Phase 0: Infrastructure Setup Component

**Required Infrastructure Before Phase 1:**

```rust
// Safety Tauri commands to add immediately

#[tauri::command]
pub async fn test_connection() -> Result<String, String> {
    Ok("tauri-backend-alive".into())
}

#[tauri::command]
pub fn build_cdn_playback_url_test(claim_id: String) -> String {
    let gateway = get_cdn_gateway();
    format!("{}/content/{}/master.m3u8", gateway, claim_id)
}
```

**Scripts to Create:**

1. **`scripts/db_snapshot.sh`** - Database backup before migrations:
```bash
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_PATH="${1:-~/.kiyya/app.db}"
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"
cp "$DB_PATH" "$BACKUP_DIR/${TIMESTAMP}-db.sqlite"
echo "Backup created: $BACKUP_DIR/${TIMESTAMP}-db.sqlite"
```

2. **`scripts/generate_audit_report.sh`** - Automated audit report generation:
```bash
#!/bin/bash
echo "Generating audit report..."

# Collect compiler warnings
cd src-tauri
cargo build 2>&1 | tee ../audit_warnings.txt

# Run clippy
cargo clippy 2>&1 | tee ../audit_clippy.txt

# Find Tauri commands
rg "#\[tauri::command\]" -n . | tee ../tauri_command_defs.txt

# Find registrations
rg "invoke_handler\(|tauri::Builder" -n . | tee ../tauri_builder.txt

# Generate structured JSON report
rg --json "unused" ../audit_warnings.txt > ../audit_report.json

echo "Audit report generated: audit_report.json"
```

3. **`scripts/ipc_smoke_test.sh`** - IPC connectivity test:
```bash
#!/bin/bash
# Start app in headless mode and test IPC
npm run tauri:dev &
APP_PID=$!
sleep 5

# Test connection command
node -e "
const { invoke } = require('@tauri-apps/api/tauri');
invoke('test_connection')
  .then(res => { console.log('✓ IPC OK:', res); process.exit(0); })
  .catch(err => { console.error('✗ IPC FAIL:', err); process.exit(1); });
"

TEST_RESULT=$?
kill $APP_PID
exit $TEST_RESULT
```

**Makefile** (`Makefile`):
```makefile
.PHONY: build-backend build-frontend test clean audit snapshot

build-backend:
	cd src-tauri && cargo build

build-frontend:
	npm run build

test:
	cd src-tauri && cargo test
	npm run lint

audit:
	./scripts/generate_audit_report.sh

snapshot:
	./scripts/db_snapshot.sh

clean:
	cd src-tauri && cargo clean
	rm -rf node_modules dist
```

**Deliverables Directory Structure:**
```
stabilization/
├── AUDIT_REPORT.md
├── DELETIONS.md
├── DECISIONS.md
├── LOGGING_DECISION.md
├── LEGACY_TO_REVIEW.md
├── ARCHITECTURE.md
├── STEPS_TO_REPRODUCE.md
├── CI_WORKFLOW.md
└── ODYSEE_DEBUG_PLAYBOOK.md
```

**Test Fixtures:**
```
tests/fixtures/
├── claim_working.json          # Known working Odysee claim
└── claim_hero_sample.json      # Sample hero claim for integration tests
```

### Phase 1: Audit Component

**IPC Smoke Test (MANDATORY Phase 1 Requirement):**

After build, verify Tauri IPC connectivity:

**Manual Test:**
1. Open app window DevTools Console
2. Run:
```javascript
window.__TAURI__.invoke('test_connection')
  .then(res => console.log('TAURI OK', res))
  .catch(err => console.error('TAURI FAIL', err));
```

**Automated Test (CI):**
- Run `scripts/ipc_smoke_test.sh` in CI pipeline
- Must pass before proceeding to Phase 2
- Record output in CI logs

**Acceptance Criteria:**
- `test_connection` command returns "tauri-backend-alive"
- No timeout or connection errors
- Test passes in both dev and CI environments

**Audit Process:**

```rust
// Pseudo-code for audit logic
struct AuditFinding {
    item_type: ItemType,  // Function, Struct, Enum, Import, Module, etc.
    location: String,      // File path and line number
    name: String,          // Item name
    category: Category,    // SafeToDelete, PossiblyLegacy, IncompleteFeature
    reason: String,        // Why it's unused
    usage_count: usize,    // Number of references found
}

enum ItemType {
    Function,
    Struct,
    Enum,
    Import,
    Module,
    TauriCommand,
    File,
}

enum Category {
    SafeToDelete,
    PossiblyLegacy,
    IncompleteFeature,
}

impl AuditProcess {
    fn audit_rust_backend() -> Vec<AuditFinding>;
    fn audit_tauri_commands() -> Vec<AuditFinding>;
    fn audit_frontend() -> Vec<AuditFinding>;
    fn audit_logging_system() -> LoggingSystemStatus;
    fn audit_migration_system() -> MigrationSystemStatus;
    fn audit_security_logging() -> SecurityLoggingStatus;
    fn categorize_findings(findings: Vec<AuditFinding>) -> CategorizedFindings;
    fn generate_structured_report(findings: Vec<AuditFinding>) -> String; // JSON output
}
```

**Audit Methodology:**

1. **Compiler Warnings Analysis:**
   - Run `cargo build` and capture all warnings
   - Parse warnings for unused items
   - Cross-reference with actual usage

2. **Static Analysis:**
   - Use `cargo clippy` for additional insights
   - Identify dead code patterns
   - Identify unreachable code

3. **Automated Grep-Based Search:**
   ```bash
   # Find Tauri commands
   rg "#\[tauri::command\]" -n src-tauri | tee tauri_command_defs.txt
   
   # Find registrations in main.rs
   rg "invoke_handler\(|tauri::Builder" -n src-tauri | tee tauri_builder.txt
   
   # Find usages of a specific function
   rg "function_name\b" -n src-tauri || echo "No usages found"
   
   # Find dynamic invoke patterns (safety check)
   rg "invoke\(|window.__TAURI__\.invoke" -n src
   ```

4. **Structured Report Generation:**
   - Use `rg --json` for machine-readable output
   - Generate `audit_report.json` with file, line, snippet, usage counts
   - Parse into `AUDIT_REPORT.md` for human review

5. **Manual Review:**
   - Review findings for false positives
   - Categorize based on context and history
   - Identify incomplete features

**Tauri Command Deletion Safety (IPC Safety Rule):**

Before deleting any `#[tauri::command]` function:

1. Run across frontend:
   ```bash
   rg "invoke\(|window.__TAURI__\.invoke" -n src
   ```

2. Check for dynamic invocation patterns:
   ```javascript
   // Dangerous: runtime-built command names
   const cmdName = `fetch_${type}_data`;
   invoke(cmdName, params);
   ```

3. If dynamic patterns exist:
   - Conservatively keep the command
   - OR move deletion to separate refactor PR
   - Document in `DELETIONS.md`

4. Record evidence:
   - Zero grep hits = safe to delete
   - Any hits = review each usage
   - Document in `DELETIONS.md` with matching grep output

### Phase 2: Cleanup Component

**Database Migration Safety (CRITICAL):**

**Pre-Migration Backup:**
```rust
fn pre_migration_backup(db_path: &Path) -> Result<PathBuf> {
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let backup_dir = Path::new("./backups");
    fs::create_dir_all(backup_dir)?;
    
    let backup_path = backup_dir.join(format!("{}-db.sqlite", timestamp));
    fs::copy(db_path, &backup_path)?;
    
    info!("Database backup created: {:?}", backup_path);
    Ok(backup_path)
}
```

**Migration Idempotency:**
```rust
// migrations table schema
CREATE TABLE IF NOT EXISTS migrations (
    version INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checksum TEXT NOT NULL
);

fn run_migrations(&self) -> Result<()> {
    // Get last applied migration version
    let last_version = self.get_last_migration_version()?;
    
    // Get pending migrations (version > last_version)
    let pending = self.get_pending_migrations(last_version)?;
    
    // Skip already-applied migrations
    for migration in pending {
        if !self.is_migration_applied(migration.version)? {
            self.apply_migration(migration)?;
        }
    }
    
    Ok(())
}
```

**Dry-Run Mode:**
```rust
fn run_migrations_dry_run(&self) -> Result<Vec<MigrationPlan>> {
    let pending = self.get_pending_migrations()?;
    let mut plans = Vec::new();
    
    for migration in pending {
        // Validate SQL without executing
        let plan = MigrationPlan {
            version: migration.version,
            description: migration.description,
            sql: migration.sql,
            validation: self.validate_sql(&migration.sql)?,
        };
        plans.push(plan);
    }
    
    Ok(plans)
}
```

**Rollback Path:**
- Maintain `down_migrations` for each migration
- Document snapshot restore steps in `DECISIONS.md`
- Test duplicate migration scenario:
  ```rust
  #[test]
  fn test_migration_idempotency() {
      let db = setup_test_db();
      
      // Run migrations twice
      db.run_migrations().unwrap();
      db.run_migrations().unwrap();
      
      // Verify no double-apply
      let count = db.get_migration_count().unwrap();
      assert_eq!(count, EXPECTED_MIGRATION_COUNT);
  }
  ```

**Acceptance Criteria:**
- Backup exists before migration execution
- Backup is restorable (test restoration)
- Migrations skip already-applied versions
- Dry-run validates SQL without applying
- Rollback path is documented

**Cleanup Process:**

```rust
// Pseudo-code for cleanup logic
struct CleanupAction {
    action_type: ActionType,  // Remove, Integrate, Modify
    target: String,            // File path or item name
    description: String,       // What will be done
    safety_check: SafetyCheck, // Pre-deletion verification
}

enum ActionType {
    Remove,      // Delete the item
    Integrate,   // Fully integrate the item
    Modify,      // Modify to fix warnings
}

struct SafetyCheck {
    grep_hits: usize,          // Number of references found
    dynamic_invoke: bool,      // Dynamic invocation detected
    evidence_file: String,     // Path to DELETIONS.md entry
}

impl CleanupProcess {
    fn remove_unused_code(findings: Vec<AuditFinding>) -> Vec<CleanupAction>;
    fn resolve_logging_system(status: LoggingSystemStatus) -> Vec<CleanupAction>;
    fn resolve_migration_system(status: MigrationSystemStatus) -> Vec<CleanupAction>;
    fn resolve_security_logging(status: SecurityLoggingStatus) -> Vec<CleanupAction>;
    fn verify_tauri_commands() -> Vec<CleanupAction>;
    fn execute_cleanup(actions: Vec<CleanupAction>) -> CleanupResult;
    fn verify_safety_checks(action: &CleanupAction) -> Result<()>;
}
```

**Cleanup Strategy:**

1. **Safe Deletions:**
   - Remove unused imports
   - Remove unused helper functions
   - Remove dead modules
   - Remove redundant files
   - **Always verify with grep before deletion**

2. **System Resolutions:**
   - **Logging System:** Determine if integrated or remove entirely
   - **Migration System:** Verify usage or remove complexity
   - **Security Logging:** Verify usage or remove entirely

3. **Integration Work:**
   - If logging is partially integrated, complete the integration
   - If migrations are partially integrated, complete the integration
   - Ensure all integrated systems are tested

4. **Strict Compilation:**
   - Enable `#![deny(warnings)]` or equivalent **ONLY in Phase 5**
   - Fix all remaining warnings
   - Achieve zero-warning build

**Logging System Decision (Phase 3):**

**If Integrating Logging:**

1. **Use Consistent Framework:**
   - Use `tracing` or `log` crate consistently
   - Initialize once in `main.rs`

2. **Structured Logging Format (JSON):**
   ```json
   {
     "ts": "2026-02-18T12:34:56Z",
     "level": "INFO",
     "component": "backend.extract_video_urls",
     "claim_id": "abc123",
     "correlation_id": "req-xyz",
     "message": "constructed cdn url",
     "url": "https://cloud.odysee.live/content/abc123/master.m3u8"
   }
   ```

3. **Required Fields:**
   - `timestamp` - ISO 8601 format
   - `level` - DEBUG, INFO, WARN, ERROR
   - `component` - Module or function name
   - `claim_id` / `context` - Request context
   - `message` - Human-readable description

4. **Security:**
   - Redact tokens, credentials, API keys
   - Never log passwords or sensitive user data
   - Document redaction rules in `LOGGING_DECISION.md`

5. **Configuration:**
   - Add `LOG_LEVEL` environment variable
   - Default to `INFO` in production
   - Default to `DEBUG` in development
   - Support `RUST_LOG` for fine-grained control

6. **Rotation/Retention:**
   - Document log rotation strategy
   - Set retention policy (e.g., 30 days)
   - Consider log aggregation for production

**If Removing Logging:**

1. **Replace Critical Logs:**
   - Use `eprintln!()` for critical errors during stabilization
   - Add `TODO` tags for future logging decisions
   - Example:
     ```rust
     // TODO(stabilization): Decide on logging framework
     eprintln!("CRITICAL: Database migration failed: {}", err);
     ```

2. **Document Decision:**
   - Create `stabilization/LOGGING_DECISION.md`
   - Explain why logging was removed
   - Document future logging requirements

**Either Case:**
- Document decision in `stabilization/LOGGING_DECISION.md`
- Ensure consistency across codebase
- No half-integrated systems allowed

### Phase 3: Re-Stabilization Component

**Test Coverage Requirements:**

1. **Property Tests:**
   - Minimum 100 cases each (already configured)
   - Record run times in test output
   - Tag with feature and property number

2. **Unit Tests:**
   - Each modified module must have >= 60% coverage
   - Use `cargo tarpaulin` or `grcov` for coverage measurement
   - Run in CI pipeline

3. **Integration Tests:**
   - Hero/Series/Movies integration tests must be headless and repeatable
   - Use known sample claim from `tests/fixtures/claim_hero_sample.json`
   - Test full pipeline: fetch → parse → playback URL construction

**Coverage Measurement:**
```bash
# Install tarpaulin
cargo install cargo-tarpaulin

# Run coverage
cd src-tauri
cargo tarpaulin --out Xml --out Html

# View report
open tarpaulin-report.html
```

**Re-Stabilization Process:**

```rust
// Pseudo-code for re-stabilization logic
struct StabilizationCheck {
    check_type: CheckType,
    status: CheckStatus,
    details: String,
    coverage: Option<f64>,  // Test coverage percentage
}

enum CheckType {
    TauriCommandRegistration,
    TauriCommandFunctionality,
    AsyncCallCompletion,
    BuildWarnings,
    ArchitectureDocumentation,
    TestCoverage,
    SecurityAudit,
}

enum CheckStatus {
    Pass,
    Fail,
}

impl ReStabilizationProcess {
    fn verify_tauri_commands() -> Vec<StabilizationCheck>;
    fn verify_async_calls() -> Vec<StabilizationCheck>;
    fn verify_clean_build() -> StabilizationCheck;
    fn verify_test_coverage() -> StabilizationCheck;
    fn run_security_audit() -> StabilizationCheck;
    fn update_architecture_docs() -> Vec<String>;  // Updated file paths
    fn produce_deliverables() -> Deliverables;
}
```

**Re-Stabilization Checks:**

1. **Tauri Command Verification:**
   - Verify all commands are registered
   - Test each command for functionality
   - Ensure no command hangs
   - Ensure all async calls return

2. **Build Verification:**
   - Run `cargo build` and verify zero warnings
   - Run `cargo clippy` and verify zero warnings
   - Run `cargo test` and verify all tests pass

3. **Security Audit:**
   - Run `cargo audit` to check for vulnerable crates
   - Pin critical dependencies to safe versions
   - Document exceptions in `DECISIONS.md`

4. **Test Coverage Verification:**
   - Run `cargo tarpaulin` and verify >= 60% coverage
   - Identify uncovered critical paths
   - Add tests for uncovered code

5. **Documentation Update:**
   - Update ARCHITECTURE.md with actual structure
   - Document logging architecture (if retained)
   - Document migration state
   - Document playback model
   - Document backend command list
   - Create flow diagrams

### Phase 4: Odysee Debug Preparation Component

**Reproducible Claim Example (CRITICAL):**

Store a known working Odysee claim in `tests/fixtures/claim_working.json`:

```json
{
  "claim_id": "abc123example",
  "name": "sample-video",
  "value": {
    "stream": {
      "source": {
        "sd_hash": "...",
        "media_type": "video/mp4"
      }
    }
  },
  "permanent_url": "lbry://@channel#c/video#a",
  "canonical_url": "lbry://@channel#c/video#a"
}
```

**Selection Criteria:**
- Publicly playable claim (no authentication required)
- Stable content (won't be deleted)
- Representative of typical content
- Sanitized (no sensitive data)

**Usage:**
- Local integration testing
- CI pipeline testing
- Reproducible debugging
- Switch via environment variable: `TEST_CLAIM_ID`

**ODYSEE_DEBUG_PLAYBOOK.md:**

Create `stabilization/ODYSEE_DEBUG_PLAYBOOK.md` with exact debugging steps:

```markdown
# Odysee Playback Debugging Playbook

## Prerequisites
- Clean build passing (Phase 3 complete)
- Test claim available in `tests/fixtures/claim_working.json`

## Step-by-Step Debugging

### 1. Build and Test
```bash
cd src-tauri && cargo build && cargo test
```

### 2. Start Development Environment
```bash
# Terminal 1: Frontend dev server
npm start

# Terminal 2: Tauri dev
npm run tauri:dev
```

### 3. Test Claim Fetch
Open app window → Inspect → Console:

```javascript
// Test channel claims fetch
window.__TAURI__.invoke('fetch_channel_claims', { 
  channelId: '@kiyyamovies:b' 
})
  .then(r => console.log('claims', r))
  .catch(e => console.error('fetch err', e));
```

### 4. Test Playback URL Construction
If claims are returned, copy first claim JSON and test URL construction:

```javascript
window.__TAURI__.invoke('build_cdn_playback_url_test', { 
  claim_id: 'abc123' 
})
  .then(url => console.log('CDN URL:', url))
  .catch(e => console.error('URL construction err', e));
```

### 5. Capture Backend Logs
Monitor PowerShell output or capture logs:

```bash
# Windows
npm run tauri:dev 2>&1 | tee debug_output.txt

# Check for errors in output
grep -i "error\|fail\|panic" debug_output.txt
```

### 6. Test with Known Working Claim
```javascript
// Load test claim
fetch('/tests/fixtures/claim_working.json')
  .then(r => r.json())
  .then(claim => {
    return window.__TAURI__.invoke('test_playback_url', { claim });
  })
  .then(console.log)
  .catch(console.error);
```

### 7. Attach Evidence to PR
- Capture console output
- Capture backend logs
- Capture network requests (DevTools Network tab)
- Document exact failure point
```

**Test Playback URL Command:**

Add deterministic test command that returns CDN URL without attempting playback:

```rust
#[tauri::command]
pub fn test_playback_url(claim: serde_json::Value) -> Result<String, String> {
    let claim_id = claim["claim_id"]
        .as_str()
        .ok_or("Missing claim_id")?;
    
    let gateway = get_cdn_gateway();
    let url = format!("{}/content/{}/master.m3u8", gateway, claim_id);
    
    Ok(url)
}
```

## Data Models

No changes to data models are required. This is a cleanup and stabilization effort, not a feature addition or redesign.

**New Data Structures for Stabilization:**

```rust
// Audit report structure
struct AuditReport {
    timestamp: DateTime<Utc>,
    total_warnings: usize,
    findings: Vec<AuditFinding>,
    categorized: CategorizedFindings,
    recommendations: Vec<String>,
}

// Migration backup metadata
struct MigrationBackup {
    timestamp: DateTime<Utc>,
    db_path: PathBuf,
    backup_path: PathBuf,
    checksum: String,
}

// Test coverage report
struct CoverageReport {
    overall_coverage: f64,
    module_coverage: HashMap<String, f64>,
    uncovered_lines: Vec<(String, usize)>,
}
```

## PR Template and Branch Protection

**PR Template** (`.github/PULL_REQUEST_TEMPLATE.md`):

```markdown
# Stabilization PR

## Phase
- [ ] Phase 0: Infrastructure Setup
- [ ] Phase 1: Audit
- [ ] Phase 2: Cleanup
- [ ] Phase 3: Re-Stabilization
- [ ] Phase 4: Odysee Debug Preparation

## Commands Run Locally

### Build
```
<paste cargo build output>
```

### Tests
```
<paste cargo test output>
```

### Clippy
```
<paste cargo clippy output>
```

### Coverage
```
<paste cargo tarpaulin output>
```

## Tag Created
- Tag name: `v-stabilize-phase-X-<description>`
- Commit SHA: `<sha>`

## Files Changed
- List key files modified
- Rationale for each change

## Deferred Items
- List any items deferred to future PRs
- Justification for deferral

## Summary
One-paragraph summary of changes and impact.

## Checklist
- [ ] CI passes
- [ ] IPC smoke test passes (Phase 1+)
- [ ] DB backup created (Phase 2+)
- [ ] Test coverage >= 60% (Phase 3+)
- [ ] Security audit passes
- [ ] Documentation updated
- [ ] Manual testing completed
- [ ] Reviewer assigned
```

**Branch Protection Rules** (`PROTECTED_BRANCHES.md`):

```markdown
# Branch Protection Rules

## Protected Branches
- `main`
- `feature/stabilize/*`

## Rules for `main`
1. Require pull request reviews before merging
2. Require status checks to pass before merging:
   - CI build
   - Backend tests
   - Frontend lint
   - Security audit
   - IPC smoke test
3. Require branches to be up to date before merging
4. No force pushes allowed
5. No deletions allowed
6. Require linear history

## Rules for `feature/stabilize/*`
1. Require status checks to pass before merging
2. No force pushes after tag creation
3. Require review from assigned reviewer

## Tag Protection
- Tags matching `v-stabilize-*` cannot be deleted
- Tags cannot be overwritten
- No force push after tag creation

## Enforcement
Enable branch protection in GitHub repository settings:
Settings → Branches → Add rule
```

**No Force-Push Policy:**

After creating a tag:
1. Tag marks a checkpoint
2. No history rewriting allowed
3. If changes needed, create new commit
4. Create new tag for new checkpoint

**Rollback Checklist:**

For each phase, document rollback steps in `DECISIONS.md`:

```markdown
## Phase 2 Rollback Checklist

### If Migration Fails
1. Tag created: `v-stabilize-migrations-kept`
2. Rollback command: `git reset --hard v-stabilize-migrations-kept`
3. Restore DB: `cp backups/<timestamp>-db.sqlite ~/.kiyya/app.db`
4. Verify restoration: `npm run tauri:dev`
5. Document failure in `DECISIONS.md`

### If Cleanup Breaks Tests
1. Tag created: `v-stabilize-pre-cleanup`
2. Rollback command: `git reset --hard v-stabilize-pre-cleanup`
3. Review failed tests
4. Re-categorize problematic code as "Possibly Legacy"
5. Create new PR with conservative approach
```

## Developer Tooling and Ergonomics

**Linting and Formatting:**

1. **Rust Formatting** (`rustfmt.toml`):
```toml
max_width = 100
hard_tabs = false
tab_spaces = 4
newline_style = "Auto"
use_small_heuristics = "Default"
reorder_imports = true
reorder_modules = true
remove_nested_parens = true
edition = "2021"
```

2. **ESLint Configuration** (`.eslintrc.js`):
```javascript
module.exports = {
  extends: ['eslint:recommended', 'plugin:react/recommended'],
  rules: {
    'no-unused-vars': 'error',
    'no-console': 'warn',
  },
};
```

3. **Prettier Configuration** (`.prettierrc`):
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

**Pre-Commit Hooks:**

Install Husky for pre-commit hooks:

```bash
npm install --save-dev husky
npx husky install
npx husky add .husky/pre-commit "npm run lint && cd src-tauri && cargo fmt --check"
```

**Makefile Shortcuts:**

Already defined in Phase 0 infrastructure. Additional targets:

```makefile
.PHONY: format check-format coverage security-audit

format:
	cd src-tauri && cargo fmt
	npm run prettier -- --write

check-format:
	cd src-tauri && cargo fmt -- --check
	npm run prettier -- --check

coverage:
	cd src-tauri && cargo tarpaulin --out Html
	open src-tauri/tarpaulin-report.html

security-audit:
	cd src-tauri && cargo audit
```

**CONTRIBUTING.md:**

```markdown
# Contributing to Kiyya Desktop

## Stabilization Phase Discipline

We are currently in a stabilization phase. All contributions must follow the phase discipline:

### Phase Workflow
1. Phase 0: Infrastructure setup (CI, scripts, tooling)
2. Phase 1: Audit (identify unused code)
3. Phase 2: Cleanup (remove dead code, resolve systems)
4. Phase 3: Re-stabilization (verify, test, document)
5. Phase 4: Odysee debug preparation

### Before Submitting PR
1. Run local checks:
   ```bash
   make test
   make check-format
   make security-audit
   ```

2. Ensure CI passes locally:
   ```bash
   npm ci
   npm run lint
   npm run build
   cd src-tauri && cargo build && cargo test && cargo clippy
   ```

3. Create tag for checkpoint:
   ```bash
   git tag v-stabilize-phase-X-<description>
   git push origin v-stabilize-phase-X-<description>
   ```

4. Fill out PR template completely

5. Assign reviewer

### Code Standards
- Rust: Follow `rustfmt` formatting
- TypeScript: Follow ESLint and Prettier rules
- Tests: Minimum 60% coverage for modified modules
- Documentation: Update for all public APIs

### Commit Messages
- Use conventional commits format
- Examples:
  - `feat(audit): add automated audit script`
  - `fix(migrations): add idempotency check`
  - `docs(architecture): update module diagram`
  - `test(integration): add hero claim test`

### Review Process
- All PRs require review
- CI must pass
- No force pushes after tag creation
- Address all review comments
```

**Environment Configuration:**

Add `APP_ENV` environment variable support:

```rust
// In main.rs
fn get_app_env() -> String {
    std::env::var("APP_ENV").unwrap_or_else(|_| "development".to_string())
}

fn should_enable_debug_features() -> bool {
    get_app_env() == "development"
}

// Use in code
if should_enable_debug_features() {
    // Enable reachability HEAD requests
    // Enable verbose logging
    // Enable debug endpoints
}
```

**Safety for Production vs Dev:**

```rust
// Only in development
#[cfg(debug_assertions)]
fn enable_dev_features() {
    // Reachability checks
    // Debug logging
    // Test endpoints
}

// Production-safe
#[cfg(not(debug_assertions))]
fn enable_dev_features() {
    // No-op in production
}
```

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the acceptance criteria analysis, we identify the following correctness properties:

### Property 1: Zero-Warning Compilation

*For any* compilation of the codebase after cleanup, the build process should produce zero warnings, regardless of the compilation target or configuration.

**Validates: Requirements 2.1, 2.4**

### Property 2: No Unused Code

*For any* function, struct, enum, or module in the codebase after cleanup, it should be either used in the application or removed completely.

**Validates: Requirements 2.2, 7.3, 7.4**

### Property 3: Tauri Command Registration

*For any* Tauri command defined in the Rust backend, it should be registered in the Tauri builder and accessible from the frontend.

**Validates: Requirements 6.1, 6.2, 6.5**

### Property 4: Async Call Completion

*For any* async function or Tauri command, when invoked, it should complete and return a result (success or error) without hanging indefinitely.

**Validates: Requirements 6.3, 6.4**

### Property 5: System Integration Consistency

*For any* system (logging, migrations, security logging), it should be either fully integrated and functional or completely removed from the codebase.

**Validates: Requirements 3.8, 4.5, 5.3**

### Property 6: Documentation Accuracy

*For any* architectural component described in documentation, it should exist and function as documented in the actual codebase.

**Validates: Requirements 9.1, 9.2, 9.3**

### Example-Based Tests

The following scenarios should be tested with specific examples:

**Example 1: Clean Build**
- Run `cargo build` after cleanup
- Verify zero warnings are produced
- Verify build succeeds
- **Validates: Requirements 2.1**

**Example 2: Tauri Command Invocation**
- Identify all registered Tauri commands
- Invoke each command from frontend
- Verify each command returns a result
- Verify no command hangs
- **Validates: Requirements 6.1, 6.2, 6.3**

**Example 3: Logging System Status**
- Check if error_logging.rs is used
- Check if security_logging.rs is used
- Check if logging.rs is used
- Verify either all are integrated or all are removed
- **Validates: Requirements 3.1, 3.2, 3.3, 3.8**

**Example 4: Migration System Status**
- Check if get_migrations is called
- Check if run_migrations is called
- Verify migrations are executed during initialization
- **Validates: Requirements 4.1, 4.2, 4.3**

**Example 5: Security Logging Status**
- Check if SecurityEvent variants are constructed
- Check if log_security_events is called
- Verify either integrated or removed
- **Validates: Requirements 5.1, 5.2**

**Example 6: Application Functionality**
- Start the application after cleanup
- Test core features (playback, favorites, playlists)
- Verify all features work as before
- **Validates: Requirements 11.1, 11.3**

## Error Handling

### Audit Phase Errors

**Potential Issues:**
- False positives in unused code detection
- Ambiguous categorization of findings
- Missing context for legacy code

**Handling Strategy:**
- Manual review of all findings
- Conservative categorization (when in doubt, mark as "Possibly Legacy")
- Document reasoning for each categorization

### Cleanup Phase Errors

**Potential Issues:**
- Accidental removal of used code
- Breaking changes during integration
- Test failures after cleanup

**Handling Strategy:**
- Run tests after each cleanup action
- Use version control to track changes
- Rollback if tests fail
- Re-categorize if removal causes issues

### Re-Stabilization Phase Errors

**Potential Issues:**
- Tauri commands fail after cleanup
- Documentation becomes outdated
- New warnings appear

**Handling Strategy:**
- Test all Tauri commands manually
- Keep documentation in sync with code changes
- Re-run cleanup if new warnings appear

## Testing Strategy

### Dual Testing Approach

This stabilization effort requires both automated and manual testing:

**Automated Tests:**
- Run existing test suite after each cleanup action
- Verify zero warnings with `cargo build`
- Verify zero clippy warnings with `cargo clippy`
- Run property tests to verify correctness properties

**Manual Tests:**
- Test each Tauri command from frontend
- Test core application features
- Verify documentation accuracy
- Review audit findings for false positives

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
        // Tag: Feature: codebase-stabilization-audit, Property N: [property text]
    }
}
```

**Property Tests to Implement:**

1. **Zero-Warning Compilation** (Property 1)
   - Compile the codebase with various configurations
   - Verify zero warnings in all cases
   - Tag: `Feature: codebase-stabilization-audit, Property 1: Zero-warning compilation`

2. **No Unused Code** (Property 2)
   - Parse the codebase for all definitions
   - Verify each definition is used or removed
   - Tag: `Feature: codebase-stabilization-audit, Property 2: No unused code`

3. **Tauri Command Registration** (Property 3)
   - Parse all Tauri command definitions
   - Verify each is registered in the builder
   - Tag: `Feature: codebase-stabilization-audit, Property 3: Tauri command registration`

4. **Async Call Completion** (Property 4)
   - Invoke all async functions and Tauri commands
   - Verify each completes within a reasonable timeout
   - Tag: `Feature: codebase-stabilization-audit, Property 4: Async call completion`

5. **System Integration Consistency** (Property 5)
   - Check logging, migrations, security logging systems
   - Verify each is fully integrated or fully removed
   - Tag: `Feature: codebase-stabilization-audit, Property 5: System integration consistency`

6. **Documentation Accuracy** (Property 6)
   - Parse documentation for architectural claims
   - Verify each claim matches the actual codebase
   - Tag: `Feature: codebase-stabilization-audit, Property 6: Documentation accuracy`

### Test Organization

```
src-tauri/src/
└── tests/
    ├── stabilization_audit_test.rs (new - audit verification)
    ├── stabilization_property_test.rs (new - property tests)
    └── tauri_command_test.rs (new - command verification)
```

### Existing Tests

All existing tests should continue to pass after stabilization:
- All property tests
- All unit tests
- All integration tests

### Manual Testing

After implementing stabilization:

1. **Build Verification:**
   - Run `cargo build`
   - Verify zero warnings
   - Verify build succeeds

2. **Application Startup:**
   - Run `npm run tauri:dev`
   - Verify application starts without errors
   - Verify no console warnings

3. **Feature Testing:**
   - Test video playback
   - Test favorites
   - Test playlists
   - Test progress tracking
   - Verify all features work as before

4. **Tauri Command Testing:**
   - Test each Tauri command from frontend
   - Verify each command returns a result
   - Verify no command hangs

## Implementation Notes

### Phase 1: Audit Implementation

**Steps:**
1. Run `cargo build 2>&1 | tee audit_warnings.txt` to capture warnings
2. Run `cargo clippy 2>&1 | tee audit_clippy.txt` to capture clippy warnings
3. Parse warnings for unused items
4. Search codebase for usage of each item
5. Categorize findings
6. Produce audit report

**Tools:**
- `cargo build` for compilation warnings
- `cargo clippy` for additional warnings
- `grep` or `ripgrep` for usage search
- Manual review for categorization

### Phase 2: Cleanup Implementation

**Steps:**
1. Review audit findings
2. Start with "Safe to delete" category
3. Remove unused imports first (lowest risk)
4. Remove unused functions and structs
5. Resolve system status (logging, migrations, security)
6. Enable strict compilation
7. Fix remaining warnings
8. Run tests after each change

**Tools:**
- Version control (git) for tracking changes
- `cargo test` for verification
- `cargo build` for warning checks

### Phase 3: Re-Stabilization Implementation

**Steps:**
1. Verify all Tauri commands are registered
2. Test each Tauri command manually
3. Verify clean build (zero warnings)
4. Update ARCHITECTURE.md
5. Create flow diagrams
6. Produce deliverables document
7. Prepare for Odysee issue debugging

**Tools:**
- Manual testing for Tauri commands
- Documentation tools for diagrams
- `cargo build` for final verification

### Critical Constraints

1. **No Feature Addition:** Do not implement new features
2. **No Redesign:** Do not redesign playback or CDN logic
3. **No Breaking Changes:** Maintain all existing functionality
4. **Conservative Approach:** When in doubt, keep code and mark as "Possibly Legacy"

### Rollback Plan

If stabilization causes issues:
1. Use version control to revert changes
2. Re-categorize problematic findings
3. Take a more conservative approach
4. Document why certain code cannot be removed

### Performance Considerations

**Expected Improvements:**
- Faster compilation (less code to compile)
- Smaller binary size (less dead code)
- Easier debugging (cleaner codebase)

**No Performance Degradation:**
Removing unused code should not degrade runtime performance.

### Security Considerations

**Security Review:**
- Ensure security logging removal (if applicable) doesn't compromise security
- Verify input validation remains intact
- Verify SQL injection prevention remains intact
- Verify path security remains intact

### Compatibility Considerations

**Backward Compatible:**
- Existing database files work without modification
- User data is preserved
- All existing features continue to work

**Forward Compatible:**
- Clean foundation for future development
- Easier to add new features
- Clearer architecture for new developers

## Deliverables

### 1. Dead Code Removal List

A comprehensive list of all removed code:
- File path and line number
- Item type (function, struct, enum, etc.)
- Item name
- Reason for removal

### 2. Removed Modules List

A list of all removed modules:
- Module name
- File path
- Reason for removal
- Dependencies that were also removed

### 3. Integrated Modules List

A list of all modules that were integrated:
- Module name
- Integration approach
- Tests added
- Verification steps

### 4. Clean Build Proof

Evidence of zero-warning compilation:
- `cargo build` output
- `cargo clippy` output
- `cargo test` output

### 5. Updated Architecture Documentation

Updated ARCHITECTURE.md with:
- Actual module structure
- Backend flow diagram
- Frontend → backend invocation diagram
- Logging architecture (if retained)
- Migration state
- Playback model
- Backend command list
- Content fetch pipeline

### 6. Clear Explanation of Current Real Architecture

A document explaining:
- What systems exist and are functional
- What systems were removed and why
- What systems were integrated and how
- Current state of logging, migrations, security logging
- Current state of Tauri commands
- Current state of playback pipeline

### 7. Foundation for Odysee Issue Debugging

A document outlining:
- Clean codebase status
- Next steps for Odysee issue investigation
- Tracing points to add
- Expected behavior vs actual behavior
- Isolated failure layer hypothesis



## Edge Cases and Compatibility Checks

**Phase 3/4 Requirements:**

1. **Existing User Data:**
   - Verify local user profiles work after cleanup
   - Test with existing vaults and databases
   - Ensure no data loss during stabilization

2. **Path Security:**
   - Ensure no code uses `..` unguarded
   - Validate all file paths before use
   - No absolute file paths without validation
   - Test path traversal attack scenarios

3. **Cross-Platform Compatibility:**
   - Test on Windows, macOS, Linux
   - Verify path separators are handled correctly
   - Test with different file systems

4. **Backward Compatibility:**
   - Existing database files must work
   - User settings must be preserved
   - Favorites, playlists, progress must migrate correctly

## Security Checks

**Mandatory Security Audits:**

1. **Dependency Audit:**
   ```bash
   cd src-tauri
   cargo audit
   ```
   - Check for vulnerable crates
   - Pin critical dependencies to safe versions
   - Document exceptions in `DECISIONS.md`

2. **Input Validation:**
   - Verify SQL injection prevention remains intact
   - Verify path security validation remains intact
   - Test with malicious inputs

3. **Secrets Management:**
   - Ensure no secrets in logs
   - Redact tokens and credentials
   - Verify API keys are not exposed

4. **Authentication:**
   - Verify authentication mechanisms unchanged
   - Test session management
   - Verify encryption remains intact

## Deliverables Structure and Location

All deliverables must be placed in `stabilization/` directory:

```
stabilization/
├── AUDIT_REPORT.md              # Comprehensive audit findings
├── DELETIONS.md                 # Record of all deleted code with evidence
├── DECISIONS.md                 # Key decisions and rationale
├── LOGGING_DECISION.md          # Logging system decision and implementation
├── LEGACY_TO_REVIEW.md          # Code marked as "Possibly Legacy"
├── ARCHITECTURE.md              # Updated architecture documentation
├── STEPS_TO_REPRODUCE.md        # Phase 4 sample claim and reproduction steps
├── CI_WORKFLOW.md               # CI instructions and badge
└── ODYSEE_DEBUG_PLAYBOOK.md     # Debugging playbook for Phase 4
```

**Deliverable Templates:**

### AUDIT_REPORT.md Template
```markdown
# Codebase Audit Report

**Date:** YYYY-MM-DD
**Phase:** 1
**Auditor:** [Name]

## Summary
- Total warnings: X
- Unused functions: X
- Unused structs: X
- Unused enums: X
- Dead modules: X
- Unregistered Tauri commands: X

## Findings by Category

### Safe to Delete
| Item | Type | Location | Reason | Usage Count |
|------|------|----------|--------|-------------|
| ... | ... | ... | ... | 0 |

### Possibly Legacy
| Item | Type | Location | Reason | Notes |
|------|------|----------|--------|-------|
| ... | ... | ... | ... | ... |

### Incomplete Feature
| Item | Type | Location | Recommendation |
|------|------|----------|----------------|
| ... | ... | ... | Integrate or Remove |

## Recommendations
1. ...
2. ...
```

### DELETIONS.md Template
```markdown
# Code Deletion Record

## Phase 2 Deletions

### [Date] - Unused Functions
**File:** src-tauri/src/example.rs
**Function:** `unused_helper()`
**Lines:** 45-60
**Reason:** No references found in codebase
**Evidence:**
```bash
$ rg "unused_helper" src-tauri
# No results
```
**Safety Check:** ✓ Passed
**Reviewer:** [Name]

---

### [Date] - Dead Module
**Module:** src-tauri/src/old_module.rs
**Reason:** Module not imported anywhere
**Evidence:**
```bash
$ rg "mod old_module" src-tauri
# No results
```
**Safety Check:** ✓ Passed
**Reviewer:** [Name]
```

### DECISIONS.md Template
```markdown
# Stabilization Decisions

## Logging System Decision
**Date:** YYYY-MM-DD
**Decision:** [Integrate / Remove]
**Rationale:** ...
**Implementation:** See LOGGING_DECISION.md

## Migration System Decision
**Date:** YYYY-MM-DD
**Decision:** [Keep / Simplify / Remove]
**Rationale:** ...
**Implementation:** ...

## Security Logging Decision
**Date:** YYYY-MM-DD
**Decision:** [Integrate / Remove]
**Rationale:** ...

## Rollback Checkpoints
### Phase 2
- Tag: `v-stabilize-phase2-complete`
- Commit: `abc123`
- DB Backup: `backups/20260218_120000-db.sqlite`
- Rollback: `git reset --hard v-stabilize-phase2-complete && cp backups/20260218_120000-db.sqlite ~/.kiyya/app.db`
```

## Final Pre-Implementation Checklist

Before marking design as complete and moving to implementation, verify:

- [ ] CI workflow created (`.github/workflows/stabilization.yml`)
- [ ] Sample claim saved (`tests/fixtures/claim_working.json`)
- [ ] Tauri IPC smoke test infrastructure added
- [ ] DB backup script present (`scripts/db_snapshot.sh`)
- [ ] PR template created (`.github/PULL_REQUEST_TEMPLATE.md`)
- [ ] No force-push policy documented (`PROTECTED_BRANCHES.md`)
- [ ] Audit script present (`scripts/generate_audit_report.sh`)
- [ ] IPC smoke test script present (`scripts/ipc_smoke_test.sh`)
- [ ] LOGGING_DECISION.md stub created
- [ ] DELETIONS.md template present
- [ ] DECISIONS.md template present
- [ ] Makefile with shortcuts created
- [ ] CONTRIBUTING.md created
- [ ] rustfmt.toml configured
- [ ] Pre-commit hooks configured
- [ ] Deliverables directory structure created (`stabilization/`)
- [ ] ODYSEE_DEBUG_PLAYBOOK.md created
- [ ] Test Tauri commands added (`test_connection`, `build_cdn_playback_url_test`)

## Critical Warnings and Gotchas

**DO NOT:**
1. Clean up Tauri commands without verifying no dynamic references exist
2. Add `#![deny(warnings)]` before Phase 5 completion
3. Apply broad automated deletions without tests
4. Conflate "no warnings" with "no logic bugs"
5. Force push after creating tags
6. Skip DB backups before migrations
7. Remove security validation code
8. Skip manual testing of Tauri commands

**DO:**
1. Run tests after every cleanup action
2. Use version control to track all changes
3. Create tags for rollback checkpoints
4. Document all decisions in `DECISIONS.md`
5. Record all deletions in `DELETIONS.md` with evidence
6. Verify grep results before deletion
7. Test with existing user data
8. Run security audit before each phase completion

## Implementation Notes

### Phase 0: Infrastructure Setup (MUST COMPLETE FIRST)

**Critical:** All infrastructure must be in place before Phase 1 begins.

**Steps:**
1. Create all scripts in `scripts/` directory
2. Create CI workflow in `.github/workflows/`
3. Create PR template in `.github/`
4. Create deliverables directory structure
5. Add test Tauri commands to backend
6. Create Makefile
7. Configure formatting tools
8. Set up pre-commit hooks
9. Create CONTRIBUTING.md
10. Create template files for deliverables

**Verification:**
- Run `make test` successfully
- Run `make audit` successfully
- Run `scripts/ipc_smoke_test.sh` successfully
- Verify CI workflow syntax
- Verify all templates are present

### Phase 1: Audit Implementation

**Steps:**
1. Run `scripts/generate_audit_report.sh`
2. Review `audit_report.json`
3. Manually categorize findings
4. Run IPC smoke test (MANDATORY)
5. Generate `AUDIT_REPORT.md`
6. Review with team
7. Create tag: `v-stabilize-phase1-complete`

**Tools:**
- `cargo build` for warnings
- `cargo clippy` for additional warnings
- `rg` (ripgrep) for usage search
- Manual review for categorization

### Phase 2: Cleanup Implementation

**Steps:**
1. Create DB backup: `make snapshot`
2. Start with "Safe to delete" category
3. Remove unused imports first (lowest risk)
4. Remove unused functions and structs
5. Resolve system status (logging, migrations, security)
6. Run tests after each change: `make test`
7. Document deletions in `DELETIONS.md`
8. Document decisions in `DECISIONS.md`
9. Create tag: `v-stabilize-phase2-complete`

**Safety:**
- Always backup DB before changes
- Run tests after each deletion
- Document evidence in `DELETIONS.md`
- Create rollback checkpoints

### Phase 3: Re-Stabilization Implementation

**Steps:**
1. Verify all Tauri commands registered
2. Test each command manually
3. Run security audit: `cargo audit`
4. Measure test coverage: `make coverage`
5. Verify >= 60% coverage
6. Enable `#![deny(warnings)]` (Phase 5 only)
7. Fix remaining warnings
8. Update ARCHITECTURE.md
9. Create flow diagrams
10. Create tag: `v-stabilize-phase3-complete`

**Verification:**
- Zero warnings: `cargo build`
- Zero clippy warnings: `cargo clippy`
- All tests pass: `cargo test`
- Coverage >= 60%
- Security audit passes

### Phase 4: Odysee Debug Preparation

**Steps:**
1. Select known working claim
2. Save to `tests/fixtures/claim_working.json`
3. Create `ODYSEE_DEBUG_PLAYBOOK.md`
4. Test with reproducible claim
5. Add tracing to content pipeline
6. Document expected vs actual behavior
7. Create tag: `v-stabilize-phase4-complete`

**Deliverables:**
- Working claim fixture
- Debug playbook
- Tracing infrastructure
- Foundation for precise debugging

### Rollback Plan

If any phase causes issues:

1. **Identify Rollback Point:**
   - Find last stable tag
   - Example: `v-stabilize-phase1-complete`

2. **Rollback Code:**
   ```bash
   git reset --hard v-stabilize-phase1-complete
   ```

3. **Restore Database:**
   ```bash
   cp backups/<timestamp>-db.sqlite ~/.kiyya/app.db
   ```

4. **Verify Restoration:**
   ```bash
   npm run tauri:dev
   # Test application functionality
   ```

5. **Document Failure:**
   - Add entry to `DECISIONS.md`
   - Explain what went wrong
   - Document why rollback was necessary
   - Plan alternative approach

### Performance Considerations

**Expected Improvements:**
- Faster compilation (less code to compile)
- Smaller binary size (less dead code)
- Easier debugging (cleaner codebase)
- Faster CI runs (fewer warnings to process)

**No Performance Degradation:**
Removing unused code should not degrade runtime performance. If performance degrades:
1. Profile the application
2. Identify the regression
3. Review recent changes
4. Rollback if necessary

### Security Considerations

**Security Review Checklist:**
- [ ] SQL injection prevention intact
- [ ] Path security validation intact
- [ ] Input validation intact
- [ ] Authentication mechanisms unchanged
- [ ] Encryption unchanged
- [ ] Secrets not logged
- [ ] API keys not exposed
- [ ] Dependency audit passes

**If Security Logging Removed:**
- Document why removal is acceptable
- Ensure critical security events still logged
- Maintain audit trail for compliance

### Compatibility Considerations

**Backward Compatible:**
- Existing database files work without modification
- User data is preserved
- All existing features continue to work
- Settings and preferences maintained

**Forward Compatible:**
- Clean foundation for future development
- Easier to add new features
- Clearer architecture for new developers
- Better documentation for onboarding

## Deliverables

### 1. Dead Code Removal List

Comprehensive list in `stabilization/DELETIONS.md`:
- File path and line number
- Item type (function, struct, enum, etc.)
- Item name
- Reason for removal
- Grep evidence (zero hits)
- Safety check status
- Reviewer name

### 2. Removed Modules List

Section in `stabilization/DELETIONS.md`:
- Module name
- File path
- Reason for removal
- Dependencies that were also removed
- Impact analysis

### 3. Integrated Modules List

Section in `stabilization/DECISIONS.md`:
- Module name
- Integration approach
- Tests added
- Verification steps
- Coverage achieved

### 4. Clean Build Proof

Files in `stabilization/`:
- `clean_build_proof.txt` - `cargo build` output
- `clean_clippy_proof.txt` - `cargo clippy` output
- `clean_test_proof.txt` - `cargo test` output
- `coverage_report.html` - Coverage report

### 5. Updated Architecture Documentation

File: `stabilization/ARCHITECTURE.md`

Contents:
- Actual module structure
- Backend flow diagram
- Frontend → backend invocation diagram
- Logging architecture (if retained)
- Migration state and flow
- Playback model
- Backend command list
- Content fetch pipeline (actual, not theoretical)

### 6. Current Architecture Explanation

File: `stabilization/DECISIONS.md`

Contents:
- What systems exist and are functional
- What systems were removed and why
- What systems were integrated and how
- Current state of logging
- Current state of migrations
- Current state of security logging
- Current state of Tauri commands
- Current state of playback pipeline

### 7. Foundation for Odysee Issue Debugging

File: `stabilization/ODYSEE_DEBUG_PLAYBOOK.md`

Contents:
- Clean codebase status confirmation
- Next steps for investigation
- Tracing points to add
- Expected behavior vs actual behavior
- Isolated failure layer hypothesis
- Reproducible test case
- Debug command examples

## Acceptance Criteria for Design Completion

This design is considered complete and ready for implementation when:

1. ✓ All infrastructure components defined
2. ✓ CI/CD pipeline specified
3. ✓ IPC smoke test requirements clear
4. ✓ DB migration safety mechanisms defined
5. ✓ PR template and branch protection rules specified
6. ✓ Automated audit scripts defined
7. ✓ Reproducible claim example requirement specified
8. ✓ Logging decision framework defined
9. ✓ Test coverage quotas specified
10. ✓ Safety commands defined
11. ✓ Developer tooling specified
12. ✓ Edge cases and security checks defined
13. ✓ Deliverables structure defined
14. ✓ Rollback procedures defined
15. ✓ Phase gates and checkpoints defined

**Status:** ✓ Design Complete - Ready for Implementation

**Next Steps:**
1. Review design with team
2. Create Phase 0 infrastructure PR
3. Begin Phase 1 audit after infrastructure is in place
4. Follow phase discipline strictly
5. Create tags at each checkpoint
6. Document all decisions and deletions

