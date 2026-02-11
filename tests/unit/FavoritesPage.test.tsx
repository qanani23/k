import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import FavoritesPage from '../../src/pages/FavoritesPage';
import * as api from '../../src/lib/api';
import { FavoriteItem, ContentItem } from '../../src/types';

// Mock Tauri API to prevent IPC errors
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(),
}));

// Mock the API module with partial mocking
vi.mock('../../src/lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/api')>('../../src/lib/api');
  return {
    ...actual,
    getFavorites: vi.fn(),
    removeFavorite: vi.fn(),
    resolveClaim: vi.fn(),
  };
});

// Mock react-router-dom navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('FavoritesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockFavorites: FavoriteItem[] = [
    {
      claim_id: 'fav-1',
      title: 'Favorite Movie 1',
      thumbnail_url: 'https://example.com/thumb1.jpg',
      inserted_at: 1234567890,
    },
    {
      claim_id: 'fav-2',
      title: 'Favorite Movie 2',
      thumbnail_url: 'https://example.com/thumb2.jpg',
      inserted_at: 1234567891,
    },
  ];

  const mockResolvedContent: ContentItem = {
    claim_id: 'fav-1',
    title: 'Favorite Movie 1',
    description: 'A great movie',
    tags: ['movie', 'action_movies'],
    thumbnail_url: 'https://example.com/thumb1.jpg',
    duration: 7200,
    release_time: 1234567890,
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

  it('should render loading state initially', async () => {
    // Mock a pending promise that never resolves during the test
    let resolveFn: (value: FavoriteItem[]) => void;
    const pendingPromise = new Promise<FavoriteItem[]>((resolve) => {
      resolveFn = resolve;
    });
    
    vi.mocked(api.getFavorites).mockReturnValue(pendingPromise);

    const { container } = render(
      <BrowserRouter>
        <FavoritesPage />
      </BrowserRouter>
    );

    // Check for loading skeleton
    const skeletons = container.querySelectorAll('.loading-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
    
    // Clean up by resolving the promise
    resolveFn!([]);
    await waitFor(() => {
      expect(api.getFavorites).toHaveBeenCalled();
    });
  });

  it('should load and display favorites from SQLite', async () => {
    vi.mocked(api.getFavorites).mockResolvedValue(mockFavorites);
    vi.mocked(api.resolveClaim).mockResolvedValue(mockResolvedContent);

    render(
      <BrowserRouter>
        <FavoritesPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(api.getFavorites).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText('2 favorites')).toBeInTheDocument();
    });
  });

  it('should display empty state when no favorites exist', async () => {
    vi.mocked(api.getFavorites).mockResolvedValue([]);

    render(
      <BrowserRouter>
        <FavoritesPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/no favorites yet/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/browse content/i)).toBeInTheDocument();
  });

  it('should handle error when loading favorites fails', async () => {
    vi.mocked(api.getFavorites).mockRejectedValue(new Error('Database error'));

    render(
      <BrowserRouter>
        <FavoritesPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/database error/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/try again/i)).toBeInTheDocument();
  });

  it('should resolve full content details for each favorite', async () => {
    const mockFavorite: FavoriteItem = {
      claim_id: 'test-claim',
      title: 'Test Movie',
      thumbnail_url: 'https://example.com/thumb.jpg',
      inserted_at: 1234567890,
    };

    vi.mocked(api.getFavorites).mockResolvedValue([mockFavorite]);
    vi.mocked(api.resolveClaim).mockResolvedValue(mockResolvedContent);

    render(
      <BrowserRouter>
        <FavoritesPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(api.resolveClaim).toHaveBeenCalledWith('test-claim');
    });
  });

  it('should handle resolution failure gracefully', async () => {
    const mockFavorite: FavoriteItem = {
      claim_id: 'test-claim',
      title: 'Test Movie',
      thumbnail_url: 'https://example.com/thumb.jpg',
      inserted_at: 1234567890,
    };

    vi.mocked(api.getFavorites).mockResolvedValue([mockFavorite]);
    vi.mocked(api.resolveClaim).mockRejectedValue(new Error('Resolution failed'));

    render(
      <BrowserRouter>
        <FavoritesPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(api.resolveClaim).toHaveBeenCalledWith('test-claim');
    });

    // Should still display the favorite with minimal data
    await waitFor(() => {
      expect(screen.getByText('1 favorite')).toBeInTheDocument();
    });
  });

  it('should display correct favorite count', async () => {
    vi.mocked(api.getFavorites).mockResolvedValue(mockFavorites);
    vi.mocked(api.resolveClaim).mockResolvedValue(mockResolvedContent);

    render(
      <BrowserRouter>
        <FavoritesPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('2 favorites')).toBeInTheDocument();
    });
  });

  it('should use singular form for single favorite', async () => {
    vi.mocked(api.getFavorites).mockResolvedValue([mockFavorites[0]]);
    vi.mocked(api.resolveClaim).mockResolvedValue(mockResolvedContent);

    render(
      <BrowserRouter>
        <FavoritesPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('1 favorite')).toBeInTheDocument();
    });
  });

  it('should display tips section when favorites exist', async () => {
    vi.mocked(api.getFavorites).mockResolvedValue(mockFavorites);
    vi.mocked(api.resolveClaim).mockResolvedValue(mockResolvedContent);

    render(
      <BrowserRouter>
        <FavoritesPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/tips for managing favorites/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/stored locally in SQLite database/i)).toBeInTheDocument();
  });

  it('should not display clear all button when no favorites', async () => {
    vi.mocked(api.getFavorites).mockResolvedValue([]);

    render(
      <BrowserRouter>
        <FavoritesPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText(/clear all/i)).not.toBeInTheDocument();
    });
  });

  it('should verify SQLite is single source of truth', async () => {
    // This test ensures we're calling getFavorites from SQLite, not LocalStorage
    vi.mocked(api.getFavorites).mockResolvedValue(mockFavorites);
    vi.mocked(api.resolveClaim).mockResolvedValue(mockResolvedContent);

    render(
      <BrowserRouter>
        <FavoritesPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      // Verify we called the SQLite-backed API
      expect(api.getFavorites).toHaveBeenCalledTimes(1);
      expect(api.getFavorites).toHaveBeenCalledWith();
    });
  });
});
