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
  const [fromCache, setFromCache] = useState(false);
  
  // State transition validation
  const statusRef = useRef<'idle' | 'loading' | 'success' | 'error'>('idle');
  
  // Performance tracking (development mode only)
  const performanceMetrics = useRef({
    cacheHits: 0,
    cacheMisses: 0,
    totalFetches: 0,
    slowFetches: 0,
  });
  
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
      // TEMPORARILY: Allow the transition anyway for debugging
      // return;
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
    // Prevent duplicate fetches unless it's a forced refetch
    if (fetchInProgressRef.current && !force) {
      if (isDev) console.log('[useContent] Fetch already in progress, skipping');
      return;
    }
    
    fetchInProgressRef.current = true;
    const startTime = isDev ? performance.now() : 0;
    
    // If offline and not in offline-only mode, check cache first
    if (!isOnline && !offlineOnly) {
      // Try to load from cache when offline
      if (memoryManager) {
        const cachedContent = memoryManager.getCollection(collectionId);
        if (cachedContent && cachedContent.length > 0) {
          setContent(cachedContent);
          setHasMore(false); // Can't load more when offline
          setPage(pageNum);
          setFromCache(true); // Mark as loaded from cache
          setStatusWithValidation('success');
          fetchInProgressRef.current = false;
          
          // Track cache hit
          performanceMetrics.current.cacheHits++;
          performanceMetrics.current.totalFetches++;
          
          if (isDev) {
            const duration = performance.now() - startTime;
            console.log('[useContent] Offline cache hit', {
              collectionId,
              itemCount: cachedContent.length,
              duration: `${duration.toFixed(2)}ms`,
              cacheHitRate: `${((performanceMetrics.current.cacheHits / performanceMetrics.current.totalFetches) * 100).toFixed(1)}%`
            });
          }
          return;
        }
      }
      
      // No cache available, show offline error
      const apiError: ApiError = {
        message: 'No internet connection. Only downloaded content is available.',
        details: 'offline',
        retryable: false,
        category: 'offline'
      };
      setError(apiError);
      setFromCache(false);
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
        // Update state synchronously before returning
        setContent(cachedContent);
        setHasMore(cachedContent.length === limit);
        setPage(pageNum);
        setFromCache(true); // Mark as loaded from cache
        setStatusWithValidation('success');
        fetchInProgressRef.current = false; // Reset before returning
        
        // Track cache hit
        performanceMetrics.current.cacheHits++;
        performanceMetrics.current.totalFetches++;
        
        if (isDev) {
          const duration = performance.now() - startTime;
          console.log('[useContent] Cache hit', {
            collectionId,
            pageNum,
            append,
            itemCount: cachedContent.length,
            duration: `${duration.toFixed(2)}ms`,
            cacheHitRate: `${((performanceMetrics.current.cacheHits / performanceMetrics.current.totalFetches) * 100).toFixed(1)}%`
          });
        }
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
      
      if (isDev) console.log('🔍 [FRONTEND] About to fetch content:', { text, tags, limit, pageNum });
      
      if (text) {
        if (isDev) console.log('🔍 [FRONTEND] Calling searchContent');
        results = await searchContent(text, limit);
        if (isDev) console.log('✅ [FRONTEND] searchContent returned:', results.length, 'items');
      } else if (tags && tags.length > 0) {
        if (isDev) console.log('🔍 [FRONTEND] Calling fetchByTags with tags:', tags);
        results = await fetchByTags(tags, limit);
        if (isDev) console.log('✅ [FRONTEND] fetchByTags returned:', results.length, 'items');
      } else {
        if (isDev) console.log('🔍 [FRONTEND] Calling fetchChannelClaims');
        results = await fetchChannelClaims({ limit, page: pageNum });
        if (isDev) console.log('✅ [FRONTEND] fetchChannelClaims returned:', results.length, 'items');
      }

      if (isDev) console.log('🔍 [FRONTEND] Fetch completed, storing in memory manager');

      // Store in memory manager
      if (memoryManager && !append) {
        if (isDev) console.log('🔍 [FRONTEND] Storing', results.length, 'items in memory manager');
        memoryManager.storeCollection(collectionId, results);
        if (isDev) console.log('✅ [FRONTEND] Stored in memory manager');
      }

      if (isDev) console.log('🔍 [FRONTEND] Updating content state');
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
      if (isDev) console.log('✅ [FRONTEND] Content state updated');

      // Check if there are more results
      setHasMore(results.length === limit);
      setPage(pageNum);
      setFromCache(false); // Mark as loaded from network
      
      // Track cache miss (network fetch)
      performanceMetrics.current.cacheMisses++;
      performanceMetrics.current.totalFetches++;
      
      if (isDev) console.log('🔍 [FRONTEND] Setting status to success');
      setStatusWithValidation('success');
      if (isDev) console.log('✅ [FRONTEND] Status set to success');
      if (isDev) {
        const duration = performance.now() - startTime;
        
        // Track slow fetches (>3 seconds)
        if (duration > 3000) {
          performanceMetrics.current.slowFetches++;
          console.warn('[Performance] ⚠️ Slow fetch detected', {
            collectionId,
            pageNum,
            append,
            itemCount: results.length,
            duration: `${duration.toFixed(2)}ms`,
            threshold: '3000ms'
          });
        }
        
        // Log memory usage if available
        const memoryUsage = (performance as any).memory ? {
          usedJSHeapSize: `${((performance as any).memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          totalJSHeapSize: `${((performance as any).memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          jsHeapSizeLimit: `${((performance as any).memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`,
        } : undefined;
        
        console.log('[useContent] State transition: loading → success', {
          collectionId,
          pageNum,
          append,
          itemCount: results.length,
          duration: `${duration.toFixed(2)}ms`,
          hasMore: results.length === limit,
          cacheHitRate: `${((performanceMetrics.current.cacheHits / performanceMetrics.current.totalFetches) * 100).toFixed(1)}%`,
          cacheMissRate: `${((performanceMetrics.current.cacheMisses / performanceMetrics.current.totalFetches) * 100).toFixed(1)}%`,
          slowFetches: performanceMetrics.current.slowFetches,
          ...(memoryUsage && { memoryUsage })
        });
      }

    } catch (err) {
      // Categorize and format error
      let apiError: ApiError;
      
      if (err instanceof Error) {
        const errorMessage = err.message.toLowerCase();
        
        // Timeout errors
        if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
          apiError = {
            message: 'Request timed out. Please check your connection and try again.',
            details: err,
            retryable: true,
            category: 'timeout'
          };
        }
        // Offline errors - check before network errors to catch "no internet connection"
        else if (errorMessage.includes('offline') || errorMessage.includes('no internet')) {
          apiError = {
            message: 'No internet connection. Only downloaded content is available.',
            details: err,
            retryable: false,
            category: 'offline'
          };
        }
        // Network errors
        else if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
          apiError = {
            message: 'Network error. Please check your internet connection and try again.',
            details: err,
            retryable: true,
            category: 'network'
          };
        }
        // Validation errors
        else if (errorMessage.includes('invalid') || errorMessage.includes('validation')) {
          apiError = {
            message: 'Invalid content data received. Please try again later.',
            details: err,
            retryable: true,
            category: 'validation'
          };
        }
        // Generic errors
        else {
          apiError = {
            message: 'Failed to fetch content. Please try again.',
            details: err,
            retryable: true,
            category: 'unknown'
          };
        }
      } else {
        // Non-Error objects
        apiError = {
          message: 'An unexpected error occurred. Please try again.',
          details: err,
          retryable: true,
          category: 'unknown'
        };
      }
      
      setError(apiError);
      setStatusWithValidation('error');
      if (isDev) {
        const duration = performance.now() - startTime;
        console.error('❌ [FRONTEND] State transition: loading → error', {
          collectionId,
          pageNum,
          append,
          duration: `${duration.toFixed(2)}ms`,
          error: err instanceof Error ? err.message : String(err),
          category: apiError.category,
          retryable: apiError.retryable,
          stack: err instanceof Error ? err.stack : undefined
        });
      }
      
      if (!append) {
        setContent([]);
      }
    } finally {
      if (isDev) console.log('🔍 [FRONTEND] Finally block - resetting fetchInProgressRef');
      fetchInProgressRef.current = false;
      if (isDev) console.log('✅ [FRONTEND] fetchInProgressRef reset to false');
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
  // Use a ref to track if we've already fetched for this collectionId
  const hasFetchedRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (autoFetch && hasFetchedRef.current !== collectionId) {
      hasFetchedRef.current = collectionId;
      fetchContent(1, false);
    }
  }, [autoFetch, collectionId, fetchContent]);

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
    fromCache,
  };
}

// Specialized hooks for common use cases

export function useMovies(filterTag?: string, options?: Partial<UseContentOptions>) {
  console.log('🎥 [FRONTEND DIAGNOSTIC] useMovies called, filterTag:', filterTag);
  const tags = filterTag ? ['movie', filterTag] : ['movie'];
  const result = useContent({ tags, ...options });
  console.log('🎥 [FRONTEND DIAGNOSTIC] useMovies result:', {
    contentCount: result.content.length,
    loading: result.loading,
    error: result.error,
    firstItem: result.content[0] ? {
      claim_id: result.content[0].claim_id,
      title: result.content[0].title,
      video_urls: Object.keys(result.content[0].video_urls)
    } : null
  });
  return result;
}

export function useSeries(filterTag?: string, options?: Partial<UseContentOptions>) {
  console.log('📺 [FRONTEND DIAGNOSTIC] useSeries called, filterTag:', filterTag);
  const tags = filterTag ? ['series', filterTag] : ['series'];
  const result = useContent({ tags, ...options });
  console.log('📺 [FRONTEND DIAGNOSTIC] useSeries result:', {
    contentCount: result.content.length,
    loading: result.loading,
    error: result.error,
    firstItem: result.content[0] ? {
      claim_id: result.content[0].claim_id,
      title: result.content[0].title,
      video_urls: Object.keys(result.content[0].video_urls)
    } : null
  });
  return result;
}

export function useSitcoms(options?: Partial<UseContentOptions>) {
  return useContent({ tags: ['sitcom'], ...options });
}

export function useKidsContent(filterTag?: string, options?: Partial<UseContentOptions>) {
  const tags = filterTag ? ['kids', filterTag] : ['kids'];
  return useContent({ tags, ...options });
}

export function useHeroContent(options?: Partial<UseContentOptions>) {
  console.log('🎬 [FRONTEND DIAGNOSTIC] useHeroContent called');
  
  const result = useContent({ tags: ['hero_trailer'], limit: 20, ...options });
  
  // DIAGNOSTIC: Log what we receive from backend
  console.log('🎬 [FRONTEND DIAGNOSTIC] useHeroContent result:', {
    contentCount: result.content.length,
    loading: result.loading,
    error: result.error,
    fromCache: result.fromCache,
    hasMore: result.hasMore,
    status: result.status,
    content: result.content.map(item => ({
      claim_id: item.claim_id,
      title: item.title,
      tags: item.tags,
      video_urls: Object.keys(item.video_urls),
      master_url: item.video_urls['master']?.url
    }))
  });
  
  return result;
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
      // Categorize and format error
      let apiError: ApiError;
      
      if (err instanceof Error) {
        const errorMessage = err.message.toLowerCase();
        
        if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
          apiError = {
            message: 'Request timed out. Please try again.',
            details: err,
            retryable: true,
            category: 'timeout'
          };
        } else if (errorMessage.includes('offline') || errorMessage.includes('no internet')) {
          apiError = {
            message: 'No internet connection. Please try again.',
            details: err,
            retryable: false,
            category: 'offline'
          };
        } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
          apiError = {
            message: 'Network error. Please try again.',
            details: err,
            retryable: true,
            category: 'network'
          };
        } else {
          apiError = {
            message: 'Failed to fetch related content. Please try again.',
            details: err,
            retryable: true,
            category: 'unknown'
          };
        }
      } else {
        apiError = {
          message: 'Failed to fetch related content. Please try again.',
          details: err,
          retryable: true,
          category: 'unknown'
        };
      }
      
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
      // Categorize and format error
      let apiError: ApiError;
      
      if (err instanceof Error) {
        const errorMessage = err.message.toLowerCase();
        
        if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
          apiError = {
            message: 'Request timed out. Please try again.',
            details: err,
            retryable: true,
            category: 'timeout'
          };
        } else if (errorMessage.includes('offline') || errorMessage.includes('no internet')) {
          apiError = {
            message: 'No internet connection. Please try again.',
            details: err,
            retryable: false,
            category: 'offline'
          };
        } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
          apiError = {
            message: 'Network error. Please try again.',
            details: err,
            retryable: true,
            category: 'network'
          };
        } else {
          apiError = {
            message: 'Failed to fetch content details. Please try again.',
            details: err,
            retryable: true,
            category: 'unknown'
          };
        }
      } else {
        apiError = {
          message: 'Failed to fetch content details. Please try again.',
          details: err,
          retryable: true,
          category: 'unknown'
        };
      }
      
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