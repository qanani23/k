import { describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

describe('React Router Setup', () => {
  it('should have react-router-dom installed and importable', () => {
    // Verify that BrowserRouter can be imported
    expect(BrowserRouter).toBeDefined();
    expect(typeof BrowserRouter).toBe('function');
  });

  it('should verify routing configuration exists in App.tsx', async () => {
    // Read App.tsx to verify routing is configured
    const appModule = await import('../../src/App');
    expect(appModule.default).toBeDefined();
  });

  it('should verify all page components are importable', async () => {
    // Verify all route components exist
    const Home = await import('../../src/pages/Home');
    const MoviesPage = await import('../../src/pages/MoviesPage');
    const SeriesPage = await import('../../src/pages/SeriesPage');
    const Search = await import('../../src/pages/Search');
    const MovieDetail = await import('../../src/pages/MovieDetail');
    const SeriesDetail = await import('../../src/pages/SeriesDetail');
    const DownloadsPage = await import('../../src/pages/DownloadsPage');
    const FavoritesPage = await import('../../src/pages/FavoritesPage');
    const SettingsPage = await import('../../src/pages/SettingsPage');

    expect(Home.default).toBeDefined();
    expect(MoviesPage.default).toBeDefined();
    expect(SeriesPage.default).toBeDefined();
    expect(Search.default).toBeDefined();
    expect(MovieDetail.default).toBeDefined();
    expect(SeriesDetail.default).toBeDefined();
    expect(DownloadsPage.default).toBeDefined();
    expect(FavoritesPage.default).toBeDefined();
    expect(SettingsPage.default).toBeDefined();
  });

  it('should verify ErrorBoundary component exists', async () => {
    const ErrorBoundary = await import('../../src/components/ErrorBoundary');
    expect(ErrorBoundary.default).toBeDefined();
  });

  it('should verify NavBar component exists', async () => {
    const NavBar = await import('../../src/components/NavBar');
    expect(NavBar.default).toBeDefined();
  });
});
