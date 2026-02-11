import { describe, it, expect } from 'vitest';
import {
  parseSeriesTitle,
  generateSeriesKey,
  parseVersion,
  compareVersions,
  isVersionGreater,
  isVersionLess,
  versionToString,
  parseRangeHeader,
  toContentRangeHeader,
  getActualEnd,
  getByteCount,
  isBaseTag,
  isFilterTag,
  isValidQuality,
  baseTagForFilter,
  nextLowerQuality,
  qualityScore,
  formatFileSize,
  formatDuration,
  validateClaimId,
  validateQuality,
  validateUrl,
} from '../../src/types';

describe('Series Parsing', () => {
  it('should parse valid series title', () => {
    const result = parseSeriesTitle('Breaking Bad S01E01 - Pilot');
    expect(result).toEqual({
      series_name: 'Breaking Bad',
      season_number: 1,
      episode_number: 1,
      episode_title: 'Pilot',
    });
  });

  it('should parse series with double-digit season and episode', () => {
    const result = parseSeriesTitle('Game of Thrones S10E15 - The Final Battle');
    expect(result).toEqual({
      series_name: 'Game of Thrones',
      season_number: 10,
      episode_number: 15,
      episode_title: 'The Final Battle',
    });
  });

  it('should return null for invalid format', () => {
    expect(parseSeriesTitle('Invalid Title')).toBeNull();
    expect(parseSeriesTitle('Movie Title 2024')).toBeNull();
  });

  it('should generate series key from name', () => {
    expect(generateSeriesKey('Breaking Bad')).toBe('breaking-bad');
    expect(generateSeriesKey('Game of Thrones')).toBe('game-of-thrones');
    expect(generateSeriesKey('The Office (US)')).toBe('the-office-us');
  });
});

describe('Version Comparison', () => {
  it('should parse valid version strings', () => {
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parseVersion('2.0')).toEqual({ major: 2, minor: 0, patch: 0 });
    expect(parseVersion('10.5.1')).toEqual({ major: 10, minor: 5, patch: 1 });
  });

  it('should return null for invalid version strings', () => {
    expect(parseVersion('1')).toBeNull();
    expect(parseVersion('1.2.3.4')).toBeNull();
    expect(parseVersion('abc')).toBeNull();
    expect(parseVersion('1.x.3')).toBeNull();
  });

  it('should compare versions correctly', () => {
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.5.0', '1.5.1')).toBeLessThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('2.1', '2.0.5')).toBeGreaterThan(0);
  });

  it('should check if version is greater', () => {
    expect(isVersionGreater('2.0.0', '1.9.9')).toBe(true);
    expect(isVersionGreater('1.5.0', '1.5.1')).toBe(false);
    expect(isVersionGreater('1.0.0', '1.0.0')).toBe(false);
  });

  it('should check if version is less', () => {
    expect(isVersionLess('1.9.9', '2.0.0')).toBe(true);
    expect(isVersionLess('1.5.1', '1.5.0')).toBe(false);
    expect(isVersionLess('1.0.0', '1.0.0')).toBe(false);
  });

  it('should convert version to string', () => {
    expect(versionToString({ major: 1, minor: 2, patch: 3 })).toBe('1.2.3');
    expect(versionToString({ major: 2, minor: 0, patch: 0 })).toBe('2.0');
  });
});

describe('Range Request Parsing', () => {
  it('should parse valid range headers', () => {
    expect(parseRangeHeader('bytes=0-1023')).toEqual({ start: 0, end: 1023 });
    expect(parseRangeHeader('bytes=1024-')).toEqual({ start: 1024, end: undefined });
    expect(parseRangeHeader('bytes=500-999')).toEqual({ start: 500, end: 999 });
  });

  it('should return null for invalid range headers', () => {
    expect(parseRangeHeader('invalid')).toBeNull();
    expect(parseRangeHeader('bytes=')).toBeNull();
    expect(parseRangeHeader('bytes=abc-def')).toBeNull();
  });

  it('should convert to content range header', () => {
    expect(toContentRangeHeader({ start: 0, end: 1023 }, 10000)).toBe('bytes 0-1023/10000');
    expect(toContentRangeHeader({ start: 1024 }, 10000)).toBe('bytes 1024-9999/10000');
  });

  it('should calculate actual end position', () => {
    expect(getActualEnd({ start: 0, end: 1023 }, 10000)).toBe(1023);
    expect(getActualEnd({ start: 0, end: 15000 }, 10000)).toBe(9999);
    expect(getActualEnd({ start: 1024 }, 10000)).toBe(9999);
  });

  it('should calculate byte count', () => {
    expect(getByteCount({ start: 0, end: 1023 }, 10000)).toBe(1024);
    expect(getByteCount({ start: 1024 }, 10000)).toBe(8976);
    expect(getByteCount({ start: 0 }, 1000)).toBe(1000);
  });
});

describe('Tag Validation', () => {
  it('should validate base tags', () => {
    expect(isBaseTag('movie')).toBe(true);
    expect(isBaseTag('series')).toBe(true);
    expect(isBaseTag('sitcom')).toBe(true);
    expect(isBaseTag('kids')).toBe(true);
    expect(isBaseTag('hero_trailer')).toBe(true);
    expect(isBaseTag('invalid')).toBe(false);
  });

  it('should validate filter tags', () => {
    expect(isFilterTag('comedy_movies')).toBe(true);
    expect(isFilterTag('action_series')).toBe(true);
    expect(isFilterTag('comedy_kids')).toBe(true);
    expect(isFilterTag('invalid')).toBe(false);
  });

  it('should get base tag for filter', () => {
    expect(baseTagForFilter('comedy_movies')).toBe('movie');
    expect(baseTagForFilter('action_series')).toBe('series');
    expect(baseTagForFilter('comedy_kids')).toBe('kids');
  });
});

describe('Quality Utilities', () => {
  it('should validate quality strings', () => {
    expect(isValidQuality('1080p')).toBe(true);
    expect(isValidQuality('720p')).toBe(true);
    expect(isValidQuality('480p')).toBe(true);
    expect(isValidQuality('360p')).toBe(true);
    expect(isValidQuality('240p')).toBe(true);
    expect(isValidQuality('4K')).toBe(false);
  });

  it('should get next lower quality', () => {
    expect(nextLowerQuality('1080p')).toBe('720p');
    expect(nextLowerQuality('720p')).toBe('480p');
    expect(nextLowerQuality('480p')).toBe('360p');
    expect(nextLowerQuality('360p')).toBe('240p');
    expect(nextLowerQuality('240p')).toBeNull();
  });

  it('should calculate quality score', () => {
    expect(qualityScore('1080p')).toBe(5);
    expect(qualityScore('720p')).toBe(4);
    expect(qualityScore('480p')).toBe(3);
    expect(qualityScore('360p')).toBe(2);
    expect(qualityScore('240p')).toBe(1);
    expect(qualityScore('1080p')).toBeGreaterThan(qualityScore('720p'));
  });
});

describe('Format Utilities', () => {
  it('should format file sizes', () => {
    expect(formatFileSize(500)).toBe('500.0 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1048576)).toBe('1.0 MB');
    expect(formatFileSize(1073741824)).toBe('1.0 GB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('should format durations', () => {
    expect(formatDuration(30)).toBe('0:30');
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(3661)).toBe('1:01:01');
    expect(formatDuration(7200)).toBe('2:00:00');
  });
});

describe('Validation Utilities', () => {
  it('should validate claim IDs', () => {
    expect(validateClaimId('valid-claim-id')).toBe(true);
    expect(validateClaimId('abc123')).toBe(true);
    expect(validateClaimId('')).toBe(false);
    expect(validateClaimId('a'.repeat(101))).toBe(false);
  });

  it('should validate quality strings', () => {
    expect(validateQuality('720p')).toBe(true);
    expect(validateQuality('1080p')).toBe(true);
    expect(validateQuality('invalid')).toBe(false);
  });

  it('should validate URLs', () => {
    expect(validateUrl('https://example.com')).toBe(true);
    expect(validateUrl('http://localhost:8080')).toBe(true);
    expect(validateUrl('invalid-url')).toBe(false);
    expect(validateUrl('')).toBe(false);
  });
});
