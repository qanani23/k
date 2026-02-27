// Test script to verify ALL content types have video URLs
// Run in browser console after app loads

async function testAllContentURLs() {
  console.log('=== TESTING ALL CONTENT TYPES ===\n');
  
  const tests = [
    { name: 'Movies', tags: ['movie'] },
    { name: 'Series', tags: ['series'] },
    { name: 'Hero (movie tag)', tags: ['movie'] }
  ];
  
  for (const test of tests) {
    console.log(`\n📋 Testing: ${test.name}`);
    console.log(`   Tags: ${test.tags.join(', ')}`);
    
    try {
      const items = await window.__TAURI__.invoke('fetch_channel_claims', {
        channelId: '@kiyyamovies:b',
        anyTags: test.tags,
        limit: 3
      });
      
      console.log(`   ✅ Fetched ${items.length} items`);
      
      items.forEach((item, index) => {
        console.log(`\n   Item ${index + 1}:`);
        console.log(`      Title: ${item.title}`);
        console.log(`      Claim ID: ${item.claim_id}`);
        console.log(`      Tags: ${item.tags.join(', ')}`);
        console.log(`      Has video_urls: ${!!item.video_urls}`);
        
        if (item.video_urls) {
          const qualities = Object.keys(item.video_urls);
          console.log(`      Video qualities: ${qualities.join(', ')}`);
          
          if (item.video_urls.master) {
            console.log(`      Master URL: ${item.video_urls.master.url}`);
            console.log(`      URL Type: ${item.video_urls.master.url_type}`);
          }
        } else {
          console.log(`      ❌ NO VIDEO URLS!`);
        }
      });
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n=== TEST COMPLETE ===');
}

// Run the test
testAllContentURLs();
