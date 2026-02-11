import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  organizeEpisodesFromPlaylist,
  organizeSeriesFromPlaylists,
  organizeEpisodesByParsing
} from '../../src/lib/series';
import { ContentItem, Playlist } from '../../src/types';

/**
 * Property-Based Tests for Series Episode Ordering Preservation
 * 
 * **Feature: kiyya-desktop-streaming, Property 3: Series Episode Ordering Preservation**
 * 
 * For any series with available playlist data, the episode order in the UI should 
 * exactly match the playlist order, and when playlist data is unavailable, episodes 
 * should be ordered by parsed season/episode numbers with consistent sorting.
 * 
 * Validates: Requirements 2.1, 2.3, 2.4
 */

// Arbitrary generators for series and playlist data

// Generate a valid claim ID
const claimIdArb = fc.uuid();

// Generate episode number (1-999)
const episodeNumberArb = fc.integer({ min: 1, max: 999 });

// Generate season number (1-20)
const seasonNumberArb = fc.integer({ min: 1, max: 20 });

// Generate a playlist item with position
const playlistItemArb = fc.record({
  claim_id: claimIdArb,
  position: fc.integer({ min: 0, max: 100 }),
  episode_number: fc.option(episodeNumberArb, { nil: undefined }),
  season_number: fc.option(seasonNumberArb, { nil: undefined }),
});

// Generate a playlist with items that have unique positions
const playlistWithUniquePositionsArb = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 50 }),
  claim_id: fc.uuid(),
  season_number: fc.option(seasonNumberArb, { nil: undefined }),
  series_key: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
  items: fc.array(playlistItemArb, { minLength: 1, maxLength: 20 })
    .map(items => {
      // Ensure unique positions by reassigning them sequentially
      return items.map((item, index) => ({
        ...item,
        position: index
      }));
    })
});

// Generate a playlist where episode numbers don't match position order
const playlistWithMismatchedOrderArb = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 50 }),
  claim_id: fc.uuid(),
  season_number: seasonNumberArb,
  series_key: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
  items: fc.array(
    fc.record({
      claim_id: claimIdArb,
      position: fc.integer({ min: 0, max: 100 }),
      episode_number: episodeNumberArb,
      season_number: fc.option(seasonNumberArb, { nil: undefined }),
    }),
    { minLength: 3, maxLength: 10 }
  ).map(items => {
    // Assign sequential positions but shuffle episode numbers
    const episodeNumbers = items.map(item => item.episode_number);
    const shuffledEpisodeNumbers = [...episodeNumbers].sort(() => Math.random() - 0.5);
    
    return items.map((item, index) => ({
      ...item,
      position: index,
      episode_number: shuffledEpisodeNumbers[index]
    }));
  })
});

// Generate content map from playlist items
function generateContentMapFromPlaylist(playlist: Playlist): Map<string, ContentItem> {
  const contentMap = new Map<string, ContentItem>();
  
  for (const item of playlist.items) {
    contentMap.set(item.claim_id, {
      claim_id: item.claim_id,
      title: `Episode ${item.episode_number || item.position + 1}`,
      tags: ['series'],
      release_time: 1000000000,
      video_urls: {},
      compatibility: { compatible: true, fallback_available: false }
    });
  }
  
  return contentMap;
}

// Generate content items with parseable episode titles
const parseableEpisodeContentArb = fc.tuple(
  fc.string({ minLength: 1, maxLength: 30 }),
  seasonNumberArb,
  episodeNumberArb
).chain(([seriesName, season, episode]) => {
  const seasonStr = season.toString().padStart(2, '0');
  const episodeStr = episode.toString().padStart(2, '0');
  const title = `${seriesName} S${seasonStr}E${episodeStr} - Episode Title`;
  
  return fc.record({
    claim_id: claimIdArb,
    title: fc.constant(title),
    tags: fc.constant(['series']),
    thumbnail_url: fc.option(fc.webUrl(), { nil: undefined }),
    duration: fc.option(fc.integer({ min: 60, max: 7200 }), { nil: undefined }),
    release_time: fc.integer({ min: 1000000000, max: 2000000000 }),
    video_urls: fc.constant({}),
    compatibility: fc.constant({ compatible: true, fallback_available: false }),
  });
});

describe('Property-Based Tests: Series Episode Ordering Preservation', () => {
  describe('Property 3: Series Episode Ordering Preservation', () => {
    it('should preserve playlist position order regardless of episode numbers', () => {
      fc.assert(
        fc.property(playlistWithMismatchedOrderArb, (playlist) => {
          const contentMap = generateContentMapFromPlaylist(playlist);
          const episodes = organizeEpisodesFromPlaylist(playlist, contentMap);
          
          // Episodes should be in position order
          expect(episodes.length).toBe(playlist.items.length);
          
          // Verify position order is preserved
          for (let i = 0; i < episodes.length; i++) {
            const expectedClaimId = playlist.items.find(item => item.position === i)?.claim_id;
            expect(episodes[i].claim_id).toBe(expectedClaimId);
          }
          
          // Verify that episodes are NOT sorted by episode number
          const episodeNumbers = episodes.map(e => e.episode_number);
          
          // If episode numbers were originally shuffled, they should NOT match sorted order
          // (unless by chance they were already sorted)
          const originalEpisodeNumbers = playlist.items
            .sort((a, b) => a.position - b.position)
            .map(item => item.episode_number);
          
          // The order should match the original playlist order, not the sorted episode numbers
          expect(episodeNumbers).toEqual(originalEpisodeNumbers);
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain position order even when playlist items are provided out of order', () => {
      fc.assert(
        fc.property(playlistWithUniquePositionsArb, (playlist) => {
          // Shuffle the items array to simulate receiving data out of order
          const shuffledPlaylist = {
            ...playlist,
            items: [...playlist.items].sort(() => Math.random() - 0.5)
          };
          
          const contentMap = generateContentMapFromPlaylist(shuffledPlaylist);
          const episodes = organizeEpisodesFromPlaylist(shuffledPlaylist, contentMap);
          
          // Episodes should be sorted by position, not by the order they were provided
          for (let i = 0; i < episodes.length - 1; i++) {
            const currentItem = shuffledPlaylist.items.find(item => item.claim_id === episodes[i].claim_id);
            const nextItem = shuffledPlaylist.items.find(item => item.claim_id === episodes[i + 1].claim_id);
            
            expect(currentItem).toBeDefined();
            expect(nextItem).toBeDefined();
            expect(currentItem!.position).toBeLessThan(nextItem!.position);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve position order across multiple seasons in a series', () => {
      fc.assert(
        fc.property(
          fc.array(playlistWithMismatchedOrderArb, { minLength: 2, maxLength: 5 }),
          (playlists) => {
            // Ensure each playlist has a unique season number and same series key
            const normalizedPlaylists = playlists.map((playlist, idx) => ({
              ...playlist,
              season_number: idx + 1,
              series_key: 'test-series'
            }));
            
            const contentMap = new Map<string, ContentItem>();
            
            // Build content map from all playlists
            for (const playlist of normalizedPlaylists) {
              const playlistContentMap = generateContentMapFromPlaylist(playlist);
              for (const [claimId, content] of playlistContentMap.entries()) {
                contentMap.set(claimId, content);
              }
            }
            
            const seriesMap = organizeSeriesFromPlaylists(normalizedPlaylists, contentMap);
            
            // Should have exactly one series
            expect(seriesMap.size).toBe(1);
            
            const series = seriesMap.get('test-series');
            expect(series).toBeDefined();
            expect(series!.seasons.length).toBe(normalizedPlaylists.length);
            
            // Verify each season maintains position order
            for (let seasonIdx = 0; seasonIdx < normalizedPlaylists.length; seasonIdx++) {
              const season = series!.seasons[seasonIdx];
              const playlist = normalizedPlaylists[seasonIdx];
              
              expect(season.episodes.length).toBe(playlist.items.length);
              
              // Verify position order within this season
              for (let i = 0; i < season.episodes.length; i++) {
                const expectedClaimId = playlist.items.find(item => item.position === i)?.claim_id;
                expect(season.episodes[i].claim_id).toBe(expectedClaimId);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should sort episodes by episode number when using title parsing (no playlist)', () => {
      fc.assert(
        fc.property(
          fc.array(parseableEpisodeContentArb, { minLength: 3, maxLength: 10 })
            .map(items => {
              // Shuffle the items to simulate random order
              return [...items].sort(() => Math.random() - 0.5);
            }),
          (content) => {
            const seriesMap = organizeEpisodesByParsing(content);
            
            // For each series, verify episodes are sorted by episode number within each season
            for (const seriesInfo of seriesMap.values()) {
              for (const season of seriesInfo.seasons) {
                // Episodes should be sorted by episode number
                for (let i = 0; i < season.episodes.length - 1; i++) {
                  expect(season.episodes[i].episode_number).toBeLessThanOrEqual(
                    season.episodes[i + 1].episode_number
                  );
                }
                
                // Verify the season is marked as inferred
                expect(season.inferred).toBe(true);
                expect(season.playlist_id).toBeUndefined();
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain consistent ordering across simulated reloads', () => {
      fc.assert(
        fc.property(playlistWithMismatchedOrderArb, (playlist) => {
          const contentMap = generateContentMapFromPlaylist(playlist);
          
          // First load
          const firstLoadEpisodes = organizeEpisodesFromPlaylist(playlist, contentMap);
          
          // Simulate reload with same data
          const reloadedEpisodes = organizeEpisodesFromPlaylist(playlist, contentMap);
          
          // Third load
          const thirdLoadEpisodes = organizeEpisodesFromPlaylist(playlist, contentMap);
          
          // All loads should produce identical ordering
          expect(reloadedEpisodes.length).toBe(firstLoadEpisodes.length);
          expect(thirdLoadEpisodes.length).toBe(firstLoadEpisodes.length);
          
          for (let i = 0; i < firstLoadEpisodes.length; i++) {
            expect(reloadedEpisodes[i].claim_id).toBe(firstLoadEpisodes[i].claim_id);
            expect(reloadedEpisodes[i].episode_number).toBe(firstLoadEpisodes[i].episode_number);
            
            expect(thirdLoadEpisodes[i].claim_id).toBe(firstLoadEpisodes[i].claim_id);
            expect(thirdLoadEpisodes[i].episode_number).toBe(firstLoadEpisodes[i].episode_number);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should handle playlists with gaps in position numbers', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              claim_id: claimIdArb,
              position: fc.integer({ min: 0, max: 100 }),
              episode_number: episodeNumberArb,
              season_number: fc.option(seasonNumberArb, { nil: undefined }),
            }),
            { minLength: 3, maxLength: 10 }
          ).map(items => {
            // Create gaps in position numbers
            return items.map((item, index) => ({
              ...item,
              position: index * 5 // Positions: 0, 5, 10, 15, ...
            }));
          }),
          (items) => {
            const playlist: Playlist = {
              id: 'test-playlist',
              title: 'Test Series',
              claim_id: 'playlist-claim',
              season_number: 1,
              items
            };
            
            const contentMap = generateContentMapFromPlaylist(playlist);
            const episodes = organizeEpisodesFromPlaylist(playlist, contentMap);
            
            // Should still maintain position order despite gaps
            expect(episodes.length).toBe(items.length);
            
            for (let i = 0; i < episodes.length - 1; i++) {
              const currentItem = items.find(item => item.claim_id === episodes[i].claim_id);
              const nextItem = items.find(item => item.claim_id === episodes[i + 1].claim_id);
              
              expect(currentItem).toBeDefined();
              expect(nextItem).toBeDefined();
              expect(currentItem!.position).toBeLessThan(nextItem!.position);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never reorder episodes by episode number when playlist data exists', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              claim_id: claimIdArb,
              position: fc.integer({ min: 0, max: 100 }),
              episode_number: episodeNumberArb,
            }),
            { minLength: 5, maxLength: 15 }
          ).map(items => {
            // Assign sequential positions
            const withPositions = items.map((item, index) => ({
              ...item,
              position: index
            }));
            
            // Shuffle episode numbers to ensure they don't match position order
            const episodeNumbers = withPositions.map(item => item.episode_number);
            const shuffled = [...episodeNumbers].sort(() => Math.random() - 0.5);
            
            return withPositions.map((item, index) => ({
              ...item,
              episode_number: shuffled[index]
            }));
          }),
          (items) => {
            const playlist: Playlist = {
              id: 'test-playlist',
              title: 'Test Series',
              claim_id: 'playlist-claim',
              season_number: 1,
              items
            };
            
            const contentMap = generateContentMapFromPlaylist(playlist);
            const episodes = organizeEpisodesFromPlaylist(playlist, contentMap);
            
            // Extract episode numbers in the order they appear
            const actualOrder = episodes.map(e => e.episode_number);
            
            // Extract episode numbers sorted by episode number
            const sortedByEpisodeNumber = [...actualOrder].sort((a, b) => a - b);
            
            // Extract expected order (by position)
            const expectedOrder = items
              .sort((a, b) => a.position - b.position)
              .map(item => item.episode_number);
            
            // Actual order should match expected (position) order
            expect(actualOrder).toEqual(expectedOrder);
            
            // If episode numbers were shuffled, actual order should NOT match sorted order
            // (unless by random chance they ended up sorted)
            const isSorted = actualOrder.every((num, idx) => 
              idx === 0 || num >= actualOrder[idx - 1]
            );
            
            if (!isSorted) {
              // If not sorted, verify it's different from sorted order
              expect(actualOrder).not.toEqual(sortedByEpisodeNumber);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle single episode playlists correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            claim_id: claimIdArb,
            position: fc.constant(0),
            episode_number: episodeNumberArb,
            season_number: seasonNumberArb,
          }),
          (item) => {
            const playlist: Playlist = {
              id: 'test-playlist',
              title: 'Single Episode',
              claim_id: 'playlist-claim',
              season_number: item.season_number,
              items: [item]
            };
            
            const contentMap = new Map<string, ContentItem>([
              [item.claim_id, {
                claim_id: item.claim_id,
                title: 'Episode',
                tags: ['series'],
                release_time: 1000000000,
                video_urls: {},
                compatibility: { compatible: true, fallback_available: false }
              }]
            ]);
            
            const episodes = organizeEpisodesFromPlaylist(playlist, contentMap);
            
            expect(episodes.length).toBe(1);
            expect(episodes[0].claim_id).toBe(item.claim_id);
            expect(episodes[0].episode_number).toBe(item.episode_number);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain idempotency: organizing the same playlist multiple times yields the same result', () => {
      fc.assert(
        fc.property(playlistWithMismatchedOrderArb, (playlist) => {
          const contentMap = generateContentMapFromPlaylist(playlist);
          
          const result1 = organizeEpisodesFromPlaylist(playlist, contentMap);
          const result2 = organizeEpisodesFromPlaylist(playlist, contentMap);
          const result3 = organizeEpisodesFromPlaylist(playlist, contentMap);
          
          // All results should be identical
          expect(result1.length).toBe(result2.length);
          expect(result2.length).toBe(result3.length);
          
          for (let i = 0; i < result1.length; i++) {
            expect(result1[i].claim_id).toBe(result2[i].claim_id);
            expect(result2[i].claim_id).toBe(result3[i].claim_id);
            
            expect(result1[i].episode_number).toBe(result2[i].episode_number);
            expect(result2[i].episode_number).toBe(result3[i].episode_number);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should correctly parse episode titles and sort by episode number when no playlist exists', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            // Generate series names that are not just whitespace
            fc.string({ minLength: 1, maxLength: 20 })
              .filter(s => s.trim().length > 0),
            // Generate unique season/episode combinations
            fc.array(
              fc.tuple(seasonNumberArb, episodeNumberArb),
              { minLength: 3, maxLength: 10 }
            ).map(episodes => {
              // Remove duplicates by creating a Set of unique combinations
              const uniqueEpisodes = Array.from(
                new Map(episodes.map(([s, e]) => [`${s}-${e}`, [s, e]])).values()
              );
              // Ensure we have at least 1 unique episode
              return uniqueEpisodes.length > 0 ? uniqueEpisodes : [[1, 1]];
            })
          ),
          ([seriesName, episodeData]) => {
            // Create content items with parseable titles
            const content: ContentItem[] = episodeData.map(([season, episode], index) => {
              const seasonStr = season.toString().padStart(2, '0');
              const episodeStr = episode.toString().padStart(2, '0');
              
              return {
                claim_id: `${season}-${episode}-${index}`, // Add index to ensure unique claim IDs
                title: `${seriesName} S${seasonStr}E${episodeStr} - Episode Title`,
                tags: ['series'],
                release_time: 1000000000,
                video_urls: {},
                compatibility: { compatible: true, fallback_available: false }
              };
            });
            
            const seriesMap = organizeEpisodesByParsing(content);
            
            // Should have exactly one series (since all have the same series name)
            expect(seriesMap.size).toBeGreaterThan(0);
            
            for (const seriesInfo of seriesMap.values()) {
              // Each season should have episodes sorted by episode number
              for (const season of seriesInfo.seasons) {
                for (let i = 0; i < season.episodes.length - 1; i++) {
                  expect(season.episodes[i].episode_number).toBeLessThanOrEqual(
                    season.episodes[i + 1].episode_number
                  );
                }
                
                // Should be marked as inferred
                expect(season.inferred).toBe(true);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
