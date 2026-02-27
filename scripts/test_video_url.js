// Test script to verify Odysee video URL construction
// Run with: node scripts/test_video_url.js

import https from 'https';

// Example from your channel
const testCases = [
  {
    name: "man_ayebgn_Ethiopian_Movie",
    claim_id: "faf0de58484f01c3da49ccf2d5466b28f69a91eb",
    sd_hash: "03427c91a7eac2d0f2504f547ab96baf2cece057d53967e47cd38f3b51f852546e1e60c2bb7e51aca04e2885001305af"
  },
  {
    name: "Afla-Fiker-S01E02-the-chance",
    claim_id: "faf0de58484f01c3da49ccf2d5466b28f69a91eb", // This might be wrong - using same as above
    sd_hash: "4e9161275c56d35f41209b8cd01ebc5b2bfaf21151a8eab205d11287ab309b21118cee91d8c59561b64a6fc9b34438a2"
  }
];

function testUrl(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD' }, (res) => {
      console.log(`✅ ${url}`);
      console.log(`   Status: ${res.statusCode}`);
      console.log(`   Content-Type: ${res.headers['content-type']}`);
      console.log(`   Content-Length: ${res.headers['content-length']}`);
      resolve({ success: true, status: res.statusCode });
    });

    req.on('error', (err) => {
      console.log(`❌ ${url}`);
      console.log(`   Error: ${err.message}`);
      resolve({ success: false, error: err.message });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      console.log(`⏱️ ${url}`);
      console.log(`   Timeout after 5 seconds`);
      resolve({ success: false, error: 'timeout' });
    });

    req.end();
  });
}

async function main() {
  console.log('🎬 Testing Odysee Video URL Construction\n');

  for (const test of testCases) {
    const fileStub = test.sd_hash.substring(0, 6);
    const url = `https://player.odycdn.com/api/v3/streams/free/${test.name}/${test.claim_id}/${fileStub}.mp4`;
    
    console.log(`\nTest: ${test.name}`);
    console.log(`Claim ID: ${test.claim_id}`);
    console.log(`SD Hash: ${test.sd_hash}`);
    console.log(`File Stub: ${fileStub}`);
    console.log(`Constructed URL: ${url}\n`);
    
    await testUrl(url);
    console.log('---');
  }
}

main().catch(console.error);
