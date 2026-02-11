import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Hero from '../components/Hero';
import RowCarousel from '../components/RowCarousel';
import OfflineEmptyState from '../components/OfflineEmptyState';
import { ContentItem } from '../types';
import { useMovies, useSeriesGrouped, useSitcoms, useKidsContent } from '../hooks/useContent';
import { useDownloadManager } from '../hooks/useDownloadManager';
import { useOffline } from '../hooks/useOffline';
import { getFavorites, saveFavorite, removeFavorite } from '../lib/api';

export default function Home() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<string[]>([]);
  const { isOffline } = useOffline();
  
  // Content hooks for different categories
  const { content: movies, loading: moviesLoading, error: moviesError } = useMovies();
  const { content: series, seriesMap, loading: seriesLoading, error: seriesError } = useSeriesGrouped();
  const { content: sitcoms, loading: sitcomsLoading, error: sitcomsError } = useSitcoms();
  const { content: kidsContent, loading: kidsLoading, error: kidsError } = useKidsContent();
  
  const { downloadContent } = useDownloadManager();

  // Check if all content failed to load due to offline status
  const allContentOffline = isOffline && 
    moviesError?.details === 'offline' && 
    seriesError?.details === 'offline' && 
    sitcomsError?.details === 'offline' && 
    kidsError?.details === 'offline';

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
    // Check if this is a series container (grouped series)
    if (content.tags.includes('__series_container__')) {
      // Extract series key from the series map
      const seriesKey = Array.from(seriesMap.keys()).find(key => {
        const seriesInfo = seriesMap.get(key);
        return seriesInfo?.title === content.title;
      });
      
      if (seriesKey) {
        navigate(`/series/${seriesKey}`);
        return;
      }
    }
    
    // Navigate to appropriate detail page based on content type
    if (content.tags.includes('series')) {
      // For series, we need to extract the series key
      const seriesKey = extractSeriesKey(content);
      if (seriesKey) {
        navigate(`/series/${seriesKey}`);
      } else {
        navigate(`/movie/${content.claim_id}`);
      }
    } else {
      navigate(`/movie/${content.claim_id}`);
    }
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

  // Handle view all navigation
  const handleViewAll = (category: string) => {
    navigate(`/${category}`);
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section - Only show if online or if hero content is cached */}
      {!isOffline && <Hero onPlayClick={handlePlayContent} />}

      {/* Show offline empty state if all content failed to load due to offline */}
      {allContentOffline ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <OfflineEmptyState />
        </div>
      ) : (
        /* Content Rows */
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {/* Movies Row */}
          <RowCarousel
            title="Movies"
            content={movies.slice(0, 20)}
            loading={moviesLoading}
            error={moviesError?.message}
            onPlayContent={handlePlayContent}
            onDownloadContent={handleDownloadContent}
            onFavoriteContent={handleFavoriteContent}
            favorites={favorites}
            showViewAll
            onViewAll={() => handleViewAll('movies')}
          />

          {/* Series Row */}
          <RowCarousel
            title="Series"
            content={series.slice(0, 20)}
            loading={seriesLoading}
            error={seriesError?.message}
            onPlayContent={handlePlayContent}
            onDownloadContent={handleDownloadContent}
            onFavoriteContent={handleFavoriteContent}
            favorites={favorites}
            showViewAll
            onViewAll={() => handleViewAll('series')}
          />

          {/* Sitcoms Row */}
          <RowCarousel
            title="Sitcoms"
            content={sitcoms.slice(0, 20)}
            loading={sitcomsLoading}
            error={sitcomsError?.message}
            onPlayContent={handlePlayContent}
            onDownloadContent={handleDownloadContent}
            onFavoriteContent={handleFavoriteContent}
            favorites={favorites}
            showViewAll
            onViewAll={() => handleViewAll('sitcoms')}
          />

          {/* Kids Content Row */}
          <RowCarousel
            title="Kids"
            content={kidsContent.slice(0, 20)}
            loading={kidsLoading}
            error={kidsError?.message}
            onPlayContent={handlePlayContent}
            onDownloadContent={handleDownloadContent}
            onFavoriteContent={handleFavoriteContent}
            favorites={favorites}
            showViewAll
            onViewAll={() => handleViewAll('kids')}
          />

          {/* Comedy Movies Row */}
          <RowCarousel
            title="Comedy Movies"
            content={movies.filter(movie => movie.tags.includes('comedy_movies')).slice(0, 20)}
            loading={moviesLoading}
            onPlayContent={handlePlayContent}
            onDownloadContent={handleDownloadContent}
            onFavoriteContent={handleFavoriteContent}
            favorites={favorites}
            showViewAll
            onViewAll={() => navigate('/movies?filter=comedy_movies')}
          />

          {/* Action Movies Row */}
          <RowCarousel
            title="Action Movies"
            content={movies.filter(movie => movie.tags.includes('action_movies')).slice(0, 20)}
            loading={moviesLoading}
            onPlayContent={handlePlayContent}
            onDownloadContent={handleDownloadContent}
            onFavoriteContent={handleFavoriteContent}
            favorites={favorites}
            showViewAll
            onViewAll={() => navigate('/movies?filter=action_movies')}
          />

          {/* Recently Added */}
          <RowCarousel
            title="Recently Added"
            content={[...movies, ...series, ...sitcoms, ...kidsContent]
              .sort((a, b) => b.release_time - a.release_time)
              .slice(0, 20)}
            loading={moviesLoading || seriesLoading || sitcomsLoading || kidsLoading}
            onPlayContent={handlePlayContent}
            onDownloadContent={handleDownloadContent}
            onFavoriteContent={handleFavoriteContent}
            favorites={favorites}
          />
        </div>
      )}
    </div>
  );
}

// Helper function to extract series key from content
function extractSeriesKey(content: ContentItem): string | null {
  // Try to extract series key from tags
  const seriesTag = content.tags.find(tag => tag.endsWith('_series'));
  if (seriesTag) {
    return seriesTag.replace('_series', '');
  }

  // Try to extract from title (e.g., "SeriesName S01E01 - Episode Title")
  const titleMatch = content.title.match(/^(.+?)\s+S\d+E\d+/i);
  if (titleMatch) {
    return titleMatch[1].toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  return null;
}