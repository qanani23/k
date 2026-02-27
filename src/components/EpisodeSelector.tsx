import { useState } from 'react';
import { Play, X, ChevronDown, ChevronUp } from 'lucide-react';
import { SeriesInfo, Episode } from '../types';

interface EpisodeSelectorProps {
  seriesInfo: SeriesInfo;
  isOpen: boolean;
  onClose: () => void;
  onSelectEpisode: (episode: Episode) => void;
}

export default function EpisodeSelector({
  seriesInfo,
  isOpen,
  onClose,
  onSelectEpisode
}: EpisodeSelectorProps) {
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set([1]));

  if (!isOpen) return null;

  const toggleSeason = (seasonNumber: number) => {
    const newExpanded = new Set(expandedSeasons);
    if (newExpanded.has(seasonNumber)) {
      newExpanded.delete(seasonNumber);
    } else {
      newExpanded.add(seasonNumber);
    }
    setExpandedSeasons(newExpanded);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div 
        className="bg-bg-secondary rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">{seriesInfo.title}</h2>
            <p className="text-text-secondary mt-1">
              {seriesInfo.seasons.length} season{seriesInfo.seasons.length !== 1 ? 's' : ''} • {seriesInfo.total_episodes} episode{seriesInfo.total_episodes !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6 text-text-secondary" />
          </button>
        </div>

        {/* Episodes List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {seriesInfo.seasons.map((season) => (
            <div key={season.number} className="glass rounded-lg overflow-hidden">
              {/* Season Header */}
              <button
                onClick={() => toggleSeason(season.number)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <h3 className="text-lg font-semibold text-text-primary">
                    Season {season.number}
                  </h3>
                  {season.inferred && (
                    <span className="text-xs text-yellow-400 bg-yellow-400/20 px-2 py-1 rounded">
                      Inferred
                    </span>
                  )}
                  <span className="text-sm text-text-secondary">
                    {season.episodes.length} episode{season.episodes.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {expandedSeasons.has(season.number) ? (
                  <ChevronUp className="w-5 h-5 text-text-secondary" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-text-secondary" />
                )}
              </button>

              {/* Episodes */}
              {expandedSeasons.has(season.number) && (
                <div className="border-t border-white/10">
                  {season.episodes.map((episode, index) => (
                    <button
                      key={episode.claim_id}
                      onClick={() => onSelectEpisode(episode)}
                      className={`w-full px-6 py-4 flex items-center gap-4 hover:bg-white/5 transition-colors ${
                        index < season.episodes.length - 1 ? 'border-b border-white/5' : ''
                      }`}
                    >
                      {/* Episode Number */}
                      <div className="flex-shrink-0 w-12 h-12 bg-white/10 rounded flex items-center justify-center">
                        <span className="text-sm font-medium text-text-primary">
                          {episode.episode_number || index + 1}
                        </span>
                      </div>

                      {/* Episode Info */}
                      <div className="flex-1 text-left">
                        <h4 className="font-medium text-text-primary mb-1">
                          {episode.title}
                        </h4>
                        {episode.duration && (
                          <p className="text-sm text-text-secondary">
                            {Math.floor(episode.duration / 60)} min
                          </p>
                        )}
                      </div>

                      {/* Play Icon */}
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-accent-cyan rounded-full flex items-center justify-center">
                          <Play className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
