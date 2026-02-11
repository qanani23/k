import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ContentItem, SeriesInfo } from '../../src/types';

// Mock react-router-dom
const mockParams = { claimId: 'series-1' };
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => mockParams
  };
});

import SeriesDetail from '../../src/pages/SeriesDetail';
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

const mockSeriesClaim: ContentItem = {
  claim_id: 'series-1',
  title: 'Test Action Series',
  description: 'An exciting action series',
  tags: ['series', 'action_series'],
  thumbnail_url: 'https://example.com/series1.jpg',
  duration: 3600,
  release_time: Date.now() - 86400000,
  video_urls: { 
    '720p': { url: 'https://example.com/series1-720p.mp4', quality: '720p', type: 'mp4' }
  },
  compatibility: { compatible: true, fallback_available: false }
};

const mockRelatedSeries: ContentItem[] = [
  {
    claim_id: 'series-2',
    title: 'Related Action Series 1',
    tags: ['series', 'action_series'],
    thumbnail_url: 'https://example.com/series2.jpg',
    duration: 3600,
    release_time: Date.now() - 172800000,
    video_urls: { '720p': { url: 'https://example.com/series2.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  },
  {
    claim_id: 'series-3',
    title: 'Related Action Series 2',
    tags: ['series', 'action_series'],
    thumbnail_url: 'https://example.com/series3.jpg',
    duration: 3600,
    release_time: Date.now() - 259200000,
    video_urls: { '720p': { url: 'https://example.com/series3.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  }
];

describe('SeriesDetail', () => {
  const mockDownloadContent = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock API responses
    vi.mocked(api.resolveClaim).mockResolvedValue(mockSeriesClaim);
    vi.mocked(api.fetchRelatedContent).mockResolvedValue(mockRelatedSeries);
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
    it('renders series detail page with series information', async () => {
      render(
        <MemoryRouter>
          <SeriesDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Action Series')).toBeInTheDocument();
      });
    });

    it('displays series title and episode count', async () => {
      render(
        <MemoryRouter>
          <SeriesDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Action Series')).toBeInTheDocument();
        expect(screen.getByText(/0 season/)).toBeInTheDocument();
        expect(screen.getByText(/0 episodes/)).toBeInTheDocument();
      });
    });

    it('displays favorite button', async () => {
      render(
        <MemoryRouter>
          <SeriesDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        const favoriteButton = screen.getByLabelText('Add to favorites');
        expect(favoriteButton).toBeInTheDocument();
      });
    });
  });

  describe('Related Content', () => {
    it('fetches and displays related content', async () => {
      render(
        <MemoryRouter>
          <SeriesDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.fetchRelatedContent).toHaveBeenCalledWith('action_series', 'series-1', 10);
      });

      await waitFor(() => {
        expect(screen.getByText('You may also like')).toBeInTheDocument();
        expect(screen.getByTestId('related-series-2')).toBeInTheDocument();
        expect(screen.getByTestId('related-series-3')).toBeInTheDocument();
      });
    });

    it('excludes current series from related content', async () => {
      render(
        <MemoryRouter>
          <SeriesDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.fetchRelatedContent).toHaveBeenCalledWith('action_series', 'series-1', 10);
      });

      await waitFor(() => {
        expect(screen.queryByTestId('related-series-1')).not.toBeInTheDocument();
      });
    });

    it('uses category tag for related content fetch', async () => {
      render(
        <MemoryRouter>
          <SeriesDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.fetchRelatedContent).toHaveBeenCalledWith('action_series', 'series-1', 10);
      });
    });

    it('handles related content fetch failure gracefully', async () => {
      vi.mocked(api.fetchRelatedContent).mockRejectedValue(new Error('Network error'));

      render(
        <MemoryRouter>
          <SeriesDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Action Series')).toBeInTheDocument();
      });

      // Should not show related content section
      expect(screen.queryByText('You may also like')).not.toBeInTheDocument();
    });

    it('does not show related content section when no related items', async () => {
      vi.mocked(api.fetchRelatedContent).mockResolvedValue([]);

      render(
        <MemoryRouter>
          <SeriesDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Action Series')).toBeInTheDocument();
      });

      expect(screen.queryByText('You may also like')).not.toBeInTheDocument();
    });

    it('navigates to correct detail page based on content type', async () => {
      const user = userEvent.setup();
      
      // Spy on window.location.href setter
      const hrefSpy = vi.fn();
      delete (window as any).location;
      (window as any).location = { href: '' };
      Object.defineProperty(window.location, 'href', {
        set: hrefSpy,
        get: () => 'http://localhost:3000/'
      });

      render(
        <MemoryRouter>
          <SeriesDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('related-series-2')).toBeInTheDocument();
      });

      const playButton = screen.getAllByText('Play')[0];
      await user.click(playButton);

      // Should attempt to navigate to series detail page
      await waitFor(() => {
        expect(hrefSpy).toHaveBeenCalled();
        const calledWith = hrefSpy.mock.calls[0][0];
        expect(calledWith).toContain('/series/series-2');
      });
    });
  });

  describe('User Interactions', () => {
    it('toggles favorite status when favorite button clicked', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <SeriesDetail />
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
          claim_id: 'series-1',
          title: 'Test Action Series',
          thumbnail_url: undefined
        });
      });
    });

    it('removes favorite when already favorited', async () => {
      const user = userEvent.setup();
      vi.mocked(api.isFavorite).mockResolvedValue(true);

      render(
        <MemoryRouter>
          <SeriesDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        const favoriteButton = screen.getByLabelText('Remove from favorites');
        expect(favoriteButton).toBeInTheDocument();
      });

      const favoriteButton = screen.getByLabelText('Remove from favorites');
      await user.click(favoriteButton);

      await waitFor(() => {
        expect(api.removeFavorite).toHaveBeenCalledWith('series-1');
      });
    });
  });

  describe('Loading and Error States', () => {
    it('shows loading skeleton while loading', () => {
      vi.mocked(api.resolveClaim).mockImplementation(() => new Promise(() => {}));

      render(
        <MemoryRouter>
          <SeriesDetail />
        </MemoryRouter>
      );

      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error message when series fails to load', async () => {
      vi.mocked(api.resolveClaim).mockRejectedValue(new Error('Failed to load series'));

      render(
        <MemoryRouter>
          <SeriesDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Error Loading Series')).toBeInTheDocument();
        expect(screen.getByText('Failed to load series')).toBeInTheDocument();
      });
    });

    it('shows error when series not found', async () => {
      vi.mocked(api.resolveClaim).mockRejectedValue(new Error('Series not found'));

      render(
        <MemoryRouter>
          <SeriesDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Series not found')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('shows no episodes message when series has no seasons', async () => {
      render(
        <MemoryRouter>
          <SeriesDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('No episodes available')).toBeInTheDocument();
      });
    });
  });

  describe('Fallback to Base Tag', () => {
    it('uses base tag when no filter tag is present', async () => {
      const claimWithoutFilterTag: ContentItem = {
        ...mockSeriesClaim,
        tags: ['series'] // No filter tag
      };
      vi.mocked(api.resolveClaim).mockResolvedValue(claimWithoutFilterTag);

      render(
        <MemoryRouter>
          <SeriesDetail />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.fetchRelatedContent).toHaveBeenCalledWith('series', 'series-1', 10);
      });
    });
  });
});
