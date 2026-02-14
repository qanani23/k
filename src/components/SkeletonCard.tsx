interface SkeletonCardProps {
  size?: 'small' | 'medium' | 'large';
  count?: number;
  variant?: 'poster' | 'header' | 'text' | 'settings';
}

/**
 * Standardized skeleton loader component for consistent loading states
 * across all pages in the application.
 * 
 * @param size - Size variant: 'small' (w-32), 'medium' (w-40), 'large' (w-48)
 * @param count - Number of skeleton cards to render
 * @param variant - Type of skeleton: 'poster' (content cards), 'header' (page headers), 'text' (text lines), 'settings' (settings items)
 */
export default function SkeletonCard({ 
  size = 'medium', 
  count = 1,
  variant = 'poster'
}: SkeletonCardProps) {
  const sizeClasses = {
    small: 'w-32',
    medium: 'w-40',
    large: 'w-48'
  };

  // Poster variant - for content cards (movies, series, etc.)
  if (variant === 'poster') {
    return (
      <>
        {Array.from({ length: count }).map((_, index) => (
          <div 
            key={index}
            className={`${sizeClasses[size]} flex-shrink-0 space-y-3`}
            role="status"
            aria-label="Loading content"
          >
            <span className="sr-only">Loading...</span>
            <div className="loading-skeleton aspect-poster rounded-xl" aria-hidden="true"></div>
            <div className="loading-skeleton h-4 w-full rounded" aria-hidden="true"></div>
            <div className="loading-skeleton h-3 w-3/4 rounded" aria-hidden="true"></div>
          </div>
        ))}
      </>
    );
  }

  // Header variant - for page headers
  if (variant === 'header') {
    return (
      <div 
        className="mb-8"
        role="status"
        aria-label="Loading header"
      >
        <span className="sr-only">Loading...</span>
        <div className="loading-skeleton h-6 w-32 rounded mb-4" aria-hidden="true"></div>
        <div className="loading-skeleton h-8 w-48 rounded" aria-hidden="true"></div>
      </div>
    );
  }

  // Text variant - for text lines
  if (variant === 'text') {
    return (
      <>
        {Array.from({ length: count }).map((_, index) => (
          <div 
            key={index}
            className="loading-skeleton h-4 w-full rounded mb-2"
            role="status"
            aria-label="Loading text"
            aria-hidden="true"
          >
            <span className="sr-only">Loading...</span>
          </div>
        ))}
      </>
    );
  }

  // Settings variant - for settings items
  if (variant === 'settings') {
    return (
      <>
        {Array.from({ length: count }).map((_, index) => (
          <div 
            key={index}
            className="loading-skeleton h-12 rounded"
            role="status"
            aria-label="Loading settings"
            aria-hidden="true"
          >
            <span className="sr-only">Loading...</span>
          </div>
        ))}
      </>
    );
  }

  return null;
}
