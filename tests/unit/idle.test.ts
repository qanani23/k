import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  scheduleIdleTask,
  cancelIdleTask,
  createDebouncedIdleTask,
  createThrottledIdleTask,
  scheduleBackgroundTask,
  idleTaskQueue,
} from '../../src/lib/idle';

describe('Idle Task Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Remove requestIdleCallback to use setTimeout fallback for predictable testing
    delete (global as any).requestIdleCallback;
    delete (global as any).cancelIdleCallback;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    idleTaskQueue.clear();
  });

  describe('scheduleIdleTask', () => {
    it('should schedule a task using setTimeout fallback', () => {
      const callback = vi.fn();

      scheduleIdleTask(callback, { timeout: 1000 });

      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalled();
    });

    it('should handle async callbacks', async () => {
      const callback = vi.fn(async () => {
        await Promise.resolve();
      });

      scheduleIdleTask(callback);
      vi.runAllTimers();

      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalled();
      });
    });

    it('should catch and log errors in callbacks', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const callback = vi.fn(() => {
        throw new Error('Test error');
      });

      scheduleIdleTask(callback);
      vi.runAllTimers();

      expect(callback).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in idle callback (setTimeout fallback):',
        expect.any(Error)
      );
    });
  });

  describe('cancelIdleTask', () => {
    it('should cancel a scheduled task using clearTimeout', () => {
      const callback = vi.fn();

      const handle = scheduleIdleTask(callback);
      cancelIdleTask(handle);

      vi.runAllTimers();
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('createDebouncedIdleTask', () => {
    it('should debounce task execution', () => {
      const callback = vi.fn();
      const debouncedTask = createDebouncedIdleTask(callback, 300);

      // Call multiple times rapidly
      debouncedTask();
      debouncedTask();
      debouncedTask();

      // Should not execute yet
      expect(callback).not.toHaveBeenCalled();

      // Advance past debounce delay
      vi.advanceTimersByTime(300);
      
      // Advance past idle callback delay
      vi.advanceTimersByTime(1000);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should reset debounce timer on each call', () => {
      const callback = vi.fn();
      const debouncedTask = createDebouncedIdleTask(callback, 300);

      debouncedTask();
      vi.advanceTimersByTime(200);
      
      debouncedTask(); // Reset timer
      vi.advanceTimersByTime(200);
      
      expect(callback).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(100);
      vi.advanceTimersByTime(1000);
      
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('createThrottledIdleTask', () => {
    it('should throttle task execution', () => {
      const callback = vi.fn();
      const throttledTask = createThrottledIdleTask(callback, 1000);

      // First call should execute immediately (during idle)
      throttledTask();
      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(1);

      // Subsequent calls within interval should be throttled
      throttledTask();
      vi.advanceTimersByTime(500);
      expect(callback).toHaveBeenCalledTimes(1);

      // After interval, should execute again
      vi.advanceTimersByTime(500);
      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should schedule pending task after interval', () => {
      const callback = vi.fn();
      const throttledTask = createThrottledIdleTask(callback, 1000);

      throttledTask();
      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(1);

      // Call during throttle period
      throttledTask();
      expect(callback).toHaveBeenCalledTimes(1);

      // Should execute after remaining time
      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('IdleTaskQueue', () => {
    it('should queue and process tasks', () => {
      const results: number[] = [];

      scheduleBackgroundTask(() => results.push(1), 1);
      scheduleBackgroundTask(() => results.push(2), 3);
      scheduleBackgroundTask(() => results.push(3), 2);

      // Tasks should be queued
      expect(idleTaskQueue.size).toBeGreaterThan(0);

      vi.runAllTimers();

      // At least one task should have executed
      expect(results.length).toBeGreaterThanOrEqual(1);
      // All values should be valid
      results.forEach(val => {
        expect([1, 2, 3]).toContain(val);
      });
    });

    it('should clear all pending tasks', () => {
      const callback = vi.fn();

      scheduleBackgroundTask(callback, 0);
      scheduleBackgroundTask(callback, 0);

      expect(idleTaskQueue.size).toBeGreaterThan(0);

      idleTaskQueue.clear();

      vi.runAllTimers();

      expect(callback).not.toHaveBeenCalled();
      expect(idleTaskQueue.size).toBe(0);
    });

    it('should process tasks', () => {
      const results: number[] = [];

      scheduleBackgroundTask(() => results.push(1), 0);
      scheduleBackgroundTask(() => results.push(2), 0);

      vi.runAllTimers();

      // At least some tasks should have executed
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Integration', () => {
    it('should handle multiple idle tasks scheduled together', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      scheduleIdleTask(callback1, { timeout: 500 });
      scheduleIdleTask(callback2, { timeout: 1000 });
      scheduleIdleTask(callback3, { timeout: 1500 });

      vi.advanceTimersByTime(500);
      expect(callback1).toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);
      expect(callback2).toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);
      expect(callback3).toHaveBeenCalled();
    });

    it('should work with debounced and throttled tasks together', () => {
      const debouncedCallback = vi.fn();
      const throttledCallback = vi.fn();

      const debounced = createDebouncedIdleTask(debouncedCallback, 300);
      const throttled = createThrottledIdleTask(throttledCallback, 1000);

      debounced();
      throttled();

      vi.advanceTimersByTime(300);
      vi.advanceTimersByTime(1000);

      expect(debouncedCallback).toHaveBeenCalled();
      expect(throttledCallback).toHaveBeenCalled();
    });
  });
});
