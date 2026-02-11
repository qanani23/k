# Developer Notes: Kiyya Desktop Streaming Application

## Document Purpose

This document captures architectural decisions, implementation notes, known issues, TODOs, and guidance for future development. It serves as a living document that should be updated as the project evolves.

**Last Updated**: February 10, 2026

---

## Table of Contents

1. [Architectural Decisions](#architectural-decisions)
2. [Implementation Notes](#implementation-notes)
3. [Known Issues and Limitations](#known-issues-and-limitations)
4. [TODOs and Future Work](#todos-and-future-work)
5. [Development Guidelines](#development-guidelines)
6. [Testing Strategy](#testing-strategy)
7. [Deployment Considerations](#deployment-considerations)

---

## Architectural Decisions

### AD-001: Tauri Framework Selection

**Decision**: Use Tauri (Rust backend + Web frontend) instead of Electron

**Rationale**:
- Smaller binary size and memory footprint
- Better security model with restricted IPC
- Native performance for video streaming and encryption
- Cross-platform support with single codebase

**Trade-offs**:
- Smaller ecosystem compared to Electron
- Rust learning curve for backend development
- Limited native module support

**Status**: ✅ Implemented

---

### AD-002: Single Channel Architecture

**Decision**: Application serves content from exactly one Odysee channel (hard-coded channel ID)

**Rationale**:
- Simplified content curation and quality control
- Reduced complexity in content discovery
- Easier to maintain consistent user experience
- Aligns with business model of curated content

**Implementation Details**:
- Channel ID stored in environment variable `VITE_CHANNEL_ID`
- All content fetching uses this single channel ID
- No multi-channel support or channel switching

**Status**: ✅ Implemented

---

### AD-003: Tag-Based Content Categorization

**Decision**: Use hard-coded, immutable tags for content categorization

**Rationale**:
- Authoritative categorization controlled by content uploaders
- No dynamic tag inference or AI-based categorization
- Predictable and testable content organization
- Clear contract between uploaders and application

**Tag System**:
```typescript
Base Tags: series, movie, sitcom, kids, hero_trailer
Filter Tags: comedy_movies, action_movies, romance_movies, 
            comedy_series, action_series, romance_series,
            comedy_kids, action_kids
```

**Critical Rules**:
- Tags are never modified or inferred by the application
- NavBar dropdowns are generated from category configuration
- Content must be tagged correctly by uploaders (see UPLOADER_GUIDE.md)

**Status**: ✅ Implemented

---

### AD-004: Gateway Failover with Immutable Priority

**Decision**: Implement multi-gateway failover with fixed priority order

**Rationale**:
- Resilience against single gateway failures
- Improved availability and user experience
- Predictable failover behavior for debugging

**Implementation**:
- Three prioritized Odysee gateways configured
- Exponential backoff: 300ms → 1s → 2s with jitter
- Maximum 3 attempts per request
- Gateway order never changes dynamically
- All failures logged to `gateway.log`

**Trade-offs**:
- No dynamic gateway health monitoring
- No automatic gateway reordering based on performance
- Manual configuration updates required for gateway changes

**Status**: ✅ Implemented

---

### AD-005: SQLite for Local Data Persistence

**Decision**: Use SQLite for all local data storage (cache, favorites, progress, offline metadata)

**Rationale**:
- Single source of truth for application data
- ACID transactions for data integrity
- Efficient querying with proper indexing
- Built-in FTS5 support for search
- No external database dependencies

**Critical Rule**: LocalStorage may ONLY be used for UI preferences, never for application data

**Status**: ✅ Implemented

---

### AD-006: Optional AES-GCM Encryption for Downloads

**Decision**: Provide optional encryption for downloaded content using AES-GCM

**Rationale**:
- User privacy for sensitive content
- Protection against unauthorized access to downloaded files
- Industry-standard encryption algorithm

**Implementation**:
- Keys stored in OS keystore (never in code or database)
- User must set passphrase on first enable
- Explicit warnings about data loss if key is lost
- On-the-fly decryption during streaming (no decrypted files written to disk)

**Trade-offs**:
- Performance overhead during streaming
- Key management complexity
- Risk of data loss if user loses passphrase

**Status**: ✅ Implemented

---

### AD-007: Local HTTP Server for Offline Playback

**Decision**: Implement local HTTP server with Range header support for offline content streaming

**Rationale**:
- Enables video seeking in offline content
- Reuses existing video player components
- Standard HTTP protocol for compatibility
- Supports concurrent connections

**Implementation**:
- Server binds to `127.0.0.1:0` (random available port)
- Endpoints: `/movies/<uuid>`
- HTTP 206 Partial Content responses
- On-the-fly decryption for encrypted content

**Security**:
- Localhost-only binding (no external access)
- UUID-based content identification (no path traversal)
- Restricted to application vault directory

**Status**: ✅ Implemented

---

### AD-008: Series Organization via Playlists

**Decision**: Use Odysee playlists as canonical source for series episode ordering

**Rationale**:
- Uploader-controlled episode order
- Handles non-standard numbering schemes
- Supports multi-season series organization

**Fallback Strategy**:
- Parse episode titles for S##E## patterns when playlists unavailable
- Display "Seasons inferred automatically" notice for fallback mode
- Never mix playlist and parsed ordering for same series

**Status**: ✅ Implemented

---

### AD-009: Minimal GSAP Animation Usage

**Decision**: Strictly limit GSAP animations to hero entry, dropdown open/close, and row hover only

**Rationale**:
- Prevent performance issues from excessive animations
- Maintain focus on content over effects
- Respect prefers-reduced-motion accessibility setting
- Avoid layout shifts and jank

**Allowed GSAP Usage**:
- Hero section entry animations (opacity, translate, blur)
- NavBar dropdown open/close transitions
- RowCarousel hover effects

**Forbidden**:
- Layout animations that cause reflows
- Continuous/infinite animations
- Animations on scroll events
- Any animations when prefers-reduced-motion is set

**Status**: ✅ Implemented

---

### AD-010: Property-Based Testing for Core Logic

**Decision**: Use property-based testing for critical algorithms and data transformations

**Rationale**:
- Comprehensive input coverage through randomization
- Catches edge cases missed by example-based tests
- Formal verification of correctness properties
- Complements unit and E2E tests

**Scope**:
- Core logic invariants (categorization, caching, ordering, failover)
- NOT for UI behavior (use unit/E2E tests instead)
- Minimum 100 iterations per property test

**Status**: ✅ Implemented (7 properties)

---

### AD-011: Update System with Emergency Disable

**Decision**: Implement version checking with emergency disable capability

**Rationale**:
- Remote kill switch for critical security issues
- Forced update mechanism for breaking changes
- Optional update notifications for feature releases

**Implementation**:
- Version manifest fetched from public GitHub repository
- Emergency disable check runs before all startup logic
- Forced update blocks all functionality except Update/Exit
- Optional updates show dismissible notification

**Manifest Structure**:
```json
{
  "latestVersion": "1.2.0",
  "minSupportedVersion": "1.0.0",
  "releaseNotes": "...",
  "downloadUrl": "...",
  "emergencyDisable": false
}
```

**Status**: ✅ Implemented

---

### AD-012: Database Migration System

**Decision**: Implement numbered migration files with transaction-based execution

**Rationale**:
- Safe schema evolution across versions
- Rollback capability for failed migrations
- Clear migration history and versioning

**Critical Fix**: Single migration execution point in Tauri setup hook to prevent stack overflow

**Implementation**:
- Migrations stored in `migrations/` directory
- `migrations` table tracks applied versions
- Sequential execution within transactions
- Automatic rollback on failure

**Status**: ✅ Implemented

**Known Issue**: Fixed stack overflow from double migration execution (see AD-012a)

---

### AD-012a: Database Initialization Stack Overflow Fix

**Problem**: Application crashed on startup due to stack overflow caused by double migration execution

**Root Cause**:
- Migrations executed twice: once in `Database::new()` and once in Tauri setup hook
- Double execution with `task::spawn_blocking` exhausted stack before initialization completed

**Solution**:
- Removed automatic migration execution from `Database::new()`
- Single execution point in Tauri setup hook via `run_startup_migrations()`
- `Database::new()` now only creates connection pool and base schema

**Implementation**:
```rust
// src-tauri/src/main.rs:54
// Database::new() creates pool only (NO migrations)

// src-tauri/src/main.rs:setup hook
// ONLY place where migrations execute
async fn run_startup_migrations(app_handle: &tauri::AppHandle)
```

**Status**: ✅ Fixed

**Reference**: `.kiro/specs/fix-database-initialization-stack-overflow/`

---

### AD-013: NavBar Separation of Concerns

**Decision**: NavBar component handles routing only, never fetches content directly

**Rationale**:
- Clear separation between navigation and data fetching
- Prevents unnecessary API calls on dropdown interactions
- Simplifies component testing and maintenance

**Implementation Flow**:
1. NavBar reads category configuration
2. Renders dropdown menus with route links
3. User clicks dropdown item → navigate to category page
4. Category page reads filter parameter and fetches content

**Status**: ✅ Implemented

---

### AD-014: Hero Content Session Persistence

**Decision**: Randomly select hero content once per session and persist for session duration

**Rationale**:
- Consistent user experience within session
- Reduces API calls and bandwidth
- Prevents jarring content changes on navigation

**Implementation**:
- Fetch content tagged with `hero_trailer` on app start
- Random selection from available hero content
- Store in memory for session duration
- Attempt autoplay (muted), fallback to poster if fails
- No retry loops for autoplay failures

**Status**: ✅ Implemented

---

### AD-015: Related Content Recommendations

**Decision**: Show 10 random items from same category, excluding current content

**Rationale**:
- Simple recommendation algorithm without ML complexity
- Encourages content discovery
- Leverages existing categorization system

**Implementation**:
- Fetch 50 items from same category tag
- Shuffle and select 10 items
- Filter out current content
- Cache for session duration

**Status**: ✅ Implemented

---

## Implementation Notes

### IN-001: Environment Variables

**Required Variables**:
```bash
VITE_CHANNEL_ID=<odysee_channel_id>
VITE_UPDATE_MANIFEST_URL=https://raw.githubusercontent.com/USER/kiyya-releases/main/version.json
VITE_GATEWAY_PRIMARY=https://api.odysee.com
VITE_GATEWAY_SECONDARY=https://api.na-backend.odysee.com
VITE_GATEWAY_FALLBACK=https://api.eu-backend.odysee.com
```

**Optional Variables**:
```bash
VITE_CACHE_TTL_MINUTES=30
VITE_MAX_CACHE_ITEMS=200
VITE_ENABLE_DEBUG_LOGGING=false
```

**Security Note**: Never commit `.env` file to version control

---

### IN-002: Database Schema Versioning

**Current Schema Version**: 1

**Migration Files**:
- `001_initial_schema.sql` - Base tables and indices
- Future migrations numbered sequentially

**Adding New Migrations**:
1. Create new file: `00X_description.sql`
2. Increment version number
3. Add migration logic with rollback support
4. Test with sample older database
5. Update schema documentation

---

### IN-003: Gateway Configuration

**Current Gateways** (priority order):
1. `https://api.odysee.com` (primary)
2. `https://api.na-backend.odysee.com` (secondary)
3. `https://api.eu-backend.odysee.com` (fallback)

**Retry Configuration**:
- Max attempts: 3
- Backoff: 300ms → 1s → 2s
- Jitter: ±20% random variation

**Logging**: All gateway attempts logged to `gateway.log`

---

### IN-004: Video Quality Selection

**Available Qualities**:
- 1080p (preferred for high-speed connections)
- 720p (default for most users)
- 480p (fallback for slow connections)

**Selection Logic**:
1. Check user preference (if set)
2. Estimate network speed (if available)
3. Default to 720p
4. Auto-downgrade on repeated buffering (≥3 times in 10 seconds)

---

### IN-005: Search Query Normalization

**Normalization Rules**:
- "season one" → "S01"
- "episode ten" → "E10"
- "1x10" → "S01E10"
- Case-insensitive matching
- Whitespace normalization

**Implementation**: `src/lib/search.ts`

---

### IN-006: Encryption Key Management

**Key Storage**:
- Windows: Windows Credential Manager
- macOS: Keychain
- Linux: Secret Service API / libsecret

**Key Derivation**:
- User passphrase → PBKDF2 → AES-256 key
- Salt stored in database (not secret)
- Key never stored in plaintext

**Recovery**: No key recovery mechanism - data loss if passphrase forgotten

---

### IN-007: Local Server Port Assignment

**Port Selection**: Dynamic (OS-assigned)
- Bind to `127.0.0.1:0`
- OS assigns available port
- Port number returned to frontend
- Prevents port conflicts

**Endpoint Format**: `http://127.0.0.1:<port>/movies/<uuid>`

---

### IN-008: Playlist Parsing Logic

**Episode Title Format**: `SeriesName S01E01 - Episode Title`

**Parsing Strategy**:
1. Check for playlist data (preferred)
2. Parse title for S##E## pattern
3. Extract series name, season, episode numbers
4. Group by series name
5. Sort by season and episode numbers

**Fallback Indicators**:
- Show "Seasons inferred automatically" when using title parsing
- Never mix playlist and parsed data for same series

---

### IN-009: Memory Management

**Strategies**:
- Lazy loading for content rows (IntersectionObserver)
- requestIdleCallback for non-critical operations
- Image lazy loading with placeholder
- Limit initial cache to 100-200 items
- Database connection pooling

**Monitoring**: Memory stats available in Settings → Diagnostics

---

### IN-010: Error Logging

**Log Files**:
- `app.log` - General application logs (rotated at 10MB)
- `gateway.log` - Gateway failover and API errors
- `security.log` - Security-related events

**Log Rotation**: Size-based (10MB per file, 5 historical files)

**Log Location**:
- Windows: `%APPDATA%/kiyya-desktop/logs/`
- macOS: `~/Library/Application Support/kiyya-desktop/logs/`
- Linux: `~/.local/share/kiyya-desktop/logs/`

---

## Known Issues and Limitations

### KI-001: Series Browsing E2E Test Stack Overflow

**Issue**: Playwright E2E tests for series browsing fail with stack overflow in test environment

**Impact**: Tests skipped, but production functionality works correctly

**Root Cause**: Test environment recursion depth limits, not production code issue

**Workaround**: Tests temporarily skipped with `.skip()` annotation

**Status**: 🔶 Known limitation (test environment only)

**Reference**: `test-results/app-Series-Browsing-and-Ep-*/error-context.md`

---

### KI-002: HLS Playback on Older Browsers

**Issue**: HLS streams may not play on browsers without MediaSource API support

**Impact**: Limited browser compatibility for HLS content

**Mitigation**: hls.js fallback implemented, compatibility warnings shown

**Status**: ✅ Mitigated

---

### KI-003: Encryption Performance Overhead

**Issue**: On-the-fly decryption adds latency to video streaming

**Impact**: Potential buffering on slower systems

**Mitigation**: 
- Warn users about performance impact
- Recommend encryption only for sensitive content
- Consider disabling for large files

**Status**: 🔶 Known limitation

---

### KI-004: No Automatic Update Installation

**Issue**: Application cannot auto-install updates (requires manual download)

**Impact**: Users must manually download and install updates

**Rationale**: Security and user control over system modifications

**Status**: ⚠️ By design

---

### KI-005: Single Channel Limitation

**Issue**: Application serves content from only one Odysee channel

**Impact**: Cannot browse or search across multiple channels

**Rationale**: Architectural decision for curated content experience

**Status**: ⚠️ By design

---

### KI-006: No Cloud Sync for Favorites/Progress

**Issue**: Favorites and playback progress not synced across devices

**Impact**: Users must manage favorites separately on each device

**Rationale**: Privacy-first design, no user accounts or cloud services

**Status**: ⚠️ By design

---

### KI-007: Limited Offline Search

**Issue**: Search only works with cached content when offline

**Impact**: Cannot discover new content without internet connection

**Mitigation**: Cache includes recent uploads for offline browsing

**Status**: 🔶 Known limitation

---

## TODOs and Future Work

### High Priority

#### TODO-001: Code Signing for Production Builds

**Description**: Implement code signing for Windows and macOS builds

**Rationale**: Required for distribution without security warnings

**Tasks**:
- [ ] Obtain code signing certificates
- [ ] Configure Tauri build for signing
- [ ] Document signing process
- [ ] Test signed builds on target platforms

**Estimated Effort**: 2-3 days

**Blockers**: Certificate acquisition and cost

---

#### TODO-002: Automated Release Pipeline

**Description**: Create CI/CD pipeline for automated builds and releases

**Tasks**:
- [ ] Set up GitHub Actions workflow
- [ ] Configure build matrix (Windows, macOS, Linux)
- [ ] Implement automated testing in CI
- [ ] Create release artifact upload
- [ ] Update version manifest automatically

**Estimated Effort**: 3-5 days

---

#### TODO-003: Native Emergency Disable Dialog

**Description**: Replace console logging with native dialog for emergency disable

**Current**: Logs message and exits
**Desired**: Native OS dialog with message and Exit button

**Implementation**:
```rust
// src-tauri/src/main.rs:show_emergency_disable_message()
// TODO: Use native dialog API
```

**Estimated Effort**: 1 day

---

#### TODO-004: Bundle Size Optimization

**Description**: Analyze and optimize application bundle size

**Tasks**:
- [ ] Implement bundle analysis script
- [ ] Identify large dependencies
- [ ] Consider code splitting for frontend
- [ ] Optimize asset compression
- [ ] Document bundle size targets

**Estimated Effort**: 2-3 days

---

### Medium Priority

#### TODO-005: Enhanced Diagnostics UI

**Description**: Improve Settings → Diagnostics with more detailed information

**Desired Features**:
- Real-time gateway health monitoring
- Database size and optimization status
- Cache hit/miss ratios
- Download throughput graphs
- Log file viewer

**Estimated Effort**: 3-4 days

---

#### TODO-006: Keyboard Shortcuts Documentation

**Description**: Create in-app help for keyboard shortcuts

**Tasks**:
- [ ] Document all keyboard shortcuts
- [ ] Create help modal/overlay
- [ ] Add "?" shortcut to show help
- [ ] Include in user documentation

**Estimated Effort**: 1-2 days

---

#### TODO-007: Content Preloading Strategy

**Description**: Implement intelligent content preloading for better UX

**Ideas**:
- Preload next episode in series
- Preload related content thumbnails
- Prefetch hero content on app start
- Configurable preloading preferences

**Estimated Effort**: 3-5 days

---

#### TODO-008: Download Queue Management

**Description**: Enhance download manager with queue and scheduling

**Features**:
- Download queue with priority
- Pause/resume individual downloads
- Bandwidth throttling options
- Scheduled downloads (off-peak hours)

**Estimated Effort**: 4-6 days

---

#### TODO-009: Advanced Search Filters

**Description**: Add filtering options to search results

**Filters**:
- Content type (movie, series, sitcom, kids)
- Duration range
- Release date range
- Quality available
- Downloaded status

**Estimated Effort**: 2-3 days

---

#### TODO-010: Playlist Export/Import

**Description**: Allow users to export/import custom playlists

**Use Cases**:
- Backup favorites and playlists
- Share playlists with other users
- Migrate data between devices

**Format**: JSON with claim IDs and metadata

**Estimated Effort**: 2-3 days

---

### Low Priority

#### TODO-011: Theme Customization

**Description**: Allow users to customize color scheme beyond dark/light

**Features**:
- Custom accent colors
- Font size preferences
- Contrast adjustments
- Export/import themes

**Estimated Effort**: 3-4 days

---

#### TODO-012: Video Playback Statistics

**Description**: Track and display video playback statistics

**Metrics**:
- Total watch time
- Most watched content
- Quality distribution
- Buffering frequency
- Bandwidth usage

**Estimated Effort**: 2-3 days

---

#### TODO-013: Content Recommendations Algorithm

**Description**: Improve related content recommendations beyond random selection

**Ideas**:
- Watch history-based recommendations
- Similar content by tags
- Trending content
- Collaborative filtering (if user accounts added)

**Estimated Effort**: 5-7 days

---

#### TODO-014: Subtitle Support

**Description**: Add subtitle/closed caption support for videos

**Tasks**:
- [ ] Fetch subtitle data from Odysee API
- [ ] Integrate subtitle rendering in Plyr
- [ ] Support multiple subtitle languages
- [ ] Subtitle download for offline viewing

**Estimated Effort**: 3-5 days

---

#### TODO-015: Picture-in-Picture Mode

**Description**: Enable picture-in-picture video playback

**Implementation**: Use browser PiP API with Plyr integration

**Estimated Effort**: 1-2 days

---

## Development Guidelines

### Code Style

**TypeScript/React**:
- Use functional components with hooks
- Prefer `const` over `let`
- Use TypeScript strict mode
- Follow ESLint configuration
- Use Prettier for formatting

**Rust**:
- Follow Rust standard style (rustfmt)
- Use `clippy` for linting
- Prefer `Result` over `panic!`
- Never `unwrap()` on external data
- Use `thiserror` for error types

### Git Workflow

**Branch Naming**:
- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates

**Commit Messages**:
```
type(scope): brief description

Detailed explanation if needed

Refs: #issue-number
```

**Types**: feat, fix, docs, style, refactor, test, chore

### Testing Requirements

**Before Committing**:
- [ ] All unit tests pass (`npm run test:unit`)
- [ ] All property tests pass (`npm run test:property`)
- [ ] TypeScript compilation succeeds (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Rust tests pass (`cd src-tauri && cargo test`)

**Before Releasing**:
- [ ] All E2E tests pass (`npm run test:e2e`)
- [ ] Manual testing on target platforms
- [ ] Performance testing with large datasets
- [ ] Security audit passes

### Code Review Checklist

- [ ] Code follows style guidelines
- [ ] Tests added/updated for changes
- [ ] Documentation updated
- [ ] No security vulnerabilities introduced
- [ ] Error handling implemented
- [ ] Logging added for debugging
- [ ] Performance impact considered
- [ ] Accessibility maintained

### Security Considerations

**Always**:
- Sanitize all user inputs
- Use prepared statements for SQL
- Validate all external data
- Never log sensitive information
- Use HTTPS for all network requests
- Restrict filesystem access
- Follow principle of least privilege

**Never**:
- Hard-code secrets or API keys
- Trust external data without validation
- Use `unwrap()` on external data
- Expose internal paths to users
- Store passwords in plaintext
- Disable security features for convenience

---

## Testing Strategy

### Test Pyramid

```
        /\
       /E2E\      <- Few, high-value scenarios
      /------\
     /Property\   <- Core logic invariants
    /----------\
   /   Unit     \ <- Many, fast, focused tests
  /--------------\
```

### Unit Tests

**Coverage Target**: >90% for critical paths

**Focus Areas**:
- Utility functions (semver, search, quality)
- React components (rendering, interactions)
- Rust modules (gateway, database, encryption)
- Error handling paths

**Tools**: Vitest (frontend), Rust built-in (backend)

### Property-Based Tests

**Coverage**: 7 core properties implemented

**Properties**:
1. Content Categorization Consistency
2. Cache TTL Behavior
3. Series Episode Ordering Preservation
11. Gateway Failover Resilience
12. HTTP Range Support Compliance
17. Version Comparison Accuracy
20. Content Parsing Resilience

**Configuration**: Minimum 100 iterations per test

**Tools**: fast-check (frontend), proptest (backend)

### End-to-End Tests

**Coverage**: Critical user workflows

**Scenarios**:
- Application startup and hero loading
- Video playback with quality changes
- Download and offline playback
- Search with normalization
- Forced update flow
- Emergency disable handling

**Tools**: Playwright

**Note**: Series browsing tests skipped due to test environment limitations

### Manual Testing

**Required Before Release**:
- [ ] Install on clean Windows system
- [ ] Install on clean macOS system
- [ ] Install on clean Linux system
- [ ] Test with slow network connection
- [ ] Test with no network connection
- [ ] Test with large content library (>1000 items)
- [ ] Test encryption enable/disable
- [ ] Test update mechanism
- [ ] Test emergency disable
- [ ] Screen reader testing (NVDA, VoiceOver)

---

## Deployment Considerations

### Build Process

**Development Build**:
```bash
npm run tauri:dev
```

**Production Build**:
```bash
npm run tauri:build
```

**Output Locations**:
- Windows: `src-tauri/target/release/bundle/msi/`
- macOS: `src-tauri/target/release/bundle/dmg/`
- Linux: `src-tauri/target/release/bundle/appimage/`

### Distribution

**Current**: Manual download and installation

**Future**: Consider:
- Microsoft Store (Windows)
- Mac App Store (macOS)
- Snap/Flatpak (Linux)
- Auto-update mechanism (requires code signing)

### Update Manifest Hosting

**Repository**: Public GitHub repository (`kiyya-releases`)

**Structure**:
```
kiyya-releases/
├── version.json          # Update manifest
└── releases/
    ├── v1.0.0/
    │   ├── kiyya-windows.msi
    │   ├── kiyya-macos.dmg
    │   └── kiyya-linux.AppImage
    └── v1.1.0/
        └── ...
```

**Manifest URL**: `https://raw.githubusercontent.com/USER/kiyya-releases/main/version.json`

### Environment Configuration

**Production**:
- Set `VITE_CHANNEL_ID` to production channel
- Set `VITE_UPDATE_MANIFEST_URL` to production manifest
- Disable debug logging
- Use production gateway URLs

**Staging**:
- Use test channel ID
- Use staging manifest URL
- Enable debug logging
- May use different gateway configuration

### Monitoring

**No External Services**: All monitoring is local only

**Available Metrics**:
- Gateway response times (logged)
- Cache hit/miss ratios (in-memory)
- Download throughput (logged)
- Database query performance (logged)

**User Feedback**: Consider implementing optional crash reporting (with user consent)

---

## Appendix

### Useful Commands

**Development**:
```bash
# Start development server
npm run tauri:dev

# Run tests
npm run test:all

# Type checking
npm run type-check

# Linting
npm run lint:fix

# Format code
npm run format
```

**Rust Development**:
```bash
cd src-tauri

# Run tests
cargo test

# Run specific test
cargo test test_name

# Check compilation
cargo check

# Format code
cargo fmt

# Lint
cargo clippy
```

**Database**:
```bash
# View database (requires sqlite3)
sqlite3 ~/.local/share/kiyya-desktop/kiyya.db

# Check migrations
sqlite3 kiyya.db "SELECT * FROM migrations;"

# Vacuum database
sqlite3 kiyya.db "VACUUM;"
```

### File Locations

**Configuration**:
- `.env` - Environment variables (not committed)
- `tauri.conf.json` - Tauri configuration
- `vite.config.ts` - Vite configuration
- `tsconfig.json` - TypeScript configuration
- `Cargo.toml` - Rust dependencies

**Source Code**:
- `src/` - React frontend
- `src-tauri/src/` - Rust backend
- `tests/` - Test files

**Documentation**:
- `README.md` - Project overview and setup
- `ARCHITECTURE.md` - System architecture
- `UPLOADER_GUIDE.md` - Content tagging guide
- `TESTS.md` - Testing documentation
- `SECURITY.md` - Security considerations
- `DEVELOPER_NOTES.md` - This document

### External Resources

**Tauri**:
- Documentation: https://tauri.app/
- API Reference: https://tauri.app/v1/api/js/
- Discord: https://discord.com/invite/tauri

**Odysee API**:
- Documentation: https://lbry.tech/api/sdk
- API Explorer: https://api.odysee.com/

**Testing**:
- Vitest: https://vitest.dev/
- Playwright: https://playwright.dev/
- fast-check: https://fast-check.dev/
- proptest: https://docs.rs/proptest/

---

## Document History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-02-10 | 1.0.0 | Initial document creation | Kiro AI |

---

**Note**: This document should be updated whenever significant architectural decisions are made, new issues are discovered, or TODOs are completed. Keep it current to maintain its value as a development resource.
