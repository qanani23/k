import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  MemoryManager, 
  getMemoryManager, 
  paginateItems, 
  createWindow, 
  chunkArray,
  debounceMemoryOperation,
  throttleMemoryOperation
} from '../../src/lib/memoryManager';
import { ContentItem } from '../../src/types';

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;

  beforeEach(() => {
    memoryManager = new MemoryManager({
      maxItemsInMemory: 100,
      maxCollections: 5,
      collectionTTL: 1000, // 1 second for testing
      autoCleanup: false, // Disable for controlled testing
    });
  });

  afterEach(() => {
    memoryManager.destroy();
  });

  describe('Collection Management', () => {
    it('should store and retrieve collections', () => {
      const items: ContentItem[] = [
        {
          claim_id: '1',
          title: 'Test Movie',
          tags: ['movie'],
          release_time: Date.now(),
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false },
        },
      ];

      memoryManager.storeCollection('test-collection', items);
      const retrieved = memoryManager.getCollection('test-collection');

      expect(retrieved).toEqual(items);
    });

    it('should limit items to maxItemsInMemory', () => {
      const items: ContentItem[] = Array.from({ length: 150 }, (_, i) => ({
        claim_id: `${i}`,
        title: `Movie ${i}`,
        tags: ['movie'],
        release_time: Date.now(),
        video_urls: {},
        compatibility: { compatible: true, fallback_available: false },
      }));

      memoryManager.storeCollection('large-collection', items);
      const retrieved = memoryManager.getCollection('large-collection');

      expect(retrieved?.length).toBe(100);
    });

    it('should return null for non-existent collections', () => {
      const retrieved = memoryManager.getCollection('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should remove collections', () => {
      const items: ContentItem[] = [
        {
          claim_id: '1',
          title: 'Test Movie',
          tags: ['movie'],
          release_time: Date.now(),
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false },
        },
      ];

      memoryManager.storeCollection('test-collection', items);
      const removed = memoryManager.removeCollection('test-collection');
      const retrieved = memoryManager.getCollection('test-collection');

      expect(removed).toBe(true);
      expect(retrieved).toBeNull();
    });

    it('should clear all collections', () => {
      const items: ContentItem[] = [
        {
          claim_id: '1',
          title: 'Test Movie',
          tags: ['movie'],
          release_time: Date.now(),
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false },
        },
      ];

      memoryManager.storeCollection('collection-1', items);
      memoryManager.storeCollection('collection-2', items);
      memoryManager.clearAll();

      const stats = memoryManager.getStats();
      expect(stats.totalCollections).toBe(0);
    });
  });

  describe('Memory Statistics', () => {
    it('should track collection statistics', () => {
      const items: ContentItem[] = Array.from({ length: 10 }, (_, i) => ({
        claim_id: `${i}`,
        title: `Movie ${i}`,
        tags: ['movie'],
        release_time: Date.now(),
        video_urls: {},
        compatibility: { compatible: true, fallback_available: false },
      }));

      memoryManager.storeCollection('test-collection', items);
      const stats = memoryManager.getStats();

      expect(stats.totalCollections).toBe(1);
      expect(stats.totalItems).toBe(10);
      expect(stats.estimatedSizeBytes).toBeGreaterThan(0);
      expect(stats.collections).toHaveLength(1);
      expect(stats.collections[0].id).toBe('test-collection');
    });

    it('should update access count on retrieval', () => {
      const items: ContentItem[] = [
        {
          claim_id: '1',
          title: 'Test Movie',
          tags: ['movie'],
          release_time: Date.now(),
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false },
        },
      ];

      memoryManager.storeCollection('test-collection', items);
      memoryManager.getCollection('test-collection');
      memoryManager.getCollection('test-collection');

      const stats = memoryManager.getStats();
      expect(stats.collections[0].accessCount).toBe(3); // 1 from store + 2 from get
    });
  });

  describe('Collection Cleanup', () => {
    it('should cleanup least used collections when exceeding max', () => {
      const items: ContentItem[] = [
        {
          claim_id: '1',
          title: 'Test Movie',
          tags: ['movie'],
          release_time: Date.now(),
          video_urls: {},
          compatibility: { compatible: true, fallback_available: false },
        },
      ];

      // Store more collections than the max
      for (let i = 0; i < 7; i++) {
        memoryManager.storeCollection(`collection-${i}`, items);
      }

      const stats = memoryManager.getStats();
      expect(stats.totalCollections).toBeLessThanOrEqual(5);
    });
  });
});

describe('Pagination Utilities', () => {
  it('should paginate items correctly', () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const result = paginateItems(items, 1, 10);

    expect(result.items).toHaveLength(10);
    expect(result.items[0]).toBe(0);
    expect(result.items[9]).toBe(9);
    expect(result.totalPages).toBe(10);
    expect(result.currentPage).toBe(1);
    expect(result.hasMore).toBe(true);
  });

  it('should handle last page correctly', () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const result = paginateItems(items, 3, 10);

    expect(result.items).toHaveLength(5);
    expect(result.hasMore).toBe(false);
  });
});

describe('Window Utilities', () => {
  it('should create a window of items', () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const result = createWindow(items, 10, 20);

    expect(result.items).toHaveLength(20);
    expect(result.items[0]).toBe(10);
    expect(result.items[19]).toBe(29);
    expect(result.startIndex).toBe(10);
    expect(result.endIndex).toBe(30);
  });

  it('should handle window at end of array', () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const result = createWindow(items, 90, 20);

    expect(result.items).toHaveLength(10);
    expect(result.endIndex).toBe(100);
  });
});

describe('Chunk Utilities', () => {
  it('should chunk array into smaller arrays', () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    const chunks = chunkArray(items, 10);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(10);
    expect(chunks[1]).toHaveLength(10);
    expect(chunks[2]).toHaveLength(5);
  });

  it('should handle exact chunk size', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const chunks = chunkArray(items, 10);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(10);
    expect(chunks[1]).toHaveLength(10);
  });
});

describe('Debounce and Throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should debounce function calls', () => {
    const fn = vi.fn();
    const debounced = debounceMemoryOperation(fn, 100);

    debounced();
    debounced();
    debounced();

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throttle function calls', () => {
    const fn = vi.fn();
    const throttled = throttleMemoryOperation(fn, 100);

    throttled();
    throttled();
    throttled();

    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    throttled();

    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('Global Memory Manager', () => {
  it('should return singleton instance', () => {
    const manager1 = getMemoryManager();
    const manager2 = getMemoryManager();

    expect(manager1).toBe(manager2);
  });
});
