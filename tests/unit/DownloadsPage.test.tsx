import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import DownloadsPage from '../../src/pages/DownloadsPage';
import * as useDownloadManagerModule from '../../src/hooks/useDownloadManager';
import { DownloadProgress, OfflineMetadata } from '../../src/types';

// Mock the useDownloadManager hook
vi.mock('../../src/hooks/useDownloadManager');

// Mock window.open
const mockWindowOpen = vi.fn();
window.open = mockWindowOpen;

// Mock window.confirm
const mockConfirm = vi.fn();
window.confirm = mockConfirm;

// Mock window.history.back
const mockHistoryBack = vi.fn();
window.history.back = mockHistoryBack;

describe('DownloadsPage', () => {
  const mockDownloadManager = {
    downloads: [] as DownloadProgress[],
    offlineContent: [] as OfflineMetadata[],
    deleteDownload: vi.fn(),
    getOfflineUrl: vi.fn(),
    cancelDownload: vi.fn(),
    getTotalDownloads: vi.fn(() => 0),
    getTotalDownloadSize: vi.fn(() => 0),
    downloadContent: vi.fn(),
    isDownloading: vi.fn(),
    isOfflineAvailable: vi.fn(),
    getDownloadProgress: vi.fn(),
    getOfflineMetadata: vi.fn(),
    getActiveDownloads: vi.fn(() => []),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockReturnValue(true);
    
    // Reset mock implementation
    vi.mocked(useDownloadManagerModule.useDownloadManager).mockReturnValue(mockDownloadManager);
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <DownloadsPage />
      </BrowserRouter>
    );
  };

  describe('Page Structure', () => {
    it('should render the page header', () => {
      renderComponent();
      
      expect(screen.getByText('Downloads')).toBeInTheDocument();
      expect(screen.getByText('Manage your offline content and active downloads')).toBeInTheDocument();
    });

    it('should render stats cards', () => {
      renderComponent();
      
      expect(screen.getByText('Active Downloads')).toBeInTheDocument();
      expect(screen.getByText('Offline Content')).toBeInTheDocument();
      expect(screen.getByText('Storage Used')).toBeInTheDocument();
    });

    it('should render tab navigation', () => {
      renderComponent();
      
      expect(screen.getByRole('button', { name: /Active Downloads/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Offline Content/i })).toBeInTheDocument();
    });
  });

  describe('Stats Display', () => {
    it('should display correct active downloads count', () => {
      const mockDownloads: DownloadProgress[] = [
        {
          claim_id: 'claim1',
          quality: '720p',
          percent: 50,
          bytes_written: 1024 * 1024 * 50,
          total_bytes: 1024 * 1024 * 100,
          speed_bytes_per_sec: 1024 * 1024,
        },
        {
          claim_id: 'claim2',
          quality: '1080p',
          percent: 25,
          bytes_written: 1024 * 1024 * 25,
          total_bytes: 1024 * 1024 * 100,
        },
      ];

      vi.mocked(useDownloadManagerModule.useDownloadManager).mockReturnValue({
        ...mockDownloadManager,
        downloads: mockDownloads,
      });

      renderComponent();
      
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should display correct offline content count', () => {
      vi.mocked(useDownloadManagerModule.useDownloadManager).mockReturnValue({
        ...mockDownloadManager,
        getTotalDownloads: vi.fn(() => 5),
      });

      renderComponent();
      
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should display formatted storage size', () => {
      vi.mocked(useDownloadManagerModule.useDownloadManager).mockReturnValue({
        ...mockDownloadManager,
        getTotalDownloadSize: vi.fn(() => 1024 * 1024 * 1024 * 2.5), // 2.5 GB
      });

      renderComponent();
      
      expect(screen.getByText('2.5 GB')).toBeInTheDocument();
    });
  });

  describe('Active Downloads Tab', () => {
    it('should display active downloads with progress bars', () => {
      const mockDownloads: DownloadProgress[] = [
        {
          claim_id: 'test-claim-1',
          quality: '720p',
          percent: 45.5,
          bytes_written: 1024 * 1024 * 45,
          total_bytes: 1024 * 1024 * 100,
          speed_bytes_per_sec: 1024 * 1024 * 2,
        },
      ];

      vi.mocked(useDownloadManagerModule.useDownloadManager).mockReturnValue({
        ...mockDownloadManager,
        downloads: mockDownloads,
      });

      renderComponent();
      
      expect(screen.getByText('test-claim-1')).toBeInTheDocument();
      expect(screen.getByText('Quality: 720p')).toBeInTheDocument();
      expect(screen.getByText('46% complete')).toBeInTheDocument();
      expect(screen.getByText(/45\.0 MB/)).toBeInTheDocument();
      expect(screen.getByText(/100\.0 MB/)).toBeInTheDocument();
    });

    it('should display download speed when available', () => {
      const mockDownloads: DownloadProgress[] = [
        {
          claim_id: 'test-claim',
          quality: '1080p',
          percent: 30,
          bytes_written: 1024 * 1024 * 30,
          total_bytes: 1024 * 1024 * 100,
          speed_bytes_per_sec: 1024 * 1024 * 5,
        },
      ];

      vi.mocked(useDownloadManagerModule.useDownloadManager).mockReturnValue({
        ...mockDownloadManager,
        downloads: mockDownloads,
      });

      renderComponent();
      
      expect(screen.getByText(/Speed: 5\.0 MB\/s/)).toBeInTheDocument();
    });

    it('should show empty state when no active downloads', () => {
      renderComponent();
      
      expect(screen.getByText('No Active Downloads')).toBeInTheDocument();
      expect(screen.getByText('Start downloading content to watch offline')).toBeInTheDocument();
    });

    it('should handle cancel download', async () => {
      const user = userEvent.setup();
      const mockDownloads: DownloadProgress[] = [
        {
          claim_id: 'test-claim',
          quality: '720p',
          percent: 50,
          bytes_written: 1024 * 1024 * 50,
          total_bytes: 1024 * 1024 * 100,
        },
      ];

      vi.mocked(useDownloadManagerModule.useDownloadManager).mockReturnValue({
        ...mockDownloadManager,
        downloads: mockDownloads,
      });

      renderComponent();
      
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockConfirm).toHaveBeenCalledWith(
        'Cancel download of "test-claim" (720p)?'
      );
      expect(mockDownloadManager.cancelDownload).toHaveBeenCalledWith('test-claim', '720p');
    });

    it('should not cancel download if user declines confirmation', async () => {
      const user = userEvent.setup();
      mockConfirm.mockReturnValue(false);

      const mockDownloads: DownloadProgress[] = [
        {
          claim_id: 'test-claim',
          quality: '720p',
          percent: 50,
          bytes_written: 1024 * 1024 * 50,
        },
      ];

      vi.mocked(useDownloadManagerModule.useDownloadManager).mockReturnValue({
        ...mockDownloadManager,
        downloads: mockDownloads,
      });

      renderComponent();
      
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockDownloadManager.cancelDownload).not.toHaveBeenCalled();
    });
  });

  describe('Offline Content Tab', () => {
    it('should switch to offline content tab', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const offlineTab = screen.getByRole('button', { name: /Offline Content/i });
      await user.click(offlineTab);

      expect(offlineTab).toHaveClass('bg-white/10');
    });

    it('should display offline content list', async () => {
      const user = userEvent.setup();
      const mockOfflineContent: OfflineMetadata[] = [
        {
          claim_id: 'offline-claim-1',
          quality: '1080p',
          filename: 'video1.mp4',
          file_size: 1024 * 1024 * 1024 * 1.5,
          encrypted: false,
          added_at: Math.floor(Date.now() / 1000) - 86400,
        },
        {
          claim_id: 'offline-claim-2',
          quality: '720p',
          filename: 'video2.mp4',
          file_size: 1024 * 1024 * 500,
          encrypted: true,
          added_at: Math.floor(Date.now() / 1000) - 172800,
        },
      ];

      vi.mocked(useDownloadManagerModule.useDownloadManager).mockReturnValue({
        ...mockDownloadManager,
        offlineContent: mockOfflineContent,
        getTotalDownloads: vi.fn(() => 2),
      });

      renderComponent();
      
      const offlineTab = screen.getByRole('button', { name: /Offline Content/i });
      await user.click(offlineTab);

      expect(screen.getByText('offline-claim-1')).toBeInTheDocument();
      expect(screen.getByText('offline-claim-2')).toBeInTheDocument();
      expect(screen.getByText('Quality: 1080p')).toBeInTheDocument();
      expect(screen.getByText('Quality: 720p')).toBeInTheDocument();
    });

    it('should display encrypted badge for encrypted content', async () => {
      const user = userEvent.setup();
      const mockOfflineContent: OfflineMetadata[] = [
        {
          claim_id: 'encrypted-claim',
          quality: '720p',
          filename: 'video.mp4',
          file_size: 1024 * 1024 * 500,
          encrypted: true,
          added_at: Math.floor(Date.now() / 1000),
        },
      ];

      vi.mocked(useDownloadManagerModule.useDownloadManager).mockReturnValue({
        ...mockDownloadManager,
        offlineContent: mockOfflineContent,
        getTotalDownloads: vi.fn(() => 1),
      });

      renderComponent();
      
      const offlineTab = screen.getByRole('button', { name: /Offline Content/i });
      await user.click(offlineTab);

      expect(screen.getByText('Encrypted')).toBeInTheDocument();
    });

    it('should show empty state when no offline content', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const offlineTab = screen.getByRole('button', { name: /Offline Content/i });
      await user.click(offlineTab);

      expect(screen.getByText('No Offline Content')).toBeInTheDocument();
      expect(screen.getByText('Download movies and episodes to watch them offline')).toBeInTheDocument();
    });

    it('should handle play offline content', async () => {
      const user = userEvent.setup();
      const mockOfflineContent: OfflineMetadata[] = [
        {
          claim_id: 'play-claim',
          quality: '720p',
          filename: 'video.mp4',
          file_size: 1024 * 1024 * 500,
          encrypted: false,
          added_at: Math.floor(Date.now() / 1000),
        },
      ];

      mockDownloadManager.getOfflineUrl.mockResolvedValue('http://localhost:8080/movies/play-claim');

      vi.mocked(useDownloadManagerModule.useDownloadManager).mockReturnValue({
        ...mockDownloadManager,
        offlineContent: mockOfflineContent,
        getTotalDownloads: vi.fn(() => 1),
      });

      renderComponent();
      
      const offlineTab = screen.getByRole('button', { name: /Offline Content/i });
      await user.click(offlineTab);

      // Use more specific selector to get the Play button (not the Delete button)
      const playButton = screen.getByRole('button', { name: /Play play-claim offline/i });
      await user.click(playButton);

      await waitFor(() => {
        expect(mockDownloadManager.getOfflineUrl).toHaveBeenCalledWith('play-claim', '720p');
      });

      expect(mockWindowOpen).toHaveBeenCalledWith('http://localhost:8080/movies/play-claim', '_blank');
    });

    it('should handle delete offline content', async () => {
      const user = userEvent.setup();
      const mockOfflineContent: OfflineMetadata[] = [
        {
          claim_id: 'delete-claim',
          quality: '720p',
          filename: 'video.mp4',
          file_size: 1024 * 1024 * 500,
          encrypted: false,
          added_at: Math.floor(Date.now() / 1000),
        },
      ];

      vi.mocked(useDownloadManagerModule.useDownloadManager).mockReturnValue({
        ...mockDownloadManager,
        offlineContent: mockOfflineContent,
        getTotalDownloads: vi.fn(() => 1),
      });

      renderComponent();
      
      const offlineTab = screen.getByRole('button', { name: /Offline Content/i });
      await user.click(offlineTab);

      // Find delete button by looking for the trash icon
      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons.find(btn => {
        const svg = btn.querySelector('svg.lucide-trash2');
        return svg !== null;
      });

      expect(deleteButton).toBeDefined();
      if (deleteButton) {
        await user.click(deleteButton);
        expect(mockConfirm).toHaveBeenCalledWith('Delete "delete-claim" (720p)?');
        expect(mockDownloadManager.deleteDownload).toHaveBeenCalledWith('delete-claim', '720p');
      }
    });

    it('should not delete if user declines confirmation', async () => {
      const user = userEvent.setup();
      mockConfirm.mockReturnValue(false);

      const mockOfflineContent: OfflineMetadata[] = [
        {
          claim_id: 'delete-claim',
          quality: '720p',
          filename: 'video.mp4',
          file_size: 1024 * 1024 * 500,
          encrypted: false,
          added_at: Math.floor(Date.now() / 1000),
        },
      ];

      vi.mocked(useDownloadManagerModule.useDownloadManager).mockReturnValue({
        ...mockDownloadManager,
        offlineContent: mockOfflineContent,
        getTotalDownloads: vi.fn(() => 1),
      });

      renderComponent();
      
      const offlineTab = screen.getByRole('button', { name: /Offline Content/i });
      await user.click(offlineTab);

      // Find delete button by looking for the trash icon
      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons.find(btn => {
        const svg = btn.querySelector('svg.lucide-trash2');
        return svg !== null;
      });

      if (deleteButton) {
        await user.click(deleteButton);
      }

      expect(mockDownloadManager.deleteDownload).not.toHaveBeenCalled();
    });

    it('should handle browse content button in empty state', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const offlineTab = screen.getByRole('button', { name: /Offline Content/i });
      await user.click(offlineTab);

      const browseButton = screen.getByRole('button', { name: /Browse Content/i });
      await user.click(browseButton);

      expect(mockHistoryBack).toHaveBeenCalled();
    });
  });

  describe('Progress Bar Rendering', () => {
    it('should render progress bar with correct width', () => {
      const mockDownloads: DownloadProgress[] = [
        {
          claim_id: 'progress-claim',
          quality: '720p',
          percent: 75,
          bytes_written: 1024 * 1024 * 75,
          total_bytes: 1024 * 1024 * 100,
        },
      ];

      vi.mocked(useDownloadManagerModule.useDownloadManager).mockReturnValue({
        ...mockDownloadManager,
        downloads: mockDownloads,
      });

      renderComponent();
      
      const progressFill = document.querySelector('.progress-fill') as HTMLElement;
      expect(progressFill).toBeInTheDocument();
      expect(progressFill.style.width).toBe('75%');
    });

    it('should handle progress without total bytes', () => {
      const mockDownloads: DownloadProgress[] = [
        {
          claim_id: 'unknown-size-claim',
          quality: '720p',
          percent: 50,
          bytes_written: 1024 * 1024 * 50,
        },
      ];

      vi.mocked(useDownloadManagerModule.useDownloadManager).mockReturnValue({
        ...mockDownloadManager,
        downloads: mockDownloads,
      });

      renderComponent();
      
      expect(screen.getByText('50% complete')).toBeInTheDocument();
      expect(screen.getByText('50.0 MB')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle play offline error gracefully', async () => {
      const user = userEvent.setup();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const mockOfflineContent: OfflineMetadata[] = [
        {
          claim_id: 'error-claim',
          quality: '720p',
          filename: 'video.mp4',
          file_size: 1024 * 1024 * 500,
          encrypted: false,
          added_at: Math.floor(Date.now() / 1000),
        },
      ];

      mockDownloadManager.getOfflineUrl.mockRejectedValue(new Error('Server not running'));

      vi.mocked(useDownloadManagerModule.useDownloadManager).mockReturnValue({
        ...mockDownloadManager,
        offlineContent: mockOfflineContent,
        getTotalDownloads: vi.fn(() => 1),
      });

      renderComponent();
      
      const offlineTab = screen.getByRole('button', { name: /Offline Content/i });
      await user.click(offlineTab);

      const playButton = screen.getByRole('button', { name: /Play/i });
      await user.click(playButton);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Failed to play offline content:',
          expect.any(Error)
        );
      });

      consoleError.mockRestore();
    });

    it('should handle delete offline error gracefully', async () => {
      const user = userEvent.setup();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const mockOfflineContent: OfflineMetadata[] = [
        {
          claim_id: 'error-claim',
          quality: '720p',
          filename: 'video.mp4',
          file_size: 1024 * 1024 * 500,
          encrypted: false,
          added_at: Math.floor(Date.now() / 1000),
        },
      ];

      mockDownloadManager.deleteDownload.mockRejectedValue(new Error('File not found'));

      vi.mocked(useDownloadManagerModule.useDownloadManager).mockReturnValue({
        ...mockDownloadManager,
        offlineContent: mockOfflineContent,
        getTotalDownloads: vi.fn(() => 1),
      });

      renderComponent();
      
      const offlineTab = screen.getByRole('button', { name: /Offline Content/i });
      await user.click(offlineTab);

      // Find delete button by looking for the trash icon
      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons.find(btn => {
        const svg = btn.querySelector('svg.lucide-trash2');
        return svg !== null;
      });

      if (deleteButton) {
        await user.click(deleteButton);

        await waitFor(() => {
          const errorCalls = consoleError.mock.calls.filter(call => 
            call[0] === 'Failed to delete download:'
          );
          expect(errorCalls.length).toBeGreaterThan(0);
        });
      }

      consoleError.mockRestore();
    });
  });

  describe('Tab Navigation', () => {
    it('should maintain active tab state', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const activeTab = screen.getByRole('button', { name: /Active Downloads/i });
      const offlineTab = screen.getByRole('button', { name: /Offline Content/i });

      // Initially active tab should be highlighted
      expect(activeTab).toHaveClass('bg-white/10');
      expect(offlineTab).not.toHaveClass('bg-white/10');

      // Switch to offline tab
      await user.click(offlineTab);
      expect(offlineTab).toHaveClass('bg-white/10');
      expect(activeTab).not.toHaveClass('bg-white/10');

      // Switch back to active tab
      await user.click(activeTab);
      expect(activeTab).toHaveClass('bg-white/10');
      expect(offlineTab).not.toHaveClass('bg-white/10');
    });
  });

  describe('Multiple Downloads', () => {
    it('should display multiple active downloads', () => {
      const mockDownloads: DownloadProgress[] = [
        {
          claim_id: 'claim-1',
          quality: '1080p',
          percent: 25,
          bytes_written: 1024 * 1024 * 25,
          total_bytes: 1024 * 1024 * 100,
        },
        {
          claim_id: 'claim-2',
          quality: '720p',
          percent: 50,
          bytes_written: 1024 * 1024 * 50,
          total_bytes: 1024 * 1024 * 100,
        },
        {
          claim_id: 'claim-3',
          quality: '480p',
          percent: 75,
          bytes_written: 1024 * 1024 * 75,
          total_bytes: 1024 * 1024 * 100,
        },
      ];

      vi.mocked(useDownloadManagerModule.useDownloadManager).mockReturnValue({
        ...mockDownloadManager,
        downloads: mockDownloads,
      });

      renderComponent();
      
      expect(screen.getByText('claim-1')).toBeInTheDocument();
      expect(screen.getByText('claim-2')).toBeInTheDocument();
      expect(screen.getByText('claim-3')).toBeInTheDocument();
      expect(screen.getByText('25% complete')).toBeInTheDocument();
      expect(screen.getByText('50% complete')).toBeInTheDocument();
      expect(screen.getByText('75% complete')).toBeInTheDocument();
    });

    it('should display multiple offline content items', async () => {
      const user = userEvent.setup();
      const mockOfflineContent: OfflineMetadata[] = [
        {
          claim_id: 'offline-1',
          quality: '1080p',
          filename: 'video1.mp4',
          file_size: 1024 * 1024 * 1024,
          encrypted: false,
          added_at: Math.floor(Date.now() / 1000),
        },
        {
          claim_id: 'offline-2',
          quality: '720p',
          filename: 'video2.mp4',
          file_size: 1024 * 1024 * 500,
          encrypted: true,
          added_at: Math.floor(Date.now() / 1000),
        },
      ];

      vi.mocked(useDownloadManagerModule.useDownloadManager).mockReturnValue({
        ...mockDownloadManager,
        offlineContent: mockOfflineContent,
        getTotalDownloads: vi.fn(() => 2),
      });

      renderComponent();
      
      const offlineTab = screen.getByRole('button', { name: /Offline Content/i });
      await user.click(offlineTab);

      expect(screen.getByText('offline-1')).toBeInTheDocument();
      expect(screen.getByText('offline-2')).toBeInTheDocument();
    });
  });
});
