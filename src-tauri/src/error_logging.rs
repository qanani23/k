//! # Comprehensive Error Logging System
//! 
//! This module provides comprehensive error logging capabilities for the Kiyya desktop application.
//! It integrates with the existing logging infrastructure and database to provide:
//! 
//! - Structured error logging with context and stack traces
//! - Error categorization and severity levels
//! - Database persistence for error history
//! - Error metrics and analytics
//! - User-friendly error reporting
//! 
//! ## Features
//! 
//! - **Automatic Error Capture**: Captures errors from all application components
//! - **Context Preservation**: Stores error context, user actions, and stack traces
//! - **Error Resolution Tracking**: Tracks which errors have been resolved
//! - **Error Analytics**: Provides metrics on error frequency and patterns
//! - **Integration with Diagnostics**: Errors are available in diagnostics reports
//! 
//! ## Usage
//! 
//! ```rust
//! use crate::error_logging::{log_error, ErrorContext};
//! 
//! // Log an error with context
//! log_error(
//!     &error,
//!     ErrorContext::new()
//!         .with_user_action("Attempting to download video")
//!         .with_context("claim_id", "abc123")
//! ).await?;
//! ```

use crate::error::{KiyyaError, Result};
use crate::database::Database;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{error, warn, info};

/// Error logging context for capturing additional information
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ErrorContext {
    /// User action that triggered the error
    pub user_action: Option<String>,
    /// Additional context key-value pairs
    pub context: HashMap<String, String>,
    /// Stack trace if available
    pub stack_trace: Option<String>,
}

impl ErrorContext {
    /// Creates a new empty error context
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Sets the user action that triggered the error
    pub fn with_user_action(mut self, action: impl Into<String>) -> Self {
        self.user_action = Some(action.into());
        self
    }
    
    /// Adds a context key-value pair
    pub fn with_context(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.context.insert(key.into(), value.into());
        self
    }
    
    /// Sets the stack trace
    pub fn with_stack_trace(mut self, trace: impl Into<String>) -> Self {
        self.stack_trace = Some(trace.into());
        self
    }
    
    /// Converts context to JSON string for storage
    fn to_json(&self) -> String {
        serde_json::to_string(&self.context).unwrap_or_else(|_| "{}".to_string())
    }
}

/// Error log entry stored in the database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorLogEntry {
    pub id: i64,
    pub error_type: String,
    pub error_code: Option<String>,
    pub message: String,
    pub context: Option<String>,
    pub stack_trace: Option<String>,
    pub user_action: Option<String>,
    pub resolved: bool,
    pub timestamp: i64,
}

/// Error statistics for analytics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorStats {
    pub total_errors: u64,
    pub errors_by_category: HashMap<String, u64>,
    pub recent_errors: Vec<ErrorLogEntry>,
    pub unresolved_errors: u64,
    pub most_common_error: Option<String>,
}

/// Logs an error to the database and logging system
/// 
/// This function captures comprehensive error information including:
/// - Error type and category
/// - Error message and code
/// - User action that triggered the error
/// - Additional context
/// - Stack trace if available
/// 
/// # Arguments
/// 
/// * `db` - Database connection
/// * `error` - The error to log
/// * `context` - Additional context about the error
/// 
/// # Returns
/// 
/// Returns Ok(()) if the error was logged successfully, or an error if logging failed
pub async fn log_error(
    db: &Database,
    error: &KiyyaError,
    context: ErrorContext,
) -> Result<()> {
    let error_type = error.category();
    let error_code = get_error_code(error);
    let message = error.to_string();
    let user_message = error.user_message();
    let timestamp = chrono::Utc::now().timestamp();
    
    // Log to tracing system based on severity
    if error.is_warning_level() {
        warn!(
            error_type = error_type,
            error_code = ?error_code,
            message = %message,
            user_action = ?context.user_action,
            "Error logged (warning level)"
        );
    } else {
        error!(
            error_type = error_type,
            error_code = ?error_code,
            message = %message,
            user_action = ?context.user_action,
            "Error logged (error level)"
        );
    }
    
    // Store in database for persistence and analytics
    use rusqlite::types::Value;
    db.execute_sql(
        r#"
        INSERT INTO error_logs (
            error_type,
            error_code,
            message,
            context,
            stack_trace,
            user_action,
            resolved,
            timestamp
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        "#,
        vec![
            Value::Text(error_type.to_string()),
            error_code.map(Value::Text).unwrap_or(Value::Null),
            Value::Text(message),
            Value::Text(context.to_json()),
            context.stack_trace.map(Value::Text).unwrap_or(Value::Null),
            context.user_action.map(Value::Text).unwrap_or(Value::Null),
            Value::Integer(0), // Initially unresolved
            Value::Integer(timestamp),
        ],
    ).await?;
    
    info!(
        error_type = error_type,
        user_message = %user_message,
        "Error logged to database"
    );
    
    Ok(())
}

/// Logs an error with automatic context capture
/// 
/// This is a convenience function that captures the current context automatically
pub async fn log_error_simple(db: &Database, error: &KiyyaError) -> Result<()> {
    log_error(db, error, ErrorContext::new()).await
}

/// Marks an error as resolved in the database
pub async fn mark_error_resolved(db: &Database, error_id: i64) -> Result<()> {
    use rusqlite::types::Value;
    db.execute_sql(
        "UPDATE error_logs SET resolved = TRUE WHERE id = ?1",
        vec![Value::Integer(error_id)],
    ).await?;
    
    info!(error_id = error_id, "Error marked as resolved");
    Ok(())
}

/// Gets recent error logs from the database
/// 
/// # Arguments
/// 
/// * `db` - Database connection
/// * `limit` - Maximum number of errors to retrieve
/// * `include_resolved` - Whether to include resolved errors
pub async fn get_recent_errors(
    db: &Database,
    limit: u32,
    include_resolved: bool,
) -> Result<Vec<ErrorLogEntry>> {
    use rusqlite::types::Value;
    
    let query = if include_resolved {
        "SELECT id, error_type, error_code, message, context, stack_trace, user_action, resolved, timestamp 
         FROM error_logs 
         ORDER BY timestamp DESC 
         LIMIT ?1"
    } else {
        "SELECT id, error_type, error_code, message, context, stack_trace, user_action, resolved, timestamp 
         FROM error_logs 
         WHERE resolved = 0 
         ORDER BY timestamp DESC 
         LIMIT ?1"
    };
    
    let rows = db.query_sql(query, vec![Value::Integer(limit as i64)]).await?;
    
    let mut errors = Vec::new();
    for row in rows {
        errors.push(ErrorLogEntry {
            id: match row.get("id") {
                Some(Value::Integer(v)) => *v,
                _ => continue,
            },
            error_type: match row.get("error_type") {
                Some(Value::Text(v)) => v.clone(),
                _ => continue,
            },
            error_code: match row.get("error_code") {
                Some(Value::Text(v)) => Some(v.clone()),
                _ => None,
            },
            message: match row.get("message") {
                Some(Value::Text(v)) => v.clone(),
                _ => continue,
            },
            context: match row.get("context") {
                Some(Value::Text(v)) => Some(v.clone()),
                _ => None,
            },
            stack_trace: match row.get("stack_trace") {
                Some(Value::Text(v)) => Some(v.clone()),
                _ => None,
            },
            user_action: match row.get("user_action") {
                Some(Value::Text(v)) => Some(v.clone()),
                _ => None,
            },
            resolved: match row.get("resolved") {
                Some(Value::Integer(v)) => *v != 0,
                _ => false,
            },
            timestamp: match row.get("timestamp") {
                Some(Value::Integer(v)) => *v,
                _ => continue,
            },
        });
    }
    
    Ok(errors)
}

/// Gets error statistics for analytics
pub async fn get_error_stats(db: &Database) -> Result<ErrorStats> {
    use rusqlite::types::Value;
    
    // Get total error count
    let total_errors: u64 = db.query_one_sql::<i64>(
        "SELECT COUNT(*) FROM error_logs",
        vec![],
    ).await?.unwrap_or(0) as u64;
    
    // Get unresolved error count
    let unresolved_errors: u64 = db.query_one_sql::<i64>(
        "SELECT COUNT(*) FROM error_logs WHERE resolved = 0",
        vec![],
    ).await?.unwrap_or(0) as u64;
    
    // Get errors by category
    let category_rows = db.query_sql(
        "SELECT error_type, COUNT(*) as count FROM error_logs GROUP BY error_type ORDER BY count DESC",
        vec![],
    ).await?;
    
    let mut errors_by_category = HashMap::new();
    let mut most_common_error = None;
    let mut max_count = 0u64;
    
    for row in category_rows {
        let error_type = match row.get("error_type") {
            Some(Value::Text(v)) => v.clone(),
            _ => continue,
        };
        let count = match row.get("count") {
            Some(Value::Integer(v)) => *v as u64,
            _ => continue,
        };
        
        if count > max_count {
            max_count = count;
            most_common_error = Some(error_type.clone());
        }
        
        errors_by_category.insert(error_type, count);
    }
    
    // Get recent errors (last 10)
    let recent_errors = get_recent_errors(db, 10, true).await?;
    
    Ok(ErrorStats {
        total_errors,
        errors_by_category,
        recent_errors,
        unresolved_errors,
        most_common_error,
    })
}

/// Cleans up old error logs from the database
/// 
/// Removes error logs older than the specified number of days
pub async fn cleanup_old_errors(db: &Database, days_to_keep: u32) -> Result<u64> {
    use rusqlite::types::Value;
    
    let cutoff_timestamp = chrono::Utc::now().timestamp() - (days_to_keep as i64 * 86400);
    
    let deleted_count = db.execute_sql(
        "DELETE FROM error_logs WHERE timestamp < ?1 AND resolved = 1",
        vec![Value::Integer(cutoff_timestamp)],
    ).await?;
    
    info!(
        deleted_count = deleted_count,
        days_to_keep = days_to_keep,
        "Cleaned up old error logs"
    );
    
    Ok(deleted_count)
}

/// Gets an error code for categorization
fn get_error_code(error: &KiyyaError) -> Option<String> {
    match error {
        KiyyaError::AllGatewaysFailed { .. } => Some("E_GATEWAY_001".to_string()),
        KiyyaError::Gateway { .. } => Some("E_GATEWAY_002".to_string()),
        KiyyaError::RateLimitExceeded { .. } => Some("E_GATEWAY_003".to_string()),
        KiyyaError::ApiTimeout { .. } => Some("E_GATEWAY_004".to_string()),
        
        KiyyaError::ContentNotFound { .. } => Some("E_CONTENT_001".to_string()),
        KiyyaError::ContentParsing { .. } => Some("E_CONTENT_002".to_string()),
        KiyyaError::InvalidContentFormat { .. } => Some("E_CONTENT_003".to_string()),
        KiyyaError::MissingRequiredField { .. } => Some("E_CONTENT_004".to_string()),
        
        KiyyaError::Download { .. } => Some("E_DOWNLOAD_001".to_string()),
        KiyyaError::InsufficientDiskSpace { .. } => Some("E_DOWNLOAD_002".to_string()),
        KiyyaError::DownloadInterrupted { .. } => Some("E_DOWNLOAD_003".to_string()),
        
        KiyyaError::Encryption { .. } => Some("E_SECURITY_001".to_string()),
        KiyyaError::DecryptionFailed { .. } => Some("E_SECURITY_002".to_string()),
        KiyyaError::KeyManagement { .. } => Some("E_SECURITY_003".to_string()),
        KiyyaError::SecurityViolation { .. } => Some("E_SECURITY_004".to_string()),
        
        KiyyaError::Database(_) => Some("E_DATABASE_001".to_string()),
        KiyyaError::Migration { .. } => Some("E_DATABASE_002".to_string()),
        KiyyaError::DatabaseCorruption { .. } => Some("E_DATABASE_003".to_string()),
        
        KiyyaError::Server { .. } => Some("E_SERVER_001".to_string()),
        KiyyaError::InvalidRange { .. } => Some("E_SERVER_002".to_string()),
        KiyyaError::StreamNotAvailable { .. } => Some("E_SERVER_003".to_string()),
        
        _ => None,
    }
}

/// Logs an error from a Result if it's an Err, returns the result unchanged
/// 
/// This is a convenience function for logging errors in Result chains
pub async fn log_result_error<T>(
    result: Result<T>,
    db: &Database,
    context: ErrorContext,
) -> Result<T> {
    if let Err(ref error) = result {
        // Log the error but don't fail if logging fails
        let _ = log_error(db, error, context).await;
    }
    result
}

/// Logs an error from a Result with simple context if it's an Err
pub async fn log_result_error_simple<T>(
    result: Result<T>,
    db: &Database,
) -> Result<T> {
    if let Err(ref error) = result {
        // Log the error but don't fail if logging fails
        let _ = log_error_simple(db, error).await;
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::Database;
    use tempfile::TempDir;
    
    async fn create_test_db() -> (Database, TempDir) {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test.db");
        let db = Database::new(&db_path).await.expect("Failed to create database");
        db.run_migrations().await.expect("Failed to run migrations");
        (db, temp_dir)
    }
    
    #[tokio::test]
    async fn test_log_error() {
        let (db, _temp_dir) = create_test_db().await;
        
        let error = KiyyaError::gateway_error("Test gateway error");
        let context = ErrorContext::new()
            .with_user_action("Testing error logging")
            .with_context("test_key", "test_value");
        
        let result = log_error(&db, &error, context).await;
        assert!(result.is_ok());
        
        // Verify error was logged
        let recent_errors = get_recent_errors(&db, 10, true).await.unwrap();
        assert_eq!(recent_errors.len(), 1);
        assert_eq!(recent_errors[0].error_type, "network");
        assert_eq!(recent_errors[0].user_action, Some("Testing error logging".to_string()));
    }
    
    #[tokio::test]
    async fn test_error_stats() {
        let (db, _temp_dir) = create_test_db().await;
        
        // Log multiple errors
        for i in 0..5 {
            let error = KiyyaError::gateway_error(format!("Error {}", i));
            log_error_simple(&db, &error).await.unwrap();
        }
        
        for i in 0..3 {
            let error = KiyyaError::download_error(format!("Download error {}", i));
            log_error_simple(&db, &error).await.unwrap();
        }
        
        let stats = get_error_stats(&db).await.unwrap();
        assert_eq!(stats.total_errors, 8);
        assert_eq!(stats.unresolved_errors, 8);
        assert_eq!(stats.errors_by_category.get("network"), Some(&5));
        assert_eq!(stats.errors_by_category.get("download"), Some(&3));
        assert_eq!(stats.most_common_error, Some("network".to_string()));
    }
    
    #[tokio::test]
    async fn test_mark_resolved() {
        let (db, _temp_dir) = create_test_db().await;
        
        let error = KiyyaError::gateway_error("Test error");
        log_error_simple(&db, &error).await.unwrap();
        
        let errors = get_recent_errors(&db, 10, false).await.unwrap();
        assert_eq!(errors.len(), 1);
        
        let error_id = errors[0].id;
        mark_error_resolved(&db, error_id).await.unwrap();
        
        let unresolved = get_recent_errors(&db, 10, false).await.unwrap();
        assert_eq!(unresolved.len(), 0);
        
        let all_errors = get_recent_errors(&db, 10, true).await.unwrap();
        assert_eq!(all_errors.len(), 1);
        assert!(all_errors[0].resolved);
    }
    
    #[tokio::test]
    async fn test_cleanup_old_errors() {
        let (db, _temp_dir) = create_test_db().await;
        
        // Log and resolve some errors
        for i in 0..5 {
            let error = KiyyaError::gateway_error(format!("Old error {}", i));
            log_error_simple(&db, &error).await.unwrap();
        }
        
        // Mark all as resolved
        let errors = get_recent_errors(&db, 10, true).await.unwrap();
        for error in errors {
            mark_error_resolved(&db, error.id).await.unwrap();
        }
        
        // Cleanup should remove resolved errors older than 0 days (all of them)
        let deleted = cleanup_old_errors(&db, 0).await.unwrap();
        assert_eq!(deleted, 5);
        
        let remaining = get_recent_errors(&db, 10, true).await.unwrap();
        assert_eq!(remaining.len(), 0);
    }
    
    #[tokio::test]
    async fn test_error_codes() {
        assert_eq!(get_error_code(&KiyyaError::AllGatewaysFailed { attempts: 3 }), Some("E_GATEWAY_001".to_string()));
        assert_eq!(get_error_code(&KiyyaError::gateway_error("test")), Some("E_GATEWAY_002".to_string()));
        assert_eq!(get_error_code(&KiyyaError::download_error("test")), Some("E_DOWNLOAD_001".to_string()));
        assert_eq!(get_error_code(&KiyyaError::encryption_error("test")), Some("E_SECURITY_001".to_string()));
    }
}
