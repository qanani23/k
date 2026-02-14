import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ContentItem } from '../../src/types';

// Create mock navigate function at module level
const mockNavigate = vi.fn();

// Mock react-router-dom before importing KidsPage
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

import KidsPage from '../../src/pages/KidsPage';
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
    <div data-testid={`kids-card-${content.claim_id}`} data-size={size}>
      <div>{content.title}</div>
      <button onClick={() => onPlay(content)}>Play</button>
      <button onClick={() => onDownload(content, '720p')}>Download</button>
      <button onClick={() => onFavorite(content)}>
        {isFavorite ? 'Unfavorite' : 'Favorite'}
      </button>
    </div>
  )
}));

// Mock OfflineEmptyState component
vi.mock('../../src/components/OfflineEmptyState', () => ({
  default: ({ title, message }: any) => (
    <div data-testid="offline-empty-state">
      <div>{title}</div>
      <div>{message}</div>
    </div>
  )
}));

const mockKidsContent: ContentItem[] = [
  {
    claim_id: 'kids-1',
    title: 'Fun Kids Show 1',
    tags: ['kids', 'comedy_kids'],
    thumbnail_url: 'https://example.com/kids1.jpg',
    duration: 1200,
    release_time: Date.now() - 86400000,
    video_urls: { '720p': { url: 'https://example.com/kids1.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  },
  {
    claim_id: 'kids-2',
    title: 'Fun Kids Show 2',
    tags: ['kids', 'action_kids'],
    thumbnail_url: 'https://example.com/kids2.jpg',
    duration: 1200,
    release_time: Date.now() - 172800000,
    video_urls: { '720p': { url: 'https://example.com/kids2.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  },
  {
    claim_id: 'kids-3',
    title: 'Fun Kids Show 3',
    tags: ['kids', 'comedy_kids'],
    thumbnail_url: 'https://example.com/kids3.jpg',
    duration: 1200,
    release_time: Date.now() - 259200000,
    video_urls: { '720p': { url: 'https://example.com/kids3.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  }
];

describe('KidsPage', () => {
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
    it('renders kids page without errors (no black screen)', async () => {
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Kids' })).toBeInTheDocument();
        expect(screen.getByText('3 videos available')).toBeInTheDocument();
      });
    });

    it('renders breadcrumb navigation', async () => {
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        const breadcrumb = document.querySelector('.breadcrumb');
        expect(breadcrumb).toBeInTheDocument();
        expect(breadcrumb?.textContent).toContain('Home');
        expect(breadcrumb?.textContent).toContain('Kids');
      });
    });

    it('displays video count correctly', async () => {
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('3 videos available')).toBeInTheDocument();
      });
    });

    it('displays singular form for single video', async () => {
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: [mockKidsContent[0]],
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('1 video available')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation to /kids Route', () => {
    it('renders correctly when navigating to /kids route', async () => {
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Kids' })).toBeInTheDocument();
      });
    });

    it('fetches content using useKidsContent hook', () => {
      const mockUseKidsContent = vi.spyOn(useContentHooks, 'useKidsContent');
      mockUseKidsContent.mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      // Verify that useKidsContent was called (fetch happens in page)
      expect(mockUseKidsContent).toHaveBeenCalled();
    });
  });

  describe('Content Fetching with kids Tag', () => {
    it('fetches content with kids tag through useKidsContent hook', () => {
      const mockUseKidsContent = vi.spyOn(useContentHooks, 'useKidsContent');
      mockUseKidsContent.mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      // Verify useKidsContent hook is called (which internally uses 'kids' tag)
      expect(mockUseKidsContent).toHaveBeenCalled();
    });

    it('displays kids content items', async () => {
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Fun Kids Show 1')).toBeInTheDocument();
        expect(screen.getByText('Fun Kids Show 2')).toBeInTheDocument();
        expect(screen.getByText('Fun Kids Show 3')).toBeInTheDocument();
      });
    });
  });

  describe('Filter Functionality', () => {
    it('shows filter button', async () => {
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument();
      });
    });

    it('toggles filter panel when filter button clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      const filterButton = screen.getByText('Filters');
      await user.click(filterButton);

      await waitFor(() => {
        expect(screen.getByText('Filter by Category')).toBeInTheDocument();
        expect(screen.getByText('All Kids Content')).toBeInTheDocument();
        expect(screen.getByText('Comedy')).toBeInTheDocument();
        expect(screen.getByText('Action')).toBeInTheDocument();
      });
    });

    it('applies comedy_kids filter when Comedy button clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      // Open filters
      const filterButton = screen.getByText('Filters');
      await user.click(filterButton);

      // Click Comedy filter
      const comedyButton = screen.getByText('Comedy');
      await user.click(comedyButton);

      // Verify navigation was called with filter parameter
      expect(mockNavigate).toHaveBeenCalledWith('/kids?filter=comedy_kids');
    });

    it('applies action_kids filter when Action button clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      // Open filters
      const filterButton = screen.getByText('Filters');
      await user.click(filterButton);

      // Click Action filter
      const actionButton = screen.getByText('Action');
      await user.click(actionButton);

      // Verify navigation was called with filter parameter
      expect(mockNavigate).toHaveBeenCalledWith('/kids?filter=action_kids');
    });

    it('clears filter when All Kids Content button clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids?filter=comedy_kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      // Open filters
      const filterButton = screen.getByText('Filters');
      await user.click(filterButton);

      // Click All Kids Content
      const allButton = screen.getByText('All Kids Content');
      await user.click(allButton);

      // Verify navigation was called without filter parameter
      expect(mockNavigate).toHaveBeenCalledWith('/kids?');
    });

    it('displays filtered content title when filter is active', async () => {
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: mockKidsContent.filter(c => c.tags.includes('comedy_kids')),
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids?filter=comedy_kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Comedy Kids' })).toBeInTheDocument();
      });
    });

    it('passes filter tag to useKidsContent hook', () => {
      const mockUseKidsContent = vi.spyOn(useContentHooks, 'useKidsContent');
      mockUseKidsContent.mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids?filter=action_kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      // Verify useKidsContent was called with the filter tag
      expect(mockUseKidsContent).toHaveBeenCalledWith('action_kids');
    });
  });

  describe('Empty State Display', () => {
    it('shows empty state when no kids content found', async () => {
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: [],
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('No Kids Content Found')).toBeInTheDocument();
        expect(screen.getByText('No kids content is currently available.')).toBeInTheDocument();
      });
    });

    it('shows filter-specific empty state message', async () => {
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: [],
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids?filter=comedy_kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('No Kids Content Found')).toBeInTheDocument();
        expect(screen.getByText('No comedy kids content is currently available.')).toBeInTheDocument();
      });
    });

    it('shows View All Kids Content button in filtered empty state', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: [],
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids?filter=action_kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('View All Kids Content')).toBeInTheDocument();
      });

      const viewAllButton = screen.getByText('View All Kids Content');
      await user.click(viewAllButton);

      expect(mockNavigate).toHaveBeenCalledWith('/kids?');
    });

    it('does not show View All button in unfiltered empty state', async () => {
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: [],
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('No Kids Content Found')).toBeInTheDocument();
        expect(screen.queryByText('View All Kids Content')).not.toBeInTheDocument();
      });
    });
  });

  describe('Grid Layout Rendering', () => {
    it('displays all kids cards in grid layout', async () => {
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('kids-card-kids-1')).toBeInTheDocument();
        expect(screen.getByTestId('kids-card-kids-2')).toBeInTheDocument();
        expect(screen.getByTestId('kids-card-kids-3')).toBeInTheDocument();
      });
    });

    it('defaults to grid view with medium size cards', async () => {
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        const kidsCard = screen.getByTestId('kids-card-kids-1');
        expect(kidsCard).toHaveAttribute('data-size', 'medium');
      });
    });

    it('renders grid container with content-grid class', async () => {
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
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
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      const listViewButton = screen.getByLabelText('List view');
      await user.click(listViewButton);

      await waitFor(() => {
        const kidsCard = screen.getByTestId('kids-card-kids-1');
        expect(kidsCard).toHaveAttribute('data-size', 'large');
      });
    });

    it('switches back to grid view when grid button clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      // Switch to list view first
      const listViewButton = screen.getByLabelText('List view');
      await user.click(listViewButton);

      // Switch back to grid view
      const gridViewButton = screen.getByLabelText('Grid view');
      await user.click(gridViewButton);

      await waitFor(() => {
        const kidsCard = screen.getByTestId('kids-card-kids-1');
        expect(kidsCard).toHaveAttribute('data-size', 'medium');
      });
    });
  });

  describe('Loading and Error States', () => {
    it('shows loading skeleton when loading', () => {
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: [],
        loading: true,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      const skeletons = document.querySelectorAll('.loading-skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error message when error occurs', async () => {
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: [],
        loading: false,
        error: { message: 'Failed to load kids content', details: new Error('Network error') },
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to load kids content')).toBeInTheDocument();
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });
  });

  describe('Pagination', () => {
    it('shows load more button when hasMore is true', async () => {
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: true
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Load More')).toBeInTheDocument();
      });
    });

    it('calls loadMore when Load More button clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: true
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      const loadMoreButton = screen.getByText('Load More');
      await user.click(loadMoreButton);

      expect(mockLoadMore).toHaveBeenCalled();
    });

    it('hides load more button when hasMore is false', async () => {
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.queryByText('Load More')).not.toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('navigates to kids content detail when play is clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('kids-card-kids-1')).toBeInTheDocument();
      });

      const playButton = screen.getAllByText('Play')[0];
      await user.click(playButton);

      expect(mockNavigate).toHaveBeenCalledWith('/movie/kids-1');
    });

    it('initiates download when download is clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('kids-card-kids-1')).toBeInTheDocument();
      });

      const downloadButton = screen.getAllByText('Download')[0];
      await user.click(downloadButton);

      expect(mockDownloadContent).toHaveBeenCalledWith({
        claim_id: 'kids-1',
        quality: '720p',
        url: 'https://example.com/kids1.mp4'
      });
    });

    it('toggles favorite when favorite button is clicked', async () => {
      const user = userEvent.setup();
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('kids-card-kids-1')).toBeInTheDocument();
      });

      const favoriteButton = screen.getAllByText('Favorite')[0];
      await user.click(favoriteButton);

      await waitFor(() => {
        expect(api.saveFavorite).toHaveBeenCalledWith({
          claim_id: 'kids-1',
          title: 'Fun Kids Show 1',
          thumbnail_url: 'https://example.com/kids1.jpg'
        });
      });
    });

    it('removes favorite when unfavorite is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(api.getFavorites).mockResolvedValue([
        { claim_id: 'kids-1', title: 'Fun Kids Show 1', thumbnail_url: 'https://example.com/kids1.jpg' }
      ]);

      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Unfavorite')).toBeInTheDocument();
      });

      const unfavoriteButton = screen.getByText('Unfavorite');
      await user.click(unfavoriteButton);

      await waitFor(() => {
        expect(api.removeFavorite).toHaveBeenCalledWith('kids-1');
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

      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: [],
        loading: false,
        error: { message: 'No internet connection', details: 'offline' },
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('offline-empty-state')).toBeInTheDocument();
        expect(screen.getByText('Cannot Load Kids Content')).toBeInTheDocument();
      });
    });
  });
});
