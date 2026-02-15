use crate::error::{KiyyaError, Result};
use crate::models::*;
use crate::gateway::GatewayClient;
use crate::database::Database;
use crate::download::DownloadManager;
use crate::server::LocalServer;
use crate::diagnostics;
use crate::validation::{self, validate_claim_id};
use crate::sanitization;
use crate::AppState;
use tauri::{command, State, AppHandle, Manager};
use serde_json::{json, Value};
use std::collections::HashMap;
use tracing::{info, warn, error};

// Content discovery commands

#[command]
pub async fn fetch_channel_claims(
    channel_id: String,
    any_tags: Option<Vec<String>>,
    text: Option<String>,
    limit: Option<u32>,
    page: Option<u32>,
    force_refresh: Option<bool>,
    state: State<'_, AppState>,
) -> Result<Vec<ContentItem>> {
    info!("Fetching channel claims: channel_id={}, tags={:?}, text={:?}, limit={:?}, force_refresh={:?}", 
          channel_id, any_tags, text, limit, force_refresh);

    // Validate channel_id
    let validated_channel_id = validation::validate_channel_id(&channel_id)?;

    // Validate inputs
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

    // Skip cache if force_refresh is true
    if !should_force_refresh {
        // First, try to get from local cache
        let db = state.db.lock().await;
        let query = CacheQuery {
            tags: validated_tags.clone(),
            text_search: validated_text.clone(),
            limit: validated_limit,
            offset: validated_page.map(|p| p * validated_limit.unwrap_or(50)),
            order_by: Some("releaseTime DESC".to_string()),
        };
        let cached_items = db.get_cached_content(query).await?;
        
        // CRITICAL FIX: Return cache if we have ANY valid results, not just >= 6
        // This fixes the hero_trailer issue where only 1 video exists
        // The >= 6 threshold was arbitrary and broke single-item queries
        if !cached_items.is_empty() && validated_text.is_none() {
            info!("Returning {} items from cache", cached_items.len());
            return Ok(cached_items);
        }
        drop(db);
    } else {
        info!("Force refresh enabled, skipping cache");
    }

    // Otherwise, fetch from remote
    let mut gateway = state.gateway.lock().await;
    
    let request = OdyseeRequest {
        method: "claim_search".to_string(),
        params: json!({
            "channel": validated_channel_id,
            "any_tags": validated_tags,
            "text": validated_text,
            "page_size": validated_limit.unwrap_or(50),
            "page": validated_page.unwrap_or(1),
            "order_by": ["release_time"]
        }),
    };

    let response = gateway.fetch_with_failover(request).await?;
    drop(gateway);

    // Parse response and extract content items
    let items = parse_claim_search_response(response)?;
    
    // Store in cache
    let db = state.db.lock().await;
    db.store_content_items(items.clone()).await?;
    
    info!("Fetched and cached {} items from remote", items.len());
    Ok(items)
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

    match download_manager.download_content(request, app_handle.clone(), encrypt).await {
        Ok(metadata) => {
            // Store offline metadata in database
            let db = state.db.lock().await;
            db.save_offline_metadata(metadata.clone()).await?;
            
            info!("Download completed successfully: {} ({})", validated_claim_id, validated_quality);
            Ok(())
        }
        Err(e) => {
            error!("Download failed: {} ({}) - {}", validated_claim_id, validated_quality, e);
            
            // Clean up any partial files from the failed download
            if let Err(cleanup_err) = download_manager.cleanup_failed_download(&validated_claim_id, &validated_quality).await {
                warn!("Failed to clean up after download error: {}", cleanup_err);
            }
            
            // Emit detailed error event
            let _ = app_handle.emit_all("download-error", json!({
                "claimId": validated_claim_id,
                "quality": validated_quality,
                "error": e.to_string(),
                "errorCategory": e.category(),
                "userMessage": e.user_message(),
                "recoverable": e.is_recoverable(),
            }));
            
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
    let metadata = db.get_offline_metadata(&validated_claim_id, &validated_quality).await?
        .ok_or_else(|| KiyyaError::ContentNotFound { claim_id: validated_claim_id.clone() })?;
    drop(db);

    // Get file path
    let download_manager = state.download_manager.lock().await;
    let file_path = download_manager.get_content_path(&metadata.filename).await?;
    drop(download_manager);

    // Start local server if not running
    let mut server = state.local_server.lock().await;
    let port = server.start().await?;
    
    // Register content for streaming
    let uuid = format!("{}-{}", validated_claim_id, validated_quality);
    server.register_content(&uuid, file_path, metadata.encrypted).await?;
    drop(server);

    let response = StreamOfflineResponse {
        url: format!("http://127.0.0.1:{}/movies/{}", port, uuid),
        port,
    };

    // Emit server started event
    let _ = app_handle.emit_all("local-server-started", json!({
        "port": port,
        "url": response.url
    }));

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
    let metadata = db.get_offline_metadata(&validated_claim_id, &validated_quality).await?
        .ok_or_else(|| KiyyaError::ContentNotFound { claim_id: validated_claim_id.clone() })?;
    
    // Delete from database
    db.delete_offline_metadata(&validated_claim_id, &validated_quality).await?;
    drop(db);

    // Delete file
    let download_manager = state.download_manager.lock().await;
    download_manager.delete_content(&validated_claim_id, &validated_quality, &metadata.filename).await?;

    // Unregister from server
    let server = state.local_server.lock().await;
    let uuid = format!("{}-{}", validated_claim_id, validated_quality);
    server.unregister_content(&uuid).await?;

    info!("Deleted offline content: {} ({})", validated_claim_id, validated_quality);
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
pub async fn remove_favorite(
    claim_id: String,
    state: State<'_, AppState>,
) -> Result<()> {
    // Validate input
    let validated_claim_id = validation::validate_claim_id(&claim_id)?;

    let db = state.db.lock().await;
    db.remove_favorite(&validated_claim_id).await?;
    Ok(())
}

#[command]
pub async fn get_favorites(
    state: State<'_, AppState>,
) -> Result<Vec<FavoriteItem>> {
    let db = state.db.lock().await;
    let favorites = db.get_favorites().await?;
    Ok(favorites)
}

#[command]
pub async fn is_favorite(
    claim_id: String,
    state: State<'_, AppState>,
) -> Result<bool> {
    let validated_claim_id = validate_claim_id(&claim_id)?;
    
    let db = state.db.lock().await;
    let is_fav = db.is_favorite(&validated_claim_id).await?;
    Ok(is_fav)
}

// Configuration and diagnostics

#[command]
pub async fn get_app_config(
    state: State<'_, AppState>,
) -> Result<AppConfig> {
    let db = state.db.lock().await;
    
    let theme = db.get_setting("theme").await?.unwrap_or_else(|| "dark".to_string());
    let last_used_quality = db.get_setting("last_used_quality").await?.unwrap_or_else(|| "720p".to_string());
    let encrypt_downloads = db.get_setting("encrypt_downloads").await?.unwrap_or_else(|| "false".to_string()) == "true";
    let auto_upgrade_quality = db.get_setting("auto_upgrade_quality").await?.unwrap_or_else(|| "true".to_string()) == "true";
    let cache_ttl_minutes = db.get_setting("cache_ttl_minutes").await?.unwrap_or_else(|| "30".to_string()).parse().unwrap_or(30);
    let max_cache_items = db.get_setting("max_cache_items").await?.unwrap_or_else(|| "200".to_string()).parse().unwrap_or(200);

    let download_manager = state.download_manager.lock().await;
    let vault_path = download_manager.get_vault_path().to_string_lossy().to_string();
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
pub async fn get_diagnostics(
    state: State<'_, AppState>,
) -> Result<DiagnosticsData> {
    let gateway = state.gateway.lock().await;
    let server = state.local_server.lock().await;
    let db = state.db.lock().await;
    let download_manager = state.download_manager.lock().await;
    
    let vault_path = download_manager.get_vault_path();
    let diagnostics = diagnostics::collect_diagnostics(&*gateway, &*server, &*db, vault_path, &*download_manager).await?;
    
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
    let app_data_path = app_handle.path_resolver()
        .app_data_dir()
        .ok_or_else(|| KiyyaError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "Could not determine app data directory"
        )))?;
    
    let debug_package_path = diagnostics::collect_debug_package(&*db, vault_path, &app_data_path).await?;
    
    info!("Debug package created at: {:?}", debug_package_path);
    Ok(debug_package_path.to_string_lossy().to_string())
}

// Crash reporting commands

#[command]
pub async fn get_recent_crashes(limit: usize) -> Result<Vec<crate::crash_reporting::CrashReport>> {
    info!("Getting recent crashes (limit: {})", limit);
    
    let crashes = crate::crash_reporting::get_recent_crashes(limit)
        .map_err(|e| KiyyaError::Io(e))?;
    
    Ok(crashes)
}

#[command]
pub async fn clear_crash_log() -> Result<()> {
    info!("Clearing crash log");
    
    crate::crash_reporting::clear_crash_log()
        .map_err(|e| KiyyaError::Io(e))?;
    
    Ok(())
}

// Cache management commands

#[command]
pub async fn invalidate_cache_item(
    claim_id: String,
    state: State<'_, AppState>,
) -> Result<bool> {
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
pub async fn clear_all_cache(
    state: State<'_, AppState>,
) -> Result<u32> {
    info!("Clearing all cache");
    
    let db = state.db.lock().await;
    let count = db.clear_all_cache().await?;
    
    info!("Cleared {} cache items", count);
    Ok(count)
}

#[command]
pub async fn cleanup_expired_cache(
    state: State<'_, AppState>,
) -> Result<u32> {
    info!("Cleaning up expired cache");
    
    let db = state.db.lock().await;
    let count = db.cleanup_expired_cache().await?;
    
    info!("Cleaned up {} expired cache items", count);
    Ok(count)
}

#[command]
pub async fn get_cache_stats(
    state: State<'_, AppState>,
) -> Result<CacheStats> {
    let db = state.db.lock().await;
    let stats = db.get_cache_stats().await?;
    
    Ok(stats)
}

#[command]
pub async fn get_memory_stats(
    state: State<'_, AppState>,
) -> Result<MemoryStats> {
    let db = state.db.lock().await;
    let stats = db.get_memory_stats().await?;
    
    Ok(stats)
}

#[command]
pub async fn optimize_database_memory(
    state: State<'_, AppState>,
) -> Result<()> {
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
    let data = response.data.ok_or_else(|| KiyyaError::ContentParsing {
        message: "No data in response".to_string(),
    })?;

    let items = data.get("items").and_then(|v| v.as_array()).ok_or_else(|| KiyyaError::ContentParsing {
        message: "No items array in response".to_string(),
    })?;

    let mut content_items = Vec::new();
    
    for item in items {
        match parse_claim_item(item) {
            Ok(content_item) => content_items.push(content_item),
            Err(e) => {
                warn!("Failed to parse claim item: {} - Raw data: {}", e, item);
                // Continue processing other items
            }
        }
    }

    Ok(content_items)
}

pub fn parse_playlist_search_response(response: OdyseeResponse) -> Result<Vec<Playlist>> {
    let data = response.data.ok_or_else(|| KiyyaError::ContentParsing {
        message: "No data in response".to_string(),
    })?;

    let items = data.get("items").and_then(|v| v.as_array()).ok_or_else(|| KiyyaError::ContentParsing {
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
        warn!("Failed to extract claim_id from item: {} - Raw: {}", e, item);
        e
    })?;
    
    let title = extract_title(item)?;
    let description = extract_description(item);
    let tags = extract_tags(item);
    let thumbnail_url = extract_thumbnail_url(item);
    let duration = extract_duration(item);
    let release_time = extract_release_time(item);
    
    // Extract video URLs with enhanced error context
    let video_urls = extract_video_urls(item).map_err(|e| {
        warn!("Failed to extract video URLs for claim {}: {} - Raw: {}", claim_id, e, item);
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
    let id = item.get("claim_id")
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
    let title = item.get("value")
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
    let title = item.get("value")
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
    let tags = item.get("value")
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

fn extract_video_urls(item: &Value) -> Result<HashMap<String, VideoUrl>> {
    let mut video_urls = HashMap::new();

    // Try to extract from multiple locations
    let value = item.get("value").ok_or_else(|| {
        warn!("No value object in item - Raw: {}", item);
        KiyyaError::ContentParsing {
            message: "No value object".to_string(),
        }
    })?;

    // Check for direct URL fields (hd_url, sd_url, etc.)
    if let Some(hd_url) = value.get("hd_url").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
        video_urls.insert("1080p".to_string(), VideoUrl {
            url: hd_url.to_string(),
            quality: "1080p".to_string(),
            url_type: if hd_url.contains(".m3u8") { "hls".to_string() } else { "mp4".to_string() },
            codec: None,
        });
    }

    if let Some(sd_url) = value.get("sd_url").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
        video_urls.insert("480p".to_string(), VideoUrl {
            url: sd_url.to_string(),
            quality: "480p".to_string(),
            url_type: if sd_url.contains(".m3u8") { "hls".to_string() } else { "mp4".to_string() },
            codec: None,
        });
    }
    
    // Check for additional quality URLs
    if let Some(url_720p) = value.get("720p_url").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
        video_urls.insert("720p".to_string(), VideoUrl {
            url: url_720p.to_string(),
            quality: "720p".to_string(),
            url_type: if url_720p.contains(".m3u8") { "hls".to_string() } else { "mp4".to_string() },
            codec: None,
        });
    }

    // Check for streams array
    if let Some(streams) = value.get("streams").and_then(|v| v.as_array()) {
        for stream in streams {
            // Defensive extraction with validation
            if let (Some(url), Some(height)) = (
                stream.get("url").and_then(|v| v.as_str()).filter(|s| !s.is_empty()),
                stream.get("height").and_then(|v| v.as_u64())
            ) {
                let quality = match height {
                    h if h >= 1080 => "1080p",
                    h if h >= 720 => "720p",
                    h if h >= 480 => "480p",
                    h if h >= 360 => "360p",
                    _ => "240p",
                };

                video_urls.insert(quality.to_string(), VideoUrl {
                    url: url.to_string(),
                    quality: quality.to_string(),
                    url_type: if url.contains(".m3u8") { "hls".to_string() } else { "mp4".to_string() },
                    codec: stream.get("codec").and_then(|v| v.as_str()).map(|s| s.to_string()),
                });
            } else {
                // Log malformed stream entry but continue processing
                warn!("Malformed stream entry (missing url or height): {}", stream);
            }
        }
    }
    
    // Check for alternative field names
    if let Some(video_obj) = value.get("video") {
        if let Some(url) = video_obj.get("url").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
            // Try to determine quality from video object
            let quality = if let Some(height) = video_obj.get("height").and_then(|v| v.as_u64()) {
                match height {
                    h if h >= 1080 => "1080p",
                    h if h >= 720 => "720p",
                    h if h >= 480 => "480p",
                    _ => "360p",
                }
            } else {
                "720p" // Default quality if not specified
            };
            
            video_urls.insert(quality.to_string(), VideoUrl {
                url: url.to_string(),
                quality: quality.to_string(),
                url_type: if url.contains(".m3u8") { "hls".to_string() } else { "mp4".to_string() },
                codec: video_obj.get("codec").and_then(|v| v.as_str()).map(|s| s.to_string()),
            });
        }
    }

    // FALLBACK: If no direct URLs found, generate Odysee CDN URLs
    // This handles the case where claim_search returns basic info without streaming URLs
    if video_urls.is_empty() {
        // Extract claim_name and claim_id to construct CDN URLs
        let claim_name = item.get("name")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty());
        
        let claim_id = item.get("claim_id")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty());

        if let (Some(name), Some(id)) = (claim_name, claim_id) {
            // Get video height to determine available qualities
            let height = value.get("video")
                .and_then(|v| v.get("height"))
                .and_then(|v| v.as_u64())
                .unwrap_or(720); // Default to 720p if not specified

            // Generate CDN URLs for available qualities based on source video height
            let qualities = match height {
                h if h >= 1080 => vec![("1080p", 1080), ("720p", 720), ("480p", 480)],
                h if h >= 720 => vec![("720p", 720), ("480p", 480)],
                h if h >= 480 => vec![("480p", 480), ("360p", 360)],
                _ => vec![("360p", 360)],
            };

            for (quality_label, _) in qualities {
                // Odysee CDN URL pattern
                let cdn_url = format!(
                    "https://player.odycdn.com/api/v4/streams/free/{}/{}",
                    name, id
                );

                video_urls.insert(quality_label.to_string(), VideoUrl {
                    url: cdn_url,
                    quality: quality_label.to_string(),
                    url_type: "mp4".to_string(),
                    codec: None,
                });
            }

            info!("Generated {} CDN URLs for claim {} ({})", video_urls.len(), name, id);
        }
    }

    // TEMPORARY FIX: Allow videos without URLs (still processing on Odysee)
    // They will display with thumbnails only until processing completes
    if video_urls.is_empty() {
        warn!("No video URLs found in item (video may still be processing) - Raw value: {}", value);
        // Return empty HashMap instead of error - frontend will handle gracefully
        // Videos will show with thumbnail but won't be playable until URLs are available
    }

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
        assert_eq!(extract_description(&item1), Some("Test description".to_string()));

        // Test description in description field
        let item2 = json!({
            "description": "Another description"
        });
        assert_eq!(extract_description(&item2), Some("Another description".to_string()));

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
        assert_eq!(extract_thumbnail_url(&item1), Some("https://example.com/thumb1.jpg".to_string()));

        // Test thumbnail in value.thumbnail (string)
        let item2 = json!({
            "value": {
                "thumbnail": "https://example.com/thumb2.jpg"
            }
        });
        assert_eq!(extract_thumbnail_url(&item2), Some("https://example.com/thumb2.jpg".to_string()));

        // Test thumbnail in thumbnail field
        let item3 = json!({
            "thumbnail": "https://example.com/thumb3.jpg"
        });
        assert_eq!(extract_thumbnail_url(&item3), Some("https://example.com/thumb3.jpg".to_string()));

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
        assert_eq!(extract_thumbnail_url(&item7), Some("https://example.com/cover.jpg".to_string()));
        
        // Test alternative field names (image)
        let item8 = json!({
            "value": {
                "image": "https://example.com/image.jpg"
            }
        });
        assert_eq!(extract_thumbnail_url(&item8), Some("https://example.com/image.jpg".to_string()));
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
        // Test with hd_url and sd_url
        let item1 = json!({
            "value": {
                "hd_url": "https://example.com/video_1080p.mp4",
                "sd_url": "https://example.com/video_480p.mp4"
            }
        });
        let urls1 = extract_video_urls(&item1).unwrap();
        assert!(urls1.contains_key("1080p"));
        assert!(urls1.contains_key("480p"));
        assert_eq!(urls1.get("1080p").unwrap().url, "https://example.com/video_1080p.mp4");
        assert_eq!(urls1.get("480p").unwrap().url, "https://example.com/video_480p.mp4");

        // Test with streams array
        let item2 = json!({
            "value": {
                "streams": [
                    {
                        "url": "https://example.com/1080.mp4",
                        "height": 1080
                    },
                    {
                        "url": "https://example.com/720.mp4",
                        "height": 720
                    }
                ]
            }
        });
        let urls2 = extract_video_urls(&item2).unwrap();
        assert!(urls2.contains_key("1080p"));
        assert!(urls2.contains_key("720p"));

        // Test with HLS URLs
        let item3 = json!({
            "value": {
                "hd_url": "https://example.com/video.m3u8"
            }
        });
        let urls3 = extract_video_urls(&item3).unwrap();
        assert_eq!(urls3.get("1080p").unwrap().url_type, "hls");

        // Test missing video URLs
        let item4 = json!({
            "value": {}
        });
        let result = extract_video_urls(&item4);
        assert!(result.is_err());
        
        // Test with 720p_url field
        let item5 = json!({
            "value": {
                "720p_url": "https://example.com/video_720p.mp4"
            }
        });
        let urls5 = extract_video_urls(&item5).unwrap();
        assert!(urls5.contains_key("720p"));
        assert_eq!(urls5.get("720p").unwrap().url, "https://example.com/video_720p.mp4");
        
        // Test with video object containing url
        let item6 = json!({
            "value": {
                "video": {
                    "url": "https://example.com/video.mp4",
                    "height": 1080,
                    "codec": "h264"
                }
            }
        });
        let urls6 = extract_video_urls(&item6).unwrap();
        assert!(urls6.contains_key("1080p"));
        assert_eq!(urls6.get("1080p").unwrap().codec, Some("h264".to_string()));
        
        // Test with malformed streams (missing url or height)
        let item7 = json!({
            "value": {
                "streams": [
                    {
                        "url": "https://example.com/valid.mp4",
                        "height": 720
                    },
                    {
                        // Missing url - should be skipped
                        "height": 480
                    },
                    {
                        // Missing height - should be skipped
                        "url": "https://example.com/no-height.mp4"
                    }
                ],
                "hd_url": "https://example.com/fallback.mp4"
            }
        });
        let urls7 = extract_video_urls(&item7).unwrap();
        assert!(urls7.contains_key("720p")); // Valid stream
        assert!(urls7.contains_key("1080p")); // Fallback hd_url
        
        // Test with empty URL strings (should be filtered out)
        let item8 = json!({
            "value": {
                "hd_url": "",
                "sd_url": "https://example.com/video.mp4"
            }
        });
        let urls8 = extract_video_urls(&item8).unwrap();
        assert!(!urls8.contains_key("1080p")); // Empty hd_url filtered
        assert!(urls8.contains_key("480p")); // Valid sd_url
        
        // Test with streams containing codec information
        let item9 = json!({
            "value": {
                "streams": [
                    {
                        "url": "https://example.com/video.mp4",
                        "height": 1080,
                        "codec": "h265"
                    }
                ]
            }
        });
        let urls9 = extract_video_urls(&item9).unwrap();
        assert_eq!(urls9.get("1080p").unwrap().codec, Some("h265".to_string()));
    }

    #[test]
    fn test_assess_compatibility() {
        let mut video_urls = HashMap::new();
        
        // Test with MP4
        video_urls.insert("720p".to_string(), VideoUrl {
            url: "https://example.com/video.mp4".to_string(),
            quality: "720p".to_string(),
            url_type: "mp4".to_string(),
            codec: None,
        });
        let compat1 = assess_compatibility(&video_urls);
        assert!(compat1.compatible);
        assert!(!compat1.fallback_available);

        // Test with HLS only
        video_urls.clear();
        video_urls.insert("720p".to_string(), VideoUrl {
            url: "https://example.com/video.m3u8".to_string(),
            quality: "720p".to_string(),
            url_type: "hls".to_string(),
            codec: None,
        });
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
        assert_eq!(extract_season_number_from_title("Breaking Bad – Season 1"), Some(1));
        assert_eq!(extract_season_number_from_title("Game of Thrones - Season 8"), Some(8));
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
        assert_eq!(content.thumbnail_url, Some("https://example.com/thumb.jpg".to_string()));
        assert_eq!(content.duration, Some(7200));
        assert_eq!(content.release_time, 1234567890);
        assert!(content.video_urls.contains_key("1080p"));
        assert!(content.compatibility.compatible);
    }

    #[test]
    fn test_parse_claim_item_minimal() {
        // Test with minimal required fields
        let item = json!({
            "claim_id": "minimal-claim",
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
                        "value": {
                            "title": "Movie 1",
                            "tags": ["movie"],
                            "hd_url": "https://example.com/movie1.mp4"
                        },
                        "timestamp": 1234567890
                    },
                    {
                        "claim_id": "claim-2",
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
                        "value": {
                            "title": "Valid Movie",
                            "hd_url": "https://example.com/valid.mp4"
                        },
                        "timestamp": 1234567890
                    },
                    {
                        // Missing claim_id - should be skipped
                        "value": {
                            "title": "Invalid Movie"
                        }
                    },
                    {
                        "claim_id": "another-valid",
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
    fn test_parse_resolve_response() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(json!({
                "claim_id": "resolved-claim",
                "value": {
                    "title": "Resolved Content",
                    "tags": ["movie"],
                    "hd_url": "https://example.com/resolved.mp4"
                },
                "timestamp": 1234567890
            })),
        };

        let result = parse_resolve_response(response);
        assert!(result.is_ok());
        
        let item = result.unwrap();
        assert_eq!(item.claim_id, "resolved-claim");
        assert_eq!(item.title, "Resolved Content");
    }

    #[test]
    fn test_parse_resolve_response_with_multiple_qualities() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(json!({
                "claim_id": "multi-quality-claim",
                "value": {
                    "title": "Multi Quality Video",
                    "description": "A video with multiple quality options",
                    "tags": ["movie", "action"],
                    "thumbnail": {
                        "url": "https://example.com/thumb.jpg"
                    },
                    "video": {
                        "duration": 7200
                    },
                    "hd_url": "https://example.com/video-1080p.mp4",
                    "sd_url": "https://example.com/video-480p.mp4"
                },
                "timestamp": 1234567890
            })),
        };

        let result = parse_resolve_response(response);
        assert!(result.is_ok());
        
        let item = result.unwrap();
        assert_eq!(item.claim_id, "multi-quality-claim");
        assert_eq!(item.title, "Multi Quality Video");
        assert_eq!(item.description, Some("A video with multiple quality options".to_string()));
        assert_eq!(item.tags, vec!["movie", "action"]);
        assert_eq!(item.thumbnail_url, Some("https://example.com/thumb.jpg".to_string()));
        assert_eq!(item.duration, Some(7200));
        assert_eq!(item.release_time, 1234567890);
        
        // Check video URLs
        assert!(item.video_urls.contains_key("1080p"));
        assert!(item.video_urls.contains_key("480p"));
        assert_eq!(item.video_urls.get("1080p").unwrap().url, "https://example.com/video-1080p.mp4");
        assert_eq!(item.video_urls.get("480p").unwrap().url, "https://example.com/video-480p.mp4");
        
        // Check compatibility
        assert!(item.compatibility.compatible);
    }

    #[test]
    fn test_parse_resolve_response_with_hls_stream() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(json!({
                "claim_id": "hls-claim",
                "value": {
                    "title": "HLS Stream Video",
                    "tags": ["series"],
                    "hd_url": "https://example.com/video.m3u8"
                },
                "timestamp": 1234567890
            })),
        };

        let result = parse_resolve_response(response);
        assert!(result.is_ok());
        
        let item = result.unwrap();
        assert_eq!(item.claim_id, "hls-claim");
        
        // Check that HLS stream is detected
        let video_url = item.video_urls.get("1080p").unwrap();
        assert_eq!(video_url.url_type, "hls");
        assert!(video_url.url.contains(".m3u8"));
    }

    #[test]
    fn test_parse_resolve_response_no_data() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: None,
        };

        let result = parse_resolve_response(response);
        assert!(result.is_err());
        
        if let Err(KiyyaError::ContentParsing { message }) = result {
            assert_eq!(message, "No data in response");
        } else {
            panic!("Expected ContentParsing error");
        }
    }

    #[test]
    fn test_parse_resolve_response_missing_video_urls() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(json!({
                "claim_id": "no-video-claim",
                "value": {
                    "title": "No Video URLs",
                    "tags": ["movie"]
                },
                "timestamp": 1234567890
            })),
        };

        let result = parse_resolve_response(response);
        assert!(result.is_err());
        
        if let Err(KiyyaError::ContentParsing { message }) = result {
            assert_eq!(message, "No video URLs found");
        } else {
            panic!("Expected ContentParsing error");
        }
    }

    #[test]
    fn test_parse_resolve_response_with_streams_array() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(json!({
                "claim_id": "streams-claim",
                "value": {
                    "title": "Video with Streams Array",
                    "tags": ["movie"],
                    "streams": [
                        {
                            "url": "https://example.com/1080p.mp4",
                            "height": 1080
                        },
                        {
                            "url": "https://example.com/720p.mp4",
                            "height": 720
                        },
                        {
                            "url": "https://example.com/480p.mp4",
                            "height": 480
                        }
                    ]
                },
                "timestamp": 1234567890
            })),
        };

        let result = parse_resolve_response(response);
        assert!(result.is_ok());
        
        let item = result.unwrap();
        assert_eq!(item.claim_id, "streams-claim");
        
        // Check that all quality levels are present
        assert!(item.video_urls.contains_key("1080p"));
        assert!(item.video_urls.contains_key("720p"));
        assert!(item.video_urls.contains_key("480p"));
        
        // Verify URLs
        assert_eq!(item.video_urls.get("1080p").unwrap().url, "https://example.com/1080p.mp4");
        assert_eq!(item.video_urls.get("720p").unwrap().url, "https://example.com/720p.mp4");
        assert_eq!(item.video_urls.get("480p").unwrap().url, "https://example.com/480p.mp4");
    }

    #[test]
    fn test_parse_resolve_response_minimal_data() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(json!({
                "claim_id": "minimal-claim",
                "value": {
                    "title": "Minimal Video",
                    "hd_url": "https://example.com/video.mp4"
                },
                "timestamp": 1234567890
            })),
        };

        let result = parse_resolve_response(response);
        assert!(result.is_ok());
        
        let item = result.unwrap();
        assert_eq!(item.claim_id, "minimal-claim");
        assert_eq!(item.title, "Minimal Video");
        assert_eq!(item.description, None);
        assert_eq!(item.tags.len(), 0);
        assert_eq!(item.thumbnail_url, None);
        assert_eq!(item.duration, None);
        assert!(item.video_urls.contains_key("1080p"));
    }
    
    #[test]
    fn test_parse_claim_item_with_null_fields() {
        // Test with null values for optional fields
        let item = json!({
            "claim_id": "null-fields-claim",
            "value": {
                "title": "Video with Nulls",
                "description": null,
                "tags": null,
                "thumbnail": null,
                "video": null,
                "hd_url": "https://example.com/video.mp4"
            },
            "timestamp": 1234567890
        });

        let result = parse_claim_item(&item);
        assert!(result.is_ok());
        
        let content = result.unwrap();
        assert_eq!(content.claim_id, "null-fields-claim");
        assert_eq!(content.title, "Video with Nulls");
        assert_eq!(content.description, None);
        assert_eq!(content.tags.len(), 0);
        assert_eq!(content.thumbnail_url, None);
        assert_eq!(content.duration, None);
    }
    
    #[test]
    fn test_parse_claim_item_with_wrong_types() {
        // Test with wrong types for fields (should handle gracefully)
        let item = json!({
            "claim_id": "wrong-types-claim",
            "value": {
                "title": "Video with Wrong Types",
                "tags": "not-an-array", // Should be array
                "thumbnail": 12345, // Should be string or object
                "video": {
                    "duration": "not-a-number" // Should be number
                },
                "hd_url": "https://example.com/video.mp4"
            },
            "timestamp": "not-a-number" // Should be number
        });

        let result = parse_claim_item(&item);
        assert!(result.is_ok());
        
        let content = result.unwrap();
        assert_eq!(content.claim_id, "wrong-types-claim");
        assert_eq!(content.title, "Video with Wrong Types");
        assert_eq!(content.tags.len(), 0); // Invalid tags should result in empty array
        assert_eq!(content.thumbnail_url, None); // Invalid thumbnail should be None
        assert_eq!(content.duration, None); // Invalid duration should be None
        assert!(content.release_time > 0); // Should fallback to current time
    }
    
    #[test]
    fn test_parse_claim_search_response_all_items_malformed() {
        // Test when all items are malformed (should return empty array, not error)
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(json!({
                "items": [
                    {
                        // Missing claim_id
                        "value": {
                            "title": "Invalid 1"
                        }
                    },
                    {
                        // Missing video URLs
                        "claim_id": "invalid-2",
                        "value": {
                            "title": "Invalid 2"
                        }
                    },
                    {
                        // Missing value object
                        "claim_id": "invalid-3"
                    }
                ]
            })),
        };

        let result = parse_claim_search_response(response);
        assert!(result.is_ok());
        
        let items = result.unwrap();
        // All items are malformed, so should return empty array
        assert_eq!(items.len(), 0);
    }
    
    #[test]
    fn test_parse_playlist_item_with_empty_claim_id() {
        // Test with empty claim_id (should error)
        let item = json!({
            "claim_id": "",
            "value": {
                "title": "Empty Claim ID Playlist"
            }
        });

        let result = parse_playlist_item(&item);
        assert!(result.is_err());
    }
    
    #[test]
    fn test_parse_playlist_item_with_empty_title() {
        // Test with empty title (should succeed but log warning)
        let item = json!({
            "claim_id": "empty-title-playlist",
            "value": {
                "title": ""
            }
        });

        let result = parse_playlist_item(&item);
        assert!(result.is_ok());
        
        let playlist = result.unwrap();
        assert_eq!(playlist.id, "empty-title-playlist");
        assert_eq!(playlist.title, "");
    }
    
    #[test]
    fn test_extract_video_urls_with_all_empty_urls() {
        // Test when all URLs are empty strings
        let item = json!({
            "value": {
                "hd_url": "",
                "sd_url": "",
                "streams": []
            }
        });

        let result = extract_video_urls(&item);
        assert!(result.is_err());
    }
    
    #[test]
    fn test_parse_claim_item_with_deeply_nested_missing_fields() {
        // Test with deeply nested structure where fields are missing
        let item = json!({
            "claim_id": "nested-missing",
            "value": {
                "title": "Nested Missing Fields",
                "video": {
                    // duration is missing
                },
                "thumbnail": {
                    // url is missing
                },
                "hd_url": "https://example.com/video.mp4"
            },
            "timestamp": 1234567890
        });

        let result = parse_claim_item(&item);
        assert!(result.is_ok());
        
        let content = result.unwrap();
        assert_eq!(content.duration, None);
        assert_eq!(content.thumbnail_url, None);
    }
    
    #[test]
    fn test_parse_resolve_response_with_mixed_quality_formats() {
        // Test with mix of direct URLs and streams array
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(json!({
                "claim_id": "mixed-formats",
                "value": {
                    "title": "Mixed Quality Formats",
                    "hd_url": "https://example.com/1080p.mp4",
                    "streams": [
                        {
                            "url": "https://example.com/720p.mp4",
                            "height": 720
                        },
                        {
                            "url": "https://example.com/480p.mp4",
                            "height": 480
                        }
                    ]
                },
                "timestamp": 1234567890
            })),
        };

        let result = parse_resolve_response(response);
        assert!(result.is_ok());
        
        let item = result.unwrap();
        // Should have all three quality levels
        assert!(item.video_urls.contains_key("1080p"));
        assert!(item.video_urls.contains_key("720p"));
        assert!(item.video_urls.contains_key("480p"));
    }
    
    #[test]
    fn test_parse_claim_item_with_unicode_and_special_characters() {
        // Test with unicode and special characters in fields
        let item = json!({
            "claim_id": "unicode-claim",
            "value": {
                "title": "Test 🎬 Movie – Special \"Chars\" & More",
                "description": "Description with émojis 🎥 and spëcial çhars",
                "tags": ["movie", "action", "🎬"],
                "hd_url": "https://example.com/video.mp4"
            },
            "timestamp": 1234567890
        });

        let result = parse_claim_item(&item);
        assert!(result.is_ok());
        
        let content = result.unwrap();
        assert!(content.title.contains("🎬"));
        assert!(content.description.unwrap().contains("🎥"));
        assert!(content.tags.contains(&"🎬".to_string()));
    }
    
    #[test]
    fn test_parse_claim_search_response_with_partial_success() {
        // Test with mix of valid and invalid items
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(json!({
                "items": [
                    {
                        "claim_id": "valid-1",
                        "value": {
                            "title": "Valid 1",
                            "hd_url": "https://example.com/1.mp4"
                        },
                        "timestamp": 1234567890
                    },
                    {
                        // Invalid - missing claim_id
                        "value": {
                            "title": "Invalid",
                            "hd_url": "https://example.com/invalid.mp4"
                        }
                    },
                    {
                        "claim_id": "valid-2",
                        "value": {
                            "title": "Valid 2",
                            "sd_url": "https://example.com/2.mp4"
                        },
                        "timestamp": 1234567891
                    },
                    {
                        // Invalid - missing video URLs
                        "claim_id": "invalid-2",
                        "value": {
                            "title": "Invalid 2"
                        }
                    },
                    {
                        "claim_id": "valid-3",
                        "value": {
                            "title": "Valid 3",
                            "hd_url": "https://example.com/3.mp4"
                        },
                        "timestamp": 1234567892
                    }
                ]
            })),
        };

        let result = parse_claim_search_response(response);
        assert!(result.is_ok());
        
        let items = result.unwrap();
        // Should have 3 valid items (2 invalid ones skipped)
        assert_eq!(items.len(), 3);
        assert_eq!(items[0].claim_id, "valid-1");
        assert_eq!(items[1].claim_id, "valid-2");
        assert_eq!(items[2].claim_id, "valid-3");
    }
}
