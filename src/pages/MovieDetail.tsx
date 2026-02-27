import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Play, Download, Heart, Star } from 'lucide-react';
import { ContentItem } from '../types';
import { resolveClaim, fetchRelatedContent, saveFavorite, removeFavorite, isFavorite } from '../lib/api';
import { useDownloadManager } from '../hooks/useDownloadManager';
import RowCarousel from '../components/RowCarousel';
import PlayerModal from '../components/PlayerModal';
import { getPrimaryCategory } from '../types';
import { useRenderCount } from '../hooks/useRenderCount';

const MovieDetail = () => {
  useRenderCount('MovieDetail');
  
  const { claimId } = useParams<{ claimId: string }>();
  const [movie, setMovie] = useState<ContentItem | null>(null);
  const [relatedContent, setRelatedContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFav, setIsFav] = useState(false);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const { downloadContent } = useDownloadManager();

  useEffect(() => {
    if (!claimId) return;

    const loadMovie = async () => {
      try {
        setLoading(true);
        const claim = await resolveClaim(claimId);
        setMovie(claim);
        
        // Check if movie is favorited
        const favStatus = await isFavorite(claimId);
        setIsFav(favStatus);
        
        // Load related content based on category tag
        const categoryTag = getCategoryTag(claim);
        if (categoryTag) {
          setRelatedLoading(true);
          try {
            const related = await fetchRelatedContent(categoryTag, claimId, 10);
            setRelatedContent(related);
          } catch (err) {
            console.error('Failed to load related content:', err);
          } finally {
            setRelatedLoading(false);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load movie');
      } finally {
        setLoading(false);
      }
    };

    loadMovie();
  }, [claimId]);
  
  // Extract category tag from content (filter tags like action_movies, comedy_series, etc.)
  const getCategoryTag = (content: ContentItem): string | null => {
    const filterTags = [
      'comedy_movies', 'action_movies', 'romance_movies',
      'comedy_series', 'action_series', 'romance_series',
      'comedy_kids', 'action_kids'
    ];
    
    for (const tag of content.tags) {
      if (filterTags.includes(tag)) {
        return tag;
      }
    }
    
    // Fallback to base tag if no filter tag found
    return getPrimaryCategory(content);
  };

  const handleDownload = async (quality: string) => {
    if (!movie) return;
    
    try {
      await downloadContent({
        claim_id: movie.claim_id,
        quality,
        url: movie.video_urls[quality]?.url || ''
      });
    } catch (err) {
      console.error('Download failed:', err);
    }
  };
  
  const handleFavoriteToggle = async () => {
    if (!movie) return;
    
    try {
      if (isFav) {
        await removeFavorite(movie.claim_id);
        setIsFav(false);
      } else {
        await saveFavorite({
          claim_id: movie.claim_id,
          title: movie.title,
          thumbnail_url: movie.thumbnail_url
        });
        setIsFav(true);
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handlePlay = () => {
    console.log("🎬 [DEBUG] handlePlay clicked");
    console.log("🎬 [DEBUG] movie object:", movie);
    console.log("🎬 [DEBUG] movie exists:", !!movie);
    
    setIsPlayerOpen(true);
    
    console.log("🎬 [DEBUG] isPlayerOpen set to true");
  };

  const handleClosePlayer = () => {
    setIsPlayerOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-slate-700 rounded w-1/2 mb-4"></div>
            <div className="h-4 bg-slate-700 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-slate-700 rounded w-1/2 mb-8"></div>
            <div className="h-64 bg-slate-700 rounded mb-6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Error Loading Movie</h1>
          <p className="text-slate-300">{error || 'Movie not found'}</p>
        </div>
      </div>
    );
  }

  // DEBUG: Log render state
  console.log("🎥 [DEBUG] MovieDetail render state:", {
    hasMovie: !!movie,
    isPlayerOpen,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-slate-800/50 rounded-lg overflow-hidden">
          {movie.thumbnail_url && (
            <div className="aspect-video bg-slate-700">
              <img 
                src={movie.thumbnail_url} 
                alt={movie.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white mb-2">{movie.title}</h1>
                <div className="flex items-center space-x-4 text-sm text-slate-400 mb-4">
                  {movie.duration && (
                    <span>{Math.floor(movie.duration / 60)}m</span>
                  )}
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span>N/A</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button 
                  onClick={handlePlay}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium text-white transition-colors flex items-center space-x-2"
                >
                  <Play className="w-5 h-5" />
                  <span>Play</span>
                </button>
                <button 
                  onClick={() => handleDownload('720p')}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium text-white transition-colors flex items-center space-x-2"
                >
                  <Download className="w-5 h-5" />
                  <span>Download</span>
                </button>
                <button 
                  onClick={handleFavoriteToggle}
                  className={`p-3 rounded-lg transition-colors ${
                    isFav ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                  aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Heart className={`w-5 h-5 ${isFav ? 'fill-white' : ''} text-white`} />
                </button>
              </div>
            </div>
            
            {movie.description && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-white mb-2">Description</h2>
                <p className="text-slate-300 leading-relaxed">{movie.description}</p>
              </div>
            )}
            
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-white mb-2">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {movie.tags.map((tag) => (
                  <span 
                    key={tag}
                    className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            
            {movie.compatibility && !movie.compatibility.compatible && (
              <div className="bg-yellow-900/50 border border-yellow-600 rounded-lg p-4">
                <p className="text-yellow-200">
                  ⚠️ This video may not play on your platform. {movie.compatibility.reason}
                </p>
                {movie.compatibility.fallback_available && (
                  <button className="mt-2 text-yellow-400 hover:text-yellow-300 underline">
                    Play via external player
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Related Content Section */}
        {relatedContent.length > 0 && (
          <div className="mt-8">
            <RowCarousel
              title="You may also like"
              content={relatedContent}
              loading={relatedLoading}
              onPlayContent={(content) => {
                // Navigate to detail page
                window.location.href = `/movie/${content.claim_id}`;
              }}
              onDownloadContent={(content, quality) => {
                downloadContent({
                  claim_id: content.claim_id,
                  quality,
                  url: content.video_urls[quality]?.url || ''
                });
              }}
            />
          </div>
        )}
      </div>

      {/* Player Modal */}
      {movie && (
        <PlayerModal
          content={movie}
          isOpen={isPlayerOpen}
          onClose={handleClosePlayer}
        />
      )}
    </div>
  );
};

export default MovieDetail;