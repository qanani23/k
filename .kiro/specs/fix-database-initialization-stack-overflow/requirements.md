# Requirements Document

## Introduction

The Kiyya Desktop application crashes immediately on startup with a "thread 'main' has overflowed its stack" error. Analysis reveals that database migrations are being executed twice during application initialization: once in `Database::new()` and again in the `.setup()` hook. This double execution, combined with the migration system's use of `task::spawn_blocking` and potential deep call stacks, causes stack overflow before the application can complete startup.

This specification addresses the critical bug by eliminating redundant migration execution and simplifying the initialization flow to ensure a single, clear path for database setup.

## Glossary

- **Database**: The SQLite database manager responsible for schema initialization and data persistence
- **Migration**: A versioned SQL script that modifies the database schema
- **Migration_Runner**: The component that executes pending migrations in sequential order
- **Initialization_Flow**: The sequence of operations that occur during application startup
- **Setup_Hook**: The Tauri framework's `.setup()` callback that runs after the application builder is configured
- **Stack_Overflow**: A runtime error that occurs when the call stack exceeds its maximum size

## Requirements

### Requirement 1: Eliminate Double Migration Execution

**User Story:** As a developer, I want migrations to run exactly once during application startup, so that the application doesn't crash due to redundant execution.

#### Acceptance Criteria

1. WHEN the application starts, THE Database SHALL execute migrations exactly once
2. WHEN `Database::new()` is called, THE Database SHALL NOT execute migrations automatically
3. WHEN the setup hook runs, THE Migration_Runner SHALL execute all pending migrations
4. THE Database SHALL complete initialization without running migrations in the constructor

### Requirement 2: Simplify Database Initialization

**User Story:** As a developer, I want a clear separation between database connection setup and migration execution, so that the initialization flow is predictable and maintainable.

#### Acceptance Criteria

1. WHEN `Database::new()` is called, THE Database SHALL only create the connection pool and initialize the base schema
2. WHEN the base schema is initialized, THE Database SHALL create only the migrations table
3. THE Database SHALL provide a separate public method for running migrations
4. WHEN migrations are needed, THE caller SHALL explicitly invoke the migration method

### Requirement 3: Maintain Data Integrity

**User Story:** As a user, I want all database migrations to be applied correctly, so that my data remains consistent and the application functions properly.

#### Acceptance Criteria

1. WHEN migrations are executed, THE Migration_Runner SHALL apply all pending migrations in sequential order
2. WHEN a migration fails, THE Migration_Runner SHALL rollback the transaction and report the error
3. WHEN migrations complete successfully, THE Database SHALL record each migration in the migrations table
4. THE Migration_Runner SHALL validate migration checksums to detect tampering

### Requirement 4: Preserve Application Functionality

**User Story:** As a user, I want the application to start successfully and work as expected, so that I can access my content without issues.

#### Acceptance Criteria

1. WHEN the application starts, THE Application SHALL complete initialization without crashing
2. WHEN the database is initialized, THE Database SHALL support all existing operations (cache, favorites, progress, playlists)
3. WHEN FTS5 is available, THE Database SHALL initialize full-text search capabilities
4. WHEN all tests run, THE Test_Suite SHALL pass without failures

### Requirement 5: Prevent Recursive Patterns

**User Story:** As a developer, I want to ensure no recursive calls exist in the initialization code, so that stack overflow cannot occur.

#### Acceptance Criteria

1. THE Database initialization SHALL NOT contain any recursive function calls
2. THE Migration_Runner SHALL NOT recursively spawn blocking tasks
3. WHEN `task::spawn_blocking` is used, THE code SHALL complete in a single execution without spawning additional blocking tasks
4. THE initialization flow SHALL have a bounded call stack depth

### Requirement 6: Maintain Backward Compatibility

**User Story:** As a developer, I want existing database files to work with the fixed code, so that users don't lose their data.

#### Acceptance Criteria

1. WHEN an existing database file is opened, THE Database SHALL recognize previously applied migrations
2. WHEN the migration table exists, THE Migration_Runner SHALL read the current version correctly
3. WHEN new migrations are added, THE Migration_Runner SHALL apply only the pending migrations
4. THE Database SHALL support databases created by previous versions of the application

### Requirement 7: Improve Error Handling

**User Story:** As a developer, I want clear error messages when initialization fails, so that I can diagnose and fix issues quickly.

#### Acceptance Criteria

1. WHEN database initialization fails, THE Application SHALL log a descriptive error message
2. WHEN migration execution fails, THE Migration_Runner SHALL include the migration version and SQL statement in the error
3. WHEN a connection cannot be established, THE Database SHALL provide context about the failure
4. THE Application SHALL continue to use the logging system for all initialization errors
