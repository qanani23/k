/**
 * Storage utilities for UI preferences
 * 
 * CRITICAL: LocalStorage may ONLY be used for UI preferences.
 * Data like favorites MUST be stored in SQLite via Tauri commands.
 */

const STORAGE_PREFIX = 'kiyya-';

/**
 * UI preferences that can be stored in localStorage
 */
export interface UIPreferences {
  theme: 'dark' | 'light';
  lastUsedQuality: string;
  autoUpgradeQuality: boolean;
  volume: number;
  playbackSpeed: number;
}

/**
 * Storage keys for UI preferences
 */
export const StorageKeys = {
  THEME: `${STORAGE_PREFIX}theme`,
  LAST_USED_QUALITY: `${STORAGE_PREFIX}last-used-quality`,
  AUTO_UPGRADE_QUALITY: `${STORAGE_PREFIX}auto-upgrade-quality`,
  VOLUME: `${STORAGE_PREFIX}volume`,
  PLAYBACK_SPEED: `${STORAGE_PREFIX}playback-speed`,
  SEARCH_HISTORY: `${STORAGE_PREFIX}search-history`,
  DEFERRED_UPDATE: (version: string) => `${STORAGE_PREFIX}deferred-update-${version}`,
} as const;

/**
 * Session storage keys for temporary session data
 */
export const SessionStorageKeys = {
  SELECTED_HERO: `${STORAGE_PREFIX}selected-hero`,
} as const;

/**
 * Default UI preferences
 */
export const DEFAULT_PREFERENCES: UIPreferences = {
  theme: 'dark',
  lastUsedQuality: '720p',
  autoUpgradeQuality: true,
  volume: 1.0,
  playbackSpeed: 1.0,
};

/**
 * Safely get an item from localStorage
 * @param key Storage key
 * @returns The stored value or null if not found or error occurs
 */
export function getStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`Failed to get storage item: ${key}`, error);
    return null;
  }
}

/**
 * Safely set an item in localStorage
 * @param key Storage key
 * @param value Value to store
 * @returns true if successful, false otherwise
 */
export function setStorageItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`Failed to set storage item: ${key}`, error);
    return false;
  }
}

/**
 * Safely remove an item from localStorage
 * @param key Storage key
 * @returns true if successful, false otherwise
 */
export function removeStorageItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`Failed to remove storage item: ${key}`, error);
    return false;
  }
}

/**
 * Safely get a JSON object from localStorage
 * @param key Storage key
 * @param defaultValue Default value if not found or parse fails
 * @returns The parsed object or default value
 */
export function getStorageJSON<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) {
      return defaultValue;
    }
    return JSON.parse(stored) as T;
  } catch (error) {
    console.warn(`Failed to get/parse storage JSON: ${key}`, error);
    return defaultValue;
  }
}

/**
 * Safely set a JSON object in localStorage
 * @param key Storage key
 * @param value Value to store
 * @returns true if successful, false otherwise
 */
export function setStorageJSON<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Failed to set storage JSON: ${key}`, error);
    return false;
  }
}

/**
 * Get theme preference
 * @returns Current theme or default
 */
export function getTheme(): 'dark' | 'light' {
  const stored = getStorageItem(StorageKeys.THEME);
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }
  return DEFAULT_PREFERENCES.theme;
}

/**
 * Set theme preference
 * @param theme Theme to set
 * @returns true if successful
 */
export function setTheme(theme: 'dark' | 'light'): boolean {
  return setStorageItem(StorageKeys.THEME, theme);
}

/**
 * Get last used quality preference
 * @returns Last used quality or default
 */
export function getLastUsedQuality(): string {
  return getStorageItem(StorageKeys.LAST_USED_QUALITY) || DEFAULT_PREFERENCES.lastUsedQuality;
}

/**
 * Set last used quality preference
 * @param quality Quality to set
 * @returns true if successful
 */
export function setLastUsedQuality(quality: string): boolean {
  return setStorageItem(StorageKeys.LAST_USED_QUALITY, quality);
}

/**
 * Get auto upgrade quality preference
 * @returns Auto upgrade quality setting or default
 */
export function getAutoUpgradeQuality(): boolean {
  const stored = getStorageItem(StorageKeys.AUTO_UPGRADE_QUALITY);
  if (stored === null) {
    return DEFAULT_PREFERENCES.autoUpgradeQuality;
  }
  return stored === 'true';
}

/**
 * Set auto upgrade quality preference
 * @param enabled Whether to enable auto upgrade
 * @returns true if successful
 */
export function setAutoUpgradeQuality(enabled: boolean): boolean {
  return setStorageItem(StorageKeys.AUTO_UPGRADE_QUALITY, enabled.toString());
}

/**
 * Get volume preference
 * @returns Volume level (0-1) or default
 */
export function getVolume(): number {
  const stored = getStorageItem(StorageKeys.VOLUME);
  if (stored === null) {
    return DEFAULT_PREFERENCES.volume;
  }
  const volume = parseFloat(stored);
  return isNaN(volume) ? DEFAULT_PREFERENCES.volume : Math.max(0, Math.min(1, volume));
}

/**
 * Set volume preference
 * @param volume Volume level (0-1)
 * @returns true if successful
 */
export function setVolume(volume: number): boolean {
  const clamped = Math.max(0, Math.min(1, volume));
  return setStorageItem(StorageKeys.VOLUME, clamped.toString());
}

/**
 * Get playback speed preference
 * @returns Playback speed or default
 */
export function getPlaybackSpeed(): number {
  const stored = getStorageItem(StorageKeys.PLAYBACK_SPEED);
  if (stored === null) {
    return DEFAULT_PREFERENCES.playbackSpeed;
  }
  const speed = parseFloat(stored);
  return isNaN(speed) ? DEFAULT_PREFERENCES.playbackSpeed : speed;
}

/**
 * Set playback speed preference
 * @param speed Playback speed
 * @returns true if successful
 */
export function setPlaybackSpeed(speed: number): boolean {
  return setStorageItem(StorageKeys.PLAYBACK_SPEED, speed.toString());
}

/**
 * Get all UI preferences
 * @returns Complete UI preferences object
 */
export function getAllPreferences(): UIPreferences {
  return {
    theme: getTheme(),
    lastUsedQuality: getLastUsedQuality(),
    autoUpgradeQuality: getAutoUpgradeQuality(),
    volume: getVolume(),
    playbackSpeed: getPlaybackSpeed(),
  };
}

/**
 * Set all UI preferences
 * @param preferences Preferences to set
 * @returns true if all successful
 */
export function setAllPreferences(preferences: Partial<UIPreferences>): boolean {
  let success = true;
  
  if (preferences.theme !== undefined) {
    success = setTheme(preferences.theme) && success;
  }
  if (preferences.lastUsedQuality !== undefined) {
    success = setLastUsedQuality(preferences.lastUsedQuality) && success;
  }
  if (preferences.autoUpgradeQuality !== undefined) {
    success = setAutoUpgradeQuality(preferences.autoUpgradeQuality) && success;
  }
  if (preferences.volume !== undefined) {
    success = setVolume(preferences.volume) && success;
  }
  if (preferences.playbackSpeed !== undefined) {
    success = setPlaybackSpeed(preferences.playbackSpeed) && success;
  }
  
  return success;
}

/**
 * Clear all UI preferences (reset to defaults)
 * @returns true if successful
 */
export function clearAllPreferences(): boolean {
  let success = true;
  
  success = removeStorageItem(StorageKeys.THEME) && success;
  success = removeStorageItem(StorageKeys.LAST_USED_QUALITY) && success;
  success = removeStorageItem(StorageKeys.AUTO_UPGRADE_QUALITY) && success;
  success = removeStorageItem(StorageKeys.VOLUME) && success;
  success = removeStorageItem(StorageKeys.PLAYBACK_SPEED) && success;
  
  return success;
}

/**
 * Get deferred update timestamp for a specific version
 * @param version Version string
 * @returns Timestamp or null if not deferred
 */
export function getDeferredUpdateTime(version: string): number | null {
  const stored = getStorageItem(StorageKeys.DEFERRED_UPDATE(version));
  if (!stored) {
    return null;
  }
  const timestamp = parseInt(stored, 10);
  return isNaN(timestamp) ? null : timestamp;
}

/**
 * Set deferred update timestamp for a specific version
 * @param version Version string
 * @param timestamp Timestamp to defer until
 * @returns true if successful
 */
export function setDeferredUpdateTime(version: string, timestamp: number): boolean {
  return setStorageItem(StorageKeys.DEFERRED_UPDATE(version), timestamp.toString());
}

/**
 * Clear deferred update for a specific version
 * @param version Version string
 * @returns true if successful
 */
export function clearDeferredUpdate(version: string): boolean {
  return removeStorageItem(StorageKeys.DEFERRED_UPDATE(version));
}

/**
 * Safely get an item from sessionStorage
 * @param key Storage key
 * @returns The stored value or null if not found or error occurs
 */
export function getSessionItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch (error) {
    console.warn(`Failed to get session item: ${key}`, error);
    return null;
  }
}

/**
 * Safely set an item in sessionStorage
 * @param key Storage key
 * @param value Value to store
 * @returns true if successful, false otherwise
 */
export function setSessionItem(key: string, value: string): boolean {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`Failed to set session item: ${key}`, error);
    return false;
  }
}

/**
 * Safely remove an item from sessionStorage
 * @param key Storage key
 * @returns true if successful, false otherwise
 */
export function removeSessionItem(key: string): boolean {
  try {
    sessionStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`Failed to remove session item: ${key}`, error);
    return false;
  }
}

/**
 * Get selected hero claim_id from session storage
 * @returns Claim ID or null if not found
 */
export function getSelectedHero(): string | null {
  return getSessionItem(SessionStorageKeys.SELECTED_HERO);
}

/**
 * Set selected hero claim_id in session storage
 * @param claimId Claim ID to store
 * @returns true if successful
 */
export function setSelectedHero(claimId: string): boolean {
  return setSessionItem(SessionStorageKeys.SELECTED_HERO, claimId);
}

/**
 * Clear selected hero from session storage
 * @returns true if successful
 */
export function clearSelectedHero(): boolean {
  return removeSessionItem(SessionStorageKeys.SELECTED_HERO);
}
