# Download Error Handling and Cleanup Implementation

## Overview

This document describes the comprehensive error handling and cleanup mechanisms implemented for the download system in the Kiyya desktop streaming application.

## Implementation Details

### 1. Error Handling During Download Operations

The download system now includes robust error handling at every stage of the download process:

#### Lock File Creation
- **Error**: Failed to create lock file
- **Handling**: Returns descriptive error immediately
- **Cleanup**: N/A (no resources allocated yet)

#### Content Metadata Retrieval
- **Error**: Failed to get content length, ETag, or Range support
- **Handling**: Logs error and returns with context
- **Cleanup**: Removes lock file

#### Disk Space Check
- **Error**: Insufficient disk space
- **Handling**: Returns `InsufficientDiskSpace` error with details
- **Cleanup**: Removes lock file

#### Network Request Initiation
- **Error**: Failed to start HTTP request
- **Handling**: Converts to `Network` error with context
- **Cleanup**: Removes lock file

#### HTTP Response Status
- **Error**: Non-success HTTP status code
- **Handling**: Returns `Download` error with status code
- **Cleanup**: Removes lock file

#### File Operations
- **Error**: Failed to open/create temp file or seek
- **Handling**: Returns `Io` error with context
- **Cleanup**: Removes lock file

#### Download Streaming
- **Error**: Network error during chunk download
- **Handling**: Returns `DownloadInterrupted` error
- **Cleanup**: Removes lock file, keeps temp file for resume
- **Event**: Emits `download-error` event with resume capability info

#### Write Operations
- **Error**: Failed to write chunk to disk
- **Handling**: Returns `DownloadInterrupted` error
- **Cleanup**: Removes lock file, keeps temp file for potential recovery
- **Event**: Emits `download-error` event with bytes downloaded

#### File Size Verification
- **Error**: Downloaded size doesn't match expected size
- **Handling**: Returns `FileCorruption` error
- **Cleanup**: Removes lock file, temp file, and ETag file

#### File Flush
- **Error**: Failed to flush file buffer
- **Handling**: Returns `Io` error
- **Cleanup**: Removes lock file and temp file

#### Encryption
- **Error**: Failed to encrypt downloaded content
- **Handling**: Returns `Encryption` error with context
- **Cleanup**: Removes lock file, temp file, and partial encrypted file

#### File Rename
- **Error**: Failed to rename temp file to final name
- **Handling**: Returns `Io` error
- **Cleanup**: Removes lock file and temp file

#### Final Metadata
- **Error**: Failed to get final file metadata
- **Handling**: Returns `Io` error
- **Cleanup**: Removes lock file and final file

### 2. Cleanup Functions

#### `cleanup_failed_download(claim_id, quality)`
Removes all temporary files associated with a failed download:
- `{claim_id}-{quality}.tmp` - Partial download file
- `{claim_id}-{quality}.lock` - Download lock file
- `{claim_id}-{quality}.etag` - ETag validation file

**Usage**: Called automatically by the command handler when a download fails.

**Behavior**: 
- Ignores errors if files don't exist
- Logs warnings if cleanup fails
- Always returns `Ok(())` to prevent cascading errors

#### `cleanup_stale_locks()`
Removes lock files older than 1 hour (from crashed downloads):
- Scans vault directory for `.lock` files
- Checks modification time
- Removes files older than 1 hour

**Usage**: Should be called on application startup.

### 3. Error Event Emission

When downloads fail, the system emits detailed error events to the frontend:

```json
{
  "claimId": "abc123",
  "quality": "720p",
  "error": "Network error: connection timeout",
  "errorCategory": "network",
  "userMessage": "Network connection failed. Please check your internet connection.",
  "recoverable": true
}
```

For interrupted downloads, additional information is provided:

```json
{
  "claimId": "abc123",
  "quality": "720p",
  "error": "Network error: connection reset",
  "bytesDownloaded": 5242880,
  "totalBytes": 10485760,
  "resumable": true
}
```

### 4. Command-Level Error Handling

The `download_movie_quality` command includes:

1. **Automatic Cleanup**: Calls `cleanup_failed_download()` when download fails
2. **Enhanced Error Events**: Emits events with error category and user message
3. **Error Propagation**: Returns errors to frontend for display

### 5. Error Recovery Mechanisms

#### Resumable Downloads
- Partial files (`.tmp`) are preserved on network errors
- ETag files track content version for resume validation
- Lock files prevent concurrent downloads

#### Automatic Retry
- Frontend can detect `recoverable: true` in error events
- Can retry with same parameters
- Resume will be attempted automatically if supported

#### Stale Lock Cleanup
- Prevents permanent lock from crashed downloads
- Runs on application startup
- Removes locks older than 1 hour

## Testing

### Unit Tests

1. **test_cleanup_failed_download**: Verifies cleanup removes all related files
2. **test_check_disk_space**: Verifies disk space checking works
3. **test_check_disk_space_insufficient**: Verifies error on insufficient space
4. **test_delete_content**: Verifies deletion removes all related files
5. **test_cleanup_stale_locks**: Verifies old lock files are removed

### Integration Testing

To test error handling in a real scenario:

1. **Network Interruption**: Disconnect network during download
   - Expected: `DownloadInterrupted` error, temp file preserved
   - Expected: `download-error` event with `resumable: true`

2. **Disk Full**: Fill disk during download
   - Expected: `Io` error, cleanup performed
   - Expected: All temp files removed

3. **Encryption Failure**: Corrupt encryption key
   - Expected: `Encryption` error, cleanup performed
   - Expected: All files removed

4. **Concurrent Download**: Start same download twice
   - Expected: Second download fails with lock error
   - Expected: First download continues normally

## Error Categories

All download errors are categorized for metrics and debugging:

- `network`: Network-related errors (timeouts, connection failures)
- `filesystem`: Disk space, permissions, I/O errors
- `download`: Download-specific errors (interruptions, corruption)
- `security`: Encryption and key management errors

## User Messages

User-friendly error messages are provided for common scenarios:

- **Network Error**: "Network connection failed. Please check your internet connection."
- **Insufficient Disk Space**: "Not enough disk space. Need X MB, but only Y MB available."
- **Download Interrupted**: "Download was interrupted. You can resume it later."
- **Encryption Failed**: "Failed to encrypt content. Your encryption key may be invalid."

## Best Practices

1. **Always Clean Up**: Every error path includes cleanup logic
2. **Preserve Resume Data**: Keep temp files on recoverable errors
3. **Emit Detailed Events**: Provide frontend with actionable information
4. **Log Everything**: All errors are logged with context
5. **Fail Gracefully**: Never leave system in inconsistent state

## Future Enhancements

1. **Automatic Retry**: Implement exponential backoff retry logic
2. **Bandwidth Throttling**: Add rate limiting for downloads
3. **Parallel Downloads**: Support multiple concurrent downloads
4. **Download Queue**: Implement download queue management
5. **Progress Persistence**: Save progress to database for app restart recovery
