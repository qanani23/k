# Tracing Test Guide

**Issue:** Not seeing "Stage" traces in terminal or console  
**Date:** 2026-02-25

## Quick Diagnostic Test

Run these commands in order to diagnose the issue:

### Step 1: Verify Environment Variable

```powershell
# Check if RUST_LOG is set
echo $env:RUST_LOG
```

**Expected:** Should show `debug`

**If not set:**
```powershell
$env:RUST_LOG="debug"
```

### Step 2: Rebuild the Backend

```powershell
cd src-tauri
cargo build
cd ..
```

**Expected:** Should compile successfully

### Step 3: Start App and Check Terminal Output

```powershell
npm run tauri:dev
```

**Look for in the terminal:**
- Lines starting with `INFO` or `DEBUG`
- Lines with `kiyya_desktop` in them
- Any emoji symbols (🚀, ✅, 🔍, etc.)

**Copy and paste** a few lines of what you see here: _______________

### Step 4: Trigger a Content Fetch

**Option A: In the app**
- Navigate to Movies or Series section
- Watch the terminal for new output

**Option B: In DevTools Console (F12)**
```javascript
window.__TAURI__.invoke('fetch_channel_claims', { 
  channelId: '@kiyyamovies:b' 
}).then(r => console.log('✓ Got', r.length, 'items'))
  .catch(e => console.error('✗ Error:', e))
```

### Step 5: Check What You See

**In Terminal (PowerShell):**
- Do you see ANY new output after triggering fetch? (Yes/No): ___
- Do you see lines with "DIAGNOSTIC"? (Yes/No): ___
- Do you see lines with "Stage"? (Yes/No): ___
- Do you see lines with "content_pipeline"? (Yes/No): ___

**In DevTools Console:**
- Do you see `[TRACE]` messages? (Yes/No): ___
- Do you see the "✓ Got X items" message? (Yes/No): ___
- Any errors? (Yes/No): ___

### Step 6: Check Log File

```powershell
# Check if log directory exists
Test-Path "$env:APPDATA\kiyya-desktop\logs"

# List log files
Get-ChildItem "$env:APPDATA\kiyya-desktop\logs"

# View today's log
$logFile = "$env:APPDATA\kiyya-desktop\logs\kiyya.log.$(Get-Date -Format yyyy-MM-dd)"
if (Test-Path $logFile) {
    Get-Content $logFile | Select-Object -Last 100
} else {
    Write-Host "Log file not found: $logFile"
}
```

### Step 7: Search for Tracing in Logs

```powershell
# Search for "Stage" in logs
Select-String -Path "$env:APPDATA\kiyya-desktop\logs\kiyya.log.*" -Pattern "Stage" | Select-Object -First 10

# Search for "content_pipeline" in logs
Select-String -Path "$env:APPDATA\kiyya-desktop\logs\kiyya.log.*" -Pattern "content_pipeline" | Select-Object -First 10

# Search for "DIAGNOSTIC" in logs
Select-String -Path "$env:APPDATA\kiyya-desktop\logs\kiyya.log.*" -Pattern "DIAGNOSTIC" | Select-Object -Last 20
```

## Common Issues and Solutions

### Issue 1: No output in terminal at all

**Cause:** Logging might be going only to file, not console

**Solution:** Check the log file (Step 6 above)

### Issue 2: See "DIAGNOSTIC" but not "Stage"

**Cause:** The new tracing code might not be compiled in

**Solution:** 
```powershell
cd src-tauri
cargo clean
cargo build
cd ..
npm run tauri:dev
```

### Issue 3: RUST_LOG not persisting

**Cause:** Environment variable resets between commands

**Solution:** Set it in the same command:
```powershell
$env:RUST_LOG="debug"; npm run tauri:dev
```

### Issue 4: Frontend traces not showing

**Cause:** DevTools might be filtering them out

**Solution:**
1. Open DevTools (F12)
2. Go to Console tab
3. Click the filter dropdown (top right)
4. Make sure "Verbose" is checked
5. Clear the filter box
6. Try the fetch again

### Issue 5: No content fetch triggered

**Cause:** App might be using cached data

**Solution:** Force refresh:
```javascript
window.__TAURI__.invoke('fetch_channel_claims', { 
  channelId: '@kiyyamovies:b',
  forceRefresh: true  // Force bypass cache
})
```

## What You Should See

### Backend (Terminal) - Example Output

```
INFO kiyya_desktop::commands: 🚀 DIAGNOSTIC: fetch_channel_claims called
INFO kiyya_desktop::commands: Stage 1: Sending claim_search API request channel_id="@kiyyamovies:b"
INFO kiyya_desktop::commands: Stage 2: Parsing claim_search response total_items=50
INFO kiyya_desktop::commands: Stage 3: Validating stream data claim_id="abc123"
INFO kiyya_desktop::commands: Stage 4: Constructed CDN playback URL claim_id="abc123"
INFO kiyya_desktop::commands: Stage 5: Returning content items to frontend via IPC item_count=50
```

### Frontend (DevTools Console) - Example Output

```
[TRACE] Stage 6: Frontend received content items {component: 'content_pipeline', stage: 'frontend_receive', item_count: 50, ...}
[TRACE] Stage 7: Player mounting with content {component: 'content_pipeline', stage: 'player_mount', claim_id: 'abc123', ...}
```

## Alternative: Simple Test Command

If nothing else works, try this simple test in DevTools Console:

```javascript
// Test if Tauri IPC is working
window.__TAURI__.invoke('test_connection')
  .then(r => console.log('✓ IPC works:', r))
  .catch(e => console.error('✗ IPC failed:', e));

// Test if fetch works
window.__TAURI__.invoke('fetch_channel_claims', { 
  channelId: '@kiyyamovies:b',
  limit: 5
})
  .then(r => {
    console.log('✓ Fetch works, got', r.length, 'items');
    console.log('First item:', r[0]);
  })
  .catch(e => console.error('✗ Fetch failed:', e));
```

## Report Back

Please run through Steps 1-5 and report:

1. What you see in the terminal (copy/paste a few lines)
2. What you see in DevTools Console (copy/paste)
3. Results from Step 5 (Yes/No answers)
4. Any error messages

This will help me identify exactly what's happening!

---

**Created:** 2026-02-25  
**Purpose:** Diagnose why tracing stages are not visible
