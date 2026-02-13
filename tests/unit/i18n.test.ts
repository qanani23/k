/**
 * Tests for i18n module
 * 
 * These tests verify that the i18n module is properly structured
 * and provides access to all translation strings.
 */

import { describe, it, expect } from 'vitest';
import { t, getTranslation, en } from '../../src/i18n';

describe('i18n Module', () => {
  describe('Translation Object', () => {
    it('should export the translation object', () => {
      expect(t).toBeDefined();
      expect(typeof t).toBe('object');
    });

    it('should have all required categories', () => {
      expect(t.common).toBeDefined();
      expect(t.nav).toBeDefined();
      expect(t.hero).toBeDefined();
      expect(t.player).toBeDefined();
      expect(t.downloads).toBeDefined();
      expect(t.favorites).toBeDefined();
      expect(t.settings).toBeDefined();
      expect(t.search).toBeDefined();
      expect(t.detail).toBeDefined();
      expect(t.forcedUpdate).toBeDefined();
      expect(t.emergencyDisable).toBeDefined();
      expect(t.offline).toBeDefined();
      expect(t.errors).toBeDefined();
      expect(t.aria).toBeDefined();
      expect(t.toast).toBeDefined();
      expect(t.categories).toBeDefined();
      expect(t.quality).toBeDefined();
      expect(t.time).toBeDefined();
      expect(t.fileSize).toBeDefined();
    });
  });

  describe('Common Translations', () => {
    it('should have app name', () => {
      expect(t.common.appName).toBe('Kiyya');
    });

    it('should have common action strings', () => {
      expect(t.common.play).toBe('Play');
      expect(t.common.pause).toBe('Pause');
      expect(t.common.save).toBe('Save');
      expect(t.common.cancel).toBe('Cancel');
      expect(t.common.delete).toBe('Delete');
      expect(t.common.close).toBe('Close');
    });

    it('should have loading and error states', () => {
      expect(t.common.loading).toBe('Loading...');
      expect(t.common.error).toBe('Error');
      expect(t.common.retry).toBe('Try Again');
    });
  });

  describe('Navigation Translations', () => {
    it('should have navigation items', () => {
      expect(t.nav.home).toBe('Home');
      expect(t.nav.movies).toBe('Movies');
      expect(t.nav.series).toBe('Series');
      expect(t.nav.sitcoms).toBe('Sitcoms');
      expect(t.nav.kids).toBe('Kids');
    });

    it('should have search placeholder', () => {
      expect(t.nav.searchPlaceholder).toBe('Search content...');
    });
  });

  describe('Hero Translations', () => {
    it('should have hero action strings', () => {
      expect(t.hero.play).toBe('Play');
      expect(t.hero.addToFavorites).toBe('Add to Favorites');
      expect(t.hero.removeFromFavorites).toBe('Remove from Favorites');
      expect(t.hero.shuffle).toBe('Shuffle hero content');
    });

    it('should have hero error messages', () => {
      expect(t.hero.failedToLoad).toBe('Failed to load hero content');
      expect(t.hero.noContentAvailable).toBe('No hero content available');
    });
  });

  describe('Player Translations', () => {
    it('should have player controls', () => {
      expect(t.player.play).toBe('Play');
      expect(t.player.pause).toBe('Pause');
      expect(t.player.mute).toBe('Mute');
      expect(t.player.unmute).toBe('Unmute');
      expect(t.player.fullscreen).toBe('Fullscreen');
    });

    it('should have player states', () => {
      expect(t.player.loading).toBe('Loading video...');
      expect(t.player.error).toBe('Failed to load video');
      expect(t.player.buffering).toBe('Buffering...');
    });
  });

  describe('Error Messages', () => {
    it('should have common error messages', () => {
      expect(t.errors.generic).toBe('Something went wrong');
      expect(t.errors.networkError).toBe('Network error occurred');
      expect(t.errors.loadFailed).toBe('Failed to load content');
      expect(t.errors.notFound).toBe('Content not found');
    });
  });

  describe('ARIA Labels', () => {
    it('should have accessibility labels', () => {
      expect(t.aria.openSearch).toBe('Open search');
      expect(t.aria.closeSearch).toBe('Close search');
      expect(t.aria.playVideo).toBe('Play video');
      expect(t.aria.pauseVideo).toBe('Pause video');
    });

    it('should have navigation ARIA labels', () => {
      expect(t.aria.mainNavigation).toBe('Main navigation');
    });
  });

  describe('Settings Translations', () => {
    it('should have settings page strings', () => {
      expect(t.settings.title).toBe('Settings');
      expect(t.settings.general).toBe('General');
      expect(t.settings.downloads).toBe('Downloads');
      expect(t.settings.advanced).toBe('Advanced');
      expect(t.settings.about).toBe('About');
    });

    it('should have theme strings', () => {
      expect(t.settings.theme).toBe('Theme');
      expect(t.settings.darkTheme).toBe('Dark');
      expect(t.settings.lightTheme).toBe('Light');
    });
  });

  describe('Forced Update Translations', () => {
    it('should have forced update strings', () => {
      expect(t.forcedUpdate.title).toBe('Update Required');
      expect(t.forcedUpdate.updateNow).toBe('Update Now');
      expect(t.forcedUpdate.exit).toBe('Exit');
    });
  });

  describe('Quality Translations', () => {
    it('should have quality level strings', () => {
      expect(t.quality.auto).toBe('Auto');
      expect(t.quality['1080p']).toBe('Full HD (1080p)');
      expect(t.quality['720p']).toBe('HD (720p)');
      expect(t.quality['480p']).toBe('SD (480p)');
    });
  });

  describe('File Size Translations', () => {
    it('should have file size unit strings', () => {
      expect(t.fileSize.bytes).toBe('B');
      expect(t.fileSize.kilobytes).toBe('KB');
      expect(t.fileSize.megabytes).toBe('MB');
      expect(t.fileSize.gigabytes).toBe('GB');
    });
  });

  describe('getTranslation Helper', () => {
    it('should get translation by category and key', () => {
      const appName = getTranslation('common', 'appName');
      expect(appName).toBe('Kiyya');
    });

    it('should return key if translation not found', () => {
      const missing = getTranslation('common', 'nonExistentKey');
      expect(missing).toBe('nonExistentKey');
    });
  });

  describe('English Translations Export', () => {
    it('should export en object', () => {
      expect(en).toBeDefined();
      expect(typeof en).toBe('object');
    });

    it('should match the default translation object', () => {
      expect(en).toEqual(t);
    });
  });

  describe('Type Safety', () => {
    it('should provide type-safe access to translations', () => {
      // This test verifies that TypeScript types are working
      // If this compiles, the types are correct
      const appName: string = t.common.appName;
      const playButton: string = t.player.play;
      const errorMessage: string = t.errors.generic;
      
      expect(appName).toBeDefined();
      expect(playButton).toBeDefined();
      expect(errorMessage).toBeDefined();
    });
  });

  describe('Completeness', () => {
    it('should have no empty strings', () => {
      const checkCategory = (category: Record<string, any>, path: string = '') => {
        Object.entries(category).forEach(([key, value]) => {
          const fullPath = path ? `${path}.${key}` : key;
          
          if (typeof value === 'string') {
            expect(value.length).toBeGreaterThan(0);
            expect(value.trim()).toBe(value); // No leading/trailing whitespace
          } else if (typeof value === 'object' && value !== null) {
            checkCategory(value, fullPath);
          }
        });
      };

      checkCategory(t);
    });

    it('should have consistent naming conventions', () => {
      // Check that all category keys are camelCase
      Object.keys(t).forEach(key => {
        expect(key).toMatch(/^[a-z][a-zA-Z0-9]*$/);
      });
    });
  });
});
