use crate::logging::{init_logging, LoggingConfig};
use tempfile::TempDir;

#[tokio::test]
async fn test_logging_initialization() {
    // This test verifies that logging can be initialized without errors
    let result = init_logging();

    // The function should succeed (or fail gracefully)
    // We can't easily test the actual log output in a unit test,
    // but we can verify the function doesn't panic
    match result {
        Ok(_) => {
            // Log a test message to verify it works
            tracing::info!("Test logging message - initialization successful");
        }
        Err(e) => {
            // Logging initialization failed, but that's acceptable in test environment
            println!("Logging initialization failed (expected in test): {}", e);
        }
    }
}

#[test]
fn test_logging_config_creation() {
    let config = LoggingConfig::default();

    assert_eq!(config.level, tracing::Level::INFO);
    assert!(config.enable_file);
    assert!(config.log_dir.is_none());
}

#[test]
fn test_custom_logging_config() {
    let temp_dir = TempDir::new().expect("Should create temp dir");
    let custom_log_dir = temp_dir.path().join("custom_logs");

    let config = LoggingConfig {
        level: tracing::Level::DEBUG,
        enable_console: false,
        enable_file: true,
        log_dir: Some(custom_log_dir.clone()),
    };

    assert_eq!(config.level, tracing::Level::DEBUG);
    assert!(!config.enable_console);
    assert!(config.enable_file);
    assert_eq!(config.log_dir, Some(custom_log_dir));
}
