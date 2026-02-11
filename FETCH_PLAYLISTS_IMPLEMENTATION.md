# Fetch Playlists Implementation

## Overview
The `fetch_playlists` command has been successfully implemented as part of Phase 3.1 (Content Discovery Commands) of the Kiyya Desktop Streaming Application.

## Implementation Details

### Backend (Rust)

#### Command Implementation
**Location**: `src-tauri/src/commands.rs`

```rust
#[command]
pub async fn fetch_playlists(
    state: State<'_, AppState>,
) -> Result<Vec<Playlist>> {
    info!("Fetching playlists");

    let mut gateway = state.gateway.lock().await;
    let channel_id = std::env::var("VITE_CHANNEL_ID")
        .unwrap_or_else(|_| "@YourChannelName".to_string());
    
    let request = OdyseeRequest {
        method: "playlist_search".to_string(),
        params: json!({
            "channel": channel_id,
            "page_size": 50
        }),
    };

    let response = gateway.fetch_with_failover(request).await?;
    let playlists = parse_playlist_search_response(response)?;
    
    info!("Fetched {} playlists", playlists.len());
    Ok(playlists)
}
```

#### Parsing Functions

**`parse_playlist_search_response`**: Parses the Odysee API response and extracts playlist items
- Handles missing or malformed data gracefully
- Logs warnings for items that fail to parse
- Returns only successfully parsed playlists

**`parse_playlist_item`**: Extracts playlist metadata from individual items
- Defensive parsing with validation
- Extracts season numbers from titles (e.g., "SeriesName – Season 1")
- Generates series keys for organization
- Handles missing or empty fields gracefully

**Helper Functions**:
- `extract_season_number_from_title`: Parses season numbers using regex
- `extract_series_key_from_title`: Generates normalized series keys

### Frontend (TypeScript)

#### API Wrapper
**Location**: `src/lib/api.ts`

```typescript
export const fetchPlaylists = async (): Promise<Playlist[]> => {
  return await invoke('fetch_playlists');
};
```

### Data Models

#### Playlist Model
**Location**: `src-tauri/src/models.rs`

```rust
pub struct Playlist {
    pub id: String,
    pub title: String,
    pub claim_id: String,
    pub items: Vec<PlaylistItem>,
    pub season_number: Option<u32>,
    pub series_key: Option<String>,
}
```

## Features

### 1. Gateway Failover Support
- Uses the existing gateway failover system
- Automatically retries with backup gateways on failure
- Logs all gateway attempts for diagnostics

### 2. Defensive Parsing
- Handles missing or malformed API responses
- Validates required fields (claim_id, title)
- Logs warnings for problematic items but continues processing
- Returns empty array if no valid playlists found

### 3. Series Organization
- Automatically extracts season numbers from playlist titles
- Generates series keys for grouping related playlists
- Supports format: "SeriesName – Season N" or "SeriesName - Season N"

### 4. Error Handling
- Returns structured errors for API failures
- Provides clear error messages for debugging
- Logs raw JSON data when parsing fails

## Testing

### Unit Tests
**Location**: `src-tauri/src/commands.rs` (tests module)

All tests passing (8 tests):
- ✅ `test_parse_playlist_item` - Basic playlist parsing
- ✅ `test_parse_playlist_item_without_season` - Playlists without season info
- ✅ `test_parse_playlist_item_with_empty_claim_id` - Validation of required fields
- ✅ `test_parse_playlist_item_with_empty_title` - Handling empty titles
- ✅ `test_parse_playlist_search_response` - Full response parsing
- ✅ `test_parse_playlist_search_response_empty` - Empty results
- ✅ `test_parse_playlist_search_response_no_data` - Missing data handling
- ✅ `test_parse_playlist_search_response_with_malformed_items` - Partial success scenarios

### Test Command
```bash
cd src-tauri
cargo test parse_playlist -- --nocapture
```

## Integration

### Tauri Command Registration
**Location**: `src-tauri/src/main.rs`

The command is registered in the Tauri invoke handler:
```rust
.invoke_handler(tauri::generate_handler![
    commands::fetch_channel_claims,
    commands::fetch_playlists,  // ✅ Registered
    commands::resolve_claim,
    // ... other commands
])
```

### Frontend Type Definitions
**Location**: `src/types/index.ts`

TypeScript interfaces are defined for type-safe frontend usage:
```typescript
export interface Playlist {
  id: string;
  title: string;
  claim_id: string;
  items: PlaylistItem[];
  season_number?: number;
  series_key?: string;
}
```

## Usage Example

### Frontend Usage
```typescript
import { fetchPlaylists } from '@/lib/api';

// Fetch all playlists for the configured channel
const playlists = await fetchPlaylists();

// Filter by series
const breakingBadSeasons = playlists.filter(
  p => p.series_key === 'breaking_bad'
);

// Sort by season number
const sortedSeasons = breakingBadSeasons.sort(
  (a, b) => (a.season_number || 0) - (b.season_number || 0)
);
```

## Configuration

### Environment Variables
- `VITE_CHANNEL_ID`: The Odysee channel ID to fetch playlists from
  - Default: "@YourChannelName"
  - Should be set in `.env` file

## Logging

The implementation includes comprehensive logging:
- Info logs for fetch operations and results
- Warning logs for parsing failures with raw JSON data
- Error logs for API failures

Logs can be found in the application's log directory.

## Next Steps

The following related tasks are pending:
- [ ] Add resolve_claim command with metadata parsing
- [ ] Handle rate limiting and timeout scenarios
- [ ] Implement playlist item fetching (individual episodes)
- [ ] Add caching for playlist data

## Compliance

This implementation follows all requirements from:
- **Requirements Document**: Requirement 2 (Series and Playlist Management)
- **Design Document**: Series and Playlist Models, Tauri Command Interface
- **Tasks Document**: Phase 3.1 - Content Discovery Commands

## Status

✅ **COMPLETED** - All tests passing, command registered, and frontend integration complete.
