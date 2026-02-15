# Requirements Document

## Introduction

The Kiyya Desktop application is transitioning from a fallback-based playback URL architecture to a **deterministic CDN-first playback model**. The current implementation attempts to extract direct video URLs from Odysee API responses before falling back to CDN URL construction. This approach is fundamentally flawed because:

1. The Odysee API does not reliably return direct playable URLs
2. It consistently returns claim metadata (claim_id, value.source.sd_hash) but not usable video URLs
3. The fallback architecture creates unnecessary complexity and failure points

This architectural flaw causes critical failures in the Hero section, Series section, and Movies section where content fails to load because the backend throws errors when direct URLs are missing.

The refactored system treats **CDN playback as the primary and only playback strategy**, constructing playback URLs deterministically from claim_id. This represents a fundamental shift from an **API-trust model** (reactive) to a **deterministic infrastructure model** (proactive).

## Glossary

- **CDN_Playback_Builder**: The function responsible for constructing playback URLs from claim_id using the CDN gateway
- **Claim_Metadata**: The JSON response from Odysee API containing claim_id, value_type, and other metadata
- **Direct_Stream_URL**: Deprecated unreliable video URL fields in API responses (hd_url, sd_url, streams array) that are no longer used
- **Playback_URL**: The final CDN-constructed HLS master playlist URL returned to the frontend for video playback
- **Backend_Command**: The Tauri command functions that fetch and process Odysee content
- **Gateway**: The CDN base URL used to construct playback URLs (resolved once at startup, immutable)
- **HLS_Master_Playlist**: The centralized constant defining the HLS playlist filename (default: "master.m3u8")
- **Stream_Claim**: An Odysee claim with value_type == "stream" (eligible for playback)
- **Hero_Section**: The autoplay video banner component on the home page
- **Series_Section**: The content section displaying episodic content
- **Movies_Section**: The content section displaying movie content

## Requirements

### Requirement 1: Deterministic CDN Playback (Core Architecture)

**User Story:** As a developer, I want playback URLs to be constructed deterministically from claim_id, so that the system is predictable, testable, and resilient to API changes.

#### Acceptance Criteria

1. THE Backend_Command SHALL construct playback URLs deterministically using claim_id only
2. THE playback URL SHALL follow the pattern: `{gateway}/content/{claim_id}/{HLS_MASTER_PLAYLIST}`
3. THE HLS_MASTER_PLAYLIST SHALL be defined as a centralized constant (default: "master.m3u8")
4. THE same claim_id SHALL always produce the same playback URL (idempotent)
5. THE CDN_Playback_Builder SHALL NOT depend on any API metadata fields except claim_id
6. THE system SHALL NOT attempt to extract direct video URLs from API responses
7. THE playback URL SHALL point to an HLS master playlist suitable for adaptive streaming

### Requirement 2: CDN Gateway Configuration and Initialization

**User Story:** As a system administrator, I want to configure the CDN gateway once at startup, so that the system behaves consistently throughout the application lifecycle.

#### Acceptance Criteria

1. THE system SHALL support configurable CDN gateway via ODYSEE_CDN_GATEWAY environment variable
2. THE gateway resolution SHALL occur once at application initialization
3. THE resolved gateway SHALL be stored in immutable configuration state (static/Arc)
4. THE gateway SHALL be validated at startup:
   - MUST start with `https://`
   - MUST have trailing slashes removed
   - MUST reject malformed URLs
5. IF gateway is invalid, THE system SHALL log a warning and fall back to default `https://cloud.odysee.live`
6. THE resolved gateway SHALL be logged at INFO level during startup
7. THE gateway SHALL remain immutable after initialization (no mid-session changes)
8. THE system SHALL use the immutable gateway for all playback URL construction

### Requirement 3: Stream-Only Claim Validation

**User Story:** As a developer, I want the system to validate claim types before constructing playback URLs, so that non-stream claims (channels, reposts, collections) do not cause 404 errors.

#### Acceptance Criteria

1. ONLY claims with `value_type == "stream"` SHALL be eligible for playback URL construction
2. IF `value_type` is missing, THE system MAY infer stream type via presence of `value.source.sd_hash`
3. WHEN claim structure is ambiguous (missing value_type but has source), THE system SHALL log at WARN level
4. NON-STREAM claims (channels, reposts, collections) SHALL be skipped safely
5. SKIPPED claims SHALL be logged at WARN level with claim_id and actual type
6. THE system SHALL NOT construct CDN URLs for non-stream claims
7. THE Hero_Section SHALL NOT fail if a non-stream claim is tagged `hero_trailer`

### Requirement 4: No Dependency on Direct URLs (Deprecated Architecture)

**User Story:** As a developer, I want the system to ignore unreliable direct URL fields, so that missing metadata does not cause failures.

#### Acceptance Criteria

1. THE Backend_Command SHALL NOT attempt to read `hd_url` from Claim_Metadata
2. THE Backend_Command SHALL NOT attempt to read `sd_url` from Claim_Metadata
3. THE Backend_Command SHALL NOT attempt to read `streams` array from Claim_Metadata
4. THE Backend_Command SHALL NOT attempt to read `video.url` from Claim_Metadata
5. THE Backend_Command SHALL NOT attempt to read `720p_url` or other quality-specific URLs
6. WHEN Direct_Stream_URL fields are missing, THE Backend_Command SHALL NOT return an error
7. WHEN Direct_Stream_URL fields are missing, THE Backend_Command SHALL NOT log warnings
8. THE system SHALL function solely on claim_id and value_type

### Requirement 5: Partial Success Guarantee (Batch Processing)

**User Story:** As a user, I want the application to display available content even if some claims fail validation, so that one bad claim does not prevent me from seeing other content.

#### Acceptance Criteria

1. WHEN processing multiple claims in a search response, THE Backend_Command SHALL allow partial success
2. INVALID claims (missing claim_id, non-stream type) SHALL NOT fail the entire batch
3. VALID claims SHALL still be returned in the response
4. SKIPPED claims SHALL be logged at WARN level with reason
5. THE Backend_Command SHALL continue processing remaining claims after encountering an error
6. IF all claims are invalid, THE Backend_Command SHALL return an empty array (not an error)
7. THE content section SHALL render successfully if at least one valid claim exists

### Requirement 6: Production Logging Level Separation

**User Story:** As a system operator, I want structured logging with appropriate levels, so that production logs are not noisy while maintaining diagnostic capability.

#### Acceptance Criteria

1. INFO level SHALL be used for:
   - Gateway resolution at application startup (once)
   - Meaningful lifecycle events
2. DEBUG level SHALL be used for:
   - CDN URL construction per-request (prevents spam)
   - Development-mode reachability validation results
3. WARN level SHALL be used for:
   - Skipped claims (non-stream type, missing claim_id)
   - Ambiguous claim structures
   - Invalid gateway configuration (with fallback)
4. ERROR level SHALL be used for:
   - Structural parsing failures (malformed JSON)
   - Network errors during claim_search
   - Frontend playback failures (with claim_id context)
5. THE logging SHALL NOT log sensitive user information
6. THE logging SHALL include timestamp and log level
7. REPETITIVE successful operations SHALL use DEBUG level (not INFO)

### Requirement 7: Hero Section Stream-Only Guarantee

**User Story:** As a user, I want the Hero section to display only valid stream content, so that I don't encounter playback errors from non-stream claims.

#### Acceptance Criteria

1. THE Hero query SHALL filter by:
   - `tag = hero_trailer`
   - `value_type = stream`
   - `limit = 1`
2. THE Hero_Section SHALL display the first valid stream claim
3. THE Hero_Section SHALL NOT fail if a non-stream claim is tagged `hero_trailer`
4. THE Hero_Section SHALL render successfully when one valid stream exists
5. THE Hero_Section SHALL autoplay in muted state
6. THE Hero_Section SHALL loop automatically
7. IF no valid stream claims exist, THE Hero_Section SHALL display an empty state

### Requirement 8: Development-Mode CDN Validation (Non-Blocking)

**User Story:** As a developer, I want optional CDN reachability validation in development mode, so that I can detect CDN behavior changes early without blocking production playback.

#### Acceptance Criteria

1. IN development mode only, THE system MAY validate CDN playback URLs via HEAD request
2. THE validation timeout SHALL be ≤ 2 seconds
3. THE validation SHALL NOT block playback URL construction or return
4. VALIDATION results SHALL be logged at DEBUG level
5. IF CDN returns non-200 status, THE system SHALL log at DEBUG level (not ERROR)
6. IF CDN returns 403, THE system SHALL log at DEBUG level with auth warning
7. IF validation times out, THE system SHALL log at DEBUG level
8. IN production mode, THE validation SHALL be disabled

### Requirement 9: Eliminate Fallback Architecture (Simplification)

**User Story:** As a developer, I want a single code path for playback URL construction, so that the codebase is simpler and more maintainable.

#### Acceptance Criteria

1. THE Backend_Command SHALL NOT implement conditional logic checking for Direct_Stream_URL first
2. THE Backend_Command SHALL NOT implement fallback from Direct_Stream_URL to CDN_Playback_Builder
3. WHEN claim_id exists and claim is stream type, THE Backend_Command SHALL immediately use CDN_Playback_Builder
4. THE Backend_Command SHALL NOT contain nested if-else chains for URL resolution
5. THE extract_video_urls function SHALL contain only CDN URL construction logic
6. THE system SHALL have a single playback URL construction code path

### Requirement 10: Frontend Single-Quality HLS Model

**User Story:** As a frontend developer, I want to use a single HLS master playlist URL, so that the player can handle adaptive quality selection automatically.

#### Acceptance Criteria

1. THE Frontend SHALL receive a single "master" quality entry in video_urls HashMap
2. THE Frontend SHALL use only the playback_url returned from Backend_Command
3. THE Frontend SHALL NOT attempt to reconstruct stream URLs from Claim_Metadata
4. THE Frontend SHALL NOT expect multiple quality-specific URLs (720p, 480p, etc.)
5. THE Frontend SHALL NOT display a manual quality selector dependent on multiple URLs
6. THE Frontend player SHALL load the HLS master playlist and handle adaptive streaming
7. THE Frontend SHALL NOT depend on sd_hash for playback

### Requirement 11: Hardened Backend Error Handling

**User Story:** As a developer, I want backend commands to handle errors gracefully without panicking, so that one failed item does not crash the entire application.

#### Acceptance Criteria

1. THE Backend_Command SHALL return structured response with playback_url field
2. THE Backend_Command SHALL NOT use unwrap() that can cause panics
3. WHEN processing multiple claims, THE Backend_Command SHALL allow partial success
4. WHEN one claim fails, THE Backend_Command SHALL continue processing remaining claims
5. WHEN an error occurs, THE Backend_Command SHALL log the error with context (claim_id, error type)
6. THE Backend_Command SHALL return error details in structured format
7. THE Backend_Command response SHALL include: claim_id, title, playback_url, thumbnail_url (if available), tags (if available)

### Requirement 12: Section Independence (Failure Isolation)

**User Story:** As a user, I want content sections to operate independently, so that a failure in one section does not prevent me from viewing other sections.

#### Acceptance Criteria

1. THE Hero_Section failure SHALL NOT prevent Series_Section from rendering
2. THE Series_Section failure SHALL NOT prevent Movies_Section from rendering
3. EACH section SHALL make independent backend calls
4. EACH section SHALL handle its own error states
5. NETWORK errors SHALL be isolated to the failing section
6. THE application SHALL NOT enter a global error state due to a single section failure

### Requirement 13: Proper Error Conditions (User Experience)

**User Story:** As a user, I want content sections to only show errors for actual failures, so that I am not shown error states due to missing optional metadata.

#### Acceptance Criteria

1. CONTENT sections SHALL enter error state ONLY when:
   - Network request to claim_search fails
   - claim_search returns empty result
   - All claims fail validation (no valid stream claims)
2. CONTENT sections SHALL NOT enter error state when:
   - Direct_Stream_URL is missing
   - sd_hash is missing
   - Optional metadata is missing (thumbnail, duration, description)
3. WHEN at least one valid claim is successfully processed, THE content section SHALL render successfully
4. THE content section SHALL enter error state only if zero valid claims are returned

### Requirement 14: Preserve Existing Discovery Architecture

**User Story:** As a developer, I want to ensure that refactoring playback logic does not break existing content discovery features, so that the application remains stable.

#### Acceptance Criteria

1. THE Backend_Command SHALL NOT modify tagging logic
2. THE Backend_Command SHALL NOT modify filtering logic
3. THE Backend_Command SHALL NOT modify playlist logic
4. THE Backend_Command SHALL NOT modify season/episode grouping logic
5. THE Frontend architecture SHALL remain unchanged (except player quality handling)
6. THE zero-server architecture SHALL be preserved
7. WHEN refactoring is complete, THE existing tag-based content discovery SHALL continue working
8. THE hero_trailer, series, movie, sitcom, kids tags SHALL continue functioning

### Requirement 15: Future-Proof Architecture Considerations

**User Story:** As a system architect, I want the codebase to acknowledge future extension points, so that future maintainers understand architectural decisions.

#### Acceptance Criteria

1. THE codebase SHALL include comments documenting potential multi-gateway fallback strategy
2. THE error logging SHALL include claim_id context for future CDN failover implementation
3. THE HLS_MASTER_PLAYLIST constant SHALL be centralized for future naming changes
4. THE gateway configuration SHALL support future alternate CDN endpoints
5. THE architecture SHALL NOT preclude future offline HLS caching
6. THESE considerations SHALL be documented but NOT implemented in MVP

## Architectural Transition Summary

This specification represents a fundamental architectural shift:

**Previous Model (API-Trust)**:
- Extract direct URLs from API
- Complex fallback logic
- Quality-based URL handling
- High branching complexity
- Reactive to API changes

**Current Model (Deterministic Infrastructure)**:
- Deterministic URL construction from claim_id
- Single playback path
- HLS master playlist only
- Reduced branching and failure surface
- Proactive and predictable

This transition simplifies the codebase, reduces failure modes, and makes the system resilient to Odysee API inconsistencies.
