/**
 * Utility functions for scheduling non-critical background tasks
 * using requestIdleCallback when available, with fallback to setTimeout
 * 
 * CRITICAL: Use these utilities for non-critical operations like:
 * - Cache cleanup
 * - Progress saving
 * - Analytics/logging
 * - Prefetching
 * - Background data synchronization
 */

/**
 * Type definition for idle callback options
 */
interface IdleCallbackOptions {
  timeout?: number;
}

/**
 * Type definition for idle deadline
 */
interface IdleDeadline {
  didTimeout: boolean;
  timeRemaining: () => number;
}

/**
 * Type for idle callback function
 */
type IdleCallback = (deadline: IdleDeadline) => void;

/**
 * Check if requestIdleCallback is supported
 */
const supportsIdleCallback = typeof window !== 'undefined' && 'requestIdleCallback' in window;

/**
 * Schedule a task to run when the browser is idle
 * Falls back to setTimeout if requestIdleCallback is not available
 * 
 * @param callback Function to execute during idle time
 * @param options Optional configuration with timeout
 * @returns Handle that can be used to cancel the callback
 */
export function scheduleIdleTask(
  callback: () => void | Promise<void>,
  options?: IdleCallbackOptions
): number {
  if (supportsIdleCallback) {
    return window.requestIdleCallback(
      async (deadline: IdleDeadline) => {
        try {
          await callback();
        } catch (error) {
          console.error('Error in idle callback:', error);
        }
      },
      options
    );
  } else {
    // Fallback to setTimeout with a delay to simulate idle behavior
    return window.setTimeout(async () => {
      try {
        await callback();
      } catch (error) {
        console.error('Error in idle callback (setTimeout fallback):', error);
      }
    }, options?.timeout || 1000);
  }
}

/**
 * Cancel a scheduled idle task
 * 
 * @param handle Handle returned from scheduleIdleTask
 */
export function cancelIdleTask(handle: number): void {
  if (supportsIdleCallback) {
    window.cancelIdleCallback(handle);
  } else {
    window.clearTimeout(handle);
  }
}

/**
 * Schedule multiple tasks to run during idle time
 * Tasks are executed in order, but only if there's enough idle time
 * 
 * @param tasks Array of functions to execute
 * @param options Optional configuration
 * @returns Handle that can be used to cancel all tasks
 */
export function scheduleIdleTasks(
  tasks: Array<() => void | Promise<void>>,
  options?: IdleCallbackOptions
): number {
  let currentTaskIndex = 0;
  let handle: number = 0;

  const executeNextTask = async () => {
    if (currentTaskIndex >= tasks.length) {
      return;
    }

    const task = tasks[currentTaskIndex];
    currentTaskIndex++;
    
    await task();
    
    // Schedule next task if there are more
    if (currentTaskIndex < tasks.length) {
      handle = scheduleIdleTask(executeNextTask, options);
    }
  };

  handle = scheduleIdleTask(executeNextTask, options);
  
  return handle;
}

/**
 * Debounced idle task scheduler
 * Useful for operations that should only run once after a series of events
 * 
 * @param callback Function to execute
 * @param delay Debounce delay in milliseconds
 * @param options Optional idle callback options
 * @returns Function that schedules the debounced task
 */
export function createDebouncedIdleTask(
  callback: () => void | Promise<void>,
  delay: number = 300,
  options?: IdleCallbackOptions
): () => void {
  let timeoutHandle: number | null = null;
  let idleHandle: number | null = null;

  return () => {
    // Clear existing timers
    if (timeoutHandle !== null) {
      window.clearTimeout(timeoutHandle);
    }
    if (idleHandle !== null) {
      cancelIdleTask(idleHandle);
    }

    // Schedule new debounced task
    timeoutHandle = window.setTimeout(() => {
      idleHandle = scheduleIdleTask(callback, options);
    }, delay) as unknown as number;
  };
}

/**
 * Throttled idle task scheduler
 * Ensures a task runs at most once per specified interval
 * 
 * @param callback Function to execute
 * @param interval Minimum interval between executions in milliseconds
 * @param options Optional idle callback options
 * @returns Function that schedules the throttled task
 */
export function createThrottledIdleTask(
  callback: () => void | Promise<void>,
  interval: number = 1000,
  options?: IdleCallbackOptions
): () => void {
  let lastExecutionTime = 0;
  let pendingHandle: number | null = null;

  return () => {
    const now = Date.now();
    const timeSinceLastExecution = now - lastExecutionTime;

    if (timeSinceLastExecution >= interval) {
      // Execute immediately (during idle time)
      lastExecutionTime = now;
      scheduleIdleTask(callback, options);
    } else {
      // Schedule for later if not already scheduled
      if (pendingHandle === null) {
        const remainingTime = interval - timeSinceLastExecution;
        pendingHandle = window.setTimeout(() => {
          pendingHandle = null;
          lastExecutionTime = Date.now();
          scheduleIdleTask(callback, options);
        }, remainingTime);
      }
    }
  };
}

/**
 * Execute a task during idle time with a priority queue
 * Higher priority tasks are executed first
 */
interface PriorityTask {
  callback: () => void | Promise<void>;
  priority: number;
}

class IdleTaskQueue {
  private tasks: PriorityTask[] = [];
  private isProcessing = false;
  private currentHandle: number | null = null;

  /**
   * Add a task to the queue
   * 
   * @param callback Function to execute
   * @param priority Priority level (higher = more important)
   */
  enqueue(callback: () => void | Promise<void>, priority: number = 0): void {
    this.tasks.push({ callback, priority });
    this.tasks.sort((a, b) => b.priority - a.priority);
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process the task queue during idle time
   */
  private processQueue(): void {
    if (this.tasks.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const task = this.tasks.shift();

    if (task) {
      this.currentHandle = scheduleIdleTask(async () => {
        try {
          await task.callback();
        } finally {
          this.processQueue();
        }
      });
    }
  }

  /**
   * Clear all pending tasks
   */
  clear(): void {
    this.tasks = [];
    if (this.currentHandle !== null) {
      cancelIdleTask(this.currentHandle);
      this.currentHandle = null;
    }
    this.isProcessing = false;
  }

  /**
   * Get the number of pending tasks
   */
  get size(): number {
    return this.tasks.length;
  }
}

/**
 * Global idle task queue instance
 */
export const idleTaskQueue = new IdleTaskQueue();

/**
 * Convenience function to schedule a background task with priority
 * 
 * @param callback Function to execute
 * @param priority Priority level (default: 0)
 */
export function scheduleBackgroundTask(
  callback: () => void | Promise<void>,
  priority: number = 0
): void {
  idleTaskQueue.enqueue(callback, priority);
}
