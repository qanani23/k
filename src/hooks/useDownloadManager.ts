import { useState, useCallback, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { DownloadProgress, DownloadRequest, OfflineMetadata } from '../types';
import { downloadMovieQuality, deleteOffline, streamOffline } from '../lib/api';

export function useDownloadManager() {
  const [downloads, setDownloads] = useState<DownloadProgress[]>([]);
  const [offlineContent, setOfflineContent] = useState<OfflineMetadata[]>([]);

  // Set up event listeners for download events
  useEffect(() => {
    const setupListeners = async () => {
      // Listen for download progress events
      const unlistenProgress = await listen<DownloadProgress>('download-progress', (event) => {
        const progress = event.payload;
        
        setDownloads(prev => {
          const existing = prev.find(d => 
            d.claim_id === progress.claim_id && d.quality === progress.quality
          );
          
          if (existing) {
            return prev.map(d => 
              d.claim_id === progress.claim_id && d.quality === progress.quality 
                ? progress 
                : d
            );
          } else {
            return [...prev, progress];
          }
        });
      });

      // Listen for download completion events
      const unlistenComplete = await listen<OfflineMetadata>('download-complete', (event) => {
        const metadata = event.payload;
        
        // Remove from active downloads
        setDownloads(prev => prev.filter(d => 
          !(d.claim_id === metadata.claim_id && d.quality === metadata.quality)
        ));
        
        // Add to offline content
        setOfflineContent(prev => {
          const existing = prev.find(o => 
            o.claim_id === metadata.claim_id && o.quality === metadata.quality
          );
          
          if (existing) {
            return prev.map(o => 
              o.claim_id === metadata.claim_id && o.quality === metadata.quality 
                ? metadata 
                : o
            );
          } else {
            return [...prev, metadata];
          }
        });
      });

      // Listen for download error events
      const unlistenError = await listen<{
        claimId: string;
        quality: string;
        error: string;
      }>('download-error', (event) => {
        const { claimId, quality } = event.payload;
        
        // Remove from active downloads
        setDownloads(prev => prev.filter(d => 
          !(d.claim_id === claimId && d.quality === quality)
        ));
      });

      return () => {
        unlistenProgress();
        unlistenComplete();
        unlistenError();
      };
    };

    setupListeners();
  }, []);

  const downloadContent = useCallback(async (request: DownloadRequest) => {
    try {
      // Add to active downloads immediately
      const initialProgress: DownloadProgress = {
        claim_id: request.claim_id,
        quality: request.quality,
        percent: 0,
        bytes_written: 0,
        total_bytes: undefined,
        speed_bytes_per_sec: undefined,
      };
      
      setDownloads(prev => {
        const existing = prev.find(d => 
          d.claim_id === request.claim_id && d.quality === request.quality
        );
        
        if (existing) {
          return prev; // Already downloading
        }
        
        return [...prev, initialProgress];
      });

      await downloadMovieQuality(request);
    } catch (error) {
      // Remove from active downloads on error
      setDownloads(prev => prev.filter(d => 
        !(d.claim_id === request.claim_id && d.quality === request.quality)
      ));
      
      throw error;
    }
  }, []);

  const deleteDownload = useCallback(async (claimId: string, quality: string) => {
    try {
      await deleteOffline({ claim_id: claimId, quality });
      
      // Remove from offline content
      setOfflineContent(prev => prev.filter(o => 
        !(o.claim_id === claimId && o.quality === quality)
      ));
    } catch (error) {
      console.error('Failed to delete download:', error);
      throw error;
    }
  }, []);

  const getOfflineUrl = useCallback(async (claimId: string, quality: string): Promise<string> => {
    try {
      const response = await streamOffline({ claim_id: claimId, quality });
      return response.url;
    } catch (error) {
      console.error('Failed to get offline URL:', error);
      throw error;
    }
  }, []);

  const isDownloading = useCallback((claimId: string, quality: string): boolean => {
    return downloads.some(d => d.claim_id === claimId && d.quality === quality);
  }, [downloads]);

  const isOfflineAvailable = useCallback((claimId: string, quality: string): boolean => {
    return offlineContent.some(o => o.claim_id === claimId && o.quality === quality);
  }, [offlineContent]);

  const getDownloadProgress = useCallback((claimId: string, quality: string): DownloadProgress | null => {
    return downloads.find(d => d.claim_id === claimId && d.quality === quality) || null;
  }, [downloads]);

  const getOfflineMetadata = useCallback((claimId: string, quality: string): OfflineMetadata | null => {
    return offlineContent.find(o => o.claim_id === claimId && o.quality === quality) || null;
  }, [offlineContent]);

  const getTotalDownloads = useCallback((): number => {
    return offlineContent.length;
  }, [offlineContent]);

  const getTotalDownloadSize = useCallback((): number => {
    return offlineContent.reduce((total, item) => total + item.file_size, 0);
  }, [offlineContent]);

  const getActiveDownloads = useCallback((): DownloadProgress[] => {
    return downloads;
  }, [downloads]);

  const cancelDownload = useCallback((claimId: string, quality: string) => {
    // Remove from active downloads (the backend download will continue but UI won't show it)
    setDownloads(prev => prev.filter(d => 
      !(d.claim_id === claimId && d.quality === quality)
    ));
  }, []);

  return {
    downloads,
    offlineContent,
    downloadContent,
    deleteDownload,
    getOfflineUrl,
    isDownloading,
    isOfflineAvailable,
    getDownloadProgress,
    getOfflineMetadata,
    getTotalDownloads,
    getTotalDownloadSize,
    getActiveDownloads,
    cancelDownload,
  };
}