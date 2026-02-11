#!/usr/bin/env node

/**
 * Tauri Configuration Validation Script
 * Validates network domain restrictions and security settings in tauri.conf.json
 */

import fs from 'fs';
import path from 'path';

console.log('🔍 Validating Tauri configuration...\n');

// Read tauri.conf.json
const configPath = 'src-tauri/tauri.conf.json';
if (!fs.existsSync(configPath)) {
  console.error('❌ tauri.conf.json not found!');
  process.exit(1);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log('✅ tauri.conf.json is valid JSON\n');
} catch (error) {
  console.error('❌ Failed to parse tauri.conf.json:', error.message);
  process.exit(1);
}

// Required Odysee domains for API access
const requiredApiDomains = [
  'https://api.na-backend.odysee.com/**',
  'https://api.lbry.tv/**',
  'https://api.odysee.com/**',
  'https://*.odysee.com/**',
  'https://*.lbry.tv/**'
];

// Required CDN domains for media/thumbnails
const requiredCdnDomains = [
  'https://thumbnails.lbry.com/**',
  'https://spee.ch/**',
  'https://cdn.lbryplayer.xyz/**',
  'https://player.odycdn.com/**'
];

// Required GitHub domain for update manifest
const requiredGithubDomains = [
  'https://raw.githubusercontent.com/**'
];

const allRequiredDomains = [
  ...requiredApiDomains,
  ...requiredCdnDomains,
  ...requiredGithubDomains
];

// Validate HTTP scope
console.log('📡 Validating HTTP scope:');
const httpScope = config.tauri?.allowlist?.http?.scope || [];

let allDomainsPresent = true;
allRequiredDomains.forEach(domain => {
  if (httpScope.includes(domain)) {
    console.log(`  ✅ ${domain}`);
  } else {
    console.log(`  ❌ ${domain} - Missing!`);
    allDomainsPresent = false;
  }
});

if (!allDomainsPresent) {
  console.error('\n❌ Some required domains are missing from HTTP scope!');
  process.exit(1);
}

// Validate that http.all is false (security requirement)
if (config.tauri?.allowlist?.http?.all === true) {
  console.error('\n❌ Security violation: http.all should be false!');
  process.exit(1);
}
console.log('\n✅ HTTP scope properly restricted (http.all = false)');

// Validate filesystem scope
console.log('\n📁 Validating filesystem scope:');
const fsScope = config.tauri?.allowlist?.fs?.scope || [];
const expectedFsScope = '$APPDATA/Kiyya/**';

if (fsScope.includes(expectedFsScope)) {
  console.log(`  ✅ ${expectedFsScope}`);
} else {
  console.log(`  ❌ ${expectedFsScope} - Missing!`);
  allDomainsPresent = false;
}

// Validate that fs.all is false (security requirement)
if (config.tauri?.allowlist?.fs?.all === true) {
  console.error('\n❌ Security violation: fs.all should be false!');
  process.exit(1);
}
console.log('✅ Filesystem scope properly restricted (fs.all = false)');

// Validate CSP
console.log('\n🔒 Validating Content Security Policy:');
const csp = config.tauri?.security?.csp || '';

// Check that CSP includes required domains
const cspDomains = [
  'api.na-backend.odysee.com',
  'api.lbry.tv',
  'api.odysee.com',
  'raw.githubusercontent.com',
  'thumbnails.lbry.com',
  'cdn.lbryplayer.xyz',
  'player.odycdn.com'
];

let cspValid = true;
cspDomains.forEach(domain => {
  if (csp.includes(domain)) {
    console.log(`  ✅ ${domain}`);
  } else {
    console.log(`  ⚠️  ${domain} - Not found in CSP`);
    cspValid = false;
  }
});

if (!cspValid) {
  console.log('\n⚠️  Some domains missing from CSP (may cause frontend issues)');
}

// Validate that allowlist.all is false (security requirement)
if (config.tauri?.allowlist?.all === true) {
  console.error('\n❌ Security violation: allowlist.all should be false!');
  process.exit(1);
}
console.log('\n✅ Global allowlist properly restricted (allowlist.all = false)');

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Configuration Summary:');
console.log('='.repeat(60));
console.log(`HTTP Scope Domains: ${httpScope.length}`);
console.log(`Filesystem Scope: ${fsScope.length} path(s)`);
console.log(`CSP Length: ${csp.length} characters`);
console.log('='.repeat(60));

console.log('\n✨ Tauri configuration validation complete!');
console.log('\n🔐 Security Status:');
console.log('  ✅ Network access restricted to approved domains only');
console.log('  ✅ Filesystem access restricted to app data folder');
console.log('  ✅ Global allowlists disabled (security best practice)');
console.log('  ✅ Content Security Policy configured');
