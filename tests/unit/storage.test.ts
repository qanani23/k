import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getStorageItem,
  setStorageItem,
  removeStorageItem,
  getStorageJSON,
  setStorageJSON,
  getTheme,
  setTheme,
  getLastUsedQuality,
  setLastUsedQuality,
  getAutoUpgradeQuality,
  setAutoUpgradeQuality,
  getVolume,
  setVolume,
  getPlaybackSpeed,
  setPlaybackSpeed,
  getAllPreferences,
  setAllPreferences,
  clearAllPreferences,
  getDeferredUpdateTime,
  setDeferredUpdateTime,
  clearDeferredUpdate,
  getSessionItem,
  setSessionItem,
  removeSessionItem,
  getSelectedHero,
  setSelectedHero,
  clearSelectedHero,
  StorageKeys,
  SessionStorageKeys,
  DEFAULT_PREFERENCES,
} from '../../src/lib/storage';

describe('Storage Utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  describe('Basic Storage Operations', () => {
    it('should get and set storage items', () => {
      const key = 'test-key';
      const value = 'test-value';

      expect(getStorageItem(key)).toBeNull();

      const success = setStorageItem(key, value);
      expect(success).toBe(true);
      expect(getStorageItem(key)).toBe(value);
    });

    it('should remove storage items', () => {
      const key = 'test-key';
      setStorageItem(key, 'value');

      const success = removeStorageItem(key);
      expect(success).toBe(true);
      expect(getStorageItem(key)).toBeNull();
    });

    it('should handle localStorage errors gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Mock localStorage to throw error
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      const result = getStorageItem('test');
      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
      getItemSpy.mockRestore();
    });
  });

  describe('JSON Storage Operations', () => {
    it('should get and set JSON objects', () => {
      const key = 'test-json';
      const value = { foo: 'bar', count: 42 };

      const result = getStorageJSON(key, { foo: 'default' });
      expect(result).toEqual({ foo: 'default' });

      const success = setStorageJSON(key, value);
      expect(success).toBe(true);

      const retrieved = getStorageJSON(key, { foo: 'default' });
      expect(retrieved).toEqual(value);
    });

    it('should return default value for invalid JSON', () => {
      const key = 'invalid-json';
      const defaultValue = { valid: true };

      localStorage.setItem(key, 'not valid json{');

      const result = getStorageJSON(key, defaultValue);
      expect(result).toEqual(defaultValue);
    });

    it('should handle JSON storage errors gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      const success = setStorageJSON('test', { data: 'value' });
      expect(success).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
      setItemSpy.mockRestore();
    });
  });

  describe('Theme Preferences', () => {
    it('should get and set theme', () => {
      expect(getTheme()).toBe('dark'); // default

      setTheme('light');
      expect(getTheme()).toBe('light');

      setTheme('dark');
      expect(getTheme()).toBe('dark');
    });

    it('should return default theme for invalid values', () => {
      localStorage.setItem(StorageKeys.THEME, 'invalid');
      expect(getTheme()).toBe('dark');
    });
  });

  describe('Quality Preferences', () => {
    it('should get and set last used quality', () => {
      expect(getLastUsedQuality()).toBe('720p'); // default

      setLastUsedQuality('1080p');
      expect(getLastUsedQuality()).toBe('1080p');
    });

    it('should get and set auto upgrade quality', () => {
      expect(getAutoUpgradeQuality()).toBe(true); // default

      setAutoUpgradeQuality(false);
      expect(getAutoUpgradeQuality()).toBe(false);

      setAutoUpgradeQuality(true);
      expect(getAutoUpgradeQuality()).toBe(true);
    });
  });

  describe('Volume Preferences', () => {
    it('should get and set volume', () => {
      expect(getVolume()).toBe(1.0); // default

      setVolume(0.5);
      expect(getVolume()).toBe(0.5);
    });

    it('should clamp volume between 0 and 1', () => {
      setVolume(1.5);
      expect(getVolume()).toBe(1.0);

      setVolume(-0.5);
      expect(getVolume()).toBe(0.0);
    });

    it('should return default for invalid volume values', () => {
      localStorage.setItem(StorageKeys.VOLUME, 'not-a-number');
      expect(getVolume()).toBe(1.0);
    });
  });

  describe('Playback Speed Preferences', () => {
    it('should get and set playback speed', () => {
      expect(getPlaybackSpeed()).toBe(1.0); // default

      setPlaybackSpeed(1.5);
      expect(getPlaybackSpeed()).toBe(1.5);

      setPlaybackSpeed(0.5);
      expect(getPlaybackSpeed()).toBe(0.5);
    });

    it('should return default for invalid speed values', () => {
      localStorage.setItem(StorageKeys.PLAYBACK_SPEED, 'invalid');
      expect(getPlaybackSpeed()).toBe(1.0);
    });
  });

  describe('All Preferences', () => {
    it('should get all preferences with defaults', () => {
      const prefs = getAllPreferences();
      expect(prefs).toEqual(DEFAULT_PREFERENCES);
    });

    it('should get all preferences with custom values', () => {
      setTheme('light');
      setLastUsedQuality('1080p');
      setAutoUpgradeQuality(false);
      setVolume(0.7);
      setPlaybackSpeed(1.25);

      const prefs = getAllPreferences();
      expect(prefs).toEqual({
        theme: 'light',
        lastUsedQuality: '1080p',
        autoUpgradeQuality: false,
        volume: 0.7,
        playbackSpeed: 1.25,
      });
    });

    it('should set all preferences', () => {
      const newPrefs = {
        theme: 'light' as const,
        lastUsedQuality: '480p',
        autoUpgradeQuality: false,
        volume: 0.8,
        playbackSpeed: 2.0,
      };

      const success = setAllPreferences(newPrefs);
      expect(success).toBe(true);

      const retrieved = getAllPreferences();
      expect(retrieved).toEqual(newPrefs);
    });

    it('should set partial preferences', () => {
      setTheme('light');
      setVolume(0.5);

      const success = setAllPreferences({
        theme: 'dark',
        lastUsedQuality: '1080p',
      });
      expect(success).toBe(true);

      const prefs = getAllPreferences();
      expect(prefs.theme).toBe('dark');
      expect(prefs.lastUsedQuality).toBe('1080p');
      expect(prefs.volume).toBe(0.5); // unchanged
    });

    it('should clear all preferences', () => {
      setTheme('light');
      setLastUsedQuality('1080p');
      setAutoUpgradeQuality(false);
      setVolume(0.5);
      setPlaybackSpeed(1.5);

      const success = clearAllPreferences();
      expect(success).toBe(true);

      const prefs = getAllPreferences();
      expect(prefs).toEqual(DEFAULT_PREFERENCES);
    });
  });

  describe('Deferred Update', () => {
    it('should get and set deferred update time', () => {
      const version = '1.2.0';
      const timestamp = Date.now() + 86400000; // 24 hours from now

      expect(getDeferredUpdateTime(version)).toBeNull();

      setDeferredUpdateTime(version, timestamp);
      expect(getDeferredUpdateTime(version)).toBe(timestamp);
    });

    it('should clear deferred update', () => {
      const version = '1.2.0';
      const timestamp = Date.now();

      setDeferredUpdateTime(version, timestamp);
      expect(getDeferredUpdateTime(version)).toBe(timestamp);

      clearDeferredUpdate(version);
      expect(getDeferredUpdateTime(version)).toBeNull();
    });

    it('should handle invalid timestamp values', () => {
      const version = '1.2.0';
      localStorage.setItem(StorageKeys.DEFERRED_UPDATE(version), 'not-a-number');

      expect(getDeferredUpdateTime(version)).toBeNull();
    });

    it('should handle different versions independently', () => {
      const version1 = '1.0.0';
      const version2 = '2.0.0';
      const timestamp1 = 1000;
      const timestamp2 = 2000;

      setDeferredUpdateTime(version1, timestamp1);
      setDeferredUpdateTime(version2, timestamp2);

      expect(getDeferredUpdateTime(version1)).toBe(timestamp1);
      expect(getDeferredUpdateTime(version2)).toBe(timestamp2);

      clearDeferredUpdate(version1);
      expect(getDeferredUpdateTime(version1)).toBeNull();
      expect(getDeferredUpdateTime(version2)).toBe(timestamp2);
    });
  });

  describe('Storage Keys', () => {
    it('should have correct storage key prefixes', () => {
      expect(StorageKeys.THEME).toBe('kiyya-theme');
      expect(StorageKeys.LAST_USED_QUALITY).toBe('kiyya-last-used-quality');
      expect(StorageKeys.AUTO_UPGRADE_QUALITY).toBe('kiyya-auto-upgrade-quality');
      expect(StorageKeys.VOLUME).toBe('kiyya-volume');
      expect(StorageKeys.PLAYBACK_SPEED).toBe('kiyya-playback-speed');
      expect(StorageKeys.SEARCH_HISTORY).toBe('kiyya-search-history');
    });

    it('should generate correct deferred update keys', () => {
      expect(StorageKeys.DEFERRED_UPDATE('1.0.0')).toBe('kiyya-deferred-update-1.0.0');
      expect(StorageKeys.DEFERRED_UPDATE('2.5.1')).toBe('kiyya-deferred-update-2.5.1');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string values', () => {
      setStorageItem('test', '');
      expect(getStorageItem('test')).toBe('');
    });

    it('should handle special characters in values', () => {
      const specialValue = 'test@#$%^&*()_+-={}[]|\\:";\'<>?,./';
      setStorageItem('test', specialValue);
      expect(getStorageItem('test')).toBe(specialValue);
    });

    it('should handle unicode characters', () => {
      const unicodeValue = '测试 🎬 テスト';
      setStorageItem('test', unicodeValue);
      expect(getStorageItem('test')).toBe(unicodeValue);
    });

    it('should handle very long strings', () => {
      const longValue = 'a'.repeat(10000);
      const success = setStorageItem('test', longValue);
      expect(success).toBe(true);
      expect(getStorageItem('test')).toBe(longValue);
    });
  });

  describe('Session Storage Operations', () => {
    it('should get and set session items', () => {
      const key = 'test-session-key';
      const value = 'test-session-value';

      expect(getSessionItem(key)).toBeNull();

      const success = setSessionItem(key, value);
      expect(success).toBe(true);
      expect(getSessionItem(key)).toBe(value);
    });

    it('should remove session items', () => {
      const key = 'test-session-key';
      setSessionItem(key, 'value');

      const success = removeSessionItem(key);
      expect(success).toBe(true);
      expect(getSessionItem(key)).toBeNull();
    });

    it('should handle sessionStorage errors gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      const result = getSessionItem('test');
      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
      getItemSpy.mockRestore();
    });
  });

  describe('Selected Hero Session Storage', () => {
    it('should get and set selected hero', () => {
      expect(getSelectedHero()).toBeNull();

      const claimId = 'hero-123';
      const success = setSelectedHero(claimId);
      expect(success).toBe(true);
      expect(getSelectedHero()).toBe(claimId);
    });

    it('should clear selected hero', () => {
      setSelectedHero('hero-123');
      expect(getSelectedHero()).toBe('hero-123');

      const success = clearSelectedHero();
      expect(success).toBe(true);
      expect(getSelectedHero()).toBeNull();
    });

    it('should use correct session storage key', () => {
      expect(SessionStorageKeys.SELECTED_HERO).toBe('kiyya-selected-hero');
    });

    it('should persist hero selection in sessionStorage', () => {
      const claimId = 'hero-456';
      setSelectedHero(claimId);

      // Verify it's actually in sessionStorage
      const stored = sessionStorage.getItem(SessionStorageKeys.SELECTED_HERO);
      expect(stored).toBe(claimId);
    });
  });
});
