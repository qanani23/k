#!/usr/bin/env node

/**
 * Warning Parser and Categorizer
 * 
 * Parses audit_warnings.txt and audit_clippy.txt to categorize warnings by:
 * - Type (unused import, unused function, dead code, etc.)
 * - Module (file path)
 * 
 * Generates a summary report with warning counts.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Warning type patterns
const WARNING_PATTERNS = {
    'unused_import': /warning: unused import[s]?:/,
    'unused_variable': /warning: unused variable:/,
    'unused_assignment': /warning: value assigned to .* is never read/,
    'unused_function': /warning: function .* is never used/,
    'unused_method': /warning: method[s]? .* (?:is|are) never used/,
    'unused_struct': /warning: struct .* is never constructed/,
    'unused_enum_variant': /warning: variant[s]? .* (?:is|are) never constructed/,
    'unused_field': /warning: field[s]? .* (?:is|are) never read/,
    'unused_constant': /warning: constant .* is never used/,
    'unused_static': /warning: static .* is never used/,
    'unused_associated_item': /warning: associated item[s]? .* (?:is|are) never used/,
    'dead_code': /warning: .*#\[warn\(dead_code\)\]/,
    'unused_parens': /warning: unnecessary parentheses/,
    'clippy_too_many_arguments': /warning: this function has too many arguments/,
    'clippy_explicit_auto_deref': /warning: deref which would be done by auto-deref/,
    'clippy_redundant_closure': /warning: redundant closure/,
    'clippy_needless_borrows': /warning: the borrowed expression implements the required traits/,
    'clippy_useless_format': /warning: useless use of `format!`/,
    'clippy_collapsible_match': /warning: this `if let` can be collapsed/,
    'clippy_incompatible_msrv': /warning: current MSRV.*is stable in a `const` context/,
    'clippy_other': /warning:.*clippy::/,
};

// Extract module from file path
function extractModule(line) {
    const match = line.match(/-->\s+src[\\\/]([^:]+):/);
    if (match) {
        return match[1].replace(/\\/g, '/');
    }
    return 'unknown';
}

// Extract warning details
function extractWarningDetails(lines, index) {
    const warning = {
        type: 'unknown',
        module: 'unknown',
        line_number: null,
        item_name: null,
        snippet: '',
        full_text: ''
    };

    // Get the warning line - handle both PowerShell and direct format
    let warningLine = lines[index];
    
    // If it's PowerShell format (starts with "cargo : warning:"), extract the actual warning
    if (warningLine.includes('cargo :')) {
        const match = warningLine.match(/warning:\s*(.+)/);
        if (match) {
            warningLine = 'warning: ' + match[1];
        }
    }
    
    warning.full_text = warningLine;

    // Determine warning type
    for (const [type, pattern] of Object.entries(WARNING_PATTERNS)) {
        if (pattern.test(warningLine)) {
            warning.type = type;
            break;
        }
    }

    // Extract item name from warning line
    const itemMatch = warningLine.match(/`([^`]+)`/);
    if (itemMatch) {
        warning.item_name = itemMatch[1];
    }

    // Look ahead for file location
    for (let i = index + 1; i < Math.min(index + 15, lines.length); i++) {
        const line = lines[i];
        
        // Skip PowerShell error lines
        if (line.includes('CategoryInfo') || line.includes('FullyQualifiedErrorId') || line.includes('At C:\\')) {
            continue;
        }
        
        // Extract module and line number
        const locationMatch = line.match(/-->\s+src[\\\/]([^:]+):(\d+)/);
        if (locationMatch) {
            warning.module = locationMatch[1].replace(/\\/g, '/');
            warning.line_number = parseInt(locationMatch[2]);
        }

        // Extract code snippet
        const snippetMatch = line.match(/^\s*\d+\s*\|\s*(.+)$/);
        if (snippetMatch) {
            warning.snippet = snippetMatch[1].trim();
        }

        // Stop at next warning
        if ((line.includes('warning:') || line.startsWith('warning:')) && i > index + 5) {
            break;
        }
    }

    return warning;
}

// Parse warnings file
function parseWarningsFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return [];
    }

    // Read as buffer first to detect encoding
    const buffer = fs.readFileSync(filePath);
    let content;
    
    // Check for UTF-16 LE BOM (FF FE)
    if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
        content = buffer.toString('utf16le');
    } else {
        content = buffer.toString('utf-8');
        // Remove UTF-8 BOM if present
        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
        }
    }
    
    const lines = content.split(/\r?\n/);  // Handle both Unix and Windows line endings
    const warnings = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Look for warning lines - be more permissive
        if (line.match(/warning:\s+/) && 
            !line.includes('CategoryInfo') &&
            !line.includes('FullyQualifiedErrorId') &&
            !line.includes('generated') &&
            !line.match(/\d+\s+warnings?\s+\(/)) {  // Skip summary lines like "88 warnings (run"
            
            const warning = extractWarningDetails(lines, i);
            warnings.push(warning);
        }
    }

    return warnings;
}

// Group warnings by type
function groupByType(warnings) {
    const grouped = {};
    
    for (const warning of warnings) {
        if (!grouped[warning.type]) {
            grouped[warning.type] = [];
        }
        grouped[warning.type].push(warning);
    }

    return grouped;
}

// Group warnings by module
function groupByModule(warnings) {
    const grouped = {};
    
    for (const warning of warnings) {
        if (!grouped[warning.module]) {
            grouped[warning.module] = [];
        }
        grouped[warning.module].push(warning);
    }

    return grouped;
}

// Generate summary statistics
function generateSummary(warnings) {
    const byType = groupByType(warnings);
    const byModule = groupByModule(warnings);

    const summary = {
        total_warnings: warnings.length,
        by_type: {},
        by_module: {},
        top_modules: [],
        top_types: []
    };

    // Count by type
    for (const [type, items] of Object.entries(byType)) {
        summary.by_type[type] = items.length;
    }

    // Count by module
    for (const [module, items] of Object.entries(byModule)) {
        summary.by_module[module] = items.length;
    }

    // Top 10 modules by warning count
    summary.top_modules = Object.entries(summary.by_module)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([module, count]) => ({ module, count }));

    // Top 10 warning types
    summary.top_types = Object.entries(summary.by_type)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([type, count]) => ({ type, count }));

    return summary;
}

// Generate markdown report
function generateMarkdownReport(warnings, summary, outputPath) {
    let report = '# Warning Categorization Report\n\n';
    report += `**Generated:** ${new Date().toISOString()}\n\n`;
    report += `**Total Warnings:** ${summary.total_warnings}\n\n`;

    // Summary by type
    report += '## Summary by Warning Type\n\n';
    report += '| Warning Type | Count |\n';
    report += '|--------------|-------|\n';
    for (const { type, count } of summary.top_types) {
        report += `| ${type} | ${count} |\n`;
    }
    report += '\n';

    // Summary by module
    report += '## Summary by Module\n\n';
    report += '| Module | Warning Count |\n';
    report += '|--------|---------------|\n';
    for (const { module, count } of summary.top_modules) {
        report += `| ${module} | ${count} |\n`;
    }
    report += '\n';

    // Detailed breakdown by type
    report += '## Detailed Breakdown by Type\n\n';
    const byType = groupByType(warnings);
    
    for (const [type, items] of Object.entries(byType).sort((a, b) => b[1].length - a[1].length)) {
        report += `### ${type} (${items.length} warnings)\n\n`;
        
        // Group by module within this type
        const moduleGroups = {};
        for (const item of items) {
            if (!moduleGroups[item.module]) {
                moduleGroups[item.module] = [];
            }
            moduleGroups[item.module].push(item);
        }

        for (const [module, moduleItems] of Object.entries(moduleGroups).sort((a, b) => b[1].length - a[1].length)) {
            report += `**${module}** (${moduleItems.length} warnings):\n`;
            for (const item of moduleItems) {
                if (item.item_name) {
                    report += `- Line ${item.line_number || '?'}: \`${item.item_name}\`\n`;
                } else if (item.snippet) {
                    report += `- Line ${item.line_number || '?'}: ${item.snippet.substring(0, 60)}${item.snippet.length > 60 ? '...' : ''}\n`;
                } else {
                    report += `- Line ${item.line_number || '?'}\n`;
                }
            }
            report += '\n';
        }
    }

    // Detailed breakdown by module
    report += '## Detailed Breakdown by Module\n\n';
    const byModule = groupByModule(warnings);
    
    for (const [module, items] of Object.entries(byModule).sort((a, b) => b[1].length - a[1].length)) {
        report += `### ${module} (${items.length} warnings)\n\n`;
        
        // Group by type within this module
        const typeGroups = {};
        for (const item of items) {
            if (!typeGroups[item.type]) {
                typeGroups[item.type] = [];
            }
            typeGroups[item.type].push(item);
        }

        for (const [type, typeItems] of Object.entries(typeGroups).sort((a, b) => b[1].length - a[1].length)) {
            report += `**${type}** (${typeItems.length}):\n`;
            for (const item of typeItems) {
                if (item.item_name) {
                    report += `- Line ${item.line_number || '?'}: \`${item.item_name}\`\n`;
                } else if (item.snippet) {
                    report += `- Line ${item.line_number || '?'}: ${item.snippet.substring(0, 60)}${item.snippet.length > 60 ? '...' : ''}\n`;
                } else {
                    report += `- Line ${item.line_number || '?'}\n`;
                }
            }
            report += '\n';
        }
    }

    fs.writeFileSync(outputPath, report, 'utf-8');
    console.log(`Markdown report written to: ${outputPath}`);
}

// Generate JSON report
function generateJsonReport(warnings, summary, outputPath) {
    const report = {
        generated_at: new Date().toISOString(),
        summary,
        warnings_by_type: groupByType(warnings),
        warnings_by_module: groupByModule(warnings),
        all_warnings: warnings
    };

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`JSON report written to: ${outputPath}`);
}

// Main execution
function main() {
    const warningsFile = path.join(__dirname, '..', 'stabilization', 'audit_warnings.txt');
    const clippyFile = path.join(__dirname, '..', 'stabilization', 'audit_clippy.txt');
    const outputDir = path.join(__dirname, '..', 'stabilization');

    console.log('Parsing warnings...');
    const buildWarnings = parseWarningsFile(warningsFile);
    console.log(`Found ${buildWarnings.length} warnings in audit_warnings.txt`);

    const clippyWarnings = parseWarningsFile(clippyFile);
    console.log(`Found ${clippyWarnings.length} warnings in audit_clippy.txt`);

    // Combine all warnings
    const allWarnings = [...buildWarnings, ...clippyWarnings];
    console.log(`Total warnings: ${allWarnings.length}`);

    // Generate summary
    console.log('Generating summary...');
    const summary = generateSummary(allWarnings);

    // Generate reports
    const markdownPath = path.join(outputDir, 'warning_categorization.md');
    const jsonPath = path.join(outputDir, 'warning_categorization.json');

    generateMarkdownReport(allWarnings, summary, markdownPath);
    generateJsonReport(allWarnings, summary, jsonPath);

    console.log('\nSummary:');
    console.log(`Total warnings: ${summary.total_warnings}`);
    console.log('\nTop 5 warning types:');
    for (const { type, count } of summary.top_types.slice(0, 5)) {
        console.log(`  ${type}: ${count}`);
    }
    console.log('\nTop 5 modules with warnings:');
    for (const { module, count } of summary.top_modules.slice(0, 5)) {
        console.log(`  ${module}: ${count}`);
    }

    console.log('\n✓ Warning categorization complete!');
}

// Run if called directly
main();

export { parseWarningsFile, groupByType, groupByModule, generateSummary };
