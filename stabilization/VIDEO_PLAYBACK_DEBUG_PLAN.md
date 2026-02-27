# Video Playback Debug Plan

## Current Status

### What We Know
1. ✅ URL construction is correct: `https://player.odycdn.com/api/v3/streams/free/{claim_name}/{claim_id}/{first_6_of_sd_hash}.mp4`
2. ✅ URLs are accessible (tested with Node.js script - returns 200 OK, Content-Type: video/mp4)
3. ✅ Frontend has logging in place to show received video URLs
4. ✅ PlayerModal has logging to show which URL is being played
5. ❌ Videos not playing in the app

### Debug Output Analysis
The confusing debug output showing "SD_HASH DOES NOT MATCH" was misleading - it was comparing sd_hash to claim_id, which are different values. This is expected and not an error.

## Next Steps

### 1. Restart App with Full Recompilation
```bash
# Stop any running instances
# Then start fresh
npm run tauri:dev
```

### 2. Check Console Logs
Look for these specific log messages:

**Backend (Rust terminal):**
```
🎬 VIDEO URL CONSTRUCTION:
   Claim Name: man_ayebgn_Ethiopian_Movie
   Claim ID: faf0de58484f01c3da49ccf2d5466b28f69a91eb
   SD Hash: 03427c91a7eac2d0f2504f547ab96baf2cece057...
   File Stub (first 6 of sd_hash): 03427c
   Expected URL: https://player.odycdn.com/api/v3/streams/free/...
```

**Frontend (browser console):**
```
[TRACE] Stage 6: Frontend received content items
  - video_urls_detail: [{ quality: "master", url: "https://...", type: "mp4" }]

[TRACE] Stage 7: Video URL selected
  - selected_url: https://player.odycdn.com/api/v3/streams/free/...
  - is_hls: false
```

### 3. Verify URL Format
The URL should match exactly:
```
https://player.odycdn.com/api/v3/streams/free/man_ayebgn_Ethiopian_Movie/faf0de58484f01c3da49ccf2d5466b28f69a91eb/03427c.mp4
```

### 4. Check for Errors
Look for:
- CORS errors in browser console
- Network errors (403, 404, timeout)
- Video element errors
- Codec compatibility warnings

## Possible Issues

### Issue 1: Tauri WebView Security
Tauri might be blocking external video URLs. Check `tauri.conf.json` for CSP settings.

### Issue 2: Video Element Not Loading
The video element might not support direct MP4 streaming from external URLs in Tauri's webview.

### Issue 3: CORS Headers
Even though the URL is accessible via Node.js, the Tauri webview might have different CORS requirements.

### Issue 4: Codec Support
The webview might not support the video codec used by Odysee.

## Test Commands

### Test URL Accessibility
```bash
node scripts/test_video_url.js
```

### Test in Browser
Open browser console and run:
```javascript
const video = document.createElement('video');
video.src = 'https://player.odycdn.com/api/v3/streams/free/man_ayebgn_Ethiopian_Movie/faf0de58484f01c3da49ccf2d5466b28f69a91eb/03427c.mp4';
video.play();
```

## Resolution Path

1. Confirm URLs are being constructed correctly (check logs)
2. Confirm URLs are reaching the video element (check logs)
3. Check for webview-specific errors
4. If webview blocking, update Tauri security settings
5. If codec issue, consider transcoding or alternative player
