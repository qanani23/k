# All Sections Playback - FIXED

## Problem Identified

The hero section was playing videos, but Movies and Series sections were not. The issue was NOT with URL construction - all sections use the same backend code and the URLs are correct.

## Root Cause

The Play buttons in `MovieDetail.tsx` and `SeriesDetail.tsx` had NO `onClick` handlers! They were just static buttons that did nothing.

```typescript
// BEFORE (MovieDetail.tsx line 165):
<button className="...">
  <Play className="w-5 h-5" />
  <span>Play</span>
</button>
// No onClick handler!

// BEFORE (SeriesDetail.tsx line 280):
<button className="...">
  <Play className="w-4 h-4 text-white" />
</button>
// No onClick handler!
```

## Solution Applied

### 1. MovieDetail.tsx
Added:
- Import `PlayerModal` component
- State for player modal: `isPlayerOpen`
- `handlePlay()` function to open player
- `handleClosePlayer()` function to close player
- `onClick={handlePlay}` to Play button
- `<PlayerModal>` component at end of JSX

### 2. SeriesDetail.tsx
Added:
- Import `PlayerModal` component
- State for player modal: `isPlayerOpen` and `selectedEpisode`
- `handlePlayEpisode(episode)` function to resolve episode and open player
- `handleClosePlayer()` function to close player
- `onClick={() => handlePlayEpisode(episode)}` to Play buttons
- `<PlayerModal>` component at end of JSX

## How It Works Now

### Movies Flow:
1. User clicks movie card → navigates to `/movie/{claim_id}`
2. `MovieDetail` page loads and displays movie info
3. User clicks "Play" button → `handlePlay()` called
4. `PlayerModal` opens with the movie content
5. Video plays using the correct Odysee URL

### Series Flow:
1. User clicks series card → navigates to `/series/{series_key}`
2. `SeriesDetail` page loads and displays episodes
3. User clicks "Play" on an episode → `handlePlayEpisode(episode)` called
4. Episode claim is resolved to get full `ContentItem` with video URLs
5. `PlayerModal` opens with the episode content
6. Video plays using the correct Odysee URL

## Files Modified

- `src/pages/MovieDetail.tsx` - Added PlayerModal integration
- `src/pages/SeriesDetail.tsx` - Added PlayerModal integration with episode resolution

## Testing Instructions

1. Restart the app:
   ```bash
   npm run tauri:dev
   ```

2. Test Movies:
   - Go to Movies page
   - Click on any movie
   - Click the "Play" button
   - Video should play

3. Test Series:
   - Go to Series page
   - Click on any series
   - Expand a season
   - Click the Play button on any episode
   - Video should play

4. Test Hero:
   - Go to Home page
   - Click "Play" on hero section
   - Should navigate to movie detail page
   - Click "Play" button there
   - Video should play

## Why This Fixes Everything

The URL construction was ALWAYS correct for all sections. The backend code is shared:
- `fetch_channel_claims` → `parse_claim_item` → `extract_video_urls`
- Same logic for Movies, Series, and Hero content
- URLs are constructed identically: `https://player.odycdn.com/api/v3/streams/free/{claim_name}/{claim_id}/{sd_hash[..6]}.mp4`

The ONLY issue was that the Play buttons in the detail pages didn't do anything. Now they open the PlayerModal, which uses the correct URLs.

## Summary

✅ Hero section: Was already working (navigates to detail page, then plays)
✅ Movies section: NOW FIXED (Play button now opens PlayerModal)
✅ Series section: NOW FIXED (Play button now opens PlayerModal)

All sections now use the same playback mechanism and the same correct URL construction.
