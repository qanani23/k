import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDownloadManager } from '../../src/hooks/useDownloadManager';
import * as api from '../../src/lib/api';
import { listen } from '@tauri-apps/api/event';
import { DownloadProgress, OfflineMetadata } from '../../src/types';

// Mock the API module
vi.mock('../../src/lib/api', () => ({
  downloadMovieQuality: vi.fn(),
  deleteOffline: vi.fn(),
  streamOffline: vi.fn(),
}));

// Mock Tauri event system
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

describe('useDownloadManager', () => {
  let mockUnlisten: ReturnType<typeof vi.fn>;
  let progressCallback: ((event: any) => void) | null = null;
  let completeCallback: ((event: any) => void) | null = null;
  let errorCallback: ((event: any) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUnlisten = vi.fn();
    progressCallback = null;
    completeCallback = null;
    errorCallback = null;

    // Mock listen to capture callbacks
    (listen as any).mockImplementation((eventName: string, callback: (event: any) => void) => {
      if (eventName === 'download-progress') {
        progressCallback = callback;
      } else if (eventName === 'download-complete') {
        completeCallback = callback;
      } else if (eventName === 'download-error') {
        errorCallback = callback;
      }
      return Promise.resolve(mockUnlisten);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with empty downloads and offline content', () => {
    const { result } = renderHook(() => useDownloadManager());
    
    expect(result.current.downloads).toEqual([]);
    expect(result.current.offlineContent).toEqual([]);
  });

  it('should set up event listeners on mount', async () => {
    renderHook(() => useDownloadManager());

    await waitFor(() => {
      expect(listen).toHaveBeenCalledWith('download-progress', expect.any(Function));
      expect(listen).toHaveBeenCalledWith('download-complete', expect.any(Function));
      expect(listen).toHaveBeenCalledWith('download-error', expect.any(Function));
    });
  });

  it('should start download and add to active downloads', async () => {
    (api.downloadMovieQuality as any).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDownloadManager());

    const request = {
      claim_id: 'test-claim-1',
      quality: '720p',
      url: 'https://example.com/video.mp4',
    };

    await act(async () => {
      await result.current.downloadContent(request);
    });

    expect(api.downloadMovieQuality).toHaveBeenCalledWith(request);
    expect(result.current.downloads).toHaveLength(1);
    expect(result.current.downloads[0]).toMatchObject({
      claim_id: 'test-claim-1',
      quality: '720p',
      percent: 0,
    });
  });

  it('should not add duplicate downloads', async () => {
    (api.downloadMovieQuality as any).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDownloadManager());

    const request = {
      claim_id: 'test-claim-1',
      quality: '720p',
      url: 'https://example.com/video.mp4',
    };

    await act(async () => {
      await result.current.downloadContent(request);
    });

    // Try to download the same content again
    await act(async () => {
      await result.current.downloadContent(request);
    });

    expect(result.current.downloads).toHaveLength(1);
  });

  it('should update download progress when progress event is received', async () => {
    const { result } = renderHook(() => useDownloadManager());

    await waitFor(() => {
      expect(progressCallback).not.toBeNull();
    });

    const progressEvent: DownloadProgress = {
      claim_id: 'test-claim-1',
      quality: '720p',
      percent: 50,
      bytes_written: 5000000,
      total_bytes: 10000000,
      speed_bytes_per_sec: 1000000,
    };

    act(() => {
      progressCallback!({ payload: progressEvent } as any);
    });

    await waitFor(() => {
      expect(result.current.downloads).toHaveLength(1);
      expect(result.current.downloads[0]).toMatchObject(progressEvent);
    });
  });

  it('should handle download completion event', async () => {
    const { result } = renderHook(() => useDownloadManager());

    await waitFor(() => {
      expect(completeCallback).not.toBeNull();
    });

    // First add a download in progress
    const progressEvent: DownloadProgress = {
      claim_id: 'test-claim-1',
      quality: '720p',
      percent: 50,
      bytes_written: 5000000,
      total_bytes: 10000000,
      speed_bytes_per_sec: 1000000,
    };

    act(() => {
      progressCallback!({ payload: progressEvent } as any);
    });

    await waitFor(() => {
      expect(result.current.downloads).toHaveLength(1);
    });

    // Now complete the download
    const completeEvent: OfflineMetadata = {
      claim_id: 'test-claim-1',
      quality: '720p',
      filename: 'test-video.mp4',
      file_size: 10000000,
      encrypted: false,
      added_at: Date.now(),
    };

    act(() => {
      completeCallback!({ payload: completeEvent } as any);
    });

    await waitFor(() => {
      expect(result.current.downloads).toHaveLength(0);
      expect(result.current.offlineContent).toHaveLength(1);
      expect(result.current.offlineContent[0]).toMatchObject(completeEvent);
    });
  });

  it('should handle download error event', async () => {
    const { result } = renderHook(() => useDownloadManager());

    await waitFor(() => {
      expect(errorCallback).not.toBeNull();
    });

    // First add a download in progress
    const progressEvent: DownloadProgress = {
      claim_id: 'test-claim-1',
      quality: '720p',
      percent: 30,
      bytes_written: 3000000,
      total_bytes: 10000000,
      speed_bytes_per_sec: 1000000,
    };

    act(() => {
      progressCallback!({ payload: progressEvent } as any);
    });

    await waitFor(() => {
      expect(result.current.downloads).toHaveLength(1);
    });

    // Now trigger an error
    const errorEvent = {
      claimId: 'test-claim-1',
      quality: '720p',
      error: 'Network error',
    };

    act(() => {
      errorCallback!({ payload: errorEvent } as any);
    });

    await waitFor(() => {
      expect(result.current.downloads).toHaveLength(0);
    });
  });

  it('should delete offline content', async () => {
    (api.deleteOffline as any).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDownloadManager());

    await waitFor(() => {
      expect(completeCallback).not.toBeNull();
    });

    // Add offline content
    const metadata: OfflineMetadata = {
      claim_id: 'test-claim-1',
      quality: '720p',
      filename: 'test-video.mp4',
      file_size: 10000000,
      encrypted: false,
      added_at: Date.now(),
    };

    act(() => {
      completeCallback!({ payload: metadata } as any);
    });

    await waitFor(() => {
      expect(result.current.offlineContent).toHaveLength(1);
    });

    // Delete the content
    await act(async () => {
      await result.current.deleteDownload('test-claim-1', '720p');
    });

    expect(api.deleteOffline).toHaveBeenCalledWith({
      claim_id: 'test-claim-1',
      quality: '720p',
    });
    expect(result.current.offlineContent).toHaveLength(0);
  });

  it('should get offline URL for streaming', async () => {
    const mockResponse = {
      url: 'http://127.0.0.1:8080/movies/test-claim-1',
      port: 8080,
    };

    (api.streamOffline as any).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useDownloadManager());

    const url = await act(async () => {
      return await result.current.getOfflineUrl('test-claim-1', '720p');
    });

    expect(api.streamOffline).toHaveBeenCalledWith({
      claim_id: 'test-claim-1',
      quality: '720p',
    });
    expect(url).toBe('http://127.0.0.1:8080/movies/test-claim-1');
  });

  it('should check if content is downloading', async () => {
    const { result } = renderHook(() => useDownloadManager());

    await waitFor(() => {
      expect(progressCallback).not.toBeNull();
    });

    expect(result.current.isDownloading('test-claim-1', '720p')).toBe(false);

    // Add a download
    const progressEvent: DownloadProgress = {
      claim_id: 'test-claim-1',
      quality: '720p',
      percent: 50,
      bytes_written: 5000000,
      total_bytes: 10000000,
      speed_bytes_per_sec: 1000000,
    };

    act(() => {
      progressCallback!({ payload: progressEvent } as any);
    });

    await waitFor(() => {
      expect(result.current.isDownloading('test-claim-1', '720p')).toBe(true);
    });
  });

  it('should check if content is available offline', async () => {
    const { result } = renderHook(() => useDownloadManager());

    await waitFor(() => {
      expect(completeCallback).not.toBeNull();
    });

    expect(result.current.isOfflineAvailable('test-claim-1', '720p')).toBe(false);

    // Add offline content
    const metadata: OfflineMetadata = {
      claim_id: 'test-claim-1',
      quality: '720p',
      filename: 'test-video.mp4',
      file_size: 10000000,
      encrypted: false,
      added_at: Date.now(),
    };

    act(() => {
      completeCallback!({ payload: metadata } as any);
    });

    await waitFor(() => {
      expect(result.current.isOfflineAvailable('test-claim-1', '720p')).toBe(true);
    });
  });

  it('should get download progress for specific content', async () => {
    const { result } = renderHook(() => useDownloadManager());

    await waitFor(() => {
      expect(progressCallback).not.toBeNull();
    });

    expect(result.current.getDownloadProgress('test-claim-1', '720p')).toBeNull();

    const progressEvent: DownloadProgress = {
      claim_id: 'test-claim-1',
      quality: '720p',
      percent: 75,
      bytes_written: 7500000,
      total_bytes: 10000000,
      speed_bytes_per_sec: 1000000,
    };

    act(() => {
      progressCallback!({ payload: progressEvent } as any);
    });

    await waitFor(() => {
      const progress = result.current.getDownloadProgress('test-claim-1', '720p');
      expect(progress).toMatchObject(progressEvent);
    });
  });

  it('should get offline metadata for specific content', async () => {
    const { result } = renderHook(() => useDownloadManager());

    await waitFor(() => {
      expect(completeCallback).not.toBeNull();
    });

    expect(result.current.getOfflineMetadata('test-claim-1', '720p')).toBeNull();

    const metadata: OfflineMetadata = {
      claim_id: 'test-claim-1',
      quality: '720p',
      filename: 'test-video.mp4',
      file_size: 10000000,
      encrypted: false,
      added_at: Date.now(),
    };

    act(() => {
      completeCallback!({ payload: metadata } as any);
    });

    await waitFor(() => {
      const offlineMeta = result.current.getOfflineMetadata('test-claim-1', '720p');
      expect(offlineMeta).toMatchObject(metadata);
    });
  });

  it('should get total downloads count', async () => {
    const { result } = renderHook(() => useDownloadManager());

    await waitFor(() => {
      expect(completeCallback).not.toBeNull();
    });

    expect(result.current.getTotalDownloads()).toBe(0);

    // Add multiple offline items
    const metadata1: OfflineMetadata = {
      claim_id: 'test-claim-1',
      quality: '720p',
      filename: 'test-video-1.mp4',
      file_size: 10000000,
      encrypted: false,
      added_at: Date.now(),
    };

    const metadata2: OfflineMetadata = {
      claim_id: 'test-claim-2',
      quality: '1080p',
      filename: 'test-video-2.mp4',
      file_size: 20000000,
      encrypted: false,
      added_at: Date.now(),
    };

    act(() => {
      completeCallback!({ payload: metadata1 } as any);
      completeCallback!({ payload: metadata2 } as any);
    });

    await waitFor(() => {
      expect(result.current.getTotalDownloads()).toBe(2);
    });
  });

  it('should get total download size', async () => {
    const { result } = renderHook(() => useDownloadManager());

    await waitFor(() => {
      expect(completeCallback).not.toBeNull();
    });

    expect(result.current.getTotalDownloadSize()).toBe(0);

    const metadata1: OfflineMetadata = {
      claim_id: 'test-claim-1',
      quality: '720p',
      filename: 'test-video-1.mp4',
      file_size: 10000000,
      encrypted: false,
      added_at: Date.now(),
    };

    const metadata2: OfflineMetadata = {
      claim_id: 'test-claim-2',
      quality: '1080p',
      filename: 'test-video-2.mp4',
      file_size: 20000000,
      encrypted: false,
      added_at: Date.now(),
    };

    act(() => {
      completeCallback!({ payload: metadata1 } as any);
      completeCallback!({ payload: metadata2 } as any);
    });

    await waitFor(() => {
      expect(result.current.getTotalDownloadSize()).toBe(30000000);
    });
  });

  it('should get active downloads list', async () => {
    const { result } = renderHook(() => useDownloadManager());

    await waitFor(() => {
      expect(progressCallback).not.toBeNull();
    });

    expect(result.current.getActiveDownloads()).toEqual([]);

    const progress1: DownloadProgress = {
      claim_id: 'test-claim-1',
      quality: '720p',
      percent: 50,
      bytes_written: 5000000,
      total_bytes: 10000000,
      speed_bytes_per_sec: 1000000,
    };

    const progress2: DownloadProgress = {
      claim_id: 'test-claim-2',
      quality: '1080p',
      percent: 30,
      bytes_written: 6000000,
      total_bytes: 20000000,
      speed_bytes_per_sec: 1500000,
    };

    act(() => {
      progressCallback!({ payload: progress1 } as any);
      progressCallback!({ payload: progress2 } as any);
    });

    await waitFor(() => {
      const activeDownloads = result.current.getActiveDownloads();
      expect(activeDownloads).toHaveLength(2);
      expect(activeDownloads).toContainEqual(expect.objectContaining(progress1));
      expect(activeDownloads).toContainEqual(expect.objectContaining(progress2));
    });
  });

  it('should cancel download', async () => {
    const { result } = renderHook(() => useDownloadManager());

    await waitFor(() => {
      expect(progressCallback).not.toBeNull();
    });

    const progressEvent: DownloadProgress = {
      claim_id: 'test-claim-1',
      quality: '720p',
      percent: 50,
      bytes_written: 5000000,
      total_bytes: 10000000,
      speed_bytes_per_sec: 1000000,
    };

    act(() => {
      progressCallback!({ payload: progressEvent } as any);
    });

    await waitFor(() => {
      expect(result.current.downloads).toHaveLength(1);
    });

    act(() => {
      result.current.cancelDownload('test-claim-1', '720p');
    });

    await waitFor(() => {
      expect(result.current.downloads).toHaveLength(0);
    });
  });

  it('should handle download API errors', async () => {
    const mockError = new Error('Download failed');
    (api.downloadMovieQuality as any).mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useDownloadManager());

    const request = {
      claim_id: 'test-claim-1',
      quality: '720p',
      url: 'https://example.com/video.mp4',
    };

    await expect(
      act(async () => {
        await result.current.downloadContent(request);
      })
    ).rejects.toThrow('Download failed');

    // Download should be removed from active downloads
    expect(result.current.downloads).toHaveLength(0);
  });

  it('should handle delete API errors', async () => {
    const mockError = new Error('Delete failed');
    (api.deleteOffline as any).mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useDownloadManager());

    await waitFor(() => {
      expect(completeCallback).not.toBeNull();
    });

    // Add offline content
    const metadata: OfflineMetadata = {
      claim_id: 'test-claim-1',
      quality: '720p',
      filename: 'test-video.mp4',
      file_size: 10000000,
      encrypted: false,
      added_at: Date.now(),
    };

    act(() => {
      completeCallback!({ payload: metadata } as any);
    });

    await waitFor(() => {
      expect(result.current.offlineContent).toHaveLength(1);
    });

    await expect(
      act(async () => {
        await result.current.deleteDownload('test-claim-1', '720p');
      })
    ).rejects.toThrow('Delete failed');

    // Content should still be in offline list
    expect(result.current.offlineContent).toHaveLength(1);
  });

  it('should handle stream offline API errors', async () => {
    const mockError = new Error('Stream failed');
    (api.streamOffline as any).mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useDownloadManager());

    await expect(
      act(async () => {
        await result.current.getOfflineUrl('test-claim-1', '720p');
      })
    ).rejects.toThrow('Stream failed');
  });

  it('should handle multiple progress updates for same download', async () => {
    const { result } = renderHook(() => useDownloadManager());

    await waitFor(() => {
      expect(progressCallback).not.toBeNull();
    });

    const progress1: DownloadProgress = {
      claim_id: 'test-claim-1',
      quality: '720p',
      percent: 25,
      bytes_written: 2500000,
      total_bytes: 10000000,
      speed_bytes_per_sec: 1000000,
    };

    const progress2: DownloadProgress = {
      claim_id: 'test-claim-1',
      quality: '720p',
      percent: 50,
      bytes_written: 5000000,
      total_bytes: 10000000,
      speed_bytes_per_sec: 1000000,
    };

    const progress3: DownloadProgress = {
      claim_id: 'test-claim-1',
      quality: '720p',
      percent: 75,
      bytes_written: 7500000,
      total_bytes: 10000000,
      speed_bytes_per_sec: 1000000,
    };

    act(() => {
      progressCallback!({ payload: progress1 } as any);
    });

    await waitFor(() => {
      expect(result.current.downloads[0].percent).toBe(25);
    });

    act(() => {
      progressCallback!({ payload: progress2 } as any);
    });

    await waitFor(() => {
      expect(result.current.downloads[0].percent).toBe(50);
    });

    act(() => {
      progressCallback!({ payload: progress3 } as any);
    });

    await waitFor(() => {
      expect(result.current.downloads[0].percent).toBe(75);
      expect(result.current.downloads).toHaveLength(1);
    });
  });
});
