//! Tests for comprehensive error logging system

use crate::database::Database;
use crate::error::KiyyaError;
use crate::error_logging::{
    cleanup_old_errors, get_error_stats, get_recent_errors, log_error, log_error_simple,
    mark_error_resolved, ErrorContext,
};
use std::sync::Arc;
use tempfile::TempDir;
use tokio::sync::Mutex;

// Use a global lock to prevent parallel test execution that causes database conflicts
static TEST_LOCK: once_cell::sync::Lazy<Arc<Mutex<()>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(())));

async fn create_test_db() -> (Database, TempDir, tokio::sync::MutexGuard<'static, ()>) {
    let lock = TEST_LOCK.lock().await;

    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let db_path = temp_dir.path().join("test.db");

    // Clean up any existing files
    let _ = std::fs::remove_file(&db_path);
    let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
    let _ = std::fs::remove_file(db_path.with_extension("db-wal"));

    let db = Database::new_with_path(&db_path)
        .await
        .expect("Failed to create database");
    db.run_migrations().await.expect("Failed to run migrations");
    (db, temp_dir, lock)
}

#[tokio::test]
async fn test_log_error_with_context() {
    let (db, _temp_dir, _lock) = create_test_db().await;

    let error = KiyyaError::gateway_error("Test gateway error");
    let context = ErrorContext::new()
        .with_user_action("Testing error logging")
        .with_context("test_key", "test_value");

    let result = log_error(&db, &error, context).await;
    assert!(result.is_ok(), "Failed to log error: {:?}", result.err());

    // Verify error was logged
    let recent_errors = get_recent_errors(&db, 10, true).await.unwrap();
    assert_eq!(recent_errors.len(), 1);
    assert_eq!(recent_errors[0].error_type, "network");
    assert_eq!(
        recent_errors[0].user_action,
        Some("Testing error logging".to_string())
    );
}

#[tokio::test]
async fn test_log_error_simple() {
    let (db, _temp_dir, _lock) = create_test_db().await;

    let error = KiyyaError::download_error("Test download error");
    let result = log_error_simple(&db, &error).await;
    assert!(result.is_ok());

    let recent_errors = get_recent_errors(&db, 10, true).await.unwrap();
    assert_eq!(recent_errors.len(), 1);
    assert_eq!(recent_errors[0].error_type, "download");
}

#[tokio::test]
async fn test_error_stats() {
    let (db, _temp_dir, _lock) = create_test_db().await;

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
    let (db, _temp_dir, _lock) = create_test_db().await;

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
    let (db, _temp_dir, _lock) = create_test_db().await;

    // Log and resolve some errors with old timestamps
    for i in 0..5 {
        let error = KiyyaError::gateway_error(format!("Old error {}", i));
        log_error_simple(&db, &error).await.unwrap();
    }

    // Mark all as resolved
    let errors = get_recent_errors(&db, 10, true).await.unwrap();
    for error in errors {
        mark_error_resolved(&db, error.id).await.unwrap();
    }

    // Wait a moment to ensure timestamps are in the past
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    // Cleanup should remove resolved errors older than 0 days (all of them)
    let deleted = cleanup_old_errors(&db, 0).await.unwrap();
    assert_eq!(deleted, 5);

    let remaining = get_recent_errors(&db, 10, true).await.unwrap();
    assert_eq!(remaining.len(), 0);
}

#[tokio::test]
async fn test_error_categorization() {
    let (db, _temp_dir, _lock) = create_test_db().await;

    // Test different error categories
    let errors = vec![
        KiyyaError::gateway_error("gateway"),
        KiyyaError::download_error("download"),
        KiyyaError::encryption_error("encryption"),
        KiyyaError::content_parsing_error("parsing"),
    ];

    for error in errors {
        log_error_simple(&db, &error).await.unwrap();
    }

    let stats = get_error_stats(&db).await.unwrap();
    assert_eq!(stats.total_errors, 4);
    assert!(stats.errors_by_category.contains_key("network"));
    assert!(stats.errors_by_category.contains_key("download"));
    assert!(stats.errors_by_category.contains_key("security"));
    assert!(stats.errors_by_category.contains_key("content"));
}
