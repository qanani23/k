# Series Grouping Implementation

## Overview

This document describes the implementation of the series grouping feature that ensures series content is NEVER displayed as flat episode lists. All series episodes are automatically organized into proper season structures before being displayed to users.

## Problem Statement

When fetching series content from the Odysee API, individual episodes are returned as separate `ContentItem` objects. Without proper grouping, these episodes would appear as a flat list in the UI, making it difficult for users to understand the series structure and navigate between seasons.

## Solution

The solution implements automatic series grouping at multiple levels:

1. **Detection**: Identify which content items are series episodes
2. **Grouping**: Organize episodes by series name and season
3. **Display**: Present series as unified entities with season structure
4. **Navigation**: Handle series navigation properly

## Implementation Details

### 1. Series Episode Detection

**Function**: `isSeriesEpisode(content: ContentItem): boolean`

**Location**: `src/lib/series.ts`

**Purpose**: Determines if a content item is a series episode

**Detection Logic**:
- Checks for `series` or `sitcom` tags
- Parses title for episode format (S01E01, 1x01, etc.)
- Returns `true` if either condition is met

**Example**:
```typescript
const episode = {
  claim_id: 'abc123',
  title: 'Breaking Bad S01E01 - Pilot',
  tags: ['series'],
  // ... other fields
};

isSeriesEpisode(episode); // Returns: true
```

### 2. Content Grouping

**Function**: `groupSeriesContent(content: ContentItem[], playlists?: Playlist[])`

**Location**: `src/lib/series.ts`

**Purpose**: Separates series episodes from other content and organizes them into `SeriesInfo` structures

**Process**:
1. Iterate through all content items
2. Separate series episodes from non-series content (movies, etc.)
3. Group episodes by series name using:
   - Playlist data (canonical, if available)
   - Title parsing (fallback)
4. Organize episodes into seasons
5. Return both grouped series and non-series content

**Return Value**:
```typescript
{
  series: Map<string, SeriesInfo>,  // Grouped series with seasons
  nonSeriesContent: ContentItem[]    // Movies and other non-series content
}
```

**Example**:
```typescript
const content = [
  { claim_id: 'movie1', title: 'Movie Title', tags: ['movie'], ... },
  { claim_id: 'ep1', title: 'Series S01E01', tags: ['series'], ... },
  { claim_id: 'ep2', title: 'Series S01E02', tags: ['series'], ... }
];

const { series, nonSeriesContent } = groupSeriesContent(content);

// series: Map with 1 entry containing SeriesInfo with 2 episodes in season 1
// nonSeriesContent: Array with 1 movie
```

### 3. Series Representation

**Function**: `seriesToContentItem(series: SeriesInfo, representativeContent: ContentItem)`

**Location**: `src/lib/series.ts`

**Purpose**: Converts a `SeriesInfo` structure into a display-friendly `ContentItem` that represents the entire series

**Process**:
1. Takes the first episode as a base
2. Replaces title with series name
3. Sets description to show season/episode count
4. Adds `__series_container__` tag to mark it as a series container

**Example**:
```typescript
const seriesInfo = {
  series_key: 'breaking-bad',
  title: 'Breaking Bad',
  seasons: [{ number: 1, episodes: [...], inferred: false }],
  total_episodes: 13
};

const representative = { /* first episode content */ };

const seriesItem = seriesToContentItem(seriesInfo, representative);

// Result:
// {
//   ...representative,
//   title: 'Breaking Bad',
//   description: '1 season • 13 episodes',
//   tags: [...representative.tags, '__series_container__']
// }
```

### 4. Custom Hook for Grouped Series

**Hook**: `useSeriesGrouped(filterTag?: string)`

**Location**: `src/hooks/useContent.ts`

**Purpose**: Provides a React hook that automatically groups series content

**Features**:
- Fetches series content using existing `useContent` hook
- Automatically groups episodes into series structures
- Returns both grouped content and series map
- Maintains loading and error states

**Usage**:
```typescript
function SeriesPage() {
  const { content, seriesMap, loading, error } = useSeriesGrouped();
  
  // content: Array of ContentItem representing series (not individual episodes)
  // seriesMap: Map of series_key to SeriesInfo for detailed navigation
  
  return (
    <div>
      {content.map(series => (
        <SeriesCard key={series.claim_id} series={series} />
      ))}
    </div>
  );
}
```

### 5. Navigation Handling

**Location**: `src/pages/Home.tsx`

**Purpose**: Properly handle navigation when users click on series content

**Implementation**:
```typescript
const handlePlayContent = (content: ContentItem) => {
  // Check if this is a series container (grouped series)
  if (content.tags.includes('__series_container__')) {
    // Extract series key from the series map
    const seriesKey = Array.from(seriesMap.keys()).find(key => {
      const seriesInfo = seriesMap.get(key);
      return seriesInfo?.title === content.title;
    });
    
    if (seriesKey) {
      navigate(`/series/${seriesKey}`);
      return;
    }
  }
  
  // Handle other content types...
};
```

## Data Flow

```
1. API Fetch
   ↓
   [ContentItem, ContentItem, ContentItem, ...]
   (Individual episodes mixed with movies)

2. Detection & Grouping
   ↓
   groupSeriesContent()
   ↓
   {
     series: Map<string, SeriesInfo>,
     nonSeriesContent: ContentItem[]
   }

3. Display Conversion
   ↓
   seriesToContentItem() for each series
   ↓
   [SeriesContentItem, SeriesContentItem, MovieContentItem, ...]
   (Series as unified entities)

4. UI Rendering
   ↓
   RowCarousel displays series cards (not individual episodes)
   ↓
   User clicks series → Navigate to SeriesDetail page
   ↓
   SeriesDetail shows seasons and episodes in structured format
```

## Key Design Decisions

### 1. Automatic Grouping
Series grouping happens automatically in the `useSeriesGrouped` hook, ensuring developers don't need to manually group content in every component.

### 2. Special Marker Tag
The `__series_container__` tag is added to series content items to distinguish them from individual episodes. This allows navigation logic to handle them appropriately.

### 3. Representative Episode
The first episode of the first season is used as the representative for the entire series. This provides thumbnail, tags, and other metadata for display.

### 4. Playlist Priority
When playlists are available, they are used as the canonical source for episode ordering. Title parsing is only used as a fallback.

### 5. Separation of Concerns
- `series.ts`: Core grouping logic (pure functions)
- `useContent.ts`: React integration (hooks)
- `Home.tsx`: UI and navigation (components)

## Testing

### Unit Tests

**Location**: `tests/unit/series.test.ts`

**Coverage**:
- `isSeriesEpisode`: Detection of series episodes
- `groupSeriesContent`: Grouping logic
- `getSeriesRepresentative`: Representative selection
- `seriesToContentItem`: Display conversion
- Integration tests: End-to-end grouping scenarios

**Key Test Cases**:
1. Series episodes are correctly identified by tags
2. Series episodes are correctly identified by title format
3. Movies are not identified as series episodes
4. Episodes are grouped by series name
5. Episodes are organized into seasons
6. Non-series content is separated correctly
7. Mixed content (movies + series) is handled properly
8. Empty series are handled gracefully

### Running Tests

```bash
npm test -- tests/unit/series.test.ts --run
```

**Expected Result**: All 86 tests pass

## Usage Examples

### Example 1: Home Page with Grouped Series

```typescript
import { useSeriesGrouped } from '../hooks/useContent';

function Home() {
  const { content: series, seriesMap, loading } = useSeriesGrouped();
  
  return (
    <RowCarousel
      title="Series"
      content={series}  // Series as unified entities, not flat episodes
      loading={loading}
      onPlayContent={handlePlayContent}
    />
  );
}
```

### Example 2: Filtered Series

```typescript
function ActionSeriesPage() {
  const { content, loading } = useSeriesGrouped('action_series');
  
  // content contains only action series, grouped by series name
  return <SeriesGrid series={content} />;
}
```

### Example 3: Manual Grouping

```typescript
import { groupSeriesContent } from '../lib/series';

function CustomComponent() {
  const [content, setContent] = useState<ContentItem[]>([]);
  
  useEffect(() => {
    fetchContent().then(items => {
      const { series, nonSeriesContent } = groupSeriesContent(items);
      
      // Process grouped series
      const seriesArray = Array.from(series.values());
      console.log(`Found ${seriesArray.length} series`);
      
      // Process non-series content
      console.log(`Found ${nonSeriesContent.length} movies`);
    });
  }, []);
}
```

## Benefits

### For Users
1. **Clear Organization**: Series are presented as unified entities with clear season structure
2. **Easy Navigation**: Users can browse series without seeing individual episodes cluttering the interface
3. **Better Discovery**: Series thumbnails and descriptions help users find content
4. **Consistent Experience**: All series content follows the same organizational pattern

### For Developers
1. **Automatic Handling**: Grouping happens automatically via hooks
2. **Type Safety**: Full TypeScript support with proper types
3. **Testable**: Pure functions make testing straightforward
4. **Maintainable**: Clear separation of concerns
5. **Extensible**: Easy to add new grouping strategies or display formats

## Future Enhancements

### Potential Improvements
1. **Caching**: Cache grouped series to avoid re-grouping on every render
2. **Sorting**: Add sorting options for series (alphabetical, newest, etc.)
3. **Filtering**: Filter series by genre, year, or other metadata
4. **Search**: Integrate series grouping with search functionality
5. **Playlist Integration**: Enhance playlist-based grouping with more metadata

### Performance Optimizations
1. **Lazy Grouping**: Only group series when needed
2. **Memoization**: Memoize grouping results to avoid recalculation
3. **Virtual Scrolling**: For large series collections
4. **Progressive Loading**: Load and group series incrementally

## Troubleshooting

### Issue: Series appearing as flat episodes

**Cause**: Using `useSeries()` instead of `useSeriesGrouped()`

**Solution**: Replace `useSeries()` with `useSeriesGrouped()` in components

```typescript
// Before (flat episodes)
const { content } = useSeries();

// After (grouped series)
const { content, seriesMap } = useSeriesGrouped();
```

### Issue: Navigation not working for series

**Cause**: Missing `__series_container__` tag check in navigation logic

**Solution**: Add check for series container tag

```typescript
if (content.tags.includes('__series_container__')) {
  // Handle series navigation
  const seriesKey = findSeriesKey(content, seriesMap);
  navigate(`/series/${seriesKey}`);
}
```

### Issue: Series not grouping correctly

**Cause**: Episode titles don't match expected format

**Solution**: Check episode title format and update parsing regex if needed

```typescript
// Supported formats:
// - "SeriesName S01E01 - Episode Title"
// - "SeriesName 1x01 - Episode Title"
// - "SeriesName Season 1 Episode 1 - Episode Title"
```

## Conclusion

The series grouping implementation ensures that series content is NEVER displayed as flat episode lists. By automatically detecting, grouping, and organizing series episodes, the system provides a clean and intuitive user experience while maintaining code quality and testability.

All series content is now presented with proper season structure, making it easy for users to discover and navigate through series content.
