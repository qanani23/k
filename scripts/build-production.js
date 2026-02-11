#!/usr/bin/env node

/**
 * Production Build Script for Kiyya Desktop
 * 
 * This script performs pre-build validation and sets up the environment
 * for production builds. It ensures all required configuration is present
 * and validates critical settings before building.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for terminal output
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

// Check if .env.production exists
function checkProductionEnv() {
  const envPath = path.join(process.cwd(), '.env.production');
  
  if (!fs.existsSync(envPath)) {
    error('.env.production file not found');
    info('Creating .env.production from .env template...');
    
    const envTemplatePath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envTemplatePath)) {
      fs.copyFileSync(envTemplatePath, envPath);
      success('Created .env.production file');
      warning('Please review and update .env.production with production values');
      return false;
    } else {
      error('No .env template found to copy from');
      return false;
    }
  }
  
  success('.env.production file exists');
  return true;
}

// Validate critical environment variables
function validateEnvVariables() {
  const envPath = path.join(process.cwd(), '.env.production');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  
  const requiredVars = [
    'VITE_CHANNEL_ID',
    'CHANNEL_ID',
    'VITE_UPDATE_MANIFEST_URL',
    'VITE_APP_VERSION',
    'APP_VERSION',
  ];
  
  const placeholderPatterns = [
    /YOURNAME/,
    /YourChannel/,
    /@kiyyamovies:b/,  // Default placeholder channel
  ];
  
  let hasErrors = false;
  let hasWarnings = false;
  
  // Check for required variables
  for (const varName of requiredVars) {
    const regex = new RegExp(`^${varName}=(.+)$`, 'm');
    const match = envContent.match(regex);
    
    if (!match || !match[1] || match[1].trim() === '') {
      error(`Missing or empty required variable: ${varName}`);
      hasErrors = true;
    }
  }
  
  // Check for placeholder values
  for (const pattern of placeholderPatterns) {
    if (pattern.test(envContent)) {
      warning(`Found placeholder value in .env.production: ${pattern}`);
      warning('Please update with actual production values before building');
      hasWarnings = true;
    }
  }
  
  if (hasErrors) {
    error('Environment validation failed');
    return false;
  }
  
  if (hasWarnings) {
    warning('Environment validation completed with warnings');
    info('Review the warnings above and update .env.production if needed');
  } else {
    success('Environment variables validated');
  }
  
  return true;
}

// Check version consistency
function checkVersionConsistency() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const tauriConfPath = path.join(process.cwd(), 'src-tauri', 'tauri.conf.json');
  const cargoTomlPath = path.join(process.cwd(), 'src-tauri', 'Cargo.toml');
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf-8'));
  const cargoToml = fs.readFileSync(cargoTomlPath, 'utf-8');
  
  const packageVersion = packageJson.version;
  const tauriVersion = tauriConf.package.version;
  const cargoVersionMatch = cargoToml.match(/^version\s*=\s*"([^"]+)"/m);
  const cargoVersion = cargoVersionMatch ? cargoVersionMatch[1] : null;
  
  if (packageVersion !== tauriVersion || packageVersion !== cargoVersion) {
    error('Version mismatch detected:');
    info(`  package.json: ${packageVersion}`);
    info(`  tauri.conf.json: ${tauriVersion}`);
    info(`  Cargo.toml: ${cargoVersion}`);
    error('All version numbers must match before building');
    return false;
  }
  
  success(`Version consistency verified: ${packageVersion}`);
  return true;
}

// Check if dist directory exists and clean it
function cleanDistDirectory() {
  const distPath = path.join(process.cwd(), 'dist');
  
  if (fs.existsSync(distPath)) {
    info('Cleaning dist directory...');
    fs.rmSync(distPath, { recursive: true, force: true });
    success('Dist directory cleaned');
  }
  
  return true;
}

// Main execution
async function main() {
  log('\n🚀 Kiyya Desktop - Production Build Validation\n', 'blue');
  
  const checks = [
    { name: 'Production environment file', fn: checkProductionEnv },
    { name: 'Environment variables', fn: validateEnvVariables },
    { name: 'Version consistency', fn: checkVersionConsistency },
    { name: 'Clean dist directory', fn: cleanDistDirectory },
  ];
  
  let allPassed = true;
  
  for (const check of checks) {
    info(`Checking: ${check.name}...`);
    const result = check.fn();
    
    if (!result) {
      allPassed = false;
      error(`Check failed: ${check.name}`);
    }
    
    console.log(''); // Empty line for readability
  }
  
  if (allPassed) {
    success('All pre-build checks passed!');
    info('You can now run: npm run tauri:build:prod');
    process.exit(0);
  } else {
    error('Some pre-build checks failed');
    info('Please fix the issues above before building');
    process.exit(1);
  }
}

main().catch((err) => {
  error(`Unexpected error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
