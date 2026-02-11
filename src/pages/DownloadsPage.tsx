import { useState } from 'react';
import { Download, Play, Trash2, Pause, WifiOff, HardDrive } from 'lucide-react';
import { useDownloadManager } from '../hooks/useDownloadManager';
import { formatFileSize, formatTimestamp } from '../lib/api';
import { OfflineMetadata, DownloadProgress } from '../types';

export default function DownloadsPage() {
  const {
    downloads: activeDownloads,
    offlineContent,
    deleteDownload,
    getOfflineUrl,
    cancelDownload,
    getTotalDownloads,
    getTotalDownloadSize
  } = useDownloadManager();

  const [selectedTab, setSelectedTab] = useState<'active' | 'completed'>('active');
  const [playingContent, setPlayingContent] = useState<string | null>(null);

  const totalDownloads = getTotalDownloads();
  const totalSize = getTotalDownloadSize();

  // Handle play offline content
  const handlePlayOffline = async (metadata: OfflineMetadata) => {
    try {
      setPlayingContent(metadata.claim_id);
      const url = await getOfflineUrl(metadata.claim_id, metadata.quality);
      
      // Open in a new window/tab for now
      // In a real implementation, this would open in a proper video player
      window.open(url, '_blank');
    } catch (error) {
      console.error('Failed to play offline content:', error);
    } finally {
      setPlayingContent(null);
    }
  };

  // Handle delete download
  const handleDeleteDownload = async (metadata: OfflineMetadata) => {
    if (confirm(`Delete "${metadata.claim_id}" (${metadata.quality})?`)) {
      try {
        await deleteDownload(metadata.claim_id, metadata.quality);
      } catch (error) {
        console.error('Failed to delete download:', error);
      }
    }
  };

  // Handle cancel active download
  const handleCancelDownload = (download: DownloadProgress) => {
    if (confirm(`Cancel download of "${download.claim_id}" (${download.quality})?`)) {
      cancelDownload(download.claim_id, download.quality);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary mb-2">Downloads</h1>
        <p className="text-text-secondary">
          Manage your offline content and active downloads
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Download className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{activeDownloads.length}</p>
              <p className="text-text-secondary">Active Downloads</p>
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
              <WifiOff className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{totalDownloads}</p>
              <p className="text-text-secondary">Offline Content</p>
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <HardDrive className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{formatFileSize(totalSize)}</p>
              <p className="text-text-secondary">Storage Used</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-white/5 rounded-lg p-1">
        <button
          onClick={() => setSelectedTab('active')}
          className={`flex-1 px-4 py-2 rounded text-sm font-medium transition-colors ${
            selectedTab === 'active'
              ? 'bg-white/10 text-text-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
          aria-label="View active downloads"
          aria-pressed={selectedTab === 'active'}
        >
          Active Downloads ({activeDownloads.length})
        </button>
        <button
          onClick={() => setSelectedTab('completed')}
          className={`flex-1 px-4 py-2 rounded text-sm font-medium transition-colors ${
            selectedTab === 'completed'
              ? 'bg-white/10 text-text-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
          aria-label="View offline content"
          aria-pressed={selectedTab === 'completed'}
        >
          Offline Content ({totalDownloads})
        </button>
      </div>

      {/* Active Downloads Tab */}
      {selectedTab === 'active' && (
        <div className="space-y-4">
          {activeDownloads.length > 0 ? (
            activeDownloads.map((download) => (
              <div key={`${download.claim_id}-${download.quality}`} className="glass rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-text-primary">
                      {download.claim_id}
                    </h3>
                    <p className="text-text-secondary">
                      Quality: {download.quality}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCancelDownload(download)}
                    className="btn-ghost text-red-400 hover:text-red-300"
                    aria-label={`Cancel download of ${download.claim_id}`}
                  >
                    <Pause className="w-4 h-4 mr-2" />
                    Cancel
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm text-text-secondary mb-2">
                    <span>{Math.round(download.percent)}% complete</span>
                    <span>
                      {download.bytes_written ? formatFileSize(download.bytes_written) : '0 B'}
                      {download.total_bytes && ` / ${formatFileSize(download.total_bytes)}`}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ width: `${download.percent}%` }}
                    />
                  </div>
                </div>

                {/* Download Speed */}
                {download.speed_bytes_per_sec && (
                  <p className="text-sm text-text-secondary">
                    Speed: {formatFileSize(download.speed_bytes_per_sec)}/s
                  </p>
                )}
              </div>
            ))
          ) : (
            <div className="glass rounded-xl p-12 text-center">
              <Download className="w-16 h-16 text-text-secondary mx-auto mb-4" />
              <h3 className="text-xl font-medium text-text-primary mb-2">
                No Active Downloads
              </h3>
              <p className="text-text-secondary">
                Start downloading content to watch offline
              </p>
            </div>
          )}
        </div>
      )}

      {/* Offline Content Tab */}
      {selectedTab === 'completed' && (
        <div className="space-y-4">
          {offlineContent.length > 0 ? (
            offlineContent.map((metadata) => (
              <div key={`${metadata.claim_id}-${metadata.quality}`} className="glass rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-text-primary mb-1">
                      {metadata.claim_id}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-text-secondary">
                      <span>Quality: {metadata.quality}</span>
                      <span>Size: {formatFileSize(metadata.file_size)}</span>
                      <span>Downloaded: {formatTimestamp(metadata.added_at)}</span>
                      {metadata.encrypted && (
                        <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs">
                          Encrypted
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePlayOffline(metadata)}
                      disabled={playingContent === metadata.claim_id}
                      className="btn-primary flex items-center gap-2"
                      aria-label={`Play ${metadata.claim_id} offline`}
                    >
                      <Play className="w-4 h-4" />
                      {playingContent === metadata.claim_id ? 'Loading...' : 'Play'}
                    </button>
                    <button
                      onClick={() => handleDeleteDownload(metadata)}
                      className="btn-ghost text-red-400 hover:text-red-300"
                      aria-label={`Delete ${metadata.claim_id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="glass rounded-xl p-12 text-center">
              <WifiOff className="w-16 h-16 text-text-secondary mx-auto mb-4" />
              <h3 className="text-xl font-medium text-text-primary mb-2">
                No Offline Content
              </h3>
              <p className="text-text-secondary mb-6">
                Download movies and episodes to watch them offline
              </p>
              <button
                onClick={() => window.history.back()}
                className="btn-secondary"
                aria-label="Browse content"
              >
                Browse Content
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}