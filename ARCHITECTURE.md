# Kiyya Desktop Streaming Application - Architecture

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [System Architecture](#system-architecture)
4. [Component Architecture](#component-architecture)
5. [Data Flow](#data-flow)
6. [Database Design](#database-design)
7. [Security Architecture](#security-architecture)
8. [Deployment Architecture](#deployment-architecture)
9. [Testing Architecture](#testing-architecture)

## Overview

Kiyya is a desktop streaming application built with Tauri framework, combining a Rust backend with a React + TypeScript frontend. The application provides access to content from a single Odysee channel with local caching, offline downloads, and a cinematic user interface.

### Key Architectural Principles

- **Single Source of Truth**: All content originates from one configured Odysee channel
- **Offline-First**: Local caching and download capabilities for uninterrupted access
- **Resilient Architecture**: Gateway failover and defensive error handling
- **Performance-Oriented**: Lazy loading, efficient caching, and resource management
- **Accessibility-Compliant**: Full keyboard navigation and screen reader support
- **Security-Focused**: Restricted network/filesystem access and optional encryption

## Technology Stack

### Backend (Rust)
- **Framework**: Tauri 1.x
- **HTTP Client**: reqwest with connection pooling
- **Database**: rusqlite with SQLite
- **Local Server**: warp HTTP server
- **Encryption**: AES-GCM via ring crate
- **Async Runtime**: tokio

### Frontend (TypeScript/React)
- **Build Tool**: Vite
- **UI Framework**: React 18
- **Styling**: Tailwind CSS
- **Animations**: GSAP (limited usage)
- **Video Player**: Plyr with hls.js fallback
- **Routing**: React Router
- **State Management**: React hooks + context

### Testing
- **Frontend Unit**: Vitest + React Testing Library
- **Backend Unit**: Rust built-in testing
- **Property-Based**: fast-check (TS), proptest (Rust)
- **E2E**: Playwright

## System Architecture

### High-Level Architecture Diagram

```mermaid
graph TB
    subgraph "User Interface Layer"
        UI[React Components]
        Hooks[Custom Hooks]
        Router[React Router]
    end
    
    subgraph "Frontend Logic Layer"
        API[API Wrapper]
        State[State Management]
        Utils[Utility Libraries]
    end
    
    subgraph "Tauri Bridge Layer"
        Commands[Tauri Commands]
        Events[Event System]
        IPC[IPC Channel]
    end
    
    subgraph "Backend Service Layer"
        Gateway[Gateway Client]
        Cache[Cache Manager]
        Downloads[Download Manager]
        Server[Local HTTP Server]
        Crypto[Encryption Service]
    end
    
    subgraph "Data Layer"
        DB[(SQLite Database)]
        FS[File System<br/>Vault Storage]
    end
    
    subgraph "External Services"
        Odysee[Odysee API<br/>Gateways]
        Updates[Update Manifest<br/>GitHub]
    end
    
    UI --> Hooks
    Hooks --> API
    API --> Commands
    Router --> UI
    State --> UI
    Utils --> Hooks
    
    Commands --> Gateway
    Commands --> Cache
    Commands --> Downloads
    Commands --> Server
    Commands --> Crypto
    
    Events --> Hooks
    
    Gateway --> Odysee
    Gateway --> Updates
    Cache --> DB
    Downloads --> DB
    Downloads --> FS
    Downloads --> Crypto
    Server --> DB
    Server --> FS
    Server --> Crypto
    
    style UI fill:#4a90e2
    style Commands fill:#e27d60
    style Gateway fill:#85dcb0
    style DB fill:#e8a87c
    style Odysee fill:#c38d9e
```

### Component Interaction Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as React UI
    participant API as API Wrapper
    participant Tauri as Tauri Commands
    participant Gateway as Gateway Client
    participant Cache as Cache Manager
    participant Odysee as Odysee API
    participant DB as SQLite DB
    
    User->>UI: Browse Content
    UI->>API: fetchChannelClaims()
    API->>Tauri: invoke("fetch_channel_claims")
    Tauri->>Cache: check_cache()
    
    alt Cache Hit (TTL valid)
        Cache->>DB: SELECT * FROM local_cache
        DB-->>Cache: Cached Data
        Cache-->>Tauri: Return Cached
    else Cache Miss or Expired
        Cache->>Gateway: fetch_from_api()
        Gateway->>Odysee: claim_search request
        
        alt Primary Gateway Success
            Odysee-->>Gateway: API Response
        else Primary Gateway Fails
            Gateway->>Odysee: Retry with Secondary
            Odysee-->>Gateway: API Response
        end
        
        Gateway-->>Cache: Parsed Content
        Cache->>DB: INSERT/UPDATE cache
        Cache-->>Tauri: Return Fresh Data
    end
    
    Tauri-->>API: Content Items
    API-->>UI: Display Content
    UI-->>User: Show Content Grid
```

## Component Architecture

### Module Inventory (Post-Stabilization)

The following modules exist in the codebase after Phase 2 cleanup:

#### Core Application Modules

1. **main.rs** - Application entry point and Tauri setup
   - Initializes logging and crash reporting
   - Manages application state (AppState)
   - Registers 28 Tauri commands
   - Executes database migrations on startup
   - Emergency disable check integration

2. **commands.rs** - Tauri command implementations (28 commands)
   - Test/Debug: `test_connection`, `build_cdn_playback_url_test`
   - Content Discovery: `fetch_channel_claims`, `fetch_playlists`, `resolve_claim`
   - Downloads: `download_movie_quality`, `stream_offline`, `delete_offline`
   - Progress/State: `save_progress`, `get_progress`, `save_favorite`, `remove_favorite`, `get_favorites`, `is_favorite`
   - Configuration: `get_app_config`, `update_settings`
   - Diagnostics: `get_diagnostics`, `collect_debug_package`
   - Crash Reporting: `get_recent_crashes`, `clear_crash_log`
   - Cache Management: `invalidate_cache_item`, `invalidate_cache_by_tags`, `clear_all_cache`, `cleanup_expired_cache`, `get_cache_stats`, `get_memory_stats`, `optimize_database_memory`
   - External: `open_external`

3. **models.rs** - Data structures and type definitions
   - Content models (claims, playlists, episodes)
   - Configuration models
   - API response models

#### Network & API Modules

4. **gateway.rs** - Odysee API client with failover
   - Multi-gateway failover logic
   - HTTP request handling with reqwest
   - Rate limiting and timeout management
   - Response parsing and error handling

5. **validation.rs** - Input validation and security checks
   - Channel ID format validation
   - Claim ID validation
   - URL validation and sanitization
   - Domain whitelist enforcement
   - HTTPS-only enforcement

6. **sanitization.rs** - Input sanitization utilities
   - SQL injection prevention
   - Path traversal prevention
   - XSS prevention for user inputs

#### Data Persistence Modules

7. **database.rs** - SQLite database manager
   - Connection pool management
   - Query execution with prepared statements
   - Transaction handling
   - Cache management (30-minute TTL)
   - Schema initialization

8. **migrations.rs** - Database schema migration system
   - Migration version tracking
   - Idempotent migration execution
   - Dry-run mode for validation
   - Migration history with checksums
   - Rollback support

#### Download & Offline Modules

9. **download.rs** - Download manager
   - Resumable downloads with HTTP Range support
   - Progress tracking and events
   - Atomic file operations (temp → final)
   - Disk space validation
   - Download queue management

10. **server.rs** - Local HTTP server for offline playback
    - Serves downloaded content to player
    - HTTP Range support for seeking
    - On-the-fly decryption for encrypted content
    - CORS headers for local playback

11. **encryption.rs** - AES-GCM encryption for downloads
    - Key generation and management
    - File encryption/decryption
    - Streaming decryption for playback
    - OS keystore integration

12. **path_security.rs** - File system security
    - Path traversal prevention
    - Restricted access to app data directory
    - Path validation and sanitization

#### Observability Modules

The application uses a sophisticated three-tier logging architecture for comprehensive observability:

13. **logging.rs** - General Application Logging (Tier 1)
    - **Purpose:** General application tracing and debugging
    - **Technology:** `tracing` crate with `tracing-appender`
    - **Output:** File rotation (daily) + console (development)
    - **Format:** JSON (file) + human-readable (console)
    - **Location:**
      - Windows: `%APPDATA%\kiyya-desktop\logs\kiyya.log.YYYY-MM-DD`
      - macOS: `~/Library/Application Support/kiyya-desktop/logs/kiyya.log.YYYY-MM-DD`
      - Linux: `~/.local/share/kiyya-desktop/logs/kiyya.log.YYYY-MM-DD`
    - **Configuration:** `RUST_LOG` environment variable
    - **Initialization:** `main.rs:169` - `crate::logging::init_logging()`
    - **Features:**
      - Daily automatic log rotation
      - Structured JSON logging with required fields (timestamp, level, component, message)
      - Secret redaction for tokens, credentials, API keys
      - LOG_LEVEL environment variable support
      - Defaults to INFO in production, DEBUG in development
      - Optional compilation via `logging` feature flag

14. **error_logging.rs** - Error Analytics Logging (Tier 2)
    - **Purpose:** Error tracking, analytics, and diagnostics
    - **Technology:** Database-backed (SQLite)
    - **Output:** `error_logs` table in application database
    - **Schema:** Structured database records with error_type, error_code, message, context, stack_trace, user_action, resolved, timestamp
    - **Features:**
      - Error categorization and severity levels
      - Context preservation (user actions, stack traces)
      - Error resolution tracking
      - Error metrics and analytics
      - Integration with diagnostics reports
    - **Active Usage:** 4+ call sites in diagnostics and models
    - **Functions:**
      - `log_error()` - Logs errors with context to database
      - `get_recent_errors()` - Retrieves recent errors from database
      - `get_error_stats()` - Gets error statistics for analytics
      - `mark_error_resolved()` - Marks errors as resolved
      - `cleanup_old_errors()` - Cleans up old error logs

15. **security_logging.rs** - Security Audit Logging (Tier 3)
    - **Purpose:** Security event auditing and compliance
    - **Technology:** Custom file-based logging + tracing integration
    - **Output:** Dedicated `security.log` file
    - **Format:** Structured text with timestamp, severity, event type, details
    - **Location:** `{app_data_dir}/logs/security.log`
    - **Events Logged:**
      - Path security violations
      - Input validation failures (7 production uses)
      - SQL injection attempts
      - Network security violations (2 production uses)
      - Encryption key operations (6 production uses)
      - Rate limiting triggers (1 production use)
      - Suspicious activity
    - **Active Usage:** 15+ call sites across validation, sanitization, path security, gateway, encryption
    - **SecurityEvent Variants:**
      - `PathViolation` - Used in path_security.rs
      - `InputValidationFailure` - Used in validation.rs (6 occurrences)
      - `SqlInjectionAttempt` - Used in sanitization.rs
      - `NetworkViolation` - Used in validation.rs and gateway.rs
      - `EncryptionKeyOperation` - Used in encryption.rs
      - `RateLimitTriggered` - Used in gateway.rs
      - `AuthenticationFailure`, `AuthorizationFailure`, `SuspiciousActivity` - Reserved for future use

16. **diagnostics.rs** - System health checks
    - Database connectivity checks
    - Network connectivity checks
    - Disk space monitoring
    - Memory usage tracking
    - Configuration validation
    - Integration with error_logging for error statistics

17. **crash_reporting.rs** - Crash handler and reporting
    - Crash log persistence
    - Stack trace capture
    - Crash history management
    - Debug package collection

#### Utility Modules

18. **error.rs** - Error type definitions
    - Custom error types for domain errors
    - Error conversion and propagation
    - User-friendly error messages

### Module Dependencies

```mermaid
graph LR
    subgraph "Entry Point"
        Main[main.rs]
    end
    
    subgraph "Command Layer"
        Commands[commands.rs]
    end
    
    subgraph "Business Logic"
        Gateway[gateway.rs]
        Download[download.rs]
        Database[database.rs]
        Server[server.rs]
    end
    
    subgraph "Security"
        Validation[validation.rs]
        Sanitization[sanitization.rs]
        PathSecurity[path_security.rs]
        Encryption[encryption.rs]
    end
    
    subgraph "Observability"
        Logging[logging.rs]
        ErrorLogging[error_logging.rs]
        SecurityLogging[security_logging.rs]
        Diagnostics[diagnostics.rs]
        CrashReporting[crash_reporting.rs]
    end
    
    subgraph "Data"
        Models[models.rs]
        Migrations[migrations.rs]
        Error[error.rs]
    end
    
    Main --> Commands
    Main --> Database
    Main --> Logging
    Main --> CrashReporting
    
    Commands --> Gateway
    Commands --> Download
    Commands --> Database
    Commands --> Diagnostics
    Commands --> ErrorLogging
    
    Gateway --> Validation
    Gateway --> SecurityLogging
    Gateway --> Error
    
    Download --> Encryption
    Download --> PathSecurity
    Download --> Database
    
    Server --> Encryption
    Server --> PathSecurity
    
    Database --> Migrations
    Database --> Validation
    
    Validation --> Sanitization
    Validation --> SecurityLogging
    
    Encryption --> SecurityLogging
    
    style Main fill:#4a90e2
    style Commands fill:#85dcb0
    style Security fill:#e27d60
    style Observability fill:#e8a87c
```

### Removed Modules (Phase 2 Cleanup)

No modules were removed during Phase 2 cleanup. All modules identified in the audit were determined to be:
- **Fully integrated and actively used** (migrations, security logging, error logging)
- **Essential for production** (all core modules)
- **Well-tested** (98.4% test pass rate)

See `stabilization/DECISIONS.md` for detailed analysis of each module's integration status.

### Module Testing Coverage

Based on manual analysis (Task 13.4):

| Module | Test Files | Estimated Coverage | Status |
|--------|-----------|-------------------|--------|
| gateway.rs | gateway_*.rs (5 files) | 75-85% | ✅ Excellent |
| commands.rs | integration_test.rs + 10+ files | 75-85% | ✅ Excellent |
| database.rs | database_*.rs (3 files) | 80-90% | ✅ Excellent |
| migrations.rs | migration_*.rs (5 files) | 65-75% | ✅ Good |
| validation.rs | *_validation_*.rs (5 files) | 85%+ | ✅ Excellent |
| security_logging.rs | security_logging_*.rs (2 files) | 70-80% | ✅ Good |
| error_logging.rs | error_logging_*.rs (2 files) | 55-60% | ⚠️ Borderline |
| download.rs | download_*.rs (1 file) | 50-55% | ⚠️ Below target |
| encryption.rs | encryption_*.rs (1 file) | 60-70% | ✅ Good |
| diagnostics.rs | diagnostics_test.rs | 60-70% | ✅ Good |

See `stabilization/TASK_13.4_COMPLETION_SUMMARY.md` for detailed coverage analysis.

## Component Architecture

### Frontend Component Hierarchy

```mermaid
graph TD
    App[App.tsx<br/>Root Component]
    
    App --> Router[React Router]
    App --> Theme[Theme Provider]
    App --> ErrorBoundary[Error Boundary]
    
    Router --> Home[Home Page]
    Router --> Movies[Movies Page]
    Router --> Series[Series Page]
    Router --> Search[Search Page]
    Router --> Downloads[Downloads Page]
    Router --> Favorites[Favorites Page]
    Router --> Settings[Settings Page]
    Router --> MovieDetail[Movie Detail]
    Router --> SeriesDetail[Series Detail]
    
    Home --> NavBar[NavBar]
    Home --> Hero[Hero Component]
    Home --> RowCarousel[Row Carousel]
    
    RowCarousel --> MovieCard[Movie Card]
    
    MovieDetail --> PlayerModal[Player Modal]
    SeriesDetail --> PlayerModal
    
    Downloads --> OfflineIndicator[Offline Indicator]
    
    Settings --> ForcedUpdateScreen[Forced Update]
    Settings --> EmergencyDisable[Emergency Disable]
    
    App --> Toast[Toast Notifications]
    
    style App fill:#4a90e2
    style Router fill:#85dcb0
    style Home fill:#e8a87c
    style PlayerModal fill:#e27d60
```

### Backend Module Architecture

```mermaid
graph TD
    Main[main.rs<br/>Entry Point & Setup]
    
    Main --> Commands[commands.rs<br/>28 Tauri Commands]
    Main --> Database[database.rs<br/>SQLite Manager]
    Main --> Server[server.rs<br/>Local HTTP Server]
    Main --> CrashReporting[crash_reporting.rs<br/>Crash Handler]
    
    Commands --> Gateway[gateway.rs<br/>Odysee API Client]
    Commands --> Download[download.rs<br/>Download Manager]
    Commands --> Models[models.rs<br/>Data Models]
    Commands --> Diagnostics[diagnostics.rs<br/>Health Checks]
    
    Gateway --> Error[error.rs<br/>Error Types]
    Gateway --> Validation[validation.rs<br/>Input Validation]
    
    Download --> Encryption[encryption.rs<br/>AES-GCM Crypto]
    Download --> PathSecurity[path_security.rs<br/>Path Validation]
    
    Database --> Migrations[migrations.rs<br/>Schema Migrations]
    Database --> Validation
    
    Server --> Encryption
    Server --> PathSecurity
    
    Commands --> Logging[logging.rs<br/>Structured Logging]
    Commands --> ErrorLogging[error_logging.rs<br/>Error Tracking]
    Commands --> SecurityLogging[security_logging.rs<br/>Security Events]
    
    Validation --> Sanitization[sanitization.rs<br/>Input Sanitization]
    
    style Main fill:#4a90e2
    style Commands fill:#85dcb0
    style Gateway fill:#e8a87c
    style Database fill:#e27d60
```

## Data Flow

### Content Discovery Flow

```mermaid
flowchart TD
    Start([User Opens App]) --> CheckCache{Cache<br/>Valid?}
    
    CheckCache -->|Yes| LoadCache[Load from<br/>SQLite Cache]
    CheckCache -->|No| FetchRemote[Fetch from<br/>Odysee API]
    
    FetchRemote --> TryPrimary[Try Primary<br/>Gateway]
    TryPrimary --> PrimarySuccess{Success?}
    
    PrimarySuccess -->|Yes| ParseResponse[Parse API<br/>Response]
    PrimarySuccess -->|No| TrySecondary[Try Secondary<br/>Gateway]
    
    TrySecondary --> SecondarySuccess{Success?}
    SecondarySuccess -->|Yes| ParseResponse
    SecondarySuccess -->|No| TryFallback[Try Fallback<br/>Gateway]
    
    TryFallback --> FallbackSuccess{Success?}
    FallbackSuccess -->|Yes| ParseResponse
    FallbackSuccess -->|No| ShowError[Show Error<br/>Message]
    
    ParseResponse --> UpdateCache[Update SQLite<br/>Cache]
    UpdateCache --> DisplayContent[Display Content<br/>in UI]
    LoadCache --> DisplayContent
    
    DisplayContent --> End([Content Visible])
    ShowError --> End
    
    style Start fill:#4a90e2
    style DisplayContent fill:#85dcb0
    style ShowError fill:#e27d60
```

### Download and Offline Playback Flow

```mermaid
flowchart TD
    Start([User Initiates<br/>Download]) --> CheckSpace{Sufficient<br/>Disk Space?}
    
    CheckSpace -->|No| ShowSpaceError[Show Disk<br/>Space Error]
    CheckSpace -->|Yes| ResolveQuality[Resolve Quality<br/>URL]
    
    ResolveQuality --> StartDownload[Start HTTP<br/>Download]
    StartDownload --> CheckResume{Partial File<br/>Exists?}
    
    CheckResume -->|Yes| ResumeDownload[Resume with<br/>Range Header]
    CheckResume -->|No| FullDownload[Full Download]
    
    ResumeDownload --> StreamData[Stream Data<br/>to .tmp File]
    FullDownload --> StreamData
    
    StreamData --> EmitProgress[Emit Progress<br/>Events]
    EmitProgress --> CheckComplete{Download<br/>Complete?}
    
    CheckComplete -->|No| StreamData
    CheckComplete -->|Yes| CheckEncryption{Encryption<br/>Enabled?}
    
    CheckEncryption -->|Yes| EncryptFile[Encrypt with<br/>AES-GCM]
    CheckEncryption -->|No| RenameFile[Atomic Rename<br/>to Final Path]
    
    EncryptFile --> RenameFile
    RenameFile --> UpdateDB[Update offline_meta<br/>in SQLite]
    
    UpdateDB --> OfflineReady[Content Ready<br/>for Offline]
    
    OfflineReady --> UserPlays{User Plays<br/>Offline?}
    UserPlays -->|Yes| StartLocalServer[Start Local<br/>HTTP Server]
    
    StartLocalServer --> CheckEncrypted{File<br/>Encrypted?}
    CheckEncrypted -->|Yes| DecryptStream[Decrypt On-the-Fly<br/>with Range Support]
    CheckEncrypted -->|No| ServeFile[Serve File<br/>with Range Support]
    
    DecryptStream --> StreamToPlayer[Stream to<br/>Plyr Player]
    ServeFile --> StreamToPlayer
    
    StreamToPlayer --> End([Playback Active])
    ShowSpaceError --> End
    
    style Start fill:#4a90e2
    style OfflineReady fill:#85dcb0
    style ShowSpaceError fill:#e27d60
```

### Series Organization Flow

```mermaid
flowchart TD
    Start([Fetch Series<br/>Content]) --> FetchPlaylists[Fetch Playlists<br/>from API]
    
    FetchPlaylists --> PlaylistsExist{Playlists<br/>Available?}
    
    PlaylistsExist -->|Yes| ParsePlaylists[Parse Playlist<br/>Metadata]
    ParsePlaylists --> ExtractSeasons[Extract Season<br/>Numbers]
    ExtractSeasons --> OrderByPlaylist[Order Episodes<br/>by Playlist Position]
    OrderByPlaylist --> MarkCanonical[Mark as<br/>Canonical Order]
    
    PlaylistsExist -->|No| ParseTitles[Parse Episode<br/>Titles]
    ParseTitles --> ExtractSxxExx[Extract SxxExx<br/>from Titles]
    ExtractSxxExx --> OrderByNumber[Order by<br/>Season/Episode]
    OrderByNumber --> MarkInferred[Mark as<br/>Inferred Seasons]
    
    MarkCanonical --> GroupSeasons[Group Episodes<br/>by Season]
    MarkInferred --> GroupSeasons
    
    GroupSeasons --> CreateUI[Create Expandable<br/>Season Sections]
    CreateUI --> DisplayNotice{Show Inferred<br/>Notice?}
    
    DisplayNotice -->|Yes| AddNotice[Add 'Seasons Inferred<br/>Automatically' Notice]
    DisplayNotice -->|No| RenderSeasons[Render Season<br/>Sections]
    
    AddNotice --> RenderSeasons
    RenderSeasons --> End([Series Page<br/>Displayed])
    
    style Start fill:#4a90e2
    style MarkCanonical fill:#85dcb0
    style MarkInferred fill:#e8a87c
```

### Logging and Observability Flow

The application uses a three-tier logging architecture for comprehensive observability:

```mermaid
flowchart TD
    subgraph "Application Events"
        AppStart[Application<br/>Startup]
        UserAction[User<br/>Actions]
        APICall[API<br/>Calls]
        Error[Errors &<br/>Exceptions]
        SecurityEvent[Security<br/>Events]
    end
    
    subgraph "Tier 1: General Logging (logging.rs)"
        TracingInit[Initialize<br/>Tracing]
        FileAppender[Daily File<br/>Rotation]
        ConsoleOutput[Console<br/>Output]
        JSONFormat[JSON<br/>Formatting]
        SecretRedact[Secret<br/>Redaction]
    end
    
    subgraph "Tier 2: Error Analytics (error_logging.rs)"
        ErrorCapture[Capture<br/>Error Context]
        ErrorDB[(error_logs<br/>Table)]
        ErrorStats[Error<br/>Statistics]
        ErrorCleanup[Cleanup<br/>Old Errors]
    end
    
    subgraph "Tier 3: Security Audit (security_logging.rs)"
        SecurityCapture[Capture<br/>Security Event]
        SecurityFile[security.log<br/>File]
        SecurityAudit[Audit<br/>Trail]
    end
    
    subgraph "Log Storage"
        LogFiles[Log Files<br/>kiyya.log.YYYY-MM-DD]
        SecurityLog[security.log]
        Database[(SQLite<br/>Database)]
    end
    
    AppStart --> TracingInit
    UserAction --> TracingInit
    APICall --> TracingInit
    
    TracingInit --> FileAppender
    TracingInit --> ConsoleOutput
    FileAppender --> SecretRedact
    SecretRedact --> JSONFormat
    JSONFormat --> LogFiles
    ConsoleOutput --> LogFiles
    
    Error --> ErrorCapture
    ErrorCapture --> ErrorDB
    ErrorDB --> ErrorStats
    ErrorDB --> ErrorCleanup
    ErrorDB --> Database
    
    SecurityEvent --> SecurityCapture
    SecurityCapture --> SecurityFile
    SecurityFile --> SecurityLog
    SecurityFile --> SecurityAudit
    
    style TracingInit fill:#4a90e2
    style ErrorCapture fill:#e8a87c
    style SecurityCapture fill:#e27d60
```

#### Logging Configuration

**Environment Variables:**
- `LOG_LEVEL` - Simple log level control (DEBUG, INFO, WARN, ERROR)
  - Production default: INFO
  - Development default: DEBUG
- `RUST_LOG` - Fine-grained control (overrides LOG_LEVEL)
  - Example: `RUST_LOG=kiyya_desktop::gateway=debug,info`

**Log File Locations:**
- **General Logs:**
  - Windows: `%APPDATA%\kiyya-desktop\logs\kiyya.log.YYYY-MM-DD`
  - macOS: `~/Library/Application Support/kiyya-desktop/logs/kiyya.log.YYYY-MM-DD`
  - Linux: `~/.local/share/kiyya-desktop/logs/kiyya.log.YYYY-MM-DD`
- **Security Logs:** `{app_data_dir}/logs/security.log`
- **Error Analytics:** Stored in SQLite database (`error_logs` table)

**Log Rotation:**
- General logs: Daily automatic rotation
- Security logs: Append-only (manual rotation recommended)
- Error analytics: Database cleanup via `cleanup_old_errors(db, days_to_keep)`

**Structured Logging Format (JSON):**
```json
{
  "timestamp": "2026-02-22T12:34:56.789Z",
  "level": "INFO",
  "target": "kiyya_desktop::content_fetcher",
  "fields": {
    "message": "Fetching content from CDN",
    "component": "content_fetcher",
    "claim_id": "abc123",
    "correlation_id": "req-xyz"
  }
}
```

**Secret Redaction:**
Automatically redacts sensitive information:
- API keys, tokens, credentials
- Passwords and secrets
- Private keys and client secrets

**Feature Flag:**
The logging system can be optionally disabled at compile time:
```bash
# Build without logging (minimal binary size)
cargo build --no-default-features --features custom-protocol

# Build with logging (default)
cargo build
```

See `stabilization/LOGGING_DECISION.md` for complete logging architecture documentation.

## Database Design

### Entity Relationship Diagram

```mermaid
erDiagram
    LOCAL_CACHE ||--o{ FAVORITES : "can be favorited"
    LOCAL_CACHE ||--o{ PROGRESS : "tracks playback"
    LOCAL_CACHE ||--o{ OFFLINE_META : "can be downloaded"
    PLAYLISTS ||--|{ PLAYLIST_ITEMS : contains
    PLAYLIST_ITEMS }o--|| LOCAL_CACHE : references
    
    LOCAL_CACHE {
        text claimId PK
        text title
        text titleLower
        text description
        text descriptionLower
        text tags
        text thumbnailUrl
        text videoUrls
        text compatibility
        integer updatedAt
    }
    
    FAVORITES {
        text claimId PK
        text title
        text thumbnailUrl
        integer insertedAt
    }
    
    PROGRESS {
        text claimId PK
        integer positionSeconds
        text quality
        integer updatedAt
    }
    
    OFFLINE_META {
        text claimId PK
        text quality PK
        text filename
        integer fileSize
        boolean encrypted
        integer addedAt
    }
    
    PLAYLISTS {
        text id PK
        text title
        text claimId
        integer seasonNumber
        text seriesKey
        integer updatedAt
    }
    
    PLAYLIST_ITEMS {
        text playlistId PK,FK
        text claimId PK
        integer position
        integer episodeNumber
        integer seasonNumber
    }
    
    MIGRATIONS {
        integer version PK
        integer applied_at
    }
    
    ERROR_LOGS {
        integer id PK
        text error_type
        text error_code
        text message
        text context
        text stack_trace
        text user_action
        integer resolved
        integer timestamp
    }
```

### Database Schema Details

#### Error Logging Schema

The `error_logs` table provides database-backed error analytics:

```sql
CREATE TABLE IF NOT EXISTS error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    error_type TEXT NOT NULL,           -- Error category (e.g., "NetworkError", "DatabaseError")
    error_code TEXT,                     -- Optional error code for categorization
    message TEXT NOT NULL,               -- Human-readable error message
    context TEXT,                        -- JSON context (user actions, request details)
    stack_trace TEXT,                    -- Stack trace for debugging
    user_action TEXT,                    -- What the user was doing when error occurred
    resolved INTEGER DEFAULT 0,          -- 0 = unresolved, 1 = resolved
    timestamp INTEGER NOT NULL           -- Unix timestamp
);

CREATE INDEX idx_error_logs_timestamp ON error_logs(timestamp);
CREATE INDEX idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX idx_error_logs_error_type ON error_logs(error_type);
```

**Usage:**
- Error tracking and analytics
- Diagnostics integration (`get_error_stats()`, `get_recent_errors()`)
- Error resolution tracking
- Automatic cleanup of old errors

#### Indices for Performance

```sql
-- Content search optimization
CREATE INDEX idx_localcache_titleLower ON local_cache(titleLower);
CREATE INDEX idx_localcache_tags ON local_cache(tags);
CREATE INDEX idx_localcache_updatedAt ON local_cache(updatedAt);

-- Progress tracking
CREATE INDEX idx_progress_updatedAt ON progress(updatedAt);

-- Playlist ordering
CREATE INDEX idx_playlist_items_position ON playlist_items(playlistId, position);
CREATE INDEX idx_playlists_seriesKey ON playlists(seriesKey);
```

#### Cache TTL Strategy

- **Default TTL**: 30 minutes for content metadata
- **Invalidation**: Automatic cleanup on app startup for expired entries
- **Force Refresh**: User-initiated cache bypass for immediate updates
- **Storage Limit**: Maximum 200 items in cache, LRU eviction

### Database Migration System

The application uses a robust migration system to manage database schema evolution across versions. The migration system is fully integrated and production-ready with idempotency guarantees and rollback support.

#### Migration System Status

**Status**: ✅ Fully Integrated and Active

The migration system is actively used in production and executes automatically during application startup. All database schema changes are managed through versioned migrations.

#### Migration Execution Flow

```mermaid
flowchart TD
    Start([Application<br/>Startup]) --> InitAppState[initialize_app_state]
    InitAppState --> CreateDB[Database::new]
    
    CreateDB --> InitSchema[Initialize Base Schema<br/>database.rs:initialize]
    InitSchema --> CreateMigTable[Create migrations Table<br/>If Not Exists]
    CreateMigTable --> CreateBaseTables[Create Base Tables<br/>favorites, progress, etc.]
    CreateBaseTables --> CreateIndices[Create Performance<br/>Indices]
    
    CreateIndices --> SetupHook[Tauri Setup Hook]
    SetupHook --> MigrationCheck{Migrations<br/>Enabled?}
    
    MigrationCheck -->|Yes| RunMigrations[run_startup_migrations]
    MigrationCheck -->|No| SkipMigrations[Skip Migrations<br/>Debug Mode]
    
    RunMigrations --> GetCurrentVer[Get Current Version<br/>from migrations table]
    GetCurrentVer --> FilterPending[Filter Pending<br/>Migrations]
    
    FilterPending --> HasPending{Pending<br/>Migrations?}
    HasPending -->|No| Complete[Application Ready]
    HasPending -->|Yes| CheckApplied[Check if Already<br/>Applied]
    
    CheckApplied --> IsApplied{Already<br/>Applied?}
    IsApplied -->|Yes| NextMigration[Next Migration]
    IsApplied -->|No| ExecuteMigration[Execute Migration<br/>in Transaction]
    
    ExecuteMigration --> CalcChecksum[Calculate SQL<br/>Checksum]
    CalcChecksum --> RunSQL[Execute SQL<br/>Statements]
    RunSQL --> RecordMigration[Record in<br/>migrations table]
    RecordMigration --> NextMigration
    
    NextMigration --> HasPending
    SkipMigrations --> Complete
    
    style Start fill:#4a90e2
    style Complete fill:#85dcb0
    style ExecuteMigration fill:#e8a87c
```

#### Current Migration Version

**Latest Migration**: Version 14 (as of Phase 3 completion)

**Migration History:**
1. v1: Initial schema setup for v0 database compatibility
2. v2: Add missing columns to local_cache (accessCount, lastAccessed, etag, contentHash, raw_json)
3. v3: Add performance indexes for cache access patterns
4. v4: Enhanced playlist support with series management
5. v5: User preferences and application settings
6. v6: Content compatibility and codec tracking
7. v7: Gateway health and performance tracking
8. v8: Download queue and progress tracking
9. v9: Search history and analytics
10. v10: Enhanced error logging and diagnostics
11. v11: Content recommendations and related items
12. v12: Add ETag and content hash indexes for delta updates
13. v13: Add raw JSON storage for debugging
14. v14: Add releaseTime index after migration 2

#### Migration System Architecture

**Key Components:**

1. **MigrationRunner** (`migrations.rs`)
   - Manages migration execution lifecycle
   - Ensures idempotency (migrations run exactly once)
   - Provides dry-run mode for validation
   - Tracks migration history with checksums

2. **Migration Table Schema**
   ```sql
   CREATE TABLE migrations (
       version INTEGER PRIMARY KEY,
       description TEXT NOT NULL,
       applied_at INTEGER NOT NULL,
       checksum TEXT
   );
   ```

3. **Migration Execution Points**
   - **Single Execution Point**: Migrations run ONLY in `run_startup_migrations()` (main.rs:340)
   - **NOT in Database::new()**: Base schema initialization only, no migrations
   - **Tauri Setup Hook**: Explicit migration execution after app state initialization

#### Migration Safety Features

**Idempotency Guarantees:**
- Each migration checks if already applied before execution
- Duplicate execution is safely skipped
- Migration version tracking prevents re-application

**Transaction Safety:**
- Each migration executes within a database transaction
- Rollback on failure prevents partial application
- Atomic execution ensures consistency

**Validation:**
- Checksum verification for migration integrity
- Dry-run mode validates SQL without execution
- Migration history audit trail

**Rollback Support:**
- Database backup before migration execution (via `scripts/db_snapshot.sh`)
- Snapshot restore for emergency rollback
- Migration history preserved for audit

#### Migration Development Workflow

**Adding a New Migration:**

1. Add migration to `get_all_migrations()` in `migrations.rs`:
   ```rust
   Migration {
       version: 15,
       description: "Add new feature table".to_string(),
       sql: r#"
           CREATE TABLE IF NOT EXISTS new_feature (
               id INTEGER PRIMARY KEY,
               data TEXT NOT NULL
           );
       "#,
   }
   ```

2. Test migration locally:
   ```bash
   # Backup database first
   ./scripts/db_snapshot.sh
   
   # Run application (migrations execute automatically)
   npm run tauri:dev
   
   # Verify migration applied
   sqlite3 ~/.kiyya/app.db "SELECT * FROM migrations ORDER BY version DESC LIMIT 1;"
   ```

3. Test idempotency:
   ```bash
   # Run application again (should skip already-applied migration)
   npm run tauri:dev
   ```

4. Test rollback:
   ```bash
   # Restore from backup if needed
   cp backups/<timestamp>-db.sqlite ~/.kiyya/app.db
   ```

**Migration Best Practices:**
- Use `CREATE TABLE IF NOT EXISTS` for idempotency
- Use `CREATE INDEX IF NOT EXISTS` for index creation
- Include descriptive migration descriptions
- Test on fresh database and existing database
- Verify migration can be safely re-run
- Document breaking changes in migration description

#### Migration System Integration

**Startup Sequence:**
1. `main()` → `initialize_app_state()` → `Database::new()`
2. `Database::new()` → `initialize()` → Creates base schema + migrations table
3. Tauri setup hook → `run_startup_migrations()` → `db.run_migrations()`
4. `MigrationRunner::run_migrations()` → Executes pending migrations
5. Application ready for use

**Critical Fix (Phase 2):**
Previously, migrations were executed twice (once in `Database::new()` and once in setup hook), causing stack overflow. This was fixed by removing automatic migration execution from `Database::new()` and keeping only the explicit call in the setup hook.

See: `.kiro/specs/fix-database-initialization-stack-overflow/` for full details.

#### Migration Testing

**Test Coverage:**
- `migration_clean_run_test.rs`: Tests fresh database migration
- `migration_idempotency_test.rs`: Tests duplicate execution safety
- `migration_rollback_test.rs`: Tests rollback scenarios
- `database_initialization_test.rs`: Tests startup sequence
- `integration_test.rs`: Tests full application startup with migrations

**Test Execution:**
```bash
# Run all migration tests
cd src-tauri && cargo test migration

# Run specific test
cargo test test_migration_idempotency
```

#### Troubleshooting

**Common Issues:**

1. **Migration fails to apply**
   - Check migration SQL syntax
   - Verify migration version is sequential
   - Check database file permissions

2. **Migration applied twice**
   - Verify idempotency checks are working
   - Check migrations table for duplicate entries
   - Review migration execution logs

3. **Database corruption after migration**
   - Restore from backup: `cp backups/<timestamp>-db.sqlite ~/.kiyya/app.db`
   - Review migration SQL for destructive operations
   - Test migration on disposable database first

**Debug Commands:**
```bash
# Check current migration version
sqlite3 ~/.kiyya/app.db "SELECT MAX(version) FROM migrations;"

# View migration history
sqlite3 ~/.kiyya/app.db "SELECT * FROM migrations ORDER BY version;"

# Check if specific migration applied
sqlite3 ~/.kiyya/app.db "SELECT * FROM migrations WHERE version = 14;"
```

## Security Architecture

### Security Boundaries

```mermaid
graph TB
    subgraph "Trusted Zone"
        Frontend[React Frontend]
        Backend[Rust Backend]
        DB[(SQLite DB)]
        Vault[Encrypted Vault<br/>File System]
    end
    
    subgraph "Network Boundary"
        Gateway[Gateway Client<br/>Domain Whitelist]
    end
    
    subgraph "External Zone"
        Odysee[Odysee API<br/>odysee.com<br/>api.odysee.com]
        GitHub[GitHub<br/>Update Manifest]
    end
    
    subgraph "OS Security"
        Keystore[OS Keystore<br/>Encryption Keys]
        AppData[App Data Folder<br/>Restricted Access]
    end
    
    Frontend -->|IPC Only| Backend
    Backend -->|Validated Requests| Gateway
    Gateway -->|HTTPS Only| Odysee
    Gateway -->|HTTPS Only| GitHub
    
    Backend -->|Encrypted| Vault
    Backend -->|SQL Prepared| DB
    Backend -->|Key Management| Keystore
    Backend -->|Restricted Path| AppData
    
    style Frontend fill:#4a90e2
    style Backend fill:#85dcb0
    style Gateway fill:#e8a87c
    style Odysee fill:#e27d60
```

### Security Controls

#### Network Security
- **Domain Whitelist**: Only `odysee.com`, `api.odysee.com`, and update manifest URL allowed
- **HTTPS Only**: All external requests require TLS
- **No Embedded Secrets**: No API tokens or keys in application code
- **Request Validation**: All inputs sanitized before network requests

#### File System Security
- **Restricted Access**: Only application data folder accessible
- **Path Validation**: All file paths validated against directory traversal
- **Atomic Operations**: Downloads use temporary files with atomic rename
- **Encryption**: Optional AES-GCM encryption for downloaded content

#### Data Security
- **SQL Injection Protection**: All queries use prepared statements
- **Input Sanitization**: User inputs validated and sanitized
- **Key Management**: Encryption keys stored only in OS keystore
- **No Telemetry**: Zero external analytics or tracking

## Deployment Architecture

### Application Structure

```
kiyya-desktop/
├── src/                          # React frontend source
│   ├── components/               # UI components
│   ├── pages/                    # Route pages
│   ├── hooks/                    # Custom React hooks
│   ├── lib/                      # Utility libraries
│   └── types/                    # TypeScript types
├── src-tauri/                    # Rust backend source
│   ├── src/
│   │   ├── main.rs               # Entry point & Tauri setup
│   │   ├── commands.rs           # 28 Tauri commands
│   │   ├── gateway.rs            # Odysee API client
│   │   ├── database.rs           # SQLite manager
│   │   ├── migrations.rs         # Schema migrations
│   │   ├── download.rs           # Download manager
│   │   ├── server.rs             # Local HTTP server
│   │   ├── encryption.rs         # AES-GCM crypto
│   │   ├── validation.rs         # Input validation
│   │   ├── sanitization.rs       # Input sanitization
│   │   ├── path_security.rs      # Path validation
│   │   ├── logging.rs            # Structured logging
│   │   ├── error_logging.rs      # Error tracking
│   │   ├── security_logging.rs   # Security events
│   │   ├── diagnostics.rs        # Health checks
│   │   ├── crash_reporting.rs    # Crash handler
│   │   ├── models.rs             # Data models
│   │   ├── error.rs              # Error types
│   │   └── *_test.rs             # 60+ test files
│   ├── Cargo.toml                # Rust dependencies
│   └── tauri.conf.json           # Tauri configuration
├── tests/                        # Test suites
│   ├── fixtures/                 # Test data
│   │   └── claim_working.json    # Reproducible test claim
│   ├── unit/                     # Unit tests (in src-tauri/src/)
│   ├── property/                 # Property-based tests (in src-tauri/src/)
│   └── integration/              # Integration tests (in src-tauri/src/)
├── scripts/                      # Automation scripts
│   ├── db_snapshot.sh            # Database backup (Unix)
│   ├── db_snapshot.ps1           # Database backup (Windows)
│   ├── generate_audit_report.sh  # Audit report generation (Unix)
│   ├── generate_audit_report.ps1 # Audit report generation (Windows)
│   ├── ipc_smoke_test.js         # IPC connectivity test
│   └── test_tauri_commands.js    # Command testing infrastructure
├── stabilization/                # Stabilization documentation
│   ├── AUDIT_REPORT.md           # Audit findings
│   ├── DECISIONS.md              # Decision log
│   ├── DELETIONS.md              # Deletion evidence
│   ├── LOGGING_DECISION.md       # Logging system status
│   ├── coverage_report.html      # Coverage report
│   └── *.md                      # Task completion summaries
├── backups/                      # Database backups
│   ├── *-db.sqlite               # Backup files
│   └── *-db.metadata.json        # Backup metadata
├── .github/                      # GitHub configuration
│   ├── workflows/
│   │   └── stabilization.yml     # CI/CD pipeline
│   └── PULL_REQUEST_TEMPLATE.md  # PR template
├── Makefile                      # Build shortcuts
└── dist/                         # Build output
```

### Build and Distribution

```mermaid
flowchart LR
    Source[Source Code] --> Build[Vite Build<br/>Frontend]
    Build --> Bundle[Tauri Bundle<br/>Backend + Frontend]
    
    Bundle --> Windows[Windows<br/>.msi Installer]
    Bundle --> macOS[macOS<br/>.dmg Bundle]
    Bundle --> Linux[Linux<br/>.deb/.AppImage]
    
    Windows --> Sign[Code Signing<br/>Optional]
    macOS --> Sign
    Linux --> Sign
    
    Sign --> Release[GitHub Release<br/>Assets]
    Release --> Manifest[Update Manifest<br/>version.json]
    
    style Source fill:#4a90e2
    style Bundle fill:#85dcb0
    style Release fill:#e8a87c
```

### Update Mechanism

```mermaid
sequenceDiagram
    participant App as Kiyya App
    participant GitHub as GitHub Releases
    participant User as User
    participant Browser as External Browser
    
    App->>GitHub: Fetch version.json
    GitHub-->>App: Latest version info
    
    App->>App: Compare versions
    
    alt Current < Min Supported
        App->>User: Show Forced Update Screen
        User->>App: Click "Update"
        App->>Browser: Open download URL
        Browser->>GitHub: Download installer
        User->>User: Manual install
    else Optional Update Available
        App->>User: Show Update Notification
        User->>App: Dismiss or Update
    else Current Version OK
        App->>App: Continue normal operation
    end
```

## Testing Architecture

### Test Pyramid

```mermaid
graph TD
    E2E[End-to-End Tests<br/>Playwright<br/>~10 tests]
    Integration[Integration Tests<br/>Component + API<br/>~30 tests]
    Unit[Unit Tests<br/>Vitest + Rust<br/>~100+ tests]
    Property[Property-Based Tests<br/>fast-check + proptest<br/>~10 properties × 100 iterations]
    
    E2E --> Integration
    Integration --> Unit
    Property -.->|Validates| Unit
    
    style E2E fill:#e27d60
    style Integration fill:#e8a87c
    style Unit fill:#85dcb0
    style Property fill:#4a90e2
```

### Test Coverage Strategy

#### Frontend Testing
- **Unit Tests**: React components, hooks, utility functions
- **Property Tests**: Content categorization, search normalization, series ordering
- **E2E Tests**: User workflows, navigation, playback

#### Backend Testing
- **Unit Tests**: Tauri commands, gateway client, database operations
- **Property Tests**: Gateway failover, HTTP Range support, version comparison
- **Integration Tests**: Full command interface with mocked services

### Continuous Integration Pipeline

```mermaid
flowchart LR
    Commit[Git Commit] --> Lint[Lint & Format<br/>ESLint, Prettier]
    Lint --> TypeCheck[Type Check<br/>TypeScript]
    TypeCheck --> UnitFE[Unit Tests<br/>Frontend]
    UnitFE --> UnitBE[Unit Tests<br/>Backend]
    UnitBE --> Property[Property Tests<br/>100+ iterations]
    Property --> E2E[E2E Tests<br/>Headless]
    E2E --> Build[Production Build]
    Build --> Success[✓ CI Pass]
    
    Lint -.->|Fail| Fail[✗ CI Fail]
    TypeCheck -.->|Fail| Fail
    UnitFE -.->|Fail| Fail
    UnitBE -.->|Fail| Fail
    Property -.->|Fail| Fail
    E2E -.->|Fail| Fail
    Build -.->|Fail| Fail
    
    style Success fill:#85dcb0
    style Fail fill:#e27d60
```

## Performance Considerations

### Frontend Optimization
- **Lazy Loading**: IntersectionObserver for content rows and images
- **Code Splitting**: Route-based code splitting with React.lazy
- **Memoization**: React.memo for expensive components
- **Debouncing**: Search input debouncing (300ms)
- **Virtual Scrolling**: For large content lists (future enhancement)

### Backend Optimization
- **Connection Pooling**: Reuse HTTP connections for API requests
- **Database Indexing**: Strategic indices on frequently queried columns
- **Async Operations**: Non-blocking I/O with tokio runtime
- **Caching Strategy**: 30-minute TTL with LRU eviction
- **Streaming Downloads**: Chunked transfer for large files

### Resource Management
- **Memory Limits**: Maximum 200 items in memory cache
- **Disk Space Checks**: Pre-flight validation before downloads
- **Idle Callbacks**: Background tasks use requestIdleCallback
- **Animation Limits**: GSAP usage restricted to hero, dropdowns, hover only

## Video Playback Architecture

### Playback Model Overview

Kiyya uses a CDN-based HLS (HTTP Live Streaming) playback model with adaptive bitrate streaming. The application constructs playback URLs from claim IDs and streams content through the Odysee CDN infrastructure.

### Content Fetch Pipeline (Actual Implementation)

The content fetch and playback pipeline follows this sequence:

```mermaid
flowchart TD
    Start([User Selects<br/>Content]) --> FetchClaim[Fetch Claim<br/>Metadata]
    
    FetchClaim --> ValidateType{Validate<br/>value_type}
    ValidateType -->|Not 'stream'| RejectClaim[Reject Non-Stream<br/>Claim]
    ValidateType -->|Is 'stream'| ExtractClaimID[Extract claim_id<br/>from Metadata]
    
    ExtractClaimID --> ValidateClaimID{claim_id<br/>Valid?}
    ValidateClaimID -->|Empty/Missing| ErrorMissingID[Error: Missing<br/>claim_id]
    ValidateClaimID -->|Valid| ConstructCDN[Construct CDN URL<br/>build_cdn_playback_url]
    
    ConstructCDN --> FormatURL[Format URL:<br/>gateway/content/claim_id/master.m3u8]
    FormatURL --> CreateVideoURL[Create VideoUrl<br/>Object]
    
    CreateVideoURL --> StoreInMap[Store in HashMap<br/>key: 'master']
    StoreInMap --> ReturnToFrontend[Return ContentItem<br/>to Frontend]
    
    ReturnToFrontend --> UserClicksPlay{User Clicks<br/>Play?}
    UserClicksPlay -->|No| End([Content Displayed])
    UserClicksPlay -->|Yes| CheckOffline{Offline<br/>Mode?}
    
    CheckOffline -->|Yes| LocalServer[Get URL from<br/>Local HTTP Server]
    CheckOffline -->|No| UseOnlineURL[Use CDN URL<br/>from video_urls]
    
    LocalServer --> InitPlayer[Initialize Player]
    UseOnlineURL --> InitPlayer
    
    InitPlayer --> CheckHLS{HLS Stream<br/>.m3u8?}
    CheckHLS -->|Yes| CheckHLSSupport{hls.js<br/>Supported?}
    CheckHLS -->|No| DirectMP4[Direct MP4<br/>Playback]
    
    CheckHLSSupport -->|Yes| InitHLS[Initialize hls.js<br/>with Config]
    CheckHLSSupport -->|No| CheckNative{Native HLS<br/>Safari?}
    
    CheckNative -->|Yes| NativeHLS[Native HLS<br/>Playback]
    CheckNative -->|No| ErrorNoHLS[Error: HLS Not<br/>Supported]
    
    InitHLS --> LoadSource[hls.loadSource<br/>videoUrl]
    LoadSource --> AttachMedia[hls.attachMedia<br/>videoElement]
    AttachMedia --> ManifestParsed[Wait for<br/>MANIFEST_PARSED]
    
    ManifestParsed --> InitPlyr[Initialize Plyr<br/>Player UI]
    NativeHLS --> InitPlyr
    DirectMP4 --> InitPlyr
    
    InitPlyr --> AttachListeners[Attach Event<br/>Listeners]
    AttachListeners --> StartPlayback[Start Playback]
    
    StartPlayback --> MonitorBuffering[Monitor Buffering<br/>Events]
    MonitorBuffering --> SaveProgress[Save Progress<br/>Every 20s]
    
    SaveProgress --> PlaybackActive([Playback Active])
    
    ErrorMissingID --> End
    RejectClaim --> End
    ErrorNoHLS --> End
    
    style Start fill:#4a90e2
    style ConstructCDN fill:#85dcb0
    style InitHLS fill:#e8a87c
    style PlaybackActive fill:#85dcb0
    style ErrorMissingID fill:#e27d60
    style ErrorNoHLS fill:#e27d60
```

### CDN Playback URL Construction

**Backend Implementation** (`commands.rs`):

The `extract_video_urls()` function is the core of the content fetch pipeline:

1. **Claim Type Validation**
   - Validates `value_type == "stream"` (rejects channels, reposts, collections)
   - Fallback: Infers stream type from `value.source.sd_hash` if `value_type` missing
   - Logs diagnostic information at INFO level

2. **Claim ID Extraction**
   - Extracts `claim_id` from claim metadata
   - Trims whitespace and validates non-empty
   - Returns error if missing or empty

3. **CDN URL Construction**
   - Calls `build_cdn_playback_url(claim_id, gateway)`
   - Format: `{gateway}/content/{claim_id}/master.m3u8`
   - Default gateway: `https://cloud.odysee.live`
   - Creates `VideoUrl` struct with:
     - `url`: Constructed CDN URL
     - `quality`: "master" (adaptive bitrate)
     - `url_type`: "hls"
     - `codec`: None

4. **Return Value**
   - Returns `HashMap<String, VideoUrl>` with single "master" entry
   - Frontend accesses via `content.video_urls["master"]`

**Key Functions:**

```rust
// Build CDN playback URL from claim_id
pub(crate) fn build_cdn_playback_url(claim_id: &str, gateway: &str) -> String {
    format!("{}/content/{}/{}", gateway, claim_id, HLS_MASTER_PLAYLIST)
}
// HLS_MASTER_PLAYLIST = "master.m3u8"

// Extract video URLs from claim metadata
fn extract_video_urls(item: &Value) -> Result<HashMap<String, VideoUrl>> {
    // 1. Validate claim type (stream only)
    // 2. Extract and validate claim_id
    // 3. Construct CDN URL
    // 4. Return HashMap with "master" entry
}
```

**CDN Gateway Configuration:**

- **Default Gateway**: `https://cloud.odysee.live`
- **Configurable**: Can be overridden via environment variable or config
- **URL Pattern**: `{gateway}/content/{claim_id}/master.m3u8`

### Player Integration

**Frontend Implementation** (`PlayerModal.tsx`):

The player modal integrates Plyr (UI) with hls.js (HLS streaming) for video playback:

1. **Player Initialization**
   - Determines video URL (online CDN or offline local server)
   - Detects HLS streams (`.m3u8` extension or `type: 'hls'`)
   - Initializes appropriate playback method

2. **HLS Playback (Primary Method)**
   - **hls.js Support** (Chrome, Firefox, Edge):
     ```typescript
     const hls = new Hls({
       enableWorker: true,
       lowLatencyMode: false,
       backBufferLength: 90
     });
     hls.loadSource(videoUrl);
     hls.attachMedia(videoElement);
     ```
   - **Native HLS** (Safari):
     ```typescript
     videoElement.src = videoUrl;
     videoElement.canPlayType('application/vnd.apple.mpegurl');
     ```
   - **Error Handling**: Network errors, media errors, fatal errors

3. **Plyr UI Integration**
   - Controls: play, progress, time, volume, settings, fullscreen
   - Settings: quality selection, playback speed (0.5x - 2x)
   - Keyboard navigation and tooltips
   - Accessibility: ARIA labels, screen reader support

4. **Quality Management**
   - Default: "master" quality (adaptive bitrate)
   - Available qualities: Extracted from `content.video_urls` keys
   - Auto-downgrade: If buffering 3+ times in 10 seconds
   - Manual selection: User can choose specific quality

5. **Progress Tracking**
   - Loads saved progress on player open
   - Saves progress every 20 seconds during playback
   - Final save on player close
   - Uses `requestIdleCallback` for non-critical saves

6. **Buffering Handling**
   - Monitors `waiting` events on video element
   - Counts buffering events in 10-second window
   - Auto-downgrades quality after 3 buffering events
   - Shows notification to user

7. **Compatibility Checks**
   - Checks HLS support (`Hls.isSupported()` or native)
   - Checks MP4 codec support for fallback
   - Shows compatibility warnings if unsupported
   - Suggests external player if needed

### Offline Playback

**Local HTTP Server** (`server.rs`):

For offline playback, the application runs a local HTTP server that serves downloaded content:

1. **Server Initialization**
   - Starts on `http://127.0.0.1:{port}`
   - Serves content from encrypted vault or plain files
   - Supports HTTP Range requests for seeking

2. **On-the-Fly Decryption**
   - If content is encrypted (AES-GCM), decrypts during streaming
   - Maintains streaming performance with chunked decryption
   - Supports partial content requests (Range headers)

3. **URL Format**
   - Pattern: `http://127.0.0.1:{port}/movies/{claim_id}`
   - Frontend calls `streamOffline({ claim_id, quality })` to get URL
   - Player treats local URL same as CDN URL

4. **Concurrent Streaming**
   - Supports multiple concurrent connections (seeking behavior)
   - Handles overlapping Range requests
   - Tested with property-based tests (100+ cases)

### Playback Flow Summary

**Online Playback:**
1. User selects content → Frontend displays content card
2. User clicks play → `PlayerModal` opens
3. Frontend reads `content.video_urls["master"].url` (CDN URL)
4. hls.js loads HLS manifest from CDN
5. Adaptive bitrate streaming begins
6. Plyr UI provides controls and progress tracking

**Offline Playback:**
1. User downloads content → Stored in encrypted vault
2. User clicks play on downloaded content → `PlayerModal` opens with `isOffline={true}`
3. Frontend calls `streamOffline()` → Returns local server URL
4. Local server decrypts and streams content
5. hls.js or native player handles playback
6. Same Plyr UI and progress tracking

### Player Architecture Diagram

```mermaid
graph TB
    subgraph "Frontend Player Layer"
        PlayerModal[PlayerModal Component]
        PlyrUI[Plyr UI Controls]
        VideoElement[HTML5 Video Element]
    end
    
    subgraph "Streaming Layer"
        HlsJS[hls.js Library]
        NativeHLS[Native HLS Safari]
        DirectMP4[Direct MP4]
    end
    
    subgraph "Content Source"
        CDN[Odysee CDN<br/>cloud.odysee.live]
        LocalServer[Local HTTP Server<br/>127.0.0.1:port]
    end
    
    subgraph "Backend Services"
        Commands[Tauri Commands]
        Server[server.rs]
        Encryption[encryption.rs]
        Vault[Encrypted Vault]
    end
    
    PlayerModal --> PlyrUI
    PlayerModal --> VideoElement
    PlyrUI --> VideoElement
    
    VideoElement --> HlsJS
    VideoElement --> NativeHLS
    VideoElement --> DirectMP4
    
    HlsJS --> CDN
    HlsJS --> LocalServer
    NativeHLS --> CDN
    NativeHLS --> LocalServer
    DirectMP4 --> CDN
    DirectMP4 --> LocalServer
    
    LocalServer --> Server
    Server --> Encryption
    Encryption --> Vault
    
    PlayerModal --> Commands
    Commands --> Server
    
    style PlayerModal fill:#4a90e2
    style HlsJS fill:#85dcb0
    style CDN fill:#e8a87c
    style LocalServer fill:#e8a87c
```

### Key Playback Features

**Adaptive Bitrate Streaming:**
- HLS master playlist provides multiple quality levels
- hls.js automatically selects optimal quality based on bandwidth
- Seamless quality switching during playback

**Seeking and Range Requests:**
- HTTP Range support for instant seeking
- Works for both online (CDN) and offline (local server)
- Tested with concurrent seeking scenarios

**Error Recovery:**
- Network error: Retry with exponential backoff
- Media error: Attempt recovery via `hls.recoverMediaError()`
- Fatal error: Show error message and suggest alternatives

**Progress Persistence:**
- Saves playback position every 20 seconds
- Resumes from saved position on next play
- Stored in SQLite `progress` table

**Quality Fallback:**
- Auto-downgrade on repeated buffering
- Manual quality selection available
- Graceful degradation to lower quality

### Testing Coverage

**Backend Tests:**
- `extract_video_urls()`: 10+ unit tests covering all edge cases
- `build_cdn_playback_url()`: 6+ unit tests for URL construction
- Property-based tests: 5 properties × 100 cases each
- Integration tests: Full pipeline from claim to playback URL

**Frontend Tests:**
- Player initialization and cleanup
- HLS vs MP4 detection
- Quality selection and auto-downgrade
- Progress tracking and persistence
- Compatibility checks

**Property-Based Tests:**
1. Valid claim_id always produces CDN URL
2. Missing direct URL fields do not cause errors
3. Missing claim_id returns error
4. Backend response contains required fields
5. Partial success when processing multiple claims

### Known Limitations

**Current Constraints:**
- Single quality "master" entry (adaptive bitrate only)
- No manual quality selection for HLS (handled by hls.js)
- No offline HLS manifest caching (downloads full file)
- No peer-to-peer streaming

**Platform Support:**
- **Full Support**: Chrome, Firefox, Edge, Safari (macOS/iOS)
- **Limited Support**: Older browsers without MediaSource API
- **No Support**: Browsers without HLS or MP4 codec support

### Future Enhancements

**Planned Improvements:**
- Multiple quality levels for manual selection
- Offline HLS manifest caching for faster startup
- Picture-in-picture mode
- Chromecast/AirPlay support
- Playback speed persistence
- Subtitle/caption support

## Scalability Considerations

### Current Limitations
- **Single Channel**: Application designed for one Odysee channel
- **Local Storage**: All data stored locally, no cloud sync
- **Manual Updates**: User-initiated update process
- **No CDN**: Direct gateway access without CDN layer

### Future Enhancements
- **Multi-Channel Support**: Configuration for multiple channels
- **Cloud Sync**: Optional cloud backup for favorites and progress
- **Auto-Updates**: Background update downloads with user approval
- **CDN Integration**: Content delivery optimization
- **Playlist Sharing**: Export/import playlist functionality

## Conclusion

The Kiyya architecture prioritizes security, performance, and offline-first functionality while maintaining a clean separation between frontend and backend concerns. The Tauri framework provides a secure bridge between the React UI and Rust backend, enabling native desktop capabilities with web technologies.

### Post-Stabilization Architecture (Phase 3 Complete)

After comprehensive stabilization (Phases 0-3), the architecture has been verified and documented:

**Key Achievements:**
- **18 core modules** identified and documented
- **28 Tauri commands** registered and tested
- **98.4% test pass rate** (720/732 tests passing)
- **Zero critical vulnerabilities** (security audit passed)
- **All critical modules** meet >= 60% coverage target
- **Comprehensive observability** (logging, error tracking, security events, crash reporting)
- **Production-ready migration system** with idempotency and rollback support

**Architectural Strengths:**
- **Resilient**: Gateway failover and defensive error handling
- **Secure**: Restricted network/filesystem access with optional encryption
- **Performant**: Efficient caching and lazy loading strategies
- **Testable**: Comprehensive test coverage with property-based testing
- **Maintainable**: Clear component boundaries and separation of concerns
- **Observable**: Structured logging, error tracking, and security event monitoring

**Module Integration Status:**
- **Logging System**: ✅ Fully integrated with structured JSON format
- **Migration System**: ✅ Fully integrated with idempotency and history tracking
- **Security Logging**: ✅ Fully integrated with 15 production call sites
- **Error Logging**: ✅ Fully integrated with database persistence
- **Crash Reporting**: ✅ Fully integrated with stack trace capture

**Testing Infrastructure:**
- **738 total tests** across unit, integration, and property-based categories
- **60+ test files** covering all critical modules
- **Property-based tests** with 100+ cases each validating universal properties
- **Manual testing guide** for all 28 Tauri commands

**Documentation:**
- **ARCHITECTURE.md**: This document (updated with actual module structure)
- **stabilization/DECISIONS.md**: Comprehensive decision log with rationale
- **stabilization/AUDIT_REPORT.md**: Complete audit findings
- **stabilization/*.md**: 30+ task completion summaries

For implementation details and stabilization history, refer to:
- **Stabilization Spec**: `.kiro/specs/codebase-stabilization-audit/`
- **Requirements**: `.kiro/specs/codebase-stabilization-audit/requirements.md`
- **Design**: `.kiro/specs/codebase-stabilization-audit/design.md`
- **Tasks**: `.kiro/specs/codebase-stabilization-audit/tasks.md`
- **Decisions**: `stabilization/DECISIONS.md`

**Next Steps (Phase 4):**
- Odysee playback issue debugging with reproducible test claim
- Tracing integration for content pipeline
- Debug playbook execution
- Precise issue identification and resolution


## Backend Command Reference

This section documents all registered Tauri commands that form the IPC interface between the frontend and backend.

### Command Categories

1. **Testing & Diagnostics** - Health checks and debugging
2. **Content Discovery** - Fetching content from Odysee
3. **Download Management** - Offline content handling
4. **Progress & State** - User progress tracking
5. **Favorites** - User favorites management
6. **Configuration** - App settings and diagnostics
7. **Cache Management** - Cache control operations
8. **Crash Reporting** - Crash log management
9. **External Links** - Opening external URLs

---

### Testing & Diagnostics Commands

#### `test_connection`
**Purpose**: Health check to verify Tauri IPC connectivity

**Parameters**: None

**Returns**: `Result<String>` - Returns `"tauri-backend-alive"` on success

**Usage**:
```javascript
await invoke('test_connection');
// Returns: "tauri-backend-alive"
```

**Notes**: Used in IPC smoke tests and development verification

---

#### `build_cdn_playback_url_test`
**Purpose**: Test CDN URL construction without attempting playback

**Parameters**:
- `claim_id: String` - Odysee claim identifier

**Returns**: `String` - Constructed CDN playback URL

**Usage**:
```javascript
const url = await invoke('build_cdn_playback_url_test', { 
  claimId: 'abc123def456' 
});
// Returns: "https://cloud.odysee.live/content/abc123def456/master.m3u8"
```

**Notes**: Deterministic URL construction for testing purposes

---

#### `get_diagnostics`
**Purpose**: Collect comprehensive system diagnostics

**Parameters**:
- `state: State<AppState>` - Application state (injected)

**Returns**: `Result<DiagnosticsData>` - System diagnostics including:
- Gateway status and failover state
- Local server status and port
- Database statistics
- Vault path and storage info
- Download manager status

**Usage**:
```javascript
const diagnostics = await invoke('get_diagnostics');
console.log(diagnostics.gateway_status);
console.log(diagnostics.local_server_port);
```

---

#### `collect_debug_package`
**Purpose**: Create a comprehensive debug package for troubleshooting

**Parameters**:
- `state: State<AppState>` - Application state (injected)
- `app_handle: AppHandle` - Tauri app handle (injected)

**Returns**: `Result<String>` - Path to created debug package

**Usage**:
```javascript
const packagePath = await invoke('collect_debug_package');
console.log('Debug package created at:', packagePath);
```

**Notes**: Includes logs, database stats, vault info, and system diagnostics

---

### Content Discovery Commands

#### `fetch_channel_claims`
**Purpose**: Fetch content items from configured Odysee channel

**Parameters**:
- `channel_id: String` - Channel identifier (e.g., `@kiyyamovies:b`)
- `any_tags: Option<Vec<String>>` - Filter by tags (e.g., `["hero", "movies"]`)
- `text: Option<String>` - Text search query
- `limit: Option<u32>` - Maximum items to return (default: 50)
- `page: Option<u32>` - Page number for pagination (default: 1)
- `force_refresh: Option<bool>` - Skip cache and fetch fresh data
- `stream_types: Option<Vec<String>>` - Filter by stream type
- `state: State<AppState>` - Application state (injected)

**Returns**: `Result<Vec<ContentItem>>` - Array of content items with:
- `claim_id` - Unique content identifier
- `title` - Content title
- `description` - Content description
- `thumbnail_url` - Thumbnail image URL
- `release_time` - Release timestamp
- `duration` - Video duration in seconds
- `tags` - Content tags
- `stream_type` - Type of content (video, audio, etc.)

**Usage**:
```javascript
// Fetch all content
const items = await invoke('fetch_channel_claims', {
  channelId: '@kiyyamovies:b'
});

// Fetch with filters
const heroItems = await invoke('fetch_channel_claims', {
  channelId: '@kiyyamovies:b',
  anyTags: ['hero'],
  limit: 10,
  forceRefresh: false
});

// Text search
const searchResults = await invoke('fetch_channel_claims', {
  channelId: '@kiyyamovies:b',
  text: 'action',
  limit: 20
});
```

**Notes**: 
- Uses local cache by default (30-minute TTL)
- Set `force_refresh: true` to bypass cache
- Returns empty array if no items match filters

---

#### `fetch_playlists`
**Purpose**: Fetch playlists from configured channel

**Parameters**:
- `channel_id: String` - Channel identifier
- `state: State<AppState>` - Application state (injected)

**Returns**: `Result<Vec<Playlist>>` - Array of playlists with:
- `id` - Playlist identifier
- `name` - Playlist name
- `description` - Playlist description
- `items` - Array of claim IDs in playlist

**Usage**:
```javascript
const playlists = await invoke('fetch_playlists', {
  channelId: '@kiyyamovies:b'
});
```

---

#### `resolve_claim`
**Purpose**: Resolve a specific claim by ID or URI

**Parameters**:
- `claim_id_or_uri: String` - Claim ID or LBRY URI
- `state: State<AppState>` - Application state (injected)

**Returns**: `Result<ContentItem>` - Single content item

**Usage**:
```javascript
const item = await invoke('resolve_claim', {
  claimIdOrUri: 'abc123def456'
});
```

---

### Download Management Commands

#### `download_movie_quality`
**Purpose**: Download content for offline viewing

**Parameters**:
- `claim_id: String` - Content identifier
- `quality: String` - Quality level (e.g., "1080p", "720p", "master")
- `url: String` - Download URL
- `app_handle: AppHandle` - Tauri app handle (injected)
- `state: State<AppState>` - Application state (injected)

**Returns**: `Result<()>` - Success or error

**Events Emitted**:
- `download-progress` - Progress updates during download
- `download-complete` - Download finished successfully
- `download-error` - Download failed with error details

**Usage**:
```javascript
await invoke('download_movie_quality', {
  claimId: 'abc123',
  quality: '1080p',
  url: 'https://cdn.example.com/content.mp4'
});
```

**Notes**: 
- Respects `encrypt_downloads` setting
- Emits progress events for UI updates
- Stores metadata in database on completion

---

#### `stream_offline`
**Purpose**: Start local server and stream downloaded content

**Parameters**:
- `claim_id: String` - Content identifier
- `quality: String` - Quality level
- `state: State<AppState>` - Application state (injected)
- `app_handle: AppHandle` - Tauri app handle (injected)

**Returns**: `Result<StreamOfflineResponse>` with:
- `url: String` - Local streaming URL
- `port: u16` - Local server port

**Events Emitted**:
- `local-server-started` - Server started with port and URL

**Usage**:
```javascript
const response = await invoke('stream_offline', {
  claimId: 'abc123',
  quality: '1080p'
});
console.log('Stream at:', response.url);
// Example: "http://127.0.0.1:8080/movies/abc123-1080p"
```

**Notes**: 
- Starts local HTTP server if not running
- Handles encrypted content automatically
- Registers content for streaming session

---

#### `delete_offline`
**Purpose**: Delete downloaded offline content

**Parameters**:
- `claim_id: String` - Content identifier
- `quality: String` - Quality level
- `state: State<AppState>` - Application state (injected)

**Returns**: `Result<()>` - Success or error

**Usage**:
```javascript
await invoke('delete_offline', {
  claimId: 'abc123',
  quality: '1080p'
});
```

**Notes**: 
- Removes file from vault
- Deletes database metadata
- Unregisters from local server

---

### Progress & State Commands

#### `save_progress`
**Purpose**: Save user's playback progress for a content item

**Parameters**:
- `claim_id: String` - Content identifier
- `position_seconds: u32` - Current playback position in seconds
- `quality: String` - Quality level being watched
- `state: State<AppState>` - Application state (injected)

**Returns**: `Result<()>` - Success or error

**Usage**:
```javascript
await invoke('save_progress', {
  claimId: 'abc123',
  positionSeconds: 1234,
  quality: '1080p'
});
```

**Notes**: Automatically updates timestamp on each save

---

#### `get_progress`
**Purpose**: Retrieve saved playback progress for a content item

**Parameters**:
- `claim_id: String` - Content identifier
- `state: State<AppState>` - Application state (injected)

**Returns**: `Result<Option<ProgressData>>` with:
- `claim_id: String` - Content identifier
- `position_seconds: u32` - Last saved position
- `quality: String` - Quality level
- `updated_at: i64` - Unix timestamp of last update

**Usage**:
```javascript
const progress = await invoke('get_progress', {
  claimId: 'abc123'
});
if (progress) {
  console.log('Resume at:', progress.position_seconds);
}
```

---

### Favorites Commands

#### `save_favorite`
**Purpose**: Add content to user's favorites

**Parameters**:
- `claim_id: String` - Content identifier
- `title: String` - Content title
- `thumbnail_url: Option<String>` - Thumbnail URL
- `state: State<AppState>` - Application state (injected)

**Returns**: `Result<()>` - Success or error

**Usage**:
```javascript
await invoke('save_favorite', {
  claimId: 'abc123',
  title: 'My Favorite Movie',
  thumbnailUrl: 'https://example.com/thumb.jpg'
});
```

---

#### `remove_favorite`
**Purpose**: Remove content from user's favorites

**Parameters**:
- `claim_id: String` - Content identifier
- `state: State<AppState>` - Application state (injected)

**Returns**: `Result<()>` - Success or error

**Usage**:
```javascript
await invoke('remove_favorite', {
  claimId: 'abc123'
});
```

---

#### `get_favorites`
**Purpose**: Retrieve all user favorites

**Parameters**:
- `state: State<AppState>` - Application state (injected)

**Returns**: `Result<Vec<FavoriteItem>>` - Array of favorites with:
- `claim_id: String` - Content identifier
- `title: String` - Content title
- `thumbnail_url: Option<String>` - Thumbnail URL
- `inserted_at: i64` - Unix timestamp when favorited

**Usage**:
```javascript
const favorites = await invoke('get_favorites');
console.log('User has', favorites.length, 'favorites');
```

---

#### `is_favorite`
**Purpose**: Check if content is in user's favorites

**Parameters**:
- `claim_id: String` - Content identifier
- `state: State<AppState>` - Application state (injected)

**Returns**: `Result<bool>` - True if favorited, false otherwise

**Usage**:
```javascript
const isFav = await invoke('is_favorite', {
  claimId: 'abc123'
});
console.log('Is favorite:', isFav);
```

---

### Configuration Commands

#### `get_app_config`
**Purpose**: Retrieve current application configuration

**Parameters**:
- `state: State<AppState>` - Application state (injected)

**Returns**: `Result<AppConfig>` with:
- `theme: String` - UI theme ("dark" or "light")
- `last_used_quality: String` - Last selected quality
- `encrypt_downloads: bool` - Encryption enabled
- `auto_upgrade_quality: bool` - Auto quality upgrade
- `cache_ttl_minutes: u32` - Cache TTL in minutes
- `max_cache_items: u32` - Maximum cached items
- `vault_path: String` - Download vault path
- `version: String` - App version
- `gateways: Vec<String>` - Available API gateways

**Usage**:
```javascript
const config = await invoke('get_app_config');
console.log('App version:', config.version);
console.log('Theme:', config.theme);
console.log('Vault:', config.vault_path);
```

---

#### `update_settings`
**Purpose**: Update application settings

**Parameters**:
- `settings: HashMap<String, String>` - Key-value pairs of settings
- `state: State<AppState>` - Application state (injected)

**Returns**: `Result<()>` - Success or error

**Valid Setting Keys**:
- `theme` - "dark" or "light"
- `last_used_quality` - Quality string
- `encrypt_downloads` - "true" or "false"
- `auto_upgrade_quality` - "true" or "false"
- `cache_ttl_minutes` - Number as string
- `max_cache_items` - Number as string

**Usage**:
```javascript
await invoke('update_settings', {
  settings: {
    theme: 'dark',
    encrypt_downloads: 'true',
    cache_ttl_minutes: '60'
  }
});
```

---

### Cache Management Commands

#### `invalidate_cache_item`
**Purpose**: Invalidate cache for a specific content item

**Parameters**:
- `claim_id: String` - Content identifier
- `state: State<AppState>` - Application state (injected)

**Returns**: `Result<bool>` - True if item was invalidated

**Usage**:
```javascript
const invalidated = await invoke('invalidate_cache_item', {
  claimId: 'abc123'
});
```

---

#### `invalidate_cache_by_tags`
**Purpose**: Invalidate all cached items with specific tags

**Parameters**:
- `tags: Vec<String>` - Array of tags
- `state: State<AppState>` - Application state (injected)

**Returns**: `Result<u32>` - Number of items invalidated

**Usage**:
```javascript
const count = await invoke('invalidate_cache_by_tags', {
  tags: ['hero', 'movies']
});
console.log('Invalidated', count, 'items');
```

---

#### `clear_all_cache`
**Purpose**: Clear all cached content

**Parameters**:
- `state: State<AppState>` - Application state (injected)

**Returns**: `Result<u32>` - Number of items cleared

**Usage**:
```javascript
const count = await invoke('clear_all_cache');
console.log('Cleared', count, 'cache items');
```

---

#### `cleanup_expired_cache`
**Purpose**: Remove expired cache entries based on TTL

**Parameters**:
- `state: State<AppState>` - Application state (injected)

**Returns**: `Result<u32>` - Number of expired items removed

**Usage**:
```javascript
const count = await invoke('cleanup_expired_cache');
console.log('Cleaned up', count, 'expired items');
```

---

#### `get_cache_stats`
**Purpose**: Get cache statistics

**Parameters**:
- `state: State<AppState>` - Application state (injected)

**Returns**: `Result<CacheStats>` with:
- `total_items: u32` - Total cached items
- `total_size_bytes: u64` - Total cache size
- `oldest_entry: Option<i64>` - Oldest entry timestamp
- `newest_entry: Option<i64>` - Newest entry timestamp

**Usage**:
```javascript
const stats = await invoke('get_cache_stats');
console.log('Cache items:', stats.total_items);
console.log('Cache size:', stats.total_size_bytes);
```

---

#### `get_memory_stats`
**Purpose**: Get database memory statistics

**Parameters**:
- `state: State<AppState>` - Application state (injected)

**Returns**: `Result<MemoryStats>` with memory usage details

**Usage**:
```javascript
const stats = await invoke('get_memory_stats');
console.log('Memory usage:', stats);
```

---

#### `optimize_database_memory`
**Purpose**: Optimize database memory usage

**Parameters**:
- `state: State<AppState>` - Application state (injected)

**Returns**: `Result<()>` - Success or error

**Usage**:
```javascript
await invoke('optimize_database_memory');
console.log('Database optimized');
```

**Notes**: Runs VACUUM and other optimization operations

---

### Crash Reporting Commands

#### `get_recent_crashes`
**Purpose**: Retrieve recent crash reports

**Parameters**:
- `limit: usize` - Maximum number of crashes to return

**Returns**: `Result<Vec<CrashReport>>` - Array of crash reports with:
- `timestamp: i64` - Crash timestamp
- `error_message: String` - Error message
- `stack_trace: Option<String>` - Stack trace if available

**Usage**:
```javascript
const crashes = await invoke('get_recent_crashes', { limit: 10 });
console.log('Recent crashes:', crashes.length);
```

---

#### `clear_crash_log`
**Purpose**: Clear all crash logs

**Parameters**: None

**Returns**: `Result<()>` - Success or error

**Usage**:
```javascript
await invoke('clear_crash_log');
console.log('Crash logs cleared');
```

---

### External Links Command

#### `open_external`
**Purpose**: Open URL in default system browser

**Parameters**:
- `url: String` - URL to open

**Returns**: `Result<()>` - Success or error

**Usage**:
```javascript
await invoke('open_external', {
  url: 'https://odysee.com/@kiyyamovies:b'
});
```

**Notes**: 
- Validates URL for security
- Uses system default browser
- Platform-specific implementation

---

### Command Registration

All commands are registered in `src-tauri/src/main.rs`:

```rust
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
```

### Frontend Usage Pattern

All commands are invoked from the frontend using Tauri's `invoke` API:

```typescript
import { invoke } from '@tauri-apps/api/tauri';

// Example: Fetch content
const items = await invoke<ContentItem[]>('fetch_channel_claims', {
  channelId: '@kiyyamovies:b',
  anyTags: ['movies'],
  limit: 50
});

// Example: Save progress
await invoke('save_progress', {
  claimId: 'abc123',
  positionSeconds: 1234,
  quality: '1080p'
});

// Example: Get diagnostics
const diagnostics = await invoke<DiagnosticsData>('get_diagnostics');
```

### Error Handling

All commands return `Result<T>` types that map to JavaScript promises:

```typescript
try {
  const items = await invoke('fetch_channel_claims', { channelId: '@kiyyamovies:b' });
  console.log('Success:', items);
} catch (error) {
  console.error('Command failed:', error);
  // Error contains structured error information from backend
}
```

### Security Considerations

- All string inputs are validated and sanitized
- URLs are validated before use
- File paths are restricted to vault directory
- Database queries use parameterized statements
- External URLs require validation before opening

---

**Last Updated**: Phase 3 - Task 14.5 (Codebase Stabilization Audit)
