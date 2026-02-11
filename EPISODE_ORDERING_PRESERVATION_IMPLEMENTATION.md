# Episode Ordering Preservation Across Reloads - Implementation Summary

## Overview

This document describes the implementation of episode ordering preservation across application reloads for the Kiyya desktop streaming application. The implementation ensures that playlist position order is maintained as the canonical episode ordering, regardless of episode numbers or title parsing.

## Critical Design Principle

**Playlist Position is Canonical**: When playlist data is available, the `position` field in `PlaylistItem` is the AUTHORITATIVE source for episode ordering. This means:

1. Episodes MUST be displayed in playlist position order (0, 1, 2, ...)
2. Episode numbers from `PlaylistItem.episode_number` are preserved but do NOT affect display order
3. Even if episode numbers suggest a different order (e.g., ep3, ep1, ep2), the playlist position determines the actual order
4. This ordering is preserved across application reloads and must never be reordered by episode number

This ensures content creators have full control over episode presentation, which is essential for series with non-linear storytelling, special episodes, or intentional ordering that differs from production order.

## Implementation Components

### 1. Database Layer (Rust)

**File**: `src-tauri/src/database.rs`

The database layer implements persistent storage of playlist data with position-based ordering:

#### Storage Function: `store_playlist`
- Stores playlist metadata in the `playlists` table
- Stores playlist items in the `playlist_items` table with their position
- Uses transactions to ensure atomicity

#### Retrieval Functions
- `get_playlist`: Retrieves a single playlist with items ordered by position
  ```sql
  SELECT claimId, position, episodeNumber, seasonNumber 
  FROM playlist_items 
  WHERE playlistId = ?1 
  ORDER BY position ASC
  ```

- `get_playlists_for_series`: Retrieves all playlists for a series with items ordered by position
  - Seasons are ordered by `seasonNumber`
  - Episodes within each season are ordered by `position`

#### Key Features
- **Position-based ordering**: All queries use `ORDER BY position ASC` to ensure consistent ordering
- **Transaction safety**: All write operations use transactions for data integrity
- **Foreign key constraints**: Ensures referential integrity between playlists and playlist_items

### 2. Series Logic Layer (TypeScript)

**File**: `src/lib/series.ts`

The series logic layer processes playlist data and maintains position-based ordering:

#### Core Function: `organizeEpisodesFromPlaylist`
```typescript
export function organizeEpisodesFromPlaylist(
  playlist: Playlist,
  contentMap: Map<string, ContentItem>
): Episode[]
```

**Key Implementation Details**:
1. Sorts playlist items by position: `[...playlist.items].sort((a, b) => a.position - b.position)`
2. Processes items in position order
3. Preserves episode numbers from playlist metadata
4. Falls back to title parsing only when episode numbers are missing
5. Never reorders by episode number

#### Supporting Functions
- `organizeSeriesFromPlaylists`: Organizes multiple playlists into series structure
- `mergeSeriesData`: Merges playlist-based and parsed series data, preferring playlist data
- `getSeriesForClaim`: Finds series information for a specific claim, using playlists first

### 3. Database Schema

**Tables**:

```sql
CREATE TABLE playlists (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    claimId TEXT NOT NULL,
    seasonNumber INTEGER,
    seriesKey TEXT,
    itemCount INTEGER DEFAULT 0,
    updatedAt INTEGER NOT NULL
);

CREATE TABLE playlist_items (
    playlistId TEXT NOT NULL,
    claimId TEXT NOT NULL,
    position INTEGER NOT NULL,
    episodeNumber INTEGER,
    seasonNumber INTEGER,
    title TEXT,
    PRIMARY KEY (playlistId, claimId),
    FOREIGN KEY (playlistId) REFERENCES playlists(id) ON DELETE CASCADE
);
```

**Indices**:
```sql
CREATE INDEX idx_playlist_items_position ON playlist_items(playlistId, position);
CREATE INDEX idx_playlists_seriesKey ON playlists(seriesKey);
CREATE INDEX idx_playlists_seasonNumber ON playlists(seasonNumber);
```

## Test Coverage

### Frontend Tests (TypeScript)

**File**: `tests/unit/series.ordering.test.ts`

Comprehensive test suite covering:

1. **Playlist Position as Canonical Order**
   - Preserves position order even when episode numbers suggest different order
   - Maintains position order when playlist items are provided out of order
   - Preserves position order across multiple seasons

2. **Simulated Reload Scenarios**
   - Maintains same order after simulated database reload
   - Maintains order consistency when merging playlist and parsed data across reloads

3. **Edge Cases**
   - Handles gaps in position numbers correctly
   - Handles single episode playlists
   - Handles large playlists with many episodes (50+ episodes)

4. **Documentation and Invariants**
   - Documents the critical invariant: playlist position is ALWAYS canonical
   - Never reorders episodes by episode number when playlist data exists

**Test Results**: 9 tests, all passing

### Backend Tests (Rust)

**File**: `src-tauri/src/database.rs`

Database-level tests covering:

1. **`test_playlist_episode_ordering_preservation`**
   - Tests that playlist position order is preserved across database operations
   - Verifies episodes with non-sequential episode numbers maintain position order
   - Simulates reload by retrieving playlist multiple times
   - Tests `get_playlists_for_series` maintains order

2. **`test_playlist_ordering_with_out_of_order_storage`**
   - Tests that even if items are stored in random order, they're retrieved in position order
   - Verifies database sorting works correctly

**Test Results**: All tests passing

### Existing Series Tests

**File**: `tests/unit/series.test.ts`

Existing comprehensive test suite (72 tests) covering:
- Episode title parsing
- Series key generation
- Content to episode conversion
- Playlist-based organization
- Parsed-based organization (fallback)
- Series merging
- Episode navigation (next/previous)
- Season ordering validation

**Test Results**: 72 tests, all passing

## Verification

### Total Test Coverage
- **Frontend**: 81 tests (9 new + 72 existing)
- **Backend**: 2 new database tests
- **All tests passing**: ✅

### Key Scenarios Verified

1. ✅ Episodes with non-sequential episode numbers maintain playlist position order
2. ✅ Order is preserved when playlist items are provided out of order
3. ✅ Order is maintained across simulated database reloads
4. ✅ Database retrieval always returns items in position order
5. ✅ Multiple seasons maintain independent position ordering
6. ✅ Large playlists (50+ episodes) maintain correct ordering
7. ✅ Merging playlist and parsed data preserves playlist ordering

## Usage Example

```typescript
// Playlist with intentional non-linear ordering
const playlist: Playlist = {
  id: 'playlist1',
  title: 'Non-Linear Series Season 1',
  claim_id: 'playlist_claim',
  season_number: 1,
  items: [
    { claim_id: 'ep5', position: 0, episode_number: 5 }, // Episode 5 first
    { claim_id: 'ep1', position: 1, episode_number: 1 }, // Episode 1 second
    { claim_id: 'ep3', position: 2, episode_number: 3 }, // Episode 3 third
    { claim_id: 'ep2', position: 3, episode_number: 2 }  // Episode 2 fourth
  ]
};

// Organize episodes - will maintain position order
const episodes = organizeEpisodesFromPlaylist(playlist, contentMap);

// Result: episodes are in order [ep5, ep1, ep3, ep2]
// NOT sorted by episode number [ep1, ep2, ep3, ep5]
```

## Benefits

1. **Content Creator Control**: Allows content creators to present episodes in any order they choose
2. **Non-Linear Storytelling**: Supports series with flashbacks, flash-forwards, or non-chronological narratives
3. **Special Episodes**: Allows placing special episodes, recaps, or bonus content at specific positions
4. **Consistency**: Ensures the same episode order is displayed every time the application loads
5. **Data Integrity**: Database-level ordering ensures consistency across all retrieval methods

## Implementation Status

✅ **COMPLETE**

All components are implemented and tested:
- Database storage and retrieval with position-based ordering
- Frontend series organization logic
- Comprehensive test coverage (frontend and backend)
- Documentation and code comments

The implementation successfully preserves episode ordering across application reloads, maintaining playlist position as the canonical source of truth for episode order.
