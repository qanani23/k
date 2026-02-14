import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ContentItem } from '../../src/types';

// Create mock navigate function at module level
const mockNavigate = vi.fn();

// Mock react-router-dom before importing SitcomsPage
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

import SitcomsPage from '../../src/pages/SitcomsPage';
import * as api from '../../src/lib/api';
import * as useContentHooks from '../../src/hooks/useContent';
import * as useDownloadManagerHook from '../../src/hooks/useDownloadManager';
import * as useOfflineHook from '../../src/hooks/useOffline';

// Mock API
vi.mock('../../src/lib/api', () => ({
  getFavorites: vi.fn(),
  saveFavorite: vi.fn(),
  removeFavorite: vi.fn(),
}));

// Mock hooks
vi.mock('../../src/hooks/useDownloadManager', () => ({
  useDownloadManager: vi.fn()
}));

vi.mock('../../src/hooks/useOffline', () => ({
  useOffline: vi.fn()
}));

// Mock MovieCard component
vi.mock('../../src/components/MovieCard', () => ({
  default: ({ content, onPlay, onDownload, onFavorite, isFavorite, size }: any) => (
    <div data-testid={`sitcom-card-${content.claim_id}`} data-size={size}>
      <div>{content.title}</div>
      <button onClick={() => onPlay(content)}>Play</button>
      <button onClick={() => onDownload(content, '720p')}>Download</button>
      <button onClick={() => onFavorite(content)}>
        {isFavorite ? 'Unfavorite' : 'Favorite'}
      </button>
    </div>
  )
}));

const mockSitcoms: ContentItem[] = [
  {
    claim_id: 'sitcom-1',
    title: 'Funny Sitcom 1',
    tags: ['sitcom', 'comedy'],
    thumbnail_url: 'https://example.com/sitcom1.jpg',
    duration: 1800,
    release_time: Date.now() - 86400000,
    video_urls: { '720p': { url: 'https://example.com/sitcom1.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  },
  {
    claim_id: 'sitcom-2',
    title: 'Funny Sitcom 2',
    tags: ['sitcom', 'comedy'],
    thumbnail_url: 'https://example.com/sitcom2.jpg',
    duration: 1800,
    release_time: Date.now() - 172800000,
    video_urls: { '720p': { url: 'https://example.com/sitcom2.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  },
  {
    claim_id: 'sitcom-3',
    title: 'Funny Sitcom 3',
    tags: ['sitcom', 'comedy'],
    thumbnail_url: 'https://example.com/sitcom3.jpg',
    duration: 1800,
    release_time: Date.now() - 259200000,
    video_urls: { '720p': { url: 'https://example.com/sitcom3.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  }
];

describe('SitcomsPage', () => {
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

    // Mock useOffline - default to online
    vi.mocked(useOfflineHook.useOffline).mockReturnValue({
      isOnline: true,
      isOffline: false,
      wasOffline: false
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders sitcoms page without errors', async () => {
      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: mockSitcoms,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Sitcoms' })).toBeInTheDocument();
        expect(screen.getByText('3 sitcoms available')).toBeInTheDocument();
      });
    });

    it('renders breadcrumb navigation', async () => {
      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: mockSitcoms,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        const breadcrumb = document.querySelector('.breadcrumb');
        expect(breadcrumb).toBeInTheDocument();
        expect(breadcrumb?.textContent).toContain('Home');
        expect(breadcrumb?.textContent).toContain('Sitcoms');
      });
    });

    it('displays sitcom count correctly', async () => {
      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: mockSitcoms,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('3 sitcoms available')).toBeInTheDocument();
      });
    });

    it('displays singular form for single sitcom', async () => {
      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: [mockSitcoms[0]],
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('1 sitcom available')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation to /sitcoms Route', () => {
    it('renders correctly when navigating to /sitcoms route', async () => {
      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: mockSitcoms,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Sitcoms' })).toBeInTheDocument();
      });
    });

    it('fetches content using useSitcoms hook', () => {
      const mockUseSitcoms = vi.spyOn(useContentHooks, 'useSitcoms');
      mockUseSitcoms.mockReturnValue({
        content: mockSitcoms,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      // Verify that useSitcoms was called (fetch happens in page)
      expect(mockUseSitcoms).toHaveBeenCalled();
    });
  });

  describe('Content Fetching with sitcom Tag', () => {
    it('fetches content with sitcom tag through useSitcoms hook', () => {
      const mockUseSitcoms = vi.spyOn(useContentHooks, 'useSitcoms');
      mockUseSitcoms.mockReturnValue({
        content: mockSitcoms,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      // Verify useSitcoms hook is called (which internally uses 'sitcom' tag)
      expect(mockUseSitcoms).toHaveBeenCalled();
    });

    it('displays sitcom content items', async () => {
      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: mockSitcoms,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Funny Sitcom 1')).toBeInTheDocument();
        expect(screen.getByText('Funny Sitcom 2')).toBeInTheDocument();
        expect(screen.getByText('Funny Sitcom 3')).toBeInTheDocument();
      });
    });
  });

  describe('Grid Layout Rendering', () => {
    it('displays all sitcom cards in grid layout', async () => {
      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: mockSitcoms,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('sitcom-card-sitcom-1')).toBeInTheDocument();
        expect(screen.getByTestId('sitcom-card-sitcom-2')).toBeInTheDocument();
        expect(screen.getByTestId('sitcom-card-sitcom-3')).toBeInTheDocument();
      });
    });

    it('defaults to grid view with medium size cards', async () => {
      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: mockSitcoms,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        const sitcomCard = screen.getByTestId('sitcom-card-sitcom-1');
        expect(sitcomCard).toHaveAttribute('data-size', 'medium');
      });
    });

    it('renders grid container with content-grid class', async () => {
      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: mockSitcoms,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        const gridContainer = document.querySelector('.content-grid');
        expect(gridContainer).toBeInTheDocument();
      });
    });
  });

  describe('View Mode Toggle', () => {
    it('switches to list view when list button clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: mockSitcoms,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      const listViewButton = screen.getByLabelText('List view');
      await user.click(listViewButton);

      await waitFor(() => {
        const sitcomCard = screen.getByTestId('sitcom-card-sitcom-1');
        expect(sitcomCard).toHaveAttribute('data-size', 'large');
      });
    });

    it('switches back to grid view when grid button clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: mockSitcoms,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      // Switch to list view first
      const listViewButton = screen.getByLabelText('List view');
      await user.click(listViewButton);

      // Switch back to grid view
      const gridViewButton = screen.getByLabelText('Grid view');
      await user.click(gridViewButton);

      await waitFor(() => {
        const sitcomCard = screen.getByTestId('sitcom-card-sitcom-1');
        expect(sitcomCard).toHaveAttribute('data-size', 'medium');
      });
    });
  });

  describe('Loading and Error States', () => {
    it('shows loading skeleton when loading', () => {
      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: [],
        loading: true,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      const skeletons = document.querySelectorAll('.loading-skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error message when error occurs', async () => {
      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: [],
        loading: false,
        error: { message: 'Failed to load sitcoms', details: new Error('Network error') },
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to load sitcoms')).toBeInTheDocument();
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });

    it('shows empty state when no sitcoms found', async () => {
      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: [],
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('No Sitcoms Found')).toBeInTheDocument();
        expect(screen.getByText('No sitcoms are currently available.')).toBeInTheDocument();
      });
    });
  });

  describe('Pagination', () => {
    it('shows load more button when hasMore is true', async () => {
      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: mockSitcoms,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: true
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Load More')).toBeInTheDocument();
      });
    });

    it('calls loadMore when Load More button clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: mockSitcoms,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: true
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      const loadMoreButton = screen.getByText('Load More');
      await user.click(loadMoreButton);

      expect(mockLoadMore).toHaveBeenCalled();
    });

    it('hides load more button when hasMore is false', async () => {
      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: mockSitcoms,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByText('Load More')).not.toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('navigates to sitcom detail when play is clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: mockSitcoms,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('sitcom-card-sitcom-1')).toBeInTheDocument();
      });

      const playButton = screen.getAllByText('Play')[0];
      await user.click(playButton);

      expect(mockNavigate).toHaveBeenCalledWith('/movie/sitcom-1');
    });

    it('initiates download when download is clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: mockSitcoms,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('sitcom-card-sitcom-1')).toBeInTheDocument();
      });

      const downloadButton = screen.getAllByText('Download')[0];
      await user.click(downloadButton);

      expect(mockDownloadContent).toHaveBeenCalledWith({
        claim_id: 'sitcom-1',
        quality: '720p',
        url: 'https://example.com/sitcom1.mp4'
      });
    });

    it('toggles favorite when favorite button is clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: mockSitcoms,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('sitcom-card-sitcom-1')).toBeInTheDocument();
      });

      const favoriteButton = screen.getAllByText('Favorite')[0];
      await user.click(favoriteButton);

      await waitFor(() => {
        expect(api.saveFavorite).toHaveBeenCalledWith({
          claim_id: 'sitcom-1',
          title: 'Funny Sitcom 1',
          thumbnail_url: 'https://example.com/sitcom1.jpg'
        });
      });
    });

    it('removes favorite when unfavorite is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(api.getFavorites).mockResolvedValue([
        { claim_id: 'sitcom-1', title: 'Funny Sitcom 1', thumbnail_url: 'https://example.com/sitcom1.jpg' }
      ]);

      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: mockSitcoms,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Unfavorite')).toBeInTheDocument();
      });

      const unfavoriteButton = screen.getByText('Unfavorite');
      await user.click(unfavoriteButton);

      await waitFor(() => {
        expect(api.removeFavorite).toHaveBeenCalledWith('sitcom-1');
      });
    });
  });

  describe('Offline Handling', () => {
    it('shows offline empty state when offline error occurs', async () => {
      // Mock offline state
      vi.mocked(useOfflineHook.useOffline).mockReturnValue({
        isOnline: false,
        isOffline: true,
        wasOffline: true
      });

      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: [],
        loading: false,
        error: { message: 'No internet connection', details: 'offline' },
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Cannot Load Sitcoms')).toBeInTheDocument();
      });
    });
  });
});
