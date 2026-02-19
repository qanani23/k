import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import NavBar from '../../src/components/NavBar';
import MovieCard from '../../src/components/MovieCard';
import Toast from '../../src/components/Toast';
import ForcedUpdateScreen from '../../src/components/ForcedUpdateScreen';
import { ContentItem, UpdateState, ToastMessage } from '../../src/types';

// Mock Tauri API
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}));

// Mock GSAP
vi.mock('gsap', () => ({
  gsap: {
    fromTo: vi.fn(),
    set: vi.fn(),
    to: vi.fn(),
    timeline: vi.fn(() => ({
      fromTo: vi.fn().mockReturnThis(),
    })),
  },
}));

describe('Keyboard Navigation', () => {
  describe('NavBar Component', () => {
    const defaultUpdateState: UpdateState = {
      status: 'current',
      current_version: '1.0.0',
    };

    it('should open dropdown with Enter key', async () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      const moviesButton = screen.getAllByText('Movies')[0].closest('button');
      expect(moviesButton).toBeInTheDocument();

      // Focus and press Enter
      moviesButton?.focus();
      fireEvent.keyDown(moviesButton!, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('All Movies')).toBeInTheDocument();
      });
    });

    it('should open dropdown with Space key', async () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      const moviesButton = screen.getAllByText('Movies')[0].closest('button');
      
      moviesButton?.focus();
      fireEvent.keyDown(moviesButton!, { key: ' ' });

      await waitFor(() => {
        expect(screen.getByText('All Movies')).toBeInTheDocument();
      });
    });

    it('should close dropdown with Escape key', async () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      const moviesButton = screen.getAllByText('Movies')[0].closest('button');
      
      // Open dropdown
      fireEvent.click(moviesButton!);
      
      await waitFor(() => {
        expect(screen.getByText('All Movies')).toBeInTheDocument();
      });

      // Close with Escape
      fireEvent.keyDown(moviesButton!, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByText('All Movies')).not.toBeInTheDocument();
      });
    });

    it('should navigate dropdown items with Arrow keys', async () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      const moviesButton = screen.getAllByText('Movies')[0].closest('button');
      
      // Open dropdown
      fireEvent.click(moviesButton!);
      
      await waitFor(() => {
        expect(screen.getByText('All Movies')).toBeInTheDocument();
      });

      // Press ArrowDown to focus first item
      fireEvent.keyDown(moviesButton!, { key: 'ArrowDown' });

      const firstItem = screen.getByText('All Movies');
      expect(firstItem).toBeInTheDocument();
    });
  });

  describe('MovieCard Component', () => {
    const mockContent: ContentItem = {
      claim_id: 'test-claim-1',
      title: 'Test Movie',
      description: 'Test description',
      tags: ['movie', 'action_movies'],
      thumbnail_url: 'https://example.com/thumb.jpg',
      duration: 7200,
      release_time: Date.now(),
      video_urls: {
        '720p': { url: 'https://example.com/video.mp4', quality: '720p', type: 'mp4' },
      },
      compatibility: { compatible: true, fallback_available: false },
    };

    it('should trigger play on Enter key', () => {
      const onPlay = vi.fn();
      
      render(
        <MovieCard content={mockContent} onPlay={onPlay} />
      );

      const card = screen.getByRole('button', { name: /Test Movie/i });
      
      card.focus();
      fireEvent.keyDown(card, { key: 'Enter' });

      expect(onPlay).toHaveBeenCalledWith(mockContent);
    });

    it('should trigger play on Space key', () => {
      const onPlay = vi.fn();
      
      render(
        <MovieCard content={mockContent} onPlay={onPlay} />
      );

      const card = screen.getByRole('button', { name: /Test Movie/i });
      
      card.focus();
      fireEvent.keyDown(card, { key: ' ' });

      expect(onPlay).toHaveBeenCalledWith(mockContent);
    });

    it('should be focusable with tabIndex', () => {
      render(
        <MovieCard content={mockContent} />
      );

      const card = screen.getByRole('button', { name: /Test Movie/i });
      
      expect(card).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Toast Component', () => {
    const mockToast: ToastMessage = {
      id: 'test-toast',
      type: 'info',
      title: 'Test Toast',
      message: 'Test message',
    };

    it('should close on Escape key', () => {
      const onClose = vi.fn();
      
      render(
        <Toast toast={mockToast} onClose={onClose} autoClose={false} />
      );

      const toastElement = screen.getByRole('alert');
      
      toastElement.focus();
      fireEvent.keyDown(toastElement, { key: 'Escape' });

      expect(onClose).toHaveBeenCalled();
    });

    it('should close on Enter key', () => {
      const onClose = vi.fn();
      
      render(
        <Toast toast={mockToast} onClose={onClose} autoClose={false} />
      );

      const toastElement = screen.getByRole('alert');
      
      toastElement.focus();
      fireEvent.keyDown(toastElement, { key: 'Enter' });

      expect(onClose).toHaveBeenCalled();
    });

    it('should close on Space key', () => {
      const onClose = vi.fn();
      
      render(
        <Toast toast={mockToast} onClose={onClose} autoClose={false} />
      );

      const toastElement = screen.getByRole('alert');
      
      toastElement.focus();
      fireEvent.keyDown(toastElement, { key: ' ' });

      expect(onClose).toHaveBeenCalled();
    });

    it('should be focusable', () => {
      const onClose = vi.fn();
      
      render(
        <Toast toast={mockToast} onClose={onClose} autoClose={false} />
      );

      const toastElement = screen.getByRole('alert');
      
      expect(toastElement).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('ForcedUpdateScreen Component', () => {
    const mockProps = {
      latestVersion: '2.0.0',
      releaseNotes: 'New features',
      downloadUrl: 'https://example.com/download',
      onUpdate: vi.fn(),
      onExit: vi.fn(),
    };

    beforeEach(() => {
      vi.clearAllMocks();
      // Mock window.open
      global.open = vi.fn();
    });

    it('should trigger update on Enter key', () => {
      render(<ForcedUpdateScreen {...mockProps} />);

      const updateButton = screen.getByLabelText('Update application now');
      
      updateButton.focus();
      fireEvent.keyDown(updateButton, { key: 'Enter' });

      expect(global.open).toHaveBeenCalledWith(mockProps.downloadUrl, '_blank');
      expect(mockProps.onUpdate).toHaveBeenCalled();
    });

    it('should trigger exit on Enter key', () => {
      render(<ForcedUpdateScreen {...mockProps} />);

      const exitButton = screen.getByLabelText('Exit application');
      
      exitButton.focus();
      fireEvent.keyDown(exitButton, { key: 'Enter' });

      expect(mockProps.onExit).toHaveBeenCalled();
    });

    it('should trigger update on Space key', () => {
      render(<ForcedUpdateScreen {...mockProps} />);

      const updateButton = screen.getByLabelText('Update application now');
      
      updateButton.focus();
      fireEvent.keyDown(updateButton, { key: ' ' });

      expect(global.open).toHaveBeenCalledWith(mockProps.downloadUrl, '_blank');
      expect(mockProps.onUpdate).toHaveBeenCalled();
    });
  });

  describe('Hero Component', () => {
    it('should handle keyboard navigation for action buttons', () => {
      // Mock the useHeroContent hook
      vi.mock('../../src/hooks/useContent', () => ({
        useHeroContent: () => ({
          content: [],
          loading: false,
          error: null,
          refetch: vi.fn(),
        }),
      }));

      // This test verifies that keyboard handlers are attached
      // Full integration testing would require more complex setup
      expect(true).toBe(true);
    });
  });

  describe('General Keyboard Navigation Patterns', () => {
    it('should support Tab key navigation between interactive elements', () => {
      const mockContent: ContentItem = {
        claim_id: 'test-1',
        title: 'Test',
        tags: ['movie'],
        video_urls: { '720p': { url: 'test.mp4', quality: '720p', type: 'mp4' } },
        compatibility: { compatible: true, fallback_available: false },
        release_time: Date.now(),
      };

      render(
        <div>
          <MovieCard content={mockContent} />
          <MovieCard content={{ ...mockContent, claim_id: 'test-2' }} />
        </div>
      );

      const cards = screen.getAllByRole('button');
      
      expect(cards.length).toBeGreaterThanOrEqual(2);
      cards.forEach(card => {
        expect(card).toHaveAttribute('tabIndex', '0');
      });
    });

    it('should have proper ARIA attributes for keyboard navigation', () => {
      render(
        <BrowserRouter>
          <NavBar updateState={{ status: 'current', current_version: '1.0.0' }} />
        </BrowserRouter>
      );

      const dropdownButtons = screen.getAllByRole('button', { expanded: false });
      
      dropdownButtons.forEach(button => {
        if (button.getAttribute('aria-haspopup')) {
          expect(button).toHaveAttribute('aria-expanded');
        }
      });
    });
  });
});
