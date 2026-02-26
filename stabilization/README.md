# Day-1 Contributor Checklist

**Project:** Kiyya Desktop Codebase Stabilization  
**Last Updated:** 2026-02-22  
**Status:** Phase 4 Complete

## Welcome!

This guide provides everything you need to start contributing to the Kiyya Desktop stabilization effort. Whether you're joining for the first time or returning after a break, this checklist will get you up and running quickly.

## ⚠️ CRITICAL: Canary PR Rules

**If you are working on Phase 2 deletion tasks (7.1 - 7.6), you MUST read this first:**

📖 **[CANARY_PR_CRITICAL_RULES.md](CANARY_PR_CRITICAL_RULES.md)** - MANDATORY READING

**The Golden Rule:** NEVER MERGE A CANARY PR

Canary PRs are verification-only pull requests. They exist to test proposed deletions before actual implementation. Merging a canary PR would apply unverified deletions to the main codebase.

**Quick Reference:**
- ✅ Create canary PR for verification
- ✅ Wait 48 hours for CI and review
- ✅ Close canary PR (do not merge)
- ✅ Create separate PR for actual deletions
- ❌ NEVER merge a canary PR

See [CANARY_PR_CRITICAL_RULES.md](CANARY_PR_CRITICAL_RULES.md) for complete documentation.

## Quick Start (5 Minutes)

```bash
# 1. Clone and setup
git clone <repository-url>
cd kiyya-desktop
npm install

# 2. Build backend
cd src-tauri && cargo build && cd ..

# 3. Run quick checks
make test

# 4. Start development
npm run tauri:dev
```

If all commands succeed, you're ready to contribute! 🚀

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Required Environment Variables](#required-environment-variables)
- [Running Each Phase Locally](#running-each-phase-locally)
- [Emergency Revert Process](#emergency-revert-process)
- [Platform-Specific Notes](#platform-specific-notes)
- [Troubleshooting Common Issues](#troubleshooting-common-issues)
- [Stabilization Owners](#stabilization-owners)
- [Phase Timeline](#phase-timeline)
- [Daily Workflow](#daily-workflow)
- [Additional Resources](#additional-resources)

---

## Prerequisites

### Required Software

| Tool | Version | Installation |
|------|---------|--------------|
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org/) |
| **Rust** | Latest stable | [rustup.rs](https://rustup.rs/) |
| **Git** | 2.30+ | [git-scm.com](https://git-scm.com/) |

### Platform-Specific Requirements

**Windows:**
- PowerShell 5.1+ (included with Windows 10+)
- Visual Studio Build Tools (for Rust compilation)

**macOS:**
- Xcode Command Line Tools: `xcode-select --install`
- Homebrew (recommended): [brew.sh](https://brew.sh/)

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install -y \
  libgtk-3-dev \
  libwebkit2gtk-4.0-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf
```

### Optional Development Tools

```bash
# Coverage measurement
cargo install cargo-tarpaulin

# Security auditing
cargo install cargo-audit

# GitHub CLI (for workflow validation)
# See: https://cli.github.com/
```

---

## Initial Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd kiyya-desktop
```

### 2. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Rust dependencies install automatically on first build
cd src-tauri
cargo build
cd ..
```

### 3. Verify Installation

```bash
# Check Node.js version
node --version  # Should be 18+

# Check Rust version
rustc --version  # Should be 1.70+

# Check cargo
cargo --version

# Check npm
npm --version
```

### 4. Run Initial Tests

```bash
# Quick verification
make test

# Or manually:
cd src-tauri && cargo test && cd ..
npm run lint
```

### 5. Set Up Pre-Commit Hooks (Optional)

```bash
# If using Husky
npm run prepare

# Verify hooks installed
ls -la .husky/
```

---

## Required Environment Variables

### Optional Variables

Most development work doesn't require environment variables, but these can be useful:

```bash
# Override database path for testing
export DB_PATH="./test-data/app.db"

# Set log level (DEBUG, INFO, WARN, ERROR)
export LOG_LEVEL="DEBUG"

# Use test claim for reproducible testing (Phase 4+)
export TEST_CLAIM_ID="<claim-id-from-fixtures>"

# Rust logging (fine-grained control)
export RUST_LOG="kiyya_desktop=debug"
```

### Platform-Specific Setup

**Windows (PowerShell):**
```powershell
$env:DB_PATH = ".\test-data\app.db"
$env:LOG_LEVEL = "DEBUG"
```

**macOS/Linux (Bash/Zsh):**
```bash
export DB_PATH="./test-data/app.db"
export LOG_LEVEL="DEBUG"
```

### Persistent Configuration

Add to your shell profile for permanent setup:

**Windows:** Add to PowerShell profile (`$PROFILE`)  
**macOS/Linux:** Add to `~/.bashrc` or `~/.zshrc`

---

## Running Each Phase Locally

### Phase 0: Infrastructure Setup

**Goal:** Set up all scripts, CI, and tooling

**Commands:**
```bash
# Verify all scripts exist
ls scripts/

# Test database backup script
make snapshot
# Or: bash scripts/db_snapshot.sh (macOS/Linux)
# Or: powershell scripts/db_snapshot.ps1 (Windows)

# Test audit script
make audit
# Or: bash scripts/generate_audit_report.sh
# Or: powershell scripts/generate_audit_report.ps1

# Test IPC smoke test
make ipc-smoke
# Or: node scripts/ipc_smoke_test.js

# Validate CI workflow
make validate-workflow
# Or: node scripts/validate-workflow.js

# Verify Makefile works
make help
make build
make test
```

**Success Criteria:**
- [ ] All scripts execute without errors
- [ ] CI workflow syntax is valid
- [ ] Makefile targets work
- [ ] Pre-commit hooks installed (if using)

**Checkpoint:**
```bash
git tag -a v-stabilize-phase0-complete -m "Phase 0: Infrastructure setup complete"
```

---

### Phase 1: Full Codebase Audit

**Goal:** Identify all unused code and dead modules

**Commands:**
```bash
# Generate audit report
make audit

# Review audit outputs
cat stabilization/audit_warnings.txt
cat stabilization/audit_clippy.txt
cat stabilization/audit_report.json

# Run IPC smoke test (MANDATORY)
make ipc-smoke

# Review IPC output
cat stabilization/ipc_smoke_output.txt

# Manual IPC verification
npm run tauri:dev
# In DevTools Console:
# window.__TAURI__.invoke('test_connection')
```

**Success Criteria:**
- [ ] Audit report generated successfully
- [ ] IPC smoke test passes
- [ ] Manual IPC verification succeeds
- [ ] Findings categorized in AUDIT_REPORT.md

**Checkpoint:**
```bash
git tag -a v-stabilize-phase1-complete -m "Phase 1: Audit complete"
```

---

### Phase 2: Clean Build Enforcement

**Goal:** Remove dead code and achieve clean build

**Commands:**
```bash
# CRITICAL: Create database backup FIRST
make snapshot

# Verify backup exists
ls -l backups/

# Run cleanup (after creating canary PR)
# Follow deletion safety checklist in CONTRIBUTING.md

# Verify build after each deletion batch
make build-backend
cd src-tauri && cargo test

# Check for warnings
cd src-tauri && cargo build 2>&1 | tee build_output.txt
grep -i "warning" build_output.txt

# Run clippy (warnings allowed in Phase 2)
cd src-tauri && cargo clippy -- -A warnings
```

**Success Criteria:**
- [ ] Database backup created and verified
- [ ] Migration idempotency verified
- [ ] All deletions documented in DELETIONS.md
- [ ] Build succeeds with minimal warnings
- [ ] All tests pass

**Checkpoint:**
```bash
git tag -a v-stabilize-phase2-complete -m "Phase 2: Cleanup complete"
```

---

### Phase 3: Architecture Re-Stabilization

**Goal:** Verify tests pass and achieve >= 60% coverage on critical modules

**Commands:**
```bash
# Run full test suite
cd src-tauri && cargo test

# Measure coverage
make coverage
# Or: cd src-tauri && cargo tarpaulin --out Html --output-dir ../stabilization

# View coverage report
open stabilization/tarpaulin-report.html  # macOS
xdg-open stabilization/tarpaulin-report.html  # Linux
start stabilization/tarpaulin-report.html  # Windows

# Run security audit
make security-audit
# Or: cd src-tauri && cargo audit

# Verify Tauri commands work
npm run tauri:dev
# Test each command in DevTools Console

# Run frontend tests (if available)
npm test
```

**Success Criteria:**
- [ ] All tests pass (or 97%+ with documented exceptions)
- [ ] Coverage >= 60% on critical modules
- [ ] Security audit passes (or exceptions documented)
- [ ] All Tauri commands verified

**Critical Modules for Coverage:**
- Content fetching modules
- Parsing modules
- `extract_video_urls` module
- Player bridge modules
- Database migration modules

**Checkpoint:**
```bash
git tag -a v-stabilize-phase3-complete -m "Phase 3: Re-stabilization complete"
```

---

### Phase 4: Odysee Debug Preparation

**Goal:** Prepare reproducible test case and debug infrastructure

**Commands:**
```bash
# Verify test fixtures exist
ls tests/fixtures/claim_working.json

# Test with reproducible claim
node scripts/test_reproducible_claim.js

# Review debug playbook
cat stabilization/ODYSEE_DEBUG_PLAYBOOK.md

# Test playback URL construction
npm run tauri:dev
# In DevTools Console:
# window.__TAURI__.invoke('build_cdn_playback_url_test', { claim_id: 'abc123' })

# Verify tracing infrastructure
# Check logs for structured output
```

**Success Criteria:**
- [ ] Test fixtures exist and are valid
- [ ] Reproducible claim test passes
- [ ] Debug playbook is complete
- [ ] Tracing infrastructure in place

**Checkpoint:**
```bash
git tag -a v-stabilize-phase4-complete -m "Phase 4: Debug preparation complete"
```

---

### Phase 5: Final Zero-Warning Enforcement (Optional)

**Goal:** Achieve absolute zero warnings

**Commands:**
```bash
# Enable strict compilation
# Add to src-tauri/src/main.rs:
# #![deny(warnings)]

# Build with zero warnings
cd src-tauri && cargo build 2>&1 | tee build_output.txt

# Verify no warnings
grep -i "warning" build_output.txt && echo "Warnings found!" || echo "No warnings!"

# Run clippy with strict mode
cd src-tauri && cargo clippy -- -D warnings

# Update CI to enforce warnings
# Edit .github/workflows/stabilization.yml
# Remove continue-on-error from clippy step
```

**Success Criteria:**
- [ ] Zero compiler warnings
- [ ] Zero clippy warnings
- [ ] CI enforces warnings

**Checkpoint:**
```bash
git tag -a v-stabilize-phase5-complete -m "Phase 5: Zero warnings enforced"
```

---

## Emergency Revert Process

### 3-Command Fast Revert

For critical issues requiring immediate rollback:

```bash
# 1. Find and revert to last stable tag
git reset --hard $(git tag -l "v-stabilize-*" | tail -1)

# 2. Restore database backup
cp backups/$(ls -t backups/ | head -1) ~/.kiyya/app.db

# 3. Verify application works
npm run tauri:dev
```

### Platform-Specific Database Paths

**Windows:**
```powershell
# Default DB path
$dbPath = "$env:APPDATA\.kiyya\app.db"

# Restore backup
cp backups\$(Get-ChildItem backups | Sort-Object LastWriteTime -Descending | Select-Object -First 1).Name $dbPath
```

**macOS:**
```bash
# Default DB path
DB_PATH="$HOME/Library/Application Support/kiyya/app.db"

# Restore backup
cp backups/$(ls -t backups/ | head -1) "$DB_PATH"
```

**Linux:**
```bash
# Default DB path
DB_PATH="$HOME/.kiyya/app.db"

# Restore backup
cp backups/$(ls -t backups/ | head -1) "$DB_PATH"
```

### Detailed Revert Procedure

See [PROTECTED_BRANCHES.md](../PROTECTED_BRANCHES.md) for comprehensive emergency revert procedures, including:
- Step-by-step rollback checklist
- Database backup verification
- Phase-specific rollback procedures
- Documentation requirements

---

## Platform-Specific Notes

### Windows

**Shell:** PowerShell or Command Prompt

**Common Issues:**
- Long path names: Enable long path support in Windows settings
- Execution policy: Run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
- Line endings: Git should auto-convert (check `.gitattributes`)

**Scripts:**
- Use `.ps1` scripts: `powershell -ExecutionPolicy Bypass -File scripts\script.ps1`
- Or use Node.js scripts: `node scripts/script.js` (cross-platform)

**Database Path:**
```powershell
$env:APPDATA\.kiyya\app.db
# Example: C:\Users\YourName\AppData\Roaming\.kiyya\app.db
```

**Build Commands:**
```powershell
# Build backend
cd src-tauri; cargo build; cd ..

# Run tests
cd src-tauri; cargo test; cd ..
```

---

### macOS

**Shell:** Bash or Zsh (default on macOS 10.15+)

**Common Issues:**
- Xcode Command Line Tools: Install with `xcode-select --install`
- Homebrew: Recommended for installing dependencies
- Permissions: May need `sudo` for system-wide installs

**Scripts:**
- Use `.sh` scripts: `bash scripts/script.sh`
- Or use Node.js scripts: `node scripts/script.js` (cross-platform)

**Database Path:**
```bash
~/Library/Application Support/kiyya/app.db
```

**Build Commands:**
```bash
# Build backend
cd src-tauri && cargo build && cd ..

# Run tests
cd src-tauri && cargo test && cd ..
```

---

### Linux (Ubuntu/Debian)

**Shell:** Bash

**Common Issues:**
- Missing system libraries: Install with `apt-get` (see Prerequisites)
- Permissions: May need `sudo` for system-wide installs
- WebKit dependencies: Required for Tauri

**Scripts:**
- Use `.sh` scripts: `bash scripts/script.sh`
- Or use Node.js scripts: `node scripts/script.js` (cross-platform)

**Database Path:**
```bash
~/.kiyya/app.db
```

**Build Commands:**
```bash
# Build backend
cd src-tauri && cargo build && cd ..

# Run tests
cd src-tauri && cargo test && cd ..
```

---

## Troubleshooting Common Issues

### Build Failures

**Symptom:** `cargo build` fails with compilation errors

**Solutions:**
1. Update Rust: `rustup update`
2. Clean build artifacts: `make clean` or `cd src-tauri && cargo clean`
3. Check for missing system dependencies (Linux)
4. Verify Rust toolchain: `rustc --version`

**Example:**
```bash
# Clean and rebuild
cd src-tauri
cargo clean
cargo build
```

---

### Test Timeouts

**Symptom:** Tests hang or timeout after 3+ minutes

**Solutions:**
1. Run tests with `--nocapture` to see output: `cargo test -- --nocapture`
2. Run specific test: `cargo test test_name`
3. Check for database locks (close other instances)
4. Increase timeout in test configuration

**Example:**
```bash
# Run specific test with output
cd src-tauri
cargo test test_extract_video_urls -- --nocapture
```

---

### IPC Smoke Test Fails

**Symptom:** `node scripts/ipc_smoke_test.js` fails with connection errors

**Solutions:**
1. Verify backend builds: `cd src-tauri && cargo build`
2. Check for port conflicts (kill other instances)
3. Review output: `cat stabilization/ipc_smoke_output.txt`
4. Try manual test: `npm run tauri:dev` and test in DevTools

**Example:**
```bash
# Kill existing processes
# Windows: taskkill /F /IM kiyya-desktop.exe
# macOS/Linux: pkill -f kiyya-desktop

# Rebuild and retry
cd src-tauri && cargo build && cd ..
node scripts/ipc_smoke_test.js
```

---

### Database Migration Errors

**Symptom:** Migration fails or database is corrupted

**Solutions:**
1. Restore from backup: `cp backups/<latest> ~/.kiyya/app.db`
2. Verify backup checksum (if available)
3. Run migrations manually: Check `src-tauri/src/migrations.rs`
4. Use dry-run mode (if implemented)

**Example:**
```bash
# Restore backup
cp backups/$(ls -t backups/ | head -1) ~/.kiyya/app.db

# Verify application works
npm run tauri:dev
```

---

### Coverage Measurement Fails

**Symptom:** `cargo tarpaulin` fails or times out

**Solutions:**
1. Install/update tarpaulin: `cargo install cargo-tarpaulin`
2. Run with timeout: `cargo tarpaulin --timeout 300`
3. Use alternative: `cargo install grcov` or `cargo-llvm-cov`
4. Run on specific modules: `cargo tarpaulin --packages kiyya-desktop`

**Example:**
```bash
# Update tarpaulin
cargo install cargo-tarpaulin --force

# Run with increased timeout
cd src-tauri
cargo tarpaulin --timeout 300 --out Html --output-dir ../stabilization
```

---

### Clippy Warnings in Phase 5

**Symptom:** Phase 5 fails with clippy warnings

**Solutions:**
1. Review warnings: `cd src-tauri && cargo clippy`
2. Fix warnings one by one
3. Run after each fix: `cargo clippy -- -D warnings`
4. Check audit report: `cat stabilization/audit_clippy.txt`

**Example:**
```bash
# See all warnings
cd src-tauri
cargo clippy

# Fix and verify
cargo clippy -- -D warnings
```

---

### Git Tag Issues

**Symptom:** Cannot create tag or tag already exists

**Solutions:**
1. List existing tags: `git tag -l "v-stabilize-*"`
2. Delete local tag (if needed): `git tag -d v-stabilize-phase0-complete`
3. Create new tag with version: `git tag -a v-stabilize-phase0-complete-v2`
4. Never delete remote tags (see PROTECTED_BRANCHES.md)

**Example:**
```bash
# List tags
git tag -l "v-stabilize-*"

# Create new version if needed
git tag -a v-stabilize-phase0-complete-v2 -m "Phase 0: Complete with fixes"
```

---

### Node.js/npm Issues

**Symptom:** `npm install` fails or packages are outdated

**Solutions:**
1. Clear npm cache: `npm cache clean --force`
2. Delete node_modules: `rm -rf node_modules`
3. Reinstall: `npm install`
4. Update npm: `npm install -g npm@latest`

**Example:**
```bash
# Clean reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## Stabilization Owners

### Primary Contacts

**Stabilization Lead:**
- Name: [To be assigned]
- Role: Overall stabilization coordination
- Contact: [email/slack]

**Backend Owner:**
- Name: [To be assigned]
- Role: Rust backend, Tauri commands, database
- Contact: [email/slack]

**Frontend Owner:**
- Name: [To be assigned]
- Role: React/TypeScript, UI, player integration
- Contact: [email/slack]

**CI/CD Owner:**
- Name: [To be assigned]
- Role: GitHub Actions, automation, scripts
- Contact: [email/slack]

### Escalation Path

1. **First:** Check this README and troubleshooting section
2. **Second:** Review relevant documentation:
   - [CONTRIBUTING.md](../CONTRIBUTING.md)
   - [PROTECTED_BRANCHES.md](../PROTECTED_BRANCHES.md)
   - [stabilization/DECISIONS.md](DECISIONS.md)
   - [stabilization/CI_WORKFLOW.md](CI_WORKFLOW.md)
3. **Third:** Search existing issues and PRs
4. **Fourth:** Create new issue with `stabilization` label
5. **Fifth:** Contact stabilization owners directly

### Communication Channels

- **GitHub Issues:** For bugs, questions, and feature requests
- **Pull Requests:** For code review and discussion
- **Slack/Discord:** [To be configured]
- **Email:** [To be configured]

---

## Phase Timeline

### Estimated Duration

| Phase | Duration | Status | Completion Date |
|-------|----------|--------|-----------------|
| Phase 0: Infrastructure | 2-3 days | ✅ Complete | 2026-02-18 |
| Phase 1: Audit | 3-5 days | ✅ Complete | 2026-02-18 |
| Phase 2: Cleanup | 5-7 days | ✅ Complete | 2026-02-18 |
| Phase 3: Re-Stabilization | 5-7 days | ✅ Complete | 2026-02-19 |
| Phase 4: Debug Prep | 2-3 days | ✅ Complete | 2026-02-22 |
| Phase 5: Zero Warnings | 2-3 days | ⏳ Pending | TBD |
| **Total** | **19-28 days** | **83% Complete** | **TBD** |

### Current Status

**Active Phase:** Phase 5 (Optional)  
**Last Checkpoint:** `v-stabilize-phase4-complete`  
**Next Milestone:** Phase 5 completion (optional)

### Phase Dependencies

```
Phase 0 (Infrastructure)
  ↓ Gate: All scripts tested, CI valid
Phase 1 (Audit)
  ↓ Gate: CI passes + IPC smoke test
Phase 2 (Cleanup)
  ↓ Gate: DB backup + idempotency verified
Phase 3 (Re-Stabilization)
  ↓ Gate: Tests pass + coverage >= 60%
Phase 4 (Debug Prep)
  ↓ Gate: Reproducible claim test passes
Phase 5 (Zero Warnings) [OPTIONAL]
  ↓ Gate: Zero warnings enforced
COMPLETE
```

---

## Daily Workflow

### Morning Routine (5 minutes)

```bash
# 1. Pull latest changes
git pull origin main

# 2. Check current phase status
cat .kiro/specs/codebase-stabilization-audit/tasks.md | grep "^\- \[x\]" | tail -5

# 3. Run quick checks
make test

# 4. Review recent decisions
tail -20 stabilization/DECISIONS.md
```

### Before Starting Work (2 minutes)

```bash
# 1. Create feature branch
git checkout -b feature/stabilize/phase<N>-<description>

# 2. Verify clean state
git status

# 3. Run baseline tests
make test
```

### During Work (as needed)

```bash
# Run tests frequently
make test

# Check formatting
make check-format

# Build backend after changes
make build-backend

# Run specific test
cd src-tauri && cargo test test_name
```

### Before Committing (5 minutes)

```bash
# 1. Format code
make format

# 2. Run all checks
make test
make build

# 3. Review changes
git diff

# 4. Commit with conventional format
git add .
git commit -m "fix(backend): resolve migration idempotency issue"
```

### Before Creating PR (10 minutes)

```bash
# 1. Run full test suite
make test

# 2. Run security audit
make security-audit

# 3. Run IPC smoke test (Phase 1+)
make ipc-smoke

# 4. Measure coverage (Phase 3+)
make coverage

# 5. Create checkpoint tag (if phase complete)
git tag -a v-stabilize-phase<N>-complete -m "Phase <N>: <description>"

# 6. Push branch and tag
git push origin feature/stabilize/phase<N>-<description>
git push origin v-stabilize-phase<N>-complete
```

### After PR Merge (2 minutes)

```bash
# 1. Pull latest main
git checkout main
git pull origin main

# 2. Delete feature branch
git branch -d feature/stabilize/phase<N>-<description>

# 3. Verify tag exists
git tag -l "v-stabilize-*"
```

---

## Additional Resources

### Documentation

- **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Contribution guidelines and code standards
- **[PROTECTED_BRANCHES.md](../PROTECTED_BRANCHES.md)** - Branch protection and rollback procedures
- **[stabilization/DECISIONS.md](DECISIONS.md)** - Decision log and exceptions
- **[stabilization/CI_WORKFLOW.md](CI_WORKFLOW.md)** - CI/CD pipeline documentation
- **[stabilization/ODYSEE_DEBUG_PLAYBOOK.md](ODYSEE_DEBUG_PLAYBOOK.md)** - Debugging guide (Phase 4+)

### Specification Documents

- **[Requirements](.kiro/specs/codebase-stabilization-audit/requirements.md)** - Detailed requirements
- **[Design](.kiro/specs/codebase-stabilization-audit/design.md)** - Design document
- **[Tasks](.kiro/specs/codebase-stabilization-audit/tasks.md)** - Implementation task list

### Scripts

- **[scripts/README.md](../scripts/README.md)** - Script documentation
- **[scripts/db_snapshot.sh](../scripts/db_snapshot.sh)** - Database backup (Unix)
- **[scripts/db_snapshot.ps1](../scripts/db_snapshot.ps1)** - Database backup (Windows)
- **[scripts/generate_audit_report.sh](../scripts/generate_audit_report.sh)** - Audit report (Unix)
- **[scripts/generate_audit_report.ps1](../scripts/generate_audit_report.ps1)** - Audit report (Windows)
- **[scripts/ipc_smoke_test.js](../scripts/ipc_smoke_test.js)** - IPC smoke test (cross-platform)

### Makefile Targets

Run `make help` to see all available targets:

```bash
make help              # Show all targets
make build             # Build everything
make test              # Run all tests
make clean             # Clean artifacts
make audit             # Generate audit report
make snapshot          # Create DB backup
make format            # Format code
make check-format      # Check formatting
make coverage          # Measure coverage
make security-audit    # Run security audit
make ipc-smoke         # Run IPC smoke test
make validate-workflow # Validate CI workflow
```

### External Resources

- **Rust Documentation:** [doc.rust-lang.org](https://doc.rust-lang.org/)
- **Tauri Documentation:** [tauri.app/v1/guides](https://tauri.app/v1/guides/)
- **React Documentation:** [react.dev](https://react.dev/)
- **Conventional Commits:** [conventionalcommits.org](https://www.conventionalcommits.org/)

---

## Quick Reference Card

### Essential Commands

```bash
# Build
make build              # Build everything
make build-backend      # Build Rust only
make build-frontend     # Build frontend only

# Test
make test               # Run all tests
make ipc-smoke          # IPC smoke test
make coverage           # Measure coverage

# Audit
make audit              # Generate audit
make security-audit     # Security check

# Maintenance
make clean              # Clean artifacts
make format             # Format code
make snapshot           # Backup database

# Emergency
git reset --hard $(git tag -l "v-stabilize-*" | tail -1)  # Revert
cp backups/$(ls -t backups/ | head -1) ~/.kiyya/app.db    # Restore DB
npm run tauri:dev                                          # Verify
```

### Phase Gates

- **Phase 0 → 1:** Scripts tested, CI valid
- **Phase 1 → 2:** CI passes, IPC smoke test passes
- **Phase 2 → 3:** DB backup created, idempotency verified
- **Phase 3 → 4:** Tests pass, coverage >= 60%
- **Phase 4 → 5:** Reproducible claim test passes

### Database Paths

- **Windows:** `%APPDATA%\.kiyya\app.db`
- **macOS:** `~/Library/Application Support/kiyya/app.db`
- **Linux:** `~/.kiyya/app.db`

### Help Resources

1. This README
2. [CONTRIBUTING.md](../CONTRIBUTING.md)
3. [Troubleshooting](#troubleshooting-common-issues)
4. [Stabilization Owners](#stabilization-owners)
5. GitHub Issues

---

## Feedback and Improvements

This checklist is a living document. If you find:
- Missing information
- Unclear instructions
- Outdated commands
- Better approaches

Please:
1. Create an issue with the `documentation` label
2. Or submit a PR with improvements
3. Or contact stabilization owners

Your feedback helps improve the onboarding experience for future contributors!

---

**Last Updated:** 2026-02-22  
**Document Version:** 1.0  
**Maintained By:** Stabilization Team

