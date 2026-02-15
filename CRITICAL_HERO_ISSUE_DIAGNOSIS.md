# CRITICAL: Hero Section Not Working - Diagnosis

## Current Status
After fixing two bugs (cache threshold and validation), the Hero section is still not displaying.

## Most Likely Root Cause

**There is NO video tagged with `hero_trailer` on the @kiyyamovies:b channel.**

## How to Verify

### Option 1: Use the Diagnostic Tool (RECOMMENDED)

1. Open `test-hero-api.html` in your browser
2. Click "Fetch Hero Content" button
3. Check the result:
   - **If it shows 0 items:** NO video has the `hero_trailer` tag
   - **If it shows 1+ items:** The tag exists, but there's another issue

### Option 2: Check Manually on Odysee

1. Go to https://odysee.com/@kiyyamovies:b
2. Look at each video
3. Check if ANY video has the tag `hero_trailer` (exact spelling, case-sensitive)

### Option 3: Check Browser Console

1. Run `npm run tauri:dev`
2. Open browser DevTools (F12)
3. Look for these logs:

```
[API] fetchByTags called: { tags: ['hero_trailer'], limit: 20, forceRefresh: false }
[API] fetchByTags response: { tags: ['hero_trailer'], count: 0, items: [] }
```

If `count: 0`, then NO videos have the tag.

## Solution

### If NO videos have the `hero_trailer` tag:

You need to add the tag to at least one video on your Odysee channel:

1. Go to https://odysee.com/@kiyyamovies:b
2. Select a video you want as the hero
3. Click "Edit" on the video
4. Add the tag `hero_trailer` (exact spelling, lowercase)
5. Save the video
6. Wait a few minutes for Odysee to update
7. Restart your app

### If videos DO have the tag but it's still not working:

Check these issues:

#### Issue 1: Tag Spelling/Casing
- Tag must be EXACTLY: `hero_trailer`
- Not: `Hero_Trailer`, `hero trailer`, `herotrailer`, `hero-trailer`

#### Issue 2: Video Not Published
- Video must be published (not draft/unlisted)
- Check video visibility settings

#### Issue 3: Cache Issue
- Delete the database cache:
  - Windows: `%APPDATA%/kiyya/kiyya.db`
  - Linux/Mac: `~/.local/share/kiyya/kiyya.db`
- Restart the app

#### Issue 4: Network/API Issue
- Check browser Network tab for failed requests
- Look for errors in backend logs
- Try force refresh: Add `force_refresh: true` parameter

## Testing Without Real Content

If you want to test the Hero section without adding a real video to Odysee, you can:

### Option 1: Mock the Data (Development Only)

Edit `src/hooks/useContent.ts` and add a mock for development:

```typescript
export function useHeroContent(options?: Partial<UseContentOptions>) {
  // TEMPORARY: Mock hero content for testing
  if (import.meta.env.DEV) {
    return {
      content: [{
        claim_id: 'mock-hero-123',
        title: 'Mock Hero Video',
        description: 'This is a mock hero video for testing',
        tags: ['hero_trailer', 'movie'],
        thumbnail_url: 'https://via.placeholder.com/1920x1080',
        duration: 7200,
        release_time: Date.now(),
        video_urls: {
          '1080p': { url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', quality: '1080p', type: 'mp4' }
        },
        compatibility: { compatible: true, fallback_available: false }
      }],
      loading: false,
      error: null,
      refetch: () => Promise.resolve(),
      loadMore: () => Promise.resolve(),
      hasMore: false,
      fromCache: false,
      status: 'success' as const
    };
  }
  
  const result = useContent({ tags: ['hero_trailer'], limit: 20, ...options });
  // ... rest of the code
}
```

### Option 2: Use a Different Tag Temporarily

If you have videos with other tags (like `movie`), you can temporarily change the hero tag:

Edit `src/hooks/useContent.ts`:

```typescript
export function useHeroContent(options?: Partial<UseContentOptions>) {
  // TEMPORARY: Use 'movie' tag instead of 'hero_trailer' for testing
  const result = useContent({ tags: ['movie'], limit: 20, ...options });
  // ...
}
```

This will show a random movie as the hero.

## Expected Behavior After Fix

Once you have at least one video tagged with `hero_trailer`:

1. App starts
2. Backend fetches from Odysee API
3. Returns 1+ items with `hero_trailer` tag
4. Frontend validates items (all pass)
5. useHeroContent returns items
6. Hero component selects random item
7. Hero displays with video/poster
8. No error message

## Verification Checklist

- [ ] Confirmed at least one video has `hero_trailer` tag on Odysee
- [ ] Tag spelling is exact: `hero_trailer` (lowercase, underscore)
- [ ] Video is published and visible
- [ ] Cleared database cache
- [ ] Restarted app
- [ ] Checked browser console for logs
- [ ] Checked backend logs for API responses
- [ ] Used diagnostic tool to verify API returns data

## Next Steps

1. **FIRST:** Use `test-hero-api.html` to check if ANY videos have the `hero_trailer` tag
2. **If NO videos found:** Add the tag to a video on Odysee
3. **If videos found:** Check the other issues listed above
4. **If still not working:** Share the browser console logs and backend logs for further diagnosis
