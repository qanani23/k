import { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { listen } from '@tauri-apps/api/event';

// Components
import NavBar from './components/NavBar';
import Toast from './components/Toast';
import ForcedUpdateScreen from './components/ForcedUpdateScreen';
import EmergencyDisableScreen from './components/EmergencyDisableScreen';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineIndicator from './components/OfflineIndicator';

// Pages
import Home from './pages/Home';
import MoviesPage from './pages/MoviesPage';
import SeriesPage from './pages/SeriesPage';
import Search from './pages/Search';
import MovieDetail from './pages/MovieDetail';
import SeriesDetail from './pages/SeriesDetail';
import DownloadsPage from './pages/DownloadsPage';
import FavoritesPage from './pages/FavoritesPage';
import SettingsPage from './pages/SettingsPage';

// Hooks
import { useUpdateChecker } from './hooks/useUpdateChecker';
import { useDownloadManager } from './hooks/useDownloadManager';
import { useOffline } from './hooks/useOffline';

// Utils
import { scheduleIdleTask } from './lib/idle';
import { cleanupExpiredCache } from './lib/api';

// Types
import { ToastMessage } from './types';

// Icons
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function App() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const { isOnline, isOffline } = useOffline();
  const { updateState, checkForUpdates } = useUpdateChecker();
  const { } = useDownloadManager(); // Initialize download event listeners
  const location = useLocation();
  const navigate = useNavigate();

  // Initialize application
  useEffect(() => {
    const initialize = async () => {
      try {
        // Check for updates on app start
        await checkForUpdates();
        
        // Schedule background cache cleanup during idle time
        scheduleIdleTask(async () => {
          try {
            const cleanedCount = await cleanupExpiredCache();
            if (cleanedCount > 0) {
              console.log(`Cleaned up ${cleanedCount} expired cache entries`);
            }
          } catch (error) {
            console.error('Failed to cleanup expired cache:', error);
          }
        }, { timeout: 5000 }); // 5 second timeout
        
      } catch (error) {
        console.error('Failed to check for updates:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initialize();
  }, [checkForUpdates]);

  // Periodic cache cleanup during idle time (every 5 minutes)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      scheduleIdleTask(async () => {
        try {
          const cleanedCount = await cleanupExpiredCache();
          if (cleanedCount > 0) {
            console.log(`Periodic cleanup: removed ${cleanedCount} expired cache entries`);
          }
        } catch (error) {
          console.error('Failed to perform periodic cache cleanup:', error);
        }
      }, { timeout: 10000 }); // 10 second timeout for periodic cleanup
    }, 5 * 60 * 1000); // Run every 5 minutes

    return () => {
      clearInterval(cleanupInterval);
    };
  }, []);

  // Show toast notifications when online/offline status changes
  useEffect(() => {
    if (isOnline) {
      addToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Back Online',
        message: 'Internet connection restored',
      });
    } else if (isOffline) {
      addToast({
        id: Date.now().toString(),
        type: 'warning',
        title: 'Offline Mode',
        message: 'You can still access downloaded content',
      });
    }
  }, [isOnline, isOffline]);

  // Set up event listeners
  useEffect(() => {
    const setupEventListeners = async () => {
      // Listen for download progress events
      await listen('download-progress', (event) => {
        // Handle download progress updates
        console.log('Download progress:', event.payload);
      });

      // Listen for download completion events
      await listen('download-complete', (_event) => {
        addToast({
          id: Date.now().toString(),
          type: 'success',
          title: 'Download Complete',
          message: 'Video has been downloaded successfully',
        });
      });

      // Listen for download error events
      await listen('download-error', (_event) => {
        addToast({
          id: Date.now().toString(),
          type: 'error',
          title: 'Download Failed',
          message: 'Failed to download video',
        });
      });

      // Listen for local server events
      await listen('local-server-started', (event) => {
        console.log('Local server started:', event.payload);
      });
    };

    setupEventListeners();
  }, []);

  const addToast = (toast: ToastMessage) => {
    setToasts(prev => [...prev, toast]);
    
    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      removeToast(toast.id);
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Show loading screen during initialization
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-accent-cyan animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">Initializing Kiyya...</p>
        </div>
      </div>
    );
  }

  // Show emergency disable screen if service is unavailable (highest priority)
  if (updateState.status === 'emergency') {
    return (
      <EmergencyDisableScreen 
        releaseNotes={updateState.release_notes || 'Service temporarily unavailable for maintenance.'}
        onExit={() => {
          // Exit the application
          window.close();
        }}
      />
    );
  }

  // Show forced update screen if required
  if (updateState.status === 'forced') {
    return (
      <ForcedUpdateScreen 
        latestVersion={updateState.latest_version || 'Unknown'}
        releaseNotes={updateState.release_notes || 'Update required'}
        downloadUrl={updateState.download_url || '#'}
        onUpdate={() => {
          if (updateState.download_url) {
            window.open(updateState.download_url, '_blank');
          }
        }}
        onExit={() => {
          // Exit the application
          window.close();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-bg-main text-text-primary">
      <NavBar updateState={updateState} />
      
      {/* Offline indicator */}
      <OfflineIndicator 
        showDownloadsLink={true}
        onNavigateToDownloads={() => navigate('/downloads')}
      />
      
      <main className={`pt-16 ${isOffline ? 'mt-10' : ''}`}>
        <Routes>
          <Route path="/" element={
            <ErrorBoundary>
              <Home />
            </ErrorBoundary>
          } />
          <Route path="/movies" element={
            <ErrorBoundary>
              <MoviesPage />
            </ErrorBoundary>
          } />
          <Route path="/series" element={
            <ErrorBoundary>
              <SeriesPage />
            </ErrorBoundary>
          } />
          <Route path="/search" element={
            <ErrorBoundary>
              <Search />
            </ErrorBoundary>
          } />
          <Route path="/movie/:claimId" element={
            <ErrorBoundary>
              <MovieDetail />
            </ErrorBoundary>
          } />
          <Route path="/series/:seriesKey" element={
            <ErrorBoundary>
              <SeriesDetail />
            </ErrorBoundary>
          } />
          <Route path="/downloads" element={
            <ErrorBoundary>
              <DownloadsPage />
            </ErrorBoundary>
          } />
          <Route path="/favorites" element={
            <ErrorBoundary>
              <FavoritesPage />
            </ErrorBoundary>
          } />
          <Route path="/settings" element={
            <ErrorBoundary>
              <SettingsPage />
            </ErrorBoundary>
          } />
        </Routes>
      </main>

      {/* Toast notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            toast={toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default App;