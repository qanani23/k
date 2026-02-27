# Series Episode Selector Fix - Complete Implementation

## Problem Statement

The series implementation had two critical issues:

1. **Different behavior between Home and Series pages**: 
   - Home page: Series played directly (using representative episode)
   - Series page: Tried to resolve episodes, which failed

2. **Episode resolution failures**: 
   - When selecting an episode from the episode selector, `resolveClaim()` was called
   - This often failed with "All 4 attempts failed" errors
   - The data we needed was already available, but we were throwing it away

## Root Cause

The `Episode` type only contains metadata (claim_id, title, thumbnail, duration) but NOT video_urls. When an episode was selected, the code tried to resolve it from the backend, which:
- Added unnecessary network requests
- Often failed due to gateway issues
- Wasted data we already had

## Solution Implemented

### 1. Modified `useSeriesGrouped` Hook

**File**: `src/hooks/useContent.ts`

Added `contentMap` to the return value:

```typescript
function useSeriesGrouped(filterTag?: string) {
  const tags = filterTag ? ['series', filterTag] : ['series'];
  const { content, loading, error, refetch, loadMore, hasMore } = useContent({ tags });
  const [groupedContent, setGroupedContent] = useState<ContentItem[]>([]);
  const [seriesMap, setSeriesMap] = useState<Map<string, any>>(new Map());
  const [contentMap, setContentMap] = useState<Map<string, ContentItem>>(new Map());

  useEffect(() => {
    // Build a map of claim_id -> ContentItem for quick lookup
    const newContentMap = new Map<string, ContentItem>();
    content.forEach(item => {
      newContentMap.set(item.claim_id, item);
    });
    setContentMap(newContentMap);
    
    // ... rest of the logic
  }, [content]);

  return {
    content: groupedContent,
    seriesMap,
    contentMap,  // NEW: Expose content map
    loading,
    error,
    refetch,
    loadMore,
    hasMore,
  };
}
```

**Benefits**:
- All episode ContentItems (with video_urls) are now accessible via claim_id
- No need to resolve episodes from backend
- Instant episode playback

### 2. Updated SeriesPage

**File**: `src/pages/SeriesPage.tsx`

Changed `handleSelectEpisode` to use contentMap instead of resolving:

```typescript
const handleSelectEpisode = async (episode: Episode) => {
  console.log("🎬 [DEBUG] Episode selected", episode.title, episode.claim_id);
  setIsEpisodeSelectorOpen(false);
  
  // Look up the episode in our content map instead of resolving
  const episodeContent = contentMap.get(episode.claim_id);
  
  if (episodeContent) {
    console.log("✅ [DEBUG] Found episode in content map", episodeContent.title);
    setSelectedEpisode(episodeContent);
    setIsPlayerOpen(true);
  } else {
    console.error('❌ [DEBUG] Episode not found in content map:', episode.claim_id);
    // Fallback: try to resolve if not in map
    try {
      console.log("🔄 [DEBUG] Attempting to resolve episode...");
      const resolvedContent = await resolveClaim(episode.claim_id);
      setSelectedEpisode(resolvedContent);
      setIsPlayerOpen(true);
    } catch (err) {
      console.error('Failed to load episode:', err);
    }
  }
};
```

**Benefits**:
- Instant episode lookup from map
- Fallback to resolve only if episode not in map
- Consistent behavior with other pages

### 3. Updated Home Page

**File**: `src/pages/Home.tsx`

Added episode selector support for series in Home page:

```typescript
// Added imports
import EpisodeSelector from '../components/EpisodeSelector';
import { ContentItem, Episode } from '../types';

// Added state
const [isEpisodeSelectorOpen, setIsEpisodeSelectorOpen] = useState(false);
const [selectedSeriesKey, setSelectedSeriesKey] = useState<string | null>(null);

// Get contentMap from useSeriesGrouped
const { content: series, seriesMap, contentMap: seriesContentMap, ... } = useSeriesGrouped();

// Updated handlePlayContent to detect series and open episode selector
const handlePlayContent = async (content: ContentItem) => {
  if (content.tags.includes('series') || content.tags.includes('sitcom')) {
    const seriesKey = extractSeriesKey(content);
    if (seriesKey && seriesMap.has(seriesKey)) {
      setSelectedSeriesKey(seriesKey);
      setIsEpisodeSelectorOpen(true);
    } else {
      // Fallback: play directly
      setSelectedContent(content);
      setIsPlayerOpen(true);
    }
  } else {
    // For movies, play directly
    setSelectedContent(content);
    setIsPlayerOpen(true);
  }
};

// Added handleSelectEpisode
const handleSelectEpisode = (episode: Episode) => {
  setIsEpisodeSelectorOpen(false);
  const episodeContent = seriesContentMap.get(episode.claim_id);
  if (episodeContent) {
    setSelectedContent(episodeContent);
    setIsPlayerOpen(true);
  }
};
```

**Benefits**:
- Consistent series playback across all pages
- Episode selector works in Home page
- Users can choose which episode to watch

### 4. Fixed extractSeriesKey Helper

Updated to use same logic as series utilities:

```typescript
function extractSeriesKey(content: ContentItem): string | null {
  const titleMatch = content.title.match(/^(.+?)\s+S\d+E\d+/i);
  if (titleMatch) {
    const seriesName = titleMatch[1].trim();
    return seriesName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .join('-');
  }
  return null;
}
```

## How It Works Now

### User Flow - Series Page

1. User navigates to `/series`
2. `useSeriesGrouped()` fetches all series episodes
3. Episodes are grouped into series with seasons
4. `contentMap` stores all episodes by claim_id
5. User clicks "Play" on a series → Episode selector opens
6. User selects an episode → Episode is looked up in contentMap
7. PlayerModal opens with full ContentItem (including video_urls)
8. Video plays immediately

### User Flow - Home Page

1. User is on home page
2. Series content is displayed in carousels
3. User clicks "Play" on a series
4. Series key is extracted from title
5. Episode selector opens with all seasons/episodes
6. User selects an episode → Episode is looked up in seriesContentMap
7. PlayerModal opens and video plays

## Benefits

1. **No unnecessary network requests**: Episodes are already loaded
2. **Instant playback**: No waiting for resolve to complete
3. **Consistent behavior**: Same experience across all pages
4. **Robust error handling**: Fallback to resolve if episode not in map
5. **Better UX**: Episode selector works everywhere

## Testing Checklist

- [ ] Series page: Click Play → Episode selector opens
- [ ] Series page: Select episode → Video plays immediately
- [ ] Series page: Select different episodes → Correct video plays
- [ ] Home page: Click Play on series → Episode selector opens
- [ ] Home page: Select episode → Video plays immediately
- [ ] Movies page: Click Play → Video plays directly (no episode selector)
- [ ] Verify no "All 4 attempts failed" errors in console
- [ ] Verify no unnecessary resolveClaim calls

## Files Modified

1. `src/hooks/useContent.ts` - Added contentMap to useSeriesGrouped
2. `src/pages/SeriesPage.tsx` - Use contentMap instead of resolving
3. `src/pages/Home.tsx` - Added episode selector support
4. `src/components/EpisodeSelector.tsx` - Already implemented (no changes)

## Next Steps

1. Test the implementation thoroughly
2. Consider adding "Next Episode" button in PlayerModal
3. Consider adding "Continue Watching" feature (remember last episode)
4. Consider adding episode progress tracking
