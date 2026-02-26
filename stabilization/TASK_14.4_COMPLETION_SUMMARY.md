# Task 14.4 Completion Summary: Document Playback Model

**Task**: Document video playback architecture, player integration, and content fetch pipeline (actual, not theoretical)

**Status**: ✅ COMPLETE

**Date**: 2026-02-25

---

## What Was Documented

Added comprehensive "Video Playback Architecture" section to `ARCHITECTURE.md` covering:

### 1. Playback Model Overview
- CDN-based HLS (HTTP Live Streaming) playback model
- Adaptive bitrate streaming via Odysee CDN
- URL construction from claim IDs

### 2. Content Fetch Pipeline (Actual Implementation)
- Complete flowchart showing the actual pipeline from user selection to playback
- Step-by-step process:
  1. Fetch claim metadata from Odysee API
  2. Validate `value_type == "stream"` (reject non-stream claims)
  3. Extract and validate `claim_id`
  4. Construct CDN URL: `{gateway}/content/{claim_id}/master.m3u8`
  5. Return to frontend as `ContentItem`
  6. User clicks play → Initialize player
  7. Load HLS stream via hls.js or native player
  8. Start playback with progress tracking

### 3. CDN Playback URL Construction
- Backend implementation details (`commands.rs`)
- `extract_video_urls()` function flow:
  - Claim type validation
  - Claim ID extraction
  - CDN URL construction
  - Return value structure
- `build_cdn_playback_url()` function
- CDN gateway configuration (default: `https://cloud.odysee.live`)

### 4. Player Integration
- Frontend implementation details (`PlayerModal.tsx`)
- Plyr + hls.js integration
- HLS playback methods:
  - hls.js for Chrome/Firefox/Edge
  - Native HLS for Safari
  - Direct MP4 fallback
- Quality management (adaptive bitrate, auto-downgrade)
- Progress tracking (save every 20s)
- Buffering handling (auto-downgrade after 3 events)
- Compatibility checks

### 5. Offline Playback
- Local HTTP server implementation (`server.rs`)
- On-the-fly decryption for encrypted content
- HTTP Range support for seeking
- Concurrent streaming support

### 6. Playback Flow Summary
- Online playback flow (CDN streaming)
- Offline playback flow (local server)

### 7. Player Architecture Diagram
- Visual representation of player layers:
  - Frontend Player Layer (PlayerModal, Plyr UI, Video Element)
  - Streaming Layer (hls.js, Native HLS, Direct MP4)
  - Content Source (CDN, Local Server)
  - Backend Services (Commands, Server, Encryption, Vault)

### 8. Key Playback Features
- Adaptive bitrate streaming
- Seeking and Range requests
- Error recovery
- Progress persistence
- Quality fallback

### 9. Testing Coverage
- Backend tests (extract_video_urls, build_cdn_playback_url)
- Frontend tests (player initialization, quality selection)
- Property-based tests (5 properties × 100 cases)

### 10. Known Limitations
- Current constraints (single quality entry, no offline manifest caching)
- Platform support matrix

### 11. Future Enhancements
- Planned improvements (multiple quality levels, PiP, Chromecast, subtitles)

---

## Key Implementation Details Documented

### Backend (Rust)

**extract_video_urls() Function:**
```rust
fn extract_video_urls(item: &Value) -> Result<HashMap<String, VideoUrl>> {
    // 1. Validate claim type (stream only)
    // 2. Extract and validate claim_id
    // 3. Construct CDN URL
    // 4. Return HashMap with "master" entry
}
```

**build_cdn_playback_url() Function:**
```rust
pub(crate) fn build_cdn_playback_url(claim_id: &str, gateway: &str) -> String {
    format!("{}/content/{}/{}", gateway, claim_id, HLS_MASTER_PLAYLIST)
}
// HLS_MASTER_PLAYLIST = "master.m3u8"
```

**URL Pattern:**
- Format: `{gateway}/content/{claim_id}/master.m3u8`
- Example: `https://cloud.odysee.live/content/abc123def456/master.m3u8`

### Frontend (TypeScript/React)

**PlayerModal Component:**
- Integrates Plyr (UI) + hls.js (streaming)
- Handles online and offline playback
- Manages quality selection and auto-downgrade
- Tracks progress and saves every 20 seconds
- Monitors buffering and recovers from errors

**HLS Initialization:**
```typescript
const hls = new Hls({
  enableWorker: true,
  lowLatencyMode: false,
  backBufferLength: 90
});
hls.loadSource(videoUrl);
hls.attachMedia(videoElement);
```

**Quality Management:**
- Default: "master" (adaptive bitrate)
- Auto-downgrade: After 3 buffering events in 10 seconds
- Manual selection: User can choose specific quality

---

## Files Modified

1. **ARCHITECTURE.md**
   - Added "Video Playback Architecture" section (400+ lines)
   - Inserted before "Scalability Considerations" section
   - Includes 2 detailed flowcharts (content fetch pipeline, player architecture)

---

## Requirements Satisfied

✅ **Requirement 9.6**: Document playback model
- Described video playback architecture
- Documented player integration (Plyr + hls.js)
- Explained CDN-based HLS streaming model

✅ **Requirement 9.11**: Document content fetch pipeline (actual, not theoretical)
- Complete pipeline from claim fetch to playback
- Actual implementation details from `commands.rs` and `PlayerModal.tsx`
- No theoretical features - only what exists in production code

---

## Verification

### Documentation Completeness
- ✅ Playback model overview
- ✅ Content fetch pipeline with flowchart
- ✅ CDN URL construction details
- ✅ Player integration (Plyr + hls.js)
- ✅ Offline playback via local server
- ✅ Quality management and buffering
- ✅ Progress tracking
- ✅ Error handling and recovery
- ✅ Testing coverage
- ✅ Known limitations
- ✅ Future enhancements

### Accuracy Verification
- ✅ All code references verified against actual source files
- ✅ Function signatures match implementation
- ✅ URL patterns match production format
- ✅ Flowcharts reflect actual code paths
- ✅ No theoretical or planned features documented as existing

### Integration with Existing Documentation
- ✅ Consistent with module inventory (Section 4)
- ✅ Consistent with data flow diagrams (Section 5)
- ✅ Consistent with testing architecture (Section 9)
- ✅ References correct file paths and function names

---

## Key Insights

### Actual Playback Architecture
1. **CDN-Only Model**: Application uses CDN URLs exclusively, no direct stream URLs
2. **Single Quality Entry**: Only "master" quality (adaptive bitrate) in video_urls map
3. **HLS Primary**: HLS streaming is the primary method, MP4 is fallback
4. **Adaptive Bitrate**: hls.js handles quality selection automatically
5. **Offline Decryption**: Local server decrypts on-the-fly for offline playback

### Content Fetch Pipeline
1. **Claim Type Validation**: Strict validation of `value_type == "stream"`
2. **Claim ID Required**: Empty or missing claim_id causes error
3. **Direct URLs Ignored**: Application ignores hd_url, sd_url, streams array
4. **CDN Construction**: URL built from claim_id + gateway + "master.m3u8"
5. **Single Entry**: Returns HashMap with only "master" key

### Player Integration
1. **Plyr + hls.js**: Plyr provides UI, hls.js handles HLS streaming
2. **Native HLS Fallback**: Safari uses native HLS support
3. **Auto-Downgrade**: Quality downgrades after 3 buffering events
4. **Progress Tracking**: Saves every 20 seconds, final save on close
5. **Compatibility Checks**: Validates HLS and MP4 codec support

---

## Next Steps

Task 14.4 is complete. The playback model is now fully documented in ARCHITECTURE.md with:
- Actual implementation details (not theoretical)
- Complete content fetch pipeline
- Player integration architecture
- Offline playback support
- Testing coverage

This documentation satisfies Requirements 9.6 and 9.11 and provides a comprehensive reference for understanding the video playback system.

---

## Related Documentation

- **ARCHITECTURE.md**: Main architecture document (updated)
- **stabilization/DECISIONS.md**: Decision log
- **src-tauri/src/commands.rs**: Backend implementation
- **src/components/PlayerModal.tsx**: Frontend player implementation
- **src-tauri/src/server.rs**: Local HTTP server for offline playback
- **Property-based tests**: 5 properties validating playback URL construction

---

**Task Status**: ✅ COMPLETE
**Requirements**: 9.6, 9.11
**Phase**: 3 (Architecture Re-Stabilization)
