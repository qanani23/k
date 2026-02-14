import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from '../../src/lib/api';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn()
}));

import { invoke } from '@tauri-apps/api/tauri';

describe('API Wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Channel ID Configuration', () => {
    it('should use fallback channel ID when VITE_CHANNEL_ID is not set', async () => {
      // This test verifies that the CHANNEL_ID constant uses '@kiyyamovies:b' as fallback
      // when import.meta.env.VITE_CHANNEL_ID is not set
      (invoke as any).mockResolvedValue([]);
      
      await api.fetchChannelClaims({ any_tags: ['movie'] });
      
      // Verify that the fallback value is used
      expect(invoke).toHaveBeenCalledWith('fetch_channel_claims', 
        expect.objectContaining({
          channel_id: '@kiyyamovies:b'
        })
      );
    });

    it('should use fallback channel ID in fetchPlaylists when env var not set', async () => {
      (invoke as any).mockResolvedValue([]);
      
      await api.fetchPlaylists();
      
      // Verify that the fallback value is used
      expect(invoke).toHaveBeenCalledWith('fetch_playlists', 
        expect.objectContaining({
          channel_id: '@kiyyamovies:b'
        })
      );
    });
  });

  describe('Content Discovery', () => {
    it('should call fetchChannelClaims with correct parameters', async () => {
      const mockContent = [
        {
          claim_id: 'test-claim-1',
          title: 'Test Movie',
          tags: ['movie', 'action_movies'],
          release_time: 1234567890,
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false },
          value: {
            source: { sd_hash: 'test-hash' }
          }
        }
      ];
      
      (invoke as any).mockResolvedValue(mockContent);
      
      const result = await api.fetchChannelClaims({
        any_tags: ['movie'],
        limit: 50
      });
      
      expect(invoke).toHaveBeenCalledWith('fetch_channel_claims', {
        channel_id: '@kiyyamovies:b',
        any_tags: ['movie'],
        limit: 50
      });
      expect(result).toEqual(mockContent);
    });

    it('should call fetchPlaylists', async () => {
      const mockPlaylists = [
        {
          id: 'playlist-1',
          title: 'Season 1',
          claim_id: 'series-claim',
          items: [],
          season_number: 1
        }
      ];
      
      (invoke as any).mockResolvedValue(mockPlaylists);
      
      const result = await api.fetchPlaylists();
      
      expect(invoke).toHaveBeenCalledWith('fetch_playlists', {
        channel_id: '@kiyyamovies:b'
      });
      expect(result).toEqual(mockPlaylists);
    });

    it('should call resolveClaim with claim ID', async () => {
      const mockClaim = {
        claim_id: 'test-claim',
        title: 'Test Content',
        tags: ['movie'],
        release_time: 1234567890,
        video_urls: {},
        compatibility: { compatible: true, fallback_available: false }
      };
      
      (invoke as any).mockResolvedValue(mockClaim);
      
      const result = await api.resolveClaim('test-claim');
      
      expect(invoke).toHaveBeenCalledWith('resolve_claim', {
        claim_id_or_uri: 'test-claim'
      });
      expect(result).toEqual(mockClaim);
    });
  });

  describe('Convenience Functions', () => {
    it('should fetch content by single tag', async () => {
      (invoke as any).mockResolvedValue([]);
      
      await api.fetchByTag('movie', 50);
      
      expect(invoke).toHaveBeenCalledWith('fetch_channel_claims', {
        channel_id: '@kiyyamovies:b',
        any_tags: ['movie'],
        limit: 50,
        force_refresh: false
      });
    });

    it('should fetch content by multiple tags', async () => {
      (invoke as any).mockResolvedValue([]);
      
      await api.fetchByTags(['movie', 'action_movies'], 50);
      
      expect(invoke).toHaveBeenCalledWith('fetch_channel_claims', {
        channel_id: '@kiyyamovies:b',
        any_tags: ['movie', 'action_movies'],
        limit: 50,
        force_refresh: false
      });
    });

    it('should search content with text query', async () => {
      (invoke as any).mockResolvedValue([]);
      
      await api.searchContent('test query', 50);
      
      expect(invoke).toHaveBeenCalledWith('fetch_channel_claims', {
        channel_id: '@kiyyamovies:b',
        text: 'test query',
        limit: 50
      });
    });

    it('should fetch hero content', async () => {
      (invoke as any).mockResolvedValue([]);
      
      await api.fetchHeroContent(20);
      
      expect(invoke).toHaveBeenCalledWith('fetch_channel_claims', {
        channel_id: '@kiyyamovies:b',
        any_tags: ['hero_trailer'],
        limit: 20,
        force_refresh: false
      });
    });
  });

  describe('Download Management', () => {
    it('should call downloadMovieQuality with correct parameters', async () => {
      (invoke as any).mockResolvedValue(undefined);
      
      await api.downloadMovieQuality({
        claim_id: 'test-claim',
        quality: '720p',
        url: 'https://example.com/video.mp4'
      });
      
      expect(invoke).toHaveBeenCalledWith('download_movie_quality', {
        claim_id: 'test-claim',
        quality: '720p',
        url: 'https://example.com/video.mp4'
      });
    });

    it('should call streamOffline with correct parameters', async () => {
      const mockResponse = { url: 'http://localhost:8080/video', port: 8080 };
      (invoke as any).mockResolvedValue(mockResponse);
      
      const result = await api.streamOffline({
        claim_id: 'test-claim',
        quality: '720p'
      });
      
      expect(invoke).toHaveBeenCalledWith('stream_offline', {
        claim_id: 'test-claim',
        quality: '720p'
      });
      expect(result).toEqual(mockResponse);
    });

    it('should call deleteOffline with correct parameters', async () => {
      (invoke as any).mockResolvedValue(undefined);
      
      await api.deleteOffline({
        claim_id: 'test-claim',
        quality: '720p'
      });
      
      expect(invoke).toHaveBeenCalledWith('delete_offline', {
        claim_id: 'test-claim',
        quality: '720p'
      });
    });
  });

  describe('Progress Tracking', () => {
    it('should save progress with correct parameters', async () => {
      (invoke as any).mockResolvedValue(undefined);
      
      await api.saveProgress({
        claim_id: 'test-claim',
        position_seconds: 120,
        quality: '720p'
      });
      
      expect(invoke).toHaveBeenCalledWith('save_progress', {
        claim_id: 'test-claim',
        position_seconds: 120,
        quality: '720p'
      });
    });

    it('should get progress for claim ID', async () => {
      const mockProgress = {
        claim_id: 'test-claim',
        position_seconds: 120,
        quality: '720p',
        updated_at: 1234567890
      };
      (invoke as any).mockResolvedValue(mockProgress);
      
      const result = await api.getProgress('test-claim');
      
      expect(invoke).toHaveBeenCalledWith('get_progress', {
        claim_id: 'test-claim'
      });
      expect(result).toEqual(mockProgress);
    });
  });

  describe('Favorites Management', () => {
    it('should save favorite with correct parameters', async () => {
      (invoke as any).mockResolvedValue(undefined);
      
      await api.saveFavorite({
        claim_id: 'test-claim',
        title: 'Test Movie',
        thumbnail_url: 'https://example.com/thumb.jpg'
      });
      
      expect(invoke).toHaveBeenCalledWith('save_favorite', {
        claim_id: 'test-claim',
        title: 'Test Movie',
        thumbnail_url: 'https://example.com/thumb.jpg'
      });
    });

    it('should remove favorite', async () => {
      (invoke as any).mockResolvedValue(undefined);
      
      await api.removeFavorite('test-claim');
      
      expect(invoke).toHaveBeenCalledWith('remove_favorite', {
        claim_id: 'test-claim'
      });
    });

    it('should get all favorites', async () => {
      const mockFavorites = [
        {
          claim_id: 'test-claim',
          title: 'Test Movie',
          inserted_at: 1234567890
        }
      ];
      (invoke as any).mockResolvedValue(mockFavorites);
      
      const result = await api.getFavorites();
      
      expect(invoke).toHaveBeenCalledWith('get_favorites');
      expect(result).toEqual(mockFavorites);
    });
  });

  describe('Configuration and Settings', () => {
    it('should get app config', async () => {
      const mockConfig = {
        theme: 'dark' as const,
        last_used_quality: '720p',
        encrypt_downloads: false,
        auto_upgrade_quality: true,
        cache_ttl_minutes: 30,
        max_cache_items: 200,
        vault_path: '/path/to/vault',
        version: '1.0.0',
        gateways: ['https://api.odysee.com']
      };
      (invoke as any).mockResolvedValue(mockConfig);
      
      const result = await api.getAppConfig();
      
      expect(invoke).toHaveBeenCalledWith('get_app_config');
      expect(result).toEqual(mockConfig);
    });

    it('should update settings', async () => {
      (invoke as any).mockResolvedValue(undefined);
      
      await api.updateSettings({ theme: 'light' });
      
      expect(invoke).toHaveBeenCalledWith('update_settings', {
        settings: { theme: 'light' }
      });
    });
  });

  describe('Diagnostics', () => {
    it('should get diagnostics data', async () => {
      const mockDiagnostics = {
        gateway_health: [],
        database_version: 1,
        free_disk_bytes: 1000000000,
        local_server_status: { running: false, active_streams: 0 },
        cache_stats: {
          total_items: 100,
          cache_size_bytes: 5000000,
          hit_rate: 0.85
        }
      };
      (invoke as any).mockResolvedValue(mockDiagnostics);
      
      const result = await api.getDiagnostics();
      
      expect(invoke).toHaveBeenCalledWith('get_diagnostics');
      expect(result).toEqual(mockDiagnostics);
    });
  });

  describe('Cache Management', () => {
    it('should get cache stats', async () => {
      const mockStats = {
        total_items: 150,
        cache_size_bytes: 7500000,
        hit_rate: 0.92,
        last_cleanup: 1234567890
      };
      (invoke as any).mockResolvedValue(mockStats);
      
      const result = await api.getCacheStats();
      
      expect(invoke).toHaveBeenCalledWith('get_cache_stats');
      expect(result).toEqual(mockStats);
      expect(result.hit_rate).toBeGreaterThan(0);
    });

    it('should invalidate cache item', async () => {
      (invoke as any).mockResolvedValue(undefined);
      
      await api.invalidateCacheItem('test-claim-id');
      
      expect(invoke).toHaveBeenCalledWith('invalidate_cache_item', {
        claim_id: 'test-claim-id'
      });
    });

    it('should invalidate cache by tags', async () => {
      (invoke as any).mockResolvedValue(undefined);
      
      await api.invalidateCacheByTags(['movie', 'action_movies']);
      
      expect(invoke).toHaveBeenCalledWith('invalidate_cache_by_tags', {
        tags: ['movie', 'action_movies']
      });
    });

    it('should clear all cache', async () => {
      (invoke as any).mockResolvedValue(undefined);
      
      await api.clearAllCache();
      
      expect(invoke).toHaveBeenCalledWith('clear_all_cache');
    });

    it('should cleanup expired cache', async () => {
      (invoke as any).mockResolvedValue(42);
      
      const result = await api.cleanupExpiredCache();
      
      expect(invoke).toHaveBeenCalledWith('cleanup_expired_cache');
      expect(result).toBe(42);
    });
  });

  describe('External Links', () => {
    it('should open external URL', async () => {
      (invoke as any).mockResolvedValue(undefined);
      
      await api.openExternal('https://example.com');
      
      expect(invoke).toHaveBeenCalledWith('open_external', {
        url: 'https://example.com'
      });
    });
  });

  describe('Utility Functions', () => {
    it('should fetch category content with base tag only', async () => {
      (invoke as any).mockResolvedValue([]);
      
      await api.fetchCategoryContent('movie', undefined, 50);
      
      expect(invoke).toHaveBeenCalledWith('fetch_channel_claims', {
        channel_id: '@kiyyamovies:b',
        any_tags: ['movie'],
        limit: 50,
        force_refresh: false
      });
    });

    it('should fetch category content with filter tag', async () => {
      (invoke as any).mockResolvedValue([]);
      
      await api.fetchCategoryContent('movie', 'action_movies', 50);
      
      expect(invoke).toHaveBeenCalledWith('fetch_channel_claims', {
        channel_id: '@kiyyamovies:b',
        any_tags: ['movie', 'action_movies'],
        limit: 50,
        force_refresh: false
      });
    });

    it('should fetch related content and exclude current item', async () => {
      const mockContent = [
        {
          claim_id: 'claim-1',
          title: 'Movie 1',
          tags: ['movie'],
          release_time: 1234567890,
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false },
          value: {
            source: { sd_hash: 'test-hash-1' }
          }
        },
        {
          claim_id: 'claim-2',
          title: 'Movie 2',
          tags: ['movie'],
          release_time: 1234567890,
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false },
          value: {
            source: { sd_hash: 'test-hash-2' }
          }
        },
        {
          claim_id: 'claim-3',
          title: 'Movie 3',
          tags: ['movie'],
          release_time: 1234567890,
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false },
          value: {
            source: { sd_hash: 'test-hash-3' }
          }
        }
      ];
      (invoke as any).mockResolvedValue(mockContent);
      
      const result = await api.fetchRelatedContent('movie', 'claim-2', 10);
      
      expect(invoke).toHaveBeenCalledWith('fetch_channel_claims', {
        channel_id: '@kiyyamovies:b',
        any_tags: ['movie'],
        limit: 50,
        force_refresh: false
      });
      expect(result).not.toContainEqual(expect.objectContaining({ claim_id: 'claim-2' }));
      expect(result.length).toBeLessThanOrEqual(10);
    });

    it('should check if content is offline', async () => {
      const mockResponse = { url: 'http://localhost:8080/video', port: 8080 };
      (invoke as any).mockResolvedValue(mockResponse);
      
      const result = await api.isContentOffline('test-claim', '720p');
      
      expect(result).toBe(true);
    });

    it('should return false if content is not offline', async () => {
      (invoke as any).mockRejectedValue(new Error('Not found'));
      
      const result = await api.isContentOffline('test-claim', '720p');
      
      expect(result).toBe(false);
    });

    it('should get available qualities sorted', () => {
      const content = {
        claim_id: 'test',
        title: 'Test',
        tags: [],
        release_time: 0,
        video_urls: {
          '1080p': { url: '', quality: '1080p', type: 'mp4' as const },
          '480p': { url: '', quality: '480p', type: 'mp4' as const },
          '720p': { url: '', quality: '720p', type: 'mp4' as const }
        },
        compatibility: { compatible: true, fallback_available: false }
      };
      
      const qualities = api.getAvailableQualities(content);
      
      expect(qualities).toEqual(['480p', '720p', '1080p']);
    });

    it('should get best quality URL', () => {
      const content = {
        claim_id: 'test',
        title: 'Test',
        tags: [],
        release_time: 0,
        video_urls: {
          '1080p': { url: 'https://example.com/1080p.mp4', quality: '1080p', type: 'mp4' as const },
          '720p': { url: 'https://example.com/720p.mp4', quality: '720p', type: 'mp4' as const }
        },
        compatibility: { compatible: true, fallback_available: false }
      };
      
      const url = api.getBestQualityUrl(content);
      
      expect(url).toBe('https://example.com/1080p.mp4');
    });

    it('should get preferred quality URL if available', () => {
      const content = {
        claim_id: 'test',
        title: 'Test',
        tags: [],
        release_time: 0,
        video_urls: {
          '1080p': { url: 'https://example.com/1080p.mp4', quality: '1080p', type: 'mp4' as const },
          '720p': { url: 'https://example.com/720p.mp4', quality: '720p', type: 'mp4' as const }
        },
        compatibility: { compatible: true, fallback_available: false }
      };
      
      const url = api.getBestQualityUrl(content, '720p');
      
      expect(url).toBe('https://example.com/720p.mp4');
    });
  });

  describe('Format Utilities', () => {
    it('should format file size correctly', () => {
      expect(api.formatFileSize(500)).toBe('500.0 B');
      expect(api.formatFileSize(1024)).toBe('1.0 KB');
      expect(api.formatFileSize(1048576)).toBe('1.0 MB');
      expect(api.formatFileSize(1073741824)).toBe('1.0 GB');
    });

    it('should format duration correctly', () => {
      expect(api.formatDuration(30)).toBe('0:30');
      expect(api.formatDuration(90)).toBe('1:30');
      expect(api.formatDuration(3661)).toBe('1:01:01');
    });

    it('should format timestamp correctly', () => {
      const timestamp = 1234567890;
      const result = api.formatTimestamp(timestamp);
      expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });
  });

  describe('Compatibility Utilities', () => {
    it('should check if content is compatible', () => {
      const compatible = {
        claim_id: 'test',
        title: 'Test',
        tags: [],
        release_time: 0,
        video_urls: {},
        compatibility: { compatible: true, fallback_available: false }
      };
      
      expect(api.isContentCompatible(compatible)).toBe(true);
    });

    it('should check if content is incompatible', () => {
      const incompatible = {
        claim_id: 'test',
        title: 'Test',
        tags: [],
        release_time: 0,
        video_urls: {},
        compatibility: { compatible: false, reason: 'Codec not supported', fallback_available: false }
      };
      
      expect(api.isContentCompatible(incompatible)).toBe(false);
    });

    it('should get compatibility warning', () => {
      const incompatible = {
        claim_id: 'test',
        title: 'Test',
        tags: [],
        release_time: 0,
        video_urls: {},
        compatibility: { compatible: false, reason: 'Codec not supported', fallback_available: false }
      };
      
      expect(api.getCompatibilityWarning(incompatible)).toBe('Codec not supported');
    });

    it('should return null for compatible content', () => {
      const compatible = {
        claim_id: 'test',
        title: 'Test',
        tags: [],
        release_time: 0,
        video_urls: {},
        compatibility: { compatible: true, fallback_available: false }
      };
      
      expect(api.getCompatibilityWarning(compatible)).toBeNull();
    });
  });
});

  describe('API Response Validation Edge Cases', () => {
    describe('validateContentItem', () => {
      it('should handle undefined tags array', async () => {
        const invalidContent = [
          {
            claim_id: 'test-claim',
            value: {
              source: { sd_hash: 'test-hash' }
            },
            tags: undefined // Missing tags
          }
        ];
        
        (invoke as any).mockResolvedValue(invalidContent);
        
        const result = await api.fetchByTag('movie', 50);
        
        // Should filter out items with undefined tags
        expect(result).toEqual([]);
      });

      it('should handle null tags array', async () => {
        const invalidContent = [
          {
            claim_id: 'test-claim',
            value: {
              source: { sd_hash: 'test-hash' }
            },
            tags: null // Null tags
          }
        ];
        
        (invoke as any).mockResolvedValue(invalidContent);
        
        const result = await api.fetchByTag('movie', 50);
        
        // Should filter out items with null tags
        expect(result).toEqual([]);
      });

      it('should handle non-array tags', async () => {
        const invalidContent = [
          {
            claim_id: 'test-claim',
            value: {
              source: { sd_hash: 'test-hash' }
            },
            tags: 'movie' // String instead of array
          }
        ];
        
        (invoke as any).mockResolvedValue(invalidContent);
        
        const result = await api.fetchByTag('movie', 50);
        
        // Should filter out items with non-array tags
        expect(result).toEqual([]);
      });
    });

    describe('malformed data structures', () => {
      it('should handle missing claim_id', async () => {
        const invalidContent = [
          {
            // Missing claim_id
            value: {
              source: { sd_hash: 'test-hash' }
            },
            tags: ['movie']
          }
        ];
        
        (invoke as any).mockResolvedValue(invalidContent);
        
        const result = await api.fetchByTag('movie', 50);
        
        // Should filter out items without claim_id
        expect(result).toEqual([]);
      });

      it('should handle missing value object', async () => {
        const invalidContent = [
          {
            claim_id: 'test-claim',
            // Missing value object
            tags: ['movie']
          }
        ];
        
        (invoke as any).mockResolvedValue(invalidContent);
        
        const result = await api.fetchByTag('movie', 50);
        
        // Should filter out items without value object
        expect(result).toEqual([]);
      });

      it('should handle missing value.source', async () => {
        const invalidContent = [
          {
            claim_id: 'test-claim',
            value: {
              // Missing source
              title: 'Test Movie'
            },
            tags: ['movie']
          }
        ];
        
        (invoke as any).mockResolvedValue(invalidContent);
        
        const result = await api.fetchByTag('movie', 50);
        
        // Should filter out items without value.source
        expect(result).toEqual([]);
      });

      it('should handle value as array instead of object', async () => {
        const invalidContent = [
          {
            claim_id: 'test-claim',
            value: ['invalid', 'array'], // Array instead of object
            tags: ['movie']
          }
        ];
        
        (invoke as any).mockResolvedValue(invalidContent);
        
        const result = await api.fetchByTag('movie', 50);
        
        // Should filter out items with array value
        expect(result).toEqual([]);
      });

      it('should handle value.source as array instead of object', async () => {
        const invalidContent = [
          {
            claim_id: 'test-claim',
            value: {
              source: ['invalid', 'array'] // Array instead of object
            },
            tags: ['movie']
          }
        ];
        
        (invoke as any).mockResolvedValue(invalidContent);
        
        const result = await api.fetchByTag('movie', 50);
        
        // Should filter out items with array source
        expect(result).toEqual([]);
      });

      it('should handle completely malformed object', async () => {
        const invalidContent = [
          {
            random_field: 'random_value',
            another_field: 123
          }
        ];
        
        (invoke as any).mockResolvedValue(invalidContent);
        
        const result = await api.fetchByTag('movie', 50);
        
        // Should filter out completely malformed items
        expect(result).toEqual([]);
      });

      it('should handle null item in array', async () => {
        const invalidContent = [
          null,
          {
            claim_id: 'valid-claim',
            value: {
              source: { sd_hash: 'test-hash' }
            },
            tags: ['movie']
          }
        ];
        
        (invoke as any).mockResolvedValue(invalidContent);
        
        const result = await api.fetchByTag('movie', 50);
        
        // Should filter out null items but keep valid ones
        expect(result.length).toBe(1);
        expect(result[0].claim_id).toBe('valid-claim');
      });

      it('should handle undefined item in array', async () => {
        const invalidContent = [
          undefined,
          {
            claim_id: 'valid-claim',
            value: {
              source: { sd_hash: 'test-hash' }
            },
            tags: ['movie']
          }
        ];
        
        (invoke as any).mockResolvedValue(invalidContent);
        
        const result = await api.fetchByTag('movie', 50);
        
        // Should filter out undefined items but keep valid ones
        expect(result.length).toBe(1);
        expect(result[0].claim_id).toBe('valid-claim');
      });
    });

    describe('graceful failure for invalid responses', () => {
      it('should return empty array for non-array response', async () => {
        const invalidResponse = {
          data: 'not an array'
        };
        
        (invoke as any).mockResolvedValue(invalidResponse);
        
        const result = await api.fetchByTag('movie', 50);
        
        // Should gracefully handle non-array response
        expect(result).toEqual([]);
      });

      it('should return empty array for null response', async () => {
        (invoke as any).mockResolvedValue(null);
        
        const result = await api.fetchByTag('movie', 50);
        
        // Should gracefully handle null response
        expect(result).toEqual([]);
      });

      it('should return empty array for undefined response', async () => {
        (invoke as any).mockResolvedValue(undefined);
        
        const result = await api.fetchByTag('movie', 50);
        
        // Should gracefully handle undefined response
        expect(result).toEqual([]);
      });

      it('should filter mixed valid and invalid items', async () => {
        const mixedContent = [
          {
            claim_id: 'valid-1',
            value: {
              source: { sd_hash: 'hash-1' }
            },
            tags: ['movie']
          },
          {
            claim_id: 'invalid-no-source',
            value: {
              title: 'Missing source'
            },
            tags: ['movie']
          },
          {
            claim_id: 'valid-2',
            value: {
              source: { sd_hash: 'hash-2' }
            },
            tags: ['movie', 'action_movies']
          },
          {
            // Missing claim_id
            value: {
              source: { sd_hash: 'hash-3' }
            },
            tags: ['movie']
          },
          {
            claim_id: 'valid-3',
            value: {
              source: { sd_hash: 'hash-3' }
            },
            tags: ['movie']
          }
        ];
        
        (invoke as any).mockResolvedValue(mixedContent);
        
        const result = await api.fetchByTag('movie', 50);
        
        // Should only return valid items
        expect(result.length).toBe(3);
        expect(result[0].claim_id).toBe('valid-1');
        expect(result[1].claim_id).toBe('valid-2');
        expect(result[2].claim_id).toBe('valid-3');
      });

      it('should handle empty array response', async () => {
        (invoke as any).mockResolvedValue([]);
        
        const result = await api.fetchByTag('movie', 50);
        
        // Should gracefully handle empty array
        expect(result).toEqual([]);
      });

      it('should handle API error gracefully', async () => {
        (invoke as any).mockRejectedValue(new Error('API Error'));
        
        // Should throw the error (not silently fail)
        await expect(api.fetchByTag('movie', 50)).rejects.toThrow('API Error');
      });
    });

    describe('validation across different fetch functions', () => {
      it('should validate content in fetchByTags', async () => {
        const invalidContent = [
          {
            claim_id: 'test-claim',
            value: {
              // Missing source
            },
            tags: ['movie', 'action_movies']
          }
        ];
        
        (invoke as any).mockResolvedValue(invalidContent);
        
        const result = await api.fetchByTags(['movie', 'action_movies'], 50);
        
        // Should filter out invalid items
        expect(result).toEqual([]);
      });

      it('should validate content in fetchHeroContent', async () => {
        const invalidContent = [
          {
            claim_id: 'hero-claim',
            value: {
              source: { sd_hash: 'hash' }
            }
            // Missing tags
          }
        ];
        
        (invoke as any).mockResolvedValue(invalidContent);
        
        const result = await api.fetchHeroContent(20);
        
        // Should filter out invalid items
        expect(result).toEqual([]);
      });

      it('should validate content in fetchCategoryContent', async () => {
        const invalidContent = [
          {
            // Missing claim_id
            value: {
              source: { sd_hash: 'hash' }
            },
            tags: ['movie']
          }
        ];
        
        (invoke as any).mockResolvedValue(invalidContent);
        
        const result = await api.fetchCategoryContent('movie', 'action_movies', 50);
        
        // Should filter out invalid items
        expect(result).toEqual([]);
      });
    });
  });
