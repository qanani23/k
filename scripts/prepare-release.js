#!/usr/bin/env node

/**
 * Release Preparation Script for Kiyya Desktop
 * 
 * This script prepares a new release by:
 * 1. Validating the current state (tests, linting, etc.)
 * 2. Bumping version numbers across all configuration files
 * 3. Updating CHANGELOG.md with release notes
 * 4. Creating a git tag for the release
 * 
 * Usage:
 *   node scripts/prepare-release.js <version> [--skip-tests]
 * 
 * Example:
 *   node scripts/prepare-release.js 1.1.0
 *   node scripts/prepare-release.js 1.1.0 --skip-tests
 */

import fs from 'fs';
import path from 'path';
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
Usage: node scripts/prepare-release.js <version> [options]

Arguments:
  version       The new version number (e.g., 1.1.0)

Options:
  --skip-tests  Skip running tests (not recommended)
  --help, -h    Show this help message

Examples:
  node scripts/prepare-release.js 1.1.0
  node scripts/prepare-release.js 1.1.0 --skip-tests
    `);
    process.exit(0);
  }
  
  const version = args[0];
  const skipTests = args.includes('--skip-tests');
  
  // Validate version format
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    error('Invalid version format. Expected: major.minor.patch (e.g., 1.1.0)');
    process.exit(1);
  }
  
  return { version, skipTests };
}

// Check if git working directory is clean
function checkGitStatus() {
  info('Checking git status...');
  
  const status = exec('git status --porcelain');
  
  if (status && status.trim() !== '') {
    error('Git working directory is not clean');
    info('Please commit or stash your changes before preparing a release');
    return false;
  }
  
  success('Git working directory is clean');
  return true;
}

// Check if on main/master branch
function checkGitBranch() {
  info('Checking git branch...');
  
  const branch = exec('git branch --show-current').trim();
  
  if (branch !== 'main' && branch !== 'master') {
    warning(`You are on branch '${branch}', not 'main' or 'master'`);
    warning('Releases should typically be created from the main branch');
    // Don't fail, just warn
  } else {
    success(`On ${branch} branch`);
  }
  
  return true;
}

// Run tests
function runTests() {
  info('Running tests...');
  
  try {
    exec('npm run test:unit', { stdio: 'inherit' });
    success('Unit tests passed');
    
    exec('npm run test:property', { stdio: 'inherit' });
    success('Property-based tests passed');
    
    // E2E tests can be slow, make them optional
    info('Skipping E2E tests (run manually if needed)');
    
    return true;
  } catch (err) {
    error('Tests failed');
    return false;
  }
}

// Run linting
function runLinting() {
  info('Running linter...');
  
  try {
    exec('npm run lint', { stdio: 'inherit' });
    success('Linting passed');
    return true;
  } catch (err) {
    error('Linting failed');
    return false;
  }
}

// Run type checking
function runTypeCheck() {
  info('Running type check...');
  
  try {
    exec('npm run type-check', { stdio: 'inherit' });
    success('Type checking passed');
    return true;
  } catch (err) {
    error('Type checking failed');
    return false;
  }
}

// Update version in package.json
function updatePackageJson(version) {
  const packagePath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  
  const oldVersion = packageJson.version;
  packageJson.version = version;
  
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
  
  info(`Updated package.json: ${oldVersion} → ${version}`);
  return oldVersion;
}

// Update version in tauri.conf.json
function updateTauriConf(version) {
  const tauriConfPath = path.join(process.cwd(), 'src-tauri', 'tauri.conf.json');
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf-8'));
  
  tauriConf.package.version = version;
  
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  
  info(`Updated tauri.conf.json: ${version}`);
}

// Update version in Cargo.toml
function updateCargoToml(version) {
  const cargoTomlPath = path.join(process.cwd(), 'src-tauri', 'Cargo.toml');
  let cargoToml = fs.readFileSync(cargoTomlPath, 'utf-8');
  
  cargoToml = cargoToml.replace(
    /^version\s*=\s*"[^"]+"/m,
    `version = "${version}"`
  );
  
  fs.writeFileSync(cargoTomlPath, cargoToml);
  
  info(`Updated Cargo.toml: ${version}`);
}

// Update CHANGELOG.md
function updateChangelog(version, oldVersion) {
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
  
  // Create CHANGELOG.md if it doesn't exist
  if (!fs.existsSync(changelogPath)) {
    const initialContent = `# Changelog

All notable changes to Kiyya Desktop will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`;
    fs.writeFileSync(changelogPath, initialContent);
    info('Created CHANGELOG.md');
  }
  
  const changelog = fs.readFileSync(changelogPath, 'utf-8');
  const date = new Date().toISOString().split('T')[0];
  
  // Check if version already exists
  if (changelog.includes(`## [${version}]`)) {
    warning(`Version ${version} already exists in CHANGELOG.md`);
    return;
  }
  
  // Get git commits since last tag
  let commits = '';
  try {
    const lastTag = exec('git describe --tags --abbrev=0', { ignoreError: true });
    if (lastTag) {
      commits = exec(`git log ${lastTag.trim()}..HEAD --oneline --no-merges`);
    } else {
      commits = exec('git log --oneline --no-merges');
    }
  } catch (err) {
    warning('Could not retrieve git commits');
  }
  
  // Create new version entry
  const newEntry = `
## [${version}] - ${date}

### Added
- 

### Changed
- 

### Fixed
- 

### Security
- 

<!-- Git commits since last release:
${commits.trim()}
-->

`;
  
  // Insert after the header
  const lines = changelog.split('\n');
  const insertIndex = lines.findIndex(line => line.startsWith('## ['));
  
  if (insertIndex === -1) {
    // No previous versions, add after header
    const headerEndIndex = lines.findIndex((line, i) => i > 0 && line.trim() === '');
    lines.splice(headerEndIndex + 1, 0, newEntry);
  } else {
    lines.splice(insertIndex, 0, newEntry);
  }
  
  fs.writeFileSync(changelogPath, lines.join('\n'));
  
  success(`Updated CHANGELOG.md with version ${version}`);
  warning('Please edit CHANGELOG.md to add release notes before committing');
}

// Create git commit and tag
function createGitTag(version) {
  info('Creating git commit and tag...');
  
  try {
    // Stage version files
    exec('git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml CHANGELOG.md');
    
    // Create commit
    exec(`git commit -m "chore: release v${version}"`);
    success(`Created commit for v${version}`);
    
    // Create tag
    exec(`git tag -a v${version} -m "Release v${version}"`);
    success(`Created tag v${version}`);
    
    info('');
    info('Next steps:');
    info(`  1. Review CHANGELOG.md and update release notes`);
    info(`  2. If changes needed: git reset --soft HEAD~1, make changes, and re-run this script`);
    info(`  3. Push changes: git push origin main && git push origin v${version}`);
    info(`  4. Run: node scripts/create-release.js v${version}`);
    
    return true;
  } catch (err) {
    error('Failed to create git commit and tag');
    error(err.message);
    return false;
  }
}

// Main execution
async function main() {
  log('\n🚀 Kiyya Desktop - Release Preparation\n', 'blue');
  
  const { version, skipTests } = parseArgs();
  
  info(`Preparing release for version ${version}`);
  console.log('');
  
  // Pre-flight checks
  if (!checkGitStatus()) {
    process.exit(1);
  }
  
  checkGitBranch();
  console.log('');
  
  // Run validation
  if (!skipTests) {
    if (!runTests()) {
      error('Tests must pass before preparing a release');
      info('Use --skip-tests to skip tests (not recommended)');
      process.exit(1);
    }
    console.log('');
  } else {
    warning('Skipping tests (not recommended for production releases)');
    console.log('');
  }
  
  if (!runLinting()) {
    error('Linting must pass before preparing a release');
    process.exit(1);
  }
  console.log('');
  
  if (!runTypeCheck()) {
    error('Type checking must pass before preparing a release');
    process.exit(1);
  }
  console.log('');
  
  // Update version numbers
  info('Updating version numbers...');
  const oldVersion = updatePackageJson(version);
  updateTauriConf(version);
  updateCargoToml(version);
  success(`Version updated: ${oldVersion} → ${version}`);
  console.log('');
  
  // Update changelog
  updateChangelog(version, oldVersion);
  console.log('');
  
  // Create git commit and tag
  if (!createGitTag(version)) {
    process.exit(1);
  }
  
  console.log('');
  success('Release preparation complete!');
}

main().catch((err) => {
  error(`Unexpected error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
