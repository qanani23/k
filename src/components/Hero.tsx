import { useState, useEffect, useRef } from 'react';
import { Play, Plus, Shuffle } from 'lucide-react';
import { ContentItem } from '../types';
import { useHeroContent } from '../hooks/useContent';
import { saveFavorite, removeFavorite, getFavorites } from '../lib/api';
import { getSelectedHero, setSelectedHero as storeSelectedHero } from '../lib/storage';
import { gsap } from 'gsap';

interface HeroProps {
  onPlayClick?: (content: ContentItem) => void;
}

export default function Hero({ onPlayClick }: HeroProps) {
  const { content: heroContent, loading, error, refetch } = useHeroContent();
  const [selectedHero, setSelectedHero] = useState<ContentItem | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  
  const heroRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

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

  // Select random hero content when available
  // CRITICAL: Persist selection for session duration using sessionStorage
  useEffect(() => {
    if (heroContent.length > 0 && !selectedHero) {
      // Check if we have a hero stored in session
      const storedHeroId = getSelectedHero();
      
      if (storedHeroId) {
        // Try to find the stored hero in the fetched content
        const storedHero = heroContent.find(h => h.claim_id === storedHeroId);
        if (storedHero) {
          setSelectedHero(storedHero);
          setIsFavorite(favorites.includes(storedHero.claim_id));
          return;
        }
      }
      
      // No stored hero or stored hero not found, select random
      const randomIndex = Math.floor(Math.random() * heroContent.length);
      const hero = heroContent[randomIndex];
      setSelectedHero(hero);
      setIsFavorite(favorites.includes(hero.claim_id));
      
      // Store the selected hero for session duration
      storeSelectedHero(hero.claim_id);
    }
  }, [heroContent, selectedHero, favorites]);

  // Update favorite status when selected hero changes
  useEffect(() => {
    if (selectedHero) {
      setIsFavorite(favorites.includes(selectedHero.claim_id));
    }
  }, [selectedHero, favorites]);

  // GSAP animations (respecting prefers-reduced-motion)
  // STRICT: Only opacity, translate (y), and blur allowed - NO layout shifts
  useEffect(() => {
    if (selectedHero && contentRef.current && heroRef.current) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      
      if (!prefersReducedMotion) {
        // Hero entry animation with opacity, translate, and blur
        const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
        
        // Animate the background with blur effect
        tl.fromTo(heroRef.current, 
          { 
            opacity: 0,
            filter: 'blur(10px)'
          },
          { 
            opacity: 1,
            filter: 'blur(0px)',
            duration: 0.6
          }
        );
        
        // Animate content elements with opacity and translate
        tl.fromTo(contentRef.current.children, 
          { 
            opacity: 0, 
            y: 30,
            filter: 'blur(5px)'
          },
          { 
            opacity: 1, 
            y: 0,
            filter: 'blur(0px)',
            duration: 0.5, 
            stagger: 0.1
          },
          "-=0.3" // Overlap with background animation
        );
      } else {
        // Immediate state for reduced motion - disable all animations
        gsap.set(heroRef.current, { opacity: 1, filter: 'blur(0px)' });
        gsap.set(contentRef.current.children, { opacity: 1, y: 0, filter: 'blur(0px)' });
      }
    }
  }, [selectedHero]);

  // Handle video autoplay
  // STRICT: Attempt autoplay (muted) once, no retry loops
  // If autoplay fails, fall back to poster display
  useEffect(() => {
    if (selectedHero && videoRef.current && !videoError) {
      const video = videoRef.current;
      
      // Attempt autoplay (muted) - single attempt only
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          // Autoplay failed - fall back to poster display
          // NO RETRY: Set error state and let poster display
          console.debug('Hero autoplay failed (expected behavior):', error.message);
          setVideoError(true);
        });
      }
    }
  }, [selectedHero, videoError]);

  const handlePlayClick = () => {
    if (selectedHero && onPlayClick) {
      onPlayClick(selectedHero);
    }
  };

  const handleFavoriteClick = async () => {
    if (!selectedHero) return;

    try {
      if (isFavorite) {
        await removeFavorite(selectedHero.claim_id);
        setFavorites(prev => prev.filter(id => id !== selectedHero.claim_id));
      } else {
        await saveFavorite({
          claim_id: selectedHero.claim_id,
          title: selectedHero.title,
          thumbnail_url: selectedHero.thumbnail_url,
        });
        setFavorites(prev => [...prev, selectedHero.claim_id]);
      }
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error('Failed to update favorite:', error);
    }
  };

  const handleShuffleClick = () => {
    if (heroContent.length > 1) {
      const otherContent = heroContent.filter(item => item.claim_id !== selectedHero?.claim_id);
      const randomIndex = Math.floor(Math.random() * otherContent.length);
      const newHero = otherContent[randomIndex];
      setSelectedHero(newHero);
      setVideoError(false);
      
      // Update session storage with new selection
      storeSelectedHero(newHero.claim_id);
    } else {
      refetch(); // Fetch new hero content
    }
  };

  // Handle keyboard navigation for hero actions
  const handleKeyDown = (e: React.KeyboardEvent, action: 'play' | 'favorite' | 'shuffle') => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      switch (action) {
        case 'play':
          handlePlayClick();
          break;
        case 'favorite':
          handleFavoriteClick();
          break;
        case 'shuffle':
          handleShuffleClick();
          break;
      }
    }
  };

  if (loading) {
    return (
      <div className="relative h-[70vh] bg-gradient-to-b from-bg-main/50 to-bg-main">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="loading-spinner w-8 h-8"></div>
        </div>
      </div>
    );
  }

  if (error || !selectedHero) {
    return (
      <div className="relative h-[70vh] bg-gradient-to-b from-bg-main/50 to-bg-main">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-text-secondary mb-4">
              {error ? 'Failed to load hero content' : 'No hero content available'}
            </p>
            <button
              onClick={refetch}
              className="btn-secondary"
              aria-label="Retry loading hero content"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // CDN Playback: Always use "master" quality key for HLS adaptive streaming
  const bestVideoUrl = selectedHero.video_urls['master']?.url || 
                      Object.values(selectedHero.video_urls)[0]?.url;

  return (
    <div ref={heroRef} className="relative h-[70vh] overflow-hidden">
      {/* Background Video or Image */}
      {bestVideoUrl && !videoError ? (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          onError={() => setVideoError(true)}
          poster={selectedHero.thumbnail_url}
        >
          <source src={bestVideoUrl} type="video/mp4" />
        </video>
      ) : (
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-center"
          style={{
            backgroundImage: selectedHero.thumbnail_url 
              ? `url(${selectedHero.thumbnail_url})` 
              : 'linear-gradient(135deg, #4efcff, #7b5cff, #b44cff)'
          }}
        />
      )}

      {/* Overlay */}
      <div className="hero-content">
        <div ref={contentRef} className="max-w-4xl">
          {/* Title */}
          <h1 className="hero-title">
            {selectedHero.title}
          </h1>

          {/* Description */}
          {selectedHero.description && (
            <p className="hero-description">
              {selectedHero.description.length > 200 
                ? `${selectedHero.description.substring(0, 200)}...`
                : selectedHero.description
              }
            </p>
          )}

          {/* Actions */}
          <div className="hero-actions">
            <button
              onClick={handlePlayClick}
              onKeyDown={(e) => handleKeyDown(e, 'play')}
              className="btn-primary flex items-center gap-2"
              aria-label={`Play ${selectedHero.title}`}
            >
              <Play className="w-5 h-5" />
              Play
            </button>

            <button
              onClick={handleFavoriteClick}
              onKeyDown={(e) => handleKeyDown(e, 'favorite')}
              className={`btn-secondary flex items-center gap-2 ${
                isFavorite ? 'bg-white/20' : ''
              }`}
              aria-label={isFavorite ? `Remove ${selectedHero.title} from favorites` : `Add ${selectedHero.title} to favorites`}
            >
              <Plus className="w-5 h-5" />
              {isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
            </button>

            <button
              onClick={handleShuffleClick}
              onKeyDown={(e) => handleKeyDown(e, 'shuffle')}
              className="btn-ghost flex items-center gap-2"
              title="Shuffle hero content"
              aria-label="Shuffle hero content"
            >
              <Shuffle className="w-5 h-5" />
              Shuffle
            </button>
          </div>

          {/* Content Info */}
          <div className="flex items-center gap-4 mt-6 text-sm text-white/70">
            {selectedHero.duration && (
              <span>{Math.floor(selectedHero.duration / 60)} min</span>
            )}
            {selectedHero.tags.includes('movie') && <span>Movie</span>}
            {selectedHero.tags.includes('series') && <span>Series</span>}
            {selectedHero.tags.includes('sitcom') && <span>Sitcom</span>}
            {selectedHero.tags.includes('kids') && <span>Kids</span>}
            {/* CDN Playback: HLS master playlist provides adaptive quality */}
            {Object.keys(selectedHero.video_urls).includes('master') && (
              <span className="quality-badge">HLS</span>
            )}
          </div>
        </div>
      </div>

      {/* Gradient Overlay for Better Text Readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-bg-main via-transparent to-transparent pointer-events-none" />
    </div>
  );
}