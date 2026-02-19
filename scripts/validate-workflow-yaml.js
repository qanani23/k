#!/usr/bin/env node

/**
 * Comprehensive GitHub Actions workflow YAML validation
 * 
 * This script performs full YAML parsing and validation of the stabilization workflow.
 * It checks for:
 * - Valid YAML syntax
 * - Required workflow structure
 * - Job dependencies
 * - Phase gate naming
 * - Action versions
 * - Step configurations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKFLOW_PATH = path.join(__dirname, '..', '.github', 'workflows', 'stabilization.yml');

function validateWorkflow() {
  console.log('🔍 Validating stabilization workflow YAML...\n');

  // Check if file exists
  if (!fs.existsSync(WORKFLOW_PATH)) {
    console.error('❌ Workflow file not found:', WORKFLOW_PATH);
    process.exit(1);
  }

  // Read workflow file
  const workflowContent = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  // Parse YAML
  let workflow;
  try {
    workflow = yaml.load(workflowContent);
    console.log('✅ YAML syntax is valid\n');
  } catch (error) {
    console.error('❌ YAML syntax error:', error.message);
    process.exit(1);
  }

  // Validation checks
  const checks = [];
  let passed = 0;
  let failed = 0;

  // Helper function to add check result
  const addCheck = (name, condition, error) => {
    if (condition) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.error(`❌ ${name}: ${error}`);
      failed++;
    }
  };

  // 1. Workflow name
  addCheck(
    'Workflow name',
    workflow.name === 'Stabilization CI',
    'Expected "Stabilization CI"'
  );

  // 2. Trigger events
  addCheck(
    'Pull request trigger',
    workflow.on?.pull_request?.branches?.includes('main'),
    'Missing pull_request trigger for main branch'
  );

  addCheck(
    'Push trigger',
    workflow.on?.push?.branches?.includes('main'),
    'Missing push trigger for main branch'
  );

  // 3. Jobs exist
  const expectedJobs = [
    'phase1-ipc-smoke',
    'phase2-cleanup',
    'phase3-coverage',
    'phase4-reproducible-claim',
    'phase5-zero-warnings'
  ];

  expectedJobs.forEach(jobName => {
    addCheck(
      `Job: ${jobName}`,
      workflow.jobs?.[jobName] !== undefined,
      `Job ${jobName} not found`
    );
  });

  // 4. Phase 1 matrix strategy
  addCheck(
    'Phase 1 matrix strategy',
    workflow.jobs?.['phase1-ipc-smoke']?.strategy?.matrix?.os?.length === 3,
    'Phase 1 should have 3 OS platforms in matrix'
  );

  // 5. Job dependencies
  addCheck(
    'Phase 2 depends on Phase 1',
    workflow.jobs?.['phase2-cleanup']?.needs === 'phase1-ipc-smoke',
    'Phase 2 should depend on phase1-ipc-smoke'
  );

  addCheck(
    'Phase 3 depends on Phase 2',
    workflow.jobs?.['phase3-coverage']?.needs === 'phase2-cleanup',
    'Phase 3 should depend on phase2-cleanup'
  );

  addCheck(
    'Phase 4 depends on Phase 3',
    workflow.jobs?.['phase4-reproducible-claim']?.needs === 'phase3-coverage',
    'Phase 4 should depend on phase3-coverage'
  );

  addCheck(
    'Phase 5 depends on Phase 4',
    workflow.jobs?.['phase5-zero-warnings']?.needs === 'phase4-reproducible-claim',
    'Phase 5 should depend on phase4-reproducible-claim'
  );

  // 6. Phase 5 conditional
  addCheck(
    'Phase 5 conditional execution',
    workflow.jobs?.['phase5-zero-warnings']?.if?.includes('phase5'),
    'Phase 5 should only run when branch contains phase5'
  );

  // 7. Check for required steps in Phase 1
  const phase1Steps = workflow.jobs?.['phase1-ipc-smoke']?.steps || [];
  const phase1StepNames = phase1Steps.map(s => s.name);

  addCheck(
    'Phase 1: Checkout step',
    phase1StepNames.some(n => n?.includes('Checkout')),
    'Missing checkout step'
  );

  addCheck(
    'Phase 1: Node.js setup',
    phase1StepNames.some(n => n?.includes('Node.js')),
    'Missing Node.js setup step'
  );

  addCheck(
    'Phase 1: Rust setup',
    phase1StepNames.some(n => n?.includes('Rust')),
    'Missing Rust setup step'
  );

  addCheck(
    'Phase 1: IPC smoke test',
    phase1Steps.some(s => s.run?.includes('ipc_smoke_test.js')),
    'Missing IPC smoke test step'
  );

  addCheck(
    'Phase 1: Artifact upload',
    phase1Steps.some(s => s.uses?.includes('upload-artifact')),
    'Missing artifact upload step'
  );

  // 8. Check for required steps in Phase 2
  const phase2Steps = workflow.jobs?.['phase2-cleanup']?.steps || [];
  const phase2StepRuns = phase2Steps.map(s => s.run).filter(Boolean);

  addCheck(
    'Phase 2: npm ci',
    phase2StepRuns.some(r => r.includes('npm ci')),
    'Missing npm ci step'
  );

  addCheck(
    'Phase 2: npm run lint',
    phase2StepRuns.some(r => r.includes('npm run lint')),
    'Missing npm run lint step'
  );

  addCheck(
    'Phase 2: npm run build',
    phase2StepRuns.some(r => r.includes('npm run build')),
    'Missing npm run build step'
  );

  addCheck(
    'Phase 2: cargo build',
    phase2StepRuns.some(r => r.includes('cargo build')),
    'Missing cargo build step'
  );

  addCheck(
    'Phase 2: cargo test',
    phase2StepRuns.some(r => r.includes('cargo test')),
    'Missing cargo test step'
  );

  addCheck(
    'Phase 2: cargo clippy',
    phase2StepRuns.some(r => r.includes('cargo clippy')),
    'Missing cargo clippy step'
  );

  // 9. Check clippy phase gate logic
  const clippySteps = phase2Steps.filter(s => s.run?.includes('cargo clippy'));
  
  addCheck(
    'Phase 2: Clippy with -A warnings (pre-Phase 5)',
    clippySteps.some(s => s.run?.includes('-A warnings') && s.if?.includes('!contains')),
    'Missing clippy step with -A warnings for pre-Phase 5'
  );

  addCheck(
    'Phase 2: Clippy with -D warnings (Phase 5+)',
    clippySteps.some(s => s.run?.includes('-D warnings') && s.if?.includes('contains')),
    'Missing clippy step with -D warnings for Phase 5+'
  );

  // 10. Check for required steps in Phase 3
  const phase3Steps = workflow.jobs?.['phase3-coverage']?.steps || [];
  const phase3StepRuns = phase3Steps.map(s => s.run).filter(Boolean);

  addCheck(
    'Phase 3: cargo tarpaulin',
    phase3StepRuns.some(r => r.includes('cargo tarpaulin')),
    'Missing cargo tarpaulin step'
  );

  addCheck(
    'Phase 3: cargo audit',
    phase3StepRuns.some(r => r.includes('cargo audit')),
    'Missing cargo audit step'
  );

  addCheck(
    'Phase 3: npm run test',
    phase3StepRuns.some(r => r.includes('npm run test')),
    'Missing npm run test step'
  );

  // 11. Check artifact uploads
  const allSteps = [
    ...phase1Steps,
    ...phase2Steps,
    ...phase3Steps
  ];

  const artifactUploads = allSteps.filter(s => s.uses?.includes('upload-artifact'));

  addCheck(
    'Artifact uploads present',
    artifactUploads.length >= 3,
    `Expected at least 3 artifact uploads, found ${artifactUploads.length}`
  );

  // 12. Check for if: always() on artifact uploads
  const artifactUploadsWithAlways = artifactUploads.filter(s => s.if === 'always()');

  addCheck(
    'Artifact uploads use if: always()',
    artifactUploadsWithAlways.length === artifactUploads.length,
    `${artifactUploads.length - artifactUploadsWithAlways.length} artifact uploads missing if: always()`
  );

  // 13. Check action versions
  const checkoutActions = allSteps.filter(s => s.uses?.includes('checkout'));
  addCheck(
    'Using checkout@v4',
    checkoutActions.every(s => s.uses?.includes('@v4')),
    'Some checkout actions not using @v4'
  );

  const nodeActions = allSteps.filter(s => s.uses?.includes('setup-node'));
  addCheck(
    'Using setup-node@v4',
    nodeActions.every(s => s.uses?.includes('@v4')),
    'Some setup-node actions not using @v4'
  );

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Validation Summary`);
  console.log(`${'='.repeat(60)}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📝 Total:  ${passed + failed}`);
  console.log(`${'='.repeat(60)}\n`);

  if (failed > 0) {
    console.error('❌ Workflow validation failed\n');
    console.log('💡 Tip: Review the failed checks above and update the workflow file.\n');
    process.exit(1);
  }

  console.log('✅ Workflow validation passed!\n');
  console.log('📋 Workflow Structure:');
  console.log(`   - Name: ${workflow.name}`);
  console.log(`   - Jobs: ${Object.keys(workflow.jobs || {}).length}`);
  console.log(`   - Total Steps: ${allSteps.length}`);
  console.log(`   - Artifact Uploads: ${artifactUploads.length}`);
  console.log('\n🚀 The workflow is ready to be pushed to GitHub!\n');
  console.log('Next steps:');
  console.log('  1. git add .github/workflows/stabilization.yml');
  console.log('  2. git commit -m "Add stabilization CI/CD workflow"');
  console.log('  3. git push');
  console.log('  4. Create a test PR to verify workflow execution\n');
}

validateWorkflow();
