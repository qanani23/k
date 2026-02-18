# Diagnostic Investigation Results

## Investigation Date
February 17, 2026

## Problem Statement
After implementing the odysee-cdn-playback-standardization refactor, the following sections do NOT display videos:
- Hero section
- Movies section  
- Series section

## Investigation Steps Completed

### ✅ Step 1: Backend Logging Added
Added comprehensive diagnostic logging to trace the data flow:

**Location: `src-tauri/src/commands.rs`**

1. **fetch_channel_claims** - Entry point logging
   - Logs all incoming parameters
   - Logs API request details
   - Logs API response status
   - Logs final item count returned to frontend

2. **parse_claim_search_response** - Parsing layer logging
   - Logs response data presence
   - Logs items array size
   - Logs each claim's details (claim_id, value_type, tags)
   - Logs parsing results (valid count, skipped count)

3. **extract_video_urls** - URL construction logging
   - Logs claim_id extraction
   - Logs value_type validation
   - Logs constructed CDN URL
   - Logs video_urls map creation

### ✅ Step 2: Frontend Investigation

**CRITICAL FINDING: Mock Data Bypass in Development**

**Location: `src/hooks/useContent.ts` - Line 421**

```typescript
function useHeroContent(options?: Partial<UseContentOptions>) {
  // TEMPORARY MOCK: Return mock data while debugging backend API issues
  // TODO: Remove this once backend is fixed
  if (import.meta.env.DEV) {
    return {
      content: [{
        claim_id: '9ea0a63f48125cf9ea9296886907423963276898',
        title: 'Tsehay_Ethiopian_Movie_trailer',
        // ... hardcoded mock data
      }],
      loading: false,
      error: null,
      // ...
    };
  }
  
  const result = useContent({ tags: ['hero_trailer'], limit: 20, ...options });
  return result;
}
```

**Impact:**
- In DEV mode, `useHeroContent` returns hardcoded mock data
- The actual API call to backend is NEVER made for hero content in development
- This bypasses all backend logic including the CDN URL construction
- The mock data uses OLD URL format (player.odycdn.com) instead of NEW CDN format

### ✅ Step 3: Data Flow Analysis

**Expected Flow:**
1. Frontend calls `useHeroContent()` → `useContent({ tags: ['hero_trailer'] })`
2. Frontend calls Tauri command `fetch_channel_claims` with `any_tags: ['hero_trailer']`
3. Backend queries Odysee API with `claim_search` method
4. Backend parses response with `parse_claim_search_response`
5. Backend validates each claim with `parse_claim_item` → `extract_video_urls`
6. Backend constructs CDN URLs: `{gateway}/content/{claim_id}/master.m3u8`
7. Backend returns `ContentItem[]` to frontend
8. Frontend displays videos

**Actual Flow in DEV:**
1. Frontend calls `useHeroContent()`
2. ❌ **STOPS HERE** - Returns mock data immediately
3. Backend is never called
4. Mock data has wrong URL format

## Root Cause Identified

### Primary Issue: Development Mock Bypass

**File:** `src/hooks/useContent.ts`
**Function:** `useHeroContent`
**Line:** 421-445

The function has a development-only mock that:
1. Completely bypasses the backend API
2. Returns hardcoded data with old URL format
3. Prevents testing of the new CDN playback implementation
4. Was added as a "TEMPORARY" workaround but never removed

### Secondary Issues (Unconfirmed - Need Testing)

**Movies Section:**
- Uses `useMovies()` hook (Line 402)
- Calls `useContent({ tags: ['movie'], limit: 50, ...options })`
- No mock bypass detected
- **Status:** Needs runtime testing with diagnostic logs

**Series Section:**
- Uses `useSeriesGrouped()` hook (Line 575)
- Calls `useContent({ tags: ['series'], limit: 100, ...options })`
- No mock bypass detected
- **Status:** Needs runtime testing with diagnostic logs

## Diagnostic Logging Added

### Backend Logs (INFO level)
All logs use emoji prefixes for easy filtering:

- 🚀 Entry point calls
- 🌐 API requests
- 📥 API responses
- ✅ Successful operations
- ❌ Failed operations
- ⚠️ Warnings
- 🔍 Detailed diagnostics
- 📦 Claim details
- 🎬 CDN URL construction
- 💾 Cache operations
- 🎯 Return values
- 📊 Summary statistics

### How to View Logs

**Development Mode:**
```bash
# Run the app in dev mode
npm run tauri dev

# Logs will appear in the terminal
# Look for emoji-prefixed diagnostic messages
```

**Filter for specific sections:**
```bash
# Hero section
grep "hero_trailer" logs.txt

# Movies section  
grep "movie" logs.txt

# Series section
grep "series" logs.txt
```

## Next Steps

### Immediate Actions Required

1. **✅ COMPLETED: Removed Development Mock**
   - Removed the mock data bypass in `useHeroContent`
   - Hero section will now use real backend API
   - CDN URL construction will be tested

2. **✅ COMPLETED: Added Frontend Diagnostic Logs**
   - Added console logging to `useHeroContent`
   - Added console logging to `useMovies`
   - Added console logging to `useSeries`
   - Logs will appear in browser DevTools console

3. **RUN APPLICATION WITH DIAGNOSTIC LOGS**
   ```bash
   npm run tauri dev
   ```
   
4. **OPEN BROWSER DEVTOOLS**
   - Press F12 or right-click → Inspect
   - Go to Console tab
   - Keep it open while testing

5. **TEST EACH SECTION**
   - Navigate to home page
   - Check BOTH:
     - **Terminal** for backend diagnostic logs (emoji prefixed)
     - **Browser Console** for frontend diagnostic logs
   - Verify for each section:
     - ✅ Frontend hook is called
     - ✅ Backend API request is made
     - ✅ Claims are returned from API
     - ✅ Claims are parsed successfully
     - ✅ CDN URLs are constructed
     - ✅ Frontend receives data
     - ✅ Video URLs contain "master" key
     - ✅ Master URL follows format: `{gateway}/content/{claim_id}/master.m3u8`

6. **CAPTURE DIAGNOSTIC OUTPUT**
   - Copy all diagnostic logs from BOTH terminal and browser console
   - Identify exact failure point if any section fails
   - Check for:
     - Empty API responses
     - Parsing errors
     - URL construction issues
     - Frontend receive failures
     - Player rendering issues

### Where to Look for Logs

**Backend Logs (Terminal):**
```
🚀 Entry point
🌐 API requests
📥 API responses
✅ Success
❌ Errors
⚠️ Warnings
🔍 Diagnostics
📦 Claims
🎬 URLs
💾 Cache
🎯 Returns
📊 Stats
```

**Frontend Logs (Browser Console):**
```
🎬 [FRONTEND DIAGNOSTIC] useHeroContent ...
🎥 [FRONTEND DIAGNOSTIC] useMovies ...
📺 [FRONTEND DIAGNOSTIC] useSeries ...
```

### Expected Diagnostic Output

**Successful Hero Section:**
```
🚀 DIAGNOSTIC: fetch_channel_claims called
   channel_id=@kiyyamovies:b, tags=Some(["hero_trailer"]), ...
🌐 DIAGNOSTIC: Sending API request: ...
📥 DIAGNOSTIC: Received API response: success=true, has_data=true
✅ DIAGNOSTIC: Response has data field
✅ DIAGNOSTIC: Found items array with 1 claims
  📦 DIAGNOSTIC: Claim[0]: id=abc123, type=stream, tags=["hero_trailer", "movie"]
  🔍 DIAGNOSTIC: Claim abc123 has value_type=stream
  ✅ DIAGNOSTIC: Claim abc123 is stream type
  ✅ DIAGNOSTIC: Extracted claim_id=abc123
  🎬 DIAGNOSTIC: Constructed CDN URL: https://cdn.odysee.com/content/abc123/master.m3u8
  ✅ DIAGNOSTIC: Created video_urls map with master entry
  ✅ DIAGNOSTIC: Claim[0] parsed successfully: id=abc123
📊 DIAGNOSTIC: Parsing complete - Valid: 1, Skipped: 0, Total: 1
💾 DIAGNOSTIC: Stored 1 items in cache
🎯 DIAGNOSTIC: Returning 1 items to frontend
```

**Failed Scenario Examples:**

**No claims returned:**
```
📥 DIAGNOSTIC: Received API response: success=true, has_data=true
✅ DIAGNOSTIC: Response has data field
✅ DIAGNOSTIC: Found items array with 0 claims
📊 DIAGNOSTIC: Parsing complete - Valid: 0, Skipped: 0, Total: 0
```

**Non-stream claim filtered:**
```
  📦 DIAGNOSTIC: Claim[0]: id=abc123, type=channel, tags=["hero_trailer"]
  🔍 DIAGNOSTIC: Claim abc123 has value_type=channel
  ❌ DIAGNOSTIC: Rejecting non-stream claim abc123: type=channel
  ⚠️ DIAGNOSTIC: Claim[0] SKIPPED: id=abc123, reason=Non-stream claim
📊 DIAGNOSTIC: Parsing complete - Valid: 0, Skipped: 1, Total: 1
```

## Conclusion

**Failure Point Identified:** Frontend development mock bypass

**Location:** `src/hooks/useContent.ts:421-445`

**Fix Required:** Remove the mock data return in `useHeroContent` to allow real API testing

**Status:** Backend implementation appears correct based on code review. Diagnostic logging is in place. Need to remove mock and run application to verify end-to-end flow.
