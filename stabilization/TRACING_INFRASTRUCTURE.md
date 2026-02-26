# Tracing Infrastructure Documentation

This document describes the tracing infrastructure in place for debugging the Odysee content pipeline in Kiyya Desktop.

## Overview

The application uses the `tracing` crate for structured logging. Tracing points are strategically placed throughout the content pipeline to enable precise debugging of issues.

## Tracing Configuration

### Log Levels

The application supports standard log levels:
- `ERROR` - Critical errors that prevent functionality
- `WARN` - Warning conditions that may indicate issues
- `INFO` - Informational messages about normal operation
- `DEBUG` - Detailed debugging information

### Environment Variable

Set the log level using the `LOG_LEVEL` environment variable:

```bash
# Windows PowerShell
$env:LOG_LEVEL="DEBUG"

# macOS/Linux
export LOG_LEVEL=DEBUG
```

### Default Levels

- **Production:** `INFO`
- **Development:** `DEBUG`

## Content Pipeline Tracing Points

### 1. Claim Search/Fetch

**Location:** `src-tauri/src/commands.rs` - `fetch_channel_claims()`

**Tracing Points:**

```rust
// Entry point
info!("🚀 DIAGNOSTIC: fetch_channel_claims called");
info!("   channel_id={}, tags={:?}, text={:?}, limit={:?}, stream_types={:?}, force_refresh={:?}",
      channel_id, any_tags, text, limit, stream_types, force_refresh);

// Success
info!("✅ DIAGNOSTIC: fetch_channel_claims returning SUCCESS with {} items", items.len());

// Error
error!("❌ DIAGNOSTIC: fetch_channel_claims returning ERROR: {}", e);
```

**What to Look For:**
- Verify function is called with correct parameters
- Check if claims are returned (count > 0)
- Look for error messages

### 2. Claim Parsing

**Location:** `src-tauri/src/commands.rs` - `parse_claim_item()`

**Tracing Points:**

```rust
// Parse start (implicit - called from fetch_channel_claims)
// Parse errors are logged at ERROR level

// Success (implicit - returns Ok(ContentItem))
// Error (implicit - returns Err)
```

**What to Look For:**
- Parse errors in logs
- Malformed claim data
- Missing required fields

### 3. Stream Validation

**Location:** `src-tauri/src/commands.rs` - `extract_video_urls()`

**Tracing Points:**

```rust
// Validation start
info!("🔍 STEP 1: Validating claim is stream type");

// Stream type check
info!("   value_type={:?}, has_sd_hash={}", value_type, has_sd_hash);

// Validation result
info!("✅ Claim is valid stream type");
// OR
error!("❌ Claim is not a valid stream");
```

**What to Look For:**
- Verify claim has `value_type == "stream"` or `value.source.sd_hash`
- Check for validation failures

### 4. CDN URL Construction

**Location:** `src-tauri/src/commands.rs` - `build_cdn_playback_url()`

**Tracing Points:**

```rust
// Test command entry
info!("🧪 TEST: build_cdn_playback_url_test called with claim_id: {}", claim_id);

// URL construction (in extract_video_urls)
info!("🔍 STEP 3: Construct CDN URL");
info!("   gateway={}, claim_id={}", gateway, claim_id);
info!("   cdn_url={}", cdn_url);
```

**What to Look For:**
- Verify gateway URL is correct
- Verify claim_id is valid (40 hex characters)
- Check constructed URL format

### 5. Backend Return

**Location:** `src-tauri/src/commands.rs` - Tauri command return

**Tracing Points:**

```rust
// Return success
info!("✅ DIAGNOSTIC: fetch_channel_claims returning SUCCESS with {} items", items.len());

// Return error
error!("❌ DIAGNOSTIC: fetch_channel_claims returning ERROR: {}", e);
```

**What to Look For:**
- Verify data is returned to frontend
- Check for serialization errors
- Look for IPC errors

### 6. Frontend Receive

**Location:** Frontend JavaScript/TypeScript

**Tracing Points:**

```javascript
// Frontend should add console logs:
console.log('📥 Received claims:', claims.length);
console.log('First claim:', claims[0]);
```

**What to Look For:**
- Verify frontend receives data
- Check data structure matches expectations
- Look for undefined or null values

### 7. Player Mount

**Location:** Frontend player component

**Tracing Points:**

```javascript
// Frontend should add console logs:
console.log('🎬 Mounting player with URL:', url);
console.log('Player component:', playerRef.current);
```

**What to Look For:**
- Verify player component is mounted
- Check URL is passed to player
- Look for player initialization errors

### 8. Playback Start

**Location:** Frontend player component

**Tracing Points:**

```javascript
// Frontend should add console logs:
console.log('▶️ Starting playback...');
console.log('Player state:', player.getState());
```

**What to Look For:**
- Verify playback starts
- Check for player errors
- Look for network errors (CORS, 404, etc.)

## Tracing Best Practices

### 1. Use Structured Logging

```rust
// Good - structured with context
info!("Fetching claims: channel_id={}, limit={}", channel_id, limit);

// Bad - unstructured
info!("Fetching claims");
```

### 2. Use Emojis for Visual Scanning

```rust
info!("🚀 Starting operation");
info!("✅ Operation succeeded");
error!("❌ Operation failed");
info!("🔍 Investigating...");
info!("📡 Network request");
info!("📥 Response received");
info!("🎬 Player action");
```

### 3. Log at Appropriate Levels

- `ERROR` - Failures that prevent functionality
- `WARN` - Unexpected conditions that don't prevent functionality
- `INFO` - Normal operation milestones
- `DEBUG` - Detailed debugging information

### 4. Include Context

Always include relevant context in log messages:
- IDs (claim_id, channel_id, etc.)
- Counts (number of items, bytes, etc.)
- States (before/after values)
- Errors (error messages, codes)

### 5. Avoid Logging Sensitive Data

Never log:
- User credentials
- API keys
- Tokens
- Personal information

## Viewing Logs

### Development

Logs are printed to the terminal where `npm run tauri:dev` is running.

### Capture Logs to File

```bash
# Windows PowerShell
npm run tauri:dev 2>&1 | Tee-Object -FilePath stabilization/debug_output.txt

# macOS/Linux
npm run tauri:dev 2>&1 | tee stabilization/debug_output.txt
```

### Search Logs

```bash
# Find errors
grep -i "error\|fail\|panic" stabilization/debug_output.txt

# Find specific operation
grep "fetch_channel_claims" stabilization/debug_output.txt

# Find by emoji
grep "🚀" stabilization/debug_output.txt
```

## Adding New Tracing Points

When adding new tracing points:

1. **Identify the operation** - What are you tracing?
2. **Choose appropriate level** - ERROR, WARN, INFO, or DEBUG?
3. **Add context** - Include relevant IDs, counts, states
4. **Use emoji** - Make it easy to scan visually
5. **Test it** - Verify the log appears when expected

### Example

```rust
// Before
pub fn process_claim(claim: &Claim) -> Result<ProcessedClaim> {
    // ... processing logic ...
}

// After
pub fn process_claim(claim: &Claim) -> Result<ProcessedClaim> {
    info!("🔧 Processing claim: claim_id={}", claim.claim_id);
    
    // ... processing logic ...
    
    match result {
        Ok(processed) => {
            info!("✅ Claim processed successfully: claim_id={}", claim.claim_id);
            Ok(processed)
        }
        Err(e) => {
            error!("❌ Failed to process claim: claim_id={}, error={}", claim.claim_id, e);
            Err(e)
        }
    }
}
```

## Tracing in Tests

Tests can also use tracing:

```rust
#[test]
fn test_claim_processing() {
    // Initialize test logging
    let _ = tracing_subscriber::fmt()
        .with_test_writer()
        .try_init();
    
    info!("🧪 Starting test: test_claim_processing");
    
    // ... test logic ...
    
    info!("✅ Test completed successfully");
}
```

## Performance Considerations

### Log Level in Production

In production, use `INFO` level to avoid performance overhead from excessive logging.

### Conditional Logging

For expensive operations, use conditional logging:

```rust
if tracing::enabled!(tracing::Level::DEBUG) {
    let expensive_data = compute_expensive_data();
    debug!("Expensive data: {:?}", expensive_data);
}
```

## Troubleshooting

### Logs Not Appearing

1. Check log level: `echo $LOG_LEVEL`
2. Verify tracing is initialized in `main.rs`
3. Check if logs are being filtered

### Too Many Logs

1. Increase log level: `export LOG_LEVEL=INFO`
2. Filter logs: `grep "specific_operation" debug_output.txt`
3. Use structured logging to filter by field

### Logs Missing Context

1. Add more context to log messages
2. Include IDs and counts
3. Log before and after states

## Future Enhancements

### Structured Logging (JSON)

Future enhancement: Output logs in JSON format for easier parsing:

```json
{
  "timestamp": "2026-02-19T12:34:56Z",
  "level": "INFO",
  "component": "commands::fetch_channel_claims",
  "claim_id": "abc123",
  "message": "Fetching claims",
  "channel_id": "@kiyyamovies:b",
  "limit": 50
}
```

### Log Aggregation

Future enhancement: Send logs to aggregation service (e.g., Sentry, LogRocket) for production monitoring.

### Correlation IDs

Future enhancement: Add correlation IDs to trace requests across frontend and backend:

```rust
info!("🚀 Starting operation: correlation_id={}", correlation_id);
```

## References

- [tracing crate documentation](https://docs.rs/tracing/)
- [ODYSEE_DEBUG_PLAYBOOK.md](./ODYSEE_DEBUG_PLAYBOOK.md) - Debugging guide
- [STEPS_TO_REPRODUCE.md](./STEPS_TO_REPRODUCE.md) - Testing steps
- [LOGGING_DECISION.md](./LOGGING_DECISION.md) - Logging architecture decisions

---

**Last Updated:** 2026-02-19  
**Version:** 1.0  
**Maintainer:** Stabilization Team
