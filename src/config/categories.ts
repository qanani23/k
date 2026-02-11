import { CategoryConfig, FilterDefinition } from '../types';

/**
 * Category configuration - single source of truth for content categorization
 * 
 * This configuration drives:
 * - NavBar dropdown rendering
 * - Content filtering and discovery
 * - Tag-based API queries
 * 
 * IMPORTANT: Tag names must match exactly with the hard-coded tags used
 * throughout the application and expected by content uploaders.
 */
export const CATEGORIES: CategoryConfig = {
  movies: {
    label: "Movies",
    baseTag: "movie",
    filters: [
      { label: "Comedy", tag: "comedy_movies" },
      { label: "Action", tag: "action_movies" },
      { label: "Romance", tag: "romance_movies" }
    ]
  },
  series: {
    label: "Series",
    baseTag: "series",
    filters: [
      { label: "Comedy", tag: "comedy_series" },
      { label: "Action", tag: "action_series" },
      { label: "Romance", tag: "romance_series" }
    ]
  },
  sitcoms: {
    label: "Sitcoms",
    baseTag: "sitcom",
    filters: []
  },
  kids: {
    label: "Kids",
    baseTag: "kids",
    filters: [
      { label: "Comedy", tag: "comedy_kids" },
      { label: "Action", tag: "action_kids" }
    ]
  }
};

/**
 * Hard-coded tags used throughout the application
 * These must match exactly with the tags expected by the backend
 */
export const HARD_CODED_TAGS = {
  // Base content type tags
  SERIES: 'series',
  MOVIE: 'movie',
  SITCOM: 'sitcom',
  KIDS: 'kids',
  HERO_TRAILER: 'hero_trailer',
  
  // Category filter tags
  COMEDY_MOVIES: 'comedy_movies',
  ACTION_MOVIES: 'action_movies',
  ROMANCE_MOVIES: 'romance_movies',
  COMEDY_SERIES: 'comedy_series',
  ACTION_SERIES: 'action_series',
  ROMANCE_SERIES: 'romance_series',
  COMEDY_KIDS: 'comedy_kids',
  ACTION_KIDS: 'action_kids',
} as const;

/**
 * Get all available category keys
 */
export const getCategoryKeys = (): (keyof CategoryConfig)[] => {
  return Object.keys(CATEGORIES) as (keyof CategoryConfig)[];
};

/**
 * Get category definition by key
 */
export const getCategory = (key: keyof CategoryConfig) => {
  return CATEGORIES[key];
};

/**
 * Get all filter tags for a category
 */
export const getCategoryFilterTags = (key: keyof CategoryConfig): string[] => {
  const category = CATEGORIES[key];
  return category.filters.map((filter: FilterDefinition) => filter.tag);
};

/**
 * Get all tags for a category (base tag + filter tags)
 */
export const getAllCategoryTags = (key: keyof CategoryConfig): string[] => {
  const category = CATEGORIES[key];
  return [category.baseTag, ...getCategoryFilterTags(key)];
};

/**
 * Find category by tag
 */
export const findCategoryByTag = (tag: string): keyof CategoryConfig | null => {
  for (const [key, category] of Object.entries(CATEGORIES)) {
    if (category.baseTag === tag || category.filters.some((filter: FilterDefinition) => filter.tag === tag)) {
      return key as keyof CategoryConfig;
    }
  }
  return null;
};

/**
 * Check if a tag is a base category tag
 */
export const isBaseTag = (tag: string): boolean => {
  return Object.values(CATEGORIES).some(category => category.baseTag === tag);
};

/**
 * Check if a tag is a filter tag
 */
export const isFilterTag = (tag: string): boolean => {
  return Object.values(CATEGORIES).some(category => 
    category.filters.some((filter: FilterDefinition) => filter.tag === tag)
  );
};

/**
 * Get the base tag for a given filter tag
 */
export const getBaseTagForFilter = (filterTag: string): string | null => {
  for (const category of Object.values(CATEGORIES)) {
    if (category.filters.some((filter: FilterDefinition) => filter.tag === filterTag)) {
      return category.baseTag;
    }
  }
  return null;
};