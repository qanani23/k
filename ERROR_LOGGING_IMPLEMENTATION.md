# Comprehensive Error Logging Implementation

## Overview

This document describes the comprehensive error logging system implemented for the Kiyya desktop streaming application. The system provides structured error logging, categorization, analytics, and integration with the diagnostics system.

## Features

### 1. Structured Error Logging

The error logging system captures comprehensive error information including:

- **Error Type**: Categorized by component (network, database, security, etc.)
- **Error Code**: Unique error codes for easy identification (e.g., E_GATEWAY_001)
- **Error Message**: Detailed error description
- **User Action**: The action the user was performing when the error occurred
- **Context**: Additional key-value pairs providing context
- **Stack Trace**: Optional stack trace for debugging
- **Timestamp**: When the error occurred
- **Resolution Status**: Whether the error has been resolved

### 2. Error Categories

Errors are automatically categorized into the following categories:

- **network**: Gateway failures, API errors, timeouts, rate limiting
- **database**: Database errors, migrations, corruption
- **filesystem**: IO errors, disk space, file corruption
- **security**: Encryption, decryption, key management, security violations
- **server**: Local HTTP server errors, streaming issues
- **content**: Content parsing, missing fields, invalid formats
- **download**: Download errors, interruptions
- **cache**: Cache errors, TTL expiration
- **update**: Version comparison, update manifest errors
- **search**: Search errors, query timeouts
- **series**: Playlist errors, series parsing
- **media**: Codec compatibility, platform compatibility
- **general**: Other application errors

### 3. Error Codes

Each error type has a unique error code for easy identification:

#### Gateway Errors
- `E_GATEWAY_001`: All gateways failed
- `E_GATEWAY_002`: Gateway error
- `E_GATEWAY_003`: Rate limit exceeded
- `E_GATEWAY_004`: API timeout

#### Content Errors
- `E_CONTENT_001`: Content not found
- `E_CONTENT_002`: Content parsing error
- `E_CONTENT_003`: Invalid content format
- `E_CONTENT_004`: Missing required field

#### Download Errors
- `E_DOWNLOAD_001`: Download error
- `E_DOWNLOAD_002`: Insufficient disk space
- `E_DOWNLOAD_003`: Download interrupted

#### Security Errors
- `E_SECURITY_001`: Encryption error
- `E_SECURITY_002`: Decryption failed
- `E_SECURITY_003`: Key management error
- `E_SECURITY_004`: Security violation

#### Database Errors
- `E_DATABASE_001`: Database error
- `E_DATABASE_002`: Migration error
- `E_DATABASE_003`: Database corruption

#### Server Errors
- `E_SERVER_001`: Server error
- `E_SERVER_002`: Invalid range
- `E_SERVER_003`: Stream not available

### 4. Error Severity Levels

Errors are logged at different severity levels:

- **Error Level**: Most errors (logged as errors in tracing system)
- **Warning Level**: Expected errors like cache TTL expiration, rate limiting, content not found

### 5. Error Analytics

The system provides comprehensive error analytics:

- **Total Error Count**: Total number of errors logged
- **Unresolved Error Count**: Number of errors not yet resolved
- **Errors by Category**: Breakdown of errors by category
- **Most Common Error**: The most frequently occurring error type
- **Recent Errors**: List of recent errors (configurable limit)

### 6. Error Resolution Tracking

Errors can be marked as resolved, allowing tracking of:

- Which errors have been addressed
- Which errors are still outstanding
- Historical error patterns

### 7. Database Persistence

All errors are persisted in the SQLite database in the `error_logs` table:

```sql
CREATE TABLE error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    error_type TEXT NOT NULL,
    error_code TEXT,
    message TEXT NOT NULL,
    context TEXT,
    stack_trace TEXT,
    user_action TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    timestamp INTEGER NOT NULL
);
```

Indexes are created for efficient querying:

```sql
CREATE INDEX idx_error_logs_type ON error_logs(error_type, timestamp DESC);
CREATE INDEX idx_error_logs_resolved ON error_logs(resolved, timestamp DESC);
```

### 8. Integration with Diagnostics

Error statistics are automatically included in the diagnostics system, providing:

- Error counts and categories in diagnostics reports
- Recent error history
- Unresolved error tracking

### 9. Automatic Cleanup

Old resolved errors can be automatically cleaned up to prevent database bloat:

- Configurable retention period (default: keep errors for specified days)
- Only resolved errors are cleaned up
- Unresolved errors are never automatically deleted

## Usage

### Basic Error Logging

```rust
use crate::error_logging::{log_error_simple, ErrorContext};

// Simple error logging
let error = KiyyaError::gateway_error("Gateway timeout");
log_error_simple(&db, &error).await?;
```

### Error Logging with Context

```rust
use crate::error_logging::{log_error, ErrorContext};

// Log error with additional context
let error = KiyyaError::download_error("Download failed");
let context = ErrorContext::new()
    .with_user_action("Downloading video")
    .with_context("claim_id", "abc123")
    .with_context("quality", "1080p");

log_error(&db, &error, context).await?;
```

### Retrieving Recent Errors

```rust
use crate::error_logging::get_recent_errors;

// Get last 10 unresolved errors
let errors = get_recent_errors(&db, 10, false).await?;

// Get last 20 errors (including resolved)
let all_errors = get_recent_errors(&db, 20, true).await?;
```

### Getting Error Statistics

```rust
use crate::error_logging::get_error_stats;

let stats = get_error_stats(&db).await?;
println!("Total errors: {}", stats.total_errors);
println!("Unresolved: {}", stats.unresolved_errors);
println!("Most common: {:?}", stats.most_common_error);

for (category, count) in stats.errors_by_category {
    println!("{}: {}", category, count);
}
```

### Marking Errors as Resolved

```rust
use crate::error_logging::mark_error_resolved;

// Mark a specific error as resolved
mark_error_resolved(&db, error_id).await?;
```

### Cleaning Up Old Errors

```rust
use crate::error_logging::cleanup_old_errors;

// Remove resolved errors older than 30 days
let deleted_count = cleanup_old_errors(&db, 30).await?;
println!("Cleaned up {} old errors", deleted_count);
```

### Extension Functions for Automatic Logging

Instead of an extension trait, standalone functions are provided for convenience:

```rust
use crate::error_logging::{log_result_error, log_result_error_simple};

// Automatically log errors in Result chains
let result = some_operation().await;
let result = log_result_error_simple(result, &db).await;

// With context
let result = some_operation().await;
let context = ErrorContext::new().with_user_action("Performing operation");
let result = log_result_error(result, &db, context).await;
```

## Integration Points

### 1. Logging System Integration

The error logging system integrates with the existing tracing-based logging system:

- Errors are logged to both the database and the tracing system
- Log files contain structured error information
- Error severity levels are respected (error vs warning)

### 2. Diagnostics Integration

Error statistics are automatically included in diagnostics reports:

```rust
// In diagnostics.rs
let error_stats = error_logging::get_error_stats(db).await.ok();

Ok(DiagnosticsData {
    // ... other fields
    error_stats,
})
```

### 3. Database Integration

The error logging system uses the database's generic SQL execution methods:

- `execute_sql`: For INSERT, UPDATE, DELETE operations
- `query_sql`: For SELECT operations returning multiple rows
- `query_one_sql`: For SELECT operations returning a single value

## Testing

Comprehensive tests are provided in `src-tauri/src/error_logging_test.rs`:

- `test_log_error_with_context`: Tests error logging with context
- `test_log_error_simple`: Tests simple error logging
- `test_error_stats`: Tests error statistics calculation
- `test_mark_resolved`: Tests error resolution tracking
- `test_cleanup_old_errors`: Tests automatic cleanup
- `test_error_categorization`: Tests error categorization

Run tests with:

```bash
cargo test --package kiyya-desktop error_logging
```

## Performance Considerations

### 1. Asynchronous Operations

All database operations are asynchronous and non-blocking:

- Uses `tokio::task::spawn_blocking` for database operations
- Does not block the main application thread
- Suitable for high-frequency error logging

### 2. Indexed Queries

Database queries are optimized with indexes:

- `idx_error_logs_type`: For filtering by error type
- `idx_error_logs_resolved`: For filtering by resolution status

### 3. Batch Operations

For high-volume scenarios, consider:

- Batching error logs before writing to database
- Using transactions for multiple error logs
- Implementing a background worker for error logging

### 4. Cleanup Strategy

Regular cleanup prevents database bloat:

- Schedule cleanup during low-usage periods
- Keep unresolved errors indefinitely
- Configure retention period based on storage constraints

## Security Considerations

### 1. Sensitive Information

The error logging system is designed to avoid logging sensitive information:

- No API tokens or secrets in error messages
- No user passwords or encryption keys
- Context should not include PII unless necessary

### 2. Error Message Sanitization

Error messages are sanitized before logging:

- User-facing messages are generic
- Detailed technical information is logged separately
- Stack traces are optional and can be disabled in production

### 3. Access Control

Error logs should be protected:

- Only accessible through the Tauri command interface
- Not exposed to the frontend without authentication
- Diagnostic reports should be generated on-demand

## Future Enhancements

### 1. Error Aggregation

Group similar errors to reduce noise:

- Aggregate errors by type and message
- Track occurrence count
- Show first and last occurrence timestamps

### 2. Error Notifications

Notify users of critical errors:

- Toast notifications for user-actionable errors
- Silent logging for internal errors
- Configurable notification thresholds

### 3. Error Reporting

Allow users to submit error reports:

- Generate error report packages
- Include recent errors and diagnostics
- Sanitize sensitive information before submission

### 4. Error Trends

Track error trends over time:

- Error frequency graphs
- Category distribution charts
- Resolution time metrics

### 5. Automatic Error Resolution

Implement automatic resolution for certain error types:

- Mark transient errors as resolved after successful retry
- Auto-resolve errors after system recovery
- Track resolution patterns

## Conclusion

The comprehensive error logging system provides robust error tracking, categorization, and analytics for the Kiyya desktop streaming application. It integrates seamlessly with the existing logging and diagnostics systems while providing detailed error information for debugging and monitoring.

The system is designed to be:

- **Comprehensive**: Captures all relevant error information
- **Performant**: Asynchronous and non-blocking
- **Maintainable**: Clean API and well-tested
- **Extensible**: Easy to add new error types and categories
- **Integrated**: Works with existing systems

This implementation satisfies the requirements for comprehensive error logging as specified in Phase 11, Task 11.1 of the implementation plan.
