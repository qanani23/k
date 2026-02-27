# Complete Playback Diagnostic Guide

## Current Status

✅ **Hero Section**: Background video plays (muted, looping)
❌ **Movies Section**: Play button not working
❌ **Series Section**: Play button not working

---

## How Hero Works (Reference Implementation)

See `stabilization/HERO_PLAYBACK_ANALYSIS.md` for complete details.

**Summary:**
1. Fetches movies with tag='movie'
2. Backend constructs URL: `https://player.odycdn.com/api/v3/streams/free/{claim_name}/{claim_id}/{sd_hash[..6]}.mp4`
3. Frontend gets ContentItem with `video_urls.master.url`
4. Hero renders `<video autoPlay muted loop>` with that URL
5. Video plays in background

**Key Point:** The URL construction is CORRECT and WORKING for Hero.

---

## What Should Happen for Movies/Series

### Expected Flow:
1. User clicks "Play" button on movie/series
2. `handlePlay()` or `handlePlayEpisode()` is called
3. PlayerModal opens with the content
4. PlayerModal extracts URL from `content.video_urls['master'].url`
5. Video plays with controls (unmuted)

### Current Implementation:

**MovieDetail.tsx:**
```typescript
const handlePlay = () => {
  setIsPlayerOpen(true);
};

// ...

{movie && (
  <PlayerModal
    content={movie}
    isOpen={isPlayerOpen}
    onClose={handleClosePlayer}
  />
)}
```

**SeriesPage.tsx:**
```typescript
const handlePlay = async (seriesKey: string) => {
  const seriesInfo = seriesMap.get(seriesKey);
  const firstEpisode = seriesInfo.seasons[0].episodes[0];
  
  const episodeContent = await resolveClaim(firstEpisode.claim_id);
  setSelectedEpisode(episodeContent);
  setIsPlayerOpen(true);
};

// ...

{selectedEpisode && (
  <PlayerModal
    content={selectedEpisode}
    isOpen={isPlayerOpen}
    onClose={handleClosePlayer}
  />
)}
```

---

## Diagnostic Steps

### Step 1: Verify Content Has Video URLs

Open browser console (F12) and run:

```javascript
// Test Movies
async function testMovieURLs() {
  const movies = await window.__TAURI__.invoke('fetch_channel_claims', {
    channelId: '@kiyyamovies:b',
    anyTags: ['movie'],
    limit: 3
  });
  
  console.log('=== MOVIES TEST ===');
  movies.forEach((movie, i) => {
    console.log(`\nMovie ${i + 1}: ${movie.title}`);
    console.log('  claim_id:', movie.claim_id);
    console.log('  has video_urls:', !!movie.video_urls);
    console.log('  video_urls keys:', Object.keys(movie.video_urls || {}));
    
    if (movie.video_urls && movie.video_urls.master) {
      console.log('  master URL:', movie.video_urls.master.url);
      console.log('  URL type:', movie.video_urls.master.url_type);
    } else {
      console.log('  ❌ NO MASTER URL!');
    }
  });
}

testMovieURLs();
```

**Expected Output:**
```
=== MOVIES TEST ===

Movie 1: man_ayebgn_Ethiopian_Movie
  claim_id: faf0de58484f01c3da49ccf2d5466b28f69a91eb
  has video_urls: true
  video_urls keys: ['master']
  master URL: https://player.odycdn.com/api/v3/streams/free/man_ayebgn_Ethiopian_Movie/faf0de58484f01c3da49ccf2d5466b28f69a91eb/03427c.mp4
  URL type: mp4
```

### Step 2: Check PlayerModal Receives Content

When you click "Play" on a movie, check console for:

```
[TRACE] Stage 7: Player mounting with content
{
  claim_id: "...",
  title: "...",
  has_video_urls: true,
  video_url_keys: ["master"],
  current_quality: "master"
}

[TRACE] Stage 7: Video URL selected
{
  claim_id: "...",
  selected_url: "https://player.odycdn.com/api/v3/streams/free/...",
  is_hls: false,
  hls_supported: true,
  native_hls_supported: ""
}
```

### Step 3: Check Video Element

If PlayerModal opens but video doesn't play, check:

1. **Network Tab** (F12 → Network):
   - Look for request to `player.odycdn.com`
   - Check status code (should be 200)
   - Check response type (should be video/mp4)

2. **Console Errors**:
   - Look for CORS errors
   - Look for codec errors
   - Look for network errors

3. **Video Element**:
   - Right-click on video area → Inspect
   - Check if `<video>` element exists
   - Check if `src` attribute is set
   - Check for error events

---

## Common Issues and Solutions

### Issue 1: "video_urls is undefined"

**Symptom:** Console shows `has_video_urls: false`

**Cause:** Backend failed to construct URLs (missing sd_hash, claim_id, or name)

**Solution:** Check backend logs for errors in `extract_video_urls()`

### Issue 2: "PlayerModal doesn't open"

**Symptom:** Clicking Play does nothing, no modal appears

**Cause:** 
- `handlePlay()` not called
- `isPlayerOpen` state not updating
- Modal rendering condition failing

**Solution:** Add console.log in handlePlay:
```typescript
const handlePlay = () => {
  console.log('🎬 handlePlay called');
  setIsPlayerOpen(true);
  console.log('🎬 isPlayerOpen set to true');
};
```

### Issue 3: "Modal opens but video doesn't play"

**Symptom:** Modal appears, but video area is black or shows loading forever

**Possible Causes:**

**A. URL is wrong:**
- Check console for selected_url
- Verify URL format matches: `https://player.odycdn.com/api/v3/streams/free/{name}/{id}/{hash}.mp4`
- Test URL in browser: should download/play

**B. CORS blocking:**
- Check console for CORS errors
- Verify `tauri.conf.json` has `https://player.odycdn.com/**` in CSP

**C. Codec not supported:**
- Check console for codec warnings
- Video might use unsupported codec

**D. Network error:**
- Check Network tab for 403, 404, or timeout
- URL might be inaccessible

### Issue 4: "resolveClaim fails for series"

**Symptom:** Console shows "All 4 attempts failed" when clicking series

**Cause:** Trying to resolve a series_key as a claim_id

**Solution:** Already fixed in SeriesPage - it now resolves the episode claim_id, not the series key

---

## Test Plan

### Test 1: Hero Section (Baseline)
1. Go to Home page
2. Observe hero section
3. **Expected:** Video plays in background (muted)
4. **Verify:** Video URL in Network tab matches pattern

### Test 2: Movies Section
1. Go to Movies page
2. Click on any movie
3. Click "Play" button
4. **Expected:** PlayerModal opens, video plays with controls
5. **Verify:** Console shows Stage 7 traces with correct URL

### Test 3: Series Section
1. Go to Series page
2. Click on any series
3. Click "Play" button
4. **Expected:** PlayerModal opens with first episode, video plays
5. **Verify:** Console shows episode resolution and Stage 7 traces

---

## Debug Commands

### Check if PlayerModal is imported:
```javascript
// In browser console, after clicking Play
document.querySelector('[role="dialog"]') // Should find modal
```

### Check video element:
```javascript
// In browser console, when modal is open
const video = document.querySelector('video');
console.log('Video element:', video);
console.log('Video src:', video?.src);
console.log('Video readyState:', video?.readyState);
console.log('Video error:', video?.error);
```

### Test URL directly:
```javascript
// Copy URL from console, then test:
fetch('https://player.odycdn.com/api/v3/streams/free/man_ayebgn_Ethiopian_Movie/faf0de58484f01c3da49ccf2d5466b28f69a91eb/03427c.mp4', {
  method: 'HEAD'
}).then(r => console.log('Status:', r.status, 'Type:', r.headers.get('content-type')));
```

---

## What to Report

When testing, please provide:

1. **Which section** (Movies or Series)
2. **What happens** when you click Play:
   - Does modal open?
   - Is video area visible?
   - Does video play?
   - Any error messages?
3. **Console output:**
   - Stage 7 traces
   - Any errors (red text)
4. **Network tab:**
   - Request to player.odycdn.com
   - Status code
   - Response type

This will help identify exactly where the issue is.
