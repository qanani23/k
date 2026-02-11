import { useState, useCallback, useEffect } from 'react';
import { UpdateState, VersionManifest } from '../types';
import { compareVersions } from '../lib/semver';
import { openExternal } from '../lib/api';

const UPDATE_MANIFEST_URL = import.meta.env.VITE_UPDATE_MANIFEST_URL;
const APP_VERSION = import.meta.env.APP_VERSION || import.meta.env.VITE_APP_VERSION || '1.0.0';

export function useUpdateChecker() {
  const [updateState, setUpdateState] = useState<UpdateState>({
    status: 'checking',
    current_version: APP_VERSION,
  });

  const checkForUpdates = useCallback(async () => {
    if (!UPDATE_MANIFEST_URL) {
      console.warn('Update manifest URL not configured');
      setUpdateState(prev => ({ ...prev, status: 'current' }));
      return;
    }

    try {
      setUpdateState(prev => ({ ...prev, status: 'checking' }));

      const response = await fetch(UPDATE_MANIFEST_URL, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const manifest: VersionManifest = await response.json();
      const now = Date.now();

      // Compare versions
      const currentVersion = APP_VERSION;
      const latestVersion = manifest.latestVersion;
      const minSupportedVersion = manifest.minSupportedVersion;

      // Check for emergency disable first (highest priority)
      if (manifest.emergencyDisable === true) {
        setUpdateState({
          status: 'emergency',
          current_version: currentVersion,
          latest_version: latestVersion,
          min_supported_version: minSupportedVersion,
          release_notes: manifest.releaseNotes || 'Service temporarily unavailable for maintenance.',
          download_url: manifest.downloadUrl,
          last_checked: now,
        });
        return;
      }

      // Check if current version is below minimum supported
      if (compareVersions(currentVersion, minSupportedVersion) === -1) {
        setUpdateState({
          status: 'forced',
          current_version: currentVersion,
          latest_version: latestVersion,
          min_supported_version: minSupportedVersion,
          release_notes: manifest.releaseNotes,
          download_url: manifest.downloadUrl,
          last_checked: now,
        });
        return;
      }

      // Check if optional update is available
      if (compareVersions(currentVersion, latestVersion) === -1) {
        // Check if user has deferred this update
        const deferredUntil = getDeferredUpdateTime(latestVersion);
        if (deferredUntil && now < deferredUntil) {
          setUpdateState({
            status: 'current',
            current_version: currentVersion,
            latest_version: latestVersion,
            min_supported_version: minSupportedVersion,
            release_notes: manifest.releaseNotes,
            download_url: manifest.downloadUrl,
            last_checked: now,
            deferred_until: deferredUntil,
          });
          return;
        }

        setUpdateState({
          status: 'optional',
          current_version: currentVersion,
          latest_version: latestVersion,
          min_supported_version: minSupportedVersion,
          release_notes: manifest.releaseNotes,
          download_url: manifest.downloadUrl,
          last_checked: now,
        });
        return;
      }

      // Current version is up to date
      setUpdateState({
        status: 'current',
        current_version: currentVersion,
        latest_version: latestVersion,
        min_supported_version: minSupportedVersion,
        last_checked: now,
      });

    } catch (error) {
      console.error('Failed to check for updates:', error);
      
      // If offline or manifest fetch fails, allow app to continue
      setUpdateState(prev => ({
        ...prev,
        status: 'error',
        last_checked: Date.now(),
      }));
    }
  }, []);

  const openUpdate = useCallback(async () => {
    if (updateState.download_url) {
      try {
        await openExternal(updateState.download_url);
      } catch (error) {
        console.error('Failed to open update URL:', error);
      }
    }
  }, [updateState.download_url]);

  const deferUpdate = useCallback((hours: number = 24) => {
    if (updateState.latest_version) {
      const deferUntil = Date.now() + (hours * 60 * 60 * 1000);
      setDeferredUpdateTime(updateState.latest_version, deferUntil);
      
      setUpdateState(prev => ({
        ...prev,
        status: 'current',
        deferred_until: deferUntil,
      }));
    }
  }, [updateState.latest_version]);

  const dismissUpdate = useCallback(() => {
    setUpdateState(prev => ({
      ...prev,
      status: 'current',
    }));
  }, []);

  // Check for updates on mount
  useEffect(() => {
    checkForUpdates();
  }, [checkForUpdates]);

  return {
    updateState,
    checkForUpdates,
    openUpdate,
    deferUpdate,
    dismissUpdate,
  };
}

// Helper functions for managing deferred updates
function getDeferredUpdateTime(version: string): number | null {
  try {
    const stored = localStorage.getItem(`kiyya-deferred-update-${version}`);
    return stored ? parseInt(stored, 10) : null;
  } catch {
    return null;
  }
}

function setDeferredUpdateTime(version: string, timestamp: number): void {
  try {
    localStorage.setItem(`kiyya-deferred-update-${version}`, timestamp.toString());
  } catch {
    // Ignore localStorage errors
  }
}