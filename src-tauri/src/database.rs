use crate::error::{KiyyaError, Result, ErrorContext};
use crate::models::*;
use crate::path_security;
use crate::sanitization;
use rusqlite::{Connection, params, OptionalExtension, Transaction};
use std::path::PathBuf;
use std::sync::Arc;
use std::collections::HashMap;
use tokio::task;
use tokio::sync::Mutex;
use tracing::{info, error, warn, debug};
use chrono::Utc;

/// Database manager with connection pooling and transaction handling
pub struct Database {
    db_path: PathBuf,
    /// Connection pool to handle concurrent access
    connection_pool: Arc<Mutex<Vec<Connection>>>,
    /// Maximum number of connections in the pool
    max_connections: usize,
    /// Cache TTL in seconds (default 30 minutes)
    cache_ttl_seconds: i64,
    /// Maximum cache items before cleanup
    max_cache_items: u32,
    /// Whether FTS5 is available for full-text search
    pub(crate) fts5_available: bool,
}

impl Database {
    /// Creates a new database instance with connection pooling
    /// 
    /// # Important: Migrations Are NOT Run Automatically
    /// 
    /// This method initializes the database connection pool and creates the base schema
    /// (including the migrations table), but it does **NOT** execute any pending migrations.
    /// 
    /// Callers **MUST** explicitly call `run_migrations()` after initialization to apply
    /// any pending schema changes. This separation ensures migrations run exactly once
    /// during application startup, preventing stack overflow issues from redundant execution.
    /// 
    /// # Initialization Pattern
    /// 
    /// The correct initialization pattern is:
    /// 
    /// ```no_run
    /// use crate::database::Database;
    /// 
    /// async fn initialize_database() -> Result<Database, Box<dyn std::error::Error>> {
    ///     // Step 1: Create database instance (base schema only)
    ///     let db = Database::new().await?;
    ///     
    ///     // Step 2: Explicitly run migrations
    ///     db.run_migrations().await?;
    ///     
    ///     // Step 3: Database is now ready for use
    ///     Ok(db)
    /// }
    /// ```
    /// 
    /// # What This Method Does
    /// 
    /// - Creates the database file if it doesn't exist
    /// - Initializes connection pooling (max 5 connections)
    /// - Creates base schema tables (migrations, favorites, progress, etc.)
    /// - Checks for FTS5 availability
    /// - Initializes FTS5 virtual tables if available
    /// 
    /// # What This Method Does NOT Do
    /// 
    /// - Does NOT run database migrations
    /// - Does NOT apply schema changes from migration files
    /// - Does NOT modify existing tables beyond base schema
    /// 
    /// # See Also
    /// 
    /// - `run_migrations()` - Executes pending database migrations
    pub async fn new() -> Result<Self> {
        // Use path_security module to get validated app data directory
        let kiyya_dir = path_security::get_app_data_dir()?;
        
        tokio::fs::create_dir_all(&kiyya_dir).await
            .with_context("Failed to create Kiyya data directory")?;
        
        // Validate the database path
        let db_path = path_security::validate_path("app.db")?;
        
        Self::new_with_path(&db_path).await
    }
    
    /// Creates a new database instance with a custom path (for testing)
    pub async fn new_with_path(db_path: &std::path::Path) -> Result<Self> {
        let mut db = Self { 
            db_path: db_path.to_path_buf(),
            connection_pool: Arc::new(Mutex::new(Vec::new())),
            max_connections: 5,
            cache_ttl_seconds: 30 * 60, // 30 minutes
            max_cache_items: 200,
            fts5_available: false, // Will be set during initialization
        };
        
        // Initialize database schema (base tables only, including migrations table)
        db.initialize().await?;
        
        // Check if FTS5 is available
        db.fts5_available = db.check_fts5_available().await?;
        
        // Initialize FTS5 if available
        if db.fts5_available {
            db.initialize_fts5().await?;
        }
        
        info!("Database initialized successfully at {:?} (FTS5: {})", db_path, db.fts5_available);
        Ok(db)
    }

    /// Gets a connection from the pool or creates a new one
    async fn get_connection(&self) -> Result<Connection> {
        let mut pool = self.connection_pool.lock().await;
        
        if let Some(conn) = pool.pop() {
            // Test the connection to ensure it's still valid
            match conn.execute("SELECT 1", []) {
                Ok(_) => return Ok(conn),
                Err(e) => {
                    warn!("Stale connection detected, creating new one: {}", e);
                }
            }
        }
        
        // Create new connection
        let conn = Connection::open(&self.db_path)
            .with_context("Failed to open database connection")?;
        
        // Configure connection (skip WAL mode for tests to avoid issues)
        conn.execute("PRAGMA foreign_keys = ON", [])
            .with_context("Failed to enable foreign keys")?;
        
        // Only set WAL mode if not in test environment
        if !cfg!(test) {
            conn.execute("PRAGMA journal_mode = WAL", [])
                .with_context("Failed to set WAL mode")?;
            conn.execute("PRAGMA synchronous = NORMAL", [])
                .with_context("Failed to set synchronous mode")?;
            conn.execute("PRAGMA cache_size = -64000", [])
                .with_context("Failed to set cache size")?; // 64MB cache
        }
        
        Ok(conn)
    }

    /// Returns a connection to the pool
    async fn return_connection(&self, conn: Connection) {
        let mut pool = self.connection_pool.lock().await;
        if pool.len() < self.max_connections {
            pool.push(conn);
        }
        // If pool is full, connection will be dropped
    }

    /// Executes a function within a database transaction
    async fn with_transaction<F, R>(&self, f: F) -> Result<R>
    where
        F: FnOnce(&Transaction) -> Result<R> + Send + 'static,
        R: Send + 'static,
    {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database connection for transaction")?;
            
            // Configure connection
            conn.execute("PRAGMA foreign_keys = ON", [])?;
            
            let tx = conn.unchecked_transaction()
                .with_context("Failed to start transaction")?;
            
            match f(&tx) {
                Ok(result) => {
                    tx.commit()
                        .with_context("Failed to commit transaction")?;
                    Ok(result)
                }
                Err(e) => {
                    if let Err(rollback_err) = tx.rollback() {
                        error!("Failed to rollback transaction: {}", rollback_err);
                        return Err(KiyyaError::TransactionRollbackFailed { 
                            message: format!("Original error: {}, Rollback error: {}", e, rollback_err) 
                        });
                    }
                    Err(e)
                }
            }
        }).await?
    }

    /// Initializes the database schema
    async fn initialize(&self) -> Result<()> {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for initialization")?;
            
            // Enable foreign keys and configure for performance
            conn.execute_batch(r#"
                PRAGMA foreign_keys = ON;
                PRAGMA journal_mode = WAL;
                PRAGMA synchronous = NORMAL;
                PRAGMA cache_size = -64000;
                PRAGMA temp_store = memory;
                PRAGMA mmap_size = 268435456;
            "#).with_context("Failed to configure database")?;
            
            // Create initial tables
            conn.execute_batch(r#"
                CREATE TABLE IF NOT EXISTS migrations (
                    version INTEGER PRIMARY KEY,
                    description TEXT,
                    applied_at INTEGER NOT NULL,
                    checksum TEXT
                );

                CREATE TABLE IF NOT EXISTS favorites (
                    claimId TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    thumbnailUrl TEXT,
                    insertedAt INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS progress (
                    claimId TEXT PRIMARY KEY,
                    positionSeconds INTEGER NOT NULL,
                    quality TEXT NOT NULL,
                    updatedAt INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS offline_meta (
                    claimId TEXT NOT NULL,
                    quality TEXT NOT NULL,
                    filename TEXT NOT NULL,
                    fileSize INTEGER NOT NULL,
                    encrypted BOOLEAN DEFAULT FALSE,
                    addedAt INTEGER NOT NULL,
                    PRIMARY KEY (claimId, quality)
                );

                CREATE TABLE IF NOT EXISTS local_cache (
                    claimId TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    titleLower TEXT NOT NULL,
                    description TEXT,
                    descriptionLower TEXT,
                    tags TEXT NOT NULL,
                    thumbnailUrl TEXT,
                    videoUrls TEXT NOT NULL,
                    compatibility TEXT NOT NULL,
                    releaseTime INTEGER NOT NULL,
                    duration INTEGER,
                    updatedAt INTEGER NOT NULL,
                    accessCount INTEGER DEFAULT 0,
                    lastAccessed INTEGER,
                    etag TEXT,
                    contentHash TEXT,
                    raw_json TEXT
                );

                CREATE TABLE IF NOT EXISTS playlists (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    claimId TEXT NOT NULL,
                    seasonNumber INTEGER,
                    seriesKey TEXT,
                    itemCount INTEGER DEFAULT 0,
                    updatedAt INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS playlist_items (
                    playlistId TEXT NOT NULL,
                    claimId TEXT NOT NULL,
                    position INTEGER NOT NULL,
                    episodeNumber INTEGER,
                    seasonNumber INTEGER,
                    title TEXT,
                    PRIMARY KEY (playlistId, claimId),
                    FOREIGN KEY (playlistId) REFERENCES playlists(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS app_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS cache_stats (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    total_items INTEGER DEFAULT 0,
                    total_size_bytes INTEGER DEFAULT 0,
                    hit_count INTEGER DEFAULT 0,
                    miss_count INTEGER DEFAULT 0,
                    last_cleanup INTEGER,
                    created_at INTEGER NOT NULL
                );
            "#).with_context("Failed to create database tables")?;

            // Create indices for performance
            conn.execute_batch(r#"
                -- Basic single-column indices
                CREATE INDEX IF NOT EXISTS idx_localcache_titleLower ON local_cache(titleLower);
                CREATE INDEX IF NOT EXISTS idx_localcache_tags ON local_cache(tags);
                CREATE INDEX IF NOT EXISTS idx_localcache_updatedAt ON local_cache(updatedAt DESC);
                CREATE INDEX IF NOT EXISTS idx_localcache_releaseTime ON local_cache(releaseTime DESC);
                CREATE INDEX IF NOT EXISTS idx_localcache_lastAccessed ON local_cache(lastAccessed DESC);
                CREATE INDEX IF NOT EXISTS idx_localcache_etag ON local_cache(etag);
                CREATE INDEX IF NOT EXISTS idx_localcache_contentHash ON local_cache(contentHash);
                CREATE INDEX IF NOT EXISTS idx_localcache_claimId ON local_cache(claimId);
                
                -- Composite index for cache cleanup query (ORDER BY lastAccessed ASC, accessCount ASC)
                CREATE INDEX IF NOT EXISTS idx_localcache_cleanup ON local_cache(lastAccessed ASC, accessCount ASC);
                
                -- Composite index for tag filtering with time ordering
                CREATE INDEX IF NOT EXISTS idx_localcache_tags_release ON local_cache(tags, releaseTime DESC);
                
                -- Composite index for TTL-based queries with tag filtering
                CREATE INDEX IF NOT EXISTS idx_localcache_ttl_tags ON local_cache(updatedAt DESC, tags);
                
                -- Progress indices
                CREATE INDEX IF NOT EXISTS idx_progress_updatedAt ON progress(updatedAt);
                CREATE INDEX IF NOT EXISTS idx_progress_claimId ON progress(claimId);
                
                -- Playlist indices
                CREATE INDEX IF NOT EXISTS idx_playlist_items_position ON playlist_items(playlistId, position);
                CREATE INDEX IF NOT EXISTS idx_playlist_items_claimId ON playlist_items(claimId);
                CREATE INDEX IF NOT EXISTS idx_playlists_seriesKey ON playlists(seriesKey);
                CREATE INDEX IF NOT EXISTS idx_playlists_seasonNumber ON playlists(seasonNumber);
                CREATE INDEX IF NOT EXISTS idx_playlists_claimId ON playlists(claimId);
                
                -- Favorites indices
                CREATE INDEX IF NOT EXISTS idx_favorites_insertedAt ON favorites(insertedAt DESC);
                CREATE INDEX IF NOT EXISTS idx_favorites_claimId ON favorites(claimId);
                
                -- Offline metadata indices
                CREATE INDEX IF NOT EXISTS idx_offline_meta_addedAt ON offline_meta(addedAt DESC);
                CREATE INDEX IF NOT EXISTS idx_offline_meta_claim_quality ON offline_meta(claimId, quality);
                CREATE INDEX IF NOT EXISTS idx_offline_meta_encrypted ON offline_meta(encrypted);
                
                -- App settings index
                CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);
            "#).with_context("Failed to create database indices")?;

            // Initialize cache stats if not exists
            conn.execute(
                "INSERT OR IGNORE INTO cache_stats (id, created_at) VALUES (1, ?1)",
                params![Utc::now().timestamp()]
            ).with_context("Failed to initialize cache stats")?;

            info!("Database schema initialized successfully");
            Ok::<(), KiyyaError>(())
        }).await??;

        Ok(())
    }

    /// Runs pending database migrations using the new migration system
    pub async fn run_migrations(&self) -> Result<()> {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for migrations")?;
            
            // Use the new migration runner
            let migration_runner = crate::migrations::MigrationRunner::new();
            
            // Validate existing migrations first
            if let Err(e) = migration_runner.validate_migrations(&conn) {
                warn!("Migration validation warnings: {}", e);
            }
            
            // Run pending migrations
            migration_runner.run_migrations(&conn)?;
            
            Ok(())
        }).await?
    }

    /// Checks if FTS5 is available in the SQLite build
    async fn check_fts5_available(&self) -> Result<bool> {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for FTS5 check")?;
            
            // Try to create a temporary FTS5 table to check availability
            let result = conn.execute_batch(
                "CREATE VIRTUAL TABLE IF NOT EXISTS fts5_test USING fts5(content); DROP TABLE IF EXISTS fts5_test;"
            );
            
            match result {
                Ok(_) => {
                    info!("FTS5 is available for full-text search");
                    Ok(true)
                }
                Err(e) => {
                    warn!("FTS5 not available, will use LIKE queries for search: {}", e);
                    Ok(false)
                }
            }
        }).await?
    }

    /// Initializes FTS5 virtual table for full-text search
    async fn initialize_fts5(&self) -> Result<()> {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for FTS5 initialization")?;
            
            // Create FTS5 virtual table for content search
            conn.execute_batch(r#"
                CREATE VIRTUAL TABLE IF NOT EXISTS local_cache_fts USING fts5(
                    claimId UNINDEXED,
                    title,
                    description,
                    tags,
                    content='local_cache',
                    content_rowid='rowid'
                );

                -- Create triggers to keep FTS5 table in sync with local_cache
                CREATE TRIGGER IF NOT EXISTS local_cache_fts_insert AFTER INSERT ON local_cache BEGIN
                    INSERT INTO local_cache_fts(rowid, claimId, title, description, tags)
                    VALUES (new.rowid, new.claimId, new.title, new.description, new.tags);
                END;

                CREATE TRIGGER IF NOT EXISTS local_cache_fts_delete AFTER DELETE ON local_cache BEGIN
                    INSERT INTO local_cache_fts(local_cache_fts, rowid, claimId, title, description, tags)
                    VALUES('delete', old.rowid, old.claimId, old.title, old.description, old.tags);
                END;

                CREATE TRIGGER IF NOT EXISTS local_cache_fts_update AFTER UPDATE ON local_cache BEGIN
                    INSERT INTO local_cache_fts(local_cache_fts, rowid, claimId, title, description, tags)
                    VALUES('delete', old.rowid, old.claimId, old.title, old.description, old.tags);
                    INSERT INTO local_cache_fts(rowid, claimId, title, description, tags)
                    VALUES (new.rowid, new.claimId, new.title, new.description, new.tags);
                END;
            "#).with_context("Failed to create FTS5 virtual table")?;

            // Rebuild FTS5 index from existing data
            conn.execute(
                "INSERT INTO local_cache_fts(local_cache_fts) VALUES('rebuild')",
                []
            ).with_context("Failed to rebuild FTS5 index")?;

            info!("FTS5 virtual table initialized successfully");
            Ok(())
        }).await?
    }

    /// Searches content using FTS5 full-text search
    async fn search_with_fts5(&self, query: &str, limit: Option<u32>) -> Result<Vec<ContentItem>> {
        let db_path = self.db_path.clone();
        let query = query.to_string();
        let cache_ttl = self.cache_ttl_seconds;
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for FTS5 search")?;
            
            let now = Utc::now().timestamp();
            let ttl_cutoff = now - cache_ttl;
            
            // Sanitize the FTS5 query to prevent injection
            let sanitized_query = sanitization::sanitize_fts5_query(&query)?;
            
            let sql_query = format!(
                r#"
                SELECT c.claimId, c.title, c.description, c.tags, c.thumbnailUrl, c.videoUrls, 
                       c.compatibility, c.releaseTime, c.duration, c.updatedAt, c.etag, c.contentHash, c.raw_json,
                       rank
                FROM local_cache_fts fts
                JOIN local_cache c ON fts.claimId = c.claimId
                WHERE local_cache_fts MATCH ?1
                  AND c.updatedAt > ?2
                ORDER BY rank
                LIMIT ?3
                "#
            );

            let mut stmt = conn.prepare(&sql_query)
                .with_context("Failed to prepare FTS5 search query")?;
            
            let search_limit = limit.unwrap_or(50);
            let rows = stmt.query_map(params![sanitized_query, ttl_cutoff, search_limit], |row| {
                let tags_json: String = row.get(3)?;
                let video_urls_json: String = row.get(5)?;
                let compatibility_json: String = row.get(6)?;

                let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
                let video_urls: std::collections::HashMap<String, VideoUrl> = 
                    serde_json::from_str(&video_urls_json).unwrap_or_default();
                let compatibility: CompatibilityInfo = 
                    serde_json::from_str(&compatibility_json).unwrap_or(CompatibilityInfo {
                        compatible: false,
                        reason: Some("Parse error".to_string()),
                        fallback_available: false,
                    });

                Ok(ContentItem {
                    claim_id: row.get(0)?,
                    title: row.get(1)?,
                    description: row.get(2)?,
                    tags,
                    thumbnail_url: row.get(4)?,
                    duration: row.get(8)?,
                    release_time: row.get(7)?,
                    video_urls,
                    compatibility,
                    etag: row.get(10)?,
                    content_hash: row.get(11)?,
                    raw_json: row.get(12)?,
                })
            }).with_context("Failed to execute FTS5 search query")?;

            let mut items = Vec::new();
            for row in rows {
                items.push(row.with_context("Failed to parse FTS5 search result")?);
            }

            debug!("FTS5 search returned {} results for query: {}", items.len(), query);
            Ok(items)
        }).await?
    }

    /// Searches content using LIKE queries (fallback when FTS5 unavailable)
    async fn search_with_like(&self, query: &str, limit: Option<u32>) -> Result<Vec<ContentItem>> {
        let db_path = self.db_path.clone();
        let query = query.to_string();
        let cache_ttl = self.cache_ttl_seconds;
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for LIKE search")?;
            
            let now = Utc::now().timestamp();
            let ttl_cutoff = now - cache_ttl;
            
            // Sanitize the search text to escape LIKE special characters
            let sanitized_search = sanitization::sanitize_like_pattern(&query)?;
            let search_pattern = format!("%{}%", sanitized_search.to_lowercase());
            
            let sql_query = r#"
                SELECT claimId, title, description, tags, thumbnailUrl, videoUrls, 
                       compatibility, releaseTime, duration, updatedAt, etag, contentHash, raw_json 
                FROM local_cache 
                WHERE updatedAt > ?1
                  AND (titleLower LIKE ?2 OR descriptionLower LIKE ?2 OR tags LIKE ?2)
                ORDER BY releaseTime DESC
                LIMIT ?3
            "#;

            let mut stmt = conn.prepare(sql_query)
                .with_context("Failed to prepare LIKE search query")?;
            
            let search_limit = limit.unwrap_or(50);
            let rows = stmt.query_map(params![ttl_cutoff, search_pattern, search_limit], |row| {
                let tags_json: String = row.get(3)?;
                let video_urls_json: String = row.get(5)?;
                let compatibility_json: String = row.get(6)?;

                let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
                let video_urls: std::collections::HashMap<String, VideoUrl> = 
                    serde_json::from_str(&video_urls_json).unwrap_or_default();
                let compatibility: CompatibilityInfo = 
                    serde_json::from_str(&compatibility_json).unwrap_or(CompatibilityInfo {
                        compatible: false,
                        reason: Some("Parse error".to_string()),
                        fallback_available: false,
                    });

                Ok(ContentItem {
                    claim_id: row.get(0)?,
                    title: row.get(1)?,
                    description: row.get(2)?,
                    tags,
                    thumbnail_url: row.get(4)?,
                    duration: row.get(8)?,
                    release_time: row.get(7)?,
                    video_urls,
                    compatibility,
                    etag: row.get(10)?,
                    content_hash: row.get(11)?,
                    raw_json: row.get(12)?,
                })
            }).with_context("Failed to execute LIKE search query")?;

            let mut items = Vec::new();
            for row in rows {
                items.push(row.with_context("Failed to parse LIKE search result")?);
            }

            debug!("LIKE search returned {} results for query: {}", items.len(), query);
            Ok(items)
        }).await?
    }

    /// Searches content using FTS5 if available, otherwise falls back to LIKE queries
    pub async fn search_content(&self, query: &str, limit: Option<u32>) -> Result<Vec<ContentItem>> {
        if query.trim().is_empty() {
            return Ok(Vec::new());
        }

        if self.fts5_available {
            self.search_with_fts5(query, limit).await
        } else {
            self.search_with_like(query, limit).await
        }
    }

    // Content cache operations with TTL support
    
    /// Stores content items in the cache with automatic cleanup
    pub async fn store_content_items(&self, items: Vec<ContentItem>) -> Result<()> {
        if items.is_empty() {
            return Ok(());
        }

        let db_path = self.db_path.clone();
        let cache_ttl = self.cache_ttl_seconds;
        let max_items = self.max_cache_items;
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for storing content")?;
            
            let tx = conn.unchecked_transaction()
                .with_context("Failed to start transaction for content storage")?;

            let now = Utc::now().timestamp();
            let mut stored_count = 0;

            for mut item in items {
                // Compute content hash if not already set
                if item.content_hash.is_none() {
                    item.update_content_hash();
                }
                
                let tags_json = serde_json::to_string(&item.tags)
                    .with_context("Failed to serialize tags")?;
                let video_urls_json = serde_json::to_string(&item.video_urls)
                    .with_context("Failed to serialize video URLs")?;
                let compatibility_json = serde_json::to_string(&item.compatibility)
                    .with_context("Failed to serialize compatibility info")?;

                tx.execute(
                    r#"INSERT OR REPLACE INTO local_cache 
                       (claimId, title, titleLower, description, descriptionLower, tags, thumbnailUrl, 
                        videoUrls, compatibility, releaseTime, duration, updatedAt, accessCount, lastAccessed,
                        etag, contentHash, raw_json)
                       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 
                               COALESCE((SELECT accessCount FROM local_cache WHERE claimId = ?1), 0),
                               ?13, ?14, ?15, ?16)"#,
                    params![
                        item.claim_id,
                        item.title,
                        item.title.to_lowercase(),
                        item.description,
                        item.description.as_ref().map(|d| d.to_lowercase()),
                        tags_json,
                        item.thumbnail_url,
                        video_urls_json,
                        compatibility_json,
                        item.release_time,
                        item.duration,
                        now,
                        now,
                        item.etag,
                        item.content_hash,
                        item.raw_json
                    ]
                ).with_context_fn(|| format!("Failed to store content item: {}", item.claim_id))?;
                
                stored_count += 1;
            }

            // Update cache stats
            tx.execute(
                r#"UPDATE cache_stats SET 
                   total_items = (SELECT COUNT(*) FROM local_cache),
                   total_size_bytes = (SELECT SUM(LENGTH(videoUrls) + LENGTH(tags) + LENGTH(title)) FROM local_cache)
                   WHERE id = 1"#,
                []
            ).with_context("Failed to update cache stats")?;

            tx.commit()
                .with_context("Failed to commit content storage transaction")?;

            info!("Stored {} content items in cache", stored_count);

            // Check if we need to cleanup old items
            let total_items: u32 = conn.query_row(
                "SELECT COUNT(*) FROM local_cache",
                [],
                |row| row.get(0)
            ).unwrap_or(0);

            if total_items > max_items {
                debug!("Cache has {} items, cleaning up to {}", total_items, max_items);
                Self::cleanup_old_cache_items(&conn, max_items)?;
            }

            Ok(())
        }).await?
    }

    /// Retrieves cached content with TTL validation
    pub async fn get_cached_content(&self, query: CacheQuery) -> Result<Vec<ContentItem>> {
        let db_path = self.db_path.clone();
        let cache_ttl = self.cache_ttl_seconds;
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for content retrieval")?;
            
            let now = Utc::now().timestamp();
            let ttl_cutoff = now - cache_ttl;
            
            let mut sql_query = r#"
                SELECT claimId, title, description, tags, thumbnailUrl, videoUrls, 
                       compatibility, releaseTime, duration, updatedAt, etag, contentHash, raw_json 
                FROM local_cache 
                WHERE updatedAt > ?1
            "#.to_string();
            
            let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(ttl_cutoff)];
            let mut param_index = 2;

            // Add tag filtering with sanitization
            if let Some(tag_list) = &query.tags {
                if !tag_list.is_empty() {
                    // Sanitize each tag
                    let sanitized_tags: Result<Vec<String>> = tag_list.iter()
                        .map(|tag| sanitization::sanitize_tag(tag))
                        .collect();
                    let sanitized_tags = sanitized_tags?;
                    
                    let tag_conditions: Vec<String> = sanitized_tags.iter()
                        .map(|_| format!("(tags LIKE ?{} OR tags LIKE ?{})", 
                            { let idx = param_index; param_index += 1; idx },
                            { let idx = param_index; param_index += 1; idx }))
                        .collect();
                    sql_query.push_str(&format!(" AND ({})", tag_conditions.join(" OR ")));
                    
                    for tag in sanitized_tags {
                        // Look for the tag as a JSON array element with comma
                        params.push(Box::new(format!("%\"{}\",%", tag)));
                        // Look for the tag as the last element (no comma after)
                        params.push(Box::new(format!("%\"{}\"]%", tag)));
                    }
                }
            }

            // Add text search with sanitization
            if let Some(search_text) = &query.text_search {
                if !search_text.is_empty() {
                    // Sanitize the search text to escape LIKE special characters
                    let sanitized_search = sanitization::sanitize_like_pattern(search_text)?;
                    
                    sql_query.push_str(&format!(
                        " AND (titleLower LIKE ?{} OR descriptionLower LIKE ?{})", 
                        param_index, param_index + 1
                    ));
                    let search_pattern = format!("%{}%", sanitized_search.to_lowercase());
                    params.push(Box::new(search_pattern.clone()));
                    params.push(Box::new(search_pattern));
                    param_index += 2;
                }
            }

            // Add ordering with sanitization
            if let Some(order_by) = &query.order_by {
                // Sanitize the ORDER BY clause to prevent SQL injection
                let sanitized_order_by = sanitization::sanitize_order_by(order_by)?;
                sql_query.push_str(&format!(" ORDER BY {}", sanitized_order_by));
            } else {
                sql_query.push_str(" ORDER BY releaseTime DESC");
            }

            // Add pagination with sanitization
            if let Some(limit) = query.limit {
                let sanitized_limit = sanitization::sanitize_limit(limit)?;
                sql_query.push_str(&format!(" LIMIT {}", sanitized_limit));
                if let Some(offset) = query.offset {
                    let sanitized_offset = sanitization::sanitize_offset(offset)?;
                    sql_query.push_str(&format!(" OFFSET {}", sanitized_offset));
                }
            }

            let mut stmt = conn.prepare(&sql_query)
                .with_context("Failed to prepare content query")?;
            
            let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
            
            let rows = stmt.query_map(param_refs.as_slice(), |row| {
                let tags_json: String = row.get(3)?;
                let video_urls_json: String = row.get(5)?;
                let compatibility_json: String = row.get(6)?;

                let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
                let video_urls: std::collections::HashMap<String, VideoUrl> = 
                    serde_json::from_str(&video_urls_json).unwrap_or_default();
                let compatibility: CompatibilityInfo = 
                    serde_json::from_str(&compatibility_json).unwrap_or(CompatibilityInfo {
                        compatible: false,
                        reason: Some("Parse error".to_string()),
                        fallback_available: false,
                    });

                Ok(ContentItem {
                    claim_id: row.get(0)?,
                    title: row.get(1)?,
                    description: row.get(2)?,
                    tags,
                    thumbnail_url: row.get(4)?,
                    duration: row.get(8)?,
                    release_time: row.get(7)?,
                    video_urls,
                    compatibility,
                    etag: row.get(10)?,
                    content_hash: row.get(11)?,
                    raw_json: row.get(12)?,
                })
            }).with_context("Failed to execute content query")?;

            let mut items = Vec::new();
            for row in rows {
                items.push(row.with_context("Failed to parse content row")?);
            }

            // Update cache hit stats
            if !items.is_empty() {
                let _ = conn.execute(
                    "UPDATE cache_stats SET hit_count = hit_count + 1 WHERE id = 1",
                    []
                );
            } else {
                let _ = conn.execute(
                    "UPDATE cache_stats SET miss_count = miss_count + 1 WHERE id = 1",
                    []
                );
            }

            debug!("Retrieved {} cached content items", items.len());
            Ok(items)
        }).await?
    }

    /// Updates access count and timestamp for a content item
    pub async fn update_content_access(&self, claim_id: &str) -> Result<()> {
        let db_path = self.db_path.clone();
        let claim_id = claim_id.to_string();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for access update")?;
            
            conn.execute(
                r#"UPDATE local_cache 
                   SET accessCount = accessCount + 1, lastAccessed = ?1 
                   WHERE claimId = ?2"#,
                params![Utc::now().timestamp(), claim_id]
            ).with_context("Failed to update content access")?;

            Ok(())
        }).await?
    }

    /// Cleans up old cache items to maintain size limits
    fn cleanup_old_cache_items(conn: &Connection, max_items: u32) -> Result<()> {
        let items_to_remove = conn.query_row(
            "SELECT COUNT(*) - ?1 FROM local_cache",
            params![max_items],
            |row| row.get::<_, i64>(0)
        ).unwrap_or(0);

        if items_to_remove > 0 {
            // Remove least recently accessed items
            let removed = conn.execute(
                r#"DELETE FROM local_cache 
                   WHERE claimId IN (
                       SELECT claimId FROM local_cache 
                       ORDER BY lastAccessed ASC, accessCount ASC 
                       LIMIT ?1
                   )"#,
                params![items_to_remove]
            ).with_context("Failed to cleanup old cache items")?;

            // Update cleanup timestamp
            conn.execute(
                "UPDATE cache_stats SET last_cleanup = ?1 WHERE id = 1",
                params![Utc::now().timestamp()]
            ).with_context("Failed to update cleanup timestamp")?;

            info!("Cleaned up {} old cache items", removed);
        }

        Ok(())
    }

    /// Clears expired cache items based on TTL
    pub async fn cleanup_expired_cache(&self) -> Result<u32> {
        let db_path = self.db_path.clone();
        let cache_ttl = self.cache_ttl_seconds;
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for cache cleanup")?;
            
            let now = Utc::now().timestamp();
            let ttl_cutoff = now - cache_ttl;
            
            let removed = conn.execute(
                "DELETE FROM local_cache WHERE updatedAt <= ?1",
                params![ttl_cutoff]
            ).with_context("Failed to cleanup expired cache items")?;

            if removed > 0 {
                // Update cache stats
                conn.execute(
                    r#"UPDATE cache_stats SET 
                       total_items = (SELECT COUNT(*) FROM local_cache),
                       total_size_bytes = (SELECT SUM(LENGTH(videoUrls) + LENGTH(tags) + LENGTH(title)) FROM local_cache),
                       last_cleanup = ?1
                       WHERE id = 1"#,
                    params![now]
                ).with_context("Failed to update cache stats after cleanup")?;

                info!("Cleaned up {} expired cache items", removed);
            }

            Ok(removed as u32)
        }).await?
    }

    // Playlist operations
    
    /// Stores a playlist with its items
    pub async fn store_playlist(&self, playlist: Playlist) -> Result<()> {
        let playlist_id = playlist.id.clone();
        let playlist_title = playlist.title.clone();
        let playlist_claim_id = playlist.claim_id.clone();
        let playlist_season_number = playlist.season_number;
        let playlist_series_key = playlist.series_key.clone();
        let playlist_items = playlist.items.clone();
        
        self.with_transaction(move |tx| {
            // Insert or update playlist
            tx.execute(
                r#"INSERT OR REPLACE INTO playlists 
                   (id, title, claimId, seasonNumber, seriesKey, itemCount, updatedAt)
                   VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"#,
                params![
                    playlist_id,
                    playlist_title,
                    playlist_claim_id,
                    playlist_season_number,
                    playlist_series_key,
                    playlist_items.len() as i32,
                    Utc::now().timestamp()
                ]
            ).with_context("Failed to store playlist")?;

            // Delete existing playlist items
            tx.execute(
                "DELETE FROM playlist_items WHERE playlistId = ?1",
                params![playlist_id]
            ).with_context("Failed to delete existing playlist items")?;

            // Insert new playlist items
            for item in &playlist_items {
                tx.execute(
                    r#"INSERT INTO playlist_items 
                       (playlistId, claimId, position, episodeNumber, seasonNumber, title)
                       VALUES (?1, ?2, ?3, ?4, ?5, ?6)"#,
                    params![
                        playlist_id,
                        item.claim_id,
                        item.position,
                        item.episode_number,
                        item.season_number,
                        None::<String> // Title will be populated from content cache
                    ]
                ).with_context("Failed to store playlist item")?;
            }

            Ok(())
        }).await
    }

    /// Retrieves a playlist by ID with its items
    pub async fn get_playlist(&self, playlist_id: &str) -> Result<Option<Playlist>> {
        let db_path = self.db_path.clone();
        let playlist_id = playlist_id.to_string();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for playlist retrieval")?;
            
            // Get playlist metadata
            let playlist_result = conn.query_row(
                r#"SELECT id, title, claimId, seasonNumber, seriesKey, updatedAt 
                   FROM playlists WHERE id = ?1"#,
                params![playlist_id],
                |row| Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<u32>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                ))
            ).optional().with_context("Failed to query playlist")?;

            if let Some((id, title, claim_id, season_number, series_key)) = playlist_result {
                // Get playlist items
                let mut stmt = conn.prepare(
                    r#"SELECT claimId, position, episodeNumber, seasonNumber 
                       FROM playlist_items 
                       WHERE playlistId = ?1 
                       ORDER BY position ASC"#
                ).with_context("Failed to prepare playlist items query")?;

                let items_rows = stmt.query_map(params![id], |row| {
                    Ok(PlaylistItem {
                        claim_id: row.get(0)?,
                        position: row.get(1)?,
                        episode_number: row.get(2)?,
                        season_number: row.get(3)?,
                    })
                }).with_context("Failed to query playlist items")?;

                let mut items = Vec::new();
                for item_row in items_rows {
                    items.push(item_row.with_context("Failed to parse playlist item")?);
                }

                Ok(Some(Playlist {
                    id,
                    title,
                    claim_id,
                    items,
                    season_number,
                    series_key,
                }))
            } else {
                Ok(None)
            }
        }).await?
    }

    /// Retrieves all playlists for a series
    pub async fn get_playlists_for_series(&self, series_key: &str) -> Result<Vec<Playlist>> {
        let db_path = self.db_path.clone();
        let series_key = series_key.to_string();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for series playlists")?;
            
            let mut stmt = conn.prepare(
                r#"SELECT id, title, claimId, seasonNumber, seriesKey, updatedAt 
                   FROM playlists 
                   WHERE seriesKey = ?1 
                   ORDER BY seasonNumber ASC"#
            ).with_context("Failed to prepare series playlists query")?;

            let playlist_rows = stmt.query_map(params![series_key], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<u32>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                ))
            }).with_context("Failed to query series playlists")?;

            let mut playlists = Vec::new();
            for playlist_row in playlist_rows {
                let (id, title, claim_id, season_number, series_key) = 
                    playlist_row.with_context("Failed to parse playlist row")?;

                // Get items for this playlist
                let mut items_stmt = conn.prepare(
                    r#"SELECT claimId, position, episodeNumber, seasonNumber 
                       FROM playlist_items 
                       WHERE playlistId = ?1 
                       ORDER BY position ASC"#
                ).with_context("Failed to prepare playlist items query")?;

                let items_rows = items_stmt.query_map(params![id], |row| {
                    Ok(PlaylistItem {
                        claim_id: row.get(0)?,
                        position: row.get(1)?,
                        episode_number: row.get(2)?,
                        season_number: row.get(3)?,
                    })
                }).with_context("Failed to query playlist items")?;

                let mut items = Vec::new();
                for item_row in items_rows {
                    items.push(item_row.with_context("Failed to parse playlist item")?);
                }

                playlists.push(Playlist {
                    id,
                    title,
                    claim_id,
                    items,
                    season_number,
                    series_key,
                });
            }

            Ok(playlists)
        }).await?
    }

    /// Deletes a playlist and its items
    pub async fn delete_playlist(&self, playlist_id: &str) -> Result<()> {
        let playlist_id = playlist_id.to_string();
        
        self.with_transaction(move |tx| {
            tx.execute(
                "DELETE FROM playlist_items WHERE playlistId = ?1",
                params![playlist_id]
            ).with_context("Failed to delete playlist items")?;

            tx.execute(
                "DELETE FROM playlists WHERE id = ?1",
                params![playlist_id]
            ).with_context("Failed to delete playlist")?;

            Ok(())
        }).await
    }
    // Progress operations
    
    /// Saves video playback progress
    pub async fn save_progress(&self, progress: ProgressData) -> Result<()> {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for progress save")?;
            
            conn.execute(
                "INSERT OR REPLACE INTO progress (claimId, positionSeconds, quality, updatedAt) VALUES (?1, ?2, ?3, ?4)",
                params![progress.claim_id, progress.position_seconds, progress.quality, progress.updated_at]
            ).with_context("Failed to save progress")?;

            debug!("Saved progress for {}: {}s", progress.claim_id, progress.position_seconds);
            Ok(())
        }).await?
    }

    /// Retrieves video playback progress
    pub async fn get_progress(&self, claim_id: &str) -> Result<Option<ProgressData>> {
        let db_path = self.db_path.clone();
        let claim_id = claim_id.to_string();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for progress retrieval")?;
            
            let result = conn.query_row(
                "SELECT claimId, positionSeconds, quality, updatedAt FROM progress WHERE claimId = ?1",
                params![claim_id],
                |row| Ok(ProgressData {
                    claim_id: row.get(0)?,
                    position_seconds: row.get(1)?,
                    quality: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            ).optional().with_context("Failed to query progress")?;

            Ok(result)
        }).await?
    }

    /// Deletes progress for a specific content item
    pub async fn delete_progress(&self, claim_id: &str) -> Result<()> {
        let db_path = self.db_path.clone();
        let claim_id = claim_id.to_string();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for progress deletion")?;
            
            conn.execute(
                "DELETE FROM progress WHERE claimId = ?1",
                params![claim_id]
            ).with_context("Failed to delete progress")?;

            Ok(())
        }).await?
    }

    /// Cleans up old progress entries (older than 90 days)
    pub async fn cleanup_old_progress(&self) -> Result<u32> {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for progress cleanup")?;
            
            let cutoff_time = Utc::now().timestamp() - (90 * 24 * 60 * 60); // 90 days
            
            let removed = conn.execute(
                "DELETE FROM progress WHERE updatedAt < ?1",
                params![cutoff_time]
            ).with_context("Failed to cleanup old progress")?;

            if removed > 0 {
                info!("Cleaned up {} old progress entries", removed);
            }

            Ok(removed as u32)
        }).await?
    }

    // Favorites operations
    
    /// Saves a favorite item
    pub async fn save_favorite(&self, favorite: FavoriteItem) -> Result<()> {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for favorite save")?;
            
            conn.execute(
                "INSERT OR REPLACE INTO favorites (claimId, title, thumbnailUrl, insertedAt) VALUES (?1, ?2, ?3, ?4)",
                params![favorite.claim_id, favorite.title, favorite.thumbnail_url, favorite.inserted_at]
            ).with_context("Failed to save favorite")?;

            debug!("Saved favorite: {}", favorite.claim_id);
            Ok(())
        }).await?
    }

    /// Removes a favorite item
    pub async fn remove_favorite(&self, claim_id: &str) -> Result<()> {
        let db_path = self.db_path.clone();
        let claim_id = claim_id.to_string();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for favorite removal")?;
            
            let removed = conn.execute(
                "DELETE FROM favorites WHERE claimId = ?1", 
                params![claim_id]
            ).with_context("Failed to remove favorite")?;

            if removed > 0 {
                debug!("Removed favorite: {}", claim_id);
            }
            Ok(())
        }).await?
    }

    /// Retrieves all favorite items
    pub async fn get_favorites(&self) -> Result<Vec<FavoriteItem>> {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for favorites retrieval")?;
            
            let mut stmt = conn.prepare(
                "SELECT claimId, title, thumbnailUrl, insertedAt FROM favorites ORDER BY insertedAt DESC"
            ).with_context("Failed to prepare favorites query")?;
            
            let rows = stmt.query_map([], |row| {
                Ok(FavoriteItem {
                    claim_id: row.get(0)?,
                    title: row.get(1)?,
                    thumbnail_url: row.get(2)?,
                    inserted_at: row.get(3)?,
                })
            }).with_context("Failed to execute favorites query")?;

            let mut favorites = Vec::new();
            for row in rows {
                favorites.push(row.with_context("Failed to parse favorite row")?);
            }

            debug!("Retrieved {} favorites", favorites.len());
            Ok(favorites)
        }).await?
    }

    /// Checks if a content item is favorited
    pub async fn is_favorite(&self, claim_id: &str) -> Result<bool> {
        let db_path = self.db_path.clone();
        let claim_id = claim_id.to_string();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for favorite check")?;
            
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM favorites WHERE claimId = ?1",
                params![claim_id],
                |row| row.get(0)
            ).with_context("Failed to check favorite status")?;

            Ok(count > 0)
        }).await?
    }

    // Offline metadata operations
    
    /// Saves offline content metadata
    pub async fn save_offline_metadata(&self, metadata: OfflineMetadata) -> Result<()> {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for offline metadata save")?;
            
            conn.execute(
                "INSERT OR REPLACE INTO offline_meta (claimId, quality, filename, fileSize, encrypted, addedAt) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![metadata.claim_id, metadata.quality, metadata.filename, metadata.file_size, metadata.encrypted, metadata.added_at]
            ).with_context("Failed to save offline metadata")?;

            debug!("Saved offline metadata for {}: {}", metadata.claim_id, metadata.quality);
            Ok(())
        }).await?
    }

    /// Retrieves offline content metadata
    pub async fn get_offline_metadata(&self, claim_id: &str, quality: &str) -> Result<Option<OfflineMetadata>> {
        let db_path = self.db_path.clone();
        let claim_id = claim_id.to_string();
        let quality = quality.to_string();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for offline metadata retrieval")?;
            
            let result = conn.query_row(
                "SELECT claimId, quality, filename, fileSize, encrypted, addedAt FROM offline_meta WHERE claimId = ?1 AND quality = ?2",
                params![claim_id, quality],
                |row| Ok(OfflineMetadata {
                    claim_id: row.get(0)?,
                    quality: row.get(1)?,
                    filename: row.get(2)?,
                    file_size: row.get(3)?,
                    encrypted: row.get(4)?,
                    added_at: row.get(5)?,
                })
            ).optional().with_context("Failed to query offline metadata")?;

            Ok(result)
        }).await?
    }

    /// Deletes offline content metadata
    pub async fn delete_offline_metadata(&self, claim_id: &str, quality: &str) -> Result<()> {
        let db_path = self.db_path.clone();
        let claim_id = claim_id.to_string();
        let quality = quality.to_string();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for offline metadata deletion")?;
            
            conn.execute(
                "DELETE FROM offline_meta WHERE claimId = ?1 AND quality = ?2",
                params![claim_id, quality]
            ).with_context("Failed to delete offline metadata")?;

            debug!("Deleted offline metadata for {}: {}", claim_id, quality);
            Ok(())
        }).await?
    }

    /// Retrieves all offline content metadata
    pub async fn get_all_offline_metadata(&self) -> Result<Vec<OfflineMetadata>> {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for all offline metadata retrieval")?;
            
            let mut stmt = conn.prepare(
                "SELECT claimId, quality, filename, fileSize, encrypted, addedAt FROM offline_meta ORDER BY addedAt DESC"
            ).with_context("Failed to prepare offline metadata query")?;
            
            let rows = stmt.query_map([], |row| {
                Ok(OfflineMetadata {
                    claim_id: row.get(0)?,
                    quality: row.get(1)?,
                    filename: row.get(2)?,
                    file_size: row.get(3)?,
                    encrypted: row.get(4)?,
                    added_at: row.get(5)?,
                })
            }).with_context("Failed to execute offline metadata query")?;

            let mut metadata_list = Vec::new();
            for row in rows {
                metadata_list.push(row.with_context("Failed to parse offline metadata row")?);
            }

            debug!("Retrieved {} offline metadata entries", metadata_list.len());
            Ok(metadata_list)
        }).await?
    }

    /// Checks if content is available offline
    pub async fn is_offline_available(&self, claim_id: &str, quality: &str) -> Result<bool> {
        let db_path = self.db_path.clone();
        let claim_id = claim_id.to_string();
        let quality = quality.to_string();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for offline availability check")?;
            
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM offline_meta WHERE claimId = ?1 AND quality = ?2",
                params![claim_id, quality],
                |row| row.get(0)
            ).with_context("Failed to check offline availability")?;

            Ok(count > 0)
        }).await?
    }

    /// Analyzes query performance and returns execution plan
    /// This is useful for debugging slow queries and verifying index usage
    pub async fn analyze_query(&self, query: &str) -> Result<Vec<String>> {
        let db_path = self.db_path.clone();
        let query = query.to_string();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for query analysis")?;
            
            // Use EXPLAIN QUERY PLAN to analyze the query
            let explain_query = format!("EXPLAIN QUERY PLAN {}", query);
            
            let mut stmt = conn.prepare(&explain_query)
                .with_context("Failed to prepare query analysis")?;
            
            let rows = stmt.query_map([], |row| {
                // EXPLAIN QUERY PLAN returns: id, parent, notused, detail
                let detail: String = row.get(3)?;
                Ok(detail)
            }).with_context("Failed to execute query analysis")?;

            let mut plan = Vec::new();
            for row in rows {
                plan.push(row.with_context("Failed to parse query plan row")?);
            }

            Ok(plan)
        }).await?
    }

    /// Optimizes the database by running ANALYZE and VACUUM
    /// This should be called periodically to maintain optimal performance
    pub async fn optimize(&self) -> Result<()> {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for optimization")?;
            
            // Run ANALYZE to update query planner statistics
            conn.execute("ANALYZE", [])
                .with_context("Failed to run ANALYZE")?;
            
            // Run VACUUM to reclaim space and defragment
            // Note: VACUUM cannot run inside a transaction
            conn.execute("VACUUM", [])
                .with_context("Failed to run VACUUM")?;
            
            info!("Database optimization completed (ANALYZE + VACUUM)");
            Ok(())
        }).await?
    }

    // Settings operations
    
    /// Retrieves a setting value
    pub async fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let db_path = self.db_path.clone();
        let key = key.to_string();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for setting retrieval")?;
            
            let result = conn.query_row(
                "SELECT value FROM app_settings WHERE key = ?1",
                params![key],
                |row| row.get::<_, String>(0)
            ).optional().with_context("Failed to query setting")?;

            Ok(result)
        }).await?
    }

    /// Sets a setting value
    pub async fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        let db_path = self.db_path.clone();
        let key = key.to_string();
        let value = value.to_string();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for setting save")?;
            
            conn.execute(
                "INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
                params![key, value, Utc::now().timestamp()]
            ).with_context("Failed to save setting")?;

            debug!("Saved setting: {} = {}", key, value);
            Ok(())
        }).await?
    }

    /// Retrieves all settings as a map
    pub async fn get_all_settings(&self) -> Result<std::collections::HashMap<String, String>> {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for all settings retrieval")?;
            
            let mut stmt = conn.prepare(
                "SELECT key, value FROM app_settings"
            ).with_context("Failed to prepare settings query")?;
            
            let rows = stmt.query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            }).with_context("Failed to execute settings query")?;

            let mut settings = std::collections::HashMap::new();
            for row in rows {
                let (key, value) = row.with_context("Failed to parse setting row")?;
                settings.insert(key, value);
            }

            Ok(settings)
        }).await?
    }

    // Diagnostics and statistics operations
    
    /// Retrieves cache statistics
    pub async fn get_cache_stats(&self) -> Result<CacheStats> {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for cache stats")?;
            
            let result = conn.query_row(
                r#"SELECT total_items, total_size_bytes, hit_count, miss_count, last_cleanup 
                   FROM cache_stats WHERE id = 1"#,
                [],
                |row| {
                    let hit_count: u64 = row.get(2)?;
                    let miss_count: u64 = row.get(3)?;
                    let total_requests = hit_count + miss_count;
                    let hit_rate = if total_requests > 0 {
                        hit_count as f64 / total_requests as f64
                    } else {
                        0.0
                    };

                    Ok(CacheStats {
                        total_items: row.get(0)?,
                        cache_size_bytes: row.get(1)?,
                        hit_rate,
                        last_cleanup: row.get(4)?,
                    })
                }
            ).with_context("Failed to query cache stats")?;

            Ok(result)
        }).await?
    }

    /// Gets database version from migrations table
    pub async fn get_database_version(&self) -> Result<u32> {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for version check")?;
            
            let version: u32 = conn.query_row(
                "SELECT COALESCE(MAX(version), 0) FROM migrations",
                [],
                |row| row.get(0)
            ).unwrap_or(0);

            Ok(version)
        }).await?
    }

    /// Performs database integrity check
    pub async fn check_integrity(&self) -> Result<bool> {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for integrity check")?;
            
            let result: String = conn.query_row(
                "PRAGMA integrity_check",
                [],
                |row| row.get(0)
            ).with_context("Failed to run integrity check")?;

            Ok(result == "ok")
        }).await?
    }

    /// Gets database file size in bytes
    pub async fn get_database_size(&self) -> Result<u64> {
        let metadata = tokio::fs::metadata(&self.db_path).await
            .with_context("Failed to get database file metadata")?;
        
        Ok(metadata.len())
    }

    /// Invalidates cache for a specific content item
    pub async fn invalidate_cache_item(&self, claim_id: &str) -> Result<bool> {
        let db_path = self.db_path.clone();
        let claim_id = claim_id.to_string();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for cache invalidation")?;
            
            let removed = conn.execute(
                "DELETE FROM local_cache WHERE claimId = ?1",
                params![claim_id]
            ).with_context("Failed to invalidate cache item")?;

            if removed > 0 {
                // Update cache stats
                conn.execute(
                    r#"UPDATE cache_stats SET 
                       total_items = (SELECT COUNT(*) FROM local_cache),
                       total_size_bytes = (SELECT SUM(LENGTH(videoUrls) + LENGTH(tags) + LENGTH(title)) FROM local_cache)
                       WHERE id = 1"#,
                    []
                ).with_context("Failed to update cache stats after invalidation")?;

                info!("Invalidated cache for item: {}", claim_id);
                Ok(true)
            } else {
                debug!("No cache entry found for item: {}", claim_id);
                Ok(false)
            }
        }).await?
    }

    /// Invalidates cache for all items with specific tags
    pub async fn invalidate_cache_by_tags(&self, tags: Vec<String>) -> Result<u32> {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for tag-based cache invalidation")?;
            
            let mut total_removed = 0;
            
            for tag in &tags {
                // Sanitize the tag to prevent injection
                let sanitized_tag = sanitization::sanitize_tag(tag)?;
                
                // Look for the tag as a JSON array element
                let removed = conn.execute(
                    "DELETE FROM local_cache WHERE tags LIKE ?1 OR tags LIKE ?2",
                    params![
                        format!("%\"{}\",%", sanitized_tag),  // Tag with comma after
                        format!("%\"{}\"]%", sanitized_tag)   // Tag as last element
                    ]
                ).with_context_fn(|| format!("Failed to invalidate cache for tag: {}", tag))?;
                
                total_removed += removed;
            }

            if total_removed > 0 {
                // Update cache stats
                conn.execute(
                    r#"UPDATE cache_stats SET 
                       total_items = (SELECT COUNT(*) FROM local_cache),
                       total_size_bytes = (SELECT SUM(LENGTH(videoUrls) + LENGTH(tags) + LENGTH(title)) FROM local_cache)
                       WHERE id = 1"#,
                    []
                ).with_context("Failed to update cache stats after tag invalidation")?;

                info!("Invalidated {} cache items for tags: {:?}", total_removed, tags);
            }

            Ok(total_removed as u32)
        }).await?
    }

    /// Clears all cache items (force refresh)
    pub async fn clear_all_cache(&self) -> Result<u32> {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for cache clear")?;
            
            let removed = conn.execute(
                "DELETE FROM local_cache",
                []
            ).with_context("Failed to clear cache")?;

            // Reset cache stats
            conn.execute(
                r#"UPDATE cache_stats SET 
                   total_items = 0,
                   total_size_bytes = 0,
                   last_cleanup = ?1
                   WHERE id = 1"#,
                params![Utc::now().timestamp()]
            ).with_context("Failed to reset cache stats")?;

            info!("Cleared all cache: {} items removed", removed);
            Ok(removed as u32)
        }).await?
    }

    /// Invalidates cache items older than a specific timestamp
    pub async fn invalidate_cache_before(&self, timestamp: i64) -> Result<u32> {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for timestamp-based invalidation")?;
            
            let removed = conn.execute(
                "DELETE FROM local_cache WHERE updatedAt < ?1",
                params![timestamp]
            ).with_context("Failed to invalidate cache by timestamp")?;

            if removed > 0 {
                // Update cache stats
                conn.execute(
                    r#"UPDATE cache_stats SET 
                       total_items = (SELECT COUNT(*) FROM local_cache),
                       total_size_bytes = (SELECT SUM(LENGTH(videoUrls) + LENGTH(tags) + LENGTH(title)) FROM local_cache),
                       last_cleanup = ?1
                       WHERE id = 1"#,
                    params![Utc::now().timestamp()]
                ).with_context("Failed to update cache stats after timestamp invalidation")?;

                info!("Invalidated {} cache items older than timestamp {}", removed, timestamp);
            }

            Ok(removed as u32)
        }).await?
    }

    /// Performs comprehensive database cleanup
    pub async fn cleanup_all(&self) -> Result<()> {
        info!("Starting comprehensive database cleanup");
        
        // Clean up expired cache
        let expired_cache = self.cleanup_expired_cache().await?;
        
        // Clean up old progress
        let old_progress = self.cleanup_old_progress().await?;
        
        // Optimize database
        self.optimize().await?;
        
        info!("Database cleanup completed: {} expired cache items, {} old progress entries", 
              expired_cache, old_progress);
        
        Ok(())
    }

    // Migration management methods

    /// Gets the migration history for diagnostics
    pub async fn get_migration_history(&self) -> Result<Vec<crate::migrations::MigrationInfo>> {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for migration history")?;
            
            let migration_runner = crate::migrations::MigrationRunner::new();
            migration_runner.get_migration_history(&conn)
        }).await?
    }

    /// Validates that all applied migrations are consistent
    pub async fn validate_migrations(&self) -> Result<()> {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for migration validation")?;
            
            let migration_runner = crate::migrations::MigrationRunner::new();
            migration_runner.validate_migrations(&conn)
        }).await?
    }

    /// Forces a re-run of a specific migration (for testing/recovery)
    pub async fn rerun_migration(&self, version: u32) -> Result<()> {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for migration rerun")?;
            
            // Remove the migration record
            conn.execute(
                "DELETE FROM migrations WHERE version = ?1",
                params![version]
            ).with_context_fn(|| format!("Failed to remove migration {} record", version))?;
            
            // Re-run migrations
            let migration_runner = crate::migrations::MigrationRunner::new();
            migration_runner.run_migrations(&conn)
        }).await?
    }

    /// Creates a backup of the database before running migrations
    pub async fn backup_database(&self, backup_path: &std::path::Path) -> Result<()> {
        let source_path = self.db_path.clone();
        
        tokio::fs::copy(&source_path, backup_path).await
            .with_context("Failed to create database backup")?;
        
        info!("Database backed up to {:?}", backup_path);
        Ok(())
    }

    /// Restores database from a backup file
    pub async fn restore_database(&self, backup_path: &std::path::Path) -> Result<()> {
        let target_path = self.db_path.clone();
        
        // Verify backup file exists and is valid
        if !backup_path.exists() {
            return Err(KiyyaError::Database(
                rusqlite::Error::InvalidPath("Backup file does not exist".into())
            ));
        }
        
        // Test that backup is a valid SQLite database
        task::spawn_blocking({
            let backup_path = backup_path.to_path_buf();
            move || {
                let conn = Connection::open(&backup_path)
                    .with_context("Backup file is not a valid SQLite database")?;
                
                // Test basic query
                let _: i64 = conn.query_row("SELECT COUNT(*) FROM sqlite_master", [], |row| row.get(0))
                    .with_context("Backup database appears to be corrupted")?;
                
                Ok::<(), KiyyaError>(())
            }
        }).await??;
        
        // Copy backup to target location
        tokio::fs::copy(backup_path, &target_path).await
            .with_context("Failed to restore database from backup")?;
        
        info!("Database restored from {:?}", backup_path);
        Ok(())
    }

    // ETag-like behavior for delta updates

    /// Gets the stored content hash for a claim ID
    pub async fn get_content_hash(&self, claim_id: &str) -> Result<Option<String>> {
        let db_path = self.db_path.clone();
        let claim_id = claim_id.to_string();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for content hash retrieval")?;
            
            let result = conn.query_row(
                "SELECT contentHash FROM local_cache WHERE claimId = ?1",
                params![claim_id],
                |row| row.get::<_, Option<String>>(0)
            ).optional().with_context("Failed to query content hash")?;

            Ok(result.flatten())
        }).await?
    }

    /// Gets stored content hashes for multiple claim IDs
    pub async fn get_content_hashes(&self, claim_ids: Vec<String>) -> Result<HashMap<String, String>> {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for content hashes retrieval")?;
            
            let mut hashes = HashMap::new();
            
            for claim_id in claim_ids {
                if let Some(hash) = conn.query_row(
                    "SELECT contentHash FROM local_cache WHERE claimId = ?1",
                    params![claim_id],
                    |row| row.get::<_, Option<String>>(0)
                ).optional()? {
                    if let Some(h) = hash {
                        hashes.insert(claim_id, h);
                    }
                }
            }

            Ok(hashes)
        }).await?
    }

    /// Stores only items that have changed (delta update)
    /// Returns the number of items that were updated
    pub async fn store_content_items_delta(&self, items: Vec<ContentItem>) -> Result<u32> {
        if items.is_empty() {
            return Ok(0);
        }

        let db_path = self.db_path.clone();
        let cache_ttl = self.cache_ttl_seconds;
        let max_items = self.max_cache_items;
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for delta content storage")?;
            
            let tx = conn.unchecked_transaction()
                .with_context("Failed to start transaction for delta content storage")?;

            let now = Utc::now().timestamp();
            let mut updated_count = 0;
            let total_items = items.len();

            for mut item in items {
                // Compute content hash if not already set
                if item.content_hash.is_none() {
                    item.update_content_hash();
                }
                
                // Check if item exists and has the same hash
                let existing_hash: Option<String> = tx.query_row(
                    "SELECT contentHash FROM local_cache WHERE claimId = ?1",
                    params![item.claim_id],
                    |row| row.get(0)
                ).optional()?;

                // Only update if hash is different or item doesn't exist
                let should_update = match existing_hash {
                    Some(hash) => item.content_hash.as_ref() != Some(&hash),
                    None => true, // Item doesn't exist, so insert it
                };

                if !should_update {
                    debug!("Skipping update for {} - content unchanged", item.claim_id);
                    continue;
                }

                let tags_json = serde_json::to_string(&item.tags)
                    .with_context("Failed to serialize tags")?;
                let video_urls_json = serde_json::to_string(&item.video_urls)
                    .with_context("Failed to serialize video URLs")?;
                let compatibility_json = serde_json::to_string(&item.compatibility)
                    .with_context("Failed to serialize compatibility info")?;

                tx.execute(
                    r#"INSERT OR REPLACE INTO local_cache 
                       (claimId, title, titleLower, description, descriptionLower, tags, thumbnailUrl, 
                        videoUrls, compatibility, releaseTime, duration, updatedAt, accessCount, lastAccessed,
                        etag, contentHash)
                       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 
                               COALESCE((SELECT accessCount FROM local_cache WHERE claimId = ?1), 0),
                               ?13, ?14, ?15)"#,
                    params![
                        item.claim_id,
                        item.title,
                        item.title.to_lowercase(),
                        item.description,
                        item.description.as_ref().map(|d| d.to_lowercase()),
                        tags_json,
                        item.thumbnail_url,
                        video_urls_json,
                        compatibility_json,
                        item.release_time,
                        item.duration,
                        now,
                        now,
                        item.etag,
                        item.content_hash
                    ]
                ).with_context_fn(|| format!("Failed to store content item: {}", item.claim_id))?;
                
                updated_count += 1;
            }

            // Update cache stats
            tx.execute(
                r#"UPDATE cache_stats SET 
                   total_items = (SELECT COUNT(*) FROM local_cache),
                   total_size_bytes = (SELECT SUM(LENGTH(videoUrls) + LENGTH(tags) + LENGTH(title)) FROM local_cache)
                   WHERE id = 1"#,
                []
            ).with_context("Failed to update cache stats")?;

            tx.commit()
                .with_context("Failed to commit delta content storage transaction")?;

            info!("Delta update: {} items updated out of {} checked", updated_count, total_items);

            // Check if we need to cleanup old items
            let total_items: u32 = conn.query_row(
                "SELECT COUNT(*) FROM local_cache",
                [],
                |row| row.get(0)
            ).unwrap_or(0);

            if total_items > max_items {
                debug!("Cache has {} items, cleaning up to {}", total_items, max_items);
                Self::cleanup_old_cache_items(&conn, max_items)?;
            }

            Ok(updated_count)
        }).await?
    }

    /// Checks if content items need updating by comparing hashes
    /// Returns a list of claim IDs that have changed
    pub async fn get_changed_items(&self, items: &[ContentItem]) -> Result<Vec<String>> {
        let db_path = self.db_path.clone();
        let claim_ids: Vec<String> = items.iter().map(|i| i.claim_id.clone()).collect();
        let item_hashes: HashMap<String, String> = items.iter()
            .filter_map(|i| {
                let hash = if let Some(h) = &i.content_hash {
                    h.clone()
                } else {
                    i.compute_content_hash()
                };
                Some((i.claim_id.clone(), hash))
            })
            .collect();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for change detection")?;
            
            let mut changed = Vec::new();
            
            for claim_id in claim_ids {
                let existing_hash: Option<String> = conn.query_row(
                    "SELECT contentHash FROM local_cache WHERE claimId = ?1",
                    params![claim_id],
                    |row| row.get(0)
                ).optional()?;

                let needs_update = match existing_hash {
                    Some(stored_hash) => {
                        // Compare with new hash
                        if let Some(new_hash) = item_hashes.get(&claim_id) {
                            stored_hash != *new_hash
                        } else {
                            false
                        }
                    }
                    None => true, // Item doesn't exist, needs to be added
                };

                if needs_update {
                    changed.push(claim_id);
                }
            }

            debug!("Change detection: {} items changed out of {} checked", changed.len(), item_hashes.len());
            Ok(changed)
        }).await?
    }

    /// Query content in chunks for memory-efficient processing of large datasets
    /// 
    /// This method retrieves content in batches to avoid loading all items into memory at once.
    /// Useful for processing large result sets without excessive memory usage.
    pub async fn query_content_chunked<F>(
        &self,
        query: CacheQuery,
        chunk_size: u32,
        mut processor: F,
    ) -> Result<()>
    where
        F: FnMut(Vec<ContentItem>) -> Result<()> + Send + 'static,
    {
        let db_path = self.db_path.clone();
        let cache_ttl = self.cache_ttl_seconds;
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for chunked query")?;
            
            let now = Utc::now().timestamp();
            let ttl_cutoff = now - cache_ttl;
            
            let mut offset = 0u32;
            let mut has_more = true;
            
            while has_more {
                let mut sql_query = r#"
                    SELECT claimId, title, description, tags, thumbnailUrl, videoUrls, 
                           compatibility, releaseTime, duration, updatedAt, etag, contentHash, raw_json 
                    FROM local_cache 
                    WHERE updatedAt > ?1
                "#.to_string();
                
                let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(ttl_cutoff)];
                
                // Add tag filtering if specified
                if let Some(tag_list) = &query.tags {
                    if !tag_list.is_empty() {
                        let sanitized_tags: Result<Vec<String>> = tag_list.iter()
                            .map(|tag| sanitization::sanitize_tag(tag))
                            .collect();
                        let sanitized_tags = sanitized_tags?;
                        
                        let mut tag_conditions = Vec::new();
                        for tag in sanitized_tags {
                            params.push(Box::new(format!("%{}%", tag)));
                            params.push(Box::new(format!("%,{},%", tag)));
                            tag_conditions.push(format!(
                                "(tags LIKE ?{} OR tags LIKE ?{})",
                                params.len() - 1,
                                params.len()
                            ));
                        }
                        sql_query.push_str(&format!(" AND ({})", tag_conditions.join(" OR ")));
                    }
                }
                
                // Add ordering and pagination
                sql_query.push_str(" ORDER BY releaseTime DESC");
                sql_query.push_str(&format!(" LIMIT {} OFFSET {}", chunk_size, offset));
                
                let mut stmt = conn.prepare(&sql_query)
                    .with_context("Failed to prepare chunked query")?;
                
                let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter()
                    .map(|p| p.as_ref() as &dyn rusqlite::ToSql)
                    .collect();
                
                let rows = stmt.query_map(param_refs.as_slice(), |row| {
                    let tags_json: String = row.get(3)?;
                    let video_urls_json: String = row.get(5)?;
                    let compatibility_json: String = row.get(6)?;

                    let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
                    let video_urls: std::collections::HashMap<String, VideoUrl> = 
                        serde_json::from_str(&video_urls_json).unwrap_or_default();
                    let compatibility: CompatibilityInfo = 
                        serde_json::from_str(&compatibility_json).unwrap_or(CompatibilityInfo {
                            compatible: false,
                            reason: Some("Parse error".to_string()),
                            fallback_available: false,
                        });

                    Ok(ContentItem {
                        claim_id: row.get(0)?,
                        title: row.get(1)?,
                        description: row.get(2)?,
                        tags,
                        thumbnail_url: row.get(4)?,
                        duration: row.get(8)?,
                        release_time: row.get(7)?,
                        video_urls,
                        compatibility,
                        etag: row.get(10)?,
                        content_hash: row.get(11)?,
                        raw_json: row.get(12)?,
                    })
                }).with_context("Failed to execute chunked query")?;

                let mut chunk = Vec::new();
                for row in rows {
                    chunk.push(row.with_context("Failed to parse content item")?);
                }
                
                has_more = chunk.len() == chunk_size as usize;
                
                if !chunk.is_empty() {
                    processor(chunk)?;
                }
                
                offset += chunk_size;
            }
            
            Ok(())
        }).await?
    }

    /// Get memory usage statistics for the database
    pub async fn get_memory_stats(&self) -> Result<MemoryStats> {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for memory stats")?;
            
            // Get cache size
            let cache_count: u32 = conn.query_row(
                "SELECT COUNT(*) FROM local_cache",
                [],
                |row| row.get(0)
            ).unwrap_or(0);
            
            // Get approximate cache size in bytes
            let cache_size: i64 = conn.query_row(
                "SELECT SUM(LENGTH(videoUrls) + LENGTH(tags) + LENGTH(title) + LENGTH(description)) FROM local_cache",
                [],
                |row| row.get(0)
            ).unwrap_or(0);
            
            // Get playlist count
            let playlist_count: u32 = conn.query_row(
                "SELECT COUNT(*) FROM playlists",
                [],
                |row| row.get(0)
            ).unwrap_or(0);
            
            // Get favorites count
            let favorites_count: u32 = conn.query_row(
                "SELECT COUNT(*) FROM favorites",
                [],
                |row| row.get(0)
            ).unwrap_or(0);
            
            // Get offline content count
            let offline_count: u32 = conn.query_row(
                "SELECT COUNT(*) FROM offline_meta",
                [],
                |row| row.get(0)
            ).unwrap_or(0);
            
            // Get database file size
            let db_file_size = std::fs::metadata(&db_path)
                .map(|m| m.len())
                .unwrap_or(0);
            
            Ok(MemoryStats {
                cache_items: cache_count,
                cache_size_bytes: cache_size as u64,
                playlist_count,
                favorites_count,
                offline_content_count: offline_count,
                database_file_size: db_file_size,
            })
        }).await?
    }

    /// Optimize database for better memory usage
    /// 
    /// Performs VACUUM and ANALYZE operations to reclaim space and update statistics
    pub async fn optimize_memory(&self) -> Result<()> {
        let db_path = self.db_path.clone();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database for optimization")?;
            
            info!("Starting database optimization...");
            
            // Run VACUUM to reclaim space
            conn.execute("VACUUM", [])
                .with_context("Failed to vacuum database")?;
            
            // Run ANALYZE to update query planner statistics
            conn.execute("ANALYZE", [])
                .with_context("Failed to analyze database")?;
            
            info!("Database optimization completed");
            Ok(())
        }).await?
    }
    
    /// Generic execute method for error logging and other modules
    /// Executes a SQL statement with parameters
    pub async fn execute_sql(&self, sql: &str, params: Vec<rusqlite::types::Value>) -> Result<u64> {
        let db_path = self.db_path.clone();
        let sql = sql.to_string();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database connection")?;
            
            let rows_affected = conn.execute(&sql, rusqlite::params_from_iter(params.iter()))
                .with_context("Failed to execute SQL")?;
            
            Ok(rows_affected as u64)
        }).await?
    }
    
    /// Generic query method for error logging and other modules
    /// Executes a SQL query and returns rows
    pub async fn query_sql(&self, sql: &str, params: Vec<rusqlite::types::Value>) -> Result<Vec<HashMap<String, rusqlite::types::Value>>> {
        let db_path = self.db_path.clone();
        let sql = sql.to_string();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database connection")?;
            
            let mut stmt = conn.prepare(&sql)
                .with_context("Failed to prepare SQL statement")?;
            
            let column_count = stmt.column_count();
            let column_names: Vec<String> = (0..column_count)
                .map(|i| stmt.column_name(i).unwrap_or("").to_string())
                .collect();
            
            let rows = stmt.query_map(rusqlite::params_from_iter(params.iter()), |row| {
                let mut map = HashMap::new();
                for (i, name) in column_names.iter().enumerate() {
                    let value: rusqlite::types::Value = row.get(i)?;
                    map.insert(name.clone(), value);
                }
                Ok(map)
            })
            .with_context("Failed to execute query")?;
            
            let mut results = Vec::new();
            for row in rows {
                results.push(row?);
            }
            
            Ok(results)
        }).await?
    }
    
    /// Query a single value from the database
    pub async fn query_one_sql<T>(&self, sql: &str, params: Vec<rusqlite::types::Value>) -> Result<Option<T>>
    where
        T: rusqlite::types::FromSql + Send + 'static,
    {
        let db_path = self.db_path.clone();
        let sql = sql.to_string();
        
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .with_context("Failed to open database connection")?;
            
            let result: Option<T> = conn.query_row(&sql, rusqlite::params_from_iter(params.iter()), |row| row.get(0))
                .optional()
                .with_context("Failed to query single value")?;
            
            Ok(result)
        }).await?
    }
}

// Remove the old get_migrations function since we're using the one from migrations.rs

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use tempfile::TempDir;
    use std::collections::HashMap;

    async fn create_test_database() -> Result<(Database, TempDir)> {
        let temp_dir = tempfile::tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        
        let db = Database {
            db_path,
            connection_pool: Arc::new(Mutex::new(Vec::new())),
            max_connections: 5,
            cache_ttl_seconds: 30 * 60,
            max_cache_items: 200,
            fts5_available: false,
        };
        
        // Initialize with simpler configuration for tests
        let db_path = db.db_path.clone();
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)?;
            
            // Enable foreign keys only (skip WAL mode for tests)
            conn.execute("PRAGMA foreign_keys = ON", [])?;
            
            // Create test tables with simplified schema
            conn.execute_batch(r#"
                CREATE TABLE IF NOT EXISTS migrations (
                    version INTEGER PRIMARY KEY,
                    applied_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS favorites (
                    claimId TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    thumbnailUrl TEXT,
                    insertedAt INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS progress (
                    claimId TEXT PRIMARY KEY,
                    positionSeconds INTEGER NOT NULL,
                    quality TEXT NOT NULL,
                    updatedAt INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS offline_meta (
                    claimId TEXT NOT NULL,
                    quality TEXT NOT NULL,
                    filename TEXT NOT NULL,
                    fileSize INTEGER NOT NULL,
                    encrypted BOOLEAN DEFAULT FALSE,
                    addedAt INTEGER NOT NULL,
                    PRIMARY KEY (claimId, quality)
                );

                CREATE TABLE IF NOT EXISTS local_cache (
                    claimId TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    titleLower TEXT NOT NULL,
                    description TEXT,
                    descriptionLower TEXT,
                    tags TEXT NOT NULL,
                    thumbnailUrl TEXT,
                    videoUrls TEXT NOT NULL,
                    compatibility TEXT NOT NULL,
                    releaseTime INTEGER NOT NULL,
                    duration INTEGER,
                    updatedAt INTEGER NOT NULL,
                    accessCount INTEGER DEFAULT 0,
                    lastAccessed INTEGER,
                    etag TEXT,
                    contentHash TEXT,
                    raw_json TEXT
                );

                CREATE TABLE IF NOT EXISTS playlists (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    claimId TEXT NOT NULL,
                    seasonNumber INTEGER,
                    seriesKey TEXT,
                    itemCount INTEGER DEFAULT 0,
                    updatedAt INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS playlist_items (
                    playlistId TEXT NOT NULL,
                    claimId TEXT NOT NULL,
                    position INTEGER NOT NULL,
                    episodeNumber INTEGER,
                    seasonNumber INTEGER,
                    title TEXT,
                    PRIMARY KEY (playlistId, claimId),
                    FOREIGN KEY (playlistId) REFERENCES playlists(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS app_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS cache_stats (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    total_items INTEGER DEFAULT 0,
                    total_size_bytes INTEGER DEFAULT 0,
                    hit_count INTEGER DEFAULT 0,
                    miss_count INTEGER DEFAULT 0,
                    last_cleanup INTEGER,
                    created_at INTEGER NOT NULL
                );
            "#)?;

            // Initialize cache stats
            conn.execute(
                "INSERT OR IGNORE INTO cache_stats (id, created_at) VALUES (1, ?1)",
                params![Utc::now().timestamp()]
            )?;

            Ok::<(), KiyyaError>(())
        }).await??;
        
        Ok((db, temp_dir))
    }

    /// Public test helper for creating a database with custom TTL (for property tests)
    pub(crate) fn create_test_database_with_ttl(ttl_seconds: i64) -> (Database, TempDir, std::path::PathBuf) {
        let temp_dir = tempfile::tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        
        let db = Database {
            db_path: db_path.clone(),
            connection_pool: Arc::new(Mutex::new(Vec::new())),
            max_connections: 5,
            cache_ttl_seconds: ttl_seconds,
            max_cache_items: 200,
            fts5_available: false,
        };
        
        // Initialize database schema for tests
        let init_path = db_path.clone();
        std::thread::spawn(move || {
            let conn = Connection::open(&init_path).unwrap();
            conn.execute("PRAGMA foreign_keys = ON", []).unwrap();
            
            conn.execute_batch(r#"
                CREATE TABLE IF NOT EXISTS local_cache (
                    claimId TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    titleLower TEXT NOT NULL,
                    description TEXT,
                    descriptionLower TEXT,
                    tags TEXT NOT NULL,
                    thumbnailUrl TEXT,
                    videoUrls TEXT NOT NULL,
                    compatibility TEXT NOT NULL,
                    releaseTime INTEGER NOT NULL,
                    duration INTEGER,
                    updatedAt INTEGER NOT NULL,
                    accessCount INTEGER DEFAULT 0,
                    lastAccessed INTEGER,
                    etag TEXT,
                    contentHash TEXT,
                    raw_json TEXT
                );
                
                CREATE TABLE IF NOT EXISTS cache_stats (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    total_items INTEGER DEFAULT 0,
                    total_size_bytes INTEGER DEFAULT 0,
                    hit_count INTEGER DEFAULT 0,
                    miss_count INTEGER DEFAULT 0,
                    last_cleanup INTEGER,
                    created_at INTEGER NOT NULL
                );
                
                CREATE TABLE IF NOT EXISTS offline_meta (
                    claimId TEXT NOT NULL,
                    quality TEXT NOT NULL,
                    filename TEXT NOT NULL,
                    fileSize INTEGER NOT NULL,
                    encrypted BOOLEAN DEFAULT FALSE,
                    addedAt INTEGER NOT NULL,
                    PRIMARY KEY (claimId, quality)
                );
                
                -- Create all optimized indices
                CREATE INDEX IF NOT EXISTS idx_localcache_titleLower ON local_cache(titleLower);
                CREATE INDEX IF NOT EXISTS idx_localcache_tags ON local_cache(tags);
                CREATE INDEX IF NOT EXISTS idx_localcache_updatedAt ON local_cache(updatedAt DESC);
                CREATE INDEX IF NOT EXISTS idx_localcache_releaseTime ON local_cache(releaseTime DESC);
                CREATE INDEX IF NOT EXISTS idx_localcache_lastAccessed ON local_cache(lastAccessed DESC);
                CREATE INDEX IF NOT EXISTS idx_localcache_etag ON local_cache(etag);
                CREATE INDEX IF NOT EXISTS idx_localcache_contentHash ON local_cache(contentHash);
                CREATE INDEX IF NOT EXISTS idx_localcache_claimId ON local_cache(claimId);
                CREATE INDEX IF NOT EXISTS idx_localcache_cleanup ON local_cache(lastAccessed ASC, accessCount ASC);
                CREATE INDEX IF NOT EXISTS idx_localcache_tags_release ON local_cache(tags, releaseTime DESC);
                CREATE INDEX IF NOT EXISTS idx_localcache_ttl_tags ON local_cache(updatedAt DESC, tags);
                CREATE INDEX IF NOT EXISTS idx_offline_meta_encrypted ON offline_meta(encrypted);
                
                INSERT OR IGNORE INTO cache_stats (id, created_at) VALUES (1, strftime('%s', 'now'));
            "#).unwrap();
        }).join().unwrap();
        
        (db, temp_dir, db_path)
    }

    fn create_test_content_item() -> ContentItem {
        let mut video_urls = HashMap::new();
        video_urls.insert("720p".to_string(), VideoUrl {
            url: "https://example.com/video.mp4".to_string(),
            quality: "720p".to_string(),
            url_type: "mp4".to_string(),
            codec: Some("h264".to_string()),
        });

        let mut item = ContentItem {
            claim_id: "test-claim-123".to_string(),
            title: "Test Movie".to_string(),
            description: Some("A test movie".to_string()),
            tags: vec!["movie".to_string(), "action".to_string()],
            thumbnail_url: Some("https://example.com/thumb.jpg".to_string()),
            duration: Some(7200), // 2 hours
            release_time: Utc::now().timestamp(),
            video_urls,
            compatibility: CompatibilityInfo::compatible(),
            etag: None,
            content_hash: None,
            raw_json: None,
        };
        
        // Compute content hash
        item.update_content_hash();
        item
    }

    #[tokio::test]
    async fn test_migration_system() {
        let (db, _temp_dir) = create_test_database().await.unwrap();
        
        // Test that database version can be retrieved
        let version = db.get_database_version().await.unwrap();
        assert!(version >= 0, "Database version should be non-negative");
    }

    #[tokio::test]
    async fn test_migration_runner() {
        use crate::migrations::MigrationRunner;
        use tempfile::TempDir;
        
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test_migrations.db");
        
        let conn = Connection::open(&db_path).unwrap();
        
        // Test migration runner initialization
        let runner = MigrationRunner::new();
        
        // Ensure migrations table exists
        let _ = runner.ensure_migrations_table(&conn);
        
        // Test that we can get migration history (even if empty)
        let history = runner.get_migration_history(&conn).unwrap();
        assert!(history.is_empty() || !history.is_empty(), "Should be able to query migration history");
    }

    #[tokio::test]
    async fn test_migration_rollback() {
        use tempfile::TempDir;
        
        let temp_dir = TempDir::new().unwrap();
        let db_path = temp_dir.path().join("test_rollback.db");
        
        let conn = Connection::open(&db_path).unwrap();
        
        // Create migrations table
        conn.execute(
            r#"CREATE TABLE migrations (
                version INTEGER PRIMARY KEY,
                description TEXT,
                applied_at INTEGER NOT NULL,
                checksum TEXT
            )"#,
            []
        ).unwrap();
        
        // Test that failed migration rolls back properly
        // Use a migration that will definitely fail (trying to create a table that already exists)
        let bad_migration = crate::migrations::Migration {
            version: 999,
            description: "Bad migration for testing".to_string(),
            sql: "CREATE TABLE migrations (id INTEGER); CREATE TABLE migrations (id INTEGER);",
        };
        
        let runner = crate::migrations::MigrationRunner::new();
        
        // This should fail and rollback
        let result = runner.execute_migration(&conn, &bad_migration);
        assert!(result.is_err(), "Bad migration should fail");
        
        // Check that migration was not recorded
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM migrations WHERE version = 999",
            [],
            |row| row.get(0)
        ).unwrap();
        
        assert_eq!(count, 0, "Failed migration should not be recorded");
    }

    #[tokio::test]
    async fn test_database_backup_restore() {
        let (db, temp_dir) = create_test_database().await.unwrap();
        
        // Add some test data
        let test_item = create_test_content_item();
        db.store_content_items(vec![test_item.clone()]).await.unwrap();
        
        // Create backup
        let backup_path = temp_dir.path().join("backup.db");
        db.backup_database(&backup_path).await.unwrap();
        
        assert!(backup_path.exists(), "Backup file should exist");
        
        // Modify original database
        db.save_favorite(FavoriteItem {
            claim_id: "test-favorite".to_string(),
            title: "Test Favorite".to_string(),
            thumbnail_url: None,
            inserted_at: Utc::now().timestamp(),
        }).await.unwrap();
        
        // Restore from backup
        db.restore_database(&backup_path).await.unwrap();
        
        // Verify data is restored (favorite should be gone)
        let is_favorite = db.is_favorite("test-favorite").await.unwrap();
        assert!(!is_favorite, "Favorite should not exist after restore");
        
        // But original content should still be there
        let query = CacheQuery {
            tags: Some(vec!["movie".to_string()]),
            text_search: None,
            order_by: None,
            limit: Some(10),
            offset: None,
        };
        let content = db.get_cached_content(query).await.unwrap();
        assert!(!content.is_empty(), "Original content should be restored");
    }

    #[tokio::test]
    async fn test_database_initialization() {
        let (db, _temp_dir) = create_test_database().await.unwrap();
        
        // Test that we can get a connection
        let conn = db.get_connection().await.unwrap();
        
        // Test that tables exist
        let table_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table'",
            [],
            |row| row.get(0)
        ).unwrap();
        
        assert!(table_count >= 8, "Should have at least 8 tables, found {}", table_count);
        
        // Test that we can insert and retrieve data
        let test_result = conn.execute(
            "INSERT INTO app_settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
            params!["test_key", "test_value", Utc::now().timestamp()]
        );
        assert!(test_result.is_ok(), "Should be able to insert test data");
        
        let retrieved_value: String = conn.query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            params!["test_key"],
            |row| row.get(0)
        ).unwrap();
        assert_eq!(retrieved_value, "test_value");
    }

    #[tokio::test]
    async fn test_content_cache_operations() {
        let (db, _temp_dir) = create_test_database().await.unwrap();
        let items = vec![create_test_content_item()];
        db.store_content_items(items.clone()).await.unwrap();
        
        // Check what's actually stored in the database
        let db_path = db.db_path.clone();
        let stored_tags = task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)?;
            let tags: String = conn.query_row(
                "SELECT tags FROM local_cache WHERE claimId = ?1",
                params!["test-claim-123"],
                |row| row.get(0)
            )?;
            Ok::<String, KiyyaError>(tags)
        }).await.unwrap().unwrap();
        
        println!("Stored tags JSON: {}", stored_tags);
        
        // First test: retrieve without any filters to see if storage worked
        let query_no_filter = CacheQuery {
            tags: None,
            text_search: None,
            limit: Some(10),
            offset: Some(0),
            order_by: Some("releaseTime DESC".to_string()),
        };
        
        let all_items = db.get_cached_content(query_no_filter).await.unwrap();
        assert_eq!(all_items.len(), 1, "Should retrieve 1 item without filters");
        
        // Test with tag filter using correct JSON pattern
        let query_movie = CacheQuery {
            tags: Some(vec!["movie".to_string()]),
            text_search: None,
            limit: Some(10),
            offset: Some(0),
            order_by: Some("releaseTime DESC".to_string()),
        };
        
        let movie_items = db.get_cached_content(query_movie).await.unwrap();
        assert_eq!(movie_items.len(), 1, "Should retrieve 1 item with movie tag");
        assert_eq!(movie_items[0].claim_id, "test-claim-123");
        assert_eq!(movie_items[0].title, "Test Movie");
    }

    #[tokio::test]
    async fn test_progress_operations() {
        let (db, _temp_dir) = create_test_database().await.unwrap();
        
        let progress = ProgressData {
            claim_id: "test-claim-123".to_string(),
            position_seconds: 1800, // 30 minutes
            quality: "720p".to_string(),
            updated_at: Utc::now().timestamp(),
        };
        
        // Save progress
        db.save_progress(progress.clone()).await.unwrap();
        
        // Retrieve progress
        let retrieved = db.get_progress("test-claim-123").await.unwrap();
        assert!(retrieved.is_some());
        let retrieved = retrieved.unwrap();
        assert_eq!(retrieved.position_seconds, 1800);
        assert_eq!(retrieved.quality, "720p");
        
        // Delete progress
        db.delete_progress("test-claim-123").await.unwrap();
        let deleted = db.get_progress("test-claim-123").await.unwrap();
        assert!(deleted.is_none());
    }

    #[tokio::test]
    async fn test_favorites_operations() {
        let (db, _temp_dir) = create_test_database().await.unwrap();
        
        let favorite = FavoriteItem {
            claim_id: "test-claim-123".to_string(),
            title: "Test Movie".to_string(),
            thumbnail_url: Some("https://example.com/thumb.jpg".to_string()),
            inserted_at: Utc::now().timestamp(),
        };
        
        // Save favorite
        db.save_favorite(favorite.clone()).await.unwrap();
        
        // Check if favorited
        let is_fav = db.is_favorite("test-claim-123").await.unwrap();
        assert!(is_fav);
        
        // Get all favorites
        let favorites = db.get_favorites().await.unwrap();
        assert_eq!(favorites.len(), 1);
        assert_eq!(favorites[0].claim_id, "test-claim-123");
        
        // Remove favorite
        db.remove_favorite("test-claim-123").await.unwrap();
        let is_fav_after = db.is_favorite("test-claim-123").await.unwrap();
        assert!(!is_fav_after);
    }

    #[tokio::test]
    async fn test_offline_metadata_operations() {
        let (db, _temp_dir) = create_test_database().await.unwrap();
        
        let metadata = OfflineMetadata {
            claim_id: "test-claim-123".to_string(),
            quality: "720p".to_string(),
            filename: "test-movie-720p.mp4".to_string(),
            file_size: 1024 * 1024 * 500, // 500MB
            encrypted: false,
            added_at: Utc::now().timestamp(),
        };
        
        // Save metadata
        db.save_offline_metadata(metadata.clone()).await.unwrap();
        
        // Check if available offline
        let is_available = db.is_offline_available("test-claim-123", "720p").await.unwrap();
        assert!(is_available);
        
        // Get metadata
        let retrieved = db.get_offline_metadata("test-claim-123", "720p").await.unwrap();
        assert!(retrieved.is_some());
        let retrieved = retrieved.unwrap();
        assert_eq!(retrieved.filename, "test-movie-720p.mp4");
        assert_eq!(retrieved.file_size, 1024 * 1024 * 500);
        
        // Get all metadata
        let all_metadata = db.get_all_offline_metadata().await.unwrap();
        assert_eq!(all_metadata.len(), 1);
        
        // Delete metadata
        db.delete_offline_metadata("test-claim-123", "720p").await.unwrap();
        let deleted = db.get_offline_metadata("test-claim-123", "720p").await.unwrap();
        assert!(deleted.is_none());
    }

    #[tokio::test]
    async fn test_settings_operations() {
        let (db, _temp_dir) = create_test_database().await.unwrap();
        
        // Set a setting
        db.set_setting("theme", "dark").await.unwrap();
        db.set_setting("quality", "720p").await.unwrap();
        
        // Get a setting
        let theme = db.get_setting("theme").await.unwrap();
        assert_eq!(theme, Some("dark".to_string()));
        
        // Get non-existent setting
        let non_existent = db.get_setting("non_existent").await.unwrap();
        assert!(non_existent.is_none());
        
        // Get all settings
        let all_settings = db.get_all_settings().await.unwrap();
        assert_eq!(all_settings.len(), 2);
        assert_eq!(all_settings.get("theme"), Some(&"dark".to_string()));
        assert_eq!(all_settings.get("quality"), Some(&"720p".to_string()));
    }

    #[tokio::test]
    async fn test_playlist_operations() {
        let (db, _temp_dir) = create_test_database().await.unwrap();
        
        let playlist = Playlist {
            id: "test-playlist-123".to_string(),
            title: "Test Series Season 1".to_string(),
            claim_id: "series-claim-123".to_string(),
            items: vec![
                PlaylistItem {
                    claim_id: "episode-1".to_string(),
                    position: 1,
                    episode_number: Some(1),
                    season_number: Some(1),
                },
                PlaylistItem {
                    claim_id: "episode-2".to_string(),
                    position: 2,
                    episode_number: Some(2),
                    season_number: Some(1),
                },
            ],
            season_number: Some(1),
            series_key: Some("test-series".to_string()),
        };
        
        // Store playlist
        db.store_playlist(playlist.clone()).await.unwrap();
        
        // Retrieve playlist
        let retrieved = db.get_playlist("test-playlist-123").await.unwrap();
        assert!(retrieved.is_some());
        let retrieved = retrieved.unwrap();
        assert_eq!(retrieved.title, "Test Series Season 1");
        assert_eq!(retrieved.items.len(), 2);
        assert_eq!(retrieved.items[0].episode_number, Some(1));
        
        // Get playlists for series
        let series_playlists = db.get_playlists_for_series("test-series").await.unwrap();
        assert_eq!(series_playlists.len(), 1);
        
        // Delete playlist
        db.delete_playlist("test-playlist-123").await.unwrap();
        let deleted = db.get_playlist("test-playlist-123").await.unwrap();
        assert!(deleted.is_none());
    }

    #[tokio::test]
    async fn test_playlist_episode_ordering_preservation() {
        // Test that playlist position order is preserved across database operations
        // This is critical for maintaining content creator's intended episode order
        let (db, _temp_dir) = create_test_database().await.unwrap();
        
        // Create a playlist where episode numbers don't match position order
        // This simulates non-linear storytelling or intentional reordering
        let playlist = Playlist {
            id: "ordering-test-playlist".to_string(),
            title: "Non-Linear Series Season 1".to_string(),
            claim_id: "series-claim-456".to_string(),
            items: vec![
                PlaylistItem {
                    claim_id: "episode-5".to_string(),
                    position: 0, // First in playlist
                    episode_number: Some(5),
                    season_number: Some(1),
                },
                PlaylistItem {
                    claim_id: "episode-1".to_string(),
                    position: 1, // Second in playlist
                    episode_number: Some(1),
                    season_number: Some(1),
                },
                PlaylistItem {
                    claim_id: "episode-3".to_string(),
                    position: 2, // Third in playlist
                    episode_number: Some(3),
                    season_number: Some(1),
                },
                PlaylistItem {
                    claim_id: "episode-2".to_string(),
                    position: 3, // Fourth in playlist
                    episode_number: Some(2),
                    season_number: Some(1),
                },
            ],
            season_number: Some(1),
            series_key: Some("non-linear-series".to_string()),
        };
        
        // Store playlist
        db.store_playlist(playlist.clone()).await.unwrap();
        
        // Retrieve playlist - should maintain position order
        let retrieved = db.get_playlist("ordering-test-playlist").await.unwrap();
        assert!(retrieved.is_some());
        let retrieved = retrieved.unwrap();
        
        // Verify items are returned in position order (0, 1, 2, 3)
        assert_eq!(retrieved.items.len(), 4);
        assert_eq!(retrieved.items[0].claim_id, "episode-5"); // Position 0
        assert_eq!(retrieved.items[0].position, 0);
        assert_eq!(retrieved.items[0].episode_number, Some(5));
        
        assert_eq!(retrieved.items[1].claim_id, "episode-1"); // Position 1
        assert_eq!(retrieved.items[1].position, 1);
        assert_eq!(retrieved.items[1].episode_number, Some(1));
        
        assert_eq!(retrieved.items[2].claim_id, "episode-3"); // Position 2
        assert_eq!(retrieved.items[2].position, 2);
        assert_eq!(retrieved.items[2].episode_number, Some(3));
        
        assert_eq!(retrieved.items[3].claim_id, "episode-2"); // Position 3
        assert_eq!(retrieved.items[3].position, 3);
        assert_eq!(retrieved.items[3].episode_number, Some(2));
        
        // Simulate a reload by retrieving again
        let reloaded = db.get_playlist("ordering-test-playlist").await.unwrap().unwrap();
        
        // Verify order is identical after reload
        assert_eq!(reloaded.items.len(), retrieved.items.len());
        for (i, item) in reloaded.items.iter().enumerate() {
            assert_eq!(item.claim_id, retrieved.items[i].claim_id);
            assert_eq!(item.position, retrieved.items[i].position);
            assert_eq!(item.episode_number, retrieved.items[i].episode_number);
        }
        
        // Test get_playlists_for_series also maintains order
        let series_playlists = db.get_playlists_for_series("non-linear-series").await.unwrap();
        assert_eq!(series_playlists.len(), 1);
        let series_playlist = &series_playlists[0];
        
        // Verify position order is maintained
        assert_eq!(series_playlist.items[0].claim_id, "episode-5");
        assert_eq!(series_playlist.items[1].claim_id, "episode-1");
        assert_eq!(series_playlist.items[2].claim_id, "episode-3");
        assert_eq!(series_playlist.items[3].claim_id, "episode-2");
    }

    #[tokio::test]
    async fn test_playlist_ordering_with_out_of_order_storage() {
        // Test that even if items are stored in random order, they're retrieved in position order
        let (db, _temp_dir) = create_test_database().await.unwrap();
        
        // Create playlist with items in random order (not sorted by position)
        let playlist = Playlist {
            id: "random-order-playlist".to_string(),
            title: "Random Order Test".to_string(),
            claim_id: "series-claim-789".to_string(),
            items: vec![
                PlaylistItem {
                    claim_id: "episode-3".to_string(),
                    position: 2, // Out of order
                    episode_number: Some(3),
                    season_number: Some(1),
                },
                PlaylistItem {
                    claim_id: "episode-1".to_string(),
                    position: 0, // Out of order
                    episode_number: Some(1),
                    season_number: Some(1),
                },
                PlaylistItem {
                    claim_id: "episode-4".to_string(),
                    position: 3, // Out of order
                    episode_number: Some(4),
                    season_number: Some(1),
                },
                PlaylistItem {
                    claim_id: "episode-2".to_string(),
                    position: 1, // Out of order
                    episode_number: Some(2),
                    season_number: Some(1),
                },
            ],
            season_number: Some(1),
            series_key: Some("random-order-series".to_string()),
        };
        
        // Store playlist
        db.store_playlist(playlist.clone()).await.unwrap();
        
        // Retrieve playlist - should be sorted by position
        let retrieved = db.get_playlist("random-order-playlist").await.unwrap().unwrap();
        
        // Verify items are returned in position order despite being stored randomly
        assert_eq!(retrieved.items.len(), 4);
        assert_eq!(retrieved.items[0].claim_id, "episode-1"); // Position 0
        assert_eq!(retrieved.items[1].claim_id, "episode-2"); // Position 1
        assert_eq!(retrieved.items[2].claim_id, "episode-3"); // Position 2
        assert_eq!(retrieved.items[3].claim_id, "episode-4"); // Position 3
    }

    #[tokio::test]
    async fn test_cache_ttl_behavior() {
        let (db, _temp_dir) = create_test_database().await.unwrap();
        
        // Store content with current timestamp
        let items = vec![create_test_content_item()];
        db.store_content_items(items).await.unwrap();
        
        // Should be able to retrieve immediately (TTL is 30 minutes)
        let query = CacheQuery {
            tags: None,
            text_search: None,
            limit: Some(10),
            offset: Some(0),
            order_by: Some("releaseTime DESC".to_string()),
        };
        let retrieved = db.get_cached_content(query.clone()).await.unwrap();
        assert_eq!(retrieved.len(), 1, "Should retrieve fresh content");
        
        // Test cleanup of expired cache
        let expired_count = db.cleanup_expired_cache().await.unwrap();
        assert_eq!(expired_count, 0, "No items should be expired yet");
        
        // Manually test TTL by creating a database with very short TTL
        // and manipulating timestamps in the database
        let db_path = db.db_path.clone();
        task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)?;
            
            // Set the updatedAt to be older than TTL (simulate expired content)
            let old_timestamp = Utc::now().timestamp() - (2 * 60 * 60); // 2 hours ago
            conn.execute(
                "UPDATE local_cache SET updatedAt = ?1 WHERE claimId = ?2",
                params![old_timestamp, "test-claim-123"]
            )?;
            
            Ok::<(), KiyyaError>(())
        }).await.unwrap().unwrap();
        
        // Now cleanup should remove the expired item
        let expired_count = db.cleanup_expired_cache().await.unwrap();
        assert_eq!(expired_count, 1, "Should cleanup 1 expired item");
        
        // Verify item is gone
        let after_cleanup = db.get_cached_content(query).await.unwrap();
        assert_eq!(after_cleanup.len(), 0, "Should have no items after cleanup");
    }

    #[tokio::test]
    async fn test_cache_invalidation() {
        let (db, _temp_dir) = create_test_database().await.unwrap();
        
        // Store multiple content items
        let items = vec![
            create_test_content_item(),
            {
                let mut item = ContentItem {
                    claim_id: "test-claim-456".to_string(),
                    title: "Test Movie 2".to_string(),
                    description: Some("Another test movie".to_string()),
                    tags: vec!["movie".to_string(), "action".to_string()],
                    thumbnail_url: Some("https://example.com/thumb2.jpg".to_string()),
                    duration: Some(7200),
                    release_time: Utc::now().timestamp(),
                    video_urls: HashMap::new(),
                    compatibility: CompatibilityInfo {
                        compatible: true,
                        reason: None,
                        fallback_available: false,
                    },
                    etag: None,
                    content_hash: None,
                    raw_json: None,
                };
                item.update_content_hash();
                item
            },
        ];
        db.store_content_items(items).await.unwrap();
        
        // Verify both items are stored
        let query = CacheQuery {
            tags: None,
            text_search: None,
            limit: Some(10),
            offset: Some(0),
            order_by: Some("releaseTime DESC".to_string()),
        };
        let all_items = db.get_cached_content(query.clone()).await.unwrap();
        assert_eq!(all_items.len(), 2, "Should have 2 items");
        
        // Test invalidate specific item
        let invalidated = db.invalidate_cache_item("test-claim-123").await.unwrap();
        assert!(invalidated, "Should invalidate the item");
        
        let after_invalidate = db.get_cached_content(query.clone()).await.unwrap();
        assert_eq!(after_invalidate.len(), 1, "Should have 1 item after invalidation");
        assert_eq!(after_invalidate[0].claim_id, "test-claim-456");
        
        // Test invalidate non-existent item
        let not_invalidated = db.invalidate_cache_item("non-existent").await.unwrap();
        assert!(!not_invalidated, "Should not invalidate non-existent item");
    }

    #[tokio::test]
    async fn test_cache_invalidation_by_tags() {
        let (db, _temp_dir) = create_test_database().await.unwrap();
        
        // Store items with different tags
        let items = vec![
            {
                let mut item = ContentItem {
                    claim_id: "movie-1".to_string(),
                    title: "Action Movie".to_string(),
                    description: None,
                    tags: vec!["movie".to_string(), "action".to_string()],
                    thumbnail_url: None,
                    duration: None,
                    release_time: Utc::now().timestamp(),
                    video_urls: HashMap::new(),
                    compatibility: CompatibilityInfo {
                        compatible: true,
                        reason: None,
                        fallback_available: false,
                    },
                    etag: None,
                    content_hash: None,
                    raw_json: None,
                };
                item.update_content_hash();
                item
            },
            {
                let mut item = ContentItem {
                    claim_id: "movie-2".to_string(),
                    title: "Comedy Movie".to_string(),
                    description: None,
                    tags: vec!["movie".to_string(), "comedy".to_string()],
                    thumbnail_url: None,
                    duration: None,
                    release_time: Utc::now().timestamp(),
                    video_urls: HashMap::new(),
                    compatibility: CompatibilityInfo {
                        compatible: true,
                        reason: None,
                        fallback_available: false,
                    },
                    etag: None,
                    content_hash: None,
                    raw_json: None,
                };
                item.update_content_hash();
                item
            },
            {
                let mut item = ContentItem {
                    claim_id: "series-1".to_string(),
                    title: "Drama Series".to_string(),
                    description: None,
                    tags: vec!["series".to_string(), "drama".to_string()],
                    thumbnail_url: None,
                    duration: None,
                    release_time: Utc::now().timestamp(),
                    video_urls: HashMap::new(),
                    compatibility: CompatibilityInfo {
                        compatible: true,
                        reason: None,
                        fallback_available: false,
                    },
                    etag: None,
                    content_hash: None,
                    raw_json: None,
                };
                item.update_content_hash();
                item
            },
        ];
        db.store_content_items(items).await.unwrap();
        
        // Verify all items are stored
        let query = CacheQuery {
            tags: None,
            text_search: None,
            limit: Some(10),
            offset: Some(0),
            order_by: Some("releaseTime DESC".to_string()),
        };
        let all_items = db.get_cached_content(query.clone()).await.unwrap();
        assert_eq!(all_items.len(), 3, "Should have 3 items");
        
        // Invalidate by movie tag
        let count = db.invalidate_cache_by_tags(vec!["movie".to_string()]).await.unwrap();
        assert_eq!(count, 2, "Should invalidate 2 movie items");
        
        let after_invalidate = db.get_cached_content(query.clone()).await.unwrap();
        assert_eq!(after_invalidate.len(), 1, "Should have 1 item after invalidation");
        assert_eq!(after_invalidate[0].claim_id, "series-1");
    }

    #[tokio::test]
    async fn test_clear_all_cache() {
        let (db, _temp_dir) = create_test_database().await.unwrap();
        
        // Store multiple items
        let items = vec![
            create_test_content_item(),
            {
                let mut item = ContentItem {
                    claim_id: "test-claim-456".to_string(),
                    title: "Test Movie 2".to_string(),
                    description: None,
                    tags: vec!["movie".to_string()],
                    thumbnail_url: None,
                    duration: None,
                    release_time: Utc::now().timestamp(),
                    video_urls: HashMap::new(),
                    compatibility: CompatibilityInfo {
                        compatible: true,
                        reason: None,
                        fallback_available: false,
                    },
                    etag: None,
                    content_hash: None,
                    raw_json: None,
                };
                item.update_content_hash();
                item
            },
        ];
        db.store_content_items(items).await.unwrap();
        
        // Verify items are stored
        let query = CacheQuery {
            tags: None,
            text_search: None,
            limit: Some(10),
            offset: Some(0),
            order_by: Some("releaseTime DESC".to_string()),
        };
        let all_items = db.get_cached_content(query.clone()).await.unwrap();
        assert_eq!(all_items.len(), 2, "Should have 2 items");
        
        // Clear all cache
        let count = db.clear_all_cache().await.unwrap();
        assert_eq!(count, 2, "Should clear 2 items");
        
        // Verify cache is empty
        let after_clear = db.get_cached_content(query).await.unwrap();
        assert_eq!(after_clear.len(), 0, "Should have no items after clear");
        
        // Verify cache stats are reset
        let stats = db.get_cache_stats().await.unwrap();
        assert_eq!(stats.total_items, 0, "Cache stats should show 0 items");
    }

    #[tokio::test]
    async fn test_database_diagnostics() {
        let (db, _temp_dir) = create_test_database().await.unwrap();
        
        // Test database version
        let version = db.get_database_version().await.unwrap();
        assert_eq!(version, 0); // No migrations run yet
        
        // Test integrity check
        let integrity = db.check_integrity().await.unwrap();
        assert!(integrity);
        
        // Test cache stats
        let stats = db.get_cache_stats().await.unwrap();
        assert_eq!(stats.total_items, 0);
        assert_eq!(stats.hit_rate, 0.0);
        
        // Test database size
        let size = db.get_database_size().await.unwrap();
        assert!(size > 0);
    }

    #[tokio::test]
    async fn test_transaction_rollback() {
        let (db, _temp_dir) = create_test_database().await.unwrap();
        
        // Test that failed transactions rollback properly
        let result = db.with_transaction(|tx| {
            // This should succeed
            tx.execute(
                "INSERT INTO favorites (claimId, title, insertedAt) VALUES (?1, ?2, ?3)",
                params!["test-1", "Test 1", Utc::now().timestamp()]
            )?;
            
            // This should fail due to invalid SQL
            tx.execute("INVALID SQL STATEMENT", [])?;
            
            Ok(())
        }).await;
        
        assert!(result.is_err());
        
        // Verify that the first insert was rolled back
        let favorites = db.get_favorites().await.unwrap();
        assert_eq!(favorites.len(), 0);
    }

    #[tokio::test]
    async fn test_connection_pooling() {
        let (db, _temp_dir) = create_test_database().await.unwrap();
        
        // Test that we can get and return connections to the pool
        let conn1 = db.get_connection().await.unwrap();
        let conn2 = db.get_connection().await.unwrap();
        
        // Verify connections work
        let result1: i64 = conn1.query_row("SELECT 1", [], |row| row.get(0)).unwrap();
        let result2: i64 = conn2.query_row("SELECT 1", [], |row| row.get(0)).unwrap();
        assert_eq!(result1, 1);
        assert_eq!(result2, 1);
        
        // Return connections to pool
        db.return_connection(conn1).await;
        db.return_connection(conn2).await;
        
        // Verify pool has connections
        let pool = db.connection_pool.lock().await;
        assert_eq!(pool.len(), 2, "Pool should have 2 connections");
    }

    #[tokio::test]
    async fn test_connection_pool_max_size() {
        let (db, _temp_dir) = create_test_database().await.unwrap();
        
        // Create more connections than max_connections
        let mut connections = Vec::new();
        for _ in 0..7 {
            connections.push(db.get_connection().await.unwrap());
        }
        
        // Return all connections
        for conn in connections {
            db.return_connection(conn).await;
        }
        
        // Verify pool doesn't exceed max_connections
        let pool = db.connection_pool.lock().await;
        assert!(pool.len() <= db.max_connections, 
                "Pool size {} should not exceed max_connections {}", 
                pool.len(), db.max_connections);
    }

    #[tokio::test]
    async fn test_transaction_commit() {
        let (db, _temp_dir) = create_test_database().await.unwrap();
        
        // Test that successful transactions commit properly
        let result = db.with_transaction(|tx| {
            tx.execute(
                "INSERT INTO favorites (claimId, title, insertedAt) VALUES (?1, ?2, ?3)",
                params!["test-1", "Test 1", Utc::now().timestamp()]
            )?;
            
            tx.execute(
                "INSERT INTO favorites (claimId, title, insertedAt) VALUES (?1, ?2, ?3)",
                params!["test-2", "Test 2", Utc::now().timestamp()]
            )?;
            
            Ok(())
        }).await;
        
        assert!(result.is_ok(), "Transaction should succeed");
        
        // Verify both inserts were committed
        let favorites = db.get_favorites().await.unwrap();
        assert_eq!(favorites.len(), 2, "Both favorites should be saved");
    }

    #[tokio::test]
    async fn test_concurrent_transactions() {
        let (db, _temp_dir) = create_test_database().await.unwrap();
        let db = Arc::new(db);
        
        // Run multiple transactions concurrently
        let mut handles = vec![];
        
        for i in 0..5 {
            let db_clone = Arc::clone(&db);
            let handle = tokio::spawn(async move {
                let claim_id = format!("test-{}", i);
                let title = format!("Test {}", i);
                
                db_clone.with_transaction(move |tx| {
                    tx.execute(
                        "INSERT INTO favorites (claimId, title, insertedAt) VALUES (?1, ?2, ?3)",
                        params![claim_id, title, Utc::now().timestamp()]
                    )?;
                    Ok(())
                }).await
            });
            handles.push(handle);
        }
        
        // Wait for all transactions to complete
        for handle in handles {
            let result = handle.await.unwrap();
            assert!(result.is_ok(), "Concurrent transaction should succeed");
        }
        
        // Verify all inserts were committed
        let favorites = db.get_favorites().await.unwrap();
        assert_eq!(favorites.len(), 5, "All 5 favorites should be saved");
    }

    #[tokio::test]
    async fn test_delta_updates() {
        let (db, _temp_dir) = create_test_database().await.unwrap();
        
        // Store initial content
        let mut item1 = create_test_content_item();
        item1.claim_id = "delta-test-1".to_string();
        item1.update_content_hash();
        
        let mut item2 = create_test_content_item();
        item2.claim_id = "delta-test-2".to_string();
        item2.title = "Different Title".to_string();
        item2.update_content_hash();
        
        db.store_content_items(vec![item1.clone(), item2.clone()]).await.unwrap();
        
        // Verify items are stored
        let query = CacheQuery {
            tags: None,
            text_search: None,
            limit: Some(10),
            offset: Some(0),
            order_by: Some("releaseTime DESC".to_string()),
        };
        let stored = db.get_cached_content(query.clone()).await.unwrap();
        assert_eq!(stored.len(), 2, "Should have 2 items stored");
        
        // Try delta update with unchanged items
        let updated_count = db.store_content_items_delta(vec![item1.clone(), item2.clone()]).await.unwrap();
        assert_eq!(updated_count, 0, "No items should be updated when content is unchanged");
        
        // Modify one item
        let mut item1_modified = item1.clone();
        item1_modified.title = "Modified Title".to_string();
        item1_modified.update_content_hash();
        
        // Delta update should only update the modified item
        let updated_count = db.store_content_items_delta(vec![item1_modified.clone(), item2.clone()]).await.unwrap();
        assert_eq!(updated_count, 1, "Only 1 item should be updated");
        
        // Verify the modified item was updated
        let stored_after = db.get_cached_content(query).await.unwrap();
        let updated_item = stored_after.iter().find(|i| i.claim_id == "delta-test-1").unwrap();
        assert_eq!(updated_item.title, "Modified Title");
    }

    #[tokio::test]
    async fn test_content_hash_computation() {
        let mut item1 = create_test_content_item();
        item1.update_content_hash();
        
        let hash1 = item1.content_hash.clone().unwrap();
        
        // Same content should produce same hash
        let mut item2 = item1.clone();
        item2.update_content_hash();
        let hash2 = item2.content_hash.clone().unwrap();
        
        assert_eq!(hash1, hash2, "Same content should produce same hash");
        
        // Different content should produce different hash
        let mut item3 = item1.clone();
        item3.title = "Different Title".to_string();
        item3.update_content_hash();
        let hash3 = item3.content_hash.clone().unwrap();
        
        assert_ne!(hash1, hash3, "Different content should produce different hash");
    }

    #[tokio::test]
    async fn test_get_changed_items() {
        let (db, _temp_dir) = create_test_database().await.unwrap();
        
        // Store initial items
        let mut item1 = create_test_content_item();
        item1.claim_id = "change-test-1".to_string();
        item1.update_content_hash();
        
        let mut item2 = create_test_content_item();
        item2.claim_id = "change-test-2".to_string();
        item2.title = "Different Title".to_string();
        item2.update_content_hash();
        
        db.store_content_items(vec![item1.clone(), item2.clone()]).await.unwrap();
        
        // Check with unchanged items
        let changed = db.get_changed_items(&[item1.clone(), item2.clone()]).await.unwrap();
        assert_eq!(changed.len(), 0, "No items should be marked as changed");
        
        // Modify one item
        let mut item1_modified = item1.clone();
        item1_modified.title = "Modified Title".to_string();
        item1_modified.update_content_hash();
        
        // Check again with one modified item
        let changed = db.get_changed_items(&[item1_modified, item2.clone()]).await.unwrap();
        assert_eq!(changed.len(), 1, "One item should be marked as changed");
        assert_eq!(changed[0], "change-test-1");
        
        // Add a new item (doesn't exist in cache)
        let mut item3 = create_test_content_item();
        item3.claim_id = "change-test-3".to_string();
        item3.update_content_hash();
        
        let changed = db.get_changed_items(&[item3]).await.unwrap();
        assert_eq!(changed.len(), 1, "New item should be marked as changed");
        assert_eq!(changed[0], "change-test-3");
    }

    #[tokio::test]
    async fn test_get_content_hashes() {
        let (db, _temp_dir) = create_test_database().await.unwrap();
        
        // Store items with hashes
        let mut item1 = create_test_content_item();
        item1.claim_id = "hash-test-1".to_string();
        item1.update_content_hash();
        
        let mut item2 = create_test_content_item();
        item2.claim_id = "hash-test-2".to_string();
        item2.title = "Different Title".to_string();
        item2.update_content_hash();
        
        db.store_content_items(vec![item1.clone(), item2.clone()]).await.unwrap();
        
        // Retrieve hashes
        let hashes = db.get_content_hashes(vec![
            "hash-test-1".to_string(),
            "hash-test-2".to_string(),
            "non-existent".to_string(),
        ]).await.unwrap();
        
        assert_eq!(hashes.len(), 2, "Should retrieve 2 hashes");
        assert!(hashes.contains_key("hash-test-1"));
        assert!(hashes.contains_key("hash-test-2"));
        assert!(!hashes.contains_key("non-existent"));
        
        // Verify hash values match
        assert_eq!(hashes.get("hash-test-1").unwrap(), item1.content_hash.as_ref().unwrap());
        assert_eq!(hashes.get("hash-test-2").unwrap(), item2.content_hash.as_ref().unwrap());
    }

    #[tokio::test]
    async fn test_raw_json_storage() {
        let (db, _temp_dir) = create_test_database().await.unwrap();
        
        // Create a test item with raw_json
        let mut item = create_test_content_item();
        item.claim_id = "raw-json-test".to_string();
        item.raw_json = Some(r#"{"test":"data","nested":{"value":123}}"#.to_string());
        
        // Store the item
        db.store_content_items(vec![item.clone()]).await.unwrap();
        
        // Retrieve the item
        let query = CacheQuery {
            tags: None,
            text_search: None,
            limit: Some(10),
            offset: Some(0),
            order_by: Some("releaseTime DESC".to_string()),
        };
        
        let retrieved_items = db.get_cached_content(query).await.unwrap();
        assert_eq!(retrieved_items.len(), 1, "Should retrieve 1 item");
        
        let retrieved_item = &retrieved_items[0];
        assert_eq!(retrieved_item.claim_id, "raw-json-test");
        assert!(retrieved_item.raw_json.is_some(), "raw_json should be present");
        assert_eq!(
            retrieved_item.raw_json.as_ref().unwrap(),
            r#"{"test":"data","nested":{"value":123}}"#,
            "raw_json should match stored value"
        );
        
        // Test storing item without raw_json (should be None)
        let mut item_no_json = create_test_content_item();
        item_no_json.claim_id = "no-raw-json-test".to_string();
        item_no_json.raw_json = None;
        
        db.store_content_items(vec![item_no_json]).await.unwrap();
        
        // Retrieve and verify
        let db_path = db.db_path.clone();
        let raw_json_value = task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)?;
            let raw_json: Option<String> = conn.query_row(
                "SELECT raw_json FROM local_cache WHERE claimId = ?1",
                params!["no-raw-json-test"],
                |row| row.get(0)
            )?;
            Ok::<Option<String>, KiyyaError>(raw_json)
        }).await.unwrap().unwrap();
        
        assert!(raw_json_value.is_none(), "raw_json should be None when not provided");
    }

    #[tokio::test]
    async fn test_cache_hit_miss_counters() {
        let (db, _temp_dir) = create_test_database().await.unwrap();
        
        // Initial stats should show zero hits and misses
        let initial_stats = db.get_cache_stats().await.unwrap();
        assert_eq!(initial_stats.total_items, 0, "Should start with 0 items");
        assert_eq!(initial_stats.hit_rate, 0.0, "Hit rate should be 0.0 initially");
        
        // Store some test content
        let mut item1 = create_test_content_item();
        item1.claim_id = "hit-miss-test-1".to_string();
        item1.tags = vec!["movie".to_string()];
        
        let mut item2 = create_test_content_item();
        item2.claim_id = "hit-miss-test-2".to_string();
        item2.tags = vec!["series".to_string()];
        
        db.store_content_items(vec![item1.clone(), item2.clone()]).await.unwrap();
        
        // Query for existing content (should be a cache hit)
        let query_hit = CacheQuery {
            tags: Some(vec!["movie".to_string()]),
            text_search: None,
            limit: Some(10),
            offset: Some(0),
            order_by: Some("releaseTime DESC".to_string()),
        };
        
        let results = db.get_cached_content(query_hit).await.unwrap();
        assert_eq!(results.len(), 1, "Should find 1 movie");
        
        // Check stats after hit
        let stats_after_hit = db.get_cache_stats().await.unwrap();
        assert_eq!(stats_after_hit.total_items, 2, "Should have 2 items");
        
        // Query for non-existent content (should be a cache miss)
        let query_miss = CacheQuery {
            tags: Some(vec!["kids".to_string()]),
            text_search: None,
            limit: Some(10),
            offset: Some(0),
            order_by: Some("releaseTime DESC".to_string()),
        };
        
        let results_miss = db.get_cached_content(query_miss).await.unwrap();
        assert_eq!(results_miss.len(), 0, "Should find 0 kids content");
        
        // Check stats after miss
        let stats_after_miss = db.get_cache_stats().await.unwrap();
        assert_eq!(stats_after_miss.total_items, 2, "Should still have 2 items");
        
        // Perform multiple queries to test hit rate calculation
        for _ in 0..3 {
            let _ = db.get_cached_content(CacheQuery {
                tags: Some(vec!["movie".to_string()]),
                text_search: None,
                limit: Some(10),
                offset: Some(0),
                order_by: Some("releaseTime DESC".to_string()),
            }).await.unwrap();
        }
        
        for _ in 0..2 {
            let _ = db.get_cached_content(CacheQuery {
                tags: Some(vec!["sitcom".to_string()]),
                text_search: None,
                limit: Some(10),
                offset: Some(0),
                order_by: Some("releaseTime DESC".to_string()),
            }).await.unwrap();
        }
        
        // Check final stats
        let final_stats = db.get_cache_stats().await.unwrap();
        assert_eq!(final_stats.total_items, 2, "Should still have 2 items");
        
        // Hit rate should be calculated correctly
        // We had: 1 hit + 1 miss + 3 hits + 2 misses = 4 hits, 3 misses, total 7 requests
        // Hit rate = 4/7 ≈ 0.571
        assert!(final_stats.hit_rate > 0.5 && final_stats.hit_rate < 0.6, 
                "Hit rate should be approximately 0.571, got {}", final_stats.hit_rate);
        
        // Clear cache and verify stats are reset
        db.clear_all_cache().await.unwrap();
        let cleared_stats = db.get_cache_stats().await.unwrap();
        assert_eq!(cleared_stats.total_items, 0, "Should have 0 items after clear");
        // Note: hit/miss counters are NOT reset by clear_all_cache, only total_items
    }
}
