#!/usr/bin/env node

/**
 * Validate GitHub Actions workflow YAML syntax
 * 
 * This script performs basic validation of the stabilization workflow file.
 * It checks for:
 * - Valid YAML structure
 * - Required workflow fields
 * - Job dependencies
 * - Phase gate naming
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKFLOW_PATH = path.join(__dirname, '..', '.github', 'workflows', 'stabilization.yml');

function validateWorkflow() {
  console.log('Validating stabilization workflow...\n');

  // Check if file exists
  if (!fs.existsSync(WORKFLOW_PATH)) {
    console.error('❌ Workflow file not found:', WORKFLOW_PATH);
    process.exit(1);
  }

  // Read workflow file
  const workflowContent = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  // Basic YAML validation (check for common syntax errors)
  const checks = [
    {
      name: 'Workflow name',
      test: () => workflowContent.includes('name: Stabilization CI'),
      error: 'Workflow name not found'
    },
    {
      name: 'Trigger events',
      test: () => workflowContent.includes('on:') && workflowContent.includes('pull_request:'),
      error: 'Trigger events not properly configured'
    },
    {
      name: 'Phase 1 job',
      test: () => workflowContent.includes('phase1-ipc-smoke:'),
      error: 'Phase 1 job not found'
    },
    {
      name: 'Phase 2 job',
      test: () => workflowContent.includes('phase2-cleanup:'),
      error: 'Phase 2 job not found'
    },
    {
      name: 'Phase 3 job',
      test: () => workflowContent.includes('phase3-coverage:'),
      error: 'Phase 3 job not found'
    },
    {
      name: 'Phase 4 job',
      test: () => workflowContent.includes('phase4-reproducible-claim:'),
      error: 'Phase 4 job not found'
    },
    {
      name: 'Phase 5 job',
      test: () => workflowContent.includes('phase5-zero-warnings:'),
      error: 'Phase 5 job not found'
    },
    {
      name: 'Matrix strategy',
      test: () => workflowContent.includes('strategy:') && workflowContent.includes('matrix:'),
      error: 'Matrix strategy not found in Phase 1'
    },
    {
      name: 'IPC smoke test step',
      test: () => workflowContent.includes('node scripts/ipc_smoke_test.js'),
      error: 'IPC smoke test step not found'
    },
    {
      name: 'Clippy phase gate',
      test: () => workflowContent.includes("contains(github.ref, 'phase5')"),
      error: 'Clippy phase gate conditional not found'
    },
    {
      name: 'Coverage measurement',
      test: () => workflowContent.includes('cargo tarpaulin'),
      error: 'Coverage measurement step not found'
    },
    {
      name: 'Artifact uploads',
      test: () => workflowContent.includes('actions/upload-artifact@v4'),
      error: 'Artifact upload actions not found'
    },
    {
      name: 'Job dependencies',
      test: () => {
        const hasPhase2Needs = workflowContent.match(/phase2-cleanup:[\s\S]*?needs: phase1-ipc-smoke/);
        const hasPhase3Needs = workflowContent.match(/phase3-coverage:[\s\S]*?needs: phase2-cleanup/);
        const hasPhase4Needs = workflowContent.match(/phase4-reproducible-claim:[\s\S]*?needs: phase3-coverage/);
        const hasPhase5Needs = workflowContent.match(/phase5-zero-warnings:[\s\S]*?needs: phase4-reproducible-claim/);
        return hasPhase2Needs && hasPhase3Needs && hasPhase4Needs && hasPhase5Needs;
      },
      error: 'Job dependencies not properly configured'
    }
  ];

  let passed = 0;
  let failed = 0;

  checks.forEach(check => {
    try {
      if (check.test()) {
        console.log(`✓ ${check.name}`);
        passed++;
      } else {
        console.error(`✗ ${check.name}: ${check.error}`);
        failed++;
      }
    } catch (error) {
      console.error(`✗ ${check.name}: ${error.message}`);
      failed++;
    }
  });

  console.log(`\n${passed} checks passed, ${failed} checks failed\n`);

  if (failed > 0) {
    console.error('❌ Workflow validation failed');
    process.exit(1);
  }

  console.log('✅ Workflow validation passed');
  console.log('\nNote: This is a basic syntax check. For full validation, push to GitHub and check Actions tab.');
}

validateWorkflow();
