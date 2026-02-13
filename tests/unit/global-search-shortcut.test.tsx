import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../src/App';

// Mock Tauri API
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}));

// Mock hooks
vi.mock('../../src/hooks/useUpdateChecker', () => ({
  useUpdateChecker: () => ({
    updateState: {
      status: 'current',
      current_version: '1.0.0',
    },
    checkForUpdates: vi.fn(),
  }),
}));

vi.mock('../../src/hooks/useDownloadManager', () => ({
  useDownloadManager: () => ({
    downloadContent: vi.fn(),
    downloads: [],
  }),
}));

vi.mock('../../src/hooks/useOffline', () => ({
  useOffline: () => ({
    isOnline: true,
    isOffline: false,
  }),
}));

// Mock API functions
vi.mock('../../src/lib/api', () => ({
  cleanupExpiredCache: vi.fn(() => Promise.resolve(0)),
  getFavorites: vi.fn(() => Promise.resolve([])),
  saveFavorite: vi.fn(() => Promise.resolve()),
  removeFavorite: vi.fn(() => Promise.resolve()),
  fetchChannelClaims: vi.fn(() => Promise.resolve([])),
  searchContent: vi.fn(() => Promise.resolve([])),
}));

describe('Global Search Shortcut', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should navigate to search page when "/" key is pressed', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    // Wait for app to initialize
    await waitFor(() => {
      expect(screen.queryByText('Initializing Kiyya...')).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Simulate pressing "/" key
    const event = new KeyboardEvent('keydown', {
      key: '/',
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    // Check if we navigated to search page
    await waitFor(() => {
      // The search page should have a search input with specific placeholder
      const searchInput = container.querySelector('input[placeholder*="Search"]');
      expect(searchInput).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should not trigger search when typing in an input field', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    // Wait for app to initialize
    await waitFor(() => {
      expect(screen.queryByText('Initializing Kiyya...')).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Create an input element and focus it
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    // Get current location before event
    const initialPath = window.location.pathname;

    // Simulate pressing "/" key while focused on input
    const event = new KeyboardEvent('keydown', {
      key: '/',
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(event);

    // Wait a bit to ensure no navigation happened
    await new Promise(resolve => setTimeout(resolve, 500));

    // Should still be on the same page (not navigated to search)
    const searchInput = container.querySelector('input[placeholder*="Search for movies"]');
    expect(searchInput).not.toBeInTheDocument();

    // Cleanup
    document.body.removeChild(input);
  });

  it('should not trigger search when typing in a textarea', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    // Wait for app to initialize
    await waitFor(() => {
      expect(screen.queryByText('Initializing Kiyya...')).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Create a textarea element and focus it
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    // Simulate pressing "/" key while focused on textarea
    const event = new KeyboardEvent('keydown', {
      key: '/',
      bubbles: true,
      cancelable: true,
    });
    textarea.dispatchEvent(event);

    // Wait a bit to ensure no navigation happened
    await new Promise(resolve => setTimeout(resolve, 500));

    // Should still be on the same page (not navigated to search)
    const searchInput = container.querySelector('input[placeholder*="Search for movies"]');
    expect(searchInput).not.toBeInTheDocument();

    // Cleanup
    document.body.removeChild(textarea);
  });

  it('should not trigger search when typing in a contenteditable element', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    // Wait for app to initialize
    await waitFor(() => {
      expect(screen.queryByText('Initializing Kiyya...')).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Create a contenteditable div and focus it
    const div = document.createElement('div');
    div.contentEditable = 'true';
    document.body.appendChild(div);
    div.focus();

    // Simulate pressing "/" key while focused on contenteditable
    const event = new KeyboardEvent('keydown', {
      key: '/',
      bubbles: true,
      cancelable: true,
    });
    div.dispatchEvent(event);

    // Wait a bit to ensure no navigation happened
    await new Promise(resolve => setTimeout(resolve, 500));

    // Should still be on the same page (not navigated to search)
    const searchInput = container.querySelector('input[placeholder*="Search for movies"]');
    expect(searchInput).not.toBeInTheDocument();

    // Cleanup
    document.body.removeChild(div);
  });

  it('should not trigger on other keys', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    // Wait for app to initialize
    await waitFor(() => {
      expect(screen.queryByText('Initializing Kiyya...')).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Simulate pressing other keys
    const keys = ['a', 'Enter', 'Escape', ' ', 'ArrowDown'];
    
    for (const key of keys) {
      const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(event);
    }

    // Wait a bit to ensure no navigation happened
    await new Promise(resolve => setTimeout(resolve, 500));

    // Should still be on the same page (not navigated to search)
    const searchInput = container.querySelector('input[placeholder*="Search for movies"]');
    expect(searchInput).not.toBeInTheDocument();
  });
});
