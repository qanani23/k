# Gateway Production Failover Testing Guide

This document provides instructions for testing the gateway failover mechanism in production.

## Overview

The gateway production tests verify that the failover mechanism works correctly with real Odysee API endpoints. These tests are marked with `#[ignore]` and must be run explicitly to avoid making unnecessary network calls during regular test runs.

## Test Location

The production tests are located in: `src-tauri/src/gateway_production_test.rs`

## Running the Tests

### Prerequisites

1. Ensure you have an active internet connection
2. Ensure the Odysee API gateways are accessible from your network
3. Be aware that these tests make real network calls and may be affected by:
   - Network connectivity issues
   - Gateway availability and performance
   - Rate limiting from Odysee APIs
   - Geographic location and routing

### Run All Production Tests

```bash
cd src-tauri
cargo test gateway_production_test -- --ignored --nocapture --test-threads=1
```

### Run Individual Tests

#### Test 1: Gateway Connectivity
Tests that all three production gateways are reachable and respond correctly.

```bash
cd src-tauri
cargo test test_production_gateway_connectivity -- --ignored --nocapture
```

**Expected Output:**
- Each gateway (PRIMARY, SECONDARY, FALLBACK) should respond with HTTP 200
- Successful Odysee API responses should be returned
- Response times should be logged for each gateway

#### Test 2: Failover Mechanism
Tests the complete failover mechanism with real production gateways.

```bash
cd src-tauri
cargo test test_production_failover_mechanism -- --ignored --nocapture
```

**Expected Output:**
- Request should succeed using at least one working gateway
- Gateway health stats should be displayed
- Response should contain valid content items

#### Test 3: Failover Consistency
Tests that gateway priority order is maintained across multiple requests.

```bash
cd src-tauri
cargo test test_production_failover_consistency -- --ignored --nocapture
```

**Expected Output:**
- All 3 requests should succeed
- Gateway priority order should remain: PRIMARY → SECONDARY → FALLBACK
- Priority order should be immutable across requests

#### Test 4: Different Request Types
Tests failover with various API operations.

```bash
cd src-tauri
cargo test test_production_failover_different_requests -- --ignored --nocapture
```

**Expected Output:**
- ClaimSearch with tags should succeed
- ClaimSearch with text search should succeed
- All request types should be handled correctly

#### Test 5: Gateway Performance
Tests gateway performance and response times.

```bash
cd src-tauri
cargo test test_production_gateway_performance -- --ignored --nocapture
```

**Expected Output:**
- Performance statistics for each gateway (avg, min, max response times)
- Success rate for each gateway
- Comparison of gateway performance

#### Test 6: Gateway Logging
Tests that gateway logs are being written correctly during production failover.

```bash
cd src-tauri
cargo test test_production_gateway_logging -- --ignored --nocapture
```

**Expected Output:**
- Gateway log file should exist at the configured location
- Last 10 log entries should be displayed
- Gateway health stats should be shown

## Test Configuration

The tests use the following production gateway endpoints:

1. **PRIMARY**: `https://api.na-backend.odysee.com/api/v1/proxy`
2. **SECONDARY**: `https://api.lbry.tv/api/v1/proxy`
3. **FALLBACK**: `https://api.odysee.com/api/v1/proxy`

These endpoints are configured in `src-tauri/src/gateway.rs` and are immutable.

## Interpreting Results

### Success Criteria

- ✓ All gateways should be reachable (at least one should respond)
- ✓ Failover should occur automatically when a gateway fails
- ✓ Gateway priority order should remain immutable
- ✓ Response times should be reasonable (< 5 seconds per request)
- ✓ Gateway health stats should be updated correctly
- ✓ Logs should be written to the gateway log file

### Failure Scenarios

If tests fail, check the following:

1. **Network Connectivity**: Ensure you have internet access
2. **Gateway Availability**: Check if Odysee gateways are operational
3. **Firewall/Proxy**: Ensure your network allows HTTPS connections to Odysee domains
4. **Rate Limiting**: If you see 429 errors, wait before retrying
5. **Timeout Issues**: Increase timeout values if network is slow

## Manual Testing

For manual testing without running the automated tests:

1. Start the application in development mode:
   ```bash
   npm run tauri:dev
   ```

2. Monitor the gateway logs:
   ```bash
   # Windows
   type %APPDATA%\kiyya-desktop\logs\gateway.log
   
   # macOS/Linux
   tail -f ~/Library/Application\ Support/kiyya-desktop/logs/gateway.log
   ```

3. Perform actions that trigger API calls:
   - Browse content categories
   - Search for content
   - View movie/series details
   - Play videos

4. Observe the logs for:
   - Gateway selection (PRIMARY → SECONDARY → FALLBACK)
   - Retry attempts with exponential backoff
   - Success/failure messages
   - Response times

## Simulating Gateway Failures

To test failover behavior when gateways fail:

1. **Block Primary Gateway**: Use firewall rules or hosts file to block the primary gateway
   ```
   # Add to hosts file (requires admin/root)
   127.0.0.1 api.na-backend.odysee.com
   ```

2. **Run Tests**: Execute the production tests and verify failover to secondary gateway

3. **Block Secondary Gateway**: Block both primary and secondary gateways
   ```
   127.0.0.1 api.na-backend.odysee.com
   127.0.0.1 api.lbry.tv
   ```

4. **Run Tests**: Verify failover to fallback gateway

5. **Restore**: Remove hosts file entries to restore normal operation

## Continuous Integration

These tests are NOT included in the regular CI pipeline because they:
- Make real network calls
- Depend on external service availability
- May be affected by rate limiting
- Take longer to execute

For CI/CD, use the mocked gateway tests in `src-tauri/src/gateway.rs` instead.

## Troubleshooting

### Test Timeout

If tests timeout, increase the timeout value:
```bash
cargo test gateway_production_test -- --ignored --nocapture --test-threads=1 --timeout=300
```

### Rate Limiting

If you encounter rate limiting (HTTP 429):
- Wait for the retry-after period (usually 60 seconds)
- Reduce the number of test iterations
- Add delays between test runs

### Connection Errors

If you see connection errors:
- Check your internet connection
- Verify DNS resolution for Odysee domains
- Check firewall/proxy settings
- Try accessing the gateway URLs directly in a browser

## Reporting Issues

When reporting gateway failover issues, include:
1. Test output with `--nocapture` flag
2. Gateway log file contents
3. Network configuration details
4. Timestamp of the issue
5. Geographic location (for routing issues)

## Related Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture overview
- [DEVELOPER_NOTES.md](DEVELOPER_NOTES.md) - Development guidelines
- Gateway implementation: `src-tauri/src/gateway.rs`
- Gateway models: `src-tauri/src/models.rs`
