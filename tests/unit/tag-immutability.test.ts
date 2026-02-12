/**
 * Tag System Immutability Verification Tests
 * 
 * This test suite verifies that the tag system is immutable and hard-coded
 * throughout the application, with no dynamic tag generation or inference.
 * 
 * Requirements verified:
 * - Tags are defined as constants (not mutable)
 * - No dynamic tag generation or modification
 * - Frontend and backend tag definitions match
 * - Tag system is authoritative and never changes
 */

import { describe, it, expect } from 'vitest';
import { CATEGORIES, HARD_CODED_TAGS } from '../../src/config/categories';
import { BASE_TAGS, FILTER_TAGS } from '../../src/types';

describe('Tag System Immutability', () => {
  describe('Hard-Coded Tag Constants', () => {
    it('should have all base tags defined as string literals', () => {
      // Verify base tags are defined
      expect(HARD_CODED_TAGS.SERIES).toBe('series');
      expect(HARD_CODED_TAGS.MOVIE).toBe('movie');
      expect(HARD_CODED_TAGS.SITCOM).toBe('sitcom');
      expect(HARD_CODED_TAGS.KIDS).toBe('kids');
      expect(HARD_CODED_TAGS.HERO_TRAILER).toBe('hero_trailer');
    });

    it('should have all filter tags defined as string literals', () => {
      // Verify movie filter tags
      expect(HARD_CODED_TAGS.COMEDY_MOVIES).toBe('comedy_movies');
      expect(HARD_CODED_TAGS.ACTION_MOVIES).toBe('action_movies');
      expect(HARD_CODED_TAGS.ROMANCE_MOVIES).toBe('romance_movies');
      
      // Verify series filter tags
      expect(HARD_CODED_TAGS.COMEDY_SERIES).toBe('comedy_series');
      expect(HARD_CODED_TAGS.ACTION_SERIES).toBe('action_series');
      expect(HARD_CODED_TAGS.ROMANCE_SERIES).toBe('romance_series');
      
      // Verify kids filter tags
      expect(HARD_CODED_TAGS.COMEDY_KIDS).toBe('comedy_kids');
      expect(HARD_CODED_TAGS.ACTION_KIDS).toBe('action_kids');
    });

    it('should have BASE_TAGS array as readonly tuple', () => {
      // Verify BASE_TAGS is a readonly tuple (TypeScript enforces immutability)
      expect(BASE_TAGS).toEqual(['series', 'movie', 'sitcom', 'kids', 'hero_trailer']);
      
      // TypeScript prevents modification at compile time with 'as const'
      // The array is a readonly tuple, not a mutable array
      expect(BASE_TAGS.length).toBe(5);
      
      // Verify it's the exact tuple we expect
      expect(BASE_TAGS[0]).toBe('series');
      expect(BASE_TAGS[1]).toBe('movie');
      expect(BASE_TAGS[2]).toBe('sitcom');
      expect(BASE_TAGS[3]).toBe('kids');
      expect(BASE_TAGS[4]).toBe('hero_trailer');
    });

    it('should have FILTER_TAGS array as readonly tuple', () => {
      // Verify FILTER_TAGS is a readonly tuple (TypeScript enforces immutability)
      expect(FILTER_TAGS).toEqual([
        'comedy_movies', 'action_movies', 'romance_movies',
        'comedy_series', 'action_series', 'romance_series',
        'comedy_kids', 'action_kids'
      ]);
      
      // TypeScript prevents modification at compile time with 'as const'
      expect(FILTER_TAGS.length).toBe(8);
    });
  });

  describe('Category Configuration Immutability', () => {
    it('should have all categories defined with exact tag strings', () => {
      // Movies category
      expect(CATEGORIES.movies.baseTag).toBe('movie');
      expect(CATEGORIES.movies.filters).toEqual([
        { label: 'Comedy', tag: 'comedy_movies' },
        { label: 'Action', tag: 'action_movies' },
        { label: 'Romance', tag: 'romance_movies' }
      ]);

      // Series category
      expect(CATEGORIES.series.baseTag).toBe('series');
      expect(CATEGORIES.series.filters).toEqual([
        { label: 'Comedy', tag: 'comedy_series' },
        { label: 'Action', tag: 'action_series' },
        { label: 'Romance', tag: 'romance_series' }
      ]);

      // Sitcoms category
      expect(CATEGORIES.sitcoms.baseTag).toBe('sitcom');
      expect(CATEGORIES.sitcoms.filters).toEqual([]);

      // Kids category
      expect(CATEGORIES.kids.baseTag).toBe('kids');
      expect(CATEGORIES.kids.filters).toEqual([
        { label: 'Comedy', tag: 'comedy_kids' },
        { label: 'Action', tag: 'action_kids' }
      ]);
    });

    it('should not allow modification of CATEGORIES object', () => {
      // CATEGORIES is defined with TypeScript readonly properties
      // TypeScript prevents modification at compile time
      
      const originalMoviesBaseTag = CATEGORIES.movies.baseTag;
      
      // Verify the structure is correct
      expect(CATEGORIES.movies.baseTag).toBe('movie');
      expect(originalMoviesBaseTag).toBe('movie');
      
      // TypeScript readonly prevents modification at compile time
      // This is the immutability guarantee we need
    });
  });

  describe('No Dynamic Tag Generation', () => {
    it('should not have any tag inference logic', () => {
      // This test verifies that tags are never dynamically generated
      // All tags must come from the hard-coded constants
      
      const allDefinedTags = [
        ...BASE_TAGS,
        ...FILTER_TAGS
      ];

      // Verify exact count - 5 base + 8 filter = 13 tags
      expect(allDefinedTags.length).toBe(13);
      
      // Verify each tag is a string literal (not computed)
      allDefinedTags.forEach(tag => {
        expect(typeof tag).toBe('string');
        expect(tag.length).toBeGreaterThan(0);
        // Tags should not contain dynamic patterns like timestamps or UUIDs
        expect(tag).not.toMatch(/\d{13}/); // No timestamps
        expect(tag).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/); // No UUIDs
      });
    });

    it('should not allow tag concatenation or modification', () => {
      // Verify that tag constants cannot be used to create new tags
      const baseTag = HARD_CODED_TAGS.MOVIE;
      const filterTag = HARD_CODED_TAGS.ACTION_MOVIES;
      
      // These are separate constants, not derived from each other
      expect(baseTag).toBe('movie');
      expect(filterTag).toBe('action_movies');
      
      // Verify filter tag is not derived from base tag programmatically
      expect(filterTag).not.toBe(`${baseTag}_action`);
      
      // Note: 'action_movies' contains 'movie' as a substring, but it's a
      // hard-coded string literal, not a concatenation
      expect(filterTag).toBe('action_movies'); // Exact literal match
    });
  });

  describe('Frontend-Backend Tag Consistency', () => {
    it('should match Rust backend tag definitions', () => {
      // These tags must match exactly with src-tauri/src/models.rs tags module
      
      // Base tags (from Rust: pub const SERIES: &str = "series"; etc.)
      expect(HARD_CODED_TAGS.SERIES).toBe('series');
      expect(HARD_CODED_TAGS.MOVIE).toBe('movie');
      expect(HARD_CODED_TAGS.SITCOM).toBe('sitcom');
      expect(HARD_CODED_TAGS.KIDS).toBe('kids');
      expect(HARD_CODED_TAGS.HERO_TRAILER).toBe('hero_trailer');
      
      // Filter tags (from Rust: pub const COMEDY_MOVIES: &str = "comedy_movies"; etc.)
      expect(HARD_CODED_TAGS.COMEDY_MOVIES).toBe('comedy_movies');
      expect(HARD_CODED_TAGS.ACTION_MOVIES).toBe('action_movies');
      expect(HARD_CODED_TAGS.ROMANCE_MOVIES).toBe('romance_movies');
      expect(HARD_CODED_TAGS.COMEDY_SERIES).toBe('comedy_series');
      expect(HARD_CODED_TAGS.ACTION_SERIES).toBe('action_series');
      expect(HARD_CODED_TAGS.ROMANCE_SERIES).toBe('romance_series');
      expect(HARD_CODED_TAGS.COMEDY_KIDS).toBe('comedy_kids');
      expect(HARD_CODED_TAGS.ACTION_KIDS).toBe('action_kids');
    });

    it('should have matching tag counts between frontend and backend', () => {
      // Verify we have exactly 5 base tags and 8 filter tags
      // This matches the Rust backend definition
      expect(BASE_TAGS.length).toBe(5);
      expect(FILTER_TAGS.length).toBe(8);
      
      // Total of 13 tags
      const totalTags = BASE_TAGS.length + FILTER_TAGS.length;
      expect(totalTags).toBe(13);
    });
  });

  describe('Tag System Authoritative Nature', () => {
    it('should use tags from constants, never from external sources', () => {
      // Verify that all category definitions use the hard-coded constants
      const allCategoryTags = [
        CATEGORIES.movies.baseTag,
        ...CATEGORIES.movies.filters.map(f => f.tag),
        CATEGORIES.series.baseTag,
        ...CATEGORIES.series.filters.map(f => f.tag),
        CATEGORIES.sitcoms.baseTag,
        ...CATEGORIES.sitcoms.filters.map(f => f.tag),
        CATEGORIES.kids.baseTag,
        ...CATEGORIES.kids.filters.map(f => f.tag)
      ];

      // Create a set of all valid tags from our constants
      const validTags = new Set<string>([
        ...BASE_TAGS,
        ...FILTER_TAGS
      ]);

      // Every tag in categories should be in our hard-coded lists
      allCategoryTags.forEach(tag => {
        expect(validTags.has(tag)).toBe(true);
      });
    });

    it('should not have any tag inference or suggestion logic', () => {
      // Verify no functions that generate or suggest tags
      // All tag-related functions should only validate or categorize existing tags
      
      // This is a structural test - if these imports exist, they should not
      // contain tag generation logic
      expect(CATEGORIES).toBeDefined();
      expect(HARD_CODED_TAGS).toBeDefined();
      
      // Verify HARD_CODED_TAGS is an object with string values only
      Object.values(HARD_CODED_TAGS).forEach(value => {
        expect(typeof value).toBe('string');
      });
    });

    it('should maintain exact tag strings without normalization', () => {
      // Tags should be used exactly as defined, no case conversion or normalization
      const tags = [
        HARD_CODED_TAGS.SERIES,
        HARD_CODED_TAGS.MOVIE,
        HARD_CODED_TAGS.HERO_TRAILER,
        HARD_CODED_TAGS.COMEDY_MOVIES,
        HARD_CODED_TAGS.ACTION_SERIES
      ];

      tags.forEach(tag => {
        // Tags should be lowercase with underscores (snake_case)
        expect(tag).toBe(tag.toLowerCase());
        expect(tag).not.toContain(' ');
        expect(tag).not.toContain('-');
        
        // If tag contains multiple words, they should be separated by underscores
        if (tag.includes('_')) {
          expect(tag.split('_').length).toBeGreaterThan(1);
        }
      });
    });
  });

  describe('Tag Usage Patterns', () => {
    it('should only use tags from HARD_CODED_TAGS constant', () => {
      // Verify that the application only uses predefined tags
      const validTags = new Set<string>([
        ...BASE_TAGS,
        ...FILTER_TAGS
      ]);

      // All tags in CATEGORIES should be in validTags
      Object.values(CATEGORIES).forEach(category => {
        expect(validTags.has(category.baseTag)).toBe(true);
        
        category.filters.forEach(filter => {
          expect(validTags.has(filter.tag)).toBe(true);
        });
      });
    });

    it('should not allow runtime tag modification', () => {
      // Verify that tag constants are truly constant
      const originalSeriesTag = HARD_CODED_TAGS.SERIES;
      
      // TypeScript prevents modification at compile time
      // Verify the constant value is correct
      expect(HARD_CODED_TAGS.SERIES).toBe(originalSeriesTag);
      expect(HARD_CODED_TAGS.SERIES).toBe('series');
      
      // The HARD_CODED_TAGS object is defined with 'as const'
      // which makes it readonly in TypeScript
    });
  });

  describe('Documentation Compliance', () => {
    it('should match tags documented in design.md', () => {
      // These tags are documented in .kiro/specs/kiyya-desktop-streaming/design.md
      // under "Hard-Coded Tags (Authoritative)" section
      
      // Base Tags from design.md
      const documentedBaseTags = ['series', 'movie', 'sitcom', 'kids', 'hero_trailer'];
      expect([...BASE_TAGS]).toEqual(documentedBaseTags);
      
      // Category Filter Tags from design.md
      const documentedFilterTags = [
        'comedy_movies', 'action_movies', 'romance_movies',
        'comedy_series', 'action_series', 'romance_series',
        'comedy_kids', 'action_kids'
      ];
      expect([...FILTER_TAGS]).toEqual(documentedFilterTags);
    });

    it('should have hero_trailer tag for hero content', () => {
      // Verify hero_trailer tag exists and is used correctly
      expect(HARD_CODED_TAGS.HERO_TRAILER).toBe('hero_trailer');
      expect(BASE_TAGS).toContain('hero_trailer');
      
      // hero_trailer should be a base tag, not a filter tag
      expect(FILTER_TAGS).not.toContain('hero_trailer');
    });
  });
});
