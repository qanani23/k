import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { renderHook, waitFor } from '@testing-library/react';
import { useContent } from '../../src/hooks/useContent';
import * as api from '../../src/lib/api';
import { ContentItem } from '../../src/types';

/**
 * Property-Based Tests for useContent Hook - Success State Transition
 * 
 * **Feature: ui-data-fetching-fixes, Property 13: Success State Transition**
 * 
 * For any fetch operation that completes successfully, the status field should 
 * transition from 'loading' to 'success', and the content array should be 
 * populated with the fetched items.
 * 
 * Validates: Requirements 15.1
 */

// Mock the API module
vi.mock('../../src/lib/api');

// Mock the useOffline hook
vi.mock('../../src/hooks/useOffline', () => ({
  useOffline: () => ({ isOnline: true, wasOffline: false })
}));

// Mock the memory manager
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

// Arbitrary generators for test data

// Generate valid tag arrays (non-whitespace-only strings)
const tagsArb = fc.array(
  fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  { minLength: 1, maxLength: 5 }
);

// Generate search text (non-whitespace-only strings)
const searchTextArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);

// Generate limit parameter
const limitArb = fc.integer({ min: 1, max: 100 });

// Generate valid content items
const contentItemArb = fc.record({
  claim_id: fc.string({ minLength: 1, maxLength: 40 }),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  thumbnail_url: fc.option(fc.webUrl()),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 10 }),
  value: fc.record({
    source: fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 })
    })
  })
}) as fc.Arbitrary<ContentItem>;

// Generate arrays of content items
const contentArrayArb = fc.array(contentItemArb, { minLength: 0, maxLength: 50 });

describe('Property-Based Tests: Success State Transition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 13: Success State Transition', () => {
    it('should transition from loading to success when fetch completes successfully with tags', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          limitArb,
          contentArrayArb,
          async (tags, limit, mockContent) => {
            // Mock successful API response
            vi.mocked(api.fetchByTags).mockResolvedValue(mockContent);

            const { result } = renderHook(() => 
              useContent({ tags, limit, enableMemoryManagement: false })
            );

            // With autoFetch=true (default), hook starts fetching immediately
            // Wait for the fetch to complete and reach success state
            await waitFor(() => {
              expect(result.current.status).toBe('success');
            }, { timeout: 3000 });

            // After successful fetch:
            // 1. Status should be 'success'
            expect(result.current.status).toBe('success');
            
            // 2. Loading should be false (derived from status)
            expect(result.current.loading).toBe(false);
            
            // 3. Content should be populated with fetched items
            expect(result.current.content).toEqual(mockContent);
            
            // 4. Error should be null
            expect(result.current.error).toBeNull();
            
            // 5. Content length should match mock data length
            expect(result.current.content.length).toBe(mockContent.length);
          }
        ),
        { numRuns: 50 }
      );
    }, 30000); // 30 second timeout for property test

    it('should transition from loading to success when fetch completes successfully with text search', async () => {
      await fc.assert(
        fc.asyncProperty(
          searchTextArb,
          limitArb,
          contentArrayArb,
          async (text, limit, mockContent) => {
            // Mock successful API response
            vi.mocked(api.searchContent).mockResolvedValue(mockContent);

            const { result } = renderHook(() => 
              useContent({ text, limit, enableMemoryManagement: false })
            );

            // With autoFetch=true (default), hook starts fetching immediately
            // Wait for the fetch to complete and reach success state
            await waitFor(() => {
              expect(result.current.status).toBe('success');
            }, { timeout: 3000 });

            // After successful fetch:
            // 1. Status should be 'success'
            expect(result.current.status).toBe('success');
            
            // 2. Loading should be false
            expect(result.current.loading).toBe(false);
            
            // 3. Content should be populated with fetched items
            expect(result.current.content).toEqual(mockContent);
            
            // 4. Error should be null
            expect(result.current.error).toBeNull();
            
            // 5. Content length should match mock data length
            expect(result.current.content.length).toBe(mockContent.length);
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);

    it('should transition from loading to success when fetch completes with empty results', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          limitArb,
          async (tags, limit) => {
            // Mock successful API response with empty array
            vi.mocked(api.fetchByTags).mockResolvedValue([]);

            const { result } = renderHook(() => 
              useContent({ tags, limit, enableMemoryManagement: false })
            );

            // With autoFetch=true (default), hook starts fetching immediately
            // Wait for the fetch to complete and reach success state
            await waitFor(() => {
              expect(result.current.status).toBe('success');
            }, { timeout: 3000 });

            // After successful fetch with empty results:
            // 1. Status should be 'success' (empty results are still successful)
            expect(result.current.status).toBe('success');
            
            // 2. Loading should be false
            expect(result.current.loading).toBe(false);
            
            // 3. Content should be an empty array
            expect(result.current.content).toEqual([]);
            
            // 4. Error should be null
            expect(result.current.error).toBeNull();
            
            // 5. hasMore should be false (no results means no more to load)
            expect(result.current.hasMore).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);

    it('should maintain success state after successful fetch until refetch is triggered', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          contentArrayArb,
          async (tags, mockContent) => {
            // Mock successful API response
            vi.mocked(api.fetchByTags).mockResolvedValue(mockContent);

            const { result, rerender } = renderHook(
              ({ tags }) => useContent({ tags, enableMemoryManagement: false }),
              { initialProps: { tags } }
            );

            // Wait for initial fetch to complete
            await waitFor(() => {
              expect(result.current.status).toBe('success');
            }, { timeout: 3000 });

            const initialContent = result.current.content;

            // Force multiple re-renders with same props
            for (let i = 0; i < 5; i++) {
              rerender({ tags });
              await new Promise(resolve => setTimeout(resolve, 50));
            }

            // Status should remain 'success'
            expect(result.current.status).toBe('success');
            
            // Content should remain the same
            expect(result.current.content).toEqual(initialContent);
            
            // Loading should remain false
            expect(result.current.loading).toBe(false);
          }
        ),
        { numRuns: 30 }
      );
    }, 30000);

    it('should transition back to loading then success when refetch is called', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          contentArrayArb,
          contentArrayArb,
          async (tags, mockContent1, mockContent2) => {
            // Precondition: ensure meaningfully different content
            // Check that arrays differ in length OR have different claim_ids
            const hasDifferentLength = mockContent1.length !== mockContent2.length;
            const hasDifferentClaimIds = mockContent1.length > 0 && mockContent2.length > 0 &&
              mockContent1[0].claim_id !== mockContent2[0].claim_id;
            
            fc.pre(
              (hasDifferentLength || hasDifferentClaimIds) &&
              mockContent1.length > 0 &&
              mockContent2.length > 0
            );

            // Clear all previous mocks
            vi.clearAllMocks();

            // Set up mock to return different content on consecutive calls
            vi.mocked(api.fetchByTags)
              .mockResolvedValueOnce(mockContent1)
              .mockResolvedValueOnce(mockContent2);

            const { result } = renderHook(() => 
              useContent({ tags, enableMemoryManagement: false })
            );

            // Wait for initial fetch to complete
            await waitFor(() => {
              expect(result.current.status).toBe('success');
            }, { timeout: 3000 });

            // Store initial content for comparison
            const initialContent = [...result.current.content];
            expect(initialContent).toEqual(mockContent1);

            // Trigger refetch
            result.current.refetch();

            // Wait a bit for refetch to start
            await new Promise(resolve => setTimeout(resolve, 100));

            // Wait for refetch to complete - it should transition through loading to success
            await waitFor(() => {
              expect(result.current.status).toBe('success');
              // Also check that content has actually changed
              expect(result.current.content).not.toEqual(initialContent);
            }, { timeout: 3000 });

            // After refetch completes, content should be updated
            const updatedContent = result.current.content;
            expect(updatedContent).toEqual(mockContent2);
            expect(result.current.loading).toBe(false);
          }
        ),
        { numRuns: 30 }
      );
    }, 30000);

    it('should populate content array with all fetched items preserving order', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          contentArrayArb,
          async (tags, mockContent) => {
            // Precondition: need at least some content to test order
            fc.pre(mockContent.length > 0);

            // Mock successful API response
            vi.mocked(api.fetchByTags).mockResolvedValue(mockContent);

            const { result } = renderHook(() => 
              useContent({ tags, enableMemoryManagement: false })
            );

            // Wait for fetch to complete
            await waitFor(() => {
              expect(result.current.status).toBe('success');
            }, { timeout: 3000 });

            // Content should match exactly (same order, same items)
            expect(result.current.content).toEqual(mockContent);
            
            // Verify each item is present in the same position
            mockContent.forEach((item, index) => {
              expect(result.current.content[index]).toEqual(item);
            });
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);

    it('should set hasMore correctly based on result count matching limit', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          limitArb,
          async (tags, limit) => {
            // Precondition: limit must be at least 2 to test both cases
            fc.pre(limit >= 2);

            // Generate content with exactly limit items
            const mockContentFull = Array.from({ length: limit }, (_, i) => ({
              claim_id: `claim-${i}`,
              title: `Content ${i}`,
              tags: ['test'],
              value: { source: { name: 'test' } }
            })) as ContentItem[];

            // Generate content with less than limit items
            const mockContentPartial = Array.from({ length: Math.floor(limit / 2) }, (_, i) => ({
              claim_id: `claim-${i}`,
              title: `Content ${i}`,
              tags: ['test'],
              value: { source: { name: 'test' } }
            })) as ContentItem[];

            // Test with full results (hasMore should be true)
            vi.mocked(api.fetchByTags).mockResolvedValue(mockContentFull);

            const { result: result1 } = renderHook(() => 
              useContent({ tags, limit, enableMemoryManagement: false })
            );

            await waitFor(() => {
              expect(result1.current.status).toBe('success');
            }, { timeout: 3000 });

            expect(result1.current.hasMore).toBe(true);

            // Test with partial results (hasMore should be false)
            vi.mocked(api.fetchByTags).mockResolvedValue(mockContentPartial);

            const { result: result2 } = renderHook(() => 
              useContent({ tags, limit, enableMemoryManagement: false })
            );

            await waitFor(() => {
              expect(result2.current.status).toBe('success');
            }, { timeout: 3000 });

            expect(result2.current.hasMore).toBe(false);
          }
        ),
        { numRuns: 30 }
      );
    }, 30000);

    it('should never remain in loading state after successful fetch completes', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          contentArrayArb,
          async (tags, mockContent) => {
            // Mock successful API response
            vi.mocked(api.fetchByTags).mockResolvedValue(mockContent);

            const { result } = renderHook(() => 
              useContent({ tags, enableMemoryManagement: false })
            );

            // Wait for fetch to complete
            await waitFor(() => {
              expect(result.current.status).toBe('success');
            }, { timeout: 3000 });

            // Give it extra time to ensure no state changes
            await new Promise(resolve => setTimeout(resolve, 500));

            // Status should still be success, not loading
            expect(result.current.status).toBe('success');
            expect(result.current.loading).toBe(false);
            
            // Content should be populated
            expect(result.current.content).toEqual(mockContent);
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);
  });
});
