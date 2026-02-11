/**
 * Image handling utilities for lazy loading, error handling, and thumbnail management
 */

/**
 * Lazy load images using IntersectionObserver
 * @param element - The image element to observe
 * @param src - The source URL to load
 * @param options - IntersectionObserver options
 */
export function lazyLoadImage(
  element: HTMLImageElement,
  src: string,
  options?: IntersectionObserverInit
): () => void {
  const defaultOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: '50px',
    threshold: 0.01,
    ...options,
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        if (src) {
          img.src = src;
          img.classList.add('loaded');
        }
        observer.unobserve(img);
      }
    });
  }, defaultOptions);

  observer.observe(element);

  // Return cleanup function
  return () => {
    observer.unobserve(element);
    observer.disconnect();
  };
}

/**
 * Preload an image by creating an Image object
 * @param src - The image URL to preload
 * @returns Promise that resolves when image is loaded
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error('No image source provided'));
      return;
    }

    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * Preload multiple images
 * @param sources - Array of image URLs to preload
 * @returns Promise that resolves when all images are loaded
 */
export function preloadImages(sources: string[]): Promise<void[]> {
  const validSources = sources.filter((src) => src && src.trim() !== '');
  return Promise.all(validSources.map((src) => preloadImage(src)));
}

/**
 * Extract thumbnail URL from various possible field locations in API response
 * Handles defensive parsing for Odysee API responses
 * @param data - The API response data
 * @returns The thumbnail URL or undefined
 */
export function extractThumbnailUrl(data: any): string | undefined {
  if (!data) return undefined;

  // Try direct thumbnail_url field
  if (data.thumbnail_url && typeof data.thumbnail_url === 'string') {
    return data.thumbnail_url;
  }

  // Try thumbnail field
  if (data.thumbnail && typeof data.thumbnail === 'string') {
    return data.thumbnail;
  }

  // Try nested thumbnail object with url field
  if (data.thumbnail && typeof data.thumbnail === 'object' && data.thumbnail.url) {
    return data.thumbnail.url;
  }

  // Try value.thumbnail path (common in Odysee responses)
  if (data.value?.thumbnail?.url && typeof data.value.thumbnail.url === 'string') {
    return data.value.thumbnail.url;
  }

  // Try value.thumbnail as string
  if (data.value?.thumbnail && typeof data.value.thumbnail === 'string') {
    return data.value.thumbnail;
  }

  // Try metadata.thumbnail path
  if (data.metadata?.thumbnail?.url && typeof data.metadata.thumbnail.url === 'string') {
    return data.metadata.thumbnail.url;
  }

  // Try metadata.thumbnail as string
  if (data.metadata?.thumbnail && typeof data.metadata.thumbnail === 'string') {
    return data.metadata.thumbnail;
  }

  return undefined;
}

/**
 * Get fallback thumbnail for playlists (first episode thumbnail)
 * @param episodes - Array of episodes with thumbnail_url
 * @returns The first available thumbnail URL or undefined
 */
export function getPlaylistThumbnail(episodes: Array<{ thumbnail_url?: string }>): string | undefined {
  if (!episodes || episodes.length === 0) return undefined;

  for (const episode of episodes) {
    if (episode.thumbnail_url) {
      return episode.thumbnail_url;
    }
  }

  return undefined;
}

/**
 * Generate a placeholder gradient based on content title
 * @param title - The content title
 * @returns CSS gradient string
 */
export function generatePlaceholderGradient(title: string): string {
  // Generate a deterministic color based on title
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue1 = Math.abs(hash % 360);
  const hue2 = Math.abs((hash + 120) % 360);

  return `linear-gradient(135deg, hsl(${hue1}, 70%, 50%) 0%, hsl(${hue2}, 70%, 50%) 100%)`;
}

/**
 * Check if an image URL is valid and accessible
 * @param url - The image URL to check
 * @returns Promise that resolves to true if image is accessible
 */
export async function isImageAccessible(url: string): Promise<boolean> {
  if (!url || url.trim() === '') return false;

  try {
    await preloadImage(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get optimized image URL with size parameters if supported
 * @param url - The original image URL
 * @param width - Desired width
 * @param height - Desired height
 * @returns Optimized URL or original URL
 */
export function getOptimizedImageUrl(
  url: string | undefined,
  width?: number,
  height?: number
): string | undefined {
  if (!url) return undefined;

  // For Odysee/LBRY thumbnails, we can add size parameters
  if (url.includes('thumbnails.lbry.com') || url.includes('spee.ch')) {
    const urlObj = new URL(url);
    if (width) urlObj.searchParams.set('width', width.toString());
    if (height) urlObj.searchParams.set('height', height.toString());
    return urlObj.toString();
  }

  return url;
}

/**
 * Create an IntersectionObserver for lazy loading multiple images
 * @param callback - Callback function when image intersects
 * @param options - IntersectionObserver options
 * @returns IntersectionObserver instance
 */
export function createImageObserver(
  callback: (element: HTMLImageElement) => void,
  options?: IntersectionObserverInit
): IntersectionObserver {
  const defaultOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: '50px',
    threshold: 0.01,
    ...options,
  };

  return new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        callback(img);
        // Note: Caller should unobserve after loading
      }
    });
  }, defaultOptions);
}

/**
 * Handle image load error with fallback
 * @param event - The error event
 * @param fallbackSrc - Optional fallback image URL
 */
export function handleImageError(
  event: React.SyntheticEvent<HTMLImageElement>,
  fallbackSrc?: string
): void {
  const img = event.currentTarget;
  
  if (fallbackSrc && img.src !== fallbackSrc) {
    img.src = fallbackSrc;
  } else {
    // Remove src to prevent infinite error loop
    img.removeAttribute('src');
    img.classList.add('image-error');
  }
}

/**
 * Check if browser supports lazy loading natively
 * @returns true if native lazy loading is supported
 */
export function supportsNativeLazyLoading(): boolean {
  return 'loading' in HTMLImageElement.prototype;
}

/**
 * Get appropriate loading strategy based on browser support
 * @returns 'native' or 'observer'
 */
export function getLoadingStrategy(): 'native' | 'observer' {
  return supportsNativeLazyLoading() ? 'native' : 'observer';
}
