import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Hero from '../../src/components/Hero';
import DownloadsPage from '../../src/pages/DownloadsPage';
import FavoritesPage from '../../src/pages/FavoritesPage';
import SettingsPage from '../../src/pages/SettingsPage';
import PlayerModal from '../../src/components/PlayerModal';
import ForcedUpdateScreen from '../../src/components/ForcedUpdateScreen';
import EmergencyDisableScreen from '../../src/components/EmergencyDisableScreen';
import OfflineEmptyState from '../../src/components/OfflineEmptyState';
import { ContentItem } from '../../src/types';

// Mock Tauri API
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock('@tauri-apps/api/shell', () => ({
  open: vi.fn(),
}));

// Mock API
vi.mock('../../src/lib/api', () => ({
  fetchChannelClaims: vi.fn(),
  fetchByTags: vi.fn(() => Promise.resolve([{
    claim_id: 'test-123',
    title: 'Test Movie',
    description: 'Test description',
    tags: ['movie', 'hero_trailer'],
    thumbnail_url: 'https://example.com/thumb.jpg',
    duration: 7200,
    release_time: Date.now() / 1000,
    video_urls: {
      '720p': {
        url: 'https://example.com/video.mp4',
        quality: '720p',
        type: 'mp4',
      },
    },
    compatibility: {
      compatible: true,
      fallback_available: false,
    },
  }])),
  getFavorites: vi.fn(() => Promise.resolve([])),
  saveFavorite: vi.fn(),
  removeFavorite: vi.fn(),
}));

// Mock GSAP
vi.mock('gsap', () => ({
  gsap: {
    timeline: vi.fn(() => ({
      fromTo: vi.fn().mockReturnThis(),
    })),
    set: vi.fn(),
    fromTo: vi.fn(),
  },
}));

// Mock Plyr
vi.mock('plyr', () => ({
  default: vi.fn(),
}));

// Mock hls.js
vi.mock('hls.js', () => ({
  default: {
    isSupported: vi.fn(() => false),
  },
}));

const mockContent: ContentItem = {
  claim_id: 'test-123',
  title: 'Test Movie',
  description: 'Test description',
  tags: ['movie', 'hero_trailer'],
  thumbnail_url: 'https://example.com/thumb.jpg',
  duration: 7200,
  release_time: Date.now() / 1000,
  video_urls: {
    '720p': {
      url: 'https://example.com/video.mp4',
      quality: '720p',
      type: 'mp4',
    },
  },
  compatibility: {
    compatible: true,
    fallback_available: false,
  },
};

describe('ARIA Labels - Accessibility', () => {
  describe('Hero Component', () => {
    it('should have ARIA labels on action buttons', async () => {
      render(
        <BrowserRouter>
          <Hero onPlayClick={vi.fn()} />
        </BrowserRouter>
      );

      // Wait for content to load (mocked)
      await waitFor(() => {
        const playButton = screen.queryByLabelText(/play/i);
        const favoriteButton = screen.queryByLabelText(/add.*to favorites|remove.*from favorites/i);
        const shuffleButton = screen.queryByLabelText(/shuffle/i);

        // At least one of these should exist when content is loaded
        expect(playButton || favoriteButton || shuffleButton).toBeTruthy();
      }, { timeout: 3000 });
    });
  });

  describe('ForcedUpdateScreen Component', () => {
    it('should have ARIA labels on update and exit buttons', () => {
      render(
        <ForcedUpdateScreen
          latestVersion="2.0.0"
          releaseNotes="New features"
          downloadUrl="https://example.com/download"
          onUpdate={vi.fn()}
          onExit={vi.fn()}
        />
      );

      expect(screen.getByLabelText(/update application now/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/exit application/i)).toBeInTheDocument();
    });
  });

  describe('EmergencyDisableScreen Component', () => {
    it('should have ARIA label on exit button', () => {
      render(
        <EmergencyDisableScreen
          releaseNotes="Maintenance in progress"
          onExit={vi.fn()}
        />
      );

      expect(screen.getByLabelText(/exit application/i)).toBeInTheDocument();
    });
  });

  describe('OfflineEmptyState Component', () => {
    it('should have ARIA label on downloads button', () => {
      render(
        <BrowserRouter>
          <OfflineEmptyState showDownloadsButton={true} />
        </BrowserRouter>
      );

      expect(screen.getByLabelText(/view downloaded content/i)).toBeInTheDocument();
    });
  });

  describe('PlayerModal Component', () => {
    it('should have ARIA labels on player controls', () => {
      render(
        <BrowserRouter>
          <PlayerModal
            content={mockContent}
            isOpen={true}
            onClose={vi.fn()}
            initialQuality="720p"
          />
        </BrowserRouter>
      );

      expect(screen.getByLabelText(/close player/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/select video quality/i)).toBeInTheDocument();
    });
  });
});
