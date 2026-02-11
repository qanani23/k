# Requirements Document

## Introduction

Kiyya is a desktop streaming application that provides access to content from a single Odysee channel. Built with Tauri (Rust backend) and React + TypeScript frontend, it offers local content management, offline playback, and a cinematic user experience with glass-aurora design aesthetics.

## Glossary

- **System**: The Kiyya desktop application
- **Content_Manager**: Component responsible for fetching and caching content metadata
- **Download_Manager**: Component handling video downloads and local storage
- **Player**: Video playback component with quality selection
- **Local_Server**: HTTP server for streaming offline content
- **Gateway_Client**: Component managing multiple Odysee API endpoints
- **Update_Manager**: Component handling application updates
- **Cache_Manager**: Local SQLite database management system
- **Series_Manager**: Component handling series organization and playlist management
- **Search_Engine**: Local and remote content search functionality

## Requirements

### Requirement 1: Content Discovery and Management

**User Story:** As a user, I want to discover and browse content from the configured Odysee channel, so that I can find videos to watch.

#### Acceptance Criteria

1. WHEN the application starts, THE Content_Manager SHALL fetch content from the configured Odysee channel using hard-coded channel ID
2. THE System SHALL organize content by categories (movies, series, sitcoms, kids) based on content tags
3. WHEN content is fetched, THE Cache_Manager SHALL store metadata locally with 30-minute TTL
4. THE System SHALL display content in category-based rows with poster thumbnails
5. WHEN content metadata is missing or malformed, THE Content_Manager SHALL handle gracefully and log for debugging
6. THE System SHALL support pagination for large content collections with configurable page sizes

### Requirement 2: Series and Playlist Management

**User Story:** As a user, I want to watch series content organized by seasons and episodes, so that I can follow storylines in order.

#### Acceptance Criteria

1. WHEN series content is detected, THE Series_Manager SHALL organize episodes by season using playlist data
2. THE Series_Manager SHALL parse episode titles following "SeriesName S01E01 - Episode Title" format
3. WHEN playlists are available, THE Series_Manager SHALL use playlist order as canonical episode ordering
4. IF playlists are missing, THE Series_Manager SHALL fallback to parsing season/episode numbers from titles
5. THE System SHALL display seasons in expandable sections with episode lists
6. WHEN playlist data is incomplete, THE System SHALL show "Seasons inferred automatically" notice

### Requirement 3: Video Playback and Quality Management

**User Story:** As a user, I want to play videos with appropriate quality selection and smooth playback, so that I can enjoy content without interruption.

#### Acceptance Criteria

1. WHEN a video is selected for playback, THE Player SHALL resolve claim data to obtain streaming URLs
2. THE Player SHALL select initial quality based on network connection speed and user preferences
3. WHEN buffering occurs repeatedly, THE Player SHALL automatically downgrade quality and notify user
4. THE Player SHALL support manual quality selection with available options (480p, 720p, 1080p)
5. THE Player SHALL handle HLS streams using hls.js when native support is unavailable
6. WHEN codec compatibility issues exist, THE Player SHALL display compatibility warnings
7. THE Player SHALL save playback progress every 20-30 seconds for resume functionality

### Requirement 4: Download and Offline Playback

**User Story:** As a user, I want to download videos for offline viewing, so that I can watch content without internet connection.

#### Acceptance Criteria

1. WHEN a download is initiated, THE Download_Manager SHALL check available disk space before starting
2. THE Download_Manager SHALL support resumable downloads using HTTP Range headers
3. WHEN downloads complete, THE Download_Manager SHALL optionally encrypt files using AES-GCM
4. THE Download_Manager SHALL emit progress events during download operations
5. THE Local_Server SHALL serve downloaded content via HTTP with Range header support
6. THE Local_Server SHALL decrypt content on-the-fly for encrypted downloads
7. WHEN offline, THE System SHALL allow playback of downloaded content only

### Requirement 5: Search and Content Discovery

**User Story:** As a user, I want to search for specific content, so that I can quickly find videos I'm interested in.

#### Acceptance Criteria

1. WHEN a search query is entered, THE Search_Engine SHALL first query local cache
2. THE Search_Engine SHALL normalize search queries to handle season/episode variations
3. IF local results are insufficient, THE Search_Engine SHALL query remote Odysee API
4. WHEN no search results are found, THE Search_Engine SHALL suggest recent uploads as alternatives
5. THE Search_Engine SHALL support text search across titles and descriptions
6. THE System SHALL sanitize all search input to prevent SQL injection

### Requirement 6: Gateway Failover and Network Resilience

**User Story:** As a system administrator, I want the application to handle API gateway failures gracefully, so that users can continue using the app when primary endpoints are down.

#### Acceptance Criteria

1. THE Gateway_Client SHALL maintain a prioritized list of Odysee API endpoints
2. WHEN a gateway request fails, THE Gateway_Client SHALL retry with the next available gateway
3. THE Gateway_Client SHALL implement exponential backoff with jitter between retry attempts
4. THE Gateway_Client SHALL log gateway failures and successful failovers for diagnostics
5. THE System SHALL continue functioning when primary gateway is unavailable
6. THE Gateway_Client SHALL limit retry attempts to prevent infinite loops

### Requirement 7: Local Data Management and Caching

**User Story:** As a user, I want my preferences and viewing history to be saved locally, so that I can resume where I left off.

#### Acceptance Criteria

1. THE Cache_Manager SHALL store content metadata in local SQLite database
2. THE Cache_Manager SHALL implement database migrations for schema updates
3. THE System SHALL save user favorites with metadata and timestamps
4. THE System SHALL track video playback progress with position and quality information
5. THE Cache_Manager SHALL maintain offline content metadata for downloaded videos
6. THE System SHALL implement TTL-based cache invalidation with configurable timeouts

### Requirement 8: Application Updates and Version Management

**User Story:** As a user, I want to receive application updates, so that I can access new features and security improvements.

#### Acceptance Criteria

1. WHEN the application starts, THE Update_Manager SHALL check for available updates
2. THE Update_Manager SHALL compare current version with minimum supported version
3. IF current version is below minimum supported, THE System SHALL display forced update screen
4. IF optional update is available, THE System SHALL show dismissible update notification
5. THE Update_Manager SHALL open external browser for update downloads
6. THE System SHALL not perform automatic downloads or installations

### Requirement 9: User Interface and Accessibility

**User Story:** As a user, I want an accessible and visually appealing interface, so that I can easily navigate and use the application.

#### Acceptance Criteria

1. THE System SHALL implement glass-aurora design with dark theme as default
2. THE System SHALL support both dark and light themes with user preference storage
3. THE System SHALL provide keyboard navigation for all interactive elements
4. THE System SHALL include proper ARIA labels and roles for screen readers
5. WHEN prefers-reduced-motion is set, THE System SHALL disable all animations
6. THE System SHALL use Inter font as primary typography
7. THE System SHALL maintain proper color contrast ratios for accessibility

### Requirement 10: Hero Section and Content Promotion

**User Story:** As a user, I want to see featured content prominently displayed, so that I can discover highlighted videos.

#### Acceptance Criteria

1. WHEN the application loads, THE System SHALL fetch content tagged with "hero_trailer"
2. THE System SHALL randomly select one hero video per application session
3. THE System SHALL attempt autoplay of hero video with muted audio
4. IF autoplay fails, THE System SHALL display poster thumbnail with play button
5. THE System SHALL provide "Add to Favorites" and "Play" actions for hero content
6. THE System SHALL cache hero content selection for the current session

### Requirement 11: Error Handling and Diagnostics

**User Story:** As a developer, I want comprehensive error handling and logging, so that I can diagnose and fix issues.

#### Acceptance Criteria

1. THE System SHALL log all API errors with gateway information and timestamps
2. THE System SHALL handle missing or malformed content metadata gracefully
3. THE System SHALL provide diagnostic information including gateway health and database status
4. THE System SHALL rotate log files by size and maintain historical logs
5. WHEN critical errors occur, THE System SHALL display user-friendly error messages
6. THE System SHALL provide debug information collection for support purposes

### Requirement 12: Security and Privacy

**User Story:** As a user, I want my data to be secure and my privacy protected, so that I can use the application safely.

#### Acceptance Criteria

1. THE System SHALL restrict network access to approved Odysee domains only
2. THE System SHALL limit file system access to application data folder
3. THE System SHALL not embed API tokens or secrets in the application
4. WHEN encryption is enabled, THE System SHALL use secure key management practices
5. THE System SHALL not collect or transmit personal user data
6. THE System SHALL provide clear warnings about data loss risks with encryption

### Requirement 13: Performance and Resource Management

**User Story:** As a user, I want the application to perform efficiently, so that it doesn't impact my system performance.

#### Acceptance Criteria

1. THE System SHALL limit initial cache to 100-200 content items
2. THE System SHALL implement lazy loading for content rows and images
3. THE System SHALL use requestIdleCallback for non-critical background operations
4. THE System SHALL not preload large video files automatically
5. THE System SHALL implement efficient database queries with proper indexing
6. THE System SHALL manage memory usage during video streaming operations

### Requirement 14: Content Parsing and Validation

**User Story:** As a system, I want to parse content metadata reliably, so that content is displayed correctly regardless of API variations.

#### Acceptance Criteria

1. THE Content_Manager SHALL implement defensive parsing for all Odysee API responses
2. THE Content_Manager SHALL extract thumbnails from multiple possible field locations
3. THE Content_Manager SHALL extract video URLs and map to quality levels
4. WHEN content parsing fails, THE Content_Manager SHALL return clear error objects
5. THE Content_Manager SHALL log raw claim data for debugging when parsing fails
6. THE Content_Manager SHALL handle HLS streams and codec variations appropriately

### Requirement 15: Tauri Command Interface

**User Story:** As a frontend developer, I want a well-defined command interface to the Rust backend, so that I can reliably interact with system functionality.

#### Acceptance Criteria

1. THE System SHALL implement `fetch_channel_claims` command accepting `any_tags`, `text`, `limit`, and `page` parameters
2. THE System SHALL implement `fetch_playlists` command returning playlist metadata for the configured channel
3. THE System SHALL implement `resolve_claim` command accepting `claimIdOrUri` and returning streaming metadata
4. THE System SHALL implement `download_movie_quality` command accepting `claimId`, `quality`, and `url` parameters
5. THE System SHALL implement `stream_offline` command accepting `claimId` and `quality` for local playback
6. THE System SHALL implement `delete_offline` command for removing downloaded content
7. THE System SHALL implement `save_progress` and `get_progress` commands for playback state management
8. THE System SHALL implement `get_app_config` command returning application settings and diagnostics
9. THE System SHALL emit events for `download-progress`, `download-complete`, `download-error`, and `local-server-started`

### Requirement 16: Gateway Failover System

**User Story:** As a system administrator, I want robust gateway failover with detailed logging, so that the application remains functional when individual gateways fail.

#### Acceptance Criteria

1. THE Gateway_Client SHALL maintain exactly three prioritized Odysee gateways in configuration
2. THE Gateway_Client SHALL implement maximum 3 gateway attempts per request
3. THE Gateway_Client SHALL use exponential backoff starting at 300ms with jitter between attempts
4. THE Gateway_Client SHALL log gateway URL, error code, and response time for each attempt
5. THE Gateway_Client SHALL write gateway failures to dedicated `gateway.log` file
6. THE Gateway_Client SHALL return successful gateway information to frontend for diagnostics
7. THE Gateway_Client SHALL allow dynamic gateway reordering through Settings interface

### Requirement 17: Local HTTP Server with Range Support

**User Story:** As a user, I want smooth video seeking in offline content, so that I can navigate through downloaded videos efficiently.

#### Acceptance Criteria

1. THE Local_Server SHALL bind to `127.0.0.1:0` and return the assigned port number
2. THE Local_Server SHALL parse HTTP Range headers in format `bytes=start-end`
3. THE Local_Server SHALL return 206 Partial Content responses with correct `Content-Range` headers
4. THE Local_Server SHALL set `Accept-Ranges: bytes` header for all video responses
5. THE Local_Server SHALL support concurrent client connections for the same content
6. THE Local_Server SHALL decrypt encrypted content on-the-fly without writing decrypted files to disk
7. THE Local_Server SHALL return 416 Range Not Satisfiable for invalid range requests
8. THE Local_Server SHALL serve endpoints in format `/movies/<uuid>` for downloaded content

### Requirement 18: Video Player Compatibility and Codec Handling

**User Story:** As a user, I want videos to play correctly across different platforms, so that I can watch content regardless of my operating system.

#### Acceptance Criteria

1. THE Player SHALL detect HLS stream support using `MediaSource` API availability
2. THE Player SHALL integrate hls.js library when native HLS support is unavailable
3. THE Player SHALL test MP4 codec compatibility using `canPlayType` with H.264/AAC codecs
4. THE Player SHALL set compatibility flags for each resolved claim based on available streams
5. WHEN content is incompatible, THE Player SHALL display "This video may not play on your platform" message
6. THE Player SHALL provide fallback option to "Play via external player" for incompatible content
7. THE Player SHALL prioritize MP4 streams over HLS when both are available and compatible

### Requirement 19: Application Update System with Version Management

**User Story:** As a user, I want to receive timely application updates with clear update requirements, so that I can maintain security and access new features.

#### Acceptance Criteria

1. THE Update_Manager SHALL fetch version manifest from `VITE_UPDATE_MANIFEST_URL` at startup
2. THE Update_Manager SHALL parse version.json containing `latestVersion`, `minSupportedVersion`, `releaseNotes`, and `downloadUrl`
3. THE Update_Manager SHALL compare versions using semantic versioning rules
4. WHEN current version is below `minSupportedVersion`, THE System SHALL display full-screen forced update modal
5. THE forced update modal SHALL provide only "Update" and "Exit" buttons with no dismissal option
6. WHEN optional update is available, THE System SHALL show dismissible notification with 24-hour defer option
7. THE Update_Manager SHALL open `downloadUrl` in external browser when user chooses to update
8. THE System SHALL continue normal operation if version manifest fetch fails

### Requirement 20: Database Migration System and Schema Versioning

**User Story:** As a developer, I want safe database schema evolution, so that user data is preserved during application updates.

#### Acceptance Criteria

1. THE Cache_Manager SHALL implement numbered migration files in `migrations/` directory
2. THE Cache_Manager SHALL maintain `migrations` table tracking applied migration versions
3. THE Cache_Manager SHALL execute pending migrations in sequential order within transactions
4. THE Cache_Manager SHALL rollback failed migrations and log detailed error information
5. THE Cache_Manager SHALL create database indices for `titleLower`, `tags`, and `updatedAt` columns
6. THE Cache_Manager SHALL add new columns as nullable when possible for backward compatibility
7. THE Cache_Manager SHALL provide migration testing with sample older database files

### Requirement 21: Download Safety and Resumable Operations

**User Story:** As a user, I want safe and resumable downloads, so that I don't lose progress or fill up my disk space.

#### Acceptance Criteria

1. THE Download_Manager SHALL check available disk space before starting any download
2. THE Download_Manager SHALL require minimum 200MB buffer beyond estimated file size
3. THE Download_Manager SHALL abort downloads when insufficient disk space and display clear error message
4. THE Download_Manager SHALL attempt HEAD request to determine file size when `Content-Length` unavailable
5. THE Download_Manager SHALL support resumable downloads using HTTP Range headers for partial files
6. THE Download_Manager SHALL write to `.tmp` files and atomically rename on completion
7. THE Download_Manager SHALL implement file locking to prevent concurrent writes to same content
8. THE Download_Manager SHALL verify file integrity using size heuristics before finalizing

### Requirement 22: Encryption Key Management and User Warnings

**User Story:** As a user, I want secure encryption for my downloads with clear warnings about key management, so that I understand the risks and benefits.

#### Acceptance Criteria

1. THE System SHALL store encryption keys only in OS keystore when encryption is enabled
2. THE System SHALL prompt user to set passphrase on first encryption enable
3. THE System SHALL display explicit warning about irreversible data loss if encryption key is lost
4. THE System SHALL provide export/import key functionality with clear documentation
5. THE System SHALL not hard-code encryption keys in application code or database
6. THE System SHALL use AES-GCM encryption for all encrypted downloads
7. THE System SHALL provide toggle to enable/disable encryption with immediate effect

### Requirement 23: Diagnostics and System Health Monitoring

**User Story:** As a user and developer, I want access to system diagnostics, so that I can troubleshoot issues and monitor application health.

#### Acceptance Criteria

1. THE System SHALL implement `diagnostics` command returning gateway health status
2. THE diagnostics SHALL include database version, free disk space, and local server status
3. THE diagnostics SHALL include timestamp of last successful manifest fetch
4. THE System SHALL provide Settings → Diagnostics UI displaying all health information
5. THE System SHALL implement "Collect Debug Package" feature creating support zip file
6. THE debug package SHALL include recent logs and database metadata without user content
7. THE System SHALL provide `--debug` flag for development builds with verbose console output

### Requirement 24: Comprehensive Testing Matrix

**User Story:** As a developer, I want comprehensive test coverage across all system components, so that the application is reliable and maintainable.

#### Acceptance Criteria

1. THE System SHALL include Vitest unit tests for version comparison, quality selection, and search normalization
2. THE System SHALL include Rust unit tests for gateway failover, Range header parsing, and claim extraction
3. THE System SHALL include property-based tests for critical algorithms and data transformations
4. THE System SHALL include Playwright E2E tests for startup, series flow, download, and forced update scenarios
5. THE System SHALL include CI pipeline running unit tests and headless E2E tests with mocked responses
6. THE System SHALL include migration tests using sample older database files
7. THE System SHALL include offline functionality tests with local server streaming validation
8. THE System SHALL achieve minimum test coverage thresholds for all critical code paths