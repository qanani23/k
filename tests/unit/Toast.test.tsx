import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Toast from '../../src/components/Toast';
import { ToastMessage } from '../../src/types';

describe('Toast Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const mockOnClose = vi.fn();

  const createToast = (type: ToastMessage['type']): ToastMessage => ({
    id: '1',
    type,
    title: `${type} title`,
    message: `${type} message`,
  });

  describe('Rendering', () => {
    it('should render toast with title and message', () => {
      const toast = createToast('info');
      render(<Toast toast={toast} onClose={mockOnClose} />);

      expect(screen.getByText('info title')).toBeInTheDocument();
      expect(screen.getByText('info message')).toBeInTheDocument();
    });

    it('should render toast without message', () => {
      const toast: ToastMessage = {
        id: '1',
        type: 'info',
        title: 'Title only',
        message: '',
      };
      const { container } = render(<Toast toast={toast} onClose={mockOnClose} />);

      expect(screen.getByText('Title only')).toBeInTheDocument();
      // Verify message paragraph is not rendered when message is empty
      const messageParagraph = container.querySelector('p.text-sm.text-text-secondary');
      expect(messageParagraph).not.toBeInTheDocument();
    });

    it('should render close button with aria-label', () => {
      const toast = createToast('info');
      render(<Toast toast={toast} onClose={mockOnClose} />);

      const closeButton = screen.getByLabelText('Close notification');
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Toast Types', () => {
    it('should render success toast with correct icon and styling', () => {
      const toast = createToast('success');
      const { container } = render(<Toast toast={toast} onClose={mockOnClose} />);

      expect(container.querySelector('.toast-success')).toBeInTheDocument();
      expect(screen.getByText('success title')).toBeInTheDocument();
    });

    it('should render error toast with correct icon and styling', () => {
      const toast = createToast('error');
      const { container } = render(<Toast toast={toast} onClose={mockOnClose} />);

      expect(container.querySelector('.toast-error')).toBeInTheDocument();
      expect(screen.getByText('error title')).toBeInTheDocument();
    });

    it('should render warning toast with correct icon and styling', () => {
      const toast = createToast('warning');
      const { container } = render(<Toast toast={toast} onClose={mockOnClose} />);

      expect(container.querySelector('.toast-warning')).toBeInTheDocument();
      expect(screen.getByText('warning title')).toBeInTheDocument();
    });

    it('should render info toast with correct icon and styling', () => {
      const toast = createToast('info');
      const { container } = render(<Toast toast={toast} onClose={mockOnClose} />);

      expect(container.querySelector('.toast-info')).toBeInTheDocument();
      expect(screen.getByText('info title')).toBeInTheDocument();
    });
  });

  describe('Auto-close Behavior', () => {
    it('should auto-close after default duration (5000ms)', async () => {
      const toast = createToast('info');
      render(<Toast toast={toast} onClose={mockOnClose} autoClose={true} />);

      expect(mockOnClose).not.toHaveBeenCalled();

      vi.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should auto-close after custom duration', async () => {
      const toast = createToast('info');
      render(<Toast toast={toast} onClose={mockOnClose} autoClose={true} duration={3000} />);

      expect(mockOnClose).not.toHaveBeenCalled();

      vi.advanceTimersByTime(3000);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should not auto-close when autoClose is false', async () => {
      const toast = createToast('info');
      render(<Toast toast={toast} onClose={mockOnClose} autoClose={false} />);

      vi.advanceTimersByTime(10000);

      await waitFor(() => {
        expect(mockOnClose).not.toHaveBeenCalled();
      });
    });

    it('should cleanup timer on unmount', () => {
      const toast = createToast('info');
      const { unmount } = render(<Toast toast={toast} onClose={mockOnClose} autoClose={true} />);

      unmount();

      vi.advanceTimersByTime(5000);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('User Interactions', () => {
    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup({ delay: null });
      const toast = createToast('info');
      render(<Toast toast={toast} onClose={mockOnClose} autoClose={false} />);

      const closeButton = screen.getByLabelText('Close notification');
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple close button clicks', async () => {
      const user = userEvent.setup({ delay: null });
      const toast = createToast('info');
      render(<Toast toast={toast} onClose={mockOnClose} autoClose={false} />);

      const closeButton = screen.getByLabelText('Close notification');
      await user.click(closeButton);
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(2);
    });
  });

  describe('Accessibility', () => {
    it('should have accessible close button', () => {
      const toast = createToast('info');
      render(<Toast toast={toast} onClose={mockOnClose} />);

      const closeButton = screen.getByLabelText('Close notification');
      expect(closeButton).toHaveAttribute('aria-label', 'Close notification');
    });

    it('should render with proper semantic structure', () => {
      const toast = createToast('info');
      const { container } = render(<Toast toast={toast} onClose={mockOnClose} />);

      const heading = container.querySelector('h4');
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('info title');
    });
  });
});
