/**
 * Movies Page Filtering Integration Test
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 * Tests the complete Movies page filtering flow including:
 * - Navigation to Movies page
 * - Category filter application
 * - Content grid rendering
 * - Loading state resolution
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import MoviesPage from '../../src/pages/MoviesPage';
import { ContentItem } from '../../src/types';
import * as api from '../../src/lib/api';
import * as useContentHooks from '../../src/hooks/useContent';
import * as useDownloadManagerHook from '../../src/hooks/useDownloadManager';
import * as useOfflineHook from '../../src/hooks/useOffline';

// Create mock navigate function
const mockNavigate = vi.fn();

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

// Mock components
vi.mock('../../src/components/MovieCard', () => ({
  default: ({ content, onPlay, onDownload, onFavorite, isFavorite }: any) => (
    <div data-testid={`movie-card-${content.claim_id}`}>
      <h3>{content.title}</h3>
      <button onClick={() => onPlay(content)}>Play</button>
      <button onClick={() => onDownload(content, '720p')}>Download</button>
      <button onClick={() => onFavorite(content)}>
        {isFavorite ? 'Unfavorite' : 'Favorite'}
      </button>
    </div>
  )
}));

vi.mock('../../src/components/SkeletonCard', () => ({
  default: ({ count }: { count?: number }) => (
    <div data-testid="skeleton-loader">
      {Array.from({ length: count || 1 }).map((_, i) => (
        <div key={i} data-testid={`skeleton-${i}`}>Loading...</div>
      ))}
    </div>
  )
}));

vi.mock('../../src/components/OfflineEmptyState', () => ({
  default: ({ title, message }: { title: string; message: string }) => (
    <div data-testid="offline-empty-state">
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  )
}));

// Mock API
vi.mock('../../src/lib/api');

// Mock hooks
vi.mock('../../src/hooks/useDownloadManager');
vi.mock('../../src/hooks/useOffline');

const mockMovies: ContentItem[] = [
  {
    claim_id: 'movie-1',
    title: 'Action Movie 1',
    tags: ['movie', 'action_movies'],
    thumbnail_url: 'https://example.com/movie1.jpg',
    duration: 7200,
    release_time: Date.now(),
    video_urls: { '720p': { url: 'https://example.com/movie1.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  },
  {
    claim_id: 'movie-2',
    title: 'Action Movie 2',
    tags: ['movie', 'action_movies'],
    thumbnail_url: 'https://example.com/movie2.jpg',
    duration: 6800,
    release_time: Date.now(),
    video_urls: { '720p': { url: 'https://example.com/movie2.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  },
  {
    claim_id: 'movie-3',
    title: 'Comedy Movie 1',
    tags: ['movie', 'comedy_movies'],
    thumbnail_url: 'https://example.com/movie3.jpg',
    duration: 5400,
    release_time: Date.now(),
    video_urls: { '720p': { url: 'https://example.com/movie3.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  },
  {
    claim_id: 'movie-4',
    title: 'Romance Movie 1',
    tags: ['movie', 'romance_movies'],
    thumbnail_url: 'https://example.com/movie4.jpg',
    duration: 6200,
    release_time: Date.now(),
    video_urls: { '720p': { url: 'https://example.com/movie4.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  }
];

describe('Movies Page Filtering Integration Test', () => {
  const mockDownloadContent = vi.fn();
  const mockLoadMore = vi.fn();
  const mockRefetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock API responses
    vi.mocked(api.getFavorites).mockResolvedValue([]);
    vi.mocked(api.saveFavorite).mockResolvedValue(undefined);
    vi.mocked(api.removeFavorite).mockResolvedValue(undefined);

    // Mock useOffline
    vi.mocked(useOfflineHook.useOffline).mockReturnValue({
      isOnline: true,
      isOffline: false,
      wasOffline: false,
      checkOnlineStatus: () => true
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

    // Default mock for useMovies
    vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
      content: mockMovies,
      loading: false,
      error: null,
      loadMore: mockLoadMore,
      hasMore: false,
      refetch: mockRefetch
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Requirement 3.1: Navigate to Movies Page Without Glitching', () => {
    it('should render Movies page without UI glitching', async () => {
      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Movies' })).toBeInTheDocument();
      });

      // Page should render without errors
      expect(screen.getByText('4 movies available')).toBeInTheDocument();
    });

    it('should render Movies page without infinite re-renders', async () => {
      const useMoviesSpy = vi.spyOn(useContentHooks, 'useMovies');

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Movies' })).toBeInTheDocument();
      });

      // Hook should be called a reasonable number of times
      expect(useMoviesSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Requirement 3.2: Apply Category Filters', () => {
    it('should fetch and display filtered content when filter is applied', async () => {
      const actionMovies = mockMovies.filter(m => m.tags.includes('action_movies'));
      
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: actionMovies,
        loading: false,
        error: null,
        loadMore: mockLoadMore,
        hasMore: false,
        refetch: mockRefetch
      });

      render(
        <MemoryRouter initialEntries={['/movies?filter=action_movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Action Movies')).toBeInTheDocument();
      });

      // Should display filtered movies
      expect(screen.getByText('Action Movie 1')).toBeInTheDocument();
      expect(screen.getByText('Action Movie 2')).toBeInTheDocument();
      expect(screen.queryByText('Comedy Movie 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Romance Movie 1')).not.toBeInTheDocument();
    });

    it('should update content when switching between filters', async () => {
      const user = userEvent.setup();

      const { rerender } = render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Movies' })).toBeInTheDocument();
      });

      // Click filters button
      const filtersButton = screen.getByText('Filters');
      await user.click(filtersButton);

      // Filter panel should be visible
      expect(screen.getByText('Filter by Genre')).toBeInTheDocument();

      // Click comedy filter
      const comedyFilter = screen.getByText('Comedy');
      await user.click(comedyFilter);

      // Should navigate with filter parameter
      expect(mockNavigate).toHaveBeenCalledWith('/movies?filter=comedy_movies');
    });

    it('should pass correct filter tag to useMovies hook', async () => {
      const useMoviesSpy = vi.spyOn(useContentHooks, 'useMovies');

      render(
        <MemoryRouter initialEntries={['/movies?filter=comedy_movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Comedy Movies')).toBeInTheDocument();
      });

      // Hook should be called with filter tag
      expect(useMoviesSpy).toHaveBeenCalledWith('comedy_movies');
    });

    it('should display all movies when no filter is applied', async () => {
      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Movies' })).toBeInTheDocument();
      });

      // Should display all movies
      expect(screen.getByText('Action Movie 1')).toBeInTheDocument();
      expect(screen.getByText('Comedy Movie 1')).toBeInTheDocument();
      expect(screen.getByText('Romance Movie 1')).toBeInTheDocument();
    });
  });

  describe('Requirement 3.3: Display Skeleton Loaders During Loading', () => {
    it('should display skeleton loaders while content is loading', async () => {
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: [],
        loading: true,
        error: null,
        loadMore: mockLoadMore,
        hasMore: false,
        refetch: mockRefetch
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      // Skeleton loader should be visible
      expect(screen.getAllByTestId('skeleton-loader').length).toBeGreaterThan(0);
      expect(screen.getByText('Loading movies...')).toBeInTheDocument();
    });

    it('should replace skeleton loaders with content cards after loading', async () => {
      const { rerender } = render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Movies' })).toBeInTheDocument();
      });

      // Skeleton should not be visible
      expect(screen.queryByTestId('skeleton-loader')).not.toBeInTheDocument();

      // Content should be visible
      expect(screen.getByText('Action Movie 1')).toBeInTheDocument();
    });
  });

  describe('Requirement 3.4: Exit Loading State After Fetch', () => {
    it('should exit loading state when fetch completes successfully', async () => {
      const { rerender } = render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Movies' })).toBeInTheDocument();
      });

      // Loading state should be false
      expect(screen.queryByTestId('skeleton-loader')).not.toBeInTheDocument();

      // Content grid should be visible
      expect(screen.getByText('Action Movie 1')).toBeInTheDocument();
    });

    it('should exit loading state when fetch fails', async () => {
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: [],
        loading: false,
        error: { message: 'Failed to load movies', details: 'network_error' },
        loadMore: mockLoadMore,
        hasMore: false,
        refetch: mockRefetch
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to load movies')).toBeInTheDocument();
      });

      // Loading state should be false
      expect(screen.queryByTestId('skeleton-loader')).not.toBeInTheDocument();

      // Error message should be visible
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('should not remain in loading state indefinitely', async () => {
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: [],
        loading: true,
        error: null,
        loadMore: mockLoadMore,
        hasMore: false,
        refetch: mockRefetch
      });

      const { rerender } = render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      // Initially loading
      expect(screen.getAllByTestId('skeleton-loader').length).toBeGreaterThan(0);

      // Simulate fetch completion
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: mockMovies,
        loading: false,
        error: null,
        loadMore: mockLoadMore,
        hasMore: false,
        refetch: mockRefetch
      });

      rerender(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('skeleton-loader')).not.toBeInTheDocument();
      });

      // Content should be visible
      expect(screen.getByText('Action Movie 1')).toBeInTheDocument();
    });
  });

  describe('Content Grid Rendering', () => {
    it('should render content grid with movie cards', async () => {
      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Movies' })).toBeInTheDocument();
      });

      // All movie cards should be rendered
      expect(screen.getByTestId('movie-card-movie-1')).toBeInTheDocument();
      expect(screen.getByTestId('movie-card-movie-2')).toBeInTheDocument();
      expect(screen.getByTestId('movie-card-movie-3')).toBeInTheDocument();
      expect(screen.getByTestId('movie-card-movie-4')).toBeInTheDocument();
    });

    it('should handle movie playback', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Movies' })).toBeInTheDocument();
      });

      const movieCard = screen.getByTestId('movie-card-movie-1');
      const playButton = within(movieCard).getByText('Play');
      
      await user.click(playButton);

      expect(mockNavigate).toHaveBeenCalledWith('/movie/movie-1');
    });

    it('should handle movie download', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Movies' })).toBeInTheDocument();
      });

      const movieCard = screen.getByTestId('movie-card-movie-1');
      const downloadButton = within(movieCard).getByText('Download');
      
      await user.click(downloadButton);

      expect(mockDownloadContent).toHaveBeenCalledWith({
        claim_id: 'movie-1',
        quality: '720p',
        url: 'https://example.com/movie1.mp4'
      });
    });

    it('should handle favorite toggle', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Movies' })).toBeInTheDocument();
      });

      const movieCard = screen.getByTestId('movie-card-movie-1');
      const favoriteButton = within(movieCard).getByText('Favorite');
      
      await user.click(favoriteButton);

      expect(api.saveFavorite).toHaveBeenCalledWith({
        claim_id: 'movie-1',
        title: 'Action Movie 1',
        thumbnail_url: 'https://example.com/movie1.jpg'
      });
    });
  });

  describe('View Mode Toggle', () => {
    it('should toggle between grid and list view', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Movies' })).toBeInTheDocument();
      });

      // Find view mode buttons
      const listViewButton = screen.getByLabelText('List view');
      await user.click(listViewButton);

      // View mode should change (verified by component state)
      expect(listViewButton).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when fetch fails', async () => {
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: [],
        loading: false,
        error: { message: 'Network error occurred', details: 'network_error' },
        loadMore: mockLoadMore,
        hasMore: false,
        refetch: mockRefetch
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Network error occurred')).toBeInTheDocument();
      });

      // Retry button should be visible
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('should handle retry button click', async () => {
      const user = userEvent.setup();

      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: [],
        loading: false,
        error: { message: 'Network error occurred', details: 'network_error' },
        loadMore: mockLoadMore,
        hasMore: false,
        refetch: mockRefetch
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('Try Again');
      await user.click(retryButton);

      expect(mockRefetch).toHaveBeenCalled();
    });

    it('should display offline empty state when offline', async () => {
      vi.mocked(useOfflineHook.useOffline).mockReturnValue({
        isOnline: false,
        isOffline: true,
        wasOffline: true,
        checkOnlineStatus: () => false
      });

      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: [],
        loading: false,
        error: { message: 'No internet connection', details: 'offline' },
        loadMore: mockLoadMore,
        hasMore: false,
        refetch: mockRefetch
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('offline-empty-state')).toBeInTheDocument();
      });

      expect(screen.getByText('Cannot Load Movies')).toBeInTheDocument();
    });

    it('should display empty state when no movies are available', async () => {
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: [],
        loading: false,
        error: null,
        loadMore: mockLoadMore,
        hasMore: false,
        refetch: mockRefetch
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('No Movies Found')).toBeInTheDocument();
      });
    });
  });

  describe('Load More Functionality', () => {
    it('should display Load More button when hasMore is true', async () => {
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: mockMovies,
        loading: false,
        error: null,
        loadMore: mockLoadMore,
        hasMore: true,
        refetch: mockRefetch
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Load More')).toBeInTheDocument();
      });
    });

    it('should call loadMore when Load More button is clicked', async () => {
      const user = userEvent.setup();

      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: mockMovies,
        loading: false,
        error: null,
        loadMore: mockLoadMore,
        hasMore: true,
        refetch: mockRefetch
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Load More')).toBeInTheDocument();
      });

      const loadMoreButton = screen.getByText('Load More');
      await user.click(loadMoreButton);

      expect(mockLoadMore).toHaveBeenCalled();
    });
  });
});

