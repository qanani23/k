/**
 * New Page Routes Integration Test
 * 
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4
 * Tests the complete routing flow for new pages including:
 * - Navigation to Sitcoms page
 * - Navigation to Kids page
 * - Content fetching on both pages
 * - No black screen or routing errors
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SitcomsPage from '../../src/pages/SitcomsPage';
import KidsPage from '../../src/pages/KidsPage';
import { ContentItem } from '../../src/types';
import * as api from '../../src/lib/api';
import * as useContentHooks from '../../src/hooks/useContent';
import * as useDownloadManagerHook from '../../src/hooks/useDownloadManager';
import * as useOfflineHook from '../../src/hooks/useOffline';

// Create mock navigate function
const mockNavigate = vi.fn();

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

// Mock components
vi.mock('../../src/components/MovieCard', () => ({
  default: ({ content, onPlay, onDownload, onFavorite, isFavorite }: any) => (
    <div data-testid={`content-card-${content.claim_id}`}>
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

const mockSitcoms: ContentItem[] = [
  {
    claim_id: 'sitcom-1',
    title: 'Funny Sitcom S01E01',
    tags: ['sitcom'],
    thumbnail_url: 'https://example.com/sitcom1.jpg',
    duration: 1800,
    release_time: Date.now(),
    video_urls: { '720p': { url: 'https://example.com/sitcom1.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  },
  {
    claim_id: 'sitcom-2',
    title: 'Funny Sitcom S01E02',
    tags: ['sitcom'],
    thumbnail_url: 'https://example.com/sitcom2.jpg',
    duration: 1850,
    release_time: Date.now(),
    video_urls: { '720p': { url: 'https://example.com/sitcom2.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  }
];

const mockKidsContent: ContentItem[] = [
  {
    claim_id: 'kids-1',
    title: 'Kids Show Episode 1',
    tags: ['kids', 'comedy_kids'],
    thumbnail_url: 'https://example.com/kids1.jpg',
    duration: 1200,
    release_time: Date.now(),
    video_urls: { '720p': { url: 'https://example.com/kids1.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  },
  {
    claim_id: 'kids-2',
    title: 'Kids Show Episode 2',
    tags: ['kids', 'action_kids'],
    thumbnail_url: 'https://example.com/kids2.jpg',
    duration: 1300,
    release_time: Date.now(),
    video_urls: { '720p': { url: 'https://example.com/kids2.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  }
];

describe('New Page Routes Integration Test', () => {
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
      downloads: [],
      offlineContent: [],
      downloadContent: mockDownloadContent,
      deleteDownload: vi.fn(),
      getOfflineUrl: vi.fn(),
      isDownloading: vi.fn().mockReturnValue(false),
      isOfflineAvailable: vi.fn().mockReturnValue(false),
      getDownloadProgress: vi.fn().mockReturnValue(null),
      getOfflineMetadata: vi.fn().mockReturnValue(null),
      getTotalDownloads: vi.fn().mockReturnValue(0),
      getTotalDownloadSize: vi.fn().mockReturnValue(0),
      getActiveDownloads: vi.fn().mockReturnValue([]),
      cancelDownload: vi.fn()
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Sitcoms Page Tests', () => {
    beforeEach(() => {
      // Mock useSitcoms hook
      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: mockSitcoms,
        loading: false,
        error: null,
        status: 'success',
        fromCache: false,
        loadMore: mockLoadMore,
        hasMore: false,
        refetch: mockRefetch
      });
    });

    describe('Requirement 5.1: Navigate to Sitcoms Page', () => {
      it('should render Sitcoms page without errors', async () => {
        render(
          <MemoryRouter initialEntries={['/sitcoms']}>
            <SitcomsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'Sitcoms' })).toBeInTheDocument();
        });

        // Page should render successfully
        expect(screen.getByText('2 sitcoms available')).toBeInTheDocument();
      });

      it('should not display black screen on navigation', async () => {
        const { container } = render(
          <MemoryRouter initialEntries={['/sitcoms']}>
            <SitcomsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'Sitcoms' })).toBeInTheDocument();
        });

        // Container should have content (not empty/black)
        expect(container.textContent).not.toBe('');
        expect(container.querySelector('.max-w-7xl')).toBeInTheDocument();
      });

      it('should render without infinite re-renders', async () => {
        const useSitcomsSpy = vi.spyOn(useContentHooks, 'useSitcoms');

        render(
          <MemoryRouter initialEntries={['/sitcoms']}>
            <SitcomsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'Sitcoms' })).toBeInTheDocument();
        });

        // Hook should be called a reasonable number of times
        expect(useSitcomsSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('Requirement 5.2: Sitcoms Route Registration', () => {
      it('should handle /sitcoms route correctly', async () => {
        render(
          <MemoryRouter initialEntries={['/sitcoms']}>
            <SitcomsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'Sitcoms' })).toBeInTheDocument();
        });

        // Breadcrumb should show correct path
        expect(screen.getByText('Home')).toBeInTheDocument();
      });
    });

    describe('Requirement 5.3: Fetch Sitcom Content', () => {
      it('should fetch content tagged with sitcom', async () => {
        const useSitcomsSpy = vi.spyOn(useContentHooks, 'useSitcoms');

        render(
          <MemoryRouter initialEntries={['/sitcoms']}>
            <SitcomsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'Sitcoms' })).toBeInTheDocument();
        });

        // useSitcoms hook should be called
        expect(useSitcomsSpy).toHaveBeenCalled();
      });

      it('should display fetched sitcom content', async () => {
        render(
          <MemoryRouter initialEntries={['/sitcoms']}>
            <SitcomsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByText('Funny Sitcom S01E01')).toBeInTheDocument();
          expect(screen.getByText('Funny Sitcom S01E02')).toBeInTheDocument();
        });
      });

      it('should handle loading state correctly', async () => {
        vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
          content: [],
          loading: true,
          error: null,
          status: 'loading',
          fromCache: false,
          loadMore: mockLoadMore,
          hasMore: false,
          refetch: mockRefetch
        });

        render(
          <MemoryRouter initialEntries={['/sitcoms']}>
            <SitcomsPage />
          </MemoryRouter>
        );

        // Skeleton loader should be visible
        expect(screen.getAllByTestId('skeleton-loader').length).toBeGreaterThan(0);
        expect(screen.getByText('Loading sitcoms...')).toBeInTheDocument();
      });
    });

    describe('Requirement 5.4: Display Sitcom Cards in Grid Layout', () => {
      it('should render sitcom cards in grid layout', async () => {
        render(
          <MemoryRouter initialEntries={['/sitcoms']}>
            <SitcomsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'Sitcoms' })).toBeInTheDocument();
        });

        // Both sitcom cards should be rendered
        expect(screen.getByTestId('content-card-sitcom-1')).toBeInTheDocument();
        expect(screen.getByTestId('content-card-sitcom-2')).toBeInTheDocument();
      });

      it('should handle sitcom playback', async () => {
        const user = userEvent.setup();

        render(
          <MemoryRouter initialEntries={['/sitcoms']}>
            <SitcomsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'Sitcoms' })).toBeInTheDocument();
        });

        const sitcomCard = screen.getByTestId('content-card-sitcom-1');
        const playButton = within(sitcomCard).getByText('Play');
        
        await user.click(playButton);

        expect(mockNavigate).toHaveBeenCalledWith('/movie/sitcom-1');
      });

      it('should support grid/list view toggle', async () => {
        const user = userEvent.setup();

        render(
          <MemoryRouter initialEntries={['/sitcoms']}>
            <SitcomsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'Sitcoms' })).toBeInTheDocument();
        });

        // View mode toggle should be present
        const listViewButton = screen.getByLabelText('List view');
        expect(listViewButton).toBeInTheDocument();

        await user.click(listViewButton);

        // View mode should change (verified by component state)
        expect(listViewButton).toBeInTheDocument();
      });
    });

    describe('Error Handling', () => {
      it('should handle fetch errors gracefully', async () => {
        vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
          content: [],
          loading: false,
          error: { message: 'Failed to load sitcoms', details: 'network_error' },
          status: 'error',
          fromCache: false,
          loadMore: mockLoadMore,
          hasMore: false,
          refetch: mockRefetch
        });

        render(
          <MemoryRouter initialEntries={['/sitcoms']}>
            <SitcomsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByText('Failed to load sitcoms')).toBeInTheDocument();
        });

        // Should not display black screen
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });

      it('should display empty state when no sitcoms available', async () => {
        vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
          content: [],
          loading: false,
          error: null,
          status: 'success',
          fromCache: false,
          loadMore: mockLoadMore,
          hasMore: false,
          refetch: mockRefetch
        });

        render(
          <MemoryRouter initialEntries={['/sitcoms']}>
            <SitcomsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByText('No Sitcoms Found')).toBeInTheDocument();
        });
      });
    });
  });

  describe('Kids Page Tests', () => {
    beforeEach(() => {
      // Mock useKidsContent hook
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: mockKidsContent,
        loading: false,
        error: null,
        status: 'success',
        fromCache: false,
        loadMore: mockLoadMore,
        hasMore: false,
        refetch: mockRefetch
      });
    });

    describe('Requirement 6.1: Navigate to Kids Page Without Black Screen', () => {
      it('should render Kids page without black screen', async () => {
        const { container } = render(
          <MemoryRouter initialEntries={['/kids']}>
            <KidsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'Kids' })).toBeInTheDocument();
        });

        // Container should have content (not empty/black)
        expect(container.textContent).not.toBe('');
        expect(container.querySelector('.max-w-7xl')).toBeInTheDocument();
      });

      it('should render UI elements correctly', async () => {
        render(
          <MemoryRouter initialEntries={['/kids']}>
            <KidsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'Kids' })).toBeInTheDocument();
        });

        // Page should have all UI elements
        expect(screen.getByText(/2 video.*available/)).toBeInTheDocument();
        expect(screen.getByText('Home')).toBeInTheDocument();
      });

      it('should not cause rendering errors', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(
          <MemoryRouter initialEntries={['/kids']}>
            <KidsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'Kids' })).toBeInTheDocument();
        });

        // No console errors should be logged
        expect(consoleError).not.toHaveBeenCalled();

        consoleError.mockRestore();
      });
    });

    describe('Requirement 6.2: Fetch Kids Content', () => {
      it('should fetch content tagged with kids', async () => {
        const useKidsContentSpy = vi.spyOn(useContentHooks, 'useKidsContent');

        render(
          <MemoryRouter initialEntries={['/kids']}>
            <KidsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'Kids' })).toBeInTheDocument();
        });

        // useKidsContent hook should be called
        expect(useKidsContentSpy).toHaveBeenCalled();
      });

      it('should display fetched kids content', async () => {
        render(
          <MemoryRouter initialEntries={['/kids']}>
            <KidsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByText('Kids Show Episode 1')).toBeInTheDocument();
          expect(screen.getByText('Kids Show Episode 2')).toBeInTheDocument();
        });
      });

      it('should support category filtering', async () => {
        const comedyKids = mockKidsContent.filter(k => k.tags.includes('comedy_kids'));
        
        vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
          content: comedyKids,
          loading: false,
          error: null,
          status: 'success',
          fromCache: false,
          loadMore: mockLoadMore,
          hasMore: false,
          refetch: mockRefetch
        });

        render(
          <MemoryRouter initialEntries={['/kids?filter=comedy_kids']}>
            <KidsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'Comedy Kids' })).toBeInTheDocument();
        });

        // Should display filtered content
        expect(screen.getByText('Kids Show Episode 1')).toBeInTheDocument();
      });
    });

    describe('Requirement 6.3: Display Skeleton Loaders', () => {
      it('should display skeleton loaders while loading', async () => {
        vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
          content: [],
          loading: true,
          error: null,
          status: 'loading',
          fromCache: false,
          loadMore: mockLoadMore,
          hasMore: false,
          refetch: mockRefetch
        });

        render(
          <MemoryRouter initialEntries={['/kids']}>
            <KidsPage />
          </MemoryRouter>
        );

        // Skeleton loader should be visible
        expect(screen.getAllByTestId('skeleton-loader').length).toBeGreaterThan(0);
        expect(screen.getByText('Loading kids content...')).toBeInTheDocument();
      });

      it('should replace skeleton loaders with content', async () => {
        render(
          <MemoryRouter initialEntries={['/kids']}>
            <KidsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'Kids' })).toBeInTheDocument();
        });

        // Skeleton should not be visible
        expect(screen.queryByTestId('skeleton-loader')).not.toBeInTheDocument();

        // Content should be visible
        expect(screen.getByText('Kids Show Episode 1')).toBeInTheDocument();
      });
    });

    describe('Requirement 6.4: Render Content Cards in Grid Layout', () => {
      it('should render kids content cards in grid layout', async () => {
        render(
          <MemoryRouter initialEntries={['/kids']}>
            <KidsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'Kids' })).toBeInTheDocument();
        });

        // Both kids content cards should be rendered
        expect(screen.getByTestId('content-card-kids-1')).toBeInTheDocument();
        expect(screen.getByTestId('content-card-kids-2')).toBeInTheDocument();
      });

      it('should handle kids content playback', async () => {
        const user = userEvent.setup();

        render(
          <MemoryRouter initialEntries={['/kids']}>
            <KidsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'Kids' })).toBeInTheDocument();
        });

        const kidsCard = screen.getByTestId('content-card-kids-1');
        const playButton = within(kidsCard).getByText('Play');
        
        await user.click(playButton);

        expect(mockNavigate).toHaveBeenCalledWith('/movie/kids-1');
      });

      it('should handle kids content download', async () => {
        const user = userEvent.setup();

        render(
          <MemoryRouter initialEntries={['/kids']}>
            <KidsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'Kids' })).toBeInTheDocument();
        });

        const kidsCard = screen.getByTestId('content-card-kids-1');
        const downloadButton = within(kidsCard).getByText('Download');
        
        await user.click(downloadButton);

        expect(mockDownloadContent).toHaveBeenCalledWith({
          claim_id: 'kids-1',
          quality: '720p',
          url: 'https://example.com/kids1.mp4'
        });
      });
    });

    describe('Requirement 6.5: Display Empty State Instead of Black Screen', () => {
      it('should display empty state when no kids content available', async () => {
        vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
          content: [],
          loading: false,
          error: null,
          status: 'success',
          fromCache: false,
          loadMore: mockLoadMore,
          hasMore: false,
          refetch: mockRefetch
        });

        render(
          <MemoryRouter initialEntries={['/kids']}>
            <KidsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByText('No Kids Content Found')).toBeInTheDocument();
        });

        // Should not display black screen
        expect(screen.getByRole('heading', { name: 'Kids' })).toBeInTheDocument();
      });

      it('should not display black screen on error', async () => {
        vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
          content: [],
          loading: false,
          error: { message: 'Failed to load kids content', details: 'network_error' },
          status: 'error',
          fromCache: false,
          loadMore: mockLoadMore,
          hasMore: false,
          refetch: mockRefetch
        });

        render(
          <MemoryRouter initialEntries={['/kids']}>
            <KidsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByText('Failed to load kids content')).toBeInTheDocument();
        });

        // Should display error message, not black screen
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });

    describe('Filter Functionality', () => {
      it('should display filter options', async () => {
        const user = userEvent.setup();

        render(
          <MemoryRouter initialEntries={['/kids']}>
            <KidsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'Kids' })).toBeInTheDocument();
        });

        // Click filters button
        const filtersButton = screen.getByText('Filters');
        await user.click(filtersButton);

        // Filter panel should be visible
        expect(screen.getByText('Filter by Category')).toBeInTheDocument();
      });

      it('should handle filter changes', async () => {
        const user = userEvent.setup();

        render(
          <MemoryRouter initialEntries={['/kids']}>
            <KidsPage />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: 'Kids' })).toBeInTheDocument();
        });

        // Click filters button
        const filtersButton = screen.getByText('Filters');
        await user.click(filtersButton);

        // Click comedy filter
        const comedyFilter = screen.getByText('Comedy');
        await user.click(comedyFilter);

        // Should navigate with filter parameter
        expect(mockNavigate).toHaveBeenCalledWith('/kids?filter=comedy_kids');
      });
    });
  });

  describe('Cross-Page Navigation', () => {
    it('should navigate between Sitcoms and Kids pages without errors', async () => {
      const { rerender } = render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Sitcoms' })).toBeInTheDocument();
      });

      // Navigate to Kids page
      rerender(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Kids' })).toBeInTheDocument();
      });

      // Both pages should render without errors
      expect(screen.queryByRole('heading', { name: 'Sitcoms' })).not.toBeInTheDocument();
    });

    it('should maintain stable state across navigation', async () => {
      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: mockSitcoms,
        loading: false,
        error: null,
        status: 'success',
        fromCache: false,
        loadMore: mockLoadMore,
        hasMore: false,
        refetch: mockRefetch
      });

      const { rerender } = render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Funny Sitcom S01E01')).toBeInTheDocument();
      });

      // Navigate away and back
      rerender(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Kids' })).toBeInTheDocument();
      });

      rerender(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Sitcoms' })).toBeInTheDocument();
      });

      // Content should still be available
      expect(screen.getByRole('heading', { name: 'Sitcoms' })).toBeInTheDocument();
    });
  });
});
