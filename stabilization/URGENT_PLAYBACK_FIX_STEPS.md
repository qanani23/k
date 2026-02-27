# Urgent Playback Fix Steps

## Current Situation
- ✅ Backend API working (content loads)
- ✅ Frontend receives content
- ❌ Content disappears after showing
- ❌ Video player loads forever when clicking play

## Root Cause Analysis

Based on the previous debugging, the issue is:
1. **HTTP 404 from Odysee API** - The `/api/v1/proxy` endpoint returns 404
2. **CDN URL might be wrong** - The constructed URL `https://cloud.odysee.live/content/{claim_id}/master.m3u8` might not be the correct format

## STEP 1: Run Debug Command (CRITICAL)

Open your app, press F12, and run this in the console:

```javascript
async function fullDebug() {
  console.log('=== FULL PLAYBACK DEBUG ===');
  
  try {
    // Fetch content
    console.log('\n1. Fetching content...');
    const items = await window.__TAURI__.invoke('fetch_channel_claims', { 
      channelId: '@kiyyamovies:b',
      anyTags: ['movie'],
      limit: 1
    });
    
    console.log('✅ Received', items.length, 'items');
    
    if (items.length === 0) {
      console.error('❌ No items returned!');
      return;
    }
    
    // Inspect first item
    const item = items[0];
    console.log('\n2. First item details:');
    console.log('  - claim_id:', item.claim_id);
    console.log('  - title:', item.title);
    console.log('  - video_urls:', item.video_urls);
    
    // Check master URL
    console.log('\n3. Master URL check:');
    if (item.video_urls && item.video_urls.master) {
      const masterUrl = item.video_urls.master.url;
      console.log('  - URL:', masterUrl);
      
      // Test URL accessibility
      console.log('\n4. Testing URL...');
      try {
        const response = await fetch(masterUrl);
        const text = await response.text();
        console.log('  ✅ URL accessible');
        console.log('  - Status:', response.status);
        console.log('  - Content preview:', text.substring(0, 200));
        
        if (text.startsWith('#EXTM3U')) {
          console.log('  ✅ Valid HLS playlist!');
        } else {
          console.log('  ❌ Not a valid HLS playlist');
          console.log('  Full response:', text);
        }
      } catch (error) {
        console.log('  ❌ URL error:', error.message);
      }
    } else {
      console.error('  ❌ No master URL found!');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
  
  console.log('\n=== END DEBUG ===');
}

fullDebug();
```

**COPY AND PASTE THE ENTIRE OUTPUT HERE**

## STEP 2: Check What's Actually Happening

Based on the debug output, we'll know:

### Scenario A: URL returns 404
```
❌ URL error: 404 Not Found
```
**Fix**: The CDN URL format is wrong. We need to find the correct Odysee CDN URL pattern.

### Scenario B: URL returns HTML/JSON instead of HLS
```
❌ Not a valid HLS playlist
Full response: <!DOCTYPE html>...
```
**Fix**: The URL points to a web page, not a video stream. Need different URL construction.

### Scenario C: CORS error
```
❌ URL error: blocked by CORS policy
```
**Fix**: Need to proxy the request through Tauri backend.

### Scenario D: URL works but player doesn't load
```
✅ Valid HLS playlist!
```
**Fix**: Issue is in the player component, not the URL.

## STEP 3: Check Network Tab

1. Open DevTools → Network tab
2. Click play on a video
3. Look for requests to `cloud.odysee.live`
4. Check the status code and response

## STEP 4: Possible Quick Fixes

### Fix A: Check if Odysee API returns direct URLs

The API response might already contain video URLs that we should use instead of constructing CDN URLs.

Run this to check:
```javascript
window.__TAURI__.invoke('fetch_channel_claims', { 
  channelId: '@kiyyamovies:b',
  anyTags: ['movie'],
  limit: 1
}).then(r => {
  console.log('Raw item:', JSON.stringify(r[0], null, 2));
})
```

Look for fields like:
- `value.stream.url`
- `value.source.url`
- `streaming_url`
- Any field containing a URL

### Fix B: Try Different CDN URL Format

Odysee might use a different URL pattern. Common patterns:
```
https://player.odycdn.com/api/v4/streams/free/{claim_name}/{claim_id}/master.m3u8
https://cdn.lbryplayer.xyz/api/v4/streams/free/{claim_name}/{claim_id}/master.m3u8
https://cloud.odysee.live/api/v4/streams/free/{claim_name}/{claim_id}/master.m3u8
```

### Fix C: Use Odysee Embed URL

Odysee provides embed URLs that might work:
```
https://odysee.com/$/embed/{claim_name}/{claim_id}
```

## STEP 5: Content Disappearing Issue

This might be caused by:
1. React re-rendering and clearing state
2. Memory manager evicting content
3. Cache expiration

To debug, add this to your console:
```javascript
// Monitor content state changes
let lastContentCount = 0;
setInterval(() => {
  const movieElements = document.querySelectorAll('[data-content-item]');
  if (movieElements.length !== lastContentCount) {
    console.log('Content count changed:', lastContentCount, '→', movieElements.length);
    lastContentCount = movieElements.length;
  }
}, 1000);
```

## What I Need From You

1. **Run the fullDebug() command** and share the complete output
2. **Check the Network tab** when clicking play and share what you see
3. **Tell me if content disappears immediately** or after a specific time
4. **Share any error messages** from the console (red text)

Once I have this information, I can provide the exact fix needed.

## Quick Test: Does Odysee.com Work?

1. Go to https://odysee.com/@kiyyamovies:b
2. Open DevTools → Network tab
3. Play a video
4. Look for `.m3u8` requests
5. Copy the URL of the master.m3u8 file
6. Share it here

This will show us the actual CDN URL format Odysee uses.
