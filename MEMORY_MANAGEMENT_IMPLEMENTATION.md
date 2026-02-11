# Memory Management Implementation

## Overview

This document describes the memory management implementation for handling large datasets in the Kiyya desktop streaming application. The implementation provides efficient memory usage through caching strategies, pagination, and automatic cleanup mechanisms.

## Components

### 1. Frontend Memory Manager (`src/lib/memoryManager.ts`)

The frontend memory manager provides utilities for managing in-memory content collections:

#### Features

- **Collection Management**: Store and retrieve content collections with automatic size limiting
- **Memory Limits**: Configurable maximum items per collection (default: 200 items)
- **Collection Limits**: Maximum number of tracked collections (default: 10)
- **TTL-based Cleanup**: Automatic removal of unused collections after timeout (default: 5 minutes)
- **LRU Eviction**: Least recently used collections are removed when limits are exceeded
- **Memory Statistics**: Track memory usage, collection counts, and access patterns

#### Usage Example

```typescript
import { getMemoryManager } from './lib/memoryManager';

const memoryManager = getMemoryManager();

// Store a collection
memoryManager.storeCollection('movies-action', contentItems);

// Retrieve a collection
const items = memoryManager.getCollection('movies-action');

// Get memory statistics
const stats = memoryManager.getStats();
console.log(`Total collections: ${stats.totalCollections}`);
console.log(`Total items: ${stats.totalItems}`);
console.log(`Estimated size: ${stats.estimatedSizeBytes} bytes`);
```

#### Utility Functions

- **paginateItems**: Split arrays into pages for pagination
- **createWindow**: Create windowed views for virtual scrolling
- **chunkArray**: Split arrays into smaller chunks for batch processing
- **debounceMemoryOperation**: Debounce memory-intensive operations
- **throttleMemoryOperation**: Throttle memory-intensive operations

### 2. Backend Memory Management (`src-tauri/src/database.rs`)

The Rust backend provides database-level memory management:

#### Features

- **Chunked Queries**: Process large result sets in batches to avoid loading all data into memory
- **Cache Size Limits**: Automatic cleanup when cache exceeds configured limits (default: 200 items)
- **LRU Eviction**: Remove least recently accessed items when cache is full
- **Memory Statistics**: Track database memory usage and cache statistics
- **Database Optimization**: VACUUM and ANALYZE operations to reclaim space

#### New Methods

##### `query_content_chunked`

Process large result sets in chunks to avoid memory exhaustion:

```rust
db.query_content_chunked(
    query,
    chunk_size: 50,
    |chunk| {
        // Process each chunk
        for item in chunk {
            // Handle item
        }
        Ok(())
    }
).await?;
```

##### `get_memory_stats`

Get comprehensive memory usage statistics:

```rust
let stats = db.get_memory_stats().await?;
println!("Cache items: {}", stats.cache_items);
println!("Database size: {} bytes", stats.database_file_size);
```

##### `optimize_memory`

Optimize database for better memory usage:

```rust
db.optimize_memory().await?;
```

### 3. Integration with useContent Hook

The `useContent` hook has been enhanced with memory management:

```typescript
export function useContent(options: UseContentOptions = {}): UseContentReturn {
  const { enableMemoryManagement = true } = options;
  
  // Memory manager integration
  const memoryManager = enableMemoryManagement ? getMemoryManager() : null;
  
  // Check cache before fetching
  if (memoryManager) {
    const cachedContent = memoryManager.getCollection(collectionId);
    if (cachedContent) {
      return cachedContent;
    }
  }
  
  // Store results in memory manager
  if (memoryManager) {
    memoryManager.storeCollection(collectionId, results);
  }
}
```

### 4. Tauri Commands

New commands for memory management:

#### `get_memory_stats`

Returns comprehensive memory statistics:

```typescript
import { invoke } from '@tauri-apps/api/tauri';

const stats = await invoke('get_memory_stats');
// Returns: MemoryStats {
//   cache_items: number,
//   cache_size_bytes: number,
//   playlist_count: number,
//   favorites_count: number,
//   offline_content_count: number,
//   database_file_size: number
// }
```

#### `optimize_database_memory`

Triggers database optimization:

```typescript
await invoke('optimize_database_memory');
```

## Memory Management Strategy

### Frontend Strategy

1. **Limit In-Memory Collections**: Maximum 200 items per collection
2. **Collection Limits**: Maximum 10 active collections
3. **TTL-based Expiration**: Remove collections unused for 5+ minutes
4. **LRU Eviction**: Remove least recently used collections when limit exceeded
5. **Automatic Cleanup**: Background cleanup every minute

### Backend Strategy

1. **Cache Size Limits**: Maximum 200 items in database cache
2. **TTL-based Expiration**: Remove items older than 30 minutes
3. **LRU Eviction**: Remove least accessed items when cache full
4. **Chunked Processing**: Process large queries in batches of 50 items
5. **Database Optimization**: Periodic VACUUM and ANALYZE operations

## Performance Considerations

### Memory Usage

- **Frontend**: ~2KB per content item (estimated)
- **Maximum Frontend Memory**: ~4MB (200 items × 10 collections × 2KB)
- **Backend Cache**: Configurable, default 200 items
- **Database Indices**: Optimized for cache cleanup queries

### Query Optimization

The implementation includes composite indices for efficient cache management:

```sql
-- Composite index for cache cleanup (LRU)
CREATE INDEX idx_localcache_cleanup 
ON local_cache(lastAccessed ASC, accessCount ASC);

-- Composite index for TTL-based queries
CREATE INDEX idx_localcache_ttl_tags 
ON local_cache(updatedAt DESC, tags);
```

## Configuration

### Frontend Configuration

```typescript
const memoryManager = new MemoryManager({
  maxItemsInMemory: 200,      // Max items per collection
  maxCollections: 10,          // Max number of collections
  collectionTTL: 5 * 60 * 1000, // 5 minutes
  autoCleanup: true            // Enable automatic cleanup
});
```

### Backend Configuration

Configured in `Database::new()`:

```rust
cache_ttl_seconds: 30 * 60,  // 30 minutes
max_cache_items: 200,         // Maximum cache items
```

## Testing

Comprehensive tests are provided in `tests/unit/memoryManager.test.ts`:

- Collection storage and retrieval
- Memory limits enforcement
- LRU eviction
- Statistics tracking
- Pagination utilities
- Window utilities
- Chunk utilities
- Debounce and throttle functions

Run tests:

```bash
npm test -- tests/unit/memoryManager.test.ts --run
```

## Monitoring

### Frontend Monitoring

```typescript
const stats = memoryManager.getStats();
console.log('Memory Stats:', {
  collections: stats.totalCollections,
  items: stats.totalItems,
  estimatedSize: stats.estimatedSizeBytes
});
```

### Backend Monitoring

```typescript
const stats = await invoke('get_memory_stats');
console.log('Database Memory:', {
  cacheItems: stats.cache_items,
  dbSize: stats.database_file_size
});
```

## Best Practices

1. **Enable Memory Management**: Always use `enableMemoryManagement: true` in `useContent` hook
2. **Monitor Memory Usage**: Regularly check memory statistics in development
3. **Optimize Periodically**: Run database optimization during idle periods
4. **Limit Result Sets**: Use pagination and windowing for large datasets
5. **Clean Up Unused Data**: Rely on automatic cleanup mechanisms

## Future Improvements

Potential enhancements for future iterations:

1. **Adaptive Limits**: Dynamically adjust limits based on available system memory
2. **Compression**: Compress cached data to reduce memory footprint
3. **Persistent Cache**: Store frequently accessed data in IndexedDB
4. **Predictive Loading**: Preload likely-to-be-accessed content
5. **Memory Pressure Handling**: React to system memory pressure events

## Related Requirements

This implementation addresses:

- **Requirement 1.6**: Pagination for large content collections
- **Requirement 13.1**: Limit initial cache to 100-200 items
- **Requirement 13.2**: Lazy loading implementation
- **Requirement 13.5**: Efficient database queries with proper indexing
- **Requirement 13.6**: Memory management during operations

## Conclusion

The memory management implementation provides a robust foundation for handling large datasets efficiently. The combination of frontend collection management and backend database optimization ensures the application remains performant even with extensive content libraries.
