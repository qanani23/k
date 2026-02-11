import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Test suite to verify NO analytics, telemetry, user tracking, or external monitoring SDKs
 * are present in the codebase.
 * 
 * This test ensures compliance with the requirement:
 * "NO analytics, telemetry, user tracking, or external monitoring SDKs"
 */
describe('No Analytics, Telemetry, or Tracking', () => {
  const rootDir = path.resolve(__dirname, '../..');
  
  // List of prohibited analytics/tracking services
  const prohibitedServices = [
    'segment',
    'mixpanel',
    'amplitude',
    'google-analytics',
    'gtag',
    'posthog',
    'sentry',
    'bugsnag',
    'rollbar',
    'datadog',
    'newrelic',
    'logrocket',
    'fullstory',
    'hotjar',
    'heap',
    'intercom',
    'drift',
  ];

  // List of prohibited tracking patterns
  const prohibitedPatterns = [
    /track\s*\(/i,
    /trackEvent/i,
    /sendEvent/i,
    /logEvent/i,
    /reportEvent/i,
    /analytics\./i,
    /telemetry\./i,
    /navigator\.sendBeacon/i,
  ];

  it('should not have analytics or tracking dependencies in package.json', () => {
    const packageJsonPath = path.join(rootDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    
    const allDependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
    
    const foundProhibited: string[] = [];
    
    for (const service of prohibitedServices) {
      for (const dep of Object.keys(allDependencies)) {
        if (dep.toLowerCase().includes(service)) {
          foundProhibited.push(`${dep} (matches prohibited service: ${service})`);
        }
      }
    }
    
    expect(foundProhibited).toEqual([]);
  });

  it('should not have analytics or tracking dependencies in Cargo.toml', () => {
    const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
    const cargoToml = fs.readFileSync(cargoTomlPath, 'utf-8');
    
    const foundProhibited: string[] = [];
    
    for (const service of prohibitedServices) {
      if (cargoToml.toLowerCase().includes(service)) {
        foundProhibited.push(`Found prohibited service in Cargo.toml: ${service}`);
      }
    }
    
    expect(foundProhibited).toEqual([]);
  });

  it('should not have external monitoring URLs in .env file', () => {
    const envPath = path.join(rootDir, '.env');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    
    const foundProhibited: string[] = [];
    
    for (const service of prohibitedServices) {
      if (envContent.toLowerCase().includes(service)) {
        // Check if it's in a comment or actual configuration
        const lines = envContent.split('\n');
        for (const line of lines) {
          if (line.toLowerCase().includes(service) && !line.trim().startsWith('#')) {
            foundProhibited.push(`Found prohibited service in .env: ${service} (line: ${line.trim()})`);
          }
        }
      }
    }
    
    expect(foundProhibited).toEqual([]);
  });

  it('should only make requests to approved Odysee domains and update manifest', () => {
    const envPath = path.join(rootDir, '.env');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    
    // Extract all URLs from .env
    const urlPattern = /https?:\/\/[^\s"']+/g;
    const urls = envContent.match(urlPattern) || [];
    
    const approvedDomains = [
      'api.na-backend.odysee.com',
      'api.lbry.tv',
      'api.odysee.com',
      'raw.githubusercontent.com',
      't.me',
      'github.com',
      'kiyya.app',
    ];
    
    const unapprovedUrls: string[] = [];
    
    for (const url of urls) {
      const isApproved = approvedDomains.some(domain => url.includes(domain));
      if (!isApproved) {
        unapprovedUrls.push(url);
      }
    }
    
    expect(unapprovedUrls).toEqual([]);
  });

  it('should not have tracking code patterns in TypeScript files', () => {
    const srcDir = path.join(rootDir, 'src');
    const foundProhibited: string[] = [];
    
    function scanDirectory(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip node_modules and dist directories
          if (entry.name !== 'node_modules' && entry.name !== 'dist') {
            scanDirectory(fullPath);
          }
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          
          // Check for prohibited patterns
          for (const pattern of prohibitedPatterns) {
            if (pattern.test(content)) {
              // Exclude false positives (like progress tracking for downloads)
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (pattern.test(line)) {
                  // Allow legitimate uses like "progress tracking" or "download tracking"
                  const isLegitimate = 
                    line.includes('progress') ||
                    line.includes('download') ||
                    line.includes('playback') ||
                    line.includes('// track') ||
                    line.includes('* track');
                  
                  if (!isLegitimate) {
                    foundProhibited.push(
                      `${path.relative(rootDir, fullPath)}:${i + 1} - ${line.trim()}`
                    );
                  }
                }
              }
            }
          }
          
          // Check for prohibited service imports
          for (const service of prohibitedServices) {
            if (content.includes(`from '${service}'`) || content.includes(`from "${service}"`)) {
              foundProhibited.push(
                `${path.relative(rootDir, fullPath)} - imports prohibited service: ${service}`
              );
            }
          }
        }
      }
    }
    
    scanDirectory(srcDir);
    expect(foundProhibited).toEqual([]);
  });

  it('should verify VITE_ENABLE_PERFORMANCE_MONITORING is set to false', () => {
    const envPath = path.join(rootDir, '.env');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    
    const performanceMonitoringLine = envContent
      .split('\n')
      .find(line => line.includes('VITE_ENABLE_PERFORMANCE_MONITORING'));
    
    expect(performanceMonitoringLine).toBeDefined();
    expect(performanceMonitoringLine).toContain('false');
  });

  it('should verify no monitoring.test.ts or monitoring.ts files exist', () => {
    const srcDir = path.join(rootDir, 'src');
    const testsDir = path.join(rootDir, 'tests');
    
    const foundMonitoringFiles: string[] = [];
    
    function scanForMonitoringFiles(dir: string) {
      if (!fs.existsSync(dir)) return;
      
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== 'dist') {
            scanForMonitoringFiles(fullPath);
          }
        } else if (entry.name.includes('monitoring')) {
          foundMonitoringFiles.push(path.relative(rootDir, fullPath));
        }
      }
    }
    
    scanForMonitoringFiles(srcDir);
    scanForMonitoringFiles(testsDir);
    
    expect(foundMonitoringFiles).toEqual([]);
  });

  it('should verify all monitoring data stays local (no external endpoints)', () => {
    // Check that gateway.rs only logs to local files
    const gatewayRsPath = path.join(rootDir, 'src-tauri', 'src', 'gateway.rs');
    const gatewayContent = fs.readFileSync(gatewayRsPath, 'utf-8');
    
    // Verify it writes to local log files
    expect(gatewayContent).toContain('gateway.log');
    
    // Verify it doesn't send logs to external services
    const externalLogServices = [
      'logstash',
      'elasticsearch',
      'splunk',
      'papertrail',
      'loggly',
    ];
    
    for (const service of externalLogServices) {
      expect(gatewayContent.toLowerCase()).not.toContain(service);
    }
  });

  it('should verify no user tracking or identification code exists', () => {
    const srcDir = path.join(rootDir, 'src');
    const foundTracking: string[] = [];
    
    const trackingPatterns = [
      /userId/i,
      /user_id/i,
      /anonymousId/i,
      /deviceId/i,
      /sessionId.*track/i,
      /identify\s*\(/i,
    ];
    
    function scanForTracking(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== 'dist') {
            scanForTracking(fullPath);
          }
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          
          for (const pattern of trackingPatterns) {
            if (pattern.test(content)) {
              // Check if it's actually tracking-related (not just a variable name)
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (pattern.test(line)) {
                  // Allow legitimate uses in comments or type definitions
                  const isLegitimate = 
                    line.trim().startsWith('//') ||
                    line.trim().startsWith('*') ||
                    line.includes('interface') ||
                    line.includes('type ');
                  
                  if (!isLegitimate && line.includes('track')) {
                    foundTracking.push(
                      `${path.relative(rootDir, fullPath)}:${i + 1} - ${line.trim()}`
                    );
                  }
                }
              }
            }
          }
        }
      }
    }
    
    scanForTracking(srcDir);
    
    // Filter out false positives (progress tracking, download tracking, etc.)
    const actualTracking = foundTracking.filter(item => 
      !item.includes('progress') &&
      !item.includes('download') &&
      !item.includes('playback')
    );
    
    expect(actualTracking).toEqual([]);
  });
});
