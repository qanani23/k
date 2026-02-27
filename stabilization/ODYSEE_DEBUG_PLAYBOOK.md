# Odysee Playback Debugging Playbook

## Overview

This playbook provides a systematic approach to debugging Odysee playback issues in Kiyya Desktop. It assumes Phase 3 stabilization is complete and provides step-by-step instructions for isolating and diagnosing playback problems.

## Prerequisites

Before beginning debugging, verify:

- ✅ **Phase 3 Complete:** Clean build with zero warnings
- ✅ **All Tests Pass:** `cargo test` and `npm test` succeed
- ✅ **Test Claim Available:** `tests/fixtures/claim_working.json` exists
- ✅ **IPC Verified:** `test_connection` command works
- ✅ **Development Environment:** Node.js, Rust, and Tauri installed

### Verify Prerequisites

```bash
# Check Phase 3 completion
cd src-tauri
cargo build --release
cargo test
cargo clippy -- -D warnings

# Verify test fixture exists
ls tests/fixtures/claim_working.json

# Check frontend
npm run lint
npm run build
```

All commands should complete successfully with zero errors.

## Debugging Workflow

### Phase 0: Enable Tracing Infrastructure

**NEW:** Kiyya Desktop now includes comprehensive tracing infrastructure that logs all 7 stages of the content pipeline. This provides precise visibility into where failures occur.

#### Step 0.1: Enable Backend Tracing

**Windows (PowerShell):**
```powershell
$env:RUST_LOG="debug"; npm run tauri:dev
```

**macOS/Linux (Bash):**
```bash
export RUST_LOG=debug
npm run tauri:dev
```

This enables detailed logging for all pipeline stages.

#### Step 0.2: Enable Frontend Tracing

Frontend tracing is automatically enabled in development mode. Open DevTools Console to see traces.

#### Step 0.3: Understand the 7 Pipeline Stages

The content pipeline consists of 7 stages:

1. **claim_search_call** - Backend sends API request to Odysee
2. **claim_parsing** - Backend parses API response
3. **stream_validation** - Backend validates stream data
4. **cdn_url_construction** - Backend constructs CDN playback URL
5. **backend_return** - Backend returns items to frontend via IPC
6. **frontend_receive** - Frontend receives items from backend
7. **player_mount** - Frontend player mounts and loads video

**Each stage is logged with structured data.** If any stage is missing or shows errors, that's the failure point.

#### Step 0.4: Collect Pipeline Traces

**Backend Traces:**
```bash
# View live logs
Get-Content "$env:APPDATA\kiyya-desktop\logs\kiyya.log.$(Get-Date -Format yyyy-MM-dd)" -Wait

# Or grep for pipeline traces
Select-String -Path "$env:APPDATA\kiyya-desktop\logs\kiyya.log.*" -Pattern "content_pipeline"
```

**Frontend Traces:**
- Open DevTools → Console
- Filter by "[TRACE]"
- Look for "Stage 1" through "Stage 7"

#### Step 0.5: Analyze Pipeline Flow

After triggering a content fetch, verify all 7 stages appear:

```
✓ Stage 1: claim_search_call - Request sent
✓ Stage 2: claim_parsing - Response parsed
✓ Stage 3: stream_validation - Stream validated
✓ Stage 4: cdn_url_construction - URL built
✓ Stage 5: backend_return - Items returned to frontend
✓ Stage 6: frontend_receive - Frontend received items
✓ Stage 7: player_mount - Player mounted with content
```

**If any stage is missing, that's where the failure occurs.**

For detailed information about the tracing infrastructure, see:
- `stabilization/TRACING_INFRASTRUCTURE.md` - Complete tracing documentation
- Includes expected vs actual behavior for each stage
- Includes isolated failure layer hypotheses

### Phase 1: Environment Setup

#### Step 1.1: Start Development Environment

Open two terminal windows:

**Terminal 1 - Frontend Dev Server:**
```bash
npm start
```

Wait for "Compiled successfully" message.

**Terminal 2 - Tauri Development:**
```bash
npm run tauri:dev
```

Wait for application window to open.

#### Step 1.2: Open Developer Tools

In the Kiyya Desktop application window:
- Windows/Linux: Press `Ctrl+Shift+I` or `F12`
- macOS: Press `Cmd+Option+I`

Navigate to the **Console** tab.

### Phase 2: IPC Connectivity Verification

#### Step 2.1: Test Basic IPC Connection

In the DevTools Console, run:

```javascript
window.__TAURI__.invoke('test_connection')
  .then(res => console.log('✓ IPC OK:', res))
  .catch(err => console.error('✗ IPC FAIL:', err));
```

**Expected Result:** `✓ IPC OK: tauri-backend-alive`

**If Failed:**
- Check Terminal 2 for backend errors
- Verify Tauri is running (window should be open)
- Restart `npm run tauri:dev`
- Check for port conflicts

#### Step 2.2: Test CDN URL Construction

```javascript
window.__TAURI__.invoke('build_cdn_playback_url_test', { 
  claim_id: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6' 
})
  .then(url => console.log('✓ CDN URL:', url))
  .catch(err => console.error('✗ URL construction failed:', err));
```

**Expected Result:** 
```
✓ CDN URL: https://cloud.odysee.live/content/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6/master.m3u8
```

**If Failed:**
- Check if `build_cdn_playback_url_test` command is registered
- Verify claim_id parameter is passed correctly
- Check Terminal 2 for Rust errors

### Phase 3: Channel Claims Fetch Testing

#### Step 3.1: Test Channel Claims Fetch

```javascript
// Test with Kiyya Movies channel
window.__TAURI__.invoke('fetch_channel_claims', { 
  channelId: '@kiyyamovies:b' 
})
  .then(claims => {
    console.log('✓ Claims fetched:', claims.length);
    console.log('First claim:', claims[0]);
    return claims;
  })
  .catch(err => console.error('✗ Fetch failed:', err));
```

**Expected Result:**
- Array of claim objects
- Each claim has: `claim_id`, `name`, `value`, `permanent_url`

**If Failed:**
- Check network connectivity
- Verify Odysee API is accessible
- Check Terminal 2 for HTTP errors
- Verify channel ID format is correct

#### Step 3.2: Inspect Claim Structure

If claims are returned, inspect the first claim:

```javascript
window.__TAURI__.invoke('fetch_channel_claims', { 
  channelId: '@kiyyamovies:b' 
})
  .then(claims => {
    const claim = claims[0];
    console.log('Claim ID:', claim.claim_id);
    console.log('Claim Name:', claim.name);
    console.log('Stream Source:', claim.value?.stream?.source);
    console.log('Media Type:', claim.value?.stream?.source?.media_type);
    return claim;
  });
```

**Verify:**
- `claim_id` exists and is a string
- `value.stream.source` exists
- `media_type` is present (e.g., "video/mp4")

### Phase 4: Playback URL Construction Testing

#### Step 4.1: Test URL Construction with Real Claim

Using a claim from Step 3.1:

```javascript
// Store claim from previous step
let testClaim = null;

window.__TAURI__.invoke('fetch_channel_claims', { 
  channelId: '@kiyyamovies:b' 
})
  .then(claims => {
    testClaim = claims[0];
    return window.__TAURI__.invoke('build_cdn_playback_url_test', { 
      claim_id: testClaim.claim_id 
    });
  })
  .then(url => {
    console.log('✓ Constructed URL:', url);
    console.log('For claim:', testClaim.name);
    return url;
  })
  .catch(err => console.error('✗ URL construction failed:', err));
```

**Expected Result:**
```
✓ Constructed URL: https://cloud.odysee.live/content/{claim_id}/master.m3u8
For claim: {video-name}
```

#### Step 4.2: Validate URL Format

```javascript
function validatePlaybackUrl(url) {
  const checks = {
    'HTTPS protocol': url.startsWith('https://'),
    'Odysee CDN domain': url.includes('cloud.odysee.live'),
    'Content path': url.includes('/content/'),
    'HLS manifest': url.endsWith('master.m3u8'),
    'Claim ID present': /\/content\/[a-zA-Z0-9]+\//.test(url)
  };
  
  console.log('URL Validation:');
  Object.entries(checks).forEach(([check, passed]) => {
    console.log(passed ? '✓' : '✗', check);
  });
  
  return Object.values(checks).every(v => v);
}

// Use with constructed URL
window.__TAURI__.invoke('build_cdn_playback_url_test', { 
  claim_id: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6' 
})
  .then(url => validatePlaybackUrl(url));
```

### Phase 5: Network Request Analysis

#### Step 5.1: Monitor Network Requests

1. In DevTools, switch to the **Network** tab
2. Clear existing requests (trash icon)
3. Execute a channel claims fetch:

```javascript
window.__TAURI__.invoke('fetch_channel_claims', { 
  channelId: '@kiyyamovies:b' 
})
  .then(claims => console.log('Claims:', claims.length));
```

4. Observe network requests in the Network tab

**Look for:**
- Requests to Odysee API endpoints
- HTTP status codes (200 = success, 4xx/5xx = errors)
- Response times
- Failed requests (red)

#### Step 5.2: Test CDN URL Accessibility

```javascript
async function testCdnUrl(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    console.log('✓ CDN Response:', response.status, response.statusText);
    return response.ok;
  } catch (err) {
    console.error('✗ CDN Request Failed:', err.message);
    return false;
  }
}

// Test with constructed URL
window.__TAURI__.invoke('build_cdn_playback_url_test', { 
  claim_id: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6' 
})
  .then(url => testCdnUrl(url));
```

**Expected Results:**
- 200 OK: URL is accessible
- 403 Forbidden: CDN access issue
- 404 Not Found: Claim doesn't exist or URL is incorrect

### Phase 6: Backend Log Analysis

#### Step 6.1: Capture Backend Logs

In Terminal 2 (where `npm run tauri:dev` is running), monitor output for:

- Error messages
- Panic messages
- HTTP request failures
- JSON parsing errors
- Tauri command invocations

#### Step 6.2: Save Logs to File

**Windows (PowerShell):**
```powershell
npm run tauri:dev 2>&1 | Tee-Object -FilePath stabilization/debug_output.txt
```

**macOS/Linux (Bash):**
```bash
npm run tauri:dev 2>&1 | tee stabilization/debug_output.txt
```

#### Step 6.3: Search Logs for Errors

```bash
# Search for errors
grep -i "error\|fail\|panic" stabilization/debug_output.txt

# Search for specific claim operations
grep -i "claim\|fetch\|cdn" stabilization/debug_output.txt

# Search for HTTP issues
grep -i "http\|request\|response" stabilization/debug_output.txt
```

### Phase 7: Test with Known Working Claim

#### Step 7.1: Load Test Fixture

```javascript
// Load the reproducible test claim
fetch('/tests/fixtures/claim_working.json')
  .then(r => r.json())
  .then(claim => {
    console.log('✓ Test claim loaded:', claim.claim_id);
    return claim;
  })
  .catch(err => console.error('✗ Failed to load fixture:', err));
```

#### Step 7.2: Test Full Pipeline with Fixture

```javascript
async function testFullPipeline() {
  try {
    // Load test claim
    const response = await fetch('/tests/fixtures/claim_working.json');
    const claim = await response.json();
    console.log('1. ✓ Loaded test claim:', claim.claim_id);
    
    // Construct playback URL
    const url = await window.__TAURI__.invoke('build_cdn_playback_url_test', { 
      claim_id: claim.claim_id 
    });
    console.log('2. ✓ Constructed URL:', url);
    
    // Validate URL format
    const isValid = url.startsWith('https://') && 
                    url.includes('cloud.odysee.live') && 
                    url.endsWith('master.m3u8');
    console.log('3.', isValid ? '✓' : '✗', 'URL format valid');
    
    // Test CDN accessibility (may fail for test claim)
    try {
      const cdnResponse = await fetch(url, { method: 'HEAD' });
      console.log('4. ✓ CDN accessible:', cdnResponse.status);
    } catch (err) {
      console.log('4. ⚠ CDN not accessible (expected for test claim):', err.message);
    }
    
    console.log('\n✓ Full pipeline test complete');
    return { claim, url };
    
  } catch (err) {
    console.error('✗ Pipeline test failed:', err);
    throw err;
  }
}

// Run the test
testFullPipeline();
```

### Phase 8: Automated Test Script

#### Step 8.1: Run Reproducible Claim Test

```bash
node scripts/test_reproducible_claim.js
```

This script:
1. Loads `tests/fixtures/claim_working.json`
2. Constructs CDN playback URL
3. Validates URL format
4. Tests basic accessibility
5. Generates detailed report

**Output Files:**
- `stabilization/TASK_18.2_TEST_RESULTS.md` - Human-readable report
- `stabilization/TASK_18.2_TEST_RESULTS.json` - Machine-readable results

#### Step 8.2: Review Test Results

```bash
# View test results
cat stabilization/TASK_18.2_TEST_RESULTS.md

# Check for failures
grep -i "fail\|error" stabilization/TASK_18.2_TEST_RESULTS.md
```

## Common Issues and Solutions

### Issue 1: IPC Connection Fails

**Symptoms:**
- `test_connection` command times out or returns error
- Console shows "Failed to invoke command"

**Solutions:**
1. Restart Tauri dev server: `npm run tauri:dev`
2. Check for port conflicts (kill other Tauri instances)
3. Verify Tauri commands are registered in `main.rs`
4. Check Terminal 2 for backend panic messages

### Issue 2: Channel Claims Fetch Returns Empty Array

**Symptoms:**
- `fetch_channel_claims` returns `[]`
- No error message

**Solutions:**
1. Verify channel ID format: `@channelname:claimid`
2. Test with known working channel: `@kiyyamovies:b`
3. Check network connectivity to Odysee API
4. Verify API endpoint is correct in backend code
5. Check for rate limiting or API blocks

### Issue 3: CDN URL Construction Fails

**Symptoms:**
- `build_cdn_playback_url_test` returns error
- URL format is incorrect

**Solutions:**
1. Verify claim_id parameter is passed correctly
2. Check CDN gateway configuration in backend
3. Verify URL template format in code
4. Test with known claim ID: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

### Issue 4: CDN URL Returns 403 or 404

**Symptoms:**
- URL is constructed correctly
- CDN returns 403 Forbidden or 404 Not Found

**Solutions:**
1. Verify claim exists on Odysee (check odysee.com)
2. Check if claim requires authentication
3. Verify CDN gateway is correct (cloud.odysee.live)
4. Test with different claim from same channel
5. Check for CDN access restrictions or geo-blocking

### Issue 5: Player Doesn't Load Video

**Symptoms:**
- URL is accessible (200 OK)
- Player component doesn't play video

**Solutions:**
1. Check player component logs in Console
2. Verify HLS.js is loaded correctly
3. Test URL directly in browser
4. Check for CORS issues in Network tab
5. Verify player is receiving correct URL prop

## Evidence Collection for Bug Reports

When reporting issues, collect the following evidence:

### 1. Console Output

```javascript
// Run this to capture all relevant info
async function collectEvidence() {
  const evidence = {
    timestamp: new Date().toISOString(),
    ipc_test: null,
    url_construction: null,
    channel_fetch: null,
    errors: []
  };
  
  try {
    evidence.ipc_test = await window.__TAURI__.invoke('test_connection');
  } catch (err) {
    evidence.errors.push({ test: 'ipc', error: err.message });
  }
  
  try {
    evidence.url_construction = await window.__TAURI__.invoke('build_cdn_playback_url_test', { 
      claim_id: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6' 
    });
  } catch (err) {
    evidence.errors.push({ test: 'url_construction', error: err.message });
  }
  
  try {
    const claims = await window.__TAURI__.invoke('fetch_channel_claims', { 
      channelId: '@kiyyamovies:b' 
    });
    evidence.channel_fetch = { count: claims.length, first: claims[0] };
  } catch (err) {
    evidence.errors.push({ test: 'channel_fetch', error: err.message });
  }
  
  console.log('=== EVIDENCE REPORT ===');
  console.log(JSON.stringify(evidence, null, 2));
  console.log('=== END REPORT ===');
  
  return evidence;
}

// Run and copy output
collectEvidence();
```

Copy the JSON output from console.

### 2. Backend Logs

Save Terminal 2 output:
```bash
# Copy from stabilization/debug_output.txt
cat stabilization/debug_output.txt
```

### 3. Network Requests

In DevTools Network tab:
1. Right-click on request
2. Select "Copy" → "Copy as HAR"
3. Save to file

### 4. Test Results

```bash
# Run automated test
node scripts/test_reproducible_claim.js

# Copy results
cat stabilization/TASK_18.2_TEST_RESULTS.md
```

### 5. System Information

```bash
# Collect system info
echo "OS: $(uname -a)"
echo "Node: $(node --version)"
echo "npm: $(npm --version)"
echo "Rust: $(rustc --version)"
echo "Cargo: $(cargo --version)"
```

## Attaching Evidence to PR or Issue

When creating a PR or issue for Odysee playback problems:

### Required Attachments

1. **Console Evidence** (from collectEvidence() function)
2. **Backend Logs** (`stabilization/debug_output.txt`)
3. **Test Results** (`stabilization/TASK_18.2_TEST_RESULTS.md`)
4. **Network HAR** (if network issues suspected)

### PR Template Section

```markdown
## Odysee Playback Debug Evidence

### Console Output
```
[Paste collectEvidence() JSON output here]
```

### Backend Logs
```
[Paste relevant lines from debug_output.txt]
```

### Test Results
```
[Paste TASK_18.2_TEST_RESULTS.md content]
```

### Network Requests
- Attached: `network_requests.har`

### Exact Failure Point
[Describe where the failure occurs: IPC, fetch, URL construction, CDN access, player loading]

### Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Observed failure]

### Expected vs Actual Behavior
- **Expected:** [What should happen]
- **Actual:** [What actually happens]
```

## Advanced Debugging Techniques

### Technique 1: Add Tracing to Backend

If you need more detailed backend logs, add tracing:

```rust
// In relevant backend functions
use tracing::{info, debug, error};

#[tauri::command]
pub async fn fetch_channel_claims(channel_id: String) -> Result<Vec<Claim>, String> {
    info!("Fetching claims for channel: {}", channel_id);
    
    let url = format!("https://api.odysee.com/...");
    debug!("Request URL: {}", url);
    
    // ... rest of function
}
```

### Technique 2: Test with curl

Test CDN URLs directly:

```bash
# Test CDN URL accessibility
curl -I "https://cloud.odysee.live/content/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6/master.m3u8"

# Test with real claim ID
curl -I "https://cloud.odysee.live/content/{real-claim-id}/master.m3u8"
```

### Technique 3: Compare with Working Implementation

If you have a working Odysee playback implementation:

1. Compare API endpoints
2. Compare URL construction logic
3. Compare CDN gateway configuration
4. Compare player initialization

## Next Steps After Debugging

Once you've identified the issue:

1. **Document Findings** in `stabilization/DECISIONS.md`
2. **Create Issue** with evidence attached
3. **Propose Fix** with test coverage
4. **Verify Fix** using this playbook
5. **Update Playbook** if new issues discovered

## Expected vs Actual Behavior

This section documents the expected behavior for each pipeline stage and compares it with known actual behavior to identify gaps and failure points.

### Pipeline Stage Expectations

#### Stage 1: claim_search Call (Backend API Request)

**Expected Behavior:**
- Backend sends HTTP POST request to Odysee API endpoint
- Request includes channel_id, tags, limit, page parameters
- Request completes within 5 seconds
- Returns HTTP 200 OK with JSON response
- Response contains `success: true` and `items` array

**Known Actual Behavior:**
- ✅ Request is sent correctly with validated parameters
- ✅ HTTP connection succeeds to Odysee API
- ✅ Response is received within timeout
- ✅ Response structure is valid JSON

**Potential Failure Points:**
- Network connectivity issues (timeout, DNS failure)
- API endpoint changes or deprecation
- Rate limiting or API blocks
- Invalid channel_id format
- Missing or malformed request parameters

**Diagnostic Traces:**
```rust
info!(
    component = "content_pipeline",
    stage = "claim_search_call",
    channel_id = %validated_channel_id,
    "Stage 1: Sending claim_search API request"
);
```

**If This Stage Fails:**
- Check network connectivity: `curl https://api.odysee.com`
- Verify channel_id format: `@channelname:claimid`
- Check backend logs for HTTP errors
- Verify API endpoint hasn't changed

---

#### Stage 2: Claim Parsing (Backend Response Processing)

**Expected Behavior:**
- Response JSON is valid and parseable
- Response contains `success: true` field
- Response contains `items` array with claim objects
- Each claim has required fields: `claim_id`, `name`, `value`
- Each claim's `value` contains `stream` object
- Each stream contains `source` object with `sd_hash`

**Known Actual Behavior:**
- ✅ Response JSON parses successfully
- ✅ Items array is present and non-empty
- ✅ Individual claims parse correctly
- ✅ Required fields are present in most claims

**Potential Failure Points:**
- API response format change (breaking change)
- Missing `items` array (empty response)
- Malformed claim objects (missing required fields)
- Unexpected data types (string instead of object)
- Claims without stream data (channels, reposts, collections)

**Diagnostic Traces:**
```rust
info!(
    component = "content_pipeline",
    stage = "claim_parsing",
    total_items = items_count,
    success = response.success,
    "Stage 2: Parsing claim_search response"
);

debug!(
    component = "content_pipeline",
    stage = "claim_parsing_item",
    claim_id = %claim_id,
    title = %title,
    has_video_urls = !video_urls.is_empty(),
    "Parsed individual claim item"
);
```

**If This Stage Fails:**
- Check response structure in logs
- Verify `items` array exists and is non-empty
- Check for API format changes
- Verify claim objects have required fields

---

#### Stage 3: Stream Validation (Backend Content Validation)

**Expected Behavior:**
- Claim has `value` object
- Value has `value_type: "stream"` (not "channel", "repost", "collection")
- Value has `stream` object
- Stream has `source` object
- Source has `sd_hash` field (96-character hex string)
- sd_hash is at least 6 characters long (for file_stub extraction)

**Known Actual Behavior:**
- ✅ Most claims have valid stream data
- ✅ sd_hash is present and correctly formatted
- ✅ Stream validation passes for video content
- ⚠️ Some claims may be channels or reposts (filtered out)

**Potential Failure Points:**
- Claim is not a stream (channel, repost, collection)
- Missing `stream` object in value
- Missing `source` object in stream
- Missing or malformed `sd_hash`
- sd_hash too short (< 6 characters)
- Claim is a livestream (different structure)

**Diagnostic Traces:**
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

**If This Stage Fails:**
- Check claim type (should be "stream")
- Verify stream object exists
- Verify sd_hash is present and valid
- Check for livestream vs VOD content

---

#### Stage 4: CDN URL Construction (Backend URL Building)

**Expected Behavior:**
- Extract `claim_name` from `item.name`
- Extract `claim_id` from `item.claim_id`
- Extract `sd_hash` from `item.value.source.sd_hash`
- Take first 6 characters of sd_hash as `file_stub`
- Construct URL: `https://player.odycdn.com/api/v3/streams/free/{claim_name}/{claim_id}/{file_stub}.mp4`
- Store URL in HashMap with key "master"
- URL is valid and accessible (returns 200 OK)

**Known Actual Behavior:**
- ✅ URL construction logic is correct
- ✅ All three components (name, id, hash) are extracted
- ✅ URL format matches expected pattern
- ✅ URLs are accessible and return video/mp4
- ✅ Hero section uses these URLs successfully

**Potential Failure Points:**
- Missing claim_name (item.name is null)
- Missing claim_id (item.claim_id is null)
- Missing sd_hash (item.value.source.sd_hash is null)
- sd_hash too short (< 6 characters)
- CDN gateway URL is incorrect
- URL format doesn't match CDN expectations
- CDN returns 403 Forbidden or 404 Not Found

**Diagnostic Traces:**
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

**Example URL:**
```
https://player.odycdn.com/api/v3/streams/free/man_ayebgn_Ethiopian_Movie/faf0de58484f01c3da49ccf2d5466b28f69a91eb/03427c.mp4
```

**If This Stage Fails:**
- Verify all three components are present
- Check URL format matches pattern
- Test URL accessibility with curl
- Verify CDN gateway is correct

---

#### Stage 5: Backend Return (Backend → Frontend IPC)

**Expected Behavior:**
- Backend constructs Vec<ContentItem> with all parsed items
- Each ContentItem has `video_urls` HashMap populated
- Each video_urls HashMap has "master" key with VideoUrl struct
- VideoUrl struct has: url, quality="master", url_type="mp4"
- Backend serializes ContentItem to JSON
- Backend returns Result<Vec<ContentItem>> via Tauri IPC
- IPC serialization succeeds without errors

**Known Actual Behavior:**
- ✅ ContentItem structs are constructed correctly
- ✅ video_urls HashMap is populated
- ✅ IPC serialization succeeds
- ✅ Data is transmitted to frontend

**Potential Failure Points:**
- Serialization error (struct doesn't match frontend type)
- IPC timeout (too much data)
- IPC connection failure (backend not running)
- Empty items array returned (no content found)
- video_urls HashMap is empty (URL construction failed)

**Diagnostic Traces:**
```rust
info!(
    component = "content_pipeline",
    stage = "backend_return",
    item_count = items.len(),
    cached = false,
    "Stage 5: Returning content items to frontend via IPC"
);

debug!(
    component = "content_pipeline",
    stage = "backend_return_item",
    claim_id = %item.claim_id,
    title = %item.title,
    has_video_urls = !item.video_urls.is_empty(),
    video_url_keys = ?item.video_urls.keys().collect::<Vec<_>>(),
    "Returning item to frontend"
);
```

**If This Stage Fails:**
- Check IPC connectivity with `test_connection` command
- Verify backend is running (check Terminal 2)
- Check for serialization errors in logs
- Verify ContentItem struct matches frontend type

---

#### Stage 6: Frontend Receive (Frontend API Layer)

**Expected Behavior:**
- Frontend receives IPC response from backend
- Response is an array of ContentItem objects
- Each ContentItem has all expected fields
- Each ContentItem has `video_urls` object (not null/undefined)
- video_urls object has "master" key
- video_urls.master has `url` field with CDN URL string
- Frontend stores items in state or returns to caller

**Known Actual Behavior:**
- ✅ Frontend receives response successfully
- ✅ Response is correctly typed as ContentItem[]
- ✅ video_urls field is present
- ✅ Hero section successfully uses video_urls.master.url

**Potential Failure Points:**
- IPC deserialization error (type mismatch)
- video_urls is null or undefined
- video_urls.master is missing
- video_urls.master.url is empty string
- Frontend validation rejects data
- State update fails

**Diagnostic Traces:**
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

**If This Stage Fails:**
- Check browser console for errors
- Verify response structure matches ContentItem type
- Check if video_urls field is present
- Verify video_urls.master exists

---

#### Stage 7: Player Mount (Frontend Player Component)

**Expected Behavior:**
- User clicks "Play" button on content
- PlayerModal opens with content prop
- PlayerModal extracts URL from `content.video_urls['master'].url`
- PlayerModal initializes video player (Plyr + HLS.js)
- Video element is created with src set to CDN URL
- Video loads and begins playback
- Player controls are functional

**Known Actual Behavior:**
- ✅ Hero section: Video plays automatically (muted, looping)
- ❌ Movies section: Play button behavior unknown
- ❌ Series section: Play button behavior unknown
- ⚠️ PlayerModal integration status unknown

**Potential Failure Points:**
- Play button doesn't trigger modal open
- PlayerModal doesn't receive content prop
- content.video_urls is undefined in PlayerModal
- video_urls.master is missing
- URL extraction fails
- Player initialization fails
- Video element doesn't load URL
- CORS blocks video loading
- Codec not supported by browser
- Network error loading video

**Diagnostic Traces:**
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

**If This Stage Fails:**
- Check if modal opens when Play is clicked
- Verify content prop is passed to PlayerModal
- Check console for video_urls structure
- Verify URL is extracted correctly
- Check Network tab for video request
- Look for CORS or codec errors

---

### Isolated Failure Layer Hypotheses

Based on the 7-stage pipeline, we can isolate failures to specific layers:

#### Hypothesis 1: Backend API Failure
**Symptoms:**
- Stage 1 completes, Stage 2 fails
- No items returned from API
- HTTP errors in backend logs

**Indicates:**
- Odysee API issue or downtime
- API response format change
- Network connectivity problem
- Rate limiting or blocking

**Test:**
```bash
curl -X POST https://api.odysee.com/claim/search \
  -H "Content-Type: application/json" \
  -d '{"channel_id":"@kiyyamovies:b","any_tags":["movie"],"limit":5}'
```

---

#### Hypothesis 2: Parsing Failure
**Symptoms:**
- Stage 2 completes, Stage 3 fails
- Items returned but no video_urls constructed
- Parsing errors in backend logs

**Indicates:**
- Claim structure issue
- Missing stream data
- Claims are not video streams (channels, reposts)
- sd_hash missing or malformed

**Test:**
```javascript
// Check claim structure
window.__TAURI__.invoke('fetch_channel_claims', {
  channelId: '@kiyyamovies:b',
  anyTags: ['movie'],
  limit: 1
}).then(items => console.log('Claim structure:', JSON.stringify(items[0], null, 2)));
```

---

#### Hypothesis 3: CDN URL Construction Failure
**Symptoms:**
- Stage 3 completes, Stage 4 fails
- video_urls HashMap is empty
- URL construction errors in logs

**Indicates:**
- Missing claim_name, claim_id, or sd_hash
- sd_hash too short (< 6 characters)
- URL format incorrect
- CDN gateway configuration wrong

**Test:**
```javascript
// Test URL construction
window.__TAURI__.invoke('build_cdn_playback_url_test', {
  claim_id: 'faf0de58484f01c3da49ccf2d5466b28f69a91eb'
}).then(url => console.log('Constructed URL:', url));
```

---

#### Hypothesis 4: IPC Serialization Failure
**Symptoms:**
- Stage 5 completes, Stage 6 never fires
- Backend returns data but frontend doesn't receive it
- IPC timeout or serialization errors

**Indicates:**
- Tauri IPC issue
- Type mismatch between Rust and TypeScript
- Data too large for IPC
- Backend not running

**Test:**
```javascript
// Test IPC connectivity
window.__TAURI__.invoke('test_connection')
  .then(res => console.log('IPC OK:', res))
  .catch(err => console.error('IPC FAIL:', err));
```

---

#### Hypothesis 5: Frontend Data Handling Failure
**Symptoms:**
- Stage 6 completes, Stage 7 fails
- Frontend receives data but player doesn't work
- video_urls is undefined in PlayerModal

**Indicates:**
- Frontend validation issue
- State management problem
- PlayerModal not receiving content prop
- video_urls field lost in state updates

**Test:**
```javascript
// Check data in frontend
window.__TAURI__.invoke('fetch_channel_claims', {
  channelId: '@kiyyamovies:b',
  anyTags: ['movie'],
  limit: 1
}).then(items => {
  console.log('Has video_urls:', !!items[0].video_urls);
  console.log('video_urls keys:', Object.keys(items[0].video_urls || {}));
  console.log('master URL:', items[0].video_urls?.master?.url);
});
```

---

#### Hypothesis 6: Player Initialization Failure
**Symptoms:**
- Stage 7 fires but video doesn't play
- Modal opens but video area is black
- Player controls don't work

**Indicates:**
- Player component issue
- Video element not created
- URL not set on video element
- CORS blocking video load
- Codec not supported
- Network error loading video

**Test:**
```javascript
// Check video element
const video = document.querySelector('video');
console.log('Video element:', video);
console.log('Video src:', video?.src);
console.log('Video readyState:', video?.readyState);
console.log('Video error:', video?.error);
```

---

### Known Gaps and Unknowns

#### Gap 1: Movies Section Play Button
**Status:** ❓ Unknown  
**Question:** Does clicking "Play" on a movie open PlayerModal?  
**Test:** Navigate to Movies → Click movie → Click "Play" → Observe

#### Gap 2: Series Section Play Button
**Status:** ❓ Unknown  
**Question:** Does clicking "Play" on a series open PlayerModal with first episode?  
**Test:** Navigate to Series → Click series → Click "Play" → Observe

#### Gap 3: PlayerModal Video Loading
**Status:** ❓ Unknown  
**Question:** Does PlayerModal correctly extract and load video_urls.master.url?  
**Test:** Open PlayerModal → Check console for Stage 7 traces → Check video element

#### Gap 4: Odysee Content Specifics
**Status:** ❓ Unknown  
**Question:** Do Odysee claims have different structure than other content?  
**Test:** Compare claim structure between working (Hero) and non-working (Movies/Series) content

#### Gap 5: Error Masking
**Status:** ⚠️ Suspected  
**Question:** Are errors being caught and masked without logging?  
**Test:** Check for try-catch blocks that swallow errors without logging

---

### Comparison: Working vs Non-Working

#### Hero Section (✅ WORKING)
- **Content Source:** Movies with tag='movie'
- **URL Construction:** ✅ Correct (player.odycdn.com)
- **Frontend Receive:** ✅ video_urls.master.url present
- **Playback:** ✅ Video plays (muted, autoplay)
- **Pipeline:** All 7 stages complete successfully

#### Movies Section (❌ STATUS UNKNOWN)
- **Content Source:** Movies with tag='movie' (SAME as Hero)
- **URL Construction:** ✅ Should be correct (same backend logic)
- **Frontend Receive:** ❓ Unknown if video_urls present
- **Playback:** ❓ Unknown if PlayerModal opens
- **Pipeline:** ❓ Unknown which stage fails

#### Series Section (❌ STATUS UNKNOWN)
- **Content Source:** Series with tag='series'
- **URL Construction:** ❓ Unknown if episodes have video_urls
- **Frontend Receive:** ❓ Unknown if episode resolution works
- **Playback:** ❓ Unknown if PlayerModal opens
- **Pipeline:** ❓ Unknown which stage fails

---

### Diagnostic Priority

Based on the analysis, the diagnostic priority is:

1. **Verify Stage 6 for Movies/Series** - Check if frontend receives video_urls
2. **Verify Stage 7 for Movies/Series** - Check if PlayerModal opens and receives content
3. **Check Play Button Handlers** - Verify handlePlay() is called and sets state
4. **Check PlayerModal Integration** - Verify modal renders and extracts URL
5. **Check Video Element** - Verify video element is created with correct src

---

### Next Steps

1. **Run Manual Tests** (see "Diagnostic Steps" section)
2. **Collect Pipeline Traces** (see "Phase 0: Enable Tracing Infrastructure")
3. **Identify Missing Stages** (which of the 7 stages don't appear?)
4. **Isolate Failure Layer** (use hypotheses above)
5. **Apply Targeted Fix** (based on identified layer)

---

## Related Documentation

- **Test Fixture:** `tests/fixtures/README.md`
- **Quick Reference:** `stabilization/TASK_18.2_QUICK_REFERENCE.md`
- **Architecture:** `ARCHITECTURE.md`
- **Decisions Log:** `stabilization/DECISIONS.md`
- **Tracing Infrastructure:** `stabilization/TRACING_INFRASTRUCTURE.md`
- **Hero Playback Analysis:** `stabilization/HERO_PLAYBACK_ANALYSIS.md`
- **Complete Playback Diagnostic:** `stabilization/COMPLETE_PLAYBACK_DIAGNOSTIC.md`

## Maintenance

This playbook should be updated when:

- New debugging techniques are discovered
- Common issues are identified
- API endpoints change
- CDN configuration changes
- New test commands are added

---

**Last Updated:** 2026-02-25  
**Phase:** 4 - Odysee Debug Preparation  
**Status:** Active
