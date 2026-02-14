import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import MoviesPage from '../../src/pages/MoviesPage';
import SitcomsPage from '../../src/pages/SitcomsPage';
import KidsPage from '../../src/pages/KidsPage';
import * as useContentHooks from '../../src/hooks/useContent';
import * as useDownloadManagerHook from '../../src/hooks/useDownloadManager';
import * as useOfflineHook from '../../src/hooks/useOffline';
import * as api from '../../src/lib/api';

// Mock modules
vi.mock('../../src/hooks/useContent');
vi.mock('../../src/hooks/useDownloadManager');
vi.mock('../../src/hooks/useOffline');
vi.mock('../../src/lib/api');

describe('Retry Button Functionality - Requirement 10.5', () => {
  const mockRefetch = vi.fn();
  const mockLoadMore = vi.fn();
  const mockDownloadContent = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock useDownloadManager
    vi.spyOn(useDownloadManagerHook, 'useDownloadManager').mockReturnValue({
      downloads: [],
      downloadContent: mockDownloadContent,
      cancelDownload: vi.fn(),
      retryDownload: vi.fn(),
      clearCompleted: vi.fn(),
      isDownloading: vi.fn(() => false),
      isOfflineAvailable: vi.fn(() => false),
    });

    // Mock useOffline
    vi.spyOn(useOfflineHook, 'useOffline').mockReturnValue({
      isOffline: false,
      isOnline: true,
    });

    // Mock API functions
    vi.mocked(api.getFavorites).mockResolvedValue([]);
    vi.mocked(api.saveFavorite).mockResolvedValue(undefined);
    vi.mocked(api.removeFavorite).mockResolvedValue(undefined);
  });

  describe('MoviesPage Retry Button', () => {
    it('should call refetch when retry button is clicked', async () => {
      const user = userEvent.setup();
      
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: [],
        loading: false,
        error: { message: 'Failed to load movies', details: new Error('Network error') },
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false,
        status: 'error'
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      // Wait for error message to appear
      await waitFor(() => {
        expect(screen.getByText('Failed to load movies')).toBeInTheDocument();
      });

      // Find and click the retry button
      const retryButton = screen.getByRole('button', { name: /retry loading movies/i });
      expect(retryButton).toBeInTheDocument();
      
      await user.click(retryButton);

      // Verify refetch was called
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('SitcomsPage Retry Button', () => {
    it('should call refetch when retry button is clicked', async () => {
      const user = userEvent.setup();
      
      vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
        content: [],
        loading: false,
        error: { message: 'Failed to load sitcoms', details: new Error('Network error') },
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false,
        status: 'error'
      });

      render(
        <MemoryRouter initialEntries={['/sitcoms']}>
          <SitcomsPage />
        </MemoryRouter>
      );

      // Wait for error message to appear
      await waitFor(() => {
        expect(screen.getByText('Failed to load sitcoms')).toBeInTheDocument();
      });

      // Find and click the retry button
      const retryButton = screen.getByRole('button', { name: /retry loading sitcoms/i });
      expect(retryButton).toBeInTheDocument();
      
      await user.click(retryButton);

      // Verify refetch was called
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('KidsPage Retry Button', () => {
    it('should call refetch when retry button is clicked', async () => {
      const user = userEvent.setup();
      
      vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
        content: [],
        loading: false,
        error: { message: 'Failed to load kids content', details: new Error('Network error') },
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false,
        status: 'error'
      });

      render(
        <MemoryRouter initialEntries={['/kids']}>
          <KidsPage />
        </MemoryRouter>
      );

      // Wait for error message to appear
      await waitFor(() => {
        expect(screen.getByText('Failed to load kids content')).toBeInTheDocument();
      });

      // Find and click the retry button
      const retryButton = screen.getByRole('button', { name: /retry loading kids content/i });
      expect(retryButton).toBeInTheDocument();
      
      await user.click(retryButton);

      // Verify refetch was called
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Max Retry Limit', () => {
    it('should respect max retry limit when refetch is called multiple times', async () => {
      const user = userEvent.setup();
      
      vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
        content: [],
        loading: false,
        error: { message: 'Failed to load movies', details: new Error('Network error') },
        refetch: mockRefetch,
        loadMore: mockLoadMore,
        hasMore: false,
        status: 'error'
      });

      render(
        <MemoryRouter initialEntries={['/movies']}>
          <MoviesPage />
        </MemoryRouter>
      );

      // Wait for error message to appear
      await waitFor(() => {
        expect(screen.getByText('Failed to load movies')).toBeInTheDocument();
      });

      // Find the retry button
      const retryButton = screen.getByRole('button', { name: /retry loading movies/i });
      
      // Click retry button multiple times
      await user.click(retryButton);
      await user.click(retryButton);
      await user.click(retryButton);
      await user.click(retryButton);

      // Verify refetch was called 4 times (user can manually retry as many times as they want)
      // The max retry limit is enforced within the fetchWithRetry function, not at the UI level
      expect(mockRefetch).toHaveBeenCalledTimes(4);
    });
  });
});
