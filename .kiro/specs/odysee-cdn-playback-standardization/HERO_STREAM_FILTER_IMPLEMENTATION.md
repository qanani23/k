# Hero Stream Filter Implementation

## Task 11.1: Validate hero_trailer search enforces stream-only filter

### Requirements Addressed
- **Requirement 7.1**: Hero query SHALL filter by `tag = hero_trailer` AND `value_type = stream`
- **Requirement 7.2**: Hero section SHALL display the first valid stream claim
- **Requirement 7.3**: Hero section SHALL NOT fail if a non-stream claim is tagged `hero_trailer`

### Implementation Summary

This implementation ensures that when fetching hero_trailer content, the system enforces stream-only filtering at the API level, preventing non-stream claims (channels, reposts, collections) from being processed by the backend.

### Changes Made

#### 1. Backend: `src-tauri/src/commands.rs`
- **Already had** `stream_types` parameter in `fetch_channel_claims` function
- **Already included** `stream_types` in the API request parameters
- **Fixed**: Removed duplicate `#[command]` attribute that was causing compilation errors

#### 2. Frontend API: `src/lib/api.ts`

**Updated `fetchChannelClaims` function signature:**
```typescript
fetchChannelClaims = async (params: {
  any_tags?: string[];
  text?: string;
  limit?: number;
  page?: number;
  force_refresh?: boolean;
  stream_types?: string[];  // NEW: Added stream_types parameter
}): Promise<ContentItem[]>
```

**Updated `fetchByTags` function:**
```typescript
fetchByTags = async (tags: string[], limit: number = 50, forceRefresh: boolean = false): Promise<ContentItem[]> => {
  // CRITICAL: Enforce stream-only filter for hero_trailer to prevent non-stream claims
  // Requirement 7.1, 7.2, 7.3: Hero query must filter by tag=hero_trailer AND value_type=stream
  const stream_types = tags.includes('hero_trailer') ? ['stream'] : undefined;
  
  const response = await fetchChannelClaims({ 
    any_tags: tags, 
    limit, 
    force_refresh: forceRefresh,
    stream_types  // Pass stream_types to backend
  });
  
  return response;
}
```

**Key Logic:**
- When `hero_trailer` tag is present in the query, automatically set `stream_types: ['stream']`
- This ensures the Odysee API filters out non-stream claims before they reach the backend parser
- More efficient than backend-side filtering after fetch

#### 3. Test Suite: `src-tauri/src/hero_stream_filter_test.rs`

Created comprehensive test suite with 6 tests:

1. **test_hero_query_includes_stream_types_filter**
   - Verifies that `stream_types` is set for hero_trailer queries
   - Validates the filter contains `['stream']`

2. **test_hero_query_has_reasonable_limit**
   - Ensures hero query has a reasonable limit (1-50)
   - Hero content fetches with limit=20 for random selection

3. **test_non_hero_queries_dont_force_stream_filter**
   - Verifies that non-hero queries don't automatically set `stream_types`
   - Ensures the filter is specific to hero_trailer

4. **test_stream_filter_prevents_non_stream_claims**
   - Simulates API response with mixed claim types
   - Verifies that only stream claims pass the filter

5. **test_hero_handles_empty_results**
   - Ensures empty results are handled gracefully
   - No errors when no valid streams exist

6. **test_hero_query_complete_flow**
   - Integration test verifying the complete hero query flow
   - Validates all required parameters are present

**All tests pass successfully.**

### Architecture Benefits

#### API-Level Filtering (Implemented)
- **Efficiency**: Non-stream claims are filtered by the Odysee API before reaching the backend
- **Performance**: Reduces network payload and backend processing
- **Simplicity**: Single point of filtering logic in `fetchByTags`

#### Backend-Level Validation (Already Exists)
- **Defense in Depth**: Backend still validates claim types via `is_stream_claim()`
- **Fallback Safety**: If API filtering fails, backend catches non-stream claims
- **Logging**: Backend logs skipped non-stream claims for monitoring

### Query Flow

```
Frontend: useHeroContent()
    ↓
Frontend: useContent({ tags: ['hero_trailer'] })
    ↓
Frontend: fetchByTags(['hero_trailer'])
    ↓ (Detects hero_trailer tag)
Frontend: Sets stream_types = ['stream']
    ↓
Frontend: fetchChannelClaims({ any_tags: ['hero_trailer'], stream_types: ['stream'] })
    ↓
Backend: fetch_channel_claims(any_tags=['hero_trailer'], stream_types=['stream'])
    ↓
Backend: Constructs API request with both filters
    ↓
Odysee API: Returns only stream claims tagged hero_trailer
    ↓
Backend: Validates and parses stream claims
    ↓
Frontend: Displays hero content
```

### Verification

1. **Compilation**: No errors or warnings related to the changes
2. **Tests**: All 6 hero stream filter tests pass
3. **Type Safety**: TypeScript types updated to include `stream_types` parameter
4. **Logging**: Debug logs include `stream_types` parameter for monitoring

### Future Considerations

- **Monitoring**: Track how many non-stream claims are tagged `hero_trailer` in production
- **Analytics**: Monitor if API-level filtering reduces backend processing time
- **Fallback**: Backend validation provides safety net if API filtering behavior changes

### Compliance

✅ **Requirement 7.1**: Hero query filters by `tag = hero_trailer` AND `value_type = stream`
✅ **Requirement 7.2**: Hero section displays first valid stream claim
✅ **Requirement 7.3**: Hero section doesn't fail if non-stream claim is tagged `hero_trailer`

### Testing Status

- **Unit Tests**: 6/6 passing
- **Integration Tests**: Covered by existing integration test suite
- **Manual Testing**: Ready for manual verification in development environment

### Next Steps

1. Manual testing in development environment
2. Verify hero section loads correctly with stream-only filtering
3. Monitor logs for any non-stream claims being filtered
4. Proceed to task 11.2 (Audit frontend player assumptions)
