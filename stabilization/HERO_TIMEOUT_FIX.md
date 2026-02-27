# Hero Timeout Fix

## Problem
The `hero_trailer` query times out after 30 seconds, while `movie` and `series` queries work fine.

## Likely Causes

### Cause 1: No Content with hero_trailer Tag
If your Odysee channel has no videos tagged with `hero_trailer`, the backend might be:
- Waiting for a response that never comes
- Stuck in a retry loop
- Hanging on the Odysee API call

### Cause 2: Backend Hanging
The backend might be deadlocked or stuck waiting for a response from Odysee API.

## Quick Fix: Disable Hero Section

Since movies and series work, let's temporarily disable the hero section so you can use the app:

### Option A: Comment Out Hero Component

Find the Home page component and comment out the hero section:

```typescript
// In src/pages/Home.tsx or similar
export default function Home() {
  // const { content: heroContent } = useHeroContent(); // DISABLED
  const { content: movies } = useMovies();
  
  return (
    <div>
      {/* <HeroSection content={heroContent} /> */} {/* DISABLED */}
      <MoviesSection content={movies} />
    </div>
  );
}
```

### Option B: Add Timeout to Hero Query

Reduce the timeout for hero queries so it fails faster:

```typescript
// In src/lib/api.ts
export const fetchHeroContent = async (limit: number = 20): Promise<ContentItem[]> => {
  try {
    // Add a shorter timeout for hero content
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const result = await fetchByTag('hero_trailer', limit);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    console.warn('Hero content failed to load, returning empty array');
    return []; // Return empty array instead of throwing
  }
};
```

## Proper Fix: Check Your Odysee Channel

1. Go to https://odysee.com/@kiyyamovies:b
2. Check if you have any videos tagged with `hero_trailer`
3. If not, either:
   - Add the `hero_trailer` tag to one of your videos
   - OR change the hero query to use a different tag (like `movie`)

## Test Commands

### Test 1: Check if hero_trailer tag exists
```javascript
window.__TAURI__.invoke('fetch_channel_claims', { 
  channelId: '@kiyyamovies:b',
  anyTags: ['hero_trailer'],
  limit: 1
}).then(r => console.log('Hero items:', r.length))
  .catch(e => console.error('Hero error:', e));
```

### Test 2: Use movie tag for hero instead
```javascript
window.__TAURI__.invoke('fetch_channel_claims', { 
  channelId: '@kiyyamovies:b',
  anyTags: ['movie'],
  limit: 1
}).then(r => console.log('Movie as hero:', r))
  .catch(e => console.error('Error:', e));
```

## Recommended Solution

Change the hero content to use the `movie` tag instead of `hero_trailer`:

```typescript
// In src/hooks/useContent.ts
export function useHeroContent(options?: Partial<UseContentOptions>) {
  console.log('🎬 [FRONTEND DIAGNOSTIC] useHeroContent called');
  
  // CHANGED: Use 'movie' tag instead of 'hero_trailer'
  const result = useContent({ tags: ['movie'], limit: 20, ...options });
  
  console.log('🎬 [FRONTEND DIAGNOSTIC] useHeroContent result:', {
    contentCount: result.content.length,
    loading: result.loading,
    error: result.error,
  });
  
  return result;
}
```

This way, the hero section will show your movies, and you won't have the timeout issue.
