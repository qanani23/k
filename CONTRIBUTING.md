# Contributing to Kiyya Desktop

Welcome to the Kiyya Desktop project! This guide will help you contribute effectively to the codebase stabilization effort and ongoing development.

## ⚠️ CRITICAL: Canary PR Rules for Phase 2

**If you are working on Phase 2 deletion tasks (7.1 - 7.6), you MUST read this first:**

📖 **[stabilization/CANARY_PR_CRITICAL_RULES.md](stabilization/CANARY_PR_CRITICAL_RULES.md)** - MANDATORY READING

**The Golden Rule:** NEVER MERGE A CANARY PR

Canary PRs are verification-only pull requests used to test proposed code deletions before actual implementation. Merging a canary PR would apply unverified deletions to the main codebase.

**Key Points:**
- Canary PRs are for verification only
- Must be labeled with `canary-pr-do-not-merge`
- Must wait 48 hours for CI and review
- Must be closed (not merged) after verification
- Create separate PR for actual deletions

See [CANARY_PR_CRITICAL_RULES.md](stabilization/CANARY_PR_CRITICAL_RULES.md) for complete documentation.

---

## Table of Contents

- [Phase Discipline](#phase-discipline)
- [Local Development Setup](#local-development-setup)
- [Local Check Commands](#local-check-commands)
- [Commit Message Format](#commit-message-format)
- [Review Process](#review-process)
- [Code Standards](#code-standards)
- [Testing Guidelines](#testing-guidelines)
- [Emergency Procedures](#emergency-procedures)

## Phase Discipline

The Kiyya Desktop stabilization follows a structured six-phase approach. Each phase has specific goals and gates that must be met before proceeding.

### Phase Overview

```
Phase 0: Infrastructure Setup
  ↓ Gate: All scripts tested, CI valid
Phase 1: Full Codebase Audit
  ↓ Gate: CI passes + IPC smoke test
Phase 2: Clean Build Enforcement
  ↓ Gate: DB backup + idempotency verified
Phase 3: Architecture Re-Stabilization
  ↓ Gate: All tests pass + coverage >= 60%
Phase 4: Odysee Debug Preparation
  ↓ Gate: Reproducible claim test passes
Phase 5: Final Zero-Warning Enforcement
  ↓ Gate: Zero warnings enforced
```

### Phase Rules

1. **Sequential Execution**: Phases must be completed in order. Do not skip phases.

2. **Gate Requirements**: Each phase has specific gate requirements that must be met before proceeding to the next phase.

3. **No Feature Development**: During stabilization, focus only on cleanup, testing, and documentation. No new features.

4. **Tag Checkpoints**: Create an annotated tag at the completion of each phase:
   ```bash
   git tag -a v-stabilize-phase0-complete -m "Phase 0: Infrastructure setup complete"
   git push origin v-stabilize-phase0-complete
   ```

5. **No Force Pushes**: After creating a tag, force pushes are strictly prohibited. See [PROTECTED_BRANCHES.md](PROTECTED_BRANCHES.md) for details.

6. **Documentation Required**: All decisions, exceptions, and trade-offs must be documented in `stabilization/DECISIONS.md`.

### Current Phase Status

Check the current phase status in `.kiro/specs/codebase-stabilization-audit/tasks.md`.

## Local Development Setup

### Prerequisites

- **Node.js**: v18 or higher
- **Rust**: Latest stable version
- **Cargo**: Comes with Rust
- **Platform-specific tools**:
  - Windows: PowerShell 5.1+
  - macOS: Bash/Zsh
  - Linux: Bash

### Initial Setup

```bash
# Clone repository
git clone <repository-url>
cd kiyya-desktop

# Install frontend dependencies
npm install

# Install Rust dependencies (automatic on first build)
cd src-tauri
cargo build
cd ..

# Install development tools
cargo install cargo-tarpaulin  # For coverage
cargo install cargo-audit      # For security audits

# Set up pre-commit hooks (if using Husky)
npm run prepare
```

### Environment Variables

```bash
# Optional: Override database path for testing
export DB_PATH="./test-data/app.db"

# Optional: Set log level
export LOG_LEVEL="DEBUG"

# Optional: Use test claim for reproducible testing
export TEST_CLAIM_ID="<claim-id-from-fixtures>"
```

## Local Check Commands

Before committing or creating a PR, run these commands to verify your changes:

### Quick Checks (Run Before Every Commit)

```bash
# Format check (fast)
make check-format

# Lint frontend
npm run lint

# Build backend (catches compilation errors)
make build-backend
```

### Full Checks (Run Before Creating PR)

```bash
# Run all tests
make test

# Run security audit
make security-audit

# Run IPC smoke test (Phase 1+)
make ipc-smoke

# Measure coverage (Phase 3+)
make coverage
```

### Using Makefile Shortcuts

The project includes a Makefile with convenient shortcuts:

```bash
# Show all available commands
make help

# Build everything
make build

# Run all tests
make test

# Clean build artifacts
make clean

# Generate audit report
make audit

# Create database backup
make snapshot

# Format all code
make format

# Check formatting without changes
make check-format

# Measure test coverage
make coverage

# Run security audit
make security-audit

# Run IPC smoke test
make ipc-smoke

# Validate GitHub Actions workflow
make validate-workflow
```

### Platform-Specific Commands

#### Windows (PowerShell)

```powershell
# Build backend
cd src-tauri; cargo build; cd ..

# Run tests
cd src-tauri; cargo test; cd ..

# Format code
cd src-tauri; cargo fmt; cd ..

# Run audit script
powershell -ExecutionPolicy Bypass -File scripts\generate_audit_report.ps1

# Create DB backup
powershell -ExecutionPolicy Bypass -File scripts\db_snapshot.ps1

# Run IPC smoke test
node scripts/ipc_smoke_test.js
```

#### macOS/Linux (Bash)

```bash
# Build backend
cd src-tauri && cargo build && cd ..

# Run tests
cd src-tauri && cargo test && cd ..

# Format code
cd src-tauri && cargo fmt && cd ..

# Run audit script
bash scripts/generate_audit_report.sh

# Create DB backup
bash scripts/db_snapshot.sh

# Run IPC smoke test
node scripts/ipc_smoke_test.js
```

## Commit Message Format

We follow the Conventional Commits specification for clear and consistent commit messages.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature (avoid during stabilization)
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code refactoring without changing functionality
- **test**: Adding or updating tests
- **chore**: Maintenance tasks (dependencies, build config, etc.)
- **perf**: Performance improvements
- **ci**: CI/CD configuration changes

### Scopes

Use the module or area affected:

- **backend**: Rust backend changes
- **frontend**: React/TypeScript frontend changes
- **db**: Database or migration changes
- **scripts**: Build or automation scripts
- **ci**: CI/CD workflow changes
- **docs**: Documentation changes
- **tests**: Test-related changes

### Examples

```
fix(backend): resolve database migration idempotency issue

Added check to skip already-applied migrations, preventing
duplicate execution and migration conflicts.

Fixes #123
```

```
test(backend): add property tests for extract_video_urls

Added 100-case property test to verify URL extraction across
various claim formats. Validates Requirement 17.5.

Related to Phase 3 gate requirements.
```

```
chore(ci): update stabilization workflow with phase gates

Added phase-specific conditionals for clippy warnings and
coverage checks. Implements Requirement 19.1.
```

```
docs(stabilization): document Phase 2 cleanup decisions

Added logging system removal decision and migration
idempotency verification to DECISIONS.md.
```

### Commit Message Rules

1. **Subject line**: 50 characters or less
2. **Imperative mood**: "Add feature" not "Added feature"
3. **No period**: Don't end subject with a period
4. **Body**: Wrap at 72 characters
5. **Reference issues**: Use "Fixes #123" or "Related to #456"
6. **Reference requirements**: Mention requirement numbers when applicable

## Review Process

### Before Creating a PR

1. **Run local checks**: Execute all commands in [Local Check Commands](#local-check-commands)

2. **Update documentation**: If your changes affect architecture, update relevant docs

3. **Create checkpoint tag**: If completing a phase, create an annotated tag

4. **Fill PR template**: Use the template in `.github/PULL_REQUEST_TEMPLATE.md`

### PR Template Checklist

When creating a PR, ensure you complete all sections:

- [ ] Select the appropriate phase
- [ ] Paste command outputs (build, test, clippy, coverage)
- [ ] Document tag created (if phase completion)
- [ ] List files changed with rationale
- [ ] Document deferred items with justification
- [ ] Write one-paragraph summary
- [ ] Complete phase gate sign-offs
- [ ] Complete general checklist
- [ ] Assign reviewers

### Review Criteria

Reviewers will check:

1. **Phase Discipline**: Changes align with current phase goals
2. **Gate Requirements**: All phase gate requirements are met
3. **Code Quality**: Code follows standards and best practices
4. **Test Coverage**: Adequate tests for changes (>= 60% on critical modules)
5. **Documentation**: Changes are documented appropriately
6. **No Regressions**: Existing functionality is not broken
7. **Security**: No security vulnerabilities introduced

### Review Timeline

- **Standard PR**: 24-48 hours for initial review
- **Canary PR** (deletions): 48 hours minimum for verification
- **Phase Completion PR**: 48-72 hours for thorough review

### Addressing Review Feedback

1. **Make requested changes**: Address all reviewer comments
2. **Push new commits**: Do not force push or amend after review starts
3. **Respond to comments**: Acknowledge each comment and explain changes
4. **Re-request review**: After addressing feedback, re-request review

## Code Standards

### Rust Backend Standards

#### Formatting

Use `rustfmt` with project configuration:

```bash
cd src-tauri
cargo fmt
```

Configuration in `rustfmt.toml`:
- Max width: 100 characters
- 4 spaces for indentation
- Reorder imports and modules

#### Linting

Use `clippy` for linting:

```bash
cd src-tauri
cargo clippy -- -W clippy::all
```

**Phase 5 only**: Zero warnings enforced with `-D warnings`

#### Naming Conventions

- **Functions**: `snake_case`
- **Structs/Enums**: `PascalCase`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Modules**: `snake_case`

#### Error Handling

- Use `Result<T, E>` for fallible operations
- Provide descriptive error messages
- Use `?` operator for error propagation
- Avoid `unwrap()` in production code (use `expect()` with message)

#### Documentation

- Document all public functions, structs, and modules
- Use `///` for doc comments
- Include examples for complex functions
- Document panics, errors, and safety requirements

Example:
```rust
/// Extracts video URLs from a claim object.
///
/// # Arguments
///
/// * `claim` - The claim JSON object containing video metadata
///
/// # Returns
///
/// Returns a `Result` containing the extracted URL or an error message.
///
/// # Errors
///
/// Returns an error if:
/// - The claim is missing required fields
/// - The URL format is invalid
///
/// # Example
///
/// ```
/// let claim = serde_json::json!({
///     "claim_id": "abc123",
///     "value": { "stream": { "source": { "sd_hash": "..." } } }
/// });
/// let url = extract_video_urls(claim)?;
/// ```
pub fn extract_video_urls(claim: serde_json::Value) -> Result<String, String> {
    // Implementation
}
```

### Frontend Standards

#### Formatting

Use Prettier with project configuration:

```bash
npm run format
# or
npx prettier --write "src/**/*.{js,jsx,ts,tsx,json,css,md}"
```

Configuration in `.prettierrc`:
- Semicolons: true
- Single quotes: true
- Print width: 100 characters
- Tab width: 2 spaces

#### Linting

Use ESLint:

```bash
npm run lint
```

Configuration in `.eslintrc.cjs`:
- Extends: `eslint:recommended`, `plugin:react/recommended`
- No unused variables (error)
- Console statements (warning)

#### Naming Conventions

- **Components**: `PascalCase` (e.g., `VideoPlayer.tsx`)
- **Functions**: `camelCase`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Files**: `kebab-case` or `PascalCase` for components

#### React Best Practices

- Use functional components with hooks
- Avoid inline styles (use CSS modules or styled-components)
- Memoize expensive computations with `useMemo`
- Memoize callbacks with `useCallback`
- Use TypeScript for type safety

#### TypeScript Standards

- Enable strict mode
- Avoid `any` type (use `unknown` if necessary)
- Define interfaces for props and state
- Use type inference where possible

### General Standards

#### File Organization

```
src-tauri/
├── src/
│   ├── main.rs           # Entry point
│   ├── commands.rs       # Tauri commands
│   ├── database.rs       # Database logic
│   ├── migrations.rs     # Database migrations
│   └── ...
└── Cargo.toml

src/
├── components/           # React components
├── hooks/                # Custom hooks
├── utils/                # Utility functions
├── types/                # TypeScript types
└── App.tsx               # Main app component
```

#### Comments

- Write self-documenting code (clear names, simple logic)
- Add comments for complex algorithms or non-obvious decisions
- Avoid redundant comments that restate the code
- Use TODO comments sparingly (link to issues when possible)

```rust
// Good: Explains why, not what
// Use exponential backoff to avoid overwhelming the server
let delay = base_delay * 2_u64.pow(retry_count);

// Bad: Restates the code
// Set delay to base_delay times 2 to the power of retry_count
let delay = base_delay * 2_u64.pow(retry_count);
```

#### Magic Numbers

Avoid magic numbers; use named constants:

```rust
// Bad
if retry_count > 3 {
    return Err("Too many retries".into());
}

// Good
const MAX_RETRIES: u32 = 3;
if retry_count > MAX_RETRIES {
    return Err("Too many retries".into());
}
```

## Testing Guidelines

### Test Coverage Requirements

- **Critical modules**: >= 60% line coverage
- **Non-critical modules**: Best effort
- **Property tests**: Minimum 100 cases each

Critical modules (Phase 3):
- Content fetching modules
- Parsing modules
- `extract_video_urls` module
- Player bridge modules
- Database migration modules

### Test Types

#### Unit Tests

Test individual functions and methods in isolation:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_claim_id() {
        let claim = serde_json::json!({
            "claim_id": "abc123"
        });
        let result = extract_claim_id(&claim);
        assert_eq!(result, Ok("abc123".to_string()));
    }
}
```

#### Integration Tests

Test multiple components working together:

```rust
#[tokio::test]
async fn test_full_claim_fetch_pipeline() {
    let db = create_test_db().await;
    let claim = fetch_claim("abc123").await.unwrap();
    let url = extract_video_urls(claim).unwrap();
    assert!(url.starts_with("https://"));
}
```

#### Property Tests

Test universal properties across many inputs:

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn test_url_extraction_always_returns_https(
        claim_id in "[a-z0-9]{6,40}"
    ) {
        let claim = create_test_claim(&claim_id);
        let url = extract_video_urls(claim).unwrap();
        prop_assert!(url.starts_with("https://"));
    }
}
```

### Test Isolation

- Use isolated test databases (temp directories)
- Clean up resources after tests
- Avoid shared state between tests
- Use `TempDir` for file system tests

Example:
```rust
use tempfile::TempDir;

async fn create_test_db() -> (Database, TempDir) {
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let db_path = temp_dir.path().join("test.db");
    let db = Database::new_with_path(&db_path).await
        .expect("Failed to create database");
    db.run_migrations().await.expect("Failed to run migrations");
    (db, temp_dir)
}
```

### Running Tests

```bash
# Run all backend tests
cd src-tauri && cargo test

# Run specific test
cd src-tauri && cargo test test_extract_claim_id

# Run tests with output
cd src-tauri && cargo test -- --nocapture

# Run tests with coverage
make coverage
```

## Emergency Procedures

### Emergency Revert (3-Command Fast Revert)

For critical issues requiring immediate rollback:

```bash
# 1. Find and revert to last stable tag
git reset --hard $(git tag -l "v-stabilize-*" | tail -1)

# 2. Restore database backup
cp backups/$(ls -t backups/ | head -1) ~/.kiyya/app.db

# 3. Verify application works
npm run tauri:dev
```

See [PROTECTED_BRANCHES.md](PROTECTED_BRANCHES.md) for detailed emergency procedures.

### Reporting Issues

If you encounter critical issues:

1. **Stop work**: Do not proceed with changes
2. **Document issue**: Create detailed issue report
3. **Notify team**: Alert stabilization owners
4. **Consider revert**: If issue is blocking, use emergency revert
5. **Update DECISIONS.md**: Document the issue and resolution

### Getting Help

- **Documentation**: Check `stabilization/README.md` for day-1 checklist
- **Decisions Log**: Review `stabilization/DECISIONS.md` for historical context
- **Protected Branches**: See `PROTECTED_BRANCHES.md` for rollback procedures
- **CI Workflow**: Check `stabilization/CI_WORKFLOW.md` for CI details
- **Debug Playbook**: See `stabilization/ODYSEE_DEBUG_PLAYBOOK.md` for debugging

## Additional Resources

- [Architecture Documentation](ARCHITECTURE.md)
- [Build Instructions](BUILD.md)
- [Protected Branches Policy](PROTECTED_BRANCHES.md)
- [Stabilization Decisions Log](stabilization/DECISIONS.md)
- [Phase 0-5 Task List](.kiro/specs/codebase-stabilization-audit/tasks.md)
- [Requirements Document](.kiro/specs/codebase-stabilization-audit/requirements.md)
- [Design Document](.kiro/specs/codebase-stabilization-audit/design.md)

## Questions?

If you have questions about contributing:

1. Check this document first
2. Review the stabilization documentation in `stabilization/`
3. Check existing issues and PRs for similar questions
4. Create a new issue with the `question` label
5. Contact stabilization owners (listed in `stabilization/README.md`)

Thank you for contributing to Kiyya Desktop! 🚀
