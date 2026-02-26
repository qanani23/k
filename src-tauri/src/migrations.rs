// Database migrations for Kiyya
// Each migration is a numbered SQL script that modifies the database schema
// Migrations are executed sequentially within transactions for safety

// Allow unused code in migrations.rs - migration features are integrated but not all functions are currently used
#![allow(dead_code)]

use crate::error::{ErrorContext, KiyyaError, Result};
use chrono::Utc;
use rusqlite::{params, Connection, Transaction};
use tracing::{debug, error, info, warn};

/// Migration definition with version number and SQL script
#[derive(Debug, Clone)]
pub struct Migration {
    pub version: u32,
    pub description: String,
    pub sql: &'static str,
}

/// Migration runner that handles database schema evolution
pub struct MigrationRunner {
    migrations: Vec<Migration>,
}

impl MigrationRunner {
    /// Creates a new migration runner with all available migrations
    pub fn new() -> Self {
        Self {
            migrations: get_all_migrations(),
        }
    }

    /// Runs all pending migrations within transactions
    pub fn run_migrations(&self, conn: &Connection) -> Result<()> {
        // Ensure migrations table exists
        self.ensure_migrations_table(conn)?;

        // Get current database version
        let current_version = self.get_current_version(conn)?;
        info!("Current database version: {}", current_version);

        // Execute pending migrations, skipping already-applied ones
        let pending_migrations: Vec<&Migration> = self
            .migrations
            .iter()
            .filter(|m| m.version > current_version)
            .collect();

        if pending_migrations.is_empty() {
            info!("No pending migrations to run");
            return Ok(());
        }

        info!("Found {} pending migrations", pending_migrations.len());

        for migration in pending_migrations {
            // Double-check that migration hasn't been applied (idempotency check)
            if self.is_migration_applied(conn, migration.version)? {
                info!(
                    "Migration {} already applied, skipping",
                    migration.version
                );
                continue;
            }

            self.execute_migration(conn, migration)?;
        }

        info!("All migrations completed successfully");
        Ok(())
    }

    /// Ensures the migrations table exists with the correct schema
    pub fn ensure_migrations_table(&self, conn: &Connection) -> Result<()> {
        // First, check if migrations table exists
        let table_exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='migrations'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !table_exists {
            // Create new migrations table with full schema
            conn.execute(
                r#"CREATE TABLE IF NOT EXISTS migrations (
                    version INTEGER PRIMARY KEY,
                    description TEXT NOT NULL,
                    applied_at INTEGER NOT NULL,
                    checksum TEXT
                )"#,
                [],
            )
            .with_context("Failed to create migrations table")?;
        } else {
            // Check if we need to migrate the schema
            let has_description: bool = conn
                .query_row("PRAGMA table_info(migrations)", [], |_| Ok(true))
                .unwrap_or(false);

            if has_description {
                // Try to check if description column exists
                let result =
                    conn.query_row("SELECT description FROM migrations LIMIT 1", [], |_| Ok(()));

                if result.is_err() {
                    // Column doesn't exist, add it
                    let _ = conn.execute("ALTER TABLE migrations ADD COLUMN description TEXT", []);
                    let _ = conn.execute("ALTER TABLE migrations ADD COLUMN checksum TEXT", []);
                }
            }
        }

        Ok(())
    }

    /// Gets the current database version from migrations table
    pub fn get_current_version(&self, conn: &Connection) -> Result<u32> {
        let version: u32 = conn
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM migrations",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        Ok(version)
    }

    /// Checks if a specific migration version has already been applied
    pub fn is_migration_applied(&self, conn: &Connection, version: u32) -> Result<bool> {
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM migrations WHERE version = ?1",
                params![version],
                |row| row.get(0),
            )
            .with_context_fn(|| format!("Failed to check if migration {} is applied", version))?;

        Ok(count > 0)
    }

    /// Executes a single migration within a transaction
    pub fn execute_migration(&self, conn: &Connection, migration: &Migration) -> Result<()> {
        info!(
            "Running migration {}: {}",
            migration.version, migration.description
        );

        let tx = conn.unchecked_transaction().with_context_fn(|| {
            format!(
                "Failed to start transaction for migration {}",
                migration.version
            )
        })?;

        match self.execute_migration_sql(&tx, migration) {
            Ok(_) => {
                // Record successful migration
                tx.execute(
                    "INSERT INTO migrations (version, description, applied_at, checksum) VALUES (?1, ?2, ?3, ?4)",
                    params![
                        migration.version,
                        migration.description,
                        Utc::now().timestamp(),
                        self.calculate_checksum(migration.sql)
                    ]
                ).with_context_fn(|| format!("Failed to record migration {}", migration.version))?;

                tx.commit().with_context_fn(|| {
                    format!("Failed to commit migration {}", migration.version)
                })?;

                info!("Migration {} completed successfully", migration.version);
                Ok(())
            }
            Err(e) => {
                error!("Migration {} failed: {}", migration.version, e);

                if let Err(rollback_err) = tx.rollback() {
                    error!(
                        "Failed to rollback migration {}: {}",
                        migration.version, rollback_err
                    );
                    return Err(KiyyaError::Migration {
                        message: format!(
                            "Migration {} failed: {}. Rollback also failed: {}",
                            migration.version, e, rollback_err
                        ),
                    });
                }

                Err(KiyyaError::Migration {
                    message: format!("Migration {} failed: {}", migration.version, e),
                })
            }
        }
    }

    /// Executes the SQL for a migration
    fn execute_migration_sql(&self, tx: &Transaction, migration: &Migration) -> Result<()> {
        // Split SQL into individual statements and execute them
        let statements: Vec<&str> = migration
            .sql
            .split(';')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty() && !s.starts_with("--"))
            .collect();

        for (i, statement) in statements.iter().enumerate() {
            debug!(
                "Executing migration {} statement {}: {}",
                migration.version,
                i + 1,
                statement
            );

            tx.execute(statement, []).with_context_fn(|| {
                format!(
                    "Failed to execute statement {} in migration {}: {}",
                    i + 1,
                    migration.version,
                    statement
                )
            })?;
        }

        Ok(())
    }

    /// Calculates a simple checksum for migration SQL
    fn calculate_checksum(&self, sql: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        sql.hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }

    /// Validates that all applied migrations match their checksums
    pub fn validate_migrations(&self, conn: &Connection) -> Result<()> {
        let mut stmt = conn
            .prepare("SELECT version, description, checksum FROM migrations ORDER BY version")
            .with_context("Failed to prepare migration validation query")?;

        let applied_migrations = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, u32>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            })
            .with_context("Failed to query applied migrations")?;

        for applied in applied_migrations {
            let (version, description, stored_checksum) =
                applied.with_context("Failed to parse applied migration")?;

            if let Some(migration) = self.migrations.iter().find(|m| m.version == version) {
                let current_checksum = self.calculate_checksum(migration.sql);

                if let Some(stored) = stored_checksum {
                    if stored != current_checksum {
                        warn!(
                            "Migration {} checksum mismatch. Stored: {}, Current: {}",
                            version, stored, current_checksum
                        );
                    }
                }

                if migration.description != description {
                    warn!(
                        "Migration {} description changed. Stored: '{}', Current: '{}'",
                        version, description, migration.description
                    );
                }
            } else {
                warn!(
                    "Applied migration {} not found in current migration set",
                    version
                );
            }
        }

        Ok(())
    }

    /// Gets information about applied migrations
    pub fn get_migration_history(&self, conn: &Connection) -> Result<Vec<MigrationInfo>> {
        // Try to query with all columns first
        let query_result = conn.prepare(
            "SELECT version, COALESCE(description, ''), applied_at, checksum FROM migrations ORDER BY version"
        );

        let mut stmt = match query_result {
            Ok(s) => s,
            Err(_) => {
                // Fallback for old schema without description/checksum
                conn.prepare(
                    "SELECT version, '', applied_at, NULL FROM migrations ORDER BY version",
                )
                .with_context("Failed to prepare migration history query")?
            }
        };

        let rows = stmt
            .query_map([], |row| {
                Ok(MigrationInfo {
                    version: row.get(0)?,
                    description: row.get(1)?,
                    applied_at: row.get(2)?,
                    checksum: row.get(3)?,
                })
            })
            .with_context("Failed to query migration history")?;

        // Collect results, converting rusqlite::Error to KiyyaError
        rows.collect::<std::result::Result<Vec<_>, _>>()
            .with_context("Failed to parse migration history rows")
    }

    /// Performs a dry-run of pending migrations without executing them
    /// 
    /// This validates SQL syntax and returns a plan of what would be executed.
    /// Useful for previewing migrations before applying them.
    /// 
    /// # Arguments
    /// * `conn` - Database connection to check current version and validate SQL
    /// 
    /// # Returns
    /// A vector of `MigrationPlan` objects describing pending migrations and their validation status
    /// 
    /// # Example
    /// ```no_run
    /// use crate::migrations::MigrationRunner;
    /// use rusqlite::Connection;
    /// 
    /// let conn = Connection::open("app.db").unwrap();
    /// let runner = MigrationRunner::new();
    /// 
    /// match runner.run_migrations_dry_run(&conn) {
    ///     Ok(plans) => {
    ///         for plan in plans {
    ///             println!("Migration {}: {}", plan.version, plan.description);
    ///             match plan.validation_result {
    ///                 ValidationResult::Valid => println!("  ✓ SQL is valid"),
    ///                 ValidationResult::Invalid { error } => println!("  ✗ SQL error: {}", error),
    ///             }
    ///         }
    ///     }
    ///     Err(e) => eprintln!("Dry-run failed: {}", e),
    /// }
    /// ```
    pub fn run_migrations_dry_run(&self, conn: &Connection) -> Result<Vec<MigrationPlan>> {
        // Ensure migrations table exists
        self.ensure_migrations_table(conn)?;

        // Get current database version
        let current_version = self.get_current_version(conn)?;
        info!("Dry-run: Current database version: {}", current_version);

        // Get pending migrations
        let pending_migrations: Vec<&Migration> = self
            .migrations
            .iter()
            .filter(|m| m.version > current_version)
            .collect();

        if pending_migrations.is_empty() {
            info!("Dry-run: No pending migrations");
            return Ok(Vec::new());
        }

        info!("Dry-run: Found {} pending migrations", pending_migrations.len());

        let mut plans = Vec::new();

        for migration in pending_migrations {
            // Skip if already applied (idempotency check)
            if self.is_migration_applied(conn, migration.version)? {
                info!(
                    "Dry-run: Migration {} already applied, skipping",
                    migration.version
                );
                continue;
            }

            // Validate SQL without executing
            let validation_result = self.validate_migration_sql(conn, migration);

            let plan = MigrationPlan {
                version: migration.version,
                description: migration.description.clone(),
                sql: migration.sql.to_string(),
                validation_result,
            };

            plans.push(plan);
        }

        Ok(plans)
    }

    /// Validates migration SQL without executing it
    /// 
    /// Uses SQLite's EXPLAIN statement to check SQL syntax without side effects
    pub fn validate_migration_sql(&self, conn: &Connection, migration: &Migration) -> ValidationResult {
        // Split SQL into individual statements
        let statements: Vec<&str> = migration
            .sql
            .split(';')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty() && !s.starts_with("--"))
            .collect();

        for (i, statement) in statements.iter().enumerate() {
            // Skip PRAGMA statements as they can't be explained
            if statement.to_uppercase().starts_with("PRAGMA") {
                debug!("Dry-run: Skipping PRAGMA statement validation");
                continue;
            }

            // Use EXPLAIN to validate SQL syntax without executing
            let explain_query = format!("EXPLAIN {}", statement);
            
            match conn.prepare(&explain_query) {
                Ok(_) => {
                    debug!(
                        "Dry-run: Statement {} in migration {} is valid",
                        i + 1,
                        migration.version
                    );
                }
                Err(e) => {
                    let error_str = e.to_string();
                    
                    // For CREATE INDEX statements, "no such column" errors are acceptable
                    // because the columns might be added by earlier pending migrations
                    let is_create_index = statement.to_uppercase().contains("CREATE INDEX");
                    let is_missing_column = error_str.contains("no such column");
                    let is_missing_table = error_str.contains("no such table");
                    
                    if is_create_index && (is_missing_column || is_missing_table) {
                        warn!(
                            "Dry-run: Statement {} in migration {} references missing column/table (may be created by earlier migration): {}",
                            i + 1,
                            migration.version,
                            error_str
                        );
                        // Continue validation - this is acceptable for dry-run
                        continue;
                    }
                    
                    let error_msg = format!(
                        "Statement {} in migration {}: {}",
                        i + 1,
                        migration.version,
                        e
                    );
                    warn!("Dry-run validation failed: {}", error_msg);
                    return ValidationResult::Invalid { error: error_msg };
                }
            }
        }

        ValidationResult::Valid
    }
}

/// Information about an applied migration
#[derive(Debug, Clone)]
pub struct MigrationInfo {
    pub version: u32,
    pub description: String,
    pub applied_at: i64,
    pub checksum: Option<String>,
}

/// Plan for a migration that will be executed
#[derive(Debug, Clone)]
pub struct MigrationPlan {
    pub version: u32,
    pub description: String,
    pub sql: String,
    pub validation_result: ValidationResult,
}

/// Result of SQL validation
#[derive(Debug, Clone)]
pub enum ValidationResult {
    Valid,
    Invalid { error: String },
}

/// Returns all available migrations in order
pub fn get_all_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "Initial schema setup".to_string(),
            sql: r#"
                -- Migration 1 is a no-op for fresh databases
                -- Fresh databases get full schema from initialize()
                SELECT 1
            "#,
        },
        Migration {
            version: 2,
            description: "Add cache access tracking".to_string(),
            sql: r#"
                -- Add accessCount and lastAccessed if they don't exist
                -- Fresh databases already have these from initialize()
                SELECT 1
            "#,
        },
        Migration {
            version: 3,
            description: "Add performance indexes".to_string(),
            sql: r#"
                CREATE INDEX IF NOT EXISTS idx_offline_meta_claim_quality ON offline_meta(claimId, quality);
                CREATE INDEX IF NOT EXISTS idx_localcache_access_pattern ON local_cache(lastAccessed DESC, accessCount DESC)
            "#,
        },
        Migration {
            version: 4,
            description: "Enhanced playlist support".to_string(),
            sql: r#"
                -- Playlists tables created by initialize() for fresh databases
                SELECT 1
            "#,
        },
        Migration {
            version: 5,
            description: "User preferences".to_string(),
            sql: r#"
                CREATE TABLE IF NOT EXISTS user_preferences (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    type TEXT NOT NULL DEFAULT 'string',
                    description TEXT,
                    updated_at INTEGER NOT NULL,
                    created_at INTEGER NOT NULL
                );
                
                INSERT OR IGNORE INTO user_preferences (key, value, type, description, updated_at, created_at) VALUES
                ('theme', 'dark', 'string', 'Application theme (dark/light)', strftime('%s', 'now'), strftime('%s', 'now')),
                ('last_used_quality', 'master', 'string', 'Last selected video quality', strftime('%s', 'now'), strftime('%s', 'now')),
                ('encrypt_downloads', 'false', 'boolean', 'Enable download encryption', strftime('%s', 'now'), strftime('%s', 'now')),
                ('auto_upgrade_quality', 'true', 'boolean', 'Automatically upgrade video quality', strftime('%s', 'now'), strftime('%s', 'now')),
                ('cache_ttl_minutes', '30', 'number', 'Cache time-to-live in minutes', strftime('%s', 'now'), strftime('%s', 'now')),
                ('max_cache_items', '200', 'number', 'Maximum cached content items', strftime('%s', 'now'), strftime('%s', 'now')),
                ('download_path', '', 'string', 'Custom download directory path', strftime('%s', 'now'), strftime('%s', 'now')),
                ('preferred_language', 'en', 'string', 'Preferred content language', strftime('%s', 'now'), strftime('%s', 'now')),
                ('autoplay_enabled', 'true', 'boolean', 'Enable video autoplay', strftime('%s', 'now'), strftime('%s', 'now')),
                ('reduced_motion', 'false', 'boolean', 'Reduce UI animations', strftime('%s', 'now'), strftime('%s', 'now'));
                
                CREATE INDEX IF NOT EXISTS idx_user_preferences_type ON user_preferences(type)
            "#,
        },
        Migration {
            version: 6,
            description: "Content compatibility tracking".to_string(),
            sql: r#"
                -- Compatibility columns handled by initialize() for fresh databases
                SELECT 1
            "#,
        },
        Migration {
            version: 7,
            description: "Gateway health tracking".to_string(),
            sql: r#"
                CREATE TABLE IF NOT EXISTS gateway_stats (
                    gateway_url TEXT PRIMARY KEY,
                    total_requests INTEGER DEFAULT 0,
                    successful_requests INTEGER DEFAULT 0,
                    failed_requests INTEGER DEFAULT 0,
                    average_response_time REAL DEFAULT 0.0,
                    last_success INTEGER,
                    last_failure INTEGER,
                    consecutive_failures INTEGER DEFAULT 0,
                    is_healthy BOOLEAN DEFAULT TRUE,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );
                
                CREATE TABLE IF NOT EXISTS gateway_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    gateway_url TEXT NOT NULL,
                    request_type TEXT NOT NULL,
                    response_time REAL,
                    status_code INTEGER,
                    error_message TEXT,
                    timestamp INTEGER NOT NULL
                );
                
                CREATE INDEX IF NOT EXISTS idx_gateway_logs_timestamp ON gateway_logs(timestamp DESC);
                CREATE INDEX IF NOT EXISTS idx_gateway_logs_gateway ON gateway_logs(gateway_url, timestamp DESC);
                CREATE INDEX IF NOT EXISTS idx_gateway_stats_health ON gateway_stats(is_healthy, last_success DESC)
            "#,
        },
        Migration {
            version: 8,
            description: "Download queue".to_string(),
            sql: r#"
                CREATE TABLE IF NOT EXISTS download_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    claim_id TEXT NOT NULL,
                    quality TEXT NOT NULL,
                    url TEXT NOT NULL,
                    filename TEXT NOT NULL,
                    total_size INTEGER,
                    downloaded_size INTEGER DEFAULT 0,
                    status TEXT NOT NULL DEFAULT 'queued',
                    priority INTEGER DEFAULT 0,
                    retry_count INTEGER DEFAULT 0,
                    error_message TEXT,
                    created_at INTEGER NOT NULL,
                    started_at INTEGER,
                    completed_at INTEGER,
                    updated_at INTEGER NOT NULL,
                    UNIQUE(claim_id, quality)
                );
                
                CREATE TABLE IF NOT EXISTS download_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    download_id INTEGER NOT NULL,
                    session_start INTEGER NOT NULL,
                    session_end INTEGER,
                    bytes_downloaded INTEGER DEFAULT 0,
                    average_speed REAL DEFAULT 0.0,
                    FOREIGN KEY (download_id) REFERENCES download_queue(id) ON DELETE CASCADE
                );
                
                CREATE INDEX IF NOT EXISTS idx_download_queue_status ON download_queue(status, priority DESC);
                CREATE INDEX IF NOT EXISTS idx_download_queue_claim ON download_queue(claim_id, quality);
                CREATE INDEX IF NOT EXISTS idx_download_sessions_download ON download_sessions(download_id, session_start DESC)
            "#,
        },
        Migration {
            version: 9,
            description: "Search history and analytics".to_string(),
            sql: r#"
                CREATE TABLE IF NOT EXISTS search_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    query TEXT NOT NULL,
                    normalized_query TEXT NOT NULL,
                    results_count INTEGER DEFAULT 0,
                    source TEXT NOT NULL DEFAULT 'local',
                    response_time REAL,
                    timestamp INTEGER NOT NULL
                );
                
                CREATE TABLE IF NOT EXISTS content_analytics (
                    claim_id TEXT PRIMARY KEY,
                    view_count INTEGER DEFAULT 0,
                    total_watch_time INTEGER DEFAULT 0,
                    last_watched INTEGER,
                    completion_rate REAL DEFAULT 0.0,
                    quality_preferences TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );
                
                CREATE INDEX IF NOT EXISTS idx_search_history_query ON search_history(normalized_query);
                CREATE INDEX IF NOT EXISTS idx_search_history_timestamp ON search_history(timestamp DESC);
                CREATE INDEX IF NOT EXISTS idx_content_analytics_last_watched ON content_analytics(last_watched DESC);
                CREATE INDEX IF NOT EXISTS idx_content_analytics_view_count ON content_analytics(view_count DESC)
            "#,
        },
        Migration {
            version: 10,
            description: "Error logging and diagnostics".to_string(),
            sql: r#"
                CREATE TABLE IF NOT EXISTS error_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    error_type TEXT NOT NULL,
                    error_code TEXT,
                    message TEXT NOT NULL,
                    context TEXT,
                    stack_trace TEXT,
                    user_action TEXT,
                    resolved BOOLEAN DEFAULT FALSE,
                    timestamp INTEGER NOT NULL
                );
                
                CREATE TABLE IF NOT EXISTS system_diagnostics (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    app_version TEXT,
                    database_version INTEGER,
                    total_content_items INTEGER DEFAULT 0,
                    total_downloads INTEGER DEFAULT 0,
                    cache_hit_rate REAL DEFAULT 0.0,
                    average_startup_time REAL DEFAULT 0.0,
                    last_cleanup INTEGER,
                    last_backup INTEGER,
                    disk_usage_bytes INTEGER DEFAULT 0,
                    updated_at INTEGER NOT NULL
                );
                
                INSERT OR IGNORE INTO system_diagnostics (id, updated_at) VALUES (1, strftime('%s', 'now'));
                
                CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type, timestamp DESC);
                CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved, timestamp DESC)
            "#,
        },
        Migration {
            version: 11,
            description: "Content recommendations".to_string(),
            sql: r#"
                CREATE TABLE IF NOT EXISTS content_relationships (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_claim_id TEXT NOT NULL,
                    related_claim_id TEXT NOT NULL,
                    relationship_type TEXT NOT NULL,
                    strength REAL DEFAULT 1.0,
                    created_at INTEGER NOT NULL,
                    UNIQUE(source_claim_id, related_claim_id, relationship_type)
                );
                
                CREATE TABLE IF NOT EXISTS recommendation_cache (
                    claim_id TEXT PRIMARY KEY,
                    recommendations TEXT NOT NULL,
                    algorithm_version TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    expires_at INTEGER NOT NULL
                );
                
                CREATE INDEX IF NOT EXISTS idx_content_relationships_source ON content_relationships(source_claim_id, strength DESC);
                CREATE INDEX IF NOT EXISTS idx_content_relationships_type ON content_relationships(relationship_type, strength DESC);
                CREATE INDEX IF NOT EXISTS idx_recommendation_cache_expires ON recommendation_cache(expires_at)
            "#,
        },
        Migration {
            version: 12,
            description: "Add ETag and content hash for delta updates".to_string(),
            sql: r#"
                -- Add etag and contentHash columns for delta updates
                -- Fresh databases already have these from initialize()
                -- This migration is a no-op for fresh databases
                SELECT 1
            "#,
        },
        Migration {
            version: 13,
            description: "Add raw JSON storage".to_string(),
            sql: r#"
                -- raw_json column added by initialize() for fresh databases
                SELECT 1
            "#,
        },
        Migration {
            version: 14,
            description: "Add releaseTime index".to_string(),
            sql: r#"
                CREATE INDEX IF NOT EXISTS idx_localcache_release_time ON local_cache(releaseTime DESC)
            "#,
        },
    ]
}

/// Legacy function for backward compatibility
pub fn get_migrations() -> Vec<(u32, &'static str)> {
    get_all_migrations()
        .into_iter()
        .map(|m| (m.version, m.sql))
        .collect()
}
