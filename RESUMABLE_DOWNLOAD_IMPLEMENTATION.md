# Resumable Download Implementation

## Overview

This document describes the implementation of resumable download support for the Kiyya desktop streaming application. The implementation allows interrupted downloads to be resumed from where they left off, preventing data loss and improving user experience.

## Implementation Details

### Core Features

1. **HTTP Range Header Support**
   - Uses `Range: bytes={start}-` header to request partial content
   - Handles both 200 (full content) and 206 (partial content) responses
   - Automatically detects if server supports Range headers via `Accept-Ranges` header

2. **ETag Validation**
   - Stores ETag from initial download in `.etag` companion file
   - Validates ETag on resume to ensure content hasn't changed on server
   - Restarts download from beginning if ETag mismatch detected

3. **File Locking**
   - Creates `.lock` file to prevent concurrent downloads of same content
   - Returns error if download already in progress
   - Automatically cleans up stale lock files (older than 1 hour)

4. **Temporary File Management**
   - Downloads to `.tmp` files during transfer
   - Atomically renames to final filename on completion
   - Preserves partial downloads for resume capability

5. **Download Speed Calculation**
   - Tracks bytes downloaded since start
   - Calculates speed in bytes per second
   - Emits speed information in progress events

### Key Methods

#### `download_content()`
Main download method with full resumable support:
- Checks for existing `.tmp` file and resumes if found
- Validates ETag to ensure content hasn't changed
- Detects server Range header support
- Handles both resumable and non-resumable servers
- Emits progress events with speed information
- Cleans up lock and ETag files on completion

#### `get_content_metadata()`
Fetches metadata from server via HEAD request:
- Returns content length for disk space checking
- Returns ETag for resume validation
- Returns whether server supports Range headers

#### `cleanup_stale_locks()`
Maintenance method to clean up orphaned lock files:
- Removes lock files older than 1 hour
- Prevents permanent blocking from crashed downloads
- Should be called on application startup

#### `delete_content()`
Enhanced to clean up all related files:
- Removes main content file
- Removes `.tmp` partial file
- Removes `.lock` file
- Removes `.etag` file

## File Structure

For a download with `claim_id="abc123"` and `quality="720p"`:

```
vault/
├── abc123-720p.tmp      # Partial download (during transfer)
├── abc123-720p.lock     # Lock file (prevents concurrent downloads)
├── abc123-720p.etag     # Stored ETag (for resume validation)
└── abc123-720p.mp4      # Final file (after completion)
```

## Resume Flow

### Scenario 1: Server Supports Range Headers

1. User starts download → creates `.tmp`, `.lock`, `.etag` files
2. Download interrupted at 50% → `.tmp` file contains 50% of data
3. User resumes download:
   - Check `.tmp` file exists and get size (resume_from = 50%)
   - Read stored ETag from `.etag` file
   - HEAD request to server to get current ETag
   - Compare ETags → if match, proceed with resume
   - Send `Range: bytes=50%-` header
   - Server responds with 206 Partial Content
   - Append remaining 50% to `.tmp` file
   - Rename `.tmp` to final filename
   - Clean up `.lock` and `.etag` files

### Scenario 2: Server Doesn't Support Range Headers

1. User starts download → creates `.tmp`, `.lock`, `.etag` files
2. Download interrupted at 50% → `.tmp` file contains 50% of data
3. User resumes download:
   - Check `.tmp` file exists and get size (resume_from = 50%)
   - HEAD request to server → `Accept-Ranges: none` or missing
   - Detect server doesn't support Range headers
   - Delete `.tmp` file
   - Start download from beginning (resume_from = 0)
   - Complete download normally

### Scenario 3: Content Changed on Server (ETag Mismatch)

1. User starts download → creates `.tmp`, `.lock`, `.etag` files with ETag "abc123"
2. Download interrupted at 50%
3. Content updated on server → new ETag "def456"
4. User resumes download:
   - Check `.tmp` file exists and get size (resume_from = 50%)
   - Read stored ETag "abc123" from `.etag` file
   - HEAD request to server → returns ETag "def456"
   - Compare ETags → mismatch detected
   - Delete `.tmp` and `.etag` files
   - Start download from beginning with new ETag
   - Complete download normally

### Scenario 4: Concurrent Download Attempt

1. Download in progress → `.lock` file exists
2. User attempts to start same download again:
   - Check for `.lock` file → exists
   - Return error: "Download already in progress"
   - User must wait for first download to complete or fail

## Error Handling

### Insufficient Disk Space
- Checks available disk space before starting/resuming
- Only checks space for remaining bytes (not full file size)
- Requires 200MB buffer beyond estimated file size
- Returns clear error message with required vs available space

### Network Errors
- Automatically retries with exponential backoff (handled by gateway client)
- Preserves partial download for future resume
- Cleans up lock file on error to allow retry

### Server Errors
- HTTP 4xx/5xx responses abort download
- Partial file preserved for resume if error is temporary
- Lock file cleaned up to allow retry

### File System Errors
- Permission errors abort download
- Disk full errors abort download
- Lock file cleaned up on error

## Testing

### Unit Tests

1. **test_check_disk_space**: Verifies disk space checking with reasonable amount
2. **test_check_disk_space_insufficient**: Verifies error when insufficient space
3. **test_get_content_path**: Verifies file path resolution
4. **test_delete_content**: Verifies cleanup of all related files
5. **test_get_vault_path**: Verifies vault path accessor
6. **test_cleanup_stale_locks**: Verifies stale lock file cleanup
7. **test_get_content_metadata**: Verifies metadata fetching from server

### Integration Testing

To test resumable downloads in a real scenario:

1. Start a large download (>100MB)
2. Interrupt the download midway (kill process or disconnect network)
3. Verify `.tmp`, `.lock`, and `.etag` files exist
4. Restart the application
5. Resume the download
6. Verify download continues from where it left off
7. Verify final file is complete and correct

## Requirements Validation

### Requirement 4.2: Download and Offline Playback
✅ **4.2** - THE Download_Manager SHALL support resumable downloads using HTTP Range headers

### Requirement 21.5: Download Safety and Resumable Operations
✅ **21.5** - THE Download_Manager SHALL support resumable downloads using HTTP Range headers for partial files

### Requirement 21.6: Atomic Operations
✅ **21.6** - THE Download_Manager SHALL write to `.tmp` files and atomically rename on completion

### Requirement 21.7: File Locking
✅ **21.7** - THE Download_Manager SHALL implement file locking to prevent concurrent writes to same content

### Property 9: Resumable Download Consistency
✅ **Property 9** - For any interrupted download, if the server supports Range headers, the download should resume from the last successfully written byte, and if Range headers are not supported, the download should restart from the beginning.

## Performance Considerations

### Disk Space Optimization
- Only checks space for remaining bytes when resuming
- Prevents unnecessary disk space errors for large partial downloads

### Network Efficiency
- Avoids re-downloading already received data
- Reduces bandwidth usage and download time
- Improves user experience on slow/unreliable connections

### Memory Usage
- Streams data directly to disk (no large memory buffers)
- Processes chunks incrementally
- Suitable for large video files (>1GB)

## Security Considerations

### File Locking
- Prevents race conditions from concurrent downloads
- Ensures data integrity during write operations
- Automatically cleans up stale locks to prevent permanent blocking

### ETag Validation
- Ensures resumed content matches original content
- Prevents corruption from server-side content changes
- Automatically restarts download if content changed

### Atomic Operations
- Uses atomic rename to prevent partial files in vault
- Ensures vault only contains complete, valid files
- Temporary files clearly marked with `.tmp` extension

## Future Enhancements

### Potential Improvements
1. **Checksum Validation**: Add SHA-256 checksum verification for completed downloads
2. **Multi-Part Downloads**: Support parallel chunk downloads for faster speeds
3. **Bandwidth Limiting**: Add configurable download speed limits
4. **Retry Logic**: Implement automatic retry with exponential backoff for failed chunks
5. **Progress Persistence**: Store progress in database for cross-session resume

### Not Implemented (Out of Scope)
- Torrent-style peer-to-peer downloads
- CDN failover for download sources
- Download scheduling/queuing system
- Bandwidth usage analytics

## Conclusion

The resumable download implementation provides a robust, user-friendly download experience that handles network interruptions gracefully. It follows best practices for file handling, network operations, and error recovery while maintaining security and data integrity.

Key benefits:
- ✅ Prevents data loss from interrupted downloads
- ✅ Reduces bandwidth usage by avoiding re-downloads
- ✅ Improves user experience on unreliable connections
- ✅ Maintains data integrity with ETag validation
- ✅ Prevents concurrent download conflicts with file locking
- ✅ Handles both resumable and non-resumable servers gracefully
