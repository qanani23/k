# Video Playback Test

## Now that hero timeout is fixed, let's test video playback

Run this command in your browser console (F12) to test if the video URLs work:

```javascript
async function testVideoPlayback() {
  console.log('=== VIDEO PLAYBACK TEST ===\n');
  
  try {
    // Step 1: Fetch a movie
    console.log('1. Fetching movies...');
    const items = await window.__TAURI__.invoke('fetch_channel_claims', { 
      channelId: '@kiyyamovies:b',
      anyTags: ['movie'],
      limit: 1
    });
    
    if (items.length === 0) {
      console.error('❌ No movies found!');
      return;
    }
    
    const movie = items[0];
    console.log('✅ Got movie:', movie.title);
    console.log('   claim_id:', movie.claim_id);
    
    // Step 2: Check video URLs
    console.log('\n2. Checking video URLs...');
    console.log('   Available qualities:', Object.keys(movie.video_urls));
    
    if (!movie.video_urls.master) {
      console.error('❌ No master URL found!');
      return;
    }
    
    const masterUrl = movie.video_urls.master.url;
    console.log('   Master URL:', masterUrl);
    console.log('   URL type:', movie.video_urls.master.url_type);
    
    // Step 3: Test if URL is accessible
    console.log('\n3. Testing URL accessibility...');
    try {
      const response = await fetch(masterUrl);
      console.log('   Status:', response.status, response.statusText);
      
      if (response.ok) {
        const text = await response.text();
        console.log('   Response length:', text.length, 'bytes');
        console.log('   First 200 chars:', text.substring(0, 200));
        
        if (text.startsWith('#EXTM3U')) {
          console.log('   ✅ Valid HLS playlist!');
        } else if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
          console.log('   ❌ Got HTML page instead of video!');
          console.log('   This means the CDN URL format is wrong.');
        } else {
          console.log('   ❌ Unknown format');
        }
      } else {
        console.log('   ❌ HTTP error:', response.status);
      }
    } catch (fetchError) {
      console.log('   ❌ Fetch failed:', fetchError.message);
      
      // Check if it's a CORS error
      if (fetchError.message.includes('CORS') || fetchError.message.includes('cross-origin')) {
        console.log('   This is a CORS error - browser is blocking the request');
      }
    }
    
    // Step 4: Check HLS support
    console.log('\n4. Checking browser HLS support...');
    console.log('   HLS.js available:', typeof Hls !== 'undefined');
    console.log('   HLS.js supported:', typeof Hls !== 'undefined' && Hls.isSupported());
    
    const video = document.createElement('video');
    console.log('   Native HLS:', video.canPlayType('application/vnd.apple.mpegurl'));
    console.log('   MP4:', video.canPlayType('video/mp4'));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('   Stack:', error.stack);
  }
  
  console.log('\n=== END TEST ===');
}

testVideoPlayback();
```

## What to Look For

### Good Result (Video should work):
```
✅ Got movie: [title]
✅ Valid HLS playlist!
✅ HLS.js supported: true
```

### Bad Result (CDN URL wrong):
```
✅ Got movie: [title]
❌ HTTP error: 404
```
OR
```
❌ Got HTML page instead of video!
```

### Bad Result (CORS issue):
```
✅ Got movie: [title]
❌ Fetch failed: blocked by CORS policy
```

## After Running the Test

Copy and paste the ENTIRE output here so I can see what's happening and provide the fix.
