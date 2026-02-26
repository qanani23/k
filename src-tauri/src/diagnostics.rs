use crate::database::Database;
use crate::download::DownloadManager;
use crate::error::Result;
use crate::error_logging;
use crate::gateway::GatewayClient;
use crate::models::{CacheStats, DiagnosticsData};
use crate::server::LocalServer;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use sysinfo::{DiskExt, System, SystemExt};
use tracing::{info, warn};
use zip::write::{FileOptions, ZipWriter};
use zip::CompressionMethod;

pub async fn collect_diagnostics(
    gateway: &GatewayClient,
    server: &LocalServer,
    db: &Database,
    vault_path: &Path,
    download_manager: &DownloadManager,
) -> Result<DiagnosticsData> {
    // Gateway health
    let gateway_health = gateway.get_health_stats().to_vec();

    // Database version (get from migrations table)
    let database_version = get_database_version(db).await?;

    // Free disk space
    let free_disk_bytes = get_free_disk_space(vault_path)?;

    // Local server status
    let local_server_status = server.get_status().await;

    // Last manifest fetch (get from settings)
    let last_manifest_fetch = get_last_manifest_fetch(db).await?;

    // Cache stats
    let cache_stats = get_cache_stats(db).await?;

    // Download stats
    let download_stats = download_manager.get_download_stats();

    // Error statistics
    let error_stats = error_logging::get_error_stats(db).await.ok();

    Ok(DiagnosticsData {
        gateway_health,
        database_version,
        free_disk_bytes,
        local_server_status,
        last_manifest_fetch,
        cache_stats,
        download_stats,
        error_stats,
    })
}

async fn get_database_version(_db: &Database) -> Result<u32> {
    // This would query the migrations table to get the current version
    // For now, return a default version
    Ok(1)
}

fn get_free_disk_space(vault_path: &Path) -> Result<u64> {
    let mut system = System::new_all();
    system.refresh_disks_list();
    system.refresh_disks();

    for disk in system.disks() {
        if vault_path.starts_with(disk.mount_point()) {
            return Ok(disk.available_space());
        }
    }

    // If we can't find the disk, return 0
    Ok(0)
}

async fn get_last_manifest_fetch(db: &Database) -> Result<Option<i64>> {
    match db.get_setting("last_manifest_fetch").await? {
        Some(timestamp_str) => {
            if let Ok(timestamp) = timestamp_str.parse::<i64>() {
                Ok(Some(timestamp))
            } else {
                Ok(None)
            }
        }
        None => Ok(None),
    }
}

async fn get_cache_stats(db: &Database) -> Result<CacheStats> {
    // Get cache statistics from database
    db.get_cache_stats().await
}

/// Collects a debug package containing logs and diagnostic information
/// Returns the path to the generated zip file
pub async fn collect_debug_package(
    db: &Database,
    _vault_path: &Path,
    app_data_path: &Path,
) -> Result<PathBuf> {
    info!("Collecting debug package");

    // Create temporary directory for debug package
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let debug_package_name = format!("kiyya_debug_{}.zip", timestamp);
    let debug_package_path = app_data_path.join(&debug_package_name);

    // Create zip file
    let file = fs::File::create(&debug_package_path)?;
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o644);

    // Add system information
    add_system_info(&mut zip, options).await?;

    // Add database metadata (without user content)
    add_database_metadata(&mut zip, db, options).await?;

    // Add recent logs
    add_recent_logs(&mut zip, app_data_path, options).await?;

    // Add error logs
    add_error_logs(&mut zip, db, options).await?;

    // Add gateway health logs
    add_gateway_logs(&mut zip, app_data_path, options).await?;

    // Add crash reports (if any)
    add_crash_reports(&mut zip, app_data_path, options).await?;

    // Add configuration (sanitized)
    add_sanitized_config(&mut zip, db, options).await?;

    zip.finish()?;

    info!("Debug package created: {:?}", debug_package_path);
    Ok(debug_package_path)
}

async fn add_system_info(zip: &mut ZipWriter<fs::File>, options: FileOptions) -> Result<()> {
    let mut system = System::new_all();
    system.refresh_all();

    let mut info = String::new();
    info.push_str(&format!("Kiyya Debug Package\n"));
    info.push_str(&format!(
        "Generated: {}\n\n",
        chrono::Utc::now().to_rfc3339()
    ));
    info.push_str(&format!("=== System Information ===\n"));
    info.push_str(&format!(
        "OS: {}\n",
        system.name().unwrap_or_else(|| "Unknown".to_string())
    ));
    info.push_str(&format!(
        "OS Version: {}\n",
        system.os_version().unwrap_or_else(|| "Unknown".to_string())
    ));
    info.push_str(&format!(
        "Kernel Version: {}\n",
        system
            .kernel_version()
            .unwrap_or_else(|| "Unknown".to_string())
    ));
    info.push_str(&format!(
        "Total Memory: {} MB\n",
        system.total_memory() / 1024 / 1024
    ));
    info.push_str(&format!(
        "Used Memory: {} MB\n",
        system.used_memory() / 1024 / 1024
    ));
    info.push_str(&format!(
        "Total Swap: {} MB\n",
        system.total_swap() / 1024 / 1024
    ));
    info.push_str(&format!("CPU Count: {}\n", system.cpus().len()));
    info.push_str(&format!("App Version: {}\n\n", env!("CARGO_PKG_VERSION")));

    info.push_str(&format!("=== Disk Information ===\n"));
    for disk in system.disks() {
        info.push_str(&format!("Mount: {:?}\n", disk.mount_point()));
        info.push_str(&format!(
            "  Total: {} GB\n",
            disk.total_space() / 1024 / 1024 / 1024
        ));
        info.push_str(&format!(
            "  Available: {} GB\n",
            disk.available_space() / 1024 / 1024 / 1024
        ));
        info.push_str(&format!("  File System: {:?}\n\n", disk.file_system()));
    }

    zip.start_file("system_info.txt", options)?;
    zip.write_all(info.as_bytes())?;

    Ok(())
}

async fn add_database_metadata(
    zip: &mut ZipWriter<fs::File>,
    db: &Database,
    options: FileOptions,
) -> Result<()> {
    let mut metadata = String::new();
    metadata.push_str("=== Database Metadata ===\n\n");

    // Get database version
    let db_version = get_database_version(db).await?;
    metadata.push_str(&format!("Database Version: {}\n", db_version));

    // Get cache stats
    let cache_stats = db.get_cache_stats().await?;
    metadata.push_str(&format!("\n=== Cache Statistics ===\n"));
    metadata.push_str(&format!("Total Items: {}\n", cache_stats.total_items));
    metadata.push_str(&format!(
        "Cache Size: {} MB\n",
        cache_stats.cache_size_bytes / 1024 / 1024
    ));
    metadata.push_str(&format!("Hit Rate: {:.2}%\n", cache_stats.hit_rate * 100.0));
    if let Some(last_cleanup) = cache_stats.last_cleanup {
        metadata.push_str(&format!(
            "Last Cleanup: {}\n",
            chrono::DateTime::<chrono::Utc>::from_timestamp(last_cleanup, 0)
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_else(|| "Unknown".to_string())
        ));
    }

    // Get memory stats
    let memory_stats = db.get_memory_stats().await?;
    metadata.push_str(&format!("\n=== Memory Statistics ===\n"));
    metadata.push_str(&format!("Cache Items: {}\n", memory_stats.cache_items));
    metadata.push_str(&format!(
        "Playlist Count: {}\n",
        memory_stats.playlist_count
    ));
    metadata.push_str(&format!(
        "Favorites Count: {}\n",
        memory_stats.favorites_count
    ));
    metadata.push_str(&format!(
        "Offline Content Count: {}\n",
        memory_stats.offline_content_count
    ));
    metadata.push_str(&format!(
        "Database File Size: {} MB\n",
        memory_stats.database_file_size / 1024 / 1024
    ));

    // Get settings (sanitized - no encryption keys)
    metadata.push_str(&format!("\n=== Settings (Sanitized) ===\n"));
    if let Ok(Some(theme)) = db.get_setting("theme").await {
        metadata.push_str(&format!("Theme: {}\n", theme));
    }
    if let Ok(Some(quality)) = db.get_setting("last_used_quality").await {
        metadata.push_str(&format!("Last Used Quality: {}\n", quality));
    }
    if let Ok(Some(encrypt)) = db.get_setting("encrypt_downloads").await {
        metadata.push_str(&format!("Encrypt Downloads: {}\n", encrypt));
    }
    if let Ok(Some(ttl)) = db.get_setting("cache_ttl_minutes").await {
        metadata.push_str(&format!("Cache TTL Minutes: {}\n", ttl));
    }

    zip.start_file("database_metadata.txt", options)?;
    zip.write_all(metadata.as_bytes())?;

    Ok(())
}

async fn add_recent_logs(
    zip: &mut ZipWriter<fs::File>,
    app_data_path: &Path,
    options: FileOptions,
) -> Result<()> {
    let logs_dir = app_data_path.join("logs");

    if !logs_dir.exists() {
        warn!("Logs directory does not exist: {:?}", logs_dir);
        return Ok(());
    }

    // Find the most recent log file
    let mut log_files: Vec<_> = fs::read_dir(&logs_dir)?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry
                .path()
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext == "log")
                .unwrap_or(false)
        })
        .collect();

    // Sort by modification time (most recent first)
    log_files.sort_by_key(|entry| entry.metadata().and_then(|m| m.modified()).ok());
    log_files.reverse();

    // Add up to 3 most recent log files
    for (i, entry) in log_files.iter().take(3).enumerate() {
        let path = entry.path();
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown.log");

        if let Ok(content) = fs::read_to_string(&path) {
            // Take only last 10000 lines to keep package size reasonable
            let lines: Vec<&str> = content.lines().collect();
            let recent_lines = if lines.len() > 10000 {
                &lines[lines.len() - 10000..]
            } else {
                &lines[..]
            };

            let zip_name = format!("logs/recent_{}.log", i + 1);
            zip.start_file(&zip_name, options)?;
            zip.write_all(recent_lines.join("\n").as_bytes())?;

            info!("Added log file to debug package: {}", file_name);
        }
    }

    Ok(())
}

async fn add_error_logs(
    zip: &mut ZipWriter<fs::File>,
    db: &Database,
    options: FileOptions,
) -> Result<()> {
    // Get recent error logs from database
    if let Ok(error_stats) = error_logging::get_error_stats(db).await {
        let mut error_info = String::new();
        error_info.push_str("=== Error Statistics ===\n\n");
        error_info.push_str(&format!("Total Errors: {}\n", error_stats.total_errors));
        error_info.push_str(&format!(
            "Unresolved Errors: {}\n\n",
            error_stats.unresolved_errors
        ));

        // Show errors by category
        error_info.push_str("=== Errors by Category ===\n");
        for (category, count) in &error_stats.errors_by_category {
            error_info.push_str(&format!("{}: {}\n", category, count));
        }
        error_info.push_str("\n");

        if let Some(most_common) = &error_stats.most_common_error {
            error_info.push_str(&format!("Most Common Error: {}\n\n", most_common));
        }

        if let Ok(recent_errors) = error_logging::get_recent_errors(db, 100, false).await {
            error_info.push_str("=== Recent Errors (Last 100) ===\n\n");
            for error in recent_errors {
                error_info.push_str(&format!(
                    "[{}] {} - {}\n",
                    error.error_type,
                    chrono::DateTime::<chrono::Utc>::from_timestamp(error.timestamp, 0)
                        .map(|dt| dt.to_rfc3339())
                        .unwrap_or_else(|| "Unknown".to_string()),
                    error.message
                ));
                if let Some(context) = error.context {
                    error_info.push_str(&format!("  Context: {}\n", context));
                }
                if let Some(user_action) = error.user_action {
                    error_info.push_str(&format!("  User Action: {}\n", user_action));
                }
                error_info.push_str("\n");
            }
        }

        zip.start_file("error_logs.txt", options)?;
        zip.write_all(error_info.as_bytes())?;
    }

    Ok(())
}

async fn add_gateway_logs(
    zip: &mut ZipWriter<fs::File>,
    app_data_path: &Path,
    options: FileOptions,
) -> Result<()> {
    let gateway_log_path = app_data_path.join("logs").join("gateway.log");

    if gateway_log_path.exists() {
        if let Ok(content) = fs::read_to_string(&gateway_log_path) {
            // Take only last 5000 lines
            let lines: Vec<&str> = content.lines().collect();
            let recent_lines = if lines.len() > 5000 {
                &lines[lines.len() - 5000..]
            } else {
                &lines[..]
            };

            zip.start_file("logs/gateway.log", options)?;
            zip.write_all(recent_lines.join("\n").as_bytes())?;

            info!("Added gateway log to debug package");
        }
    } else {
        warn!("Gateway log file does not exist: {:?}", gateway_log_path);
    }

    Ok(())
}

async fn add_crash_reports(
    zip: &mut ZipWriter<fs::File>,
    app_data_path: &Path,
    options: FileOptions,
) -> Result<()> {
    let crash_log_path = app_data_path.join("logs").join("crash.log");

    if crash_log_path.exists() {
        if let Ok(content) = fs::read_to_string(&crash_log_path) {
            // Include all crash reports (they should be relatively small)
            zip.start_file("logs/crash.log", options)?;
            zip.write_all(content.as_bytes())?;

            info!("Added crash log to debug package");
        }
    } else {
        // No crashes - add a note
        zip.start_file("logs/crash.log", options)?;
        zip.write_all(b"No crashes recorded.\n")?;
    }

    Ok(())
}

async fn add_sanitized_config(
    zip: &mut ZipWriter<fs::File>,
    db: &Database,
    options: FileOptions,
) -> Result<()> {
    let mut config = String::new();
    config.push_str("=== Application Configuration (Sanitized) ===\n\n");
    config.push_str("Note: Sensitive information like encryption keys has been removed.\n\n");

    // Add non-sensitive settings
    let safe_settings = vec![
        "theme",
        "last_used_quality",
        "encrypt_downloads",
        "auto_upgrade_quality",
        "cache_ttl_minutes",
        "max_cache_items",
    ];

    for setting in safe_settings {
        if let Ok(Some(value)) = db.get_setting(setting).await {
            config.push_str(&format!("{}: {}\n", setting, value));
        }
    }

    config.push_str(&format!("\n=== Gateway Configuration ===\n"));
    config.push_str("Primary: https://api.na-backend.odysee.com/api/v1/proxy\n");
    config.push_str("Secondary: https://api.lbry.tv/api/v1/proxy\n");
    config.push_str("Fallback: https://api.odysee.com/api/v1/proxy\n");

    zip.start_file("config.txt", options)?;
    zip.write_all(config.as_bytes())?;

    Ok(())
}
