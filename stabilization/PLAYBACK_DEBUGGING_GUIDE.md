# Playback Debugging Guide

## Current Status
- ✅ Content loads from Odysee API
- ✅ Movies and series appear in UI
- ❌ Content disappears after a while
- ❌ Play button loads forever, video doesn't play

## Diagnostic Steps

### Step 1: Check Browser Console (F12)

Open DevTools and look for these specific traces:

```
[TRACE] Stage 4: Constructed CDN playback URL
[TRACE] Stage 6: Frontend received content items
[TRACE] Stage 7: Player mounting with content
[TRACE] Stage 7: Video URL selected
```

### Step 2: Check the Constructed CDN URL

The backend constructs URLs in this format:
```
https://cloud.odysee.live/content/{claim_id}/master.m3u8
```

Example:
```
https://cloud.odysee.live/content/abc123def456/master.m3u8
```

### Step 3: Test CDN URL Directly

1. Copy the `constructed_url` from Stage 4 trace
2. Open it in a new browser tab
3. Check if you get:
   - ✅ HLS playlist file (text starting with `#EXTM3U`)
   - ❌ 404 Not Found
   - ❌ 403 Forbidden
   - ❌ CORS error

### Step 4: Check for Common Issues

#### Issue A: Content Disappears
**Symptom**: Movies show briefly then disappear

**Possible Causes**:
1. Frontend validation filtering out items
2. Cache expiration
3. React re-render clearing state

**Debug**:
```javascript
// In browser console
window.__TAURI__.invoke('fetch_channel_claims', { 
  channelId: '@kiyyamovies:b',
  anyTags: ['movie']
}).then(r => {
  console.log('Got', r.length, 'items');
  console.log('First item:', r[0]);
  console.log('Video URLs:', r[0].video_urls);
})
```

#### Issue B: Infinite Loading on Play
**Symptom**: Play button shows loading spinner forever

**Possible Causes**:
1. CDN URL returns 404 (claim_id not found on CDN)
2. CDN URL returns 403 (authentication required)
3. CORS blocking the request
4. HLS.js cannot parse the stream
5. Network timeout

**Debug**:
```javascript
// Check if HLS is supported
console.log('HLS supported:', Hls.isSupported());

// Check native HLS support (Safari)
const video = document.createElement('video');
console.log('Native HLS:', video.canPlayType('application/vnd.apple.mpegurl'));
```

### Step 5: Check Network Tab

1. Open DevTools → Network tab
2. Click play on a video
3. Look for requests to `cloud.odysee.live`
4. Check the status code:
   - 200 OK = CDN working
   - 404 Not Found = claim_id not on CDN
   - 403 Forbidden = authentication issue
   - CORS error = need to handle differently

### Step 6: Verify Claim Structure

The backend expects claims with:
- `claim_id`: Valid Odysee claim identifier
- `value_type`: Must be "stream"
- `value.source.sd_hash`: Must exist

Check if your claims have these fields:
```javascript
window.__TAURI__.invoke('fetch_channel_claims', { 
  channelId: '@kiyyamovies:b',
  anyTags: ['movie'],
  limit: 1
}).then(r => {
  console.log('Claim structure:', JSON.stringify(r[0], null, 2));
})
```

## Known Issues

### Issue: Odysee CDN URL Format Changed

The current implementation assumes:
```
https://cloud.odysee.live/content/{claim_id}/master.m3u8
```

But Odysee might use a different URL pattern. Check Odysee's official documentation or inspect working videos on odysee.com to see the actual CDN URL format.

### Issue: Direct URLs vs CDN URLs

Odysee API might return direct video URLs in the response that should be used instead of constructing CDN URLs. Check the raw API response for fields like:
- `value.stream.url`
- `value.source.url`
- `streaming_url`

## Next Steps Based on Findings

### If CDN URLs return 404:
The claim_id might not be available on the CDN, or the URL format is wrong. Need to:
1. Check actual Odysee CDN URL format
2. Consider using direct URLs from API response instead

### If CDN URLs return 403:
Authentication might be required. Need to:
1. Check if Odysee requires API keys for CDN access
2. Add authentication headers

### If CORS errors:
Browser is blocking cross-origin requests. Need to:
1. Use Tauri's HTTP client instead of browser fetch
2. Proxy requests through backend

### If HLS.js errors:
The stream format might not be compatible. Need to:
1. Check the actual stream format
2. Try different quality levels
3. Use native video player instead of HLS.js

## Collecting Debug Information

Run this in browser console and share the output:

```javascript
// Test full pipeline
async function debugPlayback() {
  console.log('=== PLAYBACK DEBUG ===');
  
  // Fetch content
  const items = await window.__TAURI__.invoke('fetch_channel_claims', { 
    channelId: '@kiyyamovies:b',
    anyTags: ['movie'],
    limit: 1
  });
  
  console.log('1. Items received:', items.length);
  console.log('2. First item:', items[0]);
  console.log('3. Video URLs:', items[0].video_urls);
  console.log('4. Master URL:', items[0].video_urls.master?.url);
  
  // Test URL accessibility
  const masterUrl = items[0].video_urls.master?.url;
  if (masterUrl) {
    console.log('5. Testing URL:', masterUrl);
    try {
      const response = await fetch(masterUrl, { method: 'HEAD' });
      console.log('6. URL Status:', response.status, response.statusText);
    } catch (error) {
      console.log('6. URL Error:', error.message);
    }
  }
  
  console.log('=== END DEBUG ===');
}

debugPlayback();
```
