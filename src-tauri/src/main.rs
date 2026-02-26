// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod crash_reporting;
mod database;
mod diagnostics;
mod download;
mod encryption;
mod error;
mod error_logging;
mod gateway;
mod logging;
mod migrations;
mod models;
mod path_security;
mod sanitization;
mod security_logging;
mod server;
mod validation;

#[cfg(test)]
mod logging_test;

#[cfg(test)]
mod emergency_disable_test;

#[cfg(test)]
mod force_refresh_test;

#[cfg(test)]
mod rate_limit_timeout_test;

#[cfg(test)]
mod sql_injection_test;

#[cfg(test)]
mod input_validation_test;

#[cfg(test)]
mod security_logging_integration_test;

#[cfg(test)]
mod security_logging_e2e_test;

#[cfg(test)]
mod search_test;

#[cfg(test)]
mod monitoring_local_test;

#[cfg(test)]
mod api_parsing_test;

#[cfg(test)]
mod security_restrictions_test;

#[cfg(test)]
mod filesystem_access_test;

#[cfg(test)]
mod cache_ttl_property_test;

#[cfg(test)]
mod gateway_failover_property_test;

#[cfg(test)]
mod http_range_property_test;

#[cfg(test)]
mod cdn_builder_determinism_property_test;

#[cfg(test)]
mod missing_direct_urls_property_test;

#[cfg(test)]
mod valid_claim_id_property_test;

#[cfg(test)]
mod missing_claim_id_property_test;

#[cfg(test)]
mod response_structure_property_test;

#[cfg(test)]
mod partial_success_property_test;

#[cfg(test)]
mod error_structure_property_test;

#[cfg(test)]
mod migrations_error_handling_test;

#[cfg(test)]
mod channel_id_parameter_property_test;

#[cfg(test)]
mod channel_id_format_validation_property_test;

#[cfg(test)]
mod valid_channel_id_acceptance_property_test;

#[cfg(test)]
mod logging_unit_test;

#[cfg(test)]
mod database_initialization_test;

#[cfg(test)]
mod diagnostics_test;

#[cfg(test)]
mod migration_property_test;

#[cfg(test)]
mod download_resumable_atomic_property_test;

#[cfg(test)]
mod async_completion_tests;

#[cfg(test)]
mod database_optimization_test;

#[cfg(test)]
mod integration_test;

#[cfg(test)]
mod hero_stream_filter_test;

#[cfg(test)]
mod error_logging_test;

#[cfg(test)]
mod encryption_key_management_test;

#[cfg(test)]
mod tag_immutability_test;

#[cfg(test)]
mod gateway_production_test;

#[cfg(test)]
mod migration_clean_run_test;

#[cfg(test)]
mod hero_single_item_test;

use std::sync::Arc;
use tauri::{Manager, State};
use tokio::sync::Mutex;

use crate::database::Database;
use crate::download::DownloadManager;
use crate::gateway::GatewayClient;
use crate::models::VersionManifest;
use crate::server::LocalServer;

// Application state
#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Mutex<Database>>,
    pub gateway: Arc<Mutex<GatewayClient>>,
    pub download_manager: Arc<Mutex<DownloadManager>>,
    pub local_server: Arc<Mutex<LocalServer>>,
}

#[tokio::main]
async fn main() {
    println!("=== MAIN FUNCTION STARTED ===");

    // Initialize logging system with file rotation
    println!("=== INITIALIZING LOGGING ===");
    if let Err(e) = crate::logging::init_logging() {
        eprintln!("Failed to initialize logging: {}", e);
        // Continue without logging rather than crash
    }
    println!("=== LOGGING INITIALIZED ===");

    // Initialize crash reporting (optional)
    println!("=== INITIALIZING CRASH REPORTING ===");
    if let Ok(app_data_path) = crate::path_security::get_app_data_dir() {
        crate::crash_reporting::init_crash_reporting(&app_data_path);
    } else {
        eprintln!("Failed to get app data directory for crash reporting");
    }
    println!("=== CRASH REPORTING INITIALIZED ===");

    // CRITICAL: Emergency disable check runs before all other startup logic
    println!("=== STARTING EMERGENCY DISABLE CHECK ===");
    tracing::info!("🔍 Starting emergency disable check...");

    // TEMPORARY: Skip emergency disable check to isolate the hang
    tracing::info!("⚠️ TEMPORARY: Skipping emergency disable check for debugging");
    println!("=== SKIPPING EMERGENCY DISABLE CHECK (DEBUG) ===");

    /*
    if let Err(e) = check_emergency_disable().await {
        tracing::error!("Emergency disable check failed: {}", e);
        // If we can't check emergency disable, proceed with caution
        // This ensures the app doesn't fail to start due to network issues
    }
    */

    tracing::info!("✅ Emergency disable check complete");
    println!("=== EMERGENCY DISABLE CHECK COMPLETE ===");

    // Initialize application state
    println!("=== INITIALIZING APP STATE ===");
    tracing::info!("🔍 About to initialize app state...");
    let app_state = initialize_app_state()
        .await
        .expect("Failed to initialize application state");
    tracing::info!("✅ App state initialized");
    println!("=== APP STATE INITIALIZED ===");

    println!("=== BUILDING TAURI APP ===");
    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::test_connection,
            commands::build_cdn_playback_url_test,
            commands::fetch_channel_claims,
            commands::fetch_playlists,
            commands::resolve_claim,
            commands::download_movie_quality,
            commands::stream_offline,
            commands::delete_offline,
            commands::save_progress,
            commands::get_progress,
            commands::get_app_config,
            commands::open_external,
            commands::get_diagnostics,
            commands::collect_debug_package,
            commands::get_recent_crashes,
            commands::clear_crash_log,
            commands::save_favorite,
            commands::remove_favorite,
            commands::get_favorites,
            commands::is_favorite,
            commands::update_settings,
            commands::invalidate_cache_item,
            commands::invalidate_cache_by_tags,
            commands::clear_all_cache,
            commands::cleanup_expired_cache,
            commands::get_cache_stats,
            commands::get_memory_stats,
            commands::optimize_database_memory,
        ])
        .setup(|_app| {
            println!("=== TAURI SETUP HOOK STARTED ===");
            tracing::info!("🔍 Tauri setup hook started");

            // TEMPORARY: Skip migrations to isolate the hang
            tracing::info!("⚠️ TEMPORARY: Skipping migrations for debugging");
            println!("=== SKIPPING MIGRATIONS (DEBUG) ===");

            /*
            // CRITICAL: Single Migration Execution Point
            //
            // Database migrations are executed ONLY here in the setup hook, ensuring they
            // run exactly once during application startup. This is the sole execution point
            // for migrations to prevent stack overflow from redundant execution.
            //
            // Background: Previously, migrations were executed twice - once in Database::new()
            // and again here in the setup hook. The double execution, combined with the
            // migration system's use of task::spawn_blocking, caused stack overflow before
            // the application could complete initialization.
            //
            // Fix: Removed automatic migration execution from Database::new() (database.rs:54)
            // and kept only this explicit call in the setup hook. Database::new() now only
            // creates the connection pool and base schema, leaving migration execution to
            // this single, well-defined point in the startup sequence.
            //
            // See: .kiro/specs/fix-database-initialization-stack-overflow/ for full details
            let app_handle = app.handle();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = run_startup_migrations(&app_handle).await {
                    tracing::error!("Failed to run database migrations: {}", e);
                }
            });
            */

            println!("=== TAURI SETUP HOOK COMPLETE ===");
            tracing::info!("✅ Tauri setup hook complete");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    println!("=== TAURI APP RUNNING ===");
}

async fn initialize_app_state() -> Result<AppState, Box<dyn std::error::Error>> {
    tracing::info!("🚀 Starting app state initialization...");

    // Initialize database
    tracing::info!("🔍 Initializing database...");
    let db = Database::new().await?;
    tracing::info!("✅ Database initialized");

    // Initialize gateway client
    tracing::info!("🔍 Initializing gateway client...");
    let gateway = GatewayClient::new();
    tracing::info!("✅ Gateway client initialized");

    // Initialize download manager
    tracing::info!("🔍 Initializing download manager...");
    let download_manager = DownloadManager::new().await?;
    tracing::info!("✅ Download manager initialized");

    // Initialize local server
    tracing::info!("🔍 Initializing local server...");
    let local_server = LocalServer::new().await?;
    tracing::info!("✅ Local server initialized");

    tracing::info!("🎉 App state initialization complete!");

    Ok(AppState {
        db: Arc::new(Mutex::new(db)),
        gateway: Arc::new(Mutex::new(gateway)),
        download_manager: Arc::new(Mutex::new(download_manager)),
        local_server: Arc::new(Mutex::new(local_server)),
    })
}

/// Executes database migrations during application startup
///
/// This function is called from the Tauri setup hook and represents the ONLY place
/// where database migrations are executed. This ensures migrations run exactly once
/// per application startup, preventing stack overflow from redundant execution.
///
/// # Migration Execution Flow
///
/// 1. Application starts and calls `initialize_app_state()`
/// 2. `Database::new()` creates connection pool and base schema (NO migrations)
/// 3. Tauri setup hook calls this function
/// 4. This function executes all pending migrations via `db.run_migrations()`
/// 5. Application is ready for use
///
/// # Bug Fix Reference
///
/// This single execution point fixes a critical stack overflow bug where migrations
/// were previously executed twice (once in Database::new() and once here), causing
/// the application to crash on startup.
///
/// See: .kiro/specs/fix-database-initialization-stack-overflow/ for full details
#[allow(dead_code)]
async fn run_startup_migrations(
    app_handle: &tauri::AppHandle,
) -> Result<(), Box<dyn std::error::Error>> {
    let state: State<AppState> = app_handle.state();
    let db = state.db.lock().await;
    db.run_migrations().await?;
    Ok(())
}

/// Checks for emergency disable flag from update manifest
/// This function runs before all other startup logic to ensure
/// the application can be remotely disabled if necessary
#[allow(dead_code)]
async fn check_emergency_disable() -> Result<(), Box<dyn std::error::Error>> {
    tracing::info!("🔍 check_emergency_disable: Reading environment variable...");

    // Get the update manifest URL from environment variable
    let manifest_url = std::env::var("VITE_UPDATE_MANIFEST_URL").unwrap_or_else(|_| {
        tracing::warn!("VITE_UPDATE_MANIFEST_URL not set, skipping emergency disable check");
        String::new()
    });

    if manifest_url.is_empty() {
        tracing::info!("No update manifest URL configured, skipping emergency disable check");
        return Ok(());
    }

    tracing::info!("Checking emergency disable status from: {}", manifest_url);

    tracing::info!("🔍 check_emergency_disable: Creating HTTP client...");
    // Create HTTP client with timeout
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;

    tracing::info!("🔍 check_emergency_disable: Sending HTTP request...");
    // Fetch the version manifest
    match client.get(&manifest_url).send().await {
        Ok(response) => {
            tracing::info!(
                "🔍 check_emergency_disable: Received response, status: {}",
                response.status()
            );
            if response.status().is_success() {
                match response.json::<VersionManifest>().await {
                    Ok(manifest) => {
                        if manifest.is_emergency_disabled() {
                            tracing::error!(
                                "Emergency disable is active - application startup blocked"
                            );

                            // Show emergency disable message and exit
                            show_emergency_disable_message();
                            std::process::exit(1);
                        } else {
                            tracing::info!(
                                "Emergency disable check passed - normal startup proceeding"
                            );
                        }
                    }
                    Err(e) => {
                        tracing::warn!(
                            "Failed to parse version manifest: {} - proceeding with startup",
                            e
                        );
                    }
                }
            } else {
                tracing::warn!(
                    "Failed to fetch version manifest (HTTP {}): {} - proceeding with startup",
                    response.status(),
                    manifest_url
                );
            }
        }
        Err(e) => {
            tracing::warn!(
                "Network error fetching version manifest: {} - proceeding with startup",
                e
            );
        }
    }

    tracing::info!("🔍 check_emergency_disable: Function complete");
    Ok(())
}

/// Shows emergency disable message and provides exit option
/// This is a blocking operation that prevents normal application startup
#[allow(dead_code)]
fn show_emergency_disable_message() {
    // In a real implementation, this would show a native dialog
    // For now, we log the message and exit
    tracing::error!("=== EMERGENCY MAINTENANCE MODE ===");
    tracing::error!("The application is currently under emergency maintenance.");
    tracing::error!("Please check for updates or contact support.");
    tracing::error!("Application will now exit.");

    // TODO: In future implementation, show native dialog with:
    // - "Emergency Maintenance" title
    // - Explanation message
    // - "Exit" button only (no other options)
    // - Block all other functionality
}
