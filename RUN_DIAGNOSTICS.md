# Quick Diagnostic Guide

## What Was Done

✅ Removed development mock from `useHeroContent`
✅ Added comprehensive backend logging (emoji-prefixed)
✅ Added frontend console logging
✅ Ready to test end-to-end flow

## How to Run Diagnostics

### 1. Start the Application
```bash
npm run tauri dev
```

### 2. Open Browser DevTools
- Press `F12` or right-click → Inspect
- Go to **Console** tab
- Keep it open

### 3. Navigate to Home Page
The app should load automatically at `http://localhost:1420`

### 4. Watch Both Logs

**Terminal (Backend):**
Look for emoji-prefixed logs:
- 🚀 Function calls
- 🌐 API requests
- 📥 API responses
- 📦 Claim details
- 🎬 CDN URLs
- 🎯 Return values

**Browser Console (Frontend):**
Look for:
- 🎬 [FRONTEND DIAGNOSTIC] useHeroContent
- 🎥 [FRONTEND DIAGNOSTIC] useMovies
- 📺 [FRONTEND DIAGNOSTIC] useSeries

## What to Check

### Hero Section
**Expected:**
```
Terminal:
🚀 DIAGNOSTIC: fetch_channel_claims called
   channel_id=@kiyyamovies:b, tags=Some(["hero_trailer"])
📦 DIAGNOSTIC: Claim[0]: id=..., type=stream, tags=["hero_trailer", ...]
🎬 DIAGNOSTIC: Constructed CDN URL: https://cdn.odysee.com/content/.../master.m3u8
🎯 DIAGNOSTIC: Returning 1 items to frontend

Browser Console:
🎬 [FRONTEND DIAGNOSTIC] useHeroContent called
🎬 [FRONTEND DIAGNOSTIC] useHeroContent result: {
  contentCount: 1,
  content: [{
    claim_id: "...",
    title: "...",
    video_urls: ["master"],
    master_url: "https://cdn.odysee.com/content/.../master.m3u8"
  }]
}
```

**If Hero Fails:**
- Check if API returns 0 claims → No hero_trailer tagged content exists
- Check if claims are skipped → value_type filtering issue
- Check if master_url is missing → URL construction issue

### Movies Section
**Expected:**
```
Terminal:
🚀 DIAGNOSTIC: fetch_channel_claims called
   tags=Some(["movie"])
📦 DIAGNOSTIC: Claim[0]: id=..., type=stream, tags=["movie", ...]
🎯 DIAGNOSTIC: Returning X items to frontend

Browser Console:
🎥 [FRONTEND DIAGNOSTIC] useMovies called, filterTag: undefined
🎥 [FRONTEND DIAGNOSTIC] useMovies result: {
  contentCount: X,
  firstItem: {
    claim_id: "...",
    video_urls: ["master"]
  }
}
```

### Series Section
**Expected:**
```
Terminal:
🚀 DIAGNOSTIC: fetch_channel_claims called
   tags=Some(["series"])
📦 DIAGNOSTIC: Claim[0]: id=..., type=stream, tags=["series", ...]
🎯 DIAGNOSTIC: Returning X items to frontend

Browser Console:
📺 [FRONTEND DIAGNOSTIC] useSeries called, filterTag: undefined
📺 [FRONTEND DIAGNOSTIC] useSeries result: {
  contentCount: X,
  firstItem: {
    claim_id: "...",
    video_urls: ["master"]
  }
}
```

## Common Failure Patterns

### Pattern 1: Empty API Response
```
✅ DIAGNOSTIC: Found items array with 0 claims
📊 DIAGNOSTIC: Parsing complete - Valid: 0, Skipped: 0, Total: 0
```
**Cause:** No content with the specified tag exists on the channel
**Fix:** Add content with the correct tag to Odysee channel

### Pattern 2: All Claims Skipped
```
✅ DIAGNOSTIC: Found items array with 5 claims
❌ DIAGNOSTIC: Rejecting non-stream claim ...: type=channel
⚠️ DIAGNOSTIC: Claim[0] SKIPPED
📊 DIAGNOSTIC: Parsing complete - Valid: 0, Skipped: 5, Total: 5
```
**Cause:** Claims have wrong value_type (channel, repost, collection)
**Fix:** Ensure content is value_type="stream"

### Pattern 3: Frontend Receives Empty Array
```
Terminal: 🎯 DIAGNOSTIC: Returning 5 items to frontend
Browser: contentCount: 0
```
**Cause:** Frontend-backend bridge issue
**Fix:** Check Tauri command invocation and serialization

### Pattern 4: Missing Master URL
```
Browser: video_urls: ["720p", "1080p"]  // No "master" key
```
**Cause:** CDN URL construction failed
**Fix:** Check extract_video_urls logic

## Copy This Command

To save all logs to a file:
```bash
npm run tauri dev 2>&1 | tee diagnostic-logs.txt
```

Then share `diagnostic-logs.txt` along with browser console output.

## Next Steps After Running

1. Copy terminal output
2. Copy browser console output
3. Note which sections work/fail
4. Share logs for analysis
5. Identify exact failure point from logs
