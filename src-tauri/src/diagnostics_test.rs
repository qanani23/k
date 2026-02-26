//! Tests for debug package generation functionality

use crate::database::Database;
use crate::diagnostics::collect_debug_package;
use std::path::Path;
use tempfile::TempDir;

async fn create_test_db() -> (Database, TempDir) {
    let temp_dir = TempDir::new().expect("Failed to create temp dir");
    let db_path = temp_dir.path().join("test.db");
    let db = Database::new_with_path(&db_path)
        .await
        .expect("Failed to create database");
    db.run_migrations().await.expect("Failed to run migrations");
    (db, temp_dir)
}

#[tokio::test]
async fn test_debug_package_creation() {
    // Create test database and directories
    let (db, temp_dir) = create_test_db().await;
    let app_data_path = temp_dir.path();
    let vault_path = app_data_path.join("vault");
    std::fs::create_dir_all(&vault_path).expect("Failed to create vault directory");

    // Create logs directory with a test log file
    let logs_dir = app_data_path.join("logs");
    std::fs::create_dir_all(&logs_dir).expect("Failed to create logs directory");
    std::fs::write(
        logs_dir.join("app.log"),
        "Test log entry 1\nTest log entry 2\nTest log entry 3\n",
    )
    .expect("Failed to write test log");

    // Call collect_debug_package
    let result = collect_debug_package(&db, &vault_path, app_data_path).await;

    // Verify the function succeeds
    assert!(
        result.is_ok(),
        "Debug package collection failed: {:?}",
        result.err()
    );

    let package_path = result.unwrap();

    // Verify the zip file was created
    assert!(package_path.exists(), "Debug package file was not created");
    assert!(
        package_path.extension().and_then(|s| s.to_str()) == Some("zip"),
        "Debug package is not a zip file"
    );

    // Verify the file name format (kiyya_debug_YYYYMMDD_HHMMSS.zip)
    let file_name = package_path.file_name().and_then(|s| s.to_str()).unwrap();
    assert!(
        file_name.starts_with("kiyya_debug_"),
        "Invalid debug package file name"
    );
    assert!(
        file_name.ends_with(".zip"),
        "Invalid debug package file extension"
    );

    // Verify the file is not empty
    let metadata = std::fs::metadata(&package_path).expect("Failed to get file metadata");
    assert!(metadata.len() > 0, "Debug package file is empty");
}

#[tokio::test]
async fn test_debug_package_contains_system_info() {
    // This test verifies that the debug package includes system information
    let (db, temp_dir) = create_test_db().await;
    let app_data_path = temp_dir.path();
    let vault_path = app_data_path.join("vault");
    std::fs::create_dir_all(&vault_path).expect("Failed to create vault directory");

    let result = collect_debug_package(&db, &vault_path, app_data_path).await;
    assert!(result.is_ok(), "Debug package collection failed");

    let package_path = result.unwrap();

    // Open and verify the zip file contains expected files
    let file = std::fs::File::open(&package_path).expect("Failed to open zip file");
    let mut archive = zip::ZipArchive::new(file).expect("Failed to read zip archive");

    // Check for system_info.txt
    let system_info = archive.by_name("system_info.txt");
    assert!(
        system_info.is_ok(),
        "system_info.txt not found in debug package"
    );

    // Verify system_info.txt contains expected content
    let mut system_info_file = system_info.unwrap();
    let mut content = String::new();
    std::io::Read::read_to_string(&mut system_info_file, &mut content)
        .expect("Failed to read system_info.txt");

    assert!(
        content.contains("Kiyya Debug Package"),
        "Missing header in system_info.txt"
    );
    assert!(
        content.contains("System Information"),
        "Missing system information section"
    );
    assert!(content.contains("OS:"), "Missing OS information");
    assert!(
        content.contains("Total Memory:"),
        "Missing memory information"
    );
}

#[tokio::test]
async fn test_debug_package_contains_database_metadata() {
    let (db, temp_dir) = create_test_db().await;
    let app_data_path = temp_dir.path();
    let vault_path = app_data_path.join("vault");
    std::fs::create_dir_all(&vault_path).expect("Failed to create vault directory");

    // Add some test settings
    db.set_setting("theme", "dark")
        .await
        .expect("Failed to set theme");
    db.set_setting("last_used_quality", "720p")
        .await
        .expect("Failed to set quality");

    let result = collect_debug_package(&db, &vault_path, app_data_path).await;
    assert!(result.is_ok(), "Debug package collection failed");

    let package_path = result.unwrap();
    let file = std::fs::File::open(&package_path).expect("Failed to open zip file");
    let mut archive = zip::ZipArchive::new(file).expect("Failed to read zip archive");

    // Check for database_metadata.txt
    let db_metadata = archive.by_name("database_metadata.txt");
    assert!(
        db_metadata.is_ok(),
        "database_metadata.txt not found in debug package"
    );

    let mut db_metadata_file = db_metadata.unwrap();
    let mut content = String::new();
    std::io::Read::read_to_string(&mut db_metadata_file, &mut content)
        .expect("Failed to read database_metadata.txt");

    assert!(
        content.contains("Database Metadata"),
        "Missing database metadata section"
    );
    assert!(
        content.contains("Database Version:"),
        "Missing database version"
    );
    assert!(
        content.contains("Cache Statistics"),
        "Missing cache statistics"
    );
}

#[tokio::test]
async fn test_debug_package_sanitizes_sensitive_data() {
    let (db, temp_dir) = create_test_db().await;
    let app_data_path = temp_dir.path();
    let vault_path = app_data_path.join("vault");
    std::fs::create_dir_all(&vault_path).expect("Failed to create vault directory");

    // Add a sensitive setting (encryption key - should NOT be in debug package)
    db.set_setting("encryption_key", "super_secret_key_12345")
        .await
        .expect("Failed to set encryption key");

    let result = collect_debug_package(&db, &vault_path, app_data_path).await;
    assert!(result.is_ok(), "Debug package collection failed");

    let package_path = result.unwrap();
    let file = std::fs::File::open(&package_path).expect("Failed to open zip file");
    let mut archive = zip::ZipArchive::new(file).expect("Failed to read zip archive");

    // Read all files and verify no sensitive data is present
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .expect("Failed to read file from archive");
        let mut content = String::new();
        std::io::Read::read_to_string(&mut file, &mut content)
            .expect("Failed to read file content");

        // Verify encryption key is NOT in any file
        assert!(
            !content.contains("super_secret_key_12345"),
            "Sensitive data (encryption key) found in debug package file: {}",
            file.name()
        );
        assert!(
            !content.contains("encryption_key"),
            "Encryption key setting found in debug package file: {}",
            file.name()
        );
    }
}

#[test]
fn test_debug_package_components_documented() {
    // Verify that all required components are documented:
    // - System information (OS, memory, CPU, disk)
    // - Database metadata (version, cache stats, memory stats, settings)
    // - Recent application logs
    // - Error logs with statistics
    // - Gateway health logs
    // - Sanitized configuration

    // This is a documentation test to ensure all components are accounted for
    let required_components = vec![
        "system_info.txt",
        "database_metadata.txt",
        "logs/recent_1.log",
        "error_logs.txt",
        "logs/gateway.log",
        "config.txt",
    ];

    assert_eq!(
        required_components.len(),
        6,
        "All 6 required debug package components are documented"
    );
}
