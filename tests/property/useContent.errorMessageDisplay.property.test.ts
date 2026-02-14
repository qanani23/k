import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { renderHook, waitFor } from '@testing-library/react';
import { useContent } from '../../src/hooks/useContent';
import * as api from '../../src/lib/api';

/**
 * Property-Based Tests for useContent Hook - Error Message Display
 * 
 * **Feature: ui-data-fetching-fixes, Property 10: Error Message Display**
 * 
 * For any fetch operation that fails with an error, the application should 
 * set an error state containing a user-friendly message describing the 
 * failure reason.
 * 
 * Validates: Requirements 10.2
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

// Generate valid tag arrays
const tagsArb = fc.array(
  fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  { minLength: 1, maxLength: 5 }
);

// Generate search text
const searchTextArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);

// Generate limit parameter
const limitArb = fc.integer({ min: 1, max: 100 });

// Generate error scenarios with expected categorization
const errorScenarioArb = fc.oneof(
  // Timeout errors
  fc.record({
    errorMessage: fc.constantFrom(
      'Request timeout',
      'Request timed out',
      'Connection timeout',
      'The request timed out after 30 seconds'
    ),
    expectedCategory: fc.constant('timeout' as const),
    expectedRetryable: fc.constant(true),
    expectedMessagePattern: fc.constant(/timeout|timed out/i)
  }),
  // Network errors
  fc.record({
    errorMessage: fc.constantFrom(
      'Network error',
      'Failed to fetch',
      'Connection refused',
      'Network connection lost'
    ),
    expectedCategory: fc.constant('network' as const),
    expectedRetryable: fc.constant(true),
    expectedMessagePattern: fc.constant(/network|connection/i)
  }),
  // Offline errors
  fc.record({
    errorMessage: fc.constantFrom(
      'No internet connection',
      'Device is offline',
      'Offline mode'
    ),
    expectedCategory: fc.constant('offline' as const),
    expectedRetryable: fc.constant(false),
    expectedMessagePattern: fc.constant(/offline|internet/i)
  }),
  // Validation errors
  fc.record({
    errorMessage: fc.constantFrom(
      'Invalid response data',
      'Validation failed',
      'Invalid content format'
    ),
    expectedCategory: fc.constant('validation' as const),
    expectedRetryable: fc.constant(true),
    expectedMessagePattern: fc.constant(/invalid|validation/i)
  }),
  // Unknown/generic errors
  fc.record({
    errorMessage: fc.constantFrom(
      'Something went wrong',
      'Unexpected error occurred',
      'Internal error'
    ),
    expectedCategory: fc.constant('unknown' as const),
    expectedRetryable: fc.constant(true),
    expectedMessagePattern: fc.constant(/failed|error|try again/i)
  })
);

describe('Property-Based Tests: Error Message Display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 10: Error Message Display', () => {
    it('should display user-friendly error message for any fetch failure', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          errorScenarioArb,
          async (tags, scenario) => {
            // Mock API to reject with error
            const mockError = new Error(scenario.errorMessage);
            vi.mocked(api.fetchByTags).mockRejectedValue(mockError);

            const { result } = renderHook(() => 
              useContent({ tags, enableMemoryManagement: false })
            );

            // Wait for error state
            await waitFor(() => {
              expect(result.current.status).toBe('error');
            }, { timeout: 3000 });

            // Error should be populated with user-friendly message
            expect(result.current.error).not.toBeNull();
            expect(result.current.error?.message).toBeDefined();
            expect(typeof result.current.error?.message).toBe('string');
            expect(result.current.error?.message.length).toBeGreaterThan(0);
            
            // Message should match expected pattern for the error type
            expect(result.current.error?.message).toMatch(scenario.expectedMessagePattern);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should categorize errors correctly based on error type', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          errorScenarioArb,
          async (tags, scenario) => {
            // Mock API to reject with error
            const mockError = new Error(scenario.errorMessage);
            vi.mocked(api.fetchByTags).mockRejectedValue(mockError);

            const { result } = renderHook(() => 
              useContent({ tags, enableMemoryManagement: false })
            );

            // Wait for error state
            await waitFor(() => {
              expect(result.current.status).toBe('error');
            }, { timeout: 3000 });

            // Error should have correct category
            expect(result.current.error).not.toBeNull();
            expect(result.current.error?.category).toBe(scenario.expectedCategory);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should set retryable flag correctly based on error type', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          errorScenarioArb,
          async (tags, scenario) => {
            // Mock API to reject with error
            const mockError = new Error(scenario.errorMessage);
            vi.mocked(api.fetchByTags).mockRejectedValue(mockError);

            const { result } = renderHook(() => 
              useContent({ tags, enableMemoryManagement: false })
            );

            // Wait for error state
            await waitFor(() => {
              expect(result.current.status).toBe('error');
            }, { timeout: 3000 });

            // Error should have correct retryable flag
            expect(result.current.error).not.toBeNull();
            expect(result.current.error?.retryable).toBe(scenario.expectedRetryable);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should include error details for debugging', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          errorScenarioArb,
          async (tags, scenario) => {
            // Mock API to reject with error
            const mockError = new Error(scenario.errorMessage);
            vi.mocked(api.fetchByTags).mockRejectedValue(mockError);

            const { result } = renderHook(() => 
              useContent({ tags, enableMemoryManagement: false })
            );

            // Wait for error state
            await waitFor(() => {
              expect(result.current.status).toBe('error');
            }, { timeout: 3000 });

            // Error should include details field
            expect(result.current.error).not.toBeNull();
            expect(result.current.error?.details).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should display error message for search text failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          searchTextArb,
          errorScenarioArb,
          async (text, scenario) => {
            // Mock API to reject with error
            const mockError = new Error(scenario.errorMessage);
            vi.mocked(api.searchContent).mockRejectedValue(mockError);

            const { result } = renderHook(() => 
              useContent({ text, enableMemoryManagement: false })
            );

            // Wait for error state
            await waitFor(() => {
              expect(result.current.status).toBe('error');
            }, { timeout: 3000 });

            // Error should be populated with user-friendly message
            expect(result.current.error).not.toBeNull();
            expect(result.current.error?.message).toBeDefined();
            expect(typeof result.current.error?.message).toBe('string');
            expect(result.current.error?.message.length).toBeGreaterThan(0);
            
            // Message should match expected pattern
            expect(result.current.error?.message).toMatch(scenario.expectedMessagePattern);
            
            // Should have correct category
            expect(result.current.error?.category).toBe(scenario.expectedCategory);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should handle non-Error objects with fallback message', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          fc.oneof(
            fc.string({ minLength: 1, maxLength: 100 }),
            fc.integer(),
            fc.record({ code: fc.integer(), message: fc.string() })
          ),
          async (tags, errorObject) => {
            // Mock API to reject with non-Error object
            vi.mocked(api.fetchByTags).mockRejectedValue(errorObject);

            const { result } = renderHook(() => 
              useContent({ tags, enableMemoryManagement: false })
            );

            // Wait for error state
            await waitFor(() => {
              expect(result.current.status).toBe('error');
            }, { timeout: 3000 });

            // Should still provide user-friendly error message
            expect(result.current.error).not.toBeNull();
            expect(result.current.error?.message).toBeDefined();
            expect(typeof result.current.error?.message).toBe('string');
            expect(result.current.error?.message.length).toBeGreaterThan(0);
            
            // Should have fallback message
            expect(result.current.error?.message).toMatch(/unexpected|try again/i);
            
            // Should be categorized as unknown
            expect(result.current.error?.category).toBe('unknown');
            
            // Should include the original error in details
            expect(result.current.error?.details).toBe(errorObject);
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);

    it('should preserve error message across re-renders', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          errorScenarioArb,
          async (tags, scenario) => {
            // Mock API to reject with error
            const mockError = new Error(scenario.errorMessage);
            vi.mocked(api.fetchByTags).mockRejectedValue(mockError);

            const { result, rerender } = renderHook(
              ({ tags }) => useContent({ tags, enableMemoryManagement: false }),
              { initialProps: { tags } }
            );

            // Wait for error state
            await waitFor(() => {
              expect(result.current.status).toBe('error');
            }, { timeout: 3000 });

            const initialErrorMessage = result.current.error?.message;
            const initialErrorCategory = result.current.error?.category;

            // Force multiple re-renders
            for (let i = 0; i < 5; i++) {
              rerender({ tags });
              await new Promise(resolve => setTimeout(resolve, 50));
            }

            // Error message should remain consistent
            expect(result.current.error?.message).toBe(initialErrorMessage);
            expect(result.current.error?.category).toBe(initialErrorCategory);
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);

    it('should provide different messages for different error types', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          errorScenarioArb,
          errorScenarioArb,
          async (tags, scenario1, scenario2) => {
            // Precondition: ensure different error categories
            fc.pre(scenario1.expectedCategory !== scenario2.expectedCategory);

            // Test first error
            vi.clearAllMocks();
            const mockError1 = new Error(scenario1.errorMessage);
            vi.mocked(api.fetchByTags).mockRejectedValue(mockError1);

            const { result: result1 } = renderHook(() => 
              useContent({ tags, enableMemoryManagement: false })
            );

            await waitFor(() => {
              expect(result1.current.status).toBe('error');
            }, { timeout: 3000 });

            const message1 = result1.current.error?.message;
            const category1 = result1.current.error?.category;

            // Test second error
            vi.clearAllMocks();
            const mockError2 = new Error(scenario2.errorMessage);
            vi.mocked(api.fetchByTags).mockRejectedValue(mockError2);

            const { result: result2 } = renderHook(() => 
              useContent({ tags, enableMemoryManagement: false })
            );

            await waitFor(() => {
              expect(result2.current.status).toBe('error');
            }, { timeout: 3000 });

            const message2 = result2.current.error?.message;
            const category2 = result2.current.error?.category;

            // Different error types should have different categories
            expect(category1).not.toBe(category2);
            
            // Messages should reflect their respective error types
            expect(message1).toMatch(scenario1.expectedMessagePattern);
            expect(message2).toMatch(scenario2.expectedMessagePattern);
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);

    it('should always provide a non-empty error message', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          fc.oneof(
            fc.constant(new Error('')), // Empty error message
            fc.constant(new Error('   ')), // Whitespace-only message
            fc.constant(null),
            fc.constant(undefined),
            fc.constant({})
          ),
          async (tags, errorValue) => {
            // Mock API to reject with various error values
            vi.mocked(api.fetchByTags).mockRejectedValue(errorValue);

            const { result } = renderHook(() => 
              useContent({ tags, enableMemoryManagement: false })
            );

            // Wait for error state
            await waitFor(() => {
              expect(result.current.status).toBe('error');
            }, { timeout: 3000 });

            // Should always provide a non-empty error message
            expect(result.current.error).not.toBeNull();
            expect(result.current.error?.message).toBeDefined();
            expect(typeof result.current.error?.message).toBe('string');
            expect(result.current.error?.message.trim().length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);
  });
});
