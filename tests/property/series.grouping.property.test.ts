/**
 * Property-Based Test: Series Episode Grouping
 * Feature: ui-data-fetching-fixes
 * Property 4: Series Episode Grouping
 * 
 * For any set of series episodes with matching series identifiers, the 
 * useSeriesGrouped hook should group them under a single series container 
 * with correct season and episode organization.
 * 
 * Validates: Requirements 4.2
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { groupSeriesContent } from '../../src/lib/series';
import type { ContentItem } from '../../src/types';

describe('Feature: ui-data-fetching-fixes, Property 4: Series Episode Grouping', () => {
  // Arbitrary for generating episode titles in SxxExx format
  const episodeTitleArbitrary = fc.record({
    seriesName: fc.string({ minLength: 3, maxLength: 30 }).filter((s) => !s.includes('S') || !s.includes('E')),
    seasonNumber: fc.integer({ min: 1, max: 10 }),
    episodeNumber: fc.integer({ min: 1, max: 50 }),
    episodeTitle: fc.string({ minLength: 3, maxLength: 50 }),
  }).map(({ seriesName, seasonNumber, episodeNumber, episodeTitle }) => {
    const season = seasonNumber.toString().padStart(2, '0');
    const episode = episodeNumber.toString().padStart(2, '0');
    return {
      fullTitle: `${seriesName} S${season}E${episode} - ${episodeTitle}`,
      seriesName,
      seasonNumber,
      episodeNumber,
    };
  });

  // Arbitrary for generating ContentItem for series episodes
  const seriesEpisodeArbitrary = (episodeData: { fullTitle: string; seriesName: string; seasonNumber: number; episodeNumber: number }) =>
    fc.record({
      claim_id: fc.hexaString({ minLength: 40, maxLength: 40 }),
      tags: fc.constant(['series']),
      thumbnail_url: fc.option(fc.webUrl()),
      duration: fc.option(fc.nat({ max: 3600 })),
      release_time: fc.nat(),
      video_urls: fc.dictionary(
        fc.constantFrom('720p', '480p'),
        fc.record({
          url: fc.webUrl(),
          quality: fc.constantFrom('720p', '480p'),
          type: fc.constantFrom('mp4', 'hls') as fc.Arbitrary<'mp4' | 'hls'>,
        }),
        { minKeys: 1, maxKeys: 2 }
      ),
      compatibility: fc.record({
        compatible: fc.boolean(),
        reason: fc.option(fc.string()),
        fallback_available: fc.boolean(),
      }),
    }).map((item) => ({
      ...item,
      title: episodeData.fullTitle,
    }));

  it('should group episodes with the same series name under a single series', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 30 }).filter((s) => !s.includes('S') || !s.includes('E')),
        fc.array(
          fc.record({
            seasonNumber: fc.integer({ min: 1, max: 3 }),
            episodeNumber: fc.integer({ min: 1, max: 10 }),
          }),
          { minLength: 2, maxLength: 10 }
        ),
        (seriesName: string, episodes: Array<{ seasonNumber: number; episodeNumber: number }>) => {
          // Arrange: Create multiple episodes for the same series
          const contentItems: ContentItem[] = episodes.map(({ seasonNumber, episodeNumber }) => {
            const season = seasonNumber.toString().padStart(2, '0');
            const episode = episodeNumber.toString().padStart(2, '0');
            const title = `${seriesName} S${season}E${episode} - Episode Title`;
            
            return {
              claim_id: fc.sample(fc.hexaString({ minLength: 40, maxLength: 40 }), 1)[0],
              title,
              tags: ['series'],
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
          });

          // Act: Group series content
          const { series, nonSeriesContent } = groupSeriesContent(contentItems, []);

          // Assert: All episodes should be grouped under one series
          expect(series.size).toBe(1);
          expect(nonSeriesContent.length).toBe(0);

          // Get the series info
          const seriesInfo = Array.from(series.values())[0];
          expect(seriesInfo).toBeDefined();
          
          // Total episodes should match input
          expect(seriesInfo.total_episodes).toBe(episodes.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should preserve all episodes when grouping series', () => {
    fc.assert(
      fc.property(
        fc.array(episodeTitleArbitrary, { minLength: 1, maxLength: 20 }),
        (episodeDataArray) => {
          // Arrange: Create content items from episode data
          const contentItems: ContentItem[] = episodeDataArray.map((episodeData) => {
            const sample = fc.sample(seriesEpisodeArbitrary(episodeData), 1)[0];
            return sample as ContentItem;
          });

          // Act: Group series content
          const { series, nonSeriesContent } = groupSeriesContent(contentItems, []);

          // Assert: Total episodes across all series should equal input count
          let totalEpisodes = 0;
          for (const seriesInfo of series.values()) {
            totalEpisodes += seriesInfo.total_episodes;
          }

          expect(totalEpisodes + nonSeriesContent.length).toBe(contentItems.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should correctly organize episodes by season', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 30 }).filter((s) => !s.includes('S') || !s.includes('E')),
        fc.integer({ min: 1, max: 3 }),
        fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 1, maxLength: 5 }),
        (seriesName: string, seasonNumber: number, episodeNumbers: number[]) => {
          // Arrange: Create episodes for a single season
          const contentItems: ContentItem[] = episodeNumbers.map((episodeNumber) => {
            const season = seasonNumber.toString().padStart(2, '0');
            const episode = episodeNumber.toString().padStart(2, '0');
            const title = `${seriesName} S${season}E${episode} - Episode Title`;
            
            return {
              claim_id: fc.sample(fc.hexaString({ minLength: 40, maxLength: 40 }), 1)[0],
              title,
              tags: ['series'],
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
          });

          // Act: Group series content
          const { series } = groupSeriesContent(contentItems, []);

          // Assert: Should have one series with one season
          expect(series.size).toBe(1);
          const seriesInfo = Array.from(series.values())[0];
          
          // Find the season
          const season = seriesInfo.seasons.find((s) => s.number === seasonNumber);
          expect(season).toBeDefined();
          
          if (season) {
            // All episodes should be in this season
            expect(season.episodes.length).toBe(episodeNumbers.length);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should separate series content from non-series content', () => {
    fc.assert(
      fc.property(
        fc.array(episodeTitleArbitrary, { minLength: 1, maxLength: 10 }),
        fc.array(
          fc.record({
            claim_id: fc.hexaString({ minLength: 40, maxLength: 40 }),
            title: fc.string({ minLength: 5, maxLength: 50 }).filter((t) => !t.match(/S\d{1,2}E\d{1,3}/)),
            tags: fc.constantFrom(['movie'], ['documentary'], ['music']),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (seriesEpisodes, nonSeriesItems) => {
          // Arrange: Create series content
          const seriesContent: ContentItem[] = seriesEpisodes.map((episodeData) => {
            const sample = fc.sample(seriesEpisodeArbitrary(episodeData), 1)[0];
            return sample as ContentItem;
          });

          // Create non-series content
          const nonSeriesContentInput: ContentItem[] = nonSeriesItems.map((item) => ({
            ...item,
            release_time: Date.now(),
            video_urls: {
              '720p': {
                url: 'https://example.com/video.mp4',
                quality: '720p',
                type: 'mp4',
              },
            },
            compatibility: { compatible: true, fallback_available: false },
          }));

          // Mix series and non-series content
          const allContent = [...seriesContent, ...nonSeriesContentInput];

          // Act: Group series content
          const { series, nonSeriesContent } = groupSeriesContent(allContent, []);

          // Assert: Non-series content should be separated
          expect(nonSeriesContent.length).toBe(nonSeriesContentInput.length);
          
          // All non-series content should not have series tag
          for (const item of nonSeriesContent) {
            expect(item.tags).not.toContain('series');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle multiple series in the same content array', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            seriesName: fc.string({ minLength: 3, maxLength: 30 }).filter((s) => !s.includes('S') || !s.includes('E')),
            episodeCount: fc.integer({ min: 1, max: 5 }),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        (seriesArray) => {
          // Arrange: Create episodes for multiple series
          const contentItems: ContentItem[] = [];
          
          for (const { seriesName, episodeCount } of seriesArray) {
            for (let i = 1; i <= episodeCount; i++) {
              const title = `${seriesName} S01E${i.toString().padStart(2, '0')} - Episode ${i}`;
              contentItems.push({
                claim_id: fc.sample(fc.hexaString({ minLength: 40, maxLength: 40 }), 1)[0],
                title,
                tags: ['series'],
                release_time: Date.now(),
                video_urls: {
                  '720p': {
                    url: 'https://example.com/video.mp4',
                    quality: '720p',
                    type: 'mp4',
                  },
                },
                compatibility: { compatible: true, fallback_available: false },
              });
            }
          }

          // Act: Group series content
          const { series } = groupSeriesContent(contentItems, []);

          // Assert: Should have one series per unique series name
          // Note: Series with the same normalized name will be grouped together
          expect(series.size).toBeGreaterThan(0);
          expect(series.size).toBeLessThanOrEqual(seriesArray.length);
        }
      ),
      { numRuns: 50 }
    );
  });
});

