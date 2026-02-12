# Crash Reporting Implementation

## Overview

This document describes the optional crash reporting system implemented for the Kiyya desktop streaming application. The system captures panic information and integrates with the existing error logging and diagnostics infrastructure.

## Implementation Status

✅ **COMPLETE** - Crash reporting is fully implemented and integrated

## Features

### 1. Panic Hook

The crash reporting system sets up a custom panic hook that captures:

- **Panic Message**: The error message from the panic
- **Location**: File, line, and column where the panic occurred
- **Timestamp**: When the crash happened (RFC3339 format)
- **Version**: Application version at the time of crash

### 2. Crash Log File

All crash information is written to a dedicated `crash.log` file in the application's logs directory:

- **Location**: `{app_data}/logs/crash.log`
- **Format**: Human-readable text format with clear separators
- **Persistence**: Crashes are appended to the file, not overwritten
- **Privacy**: All crash data stays local - no external reporting

### 3. Integration with Diagnostics

Crash reports are automatically included in debug packages:

- Debug packages include the complete crash.log file
- If no crashes have occurred, a note is added to the debug package
- Crash information is available alongside other diagnostic data

### 4. Tauri Commands

Two commands are available for frontend access:

#### `get_recent_crashes`
```typescript
interface CrashReport {
  timestamp: string;
  message: string;
  location: string;
  version: string;
}

// Get the last N crash reports
const crashes = await invoke<CrashReport[]>('get_recent_crashes', { limit: 10 });
```

#### `clear_crash_log`
```typescript
// Clear all crash reports
await invoke('clear_crash_log');
```

## Architecture

### Initialization Flow

1. Application starts
2. Logging system initializes
3. Crash reporting initializes (gets app data path)
4. Panic hook is registered
5. Application continues normal startup

### Crash Capture Flow

1. Panic occurs in Rust code
2. Custom panic hook is triggered
3. Crash information is extracted (message, location, timestamp, version)
4. Crash entry is formatted
5. Entry is written to crash.log file
6. Entry is also printed to stderr for immediate visibility
7. Default panic handler is called (application terminates)

### Debug Package Flow

1. User requests debug package
2. System collects all diagnostic information
3. Crash log is included in the package
4. If no crashes exist, a note is added
5. ZIP file is created with all diagnostic data

## File Structure

### Crash Log Format

```
=== CRASH REPORT ===
Timestamp: 2026-02-10T14:30:52Z
Message: thread 'main' panicked at 'assertion failed: x > 0'
Location: src/main.rs:123:45
Version: 0.1.0
===================
```

### Crash Log Location

- **Windows**: `%APPDATA%\kiyya-desktop\logs\crash.log`
- **macOS**: `~/Library/Application Support/kiyya-desktop/logs/crash.log`
- **Linux**: `~/.local/share/kiyya-desktop/logs/crash.log`

## Code Organization

### Module: `src-tauri/src/crash_reporting.rs`

Contains all crash reporting functionality:

- `init_crash_reporting()` - Initializes the system
- `log_crash()` - Internal function to log crash information
- `get_crash_log_path()` - Returns the path to the crash log
- `get_recent_crashes()` - Parses and returns recent crashes
- `clear_crash_log()` - Deletes the crash log file
- `CrashReport` struct - Represents a crash report entry

### Integration Points

1. **main.rs**: Crash reporting is initialized at application startup
2. **commands.rs**: Tauri commands for frontend access
3. **diagnostics.rs**: Crash reports included in debug packages

## Usage Examples

### From Rust Backend

```rust
use crate::crash_reporting;

// Initialize at startup
let app_data_path = get_app_data_dir()?;
crash_reporting::init_crash_reporting(&app_data_path);

// Get recent crashes
let crashes = crash_reporting::get_recent_crashes(10)?;
for crash in crashes {
    println!("Crash at {}: {}", crash.timestamp, crash.message);
}

// Clear crash log
crash_reporting::clear_crash_log()?;
```

### From Frontend (TypeScript)

```typescript
import { invoke } from '@tauri-apps/api/tauri';

// Get recent crashes
async function getRecentCrashes() {
  try {
    const crashes = await invoke<CrashReport[]>('get_recent_crashes', { 
      limit: 10 
    });
    
    console.log(`Found ${crashes.length} crashes`);
    crashes.forEach(crash => {
      console.log(`${crash.timestamp}: ${crash.message} at ${crash.location}`);
    });
  } catch (error) {
    console.error('Failed to get crashes:', error);
  }
}

// Clear crash log
async function clearCrashes() {
  try {
    await invoke('clear_crash_log');
    console.log('Crash log cleared');
  } catch (error) {
    console.error('Failed to clear crash log:', error);
  }
}
```

## Testing

### Unit Tests

Comprehensive unit tests are provided in `src-tauri/src/crash_reporting.rs`:

- `test_init_crash_reporting` - Verifies initialization
- `test_get_recent_crashes_empty` - Tests empty crash log
- `test_clear_crash_log` - Tests crash log deletion
- `test_crash_report_parsing` - Tests parsing of crash reports

### Running Tests

```bash
cd src-tauri
cargo test crash_reporting
```

### Manual Testing

To manually test crash reporting:

1. Add a panic to the code:
   ```rust
   panic!("Test crash for crash reporting");
   ```

2. Run the application
3. Trigger the panic
4. Check the crash.log file in the logs directory
5. Verify the crash information is captured correctly

## Security and Privacy

### Local Only

- **No External Reporting**: All crash data stays on the user's machine
- **No Network Calls**: Crash reporting does not make any network requests
- **User Control**: Users can view and clear crash logs at any time

### Data Minimization

- **Essential Information Only**: Only captures panic message, location, timestamp, and version
- **No User Data**: Does not capture user content, settings, or personal information
- **No Stack Traces**: Currently does not capture full stack traces (can be added if needed)

### Integration with Debug Packages

- Crash reports are included in debug packages for support purposes
- Users explicitly request debug package creation
- Debug packages are created locally and not automatically uploaded

## Performance Considerations

### Minimal Overhead

- **Initialization**: One-time setup at application startup
- **Runtime**: No performance impact during normal operation
- **Crash Time**: Minimal overhead when panic occurs (application is terminating anyway)

### File I/O

- **Append-Only**: Crash log uses append mode for efficient writes
- **No Rotation**: Crash log does not rotate (expected to be small)
- **Manual Cleanup**: Users can clear crash log through UI or command

## Future Enhancements

### Potential Improvements

1. **Stack Traces**: Capture full stack traces using backtrace crate
2. **Crash Deduplication**: Group similar crashes together
3. **Crash Statistics**: Track crash frequency and patterns
4. **Automatic Cleanup**: Optionally clean up old crash reports
5. **Crash Notifications**: Notify users when crashes occur
6. **Crash Recovery**: Attempt to recover from certain types of crashes

### Optional External Reporting

If external crash reporting is desired in the future:

1. Add user consent mechanism
2. Implement privacy-preserving crash reporting
3. Sanitize crash data before transmission
4. Provide opt-out mechanism
5. Use secure transmission (HTTPS)

## Compliance with Requirements

### Task 11.1: Error Handling & Logging

✅ **Comprehensive error logging** - Integrated with existing error logging system  
✅ **Diagnostic information collection** - Crash reports included in debug packages  
✅ **Crash reporting (optional)** - Fully implemented and tested  

### Design Principles

✅ **Privacy-Focused**: No external reporting, all data stays local  
✅ **Security-Focused**: No sensitive information in crash reports  
✅ **Performance-Oriented**: Minimal overhead, efficient file I/O  
✅ **User-Friendly**: Clear crash information, easy to access and clear  

## Conclusion

The crash reporting system provides optional but valuable functionality for debugging and support purposes. It integrates seamlessly with the existing error logging and diagnostics infrastructure while maintaining the application's privacy and security principles.

### Key Benefits

- **Debugging**: Helps identify and fix crashes
- **Support**: Provides valuable information for user support
- **Quality**: Improves application stability over time
- **Privacy**: All data stays local, no external reporting

### Implementation Quality

- ✅ Fully implemented and tested
- ✅ Integrated with existing systems
- ✅ Well-documented with examples
- ✅ Follows application design principles
- ✅ Minimal performance impact
- ✅ Privacy-preserving design

This implementation completes Task 11.1 (Implement crash reporting - optional) from the implementation plan.
