# Tracing Infrastructure for Content Pipeline

**Status:** ✅ IMPLEMENTED  
**Phase:** 4 (Odysee Debug Preparation)  
**Task:** 19.2 Add tracing infrastructure  
**Date:** 2026-02-25

## Overview

This document describes the comprehensive tracing infrastructure added to the content pipeline to enable precise debugging of the Odysee playback issue. The tracing covers all stages from initial API call through to player mounting.

## Content Pipeline Stages

The content pipeline consists of 7 key stages:

```
1. claim_search call (Backend API Request)
   ↓
2. claim parsing (Backend Response Processing)
   ↓
3. stream validation (Backend Content Validation)
   ↓
4. CDN URL construction (Backend URL Building)
   ↓
5. backend return (Backend → Frontend IPC)
   ↓
6. frontend receive (Frontend API Layer)
   ↓
7. player mount (Frontend Player Component)
```

## Tracing Points Added

### Stage 1: claim_search Call (Backend)

**Location:** `src-tauri/src/commands.rs::fetch_channel_claims()`

**Tracing Added:**
```rust
info!(
    component = "content_pipeline",
    stage = "claim_search_call",
    channel_id = %validated_channel_id,
    tags = ?validated_tags,
    text = ?validated_text,
    limit = ?validated_limit,
    page = ?validated_page,
    force_refresh = should_force_refresh,
    "Stage 1: Sending claim_search API request"
);
```

**What to Look For:**
- Request parameters are correctly formatted
- Channel ID is properly validated
- Tags and filters are applied correctly

### Stage 2: Claim Parsing (Backend)

**Location:** `src-tauri/src/commands.rs::parse_claim_search_response()`

**Tracing Added:**
```rust
info!(
    component = "content_pipeline",
    stage = "claim_parsing",
    total_items = items_count,
    success = response.success,
    "Stage 2: Parsing claim_search response"
);

// Per-item parsing
debug!(
    component = "content_pipeline",
    stage = "claim_parsing_item",
    claim_id = %claim_id,
    title = %title,
    has_video_urls = !video_urls.is_empty(),
    video_url_count = video_urls.len(),
    "Parsed individual claim item"
);
```

**What to Look For:**
- Response structure is valid
- Items array is present and non-empty
- Individual claims parse successfully
- Video URLs are extracted

### Stage 3: Stream Validation (Backend)

**Location:** `src-tauri/src/commands.rs::parse_claim_item()`

**Tracing Added:**
```rust
info!(
    component = "content_pipeline",
    stage = "stream_validation",
    claim_id = %claim_id,
    value_type = value_type,
    has_stream = has_stream,
    has_sd_hash = has_sd_hash,
    "Stage 3: Validating stream data"
);
```

**What to Look For:**
- Claim has valid stream data
- SD hash is present (indicates LBRY stream)
- Value type is "stream" (not channel/repost/collection)

### Stage 4: CDN URL Construction (Backend)

**Location:** `src-tauri/src/commands.rs::extract_video_urls()`

**Tracing Added:**
```rust
info!(
    component = "content_pipeline",
    stage = "cdn_url_construction",
    claim_id = %claim_id,
    gateway = gateway,
    constructed_url = %cdn_url,
    quality_count = video_urls.len(),
    "Stage 4: Constructed CDN playback URL"
);
```

**What to Look For:**
- Gateway URL is correct
- CDN URL format is valid
- Multiple quality levels are generated
- URL follows pattern: `{gateway}/content/{claim_id}/master.m3u8`

### Stage 5: Backend Return (Backend → Frontend IPC)

**Location:** `src-tauri/src/commands.rs::fetch_channel_claims()` (return point)

**Tracing Added:**
```rust
info!(
    component = "content_pipeline",
    stage = "backend_return",
    item_count = items.len(),
    cached = false,
    "Stage 5: Returning content items to frontend via IPC"
);

// Per-item details
for item in &items {
    debug!(
        component = "content_pipeline",
        stage = "backend_return_item",
        claim_id = %item.claim_id,
        title = %item.title,
        has_video_urls = !item.video_urls.is_empty(),
        video_url_keys = ?item.video_urls.keys().collect::<Vec<_>>(),
        "Returning item to frontend"
    );
}
```

**What to Look For:**
- Correct number of items returned
- Each item has video_urls populated
- IPC serialization succeeds

### Stage 6: Frontend Receive (Frontend API Layer)

**Location:** `src/lib/api.ts::fetchChannelClaims()`

**Tracing Added:**
```typescript
console.log('[TRACE] Stage 6: Frontend received content items', {
  component: 'content_pipeline',
  stage: 'frontend_receive',
  item_count: response.length,
  items: response.map(item => ({
    claim_id: item.claim_id,
    title: item.title,
    has_video_urls: !!item.video_urls && Object.keys(item.video_urls).length > 0,
    video_url_keys: item.video_urls ? Object.keys(item.video_urls) : []
  }))
});
```

**What to Look For:**
- Response is an array
- Items have expected structure
- video_urls field is present and populated
- IPC deserialization succeeded

### Stage 7: Player Mount (Frontend Player Component)

**Location:** `src/components/PlayerModal.tsx::initPlayer()`

**Tracing Added:**
```typescript
console.log('[TRACE] Stage 7: Player mounting with content', {
  component: 'content_pipeline',
  stage: 'player_mount',
  claim_id: content.claim_id,
  title: content.title,
  has_video_urls: !!content.video_urls && Object.keys(content.video_urls).length > 0,
  video_url_keys: content.video_urls ? Object.keys(content.video_urls) : [],
  current_quality: currentQuality,
  selected_url: videoUrl,
  is_hls: isHls,
  hls_supported: isHLSSupported()
});
```

**What to Look For:**
- Content object has video_urls
- Selected quality exists in video_urls
- Video URL is valid
- HLS support is detected correctly
- Player initialization succeeds

## Structured Logging Format

All backend tracing uses structured logging with these required fields:

```rust
info!(
    component = "content_pipeline",  // Always "content_pipeline" for pipeline traces
    stage = "<stage_name>",           // One of: claim_search_call, claim_parsing, stream_validation, cdn_url_construction, backend_return
    // ... stage-specific fields
    "Human-readable message"
);
```

Frontend tracing uses console.log with structured objects:

```typescript
console.log('[TRACE] <message>', {
  component: 'content_pipeline',
  stage: '<stage_name>',
  // ... stage-specific fields
});
```

## Enabling Tracing

### Backend Tracing

Backend tracing is always enabled via the existing logging infrastructure. To see trace output:

**Development:**
```bash
# Set log level to DEBUG to see all traces
$env:RUST_LOG="debug"; npm run tauri:dev
```

**Production:**
```bash
# Set log level to INFO (default) - shows info!() and error!() traces
$env:RUST_LOG="info"; npm run tauri:dev
```

**Detailed Tracing:**
```bash
# Enable trace-level logging for maximum detail
$env:RUST_LOG="trace"; npm run tauri:dev
```

### Frontend Tracing

Frontend tracing is controlled by the `isDev` flag in `src/lib/api.ts`:

```typescript
const isDev = import.meta.env.DEV;
```

**Development Mode:**
- All traces are automatically logged to browser console
- Open DevTools → Console to see traces

**Production Mode:**
- Traces are disabled by default
- To enable, set `isDev = true` manually in api.ts

## Log File Locations

**Backend Logs:**
- Windows: `%APPDATA%\kiyya-desktop\logs\kiyya.log.YYYY-MM-DD`
- macOS: `~/Library/Application Support/kiyya-desktop/logs/kiyya.log.YYYY-MM-DD`
- Linux: `~/.local/share/kiyya-desktop/logs/kiyya.log.YYYY-MM-DD`

**Frontend Logs:**
- Browser DevTools Console (not persisted to file)

## Debugging Workflow

### Step 1: Enable Tracing

```bash
# Terminal 1: Set log level
$env:RUST_LOG="debug"; npm run tauri:dev
```

### Step 2: Trigger Content Fetch

Open app → Navigate to content section → Trigger fetch

### Step 3: Collect Traces

**Backend:**
```bash
# View live logs
Get-Content "$env:APPDATA\kiyya-desktop\logs\kiyya.log.$(Get-Date -Format yyyy-MM-dd)" -Wait

# Or grep for pipeline traces
Select-String -Path "$env:APPDATA\kiyya-desktop\logs\kiyya.log.*" -Pattern "content_pipeline"
```

**Frontend:**
- Open DevTools → Console
- Filter by "[TRACE]"
- Copy relevant traces

### Step 4: Analyze Pipeline Flow

Look for the 7 stages in order:

1. ✅ Stage 1: claim_search_call - Request sent
2. ✅ Stage 2: claim_parsing - Response parsed
3. ✅ Stage 3: stream_validation - Stream validated
4. ✅ Stage 4: cdn_url_construction - URL built
5. ✅ Stage 5: backend_return - Items returned to frontend
6. ✅ Stage 6: frontend_receive - Frontend received items
7. ✅ Stage 7: player_mount - Player mounted with content

**If any stage is missing or shows errors, that's the failure point.**

### Step 5: Identify Failure Layer

**Backend Failure (Stages 1-5):**
- Check backend logs for errors
- Verify API response structure
- Check CDN gateway configuration

**IPC Failure (Stage 5 → 6):**
- Check if Stage 5 completes but Stage 6 never fires
- Verify Tauri IPC is working (run `test_connection` command)
- Check for serialization errors

**Frontend Failure (Stages 6-7):**
- Check browser console for errors
- Verify content object structure
- Check player initialization

## Expected vs Actual Behavior

### Expected Behavior

**Stage 1:** Request sent with valid parameters  
**Stage 2:** Response contains items array with claims  
**Stage 3:** Each claim has valid stream data  
**Stage 4:** CDN URLs constructed for each quality level  
**Stage 5:** Items with video_urls returned to frontend  
**Stage 6:** Frontend receives items with video_urls populated  
**Stage 7:** Player mounts and loads video from CDN URL  

### Known Actual Behavior (Pre-Tracing)

**Odysee Content:**
- ❓ Unknown which stage fails
- ❓ Unknown if API returns data
- ❓ Unknown if CDN URLs are constructed
- ❓ Unknown if frontend receives data

**With Tracing:**
- ✅ Can identify exact failure stage
- ✅ Can see data at each stage
- ✅ Can isolate failure layer (backend/IPC/frontend)

## Isolated Failure Layer Hypothesis

Based on the tracing infrastructure, we can test these hypotheses:

**Hypothesis 1: Backend API Failure**
- Stage 1 completes, Stage 2 fails
- Indicates Odysee API issue or response format change

**Hypothesis 2: Parsing Failure**
- Stage 2 completes, Stage 3 fails
- Indicates claim structure issue or missing stream data

**Hypothesis 3: CDN URL Construction Failure**
- Stage 3 completes, Stage 4 fails
- Indicates gateway configuration issue or URL format problem

**Hypothesis 4: IPC Serialization Failure**
- Stage 5 completes, Stage 6 never fires
- Indicates Tauri IPC issue or data serialization problem

**Hypothesis 5: Frontend Data Handling Failure**
- Stage 6 completes, Stage 7 fails
- Indicates frontend validation issue or player initialization problem

## Integration with Debug Playbook

This tracing infrastructure is integrated with `stabilization/ODYSEE_DEBUG_PLAYBOOK.md`:

- Section 5: "Capture Backend Logs" - Uses backend tracing
- Section 6: "Capture Frontend Logs" - Uses frontend tracing
- Section 7: "Analyze Pipeline Flow" - Uses 7-stage analysis

## Testing the Tracing Infrastructure

### Test 1: Verify Backend Tracing

```bash
# Start app with debug logging
$env:RUST_LOG="debug"; npm run tauri:dev

# Trigger content fetch
# Check logs for "Stage 1", "Stage 2", etc.
```

### Test 2: Verify Frontend Tracing

```typescript
// Open DevTools Console
// Trigger content fetch
// Look for "[TRACE] Stage 6" and "[TRACE] Stage 7"
```

### Test 3: End-to-End Pipeline Trace

```bash
# Enable all tracing
$env:RUST_LOG="debug"; npm run tauri:dev

# Trigger content fetch
# Verify all 7 stages appear in logs/console
```

## Maintenance

### Adding New Tracing Points

When adding new pipeline stages:

1. Choose appropriate log level (info/debug/trace)
2. Include required fields: component, stage
3. Add stage-specific context fields
4. Update this document with new stage
5. Update debug playbook with new stage

### Removing Tracing

If tracing needs to be removed after debugging:

1. Search for `component = "content_pipeline"` in Rust code
2. Search for `[TRACE]` in TypeScript code
3. Remove or comment out tracing statements
4. Keep this document for future reference

## Performance Impact

**Backend Tracing:**
- Minimal impact (structured logging is efficient)
- Log level can be adjusted to reduce verbosity
- File I/O is asynchronous (non-blocking)

**Frontend Tracing:**
- Only enabled in development mode
- console.log is fast in modern browsers
- No impact in production builds

## Security Considerations

**Sensitive Data:**
- Claim IDs are logged (public data)
- Titles are logged (public data)
- URLs are logged (public CDN URLs)
- No tokens, credentials, or private keys are logged

**Log Retention:**
- Backend logs rotate daily
- Frontend logs are ephemeral (browser console only)
- No PII is logged

## Conclusion

This tracing infrastructure provides comprehensive visibility into the content pipeline, enabling precise debugging of the Odysee playback issue. By following the 7-stage analysis workflow, developers can quickly identify the exact failure point and isolate the problematic layer.

---

**Implemented:** 2026-02-25  
**Task:** 19.2 Add tracing infrastructure  
**Requirements:** 10.1 (Establish foundation for Odysee issue investigation)
