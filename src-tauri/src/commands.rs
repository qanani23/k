use crate::diagnostics;
use crate::error::{KiyyaError, Result};
use crate::models::*;
use crate::sanitization;
use crate::validation::{self, validate_claim_id};
use crate::AppState;
use once_cell::sync::Lazy;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{command, AppHandle, Manager, State};
use tracing::{debug, error, info, warn};

// ============================================================================
// ERROR HANDLING AND LOGGING STRATEGY
// ============================================================================
//
// This module implements production-grade error handling with structured logging
// following idempotent discipline to prevent noisy production logs.
//
// ## Logging Level Separation (Idempotent Discipline)
//
// - **INFO**: Lifecycle events (gateway resolution at startup) - logged once
// - **DEBUG**: Per-request operations (CDN URL construction, reachability checks) - prevents spam
// - **WARN**: Skipped claims (non-stream type, missing claim_id, ambiguous structure)
// - **ERROR**: Structural failures (malformed JSON, network errors, parsing failures)
//
// ## Structured Error Format for Frontend Playback Failure Telemetry
//
// All errors include claim_id context when available to enable:
// 1. Frontend playback failure telemetry
// 2. Future multi-gateway fallback strategy
// 3. Debugging and operational monitoring
//
// Error structure pattern:
// ```rust
// KiyyaError::ContentParsing {
//     message: format!("Error description for claim {}", claim_id)
// }
// ```
//
// This ensures errors can be traced back to specific content items for:
// - User-facing error messages with content context
// - Backend telemetry and monitoring
// - Future CDN failover decision-making
//
// ## Future Enhancement: Multi-Gateway Fallback
//
// The error logging structure supports future implementation of:
// - Regional CDN failover based on claim_id-specific failures
// - Alternate gateway selection for degraded CDN performance
// - Per-claim CDN health tracking
//
// ============================================================================

// CDN Playback Constants
const HLS_MASTER_PLAYLIST: &str = "master.m3u8";
const DEFAULT_CDN_GATEWAY: &str = "https://cloud.odysee.live";

/// CDN Gateway Configuration (Immutable after startup)
///
/// This static variable holds the resolved CDN gateway URL, which is determined once
/// at application initialization and remains immutable throughout the application lifecycle.
///
/// # Initialization
/// Gateway resolution occurs on first access (lazy initialization):
/// 1. Read ODYSEE_CDN_GATEWAY environment variable
/// 2. Validate gateway format (HTTPS only, remove trailing slashes)
/// 3. Fall back to DEFAULT_CDN_GATEWAY if invalid or not set
/// 4. Log resolved gateway at INFO level
/// 5. Store in immutable Arc<String> for thread-safe access
///
/// # Security
/// - Rejects HTTP gateways (HTTPS only)
/// - Removes trailing slashes to prevent double-slash URLs
/// - Validates URL format
/// - Prevents mid-session gateway changes (immutable after initialization)
///
/// # Determinism
/// Gateway resolution happens once at startup, preventing mid-session inconsistency
/// if environment variable changes during runtime.
static CDN_GATEWAY: Lazy<Arc<String>> = Lazy::new(|| {
    let gateway =
        std::env::var("ODYSEE_CDN_GATEWAY").unwrap_or_else(|_| DEFAULT_CDN_GATEWAY.to_string());

    // Validate and sanitize gateway
    let sanitized = sanitize_gateway(&gateway);

    info!("CDN gateway resolved at startup: {}", sanitized);
    Arc::new(sanitized)
});

/// Sanitize and validate CDN gateway URL
///
/// # Validation Rules
/// - Must start with `https://` (reject http://)
/// - Remove trailing slash to prevent double-slash in URLs
/// - Reject malformed URLs
/// - Log warning if invalid gateway provided, fall back to default
///
/// # Arguments
/// * `gateway` - The gateway URL to sanitize
///
/// # Returns
/// Sanitized gateway URL or default if invalid
///
/// # Security
/// Prevents malicious gateway injection and malformed URLs like
/// `https://cloud.odysee.live//content/claim/master.m3u8`
fn sanitize_gateway(gateway: &str) -> String {
    // Must start with https://
    if !gateway.starts_with("https://") {
        warn!(
            "Invalid gateway '{}', must use HTTPS. Falling back to default.",
            gateway
        );
        return DEFAULT_CDN_GATEWAY.to_string();
    }

    // Remove trailing slash to prevent double-slash in URLs
    let sanitized = gateway.trim_end_matches('/');

    // Validate URL format
    if let Err(e) = url::Url::parse(sanitized) {
        warn!(
            "Malformed gateway URL '{}': {}. Falling back to default.",
            gateway, e
        );
        return DEFAULT_CDN_GATEWAY.to_string();
    }

    sanitized.to_string()
}

/// Get the immutable CDN gateway URL
///
/// This function returns a reference to the CDN gateway that was resolved at startup.
/// The gateway is immutable after initialization, ensuring consistent behavior throughout
/// the application lifecycle.
///
/// # Returns
/// Reference to the resolved CDN gateway URL
///
/// # Example
/// ```
/// let gateway = get_cdn_gateway();
/// let url = build_cdn_playback_url("claim123", gateway);
/// ```
pub(crate) fn get_cdn_gateway() -> &'static str {
    &CDN_GATEWAY
}

/// Build a deterministic CDN playback URL from claim_id
///
/// This function constructs HLS master playlist URLs for Odysee content using the CDN gateway.
/// The URL pattern is: {gateway}/content/{claim_id}/{HLS_MASTER_PLAYLIST}
///
/// # Arguments
/// * `claim_id` - The Odysee claim identifier
/// * `gateway` - CDN gateway URL from immutable state (use get_cdn_gateway())
///
/// # Returns
/// A complete CDN playback URL string
///
/// # Example
/// ```
/// let url = build_cdn_playback_url("abc123def456", get_cdn_gateway());
/// // Returns: "https://cloud.odysee.live/content/abc123def456/master.m3u8"
/// ```
///
/// # Future Enhancement
/// Future: Support multi-gateway fallback strategy for regional CDN failures
pub(crate) fn build_cdn_playback_url(claim_id: &str, gateway: &str) -> String {
    format!("{}/content/{}/{}", gateway, claim_id, HLS_MASTER_PLAYLIST)
}

/// Validate CDN reachability (development mode only, non-blocking)
///
/// This function performs an optional HEAD request to validate that the constructed CDN URL
/// is reachable. It is only active in development builds and does NOT block playback.
///
/// # Purpose
/// Provides early warning if CDN behavior changes (requires headers, returns 403, changes URL pattern)
/// without breaking production playback.
///
/// # Arguments
/// * `url` - The CDN playback URL to validate
///
/// # Behavior
/// - Only active in development mode (`#[cfg(debug_assertions)]`)
/// - Uses HEAD request with 1-2 second timeout
/// - All results logged at DEBUG level (not ERROR)
/// - Does NOT block playback URL construction or return
/// - Timeout prevents dev server hangs if CDN is slow
///
/// # Logging
/// - DEBUG: CDN reachability OK (200 status)
/// - DEBUG: CDN returned 403 (possible auth requirement)
/// - DEBUG: CDN returned non-200 status
/// - DEBUG: Request timeout or network error
#[cfg(debug_assertions)]

// Content discovery commands

#[tauri::command]
pub async fn test_connection() -> Result<String> {
    info!("🧪 TEST: test_connection called");
    Ok("tauri-backend-alive".to_string())
}

#[tauri::command]
pub fn build_cdn_playback_url_test(claim_id: String) -> String {
    info!(
        "🧪 TEST: build_cdn_playback_url_test called with claim_id: {}",
        claim_id
    );
    let gateway = get_cdn_gateway();
    build_cdn_playback_url(&claim_id, gateway)
}

#[tauri::command]
pub async fn fetch_channel_claims(
    channel_id: String,
    any_tags: Option<Vec<String>>,
    text: Option<String>,
    limit: Option<u32>,
    page: Option<u32>,
    force_refresh: Option<bool>,
    stream_types: Option<Vec<String>>,
    state: State<'_, AppState>,
) -> Result<Vec<ContentItem>> {
    info!("🚀 DIAGNOSTIC: fetch_channel_claims called");
    info!(
        "   channel_id={}, tags={:?}, text={:?}, limit={:?}, stream_types={:?}, force_refresh={:?}",
        channel_id, any_tags, text, limit, stream_types, force_refresh
    );

    // Wrap entire function in error logging
    let result = async {
        // Validate channel_id
        info!("🔍 DIAGNOSTIC: Validating channel_id");
        let validated_channel_id = validation::validate_channel_id(&channel_id)?;
        info!(
            "✅ DIAGNOSTIC: Channel ID validated: {}",
            validated_channel_id
        );

        // Validate inputs
        info!("🔍 DIAGNOSTIC: Validating inputs");
        let validated_tags = if let Some(tags) = any_tags.as_ref() {
            Some(validation::validate_tags(tags)?)
        } else {
            None
        };

        let validated_text = if let Some(t) = text.as_ref() {
            Some(validation::validate_search_text(t)?)
        } else {
            None
        };

        let validated_limit = if let Some(l) = limit {
            Some(sanitization::sanitize_limit(l)?)
        } else {
            None
        };

        let validated_page = if let Some(p) = page {
            Some(sanitization::sanitize_offset(p)?)
        } else {
            None
        };

        let should_force_refresh = force_refresh.unwrap_or(false);
        info!("✅ DIAGNOSTIC: All inputs validated");

        // Skip cache if force_refresh is true
        if !should_force_refresh {
            info!("🔍 DIAGNOSTIC: Checking cache");
            // First, try to get from local cache
            let db = state.db.lock().await;
            let query = CacheQuery {
                tags: validated_tags.clone(),
                text_search: validated_text.clone(),
                limit: validated_limit,
                offset: validated_page.map(|p| p * validated_limit.unwrap_or(50)),
                order_by: Some("releaseTime DESC".to_string()),
            };
            info!("🔍 DIAGNOSTIC: Calling db.get_cached_content");
            let cached_items = db.get_cached_content(query).await?;
            info!("🔍 DIAGNOSTIC: Cache returned {} items", cached_items.len());

            // CRITICAL FIX: Return cache if we have ANY valid results, not just >= 6
            // This fixes the hero_trailer issue where only 1 video exists
            // The >= 6 threshold was arbitrary and broke single-item queries
            if !cached_items.is_empty() && validated_text.is_none() {
                info!(
                    "✅ DIAGNOSTIC: Returning {} items from cache",
                    cached_items.len()
                );
                drop(db);
                return Ok(cached_items);
            }
            info!("🔍 DIAGNOSTIC: Cache miss or text search, fetching from remote");
            drop(db);
        } else {
            info!("🔍 DIAGNOSTIC: Force refresh enabled, skipping cache");
        }

        // Otherwise, fetch from remote
        info!("🔍 DIAGNOSTIC: Acquiring gateway lock");
        let mut gateway = state.gateway.lock().await;
        info!("✅ DIAGNOSTIC: Gateway lock acquired");

        let request = OdyseeRequest {
            method: "claim_search".to_string(),
            params: json!({
                "channel": validated_channel_id,
                "any_tags": validated_tags,
                "text": validated_text,
                "page_size": validated_limit.unwrap_or(50),
                "page": validated_page.unwrap_or(1),
                "order_by": ["release_time"],
                "stream_types": stream_types
            }),
        };

        info!("🌐 DIAGNOSTIC: Sending API request: {:?}", request);
        
        // TRACING: Stage 1 - claim_search call
        info!(
            component = "content_pipeline",
            stage = "claim_search_call",
            channel_id = %validated_channel_id,
            tags = ?validated_tags,
            text = ?validated_text,
            limit = ?validated_limit,
            page = ?validated_page,
            force_refresh = should_force_refresh,
            "Stage 1: Sending claim_search API request"
        );
        
        info!("🔍 DIAGNOSTIC: Calling gateway.fetch_with_failover");
        let response = gateway.fetch_with_failover(request).await?;
        info!(
            "📥 DIAGNOSTIC: Received API response: success={}, has_data={}",
            response.success,
            response.data.is_some()
        );
        info!("🔍 DIAGNOSTIC: Dropping gateway lock");
        drop(gateway);

        // Parse response and extract content items
        info!("🔍 DIAGNOSTIC: Calling parse_claim_search_response");
        let items = parse_claim_search_response(response)?;
        info!("✅ DIAGNOSTIC: Parsed {} items", items.len());

        // Store in cache
        info!("🔍 DIAGNOSTIC: Acquiring database lock for caching");
        let db = state.db.lock().await;
        info!("🔍 DIAGNOSTIC: Storing items in cache");
        db.store_content_items(items.clone()).await?;
        info!("💾 DIAGNOSTIC: Stored {} items in cache", items.len());
        drop(db);

        info!(
            "🎯 DIAGNOSTIC: About to return {} items to frontend",
            items.len()
        );
        
        // TRACING: Stage 5 - backend return
        info!(
            component = "content_pipeline",
            stage = "backend_return",
            item_count = items.len(),
            cached = false,
            "Stage 5: Returning content items to frontend via IPC"
        );
        
        // Per-item details at debug level
        for item in &items {
            debug!(
                component = "content_pipeline",
                stage = "backend_return_item",
                claim_id = %item.claim_id,
                title = %item.title,
                has_video_urls = !item.video_urls.is_empty(),
                video_url_keys = ?item.video_urls.keys().collect::<Vec<_>>(),
                "Returning item to frontend"
            );
        }
        
        Ok(items)
    }
    .await;

    match &result {
        Ok(items) => {
            info!(
                "✅ DIAGNOSTIC: fetch_channel_claims returning SUCCESS with {} items",
                items.len()
            );
        }
        Err(e) => {
            error!("❌ DIAGNOSTIC: fetch_channel_claims returning ERROR: {}", e);
        }
    }

    result
}

#[command]
pub async fn fetch_playlists(
    channel_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Playlist>> {
    info!("Fetching playlists: channel_id={}", channel_id);

    // Validate channel_id
    let validated_channel_id = validation::validate_channel_id(&channel_id)?;

    let mut gateway = state.gateway.lock().await;

    let request = OdyseeRequest {
        method: "playlist_search".to_string(),
        params: json!({
            "channel": validated_channel_id,
            "page_size": 50
        }),
    };

    let response = gateway.fetch_with_failover(request).await?;
    let playlists = parse_playlist_search_response(response)?;

    info!("Fetched {} playlists", playlists.len());
    Ok(playlists)
}

#[command]
pub async fn resolve_claim(
    claim_id_or_uri: String,
    state: State<'_, AppState>,
) -> Result<ContentItem> {
    info!("Resolving claim: {}", claim_id_or_uri);

    // Validate claim ID/URI
    let validated_claim = validation::validate_claim_id(&claim_id_or_uri)?;

    let mut gateway = state.gateway.lock().await;

    let request = OdyseeRequest {
        method: "get".to_string(),
        params: json!({
            "uri": validated_claim
        }),
    };

    let response = gateway.fetch_with_failover(request).await?;
    let item = parse_resolve_response(response)?;

    info!("Resolved claim: {}", item.title);
    Ok(item)
}

// Download commands

#[command]
pub async fn download_movie_quality(
    claim_id: String,
    quality: String,
    url: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    info!("Starting download: {} ({})", claim_id, quality);

    // Validate inputs
    let validated_claim_id = validation::validate_claim_id(&claim_id)?;
    let validated_quality = validation::validate_quality(&quality)?;
    let validated_url = validation::validate_download_url(&url)?;

    let download_manager = state.download_manager.lock().await;

    // Check if encryption is enabled
    let db = state.db.lock().await;
    let encrypt_setting = db.get_setting("encrypt_downloads").await?;
    let encrypt = encrypt_setting.as_deref() == Some("true");
    drop(db);

    let request = DownloadRequest {
        claim_id: validated_claim_id.clone(),
        quality: validated_quality.clone(),
        url: validated_url,
    };

    match download_manager
        .download_content(request, app_handle.clone(), encrypt)
        .await
    {
        Ok(metadata) => {
            // Store offline metadata in database
            let db = state.db.lock().await;
            db.save_offline_metadata(metadata.clone()).await?;

            info!(
                "Download completed successfully: {} ({})",
                validated_claim_id, validated_quality
            );
            Ok(())
        }
        Err(e) => {
            error!(
                "Download failed: {} ({}) - {}",
                validated_claim_id, validated_quality, e
            );

            // Clean up any partial files from the failed download
            if let Err(cleanup_err) = download_manager
                .cleanup_failed_download(&validated_claim_id, &validated_quality)
                .await
            {
                warn!("Failed to clean up after download error: {}", cleanup_err);
            }

            // Emit detailed error event
            let _ = app_handle.emit_all(
                "download-error",
                json!({
                    "claimId": validated_claim_id,
                    "quality": validated_quality,
                    "error": e.to_string(),
                    "errorCategory": e.category(),
                    "userMessage": e.user_message(),
                    "recoverable": e.is_recoverable(),
                }),
            );

            Err(e)
        }
    }
}

#[command]
pub async fn stream_offline(
    claim_id: String,
    quality: String,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<StreamOfflineResponse> {
    info!("Starting offline stream: {} ({})", claim_id, quality);

    // Validate inputs
    let validated_claim_id = validation::validate_claim_id(&claim_id)?;
    let validated_quality = validation::validate_quality(&quality)?;

    // Get offline metadata
    let db = state.db.lock().await;
    let metadata = db
        .get_offline_metadata(&validated_claim_id, &validated_quality)
        .await?
        .ok_or_else(|| KiyyaError::ContentNotFound {
            claim_id: validated_claim_id.clone(),
        })?;
    drop(db);

    // Get file path
    let download_manager = state.download_manager.lock().await;
    let file_path = download_manager
        .get_content_path(&metadata.filename)
        .await?;
    drop(download_manager);

    // Start local server if not running
    let mut server = state.local_server.lock().await;
    let port = server.start().await?;

    // Register content for streaming
    let uuid = format!("{}-{}", validated_claim_id, validated_quality);
    server
        .register_content(&uuid, file_path, metadata.encrypted)
        .await?;
    drop(server);

    let response = StreamOfflineResponse {
        url: format!("http://127.0.0.1:{}/movies/{}", port, uuid),
        port,
    };

    // Emit server started event
    let _ = app_handle.emit_all(
        "local-server-started",
        json!({
            "port": port,
            "url": response.url
        }),
    );

    info!("Offline stream ready: {}", response.url);
    Ok(response)
}

#[command]
pub async fn delete_offline(
    claim_id: String,
    quality: String,
    state: State<'_, AppState>,
) -> Result<()> {
    info!("Deleting offline content: {} ({})", claim_id, quality);

    // Validate inputs
    let validated_claim_id = validation::validate_claim_id(&claim_id)?;
    let validated_quality = validation::validate_quality(&quality)?;

    // Get metadata
    let db = state.db.lock().await;
    let metadata = db
        .get_offline_metadata(&validated_claim_id, &validated_quality)
        .await?
        .ok_or_else(|| KiyyaError::ContentNotFound {
            claim_id: validated_claim_id.clone(),
        })?;

    // Delete from database
    db.delete_offline_metadata(&validated_claim_id, &validated_quality)
        .await?;
    drop(db);

    // Delete file
    let download_manager = state.download_manager.lock().await;
    download_manager
        .delete_content(&validated_claim_id, &validated_quality, &metadata.filename)
        .await?;

    // Unregister from server
    let server = state.local_server.lock().await;
    let uuid = format!("{}-{}", validated_claim_id, validated_quality);
    server.unregister_content(&uuid).await?;

    info!(
        "Deleted offline content: {} ({})",
        validated_claim_id, validated_quality
    );
    Ok(())
}

// Progress and state commands

#[command]
pub async fn save_progress(
    claim_id: String,
    position_seconds: u32,
    quality: String,
    state: State<'_, AppState>,
) -> Result<()> {
    // Validate inputs
    let validated_claim_id = validation::validate_claim_id(&claim_id)?;
    let validated_position = validation::validate_position_seconds(position_seconds)?;
    let validated_quality = validation::validate_quality(&quality)?;

    let progress = ProgressData {
        claim_id: validated_claim_id,
        position_seconds: validated_position,
        quality: validated_quality,
        updated_at: chrono::Utc::now().timestamp(),
    };

    let db = state.db.lock().await;
    db.save_progress(progress).await?;

    Ok(())
}

#[command]
pub async fn get_progress(
    claim_id: String,
    state: State<'_, AppState>,
) -> Result<Option<ProgressData>> {
    // Validate input
    let validated_claim_id = validation::validate_claim_id(&claim_id)?;

    let db = state.db.lock().await;
    let progress = db.get_progress(&validated_claim_id).await?;
    Ok(progress)
}

#[command]
pub async fn save_favorite(
    claim_id: String,
    title: String,
    thumbnail_url: Option<String>,
    state: State<'_, AppState>,
) -> Result<()> {
    // Validate inputs
    let validated_claim_id = validation::validate_claim_id(&claim_id)?;
    let validated_title = validation::validate_title(&title)?;
    let validated_thumbnail = if let Some(url) = thumbnail_url {
        Some(validation::validate_download_url(&url)?)
    } else {
        None
    };

    let favorite = FavoriteItem {
        claim_id: validated_claim_id,
        title: validated_title,
        thumbnail_url: validated_thumbnail,
        inserted_at: chrono::Utc::now().timestamp(),
    };

    let db = state.db.lock().await;
    db.save_favorite(favorite).await?;

    Ok(())
}

#[command]
pub async fn remove_favorite(claim_id: String, state: State<'_, AppState>) -> Result<()> {
    // Validate input
    let validated_claim_id = validation::validate_claim_id(&claim_id)?;

    let db = state.db.lock().await;
    db.remove_favorite(&validated_claim_id).await?;
    Ok(())
}

#[command]
pub async fn get_favorites(state: State<'_, AppState>) -> Result<Vec<FavoriteItem>> {
    let db = state.db.lock().await;
    let favorites = db.get_favorites().await?;
    Ok(favorites)
}

#[command]
pub async fn is_favorite(claim_id: String, state: State<'_, AppState>) -> Result<bool> {
    let validated_claim_id = validate_claim_id(&claim_id)?;

    let db = state.db.lock().await;
    let is_fav = db.is_favorite(&validated_claim_id).await?;
    Ok(is_fav)
}

// Configuration and diagnostics

#[command]
pub async fn get_app_config(state: State<'_, AppState>) -> Result<AppConfig> {
    let db = state.db.lock().await;

    let theme = db
        .get_setting("theme")
        .await?
        .unwrap_or_else(|| "dark".to_string());
    let last_used_quality = db
        .get_setting("last_used_quality")
        .await?
        .unwrap_or_else(|| "master".to_string());
    let encrypt_downloads = db
        .get_setting("encrypt_downloads")
        .await?
        .unwrap_or_else(|| "false".to_string())
        == "true";
    let auto_upgrade_quality = db
        .get_setting("auto_upgrade_quality")
        .await?
        .unwrap_or_else(|| "true".to_string())
        == "true";
    let cache_ttl_minutes = db
        .get_setting("cache_ttl_minutes")
        .await?
        .unwrap_or_else(|| "30".to_string())
        .parse()
        .unwrap_or(30);
    let max_cache_items = db
        .get_setting("max_cache_items")
        .await?
        .unwrap_or_else(|| "200".to_string())
        .parse()
        .unwrap_or(200);

    let download_manager = state.download_manager.lock().await;
    let vault_path = download_manager
        .get_vault_path()
        .to_string_lossy()
        .to_string();
    drop(download_manager);

    let config = AppConfig {
        theme,
        last_used_quality,
        encrypt_downloads,
        auto_upgrade_quality,
        cache_ttl_minutes,
        max_cache_items,
        vault_path,
        version: env!("CARGO_PKG_VERSION").to_string(),
        gateways: vec![
            "https://api.na-backend.odysee.com/api/v1/proxy".to_string(),
            "https://api.lbry.tv/api/v1/proxy".to_string(),
            "https://api.odysee.com/api/v1/proxy".to_string(),
        ],
    };

    Ok(config)
}

#[command]
pub async fn update_settings(
    settings: HashMap<String, String>,
    state: State<'_, AppState>,
) -> Result<()> {
    let db = state.db.lock().await;

    for (key, value) in settings {
        // Validate setting key and value
        let validated_key = validation::validate_setting_key(&key)?;
        let validated_value = validation::validate_setting_value(&validated_key, &value)?;

        db.set_setting(&validated_key, &validated_value).await?;
    }

    Ok(())
}

#[command]
pub async fn get_diagnostics(state: State<'_, AppState>) -> Result<DiagnosticsData> {
    let gateway = state.gateway.lock().await;
    let server = state.local_server.lock().await;
    let db = state.db.lock().await;
    let download_manager = state.download_manager.lock().await;

    let vault_path = download_manager.get_vault_path();
    let diagnostics =
        diagnostics::collect_diagnostics(&*gateway, &*server, &*db, vault_path, &*download_manager)
            .await?;

    Ok(diagnostics)
}

#[command]
pub async fn collect_debug_package(
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<String> {
    info!("Collecting debug package");

    let db = state.db.lock().await;
    let download_manager = state.download_manager.lock().await;
    let vault_path = download_manager.get_vault_path();

    // Get app data directory
    let app_data_path = app_handle.path_resolver().app_data_dir().ok_or_else(|| {
        KiyyaError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "Could not determine app data directory",
        ))
    })?;

    let debug_package_path =
        diagnostics::collect_debug_package(&*db, vault_path, &app_data_path).await?;

    info!("Debug package created at: {:?}", debug_package_path);
    Ok(debug_package_path.to_string_lossy().to_string())
}

// Crash reporting commands

#[command]
pub async fn get_recent_crashes(limit: usize) -> Result<Vec<crate::crash_reporting::CrashReport>> {
    info!("Getting recent crashes (limit: {})", limit);

    let crashes =
        crate::crash_reporting::get_recent_crashes(limit).map_err(|e| KiyyaError::Io(e))?;

    Ok(crashes)
}

#[command]
pub async fn clear_crash_log() -> Result<()> {
    info!("Clearing crash log");

    crate::crash_reporting::clear_crash_log().map_err(|e| KiyyaError::Io(e))?;

    Ok(())
}

// Cache management commands

#[command]
pub async fn invalidate_cache_item(claim_id: String, state: State<'_, AppState>) -> Result<bool> {
    info!("Invalidating cache for item: {}", claim_id);

    // Validate input
    let validated_claim_id = validation::validate_claim_id(&claim_id)?;

    let db = state.db.lock().await;
    let invalidated = db.invalidate_cache_item(&validated_claim_id).await?;

    Ok(invalidated)
}

#[command]
pub async fn invalidate_cache_by_tags(
    tags: Vec<String>,
    state: State<'_, AppState>,
) -> Result<u32> {
    info!("Invalidating cache for tags: {:?}", tags);

    // Validate tags
    let validated_tags = validation::validate_tags(&tags)?;

    let db = state.db.lock().await;
    let count = db.invalidate_cache_by_tags(validated_tags).await?;

    info!("Invalidated {} cache items", count);
    Ok(count)
}

#[command]
pub async fn clear_all_cache(state: State<'_, AppState>) -> Result<u32> {
    info!("Clearing all cache");

    let db = state.db.lock().await;
    let count = db.clear_all_cache().await?;

    info!("Cleared {} cache items", count);
    Ok(count)
}

#[command]
pub async fn cleanup_expired_cache(state: State<'_, AppState>) -> Result<u32> {
    info!("Cleaning up expired cache");

    let db = state.db.lock().await;
    let count = db.cleanup_expired_cache().await?;

    info!("Cleaned up {} expired cache items", count);
    Ok(count)
}

#[command]
pub async fn get_cache_stats(state: State<'_, AppState>) -> Result<CacheStats> {
    let db = state.db.lock().await;
    let stats = db.get_cache_stats().await?;

    Ok(stats)
}

#[command]
pub async fn get_memory_stats(state: State<'_, AppState>) -> Result<MemoryStats> {
    let db = state.db.lock().await;
    let stats = db.get_memory_stats().await?;

    Ok(stats)
}

#[command]
pub async fn optimize_database_memory(state: State<'_, AppState>) -> Result<()> {
    let db = state.db.lock().await;
    db.optimize_memory().await?;

    info!("Database memory optimization completed");
    Ok(())
}

#[command]
pub async fn open_external(url: String) -> Result<()> {
    // Validate URL for security
    let validated_url = validation::validate_external_url(&url)?;

    // Use tauri shell API to open URL in default browser
    std::process::Command::new("cmd")
        .args(&["/c", "start", &validated_url])
        .spawn()
        .map_err(|e| KiyyaError::Io(e))?;
    Ok(())
}

// Helper functions for parsing Odysee responses

pub fn parse_claim_search_response(response: OdyseeResponse) -> Result<Vec<ContentItem>> {
    // TRACING: Stage 2 - claim parsing
    let items_count = response.data.as_ref()
        .and_then(|d| d.get("items"))
        .and_then(|i| i.as_array())
        .map(|a| a.len())
        .unwrap_or(0);
    
    info!(
        component = "content_pipeline",
        stage = "claim_parsing",
        total_items = items_count,
        success = response.success,
        "Stage 2: Parsing claim_search response"
    );
    
    // 🔍 STEP 1: Verify response has data
    let data = response.data.ok_or_else(|| {
        error!("❌ DIAGNOSTIC: No data in response");
        KiyyaError::ContentParsing {
            message: "No data in response".to_string(),
        }
    })?;
    info!("✅ DIAGNOSTIC: Response has data field");

    // 🔍 STEP 2: Verify items array exists
    let items = data
        .get("items")
        .and_then(|v| v.as_array())
        .ok_or_else(|| {
            error!(
                "❌ DIAGNOSTIC: No items array in response. Data keys: {:?}",
                data.as_object().map(|o| o.keys().collect::<Vec<_>>())
            );
            KiyyaError::ContentParsing {
                message: "No items array in response".to_string(),
            }
        })?;
    info!(
        "✅ DIAGNOSTIC: Found items array with {} claims",
        items.len()
    );

    // 🔍 STEP 3: Log raw claims for inspection
    for (idx, item) in items.iter().enumerate() {
        let claim_id = item
            .get("claim_id")
            .and_then(|v| v.as_str())
            .unwrap_or("missing");
        let value_type = item
            .get("value_type")
            .and_then(|v| v.as_str())
            .unwrap_or("missing");
        let tags = item
            .get("value")
            .and_then(|v| v.get("tags"))
            .and_then(|t| t.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>())
            .unwrap_or_default();
        info!(
            "  📦 DIAGNOSTIC: Claim[{}]: id={}, type={}, tags={:?}",
            idx, claim_id, value_type, tags
        );
    }

    let mut content_items = Vec::new();
    let mut skipped_count = 0;

    // 🔍 STEP 4: Parse each claim and track results
    for (idx, item) in items.iter().enumerate() {
        match parse_claim_item(item) {
            Ok(content_item) => {
                // TRACING: Per-item parsing success
                debug!(
                    component = "content_pipeline",
                    stage = "claim_parsing_item",
                    claim_id = %content_item.claim_id,
                    title = %content_item.title,
                    has_video_urls = !content_item.video_urls.is_empty(),
                    video_url_count = content_item.video_urls.len(),
                    "Parsed individual claim item"
                );
                
                info!(
                    "  ✅ DIAGNOSTIC: Claim[{}] parsed successfully: id={}",
                    idx, content_item.claim_id
                );
                content_items.push(content_item);
            }
            Err(e) => {
                skipped_count += 1;
                let claim_id = item
                    .get("claim_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown");
                warn!(
                    "  ⚠️ DIAGNOSTIC: Claim[{}] SKIPPED: id={}, reason={}",
                    idx, claim_id, e
                );
                // Continue processing other items (partial success)
            }
        }
    }

    info!(
        "📊 DIAGNOSTIC: Parsing complete - Valid: {}, Skipped: {}, Total: {}",
        content_items.len(),
        skipped_count,
        items.len()
    );

    Ok(content_items)
}

pub fn parse_playlist_search_response(response: OdyseeResponse) -> Result<Vec<Playlist>> {
    let data = response.data.ok_or_else(|| KiyyaError::ContentParsing {
        message: "No data in response".to_string(),
    })?;

    let items = data
        .get("items")
        .and_then(|v| v.as_array())
        .ok_or_else(|| KiyyaError::ContentParsing {
            message: "No items array in response".to_string(),
        })?;

    let mut playlists = Vec::new();

    for item in items {
        match parse_playlist_item(item) {
            Ok(playlist) => playlists.push(playlist),
            Err(e) => {
                warn!("Failed to parse playlist item: {} - Raw data: {}", e, item);
            }
        }
    }

    Ok(playlists)
}

pub fn parse_resolve_response(response: OdyseeResponse) -> Result<ContentItem> {
    let data = response.data.ok_or_else(|| KiyyaError::ContentParsing {
        message: "No data in response".to_string(),
    })?;

    parse_claim_item(&data)
}

pub fn parse_claim_item(item: &Value) -> Result<ContentItem> {
    // Defensive parsing - handle multiple possible field locations
    // Log raw item for debugging if parsing fails
    let claim_id = extract_claim_id(item).map_err(|e| {
        warn!(
            "Failed to extract claim_id from item: {} - Raw: {}",
            e, item
        );
        e
    })?;

    // DEBUG: Log claim metadata for URL construction verification
    if let Some(claim_name) = item.get("name").and_then(|v| v.as_str()) {
        if let Some(value) = item.get("value") {
            if let Some(source) = value.get("source") {
                if let Some(sd_hash) = source.get("sd_hash").and_then(|v| v.as_str()) {
                    let file_stub = if sd_hash.len() >= 6 { &sd_hash[..6] } else { "N/A" };
                    println!("\n🎬 VIDEO URL CONSTRUCTION:");
                    println!("   Claim Name: {}", claim_name);
                    println!("   Claim ID: {}", claim_id);
                    println!("   SD Hash: {}", sd_hash);
                    println!("   File Stub (first 6 of sd_hash): {}", file_stub);
                    println!("   Expected URL: https://player.odycdn.com/api/v3/streams/free/{}/{}/{}.mp4\n", 
                        claim_name, claim_id, file_stub);
                }
            }
        }
    }

    // TRACING: Stage 3 - stream validation
    let value_type = item.get("value_type").and_then(|v| v.as_str()).unwrap_or("unknown");
    let has_stream = item.get("value").and_then(|v| v.get("stream")).is_some();
    let has_sd_hash = item.get("value")
        .and_then(|v| v.get("source"))
        .and_then(|s| s.get("sd_hash"))
        .is_some();
    
    info!(
        component = "content_pipeline",
        stage = "stream_validation",
        claim_id = %claim_id,
        value_type = value_type,
        has_stream = has_stream,
        has_sd_hash = has_sd_hash,
        "Stage 3: Validating stream data"
    );

    let title = extract_title(item)?;
    let description = extract_description(item);
    let tags = extract_tags(item);
    let thumbnail_url = extract_thumbnail_url(item);
    let duration = extract_duration(item);
    let release_time = extract_release_time(item);

    // Extract video URLs with enhanced error context
    let video_urls = extract_video_urls(item).map_err(|e| {
        warn!(
            "Failed to extract video URLs for claim {}: {} - Raw: {}",
            claim_id, e, item
        );
        e
    })?;

    let compatibility = assess_compatibility(&video_urls);

    // Store raw JSON for debugging purposes
    let raw_json = serde_json::to_string(item).ok();

    let mut content_item = ContentItem {
        claim_id,
        title,
        description,
        tags,
        thumbnail_url,
        duration,
        release_time,
        video_urls,
        compatibility,
        etag: None,
        content_hash: None,
        raw_json,
    };

    // Compute content hash
    content_item.update_content_hash();

    Ok(content_item)
}

pub fn parse_playlist_item(item: &Value) -> Result<Playlist> {
    // Defensive parsing with validation
    let id = item
        .get("claim_id")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .ok_or_else(|| {
            warn!("Missing or empty claim_id in playlist item - Raw: {}", item);
            KiyyaError::ContentParsing {
                message: "Missing or empty claim_id in playlist item".to_string(),
            }
        })?;

    // Extract title with fallback to empty string, then validate
    let title = item
        .get("value")
        .and_then(|v| v.get("title"))
        .and_then(|v| v.as_str())
        .or_else(|| item.get("title").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string();

    // Validate title is not empty
    if title.is_empty() {
        warn!("Empty title in playlist item {} - Raw: {}", id, item);
    }

    let claim_id = id.clone();

    // Parse season number from title if possible
    let season_number = extract_season_number_from_title(&title);
    let series_key = extract_series_key_from_title(&title);

    Ok(Playlist {
        id,
        title,
        claim_id,
        items: Vec::new(), // Items would be fetched separately
        season_number,
        series_key,
    })
}

// Defensive extraction functions

fn extract_claim_id(item: &Value) -> Result<String> {
    item.get("claim_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| KiyyaError::ContentParsing {
            message: "Missing claim_id".to_string(),
        })
}

fn extract_title(item: &Value) -> Result<String> {
    // Try multiple locations for title
    let title = item
        .get("value")
        .and_then(|v| v.get("title"))
        .and_then(|v| v.as_str())
        .or_else(|| item.get("title").and_then(|v| v.as_str()))
        .or_else(|| item.get("name").and_then(|v| v.as_str()))
        .unwrap_or("Untitled");

    Ok(title.to_string())
}

fn extract_description(item: &Value) -> Option<String> {
    item.get("value")
        .and_then(|v| v.get("description"))
        .and_then(|v| v.as_str())
        .or_else(|| item.get("description").and_then(|v| v.as_str()))
        .map(|s| s.to_string())
}

fn extract_tags(item: &Value) -> Vec<String> {
    // Try multiple locations for tags
    let tags = item
        .get("value")
        .and_then(|v| v.get("tags"))
        .and_then(|v| v.as_array())
        .or_else(|| item.get("tags").and_then(|v| v.as_array()))
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .filter(|s| !s.is_empty()) // Filter out empty tags
                .map(|s| s.trim().to_lowercase()) // Normalize tags
                .collect::<Vec<String>>()
        })
        .unwrap_or_default();

    // Remove duplicates while preserving order
    let mut seen = std::collections::HashSet::new();
    tags.into_iter()
        .filter(|tag| seen.insert(tag.clone()))
        .collect()
}

fn extract_thumbnail_url(item: &Value) -> Option<String> {
    // Try multiple thumbnail locations with validation
    item.get("value")
        .and_then(|v| v.get("thumbnail"))
        .and_then(|v| v.get("url"))
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty() && s.starts_with("http"))
        .or_else(|| {
            item.get("value")
                .and_then(|v| v.get("thumbnail"))
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty() && s.starts_with("http"))
        })
        .or_else(|| {
            item.get("thumbnail")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty() && s.starts_with("http"))
        })
        .or_else(|| {
            // Try alternative field names
            item.get("value")
                .and_then(|v| v.get("cover"))
                .and_then(|v| v.get("url"))
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty() && s.starts_with("http"))
        })
        .or_else(|| {
            item.get("value")
                .and_then(|v| v.get("image"))
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty() && s.starts_with("http"))
        })
        .map(|s| s.to_string())
}

fn extract_duration(item: &Value) -> Option<u32> {
    // Try multiple locations and formats for duration
    item.get("value")
        .and_then(|v| v.get("video"))
        .and_then(|v| v.get("duration"))
        .and_then(|v| v.as_u64())
        .map(|d| d as u32)
        .or_else(|| {
            // Try direct duration field
            item.get("value")
                .and_then(|v| v.get("duration"))
                .and_then(|v| v.as_u64())
                .map(|d| d as u32)
        })
        .or_else(|| {
            // Try duration as string and parse
            item.get("value")
                .and_then(|v| v.get("video"))
                .and_then(|v| v.get("duration"))
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse::<u32>().ok())
        })
        .or_else(|| {
            // Try length field as alternative
            item.get("value")
                .and_then(|v| v.get("length"))
                .and_then(|v| v.as_u64())
                .map(|d| d as u32)
        })
}

fn extract_release_time(item: &Value) -> i64 {
    item.get("timestamp")
        .and_then(|v| v.as_i64())
        .or_else(|| item.get("release_time").and_then(|v| v.as_i64()))
        .unwrap_or_else(|| chrono::Utc::now().timestamp())
}

/// Extract video URLs from claim metadata using CDN-only URL construction.
///
/// This function validates that the claim is a stream type, extracts the claim_id,
/// and constructs a deterministic CDN playback URL. It no longer attempts to extract
/// direct video URLs from API responses.
///
/// # Arguments
/// * `item` - JSON value containing claim metadata
///
/// # Returns
/// * `Result<HashMap<String, VideoUrl>>` - HashMap with single "master" entry containing HLS URL
/// * Error if claim_id is missing or claim is not a stream type
///
/// # Behavior
/// 1. Validates claim is stream type (value_type == "stream" or has value.source.sd_hash)
/// 2. Extracts claim_id from item
/// 3. Constructs CDN playback URL using build_cdn_playback_url
/// 4. Returns HashMap with single "master" quality entry
///
/// # Error Handling
/// All errors include claim_id context when available for debugging and telemetry.
/// Error types:
/// - `ContentParsing`: Non-stream claim type, missing claim_id, ambiguous structure
///
/// # Logging Levels (Idempotent Discipline)
/// - **DEBUG**: CDN URL construction per-request (prevents spam on Hero refresh)
/// - **WARN**: Skipped claims (non-stream type, missing claim_id, ambiguous structure)
///
/// # Future Enhancement
/// Future: Support multi-gateway fallback strategy for regional CDN failures.
/// Error structure includes claim_id context to enable future CDN failover implementation.
fn extract_video_urls(item: &Value) -> Result<HashMap<String, VideoUrl>> {
    let claim_id_for_logging = item
        .get("claim_id")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");

    // 🔍 STEP 1: Validate claim type
    if let Some(value_type) = item.get("value_type").and_then(|v| v.as_str()) {
        info!(
            "    🔍 DIAGNOSTIC: Claim {} has value_type={}",
            claim_id_for_logging, value_type
        );
        if value_type != "stream" {
            warn!(
                "    ❌ DIAGNOSTIC: Rejecting non-stream claim {}: type={}",
                claim_id_for_logging, value_type
            );
            return Err(KiyyaError::ContentParsing {
                message: format!(
                    "Non-stream claim {} type: {}",
                    claim_id_for_logging, value_type
                ),
            });
        }
        info!(
            "    ✅ DIAGNOSTIC: Claim {} is stream type",
            claim_id_for_logging
        );
    } else {
        // Fallback inference: If value_type is missing, infer stream by presence of value.source.sd_hash
        let has_source = item
            .get("value")
            .and_then(|v| v.get("source"))
            .and_then(|s| s.get("sd_hash"))
            .is_some();

        if has_source {
            warn!("    ⚠️ DIAGNOSTIC: Claim {} missing value_type but has source.sd_hash, inferring stream", claim_id_for_logging);
        } else {
            warn!(
                "    ❌ DIAGNOSTIC: Claim {} missing value_type and no source.sd_hash",
                claim_id_for_logging
            );
            return Err(KiyyaError::ContentParsing {
                message: format!(
                    "Cannot determine if claim {} is stream type",
                    claim_id_for_logging
                ),
            });
        }
    }

    // 🔍 STEP 2: Extract claim_id
    let claim_id = item
        .get("claim_id")
        .and_then(|v| v.as_str())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            warn!("    ❌ DIAGNOSTIC: Missing or empty claim_id in item");
            KiyyaError::ContentParsing {
                message: "Missing or empty claim_id".to_string(),
            }
        })?;
    info!("    ✅ DIAGNOSTIC: Extracted claim_id={}", claim_id);

    // 🔍 STEP 3: Extract claim_name (video name)
    let claim_name = item
        .get("name")
        .and_then(|v| v.as_str())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            warn!("    ❌ DIAGNOSTIC: Missing or empty claim name in item");
            KiyyaError::ContentParsing {
                message: "Missing or empty claim name".to_string(),
            }
        })?;
    info!("    ✅ DIAGNOSTIC: Extracted claim_name={}", claim_name);

    // 🔍 STEP 4: Extract sd_hash from value.source
    let sd_hash = item
        .get("value")
        .and_then(|v| v.get("source"))
        .and_then(|s| s.get("sd_hash"))
        .and_then(|h| h.as_str())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            warn!("    ❌ DIAGNOSTIC: Missing or empty sd_hash in value.source");
            KiyyaError::ContentParsing {
                message: "Missing or empty sd_hash".to_string(),
            }
        })?;
    info!("    ✅ DIAGNOSTIC: Extracted sd_hash={}", sd_hash);

    // 🔍 STEP 5: Validate sd_hash length (must be at least 6 characters)
    if sd_hash.len() < 6 {
        warn!("    ❌ DIAGNOSTIC: sd_hash too short: {} characters", sd_hash.len());
        return Err(KiyyaError::ContentParsing {
            message: format!("sd_hash too short: {} characters (need at least 6)", sd_hash.len()),
        });
    }

    // 🔍 STEP 6: Construct Odysee streaming URL
    // Pattern discovered: https://player.odycdn.com/api/v3/streams/free/{claim_name}/{claim_id}/{first_6_of_sd_hash}.mp4
    let file_stub = &sd_hash[..6];
    let stream_url = format!(
        "https://player.odycdn.com/api/v3/streams/free/{}/{}/{}.mp4",
        claim_name,
        claim_id,
        file_stub
    );

    // TRACING: Stage 4 - CDN URL construction
    info!(
        component = "content_pipeline",
        stage = "cdn_url_construction",
        claim_id = %claim_id,
        claim_name = claim_name,
        sd_hash_prefix = file_stub,
        constructed_url = %stream_url,
        "Stage 4: Constructed Odysee streaming URL"
    );

    info!("    🎬 DIAGNOSTIC: Constructed stream URL: {}", stream_url);

    // Create VideoUrl struct with url_type="mp4", quality="master"
    let video_url = VideoUrl {
        url: stream_url.clone(),
        quality: "master".to_string(),
        url_type: "mp4".to_string(),
        codec: None,
    };

    // Insert into HashMap with key "master"
    let mut video_urls = HashMap::new();
    video_urls.insert("master".to_string(), video_url);

    info!("    ✅ DIAGNOSTIC: Created video_urls map with master entry");

    Ok(video_urls)
}

fn assess_compatibility(video_urls: &HashMap<String, VideoUrl>) -> CompatibilityInfo {
    // Simple compatibility assessment
    let has_mp4 = video_urls.values().any(|v| v.url_type == "mp4");
    let has_hls = video_urls.values().any(|v| v.url_type == "hls");

    CompatibilityInfo {
        compatible: has_mp4 || has_hls,
        reason: if !has_mp4 && !has_hls {
            Some("No compatible video formats found".to_string())
        } else {
            None
        },
        fallback_available: has_hls && !has_mp4,
    }
}

fn extract_season_number_from_title(title: &str) -> Option<u32> {
    // Parse season number from playlist title like "SeriesName – Season 1"
    let re = regex::Regex::new(r"[–-]\s*Season\s+(\d+)").unwrap();
    re.captures(title)
        .and_then(|caps| caps.get(1))
        .and_then(|m| m.as_str().parse().ok())
}

fn extract_series_key_from_title(title: &str) -> Option<String> {
    // Extract series key from playlist title
    let re = regex::Regex::new(r"^([^–-]+)").unwrap();
    re.captures(title)
        .and_then(|caps| caps.get(1))
        .map(|m| m.as_str().trim().to_lowercase().replace(' ', "_"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_build_cdn_playback_url_with_default_gateway() {
        let claim_id = "abc123def456";
        let url = build_cdn_playback_url(claim_id, DEFAULT_CDN_GATEWAY);

        assert_eq!(
            url,
            "https://cloud.odysee.live/content/abc123def456/master.m3u8"
        );
        assert!(url.contains(claim_id));
        assert!(url.contains(HLS_MASTER_PLAYLIST));
        assert!(url.starts_with(DEFAULT_CDN_GATEWAY));
    }

    #[test]
    fn test_build_cdn_playback_url_with_custom_gateway() {
        let claim_id = "xyz789abc123";
        let custom_gateway = "https://custom-cdn.example.com";
        let url = build_cdn_playback_url(claim_id, custom_gateway);

        assert_eq!(
            url,
            "https://custom-cdn.example.com/content/xyz789abc123/master.m3u8"
        );
        assert!(url.contains(claim_id));
        assert!(url.contains(HLS_MASTER_PLAYLIST));
        assert!(url.starts_with(custom_gateway));
    }

    #[test]
    fn test_build_cdn_playback_url_format() {
        let claim_id = "test-claim-id";
        let url = build_cdn_playback_url(claim_id, DEFAULT_CDN_GATEWAY);

        // Verify URL format matches pattern: {gateway}/content/{claim_id}/{HLS_MASTER_PLAYLIST}
        let expected_pattern = format!(
            "{}/content/{}/{}",
            DEFAULT_CDN_GATEWAY, claim_id, HLS_MASTER_PLAYLIST
        );
        assert_eq!(url, expected_pattern);
    }

    #[test]
    fn test_build_cdn_playback_url_with_special_characters() {
        // Test with claim_id containing special characters (should be handled by caller validation)
        let claim_id = "claim-with-dashes_and_underscores123";
        let url = build_cdn_playback_url(claim_id, DEFAULT_CDN_GATEWAY);

        assert!(url.contains(claim_id));
        assert_eq!(
            url,
            format!(
                "{}/content/{}/{}",
                DEFAULT_CDN_GATEWAY, claim_id, HLS_MASTER_PLAYLIST
            )
        );
    }

    #[test]
    fn test_build_cdn_playback_url_idempotent() {
        // Test that calling the function multiple times with same inputs produces same output
        let claim_id = "idempotent-test-claim";
        let gateway = "https://test-gateway.com";

        let url1 = build_cdn_playback_url(claim_id, gateway);
        let url2 = build_cdn_playback_url(claim_id, gateway);
        let url3 = build_cdn_playback_url(claim_id, gateway);

        assert_eq!(url1, url2);
        assert_eq!(url2, url3);
    }

    #[test]
    #[cfg(debug_assertions)]

    #[test]
    fn test_extract_claim_id() {
        let item = json!({
            "claim_id": "test-claim-123"
        });

        let result = extract_claim_id(&item);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "test-claim-123");
    }

    #[test]
    fn test_extract_claim_id_missing() {
        let item = json!({
            "title": "Test"
        });

        let result = extract_claim_id(&item);
        assert!(result.is_err());
    }

    #[test]
    fn test_extract_title() {
        // Test title in value.title
        let item1 = json!({
            "value": {
                "title": "Test Movie"
            }
        });
        assert_eq!(extract_title(&item1).unwrap(), "Test Movie");

        // Test title in title field
        let item2 = json!({
            "title": "Another Movie"
        });
        assert_eq!(extract_title(&item2).unwrap(), "Another Movie");

        // Test title in name field
        let item3 = json!({
            "name": "Named Movie"
        });
        assert_eq!(extract_title(&item3).unwrap(), "Named Movie");

        // Test missing title defaults to "Untitled"
        let item4 = json!({
            "claim_id": "test"
        });
        assert_eq!(extract_title(&item4).unwrap(), "Untitled");
    }

    #[test]
    fn test_extract_description() {
        // Test description in value.description
        let item1 = json!({
            "value": {
                "description": "Test description"
            }
        });
        assert_eq!(
            extract_description(&item1),
            Some("Test description".to_string())
        );

        // Test description in description field
        let item2 = json!({
            "description": "Another description"
        });
        assert_eq!(
            extract_description(&item2),
            Some("Another description".to_string())
        );

        // Test missing description
        let item3 = json!({
            "claim_id": "test"
        });
        assert_eq!(extract_description(&item3), None);
    }

    #[test]
    fn test_extract_tags() {
        // Test tags in value.tags
        let item1 = json!({
            "value": {
                "tags": ["movie", "action", "comedy"]
            }
        });
        let tags1 = extract_tags(&item1);
        assert_eq!(tags1, vec!["movie", "action", "comedy"]);

        // Test tags in tags field
        let item2 = json!({
            "tags": ["series", "drama"]
        });
        let tags2 = extract_tags(&item2);
        assert_eq!(tags2, vec!["series", "drama"]);

        // Test missing tags
        let item3 = json!({
            "claim_id": "test"
        });
        let tags3 = extract_tags(&item3);
        assert_eq!(tags3, Vec::<String>::new());

        // Test tags with empty strings (should be filtered out)
        let item4 = json!({
            "value": {
                "tags": ["movie", "", "action", ""]
            }
        });
        let tags4 = extract_tags(&item4);
        assert_eq!(tags4, vec!["movie", "action"]);

        // Test tags with whitespace (should be trimmed and normalized)
        let item5 = json!({
            "value": {
                "tags": [" Movie ", "ACTION", "  Comedy  "]
            }
        });
        let tags5 = extract_tags(&item5);
        assert_eq!(tags5, vec!["movie", "action", "comedy"]);

        // Test tags with duplicates (should be removed)
        let item6 = json!({
            "value": {
                "tags": ["movie", "action", "movie", "comedy", "action"]
            }
        });
        let tags6 = extract_tags(&item6);
        assert_eq!(tags6, vec!["movie", "action", "comedy"]);
    }

    #[test]
    fn test_extract_thumbnail_url() {
        // Test thumbnail in value.thumbnail.url
        let item1 = json!({
            "value": {
                "thumbnail": {
                    "url": "https://example.com/thumb1.jpg"
                }
            }
        });
        assert_eq!(
            extract_thumbnail_url(&item1),
            Some("https://example.com/thumb1.jpg".to_string())
        );

        // Test thumbnail in value.thumbnail (string)
        let item2 = json!({
            "value": {
                "thumbnail": "https://example.com/thumb2.jpg"
            }
        });
        assert_eq!(
            extract_thumbnail_url(&item2),
            Some("https://example.com/thumb2.jpg".to_string())
        );

        // Test thumbnail in thumbnail field
        let item3 = json!({
            "thumbnail": "https://example.com/thumb3.jpg"
        });
        assert_eq!(
            extract_thumbnail_url(&item3),
            Some("https://example.com/thumb3.jpg".to_string())
        );

        // Test missing thumbnail
        let item4 = json!({
            "claim_id": "test"
        });
        assert_eq!(extract_thumbnail_url(&item4), None);

        // Test empty thumbnail URL (should be filtered out)
        let item5 = json!({
            "value": {
                "thumbnail": ""
            }
        });
        assert_eq!(extract_thumbnail_url(&item5), None);

        // Test invalid thumbnail URL (not starting with http)
        let item6 = json!({
            "value": {
                "thumbnail": "invalid-url"
            }
        });
        assert_eq!(extract_thumbnail_url(&item6), None);

        // Test alternative field names (cover)
        let item7 = json!({
            "value": {
                "cover": {
                    "url": "https://example.com/cover.jpg"
                }
            }
        });
        assert_eq!(
            extract_thumbnail_url(&item7),
            Some("https://example.com/cover.jpg".to_string())
        );

        // Test alternative field names (image)
        let item8 = json!({
            "value": {
                "image": "https://example.com/image.jpg"
            }
        });
        assert_eq!(
            extract_thumbnail_url(&item8),
            Some("https://example.com/image.jpg".to_string())
        );
    }

    #[test]
    fn test_extract_duration() {
        let item = json!({
            "value": {
                "video": {
                    "duration": 3600
                }
            }
        });

        assert_eq!(extract_duration(&item), Some(3600));

        // Test missing duration
        let item2 = json!({
            "claim_id": "test"
        });
        assert_eq!(extract_duration(&item2), None);

        // Test duration in direct field
        let item3 = json!({
            "value": {
                "duration": 7200
            }
        });
        assert_eq!(extract_duration(&item3), Some(7200));

        // Test duration as string
        let item4 = json!({
            "value": {
                "video": {
                    "duration": "1800"
                }
            }
        });
        assert_eq!(extract_duration(&item4), Some(1800));

        // Test length field as alternative
        let item5 = json!({
            "value": {
                "length": 5400
            }
        });
        assert_eq!(extract_duration(&item5), Some(5400));
    }

    #[test]
    fn test_extract_release_time() {
        let item = json!({
            "timestamp": 1234567890
        });
        assert_eq!(extract_release_time(&item), 1234567890);

        let item2 = json!({
            "release_time": 9876543210i64
        });
        assert_eq!(extract_release_time(&item2), 9876543210);

        // Test missing timestamp (should return current time)
        let item3 = json!({
            "claim_id": "test"
        });
        let result = extract_release_time(&item3);
        assert!(result > 0);
    }

    #[test]
    fn test_extract_video_urls() {
        // Test with valid claim_id and stream type
        let item1 = json!({
            "claim_id": "abc123def456",
            "value_type": "stream",
            "value": {
                "title": "Test Video"
            }
        });
        let urls1 = extract_video_urls(&item1).unwrap();
        assert!(urls1.contains_key("master"));
        assert_eq!(urls1.get("master").unwrap().quality, "master");
        assert_eq!(urls1.get("master").unwrap().url_type, "hls");
        assert!(urls1.get("master").unwrap().url.contains("abc123def456"));
        assert!(urls1.get("master").unwrap().url.contains("master.m3u8"));

        // Test with missing claim_id
        let item2 = json!({
            "value_type": "stream",
            "value": {}
        });
        let result2 = extract_video_urls(&item2);
        assert!(result2.is_err());

        // Test with empty claim_id
        let item3 = json!({
            "claim_id": "",
            "value_type": "stream",
            "value": {}
        });
        let result3 = extract_video_urls(&item3);
        assert!(result3.is_err());

        // Test with non-stream claim type (channel)
        let item4 = json!({
            "claim_id": "channel123",
            "value_type": "channel",
            "value": {}
        });
        let result4 = extract_video_urls(&item4);
        assert!(result4.is_err());

        // Test with non-stream claim type (repost)
        let item4b = json!({
            "claim_id": "repost123",
            "value_type": "repost",
            "value": {}
        });
        let result4b = extract_video_urls(&item4b);
        assert!(result4b.is_err());

        // Test with non-stream claim type (collection)
        let item4c = json!({
            "claim_id": "collection123",
            "value_type": "collection",
            "value": {}
        });
        let result4c = extract_video_urls(&item4c);
        assert!(result4c.is_err());

        // Test that direct URL fields are ignored
        let item5 = json!({
            "claim_id": "xyz789abc123",
            "value_type": "stream",
            "value": {
                "hd_url": "https://example.com/video_1080p.mp4",
                "sd_url": "https://example.com/video_480p.mp4",
                "720p_url": "https://example.com/video_720p.mp4"
            }
        });
        let urls5 = extract_video_urls(&item5).unwrap();
        // Should only have "master" key, not quality-specific keys
        assert!(urls5.contains_key("master"));
        assert!(!urls5.contains_key("1080p"));
        assert!(!urls5.contains_key("720p"));
        assert!(!urls5.contains_key("480p"));
        assert!(urls5.get("master").unwrap().url.contains("xyz789abc123"));

        // Test with missing value_type but has source.sd_hash (fallback inference)
        let item6 = json!({
            "claim_id": "inferred123",
            "value": {
                "source": {
                    "sd_hash": "some_hash_value"
                }
            }
        });
        let urls6 = extract_video_urls(&item6).unwrap();
        assert!(urls6.contains_key("master"));
        assert!(urls6.get("master").unwrap().url.contains("inferred123"));

        // Test with missing value_type and no source.sd_hash
        let item7 = json!({
            "claim_id": "ambiguous123",
            "value": {}
        });
        let result7 = extract_video_urls(&item7);
        assert!(result7.is_err());

        // Test with whitespace-only claim_id
        let item8 = json!({
            "claim_id": "   ",
            "value_type": "stream",
            "value": {}
        });
        let result8 = extract_video_urls(&item8);
        assert!(result8.is_err());

        // Test with claim_id that has leading/trailing whitespace (should be trimmed and work)
        let item9 = json!({
            "claim_id": "  abc123def456  ",
            "value_type": "stream",
            "value": {
                "title": "Test Video"
            }
        });
        let urls9 = extract_video_urls(&item9).unwrap();
        assert!(urls9.contains_key("master"));
        assert!(urls9.get("master").unwrap().url.contains("abc123def456"));
    }

    #[test]
    fn test_assess_compatibility() {
        let mut video_urls = HashMap::new();

        // Test with MP4
        video_urls.insert(
            "master".to_string(),
            VideoUrl {
                url: "https://example.com/video.mp4".to_string(),
                quality: "master".to_string(),
                url_type: "mp4".to_string(),
                codec: None,
            },
        );
        let compat1 = assess_compatibility(&video_urls);
        assert!(compat1.compatible);
        assert!(!compat1.fallback_available);

        // Test with HLS only
        video_urls.clear();
        video_urls.insert(
            "master".to_string(),
            VideoUrl {
                url: "https://example.com/video.m3u8".to_string(),
                quality: "master".to_string(),
                url_type: "hls".to_string(),
                codec: None,
            },
        );
        let compat2 = assess_compatibility(&video_urls);
        assert!(compat2.compatible);
        assert!(compat2.fallback_available);

        // Test with no URLs
        video_urls.clear();
        let compat3 = assess_compatibility(&video_urls);
        assert!(!compat3.compatible);
        assert!(compat3.reason.is_some());
    }

    #[test]
    fn test_extract_season_number_from_title() {
        assert_eq!(
            extract_season_number_from_title("Breaking Bad – Season 1"),
            Some(1)
        );
        assert_eq!(
            extract_season_number_from_title("Game of Thrones - Season 8"),
            Some(8)
        );
        assert_eq!(extract_season_number_from_title("No Season Here"), None);
    }

    #[test]
    fn test_extract_series_key_from_title() {
        assert_eq!(
            extract_series_key_from_title("Breaking Bad – Season 1"),
            Some("breaking_bad".to_string())
        );
        assert_eq!(
            extract_series_key_from_title("Game of Thrones - Season 8"),
            Some("game_of_thrones".to_string())
        );
    }

    #[test]
    fn test_parse_claim_item() {
        let item = json!({
            "claim_id": "test-claim-123",
            "value_type": "stream",
            "value": {
                "title": "Test Movie",
                "description": "A test movie",
                "tags": ["movie", "action"],
                "thumbnail": {
                    "url": "https://example.com/thumb.jpg"
                },
                "video": {
                    "duration": 7200
                },
                "hd_url": "https://example.com/video.mp4"
            },
            "timestamp": 1234567890
        });

        let result = parse_claim_item(&item);
        assert!(result.is_ok());

        let content = result.unwrap();
        assert_eq!(content.claim_id, "test-claim-123");
        assert_eq!(content.title, "Test Movie");
        assert_eq!(content.description, Some("A test movie".to_string()));
        assert_eq!(content.tags, vec!["movie", "action"]);
        assert_eq!(
            content.thumbnail_url,
            Some("https://example.com/thumb.jpg".to_string())
        );
        assert_eq!(content.duration, Some(7200));
        assert_eq!(content.release_time, 1234567890);
        assert!(content.video_urls.contains_key("master"));
        assert!(content.compatibility.compatible);
    }

    #[test]
    fn test_parse_claim_item_minimal() {
        // Test with minimal required fields
        let item = json!({
            "claim_id": "minimal-claim",
            "value_type": "stream",
            "value": {
                "title": "Minimal",
                "hd_url": "https://example.com/video.mp4"
            }
        });

        let result = parse_claim_item(&item);
        assert!(result.is_ok());

        let content = result.unwrap();
        assert_eq!(content.claim_id, "minimal-claim");
        assert_eq!(content.title, "Minimal");
        assert_eq!(content.description, None);
        assert_eq!(content.tags.len(), 0);
        assert_eq!(content.thumbnail_url, None);
        assert_eq!(content.duration, None);
    }

    #[test]
    fn test_parse_claim_item_malformed() {
        // Test with missing claim_id
        let item1 = json!({
            "value": {
                "title": "No Claim ID"
            }
        });
        assert!(parse_claim_item(&item1).is_err());

        // Test with missing video URLs
        let item2 = json!({
            "claim_id": "no-video",
            "value": {
                "title": "No Video"
            }
        });
        assert!(parse_claim_item(&item2).is_err());
    }

    #[test]
    fn test_parse_claim_search_response() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(json!({
                "items": [
                    {
                        "claim_id": "claim-1",
                        "value_type": "stream",
                        "value": {
                            "title": "Movie 1",
                            "tags": ["movie"],
                            "hd_url": "https://example.com/movie1.mp4"
                        },
                        "timestamp": 1234567890
                    },
                    {
                        "claim_id": "claim-2",
                        "value_type": "stream",
                        "value": {
                            "title": "Movie 2",
                            "tags": ["movie", "action"],
                            "hd_url": "https://example.com/movie2.mp4"
                        },
                        "timestamp": 1234567891
                    }
                ]
            })),
        };

        let result = parse_claim_search_response(response);
        assert!(result.is_ok());

        let items = result.unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].claim_id, "claim-1");
        assert_eq!(items[1].claim_id, "claim-2");
    }

    #[test]
    fn test_parse_claim_search_response_no_data() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: None,
        };

        let result = parse_claim_search_response(response);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_claim_search_response_no_items() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(json!({
                "other_field": "value"
            })),
        };

        let result = parse_claim_search_response(response);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_claim_search_response_with_malformed_items() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(json!({
                "items": [
                    {
                        "claim_id": "valid-claim",
                        "value_type": "stream",
                        "value": {
                            "title": "Valid Movie",
                            "hd_url": "https://example.com/valid.mp4"
                        },
                        "timestamp": 1234567890
                    },
                    {
                        // Missing claim_id - should be skipped
                        "value_type": "stream",
                        "value": {
                            "title": "Invalid Movie"
                        }
                    },
                    {
                        "claim_id": "another-valid",
                        "value_type": "stream",
                        "value": {
                            "title": "Another Valid",
                            "sd_url": "https://example.com/another.mp4"
                        },
                        "timestamp": 1234567892
                    }
                ]
            })),
        };

        let result = parse_claim_search_response(response);
        assert!(result.is_ok());

        let items = result.unwrap();
        // Should have 2 valid items (malformed one skipped)
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].claim_id, "valid-claim");
        assert_eq!(items[1].claim_id, "another-valid");
    }

    #[test]
    fn test_parse_playlist_item() {
        let item = json!({
            "claim_id": "playlist-123",
            "value": {
                "title": "Breaking Bad – Season 1"
            }
        });

        let result = parse_playlist_item(&item);
        assert!(result.is_ok());

        let playlist = result.unwrap();
        assert_eq!(playlist.id, "playlist-123");
        assert_eq!(playlist.title, "Breaking Bad – Season 1");
        assert_eq!(playlist.season_number, Some(1));
        assert_eq!(playlist.series_key, Some("breaking_bad".to_string()));
    }

    #[test]
    fn test_parse_playlist_item_without_season() {
        let item = json!({
            "claim_id": "playlist-456",
            "value": {
                "title": "Random Playlist"
            }
        });

        let result = parse_playlist_item(&item);
        assert!(result.is_ok());

        let playlist = result.unwrap();
        assert_eq!(playlist.id, "playlist-456");
        assert_eq!(playlist.title, "Random Playlist");
        assert_eq!(playlist.season_number, None);
        assert!(playlist.series_key.is_some()); // Should still extract series key
    }

    #[test]
    fn test_parse_playlist_search_response() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(json!({
                "items": [
                    {
                        "claim_id": "playlist-1",
                        "value": {
                            "title": "Breaking Bad – Season 1"
                        }
                    },
                    {
                        "claim_id": "playlist-2",
                        "value": {
                            "title": "Breaking Bad – Season 2"
                        }
                    }
                ]
            })),
        };

        let result = parse_playlist_search_response(response);
        assert!(result.is_ok());

        let playlists = result.unwrap();
        assert_eq!(playlists.len(), 2);
        assert_eq!(playlists[0].id, "playlist-1");
        assert_eq!(playlists[0].season_number, Some(1));
        assert_eq!(playlists[1].id, "playlist-2");
        assert_eq!(playlists[1].season_number, Some(2));
    }

    #[test]
    fn test_parse_playlist_search_response_empty() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(json!({
                "items": []
            })),
        };

        let result = parse_playlist_search_response(response);
        assert!(result.is_ok());

        let playlists = result.unwrap();
        assert_eq!(playlists.len(), 0);
    }

    #[test]
    fn test_parse_playlist_search_response_no_data() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: None,
        };

        let result = parse_playlist_search_response(response);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_playlist_search_response_with_malformed_items() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(json!({
                "items": [
                    {
                        "claim_id": "valid-playlist",
                        "value": {
                            "title": "Valid Playlist – Season 1"
                        }
                    },
                    {
                        // Missing claim_id - should be skipped with warning
                        "value": {
                            "title": "Invalid Playlist"
                        }
                    },
                    {
                        "claim_id": "another-valid",
                        "value": {
                            "title": "Another Playlist – Season 2"
                        }
                    }
                ]
            })),
        };

        let result = parse_playlist_search_response(response);
        assert!(result.is_ok());

        let playlists = result.unwrap();
        // Should have 2 valid playlists (malformed one skipped)
        assert_eq!(playlists.len(), 2);
        assert_eq!(playlists[0].id, "valid-playlist");
        assert_eq!(playlists[0].season_number, Some(1));
        assert_eq!(playlists[1].id, "another-valid");
        assert_eq!(playlists[1].season_number, Some(2));
    }

    #[test]
    #[test]
    #[test]
    #[test]
    #[test]
    #[test]
    #[test]
    #[test]
    #[test]
    #[test]
    #[test]
    #[test]
    #[test]
    #[test]
    #[test]
    #[test]
    #[test]
    // Gateway Configuration Tests
    #[test]
    fn test_sanitize_gateway_valid_https() {
        let gateway = "https://custom-cdn.example.com";
        let result = sanitize_gateway(gateway);
        assert_eq!(result, "https://custom-cdn.example.com");
    }

    #[test]
    fn test_sanitize_gateway_removes_trailing_slash() {
        let gateway = "https://custom-cdn.example.com/";
        let result = sanitize_gateway(gateway);
        assert_eq!(result, "https://custom-cdn.example.com");

        // Test multiple trailing slashes
        let gateway2 = "https://custom-cdn.example.com///";
        let result2 = sanitize_gateway(gateway2);
        assert_eq!(result2, "https://custom-cdn.example.com");
    }

    #[test]
    fn test_sanitize_gateway_rejects_http() {
        let gateway = "http://insecure-cdn.example.com";
        let result = sanitize_gateway(gateway);
        assert_eq!(result, DEFAULT_CDN_GATEWAY);
    }

    #[test]
    fn test_sanitize_gateway_rejects_malformed_url() {
        let gateway = "not-a-valid-url";
        let result = sanitize_gateway(gateway);
        assert_eq!(result, DEFAULT_CDN_GATEWAY);

        // Test empty string
        let gateway2 = "";
        let result2 = sanitize_gateway(gateway2);
        assert_eq!(result2, DEFAULT_CDN_GATEWAY);

        // Test invalid scheme
        let gateway3 = "ftp://cdn.example.com";
        let result3 = sanitize_gateway(gateway3);
        assert_eq!(result3, DEFAULT_CDN_GATEWAY);
    }

    #[test]
    fn test_sanitize_gateway_with_path() {
        // Gateway with path should be valid
        let gateway = "https://cdn.example.com/v1/api";
        let result = sanitize_gateway(gateway);
        assert_eq!(result, "https://cdn.example.com/v1/api");
    }

    #[test]
    fn test_sanitize_gateway_with_port() {
        // Gateway with port should be valid
        let gateway = "https://cdn.example.com:8443";
        let result = sanitize_gateway(gateway);
        assert_eq!(result, "https://cdn.example.com:8443");
    }

    #[test]
    fn test_get_cdn_gateway_returns_valid_url() {
        // Test that get_cdn_gateway returns a valid URL
        let gateway = get_cdn_gateway();
        assert!(!gateway.is_empty());
        assert!(gateway.starts_with("https://"));
        assert!(!gateway.ends_with('/'));
    }

    #[test]
    fn test_get_cdn_gateway_is_consistent() {
        // Test that get_cdn_gateway returns the same value on multiple calls
        let gateway1 = get_cdn_gateway();
        let gateway2 = get_cdn_gateway();
        let gateway3 = get_cdn_gateway();

        assert_eq!(gateway1, gateway2);
        assert_eq!(gateway2, gateway3);
    }

    // Gateway Configuration Tests (Requirements 2.1, 2.2, 2.3, 2.4, 2.5)

    #[test]
    fn test_gateway_configuration_with_env_var_set() {
        // This test verifies the behavior when ODYSEE_CDN_GATEWAY is set
        // Note: The CDN_GATEWAY static is initialized once at first access,
        // so we test the initialization logic through sanitize_gateway

        // Simulate valid custom gateway from environment variable
        let custom_gateway = "https://custom-cdn.odysee.com";
        let result = sanitize_gateway(custom_gateway);

        // Should return the sanitized custom gateway
        assert_eq!(result, "https://custom-cdn.odysee.com");
        assert!(result.starts_with("https://"));
        assert!(!result.ends_with('/'));
    }

    #[test]
    fn test_gateway_configuration_with_env_var_not_set() {
        // This test verifies the behavior when ODYSEE_CDN_GATEWAY is not set
        // The system should fall back to DEFAULT_CDN_GATEWAY

        // When no environment variable is set, the default is used
        // We can verify this by checking that get_cdn_gateway returns a valid URL
        let gateway = get_cdn_gateway();

        // Should return a valid HTTPS URL (either custom or default)
        assert!(!gateway.is_empty());
        assert!(gateway.starts_with("https://"));
        assert!(!gateway.ends_with('/'));

        // The gateway should be one of the valid options
        // (either the default or a custom one set via environment variable)
        assert!(gateway == DEFAULT_CDN_GATEWAY || gateway.starts_with("https://"));
    }

    #[test]
    fn test_gateway_configuration_validation() {
        // Test that gateway configuration validates HTTPS requirement (Requirement 2.4)
        let http_gateway = "http://insecure.example.com";
        let result = sanitize_gateway(http_gateway);
        assert_eq!(
            result, DEFAULT_CDN_GATEWAY,
            "HTTP gateways should be rejected"
        );

        // Test that trailing slashes are removed (Requirement 2.4)
        let gateway_with_slash = "https://cdn.example.com/";
        let result = sanitize_gateway(gateway_with_slash);
        assert_eq!(
            result, "https://cdn.example.com",
            "Trailing slashes should be removed"
        );

        // Test that malformed URLs fall back to default (Requirement 2.5)
        let malformed = "not-a-url";
        let result = sanitize_gateway(malformed);
        assert_eq!(
            result, DEFAULT_CDN_GATEWAY,
            "Malformed URLs should fall back to default"
        );
    }

    #[test]
    fn test_gateway_configuration_immutability() {
        // Test that gateway remains consistent across multiple calls (Requirement 2.3, 2.7)
        let gateway1 = get_cdn_gateway();
        let gateway2 = get_cdn_gateway();
        let gateway3 = get_cdn_gateway();

        // All calls should return the same reference (immutable)
        assert_eq!(gateway1, gateway2);
        assert_eq!(gateway2, gateway3);

        // Verify it's a valid HTTPS URL
        assert!(gateway1.starts_with("https://"));
        assert!(!gateway1.ends_with('/'));
    }

    #[test]
    fn test_gateway_configuration_default_fallback() {
        // Test that invalid gateways fall back to default (Requirement 2.5)

        // Empty string should fall back to default
        let result = sanitize_gateway("");
        assert_eq!(result, DEFAULT_CDN_GATEWAY);

        // Invalid scheme should fall back to default
        let result = sanitize_gateway("ftp://cdn.example.com");
        assert_eq!(result, DEFAULT_CDN_GATEWAY);

        // Missing scheme should fall back to default
        let result = sanitize_gateway("cdn.example.com");
        assert_eq!(result, DEFAULT_CDN_GATEWAY);
    }

    #[test]
    fn test_gateway_configuration_with_custom_valid_gateway() {
        // Test that valid custom gateways are accepted (Requirement 2.1, 2.2)

        // Custom gateway with subdomain
        let custom1 = "https://cdn.custom.odysee.com";
        let result1 = sanitize_gateway(custom1);
        assert_eq!(result1, "https://cdn.custom.odysee.com");

        // Custom gateway with port
        let custom2 = "https://cdn.example.com:8443";
        let result2 = sanitize_gateway(custom2);
        assert_eq!(result2, "https://cdn.example.com:8443");

        // Custom gateway with path
        let custom3 = "https://cdn.example.com/v1";
        let result3 = sanitize_gateway(custom3);
        assert_eq!(result3, "https://cdn.example.com/v1");
    }

    // Task 4.2: Unit tests for parse_claim_item
    // Requirements: 5.2, 5.4, 11.3, 11.4, 11.5, 11.7

    #[test]
    fn test_parse_claim_item_successful_with_all_fields() {
        // Test successful parsing with all fields present
        let item = json!({
            "claim_id": "full-claim-123",
            "value_type": "stream",
            "value": {
                "title": "Complete Movie",
                "description": "A movie with all metadata",
                "tags": ["movie", "action", "thriller"],
                "thumbnail": {
                    "url": "https://example.com/thumb.jpg"
                },
                "video": {
                    "duration": 7200
                }
            },
            "timestamp": 1234567890
        });

        let result = parse_claim_item(&item);
        assert!(
            result.is_ok(),
            "Should successfully parse claim with all fields"
        );

        let content = result.unwrap();
        assert_eq!(content.claim_id, "full-claim-123");
        assert_eq!(content.title, "Complete Movie");
        assert_eq!(
            content.description,
            Some("A movie with all metadata".to_string())
        );
        assert_eq!(content.tags, vec!["movie", "action", "thriller"]);
        assert_eq!(
            content.thumbnail_url,
            Some("https://example.com/thumb.jpg".to_string())
        );
        assert_eq!(content.duration, Some(7200));
        assert_eq!(content.release_time, 1234567890);

        // Verify CDN URL is constructed
        assert!(
            content.video_urls.contains_key("master"),
            "Should have master quality entry"
        );
        let master_url = &content.video_urls.get("master").unwrap().url;
        assert!(
            master_url.contains("full-claim-123"),
            "CDN URL should contain claim_id"
        );
        assert!(
            master_url.ends_with("/master.m3u8"),
            "CDN URL should end with master.m3u8"
        );

        // Verify compatibility assessment
        assert!(content.compatibility.compatible);
    }

    #[test]
    fn test_parse_claim_item_successful_with_minimal_fields() {
        // Test successful parsing with only required fields (claim_id, title, value_type)
        let item = json!({
            "claim_id": "minimal-claim-456",
            "value_type": "stream",
            "value": {
                "title": "Minimal Video"
            }
        });

        let result = parse_claim_item(&item);
        assert!(
            result.is_ok(),
            "Should successfully parse claim with minimal fields"
        );

        let content = result.unwrap();
        assert_eq!(content.claim_id, "minimal-claim-456");
        assert_eq!(content.title, "Minimal Video");

        // Optional fields should be None or empty
        assert_eq!(content.description, None);
        assert_eq!(content.tags.len(), 0);
        assert_eq!(content.thumbnail_url, None);
        assert_eq!(content.duration, None);

        // CDN URL should still be constructed
        assert!(
            content.video_urls.contains_key("master"),
            "Should have master quality entry"
        );
        let master_url = &content.video_urls.get("master").unwrap().url;
        assert!(
            master_url.contains("minimal-claim-456"),
            "CDN URL should contain claim_id"
        );
    }

    #[test]
    fn test_parse_claim_item_error_missing_claim_id() {
        // Test error propagation when claim_id is missing
        let item = json!({
            "value_type": "stream",
            "value": {
                "title": "Video Without Claim ID"
            }
        });

        let result = parse_claim_item(&item);
        assert!(
            result.is_err(),
            "Should return error when claim_id is missing"
        );

        let error = result.unwrap_err();
        assert!(
            error.to_string().contains("claim_id"),
            "Error should mention claim_id"
        );
    }

    #[test]
    fn test_parse_claim_item_error_empty_claim_id() {
        // Test error propagation when claim_id is empty string
        let item = json!({
            "claim_id": "",
            "value_type": "stream",
            "value": {
                "title": "Video With Empty Claim ID"
            }
        });

        let result = parse_claim_item(&item);
        assert!(
            result.is_err(),
            "Should return error when claim_id is empty"
        );
    }

    #[test]
    fn test_parse_claim_item_error_non_stream_channel() {
        // Test that non-stream claim type (channel) is rejected
        let item = json!({
            "claim_id": "channel-claim-789",
            "value_type": "channel",
            "value": {
                "title": "My Channel"
            }
        });

        let result = parse_claim_item(&item);
        assert!(
            result.is_err(),
            "Should return error for channel claim type"
        );

        let error = result.unwrap_err();
        let error_msg = error.to_string();
        assert!(
            error_msg.contains("stream") || error_msg.contains("channel"),
            "Error should indicate non-stream type"
        );
    }

    #[test]
    fn test_parse_claim_item_error_non_stream_repost() {
        // Test that non-stream claim type (repost) is rejected
        let item = json!({
            "claim_id": "repost-claim-101",
            "value_type": "repost",
            "value": {
                "title": "Reposted Content"
            }
        });

        let result = parse_claim_item(&item);
        assert!(result.is_err(), "Should return error for repost claim type");
    }

    #[test]
    fn test_parse_claim_item_error_non_stream_collection() {
        // Test that non-stream claim type (collection) is rejected
        let item = json!({
            "claim_id": "collection-claim-202",
            "value_type": "collection",
            "value": {
                "title": "My Playlist"
            }
        });

        let result = parse_claim_item(&item);
        assert!(
            result.is_err(),
            "Should return error for collection claim type"
        );
    }

    #[test]
    fn test_parse_claim_item_missing_title() {
        // Test that missing title defaults to "Untitled" (doesn't error)
        let item = json!({
            "claim_id": "no-title-claim",
            "value_type": "stream",
            "value": {}
        });

        let result = parse_claim_item(&item);
        assert!(
            result.is_ok(),
            "Should succeed with default title when title is missing"
        );

        let content = result.unwrap();
        assert_eq!(
            content.title, "Untitled",
            "Should default to 'Untitled' when title is missing"
        );
    }

    #[test]
    fn test_parse_claim_item_response_structure() {
        // Test that response contains all required fields (Requirement 11.7)
        let item = json!({
            "claim_id": "structure-test-claim",
            "value_type": "stream",
            "value": {
                "title": "Structure Test Video",
                "tags": ["test"],
                "thumbnail": {
                    "url": "https://example.com/thumb.jpg"
                }
            },
            "timestamp": 1234567890
        });

        let result = parse_claim_item(&item);
        assert!(result.is_ok(), "Should successfully parse claim");

        let content = result.unwrap();

        // Verify all required fields are present
        assert!(!content.claim_id.is_empty(), "claim_id should be non-empty");
        assert!(!content.title.is_empty(), "title should be non-empty");
        assert!(
            !content.video_urls.is_empty(),
            "video_urls should not be empty"
        );
        assert!(
            content.video_urls.contains_key("master"),
            "Should have master quality entry"
        );

        // Verify playback_url is accessible
        let playback_url = content.video_urls.get("master").map(|v| &v.url);
        assert!(
            playback_url.is_some(),
            "playback_url should be accessible via video_urls"
        );
        assert!(
            !playback_url.unwrap().is_empty(),
            "playback_url should be non-empty"
        );

        // Verify tags array exists (may be empty)
        assert!(content.tags.len() > 0, "tags should be present");

        // Verify thumbnail_url is present (may be None)
        assert!(
            content.thumbnail_url.is_some(),
            "thumbnail_url should be present"
        );
    }

    #[test]
    fn test_parse_claim_item_cdn_url_format() {
        // Test that CDN URL follows the correct format
        let item = json!({
            "claim_id": "cdn-format-test",
            "value_type": "stream",
            "value": {
                "title": "CDN Format Test"
            }
        });

        let result = parse_claim_item(&item);
        assert!(result.is_ok(), "Should successfully parse claim");

        let content = result.unwrap();
        let master_url = &content.video_urls.get("master").unwrap().url;

        // Verify CDN URL format: {gateway}/content/{claim_id}/master.m3u8
        assert!(
            master_url.starts_with("https://"),
            "CDN URL should start with https://"
        );
        assert!(
            master_url.contains("/content/"),
            "CDN URL should contain /content/"
        );
        assert!(
            master_url.contains("cdn-format-test"),
            "CDN URL should contain claim_id"
        );
        assert!(
            master_url.ends_with("/master.m3u8"),
            "CDN URL should end with /master.m3u8"
        );

        // Verify VideoUrl structure
        let video_url = content.video_urls.get("master").unwrap();
        assert_eq!(video_url.quality, "master", "quality should be 'master'");
        assert_eq!(video_url.url_type, "hls", "url_type should be 'hls'");
    }

    #[test]
    fn test_parse_claim_item_ignores_direct_urls() {
        // Test that direct URL fields are ignored (Requirement 4.6, 4.7)
        let item = json!({
            "claim_id": "ignore-direct-urls",
            "value_type": "stream",
            "value": {
                "title": "Video With Direct URLs",
                "hd_url": "https://example.com/hd.mp4",
                "sd_url": "https://example.com/sd.mp4",
                "streams": [
                    {"url": "https://example.com/720p.mp4", "quality": "720p"},
                    {"url": "https://example.com/480p.mp4", "quality": "480p"}
                ],
                "video": {
                    "url": "https://example.com/video.mp4"
                }
            }
        });

        let result = parse_claim_item(&item);
        assert!(
            result.is_ok(),
            "Should successfully parse claim even with direct URLs present"
        );

        let content = result.unwrap();

        // Should only have master quality entry (CDN URL)
        assert_eq!(
            content.video_urls.len(),
            1,
            "Should only have one video URL entry"
        );
        assert!(
            content.video_urls.contains_key("master"),
            "Should only have master quality"
        );

        // CDN URL should be used, not direct URLs
        let master_url = &content.video_urls.get("master").unwrap().url;
        assert!(!master_url.contains("hd.mp4"), "Should not use hd_url");
        assert!(!master_url.contains("sd.mp4"), "Should not use sd_url");
        assert!(
            !master_url.contains("720p.mp4"),
            "Should not use streams array"
        );
        assert!(
            master_url.contains("ignore-direct-urls"),
            "Should use CDN URL with claim_id"
        );
    }

    #[test]
    fn test_parse_claim_item_infers_stream_from_sd_hash() {
        // Test fallback inference when value_type is missing but source.sd_hash exists
        let item = json!({
            "claim_id": "inferred-stream",
            "value": {
                "title": "Inferred Stream Video",
                "source": {
                    "sd_hash": "abc123def456"
                }
            }
        });

        let result = parse_claim_item(&item);
        // Should succeed because sd_hash presence infers stream type
        assert!(
            result.is_ok(),
            "Should infer stream type from sd_hash presence"
        );

        let content = result.unwrap();
        assert_eq!(content.claim_id, "inferred-stream");
        assert!(
            content.video_urls.contains_key("master"),
            "Should have CDN URL"
        );
    }

    // Safety command tests
    #[tokio::test]
    async fn test_test_connection_returns_expected_message() {
        let result = test_connection().await;
        assert!(result.is_ok(), "test_connection should succeed");
        assert_eq!(
            result.unwrap(),
            "tauri-backend-alive",
            "Should return expected message"
        );
    }

    #[test]
    fn test_build_cdn_playback_url_test_command() {
        let claim_id = "test-claim-123".to_string();
        let url = build_cdn_playback_url_test(claim_id.clone());

        // Verify URL format
        assert!(url.contains(&claim_id), "URL should contain claim_id");
        assert!(
            url.contains("/content/"),
            "URL should contain /content/ path"
        );
        assert!(
            url.contains("/master.m3u8"),
            "URL should contain master.m3u8"
        );
        assert!(
            url.starts_with("https://"),
            "URL should start with https://"
        );

        // Verify it uses the default gateway
        let expected_url = format!("{}/content/{}/master.m3u8", DEFAULT_CDN_GATEWAY, claim_id);
        assert_eq!(url, expected_url, "URL should match expected format");
    }

    #[test]
    fn test_build_cdn_playback_url_test_with_various_claim_ids() {
        let test_cases = vec![
            "simple-claim",
            "claim-with-dashes",
            "claim_with_underscores",
            "ClaimWithMixedCase123",
            "a1b2c3d4e5f6",
        ];

        for claim_id in test_cases {
            let url = build_cdn_playback_url_test(claim_id.to_string());
            assert!(
                url.contains(claim_id),
                "URL should contain claim_id: {}",
                claim_id
            );
            assert!(
                url.starts_with(DEFAULT_CDN_GATEWAY),
                "URL should start with default gateway"
            );
            assert!(
                url.ends_with("/master.m3u8"),
                "URL should end with /master.m3u8"
            );
        }
    }
}
