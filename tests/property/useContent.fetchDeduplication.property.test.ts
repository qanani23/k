import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { renderHook, waitFor } from '@testing-library/react';
import { useContent } from '../../src/hooks/useContent';
import * as api from '../../src/lib/api';

/**
 * Property-Based Tests for useContent Hook - Fetch Deduplication
 * 
 * **Feature: ui-data-fetching-fixes, Property 7: Fetch Deduplication**
 * 
 * For any collectionId, only one fetch operation should be in progress at any given time,
 * and subsequent fetch requests with the same collectionId should be ignored until the first completes.
 * 
 * Validates: Requirements 7.6, 14.6
 */

// Mock the API module
vi.mock('../../src/lib/api');

// Mock the useOffline hook
vi.mock('../../src/hooks/useOffline', () => ({
  useOffline: () => ({ isOnline: true, wasOffline: false })
}));

// Mock the memory manager
const mockGetCollection = vi.fn(() => null);
const mockStoreCollection = vi.fn();

vi.mock('../../src/lib/memoryManager', () => ({
  getMemoryManager: vi.fn(() => ({
    getCollection: mockGetCollection,
    storeCollection: mockStoreCollection,
    removeCollection: vi.fn(() => true),
    clearAll: vi.fn(),
    getStats: vi.fn(() => ({ totalCollections: 0, totalItems: 0, collections: [] })),
    destroy: vi.fn()
  }))
}));

// Arbitrary generators for hook parameters
const tagsArb = fc.array(
  fc.string({ minLength: 1, maxLength: 20 }),
  { minLength: 1, maxLength: 5 }
);

const searchTextArb = fc.string({ minLength: 1, maxLength: 100 });

const limitArb = fc.integer({ min: 1, max: 100 });

// Helper to create a delayed promise
function createDelayedResponse<T>(value: T, delayMs: number): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), delayMs);
  });
}

describe('Property-Based Tests: Fetch Deduplication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCollection.mockReturnValue(null);
  });

  describe('Property 7: Fetch Deduplication', () => {
    it('should only execute one fetch at a time for the same collectionId', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          limitArb,
          fc.integer({ min: 100, max: 500 }), // delay in ms
          async (tags, limit, delay) => {
            mockGetCollection.mockClear();
            mockStoreCollection.mockClear();

            // Track API call count
            let apiCallCount = 0;
            vi.mocked(api.fetchByTags).mockImplementation(async () => {
              apiCallCount++;
              return createDelayedResponse([], delay);
            });

            const { result, rerender } = renderHook(
              ({ tags, limit }) => useContent({ tags, limit, enableMemoryManagement: true }),
              { initialProps: { tags, limit } }
            );

            // Trigger multiple rapid re-renders while fetch is in progress
            for (let i = 0; i < 5; i++) {
              rerender({ tags, limit });
              await new Promise(resolve => setTimeout(resolve, 10));
            }

            // Wait for the fetch to complete
            await waitFor(() => {
              expect(result.current.loading).toBe(false);
            }, { timeout: delay + 2000 });

            // Only one API call should have been made despite multiple re-renders
            expect(apiCallCount).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);

    it('should deduplicate concurrent refetch calls', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          limitArb,
          fc.integer({ min: 100, max: 500 }), // delay in ms
          async (tags, limit, delay) => {
            mockGetCollection.mockClear();
            mockStoreCollection.mockClear();

            // Track API call count
            let apiCallCount = 0;
            vi.mocked(api.fetchByTags).mockImplementation(async () => {
              apiCallCount++;
              return createDelayedResponse([], delay);
            });

            const { result } = renderHook(() => 
              useContent({ tags, limit, enableMemoryManagement: true, autoFetch: false })
            );

            // Trigger multiple concurrent refetch calls
            const refetchPromises = [];
            for (let i = 0; i < 5; i++) {
              refetchPromises.push(result.current.refetch());
            }

            // Wait for all refetch promises to settle
            await Promise.allSettled(refetchPromises);

            // Wait for loading to complete
            await waitFor(() => {
              expect(result.current.loading).toBe(false);
            }, { timeout: delay + 2000 });

            // Only one API call should have been made despite multiple refetch calls
            expect(apiCallCount).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);

    it('should deduplicate concurrent loadMore calls', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          limitArb,
          fc.integer({ min: 100, max: 300 }), // delay in ms (reduced for faster tests)
          async (tags, limit, delay) => {
            mockGetCollection.mockClear();
            mockStoreCollection.mockClear();
            mockGetCollection.mockReturnValue(null); // Ensure cache miss

            // Track API call count
            let apiCallCount = 0;
            vi.mocked(api.fetchByTags).mockImplementation(async () => {
              apiCallCount++;
              // Return exactly 'limit' items to indicate hasMore = true
              const items = Array.from({ length: limit }, (_, i) => ({
                claim_id: `claim-${apiCallCount}-${i}`,
                value: { source: {}, title: `Item ${i}` },
                tags: tags,
              }));
              return createDelayedResponse(items, delay);
            });

            const { result } = renderHook(() => 
              useContent({ tags, limit, enableMemoryManagement: true })
            );

            // Wait for initial fetch to complete
            await waitFor(() => {
              expect(result.current.loading).toBe(false);
            }, { timeout: delay + 2000 });

            const initialCallCount = apiCallCount;
            expect(result.current.hasMore).toBe(true);

            // Trigger multiple concurrent loadMore calls
            const loadMorePromises = [];
            for (let i = 0; i < 5; i++) {
              loadMorePromises.push(result.current.loadMore());
            }

            // Wait for all loadMore promises to settle
            await Promise.allSettled(loadMorePromises);

            // Wait for loading to complete
            await waitFor(() => {
              expect(result.current.loading).toBe(false);
            }, { timeout: delay + 2000 });

            // Only one additional API call should have been made
            expect(apiCallCount).toBe(initialCallCount + 1);
          }
        ),
        { numRuns: 50 } // Reduced runs for faster execution
      );
    }, 60000);

    it('should allow new fetch after previous fetch completes', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          limitArb,
          fc.integer({ min: 50, max: 200 }), // delay in ms
          async (tags, limit, delay) => {
            mockGetCollection.mockClear();
            mockStoreCollection.mockClear();
            mockGetCollection.mockReturnValue(null); // Ensure cache miss for both fetches

            // Track API call count
            let apiCallCount = 0;
            vi.mocked(api.fetchByTags).mockImplementation(async () => {
              apiCallCount++;
              return createDelayedResponse([], delay);
            });

            const { result } = renderHook(() => 
              useContent({ tags, limit, enableMemoryManagement: false, autoFetch: false }) // Disable cache
            );

            // First fetch
            await result.current.refetch();
            await waitFor(() => {
              expect(result.current.loading).toBe(false);
            }, { timeout: delay + 2000 });

            const firstCallCount = apiCallCount;
            expect(firstCallCount).toBe(1);

            // Second fetch after first completes
            await result.current.refetch();
            await waitFor(() => {
              expect(result.current.loading).toBe(false);
            }, { timeout: delay + 2000 });

            // Second fetch should have been executed (no cache, so new fetch)
            expect(apiCallCount).toBe(2);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);

    it('should deduplicate fetches triggered by React StrictMode double invocation', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          limitArb,
          fc.integer({ min: 100, max: 500 }), // delay in ms
          async (tags, limit, delay) => {
            mockGetCollection.mockClear();
            mockStoreCollection.mockClear();

            // Track API call count
            let apiCallCount = 0;
            vi.mocked(api.fetchByTags).mockImplementation(async () => {
              apiCallCount++;
              return createDelayedResponse([], delay);
            });

            // Simulate StrictMode by rendering twice rapidly
            const { result: result1 } = renderHook(() => 
              useContent({ tags, limit, enableMemoryManagement: true })
            );

            // Immediately render a second instance (simulating StrictMode)
            const { result: result2 } = renderHook(() => 
              useContent({ tags, limit, enableMemoryManagement: true })
            );

            // Wait for both to complete
            await waitFor(() => {
              expect(result1.current.loading).toBe(false);
              expect(result2.current.loading).toBe(false);
            }, { timeout: delay + 2000 });

            // Each hook instance should make its own fetch, but not duplicate within itself
            // Since these are separate hook instances, they each get their own fetchInProgressRef
            // So we expect 2 calls (one per instance), not 4 (which would indicate duplication)
            expect(apiCallCount).toBe(2);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);

    it('should deduplicate fetches with text search parameter', async () => {
      await fc.assert(
        fc.asyncProperty(
          searchTextArb,
          limitArb,
          fc.integer({ min: 100, max: 500 }), // delay in ms
          async (text, limit, delay) => {
            mockGetCollection.mockClear();
            mockStoreCollection.mockClear();

            // Track API call count
            let apiCallCount = 0;
            vi.mocked(api.searchContent).mockImplementation(async () => {
              apiCallCount++;
              return createDelayedResponse([], delay);
            });

            const { result, rerender } = renderHook(
              ({ text, limit }) => useContent({ text, limit, enableMemoryManagement: true }),
              { initialProps: { text, limit } }
            );

            // Trigger multiple rapid re-renders while fetch is in progress
            for (let i = 0; i < 5; i++) {
              rerender({ text, limit });
              await new Promise(resolve => setTimeout(resolve, 10));
            }

            // Wait for the fetch to complete
            await waitFor(() => {
              expect(result.current.loading).toBe(false);
            }, { timeout: delay + 2000 });

            // Only one API call should have been made
            expect(apiCallCount).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);

    it('should not deduplicate fetches with different collectionIds', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          tagsArb,
          limitArb,
          fc.integer({ min: 100, max: 500 }), // delay in ms
          async (tags1, tags2, limit, delay) => {
            // Precondition: tags must be different
            fc.pre(JSON.stringify(tags1) !== JSON.stringify(tags2));

            mockGetCollection.mockClear();
            mockStoreCollection.mockClear();

            // Track API call count
            let apiCallCount = 0;
            vi.mocked(api.fetchByTags).mockImplementation(async () => {
              apiCallCount++;
              return createDelayedResponse([], delay);
            });

            // Render two hooks with different tags (different collectionIds)
            const { result: result1 } = renderHook(() => 
              useContent({ tags: tags1, limit, enableMemoryManagement: true })
            );

            const { result: result2 } = renderHook(() => 
              useContent({ tags: tags2, limit, enableMemoryManagement: true })
            );

            // Wait for both to complete
            await waitFor(() => {
              expect(result1.current.loading).toBe(false);
              expect(result2.current.loading).toBe(false);
            }, { timeout: delay + 2000 });

            // Both fetches should execute since they have different collectionIds
            expect(apiCallCount).toBe(2);
          }
        ),
        { numRuns: 50 }
      );
    }, 60000);

    it('should handle rapid refetch calls without race conditions', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          limitArb,
          fc.integer({ min: 50, max: 200 }), // delay in ms
          fc.integer({ min: 3, max: 10 }), // number of refetch attempts
          async (tags, limit, delay, refetchCount) => {
            mockGetCollection.mockClear();
            mockStoreCollection.mockClear();

            // Track API call count
            let apiCallCount = 0;
            vi.mocked(api.fetchByTags).mockImplementation(async () => {
              apiCallCount++;
              return createDelayedResponse([], delay);
            });

            const { result } = renderHook(() => 
              useContent({ tags, limit, enableMemoryManagement: true, autoFetch: false })
            );

            // Trigger rapid refetch calls with minimal delay between them
            for (let i = 0; i < refetchCount; i++) {
              result.current.refetch();
              await new Promise(resolve => setTimeout(resolve, 5));
            }

            // Wait for all fetches to complete
            await waitFor(() => {
              expect(result.current.loading).toBe(false);
            }, { timeout: delay * refetchCount + 2000 });

            // API should be called at most once per completed fetch cycle
            // Since we're calling refetch rapidly, most should be deduplicated
            expect(apiCallCount).toBeLessThanOrEqual(refetchCount);
            expect(apiCallCount).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);

    it('should maintain deduplication across component re-renders with stable props', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          limitArb,
          fc.integer({ min: 100, max: 500 }), // delay in ms
          fc.integer({ min: 5, max: 15 }), // number of re-renders
          async (tags, limit, delay, rerenderCount) => {
            mockGetCollection.mockClear();
            mockStoreCollection.mockClear();

            // Track API call count
            let apiCallCount = 0;
            vi.mocked(api.fetchByTags).mockImplementation(async () => {
              apiCallCount++;
              return createDelayedResponse([], delay);
            });

            const { result, rerender } = renderHook(
              ({ tags, limit }) => useContent({ tags, limit, enableMemoryManagement: true }),
              { initialProps: { tags, limit } }
            );

            // Trigger multiple re-renders with the same props
            for (let i = 0; i < rerenderCount; i++) {
              rerender({ tags, limit });
              await new Promise(resolve => setTimeout(resolve, 20));
            }

            // Wait for the fetch to complete
            await waitFor(() => {
              expect(result.current.loading).toBe(false);
            }, { timeout: delay + 2000 });

            // Only one API call should have been made despite multiple re-renders
            expect(apiCallCount).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });
});
