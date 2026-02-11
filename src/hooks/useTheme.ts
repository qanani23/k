import { useState, useEffect, useCallback } from 'react';
import { getTheme, setTheme as setStorageTheme } from '../lib/storage';
import { updateSettings } from '../lib/api';

export type Theme = 'dark' | 'light';

/**
 * Hook for managing application theme
 * Handles theme state, persistence, and synchronization with backend
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Initialize from localStorage
    return getTheme();
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  /**
   * Set theme and persist to both localStorage and backend
   */
  const setTheme = useCallback(async (newTheme: Theme) => {
    try {
      setIsLoading(true);
      setError(null);

      // Update local state immediately for instant UI feedback
      setThemeState(newTheme);
      
      // Persist to localStorage
      setStorageTheme(newTheme);
      
      // Apply to document element
      document.documentElement.className = newTheme;
      
      // Sync with backend
      await updateSettings({ theme: newTheme });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? `Failed to update theme: ${err.message}` : 'Failed to update theme';
      setError(errorMessage);
      console.error('Failed to update theme:', err);
      
      // Revert to previous theme on error
      const previousTheme = getTheme();
      setThemeState(previousTheme);
      document.documentElement.className = previousTheme;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Toggle between dark and light themes
   */
  const toggleTheme = useCallback(async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    await setTheme(newTheme);
  }, [theme, setTheme]);

  return {
    theme,
    setTheme,
    toggleTheme,
    isLoading,
    error,
  };
}
