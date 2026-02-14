import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { ContentItem } from '../../src/types';

// Mock content data
const mockContent: ContentItem[] = [
  {
    claim_id: 'claim-1',
    title: 'Test Movie 1',
    thumbnail_url: 'https://example.com/thumb1.jpg',
    duration: 120,
    tags: ['movie', 'action'],
    value: {
      source: { url: 'https://example.com/video1.mp4' }
    }
  },
  {
    claim_id: 'claim-2',
    title: 'Test Movie 2',
    thumbnail_url: 'https://example.com/thumb2.jpg',
    duration: 90,
    tags: ['movie', 'comedy'],
    value: {
      source: { url: 'https://example.com/video2.mp4' }
    }
  }
];

// Mock the API module
vi.mock('../../src/lib/api', () => ({
  fetchByTags: vi.fn(),
  fetchByTag: vi.fn(),
  fetchChannelClaims: vi.fn(),
  searchContent: vi.fn()
}));

// Mock the offline hook
vi.mock('../../src/hooks/useOffline', () => ({
  useOffline: vi.fn(() => ({ isOnline: true, isOffline: false, wasOffline: false, checkOnlineStatus: () => true }))
}));

// Mock the memory manager module
vi.mock('../../src/lib/memoryManager', () => ({
  getMemoryManager: vi.fn(() => ({
    getCollection: vi.fn(() => null),
    storeCollection: vi.fn()
  }))
}));

// Import after mocks are set up
import { useContent } from '../../src/hooks/useContent';
import * as useOfflineModule from '../../src/hooks/useOffline';
import * as memoryManagerModule from '../../src/lib/memoryManager';

describe('useContent - Offline Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Offline Indicator Display', () => {
    it('should set offline error when offline and no cache available', async () => {
      // Set offline state
      vi.mocked(useOfflineModule.useOffline).mockReturnValue({ 
        isOnline: false,
        isOffline: true,
        wasOffline: true,
        checkOnlineStatus: () => false
      });

      vi.mocked(memoryManagerModule.getMemoryManager).mockReturnValue({
        getCollection: vi.fn(() => null),
        storeCollection: vi.fn()
      } as any);

      const { result } = renderHook(() => 
        useContent({ tags: ['movie'], autoFetch: true })
      );

      await waitFor(() => {
        expect(result.current.status).toBe('error');
      }, { timeout: 2000 });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.category).toBe('offline');
      expect(result.current.error?.message).toContain('No internet connection');
      expect(result.current.error?.retryable).toBe(false);
      expect(result.current.content).toEqual([]);
      expect(result.current.fromCache).toBe(false);
    });

    it('should indicate offline state with appropriate error message', async () => {
      vi.mocked(useOfflineModule.useOffline).mockReturnValue({ 
        isOnline: false,
        isOffline: true,
        wasOffline: true,
        checkOnlineStatus: () => false
      });

      vi.mocked(memoryManagerModule.getMemoryManager).mockReturnValue({
        getCollection: vi.fn(() => null),
        storeCollection: vi.fn()
      } as any);

      const { result } = renderHook(() => 
        useContent({ tags: ['series'], autoFetch: true })
      );

      await waitFor(() => {
        expect(result.current.status).toBe('error');
      }, { timeout: 2000 });

      expect(result.current.error?.message).toContain('downloaded content');
      expect(result.current.error?.details).toBe('offline');
    });

    it('should not be retryable when offline', async () => {
      vi.mocked(useOfflineModule.useOffline).mockReturnValue({ 
        isOnline: false,
        isOffline: true,
        wasOffline: true,
        checkOnlineStatus: () => false
      });

      vi.mocked(memoryManagerModule.getMemoryManager).mockReturnValue({
        getCollection: vi.fn(() => null),
        storeCollection: vi.fn()
      } as any);

      const { result } = renderHook(() => 
        useContent({ tags: ['movie'], autoFetch: true })
      );

      await waitFor(() => {
        expect(result.current.status).toBe('error');
      }, { timeout: 2000 });

      expect(result.current.error?.retryable).toBe(false);
    });
  });

  describe('Cached Content Display When Offline', () => {
    it('should display cached content when offline', async () => {
      // Set offline state
      vi.mocked(useOfflineModule.useOffline).mockReturnValue({ 
        isOnline: false,
        isOffline: true,
        wasOffline: true,
        checkOnlineStatus: () => false
      });

      // Mock cache to return content
      vi.mocked(memoryManagerModule.getMemoryManager).mockReturnValue({
        getCollection: vi.fn(() => mockContent),
        storeCollection: vi.fn()
      } as any);

      const { result } = renderHook(() => 
        useContent({ tags: ['movie'], autoFetch: true })
      );

      await waitFor(() => {
        expect(result.current.status).toBe('success');
      }, { timeout: 2000 });

      expect(result.current.content).toEqual(mockContent);
      expect(result.current.fromCache).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should mark content as from cache when loaded offline', async () => {
      vi.mocked(useOfflineModule.useOffline).mockReturnValue({ 
        isOnline: false,
        isOffline: true,
        wasOffline: true,
        checkOnlineStatus: () => false
      });
      
      vi.mocked(memoryManagerModule.getMemoryManager).mockReturnValue({
        getCollection: vi.fn(() => mockContent),
        storeCollection: vi.fn()
      } as any);

      const { result } = renderHook(() => 
        useContent({ tags: ['movie'], autoFetch: true })
      );

      await waitFor(() => {
        expect(result.current.fromCache).toBe(true);
      }, { timeout: 2000 });

      expect(result.current.content.length).toBe(2);
      expect(result.current.status).toBe('success');
    });

    it('should disable pagination when displaying cached content offline', async () => {
      vi.mocked(useOfflineModule.useOffline).mockReturnValue({ 
        isOnline: false,
        isOffline: true,
        wasOffline: true,
        checkOnlineStatus: () => false
      });
      
      vi.mocked(memoryManagerModule.getMemoryManager).mockReturnValue({
        getCollection: vi.fn(() => mockContent),
        storeCollection: vi.fn()
      } as any);

      const { result } = renderHook(() => 
        useContent({ tags: ['movie'], autoFetch: true })
      );

      await waitFor(() => {
        expect(result.current.status).toBe('success');
      }, { timeout: 2000 });

      expect(result.current.hasMore).toBe(false);
    });

    it('should use cache for different tag combinations when offline', async () => {
      vi.mocked(useOfflineModule.useOffline).mockReturnValue({ 
        isOnline: false,
        isOffline: true,
        wasOffline: true,
        checkOnlineStatus: () => false
      });

      const comedyContent = [mockContent[1]];
      vi.mocked(memoryManagerModule.getMemoryManager).mockReturnValue({
        getCollection: vi.fn(() => comedyContent),
        storeCollection: vi.fn()
      } as any);

      const { result } = renderHook(() => 
        useContent({ tags: ['comedy'], autoFetch: true })
      );

      await waitFor(() => {
        expect(result.current.status).toBe('success');
      }, { timeout: 2000 });

      expect(result.current.content).toEqual(comedyContent);
      expect(result.current.fromCache).toBe(true);
    });

    it('should check cache before showing offline error', async () => {
      vi.mocked(useOfflineModule.useOffline).mockReturnValue({ 
        isOnline: false,
        isOffline: true,
        wasOffline: true,
        checkOnlineStatus: () => false
      });
      
      const mockGetCollection = vi.fn(() => null);
      vi.mocked(memoryManagerModule.getMemoryManager).mockReturnValue({
        getCollection: mockGetCollection,
        storeCollection: vi.fn()
      } as any);

      const { result } = renderHook(() => 
        useContent({ tags: ['movie'], autoFetch: true })
      );

      await waitFor(() => {
        expect(result.current.status).toBe('error');
      }, { timeout: 2000 });

      expect(mockGetCollection).toHaveBeenCalled();
      expect(result.current.error?.category).toBe('offline');
    });
  });

  describe('Empty State When No Cache Available', () => {
    it('should show empty state when offline and cache is empty', async () => {
      vi.mocked(useOfflineModule.useOffline).mockReturnValue({ 
        isOnline: false,
        isOffline: true,
        wasOffline: true,
        checkOnlineStatus: () => false
      });
      
      vi.mocked(memoryManagerModule.getMemoryManager).mockReturnValue({
        getCollection: vi.fn(() => null),
        storeCollection: vi.fn()
      } as any);

      const { result } = renderHook(() => 
        useContent({ tags: ['movie'], autoFetch: true })
      );

      await waitFor(() => {
        expect(result.current.status).toBe('error');
      }, { timeout: 2000 });

      expect(result.current.content).toEqual([]);
      expect(result.current.error?.category).toBe('offline');
      expect(result.current.fromCache).toBe(false);
    });

    it('should show empty state when offline and cache returns empty array', async () => {
      vi.mocked(useOfflineModule.useOffline).mockReturnValue({ 
        isOnline: false,
        isOffline: true,
        wasOffline: true,
        checkOnlineStatus: () => false
      });
      
      vi.mocked(memoryManagerModule.getMemoryManager).mockReturnValue({
        getCollection: vi.fn(() => []),
        storeCollection: vi.fn()
      } as any);

      const { result } = renderHook(() => 
        useContent({ tags: ['movie'], autoFetch: true })
      );

      await waitFor(() => {
        expect(result.current.status).toBe('error');
      }, { timeout: 2000 });

      expect(result.current.content).toEqual([]);
      expect(result.current.error?.message).toContain('No internet connection');
    });

    it('should provide helpful message when no cache is available offline', async () => {
      vi.mocked(useOfflineModule.useOffline).mockReturnValue({ 
        isOnline: false,
        isOffline: true,
        wasOffline: true,
        checkOnlineStatus: () => false
      });
      
      vi.mocked(memoryManagerModule.getMemoryManager).mockReturnValue({
        getCollection: vi.fn(() => null),
        storeCollection: vi.fn()
      } as any);

      const { result } = renderHook(() => 
        useContent({ tags: ['series'], autoFetch: true })
      );

      await waitFor(() => {
        expect(result.current.status).toBe('error');
      }, { timeout: 2000 });

      expect(result.current.error?.message).toContain('downloaded content');
      expect(result.current.content.length).toBe(0);
    });

    it('should handle offline state with memory management disabled', async () => {
      vi.mocked(useOfflineModule.useOffline).mockReturnValue({ 
        isOnline: false,
        isOffline: true,
        wasOffline: true,
        checkOnlineStatus: () => false
      });

      const mockGetCollection = vi.fn(() => null);
      vi.mocked(memoryManagerModule.getMemoryManager).mockReturnValue({
        getCollection: mockGetCollection,
        storeCollection: vi.fn()
      } as any);

      const { result } = renderHook(() => 
        useContent({ 
          tags: ['movie'], 
          autoFetch: true,
          enableMemoryManagement: false 
        })
      );

      await waitFor(() => {
        expect(result.current.status).toBe('error');
      }, { timeout: 2000 });

      expect(result.current.error?.category).toBe('offline');
      expect(result.current.content).toEqual([]);
      expect(mockGetCollection).not.toHaveBeenCalled();
    });

    it('should transition to error state immediately when offline with no cache', async () => {
      vi.mocked(useOfflineModule.useOffline).mockReturnValue({ 
        isOnline: false,
        isOffline: true,
        wasOffline: true,
        checkOnlineStatus: () => false
      });
      
      vi.mocked(memoryManagerModule.getMemoryManager).mockReturnValue({
        getCollection: vi.fn(() => null),
        storeCollection: vi.fn()
      } as any);

      const { result } = renderHook(() => 
        useContent({ tags: ['movie'], autoFetch: true })
      );

      // Should transition quickly to error state without attempting network fetch
      await waitFor(() => {
        expect(result.current.status).toBe('error');
      }, { timeout: 1000 });

      expect(result.current.error?.category).toBe('offline');
    });
  });

  describe('Online to Offline Transitions', () => {
    it('should handle transition from online to offline gracefully', async () => {
      // Start online
      vi.mocked(useOfflineModule.useOffline).mockReturnValue({ 
        isOnline: true,
        isOffline: false,
        wasOffline: false,
        checkOnlineStatus: () => true
      });
      
      vi.mocked(memoryManagerModule.getMemoryManager).mockReturnValue({
        getCollection: vi.fn(() => mockContent),
        storeCollection: vi.fn()
      } as any);

      const { result, rerender } = renderHook(() => 
        useContent({ tags: ['movie'], autoFetch: true })
      );

      await waitFor(() => {
        expect(result.current.status).toBe('success');
      }, { timeout: 2000 });

      // Go offline
      vi.mocked(useOfflineModule.useOffline).mockReturnValue({ 
        isOnline: false,
        isOffline: true,
        wasOffline: true,
        checkOnlineStatus: () => false
      });
      rerender();

      // Content should still be available from cache
      expect(result.current.content).toEqual(mockContent);
    });

    it('should use cached content when going offline after initial load', async () => {
      vi.mocked(useOfflineModule.useOffline).mockReturnValue({ 
        isOnline: true,
        isOffline: false,
        wasOffline: false,
        checkOnlineStatus: () => true
      });
      
      vi.mocked(memoryManagerModule.getMemoryManager).mockReturnValue({
        getCollection: vi.fn(() => mockContent),
        storeCollection: vi.fn()
      } as any);

      const { result } = renderHook(() => 
        useContent({ tags: ['movie'], autoFetch: true })
      );

      await waitFor(() => {
        expect(result.current.status).toBe('success');
      }, { timeout: 2000 });

      // Verify content is loaded
      expect(result.current.content.length).toBeGreaterThan(0);
      expect(result.current.fromCache).toBe(true);
    });
  });
});
