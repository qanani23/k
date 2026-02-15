import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Filter, Grid, List } from 'lucide-react';
import MovieCard from '../components/MovieCard';
import SkeletonCard from '../components/SkeletonCard';
import OfflineEmptyState from '../components/OfflineEmptyState';
import { ContentItem } from '../types';
import { useKidsContent } from '../hooks/useContent';
import { useDownloadManager } from '../hooks/useDownloadManager';
import { useOffline } from '../hooks/useOffline';
import { getFavorites, saveFavorite, removeFavorite } from '../lib/api';
import { CATEGORIES } from '../config/categories';
import { useRenderCount } from '../hooks/useRenderCount';

type ViewMode = 'grid' | 'list';

export default function KidsPage() {
  useRenderCount('KidsPage');
  
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const { isOffline } = useOffline();

  const filterTag = searchParams.get('filter');
  const { content: kidsContent, loading, error, loadMore, hasMore, refetch } = useKidsContent(filterTag || undefined);
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

  // Handle filter change
  const handleFilterChange = (newFilterTag: string | null) => {
    const params = new URLSearchParams();
    if (newFilterTag) {
      params.set('filter', newFilterTag);
    }
    navigate(`/kids?${params.toString()}`);
  };

  // Get current filter info
  const currentFilter = filterTag 
    ? CATEGORIES.kids.filters.find(f => f.tag === filterTag)
    : null;

  // Get breadcrumb
  const getBreadcrumb = () => {
    if (currentFilter) {
      return `Kids / ${currentFilter.label}`;
    }
    return 'Kids';
  };

  if (loading && kidsContent.length === 0) {
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
          <span className="sr-only">Loading kids content...</span>
          <SkeletonCard count={12} size="medium" variant="poster" />
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
        <span>{getBreadcrumb()}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">
            {currentFilter ? `${currentFilter.label} Kids` : 'Kids'}
          </h1>
          <p className="text-text-secondary mt-2">
            {kidsContent.length} video{kidsContent.length !== 1 ? 's' : ''} available
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

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center gap-2 ${
              showFilters ? 'bg-white/10' : ''
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="glass rounded-xl p-6 mb-8">
          <h3 className="text-lg font-medium text-text-primary mb-4">Filter by Category</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleFilterChange(null)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                !filterTag
                  ? 'bg-accent-gradient text-white'
                  : 'bg-white/5 text-text-secondary hover:text-text-primary hover:bg-white/10'
              }`}
            >
              All Kids Content
            </button>
            {CATEGORIES.kids.filters.map((filter) => (
              <button
                key={filter.tag}
                onClick={() => handleFilterChange(filter.tag)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterTag === filter.tag
                    ? 'bg-accent-gradient text-white'
                    : 'bg-white/5 text-text-secondary hover:text-text-primary hover:bg-white/10'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {isOfflineError ? (
        <OfflineEmptyState 
          title="Cannot Load Kids Content"
          message="You are currently offline. Connect to the internet to browse kids content, or view your downloaded content."
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
            aria-label="Retry loading kids content"
          >
            Try Again
          </button>
        </div>
      ) : null}

      {/* Content Grid */}
      {kidsContent.length > 0 ? (
        <>
          <div className={viewMode === 'grid' ? 'content-grid' : 'space-y-4'}>
            {kidsContent.map((content) => (
              <MovieCard
                key={content.claim_id}
                content={content}
                onPlay={handlePlayContent}
                onDownload={handleDownloadContent}
                onFavorite={handleFavoriteContent}
                isFavorite={favorites.includes(content.claim_id)}
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
            No Kids Content Found
          </h3>
          <p className="text-text-secondary mb-6">
            {currentFilter 
              ? `No ${currentFilter.label.toLowerCase()} kids content is currently available.`
              : 'No kids content is currently available.'
            }
          </p>
          {currentFilter && (
            <button
              onClick={() => handleFilterChange(null)}
              className="btn-secondary"
            >
              View All Kids Content
            </button>
          )}
        </div>
      )}
    </div>
  );
}
