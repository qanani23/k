import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlayerModal from '../../src/components/PlayerModal';
import ForcedUpdateScreen from '../../src/components/ForcedUpdateScreen';
import EmergencyDisableScreen from '../../src/components/EmergencyDisableScreen';
import { ContentItem } from '../../src/types';

// Mock Tauri API
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}));

// Mock Plyr
vi.mock('plyr', () => ({
  default: vi.fn(() => ({
    on: vi.fn(),
    destroy: vi.fn(),
  })),
}));

// Mock hls.js
vi.mock('hls.js', () => ({
  default: vi.fn(() => ({
    loadSource: vi.fn(),
    attachMedia: vi.fn(),
    on: vi.fn(),
    destroy: vi.fn(),
  })),
  isSupported: vi.fn(() => true),
  Events: {
    MANIFEST_PARSED: 'hlsManifestParsed',
    ERROR: 'hlsError',
  },
  ErrorTypes: {
    NETWORK_ERROR: 'networkError',
    MEDIA_ERROR: 'mediaError',
  },
}));

// Mock API functions
vi.mock('../../src/lib/api', () => ({
  saveProgress: vi.fn(),
  getProgress: vi.fn(() => Promise.resolve(null)),
  streamOffline: vi.fn(() => Promise.resolve({ url: 'http://localhost:8080/test' })),
  openExternal: vi.fn(),
}));

describe('Modal Focus Management', () => {
  describe('PlayerModal Focus Management', () => {
    const mockContent: ContentItem = {
      claim_id: 'test-claim-123',
      title: 'Test Video',
      description: 'Test description',
      tags: ['movie', 'action_movies'],
      thumbnail_url: 'https://example.com/thumb.jpg',
      duration: 7200,
      release_time: Date.now(),
      video_urls: {
        '720p': { url: 'https://example.com/video.mp4', quality: '720p', type: 'mp4' },
        '1080p': { url: 'https://example.com/video-hd.mp4', quality: '1080p', type: 'mp4' },
      },
      compatibility: { compatible: true, fallback_available: false },
    };

    const mockOnClose = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should focus close button when modal opens', async () => {
      render(
        <PlayerModal
          content={mockContent}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      await waitFor(() => {
        const closeButton = screen.getByLabelText('Close player');
        expect(closeButton).toHaveFocus();
      }, { timeout: 200 });
    });

    it('should trap focus within modal using Tab key', async () => {
      const user = userEvent.setup();

      render(
        <PlayerModal
          content={mockContent}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      await waitFor(() => {
        const closeButton = screen.getByLabelText('Close player');
        expect(closeButton).toHaveFocus();
      }, { timeout: 200 });

      // Tab through all focusable elements
      await user.tab();
      
      // Should stay within modal
      const focusedElement = document.activeElement;
      const modalContainer = screen.getByRole('dialog');
      expect(modalContainer.contains(focusedElement)).toBe(true);
    });

    it('should trap focus when using Shift+Tab', async () => {
      const user = userEvent.setup();

      render(
        <PlayerModal
          content={mockContent}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      await waitFor(() => {
        const closeButton = screen.getByLabelText('Close player');
        expect(closeButton).toHaveFocus();
      }, { timeout: 200 });

      // Shift+Tab should cycle backwards
      await user.tab({ shift: true });
      
      // Should stay within modal
      const focusedElement = document.activeElement;
      const modalContainer = screen.getByRole('dialog');
      expect(modalContainer.contains(focusedElement)).toBe(true);
    });

    it('should restore focus to previous element when modal closes', async () => {
      const triggerButton = document.createElement('button');
      triggerButton.textContent = 'Open Modal';
      document.body.appendChild(triggerButton);
      triggerButton.focus();

      expect(triggerButton).toHaveFocus();

      const { rerender } = render(
        <PlayerModal
          content={mockContent}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      await waitFor(() => {
        const closeButton = screen.getByLabelText('Close player');
        expect(closeButton).toHaveFocus();
      }, { timeout: 200 });

      // Close modal
      rerender(
        <PlayerModal
          content={mockContent}
          isOpen={false}
          onClose={mockOnClose}
        />
      );

      await waitFor(() => {
        expect(triggerButton).toHaveFocus();
      });

      document.body.removeChild(triggerButton);
    });

    it('should have proper ARIA attributes for modal', () => {
      render(
        <PlayerModal
          content={mockContent}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby', 'player-modal-title');
    });

    it('should have accessible title for screen readers', () => {
      render(
        <PlayerModal
          content={mockContent}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const title = screen.getByText('Test Video');
      expect(title).toHaveAttribute('id', 'player-modal-title');
    });
  });

  describe('ForcedUpdateScreen Focus Management', () => {
    const mockProps = {
      latestVersion: '2.0.0',
      releaseNotes: 'New features and improvements',
      downloadUrl: 'https://example.com/download',
      onUpdate: vi.fn(),
      onExit: vi.fn(),
    };

    beforeEach(() => {
      vi.clearAllMocks();
      global.open = vi.fn();
    });

    it('should focus update button when screen opens', async () => {
      render(<ForcedUpdateScreen {...mockProps} />);

      await waitFor(() => {
        const updateButton = screen.getByLabelText('Update application now');
        expect(updateButton).toHaveFocus();
      }, { timeout: 200 });
    });

    it('should trap focus within modal using Tab key', async () => {
      const user = userEvent.setup();

      render(<ForcedUpdateScreen {...mockProps} />);

      await waitFor(() => {
        const updateButton = screen.getByLabelText('Update application now');
        expect(updateButton).toHaveFocus();
      }, { timeout: 200 });

      // Tab to next button
      await user.tab();
      
      const exitButton = screen.getByLabelText('Exit application');
      expect(exitButton).toHaveFocus();

      // Tab again should cycle back to first button
      await user.tab();
      
      const updateButton = screen.getByLabelText('Update application now');
      expect(updateButton).toHaveFocus();
    });

    it('should trap focus when using Shift+Tab', async () => {
      const user = userEvent.setup();

      render(<ForcedUpdateScreen {...mockProps} />);

      await waitFor(() => {
        const updateButton = screen.getByLabelText('Update application now');
        expect(updateButton).toHaveFocus();
      }, { timeout: 200 });

      // Shift+Tab should cycle to last button
      await user.tab({ shift: true });
      
      const exitButton = screen.getByLabelText('Exit application');
      expect(exitButton).toHaveFocus();
    });

    it('should have proper ARIA attributes for modal', () => {
      render(<ForcedUpdateScreen {...mockProps} />);

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby', 'forced-update-title');
    });

    it('should have accessible title for screen readers', () => {
      render(<ForcedUpdateScreen {...mockProps} />);

      const title = screen.getByText('Update Required');
      expect(title).toHaveAttribute('id', 'forced-update-title');
    });
  });

  describe('EmergencyDisableScreen Focus Management', () => {
    const mockProps = {
      releaseNotes: 'System maintenance in progress',
      onExit: vi.fn(),
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should focus exit button when screen opens', async () => {
      render(<EmergencyDisableScreen {...mockProps} />);

      await waitFor(() => {
        const exitButton = screen.getByLabelText('Exit application');
        expect(exitButton).toHaveFocus();
      }, { timeout: 200 });
    });

    it('should trap focus within modal', async () => {
      const user = userEvent.setup();

      render(<EmergencyDisableScreen {...mockProps} />);

      await waitFor(() => {
        const exitButton = screen.getByLabelText('Exit application');
        expect(exitButton).toHaveFocus();
      }, { timeout: 200 });

      // Tab should keep focus on the same button (only one focusable element)
      await user.tab();
      
      const exitButton = screen.getByLabelText('Exit application');
      expect(exitButton).toHaveFocus();
    });

    it('should have proper ARIA attributes for modal', () => {
      render(<EmergencyDisableScreen {...mockProps} />);

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby', 'emergency-disable-title');
    });

    it('should have accessible title for screen readers', () => {
      render(<EmergencyDisableScreen {...mockProps} />);

      const title = screen.getByText('Service Unavailable');
      expect(title).toHaveAttribute('id', 'emergency-disable-title');
    });
  });

  describe('General Focus Management Patterns', () => {
    it('should prevent focus from leaving modal container', async () => {
      const user = userEvent.setup();
      
      const mockContent: ContentItem = {
        claim_id: 'test-claim',
        title: 'Test',
        tags: ['movie'],
        video_urls: { '720p': { url: 'test.mp4', quality: '720p', type: 'mp4' } },
        compatibility: { compatible: true, fallback_available: false },
        release_time: Date.now(),
      };

      // Add an element outside the modal
      const outsideButton = document.createElement('button');
      outsideButton.textContent = 'Outside Modal';
      document.body.appendChild(outsideButton);

      render(
        <PlayerModal
          content={mockContent}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        const closeButton = screen.getByLabelText('Close player');
        expect(closeButton).toHaveFocus();
      }, { timeout: 200 });

      // Try to tab multiple times
      for (let i = 0; i < 10; i++) {
        await user.tab();
      }

      // Focus should never reach the outside button
      expect(outsideButton).not.toHaveFocus();

      document.body.removeChild(outsideButton);
    });

    it('should handle modals with multiple focusable elements', async () => {
      const user = userEvent.setup();

      const mockProps = {
        latestVersion: '2.0.0',
        releaseNotes: 'Updates',
        downloadUrl: 'https://example.com/download',
        onUpdate: vi.fn(),
        onExit: vi.fn(),
      };

      render(<ForcedUpdateScreen {...mockProps} />);

      await waitFor(() => {
        const updateButton = screen.getByLabelText('Update application now');
        expect(updateButton).toHaveFocus();
      }, { timeout: 200 });

      // Tab through all elements
      await user.tab();
      expect(screen.getByLabelText('Exit application')).toHaveFocus();

      // Tab again should cycle back
      await user.tab();
      expect(screen.getByLabelText('Update application now')).toHaveFocus();
    });
  });
});
