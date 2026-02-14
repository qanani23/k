import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MemoryManager } from '../../src/lib/memoryManager';
import { ContentItem } from '../../src/types';

describe('MemoryManager - Cache Expiration (Task 11.2)', () => {
  let manager: MemoryManager;
  
  const mockContentItems: ContentItem[] = [
    {
      claim_id: 'claim1',
      title: 'Test Movie 1',
      thumbnail_url: 'https://example.com/thumb1.jpg',
      video_urls: { '720p': 'https://example.com/video1.mp4' },
      tags: ['movie'],
      value: { source: {} },
    },
    {
      claim_id: 'claim2',
      title: 'Test Movie 2',
      thumbnail_url: 'https://example.com/thumb2.jpg',
      video_urls: { '720p': 'https://example.com/video2.mp4' },
      tags: ['movie'],
      value: { source: {} },
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
    vi.useRealTimers();
  });

  it('should add createdAt timestamp to cached entries', () => {
    manager = new MemoryManager({ autoCleanup: false });
    const now = Date.now();
    
    manager.storeCollection('test-collection', mockContentItems);
    
    const stats = manager.getStats();
    expect(stats.collections).toHaveLength(1);
    expect(stats.collections[0].createdAt).toBeDefined();
    expect(stats.collections[0].createdAt).toBeGreaterThanOrEqual(now);
  });

  it('should preserve createdAt timestamp when updating collection', () => {
    manager = new MemoryManager({ autoCleanup: false });
    
    // Store initial collection
    manager.storeCollection('test-collection', mockContentItems);
    const initialStats = manager.getStats();
    const initialCreatedAt = initialStats.collections[0].createdAt;
    
    // Advance time by 1 second
    vi.advanceTimersByTime(1000);
    
    // Update the same collection
    manager.storeCollection('test-collection', [...mockContentItems, mockContentItems[0]]);
    
    const updatedStats = manager.getStats();
    expect(updatedStats.collections[0].createdAt).toBe(initialCreatedAt);
    expect(updatedStats.collections[0].lastAccessed).toBeGreaterThan(initialCreatedAt);
  });

  it('should expire cache after 5 minutes (300000ms)', () => {
    manager = new MemoryManager({ 
      collectionTTL: 5 * 60 * 1000, // 5 minutes
      autoCleanup: false 
    });
    
    manager.storeCollection('test-collection', mockContentItems);
    
    // Should be available immediately
    let result = manager.getCollection('test-collection');
    expect(result).toHaveLength(2);
    
    // Advance time by 4 minutes (should still be valid)
    vi.advanceTimersByTime(4 * 60 * 1000);
    result = manager.getCollection('test-collection');
    expect(result).toHaveLength(2);
    
    // Advance time by 2 more minutes (total 6 minutes, should expire)
    vi.advanceTimersByTime(2 * 60 * 1000);
    result = manager.getCollection('test-collection');
    expect(result).toBeNull();
  });

  it('should return null for expired cache on getCollection', () => {
    manager = new MemoryManager({ 
      collectionTTL: 5 * 60 * 1000,
      autoCleanup: false 
    });
    
    manager.storeCollection('test-collection', mockContentItems);
    
    // Advance time past expiration
    vi.advanceTimersByTime(6 * 60 * 1000);
    
    const result = manager.getCollection('test-collection');
    expect(result).toBeNull();
    
    // Verify collection was removed
    const stats = manager.getStats();
    expect(stats.totalCollections).toBe(0);
  });

  it('should clear expired entries during automatic cleanup', () => {
    manager = new MemoryManager({ 
      collectionTTL: 5 * 60 * 1000,
      autoCleanup: true 
    });
    
    // Store multiple collections
    manager.storeCollection('collection-1', mockContentItems);
    manager.storeCollection('collection-2', mockContentItems);
    manager.storeCollection('collection-3', mockContentItems);
    
    // Verify all are stored
    let stats = manager.getStats();
    expect(stats.totalCollections).toBe(3);
    
    // Advance time past expiration
    vi.advanceTimersByTime(6 * 60 * 1000);
    
    // Trigger cleanup (runs every 60 seconds)
    vi.advanceTimersByTime(60 * 1000);
    
    // All collections should be expired and removed
    stats = manager.getStats();
    expect(stats.totalCollections).toBe(0);
  });

  it('should only expire old collections, not recent ones', () => {
    manager = new MemoryManager({ 
      collectionTTL: 5 * 60 * 1000,
      autoCleanup: false 
    });
    
    // Store first collection
    manager.storeCollection('old-collection', mockContentItems);
    
    // Advance time by 4 minutes
    vi.advanceTimersByTime(4 * 60 * 1000);
    
    // Store second collection (newer)
    manager.storeCollection('new-collection', mockContentItems);
    
    // Advance time by 2 more minutes (total 6 minutes from first, 2 from second)
    vi.advanceTimersByTime(2 * 60 * 1000);
    
    // Old collection should be expired
    const oldResult = manager.getCollection('old-collection');
    expect(oldResult).toBeNull();
    
    // New collection should still be valid
    const newResult = manager.getCollection('new-collection');
    expect(newResult).toHaveLength(2);
  });

  it('should use creation time, not last accessed time for expiration', () => {
    manager = new MemoryManager({ 
      collectionTTL: 5 * 60 * 1000,
      autoCleanup: false 
    });
    
    manager.storeCollection('test-collection', mockContentItems);
    
    // Advance time by 3 minutes
    vi.advanceTimersByTime(3 * 60 * 1000);
    
    // Access the collection (updates lastAccessed)
    manager.getCollection('test-collection');
    
    // Advance time by 3 more minutes (total 6 minutes from creation, but only 3 from last access)
    vi.advanceTimersByTime(3 * 60 * 1000);
    
    // Should be expired based on creation time, not last access time
    const result = manager.getCollection('test-collection');
    expect(result).toBeNull();
  });

  it('should handle custom TTL values', () => {
    // Create manager with 1 minute TTL
    manager = new MemoryManager({ 
      collectionTTL: 60 * 1000, // 1 minute
      autoCleanup: false 
    });
    
    manager.storeCollection('test-collection', mockContentItems);
    
    // Should be available immediately
    let result = manager.getCollection('test-collection');
    expect(result).toHaveLength(2);
    
    // Advance time by 30 seconds (should still be valid)
    vi.advanceTimersByTime(30 * 1000);
    result = manager.getCollection('test-collection');
    expect(result).toHaveLength(2);
    
    // Advance time by 31 more seconds (total 61 seconds, should expire)
    vi.advanceTimersByTime(31 * 1000);
    result = manager.getCollection('test-collection');
    expect(result).toBeNull();
  });

  it('should include createdAt in stats output', () => {
    manager = new MemoryManager({ autoCleanup: false });
    const beforeStore = Date.now();
    
    manager.storeCollection('test-collection', mockContentItems);
    
    const stats = manager.getStats();
    expect(stats.collections[0]).toHaveProperty('createdAt');
    expect(stats.collections[0]).toHaveProperty('lastAccessed');
    expect(stats.collections[0].createdAt).toBeGreaterThanOrEqual(beforeStore);
    expect(stats.collections[0].lastAccessed).toBeGreaterThanOrEqual(stats.collections[0].createdAt);
  });
});
