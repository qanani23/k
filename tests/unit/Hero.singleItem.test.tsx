import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Hero from '../../src/components/Hero';
import * as useContentHooks from '../../src/hooks/useContent';
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

// Mock useHeroContent hook
vi.mock('../../src/hooks/useContent', () => ({
  useHeroContent: vi.fn(),
}));

// Mock storage
let mockSelectedHero: string | null = null;

vi.mock('../../src/lib/storage', () => ({
  getSelectedHero: vi.fn(() => mockSelectedHero),
  setSelectedHero: vi.fn((claimId: string) => {
    mockSelectedHero = claimId;
    return true;
  }),
  clearSelectedHero: vi.fn(() => {
    mockSelectedHero = null;
    return true;
  }),
}));

// Mock API
vi.mock('../../src/lib/api', () => ({
  getFavorites: vi.fn().mockResolvedValue([]),
  saveFavorite: vi.fn(),
  removeFavorite: vi.fn(),
}));

const singleHeroContent: ContentItem = {
  claim_id: 'hero-single-123',
  title: 'The Only Hero Video',
  description: 'This is the only hero video tagged with hero_trailer',
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

describe('Hero Component - Single Item Edge Case', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedHero = null;
    
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

  it('CRITICAL: renders successfully when only 1 hero video exists', async () => {
    // Mock useHeroContent to return a single item array
    vi.mocked(useContentHooks.useHeroContent).mockReturnValue({
      content: [singleHeroContent],
      loading: false,
      error: null,
      refetch: vi.fn(),
      loadMore: vi.fn(),
      hasMore: false,
    });

    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    // Should render the hero content without error
    await waitFor(() => {
      expect(screen.getByText('The Only Hero Video')).toBeInTheDocument();
    });

    expect(screen.getByText(/This is the only hero video/)).toBeInTheDocument();
  });

  it('CRITICAL: does not show error state when array length === 1', async () => {
    vi.mocked(useContentHooks.useHeroContent).mockReturnValue({
      content: [singleHeroContent],
      loading: false,
      error: null,
      refetch: vi.fn(),
      loadMore: vi.fn(),
      hasMore: false,
    });

    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('The Only Hero Video')).toBeInTheDocument();
    });

    // Should NOT show error message
    expect(screen.queryByText(/failed to load hero content/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/try again/i)).not.toBeInTheDocument();
  });

  it('CRITICAL: random selection works with single item (no crash)', async () => {
    vi.mocked(useContentHooks.useHeroContent).mockReturnValue({
      content: [singleHeroContent],
      loading: false,
      error: null,
      refetch: vi.fn(),
      loadMore: vi.fn(),
      hasMore: false,
    });

    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('The Only Hero Video')).toBeInTheDocument();
    });

    // Verify Math.floor(Math.random() * 1) = 0 works correctly
    // The component should select the only available item
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('The Only Hero Video');
  });

  it('CRITICAL: video playback initializes with single hero', async () => {
    vi.mocked(useContentHooks.useHeroContent).mockReturnValue({
      content: [singleHeroContent],
      loading: false,
      error: null,
      refetch: vi.fn(),
      loadMore: vi.fn(),
      hasMore: false,
    });

    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('The Only Hero Video')).toBeInTheDocument();
    });

    // Check that video element exists with correct attributes
    const videoElement = document.querySelector('video');
    expect(videoElement).toBeInTheDocument();
    expect(videoElement).toHaveAttribute('autoplay');
    expect(videoElement).toHaveProperty('muted', true);
    expect(videoElement).toHaveAttribute('loop');
  });

  it('CRITICAL: shuffle button triggers refetch when only 1 hero exists', async () => {
    const mockRefetch = vi.fn();
    
    vi.mocked(useContentHooks.useHeroContent).mockReturnValue({
      content: [singleHeroContent],
      loading: false,
      error: null,
      refetch: mockRefetch,
      loadMore: vi.fn(),
      hasMore: false,
    });

    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('The Only Hero Video')).toBeInTheDocument();
    });

    // Click shuffle button
    const shuffleButton = screen.getByRole('button', { name: /shuffle/i });
    shuffleButton.click();

    // Should call refetch since there's only 1 item
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('CRITICAL: all UI elements render correctly with single hero', async () => {
    vi.mocked(useContentHooks.useHeroContent).mockReturnValue({
      content: [singleHeroContent],
      loading: false,
      error: null,
      refetch: vi.fn(),
      loadMore: vi.fn(),
      hasMore: false,
    });

    render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('The Only Hero Video')).toBeInTheDocument();
    });

    // Verify all expected UI elements are present
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add.*to favorites/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /shuffle/i })).toBeInTheDocument();
    expect(screen.getByText(/120 min/)).toBeInTheDocument();
    expect(screen.getByText('HD')).toBeInTheDocument();
    expect(screen.getByText('Movie')).toBeInTheDocument();
  });

  it('CRITICAL: session persistence works with single hero', async () => {
    vi.mocked(useContentHooks.useHeroContent).mockReturnValue({
      content: [singleHeroContent],
      loading: false,
      error: null,
      refetch: vi.fn(),
      loadMore: vi.fn(),
      hasMore: false,
    });

    const { rerender } = render(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('The Only Hero Video')).toBeInTheDocument();
    });

    // Rerender to simulate navigation
    rerender(
      <BrowserRouter>
        <Hero />
      </BrowserRouter>
    );

    // Should still show the same hero
    await waitFor(() => {
      expect(screen.getByText('The Only Hero Video')).toBeInTheDocument();
    });
  });
});
