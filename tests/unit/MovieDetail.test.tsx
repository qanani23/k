import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ContentItem } from '../../src/types';

// Mock react-router-dom
const mockParams = { claimId: 'movie-1' };
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => mockParams
  };
});

import MovieDetail from '../../src/pages/MovieDetail';
import * as api from '../../src/lib/api';
import * as useDownloadManagerHook from '../../src/hooks/useDownloadManager';

// Mock API
vi.mock('../../src/lib/api', () => ({
  resolveClaim: vi.fn(),
  fetchRelatedContent: vi.fn(),
  saveFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  isFavorite: vi.fn(),
}));

// Mock hooks
vi.mock('../../src/hooks/useDownloadManager', () => ({
  useDownloadManager: vi.fn()
}));

// Mock RowCarousel component
vi.mock('../../src/components/RowCarousel', () => ({
  default: ({ title, content, loading, onPlayContent, onDownloadContent }: any) => (
    <div data-testid="row-carousel">
      <h3>{title}</h3>
      {loading && <div>Loading related...</div>}
      {content.map((item: ContentItem) => (
        <div key={item.claim_id} data-testid={`related-${item.claim_id}`}>
          <div>{item.title}</div>
          <button onClick={() => onPlayContent(item)}>Play</button>
          <button onClick={() => onDownloadContent(item, '720p')}>Download</button>
        </div>
      ))}
    </div>
  )
}));

const mockMovie: ContentItem = {
  claim_id: 'movie-1',
  title: 'Test Action Movie',
  description: 'An exciting action movie',
  tags: ['movie', 'action_movies'],
  thumbnail_url: 'https://example.com/movie1.jpg',
  duration: 7200,
  release_time: Date.now() - 86400000,
  video_urls: { 
    '720p': { url: 'https://example.com/movie1-720p.mp4', quality: '720p', type: 'mp4' },
    '1080p': { url: 'https://example.com/movie1-1080p.mp4', quality: '1080p', type: 'mp4' }
  },
  compatibility: { compatible: true, fallback_available: false }
};

const mockRelatedMovies: ContentItem[] = [
  {
    claim_id: 'movie-2',
    title: 'Related Action Movie 1',
    tags: ['movie', 'action_movies'],
    thumbnail_url: 'https://example.com/movie2.jpg',
    duration: 6000,
    release_time: Date.now() - 172800000,
    video_urls: { '720p': { url: 'https://example.com/movie2.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  },
  {
    claim_id: 'movie-3',
    title: 'Related Action Movie 2',
    tags: ['movie', 'action_movies'],
    thumbnail_url: 'https://example.com/movie3.jpg',
    duration: 5400,
    release_time: Date.now() - 259200000,
    video_urls: { '720p': { url: 'https://example.com/movie3.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  }
];

describe('MovieDetail', () => {
  const mockDownloadContent = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock API responses
    vi.mocked(api.resolveClaim).mockResolvedValue(mockMovie);
    vi.mocked(api.fetchRelatedContent).mockResolvedValue(mockRelatedMovies);
    vi.mocked(api.isFavorite).mockResolvedValue(false);
    vi.mocked(api.saveFavorite).mockResolvedValue(undefined);
    vi.mocked(api.removeFavorite).mockResolvedValue(undefined);

    // Mock useDownloadManager
    vi.mocked(useDownloadManagerHook.useDownloadManager).mockReturnValue({
      downloadContent: mockDownloadContent,
      isDownloading: vi.fn().mockReturnValue(false),
      isOfflineAvailable: vi.fn().mockReturnValue(false),
      getDownloadProgress: vi.fn().mockReturnValue(null),
      offlineContent: [],
      downloads: [],
      streamOffline: vi.fn(),
      cancelDownload: vi.fn()
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders movie detail page with movie information', async () => {
      render(
        <MemoryRouter>
          <MovieDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Action Movie')).toBeInTheDocument();
        expect(screen.getByText('An exciting action movie')).toBeInTheDocument();
      });
    });

    it('displays movie thumbnail', async () => {
      render(
        <MemoryRouter>
          <MovieDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        const thumbnail = screen.getByAltText('Test Action Movie');
        expect(thumbnail).toBeInTheDocument();
        expect(thumbnail).toHaveAttribute('src', 'https://example.com/movie1.jpg');
      });
    });

    it('displays movie duration', async () => {
      render(
        <MemoryRouter>
          <MovieDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('120m')).toBeInTheDocument();
      });
    });

    it('displays movie tags', async () => {
      render(
        <MemoryRouter>
          <MovieDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('movie')).toBeInTheDocument();
        expect(screen.getByText('action_movies')).toBeInTheDocument();
      });
    });
  });

  describe('Related Content', () => {
    it('fetches and displays related content', async () => {
      render(
        <MemoryRouter>
          <MovieDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.fetchRelatedContent).toHaveBeenCalledWith('action_movies', 'movie-1', 10);
      });

      await waitFor(() => {
        expect(screen.getByText('You may also like')).toBeInTheDocument();
        expect(screen.getByTestId('related-movie-2')).toBeInTheDocument();
        expect(screen.getByTestId('related-movie-3')).toBeInTheDocument();
      });
    });

    it('excludes current movie from related content', async () => {
      render(
        <MemoryRouter>
          <MovieDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.fetchRelatedContent).toHaveBeenCalledWith('action_movies', 'movie-1', 10);
      });

      await waitFor(() => {
        expect(screen.queryByTestId('related-movie-1')).not.toBeInTheDocument();
      });
    });

    it('uses category tag for related content fetch', async () => {
      render(
        <MemoryRouter>
          <MovieDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.fetchRelatedContent).toHaveBeenCalledWith('action_movies', 'movie-1', 10);
      });
    });

    it('handles related content fetch failure gracefully', async () => {
      vi.mocked(api.fetchRelatedContent).mockRejectedValue(new Error('Network error'));

      render(
        <MemoryRouter>
          <MovieDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Action Movie')).toBeInTheDocument();
      });

      // Should not show related content section
      expect(screen.queryByText('You may also like')).not.toBeInTheDocument();
    });

    it('does not show related content section when no related items', async () => {
      vi.mocked(api.fetchRelatedContent).mockResolvedValue([]);

      render(
        <MemoryRouter>
          <MovieDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Action Movie')).toBeInTheDocument();
      });

      expect(screen.queryByText('You may also like')).not.toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('handles download button click', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <MovieDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Action Movie')).toBeInTheDocument();
      });

      // Find the main download button (not the ones in related content)
      const downloadButtons = screen.getAllByText('Download');
      const mainDownloadButton = downloadButtons[0]; // First one is the main movie download button
      await user.click(mainDownloadButton);

      expect(mockDownloadContent).toHaveBeenCalledWith({
        claim_id: 'movie-1',
        quality: '720p',
        url: 'https://example.com/movie1-720p.mp4'
      });
    });

    it('toggles favorite status when favorite button clicked', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <MovieDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        const favoriteButton = screen.getByLabelText('Add to favorites');
        expect(favoriteButton).toBeInTheDocument();
      });

      const favoriteButton = screen.getByLabelText('Add to favorites');
      await user.click(favoriteButton);

      await waitFor(() => {
        expect(api.saveFavorite).toHaveBeenCalledWith({
          claim_id: 'movie-1',
          title: 'Test Action Movie',
          thumbnail_url: 'https://example.com/movie1.jpg'
        });
      });
    });

    it('removes favorite when already favorited', async () => {
      const user = userEvent.setup();
      vi.mocked(api.isFavorite).mockResolvedValue(true);

      render(
        <MemoryRouter>
          <MovieDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        const favoriteButton = screen.getByLabelText('Remove from favorites');
        expect(favoriteButton).toBeInTheDocument();
      });

      const favoriteButton = screen.getByLabelText('Remove from favorites');
      await user.click(favoriteButton);

      await waitFor(() => {
        expect(api.removeFavorite).toHaveBeenCalledWith('movie-1');
      });
    });
  });

  describe('Loading and Error States', () => {
    it('shows loading skeleton while loading', () => {
      vi.mocked(api.resolveClaim).mockImplementation(() => new Promise(() => {}));

      render(
        <MemoryRouter>
          <MovieDetail />
        </MemoryRouter>
      );

      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error message when movie fails to load', async () => {
      vi.mocked(api.resolveClaim).mockRejectedValue(new Error('Failed to load movie'));

      render(
        <MemoryRouter>
          <MovieDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Error Loading Movie')).toBeInTheDocument();
        expect(screen.getByText('Failed to load movie')).toBeInTheDocument();
      });
    });

    it('shows error when movie not found', async () => {
      vi.mocked(api.resolveClaim).mockRejectedValue(new Error('Movie not found'));

      render(
        <MemoryRouter>
          <MovieDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Movie not found')).toBeInTheDocument();
      });
    });
  });

  describe('Compatibility Warnings', () => {
    it('shows compatibility warning for incompatible content', async () => {
      const incompatibleMovie = {
        ...mockMovie,
        compatibility: {
          compatible: false,
          reason: 'Codec not supported',
          fallback_available: true
        }
      };
      vi.mocked(api.resolveClaim).mockResolvedValue(incompatibleMovie);

      render(
        <MemoryRouter>
          <MovieDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/This video may not play on your platform/)).toBeInTheDocument();
        expect(screen.getByText(/Codec not supported/)).toBeInTheDocument();
      });
    });

    it('shows external player option when fallback available', async () => {
      const incompatibleMovie = {
        ...mockMovie,
        compatibility: {
          compatible: false,
          reason: 'Codec not supported',
          fallback_available: true
        }
      };
      vi.mocked(api.resolveClaim).mockResolvedValue(incompatibleMovie);

      render(
        <MemoryRouter>
          <MovieDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Play via external player')).toBeInTheDocument();
      });
    });

    it('does not show compatibility warning for compatible content', async () => {
      render(
        <MemoryRouter>
          <MovieDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Action Movie')).toBeInTheDocument();
      });

      expect(screen.queryByText(/This video may not play on your platform/)).not.toBeInTheDocument();
    });
  });
});
