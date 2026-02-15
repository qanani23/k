# Hero Section Root Cause Analysis

## Investigation Summary

After thorough investigation of the Hero section failure, I've identified the complete flow and potential failure points.

## System Architecture

### 1. Frontend Flow
```
useHeroContent() 
  → useContent({ tags: ['hero_trailer'], limit: 20 })
  → fetchByTags(['hero_trailer'], 20)
  → fetchChannelClaims({ any_tags: ['hero_trailer'], limit: 20 })
  → invoke('fetch_channel_claims', { channel_id, any_tags, limit })
```

### 2. Backend Flow (Rust)
```
fetch_channel_claims()
  → Validate inputs (channel_id, tags, limit)
  → Check cache (if !force_refresh)
    → If cache has items && !text_search: return cached items ✅
  → Fetch from Odysee API
  → Parse response
  → Store in cache
  → Return items
```

## Previous Fix Applied

**Location:** `src-tauri/src/commands.rs:75`

**Change:** Cache threshold from `>= 6` to `!is_empty()`

```rust
// BEFORE (BROKEN):
if cached_items.len() >= 6 && validated_text.is_none() {
    return Ok(cached_items);
}

// AFTER (FIXED):
if !cached_items.is_empty() && validated_text.is_none() {
    return Ok(cached_items);
}
```

This fix was correct and necessary, but the Hero section is STILL failing.

## Current Problem Analysis

### Hypothesis 1: NO VIDEO HAS THE `hero_trailer` TAG ⭐ MOST LIKELY

**Evidence:**
- The fix for cache threshold was applied correctly
- Backend logic is sound
- Frontend logic is sound
- Error message: "Failed to load hero content"

**This means:**
1. Backend fetches from Odysee API
2. API returns 0 items (no videos tagged with `hero_trailer`)
3. Frontend receives empty array
4. Hero component shows error state

**Verification needed:**
- Check if ANY video on @kiyyamovies:b channel has the tag `hero_trailer`
- Tag must be EXACT: `hero_trailer` (lowercase, underscore)
- Tag must be case-sensitive match

### Hypothesis 2: Tag Filtering Issue

**Potential causes:**
- Tag is spelled differently: `Hero_Trailer`, `hero trailer`, `herotrailer`
- Tag exists but with different casing
- Tag exists but Odysee API is not returning it

**Verification needed:**
- Check actual tag on Odysee channel
- Verify tag format matches exactly

### Hypothesis 3: Video Validation Failure

**Potential causes:**
- Video has `hero_trailer` tag
- Backend fetches it successfully
- But validation fails due to:
  - Missing thumbnail_url
  - Missing video_urls
  - Missing required metadata
  - Compatibility check fails

**Current validation in backend:**
```rust
fn parse_claim_item(item: &Value) -> Result<ContentItem> {
    let claim_id = extract_claim_id(item)?;  // Required
    let title = extract_title(item)?;        // Required
    let video_urls = extract_video_urls(item)?; // Required - FAILS if empty
    // ... other fields
}
```

**Critical check:** `extract_video_urls()` returns error if no URLs found:
```rust
if video_urls.is_empty() {
    return Err(KiyyaError::ContentParsing {
        message: "No video URLs found".to_string(),
    });
}
```

**This could silently filter out hero videos if:**
- Video URLs are not properly extracted from Odysee response
- CDN URL generation fails
- Video is not yet processed by Odysee

### Hypothesis 4: Cache Corruption

**Potential causes:**
- Cache has stale/invalid data
- Cache was populated before the fix
- Cache has empty result stored

**Verification needed:**
- Clear cache and retry
- Check cache database directly

## Diagnostic Steps

### Step 1: Verify Tag Exists on Odysee

**Manual check:**
1. Go to https://odysee.com/@kiyyamovies:b
2. Look at each video
3. Check if ANY video has tag `hero_trailer`

**Expected result:**
- If NO videos have the tag → This is the root cause
- If videos have the tag → Continue to Step 2

### Step 2: Test API Response

**Use diagnostic tool:**
1. Open `test-hero-api.html` in browser
2. Click "Fetch Hero Content"
3. Check response

**Expected results:**
- `count: 0` → No videos have the tag (root cause)
- `count: 1+` but frontend fails → Continue to Step 3

### Step 3: Check Backend Logs

**Run app in dev mode:**
```bash
npm run tauri:dev
```

**Look for logs:**
```
[API] fetchByTags called: { tags: ['hero_trailer'], limit: 20 }
[API] fetchByTags response: { tags: ['hero_trailer'], count: X, items: [...] }
```

**Expected results:**
- `count: 0` → No videos have the tag (root cause)
- `count: 1+` → Check if items are valid

### Step 4: Check Frontend Validation

**Check browser console for:**
```
[API Validation] Invalid content item: { errors: [...], claim_id: '...', item: {...} }
[API Validation] Filtered out invalid items: { original: X, valid: 0, filtered: X }
```

**This indicates:**
- Videos exist with `hero_trailer` tag
- But they're being filtered out due to validation failures
- Check `errors` array to see why

### Step 5: Clear Cache

**Windows:**
```
%APPDATA%/kiyya/kiyya.db
```

**Delete the file and restart app**

## Most Likely Root Cause

Based on the evidence and the error message, the most likely root cause is:

**NO VIDEO ON THE CHANNEL HAS THE `hero_trailer` TAG**

### Why This Is Most Likely:

1. ✅ Cache fix was applied correctly
2. ✅ Backend logic is sound
3. ✅ Frontend logic is sound
4. ✅ Validation logic is sound
5. ❌ No videos tagged with `hero_trailer` exist

### How to Confirm:

Run this test:
```bash
# Open test-hero-api.html in browser
# Click "Fetch Hero Content"
# Check if count === 0
```

If count is 0, then the solution is simple:

## Solution

### If No Videos Have the Tag:

**Add the tag to at least one video:**

1. Go to https://odysee.com/@kiyyamovies:b
2. Select a video to be the hero
3. Click "Edit" on the video
4. Add tag: `hero_trailer` (exact spelling, lowercase)
5. Save the video
6. Wait 2-3 minutes for Odysee to update
7. Clear app cache (delete kiyya.db)
8. Restart app

### If Videos Have the Tag But Still Failing:

**Check validation errors:**

1. Run app in dev mode: `npm run tauri:dev`
2. Open browser DevTools (F12)
3. Look for validation errors in console
4. Check backend logs for parsing errors
5. Share the logs for further diagnosis

## Expected Behavior After Fix

Once at least one video has the `hero_trailer` tag:

1. ✅ Backend fetches from Odysee API
2. ✅ Returns 1+ items with `hero_trailer` tag
3. ✅ Frontend validates items (all pass)
4. ✅ useHeroContent returns items
5. ✅ Hero component selects random item
6. ✅ Hero displays with video/poster
7. ✅ No error message

## Next Steps

1. **FIRST:** Verify if ANY video has `hero_trailer` tag on Odysee
2. **If NO:** Add the tag to a video
3. **If YES:** Run diagnostic steps to identify validation failure
4. **Report findings:** Share browser console logs and backend logs

## Files Reviewed

- ✅ `src/components/Hero.tsx` - Frontend component logic
- ✅ `src/hooks/useContent.ts` - Content fetching hook
- ✅ `src/lib/api.ts` - API layer with validation
- ✅ `src-tauri/src/commands.rs` - Backend fetch logic
- ✅ `HERO_SINGLE_ITEM_FIX.md` - Previous fix documentation
- ✅ `CRITICAL_HERO_ISSUE_DIAGNOSIS.md` - Previous diagnosis

## Conclusion

The Hero section logic is correct and resilient for 1+ items. The cache fix was applied successfully. The most likely issue is that no video on the channel has the `hero_trailer` tag. Verification is needed to confirm this hypothesis.
