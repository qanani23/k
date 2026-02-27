# CDN URL Fix Solution

## Problem Identified

The current CDN URL format returns **403 Forbidden**:
```
https://cloud.odysee.live/content/faf0de58484f01c3da49ccf2d5466b28f69a91eb/master.m3u8
→ 403 Forbidden (HTML error page)
```

## Root Cause

The `cloud.odysee.live` CDN requires authentication or uses a different URL pattern. We're constructing URLs that the CDN rejects.

## Solution Options

### Option 1: Use Odysee Embed Player (RECOMMENDED)

Instead of trying to stream directly, use Odysee's embed player which handles authentication:

```
https://odysee.com/$/embed/@kiyyamovies/man_ayebgn_Ethiopian_Movie
```

This is an iframe-based solution that will always work because it uses Odysee's official player.

### Option 2: Find Correct CDN URL Pattern

Based on the API response, we have:
- `claim_id`: `faf0de58484f01c3da49ccf2d5466b28f69a91eb`
- `sd_hash`: `03427c91a7eac2d0f2504f547ab96baf2cece057d53967e47cd38f3b51f852546e1e60c2bb7e51aca04e2885001305af`
- `canonical_url`: `lbry://@kiyyamovies#b/man_ayebgn_Ethiopian_Movie#f`

Possible CDN URL patterns to try:
1. `https://player.odycdn.com/api/v4/streams/free/@kiyyamovies/man_ayebgn_Ethiopian_Movie/faf0de58484f01c3da49ccf2d5466b28f69a91eb/master.m3u8`
2. `https://cdn.lbryplayer.xyz/api/v4/streams/free/@kiyyamovies/man_ayebgn_Ethiopian_Movie/faf0de58484f01c3da49ccf2d5466b28f69a91eb`
3. `https://player.odycdn.com/content/claims/@kiyyamovies/man_ayebgn_Ethiopian_Movie/faf0de58484f01c3da49ccf2d5466b28f69a91eb/master.m3u8`

### Option 3: Use LBRY Protocol (Complex)

Use the `sd_hash` to stream via LBRY's peer-to-peer network, but this requires:
- LBRY daemon running
- Complex setup
- Not recommended for a simple desktop app

## Recommended Implementation

Use **Option 1 (Embed Player)** because:
- ✅ Always works (official Odysee player)
- ✅ Handles authentication automatically
- ✅ No CDN URL guessing needed
- ✅ Gets updates when Odysee changes their streaming infrastructure
- ❌ Requires iframe (but this is acceptable for a desktop app)

## Implementation Steps

1. Change the video URL construction to use embed URLs
2. Update the player component to handle iframe embeds
3. Test with your content

## Quick Test

Try this URL in your browser to see if the embed works:
```
https://odysee.com/$/embed/man_ayebgn_Ethiopian_Movie/faf0de58484f01c3da49ccf2d5466b28f69a91eb
```

If this works, we'll update the backend to generate embed URLs instead of direct CDN URLs.
