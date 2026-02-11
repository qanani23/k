import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Download, Heart, ChevronDown, ChevronUp } from 'lucide-react';
import { SeriesInfo, Episode, ContentItem, Playlist } from '../types';
import { fetchPlaylists, fetchByTag, resolveClaim, saveFavorite, removeFavorite, getFavorites } from '../lib/api';
import { getSeriesForClaim, mergeSeriesData } from '../lib/series';
import { useDownloadManager } from '../hooks/useDownloadManager';

const SeriesPage = () => {
  const { claimId } = useParams<{ claimId: string }>();
  const navigate = useNavigate();
  const [series, setSeries] = useState<SeriesInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set([1]));
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const { downloadContent } = useDownloadManager();

  useEffect(() => {
    if (!claimId) return;

    const loadSeries = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch playlists and series content
        const [playlists, seriesContent, favoritesData] = await Promise.all([
          fetchPlaylists(),
          fetchByTag('series', 200), // Fetch more to ensure we get all episodes
          getFavorites()
        ]);

        // Build favorites set
        const favSet = new Set(favoritesData.map(f => f.claim_id));
        setFavorites(favSet);

        // Get series info for this claim
        const seriesInfo = getSeriesForClaim(claimId, playlists, seriesContent);

        if (!seriesInfo) {
          // If not found in series, try sitcoms
          const sitcomContent = await fetchByTag('sitcom', 200);
          const sitcomInfo = getSeriesForClaim(claimId, playlists, sitcomContent);
          
          if (sitcomInfo) {
            setSeries(sitcomInfo);
          } else {
            setError('Series not found');
          }
        } else {
          setSeries(seriesInfo);
        }
      } catch (err) {
        console.error('Failed to load series:', err);
        setError(err instanceof Error ? err.message : 'Failed to load series');
      } finally {
        setLoading(false);
      }
    };

    loadSeries();
  }, [claimId]);

  const toggleSeason = (seasonNumber: number) => {
    setExpandedSeasons(prev => {
      const newSet = new Set(prev);
      if (newSet.has(seasonNumber)) {
        newSet.delete(seasonNumber);
      } else {
        newSet.add(seasonNumber);
      }
      return newSet;
    });
  };

  const handlePlay = (episode: Episode) => {
    // Navigate to episode detail page
    navigate(`/series/${episode.claim_id}`);
  };

  const handleDownload = async (episode: Episode) => {
    try {
      // Resolve claim to get video URLs
      const claim = await resolveClaim(episode.claim_id);
      
      // Get best quality URL (prefer 720p)
      const qualities = Object.keys(claim.video_urls);
      const preferredQuality = qualities.includes('720p') ? '720p' : qualities[0];
      
      if (!preferredQuality) {
        console.error('No video URLs available');
        return;
      }

      const videoUrl = claim.video_urls[preferredQuality];
      
      await downloadContent({
        claim_id: episode.claim_id,
        quality: preferredQuality,
        url: videoUrl.url
      });
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleToggleFavorite = async (episode: Episode) => {
    try {
      const isFavorite = favorites.has(episode.claim_id);
      
      if (isFavorite) {
        await removeFavorite(episode.claim_id);
        setFavorites(prev => {
          const newSet = new Set(prev);
          newSet.delete(episode.claim_id);
          return newSet;
        });
      } else {
        await saveFavorite({
          claim_id: episode.claim_id,
          title: episode.title,
          thumbnail_url: episode.thumbnail_url
        });
        setFavorites(prev => new Set(prev).add(episode.claim_id));
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-slate-700 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-slate-700 rounded w-2/3 mb-8"></div>
            <div className="space-y-4">
              <div className="h-32 bg-slate-700 rounded"></div>
              <div className="h-32 bg-slate-700 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !series) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Error Loading Series</h1>
            <p className="text-slate-300 mb-6">{error || 'Series not found'}</p>
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Series Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{series.title}</h1>
          <p className="text-slate-400">
            {series.seasons.length} season{series.seasons.length !== 1 ? 's' : ''} • {series.total_episodes} episode{series.total_episodes !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Seasons List */}
        {series.seasons.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400">No episodes available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {series.seasons.map((season) => {
              const isExpanded = expandedSeasons.has(season.number);
              
              return (
                <div key={season.number} className="bg-slate-800/50 backdrop-blur-sm rounded-lg overflow-hidden">
                  {/* Season Header */}
                  <button
                    onClick={() => toggleSeason(season.number)}
                    className="w-full flex items-center justify-between p-6 hover:bg-slate-700/30 transition-colors"
                    aria-expanded={isExpanded}
                    aria-controls={`season-${season.number}-episodes`}
                  >
                    <div className="flex items-center space-x-4">
                      <h2 className="text-xl font-semibold text-white">
                        Season {season.number}
                      </h2>
                      {season.inferred && (
                        <span className="text-sm text-yellow-400 bg-yellow-400/10 px-3 py-1 rounded-full">
                          Seasons inferred automatically
                        </span>
                      )}
                      <span className="text-sm text-slate-400">
                        {season.episodes.length} episode{season.episodes.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </button>

                  {/* Episodes List */}
                  {isExpanded && (
                    <div 
                      id={`season-${season.number}-episodes`}
                      className="border-t border-slate-700/50"
                    >
                      <div className="p-4 space-y-3">
                        {season.episodes.map((episode, index) => {
                          const isFavorite = favorites.has(episode.claim_id);
                          
                          return (
                            <div 
                              key={episode.claim_id} 
                              className="flex items-center justify-between bg-slate-700/30 hover:bg-slate-700/50 rounded-lg p-4 transition-colors group"
                            >
                              {/* Episode Info */}
                              <div className="flex items-start space-x-4 flex-1">
                                {/* Episode Number Badge */}
                                <div className="flex-shrink-0 w-10 h-10 bg-slate-600/50 rounded-lg flex items-center justify-center">
                                  <span className="text-sm font-semibold text-white">
                                    {episode.episode_number}
                                  </span>
                                </div>

                                {/* Episode Details */}
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-medium text-white mb-1 truncate">
                                    {episode.title}
                                  </h3>
                                  <p className="text-sm text-slate-400">
                                    Episode {episode.episode_number}
                                    {episode.duration && (
                                      <> • {Math.floor(episode.duration / 60)}m</>
                                    )}
                                  </p>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center space-x-2 ml-4">
                                <button
                                  onClick={() => handlePlay(episode)}
                                  className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                                  aria-label={`Play ${episode.title}`}
                                  title="Play episode"
                                >
                                  <Play className="w-4 h-4 text-white" />
                                </button>
                                <button
                                  onClick={() => handleDownload(episode)}
                                  className="p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                                  aria-label={`Download ${episode.title}`}
                                  title="Download episode"
                                >
                                  <Download className="w-4 h-4 text-white" />
                                </button>
                                <button
                                  onClick={() => handleToggleFavorite(episode)}
                                  className={`p-2 rounded-lg transition-colors ${
                                    isFavorite 
                                      ? 'bg-red-600 hover:bg-red-700' 
                                      : 'bg-slate-600 hover:bg-slate-700'
                                  }`}
                                  aria-label={isFavorite ? `Remove ${episode.title} from favorites` : `Add ${episode.title} to favorites`}
                                  title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                >
                                  <Heart 
                                    className={`w-4 h-4 ${isFavorite ? 'fill-white' : ''} text-white`}
                                  />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SeriesPage;