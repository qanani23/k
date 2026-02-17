# Kiyya Desktop Streaming Application

A modern desktop streaming application built with Tauri, React, and TypeScript. Kiyya provides access to content from a single Odysee channel with local caching, offline downloads, and a cinematic user experience.

## Features

- **Single Channel Content**: Access content from one configured Odysee channel
- **Offline Downloads**: Download videos for offline viewing with optional encryption
- **Smart Quality Selection**: Automatic quality selection based on network conditions
- **Gateway Failover**: Resilient API access with multiple gateway endpoints
- **Local HTTP Streaming**: Range-supporting local server for offline content
- **Series Management**: Organized series content with season/episode structure
- **Search & Discovery**: Powerful search with query normalization
- **Favorites & Progress**: Track favorites and resume playback
- **Update System**: Automatic update checking with forced/optional updates
- **Accessibility**: Full keyboard navigation and screen reader support
- **Glass Aurora UI**: Modern design with dark/light theme support

## Technology Stack

- **Backend**: Tauri (Rust) with reqwest, rusqlite, warp
- **Frontend**: Vite + React + TypeScript + Tailwind CSS
- **Video**: Plyr wrapper with hls.js fallback
- **Database**: SQLite for local data persistence
- **Testing**: Vitest (unit), Playwright (E2E)

## Quick Start

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 18+** and **npm** - [Download Node.js](https://nodejs.org/)
- **Rust 1.70+** - [Install Rust](https://www.rust-lang.org/tools/install)
- **Tauri CLI** - Will be installed via npm dependencies
- **Platform-specific dependencies**:
  - **Windows**: Microsoft Visual Studio C++ Build Tools
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: See [Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd kiyya-desktop
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```
   
   This will install all frontend dependencies and the Tauri CLI.

3. **Install Rust dependencies**
   ```bash
   cd src-tauri
   cargo fetch
   cd ..
   ```
   
   This pre-downloads all Rust crates for faster builds.

4. **Configure environment variables**
   
   The `.env` file is already configured with default values. Update it with your specific settings:
   
   ```bash
   # Edit .env with your preferred text editor
   nano .env  # or code .env, vim .env, etc.
   ```
   
   **Required changes:**
   - `VITE_CHANNEL_ID` - Set to your Odysee channel (e.g., `@YourChannel:a`)
   - `CHANNEL_ID` - Same as above (for Rust backend)
   - `VITE_UPDATE_MANIFEST_URL` - Set to your update manifest URL
   - `VITE_TELEGRAM_LINK` - Set to your community link (optional)

5. **Verify installation**
   ```bash
   npm run type-check
   npm run validate-config
   npm run validate-tauri
   ```
   
   All commands should complete without errors.

6. **Run in development mode**
   ```bash
   npm run tauri:dev
   ```
   
   This will:
   - Start the Vite development server
   - Compile the Rust backend
   - Launch the application window
   - Enable hot-reload for frontend changes

### First Run

On first launch, the application will:
1. Initialize the SQLite database
2. Run database migrations
3. Create the vault directory for downloads
4. Fetch initial content from the configured channel
5. Check for application updates

If you encounter issues, check the [Troubleshooting](#troubleshooting) section.

### Environment Configuration

The `.env` file contains all configuration options for the application. Below are the key settings you should review:

#### Required Settings

```env
# Odysee Channel Configuration
VITE_CHANNEL_ID=@YourChannelName:a
CHANNEL_ID=@YourChannelName:a

# Update System (must point to public GitHub repository)
VITE_UPDATE_MANIFEST_URL=https://raw.githubusercontent.com/YOURNAME/kiyya-releases/main/version.json
```

#### Optional Settings

```env
# Application Metadata
APP_NAME=Kiyya
VITE_APP_NAME=Kiyya
APP_VERSION=1.0.0
VITE_APP_VERSION=1.0.0

# External Links
VITE_TELEGRAM_LINK=https://t.me/YourChannel

# Cache Configuration
VITE_CACHE_TTL_MS=1800000              # 30 minutes
VITE_MAX_CACHE_ITEMS=200

# Gateway Configuration (comma-separated fallback gateways)
VITE_GATEWAY_FALLBACKS=https://api.lbry.tv/api/v1/proxy,https://api.odysee.com/api/v1/proxy

# CDN Gateway Configuration (Backend)
ODYSEE_CDN_GATEWAY=https://cloud.odysee.live  # CDN gateway for video playback URLs
                                               # Must use HTTPS protocol
                                               # Trailing slashes are automatically removed
                                               # Falls back to default if invalid

# Security Settings
VITE_DEFAULT_ENCRYPT_DOWNLOADS=false   # Enable encryption by default
VITE_NETWORK_TIMEOUT_MS=10000          # 10 seconds
VITE_MAX_RETRY_ATTEMPTS=3

# UI Configuration
VITE_DEFAULT_THEME=dark                # dark or light
VITE_ENABLE_ANIMATIONS=true            # Disable for accessibility
VITE_DEFAULT_VIDEO_QUALITY=auto        # 480p, 720p, 1080p, or auto
VITE_AUTO_UPGRADE_QUALITY=true

# Download Configuration
VITE_VAULT_DIRECTORY_NAME=vault
VITE_MIN_DISK_SPACE_BUFFER=209715200   # 200MB minimum free space

# Development Settings
TAURI_DEBUG=true                       # Enable debug logging
VITE_LOG_LEVEL=info                    # error, warn, info, debug, trace
```

#### Environment Variable Naming

- **VITE_*** variables are available in the frontend (React)
- Variables without **VITE_** prefix are available in the backend (Rust)
- Some settings require both versions (e.g., `CHANNEL_ID` and `VITE_CHANNEL_ID`)

#### Validation

After editing `.env`, validate your configuration:

```bash
npm run validate-config
```

This checks for:
- Required environment variables
- Valid URL formats
- Proper channel ID format
- Version number consistency

## Development

### Development Workflow

1. **Start development server**
   ```bash
   npm run tauri:dev
   ```
   
   This enables:
   - Hot module replacement (HMR) for React components
   - Automatic Rust recompilation on changes
   - DevTools access (F12 or Cmd+Option+I)

2. **Run tests during development**
   ```bash
   npm run test:watch        # Watch mode for unit tests
   npm run test:unit         # Run unit tests once
   npm run test:property     # Run property-based tests
   ```

3. **Check code quality**
   ```bash
   npm run lint              # Check for linting issues
   npm run lint:fix          # Auto-fix linting issues
   npm run type-check        # TypeScript type checking
   npm run format:check      # Check code formatting
   npm run format            # Auto-format code
   ```

4. **Validate configuration**
   ```bash
   npm run validate-config   # Validate .env configuration
   npm run validate-tauri    # Validate Tauri security settings
   ```

### Available Scripts

#### Development
- `npm run dev` - Start Vite dev server only (frontend)
- `npm run tauri:dev` - Start full Tauri development mode (recommended)
- `npm run preview` - Preview production build locally

#### Building
- `npm run build` - Build frontend only
- `npm run tauri:build` - Build complete application with installers

#### Testing
- `npm run test` - Run all unit tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:unit` - Run unit tests only
- `npm run test:property` - Run property-based tests only
- `npm run test:e2e` - Run end-to-end tests with Playwright
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:all` - Run all test suites (unit + property + E2E)
- `npm run test:a11y` - Run accessibility tests only

#### Code Quality
- `npm run lint` - Check for ESLint issues
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run type-check` - Run TypeScript type checking

#### Validation
- `npm run validate-config` - Validate environment configuration
- `npm run validate-tauri` - Validate Tauri security configuration
- `npm run security:audit` - Run npm security audit

#### Documentation
- `npm run docs:validate` - Validate documentation (placeholder)
- `npm run analyze` - Analyze bundle size (placeholder)

### Project Structure

```
kiyya-desktop/
├── src/                          # Frontend source code
│   ├── components/               # React components
│   │   ├── Hero.tsx             # Hero section with trailers
│   │   ├── NavBar.tsx           # Navigation bar
│   │   ├── MovieCard.tsx        # Content card component
│   │   ├── PlayerModal.tsx      # Video player modal
│   │   ├── RowCarousel.tsx      # Horizontal content carousel
│   │   └── ...                  # Other UI components
│   ├── pages/                   # Page components
│   │   ├── Home.tsx             # Homepage with hero and rows
│   │   ├── MoviesPage.tsx       # Movies category page
│   │   ├── SeriesPage.tsx       # Series category page
│   │   ├── Search.tsx           # Search page
│   │   ├── MovieDetail.tsx      # Movie detail page
│   │   ├── SeriesDetail.tsx     # Series detail page
│   │   ├── DownloadsPage.tsx    # Downloads management
│   │   ├── FavoritesPage.tsx    # Favorites collection
│   │   └── SettingsPage.tsx     # Settings and diagnostics
│   ├── hooks/                   # Custom React hooks
│   │   ├── useContent.ts        # Content fetching hook
│   │   ├── useDownloadManager.ts # Download management hook
│   │   ├── useDebouncedSearch.ts # Search debouncing hook
│   │   ├── useUpdateChecker.ts  # Update checking hook
│   │   └── ...                  # Other custom hooks
│   ├── lib/                     # Utility libraries
│   │   ├── api.ts               # Tauri API wrapper
│   │   ├── quality.ts           # Quality selection logic
│   │   ├── semver.ts            # Version comparison
│   │   ├── search.ts            # Search normalization
│   │   ├── series.ts            # Series parsing logic
│   │   ├── storage.ts           # Local storage utilities
│   │   └── ...                  # Other utilities
│   ├── config/                  # Configuration files
│   │   └── categories.ts        # Content categories config
│   ├── types/                   # TypeScript type definitions
│   │   └── index.ts             # Shared type definitions
│   ├── App.tsx                  # Root application component
│   ├── main.tsx                 # Application entry point
│   └── index.css                # Global styles
├── src-tauri/                   # Rust backend
│   ├── src/                     # Rust source code
│   │   ├── main.rs              # Application entry point
│   │   ├── commands.rs          # Tauri command handlers
│   │   ├── database.rs          # Database management
│   │   ├── migrations.rs        # Database migrations
│   │   ├── gateway.rs           # Gateway client with failover
│   │   ├── download.rs          # Download manager
│   │   ├── server.rs            # Local HTTP server
│   │   ├── encryption.rs        # Encryption utilities
│   │   ├── models.rs            # Data models
│   │   ├── error.rs             # Error types
│   │   ├── validation.rs        # Input validation
│   │   ├── sanitization.rs      # SQL sanitization
│   │   ├── logging.rs           # Logging configuration
│   │   └── *_test.rs            # Rust test files
│   ├── icons/                   # Application icons
│   ├── Cargo.toml               # Rust dependencies
│   ├── tauri.conf.json          # Tauri configuration
│   └── build.rs                 # Build script
├── tests/                       # Test files
│   ├── unit/                    # Unit tests
│   │   ├── api.test.ts          # API wrapper tests
│   │   ├── semver.test.ts       # Version comparison tests
│   │   ├── quality.test.ts      # Quality selection tests
│   │   ├── search.test.ts       # Search normalization tests
│   │   ├── series.test.ts       # Series parsing tests
│   │   └── ...                  # Component tests
│   ├── property/                # Property-based tests
│   │   ├── categorization.property.test.ts
│   │   ├── series.ordering.property.test.ts
│   │   ├── semver.property.test.ts
│   │   └── ...                  # Other property tests
│   └── e2e/                     # End-to-end tests
│       └── app.spec.ts          # E2E test scenarios
├── scripts/                     # Build and validation scripts
│   ├── validate-config.js       # Environment validation
│   └── validate-tauri-config.js # Tauri config validation
├── .env                         # Environment configuration
├── package.json                 # Node.js dependencies
├── tsconfig.json                # TypeScript configuration
├── vite.config.ts               # Vite configuration
├── tailwind.config.js           # Tailwind CSS configuration
├── playwright.config.ts         # Playwright configuration
└── README.md                    # This file
```

### Key Directories

- **src/components/** - Reusable UI components following atomic design principles
- **src/pages/** - Full page components mapped to routes
- **src/hooks/** - Custom React hooks for state management and side effects
- **src/lib/** - Pure utility functions and business logic
- **src-tauri/src/** - Rust backend with Tauri commands and core functionality
- **tests/** - Comprehensive test suite with unit, property, and E2E tests

### Database Schema

The application uses SQLite with the following main tables:

#### Core Tables

**favorites** - User favorite content
```sql
CREATE TABLE favorites (
  claimId TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  thumbnailUrl TEXT,
  insertedAt INTEGER NOT NULL
);
```

**progress** - Video playback progress
```sql
CREATE TABLE progress (
  claimId TEXT PRIMARY KEY,
  positionSeconds INTEGER NOT NULL,
  quality TEXT NOT NULL,
  updatedAt INTEGER NOT NULL
);
```

**offline_meta** - Downloaded content metadata
```sql
CREATE TABLE offline_meta (
  claimId TEXT NOT NULL,
  quality TEXT NOT NULL,
  filename TEXT NOT NULL,
  fileSize INTEGER NOT NULL,
  encrypted BOOLEAN DEFAULT FALSE,
  addedAt INTEGER NOT NULL,
  PRIMARY KEY (claimId, quality)
);
```

**local_cache** - Content metadata cache
```sql
CREATE TABLE local_cache (
  claimId TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  titleLower TEXT NOT NULL,
  description TEXT,
  descriptionLower TEXT,
  tags TEXT NOT NULL,
  thumbnailUrl TEXT,
  videoUrls TEXT NOT NULL,
  compatibility TEXT NOT NULL,
  updatedAt INTEGER NOT NULL
);
```

**playlists** - Series playlist information
```sql
CREATE TABLE playlists (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  claimId TEXT NOT NULL,
  seasonNumber INTEGER,
  seriesKey TEXT,
  updatedAt INTEGER NOT NULL
);
```

**playlist_items** - Playlist episode ordering
```sql
CREATE TABLE playlist_items (
  playlistId TEXT NOT NULL,
  claimId TEXT NOT NULL,
  position INTEGER NOT NULL,
  episodeNumber INTEGER,
  seasonNumber INTEGER,
  PRIMARY KEY (playlistId, claimId),
  FOREIGN KEY (playlistId) REFERENCES playlists(id)
);
```

**migrations** - Database migration tracking
```sql
CREATE TABLE migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
```

#### Database Migrations

Migrations are automatically applied on application startup. Migration files are located in `src-tauri/src/migrations.rs`.

To add a new migration:
1. Add migration SQL to the migrations array in `migrations.rs`
2. Increment the migration version number
3. Test with an older database to ensure backward compatibility

#### Database Location

- **Windows**: `%APPDATA%/Kiyya/kiyya.db`
- **macOS**: `~/Library/Application Support/Kiyya/kiyya.db`
- **Linux**: `~/.local/share/Kiyya/kiyya.db`

## Building for Production

### Prerequisites for Building

Before building for production, ensure:
- All tests pass: `npm run test:all`
- Code is properly formatted: `npm run format:check`
- No linting errors: `npm run lint`
- Configuration is valid: `npm run validate-config && npm run validate-tauri`
- Version numbers are consistent across:
  - `.env` (APP_VERSION and VITE_APP_VERSION)
  - `package.json` (version)
  - `src-tauri/tauri.conf.json` (version)
  - `src-tauri/Cargo.toml` (version)

### Build Application

```bash
npm run tauri:build
```

This command will:
1. Run TypeScript compilation
2. Build optimized frontend bundle with Vite
3. Compile Rust backend in release mode
4. Create platform-specific installers

Build artifacts are created in `src-tauri/target/release/bundle/`:

#### Windows
- `kiyya_1.0.0_x64-setup.exe` - NSIS installer
- `kiyya_1.0.0_x64.msi` - MSI installer (if configured)

#### macOS
- `Kiyya.app` - Application bundle
- `Kiyya_1.0.0_x64.dmg` - DMG installer
- `Kiyya_1.0.0_aarch64.dmg` - Apple Silicon DMG

#### Linux
- `kiyya_1.0.0_amd64.deb` - Debian package
- `kiyya_1.0.0_amd64.rpm` - RPM package (if configured)
- `kiyya_1.0.0_amd64.AppImage` - AppImage (if configured)

### Release Automation

Kiyya Desktop includes automated release scripts to streamline the release process:

```bash
# Prepare a new release (validates, bumps version, creates tag)
npm run release:prepare -- 1.1.0

# Create GitHub release with artifacts
npm run release:create -- v1.1.0

# Generate version manifest for update system
npm run release:manifest -- 1.1.0
```

For detailed instructions, see:
- [RELEASE_AUTOMATION.md](RELEASE_AUTOMATION.md) - Complete automation guide
- [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) - Release checklist
- [scripts/README.md](scripts/README.md) - Scripts documentation

### Build Configuration

Edit `src-tauri/tauri.conf.json` to customize build settings:

```json
{
  "bundle": {
    "identifier": "com.kiyya.app",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "active": true,
    "targets": ["nsis", "msi", "dmg", "deb", "appimage"],
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": ""
    }
  }
}
```

### Code Signing

For production releases, code signing is **strongly recommended** to avoid security warnings.

#### Windows Code Signing

**Requirements:**
- Code signing certificate (.pfx or .p12 file)
- Certificate password
- SignTool (included with Windows SDK)

**Signing command:**
```bash
signtool sign /f certificate.p12 /p YOUR_PASSWORD /fd sha256 /tr http://timestamp.digicert.com /td sha256 kiyya_1.0.0_x64-setup.exe
```

**Automated signing in Tauri:**
Edit `src-tauri/tauri.conf.json`:
```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "YOUR_CERT_THUMBPRINT",
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  }
}
```

#### macOS Code Signing

**Requirements:**
- Apple Developer account
- Developer ID Application certificate
- Xcode Command Line Tools

**Signing command:**
```bash
# Sign the application
codesign --force --options runtime --deep --sign "Developer ID Application: Your Name (TEAM_ID)" Kiyya.app

# Create signed DMG
hdiutil create -volname "Kiyya" -srcfolder Kiyya.app -ov -format UDZO Kiyya.dmg
codesign --force --sign "Developer ID Application: Your Name (TEAM_ID)" Kiyya.dmg
```

**Notarization (required for macOS 10.15+):**
```bash
# Submit for notarization
xcrun notarytool submit Kiyya.dmg --keychain-profile "notarytool-profile" --wait

# Staple notarization ticket
xcrun stapler staple Kiyya.dmg
```

**Setup notarization profile:**
```bash
xcrun notarytool store-credentials "notarytool-profile" \
  --apple-id "your@email.com" \
  --team-id "TEAM_ID" \
  --password "app-specific-password"
```

#### Linux Code Signing

Linux packages typically don't require code signing, but you can sign packages for verification:

**Debian packages:**
```bash
dpkg-sig --sign builder kiyya_1.0.0_amd64.deb
```

**RPM packages:**
```bash
rpm --addsign kiyya_1.0.0_amd64.rpm
```

### Build Optimization

For smaller bundle sizes and better performance:

1. **Enable production optimizations in Vite:**
   ```typescript
   // vite.config.ts
   export default defineConfig({
     build: {
       minify: 'terser',
       terserOptions: {
         compress: {
           drop_console: true,
         },
       },
     },
   });
   ```

2. **Optimize Rust binary:**
   ```toml
   # src-tauri/Cargo.toml
   [profile.release]
   opt-level = "z"     # Optimize for size
   lto = true          # Enable Link Time Optimization
   codegen-units = 1   # Better optimization
   strip = true        # Strip symbols
   ```

3. **Analyze bundle size:**
   ```bash
   npm run build
   npm run analyze
   ```

## Release Process

### Version Management

Kiyya uses semantic versioning (MAJOR.MINOR.PATCH). Before releasing:

1. **Determine version number**
   - MAJOR: Breaking changes or major new features
   - MINOR: New features, backward compatible
   - PATCH: Bug fixes, backward compatible

2. **Update version numbers in all files**
   ```bash
   # Update these files with the new version:
   # - .env (APP_VERSION and VITE_APP_VERSION)
   # - package.json (version)
   # - src-tauri/tauri.conf.json (version)
   # - src-tauri/Cargo.toml (version)
   ```

3. **Verify version consistency**
   ```bash
   npm run validate-config
   ```

### Release Checklist

- [ ] All tests pass: `npm run test:all`
- [ ] Code is formatted: `npm run format`
- [ ] No linting errors: `npm run lint`
- [ ] Version numbers updated and consistent
- [ ] CHANGELOG.md updated with release notes
- [ ] Security audit clean: `npm run security:audit`
- [ ] Configuration validated: `npm run validate-config && npm run validate-tauri`

### Build and Release Steps

1. **Create release branch**
   ```bash
   git checkout -b release/v1.0.1
   ```

2. **Update version numbers**
   ```bash
   # Edit .env, package.json, tauri.conf.json, Cargo.toml
   # Update CHANGELOG.md with release notes
   ```

3. **Commit version changes**
   ```bash
   git add .
   git commit -m "chore: bump version to 1.0.1"
   git push origin release/v1.0.1
   ```

4. **Build application**
   ```bash
   npm run tauri:build
   ```

5. **Test the built application**
   - Install on clean system
   - Verify all features work
   - Test update mechanism
   - Check for any runtime errors

6. **Sign the installers** (see [Code Signing](#code-signing) section)

7. **Create GitHub release in `kiyya-releases` repository**
   ```bash
   # Go to https://github.com/YOURNAME/kiyya-releases
   # Click "Create a new release"
   # Tag: v1.0.1
   # Title: Kiyya v1.0.1
   # Description: Copy from CHANGELOG.md
   ```

8. **Upload installers as release assets**
   - Upload all platform-specific installers
   - Include checksums file (SHA256)

9. **Update version manifest**
   
   Edit `version.json` in `kiyya-releases` repository:
   ```json
   {
     "latestVersion": "1.0.1",
     "minSupportedVersion": "1.0.0",
     "releaseNotes": "• Bug fixes and improvements\n• New feature X\n• Performance enhancements",
     "downloadUrl": "https://github.com/YOURNAME/kiyya-releases/releases/latest",
     "checksums": {
       "windows": "sha256_hash_here",
       "macos": "sha256_hash_here",
       "linux": "sha256_hash_here"
     }
   }
   ```

10. **Commit and push version manifest**
    ```bash
    git add version.json
    git commit -m "Update version manifest to 1.0.1"
    git push origin main
    ```

11. **Merge release branch**
    ```bash
    git checkout main
    git merge release/v1.0.1
    git tag v1.0.1
    git push origin main --tags
    ```

12. **Verify update mechanism**
    - Launch older version of app
    - Verify update notification appears
    - Test update flow

### Emergency Disable

If a critical issue is discovered after release, you can disable the application remotely:

1. **Update version manifest with emergency disable**
   ```json
   {
     "latestVersion": "1.0.1",
     "minSupportedVersion": "1.0.2",
     "emergencyDisable": true,
     "releaseNotes": "Critical security update required. Please update immediately.",
     "downloadUrl": "https://github.com/YOURNAME/kiyya-releases/releases/latest"
   }
   ```

2. **Push the updated manifest**
   ```bash
   git add version.json
   git commit -m "Emergency disable for version 1.0.1"
   git push origin main
   ```

3. **Release fixed version immediately**
   - Follow normal release process with version 1.0.2
   - Update manifest to remove `emergencyDisable` flag

### Generating Checksums

Generate SHA256 checksums for release assets:

**Windows:**
```bash
certutil -hashfile kiyya_1.0.0_x64-setup.exe SHA256
```

**macOS/Linux:**
```bash
shasum -a 256 Kiyya_1.0.0_x64.dmg
```

**Create checksums file:**
```bash
# checksums.txt
sha256_hash_here  kiyya_1.0.0_x64-setup.exe
sha256_hash_here  Kiyya_1.0.0_x64.dmg
sha256_hash_here  kiyya_1.0.0_amd64.deb
```

### Release Repository Structure

The `kiyya-releases` repository should have this structure:

```
kiyya-releases/
├── version.json              # Version manifest (required)
├── README.md                 # Installation instructions
└── .github/
    └── workflows/
        └── release.yml       # Automated release workflow (optional)
```

**Important:** The `kiyya-releases` repository must be **public** for the update manifest to be accessible without authentication.

## Testing

### Test Suite Overview

Kiyya includes a comprehensive test suite with three types of tests:
- **Unit Tests**: Test individual functions and components
- **Property-Based Tests**: Verify universal properties across all inputs
- **End-to-End Tests**: Test complete user workflows

### Running Tests

#### All Tests
```bash
npm run test:all
```
Runs unit tests, property-based tests, and E2E tests sequentially.

#### Unit Tests

Run all unit tests:
```bash
npm run test
# or
npm run test:unit
```

Run tests in watch mode during development:
```bash
npm run test:watch
```

Run specific test file:
```bash
npm run test tests/unit/semver.test.ts
```

Run tests with coverage:
```bash
npm run test:coverage
```

**Key unit test areas:**
- Quality selection algorithms (`tests/unit/quality.test.ts`)
- Semantic version comparison (`tests/unit/semver.test.ts`)
- Search query normalization (`tests/unit/search.test.ts`)
- Content parsing logic (`tests/unit/api.test.ts`)
- Series organization (`tests/unit/series.test.ts`)
- React components (`tests/unit/*.test.tsx`)

#### Property-Based Tests

Run all property-based tests:
```bash
npm run test:property
```

Property-based tests verify universal properties with 100+ randomized iterations:
- **Property 1**: Content Categorization Consistency
- **Property 2**: Cache TTL Behavior
- **Property 3**: Series Episode Ordering Preservation
- **Property 11**: Gateway Failover Resilience
- **Property 12**: HTTP Range Support Compliance
- **Property 17**: Version Comparison Accuracy
- **Property 20**: Content Parsing Resilience

Each property test references its corresponding design document property.

#### End-to-End Tests

Run E2E tests with Playwright:
```bash
npm run test:e2e
```

Run E2E tests in headed mode (with browser UI):
```bash
npx playwright test --headed
```

Run specific E2E test:
```bash
npx playwright test --grep "application startup"
```

**E2E test scenarios:**
- Application startup and navigation
- Hero content loading and autoplay
- Content discovery and browsing
- Series browsing with season expansion
- Video playback with quality changes
- Download functionality and progress tracking
- Search with query normalization
- Settings management and diagnostics
- Update checking (forced and optional)
- Emergency disable scenarios

#### Accessibility Tests

Run accessibility-specific tests:
```bash
npm run test:a11y
```

Tests keyboard navigation, ARIA labels, screen reader compatibility, and focus management.

### Rust Backend Tests

Run Rust unit tests:
```bash
cd src-tauri
cargo test
```

Run specific Rust test:
```bash
cd src-tauri
cargo test gateway::tests::test_failover
```

Run Rust tests with output:
```bash
cd src-tauri
cargo test -- --nocapture
```

**Key Rust test areas:**
- Gateway failover logic
- Database operations and migrations
- HTTP Range header parsing
- Content parsing and validation
- Encryption/decryption round trips
- Input sanitization and validation

### Test Configuration

#### Vitest Configuration

Edit `vite.config.ts` to modify test settings:
```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', 'src/test/'],
    },
  },
});
```

#### Playwright Configuration

Edit `playwright.config.ts` to modify E2E test settings:
```typescript
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 2,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
```

### Writing Tests

#### Unit Test Example
```typescript
import { describe, it, expect } from 'vitest';
import { compareVersions } from '../lib/semver';

describe('semver comparison', () => {
  it('should correctly compare semantic versions', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });
});
```

#### Property-Based Test Example
```typescript
import { describe, it } from 'vitest';
import fc from 'fast-check';

describe('Property 17: Version Comparison Accuracy', () => {
  it('should maintain transitivity in version comparisons', () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.semver(), fc.semver(), fc.semver()),
        ([a, b, c]) => {
          const ab = compareVersions(a, b);
          const bc = compareVersions(b, c);
          const ac = compareVersions(a, c);
          
          // If a < b and b < c, then a < c
          if (ab < 0 && bc < 0) {
            return ac < 0;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

#### E2E Test Example
```typescript
import { test, expect } from '@playwright/test';

test('application startup', async ({ page }) => {
  await page.goto('/');
  
  // Verify hero section loads
  await expect(page.locator('[data-testid="hero"]')).toBeVisible();
  
  // Verify navigation bar
  await expect(page.locator('nav')).toBeVisible();
  
  // Verify content rows
  await expect(page.locator('[data-testid="content-row"]')).toHaveCount(4);
});
```

### Continuous Integration

The test suite is designed to run in CI environments:

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run test:unit
      - run: npm run test:property
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
```

### Test Coverage Goals

- **Unit Tests**: >90% coverage for utility functions
- **Property Tests**: 100+ iterations per property
- **E2E Tests**: All critical user workflows covered
- **Accessibility Tests**: All interactive elements tested

### Debugging Tests

**Debug unit tests:**
```bash
npm run test:watch
# Add debugger statements in test files
```

**Debug E2E tests:**
```bash
npx playwright test --debug
# Opens Playwright Inspector for step-by-step debugging
```

**View test reports:**
```bash
# Unit test coverage report
npm run test:coverage
# Open coverage/index.html in browser

# E2E test report
npx playwright show-report
```

## Configuration

### Content Categories

Edit `src/config/categories.ts` to modify content categorization:

```typescript
export const CATEGORIES = {
  movies: {
    label: "Movies",
    baseTag: "movie",
    filters: [
      { label: "Comedy", tag: "comedy_movies" },
      { label: "Action", tag: "action_movies" },
      // Add more filters...
    ]
  },
  // Add more categories...
};
```

### Gateway Configuration

The application uses multiple Odysee gateways for resilience:

1. `https://api.na-backend.odysee.com/api/v1/proxy` (primary)
2. `https://api.lbry.tv/api/v1/proxy` (fallback)
3. `https://api.odysee.com/api/v1/proxy` (fallback)

Gateways can be reordered in Settings > Advanced.

## Troubleshooting

### Installation Issues

#### Node.js or npm not found
```bash
# Verify Node.js installation
node --version
npm --version

# If not installed, download from https://nodejs.org/
```

#### Rust or cargo not found
```bash
# Verify Rust installation
rustc --version
cargo --version

# If not installed, run:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

#### Tauri CLI installation fails
```bash
# Clear npm cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

#### Platform-specific build tools missing

**Windows:**
- Install Visual Studio Build Tools: https://visualstudio.microsoft.com/downloads/
- Select "Desktop development with C++" workload

**macOS:**
```bash
xcode-select --install
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev \
  build-essential \
  curl \
  wget \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

**Linux (Fedora):**
```bash
sudo dnf install webkit2gtk3-devel \
  openssl-devel \
  curl \
  wget \
  libappindicator-gtk3 \
  librsvg2-devel
```

### Runtime Issues

#### App won't start
```bash
# Check that all dependencies are installed
npm install

# Verify Rust toolchain
rustc --version

# Try cleaning and rebuilding
npm run clean  # if available
rm -rf src-tauri/target
npm run tauri:dev
```

#### Content not loading

**Check channel configuration:**
```bash
# Verify VITE_CHANNEL_ID in .env
# Format should be: @ChannelName:a (with @ prefix and claim ID)
```

**Check network connectivity:**
- Open Settings → Advanced → Diagnostics
- Check gateway health status
- Verify you can access https://odysee.com in browser

**Check logs:**
- Windows: `%APPDATA%/Kiyya/logs/`
- macOS: `~/Library/Application Support/Kiyya/logs/`
- Linux: `~/.local/share/Kiyya/logs/`

Look for errors in `app.log` and `gateway.log`.

#### Downloads failing

**Check disk space:**
```bash
# The app requires at least 200MB free space buffer
# Check available space in Settings → Advanced → Diagnostics
```

**Check vault directory permissions:**
- Windows: `%APPDATA%/Kiyya/vault/`
- macOS: `~/Library/Application Support/Kiyya/vault/`
- Linux: `~/.local/share/Kiyya/vault/`

Ensure the directory exists and is writable.

**Check download logs:**
Look for download errors in `app.log`.

#### Video playback issues

**Codec compatibility:**
- Check for compatibility warnings in the player
- Try different quality settings
- Some videos may require external player

**HLS playback fails:**
- Verify hls.js is loaded (check browser console)
- Try refreshing the page
- Check network connectivity

**Buffering issues:**
- Lower quality setting in player
- Check network speed
- Enable auto quality adjustment in Settings

**Seeking not working:**
- For online content: Server may not support Range headers
- For offline content: Check local server status in Diagnostics

### Configuration Issues

#### Environment variables not loading
```bash
# Verify .env file exists in project root
ls -la .env

# Check for syntax errors
npm run validate-config

# Restart development server
npm run tauri:dev
```

#### Invalid channel ID format
```bash
# Channel ID must include @ prefix and claim ID
# Correct: @kiyyamovies:b
# Incorrect: kiyyamovies or @kiyyamovies
```

#### Update manifest not accessible
```bash
# Verify URL is publicly accessible
curl https://raw.githubusercontent.com/YOURNAME/kiyya-releases/main/version.json

# Should return JSON without authentication
```

### Database Issues

#### Database locked error
```bash
# Close all instances of the application
# Delete database file (will be recreated):
# Windows: %APPDATA%/Kiyya/kiyya.db
# macOS: ~/Library/Application Support/Kiyya/kiyya.db
# Linux: ~/.local/share/Kiyya/kiyya.db
```

#### Migration failed
```bash
# Check logs for migration errors
# Backup database file
# Delete database to start fresh (will lose local data)
```

#### Corrupted database
```bash
# Backup current database
# Try SQLite recovery:
sqlite3 kiyya.db ".recover" | sqlite3 kiyya_recovered.db

# Or delete and recreate:
rm kiyya.db
# Restart app to recreate database
```

### Build Issues

#### TypeScript compilation errors
```bash
# Check for type errors
npm run type-check

# Update TypeScript definitions
npm install --save-dev @types/node @types/react @types/react-dom
```

#### Rust compilation errors
```bash
# Update Rust toolchain
rustup update

# Clean build artifacts
cd src-tauri
cargo clean
cd ..

# Rebuild
npm run tauri:build
```

#### Bundle size too large
```bash
# Analyze bundle
npm run build
npm run analyze

# Check for large dependencies
npx vite-bundle-visualizer
```

### Development Issues

#### Hot reload not working
```bash
# Restart development server
# Check that Vite dev server is running on correct port
# Verify tauri.conf.json devPath setting
```

#### Changes not reflecting
```bash
# For frontend changes: Check browser console for errors
# For backend changes: Restart tauri:dev (Rust requires full rebuild)
```

#### Port already in use
```bash
# Kill process using the port
# Windows:
netstat -ano | findstr :1420
taskkill /PID <PID> /F

# macOS/Linux:
lsof -ti:1420 | xargs kill -9
```

### Debug Mode

Enable debug mode for verbose logging:

```bash
# Set in .env
TAURI_DEBUG=true
VITE_LOG_LEVEL=debug

# Or run with environment variable
TAURI_DEBUG=true npm run tauri:dev
```

### Collecting Debug Information

For support or bug reports, collect debug information:

1. **Application logs:**
   - Windows: `%APPDATA%/Kiyya/logs/`
   - macOS: `~/Library/Application Support/Kiyya/logs/`
   - Linux: `~/.local/share/Kiyya/logs/`

2. **System information:**
   - Open Settings → Advanced → Diagnostics
   - Copy all diagnostic information

3. **Browser console:**
   - Open DevTools (F12)
   - Copy any error messages from Console tab

4. **Configuration:**
   ```bash
   # Sanitize and share (remove sensitive data):
   cat .env | grep -v "PASSWORD\|SECRET\|TOKEN"
   ```

### Getting Help

If you're still experiencing issues:

1. **Check existing issues:** Search GitHub Issues for similar problems
2. **Review documentation:** Check docs/ folder for detailed guides
3. **Enable debug mode:** Collect logs and diagnostic information
4. **Create issue:** Open a new GitHub Issue with:
   - Detailed description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - System information (OS, versions)
   - Relevant logs and error messages
   - Screenshots if applicable

### Common Error Messages

**"Failed to fetch content"**
- Check network connectivity
- Verify channel ID is correct
- Check gateway health in Diagnostics

**"Insufficient disk space"**
- Free up at least 200MB of disk space
- Check vault directory location

**"Database migration failed"**
- Backup and delete database file
- Restart application to recreate

**"Update manifest unavailable"**
- Check VITE_UPDATE_MANIFEST_URL in .env
- Verify URL is publicly accessible
- Check network connectivity

**"Encryption key not found"**
- Set up encryption in Settings
- Or disable encryption for downloads

**"Local server failed to start"**
- Check if port is already in use
- Verify vault directory exists and is readable
- Check logs for specific error

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests for new functionality
5. Run the test suite: `npm run test && npm run test:e2e`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Add unit tests for utility functions
- Add E2E tests for user workflows
- Use semantic commit messages
- Update documentation for new features

## Security

Kiyya implements comprehensive security measures to protect user data and system integrity:

### Network Domain Restrictions

Network access is strictly limited to approved domains only:

**Odysee API Domains:**
- `api.na-backend.odysee.com` - Primary API gateway
- `api.lbry.tv` - Secondary API gateway
- `api.odysee.com` - Fallback API gateway
- `*.odysee.com` - Odysee subdomains
- `*.lbry.tv` - LBRY subdomains

**Content Delivery Networks:**
- `thumbnails.lbry.com` - Thumbnail images
- `spee.ch` - Media hosting
- `cdn.lbryplayer.xyz` - Video player assets
- `player.odycdn.com` - Video streaming

**Update System:**
- `raw.githubusercontent.com` - Application update manifest

All network requests outside these domains are blocked by Tauri's security layer.

### Filesystem Restrictions

- File system access is limited to `$APPDATA/Kiyya/**` only
- No access to user documents, desktop, or system directories
- Downloaded content stored in encrypted vault within app data

### Additional Security Measures

- No API tokens or secrets embedded in the application
- Optional AES-GCM encryption for downloaded content
- Secure key management using OS keystore
- Content Security Policy (CSP) enforced for frontend
- All allowlists explicitly configured (no wildcard permissions)

### Validation

Run security validation checks:

```bash
npm run validate-tauri    # Validate Tauri security configuration
npm test tests/unit/tauri-config.test.ts  # Run security tests
```

For more details, see [SECURITY.md](SECURITY.md).

## License

This project is licensed under the MIT License.

## Documentation

Comprehensive documentation is available in the following files:

### Core Documentation

- **README.md** (this file) - Setup, installation, and quick start guide
- **ARCHITECTURE.md** - System architecture, component diagrams, and data flow
- **UPLOADER_GUIDE.md** - Content tagging rules and conventions for Odysee uploaders
- **TESTS.md** - Testing strategy, test commands, and CI guidance
- **DEVELOPER_NOTES.md** - Development constraints, known limitations, and technical decisions

### Additional Documentation

- **SECURITY.md** - Security requirements and validation procedures
- **CHANGELOG.md** - Version history and release notes
- **LICENSE** - Software license information

### Implementation Documentation

The `docs/` directory contains detailed implementation documentation for specific features:

- Database schema and migrations
- API integration patterns
- Security implementation details
- Accessibility compliance
- Performance optimization strategies

### Getting Started

1. **For Users**: Start with this README for installation and usage
2. **For Developers**: Read ARCHITECTURE.md and DEVELOPER_NOTES.md
3. **For Content Creators**: See UPLOADER_GUIDE.md for tagging conventions
4. **For Testers**: Check TESTS.md for testing procedures

## Support

### Documentation

- **Setup Guide**: This README
- **Architecture**: [ARCHITECTURE.md](ARCHITECTURE.md) (to be created)
- **Testing**: [TESTS.md](TESTS.md) (to be created)
- **Uploader Guide**: [UPLOADER_GUIDE.md](UPLOADER_GUIDE.md) (to be created)
- **Developer Notes**: [DEVELOPER_NOTES.md](DEVELOPER_NOTES.md) (to be created)

### Community

- **Issues**: [GitHub Issues](https://github.com/YOURNAME/kiyya-desktop/issues)
- **Discussions**: [GitHub Discussions](https://github.com/YOURNAME/kiyya-desktop/discussions)
- **Telegram**: Link configured in VITE_TELEGRAM_LINK

### Reporting Issues

When reporting issues, please include:
1. **System Information**: OS, version, architecture
2. **Application Version**: Found in Settings → About
3. **Steps to Reproduce**: Detailed steps to trigger the issue
4. **Expected Behavior**: What should happen
5. **Actual Behavior**: What actually happens
6. **Logs**: Relevant log files from app data directory
7. **Screenshots**: If applicable

### Feature Requests

Feature requests are welcome! Please:
1. Check existing issues to avoid duplicates
2. Describe the feature and use case
3. Explain why it would be valuable
4. Consider implementation complexity

### Security Issues

For security vulnerabilities, please:
1. **Do not** open a public issue
2. Email security concerns to: security@kiyya.app
3. Include detailed description and reproduction steps
4. Allow time for fix before public disclosure

## Acknowledgments

- [Tauri](https://tauri.app/) - Desktop application framework
- [Odysee](https://odysee.com/) - Content platform and API
- [React](https://reactjs.org/) - UI framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling framework
- [Plyr](https://plyr.io/) - Video player
- [GSAP](https://greensock.com/gsap/) - Animation library