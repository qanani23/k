# Infinite Loading State Diagnostic

## Problem
After fixing the parameter naming bug, sections are now stuck in infinite loading state:
- Hero section: Loading skeleton forever
- Movies section: Loading skeleton forever
- Series section: Loading skeleton forever

## Diagnostic Logging Added

### Backend Logs (Terminal)
Added step-by-step logging to `src-tauri/src/commands.rs`:

```
🚀 DIAGNOSTIC: fetch_channel_claims called
🔍 DIAGNOSTIC: Validating channel_id
✅ DIAGNOSTIC: Channel ID validated
🔍 DIAGNOSTIC: Validating inputs
✅ DIAGNOSTIC: All inputs validated
🔍 DIAGNOSTIC: Checking cache
🔍 DIAGNOSTIC: Calling db.get_cached_content
🔍 DIAGNOSTIC: Cache returned X items
✅ DIAGNOSTIC: Returning X items from cache (if cache hit)
🔍 DIAGNOSTIC: Cache miss or text search, fetching from remote
🔍 DIAGNOSTIC: Acquiring gateway lock
✅ DIAGNOSTIC: Gateway lock acquired
🌐 DIAGNOSTIC: Sending API request
🔍 DIAGNOSTIC: Calling gateway.fetch_with_failover
📥 DIAGNOSTIC: Received API response
🔍 DIAGNOSTIC: Dropping gateway lock
🔍 DIAGNOSTIC: Calling parse_claim_search_response
✅ DIAGNOSTIC: Parsed X items
🔍 DIAGNOSTIC: Acquiring database lock for caching
🔍 DIAGNOSTIC: Storing items in cache
💾 DIAGNOSTIC: Stored X items in cache
🎯 DIAGNOSTIC: About to return X items to frontend
✅ DIAGNOSTIC: fetch_channel_claims returning SUCCESS with X items
❌ DIAGNOSTIC: fetch_channel_claims returning ERROR: ... (if error)
```

### Frontend Logs (Browser Console)
Added step-by-step logging to `src/hooks/useContent.ts` and `src/lib/api.ts`:

```
🔍 [FRONTEND] About to fetch content
🔍 [FRONTEND] Calling fetchByTags with tags: [...]
🔍 [API] About to invoke fetch_channel_claims with params: {...}
✅ [API] invoke returned, response type: ...
✅ [API] validateAndFilterContent returned X items
✅ [FRONTEND] fetchByTags returned: X items
🔍 [FRONTEND] Fetch completed, storing in memory manager
🔍 [FRONTEND] Storing X items in memory manager
✅ [FRONTEND] Stored in memory manager
🔍 [FRONTEND] Updating content state
✅ [FRONTEND] Content state updated
🔍 [FRONTEND] Setting status to success
✅ [FRONTEND] Status set to success
🔍 [FRONTEND] Finally block - resetting fetchInProgressRef
✅ [FRONTEND] fetchInProgressRef reset to false
```

## What to Look For

### Scenario 1: Backend Never Returns
**Symptoms:**
- Terminal shows: `🚀 DIAGNOSTIC: fetch_channel_claims called`
- But never shows: `✅ DIAGNOSTIC: fetch_channel_claims returning SUCCESS`

**Possible Causes:**
- Database lock deadlock
- Gateway lock deadlock
- API call hanging (fetch_with_failover never returns)
- Parsing hanging (infinite loop in parse_claim_search_response)

**Look for last log before hang:**
- If last log is `🔍 DIAGNOSTIC: Acquiring gateway lock` → Gateway lock issue
- If last log is `🔍 DIAGNOSTIC: Calling gateway.fetch_with_failover` → API call hanging
- If last log is `🔍 DIAGNOSTIC: Calling parse_claim_search_response` → Parsing hanging
- If last log is `🔍 DIAGNOSTIC: Acquiring database lock for caching` → DB lock issue

### Scenario 2: Backend Returns But Frontend Never Receives
**Symptoms:**
- Terminal shows: `✅ DIAGNOSTIC: fetch_channel_claims returning SUCCESS with X items`
- Browser shows: `🔍 [API] About to invoke fetch_channel_claims`
- But never shows: `✅ [API] invoke returned`

**Possible Causes:**
- Tauri invoke call hanging
- Serialization issue (backend returns data that can't be serialized to JSON)
- IPC communication failure

### Scenario 3: Frontend Receives But Never Updates State
**Symptoms:**
- Browser shows: `✅ [FRONTEND] fetchByTags returned: X items`
- But never shows: `✅ [FRONTEND] Status set to success`

**Possible Causes:**
- State update blocked
- React render cycle issue
- Memory manager hanging
- setContent() not triggering re-render

### Scenario 4: State Updates But Component Doesn't Re-render
**Symptoms:**
- Browser shows: `✅ [FRONTEND] Status set to success`
- But UI still shows loading skeleton

**Possible Causes:**
- Component not subscribed to state changes
- Conditional rendering logic issue
- loading state not being read correctly

### Scenario 5: Error Thrown But Not Caught
**Symptoms:**
- Logs stop abruptly
- No error message
- No success message

**Possible Causes:**
- Unhandled exception
- Promise rejection not caught
- Panic in Rust code

## How to Run Diagnostics

1. **Start the application:**
   ```bash
   npm run tauri dev
   ```

2. **Open DevTools:**
   - Press F12
   - Go to Console tab

3. **Navigate to home page**

4. **Watch BOTH logs simultaneously:**
   - Terminal (backend)
   - Browser console (frontend)

5. **Identify where execution stops:**
   - Find the LAST log message before hang
   - That's where the issue is

## Expected Complete Flow

**Backend (Terminal):**
```
🚀 DIAGNOSTIC: fetch_channel_claims called
🔍 DIAGNOSTIC: Validating channel_id
✅ DIAGNOSTIC: Channel ID validated
🔍 DIAGNOSTIC: Validating inputs
✅ DIAGNOSTIC: All inputs validated
🔍 DIAGNOSTIC: Checking cache
🔍 DIAGNOSTIC: Calling db.get_cached_content
🔍 DIAGNOSTIC: Cache returned 0 items
🔍 DIAGNOSTIC: Cache miss or text search, fetching from remote
🔍 DIAGNOSTIC: Acquiring gateway lock
✅ DIAGNOSTIC: Gateway lock acquired
🌐 DIAGNOSTIC: Sending API request
🔍 DIAGNOSTIC: Calling gateway.fetch_with_failover
📥 DIAGNOSTIC: Received API response: success=true, has_data=true
🔍 DIAGNOSTIC: Dropping gateway lock
🔍 DIAGNOSTIC: Calling parse_claim_search_response
✅ DIAGNOSTIC: Response has data field
✅ DIAGNOSTIC: Found items array with 5 claims
  📦 DIAGNOSTIC: Claim[0]: id=xxx, type=stream, tags=[...]
  ✅ DIAGNOSTIC: Claim[0] parsed successfully: id=xxx
📊 DIAGNOSTIC: Parsing complete - Valid: 5, Skipped: 0, Total: 5
✅ DIAGNOSTIC: Parsed 5 items
🔍 DIAGNOSTIC: Acquiring database lock for caching
🔍 DIAGNOSTIC: Storing items in cache
💾 DIAGNOSTIC: Stored 5 items in cache
🎯 DIAGNOSTIC: About to return 5 items to frontend
✅ DIAGNOSTIC: fetch_channel_claims returning SUCCESS with 5 items
```

**Frontend (Browser Console):**
```
🎥 [FRONTEND DIAGNOSTIC] useMovies called, filterTag: undefined
🔍 [FRONTEND] About to fetch content: { tags: ['movie'], limit: 50 }
🔍 [FRONTEND] Calling fetchByTags with tags: ['movie']
🔍 [API] About to invoke fetch_channel_claims with params: {...}
✅ [API] invoke returned, response type: object, is array: true
✅ [API] validateAndFilterContent returned 5 items
✅ [FRONTEND] fetchByTags returned: 5 items
🔍 [FRONTEND] Fetch completed, storing in memory manager
🔍 [FRONTEND] Storing 5 items in memory manager
✅ [FRONTEND] Stored in memory manager
🔍 [FRONTEND] Updating content state
✅ [FRONTEND] Content state updated
🔍 [FRONTEND] Setting status to success
✅ [FRONTEND] Status set to success
🔍 [FRONTEND] Finally block - resetting fetchInProgressRef
✅ [FRONTEND] fetchInProgressRef reset to false
🎥 [FRONTEND DIAGNOSTIC] useMovies result: { contentCount: 5, loading: false, ... }
```

## Common Hang Points

### 1. Database Lock Hang
**Last log:** `🔍 DIAGNOSTIC: Acquiring database lock for caching`
**Cause:** Another operation holds the lock
**Fix:** Check for deadlock, ensure locks are always dropped

### 2. Gateway Lock Hang
**Last log:** `🔍 DIAGNOSTIC: Acquiring gateway lock`
**Cause:** Gateway lock not released from previous call
**Fix:** Ensure gateway lock is always dropped

### 3. API Call Hang
**Last log:** `🔍 DIAGNOSTIC: Calling gateway.fetch_with_failover`
**Cause:** HTTP request never completes
**Fix:** Check network, add timeout, verify API endpoint

### 4. Parsing Hang
**Last log:** `🔍 DIAGNOSTIC: Calling parse_claim_search_response`
**Cause:** Infinite loop in parsing logic
**Fix:** Check parsing code for loops without exit condition

### 5. Invoke Hang
**Last log:** `🔍 [API] About to invoke fetch_channel_claims`
**Cause:** Tauri IPC communication failure
**Fix:** Check Tauri configuration, verify command registration

## Next Steps

1. Run the application
2. Copy the LAST log message before hang from BOTH terminal and browser
3. Share those logs
4. We'll identify the exact hang point
5. Fix that specific issue

## Status

✅ Comprehensive logging added
✅ Ready for diagnostic run
⏳ Waiting for user to run and report hang point
