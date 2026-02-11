import { describe, it, expect } from 'vitest';
import {
  organizeEpisodesFromPlaylist,
  organizeSeriesFromPlaylists,
  mergeSeriesData
} from '../../src/lib/series';
import { ContentItem, Playlist } from '../../src/types';

/**
 * Tests for episode ordering preservation across reloads
 * 
 * These tests verify that playlist position order is preserved as the canonical
 * episode ordering, regardless of episode numbers or title parsing. This ensures
 * that content creators' intended episode order is maintained across application
 * reloads and never reordered by episode number.
 */

describe('Episode Ordering Preservation Across Reloads', () => {
  describe('Playlist Position as Canonical Order', () => {
    it('should preserve playlist position order even when episode numbers suggest different order', () => {
      // Simulate a playlist where the creator intentionally ordered episodes differently
      // than their episode numbers (e.g., for non-linear storytelling)
      const playlist: Playlist = {
        id: 'playlist1',
        title: 'Non-Linear Series Season 1',
        claim_id: 'playlist_claim',
        season_number: 1,
        series_key: 'non-linear-series',
        items: [
          { claim_id: 'ep5', position: 0, episode_number: 5, season_number: 1 }, // Episode 5 first
          { claim_id: 'ep1', position: 1, episode_number: 1, season_number: 1 }, // Episode 1 second
          { claim_id: 'ep3', position: 2, episode_number: 3, season_number: 1 }, // Episode 3 third
          { claim_id: 'ep2', position: 3, episode_number: 2, season_number: 1 }, // Episode 2 fourth
          { claim_id: 'ep4', position: 4, episode_number: 4, season_number: 1 }  // Episode 4 fifth
        ]
      };

      const contentMap = new Map<string, ContentItem>([
        ['ep1', { claim_id: 'ep1', title: 'Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
        ['ep2', { claim_id: 'ep2', title: 'Episode 2', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
        ['ep3', { claim_id: 'ep3', title: 'Episode 3', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
        ['ep4', { claim_id: 'ep4', title: 'Episode 4', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
        ['ep5', { claim_id: 'ep5', title: 'Episode 5', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }]
      ]);

      const episodes = organizeEpisodesFromPlaylist(playlist, contentMap);

      // Verify that episodes are in playlist position order, NOT episode number order
      expect(episodes).toHaveLength(5);
      expect(episodes[0].claim_id).toBe('ep5'); // Position 0
      expect(episodes[1].claim_id).toBe('ep1'); // Position 1
      expect(episodes[2].claim_id).toBe('ep3'); // Position 2
      expect(episodes[3].claim_id).toBe('ep2'); // Position 3
      expect(episodes[4].claim_id).toBe('ep4'); // Position 4

      // Episode numbers are preserved but don't affect display order
      expect(episodes[0].episode_number).toBe(5);
      expect(episodes[1].episode_number).toBe(1);
      expect(episodes[2].episode_number).toBe(3);
      expect(episodes[3].episode_number).toBe(2);
      expect(episodes[4].episode_number).toBe(4);
    });

    it('should maintain position order when playlist items are provided out of order', () => {
      // Simulate receiving playlist items in random order (as might happen from API)
      const playlist: Playlist = {
        id: 'playlist1',
        title: 'Test Series Season 1',
        claim_id: 'playlist_claim',
        season_number: 1,
        items: [
          { claim_id: 'ep3', position: 2, episode_number: 3, season_number: 1 }, // Out of order
          { claim_id: 'ep1', position: 0, episode_number: 1, season_number: 1 },
          { claim_id: 'ep4', position: 3, episode_number: 4, season_number: 1 },
          { claim_id: 'ep2', position: 1, episode_number: 2, season_number: 1 }
        ]
      };

      const contentMap = new Map<string, ContentItem>([
        ['ep1', { claim_id: 'ep1', title: 'Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
        ['ep2', { claim_id: 'ep2', title: 'Episode 2', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
        ['ep3', { claim_id: 'ep3', title: 'Episode 3', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
        ['ep4', { claim_id: 'ep4', title: 'Episode 4', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }]
      ]);

      const episodes = organizeEpisodesFromPlaylist(playlist, contentMap);

      // Should be sorted by position, not by the order they were provided
      expect(episodes).toHaveLength(4);
      expect(episodes[0].claim_id).toBe('ep1'); // Position 0
      expect(episodes[1].claim_id).toBe('ep2'); // Position 1
      expect(episodes[2].claim_id).toBe('ep3'); // Position 2
      expect(episodes[3].claim_id).toBe('ep4'); // Position 3
    });

    it('should preserve position order across multiple seasons', () => {
      const playlists: Playlist[] = [
        {
          id: 'playlist1',
          title: 'Series Season 1',
          claim_id: 'playlist_claim1',
          season_number: 1,
          series_key: 'test-series',
          items: [
            { claim_id: 's1e3', position: 0, episode_number: 3, season_number: 1 },
            { claim_id: 's1e1', position: 1, episode_number: 1, season_number: 1 },
            { claim_id: 's1e2', position: 2, episode_number: 2, season_number: 1 }
          ]
        },
        {
          id: 'playlist2',
          title: 'Series Season 2',
          claim_id: 'playlist_claim2',
          season_number: 2,
          series_key: 'test-series',
          items: [
            { claim_id: 's2e2', position: 0, episode_number: 2, season_number: 2 },
            { claim_id: 's2e1', position: 1, episode_number: 1, season_number: 2 }
          ]
        }
      ];

      const contentMap = new Map<string, ContentItem>([
        ['s1e1', { claim_id: 's1e1', title: 'S1E1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
        ['s1e2', { claim_id: 's1e2', title: 'S1E2', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
        ['s1e3', { claim_id: 's1e3', title: 'S1E3', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
        ['s2e1', { claim_id: 's2e1', title: 'S2E1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
        ['s2e2', { claim_id: 's2e2', title: 'S2E2', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }]
      ]);

      const seriesMap = organizeSeriesFromPlaylists(playlists, contentMap);
      const series = seriesMap.get('test-series');

      expect(series).toBeDefined();
      expect(series!.seasons).toHaveLength(2);

      // Season 1: position order (3, 1, 2)
      const season1Episodes = series!.seasons[0].episodes;
      expect(season1Episodes[0].claim_id).toBe('s1e3'); // Position 0
      expect(season1Episodes[1].claim_id).toBe('s1e1'); // Position 1
      expect(season1Episodes[2].claim_id).toBe('s1e2'); // Position 2

      // Season 2: position order (2, 1)
      const season2Episodes = series!.seasons[1].episodes;
      expect(season2Episodes[0].claim_id).toBe('s2e2'); // Position 0
      expect(season2Episodes[1].claim_id).toBe('s2e1'); // Position 1
    });
  });

  describe('Simulated Reload Scenarios', () => {
    it('should maintain same order after simulated database reload', () => {
      // First load: organize episodes from playlist
      const playlist: Playlist = {
        id: 'playlist1',
        title: 'Series Season 1',
        claim_id: 'playlist_claim',
        season_number: 1,
        series_key: 'test-series',
        items: [
          { claim_id: 'ep4', position: 0, episode_number: 4, season_number: 1 },
          { claim_id: 'ep2', position: 1, episode_number: 2, season_number: 1 },
          { claim_id: 'ep1', position: 2, episode_number: 1, season_number: 1 },
          { claim_id: 'ep3', position: 3, episode_number: 3, season_number: 1 }
        ]
      };

      const contentMap = new Map<string, ContentItem>([
        ['ep1', { claim_id: 'ep1', title: 'Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
        ['ep2', { claim_id: 'ep2', title: 'Episode 2', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
        ['ep3', { claim_id: 'ep3', title: 'Episode 3', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
        ['ep4', { claim_id: 'ep4', title: 'Episode 4', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }]
      ]);

      const firstLoadEpisodes = organizeEpisodesFromPlaylist(playlist, contentMap);

      // Simulate reload: create new playlist object with same data (as would come from database)
      const reloadedPlaylist: Playlist = {
        id: 'playlist1',
        title: 'Series Season 1',
        claim_id: 'playlist_claim',
        season_number: 1,
        series_key: 'test-series',
        items: [
          { claim_id: 'ep4', position: 0, episode_number: 4, season_number: 1 },
          { claim_id: 'ep2', position: 1, episode_number: 2, season_number: 1 },
          { claim_id: 'ep1', position: 2, episode_number: 1, season_number: 1 },
          { claim_id: 'ep3', position: 3, episode_number: 3, season_number: 1 }
        ]
      };

      const reloadedContentMap = new Map<string, ContentItem>([
        ['ep1', { claim_id: 'ep1', title: 'Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
        ['ep2', { claim_id: 'ep2', title: 'Episode 2', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
        ['ep3', { claim_id: 'ep3', title: 'Episode 3', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
        ['ep4', { claim_id: 'ep4', title: 'Episode 4', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }]
      ]);

      const reloadedEpisodes = organizeEpisodesFromPlaylist(reloadedPlaylist, reloadedContentMap);

      // Verify that order is identical after reload
      expect(reloadedEpisodes).toHaveLength(firstLoadEpisodes.length);
      for (let i = 0; i < firstLoadEpisodes.length; i++) {
        expect(reloadedEpisodes[i].claim_id).toBe(firstLoadEpisodes[i].claim_id);
        expect(reloadedEpisodes[i].episode_number).toBe(firstLoadEpisodes[i].episode_number);
      }
    });

    it('should maintain order consistency when merging playlist and parsed data across reloads', () => {
      const playlists: Playlist[] = [
        {
          id: 'playlist1',
          title: 'Test Series',
          claim_id: 'playlist_claim',
          season_number: 1,
          series_key: 'test-series',
          items: [
            { claim_id: 'ep3', position: 0, episode_number: 3, season_number: 1 },
            { claim_id: 'ep1', position: 1, episode_number: 1, season_number: 1 }
          ]
        }
      ];

      const allContent: ContentItem[] = [
        { claim_id: 'ep1', title: 'Test Series S01E01 - Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } },
        { claim_id: 'ep2', title: 'Test Series S02E01 - Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } },
        { claim_id: 'ep3', title: 'Test Series S01E03 - Episode 3', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }
      ];

      // First load
      const firstLoadSeries = mergeSeriesData(playlists, allContent);
      const firstLoadSeriesInfo = firstLoadSeries.get('test-series');

      // Simulate reload with same data
      const reloadedSeries = mergeSeriesData(playlists, allContent);
      const reloadedSeriesInfo = reloadedSeries.get('test-series');

      // Verify structure is identical
      expect(reloadedSeriesInfo).toBeDefined();
      expect(reloadedSeriesInfo!.seasons).toHaveLength(firstLoadSeriesInfo!.seasons.length);

      // Verify season 1 (from playlist) maintains position order
      const firstLoadSeason1 = firstLoadSeriesInfo!.seasons[0];
      const reloadedSeason1 = reloadedSeriesInfo!.seasons[0];
      
      expect(reloadedSeason1.episodes).toHaveLength(firstLoadSeason1.episodes.length);
      expect(reloadedSeason1.episodes[0].claim_id).toBe('ep3'); // Position 0
      expect(reloadedSeason1.episodes[1].claim_id).toBe('ep1'); // Position 1
      expect(reloadedSeason1.inferred).toBe(false);

      // Verify season 2 (inferred) maintains parsed order
      const firstLoadSeason2 = firstLoadSeriesInfo!.seasons[1];
      const reloadedSeason2 = reloadedSeriesInfo!.seasons[1];
      
      expect(reloadedSeason2.episodes).toHaveLength(firstLoadSeason2.episodes.length);
      expect(reloadedSeason2.inferred).toBe(true);
    });
  });

  describe('Edge Cases for Ordering Preservation', () => {
    it('should handle gaps in position numbers correctly', () => {
      // Simulate a playlist with non-consecutive position numbers
      const playlist: Playlist = {
        id: 'playlist1',
        title: 'Series with Position Gaps',
        claim_id: 'playlist_claim',
        season_number: 1,
        items: [
          { claim_id: 'ep1', position: 0, episode_number: 1, season_number: 1 },
          { claim_id: 'ep2', position: 5, episode_number: 2, season_number: 1 }, // Gap in positions
          { claim_id: 'ep3', position: 10, episode_number: 3, season_number: 1 }
        ]
      };

      const contentMap = new Map<string, ContentItem>([
        ['ep1', { claim_id: 'ep1', title: 'Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
        ['ep2', { claim_id: 'ep2', title: 'Episode 2', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
        ['ep3', { claim_id: 'ep3', title: 'Episode 3', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }]
      ]);

      const episodes = organizeEpisodesFromPlaylist(playlist, contentMap);

      // Should still maintain position order despite gaps
      expect(episodes).toHaveLength(3);
      expect(episodes[0].claim_id).toBe('ep1'); // Position 0
      expect(episodes[1].claim_id).toBe('ep2'); // Position 5
      expect(episodes[2].claim_id).toBe('ep3'); // Position 10
    });

    it('should handle single episode playlists', () => {
      const playlist: Playlist = {
        id: 'playlist1',
        title: 'Single Episode',
        claim_id: 'playlist_claim',
        season_number: 1,
        items: [
          { claim_id: 'ep1', position: 0, episode_number: 1, season_number: 1 }
        ]
      };

      const contentMap = new Map<string, ContentItem>([
        ['ep1', { claim_id: 'ep1', title: 'Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }]
      ]);

      const episodes = organizeEpisodesFromPlaylist(playlist, contentMap);

      expect(episodes).toHaveLength(1);
      expect(episodes[0].claim_id).toBe('ep1');
    });

    it('should handle large playlists with many episodes', () => {
      // Create a playlist with 50 episodes in reverse episode number order
      const items = Array.from({ length: 50 }, (_, i) => ({
        claim_id: `ep${50 - i}`,
        position: i,
        episode_number: 50 - i,
        season_number: 1
      }));

      const playlist: Playlist = {
        id: 'playlist1',
        title: 'Large Series',
        claim_id: 'playlist_claim',
        season_number: 1,
        items
      };

      const contentMap = new Map<string, ContentItem>(
        Array.from({ length: 50 }, (_, i) => [
          `ep${i + 1}`,
          {
            claim_id: `ep${i + 1}`,
            title: `Episode ${i + 1}`,
            tags: ['series'],
            release_time: 0,
            video_urls: {},
            compatibility: { compatible: true, fallback_available: false }
          }
        ])
      );

      const episodes = organizeEpisodesFromPlaylist(playlist, contentMap);

      // Verify all episodes are in position order (reverse of episode number)
      expect(episodes).toHaveLength(50);
      for (let i = 0; i < 50; i++) {
        expect(episodes[i].claim_id).toBe(`ep${50 - i}`);
        expect(episodes[i].episode_number).toBe(50 - i);
      }
    });
  });

  describe('Documentation and Invariants', () => {
    it('should never reorder episodes by episode number when playlist data exists', () => {
      // This test documents the critical invariant: playlist position is ALWAYS canonical
      const playlist: Playlist = {
        id: 'playlist1',
        title: 'Canonical Order Test',
        claim_id: 'playlist_claim',
        season_number: 1,
        items: [
          { claim_id: 'ep10', position: 0, episode_number: 10, season_number: 1 },
          { claim_id: 'ep5', position: 1, episode_number: 5, season_number: 1 },
          { claim_id: 'ep1', position: 2, episode_number: 1, season_number: 1 },
          { claim_id: 'ep15', position: 3, episode_number: 15, season_number: 1 }
        ]
      };

      const contentMap = new Map<string, ContentItem>([
        ['ep1', { claim_id: 'ep1', title: 'Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
        ['ep5', { claim_id: 'ep5', title: 'Episode 5', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
        ['ep10', { claim_id: 'ep10', title: 'Episode 10', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
        ['ep15', { claim_id: 'ep15', title: 'Episode 15', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }]
      ]);

      const episodes = organizeEpisodesFromPlaylist(playlist, contentMap);

      // CRITICAL INVARIANT: Order must be 10, 5, 1, 15 (position order)
      // NOT 1, 5, 10, 15 (episode number order)
      expect(episodes.map(e => e.episode_number)).toEqual([10, 5, 1, 15]);
      expect(episodes.map(e => e.claim_id)).toEqual(['ep10', 'ep5', 'ep1', 'ep15']);
    });
  });
});
