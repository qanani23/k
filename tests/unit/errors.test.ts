import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AppError,
  NetworkError,
  GatewayError,
  ContentError,
  DownloadError,
  StorageError,
  PlaybackError,
  ValidationError,
  ErrorCategory,
  ErrorSeverity,
  isAppError,
  isApiError,
  toAppError,
  getUserFriendlyMessage,
  formatErrorForLogging,
  logError,
  handleError,
  retryWithBackoff,
  withErrorHandling,
  createErrorHandler,
  isRecoverableError,
  shouldRetry,
  getErrorCode,
  isErrorType,
  aggregateErrors,
  safeAsync,
  safeSync,
} from '../../src/lib/errors';
import { ApiError } from '../../src/types';

describe('Error Handling Utilities', () => {
  describe('AppError', () => {
    it('should create an AppError with basic properties', () => {
      const error = new AppError('Test error', ErrorCategory.NETWORK, ErrorSeverity.ERROR);
      
      expect(error.message).toBe('Test error');
      expect(error.category).toBe(ErrorCategory.NETWORK);
      expect(error.severity).toBe(ErrorSeverity.ERROR);
      expect(error.recoverable).toBe(true);
      expect(error.timestamp).toBeGreaterThan(0);
    });

    it('should create an AppError with options', () => {
      const error = new AppError('Test error', ErrorCategory.DOWNLOAD, ErrorSeverity.WARNING, {
        code: 'DOWNLOAD_FAILED',
        details: { url: 'https://example.com' },
        recoverable: false,
      });
      
      expect(error.code).toBe('DOWNLOAD_FAILED');
      expect(error.details).toEqual({ url: 'https://example.com' });
      expect(error.recoverable).toBe(false);
    });

    it('should convert to ApiError format', () => {
      const error = new AppError('Test error', ErrorCategory.CONTENT, ErrorSeverity.ERROR, {
        code: 'CONTENT_NOT_FOUND',
        details: { claimId: '123' },
      });
      
      const apiError = error.toApiError();
      
      expect(apiError.message).toBe('Test error');
      expect(apiError.code).toBe('CONTENT_NOT_FOUND');
      expect(apiError.details).toEqual({ claimId: '123' });
    });

    it('should get user-friendly message', () => {
      const error = new NetworkError('Connection failed');
      const message = error.getUserMessage();
      
      expect(message).toBe('Unable to connect to the server. Please check your internet connection.');
    });
  });

  describe('Specialized Error Classes', () => {
    it('should create NetworkError', () => {
      const error = new NetworkError('Network failed');
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.category).toBe(ErrorCategory.NETWORK);
      expect(error.severity).toBe(ErrorSeverity.ERROR);
      expect(error.recoverable).toBe(true);
    });

    it('should create GatewayError', () => {
      const error = new GatewayError('Gateway timeout');
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.category).toBe(ErrorCategory.GATEWAY);
      expect(error.severity).toBe(ErrorSeverity.WARNING);
    });

    it('should create ContentError', () => {
      const error = new ContentError('Content not found');
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.category).toBe(ErrorCategory.CONTENT);
    });

    it('should create DownloadError', () => {
      const error = new DownloadError('Download failed');
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.category).toBe(ErrorCategory.DOWNLOAD);
    });

    it('should create StorageError', () => {
      const error = new StorageError('Disk full');
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.category).toBe(ErrorCategory.STORAGE);
      expect(error.recoverable).toBe(false);
    });

    it('should create PlaybackError', () => {
      const error = new PlaybackError('Codec not supported');
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.category).toBe(ErrorCategory.PLAYBACK);
    });

    it('should create ValidationError', () => {
      const error = new ValidationError('Invalid input');
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.severity).toBe(ErrorSeverity.WARNING);
    });
  });

  describe('Type Guards', () => {
    it('should identify AppError', () => {
      const appError = new AppError('Test');
      const regularError = new Error('Test');
      
      expect(isAppError(appError)).toBe(true);
      expect(isAppError(regularError)).toBe(false);
      expect(isAppError('string')).toBe(false);
      expect(isAppError(null)).toBe(false);
    });

    it('should identify ApiError', () => {
      const apiError: ApiError = { message: 'Test', code: '123' };
      const regularError = new Error('Test');
      
      expect(isApiError(apiError)).toBe(true);
      // Note: Error objects have a 'message' property, so they pass the type guard
      expect(isApiError(regularError)).toBe(true);
      expect(isApiError({ code: '123' })).toBe(false);
    });
  });

  describe('Error Conversion', () => {
    it('should convert AppError to AppError', () => {
      const original = new NetworkError('Test');
      const converted = toAppError(original);
      
      expect(converted).toBe(original);
    });

    it('should convert Error to AppError', () => {
      const original = new Error('Test error');
      const converted = toAppError(original, ErrorCategory.CONTENT);
      
      expect(converted).toBeInstanceOf(AppError);
      expect(converted.message).toBe('Test error');
      expect(converted.category).toBe(ErrorCategory.CONTENT);
    });

    it('should convert ApiError to AppError', () => {
      const apiError: ApiError = { message: 'API failed', code: 'API_ERROR' };
      const converted = toAppError(apiError);
      
      expect(converted).toBeInstanceOf(AppError);
      expect(converted.message).toBe('API failed');
      expect(converted.code).toBe('API_ERROR');
    });

    it('should convert string to AppError', () => {
      const converted = toAppError('String error');
      
      expect(converted).toBeInstanceOf(AppError);
      expect(converted.message).toBe('String error');
    });

    it('should convert unknown to AppError', () => {
      const converted = toAppError({ unknown: 'object' });
      
      expect(converted).toBeInstanceOf(AppError);
      expect(converted.message).toBe('An unknown error occurred');
    });
  });

  describe('User-Friendly Messages', () => {
    it('should return network error message', () => {
      const error = new NetworkError('Connection failed');
      const message = getUserFriendlyMessage(error);
      
      expect(message).toBe('Unable to connect to the server. Please check your internet connection.');
    });

    it('should return gateway error message', () => {
      const error = new GatewayError('Gateway timeout');
      const message = getUserFriendlyMessage(error);
      
      expect(message).toBe('Service temporarily unavailable. Trying alternative servers...');
    });

    it('should return content error message', () => {
      const error = new ContentError('Content not found');
      const message = getUserFriendlyMessage(error);
      
      expect(message).toBe('Failed to load content. Please try again.');
    });

    it('should return download error message', () => {
      const error = new DownloadError('Download failed');
      const message = getUserFriendlyMessage(error);
      
      expect(message).toBe('Download failed. Please check your storage space and try again.');
    });

    it('should return storage error message', () => {
      const error = new StorageError('Disk full');
      const message = getUserFriendlyMessage(error);
      
      expect(message).toBe('Storage error. Please ensure you have enough disk space.');
    });

    it('should return playback error message', () => {
      const error = new PlaybackError('Codec not supported');
      const message = getUserFriendlyMessage(error);
      
      expect(message).toBe('Playback error. This video may not be compatible with your device.');
    });

    it('should return validation error message', () => {
      const error = new ValidationError('Invalid input');
      const message = getUserFriendlyMessage(error);
      
      expect(message).toBe('Invalid input. Please check your data and try again.');
    });

    it('should handle regular Error', () => {
      const error = new Error('Regular error');
      const message = getUserFriendlyMessage(error);
      
      expect(message).toBe('Regular error');
    });

    it('should handle string error', () => {
      const message = getUserFriendlyMessage('String error');
      
      expect(message).toBe('String error');
    });

    it('should handle unknown error', () => {
      const message = getUserFriendlyMessage({ unknown: 'object' });
      
      expect(message).toBe('An unexpected error occurred. Please try again.');
    });
  });

  describe('Error Logging', () => {
    let consoleErrorSpy: any;
    let consoleWarnSpy: any;
    let consoleInfoSpy: any;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleInfoSpy.mockRestore();
    });

    it('should log error with appropriate level', () => {
      const error = new AppError('Test', ErrorCategory.NETWORK, ErrorSeverity.ERROR);
      logError(error, 'TestContext');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('[TestContext] Test', error);
    });

    it('should log warning', () => {
      const error = new AppError('Test', ErrorCategory.GATEWAY, ErrorSeverity.WARNING);
      logError(error);
      
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should log info', () => {
      const error = new AppError('Test', ErrorCategory.UNKNOWN, ErrorSeverity.INFO);
      logError(error);
      
      expect(consoleInfoSpy).toHaveBeenCalled();
    });

    it('should format error for logging', () => {
      const error = new AppError('Test', ErrorCategory.NETWORK, ErrorSeverity.ERROR, {
        code: 'NET_ERR',
        details: { url: 'https://example.com' },
      });
      
      const formatted = formatErrorForLogging(error);
      const parsed = JSON.parse(formatted);
      
      expect(parsed.message).toBe('Test');
      expect(parsed.category).toBe(ErrorCategory.NETWORK);
      expect(parsed.code).toBe('NET_ERR');
      expect(parsed.details).toEqual({ url: 'https://example.com' });
    });
  });

  describe('Error Handling', () => {
    let consoleErrorSpy: any;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should handle error without rethrowing', () => {
      const error = new Error('Test error');
      const result = handleError(error, 'TestContext');
      
      expect(result).toBeInstanceOf(AppError);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle error with rethrowing', () => {
      const error = new Error('Test error');
      
      expect(() => {
        handleError(error, 'TestContext', { rethrow: true });
      }).toThrow(AppError);
    });
  });

  describe('Retry with Backoff', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      
      const result = await retryWithBackoff(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Attempt 1'))
        .mockRejectedValueOnce(new Error('Attempt 2'))
        .mockResolvedValue('success');
      
      const result = await retryWithBackoff(fn, { maxRetries: 3, initialDelay: 10 });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Always fails'));
      
      await expect(
        retryWithBackoff(fn, { maxRetries: 2, initialDelay: 10 })
      ).rejects.toThrow('Operation failed after 3 attempts');
      
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should call onRetry callback', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Attempt 1'))
        .mockResolvedValue('success');
      
      const onRetry = vi.fn();
      
      await retryWithBackoff(fn, { maxRetries: 2, initialDelay: 10, onRetry });
      
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });
  });

  describe('Error Wrapper', () => {
    it('should wrap async function with error handling', async () => {
      const fn = async (x: number) => x * 2;
      const wrapped = withErrorHandling(fn, 'TestContext');
      
      const result = await wrapped(5);
      
      expect(result).toBe(10);
    });

    it('should handle errors in wrapped function', async () => {
      const fn = async () => {
        throw new Error('Test error');
      };
      const wrapped = withErrorHandling(fn, 'TestContext');
      
      await expect(wrapped()).rejects.toThrow(AppError);
    });
  });

  describe('Error Handler Creator', () => {
    it('should create error handler with context', () => {
      const handler = createErrorHandler('TestContext');
      
      expect(handler.handleError).toBeDefined();
      expect(handler.toAppError).toBeDefined();
      expect(handler.logError).toBeDefined();
    });
  });

  describe('Error Recovery', () => {
    it('should identify recoverable errors', () => {
      const recoverableError = new NetworkError('Test');
      const nonRecoverableError = new StorageError('Test');
      
      expect(isRecoverableError(recoverableError)).toBe(true);
      expect(isRecoverableError(nonRecoverableError)).toBe(false);
    });

    it('should determine if retry is needed', () => {
      const networkError = new NetworkError('Test');
      const validationError = new ValidationError('Test');
      
      expect(shouldRetry(networkError, 0, 3)).toBe(true);
      expect(shouldRetry(networkError, 3, 3)).toBe(false);
      expect(shouldRetry(validationError, 0, 3)).toBe(false);
    });
  });

  describe('Error Code Extraction', () => {
    it('should extract code from AppError', () => {
      const error = new AppError('Test', ErrorCategory.NETWORK, ErrorSeverity.ERROR, {
        code: 'NET_ERR',
      });
      
      expect(getErrorCode(error)).toBe('NET_ERR');
    });

    it('should extract code from ApiError', () => {
      const error: ApiError = { message: 'Test', code: 'API_ERR' };
      
      expect(getErrorCode(error)).toBe('API_ERR');
    });

    it('should return undefined for errors without code', () => {
      const error = new Error('Test');
      
      expect(getErrorCode(error)).toBeUndefined();
    });
  });

  describe('Error Type Checking', () => {
    it('should check if error is specific type', () => {
      const networkError = new NetworkError('Test');
      const contentError = new ContentError('Test');
      
      expect(isErrorType(networkError, NetworkError)).toBe(true);
      expect(isErrorType(networkError, ContentError)).toBe(false);
      expect(isErrorType(contentError, ContentError)).toBe(true);
    });
  });

  describe('Error Aggregation', () => {
    it('should aggregate multiple errors', () => {
      const errors = [
        new NetworkError('Network failed'),
        new ContentError('Content not found'),
        new Error('Generic error'),
      ];
      
      const aggregated = aggregateErrors(errors, 'Multiple failures');
      
      expect(aggregated.message).toBe('Multiple failures');
      expect(aggregated.details.count).toBe(3);
      expect(aggregated.details.errors).toHaveLength(3);
    });

    it('should use default message if not provided', () => {
      const errors = [new Error('Error 1'), new Error('Error 2')];
      
      const aggregated = aggregateErrors(errors);
      
      expect(aggregated.message).toBe('Multiple errors occurred (2)');
    });
  });

  describe('Safe Operations', () => {
    it('should safely execute async operation', async () => {
      const fn = async () => 'success';
      
      const result = await safeAsync(fn, 'fallback');
      
      expect(result.data).toBe('success');
      expect(result.error).toBeNull();
    });

    it('should return fallback on async error', async () => {
      const fn = async () => {
        throw new Error('Failed');
      };
      
      const result = await safeAsync(fn, 'fallback');
      
      expect(result.data).toBe('fallback');
      expect(result.error).toBeInstanceOf(AppError);
    });

    it('should safely execute sync operation', () => {
      const fn = () => 'success';
      
      const result = safeSync(fn, 'fallback');
      
      expect(result.data).toBe('success');
      expect(result.error).toBeNull();
    });

    it('should return fallback on sync error', () => {
      const fn = () => {
        throw new Error('Failed');
      };
      
      const result = safeSync(fn, 'fallback');
      
      expect(result.data).toBe('fallback');
      expect(result.error).toBeInstanceOf(AppError);
    });
  });
});
