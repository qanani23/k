import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUpdateChecker } from '../../src/hooks/useUpdateChecker';
import * as api from '../../src/lib/api';

// Mock the API module
vi.mock('../../src/lib/api', () => ({
  openExternal: vi.fn(),
}));

// Mock environment variables
vi.stubEnv('VITE_UPDATE_MANIFEST_URL', 'https://example.com/version.json');
vi.stubEnv('VITE_APP_VERSION', '1.0.0');

describe('useUpdateChecker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with checking status', () => {
    const { result } = renderHook(() => useUpdateChecker());
    
    expect(result.current.updateState.status).toBe('checking');
    expect(result.current.updateState.current_version).toBe('1.0.0');
  });

  it('should set status to current when no update is available', async () => {
    const mockManifest = {
      latestVersion: '1.0.0',
      minSupportedVersion: '1.0.0',
      releaseNotes: 'Current version',
      downloadUrl: 'https://example.com/download',
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockManifest,
    });

    const { result } = renderHook(() => useUpdateChecker());

    await waitFor(() => {
      expect(result.current.updateState.status).toBe('current');
    });

    expect(result.current.updateState.latest_version).toBe('1.0.0');
  });

  it('should set status to optional when update is available', async () => {
    const mockManifest = {
      latestVersion: '1.1.0',
      minSupportedVersion: '1.0.0',
      releaseNotes: 'New features',
      downloadUrl: 'https://example.com/download',
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockManifest,
    });

    const { result } = renderHook(() => useUpdateChecker());

    await waitFor(() => {
      expect(result.current.updateState.status).toBe('optional');
    });

    expect(result.current.updateState.latest_version).toBe('1.1.0');
    expect(result.current.updateState.release_notes).toBe('New features');
  });

  it('should set status to forced when below minimum supported version', async () => {
    const mockManifest = {
      latestVersion: '2.0.0',
      minSupportedVersion: '1.5.0',
      releaseNotes: 'Critical update required',
      downloadUrl: 'https://example.com/download',
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockManifest,
    });

    const { result } = renderHook(() => useUpdateChecker());

    await waitFor(() => {
      expect(result.current.updateState.status).toBe('forced');
    });

    expect(result.current.updateState.min_supported_version).toBe('1.5.0');
  });

  it('should handle fetch errors gracefully', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useUpdateChecker());

    await waitFor(() => {
      expect(result.current.updateState.status).toBe('error');
    });
  });

  it('should open external URL when openUpdate is called', async () => {
    const mockManifest = {
      latestVersion: '1.1.0',
      minSupportedVersion: '1.0.0',
      releaseNotes: 'New features',
      downloadUrl: 'https://example.com/download',
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockManifest,
    });

    const { result } = renderHook(() => useUpdateChecker());

    await waitFor(() => {
      expect(result.current.updateState.status).toBe('optional');
    });

    await result.current.openUpdate();

    expect(api.openExternal).toHaveBeenCalledWith('https://example.com/download');
  });

  it('should defer update for 24 hours', async () => {
    const mockManifest = {
      latestVersion: '1.1.0',
      minSupportedVersion: '1.0.0',
      releaseNotes: 'New features',
      downloadUrl: 'https://example.com/download',
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockManifest,
    });

    const { result } = renderHook(() => useUpdateChecker());

    await waitFor(() => {
      expect(result.current.updateState.status).toBe('optional');
    });

    result.current.deferUpdate(24);

    await waitFor(() => {
      expect(result.current.updateState.status).toBe('current');
    });
    
    expect(result.current.updateState.deferred_until).toBeDefined();
  });

  it('should respect deferred updates on subsequent checks', async () => {
    const mockManifest = {
      latestVersion: '1.1.0',
      minSupportedVersion: '1.0.0',
      releaseNotes: 'New features',
      downloadUrl: 'https://example.com/download',
    };

    // Set deferred time in localStorage
    const deferUntil = Date.now() + (24 * 60 * 60 * 1000);
    localStorage.setItem('kiyya-deferred-update-1.1.0', deferUntil.toString());

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockManifest,
    });

    const { result } = renderHook(() => useUpdateChecker());

    await waitFor(() => {
      expect(result.current.updateState.status).toBe('current');
    });

    expect(result.current.updateState.deferred_until).toBe(deferUntil);
  });

  it('should handle missing update manifest URL', async () => {
    vi.stubEnv('VITE_UPDATE_MANIFEST_URL', '');

    const { result } = renderHook(() => useUpdateChecker());

    // When URL is missing, it should log a warning and set status to current
    await waitFor(() => {
      expect(['current', 'error']).toContain(result.current.updateState.status);
    });
  });
});
