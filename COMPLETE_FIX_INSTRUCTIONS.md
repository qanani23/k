# Complete Fix Instructions - Step by Step

## Current Status

✅ Backend compiles successfully (only warnings, no errors)  
✅ Code changes applied correctly  
✅ Desktop app opens  
❌ Backend commands are failing with errors  

## The Problem

The backend `fetch_channel_claims` command is returning errors. Based on the investigation:

1. Your videos have NO direct video URLs (only `sd_hash`)
2. The backend should generate CDN URLs as fallback
3. The backend is compiling but failing at runtime

## Most Likely Cause

The backend might be failing because of an issue with the Odysee API gateway or network connectivity.

## Complete Fix Steps

### Step 1: Check Backend Logs

In the PowerShell terminal where `npm run tauri:dev` is running, look for error messages. Share any lines that contain:
- `Error:`
- `[ERROR]`
- `panicked at`
- `Failed to`

### Step 2: Test Direct API Access

Open `test-specific-video.html` in your browser and click "Test Hero Video". This tests if the Odysee API is accessible from your network.

If it works in the browser but not in the app, there might be a network/firewall issue with the Tauri app.

### Step 3: Temporary Workaround - Use Mock Data

Since we know your videos exist but the backend is failing, let's add temporary mock data to get the app working while we debug the backend issue.

Add this to `src/hooks/useContent.ts` at line 427 (right after the `useHeroContent` function starts):

```typescript
export function useHeroContent(options?: Partial<UseContentOptions>) {
  // TEMPORARY: Mock hero content for testing
  if (import.meta.env.DEV) {
    return {
      content: [{
        claim_id: '9ea0a63f48125cf9ea9296886907423963276898',
        title: 'Tsehay_Ethiopian_Movie_trailer',
        description: 'Hero trailer',
        tags: ['hero_trailer', 'movie'],
        thumbnail_url: 'https://thumbnails.odycdn.com/optimize/s:390:220/quality:85/plain/https://thumbs.odycdn.com/9ea0a63f48125cf9ea9296886907423963276898',
        duration: 120,
        release_time: Date.now() / 1000,
        video_urls: {
          '720p': {
            url: 'https://player.odycdn.com/api/v4/streams/free/Tsehay_Ethiopian_Movie_trailer/9ea0a63f48125cf9ea9296886907423963276898',
            quality: '720p',
            type: 'mp4'
          }
        },
        compatibility: { compatible: true, fallback_available: false }
      }],
      loading: false,
      error: null,
      refetch: () => Promise.resolve(),
      loadMore: () => Promise.resolve(),
      hasMore: false,
      fromCache: false,
      status: 'success' as const
    };
  }
  
  // Original code continues...
  const result = useContent({ tags: ['hero_trailer'], limit: 20, ...options });
```

This will make the hero show up immediately while we fix the backend issue.

### Step 4: Check Network/Firewall

The Tauri app might be blocked by:
- Windows Firewall
- Antivirus software
- Corporate firewall
- VPN

Try:
1. Temporarily disable Windows Firewall
2. Check if antivirus is blocking the app
3. Try without VPN if you're using one

### Step 5: Check Tauri Permissions

The app might not have permission to make network requests. Check `src-tauri/tauri.conf.json`:

Look for the `allowlist` section and ensure it has:
```json
"http": {
  "all": true,
  "request": true,
  "scope": ["https://**"]
}
```

## What I Need From You

To help you further, I need to see the **PowerShell terminal output**. Specifically:

1. Stop the current dev server (Ctrl+C)
2. Run: `npm run tauri:dev`
3. Wait for it to fail
4. Copy ALL the output from the terminal
5. Share it with me

Look for lines that contain actual error messages, not just warnings.

## Quick Test

Try this in the PowerShell terminal:

```powershell
curl https://api.na-backend.odysee.com/api/v1/proxy
```

If this fails, your network can't reach the Odysee API, which would explain why the app isn't working.

## Summary

The code is correct, but something is preventing the backend from successfully calling the Odysee API. We need to see the actual error message from the Rust backend to identify if it's:
- Network/firewall issue
- API gateway issue
- Permission issue
- Something else

Share the PowerShell terminal output and we'll fix it quickly!
