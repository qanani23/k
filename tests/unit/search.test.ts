import { describe, it, expect } from 'vitest';
import { 
  normalizeQuery, 
  parseEpisodeFromTitle,
  sanitizeSearchInput,
  buildSearchPatterns,
  scoreSearchResult,
  extractSeriesKey,
  isSeasonEpisodeQuery,
  shouldFallbackToRecent,
  getFallbackMessage
} from '../../src/lib/search';

describe('Search Normalization', () => {
  describe('normalizeQuery', () => {
    describe('Standard Format Variations (SxxExx)', () => {
      it('should normalize S01E01 format', () => {
        const result = normalizeQuery('s1e1');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
      });

      it('should normalize S01E01 with leading zeros', () => {
        const result = normalizeQuery('S01E01');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
      });

      it('should normalize s1e1 lowercase', () => {
        const result = normalizeQuery('s1e1');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
      });

      it('should normalize S1E1 mixed case', () => {
        const result = normalizeQuery('S1E1');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
      });

      it('should normalize S01 E01 with space', () => {
        const result = normalizeQuery('S01 E01');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
      });

      it('should normalize S1.E1 with period', () => {
        const result = normalizeQuery('S1.E1');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
      });

      it('should normalize S1-E1 with dash', () => {
        const result = normalizeQuery('S1-E1');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
      });

      it('should normalize S1xE1 with x separator', () => {
        const result = normalizeQuery('S1xE1');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
      });

      it('should normalize S1XE1 with uppercase X separator', () => {
        const result = normalizeQuery('S1XE1');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
      });

      it('should handle double-digit seasons and episodes', () => {
        const result = normalizeQuery('s12e34');
        expect(result.seasonEpisodeTokens).toContain('S12E34');
      });

      it('should handle triple-digit episodes', () => {
        const result = normalizeQuery('s1e123');
        expect(result.seasonEpisodeTokens).toContain('S01E123');
      });

      it('should handle S10E01 format', () => {
        const result = normalizeQuery('S10E01');
        expect(result.seasonEpisodeTokens).toContain('S10E01');
      });

      it('should handle S01E10 format', () => {
        const result = normalizeQuery('S01E10');
        expect(result.seasonEpisodeTokens).toContain('S01E10');
      });
    });

    describe('Alternative Format (1x01)', () => {
      it('should normalize 1x01 format', () => {
        const result = normalizeQuery('1x01');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
      });

      it('should normalize 1x1 format', () => {
        const result = normalizeQuery('1x1');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
      });

      it('should normalize 1x10 format', () => {
        const result = normalizeQuery('1x10');
        expect(result.seasonEpisodeTokens).toContain('S01E10');
      });

      it('should normalize 2x5 format', () => {
        const result = normalizeQuery('2x5');
        expect(result.seasonEpisodeTokens).toContain('S02E05');
      });

      it('should normalize 10x01 format', () => {
        const result = normalizeQuery('10x01');
        expect(result.seasonEpisodeTokens).toContain('S10E01');
      });

      it('should normalize 1X01 with uppercase X', () => {
        const result = normalizeQuery('1X01');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
      });

      it('should normalize 12x34 double-digit format', () => {
        const result = normalizeQuery('12x34');
        expect(result.seasonEpisodeTokens).toContain('S12E34');
      });
    });

    describe('Verbose Format (season X episode Y)', () => {
      it('should normalize "season 1 episode 1"', () => {
        const result = normalizeQuery('season 1 episode 1');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
      });

      it('should normalize "season 2 episode 5"', () => {
        const result = normalizeQuery('season 2 episode 5');
        expect(result.seasonEpisodeTokens).toContain('S02E05');
      });

      it('should normalize "season 10 episode 20"', () => {
        const result = normalizeQuery('season 10 episode 20');
        expect(result.seasonEpisodeTokens).toContain('S10E20');
      });

      it('should normalize "Season 1 Episode 1" with capitals', () => {
        const result = normalizeQuery('Season 1 Episode 1');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
      });

      it('should normalize "SEASON 1 EPISODE 1" all caps', () => {
        const result = normalizeQuery('SEASON 1 EPISODE 1');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
      });
    });

    describe('Word Form Variations', () => {
      it('should normalize "season one episode one"', () => {
        const result = normalizeQuery('season one episode one');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
      });

      it('should normalize "season one episode two"', () => {
        const result = normalizeQuery('season one episode two');
        expect(result.seasonEpisodeTokens).toContain('S01E02');
      });

      it('should normalize "season two episode three"', () => {
        const result = normalizeQuery('season two episode three');
        expect(result.seasonEpisodeTokens).toContain('S02E03');
      });

      it('should normalize "season three episode four"', () => {
        const result = normalizeQuery('season three episode four');
        expect(result.seasonEpisodeTokens).toContain('S03E04');
      });

      it('should normalize "season four episode five"', () => {
        const result = normalizeQuery('season four episode five');
        expect(result.seasonEpisodeTokens).toContain('S04E05');
      });

      it('should normalize "season five episode six"', () => {
        const result = normalizeQuery('season five episode six');
        expect(result.seasonEpisodeTokens).toContain('S05E06');
      });

      it('should normalize "season six episode seven"', () => {
        const result = normalizeQuery('season six episode seven');
        expect(result.seasonEpisodeTokens).toContain('S06E07');
      });

      it('should normalize "season seven episode eight"', () => {
        const result = normalizeQuery('season seven episode eight');
        expect(result.seasonEpisodeTokens).toContain('S07E08');
      });

      it('should normalize "season eight episode nine"', () => {
        const result = normalizeQuery('season eight episode nine');
        expect(result.seasonEpisodeTokens).toContain('S08E09');
      });

      it('should normalize "season nine episode ten"', () => {
        const result = normalizeQuery('season nine episode ten');
        expect(result.seasonEpisodeTokens).toContain('S09E10');
      });

      it('should normalize "season ten episode one"', () => {
        const result = normalizeQuery('season ten episode one');
        expect(result.seasonEpisodeTokens).toContain('S10E01');
      });

      it('should normalize "season 1 episode eleven"', () => {
        const result = normalizeQuery('season 1 episode eleven');
        expect(result.seasonEpisodeTokens).toContain('S01E11');
      });

      it('should normalize "season 1 episode twelve"', () => {
        const result = normalizeQuery('season 1 episode twelve');
        expect(result.seasonEpisodeTokens).toContain('S01E12');
      });

      it('should normalize "season 1 episode thirteen"', () => {
        const result = normalizeQuery('season 1 episode thirteen');
        expect(result.seasonEpisodeTokens).toContain('S01E13');
      });

      it('should normalize "season 1 episode fourteen"', () => {
        const result = normalizeQuery('season 1 episode fourteen');
        expect(result.seasonEpisodeTokens).toContain('S01E14');
      });

      it('should normalize "season 1 episode fifteen"', () => {
        const result = normalizeQuery('season 1 episode fifteen');
        expect(result.seasonEpisodeTokens).toContain('S01E15');
      });

      it('should normalize "season 1 episode sixteen"', () => {
        const result = normalizeQuery('season 1 episode sixteen');
        expect(result.seasonEpisodeTokens).toContain('S01E16');
      });

      it('should normalize "season 1 episode seventeen"', () => {
        const result = normalizeQuery('season 1 episode seventeen');
        expect(result.seasonEpisodeTokens).toContain('S01E17');
      });

      it('should normalize "season 1 episode eighteen"', () => {
        const result = normalizeQuery('season 1 episode eighteen');
        expect(result.seasonEpisodeTokens).toContain('S01E18');
      });

      it('should normalize "season 1 episode nineteen"', () => {
        const result = normalizeQuery('season 1 episode nineteen');
        expect(result.seasonEpisodeTokens).toContain('S01E19');
      });

      it('should normalize "season 1 episode twenty"', () => {
        const result = normalizeQuery('season 1 episode twenty');
        expect(result.seasonEpisodeTokens).toContain('S01E20');
      });

      it('should handle mixed case word forms', () => {
        const result = normalizeQuery('Season ONE Episode TEN');
        expect(result.seasonEpisodeTokens).toContain('S01E10');
      });
    });

    describe('Episode Abbreviations', () => {
      it('should normalize "s1 ep 1"', () => {
        const result = normalizeQuery('s1 ep 1');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
      });

      it('should normalize "s1 ep. 1" with period', () => {
        const result = normalizeQuery('s1 ep. 1');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
      });

      it('should normalize "s1 ep 12"', () => {
        const result = normalizeQuery('s1 ep 12');
        expect(result.seasonEpisodeTokens).toContain('S01E12');
      });

      it('should normalize "season 1 ep 5"', () => {
        const result = normalizeQuery('season 1 ep 5');
        expect(result.seasonEpisodeTokens).toContain('S01E05');
      });

      it('should normalize "season 2 ep. 10"', () => {
        const result = normalizeQuery('season 2 ep. 10');
        expect(result.seasonEpisodeTokens).toContain('S02E10');
      });
    });

    describe('Multiple Patterns in Single Query', () => {
      it('should handle multiple season/episode patterns', () => {
        const result = normalizeQuery('season 1 episode 5 and s2e3');
        expect(result.seasonEpisodeTokens).toContain('S01E05');
        expect(result.seasonEpisodeTokens).toContain('S02E03');
      });

      it('should handle mixed formats', () => {
        const result = normalizeQuery('s1e1 and 2x5');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
        expect(result.seasonEpisodeTokens).toContain('S02E05');
      });

      it('should not duplicate tokens', () => {
        const result = normalizeQuery('s1e1 S01E01 1x01');
        const uniqueTokens = new Set(result.seasonEpisodeTokens);
        expect(uniqueTokens.size).toBe(1);
        expect(result.seasonEpisodeTokens).toContain('S01E01');
      });
    });

    describe('Search Terms Extraction', () => {
      it('should extract search terms', () => {
        const result = normalizeQuery('comedy series season 1');
        expect(result.searchTerms).toContain('comedy');
        expect(result.searchTerms).toContain('series');
      });

      it('should filter out short terms', () => {
        const result = normalizeQuery('a comedy tv series');
        expect(result.searchTerms).not.toContain('a');
        expect(result.searchTerms).toContain('comedy');
      });

      it('should handle series names with "s" in them', () => {
        const result = normalizeQuery('series name s1e1');
        expect(result.searchTerms).toContain('series');
        expect(result.searchTerms).toContain('name');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
      });

      it('should extract terms from complex queries', () => {
        const result = normalizeQuery('breaking bad season 1 episode 1');
        expect(result.searchTerms).toContain('breaking');
        expect(result.searchTerms).toContain('bad');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
      });
    });

    describe('Edge Cases and Special Scenarios', () => {
      it('should preserve original text', () => {
        const original = 'Breaking Bad S01E01';
        const result = normalizeQuery(original);
        expect(result.originalText).toBe(original);
      });

      it('should handle queries with only season number', () => {
        const result = normalizeQuery('season 3');
        expect(result.normalizedText).toContain('S3');
      });

      it('should handle queries with only episode number', () => {
        const result = normalizeQuery('episode 5');
        expect(result.normalizedText).toContain('E5');
      });

      it('should handle empty queries', () => {
        const result = normalizeQuery('');
        expect(result.seasonEpisodeTokens).toHaveLength(0);
        expect(result.searchTerms).toHaveLength(0);
      });

      it('should handle whitespace-only queries', () => {
        const result = normalizeQuery('   ');
        expect(result.seasonEpisodeTokens).toHaveLength(0);
        expect(result.searchTerms).toHaveLength(0);
      });

      it('should handle very long queries', () => {
        const longQuery = 'a'.repeat(1000);
        expect(() => normalizeQuery(longQuery)).not.toThrow();
      });

      it('should handle unicode characters', () => {
        const result = normalizeQuery('série saison 1 épisode 1');
        expect(result.searchTerms).toContain('série');
      });

      it('should handle special characters', () => {
        const result = normalizeQuery('show-name s1e1 (2024)');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
      });

      it('should handle leading/trailing whitespace', () => {
        const result = normalizeQuery('  s1e1  ');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
      });

      it('should handle tabs and newlines', () => {
        const result = normalizeQuery('s1e1\t\n2x5');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
        expect(result.seasonEpisodeTokens).toContain('S02E05');
      });
    });

    describe('Real-World Query Examples', () => {
      it('should handle "breaking bad s5e16"', () => {
        const result = normalizeQuery('breaking bad s5e16');
        expect(result.seasonEpisodeTokens).toContain('S05E16');
        expect(result.searchTerms).toContain('breaking');
        expect(result.searchTerms).toContain('bad');
      });

      it('should handle "game of thrones 3x09"', () => {
        const result = normalizeQuery('game of thrones 3x09');
        expect(result.seasonEpisodeTokens).toContain('S03E09');
        expect(result.searchTerms).toContain('game');
        expect(result.searchTerms).toContain('thrones');
      });

      it('should handle "the office season 2 episode 1"', () => {
        const result = normalizeQuery('the office season 2 episode 1');
        expect(result.seasonEpisodeTokens).toContain('S02E01');
        expect(result.searchTerms).toContain('the');
        expect(result.searchTerms).toContain('office');
      });

      it('should handle "friends season one episode one"', () => {
        const result = normalizeQuery('friends season one episode one');
        expect(result.seasonEpisodeTokens).toContain('S01E01');
        expect(result.searchTerms).toContain('friends');
      });

      it('should handle "stranger things S04E09"', () => {
        const result = normalizeQuery('stranger things S04E09');
        expect(result.seasonEpisodeTokens).toContain('S04E09');
        expect(result.searchTerms).toContain('stranger');
        expect(result.searchTerms).toContain('things');
      });
    });
  });

  describe('parseEpisodeFromTitle', () => {
    it('should parse standard episode format', () => {
      const result = parseEpisodeFromTitle('Breaking Bad S01E01 - Pilot');
      expect(result).toEqual({
        seriesName: 'Breaking Bad',
        seasonNumber: 1,
        episodeNumber: 1,
        episodeTitle: 'Pilot'
      });
    });

    it('should parse without episode title', () => {
      const result = parseEpisodeFromTitle('Breaking Bad S01E01');
      expect(result).toEqual({
        seriesName: 'Breaking Bad',
        seasonNumber: 1,
        episodeNumber: 1,
        episodeTitle: undefined
      });
    });

    it('should parse alternative formats', () => {
      const result = parseEpisodeFromTitle('Breaking Bad 1x01 - Pilot');
      expect(result).toEqual({
        seriesName: 'Breaking Bad',
        seasonNumber: 1,
        episodeNumber: 1,
        episodeTitle: 'Pilot'
      });
    });

    it('should handle Season Episode format', () => {
      const result = parseEpisodeFromTitle('Breaking Bad Season 1 Episode 1 - Pilot');
      expect(result).toEqual({
        seriesName: 'Breaking Bad',
        seasonNumber: 1,
        episodeNumber: 1,
        episodeTitle: 'Pilot'
      });
    });

    it('should return null for non-episode titles', () => {
      const result = parseEpisodeFromTitle('Breaking Bad Movie');
      expect(result).toBeNull();
    });

    it('should handle double-digit seasons and episodes', () => {
      const result = parseEpisodeFromTitle('Breaking Bad S12E34 - Finale');
      expect(result).toEqual({
        seriesName: 'Breaking Bad',
        seasonNumber: 12,
        episodeNumber: 34,
        episodeTitle: 'Finale'
      });
    });
  });
});

describe('Search Security', () => {
  describe('sanitizeSearchInput', () => {
    it('should remove SQL injection attempts', () => {
      const malicious = "'; DROP TABLE users; --";
      const sanitized = sanitizeSearchInput(malicious);
      expect(sanitized).not.toContain(';');
      expect(sanitized).not.toContain('--');
    });

    it('should escape SQL LIKE wildcards', () => {
      const input = 'search%term_with_wildcards';
      const sanitized = sanitizeSearchInput(input);
      expect(sanitized).toBe('search\\%term\\_with\\_wildcards');
    });

    it('should remove quotes', () => {
      const input = 'search "term" with \'quotes\'';
      const sanitized = sanitizeSearchInput(input);
      expect(sanitized).not.toContain('"');
      expect(sanitized).not.toContain("'");
    });

    it('should remove SQL comments', () => {
      const input = 'search /* comment */ term';
      const sanitized = sanitizeSearchInput(input);
      expect(sanitized).not.toContain('/*');
      expect(sanitized).not.toContain('*/');
    });
  });

  describe('buildSearchPatterns', () => {
    it('should create LIKE patterns for search terms', () => {
      const patterns = buildSearchPatterns('comedy series');
      expect(patterns).toContain('%comedy%');
      expect(patterns).toContain('%series%');
    });

    it('should create patterns for season/episode tokens', () => {
      const patterns = buildSearchPatterns('s1e1');
      expect(patterns).toContain('%S01E01%');
    });

    it('should sanitize input before creating patterns', () => {
      const patterns = buildSearchPatterns('search%term');
      expect(patterns.some(p => p.includes('search\\%term'))).toBe(true);
    });
  });
});

describe('Search Scoring', () => {
  describe('scoreSearchResult', () => {
    const mockContent = {
      title: 'Breaking Bad S01E01 - Pilot',
      description: 'A high school chemistry teacher turned meth cook',
      tags: ['series', 'drama', 'crime']
    };

    it('should give high score for exact title match', () => {
      const score = scoreSearchResult(mockContent, 'Breaking Bad S01E01 - Pilot');
      expect(score).toBeGreaterThanOrEqual(90);
    });

    it('should score title contains higher than description', () => {
      const titleScore = scoreSearchResult(mockContent, 'Breaking Bad');
      const descriptionScore = scoreSearchResult(mockContent, 'chemistry');
      expect(titleScore).toBeGreaterThan(descriptionScore);
    });

    it('should score season/episode tokens highly', () => {
      const score = scoreSearchResult(mockContent, 's1e1');
      expect(score).toBeGreaterThan(20);
    });

    it('should score tag matches', () => {
      const score = scoreSearchResult(mockContent, 'drama');
      expect(score).toBeGreaterThan(10);
    });

    it('should return 0 for no matches', () => {
      const score = scoreSearchResult(mockContent, 'nonexistent');
      expect(score).toBe(0);
    });
  });
});

describe('Search Utilities', () => {
  describe('extractSeriesKey', () => {
    it('should extract series key from episode title', () => {
      const key = extractSeriesKey('Breaking Bad S01E01 - Pilot');
      expect(key).toBe('breaking_bad');
    });

    it('should handle special characters', () => {
      const key = extractSeriesKey('Game of Thrones S01E01 - Winter is Coming');
      expect(key).toBe('game_of_thrones');
    });

    it('should return null for non-episode titles', () => {
      const key = extractSeriesKey('Breaking Bad Movie');
      expect(key).toBeNull();
    });
  });

  describe('isSeasonEpisodeQuery', () => {
    it('should detect season/episode queries', () => {
      expect(isSeasonEpisodeQuery('s1e1')).toBe(true);
      expect(isSeasonEpisodeQuery('season 1 episode 1')).toBe(true);
      expect(isSeasonEpisodeQuery('1x01')).toBe(true);
    });

    it('should not detect regular queries', () => {
      expect(isSeasonEpisodeQuery('comedy movies')).toBe(false);
      expect(isSeasonEpisodeQuery('breaking bad')).toBe(false);
    });
  });
});

describe('Search Fallback', () => {
  describe('shouldFallbackToRecent', () => {
    it('should return true when results are empty and query is valid', () => {
      expect(shouldFallbackToRecent('test query', [], 2)).toBe(true);
    });

    it('should return false when results exist', () => {
      expect(shouldFallbackToRecent('test query', [{ id: 1 }], 2)).toBe(false);
    });

    it('should return false when query is below minimum length', () => {
      expect(shouldFallbackToRecent('a', [], 2)).toBe(false);
    });

    it('should respect custom minimum length', () => {
      expect(shouldFallbackToRecent('ab', [], 3)).toBe(false);
      expect(shouldFallbackToRecent('abc', [], 3)).toBe(true);
    });

    it('should sanitize query before checking length', () => {
      expect(shouldFallbackToRecent('  test  ', [], 2)).toBe(true);
    });
  });

  describe('getFallbackMessage', () => {
    it('should return appropriate fallback message', () => {
      const message = getFallbackMessage('test query');
      expect(message).toContain('test query');
      expect(message).toContain('No exact matches found');
      expect(message).toContain('recent uploads');
    });

    it('should handle empty query', () => {
      const message = getFallbackMessage('');
      expect(message).toBeTruthy();
    });
  });
});