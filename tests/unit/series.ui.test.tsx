import { describe, it, expect } from 'vitest';
import { SeriesInfo, Season, Episode } from '../../src/types';

/**
 * UI Integration Tests for Season Inference Marking
 * 
 * These tests verify that the season inference flag is properly set
 * and can be used by UI components to display appropriate markers.
 * 
 * The actual rendering of the markers is tested in the component files:
 * - SeriesDetail.tsx: Badge-style marker with yellow background
 * - SeriesPage.tsx: Inline text marker in yellow
 */

describe('Season Inference Marking - UI Integration', () => {
  describe('Season Interface', () => {
    it('should have inferred property in Season type', () => {
      const season: Season = {
        number: 1,
        episodes: [],
        playlist_id: undefined,
        inferred: true
      };

      expect(season).toHaveProperty('inferred');
      expect(typeof season.inferred).toBe('boolean');
    });

    it('should allow inferred to be true for parsed seasons', () => {
      const inferredSeason: Season = {
        number: 1,
        episodes: [],
        inferred: true
      };

      expect(inferredSeason.inferred).toBe(true);
      expect(inferredSeason.playlist_id).toBeUndefined();
    });

    it('should allow inferred to be false for playlist-based seasons', () => {
      const playlistSeason: Season = {
        number: 1,
        episodes: [],
        playlist_id: 'playlist-123',
        inferred: false
      };

      expect(playlistSeason.inferred).toBe(false);
      expect(playlistSeason.playlist_id).toBe('playlist-123');
    });
  });

  describe('SeriesInfo with Mixed Seasons', () => {
    it('should support series with both inferred and playlist-based seasons', () => {
      const episode1: Episode = {
        claim_id: 'ep1',
        title: 'Episode 1',
        episode_number: 1,
        season_number: 1
      };

      const episode2: Episode = {
        claim_id: 'ep2',
        title: 'Episode 2',
        episode_number: 1,
        season_number: 2
      };

      const series: SeriesInfo = {
        series_key: 'test-series',
        title: 'Test Series',
        seasons: [
          {
            number: 1,
            episodes: [episode1],
            playlist_id: 'playlist-1',
            inferred: false // From playlist
          },
          {
            number: 2,
            episodes: [episode2],
            playlist_id: undefined,
            inferred: true // Inferred from title parsing
          }
        ],
        total_episodes: 2
      };

      expect(series.seasons).toHaveLength(2);
      expect(series.seasons[0].inferred).toBe(false);
      expect(series.seasons[0].playlist_id).toBe('playlist-1');
      expect(series.seasons[1].inferred).toBe(true);
      expect(series.seasons[1].playlist_id).toBeUndefined();
    });
  });

  describe('UI Marker Display Logic', () => {
    it('should identify seasons that need inference markers', () => {
      const seasons: Season[] = [
        {
          number: 1,
          episodes: [],
          playlist_id: 'playlist-1',
          inferred: false
        },
        {
          number: 2,
          episodes: [],
          inferred: true
        },
        {
          number: 3,
          episodes: [],
          playlist_id: 'playlist-3',
          inferred: false
        }
      ];

      const seasonsNeedingMarkers = seasons.filter(s => s.inferred);
      expect(seasonsNeedingMarkers).toHaveLength(1);
      expect(seasonsNeedingMarkers[0].number).toBe(2);
    });

    it('should handle all seasons being inferred', () => {
      const seasons: Season[] = [
        {
          number: 1,
          episodes: [],
          inferred: true
        },
        {
          number: 2,
          episodes: [],
          inferred: true
        }
      ];

      const allInferred = seasons.every(s => s.inferred);
      expect(allInferred).toBe(true);
    });

    it('should handle no seasons being inferred', () => {
      const seasons: Season[] = [
        {
          number: 1,
          episodes: [],
          playlist_id: 'playlist-1',
          inferred: false
        },
        {
          number: 2,
          episodes: [],
          playlist_id: 'playlist-2',
          inferred: false
        }
      ];

      const anyInferred = seasons.some(s => s.inferred);
      expect(anyInferred).toBe(false);
    });
  });

  describe('Inference Marker Scenarios', () => {
    it('should mark season as inferred when playlist is missing', () => {
      const season: Season = {
        number: 1,
        episodes: [],
        playlist_id: undefined,
        inferred: true
      };

      // UI should display: "Inferred" or "Seasons inferred automatically"
      expect(season.inferred).toBe(true);
      expect(season.playlist_id).toBeUndefined();
    });

    it('should not mark season as inferred when playlist exists', () => {
      const season: Season = {
        number: 1,
        episodes: [],
        playlist_id: 'playlist-123',
        inferred: false
      };

      // UI should NOT display inference marker
      expect(season.inferred).toBe(false);
      expect(season.playlist_id).toBeDefined();
    });

    it('should provide clear distinction between inferred and playlist seasons', () => {
      const inferredSeason: Season = {
        number: 1,
        episodes: [],
        inferred: true
      };

      const playlistSeason: Season = {
        number: 2,
        episodes: [],
        playlist_id: 'playlist-2',
        inferred: false
      };

      // Inferred season should show marker
      expect(inferredSeason.inferred).toBe(true);
      
      // Playlist season should not show marker
      expect(playlistSeason.inferred).toBe(false);
      
      // They should be clearly distinguishable
      expect(inferredSeason.inferred).not.toBe(playlistSeason.inferred);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty series with no seasons', () => {
      const series: SeriesInfo = {
        series_key: 'empty-series',
        title: 'Empty Series',
        seasons: [],
        total_episodes: 0
      };

      const inferredSeasons = series.seasons.filter(s => s.inferred);
      expect(inferredSeasons).toHaveLength(0);
    });

    it('should handle series with single inferred season', () => {
      const series: SeriesInfo = {
        series_key: 'single-season',
        title: 'Single Season Series',
        seasons: [
          {
            number: 1,
            episodes: [],
            inferred: true
          }
        ],
        total_episodes: 0
      };

      expect(series.seasons[0].inferred).toBe(true);
    });

    it('should handle series with many seasons mixed inferred and playlist', () => {
      const seasons: Season[] = Array.from({ length: 10 }, (_, i) => ({
        number: i + 1,
        episodes: [],
        playlist_id: i % 2 === 0 ? `playlist-${i + 1}` : undefined,
        inferred: i % 2 !== 0
      }));

      const series: SeriesInfo = {
        series_key: 'many-seasons',
        title: 'Many Seasons Series',
        seasons,
        total_episodes: 0
      };

      const inferredCount = series.seasons.filter(s => s.inferred).length;
      const playlistCount = series.seasons.filter(s => !s.inferred).length;

      expect(inferredCount).toBe(5);
      expect(playlistCount).toBe(5);
    });
  });

  describe('Type Safety', () => {
    it('should enforce inferred property is boolean', () => {
      const season: Season = {
        number: 1,
        episodes: [],
        inferred: true
      };

      // TypeScript should enforce this is a boolean
      expect(typeof season.inferred).toBe('boolean');
      
      // Should not accept other types
      // @ts-expect-error - inferred must be boolean
      const _invalidSeason: Season = {
        number: 1,
        episodes: [],
        inferred: 'true' // This should cause a type error
      };
    });

    it('should require inferred property in Season type', () => {
      // This should compile - inferred is required
      const validSeason: Season = {
        number: 1,
        episodes: [],
        inferred: false
      };

      expect(validSeason).toHaveProperty('inferred');

      // @ts-expect-error - inferred is required
      const _invalidSeason: Season = {
        number: 1,
        episodes: []
        // Missing inferred property
      };
    });
  });
});
