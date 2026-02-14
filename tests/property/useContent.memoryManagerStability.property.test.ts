import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { renderHook, waitFor } from '@testing-library/react';
import { useContent } from '../../src/hooks/useContent';
import * as api from '../../src/lib/api';

/**
 * Property-Based Tests for useContent Hook - Memory Manager Instance Stability
 * 
 * **Feature: ui-data-fetching-fixes, Property 6: Memory Manager Instance Stability**
 * 
 * For any single invocation of the useContent hook, the Memory_Manager instance 
 * should remain the same object reference across all renders until the component unmounts.
 * 
 * Validates: Requirements 7.4
 */

// Mock the API module
vi.mock('../../src/lib/api');

// Mock the useOffline hook
vi.mock('../../src/hooks/useOffline', () => ({
  useOffline: () => ({ isOnline: true, wasOffline: false })
}));

// Track Memory Manager call count
let getMemoryManagerCallCount = 0;

// Mock the memory manager to track instance creation
vi.mock('../../src/lib/memoryManager', () => ({
  getMemoryManager: vi.fn(() => {
    getMemoryManagerCallCount++;
    return {
      getCollection: vi.fn(() => null),
      storeCollection: vi.fn(),
      removeCollection: vi.fn(() => true),
      clearAll: vi.fn(),
      getStats: vi.fn(() => ({ totalCollections: 0, totalItems: 0, collections: [] })),
      destroy: vi.fn()
    };
  })
}));

// Arbitrary generators for hook parameters
const tagsArb = fc.array(
  fc.string({ minLength: 1, maxLength: 20 }),
  { minLength: 1, maxLength: 5 }
);

const limitArb = fc.integer({ min: 1, max: 100 });

describe('Property-Based Tests: Memory Manager Instance Stability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMemoryManagerCallCount = 0;
    vi.mocked(api.fetchByTags).mockResolvedValue([]);
    vi.mocked(api.searchContent).mockResolvedValue([]);
    vi.mocked(api.fetchChannelClaims).mockResolvedValue([]);
  });

  describe('Property 6: Memory Manager Instance Stability', () => {
    it('should use the same Memory Manager instance across multiple renders with stable props', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          limitArb,
          async (tags, limit) => {
            getMemoryManagerCallCount = 0;

            const { result, rerender } = renderHook(
              ({ tags, limit }) => useContent({ tags, limit, enableMemoryManagement: true }),
              { initialProps: { tags, limit } }
            );

            await waitFor(() => {
              expect(result.current.loading).toBe(false);
            }, { timeout: 10000 });

            const firstCallCount = getMemoryManagerCallCount;
            expect(firstCallCount).toBeGreaterThan(0);

            for (let i = 0; i < 10; i++) {
              rerender({ tags, limit });
            }

            await new Promise(resolve => setTimeout(resolve, 100));

            const finalCallCount = getMemoryManagerCallCount;
            expect(finalCallCount).toBe(firstCallCount);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);

    it('should use the same Memory Manager instance when tags change but enableMemoryManagement stays true', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          tagsArb,
          limitArb,
          async (tags1, tags2, limit) => {
            fc.pre(JSON.stringify(tags1) !== JSON.stringify(tags2));
            getMemoryManagerCallCount = 0;

            const { result, rerender } = renderHook(
              ({ tags, limit }) => useContent({ tags, limit, enableMemoryManagement: true }),
              { initialProps: { tags: tags1, limit } }
            );

            await waitFor(() => {
              expect(result.current.loading).toBe(false);
            }, { timeout: 10000 });

            const firstCallCount = getMemoryManagerCallCount;
            expect(firstCallCount).toBeGreaterThan(0);

            rerender({ tags: tags2, limit });

            await waitFor(() => {
              expect(result.current.loading).toBe(false);
            }, { timeout: 10000 });

            const finalCallCount = getMemoryManagerCallCount;
            expect(finalCallCount).toBe(firstCallCount);
          }
        ),
        { numRuns: 50 }
      );
    }, 60000);

    it('should not create Memory Manager instance when enableMemoryManagement is false', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          limitArb,
          async (tags, limit) => {
            getMemoryManagerCallCount = 0;

            const { result, rerender } = renderHook(
              ({ tags, limit }) => useContent({ tags, limit, enableMemoryManagement: false }),
              { initialProps: { tags, limit } }
            );

            await waitFor(() => {
              expect(result.current.loading).toBe(false);
            }, { timeout: 10000 });

            for (let i = 0; i < 10; i++) {
              rerender({ tags, limit });
            }

            await new Promise(resolve => setTimeout(resolve, 100));

            expect(getMemoryManagerCallCount).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });
});
