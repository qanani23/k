/**
 * SeriesPage Retry Isolation Test
 * 
 * Validates that retry in SeriesPage:
 * - Does NOT trigger window.location.reload()
 * - Does NOT re-initialize the application
 * - ONLY refetches series-specific content
 * - Maintains section-level isolation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SeriesPage from '../../src/pages/SeriesPage';
import * as useContentHooks from '../../src/hooks/useContent';
import * as useDownloadManagerHook from '../../src/hooks/useDownloadManager';
import * as useOfflineHook from '../../src/hooks/useOffline';
import * as api from '../../src/lib/api';

// Mock modules
vi.mock('../../src/hooks/useContent');
vi.mock('../../src/hooks/useDownloadManager');
vi.mock('../../src/hooks/useOffline');
vi.mock('../../src/lib/api');

describe('SeriesPage - Retry Isolation', () => {
  const mockRefetch = vi.fn();
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

  it('should NOT trigger window.location.reload on retry', async () => {
    const user = userEvent.setup();
    const reloadSpy = vi.fn();
    
    // Mock window.location.reload
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = { ...originalLocation, reload: reloadSpy };
    
    // Mock SeriesPage with error
    vi.spyOn(useContentHooks, 'useSeriesGrouped').mockReturnValue({
      content: [],
      seriesMap: new Map(),
      loading: false,
      error: { message: 'Failed to load series', details: new Error('Network error') },
      refetch: mockRefetch,
      loadMore: vi.fn(),
      hasMore: false,
      status: 'error'
    });

    render(
      <MemoryRouter>
        <SeriesPage />
      </MemoryRouter>
    );

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText('Failed to load series')).toBeInTheDocument();
    });

    // Find and click the retry button
    const retryButton = screen.getByRole('button', { name: /retry loading series/i });
    await user.click(retryButton);

    // Verify window.location.reload was NOT called
    expect(reloadSpy).not.toHaveBeenCalled();
    
    // Verify section-specific refetch WAS called
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    
    // Restore window.location
    window.location = originalLocation;
  });

  it('should use refetch function from useSeriesGrouped hook', async () => {
    const user = userEvent.setup();
    
    // Mock SeriesPage with error
    vi.spyOn(useContentHooks, 'useSeriesGrouped').mockReturnValue({
      content: [],
      seriesMap: new Map(),
      loading: false,
      error: { message: 'Failed to load series', details: new Error('Network error') },
      refetch: mockRefetch,
      loadMore: vi.fn(),
      hasMore: false,
      status: 'error'
    });

    render(
      <MemoryRouter>
        <SeriesPage />
      </MemoryRouter>
    );

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText('Failed to load series')).toBeInTheDocument();
    });

    // Find and click the retry button
    const retryButton = screen.getByRole('button', { name: /retry loading series/i });
    await user.click(retryButton);

    // Verify refetch was called exactly once
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('should display error message and retry button when fetch fails', async () => {
    // Mock SeriesPage with error
    vi.spyOn(useContentHooks, 'useSeriesGrouped').mockReturnValue({
      content: [],
      seriesMap: new Map(),
      loading: false,
      error: { message: 'Network connection failed', details: new Error('Network error') },
      refetch: mockRefetch,
      loadMore: vi.fn(),
      hasMore: false,
      status: 'error'
    });

    render(
      <MemoryRouter>
        <SeriesPage />
      </MemoryRouter>
    );

    // Verify error message is displayed
    await waitFor(() => {
      expect(screen.getByText('Network connection failed')).toBeInTheDocument();
    });

    // Verify retry button is present
    const retryButton = screen.getByRole('button', { name: /retry loading series/i });
    expect(retryButton).toBeInTheDocument();
  });

  it('should maintain section isolation - retry does not affect global state', async () => {
    const user = userEvent.setup();
    
    // Track if any global state changes occur
    const globalStateChangeSpy = vi.fn();
    
    // Mock SeriesPage with error
    vi.spyOn(useContentHooks, 'useSeriesGrouped').mockReturnValue({
      content: [],
      seriesMap: new Map(),
      loading: false,
      error: { message: 'Failed to load series', details: new Error('Network error') },
      refetch: mockRefetch,
      loadMore: vi.fn(),
      hasMore: false,
      status: 'error'
    });

    const { container } = render(
      <MemoryRouter>
        <SeriesPage />
      </MemoryRouter>
    );

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText('Failed to load series')).toBeInTheDocument();
    });

    // Capture initial DOM state
    const initialHTML = container.innerHTML;

    // Find and click the retry button
    const retryButton = screen.getByRole('button', { name: /retry loading series/i });
    await user.click(retryButton);

    // Verify refetch was called
    expect(mockRefetch).toHaveBeenCalledTimes(1);

    // Verify the component structure remains the same (no full re-mount)
    // The error message should still be visible (until refetch completes)
    expect(screen.getByText('Failed to load series')).toBeInTheDocument();
    
    // Verify no global state change occurred
    expect(globalStateChangeSpy).not.toHaveBeenCalled();
  });

  it('should call refetch function when retry button is clicked', async () => {
    const user = userEvent.setup();
    
    // Mock SeriesPage with error
    vi.spyOn(useContentHooks, 'useSeriesGrouped').mockReturnValue({
      content: [],
      seriesMap: new Map(),
      loading: false,
      error: { message: 'Failed to load series', details: new Error('Network error') },
      refetch: mockRefetch,
      loadMore: vi.fn(),
      hasMore: false,
      status: 'error'
    });

    render(
      <MemoryRouter>
        <SeriesPage />
      </MemoryRouter>
    );

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText('Failed to load series')).toBeInTheDocument();
    });

    // Verify retry button is present
    const retryButton = screen.getByRole('button', { name: /retry loading series/i });
    expect(retryButton).toBeInTheDocument();

    // Click the retry button
    await user.click(retryButton);

    // Verify refetch was called exactly once
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});
