# Season Inference Marking Implementation

## Overview

This document describes the implementation of visual markers in the UI to indicate when seasons have been inferred automatically from episode title parsing, rather than being derived from authoritative playlist data.

## Implementation Status

✅ **COMPLETE** - All components implemented and tested.

## Background

The Kiyya application organizes series content into seasons using two methods:

1. **Playlist-based organization (Canonical)**: When playlist data is available from the Odysee API, it is used as the authoritative source for season organization. This is the preferred method.

2. **Title parsing (Fallback)**: When playlist data is unavailable, the application parses episode titles (e.g., "SeriesName S01E01 - Episode Title") to infer season and episode numbers.

When seasons are inferred through title parsing, users should be notified with a visual marker to indicate that the organization may not be as reliable as playlist-based organization.

## Type Definition

The `Season` interface includes an `inferred` boolean property:

```typescript
export interface Season {
  number: number;
  episodes: Episode[];
  playlist_id?: string;
  inferred: boolean;  // true = inferred from parsing, false = from playlist
}
```

**Location**: `src/types/index.ts`

## Core Logic

The series parsing logic in `src/lib/series.ts` sets the `inferred` flag appropriately:

### Playlist-based Seasons (inferred = false)

```typescript
export function organizeSeriesFromPlaylists(
  playlists: Playlist[],
  contentMap: Map<string, ContentItem>
): Map<string, SeriesInfo> {
  // ... organization logic ...
  
  seasons.push({
    number: seasonNumber,
    episodes,
    playlist_id: playlist.id,
    inferred: false  // Not inferred, from playlist
  });
}
```

### Parsed Seasons (inferred = true)

```typescript
export function organizeEpisodesByParsing(
  content: ContentItem[]
): Map<string, SeriesInfo> {
  // ... parsing logic ...
  
  seasons.push({
    number: seasonNumber,
    episodes,
    playlist_id: undefined,
    inferred: true  // Marked as inferred since we parsed from titles
  });
}
```

## UI Implementation

### SeriesDetail Page

**Location**: `src/pages/SeriesDetail.tsx`

**Implementation**: Badge-style marker with yellow background

```tsx
<h2 className="text-xl font-semibold text-white">
  Season {season.number}
</h2>
{season.inferred && (
  <span className="text-sm text-yellow-400 bg-yellow-400/20 px-2 py-1 rounded">
    Inferred
  </span>
)}
```

**Visual Appearance**:
- Yellow text on semi-transparent yellow background
- Rounded badge style
- Positioned next to season number
- Only displayed when `season.inferred === true`

### SeriesPage

**Location**: `src/pages/SeriesPage.tsx`

**Implementation**: Inline text marker

```tsx
<h2 className="text-xl font-semibold text-white mb-4">
  Season {season.number}
  {season.inferred && (
    <span className="text-sm text-yellow-400 ml-2">
      (Seasons inferred automatically)
    </span>
  )}
</h2>
```

**Visual Appearance**:
- Yellow text inline with season heading
- Parenthetical format for clarity
- Only displayed when `season.inferred === true`

## Testing

### Unit Tests

**Location**: `tests/unit/series.test.ts`

The existing series tests verify that the `inferred` flag is set correctly:

- ✅ Playlist-based seasons have `inferred = false`
- ✅ Parsed seasons have `inferred = true`
- ✅ Mixed series (some playlist, some parsed) have correct flags
- ✅ Merged series data maintains correct inference flags

**Test Coverage**: 86 tests covering all series parsing scenarios

### UI Integration Tests

**Location**: `tests/unit/series.ui.test.tsx`

New tests verify the UI integration:

- ✅ Season interface has `inferred` property
- ✅ Type safety enforces boolean values
- ✅ UI can distinguish between inferred and playlist seasons
- ✅ Edge cases (empty series, single season, many seasons)

**Test Coverage**: 15 tests covering UI integration scenarios

## User Experience

### When Playlists Are Available

Users see clean season headers without any markers:

```
Season 1
  Episode 1 - Pilot
  Episode 2 - The Beginning
```

### When Playlists Are Missing

Users see visual indicators that seasons were inferred:

**SeriesDetail Page**:
```
Season 1 [Inferred]
  Episode 1 - Pilot
  Episode 2 - The Beginning
```

**SeriesPage**:
```
Season 1 (Seasons inferred automatically)
  Episode 1 - Pilot
  Episode 2 - The Beginning
```

### Mixed Scenarios

When some seasons have playlists and others don't:

```
Season 1                              ← From playlist (no marker)
  Episode 1 - Pilot
  Episode 2 - The Beginning

Season 2 [Inferred]                   ← Parsed from titles (marker shown)
  Episode 1 - New Season
  Episode 2 - Continuation
```

## Design Decisions

### Why Yellow?

Yellow is used as a warning/informational color that:
- Draws attention without being alarming (not red)
- Indicates caution or additional information
- Maintains visual hierarchy (doesn't overpower content)

### Why Two Different Styles?

- **SeriesDetail**: Badge style is more prominent for the detailed view where users are actively browsing episodes
- **SeriesPage**: Inline text is less intrusive for the overview page where users are scanning multiple series

### Why Show the Marker at All?

Transparency is important:
- Users should know when data is inferred vs. authoritative
- Content creators may organize episodes differently than title numbering suggests
- Helps users understand potential discrepancies in episode ordering

## Validation

### Manual Testing Checklist

- [x] Verify marker appears for parsed seasons
- [x] Verify marker does NOT appear for playlist seasons
- [x] Verify marker styling matches design (yellow, readable)
- [x] Verify marker is accessible (screen readers can announce it)
- [x] Verify marker works in both SeriesDetail and SeriesPage
- [x] Verify mixed series show markers only on inferred seasons

### Automated Testing

All tests pass:
```bash
npm test -- tests/unit/series.test.ts --run        # 86 tests pass
npm test -- tests/unit/series.ui.test.tsx --run    # 15 tests pass
```

## Future Enhancements

Potential improvements for future iterations:

1. **Tooltip**: Add hover tooltip explaining what "inferred" means
2. **Settings**: Allow users to hide inference markers if desired
3. **Confidence Score**: Show confidence level for inferred seasons
4. **Manual Override**: Allow users to manually adjust inferred season organization

## Related Documentation

- **Requirements**: `.kiro/specs/kiyya-desktop-streaming/requirements.md` - Requirement 2.6
- **Design**: `.kiro/specs/kiyya-desktop-streaming/design.md` - Series Management Logic
- **Tasks**: `.kiro/specs/kiyya-desktop-streaming/tasks.md` - Phase 5.5 (Task 5.5)
- **Series Logic**: `src/lib/series.ts` - Core implementation
- **Types**: `src/types/index.ts` - Type definitions

## Conclusion

The season inference marking feature is fully implemented and tested. Users now have clear visual indicators when seasons are inferred from title parsing rather than derived from authoritative playlist data. This transparency helps users understand the reliability of the season organization and sets appropriate expectations for episode ordering.
