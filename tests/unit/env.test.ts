import { describe, it, expect } from 'vitest';

describe('Environment Variables', () => {
  it('should have all required VITE environment variables defined', () => {
    // Core API configuration
    expect(import.meta.env.VITE_ODYSSEE_PROXY).toBeDefined();
    expect(import.meta.env.VITE_CHANNEL_ID).toBeDefined();
    expect(import.meta.env.VITE_UPDATE_MANIFEST_URL).toBeDefined();
    
    // Verify proxy URL format
    expect(import.meta.env.VITE_ODYSSEE_PROXY).toMatch(/^https:\/\/api\./);
    
    // Verify channel ID format (should start with @)
    expect(import.meta.env.VITE_CHANNEL_ID).toMatch(/^@/);
    
    // Verify update manifest URL format
    expect(import.meta.env.VITE_UPDATE_MANIFEST_URL).toMatch(/^https:\/\/raw\.githubusercontent\.com/);
  });

  it('should have APP_VERSION or VITE_APP_VERSION defined', () => {
    const appVersion = import.meta.env.APP_VERSION || import.meta.env.VITE_APP_VERSION;
    expect(appVersion).toBeDefined();
    expect(appVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should have APP_NAME or VITE_APP_NAME defined', () => {
    const appName = import.meta.env.APP_NAME || import.meta.env.VITE_APP_NAME;
    expect(appName).toBeDefined();
    expect(appName).toBe('Kiyya');
  });

  it('should have optional configuration variables with defaults', () => {
    // These should have default values if not explicitly set
    const cacheTimeout = import.meta.env.VITE_CACHE_TTL_MS || '1800000';
    expect(parseInt(cacheTimeout)).toBeGreaterThan(0);
    
    const maxCacheItems = import.meta.env.VITE_MAX_CACHE_ITEMS || '200';
    expect(parseInt(maxCacheItems)).toBeGreaterThan(0);
    
    const networkTimeout = import.meta.env.VITE_NETWORK_TIMEOUT_MS || '10000';
    expect(parseInt(networkTimeout)).toBeGreaterThan(0);
  });

  it('should have valid boolean environment variables', () => {
    const debugMode = import.meta.env.TAURI_DEBUG;
    if (debugMode !== undefined) {
      expect(['true', 'false']).toContain(debugMode);
    }
    
    const enableAnimations = import.meta.env.VITE_ENABLE_ANIMATIONS;
    if (enableAnimations !== undefined) {
      expect(['true', 'false']).toContain(enableAnimations);
    }
  });

  it('should have valid theme configuration', () => {
    const defaultTheme = import.meta.env.VITE_DEFAULT_THEME || 'dark';
    expect(['dark', 'light']).toContain(defaultTheme);
  });

  it('should have valid video quality configuration', () => {
    const defaultQuality = import.meta.env.VITE_DEFAULT_VIDEO_QUALITY || 'auto';
    expect(['480p', '720p', '1080p', 'auto']).toContain(defaultQuality);
  });
});