import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { MemoryManager } from '../../src/lib/memoryManager';
import { ContentItem } from '../../src/types';

/**
 * Property-Based Tests for Memory Manager - Cache Round Trip
 * 
 * **Feature: ui-data-fetching-fixes, Property 8: Cache Storage and Retrieval Round Trip**
 * 
 * For any content array stored in the Memory_Manager cache with a given collectionId, 
 * retrieving from the cache with the same collectionId should return an equivalent content array.
 * 
 * Validates: Requirements 9.2
 */

// Arbitrary generators for test data

// Generate a valid ContentItem
const contentItemArb = fc.record({
  claim_id: fc.string({ minLength: 1, maxLength: 40 }),
  title: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
  thumbnail_url: fc.option(fc.webUrl()),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 10 }),
  value: fc.record({
    source: fc.record({
      url: fc.option(fc.webUrl())
    }),
    video: fc.option(fc.record({
      duration: fc.integer({ min: 1, max: 10000 })
    }))
  })
}) as fc.Arbitrary<ContentItem>;

// Generate an array of ContentItems
const contentArrayArb = fc.array(contentItemArb, { minLength: 0, maxLength: 50 });

// Generate a valid collectionId
const collectionIdArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);

describe('Property-Based Tests: Memory Manager Cache Round Trip', () => {
  describe('Property 8: Cache Storage and Retrieval Round Trip', () => {
    it('should retrieve the same content array that was stored', () => {
      fc.assert(
        fc.property(
          collectionIdArb,
          contentArrayArb,
          (collectionId, contentArray) => {
            // Create a fresh memory manager for each iteration
            const memoryManager = new MemoryManager({ autoCleanup: false });

            // Store the content
            memoryManager.storeCollection(collectionId, contentArray);

            // Retrieve the content
            const retrieved = memoryManager.getCollection(collectionId);

            // The retrieved content should not be null
            expect(retrieved).not.toBeNull();

            // The retrieved content should have the same length
            expect(retrieved).toHaveLength(contentArray.length);

            // Each item should be equivalent
            if (retrieved) {
              for (let i = 0; i < contentArray.length; i++) {
                expect(retrieved[i]).toEqual(contentArray[i]);
              }
            }

            // Cleanup
            memoryManager.destroy();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty content arrays', () => {
      fc.assert(
        fc.property(
          collectionIdArb,
          (collectionId) => {
            // Create a fresh memory manager for each iteration
            const memoryManager = new MemoryManager({ autoCleanup: false });
            const emptyArray: ContentItem[] = [];

            // Store empty array
            memoryManager.storeCollection(collectionId, emptyArray);

            // Retrieve the content
            const retrieved = memoryManager.getCollection(collectionId);

            // Should retrieve an empty array, not null
            expect(retrieved).not.toBeNull();
            expect(retrieved).toHaveLength(0);

            // Cleanup
            memoryManager.destroy();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain content integrity across multiple store/retrieve cycles', () => {
      fc.assert(
        fc.property(
          collectionIdArb,
          contentArrayArb,
          fc.integer({ min: 2, max: 5 }),
          (collectionId, contentArray, cycles) => {
            // Create a fresh memory manager for each iteration
            const memoryManager = new MemoryManager({ autoCleanup: false });
            let currentContent = contentArray;

            for (let i = 0; i < cycles; i++) {
              // Store the content
              memoryManager.storeCollection(collectionId, currentContent);

              // Retrieve the content
              const retrieved = memoryManager.getCollection(collectionId);

              // Verify integrity
              expect(retrieved).not.toBeNull();
              expect(retrieved).toHaveLength(currentContent.length);

              if (retrieved) {
                for (let j = 0; j < currentContent.length; j++) {
                  expect(retrieved[j]).toEqual(currentContent[j]);
                }

                // Use retrieved content for next cycle
                currentContent = retrieved;
              }
            }

            // Cleanup
            memoryManager.destroy();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return null for non-existent collectionIds', () => {
      fc.assert(
        fc.property(
          collectionIdArb,
          (collectionId) => {
            // Create a fresh memory manager for each iteration
            const memoryManager = new MemoryManager({ autoCleanup: false });

            // Try to retrieve without storing
            const retrieved = memoryManager.getCollection(collectionId);

            // Should return null for non-existent collection
            expect(retrieved).toBeNull();

            // Cleanup
            memoryManager.destroy();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should isolate different collectionIds', () => {
      fc.assert(
        fc.property(
          collectionIdArb,
          collectionIdArb,
          contentArrayArb,
          contentArrayArb,
          (collectionId1, collectionId2, content1, content2) => {
            // Precondition: collectionIds must be different
            fc.pre(collectionId1 !== collectionId2);

            // Create a fresh memory manager for each iteration
            const memoryManager = new MemoryManager({ autoCleanup: false });

            // Store different content under different IDs
            memoryManager.storeCollection(collectionId1, content1);
            memoryManager.storeCollection(collectionId2, content2);

            // Retrieve both
            const retrieved1 = memoryManager.getCollection(collectionId1);
            const retrieved2 = memoryManager.getCollection(collectionId2);

            // Each should retrieve its own content
            expect(retrieved1).not.toBeNull();
            expect(retrieved2).not.toBeNull();

            if (retrieved1 && retrieved2) {
              expect(retrieved1).toHaveLength(content1.length);
              expect(retrieved2).toHaveLength(content2.length);

              // Verify content1 matches retrieved1
              for (let i = 0; i < content1.length; i++) {
                expect(retrieved1[i]).toEqual(content1[i]);
              }

              // Verify content2 matches retrieved2
              for (let i = 0; i < content2.length; i++) {
                expect(retrieved2[i]).toEqual(content2[i]);
              }
            }

            // Cleanup
            memoryManager.destroy();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should update content when storing to the same collectionId', () => {
      fc.assert(
        fc.property(
          collectionIdArb,
          contentArrayArb,
          contentArrayArb,
          (collectionId, content1, content2) => {
            // Precondition: content arrays must be different
            fc.pre(JSON.stringify(content1) !== JSON.stringify(content2));

            // Create a fresh memory manager for each iteration
            const memoryManager = new MemoryManager({ autoCleanup: false });

            // Store first content
            memoryManager.storeCollection(collectionId, content1);

            // Retrieve and verify
            const retrieved1 = memoryManager.getCollection(collectionId);
            expect(retrieved1).not.toBeNull();
            if (retrieved1) {
              expect(retrieved1).toHaveLength(content1.length);
            }

            // Store second content with same ID (update)
            memoryManager.storeCollection(collectionId, content2);

            // Retrieve and verify it's the new content
            const retrieved2 = memoryManager.getCollection(collectionId);
            expect(retrieved2).not.toBeNull();
            if (retrieved2) {
              expect(retrieved2).toHaveLength(content2.length);

              // Should match content2, not content1
              for (let i = 0; i < content2.length; i++) {
                expect(retrieved2[i]).toEqual(content2[i]);
              }
            }

            // Cleanup
            memoryManager.destroy();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle content with special characters in fields', () => {
      fc.assert(
        fc.property(
          collectionIdArb,
          fc.array(
            fc.record({
              claim_id: fc.string({ minLength: 1, maxLength: 40 }),
              title: fc.option(fc.fullUnicodeString({ minLength: 1, maxLength: 100 })),
              thumbnail_url: fc.option(fc.webUrl()),
              tags: fc.array(fc.fullUnicodeString({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 10 }),
              value: fc.record({
                source: fc.record({
                  url: fc.option(fc.webUrl())
                })
              })
            }) as fc.Arbitrary<ContentItem>,
            { minLength: 1, maxLength: 20 }
          ),
          (collectionId, contentArray) => {
            // Create a fresh memory manager for each iteration
            const memoryManager = new MemoryManager({ autoCleanup: false });

            // Store content with unicode characters
            memoryManager.storeCollection(collectionId, contentArray);

            // Retrieve the content
            const retrieved = memoryManager.getCollection(collectionId);

            // Should preserve special characters
            expect(retrieved).not.toBeNull();
            if (retrieved) {
              expect(retrieved).toHaveLength(contentArray.length);

              for (let i = 0; i < contentArray.length; i++) {
                expect(retrieved[i]).toEqual(contentArray[i]);
              }
            }

            // Cleanup
            memoryManager.destroy();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should respect maxItemsInMemory limit', () => {
      fc.assert(
        fc.property(
          collectionIdArb,
          fc.array(contentItemArb, { minLength: 201, maxLength: 300 }),
          (collectionId, largeContentArray) => {
            // Create a memory manager with a specific limit
            const limitedManager = new MemoryManager({ 
              maxItemsInMemory: 200,
              autoCleanup: false 
            });

            // Store content exceeding the limit
            limitedManager.storeCollection(collectionId, largeContentArray);

            // Retrieve the content
            const retrieved = limitedManager.getCollection(collectionId);

            // Should be limited to maxItemsInMemory
            expect(retrieved).not.toBeNull();
            if (retrieved) {
              expect(retrieved.length).toBeLessThanOrEqual(200);
              
              // Should contain the first 200 items
              for (let i = 0; i < Math.min(200, largeContentArray.length); i++) {
                expect(retrieved[i]).toEqual(largeContentArray[i]);
              }
            }

            limitedManager.destroy();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should maintain reference equality for the same retrieval', () => {
      fc.assert(
        fc.property(
          collectionIdArb,
          contentArrayArb,
          (collectionId, contentArray) => {
            // Create a fresh memory manager for each iteration
            const memoryManager = new MemoryManager({ autoCleanup: false });

            // Store the content
            memoryManager.storeCollection(collectionId, contentArray);

            // Retrieve multiple times
            const retrieved1 = memoryManager.getCollection(collectionId);
            const retrieved2 = memoryManager.getCollection(collectionId);

            // Both retrievals should return the same reference
            expect(retrieved1).toBe(retrieved2);

            // Cleanup
            memoryManager.destroy();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle rapid store/retrieve operations', () => {
      fc.assert(
        fc.property(
          collectionIdArb,
          fc.array(contentArrayArb, { minLength: 5, maxLength: 10 }),
          (collectionId, contentArrays) => {
            // Create a fresh memory manager for each iteration
            const memoryManager = new MemoryManager({ autoCleanup: false });

            // Rapidly store and retrieve different content
            for (const contentArray of contentArrays) {
              memoryManager.storeCollection(collectionId, contentArray);
              
              const retrieved = memoryManager.getCollection(collectionId);
              
              expect(retrieved).not.toBeNull();
              if (retrieved) {
                expect(retrieved).toHaveLength(contentArray.length);
                
                for (let i = 0; i < contentArray.length; i++) {
                  expect(retrieved[i]).toEqual(contentArray[i]);
                }
              }
            }

            // Cleanup
            memoryManager.destroy();
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
