#!/usr/bin/env node

/**
 * Release Creation Script for Kiyya Desktop
 * 
 * This script creates a GitHub release by:
 * 1. Building the application for all platforms
 * 2. Generating checksums for all artifacts
 * 3. Creating release notes from CHANGELOG.md
 * 4. Uploading artifacts to GitHub release
 * 
 * Prerequisites:
 * - GitHub CLI (gh) must be installed and authenticated
 * - Version tag must already exist (created by prepare-release.js)
 * - Build environment must be set up for target platform
 * 
 * Usage:
 *   node scripts/create-release.js <tag> [options]
 * 
 * Example:
 *   node scripts/create-release.js v1.1.0
 *   node scripts/create-release.js v1.1.0 --draft
 *   node scripts/create-release.js v1.1.0 --prerelease
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ ERROR: ${message}`, 'red');
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function warning(message) {
  log(`⚠️  WARNING: ${message}`, 'yellow');
}

function info(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function exec(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: 'pipe', ...options });
  } catch (err) {
    if (!options.ignoreError) {
      throw err;
    }
    return null;
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Usage: node scripts/create-release.js <tag> [options]

Arguments:
  tag           The git tag for the release (e.g., v1.1.0)

Options:
  --draft       Create as draft release (not published)
  --prerelease  Mark as pre-release
  --skip-build  Skip building (use existing artifacts)
  --help, -h    Show this help message

Examples:
  node scripts/create-release.js v1.1.0
  node scripts/create-release.js v1.1.0 --draft
  node scripts/create-release.js v1.1.0 --prerelease
    `);
    process.exit(0);
  }
  
  const tag = args[0];
  const draft = args.includes('--draft');
  const prerelease = args.includes('--prerelease');
  const skipBuild = args.includes('--skip-build');
  
  // Validate tag format
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
    error('Invalid tag format. Expected: vMAJOR.MINOR.PATCH (e.g., v1.1.0)');
    process.exit(1);
  }
  
  return { tag, draft, prerelease, skipBuild };
}

// Check if GitHub CLI is installed
function checkGitHubCLI() {
  info('Checking GitHub CLI...');
  
  try {
    exec('gh --version');
    success('GitHub CLI is installed');
    return true;
  } catch (err) {
    error('GitHub CLI (gh) is not installed');
    info('Install from: https://cli.github.com/');
    return false;
  }
}

// Check if authenticated with GitHub
function checkGitHubAuth() {
  info('Checking GitHub authentication...');
  
  try {
    exec('gh auth status');
    success('Authenticated with GitHub');
    return true;
  } catch (err) {
    error('Not authenticated with GitHub');
    info('Run: gh auth login');
    return false;
  }
}

// Check if tag exists
function checkTag(tag) {
  info(`Checking if tag ${tag} exists...`);
  
  try {
    exec(`git rev-parse ${tag}`);
    success(`Tag ${tag} exists`);
    return true;
  } catch (err) {
    error(`Tag ${tag} does not exist`);
    info('Run: node scripts/prepare-release.js <version>');
    return false;
  }
}

// Get platform information
function getPlatform() {
  const platform = process.platform;
  
  if (platform === 'win32') return 'windows';
  if (platform === 'darwin') return 'macos';
  if (platform === 'linux') return 'linux';
  
  return 'unknown';
}

// Build application
function buildApplication() {
  info('Building application...');
  info('This may take several minutes...');
  
  try {
    exec('npm run tauri:build:prod', { stdio: 'inherit' });
    success('Build completed successfully');
    return true;
  } catch (err) {
    error('Build failed');
    return false;
  }
}

// Find build artifacts
function findArtifacts() {
  const bundlePath = path.join(process.cwd(), 'src-tauri', 'target', 'release', 'bundle');
  
  if (!fs.existsSync(bundlePath)) {
    error('Bundle directory not found');
    return [];
  }
  
  const artifacts = [];
  const platform = getPlatform();
  
  // Windows artifacts
  if (platform === 'windows') {
    const msiPath = path.join(bundlePath, 'msi');
    if (fs.existsSync(msiPath)) {
      const msiFiles = fs.readdirSync(msiPath).filter(f => f.endsWith('.msi'));
      msiFiles.forEach(file => {
        artifacts.push({
          path: path.join(msiPath, file),
          name: file,
          type: 'installer'
        });
      });
    }
    
    const nsispath = path.join(bundlePath, 'nsis');
    if (fs.existsSync(nsispath)) {
      const exeFiles = fs.readdirSync(nsispath).filter(f => f.endsWith('.exe'));
      exeFiles.forEach(file => {
        artifacts.push({
          path: path.join(nsispath, file),
          name: file,
          type: 'installer'
        });
      });
    }
  }
  
  // macOS artifacts
  if (platform === 'macos') {
    const dmgPath = path.join(bundlePath, 'dmg');
    if (fs.existsSync(dmgPath)) {
      const dmgFiles = fs.readdirSync(dmgPath).filter(f => f.endsWith('.dmg'));
      dmgFiles.forEach(file => {
        artifacts.push({
          path: path.join(dmgPath, file),
          name: file,
          type: 'installer'
        });
      });
    }
  }
  
  // Linux artifacts
  if (platform === 'linux') {
    const debPath = path.join(bundlePath, 'deb');
    if (fs.existsSync(debPath)) {
      const debFiles = fs.readdirSync(debPath).filter(f => f.endsWith('.deb'));
      debFiles.forEach(file => {
        artifacts.push({
          path: path.join(debPath, file),
          name: file,
          type: 'package'
        });
      });
    }
    
    const appImagePath = path.join(bundlePath, 'appimage');
    if (fs.existsSync(appImagePath)) {
      const appImageFiles = fs.readdirSync(appImagePath).filter(f => f.endsWith('.AppImage'));
      appImageFiles.forEach(file => {
        artifacts.push({
          path: path.join(appImagePath, file),
          name: file,
          type: 'package'
        });
      });
    }
    
    const rpmPath = path.join(bundlePath, 'rpm');
    if (fs.existsSync(rpmPath)) {
      const rpmFiles = fs.readdirSync(rpmPath).filter(f => f.endsWith('.rpm'));
      rpmFiles.forEach(file => {
        artifacts.push({
          path: path.join(rpmPath, file),
          name: file,
          type: 'package'
        });
      });
    }
  }
  
  return artifacts;
}

// Calculate SHA256 checksum
function calculateChecksum(filePath) {
  const hash = crypto.createHash('sha256');
  const fileBuffer = fs.readFileSync(filePath);
  hash.update(fileBuffer);
  return hash.digest('hex');
}

// Generate checksums file
function generateChecksums(artifacts) {
  info('Generating checksums...');
  
  const checksums = [];
  
  for (const artifact of artifacts) {
    const checksum = calculateChecksum(artifact.path);
    checksums.push(`${checksum}  ${artifact.name}`);
    info(`  ${artifact.name}: ${checksum.substring(0, 16)}...`);
  }
  
  const checksumsPath = path.join(process.cwd(), 'SHA256SUMS');
  fs.writeFileSync(checksumsPath, checksums.join('\n') + '\n');
  
  success(`Checksums written to SHA256SUMS`);
  
  return {
    path: checksumsPath,
    name: 'SHA256SUMS',
    type: 'checksum'
  };
}

// Extract release notes from CHANGELOG.md
function extractReleaseNotes(tag) {
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
  
  if (!fs.existsSync(changelogPath)) {
    warning('CHANGELOG.md not found');
    return `Release ${tag}`;
  }
  
  const changelog = fs.readFileSync(changelogPath, 'utf-8');
  const version = tag.replace(/^v/, '');
  
  // Find the section for this version
  const versionRegex = new RegExp(`## \\[${version}\\][^]*?(?=## \\[|$)`, 's');
  const match = changelog.match(versionRegex);
  
  if (!match) {
    warning(`Release notes for ${version} not found in CHANGELOG.md`);
    return `Release ${tag}`;
  }
  
  // Clean up the release notes
  let notes = match[0];
  
  // Remove the version header
  notes = notes.replace(/^## \[.*?\].*?\n/, '');
  
  // Remove git commit comments
  notes = notes.replace(/<!-- Git commits.*?-->/gs, '');
  
  // Trim whitespace
  notes = notes.trim();
  
  return notes || `Release ${tag}`;
}

// Create GitHub release
function createGitHubRelease(tag, artifacts, checksumFile, options) {
  info('Creating GitHub release...');
  
  const releaseNotes = extractReleaseNotes(tag);
  const platform = getPlatform();
  
  // Write release notes to temporary file
  const notesPath = path.join(process.cwd(), '.release-notes.tmp');
  const fullNotes = `${releaseNotes}

## Platform
This release was built on: ${platform}

## Installation
Download the appropriate installer for your platform:
- **Windows**: \`.msi\` or \`.exe\` file
- **macOS**: \`.dmg\` file
- **Linux**: \`.deb\`, \`.AppImage\`, or \`.rpm\` file

## Verification
Verify the integrity of downloaded files using the \`SHA256SUMS\` file:

\`\`\`bash
# Linux/macOS
sha256sum -c SHA256SUMS

# Windows (PowerShell)
Get-FileHash <filename> -Algorithm SHA256
\`\`\`

## Notes
- For installation instructions, see [INSTALL_WINDOWS.md](INSTALL_WINDOWS.md) or [INSTALL_MACOS.md](INSTALL_MACOS.md)
- For code signing information, see [CODE_SIGNING.md](CODE_SIGNING.md)
`;
  
  fs.writeFileSync(notesPath, fullNotes);
  
  try {
    // Build gh release create command
    let cmd = `gh release create ${tag} --title "Release ${tag}" --notes-file "${notesPath}"`;
    
    if (options.draft) {
      cmd += ' --draft';
      info('Creating as draft release');
    }
    
    if (options.prerelease) {
      cmd += ' --prerelease';
      info('Marking as pre-release');
    }
    
    // Add artifacts
    const allArtifacts = [...artifacts, checksumFile];
    for (const artifact of allArtifacts) {
      cmd += ` "${artifact.path}"`;
    }
    
    exec(cmd, { stdio: 'inherit' });
    
    // Clean up temporary file
    fs.unlinkSync(notesPath);
    
    success(`GitHub release created: ${tag}`);
    
    if (options.draft) {
      info('Release is in draft mode. Publish it when ready from GitHub.');
    }
    
    return true;
  } catch (err) {
    error('Failed to create GitHub release');
    error(err.message);
    
    // Clean up temporary file
    if (fs.existsSync(notesPath)) {
      fs.unlinkSync(notesPath);
    }
    
    return false;
  }
}

// Main execution
async function main() {
  log('\n🚀 Kiyya Desktop - Release Creation\n', 'blue');
  
  const { tag, draft, prerelease, skipBuild } = parseArgs();
  
  info(`Creating release for ${tag}`);
  console.log('');
  
  // Pre-flight checks
  if (!checkGitHubCLI()) {
    process.exit(1);
  }
  
  if (!checkGitHubAuth()) {
    process.exit(1);
  }
  
  if (!checkTag(tag)) {
    process.exit(1);
  }
  
  console.log('');
  
  // Build application
  if (!skipBuild) {
    if (!buildApplication()) {
      process.exit(1);
    }
    console.log('');
  } else {
    warning('Skipping build (using existing artifacts)');
    console.log('');
  }
  
  // Find artifacts
  info('Finding build artifacts...');
  const artifacts = findArtifacts();
  
  if (artifacts.length === 0) {
    error('No build artifacts found');
    info('Make sure the build completed successfully');
    process.exit(1);
  }
  
  success(`Found ${artifacts.length} artifact(s):`);
  artifacts.forEach(a => info(`  - ${a.name}`));
  console.log('');
  
  // Generate checksums
  const checksumFile = generateChecksums(artifacts);
  console.log('');
  
  // Create GitHub release
  if (!createGitHubRelease(tag, artifacts, checksumFile, { draft, prerelease })) {
    process.exit(1);
  }
  
  console.log('');
  success('Release creation complete!');
  
  info('');
  info('Next steps:');
  info('  1. Verify the release on GitHub');
  info('  2. Update the version manifest (version.json) in kiyya-releases repository');
  info('  3. Test the update mechanism');
  if (draft) {
    info('  4. Publish the draft release when ready');
  }
}

main().catch((err) => {
  error(`Unexpected error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
