import { invoke } from '@tauri-apps/api/tauri';
import { 
  ContentItem, 
  Playlist, 
  ProgressData, 
  FavoriteItem, 
  AppConfig, 
  DiagnosticsData,
  CacheStats,
  MemoryStats,
  DownloadRequest,
  StreamOfflineResponse
} from '../types';

/**
 * API wrapper for Tauri commands
 * Provides type-safe interface to the Rust backend
 */

// Read channel ID from environment with fallback
const CHANNEL_ID = import.meta.env.VITE_CHANNEL_ID || '@kiyyamovies:b';

// Development mode flag
const isDev = import.meta.env.DEV;

// Retry configuration types
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number; // in milliseconds
  backoffMultiplier: number;
}

// Retry configurations for different fetch types
export const RETRY_CONFIGS: Record<string, RetryConfig> = {
  hero: {
    maxRetries: 3,
    initialDelay: 1000,
    backoffMultiplier: 2
  },
  category: {
    maxRetries: 3,
    initialDelay: 1000,
    backoffMultiplier: 2
  },
  search: {
    maxRetries: 3,
    initialDelay: 1000,
    backoffMultiplier: 2
  }
};

// Validation types
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate content item structure
 * Ensures required fields exist for proper rendering and tag filtering
 * 
 * NOTE: Backend returns ContentItem structs, not raw Odysee API responses
 */
function validateContentItem(item: any): ValidationResult {
  const errors: string[] = [];
  
  // Handle null or undefined items
  if (!item || typeof item !== 'object') {
    errors.push('Item is null, undefined, or not an object');
    return {
      valid: false,
      errors
    };
  }
  
  // Check required fields for ContentItem struct from backend
  if (!item.claim_id || typeof item.claim_id !== 'string') {
    errors.push('Missing or invalid claim_id');
  }
  
  if (!item.title || typeof item.title !== 'string') {
    errors.push('Missing or invalid title');
  }
  
  if (!item.tags || !Array.isArray(item.tags)) {
    errors.push('Missing or invalid tags array');
  }
  
  if (typeof item.release_time !== 'number') {
    errors.push('Missing or invalid release_time');
  }
  
  if (!item.video_urls || typeof item.video_urls !== 'object') {
    errors.push('Missing or invalid video_urls');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate and filter content array
 * Removes invalid items and logs validation errors in development mode
 */
function validateAndFilterContent(items: any[]): ContentItem[] {
  if (!Array.isArray(items)) {
    if (isDev) {
      console.error('[API Validation] Expected array, received:', typeof items);
    }
    return [];
  }
  
  const validatedItems = items.filter(item => {
    const validation = validateContentItem(item);
    
    if (!validation.valid) {
      if (isDev) {
        console.warn('[API Validation] Invalid content item:', {
          errors: validation.errors,
          claim_id: item?.claim_id || 'unknown',
          item
        });
      }
      return false;
    }
    
    return true;
  });
  
  if (isDev && validatedItems.length < items.length) {
    console.warn('[API Validation] Filtered out invalid items:', {
      original: items.length,
      valid: validatedItems.length,
      filtered: items.length - validatedItems.length
    });
  }
  
  return validatedItems as ContentItem[];
}

/**
 * Retry utility function with exponential backoff
 * Retries a fetch operation with configurable retry strategy
 * 
 * @param fetchFn - The async function to retry
 * @param config - Retry configuration (maxRetries, initialDelay, backoffMultiplier)
 * @returns Promise resolving to the fetch result
 * @throws The last error if all retries fail
 */
export async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  config: RetryConfig = RETRY_CONFIGS.category
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      lastError = error as Error;
      
      // If this is not the last attempt, wait before retrying
      if (attempt < config.maxRetries) {
        const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
        
        if (isDev) {
          console.log(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms`, {
            error: lastError.message,
            nextAttempt: attempt + 2,
            maxRetries: config.maxRetries + 1
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        if (isDev) {
          console.error(`[Retry] All ${config.maxRetries + 1} attempts failed`, {
            error: lastError.message
          });
        }
      }
    }
  }
  
  throw lastError!;
}

// Content discovery
export const fetchChannelClaims = async (params: {
  any_tags?: string[];
  text?: string;
  limit?: number;
  page?: number;
  force_refresh?: boolean;
  stream_types?: string[];
}): Promise<ContentItem[]> => {
  return await fetchWithRetry(async () => {
    try {
      if (isDev) {
        console.log('🔍 [API] About to invoke fetch_channel_claims with params:', {
          channelId: CHANNEL_ID,
          anyTags: params.any_tags,
          text: params.text,
          limit: params.limit,
          page: params.page,
          forceRefresh: params.force_refresh,
          streamTypes: params.stream_types
        });
      }
      
      // Add timeout to prevent infinite hang
      const invokePromise = invoke('fetch_channel_claims', {
        channelId: CHANNEL_ID,  // Tauri converts snake_case to camelCase
        anyTags: params.any_tags,
        text: params.text,
        limit: params.limit,
        page: params.page,
        forceRefresh: params.force_refresh,
        streamTypes: params.stream_types
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Tauri invoke timeout after 30s')), 30000)
      );
      
      const response = await Promise.race([invokePromise, timeoutPromise]);
      
      // TRACING: Stage 6 - frontend receive
      if (isDev) {
        console.log('[TRACE] Stage 6: Frontend received content items', {
          component: 'content_pipeline',
          stage: 'frontend_receive',
          item_count: Array.isArray(response) ? response.length : 0,
          items: Array.isArray(response) ? response.map((item: any) => ({
            claim_id: item.claim_id,
            title: item.title,
            has_video_urls: !!item.video_urls && Object.keys(item.video_urls).length > 0,
            video_url_keys: item.video_urls ? Object.keys(item.video_urls) : [],
            video_urls_detail: item.video_urls ? Object.entries(item.video_urls).map(([key, val]: [string, any]) => ({
              quality: key,
              url: val.url,
              type: val.url_type
            })) : []
          })) : []
        });
      }
      
      if (isDev) {
        console.log('✅ [API] invoke returned, response type:', typeof response, 'is array:', Array.isArray(response));
        console.log('[API] fetchChannelClaims response:', {
          tags: params.any_tags,
          text: params.text,
          stream_types: params.stream_types,
          count: Array.isArray(response) ? response.length : 0
        });
      }
      
      // Validate and filter response
      if (isDev) console.log('🔍 [API] Calling validateAndFilterContent');
      const validated = validateAndFilterContent(response as any[]);
      if (isDev) console.log('✅ [API] validateAndFilterContent returned', validated.length, 'items');
      return validated;
    } catch (error) {
      if (isDev) {
        console.error('❌ [API] fetchChannelClaims error:', {
          params,
          error,
          errorType: typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined
        });
      }
      throw error;
    }
  }, RETRY_CONFIGS.category);
};

export const fetchPlaylists = async (): Promise<Playlist[]> => {
  return await fetchWithRetry(async () => {
    return await invoke('fetch_playlists', {
      channelId: CHANNEL_ID  // Tauri converts snake_case to camelCase
    });
  }, RETRY_CONFIGS.category);
};

export const resolveClaim = async (claimIdOrUri: string): Promise<ContentItem> => {
  return await fetchWithRetry(async () => {
    return await invoke('resolve_claim', { claimIdOrUri });  // Tauri converts snake_case to camelCase
  }, RETRY_CONFIGS.category);
};

// Content fetching by tags (convenience functions)
export const fetchByTag = async (tag: string, limit: number = 50, forceRefresh: boolean = false): Promise<ContentItem[]> => {
  try {
    const response = await fetchChannelClaims({ any_tags: [tag], limit, force_refresh: forceRefresh });
    
    if (isDev) {
      console.log('[API] fetchByTag response:', {
        tag,
        count: response.length
      });
    }
    
    return response;
  } catch (error) {
    if (isDev) {
      console.error('[API] fetchByTag error:', { tag, error });
    }
    throw error;
  }
};

export const fetchByTags = async (tags: string[], limit: number = 50, forceRefresh: boolean = false): Promise<ContentItem[]> => {
  try {
    if (isDev) {
      console.log('[API] fetchByTags called:', { tags, limit, forceRefresh });
    }
    
    // CRITICAL: Enforce stream-only filter for hero_trailer to prevent non-stream claims
    // Requirement 7.1, 7.2, 7.3: Hero query must filter by tag=hero_trailer AND value_type=stream
    const stream_types = tags.includes('hero_trailer') ? ['stream'] : undefined;
    
    const response = await fetchChannelClaims({ 
      any_tags: tags, 
      limit, 
      force_refresh: forceRefresh,
      stream_types
    });
    
    if (isDev) {
      console.log('[API] fetchByTags response:', {
        tags,
        stream_types,
        count: response.length,
        items: response.map(item => ({
          claim_id: item.claim_id,
          title: item.title,
          tags: item.tags
        }))
      });
    }
    
    return response;
  } catch (error) {
    if (isDev) {
      console.error('[API] fetchByTags error:', { tags, error });
    }
    throw error;
  }
};

export const searchContent = async (text: string, limit: number = 50): Promise<ContentItem[]> => {
  // Uses fetchChannelClaims which already has retry logic
  return await fetchChannelClaims({ text, limit });
};

export const fetchHeroContent = async (limit: number = 20): Promise<ContentItem[]> => {
  // Uses fetchByTag which calls fetchChannelClaims with retry logic
  // Use hero-specific retry config for critical hero content
  return await fetchByTag('hero_trailer', limit);
};

// Download management
export const downloadMovieQuality = async (params: DownloadRequest): Promise<void> => {
  // Tauri converts snake_case to camelCase
  return await invoke('download_movie_quality', {
    claimId: params.claim_id,
    quality: params.quality,
    url: params.url
  });
};

export const streamOffline = async (params: {
  claim_id: string;
  quality: string;
}): Promise<StreamOfflineResponse> => {
  // Tauri converts snake_case to camelCase
  return await invoke('stream_offline', {
    claimId: params.claim_id,
    quality: params.quality
  });
};

export const deleteOffline = async (params: {
  claim_id: string;
  quality: string;
}): Promise<void> => {
  // Tauri converts snake_case to camelCase
  return await invoke('delete_offline', {
    claimId: params.claim_id,
    quality: params.quality
  });
};

// Progress tracking
export const saveProgress = async (params: {
  claim_id: string;
  position_seconds: number;
  quality: string;
}): Promise<void> => {
  // Tauri converts snake_case to camelCase
  return await invoke('save_progress', {
    claimId: params.claim_id,
    positionSeconds: params.position_seconds,
    quality: params.quality
  });
};

export const getProgress = async (claimId: string): Promise<ProgressData | null> => {
  return await invoke('get_progress', { claimId });  // Tauri converts snake_case to camelCase
};

// Favorites management
export const saveFavorite = async (params: {
  claim_id: string;
  title: string;
  thumbnail_url?: string;
}): Promise<void> => {
  // Tauri converts snake_case to camelCase
  return await invoke('save_favorite', {
    claimId: params.claim_id,
    title: params.title,
    thumbnailUrl: params.thumbnail_url
  });
};

export const removeFavorite = async (claimId: string): Promise<void> => {
  return await invoke('remove_favorite', { claimId });  // Tauri converts snake_case to camelCase
};

export const getFavorites = async (): Promise<FavoriteItem[]> => {
  return await invoke('get_favorites');
};

export const isFavorite = async (claimId: string): Promise<boolean> => {
  return await invoke('is_favorite', { claimId });  // Tauri converts snake_case to camelCase
};

// Configuration and settings
export const getAppConfig = async (): Promise<AppConfig> => {
  return await invoke('get_app_config');
};

export const updateSettings = async (settings: Record<string, string>): Promise<void> => {
  return await invoke('update_settings', { settings });
};

// Diagnostics
export const getDiagnostics = async (): Promise<DiagnosticsData> => {
  return await invoke('get_diagnostics');
};

// Cache management
export const getCacheStats = async (): Promise<CacheStats> => {
  return await invoke('get_cache_stats');
};

export const getMemoryStats = async (): Promise<MemoryStats> => {
  return await invoke('get_memory_stats');
};

export const optimizeDatabaseMemory = async (): Promise<void> => {
  return await invoke('optimize_database_memory');
};

export const invalidateCacheItem = async (claimId: string): Promise<void> => {
  return await invoke('invalidate_cache_item', { claimId });  // Tauri converts snake_case to camelCase
};

export const invalidateCacheByTags = async (tags: string[]): Promise<void> => {
  return await invoke('invalidate_cache_by_tags', { tags });  // Already camelCase
};

export const clearAllCache = async (): Promise<void> => {
  return await invoke('clear_all_cache');
};

export const cleanupExpiredCache = async (): Promise<number> => {
  return await invoke('cleanup_expired_cache');
};

// External links
export const openExternal = async (url: string): Promise<void> => {
  return await invoke('open_external', { url });
};

// Utility functions for common operations

/**
 * Fetch content for a specific category page
 */
export const fetchCategoryContent = async (
  baseTag: string, 
  filterTag?: string, 
  limit: number = 50,
  forceRefresh: boolean = false
): Promise<ContentItem[]> => {
  const tags = filterTag ? [baseTag, filterTag] : [baseTag];
  return await fetchByTags(tags, limit, forceRefresh);
};

/**
 * Fetch related content for recommendations
 */
export const fetchRelatedContent = async (
  categoryTag: string, 
  excludeClaimId: string, 
  limit: number = 10
): Promise<ContentItem[]> => {
  const allContent = await fetchByTag(categoryTag, 50);
  
  // Filter out the current content and shuffle
  const filtered = allContent.filter(item => item.claim_id !== excludeClaimId);
  const shuffled = filtered.sort(() => Math.random() - 0.5);
  
  return shuffled.slice(0, limit);
};

/**
 * Check if content is available offline
 */
export const isContentOffline = async (claimId: string, quality: string): Promise<boolean> => {
  try {
    const response = await streamOffline({ claim_id: claimId, quality });
    return !!response.url;
  } catch {
    return false;
  }
};

/**
 * Get available qualities for content
 */
export const getAvailableQualities = (content: ContentItem): string[] => {
  return Object.keys(content.video_urls).sort((a, b) => {
    const qualityOrder = { '360p': 1, '480p': 2, '720p': 3, '1080p': 4 };
    return (qualityOrder[a as keyof typeof qualityOrder] || 0) - 
           (qualityOrder[b as keyof typeof qualityOrder] || 0);
  });
};

/**
 * Get best quality URL for content
 * CDN Playback: Prioritize "master" quality for HLS adaptive streaming
 */
export const getBestQualityUrl = (content: ContentItem, preferredQuality?: string): string | null => {
  // CDN Playback: Prefer "master" quality if available
  if (content.video_urls['master']) {
    return content.video_urls['master'].url;
  }
  
  const qualities = getAvailableQualities(content);
  
  if (preferredQuality && content.video_urls[preferredQuality]) {
    return content.video_urls[preferredQuality].url;
  }
  
  // Return highest quality available
  const bestQuality = qualities[qualities.length - 1];
  return bestQuality ? content.video_urls[bestQuality].url : null;
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

/**
 * Format duration for display
 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
};

/**
 * Format timestamp for display
 */
export const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleDateString();
};

/**
 * Check if content is compatible with current platform
 */
export const isContentCompatible = (content: ContentItem): boolean => {
  return content.compatibility.compatible;
};

/**
 * Get compatibility warning message
 */
export const getCompatibilityWarning = (content: ContentItem): string | null => {
  if (content.compatibility.compatible) {
    return null;
  }
  
  return content.compatibility.reason || 'This content may not be compatible with your platform';
};