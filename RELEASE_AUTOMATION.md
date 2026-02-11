# Release Automation Guide

This document describes the automated release process for Kiyya Desktop using the provided scripts.

## Overview

The release process is divided into three main steps:

1. **Prepare Release** - Validate, version bump, and create git tag
2. **Create Release** - Build application and create GitHub release
3. **Update Manifest** - Generate and publish version manifest

## Prerequisites

### Required Tools

- **Node.js 18+** - For running scripts
- **npm** - For dependency management
- **Git** - For version control
- **GitHub CLI (gh)** - For creating releases
  - Install: https://cli.github.com/
  - Authenticate: `gh auth login`
- **Rust & Tauri** - For building the application

### Repository Setup

1. **Main Repository** - Contains application source code
2. **Releases Repository** - Public repository for version manifest
   - Example: `username/kiyya-releases`
   - Must contain `version.json` file
   - Must be publicly accessible

### Configuration

Ensure these files are properly configured:

- `.env.production` - Production environment variables
- `package.json` - Project metadata and scripts
- `src-tauri/tauri.conf.json` - Tauri configuration
- `src-tauri/Cargo.toml` - Rust package configuration

## Release Scripts

### 1. Prepare Release

**Script:** `scripts/prepare-release.js`

**Purpose:** Prepares a new release by validating the codebase, bumping version numbers, updating the changelog, and creating a git tag.

**Usage:**
```bash
node scripts/prepare-release.js <version> [options]
```

**Arguments:**
- `version` - The new version number (e.g., `1.1.0`)

**Options:**
- `--skip-tests` - Skip running tests (not recommended)

**Examples:**
```bash
# Prepare version 1.1.0 with full validation
node scripts/prepare-release.js 1.1.0

# Prepare version 1.1.0 without running tests
node scripts/prepare-release.js 1.1.0 --skip-tests
```

**What it does:**
1. Checks git working directory is clean
2. Verifies you're on main/master branch
3. Runs unit tests and property-based tests
4. Runs linting and type checking
5. Updates version in `package.json`, `tauri.conf.json`, and `Cargo.toml`
6. Updates `CHANGELOG.md` with new version section
7. Creates git commit with message `chore: release vX.X.X`
8. Creates git tag `vX.X.X`

**Output:**
```
🚀 Kiyya Desktop - Release Preparation

ℹ️  Preparing release for version 1.1.0

✅ Git working directory is clean
✅ On main branch

✅ Unit tests passed
✅ Property-based tests passed

✅ Linting passed

✅ Type checking passed

✅ Version updated: 1.0.0 → 1.1.0

✅ Updated CHANGELOG.md with version 1.1.0
⚠️  WARNING: Please edit CHANGELOG.md to add release notes before committing

✅ Created commit for v1.1.0
✅ Created tag v1.1.0

ℹ️  Next steps:
  1. Review CHANGELOG.md and update release notes
  2. If changes needed: git reset --soft HEAD~1, make changes, and re-run this script
  3. Push changes: git push origin main && git push origin v1.1.0
  4. Run: node scripts/create-release.js v1.1.0

✅ Release preparation complete!
```

**After running:**
1. Review and edit `CHANGELOG.md` to add detailed release notes
2. If changes are needed:
   ```bash
   git reset --soft HEAD~1
   # Edit CHANGELOG.md
   node scripts/prepare-release.js 1.1.0
   ```
3. Push changes:
   ```bash
   git push origin main
   git push origin v1.1.0
   ```

### 2. Create Release

**Script:** `scripts/create-release.js`

**Purpose:** Builds the application, generates checksums, and creates a GitHub release with all artifacts.

**Usage:**
```bash
node scripts/create-release.js <tag> [options]
```

**Arguments:**
- `tag` - The git tag for the release (e.g., `v1.1.0`)

**Options:**
- `--draft` - Create as draft release (not published)
- `--prerelease` - Mark as pre-release
- `--skip-build` - Skip building (use existing artifacts)

**Examples:**
```bash
# Create release for v1.1.0
node scripts/create-release.js v1.1.0

# Create draft release
node scripts/create-release.js v1.1.0 --draft

# Create pre-release
node scripts/create-release.js v1.1.0 --prerelease

# Use existing build artifacts
node scripts/create-release.js v1.1.0 --skip-build
```

**What it does:**
1. Verifies GitHub CLI is installed and authenticated
2. Checks that the git tag exists
3. Builds the application using `npm run tauri:build:prod`
4. Finds all build artifacts (`.msi`, `.dmg`, `.deb`, `.AppImage`, `.rpm`)
5. Generates SHA256 checksums for all artifacts
6. Extracts release notes from `CHANGELOG.md`
7. Creates GitHub release with all artifacts attached

**Output:**
```
🚀 Kiyya Desktop - Release Creation

ℹ️  Creating release for v1.1.0

✅ GitHub CLI is installed
✅ Authenticated with GitHub
✅ Tag v1.1.0 exists

ℹ️  Building application...
ℹ️  This may take several minutes...
✅ Build completed successfully

ℹ️  Finding build artifacts...
✅ Found 3 artifact(s):
  - Kiyya_1.1.0_x64_en-US.msi
  - kiyya_1.1.0_amd64.deb
  - kiyya_1.1.0_amd64.AppImage

ℹ️  Generating checksums...
  Kiyya_1.1.0_x64_en-US.msi: a1b2c3d4e5f6g7h8...
  kiyya_1.1.0_amd64.deb: i9j0k1l2m3n4o5p6...
  kiyya_1.1.0_amd64.AppImage: q7r8s9t0u1v2w3x4...
✅ Checksums written to SHA256SUMS

✅ GitHub release created: v1.1.0

✅ Release creation complete!

ℹ️  Next steps:
  1. Verify the release on GitHub
  2. Update the version manifest (version.json) in kiyya-releases repository
  3. Test the update mechanism
```

**Platform-Specific Notes:**

**Windows:**
- Builds `.msi` installer
- Requires Windows build environment
- Code signing configured in `tauri.conf.json`

**macOS:**
- Builds `.dmg` disk image
- Requires macOS build environment
- Code signing and notarization configured in `tauri.conf.json`

**Linux:**
- Builds `.deb`, `.AppImage`, and `.rpm` packages
- Can be built on any Linux distribution
- No code signing required (checksums provided)

### 3. Update Manifest

**Script:** `scripts/update-manifest.js`

**Purpose:** Generates the `version.json` manifest file for the update system.

**Usage:**
```bash
node scripts/update-manifest.js <version> [options]
```

**Arguments:**
- `version` - The new version number (e.g., `1.1.0`)

**Options:**
- `--min-version <ver>` - Set minimum supported version (default: same as version)
- `--emergency-disable` - Enable emergency disable flag (blocks app startup)
- `--output <path>` - Output path for version.json (default: `./version.json`)
- `--github-repo <repo>` - GitHub repository (e.g., `username/kiyya-releases`)

**Examples:**
```bash
# Generate manifest for version 1.1.0
node scripts/update-manifest.js 1.1.0

# Set minimum supported version
node scripts/update-manifest.js 1.1.0 --min-version 1.0.0

# Enable emergency disable
node scripts/update-manifest.js 1.1.0 --emergency-disable

# Specify GitHub repository
node scripts/update-manifest.js 1.1.0 --github-repo myuser/kiyya-releases

# Custom output path
node scripts/update-manifest.js 1.1.0 --output /path/to/version.json
```

**What it does:**
1. Extracts release notes from `CHANGELOG.md`
2. Determines GitHub repository from `package.json` or `.env.production`
3. Generates `version.json` with:
   - `latestVersion` - The new version
   - `minSupportedVersion` - Minimum version that can update
   - `releaseNotes` - Extracted from CHANGELOG.md
   - `downloadUrl` - GitHub release URL
   - `emergencyDisable` - Optional emergency disable flag
4. Writes manifest to specified output path

**Output:**
```
🚀 Kiyya Desktop - Update Manifest Generator

ℹ️  Generating manifest for version 1.1.0

ℹ️  GitHub repository: username/kiyya-releases

ℹ️  Generated manifest:

{
  "latestVersion": "1.1.0",
  "minSupportedVersion": "1.0.0",
  "releaseNotes": "### Added\\n- New feature X\\n- New feature Y\\n\\n### Fixed\\n- Bug fix Z",
  "downloadUrl": "https://github.com/username/kiyya-releases/releases/tag/v1.1.0"
}

✅ Version manifest written to: ./version.json

✅ Manifest generation complete!

ℹ️  Next steps:
  1. Review the generated version.json file
  2. Copy version.json to your kiyya-releases repository
  3. Commit and push to GitHub:
     cd /path/to/username/kiyya-releases
     git add version.json
     git commit -m "Update manifest to v1.1.0"
     git push origin main
  4. Verify the manifest is accessible:
     https://raw.githubusercontent.com/username/kiyya-releases/main/version.json
```

**After running:**
1. Review the generated `version.json` file
2. Copy to your releases repository:
   ```bash
   cp version.json /path/to/kiyya-releases/
   cd /path/to/kiyya-releases
   git add version.json
   git commit -m "Update manifest to v1.1.0"
   git push origin main
   ```
3. Verify accessibility:
   ```bash
   curl https://raw.githubusercontent.com/username/kiyya-releases/main/version.json
   ```

## Complete Release Workflow

### Standard Release

Follow these steps for a standard release:

```bash
# 1. Prepare the release
node scripts/prepare-release.js 1.1.0

# 2. Review and edit CHANGELOG.md if needed
# If changes needed:
#   git reset --soft HEAD~1
#   # Edit CHANGELOG.md
#   node scripts/prepare-release.js 1.1.0

# 3. Push changes
git push origin main
git push origin v1.1.0

# 4. Create GitHub release (builds application)
node scripts/create-release.js v1.1.0

# 5. Generate version manifest
node scripts/update-manifest.js 1.1.0 --min-version 1.0.0

# 6. Publish manifest to releases repository
cp version.json /path/to/kiyya-releases/
cd /path/to/kiyya-releases
git add version.json
git commit -m "Update manifest to v1.1.0"
git push origin main

# 7. Verify the release
# - Check GitHub release page
# - Test update mechanism in application
# - Verify manifest is accessible
```

### Draft Release

For testing or review before publishing:

```bash
# Create draft release
node scripts/create-release.js v1.1.0 --draft

# Review on GitHub, then publish manually when ready
```

### Pre-Release

For beta or release candidate versions:

```bash
# Prepare pre-release
node scripts/prepare-release.js 1.1.0-rc.1

# Create pre-release
node scripts/create-release.js v1.1.0-rc.1 --prerelease

# Generate manifest (optional for pre-releases)
node scripts/update-manifest.js 1.1.0-rc.1
```

### Emergency Disable

To block all users from starting the application (critical security issues only):

```bash
# Generate manifest with emergency disable
node scripts/update-manifest.js 1.1.0 --emergency-disable

# Publish to releases repository immediately
cp version.json /path/to/kiyya-releases/
cd /path/to/kiyya-releases
git add version.json
git commit -m "EMERGENCY: Disable v1.1.0"
git push origin main

# To re-enable, generate manifest without flag
node scripts/update-manifest.js 1.1.0
# Publish again
```

## NPM Scripts

The release scripts are also available as npm scripts:

```bash
# Prepare release
npm run release:prepare -- 1.1.0

# Create release
npm run release:create -- v1.1.0

# Generate manifest
npm run release:manifest -- 1.1.0
```

## Troubleshooting

### "Git working directory is not clean"

**Problem:** You have uncommitted changes.

**Solution:**
```bash
# Commit or stash changes
git add .
git commit -m "Your changes"
# Or
git stash
```

### "Tests failed"

**Problem:** Unit or property-based tests are failing.

**Solution:**
1. Fix the failing tests
2. Run tests manually: `npm run test:unit && npm run test:property`
3. Re-run prepare script

### "GitHub CLI is not installed"

**Problem:** GitHub CLI (gh) is not installed.

**Solution:**
```bash
# Install GitHub CLI
# macOS
brew install gh

# Windows
winget install --id GitHub.cli

# Linux
# See: https://github.com/cli/cli/blob/trunk/docs/install_linux.md

# Authenticate
gh auth login
```

### "Tag does not exist"

**Problem:** Git tag was not created or pushed.

**Solution:**
```bash
# Create tag manually
git tag -a v1.1.0 -m "Release v1.1.0"

# Push tag
git push origin v1.1.0
```

### "No build artifacts found"

**Problem:** Build failed or artifacts are in unexpected location.

**Solution:**
1. Check build output for errors
2. Verify build completed successfully
3. Check `src-tauri/target/release/bundle/` directory
4. Run build manually: `npm run tauri:build:prod`

### "Could not determine GitHub repository"

**Problem:** Script cannot find GitHub repository information.

**Solution:**
```bash
# Provide repository explicitly
node scripts/update-manifest.js 1.1.0 --github-repo username/kiyya-releases

# Or update package.json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/username/kiyya-desktop.git"
  }
}
```

## Security Considerations

### Certificate Management

- **Never commit** code signing certificates to version control
- Store certificates securely (password manager, HSM)
- Use environment variables or secure CI/CD secrets for automation

### Emergency Disable

- Use `--emergency-disable` flag **only** for critical security issues
- Document the reason in release notes
- Communicate with users through all available channels
- Prepare a fix and new release as quickly as possible

### Version Manifest

- Keep releases repository public for manifest accessibility
- Never include sensitive information in manifest
- Verify manifest URL is accessible before releasing
- Monitor manifest for unauthorized changes

## CI/CD Integration

For automated releases in CI/CD pipelines, see `.github/workflows/` (if configured) or adapt the scripts for your CI/CD platform.

**Example GitHub Actions workflow:**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - uses: actions-rs/toolchain@v1
      
      - name: Install dependencies
        run: npm install
      
      - name: Build and create release
        run: node scripts/create-release.js ${{ github.ref_name }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Additional Resources

- [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) - Comprehensive release checklist
- [BUILD.md](BUILD.md) - Production build guide
- [CODE_SIGNING.md](CODE_SIGNING.md) - Code signing instructions
- [Semantic Versioning](https://semver.org/) - Version numbering guidelines
- [Keep a Changelog](https://keepachangelog.com/) - Changelog format

## Support

For issues with release automation:

1. Check this documentation
2. Review script output for error messages
3. Check [Troubleshooting](#troubleshooting) section
4. Review GitHub Issues for similar problems
5. Contact the development team

---

**Last Updated:** 2024
**Version:** 1.0.0
**Maintainer:** Kiyya Development Team
