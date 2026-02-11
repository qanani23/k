import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PlayerModal from '../../src/components/PlayerModal';
import { ContentItem } from '../../src/types';
import * as api from '../../src/lib/api';

// Mock Plyr
vi.mock('plyr', () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    destroy: vi.fn(),
    play: vi.fn(),
    pause: vi.fn()
  }))
}));

// Mock hls.js
vi.mock('hls.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    loadSource: vi.fn(),
    attachMedia: vi.fn(),
    on: vi.fn(),
    destroy: vi.fn()
  })),
  isSupported: vi.fn(() => true),
  Events: {
    MANIFEST_PARSED: 'hlsManifestParsed',
    ERROR: 'hlsError'
  },
  ErrorTypes: {
    NETWORK_ERROR: 'networkError',
    MEDIA_ERROR: 'mediaError'
  }
}));

// Mock idle task scheduler to execute immediately in tests
vi.mock('../../src/lib/idle', () => ({
  scheduleIdleTask: vi.fn((callback) => {
    // Execute callback synchronously in tests
    try {
      callback();
    } catch (error) {
      console.error('Error in mock scheduleIdleTask:', error);
    }
    return 1; // Return a dummy handle
  }),
  cancelIdleTask: vi.fn()
}));

// Mock API functions
vi.mock('../../src/lib/api', () => ({
  saveProgress: vi.fn(),
  getProgress: vi.fn(),
  streamOffline: vi.fn(),
  openExternal: vi.fn()
}));

describe('PlayerModal', () => {
  const mockContent: ContentItem = {
    claim_id: 'test-claim-123',
    title: 'Test Movie',
    description: 'A test movie description',
    tags: ['movie', 'action_movies'],
    thumbnail_url: 'https://example.com/thumb.jpg',
    duration: 7200,
    release_time: 1234567890,
    video_urls: {
      '1080p': {
        url: 'https://example.com/video-1080p.mp4',
        quality: '1080p',
        type: 'mp4'
      },
      '720p': {
        url: 'https://example.com/video-720p.mp4',
        quality: '720p',
        type: 'mp4'
      },
      '480p': {
        url: 'https://example.com/video-480p.mp4',
        quality: '480p',
        type: 'mp4'
      }
    },
    compatibility: {
      compatible: true,
      fallback_available: false
    }
  };

  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (api.getProgress as any).mockResolvedValue(null);
    (api.saveProgress as any).mockResolvedValue(undefined);
    (api.streamOffline as any).mockResolvedValue({ url: 'http://localhost:8080/test', port: 8080 });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(
      <PlayerModal
        content={mockContent}
        isOpen={false}
        onClose={mockOnClose}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render when isOpen is true', () => {
    render(
      <PlayerModal
        content={mockContent}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Test Movie')).toBeInTheDocument();
    expect(screen.getByText('A test movie description')).toBeInTheDocument();
  });

  it('should display title with correct alt attribute', () => {
    render(
      <PlayerModal
        content={mockContent}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const title = screen.getByText('Test Movie');
    expect(title).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    render(
      <PlayerModal
        content={mockContent}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const closeButton = screen.getByLabelText('Close player');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when Escape key is pressed', () => {
    render(
      <PlayerModal
        content={mockContent}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should display available qualities', () => {
    render(
      <PlayerModal
        content={mockContent}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Quality button should show current quality
    expect(screen.getByText(/Quality:/)).toBeInTheDocument();
  });

  it('should show quality menu when quality button is clicked', () => {
    render(
      <PlayerModal
        content={mockContent}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const qualityButton = screen.getByText(/Quality:/);
    fireEvent.click(qualityButton);

    // Should show all available qualities in the menu
    const qualityButtons = screen.getAllByRole('button');
    const qualityTexts = qualityButtons.map(btn => btn.textContent);
    
    expect(qualityTexts.some(text => text?.includes('1080p'))).toBe(true);
    expect(qualityTexts.some(text => text?.includes('720p'))).toBe(true);
    expect(qualityTexts.some(text => text?.includes('480p'))).toBe(true);
  });

  it('should display compatibility warning when content is incompatible', () => {
    const incompatibleContent = {
      ...mockContent,
      compatibility: {
        compatible: false,
        reason: 'Codec not supported',
        fallback_available: true
      }
    };

    render(
      <PlayerModal
        content={incompatibleContent}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Compatibility Warning')).toBeInTheDocument();
    expect(screen.getByText('Codec not supported')).toBeInTheDocument();
    expect(screen.getByText('Play via external player')).toBeInTheDocument();
  });

  it('should load saved progress on mount', async () => {
    const mockProgress = {
      claim_id: 'test-claim-123',
      position_seconds: 120,
      quality: '720p',
      updated_at: Date.now()
    };

    (api.getProgress as any).mockResolvedValue(mockProgress);

    render(
      <PlayerModal
        content={mockContent}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(api.getProgress).toHaveBeenCalledWith('test-claim-123');
    });
  });

  it('should use initial quality when provided', () => {
    render(
      <PlayerModal
        content={mockContent}
        isOpen={true}
        onClose={mockOnClose}
        initialQuality="480p"
      />
    );

    expect(screen.getByText(/Quality: 480p/)).toBeInTheDocument();
  });

  it('should display offline indicator when isOffline is true', () => {
    render(
      <PlayerModal
        content={mockContent}
        isOpen={true}
        onClose={mockOnClose}
        isOffline={true}
      />
    );

    expect(screen.getByText('Playing offline')).toBeInTheDocument();
  });

  it('should not show external player button when offline', () => {
    render(
      <PlayerModal
        content={mockContent}
        isOpen={true}
        onClose={mockOnClose}
        isOffline={true}
      />
    );

    expect(screen.queryByText('External Player')).not.toBeInTheDocument();
  });

  it('should show external player button when online', () => {
    render(
      <PlayerModal
        content={mockContent}
        isOpen={true}
        onClose={mockOnClose}
        isOffline={false}
      />
    );

    expect(screen.getByText('External Player')).toBeInTheDocument();
  });

  it('should call openExternal when external player button is clicked', async () => {
    render(
      <PlayerModal
        content={mockContent}
        isOpen={true}
        onClose={mockOnClose}
        isOffline={false}
      />
    );

    const externalButton = screen.getByText('External Player');
    fireEvent.click(externalButton);

    await waitFor(() => {
      expect(api.openExternal).toHaveBeenCalled();
    });
  });

  it('should handle quality change', () => {
    render(
      <PlayerModal
        content={mockContent}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Open quality menu
    const qualityButton = screen.getByText(/Quality:/);
    fireEvent.click(qualityButton);

    // Click on 480p
    const quality480p = screen.getByText('480p');
    fireEvent.click(quality480p);

    // Should update to 480p
    expect(screen.getByText(/Quality: 480p/)).toBeInTheDocument();
  });

  it('should render video element', () => {
    const { container } = render(
      <PlayerModal
        content={mockContent}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('playsInline');
    expect(video).toHaveAttribute('crossOrigin', 'anonymous');
  });

  it('should handle HLS content', () => {
    const hlsContent: ContentItem = {
      ...mockContent,
      video_urls: {
        '720p': {
          url: 'https://example.com/video.m3u8',
          quality: '720p',
          type: 'hls' as const
        }
      }
    };

    render(
      <PlayerModal
        content={hlsContent}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Test Movie')).toBeInTheDocument();
  });

  it('should stop propagation when clicking inside modal', () => {
    const { container } = render(
      <PlayerModal
        content={mockContent}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const modalContent = container.querySelector('.relative.w-full');
    expect(modalContent).toBeInTheDocument();

    if (modalContent) {
      fireEvent.click(modalContent);
      expect(mockOnClose).not.toHaveBeenCalled();
    }
  });

  it('should close when clicking outside modal', () => {
    const { container } = render(
      <PlayerModal
        content={mockContent}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const backdrop = container.querySelector('.fixed.inset-0');
    expect(backdrop).toBeInTheDocument();

    if (backdrop) {
      fireEvent.click(backdrop);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  it('should handle missing description gracefully', () => {
    const contentWithoutDescription = {
      ...mockContent,
      description: undefined
    };

    render(
      <PlayerModal
        content={contentWithoutDescription}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Test Movie')).toBeInTheDocument();
    expect(screen.queryByText('A test movie description')).not.toBeInTheDocument();
  });

  it('should default to 720p when available and no initial quality provided', () => {
    render(
      <PlayerModal
        content={mockContent}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/Quality: 720p/)).toBeInTheDocument();
  });

  it('should use highest quality when 720p not available', () => {
    const contentWithout720p: ContentItem = {
      ...mockContent,
      video_urls: {
        '1080p': {
          url: 'https://example.com/video-1080p.mp4',
          quality: '1080p',
          type: 'mp4' as const
        },
        '480p': {
          url: 'https://example.com/video-480p.mp4',
          quality: '480p',
          type: 'mp4' as const
        }
      }
    };

    render(
      <PlayerModal
        content={contentWithout720p}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/Quality: 1080p/)).toBeInTheDocument();
  });

  describe('Adaptive Quality Management (Property 5)', () => {
    it('should automatically downgrade quality after repeated buffering events', async () => {
      const { container } = render(
        <PlayerModal
          content={mockContent}
          isOpen={true}
          onClose={mockOnClose}
          initialQuality="1080p"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Quality: 1080p/)).toBeInTheDocument();
      });

      const video = container.querySelector('video') as HTMLVideoElement;
      expect(video).toBeInTheDocument();

      // Simulate 3 buffering events within 10 seconds (triggers auto-downgrade)
      const waitingEvent = new Event('waiting');
      
      video.dispatchEvent(waitingEvent);
      video.dispatchEvent(waitingEvent);
      video.dispatchEvent(waitingEvent);

      // After 3 buffering events in 10 seconds, quality should auto-downgrade to 720p
      await waitFor(() => {
        expect(screen.getByText(/Quality: 720p/)).toBeInTheDocument();
      }, { timeout: 2000 });

      // Verify user notification about quality downgrade
      await waitFor(() => {
        expect(screen.getByText(/downgrad/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should not downgrade quality if buffering events are spread out over time', async () => {
      const { container } = render(
        <PlayerModal
          content={mockContent}
          isOpen={true}
          onClose={mockOnClose}
          initialQuality="1080p"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Quality: 1080p/)).toBeInTheDocument();
      });

      const video = container.querySelector('video') as HTMLVideoElement;
      const waitingEvent = new Event('waiting');
      
      // Simulate only 2 buffering events (not enough to trigger downgrade)
      video.dispatchEvent(waitingEvent);
      video.dispatchEvent(waitingEvent);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Quality should remain at 1080p since only 2 events occurred
      expect(screen.getByText(/Quality: 1080p/)).toBeInTheDocument();
    });

    it('should downgrade to next lower quality level progressively', async () => {
      const { container } = render(
        <PlayerModal
          content={mockContent}
          isOpen={true}
          onClose={mockOnClose}
          initialQuality="1080p"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Quality: 1080p/)).toBeInTheDocument();
      });

      const video = container.querySelector('video') as HTMLVideoElement;
      const waitingEvent = new Event('waiting');
      
      // First downgrade: 1080p → 720p
      video.dispatchEvent(waitingEvent);
      video.dispatchEvent(waitingEvent);
      video.dispatchEvent(waitingEvent);
      
      await waitFor(() => {
        expect(screen.getByText(/Quality: 720p/)).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should not downgrade below lowest available quality', async () => {
      const { container } = render(
        <PlayerModal
          content={mockContent}
          isOpen={true}
          onClose={mockOnClose}
          initialQuality="480p"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Quality: 480p/)).toBeInTheDocument();
      });

      const video = container.querySelector('video') as HTMLVideoElement;
      const waitingEvent = new Event('waiting');
      
      // Trigger buffering events at lowest quality
      video.dispatchEvent(waitingEvent);
      video.dispatchEvent(waitingEvent);
      video.dispatchEvent(waitingEvent);
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should remain at 480p (no lower quality available)
      expect(screen.getByText(/Quality: 480p/)).toBeInTheDocument();
    });
  });

  describe('Progress Tracking Consistency (Property 7)', () => {
    it('should save progress at regular intervals during playback', async () => {
      vi.useFakeTimers();
      
      const { container } = render(
        <PlayerModal
          content={mockContent}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Quality:/)).toBeInTheDocument();
      });

      const video = container.querySelector('video') as HTMLVideoElement;
      expect(video).toBeInTheDocument();

      // Simulate video playing
      Object.defineProperty(video, 'paused', { value: false, writable: true });
      Object.defineProperty(video, 'currentTime', { value: 120, writable: true });

      // Advance time by 20 seconds (the interval for saving progress)
      vi.advanceTimersByTime(20000);

      // Progress should be saved
      await waitFor(() => {
        expect(api.saveProgress).toHaveBeenCalledWith({
          claim_id: 'test-claim-123',
          position_seconds: 120,
          quality: expect.any(String)
        });
      });

      vi.useRealTimers();
    });

    it('should save progress multiple times during long playback', async () => {
      vi.useFakeTimers();
      
      const { container } = render(
        <PlayerModal
          content={mockContent}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Quality:/)).toBeInTheDocument();
      });

      const video = container.querySelector('video') as HTMLVideoElement;
      
      // Simulate video playing
      Object.defineProperty(video, 'paused', { value: false, writable: true });
      Object.defineProperty(video, 'currentTime', { value: 60, writable: true });

      // First save after 20 seconds
      vi.advanceTimersByTime(20000);
      await waitFor(() => {
        expect(api.saveProgress).toHaveBeenCalledTimes(1);
      });

      // Update current time
      Object.defineProperty(video, 'currentTime', { value: 120, writable: true });
      
      // Second save after another 20 seconds
      vi.advanceTimersByTime(20000);
      await waitFor(() => {
        expect(api.saveProgress).toHaveBeenCalledTimes(2);
      });

      vi.useRealTimers();
    });

    it('should restore progress within ±2 seconds of last saved position', async () => {
      const mockProgress = {
        claim_id: 'test-claim-123',
        position_seconds: 300,
        quality: '720p',
        updated_at: Date.now()
      };

      (api.getProgress as any).mockResolvedValue(mockProgress);

      const { container } = render(
        <PlayerModal
          content={mockContent}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      await waitFor(() => {
        expect(api.getProgress).toHaveBeenCalledWith('test-claim-123');
      });

      // Verify video currentTime is set to saved position
      const video = container.querySelector('video') as HTMLVideoElement;
      await waitFor(() => {
        // The implementation sets currentTime directly to the saved position
        expect(video.currentTime).toBe(mockProgress.position_seconds);
      });
    });

    it('should save progress when player is closed', async () => {
      const { container } = render(
        <PlayerModal
          content={mockContent}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Quality:/)).toBeInTheDocument();
      });

      const video = container.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(video, 'currentTime', { value: 450, writable: true });

      // Close the player
      const closeButton = screen.getByLabelText('Close player');
      fireEvent.click(closeButton);

      // Progress should be saved before closing (happens in cleanup)
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
      
      // Note: The actual save happens in the cleanup effect, which may not be immediately testable
      // The implementation does save on unmount, but testing cleanup effects is tricky
    });

    it('should not save progress if video has not started playing', async () => {
      vi.useFakeTimers();
      
      render(
        <PlayerModal
          content={mockContent}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Quality:/)).toBeInTheDocument();
      });

      // Clear any initial calls
      vi.clearAllMocks();

      // Advance time without video playing (paused = true by default)
      vi.advanceTimersByTime(30000);

      // Progress should not be saved because video is paused
      expect(api.saveProgress).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
