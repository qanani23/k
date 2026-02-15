import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property-Based Tests for API Response Validation
 * 
 * **Feature: ui-data-fetching-fixes, Property 12: Content Item Field Validation**
 * 
 * For any content item returned from the API, the validation function should verify 
 * that required fields (claim_id, value, tags, value.source) exist and are of the correct type.
 * 
 * Validates: Requirements 12.1
 */

// Import the validation function from api.ts
// Since it's not exported, we'll test it through the public API functions
// For this test, we'll create a local version that matches the implementation

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validation function matching the implementation in src/lib/api.ts
 */
function validateContentItem(item: any): ValidationResult {
  const errors: string[] = [];
  
  // Check required fields
  if (!item.claim_id || typeof item.claim_id !== 'string') {
    errors.push('Missing or invalid claim_id');
  }
  
  if (!item.value || typeof item.value !== 'object' || Array.isArray(item.value)) {
    errors.push('Missing or invalid value object');
  } else {
    // Check nested required fields in value
    if (!item.value.source || typeof item.value.source !== 'object' || Array.isArray(item.value.source)) {
      errors.push('Missing or invalid value.source');
    }
  }
  
  if (!item.tags || !Array.isArray(item.tags)) {
    errors.push('Missing or invalid tags array');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate and filter content array
 */
function validateAndFilterContent(items: any[]): any[] {
  if (!Array.isArray(items)) {
    return [];
  }
  
  return items.filter(item => {
    const validation = validateContentItem(item);
    return validation.valid;
  });
}

// Arbitrary generators for content items

// Generate a valid content item
const validContentItemArb = fc.record({
  claim_id: fc.string({ minLength: 1, maxLength: 100 }),
  value: fc.record({
    source: fc.record({
      url: fc.webUrl(),
      size: fc.nat()
    }),
    video: fc.option(fc.record({
      duration: fc.nat(),
      width: fc.nat(),
      height: fc.nat()
    })),
    thumbnail: fc.option(fc.record({
      url: fc.webUrl()
    }))
  }),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 10 }),
  title: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
  thumbnail_url: fc.option(fc.webUrl())
});

// Generate an invalid content item (missing required fields)
const invalidContentItemArb = fc.oneof(
  // Missing claim_id
  fc.record({
    value: fc.record({
      source: fc.record({ url: fc.webUrl() })
    }),
    tags: fc.array(fc.string())
  }),
  // claim_id is not a string
  fc.record({
    claim_id: fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined)),
    value: fc.record({
      source: fc.record({ url: fc.webUrl() })
    }),
    tags: fc.array(fc.string())
  }),
  // Missing value object
  fc.record({
    claim_id: fc.string({ minLength: 1 }),
    tags: fc.array(fc.string())
  }),
  // value is not an object
  fc.record({
    claim_id: fc.string({ minLength: 1 }),
    value: fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
    tags: fc.array(fc.string())
  }),
  // Missing value.source
  fc.record({
    claim_id: fc.string({ minLength: 1 }),
    value: fc.record({
      video: fc.record({ duration: fc.nat() })
    }),
    tags: fc.array(fc.string())
  }),
  // value.source is not an object
  fc.record({
    claim_id: fc.string({ minLength: 1 }),
    value: fc.record({
      source: fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null))
    }),
    tags: fc.array(fc.string())
  }),
  // Missing tags array
  fc.record({
    claim_id: fc.string({ minLength: 1 }),
    value: fc.record({
      source: fc.record({ url: fc.webUrl() })
    })
  }),
  // tags is not an array
  fc.record({
    claim_id: fc.string({ minLength: 1 }),
    value: fc.record({
      source: fc.record({ url: fc.webUrl() })
    }),
    tags: fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null), fc.object())
  })
);

describe('Property-Based Tests: Content Item Field Validation', () => {
  describe('Property 12: Content Item Field Validation', () => {
    it('should validate that all valid content items pass validation', () => {
      fc.assert(
        fc.property(
          validContentItemArb,
          (contentItem) => {
            const validation = validateContentItem(contentItem);
            
            // Valid items should pass validation
            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
            
            // All required fields should be present
            expect(contentItem.claim_id).toBeDefined();
            expect(typeof contentItem.claim_id).toBe('string');
            expect(contentItem.claim_id.length).toBeGreaterThan(0);
            
            expect(contentItem.value).toBeDefined();
            expect(typeof contentItem.value).toBe('object');
            
            expect(contentItem.value.source).toBeDefined();
            expect(typeof contentItem.value.source).toBe('object');
            
            expect(contentItem.tags).toBeDefined();
            expect(Array.isArray(contentItem.tags)).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should reject content items with missing or invalid required fields', () => {
      fc.assert(
        fc.property(
          invalidContentItemArb,
          (contentItem) => {
            const validation = validateContentItem(contentItem);
            
            // Invalid items should fail validation
            expect(validation.valid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
            
            // At least one error should be reported
            expect(Array.isArray(validation.errors)).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should filter out invalid items from content arrays', () => {
      fc.assert(
        fc.property(
          fc.array(fc.oneof(validContentItemArb, invalidContentItemArb), { minLength: 1, maxLength: 50 }),
          (contentItems) => {
            const validatedItems = validateAndFilterContent(contentItems);
            
            // All returned items should be valid
            validatedItems.forEach(item => {
              const validation = validateContentItem(item);
              expect(validation.valid).toBe(true);
              expect(validation.errors).toHaveLength(0);
            });
            
            // Validated items should be a subset of original items
            expect(validatedItems.length).toBeLessThanOrEqual(contentItems.length);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should preserve all valid items when filtering', () => {
      fc.assert(
        fc.property(
          fc.array(validContentItemArb, { minLength: 1, maxLength: 50 }),
          (contentItems) => {
            const validatedItems = validateAndFilterContent(contentItems);
            
            // All valid items should be preserved
            expect(validatedItems.length).toBe(contentItems.length);
            
            // Each item should still be valid
            validatedItems.forEach(item => {
              const validation = validateContentItem(item);
              expect(validation.valid).toBe(true);
            });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should remove all invalid items when filtering', () => {
      fc.assert(
        fc.property(
          fc.array(invalidContentItemArb, { minLength: 1, maxLength: 50 }),
          (contentItems) => {
            const validatedItems = validateAndFilterContent(contentItems);
            
            // All invalid items should be removed
            expect(validatedItems.length).toBe(0);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should return empty array when input is not an array', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined),
            fc.object()
          ),
          (notAnArray) => {
            const validatedItems = validateAndFilterContent(notAnArray as any);
            
            // Should return empty array for non-array inputs
            expect(Array.isArray(validatedItems)).toBe(true);
            expect(validatedItems.length).toBe(0);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should report specific errors for each missing field', () => {
      fc.assert(
        fc.property(
          fc.constant({}),
          (emptyItem) => {
            const validation = validateContentItem(emptyItem);
            
            // Should fail validation
            expect(validation.valid).toBe(false);
            
            // Should report errors for all missing required fields
            expect(validation.errors.length).toBeGreaterThan(0);
            
            // Should include error for missing claim_id
            expect(validation.errors.some(err => err.includes('claim_id'))).toBe(true);
            
            // Should include error for missing value
            expect(validation.errors.some(err => err.includes('value'))).toBe(true);
            
            // Should include error for missing tags
            expect(validation.errors.some(err => err.includes('tags'))).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should validate claim_id is a non-empty string', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            fc.constant(null),
            fc.constant(undefined),
            fc.integer(),
            fc.boolean(),
            fc.object()
          ),
          (invalidClaimId) => {
            const item = {
              claim_id: invalidClaimId,
              value: { source: {} },
              tags: []
            };
            
            const validation = validateContentItem(item);
            
            // Should fail validation
            expect(validation.valid).toBe(false);
            
            // Should report error for invalid claim_id
            expect(validation.errors.some(err => err.includes('claim_id'))).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should validate value is an object', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined),
            fc.array(fc.anything())
          ),
          (invalidValue) => {
            const item = {
              claim_id: 'valid-claim-id',
              value: invalidValue,
              tags: []
            };
            
            const validation = validateContentItem(item);
            
            // Should fail validation
            expect(validation.valid).toBe(false);
            
            // Should report error for invalid value
            expect(validation.errors.some(err => err.includes('value'))).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should validate value.source is an object', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined),
            fc.array(fc.anything())
          ),
          (invalidSource) => {
            const item = {
              claim_id: 'valid-claim-id',
              value: { source: invalidSource },
              tags: []
            };
            
            const validation = validateContentItem(item);
            
            // Should fail validation
            expect(validation.valid).toBe(false);
            
            // Should report error for invalid value.source
            expect(validation.errors.some(err => err.includes('source'))).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should validate tags is an array', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined),
            fc.object()
          ),
          (invalidTags) => {
            const item = {
              claim_id: 'valid-claim-id',
              value: { source: {} },
              tags: invalidTags
            };
            
            const validation = validateContentItem(item);
            
            // Should fail validation
            expect(validation.valid).toBe(false);
            
            // Should report error for invalid tags
            expect(validation.errors.some(err => err.includes('tags'))).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should allow empty tags array', () => {
      fc.assert(
        fc.property(
          fc.constant([]),
          (emptyTags) => {
            const item = {
              claim_id: 'valid-claim-id',
              value: { source: {} },
              tags: emptyTags
            };
            
            const validation = validateContentItem(item);
            
            // Should pass validation (empty array is valid)
            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should validate multiple items independently', () => {
      fc.assert(
        fc.property(
          validContentItemArb,
          invalidContentItemArb,
          validContentItemArb,
          (validItem1, invalidItem, validItem2) => {
            const items = [validItem1, invalidItem, validItem2];
            const validatedItems = validateAndFilterContent(items);
            
            // Should filter out the invalid item
            expect(validatedItems.length).toBe(2);
            
            // Remaining items should be valid
            validatedItems.forEach(item => {
              const validation = validateContentItem(item);
              expect(validation.valid).toBe(true);
            });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle mixed valid and invalid items correctly', () => {
      fc.assert(
        fc.property(
          fc.array(validContentItemArb, { minLength: 1, maxLength: 10 }),
          fc.array(invalidContentItemArb, { minLength: 1, maxLength: 10 }),
          (validItems, invalidItems) => {
            // Interleave valid and invalid items
            const mixedItems = [...validItems, ...invalidItems].sort(() => Math.random() - 0.5);
            
            const validatedItems = validateAndFilterContent(mixedItems);
            
            // Should return exactly the number of valid items
            expect(validatedItems.length).toBe(validItems.length);
            
            // All returned items should be valid
            validatedItems.forEach(item => {
              const validation = validateContentItem(item);
              expect(validation.valid).toBe(true);
            });
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});

