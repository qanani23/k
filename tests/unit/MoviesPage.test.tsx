import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { ContentItem } from '../../src/types';

// Create mock navigate function at module level
const mockNavigate = vi.fn();

// Mock react-router-dom before importing MoviesPage
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

import MoviesPage from '../../src/pages/MoviesPage';
import * as api from '../../src/lib/api';
import * as useContentHooks from '../../src/hooks/useContent';
import * as useDownloadManagerHook from '../../src/hooks/useDownloadManager';

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

// Mock MovieCard component
vi.mock('../../src/components/MovieCard', () => ({
  default: ({ content, onPlay, onDownload, onFavorite, isFavorite, size }: any) => (
    <div data-testid={`movie-card-${content.claim_id}`} data-size={size}>
      <div>{content.title}</div>
      <button onClick={() => onPlay(content)}>Play</button>
      <button onClick={() => onDownload(content, '720p')}>Download</button>
      <button onClick={() => onFavorite(content)}>
        {isFavorite ? 'Unfavorite' : 'Favorite'}
      </button>
    </div>
  )
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
  },
  {
    claim_id: 'movie-3',
    title: 'Romance Movie 1',
    tags: ['movie', 'romance_movies'],
    thumbnail_url: 'https://example.com/movie3.jpg',
    duration: 6000,
    release_time: Date.now() - 259200000,
    video_urls: { '720p': { url: 'https://example.com/movie3.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  }
];

const mockActionMovies: ContentItem[] = [
  {
    claim_id: 'movie-1',
    title: 'Action Movie 1',
    tags: ['movie', 'action_movies'],
    thumbnail_url: 'https://example.com/movie1.jpg',
    duration: 7200,
    release_time: Date.now() - 86400000,
    video_urls: { '720p': { url: 'https://example.com/movie1.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  }
];

describe('MoviesPage', () => {
  const mockDownloadContent = vi.fn();
  const mockLoadMore = vi.fn();
  const mockRefetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock API responses
    vi.mocked(api.getFavorites).mockResolvedValue([]);
    vi.mocked(api.saveFavorite).mockResolvedValue(undefined);
    vi.mocked(api.removeFavorite).mockResolvedValue(undefined);

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

  describe('Basic Rendering', () => {
    it('renders movies page without filter', async () => {
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: mockMovies,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Movies' })).toBeInTheDocument();
        expect(screen.getByText('3 movies available')).toBeInTheDocument();
      });
    });

    it('renders breadcrumb navigation', async () => {
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: mockMovies,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        const breadcrumb = document.querySelector('.breadcrumb');
        expect(breadcrumb).toBeInTheDocument();
        expect(breadcrumb?.textContent).toContain('Home');
        expect(breadcrumb?.textContent).toContain('Movies');
      });
    });

    it('displays movie count correctly', async () => {
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: mockMovies,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('3 movies available')).toBeInTheDocument();
      });
    });
  });

  describe('Category Filtering', () => {
    it('fetches movies with filter tag from URL', async () => {
      const mockUseMovies = vi.spyOn(useContentHooks, 'useMovies');
      mockUseMovies.mockReturnValue({
        content: mockActionMovies,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/movies?filter=action_movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      // Verify useMovies was called with the filter tag
      expect(mockUseMovies).toHaveBeenCalledWith('action_movies');

      await waitFor(() => {
        expect(screen.getByText('Action Movies')).toBeInTheDocument();
      });
    });

    it('updates breadcrumb with filter name', async () => {
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: mockActionMovies,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/movies?filter=action_movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        const breadcrumb = document.querySelector('.breadcrumb');
        expect(breadcrumb?.textContent).toContain('Movies / Action');
      });
    });

    it('shows filter buttons when filters panel is open', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: mockMovies,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      const filtersButton = screen.getByText('Filters');
      await user.click(filtersButton);

      await waitFor(() => {
        expect(screen.getByText('All Movies')).toBeInTheDocument();
        expect(screen.getByText('Comedy')).toBeInTheDocument();
        expect(screen.getByText('Action')).toBeInTheDocument();
        expect(screen.getByText('Romance')).toBeInTheDocument();
      });
    });

    it('navigates when filter is changed', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: mockMovies,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      const filtersButton = screen.getByText('Filters');
      await user.click(filtersButton);

      const actionButton = screen.getByText('Action');
      await user.click(actionButton);

      expect(mockNavigate).toHaveBeenCalledWith('/movies?filter=action_movies');
    });

    it('clears filter when All Movies is clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: mockActionMovies,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/movies?filter=action_movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      const filtersButton = screen.getByText('Filters');
      await user.click(filtersButton);

      const allMoviesButton = screen.getByText('All Movies');
      await user.click(allMoviesButton);

      expect(mockNavigate).toHaveBeenCalledWith('/movies?');
    });
  });

  describe('Content Display', () => {
    it('displays all movie cards', async () => {
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: mockMovies,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('movie-card-movie-1')).toBeInTheDocument();
        expect(screen.getByTestId('movie-card-movie-2')).toBeInTheDocument();
        expect(screen.getByTestId('movie-card-movie-3')).toBeInTheDocument();
      });
    });

    it('shows empty state when no movies found', async () => {
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: [],
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('No Movies Found')).toBeInTheDocument();
        expect(screen.getByText('No movies are currently available.')).toBeInTheDocument();
      });
    });

    it('shows filtered empty state with clear filter option', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: [],
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/movies?filter=action_movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('No action movies are currently available.')).toBeInTheDocument();
        expect(screen.getByText('View All Movies')).toBeInTheDocument();
      });

      const viewAllButton = screen.getByText('View All Movies');
      await user.click(viewAllButton);

      expect(mockNavigate).toHaveBeenCalledWith('/movies?');
    });
  });

  describe('View Mode Toggle', () => {
    it('defaults to grid view', async () => {
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: mockMovies,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        const movieCard = screen.getByTestId('movie-card-movie-1');
        expect(movieCard).toHaveAttribute('data-size', 'medium');
      });
    });

    it('switches to list view when list button clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: mockMovies,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      const listViewButton = screen.getByLabelText('List view');
      await user.click(listViewButton);

      await waitFor(() => {
        const movieCard = screen.getByTestId('movie-card-movie-1');
        expect(movieCard).toHaveAttribute('data-size', 'large');
      });
    });
  });

  describe('Loading and Error States', () => {
    it('shows loading skeleton when loading', () => {
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: [],
        loading: true,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      const skeletons = document.querySelectorAll('.loading-skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error message when error occurs', async () => {
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: [],
        loading: false,
        error: { message: 'Failed to load movies', details: new Error('Network error') },
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to load movies')).toBeInTheDocument();
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });
  });

  describe('Pagination', () => {
    it('shows load more button when hasMore is true', async () => {
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: mockMovies,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: true
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

    it('calls loadMore when Load More button clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: mockMovies,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: true
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      const loadMoreButton = screen.getByText('Load More');
      await user.click(loadMoreButton);

      expect(mockLoadMore).toHaveBeenCalled();
    });

    it('hides load more button when hasMore is false', async () => {
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: mockMovies,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByText('Load More')).not.toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('navigates to movie detail when play is clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: mockMovies,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('movie-card-movie-1')).toBeInTheDocument();
      });

      const playButton = screen.getAllByText('Play')[0];
      await user.click(playButton);

      expect(mockNavigate).toHaveBeenCalledWith('/movie/movie-1');
    });

    it('initiates download when download is clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: mockMovies,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('movie-card-movie-1')).toBeInTheDocument();
      });

      const downloadButton = screen.getAllByText('Download')[0];
      await user.click(downloadButton);

      expect(mockDownloadContent).toHaveBeenCalledWith({
        claim_id: 'movie-1',
        quality: '720p',
        url: 'https://example.com/movie1.mp4'
      });
    });

    it('toggles favorite when favorite button is clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: mockMovies,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('movie-card-movie-1')).toBeInTheDocument();
      });

      const favoriteButton = screen.getAllByText('Favorite')[0];
      await user.click(favoriteButton);

      await waitFor(() => {
        expect(api.saveFavorite).toHaveBeenCalledWith({
          claim_id: 'movie-1',
          title: 'Action Movie 1',
          thumbnail_url: 'https://example.com/movie1.jpg'
        });
      });
    });

    it('removes favorite when unfavorite is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(api.getFavorites).mockResolvedValue([
        { claim_id: 'movie-1', title: 'Action Movie 1', thumbnail_url: 'https://example.com/movie1.jpg' }
      ]);

      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: mockMovies,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Unfavorite')).toBeInTheDocument();
      });

      const unfavoriteButton = screen.getByText('Unfavorite');
      await user.click(unfavoriteButton);

      await waitFor(() => {
        expect(api.removeFavorite).toHaveBeenCalledWith('movie-1');
      });
    });
  });

  describe('Fetch in Page (Not NavBar)', () => {
    it('fetches content using useMovies hook in page component', () => {
      const mockUseMovies = vi.spyOn(useContentHooks, 'useMovies');
      mockUseMovies.mockReturnValue({
        content: mockMovies,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      // Verify that useMovies was called (fetch happens in page, not NavBar)
      expect(mockUseMovies).toHaveBeenCalled();
    });

    it('passes filter tag to useMovies when filter is present', () => {
      const mockUseMovies = vi.spyOn(useContentHooks, 'useMovies');
      mockUseMovies.mockReturnValue({
        content: mockActionMovies,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/movies?filter=comedy_movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      // Verify that useMovies was called with the filter tag
      expect(mockUseMovies).toHaveBeenCalledWith('comedy_movies');
    });

    it('fetches all movies when no filter is present', () => {
      const mockUseMovies = vi.spyOn(useContentHooks, 'useMovies');
      mockUseMovies.mockReturnValue({
        content: mockMovies,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      // Verify that useMovies was called with undefined (no filter)
      expect(mockUseMovies).toHaveBeenCalledWith(undefined);
    });
  });
});
