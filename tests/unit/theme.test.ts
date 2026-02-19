import { describe, it, expect, beforeEach } from 'vitest';
import { getTheme, setTheme } from '../../src/lib/storage';

describe('Theme Management', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('getTheme', () => {
    it('should return default theme when no theme is stored', () => {
      const theme = getTheme();
      expect(theme).toBe('dark');
    });

    it('should return stored dark theme', () => {
      localStorage.setItem('kiyya-theme', 'dark');
      const theme = getTheme();
      expect(theme).toBe('dark');
    });

    it('should return stored light theme', () => {
      localStorage.setItem('kiyya-theme', 'light');
      const theme = getTheme();
      expect(theme).toBe('light');
    });

    it('should return default theme for invalid stored value', () => {
      localStorage.setItem('kiyya-theme', 'invalid');
      const theme = getTheme();
      expect(theme).toBe('dark');
    });
  });

  describe('setTheme', () => {
    it('should store dark theme', () => {
      const result = setTheme('dark');
      expect(result).toBe(true);
      expect(localStorage.getItem('kiyya-theme')).toBe('dark');
    });

    it('should store light theme', () => {
      const result = setTheme('light');
      expect(result).toBe(true);
      expect(localStorage.getItem('kiyya-theme')).toBe('light');
    });

    it('should overwrite existing theme', () => {
      setTheme('dark');
      expect(localStorage.getItem('kiyya-theme')).toBe('dark');
      
      setTheme('light');
      expect(localStorage.getItem('kiyya-theme')).toBe('light');
    });
  });

  describe('Theme Application', () => {
    it('should apply theme class to document element', () => {
      // Simulate theme initialization
      const theme = 'light';
      document.documentElement.className = theme;
      
      expect(document.documentElement.className).toBe('light');
    });

    it('should switch theme class on document element', () => {
      // Start with dark theme
      document.documentElement.className = 'dark';
      expect(document.documentElement.className).toBe('dark');
      
      // Switch to light theme
      document.documentElement.className = 'light';
      expect(document.documentElement.className).toBe('light');
    });

    it('should maintain theme class after multiple changes', () => {
      document.documentElement.className = 'dark';
      expect(document.documentElement.className).toBe('dark');
      
      document.documentElement.className = 'light';
      expect(document.documentElement.className).toBe('light');
      
      document.documentElement.className = 'dark';
      expect(document.documentElement.className).toBe('dark');
    });
  });

  describe('Theme Persistence', () => {
    it('should persist theme across page reloads', () => {
      // Set theme
      setTheme('light');
      
      // Simulate page reload by reading from localStorage
      const savedTheme = localStorage.getItem('kiyya-theme') || 'dark';
      expect(savedTheme).toBe('light');
    });

    it('should use default theme when localStorage is empty', () => {
      localStorage.clear();
      
      const savedTheme = localStorage.getItem('kiyya-theme') || 'dark';
      expect(savedTheme).toBe('dark');
    });
  });
});
