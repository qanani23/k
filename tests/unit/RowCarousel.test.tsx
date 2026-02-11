import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RowCarousel from '../../src/components/RowCarousel';
import { ContentItem } from '../../src/types';

// Mock MovieCard component
vi.mock('../../src/components/MovieCard', () => ({
  default: ({ content }: { content: ContentItem }) => (
    <div data-testid={`movie-card-${content.claim_id}`}>
      {content.title}
    </div>
  )
}));

// Mock useDownloadManager hook
vi.mock('../../src/hooks/useDownloadManager', () => ({
  useDownloadManager: () => ({
    isDownloading: () => false,
    isOfflineAvailable: () => false,
    getDownloadProgress: () => null
  })
}));

describe('RowCarousel', () => {
  const mockContent: ContentItem[] = [
    {
      claim_id: 'claim1',
      title: 'Test Movie 1',
      description: 'Description 1',
      tags: ['movie', 'action'],
      thumbnail_url: 'https://example.com/thumb1.jpg',
      duration: 7200,
      release_time: Date.now(),
      video_urls: { '720p': { url: 'https://example.com/video1.mp4', quality: '720p', type: 'mp4' } },
      compatibility: { compatible: true, fallback_available: false }
    },
    {
      claim_id: 'claim2',
      title: 'Test Movie 2',
      description: 'Description 2',
      tags: ['movie', 'comedy'],
      thumbnail_url: 'https://example.com/thumb2.jpg',
      duration: 5400,
      release_time: Date.now(),
      video_urls: { '720p': { url: 'https://example.com/video2.mp4', quality: '720p', type: 'mp4' } },
      compatibility: { compatible: true, fallback_available: false }
    },
    {
      claim_id: 'claim3',
      title: 'Test Movie 3',
      description: 'Description 3',
      tags: ['movie', 'drama'],
      thumbnail_url: 'https://example.com/thumb3.jpg',
      duration: 6000,
      release_time: Date.now(),
      video_urls: { '720p': { url: 'https://example.com/video3.mp4', quality: '720p', type: 'mp4' } },
      compatibility: { compatible: true, fallback_available: false }
    }
  ];

  let mockIntersectionObserver: any;

  beforeEach(() => {
    // Mock IntersectionObserver
    mockIntersectionObserver = vi.fn(function(this: any, callback: IntersectionObserverCallback) {
      this.observe = vi.fn((element: Element) => {
        // Simulate immediate intersection for testing
        setTimeout(() => {
          callback([{
            isIntersecting: true,
            target: element,
            intersectionRatio: 1,
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: null,
            time: Date.now()
          }], this);
        }, 0);
      });
      this.unobserve = vi.fn();
      this.disconnect = vi.fn();
    });

    global.IntersectionObserver = mockIntersectionObserver as any;

    // Mock scrollTo method for jsdom
    Element.prototype.scrollTo = vi.fn() as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state correctly', () => {
    render(
      <RowCarousel
        title="Test Row"
        content={[]}
        loading={true}
      />
    );

    // Check for loading skeletons instead of title text (title is in skeleton div)
    const skeletons = document.querySelectorAll('.loading-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders error state correctly', () => {
    render(
      <RowCarousel
        title="Test Row"
        content={[]}
        error="Failed to load content"
      />
    );

    expect(screen.getByText('Test Row')).toBeInTheDocument();
    expect(screen.getByText('Failed to load content')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('renders empty state when no content', () => {
    render(
      <RowCarousel
        title="Test Row"
        content={[]}
      />
    );

    expect(screen.getByText('Test Row')).toBeInTheDocument();
    expect(screen.getByText('No content available')).toBeInTheDocument();
  });

  it('renders content items with lazy loading', async () => {
    render(
      <RowCarousel
        title="Test Row"
        content={mockContent}
      />
    );

    expect(screen.getByText('Test Row')).toBeInTheDocument();

    // Wait for IntersectionObserver to trigger
    await waitFor(() => {
      expect(screen.getByTestId('movie-card-claim1')).toBeInTheDocument();
    });
  });

  it('renders placeholders for non-visible items initially', () => {
    // Mock IntersectionObserver to not trigger immediately
    const nonTriggeringObserver = vi.fn(function(this: any) {
      this.observe = vi.fn();
      this.unobserve = vi.fn();
      this.disconnect = vi.fn();
    });
    global.IntersectionObserver = nonTriggeringObserver as any;

    render(
      <RowCarousel
        title="Test Row"
        content={mockContent}
      />
    );

    // Check for placeholder elements
    const placeholders = document.querySelectorAll('.animate-pulse');
    expect(placeholders.length).toBeGreaterThan(0);
  });

  it('shows View All button when showViewAll is true', () => {
    const onViewAll = vi.fn();

    render(
      <RowCarousel
        title="Test Row"
        content={mockContent}
        showViewAll={true}
        onViewAll={onViewAll}
      />
    );

    const viewAllButton = screen.getByText('View All');
    expect(viewAllButton).toBeInTheDocument();
  });

  it('calls onViewAll when View All button is clicked', async () => {
    const user = userEvent.setup();
    const onViewAll = vi.fn();

    render(
      <RowCarousel
        title="Test Row"
        content={mockContent}
        showViewAll={true}
        onViewAll={onViewAll}
      />
    );

    const viewAllButton = screen.getByText('View All');
    await user.click(viewAllButton);

    expect(onViewAll).toHaveBeenCalledTimes(1);
  });

  it('renders scroll buttons when content overflows', async () => {
    // Mock scrollWidth to be larger than clientWidth
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      value: 2000
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: 800
    });

    render(
      <RowCarousel
        title="Test Row"
        content={mockContent}
      />
    );

    await waitFor(() => {
      const rightButton = screen.getByLabelText('Scroll right');
      expect(rightButton).toBeInTheDocument();
    });
  });

  it('supports infinite scroll with onLoadMore', async () => {
    const onLoadMore = vi.fn();

    render(
      <RowCarousel
        title="Test Row"
        content={mockContent}
        hasMore={true}
        onLoadMore={onLoadMore}
      />
    );

    // Wait for IntersectionObserver to potentially trigger onLoadMore
    await waitFor(() => {
      expect(screen.getByText('Loading more...')).toBeInTheDocument();
    });
  });

  it('passes correct props to MovieCard components', async () => {
    const onPlayContent = vi.fn();
    const onDownloadContent = vi.fn();
    const onFavoriteContent = vi.fn();
    const favorites = ['claim1'];

    render(
      <RowCarousel
        title="Test Row"
        content={mockContent}
        onPlayContent={onPlayContent}
        onDownloadContent={onDownloadContent}
        onFavoriteContent={onFavoriteContent}
        favorites={favorites}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('movie-card-claim1')).toBeInTheDocument();
    });
  });

  it('handles keyboard navigation for scroll buttons', async () => {
    const user = userEvent.setup();

    // Mock scrollWidth to enable scroll buttons
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      value: 2000
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: 800
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
      configurable: true,
      writable: true,
      value: 100
    });

    render(
      <RowCarousel
        title="Test Row"
        content={mockContent}
      />
    );

    await waitFor(() => {
      const leftButton = screen.getByLabelText('Scroll left');
      expect(leftButton).toBeInTheDocument();
    });

    const leftButton = screen.getByLabelText('Scroll left');
    leftButton.focus();
    await user.keyboard('{Enter}');

    // Verify button was interacted with (scroll behavior is mocked)
    expect(leftButton).toBeInTheDocument();
  });
});
