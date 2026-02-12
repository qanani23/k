#!/usr/bin/env node

/**
 * Validate Workflow Tests
 * 
 * This script validates that the workflow tests are properly structured
 * and can be parsed by Playwright.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Validating workflow tests...\n');

// Check if workflow test files exist
const e2eTestFile = path.join(__dirname, '../tests/e2e/workflows.spec.ts');
const unitTestFile = path.join(__dirname, '../tests/unit/workflow-integration.test.tsx');

let hasErrors = false;

// Validate E2E test file
if (fs.existsSync(e2eTestFile)) {
  console.log('✅ E2E workflow test file exists');
  
  const content = fs.readFileSync(e2eTestFile, 'utf8');
  
  // Check for test structure
  const testCount = (content.match(/test\(/g) || []).length;
  const describeCount = (content.match(/test\.describe\(/g) || []).length;
  
  console.log(`   - Found ${describeCount} test suites`);
  console.log(`   - Found ${testCount} test cases`);
  
  if (testCount === 0) {
    console.error('❌ No test cases found in E2E workflow tests');
    hasErrors = true;
  }
  
  // Check for required imports
  if (!content.includes("import { test, expect } from '@playwright/test'")) {
    console.error('❌ Missing Playwright imports in E2E tests');
    hasErrors = true;
  }
  
  // Check for async test functions
  const asyncTests = (content.match(/test\([^,]+,\s*async/g) || []).length;
  if (asyncTests !== testCount) {
    console.warn(`⚠️  Warning: Not all tests are async (${asyncTests}/${testCount})`);
  }
  
} else {
  console.error('❌ E2E workflow test file not found');
  hasErrors = true;
}

console.log('');

// Validate unit test file
if (fs.existsSync(unitTestFile)) {
  console.log('✅ Unit workflow integration test file exists');
  
  const content = fs.readFileSync(unitTestFile, 'utf8');
  
  // Check for test structure
  const testCount = (content.match(/it\(/g) || []).length;
  const describeCount = (content.match(/describe\(/g) || []).length;
  
  console.log(`   - Found ${describeCount} test suites`);
  console.log(`   - Found ${testCount} test cases`);
  
  if (testCount === 0) {
    console.error('❌ No test cases found in unit workflow tests');
    hasErrors = true;
  }
  
  // Check for required imports
  if (!content.includes("import { describe, it, expect")) {
    console.error('❌ Missing Vitest imports in unit tests');
    hasErrors = true;
  }
  
} else {
  console.error('❌ Unit workflow integration test file not found');
  hasErrors = true;
}

console.log('');

// Check documentation
const docsFile = path.join(__dirname, '../WORKFLOW_TESTS.md');
if (fs.existsSync(docsFile)) {
  console.log('✅ Workflow tests documentation exists');
} else {
  console.warn('⚠️  Warning: Workflow tests documentation not found');
}

const summaryFile = path.join(__dirname, '../WORKFLOW_TEST_SUMMARY.md');
if (fs.existsSync(summaryFile)) {
  console.log('✅ Workflow test summary exists');
} else {
  console.warn('⚠️  Warning: Workflow test summary not found');
}

console.log('');

if (hasErrors) {
  console.error('❌ Validation failed with errors');
  process.exit(1);
} else {
  console.log('✅ All workflow tests validated successfully!');
  console.log('');
  console.log('To run the tests:');
  console.log('  - Unit tests: npm test -- tests/unit/workflow-integration.test.tsx --run');
  console.log('  - E2E tests:  npm run test:e2e -- tests/e2e/workflows.spec.ts');
  console.log('');
  console.log('Note: E2E tests require the Tauri app to start, which may take 2-5 minutes.');
  process.exit(0);
}
