# Security Documentation

This document details the security measures implemented in the Kiyya desktop application.

## Overview

Kiyya follows security best practices to protect user data and system integrity. The application implements defense-in-depth with multiple layers of security controls.

## Network Security

### Domain Restrictions

The application restricts all network access to explicitly approved domains only. This is enforced at the Tauri framework level through the `allowlist.http.scope` configuration.

#### Approved Domains

**Odysee API Gateways:**
- `https://api.na-backend.odysee.com/**` - Primary gateway
- `https://api.lbry.tv/**` - Secondary gateway
- `https://api.odysee.com/**` - Fallback gateway
- `https://*.odysee.com/**` - All Odysee subdomains
- `https://*.lbry.tv/**` - All LBRY subdomains

**Content Delivery Networks:**
- `https://thumbnails.lbry.com/**` - Thumbnail images
- `https://spee.ch/**` - Media hosting service
- `https://cdn.lbryplayer.xyz/**` - Video player assets
- `https://player.odycdn.com/**` - Video streaming service

**Update System:**
- `https://raw.githubusercontent.com/**` - Application update manifest

#### Enforcement

Network restrictions are enforced through:

1. **Tauri HTTP Allowlist**: Backend Rust code can only make HTTP requests to approved domains
2. **Content Security Policy (CSP)**: Frontend JavaScript is restricted by browser CSP
3. **No Wildcard Permissions**: All domains are explicitly listed (no `https://**` wildcards)

### HTTPS Only

All network requests must use HTTPS protocol. HTTP requests are blocked except for:
- Local server (`http://127.0.0.1:*`) for offline content playback
- WebSocket connections (`ws://127.0.0.1:*`) for local communication

### Content Security Policy

The application enforces a strict Content Security Policy:

```
default-src 'self';
connect-src 'self' [approved-domains] http://127.0.0.1:* ws://127.0.0.1:*;
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com data:;
img-src 'self' data: [cdn-domains];
media-src 'self' data: [streaming-domains] http://127.0.0.1:*;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
```

Key restrictions:
- No `unsafe-eval` in script-src (prevents code injection)
- No external frames (prevents clickjacking)
- Restricted media sources (only approved CDNs)

## Filesystem Security

### Access Restrictions

Filesystem access is strictly limited to the application data directory:

**Allowed Path:**
- `$APPDATA/Kiyya/**` (Windows: `%APPDATA%\Kiyya\`)
- `~/Library/Application Support/Kiyya/**` (macOS)
- `~/.local/share/Kiyya/**` (Linux)

**Blocked Paths:**
- User documents directory
- Desktop directory
- System directories
- Any path outside app data folder

### Enforcement

Filesystem restrictions are enforced through multiple layers:

1. **Tauri FS Allowlist**: Backend Rust code can only access approved paths
2. **Runtime Path Validation**: All file operations validate paths before execution
3. **Path Security Module**: Dedicated module (`src-tauri/src/path_security.rs`) provides validation functions
4. **No Wildcard Permissions**: Only specific app data path is allowed

### Path Validation

All file operations use the path security module:

```rust
use crate::path_security;

// Validate a path before use
let safe_path = path_security::validate_path("vault/movie.mp4")?;

// Validate a subdirectory path
let log_file = path_security::validate_subdir_path("logs", "gateway.log")?;
```

The path validation module:
- Prevents path traversal attacks (`../` sequences)
- Resolves symbolic links and validates them
- Rejects absolute paths outside app data
- Handles Windows UNC paths correctly
- Returns `SecurityViolation` error for invalid paths

### Downloaded Content

All downloaded content is stored in the vault directory:
- Location: `$APPDATA/Kiyya/vault/`
- Optional encryption: AES-GCM with OS keystore
- Atomic writes: Temporary files renamed on completion
- Automatic cleanup: Failed downloads are removed

### Implementation Details

See [FILESYSTEM_RESTRICTIONS_IMPLEMENTATION.md](FILESYSTEM_RESTRICTIONS_IMPLEMENTATION.md) for complete implementation details.

## Encryption

### Download Encryption

Users can optionally enable encryption for downloaded content:

**Algorithm:** AES-256-GCM
- Authenticated encryption with associated data (AEAD)
- 256-bit keys for strong security
- Unique nonce per file
- Authentication tag prevents tampering

**Key Management:**
- Keys stored in OS keystore (Windows Credential Manager, macOS Keychain, Linux Secret Service)
- Never stored in application code or database
- User-controlled passphrase for key derivation
- Export/import functionality for backup

**Warnings:**
- Users are warned about data loss if keys are lost
- No key recovery mechanism (by design)
- Encrypted files cannot be decrypted without the key

### On-the-Fly Decryption

The local HTTP server decrypts content during streaming:
- No decrypted files written to disk
- Decryption happens in memory
- Supports HTTP Range requests for seeking
- Concurrent connections supported

## Application Security

### No Embedded Secrets

The application does not embed any secrets:
- No API keys in code
- No authentication tokens
- No hardcoded credentials
- All configuration via environment variables

### Minimal Permissions

The application requests minimal system permissions:

**Allowed:**
- HTTP requests to approved domains
- File access to app data folder
- Window management (show, hide, minimize, maximize)
- Shell open (for external links only)
- Notifications

**Denied:**
- Shell execute (no arbitrary command execution)
- Global filesystem access
- Unrestricted network access
- System API access

### Update Security

Application updates are delivered securely:

1. **Manifest Verification**: Update manifest fetched over HTTPS
2. **Version Validation**: Semantic versioning enforced
3. **Manual Installation**: No automatic downloads or installations
4. **External Browser**: Update downloads open in user's browser
5. **Emergency Disable**: Remote kill switch for critical issues

## Data Privacy

### No Telemetry

The application does not collect or transmit:
- User behavior data
- Analytics events
- Crash reports (unless user explicitly generates debug package)
- Personal information
- Usage statistics

### Local-Only Data

All user data stays local:
- Favorites stored in local SQLite database
- Playback progress saved locally
- Cache stored on device
- No cloud synchronization

### Diagnostic Data

Debug packages (user-initiated only) contain:
- Application logs (no personal data)
- Database metadata (no content)
- Configuration settings
- System information (OS, version)

## Security Testing

### Automated Tests

Security is validated through automated tests:

```bash
# Run security configuration tests
npm test tests/unit/tauri-config.test.ts

# Validate Tauri configuration
npm run validate-tauri

# Run full security audit
npm run security:audit
```

### Test Coverage

Security tests verify:
- Network domain restrictions are enforced
- Filesystem access is limited to app data
- No wildcard permissions are granted
- CSP is properly configured
- All allowlists are explicitly defined
- HTTPS-only enforcement (except localhost)

### Manual Testing

Security should be manually tested:
1. Attempt to access blocked domains (should fail)
2. Attempt to access blocked filesystem paths (should fail)
3. Verify CSP blocks unauthorized resources
4. Test encryption/decryption round trip
5. Verify update manifest validation

## Security Requirements Mapping

This implementation satisfies the following requirements:

**Requirement 12.1:** Network access restricted to approved Odysee domains only
- ✅ Implemented via Tauri HTTP allowlist
- ✅ Enforced via Content Security Policy
- ✅ Validated by automated tests

**Requirement 12.2:** File system access limited to application data folder
- ✅ Implemented via Tauri FS allowlist
- ✅ Path validation in all file operations
- ✅ Validated by automated tests

**Requirement 12.3:** No API tokens or secrets embedded
- ✅ All configuration via environment variables
- ✅ No hardcoded credentials in code
- ✅ Secrets never committed to version control

**Requirement 12.4:** Secure key management for encryption
- ✅ OS keystore integration
- ✅ User-controlled passphrases
- ✅ Clear warnings about data loss

**Requirement 12.5:** No personal data collection
- ✅ No telemetry or analytics
- ✅ All data stored locally
- ✅ No cloud synchronization

**Requirement 12.6:** Clear warnings about encryption risks
- ✅ Warning displayed when enabling encryption
- ✅ Key export/import documentation
- ✅ Data loss risks explained

**Property 27:** Security Boundary Enforcement
- ✅ Network requests restricted to approved domains
- ✅ Filesystem operations restricted to app data
- ✅ Validated by property-based tests

## Vulnerability Reporting

If you discover a security vulnerability, please:

1. **Do not** open a public GitHub issue
2. Email security@kiyya.app with details
3. Include steps to reproduce
4. Allow reasonable time for fix before disclosure

## Security Updates

Security updates are released as needed:
- Critical vulnerabilities: Immediate patch release
- High severity: Within 7 days
- Medium severity: Next minor release
- Low severity: Next major release

Users are notified via:
- Update manifest (forced update for critical issues)
- Release notes
- Security advisory (if applicable)

## Compliance

The application follows security best practices:
- OWASP Top 10 mitigation
- Principle of least privilege
- Defense in depth
- Secure by default
- Privacy by design

## Additional Resources

- [Tauri Security Documentation](https://tauri.app/v1/guides/security/)
- [OWASP Secure Coding Practices](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/)
- [Content Security Policy Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

## Changelog

### Version 1.0.0
- Initial security implementation
- Network domain restrictions
- Filesystem access controls
- Optional encryption support
- Security testing suite
