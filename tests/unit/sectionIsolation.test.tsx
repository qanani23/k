import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Home from '../../src/pages/Home';
import * as useContentHooks from '../../src/hooks/useContent';
import * as useDownloadManagerHook from '../../src/hooks/useDownloadManager';
import * as useOfflineHook from '../../src/hooks/useOffline';
import * as api from '../../src/lib/api';

// Mock modules
vi.mock('../../src/hooks/useContent');
vi.mock('../../src/hooks/useDownloadManager');
vi.mock('../../src/hooks/useOffline');
vi.mock('../../src/lib/api');
vi.mock('../../src/components/Hero', () => ({
  default: () => <div data-testid="hero">Hero Component</div>
}));

describe('Section Isolation - Retry Button', () => {
  const mockRefetchMovies = vi.fn();
  const mockRefetchSeries = vi.fn();
  const mockRefetchSitcoms = vi.fn();
  const mockRefetchKids = vi.fn();
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
  });

  it('should only refetch Movies section when Movies retry is clicked', async () => {
    const user = userEvent.setup();
    
    // Mock Movies section with error
    vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
      content: [],
      loading: false,
      error: { message: 'Failed to load movies', details: new Error('Network error') },
      refetch: mockRefetchMovies,
      loadMore: vi.fn(),
      hasMore: false,
      status: 'error'
    });

    // Mock other sections as successful
    vi.spyOn(useContentHooks, 'useSeriesGrouped').mockReturnValue({
      content: [],
      seriesMap: new Map(),
      loading: false,
      error: null,
      refetch: mockRefetchSeries,
      loadMore: vi.fn(),
      hasMore: false,
      status: 'success'
    });

    vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
      content: [],
      loading: false,
      error: null,
      refetch: mockRefetchSitcoms,
      loadMore: vi.fn(),
      hasMore: false,
      status: 'success'
    });

    vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
      content: [],
      loading: false,
      error: null,
      refetch: mockRefetchKids,
      loadMore: vi.fn(),
      hasMore: false,
      status: 'success'
    });

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    // Wait for Movies error to appear
    await waitFor(() => {
      expect(screen.getByText('Failed to load movies')).toBeInTheDocument();
    });

    // Find and click the Movies retry button
    const retryButton = screen.getByRole('button', { name: /retry loading movies/i });
    await user.click(retryButton);

    // Verify ONLY Movies refetch was called
    expect(mockRefetchMovies).toHaveBeenCalledTimes(1);
    expect(mockRefetchSeries).not.toHaveBeenCalled();
    expect(mockRefetchSitcoms).not.toHaveBeenCalled();
    expect(mockRefetchKids).not.toHaveBeenCalled();
  });

  it('should only refetch Series section when Series retry is clicked', async () => {
    const user = userEvent.setup();
    
    // Mock Series section with error
    vi.spyOn(useContentHooks, 'useSeriesGrouped').mockReturnValue({
      content: [],
      seriesMap: new Map(),
      loading: false,
      error: { message: 'Failed to load series', details: new Error('Network error') },
      refetch: mockRefetchSeries,
      loadMore: vi.fn(),
      hasMore: false,
      status: 'error'
    });

    // Mock other sections as successful
    vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
      content: [],
      loading: false,
      error: null,
      refetch: mockRefetchMovies,
      loadMore: vi.fn(),
      hasMore: false,
      status: 'success'
    });

    vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
      content: [],
      loading: false,
      error: null,
      refetch: mockRefetchSitcoms,
      loadMore: vi.fn(),
      hasMore: false,
      status: 'success'
    });

    vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
      content: [],
      loading: false,
      error: null,
      refetch: mockRefetchKids,
      loadMore: vi.fn(),
      hasMore: false,
      status: 'success'
    });

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    // Wait for Series error to appear
    await waitFor(() => {
      expect(screen.getByText('Failed to load series')).toBeInTheDocument();
    });

    // Find and click the Series retry button
    const retryButton = screen.getByRole('button', { name: /retry loading series/i });
    await user.click(retryButton);

    // Verify ONLY Series refetch was called
    expect(mockRefetchSeries).toHaveBeenCalledTimes(1);
    expect(mockRefetchMovies).not.toHaveBeenCalled();
    expect(mockRefetchSitcoms).not.toHaveBeenCalled();
    expect(mockRefetchKids).not.toHaveBeenCalled();
  });

  it('should not trigger window.location.reload on retry', async () => {
    const user = userEvent.setup();
    const reloadSpy = vi.fn();
    
    // Mock window.location.reload
    Object.defineProperty(window, 'location', {
      value: { reload: reloadSpy },
      writable: true
    });
    
    // Mock Movies section with error
    vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
      content: [],
      loading: false,
      error: { message: 'Failed to load movies', details: new Error('Network error') },
      refetch: mockRefetchMovies,
      loadMore: vi.fn(),
      hasMore: false,
      status: 'error'
    });

    // Mock other sections as successful
    vi.spyOn(useContentHooks, 'useSeriesGrouped').mockReturnValue({
      content: [],
      seriesMap: new Map(),
      loading: false,
      error: null,
      refetch: mockRefetchSeries,
      loadMore: vi.fn(),
      hasMore: false,
      status: 'success'
    });

    vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
      content: [],
      loading: false,
      error: null,
      refetch: mockRefetchSitcoms,
      loadMore: vi.fn(),
      hasMore: false,
      status: 'success'
    });

    vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
      content: [],
      loading: false,
      error: null,
      refetch: mockRefetchKids,
      loadMore: vi.fn(),
      hasMore: false,
      status: 'success'
    });

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    // Wait for Movies error to appear
    await waitFor(() => {
      expect(screen.getByText('Failed to load movies')).toBeInTheDocument();
    });

    // Find and click the Movies retry button
    const retryButton = screen.getByRole('button', { name: /retry loading movies/i });
    await user.click(retryButton);

    // Verify window.location.reload was NOT called
    expect(reloadSpy).not.toHaveBeenCalled();
    
    // Verify section-specific refetch WAS called
    expect(mockRefetchMovies).toHaveBeenCalledTimes(1);
  });

  it('should maintain independent state across multiple sections with errors', async () => {
    const user = userEvent.setup();
    
    // Mock multiple sections with errors
    vi.spyOn(useContentHooks, 'useMovies').mockReturnValue({
      content: [],
      loading: false,
      error: { message: 'Failed to load movies', details: new Error('Network error') },
      refetch: mockRefetchMovies,
      loadMore: vi.fn(),
      hasMore: false,
      status: 'error'
    });

    vi.spyOn(useContentHooks, 'useSeriesGrouped').mockReturnValue({
      content: [],
      seriesMap: new Map(),
      loading: false,
      error: { message: 'Failed to load series', details: new Error('Network error') },
      refetch: mockRefetchSeries,
      loadMore: vi.fn(),
      hasMore: false,
      status: 'error'
    });

    vi.spyOn(useContentHooks, 'useSitcoms').mockReturnValue({
      content: [],
      loading: false,
      error: null,
      refetch: mockRefetchSitcoms,
      loadMore: vi.fn(),
      hasMore: false,
      status: 'success'
    });

    vi.spyOn(useContentHooks, 'useKidsContent').mockReturnValue({
      content: [],
      loading: false,
      error: null,
      refetch: mockRefetchKids,
      loadMore: vi.fn(),
      hasMore: false,
      status: 'success'
    });

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    // Wait for both errors to appear
    await waitFor(() => {
      expect(screen.getByText('Failed to load movies')).toBeInTheDocument();
      expect(screen.getByText('Failed to load series')).toBeInTheDocument();
    });

    // Click Movies retry
    const moviesRetryButton = screen.getByRole('button', { name: /retry loading movies/i });
    await user.click(moviesRetryButton);

    // Verify only Movies refetch was called
    expect(mockRefetchMovies).toHaveBeenCalledTimes(1);
    expect(mockRefetchSeries).not.toHaveBeenCalled();

    // Reset mocks
    mockRefetchMovies.mockClear();

    // Click Series retry
    const seriesRetryButton = screen.getByRole('button', { name: /retry loading series/i });
    await user.click(seriesRetryButton);

    // Verify only Series refetch was called
    expect(mockRefetchSeries).toHaveBeenCalledTimes(1);
    expect(mockRefetchMovies).not.toHaveBeenCalled();
  });
});
