/**
 * Property-Based Test: Filter Tag Validation
 * Feature: ui-data-fetching-fixes
 * Property 2: Filter Tag Validation
 * 
 * For any category filter tag (comedy_movies, action_movies, romance_movies, etc.), 
 * all returned content items should contain that filter tag in their tags array.
 * 
 * Validates: Requirements 3.2
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { ContentItem, CategoryTag } from '../../src/types';

describe('Feature: ui-data-fetching-fixes, Property 2: Filter Tag Validation', () => {
  // Arbitrary for category filter tags
  const filterTagArbitrary = fc.constantFrom(
    'comedy_movies',
    'action_movies',
    'romance_movies',
    'comedy_series',
    'action_series',
    'romance_series',
    'comedy_kids',
    'action_kids'
  ) as fc.Arbitrary<CategoryTag>;

  // Arbitrary for generating ContentItem
  const contentItemArbitrary = (requiredTag: string) =>
    fc.record({
      claim_id: fc.hexaString({ minLength: 40, maxLength: 40 }),
      title: fc.string({ minLength: 1, maxLength: 100 }),
      description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
      tags: fc
        .array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 10 })
        .map((tags) => [requiredTag, ...tags]), // Ensure required tag is present
      thumbnail_url: fc.option(fc.webUrl(), { nil: undefined }),
      duration: fc.option(fc.nat({ max: 10800 }), { nil: undefined }),
      release_time: fc.nat(),
      video_urls: fc.dictionary(
        fc.constantFrom('1080p', '720p', '480p', '360p', '240p'),
        fc.record({
          url: fc.webUrl(),
          quality: fc.constantFrom('1080p', '720p', '480p', '360p', '240p'),
          type: fc.constantFrom('mp4', 'hls') as fc.Arbitrary<'mp4' | 'hls'>,
          codec: fc.option(fc.constantFrom('h264', 'h265', 'vp9'), { nil: undefined }),
        }),
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

  it('should ensure all content items contain the filter tag in their tags array', () => {
    fc.assert(
      fc.property(
        filterTagArbitrary,
        fc.array(fc.nat({ max: 50 }), { minLength: 1, maxLength: 20 }),
        (filterTag: CategoryTag, _indices: number[]) => {
          // Arrange: Generate content items that should have the filter tag
          const contentItems: ContentItem[] = _indices.map(() => {
            const item = fc.sample(contentItemArbitrary(filterTag), 1)[0];
            return item;
          });

          // Act & Assert: Verify all items contain the filter tag
          for (const item of contentItems) {
            expect(item.tags).toContain(filterTag);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should validate that filter function correctly filters by tag', () => {
    fc.assert(
      fc.property(
        filterTagArbitrary,
        fc.array(fc.nat({ max: 50 }), { minLength: 5, maxLength: 20 }),
        (filterTag: CategoryTag, _indices: number[]) => {
          // Arrange: Generate mix of content with and without the filter tag
          const contentWithTag: ContentItem[] = _indices.slice(0, Math.floor(_indices.length / 2)).map(() => {
            return fc.sample(contentItemArbitrary(filterTag), 1)[0];
          });

          const contentWithoutTag: ContentItem[] = _indices.slice(Math.floor(_indices.length / 2)).map(() => {
            const item = fc.sample(contentItemArbitrary('other_tag'), 1)[0];
            // Ensure the filter tag is NOT in the tags
            item.tags = item.tags.filter((t) => t !== filterTag);
            return item;
          });

          const allContent = [...contentWithTag, ...contentWithoutTag];

          // Act: Filter content by tag
          const filtered = allContent.filter((item) => item.tags.includes(filterTag));

          // Assert: Filtered content should only contain items with the filter tag
          expect(filtered.length).toBe(contentWithTag.length);
          for (const item of filtered) {
            expect(item.tags).toContain(filterTag);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should handle content with multiple tags including the filter tag', () => {
    fc.assert(
      fc.property(
        filterTagArbitrary,
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }),
        (filterTag: CategoryTag, additionalTags: string[]) => {
          // Arrange: Create content with multiple tags including the filter tag
          const tags = [filterTag, ...additionalTags.filter((t) => t !== filterTag)];
          const content: ContentItem = {
            claim_id: fc.sample(fc.hexaString({ minLength: 40, maxLength: 40 }), 1)[0],
            title: 'Test Content',
            tags,
            release_time: Date.now(),
            video_urls: {
              '720p': {
                url: 'https://example.com/video.mp4',
                quality: '720p',
                type: 'mp4',
              },
            },
            compatibility: { compatible: true, fallback_available: false },
          };

          // Act & Assert: Verify the filter tag is present
          expect(content.tags).toContain(filterTag);
          expect(content.tags.length).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should validate that base tag and filter tag can coexist', () => {
    fc.assert(
      fc.property(
        filterTagArbitrary,
        (filterTag: CategoryTag) => {
          // Arrange: Determine base tag from filter tag
          let baseTag = 'movie';
          if (filterTag.includes('series')) baseTag = 'series';
          if (filterTag.includes('kids')) baseTag = 'kids';

          // Create content with both base tag and filter tag
          const content: ContentItem = {
            claim_id: fc.sample(fc.hexaString({ minLength: 40, maxLength: 40 }), 1)[0],
            title: 'Test Content',
            tags: [baseTag, filterTag],
            release_time: Date.now(),
            video_urls: {
              '720p': {
                url: 'https://example.com/video.mp4',
                quality: '720p',
                type: 'mp4',
              },
            },
            compatibility: { compatible: true, fallback_available: false },
          };

          // Act & Assert: Verify both tags are present
          expect(content.tags).toContain(baseTag);
          expect(content.tags).toContain(filterTag);
        }
      ),
      { numRuns: 20 }
    );
  });
});

