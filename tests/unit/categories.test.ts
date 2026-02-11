import { describe, it, expect } from 'vitest';
import {
  CATEGORIES,
  HARD_CODED_TAGS,
  getCategoryKeys,
  getCategory,
  getCategoryFilterTags,
  getAllCategoryTags,
  findCategoryByTag,
  isBaseTag,
  isFilterTag,
  getBaseTagForFilter,
} from '../../src/config/categories';

describe('Categories Configuration', () => {
  describe('CATEGORIES structure', () => {
    it('should have all required category keys', () => {
      const keys = Object.keys(CATEGORIES);
      expect(keys).toContain('movies');
      expect(keys).toContain('series');
      expect(keys).toContain('sitcoms');
      expect(keys).toContain('kids');
    });

    it('should have correct base tags matching design document', () => {
      expect(CATEGORIES.movies.baseTag).toBe('movie');
      expect(CATEGORIES.series.baseTag).toBe('series');
      expect(CATEGORIES.sitcoms.baseTag).toBe('sitcom');
      expect(CATEGORIES.kids.baseTag).toBe('kids');
    });

    it('should have correct filter tags for movies', () => {
      const movieFilters = CATEGORIES.movies.filters.map(f => f.tag);
      expect(movieFilters).toEqual(['comedy_movies', 'action_movies', 'romance_movies']);
    });

    it('should have correct filter tags for series', () => {
      const seriesFilters = CATEGORIES.series.filters.map(f => f.tag);
      expect(seriesFilters).toEqual(['comedy_series', 'action_series', 'romance_series']);
    });

    it('should have correct filter tags for kids', () => {
      const kidsFilters = CATEGORIES.kids.filters.map(f => f.tag);
      expect(kidsFilters).toEqual(['comedy_kids', 'action_kids']);
    });

    it('should have no filters for sitcoms', () => {
      expect(CATEGORIES.sitcoms.filters).toEqual([]);
    });
  });

  describe('HARD_CODED_TAGS', () => {
    it('should have all base tags', () => {
      expect(HARD_CODED_TAGS.SERIES).toBe('series');
      expect(HARD_CODED_TAGS.MOVIE).toBe('movie');
      expect(HARD_CODED_TAGS.SITCOM).toBe('sitcom');
      expect(HARD_CODED_TAGS.KIDS).toBe('kids');
      expect(HARD_CODED_TAGS.HERO_TRAILER).toBe('hero_trailer');
    });

    it('should have all filter tags', () => {
      expect(HARD_CODED_TAGS.COMEDY_MOVIES).toBe('comedy_movies');
      expect(HARD_CODED_TAGS.ACTION_MOVIES).toBe('action_movies');
      expect(HARD_CODED_TAGS.ROMANCE_MOVIES).toBe('romance_movies');
      expect(HARD_CODED_TAGS.COMEDY_SERIES).toBe('comedy_series');
      expect(HARD_CODED_TAGS.ACTION_SERIES).toBe('action_series');
      expect(HARD_CODED_TAGS.ROMANCE_SERIES).toBe('romance_series');
      expect(HARD_CODED_TAGS.COMEDY_KIDS).toBe('comedy_kids');
      expect(HARD_CODED_TAGS.ACTION_KIDS).toBe('action_kids');
    });
  });

  describe('getCategoryKeys', () => {
    it('should return all category keys', () => {
      const keys = getCategoryKeys();
      expect(keys).toEqual(['movies', 'series', 'sitcoms', 'kids']);
    });
  });

  describe('getCategory', () => {
    it('should return correct category definition', () => {
      const movies = getCategory('movies');
      expect(movies.label).toBe('Movies');
      expect(movies.baseTag).toBe('movie');
      expect(movies.filters.length).toBe(3);
    });
  });

  describe('getCategoryFilterTags', () => {
    it('should return filter tags for movies', () => {
      const tags = getCategoryFilterTags('movies');
      expect(tags).toEqual(['comedy_movies', 'action_movies', 'romance_movies']);
    });

    it('should return empty array for sitcoms', () => {
      const tags = getCategoryFilterTags('sitcoms');
      expect(tags).toEqual([]);
    });
  });

  describe('getAllCategoryTags', () => {
    it('should return base tag and filter tags for movies', () => {
      const tags = getAllCategoryTags('movies');
      expect(tags).toEqual(['movie', 'comedy_movies', 'action_movies', 'romance_movies']);
    });

    it('should return only base tag for sitcoms', () => {
      const tags = getAllCategoryTags('sitcoms');
      expect(tags).toEqual(['sitcom']);
    });
  });

  describe('findCategoryByTag', () => {
    it('should find category by base tag', () => {
      expect(findCategoryByTag('movie')).toBe('movies');
      expect(findCategoryByTag('series')).toBe('series');
      expect(findCategoryByTag('sitcom')).toBe('sitcoms');
      expect(findCategoryByTag('kids')).toBe('kids');
    });

    it('should find category by filter tag', () => {
      expect(findCategoryByTag('comedy_movies')).toBe('movies');
      expect(findCategoryByTag('action_series')).toBe('series');
      expect(findCategoryByTag('comedy_kids')).toBe('kids');
    });

    it('should return null for unknown tag', () => {
      expect(findCategoryByTag('unknown_tag')).toBeNull();
    });
  });

  describe('isBaseTag', () => {
    it('should return true for base tags', () => {
      expect(isBaseTag('movie')).toBe(true);
      expect(isBaseTag('series')).toBe(true);
      expect(isBaseTag('sitcom')).toBe(true);
      expect(isBaseTag('kids')).toBe(true);
    });

    it('should return false for filter tags', () => {
      expect(isBaseTag('comedy_movies')).toBe(false);
      expect(isBaseTag('action_series')).toBe(false);
    });

    it('should return false for unknown tags', () => {
      expect(isBaseTag('unknown')).toBe(false);
    });
  });

  describe('isFilterTag', () => {
    it('should return true for filter tags', () => {
      expect(isFilterTag('comedy_movies')).toBe(true);
      expect(isFilterTag('action_movies')).toBe(true);
      expect(isFilterTag('romance_series')).toBe(true);
      expect(isFilterTag('comedy_kids')).toBe(true);
    });

    it('should return false for base tags', () => {
      expect(isFilterTag('movie')).toBe(false);
      expect(isFilterTag('series')).toBe(false);
    });

    it('should return false for unknown tags', () => {
      expect(isFilterTag('unknown')).toBe(false);
    });
  });

  describe('getBaseTagForFilter', () => {
    it('should return correct base tag for filter tags', () => {
      expect(getBaseTagForFilter('comedy_movies')).toBe('movie');
      expect(getBaseTagForFilter('action_movies')).toBe('movie');
      expect(getBaseTagForFilter('romance_series')).toBe('series');
      expect(getBaseTagForFilter('comedy_kids')).toBe('kids');
    });

    it('should return null for base tags', () => {
      expect(getBaseTagForFilter('movie')).toBeNull();
      expect(getBaseTagForFilter('series')).toBeNull();
    });

    it('should return null for unknown tags', () => {
      expect(getBaseTagForFilter('unknown')).toBeNull();
    });
  });
});
