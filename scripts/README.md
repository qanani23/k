# Scripts Directory

This directory contains automation scripts for building, testing, and releasing Kiyya Desktop.

## Available Scripts

### Build Scripts

#### `build-production.js`
Pre-build validation script that checks configuration and environment before building.

```bash
node scripts/build-production.js
```

**Checks:**
- `.env.production` file exists and is valid
- Required environment variables are set
- No placeholder values remain
- Version numbers are synchronized across files
- Dist directory is cleaned

#### `validate-config.js`
Validates environment configuration files.

```bash
node scripts/validate-config.js
```

#### `validate-tauri-config.js`
Validates Tauri configuration file.

```bash
node scripts/validate-tauri-config.js
```

### Release Scripts

#### `prepare-release.js`
Prepares a new release by validating, version bumping, and creating git tag.

```bash
node scripts/prepare-release.js <version> [--skip-tests]
```

**Example:**
```bash
node scripts/prepare-release.js 1.1.0
```

**What it does:**
1. Validates git status and branch
2. Runs tests, linting, and type checking
3. Updates version in all configuration files
4. Updates CHANGELOG.md
5. Creates git commit and tag

#### `create-release.js`
Builds application and creates GitHub release with artifacts.

```bash
node scripts/create-release.js <tag> [--draft] [--prerelease] [--skip-build]
```

**Example:**
```bash
node scripts/create-release.js v1.1.0
```

**What it does:**
1. Verifies GitHub CLI is installed and authenticated
2. Builds the application
3. Finds all build artifacts
4. Generates SHA256 checksums
5. Creates GitHub release with artifacts

#### `update-manifest.js`
Generates version.json manifest for the update system.

```bash
node scripts/update-manifest.js <version> [options]
```

**Example:**
```bash
node scripts/update-manifest.js 1.1.0 --min-version 1.0.0
```

**Options:**
- `--min-version <ver>` - Set minimum supported version
- `--emergency-disable` - Enable emergency disable flag
- `--output <path>` - Output path for version.json
- `--github-repo <repo>` - GitHub repository

## Quick Start

### Standard Release Workflow

```bash
# 1. Prepare release
node scripts/prepare-release.js 1.1.0

# 2. Push changes
git push origin main && git push origin v1.1.0

# 3. Create GitHub release
node scripts/create-release.js v1.1.0

# 4. Generate and publish manifest
node scripts/update-manifest.js 1.1.0 --min-version 1.0.0
cp version.json /path/to/kiyya-releases/
cd /path/to/kiyya-releases && git add version.json && git commit -m "Update to v1.1.0" && git push
```

### Using NPM Scripts

```bash
# Prepare release
npm run release:prepare -- 1.1.0

# Create release
npm run release:create -- v1.1.0

# Generate manifest
npm run release:manifest -- 1.1.0
```

## Prerequisites

### Required Tools

- **Node.js 18+** - For running scripts
- **npm** - For dependency management
- **Git** - For version control
- **GitHub CLI (gh)** - For creating releases
  ```bash
  # Install GitHub CLI
  # macOS: brew install gh
  # Windows: winget install --id GitHub.cli
  # Linux: See https://cli.github.com/
  
  # Authenticate
  gh auth login
  ```

### Configuration

Ensure these files are configured:
- `.env.production` - Production environment variables
- `package.json` - Version and repository information
- `src-tauri/tauri.conf.json` - Tauri configuration
- `src-tauri/Cargo.toml` - Rust package configuration

## Documentation

For detailed information, see:

- [RELEASE_AUTOMATION.md](../RELEASE_AUTOMATION.md) - Complete release automation guide
- [RELEASE_CHECKLIST.md](../RELEASE_CHECKLIST.md) - Release checklist
- [BUILD.md](../BUILD.md) - Production build guide
- [CODE_SIGNING.md](../CODE_SIGNING.md) - Code signing instructions

## Troubleshooting

### Common Issues

**"Git working directory is not clean"**
```bash
git status
git add . && git commit -m "Your changes"
```

**"GitHub CLI is not installed"**
```bash
# Install GitHub CLI (see Prerequisites above)
gh auth login
```

**"Tests failed"**
```bash
npm run test:unit
npm run test:property
# Fix failing tests, then re-run prepare script
```

**"No build artifacts found"**
```bash
npm run tauri:build:prod
# Check src-tauri/target/release/bundle/ for artifacts
```

## Script Development

### Adding New Scripts

1. Create script in `scripts/` directory
2. Add shebang: `#!/usr/bin/env node`
3. Make executable: `chmod +x scripts/your-script.js`
4. Add to `package.json` scripts section
5. Document in this README

### Script Guidelines

- Use ES modules (`import` instead of `require`)
- Include help text (`--help` flag)
- Provide clear error messages with colors
- Validate inputs before processing
- Exit with appropriate status codes (0 = success, 1 = error)
- Log progress and results clearly

### Color Codes

Scripts use ANSI color codes for output:

```javascript
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',    // Errors
  green: '\x1b[32m',  // Success
  yellow: '\x1b[33m', // Warnings
  blue: '\x1b[34m',   // Headers
  cyan: '\x1b[36m',   // Info
};
```

## Support

For issues with scripts:

1. Check script help: `node scripts/<script>.js --help`
2. Review error messages and logs
3. Check [Troubleshooting](#troubleshooting) section
4. Review [RELEASE_AUTOMATION.md](../RELEASE_AUTOMATION.md)
5. Contact the development team

---

**Last Updated:** 2024
**Maintainer:** Kiyya Development Team
