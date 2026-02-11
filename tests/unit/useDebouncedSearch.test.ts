import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDebouncedSearch, useSearchHistory, useSearchFilters } from '../../src/hooks/useDebouncedSearch';
import * as api from '../../src/lib/api';
import * as search from '../../src/lib/search';

// Mock the API and search modules
vi.mock('../../src/lib/api');
vi.mock('../../src/lib/search');

// Import clearSearchCache after mocking
import { clearSearchCache } from '../../src/hooks/useDebouncedSearch';

describe('useDebouncedSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    clearSearchCache(); // Clear cache before each test
    
    // Mock sanitizeSearchInput to return the input as-is for testing
    vi.mocked(search.sanitizeSearchInput).mockImplementation((input: string) => input);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Functionality', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useDebouncedSearch());

      expect(result.current.query).toBe('');
      expect(result.current.results).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.hasSearched).toBe(false);
      expect(result.current.showingFallback).toBe(false);
    });

    it('should update query when setQuery is called', () => {
      const { result } = renderHook(() => useDebouncedSearch());

      act(() => {
        result.current.setQuery('test query');
      });

      expect(result.current.query).toBe('test query');
    });

    it('should clear search state when clearSearch is called', async () => {
      const { result } = renderHook(() => useDebouncedSearch());

      act(() => {
        result.current.setQuery('test query');
      });

      expect(result.current.query).toBe('test query');

      act(() => {
        result.current.clearSearch();
      });

      expect(result.current.query).toBe('');
      expect(result.current.results).toEqual([]);
      expect(result.current.hasSearched).toBe(false);
    });
  });

  describe('Debouncing', () => {
    it('should debounce search requests', async () => {
      const mockSearchContent = vi.mocked(api.searchContent);
      mockSearchContent.mockResolvedValue([
        {
          claim_id: '1',
          title: 'Test Movie',
          tags: ['movie'],
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false },
          release_time: Date.now(),
        },
      ]);

      const { result } = renderHook(() => useDebouncedSearch({ delay: 300 }));

      // Type multiple characters quickly
      act(() => {
        result.current.setQuery('t');
      });
      
      act(() => {
        vi.advanceTimersByTime(100);
      });

      act(() => {
        result.current.setQuery('te');
      });
      
      act(() => {
        vi.advanceTimersByTime(100);
      });

      act(() => {
        result.current.setQuery('tes');
      });

      // Search should not have been called yet
      expect(mockSearchContent).not.toHaveBeenCalled();

      // Wait for debounce delay
      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(mockSearchContent).toHaveBeenCalledTimes(1);
      });
    });

    it('should respect custom delay option', async () => {
      const mockSearchContent = vi.mocked(api.searchContent);
      mockSearchContent.mockResolvedValue([]);

      const { result } = renderHook(() => useDebouncedSearch({ delay: 500 }));

      act(() => {
        result.current.setQuery('test');
      });

      act(() => {
        vi.advanceTimersByTime(400);
      });

      expect(mockSearchContent).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(mockSearchContent).toHaveBeenCalled();
      });
    });
  });

  describe('Minimum Length', () => {
    it('should not search when query is below minimum length', async () => {
      const mockSearchContent = vi.mocked(api.searchContent);
      mockSearchContent.mockResolvedValue([]);

      const { result } = renderHook(() => useDebouncedSearch({ minLength: 3 }));

      act(() => {
        result.current.setQuery('ab');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(mockSearchContent).not.toHaveBeenCalled();
      });
    });

    it('should search when query meets minimum length', async () => {
      const mockSearchContent = vi.mocked(api.searchContent);
      mockSearchContent.mockResolvedValue([]);

      const { result } = renderHook(() => useDebouncedSearch({ minLength: 3 }));

      act(() => {
        result.current.setQuery('abc');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(mockSearchContent).toHaveBeenCalled();
      });
    });
  });

  describe('Search Results', () => {
    it('should display search results when found', async () => {
      const mockResults = [
        {
          claim_id: '1',
          title: 'Test Movie 1',
          tags: ['movie'],
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false },
          release_time: Date.now(),
        },
        {
          claim_id: '2',
          title: 'Test Movie 2',
          tags: ['movie'],
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false },
          release_time: Date.now(),
        },
      ];

      const mockSearchContent = vi.mocked(api.searchContent);
      mockSearchContent.mockResolvedValue(mockResults);

      const { result } = renderHook(() => useDebouncedSearch());

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.results).toEqual(mockResults);
        expect(result.current.hasSearched).toBe(true);
        expect(result.current.showingFallback).toBe(false);
      });
    });

    it('should show loading state during search', async () => {
      const mockSearchContent = vi.mocked(api.searchContent);
      mockSearchContent.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([]), 1000)));

      const { result } = renderHook(() => useDebouncedSearch());

      act(() => {
        result.current.setQuery('test');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });
    });
  });

  describe('Fallback to Recent Content', () => {
    it('should fetch recent content when no results found and fallback enabled', async () => {
      const mockSearchContent = vi.mocked(api.searchContent);
      const mockFetchChannelClaims = vi.mocked(api.fetchChannelClaims);
      
      mockSearchContent.mockResolvedValue([]);
      mockFetchChannelClaims.mockResolvedValue([
        {
          claim_id: '1',
          title: 'Recent Upload',
          tags: ['movie'],
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false },
          release_time: Date.now(),
        },
      ]);

      const { result } = renderHook(() => useDebouncedSearch({ fallbackToRecent: true }));

      act(() => {
        result.current.setQuery('nonexistent');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(mockFetchChannelClaims).toHaveBeenCalledWith({ limit: 10, page: 1 });
        expect(result.current.showingFallback).toBe(true);
        expect(result.current.results.length).toBe(1);
      });
    });

    it('should not fetch fallback when disabled', async () => {
      const mockSearchContent = vi.mocked(api.searchContent);
      const mockFetchChannelClaims = vi.mocked(api.fetchChannelClaims);
      
      mockSearchContent.mockResolvedValue([]);

      const { result } = renderHook(() => useDebouncedSearch({ fallbackToRecent: false }));

      act(() => {
        result.current.setQuery('test');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(mockFetchChannelClaims).not.toHaveBeenCalled();
        expect(result.current.showingFallback).toBe(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle search errors gracefully', async () => {
      const mockSearchContent = vi.mocked(api.searchContent);
      mockSearchContent.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useDebouncedSearch());

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
        expect(result.current.error?.message).toBe('Network error');
        expect(result.current.loading).toBe(false);
      });
    });

    it('should allow retry after error', async () => {
      const mockSearchContent = vi.mocked(api.searchContent);
      mockSearchContent.mockRejectedValueOnce(new Error('Network error'));
      mockSearchContent.mockResolvedValueOnce([
        {
          claim_id: '1',
          title: 'Test Movie',
          tags: ['movie'],
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false },
          release_time: Date.now(),
        },
      ]);

      const { result } = renderHook(() => useDebouncedSearch());

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      await act(async () => {
        result.current.retrySearch();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
        expect(result.current.results.length).toBe(1);
      });
    });
  });

  describe('Search Suggestions', () => {
    it('should provide search suggestions based on query', () => {
      const { result } = renderHook(() => useDebouncedSearch());

      act(() => {
        result.current.setQuery('comedy');
      });

      expect(result.current.suggestions).toContain('comedy movies');
      expect(result.current.suggestions).toContain('comedy series');
    });

    it('should limit suggestions to 5 items', () => {
      const { result } = renderHook(() => useDebouncedSearch());

      act(() => {
        result.current.setQuery('s');
      });

      expect(result.current.suggestions.length).toBeLessThanOrEqual(5);
    });

    it('should return empty suggestions for empty query', () => {
      const { result } = renderHook(() => useDebouncedSearch());

      expect(result.current.suggestions).toEqual([]);
    });
  });

  describe('Status Messages', () => {
    it('should show searching message when loading', async () => {
      const mockSearchContent = vi.mocked(api.searchContent);
      mockSearchContent.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([]), 1000)));

      const { result } = renderHook(() => useDebouncedSearch());

      act(() => {
        result.current.setQuery('test');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.statusMessage).toBe('Searching...');
      });
    });

    it('should show results count message', async () => {
      const mockSearchContent = vi.mocked(api.searchContent);
      mockSearchContent.mockResolvedValue([
        {
          claim_id: '1',
          title: 'Test Movie',
          tags: ['movie'],
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false },
          release_time: Date.now(),
        },
      ]);

      const { result } = renderHook(() => useDebouncedSearch());

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.statusMessage).toBe('Found 1 result');
      });
    });

    it('should show fallback message when showing fallback results', async () => {
      const mockSearchContent = vi.mocked(api.searchContent);
      const mockFetchChannelClaims = vi.mocked(api.fetchChannelClaims);
      
      mockSearchContent.mockResolvedValue([]);
      mockFetchChannelClaims.mockResolvedValue([
        {
          claim_id: '1',
          title: 'Recent Upload',
          tags: ['movie'],
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false },
          release_time: Date.now(),
        },
      ]);

      const { result } = renderHook(() => useDebouncedSearch({ fallbackToRecent: true }));

      act(() => {
        result.current.setQuery('nonexistent');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.statusMessage).toBe('No exact matches found. Here are some recent uploads you might like:');
      });
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize search input', async () => {
      const mockSearchContent = vi.mocked(api.searchContent);
      const mockSanitize = vi.mocked(search.sanitizeSearchInput);
      
      mockSanitize.mockReturnValue('sanitized query');
      mockSearchContent.mockResolvedValue([]);

      const { result } = renderHook(() => useDebouncedSearch());

      act(() => {
        result.current.setQuery('test query');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(mockSanitize).toHaveBeenCalledWith('test query');
      });
    });
  });

  describe('Search Result Caching', () => {
    it('should cache search results in memory', async () => {
      const mockResults = [
        {
          claim_id: '1',
          title: 'Test Movie',
          tags: ['movie'],
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false },
          release_time: Date.now(),
        },
      ];

      const mockSearchContent = vi.mocked(api.searchContent);
      mockSearchContent.mockResolvedValue(mockResults);

      const { result } = renderHook(() => useDebouncedSearch());

      // First search
      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(mockSearchContent).toHaveBeenCalledTimes(1);
        expect(result.current.results).toEqual(mockResults);
      });

      // Clear query
      act(() => {
        result.current.setQuery('');
      });

      // Search again with same query - should use cache
      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      await waitFor(() => {
        // Should still be called only once (cached)
        expect(mockSearchContent).toHaveBeenCalledTimes(1);
        expect(result.current.results).toEqual(mockResults);
      });
    });

    it('should cache fallback results', async () => {
      const mockFallback = [
        {
          claim_id: '2',
          title: 'Recent Upload',
          tags: ['movie'],
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false },
          release_time: Date.now(),
        },
      ];

      const mockSearchContent = vi.mocked(api.searchContent);
      const mockFetchChannelClaims = vi.mocked(api.fetchChannelClaims);
      
      mockSearchContent.mockResolvedValue([]);
      mockFetchChannelClaims.mockResolvedValue(mockFallback);

      const { result } = renderHook(() => useDebouncedSearch({ fallbackToRecent: true }));

      // First search
      act(() => {
        result.current.setQuery('nonexistent');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(mockSearchContent).toHaveBeenCalledTimes(1);
        expect(mockFetchChannelClaims).toHaveBeenCalledTimes(1);
        expect(result.current.showingFallback).toBe(true);
      });

      // Clear and search again
      act(() => {
        result.current.setQuery('');
      });

      act(() => {
        result.current.setQuery('nonexistent');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      await waitFor(() => {
        // Should use cached results
        expect(mockSearchContent).toHaveBeenCalledTimes(1);
        expect(mockFetchChannelClaims).toHaveBeenCalledTimes(1);
        expect(result.current.results).toEqual(mockFallback);
        expect(result.current.showingFallback).toBe(true);
      });
    });

    it('should cache different queries separately', async () => {
      const mockResults1 = [
        {
          claim_id: '1',
          title: 'Test Movie 1',
          tags: ['movie'],
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false },
          release_time: Date.now(),
        },
      ];

      const mockResults2 = [
        {
          claim_id: '2',
          title: 'Test Movie 2',
          tags: ['movie'],
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false },
          release_time: Date.now(),
        },
      ];

      const mockSearchContent = vi.mocked(api.searchContent);
      mockSearchContent.mockResolvedValueOnce(mockResults1);
      mockSearchContent.mockResolvedValueOnce(mockResults2);

      const { result } = renderHook(() => useDebouncedSearch());

      // First search
      act(() => {
        result.current.setQuery('test1');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.results).toEqual(mockResults1);
      });

      // Second search with different query
      act(() => {
        result.current.setQuery('test2');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(mockSearchContent).toHaveBeenCalledTimes(2);
        expect(result.current.results).toEqual(mockResults2);
      });

      // Go back to first query - should use cache
      act(() => {
        result.current.setQuery('test1');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(mockSearchContent).toHaveBeenCalledTimes(2);
        expect(result.current.results).toEqual(mockResults1);
      });
    });

    it('should not cache errors', async () => {
      const mockSearchContent = vi.mocked(api.searchContent);
      mockSearchContent.mockRejectedValueOnce(new Error('Network error'));
      mockSearchContent.mockResolvedValueOnce([
        {
          claim_id: '1',
          title: 'Test Movie',
          tags: ['movie'],
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false },
          release_time: Date.now(),
        },
      ]);

      const { result } = renderHook(() => useDebouncedSearch());

      // First search - error
      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      // Clear and search again - should retry, not use cached error
      act(() => {
        result.current.setQuery('');
      });

      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(mockSearchContent).toHaveBeenCalledTimes(2);
        expect(result.current.error).toBeNull();
        expect(result.current.results.length).toBe(1);
      });
    });

    it('should return cached results immediately without loading state', async () => {
      const mockResults = [
        {
          claim_id: '1',
          title: 'Test Movie',
          tags: ['movie'],
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false },
          release_time: Date.now(),
        },
      ];

      const mockSearchContent = vi.mocked(api.searchContent);
      mockSearchContent.mockResolvedValue(mockResults);

      const { result } = renderHook(() => useDebouncedSearch());

      // First search
      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.results).toEqual(mockResults);
        expect(result.current.loading).toBe(false);
      });

      // Clear query
      act(() => {
        result.current.setQuery('');
      });

      // Search again - should use cache and not show loading
      act(() => {
        result.current.setQuery('test');
      });

      // Check immediately after debounce
      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.results).toEqual(mockResults);
      });
    });
  });
});

describe('useSearchHistory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should initialize with empty history', () => {
    const { result } = renderHook(() => useSearchHistory());

    expect(result.current.history).toEqual([]);
  });

  it('should add items to history', () => {
    const { result } = renderHook(() => useSearchHistory());

    act(() => {
      result.current.addToHistory('test query');
    });

    expect(result.current.history).toContain('test query');
  });

  it('should not add empty or short queries to history', () => {
    const { result } = renderHook(() => useSearchHistory());

    act(() => {
      result.current.addToHistory('');
      result.current.addToHistory('a');
    });

    expect(result.current.history).toEqual([]);
  });

  it('should limit history to maxItems', () => {
    const { result } = renderHook(() => useSearchHistory(3));

    act(() => {
      result.current.addToHistory('query 1');
      result.current.addToHistory('query 2');
      result.current.addToHistory('query 3');
      result.current.addToHistory('query 4');
    });

    expect(result.current.history.length).toBe(3);
    expect(result.current.history[0]).toBe('query 4');
  });

  it('should remove duplicates and move to front', () => {
    const { result } = renderHook(() => useSearchHistory());

    act(() => {
      result.current.addToHistory('query 1');
      result.current.addToHistory('query 2');
      result.current.addToHistory('query 1');
    });

    expect(result.current.history).toEqual(['query 1', 'query 2']);
  });

  it('should remove items from history', () => {
    const { result } = renderHook(() => useSearchHistory());

    act(() => {
      result.current.addToHistory('query 1');
      result.current.addToHistory('query 2');
    });

    act(() => {
      result.current.removeFromHistory('query 1');
    });

    expect(result.current.history).toEqual(['query 2']);
  });

  it('should clear all history', () => {
    const { result } = renderHook(() => useSearchHistory());

    act(() => {
      result.current.addToHistory('query 1');
      result.current.addToHistory('query 2');
    });

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.history).toEqual([]);
  });

  it('should persist history to localStorage', () => {
    const { result } = renderHook(() => useSearchHistory());

    act(() => {
      result.current.addToHistory('test query');
    });

    const stored = localStorage.getItem('kiyya-search-history');
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toContain('test query');
  });

  it('should load history from localStorage on mount', () => {
    localStorage.setItem('kiyya-search-history', JSON.stringify(['stored query']));

    const { result } = renderHook(() => useSearchHistory());

    expect(result.current.history).toContain('stored query');
  });
});

describe('useSearchFilters', () => {
  it('should initialize with default filters', () => {
    const { result } = renderHook(() => useSearchFilters());

    expect(result.current.filters).toEqual({
      category: '',
      quality: '',
      duration: '',
      sortBy: 'relevance',
    });
  });

  it('should update individual filters', () => {
    const { result } = renderHook(() => useSearchFilters());

    act(() => {
      result.current.updateFilter('category', 'movies');
    });

    expect(result.current.filters.category).toBe('movies');
  });

  it('should clear all filters', () => {
    const { result } = renderHook(() => useSearchFilters());

    act(() => {
      result.current.updateFilter('category', 'movies');
      result.current.updateFilter('quality', '1080p');
    });

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.filters).toEqual({
      category: '',
      quality: '',
      duration: '',
      sortBy: 'relevance',
    });
  });

  it('should detect active filters', () => {
    const { result } = renderHook(() => useSearchFilters());

    expect(result.current.hasActiveFilters).toBe(false);

    act(() => {
      result.current.updateFilter('category', 'movies');
    });

    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('should not consider default sortBy as active filter', () => {
    const { result } = renderHook(() => useSearchFilters());

    expect(result.current.hasActiveFilters).toBe(false);
  });
});

