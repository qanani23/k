import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search as SearchIcon, X, Clock, TrendingUp } from 'lucide-react';
import MovieCard from '../components/MovieCard';
import OfflineEmptyState from '../components/OfflineEmptyState';
import { ContentItem } from '../types';
import { useDebouncedSearch, useSearchHistory } from '../hooks/useDebouncedSearch';
import { useDownloadManager } from '../hooks/useDownloadManager';
import { useOffline } from '../hooks/useOffline';
import { getFavorites, saveFavorite, removeFavorite } from '../lib/api';

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const { isOffline } = useOffline();

  const initialQuery = searchParams.get('q') || '';
  const {
    query,
    results,
    loading,
    error,
    hasSearched,
    hasResults,
    setQuery,
    clearSearch,
    suggestions,
    statusMessage
  } = useDebouncedSearch({ delay: 300, minLength: 2, fallbackToRecent: true });

  const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory();
  const { downloadContent } = useDownloadManager();

  // Check if error is due to offline status
  const isOfflineError = isOffline && error?.details === 'offline';

  // Set initial query from URL params
  useEffect(() => {
    if (initialQuery && initialQuery !== query) {
      setQuery(initialQuery);
    }
  }, [initialQuery, query, setQuery]);

  // Update URL when query changes
  useEffect(() => {
    if (query) {
      setSearchParams({ q: query });
    } else {
      setSearchParams({});
    }
  }, [query, setSearchParams]);

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

  // Handle search submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      addToHistory(query.trim());
      setShowHistory(false);
      setSelectedSuggestionIndex(-1);
    }
  };

  // Handle keyboard navigation in search input
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    const allSuggestions = [...suggestions, ...history];
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev < allSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
      e.preventDefault();
      const selectedSuggestion = allSuggestions[selectedSuggestionIndex];
      if (selectedSuggestion) {
        setQuery(selectedSuggestion);
        addToHistory(selectedSuggestion);
        setShowHistory(false);
        setSelectedSuggestionIndex(-1);
      }
    } else if (e.key === 'Escape') {
      setShowHistory(false);
      setSelectedSuggestionIndex(-1);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    addToHistory(suggestion);
    setShowHistory(false);
  };

  // Handle history item click
  const handleHistoryClick = (historyItem: string) => {
    setQuery(historyItem);
    setShowHistory(false);
  };

  // Handle content playback
  const handlePlayContent = (content: ContentItem) => {
    if (content.tags.includes('series')) {
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Search Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary mb-6">Search</h1>
        
        {/* Search Form */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setShowHistory(true)}
              onBlur={() => setTimeout(() => setShowHistory(false), 150)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search for movies, series, episodes..."
              className="search-input pl-12 pr-12 text-lg h-14"
              autoFocus
              aria-label="Search for content"
              aria-autocomplete="list"
              aria-controls="search-suggestions"
              aria-activedescendant={selectedSuggestionIndex >= 0 ? `suggestion-${selectedSuggestionIndex}` : undefined}
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  clearSearch();
                  setShowHistory(false);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded transition-colors"
                aria-label="Clear search"
              >
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            )}
          </div>

          {/* Search Suggestions and History */}
          {(showHistory || suggestions.length > 0) && (query.length > 0 || history.length > 0) && (
            <div 
              className="absolute top-full left-0 right-0 mt-2 dropdown max-h-80 overflow-y-auto z-10"
              id="search-suggestions"
              role="listbox"
            >
              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-medium text-text-secondary uppercase tracking-wide border-b border-white/10">
                    Suggestions
                  </div>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      id={`suggestion-${index}`}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className={`dropdown-item flex items-center gap-3 ${
                        selectedSuggestionIndex === index ? 'bg-white/10' : ''
                      }`}
                      role="option"
                      aria-selected={selectedSuggestionIndex === index}
                    >
                      <TrendingUp className="w-4 h-4 text-text-secondary" />
                      <span>{suggestion}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Search History */}
              {history.length > 0 && !query && (
                <div>
                  <div className="px-4 py-2 text-xs font-medium text-text-secondary uppercase tracking-wide border-b border-white/10 flex items-center justify-between">
                    Recent Searches
                    <button
                      onClick={clearHistory}
                      className="text-xs text-text-secondary hover:text-text-primary transition-colors"
                      aria-label="Clear all search history"
                    >
                      Clear All
                    </button>
                  </div>
                  {history.map((item, index) => {
                    const historyIndex = suggestions.length + index;
                    return (
                      <div key={index} className="flex items-center">
                        <button
                          id={`suggestion-${historyIndex}`}
                          onClick={() => handleHistoryClick(item)}
                          className={`dropdown-item flex items-center gap-3 flex-1 ${
                            selectedSuggestionIndex === historyIndex ? 'bg-white/10' : ''
                          }`}
                          role="option"
                          aria-selected={selectedSuggestionIndex === historyIndex}
                        >
                          <Clock className="w-4 h-4 text-text-secondary" />
                          <span>{item}</span>
                        </button>
                        <button
                          onClick={() => removeFromHistory(item)}
                          className="p-2 hover:bg-white/5 text-text-secondary hover:text-text-primary transition-colors"
                          aria-label={`Remove "${item}" from history`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </form>
      </div>

      {/* Search Status */}
      {statusMessage && (
        <div className="mb-6">
          <p className="text-text-secondary">
            {statusMessage}
          </p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="content-grid">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="space-y-3">
              <div className="loading-skeleton aspect-poster rounded-xl"></div>
              <div className="loading-skeleton h-4 w-full rounded"></div>
              <div className="loading-skeleton h-3 w-3/4 rounded"></div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {isOfflineError ? (
        <OfflineEmptyState 
          title="Search Unavailable Offline"
          message="You are currently offline. Search requires an internet connection. You can still browse your downloaded content."
        />
      ) : error ? (
        <div className="glass rounded-xl p-6 text-center">
          <p className="text-text-secondary mb-4">{error.message}</p>
          <button 
            onClick={() => window.location.reload()}
            className="btn-secondary"
          >
            Try Again
          </button>
        </div>
      ) : null}

      {/* Search Results */}
      {hasResults && !loading && (
        <div className="content-grid">
          {results.map((item) => (
            <MovieCard
              key={item.claim_id}
              content={item}
              onPlay={handlePlayContent}
              onDownload={handleDownloadContent}
              onFavorite={handleFavoriteContent}
              isFavorite={favorites.includes(item.claim_id)}
              size="medium"
            />
          ))}
        </div>
      )}

      {/* No Results State */}
      {hasSearched && !hasResults && !loading && !error && (
        <div className="glass rounded-xl p-12 text-center">
          <SearchIcon className="w-16 h-16 text-text-secondary mx-auto mb-4" />
          <h3 className="text-xl font-medium text-text-primary mb-2">
            No Results Found
          </h3>
          <p className="text-text-secondary mb-6">
            We couldn't find anything matching "{query}". Try different keywords or check your spelling.
          </p>
          <div className="space-y-2">
            <p className="text-sm text-text-secondary">Search tips:</p>
            <ul className="text-sm text-text-secondary space-y-1">
              <li>• Try broader keywords</li>
              <li>• Check spelling and try again</li>
              <li>• Use "S01E01" format for episodes</li>
              <li>• Search by genre (comedy, action, etc.)</li>
            </ul>
          </div>
        </div>
      )}

      {/* Empty State (No Search) */}
      {!hasSearched && !query && (
        <div className="glass rounded-xl p-12 text-center">
          <SearchIcon className="w-16 h-16 text-text-secondary mx-auto mb-4" />
          <h3 className="text-xl font-medium text-text-primary mb-2">
            Search for Content
          </h3>
          <p className="text-text-secondary mb-6">
            Find movies, series, episodes, and more from our content library.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {['comedy movies', 'action series', 'sitcoms', 'kids shows', 'season 1'].map((term) => (
              <button
                key={term}
                onClick={() => setQuery(term)}
                className="bg-white/5 hover:bg-white/10 text-text-secondary hover:text-text-primary px-3 py-1 rounded-lg text-sm transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to extract series key from content
function extractSeriesKey(content: ContentItem): string | null {
  const seriesTag = content.tags.find(tag => tag.endsWith('_series'));
  if (seriesTag) {
    return seriesTag.replace('_series', '');
  }

  const titleMatch = content.title.match(/^(.+?)\s+S\d+E\d+/i);
  if (titleMatch) {
    return titleMatch[1].toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  return null;
}