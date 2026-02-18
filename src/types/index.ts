// Core content types
export interface ContentItem {
  claim_id: string;
  title: string;
  description?: string;
  tags: string[];
  thumbnail_url?: string;
  duration?: number;
  release_time: number;
  video_urls: Record<string, VideoUrl>;
  compatibility: CompatibilityInfo;
  etag?: string;
  content_hash?: string;
  raw_json?: string;
}

export interface VideoUrl {
  url: string;
  quality: string;
  type: 'mp4' | 'hls';
  codec?: string;
}

export interface CompatibilityInfo {
  compatible: boolean;
  reason?: string;
  fallback_available: boolean;
}

// Series and playlist types
export interface Playlist {
  id: string;
  title: string;
  claim_id: string;
  items: PlaylistItem[];
  season_number?: number;
  series_key?: string;
}

export interface PlaylistItem {
  claim_id: string;
  position: number;
  episode_number?: number;
  season_number?: number;
}

export interface SeriesInfo {
  series_key: string;
  title: string;
  seasons: Season[];
  total_episodes: number;
}

export interface Season {
  number: number;
  episodes: Episode[];
  playlist_id?: string;
  inferred: boolean;
}

export interface Episode {
  claim_id: string;
  title: string;
  episode_number: number;
  season_number: number;
  thumbnail_url?: string;
  duration?: number;
}

// User data types
export interface ProgressData {
  claim_id: string;
  position_seconds: number;
  quality: string;
  updated_at: number;
}

export interface FavoriteItem {
  claim_id: string;
  title: string;
  thumbnail_url?: string;
  inserted_at: number;
}

export interface OfflineMetadata {
  claim_id: string;
  quality: string;
  filename: string;
  file_size: number;
  encrypted: boolean;
  added_at: number;
}

// Application configuration
export interface AppConfig {
  theme: 'dark' | 'light';
  last_used_quality: string;
  encrypt_downloads: boolean;
  auto_upgrade_quality: boolean;
  cache_ttl_minutes: number;
  max_cache_items: number;
  vault_path: string;
  version: string;
  gateways: string[];
}

// Update system types
export interface VersionManifest {
  latestVersion: string;
  minSupportedVersion: string;
  releaseNotes: string;
  downloadUrl: string;
  checksums?: Record<string, string>;
  emergencyDisable?: boolean;
}

export interface UpdateState {
  status: 'checking' | 'current' | 'optional' | 'forced' | 'emergency' | 'error';
  current_version: string;
  latest_version?: string;
  min_supported_version?: string;
  release_notes?: string;
  download_url?: string;
  last_checked?: number;
  deferred_until?: number;
}

// Download types
export interface DownloadRequest {
  claim_id: string;
  quality: string;
  url: string;
}

export interface DownloadProgress {
  claim_id: string;
  quality: string;
  percent: number;
  bytes_written: number;
  total_bytes?: number;
  speed_bytes_per_sec?: number;
}

export interface StreamOfflineResponse {
  url: string;
  port: number;
}

// Diagnostics types
export interface DiagnosticsData {
  gateway_health: GatewayHealth[];
  database_version: number;
  free_disk_bytes: number;
  local_server_status: ServerStatus;
  last_manifest_fetch?: number;
  cache_stats: CacheStats;
  download_stats: DownloadStats;
}

export interface GatewayHealth {
  url: string;
  status: 'healthy' | 'degraded' | 'down';
  last_success?: number;
  last_error?: string;
  response_time_ms?: number;
}

export interface ServerStatus {
  running: boolean;
  port?: number;
  active_streams: number;
}

export interface CacheStats {
  total_items: number;
  cache_size_bytes: number;
  hit_rate: number;
  last_cleanup?: number;
}

export interface MemoryStats {
  cache_items: number;
  cache_size_bytes: number;
  playlist_count: number;
  favorites_count: number;
  offline_content_count: number;
  database_file_size: number;
}

export interface DownloadStats {
  total_downloads: number;
  total_bytes_downloaded: number;
  average_throughput_bytes_per_sec: number;
  last_download_timestamp?: number;
}

// UI types
export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

export interface CategoryDefinition {
  label: string;
  baseTag: string;
  filters: FilterDefinition[];
}

export interface FilterDefinition {
  label: string;
  tag: string;
}

export interface CategoryConfig {
  movies: CategoryDefinition;
  series: CategoryDefinition;
  sitcoms: CategoryDefinition;
  kids: CategoryDefinition;
}

// Player types
export interface PlayerState {
  playing: boolean;
  currentTime: number;
  duration: number;
  quality: string;
  availableQualities: string[];
  buffering: boolean;
  error?: string;
}

export interface QualityOption {
  label: string;
  value: string;
  bitrate?: number;
}

// Search types
export interface SearchQuery {
  text?: string;
  tags?: string[];
  category?: string;
  limit?: number;
  page?: number;
}

export interface SearchResult {
  items: ContentItem[];
  total: number;
  page: number;
  hasMore: boolean;
}

// Navigation types
export interface NavItem {
  label: string;
  path: string;
  icon?: string;
  children?: NavItem[];
}

// Error types
export interface ApiError {
  message: string;
  code?: string;
  details?: any;
  retryable?: boolean;
  category?: 'network' | 'timeout' | 'offline' | 'validation' | 'unknown';
}

// Hook return types
export interface UseContentReturn {
  content: ContentItem[];
  loading: boolean;
  error: ApiError | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  fromCache: boolean;
}

export interface UsePlayerReturn {
  playerState: PlayerState;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setQuality: (quality: string) => void;
  setVolume: (volume: number) => void;
}

export interface UseDownloadReturn {
  downloads: DownloadProgress[];
  downloadContent: (request: DownloadRequest) => Promise<void>;
  deleteDownload: (claimId: string, quality: string) => Promise<void>;
  getOfflineUrl: (claimId: string, quality: string) => Promise<string>;
}

// Form types
export interface SettingsForm {
  theme: 'dark' | 'light';
  encrypt_downloads: boolean;
  auto_upgrade_quality: boolean;
  cache_ttl_minutes: number;
  max_cache_items: number;
}

// Animation types
export interface AnimationConfig {
  duration: number;
  easing: string;
  delay?: number;
}

// Responsive breakpoints
export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

// Theme types
export type Theme = 'dark' | 'light';

// Quality types
export type Quality = '1080p' | '720p' | '480p' | '360p' | '240p' | 'master';

// Content categories (hard-coded tags)
export type BaseTag = 'series' | 'movie' | 'sitcom' | 'kids' | 'hero_trailer';

export type CategoryTag = 
  | 'comedy_movies' | 'action_movies' | 'romance_movies'
  | 'comedy_series' | 'action_series' | 'romance_series'
  | 'comedy_kids' | 'action_kids';

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Event types for Tauri
export interface TauriEvent<T = any> {
  event: string;
  windowLabel: string;
  payload: T;
  id: number;
}

// Odysee API types
export interface OdyseeRequest {
  method: string;
  params: any;
}

export interface OdyseeResponse {
  success: boolean;
  error?: string;
  data?: any;
}

export interface ClaimSearchParams {
  channel?: string;
  any_tags?: string[];
  text?: string;
  page_size?: number;
  page?: number;
  order_by?: string[];
}

export interface PlaylistSearchParams {
  channel?: string;
  page_size?: number;
  page?: number;
}

// Cache query types
export interface CacheQuery {
  tags?: string[];
  text_search?: string;
  limit?: number;
  offset?: number;
  order_by?: string;
}

// Gateway configuration
export interface GatewayConfig {
  primary: string;
  secondary: string;
  fallback: string;
  timeout_seconds: number;
  max_retries: number;
}

// Range request for HTTP streaming
export interface RangeRequest {
  start: number;
  end?: number;
}

// Encryption configuration
export interface EncryptionConfig {
  enabled: boolean;
  algorithm: string;
  key_derivation: string;
  iterations: number;
}

// Database migration
export interface Migration {
  version: number;
  name: string;
  sql: string;
  applied_at?: number;
}

// Series parsing result
export interface ParsedSeries {
  series_name: string;
  season_number: number;
  episode_number: number;
  episode_title: string;
}

// Version comparison
export interface Version {
  major: number;
  minor: number;
  patch: number;
}

// Stream offline request
export interface StreamOfflineRequest {
  claim_id: string;
  quality: string;
}

// Constants for tags (matching Rust backend)
export const BASE_TAGS = ['series', 'movie', 'sitcom', 'kids', 'hero_trailer'] as const;
export const FILTER_TAGS = [
  'comedy_movies', 'action_movies', 'romance_movies',
  'comedy_series', 'action_series', 'romance_series',
  'comedy_kids', 'action_kids'
] as const;

// Quality constants
export const QUALITY_LEVELS = ['1080p', '720p', '480p', '360p', '240p', 'master'] as const;

// Type guards
export function isBaseTag(tag: string): tag is BaseTag {
  return BASE_TAGS.includes(tag as BaseTag);
}

export function isFilterTag(tag: string): tag is CategoryTag {
  return FILTER_TAGS.includes(tag as CategoryTag);
}

export function isValidQuality(quality: string): quality is Quality {
  return QUALITY_LEVELS.includes(quality as Quality);
}

// Utility functions for tags
export function baseTagForFilter(filterTag: CategoryTag): BaseTag | null {
  if (filterTag.includes('movies')) return 'movie';
  if (filterTag.includes('series')) return 'series';
  if (filterTag.includes('kids')) return 'kids';
  return null;
}

// Utility functions for quality
export function nextLowerQuality(current: Quality): Quality | null {
  // CDN Playback: "master" quality has no lower quality (HLS adaptive)
  if (current === 'master') return null;
  
  const index = QUALITY_LEVELS.indexOf(current);
  if (index === -1 || index === QUALITY_LEVELS.length - 1) return null;
  return QUALITY_LEVELS[index + 1];
}

export function qualityScore(quality: Quality): number {
  const scores: Record<Quality, number> = {
    'master': 6,  // CDN Playback: Highest priority for HLS adaptive
    '1080p': 5,
    '720p': 4,
    '480p': 3,
    '360p': 2,
    '240p': 1
  };
  return scores[quality] || 0;
}

// Series parsing utilities
export function parseSeriesTitle(title: string): ParsedSeries | null {
  const regex = /^(.+?)\s+S(\d{1,2})E(\d{1,2})\s*-\s*(.+)$/;
  const match = title.match(regex);
  
  if (!match) return null;
  
  return {
    series_name: match[1].trim(),
    season_number: parseInt(match[2], 10),
    episode_number: parseInt(match[3], 10),
    episode_title: match[4].trim()
  };
}

export function generateSeriesKey(seriesName: string): string {
  return seriesName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .join('-');
}

// Version comparison utilities
export function parseVersion(versionStr: string): Version | null {
  const parts = versionStr.split('.');
  
  if (parts.length < 2 || parts.length > 3) return null;
  
  const major = parseInt(parts[0], 10);
  const minor = parseInt(parts[1], 10);
  const patch = parts.length === 3 ? parseInt(parts[2], 10) : 0;
  
  if (isNaN(major) || isNaN(minor) || isNaN(patch)) return null;
  
  return { major, minor, patch };
}

export function compareVersions(v1: string, v2: string): number {
  const version1 = parseVersion(v1);
  const version2 = parseVersion(v2);
  
  if (!version1 || !version2) {
    throw new Error('Invalid version format');
  }
  
  if (version1.major !== version2.major) {
    return version1.major - version2.major;
  }
  if (version1.minor !== version2.minor) {
    return version1.minor - version2.minor;
  }
  return version1.patch - version2.patch;
}

export function isVersionGreater(v1: string, v2: string): boolean {
  return compareVersions(v1, v2) > 0;
}

export function isVersionLess(v1: string, v2: string): boolean {
  return compareVersions(v1, v2) < 0;
}

export function versionToString(version: Version): string {
  if (version.patch === 0) {
    return `${version.major}.${version.minor}`;
  }
  return `${version.major}.${version.minor}.${version.patch}`;
}

// Range request utilities
export function parseRangeHeader(header: string): RangeRequest | null {
  if (!header.startsWith('bytes=')) return null;
  
  const rangePart = header.substring(6);
  const parts = rangePart.split('-');
  
  if (parts.length !== 2) return null;
  
  const start = parts[0] ? parseInt(parts[0], 10) : 0;
  const end = parts[1] ? parseInt(parts[1], 10) : undefined;
  
  if (isNaN(start) || (end !== undefined && isNaN(end))) return null;
  
  return { start, end };
}

export function toContentRangeHeader(range: RangeRequest, totalSize: number): string {
  const end = range.end !== undefined ? range.end : totalSize - 1;
  return `bytes ${range.start}-${end}/${totalSize}`;
}

export function getActualEnd(range: RangeRequest, fileSize: number): number {
  if (range.end !== undefined) {
    return Math.min(range.end, fileSize - 1);
  }
  return fileSize - 1;
}

export function getByteCount(range: RangeRequest, fileSize: number): number {
  const end = getActualEnd(range, fileSize);
  return end - range.start + 1;
}

// Content utilities
export function getPrimaryCategory(content: ContentItem): BaseTag | null {
  for (const tag of content.tags) {
    if (isBaseTag(tag)) {
      return tag;
    }
  }
  return null;
}

export function hasTag(content: ContentItem, tag: string): boolean {
  return content.tags.includes(tag);
}

export function getAvailableQualities(content: ContentItem): string[] {
  return Object.keys(content.video_urls).sort((a, b) => {
    const scoreA = isValidQuality(a) ? qualityScore(a as Quality) : 0;
    const scoreB = isValidQuality(b) ? qualityScore(b as Quality) : 0;
    return scoreA - scoreB;
  });
}

export function getBestQualityUrl(content: ContentItem): VideoUrl | null {
  const qualities = getAvailableQualities(content);
  if (qualities.length === 0) return null;
  
  // Return highest quality
  const bestQuality = qualities[qualities.length - 1];
  return content.video_urls[bestQuality] || null;
}

export function isContentCompatible(content: ContentItem): boolean {
  return content.compatibility.compatible;
}

export function getCompatibilityWarning(content: ContentItem): string | null {
  if (content.compatibility.compatible) return null;
  return content.compatibility.reason || 'This content may not be compatible with your platform';
}

// Playlist utilities
export function isPlaylistSeason(playlist: Playlist): boolean {
  return playlist.season_number !== undefined;
}

export function getEpisodeCount(playlist: Playlist): number {
  return playlist.items.length;
}

// Update state utilities
export function isForcedUpdate(state: UpdateState): boolean {
  return state.status === 'forced';
}

export function isUpdateAvailable(state: UpdateState): boolean {
  return state.status === 'optional' || state.status === 'forced';
}

export function isUpdateDeferred(state: UpdateState): boolean {
  if (!state.deferred_until) return false;
  const now = Math.floor(Date.now() / 1000);
  return now < state.deferred_until;
}

// Format utilities
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString();
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;
  
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  
  return formatTimestamp(timestamp);
}

// Validation utilities
export function validateClaimId(claimId: string): boolean {
  return claimId.length > 0 && claimId.length <= 100;
}

export function validateQuality(quality: string): boolean {
  return isValidQuality(quality);
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Error handling utilities
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as any).message === 'string'
  );
}

export function formatApiError(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred';
}
