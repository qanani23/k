//! # Logging System with File Rotation
//! 
//! This module provides a comprehensive logging system for the Kiyya desktop application
//! with the following features:
//! 
//! ## Features
//! - **File Rotation**: Daily log file rotation using `tracing-appender`
//! - **Multiple Outputs**: Console logging for development, file logging for production
//! - **Structured Logging**: JSON format for file logs, human-readable for console
//! - **Configurable Levels**: Support for RUST_LOG environment variable
//! - **Cross-Platform**: Works on Windows, macOS, and Linux
//! 
//! ## Usage
//! 
//! ### Basic Initialization
//! ```rust
//! use crate::logging::init_logging;
//! 
//! // Initialize with default settings
//! init_logging().expect("Failed to initialize logging");
//! 
//! // Now you can use tracing macros
//! tracing::info!("Application started");
//! tracing::error!("Something went wrong: {}", error);
//! ```
//! 
//! ### Custom Configuration
//! ```rust
//! use crate::logging::{init_logging_with_config, LoggingConfig};
//! 
//! let config = LoggingConfig {
//!     level: tracing::Level::DEBUG,
//!     enable_console: true,
//!     enable_file: true,
//!     log_dir: Some(PathBuf::from("/custom/log/path")),
//! };
//! 
//! init_logging_with_config(config).expect("Failed to initialize logging");
//! ```
//! 
//! ## Log File Location
//! 
//! Log files are stored in the application's data directory:
//! - **Windows**: `%APPDATA%\kiyya-desktop\logs\`
//! - **macOS**: `~/Library/Application Support/kiyya-desktop/logs/`
//! - **Linux**: `~/.local/share/kiyya-desktop/logs/`
//! 
//! Files are rotated daily with names like `kiyya.log.2024-01-15`.
//! 
//! ## Environment Variables
//! 
//! - `RUST_LOG`: Controls log level (e.g., `RUST_LOG=debug`)
//! - Supports module-specific levels: `RUST_LOG=kiyya_desktop::gateway=debug,info`

use crate::path_security;
use std::path::PathBuf;
use tracing_subscriber::{
    fmt::{self, writer::MakeWriterExt},
    layer::SubscriberExt,
    util::SubscriberInitExt,
    EnvFilter,
};
use tracing_appender::{non_blocking, rolling};

/// Initialize the logging system with file rotation
/// 
/// This function sets up:
/// - Console logging for development
/// - File logging with daily rotation
/// - Structured JSON logging for production
/// - Configurable log levels via RUST_LOG environment variable
pub fn init_logging() -> Result<(), Box<dyn std::error::Error>> {
    // Get the application data directory for log files
    let log_dir = get_log_directory()?;
    
    // Ensure log directory exists
    std::fs::create_dir_all(&log_dir)?;
    
    // Create file appender with daily rotation
    let file_appender = rolling::daily(&log_dir, "kiyya.log");
    let (file_writer, _guard) = non_blocking(file_appender);
    
    // Create console writer for development
    let (console_writer, _console_guard) = non_blocking(std::io::stdout());
    
    // Configure environment filter
    // Default to INFO level, but allow override via RUST_LOG
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));
    
    // Build the subscriber with multiple layers
    let subscriber = tracing_subscriber::registry()
        .with(env_filter)
        .with(
            // Console layer for development
            fmt::layer()
                .with_writer(console_writer.with_max_level(tracing::Level::DEBUG))
                .with_target(true)
                .with_thread_ids(true)
                .with_file(true)
                .with_line_number(true)
        )
        .with(
            // File layer with JSON formatting for structured logging
            fmt::layer()
                .json()
                .with_writer(file_writer)
                .with_target(true)
                .with_thread_ids(true)
                .with_file(true)
                .with_line_number(true)
        );
    
    // Initialize the global subscriber
    subscriber.init();
    
    // Log the initialization
    tracing::info!(
        log_dir = %log_dir.display(),
        "Logging system initialized with file rotation"
    );
    
    Ok(())
}

/// Get the appropriate directory for log files
/// 
/// Uses the application's data directory to store logs
/// Falls back to a temp directory if app data dir is not available
fn get_log_directory() -> Result<PathBuf, Box<dyn std::error::Error>> {
    // Use path_security module to get validated logs directory
    match path_security::validate_subdir_path("logs", "") {
        Ok(log_dir) => Ok(log_dir),
        Err(_) => {
            // Fallback to temp directory if path validation fails
            let temp_dir = std::env::temp_dir();
            Ok(temp_dir.join("kiyya-desktop-logs"))
        }
    }
}

/// Configure logging for different environments
pub struct LoggingConfig {
    pub level: tracing::Level,
    pub enable_console: bool,
    pub enable_file: bool,
    pub log_dir: Option<PathBuf>,
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            level: tracing::Level::INFO,
            enable_console: cfg!(debug_assertions),
            enable_file: true,
            log_dir: None,
        }
    }
}

/// Initialize logging with custom configuration
pub fn init_logging_with_config(config: LoggingConfig) -> Result<(), Box<dyn std::error::Error>> {
    let log_dir = config.log_dir
        .unwrap_or_else(|| get_log_directory().unwrap_or_else(|_| std::env::temp_dir()));
    
    // Ensure log directory exists
    std::fs::create_dir_all(&log_dir)?;
    
    // Configure environment filter
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(config.level.to_string().to_lowercase()));
    
    if config.enable_console && config.enable_file {
        // Both console and file logging
        let file_appender = rolling::daily(&log_dir, "kiyya.log");
        let (file_writer, _guard) = non_blocking(file_appender);
        let (console_writer, _console_guard) = non_blocking(std::io::stdout());
        
        tracing_subscriber::registry()
            .with(env_filter)
            .with(
                fmt::layer()
                    .with_writer(console_writer.with_max_level(config.level))
                    .with_target(true)
                    .with_thread_ids(true)
                    .with_file(true)
                    .with_line_number(true)
            )
            .with(
                fmt::layer()
                    .json()
                    .with_writer(file_writer)
                    .with_target(true)
                    .with_thread_ids(true)
                    .with_file(true)
                    .with_line_number(true)
            )
            .init();
    } else if config.enable_console {
        // Console only
        let (console_writer, _guard) = non_blocking(std::io::stdout());
        
        tracing_subscriber::registry()
            .with(env_filter)
            .with(
                fmt::layer()
                    .with_writer(console_writer.with_max_level(config.level))
                    .with_target(true)
                    .with_thread_ids(true)
                    .with_file(true)
                    .with_line_number(true)
            )
            .init();
    } else if config.enable_file {
        // File only
        let file_appender = rolling::daily(&log_dir, "kiyya.log");
        let (file_writer, _guard) = non_blocking(file_appender);
        
        tracing_subscriber::registry()
            .with(env_filter)
            .with(
                fmt::layer()
                    .json()
                    .with_writer(file_writer)
                    .with_target(true)
                    .with_thread_ids(true)
                    .with_file(true)
                    .with_line_number(true)
            )
            .init();
    } else {
        // No logging enabled - just use a basic subscriber
        tracing_subscriber::registry()
            .with(env_filter)
            .init();
    }
    
    tracing::info!(
        log_dir = %log_dir.display(),
        level = %config.level,
        console_enabled = config.enable_console,
        file_enabled = config.enable_file,
        "Logging system initialized with custom configuration"
    );
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;
    
    #[test]
    fn test_get_log_directory() {
        let log_dir = get_log_directory().expect("Should get log directory");
        // In test mode, it should be in temp directory or contain "logs"
        let log_str = log_dir.to_string_lossy();
        assert!(log_str.contains("logs") || log_str.contains("kiyya"));
    }
    
    #[test]
    fn test_logging_config_default() {
        let config = LoggingConfig::default();
        assert_eq!(config.level, tracing::Level::INFO);
        assert_eq!(config.enable_file, true);
        assert!(config.log_dir.is_none());
    }
    
    #[test]
    fn test_custom_log_directory() {
        let temp_dir = TempDir::new().expect("Should create temp dir");
        let custom_log_dir = temp_dir.path().join("custom_logs");
        
        let config = LoggingConfig {
            log_dir: Some(custom_log_dir.clone()),
            ..Default::default()
        };
        
        // This test just verifies the config structure
        assert_eq!(config.log_dir, Some(custom_log_dir));
    }
}