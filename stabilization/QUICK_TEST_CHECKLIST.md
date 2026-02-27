# Quick Test Checklist

## 🚀 Start Testing

```bash
npm run tauri:dev
```

## ✅ What to Check

### 1. Backend Terminal (Rust)
Look for this output when you click a video:
```
🎬 VIDEO URL CONSTRUCTION:
   Claim Name: [video name]
   Claim ID: [40-char hex]
   SD Hash: [long hex string]
   File Stub (first 6 of sd_hash): [6 chars]
   Expected URL: https://player.odycdn.com/api/v3/streams/free/...
```

### 2. Browser Console (F12)
Look for:
```javascript
[TRACE] Stage 6: Frontend received content items
[TRACE] Stage 7: Video URL selected
```

### 3. Video Player
- Does it load?
- Does it play?
- Any error messages?

## 📋 Report Back

Copy and paste:
1. The "🎬 VIDEO URL CONSTRUCTION" output from backend
2. The "[TRACE] Stage 7" output from frontend
3. Any error messages
4. Whether video plays or not

## 🎯 Expected Result

Video should play with URL like:
```
https://player.odycdn.com/api/v3/streams/free/man_ayebgn_Ethiopian_Movie/faf0de58484f01c3da49ccf2d5466b28f69a91eb/03427c.mp4
```

## ⚠️ Ignore This

You might still see some old debug output - ignore anything that says "SD_HASH DEBUG" or "DOES NOT MATCH". That was misleading debug code that's been replaced.
