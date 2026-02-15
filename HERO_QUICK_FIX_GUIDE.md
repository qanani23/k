# Hero Section - Quick Fix Guide

## Problem
Hero section shows: "Failed to load hero content. Try again."

## Most Likely Cause
No video on your channel has the `hero_trailer` tag.

## Quick Diagnosis

### Option 1: Use Diagnostic Tool (Recommended)
```bash
# Open in browser
start diagnose-hero-issue.html

# Click "Run Full Diagnostic"
# Tool will tell you exactly what's wrong
```

### Option 2: Manual Check
1. Go to https://odysee.com/@kiyyamovies:b
2. Look at your videos
3. Do ANY of them have the tag `hero_trailer`?
   - **NO** → That's the problem (see Solution below)
   - **YES** → See Advanced Troubleshooting

## Solution

### Add the Tag to a Video

1. **Go to your channel:** https://odysee.com/@kiyyamovies:b

2. **Select a video** (preferably a trailer or highlight)

3. **Click "Edit"** on the video

4. **Add the tag:** `hero_trailer`
   - ⚠️ Exact spelling: lowercase, with underscore
   - ❌ NOT: `Hero_Trailer`, `hero trailer`, `herotrailer`
   - ✅ CORRECT: `hero_trailer`

5. **Save the video**

6. **Wait 2-3 minutes** for Odysee to update

7. **Clear app cache:**
   - Windows: Delete `%APPDATA%/kiyya/kiyya.db`
   - Linux/Mac: Delete `~/.local/share/kiyya/kiyya.db`

8. **Restart the app**

9. **Hero section should now work!** ✅

### Optional: Add Multiple Hero Videos

You can add the `hero_trailer` tag to multiple videos:
- Hero section will randomly select one
- Shuffle button will rotate between them
- Provides variety for users

## Verification

After applying the fix:

1. ✅ Hero section displays a video
2. ✅ Video autoplays (muted) or shows poster
3. ✅ Play button works
4. ✅ Favorite button works
5. ✅ Shuffle button works
6. ✅ No error message

## Advanced Troubleshooting

If you've added the tag but it's still not working:

### 1. Check Tag Spelling
- Must be EXACTLY: `hero_trailer`
- Case-sensitive
- Underscore, not space or dash

### 2. Clear Cache
```bash
# Windows
del %APPDATA%\kiyya\kiyya.db

# Linux/Mac
rm ~/.local/share/kiyya/kiyya.db
```

### 3. Check Browser Console
```bash
# Run in dev mode
npm run tauri:dev

# Open browser DevTools (F12)
# Look for errors in Console tab
```

### 4. Check Backend Logs
Look for:
```
Fetching channel claims: channel_id=@kiyyamovies:b, tags=["hero_trailer"]
Fetched and cached X items from remote
```

If X = 0, the tag is not on any video.

### 5. Verify Video Metadata
Video must have:
- ✅ Title
- ✅ Thumbnail
- ✅ Video URL (at least one quality)
- ✅ Tags array

### 6. Wait for Odysee
After adding the tag:
- Wait 2-3 minutes
- Odysee needs time to propagate changes
- Clear cache after waiting

## Still Not Working?

Run the diagnostic tool and share the results:

```bash
start diagnose-hero-issue.html
# Click "Run Full Diagnostic"
# Take a screenshot of the results
```

Also provide:
1. Browser console logs (F12 → Console)
2. Backend logs from `npm run tauri:dev`
3. Screenshot of video edit page showing the tag

## Technical Details

### Why This Happens

The Hero section queries for videos with the `hero_trailer` tag:

```typescript
// Frontend
useHeroContent() → fetchByTags(['hero_trailer'], 20)

// Backend
fetch_channel_claims({ any_tags: ['hero_trailer'] })
```

If no videos have this tag:
- API returns empty array
- Frontend receives no content
- Hero shows error state

### System Requirements

For Hero to work:
- ✅ At least 1 video with `hero_trailer` tag
- ✅ Video must be published (not draft)
- ✅ Video must have valid metadata
- ✅ Tag must be exact match: `hero_trailer`

### Cache Behavior

After fix is applied:
- First load: Fetches from Odysee API
- Subsequent loads: Returns from cache
- Cache TTL: 30 minutes (default)
- Force refresh: Shuffle button or app restart

## Summary

**Problem:** No videos have the `hero_trailer` tag  
**Solution:** Add the tag to at least one video  
**Time to fix:** 5 minutes + 2-3 minutes wait  
**Difficulty:** Easy ⭐

---

**Need Help?** Run `diagnose-hero-issue.html` for detailed analysis.
