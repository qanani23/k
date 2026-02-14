# Design Document: UI and Data-Fetching Fixes

## Overview

This design addresses critical UI glitching and data-fetching failures across the Kiyya Desktop streaming application. The root causes have been identified as:

1. **Unstable Hook Dependencies**: The `useContent` hook creates new object references on every render, causing infinite re-render loops
2. **Missing Page Components**: Sitcoms and Kids pages don't exist, causing routing failures
3. **Memory Manager Re-initialization**: The Memory Manager instance is recreated on every render, invalidating caches
4. **Dual Loading State Management**: Using both `loading` boolean and implicit state checks causes race conditions
5. **React StrictMode Double Execution**: Development mode triggers duplicate fetches without protection

The solution implements stable memoization patterns, creates missing page components, refactors the fetch state machine, and adds comprehensive diagnostics.

## Architecture

### Component Hierarchy

```
App
├── NavBar
├── Routes
│   ├── Home (uses multiple content hooks)
│   ├── MoviesPage (uses useMovies)
│   ├── SeriesPage (uses useSeriesGrouped)
│   ├── SitcomsPage (NEW - uses useSitcoms)
│   └── KidsPage (NEW - uses useKidsContent)
└── Toast Notifications
```

### Data Flow

```
User Action → Route Change → Page Component → useContent Hook → API Fetch → Memory Manager Cache → State Update → UI Render
```

### Hook Dependency Chain (Current - Problematic)

```typescript
useContent() {
  const collectionId = `content-${tags?.join('-')}` // NEW REFERENCE EVERY RENDER
  const memoryManager = getMemoryManager() // NEW INSTANCE EVERY RENDER
  
  const fetchContent = useCallback(() => { ... }, [tags, text, limit, collectionId, memoryManager])
  // ↑ collectionId and memoryManager change every render → fetchContent recreated → useEffect triggers → infinite loop
  
  useEffect(() => {
    fetchContent()
  }, [fetchContent]) // ← Depends on unstable fetchContent
}
```

### Hook Dependency Chain (Fixed)

```typescript
useContent() {
  const collectionId = useMemo(() => `content-${tags?.join('-')}`, [tags]) // STABLE
  const memoryManager = useMemo(() => getMemoryManager(), []) // STABLE
  
  const fetchContent = useCallback(() => { ... }, [tags, text, limit, collectionId, memoryManager])
  // ↑ All dependencies are now stable → fetchContent only recreated when tags/text/limit change
  
  useEffect(() => {
    fetchContent()
  }, [fetchContent]) // ← Only triggers when fetchContent actually changes
}
```

## Components and Interfaces

### 1. Refactored useContent Hook

**File**: `src/hooks/useContent.ts`

**Changes**:
- Memoize `collectionId` using `useMemo`
- Memoize `memoryManager` instance using `useMemo`
- Add fetch deduplication using a ref to track in-flight requests
- Add development mode logging for state transitions
- Implement single status field instead of multiple booleans

**Interface**:

```typescript
interface UseContentOptions {
  tags?: string[];
  text?: string;
  limit?: number;
  autoFetch?: boolean;
  offlineOnly?: boolean;
  enableMemoryManagement?: boolean;
}

interface UseContentReturn {
  content: ContentItem[];
  loading: boolean;
  error: ApiError | null;
  status: 'idle' | 'loading' | 'success' | 'error'; // NEW
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}
```

**Key Implementation Details**:

```typescript
export function useContent(options: UseContentOptions = {}): UseContentReturn {
  const { tags, text, limit = 50, autoFetch = true, offlineOnly = false, enableMemoryManagement = true } = options;
  const { isOnline } = useOffline();
  
  const [content, setContent] = useState<ContentItem[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle'); // NEW
  const [error, setError] = useState<ApiError | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  // FIX 1: Memoize collectionId to prevent reference changes
  const collectionId = useMemo(() => 
    `content-${tags?.join('-') || text || 'default'}`, 
    [tags, text]
  );
  
  // FIX 2: Memoize memoryManager instance
  const memoryManager = useMemo(() => 
    enableMemoryManagement ? getMemoryManager() : null, 
    [enableMemoryManagement]
  );
  
  // FIX 3: Track in-flight requests to prevent duplicate fetches
  const fetchInProgressRef = useRef(false);
  
  // FIX 4: Development mode logging
  const isDev = import.meta.env.DEV;
  
  const fetchContent = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    // Prevent duplicate fetches
    if (fetchInProgressRef.current) {
      if (isDev) console.log('[useContent] Fetch already in progress, skipping');
      return;
    }
    
    fetchInProgressRef.current = true;
    
    try {
      setStatus('loading');
      if (isDev) console.log('[useContent] State: idle → loading', { collectionId, pageNum });
      
      // ... fetch logic ...
      
      setStatus('success');
      if (isDev) console.log('[useContent] State: loading → success', { itemCount: results.length });
      
    } catch (err) {
      setStatus('error');
      if (isDev) console.error('[useContent] State: loading → error', err);
      // ... error handling ...
    } finally {
      fetchInProgressRef.current = false;
    }
  }, [tags, text, limit, isOnline, offlineOnly, collectionId, memoryManager, isDev]);
  
  // ... rest of hook implementation
}
```

### 2. SitcomsPage Component (NEW)

**File**: `src/pages/SitcomsPage.tsx`

**Purpose**: Dedicated page for browsing sitcom content

**Structure**: Mirrors `MoviesPage.tsx` with sitcom-specific configuration

**Key Features**:
- Uses `useSitcoms()` hook
- Grid/List view toggle
- Pagination with "Load More"
- Offline state handling
- Favorites integration

**Implementation Pattern**:

```typescript
export default function SitcomsPage() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const { isOffline } = useOffline();

  const { content: sitcoms, loading, error, loadMore, hasMore } = useSitcoms();
  const { downloadContent } = useDownloadManager();

  // ... handlers for play, download, favorite ...

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <span>Home</span>
        <span className="breadcrumb-separator">/</span>
        <span>Sitcoms</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Sitcoms</h1>
          <p className="text-text-secondary mt-2">
            {sitcoms.length} sitcom{sitcoms.length !== 1 ? 's' : ''} available
          </p>
        </div>
        {/* View mode toggle */}
      </div>

      {/* Content Grid */}
      {/* ... similar to MoviesPage ... */}
    </div>
  );
}
```

### 3. KidsPage Component (NEW)

**File**: `src/pages/KidsPage.tsx`

**Purpose**: Dedicated page for browsing kids content with category filtering

**Structure**: Mirrors `MoviesPage.tsx` with kids-specific filters

**Key Features**:
- Uses `useKidsContent()` hook
- Filter by comedy_kids, action_kids
- Grid/List view toggle
- Pagination with "Load More"
- Offline state handling

**Implementation Pattern**: Same as SitcomsPage but with filter support

```typescript
export default function KidsPage() {
  const [searchParams] = useSearchParams();
  const filterTag = searchParams.get('filter');
  
  const { content: kidsContent, loading, error, loadMore, hasMore } = useKidsContent(filterTag || undefined);
  
  // ... similar structure to MoviesPage with filters ...
}
```

### 4. Router Configuration Updates

**File**: `src/App.tsx`

**Changes**: Add routes for `/sitcoms` and `/kids`

```typescript
<Routes>
  <Route path="/" element={<ErrorBoundary><Home /></ErrorBoundary>} />
  <Route path="/movies" element={<ErrorBoundary><MoviesPage /></ErrorBoundary>} />
  <Route path="/series" element={<ErrorBoundary><SeriesPage /></ErrorBoundary>} />
  <Route path="/sitcoms" element={<ErrorBoundary><SitcomsPage /></ErrorBoundary>} /> {/* NEW */}
  <Route path="/kids" element={<ErrorBoundary><KidsPage /></ErrorBoundary>} /> {/* NEW */}
  <Route path="/search" element={<ErrorBoundary><Search /></ErrorBoundary>} />
  {/* ... other routes ... */}
</Routes>
```

### 5. API Response Validation

**File**: `src/lib/api.ts`

**Purpose**: Validate Odysee API responses before processing

**Implementation**:

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateContentItem(item: any): ValidationResult {
  const errors: string[] = [];
  
  if (!item.claim_id) errors.push('Missing claim_id');
  if (!item.value) errors.push('Missing value object');
  if (!item.tags || !Array.isArray(item.tags)) errors.push('Missing or invalid tags array');
  if (!item.value?.source) errors.push('Missing value.source');
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export async function fetchByTag(tag: string, limit: number = 50): Promise<ContentItem[]> {
  const isDev = import.meta.env.DEV;
  
  try {
    const response = await invoke<ContentItem[]>('fetch_by_tag', { tag, limit });
    
    if (isDev) {
      console.log('[API] fetchByTag response:', { tag, count: response.length });
    }
    
    // Validate each item
    const validatedItems = response.filter(item => {
      const validation = validateContentItem(item);
      if (!validation.valid && isDev) {
        console.warn('[API] Invalid content item:', validation.errors, item);
      }
      return validation.valid;
    });
    
    if (isDev && validatedItems.length < response.length) {
      console.warn('[API] Filtered out invalid items:', {
        original: response.length,
        valid: validatedItems.length,
        filtered: response.length - validatedItems.length
      });
    }
    
    return validatedItems;
  } catch (error) {
    if (isDev) {
      console.error('[API] fetchByTag error:', { tag, error });
    }
    throw error;
  }
}
```

### 6. Development Mode Diagnostics

**File**: `src/hooks/useRenderCount.ts` (NEW)

**Purpose**: Track component render counts in development mode

```typescript
import { useRef, useEffect } from 'react';

export function useRenderCount(componentName: string) {
  const renderCount = useRef(0);
  const isDev = import.meta.env.DEV;
  
  useEffect(() => {
    if (isDev) {
      renderCount.current += 1;
      console.log(`[${componentName}] Render count: ${renderCount.current}`);
      
      if (renderCount.current > 10) {
        console.warn(`[${componentName}] Excessive re-renders detected! (${renderCount.current})`);
      }
    }
  });
  
  return renderCount.current;
}
```

**Usage in Pages**:

```typescript
export default function Home() {
  useRenderCount('Home');
  // ... rest of component
}
```

## Data Models

### Fetch Status State Machine

```
┌─────┐
│ idle│
└──┬──┘
   │ fetchContent()
   ▼
┌────────┐
│loading │
└───┬────┘
    │
    ├─ success ──▶ ┌─────────┐
    │              │ success │
    │              └─────────┘
    │
    └─ error ────▶ ┌───────┐
                   │ error │
                   └───────┘
```

**State Transitions**:
- `idle` → `loading`: When fetch starts
- `loading` → `success`: When fetch completes successfully
- `loading` → `error`: When fetch fails
- `success` → `loading`: When refetch is triggered
- `error` → `loading`: When retry is triggered

**Invalid Transitions** (prevented by design):
- `loading` → `loading`: Prevented by `fetchInProgressRef`
- `success` → `error`: Must go through `loading` state
- `error` → `success`: Must go through `loading` state

### Content Item Validation Schema

```typescript
interface ContentItemSchema {
  claim_id: string;          // Required
  value: {                   // Required
    source: object;          // Required
    video?: object;          // Optional
    thumbnail?: object;      // Optional
  };
  tags: string[];            // Required, must be array
  title?: string;            // Optional
  thumbnail_url?: string;    // Optional
  video_urls?: object;       // Optional
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Video URL Extraction for All Content

*For any* content item returned from the Odysee API, the application should successfully extract valid video URLs either from direct URL fields or by generating CDN URLs as a fallback.

**Validates: Requirements 2.2**

### Property 2: Filter Tag Validation

*For any* category filter tag (comedy_movies, action_movies, romance_movies, etc.), all returned content items should contain that filter tag in their tags array.

**Validates: Requirements 3.2**

### Property 3: Loading State Resolution

*For any* fetch operation (successful or failed), the loading state should transition to false once the promise resolves, and should never remain true indefinitely.

**Validates: Requirements 3.4, 15.3**

### Property 4: Series Episode Grouping

*For any* set of series episodes with matching series identifiers, the `useSeriesGrouped` hook should group them under a single series container with correct season and episode organization.

**Validates: Requirements 4.2**

### Property 5: Collection ID Stability

*For any* stable set of tags and text parameters, the generated `collectionId` should remain constant across multiple renders of the same component instance.

**Validates: Requirements 7.2, 14.4**

### Property 6: Memory Manager Instance Stability

*For any* single invocation of the `useContent` hook, the Memory_Manager instance should remain the same object reference across all renders until the component unmounts.

**Validates: Requirements 7.4**

### Property 7: Fetch Deduplication

*For any* `collectionId`, only one fetch operation should be in progress at any given time, and subsequent fetch requests with the same `collectionId` should be ignored until the first completes.

**Validates: Requirements 7.6, 14.6**

### Property 8: Cache Storage and Retrieval Round Trip

*For any* content array stored in the Memory_Manager cache with a given `collectionId`, retrieving from the cache with the same `collectionId` should return an equivalent content array.

**Validates: Requirements 9.2**

### Property 9: Cache Bypass When Disabled

*For any* `useContent` hook invocation with `enableMemoryManagement: false`, no content should be stored in or retrieved from the Memory_Manager cache.

**Validates: Requirements 9.4**

### Property 10: Error Message Display

*For any* fetch operation that fails with an error, the application should set an error state containing a user-friendly message describing the failure reason.

**Validates: Requirements 10.2**

### Property 11: Retry Exponential Backoff

*For any* sequence of retry attempts, the delay between retries should increase exponentially (e.g., 1s, 2s, 4s), and the total number of retries should not exceed 3 attempts.

**Validates: Requirements 10.6**

### Property 12: Content Item Field Validation

*For any* content item returned from the API, the validation function should verify that required fields (claim_id, value, tags, value.source) exist and are of the correct type.

**Validates: Requirements 12.1**

### Property 13: Success State Transition

*For any* fetch operation that completes successfully, the status field should transition from 'loading' to 'success', and the content array should be populated with the fetched items.

**Validates: Requirements 15.1**

### Property 14: Error State Transition

*For any* fetch operation that fails with an error, the status field should transition from 'loading' to 'error', and the error object should be populated with failure details.

**Validates: Requirements 15.2**

## Error Handling

### Error Categories

1. **Network Errors**: API fetch failures, timeout errors, connection issues
2. **Validation Errors**: Malformed API responses, missing required fields
3. **State Errors**: Invalid state transitions, race conditions
4. **Rendering Errors**: Component crashes, infinite loops

### Error Handling Strategy

#### Network Errors

```typescript
try {
  const response = await invoke('fetch_by_tag', { tag, limit });
  // ... process response
} catch (error) {
  if (error.message.includes('timeout')) {
    setError({
      message: 'Request timed out. Please check your connection.',
      details: 'timeout',
      retryable: true
    });
  } else if (error.message.includes('offline')) {
    setError({
      message: 'No internet connection. Only downloaded content is available.',
      details: 'offline',
      retryable: false
    });
  } else {
    setError({
      message: 'Failed to fetch content. Please try again.',
      details: error,
      retryable: true
    });
  }
}
```

#### Validation Errors

```typescript
function validateAndFilterContent(items: any[]): ContentItem[] {
  return items.filter(item => {
    const validation = validateContentItem(item);
    if (!validation.valid) {
      if (isDev) {
        console.warn('[Validation] Invalid content item:', {
          errors: validation.errors,
          item: item.claim_id || 'unknown'
        });
      }
      return false;
    }
    return true;
  });
}
```

#### State Errors

```typescript
// Prevent invalid state transitions
function setStatus(newStatus: FetchStatus) {
  const validTransitions = {
    idle: ['loading'],
    loading: ['success', 'error'],
    success: ['loading'],
    error: ['loading']
  };
  
  if (!validTransitions[currentStatus].includes(newStatus)) {
    console.error('[State] Invalid transition:', {
      from: currentStatus,
      to: newStatus
    });
    return;
  }
  
  setStatusState(newStatus);
}
```

#### Rendering Errors

```typescript
// Error Boundary implementation
class PageErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    if (isDev) {
      console.error('[ErrorBoundary] Caught error:', {
        error,
        componentStack: errorInfo.componentStack
      });
    }
    
    // Log to error tracking service in production
    if (!isDev) {
      logErrorToService(error, errorInfo);
    }
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>Something went wrong</h2>
          <p>We're sorry, but this page encountered an error.</p>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

### Retry Logic with Exponential Backoff

```typescript
async function fetchWithRetry(
  fetchFn: () => Promise<any>,
  maxRetries: number = 3
): Promise<any> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        if (isDev) {
          console.log(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
```

## Testing Strategy

### Dual Testing Approach

The application requires both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

### Unit Testing Focus

Unit tests should focus on:
- Specific examples that demonstrate correct behavior (e.g., fetching hero_trailer content)
- Integration points between components (e.g., routing to new pages)
- Edge cases and error conditions (e.g., empty results, malformed data)
- UI interactions (e.g., clicking retry button)

### Property-Based Testing Focus

Property tests should focus on:
- Universal properties that hold for all inputs (e.g., all content items have required fields)
- State machine transitions (e.g., loading always resolves to success or error)
- Data transformations (e.g., series grouping preserves all episodes)
- Cache behavior (e.g., round-trip consistency)

### Property-Based Testing Configuration

**Library**: Use `fast-check` for TypeScript/JavaScript property-based testing

**Configuration**:
- Minimum 100 iterations per property test
- Each test must reference its design document property
- Tag format: `Feature: ui-data-fetching-fixes, Property {number}: {property_text}`

**Example Property Test**:

```typescript
import fc from 'fast-check';
import { describe, it, expect } from 'vitest';

describe('Feature: ui-data-fetching-fixes, Property 12: Content Item Field Validation', () => {
  it('should validate that all content items have required fields', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          claim_id: fc.string(),
          value: fc.record({
            source: fc.object(),
            video: fc.option(fc.object()),
          }),
          tags: fc.array(fc.string()),
          title: fc.option(fc.string()),
        })),
        (contentItems) => {
          const validated = validateAndFilterContent(contentItems);
          
          // All validated items should have required fields
          validated.forEach(item => {
            expect(item.claim_id).toBeDefined();
            expect(item.value).toBeDefined();
            expect(item.value.source).toBeDefined();
            expect(Array.isArray(item.tags)).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Test Coverage Requirements

1. **Hook Tests**: Test all content hooks (`useContent`, `useMovies`, `useSeries`, `useSitcoms`, `useKidsContent`)
2. **Page Tests**: Test all page components render without errors
3. **Routing Tests**: Test navigation to all routes including new `/sitcoms` and `/kids` routes
4. **State Machine Tests**: Test all valid state transitions
5. **Error Handling Tests**: Test all error scenarios
6. **Cache Tests**: Test Memory_Manager integration
7. **Validation Tests**: Test API response validation

### Development Mode Diagnostics

**Render Count Monitoring**:
```typescript
// Add to all page components
useRenderCount('PageName');
```

**State Transition Logging**:
```typescript
// Automatically logged in useContent hook
console.log('[useContent] State: idle → loading');
console.log('[useContent] State: loading → success', { itemCount: 10 });
```

**API Response Logging**:
```typescript
// Automatically logged in api.ts
console.log('[API] fetchByTag response:', { tag: 'movie', count: 50 });
```

**Validation Logging**:
```typescript
// Automatically logged when validation fails
console.warn('[Validation] Invalid content item:', {
  errors: ['Missing claim_id'],
  item: 'unknown'
});
```

## Implementation Notes

### Critical Fixes Priority

1. **Highest Priority**: Fix `useContent` hook dependencies (prevents infinite loops)
2. **High Priority**: Create missing page components (fixes routing)
3. **Medium Priority**: Add API response validation (prevents silent failures)
4. **Low Priority**: Add development diagnostics (helps debugging)

### React StrictMode Considerations

React StrictMode (enabled by default in Vite) intentionally double-invokes effects in development to help detect side effects. The `fetchInProgressRef` guard prevents duplicate fetches:

```typescript
const fetchInProgressRef = useRef(false);

const fetchContent = useCallback(async () => {
  if (fetchInProgressRef.current) {
    if (isDev) console.log('[useContent] Fetch already in progress, skipping');
    return;
  }
  
  fetchInProgressRef.current = true;
  try {
    // ... fetch logic
  } finally {
    fetchInProgressRef.current = false;
  }
}, [/* stable dependencies */]);
```

### Memory Manager Singleton Pattern

The Memory Manager should be a singleton per hook instance, not a global singleton:

```typescript
// CORRECT: Instance per hook
const memoryManager = useMemo(() => 
  enableMemoryManagement ? getMemoryManager() : null, 
  [enableMemoryManagement]
);

// INCORRECT: Global singleton (would share cache across all hooks)
const memoryManager = getMemoryManager();
```

### Status Field vs Boolean Flags

Using a single status field prevents race conditions:

```typescript
// CORRECT: Single source of truth
const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
const loading = status === 'loading';
const error = status === 'error' ? errorObject : null;

// INCORRECT: Multiple booleans can be inconsistent
const [loading, setLoading] = useState(false);
const [hasError, setHasError] = useState(false);
// What if both are true? What if both are false but we have data?
```

### Memoization Best Practices

1. **Primitive values**: Don't need memoization (strings, numbers, booleans)
2. **Object literals**: Always memoize with `useMemo`
3. **Array literals**: Always memoize with `useMemo`
4. **Functions**: Always memoize with `useCallback`
5. **Computed values**: Memoize with `useMemo` if expensive

```typescript
// Primitives - no memoization needed
const limit = 50;
const autoFetch = true;

// Objects - memoize
const options = useMemo(() => ({ limit, autoFetch }), [limit, autoFetch]);

// Arrays - memoize
const tags = useMemo(() => ['movie', 'comedy'], []);

// Functions - memoize
const handleClick = useCallback(() => { /* ... */ }, []);

// Computed values - memoize if expensive
const collectionId = useMemo(() => `content-${tags.join('-')}`, [tags]);
```


## Additional Design Considerations

### Retry Configuration

The retry logic should be configurable per fetch type to allow different strategies for different content:

```typescript
interface RetryConfig {
  maxRetries: number;
  initialDelay: number; // in milliseconds
  backoffMultiplier: number;
}

const RETRY_CONFIGS: Record<string, RetryConfig> = {
  hero: {
    maxRetries: 3,
    initialDelay: 1000,
    backoffMultiplier: 2
  },
  category: {
    maxRetries: 2,
    initialDelay: 500,
    backoffMultiplier: 2
  },
  search: {
    maxRetries: 1,
    initialDelay: 1000,
    backoffMultiplier: 1
  }
};

async function fetchWithRetry(
  fetchFn: () => Promise<any>,
  config: RetryConfig = RETRY_CONFIGS.category
): Promise<any> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      lastError = error;
      
      if (attempt < config.maxRetries) {
        const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
```

### Memory Manager Cross-Page Caching

The Memory Manager should support shared caching across page instances when the same `collectionId` is used:

**Design Decision**: Enable cross-page caching for better performance

**Rationale**: 
- If a user navigates from Home (which shows movies) to Movies page, the same movie data should be reused
- Reduces API calls and improves perceived performance
- Memory Manager already uses `collectionId` as the key, which is stable across pages

**Implementation**: No changes needed - current design already supports this

**Cache Invalidation Strategy**:
- Cache entries expire after 5 minutes
- Manual refresh (pull-to-refresh or refresh button) clears cache for that `collectionId`
- App restart clears all cache

### Accessibility Enhancements

All interactive elements and content cards should include proper ARIA attributes:

```typescript
// Content Card
<div 
  role="article"
  aria-label={`${content.title} - ${content.duration} minutes`}
  className="content-card"
>
  <button
    onClick={() => onPlay(content)}
    aria-label={`Play ${content.title}`}
    className="play-button"
  >
    <Play aria-hidden="true" />
  </button>
  
  <button
    onClick={() => onFavorite(content)}
    aria-label={isFavorite ? `Remove ${content.title} from favorites` : `Add ${content.title} to favorites`}
    aria-pressed={isFavorite}
    className="favorite-button"
  >
    <Heart aria-hidden="true" />
  </button>
</div>

// Error Message
<div 
  role="alert"
  aria-live="assertive"
  className="error-message"
>
  {error.message}
</div>

// Loading State
<div 
  role="status"
  aria-live="polite"
  aria-busy="true"
  className="loading-state"
>
  <span className="sr-only">Loading content...</span>
  {/* Skeleton loaders */}
</div>

// Empty State
<div 
  role="status"
  aria-live="polite"
  className="empty-state"
>
  <p>No content available</p>
</div>
```

### Skeleton Loader Standardization

Create a unified `SkeletonCard` component to ensure consistent loading states across all pages:

**File**: `src/components/SkeletonCard.tsx`

```typescript
interface SkeletonCardProps {
  size?: 'small' | 'medium' | 'large';
  count?: number;
}

export function SkeletonCard({ size = 'medium', count = 1 }: SkeletonCardProps) {
  const sizeClasses = {
    small: 'h-48',
    medium: 'h-64',
    large: 'h-80'
  };
  
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div 
          key={index}
          className={`loading-skeleton ${sizeClasses[size]} rounded-xl`}
          role="status"
          aria-label="Loading content"
        >
          <span className="sr-only">Loading...</span>
        </div>
      ))}
    </>
  );
}

// Usage in pages
{loading && <SkeletonCard count={12} />}
```

### Offline Content Fallback Strategy

When the user goes offline, the application should automatically display cached content:

**Behavior**:
1. **Detect Offline**: Use `useOffline` hook to detect network status
2. **Check Cache**: Query Memory_Manager for cached content with the current `collectionId`
3. **Display Cached Content**: If cache exists, display it with an offline indicator
4. **Show Empty State**: If no cache exists, show offline empty state with helpful message

**Implementation in useContent**:

```typescript
const fetchContent = useCallback(async (pageNum: number = 1, append: boolean = false) => {
  // If offline, try to use cached content
  if (!isOnline && !offlineOnly) {
    if (memoryManager) {
      const cachedContent = memoryManager.getCollection(collectionId);
      if (cachedContent && cachedContent.length > 0) {
        setContent(cachedContent);
        setStatus('success');
        setError({
          message: 'Showing cached content (offline)',
          details: 'offline',
        });
        if (isDev) console.log('[useContent] Using cached content while offline');
        return;
      }
    }
    
    // No cache available
    const apiError: ApiError = {
      message: 'No internet connection. Only downloaded content is available.',
      details: 'offline',
    };
    setError(apiError);
    setStatus('error');
    return;
  }
  
  // ... rest of fetch logic
}, [/* dependencies */]);
```

**UI Indicator**:

```typescript
{error?.details === 'offline' && content.length > 0 && (
  <div className="offline-cache-indicator" role="status">
    <WifiOff className="w-4 h-4" />
    <span>Showing cached content (offline)</span>
  </div>
)}
```

### Performance Monitoring

Add performance metrics to track fetch times and render performance:

```typescript
const fetchContent = useCallback(async (pageNum: number = 1, append: boolean = false) => {
  const startTime = performance.now();
  
  try {
    // ... fetch logic
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (isDev) {
      console.log('[Performance] Fetch completed:', {
        collectionId,
        duration: `${duration.toFixed(2)}ms`,
        itemCount: results.length
      });
      
      if (duration > 3000) {
        console.warn('[Performance] Slow fetch detected:', {
          collectionId,
          duration: `${duration.toFixed(2)}ms`
        });
      }
    }
  } catch (error) {
    // ... error handling
  }
}, [/* dependencies */]);
```
