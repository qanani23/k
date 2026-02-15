# Temporary Hero Mock for Testing

If you want to test the Hero section immediately without waiting for Odysee content, apply this temporary mock:

## Apply the Mock

Edit `src/hooks/useContent.ts` and replace the `useHeroContent` function with this:

```typescript
export function useHeroContent(options?: Partial<UseContentOptions>) {
  // TEMPORARY MOCK: Remove this after adding real hero_trailer content to Odysee
  if (import.meta.env.DEV) {
    console.log('[useHeroContent] Using MOCK data for development');
    
    return {
      content: [{
        claim_id: 'mock-hero-123',
        title: 'Big Buck Bunny - Sample Hero Video',
        description: 'This is a temporary mock hero video for testing the Hero section. Replace this by adding the hero_trailer tag to a real video on your Odysee channel.',
        tags: ['hero_trailer', 'movie', 'action_movies'],
        thumbnail_url: 'https://peach.blender.org/wp-content/uploads/title_anouncement.jpg',
        duration: 596, // 9 minutes 56 seconds
        release_time: Date.now(),
        video_urls: {
          '1080p': { 
            url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 
            quality: '1080p', 
            type: 'mp4' as const 
          },
          '720p': { 
            url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 
            quality: '720p', 
            type: 'mp4' as const 
          }
        },
        compatibility: { 
          compatible: true, 
          fallback_available: false,
          reason: null
        },
        etag: null,
        content_hash: null,
        raw_json: null
      }],
      loading: false,
      error: null,
      refetch: async () => {},
      loadMore: async () => {},
      hasMore: false,
      fromCache: false,
      status: 'success' as const
    };
  }
  
  // Production code - fetch real hero content
  const result = useContent({ tags: ['hero_trailer'], limit: 20, ...options });
  
  // Development logging for hero content
  if (import.meta.env.DEV) {
    console.log('[useHeroContent] Hook state:', {
      contentCount: result.content.length,
      loading: result.loading,
      error: result.error,
      fromCache: result.fromCache,
      hasMore: result.hasMore,
      content: result.content.map(item => ({
        claim_id: item.claim_id,
        title: item.title,
        tags: item.tags
      }))
    });
  }
  
  return result;
}
```

## What This Does

- In development mode (`npm run tauri:dev`), it returns a mock hero video
- The mock uses Big Buck Bunny, a free sample video
- In production builds, it uses real Odysee content
- You'll see a console log: `[useHeroContent] Using MOCK data for development`

## Remove the Mock

Once you've added the `hero_trailer` tag to a real video on Odysee:

1. Remove the entire `if (import.meta.env.DEV) { ... }` block
2. Keep only the production code
3. Restart the app

## Why This Helps

This lets you:
- Test the Hero section immediately
- Verify all the fixes are working
- See how the Hero component behaves
- Test autoplay, shuffle, favorites, etc.
- Confirm the UI is correct

Then you can add real content to Odysee at your own pace.
