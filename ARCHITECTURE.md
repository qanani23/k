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
    Main[main.rs<br/>Entry Point]
    
    Main --> Commands[commands.rs<br/>Tauri Commands]
    Main --> Database[database.rs<br/>DB Manager]
    Main --> Server[server.rs<br/>HTTP Server]
    
    Commands --> Gateway[gateway.rs<br/>API Client]
    Commands --> Download[download.rs<br/>Download Manager]
    Commands --> Models[models.rs<br/>Data Models]
    
    Gateway --> Error[error.rs<br/>Error Types]
    Download --> Encryption[encryption.rs<br/>AES-GCM]
    Download --> PathSecurity[path_security.rs<br/>Path Validation]
    
    Database --> Migrations[migrations.rs<br/>Schema Migrations]
    Database --> Validation[validation.rs<br/>Input Validation]
    
    Server --> Encryption
    Server --> PathSecurity
    
    Commands --> Logging[logging.rs<br/>Log Management]
    Commands --> Diagnostics[diagnostics.rs<br/>Health Checks]
    
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
```

### Database Schema Details

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
│   │   ├── commands.rs           # Tauri commands
│   │   ├── gateway.rs            # API client
│   │   ├── database.rs           # SQLite manager
│   │   ├── download.rs           # Download manager
│   │   ├── server.rs             # Local HTTP server
│   │   └── encryption.rs         # Crypto operations
│   ├── Cargo.toml                # Rust dependencies
│   └── tauri.conf.json           # Tauri configuration
├── tests/                        # Test suites
│   ├── unit/                     # Unit tests
│   ├── property/                 # Property-based tests
│   └── e2e/                      # End-to-end tests
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

Key architectural strengths:
- **Resilient**: Gateway failover and defensive error handling
- **Secure**: Restricted network/filesystem access with optional encryption
- **Performant**: Efficient caching and lazy loading strategies
- **Testable**: Comprehensive test coverage with property-based testing
- **Maintainable**: Clear component boundaries and separation of concerns

For implementation details, refer to:
- **Requirements**: `.kiro/specs/kiyya-desktop-streaming/requirements.md`
- **Design**: `.kiro/specs/kiyya-desktop-streaming/design.md`
- **Tasks**: `.kiro/specs/kiyya-desktop-streaming/tasks.md`
