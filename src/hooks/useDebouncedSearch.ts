import { useState, useEffect, useCallback, useMemo } from 'react';
import { ContentItem, ApiError } from '../types';
import { searchContent, fetchChannelClaims } from '../lib/api';
import { sanitizeSearchInput } from '../lib/search';

/**
 * Debounced search hook with non-blocking remote operations
 * 
 * CRITICAL: This hook ensures that remote search operations never block the UI.
 * The async/await pattern combined with React's state updates ensures that:
 * 1. Loading state is set immediately for UI feedback
 * 2. Remote API calls execute asynchronously
 * 3. UI remains responsive during search operations
 * 4. State updates trigger re-renders without blocking
 * 
 * Features:
 * - Debounced search with configurable delay
 * - Session-based caching (memory only, 30-minute TTL)
 * - Fallback to recent uploads when no results found
 * - Non-blocking remote operations
 * - Loading states for UI feedback
 */

interface UseDebouncedSearchOptions {
  delay?: number;
  minLength?: number;
  fallbackToRecent?: boolean;
}

interface SearchState {
  query: string;
  results: ContentItem[];
  loading: boolean;
  error: ApiError | null;
  hasSearched: boolean;
  fallbackResults: ContentItem[];
  showingFallback: boolean;
}

interface CachedSearchResult {
  results: ContentItem[];
  fallbackResults: ContentItem[];
  showingFallback: boolean;
  timestamp: number;
}

// Session-only search cache (memory only, cleared on page refresh)
const searchCache = new Map<string, CachedSearchResult>();

// Cache TTL in milliseconds (session duration, but with reasonable limit)
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Get cached search results if available and not expired
 */
function getCachedResults(query: string): CachedSearchResult | null {
  const cached = searchCache.get(query);
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    // Cache expired, remove it
    searchCache.delete(query);
    return null;
  }

  return cached;
}

/**
 * Store search results in cache
 */
function setCachedResults(
  query: string,
  results: ContentItem[],
  fallbackResults: ContentItem[],
  showingFallback: boolean
): void {
  searchCache.set(query, {
    results,
    fallbackResults,
    showingFallback,
    timestamp: Date.now(),
  });
}

/**
 * Clear all cached search results
 */
export function clearSearchCache(): void {
  searchCache.clear();
}

export function useDebouncedSearch(options: UseDebouncedSearchOptions = {}) {
  const { delay = 300, minLength = 2, fallbackToRecent = true } = options;
  
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    results: [],
    loading: false,
    error: null,
    hasSearched: false,
    fallbackResults: [],
    showingFallback: false,
  });

  // Debounced search function
  const performSearch = useCallback(async (query: string) => {
    const sanitizedQuery = sanitizeSearchInput(query);
    
    if (!sanitizedQuery || sanitizedQuery.length < minLength) {
      setSearchState(prev => ({
        ...prev,
        results: [],
        loading: false,
        error: null,
        hasSearched: false,
        showingFallback: false,
      }));
      return;
    }

    // Check cache first (synchronous operation, doesn't block UI)
    const cached = getCachedResults(sanitizedQuery);
    if (cached) {
      setSearchState(prev => ({
        ...prev,
        results: cached.results,
        fallbackResults: cached.fallbackResults,
        loading: false,
        hasSearched: true,
        showingFallback: cached.showingFallback,
        error: null,
      }));
      return;
    }

    // Set loading state immediately to show UI feedback
    setSearchState(prev => ({
      ...prev,
      loading: true,
      error: null,
      showingFallback: false,
    }));

    // Perform search asynchronously without blocking UI
    // The async/await pattern ensures the search runs without blocking the main thread
    try {
      // Perform the search (remote operation)
      const searchResults = await searchContent(sanitizedQuery, 50);
      
      if (searchResults.length === 0 && fallbackToRecent) {
        // No results found, fetch recent uploads as fallback (remote operation)
        const fallbackResults = await fetchChannelClaims({ 
          limit: 10, 
          page: 1 
        });

        // Cache the results
        setCachedResults(sanitizedQuery, [], fallbackResults, true);

        setSearchState(prev => ({
          ...prev,
          results: [],
          fallbackResults,
          loading: false,
          hasSearched: true,
          showingFallback: true,
        }));
      } else {
        // Cache the results
        setCachedResults(sanitizedQuery, searchResults, [], false);

        setSearchState(prev => ({
          ...prev,
          results: searchResults,
          fallbackResults: [],
          loading: false,
          hasSearched: true,
          showingFallback: false,
        }));
      }

    } catch (err) {
      const apiError: ApiError = {
        message: err instanceof Error ? err.message : 'Search failed',
        details: err,
      };

      setSearchState(prev => ({
        ...prev,
        results: [],
        fallbackResults: [],
        loading: false,
        error: apiError,
        hasSearched: true,
        showingFallback: false,
      }));
    }
  }, [minLength, fallbackToRecent]);

  // Debounce the search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchState.query) {
        performSearch(searchState.query);
      }
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [searchState.query, delay, performSearch]);

  // Update query
  const setQuery = useCallback((query: string) => {
    setSearchState(prev => ({
      ...prev,
      query,
      // Clear results immediately when query changes
      results: query.length >= minLength ? prev.results : [],
      fallbackResults: query.length >= minLength ? prev.fallbackResults : [],
      showingFallback: query.length >= minLength ? prev.showingFallback : false,
      hasSearched: query.length >= minLength ? prev.hasSearched : false,
      error: null,
    }));
  }, [minLength]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchState({
      query: '',
      results: [],
      loading: false,
      error: null,
      hasSearched: false,
      fallbackResults: [],
      showingFallback: false,
    });
  }, []);

  // Retry search
  const retrySearch = useCallback(() => {
    if (searchState.query) {
      performSearch(searchState.query);
    }
  }, [searchState.query, performSearch]);

  // Get search suggestions based on current query
  const suggestions = useMemo(() => {
    if (!searchState.query || searchState.query.length < 1) {
      return [];
    }

    const query = searchState.query.toLowerCase();
    const commonSuggestions = [
      'comedy movies',
      'action movies',
      'romance movies',
      'comedy series',
      'action series',
      'romance series',
      'sitcoms',
      'kids comedy',
      'kids action',
      'season 1',
      'season 2',
      'episode 1',
    ];

    return commonSuggestions
      .filter(suggestion => suggestion.includes(query))
      .slice(0, 5);
  }, [searchState.query]);

  // Check if currently searching
  const isSearching = searchState.loading;

  // Check if there are any results to show
  const hasResults = (searchState.results?.length || 0) > 0 || (searchState.fallbackResults?.length || 0) > 0;

  // Get the display results (either search results or fallback)
  const displayResults = searchState.showingFallback ? (searchState.fallbackResults || []) : (searchState.results || []);

  // Get search status message
  const getStatusMessage = useCallback(() => {
    if (searchState.loading) {
      return 'Searching...';
    }
    
    if (searchState.error) {
      return `Search failed: ${searchState.error.message}`;
    }
    
    if (!searchState.hasSearched) {
      return '';
    }
    
    if (searchState.showingFallback) {
      return 'No exact matches found. Here are some recent uploads you might like:';
    }
    
    if (searchState.results.length === 0) {
      return 'No results found. Try a different search term.';
    }
    
    return `Found ${searchState.results.length} result${searchState.results.length === 1 ? '' : 's'}`;
  }, [searchState]);

  return {
    // State
    query: searchState.query,
    results: displayResults,
    loading: isSearching,
    error: searchState.error,
    hasSearched: searchState.hasSearched,
    showingFallback: searchState.showingFallback,
    hasResults,
    
    // Actions
    setQuery,
    clearSearch,
    retrySearch,
    
    // Helpers
    suggestions,
    statusMessage: getStatusMessage(),
    
    // Raw state for advanced usage
    rawState: searchState,
  };
}

// Hook for search history management
export function useSearchHistory(maxItems: number = 10) {
  const [history, setHistory] = useState<string[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('kiyya-search-history');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setHistory(parsed.slice(0, maxItems));
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [maxItems]);

  // Save history to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('kiyya-search-history', JSON.stringify(history));
    } catch {
      // Ignore localStorage errors
    }
  }, [history]);

  const addToHistory = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;

    setHistory(prev => {
      // Remove existing entry if present
      const filtered = prev.filter(item => item !== trimmed);
      // Add to beginning and limit to maxItems
      return [trimmed, ...filtered].slice(0, maxItems);
    });
  }, [maxItems]);

  const removeFromHistory = useCallback((query: string) => {
    setHistory(prev => prev.filter(item => item !== query));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
  };
}

// Hook for search filters
export function useSearchFilters() {
  const [filters, setFilters] = useState({
    category: '',
    quality: '',
    duration: '',
    sortBy: 'relevance',
  });

  const updateFilter = useCallback((key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      category: '',
      quality: '',
      duration: '',
      sortBy: 'relevance',
    });
  }, []);

  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(value => value && value !== 'relevance');
  }, [filters]);

  return {
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
  };
}