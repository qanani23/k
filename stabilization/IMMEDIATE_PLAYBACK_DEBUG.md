# Immediate Playback Debug Steps

## Problem Summary
- ✅ Content loads from API
- ✅ Movies/series appear in UI
- ❌ Content disappears after showing
- ❌ Play button loads forever

## Critical Debug Command

**Run this in your browser console (F12) RIGHT NOW:**

```javascript
async function fullDebug() {
  console.log('=== FULL PLAYBACK DEBUG ===');
  
  try {
    // Step 1: Fetch content
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
    
    // Step 2: Inspect first item
    const item = items[0];
    console.log('\n2. First item details:');
    console.log('  - claim_id:', item.claim_id);
    console.log('  - title:', item.title);
    console.log('  - tags:', item.tags);
    console.log('  - video_urls:', item.video_urls);
    
    // Step 3: Check master URL
    console.log('\n3. Master URL check:');
    if (item.video_urls && item.video_urls.master) {
      const masterUrl = item.video_urls.master.url;
      console.log('  - URL:', masterUrl);
      console.log('  - Type:', item.video_urls.master.url_type);
      
      // Step 4: Test URL accessibility
      console.log('\n4. Testing URL accessibility...');
      try {
        const response = await fetch(masterUrl, { 
          method: 'HEAD',
          mode: 'no-cors' // Try without CORS first
        });
        console.log('  ✅ URL accessible (no-cors mode)');
      } catch (error) {
        console.log('  ❌ URL error:', error.message);
        
        // Try with CORS
        try {
          const response2 = await fetch(masterUrl, { method: 'HEAD' });
          console.log('  ✅ URL accessible (with CORS)');
          console.log('  - Status:', response2.status);
          console.log('  - Headers:', [...response2.headers.entries()]);
        } catch (error2) {
          console.log('  ❌ CORS error:', error2.message);
        }
      }
      
      // Step 5: Try to fetch the actual content
      console.log('\n5. Fetching playlist content...');
      try {
        const response = await fetch(masterUrl);
        const text = await response.text();
        console.log('  ✅ Playlist fetched');
        console.log('  - Status:', response.status);
        console.log('  - Content preview:', text.substring(0, 200));
        
        if (text.startsWith('#EXTM3U')) {
          console.log('  ✅ Valid HLS playlist!');
        } else {
          console.log('  ❌ Not a valid HLS playlist');
        }
      } catch (error) {
        console.log('  ❌ Fetch error:', error.message);
      }
    } else {
      console.error('  ❌ No master URL found!');
      console.log('  Available qualities:', Object.keys(item.video_urls || {}));
    }
    
    // Step 6: Check HLS support
    console.log('\n6. Browser capabilities:');
    console.log('  - HLS.js supported:', typeof Hls !== 'undefined' && Hls.isSupported());
    const video = document.createElement('video');
    console.log('  - Native HLS:', video.canPlayType('application/vnd.apple.mpegurl'));
    console.log('  - MP4:', video.canPlayType('video/mp4'));
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
    console.error('Stack:', error.stack);
  }
  
  console.log('\n=== END DEBUG ===');
}

fullDebug();
```

## What This Will Tell Us

1. **If items are being fetched** - confirms backend is working
2. **The exact CDN URL being used** - we can test it manually
3. **If the URL is accessible** - network/CORS issues
4. **If it's a valid HLS playlist** - format issues
5. **Browser HLS support** - compatibility issues

## Expected Outputs

### Good Output (Working):
```
✅ Received 1 items
✅ URL accessible
✅ Playlist fetched
✅ Valid HLS playlist!
✅ HLS.js supported: true
```

### Bad Output (CDN URL Wrong):
```
✅ Received 1 items
❌ URL error: Failed to fetch
❌ Fetch error: 404 Not Found
```

### Bad Output (CORS Issue):
```
✅ Received 1 items
❌ CORS error: blocked by CORS policy
```

## Next Steps Based on Output

### If URL returns 404:
The CDN URL format is wrong. We need to:
1. Check if Odysee changed their CDN structure
2. Look for direct URLs in the API response
3. Use a different URL construction method

### If CORS error:
Browser is blocking the request. We need to:
1. Fetch the video through Tauri backend instead
2. Add a proxy endpoint in Rust

### If "Not a valid HLS playlist":
The URL points to something else. We need to:
1. Check what the URL actually returns
2. Adjust the URL construction logic

## Share Your Results

After running the debug command, copy and paste the ENTIRE console output here. This will tell us exactly what's wrong and how to fix it.
