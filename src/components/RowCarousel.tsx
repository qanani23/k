import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ContentItem } from '../types';
import MovieCard from './MovieCard';
import SkeletonCard from './SkeletonCard';
import { gsap } from 'gsap';

interface RowCarouselProps {
  title: string;
  content: ContentItem[];
  loading?: boolean;
  error?: string;
  onPlayContent?: (content: ContentItem) => void;
  onDownloadContent?: (content: ContentItem, quality: string) => void;
  onFavoriteContent?: (content: ContentItem) => void;
  favorites?: string[];
  showViewAll?: boolean;
  onViewAll?: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export default function RowCarousel({
  title,
  content,
  loading = false,
  error,
  onPlayContent,
  onDownloadContent,
  onFavoriteContent,
  favorites = [],
  showViewAll = false,
  onViewAll,
  onLoadMore,
  hasMore = false
}: RowCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const cardRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const prefersReducedMotion = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Initialize IntersectionObserver for lazy loading cards
  useEffect(() => {
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const itemId = entry.target.getAttribute('data-item-id');
            if (itemId) {
              setVisibleItems((prev) => {
                const newSet = new Set(prev);
                if (entry.isIntersecting) {
                  newSet.add(itemId);
                }
                return newSet;
              });
            }
          });
        },
        {
          root: null,
          rootMargin: '200px', // Load items 200px before they enter viewport
          threshold: 0.01
        }
      );
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  // Observe card elements
  useEffect(() => {
    const observer = observerRef.current;
    if (!observer) return;

    // Observe all card containers
    cardRefsMap.current.forEach((element) => {
      observer.observe(element);
    });

    return () => {
      cardRefsMap.current.forEach((element) => {
        observer.unobserve(element);
      });
    };
  }, [content]);

  // Set up IntersectionObserver for infinite scroll
  useEffect(() => {
    if (!onLoadMore || !hasMore || !loadMoreTriggerRef.current) return;

    const loadMoreObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          onLoadMore();
        }
      },
      {
        root: null,
        rootMargin: '100px',
        threshold: 0.1
      }
    );

    loadMoreObserver.observe(loadMoreTriggerRef.current);

    return () => {
      loadMoreObserver.disconnect();
    };
  }, [onLoadMore, hasMore, loading]);

  // Set card ref callback
  const setCardRef = useCallback((itemId: string, element: HTMLDivElement | null) => {
    if (element) {
      cardRefsMap.current.set(itemId, element);
    } else {
      cardRefsMap.current.delete(itemId);
    }
  }, []);

  // GSAP hover animations for cards (respecting prefers-reduced-motion)
  // STRICT: Only opacity, translate (y), and blur allowed - NO layout shifts
  const handleCardHover = useCallback((element: HTMLElement, isEntering: boolean) => {
    if (prefersReducedMotion.current) {
      // No animations for reduced motion preference
      return;
    }

    if (isEntering) {
      // Hover in: lift effect with opacity change (no scale to avoid layout shifts)
      gsap.to(element, {
        y: -8,
        opacity: 0.9,
        duration: 0.3,
        ease: 'power2.out'
      });
    } else {
      // Hover out: return to normal
      gsap.to(element, {
        y: 0,
        opacity: 1,
        duration: 0.3,
        ease: 'power2.out'
      });
    }
  }, []);

  // Check scroll position and update button states
  const updateScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  // Update scroll buttons when content changes
  useEffect(() => {
    updateScrollButtons();
  }, [content]);

  // Add scroll event listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updateScrollButtons);
      return () => container.removeEventListener('scroll', updateScrollButtons);
    }
  }, []);

  // Handle scroll with smooth animation
  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current && !isScrolling) {
      setIsScrolling(true);
      
      const container = scrollContainerRef.current;
      const scrollAmount = container.clientWidth * 0.8; // Scroll 80% of visible width
      const targetScrollLeft = direction === 'left' 
        ? container.scrollLeft - scrollAmount
        : container.scrollLeft + scrollAmount;

      container.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth'
      });

      // Reset scrolling state after animation
      setTimeout(() => {
        setIsScrolling(false);
        updateScrollButtons();
      }, 300);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, direction: 'left' | 'right') => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      scroll(direction);
    }
  };

  if (loading) {
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="loading-skeleton h-6 w-32 rounded"></div>
          {showViewAll && (
            <div className="loading-skeleton h-8 w-20 rounded"></div>
          )}
        </div>
        <div 
          className="flex gap-4 overflow-hidden"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <span className="sr-only">Loading {title} content...</span>
          <SkeletonCard count={6} size="medium" variant="poster" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-text-primary mb-4">{title}</h2>
        <div 
          className="glass rounded-xl p-6 text-center"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-text-secondary mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="btn-secondary"
            aria-label="Reload page"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!content.length) {
    return (
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-text-primary mb-4">{title}</h2>
        <div 
          className="glass rounded-xl p-6 text-center"
          role="status"
          aria-live="polite"
        >
          <p className="text-text-secondary">No content available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
        {showViewAll && (
          <button
            onClick={onViewAll}
            className="btn-ghost text-sm"
            aria-label={`View all ${title}`}
          >
            View All
          </button>
        )}
      </div>

      {/* Carousel Container */}
      <div className="relative group">
        {/* Left Scroll Button */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            onKeyDown={(e) => handleKeyDown(e, 'left')}
            className="carousel-button carousel-button-prev opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Scroll left"
            disabled={isScrolling}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Right Scroll Button */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            onKeyDown={(e) => handleKeyDown(e, 'right')}
            className="carousel-button carousel-button-next opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Scroll right"
            disabled={isScrolling}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Content Scroll Container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {content.map((item) => {
            const isVisible = visibleItems.has(item.claim_id);
            
            return (
              <div
                key={item.claim_id}
                ref={(el) => setCardRef(item.claim_id, el)}
                data-item-id={item.claim_id}
                className="flex-shrink-0"
                onMouseEnter={(e) => handleCardHover(e.currentTarget, true)}
                onMouseLeave={(e) => handleCardHover(e.currentTarget, false)}
              >
                {isVisible ? (
                  <MovieCard
                    content={item}
                    onPlay={onPlayContent}
                    onDownload={onDownloadContent}
                    onFavorite={onFavoriteContent}
                    isFavorite={favorites.includes(item.claim_id)}
                    size="medium"
                  />
                ) : (
                  // Placeholder for unloaded cards
                  <div className="w-40">
                    <div className="aspect-poster rounded-xl bg-white/5 animate-pulse mb-3"></div>
                    <div className="h-4 bg-white/5 rounded mb-2 animate-pulse"></div>
                    <div className="h-3 bg-white/5 rounded w-3/4 animate-pulse"></div>
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Load More Trigger */}
          {hasMore && onLoadMore && (
            <div
              ref={loadMoreTriggerRef}
              className="flex-shrink-0 w-40 flex items-center justify-center"
            >
              {loading ? (
                <div className="w-40">
                  <div className="aspect-poster rounded-xl bg-white/5 animate-pulse mb-3"></div>
                  <div className="h-4 bg-white/5 rounded mb-2 animate-pulse"></div>
                  <div className="h-3 bg-white/5 rounded w-3/4 animate-pulse"></div>
                </div>
              ) : (
                <div className="text-text-secondary text-sm">Loading more...</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}