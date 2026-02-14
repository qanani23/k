import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useContent } from '../../src/hooks/useContent';
import * as api from '../../src/lib/api';
import * as memoryManagerModule from '../../src/lib/memoryManager';

// Mock the API
vi.mock('../../src/lib/api');

// Mock the offline hook
vi.mock('../../src/hooks/useOffline', () => ({
  useOffline: () => ({ isOnline: true }),
}));

describe('useContent - Cache Bypass (Task 11.1)', () => {
  const mockContentItems = [
    {
      claim_id: 'claim1',
      title: 'Test Movie 1',
      thumbnail_url: 'https://example.com/thumb1.jpg',
      video_urls: { '720p': 'https://example.com/video1.mp4' },
      tags: ['movie'],
      value: { source: {} },
    },
    {
      claim_id: 'claim2',
      title: 'Test Movie 2',
      thumbnail_url: 'https://example.com/thumb2.jpg',
      video_urls: { '720p': 'https://example.com/video2.mp4' },
      tags: ['movie'],
      value: { source: {} },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not use cache when enableMemoryManagement is false', async () => {
    const mockGetCollection = vi.fn(() => null);
    const mockStoreCollection = vi.fn();
    
    // Spy on getMemoryManager to verify it's not called
    const getMemoryManagerSpy = vi.spyOn(memoryManagerModule, 'getMemoryManager');
    
    vi.mocked(api.fetchByTags).mockResolvedValue(mockContentItems);

    const { result } = renderHook(() => 
      useContent({ 
        tags: ['movie'], 
        autoFetch: true, 
        enableMemoryManagement: false 
      })
    );

    // Wait for fetch to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verify content was fetched
    expect(result.current.content).toHaveLength(2);
    expect(result.current.content[0].claim_id).toBe('claim1');

    // Verify getMemoryManager was NOT called when enableMemoryManagement is false
    expect(getMemoryManagerSpy).not.toHaveBeenCalled();
  });

  it('should not store content in cache when enableMemoryManagement is false', async () => {
    const mockStoreCollection = vi.fn();
    const mockGetCollection = vi.fn(() => null);
    
    // Mock getMemoryManager to return a mock manager
    vi.spyOn(memoryManagerModule, 'getMemoryManager').mockReturnValue({
      getCollection: mockGetCollection,
      storeCollection: mockStoreCollection,
      removeCollection: vi.fn(),
      clearAll: vi.fn(),
      getStats: vi.fn(),
      stopAutoCleanup: vi.fn(),
      destroy: vi.fn(),
    } as any);

    vi.mocked(api.fetchByTags).mockResolvedValue(mockContentItems);

    const { result } = renderHook(() => 
      useContent({ 
        tags: ['movie'], 
        autoFetch: true, 
        enableMemoryManagement: false 
      })
    );

    // Wait for fetch to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verify content was fetched
    expect(result.current.content).toHaveLength(2);

    // Verify cache methods were NOT called
    expect(mockGetCollection).not.toHaveBeenCalled();
    expect(mockStoreCollection).not.toHaveBeenCalled();
  });

  it('should fetch from API every time when cache is disabled', async () => {
    vi.mocked(api.fetchByTags).mockResolvedValue(mockContentItems);

    const { result, rerender } = renderHook(
      ({ tags }) => useContent({ 
        tags, 
        autoFetch: true, 
        enableMemoryManagement: false 
      }),
      { initialProps: { tags: ['movie'] } }
    );

    // Wait for first fetch
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(api.fetchByTags).toHaveBeenCalledTimes(1);

    // Trigger refetch by changing tags
    rerender({ tags: ['movie', 'action_movies'] });

    // Wait for second fetch
    await waitFor(() => {
      expect(api.fetchByTags).toHaveBeenCalledTimes(2);
    });

    // Both fetches should have gone to the API, not cache
    expect(result.current.content).toHaveLength(2);
  });

  it('should use cache when enableMemoryManagement is true (default)', async () => {
    const cachedContent = [mockContentItems[0]]; // Only one item in cache
    const mockGetCollection = vi.fn(() => cachedContent);
    const mockStoreCollection = vi.fn();
    
    vi.spyOn(memoryManagerModule, 'getMemoryManager').mockReturnValue({
      getCollection: mockGetCollection,
      storeCollection: mockStoreCollection,
      removeCollection: vi.fn(),
      clearAll: vi.fn(),
      getStats: vi.fn(),
      stopAutoCleanup: vi.fn(),
      destroy: vi.fn(),
    } as any);

    vi.mocked(api.fetchByTags).mockResolvedValue(mockContentItems);

    const { result } = renderHook(() => 
      useContent({ 
        tags: ['movie'], 
        autoFetch: true, 
        enableMemoryManagement: true // Explicitly enable
      })
    );

    // Wait for state to update
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should get cached content (1 item) instead of fetching (2 items)
    expect(result.current.content).toHaveLength(1);
    expect(result.current.content[0].claim_id).toBe('claim1');
    expect(result.current.fromCache).toBe(true);

    // Verify cache was checked
    expect(mockGetCollection).toHaveBeenCalled();
    
    // API should NOT have been called since cache hit
    expect(api.fetchByTags).not.toHaveBeenCalled();
  });
});
