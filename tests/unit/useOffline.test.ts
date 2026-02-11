import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOffline, useOfflineAwareContent, useOfflineFirst } from '../../src/hooks/useOffline';

describe('useOffline', () => {
  let onlineGetter: any;
  let offlineEvent: Event;
  let onlineEvent: Event;

  beforeEach(() => {
    // Mock navigator.onLine
    onlineGetter = vi.spyOn(navigator, 'onLine', 'get');
    offlineEvent = new Event('offline');
    onlineEvent = new Event('online');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with online status', () => {
    onlineGetter.mockReturnValue(true);
    const { result } = renderHook(() => useOffline());

    expect(result.current.isOnline).toBe(true);
    expect(result.current.isOffline).toBe(false);
  });

  it('should initialize with offline status', () => {
    onlineGetter.mockReturnValue(false);
    const { result } = renderHook(() => useOffline());

    expect(result.current.isOnline).toBe(false);
    expect(result.current.isOffline).toBe(true);
  });

  it('should update status when going offline', () => {
    onlineGetter.mockReturnValue(true);
    const { result } = renderHook(() => useOffline());

    expect(result.current.isOnline).toBe(true);

    act(() => {
      onlineGetter.mockReturnValue(false);
      window.dispatchEvent(offlineEvent);
    });

    expect(result.current.isOnline).toBe(false);
    expect(result.current.isOffline).toBe(true);
    expect(result.current.wasOffline).toBe(true);
  });

  it('should update status when coming back online', () => {
    onlineGetter.mockReturnValue(false);
    const { result } = renderHook(() => useOffline());

    expect(result.current.isOnline).toBe(false);

    act(() => {
      onlineGetter.mockReturnValue(true);
      window.dispatchEvent(onlineEvent);
    });

    expect(result.current.isOnline).toBe(true);
    expect(result.current.isOffline).toBe(false);
    expect(result.current.wasOffline).toBe(false);
  });

  it('should provide checkOnlineStatus function', () => {
    onlineGetter.mockReturnValue(true);
    const { result } = renderHook(() => useOffline());

    expect(result.current.checkOnlineStatus()).toBe(true);

    onlineGetter.mockReturnValue(false);
    expect(result.current.checkOnlineStatus()).toBe(false);
  });
});

describe('useOfflineAwareContent', () => {
  let onlineGetter: any;

  beforeEach(() => {
    onlineGetter = vi.spyOn(navigator, 'onLine', 'get');
    onlineGetter.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should allow remote fetch when online', () => {
    const { result } = renderHook(() => useOfflineAwareContent());

    expect(result.current.canFetchRemote()).toBe(true);
  });

  it('should prevent remote fetch when offline', () => {
    onlineGetter.mockReturnValue(false);
    const { result } = renderHook(() => useOfflineAwareContent());

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.canFetchRemote()).toBe(false);
  });

  it('should manage offline content list', () => {
    const { result } = renderHook(() => useOfflineAwareContent());

    expect(result.current.offlineContent).toEqual([]);

    act(() => {
      result.current.addOfflineContent('claim-1');
    });

    expect(result.current.offlineContent).toEqual(['claim-1']);
    expect(result.current.isContentAvailableOffline('claim-1')).toBe(true);

    act(() => {
      result.current.addOfflineContent('claim-2');
    });

    expect(result.current.offlineContent).toEqual(['claim-1', 'claim-2']);

    act(() => {
      result.current.removeOfflineContent('claim-1');
    });

    expect(result.current.offlineContent).toEqual(['claim-2']);
    expect(result.current.isContentAvailableOffline('claim-1')).toBe(false);
  });

  it('should not add duplicate offline content', () => {
    const { result } = renderHook(() => useOfflineAwareContent());

    act(() => {
      result.current.addOfflineContent('claim-1');
      result.current.addOfflineContent('claim-1');
    });

    expect(result.current.offlineContent).toEqual(['claim-1']);
  });
});

describe('useOfflineFirst', () => {
  let onlineGetter: any;

  beforeEach(() => {
    onlineGetter = vi.spyOn(navigator, 'onLine', 'get');
    onlineGetter.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch data when online', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
    const { result } = renderHook(() => useOfflineFirst(fetchFn));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchFn).toHaveBeenCalled();
    expect(result.current.data).toEqual({ data: 'test' });
    expect(result.current.fromCache).toBe(false);
  });

  it('should use cache when offline', async () => {
    onlineGetter.mockReturnValue(false);
    const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
    const cacheFn = vi.fn().mockReturnValue({ data: 'cached' });

    const { result } = renderHook(() => useOfflineFirst(fetchFn, cacheFn));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(cacheFn).toHaveBeenCalled();
    expect(result.current.data).toEqual({ data: 'cached' });
    expect(result.current.fromCache).toBe(true);
  });

  it('should handle error and fallback to cache', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('Network error'));
    const cacheFn = vi.fn().mockReturnValue({ data: 'cached' });

    const { result } = renderHook(() => useOfflineFirst(fetchFn, cacheFn));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchFn).toHaveBeenCalled();
    expect(cacheFn).toHaveBeenCalled();
    expect(result.current.data).toEqual({ data: 'cached' });
    expect(result.current.fromCache).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should set error when no cache available', async () => {
    onlineGetter.mockReturnValue(false);
    const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });

    const { result } = renderHook(() => useOfflineFirst(fetchFn));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toContain('No internet connection');
  });

  it('should refetch when coming back online', async () => {
    onlineGetter.mockReturnValue(false);
    const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
    const cacheFn = vi.fn().mockReturnValue({ data: 'cached' });

    const { result } = renderHook(() => useOfflineFirst(fetchFn, cacheFn, {
      refetchOnReconnect: true
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({ data: 'cached' });

    // Go back online
    act(() => {
      onlineGetter.mockReturnValue(true);
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({ data: 'test' });
      expect(result.current.fromCache).toBe(false);
    });
  });

  it('should respect enabled option', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });

    const { result } = renderHook(() => useOfflineFirst(fetchFn, undefined, {
      enabled: false
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });
});
