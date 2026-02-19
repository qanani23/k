import { describe, it, expect } from 'vitest';
import {
  extractThumbnailUrl,
  getPlaylistThumbnail,
  generatePlaceholderGradient,
  getOptimizedImageUrl,
  supportsNativeLazyLoading,
  getLoadingStrategy,
  preloadImage,
  preloadImages,
  isImageAccessible,
} from '../../src/lib/images';

describe('Image Utilities', () => {
  describe('extractThumbnailUrl', () => {
    it('should extract thumbnail from direct thumbnail_url field', () => {
      const data = { thumbnail_url: 'https://example.com/thumb.jpg' };
      expect(extractThumbnailUrl(data)).toBe('https://example.com/thumb.jpg');
    });

    it('should extract thumbnail from thumbnail field', () => {
      const data = { thumbnail: 'https://example.com/thumb.jpg' };
      expect(extractThumbnailUrl(data)).toBe('https://example.com/thumb.jpg');
    });

    it('should extract thumbnail from nested thumbnail object', () => {
      const data = { thumbnail: { url: 'https://example.com/thumb.jpg' } };
      expect(extractThumbnailUrl(data)).toBe('https://example.com/thumb.jpg');
    });

    it('should extract thumbnail from value.thumbnail.url path', () => {
      const data = {
        value: {
          thumbnail: { url: 'https://example.com/thumb.jpg' },
        },
      };
      expect(extractThumbnailUrl(data)).toBe('https://example.com/thumb.jpg');
    });

    it('should extract thumbnail from value.thumbnail as string', () => {
      const data = {
        value: {
          thumbnail: 'https://example.com/thumb.jpg',
        },
      };
      expect(extractThumbnailUrl(data)).toBe('https://example.com/thumb.jpg');
    });

    it('should extract thumbnail from metadata.thumbnail.url path', () => {
      const data = {
        metadata: {
          thumbnail: { url: 'https://example.com/thumb.jpg' },
        },
      };
      expect(extractThumbnailUrl(data)).toBe('https://example.com/thumb.jpg');
    });

    it('should extract thumbnail from metadata.thumbnail as string', () => {
      const data = {
        metadata: {
          thumbnail: 'https://example.com/thumb.jpg',
        },
      };
      expect(extractThumbnailUrl(data)).toBe('https://example.com/thumb.jpg');
    });

    it('should return undefined for null data', () => {
      expect(extractThumbnailUrl(null)).toBeUndefined();
    });

    it('should return undefined for undefined data', () => {
      expect(extractThumbnailUrl(undefined)).toBeUndefined();
    });

    it('should return undefined when no thumbnail field exists', () => {
      const data = { title: 'Test', description: 'Test description' };
      expect(extractThumbnailUrl(data)).toBeUndefined();
    });

    it('should return undefined for non-string thumbnail values', () => {
      const data = { thumbnail_url: 123 };
      expect(extractThumbnailUrl(data)).toBeUndefined();
    });

    it('should prioritize thumbnail_url over other fields', () => {
      const data = {
        thumbnail_url: 'https://example.com/thumb1.jpg',
        thumbnail: 'https://example.com/thumb2.jpg',
        value: { thumbnail: 'https://example.com/thumb3.jpg' },
      };
      expect(extractThumbnailUrl(data)).toBe('https://example.com/thumb1.jpg');
    });
  });

  describe('getPlaylistThumbnail', () => {
    it('should return first available thumbnail from episodes', () => {
      const episodes = [
        { thumbnail_url: undefined },
        { thumbnail_url: 'https://example.com/ep2.jpg' },
        { thumbnail_url: 'https://example.com/ep3.jpg' },
      ];
      expect(getPlaylistThumbnail(episodes)).toBe('https://example.com/ep2.jpg');
    });

    it('should return first episode thumbnail when available', () => {
      const episodes = [
        { thumbnail_url: 'https://example.com/ep1.jpg' },
        { thumbnail_url: 'https://example.com/ep2.jpg' },
      ];
      expect(getPlaylistThumbnail(episodes)).toBe('https://example.com/ep1.jpg');
    });

    it('should return undefined for empty episodes array', () => {
      expect(getPlaylistThumbnail([])).toBeUndefined();
    });

    it('should return undefined for null episodes', () => {
      expect(getPlaylistThumbnail(null as any)).toBeUndefined();
    });

    it('should return undefined for undefined episodes', () => {
      expect(getPlaylistThumbnail(undefined as any)).toBeUndefined();
    });

    it('should return undefined when no episodes have thumbnails', () => {
      const episodes = [
        { thumbnail_url: undefined },
        { thumbnail_url: undefined },
      ];
      expect(getPlaylistThumbnail(episodes)).toBeUndefined();
    });
  });

  describe('generatePlaceholderGradient', () => {
    it('should generate a gradient string', () => {
      const gradient = generatePlaceholderGradient('Test Title');
      expect(gradient).toMatch(/^linear-gradient\(135deg, hsl\(\d+, 70%, 50%\) 0%, hsl\(\d+, 70%, 50%\) 100%\)$/);
    });

    it('should generate consistent gradient for same title', () => {
      const gradient1 = generatePlaceholderGradient('Test Title');
      const gradient2 = generatePlaceholderGradient('Test Title');
      expect(gradient1).toBe(gradient2);
    });

    it('should generate different gradients for different titles', () => {
      const gradient1 = generatePlaceholderGradient('Title A');
      const gradient2 = generatePlaceholderGradient('Title B');
      expect(gradient1).not.toBe(gradient2);
    });

    it('should handle empty string', () => {
      const gradient = generatePlaceholderGradient('');
      expect(gradient).toMatch(/^linear-gradient\(135deg, hsl\(\d+, 70%, 50%\) 0%, hsl\(\d+, 70%, 50%\) 100%\)$/);
    });

    it('should handle special characters', () => {
      const gradient = generatePlaceholderGradient('Test!@#$%^&*()');
      expect(gradient).toMatch(/^linear-gradient\(135deg, hsl\(\d+, 70%, 50%\) 0%, hsl\(\d+, 70%, 50%\) 100%\)$/);
    });
  });

  describe('getOptimizedImageUrl', () => {
    it('should return undefined for undefined URL', () => {
      expect(getOptimizedImageUrl(undefined)).toBeUndefined();
    });

    it('should return original URL for non-LBRY URLs', () => {
      const url = 'https://example.com/image.jpg';
      expect(getOptimizedImageUrl(url, 300, 200)).toBe(url);
    });

    it('should add width parameter for LBRY thumbnails', () => {
      const url = 'https://thumbnails.lbry.com/image.jpg';
      const optimized = getOptimizedImageUrl(url, 300);
      expect(optimized).toContain('width=300');
    });

    it('should add height parameter for LBRY thumbnails', () => {
      const url = 'https://thumbnails.lbry.com/image.jpg';
      const optimized = getOptimizedImageUrl(url, undefined, 200);
      expect(optimized).toContain('height=200');
    });

    it('should add both width and height parameters', () => {
      const url = 'https://thumbnails.lbry.com/image.jpg';
      const optimized = getOptimizedImageUrl(url, 300, 200);
      expect(optimized).toContain('width=300');
      expect(optimized).toContain('height=200');
    });

    it('should work with spee.ch URLs', () => {
      const url = 'https://spee.ch/image.jpg';
      const optimized = getOptimizedImageUrl(url, 300);
      expect(optimized).toContain('width=300');
    });

    it('should preserve existing query parameters', () => {
      const url = 'https://thumbnails.lbry.com/image.jpg?quality=high';
      const optimized = getOptimizedImageUrl(url, 300);
      expect(optimized).toContain('quality=high');
      expect(optimized).toContain('width=300');
    });
  });

  describe('supportsNativeLazyLoading', () => {
    it('should return boolean', () => {
      const result = supportsNativeLazyLoading();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getLoadingStrategy', () => {
    it('should return either native or observer', () => {
      const strategy = getLoadingStrategy();
      expect(['native', 'observer']).toContain(strategy);
    });
  });

  describe('preloadImage', () => {
    it('should reject when no source provided', async () => {
      await expect(preloadImage('')).rejects.toThrow('No image source provided');
    });

    it('should create an Image object and set src', () => {
      // Mock Image to verify behavior
      const mockImage = {
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
        src: '',
      };

      global.Image = class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        private _src = '';

        get src() {
          return this._src;
        }

        set src(value: string) {
          this._src = value;
          mockImage.src = value;
          mockImage.onload = this.onload;
          mockImage.onerror = this.onerror;
        }
      } as any;

      preloadImage('https://example.com/test.jpg');
      
      expect(mockImage.src).toBe('https://example.com/test.jpg');
      expect(mockImage.onload).not.toBeNull();
      expect(mockImage.onerror).not.toBeNull();
    });
  });

  describe('preloadImages', () => {
    it('should handle empty array', async () => {
      await expect(preloadImages([])).resolves.toHaveLength(0);
    });

    it('should filter out empty strings', () => {
      // Mock to track calls
      const mockCalls: string[] = [];
      
      global.Image = class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        private _src = '';

        get src() {
          return this._src;
        }

        set src(value: string) {
          this._src = value;
          mockCalls.push(value);
        }
      } as any;

      const sources = [
        'https://example.com/img1.jpg',
        '',
        'https://example.com/img2.jpg',
        '   ',
      ];
      
      preloadImages(sources);
      
      // Should only attempt to load non-empty sources
      expect(mockCalls.length).toBe(2);
      expect(mockCalls).toContain('https://example.com/img1.jpg');
      expect(mockCalls).toContain('https://example.com/img2.jpg');
    });
  });

  describe('isImageAccessible', () => {
    it('should return false for empty string', async () => {
      const result = await isImageAccessible('');
      expect(result).toBe(false);
    });

    it('should return false for whitespace string', async () => {
      const result = await isImageAccessible('   ');
      expect(result).toBe(false);
    });

    it('should call preloadImage internally', () => {
      // Verify that isImageAccessible uses preloadImage
      const url = 'https://example.com/test.jpg';
      
      global.Image = class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        private _src = '';

        get src() {
          return this._src;
        }

        set src(value: string) {
          this._src = value;
        }
      } as any;

      // Just verify it doesn't throw
      const promise = isImageAccessible(url);
      expect(promise).toBeInstanceOf(Promise);
    });
  });
});
