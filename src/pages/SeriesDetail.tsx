import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Play, Download, Heart, ChevronDown, ChevronUp } from 'lucide-react';
import { SeriesInfo, Episode, ContentItem } from '../types';
import { resolveClaim, fetchRelatedContent, saveFavorite, removeFavorite, isFavorite } from '../lib/api';
import { useDownloadManager } from '../hooks/useDownloadManager';
import RowCarousel from '../components/RowCarousel';
import { getPrimaryCategory } from '../types';

const SeriesDetail = () => {
  const { claimId } = useParams<{ claimId: string }>();
  const [series, setSeries] = useState<SeriesInfo | null>(null);
  const [relatedContent, setRelatedContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set([1]));
  const [isFav, setIsFav] = useState(false);
  const { downloadContent } = useDownloadManager();

  useEffect(() => {
    if (!claimId) return;

    const loadSeries = async () => {
      try {
        setLoading(true);
        const claim = await resolveClaim(claimId);
        
        // Check if series is favorited
        const favStatus = await isFavorite(claimId);
        setIsFav(favStatus);
        
        // TODO: Transform claim data to SeriesInfo with proper series parsing
        // This is a placeholder implementation
        setSeries({
          series_key: claimId,
          title: claim.title || 'Unknown Series',
          seasons: [],
          total_episodes: 0
        });
        
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
        setError(err instanceof Error ? err.message : 'Failed to load series');
      } finally {
        setLoading(false);
      }
    };

    loadSeries();
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

  const toggleSeason = (seasonNumber: number) => {
    const newExpanded = new Set(expandedSeasons);
    if (newExpanded.has(seasonNumber)) {
      newExpanded.delete(seasonNumber);
    } else {
      newExpanded.add(seasonNumber);
    }
    setExpandedSeasons(newExpanded);
  };

  const handleSeasonKeyDown = (e: React.KeyboardEvent, seasonNumber: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleSeason(seasonNumber);
    }
  };

  const handleEpisodeKeyDown = (e: React.KeyboardEvent, episode: Episode, action: 'play' | 'download' | 'favorite') => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      switch (action) {
        case 'play':
          // Play episode
          console.log('Play episode:', episode.claim_id);
          break;
        case 'download':
          handleDownload(episode, '720p');
          break;
        case 'favorite':
          // Toggle favorite
          console.log('Toggle favorite:', episode.claim_id);
          break;
      }
    }
  };

  const handleDownload = async (episode: Episode, quality: string) => {
    try {
      // Convert Episode to DownloadRequest
      await downloadContent({
        claim_id: episode.claim_id,
        quality,
        url: '' // This would need to be resolved from the episode claim
      });
    } catch (err) {
      console.error('Download failed:', err);
    }
  };
  
  const handleFavoriteToggle = async () => {
    if (!series || !claimId) return;
    
    try {
      if (isFav) {
        await removeFavorite(claimId);
        setIsFav(false);
      } else {
        await saveFavorite({
          claim_id: claimId,
          title: series.title,
          thumbnail_url: undefined
        });
        setIsFav(true);
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
            <div className="h-8 bg-slate-700 rounded w-1/2 mb-4"></div>
            <div className="h-4 bg-slate-700 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-slate-700 rounded w-1/2 mb-8"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !series) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Error Loading Series</h1>
          <p className="text-slate-300">{error || 'Series not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">{series.title}</h1>
            <p className="text-slate-400">
              {series.seasons.length} season{series.seasons.length !== 1 ? 's' : ''} • {series.total_episodes} episodes
            </p>
          </div>
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

        {series.seasons.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400">No episodes available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {series.seasons.map((season) => (
              <div key={season.number} className="bg-slate-800/50 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSeason(season.number)}
                  onKeyDown={(e) => handleSeasonKeyDown(e, season.number)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
                  aria-expanded={expandedSeasons.has(season.number)}
                  aria-label={`${expandedSeasons.has(season.number) ? 'Collapse' : 'Expand'} Season ${season.number}`}
                >
                  <div className="flex items-center space-x-4">
                    <h2 className="text-xl font-semibold text-white">
                      Season {season.number}
                    </h2>
                    {season.inferred && (
                      <span className="text-sm text-yellow-400 bg-yellow-400/20 px-2 py-1 rounded">
                        Inferred
                      </span>
                    )}
                    <span className="text-slate-400">
                      {season.episodes.length} episode{season.episodes.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {expandedSeasons.has(season.number) ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </button>

                {expandedSeasons.has(season.number) && (
                  <div className="border-t border-slate-700">
                    {season.episodes.map((episode, index) => (
                      <div 
                        key={episode.claim_id} 
                        className={`px-6 py-4 flex items-center justify-between hover:bg-slate-700/30 transition-colors ${
                          index < season.episodes.length - 1 ? 'border-b border-slate-700/50' : ''
                        }`}
                      >
                        <div className="flex items-center space-x-4 flex-1">
                          <div className="w-12 h-8 bg-slate-700 rounded flex items-center justify-center text-sm text-slate-300">
                            {episode.episode_number || index + 1}
                          </div>
                          
                          <div className="flex-1">
                            <h3 className="font-medium text-white mb-1">{episode.title}</h3>
                            <div className="flex items-center space-x-4 text-sm text-slate-400">
                              {episode.duration && (
                                <span>{Math.floor(episode.duration / 60)}m</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button 
                            className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                            onKeyDown={(e) => handleEpisodeKeyDown(e, episode, 'play')}
                            aria-label={`Play ${episode.title}`}
                          >
                            <Play className="w-4 h-4 text-white" />
                          </button>
                          <button 
                            onClick={() => handleDownload(episode, '720p')}
                            onKeyDown={(e) => handleEpisodeKeyDown(e, episode, 'download')}
                            className="p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                            aria-label={`Download ${episode.title}`}
                          >
                            <Download className="w-4 h-4 text-white" />
                          </button>
                          <button 
                            className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                            onKeyDown={(e) => handleEpisodeKeyDown(e, episode, 'favorite')}
                            aria-label={`Add ${episode.title} to favorites`}
                          >
                            <Heart className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Related Content Section */}
        {relatedContent.length > 0 && (
          <div className="mt-8">
            <RowCarousel
              title="You may also like"
              content={relatedContent}
              loading={relatedLoading}
              onPlayContent={(content) => {
                // Navigate to detail page based on content type
                const isSeriesContent = content.tags.includes('series') || content.tags.includes('sitcom');
                const path = isSeriesContent ? `/series/${content.claim_id}` : `/movie/${content.claim_id}`;
                window.location.href = path;
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
    </div>
  );
};

export default SeriesDetail;