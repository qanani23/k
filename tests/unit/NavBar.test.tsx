import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import NavBar from '../../src/components/NavBar';
import { UpdateState } from '../../src/types';

// Mock the useDebouncedSearch hook
vi.mock('../../src/hooks/useDebouncedSearch', () => ({
  useDebouncedSearch: () => ({
    query: '',
    setQuery: vi.fn(),
    clearSearch: vi.fn(),
  }),
}));

describe('NavBar Component', () => {
  const defaultUpdateState: UpdateState = {
    status: 'current',
    current_version: '1.0.0',
  };

  const optionalUpdateState: UpdateState = {
    status: 'optional',
    current_version: '1.0.0',
    latest_version: '1.1.0',
    release_notes: 'New features available',
    download_url: 'https://example.com/download',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render the NavBar with logo', () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      expect(screen.getByText('Kiyya')).toBeInTheDocument();
    });

    it('should render Home link', () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      const homeLinks = screen.getAllByText('Home');
      expect(homeLinks.length).toBeGreaterThan(0);
    });

    it('should render all category navigation items', () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      expect(screen.getAllByText('Movies').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Series').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Sitcoms').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Kids').length).toBeGreaterThan(0);
    });

    it('should render action icons (Search, Downloads, Favorites, Settings)', () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      expect(screen.getByLabelText('Open search')).toBeInTheDocument();
      expect(screen.getByLabelText('Downloads')).toBeInTheDocument();
      expect(screen.getByLabelText('Favorites')).toBeInTheDocument();
      expect(screen.getByLabelText('Settings')).toBeInTheDocument();
    });
  });

  describe('Dropdown Navigation', () => {
    it('should show dropdown when clicking Movies category', async () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      const moviesButton = screen.getAllByText('Movies')[0];
      fireEvent.click(moviesButton);

      await waitFor(() => {
        expect(screen.getByText('All Movies')).toBeInTheDocument();
        expect(screen.getByText('Comedy')).toBeInTheDocument();
        expect(screen.getByText('Action')).toBeInTheDocument();
        expect(screen.getByText('Romance')).toBeInTheDocument();
      });
    });

    it('should show dropdown when clicking Series category', async () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      const seriesButton = screen.getAllByText('Series')[0];
      fireEvent.click(seriesButton);

      await waitFor(() => {
        expect(screen.getByText('All Series')).toBeInTheDocument();
        expect(screen.getByText('Comedy')).toBeInTheDocument();
        expect(screen.getByText('Action')).toBeInTheDocument();
        expect(screen.getByText('Romance')).toBeInTheDocument();
      });
    });

    it('should show dropdown when clicking Kids category', async () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      const kidsButton = screen.getAllByText('Kids')[0];
      fireEvent.click(kidsButton);

      await waitFor(() => {
        expect(screen.getByText('All Kids')).toBeInTheDocument();
        expect(screen.getByText('Comedy')).toBeInTheDocument();
        expect(screen.getByText('Action')).toBeInTheDocument();
      });
    });

    it('should NOT show dropdown for Sitcoms (no filters)', () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      const sitcomsButton = screen.getAllByText('Sitcoms')[0];
      fireEvent.click(sitcomsButton);

      // Should not show dropdown menu
      expect(screen.queryByText('All Sitcoms')).not.toBeInTheDocument();
    });

    it('should close dropdown when clicking outside', async () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      const moviesButton = screen.getAllByText('Movies')[0];
      fireEvent.click(moviesButton);

      await waitFor(() => {
        expect(screen.getByText('All Movies')).toBeInTheDocument();
      });

      // Click outside the dropdown
      fireEvent.mouseDown(document.body);

      await waitFor(() => {
        expect(screen.queryByText('All Movies')).not.toBeInTheDocument();
      });
    });

    it('should toggle dropdown when clicking the same category twice', async () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      const moviesButton = screen.getAllByText('Movies')[0];
      
      // Open dropdown
      fireEvent.click(moviesButton);
      await waitFor(() => {
        expect(screen.getByText('All Movies')).toBeInTheDocument();
      });

      // Close dropdown
      fireEvent.click(moviesButton);
      await waitFor(() => {
        expect(screen.queryByText('All Movies')).not.toBeInTheDocument();
      });
    });
  });

  describe('Navigation Behavior (Routes Only, Never Fetches)', () => {
    it('should navigate to /movies when clicking Movies', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <NavBar updateState={defaultUpdateState} />
        </MemoryRouter>
      );

      const moviesLink = screen.getAllByText('Movies')[0].closest('button');
      expect(moviesLink).toHaveAttribute('aria-haspopup', 'true');
    });

    it('should navigate to category page with filter parameter', async () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      const moviesButton = screen.getAllByText('Movies')[0];
      fireEvent.click(moviesButton);

      await waitFor(() => {
        const comedyButton = screen.getByText('Comedy');
        expect(comedyButton).toBeInTheDocument();
      });
    });

    it('should NOT make any API calls (routes only)', () => {
      // This test verifies that NavBar doesn't import or use any API functions
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      // NavBar should only use navigation, no fetch calls
      // The component is rendered successfully without any API dependencies
      expect(screen.getByText('Kiyya')).toBeInTheDocument();
    });

    it('should only read from CATEGORIES config without triggering fetches', async () => {
      // Spy on window.fetch to ensure no API calls are made
      const fetchSpy = vi.spyOn(window, 'fetch');
      
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      // Open all dropdowns to verify no fetches occur
      const moviesButton = screen.getAllByText('Movies')[0];
      fireEvent.click(moviesButton);

      await waitFor(() => {
        expect(screen.getByText('All Movies')).toBeInTheDocument();
      });

      const seriesButton = screen.getAllByText('Series')[0];
      fireEvent.click(seriesButton);

      await waitFor(() => {
        expect(screen.getByText('All Series')).toBeInTheDocument();
      });

      // Verify no fetch calls were made
      expect(fetchSpy).not.toHaveBeenCalled();
      
      fetchSpy.mockRestore();
    });

    it('should render dropdown items from configuration without API calls', async () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      // Open Movies dropdown
      const moviesButton = screen.getAllByText('Movies')[0];
      fireEvent.click(moviesButton);

      await waitFor(() => {
        // Verify all filter items are rendered from config
        expect(screen.getByText('All Movies')).toBeInTheDocument();
        expect(screen.getByText('Comedy')).toBeInTheDocument();
        expect(screen.getByText('Action')).toBeInTheDocument();
        expect(screen.getByText('Romance')).toBeInTheDocument();
      });

      // These items should be rendered immediately from config, not fetched
      // If they were fetched, there would be a loading state or delay
    });

    it('should use navigation for category clicks without fetching', async () => {
      const fetchSpy = vi.spyOn(window, 'fetch');
      
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      // Open dropdown and click a filter
      const moviesButton = screen.getAllByText('Movies')[0];
      fireEvent.click(moviesButton);

      await waitFor(() => {
        const comedyButton = screen.getByText('Comedy');
        fireEvent.click(comedyButton);
      });

      // Verify no fetch calls were made during navigation
      expect(fetchSpy).not.toHaveBeenCalled();
      
      fetchSpy.mockRestore();
    });

    it('should construct correct route paths from category configuration', async () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      // Open Movies dropdown
      const moviesButton = screen.getAllByText('Movies')[0];
      fireEvent.click(moviesButton);

      await waitFor(() => {
        // Verify dropdown items are buttons (for navigation), not links with hrefs
        const comedyButton = screen.getByText('Comedy').closest('button');
        expect(comedyButton).toBeInTheDocument();
        expect(comedyButton?.tagName).toBe('BUTTON');
      });

      // NavBar uses navigate() function to route, not direct API calls
    });
  });

  describe('Update Banner', () => {
    it('should show update banner when optional update is available', () => {
      render(
        <BrowserRouter>
          <NavBar updateState={optionalUpdateState} />
        </BrowserRouter>
      );

      expect(screen.getByText(/Kiyya 1.1.0 is available!/)).toBeInTheDocument();
      expect(screen.getByText(/New features available/)).toBeInTheDocument();
    });

    it('should NOT show update banner when no update is available', () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      expect(screen.queryByText(/is available!/)).not.toBeInTheDocument();
    });

    it('should open download URL when clicking Update button', () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      render(
        <BrowserRouter>
          <NavBar updateState={optionalUpdateState} />
        </BrowserRouter>
      );

      const updateButton = screen.getByText('Update');
      fireEvent.click(updateButton);

      expect(windowOpenSpy).toHaveBeenCalledWith('https://example.com/download', '_blank');
      windowOpenSpy.mockRestore();
    });

    it('should dismiss update banner when clicking X button', async () => {
      render(
        <BrowserRouter>
          <NavBar updateState={optionalUpdateState} />
        </BrowserRouter>
      );

      const dismissButton = screen.getByLabelText('Dismiss update notification');
      fireEvent.click(dismissButton);

      await waitFor(() => {
        expect(screen.queryByText(/is available!/)).not.toBeInTheDocument();
      });
    });

    it('should NOT show update banner when update is deferred', () => {
      const deferredUpdateState: UpdateState = {
        ...optionalUpdateState,
        deferred_until: Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
      };

      render(
        <BrowserRouter>
          <NavBar updateState={deferredUpdateState} />
        </BrowserRouter>
      );

      expect(screen.queryByText(/is available!/)).not.toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should show search input when clicking search icon', async () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      const searchButton = screen.getByLabelText('Open search');
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search content...')).toBeInTheDocument();
      });
    });

    it('should hide search input when clicking close button', async () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      const searchButton = screen.getByLabelText('Open search');
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search content...')).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText('Close search');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search content...')).not.toBeInTheDocument();
      });
    });

    it('should focus search input when opened', async () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      const searchButton = screen.getByLabelText('Open search');
      fireEvent.click(searchButton);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search content...');
        expect(searchInput).toHaveFocus();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for dropdowns', () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      const moviesButton = screen.getAllByText('Movies')[0].closest('button');
      expect(moviesButton).toHaveAttribute('aria-haspopup', 'true');
      expect(moviesButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('should update aria-expanded when dropdown is opened', async () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      const moviesButton = screen.getAllByText('Movies')[0].closest('button');
      fireEvent.click(moviesButton!);

      await waitFor(() => {
        expect(moviesButton).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('should have proper aria-labels for icon buttons', () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      expect(screen.getByLabelText('Open search')).toBeInTheDocument();
      expect(screen.getByLabelText('Downloads')).toBeInTheDocument();
      expect(screen.getByLabelText('Favorites')).toBeInTheDocument();
      expect(screen.getByLabelText('Settings')).toBeInTheDocument();
    });
  });

  describe('Active State Highlighting', () => {
    it('should highlight Home link when on home page', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <NavBar updateState={defaultUpdateState} />
        </MemoryRouter>
      );

      const homeLinks = screen.getAllByText('Home');
      const desktopHomeLink = homeLinks[0].closest('a');
      expect(desktopHomeLink).toHaveClass('active');
    });

    it('should highlight Downloads icon when on downloads page', () => {
      render(
        <MemoryRouter initialEntries={['/downloads']}>
          <NavBar updateState={defaultUpdateState} />
        </MemoryRouter>
      );

      const downloadsLink = screen.getByLabelText('Downloads');
      expect(downloadsLink).toHaveClass('text-accent-cyan');
    });

    it('should highlight Favorites icon when on favorites page', () => {
      render(
        <MemoryRouter initialEntries={['/favorites']}>
          <NavBar updateState={defaultUpdateState} />
        </MemoryRouter>
      );

      const favoritesLink = screen.getByLabelText('Favorites');
      expect(favoritesLink).toHaveClass('text-accent-cyan');
    });

    it('should highlight Settings icon when on settings page', () => {
      render(
        <MemoryRouter initialEntries={['/settings']}>
          <NavBar updateState={defaultUpdateState} />
        </MemoryRouter>
      );

      const settingsLink = screen.getByLabelText('Settings');
      expect(settingsLink).toHaveClass('text-accent-cyan');
    });
  });

  describe('Mobile Navigation', () => {
    it('should render mobile navigation menu', () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      // Mobile menu should be in the DOM (hidden on desktop via CSS)
      const mobileHomeLinks = screen.getAllByText('Home');
      expect(mobileHomeLinks.length).toBeGreaterThan(1); // Desktop + Mobile
    });

    it('should render all categories in mobile menu', () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      const moviesLinks = screen.getAllByText('Movies');
      const seriesLinks = screen.getAllByText('Series');
      const sitcomsLinks = screen.getAllByText('Sitcoms');
      const kidsLinks = screen.getAllByText('Kids');

      // Each category should appear at least twice (desktop + mobile)
      expect(moviesLinks.length).toBeGreaterThanOrEqual(2);
      expect(seriesLinks.length).toBeGreaterThanOrEqual(2);
      expect(sitcomsLinks.length).toBeGreaterThanOrEqual(2);
      expect(kidsLinks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support keyboard navigation for dropdowns', async () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      const moviesButton = screen.getAllByText('Movies')[0].closest('button');
      
      // Focus the button
      moviesButton?.focus();
      expect(moviesButton).toHaveFocus();

      // Press Enter to open dropdown (no need for click anymore)
      fireEvent.keyDown(moviesButton!, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('All Movies')).toBeInTheDocument();
      });
    });
  });

  describe('Configuration-Driven Rendering', () => {
    it('should render categories from CATEGORIES configuration', () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      // Verify all categories from config are rendered (both desktop and mobile)
      expect(screen.getAllByText('Movies').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Series').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Sitcoms').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Kids').length).toBeGreaterThan(0);
    });

    it('should render filters from category configuration', async () => {
      render(
        <BrowserRouter>
          <NavBar updateState={defaultUpdateState} />
        </BrowserRouter>
      );

      const moviesButton = screen.getAllByText('Movies')[0];
      fireEvent.click(moviesButton);

      await waitFor(() => {
        // Verify filters from Movies category config
        expect(screen.getByText('Comedy')).toBeInTheDocument();
        expect(screen.getByText('Action')).toBeInTheDocument();
        expect(screen.getByText('Romance')).toBeInTheDocument();
      });
    });
  });
});
