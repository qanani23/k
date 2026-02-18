# CI/CD Workflow Documentation

## Overview

The stabilization CI/CD workflow (`.github/workflows/stabilization.yml`) enforces quality gates across five phases of the codebase stabilization process. Each phase has specific checks that must pass before proceeding to the next phase.

## Workflow Triggers

The workflow runs on:
- **Pull Requests** to `main` or `feature/stabilize/**` branches
- **Push events** to `main` or `feature/stabilize/**` branches

## Phase Gates

### Phase 1: IPC Smoke Test (`phase1-ipc-smoke`)

**Purpose:** Verify that Tauri IPC connectivity works across all platforms.

**Runs on:** Ubuntu, Windows, macOS (matrix strategy)

**Steps:**
1. Checkout code
2. Setup Node.js 18 with npm cache
3. Setup Rust stable toolchain with cache
4. Install system dependencies (Ubuntu only)
5. Install npm dependencies (`npm ci`)
6. Build backend (`cargo build`)
7. Run IPC smoke test (`node scripts/ipc_smoke_test.js`)
8. Upload IPC smoke test output as artifact

**Success Criteria:**
- IPC smoke test passes on all platforms
- Backend builds successfully
- Test completes within 5 minutes

**Artifacts:**
- `ipc-smoke-output-{os}` - IPC smoke test output for each platform

**Gate:** Must pass before Phase 2 can run.

---

### Phase 2: Cleanup and Build (`phase2-cleanup`)

**Purpose:** Verify clean build, linting, and basic compilation.

**Runs on:** Ubuntu only

**Dependencies:** Requires `phase1-ipc-smoke` to pass

**Steps:**
1. Checkout code
2. Setup Node.js and Rust with caching
3. Install system dependencies
4. Install npm dependencies (`npm ci`)
5. Lint frontend (`npm run lint`)
6. Type check (`npm run type-check`)
7. Build frontend (`npm run build`)
8. Build backend with warning capture
9. Run backend tests (`cargo test`)
10. Run clippy with phase-specific warning handling:
    - **Pre-Phase 5:** Allow warnings (`-A warnings`)
    - **Phase 5+:** Deny warnings (`-D warnings`)
11. Generate audit report
12. Upload audit artifacts

**Success Criteria:**
- Frontend lints without errors
- TypeScript type checking passes
- Frontend builds successfully
- Backend builds successfully
- Backend tests pass
- Clippy passes (warnings allowed pre-Phase 5)

**Artifacts:**
- `audit-reports` containing:
  - `audit_warnings.txt` - Compiler warnings
  - `audit_clippy.txt` - Clippy output
  - `audit_report.json` - Structured audit report

**Phase-Specific Behavior:**
- **Phases 1-4:** Clippy warnings are allowed (`-A warnings`)
- **Phase 5:** Clippy warnings cause failure (`-D warnings`)

**Gate:** Must pass before Phase 3 can run.

---

### Phase 3: Coverage and Security (`phase3-coverage`)

**Purpose:** Verify test coverage and security audit.

**Runs on:** Ubuntu only

**Dependencies:** Requires `phase2-cleanup` to pass

**Steps:**
1. Checkout code
2. Setup Node.js and Rust with caching
3. Install system dependencies
4. Install npm dependencies
5. Install cargo-tarpaulin
6. Run coverage measurement (`cargo tarpaulin`)
7. Upload coverage report
8. Run security audit (`cargo audit`)
9. Run frontend tests (`npm run test`)

**Success Criteria:**
- Coverage measurement completes
- Security audit passes (or documented exceptions)
- Frontend tests pass

**Artifacts:**
- `coverage-report` containing:
  - `cobertura.xml` - Coverage data in Cobertura format
  - `tarpaulin-report.html` - HTML coverage report

**Note:** Coverage and security audit steps use `continue-on-error: true` to allow workflow to complete even if these steps fail. Review artifacts to assess coverage and security status.

**Gate:** Must pass before Phase 4 can run.

---

### Phase 4: Reproducible Claim Test (`phase4-reproducible-claim`)

**Purpose:** Verify reproducible test case infrastructure is in place.

**Runs on:** Ubuntu only

**Dependencies:** Requires `phase3-coverage` to pass

**Steps:**
1. Checkout code
2. Setup Node.js and Rust with caching
3. Install system dependencies
4. Install npm dependencies
5. Build backend
6. Check test fixtures exist (`tests/fixtures/claim_working.json`)
7. Run reproducible claim test (when implemented)

**Success Criteria:**
- Backend builds successfully
- Test fixtures are present (Phase 4+)
- Reproducible claim test passes (when implemented)

**Note:** This phase is preparatory. The actual reproducible claim test will be implemented during Phase 4 execution.

**Gate:** Must pass before Phase 5 can run.

---

### Phase 5: Zero Warnings Enforcement (`phase5-zero-warnings`)

**Purpose:** Enforce strict zero-warning compilation.

**Runs on:** Ubuntu only

**Dependencies:** Requires `phase4-reproducible-claim` to pass

**Conditional:** Only runs if branch name contains `phase5`

**Steps:**
1. Checkout code
2. Setup Node.js and Rust with caching
3. Install system dependencies
4. Install npm dependencies
5. Build with zero warnings enforcement
6. Run clippy with `-D warnings` (deny warnings)
7. Verify zero warnings

**Success Criteria:**
- Build produces zero warnings
- Clippy produces zero warnings
- No grep matches for "warning" in build output

**Note:** This is the final enforcement phase. All warnings must be resolved before this phase can pass.

---

## Platform-Specific Expectations

### Ubuntu (Linux)

**System Dependencies Required:**
- `libgtk-3-dev` - GTK+ 3 development files
- `libwebkit2gtk-4.0-dev` - WebKit2GTK development files
- `libappindicator3-dev` - AppIndicator development files
- `librsvg2-dev` - SVG rendering library
- `patchelf` - ELF binary patcher

**Installation:**
```bash
sudo apt-get update
sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev patchelf
```

**Notes:**
- Primary platform for most CI checks
- All phases run on Ubuntu
- Coverage measurement only runs on Ubuntu

### Windows

**System Dependencies:**
- None required (Windows SDK provides necessary libraries)

**Notes:**
- Only Phase 1 (IPC smoke test) runs on Windows
- Uses PowerShell for script execution
- Node.js scripts are cross-platform compatible

### macOS

**System Dependencies:**
- None required (Xcode Command Line Tools provide necessary libraries)

**Notes:**
- Only Phase 1 (IPC smoke test) runs on macOS
- Uses Bash/Zsh for script execution
- Node.js scripts are cross-platform compatible

---

## Caching Strategy

### Node.js Cache
- **Type:** npm cache
- **Key:** Based on `package-lock.json`
- **Benefit:** Speeds up `npm ci` by caching downloaded packages

### Rust Cache
- **Tool:** `swatinem/rust-cache@v2`
- **Workspace:** `./src-tauri -> target`
- **Benefit:** Caches compiled dependencies and build artifacts
- **Invalidation:** Automatic based on `Cargo.lock` and source changes

---

## Artifact Upload

All artifacts are uploaded with `if: always()` to ensure they're available even if steps fail.

### IPC Smoke Test Output
- **Name:** `ipc-smoke-output-{os}`
- **Path:** `stabilization/ipc_smoke_output.txt`
- **Uploaded by:** Phase 1 (per platform)
- **Purpose:** Debug IPC connectivity issues

### Audit Reports
- **Name:** `audit-reports`
- **Paths:**
  - `stabilization/audit_warnings.txt`
  - `stabilization/audit_clippy.txt`
  - `stabilization/audit_report.json`
- **Uploaded by:** Phase 2
- **Purpose:** Review compiler warnings and clippy suggestions

### Coverage Report
- **Name:** `coverage-report`
- **Paths:**
  - `stabilization/cobertura.xml`
  - `stabilization/tarpaulin-report.html`
- **Uploaded by:** Phase 3
- **Purpose:** Assess test coverage

---

## Phase-Specific Conditionals

### Clippy Warning Handling

The workflow uses branch name detection to determine clippy behavior:

**Pre-Phase 5 (Phases 1-4):**
```yaml
if: "!contains(github.ref, 'phase5')"
run: cargo clippy -- -A warnings
```
- Warnings are allowed
- Clippy output is captured but doesn't fail the build

**Phase 5:**
```yaml
if: contains(github.ref, 'phase5')
run: cargo clippy -- -D warnings
```
- Warnings cause build failure
- Zero warnings enforced

### Phase 5 Job Execution

The entire Phase 5 job only runs when the branch contains `phase5`:

```yaml
if: contains(github.ref, 'phase5')
```

This ensures strict enforcement is only applied when explicitly working on Phase 5.

---

## Timeout Configuration

### IPC Smoke Test
- **Timeout:** 5 minutes
- **Reason:** Prevents hanging if IPC connection fails
- **Action on timeout:** Job fails, artifact still uploaded

---

## Error Handling

### Continue on Error

Some steps use `continue-on-error: true`:
- **Coverage measurement:** Allows workflow to complete even if coverage tool fails
- **Security audit:** Allows workflow to complete even if vulnerabilities found
- **Audit report generation:** Allows workflow to complete even if script fails

**Rationale:** These are informational steps. Failures should be reviewed but shouldn't block the entire workflow.

### Always Upload Artifacts

All artifact uploads use `if: always()` to ensure artifacts are available for debugging even when steps fail.

---

## Local Testing

To test the workflow locally before pushing:

### Validate Workflow Syntax
```bash
# Using GitHub CLI
gh workflow view stabilization.yml

# Or use act (local GitHub Actions runner)
act -l
```

### Run Individual Phase Checks Locally

**Phase 1: IPC Smoke Test**
```bash
npm ci
cd src-tauri && cargo build
node scripts/ipc_smoke_test.js
```

**Phase 2: Cleanup and Build**
```bash
npm ci
npm run lint
npm run type-check
npm run build
cd src-tauri && cargo build
cd src-tauri && cargo test
cd src-tauri && cargo clippy -- -A warnings
```

**Phase 3: Coverage and Security**
```bash
cargo install cargo-tarpaulin
cd src-tauri && cargo tarpaulin --out Html
cd src-tauri && cargo audit
npm run test
```

**Phase 5: Zero Warnings**
```bash
cd src-tauri && cargo build 2>&1 | tee build_output.txt
grep -i "warning" build_output.txt && echo "Warnings found!" || echo "No warnings!"
cd src-tauri && cargo clippy -- -D warnings
```

---

## Troubleshooting

### IPC Smoke Test Fails

**Symptoms:**
- Test times out
- Connection refused errors
- Backend doesn't start

**Solutions:**
1. Check `ipc-smoke-output-{os}` artifact for error messages
2. Verify backend builds successfully
3. Check for port conflicts
4. Review IPC smoke test script (`scripts/ipc_smoke_test.js`)

### Clippy Warnings in Phase 5

**Symptoms:**
- Phase 5 job fails with clippy warnings
- Warnings were allowed in earlier phases

**Solutions:**
1. Review `audit_clippy.txt` artifact from Phase 2
2. Fix all warnings before merging to Phase 5 branch
3. Run `cargo clippy -- -D warnings` locally to identify issues

### Coverage Measurement Fails

**Symptoms:**
- `cargo tarpaulin` step fails
- Coverage report not generated

**Solutions:**
1. Check if cargo-tarpaulin installation succeeded
2. Review error messages in job logs
3. Run `cargo tarpaulin` locally to reproduce issue
4. Consider using alternative coverage tool (grcov)

### Security Audit Fails

**Symptoms:**
- `cargo audit` reports vulnerabilities
- Job continues but audit fails

**Solutions:**
1. Review vulnerability report in job logs
2. Update vulnerable dependencies
3. Document exceptions in `stabilization/DECISIONS.md`
4. Pin dependencies to safe versions

---

## Workflow Maintenance

### Updating Node.js Version

To update Node.js version across all jobs:

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'  # Update version here
    cache: 'npm'
```

### Updating Rust Toolchain

To update Rust toolchain:

```yaml
- name: Setup Rust
  uses: dtolnay/rust-toolchain@stable
  with:
    toolchain: stable  # Or specify version: '1.75.0'
```

### Adding New Platforms

To add a new platform to Phase 1:

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest, macos-13]  # Add here
```

---

## Integration with PR Template

The workflow status checks are referenced in the PR template (`.github/PULL_REQUEST_TEMPLATE.md`):

- `stabilization/phase1-ipc-smoke` - Phase 1 gate
- `stabilization/phase2-cleanup` - Phase 2 gate
- `stabilization/phase3-coverage` - Phase 3 gate
- `stabilization/phase4-reproducible-claim` - Phase 4 gate
- `stabilization/phase5-zero-warnings` - Phase 5 gate

These status checks must pass before PRs can be merged.

---

## Future Enhancements

### Potential Improvements

1. **Parallel Execution:** Run independent phases in parallel where possible
2. **Matrix Strategy for All Phases:** Extend cross-platform testing beyond Phase 1
3. **Coverage Thresholds:** Add automatic coverage threshold enforcement
4. **Notification Integration:** Add Slack/Discord notifications for failures
5. **Deployment:** Add deployment steps after Phase 5 passes
6. **Performance Benchmarking:** Add performance regression testing
7. **Docker Support:** Add containerized testing for reproducibility

---

## References

- **Workflow File:** `.github/workflows/stabilization.yml`
- **IPC Smoke Test:** `scripts/ipc_smoke_test.js`
- **Audit Script:** `scripts/generate_audit_report.sh`
- **PR Template:** `.github/PULL_REQUEST_TEMPLATE.md`
- **Requirements:** `.kiro/specs/codebase-stabilization-audit/requirements.md`
- **Design:** `.kiro/specs/codebase-stabilization-audit/design.md`

---

## Contact

For questions or issues with the CI/CD workflow:
- Review this documentation
- Check workflow run logs in GitHub Actions
- Review artifacts for detailed error information
- Consult `stabilization/DECISIONS.md` for documented exceptions
