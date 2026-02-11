/**
 * Error handling utilities for the Kiyya application
 * Provides centralized error handling, logging, and user-friendly error messages
 * 
 * @example Basic Usage
 * ```typescript
 * import { NetworkError, handleError, toAppError } from './lib/errors';
 * 
 * // Create specific error types
 * throw new NetworkError('Connection failed', { code: 'NET_001' });
 * 
 * // Handle errors in try-catch blocks
 * try {
 *   await fetchData();
 * } catch (error) {
 *   const appError = handleError(error, 'DataFetching');
 *   // Error is logged automatically
 * }
 * 
 * // Convert unknown errors to AppError
 * const appError = toAppError(error, ErrorCategory.CONTENT);
 * 
 * // Get user-friendly messages
 * const message = getUserFriendlyMessage(error);
 * ```
 * 
 * @example Retry with Backoff
 * ```typescript
 * import { retryWithBackoff } from './lib/errors';
 * 
 * const result = await retryWithBackoff(
 *   () => fetchFromAPI(),
 *   {
 *     maxRetries: 3,
 *     initialDelay: 300,
 *     onRetry: (attempt, error) => {
 *       console.log(`Retry attempt ${attempt}:`, error);
 *     }
 *   }
 * );
 * ```
 * 
 * @example Safe Operations
 * ```typescript
 * import { safeAsync, safeSync } from './lib/errors';
 * 
 * // Async operation that never throws
 * const { data, error } = await safeAsync(
 *   () => fetchData(),
 *   [] // fallback value
 * );
 * 
 * if (error) {
 *   console.error('Failed to fetch:', error.message);
 * }
 * ```
 * 
 * @example Wrapping Functions
 * ```typescript
 * import { withErrorHandling } from './lib/errors';
 * 
 * const safeFetch = withErrorHandling(
 *   async (url: string) => {
 *     const response = await fetch(url);
 *     return response.json();
 *   },
 *   'API Fetch'
 * );
 * ```
 */

import { ApiError } from '../types';

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  NETWORK = 'network',
  GATEWAY = 'gateway',
  CONTENT = 'content',
  DOWNLOAD = 'download',
  STORAGE = 'storage',
  PLAYBACK = 'playback',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Structured error class for application errors
 */
export class AppError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly code?: string;
  public readonly details?: any;
  public readonly timestamp: number;
  public readonly recoverable: boolean;

  constructor(
    message: string,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    options?: {
      code?: string;
      details?: any;
      recoverable?: boolean;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'AppError';
    this.category = category;
    this.severity = severity;
    this.code = options?.code;
    this.details = options?.details;
    this.timestamp = Date.now();
    this.recoverable = options?.recoverable ?? true;

    // Maintain proper stack trace
    if (options?.cause) {
      this.stack = `${this.stack}\nCaused by: ${options.cause.stack}`;
    }
  }

  /**
   * Convert to ApiError format
   */
  toApiError(): ApiError {
    return {
      message: this.message,
      code: this.code,
      details: this.details,
    };
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    return getUserFriendlyMessage(this);
  }
}

/**
 * Network-related errors
 */
export class NetworkError extends AppError {
  constructor(message: string, options?: { code?: string; details?: any; cause?: Error }) {
    super(message, ErrorCategory.NETWORK, ErrorSeverity.ERROR, {
      ...options,
      recoverable: true,
    });
    this.name = 'NetworkError';
  }
}

/**
 * Gateway failover errors
 */
export class GatewayError extends AppError {
  constructor(message: string, options?: { code?: string; details?: any; cause?: Error }) {
    super(message, ErrorCategory.GATEWAY, ErrorSeverity.WARNING, {
      ...options,
      recoverable: true,
    });
    this.name = 'GatewayError';
  }
}

/**
 * Content parsing/loading errors
 */
export class ContentError extends AppError {
  constructor(message: string, options?: { code?: string; details?: any; cause?: Error }) {
    super(message, ErrorCategory.CONTENT, ErrorSeverity.ERROR, {
      ...options,
      recoverable: true,
    });
    this.name = 'ContentError';
  }
}

/**
 * Download-related errors
 */
export class DownloadError extends AppError {
  constructor(message: string, options?: { code?: string; details?: any; cause?: Error }) {
    super(message, ErrorCategory.DOWNLOAD, ErrorSeverity.ERROR, {
      ...options,
      recoverable: true,
    });
    this.name = 'DownloadError';
  }
}

/**
 * Storage/disk errors
 */
export class StorageError extends AppError {
  constructor(message: string, options?: { code?: string; details?: any; cause?: Error }) {
    super(message, ErrorCategory.STORAGE, ErrorSeverity.ERROR, {
      ...options,
      recoverable: false,
    });
    this.name = 'StorageError';
  }
}

/**
 * Playback errors
 */
export class PlaybackError extends AppError {
  constructor(message: string, options?: { code?: string; details?: any; cause?: Error }) {
    super(message, ErrorCategory.PLAYBACK, ErrorSeverity.ERROR, {
      ...options,
      recoverable: true,
    });
    this.name = 'PlaybackError';
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
  constructor(message: string, options?: { code?: string; details?: any; cause?: Error }) {
    super(message, ErrorCategory.VALIDATION, ErrorSeverity.WARNING, {
      ...options,
      recoverable: true,
    });
    this.name = 'ValidationError';
  }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as any).message === 'string'
  );
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown, category?: ErrorCategory): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(
      error.message,
      category || ErrorCategory.UNKNOWN,
      ErrorSeverity.ERROR,
      { cause: error }
    );
  }

  if (isApiError(error)) {
    return new AppError(
      error.message,
      category || ErrorCategory.UNKNOWN,
      ErrorSeverity.ERROR,
      { code: error.code, details: error.details }
    );
  }

  if (typeof error === 'string') {
    return new AppError(error, category || ErrorCategory.UNKNOWN);
  }

  return new AppError(
    'An unknown error occurred',
    category || ErrorCategory.UNKNOWN,
    ErrorSeverity.ERROR,
    { details: error }
  );
}

/**
 * Get user-friendly error message based on error type
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (isAppError(error)) {
    switch (error.category) {
      case ErrorCategory.NETWORK:
        return 'Unable to connect to the server. Please check your internet connection.';
      case ErrorCategory.GATEWAY:
        return 'Service temporarily unavailable. Trying alternative servers...';
      case ErrorCategory.CONTENT:
        return 'Failed to load content. Please try again.';
      case ErrorCategory.DOWNLOAD:
        return 'Download failed. Please check your storage space and try again.';
      case ErrorCategory.STORAGE:
        return 'Storage error. Please ensure you have enough disk space.';
      case ErrorCategory.PLAYBACK:
        return 'Playback error. This video may not be compatible with your device.';
      case ErrorCategory.VALIDATION:
        return 'Invalid input. Please check your data and try again.';
      default:
        return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (isApiError(error)) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Format error for logging
 */
export function formatErrorForLogging(error: unknown): string {
  if (isAppError(error)) {
    return JSON.stringify({
      name: error.name,
      message: error.message,
      category: error.category,
      severity: error.severity,
      code: error.code,
      timestamp: error.timestamp,
      recoverable: error.recoverable,
      details: error.details,
      stack: error.stack,
    }, null, 2);
  }

  if (error instanceof Error) {
    return JSON.stringify({
      name: error.name,
      message: error.message,
      stack: error.stack,
    }, null, 2);
  }

  return JSON.stringify(error, null, 2);
}

/**
 * Log error to console with appropriate level
 */
export function logError(error: unknown, context?: string): void {
  const prefix = context ? `[${context}]` : '';
  
  if (isAppError(error)) {
    switch (error.severity) {
      case ErrorSeverity.INFO:
        console.info(`${prefix} ${error.message}`, error);
        break;
      case ErrorSeverity.WARNING:
        console.warn(`${prefix} ${error.message}`, error);
        break;
      case ErrorSeverity.ERROR:
      case ErrorSeverity.CRITICAL:
        console.error(`${prefix} ${error.message}`, error);
        break;
    }
  } else {
    console.error(`${prefix} Error:`, error);
  }
}

/**
 * Handle error with logging and optional user notification
 */
export function handleError(
  error: unknown,
  context?: string,
  options?: {
    notify?: boolean;
    rethrow?: boolean;
  }
): AppError {
  const appError = toAppError(error);
  
  // Log the error
  logError(appError, context);

  // Optionally notify user (would integrate with toast system)
  if (options?.notify) {
    // This would trigger a toast notification in the UI
    // Implementation depends on toast system integration
  }

  // Optionally rethrow
  if (options?.rethrow) {
    throw appError;
  }

  return appError;
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    onRetry?: (attempt: number, error: Error) => void;
  }
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 300,
    maxDelay = 10000,
    backoffFactor = 2,
    onRetry,
  } = options || {};

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        break;
      }

      // Call retry callback
      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));

      // Increase delay with backoff factor
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw new AppError(
    `Operation failed after ${maxRetries + 1} attempts`,
    ErrorCategory.UNKNOWN,
    ErrorSeverity.ERROR,
    { cause: lastError!, details: { maxRetries } }
  );
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: string
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      throw handleError(error, context, { rethrow: true });
    }
  };
}

/**
 * Create error boundary handler for React components
 */
export function createErrorHandler(context: string) {
  return {
    handleError: (error: unknown) => handleError(error, context),
    toAppError: (error: unknown) => toAppError(error),
    logError: (error: unknown) => logError(error, context),
  };
}

/**
 * Check if error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  if (isAppError(error)) {
    return error.recoverable;
  }
  return true; // Assume recoverable by default
}

/**
 * Check if error should trigger retry
 */
export function shouldRetry(error: unknown, attemptCount: number, maxAttempts: number): boolean {
  if (attemptCount >= maxAttempts) {
    return false;
  }

  if (isAppError(error)) {
    // Don't retry validation errors or non-recoverable errors
    if (error.category === ErrorCategory.VALIDATION || !error.recoverable) {
      return false;
    }

    // Retry network and gateway errors
    if (error.category === ErrorCategory.NETWORK || error.category === ErrorCategory.GATEWAY) {
      return true;
    }
  }

  return isRecoverableError(error);
}

/**
 * Extract error code from various error types
 */
export function getErrorCode(error: unknown): string | undefined {
  if (isAppError(error)) {
    return error.code;
  }

  if (isApiError(error)) {
    return error.code;
  }

  return undefined;
}

/**
 * Check if error is a specific type
 */
export function isErrorType(error: unknown, type: new (...args: any[]) => Error): boolean {
  return error instanceof type;
}

/**
 * Aggregate multiple errors into a single error
 */
export function aggregateErrors(errors: unknown[], message?: string): AppError {
  const appErrors = errors.map(e => toAppError(e));
  
  return new AppError(
    message || `Multiple errors occurred (${errors.length})`,
    ErrorCategory.UNKNOWN,
    ErrorSeverity.ERROR,
    {
      details: {
        count: errors.length,
        errors: appErrors.map(e => ({
          message: e.message,
          category: e.category,
          code: e.code,
        })),
      },
    }
  );
}

/**
 * Safe async operation wrapper that never throws
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  fallback: T
): Promise<{ data: T; error: null } | { data: T; error: AppError }> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (error) {
    return { data: fallback, error: toAppError(error) };
  }
}

/**
 * Safe sync operation wrapper that never throws
 */
export function safeSync<T>(
  fn: () => T,
  fallback: T
): { data: T; error: null } | { data: T; error: AppError } {
  try {
    const data = fn();
    return { data, error: null };
  } catch (error) {
    return { data: fallback, error: toAppError(error) };
  }
}
