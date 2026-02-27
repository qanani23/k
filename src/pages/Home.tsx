import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Hero from '../components/Hero';
import RowCarousel from '../components/RowCarousel';
import OfflineEmptyState from '../components/OfflineEmptyState';
import PlayerModal from '../components/PlayerModal';
import EpisodeSelector from '../components/EpisodeSelector';
import { ContentItem, Episode } from '../types';
import { useMovies, useSeriesGrouped, useSitcoms, useKidsContent } from '../hooks/useContent';
import { useDownloadManager } from '../hooks/useDownloadManager';
import { useOffline } from '../hooks/useOffline';
import { getFavorites, saveFavorite, removeFavorite } from '../lib/api';
import { useRenderCount } from '../hooks/useRenderCount';

export default function Home() {
  useRenderCount('Home');
  
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isEpisodeSelectorOpen, setIsEpisodeSelectorOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [selectedSeriesKey, setSelectedSeriesKey] = useState<string | null>(null);
  const { isOffline } = useOffline();
  
  // Content hooks for different categories - each with independent state and retry
  const { content: movies, loading: moviesLoading, error: moviesError, refetch: refetchMovies } = useMovies();
  const { content: series, seriesMap, contentMap: seriesContentMap, loading: seriesLoading, error: seriesError, refetch: refetchSeries } = useSeriesGrouped();
  const { content: sitcoms, loading: sitcomsLoading, error: sitcomsError, refetch: refetchSitcoms } = useSitcoms();
  const { content: kidsContent, loading: kidsLoading, error: kidsError, refetch: refetchKids } = useKidsContent();
  
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
  const handlePlayContent = async (content: ContentItem) => {
    console.log("🎬 [DEBUG] Home handlePlayContent called", content.title);
    
    // Check if this is a series - open episode selector
    if (content.tags.includes('series') || content.tags.includes('sitcom')) {
      console.log("📺 [DEBUG] Series content detected, opening episode selector");
      
      // Extract series key from content
      const seriesKey = extractSeriesKey(content);
      
      if (seriesKey && seriesMap.has(seriesKey)) {
        setSelectedSeriesKey(seriesKey);
        setIsEpisodeSelectorOpen(true);
      } else {
        // Fallback: play directly if we can't find series info
        console.log("⚠️ [DEBUG] Series key not found, playing directly");
        setSelectedContent(content);
        setIsPlayerOpen(true);
      }
    } else {
      // For movies and other content, play directly
      setSelectedContent(content);
      setIsPlayerOpen(true);
    }
  };

  const handleSelectEpisode = (episode: Episode) => {
    console.log("🎬 [DEBUG] Home episode selected", episode.title, episode.claim_id);
    setIsEpisodeSelectorOpen(false);
    
    // Look up the episode in our content map
    const episodeContent = seriesContentMap.get(episode.claim_id);
    
    if (episodeContent) {
      console.log("✅ [DEBUG] Found episode in content map", episodeContent.title);
      setSelectedContent(episodeContent);
      setIsPlayerOpen(true);
    } else {
      console.error('❌ [DEBUG] Episode not found in content map:', episode.claim_id);
    }
  };

  const handleClosePlayer = () => {
    setIsPlayerOpen(false);
    setSelectedContent(null);
  };

  const handleCloseEpisodeSelector = () => {
    setIsEpisodeSelectorOpen(false);
    setSelectedSeriesKey(null);
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
            onRetry={refetchMovies}
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
            onRetry={refetchSeries}
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
            onRetry={refetchSitcoms}
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
            onRetry={refetchKids}
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

      {/* Player Modal */}
      {selectedContent && (
        <PlayerModal
          content={selectedContent}
          isOpen={isPlayerOpen}
          onClose={handleClosePlayer}
        />
      )}

      {/* Episode Selector */}
      {selectedSeriesKey && seriesMap.get(selectedSeriesKey) && (
        <EpisodeSelector
          seriesInfo={seriesMap.get(selectedSeriesKey)!}
          isOpen={isEpisodeSelectorOpen}
          onClose={handleCloseEpisodeSelector}
          onSelectEpisode={handleSelectEpisode}
        />
      )}
    </div>
  );
}

// Helper function to extract series key from content
function extractSeriesKey(content: ContentItem): string | null {
  // Try to parse series name from title (e.g., "SeriesName S01E01 - Episode Title")
  const titleMatch = content.title.match(/^(.+?)\s+S\d+E\d+/i);
  if (titleMatch) {
    const seriesName = titleMatch[1].trim();
    // Generate key using same logic as series utilities
    return seriesName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .join('-');
  }

  return null;
}