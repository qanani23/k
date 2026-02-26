#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const outputFile = path.join(__dirname, '..', 'stabilization', 'clean_build_proof.txt');
const outputStream = fs.createWriteStream(outputFile);

console.log('Running cargo build and capturing output...');

const cargo = spawn('cargo', ['build', '--color=never'], {
  cwd: path.join(__dirname, '..', 'src-tauri'),
  shell: true
});

let output = '';

cargo.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stdout.write(text);
});

cargo.stderr.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stderr.write(text);
});

cargo.on('close', (code) => {
  // Write the complete output to file
  fs.writeFileSync(outputFile, output);
  
  console.log(`\n\nBuild output saved to: ${outputFile}`);
  console.log(`Build exit code: ${code}`);
  
  // Analyze the output
  const hasWarnings = output.includes('warning:');
  const hasErrors = output.includes('error:') || output.includes('error[');
  const succeeded = output.includes('Finished') && code === 0;
  
  console.log('\n=== Build Analysis ===');
  console.log(`Build succeeded: ${succeeded}`);
  console.log(`Warnings found: ${hasWarnings}`);
  console.log(`Errors found: ${hasErrors}`);
  
  if (succeeded && !hasWarnings && !hasErrors) {
    console.log('\n✓ CLEAN BUILD: Zero warnings, zero errors');
  } else if (succeeded && hasWarnings) {
    console.log('\n⚠ BUILD SUCCEEDED WITH WARNINGS');
  } else if (!succeeded) {
    console.log('\n✗ BUILD FAILED');
  }
  
  process.exit(code);
});
