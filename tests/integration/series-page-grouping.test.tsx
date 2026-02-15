/**
 * Series Page Grouping Integration Test
 * 
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4
 * Tests the complete Series page grouping flow including:
 * - Navigation to Series page
 * - Series grouping logic
 * - Series card rendering
 * - Skeleton loader resolution
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SeriesPage from '../../src/pages/SeriesPage';
import { SeriesInfo, Episode, ContentItem, Playlist } from '../../src/types';
import * as api from '../../src/lib/api';
import * as seriesLib from '../../src/lib/series';
import * as useDownloadManagerHook from '../../src/hooks/useDownloadManager';

// Create mock navigate function
const mockNavigate = vi.fn();

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ claimId: 'test-series-id' })
  };
});

// Mock API
vi.mock('../../src/lib/api');

// Mock series library
vi.mock('../../src/lib/series');

// Mock hooks
vi.mock('../../src/hooks/useDownloadManager');

const mockEpisodes: Episode[] = [
  {
    claim_id: 'episode-1',
    title: 'Test Series S01E01',
    thumbnail_url: 'https://example.com/ep1.jpg',
    duration: 2700,
    episode_number: 1,
    season_number: 1
  },
  {
    claim_id: 'episode-2',
    title: 'Test Series S01E02',
    thumbnail_url: 'https://example.com/ep2.jpg',
    duration: 2800,
    episode_number: 2,
    season_number: 1
  },
  {
    claim_id: 'episode-3',
    title: 'Test Series S02E01',
    thumbnail_url: 'https://example.com/ep3.jpg',
    duration: 2900,
    episode_number: 1,
    season_number: 2
  }
];

const mockSeriesInfo: SeriesInfo = {
  title: 'Test Series',
  claim_id: 'test-series-id',
  total_episodes: 3,
  seasons: [
    {
      number: 1,
      episodes: [mockEpisodes[0], mockEpisodes[1]],
      inferred: false
    },
    {
      number: 2,
      episodes: [mockEpisodes[2]],
      inferred: false
    }
  ]
};

const mockSeriesContent: ContentItem[] = [
  {
    claim_id: 'episode-1',
    title: 'Test Series S01E01',
    tags: ['series', '__series_container__'],
    thumbnail_url: 'https://example.com/ep1.jpg',
    duration: 2700,
    release_time: Date.now(),
    video_urls: { '720p': { url: 'https://example.com/ep1.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  },
  {
    claim_id: 'episode-2',
    title: 'Test Series S01E02',
    tags: ['series', '__series_container__'],
    thumbnail_url: 'https://example.com/ep2.jpg',
    duration: 2800,
    release_time: Date.now(),
    video_urls: { '720p': { url: 'https://example.com/ep2.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  },
  {
    claim_id: 'episode-3',
    title: 'Test Series S02E01',
    tags: ['series', '__series_container__'],
    thumbnail_url: 'https://example.com/ep3.jpg',
    duration: 2900,
    release_time: Date.now(),
    video_urls: { '720p': { url: 'https://example.com/ep3.mp4', quality: '720p', type: 'mp4' } },
    compatibility: { compatible: true, fallback_available: false }
  }
];

describe('Series Page Grouping Integration Test', () => {
  const mockDownloadContent = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock API responses
    vi.mocked(api.fetchPlaylists).mockResolvedValue([]);
    vi.mocked(api.fetchByTag).mockResolvedValue(mockSeriesContent);
    vi.mocked(api.getFavorites).mockResolvedValue([]);
    vi.mocked(api.saveFavorite).mockResolvedValue(undefined);
    vi.mocked(api.removeFavorite).mockResolvedValue(undefined);
    vi.mocked(api.resolveClaim).mockResolvedValue(mockSeriesContent[0]);

    // Mock series library
    vi.mocked(seriesLib.getSeriesForClaim).mockReturnValue(mockSeriesInfo);

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

  describe('Requirement 4.1: Navigate to Series Page', () => {
    it('should render Series page without errors', async () => {
      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Series')).toBeInTheDocument();
      });

      // Page should render successfully
      expect(screen.getByText('2 seasons • 3 episodes')).toBeInTheDocument();
    });

    it('should fetch series content on mount', async () => {
      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.fetchPlaylists).toHaveBeenCalled();
        expect(api.fetchByTag).toHaveBeenCalledWith('series', 200);
        expect(api.getFavorites).toHaveBeenCalled();
      });
    });

    it('should call getSeriesForClaim with correct parameters', async () => {
      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(seriesLib.getSeriesForClaim).toHaveBeenCalledWith(
          'test-series-id',
          [],
          mockSeriesContent
        );
      });
    });
  });

  describe('Requirement 4.2: Group Episodes by Series', () => {
    it('should group episodes into seasons correctly', async () => {
      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Series')).toBeInTheDocument();
      });

      // Both seasons should be rendered
      expect(screen.getByText('Season 1')).toBeInTheDocument();
      expect(screen.getByText('Season 2')).toBeInTheDocument();
    });

    it('should display correct episode count per season', async () => {
      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Series')).toBeInTheDocument();
      });

      // Season 1 should have 2 episodes
      const season1 = screen.getByText('Season 1').closest('button');
      expect(within(season1!).getByText('2 episodes')).toBeInTheDocument();

      // Season 2 should have 1 episode
      const season2 = screen.getByText('Season 2').closest('button');
      expect(within(season2!).getByText('1 episode')).toBeInTheDocument();
    });

    it('should display total episode count in header', async () => {
      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('2 seasons • 3 episodes')).toBeInTheDocument();
      });
    });

    it('should preserve episode order within seasons', async () => {
      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Season 1')).toBeInTheDocument();
      });

      // Season 1 should be expanded by default, so episodes should be visible
      await waitFor(() => {
        expect(screen.getByText('Test Series S01E01')).toBeInTheDocument();
      });

      // Episodes should be in order
      const episodes = screen.getAllByRole('article');
      expect(episodes.length).toBeGreaterThan(0);
      
      // First episode should be E01
      expect(within(episodes[0]).getByText('Test Series S01E01')).toBeInTheDocument();
      expect(within(episodes[0]).getByText('1')).toBeInTheDocument(); // Episode number badge
    });
  });

  describe('Requirement 4.3: Render Series Cards', () => {
    it('should render season headers with expand/collapse functionality', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Season 1')).toBeInTheDocument();
      });

      // Season 1 should be expanded by default
      const season1Button = screen.getByText('Season 1').closest('button');
      expect(season1Button).toHaveAttribute('aria-expanded', 'true');

      // Click to collapse
      await user.click(season1Button!);

      await waitFor(() => {
        expect(season1Button).toHaveAttribute('aria-expanded', 'false');
      });
    });

    it('should render episode cards with all required information', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Season 1')).toBeInTheDocument();
      });

      // Expand Season 1 (should be expanded by default)
      await waitFor(() => {
        expect(screen.getByText('Test Series S01E01')).toBeInTheDocument();
      });

      // Episode card should have all required elements
      const episodeCard = screen.getByText('Test Series S01E01').closest('[role="article"]');
      expect(episodeCard).toBeInTheDocument();

      // Should have episode number badge
      expect(within(episodeCard!).getByText('1')).toBeInTheDocument();

      // Should have episode title
      expect(within(episodeCard!).getByText('Test Series S01E01')).toBeInTheDocument();

      // Should have duration
      expect(within(episodeCard!).getByText(/45m/)).toBeInTheDocument();

      // Should have action buttons
      expect(within(episodeCard!).getByLabelText('Play Test Series S01E01')).toBeInTheDocument();
      expect(within(episodeCard!).getByLabelText('Download Test Series S01E01')).toBeInTheDocument();
      expect(within(episodeCard!).getByLabelText('Add Test Series S01E01 to favorites')).toBeInTheDocument();
    });

    it('should handle episode playback', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Series S01E01')).toBeInTheDocument();
      });

      const playButton = screen.getByLabelText('Play Test Series S01E01');
      await user.click(playButton);

      expect(mockNavigate).toHaveBeenCalledWith('/series/episode-1');
    });

    it('should handle episode download', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Series S01E01')).toBeInTheDocument();
      });

      const downloadButton = screen.getByLabelText('Download Test Series S01E01');
      await user.click(downloadButton);

      await waitFor(() => {
        expect(api.resolveClaim).toHaveBeenCalledWith('episode-1');
        expect(mockDownloadContent).toHaveBeenCalled();
      });
    });

    it('should handle favorite toggle', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Series S01E01')).toBeInTheDocument();
      });

      const favoriteButton = screen.getByLabelText('Add Test Series S01E01 to favorites');
      await user.click(favoriteButton);

      await waitFor(() => {
        expect(api.saveFavorite).toHaveBeenCalledWith({
          claim_id: 'episode-1',
          title: 'Test Series S01E01',
          thumbnail_url: 'https://example.com/ep1.jpg'
        });
      });
    });
  });

  describe('Requirement 4.4: Skeleton Loader Resolution', () => {
    it('should display skeleton loader while loading', async () => {
      // Delay the API response to show loading state
      vi.mocked(api.fetchByTag).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockSeriesContent), 100))
      );

      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      // Loading state should be visible
      expect(screen.getByText('Loading series...')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should replace skeleton loader with content after loading', async () => {
      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Series')).toBeInTheDocument();
      });

      // Skeleton loader should not be visible
      expect(screen.queryByText('Loading series...')).not.toBeInTheDocument();

      // Content should be visible
      expect(screen.getByText('Season 1')).toBeInTheDocument();
      expect(screen.getByText('Season 2')).toBeInTheDocument();
    });

    it('should not display skeleton loader indefinitely', async () => {
      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Series')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Loading should complete within reasonable time
      expect(screen.queryByText('Loading series...')).not.toBeInTheDocument();
    });
  });

  describe('Season Expansion State', () => {
    it('should expand Season 1 by default', async () => {
      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Series')).toBeInTheDocument();
      });

      // Season 1 should be expanded
      const season1Button = screen.getByText('Season 1').closest('button');
      expect(season1Button).toHaveAttribute('aria-expanded', 'true');

      // Episodes should be visible
      expect(screen.getByText('Test Series S01E01')).toBeInTheDocument();
    });

    it('should keep other seasons collapsed by default', async () => {
      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Series')).toBeInTheDocument();
      });

      // Season 2 should be collapsed
      const season2Button = screen.getByText('Season 2').closest('button');
      expect(season2Button).toHaveAttribute('aria-expanded', 'false');

      // Season 2 episodes should not be visible
      expect(screen.queryByText('Test Series S02E01')).not.toBeInTheDocument();
    });

    it('should toggle season expansion on click', async () => {
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Series')).toBeInTheDocument();
      });

      const season2Button = screen.getByText('Season 2').closest('button');
      
      // Initially collapsed
      expect(season2Button).toHaveAttribute('aria-expanded', 'false');

      // Click to expand
      await user.click(season2Button!);

      await waitFor(() => {
        expect(season2Button).toHaveAttribute('aria-expanded', 'true');
      });

      // Episodes should now be visible
      expect(screen.getByText('Test Series S02E01')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when series not found', async () => {
      vi.mocked(seriesLib.getSeriesForClaim).mockReturnValue(null);

      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Error Loading Series')).toBeInTheDocument();
      });

      expect(screen.getByText('Series not found')).toBeInTheDocument();
      expect(screen.getByText('Go Back')).toBeInTheDocument();
    });

    it('should display error message when fetch fails', async () => {
      vi.mocked(api.fetchByTag).mockRejectedValue(new Error('Network error'));

      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Error Loading Series')).toBeInTheDocument();
      });

      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('should handle Go Back button click', async () => {
      const user = userEvent.setup();

      vi.mocked(seriesLib.getSeriesForClaim).mockReturnValue(null);

      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Go Back')).toBeInTheDocument();
      });

      const goBackButton = screen.getByText('Go Back');
      await user.click(goBackButton);

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    it('should display empty state when no episodes available', async () => {
      const emptySeriesInfo: SeriesInfo = {
        ...mockSeriesInfo,
        seasons: [],
        total_episodes: 0
      };

      vi.mocked(seriesLib.getSeriesForClaim).mockReturnValue(emptySeriesInfo);

      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Series')).toBeInTheDocument();
      });

      expect(screen.getByText('No episodes available')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for season headers', async () => {
      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Season 1')).toBeInTheDocument();
      });

      const season1Button = screen.getByText('Season 1').closest('button');
      
      expect(season1Button).toHaveAttribute('aria-expanded');
      expect(season1Button).toHaveAttribute('aria-controls', 'season-1-episodes');
    });

    it('should have proper ARIA attributes for episode cards', async () => {
      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Series S01E01')).toBeInTheDocument();
      });

      const episodeCard = screen.getByText('Test Series S01E01').closest('[role="article"]');
      
      expect(episodeCard).toHaveAttribute('aria-label');
      expect(episodeCard?.getAttribute('aria-label')).toContain('Test Series S01E01');
      expect(episodeCard?.getAttribute('aria-label')).toContain('Episode 1');
    });

    it('should have proper ARIA attributes for action buttons', async () => {
      render(
        <MemoryRouter>
          <SeriesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Series S01E01')).toBeInTheDocument();
      });

      const playButton = screen.getByLabelText('Play Test Series S01E01');
      const downloadButton = screen.getByLabelText('Download Test Series S01E01');
      const favoriteButton = screen.getByLabelText('Add Test Series S01E01 to favorites');

      expect(playButton).toHaveAttribute('aria-label');
      expect(downloadButton).toHaveAttribute('aria-label');
      expect(favoriteButton).toHaveAttribute('aria-label');
      expect(favoriteButton).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
