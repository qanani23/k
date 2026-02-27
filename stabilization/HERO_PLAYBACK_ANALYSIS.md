# Hero Section Playback - Complete Analysis

## How Hero Section Plays Videos (Background Muted Autoplay)

### Overview
The Hero section plays videos in the background (muted, looping) as a visual effect. This is DIFFERENT from the full playback in PlayerModal.

---

## Complete Flow

### 1. Content Fetching

**Hook:** `useHeroContent()` in `src/hooks/useContent.ts`

```typescript
export function useHeroContent(options?: Partial<UseContentOptions>) {
  // Uses 'movie' tag instead of 'hero_trailer' (temporary fix for timeout)
  const result = useContent({ tags: ['movie'], limit: 20, ...options });
  return result;
}
```

**Backend Call:** `fetch_channel_claims` with tags=['movie']

**Rust Function:** `src-tauri/src/commands.rs`
```rust
pub async fn fetch_channel_claims(
    channel_id: String,
    any_tags: Option<Vec<String>>,
    // ... other params
) -> Result<Vec<ContentItem>>
```

### 2. URL Construction (Backend)

**Function:** `extract_video_urls()` in `src-tauri/src/commands.rs`

```rust
fn extract_video_urls(item: &Value) -> Result<HashMap<String, VideoUrl>> {
    // Extract components
    let claim_id = item.get("claim_id").and_then(|v| v.as_str())?;
    let claim_name = item.get("name").and_then(|v| v.as_str())?;
    let sd_hash = item.get("value")
        .and_then(|v| v.get("source"))
        .and_then(|s| s.get("sd_hash"))
        .and_then(|h| h.as_str())?;
    
    // Validate sd_hash length
    if sd_hash.len() < 6 {
        return Err(KiyyaError::ContentParsing {
            message: format!("sd_hash too short: {} characters", sd_hash.len()),
        });
    }
    
    // Construct URL
    let file_stub = &sd_hash[..6];  // First 6 characters
    let stream_url = format!(
        "https://player.odycdn.com/api/v3/streams/free/{}/{}/{}.mp4",
        claim_name,
        claim_id,
        file_stub
    );
    
    // Create VideoUrl struct
    let video_url = VideoUrl {
        url: stream_url,
        quality: "master".to_string(),
        url_type: "mp4".to_string(),
        codec: None,
    };
    
    // Return HashMap with "master" key
    let mut video_urls = HashMap::new();
    video_urls.insert("master".to_string(), video_url);
    
    Ok(video_urls)
}
```

**URL Pattern:**
```
https://player.odycdn.com/api/v3/streams/free/{claim_name}/{claim_id}/{first_6_of_sd_hash}.mp4
```

**Example:**
```
https://player.odycdn.com/api/v3/streams/free/man_ayebgn_Ethiopian_Movie/faf0de58484f01c3da49ccf2d5466b28f69a91eb/03427c.mp4
```

**Components:**
- `claim_name`: "man_ayebgn_Ethiopian_Movie" (from item.name)
- `claim_id`: "faf0de58484f01c3da49ccf2d5466b28f69a91eb" (from item.claim_id)
- `file_stub`: "03427c" (first 6 chars of sd_hash)
- `sd_hash`: "03427c91a7eac2d0f2504f547ab96baf2cece057d53967e47cd38f3b51f852546e1e60c2bb7e51aca04e2885001305af"

### 3. Frontend Receives Content

**File:** `src/lib/api.ts`

```typescript
// Stage 6: Frontend receives content items
const response = await invoke('fetch_channel_claims', {
  channelId: '@kiyyamovies:b',
  anyTags: ['movie'],
  limit: 20
});

// Response structure:
[
  {
    claim_id: "faf0de58484f01c3da49ccf2d5466b28f69a91eb",
    title: "man_ayebgn_Ethiopian_Movie",
    video_urls: {
      master: {
        url: "https://player.odycdn.com/api/v3/streams/free/man_ayebgn_Ethiopian_Movie/faf0de58484f01c3da49ccf2d5466b28f69a91eb/03427c.mp4",
        quality: "master",
        url_type: "mp4",
        codec: null
      }
    },
    thumbnail_url: "https://...",
    tags: ["movie"],
    // ... other fields
  }
]
```

### 4. Hero Component Selects Content

**File:** `src/components/Hero.tsx`

```typescript
// Select random hero from fetched content
useEffect(() => {
  if (heroContent.length > 0 && !selectedHero) {
    const randomIndex = Math.floor(Math.random() * heroContent.length);
    const hero = heroContent[randomIndex];
    setSelectedHero(hero);
  }
}, [heroContent, selectedHero]);
```

### 5. Extract Video URL

**File:** `src/components/Hero.tsx` (line 237)

```typescript
// Get the video URL from the "master" quality
const bestVideoUrl = selectedHero.video_urls['master']?.url || 
                    Object.values(selectedHero.video_urls)[0]?.url;
```

**Result:**
```
bestVideoUrl = "https://player.odycdn.com/api/v3/streams/free/man_ayebgn_Ethiopian_Movie/faf0de58484f01c3da49ccf2d5466b28f69a91eb/03427c.mp4"
```

### 6. Render Video Element

**File:** `src/components/Hero.tsx` (line 241-254)

```typescript
{bestVideoUrl && !videoError ? (
  <video
    ref={videoRef}
    className="absolute inset-0 w-full h-full object-cover"
    autoPlay      // ← Autoplay enabled
    muted         // ← Muted (required for autoplay)
    loop          // ← Loop continuously
    playsInline   // ← Play inline on mobile
    onError={() => setVideoError(true)}
    poster={selectedHero.thumbnail_url}
  >
    <source src={bestVideoUrl} type="video/mp4" />
  </video>
) : (
  // Fallback to thumbnail image if video fails
  <div className="..." style={{ backgroundImage: `url(${selectedHero.thumbnail_url})` }} />
)}
```

### 7. Autoplay Attempt

**File:** `src/components/Hero.tsx` (line 119-133)

```typescript
useEffect(() => {
  if (selectedHero && videoRef.current && !videoError) {
    const video = videoRef.current;
    
    // Attempt autoplay (muted) - single attempt only
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        // Autoplay failed - fall back to poster display
        console.debug('Hero autoplay failed (expected behavior):', error.message);
        setVideoError(true);
      });
    }
  }
}, [selectedHero, videoError]);
```

---

## Key Points

### Why Hero Plays Automatically

1. **HTML5 Video Attributes:**
   - `autoPlay` - Browser attempts to play automatically
   - `muted` - Required for autoplay (browsers block unmuted autoplay)
   - `loop` - Video repeats continuously
   - `playsInline` - Prevents fullscreen on mobile

2. **JavaScript Play Call:**
   - `video.play()` is called in useEffect
   - If it fails, falls back to thumbnail image
   - No retry loops (single attempt only)

3. **Browser Autoplay Policy:**
   - Muted videos can autoplay
   - Unmuted videos require user interaction
   - Hero is muted, so it can autoplay

### URL Construction Details

**Three Required Components:**

1. **claim_name** (from Odysee API)
   - Source: `item.name`
   - Example: "man_ayebgn_Ethiopian_Movie"
   - Used as-is in URL

2. **claim_id** (from Odysee API)
   - Source: `item.claim_id`
   - Example: "faf0de58484f01c3da49ccf2d5466b28f69a91eb"
   - 40-character hexadecimal string
   - Unique identifier for the claim

3. **sd_hash** (from Odysee API)
   - Source: `item.value.source.sd_hash`
   - Example: "03427c91a7eac2d0f2504f547ab96baf2cece057d53967e47cd38f3b51f852546e1e60c2bb7e51aca04e2885001305af"
   - 96-character hexadecimal string
   - Only first 6 characters used: "03427c"

**URL Assembly:**
```
https://player.odycdn.com/api/v3/streams/free/
  + {claim_name}/
  + {claim_id}/
  + {sd_hash[0..6]}.mp4
```

### Why It's Stored in "master" Key

The backend stores the URL in a HashMap with key "master":

```rust
let mut video_urls = HashMap::new();
video_urls.insert("master".to_string(), video_url);
```

This is because:
1. Odysee provides a single MP4 file (not multiple qualities)
2. "master" is used as a convention for the primary/default quality
3. Frontend looks for `video_urls['master']` first

---

## Differences: Hero vs PlayerModal

### Hero Section (Background Autoplay)
- **Purpose:** Visual effect, ambient background
- **Playback:** Muted, looping, autoplay
- **Controls:** None (just background video)
- **User Action:** None required (automatic)
- **Video Element:** Simple `<video>` tag
- **URL Source:** `selectedHero.video_urls['master'].url`

### PlayerModal (Full Playback)
- **Purpose:** Watch full video with sound
- **Playback:** Unmuted, with controls
- **Controls:** Play/pause, seek, volume, fullscreen
- **User Action:** Click "Play" button required
- **Video Element:** Plyr player with HLS.js support
- **URL Source:** `content.video_urls['master'].url` (same URL!)

**Important:** Both use the SAME URL from the backend! The difference is only in how they're displayed and controlled.

---

## Why Movies/Series Don't Play

The Movies and Series sections DON'T have background video like Hero. They only have:
1. Thumbnail images on cards
2. Play buttons that should open PlayerModal

The issue is that the Play buttons weren't opening PlayerModal - they were either:
- Doing nothing (MovieDetail)
- Navigating to broken pages (SeriesDetail)

---

## Summary

### Hero Playback Flow:
1. Fetch movies with tag='movie'
2. Backend constructs URL: `https://player.odycdn.com/api/v3/streams/free/{claim_name}/{claim_id}/{sd_hash[..6]}.mp4`
3. Frontend receives ContentItem with video_urls.master.url
4. Hero component selects random movie
5. Extracts URL from video_urls['master'].url
6. Renders `<video>` element with autoPlay, muted, loop
7. Calls video.play() in useEffect
8. Video plays in background (muted)

### URL Components:
- **claim_name**: From item.name (e.g., "man_ayebgn_Ethiopian_Movie")
- **claim_id**: From item.claim_id (40-char hex)
- **file_stub**: First 6 chars of sd_hash (e.g., "03427c")
- **sd_hash**: From item.value.source.sd_hash (96-char hex)

### Why It Works:
- URL is correctly constructed in backend
- URL is accessible (returns 200 OK, video/mp4)
- HTML5 video element with autoPlay + muted
- Browser allows muted autoplay
- Single play() attempt in useEffect
