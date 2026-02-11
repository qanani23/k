# Production Build Guide

This document provides comprehensive instructions for building Kiyya Desktop for production deployment.

## Prerequisites

Before building for production, ensure you have:

1. **Development Environment Setup**
   - Node.js 18+ and npm installed
   - Rust 1.70+ installed
   - Platform-specific build tools (see README.md)
   - All dependencies installed (`npm install`)

2. **Configuration Complete**
   - `.env.production` file configured with production values
   - Version numbers synchronized across all configuration files
   - Update manifest URL configured and accessible
   - Channel ID set to your production Odysee channel

3. **Testing Complete**
   - All unit tests passing (`npm run test:unit`)
   - All property-based tests passing (`npm run test:property`)
   - All E2E tests passing (`npm run test:e2e`)
   - Security audit clean (`npm run security:audit`)

## Production Configuration

### Environment Variables

The `.env.production` file contains production-specific configuration. Critical variables to update:

```env
# Your production Odysee channel
VITE_CHANNEL_ID=@YourActualChannel:x
CHANNEL_ID=@YourActualChannel:x

# Your update manifest URL (must be publicly accessible)
VITE_UPDATE_MANIFEST_URL=https://raw.githubusercontent.com/YourUsername/kiyya-releases/main/version.json

# Your community link
VITE_TELEGRAM_LINK=https://t.me/YourActualChannel

# Production settings
TAURI_DEBUG=false
VITE_LOG_LEVEL=warn
VITE_ENABLE_PERFORMANCE_MONITORING=false
```

### Version Synchronization

Ensure version numbers match in all three files:

1. **package.json**
   ```json
   {
     "version": "1.0.0"
   }
   ```

2. **src-tauri/tauri.conf.json**
   ```json
   {
     "package": {
       "version": "1.0.0"
     }
   }
   ```

3. **src-tauri/Cargo.toml**
   ```toml
   [package]
   version = "1.0.0"
   ```

## Build Process

### Quick Build (Recommended)

For a complete production build with all validations:

```bash
npm run tauri:build:prod
```

This command will:
1. Validate configuration files
2. Run type checking
3. Build the frontend with production optimizations
4. Build the Rust backend with release profile
5. Generate platform-specific installers

### Step-by-Step Build

For more control over the build process:

1. **Validate Configuration**
   ```bash
   node scripts/build-production.js
   ```
   
   This checks:
   - `.env.production` exists and is valid
   - Required environment variables are set
   - No placeholder values remain
   - Version numbers are synchronized

2. **Run Pre-Build Tests**
   ```bash
   npm run lint
   npm run test:unit
   ```

3. **Build Frontend**
   ```bash
   npm run build:prod
   ```
   
   This compiles TypeScript and bundles the React application with:
   - Code minification
   - Tree shaking
   - Code splitting (React, video player, animations)
   - Asset optimization

4. **Build Application**
   ```bash
   npm run tauri:build
   ```
   
   This compiles the Rust backend and packages the application with:
   - Maximum optimization (opt-level = 3)
   - Link Time Optimization (LTO)
   - Symbol stripping
   - Platform-specific installers

### Debug Build

For testing production builds with debug symbols:

```bash
npm run tauri:build:debug
```

This creates a production build with:
- Debug symbols included
- Source maps enabled
- Faster compilation time

## Build Outputs

After a successful build, you'll find installers in:

```
src-tauri/target/release/bundle/
```

### Platform-Specific Outputs

**Windows:**
- `*.msi` - Windows Installer package
- `*.exe` - Standalone executable (in `release/` directory)

**macOS:**
- `*.dmg` - Disk image for distribution
- `*.app` - Application bundle (in `release/` directory)

**Linux:**
- `*.deb` - Debian package
- `*.AppImage` - Universal Linux package
- `*.rpm` - RPM package (if configured)

## Build Optimizations

### Frontend Optimizations

The production build includes:

1. **Code Splitting**
   - React vendor chunk (React, React DOM, React Router)
   - Video player chunk (Plyr, hls.js)
   - Animation chunk (GSAP)

2. **Asset Optimization**
   - Images inlined if < 4KB
   - CSS minification
   - Font subsetting

3. **Bundle Analysis**
   ```bash
   npm run analyze
   ```

### Backend Optimizations

The Rust release profile includes:

1. **Compilation Optimizations**
   - Maximum optimization level (opt-level = 3)
   - Link Time Optimization (LTO = true)
   - Single codegen unit for better optimization
   - Symbol stripping for smaller binaries
   - Panic abort for reduced binary size

2. **Dependency Optimization**
   - Only production dependencies included
   - Unused features excluded

## Build Verification

After building, verify the application:

1. **Install and Launch**
   - Install the generated package on a clean system
   - Launch the application
   - Verify it starts without errors

2. **Functional Testing**
   - Test content discovery and browsing
   - Test video playback with quality selection
   - Test download functionality
   - Test offline playback
   - Test update checking

3. **Performance Testing**
   - Monitor memory usage during playback
   - Check startup time
   - Verify smooth UI interactions
   - Test with slow network conditions

4. **Security Verification**
   - Verify network restrictions (only Odysee domains)
   - Verify filesystem restrictions (app data folder only)
   - Check that no debug information is exposed
   - Verify encryption works correctly

## Troubleshooting

### Build Fails with Version Mismatch

**Problem:** Version numbers don't match across configuration files.

**Solution:**
1. Update all three files with the same version number
2. Run `node scripts/build-production.js` to verify

### Build Fails with Missing Environment Variables

**Problem:** Required environment variables are not set.

**Solution:**
1. Copy `.env` to `.env.production`
2. Update all placeholder values
3. Run `node scripts/build-production.js` to verify

### Build Succeeds but Application Won't Start

**Problem:** Runtime configuration issues.

**Solution:**
1. Check that `.env.production` values are correct
2. Verify update manifest URL is accessible
3. Check that channel ID is valid
4. Review application logs in:
   - Windows: `%APPDATA%\Kiyya\logs`
   - macOS: `~/Library/Application Support/Kiyya/logs`
   - Linux: `~/.local/share/Kiyya/logs`

### Large Bundle Size

**Problem:** Frontend bundle is larger than expected.

**Solution:**
1. Run `npm run analyze` to identify large dependencies
2. Review code splitting configuration in `vite.config.ts`
3. Check for unnecessary dependencies in `package.json`
4. Verify tree shaking is working correctly

### Slow Build Times

**Problem:** Production builds take too long.

**Solution:**
1. Use `npm run tauri:build:debug` for faster iteration
2. Ensure you have adequate system resources
3. Consider using incremental builds during development
4. Use `cargo clean` if Rust build cache is corrupted

## Release Checklist

Before releasing a production build:

- [ ] All tests passing (`npm run test:all`)
- [ ] Security audit clean (`npm run security:audit`)
- [ ] Version numbers synchronized
- [ ] `.env.production` configured with production values
- [ ] Update manifest URL accessible and valid
- [ ] Documentation updated (README, CHANGELOG)
- [ ] Build verified on target platforms
- [ ] Functional testing complete
- [ ] Performance testing complete
- [ ] Security verification complete
- [ ] Release notes prepared
- [ ] Code signing configured (if applicable)

## Code Signing

### Windows

For Windows code signing, you need:

1. **Code Signing Certificate**
   - Purchase from a trusted CA (DigiCert, Sectigo, etc.)
   - Or use self-signed certificate for testing

2. **Configuration**
   
   Update `src-tauri/tauri.conf.json`:
   ```json
   {
     "tauri": {
       "bundle": {
         "windows": {
           "certificateThumbprint": "YOUR_CERT_THUMBPRINT",
           "digestAlgorithm": "sha256",
           "timestampUrl": "http://timestamp.digicert.com"
         }
       }
     }
   }
   ```

3. **Build with Signing**
   ```bash
   npm run tauri:build:prod
   ```

### macOS

For macOS code signing, you need:

1. **Apple Developer Account**
   - Enroll in Apple Developer Program
   - Create signing certificates in Xcode

2. **Configuration**
   
   Update `src-tauri/tauri.conf.json`:
   ```json
   {
     "tauri": {
       "bundle": {
         "macOS": {
           "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)",
           "providerShortName": "YOUR_PROVIDER_SHORT_NAME",
           "entitlements": "path/to/entitlements.plist"
         }
       }
     }
   }
   ```

3. **Notarization**
   
   After building, notarize the app:
   ```bash
   xcrun notarytool submit path/to/app.dmg \
     --apple-id "your@email.com" \
     --team-id "TEAM_ID" \
     --password "app-specific-password"
   ```

### Linux

Linux packages typically don't require code signing, but you can:

1. **GPG Sign Packages**
   ```bash
   gpg --detach-sign --armor package.deb
   ```

2. **Provide Checksums**
   ```bash
   sha256sum package.deb > package.deb.sha256
   ```

## Continuous Integration

For automated builds, see `.github/workflows/` (if configured) or set up CI with:

1. **GitHub Actions**
2. **GitLab CI**
3. **Jenkins**
4. **Travis CI**

Example GitHub Actions workflow structure:

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        platform: [windows-latest, macos-latest, ubuntu-latest]
    
    runs-on: ${{ matrix.platform }}
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - uses: actions-rs/toolchain@v1
      
      - name: Install dependencies
        run: npm install
      
      - name: Run tests
        run: npm run test:all
      
      - name: Build application
        run: npm run tauri:build:prod
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
```

## Support

For build issues or questions:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review Tauri documentation: https://tauri.app/
3. Check project issues on GitHub
4. Contact the development team

## Additional Resources

- [Tauri Build Documentation](https://tauri.app/v1/guides/building/)
- [Vite Build Documentation](https://vitejs.dev/guide/build.html)
- [Rust Release Profiles](https://doc.rust-lang.org/cargo/reference/profiles.html)
- [Code Signing Guide](https://tauri.app/v1/guides/distribution/sign-windows)
