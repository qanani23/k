import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Hero from '../../src/components/Hero';
import * as api from '../../src/lib/api';
import * as storage from '../../src/lib/storage';
import { gsap } from 'gsap';
import { ContentItem } from '../../src/types';

// Mock GSAP
vi.mock('gsap', () => ({
  gsap: {
    timeline: vi.fn(() => ({
      fromTo: vi.fn().mockReturnThis(),
    })),
    set: vi.fn(),
  },
}));

// Mock API
vi.mock('../../src/lib/api', () => ({
  fetchChannelClaims: vi.fn(),
  fetchByTags: vi.fn(),
  getFavorites: vi.fn(),
  saveFavorite: vi.fn(),
  removeFavorite: vi.fn(),
}));

// Mock storage
vi.mock('../../src/lib/storage', () => ({
  getSelectedHero: vi.fn(),
  setSelectedHero: vi.fn(),
}));

const mockHeroContent: ContentItem = {
  claim_id: 'hero-123',
  title: 'Test Hero Movie',
  description: 'This is a test hero movie description',
  tags: ['hero_trailer', 'movie', 'action_movies'],
  thumbnail_url: 'https://example.com/hero-thumb.jpg',
  duration: 7200,
  release_time: Date.now(),
  video_urls: {
    '1080p': { url: 'https://example.com/video-1080p.mp4', quality: '1080p', type: 'mp4' as const },
    '720p': { url: 'https://example.com/video-720p.mp4', quality: '720p', type: 'mp4' as const },
  },
  compatibility: { compatible: true, fallback_available: false },
};

describe('Hero Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getFavorites).mockResolvedValue([]);
    vi.mocked(api.fetchByTags).mockResolvedValue([mockHeroContent]);
    vi.mocked(storage.getSelectedHero).mockReturnValue(null);
    vi.mocked(storage.setSelectedHero).mockReturnValue(true);
    
    // Mock matchMedia for all tests
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders hero content with title and description', async () => {
    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Hero Movie')).toBeInTheDocument();
    });

    expect(screen.getByText(/This is a test hero movie description/)).toBeInTheDocument();
  });

  it.skip('applies GSAP animations when prefers-reduced-motion is not set', async () => {
    // Mock matchMedia to return false for prefers-reduced-motion
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Hero Movie')).toBeInTheDocument();
    });

    // Wait a bit for GSAP animations to be set up
    await waitFor(() => {
      expect(gsap.timeline).toHaveBeenCalled();
    }, { timeout: 1000 });
  });

  it.skip('disables GSAP animations when prefers-reduced-motion is set', async () => {
    // Mock matchMedia to return true for prefers-reduced-motion
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Hero Movie')).toBeInTheDocument();
    });

    // Wait a bit for GSAP to be set up
    await waitFor(() => {
      expect(gsap.set).toHaveBeenCalled();
    }, { timeout: 1000 });
  });

  it('displays play and favorite buttons', async () => {
    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Hero Movie')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to favorites/i })).toBeInTheDocument();
  });

  it('displays shuffle button', async () => {
    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Hero Movie')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /shuffle/i })).toBeInTheDocument();
  });

  it('displays content metadata (duration, quality)', async () => {
    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Hero Movie')).toBeInTheDocument();
    });

    // Check for duration (7200 seconds = 120 minutes)
    expect(screen.getByText(/120 min/)).toBeInTheDocument();
    
    // Check for HD quality badge
    expect(screen.getByText('HD')).toBeInTheDocument();
    
    // Check for movie tag
    expect(screen.getByText('Movie')).toBeInTheDocument();
  });

  it('handles video autoplay with poster fallback', async () => {
    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Hero Movie')).toBeInTheDocument();
    });

    // Check that video element exists with correct attributes
    const videoElement = document.querySelector('video');
    expect(videoElement).toBeInTheDocument();
    expect(videoElement).toHaveAttribute('autoplay');
    expect(videoElement).toHaveProperty('muted', true);
    expect(videoElement).toHaveAttribute('loop');
    expect(videoElement).toHaveAttribute('poster', mockHeroContent.thumbnail_url);
  });

  it('video element has autoplay and muted attributes', async () => {
    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Hero Movie')).toBeInTheDocument();
    });

    // Verify video element has correct attributes for autoplay
    const videoElement = document.querySelector('video') as HTMLVideoElement;
    expect(videoElement).toBeInTheDocument();
    expect(videoElement).toHaveAttribute('autoplay');
    expect(videoElement.muted).toBe(true); // muted is a boolean property, not an attribute
    expect(videoElement).toHaveAttribute('loop');
    expect(videoElement).toHaveAttribute('playsinline');
    expect(videoElement).toHaveAttribute('poster', mockHeroContent.thumbnail_url);
  });

  it('falls back to poster display when video fails', async () => {
    // Mock content without video URLs to trigger poster fallback
    const contentWithoutVideo: ContentItem = {
      ...mockHeroContent,
      video_urls: {},
    };
    
    vi.mocked(api.fetchByTags).mockResolvedValue([contentWithoutVideo]);

    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Hero Movie')).toBeInTheDocument();
    });

    // When no video URL, should show poster as background
    const posterElement = document.querySelector('[style*="background-image"]');
    expect(posterElement).toBeInTheDocument();
    
    // Video element should not be present
    const videoElement = document.querySelector('video');
    expect(videoElement).not.toBeInTheDocument();
  });

  it('shows poster and Play CTA when autoplay fails', async () => {
    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Hero Movie')).toBeInTheDocument();
    });

    // Get the video element
    const videoElement = document.querySelector('video') as HTMLVideoElement;
    expect(videoElement).toBeInTheDocument();

    // Simulate autoplay failure by triggering the error event
    const errorEvent = new Event('error');
    videoElement.dispatchEvent(errorEvent);

    // Wait for the component to update
    await waitFor(() => {
      // After error, video should be removed and poster should be shown
      const posterElement = document.querySelector('[style*="background-image"]');
      expect(posterElement).toBeInTheDocument();
    });

    // Verify Play button is still accessible
    const playButton = screen.getByRole('button', { name: /play/i });
    expect(playButton).toBeInTheDocument();
    expect(playButton).toBeVisible();

    // Video element should no longer be rendered
    const videoAfterError = document.querySelector('video');
    expect(videoAfterError).not.toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    vi.mocked(api.fetchByTags).mockImplementation(
      () => new Promise<ContentItem[]>(() => {}) // Never resolves
    );

    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    const loadingSpinner = document.querySelector('.loading-spinner');
    expect(loadingSpinner).toBeInTheDocument();
    expect(loadingSpinner).toHaveClass('loading-spinner');
  });

  it('shows error state when content fetch fails', async () => {
    vi.mocked(api.fetchByTags).mockRejectedValue(new Error('Network error'));

    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/failed to load hero content/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('fetches content tagged with hero_trailer only', async () => {
    vi.mocked(api.fetchByTags).mockResolvedValue([mockHeroContent]);

    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Hero Movie')).toBeInTheDocument();
    });

    // Verify that fetchByTags was called with hero_trailer tag
    expect(api.fetchByTags).toHaveBeenCalledWith(['hero_trailer'], 20);
  });

  it('randomly selects one hero per session', async () => {
    const multipleHeroContent: ContentItem[] = [
      mockHeroContent,
      {
        ...mockHeroContent,
        claim_id: 'hero-456',
        title: 'Another Hero Movie',
      },
      {
        ...mockHeroContent,
        claim_id: 'hero-789',
        title: 'Third Hero Movie',
      },
    ];

    vi.mocked(api.fetchByTags).mockResolvedValue(multipleHeroContent);

    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    await waitFor(() => {
      // One of the hero titles should be displayed
      const displayedTitles = multipleHeroContent.map(h => h.title);
      const foundTitle = displayedTitles.some(title => {
        try {
          screen.getByText(title);
          return true;
        } catch {
          return false;
        }
      });
      expect(foundTitle).toBe(true);
    });

    // Verify only one hero is displayed (not all three)
    const allTitles = screen.queryAllByRole('heading', { level: 1 });
    expect(allTitles).toHaveLength(1);
  });

  it('persists selected hero for session duration', async () => {
    const multipleHeroContent: ContentItem[] = [
      mockHeroContent,
      {
        ...mockHeroContent,
        claim_id: 'hero-456',
        title: 'Another Hero Movie',
      },
    ];

    vi.mocked(api.fetchByTags).mockResolvedValue(multipleHeroContent);
    vi.mocked(storage.getSelectedHero).mockReturnValue(null);

    const { rerender } = render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    const firstTitle = screen.getByRole('heading', { level: 1 }).textContent;

    // Verify that setSelectedHero was called to store the selection
    expect(storage.setSelectedHero).toHaveBeenCalled();
    const storedClaimId = vi.mocked(storage.setSelectedHero).mock.calls[0][0];

    // Mock the storage to return the stored hero on next render
    vi.mocked(storage.getSelectedHero).mockReturnValue(storedClaimId);

    // Rerender the component (simulating navigation or refresh)
    rerender(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    // The same hero should still be displayed
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(firstTitle!);
    });

    // Verify that getSelectedHero was called to retrieve the stored selection
    expect(storage.getSelectedHero).toHaveBeenCalled();
  });

  it('retrieves stored hero from session storage on mount', async () => {
    const multipleHeroContent: ContentItem[] = [
      mockHeroContent,
      {
        ...mockHeroContent,
        claim_id: 'hero-456',
        title: 'Another Hero Movie',
      },
    ];

    // Mock that hero-456 is stored in session
    vi.mocked(storage.getSelectedHero).mockReturnValue('hero-456');
    vi.mocked(api.fetchByTags).mockResolvedValue(multipleHeroContent);

    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    // Wait for render and verify the stored hero is displayed
    await waitFor(() => {
      expect(screen.getByText('Another Hero Movie')).toBeInTheDocument();
    });

    // Verify that getSelectedHero was called
    expect(storage.getSelectedHero).toHaveBeenCalled();
  });

  it('selects random hero when stored hero not found in fetched content', async () => {
    const multipleHeroContent: ContentItem[] = [
      mockHeroContent,
      {
        ...mockHeroContent,
        claim_id: 'hero-456',
        title: 'Another Hero Movie',
      },
    ];

    // Mock that a non-existent hero is stored in session
    vi.mocked(storage.getSelectedHero).mockReturnValue('hero-999');
    vi.mocked(api.fetchByTags).mockResolvedValue(multipleHeroContent);

    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    // Wait for render and verify a hero is displayed (should be random selection)
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    // Verify that a new hero was stored
    expect(storage.setSelectedHero).toHaveBeenCalled();
  });
});
