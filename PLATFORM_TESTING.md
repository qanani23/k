# Platform Testing Guide

This document provides comprehensive testing procedures for Kiyya Desktop across Windows, macOS, and Linux platforms.

## Overview

Kiyya Desktop is built with Tauri and should work consistently across all major desktop platforms. This guide outlines platform-specific testing procedures, known issues, and verification steps.

## Testing Matrix

| Platform | Version | Architecture | Status |
|----------|---------|--------------|--------|
| Windows 10/11 | 21H2+ | x64 | ✓ Tested |
| macOS | 10.13+ | x64, ARM64 | ⚠️ Requires Testing |
| Linux (Ubuntu) | 20.04+ | x64 | ⚠️ Requires Testing |
| Linux (Fedora) | 35+ | x64 | ⚠️ Requires Testing |
| Linux (Arch) | Latest | x64 | ⚠️ Requires Testing |

## Current Platform Status

**Currently Tested:**
- ✓ Windows 10/11 (Development and Testing Environment)

**Requires Testing:**
- ⚠️ macOS (Intel and Apple Silicon)
- ⚠️ Linux (Multiple distributions)

## Platform-Specific Build Instructions

### Windows

**Prerequisites:**
- Windows 10 version 1809+ or Windows 11
- Visual Studio 2019+ with C++ build tools
- WebView2 (usually pre-installed on Windows 11)

**Build Command:**
```bash
npm run tauri:build:prod
```

**Output Location:**
```
src-tauri/target/release/bundle/msi/Kiyya_1.0.0_x64_en-US.msi
src-tauri/target/release/Kiyya.exe
```

**Installation:**
1. Run the MSI installer
2. Follow installation wizard
3. Launch from Start Menu or Desktop shortcut

### macOS

**Prerequisites:**
- macOS 10.13 (High Sierra) or later
- Xcode Command Line Tools: `xcode-select --install`
- Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Node.js 18+: `brew install node`

**Build Command:**
```bash
npm run tauri:build:prod
```

**Output Location:**
```
src-tauri/target/release/bundle/dmg/Kiyya_1.0.0_x64.dmg
src-tauri/target/release/bundle/macos/Kiyya.app
```

**Installation:**
1. Open the DMG file
2. Drag Kiyya.app to Applications folder
3. Launch from Applications or Launchpad

**macOS-Specific Considerations:**
- First launch may require right-click → Open due to Gatekeeper
- Code signing recommended for distribution
- Notarization required for macOS 10.15+

### Linux (Ubuntu/Debian)

**Prerequisites:**
```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.0-dev \
  build-essential \
  curl \
  wget \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

**Build Command:**
```bash
npm run tauri:build:prod
```

**Output Location:**
```
src-tauri/target/release/bundle/deb/kiyya_1.0.0_amd64.deb
src-tauri/target/release/bundle/appimage/kiyya_1.0.0_amd64.AppImage
```

**Installation (DEB):**
```bash
sudo dpkg -i kiyya_1.0.0_amd64.deb
sudo apt-get install -f  # Fix dependencies if needed
```

**Installation (AppImage):**
```bash
chmod +x kiyya_1.0.0_amd64.AppImage
./kiyya_1.0.0_amd64.AppImage
```

### Linux (Fedora/RHEL)

**Prerequisites:**
```bash
sudo dnf install -y \
  webkit2gtk4.0-devel \
  openssl-devel \
  curl \
  wget \
  libappindicator-gtk3 \
  librsvg2-devel \
  gtk3-devel
```

**Build Command:**
```bash
npm run tauri:build:prod
```

**Output Location:**
```
src-tauri/target/release/bundle/rpm/kiyya-1.0.0-1.x86_64.rpm
src-tauri/target/release/bundle/appimage/kiyya_1.0.0_amd64.AppImage
```

**Installation (RPM):**
```bash
sudo dnf install kiyya-1.0.0-1.x86_64.rpm
```

### Linux (Arch)

**Prerequisites:**
```bash
sudo pacman -S --needed \
  webkit2gtk \
  base-devel \
  curl \
  wget \
  openssl \
  appmenu-gtk-module \
  gtk3 \
  libappindicator-gtk3 \
  librsvg
```

**Build Command:**
```bash
npm run tauri:build:prod
```

**Installation:**
Use the AppImage or create a PKGBUILD for AUR distribution.

## Comprehensive Testing Checklist

### Pre-Installation Testing

- [ ] **Build Verification**
  - [ ] Build completes without errors
  - [ ] All tests pass (`npm run test:all`)
  - [ ] No security vulnerabilities (`npm run security:audit`)
  - [ ] Bundle size is reasonable (< 100MB)

### Installation Testing

- [ ] **Windows**
  - [ ] MSI installer runs without errors
  - [ ] Installation completes successfully
  - [ ] Desktop shortcut created (if selected)
  - [ ] Start Menu entry created
  - [ ] Uninstaller works correctly

- [ ] **macOS**
  - [ ] DMG mounts correctly
  - [ ] App can be dragged to Applications
  - [ ] First launch works (with Gatekeeper prompt if unsigned)
  - [ ] App appears in Launchpad
  - [ ] Uninstallation (move to Trash) works

- [ ] **Linux**
  - [ ] Package installs without dependency errors
  - [ ] Desktop entry created
  - [ ] Application menu entry appears
  - [ ] Package removal works cleanly

### Application Startup Testing

- [ ] **Initial Launch**
  - [ ] Application window opens
  - [ ] No crash on startup
  - [ ] Window size and position correct
  - [ ] Theme loads correctly (dark mode default)
  - [ ] No console errors (check logs)

- [ ] **Update Check**
  - [ ] Update manifest fetched successfully
  - [ ] Version comparison works correctly
  - [ ] Update notification appears if available
  - [ ] Emergency disable check works

- [ ] **Database Initialization**
  - [ ] SQLite database created
  - [ ] Migrations run successfully
  - [ ] Tables and indices created
  - [ ] No database errors in logs

### Core Functionality Testing

#### Content Discovery

- [ ] **Channel Content Fetching**
  - [ ] Content loads from configured channel
  - [ ] Categories display correctly (Movies, Series, Sitcoms, Kids)
  - [ ] Thumbnails load and display
  - [ ] Content metadata displays correctly
  - [ ] Pagination works for large collections

- [ ] **Hero Section**
  - [ ] Hero content loads
  - [ ] Random selection works
  - [ ] Autoplay attempts (muted)
  - [ ] Fallback to poster if autoplay fails
  - [ ] CTA buttons work (Play, Add to Favorites)

- [ ] **Navigation**
  - [ ] NavBar dropdowns work
  - [ ] Category filtering works
  - [ ] Routing between pages works
  - [ ] Back/forward navigation works
  - [ ] Breadcrumbs display correctly

#### Video Playback

- [ ] **Player Functionality**
  - [ ] Video plays successfully
  - [ ] Quality selection works
  - [ ] Playback controls work (play, pause, seek)
  - [ ] Volume control works
  - [ ] Fullscreen mode works
  - [ ] Progress tracking saves correctly

- [ ] **Quality Management**
  - [ ] Initial quality selection appropriate
  - [ ] Manual quality change works
  - [ ] Automatic quality downgrade on buffering
  - [ ] Quality indicators display correctly

- [ ] **HLS Streaming**
  - [ ] HLS streams play correctly
  - [ ] hls.js fallback works when needed
  - [ ] Codec compatibility detection works
  - [ ] Compatibility warnings display when needed

#### Download and Offline

- [ ] **Download Functionality**
  - [ ] Download initiation works
  - [ ] Disk space check works
  - [ ] Progress bar updates correctly
  - [ ] Download completes successfully
  - [ ] Downloaded files stored correctly

- [ ] **Offline Playback**
  - [ ] Local HTTP server starts
  - [ ] Downloaded content plays offline
  - [ ] Range requests work (seeking)
  - [ ] Concurrent playback works
  - [ ] Encryption/decryption works (if enabled)

- [ ] **Download Management**
  - [ ] Downloads page displays correctly
  - [ ] Active downloads show progress
  - [ ] Completed downloads listed
  - [ ] Delete functionality works
  - [ ] Resume functionality works

#### Search and Discovery

- [ ] **Search Functionality**
  - [ ] Local search works
  - [ ] Remote search works
  - [ ] Query normalization works
  - [ ] Search results display correctly
  - [ ] Fallback suggestions work
  - [ ] No SQL injection vulnerabilities

- [ ] **Series Management**
  - [ ] Series organized by season
  - [ ] Playlist order preserved
  - [ ] Episode parsing works
  - [ ] Season inference marking displays
  - [ ] Episode selection works

#### User Preferences

- [ ] **Favorites**
  - [ ] Add to favorites works
  - [ ] Favorites page displays correctly
  - [ ] Remove from favorites works
  - [ ] Favorites persist across restarts
  - [ ] Favorites stored in SQLite only

- [ ] **Settings**
  - [ ] Theme switching works
  - [ ] Quality preferences save
  - [ ] Encryption toggle works
  - [ ] Diagnostics display correctly
  - [ ] Settings persist across restarts

### Platform-Specific Testing

#### Windows-Specific

- [ ] **System Integration**
  - [ ] Taskbar integration works
  - [ ] System tray icon works (if implemented)
  - [ ] Windows notifications work
  - [ ] File associations work (if configured)
  - [ ] High DPI scaling works correctly

- [ ] **Performance**
  - [ ] Startup time < 3 seconds
  - [ ] Memory usage reasonable (< 500MB idle)
  - [ ] CPU usage low during idle
  - [ ] Video playback smooth (60fps)

- [ ] **Security**
  - [ ] Windows Defender doesn't flag app
  - [ ] SmartScreen allows execution
  - [ ] Network restrictions enforced
  - [ ] Filesystem restrictions enforced

#### macOS-Specific

- [ ] **System Integration**
  - [ ] Dock integration works
  - [ ] Menu bar integration works
  - [ ] macOS notifications work
  - [ ] Spotlight indexing works
  - [ ] Retina display support works

- [ ] **Performance**
  - [ ] Startup time < 3 seconds
  - [ ] Memory usage reasonable (< 500MB idle)
  - [ ] Battery impact minimal
  - [ ] Video playback smooth (60fps)

- [ ] **Security**
  - [ ] Gatekeeper allows execution
  - [ ] Sandbox restrictions work
  - [ ] Network restrictions enforced
  - [ ] Filesystem restrictions enforced

- [ ] **Apple Silicon**
  - [ ] Native ARM64 build works
  - [ ] Rosetta 2 compatibility (x64 build)
  - [ ] Performance on M1/M2/M3 chips

#### Linux-Specific

- [ ] **System Integration**
  - [ ] Desktop environment integration (GNOME, KDE, etc.)
  - [ ] System tray icon works
  - [ ] Desktop notifications work
  - [ ] File manager integration works
  - [ ] HiDPI scaling works

- [ ] **Performance**
  - [ ] Startup time < 3 seconds
  - [ ] Memory usage reasonable (< 500MB idle)
  - [ ] CPU usage low during idle
  - [ ] Video playback smooth (60fps)

- [ ] **Distribution Compatibility**
  - [ ] Ubuntu 20.04, 22.04, 24.04
  - [ ] Fedora 35+
  - [ ] Arch Linux
  - [ ] Debian 11+
  - [ ] Linux Mint

- [ ] **Wayland vs X11**
  - [ ] Works on Wayland
  - [ ] Works on X11
  - [ ] No display server specific issues

### Accessibility Testing

- [ ] **Keyboard Navigation**
  - [ ] Tab navigation works
  - [ ] Arrow key navigation works
  - [ ] Enter/Space activation works
  - [ ] Escape key closes modals
  - [ ] Keyboard shortcuts work

- [ ] **Screen Reader**
  - [ ] ARIA labels present
  - [ ] Screen reader announces content
  - [ ] Focus management works
  - [ ] Form labels work

- [ ] **Visual Accessibility**
  - [ ] Color contrast sufficient
  - [ ] Text scaling works
  - [ ] prefers-reduced-motion respected
  - [ ] Focus indicators visible

### Performance Testing

- [ ] **Startup Performance**
  - [ ] Cold start < 3 seconds
  - [ ] Warm start < 2 seconds
  - [ ] No blocking operations on startup

- [ ] **Runtime Performance**
  - [ ] UI responsive (< 100ms interactions)
  - [ ] Smooth scrolling (60fps)
  - [ ] Video playback smooth
  - [ ] No memory leaks during extended use

- [ ] **Network Performance**
  - [ ] Gateway failover works
  - [ ] Retry logic works
  - [ ] Timeout handling works
  - [ ] Offline mode works

### Security Testing

- [ ] **Network Restrictions**
  - [ ] Only approved domains accessible
  - [ ] Update manifest URL accessible
  - [ ] Other domains blocked
  - [ ] CSP enforced

- [ ] **Filesystem Restrictions**
  - [ ] Only app data folder accessible
  - [ ] Other directories blocked
  - [ ] Vault directory secure
  - [ ] Logs directory accessible

- [ ] **Data Security**
  - [ ] Encryption works correctly
  - [ ] Keys stored in OS keystore
  - [ ] No secrets in code/database
  - [ ] SQL injection prevented

### Error Handling Testing

- [ ] **Network Errors**
  - [ ] Gateway failures handled
  - [ ] Timeout errors handled
  - [ ] Offline mode works
  - [ ] Error messages clear

- [ ] **Content Errors**
  - [ ] Missing thumbnails handled
  - [ ] Malformed metadata handled
  - [ ] Invalid URLs handled
  - [ ] Parsing errors handled

- [ ] **Storage Errors**
  - [ ] Disk full handled
  - [ ] Permission errors handled
  - [ ] Corruption handled
  - [ ] Migration errors handled

### Update System Testing

- [ ] **Version Checking**
  - [ ] Update check on startup
  - [ ] Version comparison correct
  - [ ] Manifest parsing works
  - [ ] Network errors handled

- [ ] **Update Notifications**
  - [ ] Optional update notification
  - [ ] Forced update screen
  - [ ] Emergency disable screen
  - [ ] Update button opens browser

- [ ] **Version Scenarios**
  - [ ] Current version = latest
  - [ ] Current version < latest (optional)
  - [ ] Current version < minimum (forced)
  - [ ] Emergency disable = true

## Known Platform Issues

### Windows

**Issue:** WebView2 not installed on older Windows 10 versions
**Solution:** Installer should include WebView2 runtime or prompt user to install

**Issue:** Windows Defender may flag unsigned builds
**Solution:** Code signing recommended for distribution

### macOS

**Issue:** Gatekeeper blocks unsigned apps
**Solution:** Users must right-click → Open on first launch, or app must be signed and notarized

**Issue:** Apple Silicon compatibility
**Solution:** Build universal binary or separate ARM64 build

### Linux

**Issue:** Different distributions have different dependencies
**Solution:** AppImage provides best compatibility across distributions

**Issue:** Wayland vs X11 differences
**Solution:** Test on both display servers

**Issue:** System tray icon may not work on all desktop environments
**Solution:** Graceful degradation if system tray unavailable

## Testing Tools and Commands

### Build and Test All Platforms

```bash
# Run all tests
npm run test:all

# Build for current platform
npm run tauri:build:prod

# Build debug version for testing
npm run tauri:build:debug
```

### Platform-Specific Testing

```bash
# Check Rust compilation for all targets
cd src-tauri
cargo check --target x86_64-pc-windows-msvc
cargo check --target x86_64-apple-darwin
cargo check --target aarch64-apple-darwin
cargo check --target x86_64-unknown-linux-gnu

# Run Rust tests
cargo test --release

# Run frontend tests
cd ..
npm run test:unit
npm run test:property
npm run test:e2e
```

### Performance Profiling

```bash
# Frontend performance
npm run build -- --mode analyze

# Rust performance
cd src-tauri
cargo build --release
cargo flamegraph --bin kiyya-desktop
```

## Automated Testing

### CI/CD Integration

For automated cross-platform testing, consider:

1. **GitHub Actions** - Free for public repositories
2. **GitLab CI** - Supports multiple platforms
3. **Azure Pipelines** - Good Windows support
4. **CircleCI** - Good macOS support

### Example GitHub Actions Matrix

```yaml
strategy:
  matrix:
    platform:
      - os: windows-latest
        target: x86_64-pc-windows-msvc
      - os: macos-latest
        target: x86_64-apple-darwin
      - os: macos-latest
        target: aarch64-apple-darwin
      - os: ubuntu-latest
        target: x86_64-unknown-linux-gnu
```

## Manual Testing Checklist

Before releasing on a new platform:

1. [ ] Build completes successfully
2. [ ] Installation works correctly
3. [ ] Application starts without errors
4. [ ] All core features work
5. [ ] Performance is acceptable
6. [ ] Security restrictions enforced
7. [ ] Accessibility features work
8. [ ] Error handling works
9. [ ] Update system works
10. [ ] Uninstallation works cleanly

## Reporting Issues

When reporting platform-specific issues, include:

1. **Platform Information**
   - OS name and version
   - Architecture (x64, ARM64)
   - Desktop environment (Linux)

2. **Application Information**
   - Kiyya version
   - Build type (release, debug)
   - Installation method (MSI, DMG, DEB, AppImage)

3. **Issue Details**
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Screenshots/videos if applicable

4. **Logs**
   - Application logs from:
     - Windows: `%APPDATA%\Kiyya\logs`
     - macOS: `~/Library/Application Support/Kiyya/logs`
     - Linux: `~/.local/share/Kiyya/logs`

## Next Steps

To complete platform testing:

1. **Set up testing environments** for macOS and Linux
2. **Build application** on each platform
3. **Run comprehensive testing checklist** on each platform
4. **Document platform-specific issues** and solutions
5. **Update this document** with findings
6. **Create platform-specific documentation** if needed

## Resources

- [Tauri Platform Support](https://tauri.app/v1/guides/building/)
- [Rust Platform Support](https://doc.rust-lang.org/nightly/rustc/platform-support.html)
- [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)
- [macOS Code Signing](https://developer.apple.com/support/code-signing/)
- [Linux Desktop Integration](https://specifications.freedesktop.org/)
