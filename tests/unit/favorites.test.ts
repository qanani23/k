import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Favorites System Tests
 * 
 * This test suite verifies that:
 * 1. SQLite is the single source of truth for favorites
 * 2. LocalStorage is NEVER used for favorites data
 * 3. All favorites operations go through Tauri commands to SQLite backend
 * 4. UI preferences (not data) may use LocalStorage
 */

// Mock Tauri API
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}));

import * as api from '../../src/lib/api';
import { invoke } from '@tauri-apps/api/tauri';

describe('Favorites Storage - SQLite Only', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage to ensure we're not using it
    localStorage.clear();
  });

  describe('SQLite as Single Source of Truth', () => {
    it('should save favorite to SQLite via Tauri command', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await api.saveFavorite({
        claim_id: 'test-claim-123',
        title: 'Test Movie',
        thumbnail_url: 'https://example.com/thumb.jpg',
      });

      // Verify Tauri command was called (which goes to SQLite)
      expect(invoke).toHaveBeenCalledWith('save_favorite', {
        claim_id: 'test-claim-123',
        title: 'Test Movie',
        thumbnail_url: 'https://example.com/thumb.jpg',
      });

      // Verify localStorage was NOT used for data storage
      expect(localStorage.getItem('favorites')).toBeNull();
      expect(localStorage.getItem('kiyya-favorites')).toBeNull();
    });

    it('should retrieve favorites from SQLite via Tauri command', async () => {
      const mockFavorites = [
        {
          claim_id: 'fav-1',
          title: 'Favorite 1',
          thumbnail_url: 'https://example.com/thumb1.jpg',
          inserted_at: 1234567890,
        },
        {
          claim_id: 'fav-2',
          title: 'Favorite 2',
          thumbnail_url: 'https://example.com/thumb2.jpg',
          inserted_at: 1234567891,
        },
      ];

      vi.mocked(invoke).mockResolvedValue(mockFavorites);

      const result = await api.getFavorites();

      // Verify Tauri command was called (which queries SQLite)
      expect(invoke).toHaveBeenCalledWith('get_favorites');
      expect(result).toEqual(mockFavorites);

      // Verify localStorage was NOT used for data retrieval
      expect(localStorage.getItem('favorites')).toBeNull();
      expect(localStorage.getItem('kiyya-favorites')).toBeNull();
    });

    it('should remove favorite from SQLite via Tauri command', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await api.removeFavorite('test-claim-123');

      // Verify Tauri command was called (which removes from SQLite)
      expect(invoke).toHaveBeenCalledWith('remove_favorite', {
        claim_id: 'test-claim-123',
      });

      // Verify localStorage was NOT used for data removal
      expect(localStorage.getItem('favorites')).toBeNull();
      expect(localStorage.getItem('kiyya-favorites')).toBeNull();
    });

    it('should check favorite status from SQLite via Tauri command', async () => {
      vi.mocked(invoke).mockResolvedValue(true);

      const result = await api.isFavorite('test-claim-123');

      // Verify Tauri command was called (which checks SQLite)
      expect(invoke).toHaveBeenCalledWith('is_favorite', {
        claim_id: 'test-claim-123',
      });
      expect(result).toBe(true);

      // Verify localStorage was NOT used for status check
      expect(localStorage.getItem('favorites')).toBeNull();
      expect(localStorage.getItem('kiyya-favorites')).toBeNull();
    });
  });

  describe('LocalStorage Isolation', () => {
    it('should never write favorites data to localStorage', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      // Save multiple favorites
      await api.saveFavorite({
        claim_id: 'claim-1',
        title: 'Movie 1',
        thumbnail_url: 'https://example.com/thumb1.jpg',
      });

      await api.saveFavorite({
        claim_id: 'claim-2',
        title: 'Movie 2',
        thumbnail_url: 'https://example.com/thumb2.jpg',
      });

      // Verify no favorites data in localStorage
      const allKeys = Object.keys(localStorage);
      const favoriteKeys = allKeys.filter(key => 
        key.toLowerCase().includes('favorite') || 
        key.toLowerCase().includes('fav')
      );

      expect(favoriteKeys).toHaveLength(0);
    });

    it('should never read favorites data from localStorage', async () => {
      // Attempt to pollute localStorage with fake favorites data
      localStorage.setItem('favorites', JSON.stringify([
        { claim_id: 'fake-1', title: 'Fake Movie' }
      ]));
      localStorage.setItem('kiyya-favorites', JSON.stringify([
        { claim_id: 'fake-2', title: 'Another Fake' }
      ]));

      const mockFavorites = [
        {
          claim_id: 'real-1',
          title: 'Real Movie',
          thumbnail_url: 'https://example.com/thumb.jpg',
          inserted_at: 1234567890,
        },
      ];

      vi.mocked(invoke).mockResolvedValue(mockFavorites);

      const result = await api.getFavorites();

      // Verify we got data from SQLite, not localStorage
      expect(result).toEqual(mockFavorites);
      expect(result[0].claim_id).toBe('real-1');
      expect(result[0].claim_id).not.toBe('fake-1');
      expect(result[0].claim_id).not.toBe('fake-2');
    });

    it('should allow localStorage for UI preferences only', () => {
      // These are acceptable uses of localStorage (UI preferences, not data)
      localStorage.setItem('kiyya-theme', 'dark');
      localStorage.setItem('kiyya-volume', '0.8');
      localStorage.setItem('kiyya-playback-speed', '1.0');
      localStorage.setItem('kiyya-search-history', JSON.stringify(['search1', 'search2']));

      // Verify UI preferences can be stored
      expect(localStorage.getItem('kiyya-theme')).toBe('dark');
      expect(localStorage.getItem('kiyya-volume')).toBe('0.8');
      expect(localStorage.getItem('kiyya-playback-speed')).toBe('1.0');
      expect(localStorage.getItem('kiyya-search-history')).toBeTruthy();

      // But favorites data should NOT be in localStorage
      expect(localStorage.getItem('favorites')).toBeNull();
      expect(localStorage.getItem('kiyya-favorites')).toBeNull();
    });
  });

  describe('Data Integrity', () => {
    it('should maintain favorites data through SQLite only', async () => {
      const favorite = {
        claim_id: 'test-claim',
        title: 'Test Movie',
        thumbnail_url: 'https://example.com/thumb.jpg',
      };

      // Save favorite
      vi.mocked(invoke).mockResolvedValue(undefined);
      await api.saveFavorite(favorite);

      // Check if favorite exists
      vi.mocked(invoke).mockResolvedValue(true);
      const isFav = await api.isFavorite('test-claim');
      expect(isFav).toBe(true);

      // Get all favorites
      vi.mocked(invoke).mockResolvedValue([
        {
          ...favorite,
          inserted_at: 1234567890,
        },
      ]);
      const favorites = await api.getFavorites();
      expect(favorites).toHaveLength(1);
      expect(favorites[0].claim_id).toBe('test-claim');

      // Remove favorite
      vi.mocked(invoke).mockResolvedValue(undefined);
      await api.removeFavorite('test-claim');

      // Verify all operations went through Tauri commands (SQLite)
      expect(invoke).toHaveBeenCalledTimes(4);
      expect(invoke).toHaveBeenCalledWith('save_favorite', expect.any(Object));
      expect(invoke).toHaveBeenCalledWith('is_favorite', expect.any(Object));
      expect(invoke).toHaveBeenCalledWith('get_favorites');
      expect(invoke).toHaveBeenCalledWith('remove_favorite', expect.any(Object));

      // Verify localStorage was never touched
      expect(localStorage.length).toBe(0);
    });

    it('should handle errors without falling back to localStorage', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Database error'));

      // Attempt to get favorites when SQLite fails
      await expect(api.getFavorites()).rejects.toThrow('Database error');

      // Verify we didn't fall back to localStorage
      expect(localStorage.getItem('favorites')).toBeNull();
      expect(localStorage.getItem('kiyya-favorites')).toBeNull();
    });
  });

  describe('Architecture Compliance', () => {
    it('should enforce SQLite-only architecture for favorites', async () => {
      // This test verifies the architectural constraint that favorites
      // MUST be stored in SQLite and NEVER in LocalStorage

      const operations = [
        () => api.saveFavorite({ claim_id: 'test', title: 'Test', thumbnail_url: '' }),
        () => api.getFavorites(),
        () => api.removeFavorite('test'),
        () => api.isFavorite('test'),
      ];

      vi.mocked(invoke).mockResolvedValue(undefined);

      // Execute all operations
      for (const operation of operations) {
        await operation();
      }

      // Verify all operations used Tauri commands (SQLite backend)
      expect(invoke).toHaveBeenCalledTimes(4);

      // Verify localStorage was never used for favorites data
      const allKeys = Object.keys(localStorage);
      const dataKeys = allKeys.filter(key => 
        !key.includes('theme') && 
        !key.includes('volume') && 
        !key.includes('speed') &&
        !key.includes('search-history') &&
        !key.includes('deferred-update')
      );

      // No data keys should exist (only UI preference keys are allowed)
      expect(dataKeys).toHaveLength(0);
    });

    it('should document that LocalStorage is for UI preferences only', () => {
      // This test serves as documentation that LocalStorage usage
      // is restricted to UI preferences, never for application data

      const allowedLocalStorageKeys = [
        'kiyya-theme',
        'kiyya-volume',
        'kiyya-playback-speed',
        'kiyya-search-history',
        'kiyya-deferred-update-*',
      ];

      const forbiddenLocalStorageKeys = [
        'favorites',
        'kiyya-favorites',
        'favorite-items',
        'saved-favorites',
        'user-favorites',
      ];

      // Verify allowed keys can be used
      allowedLocalStorageKeys.forEach(key => {
        if (!key.includes('*')) {
          localStorage.setItem(key, 'test-value');
          expect(localStorage.getItem(key)).toBe('test-value');
          localStorage.removeItem(key);
        }
      });

      // Verify forbidden keys should not exist
      forbiddenLocalStorageKeys.forEach(key => {
        expect(localStorage.getItem(key)).toBeNull();
      });
    });
  });
});
