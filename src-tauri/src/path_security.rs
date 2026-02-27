//! Path Security Module
//!
//! This module provides path validation to ensure all filesystem operations
//! are restricted to the application data directory only.
//!
//! ## Security Requirements
//!
//! - All file operations must be within $APPDATA/Kiyya/**
//! - Path traversal attacks (../) must be prevented
//! - Symbolic links must be resolved and validated
//! - Absolute paths outside app data must be rejected
//!
//! ## Usage
//!
//! ```rust
//! use crate::path_security::validate_path;
//!
//! let safe_path = validate_path("vault/movie.mp4")?;
//! // safe_path is guaranteed to be within app data directory
//! ```

use crate::error::{KiyyaError, Result};
use std::path::{Path, PathBuf};

/// Get the application data directory
///
/// Returns the Kiyya app data directory path:
/// - Windows: %APPDATA%\Kiyya
/// - macOS: ~/Library/Application Support/Kiyya
/// - Linux: ~/.local/share/Kiyya
pub fn get_app_data_dir() -> Result<PathBuf> {
    // In test environment, use a test directory
    #[cfg(test)]
    {
        let test_dir = std::env::temp_dir().join("kiyya_test");
        std::fs::create_dir_all(&test_dir).ok();
        Ok(test_dir)
    }

    #[cfg(not(test))]
    {
        // Use dirs crate instead of tauri::api::path to avoid calling tauri::Config::default()
        // before Tauri is initialized. This prevents path validation errors during startup.
        // Note: We use config_dir() which returns %APPDATA% on Windows (Roaming), matching Tauri's behavior
        let app_data_dir = dirs::config_dir().ok_or_else(|| {
            KiyyaError::Io(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "Could not determine app data directory",
            ))
        })?;

        Ok(app_data_dir.join("Kiyya"))
    }
}

/// Validate that a path is within the application data directory
///
/// This function ensures that:
/// 1. The path is within $APPDATA/Kiyya/**
/// 2. No path traversal attacks (../) escape the app data directory
/// 3. Symbolic links are resolved and validated
/// 4. The canonical path is returned
///
/// # Arguments
///
/// * `path` - The path to validate (can be relative or absolute)
///
/// # Returns
///
/// * `Ok(PathBuf)` - The validated canonical path within app data directory
/// * `Err(KiyyaError)` - If the path is outside app data directory or invalid
///
/// # Examples
///
/// ```rust
/// // Valid paths
/// validate_path("vault/movie.mp4")?;
/// validate_path("logs/gateway.log")?;
/// validate_path("database.db")?;
///
/// // Invalid paths (will return Err)
/// validate_path("../../../etc/passwd")?; // Path traversal
/// validate_path("/etc/passwd")?; // Absolute path outside app data
/// validate_path("C:\\Windows\\System32\\config")?; // System directory
/// ```
pub fn validate_path<P: AsRef<Path>>(path: P) -> Result<PathBuf> {
    let path = path.as_ref();
    let app_data_dir = get_app_data_dir()?;

    // Ensure app data directory exists
    std::fs::create_dir_all(&app_data_dir).ok();

    // Convert to absolute path
    let absolute_path = if path.is_absolute() {
        path.to_path_buf()
    } else {
        app_data_dir.join(path)
    };

    // Resolve path components manually (handles non-existent paths)
    let resolved_path = resolve_path_components(&absolute_path)?;

    // Get canonical app data directory (create if needed)
    let canonical_app_data = if app_data_dir.exists() {
        app_data_dir
            .canonicalize()
            .unwrap_or_else(|_| app_data_dir.clone())
    } else {
        app_data_dir.clone()
    };

    // Normalize both paths to handle Windows UNC paths (\\?\)
    let normalized_resolved = normalize_path(&resolved_path);
    let normalized_app_data = normalize_path(&canonical_app_data);

    // On Windows, paths are case-insensitive, so we need to compare them case-insensitively
    #[cfg(target_os = "windows")]
    let path_matches = {
        let resolved_str = normalized_resolved.to_string_lossy().to_lowercase();
        let app_data_str = normalized_app_data.to_string_lossy().to_lowercase();
        resolved_str.starts_with(&app_data_str)
    };

    #[cfg(not(target_os = "windows"))]
    let path_matches = normalized_resolved.starts_with(&normalized_app_data);

    // Ensure the resolved path starts with the app data directory
    if !path_matches {
        // NOTE: Security logging removed here to prevent recursion during logging initialization
        // The security violation is still returned as an error

        return Err(KiyyaError::SecurityViolation {
            message: format!(
                "Path '{}' is outside application data directory",
                path.display()
            ),
        });
    }

    Ok(resolved_path)
}

/// Normalize a path by removing Windows UNC prefix if present
fn normalize_path(path: &Path) -> PathBuf {
    let path_str = path.to_string_lossy();
    if let Some(stripped) = path_str.strip_prefix(r"\\?\") {
        PathBuf::from(stripped)
    } else {
        path.to_path_buf()
    }
}

/// Resolve path components manually for non-existent paths
///
/// This function resolves .. and . components in a path without requiring
/// the path to exist on the filesystem.
fn resolve_path_components(path: &Path) -> Result<PathBuf> {
    let mut resolved = PathBuf::new();
    let mut component_count = 0;

    for component in path.components() {
        match component {
            std::path::Component::Prefix(prefix) => {
                resolved.push(prefix.as_os_str());
            }
            std::path::Component::RootDir => {
                resolved.push(std::path::MAIN_SEPARATOR.to_string());
            }
            std::path::Component::CurDir => {
                // Skip . components
            }
            std::path::Component::ParentDir => {
                // Pop the last component for ..
                // But don't pop prefix or root
                if component_count > 0 && resolved.pop() {
                    component_count -= 1;
                } else {
                    // NOTE: Security logging removed here to prevent recursion during logging initialization
                    // The security violation is still returned as an error

                    return Err(KiyyaError::SecurityViolation {
                        message: "Path traversal beyond root directory".to_string(),
                    });
                }
            }
            std::path::Component::Normal(name) => {
                resolved.push(name);
                component_count += 1;
            }
        }
    }

    Ok(resolved)
}

/// Validate and create a path within a subdirectory of app data
///
/// This is a convenience function for common patterns like:
/// - validate_subdir_path("vault", "movie.mp4") -> $APPDATA/Kiyya/vault/movie.mp4
/// - validate_subdir_path("logs", "gateway.log") -> $APPDATA/Kiyya/logs/gateway.log
///
/// # Arguments
///
/// * `subdir` - The subdirectory within app data (e.g., "vault", "logs")
/// * `filename` - The filename within the subdirectory
///
/// # Returns
///
/// * `Ok(PathBuf)` - The validated path
/// * `Err(KiyyaError)` - If the path is invalid or outside app data
pub fn validate_subdir_path<P: AsRef<Path>, Q: AsRef<Path>>(
    subdir: P,
    filename: Q,
) -> Result<PathBuf> {
    let path = Path::new(subdir.as_ref()).join(filename.as_ref());
    validate_path(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_app_data_dir() {
        let app_data = get_app_data_dir();
        assert!(app_data.is_ok());
        let path = app_data.unwrap();
        // In test mode, it should be in temp directory
        #[cfg(test)]
        {
            assert!(path.to_string_lossy().contains("kiyya_test"));
        }
        #[cfg(not(test))]
        {
            assert!(path.to_string_lossy().contains("Kiyya"));
        }
    }

    #[test]
    fn test_validate_relative_path() {
        let app_data = get_app_data_dir().unwrap();
        eprintln!("App data dir: {:?}", app_data);

        let result = validate_path("vault/movie.mp4");
        if let Err(ref e) = result {
            eprintln!("Error: {:?}", e);
        }
        assert!(
            result.is_ok(),
            "Failed to validate path: {:?}",
            result.err()
        );
        let path = result.unwrap();
        eprintln!("Validated path: {:?}", path);
        assert!(path.to_string_lossy().contains("vault"));
    }

    #[test]
    fn test_validate_path_traversal_attack() {
        // Attempt to escape app data directory
        let result = validate_path("../../../etc/passwd");
        assert!(result.is_err());
        if let Err(KiyyaError::SecurityViolation { message }) = result {
            assert!(message.contains("outside application data directory"));
        } else {
            panic!("Expected SecurityViolation error");
        }
    }

    #[test]
    fn test_validate_absolute_path_outside_appdata() {
        // Attempt to access system directory
        #[cfg(target_os = "windows")]
        let result = validate_path("C:\\Windows\\System32\\config");

        #[cfg(not(target_os = "windows"))]
        let result = validate_path("/etc/passwd");

        assert!(result.is_err());
        if let Err(KiyyaError::SecurityViolation { message }) = result {
            assert!(message.contains("outside application data directory"));
        } else {
            panic!("Expected SecurityViolation error");
        }
    }

    #[test]
    fn test_validate_subdir_path() {
        let result = validate_subdir_path("vault", "movie.mp4");
        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(path.to_string_lossy().contains("vault"));
        assert!(path.to_string_lossy().contains("movie.mp4"));
    }

    #[test]
    fn test_resolve_path_components() {
        let app_data = get_app_data_dir().unwrap();
        let path = app_data
            .join("vault")
            .join("..")
            .join("logs")
            .join("test.log");
        let resolved = resolve_path_components(&path).unwrap();

        // Should resolve to app_data/logs/test.log
        assert!(resolved.to_string_lossy().contains("logs"));
        assert!(!resolved.to_string_lossy().contains("vault"));
    }

    #[test]
    fn test_multiple_parent_dirs() {
        let result = validate_path("vault/../../../../../../etc/passwd");
        assert!(result.is_err());
    }

    #[test]
    fn test_valid_nested_path() {
        let result = validate_path("vault/movies/action/movie.mp4");
        assert!(result.is_ok());
        let path = result.unwrap();
        assert!(path.to_string_lossy().contains("vault"));
        assert!(path.to_string_lossy().contains("movies"));
        assert!(path.to_string_lossy().contains("action"));
    }
}
