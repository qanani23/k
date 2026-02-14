import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { ContentItem, ApiError, UseContentReturn } from '../types';
import { fetchChannelClaims, fetchByTag, fetchByTags, searchContent } from '../lib/api';
import { useOffline } from './useOffline';
import { getMemoryManager } from '../lib/memoryManager';

interface UseContentOptions {
  tags?: string[];
  text?: string;
  limit?: number;
  autoFetch?: boolean;
  offlineOnly?: boolean;
  enableMemoryManagement?: boolean;
}

export function useContent(options: UseContentOptions = {}): UseContentReturn {
  const { tags, text, limit = 50, autoFetch = true, offlineOnly = false, enableMemoryManagement = true } = options;
  const { isOnline } = useOffline();
  
  const [content, setContent] = useState<ContentItem[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<ApiError | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  // State transition validation
  const statusRef = useRef<'idle' | 'loading' | 'success' | 'error'>('idle');
  
  const setStatusWithValidation = useCallback((newStatus: 'idle' | 'loading' | 'success' | 'error') => {
    const currentStatus = statusRef.current;
    
    // Define valid state transitions
    const validTransitions: Record<string, string[]> = {
      idle: ['loading', 'success', 'error'], // Allow direct success (cache hit) and error (offline)
      loading: ['success', 'error'],
      success: ['loading'], // Allow refetch
      error: ['loading'] // Allow retry
    };
    
    // Check if transition is valid
    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      if (import.meta.env.DEV) {
        console.error('[useContent] Invalid state transition:', {
          from: currentStatus,
          to: newStatus,
          validTransitions: validTransitions[currentStatus]
        });
      }
      return;
    }
    
    // Update both ref and state
    statusRef.current = newStatus;
    setStatus(newStatus);
  }, []);

  // FIX 1: Memoize collectionId to prevent reference changes
  // Serialize tags to create a stable key that only changes when tag values change
  const tagsKey = useMemo(() => {
    if (!tags || tags.length === 0) return null;
    return JSON.stringify(tags);
  }, [tags ? tags.length : 0, ...(tags || [])]);
  
  const collectionId = useMemo(() => {
    const tagsStr = tags && tags.length > 0 ? tags.join('-') : '';
    const textStr = text || '';
    
    // Use tags if available, otherwise text, otherwise 'default'
    // Trim to handle whitespace-only strings
    const key = tagsStr.trim() || textStr.trim() || 'default';
    return `content-${key}`;
  }, [tagsKey, text]);
  
  // FIX 2: Memoize memoryManager instance
  const memoryManager = useMemo(() => 
    enableMemoryManagement ? getMemoryManager() : null, 
    [enableMemoryManagement]
  );
  
  // FIX 3: Track in-flight requests to prevent duplicate fetches
  const fetchInProgressRef = useRef(false);
  
  // FIX 4: Development mode logging
  const isDev = import.meta.env.DEV;

  const fetchContent = useCallback(async (pageNum: number = 1, append: boolean = false, force: boolean = false) => {
    // Prevent duplicate fetches
    if (fetchInProgressRef.current) {
      if (isDev) console.log('[useContent] Fetch already in progress, skipping');
      return;
    }
    
    fetchInProgressRef.current = true;
    const startTime = isDev ? performance.now() : 0;
    
    // If offline and not in offline-only mode, show error
    if (!isOnline && !offlineOnly) {
      const apiError: ApiError = {
        message: 'No internet connection. Only downloaded content is available.',
        details: 'offline',
      };
      setError(apiError);
      setStatusWithValidation('error');
      if (isDev) {
        console.log('[useContent] State transition: idle → error (offline)', {
          collectionId,
          pageNum,
          append,
          reason: 'offline'
        });
      }
      fetchInProgressRef.current = false;
      return;
    }

    // Check memory cache first if not appending and not forcing a refetch
    if (!append && !force && memoryManager) {
      const cachedContent = memoryManager.getCollection(collectionId);
      if (cachedContent && cachedContent.length > 0) {
        setContent(cachedContent);
        setHasMore(cachedContent.length === limit);
        setPage(pageNum);
        setStatusWithValidation('success');
        if (isDev) {
          const duration = performance.now() - startTime;
          console.log('[useContent] Cache hit', {
            collectionId,
            pageNum,
            append,
            itemCount: cachedContent.length,
            duration: `${duration.toFixed(2)}ms`
          });
        }
        fetchInProgressRef.current = false;
        return;
      }
    }

    try {
      setStatusWithValidation('loading');
      setError(null);
      if (isDev) {
        console.log('[useContent] State transition: idle → loading', {
          collectionId,
          pageNum,
          append,
          tags: tags || null,
          text: text || null,
          limit
        });
      }

      let results: ContentItem[];
      
      if (text) {
        results = await searchContent(text, limit);
      } else if (tags && tags.length > 0) {
        results = await fetchByTags(tags, limit);
      } else {
        results = await fetchChannelClaims({ limit, page: pageNum });
      }

      // Store in memory manager
      if (memoryManager && !append) {
        memoryManager.storeCollection(collectionId, results);
      }

      if (append) {
        setContent(prev => {
          const combined = [...prev, ...results];
          // Limit total items in memory
          const limited = combined.slice(0, 200);
          if (memoryManager) {
            memoryManager.storeCollection(collectionId, limited);
          }
          return limited;
        });
      } else {
        setContent(results);
      }

      // Check if there are more results
      setHasMore(results.length === limit);
      setPage(pageNum);
      
      setStatusWithValidation('success');
      if (isDev) {
        const duration = performance.now() - startTime;
        console.log('[useContent] State transition: loading → success', {
          collectionId,
          pageNum,
          append,
          itemCount: results.length,
          duration: `${duration.toFixed(2)}ms`,
          hasMore: results.length === limit
        });
      }

    } catch (err) {
      const apiError: ApiError = {
        message: err instanceof Error ? err.message : 'Failed to fetch content',
        details: err,
      };
      setError(apiError);
      setStatusWithValidation('error');
      if (isDev) {
        const duration = performance.now() - startTime;
        console.error('[useContent] State transition: loading → error', {
          collectionId,
          pageNum,
          append,
          duration: `${duration.toFixed(2)}ms`,
          error: err instanceof Error ? err.message : String(err)
        });
      }
      
      if (!append) {
        setContent([]);
      }
    } finally {
      fetchInProgressRef.current = false;
    }
  }, [tags, text, limit, isOnline, offlineOnly, collectionId, memoryManager, isDev]);

  const refetch = useCallback(async () => {
    await fetchContent(1, false, true); // Force refetch, skip cache
  }, [fetchContent]);

  const loadMore = useCallback(async () => {
    if (!fetchInProgressRef.current && hasMore) {
      await fetchContent(page + 1, true);
    }
  }, [fetchContent, hasMore, page]);

  // Auto-fetch on mount or when dependencies change
  useEffect(() => {
    if (autoFetch) {
      fetchContent(1, false);
    }
  }, [fetchContent, autoFetch]);

  // Derive loading from status for backward compatibility
  const loading = status === 'loading';

  return {
    content,
    loading,
    error,
    status,
    refetch,
    loadMore,
    hasMore,
  };
}

// Specialized hooks for common use cases

export function useMovies(filterTag?: string, options?: Partial<UseContentOptions>) {
  const tags = filterTag ? ['movie', filterTag] : ['movie'];
  return useContent({ tags, ...options });
}

export function useSeries(filterTag?: string, options?: Partial<UseContentOptions>) {
  const tags = filterTag ? ['series', filterTag] : ['series'];
  return useContent({ tags, ...options });
}

export function useSitcoms(options?: Partial<UseContentOptions>) {
  return useContent({ tags: ['sitcom'], ...options });
}

export function useKidsContent(filterTag?: string, options?: Partial<UseContentOptions>) {
  const tags = filterTag ? ['kids', filterTag] : ['kids'];
  return useContent({ tags, ...options });
}

export function useHeroContent(options?: Partial<UseContentOptions>) {
  return useContent({ tags: ['hero_trailer'], limit: 20, ...options });
}

export function useSearch(query: string, options?: Partial<UseContentOptions>) {
  return useContent({ 
    text: query, 
    autoFetch: !!query.trim(),
    ...options
  });
}

export function useRelatedContent(categoryTag: string, excludeClaimId: string) {
  const [relatedContent, setRelatedContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchRelated = useCallback(async () => {
    if (!categoryTag) return;

    try {
      setLoading(true);
      setError(null);

      const allContent = await fetchByTag(categoryTag, 50);
      
      // Filter out the current content and shuffle
      const filtered = allContent.filter(item => item.claim_id !== excludeClaimId);
      const shuffled = filtered.sort(() => Math.random() - 0.5);
      
      setRelatedContent(shuffled.slice(0, 10));

    } catch (err) {
      const apiError: ApiError = {
        message: err instanceof Error ? err.message : 'Failed to fetch related content',
        details: err,
      };
      setError(apiError);
      setRelatedContent([]);
    } finally {
      setLoading(false);
    }
  }, [categoryTag, excludeClaimId]);

  useEffect(() => {
    fetchRelated();
  }, [fetchRelated]);

  return {
    content: relatedContent,
    loading,
    error,
    refetch: fetchRelated,
    loadMore: async () => {}, // Not applicable for related content
    hasMore: false,
  };
}

/**
 * Hook for series content that ensures episodes are grouped by series
 * CRITICAL: This hook prevents series from appearing as flat episode lists
 * 
 * @param filterTag - Optional filter tag for series
 * @returns Content with series properly grouped
 */
export function useSeriesGrouped(filterTag?: string) {
  const tags = filterTag ? ['series', filterTag] : ['series'];
  const { content, loading, error, refetch, loadMore, hasMore } = useContent({ tags });
  const [groupedContent, setGroupedContent] = useState<ContentItem[]>([]);
  const [seriesMap, setSeriesMap] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    // Import series utilities dynamically to avoid circular dependencies
    import('../lib/series').then(({ groupSeriesContent, seriesToContentItem, getSeriesRepresentative }) => {
      const { series, nonSeriesContent } = groupSeriesContent(content, []);
      
      // Convert series to content items for display
      const seriesAsContent: ContentItem[] = [];
      for (const [seriesKey, seriesInfo] of series.entries()) {
        const representative = getSeriesRepresentative(seriesInfo, content);
        if (representative) {
          const seriesItem = seriesToContentItem(seriesInfo, representative);
          seriesAsContent.push(seriesItem);
        }
      }
      
      // Combine series and non-series content
      setGroupedContent([...seriesAsContent, ...nonSeriesContent]);
      setSeriesMap(series);
    });
  }, [content]);

  return {
    content: groupedContent,
    seriesMap,
    loading,
    error,
    refetch,
    loadMore,
    hasMore,
  };
}

// Hook for managing content cache and offline status
export function useContentWithOfflineStatus(claimId: string) {
  const [content, setContent] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [offlineQualities, setOfflineQualities] = useState<string[]>([]);

  const fetchContentDetails = useCallback(async () => {
    if (!claimId) return;

    try {
      setLoading(true);
      setError(null);

      // This would typically resolve the claim to get full details
      // For now, we'll use a placeholder implementation
      const results = await fetchChannelClaims({ limit: 1 });
      const item = results.find(c => c.claim_id === claimId);
      
      if (item) {
        setContent(item);
        
        // Check offline availability for each quality
        const qualities = Object.keys(item.video_urls);
        const offlineChecks = await Promise.allSettled(
          qualities.map(async (quality) => {
            // This would check if content is available offline
            // Implementation depends on the offline storage system
            return { quality, available: false };
          })
        );

        const availableOffline = offlineChecks
          .filter((result): result is PromiseFulfilledResult<{quality: string, available: boolean}> => 
            result.status === 'fulfilled' && result.value.available
          )
          .map(result => result.value.quality);

        setOfflineQualities(availableOffline);
      } else {
        setContent(null);
      }

    } catch (err) {
      const apiError: ApiError = {
        message: err instanceof Error ? err.message : 'Failed to fetch content details',
        details: err,
      };
      setError(apiError);
      setContent(null);
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    fetchContentDetails();
  }, [fetchContentDetails]);

  return {
    content,
    loading,
    error,
    offlineQualities,
    refetch: fetchContentDetails,
  };
}