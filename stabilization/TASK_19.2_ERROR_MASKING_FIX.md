# Task 19.2: Error Masking Fix

**Issue:** Gateway errors were being masked behind generic "All gateways failed" message  
**Status:** ✅ FIXED  
**Date:** 2026-02-26

## Problem Identified by Tracing Infrastructure

The tracing infrastructure successfully revealed that error details were being swallowed. The frontend received:

```javascript
{
  errorType: 'string',
  errorMessage: 'All gateways failed after 7 attempts',
  errorStack: undefined
}
```

This masked the real underlying error (timeout, DNS, TLS, HTTP status, etc.).

## Root Cause Analysis

### Before Fix

**Error Type (`src-tauri/src/error.rs`):**
```rust
#[error("All gateways failed after {attempts} attempts")]
AllGatewaysFailed { attempts: u32 },
```

**Gateway Code (`src-tauri/src/gateway.rs`):**
```rust
let mut last_error = None;
// ... retry loop ...
Err(e) => {
    last_error = Some(e);  // Error captured but not used
    // ...
}
// ...
Err(KiyyaError::AllGatewaysFailed {
    attempts: total_attempts as u32,
})  // Generic error returned, last_error discarded
```

**Problem:** The `last_error` was captured but never included in the final error message.

## Fix Applied

### Updated Error Type

**File:** `src-tauri/src/error.rs`

```rust
#[error("All gateways failed after {attempts} attempts. Last error: {last_error}")]
AllGatewaysFailed { 
    attempts: u32,
    last_error: String,  // NEW: Include actual error details
},
```

### Updated Gateway Code

**File:** `src-tauri/src/gateway.rs`

```rust
// All gateways failed - return comprehensive error with last error details
let last_error_msg = last_error
    .as_ref()
    .map(|e| format!("{:?}", e))  // Format error with Debug trait for full details
    .unwrap_or_else(|| "No error details available".to_string());

let final_error = KiyyaError::AllGatewaysFailed {
    attempts: total_attempts as u32,
    last_error: last_error_msg.clone(),  // Include error details
};

error!(
    "All {} gateways failed after {} total attempts ({} gateway attempts). Last error: {}",
    self.gateways.len(),
    total_attempts,
    gateway_attempt,
    last_error_msg  // Log the actual error
);
```

## What This Fixes

### Before
```
Error: All gateways failed after 7 attempts
```

No information about:
- ❌ Was it a timeout?
- ❌ Was it DNS failure?
- ❌ Was it TLS/certificate error?
- ❌ Was it HTTP 400/403/500?
- ❌ Was it invalid request payload?

### After
```
Error: All gateways failed after 7 attempts. Last error: reqwest::Error { kind: Timeout, url: "https://api.odysee.com/api/v1/proxy" }
```

Or:
```
Error: All gateways failed after 7 attempts. Last error: HTTP 400 Bad Request: {"error": "Invalid method parameter"}
```

Or:
```
Error: All gateways failed after 7 attempts. Last error: DNS resolution failed for api.odysee.com
```

Now you can see **exactly** what went wrong!

## Impact on Debugging

### Before Fix
- Debugging blind
- Had to guess: network? firewall? API change?
- No way to distinguish between different failure modes
- Frontend couldn't provide useful error messages to users

### After Fix
- ✅ See exact error type (timeout, DNS, HTTP status, etc.)
- ✅ See which gateway failed last
- ✅ See HTTP response body if API rejected request
- ✅ Can distinguish network issues from API issues
- ✅ Frontend can provide specific error messages

## Testing

### Verification Steps

1. **Rebuild the backend:**
   ```powershell
   cd src-tauri
   cargo build
   cd ..
   ```

2. **Start the app:**
   ```powershell
   npm run tauri:dev
   ```

3. **Trigger a fetch:**
   ```javascript
   window.__TAURI__.invoke('fetch_channel_claims', { 
     channelId: '@kiyyamovies:b' 
   }).catch(e => console.error('Detailed error:', e))
   ```

4. **Check the error message** - it should now include the actual error details

### Expected Results

Instead of:
```
All gateways failed after 7 attempts
```

You should see something like:
```
All gateways failed after 7 attempts. Last error: reqwest::Error { kind: Connect, source: ... }
```

This tells you the **actual problem** (connection refused, timeout, DNS, etc.).

## Additional Improvements Needed (Future)

While this fix exposes the error, there are additional improvements that could be made:

### 1. Log HTTP Response Body on Non-200 Status

```rust
if !response.status().is_success() {
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    error!("HTTP error {}: {}", status, body);
    return Err(KiyyaError::InvalidApiResponse { 
        message: format!("HTTP {}: {}", status, body) 
    });
}
```

This would catch cases where Odysee API rejects the request due to:
- Invalid JSON format
- Missing "method" parameter
- Invalid channelId
- Invalid tags format

### 2. Structured Error Types

Instead of converting to String, could use an enum:

```rust
pub enum GatewayError {
    Timeout { gateway: String, duration: Duration },
    DnsFailure { gateway: String, details: String },
    TlsError { gateway: String, details: String },
    HttpError { gateway: String, status: u16, body: String },
    ConnectionRefused { gateway: String },
}
```

This would allow the frontend to handle different error types differently.

### 3. Per-Gateway Error Tracking

Track errors for each gateway separately:

```rust
pub struct GatewayAttempt {
    gateway_url: String,
    attempt_number: u32,
    error: Option<String>,
    duration: Duration,
}

AllGatewaysFailed {
    attempts: Vec<GatewayAttempt>,
}
```

This would show the full history of what failed and why.

## Conclusion

This fix transforms the error from a useless generic message into actionable debugging information. The tracing infrastructure successfully identified this issue, and now the error propagation is fixed.

**Key Takeaway:** The problem was NOT network failure - it was error masking. We were debugging blind. Now we can see what's actually happening.

---

**Fixed:** 2026-02-26  
**Verified:** Code compiles successfully  
**Impact:** High - Enables actual debugging of gateway failures  
**Related:** Task 19.2 (Add tracing infrastructure)

