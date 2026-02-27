# Series Episode Selector - Testing Guide

## Quick Test Steps

### 1. Start the Application

```bash
npm run tauri:dev
```

### 2. Test Series Page

1. Navigate to `/series` route
2. Click "Play" on any series
3. **Expected**: Episode selector modal opens
4. **Expected**: Shows all seasons with episodes
5. Click on any episode
6. **Expected**: Episode selector closes
7. **Expected**: PlayerModal opens immediately
8. **Expected**: Video starts playing
9. **Expected**: No "All 4 attempts failed" errors in console

### 3. Test Home Page

1. Navigate to home page (`/`)
2. Find a series in any carousel (Series, Sitcoms, etc.)
3. Click "Play" on the series
4. **Expected**: Episode selector modal opens
5. **Expected**: Shows all seasons with episodes
6. Click on any episode
7. **Expected**: Episode selector closes
8. **Expected**: PlayerModal opens immediately
9. **Expected**: Video starts playing

### 4. Test Movies (Control Test)

1. Navigate to `/movies` route
2. Click "Play" on any movie
3. **Expected**: PlayerModal opens directly (no episode selector)
4. **Expected**: Video starts playing

## Console Debugging

Watch for these debug logs:

### When clicking Play on series:
```
📺 [DEBUG] SeriesPage handlePlay called <series-key>
```

### When selecting episode:
```
🎬 [DEBUG] Episode selected <episode-title> <claim-id>
✅ [DEBUG] Found episode in content map <episode-title>
```

### What you should NOT see:
```
❌ [DEBUG] Episode not found in content map
🔄 [DEBUG] Attempting to resolve episode...
[Retry] All 4 attempts failed
```

## Known Issues to Watch For

### Issue 1: Episode Not Found in Map
**Symptom**: Console shows "Episode not found in content map"
**Cause**: The episode's claim_id is not in the contentMap
**Solution**: Check that useSeriesGrouped is properly building the contentMap

### Issue 2: Wrong Episode Plays
**Symptom**: Clicking episode 3 plays episode 1
**Cause**: Episode selector is passing wrong episode data
**Solution**: Check EpisodeSelector component's onSelectEpisode callback

### Issue 3: Episode Selector Doesn't Open
**Symptom**: Clicking Play does nothing
**Cause**: Series key extraction failing or seriesMap doesn't have the series
**Solution**: Check extractSeriesKey function and seriesMap contents

## Success Criteria

✅ Episode selector opens when clicking Play on series
✅ All seasons and episodes are visible
✅ Clicking an episode plays that specific episode
✅ No network requests to resolve episodes (check Network tab)
✅ No errors in console
✅ Video plays immediately after selecting episode
✅ Works on both Series page and Home page
✅ Movies still work (play directly without episode selector)

## Performance Check

- Episode selector should open instantly (< 100ms)
- Episode playback should start immediately after selection (< 500ms)
- No loading spinners or delays
- No "resolving..." messages

## Browser Console Commands

Check contentMap size:
```javascript
// This won't work directly, but you can add a debug button to log it
console.log('ContentMap size:', contentMap.size);
```

Check seriesMap:
```javascript
// Add debug logging in SeriesPage to see this
console.log('SeriesMap:', Array.from(seriesMap.keys()));
```

## Troubleshooting

### If episode selector doesn't open:
1. Check console for "handlePlay called" log
2. Check if seriesKey is extracted correctly
3. Check if seriesMap has the series

### If episode doesn't play:
1. Check console for "Episode selected" log
2. Check if episode is found in contentMap
3. Check if video_urls exist in the ContentItem

### If wrong episode plays:
1. Check the claim_id being passed to handleSelectEpisode
2. Check if contentMap has the correct mapping
3. Check if EpisodeSelector is passing the right episode object
