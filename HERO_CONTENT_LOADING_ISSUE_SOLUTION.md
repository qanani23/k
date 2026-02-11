# Hero Content Loading Issue - Root Cause & Solution

## Problem Summary

The hero content is not loading in the application, causing E2E tests to fail. The hero section remains empty even though:
- ✅ The application starts successfully (no crash)
- ✅ The channel ID is configured in `.env` as `@kiyyamovies:b`
- ✅ Hero content with `hero_trailer` tag exists on the Odysee channel
- ✅ The Hero component is properly implemented and rendered

## Root Cause

**The Rust backend cannot read the `CHANNEL_ID` environment variable at runtime.**

### Why This Happens:

1. **Environment Variables in Tauri**: 
   - `.env` files are processed by Vite during the build process
   - `VITE_` prefixed variables are embedded into the frontend JavaScript bundle
   - Non-`VITE_` prefixed variables are NOT automatically available to the Rust backend at runtime

2. **Current Implementation**:
   ```rust
   // src-tauri/src/commands.rs line 83
   let channel_id = std::env::var("CHANNEL_ID")
       .unwrap_or_else(|_| "@YourChannelName".to_string());
   ```
   
   This code tries to read `CHANNEL_ID` from the environment, but it's not available at runtime, so it falls back to `"@YourChannelName"`, which doesn't exist.

3. **Result**: 
   - API calls are made to Odysee with channel `"@YourChannelName"`
   - No content is returned
   - Hero section remains empty

## Solutions

### Solution 1: Set Environment Variable at Runtime (Recommended for Development)

Set the `CHANNEL_ID` environment variable before running the app:

**Windows (PowerShell)**:
```powershell
$env:CHANNEL_ID="@kiyyamovies:b"
npm run tauri:dev
```

**Windows (CMD)**:
```cmd
set CHANNEL_ID=@kiyyamovies:b
npm run tauri:dev
```

**Linux/Mac**:
```bash
export CHANNEL_ID="@kiyyamovies:b"
npm run tauri:dev
```

### Solution 2: Pass Channel ID from Frontend (Recommended for Production)

Modify the Tauri commands to accept channel ID as a parameter from the frontend:

**Step 1**: Update Rust command signature:
```rust
#[command]
pub async fn fetch_channel_claims(
    channel_id: String,  // Add this parameter
    any_tags: Option<Vec<String>>,
    text: Option<String>,
    limit: Option<u32>,
    page: Option<u32>,
    force_refresh: Option<bool>,
    state: State<'_, AppState>,
) -> Result<Vec<ContentItem>> {
    // Use the passed channel_id instead of reading from env
    let request = OdyseeRequest {
        method: "claim_search".to_string(),
        params: json!({
            "channel": channel_id,  // Use parameter
            // ...
        }),
    };
    // ...
}
```

**Step 2**: Update frontend API calls:
```typescript
// src/lib/api.ts
const CHANNEL_ID = import.meta.env.VITE_CHANNEL_ID;

export const fetchChannelClaims = async (params: {
  any_tags?: string[];
  text?: string;
  limit?: number;
  page?: number;
  force_refresh?: boolean;
}): Promise<ContentItem[]> => {
  return await invoke('fetch_channel_claims', {
    channel_id: CHANNEL_ID,  // Pass from frontend
    ...params
  });
};
```

### Solution 3: Configure in tauri.conf.json

Add channel ID to Tauri configuration:

```json
{
  "tauri": {
    "bundle": {
      "identifier": "com.kiyya.desktop",
      "resources": [],
      "externalBin": [],
      "copyright": "",
      "category": "Entertainment"
    },
    "systemTray": {
      "iconPath": "icons/icon.png"
    },
    "windows": [
      {
        "title": "Kiyya",
        "width": 1200,
        "height": 800
      }
    ],
    // Add custom configuration
    "config": {
      "channelId": "@kiyyamovies:b"
    }
  }
}
```

Then read it in Rust:
```rust
use tauri::Manager;

let config = app.config();
let channel_id = config
    .tauri
    .config
    .get("channelId")
    .and_then(|v| v.as_str())
    .unwrap_or("@YourChannelName");
```

### Solution 4: Use Build-Time Environment Variables

Configure Tauri to embed environment variables at build time:

**tauri.conf.json**:
```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:1420",
    "distDir": "../dist",
    "withGlobalTauri": false
  }
}
```

**Cargo.toml** (add build script):
```toml
[package]
name = "kiyya-desktop"
version = "1.0.0"
build = "build.rs"
```

**build.rs**:
```rust
fn main() {
    // Read from .env and set as compile-time env var
    if let Ok(channel_id) = std::env::var("CHANNEL_ID") {
        println!("cargo:rustc-env=CHANNEL_ID={}", channel_id);
    }
}
```

Then use in code:
```rust
const CHANNEL_ID: &str = env!("CHANNEL_ID");
```

## Recommended Approach

**For this project, use Solution 2 (Pass from Frontend)** because:

1. ✅ **Separation of Concerns**: Frontend configuration stays in frontend
2. ✅ **Type Safety**: Channel ID is validated at the API boundary
3. ✅ **Flexibility**: Easy to change channel ID without recompiling Rust
4. ✅ **Testing**: Easy to mock different channel IDs in tests
5. ✅ **No Runtime Dependencies**: Doesn't rely on environment variables being set

## Implementation Steps

### 1. Update Rust Commands

```rust
// src-tauri/src/commands.rs

#[command]
pub async fn fetch_channel_claims(
    channel_id: String,
    any_tags: Option<Vec<String>>,
    text: Option<String>,
    limit: Option<u32>,
    page: Option<u32>,
    force_refresh: Option<bool>,
    state: State<'_, AppState>,
) -> Result<Vec<ContentItem>> {
    info!("Fetching channel claims for channel: {}", channel_id);
    
    // Validate channel ID format
    if !channel_id.starts_with('@') {
        return Err(KiyyaError::ValidationError(
            "Channel ID must start with @".to_string()
        ));
    }
    
    // ... rest of implementation using channel_id parameter
}

#[command]
pub async fn fetch_playlists(
    channel_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Playlist>> {
    info!("Fetching playlists for channel: {}", channel_id);
    
    // ... rest of implementation using channel_id parameter
}
```

### 2. Update Frontend API

```typescript
// src/lib/api.ts

const CHANNEL_ID = import.meta.env.VITE_CHANNEL_ID || '@kiyyamovies:b';

export const fetchChannelClaims = async (params: {
  any_tags?: string[];
  text?: string;
  limit?: number;
  page?: number;
  force_refresh?: boolean;
}): Promise<ContentItem[]> => {
  return await invoke('fetch_channel_claims', {
    channel_id: CHANNEL_ID,
    ...params
  });
};

export const fetchPlaylists = async (): Promise<Playlist[]> => {
  return await invoke('fetch_playlists', {
    channel_id: CHANNEL_ID
  });
};
```

### 3. Update Tests

For E2E tests, you can now easily mock the channel ID:

```typescript
// tests/e2e/app.spec.ts

test.beforeEach(async ({ page }) => {
  // Mock the channel ID in the frontend
  await page.addInitScript(() => {
    window.VITE_CHANNEL_ID = '@test-channel:1';
  });
  
  await page.goto('/');
});
```

## Verification

After implementing the solution:

1. **Check Rust logs**: Look for "Fetching channel claims for channel: @kiyyamovies:b"
2. **Check API calls**: Verify requests are being made to Odysee with correct channel
3. **Check hero content**: Hero section should load with content
4. **Run E2E tests**: Hero tests should pass

## Current Status

- ❌ Hero content not loading (channel ID not reaching Rust backend)
- ✅ Application starts successfully
- ✅ Tests implemented and ready
- ⏳ Waiting for channel ID fix to be applied

## Next Steps

1. Implement Solution 2 (recommended)
2. Rebuild and restart the application
3. Verify hero content loads
4. Re-run E2E tests
5. All tests should pass ✅


long term soultion :
Summary
Root Cause: The Rust backend is trying to read CHANNEL_ID from environment variables, but it's not available at runtime, so it defaults to "@YourChannelName" which doesn't exist on Odysee.

Quick Fix for Testing: Run the app with the environment variable set:

$env:CHANNEL_ID="@kiyyamovies:b"; npm run tauri:dev
Recommended Long-term Solution: Pass the channel ID from the frontend to the Rust backend as a parameter in the Tauri commands. This is cleaner, more flexible, and easier to test.

The E2E tests are fully implemented and ready - they just need the hero content to load, which will happen once the channel ID issue is fixed. Would you like me to implement the recommended solution (passing channel ID from frontend to backend)?