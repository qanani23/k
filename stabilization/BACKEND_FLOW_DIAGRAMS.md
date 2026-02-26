# Backend Flow Diagrams

This document provides comprehensive visual representations of the Kiyya Desktop backend architecture, showing module interactions, data flow patterns, and initialization sequences.

## 1. Backend Module Interaction Diagram

```mermaid
graph TB
    subgraph "Entry Point"
        MAIN[main.rs]
    end

    subgraph "Core State Management"
        APPSTATE[AppState]
        DB[(Database)]
        GATEWAY[GatewayClient]
        DOWNLOAD[DownloadManager]
        SERVER[LocalServer]
    end

    subgraph "Command Layer"
        COMMANDS[commands.rs]
        TEST[test_connection]
        FETCH[fetch_channel_claims]
        RESOLVE[resolve_claim]
        DL[download_movie_quality]
        STREAM[stream_offline]
        PROGRESS[save/get_progress]
        FAVORITES[save/remove_favorite]
        CACHE[cache_management]
        DIAG[diagnostics]
    end

    subgraph "Business Logic Modules"
        GATEWAY_MOD[gateway.rs]
        DATABASE_MOD[database.rs]
        DOWNLOAD_MOD[download.rs]
        SERVER_MOD[server.rs]
        ENCRYPTION[encryption.rs]
        VALIDATION[validation.rs]
        SANITIZATION[sanitization.rs]
    end

    subgraph "Infrastructure Modules"
        MIGRATIONS[migrations.rs]
        LOGGING[logging.rs]
        ERROR_LOG[error_logging.rs]
        SEC_LOG[security_logging.rs]
        CRASH[crash_reporting.rs]
        DIAGNOSTICS[diagnostics.rs]
    end

    subgraph "Security & Validation"
        PATH_SEC[path_security.rs]
        ERROR[error.rs]
        MODELS[models.rs]
    end

    %% Main initialization flow
    MAIN -->|initialize_app_state| APPSTATE
    MAIN -->|init_logging| LOGGING
    MAIN -->|init_crash_reporting| CRASH
    MAIN -->|register_commands| COMMANDS

    %% AppState composition
    APPSTATE -->|Arc<Mutex<>>| DB
    APPSTATE -->|Arc<Mutex<>>| GATEWAY
    APPSTATE -->|Arc<Mutex<>>| DOWNLOAD
    APPSTATE -->|Arc<Mutex<>>| SERVER

    %% Command layer dependencies
    COMMANDS -->|State<AppState>| APPSTATE
    COMMANDS -->|validate inputs| VALIDATION
    COMMANDS -->|sanitize inputs| SANITIZATION
    COMMANDS -->|error handling| ERROR

    %% Specific command flows
    FETCH -->|lock & query| DB
    FETCH -->|fetch_with_failover| GATEWAY
    FETCH -->|parse & store| DATABASE_MOD

    RESOLVE -->|validate| VALIDATION
    RESOLVE -->|fetch_with_failover| GATEWAY

    DL -->|validate| VALIDATION
    DL -->|download_content| DOWNLOAD
    DL -->|save_offline_metadata| DB
    DL -->|encrypt if enabled| ENCRYPTION

    STREAM -->|get_offline_metadata| DB
    STREAM -->|get_content_path| DOWNLOAD
    STREAM -->|start & register| SERVER

    PROGRESS -->|save/get_progress| DB
    FAVORITES -->|save/remove_favorite| DB
    CACHE -->|invalidate/cleanup| DB

    DIAG -->|collect_diagnostics| DIAGNOSTICS
    DIAG -->|gather state| APPSTATE

    %% Business logic module interactions
    DATABASE_MOD -->|run_migrations| MIGRATIONS
    DATABASE_MOD -->|log errors| ERROR_LOG
    DATABASE_MOD -->|log security events| SEC_LOG

    GATEWAY_MOD -->|HTTP requests| EXTERNAL[External APIs]
    GATEWAY_MOD -->|failover logic| GATEWAY_MOD
    GATEWAY_MOD -->|log errors| ERROR_LOG

    DOWNLOAD_MOD -->|file operations| PATH_SEC
    DOWNLOAD_MOD -->|encryption| ENCRYPTION
    DOWNLOAD_MOD -->|log errors| ERROR_LOG

    SERVER_MOD -->|serve files| PATH_SEC
    SERVER_MOD -->|decrypt on-the-fly| ENCRYPTION

    %% Infrastructure dependencies
    LOGGING -->|file rotation| PATH_SEC
    ERROR_LOG -->|structured logging| LOGGING
    SEC_LOG -->|structured logging| LOGGING
    CRASH -->|file operations| PATH_SEC

    %% Security validation
    VALIDATION -->|error types| ERROR
    SANITIZATION -->|error types| ERROR
    PATH_SEC -->|validate paths| VALIDATION

    %% Data models
    MODELS -->|ContentItem| COMMANDS
    MODELS -->|ProgressData| COMMANDS
    MODELS -->|FavoriteItem| COMMANDS
    MODELS -->|OdyseeRequest| GATEWAY_MOD
    MODELS -->|OdyseeResponse| GATEWAY_MOD

    style MAIN fill:#ff6b6b
    style APPSTATE fill:#4ecdc4
    style COMMANDS fill:#45b7d1
    style DB fill:#96ceb4
    style GATEWAY fill:#96ceb4
    style DOWNLOAD fill:#96ceb4
    style SERVER fill:#96ceb4
```

## 2. Data Flow Diagram: Content Fetching Pipeline

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant CMD as commands.rs
    participant VAL as validation.rs
    participant DB as Database
    participant GW as GatewayClient
    participant API as Odysee API
    participant PARSE as parse_claim_search_response

    FE->>CMD: fetch_channel_claims(channel_id, tags, ...)
    
    Note over CMD: 🔍 STEP 1: Input Validation
    CMD->>VAL: validate_channel_id(channel_id)
    VAL-->>CMD: validated_channel_id
    CMD->>VAL: validate_tags(tags)
    VAL-->>CMD: validated_tags
    
    Note over CMD: 🔍 STEP 2: Cache Check
    CMD->>DB: get_cached_content(query)
    DB-->>CMD: cached_items
    
    alt Cache Hit (items.len() > 0)
        CMD-->>FE: Return cached_items
    else Cache Miss or Force Refresh
        Note over CMD: 🔍 STEP 3: Remote Fetch
        CMD->>GW: fetch_with_failover(request)
        
        loop Failover Attempts
            GW->>API: POST /api/v1/proxy (claim_search)
            API-->>GW: OdyseeResponse
            
            alt Success
                Note over GW: Break loop
            else Failure
                Note over GW: Try next gateway
            end
        end
        
        GW-->>CMD: OdyseeResponse
        
        Note over CMD: 🔍 STEP 4: Parse Response
        CMD->>PARSE: parse_claim_search_response(response)
        
        loop For each item in response.data.items
            PARSE->>PARSE: extract_claim_id(item)
            PARSE->>PARSE: extract_title(item)
            PARSE->>PARSE: extract_video_urls(item)
            PARSE->>PARSE: build_cdn_playback_url(claim_id)
            PARSE->>PARSE: assess_compatibility(video_urls)
        end
        
        PARSE-->>CMD: Vec<ContentItem>
        
        Note over CMD: 🔍 STEP 5: Store in Cache
        CMD->>DB: store_content_items(items)
        DB-->>CMD: Ok(())
        
        CMD-->>FE: Return items
    end
```

## 3. Initialization Sequence Diagram

```mermaid
sequenceDiagram
    participant OS as Operating System
    participant MAIN as main()
    participant LOG as logging::init_logging()
    participant CRASH as crash_reporting::init()
    participant INIT as initialize_app_state()
    participant DB as Database::new()
    participant GW as GatewayClient::new()
    participant DL as DownloadManager::new()
    participant SRV as LocalServer::new()
    participant TAURI as Tauri Builder
    participant SETUP as setup hook

    OS->>MAIN: Start application
    
    Note over MAIN: === PHASE 1: Logging Setup ===
    MAIN->>LOG: Initialize logging system
    LOG->>LOG: Create log directory
    LOG->>LOG: Configure file rotation
    LOG->>LOG: Set log level from env
    LOG-->>MAIN: Ok() or continue without logging
    
    Note over MAIN: === PHASE 2: Crash Reporting ===
    MAIN->>CRASH: init_crash_reporting(app_data_path)
    CRASH->>CRASH: Create crash log directory
    CRASH->>CRASH: Set panic hook
    CRASH-->>MAIN: Ok()
    
    Note over MAIN: === PHASE 3: Emergency Disable Check ===
    Note over MAIN: ⚠️ CURRENTLY SKIPPED FOR DEBUGGING
    
    Note over MAIN: === PHASE 4: App State Initialization ===
    MAIN->>INIT: initialize_app_state()
    
    INIT->>DB: Database::new()
    DB->>DB: Get app data directory
    DB->>DB: Create database file if not exists
    DB->>DB: Create connection pool
    DB->>DB: Create base schema (tables)
    Note over DB: ⚠️ Migrations NOT run here
    DB-->>INIT: Database instance
    
    INIT->>GW: GatewayClient::new()
    GW->>GW: Initialize gateway list
    GW->>GW: Set current gateway index
    GW->>GW: Create HTTP client
    GW-->>INIT: GatewayClient instance
    
    INIT->>DL: DownloadManager::new()
    DL->>DL: Get vault directory path
    DL->>DL: Create vault directory
    DL->>DL: Initialize download state
    DL-->>INIT: DownloadManager instance
    
    INIT->>SRV: LocalServer::new()
    SRV->>SRV: Initialize server state
    SRV->>SRV: Create content registry
    SRV-->>INIT: LocalServer instance
    
    INIT->>INIT: Wrap in Arc<Mutex<>>
    INIT-->>MAIN: AppState
    
    Note over MAIN: === PHASE 5: Tauri Builder ===
    MAIN->>TAURI: tauri::Builder::default()
    MAIN->>TAURI: .manage(app_state)
    MAIN->>TAURI: .invoke_handler(commands)
    MAIN->>TAURI: .setup(setup_hook)
    
    Note over MAIN: === PHASE 6: Setup Hook ===
    TAURI->>SETUP: Execute setup hook
    Note over SETUP: ⚠️ Migrations SKIPPED for debugging
    Note over SETUP: Normal flow: run_startup_migrations()
    SETUP-->>TAURI: Ok()
    
    Note over MAIN: === PHASE 7: Run Application ===
    TAURI->>TAURI: .run(context)
    TAURI-->>OS: Application running
```

## 4. Database Migration Flow

```mermaid
flowchart TD
    START([Application Startup]) --> INIT[initialize_app_state]
    INIT --> DB_NEW[Database::new]
    
    DB_NEW --> GET_PATH[Get app data directory]
    GET_PATH --> CREATE_FILE{Database file exists?}
    CREATE_FILE -->|No| CREATE[Create database file]
    CREATE_FILE -->|Yes| POOL
    CREATE --> POOL[Create connection pool]
    
    POOL --> BASE_SCHEMA[Create base schema]
    BASE_SCHEMA --> TABLES[Create tables if not exist]
    TABLES --> RETURN_DB[Return Database instance]
    
    RETURN_DB --> SETUP_HOOK[Tauri setup hook]
    SETUP_HOOK --> MIGRATIONS{Run migrations?}
    
    MIGRATIONS -->|Currently Skipped| SKIP[Skip migrations for debugging]
    MIGRATIONS -->|Normal Flow| RUN_MIG[run_startup_migrations]
    
    RUN_MIG --> LOCK[Lock database]
    LOCK --> GET_MIGS[Get pending migrations]
    GET_MIGS --> CHECK_APPLIED{Migration applied?}
    
    CHECK_APPLIED -->|Yes| NEXT_MIG{More migrations?}
    CHECK_APPLIED -->|No| APPLY[Apply migration]
    
    APPLY --> RECORD[Record in migrations table]
    RECORD --> NEXT_MIG
    
    NEXT_MIG -->|Yes| GET_MIGS
    NEXT_MIG -->|No| COMPLETE[Migrations complete]
    
    SKIP --> APP_READY
    COMPLETE --> APP_READY[Application ready]
    
    style START fill:#ff6b6b
    style APP_READY fill:#51cf66
    style MIGRATIONS fill:#ffd43b
    style SKIP fill:#ff8787
```

## 5. Content Download Flow

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant CMD as download_movie_quality
    participant VAL as validation.rs
    participant DB as Database
    participant DM as DownloadManager
    participant ENC as encryption.rs
    participant FS as File System
    participant HTTP as HTTP Client

    FE->>CMD: download_movie_quality(claim_id, quality, url)
    
    Note over CMD: Validate inputs
    CMD->>VAL: validate_claim_id(claim_id)
    VAL-->>CMD: validated_claim_id
    CMD->>VAL: validate_quality(quality)
    VAL-->>CMD: validated_quality
    CMD->>VAL: validate_download_url(url)
    VAL-->>CMD: validated_url
    
    Note over CMD: Check encryption setting
    CMD->>DB: get_setting("encrypt_downloads")
    DB-->>CMD: encrypt = true/false
    
    CMD->>DM: download_content(request, app_handle, encrypt)
    
    Note over DM: Create download request
    DM->>DM: Generate temp file path
    DM->>DM: Create download state
    
    Note over DM: Download file
    DM->>HTTP: GET url (with resume support)
    
    loop Download chunks
        HTTP-->>DM: Chunk data
        DM->>FS: Write chunk to temp file
        DM->>FE: Emit progress event
    end
    
    HTTP-->>DM: Download complete
    
    alt Encryption enabled
        Note over DM: Encrypt downloaded file
        DM->>ENC: encrypt_file(temp_path, final_path)
        ENC->>ENC: Generate encryption key
        ENC->>ENC: Encrypt file chunks
        ENC->>FS: Write encrypted file
        ENC-->>DM: Encrypted file path
    else No encryption
        DM->>FS: Move temp file to final path
    end
    
    Note over DM: Create metadata
    DM->>DM: Create OfflineMetadata
    DM-->>CMD: OfflineMetadata
    
    Note over CMD: Store metadata
    CMD->>DB: save_offline_metadata(metadata)
    DB-->>CMD: Ok()
    
    CMD->>FE: Emit download-complete event
    CMD-->>FE: Ok()
    
    Note over CMD,FE: Error handling
    alt Download fails
        DM->>DM: cleanup_failed_download()
        DM->>FS: Delete partial files
        CMD->>FE: Emit download-error event
        CMD-->>FE: Err(KiyyaError)
    end
```

## 6. Offline Streaming Flow

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant CMD as stream_offline
    participant VAL as validation.rs
    participant DB as Database
    participant DM as DownloadManager
    participant SRV as LocalServer
    participant ENC as encryption.rs
    participant PLAYER as Video Player

    FE->>CMD: stream_offline(claim_id, quality)
    
    CMD->>VAL: validate_claim_id(claim_id)
    VAL-->>CMD: validated_claim_id
    CMD->>VAL: validate_quality(quality)
    VAL-->>CMD: validated_quality
    
    Note over CMD: Get offline metadata
    CMD->>DB: get_offline_metadata(claim_id, quality)
    DB-->>CMD: OfflineMetadata
    
    Note over CMD: Get file path
    CMD->>DM: get_content_path(filename)
    DM-->>CMD: file_path
    
    Note over CMD: Start local server
    CMD->>SRV: start()
    
    alt Server not running
        SRV->>SRV: Bind to 127.0.0.1:0
        SRV->>SRV: Start HTTP server
        SRV-->>CMD: port
    else Server already running
        SRV-->>CMD: existing port
    end
    
    Note over CMD: Register content
    CMD->>SRV: register_content(uuid, file_path, encrypted)
    SRV->>SRV: Store in content registry
    SRV-->>CMD: Ok()
    
    Note over CMD: Build streaming URL
    CMD->>CMD: format!("http://127.0.0.1:{}/movies/{}", port, uuid)
    
    CMD->>FE: Emit local-server-started event
    CMD-->>FE: StreamOfflineResponse { url, port }
    
    Note over FE,PLAYER: Player requests content
    PLAYER->>SRV: GET /movies/{uuid}
    
    SRV->>SRV: Lookup uuid in registry
    SRV->>SRV: Get file_path and encrypted flag
    
    alt File is encrypted
        SRV->>ENC: decrypt_stream(file_path)
        
        loop Stream chunks
            ENC->>ENC: Read encrypted chunk
            ENC->>ENC: Decrypt chunk
            ENC-->>SRV: Decrypted chunk
            SRV-->>PLAYER: Send chunk
        end
    else File not encrypted
        loop Stream chunks
            SRV->>FS: Read chunk
            FS-->>SRV: Chunk data
            SRV-->>PLAYER: Send chunk
        end
    end
    
    SRV-->>PLAYER: Complete response
```

## 7. Error Handling and Logging Flow

```mermaid
flowchart TD
    START([Operation Start]) --> TRY{Try operation}
    
    TRY -->|Success| LOG_INFO[Log at INFO/DEBUG level]
    TRY -->|Error| CLASSIFY[Classify error type]
    
    CLASSIFY --> CHECK_TYPE{Error type?}
    
    CHECK_TYPE -->|Network Error| NET_ERR[KiyyaError::Network]
    CHECK_TYPE -->|Parse Error| PARSE_ERR[KiyyaError::ContentParsing]
    CHECK_TYPE -->|Validation Error| VAL_ERR[KiyyaError::Validation]
    CHECK_TYPE -->|IO Error| IO_ERR[KiyyaError::Io]
    CHECK_TYPE -->|Database Error| DB_ERR[KiyyaError::Database]
    
    NET_ERR --> LOG_ERROR[Log at ERROR level]
    PARSE_ERR --> LOG_WARN[Log at WARN level]
    VAL_ERR --> LOG_WARN
    IO_ERR --> LOG_ERROR
    DB_ERR --> LOG_ERROR
    
    LOG_ERROR --> STRUCT_LOG[Structured logging]
    LOG_WARN --> STRUCT_LOG
    LOG_INFO --> STRUCT_LOG
    
    STRUCT_LOG --> FIELDS[Include fields:<br/>- timestamp<br/>- level<br/>- component<br/>- claim_id<br/>- message]
    
    FIELDS --> ERROR_LOG{Error logging enabled?}
    
    ERROR_LOG -->|Yes| PERSIST[Persist to error_logs table]
    ERROR_LOG -->|No| SKIP_PERSIST[Skip persistence]
    
    PERSIST --> SEC_CHECK{Security event?}
    SKIP_PERSIST --> SEC_CHECK
    
    SEC_CHECK -->|Yes| SEC_LOG[Log to security_logs]
    SEC_CHECK -->|No| RETURN
    
    SEC_LOG --> RETURN[Return result to caller]
    
    style START fill:#ff6b6b
    style RETURN fill:#51cf66
    style LOG_ERROR fill:#ff8787
    style LOG_WARN fill:#ffd43b
    style LOG_INFO fill:#69db7c
```

## 8. Gateway Failover Strategy

```mermaid
stateDiagram-v2
    [*] --> Primary: Initialize
    
    Primary --> Requesting: Send request
    Requesting --> Success: HTTP 200
    Requesting --> Timeout: Timeout (10s)
    Requesting --> ServerError: HTTP 5xx
    Requesting --> ClientError: HTTP 4xx
    
    Success --> [*]: Return response
    
    ClientError --> [*]: Return error<br/>(no retry)
    
    Timeout --> Secondary: Failover
    ServerError --> Secondary: Failover
    
    Secondary --> RequestingSecondary: Send request
    RequestingSecondary --> Success2: HTTP 200
    RequestingSecondary --> Timeout2: Timeout (10s)
    RequestingSecondary --> ServerError2: HTTP 5xx
    
    Success2 --> [*]: Return response
    
    Timeout2 --> Tertiary: Failover
    ServerError2 --> Tertiary: Failover
    
    Tertiary --> RequestingTertiary: Send request
    RequestingTertiary --> Success3: HTTP 200
    RequestingTertiary --> FinalError: Any error
    
    Success3 --> [*]: Return response
    FinalError --> [*]: Return error<br/>(all gateways failed)
    
    note right of Primary
        Gateway 1:
        api.na-backend.odysee.com
    end note
    
    note right of Secondary
        Gateway 2:
        api.lbry.tv
    end note
    
    note right of Tertiary
        Gateway 3:
        api.odysee.com
    end note
```

## 9. Cache Management Flow

```mermaid
flowchart TD
    START([Cache Operation]) --> OP_TYPE{Operation type?}
    
    OP_TYPE -->|Get| GET_CACHE[get_cached_content]
    OP_TYPE -->|Store| STORE_CACHE[store_content_items]
    OP_TYPE -->|Invalidate| INVALIDATE[invalidate_cache_item]
    OP_TYPE -->|Cleanup| CLEANUP[cleanup_expired_cache]
    
    GET_CACHE --> BUILD_QUERY[Build CacheQuery]
    BUILD_QUERY --> QUERY_DB[Query content_cache table]
    QUERY_DB --> CHECK_TTL{Within TTL?}
    
    CHECK_TTL -->|Yes| RETURN_ITEMS[Return cached items]
    CHECK_TTL -->|No| CACHE_MISS[Cache miss]
    
    STORE_CACHE --> COMPUTE_HASH[Compute content hash]
    COMPUTE_HASH --> CHECK_EXISTS{Item exists?}
    
    CHECK_EXISTS -->|Yes| UPDATE[UPDATE content_cache]
    CHECK_EXISTS -->|No| INSERT[INSERT INTO content_cache]
    
    UPDATE --> CHECK_LIMIT
    INSERT --> CHECK_LIMIT[Check cache size limit]
    
    CHECK_LIMIT --> OVER_LIMIT{Over max_cache_items?}
    OVER_LIMIT -->|Yes| EVICT[Evict oldest items]
    OVER_LIMIT -->|No| DONE
    
    EVICT --> DONE[Cache operation complete]
    
    INVALIDATE --> DELETE_ITEM[DELETE FROM content_cache]
    DELETE_ITEM --> DONE
    
    CLEANUP --> FIND_EXPIRED[Find items past TTL]
    FIND_EXPIRED --> DELETE_EXPIRED[DELETE expired items]
    DELETE_EXPIRED --> VACUUM[VACUUM database]
    VACUUM --> DONE
    
    RETURN_ITEMS --> END([Return])
    CACHE_MISS --> END
    DONE --> END
    
    style START fill:#ff6b6b
    style END fill:#51cf66
    style CACHE_MISS fill:#ffd43b
```

## 10. Module Dependency Graph

```mermaid
graph LR
    subgraph "Layer 1: Entry Point"
        MAIN[main.rs]
    end
    
    subgraph "Layer 2: Command Interface"
        COMMANDS[commands.rs]
    end
    
    subgraph "Layer 3: Business Logic"
        DATABASE[database.rs]
        GATEWAY[gateway.rs]
        DOWNLOAD[download.rs]
        SERVER[server.rs]
    end
    
    subgraph "Layer 4: Support Services"
        ENCRYPTION[encryption.rs]
        MIGRATIONS[migrations.rs]
        VALIDATION[validation.rs]
        SANITIZATION[sanitization.rs]
    end
    
    subgraph "Layer 5: Infrastructure"
        LOGGING[logging.rs]
        ERROR_LOG[error_logging.rs]
        SEC_LOG[security_logging.rs]
        CRASH[crash_reporting.rs]
        DIAGNOSTICS[diagnostics.rs]
        PATH_SEC[path_security.rs]
    end
    
    subgraph "Layer 6: Foundation"
        ERROR[error.rs]
        MODELS[models.rs]
    end
    
    MAIN --> COMMANDS
    MAIN --> LOGGING
    MAIN --> CRASH
    
    COMMANDS --> DATABASE
    COMMANDS --> GATEWAY
    COMMANDS --> DOWNLOAD
    COMMANDS --> SERVER
    COMMANDS --> VALIDATION
    COMMANDS --> SANITIZATION
    COMMANDS --> DIAGNOSTICS
    
    DATABASE --> MIGRATIONS
    DATABASE --> ERROR_LOG
    DATABASE --> SEC_LOG
    DATABASE --> PATH_SEC
    
    DOWNLOAD --> ENCRYPTION
    DOWNLOAD --> PATH_SEC
    DOWNLOAD --> ERROR_LOG
    
    SERVER --> ENCRYPTION
    SERVER --> PATH_SEC
    
    GATEWAY --> ERROR_LOG
    
    LOGGING --> PATH_SEC
    ERROR_LOG --> LOGGING
    SEC_LOG --> LOGGING
    CRASH --> PATH_SEC
    
    VALIDATION --> ERROR
    SANITIZATION --> ERROR
    DATABASE --> ERROR
    GATEWAY --> ERROR
    DOWNLOAD --> ERROR
    SERVER --> ERROR
    
    COMMANDS --> MODELS
    DATABASE --> MODELS
    GATEWAY --> MODELS
    DOWNLOAD --> MODELS
    
    style MAIN fill:#ff6b6b
    style COMMANDS fill:#45b7d1
    style ERROR fill:#ffd43b
    style MODELS fill:#ffd43b
```

## Summary

These diagrams provide a comprehensive view of the Kiyya Desktop backend architecture:

1. **Module Interaction Diagram**: Shows how all backend modules connect and depend on each other
2. **Data Flow Diagram**: Illustrates the complete content fetching pipeline from frontend to API
3. **Initialization Sequence**: Details the exact startup sequence and component initialization order
4. **Database Migration Flow**: Shows the migration execution strategy and idempotency checks
5. **Content Download Flow**: Demonstrates the download process with encryption and error handling
6. **Offline Streaming Flow**: Shows how local server streams encrypted/unencrypted content
7. **Error Handling Flow**: Illustrates the error classification and logging strategy
8. **Gateway Failover Strategy**: Shows the multi-gateway failover state machine
9. **Cache Management Flow**: Details cache operations and TTL-based expiration
10. **Module Dependency Graph**: Shows the layered architecture and dependency hierarchy

These diagrams accurately reflect the current implementation as of the codebase stabilization audit.
