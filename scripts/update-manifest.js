#!/usr/bin/env node

/**
 * Update Manifest Script for Kiyya Desktop
 * 
 * This script updates the version.json manifest file in the kiyya-releases repository.
 * The manifest is used by the application's update checker to determine if updates are available.
 * 
 * Usage:
 *   node scripts/update-manifest.js <version> [options]
 * 
 * Example:
 *   node scripts/update-manifest.js 1.1.0
 *   node scripts/update-manifest.js 1.1.0 --min-version 1.0.0
 *   node scripts/update-manifest.js 1.1.0 --emergency-disable
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Usage: node scripts/update-manifest.js <version> [options]

Arguments:
  version              The new version number (e.g., 1.1.0)

Options:
  --min-version <ver>  Set minimum supported version (default: same as version)
  --emergency-disable  Enable emergency disable flag (blocks app startup)
  --output <path>      Output path for version.json (default: ./version.json)
  --github-repo <repo> GitHub repository (e.g., username/kiyya-releases)
  --help, -h           Show this help message

Examples:
  node scripts/update-manifest.js 1.1.0
  node scripts/update-manifest.js 1.1.0 --min-version 1.0.0
  node scripts/update-manifest.js 1.1.0 --emergency-disable
  node scripts/update-manifest.js 1.1.0 --github-repo myuser/kiyya-releases
    `);
    process.exit(0);
  }
  
  const version = args[0];
  
  // Validate version format
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    error('Invalid version format. Expected: major.minor.patch (e.g., 1.1.0)');
    process.exit(1);
  }
  
  // Parse options
  let minVersion = version;
  let emergencyDisable = false;
  let outputPath = path.join(process.cwd(), 'version.json');
  let githubRepo = null;
  
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--min-version' && args[i + 1]) {
      minVersion = args[i + 1];
      i++;
    } else if (args[i] === '--emergency-disable') {
      emergencyDisable = true;
    } else if (args[i] === '--output' && args[i + 1]) {
      outputPath = args[i + 1];
      i++;
    } else if (args[i] === '--github-repo' && args[i + 1]) {
      githubRepo = args[i + 1];
      i++;
    }
  }
  
  // Validate minVersion format
  if (!/^\d+\.\d+\.\d+$/.test(minVersion)) {
    error('Invalid min-version format. Expected: major.minor.patch (e.g., 1.0.0)');
    process.exit(1);
  }
  
  return { version, minVersion, emergencyDisable, outputPath, githubRepo };
}

// Extract release notes from CHANGELOG.md
function extractReleaseNotes(version) {
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
  
  if (!fs.existsSync(changelogPath)) {
    warning('CHANGELOG.md not found');
    return `Release ${version}`;
  }
  
  const changelog = fs.readFileSync(changelogPath, 'utf-8');
  
  // Find the section for this version
  const versionRegex = new RegExp(`## \\[${version}\\][^]*?(?=## \\[|$)`, 's');
  const match = changelog.match(versionRegex);
  
  if (!match) {
    warning(`Release notes for ${version} not found in CHANGELOG.md`);
    return `Release ${version}`;
  }
  
  // Clean up the release notes
  let notes = match[0];
  
  // Remove the version header
  notes = notes.replace(/^## \[.*?\].*?\n/, '');
  
  // Remove git commit comments
  notes = notes.replace(/<!-- Git commits.*?-->/gs, '');
  
  // Remove empty sections
  notes = notes.replace(/### \w+\n-\s*\n/g, '');
  
  // Trim whitespace
  notes = notes.trim();
  
  // Convert to single line for JSON (preserve line breaks as \n)
  notes = notes.replace(/\n/g, '\\n');
  
  return notes || `Release ${version}`;
}

// Get GitHub repository from package.json or .env
function getGitHubRepo(providedRepo) {
  if (providedRepo) {
    return providedRepo;
  }
  
  // Try to get from package.json
  const packagePath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packagePath)) {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    if (packageJson.repository && packageJson.repository.url) {
      const match = packageJson.repository.url.match(/github\.com[:/]([^/]+\/[^/.]+)/);
      if (match) {
        return match[1].replace('.git', '');
      }
    }
  }
  
  // Try to get from .env.production
  const envPath = path.join(process.cwd(), '.env.production');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/VITE_UPDATE_MANIFEST_URL=.*github\.com\/([^/]+\/[^/]+)/);
    if (match) {
      return match[1];
    }
  }
  
  warning('Could not determine GitHub repository');
  warning('Please provide --github-repo option or update package.json');
  return 'YOURNAME/kiyya-releases';
}

// Generate version manifest
function generateManifest(options) {
  const { version, minVersion, emergencyDisable, githubRepo } = options;
  
  const releaseNotes = extractReleaseNotes(version);
  const downloadUrl = `https://github.com/${githubRepo}/releases/tag/v${version}`;
  
  const manifest = {
    latestVersion: version,
    minSupportedVersion: minVersion,
    releaseNotes: releaseNotes,
    downloadUrl: downloadUrl,
  };
  
  // Only add emergencyDisable if true
  if (emergencyDisable) {
    manifest.emergencyDisable = true;
    warning('Emergency disable flag is SET - this will block app startup!');
  }
  
  return manifest;
}

// Write manifest to file
function writeManifest(manifest, outputPath) {
  const manifestJson = JSON.stringify(manifest, null, 2);
  
  fs.writeFileSync(outputPath, manifestJson + '\n');
  
  success(`Version manifest written to: ${outputPath}`);
}

// Display manifest preview
function displayManifest(manifest) {
  info('Generated manifest:');
  console.log('');
  console.log(JSON.stringify(manifest, null, 2));
  console.log('');
}

// Main execution
async function main() {
  log('\n🚀 Kiyya Desktop - Update Manifest Generator\n', 'blue');
  
  const args = parseArgs();
  const { version, minVersion, emergencyDisable, outputPath } = args;
  
  info(`Generating manifest for version ${version}`);
  console.log('');
  
  // Get GitHub repository
  const githubRepo = getGitHubRepo(args.githubRepo);
  info(`GitHub repository: ${githubRepo}`);
  console.log('');
  
  // Generate manifest
  const manifest = generateManifest({
    version,
    minVersion,
    emergencyDisable,
    githubRepo,
  });
  
  // Display manifest
  displayManifest(manifest);
  
  // Write manifest
  writeManifest(manifest, outputPath);
  
  console.log('');
  success('Manifest generation complete!');
  
  info('');
  info('Next steps:');
  info('  1. Review the generated version.json file');
  info('  2. Copy version.json to your kiyya-releases repository');
  info('  3. Commit and push to GitHub:');
  info(`     cd /path/to/${githubRepo}`);
  info('     git add version.json');
  info(`     git commit -m "Update manifest to v${version}"`);
  info('     git push origin main');
  info('  4. Verify the manifest is accessible:');
  info(`     https://raw.githubusercontent.com/${githubRepo}/main/version.json`);
  
  if (emergencyDisable) {
    console.log('');
    warning('⚠️  EMERGENCY DISABLE IS ENABLED ⚠️');
    warning('This will block all users from starting the application!');
    warning('Only use this for critical security issues or maintenance.');
    warning('To disable: regenerate manifest without --emergency-disable flag');
  }
}

main().catch((err) => {
  error(`Unexpected error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
