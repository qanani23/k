# CRITICAL: All Content Missing from App

## Problem Statement

User reports:
- ✅ 1 video with `hero_trailer` tag exists
- ✅ 1 video with `movie` tag exists  
- ✅ 2 videos with `series` tag exist
- ❌ NONE of them show in the app when running `npm run tauri:dev`

This is NOT just a hero issue - it's a complete content loading failure.

## Immediate Diagnostic Steps

### Step 1: Run the Full Diagnostic Tool

```bash
# Open this file in your browser
start full-app-diagnostic.html

# Click "Run Full Diagnostic"
```

This will test:
1. Channel accessibility
2. Hero content API response
3. Movies API response
4. Series API response
5. All content (no filter)
6. Tag analysis

### Step 2: Check Browser Console

While the app is running (`npm run tauri:dev`):

1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for these logs:

```javascript
// Expected logs:
[API] fetchByTags called: { tags: ['hero_trailer'], limit: 20 }
[API] fetchByTags response: { tags: ['hero_trailer'], count: X, items: [...] }

[API] fetchByTags called: { tags: ['movie'], limit: 50 }
[API] fetchByTags response: { tags: ['movie'], count: X, items: [...] }

[API] fetchByTags called: { tags: ['series'], limit: 50 }
[API] fetchByTags response: { tags: ['series'], count: X, items: [...] }
```

**If count is 0 for all:** Tags are not on the videos  
**If count > 0 but items is []:** Validation is filtering them out  
**If no logs appear:** API calls are not being made

### Step 3: Check Backend Logs

In the terminal where `npm run tauri:dev` is running, look for:

```
Fetching channel claims: channel_id=@kiyyamovies:b, tags=["hero_trailer"]
Returning X items from cache
```

or

```
Fetched and cached X items from remote
```

**If X = 0:** API is returning empty results  
**If errors appear:** Backend is failing to parse responses

## Possible Root Causes

### 1. Tags Are Not Actually on the Videos (Most Likely)

**Symptoms:**
- Diagnostic tool shows 0 items for each tag
- API returns empty arrays

**Verification:**
```bash
# Open channel-video-browser.html
start channel-video-browser.html

# Click "Load All Videos"
# Check if videos have the tags you think they have
```

**Solution:**
1. Go to https://odysee.com/@kiyyamovies:b
2. Edit each video
3. Verify tags are EXACTLY:
   - `hero_trailer` (not `Hero_Trailer` or `hero trailer`)
   - `movie` (not `Movie` or `movies`)
   - `series` (not `Series` or `serie`)
4. Save videos
5. Wait 2-3 minutes
6. Clear cache and restart app

### 2. Channel ID Mismatch

**Symptoms:**
- Diagnostic tool shows "Channel has no content"
- All API calls return empty

**Verification:**
Check `.env` file:
```
VITE_CHANNEL_ID=@kiyyamovies:b
```

**Solution:**
Ensure channel ID matches your actual Odysee channel exactly.

### 3. API Gateway Issue

**Symptoms:**
- Network errors in console
- Timeout errors
- CORS errors

**Verification:**
Check browser Network tab for failed requests to:
```
https://api.na-backend.odysee.com/api/v1/proxy
```

**Solution:**
- Check internet connection
- Try different gateway in `.env`:
  ```
  VITE_ODYSSEE_PROXY=https://api.odysee.com/api/v1/proxy
  ```

### 4. Backend Validation Filtering Out Content

**Symptoms:**
- Diagnostic tool shows items
- Browser console shows `count > 0`
- But also shows validation errors:
  ```
  [API Validation] Invalid content item: { errors: [...] }
  [API Validation] Filtered out invalid items
  ```

**Verification:**
Check console for validation errors listing missing fields.

**Solution:**
Videos may be missing required metadata:
- Title
- Video URLs
- Thumbnail (optional but recommended)

### 5. Cache Corruption

**Symptoms:**
- Diagnostic tool shows items
- But app shows nothing
- No errors in console

**Verification:**
Check if cache has stale data.

**Solution:**
Clear cache:
```bash
# Windows
del %APPDATA%\kiyya\kiyya.db

# Linux/Mac
rm ~/.local/share/kiyya/kiyya.db
```

Then restart app.

### 6. Frontend Not Making API Calls

**Symptoms:**
- No API logs in console
- No network requests in Network tab
- App shows loading state forever or empty state immediately

**Verification:**
Check if Home page is mounting components correctly.

**Solution:**
Check browser console for React errors or component mount failures.

## Diagnostic Checklist

Run through this checklist:

- [ ] Run `full-app-diagnostic.html` - does it show your content?
- [ ] Run `channel-video-browser.html` - do you see your 4 videos?
- [ ] Check each video on Odysee - do they have the exact tags?
- [ ] Open browser console - do you see API logs?
- [ ] Check Network tab - are API requests being made?
- [ ] Check backend logs - are requests reaching the backend?
- [ ] Clear cache - does it help?
- [ ] Check `.env` - is channel ID correct?

## Expected vs Actual

### Expected Behavior:
1. App starts
2. Home page loads
3. Hero component calls `useHeroContent()`
4. API fetches videos with `hero_trailer` tag
5. Returns 1 item
6. Hero displays

7. Movies section calls `useMovies()`
8. API fetches videos with `movie` tag
9. Returns 1 item
10. Movies section displays

11. Series section calls `useSeries()`
12. API fetches videos with `series` tag
13. Returns 2 items
14. Series section displays

### Actual Behavior:
- Nothing shows
- All sections empty or show errors

## Next Steps

1. **FIRST:** Run `full-app-diagnostic.html` and share the results
2. **SECOND:** Run `channel-video-browser.html` and verify tags
3. **THIRD:** Share browser console logs
4. **FOURTH:** Share backend terminal logs

This will help identify the exact point of failure in the data flow.

## Quick Test

Open browser console and run this:

```javascript
// Test if API is accessible
fetch('https://api.na-backend.odysee.com/api/v1/proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    method: 'claim_search',
    params: {
      channel: '@kiyyamovies:b',
      any_tags: ['hero_trailer'],
      page_size: 20,
      page: 1
    }
  })
})
.then(r => r.json())
.then(data => console.log('API Response:', data))
.catch(err => console.error('API Error:', err));
```

If this returns items, the API is working and the issue is in the app.  
If this returns empty or errors, the issue is with the API/tags.
