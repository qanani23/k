import { useState } from 'react';
import { Play, Download, Heart, Clock, Wifi, WifiOff } from 'lucide-react';
import { ContentItem } from '../types';
import { useDownloadManager } from '../hooks/useDownloadManager';
import { formatDuration } from '../lib/api';

interface MovieCardProps {
  content: ContentItem;
  onPlay?: (content: ContentItem) => void;
  onDownload?: (content: ContentItem, quality: string) => void;
  onFavorite?: (content: ContentItem) => void;
  isFavorite?: boolean;
  showActions?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export default function MovieCard({
  content,
  onPlay,
  onDownload,
  onFavorite,
  isFavorite = false,
  showActions = true,
  size = 'medium'
}: MovieCardProps) {
  const [imageError, setImageError] = useState(false);
  const [showActionsState, setShowActionsState] = useState(false);
  const { isDownloading, isOfflineAvailable, getDownloadProgress } = useDownloadManager();

  const availableQualities = Object.keys(content.video_urls).sort((a, b) => {
    const qualityOrder = { '360p': 1, '480p': 2, '720p': 3, '1080p': 4 };
    return (qualityOrder[b as keyof typeof qualityOrder] || 0) - 
           (qualityOrder[a as keyof typeof qualityOrder] || 0);
  });

  const bestQuality = availableQualities[0] || '720p';
  const isCurrentlyDownloading = isDownloading(content.claim_id, bestQuality);
  const isAvailableOffline = isOfflineAvailable(content.claim_id, bestQuality);
  const downloadProgress = getDownloadProgress(content.claim_id, bestQuality);

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPlay) {
      onPlay(content);
    }
  };

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDownload && !isCurrentlyDownloading) {
      onDownload(content, bestQuality);
    }
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onFavorite) {
      onFavorite(content);
    }
  };

  const handleCardClick = () => {
    if (onPlay) {
      onPlay(content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
  };

  const sizeClasses = {
    small: 'w-32',
    medium: 'w-40',
    large: 'w-48'
  };

  const textSizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base'
  };

  return (
    <div 
      className={`movie-card ${sizeClasses[size]} flex-shrink-0`}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setShowActionsState(true)}
      onMouseLeave={() => setShowActionsState(false)}
      tabIndex={0}
      role="button"
      aria-label={`${content.title}${content.description ? ` - ${content.description.substring(0, 100)}` : ''}`}
    >
      {/* Poster Image */}
      <div className="relative">
        {!imageError && content.thumbnail_url ? (
          <img
            src={content.thumbnail_url}
            alt={content.title}
            className="movie-poster"
            loading="lazy"
            decoding="async"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="movie-poster bg-gradient-to-br from-accent-cyan/20 to-accent-purple/20 flex items-center justify-center">
            <div className="text-center p-4">
              <Play className="w-8 h-8 mx-auto mb-2 text-text-secondary" />
              <p className="text-xs text-text-secondary">No Image</p>
            </div>
          </div>
        )}

        {/* Quality Badge */}
        {availableQualities.includes('1080p') && (
          <div className="quality-badge">HD</div>
        )}

        {/* Offline Status */}
        {isAvailableOffline && (
          <div className="absolute top-2 left-2 bg-green-500/80 text-white text-xs font-bold px-2 py-1 rounded backdrop-blur-sm flex items-center gap-1">
            <WifiOff className="w-3 h-3" />
            Offline
          </div>
        )}

        {/* Download Progress */}
        {isCurrentlyDownloading && downloadProgress && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-2">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${downloadProgress.percent}%` }}
              />
            </div>
            <p className="text-xs text-white mt-1">
              Downloading... {Math.round(downloadProgress.percent)}%
            </p>
          </div>
        )}

        {/* Hover Actions */}
        {showActions && (showActionsState || isCurrentlyDownloading) && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="flex items-center gap-2">
              {/* Play Button */}
              <button
                onClick={handlePlayClick}
                className="bg-white/20 hover:bg-white/30 p-3 rounded-full transition-colors"
                aria-label={`Play ${content.title}`}
              >
                <Play className="w-6 h-6 text-white" />
              </button>

              {/* Download Button */}
              {!isAvailableOffline && (
                <button
                  onClick={handleDownloadClick}
                  disabled={isCurrentlyDownloading}
                  className={`bg-white/20 hover:bg-white/30 p-3 rounded-full transition-colors ${
                    isCurrentlyDownloading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  aria-label={`Download ${content.title}`}
                >
                  <Download className="w-5 h-5 text-white" />
                </button>
              )}

              {/* Favorite Button */}
              <button
                onClick={handleFavoriteClick}
                className={`bg-white/20 hover:bg-white/30 p-3 rounded-full transition-colors ${
                  isFavorite ? 'bg-red-500/50' : ''
                }`}
                aria-label={isFavorite ? `Remove ${content.title} from favorites` : `Add ${content.title} to favorites`}
              >
                <Heart className={`w-5 h-5 ${isFavorite ? 'text-red-400 fill-current' : 'text-white'}`} />
              </button>
            </div>
          </div>
        )}

        {/* Compatibility Warning */}
        {!content.compatibility.compatible && (
          <div className="absolute bottom-2 left-2 right-2 bg-yellow-500/80 text-black text-xs font-bold px-2 py-1 rounded backdrop-blur-sm">
            ⚠️ May not play on this platform
          </div>
        )}
      </div>

      {/* Content Info */}
      <div className="mt-3 space-y-1">
        <h3 className={`font-medium text-text-primary line-clamp-2 ${textSizeClasses[size]}`}>
          {content.title}
        </h3>
        
        <div className={`flex items-center gap-2 text-text-secondary ${textSizeClasses[size]}`}>
          {/* Duration */}
          {content.duration && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{formatDuration(content.duration)}</span>
            </div>
          )}

          {/* Online/Offline Status */}
          <div className="flex items-center gap-1">
            {isAvailableOffline ? (
              <>
                <WifiOff className="w-3 h-3 text-green-400" />
                <span className="text-green-400">Offline</span>
              </>
            ) : (
              <>
                <Wifi className="w-3 h-3" />
                <span>Online</span>
              </>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {content.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className={`bg-white/10 text-text-secondary px-2 py-0.5 rounded text-xs`}
            >
              {tag.replace('_', ' ')}
            </span>
          ))}
          {content.tags.length > 2 && (
            <span className={`text-text-secondary text-xs`}>
              +{content.tags.length - 2} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
}