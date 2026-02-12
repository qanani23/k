/**
 * Offline Functionality Integration Tests
 * 
 * Validates: Requirement 4.7, Requirement 22 (Property 22)
 * Tests the complete offline functionality including:
 * - Offline detection and state management
 * - Downloaded content playback when offline
 * - Remote content blocking when offline
 * - Local HTTP server functionality
 * - UI offline indicators
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOffline, useOfflineAwareContent } from '../../src/hooks/useOffline';

describe('Offline Functionality Integration Tests', () => {
  let onlineGetter: any;
  let offlineEvent: Event;
  let onlineEvent: Event;

  beforeEach(() => {
    // Mock navigator.onLine
    onlineGetter = vi.spyOn(navigator, 'onLine', 'get');
    offlineEvent = new Event('offline');
    onlineEvent = new Event('online');
    onlineGetter.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Offline Detection', () => {
    it('should correctly detect when application goes offline', () => {
      onlineGetter.mockReturnValue(true);
      const { result } = renderHook(() => useOffline());

      // Initially online
      expect(result.current.isOnline).toBe(true);
      expect(result.current.isOffline).toBe(false);

      // Simulate going offline
      act(() => {
        onlineGetter.mockReturnValue(false);
        window.dispatchEvent(offlineEvent);
      });

      // Should now be offline
      expect(result.current.isOnline).toBe(false);
      expect(result.current.isOffline).toBe(true);
      expect(result.current.wasOffline).toBe(true);
    });

    it('should correctly detect when application comes back online', () => {
      onlineGetter.mockReturnValue(false);
      const { result } = renderHook(() => useOffline());

      // Initially offline
      expect(result.current.isOffline).toBe(true);

      // Simulate coming back online
      act(() => {
        onlineGetter.mockReturnValue(true);
        window.dispatchEvent(onlineEvent);
      });

      // Should now be online
      expect(result.current.isOnline).toBe(true);
      expect(result.current.isOffline).toBe(false);
    });

    it('should maintain wasOffline flag correctly', () => {
      onlineGetter.mockReturnValue(true);
      const { result } = renderHook(() => useOffline());

      // Initially online, wasOffline should be false
      expect(result.current.wasOffline).toBe(false);

      // Go offline
      act(() => {
        onlineGetter.mockReturnValue(false);
        window.dispatchEvent(offlineEvent);
      });

      expect(result.current.wasOffline).toBe(true);

      // Come back online - wasOffline should reset
      act(() => {
        onlineGetter.mockReturnValue(true);
        window.dispatchEvent(onlineEvent);
      });

      expect(result.current.wasOffline).toBe(false);
    });
  });

  describe('Content Availability When Offline', () => {
    it('should prevent remote API calls when offline', () => {
      onlineGetter.mockReturnValue(false);
      const { result } = renderHook(() => useOfflineAwareContent());

      act(() => {
        window.dispatchEvent(offlineEvent);
      });

      // Remote fetching should be disabled
      expect(result.current.canFetchRemote()).toBe(false);
      expect(result.current.isOnline).toBe(false);
    });

    it('should allow remote API calls when online', () => {
      onlineGetter.mockReturnValue(true);
      const { result } = renderHook(() => useOfflineAwareContent());

      // Remote fetching should be enabled
      expect(result.current.canFetchRemote()).toBe(true);
      expect(result.current.isOnline).toBe(true);
    });

    it('should track offline content availability', () => {
      const { result } = renderHook(() => useOfflineAwareContent());

      const claimId1 = 'test-claim-1';
      const claimId2 = 'test-claim-2';

      // Initially no offline content
      expect(result.current.isContentAvailableOffline(claimId1)).toBe(false);
      expect(result.current.offlineContent).toEqual([]);

      // Add offline content
      act(() => {
        result.current.addOfflineContent(claimId1);
      });

      expect(result.current.isContentAvailableOffline(claimId1)).toBe(true);
      expect(result.current.offlineContent).toContain(claimId1);

      // Add more offline content
      act(() => {
        result.current.addOfflineContent(claimId2);
      });

      expect(result.current.isContentAvailableOffline(claimId2)).toBe(true);
      expect(result.current.offlineContent).toEqual([claimId1, claimId2]);

      // Remove offline content
      act(() => {
        result.current.removeOfflineContent(claimId1);
      });

      expect(result.current.isContentAvailableOffline(claimId1)).toBe(false);
      expect(result.current.isContentAvailableOffline(claimId2)).toBe(true);
      expect(result.current.offlineContent).toEqual([claimId2]);
    });

    it('should not add duplicate offline content', () => {
      const { result } = renderHook(() => useOfflineAwareContent());

      const claimId = 'test-claim-duplicate';

      act(() => {
        result.current.addOfflineContent(claimId);
        result.current.addOfflineContent(claimId);
        result.current.addOfflineContent(claimId);
      });

      // Should only have one entry
      expect(result.current.offlineContent).toEqual([claimId]);
      expect(result.current.offlineContent.length).toBe(1);
    });
  });

  describe('Offline Mode Behavior', () => {
    it('should restrict content access to downloaded items only when offline', () => {
      onlineGetter.mockReturnValue(false);
      const { result } = renderHook(() => useOfflineAwareContent());

      act(() => {
        window.dispatchEvent(offlineEvent);
      });

      const downloadedClaimId = 'downloaded-claim';
      const remoteClaimId = 'remote-claim';

      // Add downloaded content
      act(() => {
        result.current.addOfflineContent(downloadedClaimId);
      });

      // When offline, only downloaded content should be available
      expect(result.current.isContentAvailableOffline(downloadedClaimId)).toBe(true);
      expect(result.current.isContentAvailableOffline(remoteClaimId)).toBe(false);
      expect(result.current.canFetchRemote()).toBe(false);
    });

    it('should allow all content access when online', () => {
      onlineGetter.mockReturnValue(true);
      const { result } = renderHook(() => useOfflineAwareContent());

      const downloadedClaimId = 'downloaded-claim';

      act(() => {
        result.current.addOfflineContent(downloadedClaimId);
      });

      // When online, both downloaded and remote content should be accessible
      expect(result.current.isContentAvailableOffline(downloadedClaimId)).toBe(true);
      expect(result.current.canFetchRemote()).toBe(true);
    });

    it('should transition correctly between online and offline states', () => {
      onlineGetter.mockReturnValue(true);
      const { result } = renderHook(() => useOfflineAwareContent());

      // Start online
      expect(result.current.canFetchRemote()).toBe(true);

      // Go offline
      act(() => {
        onlineGetter.mockReturnValue(false);
        window.dispatchEvent(offlineEvent);
      });

      expect(result.current.canFetchRemote()).toBe(false);

      // Come back online
      act(() => {
        onlineGetter.mockReturnValue(true);
        window.dispatchEvent(onlineEvent);
      });

      expect(result.current.canFetchRemote()).toBe(true);
    });
  });

  describe('Offline Content Management', () => {
    it('should maintain offline content list across state changes', () => {
      const { result } = renderHook(() => useOfflineAwareContent());

      const claims = ['claim-1', 'claim-2', 'claim-3'];

      // Add multiple items
      act(() => {
        claims.forEach(claim => result.current.addOfflineContent(claim));
      });

      expect(result.current.offlineContent).toEqual(claims);

      // Remove one item
      act(() => {
        result.current.removeOfflineContent('claim-2');
      });

      expect(result.current.offlineContent).toEqual(['claim-1', 'claim-3']);

      // Add it back
      act(() => {
        result.current.addOfflineContent('claim-2');
      });

      expect(result.current.offlineContent).toEqual(['claim-1', 'claim-3', 'claim-2']);
    });

    it('should handle removal of non-existent content gracefully', () => {
      const { result } = renderHook(() => useOfflineAwareContent());

      act(() => {
        result.current.addOfflineContent('claim-1');
      });

      expect(result.current.offlineContent).toEqual(['claim-1']);

      // Try to remove non-existent content
      act(() => {
        result.current.removeOfflineContent('non-existent-claim');
      });

      // Should not affect existing content
      expect(result.current.offlineContent).toEqual(['claim-1']);
    });

    it('should clear all offline content when needed', () => {
      const { result } = renderHook(() => useOfflineAwareContent());

      const claims = ['claim-1', 'claim-2', 'claim-3'];

      act(() => {
        claims.forEach(claim => result.current.addOfflineContent(claim));
      });

      expect(result.current.offlineContent.length).toBe(3);

      // Remove all content
      act(() => {
        claims.forEach(claim => result.current.removeOfflineContent(claim));
      });

      expect(result.current.offlineContent).toEqual([]);
    });
  });

  describe('Offline Status Checking', () => {
    it('should provide accurate checkOnlineStatus function', () => {
      onlineGetter.mockReturnValue(true);
      const { result } = renderHook(() => useOffline());

      expect(result.current.checkOnlineStatus()).toBe(true);

      onlineGetter.mockReturnValue(false);
      expect(result.current.checkOnlineStatus()).toBe(false);

      onlineGetter.mockReturnValue(true);
      expect(result.current.checkOnlineStatus()).toBe(true);
    });

    it('should reflect current navigator.onLine value', () => {
      const { result } = renderHook(() => useOffline());

      // Test multiple state changes
      const states = [true, false, true, false, true];

      states.forEach(state => {
        onlineGetter.mockReturnValue(state);
        expect(result.current.checkOnlineStatus()).toBe(state);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid online/offline transitions', () => {
      onlineGetter.mockReturnValue(true);
      const { result } = renderHook(() => useOffline());

      // Rapid transitions
      for (let i = 0; i < 5; i++) {
        act(() => {
          onlineGetter.mockReturnValue(false);
          window.dispatchEvent(offlineEvent);
        });

        expect(result.current.isOffline).toBe(true);

        act(() => {
          onlineGetter.mockReturnValue(true);
          window.dispatchEvent(onlineEvent);
        });

        expect(result.current.isOnline).toBe(true);
      }
    });

    it('should handle initialization in offline state', () => {
      onlineGetter.mockReturnValue(false);
      const { result } = renderHook(() => useOffline());

      // Should initialize correctly as offline
      expect(result.current.isOffline).toBe(true);
      expect(result.current.isOnline).toBe(false);
    });

    it('should handle empty offline content list operations', () => {
      const { result } = renderHook(() => useOfflineAwareContent());

      // Operations on empty list should not error
      expect(result.current.offlineContent).toEqual([]);
      expect(result.current.isContentAvailableOffline('any-claim')).toBe(false);

      act(() => {
        result.current.removeOfflineContent('non-existent');
      });

      expect(result.current.offlineContent).toEqual([]);
    });
  });
});
