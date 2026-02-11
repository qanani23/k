import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SeriesPage from '../../src/pages/SeriesPage';
import * as api from '../../src/lib/api';
import { Playlist, ContentItem, FavoriteItem } from '../../src/types';

// Mock the API module
vi.mock('../../src/lib/api', () => ({
  fetchPlaylists: vi.fn(),
  fetchByTag: vi.fn(),
  resolveClaim: vi.fn(),
  saveFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  getFavorites: vi.fn()
}));

// Mock the useDownloadManager hook
vi.mock('../../src/hooks/useDownloadManager', () => ({
  useDownloadManager: () => ({
    downloadContent: vi.fn(),
    downloads: [],
    deleteDownload: vi.fn(),
    getOfflineUrl: vi.fn()
  })
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

describe('SeriesPage', () => {
  const mockPlaylists: Playlist[] = [
    {
      id: 'playlist-1',
      title: 'Test Series',
      claim_id: 'series-claim-1',
      season_number: 1,
      series_key: 'test-series',
      items: [
        {
          claim_id: 'episode-1',
          position: 0,
          episode_number: 1,
          season_number: 1
        },
        {
          claim_id: 'episode-2',
          position: 1,
          episode_number: 2,
          season_number: 1
        }
      ]
    }
  ];

  const mockSeriesContent: ContentItem[] = [
    {
      claim_id: 'episode-1',
      title: 'Test Series S01E01 - First Episode',
      description: 'First episode description',
      tags: ['series'],
      thumbnail_url: 'https://example.com/thumb1.jpg',
      duration: 1800,
      release_time: 1234567890,
      video_urls: {
        '720p': {
          url: 'https://example.com/video1.mp4',
          quality: '720p',
          type: 'mp4'
        }
      },
      compatibility: {
        compatible: true,
        fallback_available: false
      }
    },
    {
      claim_id: 'episode-2',
      title: 'Test Series S01E02 - Second Episode',
      description: 'Second episode description',
      tags: ['series'],
      thumbnail_url: 'https://example.com/thumb2.jpg',
      duration: 1900,
      release_time: 1234567900,
      video_urls: {
        '720p': {
          url: 'https://example.com/video2.mp4',
          quality: '720p',
          type: 'mp4'
        }
      },
      compatibility: {
        compatible: true,
        fallback_available: false
      }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementations
    vi.mocked(api.fetchPlaylists).mockResolvedValue(mockPlaylists);
    vi.mocked(api.fetchByTag).mockResolvedValue(mockSeriesContent);
    vi.mocked(api.getFavorites).mockResolvedValue([]);
    vi.mocked(api.resolveClaim).mockResolvedValue(mockSeriesContent[0]);
  });

  it('should render loading state initially', () => {
    render(
      <MemoryRouter initialEntries={['/series/episode-1']}>
        <Routes>
          <Route path="/series/:claimId" element={<SeriesPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Check for loading skeleton elements
    const pulseElements = document.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('should load and display series with playlist data', async () => {
    render(
      <MemoryRouter initialEntries={['/series/episode-1']}>
        <Routes>
          <Route path="/series/:claimId" element={<SeriesPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Series')).toBeInTheDocument();
    });

    // Use getAllByText for text that appears multiple times
    const seasonText = screen.getAllByText(/1 season/);
    expect(seasonText.length).toBeGreaterThan(0);
    
    const episodeText = screen.getAllByText(/2 episode/);
    expect(episodeText.length).toBeGreaterThan(0);
  });

  it('should display season header with episode count', async () => {
    render(
      <MemoryRouter initialEntries={['/series/episode-1']}>
        <Routes>
          <Route path="/series/:claimId" element={<SeriesPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Season 1')).toBeInTheDocument();
    });

    // Use getAllByText for text that appears multiple times
    const episodeText = screen.getAllByText(/2 episode/);
    expect(episodeText.length).toBeGreaterThan(0);
  });

  it('should expand and collapse seasons', async () => {
    render(
      <MemoryRouter initialEntries={['/series/episode-1']}>
        <Routes>
          <Route path="/series/:claimId" element={<SeriesPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Season 1')).toBeInTheDocument();
    });

    // Season 1 should be expanded by default
    expect(screen.getByText('Test Series S01E01 - First Episode')).toBeInTheDocument();

    // Click to collapse
    const seasonButton = screen.getByRole('button', { name: /season 1/i });
    fireEvent.click(seasonButton);

    // Episodes should be hidden
    await waitFor(() => {
      expect(screen.queryByText('Test Series S01E01 - First Episode')).not.toBeInTheDocument();
    });

    // Click to expand again
    fireEvent.click(seasonButton);

    // Episodes should be visible again
    await waitFor(() => {
      expect(screen.getByText('Test Series S01E01 - First Episode')).toBeInTheDocument();
    });
  });

  it('should display episodes in playlist order', async () => {
    render(
      <MemoryRouter initialEntries={['/series/episode-1']}>
        <Routes>
          <Route path="/series/:claimId" element={<SeriesPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Series S01E01 - First Episode')).toBeInTheDocument();
    });

    const episodes = screen.getAllByText(/Test Series S01E/);
    expect(episodes).toHaveLength(2);
    
    // Verify order matches playlist position
    expect(episodes[0]).toHaveTextContent('S01E01');
    expect(episodes[1]).toHaveTextContent('S01E02');
  });

  it('should show inferred seasons marker when playlist data is missing', async () => {
    // Mock playlists without season_number to trigger inferred behavior
    const inferredPlaylists: Playlist[] = [];
    
    vi.mocked(api.fetchPlaylists).mockResolvedValue(inferredPlaylists);
    
    // Mock content that will be parsed to create inferred seasons
    const parsedContent: ContentItem[] = [
      {
        ...mockSeriesContent[0],
        title: 'Test Series S01E01 - First Episode'
      },
      {
        ...mockSeriesContent[1],
        title: 'Test Series S01E02 - Second Episode'
      }
    ];
    
    vi.mocked(api.fetchByTag).mockResolvedValue(parsedContent);

    render(
      <MemoryRouter initialEntries={['/series/episode-1']}>
        <Routes>
          <Route path="/series/:claimId" element={<SeriesPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Series')).toBeInTheDocument();
    });

    // Should show inferred marker when playlists are empty and episodes are parsed
    expect(screen.getByText(/Seasons inferred automatically/i)).toBeInTheDocument();
  });

  it('should handle play button click', async () => {
    render(
      <MemoryRouter initialEntries={['/series/episode-1']}>
        <Routes>
          <Route path="/series/:claimId" element={<SeriesPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Series S01E01 - First Episode')).toBeInTheDocument();
    });

    const playButtons = screen.getAllByLabelText(/Play/);
    fireEvent.click(playButtons[0]);

    // Should navigate to episode detail
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/series/episode-1');
    });
  });

  it('should handle download button click', async () => {
    render(
      <MemoryRouter initialEntries={['/series/episode-1']}>
        <Routes>
          <Route path="/series/:claimId" element={<SeriesPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Series S01E01 - First Episode')).toBeInTheDocument();
    });

    const downloadButtons = screen.getAllByLabelText(/Download/);
    fireEvent.click(downloadButtons[0]);

    // Should call resolveClaim to get video URLs
    await waitFor(() => {
      expect(api.resolveClaim).toHaveBeenCalledWith('episode-1');
    });
  });

  it('should handle favorite toggle', async () => {
    render(
      <MemoryRouter initialEntries={['/series/episode-1']}>
        <Routes>
          <Route path="/series/:claimId" element={<SeriesPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Series S01E01 - First Episode')).toBeInTheDocument();
    });

    const favoriteButtons = screen.getAllByLabelText(/Add.*to favorites/);
    fireEvent.click(favoriteButtons[0]);

    // Should call saveFavorite
    await waitFor(() => {
      expect(api.saveFavorite).toHaveBeenCalledWith({
        claim_id: 'episode-1',
        title: 'Test Series S01E01 - First Episode',
        thumbnail_url: 'https://example.com/thumb1.jpg'
      });
    });
  });

  it('should display error state when series not found', async () => {
    vi.mocked(api.fetchPlaylists).mockResolvedValue([]);
    vi.mocked(api.fetchByTag).mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={['/series/unknown-claim']}>
        <Routes>
          <Route path="/series/:claimId" element={<SeriesPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Error Loading Series/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Series not found/i)).toBeInTheDocument();
  });

  it('should handle API errors gracefully', async () => {
    vi.mocked(api.fetchPlaylists).mockRejectedValue(new Error('Network error'));

    render(
      <MemoryRouter initialEntries={['/series/episode-1']}>
        <Routes>
          <Route path="/series/:claimId" element={<SeriesPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Error Loading Series/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Network error/i)).toBeInTheDocument();
  });

  it('should display episode duration when available', async () => {
    render(
      <MemoryRouter initialEntries={['/series/episode-1']}>
        <Routes>
          <Route path="/series/:claimId" element={<SeriesPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Series S01E01 - First Episode')).toBeInTheDocument();
    });

    // 1800 seconds = 30 minutes
    expect(screen.getByText(/30m/)).toBeInTheDocument();
  });

  it('should handle missing episode duration', async () => {
    const contentWithoutDuration = mockSeriesContent.map(item => ({
      ...item,
      duration: undefined
    }));
    
    vi.mocked(api.fetchByTag).mockResolvedValue(contentWithoutDuration);

    render(
      <MemoryRouter initialEntries={['/series/episode-1']}>
        <Routes>
          <Route path="/series/:claimId" element={<SeriesPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Series S01E01 - First Episode')).toBeInTheDocument();
    });

    // Should not crash and should display episode without duration
    expect(screen.queryByText(/m$/)).not.toBeInTheDocument();
  });

  it('should try sitcom tag if series tag fails', async () => {
    // Mock empty playlists
    vi.mocked(api.fetchPlaylists).mockResolvedValue([]);
    
    // First call returns empty for series, second call returns content for sitcom
    vi.mocked(api.fetchByTag)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(mockSeriesContent);

    render(
      <MemoryRouter initialEntries={['/series/episode-1']}>
        <Routes>
          <Route path="/series/:claimId" element={<SeriesPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Series')).toBeInTheDocument();
    });

    // Should have called fetchByTag twice (series and sitcom)
    await waitFor(() => {
      expect(api.fetchByTag).toHaveBeenCalledTimes(2);
    });
    
    expect(api.fetchByTag).toHaveBeenNthCalledWith(1, 'series', 200);
    expect(api.fetchByTag).toHaveBeenNthCalledWith(2, 'sitcom', 200);
  });

  it('should display favorites correctly', async () => {
    const mockFavorites: FavoriteItem[] = [
      {
        claim_id: 'episode-1',
        title: 'Test Series S01E01 - First Episode',
        thumbnail_url: 'https://example.com/thumb1.jpg',
        inserted_at: Date.now()
      }
    ];
    
    vi.mocked(api.getFavorites).mockResolvedValue(mockFavorites);

    render(
      <MemoryRouter initialEntries={['/series/episode-1']}>
        <Routes>
          <Route path="/series/:claimId" element={<SeriesPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Series S01E01 - First Episode')).toBeInTheDocument();
    });

    // First episode should show as favorite (filled heart)
    const favoriteButtons = screen.getAllByLabelText(/Remove.*from favorites/);
    expect(favoriteButtons).toHaveLength(1);
  });
});
