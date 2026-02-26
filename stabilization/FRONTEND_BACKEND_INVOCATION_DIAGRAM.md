# Frontend → Backend Invocation Diagram

## Overview

This document provides comprehensive diagrams showing how the Kiyya Desktop frontend communicates with the Rust backend through Tauri's IPC (Inter-Process Communication) mechanism.

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Tauri Command Flow](#tauri-command-flow)
3. [Async Communication Pattern](#async-communication-pattern)
4. [Error Handling Flow](#error-handling-flow)
5. [Retry Logic Flow](#retry-logic-flow)
6. [Cache-Aware Invocation](#cache-aware-invocation)
7. [Complete Command Registry](#complete-command-registry)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
│                                                                   │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │  Components  │─────▶│   API Layer  │─────▶│ Tauri Bridge │  │
│  │  (.tsx/.ts)  │      │   (api.ts)   │      │   (@tauri)   │  │
│  └──────────────┘      └──────────────┘      └──────┬───────┘  │
│                                                       │           │
└───────────────────────────────────────────────────────┼──────────┘
                                                        │
                                    IPC (JSON-RPC over WebSocket)
                                                        │
┌───────────────────────────────────────────────────────┼──────────┐
│                                                       ▼           │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │ Tauri Runtime│◀─────│   Commands   │◀─────│  Main.rs     │  │
│  │   (IPC)      │      │ (commands.rs)│      │  (Builder)   │  │
│  └──────────────┘      └──────┬───────┘      └──────────────┘  │
│                               │                                  │
│                               ▼                                  │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │   Database   │      │   Gateway    │      │  Validation  │  │
│  │ (database.rs)│      │ (gateway.rs) │      │(validation.rs)│  │
│  └──────────────┘      └──────────────┘      └──────────────┘  │
│                                                                   │
│                      BACKEND (Rust/Tauri)                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tauri Command Flow

### Step-by-Step Invocation Process

```
FRONTEND                          TAURI BRIDGE                    BACKEND
────────                          ────────────                    ───────

1. User Action
   │
   ▼
2. Component calls API function
   │  (e.g., fetchChannelClaims())
   │
   ▼
3. api.ts wraps parameters
   │  - Type conversion
   │  - Validation
   │  - Retry logic setup
   │
   ▼
4. invoke('command_name', params) ──────────▶ Tauri IPC Layer
                                              │
                                              │ Serializes to JSON
                                              │ Sends over WebSocket
                                              │
                                              ▼
                                         5. Tauri Runtime
                                              │ Deserializes JSON
                                              │ Routes to command
                                              │
                                              ▼
                                         6. #[tauri::command]
                                              │ fetch_channel_claims()
                                              │
                                              ▼
                                         7. Backend Processing
                                              │ - Validation
                                              │ - Cache check
                                              │ - API call
                                              │ - Database ops
                                              │
                                              ▼
                                         8. Return Result<T>
                                              │
                                              │ Serializes to JSON
                                              │
                                              ▼
9. Promise resolves ◀──────────────────── Tauri IPC Layer
   │                                      (sends response)
   ▼
10. Type-safe result
    │  ContentItem[]
    │
    ▼
11. Component updates state
    │
    ▼
12. UI re-renders
```

### Example: Fetching Channel Claims

```typescript
// FRONTEND: src/lib/api.ts
export const fetchChannelClaims = async (params: FetchParams): Promise<ContentItem[]> => {
  return await fetchWithRetry(async () => {
    // Step 3: Wrap parameters
    const invokePromise = invoke('fetch_channel_claims', {
      channelId: CHANNEL_ID,
      anyTags: params.any_tags,
      text: params.text,
      limit: params.limit,
      page: params.page,
      forceRefresh: params.force_refresh,
      streamTypes: params.stream_types
    });
    
    // Step 4: Send to backend with timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), 30000)
    );
    
    return await Promise.race([invokePromise, timeoutPromise]);
  }, RETRY_CONFIGS.category);
};
```

```rust
// BACKEND: src-tauri/src/commands.rs
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
    // Step 7: Backend processing
    // - Validate inputs
    // - Check cache
    // - Fetch from API if needed
    // - Store in cache
    // - Return results
    
    // Step 8: Return Result
    Ok(items)
}
```

---

## Async Communication Pattern

### Promise-Based Async Flow

```
FRONTEND (JavaScript)                    BACKEND (Rust)
─────────────────────                    ──────────────

async function call()                    #[tauri::command]
│                                        pub async fn command()
│                                        │
▼                                        │
invoke('command', params)                │
│                                        │
│ Returns Promise<T>                    │
│                                        │
│ ┌─────────────────┐                   │
│ │  Promise State  │                   │
│ │   - Pending     │                   │
│ └─────────────────┘                   │
│                                        │
│                                        ▼
│                                   async processing
│                                        │
│                                        │ - Database queries
│                                        │ - API calls
│                                        │ - Validation
│                                        │
│                                        ▼
│                                   Result<T, Error>
│                                        │
│ ┌─────────────────┐                   │
│ │  Promise State  │◀──────────────────┘
│ │   - Fulfilled   │  (Success: Ok(T))
│ │   - Rejected    │  (Error: Err(E))
│ └─────────────────┘
│
▼
.then(result => ...)   // Success path
.catch(error => ...)   // Error path
```

### Concurrent Async Calls

```
Component renders
│
├─▶ invoke('fetch_channel_claims', {...})  ──┐
│                                             │
├─▶ invoke('fetch_playlists', {...})      ──┤
│                                             │
└─▶ invoke('get_favorites')               ──┤
                                              │
                                              │ All execute concurrently
                                              │
                                              ▼
                                         Promise.all([...])
                                              │
                                              ▼
                                         All results ready
                                              │
                                              ▼
                                         Component updates
```

---

## Error Handling Flow

### Complete Error Propagation Chain

```
BACKEND ERROR                    TAURI SERIALIZATION              FRONTEND HANDLING
─────────────                    ───────────────────              ─────────────────

1. Rust Error Occurs
   │
   ▼
2. Result<T, Error>
   │  Err(AppError::...)
   │
   ▼
3. Error Conversion
   │  impl From<AppError> for String
   │
   ▼
4. Serialize to JSON ──────────▶ 5. IPC Transport
   │  { "error": "..." }             │
   │                                 │
   │                                 ▼
   │                            6. Promise Rejection
   │                                 │
   │                                 ▼
   │                            7. .catch(error => ...)
   │                                 │
   │                                 ▼
   │                            8. Error Handling
   │                                 │
   │                                 ├─▶ Retry logic
   │                                 ├─▶ User notification
   │                                 └─▶ Fallback behavior
```

### Error Types and Handling

```typescript
// FRONTEND: Error handling in api.ts
try {
  const result = await invoke('fetch_channel_claims', params);
  return result;
} catch (error) {
  // Error from backend arrives as string
  console.error('Backend error:', error);
  
  // Retry logic
  if (retryCount < maxRetries) {
    await delay(retryDelay);
    return retry();
  }
  
  // Propagate to component
  throw new Error(`Failed to fetch: ${error}`);
}
```

```rust
// BACKEND: Error types in commands.rs
pub type Result<T> = std::result::Result<T, String>;

// Errors are converted to strings for IPC
impl From<AppError> for String {
    fn from(err: AppError) -> String {
        err.to_string()
    }
}

// Command returns Result
#[tauri::command]
pub async fn fetch_channel_claims(...) -> Result<Vec<ContentItem>> {
    // Validation error
    if invalid {
        return Err("Invalid channel ID".to_string());
    }
    
    // Network error
    let response = gateway.fetch().await
        .map_err(|e| format!("Network error: {}", e))?;
    
    // Success
    Ok(items)
}
```

---

## Retry Logic Flow

### Exponential Backoff with Retry

```
API Call Attempt
│
▼
┌─────────────────────────────────────────────────────────┐
│                    fetchWithRetry()                      │
│                                                           │
│  Attempt 1                                               │
│  │                                                        │
│  ▼                                                        │
│  invoke('command', params)                               │
│  │                                                        │
│  ├─▶ Success ──────────────────────────────────▶ Return │
│  │                                                        │
│  └─▶ Error                                               │
│      │                                                    │
│      ▼                                                    │
│  Wait 1000ms (initialDelay)                              │
│      │                                                    │
│      ▼                                                    │
│  Attempt 2                                               │
│  │                                                        │
│  ▼                                                        │
│  invoke('command', params)                               │
│  │                                                        │
│  ├─▶ Success ──────────────────────────────────▶ Return │
│  │                                                        │
│  └─▶ Error                                               │
│      │                                                    │
│      ▼                                                    │
│  Wait 2000ms (initialDelay * backoffMultiplier)         │
│      │                                                    │
│      ▼                                                    │
│  Attempt 3                                               │
│  │                                                        │
│  ▼                                                        │
│  invoke('command', params)                               │
│  │                                                        │
│  ├─▶ Success ──────────────────────────────────▶ Return │
│  │                                                        │
│  └─▶ Error                                               │
│      │                                                    │
│      ▼                                                    │
│  Max retries reached ──────────────────────────▶ Throw  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Retry Configuration

```typescript
// FRONTEND: Retry configs in api.ts
export const RETRY_CONFIGS: Record<string, RetryConfig> = {
  hero: {
    maxRetries: 3,
    initialDelay: 1000,      // 1 second
    backoffMultiplier: 2     // 1s → 2s → 4s
  },
  category: {
    maxRetries: 3,
    initialDelay: 1000,
    backoffMultiplier: 2
  },
  search: {
    maxRetries: 3,
    initialDelay: 1000,
    backoffMultiplier: 2
  }
};

// Retry delays:
// Attempt 1: immediate
// Attempt 2: 1000ms delay
// Attempt 3: 2000ms delay
// Attempt 4: 4000ms delay (if maxRetries = 4)
```

---

## Cache-Aware Invocation

### Cache Check Flow in Backend

```
Frontend invokes command
│
▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend Command Handler                     │
│                                                               │
│  1. Validate inputs                                          │
│     │                                                         │
│     ▼                                                         │
│  2. Check force_refresh flag                                 │
│     │                                                         │
│     ├─▶ force_refresh = true ──────────────────┐            │
│     │                                            │            │
│     └─▶ force_refresh = false                   │            │
│         │                                        │            │
│         ▼                                        │            │
│  3. Query local cache                           │            │
│     │  db.get_cached_content(query)             │            │
│     │                                            │            │
│     ├─▶ Cache HIT (items found)                 │            │
│     │   │                                        │            │
│     │   └─▶ Return cached items ────────────────┼──▶ Return │
│     │                                            │            │
│     └─▶ Cache MISS (no items)                   │            │
│         │                                        │            │
│         ▼                                        ▼            │
│  4. Fetch from remote API ◀─────────────────────┘            │
│     │  gateway.fetch_with_failover()                         │
│     │                                                         │
│     ▼                                                         │
│  5. Parse response                                           │
│     │  parse_claim_search_response()                         │
│     │                                                         │
│     ▼                                                         │
│  6. Store in cache                                           │
│     │  db.store_content_items()                              │
│     │                                                         │
│     ▼                                                         │
│  7. Return fresh items ─────────────────────────────▶ Return │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Cache Invalidation Commands

```
User Action                    Frontend                    Backend
───────────                    ────────                    ───────

1. User clicks "Refresh"
   │
   ▼
2. invoke('fetch_channel_claims', {
     forceRefresh: true        ──────────────────▶  Skip cache
   })                                               Fetch fresh data
                                                    Update cache
                                                    Return new data

3. User clears cache
   │
   ▼
4. invoke('clear_all_cache')   ──────────────────▶  Delete all cache
                                                    Return success

5. User invalidates item
   │
   ▼
6. invoke('invalidate_cache_item', {
     claimId: 'abc123'         ──────────────────▶  Delete specific item
   })                                               Return success
```

---

## Complete Command Registry

### All Available Tauri Commands

```
┌─────────────────────────────────────────────────────────────────┐
│                      TAURI COMMAND REGISTRY                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  TESTING & DIAGNOSTICS                                           │
│  ├─ test_connection() → String                                   │
│  ├─ build_cdn_playback_url_test(claim_id) → String              │
│  └─ get_diagnostics() → DiagnosticsData                          │
│                                                                   │
│  CONTENT DISCOVERY                                               │
│  ├─ fetch_channel_claims(params) → Vec<ContentItem>             │
│  ├─ fetch_playlists(channel_id) → Vec<Playlist>                 │
│  └─ resolve_claim(claim_id_or_uri) → ContentItem                │
│                                                                   │
│  OFFLINE DOWNLOADS                                               │
│  ├─ download_movie_quality(params) → void                        │
│  ├─ stream_offline(params) → StreamOfflineResponse              │
│  └─ delete_offline(params) → void                                │
│                                                                   │
│  PROGRESS TRACKING                                               │
│  ├─ save_progress(params) → void                                 │
│  └─ get_progress(claim_id) → ProgressData | null                │
│                                                                   │
│  FAVORITES                                                       │
│  ├─ save_favorite(params) → void                                 │
│  ├─ remove_favorite(claim_id) → void                             │
│  ├─ get_favorites() → Vec<FavoriteItem>                          │
│  └─ is_favorite(claim_id) → bool                                 │
│                                                                   │
│  CONFIGURATION                                                   │
│  ├─ get_app_config() → AppConfig                                 │
│  └─ update_settings(settings) → void                             │
│                                                                   │
│  CACHE MANAGEMENT                                                │
│  ├─ get_cache_stats() → CacheStats                               │
│  ├─ get_memory_stats() → MemoryStats                             │
│  ├─ optimize_database_memory() → void                            │
│  ├─ invalidate_cache_item(claim_id) → void                       │
│  ├─ invalidate_cache_by_tags(tags) → void                        │
│  ├─ clear_all_cache() → void                                     │
│  └─ cleanup_expired_cache() → number                             │
│                                                                   │
│  EXTERNAL LINKS                                                  │
│  └─ open_external(url) → void                                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Command Registration in main.rs

```rust
// BACKEND: src-tauri/src/main.rs
fn main() {
    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            // Testing
            commands::test_connection,
            commands::build_cdn_playback_url_test,
            
            // Content discovery
            commands::fetch_channel_claims,
            commands::fetch_playlists,
            commands::resolve_claim,
            
            // Offline downloads
            commands::download_movie_quality,
            commands::stream_offline,
            commands::delete_offline,
            
            // Progress tracking
            commands::save_progress,
            commands::get_progress,
            
            // Favorites
            commands::save_favorite,
            commands::remove_favorite,
            commands::get_favorites,
            commands::is_favorite,
            
            // Configuration
            commands::get_app_config,
            commands::update_settings,
            
            // Diagnostics
            commands::get_diagnostics,
            
            // Cache management
            commands::get_cache_stats,
            commands::get_memory_stats,
            commands::optimize_database_memory,
            commands::invalidate_cache_item,
            commands::invalidate_cache_by_tags,
            commands::clear_all_cache,
            commands::cleanup_expired_cache,
            
            // External links
            commands::open_external,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## Type Conversion and Serialization

### JavaScript ↔ Rust Type Mapping

```
┌─────────────────────────────────────────────────────────────────┐
│                    TYPE CONVERSION TABLE                         │
├──────────────────────┬──────────────────────────────────────────┤
│  JavaScript (TS)     │  Rust                                    │
├──────────────────────┼──────────────────────────────────────────┤
│  string              │  String                                  │
│  number              │  u32, i32, f64                           │
│  boolean             │  bool                                    │
│  null                │  Option<T> (None)                        │
│  undefined           │  Option<T> (None)                        │
│  Array<T>            │  Vec<T>                                  │
│  Object              │  struct (with #[derive(Serialize)])     │
│  Promise<T>          │  async fn -> Result<T>                   │
├──────────────────────┴──────────────────────────────────────────┤
│                                                                   │
│  NAMING CONVENTION                                               │
│  ├─ Frontend: camelCase (anyTags, claimId)                      │
│  └─ Backend: snake_case (any_tags, claim_id)                    │
│                                                                   │
│  Tauri automatically converts between conventions!               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Example Type Conversion

```typescript
// FRONTEND: TypeScript types
interface FetchParams {
  any_tags?: string[];
  text?: string;
  limit?: number;
  page?: number;
  force_refresh?: boolean;
}

// Invoke with camelCase
invoke('fetch_channel_claims', {
  channelId: '@kiyyamovies:b',
  anyTags: ['movie', 'comedy'],
  limit: 50,
  forceRefresh: true
});
```

```rust
// BACKEND: Rust types
#[tauri::command]
pub async fn fetch_channel_claims(
    channel_id: String,              // channelId → channel_id
    any_tags: Option<Vec<String>>,   // anyTags → any_tags
    limit: Option<u32>,              // limit → limit
    force_refresh: Option<bool>,     // forceRefresh → force_refresh
) -> Result<Vec<ContentItem>> {
    // Tauri handles conversion automatically
}
```

---

## Performance Considerations

### Optimization Strategies

```
1. CACHING
   ├─ Local database cache for content items
   ├─ Cache hit: ~1-5ms response time
   └─ Cache miss: ~500-2000ms (network + processing)

2. CONCURRENT REQUESTS
   ├─ Multiple invoke() calls execute in parallel
   ├─ Use Promise.all() for batch operations
   └─ Backend uses async/await for non-blocking I/O

3. TIMEOUT PROTECTION
   ├─ 30-second timeout on all API calls
   ├─ Prevents infinite hangs
   └─ Graceful error handling

4. RETRY LOGIC
   ├─ Exponential backoff for transient failures
   ├─ Max 3 retries per request
   └─ Configurable per operation type

5. MEMORY MANAGEMENT
   ├─ Database connection pooling
   ├─ Periodic cache cleanup
   └─ Memory optimization commands
```

---

## Security Considerations

### Input Validation Flow

```
Frontend Input
│
▼
┌─────────────────────────────────────────────────────────────────┐
│                    VALIDATION LAYERS                             │
│                                                                   │
│  Layer 1: Frontend Validation (TypeScript)                       │
│  ├─ Type checking at compile time                                │
│  ├─ Basic format validation                                      │
│  └─ User-friendly error messages                                 │
│                                                                   │
│  Layer 2: Tauri Serialization                                    │
│  ├─ JSON schema validation                                       │
│  ├─ Type coercion                                                │
│  └─ Malformed data rejection                                     │
│                                                                   │
│  Layer 3: Backend Validation (Rust)                              │
│  ├─ validate_channel_id()                                        │
│  ├─ validate_tags()                                              │
│  ├─ validate_search_text()                                       │
│  ├─ sanitize_limit()                                             │
│  ├─ sanitize_offset()                                            │
│  └─ SQL injection prevention                                     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Security Best Practices

```
1. INPUT SANITIZATION
   ├─ All user inputs validated before use
   ├─ SQL queries use parameterized statements
   └─ No raw string interpolation

2. ERROR MESSAGES
   ├─ Generic errors to frontend (no internal details)
   ├─ Detailed logging in backend only
   └─ No sensitive data in error messages

3. RATE LIMITING
   ├─ Retry logic prevents request flooding
   ├─ Exponential backoff on failures
   └─ Timeout protection

4. DATA SANITIZATION
   ├─ HTML/script injection prevention
   ├─ URL validation for external links
   └─ File path validation for downloads
```

---

## Debugging and Monitoring

### Logging Points in Invocation Flow

```
FRONTEND                          BACKEND
────────                          ───────

1. console.log('Calling command')
   │
   ▼
2. invoke('command', params)
   │
   │                              3. info!("Command received")
   │                                 │
   │                                 ▼
   │                              4. info!("Validating inputs")
   │                                 │
   │                                 ▼
   │                              5. info!("Checking cache")
   │                                 │
   │                                 ▼
   │                              6. info!("Fetching from API")
   │                                 │
   │                                 ▼
   │                              7. info!("Storing in cache")
   │                                 │
   │                                 ▼
   │                              8. info!("Returning result")
   │                                 │
   ▼                                 ▼
9. console.log('Result received')

10. DevTools Network tab shows IPC messages
11. Backend logs show detailed execution trace
```

### Diagnostic Commands

```typescript
// Test IPC connectivity
await invoke('test_connection');
// Returns: "tauri-backend-alive"

// Get system diagnostics
const diagnostics = await invoke('get_diagnostics');
// Returns: { version, platform, cache_stats, memory_stats }

// Test URL construction
const url = await invoke('build_cdn_playback_url_test', { 
  claimId: 'abc123' 
});
// Returns: "https://cloud.odysee.live/content/abc123/master.m3u8"
```

---

## Summary

### Key Takeaways

1. **Tauri IPC** provides seamless JavaScript ↔ Rust communication via JSON-RPC
2. **Type Safety** is maintained end-to-end with TypeScript and Rust types
3. **Async/Await** pattern works naturally across the IPC boundary
4. **Error Handling** propagates cleanly from Rust Result to JavaScript Promise
5. **Retry Logic** provides resilience against transient failures
6. **Caching** optimizes performance by reducing redundant API calls
7. **Validation** occurs at multiple layers for security and correctness
8. **Logging** provides visibility into the complete invocation flow

### Command Invocation Checklist

- [ ] Define TypeScript types for parameters and return values
- [ ] Implement frontend API wrapper with retry logic
- [ ] Define Rust command with #[tauri::command] attribute
- [ ] Register command in main.rs invoke_handler
- [ ] Add input validation in backend
- [ ] Implement error handling and logging
- [ ] Test with manual DevTools invocation
- [ ] Add automated tests for command
- [ ] Document command in API layer
- [ ] Update this diagram if flow changes

---

**Document Status:** Complete  
**Last Updated:** Phase 3 - Task 14.7  
**Related Documents:**
- `BACKEND_FLOW_DIAGRAMS.md` - Backend internal flow
- `ARCHITECTURE.md` - Overall system architecture
- `src/lib/api.ts` - Frontend API layer
- `src-tauri/src/commands.rs` - Backend command definitions
