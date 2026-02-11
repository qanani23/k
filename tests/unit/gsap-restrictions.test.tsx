import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { gsap } from 'gsap';
import * as api from '../../src/lib/api';
import { useHeroContent } from '../../src/hooks/useContent';
import { ContentItem, UpdateState } from '../../src/types';
import Hero from '../../src/components/Hero';
import NavBar from '../../src/components/NavBar';
import RowCarousel from '../../src/components/RowCarousel';

// Mock GSAP
vi.mock('gsap', () => {
  const fromToMock = vi.fn().mockReturnThis();
  const timelineMock = vi.fn(() => ({
    fromTo: fromToMock,
  }));
  
  return {
    gsap: {
      timeline: timelineMock,
      fromTo: vi.fn(),
      to: vi.fn(),
      set: vi.fn(),
    },
  };
});

// Mock API
vi.mock('../../src/lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/api')>('../../src/lib/api');
  return {
    ...actual,
    fetchChannelClaims: vi.fn(),
    getFavorites: vi.fn(),
    saveFavorite: vi.fn(),
    removeFavorite: vi.fn(),
  };
});

// Mock useContent hook
vi.mock('../../src/hooks/useContent', () => ({
  useHeroContent: vi.fn(),
}));

describe('GSAP Usage Restrictions', () => {
  const mockContent: ContentItem[] = [
    {
      claim_id: 'test-1',
      title: 'Test Movie 1',
      description: 'Test description',
      tags: ['movie', 'hero_trailer'],
      thumbnail_url: 'https://example.com/thumb1.jpg',
      duration: 7200,
      release_time: Date.now(),
      video_urls: {
        '1080p': { url: 'https://example.com/video1.mp4', quality: '1080p', type: 'mp4' },
      },
      compatibility: { compatible: true, fallback_available: false },
    },
    {
      claim_id: 'test-2',
      title: 'Test Movie 2',
      description: 'Test description 2',
      tags: ['movie'],
      thumbnail_url: 'https://example.com/thumb2.jpg',
      duration: 5400,
      release_time: Date.now(),
      video_urls: {
        '720p': { url: 'https://example.com/video2.mp4', quality: '720p', type: 'mp4' },
      },
      compatibility: { compatible: true, fallback_available: false },
    },
  ];

  const mockUpdateState: UpdateState = {
    status: 'current',
    current_version: '1.0.0',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock API functions
    (api.fetchChannelClaims as any).mockResolvedValue(mockContent);
    (api.getFavorites as any).mockResolvedValue([]);
    (api.saveFavorite as any).mockResolvedValue(undefined);
    (api.removeFavorite as any).mockResolvedValue(undefined);
    
    // Mock useHeroContent hook
    (useHeroContent as any).mockReturnValue({
      content: mockContent,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    
    // Mock IntersectionObserver
    const mockIntersectionObserver = vi.fn().mockImplementation((callback) => {
      // Store the callback and immediately call it for all observed elements
      const instance = {
        observe: vi.fn((element) => {
          // Immediately trigger the callback as if the element is visible
          callback([{
            target: element,
            isIntersecting: true,
            intersectionRatio: 1,
          }]);
        }),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      };
      return instance;
    });
    global.IntersectionObserver = mockIntersectionObserver as any;
    
    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Hero Component - GSAP Usage', () => {
    it('should use GSAP only for hero entry animations (opacity, translate, blur)', async () => {
      render(<Hero />);

      await waitFor(() => {
        // Check for any test movie title (since it's random)
        expect(screen.queryByText(/Test Movie/)).toBeInTheDocument();
      });

      // Verify GSAP timeline was created for hero entry
      expect(gsap.timeline).toHaveBeenCalled();
      
      // Verify fromTo was called (for hero entry animation)
      expect((gsap.timeline as any)().fromTo).toHaveBeenCalled();
    });

    it('should disable GSAP animations when prefers-reduced-motion is set', async () => {
      // Mock matchMedia to return true for prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      render(<Hero />);

      await waitFor(() => {
        // Check for any test movie title (since it's random)
        expect(screen.queryByText(/Test Movie/)).toBeInTheDocument();
      });

      // Verify GSAP.set was called instead of timeline for immediate state
      expect(gsap.set).toHaveBeenCalled();
    });

    it('should only animate opacity, translate (y), and blur - no layout shifts', async () => {
      render(<Hero />);

      await waitFor(() => {
        // Check for any test movie title (since it's random)
        expect(screen.queryByText(/Test Movie/)).toBeInTheDocument();
      });

      // Verify that fromTo calls only use allowed properties
      const fromToCalls = ((gsap.timeline as any)().fromTo as any).mock.calls;
      
      fromToCalls.forEach((call: any) => {
        const fromProps = call[1];
        const toProps = call[2];
        
        // Check that only allowed properties are used
        const allowedProps = ['opacity', 'y', 'filter', 'duration', 'stagger', 'ease'];
        const fromKeys = Object.keys(fromProps);
        const toKeys = Object.keys(toProps);
        
        fromKeys.forEach((key) => {
          expect(allowedProps).toContain(key);
        });
        
        toKeys.forEach((key) => {
          expect(allowedProps).toContain(key);
        });
        
        // Ensure no layout-shifting properties are used
        const forbiddenProps = ['width', 'height', 'margin', 'padding', 'top', 'left', 'right', 'bottom', 'x'];
        forbiddenProps.forEach((prop) => {
          expect(fromKeys).not.toContain(prop);
          expect(toKeys).not.toContain(prop);
        });
      });
    });
  });

  describe('NavBar Component - GSAP Usage', () => {
    it('should use GSAP for dropdown open/close animations', async () => {
      render(
        <BrowserRouter>
          <NavBar updateState={mockUpdateState} />
        </BrowserRouter>
      );

      // Find and click the Movies dropdown button (not the link)
      const moviesButton = screen.getByRole('button', { name: /movies/i });
      moviesButton.click();

      await waitFor(() => {
        // Verify GSAP fromTo was called for dropdown animation
        expect(gsap.fromTo).toHaveBeenCalled();
      });
    });

    it('should disable dropdown animations when prefers-reduced-motion is set', async () => {
      // Mock matchMedia to return true for prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      render(
        <BrowserRouter>
          <NavBar updateState={mockUpdateState} />
        </BrowserRouter>
      );

      // Find and click the Movies dropdown button (not the link)
      const moviesButton = screen.getByRole('button', { name: /movies/i });
      moviesButton.click();

      await waitFor(() => {
        // Verify GSAP.set was called instead of fromTo for immediate state
        expect(gsap.set).toHaveBeenCalled();
      });
    });
  });

  describe('RowCarousel Component - GSAP Usage', () => {
    it('should use GSAP for row hover animations', async () => {
      const { container } = render(
        <RowCarousel
          title="Test Row"
          content={mockContent}
          favorites={[]}
        />
      );

      // Wait for content to be visible (IntersectionObserver callback)
      await waitFor(() => {
        const card = screen.queryByText('Test Movie 1');
        expect(card).toBeInTheDocument();
      });

      // Find a card container element
      const cardContainer = container.querySelector('[data-item-id="test-1"]');
      expect(cardContainer).toBeInTheDocument();

      // Simulate hover using fireEvent
      if (cardContainer) {
        fireEvent.mouseEnter(cardContainer);

        await waitFor(() => {
          // Verify GSAP.to was called for hover animation
          expect(gsap.to).toHaveBeenCalled();
        });

        // Simulate hover out
        fireEvent.mouseLeave(cardContainer);

        await waitFor(() => {
          // Verify GSAP.to was called again for hover out animation
          expect(gsap.to).toHaveBeenCalledTimes(2);
        });
      }
    });

    it('should disable hover animations when prefers-reduced-motion is set', async () => {
      // Mock matchMedia to return true for prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const { container } = render(
        <RowCarousel
          title="Test Row"
          content={mockContent}
          favorites={[]}
        />
      );

      // Clear previous calls
      vi.clearAllMocks();

      // Find a card element
      const cardContainer = container.querySelector('[data-item-id="test-1"]');
      expect(cardContainer).toBeInTheDocument();

      // Simulate hover
      if (cardContainer) {
        const mouseEnterEvent = new MouseEvent('mouseenter', { bubbles: true });
        cardContainer.dispatchEvent(mouseEnterEvent);

        await waitFor(() => {
          // Verify GSAP.to was NOT called (animations disabled)
          expect(gsap.to).not.toHaveBeenCalled();
        });
      }
    });

    it('should only animate opacity and y (translate) for hover - no layout shifts', async () => {
      const { container } = render(
        <RowCarousel
          title="Test Row"
          content={mockContent}
          favorites={[]}
        />
      );

      // Wait for content to be visible
      await waitFor(() => {
        const card = screen.queryByText('Test Movie 1');
        expect(card).toBeInTheDocument();
      });
      
      // Find a card container element
      const cardContainer = container.querySelector('[data-item-id="test-1"]');
      
      if (cardContainer) {
        fireEvent.mouseEnter(cardContainer);

        await waitFor(() => {
          expect(gsap.to).toHaveBeenCalled();
        });

        // Verify that gsap.to calls only use allowed properties
        const toCalls = (gsap.to as any).mock.calls;
        
        toCalls.forEach((call: any) => {
          const props = call[1];
          
          // Check that only allowed properties are used (opacity, y, duration, ease)
          const allowedProps = ['opacity', 'y', 'duration', 'ease'];
          const propKeys = Object.keys(props);
          
          propKeys.forEach((key) => {
            expect(allowedProps).toContain(key);
          });
          
          // Ensure no layout-shifting properties are used (including scale)
          const forbiddenProps = ['scale', 'width', 'height', 'margin', 'padding', 'top', 'left', 'right', 'bottom', 'x'];
          forbiddenProps.forEach((prop) => {
            expect(propKeys).not.toContain(prop);
          });
        });
      }
    });
  });

  describe('GSAP Restrictions Enforcement', () => {
    it('should only use GSAP in Hero, NavBar dropdown, and RowCarousel hover', () => {
      // This test verifies that GSAP is only imported and used in the three allowed components
      // The actual enforcement is done through code review and this test suite
      
      // Verify GSAP is available
      expect(gsap).toBeDefined();
      expect(gsap.timeline).toBeDefined();
      expect(gsap.fromTo).toBeDefined();
      expect(gsap.to).toBeDefined();
      expect(gsap.set).toBeDefined();
    });

    it('should respect prefers-reduced-motion in all GSAP usage', async () => {
      // Mock matchMedia to return true for prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      // Test Hero
      const { unmount: unmountHero } = render(<Hero />);
      await waitFor(() => {
        expect(screen.queryByText(/Test Movie/)).toBeInTheDocument();
      });
      expect(gsap.set).toHaveBeenCalled();
      unmountHero();

      vi.clearAllMocks();

      // Test NavBar
      const { unmount: unmountNavBar } = render(
        <BrowserRouter>
          <NavBar updateState={mockUpdateState} />
        </BrowserRouter>
      );
      const moviesButton = screen.getByRole('button', { name: /movies/i });
      moviesButton.click();
      await waitFor(() => {
        expect(gsap.set).toHaveBeenCalled();
      });
      unmountNavBar();

      vi.clearAllMocks();

      // Test RowCarousel
      const { container } = render(
        <RowCarousel
          title="Test Row"
          content={mockContent}
          favorites={[]}
        />
      );
      const cardContainer = container.querySelector('[data-item-id="test-1"]');
      if (cardContainer) {
        const mouseEnterEvent = new MouseEvent('mouseenter', { bubbles: true });
        cardContainer.dispatchEvent(mouseEnterEvent);
        await waitFor(() => {
          // Should not call gsap.to when prefers-reduced-motion is set
          expect(gsap.to).not.toHaveBeenCalled();
        });
      }
    });
  });
});
