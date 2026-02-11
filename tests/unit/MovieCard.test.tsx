import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MovieCard from '../../src/components/MovieCard';
import { ContentItem } from '../../src/types';

// Mock the useDownloadManager hook
vi.mock('../../src/hooks/useDownloadManager', () => ({
  useDownloadManager: () => ({
    isDownloading: vi.fn(() => false),
    isOfflineAvailable: vi.fn(() => false),
    getDownloadProgress: vi.fn(() => null),
  }),
}));

describe('MovieCard Component', () => {
  const mockContent: ContentItem = {
    claim_id: 'test-claim-123',
    title: 'Test Movie Title',
    description: 'Test movie description',
    tags: ['movie', 'action_movies', 'comedy'],
    thumbnail_url: 'https://example.com/thumbnail.jpg',
    duration: 7200, // 2 hours
    release_time: Date.now(),
    video_urls: {
      '720p': { url: 'https://example.com/720p.mp4', quality: '720p', type: 'mp4' },
      '1080p': { url: 'https://example.com/1080p.mp4', quality: '1080p', type: 'mp4' },
    },
    compatibility: {
      compatible: true,
      fallbackAvailable: false,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Accessibility Requirements', () => {
    it('should render image with alt attribute equal to title', () => {
      render(<MovieCard content={mockContent} />);
      
      const image = screen.getByAltText('Test Movie Title');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('alt', mockContent.title);
    });

    it('should have alt attribute even when thumbnail fails to load', async () => {
      render(<MovieCard content={mockContent} />);
      
      const image = screen.getByAltText('Test Movie Title');
      
      // Simulate image load error
      fireEvent.error(image);
      
      await waitFor(() => {
        // After error, fallback should still have accessible text
        expect(screen.getByText('No Image')).toBeInTheDocument();
      });
    });

    it('should have proper ARIA labels on action buttons', () => {
      render(
        <MovieCard 
          content={mockContent} 
          onPlay={vi.fn()}
          onDownload={vi.fn()}
          onFavorite={vi.fn()}
          showActions={true}
        />
      );

      const card = screen.getByText('Test Movie Title').closest('.movie-card');
      expect(card).toBeInTheDocument();
      
      // Hover to show actions
      if (card) {
        fireEvent.mouseEnter(card);
      }

      // Check for aria-labels
      expect(screen.getByLabelText('Play Test Movie Title')).toBeInTheDocument();
      expect(screen.getByLabelText('Download Test Movie Title')).toBeInTheDocument();
      expect(screen.getByLabelText('Add Test Movie Title to favorites')).toBeInTheDocument();
    });

    it('should update favorite button aria-label when favorited', () => {
      render(
        <MovieCard 
          content={mockContent} 
          onFavorite={vi.fn()}
          isFavorite={true}
          showActions={true}
        />
      );

      const card = screen.getByText('Test Movie Title').closest('.movie-card');
      if (card) {
        fireEvent.mouseEnter(card);
      }

      expect(screen.getByLabelText('Remove Test Movie Title from favorites')).toBeInTheDocument();
    });
  });

  describe('Display Requirements', () => {
    it('should display content with 2:3 aspect ratio poster', () => {
      render(<MovieCard content={mockContent} />);
      
      const image = screen.getByAltText('Test Movie Title');
      expect(image).toHaveClass('movie-poster');
    });

    it('should display title', () => {
      render(<MovieCard content={mockContent} />);
      
      expect(screen.getByText('Test Movie Title')).toBeInTheDocument();
    });

    it('should display duration when available', () => {
      render(<MovieCard content={mockContent} />);
      
      // Duration should be formatted (7200 seconds = 2:00:00)
      expect(screen.getByText('2:00:00')).toBeInTheDocument();
    });

    it('should display quality indicator for HD content', () => {
      render(<MovieCard content={mockContent} />);
      
      expect(screen.getByText('HD')).toBeInTheDocument();
    });

    it('should display tags', () => {
      render(<MovieCard content={mockContent} />);
      
      // Should show first 2 tags
      expect(screen.getByText('movie')).toBeInTheDocument();
      expect(screen.getByText('action movies')).toBeInTheDocument();
    });

    it('should show "+X more" for additional tags', () => {
      render(<MovieCard content={mockContent} />);
      
      // Has 3 tags, shows 2, so should show "+1 more"
      expect(screen.getByText('+1 more')).toBeInTheDocument();
    });
  });

  describe('Missing Thumbnail Handling', () => {
    it('should display fallback UI when thumbnail_url is missing', () => {
      const contentWithoutThumbnail = { ...mockContent, thumbnail_url: undefined };
      render(<MovieCard content={contentWithoutThumbnail} />);
      
      expect(screen.getByText('No Image')).toBeInTheDocument();
    });

    it('should display fallback UI when image fails to load', async () => {
      render(<MovieCard content={mockContent} />);
      
      const image = screen.getByAltText('Test Movie Title');
      fireEvent.error(image);
      
      await waitFor(() => {
        expect(screen.getByText('No Image')).toBeInTheDocument();
      });
    });

    it('should have gradient background in fallback state', async () => {
      const contentWithoutThumbnail = { ...mockContent, thumbnail_url: undefined };
      render(<MovieCard content={contentWithoutThumbnail} />);
      
      const fallback = screen.getByText('No Image').closest('div')?.parentElement;
      expect(fallback).toHaveClass('bg-gradient-to-br');
    });
  });

  describe('Hover Animations', () => {
    it('should show actions on mouse enter', () => {
      render(
        <MovieCard 
          content={mockContent} 
          onPlay={vi.fn()}
          showActions={true}
        />
      );

      const card = screen.getByText('Test Movie Title').closest('.movie-card');
      expect(card).toBeInTheDocument();
      
      if (card) {
        fireEvent.mouseEnter(card);
        
        // Actions should be visible
        expect(screen.getByLabelText('Play Test Movie Title')).toBeInTheDocument();
      }
    });

    it('should hide actions on mouse leave', () => {
      render(
        <MovieCard 
          content={mockContent} 
          onPlay={vi.fn()}
          showActions={true}
        />
      );

      const card = screen.getByText('Test Movie Title').closest('.movie-card');
      
      if (card) {
        fireEvent.mouseEnter(card);
        
        // Verify button is visible
        expect(screen.getByLabelText('Play Test Movie Title')).toBeInTheDocument();
        
        fireEvent.mouseLeave(card);
        
        // After mouse leave, actions should still exist in DOM but be hidden via CSS
        // The component uses opacity-0 and group-hover:opacity-100
        const playButton = screen.queryByLabelText('Play Test Movie Title');
        // Button should not be found after mouse leave due to conditional rendering
        expect(playButton).not.toBeInTheDocument();
      }
    });
  });

  describe('Interaction Handlers', () => {
    it('should call onPlay when card is clicked', () => {
      const onPlay = vi.fn();
      render(<MovieCard content={mockContent} onPlay={onPlay} />);

      const card = screen.getByText('Test Movie Title').closest('.movie-card');
      if (card) {
        fireEvent.click(card);
      }

      expect(onPlay).toHaveBeenCalledWith(mockContent);
    });

    it('should call onPlay when play button is clicked', () => {
      const onPlay = vi.fn();
      render(
        <MovieCard 
          content={mockContent} 
          onPlay={onPlay}
          showActions={true}
        />
      );

      const card = screen.getByText('Test Movie Title').closest('.movie-card');
      if (card) {
        fireEvent.mouseEnter(card);
      }

      const playButton = screen.getByLabelText('Play Test Movie Title');
      fireEvent.click(playButton);

      expect(onPlay).toHaveBeenCalledWith(mockContent);
    });

    it('should call onDownload when download button is clicked', () => {
      const onDownload = vi.fn();
      render(
        <MovieCard 
          content={mockContent} 
          onDownload={onDownload}
          showActions={true}
        />
      );

      const card = screen.getByText('Test Movie Title').closest('.movie-card');
      if (card) {
        fireEvent.mouseEnter(card);
      }

      const downloadButton = screen.getByLabelText('Download Test Movie Title');
      fireEvent.click(downloadButton);

      expect(onDownload).toHaveBeenCalledWith(mockContent, '1080p');
    });

    it('should call onFavorite when favorite button is clicked', () => {
      const onFavorite = vi.fn();
      render(
        <MovieCard 
          content={mockContent} 
          onFavorite={onFavorite}
          showActions={true}
        />
      );

      const card = screen.getByText('Test Movie Title').closest('.movie-card');
      if (card) {
        fireEvent.mouseEnter(card);
      }

      const favoriteButton = screen.getByLabelText('Add Test Movie Title to favorites');
      fireEvent.click(favoriteButton);

      expect(onFavorite).toHaveBeenCalledWith(mockContent);
    });

    it('should stop propagation when action buttons are clicked', () => {
      const onPlay = vi.fn();
      const onDownload = vi.fn();
      
      render(
        <MovieCard 
          content={mockContent} 
          onPlay={onPlay}
          onDownload={onDownload}
          showActions={true}
        />
      );

      const card = screen.getByText('Test Movie Title').closest('.movie-card');
      if (card) {
        fireEvent.mouseEnter(card);
      }

      const downloadButton = screen.getByLabelText('Download Test Movie Title');
      fireEvent.click(downloadButton);

      // onPlay should not be called when download button is clicked
      expect(onDownload).toHaveBeenCalledTimes(1);
      expect(onPlay).not.toHaveBeenCalled();
    });
  });

  describe('Size Variants', () => {
    it('should apply small size classes', () => {
      render(<MovieCard content={mockContent} size="small" />);
      
      const card = screen.getByText('Test Movie Title').closest('.movie-card');
      expect(card).toHaveClass('w-32');
    });

    it('should apply medium size classes by default', () => {
      render(<MovieCard content={mockContent} />);
      
      const card = screen.getByText('Test Movie Title').closest('.movie-card');
      expect(card).toHaveClass('w-40');
    });

    it('should apply large size classes', () => {
      render(<MovieCard content={mockContent} size="large" />);
      
      const card = screen.getByText('Test Movie Title').closest('.movie-card');
      expect(card).toHaveClass('w-48');
    });
  });

  describe('Compatibility Warnings', () => {
    it('should display compatibility warning when content is incompatible', () => {
      const incompatibleContent = {
        ...mockContent,
        compatibility: {
          compatible: false,
          reason: 'Codec not supported',
          fallbackAvailable: true,
        },
      };

      render(<MovieCard content={incompatibleContent} />);
      
      expect(screen.getByText(/May not play on this platform/)).toBeInTheDocument();
    });

    it('should not display compatibility warning when content is compatible', () => {
      render(<MovieCard content={mockContent} />);
      
      expect(screen.queryByText(/May not play on this platform/)).not.toBeInTheDocument();
    });
  });

  describe('Lazy Loading', () => {
    it('should have loading="lazy" attribute on image', () => {
      render(<MovieCard content={mockContent} />);
      
      const image = screen.getByAltText('Test Movie Title');
      expect(image).toHaveAttribute('loading', 'lazy');
    });

    it('should have decoding="async" attribute on image', () => {
      render(<MovieCard content={mockContent} />);
      
      const image = screen.getByAltText('Test Movie Title');
      expect(image).toHaveAttribute('decoding', 'async');
    });
  });
});
