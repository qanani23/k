/**
 * Memory Manager for Large Datasets
 * 
 * Provides utilities for managing memory usage when dealing with large content collections.
 * Implements strategies for:
 * - Limiting in-memory content collections
 * - Pagination and windowing
 * - Automatic cleanup of unused data
 * - Memory-efficient data structures
 */

import { ContentItem } from '../types';

/**
 * Configuration for memory management
 */
export interface MemoryManagerConfig {
  /** Maximum number of items to keep in memory per collection */
  maxItemsInMemory: number;
  /** Maximum number of collections to track */
  maxCollections: number;
  /** Time in ms before unused collections are eligible for cleanup */
  collectionTTL: number;
  /** Enable automatic cleanup */
  autoCleanup: boolean;
}

/**
 * Default memory manager configuration
 */
const DEFAULT_CONFIG: MemoryManagerConfig = {
  maxItemsInMemory: 200,
  maxCollections: 10,
  collectionTTL: 5 * 60 * 1000, // 5 minutes
  autoCleanup: true,
};

/**
 * Metadata for tracked collections
 */
interface CollectionMetadata {
  id: string;
  items: ContentItem[];
  lastAccessed: number;
  accessCount: number;
  size: number; // Approximate size in bytes
}

/**
 * Memory Manager class for managing large datasets
 */
export class MemoryManager {
  private config: MemoryManagerConfig;
  private collections: Map<string, CollectionMetadata>;
  private cleanupInterval: number | null;

  constructor(config: Partial<MemoryManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.collections = new Map();
    this.cleanupInterval = null;

    if (this.config.autoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * Store a collection with automatic memory management
   */
  storeCollection(id: string, items: ContentItem[]): void {
    // Limit items to max allowed
    const limitedItems = items.slice(0, this.config.maxItemsInMemory);
    
    // Calculate approximate size
    const size = this.estimateSize(limitedItems);

    // Update or create collection metadata
    const existing = this.collections.get(id);
    this.collections.set(id, {
      id,
      items: limitedItems,
      lastAccessed: Date.now(),
      accessCount: existing ? existing.accessCount + 1 : 1,
      size,
    });

    // Cleanup if we exceed max collections
    if (this.collections.size > this.config.maxCollections) {
      this.cleanupLeastUsed();
    }
  }

  /**
   * Retrieve a collection from memory
   */
  getCollection(id: string): ContentItem[] | null {
    const collection = this.collections.get(id);
    
    if (!collection) {
      return null;
    }

    // Update access metadata
    collection.lastAccessed = Date.now();
    collection.accessCount++;

    return collection.items;
  }

  /**
   * Remove a specific collection from memory
   */
  removeCollection(id: string): boolean {
    return this.collections.delete(id);
  }

  /**
   * Clear all collections from memory
   */
  clearAll(): void {
    this.collections.clear();
  }

  /**
   * Get memory usage statistics
   */
  getStats(): {
    totalCollections: number;
    totalItems: number;
    estimatedSizeBytes: number;
    collections: Array<{
      id: string;
      itemCount: number;
      size: number;
      lastAccessed: number;
      accessCount: number;
    }>;
  } {
    let totalItems = 0;
    let estimatedSizeBytes = 0;
    const collections: Array<{
      id: string;
      itemCount: number;
      size: number;
      lastAccessed: number;
      accessCount: number;
    }> = [];

    this.collections.forEach((collection) => {
      totalItems += collection.items.length;
      estimatedSizeBytes += collection.size;
      collections.push({
        id: collection.id,
        itemCount: collection.items.length,
        size: collection.size,
        lastAccessed: collection.lastAccessed,
        accessCount: collection.accessCount,
      });
    });

    return {
      totalCollections: this.collections.size,
      totalItems,
      estimatedSizeBytes,
      collections,
    };
  }

  /**
   * Estimate the memory size of content items
   */
  private estimateSize(items: ContentItem[]): number {
    // Rough estimation: each item is approximately 2KB
    // This includes title, description, tags, URLs, etc.
    const avgItemSize = 2048;
    return items.length * avgItemSize;
  }

  /**
   * Cleanup least recently used collections
   */
  private cleanupLeastUsed(): void {
    const now = Date.now();
    const collectionsArray = Array.from(this.collections.values());

    // Sort by last accessed time and access count
    collectionsArray.sort((a, b) => {
      // Prioritize removing old, rarely accessed collections
      const aScore = a.lastAccessed + (a.accessCount * 60000); // 1 minute per access
      const bScore = b.lastAccessed + (b.accessCount * 60000);
      return aScore - bScore;
    });

    // Remove oldest collections until we're under the limit
    const toRemove = this.collections.size - this.config.maxCollections;
    for (let i = 0; i < toRemove && i < collectionsArray.length; i++) {
      this.collections.delete(collectionsArray[i].id);
    }
  }

  /**
   * Cleanup expired collections based on TTL
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const expiredIds: string[] = [];

    this.collections.forEach((collection, id) => {
      if (now - collection.lastAccessed > this.config.collectionTTL) {
        expiredIds.push(id);
      }
    });

    expiredIds.forEach((id) => this.collections.delete(id));

    if (expiredIds.length > 0) {
      console.debug(`Cleaned up ${expiredIds.length} expired collections`);
    }
  }

  /**
   * Start automatic cleanup interval
   */
  private startAutoCleanup(): void {
    if (this.cleanupInterval !== null) {
      return;
    }

    // Run cleanup every minute
    this.cleanupInterval = window.setInterval(() => {
      this.cleanupExpired();
    }, 60000);
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval !== null) {
      window.clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Destroy the memory manager and cleanup resources
   */
  destroy(): void {
    this.stopAutoCleanup();
    this.clearAll();
  }
}

/**
 * Global memory manager instance
 */
let globalMemoryManager: MemoryManager | null = null;

/**
 * Get or create the global memory manager instance
 */
export function getMemoryManager(): MemoryManager {
  if (!globalMemoryManager) {
    globalMemoryManager = new MemoryManager();
  }
  return globalMemoryManager;
}

/**
 * Paginate an array of items
 */
export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize: number
): {
  items: T[];
  totalPages: number;
  currentPage: number;
  hasMore: boolean;
} {
  const totalPages = Math.ceil(items.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedItems = items.slice(startIndex, endIndex);

  return {
    items: paginatedItems,
    totalPages,
    currentPage: page,
    hasMore: page < totalPages,
  };
}

/**
 * Create a windowed view of items for virtual scrolling
 */
export function createWindow<T>(
  items: T[],
  startIndex: number,
  windowSize: number
): {
  items: T[];
  startIndex: number;
  endIndex: number;
} {
  const endIndex = Math.min(startIndex + windowSize, items.length);
  const windowedItems = items.slice(startIndex, endIndex);

  return {
    items: windowedItems,
    startIndex,
    endIndex,
  };
}

/**
 * Chunk an array into smaller arrays
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Debounce function for memory-intensive operations
 */
export function debounceMemoryOperation<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }

    timeoutId = window.setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Throttle function for memory-intensive operations
 */
export function throttleMemoryOperation<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}
