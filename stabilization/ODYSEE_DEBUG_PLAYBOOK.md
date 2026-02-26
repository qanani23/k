# Odysee Playback Debugging Playbook

This playbook provides a systematic approach to debugging Odysee playback issues in Kiyya Desktop. It is designed to be used after Phase 3 stabilization is complete, ensuring a clean codebase foundation for precise debugging.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Overview](#overview)
3. [Content Pipeline Stages](#content-pipeline-stages)
4. [Step-by-Step Debugging](#step-by-step-debugging)
5. [Common Issues](#common-issues)
6. [Tracing Points](#tracing-points)
7. [Expected vs Actual Behavior](#expected-vs-actual-behavior)
8. [Evidence Collection](#evidence-collection)

---

## Prerequisites

### Required Completion

- ✅ Phase 3 stabilization complete
- ✅ Clean build passing (zero warnings or documented exceptions)
- ✅ Test claim available at `tests/fixtures/claim_working.json`
- ✅ All tests passing
- ✅ Module-focused coverage >= 60%

### Tools Needed

- Browser DevTools (Console, Network tab)
- Text editor for log analysis
- sqlite3 (for database inspection)
- curl or similar HTTP client (for CDN testing)

### Environment Setup

```bash
# Set debug logging
export LOG_LEVEL=DEBUG

# Optional: Use test claim
export TEST_CLAIM_ID=abc123realclaimid
```

---

## Overview

### Problem Statement

Odysee content may not play correctly in Kiyya Desktop. This could manifest as:
- Videos not loading
- Playback errors
- Missing content
- CDN URL construction failures
- Network errors

### Debugging Strategy

1. **Isolate the failure layer** - Determine where in the pipeline the issue occurs
2. **Trace the data flow** - Follow claim data from fetch to playback
3. **Verify each stage** - Test each pipeline stage independently
4. **Collect evidence** - Capture logs, network requests, and error messages
5. **Document findings** - Record observations for analysis

---

## Content Pipeline Stages

The Odysee content pipeline consists of these stages:

```
1. Claim Search/Fetch
   ↓
2. Claim Parsing
   ↓
3. Stream Validation
   ↓
4. CDN URL Construction
   ↓
5. Backend Return
   ↓
6. Frontend Receive
   ↓
7. Player Mount
   ↓
8. Playback Start
```

### Stage Details

| Stage | Component | Input | Output | Failure Symptoms |
|-------|-----------|-------|--------|------------------|
| 1. Claim Search | Backend | Channel ID | Claim JSON | No claims returned |
| 2. Claim Parsing | Backend | Claim JSON | Parsed claim | Parse errors |
| 3. Stream Validation | Backend | Claim data | Valid stream | Invalid stream |
| 4. CDN URL Construction | Backend | Claim ID | CDN URL | Malformed URL |
| 5. Backend Return | Tauri IPC | CDN URL | Response | IPC timeout |
| 6. Frontend Receive | Frontend | Response | Claim data | No data received |
| 7. Player Mount | Frontend | Claim data | Player ready | Player not mounted |
| 8. Playback Start | Player | CDN URL | Video playing | Playback error |

---

## Step-by-Step Debugging

### Step 1: Build and Verify

Ensure the application is built and tests pass:

```bash
# Build backend
cd src-tauri
cargo build
cargo test

# Build frontend
cd ..
npm run build

# Run IPC smoke test
node scripts/ipc_smoke_test.js

# Run reproducible claim test
node scripts/test_reproducible_claim.js
```

**Expected:** All builds and tests pass.

**If fails:** Fix build/test issues before proceeding.

---

### Step 2: Start Development Environment

```bash
# Terminal 1: Start Tauri dev server
npm run tauri:dev
```

**Expected:** Application window opens, no errors in console.

**If fails:** Check logs for startup errors, verify database is accessible.

---

### Step 3: Test IPC Connectivity

Open DevTools Console (F12) and test basic IPC:

```javascript
// Test connection
window.__TAURI__.invoke('test_connection')
  .then(res => console.log('✓ IPC OK:', res))
  .catch(err => console.error('✗ IPC FAIL:', err));
```

**Expected:** `✓ IPC OK: tauri-backend-alive`

**If fails:** IPC is broken, check backend logs, verify command registration.

---

### Step 4: Test CDN URL Construction

Test URL construction with the test claim:

```javascript
// Load test claim
fetch('/tests/fixtures/claim_working.json')
  .then(r => r.json())
  .then(claim => {
    console.log('Test claim:', claim);
    return window.__TAURI__.invoke('build_cdn_playback_url_test', { 
      claim_id: claim.claim_id 
    });
  })
  .then(url => {
    console.log('✓ CDN URL:', url);
    // Verify URL format
    if (url.startsWith('https://') && url.includes('/content/') && url.endsWith('master.m3u8')) {
      console.log('✓ URL format valid');
    } else {
      console.error('✗ URL format invalid');
    }
  })
  .catch(err => console.error('✗ Error:', err));
```

**Expected:** Valid CDN URL returned (e.g., `https://cloud.odysee.live/content/<claim_id>/master.m3u8`)

**If fails:** URL construction is broken, check `build_cdn_playback_url` function.

---

### Step 5: Test Claim Fetch

Fetch claims from a known channel:

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

**Expected:** Array of claims returned, each with `claim_id`, `name`, `value` fields.

**If fails:** 
- Check network connectivity
- Verify Odysee API is accessible
- Check for API rate limiting
- Verify channel ID is correct

---

### Step 6: Test Full Pipeline

Test the complete pipeline from fetch to URL construction:

```javascript
// Fetch claims and build URLs
window.__TAURI__.invoke('fetch_channel_claims', { 
  channelId: '@kiyyamovies:b' 
})
  .then(claims => {
    if (claims.length === 0) {
      throw new Error('No claims returned');
    }
    
    console.log(`✓ Fetched ${claims.length} claims`);
    
    // Test URL construction for first claim
    const firstClaim = claims[0];
    console.log('Testing claim:', firstClaim.name);
    
    return window.__TAURI__.invoke('build_cdn_playback_url_test', { 
      claim_id: firstClaim.claim_id 
    });
  })
  .then(url => {
    console.log('✓ CDN URL constructed:', url);
    
    // Test URL accessibility
    return fetch(url, { method: 'HEAD' })
      .then(res => {
        if (res.ok) {
          console.log('✓ CDN URL accessible');
        } else {
          console.error('✗ CDN URL not accessible:', res.status);
        }
      });
  })
  .catch(err => console.error('✗ Pipeline failed:', err));
```

**Expected:** Claims fetched, URL constructed, URL accessible.

**If fails:** Identify which stage failed and investigate that stage.

---

### Step 7: Capture Backend Logs

Monitor backend output for errors:

```bash
# Windows PowerShell
npm run tauri:dev 2>&1 | Tee-Object -FilePath stabilization/debug_output.txt

# macOS/Linux
npm run tauri:dev 2>&1 | tee stabilization/debug_output.txt
```

**Look for:**
- Error messages
- Panic traces
- Network errors
- Parse errors
- Database errors

**Search for errors:**
```bash
grep -i "error\|fail\|panic" stabilization/debug_output.txt
```

---

### Step 8: Inspect Network Requests

Open DevTools Network tab and monitor requests:

1. Filter by "Fetch/XHR"
2. Look for requests to:
   - Odysee API (`api.odysee.com` or similar)
   - CDN (`cloud.odysee.live` or similar)
3. Check request/response:
   - Status codes (200 OK, 404 Not Found, etc.)
   - Response body (claim data, error messages)
   - Timing (slow requests, timeouts)

**Common issues:**
- 404: Claim not found
- 403: Access denied
- 500: Server error
- Timeout: Network issue or slow API

---

### Step 9: Test with Real Claim

If test claim works but real claims don't, test with a specific real claim:

```javascript
// Use a known working Odysee claim ID
const realClaimId = 'abc123realclaimid'; // Replace with actual claim ID

window.__TAURI__.invoke('build_cdn_playback_url_test', { 
  claim_id: realClaimId 
})
  .then(url => {
    console.log('✓ Real claim URL:', url);
    
    // Test accessibility
    return fetch(url, { method: 'HEAD' })
      .then(res => {
        console.log('✓ Status:', res.status);
        console.log('✓ Headers:', Object.fromEntries(res.headers));
      });
  })
  .catch(err => console.error('✗ Error:', err));
```

---

### Step 10: Inspect Database

Check if claims are being cached correctly:

```bash
# Open database
sqlite3 ~/.kiyya/app.db

# List tables
.tables

# Check cached claims (if applicable)
SELECT * FROM claims LIMIT 10;

# Check favorites
SELECT * FROM favorites;

# Exit
.quit
```

---

## Common Issues

### Issue 1: No Claims Returned

**Symptoms:**
- `fetch_channel_claims` returns empty array
- Console shows "No claims found"

**Possible Causes:**
1. Invalid channel ID
2. Network connectivity issue
3. Odysee API down or rate limited
4. Parse error in response

**Debug Steps:**
1. Verify channel ID is correct
2. Test network connectivity: `curl https://api.odysee.com`
3. Check backend logs for parse errors
4. Try different channel ID

---

### Issue 2: CDN URL Not Accessible

**Symptoms:**
- URL constructed but returns 404
- Fetch fails with network error

**Possible Causes:**
1. Claim ID is invalid
2. Content not available on CDN
3. CDN gateway URL is wrong
4. Content requires authentication

**Debug Steps:**
1. Verify claim ID format (40 hex characters)
2. Test CDN gateway: `curl https://cloud.odysee.live`
3. Check if content is public (no auth required)
4. Try alternative CDN gateway

---

### Issue 3: Player Won't Mount

**Symptoms:**
- URL is valid but player doesn't load
- Player shows error message

**Possible Causes:**
1. Player component not initialized
2. URL format incompatible with player
3. CORS issue
4. Player library error

**Debug Steps:**
1. Check player component is mounted in DOM
2. Verify URL format matches player expectations
3. Check browser console for CORS errors
4. Test with simple video URL

---

### Issue 4: IPC Timeout

**Symptoms:**
- Tauri invoke hangs
- No response from backend

**Possible Causes:**
1. Backend command not registered
2. Command execution hangs
3. Async call not returning
4. Database lock

**Debug Steps:**
1. Verify command is registered in `main.rs`
2. Check backend logs for hangs
3. Add timeout to invoke call
4. Check for database locks

---

## Tracing Points

### Backend Tracing

Add tracing logs at these points in the backend:

```rust
// 1. Claim search entry
info!("🔍 fetch_channel_claims called: channel_id={}", channel_id);

// 2. API request
info!("📡 Requesting claims from Odysee API: {}", api_url);

// 3. Response received
info!("📥 Received response: status={}, body_len={}", status, body.len());

// 4. Parse start
info!("🔧 Parsing claims...");

// 5. Parse complete
info!("✅ Parsed {} claims", claims.len());

// 6. Stream validation
info!("🎬 Validating stream for claim: {}", claim_id);

// 7. CDN URL construction
info!("🌐 Building CDN URL: gateway={}, claim_id={}", gateway, claim_id);

// 8. Return to frontend
info!("📤 Returning {} claims to frontend", claims.len());
```

### Frontend Tracing

Add console logs at these points in the frontend:

```javascript
// 1. Fetch initiation
console.log('🔍 Fetching claims for channel:', channelId);

// 2. Backend call
console.log('📡 Invoking fetch_channel_claims...');

// 3. Response received
console.log('📥 Received claims:', claims.length);

// 4. URL construction
console.log('🌐 Building playback URL for claim:', claimId);

// 5. Player mount
console.log('🎬 Mounting player with URL:', url);

// 6. Playback start
console.log('▶️ Starting playback...');
```

---

## Expected vs Actual Behavior

### Expected Behavior

| Stage | Expected |
|-------|----------|
| Claim Fetch | Returns array of claims with valid structure |
| Claim Parsing | Each claim has `claim_id`, `name`, `value` fields |
| Stream Validation | Stream has `source` with `media_type` |
| CDN URL Construction | URL format: `https://cloud.odysee.live/content/<claim_id>/master.m3u8` |
| URL Accessibility | HEAD request returns 200 OK |
| Player Mount | Player component renders in DOM |
| Playback Start | Video plays without errors |

### Actual Behavior (Document Observations)

| Stage | Actual | Notes |
|-------|--------|-------|
| Claim Fetch | _Document what happens_ | _Add observations_ |
| Claim Parsing | _Document what happens_ | _Add observations_ |
| Stream Validation | _Document what happens_ | _Add observations_ |
| CDN URL Construction | _Document what happens_ | _Add observations_ |
| URL Accessibility | _Document what happens_ | _Add observations_ |
| Player Mount | _Document what happens_ | _Add observations_ |
| Playback Start | _Document what happens_ | _Add observations_ |

---

## Evidence Collection

### Required Evidence

When reporting issues or creating PRs, collect:

1. **Console Output**
   - Frontend console logs (DevTools)
   - Backend console logs (terminal)
   - Error messages and stack traces

2. **Network Requests**
   - Request URLs
   - Request/response headers
   - Response bodies (sanitized)
   - Status codes
   - Timing information

3. **Test Results**
   - IPC smoke test output
   - Reproducible claim test output
   - Backend test results
   - Frontend test results

4. **Environment Info**
   - OS and version
   - Node.js version
   - Rust version
   - Browser version
   - Application version

5. **Reproduction Steps**
   - Exact steps to reproduce
   - Expected vs actual behavior
   - Frequency (always, sometimes, rarely)

### Evidence Template

```markdown
## Issue Report

### Environment
- OS: Windows 11 / macOS 14 / Ubuntu 22.04
- Node.js: v18.x.x
- Rust: 1.70.x
- Browser: Chrome 120.x
- App Version: v0.x.x

### Steps to Reproduce
1. Start app: `npm run tauri:dev`
2. Open DevTools Console
3. Run: `window.__TAURI__.invoke('fetch_channel_claims', { channelId: '@kiyyamovies:b' })`
4. Observe: [describe what happens]

### Expected Behavior
[Describe what should happen]

### Actual Behavior
[Describe what actually happens]

### Console Output
```
[Paste console output here]
```

### Backend Logs
```
[Paste backend logs here]
```

### Network Requests
- Request URL: [URL]
- Status: [status code]
- Response: [sanitized response]

### Additional Context
[Any other relevant information]
```

---

## Isolated Failure Layer Hypothesis

Based on the pipeline stages, the failure is likely in one of these layers:

### Hypothesis 1: API Layer
- **Symptom:** No claims returned
- **Test:** `curl` Odysee API directly
- **Fix:** Update API endpoint, handle rate limiting

### Hypothesis 2: Parsing Layer
- **Symptom:** Claims returned but parse error
- **Test:** Log raw API response, validate JSON
- **Fix:** Update parser to handle new claim format

### Hypothesis 3: CDN Layer
- **Symptom:** URL constructed but not accessible
- **Test:** `curl` CDN URL directly
- **Fix:** Update CDN gateway, handle authentication

### Hypothesis 4: Player Layer
- **Symptom:** URL accessible but player won't load
- **Test:** Test player with simple video URL
- **Fix:** Update player configuration, handle CORS

### Hypothesis 5: IPC Layer
- **Symptom:** Backend works but frontend doesn't receive data
- **Test:** IPC smoke test, manual invoke in console
- **Fix:** Fix command registration, handle async properly

---

## Next Steps

After completing debugging:

1. **Document Findings**
   - Update this playbook with observations
   - Add to `DECISIONS.md` if architectural changes needed
   - Create issue or PR with evidence

2. **Implement Fix**
   - Create feature branch
   - Implement minimal fix
   - Add tests for regression prevention
   - Update documentation

3. **Verify Fix**
   - Run full test suite
   - Test manually with real claims
   - Verify no regressions
   - Update coverage if needed

4. **Create PR**
   - Use PR template
   - Include evidence
   - Link to issue
   - Request review

---

## References

- [STEPS_TO_REPRODUCE.md](./STEPS_TO_REPRODUCE.md) - General testing steps
- [DECISIONS.md](./DECISIONS.md) - Architectural decisions
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [CI_WORKFLOW.md](./CI_WORKFLOW.md) - CI/CD pipeline

---

## Maintenance

This playbook should be updated:
- When new debugging techniques are discovered
- When common issues are identified
- When the pipeline architecture changes
- After each major debugging session

**Last Updated:** 2026-02-19  
**Version:** 1.0  
**Maintainer:** Stabilization Team
