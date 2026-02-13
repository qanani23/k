# Tauri Commands API Reference

This document provides comprehensive documentation for all Tauri commands implemented in the Kiyya desktop streaming application.

## Table of Contents

1. [Content Discovery Commands](#content-discovery-commands)
2. [Download Management Commands](#download-management-commands)
3. [Progress Tracking Commands](#progress-tracking-commands)
4. [Favorites Management Commands](#favorites-management-commands)
5. [Configuration Commands](#configuration-commands)
6. [Cache Management Commands](#cache-management-commands)
7. [Diagnostics Commands](#diagnostics-commands)
8. [Utility Commands](#utility-commands)

---

## Content Discovery Commands

### `fetch_channel_claims`

Fetches content claims from the configured Odysee channel with optional filtering and pagination.

**Parameters:**
```typescript
{
  channel_id: string;        // Channel ID (e.g., "@kiyyamovies:b")
  any_tags?: string[];       // Filter by tags (e.g., ["movie", "action_movies"])
  text?: string;             // Search text query
  limit?: number;            // Maximum items to return (default: 50)
  page?: number;             // Page number for pagination (default: 1)
  force_refresh?: boolean;   // Bypass cache and fetch fresh data (default: false)
}
```

**Returns:** `Promise<ContentItem[]>`

**Example:**
```typescript
import { invoke } from '@tauri-apps/api/tauri';

const movies = await invoke('fetch_channel_claims', {
  channel_id: '@kiyyamovies:b',
  any_tags: ['movie', 'action_movies'],
  limit: 20,
  page: 1
});
```

**Error Handling:**
- `GatewayError`: All gateways failed
- `ContentParsing`: Response parsing failed
- `CacheError`: Cache operation failed

**Related Requirements:** 1.1, 1.2, 1.3, 1.4, 1.6, 15.1

---

### `fetch_playlists`

Fetches playlist metadata for series organization from the configured channel.


**Parameters:**
```typescript
{
  channel_id: string;  // Channel ID (e.g., "@kiyyamovies:b")
}
```

**Returns:** `Promise<Playlist[]>`

**Example:**
```typescript
const playlists = await invoke('fetch_playlists', {
  channel_id: '@kiyyamovies:b'
});
```

**Error Handling:**
- `GatewayError`: All gateways failed
- `ContentParsing`: Response parsing failed

**Related Requirements:** 2.1, 2.3, 15.2

---

### `resolve_claim`

Resolves a claim ID or URI to get detailed streaming metadata including video URLs and quality options.

**Parameters:**
```typescript
{
  claim_id_or_uri: string;  // Claim ID or full URI
}
```

**Returns:** `Promise<ContentItem>`

**Example:**
```typescript
const content = await invoke('resolve_claim', {
  claim_id_or_uri: 'abc123def456'
});
```

**Error Handling:**
- `GatewayError`: All gateways failed
- `ContentParsing`: Response parsing failed
- `InvalidInput`: Invalid claim ID format

**Related Requirements:** 3.1, 3.6, 15.3

---

## Download Management Commands

### `download_movie_quality`

Initiates a download of video content at the specified quality level.

**Parameters:**
```typescript
{
  claim_id: string;   // Unique claim identifier
  quality: string;    // Quality level (e.g., "720p", "1080p")
  url: string;        // Direct download URL
}
```

**Returns:** `Promise<void>`

**Events Emitted:**
- `download-progress`: Progress updates during download
- `download-complete`: Download finished successfully
- `download-error`: Download failed

**Example:**
```typescript
await invoke('download_movie_quality', {
  claim_id: 'abc123',
  quality: '720p',
  url: 'https://example.com/video.mp4'
});
```

**Error Handling:**
- `InsufficientDiskSpace`: Not enough disk space
- `DownloadError`: Download failed
- `EncryptionError`: Encryption failed (if enabled)

**Related Requirements:** 4.1, 4.2, 4.3, 4.4, 21.1, 21.2, 21.5, 15.4, 15.9

---

### `stream_offline`

Starts the local HTTP server and returns a URL for streaming downloaded content.


**Parameters:**
```typescript
{
  claim_id: string;  // Unique claim identifier
  quality: string;   // Quality level (e.g., "720p")
}
```

**Returns:** 
```typescript
Promise<{
  url: string;   // Local streaming URL (e.g., "http://127.0.0.1:8080/movies/abc123")
  port: number;  // Server port number
}>
```

**Example:**
```typescript
const { url, port } = await invoke('stream_offline', {
  claim_id: 'abc123',
  quality: '720p'
});
```

**Error Handling:**
- `NotFound`: Content not downloaded
- `ServerError`: Failed to start local server
- `DecryptionError`: Failed to decrypt content (if encrypted)

**Related Requirements:** 4.5, 4.6, 4.7, 17.1, 17.2, 17.3, 17.6, 15.5

---

### `delete_offline`

Deletes downloaded content from local storage.

**Parameters:**
```typescript
{
  claim_id: string;  // Unique claim identifier
  quality: string;   // Quality level (e.g., "720p")
}
```

**Returns:** `Promise<void>`

**Example:**
```typescript
await invoke('delete_offline', {
  claim_id: 'abc123',
  quality: '720p'
});
```

**Error Handling:**
- `NotFound`: Content not found
- `IoError`: Failed to delete file

**Related Requirements:** 15.6

---

## Progress Tracking Commands

### `save_progress`

Saves video playback progress for resume functionality.

**Parameters:**
```typescript
{
  claim_id: string;         // Unique claim identifier
  position_seconds: number; // Current playback position in seconds
  quality: string;          // Quality level being played
}
```

**Returns:** `Promise<void>`

**Example:**
```typescript
await invoke('save_progress', {
  claim_id: 'abc123',
  position_seconds: 1234,
  quality: '720p'
});
```

**Error Handling:**
- `DatabaseError`: Failed to save progress
- `InvalidInput`: Invalid parameters

**Related Requirements:** 3.7, 7.4, 15.7

---

### `get_progress`

Retrieves saved playback progress for a video.

**Parameters:**
```typescript
{
  claim_id: string;  // Unique claim identifier
}
```

**Returns:** 
```typescript
Promise<{
  claim_id: string;
  position_seconds: number;
  quality: string;
  updated_at: number;
} | null>
```

**Example:**
```typescript
const progress = await invoke('get_progress', {
  claim_id: 'abc123'
});
```

**Error Handling:**
- `DatabaseError`: Failed to retrieve progress

**Related Requirements:** 3.7, 7.4, 15.7

---

## Favorites Management Commands

### `save_favorite`

Adds content to the user's favorites list.


**Parameters:**
```typescript
{
  claim_id: string;       // Unique claim identifier
  title: string;          // Content title
  thumbnail_url?: string; // Optional thumbnail URL
}
```

**Returns:** `Promise<void>`

**Example:**
```typescript
await invoke('save_favorite', {
  claim_id: 'abc123',
  title: 'My Favorite Movie',
  thumbnail_url: 'https://example.com/thumb.jpg'
});
```

**Error Handling:**
- `DatabaseError`: Failed to save favorite
- `InvalidInput`: Invalid claim ID or title

**Related Requirements:** 7.3

---

### `remove_favorite`

Removes content from the user's favorites list.

**Parameters:**
```typescript
{
  claim_id: string;  // Unique claim identifier
}
```

**Returns:** `Promise<void>`

**Example:**
```typescript
await invoke('remove_favorite', {
  claim_id: 'abc123'
});
```

**Error Handling:**
- `DatabaseError`: Failed to remove favorite

**Related Requirements:** 7.3

---

### `get_favorites`

Retrieves all favorited content.

**Parameters:** None

**Returns:** 
```typescript
Promise<Array<{
  claim_id: string;
  title: string;
  thumbnail_url?: string;
  inserted_at: number;
}>>
```

**Example:**
```typescript
const favorites = await invoke('get_favorites');
```

**Error Handling:**
- `DatabaseError`: Failed to retrieve favorites

**Related Requirements:** 7.3

---

### `is_favorite`

Checks if content is in the user's favorites list.

**Parameters:**
```typescript
{
  claim_id: string;  // Unique claim identifier
}
```

**Returns:** `Promise<boolean>`

**Example:**
```typescript
const isFav = await invoke('is_favorite', {
  claim_id: 'abc123'
});
```

**Error Handling:**
- `DatabaseError`: Failed to check favorite status

**Related Requirements:** 7.3

---

## Configuration Commands

### `get_app_config`

Retrieves the current application configuration and settings.

**Parameters:** None

**Returns:** 
```typescript
Promise<{
  theme: 'dark' | 'light';
  last_used_quality: string;
  encrypt_downloads: boolean;
  auto_upgrade_quality: boolean;
  cache_ttl_minutes: number;
  max_cache_items: number;
  vault_path: string;
  version: string;
  gateways: string[];
}>
```

**Example:**
```typescript
const config = await invoke('get_app_config');
```

**Error Handling:**
- `ConfigError`: Failed to load configuration

**Related Requirements:** 15.8

---

### `update_settings`

Updates application settings.


**Parameters:**
```typescript
{
  settings: Record<string, string>;  // Key-value pairs of settings to update
}
```

**Returns:** `Promise<void>`

**Example:**
```typescript
await invoke('update_settings', {
  settings: {
    theme: 'dark',
    last_used_quality: '1080p'
  }
});
```

**Error Handling:**
- `ConfigError`: Failed to update settings
- `InvalidInput`: Invalid setting key or value

**Related Requirements:** 9.2

---

## Cache Management Commands

### `invalidate_cache_item`

Invalidates a specific cached content item, forcing a fresh fetch on next access.

**Parameters:**
```typescript
{
  claim_id: string;  // Unique claim identifier
}
```

**Returns:** `Promise<void>`

**Example:**
```typescript
await invoke('invalidate_cache_item', {
  claim_id: 'abc123'
});
```

**Error Handling:**
- `DatabaseError`: Failed to invalidate cache

**Related Requirements:** 7.6

---

### `invalidate_cache_by_tags`

Invalidates all cached content matching the specified tags.

**Parameters:**
```typescript
{
  tags: string[];  // Array of tags to match
}
```

**Returns:** `Promise<void>`

**Example:**
```typescript
await invoke('invalidate_cache_by_tags', {
  tags: ['movie', 'action_movies']
});
```

**Error Handling:**
- `DatabaseError`: Failed to invalidate cache

**Related Requirements:** 7.6

---

### `clear_all_cache`

Clears all cached content from the database.

**Parameters:** None

**Returns:** `Promise<void>`

**Example:**
```typescript
await invoke('clear_all_cache');
```

**Error Handling:**
- `DatabaseError`: Failed to clear cache

**Related Requirements:** 7.6

---

### `cleanup_expired_cache`

Removes expired cache entries based on TTL settings.

**Parameters:** None

**Returns:** `Promise<number>` (number of items removed)

**Example:**
```typescript
const removed = await invoke('cleanup_expired_cache');
console.log(`Removed ${removed} expired items`);
```

**Error Handling:**
- `DatabaseError`: Failed to cleanup cache

**Related Requirements:** 7.6

---

### `get_cache_stats`

Retrieves statistics about the cache.

**Parameters:** None

**Returns:** 
```typescript
Promise<{
  total_items: number;
  total_size_bytes: number;
  oldest_item_age_seconds: number;
  newest_item_age_seconds: number;
}>
```

**Example:**
```typescript
const stats = await invoke('get_cache_stats');
```

**Error Handling:**
- `DatabaseError`: Failed to retrieve cache stats

**Related Requirements:** 13.5

---

### `get_memory_stats`

Retrieves memory usage statistics.


**Parameters:** None

**Returns:** 
```typescript
Promise<{
  total_memory_mb: number;
  used_memory_mb: number;
  available_memory_mb: number;
  cache_memory_mb: number;
}>
```

**Example:**
```typescript
const memStats = await invoke('get_memory_stats');
```

**Error Handling:**
- `SystemError`: Failed to retrieve memory stats

**Related Requirements:** 13.6

---

### `optimize_database_memory`

Optimizes database memory usage by running VACUUM and other cleanup operations.

**Parameters:** None

**Returns:** `Promise<void>`

**Example:**
```typescript
await invoke('optimize_database_memory');
```

**Error Handling:**
- `DatabaseError`: Failed to optimize database

**Related Requirements:** 13.5

---

## Diagnostics Commands

### `get_diagnostics`

Retrieves comprehensive diagnostic information about the application.

**Parameters:** None

**Returns:** 
```typescript
Promise<{
  gateway_health: Array<{
    url: string;
    status: 'healthy' | 'unhealthy';
    last_check: number;
    response_time_ms?: number;
  }>;
  database_version: number;
  free_disk_space_bytes: number;
  local_server_status: 'running' | 'stopped';
  last_manifest_fetch: number;
  cache_stats: {
    total_items: number;
    total_size_bytes: number;
  };
  app_version: string;
}>
```

**Example:**
```typescript
const diagnostics = await invoke('get_diagnostics');
```

**Error Handling:**
- `DiagnosticsError`: Failed to collect diagnostics

**Related Requirements:** 11.1, 11.2, 11.3, 23.1, 23.2, 23.3, 15.8

---

### `collect_debug_package`

Collects diagnostic information and creates a debug package for support purposes.

**Parameters:** None

**Returns:** `Promise<string>` (path to debug package zip file)

**Example:**
```typescript
const debugPath = await invoke('collect_debug_package');
console.log(`Debug package created at: ${debugPath}`);
```

**Error Handling:**
- `IoError`: Failed to create debug package
- `ZipError`: Failed to compress files

**Related Requirements:** 11.1, 23.6

---

### `get_recent_crashes`

Retrieves recent crash reports.

**Parameters:**
```typescript
{
  limit: number;  // Maximum number of crash reports to return
}
```

**Returns:** 
```typescript
Promise<Array<{
  timestamp: number;
  error_message: string;
  stack_trace?: string;
  app_version: string;
}>>
```

**Example:**
```typescript
const crashes = await invoke('get_recent_crashes', { limit: 10 });
```

**Error Handling:**
- `IoError`: Failed to read crash logs

**Related Requirements:** 11.1

---

### `clear_crash_log`

Clears all crash reports from storage.


**Parameters:** None

**Returns:** `Promise<void>`

**Example:**
```typescript
await invoke('clear_crash_log');
```

**Error Handling:**
- `IoError`: Failed to clear crash logs

**Related Requirements:** 11.1

---

## Utility Commands

### `open_external`

Opens a URL in the user's default external browser.

**Parameters:**
```typescript
{
  url: string;  // URL to open
}
```

**Returns:** `Promise<void>`

**Example:**
```typescript
await invoke('open_external', {
  url: 'https://example.com'
});
```

**Error Handling:**
- `InvalidInput`: Invalid URL format
- `SystemError`: Failed to open browser

**Related Requirements:** 8.5, 19.7

---

## Event System

The application emits events for asynchronous operations. Listen to these events using Tauri's event system.

### Download Events

**`download-progress`**
```typescript
{
  claim_id: string;
  quality: string;
  bytes_downloaded: number;
  total_bytes: number;
  percentage: number;
  speed_bytes_per_sec: number;
}
```

**`download-complete`**
```typescript
{
  claim_id: string;
  quality: string;
  file_path: string;
  file_size_bytes: number;
}
```

**`download-error`**
```typescript
{
  claim_id: string;
  quality: string;
  error: string;
}
```

**Example:**
```typescript
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen('download-progress', (event) => {
  console.log(`Download progress: ${event.payload.percentage}%`);
});
```

**Related Requirements:** 4.4, 15.9

---

### Local Server Events

**`local-server-started`**
```typescript
{
  port: number;
  address: string;
}
```

**Example:**
```typescript
await listen('local-server-started', (event) => {
  console.log(`Server started on port ${event.payload.port}`);
});
```

**Related Requirements:** 15.9

---

## Error Types

All commands may return the following error types:

### `GatewayError`
Gateway communication failed after all retries.

### `ContentParsing`
Failed to parse API response.

### `DatabaseError`
Database operation failed.

### `InvalidInput`
Invalid input parameters.

### `NotFound`
Requested resource not found.

### `InsufficientDiskSpace`
Not enough disk space for operation.

### `DownloadError`
Download operation failed.

### `EncryptionError`
Encryption/decryption operation failed.

### `ServerError`
Local HTTP server error.

### `ConfigError`
Configuration error.

### `IoError`
File system I/O error.

### `SystemError`
System-level error.

---

## Best Practices

### Error Handling
Always wrap command invocations in try-catch blocks:

```typescript
try {
  const content = await invoke('fetch_channel_claims', params);
} catch (error) {
  console.error('Failed to fetch content:', error);
  // Handle error appropriately
}
```

### Type Safety
Use TypeScript interfaces for type-safe command invocations:

```typescript
import { invoke } from '@tauri-apps/api/tauri';
import { ContentItem } from './types';

const content: ContentItem[] = await invoke('fetch_channel_claims', {
  channel_id: '@kiyyamovies:b',
  any_tags: ['movie']
});
```

### Event Cleanup
Always unlisten from events when components unmount:

```typescript
useEffect(() => {
  const setupListener = async () => {
    const unlisten = await listen('download-progress', handleProgress);
    return unlisten;
  };
  
  const unlistenPromise = setupListener();
  
  return () => {
    unlistenPromise.then(unlisten => unlisten());
  };
}, []);
```

### Cache Management
Use force_refresh sparingly to avoid unnecessary API calls:

```typescript
// Normal fetch (uses cache if available)
const content = await fetchChannelClaims({ any_tags: ['movie'] });

// Force refresh (bypasses cache)
const freshContent = await fetchChannelClaims({ 
  any_tags: ['movie'],
  force_refresh: true 
});
```

---

## Command Registration

All commands are registered in `src-tauri/src/main.rs`:

```rust
tauri::Builder::default()
    .manage(app_state)
    .invoke_handler(tauri::generate_handler![
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

---

## Related Documentation

- **Requirements Document**: `.kiro/specs/kiyya-desktop-streaming/requirements.md`
- **Design Document**: `.kiro/specs/kiyya-desktop-streaming/design.md`
- **Architecture**: `ARCHITECTURE.md`
- **API Wrapper**: `src/lib/api.ts`
- **Command Implementation**: `src-tauri/src/commands.rs`

---

## Summary

This document provides complete documentation for all 27 Tauri commands implemented in the Kiyya desktop streaming application. Each command includes:

- Parameter specifications with TypeScript types
- Return value types
- Usage examples
- Error handling information
- Related requirements from the specification

All commands are fully implemented, tested, and registered in the application.
