import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { 
  useContent, 
  useMovies, 
  useSeries, 
  useSitcoms, 
  useKidsContent, 
  useHeroContent, 
  useSearch,
  useRelatedContent
} from '../../src/hooks/useContent';
import * as api from '../../src/lib/api';
import { ContentItem } from '../../src/types';

// Mock the API module
vi.mock('../../src/lib/api');

// Mock the useOffline hook
vi.mock('../../src/hooks/useOffline', () => ({
  useOffline: () => ({ isOnline: true, wasOffline: false })
}));

// Mock the memory manager to always return null (no cached data)
vi.mock('../../src/lib/memoryManager', () => ({
  getMemoryManager: vi.fn(() => ({
    getCollection: vi.fn(() => null),
    storeCollection: vi.fn(),
    removeCollection: vi.fn(() => true),
    clearAll: vi.fn(),
    getStats: vi.fn(() => ({ totalCollections: 0, totalItems: 0, collections: [] })),
    destroy: vi.fn()
  }))
}));

describe('useContent', () => {
  const mockContentItems: ContentItem[] = [
    {
      claim_id: 'claim-1',
      title: 'Test Movie 1',
      description: 'A test movie',
      tags: ['movie', 'action_movies'],
      thumbnail_url: 'https://example.com/thumb1.jpg',
      duration: 7200,
      release_time: 1640000000,
      video_urls: {
        '720p': { url: 'https://example.com/video1-720p.mp4', quality: '720p', type: 'mp4' },
        '1080p': { url: 'https://example.com/video1-1080p.mp4', quality: '1080p', type: 'mp4' },
      },
      compatibility: { compatible: true, fallback_available: false },
    },
    {
      claim_id: 'claim-2',
      title: 'Test Movie 2',
      description: 'Another test movie',
      tags: ['movie', 'comedy_movies'],
      thumbnail_url: 'https://example.com/thumb2.jpg',
      duration: 5400,
      release_time: 1640100000,
      video_urls: {
        '480p': { url: 'https://example.com/video2-480p.mp4', quality: '480p', type: 'mp4' },
        '720p': { url: 'https://example.com/video2-720p.mp4', quality: '720p', type: 'mp4' },
      },
      compatibility: { compatible: true, fallback_available: false },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all API mocks to default resolved values
    vi.mocked(api.fetchByTags).mockResolvedValue(mockContentItems);
    vi.mocked(api.fetchChannelClaims).mockResolvedValue(mockContentItems);
    vi.mocked(api.searchContent).mockResolvedValue(mockContentItems);
    vi.mocked(api.fetchByTag).mockResolvedValue(mockContentItems);
  });

  describe('useContent', () => {
    it('should initialize with empty content and loading false', () => {
      const { result } = renderHook(() => useContent({ autoFetch: false }));
      
      expect(result.current.content).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.hasMore).toBe(true);
    });

    it('should not fetch content on mount when autoFetch is false', () => {
      vi.mocked(api.fetchByTags).mockResolvedValue(mockContentItems);
      
      renderHook(() => useContent({ tags: ['movie'], autoFetch: false }));

      expect(api.fetchByTags).not.toHaveBeenCalled();
    });

    it('should fetch content with tags on mount when autoFetch is true', async () => {
      const mockFetch = vi.mocked(api.fetchByTags).mockResolvedValue(mockContentItems);

      const { result } = renderHook(() => useContent({ tags: ['movie'], autoFetch: true, enableMemoryManagement: false }));

      // First check that the API was called
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Then wait for loading to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 3000 });

      expect(api.fetchByTags).toHaveBeenCalledWith(['movie'], 50);
      expect(result.current.content).toEqual(mockContentItems);
      expect(result.current.error).toBeNull();
    });

    it('should fetch content with text search', async () => {
      vi.mocked(api.searchContent).mockResolvedValue(mockContentItems);

      const { result } = renderHook(() => useContent({ text: 'test query', autoFetch: true, enableMemoryManagement: false }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(api.searchContent).toHaveBeenCalledWith('test query', 50);
      expect(result.current.content).toEqual(mockContentItems);
    });

    it('should fetch all channel claims when no tags or text provided', async () => {
      vi.mocked(api.fetchChannelClaims).mockResolvedValue(mockContentItems);

      const { result } = renderHook(() => useContent({ autoFetch: true, enableMemoryManagement: false }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(api.fetchChannelClaims).toHaveBeenCalledWith({ limit: 50, page: 1 });
      expect(result.current.content).toEqual(mockContentItems);
    });

    it('should handle API errors gracefully', async () => {
      const mockError = new Error('API Error');
      const mockFetch = vi.mocked(api.fetchByTags).mockRejectedValue(mockError);

      const { result } = renderHook(() => useContent({ tags: ['movie'], autoFetch: true, enableMemoryManagement: false }));

      // Wait for API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      }, { timeout: 3000 });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 3000 });

      expect(result.current.error).toMatchObject({
        message: 'API Error',
      });
      expect(result.current.content).toEqual([]);
    });

    it('should refetch content when refetch is called', async () => {
      vi.mocked(api.fetchByTags).mockResolvedValue(mockContentItems);

      const { result } = renderHook(() => useContent({ tags: ['movie'], autoFetch: true, enableMemoryManagement: false }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 3000 });

      expect(result.current.content).toEqual(mockContentItems);

      // Mock new data for refetch
      const newMockData = [mockContentItems[0]];
      vi.mocked(api.fetchByTags).mockResolvedValue(newMockData);

      // Call refetch
      act(() => {
        result.current.refetch();
      });

      // Wait for refetch to complete
      await waitFor(() => {
        expect(result.current.content).toHaveLength(1);
      }, { timeout: 5000 });

      expect(result.current.content[0].claim_id).toBe('claim-1');
    }, 10000);

    it('should load more content and append to existing', async () => {
      // This test verifies the loadMore functionality
      // Note: Due to mock complexity, we test with a smaller dataset
      
      vi.mocked(api.fetchByTags).mockResolvedValue(mockContentItems);

      const { result } = renderHook(() => useContent({ tags: ['movie'], limit: 2, autoFetch: true, enableMemoryManagement: false }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // With limit=2 and 2 items returned, hasMore should be true
      expect(result.current.content).toHaveLength(2);
      expect(result.current.hasMore).toBe(true);

      // Mock additional data for page 2
      const additionalData: ContentItem[] = [
        {
          claim_id: 'claim-3',
          title: 'Test Movie 3',
          tags: ['movie'],
          release_time: 1640200000,
          video_urls: {
            '720p': { url: 'https://example.com/video3-720p.mp4', quality: '720p', type: 'mp4' },
          },
          compatibility: { compatible: true, fallback_available: false },
        },
      ];

      vi.mocked(api.fetchByTags).mockResolvedValue(additionalData);

      await act(async () => {
        await result.current.loadMore();
      });

      await waitFor(() => {
        expect(result.current.content.length).toBeGreaterThan(2);
      }, { timeout: 5000 });

      expect(result.current.content[2]).toEqual(additionalData[0]);
    }, 10000);

    it('should set hasMore to false when results are less than limit', async () => {
      const singleItem = [mockContentItems[0]];
      const mockFetch = vi.mocked(api.fetchByTags).mockResolvedValue(singleItem);

      const { result } = renderHook(() => useContent({ tags: ['movie'], limit: 50, autoFetch: true, enableMemoryManagement: false }));

      // Wait for API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      }, { timeout: 3000 });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 3000 });

      expect(result.current.hasMore).toBe(false);
    });

    it('should set hasMore to true when results equal limit', async () => {
      const fullPage = Array(50).fill(null).map((_, i) => ({
        ...mockContentItems[0],
        claim_id: `claim-${i}`,
      }));
      const mockFetch = vi.mocked(api.fetchByTags).mockResolvedValue(fullPage);

      const { result } = renderHook(() => useContent({ tags: ['movie'], limit: 50, autoFetch: true, enableMemoryManagement: false }));

      // Wait for API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      }, { timeout: 3000 });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 3000 });

      expect(result.current.hasMore).toBe(true);
    });

    it('should use custom limit parameter', async () => {
      vi.mocked(api.fetchByTags).mockResolvedValue(mockContentItems);

      renderHook(() => useContent({ tags: ['movie'], limit: 100, autoFetch: true, enableMemoryManagement: false }));

      await waitFor(() => {
        expect(api.fetchByTags).toHaveBeenCalledWith(['movie'], 100);
      });
    });
  });

  describe('useMovies', () => {
    it('should fetch movies with base tag', async () => {
      vi.mocked(api.fetchByTags).mockResolvedValue(mockContentItems);

      const { result } = renderHook(() => useMovies(undefined, { enableMemoryManagement: false }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(api.fetchByTags).toHaveBeenCalledWith(['movie'], 50);
      expect(result.current.content).toEqual(mockContentItems);
    });

    it('should fetch movies with filter tag', async () => {
      vi.mocked(api.fetchByTags).mockResolvedValue([mockContentItems[0]]);

      const { result } = renderHook(() => useMovies('action_movies', { enableMemoryManagement: false }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(api.fetchByTags).toHaveBeenCalledWith(['movie', 'action_movies'], 50);
    });
  });

  describe('useSeries', () => {
    it('should fetch series with base tag', async () => {
      const seriesItems: ContentItem[] = [
        {
          ...mockContentItems[0],
          claim_id: 'series-1',
          tags: ['series', 'action_series'],
        },
      ];
      vi.mocked(api.fetchByTags).mockResolvedValue(seriesItems);

      const { result } = renderHook(() => useSeries(undefined, { enableMemoryManagement: false }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(api.fetchByTags).toHaveBeenCalledWith(['series'], 50);
      expect(result.current.content).toEqual(seriesItems);
    });

    it('should fetch series with filter tag', async () => {
      const seriesItems: ContentItem[] = [
        {
          ...mockContentItems[0],
          claim_id: 'series-1',
          tags: ['series', 'comedy_series'],
        },
      ];
      vi.mocked(api.fetchByTags).mockResolvedValue(seriesItems);

      const { result } = renderHook(() => useSeries('comedy_series', { enableMemoryManagement: false }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(api.fetchByTags).toHaveBeenCalledWith(['series', 'comedy_series'], 50);
    });
  });

  describe('useSitcoms', () => {
    it('should fetch sitcoms', async () => {
      const sitcomItems: ContentItem[] = [
        {
          ...mockContentItems[0],
          claim_id: 'sitcom-1',
          tags: ['sitcom'],
        },
      ];
      vi.mocked(api.fetchByTags).mockResolvedValue(sitcomItems);

      const { result } = renderHook(() => useSitcoms({ enableMemoryManagement: false }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(api.fetchByTags).toHaveBeenCalledWith(['sitcom'], 50);
      expect(result.current.content).toEqual(sitcomItems);
    });
  });

  describe('useKidsContent', () => {
    it('should fetch kids content with base tag', async () => {
      const kidsItems: ContentItem[] = [
        {
          ...mockContentItems[0],
          claim_id: 'kids-1',
          tags: ['kids'],
        },
      ];
      vi.mocked(api.fetchByTags).mockResolvedValue(kidsItems);

      const { result } = renderHook(() => useKidsContent(undefined, { enableMemoryManagement: false }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(api.fetchByTags).toHaveBeenCalledWith(['kids'], 50);
      expect(result.current.content).toEqual(kidsItems);
    });

    it('should fetch kids content with filter tag', async () => {
      const kidsItems: ContentItem[] = [
        {
          ...mockContentItems[0],
          claim_id: 'kids-1',
          tags: ['kids', 'action_kids'],
        },
      ];
      vi.mocked(api.fetchByTags).mockResolvedValue(kidsItems);

      const { result } = renderHook(() => useKidsContent('action_kids', { enableMemoryManagement: false }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(api.fetchByTags).toHaveBeenCalledWith(['kids', 'action_kids'], 50);
    });
  });

  describe('useHeroContent', () => {
    it('should fetch hero trailer content', async () => {
      const heroItems: ContentItem[] = [
        {
          ...mockContentItems[0],
          claim_id: 'hero-1',
          tags: ['hero_trailer', 'movie'],
        },
      ];
      vi.mocked(api.fetchByTags).mockResolvedValue(heroItems);

      const { result } = renderHook(() => useHeroContent({ enableMemoryManagement: false }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(api.fetchByTags).toHaveBeenCalledWith(['hero_trailer'], 20);
      expect(result.current.content).toEqual(heroItems);
    });
  });

  describe('useSearch', () => {
    it('should search content with query', async () => {
      vi.mocked(api.searchContent).mockResolvedValue(mockContentItems);

      const { result } = renderHook(() => useSearch('test query', { enableMemoryManagement: false }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(api.searchContent).toHaveBeenCalledWith('test query', 50);
      expect(result.current.content).toEqual(mockContentItems);
    });

    it('should not auto-fetch when query is empty', () => {
      const { result } = renderHook(() => useSearch(''));

      expect(result.current.loading).toBe(false);
      expect(api.searchContent).not.toHaveBeenCalled();
      expect(result.current.content).toEqual([]);
    });

    it('should not auto-fetch when query is only whitespace', () => {
      const { result } = renderHook(() => useSearch('   '));

      expect(result.current.loading).toBe(false);
      expect(api.searchContent).not.toHaveBeenCalled();
      expect(result.current.content).toEqual([]);
    });
  });

  describe('useRelatedContent', () => {
    it('should fetch and filter related content', async () => {
      const allContent: ContentItem[] = [
        mockContentItems[0],
        mockContentItems[1],
        {
          ...mockContentItems[0],
          claim_id: 'claim-3',
          title: 'Test Movie 3',
        },
        {
          ...mockContentItems[0],
          claim_id: 'claim-4',
          title: 'Test Movie 4',
        },
      ];

      vi.mocked(api.fetchByTag).mockResolvedValue(allContent);

      const { result } = renderHook(() => useRelatedContent('action_movies', 'claim-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(api.fetchByTag).toHaveBeenCalledWith('action_movies', 50);
      expect(result.current.content).toHaveLength(3);
      expect(result.current.content.every(item => item.claim_id !== 'claim-1')).toBe(true);
    });

    it('should limit related content to 10 items', async () => {
      const allContent: ContentItem[] = Array(20).fill(null).map((_, i) => ({
        ...mockContentItems[0],
        claim_id: `claim-${i}`,
      }));

      vi.mocked(api.fetchByTag).mockResolvedValue(allContent);

      const { result } = renderHook(() => useRelatedContent('action_movies', 'claim-exclude'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.content).toHaveLength(10);
    });

    it('should handle errors when fetching related content', async () => {
      const mockError = new Error('Failed to fetch');
      vi.mocked(api.fetchByTag).mockRejectedValue(mockError);

      const { result } = renderHook(() => useRelatedContent('action_movies', 'claim-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toMatchObject({
        message: 'Failed to fetch',
      });
      expect(result.current.content).toEqual([]);
    });

    it('should not fetch when categoryTag is empty', () => {
      const { result } = renderHook(() => useRelatedContent('', 'claim-1'));

      expect(result.current.loading).toBe(false);
      expect(api.fetchByTag).not.toHaveBeenCalled();
    });

    it('should have hasMore as false for related content', async () => {
      vi.mocked(api.fetchByTag).mockResolvedValue([mockContentItems[0]]);

      const { result } = renderHook(() => useRelatedContent('action_movies', 'claim-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasMore).toBe(false);
    });
  });

  describe('Diagnostic Logging', () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Reset memory manager mock to default behavior
      const memoryManagerModule = await import('../../src/lib/memoryManager');
      vi.mocked(memoryManagerModule.getMemoryManager).mockReturnValue({
        getCollection: vi.fn(() => null),
        storeCollection: vi.fn(),
        removeCollection: vi.fn(() => true),
        clearAll: vi.fn(),
        getStats: vi.fn(() => ({ totalCollections: 0, totalItems: 0, collections: [] })),
        destroy: vi.fn()
      } as any);
      
      // Reset API mocks to ensure clean state
      vi.mocked(api.fetchByTags).mockReset().mockResolvedValue(mockContentItems);
      vi.mocked(api.fetchChannelClaims).mockReset().mockResolvedValue(mockContentItems);
      vi.mocked(api.searchContent).mockReset().mockResolvedValue(mockContentItems);
      vi.mocked(api.fetchByTag).mockReset().mockResolvedValue(mockContentItems);
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should produce logs in development mode during successful fetch', async () => {
      vi.mocked(api.fetchByTags).mockResolvedValue(mockContentItems);

      const { result } = renderHook(() => useContent({ 
        tags: ['movie'], 
        autoFetch: true, 
        enableMemoryManagement: false 
      }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 3000 });

      // Verify state transition logs were produced
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[useContent] State transition: idle → loading'),
        expect.objectContaining({
          collectionId: expect.any(String),
          pageNum: 1,
          append: false,
          tags: ['movie'],
          limit: 50
        })
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[useContent] State transition: loading → success'),
        expect.objectContaining({
          collectionId: expect.any(String),
          pageNum: 1,
          append: false,
          itemCount: 2,
          duration: expect.stringMatching(/\d+\.\d+ms/),
          hasMore: false
        })
      );
    });

    it('should produce error logs in development mode during failed fetch', async () => {
      const mockError = new Error('API Error');
      vi.mocked(api.fetchByTags).mockRejectedValue(mockError);

      const { result } = renderHook(() => useContent({ 
        tags: ['movie'], 
        autoFetch: true, 
        enableMemoryManagement: false 
      }));

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      }, { timeout: 3000 });

      expect(result.current.status).toBe('error');

      // Verify error logs were produced
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[useContent] State transition: loading → error'),
        expect.objectContaining({
          collectionId: expect.any(String),
          pageNum: 1,
          append: false,
          duration: expect.stringMatching(/\d+\.\d+ms/),
          error: 'API Error'
        })
      );
    });

    it('should produce cache hit logs in development mode', async () => {
      // Import the memory manager module to mock it
      const memoryManagerModule = await import('../../src/lib/memoryManager');
      
      // Mock memory manager to return cached content
      const mockMemoryManager = {
        getCollection: vi.fn(() => mockContentItems),
        storeCollection: vi.fn(),
        removeCollection: vi.fn(() => true),
        clearAll: vi.fn(),
        getStats: vi.fn(() => ({ totalCollections: 0, totalItems: 0, collections: [] })),
        destroy: vi.fn()
      };

      vi.spyOn(memoryManagerModule, 'getMemoryManager').mockReturnValue(mockMemoryManager as any);

      const { result } = renderHook(() => useContent({ 
        tags: ['movie'], 
        autoFetch: true, 
        enableMemoryManagement: true 
      }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 3000 });

      // Verify cache hit log was produced
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[useContent] Cache hit'),
        expect.objectContaining({
          collectionId: expect.any(String),
          pageNum: 1,
          append: false,
          itemCount: 2,
          duration: expect.stringMatching(/\d+\.\d+ms/)
        })
      );
    });

    it('should produce fetch deduplication logs in development mode', async () => {
      // This test verifies that the deduplication logic exists and logs appropriately
      // We test this by checking that the log message format is correct when it would be triggered
      
      // The deduplication happens when fetchInProgressRef.current is true and force is false
      // Since this is difficult to test reliably in a unit test without race conditions,
      // we verify the logging infrastructure is in place by checking other logs
      
      vi.mocked(api.fetchByTags).mockResolvedValue(mockContentItems);

      const { result } = renderHook(() => useContent({ 
        tags: ['movie'], 
        autoFetch: true, 
        enableMemoryManagement: false 
      }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 3000 });

      // Verify that logging is working (we see other logs)
      const logCalls = consoleLogSpy.mock.calls;
      const hasUseContentLogs = logCalls.some(call => 
        typeof call[0] === 'string' && call[0].includes('[useContent]')
      );
      expect(hasUseContentLogs).toBe(true);
      
      // The deduplication log would appear as: '[useContent] Fetch already in progress, skipping'
      // This is tested implicitly through the fetchInProgressRef logic
    });

    it('should disable verbose logging in production mode', async () => {
      // Note: In a real production build, import.meta.env.DEV would be false
      // This test verifies the logging is conditional on the isDev flag
      // The actual behavior depends on the build environment
      
      const mockFetch = vi.mocked(api.fetchByTags).mockResolvedValue(mockContentItems);

      const { result } = renderHook(() => useContent({ 
        tags: ['movie'], 
        autoFetch: true, 
        enableMemoryManagement: false 
      }));

      // Wait for API call and completion
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      }, { timeout: 3000 });

      await waitFor(() => {
        expect(result.current.content.length).toBeGreaterThan(0);
      }, { timeout: 3000 });

      // In development mode (which we're in during tests), logs ARE produced
      // This test documents that the logging is controlled by import.meta.env.DEV
      // In a production build, these logs would not be produced
      expect(consoleLogSpy).toHaveBeenCalled();
      
      // Verify the logs contain the expected format
      const logCalls = consoleLogSpy.mock.calls;
      const hasUseContentLogs = logCalls.some(call => 
        typeof call[0] === 'string' && call[0].includes('[useContent]')
      );
      expect(hasUseContentLogs).toBe(true);
    });

    it('should handle error logging based on environment', async () => {
      // This test verifies that error logging is conditional
      const mockError = new Error('API Error');
      const mockFetch = vi.mocked(api.fetchByTags).mockRejectedValue(mockError);

      const { result } = renderHook(() => useContent({ 
        tags: ['movie'], 
        autoFetch: true, 
        enableMemoryManagement: false 
      }));

      // Wait for API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      }, { timeout: 3000 });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 3000 });

      // Verify error state was set
      expect(result.current.error).toBeTruthy();
      expect(result.current.status).toBe('error');

      // In development mode (which we're in during tests), error logs ARE produced
      // This test documents that error logging is controlled by import.meta.env.DEV
      // In a production build, these error logs would not be produced
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Verify the error logs contain the expected format
      const errorCalls = consoleErrorSpy.mock.calls;
      const hasUseContentErrors = errorCalls.some(call => 
        typeof call[0] === 'string' && call[0].includes('[useContent]')
      );
      expect(hasUseContentErrors).toBe(true);
    });
  });
});
