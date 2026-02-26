# Steps to Reproduce - Kiyya Desktop Testing

This document provides step-by-step instructions for reproducing tests and debugging issues in Kiyya Desktop.

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Reproducible Claim Testing](#reproducible-claim-testing)
3. [Backend Testing](#backend-testing)
4. [Frontend Testing](#frontend-testing)
5. [Integration Testing](#integration-testing)
6. [Manual Testing](#manual-testing)

---

## Environment Setup

### Required Tools

- Node.js 18+ (for frontend)
- Rust 1.70+ (for backend)
- Cargo (Rust package manager)
- npm or yarn (Node package manager)

### Environment Variables

The following environment variables can be used to customize testing:

#### TEST_CLAIM_ID

Override the default test claim ID for reproducible testing.

**Usage:**
```bash
# Windows PowerShell
$env:TEST_CLAIM_ID="your-real-claim-id-here"

# Windows CMD
set TEST_CLAIM_ID=your-real-claim-id-here

# macOS/Linux
export TEST_CLAIM_ID=your-real-claim-id-here
```

**Example:**
```bash
# Test with a specific Odysee claim
export TEST_CLAIM_ID=abc123realclaimid
npm test
```

#### LOG_LEVEL

Control logging verbosity during testing.

**Values:** `DEBUG`, `INFO`, `WARN`, `ERROR`

**Usage:**
```bash
# Windows PowerShell
$env:LOG_LEVEL="DEBUG"

# macOS/Linux
export LOG_LEVEL=DEBUG
```

#### DB_PATH

Override the default database path for testing.

**Default Paths:**
- Windows: `%APPDATA%\.kiyya\app.db`
- macOS: `~/Library/Application Support/kiyya/app.db`
- Linux: `~/.kiyya/app.db`

**Usage:**
```bash
# Use a test database
export DB_PATH=/tmp/test-kiyya.db
```

---

## Reproducible Claim Testing

### Phase 4 Gate: Reproducible Claim Test

This test verifies that the test claim fixture is properly configured and can be used for CDN URL construction.

**Prerequisites:**
- Test claim exists at `tests/fixtures/claim_working.json`
- Backend is built: `cd src-tauri && cargo build`

**Run the Test:**

```bash
# Run the reproducible claim test script
node scripts/test_reproducible_claim.js
```

**Expected Output:**
```
✅ Phase 4 Gate: Reproducible Claim Test PASSED

All checks completed successfully:
  ✓ Test claim fixture exists
  ✓ Claim structure is valid
  ✓ Claim is sanitized
  ✓ URL construction format verified
  ✓ Documentation present
```

**Using a Custom Claim:**

```bash
# Test with a real Odysee claim (not committed to repo)
export TEST_CLAIM_ID=abc123realclaimid
node scripts/test_reproducible_claim.js
```

### Backend Command Test

Test the `build_cdn_playback_url_test` command directly:

```bash
# Run backend tests
cd src-tauri
cargo test build_cdn_playback_url_test

# Expected output:
# test commands::tests::test_build_cdn_playback_url_test_command ... ok
# test commands::tests::test_build_cdn_playback_url_test_with_various_claim_ids ... ok
```

---

## Backend Testing

### Full Test Suite

Run all backend tests:

```bash
cd src-tauri
cargo test
```

### Specific Test Module

Run tests for a specific module:

```bash
# Test commands module
cargo test commands::

# Test database module
cargo test database::

# Test migrations
cargo test migrations::
```

### Property-Based Tests

Run property-based tests (minimum 100 cases each):

```bash
# Run all property tests
cargo test property_test

# Run specific property test
cargo test valid_claim_id_property_test
```

### Coverage Measurement

Measure test coverage:

```bash
# Install tarpaulin (first time only)
cargo install cargo-tarpaulin

# Run coverage
cargo tarpaulin --out Html --out Xml

# View report
# Open tarpaulin-report.html in browser
```

---

## Frontend Testing

### Lint Check

```bash
npm run lint
```

### Build Frontend

```bash
npm run build
```

### Type Check

```bash
npm run type-check
```

---

## Integration Testing

### IPC Smoke Test

Verify Tauri IPC connectivity:

```bash
# Run IPC smoke test
node scripts/ipc_smoke_test.js

# Expected output:
# ✅ IPC Smoke Test PASSED
# ✓ Backend started successfully
# ✓ test_connection command returned: tauri-backend-alive
```

### Full Integration Test

Test the complete pipeline:

```bash
# Start development environment
npm run tauri:dev

# In DevTools Console, run:
window.__TAURI__.invoke('test_connection')
  .then(res => console.log('✓ IPC OK:', res))
  .catch(err => console.error('✗ IPC FAIL:', err));
```

---

## Manual Testing

### Start Development Environment

```bash
# Terminal 1: Start Tauri dev server
npm run tauri:dev
```

### Test Core Features

1. **Playback Testing**
   - Open app window
   - Navigate to a channel (e.g., @kiyyamovies)
   - Select a video
   - Verify playback starts

2. **Favorites Testing**
   - Add a video to favorites
   - Navigate to favorites page
   - Verify video appears in favorites
   - Remove from favorites
   - Verify video is removed

3. **Playlists Testing**
   - Create a new playlist
   - Add videos to playlist
   - Navigate to playlist
   - Verify videos appear
   - Play video from playlist

### Test with Reproducible Claim

```bash
# In DevTools Console:

// Load test claim
fetch('/tests/fixtures/claim_working.json')
  .then(r => r.json())
  .then(claim => {
    console.log('Test claim:', claim);
    return window.__TAURI__.invoke('build_cdn_playback_url_test', { 
      claim_id: claim.claim_id 
    });
  })
  .then(url => console.log('CDN URL:', url))
  .catch(err => console.error('Error:', err));
```

### Test with Real Claim

```bash
# In DevTools Console:

// Test with real Odysee claim
window.__TAURI__.invoke('fetch_channel_claims', { 
  channelId: '@kiyyamovies:b' 
})
  .then(claims => {
    console.log('Claims:', claims);
    if (claims.length > 0) {
      const firstClaim = claims[0];
      return window.__TAURI__.invoke('build_cdn_playback_url_test', { 
        claim_id: firstClaim.claim_id 
      });
    }
  })
  .then(url => console.log('CDN URL:', url))
  .catch(err => console.error('Error:', err));
```

---

## Debugging

### Capture Backend Logs

```bash
# Windows PowerShell
npm run tauri:dev 2>&1 | Tee-Object -FilePath debug_output.txt

# macOS/Linux
npm run tauri:dev 2>&1 | tee debug_output.txt
```

### Check for Errors

```bash
# Search for errors in logs
grep -i "error\|fail\|panic" debug_output.txt
```

### Enable Debug Logging

```bash
# Set log level to DEBUG
export LOG_LEVEL=DEBUG
npm run tauri:dev
```

### Inspect Database

```bash
# Open database with sqlite3
sqlite3 ~/.kiyya/app.db

# List tables
.tables

# Query favorites
SELECT * FROM favorites;

# Query playlists
SELECT * FROM playlists;
```

---

## CI/CD Testing

### Run CI Checks Locally

```bash
# Install dependencies
npm ci

# Lint
npm run lint

# Build frontend
npm run build

# Build backend
cd src-tauri && cargo build

# Run tests
cargo test

# Run clippy
cargo clippy

# Run security audit
cargo audit

# Run IPC smoke test
node scripts/ipc_smoke_test.js

# Run reproducible claim test
node scripts/test_reproducible_claim.js
```

---

## Troubleshooting

### Backend Won't Start

1. Check if port is already in use
2. Verify database path is accessible
3. Check for migration errors in logs
4. Try with a fresh database: `rm ~/.kiyya/app.db`

### IPC Smoke Test Fails

1. Verify backend builds successfully: `cd src-tauri && cargo build`
2. Check if `test_connection` command is registered in `main.rs`
3. Verify no firewall blocking localhost connections
4. Try increasing timeout in `scripts/ipc_smoke_test.js`

### Tests Fail

1. Ensure all dependencies are installed: `npm ci && cd src-tauri && cargo build`
2. Check for database lock issues: close all app instances
3. Verify test fixtures exist: `ls tests/fixtures/`
4. Run tests with verbose output: `cargo test -- --nocapture`

### Reproducible Claim Test Fails

1. Verify fixture exists: `cat tests/fixtures/claim_working.json`
2. Check fixture is valid JSON: `node -e "JSON.parse(require('fs').readFileSync('tests/fixtures/claim_working.json'))"`
3. Verify README exists: `cat tests/fixtures/README.md`
4. Check backend command is registered: `grep build_cdn_playback_url_test src-tauri/src/main.rs`

---

## Privacy & Security

### Testing with Real Data

⚠️ **IMPORTANT:** When testing with real Odysee claims:

1. **Never commit real claim data** to version control
2. **Use environment variables** for real claim IDs
3. **Document in PR** that you tested with real claims (but don't include the data)
4. **Sanitize logs** before sharing (remove claim IDs, channel names, etc.)

### Database Backups

Before running tests that modify the database:

```bash
# Create backup
node scripts/db_snapshot.sh

# Or on Windows
powershell scripts/db_snapshot.ps1

# Backups are stored in: backups/<timestamp>-db.sqlite
```

### Restore Database

```bash
# Find latest backup
ls -lt backups/ | head -1

# Restore backup
cp backups/<timestamp>-db.sqlite ~/.kiyya/app.db
```

---

## Next Steps

After completing reproducible testing:

1. Review [ODYSEE_DEBUG_PLAYBOOK.md](./ODYSEE_DEBUG_PLAYBOOK.md) for Odysee-specific debugging
2. Check [DECISIONS.md](./DECISIONS.md) for architectural decisions
3. Review [ARCHITECTURE.md](./ARCHITECTURE.md) for system architecture
4. See [CI_WORKFLOW.md](./CI_WORKFLOW.md) for CI/CD pipeline details

---

## Contact

For questions or issues with testing:

- Create an issue in the repository
- Tag stabilization owners in PR comments
- Check [stabilization/README.md](./README.md) for contributor checklist
