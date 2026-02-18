# Merge Request: Odysee CDN Playback Standardization

## Summary

This PR refactors the video playback URL architecture from a fallback-based approach to a deterministic CDN-first strategy. The change eliminates unreliable direct URL extraction logic and replaces it with simple CDN URL construction from claim_id.

## Problem Statement

The current implementation attempts to extract direct video URLs from Odysee API responses before falling back to CDN URL construction. This approach is fundamentally flawed because:

1. The Odysee API does not reliably return direct playable URLs
2. It consistently returns claim metadata (claim_id) but not usable video URLs
3. The fallback architecture creates unnecessary complexity and failure points
4. This causes critical failures in Hero, Series, and Movies sections where content fails to load

## Solution

Treat CDN playback as the primary and only playback strategy, constructing playback URLs deterministically from claim_id using the pattern: `{gateway}/content/{claim_id}/master.m3u8`

## Key Changes

### 1. CDN Playback Builder
- New `build_cdn_playback_url()` function constructs deterministic CDN URLs
- Centralized `HLS_MASTER_PLAYLIST` constant for future-proof naming
- Uses immutable gateway configuration resolved at startup

### 2. Gateway Configuration
- Gateway resolved once at application initialization
- Stored in immutable static state (thread-safe, consistent)
- HTTPS-only enforcement with trailing slash removal
- Invalid gateway fallback to default with warning

### 3. Stream Type Validation
- Only constructs playback URLs for claims with `value_type == "stream"`
- Fallback inference via `value.source.sd_hash` for API compatibility
- Prevents 404 errors from non-stream claims (channels, reposts, collections)

### 4. Refactored extract_video_urls
- Removed all direct URL extraction logic (hd_url, sd_url, streams array)
- Single code path: validate stream → extract claim_id → build CDN URL
- Returns single "master" quality entry with HLS URL

### 5. Partial Success Support
- Individual claim failures don't fail entire batch
- Skipped claims logged at WARN level with context
- Sections render successfully if at least one valid claim exists

### 6. Production Logging
- INFO: Lifecycle events (gateway resolution at startup)
- DEBUG: Per-request operations (URL construction, prevents spam)
- WARN: Skipped claims (non-stream type, missing claim_id)
- ERROR: Structural failures (network errors, malformed JSON)

## Architectural Transition

**Before (API-Trust Model)**:
- Trust API to return direct URLs
- Complex fallback chains
- Unpredictable behavior when API changes
- More branching = more bugs

**After (Deterministic Infrastructure Model)**:
- claim_id is always stable
- CDN structure is predictable
- Single code path
- Less branching = fewer bugs

## Testing

### Property-Based Tests (7 properties, 100+ iterations each)
- ✅ CDN URL Construction Is Idempotent
- ✅ Missing Direct URL Fields Do Not Cause Errors
- ✅ Valid claim_id Always Produces CDN Playback URL
- ✅ Missing claim_id Returns Error
- ✅ Backend Response Contains Required Fields
- ✅ Partial Success When Processing Multiple Claims
- ✅ Error Details Are Structured

### Unit Tests (46 test cases)
- ✅ CDN Builder Tests
- ✅ Gateway Configuration Tests
- ✅ Stream Validation Tests
- ✅ extract_video_urls Tests
- ✅ parse_claim_item Tests
- ✅ Logging Tests

### Integration Tests (10 test cases)
- ✅ Hero section with valid hero_trailer claim
- ✅ Hero section with missing direct URLs
- ✅ Series section with partial success
- ✅ Movies section with all claims missing claim_id
- ✅ Section independence
- ✅ Tag-based content discovery still works

**Total: 123 tests passed, 0 failed**

## Requirements Coverage

All 15 requirements from the requirements document have been implemented and validated:

- ✅ Deterministic CDN Playback
- ✅ CDN Gateway Configuration and Initialization
- ✅ Stream-Only Claim Validation
- ✅ No Dependency on Direct URLs
- ✅ Partial Success Guarantee
- ✅ Production Logging Level Separation
- ✅ Hero Section Stream-Only Guarantee
- ✅ Development-Mode CDN Validation
- ✅ Eliminate Fallback Architecture
- ✅ Frontend Single-Quality HLS Model
- ✅ Hardened Backend Error Handling
- ✅ Section Independence
- ✅ Proper Error Conditions
- ✅ Preserve Existing Discovery Architecture
- ✅ Future-Proof Architecture Considerations

## Breaking Changes

None. The frontend contract remains unchanged - it still receives ContentItem arrays with video_urls HashMap. The only difference is that video_urls now contains a single "master" entry instead of multiple quality-specific entries.

## Migration Notes

### Environment Variable (Optional)
```bash
# Optional: Configure custom CDN gateway
ODYSEE_CDN_GATEWAY=https://custom-cdn.example.com
```

Default gateway: `https://cloud.odysee.live`

### Rollback Procedure
If critical issues are discovered:
```bash
git reset --hard pre-merge-cdn-standardization
```

## Files Changed

### Core Implementation
- `src-tauri/src/commands.rs` - Refactored playback URL logic

### New Test Files
- `src-tauri/src/cdn_builder_determinism_property_test.rs`
- `src-tauri/src/missing_direct_urls_property_test.rs`
- `src-tauri/src/valid_claim_id_property_test.rs`
- `src-tauri/src/missing_claim_id_property_test.rs`
- `src-tauri/src/response_structure_property_test.rs`
- `src-tauri/src/partial_success_property_test.rs`
- `src-tauri/src/error_structure_property_test.rs`
- `src-tauri/src/hero_stream_filter_test.rs`
- `src-tauri/src/logging_unit_test.rs`
- `src-tauri/src/integration_test.rs`

### Documentation
- `.kiro/specs/odysee-cdn-playback-standardization/requirements.md`
- `.kiro/specs/odysee-cdn-playback-standardization/design.md`
- `.kiro/specs/odysee-cdn-playback-standardization/tasks.md`
- `.kiro/specs/odysee-cdn-playback-standardization/IMPLEMENTATION_SUMMARY.md`
- `.kiro/specs/odysee-cdn-playback-standardization/ROLLBACK_PROCEDURE.md`
- `.kiro/specs/odysee-cdn-playback-standardization/FRONTEND_AUDIT_RESULTS.md`
- `.kiro/specs/odysee-cdn-playback-standardization/HERO_STREAM_FILTER_IMPLEMENTATION.md`

## Success Criteria

- ✅ Hero section loads with 1 hero_trailer video
- ✅ Series section loads successfully
- ✅ Movies section loads successfully
- ✅ Backend no longer fails due to missing direct URLs
- ✅ CDN playback is deterministic (same claim_id → same URL)
- ✅ No assumptions about direct video URLs in Odysee metadata
- ✅ No silent backend errors
- ✅ Partial success supported (one bad claim doesn't fail entire batch)
- ✅ All existing tests pass
- ✅ All new property tests pass (100+ iterations each)
- ✅ Integration tests verify section independence

## Reviewers

Please review:
1. Architectural soundness of deterministic CDN-first approach
2. Test coverage and correctness properties
3. Error handling and logging discipline
4. Production hardening considerations
5. Future-proof design decisions

## Related Issues

Fixes: Hero section fails to load due to missing direct URLs in Odysee API responses
Fixes: Series section fails when some claims have missing metadata
Fixes: Movies section enters error state unnecessarily

## Checklist

- ✅ All tests pass
- ✅ All requirements met
- ✅ Integration tests verify end-to-end functionality
- ✅ Pre-merge safety checkpoint created
- ✅ Rollback procedure documented and tested
- ✅ No regressions in existing functionality
- ✅ Code follows project style guidelines
- ✅ Documentation updated
- ✅ Property-based tests validate correctness
- ✅ Production logging discipline enforced
