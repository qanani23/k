# Hero Section Debugging Guide

## Issue
Hero section still not showing video after cache threshold fix.

## Root Cause Analysis

### Problem 1: Cache Threshold (FIXED)
- **Location:** `src-tauri/src/commands.rs:75`
- **Issue:** Required >= 6 items in cache
- **Fix:** Changed to `!is_empty()`
- **Status:** ✅ FIXED

### Problem 2: Frontend Validation (FIXED)
- **Location:** `src/lib/api.ts` - `validateContentItem()`
- **Issue:** Was checking for `item.value.source` (raw Odysee API format) instead of `ContentItem` struct fields
- **Fix:** Updated validation to check for `claim_id`, `title`, `tags`, `release_time`, `video_urls`
- **Status:** ✅ FIXED

## Debugging Steps

### 1. Check Browser Console

When you run `npm run tauri:dev`, open the browser DevTools console and look for:

```
[API] fetchByTags called: { tags: ['hero_trailer'], limit: 20, forceRefresh: false }
[API] fetchByTags response: { tags: ['hero_trailer'], count: X, items: [...] }
[useHeroContent] Hook state: { contentCount: X, loading: false, error: null, ... }
```

**Expected:**
- `count` should be 1 (or more)
- `items` array should contain your hero video
- `contentCount` should match

**If count is 0:**
- The backend is not finding any videos tagged with `hero_trailer`
- Check the Odysee channel to verify the tag exists

### 2. Check Backend Logs

Look at the Rust backend logs (in terminal where you ran `npm run tauri:dev`):

```
INFO Fetching channel claims: channel_id=@kiyyamovies:b, tags=Some(["hero_trailer"]), ...
INFO Returning X items from cache
```

or

```
INFO Fetched and cached X items from remote
```

**Expected:**
- Should see "Fetching channel claims" with `tags=Some(["hero_trailer"])`
- Should see either cache hit or remote fetch
- Item count should be 1 or more

### 3. Verify Channel Configuration

Check `.env` file:
```
VITE_CHANNEL_ID=@kiyyamovies:b
```

### 4. Test Backend Directly

You can test the backend command directly using Rust tests:

```bash
cargo test --manifest-path src-tauri/Cargo.toml hero_single_item --no-fail-fast
```

All 4 tests should pass.

### 5. Check Database Cache

The cache might have stale data. To force a refresh:

1. Stop the app
2. Delete the database: `%APPDATA%/kiyya/kiyya.db` (Windows) or `~/.local/share/kiyya/kiyya.db` (Linux/Mac)
3. Restart the app

Or use the force_refresh parameter:
- In browser console: Check if the API call includes `force_refresh: true`

### 6. Verify Odysee Channel

Manually check the Odysee channel:
1. Go to https://odysee.com/@kiyyamovies:b
2. Find the video that should be the hero
3. Check its tags - should include `hero_trailer`
4. Verify it's published and not hidden

## Common Issues

### Issue: "Failed to load hero content"

**Possible Causes:**
1. No videos tagged with `hero_trailer` on the channel
2. Network error preventing API fetch
3. Validation filtering out the video
4. Cache returning empty results

**Solution:**
- Check browser console for detailed error
- Check backend logs for API errors
- Verify tag exists on Odysee channel

### Issue: Hero shows loading spinner forever

**Possible Causes:**
1. API request hanging
2. useContent hook stuck in loading state
3. Network timeout

**Solution:**
- Check browser Network tab for pending requests
- Look for timeout errors in console
- Check if retry logic is working

### Issue: Video exists but doesn't display

**Possible Causes:**
1. Video URL extraction failing
2. Compatibility check failing
3. Frontend validation rejecting the item

**Solution:**
- Check console for validation warnings
- Verify `video_urls` object is not empty
- Check `compatibility.compatible` is true

## Testing the Fix

### Frontend Test
```bash
npm test -- tests/unit/Hero.singleItem.test.tsx --run
```

Expected: All 7 tests pass

### Backend Test
```bash
cargo test --manifest-path src-tauri/Cargo.toml hero_single_item --no-fail-fast
```

Expected: All 4 tests pass

## Files Changed

1. `src-tauri/src/commands.rs` - Fixed cache threshold (>= 6 → !is_empty())
2. `src/lib/api.ts` - Fixed validation (value.source → ContentItem fields)
3. `src/lib/api.ts` - Added detailed logging for fetchByTags
4. `src/hooks/useContent.ts` - Added logging for useHeroContent

## Next Steps

If the issue persists after these fixes:

1. **Capture logs:** Run the app and capture both browser console and backend logs
2. **Check the actual data:** Look at what the API is returning
3. **Verify the tag:** Confirm the video on Odysee has the exact tag `hero_trailer` (case-sensitive)
4. **Test with multiple videos:** Try adding more videos with `hero_trailer` tag to rule out single-item edge cases

## Expected Behavior After Fix

1. App starts
2. Backend fetches from Odysee API (or cache)
3. Returns 1+ items tagged with `hero_trailer`
4. Frontend validates items (should all pass)
5. useHeroContent returns items
6. Hero component selects random item
7. Hero displays with video/poster
8. No error message

## Verification Checklist

- [ ] Backend cache threshold fixed (>= 6 → !is_empty())
- [ ] Frontend validation fixed (checks ContentItem fields)
- [ ] Logging added to API and hooks
- [ ] Frontend tests pass (7/7)
- [ ] Backend tests pass (4/4)
- [ ] Browser console shows hero content being fetched
- [ ] Backend logs show items being returned
- [ ] Hero section displays without error
- [ ] Video autoplays or shows poster
- [ ] All controls work (Play, Favorite, Shuffle)
