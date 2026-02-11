# Release Checklist

Use this checklist before creating a production release of Kiyya Desktop.

## Pre-Release Validation

### Code Quality
- [ ] All unit tests passing (`npm run test:unit`)
- [ ] All property-based tests passing (`npm run test:property`)
- [ ] All E2E tests passing (`npm run test:e2e`)
- [ ] Linting passes with no warnings (`npm run lint`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Code formatting is consistent (`npm run format:check`)

### Security
- [ ] Security audit clean (`npm run security:audit`)
- [ ] No hardcoded secrets or API keys in code
- [ ] Network restrictions verified (only Odysee domains)
- [ ] Filesystem restrictions verified (app data folder only)
- [ ] Encryption key management verified (OS keystore only)
- [ ] Input sanitization verified (no SQL injection possible)

### Configuration
- [ ] Version numbers synchronized across:
  - [ ] `package.json`
  - [ ] `src-tauri/tauri.conf.json`
  - [ ] `src-tauri/Cargo.toml`
- [ ] `.env.production` configured with production values:
  - [ ] `VITE_CHANNEL_ID` set to production channel
  - [ ] `CHANNEL_ID` set to production channel
  - [ ] `VITE_UPDATE_MANIFEST_URL` set to production URL
  - [ ] `VITE_TELEGRAM_LINK` set to production link
  - [ ] `TAURI_DEBUG` set to `false`
  - [ ] `VITE_LOG_LEVEL` set to `warn` or `error`
- [ ] No placeholder values in `.env.production`
- [ ] Build validation passes (`npm run validate-build`)

### Documentation
- [ ] README.md updated with current version
- [ ] CHANGELOG.md updated with release notes
- [ ] BUILD.md reviewed and accurate
- [ ] ARCHITECTURE.md reflects current implementation
- [ ] UPLOADER_GUIDE.md is current
- [ ] API documentation is current

### Update System
- [ ] Update manifest URL is publicly accessible
- [ ] Update manifest contains correct version information
- [ ] Update manifest `downloadUrl` points to release location
- [ ] Emergency disable flag is set correctly (`emergencyDisable: false`)
- [ ] Release notes are clear and informative

### Testing
- [ ] Application tested on target platforms:
  - [ ] Windows 10/11
  - [ ] macOS 10.13+
  - [ ] Linux (Ubuntu/Debian)
- [ ] Fresh install tested (no previous version)
- [ ] Update from previous version tested
- [ ] Offline functionality tested
- [ ] Download and playback tested
- [ ] Gateway failover tested
- [ ] Update checking tested

### Performance
- [ ] Startup time acceptable (< 3 seconds)
- [ ] Memory usage reasonable (< 500MB idle)
- [ ] Video playback smooth (no stuttering)
- [ ] UI responsive (no lag)
- [ ] Bundle size acceptable (< 100MB)

## Build Process

### Automated Release (Recommended)

Use the release automation scripts for a streamlined process:

- [ ] Prepare release: `node scripts/prepare-release.js <version>`
- [ ] Review and edit CHANGELOG.md if needed
- [ ] Push changes: `git push origin main && git push origin v<version>`
- [ ] Create GitHub release: `node scripts/create-release.js v<version>`
- [ ] Generate manifest: `node scripts/update-manifest.js <version> --min-version <min>`
- [ ] Publish manifest to kiyya-releases repository

See [RELEASE_AUTOMATION.md](RELEASE_AUTOMATION.md) for detailed instructions.

### Manual Build (Alternative)

#### Pre-Build
- [ ] Clean build environment (`npm run clean` if available)
- [ ] Dependencies up to date (`npm install`)
- [ ] Rust dependencies cached (`cd src-tauri && cargo fetch`)

#### Build Execution
- [ ] Run build validation: `npm run validate-build`
- [ ] Run production build: `npm run tauri:build:prod`
- [ ] Build completes without errors
- [ ] Build completes without warnings (or warnings documented)

#### Post-Build
- [ ] Installers generated for all target platforms
- [ ] Installer file sizes reasonable
- [ ] Installers tested on clean systems
- [ ] Application launches successfully
- [ ] No console errors on startup

## Code Signing (if applicable)

### Windows
- [ ] Code signing certificate configured
- [ ] Certificate thumbprint in `tauri.conf.json`
- [ ] Timestamp URL configured
- [ ] Installer is signed
- [ ] Signature verified

### macOS
- [ ] Apple Developer account active
- [ ] Signing identity configured
- [ ] Entitlements configured
- [ ] Application is signed
- [ ] Application is notarized
- [ ] DMG is signed

### Linux
- [ ] Packages have checksums
- [ ] Checksums published with release
- [ ] GPG signatures (optional)

## Release Artifacts

### Required Files
- [ ] Windows installer (`.msi` or `.exe`)
- [ ] macOS disk image (`.dmg`)
- [ ] Linux packages (`.deb`, `.AppImage`, `.rpm`)
- [ ] Checksums file (`SHA256SUMS`)
- [ ] Release notes (`RELEASE_NOTES.md`)

### Optional Files
- [ ] Source code archive
- [ ] Debug symbols (separate archive)
- [ ] Installation guide
- [ ] Migration guide (if applicable)

## Distribution

### GitHub Release
- [ ] Release tag created (`v1.0.0`)
- [ ] Release title descriptive
- [ ] Release notes complete
- [ ] All artifacts uploaded
- [ ] Checksums verified
- [ ] Release marked as latest (or pre-release)

### Update Manifest
- [ ] `version.json` updated with new version
- [ ] `latestVersion` set correctly
- [ ] `minSupportedVersion` set correctly
- [ ] `releaseNotes` included
- [ ] `downloadUrl` points to GitHub release
- [ ] Manifest committed and pushed
- [ ] Manifest accessible via raw URL

### Communication
- [ ] Release announcement prepared
- [ ] Community notified (Telegram, Discord, etc.)
- [ ] Documentation site updated (if applicable)
- [ ] Social media posts scheduled (if applicable)

## Post-Release

### Monitoring
- [ ] Monitor for crash reports
- [ ] Monitor for user feedback
- [ ] Monitor update adoption rate
- [ ] Monitor gateway health
- [ ] Monitor error logs

### Support
- [ ] Support channels monitored
- [ ] Known issues documented
- [ ] FAQ updated
- [ ] Troubleshooting guide updated

### Rollback Plan
- [ ] Previous version installers available
- [ ] Rollback procedure documented
- [ ] Emergency disable flag ready if needed
- [ ] Communication plan for rollback

## Version-Specific Notes

### Version: _________

**Release Date:** _________

**Special Considerations:**
- 
- 
- 

**Known Issues:**
- 
- 
- 

**Migration Notes:**
- 
- 
- 

## Sign-Off

- [ ] Technical Lead approval
- [ ] QA approval
- [ ] Product Owner approval
- [ ] Security review complete

**Approved by:** _________

**Date:** _________

---

## Notes

Use this space for any additional notes or reminders:

