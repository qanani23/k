import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Tauri Configuration - Network Domain Restrictions', () => {
  const configPath = path.join(process.cwd(), 'src-tauri', 'tauri.conf.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  describe('HTTP Scope Configuration', () => {
    const httpScope = config.tauri?.allowlist?.http?.scope || [];

    it('should have http.all set to false for security', () => {
      expect(config.tauri?.allowlist?.http?.all).toBe(false);
    });

    it('should allow Odysee API domains', () => {
      const apiDomains = [
        'https://api.na-backend.odysee.com/**',
        'https://api.lbry.tv/**',
        'https://api.odysee.com/**',
        'https://*.odysee.com/**',
        'https://*.lbry.tv/**'
      ];

      apiDomains.forEach(domain => {
        expect(httpScope).toContain(domain);
      });
    });

    it('should allow Odysee CDN domains for media', () => {
      const cdnDomains = [
        'https://thumbnails.lbry.com/**',
        'https://spee.ch/**',
        'https://cdn.lbryplayer.xyz/**',
        'https://player.odycdn.com/**'
      ];

      cdnDomains.forEach(domain => {
        expect(httpScope).toContain(domain);
      });
    });

    it('should allow GitHub raw content for update manifest', () => {
      expect(httpScope).toContain('https://raw.githubusercontent.com/**');
    });

    it('should not allow unrestricted HTTP access', () => {
      // Ensure no wildcard domains that would allow all HTTPS
      const dangerousPatterns = [
        'https://**',
        'http://**',
        '*://**'
      ];

      dangerousPatterns.forEach(pattern => {
        expect(httpScope).not.toContain(pattern);
      });
    });

    it('should only allow HTTPS domains (no HTTP)', () => {
      const httpDomains = httpScope.filter((domain: string) => 
        domain.startsWith('http://') && !domain.includes('127.0.0.1')
      );
      
      expect(httpDomains).toHaveLength(0);
    });

    it('should have exactly the required number of domains', () => {
      // 5 API + 4 CDN + 1 GitHub = 10 domains
      expect(httpScope).toHaveLength(10);
    });
  });

  describe('Filesystem Scope Configuration', () => {
    const fsScope = config.tauri?.allowlist?.fs?.scope || [];

    it('should have fs.all set to false for security', () => {
      expect(config.tauri?.allowlist?.fs?.all).toBe(false);
    });

    it('should restrict filesystem access to app data folder only', () => {
      expect(fsScope).toContain('$APPDATA/Kiyya/**');
    });

    it('should not allow unrestricted filesystem access', () => {
      const dangerousPatterns = [
        '**',
        '$HOME/**',
        '$DESKTOP/**',
        '$DOCUMENT/**',
        'C:/**',
        '/'
      ];

      dangerousPatterns.forEach(pattern => {
        expect(fsScope).not.toContain(pattern);
      });
    });
  });

  describe('Content Security Policy', () => {
    const csp = config.tauri?.security?.csp || '';

    it('should have a Content Security Policy defined', () => {
      expect(csp).toBeTruthy();
      expect(csp.length).toBeGreaterThan(0);
    });

    it('should include Odysee API domains in connect-src', () => {
      expect(csp).toContain('api.na-backend.odysee.com');
      expect(csp).toContain('api.lbry.tv');
      expect(csp).toContain('api.odysee.com');
    });

    it('should include CDN domains for images and media', () => {
      expect(csp).toContain('thumbnails.lbry.com');
      expect(csp).toContain('cdn.lbryplayer.xyz');
      expect(csp).toContain('player.odycdn.com');
    });

    it('should include GitHub for update manifest', () => {
      expect(csp).toContain('raw.githubusercontent.com');
    });

    it('should allow local server for offline playback', () => {
      expect(csp).toContain('127.0.0.1');
    });

    it('should restrict default-src to self', () => {
      expect(csp).toMatch(/default-src\s+'self'/);
    });

    it('should not allow unsafe-eval in script-src', () => {
      expect(csp).not.toContain("'unsafe-eval'");
    });
  });

  describe('Global Security Settings', () => {
    it('should have allowlist.all set to false', () => {
      expect(config.tauri?.allowlist?.all).toBe(false);
    });

    it('should have shell.all set to false', () => {
      expect(config.tauri?.allowlist?.shell?.all).toBe(false);
    });

    it('should have window.all set to false', () => {
      expect(config.tauri?.allowlist?.window?.all).toBe(false);
    });

    it('should only allow shell.open for external links', () => {
      expect(config.tauri?.allowlist?.shell?.open).toBe(true);
      expect(config.tauri?.allowlist?.shell?.execute).not.toBe(true);
    });
  });

  describe('Security Requirement Validation', () => {
    it('should satisfy Requirement 12.1: restrict network access to approved Odysee domains only', () => {
      const httpScope = config.tauri?.allowlist?.http?.scope || [];
      
      // All domains should be either Odysee-related or GitHub (for updates)
      const allowedDomainPatterns = [
        /^https:\/\/.*\.odysee\.com/,
        /^https:\/\/.*\.lbry\.tv/,
        /^https:\/\/.*\.lbry\.com/,
        /^https:\/\/.*lbryplayer\.xyz/,
        /^https:\/\/.*odycdn\.com/,
        /^https:\/\/raw\.githubusercontent\.com/,
        /^https:\/\/spee\.ch/
      ];

      httpScope.forEach((domain: string) => {
        const isAllowed = allowedDomainPatterns.some(pattern => 
          pattern.test(domain)
        );
        expect(isAllowed).toBe(true);
      });
    });

    it('should satisfy Requirement 12.2: limit file system access to application data folder', () => {
      const fsScope = config.tauri?.allowlist?.fs?.scope || [];
      
      // Should only have app data folder
      expect(fsScope).toHaveLength(1);
      expect(fsScope[0]).toMatch(/\$APPDATA\/Kiyya/);
    });

    it('should satisfy Property 27: Security Boundary Enforcement', () => {
      // Network restrictions
      expect(config.tauri?.allowlist?.http?.all).toBe(false);
      expect(config.tauri?.allowlist?.http?.scope).toBeDefined();
      expect(config.tauri?.allowlist?.http?.scope.length).toBeGreaterThan(0);

      // Filesystem restrictions
      expect(config.tauri?.allowlist?.fs?.all).toBe(false);
      expect(config.tauri?.allowlist?.fs?.scope).toBeDefined();
      expect(config.tauri?.allowlist?.fs?.scope).toContain('$APPDATA/Kiyya/**');
    });
  });

  describe('Configuration Completeness', () => {
    it('should have all required allowlist sections defined', () => {
      expect(config.tauri?.allowlist).toBeDefined();
      expect(config.tauri?.allowlist?.http).toBeDefined();
      expect(config.tauri?.allowlist?.fs).toBeDefined();
      expect(config.tauri?.allowlist?.shell).toBeDefined();
      expect(config.tauri?.allowlist?.window).toBeDefined();
    });

    it('should have security section with CSP', () => {
      expect(config.tauri?.security).toBeDefined();
      expect(config.tauri?.security?.csp).toBeDefined();
    });

    it('should have proper package metadata', () => {
      expect(config.package?.productName).toBe('Kiyya');
      expect(config.package?.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });
});
