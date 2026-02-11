#!/usr/bin/env node

/**
 * Documentation Validation Script
 * 
 * Validates all documentation files for:
 * - Broken internal links
 * - Invalid file paths
 * - Missing referenced files
 * - Code block syntax
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Documentation files to validate
const DOC_FILES = [
  'README.md',
  'ARCHITECTURE.md',
  'UPLOADER_GUIDE.md',
  'TESTS.md',
  'DEVELOPER_NOTES.md',
  'SECURITY.md',
  'CHANGELOG.md',
  'BUILD.md',
  'RELEASE_AUTOMATION.md',
  'RELEASE_CHECKLIST.md',
  'scripts/README.md',
];

// Track validation results
const results = {
  totalFiles: 0,
  filesChecked: 0,
  errors: [],
  warnings: [],
};

/**
 * Check if a file exists
 */
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (err) {
    return false;
  }
}

/**
 * Extract markdown links from content
 */
function extractLinks(content) {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links = [];
  let match;
  
  while ((match = linkRegex.exec(content)) !== null) {
    links.push({
      text: match[1],
      url: match[2],
      fullMatch: match[0],
    });
  }
  
  return links;
}

/**
 * Extract file paths from content
 */
function extractFilePaths(content) {
  const patterns = [
    // Backtick file paths
    /`([^`]+\.(ts|tsx|js|jsx|rs|toml|json|md|sql|sh|yml|yaml))`/g,
    // Code block file references
    /```[\w]*\n\/\/ ([^\n]+\.(ts|tsx|js|jsx|rs))/g,
    // Explicit file references
    /File: `?([^`\s]+\.(ts|tsx|js|jsx|rs|toml|json|md|sql))`?/gi,
  ];
  
  const paths = new Set();
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      paths.add(match[1]);
    }
  });
  
  return Array.from(paths);
}

/**
 * Validate internal links
 */
function validateLinks(docFile, content) {
  const links = extractLinks(content);
  
  links.forEach(link => {
    const { url, text } = link;
    
    // Skip external URLs
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return;
    }
    
    // Skip anchors (we don't validate these)
    if (url.startsWith('#')) {
      return;
    }
    
    // Check if linked file exists
    const linkedPath = path.resolve(path.dirname(docFile), url);
    if (!fileExists(linkedPath)) {
      results.errors.push({
        file: docFile,
        type: 'broken-link',
        message: `Broken link: [${text}](${url})`,
        detail: `File not found: ${linkedPath}`,
      });
    }
  });
}

/**
 * Validate file path references
 */
function validateFilePaths(docFile, content) {
  const paths = extractFilePaths(content);
  
  paths.forEach(filePath => {
    // Skip example/placeholder paths
    if (filePath.includes('YOURNAME') || 
        filePath.includes('example') ||
        filePath.includes('...') ||
        filePath.startsWith('http')) {
      return;
    }
    
    // Check if file exists
    if (!fileExists(filePath)) {
      results.warnings.push({
        file: docFile,
        type: 'missing-file',
        message: `Referenced file not found: ${filePath}`,
      });
    }
  });
}

/**
 * Validate code blocks
 */
function validateCodeBlocks(docFile, content) {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;
  let blockIndex = 0;
  
  while ((match = codeBlockRegex.exec(content)) !== null) {
    blockIndex++;
    const language = match[1] || 'unknown';
    const code = match[2];
    
    // Check for common syntax issues
    if (language === 'typescript' || language === 'javascript' || language === 'ts' || language === 'js') {
      // Check for unmatched braces
      const openBraces = (code.match(/{/g) || []).length;
      const closeBraces = (code.match(/}/g) || []).length;
      
      if (openBraces !== closeBraces) {
        results.warnings.push({
          file: docFile,
          type: 'syntax-warning',
          message: `Code block #${blockIndex} (${language}): Unmatched braces (${openBraces} open, ${closeBraces} close)`,
        });
      }
    }
    
    if (language === 'rust' || language === 'rs') {
      // Check for unmatched braces
      const openBraces = (code.match(/{/g) || []).length;
      const closeBraces = (code.match(/}/g) || []).length;
      
      if (openBraces !== closeBraces) {
        results.warnings.push({
          file: docFile,
          type: 'syntax-warning',
          message: `Code block #${blockIndex} (${language}): Unmatched braces (${openBraces} open, ${closeBraces} close)`,
        });
      }
    }
  }
}

/**
 * Validate a single documentation file
 */
function validateDocFile(docFile) {
  if (!fileExists(docFile)) {
    results.errors.push({
      file: docFile,
      type: 'missing-doc',
      message: `Documentation file not found: ${docFile}`,
    });
    return;
  }
  
  results.filesChecked++;
  
  const content = fs.readFileSync(docFile, 'utf-8');
  
  // Run validations
  validateLinks(docFile, content);
  validateFilePaths(docFile, content);
  validateCodeBlocks(docFile, content);
}

/**
 * Main validation function
 */
function validateDocs() {
  console.log('🔍 Validating documentation files...\n');
  
  results.totalFiles = DOC_FILES.length;
  
  DOC_FILES.forEach(docFile => {
    console.log(`Checking: ${docFile}`);
    validateDocFile(docFile);
  });
  
  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('📊 Validation Results');
  console.log('='.repeat(60));
  console.log(`Total files: ${results.totalFiles}`);
  console.log(`Files checked: ${results.filesChecked}`);
  console.log(`Errors: ${results.errors.length}`);
  console.log(`Warnings: ${results.warnings.length}`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    results.errors.forEach((error, index) => {
      console.log(`\n${index + 1}. ${error.file}`);
      console.log(`   Type: ${error.type}`);
      console.log(`   ${error.message}`);
      if (error.detail) {
        console.log(`   ${error.detail}`);
      }
    });
  }
  
  if (results.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    results.warnings.forEach((warning, index) => {
      console.log(`\n${index + 1}. ${warning.file}`);
      console.log(`   Type: ${warning.type}`);
      console.log(`   ${warning.message}`);
    });
  }
  
  if (results.errors.length === 0 && results.warnings.length === 0) {
    console.log('\n✅ All documentation files validated successfully!');
    return 0;
  }
  
  if (results.errors.length > 0) {
    console.log('\n❌ Validation failed with errors.');
    return 1;
  }
  
  console.log('\n⚠️  Validation completed with warnings.');
  return 0;
}

// Run validation
const exitCode = validateDocs();
process.exit(exitCode);
