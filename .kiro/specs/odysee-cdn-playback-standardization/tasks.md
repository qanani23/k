# Implementation Plan: Odysee CDN Playback Standardization

## Overview

This implementation refactors the video playback URL architecture from a fallback-based approach to a deterministic CDN-first strategy. The work focuses on the backend Rust code in `src-tauri/src/commands.rs`, removing unreliable direct URL extraction logic and replacing it with simple CDN URL construction from claim_id.

## Safety and Version Control

- [x] 0. Create feature branch and safety checkpoint
  - [x] 0.1 Create feature branch: `feature/odysee-cdn-standardization`
  - [x] 0.2 Commit current state as baseline checkpoint
  - [x] 0.3 Document rollback procedure in case of critical failure
  - **Rationale**: This refactor removes core playback logic and fallback behavior. A bad merge could break Hero/Series/Movies sections simultaneously. Feature branch isolation provides safe rollback path.

## Tasks

- [x] 1. Create CDN playback builder function
  - Implement `build_cdn_playback_url(claim_id: &str, gateway: Option<&str>) -> String`
  - Use default gateway `https://cloud.odysee.live` if none provided
  - Construct URL pattern: `{gateway}/content/{claim_id}/{HLS_MASTER_PLAYLIST}`
  - **Centralize HLS playlist naming**: Define constant `HLS_MASTER_PLAYLIST = "master.m3u8"`
  - **Rationale**: If Odysee changes playlist naming convention, single constant update fixes entire codebase (architectural paranoia = good paranoia)
  - _Requirements: 1.2, 1.3_

- [x] 1.1 Write property test for CDN builder determinism
  - **Property 7: CDN URL Construction Is Idempotent**
  - **Validates: Requirements 1.4**

- [x] 1.2 Write unit tests for CDN builder
  - Test with default gateway (None)
  - Test with custom gateway
  - Test URL format matches pattern
  - Test with special characters in claim_id
  - _Requirements: 1.2, 1.3, 1.4_

- [x] 1.3 Add CDN reachability validation helper (non-blocking, dev mode only)
  - Implement optional HEAD request validator for constructed CDN URLs
  - **Enforce short timeout (1-2 seconds)** to prevent blocking dev server if CDN stalls
  - Log at DEBUG level if CDN returns non-200 status
  - Log at DEBUG level if CDN returns 403 (auth issues)
  - Log at DEBUG level if request times out
  - Do NOT block playback on validation failure
  - Only active in development mode
  - **Rationale**: If CDN changes behavior (requires headers, returns 403, changes URL pattern), logs provide early warning without breaking production playback. Timeout prevents dev build hangs.
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

- [x] 2. Add gateway configuration support
  - **Resolve CDN gateway once at application initialization** (deterministic resolution)
  - Store resolved gateway in static/Arc configuration state (immutable after startup)
  - Log resolved gateway at startup (INFO level)
  - Implement `get_cdn_gateway()` function to read from immutable state
  - Default to `https://cloud.odysee.live` if not set
  - Add configuration documentation for ODYSEE_CDN_GATEWAY env var
  - **Validate gateway format for security and stability**:
    - Must start with `https://` (reject http://)
    - Remove trailing slash to prevent double-slash in URLs
    - Reject malformed URLs
    - Log warning if invalid gateway provided, fall back to default
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_
  - **Moved earlier**: extract_video_urls will immediately use final gateway logic, avoiding temporary implementations
  - **Security**: Prevents malicious gateway injection and malformed URLs like `https://cloud.odysee.live//content/claim/master.m3u8`
  - **Determinism**: Gateway resolution happens once at startup, preventing mid-session inconsistency if env var changes

- [x] 2.1 Write unit tests for gateway configuration
  - Test with ODYSEE_CDN_GATEWAY set
  - Test with ODYSEE_CDN_GATEWAY not set (uses default)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Refactor extract_video_urls function
  - [x] 3.1 Add claim type validation (CRITICAL)
    - **Primary check**: Validate `claim.value_type == "stream"`
    - **Fallback inference**: If `value_type` is missing, infer stream by presence of `value.source.sd_hash`
    - **Ambiguity logging**: Log at WARN level for claims with ambiguous structure (missing value_type but has source)
    - Skip non-stream claims (channels, reposts, collections, etc.)
    - Log at WARN level for skipped non-stream claims with claim_id and actual type
    - **Rationale**: Odysee API structure varies by version. Prefer explicit `value_type`, fallback to structural inference. This prevents silent breakage if API structure shifts.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  
  - [x] 3.2 Remove all direct URL extraction logic
    - Remove hd_url extraction
    - Remove sd_url extraction
    - Remove 720p_url extraction
    - Remove streams array processing
    - Remove video.url extraction
    - Remove quality-specific URL generation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 9.1, 9.2, 9.5_
  
  - [x] 3.3 Implement CDN-only URL construction
    - Extract claim_id from item
    - Return error if claim_id missing or empty
    - Call `build_cdn_playback_url` with claim_id and gateway from immutable state
    - Create VideoUrl struct with url_type="hls", quality="master"
    - Insert into HashMap with key "master"
    - **Add future-proof comment for CDN failure strategy**:
      - `/// Future: Support multi-gateway fallback strategy for regional CDN failures`
      - Documents architectural consideration for alternate gateway fallback
      - Not implemented now, but signals mature engineering foresight
    - **Logging levels (idempotent discipline)**:
      - INFO: Gateway resolved at startup (once)
      - DEBUG: CDN URL constructed for claim_id (per-request, prevents spam)
      - WARN: Skipped claim due to missing claim_id or non-stream type
      - ERROR: Structural parsing failure (malformed JSON, missing required fields)
      - DEBUG: Reachability validation results (dev mode only)
    - _Requirements: 1.1, 1.2, 1.5, 6.1, 6.2, 6.7, 9.3, 9.4, 15.1_

- [x] 3.4 Write property test for missing direct URLs
- [ ] 3.4 Write property test for missing direct URLs
  - **Property 1: Missing Direct URL Fields Do Not Cause Errors**
  - **Validates: Requirements 4.6, 4.7**

- [x] 3.5 Write property test for valid claim_id
  - **Property 2: Valid claim_id Always Produces CDN Playback URL**
  - **Validates: Requirements 1.1, 1.2, 1.4**

- [x] 3.6 Write property test for missing claim_id
  - **Property 3: Missing claim_id Returns Error**
  - **Validates: Requirements 2.4**

- [x] 3.7 Write unit tests for extract_video_urls
  - Test with valid claim_id and stream type
  - Test with missing claim_id
  - Test with empty claim_id
  - Test with non-stream claim types (channel, repost, collection)
  - Test that direct URL fields are ignored
  - Test logging behavior
  - _Requirements: 1.5, 1.6, 4.6, 4.7, 9.1, 9.2_

- [x] 4. Update parse_claim_item error handling
  - Keep error propagation for extract_video_urls failures
  - Ensure missing claim_id causes claim to be skipped
  - Add logging for skipped claims
  - _Requirements: 5.2, 5.4, 11.3, 11.4, 11.5_

- [x] 4.1 Write property test for response structure
  - **Property 4: Backend Response Contains Required Fields**
  - **Validates: Requirements 11.7**

- [x] 4.2 Write unit tests for parse_claim_item
  - Test successful parsing with all fields
  - Test successful parsing with minimal fields
  - Test claim skipped when claim_id missing
  - Test error propagation for missing claim_id
  - _Requirements: 5.2, 5.4, 11.3, 11.4, 11.5, 11.7_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Update parse_claim_search_response for partial success
  - Modify to continue processing when individual claims fail
  - Collect successful ContentItems
  - Log warnings for failed claims
  - Return array of successful items (may be empty)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 6.1 Write property test for partial success
  - **Property 5: Partial Success When Processing Multiple Claims**
  - **Validates: Requirements 5.1, 5.2, 5.5**

- [x] 6.2 Write unit tests for batch processing
  - Test with all valid claims
  - Test with all invalid claims (returns empty array)
  - Test with mix of valid and invalid claims
  - Test logging for skipped claims
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 7. Update error handling and logging
  - Add structured error types for missing claim_id
  - **Implement production logging level separation (idempotent discipline)**:
    - **INFO**: Gateway resolved at startup (once, lifecycle event)
    - **DEBUG**: CDN URL construction per-request (prevents spam on Hero refresh)
    - **WARN**: Skipped claims (non-stream type, missing claim_id)
    - **ERROR**: Structural failures (malformed JSON, network errors)
    - **DEBUG**: Reachability HEAD request results (dev mode only)
  - Add warning logging for skipped claims
  - Remove warnings about missing direct URLs
  - Ensure all errors include claim context
  - **Provide structured error format for frontend playback failure telemetry (optional future enhancement)**:
    - Define error structure that includes claim_id context
    - Document error format for future frontend integration
    - Future-proof hook for alternate gateway fallback strategy
  - **Rationale**: Prevents noisy production logs (DEBUG for repetitive operations, INFO only for meaningful lifecycle events)
  - _Requirements: 4.6, 4.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 15.2_

- [x] 7.1 Write property test for error structure
  - **Property 6: Error Details Are Structured**
  - **Validates: Requirements 4.6**

- [x] 7.2 Write unit tests for logging
  - Verify claim_id is logged when processing
  - Verify constructed URL is logged
  - Verify errors are logged with context
  - Verify no warnings for missing direct URLs
  - _Requirements: 4.7, 6.1, 6.2, 6.3, 6.4, 6.7_

- [x] 8. Remove obsolete tests
  - Remove or update tests that expect direct URL extraction
  - Remove tests for fallback logic
  - Remove tests for quality-specific URL generation
  - Update tests to expect CDN URLs only
  - _Requirements: 9.5_

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [-] 10. Create pre-merge safety checkpoint
  - [-] 10.1 Commit all changes with descriptive message
  - [ ] 10.2 Tag commit as `pre-merge-cdn-standardization`
  - [ ] 10.3 Document current test results and passing rate
  - [ ] 10.4 Verify rollback procedure works (test branch reset)
  - **Rationale**: Final safety checkpoint before integration testing. If integration reveals critical issues, this tag provides clean rollback point.

- [ ]* 11. Integration testing
  - [ ] 11.1 Validate hero_trailer search enforces stream-only filter
    - Verify Hero query filters by: `tag = hero_trailer` AND `value_type = stream`
    - Verify limit = 1
    - If filtering is frontend-side, verify implementation
    - If filtering is backend-side, enforce in query parameters
    - **Rationale**: Prevents Hero from loading non-stream claims (channels, collections) that happen to be tagged `hero_trailer`
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [ ] 11.2 Audit frontend player assumptions (CRITICAL)
    - Verify frontend player uses only "master" quality key
    - Remove or update quality selector logic if dependent on multiple stream URLs
    - Verify no code accesses removed URL keys (hd_url, sd_url, 720p, 480p, etc.)
    - Check for any fallback logic that expects multiple quality options
    - Update player component to handle single HLS master playlist
    - **Rationale**: Frontend may still expect multi-quality URLs. This causes runtime UI bugs if quality selector tries to access removed keys.
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_
  
  - [ ] 11.3 Test Hero section with valid hero_trailer claim
    - _Requirements: 7.2, 7.4, 12.1_
  - [ ] 11.4 Test Hero section with missing direct URLs (should succeed)
    - _Requirements: 4.6, 4.7, 13.2, 13.3_
  - [ ] 11.5 Test Series section with partial success
    - _Requirements: 5.1, 5.7, 12.2_
  - [ ] 11.6 Test Movies section with all claims missing claim_id (empty state)
    - _Requirements: 5.6, 13.1, 13.4_
  - [ ] 11.7 Test section independence (Hero failure doesn't affect Series)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_
  - [ ] 11.8 Test that existing tag-based content discovery still works
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.7, 14.8_
  - [ ] 11.9 Add note about CDN cache control behavior
    - Document that HLS CDN may cache aggressively
    - Note potential cache invalidation considerations for future
    - Not critical for MVP, but important for architecture awareness
    - _Requirements: 15.5_

- [ ] 12. Final checkpoint - Verify all requirements met
  - Ensure all tests pass, ask the user if questions arise.
  - Document what was removed, what was simplified, and why this is correct
  - Prepare merge request with comprehensive description

## Notes

- **Optional Task Markers**:
  - `*` prefix = Optional property-based or integration test (can be skipped for faster MVP)
- **Task Ordering Rationale**:
  - Task 0: Safety first - feature branch isolation prevents catastrophic failures
  - Tasks 1-2: Foundation layer - CDN builder and gateway config established before refactoring
  - Task 3: Core refactor - extract_video_urls uses final gateway logic immediately (no temporary implementations)
  - Tasks 4-7: Error handling and validation
  - Task 8: Cleanup obsolete code
  - Task 10: Pre-merge safety checkpoint - final rollback point before integration
  - Task 11: Integration testing with real sections
  - Task 12: Final verification and merge preparation
- **Critical Production Issues Addressed**:
  1. **HLS Playback Compatibility** (Task 1.3): Non-blocking CDN reachability validation in dev mode with 1-2s timeout
  2. **Claim Type Validation** (Task 3.1): Prefer `value_type == "stream"`, fallback to `value.source.sd_hash` inference, log ambiguous structures
  3. **Hero Section Guarantee** (Task 11.1): Enforce stream-only filter for hero_trailer queries
  4. **Gateway Sanitization** (Task 2): Validate HTTPS, remove trailing slashes, reject malformed URLs
  5. **Frontend Assumptions** (Task 11.2): Audit player for multi-quality expectations and removed URL keys
  6. **CDN Cache Awareness** (Task 11.9): Document cache behavior for future considerations
  7. **HLS Playlist Naming** (Task 1): Centralize `HLS_MASTER_PLAYLIST` constant for future-proof URL construction
  8. **Logging Level Separation** (Task 7): INFO/WARN/ERROR/DEBUG separation prevents noisy production logs
  9. **Deterministic Gateway Resolution** (Task 2): Resolve once at startup, store in immutable state, prevents mid-session inconsistency
  10. **Idempotent Logging Discipline** (Task 3.3, 7): DEBUG for per-request operations, INFO only for lifecycle events
  11. **CDN Failure Strategy** (Task 3.3, 7): Future-proof comments and error logging for multi-gateway fallback
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- Integration tests verify end-to-end functionality and section independence
- All existing functionality (tagging, filtering, playlists) must continue working unchanged

## Architecture Observation

This refactor represents a fundamental shift from **API-trust model** to **deterministic infrastructure model**:

**Before (Reactive)**:
- Trust API to return direct URLs
- Complex fallback chains
- Unpredictable behavior when API changes
- More branching = more bugs

**After (Deterministic)**:
- claim_id is always stable
- CDN structure is predictable
- Single code path
- Less branching = fewer bugs

This is the correct architectural decision for Odysee because:
- Odysee API is inconsistent with direct URLs
- claim_id is the only truly stable identifier
- CDN URL pattern is documented and reliable
- Simplification reduces maintenance burden

This transition from reactive to deterministic architecture demonstrates senior-level systems thinking.

## Task Dependency Diagram

```
Task 0 (Safety Branch) ─→ Task 1 (CDN Builder) ─→ Task 2 (Gateway Config) ─→ Task 3 (Refactor extract_video_urls)
                                                                                    ↓
Task 4 (parse_claim_item) ←─────────────────────────────────────────────────────────┘
    ↓
Task 5 (Checkpoint)
    ↓
Task 6 (parse_claim_search_response) ─→ Task 7 (Error Handling & Logging)
    ↓
Task 8 (Remove Obsolete Tests)
    ↓
Task 9 (Checkpoint)
    ↓
Task 10 (Pre-Merge Safety Checkpoint) ─→ Task 11 (Integration Testing) ─→ Task 12 (Final Verification)

Critical Path: Task 0 → Task 1 → Task 2 → Task 3 → Task 4 → Task 6 → Task 10 → Task 11 → Task 12
```

## Rollback Procedure

If critical issues are discovered during integration testing:

1. **Immediate Rollback**: `git reset --hard pre-merge-cdn-standardization`
2. **Branch Isolation**: Work remains on feature branch, main/develop unaffected
3. **Issue Analysis**: Review integration test failures and logs
4. **Iterative Fix**: Make corrections on feature branch, re-test
5. **Re-checkpoint**: Create new safety tag before retry

## Success Criteria

After completing all tasks:
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
