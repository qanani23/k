# Movies Direct Playback Fix

## Problem Identified

The console showed:
```
[Retry] All 4 attempts failed {error: undefined}
```

This means `resolveClaim(claimId)` was failing in MovieDetail page.

## Root Cause

The flow was:
1. MoviesPage has movie data with video URLs ✅
2. User clicks Play → navigates to `/movie/{claim_id}` ❌
3. MovieDetail tries to call `resolveClaim(claimId)` ❌
4. resolveClaim fails (error: undefined) ❌
5. Page shows error, no movie data ❌
6. PlayerModal never opens ❌

**The problem:** We already HAD the movie data, but threw it away and tried to fetch it again!

## Solution

Changed MoviesPage to open PlayerModal DIRECTLY without navigating to MovieDetail:

### Changes to MoviesPage.tsx

1. **Added imports:**
   ```typescript
   import PlayerModal from '../components/PlayerModal';
   ```

2. **Added state:**
   ```typescript
   const [isPlayerOpen, setIsPlayerOpen] = useState(false);
   const [selectedMovie, setSelectedMovie] = useState<ContentItem | null>(null);
   ```

3. **Changed handlePlayContent:**
   ```typescript
   const handlePlayContent = (content: ContentItem) => {
     console.log("🎬 [DEBUG] MoviesPage handlePlayContent called", content.title);
     setSelectedMovie(content);
     setIsPlayerOpen(true);
   };
   ```
   
   **Before:** `navigate(`/movie/${content.claim_id}`)`
   **After:** Opens PlayerModal directly with the content we already have

4. **Added close handler:**
   ```typescript
   const handleClosePlayer = () => {
     setIsPlayerOpen(false);
     setSelectedMovie(null);
   };
   ```

5. **Added PlayerModal:**
   ```typescript
   {selectedMovie && (
     <PlayerModal
       content={selectedMovie}
       isOpen={isPlayerOpen}
       onClose={handleClosePlayer}
     />
   )}
   ```

## Why This Works

- MoviesPage already has ContentItem with video_urls from backend
- No need to navigate to another page
- No need to call resolveClaim again
- PlayerModal gets the data directly
- Same pattern as Hero section (but with modal instead of background video)

## Testing

1. **Restart app:**
   ```bash
   npm run tauri:dev
   ```

2. **Go to Movies page**

3. **Click on any movie card** (not the detail page, just click the card)

4. **Expected:**
   - Console shows: "🎬 [DEBUG] MoviesPage handlePlayContent called [movie title]"
   - Console shows: "🚀 [DEBUG] PlayerModal component invoked"
   - Console shows: "🟢 [DEBUG] PlayerModal mounted"
   - PlayerModal opens
   - Video plays

## Files Modified

- `src/pages/MoviesPage.tsx` - Added PlayerModal integration, removed navigation to detail page

## Note on MovieDetail Page

The MovieDetail page still exists but is not being used for playback anymore. It was trying to call `resolveClaim` which was failing. 

The MoviesPage now plays videos directly without going through the detail page.

## Summary

✅ Movies: Click card → PlayerModal opens → Video plays
✅ Hero: Background video plays
⏳ Series: Still needs same fix

The key insight: Don't navigate away and refetch data you already have!
