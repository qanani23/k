# Task 16.2: Odysee Issue Debugging - Next Steps

**Phase:** Phase 3 - Architecture Re-Stabilization  
**Task:** 16.2 Outline next steps for Odysee issue debugging  
**Date:** 2026-02-25  
**Status:** ✅ COMPLETE

---

## Executive Summary

This document outlines the next steps for debugging Odysee playback issues in Kiyya Desktop after Phase 3 stabilization is complete. It identifies critical tracing points in the content pipeline, documents expected vs actual behavior, and proposes an isolated failure layer hypothesis to guide systematic debugging.

**Key Deliverables:**
1. **Tracing Points** - 8 critical instrumentation points in the content pipeline
2. **Expected vs Actual Behavior** - Detailed comparison for each pipeline stage
3. **Failure Layer Hypothesis** - 5 isolated failure scenarios with diagnostic tests
4. **Debug Workflow** - Step-by-step debugging procedure

---

## Table of Contents

1. [Content Pipeline Overview](#content-pipeline-overview)
2. [Tracing Points to Add](#tracing-points-to-add)
3. [Expected vs Actual Behavior](#expected-vs-actual-behavior)
4. [Isolated Failure Layer Hypothesis](#isolated-failure-layer-hypothesis)
5. [Debug Workflow](#debug-workflow)
6. [Success Criteria](#success-criteria)

---

## Content Pipeline Overview

The Odysee content pipeline consists of 8 distinct stages from user request to playback:

```
User Request
  ↓
1. Claim Search/Fetch (gateway.rs)
  ↓
2. Claim Parsing (models.rs)
  ↓
3. Stream Validation (validation.rs)
  ↓
4. CDN URL Construction (commands.rs)
  ↓
5. Backend Return (Tauri IPC)
  ↓
6. Frontend Receive (API wrapper)
  ↓
7. Player Mount (React component)
  ↓
8. Playback Start (Plyr + hls.js)
```


Each stage has specific inputs, outputs, and potential failure modes. Systematic tracing at each stage will isolate the exact failure point.

---

## Tracing Points to Add

### Tracing Point 1: Claim Search Entry

**Location:** `src-tauri/src/gateway.rs` - `fetch_channel_claims()` function entry

**Purpose:** Verify request parameters and gateway selection

**Instrumentation:**
```rust
info!(
    "🔍 TRACE-1: Claim search initiated",
    channel_id = %channel_id,
    any_tags = ?any_tags,
    limit = limit,
    gateway = %self.current_gateway_url(),
    correlation_id = %correlation_id
);
```

**What to Capture:**
- Channel ID being requested
- Tag filters applied
- Result limit
- Selected gateway URL
- Correlation ID for request tracking

**Expected Output:**
```
[INFO] 🔍 TRACE-1: Claim search initiated channel_id="@kiyyamovies:b" any_tags=["movies"] limit=50 gateway="https://api.odysee.com" correlation_id="req-abc123"
```

---

### Tracing Point 2: API Request/Response

**Location:** `src-tauri/src/gateway.rs` - After HTTP request execution

**Purpose:** Verify API connectivity and response status

**Instrumentation:**
```rust
info!(
    "📡 TRACE-2: API request completed",
    status = response.status().as_u16(),
    response_size = response.content_length().unwrap_or(0),
    duration_ms = start_time.elapsed().as_millis(),
    correlation_id = %correlation_id
);

debug!(
    "📥 TRACE-2-DETAIL: Response body preview",
    body_preview = &response_text[..min(500, response_text.len())],
    correlation_id = %correlation_id
);
```

**What to Capture:**
- HTTP status code (200, 404, 500, etc.)
- Response body size
- Request duration
- Response body preview (first 500 chars)

**Expected Output:**
```
[INFO] 📡 TRACE-2: API request completed status=200 response_size=45678 duration_ms=234 correlation_id="req-abc123"
[DEBUG] 📥 TRACE-2-DETAIL: Response body preview body_preview="{\"items\":[{\"claim_id\":\"abc123\"..." correlation_id="req-abc123"
```

---

### Tracing Point 3: Claim Parsing

**Location:** `src-tauri/src/models.rs` - Claim deserialization

**Purpose:** Verify JSON parsing and claim structure

**Instrumentation:**
```rust
info!(
    "🔧 TRACE-3: Parsing claims",
    raw_claim_count = raw_items.len(),
    correlation_id = %correlation_id
);

for (idx, claim) in parsed_claims.iter().enumerate() {
    debug!(
        "✅ TRACE-3-CLAIM: Claim parsed successfully",
        index = idx,
        claim_id = %claim.claim_id,
        name = %claim.name,
        has_thumbnail = claim.thumbnail_url.is_some(),
        has_stream = claim.value.stream.is_some(),
        correlation_id = %correlation_id
    );
}
```

**What to Capture:**
- Number of claims in response
- Each claim's ID and name
- Presence of thumbnail URL
- Presence of stream data
- Parse errors (if any)

**Expected Output:**
```
[INFO] 🔧 TRACE-3: Parsing claims raw_claim_count=50 correlation_id="req-abc123"
[DEBUG] ✅ TRACE-3-CLAIM: Claim parsed successfully index=0 claim_id="abc123" name="Movie Title" has_thumbnail=true has_stream=true correlation_id="req-abc123"
```

---

### Tracing Point 4: Stream Validation

**Location:** `src-tauri/src/validation.rs` - Stream validation logic

**Purpose:** Verify stream data structure and required fields

**Instrumentation:**
```rust
info!(
    "🎬 TRACE-4: Validating stream",
    claim_id = %claim_id,
    has_source = claim.value.stream.as_ref().and_then(|s| s.source.as_ref()).is_some(),
    media_type = claim.value.stream.as_ref()
        .and_then(|s| s.source.as_ref())
        .and_then(|src| src.media_type.as_ref())
        .unwrap_or("unknown"),
    correlation_id = %correlation_id
);
```

**What to Capture:**
- Claim ID being validated
- Presence of stream.source
- Media type (video/mp4, etc.)
- Validation result (pass/fail)

**Expected Output:**
```
[INFO] 🎬 TRACE-4: Validating stream claim_id="abc123" has_source=true media_type="video/mp4" correlation_id="req-abc123"
```

---

### Tracing Point 5: CDN URL Construction

**Location:** `src-tauri/src/commands.rs` - `build_cdn_playback_url()` function

**Purpose:** Verify CDN URL generation logic

**Instrumentation:**
```rust
info!(
    "🌐 TRACE-5: Building CDN URL",
    claim_id = %claim_id,
    gateway = %gateway_url,
    url_pattern = "gateway/content/claim_id/master.m3u8",
    correlation_id = %correlation_id
);

let cdn_url = format!("{}/content/{}/master.m3u8", gateway_url, claim_id);

info!(
    "✅ TRACE-5-RESULT: CDN URL constructed",
    cdn_url = %cdn_url,
    url_length = cdn_url.len(),
    correlation_id = %correlation_id
);
```

**What to Capture:**
- Claim ID used
- Gateway URL used
- Final CDN URL
- URL length (sanity check)

**Expected Output:**
```
[INFO] 🌐 TRACE-5: Building CDN URL claim_id="abc123" gateway="https://cloud.odysee.live" url_pattern="gateway/content/claim_id/master.m3u8" correlation_id="req-abc123"
[INFO] ✅ TRACE-5-RESULT: CDN URL constructed cdn_url="https://cloud.odysee.live/content/abc123/master.m3u8" url_length=67 correlation_id="req-abc123"
```

---

### Tracing Point 6: Backend Return

**Location:** `src-tauri/src/commands.rs` - Before returning from Tauri command

**Purpose:** Verify data being sent to frontend

**Instrumentation:**
```rust
info!(
    "📤 TRACE-6: Returning claims to frontend",
    claim_count = claims.len(),
    first_claim_id = claims.first().map(|c| c.claim_id.as_str()).unwrap_or("none"),
    correlation_id = %correlation_id
);
```

**What to Capture:**
- Number of claims being returned
- First claim ID (sanity check)
- Serialization success

**Expected Output:**
```
[INFO] 📤 TRACE-6: Returning claims to frontend claim_count=50 first_claim_id="abc123" correlation_id="req-abc123"
```

---

### Tracing Point 7: Frontend Receive

**Location:** `src/api/tauri.ts` - After `invoke()` resolves

**Purpose:** Verify frontend receives data from backend

**Instrumentation:**
```typescript
console.log('📥 TRACE-7: Frontend received claims', {
  claimCount: claims.length,
  firstClaimId: claims[0]?.claim_id || 'none',
  firstClaimName: claims[0]?.name || 'none',
  correlationId: 'req-abc123' // Pass from backend if possible
});
```

**What to Capture:**
- Number of claims received
- First claim details
- Data structure validity

**Expected Output:**
```
📥 TRACE-7: Frontend received claims {claimCount: 50, firstClaimId: "abc123", firstClaimName: "Movie Title", correlationId: "req-abc123"}
```

---

### Tracing Point 8: Player Mount

**Location:** `src/components/PlayerModal.tsx` - When player initializes

**Purpose:** Verify player receives URL and attempts playback

**Instrumentation:**
```typescript
console.log('🎬 TRACE-8: Player mounting', {
  claimId: claim.claim_id,
  cdnUrl: playbackUrl,
  playerReady: !!playerRef.current,
  correlationId: 'req-abc123'
});
```

**What to Capture:**
- Claim ID being played
- CDN URL passed to player
- Player initialization status

**Expected Output:**
```
🎬 TRACE-8: Player mounting {claimId: "abc123", cdnUrl: "https://cloud.odysee.live/content/abc123/master.m3u8", playerReady: true, correlationId: "req-abc123"}
```

---

## Expected vs Actual Behavior

### Stage 1: Claim Search/Fetch

**Expected Behavior:**
- Backend receives `fetch_channel_claims` command with valid channel ID
- Gateway client selects primary gateway (api.odysee.com)
- HTTP request sent with proper headers and parameters
- Response received with status 200 OK
- Response body contains JSON with `items` array

**Actual Behavior (Document During Debug):**
- [ ] Command received: YES / NO
- [ ] Gateway selected: _____________
- [ ] HTTP status: _____________
- [ ] Response size: _____________
- [ ] Items array present: YES / NO

**Failure Indicators:**
- Status != 200 → API connectivity issue
- Empty items array → Channel not found or no content
- Timeout → Network issue or gateway down
- Parse error → Malformed JSON response

---

### Stage 2: Claim Parsing

**Expected Behavior:**
- JSON response deserialized into `Vec<Claim>`
- Each claim has required fields: `claim_id`, `name`, `value`
- Stream data present in `value.stream`
- Thumbnail URL extracted (if available)

**Actual Behavior (Document During Debug):**
- [ ] Claims parsed: ___ / ___ (success / total)
- [ ] Parse errors: _____________
- [ ] Missing fields: _____________
- [ ] Stream data present: YES / NO

**Failure Indicators:**
- Parse errors → API response format changed
- Missing claim_id → Invalid claim structure
- Missing stream → Content not playable
- Null/empty fields → Incomplete data

---

### Stage 3: Stream Validation

**Expected Behavior:**
- Stream object exists in claim.value.stream
- Source object exists in stream.source
- Media type is video/* (video/mp4, video/webm, etc.)
- Validation passes for all playable content

**Actual Behavior (Document During Debug):**
- [ ] Stream present: YES / NO
- [ ] Source present: YES / NO
- [ ] Media type: _____________
- [ ] Validation result: PASS / FAIL

**Failure Indicators:**
- Missing stream → Claim is not video content
- Missing source → Incomplete stream data
- Invalid media type → Unsupported format
- Validation fails → Content not playable

---

### Stage 4: CDN URL Construction

**Expected Behavior:**
- Gateway URL retrieved (cloud.odysee.live or fallback)
- CDN URL constructed: `{gateway}/content/{claim_id}/master.m3u8`
- URL format validated (HTTPS, proper structure)
- URL returned to frontend

**Actual Behavior (Document During Debug):**
- [ ] Gateway URL: _____________
- [ ] CDN URL: _____________
- [ ] URL format valid: YES / NO
- [ ] URL accessible: YES / NO (test with curl)

**Failure Indicators:**
- Wrong gateway → CDN URL won't work
- Malformed URL → Player can't load
- URL not HTTPS → Security error
- URL returns 404 → Claim not on CDN

---

### Stage 5: Backend Return

**Expected Behavior:**
- Claims serialized to JSON
- Tauri IPC sends data to frontend
- No serialization errors
- Frontend receives complete data

**Actual Behavior (Document During Debug):**
- [ ] Serialization success: YES / NO
- [ ] IPC transmission: SUCCESS / TIMEOUT / ERROR
- [ ] Data received by frontend: YES / NO
- [ ] Data integrity: INTACT / CORRUPTED

**Failure Indicators:**
- Serialization error → Data structure issue
- IPC timeout → Backend hung or slow
- No data received → IPC broken
- Corrupted data → Serialization bug

---

### Stage 6: Frontend Receive

**Expected Behavior:**
- Frontend `invoke()` promise resolves
- Claims array received with correct length
- Each claim has required fields
- Data structure matches TypeScript types

**Actual Behavior (Document During Debug):**
- [ ] Promise resolved: YES / NO
- [ ] Claims count: _____________
- [ ] Data structure valid: YES / NO
- [ ] TypeScript errors: _____________

**Failure Indicators:**
- Promise rejects → Backend error
- Empty array → No data returned
- Type mismatch → Data structure changed
- Missing fields → Incomplete data

---

### Stage 7: Player Mount

**Expected Behavior:**
- Player component receives claim data
- CDN URL extracted from claim
- Plyr player initialized
- HLS.js attached to player (if needed)
- Player ready for playback

**Actual Behavior (Document During Debug):**
- [ ] Component mounted: YES / NO
- [ ] CDN URL extracted: YES / NO
- [ ] Player initialized: YES / NO
- [ ] HLS.js attached: YES / NO
- [ ] Player ready: YES / NO

**Failure Indicators:**
- Component not mounted → React error
- No CDN URL → Data missing
- Player not initialized → Library error
- HLS.js not attached → Format issue
- Player not ready → Configuration error

---

### Stage 8: Playback Start

**Expected Behavior:**
- Player loads CDN URL
- HLS manifest fetched (master.m3u8)
- Video segments loaded
- Playback starts without errors
- User sees video playing

**Actual Behavior (Document During Debug):**
- [ ] Manifest fetched: YES / NO
- [ ] Segments loaded: YES / NO
- [ ] Playback started: YES / NO
- [ ] Errors in console: _____________
- [ ] Network errors: _____________

**Failure Indicators:**
- Manifest 404 → CDN URL wrong
- Manifest 403 → Authentication required
- Segments fail → CDN issue
- CORS error → Security policy
- Player error → Format incompatibility

---

## Isolated Failure Layer Hypothesis

Based on the pipeline stages, the failure is likely isolated to one of these layers:

### Hypothesis 1: API Layer Failure

**Symptoms:**
- No claims returned from backend
- Empty items array in API response
- HTTP errors (404, 500, timeout)

**Diagnostic Test:**
```bash
# Test API directly
curl -X POST "https://api.odysee.com/api/v1/proxy" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "claim_search",
    "params": {
      "channel": "@kiyyamovies:b",
      "any_tags": ["movies"],
      "page_size": 10
    }
  }'
```

**Expected Result:** JSON response with items array containing claims

**If Fails:**
- Check network connectivity
- Verify API endpoint is correct
- Check for rate limiting
- Try alternative gateway

**Fix Strategy:**
- Update API endpoint if changed
- Implement rate limit handling
- Add retry logic with exponential backoff

---

### Hypothesis 2: Parsing Layer Failure

**Symptoms:**
- API returns data but parsing fails
- Deserialization errors in logs
- Missing fields in parsed claims

**Diagnostic Test:**
```rust
// Add detailed parse error logging
match serde_json::from_str::<ApiResponse>(&response_text) {
    Ok(data) => info!("Parse success: {} items", data.items.len()),
    Err(e) => {
        error!("Parse failed: {}", e);
        error!("Response preview: {}", &response_text[..min(1000, response_text.len())]);
    }
}
```

**Expected Result:** Successful deserialization with all required fields

**If Fails:**
- API response format changed
- New required fields added
- Field types changed

**Fix Strategy:**
- Update Claim struct to match new API format
- Add optional fields with `Option<T>`
- Add defensive parsing with defaults

---

### Hypothesis 3: CDN Layer Failure

**Symptoms:**
- Claims parsed successfully
- CDN URL constructed
- URL returns 404 or 403

**Diagnostic Test:**
```bash
# Test CDN URL directly
curl -I "https://cloud.odysee.live/content/abc123/master.m3u8"
```

**Expected Result:** HTTP 200 OK with HLS manifest

**If Fails:**
- CDN gateway URL changed
- Claim not available on CDN
- Authentication required
- URL pattern changed

**Fix Strategy:**
- Update CDN gateway URL
- Add authentication headers if needed
- Update URL pattern to match CDN changes
- Implement CDN gateway failover

---

### Hypothesis 4: Player Layer Failure

**Symptoms:**
- CDN URL accessible (curl works)
- Player component mounts
- Playback doesn't start

**Diagnostic Test:**
```javascript
// Test player with simple video URL
const testUrl = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
player.source = {
  type: 'video',
  sources: [{ src: testUrl, type: 'application/x-mpegURL' }]
};
```

**Expected Result:** Test video plays successfully

**If Fails:**
- Player library issue
- HLS.js not working
- CORS policy blocking
- Format incompatibility

**Fix Strategy:**
- Update Plyr or HLS.js version
- Configure CORS headers
- Add format detection and fallback
- Debug player configuration

---

### Hypothesis 5: IPC Layer Failure

**Symptoms:**
- Backend works (logs show success)
- Frontend doesn't receive data
- Invoke promise hangs or rejects

**Diagnostic Test:**
```javascript
// Test IPC connectivity
window.__TAURI__.invoke('test_connection')
  .then(res => console.log('IPC OK:', res))
  .catch(err => console.error('IPC FAIL:', err));
```

**Expected Result:** "tauri-backend-alive" returned

**If Fails:**
- Command not registered
- Async call not returning
- Serialization error
- IPC channel broken

**Fix Strategy:**
- Verify command registration in main.rs
- Add explicit return statements
- Fix serialization issues
- Check for async/await bugs

---

## Debug Workflow

### Step 1: Enable Tracing

1. Add all 8 tracing points to codebase
2. Set log level to DEBUG: `export LOG_LEVEL=DEBUG`
3. Rebuild application: `cargo build && npm run build`

### Step 2: Capture Baseline

1. Start application: `npm run tauri:dev`
2. Capture logs: `npm run tauri:dev 2>&1 | tee debug_baseline.txt`
3. Trigger content fetch (navigate to Movies page)
4. Save logs for analysis

### Step 3: Analyze Trace Output

1. Search for TRACE markers: `grep "TRACE-" debug_baseline.txt`
2. Identify last successful TRACE point
3. Identify first failed TRACE point
4. Failure is between these two points

### Step 4: Test Isolated Layer

1. Based on failure point, select hypothesis (1-5)
2. Run diagnostic test for that hypothesis
3. Document results in "Actual Behavior" section
4. If test passes, move to next hypothesis
5. If test fails, proceed to fix strategy

### Step 5: Implement Fix

1. Apply fix strategy from hypothesis
2. Rebuild and test
3. Verify all TRACE points now succeed
4. Run full integration test
5. Document fix in DECISIONS.md

### Step 6: Verify Fix

1. Test with reproducible claim: `node scripts/test_reproducible_claim.js`
2. Test with real channel: Navigate to Movies page
3. Test playback: Click on video and verify playback starts
4. Test edge cases: Empty channel, invalid claim, network error
5. Run full test suite: `cargo test && npm test`

---

## Success Criteria

Debugging is complete when:

- [ ] All 8 tracing points added to codebase
- [ ] Trace output captured for failing scenario
- [ ] Failure layer identified (API, Parsing, CDN, Player, or IPC)
- [ ] Diagnostic test executed for failure layer
- [ ] Root cause documented in "Actual Behavior" section
- [ ] Fix implemented and tested
- [ ] All TRACE points show success in logs
- [ ] Reproducible claim test passes
- [ ] Real channel content loads and plays
- [ ] Fix documented in stabilization/DECISIONS.md
- [ ] Integration tests updated to prevent regression

---

## References

- [ODYSEE_DEBUG_PLAYBOOK.md](./ODYSEE_DEBUG_PLAYBOOK.md) - Detailed debugging procedures
- [STEPS_TO_REPRODUCE.md](./STEPS_TO_REPRODUCE.md) - Testing instructions
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture
- [DECISIONS.md](./DECISIONS.md) - Architectural decisions

---

## Maintenance

This document should be updated:
- When new tracing points are added
- When failure hypotheses are validated or invalidated
- When fixes are implemented
- After each debugging session

**Last Updated:** 2026-02-25  
**Version:** 1.0  
**Maintainer:** Stabilization Team
