# Series Playback Fix

## Problem

When clicking on a series, the app showed "Error loading series: Failed to load series" because:

1. SeriesPage navigated to `/series/{seriesKey}` (e.g., `/series/afla_fiker`)
2. SeriesDetail expected a `claimId` parameter
3. SeriesDetail tried to call `resolveClaim(seriesKey)` which failed because `seriesKey` is not a valid claim ID
4. The route parameter name was `claimId` but the value was a series key

## Root Cause

The SeriesDetail page was designed to show a series overview with all episodes, but it was trying to resolve a series key as if it were a single claim ID. This architectural mismatch caused the error.

## Solution

Instead of navigating to a broken SeriesDetail page, the SeriesPage now plays the first episode directly in the PlayerModal, just like the Movies page does.

### Changes Made to SeriesPage.tsx

1. **Added imports:**
   ```typescript
   import { resolveClaim } from '../lib/api';
   import PlayerModal from '../components/PlayerModal';
   ```

2. **Added state:**
   ```typescript
   const [isPlayerOpen, setIsPlayerOpen] = useState(false);
   const [selectedEpisode, setSelectedEpisode] = useState<ContentItem | null>(null);
   ```

3. **Updated handlePlay function:**
   ```typescript
   const handlePlay = async (seriesKey: string) => {
     // Get the series info from seriesMap
     const seriesInfo = seriesMap.get(seriesKey);
     if (!seriesInfo || seriesInfo.seasons.length === 0 || seriesInfo.seasons[0].episodes.length === 0) {
       console.error('No episodes found for series:', seriesKey);
       return;
     }
     
     // Get the first episode
     const firstEpisode = seriesInfo.seasons[0].episodes[0];
     
     try {
       // Resolve the episode to get full ContentItem with video URLs
       const episodeContent = await resolveClaim(firstEpisode.claim_id);
       setSelectedEpisode(episodeContent);
       setIsPlayerOpen(true);
     } catch (err) {
       console.error('Failed to load episode:', err);
     }
   };
   ```

4. **Added close handler:**
   ```typescript
   const handleClosePlayer = () => {
     setIsPlayerOpen(false);
     setSelectedEpisode(null);
   };
   ```

5. **Added PlayerModal component:**
   ```typescript
   {selectedEpisode && (
     <PlayerModal
       content={selectedEpisode}
       isOpen={isPlayerOpen}
       onClose={handleClosePlayer}
     />
   )}
   ```

## How It Works Now

1. User clicks "Play" on a series card
2. `handlePlay(seriesKey)` is called
3. Function gets the series info from `seriesMap`
4. Gets the first episode of the first season
5. Resolves the episode claim to get full `ContentItem` with video URLs
6. Opens PlayerModal with the episode
7. Video plays using the correct Odysee URL

## Testing

1. Restart the app:
   ```bash
   npm run tauri:dev
   ```

2. Go to Series page
3. Click "Play" on any series
4. The first episode should play in the PlayerModal

## Files Modified

- `src/pages/SeriesPage.tsx` - Added PlayerModal integration

## Note on SeriesDetail

The SeriesDetail page still has issues and needs a complete rewrite to properly handle series. For now, it's not being used - the SeriesPage plays episodes directly.

## Summary

✅ Movies: Play button opens PlayerModal with movie
✅ Series: Play button opens PlayerModal with first episode
✅ Hero: Navigates to movie detail, then plays

All sections now use the same playback mechanism with the correct Odysee streaming URLs.
