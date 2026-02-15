import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { renderHook, waitFor } from '@testing-library/react';
import { useContent } from '../../src/hooks/useContent';
import * as api from '../../src/lib/api';

/**
 * Property-Based Tests for useContent Hook - Error State Transition
 * 
 * **Feature: ui-data-fetching-fixes, Property 14: Error State Transition**
 * 
 * For any fetch operation that fails with an error, the status field should 
 * transition from 'loading' to 'error', and the error object should be 
 * populated with failure details.
 * 
 * Validates: Requirements 15.2
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

// Generate error messages
const errorMessageArb = fc.oneof(
  fc.constant('Network error'),
  fc.constant('Request timeout'),
  fc.constant('Server error'),
  fc.constant('Invalid response'),
  fc.constant('API rate limit exceeded'),
  fc.string({ minLength: 5, maxLength: 100 })
);

describe('Property-Based Tests: Error State Transition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 3: Loading State Resolution', () => {
    it('should transition from loading to error when fetch fails with tags', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          limitArb,
          errorMessageArb,
          async (tags, limit, errorMessage) => {
            // Mock API to reject with error
            const mockError = new Error(errorMessage);
            vi.mocked(api.fetchByTags).mockRejectedValue(mockError);

            const { result } = renderHook(() => 
              useContent({ tags, limit, enableMemoryManagement: false })
            );

            // With autoFetch=true (default), hook starts fetching immediately
            // Wait for the fetch to fail and reach error state
            await waitFor(() => {
              expect(result.current.status).toBe('error');
            }, { timeout: 3000 });

            // After failed fetch:
            // 1. Status should be 'error'
            expect(result.current.status).toBe('error');
            
            // 2. Loading should be false (derived from status)
            expect(result.current.loading).toBe(false);
            
            // 3. Error should be populated with failure details
            expect(result.current.error).not.toBeNull();
            expect(result.current.error?.message).toBe(errorMessage);
            
            // 4. Content should be empty array (cleared on error)
            expect(result.current.content).toEqual([]);
          }
        ),
        { numRuns: 50 }
      );
    }, 30000); // 30 second timeout for property test

    it('should transition from loading to error when fetch fails with text search', async () => {
      await fc.assert(
        fc.asyncProperty(
          searchTextArb,
          limitArb,
          errorMessageArb,
          async (text, limit, errorMessage) => {
            // Mock API to reject with error
            const mockError = new Error(errorMessage);
            vi.mocked(api.searchContent).mockRejectedValue(mockError);

            const { result } = renderHook(() => 
              useContent({ text, limit, enableMemoryManagement: false })
            );

            // Wait for the fetch to fail and reach error state
            await waitFor(() => {
              expect(result.current.status).toBe('error');
            }, { timeout: 3000 });

            // After failed fetch:
            // 1. Status should be 'error'
            expect(result.current.status).toBe('error');
            
            // 2. Loading should be false
            expect(result.current.loading).toBe(false);
            
            // 3. Error should be populated
            expect(result.current.error).not.toBeNull();
            expect(result.current.error?.message).toBe(errorMessage);
            
            // 4. Content should be empty
            expect(result.current.content).toEqual([]);
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);

    it('should populate error object with failure details', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          errorMessageArb,
          async (tags, errorMessage) => {
            // Mock API to reject with error
            const mockError = new Error(errorMessage);
            vi.mocked(api.fetchByTags).mockRejectedValue(mockError);

            const { result } = renderHook(() => 
              useContent({ tags, enableMemoryManagement: false })
            );

            // Wait for error state
            await waitFor(() => {
              expect(result.current.status).toBe('error');
            }, { timeout: 3000 });

            // Error object should contain the error details
            expect(result.current.error).not.toBeNull();
            expect(result.current.error?.message).toBe(errorMessage);
            expect(result.current.error?.details).toBeDefined();
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);

    it('should maintain error state until refetch is triggered', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          errorMessageArb,
          async (tags, errorMessage) => {
            // Mock API to reject with error
            const mockError = new Error(errorMessage);
            vi.mocked(api.fetchByTags).mockRejectedValue(mockError);

            const { result, rerender } = renderHook(
              ({ tags }) => useContent({ tags, enableMemoryManagement: false }),
              { initialProps: { tags } }
            );

            // Wait for error state
            await waitFor(() => {
              expect(result.current.status).toBe('error');
            }, { timeout: 3000 });

            const initialError = result.current.error;

            // Force multiple re-renders with same props
            for (let i = 0; i < 5; i++) {
              rerender({ tags });
              await new Promise(resolve => setTimeout(resolve, 50));
            }

            // Status should remain 'error'
            expect(result.current.status).toBe('error');
            
            // Error should remain the same
            expect(result.current.error).toEqual(initialError);
            
            // Loading should remain false
            expect(result.current.loading).toBe(false);
            
            // Content should remain empty
            expect(result.current.content).toEqual([]);
          }
        ),
        { numRuns: 30 }
      );
    }, 30000);

    it('should transition back to loading then error when refetch is called after error', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          errorMessageArb,
          errorMessageArb,
          async (tags, errorMessage1, errorMessage2) => {
            // Precondition: ensure different error messages
            fc.pre(errorMessage1 !== errorMessage2);

            // Clear all previous mocks
            vi.clearAllMocks();

            // Set up mock to return different errors on consecutive calls
            vi.mocked(api.fetchByTags)
              .mockRejectedValueOnce(new Error(errorMessage1))
              .mockRejectedValueOnce(new Error(errorMessage2));

            const { result } = renderHook(() => 
              useContent({ tags, enableMemoryManagement: false })
            );

            // Wait for initial error
            await waitFor(() => {
              expect(result.current.status).toBe('error');
            }, { timeout: 3000 });

            // Store initial error for comparison
            const initialError = result.current.error;
            expect(initialError?.message).toBe(errorMessage1);

            // Trigger refetch
            result.current.refetch();

            // Wait a bit for refetch to start
            await new Promise(resolve => setTimeout(resolve, 100));

            // Wait for refetch to complete - it should transition through loading to error
            await waitFor(() => {
              expect(result.current.status).toBe('error');
              // Also check that error has actually changed
              expect(result.current.error?.message).not.toBe(initialError?.message);
            }, { timeout: 3000 });

            // After refetch completes, error should be updated
            expect(result.current.error?.message).toBe(errorMessage2);
            expect(result.current.loading).toBe(false);
          }
        ),
        { numRuns: 30 }
      );
    }, 30000);

    it('should never remain in loading state after failed fetch completes', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          errorMessageArb,
          async (tags, errorMessage) => {
            // Mock API to reject with error
            const mockError = new Error(errorMessage);
            vi.mocked(api.fetchByTags).mockRejectedValue(mockError);

            const { result } = renderHook(() => 
              useContent({ tags, enableMemoryManagement: false })
            );

            // Wait for error state
            await waitFor(() => {
              expect(result.current.status).toBe('error');
            }, { timeout: 3000 });

            // Give it extra time to ensure no state changes
            await new Promise(resolve => setTimeout(resolve, 500));

            // Status should still be error, not loading
            expect(result.current.status).toBe('error');
            expect(result.current.loading).toBe(false);
            
            // Error should be populated
            expect(result.current.error).not.toBeNull();
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);

    it('should handle non-Error objects thrown by API', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          fc.string({ minLength: 1, maxLength: 100 }),
          async (tags, errorString) => {
            // Mock API to reject with non-Error object
            vi.mocked(api.fetchByTags).mockRejectedValue(errorString);

            const { result } = renderHook(() => 
              useContent({ tags, enableMemoryManagement: false })
            );

            // Wait for error state
            await waitFor(() => {
              expect(result.current.status).toBe('error');
            }, { timeout: 3000 });

            // Should still transition to error state
            expect(result.current.status).toBe('error');
            expect(result.current.loading).toBe(false);
            
            // Error should be populated with fallback message
            expect(result.current.error).not.toBeNull();
            expect(result.current.error?.message).toBe('Failed to fetch content');
            expect(result.current.error?.details).toBe(errorString);
          }
        ),
        { numRuns: 30 }
      );
    }, 30000);

    it('should clear previous content when fetch fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          errorMessageArb,
          async (tags, errorMessage) => {
            // Mock API to reject with error
            const mockError = new Error(errorMessage);
            vi.mocked(api.fetchByTags).mockRejectedValue(mockError);

            const { result } = renderHook(() => 
              useContent({ tags, enableMemoryManagement: false })
            );

            // Wait for error state
            await waitFor(() => {
              expect(result.current.status).toBe('error');
            }, { timeout: 3000 });

            // Content should be cleared (empty array)
            expect(result.current.content).toEqual([]);
            expect(result.current.content.length).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);

    it('should set error state correctly for different error types', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          fc.oneof(
            fc.constant('timeout'),
            fc.constant('network'),
            fc.constant('server'),
            fc.constant('unknown')
          ),
          async (tags, errorType) => {
            // Create different error types
            let mockError: Error;
            switch (errorType) {
              case 'timeout':
                mockError = new Error('Request timeout');
                break;
              case 'network':
                mockError = new Error('Network error');
                break;
              case 'server':
                mockError = new Error('Server error: 500');
                break;
              default:
                mockError = new Error('Unknown error');
            }

            vi.mocked(api.fetchByTags).mockRejectedValue(mockError);

            const { result } = renderHook(() => 
              useContent({ tags, enableMemoryManagement: false })
            );

            // Wait for error state
            await waitFor(() => {
              expect(result.current.status).toBe('error');
            }, { timeout: 3000 });

            // All error types should result in error state
            expect(result.current.status).toBe('error');
            expect(result.current.loading).toBe(false);
            expect(result.current.error).not.toBeNull();
            expect(result.current.error?.message).toBe(mockError.message);
          }
        ),
        { numRuns: 40 }
      );
    }, 30000);
  });
});
