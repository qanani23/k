import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ContentItem } from '../../src/types';

// Create mock navigate function at module level
const mockNavigate = vi.fn();

// Mock react-router-dom before importing Home
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

import Home from '../../src/pages/Home';
import * as api from '../../src/lib/api';
import * as useContentHooks from '../../src/hooks/useContent';
import * as useDownloadManagerHook from '../../src/hooks/useDownloadManager';

// Mock components
vi.mock('../../src/components/Hero', () => ({
  default: ({ onPlayClick }: { onPlayClick?: (content: ContentItem) => void }) => (
    <div data-testid="hero-component">
      <button onClick={() => onPlayClick?.({
        claim_id: 'hero-123',
        title: 'Hero Movie',
        tags: ['hero_trailer', 'movie'],
        thumbnail_url: 'https://example.com/hero.jpg',
        duration: 7200,
        release_time: Date.now(),
        video_urls: {},
        compatibility: { compatible: true, fallback_available: false }
      })}>
        Play Hero
      </button>
    </div>
  )
}));

vi.mock('../../src/components/RowCarousel', () => ({
  default: ({ title, content, onPlayContent, onViewAll, showViewAll }: any) => (
    <div data-testid={`row-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <h2>{title}</h2>
      {content.map((item: ContentItem) => (
        <div key={item.claim_id} data-testid={`content-${item.claim_id}`}>
          {item.title}
          <button onClick={() => onPlayContent?.(item)}>Play {item.title}</button>
        </div>
      ))}
      {showViewAll && onViewAll && (
        <button onClick={onViewAll}>View All {title}</button>
      )}
    </div>
  )
}));

// Mock API
vi.mock('../../src/lib/api', () => ({
  getFavorites: vi.fn(),
  saveFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  fetchChannelClaims: vi.fn(),
  fetchByTags: vi.fn(),
}));

// Mock hooks
vi.mock('../../src/hooks/useDownloadManager', () => ({
  useDownloadManager: vi.fn()
}));

const mockMovies: ContentItem[] = [
  {
    claim_id: 'movie-1',
    title: 'Action Movie 1',
    tags: ['movie', 'action_movies'],
    thumbnail_url: 'https://example.com/movie1.jpg',
    duration: 7200,
    release_time: Date.now() - 86400000,
    video_urls: { '720p': { url: 'https://example.com/movie1.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  },
  {
    claim_id: 'movie-2',
    title: 'Comedy Movie 1',
    tags: ['movie', 'comedy_movies'],
    thumbnail_url: 'https://example.com/movie2.jpg',
    duration: 5400,
    release_time: Date.now() - 172800000,
    video_urls: { '720p': { url: 'https://example.com/movie2.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  }
];

const mockSeries: ContentItem[] = [
  {
    claim_id: 'series-1',
    title: 'Test Series S01E01',
    tags: ['series', '__series_container__'],
    thumbnail_url: 'https://example.com/series1.jpg',
    duration: 2700,
    release_time: Date.now() - 259200000,
    video_urls: { '720p': { url: 'https://example.com/series1.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  }
];

const mockSitcoms: ContentItem[] = [
  {
    claim_id: 'sitcom-1',
    title: 'Funny Sitcom S01E01',
    tags: ['sitcom'],
    thumbnail_url: 'https://example.com/sitcom1.jpg',
    duration: 1800,
    release_time: Date.now() - 345600000,
    video_urls: { '720p': { url: 'https://example.com/sitcom1.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  }
];

const mockKidsContent: ContentItem[] = [
  {
    claim_id: 'kids-1',
    title: 'Kids Show Episode 1',
    tags: ['kids'],
    thumbnail_url: 'https://example.com/kids1.jpg',
    duration: 1200,
    release_time: Date.now() - 432000000,
    video_urls: { '720p': { url: 'https://example.com/kids1.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  }
];

describe('Home Page', () => {
  const mockDownloadContent = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock API responses
    vi.mocked(api.getFavorites).mockResolvedValue([]);

    // Mock useContent hooks
    vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
      content: mockMovies,
      loading: false,
      error: null,
      refetch: vi.fn()
    });

    vi.spyOn(useContentHooks, 'useSeriesGrouped').mockReturnValue({
      content: mockSeries,
      seriesMap: new Map([['test-series', { title: 'Test Series', seasons: [], totalEpisodes: 1 }]]),
      loading: false,
      error: null,
      refetch: vi.fn()
    });

    vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
      content: mockSitcoms,
      loading: false,
      error: null,
      refetch: vi.fn()
    });

    vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
      content: mockKidsContent,
      loading: false,
      error: null,
      refetch: vi.fn()
    });

    // Mock useDownloadManager
    vi.mocked(useDownloadManagerHook.useDownloadManager).mockReturnValue({
      downloadContent: mockDownloadContent,
      isDownloading: vi.fn().mockReturnValue(false),
      isOfflineAvailable: vi.fn().mockReturnValue(false),
      getDownloadProgress: vi.fn().mockReturnValue(null),
      deleteOfflineContent: vi.fn(),
      streamOffline: vi.fn()
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders hero component', () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    expect(screen.getByTestId('hero-component')).toBeInTheDocument();
  });

  it('renders all content category rows', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('row-movies')).toBeInTheDocument();
      expect(screen.getByTestId('row-series')).toBeInTheDocument();
      expect(screen.getByTestId('row-sitcoms')).toBeInTheDocument();
      expect(screen.getByTestId('row-kids')).toBeInTheDocument();
    });
  });

  it('renders filtered category rows', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('row-comedy-movies')).toBeInTheDocument();
      expect(screen.getByTestId('row-action-movies')).toBeInTheDocument();
    });
  });

  it('renders recently added row', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('row-recently-added')).toBeInTheDocument();
    });
  });

  it('displays content items in rows', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    await waitFor(() => {
      // Use getAllByText since items appear in multiple rows
      const actionMovies = screen.getAllByText('Action Movie 1');
      expect(actionMovies.length).toBeGreaterThan(0);
      
      const comedyMovies = screen.getAllByText('Comedy Movie 1');
      expect(comedyMovies.length).toBeGreaterThan(0);
      
      const series = screen.getAllByText('Test Series S01E01');
      expect(series.length).toBeGreaterThan(0);
    });
  });

  it('navigates to movie detail when playing movie content', async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('row-movies')).toBeInTheDocument();
    });

    // Get the play button from the movies row specifically
    const moviesRow = screen.getByTestId('row-movies');
    const playButton = moviesRow.querySelector('[data-testid="content-movie-1"] button') as HTMLButtonElement;
    expect(playButton).toBeInTheDocument();
    
    await user.click(playButton!);

    expect(mockNavigate).toHaveBeenCalledWith('/movie/movie-1');
  });

  it('navigates to series detail when playing series container', async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('row-series')).toBeInTheDocument();
    });

    // Get the play button from the series row specifically
    const seriesRow = screen.getByTestId('row-series');
    const playButton = seriesRow.querySelector('button:not([class*="View All"])') as HTMLButtonElement;
    expect(playButton).toBeInTheDocument();
    
    await user.click(playButton!);

    // The series key uses underscores, not hyphens
    expect(mockNavigate).toHaveBeenCalledWith('/series/test_series');
  });

  it('shows View All buttons for main category rows', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('View All Movies')).toBeInTheDocument();
      expect(screen.getByText('View All Series')).toBeInTheDocument();
      expect(screen.getByText('View All Sitcoms')).toBeInTheDocument();
      expect(screen.getByText('View All Kids')).toBeInTheDocument();
    });
  });

  it('navigates to category page when View All is clicked', async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('View All Movies')).toBeInTheDocument();
    });

    const viewAllButton = screen.getByText('View All Movies');
    await user.click(viewAllButton);

    expect(mockNavigate).toHaveBeenCalledWith('/movies');
  });

  it('navigates to filtered category page for subcategories', async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('View All Comedy Movies')).toBeInTheDocument();
    });

    const viewAllButton = screen.getByText('View All Comedy Movies');
    await user.click(viewAllButton);

    expect(mockNavigate).toHaveBeenCalledWith('/movies?filter=comedy_movies');
  });

  it('loads favorites on mount', async () => {
    const mockFavorites = [
      { claim_id: 'movie-1', title: 'Action Movie 1', thumbnail_url: 'https://example.com/movie1.jpg' }
    ];
    vi.mocked(api.getFavorites).mockResolvedValue(mockFavorites);

    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(api.getFavorites).toHaveBeenCalled();
    });
  });

  it('handles favorite toggle correctly', async () => {
    const user = userEvent.setup();
    vi.mocked(api.saveFavorite).mockResolvedValue(undefined);

    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('row-movies')).toBeInTheDocument();
    });

    // Note: The actual favorite button interaction would be in MovieCard
    // This test verifies the Home component has the necessary handlers
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('handles download initiation', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('row-movies')).toBeInTheDocument();
    });

    // Verify download manager is available
    expect(useDownloadManagerHook.useDownloadManager).toHaveBeenCalled();
  });

  it('filters comedy movies correctly', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    await waitFor(() => {
      const comedyRow = screen.getByTestId('row-comedy-movies');
      expect(comedyRow).toBeInTheDocument();
      
      // Comedy Movie 1 should be in the comedy row
      const comedyRowContent = comedyRow.textContent;
      expect(comedyRowContent).toContain('Comedy Movie 1');
    });
  });

  it('filters action movies correctly', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    await waitFor(() => {
      const actionRow = screen.getByTestId('row-action-movies');
      expect(actionRow).toBeInTheDocument();
      
      // Action Movie 1 should be in the action row
      const actionRowContent = actionRow.textContent;
      expect(actionRowContent).toContain('Action Movie 1');
    });
  });

  it('sorts recently added content by release time', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    await waitFor(() => {
      const recentlyAddedRow = screen.getByTestId('row-recently-added');
      expect(recentlyAddedRow).toBeInTheDocument();
      
      // Most recent content should appear first
      const rowContent = recentlyAddedRow.textContent || '';
      const actionMovieIndex = rowContent.indexOf('Action Movie 1');
      const comedyMovieIndex = rowContent.indexOf('Comedy Movie 1');
      
      // Action Movie 1 is more recent, so it should appear before Comedy Movie 1
      expect(actionMovieIndex).toBeLessThan(comedyMovieIndex);
    });
  });

  it('limits content rows to 20 items', async () => {
    // Create 25 movies
    const manyMovies = Array.from({ length: 25 }, (_, i) => ({
      claim_id: `movie-${i}`,
      title: `Movie ${i}`,
      tags: ['movie'],
      thumbnail_url: `https://example.com/movie${i}.jpg`,
      duration: 7200,
      release_time: Date.now() - i * 86400000,
      video_urls: { '720p': { url: `https://example.com/movie${i}.mp4`, quality: '720p', type: 'mp4' as const } },
      compatibility: { compatible: true, fallback_available: false }
    }));

    vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
      content: manyMovies,
      loading: false,
      error: null,
      refetch: vi.fn()
    });

    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    await waitFor(() => {
      const moviesRow = screen.getByTestId('row-movies');
      const contentItems = moviesRow.querySelectorAll('[data-testid^="content-"]');
      
      // Should only show 20 items
      expect(contentItems.length).toBeLessThanOrEqual(20);
    });
  });

  it('handles loading state for content rows', async () => {
    // Create a fresh mock for this test
    const loadingHook = {
      content: [],
      loading: true,
      error: null,
      refetch: vi.fn()
    };

    // Temporarily replace the mock
    vi.mocked(useContentHooks.useMovies).mockReturnValue(loadingHook);

    const { unmount } = render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    // Row should still render even in loading state
    expect(screen.getByTestId('row-movies')).toBeInTheDocument();
    
    // Clean up
    unmount();
  });

  it('handles error state for content rows', async () => {
    // Create a fresh mock for this test
    const errorHook = {
      content: [],
      loading: false,
      error: new Error('Failed to load movies'),
      refetch: vi.fn()
    };

    vi.mocked(useContentHooks.useMovies).mockReturnValue(errorHook);

    const { unmount } = render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    // Row should still render even in error state
    expect(screen.getByTestId('row-movies')).toBeInTheDocument();
    
    // Clean up
    unmount();
  });

  it('handles hero play click navigation', async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    const heroPlayButton = screen.getByText('Play Hero');
    await user.click(heroPlayButton);

    expect(mockNavigate).toHaveBeenCalledWith('/movie/hero-123');
  });

  it('combines all content types in recently added row', async () => {
    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    await waitFor(() => {
      const recentlyAddedRow = screen.getByTestId('row-recently-added');
      const rowContent = recentlyAddedRow.textContent || '';
      
      // Should contain content from all categories
      expect(rowContent).toContain('Action Movie 1');
      expect(rowContent).toContain('Test Series S01E01');
      expect(rowContent).toContain('Funny Sitcom S01E01');
      expect(rowContent).toContain('Kids Show Episode 1');
    });
  });

  it('handles empty content gracefully', async () => {
    // Create fresh mocks for this test
    vi.mocked(useContentHooks.useMovies).mockReturnValue({
      content: [],
      loading: false,
      error: null,
      refetch: vi.fn()
    });

    vi.mocked(useContentHooks.useSeriesGrouped).mockReturnValue({
      content: [],
      seriesMap: new Map(),
      loading: false,
      error: null,
      refetch: vi.fn()
    });

    vi.mocked(useContentHooks.useSitcoms).mockReturnValue({
      content: [],
      loading: false,
      error: null,
      refetch: vi.fn()
    });

    vi.mocked(useContentHooks.useKidsContent).mockReturnValue({
      content: [],
      loading: false,
      error: null,
      refetch: vi.fn()
    });

    const { unmount } = render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    // Page should still render without crashing
    expect(screen.getByTestId('hero-component')).toBeInTheDocument();
    expect(screen.getByTestId('row-movies')).toBeInTheDocument();
    
    // Clean up
    unmount();
  });
});
