import { describe, it, expect } from 'vitest';
import {
  parseEpisodeTitle,
  generateSeriesKey,
  contentToEpisode,
  organizeEpisodesFromPlaylist,
  organizeEpisodesByParsing,
  organizeSeriesFromPlaylists,
  getSeriesForClaim,
  mergeSeriesData,
  validateSeasonOrdering,
  sortEpisodes,
  getNextEpisode,
  getPreviousEpisode,
  isSeriesEpisode,
  groupSeriesContent,
  getSeriesRepresentative,
  seriesToContentItem
} from '../../src/lib/series';
import { ContentItem, Playlist, Episode, Season, SeriesInfo } from '../../src/types';

describe('parseEpisodeTitle', () => {
  describe('Standard SxxExx format', () => {
    it('should parse standard format S01E01 with dash', () => {
      const result = parseEpisodeTitle('Breaking Bad S01E01 - Pilot');
      expect(result).toEqual({
        series_name: 'Breaking Bad',
        season_number: 1,
        episode_number: 1,
        episode_title: 'Pilot'
      });
    });

    it('should parse format with single digit season and episode', () => {
      const result = parseEpisodeTitle('The Office S1E5 - Basketball');
      expect(result).toEqual({
        series_name: 'The Office',
        season_number: 1,
        episode_number: 5,
        episode_title: 'Basketball'
      });
    });

    it('should parse format with double digit season', () => {
      const result = parseEpisodeTitle('Friends S10E18 - The Last One');
      expect(result).toEqual({
        series_name: 'Friends',
        season_number: 10,
        episode_number: 18,
        episode_title: 'The Last One'
      });
    });

    it('should parse format with triple digit episode', () => {
      const result = parseEpisodeTitle('One Piece S01E100 - The Legend Begins');
      expect(result).toEqual({
        series_name: 'One Piece',
        season_number: 1,
        episode_number: 100,
        episode_title: 'The Legend Begins'
      });
    });

    it('should handle series names with special characters', () => {
      const result = parseEpisodeTitle("Grey's Anatomy S05E10 - All By Myself");
      expect(result).toEqual({
        series_name: "Grey's Anatomy",
        season_number: 5,
        episode_number: 10,
        episode_title: 'All By Myself'
      });
    });

    it('should handle episode titles with hyphens', () => {
      const result = parseEpisodeTitle('Doctor Who S01E01 - Rose - Part 1');
      expect(result).toEqual({
        series_name: 'Doctor Who',
        season_number: 1,
        episode_number: 1,
        episode_title: 'Rose - Part 1'
      });
    });

    it('should handle extra whitespace', () => {
      const result = parseEpisodeTitle('  Breaking Bad   S01E01   -   Pilot  ');
      expect(result).toEqual({
        series_name: 'Breaking Bad',
        season_number: 1,
        episode_number: 1,
        episode_title: 'Pilot'
      });
    });

    it('should be case insensitive for S and E', () => {
      const result = parseEpisodeTitle('Breaking Bad s01e01 - Pilot');
      expect(result).toEqual({
        series_name: 'Breaking Bad',
        season_number: 1,
        episode_number: 1,
        episode_title: 'Pilot'
      });
    });

    it('should parse format without dash separator', () => {
      const result = parseEpisodeTitle('Breaking Bad S01E01 Pilot');
      expect(result).toEqual({
        series_name: 'Breaking Bad',
        season_number: 1,
        episode_number: 1,
        episode_title: 'Pilot'
      });
    });

    it('should handle en-dash separator', () => {
      const result = parseEpisodeTitle('Breaking Bad S01E01 – Pilot');
      expect(result).toEqual({
        series_name: 'Breaking Bad',
        season_number: 1,
        episode_number: 1,
        episode_title: 'Pilot'
      });
    });

    it('should handle empty episode title', () => {
      const result = parseEpisodeTitle('Breaking Bad S01E01');
      expect(result).toEqual({
        series_name: 'Breaking Bad',
        season_number: 1,
        episode_number: 1,
        episode_title: ''
      });
    });
  });

  describe('Alternative 1x01 format', () => {
    it('should parse 1x01 format with dash', () => {
      const result = parseEpisodeTitle('Breaking Bad 1x01 - Pilot');
      expect(result).toEqual({
        series_name: 'Breaking Bad',
        season_number: 1,
        episode_number: 1,
        episode_title: 'Pilot'
      });
    });

    it('should parse 1x01 format without dash', () => {
      const result = parseEpisodeTitle('Breaking Bad 1x01 Pilot');
      expect(result).toEqual({
        series_name: 'Breaking Bad',
        season_number: 1,
        episode_number: 1,
        episode_title: 'Pilot'
      });
    });

    it('should parse 10x18 format with double digits', () => {
      const result = parseEpisodeTitle('Friends 10x18 - The Last One');
      expect(result).toEqual({
        series_name: 'Friends',
        season_number: 10,
        episode_number: 18,
        episode_title: 'The Last One'
      });
    });

    it('should handle uppercase X', () => {
      const result = parseEpisodeTitle('Breaking Bad 1X01 - Pilot');
      expect(result).toEqual({
        series_name: 'Breaking Bad',
        season_number: 1,
        episode_number: 1,
        episode_title: 'Pilot'
      });
    });

    it('should parse 1x100 format with triple digit episode', () => {
      const result = parseEpisodeTitle('One Piece 1x100 - The Legend Begins');
      expect(result).toEqual({
        series_name: 'One Piece',
        season_number: 1,
        episode_number: 100,
        episode_title: 'The Legend Begins'
      });
    });

    it('should handle empty episode title in 1x01 format', () => {
      const result = parseEpisodeTitle('Breaking Bad 1x01');
      expect(result).toEqual({
        series_name: 'Breaking Bad',
        season_number: 1,
        episode_number: 1,
        episode_title: ''
      });
    });
  });

  describe('Verbose Season X Episode Y format', () => {
    it('should parse verbose format with dash', () => {
      const result = parseEpisodeTitle('Breaking Bad Season 1 Episode 1 - Pilot');
      expect(result).toEqual({
        series_name: 'Breaking Bad',
        season_number: 1,
        episode_number: 1,
        episode_title: 'Pilot'
      });
    });

    it('should parse verbose format without dash', () => {
      const result = parseEpisodeTitle('Breaking Bad Season 1 Episode 1 Pilot');
      expect(result).toEqual({
        series_name: 'Breaking Bad',
        season_number: 1,
        episode_number: 1,
        episode_title: 'Pilot'
      });
    });

    it('should parse verbose format with double digit season', () => {
      const result = parseEpisodeTitle('Friends Season 10 Episode 18 - The Last One');
      expect(result).toEqual({
        series_name: 'Friends',
        season_number: 10,
        episode_number: 18,
        episode_title: 'The Last One'
      });
    });

    it('should be case insensitive for Season and Episode', () => {
      const result = parseEpisodeTitle('Breaking Bad season 1 episode 1 - Pilot');
      expect(result).toEqual({
        series_name: 'Breaking Bad',
        season_number: 1,
        episode_number: 1,
        episode_title: 'Pilot'
      });
    });

    it('should handle empty episode title in verbose format', () => {
      const result = parseEpisodeTitle('Breaking Bad Season 1 Episode 1');
      expect(result).toEqual({
        series_name: 'Breaking Bad',
        season_number: 1,
        episode_number: 1,
        episode_title: ''
      });
    });
  });

  describe('Edge cases and invalid formats', () => {
    it('should return null for non-matching format', () => {
      expect(parseEpisodeTitle('Just a Movie Title')).toBeNull();
      expect(parseEpisodeTitle('Season 1 Episode 1')).toBeNull();
      expect(parseEpisodeTitle('S01E01')).toBeNull();
      expect(parseEpisodeTitle('')).toBeNull();
    });

    it('should handle series names with numbers', () => {
      const result = parseEpisodeTitle('24 S01E01 - 12:00 AM');
      expect(result).toEqual({
        series_name: '24',
        season_number: 1,
        episode_number: 1,
        episode_title: '12:00 AM'
      });
    });

    it('should handle series names with multiple words', () => {
      const result = parseEpisodeTitle('Game of Thrones S01E01 - Winter Is Coming');
      expect(result).toEqual({
        series_name: 'Game of Thrones',
        season_number: 1,
        episode_number: 1,
        episode_title: 'Winter Is Coming'
      });
    });

    it('should handle series names with colons', () => {
      const result = parseEpisodeTitle('Star Trek: The Next Generation S01E01 - Encounter at Farpoint');
      expect(result).toEqual({
        series_name: 'Star Trek: The Next Generation',
        season_number: 1,
        episode_number: 1,
        episode_title: 'Encounter at Farpoint'
      });
    });

    it('should not match partial patterns', () => {
      expect(parseEpisodeTitle('This has S01 but not E01')).toBeNull();
      expect(parseEpisodeTitle('This has E01 but not S01')).toBeNull();
      expect(parseEpisodeTitle('1x without episode number')).toBeNull();
    });

    it('should handle mixed format attempts gracefully', () => {
      // These should not match as they are malformed
      expect(parseEpisodeTitle('Breaking Bad S01x01 - Pilot')).toBeNull();
      expect(parseEpisodeTitle('Breaking Bad 1E01 - Pilot')).toBeNull();
    });
  });

  describe('Real-world examples', () => {
    it('should parse various real-world title formats', () => {
      const examples = [
        {
          input: 'The Mandalorian S02E08 - The Rescue',
          expected: { series_name: 'The Mandalorian', season_number: 2, episode_number: 8, episode_title: 'The Rescue' }
        },
        {
          input: 'Stranger Things 4x09 - The Piggyback',
          expected: { series_name: 'Stranger Things', season_number: 4, episode_number: 9, episode_title: 'The Piggyback' }
        },
        {
          input: 'The Crown Season 5 Episode 10 - Decommissioned',
          expected: { series_name: 'The Crown', season_number: 5, episode_number: 10, episode_title: 'Decommissioned' }
        },
        {
          input: 'Better Call Saul S6E13 Saul Gone',
          expected: { series_name: 'Better Call Saul', season_number: 6, episode_number: 13, episode_title: 'Saul Gone' }
        },
        {
          input: 'The Last of Us 1x09 Look for the Light',
          expected: { series_name: 'The Last of Us', season_number: 1, episode_number: 9, episode_title: 'Look for the Light' }
        }
      ];

      for (const example of examples) {
        const result = parseEpisodeTitle(example.input);
        expect(result).toEqual(example.expected);
      }
    });
  });
});

describe('generateSeriesKey', () => {
  it('should generate lowercase hyphenated key', () => {
    expect(generateSeriesKey('Breaking Bad')).toBe('breaking-bad');
    expect(generateSeriesKey('The Office')).toBe('the-office');
  });

  it('should remove special characters', () => {
    expect(generateSeriesKey("Grey's Anatomy")).toBe('greys-anatomy');
    expect(generateSeriesKey('Marvel\'s Agents of S.H.I.E.L.D.')).toBe('marvels-agents-of-shield');
  });

  it('should handle multiple spaces', () => {
    expect(generateSeriesKey('Breaking   Bad')).toBe('breaking-bad');
  });

  it('should handle leading/trailing spaces', () => {
    expect(generateSeriesKey('  Breaking Bad  ')).toBe('breaking-bad');
  });

  it('should handle numbers', () => {
    expect(generateSeriesKey('24')).toBe('24');
    expect(generateSeriesKey('The 100')).toBe('the-100');
  });
});

describe('contentToEpisode', () => {
  it('should convert ContentItem to Episode', () => {
    const content: ContentItem = {
      claim_id: 'abc123',
      title: 'Breaking Bad S01E01 - Pilot',
      tags: ['series'],
      thumbnail_url: 'https://example.com/thumb.jpg',
      duration: 3000,
      release_time: 1234567890,
      video_urls: {},
      compatibility: { compatible: true, fallback_available: false }
    };

    const episode = contentToEpisode(content, 1, 1);

    expect(episode).toEqual({
      claim_id: 'abc123',
      title: 'Breaking Bad S01E01 - Pilot',
      episode_number: 1,
      season_number: 1,
      thumbnail_url: 'https://example.com/thumb.jpg',
      duration: 3000
    });
  });

  it('should handle missing optional fields', () => {
    const content: ContentItem = {
      claim_id: 'abc123',
      title: 'Episode Title',
      tags: ['series'],
      release_time: 1234567890,
      video_urls: {},
      compatibility: { compatible: true, fallback_available: false }
    };

    const episode = contentToEpisode(content, 1, 1);

    expect(episode.thumbnail_url).toBeUndefined();
    expect(episode.duration).toBeUndefined();
  });
});

describe('organizeEpisodesFromPlaylist', () => {
  it('should organize episodes in playlist order', () => {
    const playlist: Playlist = {
      id: 'playlist1',
      title: 'Breaking Bad Season 1',
      claim_id: 'playlist_claim',
      season_number: 1,
      items: [
        { claim_id: 'ep1', position: 0, episode_number: 1, season_number: 1 },
        { claim_id: 'ep2', position: 1, episode_number: 2, season_number: 1 },
        { claim_id: 'ep3', position: 2, episode_number: 3, season_number: 1 }
      ]
    };

    const contentMap = new Map<string, ContentItem>([
      ['ep1', { claim_id: 'ep1', title: 'Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
      ['ep2', { claim_id: 'ep2', title: 'Episode 2', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
      ['ep3', { claim_id: 'ep3', title: 'Episode 3', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }]
    ]);

    const episodes = organizeEpisodesFromPlaylist(playlist, contentMap);

    expect(episodes).toHaveLength(3);
    expect(episodes[0].claim_id).toBe('ep1');
    expect(episodes[1].claim_id).toBe('ep2');
    expect(episodes[2].claim_id).toBe('ep3');
  });

  it('should preserve playlist order even if positions are out of order', () => {
    const playlist: Playlist = {
      id: 'playlist1',
      title: 'Season 1',
      claim_id: 'playlist_claim',
      items: [
        { claim_id: 'ep2', position: 1, episode_number: 2 },
        { claim_id: 'ep1', position: 0, episode_number: 1 },
        { claim_id: 'ep3', position: 2, episode_number: 3 }
      ]
    };

    const contentMap = new Map<string, ContentItem>([
      ['ep1', { claim_id: 'ep1', title: 'Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
      ['ep2', { claim_id: 'ep2', title: 'Episode 2', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
      ['ep3', { claim_id: 'ep3', title: 'Episode 3', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }]
    ]);

    const episodes = organizeEpisodesFromPlaylist(playlist, contentMap);

    expect(episodes[0].claim_id).toBe('ep1'); // Position 0
    expect(episodes[1].claim_id).toBe('ep2'); // Position 1
    expect(episodes[2].claim_id).toBe('ep3'); // Position 2
  });

  it('should fallback to parsing title when episode number missing', () => {
    const playlist: Playlist = {
      id: 'playlist1',
      title: 'Breaking Bad Season 1',
      claim_id: 'playlist_claim',
      season_number: 1,
      items: [
        { claim_id: 'ep1', position: 0 }
      ]
    };

    const contentMap = new Map<string, ContentItem>([
      ['ep1', { claim_id: 'ep1', title: 'Breaking Bad S01E05 - Gray Matter', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }]
    ]);

    const episodes = organizeEpisodesFromPlaylist(playlist, contentMap);

    expect(episodes[0].episode_number).toBe(5);
    expect(episodes[0].season_number).toBe(1);
  });

  it('should use position as episode number when parsing fails', () => {
    const playlist: Playlist = {
      id: 'playlist1',
      title: 'Season 1',
      claim_id: 'playlist_claim',
      items: [
        { claim_id: 'ep1', position: 0 },
        { claim_id: 'ep2', position: 1 }
      ]
    };

    const contentMap = new Map<string, ContentItem>([
      ['ep1', { claim_id: 'ep1', title: 'Just a Title', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
      ['ep2', { claim_id: 'ep2', title: 'Another Title', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }]
    ]);

    const episodes = organizeEpisodesFromPlaylist(playlist, contentMap);

    expect(episodes[0].episode_number).toBe(1); // position 0 + 1
    expect(episodes[1].episode_number).toBe(2); // position 1 + 1
  });

  it('should skip items not in content map', () => {
    const playlist: Playlist = {
      id: 'playlist1',
      title: 'Season 1',
      claim_id: 'playlist_claim',
      items: [
        { claim_id: 'ep1', position: 0, episode_number: 1 },
        { claim_id: 'missing', position: 1, episode_number: 2 },
        { claim_id: 'ep3', position: 2, episode_number: 3 }
      ]
    };

    const contentMap = new Map<string, ContentItem>([
      ['ep1', { claim_id: 'ep1', title: 'Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
      ['ep3', { claim_id: 'ep3', title: 'Episode 3', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }]
    ]);

    const episodes = organizeEpisodesFromPlaylist(playlist, contentMap);

    expect(episodes).toHaveLength(2);
    expect(episodes[0].claim_id).toBe('ep1');
    expect(episodes[1].claim_id).toBe('ep3');
  });

  it('should treat playlist order as canonical regardless of episode numbers', () => {
    // Test that playlist position is authoritative, even if episode numbers suggest different order
    const playlist: Playlist = {
      id: 'playlist1',
      title: 'Season 1',
      claim_id: 'playlist_claim',
      season_number: 1,
      items: [
        { claim_id: 'ep3', position: 0, episode_number: 3 }, // Episode 3 is first in playlist
        { claim_id: 'ep1', position: 1, episode_number: 1 }, // Episode 1 is second
        { claim_id: 'ep2', position: 2, episode_number: 2 }  // Episode 2 is third
      ]
    };

    const contentMap = new Map<string, ContentItem>([
      ['ep1', { claim_id: 'ep1', title: 'Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
      ['ep2', { claim_id: 'ep2', title: 'Episode 2', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
      ['ep3', { claim_id: 'ep3', title: 'Episode 3', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }]
    ]);

    const episodes = organizeEpisodesFromPlaylist(playlist, contentMap);

    // Verify playlist order is preserved (position 0, 1, 2)
    expect(episodes).toHaveLength(3);
    expect(episodes[0].claim_id).toBe('ep3'); // Position 0
    expect(episodes[1].claim_id).toBe('ep1'); // Position 1
    expect(episodes[2].claim_id).toBe('ep2'); // Position 2
    
    // Episode numbers are preserved from playlist metadata
    expect(episodes[0].episode_number).toBe(3);
    expect(episodes[1].episode_number).toBe(1);
    expect(episodes[2].episode_number).toBe(2);
  });
});

describe('organizeEpisodesByParsing', () => {
  it('should organize episodes by series and season', () => {
    const content: ContentItem[] = [
      { claim_id: 'ep1', title: 'Breaking Bad S01E01 - Pilot', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } },
      { claim_id: 'ep2', title: 'Breaking Bad S01E02 - Cat\'s in the Bag', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } },
      { claim_id: 'ep3', title: 'Breaking Bad S02E01 - Seven Thirty-Seven', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }
    ];

    const seriesMap = organizeEpisodesByParsing(content);

    expect(seriesMap.size).toBe(1);
    const series = seriesMap.get('breaking-bad');
    expect(series).toBeDefined();
    expect(series!.seasons).toHaveLength(2);
    expect(series!.seasons[0].number).toBe(1);
    expect(series!.seasons[0].episodes).toHaveLength(2);
    expect(series!.seasons[1].number).toBe(2);
    expect(series!.seasons[1].episodes).toHaveLength(1);
  });

  it('should mark all seasons as inferred', () => {
    const content: ContentItem[] = [
      { claim_id: 'ep1', title: 'Breaking Bad S01E01 - Pilot', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }
    ];

    const seriesMap = organizeEpisodesByParsing(content);
    const series = seriesMap.get('breaking-bad');

    expect(series!.seasons[0].inferred).toBe(true);
    expect(series!.seasons[0].playlist_id).toBeUndefined();
  });

  it('should sort episodes by episode number within seasons', () => {
    const content: ContentItem[] = [
      { claim_id: 'ep3', title: 'Breaking Bad S01E03 - Episode 3', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } },
      { claim_id: 'ep1', title: 'Breaking Bad S01E01 - Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } },
      { claim_id: 'ep2', title: 'Breaking Bad S01E02 - Episode 2', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }
    ];

    const seriesMap = organizeEpisodesByParsing(content);
    const series = seriesMap.get('breaking-bad');
    const episodes = series!.seasons[0].episodes;

    expect(episodes[0].episode_number).toBe(1);
    expect(episodes[1].episode_number).toBe(2);
    expect(episodes[2].episode_number).toBe(3);
  });

  it('should handle multiple series', () => {
    const content: ContentItem[] = [
      { claim_id: 'bb1', title: 'Breaking Bad S01E01 - Pilot', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } },
      { claim_id: 'to1', title: 'The Office S01E01 - Pilot', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }
    ];

    const seriesMap = organizeEpisodesByParsing(content);

    expect(seriesMap.size).toBe(2);
    expect(seriesMap.has('breaking-bad')).toBe(true);
    expect(seriesMap.has('the-office')).toBe(true);
  });

  it('should skip content that does not match episode format', () => {
    const content: ContentItem[] = [
      { claim_id: 'ep1', title: 'Breaking Bad S01E01 - Pilot', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } },
      { claim_id: 'movie', title: 'Just a Movie', tags: ['movie'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }
    ];

    const seriesMap = organizeEpisodesByParsing(content);

    expect(seriesMap.size).toBe(1);
    expect(seriesMap.has('breaking-bad')).toBe(true);
  });

  it('should calculate total episodes correctly', () => {
    const content: ContentItem[] = [
      { claim_id: 'ep1', title: 'Breaking Bad S01E01 - Pilot', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } },
      { claim_id: 'ep2', title: 'Breaking Bad S01E02 - Episode 2', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } },
      { claim_id: 'ep3', title: 'Breaking Bad S02E01 - Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }
    ];

    const seriesMap = organizeEpisodesByParsing(content);
    const series = seriesMap.get('breaking-bad');

    expect(series!.total_episodes).toBe(3);
  });
});

describe('organizeSeriesFromPlaylists', () => {
  it('should organize series from playlists with canonical ordering', () => {
    const playlists: Playlist[] = [
      {
        id: 'playlist1',
        title: 'Breaking Bad',
        claim_id: 'playlist_claim1',
        season_number: 1,
        series_key: 'breaking-bad',
        items: [
          { claim_id: 'ep1', position: 0, episode_number: 1, season_number: 1 },
          { claim_id: 'ep2', position: 1, episode_number: 2, season_number: 1 }
        ]
      },
      {
        id: 'playlist2',
        title: 'Breaking Bad',
        claim_id: 'playlist_claim2',
        season_number: 2,
        series_key: 'breaking-bad',
        items: [
          { claim_id: 'ep3', position: 0, episode_number: 1, season_number: 2 }
        ]
      }
    ];

    const contentMap = new Map<string, ContentItem>([
      ['ep1', { claim_id: 'ep1', title: 'Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
      ['ep2', { claim_id: 'ep2', title: 'Episode 2', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
      ['ep3', { claim_id: 'ep3', title: 'Episode 3', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }]
    ]);

    const seriesMap = organizeSeriesFromPlaylists(playlists, contentMap);

    expect(seriesMap.size).toBe(1);
    const series = seriesMap.get('breaking-bad');
    expect(series).toBeDefined();
    expect(series!.seasons).toHaveLength(2);
    expect(series!.seasons[0].number).toBe(1);
    expect(series!.seasons[0].episodes).toHaveLength(2);
    expect(series!.seasons[0].inferred).toBe(false);
    expect(series!.seasons[0].playlist_id).toBe('playlist1');
    expect(series!.seasons[1].number).toBe(2);
    expect(series!.seasons[1].episodes).toHaveLength(1);
    expect(series!.total_episodes).toBe(3);
  });

  it('should preserve playlist order as canonical within each season', () => {
    const playlists: Playlist[] = [
      {
        id: 'playlist1',
        title: 'Test Series',
        claim_id: 'playlist_claim',
        season_number: 1,
        series_key: 'test-series',
        items: [
          { claim_id: 'ep5', position: 0, episode_number: 5 }, // Unusual order
          { claim_id: 'ep1', position: 1, episode_number: 1 },
          { claim_id: 'ep3', position: 2, episode_number: 3 }
        ]
      }
    ];

    const contentMap = new Map<string, ContentItem>([
      ['ep1', { claim_id: 'ep1', title: 'Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
      ['ep3', { claim_id: 'ep3', title: 'Episode 3', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
      ['ep5', { claim_id: 'ep5', title: 'Episode 5', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }]
    ]);

    const seriesMap = organizeSeriesFromPlaylists(playlists, contentMap);
    const series = seriesMap.get('test-series');
    const episodes = series!.seasons[0].episodes;

    // Verify playlist position order is preserved (not episode number order)
    expect(episodes[0].claim_id).toBe('ep5'); // Position 0
    expect(episodes[1].claim_id).toBe('ep1'); // Position 1
    expect(episodes[2].claim_id).toBe('ep3'); // Position 2
  });

  it('should handle multiple series from different playlists', () => {
    const playlists: Playlist[] = [
      {
        id: 'playlist1',
        title: 'Breaking Bad',
        claim_id: 'playlist_claim1',
        season_number: 1,
        series_key: 'breaking-bad',
        items: [
          { claim_id: 'bb1', position: 0, episode_number: 1, season_number: 1 }
        ]
      },
      {
        id: 'playlist2',
        title: 'The Office',
        claim_id: 'playlist_claim2',
        season_number: 1,
        series_key: 'the-office',
        items: [
          { claim_id: 'to1', position: 0, episode_number: 1, season_number: 1 }
        ]
      }
    ];

    const contentMap = new Map<string, ContentItem>([
      ['bb1', { claim_id: 'bb1', title: 'BB Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }],
      ['to1', { claim_id: 'to1', title: 'TO Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }]
    ]);

    const seriesMap = organizeSeriesFromPlaylists(playlists, contentMap);

    expect(seriesMap.size).toBe(2);
    expect(seriesMap.has('breaking-bad')).toBe(true);
    expect(seriesMap.has('the-office')).toBe(true);
  });
});

describe('validateSeasonOrdering', () => {
  it('should validate correct ordering', () => {
    const season: Season = {
      number: 1,
      episodes: [
        { claim_id: 'ep1', title: 'Ep 1', episode_number: 1, season_number: 1 },
        { claim_id: 'ep2', title: 'Ep 2', episode_number: 2, season_number: 1 },
        { claim_id: 'ep3', title: 'Ep 3', episode_number: 3, season_number: 1 }
      ],
      inferred: false
    };

    const result = validateSeasonOrdering(season);

    expect(result.valid).toBe(true);
    expect(result.duplicates).toHaveLength(0);
    expect(result.gaps).toHaveLength(0);
  });

  it('should detect duplicate episode numbers', () => {
    const season: Season = {
      number: 1,
      episodes: [
        { claim_id: 'ep1', title: 'Ep 1', episode_number: 1, season_number: 1 },
        { claim_id: 'ep2', title: 'Ep 2', episode_number: 2, season_number: 1 },
        { claim_id: 'ep3', title: 'Ep 3', episode_number: 2, season_number: 1 }
      ],
      inferred: false
    };

    const result = validateSeasonOrdering(season);

    expect(result.valid).toBe(false);
    expect(result.duplicates).toContain(2);
  });

  it('should detect gaps in episode sequence', () => {
    const season: Season = {
      number: 1,
      episodes: [
        { claim_id: 'ep1', title: 'Ep 1', episode_number: 1, season_number: 1 },
        { claim_id: 'ep3', title: 'Ep 3', episode_number: 3, season_number: 1 },
        { claim_id: 'ep5', title: 'Ep 5', episode_number: 5, season_number: 1 }
      ],
      inferred: false
    };

    const result = validateSeasonOrdering(season);

    expect(result.valid).toBe(false);
    expect(result.gaps).toContain(2);
    expect(result.gaps).toContain(4);
  });
});

describe('sortEpisodes', () => {
  it('should sort episodes by episode number', () => {
    const episodes: Episode[] = [
      { claim_id: 'ep3', title: 'Ep 3', episode_number: 3, season_number: 1 },
      { claim_id: 'ep1', title: 'Ep 1', episode_number: 1, season_number: 1 },
      { claim_id: 'ep2', title: 'Ep 2', episode_number: 2, season_number: 1 }
    ];

    const sorted = sortEpisodes(episodes);

    expect(sorted[0].episode_number).toBe(1);
    expect(sorted[1].episode_number).toBe(2);
    expect(sorted[2].episode_number).toBe(3);
  });

  it('should not mutate original array', () => {
    const episodes: Episode[] = [
      { claim_id: 'ep3', title: 'Ep 3', episode_number: 3, season_number: 1 },
      { claim_id: 'ep1', title: 'Ep 1', episode_number: 1, season_number: 1 }
    ];

    const sorted = sortEpisodes(episodes);

    expect(episodes[0].episode_number).toBe(3);
    expect(sorted[0].episode_number).toBe(1);
  });
});

describe('getNextEpisode', () => {
  const series = {
    series_key: 'test-series',
    title: 'Test Series',
    total_episodes: 5,
    seasons: [
      {
        number: 1,
        episodes: [
          { claim_id: 'ep1', title: 'Ep 1', episode_number: 1, season_number: 1 },
          { claim_id: 'ep2', title: 'Ep 2', episode_number: 2, season_number: 1 }
        ],
        inferred: false
      },
      {
        number: 2,
        episodes: [
          { claim_id: 'ep3', title: 'Ep 3', episode_number: 1, season_number: 2 },
          { claim_id: 'ep4', title: 'Ep 4', episode_number: 2, season_number: 2 }
        ],
        inferred: false
      }
    ]
  };

  it('should return next episode in same season', () => {
    const current = series.seasons[0].episodes[0];
    const next = getNextEpisode(current, series);

    expect(next?.claim_id).toBe('ep2');
  });

  it('should return first episode of next season', () => {
    const current = series.seasons[0].episodes[1];
    const next = getNextEpisode(current, series);

    expect(next?.claim_id).toBe('ep3');
  });

  it('should return null at end of series', () => {
    const current = series.seasons[1].episodes[1];
    const next = getNextEpisode(current, series);

    expect(next).toBeNull();
  });
});

describe('getPreviousEpisode', () => {
  const series = {
    series_key: 'test-series',
    title: 'Test Series',
    total_episodes: 4,
    seasons: [
      {
        number: 1,
        episodes: [
          { claim_id: 'ep1', title: 'Ep 1', episode_number: 1, season_number: 1 },
          { claim_id: 'ep2', title: 'Ep 2', episode_number: 2, season_number: 1 }
        ],
        inferred: false
      },
      {
        number: 2,
        episodes: [
          { claim_id: 'ep3', title: 'Ep 3', episode_number: 1, season_number: 2 },
          { claim_id: 'ep4', title: 'Ep 4', episode_number: 2, season_number: 2 }
        ],
        inferred: false
      }
    ]
  };

  it('should return previous episode in same season', () => {
    const current = series.seasons[0].episodes[1];
    const prev = getPreviousEpisode(current, series);

    expect(prev?.claim_id).toBe('ep1');
  });

  it('should return last episode of previous season', () => {
    const current = series.seasons[1].episodes[0];
    const prev = getPreviousEpisode(current, series);

    expect(prev?.claim_id).toBe('ep2');
  });

  it('should return null at beginning of series', () => {
    const current = series.seasons[0].episodes[0];
    const prev = getPreviousEpisode(current, series);

    expect(prev).toBeNull();
  });
});

describe('mergeSeriesData', () => {
  it('should merge playlist-based and parsed series data', () => {
    const playlists: Playlist[] = [
      {
        id: 'playlist1',
        title: 'Breaking Bad',
        claim_id: 'playlist_claim1',
        season_number: 1,
        series_key: 'breaking-bad',
        items: [
          { claim_id: 'ep1', position: 0, episode_number: 1, season_number: 1 },
          { claim_id: 'ep2', position: 1, episode_number: 2, season_number: 1 }
        ]
      }
    ];

    const allContent: ContentItem[] = [
      { claim_id: 'ep1', title: 'Breaking Bad S01E01 - Pilot', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } },
      { claim_id: 'ep2', title: 'Breaking Bad S01E02 - Episode 2', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } },
      { claim_id: 'ep3', title: 'Breaking Bad S02E01 - Season 2 Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }
    ];

    const seriesMap = mergeSeriesData(playlists, allContent);

    expect(seriesMap.size).toBe(1);
    const series = seriesMap.get('breaking-bad');
    expect(series).toBeDefined();
    expect(series!.seasons).toHaveLength(2);
    
    // Season 1 should be from playlist (not inferred)
    expect(series!.seasons[0].number).toBe(1);
    expect(series!.seasons[0].inferred).toBe(false);
    expect(series!.seasons[0].playlist_id).toBe('playlist1');
    expect(series!.seasons[0].episodes).toHaveLength(2);
    
    // Season 2 should be inferred from parsing (not in playlist)
    expect(series!.seasons[1].number).toBe(2);
    expect(series!.seasons[1].inferred).toBe(true);
    expect(series!.seasons[1].playlist_id).toBeUndefined();
    expect(series!.seasons[1].episodes).toHaveLength(1);
    
    expect(series!.total_episodes).toBe(3);
  });

  it('should prefer playlist data over parsed data for same season', () => {
    const playlists: Playlist[] = [
      {
        id: 'playlist1',
        title: 'Test Series',
        claim_id: 'playlist_claim1',
        season_number: 1,
        series_key: 'test-series',
        items: [
          { claim_id: 'ep1', position: 0, episode_number: 1, season_number: 1 },
          { claim_id: 'ep2', position: 1, episode_number: 2, season_number: 1 }
        ]
      }
    ];

    const allContent: ContentItem[] = [
      { claim_id: 'ep1', title: 'Test Series S01E01 - Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } },
      { claim_id: 'ep2', title: 'Test Series S01E02 - Episode 2', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } },
      { claim_id: 'ep3', title: 'Test Series S01E03 - Episode 3', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }
    ];

    const seriesMap = mergeSeriesData(playlists, allContent);
    const series = seriesMap.get('test-series');

    // Should only have season 1 from playlist, not the parsed episode 3
    expect(series!.seasons).toHaveLength(1);
    expect(series!.seasons[0].inferred).toBe(false);
    expect(series!.seasons[0].episodes).toHaveLength(2);
    // Episode 3 is not in playlist, so it's excluded
  });

  it('should handle content not in any playlist', () => {
    const playlists: Playlist[] = [];

    const allContent: ContentItem[] = [
      { claim_id: 'ep1', title: 'Orphan Series S01E01 - Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } },
      { claim_id: 'ep2', title: 'Orphan Series S01E02 - Episode 2', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }
    ];

    const seriesMap = mergeSeriesData(playlists, allContent);

    expect(seriesMap.size).toBe(1);
    const series = seriesMap.get('orphan-series');
    expect(series).toBeDefined();
    expect(series!.seasons).toHaveLength(1);
    expect(series!.seasons[0].inferred).toBe(true);
    expect(series!.seasons[0].playlist_id).toBeUndefined();
  });

  it('should handle multiple series with mixed playlist and parsed data', () => {
    const playlists: Playlist[] = [
      {
        id: 'playlist1',
        title: 'Series A',
        claim_id: 'playlist_claim1',
        season_number: 1,
        series_key: 'series-a',
        items: [
          { claim_id: 'a1', position: 0, episode_number: 1, season_number: 1 }
        ]
      }
    ];

    const allContent: ContentItem[] = [
      { claim_id: 'a1', title: 'Series A S01E01 - Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } },
      { claim_id: 'a2', title: 'Series A S02E01 - Season 2 Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } },
      { claim_id: 'b1', title: 'Series B S01E01 - Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }
    ];

    const seriesMap = mergeSeriesData(playlists, allContent);

    expect(seriesMap.size).toBe(2);
    
    // Series A: has playlist season 1 and inferred season 2
    const seriesA = seriesMap.get('series-a');
    expect(seriesA!.seasons).toHaveLength(2);
    expect(seriesA!.seasons[0].inferred).toBe(false);
    expect(seriesA!.seasons[1].inferred).toBe(true);
    
    // Series B: all inferred (no playlist)
    const seriesB = seriesMap.get('series-b');
    expect(seriesB!.seasons).toHaveLength(1);
    expect(seriesB!.seasons[0].inferred).toBe(true);
  });

  it('should correctly mark inferred seasons when merging', () => {
    const playlists: Playlist[] = [
      {
        id: 'playlist1',
        title: 'Test Series',
        claim_id: 'playlist_claim1',
        season_number: 1,
        series_key: 'test-series',
        items: [
          { claim_id: 'ep1', position: 0, episode_number: 1, season_number: 1 }
        ]
      },
      {
        id: 'playlist2',
        title: 'Test Series',
        claim_id: 'playlist_claim2',
        season_number: 3,
        series_key: 'test-series',
        items: [
          { claim_id: 'ep3', position: 0, episode_number: 1, season_number: 3 }
        ]
      }
    ];

    const allContent: ContentItem[] = [
      { claim_id: 'ep1', title: 'Test Series S01E01 - Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } },
      { claim_id: 'ep2', title: 'Test Series S02E01 - Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } },
      { claim_id: 'ep3', title: 'Test Series S03E01 - Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }
    ];

    const seriesMap = mergeSeriesData(playlists, allContent);
    const series = seriesMap.get('test-series');

    expect(series!.seasons).toHaveLength(3);
    
    // Season 1: from playlist (not inferred)
    expect(series!.seasons[0].number).toBe(1);
    expect(series!.seasons[0].inferred).toBe(false);
    
    // Season 2: inferred from parsing (not in playlist)
    expect(series!.seasons[1].number).toBe(2);
    expect(series!.seasons[1].inferred).toBe(true);
    
    // Season 3: from playlist (not inferred)
    expect(series!.seasons[2].number).toBe(3);
    expect(series!.seasons[2].inferred).toBe(false);
  });
});

describe('getSeriesForClaim', () => {
  it('should find series from playlist', () => {
    const playlists: Playlist[] = [
      {
        id: 'playlist1',
        title: 'Breaking Bad',
        claim_id: 'playlist_claim1',
        season_number: 1,
        series_key: 'breaking-bad',
        items: [
          { claim_id: 'ep1', position: 0, episode_number: 1, season_number: 1 },
          { claim_id: 'ep2', position: 1, episode_number: 2, season_number: 1 }
        ]
      }
    ];

    const allContent: ContentItem[] = [
      { claim_id: 'ep1', title: 'Breaking Bad S01E01 - Pilot', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } },
      { claim_id: 'ep2', title: 'Breaking Bad S01E02 - Episode 2', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }
    ];

    const series = getSeriesForClaim('ep1', playlists, allContent);

    expect(series).toBeDefined();
    expect(series!.series_key).toBe('breaking-bad');
    expect(series!.seasons).toHaveLength(1);
    expect(series!.seasons[0].inferred).toBe(false);
  });

  it('should fallback to parsing when not in playlist', () => {
    const playlists: Playlist[] = [];

    const allContent: ContentItem[] = [
      { claim_id: 'ep1', title: 'Breaking Bad S01E01 - Pilot', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } },
      { claim_id: 'ep2', title: 'Breaking Bad S01E02 - Episode 2', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }
    ];

    const series = getSeriesForClaim('ep1', playlists, allContent);

    expect(series).toBeDefined();
    expect(series!.series_key).toBe('breaking-bad');
    expect(series!.seasons).toHaveLength(1);
    expect(series!.seasons[0].inferred).toBe(true);
  });

  it('should return null for non-existent claim', () => {
    const playlists: Playlist[] = [];
    const allContent: ContentItem[] = [];

    const series = getSeriesForClaim('nonexistent', playlists, allContent);

    expect(series).toBeNull();
  });

  it('should return null for non-series content', () => {
    const playlists: Playlist[] = [];

    const allContent: ContentItem[] = [
      { claim_id: 'movie1', title: 'Just a Movie', tags: ['movie'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }
    ];

    const series = getSeriesForClaim('movie1', playlists, allContent);

    expect(series).toBeNull();
  });

  it('should find all episodes in same series when using fallback', () => {
    const playlists: Playlist[] = [];

    const allContent: ContentItem[] = [
      { claim_id: 'ep1', title: 'Breaking Bad S01E01 - Pilot', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } },
      { claim_id: 'ep2', title: 'Breaking Bad S01E02 - Episode 2', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } },
      { claim_id: 'ep3', title: 'Breaking Bad S02E01 - Season 2', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } },
      { claim_id: 'other', title: 'Other Series S01E01 - Episode 1', tags: ['series'], release_time: 0, video_urls: {}, compatibility: { compatible: true, fallback_available: false } }
    ];

    const series = getSeriesForClaim('ep2', playlists, allContent);

    expect(series).toBeDefined();
    expect(series!.series_key).toBe('breaking-bad');
    expect(series!.seasons).toHaveLength(2);
    expect(series!.total_episodes).toBe(3);
    // Should not include 'other' series
  });
});


describe('Series Grouping - Prevent Flat Episode Lists', () => {
  describe('isSeriesEpisode', () => {
    it('should identify series episodes by series tag', () => {
      const content: ContentItem = {
        claim_id: 'test-1',
        title: 'Test Series S01E01 - Pilot',
        tags: ['series'],
        release_time: Date.now(),
        video_urls: {},
        compatibility: { compatible: true, fallback_available: false }
      };
      
      expect(isSeriesEpisode(content)).toBe(true);
    });
    
    it('should identify series episodes by sitcom tag', () => {
      const content: ContentItem = {
        claim_id: 'test-1',
        title: 'Test Sitcom S01E01 - Pilot',
        tags: ['sitcom'],
        release_time: Date.now(),
        video_urls: {},
        compatibility: { compatible: true, fallback_available: false }
      };
      
      expect(isSeriesEpisode(content)).toBe(true);
    });
    
    it('should identify series episodes by title format', () => {
      const content: ContentItem = {
        claim_id: 'test-1',
        title: 'Test Series S01E01 - Pilot',
        tags: ['video'],
        release_time: Date.now(),
        video_urls: {},
        compatibility: { compatible: true, fallback_available: false }
      };
      
      expect(isSeriesEpisode(content)).toBe(true);
    });
    
    it('should not identify movies as series episodes', () => {
      const content: ContentItem = {
        claim_id: 'test-1',
        title: 'Test Movie',
        tags: ['movie'],
        release_time: Date.now(),
        video_urls: {},
        compatibility: { compatible: true, fallback_available: false }
      };
      
      expect(isSeriesEpisode(content)).toBe(false);
    });
  });
  
  describe('groupSeriesContent', () => {
    it('should separate series episodes from non-series content', () => {
      const content: ContentItem[] = [
        {
          claim_id: 'movie-1',
          title: 'Test Movie',
          tags: ['movie'],
          release_time: Date.now(),
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false }
        },
        {
          claim_id: 'series-1',
          title: 'Test Series S01E01 - Pilot',
          tags: ['series'],
          release_time: Date.now(),
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false }
        },
        {
          claim_id: 'series-2',
          title: 'Test Series S01E02 - Second Episode',
          tags: ['series'],
          release_time: Date.now(),
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false }
        }
      ];
      
      const { series, nonSeriesContent } = groupSeriesContent(content);
      
      expect(nonSeriesContent).toHaveLength(1);
      expect(nonSeriesContent[0].claim_id).toBe('movie-1');
      expect(series.size).toBeGreaterThan(0);
    });
    
    it('should group series episodes by series name', () => {
      const content: ContentItem[] = [
        {
          claim_id: 'series-1',
          title: 'Test Series S01E01 - Pilot',
          tags: ['series'],
          release_time: Date.now(),
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false }
        },
        {
          claim_id: 'series-2',
          title: 'Test Series S01E02 - Second Episode',
          tags: ['series'],
          release_time: Date.now(),
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false }
        },
        {
          claim_id: 'other-1',
          title: 'Other Series S01E01 - Pilot',
          tags: ['series'],
          release_time: Date.now(),
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false }
        }
      ];
      
      const { series } = groupSeriesContent(content);
      
      expect(series.size).toBe(2);
      
      const testSeries = Array.from(series.values()).find(s => s.title === 'Test Series');
      expect(testSeries).toBeDefined();
      expect(testSeries?.total_episodes).toBe(2);
      
      const otherSeries = Array.from(series.values()).find(s => s.title === 'Other Series');
      expect(otherSeries).toBeDefined();
      expect(otherSeries?.total_episodes).toBe(1);
    });
    
    it('should organize episodes into seasons', () => {
      const content: ContentItem[] = [
        {
          claim_id: 'series-1',
          title: 'Test Series S01E01 - Pilot',
          tags: ['series'],
          release_time: Date.now(),
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false }
        },
        {
          claim_id: 'series-2',
          title: 'Test Series S01E02 - Second Episode',
          tags: ['series'],
          release_time: Date.now(),
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false }
        },
        {
          claim_id: 'series-3',
          title: 'Test Series S02E01 - Season 2 Premiere',
          tags: ['series'],
          release_time: Date.now(),
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false }
        }
      ];
      
      const { series } = groupSeriesContent(content);
      
      const testSeries = Array.from(series.values())[0];
      expect(testSeries.seasons).toHaveLength(2);
      expect(testSeries.seasons[0].number).toBe(1);
      expect(testSeries.seasons[0].episodes).toHaveLength(2);
      expect(testSeries.seasons[1].number).toBe(2);
      expect(testSeries.seasons[1].episodes).toHaveLength(1);
    });
    
    it('should return empty series map for non-series content', () => {
      const content: ContentItem[] = [
        {
          claim_id: 'movie-1',
          title: 'Test Movie',
          tags: ['movie'],
          release_time: Date.now(),
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false }
        }
      ];
      
      const { series, nonSeriesContent } = groupSeriesContent(content);
      
      expect(series.size).toBe(0);
      expect(nonSeriesContent).toHaveLength(1);
    });
  });
  
  describe('getSeriesRepresentative', () => {
    it('should return first episode of first season', () => {
      const content: ContentItem[] = [
        {
          claim_id: 'series-1',
          title: 'Test Series S01E01 - Pilot',
          tags: ['series'],
          release_time: Date.now(),
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false }
        },
        {
          claim_id: 'series-2',
          title: 'Test Series S01E02 - Second Episode',
          tags: ['series'],
          release_time: Date.now(),
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false }
        }
      ];
      
      const { series } = groupSeriesContent(content);
      const testSeries = Array.from(series.values())[0];
      const representative = getSeriesRepresentative(testSeries, content);
      
      expect(representative).toBeDefined();
      expect(representative?.claim_id).toBe('series-1');
    });
    
    it('should return null for empty series', () => {
      const seriesInfo: SeriesInfo = {
        series_key: 'test',
        title: 'Test Series',
        seasons: [],
        total_episodes: 0
      };
      
      const representative = getSeriesRepresentative(seriesInfo, []);
      expect(representative).toBeNull();
    });
  });
  
  describe('seriesToContentItem', () => {
    it('should create content item with series information', () => {
      const seriesInfo: SeriesInfo = {
        series_key: 'test-series',
        title: 'Test Series',
        seasons: [
          {
            number: 1,
            episodes: [
              {
                claim_id: 'ep1',
                title: 'Episode 1',
                episode_number: 1,
                season_number: 1
              },
              {
                claim_id: 'ep2',
                title: 'Episode 2',
                episode_number: 2,
                season_number: 1
              }
            ],
            inferred: false
          }
        ],
        total_episodes: 2
      };
      
      const representativeContent: ContentItem = {
        claim_id: 'ep1',
        title: 'Test Series S01E01 - Pilot',
        tags: ['series'],
        release_time: Date.now(),
        video_urls: {},
        compatibility: { compatible: true, fallback_available: false }
      };
      
      const seriesItem = seriesToContentItem(seriesInfo, representativeContent);
      
      expect(seriesItem.title).toBe('Test Series');
      expect(seriesItem.description).toBe('1 season • 2 episodes');
      expect(seriesItem.tags).toContain('__series_container__');
    });
    
    it('should handle multiple seasons correctly', () => {
      const seriesInfo: SeriesInfo = {
        series_key: 'test-series',
        title: 'Test Series',
        seasons: [
          {
            number: 1,
            episodes: [{ claim_id: 'ep1', title: 'Ep1', episode_number: 1, season_number: 1 }],
            inferred: false
          },
          {
            number: 2,
            episodes: [{ claim_id: 'ep2', title: 'Ep2', episode_number: 1, season_number: 2 }],
            inferred: false
          }
        ],
        total_episodes: 2
      };
      
      const representativeContent: ContentItem = {
        claim_id: 'ep1',
        title: 'Test Series S01E01',
        tags: ['series'],
        release_time: Date.now(),
        video_urls: {},
        compatibility: { compatible: true, fallback_available: false }
      };
      
      const seriesItem = seriesToContentItem(seriesInfo, representativeContent);
      
      expect(seriesItem.description).toBe('2 seasons • 2 episodes');
    });
  });
  
  describe('Integration: Flat Episode List Prevention', () => {
    it('should never return individual episodes when grouping is applied', () => {
      const content: ContentItem[] = [
        {
          claim_id: 'series-1',
          title: 'Test Series S01E01 - Pilot',
          tags: ['series'],
          release_time: Date.now(),
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false }
        },
        {
          claim_id: 'series-2',
          title: 'Test Series S01E02 - Second Episode',
          tags: ['series'],
          release_time: Date.now(),
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false }
        },
        {
          claim_id: 'series-3',
          title: 'Test Series S01E03 - Third Episode',
          tags: ['series'],
          release_time: Date.now(),
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false }
        }
      ];
      
      const { series, nonSeriesContent } = groupSeriesContent(content);
      
      // Verify no individual episodes in non-series content
      expect(nonSeriesContent).toHaveLength(0);
      
      // Verify all episodes are grouped in series
      expect(series.size).toBe(1);
      const testSeries = Array.from(series.values())[0];
      expect(testSeries.total_episodes).toBe(3);
      expect(testSeries.seasons[0].episodes).toHaveLength(3);
      
      // Verify episodes are in season structure, not flat
      expect(testSeries.seasons).toHaveLength(1);
      expect(testSeries.seasons[0].episodes[0].claim_id).toBe('series-1');
      expect(testSeries.seasons[0].episodes[1].claim_id).toBe('series-2');
      expect(testSeries.seasons[0].episodes[2].claim_id).toBe('series-3');
    });
    
    it('should maintain series structure even with mixed content', () => {
      const content: ContentItem[] = [
        {
          claim_id: 'movie-1',
          title: 'Test Movie',
          tags: ['movie'],
          release_time: Date.now(),
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false }
        },
        {
          claim_id: 'series-1',
          title: 'Series A S01E01',
          tags: ['series'],
          release_time: Date.now(),
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false }
        },
        {
          claim_id: 'movie-2',
          title: 'Another Movie',
          tags: ['movie'],
          release_time: Date.now(),
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false }
        },
        {
          claim_id: 'series-2',
          title: 'Series A S01E02',
          tags: ['series'],
          release_time: Date.now(),
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false }
        }
      ];
      
      const { series, nonSeriesContent } = groupSeriesContent(content);
      
      // Movies should be in non-series content
      expect(nonSeriesContent).toHaveLength(2);
      expect(nonSeriesContent.every(c => c.tags.includes('movie'))).toBe(true);
      
      // Series episodes should be grouped
      expect(series.size).toBe(1);
      const seriesA = Array.from(series.values())[0];
      expect(seriesA.total_episodes).toBe(2);
      expect(seriesA.seasons[0].episodes).toHaveLength(2);
    });
  });
});
