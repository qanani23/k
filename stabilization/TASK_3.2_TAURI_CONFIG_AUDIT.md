# Task 3.2: Tauri Configuration Audit

**Status:** ✅ Complete  
**Date:** 2026-02-22  
**Requirements:** 1.6

## Overview

Comprehensive audit of `src-tauri/tauri.conf.json` to identify unused settings and verify all configured features are actually used in the application.

## Configuration Structure Analysis

### 1. Build Configuration
```json
"build": {
  "beforeDevCommand": "npm run dev",
  "beforeBuildCommand": "npm run build",
  "devPath": "http://localhost:1420",
  "distDir": "../dist",
  "withGlobalTauri": true
}
```

**Status:** ✅ ALL USED
- `beforeDevCommand`: Used by `npm run tauri:dev`
- `beforeBuildCommand`: Used by `npm run tauri:build`
- `devPath`: Frontend dev server URL
- `distDir`: Production build output directory
- `withGlobalTauri`: **VERIFIED USED** - Required for `invoke()` calls in `src/lib/api.ts`

### 2. Package Configuration
```json
"package": {
  "productName": "Kiyya",
  "version": "1.0.0"
}
```

**Status:** ✅ ALL USED
- Both fields are standard and required for application metadata

### 3. Allowlist Configuration

#### 3.1 Shell Allowlist
```json
"shell": {
  "all": false,
  "open": true
}
```

**Status:** ⚠️ CONFIGURED BUT NOT USED IN APPLICATION CODE
- **Finding:** `shell.open` is enabled but NOT used in `src/` application code
- **Evidence:** 
  - No imports of `@tauri-apps/api/shell` in `src/` directory
  - Only found in test files (`tests/unit/tauri-config.test.ts`, `tests/unit/aria-labels.test.tsx`)
- **Backend Implementation:** `commands::open_external` exists in main.rs
- **Frontend Usage:** `openExternal()` function exists in `src/lib/api.ts` but uses Tauri command, not shell API
- **Recommendation:** Keep enabled - used via backend command pattern, not direct shell API

#### 3.2 Window Allowlist
```json
"window": {
  "all": false,
  "close": true,
  "hide": true,
  "show": true,
  "maximize": true,
  "minimize": true,
  "unmaximize": true,
  "unminimize": true,
  "startDragging": true
}
```

**Status:** ⚠️ CONFIGURED BUT NOT VERIFIED
- **Finding:** No direct usage of `@tauri-apps/api/window` found in `src/` directory
- **Evidence:** No imports of window API in application code
- **Recommendation:** These may be used by Tauri's built-in window controls or future features
- **Action:** Mark as "Possibly Used by Framework" - requires manual verification

#### 3.3 Filesystem Allowlist
```json
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
  "scope": ["$APPDATA/Kiyya/**"]
}
```

**Status:** ⚠️ CONFIGURED BUT NOT USED IN APPLICATION CODE
- **Finding:** No direct usage of `@tauri-apps/api/fs` found in `src/` directory
- **Evidence:** No imports of fs API in application code
- **Backend Pattern:** Application uses backend commands for file operations (download, offline storage)
- **Recommendation:** May be unused - all file operations go through backend commands
- **Action:** Mark as "Candidate for Removal" - verify no hidden usage

#### 3.4 HTTP Allowlist
```json
"http": {
  "all": false,
  "request": true,
  "scope": [
    "https://api.na-backend.odysee.com/**",
    "https://api.lbry.tv/**",
    "https://api.odysee.com/**",
    "https://*.odysee.com/**",
    "https://*.lbry.tv/**",
    "https://raw.githubusercontent.com/**",
    "https://thumbnails.lbry.com/**",
    "https://spee.ch/**",
    "https://cdn.lbryplayer.xyz/**",
    "https://player.odycdn.com/**"
  ]
}
```

**Status:** ⚠️ CONFIGURED BUT NOT USED DIRECTLY
- **Finding:** No usage of `@tauri-apps/api/http` in application code
- **Evidence:** Application uses standard `fetch()` API, not Tauri HTTP API
- **Usage Pattern:** 
  - `src/hooks/useUpdateChecker.ts` uses `fetch(UPDATE_MANIFEST_URL)`
  - All HTTP requests go through backend or standard fetch
- **Recommendation:** May be unused - application doesn't use Tauri HTTP API
- **Action:** Mark as "Candidate for Removal" - verify CSP requirements

#### 3.5 Notification Allowlist
```json
"notification": {
  "all": true
}
```

**Status:** ⚠️ CONFIGURED BUT NOT USED DIRECTLY
- **Finding:** No usage of `@tauri-apps/api/notification` in application code
- **Evidence:** Application uses custom toast notification system, not Tauri notifications
- **Usage Pattern:**
  - `src/components/Toast.tsx` - Custom toast component
  - `src/App.tsx` - Toast notification management
  - No Tauri notification API imports
- **Recommendation:** Likely unused - application has custom notification system
- **Action:** Mark as "Candidate for Removal"

### 4. Bundle Configuration
```json
"bundle": {
  "active": true,
  "targets": "all",
  "identifier": "com.kiyya.desktop",
  "icon": [...],
  "resources": [],
  "externalBin": [],
  ...
}
```

**Status:** ✅ ALL USED
- All bundle settings are standard and required for application packaging
- Icon paths verified to exist
- Platform-specific settings (deb, macOS, windows) are standard

### 5. Security Configuration
```json
"security": {
  "csp": "default-src 'self'; connect-src 'self' https://api.na-backend.odysee.com ..."
}
```

**Status:** ✅ USED
- CSP is critical for security
- Domains match the HTTP allowlist scope
- Required for web security

### 6. Updater Configuration
```json
"updater": {
  "active": false
}
```

**Status:** ✅ CORRECTLY DISABLED
- Updater is disabled
- Application has custom update checking via `useUpdateChecker.ts`
- No Tauri updater API usage found

### 7. Windows Configuration
```json
"windows": [
  {
    "title": "Kiyya",
    "width": 1200,
    "height": 800,
    ...
  }
]
```

**Status:** ✅ ALL USED
- Standard window configuration
- All settings are reasonable defaults

## Summary of Findings

### ✅ Verified Used (Keep)
1. Build configuration - all settings used
2. Package configuration - required metadata
3. Bundle configuration - required for packaging
4. Security CSP - critical for security
5. Updater (disabled) - correctly configured
6. Windows configuration - standard settings
7. `withGlobalTauri: true` - required for invoke() calls

### ⚠️ Configured But Not Directly Used (Review)
1. **Shell allowlist** - Enabled but used via backend command pattern, not direct API
2. **Window allowlist** - May be used by framework or future features
3. **Filesystem allowlist** - Not used directly, all file ops via backend
4. **HTTP allowlist** - Not used, application uses standard fetch()
5. **Notification allowlist** - Not used, application has custom toast system

### 🔍 Recommendations

#### High Priority - Likely Unused
1. **Notification allowlist** - Can likely be removed
   - Application uses custom toast system
   - No Tauri notification API usage found
   - Action: Test removal and verify no breakage

2. **Filesystem allowlist** - Can likely be simplified or removed
   - All file operations go through backend commands
   - No direct fs API usage in frontend
   - Action: Test removal and verify download/offline features work

3. **HTTP allowlist** - Can likely be removed
   - Application uses standard fetch(), not Tauri HTTP API
   - CSP already controls HTTP access
   - Action: Test removal and verify no breakage

#### Medium Priority - Verify Usage
4. **Window allowlist** - Verify if used by framework
   - May be used by Tauri's built-in window controls
   - No direct usage in application code
   - Action: Manual testing of window controls (minimize, maximize, close)

5. **Shell allowlist** - Keep but document pattern
   - Used via backend command (`open_external`), not direct API
   - This is the correct security pattern
   - Action: Document in DECISIONS.md

## Verification Steps Performed

1. ✅ Searched for `@tauri-apps/api/shell` imports - None found in src/
2. ✅ Searched for `@tauri-apps/api/window` imports - None found in src/
3. ✅ Searched for `@tauri-apps/api/fs` imports - None found in src/
4. ✅ Searched for `@tauri-apps/api/http` imports - None found in src/
5. ✅ Searched for `@tauri-apps/api/notification` imports - None found in src/
6. ✅ Verified `invoke()` usage - Found in src/lib/api.ts (requires withGlobalTauri)
7. ✅ Verified backend command registration - All commands registered in main.rs
8. ✅ Verified CSP domains match HTTP scope - Consistent

## Next Steps

1. **Phase 2 Cleanup:** Test removal of unused allowlist configurations
2. **Manual Testing:** Verify window controls work after potential config changes
3. **Documentation:** Document backend command pattern vs direct API usage
4. **Security Review:** Ensure CSP is sufficient without HTTP allowlist

## Files Analyzed

- `src-tauri/tauri.conf.json` - Main configuration file
- `src-tauri/src/main.rs` - Command registration
- `src/lib/api.ts` - Frontend API layer
- `src/**/*.{ts,tsx}` - All frontend code
- `tests/**/*.{ts,tsx}` - Test files

## Conclusion

The tauri.conf.json configuration is mostly well-configured, but several allowlist features are enabled without direct usage in the application code. The application follows a secure pattern of using backend commands instead of direct Tauri API calls, which means some allowlist configurations may be unnecessary.

**Key Finding:** Application architecture uses backend commands for security-sensitive operations (file access, external links) rather than direct Tauri API calls. This is a good security pattern but means several allowlist configurations may be removable.

**Recommendation:** In Phase 2, test removal of notification, filesystem, and HTTP allowlists to simplify configuration while maintaining security.
