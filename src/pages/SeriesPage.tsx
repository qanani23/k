import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Play, Download, Heart, Grid, List } from 'lucide-react';
import { ContentItem, Episode } from '../types';
import { useSeriesGrouped } from '../hooks/useContent';
import { useDownloadManager } from '../hooks/useDownloadManager';
import { useOffline } from '../hooks/useOffline';
import { saveFavorite, removeFavorite, getFavorites, resolveClaim } from '../lib/api';
import SkeletonCard from '../components/SkeletonCard';
import OfflineEmptyState from '../components/OfflineEmptyState';
import PlayerModal from '../components/PlayerModal';
import EpisodeSelector from '../components/EpisodeSelector';
import { useRenderCount } from '../hooks/useRenderCount';

type ViewMode = 'grid' | 'list';

const SeriesPage = () => {
  useRenderCount('SeriesPage');
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterTag = searchParams.get('filter');
  
  const [favorites, setFavorites] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isEpisodeSelectorOpen, setIsEpisodeSelectorOpen] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<ContentItem | null>(null);
  const { isOffline } = useOffline();
  
  const { content: series, seriesMap, contentMap, loading, error, loadMore, hasMore, refetch } = useSeriesGrouped(filterTag || undefined);
  const { downloadContent, isDownloading, isOfflineAvailable } = useDownloadManager();

  // Load favorites on mount
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const favs = await getFavorites();
        setFavorites(favs.map(f => f.claim_id));
      } catch (err) {
        console.error('Failed to load favorites:', err);
      }
    };
    loadFavorites();
  }, []);

  const handlePlay = async (seriesKey: string) => {
    console.log("📺 [DEBUG] SeriesPage handlePlay called", seriesKey);
    // Open episode selector instead of playing first episode directly
    setSelectedSeries(seriesKey);
    setIsEpisodeSelectorOpen(true);
  };

  const handleSelectEpisode = async (episode: Episode) => {
    console.log("🎬 [DEBUG] Episode selected", episode.title, episode.claim_id);
    setIsEpisodeSelectorOpen(false);
    
    // Look up the episode in our content map instead of resolving
    const episodeContent = contentMap.get(episode.claim_id);
    
    if (episodeContent) {
      console.log("✅ [DEBUG] Found episode in content map", episodeContent.title);
      setSelectedEpisode(episodeContent);
      setIsPlayerOpen(true);
    } else {
      console.error('❌ [DEBUG] Episode not found in content map:', episode.claim_id);
      // Fallback: try to resolve if not in map
      try {
        console.log("🔄 [DEBUG] Attempting to resolve episode...");
        const resolvedContent = await resolveClaim(episode.claim_id);
        setSelectedEpisode(resolvedContent);
        setIsPlayerOpen(true);
      } catch (err) {
        console.error('Failed to load episode:', err);
      }
    }
  };

  const handleClosePlayer = () => {
    setIsPlayerOpen(false);
    setSelectedEpisode(null);
  };

  const handleCloseEpisodeSelector = () => {
    setIsEpisodeSelectorOpen(false);
    setSelectedSeries(null);
  };

  const handleDownload = async (content: ContentItem) => {
    try {
      const qualities = Object.keys(content.video_urls);
      const preferredQuality = qualities.includes('720p') ? '720p' : qualities[0];
      
      if (!preferredQuality) {
        console.error('No video URLs available');
        return;
      }

      const videoUrl = content.video_urls[preferredQuality];
      
      await downloadContent({
        claim_id: content.claim_id,
        quality: preferredQuality,
        url: videoUrl.url
      });
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleToggleFavorite = async (content: ContentItem) => {
    try {
      const isFavorite = favorites.includes(content.claim_id);
      
      if (isFavorite) {
        await removeFavorite(content.claim_id);
        setFavorites(prev => prev.filter(id => id !== content.claim_id));
      } else {
        await saveFavorite({
          claim_id: content.claim_id,
          title: content.title,
          thumbnail_url: content.thumbnail_url
        });
        setFavorites(prev => [...prev, content.claim_id]);
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  // Offline state
  if (isOffline && series.length === 0) {
    return <OfflineEmptyState />;
  }

  // Get series list from seriesMap
  const seriesList = Array.from(seriesMap.entries()).map(([key, info]) => ({
    key,
    ...info
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <span>Home</span>
        <span className="breadcrumb-separator">/</span>
        <span>Series</span>
        {filterTag && (
          <>
            <span className="breadcrumb-separator">/</span>
            <span className="capitalize">{filterTag.replace('_series', '').replace('_', ' ')}</span>
          </>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">
            {filterTag 
              ? `${filterTag.replace('_series', '').replace('_', ' ')} Series`.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
              : 'Series'}
          </h1>
          <p className="text-text-secondary mt-2">
            {seriesList.length} series available
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center space-x-2 bg-bg-secondary rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded transition-colors ${
              viewMode === 'grid' 
                ? 'bg-accent-cyan text-white' 
                : 'text-text-secondary hover:text-text-primary'
            }`}
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
          >
            <Grid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded transition-colors ${
              viewMode === 'list' 
                ? 'bg-accent-cyan text-white' 
                : 'text-text-secondary hover:text-text-primary'
            }`}
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div 
          className="text-center py-12"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-red-400 mb-4">{error.message || 'Failed to load series'}</p>
          <button
            onClick={refetch}
            className="px-6 py-2 bg-accent-cyan hover:bg-accent-cyan/80 text-white rounded-lg transition-colors"
            aria-label="Retry loading series"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && series.length === 0 && (
        <div 
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <span className="sr-only">Loading series...</span>
          <div className={viewMode === 'grid' ? 'content-grid' : 'space-y-4'}>
            <SkeletonCard count={6} size="large" />
          </div>
        </div>
      )}

      {/* Content Grid/List */}
      {!loading && seriesList.length === 0 ? (
        <div 
          className="text-center py-12"
          role="status"
          aria-live="polite"
        >
          <p className="text-text-secondary">No series found</p>
        </div>
      ) : (
        <>
          <div className={viewMode === 'grid' ? 'content-grid' : 'space-y-4'}>
            {seriesList.map(({ key, title, totalEpisodes, seasons }) => {
              // Get the first episode for thumbnail
              const firstEpisode = seasons[0]?.episodes[0];
              const isFavorite = firstEpisode && favorites.includes(firstEpisode.claim_id);
              const isDownloaded = firstEpisode && isOfflineAvailable(firstEpisode.claim_id, '720p');
              const downloading = firstEpisode && isDownloading(firstEpisode.claim_id, '720p');

              return (
                <div
                  key={key}
                  className="content-card group"
                  role="article"
                  aria-label={`${title} - ${seasons.length} season${seasons.length !== 1 ? 's' : ''}, ${totalEpisodes} episode${totalEpisodes !== 1 ? 's' : ''}`}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-bg-secondary">
                    {firstEpisode?.thumbnail_url ? (
                      <img
                        src={firstEpisode.thumbnail_url}
                        alt={title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-secondary">
                        No thumbnail
                      </div>
                    )}

                    {/* Overlay with actions */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                        <button
                          onClick={() => handlePlay(key)}
                          className="flex items-center space-x-2 px-4 py-2 bg-accent-cyan hover:bg-accent-cyan/80 rounded-lg transition-colors"
                          aria-label={`Play ${title}`}
                        >
                          <Play className="w-4 h-4" aria-hidden="true" />
                          <span className="text-sm font-medium">Play</span>
                        </button>

                        <div className="flex items-center space-x-2">
                          {firstEpisode && (
                            <>
                              <button
                                onClick={() => handleDownload(firstEpisode)}
                                disabled={downloading || isDownloaded}
                                className={`p-2 rounded-lg transition-colors ${
                                  isDownloaded
                                    ? 'bg-green-600 text-white'
                                    : downloading
                                    ? 'bg-gray-600 text-white cursor-not-allowed'
                                    : 'bg-white/20 hover:bg-white/30 text-white'
                                }`}
                                aria-label={`Download ${title}`}
                                title={isDownloaded ? 'Downloaded' : downloading ? 'Downloading...' : 'Download'}
                              >
                                <Download className="w-4 h-4" aria-hidden="true" />
                              </button>

                              <button
                                onClick={() => handleToggleFavorite(firstEpisode)}
                                className={`p-2 rounded-lg transition-colors ${
                                  isFavorite
                                    ? 'bg-red-600 text-white'
                                    : 'bg-white/20 hover:bg-white/30 text-white'
                                }`}
                                aria-label={isFavorite ? `Remove ${title} from favorites` : `Add ${title} to favorites`}
                                aria-pressed={isFavorite}
                              >
                                <Heart 
                                  className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`}
                                  aria-hidden="true"
                                />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Downloaded badge */}
                    {isDownloaded && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-green-600 text-white text-xs rounded">
                        Downloaded
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="mt-3">
                    <h3 className="font-semibold text-text-primary truncate">
                      {title}
                    </h3>
                    <p className="text-sm text-text-secondary mt-1">
                      {seasons.length} season{seasons.length !== 1 ? 's' : ''} • {totalEpisodes} episode{totalEpisodes !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="mt-8 text-center">
              <button
                onClick={loadMore}
                disabled={loading}
                className="px-6 py-3 bg-accent-cyan hover:bg-accent-cyan/80 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Player Modal */}
      {selectedEpisode && (
        <PlayerModal
          content={selectedEpisode}
          isOpen={isPlayerOpen}
          onClose={handleClosePlayer}
        />
      )}

      {/* Episode Selector */}
      {selectedSeries && seriesMap.get(selectedSeries) && (
        <EpisodeSelector
          seriesInfo={seriesMap.get(selectedSeries)!}
          isOpen={isEpisodeSelectorOpen}
          onClose={handleCloseEpisodeSelector}
          onSelectEpisode={handleSelectEpisode}
        />
      )}
    </div>
  );
};

export default SeriesPage;