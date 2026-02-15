import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { invoke } from '@tauri-apps/api/tauri';

/**
 * Property-Based Tests for API Wrapper Channel ID Inclusion
 * 
 * **Feature: pass-channel-id-from-frontend, Property 5: API wrapper channel ID inclusion**
 * 
 * For any call to fetchChannelClaims, fetchPlaylists, or fetchHeroContent, 
 * the API wrapper should include the configured channel_id parameter in the 
 * Tauri command invocation.
 * 
 * Validates: Requirements 2.3, 3.1, 3.2, 3.3
 */

// Mock the Tauri invoke function
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}));

// Arbitrary generators for API parameters

// Generate valid channel IDs (must start with '@')
const channelIdArb = fc.string({ minLength: 2, maxLength: 50 })
  .map(s => '@' + s.replace(/^@+/, '')); // Ensure starts with '@' and no duplicate '@'

// Generate tag arrays
const tagsArb = fc.array(
  fc.string({ minLength: 1, maxLength: 20 }),
  { minLength: 1, maxLength: 5 }
);

// Generate search text
const searchTextArb = fc.string({ minLength: 1, maxLength: 100 });

// Generate pagination parameters
const limitArb = fc.integer({ min: 1, max: 100 });
const pageArb = fc.integer({ min: 1, max: 50 });

// Generate boolean for force_refresh
const booleanArb = fc.boolean();

describe('Property-Based Tests: API Wrapper Channel ID Inclusion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful responses
    (invoke as any).mockResolvedValue([]);
  });

  describe('Property 5: API wrapper channel ID inclusion', () => {
    it('should include channel_id in fetchChannelClaims with any_tags parameter', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          limitArb,
          async (tags, limit) => {
            // Dynamically import to get fresh module with mocked invoke
            const { fetchChannelClaims } = await import('../../src/lib/api');
            
            await fetchChannelClaims({ any_tags: tags, limit });
            
            expect(invoke).toHaveBeenCalledWith(
              'fetch_channel_claims',
              expect.objectContaining({
                channel_id: expect.stringMatching(/^@/),
                any_tags: tags,
                limit
              })
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should include channel_id in fetchChannelClaims with text parameter', async () => {
      await fc.assert(
        fc.asyncProperty(
          searchTextArb,
          limitArb,
          async (text, limit) => {
            const { fetchChannelClaims } = await import('../../src/lib/api');
            
            await fetchChannelClaims({ text, limit });
            
            expect(invoke).toHaveBeenCalledWith(
              'fetch_channel_claims',
              expect.objectContaining({
                channel_id: expect.stringMatching(/^@/),
                text,
                limit
              })
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should include channel_id in fetchChannelClaims with page parameter', async () => {
      await fc.assert(
        fc.asyncProperty(
          pageArb,
          limitArb,
          async (page, limit) => {
            const { fetchChannelClaims } = await import('../../src/lib/api');
            
            await fetchChannelClaims({ page, limit });
            
            expect(invoke).toHaveBeenCalledWith(
              'fetch_channel_claims',
              expect.objectContaining({
                channel_id: expect.stringMatching(/^@/),
                page,
                limit
              })
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should include channel_id in fetchChannelClaims with force_refresh parameter', async () => {
      await fc.assert(
        fc.asyncProperty(
          booleanArb,
          async (forceRefresh) => {
            const { fetchChannelClaims } = await import('../../src/lib/api');
            
            await fetchChannelClaims({ force_refresh: forceRefresh });
            
            expect(invoke).toHaveBeenCalledWith(
              'fetch_channel_claims',
              expect.objectContaining({
                channel_id: expect.stringMatching(/^@/),
                force_refresh: forceRefresh
              })
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should include channel_id in fetchChannelClaims with all parameters', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          searchTextArb,
          limitArb,
          pageArb,
          booleanArb,
          async (tags, text, limit, page, forceRefresh) => {
            const { fetchChannelClaims } = await import('../../src/lib/api');
            
            await fetchChannelClaims({
              any_tags: tags,
              text,
              limit,
              page,
              force_refresh: forceRefresh
            });
            
            expect(invoke).toHaveBeenCalledWith(
              'fetch_channel_claims',
              expect.objectContaining({
                channel_id: expect.stringMatching(/^@/),
                any_tags: tags,
                text,
                limit,
                page,
                force_refresh: forceRefresh
              })
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should include channel_id in fetchPlaylists', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null), // fetchPlaylists takes no parameters
          async () => {
            const { fetchPlaylists } = await import('../../src/lib/api');
            
            await fetchPlaylists();
            
            expect(invoke).toHaveBeenCalledWith(
              'fetch_playlists',
              expect.objectContaining({
                channel_id: expect.stringMatching(/^@/)
              })
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should include channel_id in fetchByTag convenience function', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 30 }),
          limitArb,
          booleanArb,
          async (tag, limit, forceRefresh) => {
            const { fetchByTag } = await import('../../src/lib/api');
            
            await fetchByTag(tag, limit, forceRefresh);
            
            // fetchByTag calls fetchChannelClaims internally
            expect(invoke).toHaveBeenCalledWith(
              'fetch_channel_claims',
              expect.objectContaining({
                channel_id: expect.stringMatching(/^@/),
                any_tags: [tag],
                limit,
                force_refresh: forceRefresh
              })
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should include channel_id in fetchByTags convenience function', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          limitArb,
          booleanArb,
          async (tags, limit, forceRefresh) => {
            const { fetchByTags } = await import('../../src/lib/api');
            
            await fetchByTags(tags, limit, forceRefresh);
            
            // fetchByTags calls fetchChannelClaims internally
            expect(invoke).toHaveBeenCalledWith(
              'fetch_channel_claims',
              expect.objectContaining({
                channel_id: expect.stringMatching(/^@/),
                any_tags: tags,
                limit,
                force_refresh: forceRefresh
              })
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should include channel_id in searchContent convenience function', async () => {
      await fc.assert(
        fc.asyncProperty(
          searchTextArb,
          limitArb,
          async (text, limit) => {
            const { searchContent } = await import('../../src/lib/api');
            
            await searchContent(text, limit);
            
            // searchContent calls fetchChannelClaims internally
            expect(invoke).toHaveBeenCalledWith(
              'fetch_channel_claims',
              expect.objectContaining({
                channel_id: expect.stringMatching(/^@/),
                text,
                limit
              })
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should include channel_id in fetchHeroContent convenience function', async () => {
      await fc.assert(
        fc.asyncProperty(
          limitArb,
          async (limit) => {
            const { fetchHeroContent } = await import('../../src/lib/api');
            
            await fetchHeroContent(limit);
            
            // fetchHeroContent calls fetchByTag which calls fetchChannelClaims
            expect(invoke).toHaveBeenCalledWith(
              'fetch_channel_claims',
              expect.objectContaining({
                channel_id: expect.stringMatching(/^@/),
                any_tags: ['hero_trailer'],
                limit
              })
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should include channel_id in fetchCategoryContent utility function', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
          limitArb,
          booleanArb,
          async (baseTag, filterTag, limit, forceRefresh) => {
            const { fetchCategoryContent } = await import('../../src/lib/api');
            
            await fetchCategoryContent(baseTag, filterTag, limit, forceRefresh);
            
            const expectedTags = filterTag ? [baseTag, filterTag] : [baseTag];
            
            expect(invoke).toHaveBeenCalledWith(
              'fetch_channel_claims',
              expect.objectContaining({
                channel_id: expect.stringMatching(/^@/),
                any_tags: expectedTags,
                limit,
                force_refresh: forceRefresh
              })
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should always use the same channel_id value across multiple calls', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(tagsArb, { minLength: 2, maxLength: 5 }),
          async (tagArrays) => {
            const { fetchChannelClaims } = await import('../../src/lib/api');
            
            // Make multiple calls
            for (const tags of tagArrays) {
              await fetchChannelClaims({ any_tags: tags });
            }
            
            // Extract all channel_id values from the calls
            const calls = (invoke as any).mock.calls;
            const channelIds = calls
              .filter((call: any[]) => call[0] === 'fetch_channel_claims')
              .map((call: any[]) => call[1].channel_id);
            
            // All channel_ids should be the same
            expect(channelIds.length).toBeGreaterThan(1);
            const firstChannelId = channelIds[0];
            
            for (const channelId of channelIds) {
              expect(channelId).toBe(firstChannelId);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should include channel_id that starts with @ character', async () => {
      await fc.assert(
        fc.asyncProperty(
          tagsArb,
          async (tags) => {
            const { fetchChannelClaims } = await import('../../src/lib/api');
            
            await fetchChannelClaims({ any_tags: tags });
            
            const calls = (invoke as any).mock.calls;
            const lastCall = calls[calls.length - 1];
            const channelId = lastCall[1].channel_id;
            
            // Channel ID must start with '@'
            expect(channelId).toMatch(/^@/);
            expect(channelId.length).toBeGreaterThan(1);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should never call backend commands without channel_id parameter', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            tagsArb.map(tags => ({ type: 'fetchChannelClaims', params: { any_tags: tags } })),
            fc.constant({ type: 'fetchPlaylists', params: {} })
          ),
          async (testCase) => {
            const api = await import('../../src/lib/api');
            
            if (testCase.type === 'fetchChannelClaims') {
              await api.fetchChannelClaims(testCase.params);
            } else {
              await api.fetchPlaylists();
            }
            
            const calls = (invoke as any).mock.calls;
            const lastCall = calls[calls.length - 1];
            const params = lastCall[1];
            
            // Must have channel_id property
            expect(params).toHaveProperty('channel_id');
            expect(params.channel_id).toBeDefined();
            expect(typeof params.channel_id).toBe('string');
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});

