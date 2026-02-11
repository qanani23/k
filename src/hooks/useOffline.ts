import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for managing offline/online state
 * Provides offline detection and state management for the application
 */
export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial status
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkOnlineStatus = useCallback(() => {
    return navigator.onLine;
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    wasOffline,
    checkOnlineStatus,
  };
}

/**
 * Hook for managing content with offline awareness
 * Prevents remote API calls when offline and provides offline status
 */
export function useOfflineAwareContent() {
  const { isOnline } = useOffline();
  const [offlineContent, setOfflineContent] = useState<string[]>([]);

  const canFetchRemote = useCallback(() => {
    return isOnline;
  }, [isOnline]);

  const isContentAvailableOffline = useCallback((claimId: string) => {
    return offlineContent.includes(claimId);
  }, [offlineContent]);

  const addOfflineContent = useCallback((claimId: string) => {
    setOfflineContent(prev => {
      if (prev.includes(claimId)) return prev;
      return [...prev, claimId];
    });
  }, []);

  const removeOfflineContent = useCallback((claimId: string) => {
    setOfflineContent(prev => prev.filter(id => id !== claimId));
  }, []);

  return {
    isOnline,
    canFetchRemote,
    isContentAvailableOffline,
    addOfflineContent,
    removeOfflineContent,
    offlineContent,
  };
}

/**
 * Hook for managing offline-first data fetching
 * Attempts to use cached data when offline
 */
export function useOfflineFirst<T>(
  fetchFn: () => Promise<T>,
  cacheFn?: () => T | null,
  options: {
    enabled?: boolean;
    refetchOnReconnect?: boolean;
  } = {}
) {
  const { enabled = true, refetchOnReconnect = true } = options;
  const { isOnline, wasOffline } = useOffline();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      setError(null);

      // If offline, try to use cached data
      if (!isOnline && cacheFn) {
        const cachedData = cacheFn();
        if (cachedData) {
          setData(cachedData);
          setFromCache(true);
          return;
        }
      }

      // If online or no cache available, fetch from remote
      if (isOnline) {
        const result = await fetchFn();
        setData(result);
        setFromCache(false);
      } else {
        throw new Error('No internet connection and no cached data available');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
      
      // Try cache as fallback on error
      if (cacheFn) {
        const cachedData = cacheFn();
        if (cachedData) {
          setData(cachedData);
          setFromCache(true);
          setError(null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [enabled, isOnline, fetchFn, cacheFn]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch when coming back online
  useEffect(() => {
    if (isOnline && wasOffline && refetchOnReconnect) {
      fetchData();
    }
  }, [isOnline, wasOffline, refetchOnReconnect, fetchData]);

  return {
    data,
    loading,
    error,
    fromCache,
    refetch: fetchData,
    isOnline,
  };
}
