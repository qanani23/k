#!/usr/bin/env node
/**
 * Database Backup Restoration Test Script
 * Tests backup creation and restoration on a disposable test database
 * Cross-platform (Windows, macOS, Linux)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function calculateChecksum(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

function createTestDatabase(dbPath) {
  log('Creating test database...', 'cyan');
  
  // Create a dummy database file with some content
  // This simulates a real database without requiring sqlite3 CLI
  const dummyContent = Buffer.from([
    0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, // "SQLite f"
    0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00, // "ormat 3\0"
    // Add some deterministic data to simulate a real database
    ...Array.from({ length: 1000 }, (_, i) => i % 256)
  ]);
  
  try {
    fs.writeFileSync(dbPath, dummyContent);
    log('✓ Test database created', 'green');
    return dummyContent.length;
  } catch (error) {
    log(`✗ Failed to create test database: ${error.message}`, 'red');
    return 0;
  }
}

function verifyDatabaseContent(dbPath, expectedSize) {
  log('Verifying database content...', 'cyan');
  
  try {
    const stats = fs.statSync(dbPath);
    
    if (stats.size === expectedSize) {
      log(`✓ Database size is ${stats.size} bytes (expected ${expectedSize})`, 'green');
      return true;
    } else {
      log(`✗ Database size is ${stats.size} bytes (expected ${expectedSize})`, 'red');
      return false;
    }
  } catch (error) {
    log(`✗ Failed to verify database content: ${error.message}`, 'red');
    return false;
  }
}

function runBackupScript(dbPath) {
  log('Running backup script...', 'cyan');
  
  try {
    const env = { ...process.env, DB_PATH: dbPath };
    
    if (process.platform === 'win32') {
      execSync('powershell -ExecutionPolicy Bypass -File scripts\\db_snapshot.ps1', {
        env,
        stdio: 'inherit'
      });
    } else {
      execSync('bash scripts/db_snapshot.sh', {
        env,
        stdio: 'inherit'
      });
    }
    
    log('✓ Backup script completed', 'green');
    return true;
  } catch (error) {
    log(`✗ Backup script failed: ${error.message}`, 'red');
    return false;
  }
}

function findLatestBackup() {
  log('Finding latest backup...', 'cyan');
  
  const backupDir = './backups';
  if (!fs.existsSync(backupDir)) {
    log('✗ Backup directory not found', 'red');
    return null;
  }
  
  const files = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('-db.sqlite'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    log('✗ No backup files found', 'red');
    return null;
  }
  
  const backupFile = path.join(backupDir, files[0]);
  const metadataFile = backupFile.replace('.sqlite', '.metadata.json');
  
  log(`✓ Found backup: ${backupFile}`, 'green');
  
  return { backupFile, metadataFile };
}

function verifyBackupIntegrity(backupFile, metadataFile) {
  log('Verifying backup integrity...', 'cyan');
  
  if (!fs.existsSync(backupFile)) {
    log(`✗ Backup file not found: ${backupFile}`, 'red');
    return false;
  }
  
  if (!fs.existsSync(metadataFile)) {
    log(`✗ Metadata file not found: ${metadataFile}`, 'red');
    return false;
  }
  
  try {
    // Read metadata with proper encoding handling
    const metadataContent = fs.readFileSync(metadataFile, 'utf8');
    // Remove BOM if present
    const cleanContent = metadataContent.replace(/^\uFEFF/, '');
    const metadata = JSON.parse(cleanContent);
    
    // Calculate checksum
    const actualChecksum = calculateChecksum(backupFile);
    const expectedChecksum = metadata.checksum;
    
    if (actualChecksum === expectedChecksum) {
      log(`✓ Checksum verified: ${actualChecksum}`, 'green');
      return true;
    } else {
      log(`✗ Checksum mismatch!`, 'red');
      log(`  Expected: ${expectedChecksum}`, 'red');
      log(`  Actual:   ${actualChecksum}`, 'red');
      return false;
    }
  } catch (error) {
    log(`✗ Failed to verify backup integrity: ${error.message}`, 'red');
    return false;
  }
}

function restoreBackup(backupFile, targetPath) {
  log('Restoring backup...', 'cyan');
  
  try {
    // Delete target if exists
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
    
    // Copy backup to target
    fs.copyFileSync(backupFile, targetPath);
    
    log(`✓ Backup restored to: ${targetPath}`, 'green');
    return true;
  } catch (error) {
    log(`✗ Failed to restore backup: ${error.message}`, 'red');
    return false;
  }
}

function cleanup(testDir) {
  log('Cleaning up test files...', 'cyan');
  
  try {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    log('✓ Cleanup complete', 'green');
  } catch (error) {
    log(`⚠ Cleanup warning: ${error.message}`, 'yellow');
  }
}

async function main() {
  log('\n=== Database Backup Restoration Test ===\n', 'cyan');
  
  // Create temporary test directory
  const testDir = path.join(os.tmpdir(), `kiyya-backup-test-${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });
  
  const originalDbPath = path.join(testDir, 'original.db');
  const restoredDbPath = path.join(testDir, 'restored.db');
  
  let success = true;
  let expectedSize = 0;
  
  try {
    // Step 1: Create test database
    log('\n--- Step 1: Create Test Database ---', 'yellow');
    expectedSize = createTestDatabase(originalDbPath);
    if (expectedSize === 0) {
      success = false;
      throw new Error('Failed to create test database');
    }
    
    // Step 2: Verify original database
    log('\n--- Step 2: Verify Original Database ---', 'yellow');
    if (!verifyDatabaseContent(originalDbPath, expectedSize)) {
      success = false;
      throw new Error('Failed to verify original database');
    }
    
    // Step 3: Run backup script
    log('\n--- Step 3: Run Backup Script ---', 'yellow');
    if (!runBackupScript(originalDbPath)) {
      success = false;
      throw new Error('Failed to run backup script');
    }
    
    // Step 4: Find latest backup
    log('\n--- Step 4: Find Latest Backup ---', 'yellow');
    const backup = findLatestBackup();
    if (!backup) {
      success = false;
      throw new Error('Failed to find backup');
    }
    
    // Step 5: Verify backup integrity
    log('\n--- Step 5: Verify Backup Integrity ---', 'yellow');
    if (!verifyBackupIntegrity(backup.backupFile, backup.metadataFile)) {
      success = false;
      throw new Error('Backup integrity check failed');
    }
    
    // Step 6: Restore backup
    log('\n--- Step 6: Restore Backup ---', 'yellow');
    if (!restoreBackup(backup.backupFile, restoredDbPath)) {
      success = false;
      throw new Error('Failed to restore backup');
    }
    
    // Step 7: Verify restored database
    log('\n--- Step 7: Verify Restored Database ---', 'yellow');
    if (!verifyDatabaseContent(restoredDbPath, expectedSize)) {
      success = false;
      throw new Error('Failed to verify restored database');
    }
    
    // Step 8: Compare checksums
    log('\n--- Step 8: Compare Original and Restored ---', 'yellow');
    const originalChecksum = calculateChecksum(originalDbPath);
    const restoredChecksum = calculateChecksum(restoredDbPath);
    
    if (originalChecksum === restoredChecksum) {
      log(`✓ Checksums match: ${originalChecksum}`, 'green');
    } else {
      log(`✗ Checksums do not match!`, 'red');
      log(`  Original: ${originalChecksum}`, 'red');
      log(`  Restored: ${restoredChecksum}`, 'red');
      success = false;
    }
    
  } catch (error) {
    log(`\n✗ Test failed: ${error.message}`, 'red');
    success = false;
  } finally {
    // Cleanup
    log('\n--- Cleanup ---', 'yellow');
    cleanup(testDir);
  }
  
  // Final result
  log('\n=== Test Result ===', 'cyan');
  if (success) {
    log('✓ All backup restoration tests passed!', 'green');
    process.exit(0);
  } else {
    log('✗ Backup restoration tests failed!', 'red');
    process.exit(1);
  }
}

// Run the test
main().catch(error => {
  log(`\n✗ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});
