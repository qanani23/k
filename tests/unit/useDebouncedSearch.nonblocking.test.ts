import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDebouncedSearch } from '../../src/hooks/useDebouncedSearch';
import * as api from '../../src/lib/api';

// Mock the API module
vi.mock('../../src/lib/api', () => ({
  searchContent: vi.fn(),
  fetchChannelClaims: vi.fn(),
}));

describe('useDebouncedSearch - Non-blocking UI Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set loading state immediately without waiting for API response', async () => {
    // Setup: Create a controlled promise
    let resolveSearch: (value: any[]) => void;
    const searchPromise = new Promise<any[]>((resolve) => {
      resolveSearch = resolve;
    });

    vi.mocked(api.searchContent).mockReturnValue(searchPromise);

    const { result } = renderHook(() =>
      useDebouncedSearch({ delay: 100, minLength: 2 })
    );

    // Start search
    act(() => {
      result.current.setQuery('test');
    });

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 150));

    // Loading state should be set immediately
    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    // Query should be accessible (UI not blocked)
    expect(result.current.query).toBe('test');

    // Resolve the search
    resolveSearch!([
      {
        claim_id: '1',
        title: 'Test Movie',
        tags: ['movie'],
        video_urls: {},
        compatibility: { compatible: true },
      },
    ]);

    // Wait for completion
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.results.length).toBe(1);
    });
  });

  it('should allow query updates while search is in progress', async () => {
    // Setup: Slow API response
    vi.mocked(api.searchContent).mockImplementation(() =>
      new Promise((resolve) => setTimeout(() => resolve([]), 200))
    );

    const { result } = renderHook(() =>
      useDebouncedSearch({ delay: 100, minLength: 2 })
    );

    // Start first search
    act(() => {
      result.current.setQuery('test1');
    });

    await new Promise(resolve => setTimeout(resolve, 150));

    // Verify loading
    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    // Update query while search is in progress (UI not blocked)
    act(() => {
      result.current.setQuery('test2');
    });

    // Query should update immediately
    expect(result.current.query).toBe('test2');

    // Wait for operations to complete
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  it('should handle cache hits synchronously without API calls', async () => {
    // Setup: First search to populate cache
    vi.mocked(api.searchContent).mockResolvedValue([
      {
        claim_id: '1',
        title: 'Cached Movie',
        tags: ['movie'],
        video_urls: {},
        compatibility: { compatible: true },
      },
    ]);

    const { result } = renderHook(() =>
      useDebouncedSearch({ delay: 100, minLength: 2 })
    );

    // First search
    act(() => {
      result.current.setQuery('cached');
    });

    await new Promise(resolve => setTimeout(resolve, 150));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.results.length).toBe(1);
    });

    const firstCallCount = vi.mocked(api.searchContent).mock.calls.length;

    // Clear and search again with same query
    act(() => {
      result.current.clearSearch();
    });

    act(() => {
      result.current.setQuery('cached');
    });

    await new Promise(resolve => setTimeout(resolve, 150));

    // Cache hit should return results without additional API call
    await waitFor(() => {
      expect(result.current.results.length).toBe(1);
      expect(result.current.results[0].title).toBe('Cached Movie');
    });

    // Should not have made a second API call
    expect(vi.mocked(api.searchContent).mock.calls.length).toBe(firstCallCount);
  });

  it('should handle rapid query changes with debouncing', async () => {
    // Setup: Mock API
    vi.mocked(api.searchContent).mockResolvedValue([
      {
        claim_id: '1',
        title: 'Test Movie',
        tags: ['movie'],
        video_urls: {},
        compatibility: { compatible: true },
      },
    ]);

    const { result } = renderHook(() =>
      useDebouncedSearch({ delay: 100, minLength: 2 })
    );

    // Rapidly change query (all meet minimum length)
    act(() => {
      result.current.setQuery('te');
    });

    act(() => {
      result.current.setQuery('tes');
    });

    act(() => {
      result.current.setQuery('test');
    });

    act(() => {
      result.current.setQuery('testing');
    });

    // UI should update immediately (not blocked)
    expect(result.current.query).toBe('testing');

    // Wait for debounce and search to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.results.length).toBeGreaterThan(0);
    }, { timeout: 2000 });

    // Only the last query should have triggered a search
    expect(api.searchContent).toHaveBeenCalled();
    expect(api.searchContent).toHaveBeenCalledWith('testing', 50);
  });

  it('should handle fallback to recent uploads asynchronously', async () => {
    // Setup: Empty search results, then fallback results
    vi.mocked(api.searchContent).mockResolvedValue([]);
    vi.mocked(api.fetchChannelClaims).mockResolvedValue([
      {
        claim_id: '1',
        title: 'Recent Upload',
        tags: ['movie'],
        video_urls: {},
        compatibility: { compatible: true },
      },
    ]);

    const { result } = renderHook(() =>
      useDebouncedSearch({ delay: 100, minLength: 2, fallbackToRecent: true })
    );

    // Start search
    act(() => {
      result.current.setQuery('nonexistent');
    });

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 150));

    // Wait for search and fallback to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 3000 });

    // Should show fallback results
    expect(result.current.showingFallback).toBe(true);
    expect(result.current.results.length).toBe(1);

    // Both API calls should have been made
    expect(api.searchContent).toHaveBeenCalledTimes(1);
    expect(api.fetchChannelClaims).toHaveBeenCalledTimes(1);
  });

  it('should handle errors without blocking UI', async () => {
    // Setup: API error
    vi.mocked(api.searchContent).mockRejectedValue(
      new Error('Network error')
    );

    const { result } = renderHook(() =>
      useDebouncedSearch({ delay: 100, minLength: 2 })
    );

    // Start search
    act(() => {
      result.current.setQuery('error');
    });

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 150));

    // Wait for error to be handled
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 3000 });

    // Should have error
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('Network error');

    // UI should remain responsive - we can clear the error
    act(() => {
      result.current.clearSearch();
    });

    expect(result.current.error).toBeNull();
  });

  it('should allow clearSearch while search is in progress', async () => {
    // Setup: Slow API response
    let resolveSearch: (value: any[]) => void;
    const searchPromise = new Promise<any[]>((resolve) => {
      resolveSearch = resolve;
    });

    vi.mocked(api.searchContent).mockReturnValue(searchPromise);

    const { result } = renderHook(() =>
      useDebouncedSearch({ delay: 100, minLength: 2 })
    );

    // Start search
    act(() => {
      result.current.setQuery('test');
    });

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 150));

    // Give it a moment to start the search
    await new Promise(resolve => setTimeout(resolve, 50));

    // Clear search while in progress (UI not blocked)
    act(() => {
      result.current.clearSearch();
    });

    // Should clear immediately
    expect(result.current.query).toBe('');
    expect(result.current.loading).toBe(false);

    // Resolve the search (cleanup)
    resolveSearch!([]);

    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  });
});

