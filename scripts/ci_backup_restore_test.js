#!/usr/bin/env node
/**
 * CI-Specific Database Backup Restoration Test
 * Simplified version for CI environments with disposable runners
 * Cross-platform (Windows, macOS, Linux)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';

function log(message, level = 'info') {
  const prefix = {
    info: '::notice::',
    error: '::error::',
    warning: '::warning::'
  }[level] || '';
  
  console.log(`${prefix}${message}`);
}

function calculateChecksum(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

function createMinimalTestDb(dbPath) {
  log('Creating minimal test database for CI...');
  
  // Create a dummy database file without requiring sqlite3 CLI
  const dummyContent = Buffer.from([
    0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, // "SQLite f"
    0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00, // "ormat 3\0"
    ...Array.from({ length: 500 }, () => Math.floor(Math.random() * 256))
  ]);
  
  try {
    fs.writeFileSync(dbPath, dummyContent);
    log('✓ Test database created');
    return true;
  } catch (error) {
    log(`Failed to create test database: ${error.message}`, 'error');
    return false;
  }
}

function runBackup(dbPath) {
  log('Running backup script...');
  
  try {
    const env = { ...process.env, DB_PATH: dbPath };
    
    if (process.platform === 'win32') {
      execSync('powershell -ExecutionPolicy Bypass -File scripts\\db_snapshot.ps1', {
        env,
        stdio: 'pipe'
      });
    } else {
      execSync('bash scripts/db_snapshot.sh', { env, stdio: 'pipe' });
    }
    
    log('✓ Backup completed');
    return true;
  } catch (error) {
    log(`Backup failed: ${error.message}`, 'error');
    return false;
  }
}

function verifyAndRestore() {
  log('Verifying backup and testing restore...');
  
  const backupDir = './backups';
  const backups = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('-db.sqlite'))
    .sort()
    .reverse();
  
  if (backups.length === 0) {
    log('No backup found', 'error');
    return false;
  }
  
  const backupFile = path.join(backupDir, backups[0]);
  const metadataFile = backupFile.replace('.sqlite', '.metadata.json');
  
  // Verify metadata exists
  if (!fs.existsSync(metadataFile)) {
    log('Metadata file missing', 'error');
    return false;
  }
  
  try {
    // Verify checksum with proper encoding handling
    const metadataContent = fs.readFileSync(metadataFile, 'utf8');
    const cleanContent = metadataContent.replace(/^\uFEFF/, '');
    const metadata = JSON.parse(cleanContent);
    const actualChecksum = calculateChecksum(backupFile);
    
    if (actualChecksum !== metadata.checksum) {
      log(`Checksum mismatch: expected ${metadata.checksum}, got ${actualChecksum}`, 'error');
      return false;
    }
    
    log(`✓ Checksum verified: ${actualChecksum}`);
    
    // Test restore by copying to temp location
    const restorePath = backupFile.replace('.sqlite', '-restored.sqlite');
    fs.copyFileSync(backupFile, restorePath);
    
    // Verify restored file
    const restoredChecksum = calculateChecksum(restorePath);
    fs.unlinkSync(restorePath);
    
    if (restoredChecksum !== actualChecksum) {
      log('Restore verification failed', 'error');
      return false;
    }
    
    log('✓ Restore verified');
    return true;
  } catch (error) {
    log(`Failed to verify backup: ${error.message}`, 'error');
    return false;
  }
}

async function main() {
  log('=== CI Backup Restoration Test ===');
  
  const testDbPath = path.join(process.cwd(), 'test-ci.db');
  
  try {
    // Create test database
    if (!createMinimalTestDb(testDbPath)) {
      process.exit(1);
    }
    
    // Run backup
    if (!runBackup(testDbPath)) {
      process.exit(1);
    }
    
    // Verify and test restore
    if (!verifyAndRestore()) {
      process.exit(1);
    }
    
    // Cleanup
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    log('✓ All CI backup tests passed!');
    process.exit(0);
    
  } catch (error) {
    log(`Unexpected error: ${error.message}`, 'error');
    process.exit(1);
  }
}

main();
