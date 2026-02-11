use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::error::{KiyyaError, Result};
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentItem {
    pub claim_id: String,
    pub title: String,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub thumbnail_url: Option<String>,
    pub duration: Option<u32>,
    pub release_time: i64,
    pub video_urls: HashMap<String, VideoUrl>,
    pub compatibility: CompatibilityInfo,
    /// ETag for conditional requests (HTTP ETag or content version identifier)
    pub etag: Option<String>,
    /// Content hash for detecting changes (SHA256 of relevant fields)
    pub content_hash: Option<String>,
    /// Raw JSON response from API for debugging purposes
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw_json: Option<String>,
}

impl ContentItem {
    /// Creates a new ContentItem with validation
    pub fn new(
        claim_id: String,
        title: String,
        tags: Vec<String>,
        release_time: i64,
    ) -> Result<Self> {
        if claim_id.is_empty() {
            return Err(KiyyaError::validation_error("claim_id", "Claim ID cannot be empty"));
        }
        if title.is_empty() {
            return Err(KiyyaError::validation_error("title", "Title cannot be empty"));
        }
        
        Ok(Self {
            claim_id,
            title,
            description: None,
            tags,
            thumbnail_url: None,
            duration: None,
            release_time,
            video_urls: HashMap::new(),
            compatibility: CompatibilityInfo::default(),
            etag: None,
            content_hash: None,
            raw_json: None,
        })
    }
    
    /// Gets the primary category tag (movies, series, sitcoms, kids)
    pub fn primary_category(&self) -> Option<&str> {
        for tag in &self.tags {
            match tag.as_str() {
                "movie" | "series" | "sitcom" | "kids" => return Some(tag),
                _ => continue,
            }
        }
        None
    }
    
    /// Checks if content has a specific tag
    pub fn has_tag(&self, tag: &str) -> bool {
        self.tags.iter().any(|t| t == tag)
    }
    
    /// Gets available quality levels
    pub fn available_qualities(&self) -> Vec<&str> {
        self.video_urls.keys().map(|k| k.as_str()).collect()
    }
    
    /// Checks if content is compatible with current platform
    pub fn is_compatible(&self) -> bool {
        self.compatibility.compatible
    }
    
    /// Gets the best available quality URL
    pub fn best_quality_url(&self) -> Option<&VideoUrl> {
        // Priority order: 1080p -> 720p -> 480p -> any other
        let quality_priority = ["1080p", "720p", "480p"];
        
        for quality in quality_priority {
            if let Some(url) = self.video_urls.get(quality) {
                return Some(url);
            }
        }
        
        // Return any available quality if none of the preferred ones exist
        self.video_urls.values().next()
    }
    
    /// Computes a content hash for detecting changes
    /// Hash is based on: title, description, tags, thumbnail_url, video_urls, release_time
    pub fn compute_content_hash(&self) -> String {
        use sha2::{Sha256, Digest};
        
        let mut hasher = Sha256::new();
        
        // Hash relevant fields that indicate content changes
        hasher.update(self.title.as_bytes());
        
        if let Some(desc) = &self.description {
            hasher.update(desc.as_bytes());
        }
        
        // Sort tags for consistent hashing
        let mut sorted_tags = self.tags.clone();
        sorted_tags.sort();
        for tag in sorted_tags {
            hasher.update(tag.as_bytes());
        }
        
        if let Some(thumb) = &self.thumbnail_url {
            hasher.update(thumb.as_bytes());
        }
        
        // Hash video URLs (sorted by quality for consistency)
        let mut sorted_urls: Vec<_> = self.video_urls.iter().collect();
        sorted_urls.sort_by_key(|(k, _)| *k);
        for (quality, video_url) in sorted_urls {
            hasher.update(quality.as_bytes());
            hasher.update(video_url.url.as_bytes());
        }
        
        hasher.update(self.release_time.to_string().as_bytes());
        
        let result = hasher.finalize();
        format!("{:x}", result)
    }
    
    /// Updates the content hash field with computed hash
    pub fn update_content_hash(&mut self) {
        self.content_hash = Some(self.compute_content_hash());
    }
    
    /// Checks if content has changed by comparing hashes
    pub fn has_changed(&self, other_hash: &str) -> bool {
        match &self.content_hash {
            Some(hash) => hash != other_hash,
            None => {
                // If no hash stored, compute it and compare
                self.compute_content_hash() != other_hash
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoUrl {
    pub url: String,
    pub quality: String,
    #[serde(rename = "type")]
    pub url_type: String, // "mp4" or "hls"
    pub codec: Option<String>,
}

impl VideoUrl {
    /// Creates a new VideoUrl with validation
    pub fn new(url: String, quality: String, url_type: String) -> Result<Self> {
        if url.is_empty() {
            return Err(KiyyaError::validation_error("url", "URL cannot be empty"));
        }
        if quality.is_empty() {
            return Err(KiyyaError::validation_error("quality", "Quality cannot be empty"));
        }
        if !matches!(url_type.as_str(), "mp4" | "hls") {
            return Err(KiyyaError::validation_error("url_type", "URL type must be 'mp4' or 'hls'"));
        }
        
        Ok(Self {
            url,
            quality,
            url_type,
            codec: None,
        })
    }
    
    /// Checks if this is an HLS stream
    pub fn is_hls(&self) -> bool {
        self.url_type == "hls"
    }
    
    /// Checks if this is an MP4 stream
    pub fn is_mp4(&self) -> bool {
        self.url_type == "mp4"
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompatibilityInfo {
    pub compatible: bool,
    pub reason: Option<String>,
    pub fallback_available: bool,
}

impl Default for CompatibilityInfo {
    fn default() -> Self {
        Self {
            compatible: true,
            reason: None,
            fallback_available: false,
        }
    }
}

impl CompatibilityInfo {
    /// Creates a compatible info
    pub fn compatible() -> Self {
        Self::default()
    }
    
    /// Creates an incompatible info with reason
    pub fn incompatible(reason: String, fallback_available: bool) -> Self {
        Self {
            compatible: false,
            reason: Some(reason),
            fallback_available,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playlist {
    pub id: String,
    pub title: String,
    pub claim_id: String,
    pub items: Vec<PlaylistItem>,
    pub season_number: Option<u32>,
    pub series_key: Option<String>,
}

impl Playlist {
    /// Creates a new playlist with validation
    pub fn new(id: String, title: String, claim_id: String) -> Result<Self> {
        if id.is_empty() {
            return Err(KiyyaError::validation_error("id", "Playlist ID cannot be empty"));
        }
        if title.is_empty() {
            return Err(KiyyaError::validation_error("title", "Playlist title cannot be empty"));
        }
        if claim_id.is_empty() {
            return Err(KiyyaError::validation_error("claim_id", "Claim ID cannot be empty"));
        }
        
        Ok(Self {
            id,
            title,
            claim_id,
            items: Vec::new(),
            season_number: None,
            series_key: None,
        })
    }
    
    /// Adds an item to the playlist
    pub fn add_item(&mut self, item: PlaylistItem) {
        self.items.push(item);
        // Sort items by position to maintain order
        self.items.sort_by_key(|item| item.position);
    }
    
    /// Gets the total number of episodes in this playlist
    pub fn episode_count(&self) -> usize {
        self.items.len()
    }
    
    /// Checks if this playlist represents a season
    pub fn is_season(&self) -> bool {
        self.season_number.is_some()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistItem {
    pub claim_id: String,
    pub position: u32,
    pub episode_number: Option<u32>,
    pub season_number: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeriesInfo {
    pub series_key: String,
    pub title: String,
    pub seasons: Vec<Season>,
    pub total_episodes: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Season {
    pub number: u32,
    pub episodes: Vec<Episode>,
    pub playlist_id: Option<String>,
    pub inferred: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Episode {
    pub claim_id: String,
    pub title: String,
    pub episode_number: u32,
    pub season_number: u32,
    pub thumbnail_url: Option<String>,
    pub duration: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressData {
    pub claim_id: String,
    pub position_seconds: u32,
    pub quality: String,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FavoriteItem {
    pub claim_id: String,
    pub title: String,
    pub thumbnail_url: Option<String>,
    pub inserted_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfflineMetadata {
    pub claim_id: String,
    pub quality: String,
    pub filename: String,
    pub file_size: u64,
    pub encrypted: bool,
    pub added_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub theme: String,
    pub last_used_quality: String,
    pub encrypt_downloads: bool,
    pub auto_upgrade_quality: bool,
    pub cache_ttl_minutes: u32,
    pub max_cache_items: u32,
    pub vault_path: String,
    pub version: String,
    pub gateways: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticsData {
    pub gateway_health: Vec<GatewayHealth>,
    pub database_version: u32,
    pub free_disk_bytes: u64,
    pub local_server_status: ServerStatus,
    pub last_manifest_fetch: Option<i64>,
    pub cache_stats: CacheStats,
    pub download_stats: DownloadStats,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_stats: Option<crate::error_logging::ErrorStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayHealth {
    pub url: String,
    pub status: String, // "healthy", "degraded", "down"
    pub last_success: Option<i64>,
    pub last_error: Option<String>,
    pub response_time_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatus {
    pub running: bool,
    pub port: Option<u16>,
    pub active_streams: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub total_items: u32,
    pub cache_size_bytes: u64,
    pub hit_rate: f64,
    pub last_cleanup: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryStats {
    pub cache_items: u32,
    pub cache_size_bytes: u64,
    pub playlist_count: u32,
    pub favorites_count: u32,
    pub offline_content_count: u32,
    pub database_file_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadStats {
    pub total_downloads: u32,
    pub total_bytes_downloaded: u64,
    pub average_throughput_bytes_per_sec: u64,
    pub last_download_timestamp: Option<i64>,
}

impl Default for DownloadStats {
    fn default() -> Self {
        Self {
            total_downloads: 0,
            total_bytes_downloaded: 0,
            average_throughput_bytes_per_sec: 0,
            last_download_timestamp: None,
        }
    }
}

// Odysee API models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OdyseeRequest {
    pub method: String,
    pub params: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OdyseeResponse {
    pub success: bool,
    pub error: Option<String>,
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaimSearchParams {
    pub channel: Option<String>,
    pub any_tags: Option<Vec<String>>,
    pub text: Option<String>,
    pub page_size: Option<u32>,
    pub page: Option<u32>,
    pub order_by: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistSearchParams {
    pub channel: Option<String>,
    pub page_size: Option<u32>,
    pub page: Option<u32>,
}

// Download models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadRequest {
    pub claim_id: String,
    pub quality: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub claim_id: String,
    pub quality: String,
    pub percent: f64,
    pub bytes_written: u64,
    pub total_bytes: Option<u64>,
    pub speed_bytes_per_sec: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamOfflineRequest {
    pub claim_id: String,
    pub quality: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamOfflineResponse {
    pub url: String,
    pub port: u16,
}

// Update system models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionManifest {
    #[serde(rename = "latestVersion")]
    pub latest_version: String,
    #[serde(rename = "minSupportedVersion")]
    pub min_supported_version: String,
    #[serde(rename = "releaseNotes")]
    pub release_notes: String,
    #[serde(rename = "downloadUrl")]
    pub download_url: String,
    pub checksums: Option<HashMap<String, String>>,
    #[serde(rename = "emergencyDisable")]
    pub emergency_disable: Option<bool>,
}

impl VersionManifest {
    /// Checks if emergency disable is active
    pub fn is_emergency_disabled(&self) -> bool {
        self.emergency_disable.unwrap_or(false)
    }
    
    /// Validates the manifest structure
    pub fn validate(&self) -> Result<()> {
        if self.latest_version.is_empty() {
            return Err(KiyyaError::validation_error("latest_version", "Latest version cannot be empty"));
        }
        if self.min_supported_version.is_empty() {
            return Err(KiyyaError::validation_error("min_supported_version", "Minimum supported version cannot be empty"));
        }
        if self.download_url.is_empty() {
            return Err(KiyyaError::validation_error("download_url", "Download URL cannot be empty"));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateState {
    pub status: String, // "checking", "current", "optional", "forced", "error"
    pub current_version: String,
    pub latest_version: Option<String>,
    pub min_supported_version: Option<String>,
    pub release_notes: Option<String>,
    pub download_url: Option<String>,
    pub last_checked: Option<i64>,
    pub deferred_until: Option<i64>,
}

impl UpdateState {
    /// Creates a new update state
    pub fn new(current_version: String) -> Self {
        Self {
            status: "checking".to_string(),
            current_version,
            latest_version: None,
            min_supported_version: None,
            release_notes: None,
            download_url: None,
            last_checked: None,
            deferred_until: None,
        }
    }
    
    /// Checks if update is forced
    pub fn is_forced_update(&self) -> bool {
        self.status == "forced"
    }
    
    /// Checks if update is available
    pub fn is_update_available(&self) -> bool {
        matches!(self.status.as_str(), "optional" | "forced")
    }
    
    /// Checks if update is deferred
    pub fn is_deferred(&self) -> bool {
        if let Some(deferred_until) = self.deferred_until {
            let now = chrono::Utc::now().timestamp();
            now < deferred_until
        } else {
            false
        }
    }
}

// Additional models for better type safety and functionality

/// Represents a cache query with filters and pagination
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheQuery {
    pub tags: Option<Vec<String>>,
    pub text_search: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
    pub order_by: Option<String>,
}

impl Default for CacheQuery {
    fn default() -> Self {
        Self {
            tags: None,
            text_search: None,
            limit: Some(50),
            offset: Some(0),
            order_by: Some("release_time DESC".to_string()),
        }
    }
}

/// Represents gateway configuration and health status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayConfig {
    pub primary: String,
    pub secondary: String,
    pub fallback: String,
    pub timeout_seconds: u64,
    pub max_retries: u32,
}

impl Default for GatewayConfig {
    fn default() -> Self {
        Self {
            primary: "https://api.lbry.com".to_string(),
            secondary: "https://api.na-backend.odysee.com".to_string(),
            fallback: "https://api.eu-backend.odysee.com".to_string(),
            timeout_seconds: 10,
            max_retries: 3,
        }
    }
}

/// Represents a range request for HTTP streaming
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RangeRequest {
    pub start: u64,
    pub end: Option<u64>,
}

impl RangeRequest {
    /// Parses a Range header value
    pub fn from_header(header: &str) -> Result<Self> {
        if !header.starts_with("bytes=") {
            return Err(KiyyaError::validation_error("range", "Range header must start with 'bytes='"));
        }
        
        let range_part = &header[6..]; // Remove "bytes="
        let parts: Vec<&str> = range_part.split('-').collect();
        
        if parts.len() != 2 {
            return Err(KiyyaError::validation_error("range", "Invalid range format"));
        }
        
        let start = if parts[0].is_empty() {
            0
        } else {
            parts[0].parse::<u64>()
                .map_err(|_| KiyyaError::validation_error("range", "Invalid start position"))?
        };
        
        let end = if parts[1].is_empty() {
            None
        } else {
            Some(parts[1].parse::<u64>()
                .map_err(|_| KiyyaError::validation_error("range", "Invalid end position"))?)
        };
        
        Ok(Self { start, end })
    }
    
    /// Converts to HTTP Content-Range header value
    pub fn to_content_range(&self, total_size: u64) -> String {
        match self.end {
            Some(end) => format!("bytes {}-{}/{}", self.start, end, total_size),
            None => format!("bytes {}-{}/{}", self.start, total_size - 1, total_size),
        }
    }
    
    /// Gets the actual end position for a given file size
    pub fn actual_end(&self, file_size: u64) -> u64 {
        match self.end {
            Some(end) => std::cmp::min(end, file_size - 1),
            None => file_size - 1,
        }
    }
    
    /// Gets the number of bytes to read
    pub fn byte_count(&self, file_size: u64) -> u64 {
        let end = self.actual_end(file_size);
        end - self.start + 1
    }
}

/// Represents encryption configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionConfig {
    pub enabled: bool,
    pub algorithm: String, // "aes-gcm"
    pub key_derivation: String, // "pbkdf2"
    pub iterations: u32,
}

impl Default for EncryptionConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            algorithm: "aes-gcm".to_string(),
            key_derivation: "pbkdf2".to_string(),
            iterations: 100_000,
        }
    }
}

/// Represents a database migration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Migration {
    pub version: u32,
    pub name: String,
    pub sql: String,
    pub applied_at: Option<i64>,
}

impl Migration {
    /// Creates a new migration
    pub fn new(version: u32, name: String, sql: String) -> Self {
        Self {
            version,
            name,
            sql,
            applied_at: None,
        }
    }
    
    /// Marks the migration as applied
    pub fn mark_applied(&mut self) {
        self.applied_at = Some(chrono::Utc::now().timestamp());
    }
    
    /// Checks if the migration has been applied
    pub fn is_applied(&self) -> bool {
        self.applied_at.is_some()
    }
}

// Constants for tag validation and categorization
pub mod tags {
    /// Base content type tags
    pub const SERIES: &str = "series";
    pub const MOVIE: &str = "movie";
    pub const SITCOM: &str = "sitcom";
    pub const KIDS: &str = "kids";
    pub const HERO_TRAILER: &str = "hero_trailer";
    
    /// Category filter tags for movies
    pub const COMEDY_MOVIES: &str = "comedy_movies";
    pub const ACTION_MOVIES: &str = "action_movies";
    pub const ROMANCE_MOVIES: &str = "romance_movies";
    
    /// Category filter tags for series
    pub const COMEDY_SERIES: &str = "comedy_series";
    pub const ACTION_SERIES: &str = "action_series";
    pub const ROMANCE_SERIES: &str = "romance_series";
    
    /// Category filter tags for kids content
    pub const COMEDY_KIDS: &str = "comedy_kids";
    pub const ACTION_KIDS: &str = "action_kids";
    
    /// All valid base tags
    pub const BASE_TAGS: &[&str] = &[SERIES, MOVIE, SITCOM, KIDS, HERO_TRAILER];
    
    /// All valid filter tags
    pub const FILTER_TAGS: &[&str] = &[
        COMEDY_MOVIES, ACTION_MOVIES, ROMANCE_MOVIES,
        COMEDY_SERIES, ACTION_SERIES, ROMANCE_SERIES,
        COMEDY_KIDS, ACTION_KIDS,
    ];
    
    /// Checks if a tag is a valid base tag
    pub fn is_base_tag(tag: &str) -> bool {
        BASE_TAGS.contains(&tag)
    }
    
    /// Checks if a tag is a valid filter tag
    pub fn is_filter_tag(tag: &str) -> bool {
        FILTER_TAGS.contains(&tag)
    }
    
    /// Gets the base tag for a filter tag
    pub fn base_tag_for_filter(filter_tag: &str) -> Option<&'static str> {
        match filter_tag {
            COMEDY_MOVIES | ACTION_MOVIES | ROMANCE_MOVIES => Some(MOVIE),
            COMEDY_SERIES | ACTION_SERIES | ROMANCE_SERIES => Some(SERIES),
            COMEDY_KIDS | ACTION_KIDS => Some(KIDS),
            _ => None,
        }
    }
}

// Quality constants and utilities
pub mod quality {
    /// Standard quality levels in priority order
    pub const QUALITY_LEVELS: &[&str] = &["1080p", "720p", "480p", "360p", "240p"];
    
    /// Checks if a quality string is valid
    pub fn is_valid_quality(quality: &str) -> bool {
        QUALITY_LEVELS.contains(&quality)
    }
    
    /// Gets the next lower quality level
    pub fn next_lower_quality(current: &str) -> Option<&'static str> {
        if let Some(index) = QUALITY_LEVELS.iter().position(|&q| q == current) {
            QUALITY_LEVELS.get(index + 1).copied()
        } else {
            None
        }
    }
    
    /// Gets the quality priority score (higher is better)
    pub fn quality_score(quality: &str) -> u32 {
        match quality {
            "1080p" => 5,
            "720p" => 4,
            "480p" => 3,
            "360p" => 2,
            "240p" => 1,
            _ => 0,
        }
    }
}

// Series parsing utilities
pub mod series {
    use regex::Regex;
    use std::sync::OnceLock;
    
    /// Regex for parsing series titles in format "SeriesName S01E01 - Episode Title"
    static SERIES_REGEX: OnceLock<Regex> = OnceLock::new();
    
    /// Gets the series parsing regex
    fn get_series_regex() -> &'static Regex {
        SERIES_REGEX.get_or_init(|| {
            Regex::new(r"^(.+?)\s+S(\d{1,2})E(\d{1,2})\s*-\s*(.+)$").unwrap()
        })
    }
    
    /// Parsed series information from a title
    #[derive(Debug, Clone)]
    pub struct ParsedSeries {
        pub series_name: String,
        pub season_number: u32,
        pub episode_number: u32,
        pub episode_title: String,
    }
    
    /// Parses a series title to extract series name, season, episode, and episode title
    pub fn parse_series_title(title: &str) -> Option<ParsedSeries> {
        let regex = get_series_regex();
        
        if let Some(captures) = regex.captures(title) {
            let series_name = captures.get(1)?.as_str().trim().to_string();
            let season_number = captures.get(2)?.as_str().parse().ok()?;
            let episode_number = captures.get(3)?.as_str().parse().ok()?;
            let episode_title = captures.get(4)?.as_str().trim().to_string();
            
            Some(ParsedSeries {
                series_name,
                season_number,
                episode_number,
                episode_title,
            })
        } else {
            None
        }
    }
    
    /// Generates a series key from a series name
    pub fn generate_series_key(series_name: &str) -> String {
        series_name
            .to_lowercase()
            .chars()
            .filter(|c| c.is_alphanumeric() || c.is_whitespace())
            .collect::<String>()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join("-")
    }
}

// Version comparison utilities
pub mod version {
    use crate::error::{KiyyaError, Result};
    
    /// Represents a semantic version
    #[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
    pub struct Version {
        pub major: u32,
        pub minor: u32,
        pub patch: u32,
    }
    
    impl Version {
        /// Parses a version string in format "major.minor.patch"
        pub fn parse(version_str: &str) -> Result<Self> {
            let parts: Vec<&str> = version_str.split('.').collect();
            
            if parts.len() < 2 || parts.len() > 3 {
                return Err(KiyyaError::validation_error(
                    "version", 
                    "Version must be in format 'major.minor' or 'major.minor.patch'"
                ));
            }
            
            let major = parts[0].parse::<u32>()
                .map_err(|_| KiyyaError::validation_error("version", "Invalid major version number"))?;
            
            let minor = parts[1].parse::<u32>()
                .map_err(|_| KiyyaError::validation_error("version", "Invalid minor version number"))?;
            
            let patch = if parts.len() == 3 {
                parts[2].parse::<u32>()
                    .map_err(|_| KiyyaError::validation_error("version", "Invalid patch version number"))?
            } else {
                0
            };
            
            Ok(Self { major, minor, patch })
        }
        
        /// Converts version to string
        pub fn to_string(&self) -> String {
            if self.patch == 0 {
                format!("{}.{}", self.major, self.minor)
            } else {
                format!("{}.{}.{}", self.major, self.minor, self.patch)
            }
        }
        
        /// Compares two versions
        pub fn compare(v1: &str, v2: &str) -> Result<std::cmp::Ordering> {
            let version1 = Self::parse(v1)?;
            let version2 = Self::parse(v2)?;
            Ok(version1.cmp(&version2))
        }
        
        /// Checks if version1 is greater than version2
        pub fn is_greater(v1: &str, v2: &str) -> Result<bool> {
            Ok(Self::compare(v1, v2)? == std::cmp::Ordering::Greater)
        }
        
        /// Checks if version1 is less than version2
        pub fn is_less(v1: &str, v2: &str) -> Result<bool> {
            Ok(Self::compare(v1, v2)? == std::cmp::Ordering::Less)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_content_item_creation() {
        let content = ContentItem::new(
            "test-claim-id".to_string(),
            "Test Movie".to_string(),
            vec!["movie".to_string()],
            1234567890,
        ).unwrap();
        
        assert_eq!(content.claim_id, "test-claim-id");
        assert_eq!(content.title, "Test Movie");
        assert_eq!(content.primary_category(), Some("movie"));
    }
    
    #[test]
    fn test_content_item_validation() {
        let result = ContentItem::new(
            "".to_string(),
            "Test Movie".to_string(),
            vec!["movie".to_string()],
            1234567890,
        );
        
        assert!(result.is_err());
    }
    
    #[test]
    fn test_video_url_creation() {
        let video_url = VideoUrl::new(
            "https://example.com/video.mp4".to_string(),
            "720p".to_string(),
            "mp4".to_string(),
        ).unwrap();
        
        assert!(video_url.is_mp4());
        assert!(!video_url.is_hls());
    }
    
    #[test]
    fn test_range_request_parsing() {
        let range = RangeRequest::from_header("bytes=0-1023").unwrap();
        assert_eq!(range.start, 0);
        assert_eq!(range.end, Some(1023));
        
        let range = RangeRequest::from_header("bytes=1024-").unwrap();
        assert_eq!(range.start, 1024);
        assert_eq!(range.end, None);
    }
    
    #[test]
    fn test_series_parsing() {
        let parsed = series::parse_series_title("Breaking Bad S01E01 - Pilot").unwrap();
        assert_eq!(parsed.series_name, "Breaking Bad");
        assert_eq!(parsed.season_number, 1);
        assert_eq!(parsed.episode_number, 1);
        assert_eq!(parsed.episode_title, "Pilot");
    }
    
    #[test]
    fn test_version_comparison() {
        assert!(version::Version::is_greater("2.1.0", "2.0.5").unwrap());
        assert!(version::Version::is_less("1.9.9", "2.0.0").unwrap());
        assert_eq!(version::Version::compare("1.0.0", "1.0.0").unwrap(), std::cmp::Ordering::Equal);
    }
    
    #[test]
    fn test_tag_validation() {
        assert!(tags::is_base_tag("movie"));
        assert!(tags::is_filter_tag("comedy_movies"));
        assert_eq!(tags::base_tag_for_filter("action_series"), Some("series"));
    }
    
    #[test]
    fn test_quality_utilities() {
        assert!(quality::is_valid_quality("720p"));
        assert_eq!(quality::next_lower_quality("720p"), Some("480p"));
        assert!(quality::quality_score("1080p") > quality::quality_score("720p"));
    }
}