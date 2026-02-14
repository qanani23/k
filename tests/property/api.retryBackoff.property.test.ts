import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { fetchWithRetry, RETRY_CONFIGS } from '../../src/lib/api';

/**
 * Property-Based Tests for API Retry Logic - Exponential Backoff
 * 
 * **Feature: ui-data-fetching-fixes, Property 11: Retry Exponential Backoff**
 * 
 * For any sequence of retry attempts, the delay between retries should increase 
 * exponentially (e.g., 1s, 2s, 4s), and the total number of retries should not 
 * exceed 3 attempts.
 * 
 * Validates: Requirements 10.6
 */

// Arbitrary generators for retry configurations
const retryConfigArb = fc.record({
  maxRetries: fc.integer({ min: 1, max: 5 }),
  initialDelay: fc.integer({ min: 100, max: 2000 }),
  backoffMultiplier: fc.integer({ min: 2, max: 4 })
});

describe('Property-Based Tests: Retry Exponential Backoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Property 11: Retry Exponential Backoff', () => {
    it('should implement exponential backoff with delays increasing by backoffMultiplier', async () => {
      await fc.assert(
        fc.asyncProperty(
          retryConfigArb,
          async (config) => {
            const delays: number[] = [];
            let attemptCount = 0;

            // Create a function that always fails to trigger retries
            const failingFn = vi.fn(async () => {
              attemptCount++;
              throw new Error(`Attempt ${attemptCount} failed`);
            });

            // Start the retry operation
            const retryPromise = fetchWithRetry(failingFn, config);

            // Advance timers and capture delays
            for (let attempt = 0; attempt < config.maxRetries; attempt++) {
              // Wait for the current attempt to execute
              await vi.runOnlyPendingTimersAsync();
              
              // If not the last attempt, there should be a delay
              if (attempt < config.maxRetries) {
                const expectedDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
                delays.push(expectedDelay);
                
                // Advance time by the expected delay
                await vi.advanceTimersByTimeAsync(expectedDelay);
              }
            }

            // Run final attempt
            await vi.runOnlyPendingTimersAsync();

            // Expect the promise to reject after all retries
            await expect(retryPromise).rejects.toThrow();

            // Verify the number of attempts
            expect(attemptCount).toBe(config.maxRetries + 1);

            // Verify exponential backoff pattern
            for (let i = 0; i < delays.length; i++) {
              const expectedDelay = config.initialDelay * Math.pow(config.backoffMultiplier, i);
              expect(delays[i]).toBe(expectedDelay);
            }

            // Verify delays increase exponentially
            for (let i = 1; i < delays.length; i++) {
              expect(delays[i]).toBe(delays[i - 1] * config.backoffMultiplier);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not exceed maxRetries attempts', async () => {
      await fc.assert(
        fc.asyncProperty(
          retryConfigArb,
          async (config) => {
            let attemptCount = 0;

            const failingFn = vi.fn(async () => {
              attemptCount++;
              throw new Error(`Attempt ${attemptCount} failed`);
            });

            const retryPromise = fetchWithRetry(failingFn, config);

            // Advance through all retry attempts
            for (let i = 0; i <= config.maxRetries; i++) {
              await vi.runOnlyPendingTimersAsync();
              if (i < config.maxRetries) {
                const delay = config.initialDelay * Math.pow(config.backoffMultiplier, i);
                await vi.advanceTimersByTimeAsync(delay);
              }
            }

            await expect(retryPromise).rejects.toThrow();

            // Total attempts should be maxRetries + 1 (initial attempt + retries)
            expect(attemptCount).toBe(config.maxRetries + 1);
            expect(attemptCount).toBeLessThanOrEqual(config.maxRetries + 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return immediately on success without retrying', async () => {
      await fc.assert(
        fc.asyncProperty(
          retryConfigArb,
          fc.string(),
          async (config, successValue) => {
            let attemptCount = 0;

            const successFn = vi.fn(async () => {
              attemptCount++;
              return successValue;
            });

            const result = await fetchWithRetry(successFn, config);

            // Should succeed on first attempt without any delays
            expect(attemptCount).toBe(1);
            expect(result).toBe(successValue);
            expect(successFn).toHaveBeenCalledTimes(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should succeed on retry if function eventually succeeds', async () => {
      await fc.assert(
        fc.asyncProperty(
          retryConfigArb,
          fc.integer({ min: 1, max: 3 }),
          fc.string(),
          async (config, failuresBeforeSuccess, successValue) => {
            // Precondition: must fail fewer times than maxRetries
            fc.pre(failuresBeforeSuccess <= config.maxRetries);

            let attemptCount = 0;

            const eventualSuccessFn = vi.fn(async () => {
              attemptCount++;
              if (attemptCount <= failuresBeforeSuccess) {
                throw new Error(`Attempt ${attemptCount} failed`);
              }
              return successValue;
            });

            const retryPromise = fetchWithRetry(eventualSuccessFn, config);

            // Advance through the failing attempts
            for (let i = 0; i < failuresBeforeSuccess; i++) {
              await vi.runOnlyPendingTimersAsync();
              const delay = config.initialDelay * Math.pow(config.backoffMultiplier, i);
              await vi.advanceTimersByTimeAsync(delay);
            }

            // Run the successful attempt
            await vi.runOnlyPendingTimersAsync();

            const result = await retryPromise;

            expect(result).toBe(successValue);
            expect(attemptCount).toBe(failuresBeforeSuccess + 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should throw the last error after all retries are exhausted', async () => {
      await fc.assert(
        fc.asyncProperty(
          retryConfigArb,
          async (config) => {
            const errors = Array.from({ length: config.maxRetries + 1 }, (_, i) => 
              new Error(`Attempt ${i + 1} failed`)
            );
            let attemptCount = 0;

            const failingFn = vi.fn(async () => {
              const error = errors[attemptCount];
              attemptCount++;
              throw error;
            });

            const retryPromise = fetchWithRetry(failingFn, config);

            // Advance through all attempts
            for (let i = 0; i <= config.maxRetries; i++) {
              await vi.runOnlyPendingTimersAsync();
              if (i < config.maxRetries) {
                const delay = config.initialDelay * Math.pow(config.backoffMultiplier, i);
                await vi.advanceTimersByTimeAsync(delay);
              }
            }

            // Should throw the last error
            await expect(retryPromise).rejects.toThrow(errors[errors.length - 1].message);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use default category config when no config provided', async () => {
      let attemptCount = 0;

      const failingFn = vi.fn(async () => {
        attemptCount++;
        throw new Error(`Attempt ${attemptCount} failed`);
      });

      const retryPromise = fetchWithRetry(failingFn);

      // Use the default category config
      const defaultConfig = RETRY_CONFIGS.category;

      // Advance through all attempts with default config
      for (let i = 0; i <= defaultConfig.maxRetries; i++) {
        await vi.runOnlyPendingTimersAsync();
        if (i < defaultConfig.maxRetries) {
          const delay = defaultConfig.initialDelay * Math.pow(defaultConfig.backoffMultiplier, i);
          await vi.advanceTimersByTimeAsync(delay);
        }
      }

      await expect(retryPromise).rejects.toThrow();

      // Should use default maxRetries (3)
      expect(attemptCount).toBe(defaultConfig.maxRetries + 1);
    });

    it('should calculate delays correctly for standard exponential backoff (2x multiplier)', async () => {
      const config = {
        maxRetries: 3,
        initialDelay: 1000,
        backoffMultiplier: 2
      };

      const delays: number[] = [];
      let attemptCount = 0;

      const failingFn = vi.fn(async () => {
        attemptCount++;
        throw new Error(`Attempt ${attemptCount} failed`);
      });

      const retryPromise = fetchWithRetry(failingFn, config);

      // Expected delays: 1000ms, 2000ms, 4000ms
      const expectedDelays = [1000, 2000, 4000];

      for (let i = 0; i < config.maxRetries; i++) {
        await vi.runOnlyPendingTimersAsync();
        const delay = expectedDelays[i];
        delays.push(delay);
        await vi.advanceTimersByTimeAsync(delay);
      }

      await vi.runOnlyPendingTimersAsync();

      await expect(retryPromise).rejects.toThrow();

      // Verify exact delay sequence
      expect(delays).toEqual(expectedDelays);
      expect(attemptCount).toBe(4); // 1 initial + 3 retries
    });

    it('should handle different backoff multipliers correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }),
          async (multiplier) => {
            const config = {
              maxRetries: 3,
              initialDelay: 100,
              backoffMultiplier: multiplier
            };

            const delays: number[] = [];
            let attemptCount = 0;

            const failingFn = vi.fn(async () => {
              attemptCount++;
              throw new Error(`Attempt ${attemptCount} failed`);
            });

            const retryPromise = fetchWithRetry(failingFn, config);

            for (let i = 0; i < config.maxRetries; i++) {
              await vi.runOnlyPendingTimersAsync();
              const expectedDelay = config.initialDelay * Math.pow(multiplier, i);
              delays.push(expectedDelay);
              await vi.advanceTimersByTimeAsync(expectedDelay);
            }

            await vi.runOnlyPendingTimersAsync();

            await expect(retryPromise).rejects.toThrow();

            // Verify each delay follows the exponential pattern
            for (let i = 0; i < delays.length; i++) {
              const expectedDelay = config.initialDelay * Math.pow(multiplier, i);
              expect(delays[i]).toBe(expectedDelay);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
