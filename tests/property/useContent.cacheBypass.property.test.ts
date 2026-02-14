import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { renderHook, waitFor } from '@testing-library/react';
import { useContent } from '../../src/hooks/useContent';
import * as api from '../../src/lib/api';
import * as memoryManagerModule from '../../src/lib/memoryManager';
import { ContentItem } from '../../src/types';

/**
 * Property-Based Tests for useContent Hook - Cache Bypass
 * 
 * **Feature: ui-data-fetching-fixes, Property 9: Cache Bypass When Disabled**
 * 
 * For any useContent hook invocation with enableMemoryManagement: false, 
 * no content should be stored in or retrieved from the Memory_Manager cache.
 * 
 * Validates: Requirements 9.4
 */

// Mock the API
vi.mock('../../src/lib/api');

// Mock the offline hook
vi.mock('../../src/hooks/useOffline', () => ({
  useOffline: () => ({ isOnline: true }),
}));

// Arbitrary generators for test data

// Generate a valid ContentItem
const contentItemArb = fc.record({
  claim_id: fc.string({ minLength: 1, maxLength: 40 }),
  title: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
  thumbnail_url: fc.option(fc.webUrl()),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }),
  value: fc.record({
    source: fc.record({
      url: fc.option(fc.webUrl())
    }),
    video: fc.option(fc.record({
      duration: fc.integer({ min: 1, max: 10000 })
    }))
  }),
  video_urls: fc.option(fc.record({
    '720p': fc.webUrl()
  }))
}) as fc.Arbitrary<ContentItem>;

// Generate an array of ContentItems
const contentArrayArb = fc.array(contentItemArb, { minLength: 1, maxLength: 20 });

// Generate valid tags array
const tagsArb = fc.array(
  fc.constantFrom('movie', 'series', 'sitcom', 'kids', 'comedy_movies', 'action_movies'),
  { minLength: 1, maxLength: 3 }
);

describe('Property-Based Tests: useContent Cache Bypass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 9: Cache Bypass When Disabled', () => {
    it('should never call getMemoryManager when enableMemoryManagement is false', () => {
      fc.assert(
        fc.asyncProperty(
          tagsArb,
          contentArrayArb,
          async (tags, mockContent) => {
            // Spy on getMemoryManager
            const getMemoryManagerSpy = vi.spyOn(memoryManagerModule, 'getMemoryManager');
            
            // Mock API response
            vi.mocked(api.fetchByTags).mockResolvedValue(mockContent);

            const { result } = renderHook(() => 
              useContent({ 
                tags, 
                autoFetch: true, 
                enableMemoryManagement: false 
              })
            );

            // Wait for fetch to complete
            await waitFor(() => {
              expect(result.current.status).not.toBe('loading');
            }, { timeout: 3000 });

            // Verify getMemoryManager was NEVER called
            expect(getMemoryManagerSpy).not.toHaveBeenCalled();

            // Verify content was fetched from API
            expect(result.current.content.length).toBeGreaterThan(0);
            expect(result.current.status).toBe('success');

            getMemoryManagerSpy.mockRestore();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should never store content in cache when enableMemoryManagement is false', () => {
      fc.assert(
        fc.asyncProperty(
          tagsArb,
          contentArrayArb,
          async (tags, mockContent) => {
            const mockStoreCollection = vi.fn();
            const mockGetCollection = vi.fn(() => null);
            
            // Mock getMemoryManager to return a mock manager
            const getMemoryManagerSpy = vi.spyOn(memoryManagerModule, 'getMemoryManager').mockReturnValue({
              getCollection: mockGetCollection,
              storeCollection: mockStoreCollection,
              removeCollection: vi.fn(),
              clearAll: vi.fn(),
              getStats: vi.fn(),
              stopAutoCleanup: vi.fn(),
              destroy: vi.fn(),
            } as any);

            // Mock API response
            vi.mocked(api.fetchByTags).mockResolvedValue(mockContent);

            const { result } = renderHook(() => 
              useContent({ 
                tags, 
                autoFetch: true, 
                enableMemoryManagement: false 
              })
            );

            // Wait for fetch to complete
            await waitFor(() => {
              expect(result.current.status).not.toBe('loading');
            }, { timeout: 3000 });

            // Verify cache methods were NEVER called
            expect(mockGetCollection).not.toHaveBeenCalled();
            expect(mockStoreCollection).not.toHaveBeenCalled();

            // Verify content was fetched
            expect(result.current.content.length).toBeGreaterThan(0);
            expect(result.current.status).toBe('success');

            getMemoryManagerSpy.mockRestore();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should never retrieve content from cache when enableMemoryManagement is false', () => {
      fc.assert(
        fc.asyncProperty(
          tagsArb,
          contentArrayArb,
          contentArrayArb,
          async (tags, cachedContent, freshContent) => {
            // Precondition: cached and fresh content should be different
            fc.pre(JSON.stringify(cachedContent) !== JSON.stringify(freshContent));

            const mockGetCollection = vi.fn(() => cachedContent);
            const mockStoreCollection = vi.fn();
            
            // Mock getMemoryManager to return a manager with cached content
            const getMemoryManagerSpy = vi.spyOn(memoryManagerModule, 'getMemoryManager').mockReturnValue({
              getCollection: mockGetCollection,
              storeCollection: mockStoreCollection,
              removeCollection: vi.fn(),
              clearAll: vi.fn(),
              getStats: vi.fn(),
              stopAutoCleanup: vi.fn(),
              destroy: vi.fn(),
            } as any);

            // Mock API to return fresh content
            vi.mocked(api.fetchByTags).mockResolvedValue(freshContent);

            const { result } = renderHook(() => 
              useContent({ 
                tags, 
                autoFetch: true, 
                enableMemoryManagement: false 
              })
            );

            // Wait for fetch to complete
            await waitFor(() => {
              expect(result.current.status).not.toBe('loading');
            }, { timeout: 3000 });

            // Should get fresh content from API, not cached content
            expect(result.current.content).toHaveLength(freshContent.length);
            expect(result.current.fromCache).toBe(false);

            // Verify cache was never accessed
            expect(mockGetCollection).not.toHaveBeenCalled();

            // Verify API was called
            expect(api.fetchByTags).toHaveBeenCalled();

            getMemoryManagerSpy.mockRestore();
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should always fetch from API when cache is disabled, even with identical parameters', () => {
      fc.assert(
        fc.asyncProperty(
          tagsArb,
          contentArrayArb,
          fc.integer({ min: 2, max: 4 }),
          async (tags, mockContent, fetchCount) => {
            // Mock API response
            vi.mocked(api.fetchByTags).mockResolvedValue(mockContent);

            // Spy on getMemoryManager
            const getMemoryManagerSpy = vi.spyOn(memoryManagerModule, 'getMemoryManager');

            // Perform multiple fetches with same parameters
            for (let i = 0; i < fetchCount; i++) {
              const { result, unmount } = renderHook(() => 
                useContent({ 
                  tags, 
                  autoFetch: true, 
                  enableMemoryManagement: false 
                })
              );

              // Wait for fetch to complete
              await waitFor(() => {
                expect(result.current.status).not.toBe('loading');
              }, { timeout: 3000 });

              // Verify content was fetched
              expect(result.current.content.length).toBeGreaterThan(0);
              expect(result.current.status).toBe('success');

              // Clean up
              unmount();
            }

            // Verify API was called for each fetch (no caching)
            expect(api.fetchByTags).toHaveBeenCalledTimes(fetchCount);

            // Verify getMemoryManager was never called
            expect(getMemoryManagerSpy).not.toHaveBeenCalled();

            getMemoryManagerSpy.mockRestore();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should bypass cache for refetch operations when cache is disabled', () => {
      fc.assert(
        fc.asyncProperty(
          tagsArb,
          contentArrayArb,
          contentArrayArb,
          async (tags, initialContent, refetchContent) => {
            // Precondition: content should be different
            fc.pre(JSON.stringify(initialContent) !== JSON.stringify(refetchContent));

            // Spy on getMemoryManager
            const getMemoryManagerSpy = vi.spyOn(memoryManagerModule, 'getMemoryManager');

            // Mock API to return different content on each call
            vi.mocked(api.fetchByTags)
              .mockResolvedValueOnce(initialContent)
              .mockResolvedValueOnce(refetchContent);

            const { result } = renderHook(() => 
              useContent({ 
                tags, 
                autoFetch: true, 
                enableMemoryManagement: false 
              })
            );

            // Wait for initial fetch
            await waitFor(() => {
              expect(result.current.status).toBe('success');
            }, { timeout: 3000 });

            expect(result.current.content).toHaveLength(initialContent.length);

            // Trigger refetch
            await result.current.refetch();

            // Wait for refetch to complete
            await waitFor(() => {
              expect(result.current.content).toHaveLength(refetchContent.length);
            }, { timeout: 3000 });

            // Verify getMemoryManager was never called
            expect(getMemoryManagerSpy).not.toHaveBeenCalled();

            // Verify API was called twice (no caching)
            expect(api.fetchByTags).toHaveBeenCalledTimes(2);

            getMemoryManagerSpy.mockRestore();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should maintain cache bypass across component re-renders', () => {
      fc.assert(
        fc.asyncProperty(
          tagsArb,
          contentArrayArb,
          fc.integer({ min: 2, max: 5 }),
          async (tags, mockContent, rerenderCount) => {
            // Spy on getMemoryManager
            const getMemoryManagerSpy = vi.spyOn(memoryManagerModule, 'getMemoryManager');

            // Mock API response
            vi.mocked(api.fetchByTags).mockResolvedValue(mockContent);

            const { result, rerender } = renderHook(
              ({ tags }) => useContent({ 
                tags, 
                autoFetch: true, 
                enableMemoryManagement: false 
              }),
              { initialProps: { tags } }
            );

            // Wait for initial fetch
            await waitFor(() => {
              expect(result.current.status).toBe('success');
            }, { timeout: 3000 });

            // Trigger multiple re-renders
            for (let i = 0; i < rerenderCount; i++) {
              rerender({ tags });
              
              // Wait a bit for any potential side effects
              await new Promise(resolve => setTimeout(resolve, 50));
            }

            // Verify getMemoryManager was never called despite re-renders
            expect(getMemoryManagerSpy).not.toHaveBeenCalled();

            // Verify content is still available
            expect(result.current.content.length).toBeGreaterThan(0);

            getMemoryManagerSpy.mockRestore();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should not create memory manager instance when cache is disabled', () => {
      fc.assert(
        fc.asyncProperty(
          tagsArb,
          contentArrayArb,
          async (tags, mockContent) => {
            let memoryManagerCreated = false;
            
            // Spy on getMemoryManager to detect if it's called
            const getMemoryManagerSpy = vi.spyOn(memoryManagerModule, 'getMemoryManager')
              .mockImplementation(() => {
                memoryManagerCreated = true;
                return {
                  getCollection: vi.fn(),
                  storeCollection: vi.fn(),
                  removeCollection: vi.fn(),
                  clearAll: vi.fn(),
                  getStats: vi.fn(),
                  stopAutoCleanup: vi.fn(),
                  destroy: vi.fn(),
                } as any;
              });

            // Mock API response
            vi.mocked(api.fetchByTags).mockResolvedValue(mockContent);

            const { result } = renderHook(() => 
              useContent({ 
                tags, 
                autoFetch: true, 
                enableMemoryManagement: false 
              })
            );

            // Wait for fetch to complete
            await waitFor(() => {
              expect(result.current.status).not.toBe('loading');
            }, { timeout: 3000 });

            // Verify memory manager was never created
            expect(memoryManagerCreated).toBe(false);
            expect(getMemoryManagerSpy).not.toHaveBeenCalled();

            // Verify content was still fetched successfully
            expect(result.current.content.length).toBeGreaterThan(0);
            expect(result.current.status).toBe('success');

            getMemoryManagerSpy.mockRestore();
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
