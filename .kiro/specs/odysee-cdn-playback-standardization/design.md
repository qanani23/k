# Design Document: Odysee CDN Playback Standardization

## Overview

This design refactors the Kiyya Desktop application's video playback URL architecture from a fallback-based approach to a deterministic CDN-first strategy. The current implementation attempts to extract direct video URLs from Odysee API responses before falling back to CDN URL construction, but the Odysee API does not reliably return direct playable URLs. This causes critical failures in Hero, Series, and Movies sections.

The refactored architecture treats CDN playback as the primary and only strategy, constructing playback URLs deterministically from claim_id using the Odysee CDN pattern: `{gateway}/content/{claim_id}/{HLS_MASTER_PLAYLIST}` where `HLS_MASTER_PLAYLIST = "master.m3u8"`.

### Architectural Transition

This refactor represents a fundamental shift from an **API-trust model** (reactive) to a **deterministic infrastructure model** (proactive):

**Previous Model (API-Trust)**:
- Extract direct URLs from API responses
- Complex fallback logic with multiple conditional branches
- Quality-based URL handling (hd_url, sd_url, 720p, etc.)
- High branching complexity and failure surface
- Reactive to API changes and inconsistencies

**Current Model (Deterministic Infrastructure)**:
- Deterministic URL construction from claim_id only
- Single playback code path, no fallback chains
- HLS master playlist only (adaptive streaming)
- Reduced branching and failure surface
- Proactive and predictable behavior
- Gateway resolved once at startup (immutable state)
- Stream-only claim validation (skip non-stream types)

This transition simplifies the codebase, reduces failure modes, and makes the system resilient to Odysee API inconsistencies.

### Key Design Principles

1. **Deterministic URL Construction**: Every valid stream claim_id produces a predictable CDN playback URL
2. **Fail-Fast on Missing claim_id**: Only fail when claim_id is missing, not when optional metadata is absent
3. **Stream-Only Validation**: Only construct playback URLs for claims with `value_type == "stream"`
4. **Partial Success Support**: One failed claim should not prevent other claims from loading
5. **Structured Error Handling**: No panics, all errors logged with context
6. **Frontend Simplicity**: Frontend receives ready-to-use playback_url, no URL reconstruction needed
7. **Immutable Gateway State**: Gateway resolved once at startup, preventing mid-session inconsistency
8. **Idempotent Logging**: DEBUG for repetitive operations, INFO only for lifecycle events

## Architecture

### Current Architecture (Problematic)

```
API Response → Try Direct URLs (hd_url, sd_url, streams) → If All Fail → CDN Fallback → Frontend
                     ↓ (Missing)
                   ERROR
```

Problems:
- Direct URLs are unreliable and often missing
- Fallback logic is complex and error-prone
- Missing direct URLs cause unnecessary errors
- Frontend may attempt URL reconstruction
- No claim type validation (channels, reposts treated as streams)
- Gateway resolution per-request (potential inconsistency)

### New Architecture (Deterministic)

```
Startup: Gateway Resolution (once) → Immutable State
                                          ↓
API Response → Validate Stream Type → Extract claim_id → CDN Builder → Playback URL → Frontend
                     ↓ (Non-stream)         ↓ (Missing)
                   SKIP (log)             ERROR (only failure case)
```

Benefits:
- Single code path, no fallback complexity
- Predictable behavior
- Only fails on actual missing data (claim_id)
- Frontend receives ready-to-use URLs
- Stream-only validation prevents 404 errors
- Gateway immutability ensures consistency
- Reduced failure surface


## Components and Interfaces

### 1. CDN Playback Builder

**Purpose**: Construct deterministic CDN playback URLs from claim_id

**Function Signature**:
```rust
const HLS_MASTER_PLAYLIST: &str = "master.m3u8";

fn build_cdn_playback_url(claim_id: &str, gateway: &str) -> String
```

**Inputs**:
- `claim_id`: The Odysee claim identifier (required)
- `gateway`: CDN gateway base URL from immutable startup state

**Output**:
- HLS playback URL in format: `{gateway}/content/{claim_id}/{HLS_MASTER_PLAYLIST}`

**Behavior**:
- Use gateway from immutable configuration state (resolved at startup)
- Construct URL by appending `/content/{claim_id}/{HLS_MASTER_PLAYLIST}`
- Return complete URL string
- **Centralized playlist naming**: `HLS_MASTER_PLAYLIST` constant allows future naming changes with single update

**Example**:
```rust
let url = build_cdn_playback_url("abc123def456", "https://cloud.odysee.live");
// Returns: "https://cloud.odysee.live/content/abc123def456/master.m3u8"
```

**Future-Proof Design**:
- HLS_MASTER_PLAYLIST constant centralizes naming convention
- If Odysee changes from "master.m3u8" to "playlist.m3u8", single constant update fixes entire codebase
- Gateway parameter supports future multi-gateway fallback strategy

### 2. Gateway Configuration and Initialization

**Purpose**: Resolve CDN gateway once at startup and store in immutable state

**Implementation**:
```rust
use std::sync::Arc;
use once_cell::sync::Lazy;

static CDN_GATEWAY: Lazy<Arc<String>> = Lazy::new(|| {
    let gateway = std::env::var("ODYSEE_CDN_GATEWAY")
        .unwrap_or_else(|_| "https://cloud.odysee.live".to_string());
    
    // Validate and sanitize gateway
    let sanitized = sanitize_gateway(&gateway);
    
    log::info!("CDN gateway resolved at startup: {}", sanitized);
    Arc::new(sanitized)
});

fn sanitize_gateway(gateway: &str) -> String {
    // Must start with https://
    if !gateway.starts_with("https://") {
        log::warn!("Invalid gateway '{}', must use HTTPS. Falling back to default.", gateway);
        return "https://cloud.odysee.live".to_string();
    }
    
    // Remove trailing slash
    gateway.trim_end_matches('/').to_string()
}

fn get_cdn_gateway() -> &'static str {
    &CDN_GATEWAY
}
```

**Behavior**:
- Gateway resolution occurs once at first access (lazy initialization)
- Resolved gateway stored in static Arc (immutable, thread-safe)
- Validation ensures HTTPS protocol and removes trailing slashes
- Invalid gateways fall back to default with warning log
- Gateway logged at INFO level during startup
- All subsequent URL construction uses immutable gateway reference

**Security and Stability**:
- Rejects HTTP gateways (HTTPS only)
- Removes trailing slashes to prevent double-slash URLs
- Rejects malformed URLs with fallback to default
- Prevents mid-session gateway changes (immutable after initialization)

**Configuration**:
- Environment variable: `ODYSEE_CDN_GATEWAY`
- Default: `https://cloud.odysee.live`
- Example: `ODYSEE_CDN_GATEWAY=https://custom-cdn.example.com`

### 3. Stream Type Validation

**Purpose**: Validate that claims are streams before constructing playback URLs

**Implementation**:
```rust
fn is_stream_claim(item: &Value) -> bool {
    // Primary check: value_type == "stream"
    if let Some(value_type) = item.get("value_type").and_then(|v| v.as_str()) {
        return value_type == "stream";
    }
    
    // Fallback inference: presence of value.source.sd_hash
    if let Some(source) = item.get("value")
        .and_then(|v| v.get("source"))
        .and_then(|s| s.get("sd_hash")) {
        log::warn!("Ambiguous claim structure: missing value_type but has source.sd_hash, inferring stream");
        return true;
    }
    
    false
}
```

**Behavior**:
- **Primary check**: Prefer explicit `value_type == "stream"`
- **Fallback inference**: If `value_type` missing, check for `value.source.sd_hash`
- **Ambiguity logging**: Log at WARN level when structure is ambiguous
- **Non-stream handling**: Skip channels, reposts, collections, etc.
- **Rationale**: Odysee API structure varies by version; dual-check prevents silent breakage

**Claim Types**:
- **stream**: Video content (eligible for playback)
- **channel**: Channel metadata (skip)
- **repost**: Repost reference (skip)
- **collection**: Playlist/collection (skip)


### 4. Refactored extract_video_urls Function

**Purpose**: Extract claim_id and construct CDN playback URL with stream validation (no longer attempts direct URL extraction)

**Function Signature**:
```rust
fn extract_video_urls(item: &Value, gateway: &str) -> Result<HashMap<String, VideoUrl>>
```

**Inputs**:
- `item`: JSON value containing claim metadata
- `gateway`: CDN gateway from immutable state

**Output**:
- `Result<HashMap<String, VideoUrl>>` containing single "master" quality entry with HLS URL
- Error if claim_id is missing or claim is not a stream

**Behavior**:
1. Validate claim is stream type using `is_stream_claim(item)`
2. If not stream, return error with claim type context
3. Extract claim_id from `item.get("claim_id")`
4. If claim_id is missing or empty, return error with context
5. Call `build_cdn_playback_url(claim_id, gateway)`
6. Create VideoUrl struct with:
   - `url`: CDN playback URL
   - `quality`: "master" (HLS adaptive streaming)
   - `url_type`: "hls"
   - `codec`: None
7. Insert into HashMap with key "master"
8. Log constructed URL at DEBUG level (per-request, prevents spam)
9. Return HashMap

**Logging Levels (Idempotent Discipline)**:
- **INFO**: Gateway resolved at startup (once, lifecycle event)
- **DEBUG**: CDN URL constructed for claim_id (per-request, prevents spam on Hero refresh)
- **WARN**: Skipped claim (non-stream type, missing claim_id, ambiguous structure)
- **ERROR**: Structural parsing failure (malformed JSON, network errors)

**Removed Logic**:
- All attempts to read hd_url, sd_url, 720p_url
- All attempts to read streams array
- All attempts to read video.url
- All fallback conditional logic
- All quality-specific URL generation

**Future-Proof Comments**:
```rust
/// Future: Support multi-gateway fallback strategy for regional CDN failures
/// Current implementation uses single gateway resolved at startup
```

### 5. Updated parse_claim_item Function

**Purpose**: Parse claim metadata into ContentItem with strict error handling for required fields

**Changes**:
- Keep error propagation for missing claim_id (hard error)
- Keep error propagation for non-stream claims (skip with warning)
- extract_video_urls failure means claim_id is missing or non-stream, so propagate error
- Do NOT create ContentItem if claim_id is missing or claim is not a stream
- Caller (parse_claim_search_response) skips failed claims and continues with remaining items

**Behavior**:
```rust
// Validate stream type first
if !is_stream_claim(item) {
    let claim_type = item.get("value_type")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");
    return Err(format!("Skipping non-stream claim of type: {}", claim_type));
}

// extract_claim_id returns error if claim_id missing
let claim_id = extract_claim_id(item)?;

// extract_video_urls returns error if claim_id missing or non-stream
// This error propagates up, causing this claim to be skipped
let video_urls = extract_video_urls(item, get_cdn_gateway())?;

// If we reach here, claim_id exists, claim is stream, and video_urls constructed successfully
```

**Error Handling in Caller**:
```rust
// In parse_claim_search_response
for item in items {
    match parse_claim_item(item) {
        Ok(content_item) => results.push(content_item),
        Err(e) => {
            log::warn!("Skipping claim due to error: {}", e);
            // Continue processing remaining claims (partial success)
        }
    }
}
```

### 6. Backend Response Structure

**ContentItem Structure** (existing, with clarifications):
```rust
pub struct ContentItem {
    pub claim_id: String,           // Required
    pub title: String,              // Required
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub thumbnail_url: Option<String>,
    pub duration: Option<u32>,
    pub release_time: i64,
    pub video_urls: HashMap<String, VideoUrl>, // Now contains single "master" entry
    pub compatibility: CompatibilityInfo,
    pub etag: Option<String>,
    pub content_hash: Option<String>,
    pub raw_json: Option<String>,
}
```

**VideoUrl Structure** (existing, unchanged):
```rust
pub struct VideoUrl {
    pub url: String,           // CDN playback URL
    pub quality: String,       // "master" for HLS adaptive
    pub url_type: String,      // "hls"
    pub codec: Option<String>, // None for HLS master playlist
}
```

**Frontend Contract**:
- Frontend receives ContentItem array from Tauri commands
- Each ContentItem contains `video_urls` HashMap with "master" entry
- Access playback URL via: `item.video_urls.get("master").map(|v| &v.url)`
- All ContentItems in response have valid playback URLs (items without claim_id or non-stream claims are excluded by backend)
- Frontend expects single HLS master playlist URL (no quality selector needed)

### 7. Development-Mode CDN Validation (Optional, Non-Blocking)

**Purpose**: Validate CDN reachability in development mode without blocking production playback

**Implementation**:
```rust
#[cfg(debug_assertions)]
fn validate_cdn_reachability(url: &str) {
    use std::time::Duration;
    
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .unwrap();
    
    match client.head(url).send() {
        Ok(response) => {
            let status = response.status();
            if status.is_success() {
                log::debug!("CDN reachability OK: {}", url);
            } else if status == 403 {
                log::debug!("CDN returned 403 for {}: possible auth requirement", url);
            } else {
                log::debug!("CDN returned {} for {}", status, url);
            }
        }
        Err(e) => {
            log::debug!("CDN reachability check failed for {}: {}", url, e);
        }
    }
}
```

**Behavior**:
- Only active in development builds (`#[cfg(debug_assertions)]`)
- Uses HEAD request with 1-2 second timeout
- Non-blocking: does not affect URL construction or return
- All results logged at DEBUG level (not ERROR)
- Prevents dev server hangs if CDN is slow
- Provides early warning if CDN behavior changes (requires headers, returns 403, changes URL pattern)

**Rationale**:
- If CDN changes behavior, logs provide early warning
- Does not break production playback
- Timeout prevents dev build hangs
- DEBUG logging prevents noise in production logs


## Data Models

### VideoUrl (Existing, Usage Clarified)

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoUrl {
    pub url: String,           // Full CDN playback URL
    pub quality: String,       // "master" for HLS adaptive streaming
    #[serde(rename = "type")]
    pub url_type: String,      // "hls" for HLS streams
    pub codec: Option<String>, // None for master playlists
}
```

**New Usage Pattern**:
- Single entry per ContentItem with key "master"
- `url`: `{gateway}/content/{claim_id}/master.m3u8`
- `quality`: Always "master"
- `url_type`: Always "hls"
- `codec`: Always None

### ContentItem (Existing, Behavior Clarified)

```rust
pub struct ContentItem {
    pub claim_id: String,
    pub title: String,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub thumbnail_url: Option<String>,
    pub duration: Option<u32>,
    pub release_time: i64,
    pub video_urls: HashMap<String, VideoUrl>, // Always contains "master" entry
    pub compatibility: CompatibilityInfo,
    pub etag: Option<String>,
    pub content_hash: Option<String>,
    pub raw_json: Option<String>,
}
```

**Behavior Changes**:
- `video_urls` always contains at least one entry ("master" with CDN URL)
- ContentItem is only created if claim_id exists and claim is stream type
- Items without claim_id or non-stream claims are excluded during parsing

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Missing Direct URL Fields Do Not Cause Errors

*For any* claim metadata that contains a valid claim_id and is a stream type but is missing direct URL fields (hd_url, sd_url, streams, video.url), processing the claim should succeed and return a valid ContentItem with CDN-constructed playback URL.

**Validates: Requirements 1.5, 2.5**

### Property 2: Valid claim_id Always Produces CDN Playback URL

*For any* claim metadata containing a non-empty claim_id string and stream type, the CDN builder should produce a playback URL that:
- Is a non-empty string
- Starts with the configured gateway base URL
- Contains the claim_id in the path
- Ends with `/{HLS_MASTER_PLAYLIST}`
- Produces the same URL when called multiple times with the same inputs (deterministic)

**Validates: Requirements 2.3, 3.2, 3.3, 3.6, 3.8, 3.9, 7.5**

### Property 3: Missing claim_id Returns Error

*For any* claim metadata where claim_id is missing, empty, or null, the extract_video_urls function should return an error and not produce a ContentItem.

**Validates: Requirements 2.4**

### Property 4: Backend Response Contains Required Fields

*For any* successfully processed claim with valid claim_id and stream type, the resulting ContentItem should contain:
- claim_id (non-empty string)
- title (non-empty string)
- video_urls HashMap with at least one entry
- playback_url accessible via video_urls.get("master")
- tags (may be empty array)
- thumbnail_url (may be None)

**Validates: Requirements 4.1, 4.8**

### Property 5: Partial Success When Processing Multiple Claims

*For any* list of claim metadata where some claims have valid claim_id and stream type and others have missing claim_id or non-stream type, the parsing function should:
- Return ContentItems for all claims with valid claim_id and stream type
- Not fail the entire batch due to individual claim failures
- Produce a result list with length equal to the number of valid stream claims

**Validates: Requirements 4.3, 4.4**

### Property 6: Error Details Are Structured

*For any* error condition (missing claim_id, non-stream type, malformed JSON), the error should contain:
- Error type/category
- Contextual information (which claim failed)
- Human-readable message

**Validates: Requirements 4.6**

### Property 7: CDN URL Construction Is Idempotent

*For any* claim_id and gateway configuration, calling the CDN builder multiple times should produce identical URLs (no randomness, no state dependency).

**Validates: Requirements 3.6**


## Error Handling

### Error Categories and Responses

**1. Missing claim_id**
- **Severity**: Error
- **Action**: Skip claim, log warning with context
- **User Impact**: Claim not displayed
- **Log Format**: `log::warn!("Missing claim_id in item")`

**2. Empty claim_id**
- **Severity**: Error
- **Action**: Skip claim, log warning
- **User Impact**: Claim not displayed
- **Log Format**: `log::warn!("Empty claim_id in item")`

**3. Non-stream claim type**
- **Severity**: Warning
- **Action**: Skip claim, log warning with claim_id and type
- **User Impact**: Claim not displayed (correct behavior)
- **Log Format**: `log::warn!("Skipping non-stream claim {}: type={}", claim_id, claim_type)`

**4. Ambiguous claim structure**
- **Severity**: Warning
- **Action**: Infer stream type from source.sd_hash, log warning, continue processing
- **User Impact**: None (claim processed successfully)
- **Log Format**: `log::warn!("Ambiguous claim structure for {}: missing value_type but has source.sd_hash, inferring stream", claim_id)`

**5. Missing title**
- **Severity**: Error
- **Action**: Skip claim, log warning
- **User Impact**: Claim not displayed
- **Log Format**: `log::warn!("Missing title for claim {}", claim_id)`

**6. Missing direct URL fields (hd_url, sd_url, etc.)**
- **Severity**: None (not an error in new architecture)
- **Action**: Construct CDN URL, continue processing
- **User Impact**: None (CDN URL used)
- **Log Format**: `log::debug!("Constructed CDN URL for claim {}: {}", claim_id, url)`

**7. Missing optional metadata (thumbnail, duration, description)**
- **Severity**: None
- **Action**: Set field to None, continue processing
- **User Impact**: Reduced metadata display
- **Log Format**: No logging needed

**8. Network error during claim_search**
- **Severity**: Error
- **Action**: Return error to frontend
- **User Impact**: Section shows error state
- **Log Format**: `log::error!("Failed to fetch claims from API: {}", error)`

**9. CDN unreachable (during video playback)**
- **Severity**: Playback error (frontend concern)
- **Action**: Frontend video player handles error
- **User Impact**: Video player shows error, user can retry
- **Log Format**: N/A (handled by frontend HLS.js player)

**10. Empty claim_search results**
- **Severity**: Info
- **Action**: Return empty array to frontend
- **User Impact**: Section shows "no content" state
- **Log Format**: `log::info!("No claims found for query")`

**11. Invalid gateway configuration**
- **Severity**: Warning
- **Action**: Fall back to default gateway, log warning
- **User Impact**: None (default gateway used)
- **Log Format**: `log::warn!("Invalid gateway '{}', must use HTTPS. Falling back to default.", gateway)`

### Error Propagation Rules

**Backend to Frontend**:
- Network errors during claim_search → Frontend error state
- Empty results from API → Frontend empty state
- Partial success (some claims valid, some invalid) → Frontend renders available items
- All claims failed parsing (but API succeeded) → Frontend empty state

**Within Backend**:
- Individual claim parsing errors → Log and skip claim
- Batch processing continues despite individual failures
- Only fail entire batch if network/API error occurs during claim_search

**CDN Playback Errors**:
- Backend does NOT validate CDN reachability in production
- Backend only constructs CDN URLs
- CDN network errors surface in frontend video player (HLS.js)
- Frontend handles playback errors independently

### Non-Blocking Error Handling

**Section Independence**:
- Hero section failure does not affect Series section
- Series section failure does not affect Movies section
- Each section makes independent backend calls
- Each section handles its own error states

**Implementation**:
- Frontend makes separate Tauri command calls per section
- Each call has independent error handling
- No shared error state between sections


## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests**: Verify specific examples, edge cases, and error conditions
**Property Tests**: Verify universal properties across all inputs

Both approaches are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across a wide range of inputs.

### Property-Based Testing

**Library**: Use `quickcheck` crate for Rust property-based testing

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with comment referencing design property
- Tag format: `// Feature: odysee-cdn-playback-standardization, Property {number}: {property_text}`

**Property Test Coverage**:

1. **Property 1 Test**: Generate random claim metadata with valid claim_id and stream type but missing all direct URL fields, verify successful processing
   - Tag: `// Feature: odysee-cdn-playback-standardization, Property 1: Missing Direct URL Fields Do Not Cause Errors`

2. **Property 2 Test**: Generate random claim_id strings and stream claims, verify CDN URL format and determinism
   - Tag: `// Feature: odysee-cdn-playback-standardization, Property 2: Valid claim_id Always Produces CDN Playback URL`

3. **Property 3 Test**: Generate claim metadata with missing/empty claim_id, verify error returned
   - Tag: `// Feature: odysee-cdn-playback-standardization, Property 3: Missing claim_id Returns Error`

4. **Property 4 Test**: Generate random valid stream claims, verify response structure contains required fields
   - Tag: `// Feature: odysee-cdn-playback-standardization, Property 4: Backend Response Contains Required Fields`

5. **Property 5 Test**: Generate lists with mix of valid stream claims, non-stream claims, and invalid claims, verify partial success
   - Tag: `// Feature: odysee-cdn-playback-standardization, Property 5: Partial Success When Processing Multiple Claims`

6. **Property 6 Test**: Generate error conditions, verify error structure
   - Tag: `// Feature: odysee-cdn-playback-standardization, Property 6: Error Details Are Structured`

7. **Property 7 Test**: Generate random claim_id and gateway, call builder multiple times, verify identical output
   - Tag: `// Feature: odysee-cdn-playback-standardization, Property 7: CDN URL Construction Is Idempotent`

### Unit Testing

**Unit Test Coverage**:

1. **CDN Builder Tests**:
   - Test with default gateway
   - Test with custom gateway
   - Test URL format matches pattern
   - Test with special characters in claim_id
   - Test HLS_MASTER_PLAYLIST constant usage

2. **Gateway Configuration Tests**:
   - Test with ODYSEE_CDN_GATEWAY set
   - Test with ODYSEE_CDN_GATEWAY not set (uses default)
   - Test gateway sanitization (HTTPS enforcement, trailing slash removal)
   - Test invalid gateway fallback

3. **Stream Validation Tests**:
   - Test with explicit value_type == "stream"
   - Test with missing value_type but has source.sd_hash
   - Test with non-stream types (channel, repost, collection)
   - Test ambiguous structure logging

4. **extract_video_urls Tests**:
   - Test with valid claim_id and stream type
   - Test with missing claim_id
   - Test with empty claim_id
   - Test with non-stream claim types
   - Test that direct URL fields are ignored
   - Test logging behavior at appropriate levels

5. **parse_claim_item Tests**:
   - Test successful parsing with all fields
   - Test successful parsing with minimal fields
   - Test claim skipped when claim_id missing
   - Test claim skipped when non-stream type
   - Test error propagation for missing claim_id

6. **Integration Tests**:
   - Test Hero section with valid stream claim
   - Test Hero section with missing direct URLs
   - Test Hero section with non-stream claim tagged hero_trailer
   - Test Series section with partial success
   - Test Movies section with all failures
   - Test section independence (Hero failure doesn't affect Series)

7. **Logging Tests**:
   - Verify gateway logged at INFO level during startup
   - Verify claim_id logged at DEBUG level when constructing URL
   - Verify skipped claims logged at WARN level
   - Verify errors logged at ERROR level with context
   - Verify no warnings for missing direct URLs

### Test Data Generation

**For Property Tests**:
- Generate random claim_id strings (alphanumeric, 20-40 chars)
- Generate random gateway URLs (valid HTTPS URLs)
- Generate claim metadata with random combinations of present/missing fields
- Generate lists of 1-100 claims with random validity and types
- Generate stream and non-stream claim types

**For Unit Tests**:
- Use realistic Odysee API response examples
- Include edge cases: empty strings, null values, malformed JSON
- Include special characters: Unicode, URL-unsafe characters
- Include boundary cases: very long claim_ids, very short claim_ids
- Include various claim types: stream, channel, repost, collection

### Regression Testing

**Preserve Existing Functionality**:
- Run existing test suite to ensure no regressions
- Verify tag-based content discovery still works
- Verify filtering logic unchanged
- Verify playlist logic unchanged
- Verify frontend can still parse responses

**Test Existing Sections**:
- Hero section loads with hero_trailer tag
- Series section groups content correctly
- Movies section filters correctly
- All sections handle empty results gracefully

## Production Hardening Considerations

### Gateway Resolution
- Gateway resolved once at startup (immutable state)
- Prevents mid-session inconsistency if environment variable changes
- Logged at INFO level for operational visibility

### Claim Type Validation
- Stream-only validation prevents 404 errors from non-stream claims
- Dual-check strategy (value_type + source.sd_hash) handles API version variations
- Ambiguous structures logged for monitoring

### HLS Playlist Naming
- Centralized HLS_MASTER_PLAYLIST constant
- Single update point if Odysee changes naming convention
- Future-proof architectural decision

### Logging Level Separation
- INFO: Lifecycle events (gateway resolution)
- DEBUG: Per-request operations (URL construction, reachability checks)
- WARN: Skipped claims (non-stream, missing data, ambiguous structure)
- ERROR: Structural failures (network errors, malformed JSON)
- Prevents production log noise while maintaining diagnostic capability

### CDN Failure Strategy
- Future-proof comments document multi-gateway fallback consideration
- Error logging includes claim_id context for future failover implementation
- Architecture does not preclude future enhancements

### Frontend Assumptions
- Single HLS master playlist URL (no quality selector)
- Frontend player handles adaptive streaming
- No multi-quality URL dependencies

### Safety Measures
- Feature branch isolation
- Pre-merge safety checkpoints
- Documented rollback procedure
- Partial success guarantee (batch processing continues despite individual failures)

