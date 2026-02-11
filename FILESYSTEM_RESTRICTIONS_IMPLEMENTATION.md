# Filesystem Access Restrictions Implementation

## Overview

This document describes the implementation of filesystem access restrictions for the Kiyya desktop application, ensuring all file operations are limited to the application data directory only.

## Security Requirements

**Requirement 12.2**: File system access limited to application data folder
- All file operations must be within `$APPDATA/Kiyya/**`
- Path traversal attacks (../) must be prevented
- Symbolic links must be resolved and validated
- Absolute paths outside app data must be rejected

## Implementation

### 1. Path Security Module (`src-tauri/src/path_security.rs`)

A dedicated module provides path validation functions:

#### Key Functions

**`get_app_data_dir()`**
- Returns the validated Kiyya app data directory
- Windows: `%APPDATA%\Kiyya`
- macOS: `~/Library/Application Support/Kiyya`
- Linux: `~/.local/share/Kiyya`
- Test mode: Uses temporary directory for isolation

**`validate_path(path)`**
- Validates that a path is within the app data directory
- Resolves symbolic links and `..` components
- Prevents path traversal attacks
- Returns canonical path or SecurityViolation error

**`validate_subdir_path(subdir, filename)`**
- Convenience function for common patterns
- Example: `validate_subdir_path("vault", "movie.mp4")` → `$APPDATA/Kiyya/vault/movie.mp4`

**`resolve_path_components(path)`**
- Manually resolves `.` and `..` components
- Works with non-existent paths
- Prevents traversal beyond root directory

**`normalize_path(path)`**
- Normalizes Windows UNC paths (`\\?\`)
- Ensures consistent path comparison

### 2. Integration with Existing Modules

All modules that perform file operations have been updated to use path validation:

#### Database Module (`src-tauri/src/database.rs`)
```rust
// Before
let app_data_dir = tauri::api::path::app_data_dir(&tauri::Config::default())?;
let db_path = app_data_dir.join("Kiyya").join("app.db");

// After
let kiyya_dir = path_security::get_app_data_dir()?;
let db_path = path_security::validate_path("app.db")?;
```

#### Download Manager (`src-tauri/src/download.rs`)
```rust
// Before
let vault_path = app_data_dir.join("Kiyya").join("vault");

// After
let vault_path = path_security::validate_subdir_path("vault", "")?;

// In get_content_path
let path = path_security::validate_subdir_path("vault", filename)?;
```

#### Local Server (`src-tauri/src/server.rs`)
```rust
// Before
let vault_path = app_data_dir.join("Kiyya").join("vault");

// After
let vault_path = path_security::validate_subdir_path("vault", "")?;
```

#### Gateway Client (`src-tauri/src/gateway.rs`)
```rust
// Before
let log_dir = app_data_dir.join("kiyya").join("logs");
let log_file_path = log_dir.join("gateway.log");

// After
let log_file_path = path_security::validate_subdir_path("logs", "gateway.log")?;
```

#### Logging Module (`src-tauri/src/logging.rs`)
```rust
// Before
if let Some(data_dir) = dirs::data_dir() {
    Ok(data_dir.join("kiyya-desktop").join("logs"))
}

// After
match path_security::validate_subdir_path("logs", "") {
    Ok(log_dir) => Ok(log_dir),
    Err(_) => Ok(std::env::temp_dir().join("kiyya-desktop-logs"))
}
```

### 3. Tauri Configuration

Filesystem restrictions are also enforced at the Tauri framework level in `src-tauri/tauri.conf.json`:

```json
{
  "tauri": {
    "allowlist": {
      "fs": {
        "all": false,
        "readFile": true,
        "writeFile": true,
        "readDir": true,
        "copyFile": true,
        "createDir": true,
        "removeDir": true,
        "removeFile": true,
        "renameFile": true,
        "exists": true,
        "scope": [
          "$APPDATA/Kiyya/**"
        ]
      }
    }
  }
}
```

## Security Properties

### Path Traversal Prevention

The implementation prevents path traversal attacks:

```rust
// These will fail with SecurityViolation error
validate_path("../../../etc/passwd")?;
validate_path("vault/../../../../../../etc/passwd")?;
validate_path("/etc/passwd")?;
validate_path("C:\\Windows\\System32\\config")?;
```

### Symbolic Link Resolution

Symbolic links are resolved and validated:
- Links pointing outside app data directory are rejected
- Canonical paths are returned after resolution
- Prevents symlink-based directory traversal

### Windows UNC Path Handling

Windows UNC paths (`\\?\`) are normalized for consistent comparison:
- `canonicalize()` may add UNC prefix on Windows
- `normalize_path()` removes prefix for comparison
- Ensures `starts_with()` checks work correctly

## Testing

### Unit Tests

The `path_security` module includes comprehensive unit tests:

```bash
cargo test path_security::tests
```

Tests cover:
- Valid relative paths
- Valid nested paths
- Path traversal attacks
- Absolute paths outside app data
- Subdirectory path validation
- Path component resolution
- Multiple parent directory traversal

### Integration Tests

Existing tests validate the integration:

```bash
# Tauri configuration tests
npm test tests/unit/tauri-config.test.ts

# Full test suite
cargo test
```

## Error Handling

Path validation errors return `KiyyaError::SecurityViolation`:

```rust
pub enum KiyyaError {
    SecurityViolation { message: String },
    // ... other variants
}
```

User-friendly error messages:
- "Path 'X' is outside application data directory"
- "Path traversal beyond root directory"

## Validation Checklist

- [x] Path security module created (`src-tauri/src/path_security.rs`)
- [x] Database module updated to use path validation
- [x] Download manager updated to use path validation
- [x] Local server updated to use path validation
- [x] Gateway client updated to use path validation
- [x] Logging module updated to use path validation
- [x] SecurityViolation error variant exists
- [x] Unit tests pass for path validation
- [x] Tauri configuration restricts filesystem access
- [x] Documentation created

## Usage Examples

### Validating a Simple Path

```rust
use crate::path_security;

// Validate a database path
let db_path = path_security::validate_path("app.db")?;

// Validate a file in a subdirectory
let movie_path = path_security::validate_subdir_path("vault", "movie.mp4")?;
```

### Handling Validation Errors

```rust
match path_security::validate_path(user_input) {
    Ok(safe_path) => {
        // Use safe_path for file operations
        tokio::fs::read(&safe_path).await?;
    }
    Err(KiyyaError::SecurityViolation { message }) => {
        // Log security violation
        tracing::error!("Security violation: {}", message);
        return Err(KiyyaError::SecurityViolation { message });
    }
    Err(e) => {
        // Handle other errors
        return Err(e);
    }
}
```

### Creating Subdirectories

```rust
// Validate and create a subdirectory
let logs_dir = path_security::validate_subdir_path("logs", "")?;
tokio::fs::create_dir_all(&logs_dir).await?;

// Validate a file within the subdirectory
let log_file = path_security::validate_subdir_path("logs", "gateway.log")?;
```

## Security Considerations

### Defense in Depth

Multiple layers of security:
1. **Tauri Framework**: Enforces filesystem scope at framework level
2. **Path Validation**: Runtime validation in Rust code
3. **Error Handling**: Clear security violation errors
4. **Testing**: Comprehensive test coverage

### Attack Vectors Mitigated

- **Path Traversal**: `../` sequences are resolved and validated
- **Absolute Paths**: Paths outside app data are rejected
- **Symbolic Links**: Links are resolved and validated
- **Windows UNC**: UNC paths are normalized for comparison
- **Directory Traversal**: Multiple `..` sequences are prevented

### Limitations

- **User Permissions**: Cannot prevent users with admin rights from accessing files directly
- **OS-Level Access**: OS-level file access controls still apply
- **Backup Software**: Backup software may access files outside the app
- **Antivirus**: Antivirus software may scan all files

## Future Enhancements

Potential improvements:
- [ ] Add file operation logging for audit trail
- [ ] Implement file access rate limiting
- [ ] Add file size limits for write operations
- [ ] Implement file type validation
- [ ] Add encrypted file storage option

## References

- [Tauri Security Documentation](https://tauri.app/v1/guides/security/)
- [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
- [Rust std::path Documentation](https://doc.rust-lang.org/std/path/)

## Changelog

### Version 1.0.0 (Current)
- Initial implementation of filesystem access restrictions
- Path security module with validation functions
- Integration with all file-accessing modules
- Comprehensive unit tests
- Documentation

