# Manual Tauri Command Testing - Quick Start Guide

**Task:** 10.2 Test Tauri Command Functionality  
**Requirements:** 6.3, 6.4  
**Status:** Ready for Manual Testing

## Quick Start (3 Steps)

### Step 1: Start the Application
```bash
npm run tauri:dev
```

Wait for the application window to open.

### Step 2: Open DevTools Console
- Press **F12** (or right-click → Inspect)
- Click the **Console** tab

### Step 3: Run Test Commands

Open `stabilization/TAURI_COMMAND_TEST_RESULTS.md` and copy the entire JavaScript block (starting with `const testResults = [];`) into the DevTools Console.

Press **Enter** to execute.

## What to Expect

### During Testing (First 5 Seconds)
You'll see output like:
```
✅ test_connection: "tauri-backend-alive"
✅ build_cdn_playback_url_test: "https://..."
✅ get_app_config: {theme: "dark", ...}
❌ fetch_channel_claims: Error: Channel not found
...
```

### After 5 Seconds
A summary table will appear:
```
=== TEST SUMMARY ===
Total: 28
Passed: 24
Failed: 4
```

## Interpreting Results

### ✅ Green Checkmarks (PASS)
- Command executed successfully
- Returned expected data type
- No errors or hangs

### ❌ Red X Marks (FAIL)
- Command returned an error
- **This is OK for some commands** (see below)
- Check error message for details

## Expected Failures (Normal)

These commands **may fail** and that's expected:

| Command | Why It May Fail |
|---------|----------------|
| `fetch_channel_claims` | Test channel doesn't exist |
| `fetch_playlists` | Test channel doesn't exist |
| `resolve_claim` | Test claim doesn't exist |
| `download_movie_quality` | Test URL is invalid |
| `stream_offline` | Content not downloaded |
| `delete_offline` | Content doesn't exist |
| `clear_crash_log` | Crash ID doesn't exist |
| `open_external` | May not work in dev mode |

**These failures are acceptable** as long as they return an error message (not hang).

## Critical Tests (Must Pass)

These commands **must succeed**:

| Command | Expected Result |
|---------|----------------|
| `test_connection` | "tauri-backend-alive" |
| `build_cdn_playback_url_test` | CDN URL string |
| `get_app_config` | Configuration object |
| `get_favorites` | Array (may be empty) |
| `get_diagnostics` | Diagnostics object |
| `get_cache_stats` | Cache statistics |
| `get_memory_stats` | Memory statistics |

## What to Look For

### 🚨 RED FLAGS (Report These)

1. **Hanging Commands**
   - Command doesn't complete after 30 seconds
   - No output (no ✅ or ❌)
   - Console appears frozen

2. **Unexpected Errors**
   - Commands that should pass are failing
   - Error messages don't make sense
   - Application crashes

3. **Type Mismatches**
   - Command returns wrong data type
   - Missing expected fields
   - Null when should have value

### ✅ GOOD SIGNS

1. **All Commands Complete**
   - Every command shows ✅ or ❌
   - No hanging or frozen commands
   - Summary table appears after 5 seconds

2. **Expected Failures Only**
   - Only the "may fail" commands fail
   - Critical commands all pass
   - Error messages are clear

3. **Proper Return Values**
   - Commands return expected data types
   - Objects have expected structure
   - No undefined or null where unexpected

## Troubleshooting

### Problem: Commands Don't Run
**Solution:** Make sure you copied the entire JavaScript block, including the first line `const testResults = [];`

### Problem: "window.__TAURI__ is not defined"
**Solution:** Make sure the application is fully loaded before running tests

### Problem: All Commands Fail
**Solution:** Check if the backend is running (look for backend logs in terminal)

### Problem: Some Commands Hang
**Solution:** Wait 30 seconds, then document which commands hung and report them

## Reporting Results

### If All Tests Pass ✅
1. Note the pass/fail counts
2. Verify critical commands passed
3. Document in `TAURI_COMMAND_TEST_RESULTS.md`
4. Proceed to next task

### If Tests Fail ❌
1. Copy the `testResults` array: `copy(testResults)`
2. Paste into a new file: `stabilization/MANUAL_TEST_RESULTS.json`
3. Document which commands failed
4. Note any hanging commands
5. Report issues for investigation

## Advanced Testing

### Test Individual Commands
```javascript
// Test one command at a time
window.__TAURI__.invoke('test_connection', {})
  .then(r => console.log('Result:', r))
  .catch(e => console.error('Error:', e));
```

### Test with Real Data
```javascript
// Use real channel ID
window.__TAURI__.invoke('fetch_channel_claims', {
  channel_id: '@kiyyamovies:b'
})
  .then(r => console.log('Claims:', r))
  .catch(e => console.error('Error:', e));
```

### Monitor for Hangs
```javascript
// Add timeout to detect hangs
const timeout = setTimeout(() => {
  console.error('⚠️ Command hung - no response after 30s');
}, 30000);

window.__TAURI__.invoke('command_name', {})
  .then(r => { clearTimeout(timeout); console.log('Result:', r); })
  .catch(e => { clearTimeout(timeout); console.error('Error:', e); });
```

## Next Steps After Testing

1. **Document Results**
   - Update `TAURI_COMMAND_TEST_RESULTS.md` with actual results
   - Note pass/fail counts
   - Document any issues found

2. **Fix Issues**
   - Address hanging commands
   - Fix unexpected errors
   - Improve error handling

3. **Verify Fixes**
   - Re-run tests after fixes
   - Confirm all critical commands pass
   - Verify no hangs

4. **Complete Task**
   - Mark task 10.2 as complete
   - Proceed to task 11.1 (Phase 5)

## Summary

This manual testing verifies:
- ✅ All 28 commands are functional
- ✅ No commands hang (Requirement 6.3)
- ✅ All async calls return properly (Requirement 6.4)
- ✅ Commands handle errors gracefully
- ✅ Return values match expected types

**Time Required:** ~5-10 minutes  
**Difficulty:** Easy (copy-paste testing)  
**Critical:** Yes (required for Phase 2 completion)

---

**For detailed test commands, see:** `stabilization/TAURI_COMMAND_TEST_RESULTS.md`  
**For completion summary, see:** `stabilization/TASK_10.2_COMPLETION_SUMMARY.md`

