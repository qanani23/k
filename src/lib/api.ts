import { invoke } from '@tauri-apps/api/tauri';
import { 
  ContentItem, 
  Playlist, 
  ProgressData, 
  FavoriteItem, 
  AppConfig, 
  DiagnosticsData,
  CacheStats,
  DownloadRequest,
  StreamOfflineResponse
} from '../types';

/**
 * API wrapper for Tauri commands
 * Provides type-safe interface to the Rust backend
 */

// Read channel ID from environment with fallback
const CHANNEL_ID = import.meta.env.VITE_CHANNEL_ID || '@kiyyamovies:b';

// Content discovery
export const fetchChannelClaims = async (params: {
  any_tags?: string[];
  text?: string;
  limit?: number;
  page?: number;
  force_refresh?: boolean;
}): Promise<ContentItem[]> => {
  return await invoke('fetch_channel_claims', {
    channel_id: CHANNEL_ID,
    ...params
  });
};

export const fetchPlaylists = async (): Promise<Playlist[]> => {
  return await invoke('fetch_playlists', {
    channel_id: CHANNEL_ID
  });
};

export const resolveClaim = async (claimIdOrUri: string): Promise<ContentItem> => {
  return await invoke('resolve_claim', { claim_id_or_uri: claimIdOrUri });
};

// Content fetching by tags (convenience functions)
export const fetchByTag = async (tag: string, limit: number = 50, forceRefresh: boolean = false): Promise<ContentItem[]> => {
  return await fetchChannelClaims({ any_tags: [tag], limit, force_refresh: forceRefresh });
};

export const fetchByTags = async (tags: string[], limit: number = 50, forceRefresh: boolean = false): Promise<ContentItem[]> => {
  return await fetchChannelClaims({ any_tags: tags, limit, force_refresh: forceRefresh });
};

export const searchContent = async (text: string, limit: number = 50): Promise<ContentItem[]> => {
  return await fetchChannelClaims({ text, limit });
};

export const fetchHeroContent = async (limit: number = 20): Promise<ContentItem[]> => {
  return await fetchByTag('hero_trailer', limit);
};

// Download management
export const downloadMovieQuality = async (params: DownloadRequest): Promise<void> => {
  return await invoke('download_movie_quality', { ...params });
};

export const streamOffline = async (params: {
  claim_id: string;
  quality: string;
}): Promise<StreamOfflineResponse> => {
  return await invoke('stream_offline', params);
};

export const deleteOffline = async (params: {
  claim_id: string;
  quality: string;
}): Promise<void> => {
  return await invoke('delete_offline', params);
};

// Progress tracking
export const saveProgress = async (params: {
  claim_id: string;
  position_seconds: number;
  quality: string;
}): Promise<void> => {
  return await invoke('save_progress', params);
};

export const getProgress = async (claimId: string): Promise<ProgressData | null> => {
  return await invoke('get_progress', { claim_id: claimId });
};

// Favorites management
export const saveFavorite = async (params: {
  claim_id: string;
  title: string;
  thumbnail_url?: string;
}): Promise<void> => {
  return await invoke('save_favorite', params);
};

export const removeFavorite = async (claimId: string): Promise<void> => {
  return await invoke('remove_favorite', { claim_id: claimId });
};

export const getFavorites = async (): Promise<FavoriteItem[]> => {
  return await invoke('get_favorites');
};

export const isFavorite = async (claimId: string): Promise<boolean> => {
  return await invoke('is_favorite', { claim_id: claimId });
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
  return await invoke('invalidate_cache_item', { claim_id: claimId });
};

export const invalidateCacheByTags = async (tags: string[]): Promise<void> => {
  return await invoke('invalidate_cache_by_tags', { tags });
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
 */
export const getBestQualityUrl = (content: ContentItem, preferredQuality?: string): string | null => {
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