import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useContent } from '../../src/hooks/useContent';
import * as api from '../../src/lib/api';

// Mock the offline hook
vi.mock('../../src/hooks/useOffline', () => ({
  useOffline: () => ({ isOnline: true })
}));

// Mock the memory manager
vi.mock('../../src/lib/memoryManager', () => ({
  getMemoryManager: () => ({
    getCollection: vi.fn(() => null),
    storeCollection: vi.fn()
  })
}));

// Mock the API module
vi.mock('../../src/lib/api', () => ({
  fetchByTags: vi.fn(),
  fetchByTag: vi.fn(),
  fetchChannelClaims: vi.fn(),
  searchContent: vi.fn()
}));

describe('useContent - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should categorize timeout errors correctly', async () => {
    const timeoutError = new Error('Request timed out');
    vi.mocked(api.fetchByTags).mockRejectedValue(timeoutError);

    const { result } = renderHook(() => useContent({ tags: ['movie'], autoFetch: true }));

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    }, { timeout: 3000 });

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.category).toBe('timeout');
    expect(result.current.error?.retryable).toBe(true);
    expect(result.current.error?.message).toContain('timed out');
  });

  it('should categorize network errors correctly', async () => {
    const networkError = new Error('Network request failed');
    vi.mocked(api.fetchByTags).mockRejectedValue(networkError);

    const { result } = renderHook(() => useContent({ tags: ['movie'], autoFetch: true }));

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    }, { timeout: 3000 });

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.category).toBe('network');
    expect(result.current.error?.retryable).toBe(true);
    expect(result.current.error?.message).toContain('Network error');
  });

  it('should categorize validation errors correctly', async () => {
    const validationError = new Error('Invalid content data');
    vi.mocked(api.fetchByTags).mockRejectedValue(validationError);

    const { result } = renderHook(() => useContent({ tags: ['movie'], autoFetch: true }));

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    }, { timeout: 3000 });

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.category).toBe('validation');
    expect(result.current.error?.retryable).toBe(true);
  });

  it('should categorize unknown errors correctly', async () => {
    const unknownError = new Error('Something went wrong');
    vi.mocked(api.fetchByTags).mockRejectedValue(unknownError);

    const { result } = renderHook(() => useContent({ tags: ['movie'], autoFetch: true }));

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    }, { timeout: 3000 });

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.category).toBe('unknown');
    expect(result.current.error?.retryable).toBe(true);
    expect(result.current.error?.message).toContain('Failed to fetch content');
  });

  it('should handle non-Error objects gracefully', async () => {
    vi.mocked(api.fetchByTags).mockRejectedValue('string error');

    const { result } = renderHook(() => useContent({ tags: ['movie'], autoFetch: true }));

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    }, { timeout: 3000 });

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.category).toBe('unknown');
    expect(result.current.error?.retryable).toBe(true);
    expect(result.current.error?.message).toContain('unexpected error');
  });

  it('should provide user-friendly error messages', async () => {
    const errors = [
      { error: new Error('timeout'), expectedMessage: 'timed out' },
      { error: new Error('network failed'), expectedMessage: 'network error' },
      { error: new Error('fetch error'), expectedMessage: 'network error' },
      { error: new Error('offline'), expectedMessage: 'no internet connection' }
    ];

    for (const { error, expectedMessage } of errors) {
      vi.clearAllMocks();
      vi.mocked(api.fetchByTags).mockRejectedValue(error);

      const { result, unmount } = renderHook(() => useContent({ tags: ['movie'], autoFetch: true }));

      await waitFor(() => {
        expect(result.current.status).toBe('error');
      }, { timeout: 3000 });

      expect(result.current.error?.message.toLowerCase()).toContain(expectedMessage.toLowerCase());
      
      // Unmount to clean up before next iteration
      unmount();
    }
  });
});
