# Requirements Document

## Introduction

The Kiyya Desktop application has accumulated architectural drift, resulting in numerous compiler warnings, unused code, and partially integrated systems. Before addressing the unresolved Odysee playback issue, the codebase requires comprehensive stabilization to establish a clean, minimal, and deterministic foundation. This specification defines a six-phase approach (Phase 0 through Phase 5) to set up infrastructure, audit, clean, re-stabilize, and prepare for debugging the entire codebase, ensuring zero warnings, no dead code, clear architectural boundaries, and cross-platform compatibility.

## Glossary

- **Architectural_Drift**: The gradual accumulation of unused code, incomplete features, and inconsistent patterns over time
- **Dead_Code**: Functions, structs, enums, or modules that are defined but never used in the application
- **Orphaned_Utility**: Helper functions or modules that were created but never integrated into the main codebase
- **Partial_Integration**: Systems or features that are partially implemented but not fully connected to the application flow
- **Clean_Build**: A compilation that produces zero warnings and zero errors
- **Tauri_Command**: A Rust function exposed to the frontend via the Tauri framework
- **Migration_System**: The database schema versioning system that applies incremental changes
- **Logging_System**: The error and security logging infrastructure (error_logging.rs, security_logging.rs, logging.rs)
- **Security_Logging**: The security event tracking system with SecurityEvent variants
- **IPC_Smoke_Test**: An automated test that verifies Tauri IPC connectivity between frontend and backend
- **Canary_PR**: A short-lived pull request used to verify deletions are safe before merging
- **Dynamic_Invocation**: Runtime-constructed command names used in Tauri invoke calls (e.g., template literals, array joins)
- **Phase_Gate**: A checkpoint that must pass before proceeding to the next phase
- **Cross_Platform**: Software that works on Windows, macOS, and Linux without modification
- **Idempotency**: The property that running an operation multiple times produces the same result as running it once
- **Module_Focused_Coverage**: Test coverage measured on critical modules rather than the entire codebase

## Requirements

### Requirement 1: Complete Codebase Audit

**User Story:** As a developer, I want a comprehensive inventory of all unused and dead code, so that I can make informed decisions about what to keep, integrate, or remove.

#### Acceptance Criteria

1. WHEN the audit is performed, THE Audit_Process SHALL identify all unused functions across all Rust modules
2. WHEN the audit is performed, THE Audit_Process SHALL identify all unused structs and enums
3. WHEN the audit is performed, THE Audit_Process SHALL identify all unused imports
4. WHEN the audit is performed, THE Audit_Process SHALL identify all dead modules and orphaned utilities
5. WHEN the audit is performed, THE Audit_Process SHALL identify all unregistered Tauri commands
6. WHEN the audit is performed, THE Audit_Process SHALL identify all redundant files and duplicate logic
7. WHEN findings are categorized, THE Audit_Process SHALL classify each item as: "Safe to delete", "Possibly legacy (needs confirmation)", or "Incomplete feature (should be integrated or removed)"
8. THE Audit_Process SHALL cover: Rust backend (all modules), Tauri configuration, Frontend (React + TypeScript), API layer, Player integration, State management, Unused utilities, Logging system, Migration system, Security logging, Error logging
9. WHEN the audit is performed, THE Audit_Process SHALL detect dynamic invocation patterns (template literals, array joins)
10. WHEN dynamic patterns are detected, THE Audit_Process SHALL flag them for manual review
11. WHEN the audit is performed, THE Audit_Process SHALL generate structured JSON output with file, line, snippet, and usage counts
12. THE Audit_Process SHALL use automated scripts (scripts/generate_audit_report.sh or .ps1)

### Requirement 2: Achieve Zero-Warning Compilation

**User Story:** As a developer, I want the project to compile with zero warnings, so that the codebase is clean and maintainable.

#### Acceptance Criteria

1. WHEN the project is compiled, THE Build_Process SHALL produce zero warnings
2. WHEN unused code is identified, THE Cleanup_Process SHALL either integrate it properly or remove it completely
3. THE Codebase SHALL NOT contain "future feature" placeholders that are not actively used
4. WHEN strict compilation is enabled, THE Build_Process SHALL enforce zero-warning policy

### Requirement 3: Resolve Logging System Status

**User Story:** As a developer, I want clarity on whether the logging system is integrated or unused, so that I can either use it properly or remove the complexity.

#### Acceptance Criteria

1. WHEN the logging system is audited, THE Audit_Process SHALL determine if error_logging.rs is integrated and used
2. WHEN the logging system is audited, THE Audit_Process SHALL determine if security_logging.rs is integrated and used
3. WHEN the logging system is audited, THE Audit_Process SHALL determine if logging.rs is integrated and used
4. WHEN the logging system is audited, THE Audit_Process SHALL determine if database-backed logging is active
5. WHEN the logging system is audited, THE Audit_Process SHALL determine if log_result_error helpers are used
6. WHEN the logging system is not integrated, THE Cleanup_Process SHALL remove the entire unused logging system
7. WHEN the logging system is partially integrated, THE Integration_Process SHALL fully integrate it properly
8. THE Codebase SHALL have ONE logging approach: either fully integrated or completely removed

### Requirement 4: Resolve Migration System Status

**User Story:** As a developer, I want to confirm that the migration system is properly integrated and functional, so that database schema evolution works reliably.

#### Acceptance Criteria

1. WHEN the migration system is audited, THE Audit_Process SHALL determine if get_migrations is called
2. WHEN the migration system is audited, THE Audit_Process SHALL determine if run_migrations is called
3. WHEN the migration system is audited, THE Audit_Process SHALL determine if database initialization executes migrations
4. WHEN migrations are not essential, THE Cleanup_Process SHALL remove migration complexity
5. WHEN migrations are essential, THE Integration_Process SHALL ensure they are properly integrated and tested

### Requirement 5: Resolve Security Logging Status

**User Story:** As a developer, I want to know if security logging is a real security layer or theoretical future protection, so that I can decide whether to keep or remove it.

#### Acceptance Criteria

1. WHEN security logging is audited, THE Audit_Process SHALL determine if SecurityEvent variants are constructed
2. WHEN security logging is audited, THE Audit_Process SHALL determine if log_security_events is called
3. WHEN security logging is unused, THE Cleanup_Process SHALL remove it completely
4. WHEN security logging is used, THE Integration_Process SHALL ensure it is properly integrated

### Requirement 6: Verify Tauri Command Registration and Safety

**User Story:** As a developer, I want all Tauri commands to be properly registered and functional, so that the frontend can communicate with the backend reliably.

#### Acceptance Criteria

1. WHEN Tauri commands are audited, THE Audit_Process SHALL identify all defined Tauri commands
2. WHEN Tauri commands are audited, THE Audit_Process SHALL verify each command is registered in the Tauri builder
3. WHEN Tauri commands are audited, THE Audit_Process SHALL verify no command hangs or fails to return
4. WHEN Tauri commands are audited, THE Audit_Process SHALL verify all async calls return properly
5. THE Codebase SHALL NOT contain unregistered Tauri commands
6. WHEN Tauri commands are verified, THE Verification_Process SHALL run IPC smoke test
7. WHEN IPC smoke test runs, THE Test SHALL be deterministic, headless, and CI-safe
8. WHEN Tauri commands are deleted, THE Deletion_Process SHALL check for dynamic invocation patterns
9. WHEN dynamic patterns are found (template literals, array joins), THE Deletion_Process SHALL flag for manual review
10. THE Verification_Process SHALL include test_connection command for smoke testing

### Requirement 7: Eliminate Dead Branches and Unreachable Code

**User Story:** As a developer, I want to remove all dead branches and unreachable code, so that the codebase is easier to understand and maintain.

#### Acceptance Criteria

1. WHEN the audit is performed, THE Audit_Process SHALL identify all dead branches
2. WHEN the audit is performed, THE Audit_Process SHALL identify all unreachable code
3. WHEN cleanup is performed, THE Cleanup_Process SHALL remove all dead branches
4. WHEN cleanup is performed, THE Cleanup_Process SHALL remove all unreachable code

### Requirement 8: Produce Comprehensive Cleanup Documentation

**User Story:** As a developer, I want detailed documentation of what was removed and what was integrated, so that I understand the changes and can reference them later.

#### Acceptance Criteria

1. WHEN cleanup is complete, THE Documentation_Process SHALL produce a dead code removal list
2. WHEN cleanup is complete, THE Documentation_Process SHALL produce a removed modules list
3. WHEN cleanup is complete, THE Documentation_Process SHALL produce an integrated modules list
4. WHEN cleanup is complete, THE Documentation_Process SHALL provide clean build proof (no warnings)
5. WHEN cleanup is complete, THE Documentation_Process SHALL provide a clear explanation of the current real architecture

### Requirement 9: Update Architecture Documentation

**User Story:** As a developer, I want architecture documentation that reflects reality, not theoretical features, so that I can understand the actual system.

#### Acceptance Criteria

1. WHEN documentation is updated, THE Documentation_Process SHALL reflect what actually exists
2. WHEN documentation is updated, THE Documentation_Process SHALL NOT include theoretical features
3. WHEN documentation is updated, THE Documentation_Process SHALL NOT include unused systems
4. WHEN documentation is updated, THE Documentation_Process SHALL accurately describe the logging architecture (if retained)
5. WHEN documentation is updated, THE Documentation_Process SHALL accurately describe the migration state
6. WHEN documentation is updated, THE Documentation_Process SHALL accurately describe the playback model
7. WHEN documentation is updated, THE Documentation_Process SHALL accurately describe the backend command list
8. WHEN documentation is updated, THE Documentation_Process SHALL include actual module structure
9. WHEN documentation is updated, THE Documentation_Process SHALL include backend flow diagram
10. WHEN documentation is updated, THE Documentation_Process SHALL include frontend → backend invocation diagram
11. WHEN documentation is updated, THE Documentation_Process SHALL include content fetch pipeline (real, not theoretical)

### Requirement 10: Establish Foundation for Odysee Issue Investigation

**User Story:** As a developer, I want a clean codebase foundation, so that I can precisely debug the Odysee playback issue without architectural noise.

#### Acceptance Criteria

1. WHEN stabilization is complete, THE Codebase SHALL be ready for Phase 4: Odysee fetch issue debugging
2. WHEN stabilization is complete, THE Codebase SHALL be clean, minimal, and deterministic
3. WHEN stabilization is complete, THE Codebase SHALL be architecturally consistent
4. WHEN stabilization is complete, THE Codebase SHALL be easy to debug
5. THE Stabilization_Process SHALL NOT implement new features
6. THE Stabilization_Process SHALL NOT redesign playback
7. THE Stabilization_Process SHALL NOT change CDN logic

### Requirement 11: Maintain Existing Functionality

**User Story:** As a user, I want the application to continue working as it did before stabilization, so that my workflow is not disrupted.

#### Acceptance Criteria

1. WHEN cleanup is performed, THE Application SHALL maintain all existing user-facing functionality
2. WHEN code is removed, THE Removal_Process SHALL only remove genuinely unused code
3. WHEN code is integrated, THE Integration_Process SHALL ensure it works correctly
4. WHEN stabilization is complete, THE Application SHALL pass all existing tests

### Requirement 12: Phase 0 Infrastructure Setup

**User Story:** As a developer, I want all necessary infrastructure in place before beginning stabilization, so that the process is automated, safe, and repeatable.

#### Acceptance Criteria

1. WHEN Phase 0 is complete, THE Infrastructure SHALL include cross-platform scripts for all platforms (Windows, macOS, Linux)
2. WHEN Phase 0 is complete, THE Infrastructure SHALL include database backup scripts with checksum verification
3. WHEN Phase 0 is complete, THE Infrastructure SHALL include automated audit scripts with structured output
4. WHEN Phase 0 is complete, THE Infrastructure SHALL include IPC smoke test scripts with retry logic and guaranteed cleanup
5. WHEN Phase 0 is complete, THE Infrastructure SHALL include CI/CD workflow with phase-specific gates
6. WHEN Phase 0 is complete, THE Infrastructure SHALL include PR template with phase gate sign-offs
7. WHEN Phase 0 is complete, THE Infrastructure SHALL include branch protection documentation with emergency revert checklist
8. WHEN Phase 0 is complete, THE Infrastructure SHALL include Makefile with common shortcuts
9. WHEN Phase 0 is complete, THE Infrastructure SHALL include formatting tools configuration (rustfmt, ESLint, Prettier)
10. WHEN Phase 0 is complete, THE Infrastructure SHALL include pre-commit hooks for linting and formatting
11. WHEN Phase 0 is complete, THE Infrastructure SHALL include CONTRIBUTING.md with phase discipline documentation
12. WHEN Phase 0 is complete, THE Infrastructure SHALL include deliverables directory structure with templates
13. WHEN Phase 0 is complete, THE Infrastructure SHALL include reproducible claim example with privacy documentation
14. WHEN Phase 0 is complete, THE Infrastructure SHALL include day-1 contributor checklist in stabilization/README.md
15. THE Infrastructure SHALL support timeouts and guaranteed cleanup for all process-spawning scripts
16. THE Infrastructure SHALL document platform-specific expectations in CI_WORKFLOW.md

### Requirement 13: Cross-Platform Compatibility

**User Story:** As a developer on any platform, I want all stabilization tools and scripts to work on my operating system, so that I can contribute regardless of platform.

#### Acceptance Criteria

1. WHEN scripts are created, THE Scripts SHALL work on Windows (PowerShell)
2. WHEN scripts are created, THE Scripts SHALL work on macOS (Bash/Zsh)
3. WHEN scripts are created, THE Scripts SHALL work on Linux (Bash)
4. THE Scripts SHALL use Node.js for maximum portability OR provide both .sh and .ps1 variants
5. WHEN database paths are used, THE Scripts SHALL support platform-specific default paths
6. WHEN database paths are used, THE Scripts SHALL allow override via environment variables
7. WHEN CI runs, THE CI SHALL execute on multiple platforms without modification
8. THE Documentation SHALL clearly specify platform requirements and expectations

### Requirement 14: IPC Smoke Test Verification

**User Story:** As a developer, I want automated verification that Tauri IPC is functional, so that I can catch connectivity issues early.

#### Acceptance Criteria

1. WHEN IPC smoke test runs, THE Test SHALL use headless backend mode (not GUI-based tauri:dev)
2. WHEN IPC smoke test runs, THE Test SHALL implement retry logic with exponential backoff (max 3 retries)
3. WHEN IPC smoke test runs, THE Test SHALL implement timeout (30 seconds maximum)
4. WHEN IPC smoke test runs, THE Test SHALL guarantee cleanup of spawned processes using signal handlers
5. WHEN IPC smoke test runs, THE Test SHALL capture stdout/stderr to stabilization/ipc_smoke_output.txt
6. WHEN IPC smoke test runs, THE Test SHALL verify test_connection command returns "tauri-backend-alive"
7. WHEN IPC smoke test fails, THE Test SHALL kill backend process and report failure
8. WHEN IPC smoke test completes, THE Test SHALL be deterministic and CI-safe
9. THE IPC smoke test SHALL be mandatory in Phase 1 before proceeding to Phase 2
10. THE IPC smoke test output SHALL be linked in PR for review

### Requirement 15: Database Migration Safety

**User Story:** As a developer, I want database migrations to be safe and reversible, so that I can recover from failures without data loss.

#### Acceptance Criteria

1. WHEN migrations are executed, THE Migration_System SHALL create backup with SHA256 checksum before execution
2. WHEN backups are created, THE Backup_System SHALL store backup metadata with timestamp, path, and checksum
3. WHEN backups are created, THE Backup_System SHALL document that backups may contain PII
4. WHEN backups are created, THE Backup_System SHALL support platform-specific default DB paths
5. WHEN backups are created, THE Backup_System SHALL allow DB path override via environment variable
6. WHEN migrations run, THE Migration_System SHALL skip already-applied migrations (idempotency)
7. WHEN migrations run, THE Migration_System SHALL provide dry-run mode for validation without execution
8. WHEN migrations run, THE Migration_System SHALL support rollback via snapshot restore
9. WHEN backups are restored, THE Restore_Process SHALL verify checksum matches
10. WHEN Phase 2 begins, THE CI SHALL automate restore test on disposable runner
11. THE Migration_System SHALL prevent duplicate migration execution
12. THE Migration_System SHALL document rollback procedures with checksum verification

### Requirement 16: Deletion Safety and Review Process

**User Story:** As a developer, I want a safe process for deleting code, so that hidden dependencies are discovered before merge.

#### Acceptance Criteria

1. WHEN code is marked for deletion, THE Deletion_Process SHALL create canary PR (do not merge)
2. WHEN canary PR is created, THE Deletion_Process SHALL run full test suite in CI
3. WHEN canary PR is created, THE Deletion_Process SHALL allow reviewers 48 hours to verify
4. WHEN code is deleted, THE Deletion_Process SHALL include grep evidence showing zero usage
5. WHEN code is deleted, THE Deletion_Process SHALL include automated test exercising caller surface
6. WHEN code is deleted, THE Deletion_Process SHALL check for dynamic invocation patterns
7. WHEN dynamic patterns are found, THE Deletion_Process SHALL flag for manual review
8. WHEN dynamic patterns are found, THE Deletion_Process SHALL create test harness to exercise patterns
9. WHEN Tauri commands are deleted, THE Deletion_Process SHALL search for template literal patterns (fetch_${type})
10. WHEN Tauri commands are deleted, THE Deletion_Process SHALL search for array join patterns (['fetch', type].join('_'))
11. WHEN deletions are complete, THE Deletion_Process SHALL document all evidence in stabilization/DELETIONS.md
12. THE Deletion_Process SHALL NOT merge canary PR - use only for verification

### Requirement 17: Module-Focused Test Coverage

**User Story:** As a developer, I want test coverage focused on critical modules, so that testing effort is prioritized effectively.

#### Acceptance Criteria

1. WHEN coverage is measured, THE Coverage_Process SHALL target >= 60% on critical modules (not blanket coverage)
2. WHEN critical modules are defined, THE Coverage_Process SHALL document list in stabilization/DECISIONS.md
3. THE Critical modules SHALL include: content fetching, parsing, extract_video_urls, player bridge, database migrations
4. WHEN coverage target is not achievable, THE Coverage_Process SHALL allow documented exception with remediation timeline
5. WHEN property tests run, THE Property_Tests SHALL execute minimum 100 cases each
6. WHEN property tests run, THE Property_Tests SHALL record run times
7. WHEN coverage is measured, THE Coverage_Process SHALL use cargo-tarpaulin or grcov
8. WHEN coverage reports are generated, THE Coverage_Process SHALL upload to CI artifacts
9. THE Coverage_Process SHALL focus testing effort on critical paths first

### Requirement 18: Phase 4 Odysee Debug Preparation

**User Story:** As a developer, I want a reproducible test case and debug playbook ready, so that I can precisely investigate the Odysee playback issue.

#### Acceptance Criteria

1. WHEN Phase 4 begins, THE Preparation_Process SHALL have reproducible claim stored in tests/fixtures/claim_working.json
2. WHEN claim is stored, THE Claim SHALL be publicly playable (no authentication required)
3. WHEN claim is stored, THE Claim SHALL be sanitized (no sensitive data)
4. WHEN claim is stored, THE Claim SHALL have README documenting source and permissions
5. WHEN claim is stored, THE Claim SHALL have instructions for runtime fetch via TEST_CLAIM_ID env var
6. WHEN Phase 4 begins, THE Preparation_Process SHALL have ODYSEE_DEBUG_PLAYBOOK.md created
7. WHEN playbook is created, THE Playbook SHALL document exact debugging steps
8. WHEN playbook is created, THE Playbook SHALL include DevTools Console commands
9. WHEN playbook is created, THE Playbook SHALL include log capture instructions
10. WHEN playbook is created, THE Playbook SHALL document expected vs actual behavior
11. WHEN Phase 4 begins, THE Preparation_Process SHALL add tracing to content pipeline stages
12. WHEN tracing is added, THE Tracing SHALL cover: claim_search, parsing, validation, CDN URL construction, backend return, frontend receive, player mount
13. WHEN Phase 4 completes, THE Codebase SHALL be ready for precise Odysee issue debugging
14. THE Preparation_Process SHALL provide test_playback_url command for deterministic testing

### Requirement 19: CI/CD Phase Gates

**User Story:** As a developer, I want CI to enforce phase gates automatically, so that quality standards are maintained throughout stabilization.

#### Acceptance Criteria

1. WHEN CI runs, THE CI SHALL use phase-specific conditionals for clippy warnings (if: contains(github.ref, 'phase5'))
2. WHEN CI runs, THE CI SHALL name status checks after phase gates (stabilization/phase1-ipc-smoke, etc.)
3. WHEN CI runs, THE CI SHALL upload artifacts: audit_warnings.txt, audit_clippy.txt, ipc_smoke_output.txt, coverage_report.html
4. WHEN CI runs, THE CI SHALL use cross-platform test scripts (Node.js or shell variants)
5. WHEN CI runs, THE CI SHALL NOT rely on GUI for IPC smoke test
6. WHEN Phase 1-4 run, THE CI SHALL allow clippy warnings (-A warnings)
7. WHEN Phase 5 runs, THE CI SHALL enforce zero clippy warnings (-D warnings)
8. WHEN PR is created, THE PR template SHALL include phase gate sign-off checkboxes
9. WHEN PR is created, THE PR template SHALL require reviewer approval for each gate
10. THE CI SHALL prevent merge until all phase-specific gates pass

### Requirement 20: Logging System with Feature Flag Fallback

**User Story:** As a developer, I want the option to re-enable logging in the future without code surgery, so that the decision is reversible.

#### Acceptance Criteria

1. WHEN logging system is removed, THE Removal_Process SHALL keep minimal tracing adaptor
2. WHEN logging system is removed, THE Removal_Process SHALL use feature = "logging" cargo flag
3. WHEN logging system is removed, THE Removal_Process SHALL document re-enablement path in stabilization/LOGGING_DECISION.md
4. WHEN logging system is integrated, THE Integration_Process SHALL use structured JSON format
5. WHEN logging system is integrated, THE Integration_Process SHALL include required fields: timestamp, level, component, claim_id, message
6. WHEN logging system is integrated, THE Integration_Process SHALL redact secrets (tokens, credentials, API keys)
7. WHEN logging system is integrated, THE Integration_Process SHALL support LOG_LEVEL environment variable
8. WHEN logging system is integrated, THE Integration_Process SHALL default to INFO in production, DEBUG in development
9. THE Logging decision SHALL be documented in stabilization/LOGGING_DECISION.md
10. THE Codebase SHALL have ONE logging approach: fully integrated, minimal fallback, or completely removed

