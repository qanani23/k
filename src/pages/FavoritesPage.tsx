import { useState, useEffect } from 'react';
import { Heart, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MovieCard from '../components/MovieCard';
import { FavoriteItem, ContentItem } from '../types';
import { getFavorites, removeFavorite, resolveClaim } from '../lib/api';

export default function FavoritesPage() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [favoriteContent, setFavoriteContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());

  // Load favorites from SQLite
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get favorites list from SQLite (single source of truth)
        const favs = await getFavorites();
        setFavorites(favs);

        if (favs.length > 0) {
          // Resolve full content details for each favorite
          const contentPromises = favs.map(async (fav) => {
            try {
              // Resolve claim to get full content metadata
              const content = await resolveClaim(fav.claim_id);
              return content;
            } catch (err) {
              console.error(`Failed to resolve favorite ${fav.claim_id}:`, err);
              // Return minimal content item if resolution fails
              return {
                claim_id: fav.claim_id,
                title: fav.title,
                description: undefined,
                tags: [],
                thumbnail_url: fav.thumbnail_url,
                duration: undefined,
                release_time: fav.inserted_at,
                video_urls: {},
                compatibility: {
                  compatible: true,
                  fallback_available: false,
                },
              } as ContentItem;
            }
          });

          const resolvedContent = await Promise.all(contentPromises);
          setFavoriteContent(resolvedContent);
        } else {
          setFavoriteContent([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load favorites');
        setFavorites([]);
        setFavoriteContent([]);
      } finally {
        setLoading(false);
      }
    };

    loadFavorites();
  }, []);

  // Handle remove from favorites
  const handleRemoveFavorite = async (claimId: string) => {
    try {
      // Remove from SQLite
      await removeFavorite(claimId);
      setFavorites(prev => prev.filter(fav => fav.claim_id !== claimId));
      setFavoriteContent(prev => prev.filter(content => content.claim_id !== claimId));
    } catch (error) {
      console.error('Failed to remove favorite:', error);
    }
  };

  // Handle play content
  const handlePlayContent = async (content: ContentItem) => {
    // If content doesn't have video URLs, resolve it first
    if (Object.keys(content.video_urls).length === 0 && !resolvingIds.has(content.claim_id)) {
      setResolvingIds(prev => new Set(prev).add(content.claim_id));
      try {
        const resolvedContent = await resolveClaim(content.claim_id);
        // Update the content in state
        setFavoriteContent(prev => 
          prev.map(item => item.claim_id === content.claim_id ? resolvedContent : item)
        );
        // Navigate to movie detail with resolved content
        navigate(`/movie/${content.claim_id}`);
      } catch (err) {
        console.error('Failed to resolve content:', err);
        // Still navigate, let the detail page handle resolution
        navigate(`/movie/${content.claim_id}`);
      } finally {
        setResolvingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(content.claim_id);
          return newSet;
        });
      }
    } else {
      // Navigate to movie detail page
      navigate(`/movie/${content.claim_id}`);
    }
  };

  // Handle download content
  const handleDownloadContent = async (content: ContentItem, _quality: string) => {
    try {
      // Navigate to detail page for download functionality
      navigate(`/movie/${content.claim_id}`);
    } catch (error) {
      console.error('Failed to navigate to download:', error);
    }
  };

  // Clear all favorites
  const handleClearAllFavorites = async () => {
    if (confirm('Remove all favorites? This action cannot be undone.')) {
      try {
        // Remove all favorites from SQLite
        await Promise.all(favorites.map(fav => removeFavorite(fav.claim_id)));
        setFavorites([]);
        setFavoriteContent([]);
      } catch (error) {
        console.error('Failed to clear favorites:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="loading-skeleton h-8 w-48 rounded mb-2"></div>
          <div className="loading-skeleton h-4 w-64 rounded"></div>
        </div>

        {/* Content Grid Skeleton */}
        <div className="content-grid">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="space-y-3">
              <div className="loading-skeleton aspect-poster rounded-xl"></div>
              <div className="loading-skeleton h-4 w-full rounded"></div>
              <div className="loading-skeleton h-3 w-3/4 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">Favorites</h1>
          <p className="text-text-secondary">
            {favorites.length} favorite{favorites.length !== 1 ? 's' : ''}
          </p>
        </div>

        {favorites.length > 0 && (
          <button
            onClick={handleClearAllFavorites}
            className="btn-ghost text-red-400 hover:text-red-300 flex items-center gap-2"
            aria-label="Clear all favorites"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="glass rounded-xl p-6 text-center mb-8">
          <p className="text-text-secondary mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="btn-secondary"
            aria-label="Retry loading favorites"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Favorites Grid */}
      {favoriteContent.length > 0 ? (
        <div className="content-grid">
          {favoriteContent.map((content) => (
            <div key={content.claim_id} className="relative group">
              <MovieCard
                content={content}
                onPlay={handlePlayContent}
                onDownload={handleDownloadContent}
                onFavorite={() => handleRemoveFavorite(content.claim_id)}
                isFavorite={true}
                size="medium"
              />
            </div>
          ))}
        </div>
      ) : !loading && (
        <div className="glass rounded-xl p-12 text-center">
          <Heart className="w-16 h-16 text-text-secondary mx-auto mb-4" />
          <h3 className="text-xl font-medium text-text-primary mb-2">
            No Favorites Yet
          </h3>
          <p className="text-text-secondary mb-6">
            Add movies and episodes to your favorites to find them easily later.
          </p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
            aria-label="Browse content"
          >
            Browse Content
          </button>
        </div>
      )}

      {/* Favorites Tips */}
      {favoriteContent.length > 0 && (
        <div className="mt-12 glass rounded-xl p-6">
          <h3 className="text-lg font-medium text-text-primary mb-3">
            Tips for Managing Favorites
          </h3>
          <ul className="text-text-secondary space-y-2 text-sm">
            <li>• Click the heart icon on any content to add it to favorites</li>
            <li>• Your favorites are stored locally in SQLite database</li>
            <li>• Use favorites to quickly find content you want to watch later</li>
            <li>• Remove items by clicking the heart icon again</li>
          </ul>
        </div>
      )}
    </div>
  );
}