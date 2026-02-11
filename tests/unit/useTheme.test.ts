import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTheme } from '../../src/hooks/useTheme';
import * as storage from '../../src/lib/storage';
import * as api from '../../src/lib/api';

// Mock the storage and api modules
vi.mock('../../src/lib/storage', () => ({
  getTheme: vi.fn(() => 'dark'),
  setTheme: vi.fn(() => true),
}));

vi.mock('../../src/lib/api', () => ({
  updateSettings: vi.fn(() => Promise.resolve()),
}));

describe('useTheme Hook', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    localStorage.clear();
    document.documentElement.className = '';
  });

  describe('Initialization', () => {
    it('should initialize with theme from storage', () => {
      vi.mocked(storage.getTheme).mockReturnValue('light');
      
      const { result } = renderHook(() => useTheme());
      
      expect(result.current.theme).toBe('light');
      expect(storage.getTheme).toHaveBeenCalled();
    });

    it('should apply theme to document element on mount', () => {
      vi.mocked(storage.getTheme).mockReturnValue('dark');
      
      renderHook(() => useTheme());
      
      expect(document.documentElement.className).toBe('dark');
    });

    it('should initialize with default dark theme', () => {
      vi.mocked(storage.getTheme).mockReturnValue('dark');
      
      const { result } = renderHook(() => useTheme());
      
      expect(result.current.theme).toBe('dark');
    });
  });

  describe('setTheme', () => {
    it('should update theme state', async () => {
      const { result } = renderHook(() => useTheme());
      
      await act(async () => {
        await result.current.setTheme('light');
      });
      
      expect(result.current.theme).toBe('light');
    });

    it('should persist theme to localStorage', async () => {
      const { result } = renderHook(() => useTheme());
      
      await act(async () => {
        await result.current.setTheme('light');
      });
      
      expect(storage.setTheme).toHaveBeenCalledWith('light');
    });

    it('should sync theme with backend', async () => {
      const { result } = renderHook(() => useTheme());
      
      await act(async () => {
        await result.current.setTheme('light');
      });
      
      await waitFor(() => {
        expect(api.updateSettings).toHaveBeenCalledWith({ theme: 'light' });
      });
    });

    it('should apply theme to document element', async () => {
      const { result } = renderHook(() => useTheme());
      
      await act(async () => {
        await result.current.setTheme('light');
      });
      
      expect(document.documentElement.className).toBe('light');
    });

    it('should handle backend errors gracefully', async () => {
      vi.mocked(api.updateSettings).mockRejectedValue(new Error('Backend error'));
      vi.mocked(storage.getTheme).mockReturnValue('dark');
      
      const { result } = renderHook(() => useTheme());
      
      await act(async () => {
        await result.current.setTheme('light');
      });
      
      // Should revert to previous theme on error
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.theme).toBe('dark');
      });
    });

    it('should clear loading state after theme change completes', async () => {
      const { result } = renderHook(() => useTheme());
      
      await act(async () => {
        await result.current.setTheme('light');
      });
      
      // Loading should be false after completion
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('toggleTheme', () => {
    it('should toggle from dark to light', async () => {
      vi.mocked(storage.getTheme).mockReturnValue('dark');
      vi.mocked(api.updateSettings).mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useTheme());
      
      expect(result.current.theme).toBe('dark');
      
      await act(async () => {
        await result.current.toggleTheme();
      });
      
      expect(result.current.theme).toBe('light');
    });

    it('should toggle from light to dark', async () => {
      vi.mocked(storage.getTheme).mockReturnValue('light');
      vi.mocked(api.updateSettings).mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useTheme());
      
      expect(result.current.theme).toBe('light');
      
      await act(async () => {
        await result.current.toggleTheme();
      });
      
      expect(result.current.theme).toBe('dark');
    });

    it('should persist toggled theme', async () => {
      vi.mocked(storage.getTheme).mockReturnValue('dark');
      vi.mocked(api.updateSettings).mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useTheme());
      
      await act(async () => {
        await result.current.toggleTheme();
      });
      
      expect(storage.setTheme).toHaveBeenCalledWith('light');
      expect(api.updateSettings).toHaveBeenCalledWith({ theme: 'light' });
    });
  });

  describe('Error Handling', () => {
    it('should set error state when backend fails', async () => {
      vi.mocked(api.updateSettings).mockRejectedValue(new Error('Network error'));
      
      const { result } = renderHook(() => useTheme());
      
      await act(async () => {
        await result.current.setTheme('light');
      });
      
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error).toContain('Network error');
      });
    });

    it('should clear error on successful theme change', async () => {
      // First, cause an error
      vi.mocked(api.updateSettings).mockRejectedValueOnce(new Error('Network error'));
      
      const { result } = renderHook(() => useTheme());
      
      await act(async () => {
        await result.current.setTheme('light');
      });
      
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });
      
      // Now succeed
      vi.mocked(api.updateSettings).mockResolvedValueOnce(undefined);
      
      await act(async () => {
        await result.current.setTheme('dark');
      });
      
      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });
  });
});
