# Force Refresh Implementation

## Overview
This document describes the implementation of the force refresh capability for the Kiyya desktop streaming application's cache management system.

## What is Force Refresh?
Force refresh is a feature that allows users to bypass the local cache and fetch fresh content directly from the Odysee API. This is useful when:
- Users want to see the most up-to-date content immediately
- Content has been updated on the server and users need to refresh their local cache
- Troubleshooting cache-related issues

## Implementation Details

### Backend (Rust)

**File**: `src-tauri/src/commands.rs`

Added a new optional parameter `force_refresh` to the `fetch_channel_claims` command:

```rust
#[command]
pub async fn fetch_channel_claims(
    any_tags: Option<Vec<String>>,
    text: Option<String>,
    limit: Option<u32>,
    page: Option<u32>,
    force_refresh: Option<bool>,  // NEW PARAMETER
    state: State<'_, AppState>,
) -> Result<Vec<ContentItem>>
```

**Behavior**:
- When `force_refresh` is `None` or `Some(false)`: Normal cache behavior (check cache first)
- When `force_refresh` is `Some(true)`: Skip cache check and always fetch from API
- Fresh data is always stored in cache after fetching, regardless of force_refresh value

### Frontend (TypeScript)

**File**: `src/lib/api.ts`

Updated the TypeScript API wrapper to accept the force_refresh parameter:

```typescript
export const fetchChannelClaims = async (params: {
  any_tags?: string[];
  text?: string;
  limit?: number;
  page?: number;
  force_refresh?: boolean;  // NEW PARAMETER
}): Promise<ContentItem[]>
```

**Convenience Functions Updated**:
- `fetchByTag(tag, limit, forceRefresh)` - Added forceRefresh parameter
- `fetchByTags(tags, limit, forceRefresh)` - Added forceRefresh parameter
- `fetchCategoryContent(baseTag, filterTag, limit, forceRefresh)` - Added forceRefresh parameter

## Usage Examples

### From Frontend Code

```typescript
// Normal fetch (uses cache)
const content = await fetchChannelClaims({ any_tags: ['movie'] });

// Force refresh (bypasses cache)
const freshContent = await fetchChannelClaims({ 
  any_tags: ['movie'], 
  force_refresh: true 
});

// Using convenience functions
const movies = await fetchByTag('movie', 50, true); // Force refresh
const categoryContent = await fetchCategoryContent('series', 'action_series', 50, true);
```

### From UI Components

```typescript
// Add a refresh button to any page
const handleRefresh = async () => {
  setLoading(true);
  const freshContent = await fetchCategoryContent(
    baseTag, 
    filterTag, 
    50, 
    true  // Force refresh
  );
  setContent(freshContent);
  setLoading(false);
};
```

## Testing

**File**: `src-tauri/src/force_refresh_test.rs`

Created comprehensive tests to verify:
1. Force refresh parameter exists and is properly typed
2. Default behavior (backward compatibility)
3. Explicit true/false values work correctly
4. Documentation of expected behavior

All tests pass successfully.

## Backward Compatibility

The implementation maintains full backward compatibility:
- Existing code without the `force_refresh` parameter continues to work
- Default behavior is unchanged (cache is used when parameter is omitted)
- No breaking changes to existing API contracts

## Cache Behavior

Important notes about cache behavior with force refresh:

1. **Cache is still updated**: Even when using force_refresh, the newly fetched data is stored in the cache
2. **TTL applies**: The standard 30-minute TTL applies to force-refreshed data
3. **Subsequent requests**: After a force refresh, subsequent requests (without force_refresh) will use the newly cached data
4. **No cache invalidation**: Force refresh doesn't invalidate existing cache entries; it simply bypasses the cache check

## Related Files

- `src-tauri/src/commands.rs` - Backend command implementation
- `src/lib/api.ts` - Frontend API wrapper
- `src-tauri/src/force_refresh_test.rs` - Test suite
- `.kiro/specs/kiyya-desktop-streaming/tasks.md` - Task tracking

## Future Enhancements

Potential improvements for future iterations:
1. Add UI indicators when force refresh is in progress
2. Implement automatic force refresh on certain events (e.g., app resume)
3. Add user preference for automatic refresh intervals
4. Provide analytics on cache hit/miss rates with force refresh usage
