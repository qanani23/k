/**
 * Property-Based Test: Video URL Extraction for All Content
 * Feature: ui-data-fetching-fixes
 * Property 1: Video URL Extraction for All Content
 * 
 * For any content item returned from the Odysee API, the application should 
 * successfully extract valid video URLs either from direct URL fields or by 
 * generating CDN URLs as a fallback.
 * 
 * Validates: Requirements 2.2
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getBestQualityUrl } from '../../src/lib/api';
import type { ContentItem, VideoUrl } from '../../src/types';

describe('Feature: ui-data-fetching-fixes, Property 1: Video URL Extraction for All Content', () => {
  // Arbitrary for generating VideoUrl objects
  const videoUrlArbitrary = fc.record({
    url: fc.webUrl(),
    quality: fc.constantFrom('1080p', '720p', '480p', '360p', '240p'),
    type: fc.constantFrom('mp4', 'hls') as fc.Arbitrary<'mp4' | 'hls'>,
    codec: fc.option(fc.constantFrom('h264', 'h265', 'vp9'), { nil: undefined }),
  });

  // Arbitrary for generating ContentItem with video_urls
  const contentItemArbitrary = fc.record({
    claim_id: fc.hexaString({ minLength: 40, maxLength: 40 }),
    title: fc.string({ minLength: 1, maxLength: 100 }),
    description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
    tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }),
    thumbnail_url: fc.option(fc.webUrl(), { nil: undefined }),
    duration: fc.option(fc.nat({ max: 10800 }), { nil: undefined }),
    release_time: fc.nat(),
    video_urls: fc.dictionary(
      fc.constantFrom('1080p', '720p', '480p', '360p', '240p'),
      videoUrlArbitrary,
      { minKeys: 1, maxKeys: 5 }
    ),
    compatibility: fc.record({
      compatible: fc.boolean(),
      reason: fc.option(fc.string(), { nil: undefined }),
      fallback_available: fc.boolean(),
    }),
    etag: fc.option(fc.hexaString({ minLength: 32, maxLength: 32 }), { nil: undefined }),
    content_hash: fc.option(fc.hexaString({ minLength: 64, maxLength: 64 }), { nil: undefined }),
    raw_json: fc.option(fc.string(), { nil: undefined }),
  });

  it('should extract valid video URL from any content item with video_urls', () => {
    fc.assert(
      fc.property(contentItemArbitrary, (content: ContentItem) => {
        // Act: Extract best quality URL
        const extractedUrl = getBestQualityUrl(content);

        // Assert: Should successfully extract a URL
        expect(extractedUrl).not.toBeNull();
        expect(typeof extractedUrl).toBe('string');
        
        // The extracted URL should be one of the URLs in video_urls
        const allUrls = Object.values(content.video_urls).map(v => v.url);
        expect(allUrls).toContain(extractedUrl);
      }),
      { numRuns: 20 }
    );
  });

  it('should extract highest quality URL when no preferred quality is specified', () => {
    fc.assert(
      fc.property(contentItemArbitrary, (content: ContentItem) => {
        // Act: Extract best quality URL without preference
        const extractedUrl = getBestQualityUrl(content);

        // Assert: Should extract the highest quality available
        const qualities = Object.keys(content.video_urls);
        const qualityOrder = ['240p', '360p', '480p', '720p', '1080p'];
        
        // Find the highest quality in the content
        let highestQuality = '';
        let highestScore = -1;
        for (const quality of qualities) {
          const score = qualityOrder.indexOf(quality);
          if (score > highestScore) {
            highestScore = score;
            highestQuality = quality;
          }
        }

        // The extracted URL should match the highest quality
        expect(extractedUrl).toBe(content.video_urls[highestQuality].url);
      }),
      { numRuns: 20 }
    );
  });

  it('should extract preferred quality URL when available', () => {
    fc.assert(
      fc.property(
        contentItemArbitrary,
        fc.constantFrom('1080p', '720p', '480p', '360p', '240p'),
        (content: ContentItem, preferredQuality: string) => {
          // Only test when the preferred quality exists
          if (!content.video_urls[preferredQuality]) {
            return true; // Skip this case
          }

          // Act: Extract URL with preferred quality
          const extractedUrl = getBestQualityUrl(content, preferredQuality);

          // Assert: Should extract the preferred quality URL
          expect(extractedUrl).toBe(content.video_urls[preferredQuality].url);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should handle content with single quality gracefully', () => {
    fc.assert(
      fc.property(
        fc.hexaString({ minLength: 40, maxLength: 40 }),
        fc.constantFrom('1080p', '720p', '480p', '360p', '240p'),
        videoUrlArbitrary,
        (claimId: string, quality: string, videoUrl: VideoUrl) => {
          // Arrange: Create content with single quality
          const content: ContentItem = {
            claim_id: claimId,
            title: 'Test Content',
            tags: ['test'],
            release_time: Date.now(),
            video_urls: { [quality]: videoUrl },
            compatibility: { compatible: true, fallback_available: false },
          };

          // Act: Extract URL
          const extractedUrl = getBestQualityUrl(content);

          // Assert: Should extract the only available URL
          expect(extractedUrl).toBe(videoUrl.url);
        }
      ),
      { numRuns: 20 }
    );
  });
});

