import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid, List } from 'lucide-react';
import MovieCard from '../components/MovieCard';
import SkeletonCard from '../components/SkeletonCard';
import OfflineEmptyState from '../components/OfflineEmptyState';
import { ContentItem } from '../types';
import { useSitcoms } from '../hooks/useContent';
import { useDownloadManager } from '../hooks/useDownloadManager';
import { useOffline } from '../hooks/useOffline';
import { getFavorites, saveFavorite, removeFavorite } from '../lib/api';

type ViewMode = 'grid' | 'list';

export default function SitcomsPage() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const { isOffline } = useOffline();

  const { content: sitcoms, loading, error, loadMore, hasMore, refetch } = useSitcoms();
  const { downloadContent } = useDownloadManager();

  // Check if error is due to offline status
  const isOfflineError = isOffline && error?.details === 'offline';

  // Load favorites on mount
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const favs = await getFavorites();
        setFavorites(favs.map(f => f.claim_id));
      } catch (error) {
        console.error('Failed to load favorites:', error);
      }
    };
    loadFavorites();
  }, []);

  // Handle content playback
  const handlePlayContent = (content: ContentItem) => {
    navigate(`/movie/${content.claim_id}`);
  };

  // Handle content download
  const handleDownloadContent = async (content: ContentItem, quality: string) => {
    try {
      const videoUrl = content.video_urls[quality]?.url;
      if (!videoUrl) {
        throw new Error(`Quality ${quality} not available`);
      }

      await downloadContent({
        claim_id: content.claim_id,
        quality,
        url: videoUrl,
      });
    } catch (error) {
      console.error('Failed to start download:', error);
    }
  };

  // Handle favorite toggle
  const handleFavoriteContent = async (content: ContentItem) => {
    try {
      const isFavorite = favorites.includes(content.claim_id);
      
      if (isFavorite) {
        await removeFavorite(content.claim_id);
        setFavorites(prev => prev.filter(id => id !== content.claim_id));
      } else {
        await saveFavorite({
          claim_id: content.claim_id,
          title: content.title,
          thumbnail_url: content.thumbnail_url,
        });
        setFavorites(prev => [...prev, content.claim_id]);
      }
    } catch (error) {
      console.error('Failed to update favorite:', error);
    }
  };

  if (loading && sitcoms.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Skeleton */}
        <SkeletonCard variant="header" />

        {/* Content Grid Skeleton */}
        <div 
          className="content-grid"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <span className="sr-only">Loading sitcoms...</span>
          <SkeletonCard count={12} size="medium" variant="poster" />
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <span>Home</span>
        <span className="breadcrumb-separator">/</span>
        <span>Sitcoms</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Sitcoms</h1>
          <p className="text-text-secondary mt-2">
            {sitcoms.length} sitcom{sitcoms.length !== 1 ? 's' : ''} available
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-white/10 text-text-primary' 
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              aria-label="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'list' 
                  ? 'bg-white/10 text-text-primary' 
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Error State */}
      {isOfflineError ? (
        <OfflineEmptyState 
          title="Cannot Load Sitcoms"
          message="You are currently offline. Connect to the internet to browse sitcoms, or view your downloaded content."
        />
      ) : error ? (
        <div 
          className="glass rounded-xl p-6 text-center mb-8"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-text-secondary mb-4">{error.message}</p>
          <button 
            onClick={refetch}
            className="btn-secondary"
            aria-label="Retry loading sitcoms"
          >
            Try Again
          </button>
        </div>
      ) : null}

      {/* Content Grid */}
      {sitcoms.length > 0 ? (
        <>
          <div className={viewMode === 'grid' ? 'content-grid' : 'space-y-4'}>
            {sitcoms.map((sitcom) => (
              <MovieCard
                key={sitcom.claim_id}
                content={sitcom}
                onPlay={handlePlayContent}
                onDownload={handleDownloadContent}
                onFavorite={handleFavoriteContent}
                isFavorite={favorites.includes(sitcom.claim_id)}
                size={viewMode === 'grid' ? 'medium' : 'large'}
              />
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="text-center mt-8">
              <button
                onClick={loadMore}
                disabled={loading}
                className="btn-secondary"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      ) : !loading && (
        <div 
          className="glass rounded-xl p-12 text-center"
          role="status"
          aria-live="polite"
        >
          <h3 className="text-xl font-medium text-text-primary mb-2">
            No Sitcoms Found
          </h3>
          <p className="text-text-secondary mb-6">
            No sitcoms are currently available.
          </p>
        </div>
      )}
    </div>
  );
}
