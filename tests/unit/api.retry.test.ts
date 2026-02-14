import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithRetry, RETRY_CONFIGS } from '../../src/lib/api';

describe('API Retry Logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should succeed on first attempt if no error', async () => {
    const mockFn = vi.fn().mockResolvedValue('success');
    
    const result = await fetchWithRetry(mockFn, RETRY_CONFIGS.category);
    
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should retry with exponential backoff on failure', async () => {
    const mockFn = vi.fn()
      .mockRejectedValueOnce(new Error('Attempt 1 failed'))
      .mockRejectedValueOnce(new Error('Attempt 2 failed'))
      .mockResolvedValueOnce('success');
    
    const promise = fetchWithRetry(mockFn, RETRY_CONFIGS.category);
    
    // Fast-forward through all timers
    await vi.runAllTimersAsync();
    
    const result = await promise;
    
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should throw error after max retries', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Always fails'));
    
    const promise = fetchWithRetry(mockFn, RETRY_CONFIGS.category);
    
    // Fast-forward through all timers
    await vi.runAllTimersAsync();
    
    await expect(promise).rejects.toThrow('Always fails');
    expect(mockFn).toHaveBeenCalledTimes(4); // Initial + 3 retries
  });

  it('should use correct exponential backoff delays', async () => {
    const mockFn = vi.fn()
      .mockRejectedValueOnce(new Error('Attempt 1'))
      .mockRejectedValueOnce(new Error('Attempt 2'))
      .mockRejectedValueOnce(new Error('Attempt 3'))
      .mockResolvedValueOnce('success');
    
    const config = {
      maxRetries: 3,
      initialDelay: 1000,
      backoffMultiplier: 2
    };
    
    const promise = fetchWithRetry(mockFn, config);
    
    // First attempt fails immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(mockFn).toHaveBeenCalledTimes(1);
    
    // Wait for first retry delay (1000ms)
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockFn).toHaveBeenCalledTimes(2);
    
    // Wait for second retry delay (2000ms)
    await vi.advanceTimersByTimeAsync(2000);
    expect(mockFn).toHaveBeenCalledTimes(3);
    
    // Wait for third retry delay (4000ms)
    await vi.advanceTimersByTimeAsync(4000);
    expect(mockFn).toHaveBeenCalledTimes(4);
    
    const result = await promise;
    expect(result).toBe('success');
  });

  it('should respect custom retry config', async () => {
    const mockFn = vi.fn()
      .mockRejectedValueOnce(new Error('Fail'))
      .mockResolvedValueOnce('success');
    
    const customConfig = {
      maxRetries: 1,
      initialDelay: 500,
      backoffMultiplier: 1
    };
    
    const promise = fetchWithRetry(mockFn, customConfig);
    
    await vi.runAllTimersAsync();
    
    const result = await promise;
    
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(2); // Initial + 1 retry
  });

  it('should limit retries to maxRetries', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Always fails'));
    
    const config = {
      maxRetries: 2,
      initialDelay: 100,
      backoffMultiplier: 2
    };
    
    const promise = fetchWithRetry(mockFn, config);
    
    await vi.runAllTimersAsync();
    
    await expect(promise).rejects.toThrow('Always fails');
    expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  describe('Retry Button Functionality', () => {
    it('should trigger refetch when retry is called', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce('success on retry');
      
      // First attempt fails
      const firstPromise = fetchWithRetry(mockFn, { maxRetries: 0, initialDelay: 100, backoffMultiplier: 1 });
      await vi.runAllTimersAsync();
      await expect(firstPromise).rejects.toThrow('First attempt failed');
      expect(mockFn).toHaveBeenCalledTimes(1);
      
      // Retry succeeds
      const retryPromise = fetchWithRetry(mockFn, { maxRetries: 0, initialDelay: 100, backoffMultiplier: 1 });
      await vi.runAllTimersAsync();
      const result = await retryPromise;
      
      expect(result).toBe('success on retry');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should respect max retry limit of 3 attempts', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Always fails'));
      
      const promise = fetchWithRetry(mockFn, RETRY_CONFIGS.category);
      
      await vi.runAllTimersAsync();
      
      await expect(promise).rejects.toThrow('Always fails');
      // Should be called: 1 initial + 3 retries = 4 total (maxRetries: 3)
      expect(mockFn).toHaveBeenCalledTimes(4);
    });

    it('should not exceed max retry limit even with multiple retry attempts', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Persistent failure'));
      
      const config = {
        maxRetries: 3,
        initialDelay: 100,
        backoffMultiplier: 2
      };
      
      const promise = fetchWithRetry(mockFn, config);
      
      await vi.runAllTimersAsync();
      
      await expect(promise).rejects.toThrow('Persistent failure');
      // Should be called: 1 initial + 3 retries = 4 total
      expect(mockFn).toHaveBeenCalledTimes(4);
    });
  });

  describe('Parameterized Retry Config', () => {
    it('should use different retry delays', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('success');
      
      const config = {
        maxRetries: 2,
        initialDelay: 500,
        backoffMultiplier: 2
      };
      
      const promise = fetchWithRetry(mockFn, config);
      
      // First attempt fails immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(mockFn).toHaveBeenCalledTimes(1);
      
      // Wait for first retry delay (500ms)
      await vi.advanceTimersByTimeAsync(500);
      expect(mockFn).toHaveBeenCalledTimes(2);
      
      // Wait for second retry delay (1000ms = 500 * 2^1)
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockFn).toHaveBeenCalledTimes(3);
      
      const result = await promise;
      expect(result).toBe('success');
    });

    it('should use different max retry counts', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Always fails'));
      
      // Test with maxRetries: 1
      const config1 = {
        maxRetries: 1,
        initialDelay: 100,
        backoffMultiplier: 2
      };
      
      const promise1 = fetchWithRetry(mockFn, config1);
      await vi.runAllTimersAsync();
      await expect(promise1).rejects.toThrow('Always fails');
      expect(mockFn).toHaveBeenCalledTimes(2); // Initial + 1 retry
      
      mockFn.mockClear();
      
      // Test with maxRetries: 5
      const config5 = {
        maxRetries: 5,
        initialDelay: 100,
        backoffMultiplier: 2
      };
      
      const promise5 = fetchWithRetry(mockFn, config5);
      await vi.runAllTimersAsync();
      await expect(promise5).rejects.toThrow('Always fails');
      expect(mockFn).toHaveBeenCalledTimes(6); // Initial + 5 retries
    });

    it('should use different backoff multipliers', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockRejectedValueOnce(new Error('Fail 3'))
        .mockResolvedValueOnce('success');
      
      // Test with backoffMultiplier: 3
      const config = {
        maxRetries: 3,
        initialDelay: 100,
        backoffMultiplier: 3
      };
      
      const promise = fetchWithRetry(mockFn, config);
      
      // First attempt fails immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(mockFn).toHaveBeenCalledTimes(1);
      
      // Wait for first retry delay (100ms = 100 * 3^0)
      await vi.advanceTimersByTimeAsync(100);
      expect(mockFn).toHaveBeenCalledTimes(2);
      
      // Wait for second retry delay (300ms = 100 * 3^1)
      await vi.advanceTimersByTimeAsync(300);
      expect(mockFn).toHaveBeenCalledTimes(3);
      
      // Wait for third retry delay (900ms = 100 * 3^2)
      await vi.advanceTimersByTimeAsync(900);
      expect(mockFn).toHaveBeenCalledTimes(4);
      
      const result = await promise;
      expect(result).toBe('success');
    });

    it('should handle zero backoff multiplier (constant delay)', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('success');
      
      const config = {
        maxRetries: 2,
        initialDelay: 200,
        backoffMultiplier: 1 // Constant delay
      };
      
      const promise = fetchWithRetry(mockFn, config);
      
      // First attempt fails immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(mockFn).toHaveBeenCalledTimes(1);
      
      // Wait for first retry delay (200ms)
      await vi.advanceTimersByTimeAsync(200);
      expect(mockFn).toHaveBeenCalledTimes(2);
      
      // Wait for second retry delay (200ms - constant)
      await vi.advanceTimersByTimeAsync(200);
      expect(mockFn).toHaveBeenCalledTimes(3);
      
      const result = await promise;
      expect(result).toBe('success');
    });

    it('should handle very short initial delays', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce('success');
      
      const config = {
        maxRetries: 1,
        initialDelay: 10, // Very short delay
        backoffMultiplier: 2
      };
      
      const promise = fetchWithRetry(mockFn, config);
      
      await vi.advanceTimersByTimeAsync(0);
      expect(mockFn).toHaveBeenCalledTimes(1);
      
      await vi.advanceTimersByTimeAsync(10);
      expect(mockFn).toHaveBeenCalledTimes(2);
      
      const result = await promise;
      expect(result).toBe('success');
    });

    it('should handle zero max retries (no retry)', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Immediate fail'));
      
      const config = {
        maxRetries: 0,
        initialDelay: 1000,
        backoffMultiplier: 2
      };
      
      const promise = fetchWithRetry(mockFn, config);
      
      await vi.runAllTimersAsync();
      
      await expect(promise).rejects.toThrow('Immediate fail');
      expect(mockFn).toHaveBeenCalledTimes(1); // Only initial attempt, no retries
    });
  });
});
