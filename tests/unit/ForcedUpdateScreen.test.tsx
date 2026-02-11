import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ForcedUpdateScreen from '../../src/components/ForcedUpdateScreen';

describe('ForcedUpdateScreen Component', () => {
  const mockOnUpdate = vi.fn();
  const mockOnExit = vi.fn();
  const mockWindowOpen = vi.fn();

  const defaultProps = {
    latestVersion: '2.0.0',
    releaseNotes: 'Security fixes and performance improvements',
    downloadUrl: 'https://example.com/download',
    onUpdate: mockOnUpdate,
    onExit: mockOnExit,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.open
    window.open = mockWindowOpen;
  });

  describe('Rendering', () => {
    it('should render with all required elements', () => {
      render(<ForcedUpdateScreen {...defaultProps} />);

      expect(screen.getByText('Update Required')).toBeInTheDocument();
      expect(screen.getByText(/A new version of Kiyya is available and required to continue/)).toBeInTheDocument();
      expect(screen.getByText('Version 2.0.0')).toBeInTheDocument();
      expect(screen.getByText('Security fixes and performance improvements')).toBeInTheDocument();
    });

    it('should render Update and Exit buttons', () => {
      render(<ForcedUpdateScreen {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Update Now/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Exit/i })).toBeInTheDocument();
    });

    it('should render warning message about required update', () => {
      render(<ForcedUpdateScreen {...defaultProps} />);

      expect(screen.getByText(/This update is required for security and compatibility/)).toBeInTheDocument();
      expect(screen.getByText(/The application cannot continue without updating/)).toBeInTheDocument();
    });

    it('should render with multiline release notes', () => {
      const multilineNotes = 'Line 1\nLine 2\nLine 3';
      render(<ForcedUpdateScreen {...defaultProps} releaseNotes={multilineNotes} />);

      expect(screen.getByText('Line 1')).toBeInTheDocument();
      expect(screen.getByText('Line 2')).toBeInTheDocument();
      expect(screen.getByText('Line 3')).toBeInTheDocument();
    });
  });

  describe('UI Blocking Behavior', () => {
    it('should render as full-screen overlay with high z-index', () => {
      const { container } = render(<ForcedUpdateScreen {...defaultProps} />);

      const overlay = container.firstChild as HTMLElement;
      expect(overlay).toHaveClass('fixed', 'inset-0', 'z-50');
    });

    it('should have dark background to block underlying content', () => {
      const { container } = render(<ForcedUpdateScreen {...defaultProps} />);

      const overlay = container.firstChild as HTMLElement;
      expect(overlay).toHaveClass('bg-slate-900');
    });
  });

  describe('User Interactions', () => {
    it('should open download URL in external browser when Update button is clicked', async () => {
      const user = userEvent.setup();
      render(<ForcedUpdateScreen {...defaultProps} />);

      const updateButton = screen.getByRole('button', { name: /Update Now/i });
      await user.click(updateButton);

      expect(mockWindowOpen).toHaveBeenCalledWith('https://example.com/download', '_blank');
      expect(mockOnUpdate).toHaveBeenCalledTimes(1);
    });

    it('should call onExit when Exit button is clicked', async () => {
      const user = userEvent.setup();
      render(<ForcedUpdateScreen {...defaultProps} />);

      const exitButton = screen.getByRole('button', { name: /Exit/i });
      await user.click(exitButton);

      expect(mockOnExit).toHaveBeenCalledTimes(1);
      expect(mockWindowOpen).not.toHaveBeenCalled();
    });

    it('should handle multiple Update button clicks', async () => {
      const user = userEvent.setup();
      render(<ForcedUpdateScreen {...defaultProps} />);

      const updateButton = screen.getByRole('button', { name: /Update Now/i });
      await user.click(updateButton);
      await user.click(updateButton);

      expect(mockWindowOpen).toHaveBeenCalledTimes(2);
      expect(mockOnUpdate).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple Exit button clicks', async () => {
      const user = userEvent.setup();
      render(<ForcedUpdateScreen {...defaultProps} />);

      const exitButton = screen.getByRole('button', { name: /Exit/i });
      await user.click(exitButton);
      await user.click(exitButton);

      expect(mockOnExit).toHaveBeenCalledTimes(2);
    });
  });

  describe('Content Display', () => {
    it('should display version number correctly', () => {
      render(<ForcedUpdateScreen {...defaultProps} latestVersion="3.5.2" />);

      expect(screen.getByText('Version 3.5.2')).toBeInTheDocument();
    });

    it('should handle empty release notes', () => {
      render(<ForcedUpdateScreen {...defaultProps} releaseNotes="" />);

      // Component should still render without errors
      expect(screen.getByText('Update Required')).toBeInTheDocument();
    });

    it('should display download icon in Update button', () => {
      render(<ForcedUpdateScreen {...defaultProps} />);

      const updateButton = screen.getByRole('button', { name: /Update Now/i });
      const icon = updateButton.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should display exit icon in Exit button', () => {
      render(<ForcedUpdateScreen {...defaultProps} />);

      const exitButton = screen.getByRole('button', { name: /Exit/i });
      const icon = exitButton.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper button labels', () => {
      render(<ForcedUpdateScreen {...defaultProps} />);

      const updateButton = screen.getByRole('button', { name: /Update Now/i });
      const exitButton = screen.getByRole('button', { name: /Exit/i });

      expect(updateButton).toBeInTheDocument();
      expect(exitButton).toBeInTheDocument();
    });

    it('should have proper heading hierarchy', () => {
      const { container } = render(<ForcedUpdateScreen {...defaultProps} />);

      const h1 = container.querySelector('h1');
      const h2 = container.querySelector('h2');

      expect(h1).toHaveTextContent('Update Required');
      expect(h2).toHaveTextContent('Version 2.0.0');
    });

    it('should have scrollable release notes for long content', () => {
      const longNotes = Array(20).fill('This is a long line of release notes').join('\n');
      const { container } = render(<ForcedUpdateScreen {...defaultProps} releaseNotes={longNotes} />);

      const notesContainer = container.querySelector('.max-h-32.overflow-y-auto');
      expect(notesContainer).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in release notes', () => {
      const specialNotes = 'Update includes: <script>alert("test")</script> & "quotes" & \'apostrophes\'';
      render(<ForcedUpdateScreen {...defaultProps} releaseNotes={specialNotes} />);

      expect(screen.getByText(/Update includes:/)).toBeInTheDocument();
    });

    it('should handle very long version strings', () => {
      const longVersion = '10.20.30.40.50.60.70.80.90.100';
      render(<ForcedUpdateScreen {...defaultProps} latestVersion={longVersion} />);

      expect(screen.getByText(`Version ${longVersion}`)).toBeInTheDocument();
    });

    it('should handle empty download URL', () => {
      render(<ForcedUpdateScreen {...defaultProps} downloadUrl="" />);

      const updateButton = screen.getByRole('button', { name: /Update Now/i });
      expect(updateButton).toBeInTheDocument();
    });
  });

  describe('Visual Styling', () => {
    it('should have proper button styling classes', () => {
      render(<ForcedUpdateScreen {...defaultProps} />);

      const updateButton = screen.getByRole('button', { name: /Update Now/i });
      const exitButton = screen.getByRole('button', { name: /Exit/i });

      expect(updateButton).toHaveClass('bg-blue-600', 'hover:bg-blue-700');
      expect(exitButton).toHaveClass('bg-slate-600', 'hover:bg-slate-700');
    });

    it('should have warning styling for alert message', () => {
      const { container } = render(<ForcedUpdateScreen {...defaultProps} />);

      const warningBox = container.querySelector('.bg-yellow-900\\/50');
      expect(warningBox).toBeInTheDocument();
    });

    it('should center content on screen', () => {
      const { container } = render(<ForcedUpdateScreen {...defaultProps} />);

      const overlay = container.firstChild as HTMLElement;
      expect(overlay).toHaveClass('flex', 'items-center', 'justify-center');
    });
  });
});
