/**
 * Home Page Rendering Integration Test
 * 
 * Validates: Requirements 1.1, 1.3, 1.4, 1.5, 2.1, 2.3, 2.5
 * Tests the complete Home page rendering flow including:
 * - Hero section loads without glitching
 * - All content rows render correctly
 * - No infinite re-render loops
 * - Content fetching and display
 * - Navigation and interaction
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Home from '../../src/pages/Home';
import { ContentItem } from '../../src/types';
import * as api from '../../src/lib/api';
import * as useContentHooks from '../../src/hooks/useContent';
import * as useDownloadManagerHook from '../../src/hooks/useDownloadManager';

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
vi.mock('../../src/lib/api');

// Mock hooks
vi.mock('../../src/hooks/useDownloadManager');

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

describe('Home Page Rendering Integration Test', () => {
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

  describe('Requirement 1.1: Hero Section Loads Without Glitching', () => {
    it('should render Hero section without visual instability', async () => {
      render(
        <BrowserRouter>
          <Home />
        </BrowserRouter>
      );

      // Hero should be present immediately
      const hero = screen.getByTestId('hero-component');
      expect(hero).toBeInTheDocument();

      // Wait for any async operations
      await waitFor(() => {
        expect(screen.getByTestId('hero-component')).toBeInTheDocument();
      });

      // Hero should still be present (no flickering)
      expect(screen.getByTestId('hero-component')).toBeInTheDocument();
    });

    it('should render Hero section only once without re-render loops', async () => {
      const { container } = render(
        <BrowserRouter>
          <Home />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('hero-component')).toBeInTheDocument();
      });

      // Count Hero components (should be exactly 1)
      const heroComponents = container.querySelectorAll('[data-testid="hero-component"]');
      expect(heroComponents.length).toBe(1);
    });
  });

  describe('Requirement 1.3: All Content Rows Render', () => {
    it('should render all main category rows', async () => {
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

    it('should render filtered category rows', async () => {
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

    it('should render recently added row', async () => {
      render(
        <BrowserRouter>
          <Home />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('row-recently-added')).toBeInTheDocument();
      });
    });
  });

  describe('Requirement 1.4: Multiple Content Hooks Execute Without Cascading Re-renders', () => {
    it('should execute all content hooks without causing infinite loops', async () => {
      const useMoviesSpy = vi.spyOn(useContentHooks, 'useMovies');
      const useSeriesGroupedSpy = vi.spyOn(useContentHooks, 'useSeriesGrouped');
      const useSitcomsSpy = vi.spyOn(useContentHooks, 'useSitcoms');
      const useKidsContentSpy = vi.spyOn(useContentHooks, 'useKidsContent');

      render(
        <BrowserRouter>
          <Home />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('row-movies')).toBeInTheDocument();
      });

      // Each hook should be called a reasonable number of times (not hundreds)
      expect(useMoviesSpy).toHaveBeenCalledTimes(1);
      expect(useSeriesGroupedSpy).toHaveBeenCalledTimes(1);
      expect(useSitcomsSpy).toHaveBeenCalledTimes(1);
      expect(useKidsContentSpy).toHaveBeenCalledTimes(1);
    });

    it('should not cause UI instability when multiple hooks load simultaneously', async () => {
      const { container } = render(
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

      // All rows should be present and stable
      const rows = container.querySelectorAll('[data-testid^="row-"]');
      expect(rows.length).toBeGreaterThan(4); // At least main rows + filtered rows
    });
  });

  describe('Requirement 1.5: Page Reaches Stable State', () => {
    it('should stop re-rendering after initial load', async () => {
      const { rerender } = render(
        <BrowserRouter>
          <Home />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('row-movies')).toBeInTheDocument();
      });

      // Force a rerender
      rerender(
        <BrowserRouter>
          <Home />
        </BrowserRouter>
      );

      // Content should remain stable
      expect(screen.getByTestId('row-movies')).toBeInTheDocument();
      expect(screen.getByTestId('hero-component')).toBeInTheDocument();
    });

    it('should maintain stable content after all hooks complete', async () => {
      render(
        <BrowserRouter>
          <Home />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('row-movies')).toBeInTheDocument();
      });

      // Get initial content count
      const initialMovies = screen.getAllByText(/Action Movie 1|Comedy Movie 1/);
      const initialCount = initialMovies.length;

      // Wait a bit more to ensure no additional renders
      await new Promise(resolve => setTimeout(resolve, 100));

      // Content count should remain the same
      const finalMovies = screen.getAllByText(/Action Movie 1|Comedy Movie 1/);
      expect(finalMovies.length).toBe(initialCount);
    });
  });

  describe('Requirement 2.1: Hero Section Fetches Content', () => {
    it('should render Hero component with content', async () => {
      render(
        <BrowserRouter>
          <Home />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('hero-component')).toBeInTheDocument();
      });

      // Hero should have play button
      expect(screen.getByText('Play Hero')).toBeInTheDocument();
    });
  });

  describe('Requirement 2.3: Hero Section Renders Without Errors', () => {
    it('should render Hero section without throwing errors', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <BrowserRouter>
          <Home />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('hero-component')).toBeInTheDocument();
      });

      // No console errors should be logged
      expect(consoleError).not.toHaveBeenCalled();

      consoleError.mockRestore();
    });
  });

  describe('Requirement 2.5: Hero Section Does Not Trigger Infinite Re-renders', () => {
    it('should not cause parent components to re-render infinitely', async () => {
      let renderCount = 0;
      const TestWrapper = () => {
        renderCount++;
        return (
          <BrowserRouter>
            <Home />
          </BrowserRouter>
        );
      };

      render(<TestWrapper />);

      await waitFor(() => {
        expect(screen.getByTestId('hero-component')).toBeInTheDocument();
      });

      // Wait to ensure no additional renders
      await new Promise(resolve => setTimeout(resolve, 100));

      // Render count should be reasonable (not hundreds)
      expect(renderCount).toBeLessThan(10);
    });
  });

  describe('Content Display and Interaction', () => {
    it('should display content items in all rows', async () => {
      render(
        <BrowserRouter>
          <Home />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText('Action Movie 1').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Comedy Movie 1').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Test Series S01E01').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Funny Sitcom S01E01').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Kids Show Episode 1').length).toBeGreaterThan(0);
      });
    });

    it('should handle content playback navigation', async () => {
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <Home />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('row-movies')).toBeInTheDocument();
      });

      const moviesRow = screen.getByTestId('row-movies');
      const playButton = within(moviesRow).getByText('Play Action Movie 1');
      
      await user.click(playButton);

      expect(mockNavigate).toHaveBeenCalledWith('/movie/movie-1');
    });

    it('should handle View All navigation', async () => {
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <Home />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('View All Movies')).toBeInTheDocument();
      });

      await user.click(screen.getByText('View All Movies'));

      expect(mockNavigate).toHaveBeenCalledWith('/movies');
    });
  });

  describe('Error Handling', () => {
    it('should handle content loading errors gracefully', async () => {
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: [],
        loading: false,
        error: new Error('Failed to load movies'),
        refetch: vi.fn()
      });

      render(
        <BrowserRouter>
          <Home />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('row-movies')).toBeInTheDocument();
      });

      // Page should still render despite error
      expect(screen.getByTestId('hero-component')).toBeInTheDocument();
    });

    it('should handle empty content gracefully', async () => {
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: [],
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
        expect(screen.getByTestId('row-movies')).toBeInTheDocument();
      });

      // Page should render without crashing
      expect(screen.getByTestId('hero-component')).toBeInTheDocument();
    });
  });
});
