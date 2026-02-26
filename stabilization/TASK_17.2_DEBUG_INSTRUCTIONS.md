# Task 17.2: Debug Instructions - URGENT

## Critical Finding
✅ **Odysee website works** - External API is operational
❌ **Kiyya app broken** - Cannot load content
❌ **Settings stuck loading** - Even local features broken

## Root Cause Analysis

### What We Know
1. ✅ No gateway code was deleted during stabilization (verified in DELETIONS.md)
2. ✅ No API-related code was removed
3. ✅ Backend initializes successfully
4. ❌ All 3 Odysee API gateways failing in the app
5. ❌ Settings menu stuck in loading state (local feature!)

### Critical Clue
**Settings being stuck in loading is a MAJOR clue!**

Settings should work completely independently of the Odysee API. If settings are stuck loading, this suggests:
- Frontend state management issue
- React component lifecycle problem
- API client initialization failure
- Global error blocking all features

## Immediate Debug Steps

### Step 1: Check Browser Console (CRITICAL)
1. With the app window open, press **F12** to open DevTools
2. Click the **Console** tab
3. Look for RED error messages
4. Copy ALL error messages you see

**What to look for:**
- JavaScript errors
- React errors
- "Cannot read property" errors
- "undefined is not a function" errors
- Any RED text

### Step 2: Check Network Tab
1. In DevTools, click the **Network** tab
2. Refresh the app or click on Movies/Series
3. Look at the requests being made

**What to check:**
- Are ANY requests being made to Odysee APIs?
- What status codes are returned? (200, 404, 500, etc.)
- Are requests failing immediately or timing out?
- Click on a failed request and check the "Response" tab

### Step 3: Check for Frontend Build Issues
In the terminal where the app is running, look for:
- Vite compilation errors
- TypeScript errors
- Module not found errors

## Possible Root Causes

### Theory 1: Frontend API Client Broken
**Symptoms:** Settings stuck, no content loads
**Cause:** API client initialization failing, blocking all features
**Check:** Console errors mentioning "api", "invoke", or "tauri"

### Theory 2: React State Management Issue
**Symptoms:** Everything stuck in loading state
**Cause:** State management broken, components never leave loading state
**Check:** Console errors mentioning "state", "context", or "provider"

### Theory 3: Tauri Invoke Failure
**Symptoms:** No backend communication
**Cause:** Tauri invoke calls failing silently
**Check:** Console errors mentioning "invoke" or "__TAURI__"

### Theory 4: Missing Environment Variable or Config
**Symptoms:** API calls constructed incorrectly
**Cause:** Missing .env variable or config value
**Check:** Console errors mentioning "undefined" or "null"

### Theory 5: CORS or Security Policy
**Symptoms:** API requests blocked
**Cause:** Browser security policy blocking requests
**Check:** Console errors mentioning "CORS", "blocked", or "security"

## What to Report

Please provide the following information:

### 1. Console Errors
```
[Copy and paste ALL console errors here]
```

### 2. Network Requests
- Are requests being made to Odysee APIs? YES/NO
- If YES, what status codes? (200, 404, 500, etc.)
- If NO, are ANY network requests being made at all?

### 3. Terminal Output
```
[Copy any errors from the terminal where npm run tauri:dev is running]
```

### 4. Settings Menu Behavior
- Does the settings button respond when clicked? YES/NO
- Does a modal/page open? YES/NO
- Is it just showing a loading spinner forever? YES/NO

## Quick Test Commands

If you can open the DevTools Console, try running these commands:

### Test 1: Check if Tauri is available
```javascript
console.log(window.__TAURI__)
```
**Expected:** Should show an object with invoke, event, etc.
**If undefined:** Tauri bridge is broken

### Test 2: Test basic Tauri invoke
```javascript
window.__TAURI__.invoke('test_connection')
  .then(res => console.log('✓ Backend OK:', res))
  .catch(err => console.error('✗ Backend FAIL:', err))
```
**Expected:** "✓ Backend OK: tauri-backend-alive"
**If error:** Backend communication is broken

### Test 3: Test settings command
```javascript
window.__TAURI__.invoke('get_app_config')
  .then(res => console.log('✓ Settings OK:', res))
  .catch(err => console.error('✗ Settings FAIL:', err))
```
**Expected:** Should return app config object
**If error:** Settings command is broken

### Test 4: Test content fetch
```javascript
window.__TAURI__.invoke('fetch_channel_claims', { 
  channelId: '@kiyyamovies:b' 
})
  .then(res => console.log('✓ Content OK:', res))
  .catch(err => console.error('✗ Content FAIL:', err))
```
**Expected:** Should return claims array
**If error:** Content fetching is broken

## Next Steps Based on Findings

### If Console Shows Errors
- Copy the errors and share them
- We'll identify the exact issue from the error messages

### If No Console Errors
- This is unusual and suggests silent failure
- Check Network tab for failed requests
- May need to add debug logging to frontend

### If Tauri Invoke Fails
- Backend communication is broken
- May need to check Tauri configuration
- May need to rebuild the app

### If Tauri Invoke Works But Content Fails
- Backend is OK, but API integration is broken
- Need to debug gateway selection logic
- May be a configuration or URL issue

## Urgency

This is a **CRITICAL BUG** that makes the application completely unusable. We need the console errors to diagnose the root cause.

**Please open DevTools (F12), check the Console tab, and share any error messages you see.**

---

**Status:** BLOCKED - Awaiting console error messages for diagnosis
**Priority:** CRITICAL
**Next Action:** User to provide console errors from DevTools
