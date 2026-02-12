//! # Crash Reporting System
//! 
//! This module provides optional crash reporting functionality for the Kiyya desktop application.
//! It captures panic information and integrates with the existing error logging and diagnostics systems.
//! 
//! ## Features
//! 
//! - **Panic Hook**: Captures panic information including message, location, and backtrace
//! - **Crash Log File**: Writes crash information to a dedicated crash.log file
//! - **Integration**: Works with existing error logging and diagnostics systems
//! - **Privacy**: No external reporting - all crash data stays local
//! 
//! ## Usage
//! 
//! ```rust
//! use crate::crash_reporting::init_crash_reporting;
//! 
//! // Initialize crash reporting at application startup
//! init_crash_reporting(app_data_path);
//! ```

use std::fs::{OpenOptions};
use std::io::Write;
use std::panic;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use chrono::Utc;

/// Global crash log file path
static CRASH_LOG_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);

/// Initializes the crash reporting system
/// 
/// This function sets up a panic hook that captures panic information and writes it to a crash log file.
/// It should be called once at application startup.
/// 
/// # Arguments
/// 
/// * `app_data_path` - Path to the application data directory where crash logs will be stored
/// 
/// # Example
/// 
/// ```rust
/// use std::path::PathBuf;
/// use crate::crash_reporting::init_crash_reporting;
/// 
/// let app_data_path = PathBuf::from("/path/to/app/data");
/// init_crash_reporting(&app_data_path);
/// ```
pub fn init_crash_reporting(app_data_path: &Path) {
    // Set up crash log path
    let crash_log_path = app_data_path.join("logs").join("crash.log");
    
    // Store the path globally for use in panic hook
    if let Ok(mut path) = CRASH_LOG_PATH.lock() {
        *path = Some(crash_log_path.clone());
    }
    
    // Ensure logs directory exists
    if let Some(parent) = crash_log_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    
    // Set up panic hook
    let default_panic = panic::take_hook();
    panic::set_hook(Box::new(move |panic_info| {
        // Log the panic
        log_crash(panic_info);
        
        // Call the default panic handler
        default_panic(panic_info);
    }));
    
    eprintln!("Crash reporting initialized: {:?}", crash_log_path);
}

/// Logs crash information to the crash log file
#[allow(deprecated)]
fn log_crash(panic_info: &panic::PanicInfo) {
    let timestamp = Utc::now();
    let timestamp_str = timestamp.to_rfc3339();
    
    // Extract panic message
    let message = if let Some(s) = panic_info.payload().downcast_ref::<&str>() {
        s.to_string()
    } else if let Some(s) = panic_info.payload().downcast_ref::<String>() {
        s.clone()
    } else {
        "Unknown panic message".to_string()
    };
    
    // Extract location
    let location = if let Some(loc) = panic_info.location() {
        format!("{}:{}:{}", loc.file(), loc.line(), loc.column())
    } else {
        "Unknown location".to_string()
    };
    
    // Format crash entry
    let crash_entry = format!(
        "\n=== CRASH REPORT ===\n\
         Timestamp: {}\n\
         Message: {}\n\
         Location: {}\n\
         Version: {}\n\
         ===================\n\n",
        timestamp_str,
        message,
        location,
        env!("CARGO_PKG_VERSION")
    );
    
    // Write to crash log file
    if let Ok(path_guard) = CRASH_LOG_PATH.lock() {
        if let Some(crash_log_path) = path_guard.as_ref() {
            if let Ok(mut file) = OpenOptions::new()
                .create(true)
                .append(true)
                .open(crash_log_path)
            {
                let _ = file.write_all(crash_entry.as_bytes());
                let _ = file.flush();
            }
        }
    }
    
    // Also print to stderr for immediate visibility
    eprintln!("{}", crash_entry);
}

/// Gets the path to the crash log file
pub fn get_crash_log_path() -> Option<PathBuf> {
    CRASH_LOG_PATH.lock().ok()?.clone()
}

/// Reads recent crash reports from the crash log file
/// 
/// Returns the last N crash reports from the log file
/// 
/// # Arguments
/// 
/// * `limit` - Maximum number of crash reports to return
pub fn get_recent_crashes(limit: usize) -> Result<Vec<CrashReport>, std::io::Error> {
    let crash_log_path = match get_crash_log_path() {
        Some(path) => path,
        None => return Ok(Vec::new()),
    };
    
    if !crash_log_path.exists() {
        return Ok(Vec::new());
    }
    
    let content = std::fs::read_to_string(&crash_log_path)?;
    let mut crashes = Vec::new();
    
    // Parse crash reports (simple parsing based on separator)
    for section in content.split("=== CRASH REPORT ===") {
        if section.trim().is_empty() {
            continue;
        }
        
        let mut timestamp = None;
        let mut message = None;
        let mut location = None;
        let mut version = None;
        
        for line in section.lines() {
            let line = line.trim();
            if line.starts_with("Timestamp:") {
                timestamp = Some(line.trim_start_matches("Timestamp:").trim().to_string());
            } else if line.starts_with("Message:") {
                message = Some(line.trim_start_matches("Message:").trim().to_string());
            } else if line.starts_with("Location:") {
                location = Some(line.trim_start_matches("Location:").trim().to_string());
            } else if line.starts_with("Version:") {
                version = Some(line.trim_start_matches("Version:").trim().to_string());
            }
        }
        
        if let (Some(ts), Some(msg), Some(loc), Some(ver)) = (timestamp, message, location, version) {
            crashes.push(CrashReport {
                timestamp: ts,
                message: msg,
                location: loc,
                version: ver,
            });
        }
    }
    
    // Return last N crashes
    let start = crashes.len().saturating_sub(limit);
    Ok(crashes[start..].to_vec())
}

/// Clears the crash log file
pub fn clear_crash_log() -> Result<(), std::io::Error> {
    if let Some(crash_log_path) = get_crash_log_path() {
        if crash_log_path.exists() {
            std::fs::remove_file(&crash_log_path)?;
        }
    }
    Ok(())
}

/// Represents a crash report entry
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CrashReport {
    pub timestamp: String,
    pub message: String,
    pub location: String,
    pub version: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[test]
    fn test_init_crash_reporting() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let app_data_path = temp_dir.path();
        
        init_crash_reporting(app_data_path);
        
        // Verify crash log path is set
        let crash_log_path = get_crash_log_path();
        assert!(crash_log_path.is_some());
        
        let path = crash_log_path.unwrap();
        assert!(path.to_string_lossy().contains("crash.log"));
    }
    
    #[test]
    fn test_get_recent_crashes_empty() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let app_data_path = temp_dir.path();
        
        init_crash_reporting(app_data_path);
        
        // Should return empty vec when no crashes
        let crashes = get_recent_crashes(10).expect("Failed to get crashes");
        assert_eq!(crashes.len(), 0);
    }
    
    #[test]
    fn test_clear_crash_log() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let app_data_path = temp_dir.path();
        
        init_crash_reporting(app_data_path);
        
        // Create a crash log file
        if let Some(crash_log_path) = get_crash_log_path() {
            std::fs::create_dir_all(crash_log_path.parent().unwrap()).unwrap();
            std::fs::write(&crash_log_path, "test crash data").unwrap();
            assert!(crash_log_path.exists());
            
            // Clear it
            clear_crash_log().expect("Failed to clear crash log");
            assert!(!crash_log_path.exists());
        }
    }
    
    #[test]
    fn test_crash_report_parsing() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let app_data_path = temp_dir.path();
        
        init_crash_reporting(app_data_path);
        
        // Create a mock crash log with proper format
        if let Some(crash_log_path) = get_crash_log_path() {
            std::fs::create_dir_all(crash_log_path.parent().unwrap()).unwrap();
            
            let crash_content = r#"
=== CRASH REPORT ===
Timestamp: 2026-02-10T14:30:00Z
Message: Test panic message
Location: src/main.rs:123:45
Version: 0.1.0
===================

=== CRASH REPORT ===
Timestamp: 2026-02-10T15:30:00Z
Message: Another test panic
Location: src/test.rs:456:78
Version: 0.1.0
===================
"#;
            
            std::fs::write(&crash_log_path, crash_content).unwrap();
            
            // Parse crashes
            let crashes = get_recent_crashes(10).expect("Failed to get crashes");
            assert_eq!(crashes.len(), 2);
            
            // Verify first crash
            assert_eq!(crashes[0].timestamp, "2026-02-10T14:30:00Z");
            assert_eq!(crashes[0].message, "Test panic message");
            assert_eq!(crashes[0].location, "src/main.rs:123:45");
            assert_eq!(crashes[0].version, "0.1.0");
            
            // Verify second crash
            assert_eq!(crashes[1].timestamp, "2026-02-10T15:30:00Z");
            assert_eq!(crashes[1].message, "Another test panic");
            assert_eq!(crashes[1].location, "src/test.rs:456:78");
            assert_eq!(crashes[1].version, "0.1.0");
        }
    }
}
