# Implementation Plan: UI and Data-Fetching Fixes

## Overview

This implementation plan addresses critical UI glitching and data-fetching failures in the Kiyya Desktop streaming application. The fixes are organized into incremental steps that build upon each other, starting with the root cause (unstable hook dependencies) and progressing through page creation, validation, and diagnostics.

## Tasks

- [x] 1. Fix useContent Hook Dependencies and State Management
  - **Depends on**: None (foundational task)
  - [x] 1.1 Refactor useContent hook to use stable dependencies
    - Add `useMemo` for `collectionId` generation
    - Add `useMemo` for `memoryManager` instance
    - Add `useRef` for `fetchInProgressRef` to prevent duplicate fetches
    - Replace `loading` boolean with `status` field ('idle' | 'loading' | 'success' | 'error')
    - Update `fetchContent` callback to use only stable dependencies
    - _Requirements: 7.1, 7.2, 7.4, 7.6, 14.1, 14.2, 14.4, 14.6, 15.5_
  
  - [x] 1.2 Write property test for collectionId stability
    - **Property 5: Collection ID Stability**
    - **Validates: Requirements 7.2, 14.4**
  
  - [x] 1.3 Write property test for Memory Manager instance stability
    - **Property 6: Memory Manager Instance Stability**
    - **Validates: Requirements 7.4**
  
  - [x] 1.4 Write property test for fetch deduplication
    - **Property 7: Fetch Deduplication**
    - **Validates: Requirements 7.6, 14.6**

- [x] 2. Add Development Mode Diagnostics to useContent Hook
  - **Depends on**: Task 1 (requires refactored hook)
  - [x] 2.1 Add state transition logging
    - Log state changes (idle → loading → success/error)
    - Log fetch parameters (collectionId, pageNum, append)
    - Log fetch results (item count, duration)
    - Disable logging in production mode
    - _Requirements: 11.1, 11.2, 11.3, 11.5, 11.6_
  
  - [x] 2.2 Create useRenderCount hook for debugging
    - Create `src/hooks/useRenderCount.ts`
    - Track render count per component
    - Log warning when render count exceeds 10
    - Only active in development mode
    - _Requirements: 11.4_
  
  - [x] 2.3 Write unit tests for diagnostic logging
    - Test that logs are produced in development mode
    - Test that logs are disabled in production mode
    - _Requirements: 11.6_

- [x] 3. Implement API Response Validation
  - **Depends on**: None (independent task)
  - [x] 3.1 Create validation utilities
    - Create `validateContentItem` function in `src/lib/api.ts`
    - Validate required fields (claim_id, value, tags, value.source)
    - Return validation result with errors array
    - _Requirements: 12.1, 12.2_
  
  - [x] 3.2 Integrate validation into fetch functions
    - Update `fetchByTag` to validate and filter content
    - Update `fetchByTags` to validate and filter content
    - Update `fetchChannelClaims` to validate and filter content
    - Log validation errors in development mode
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  
  - [x] 3.3 Write property test for content item validation
    - **Property 12: Content Item Field Validation**
    - **Validates: Requirements 12.1**
  
  - [x] 3.4 Write unit tests for validation edge cases
    - Test handling of undefined tags array
    - Test handling of malformed data structures
    - Test graceful failure for invalid responses
    - _Requirements: 12.3, 12.4_

- [x] 4. Checkpoint - Verify Hook Stability
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create SitcomsPage Component
  - **Depends on**: Task 1 (requires stable hooks)
  - [x] 5.1 Create SitcomsPage component file
    - Create `src/pages/SitcomsPage.tsx`
    - Mirror structure of `MoviesPage.tsx`
    - Use `useSitcoms()` hook for data fetching
    - Implement grid/list view toggle
    - Implement pagination with "Load More"
    - Add offline state handling
    - Add favorites integration
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 8.1, 8.3, 8.5_
  
  - [x] 5.2 Add route for SitcomsPage
    - Update `src/App.tsx` to add `/sitcoms` route
    - Wrap route with ErrorBoundary
    - _Requirements: 5.1, 5.2, 8.3_
  
  - [x] 5.3 Write unit tests for SitcomsPage
    - Test page renders without errors
    - Test navigation to `/sitcoms` route
    - Test content fetching with `sitcom` tag
    - Test grid layout rendering
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 6. Create KidsPage Component
  - **Depends on**: Task 1 (requires stable hooks)
  - [x] 6.1 Create KidsPage component file
    - Create `src/pages/KidsPage.tsx`
    - Mirror structure of `MoviesPage.tsx`
    - Use `useKidsContent()` hook for data fetching
    - Implement category filters (comedy_kids, action_kids)
    - Implement grid/list view toggle
    - Implement pagination with "Load More"
    - Add offline state handling
    - Add favorites integration
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.2, 8.3, 8.5_
  
  - [x] 6.2 Add route for KidsPage
    - Update `src/App.tsx` to add `/kids` route
    - Wrap route with ErrorBoundary
    - _Requirements: 6.1, 6.2, 8.3_
  
  - [x] 6.3 Write unit tests for KidsPage
    - Test page renders without errors (no black screen)
    - Test navigation to `/kids` route
    - Test content fetching with `kids` tag
    - Test filter functionality
    - Test empty state display
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [-] 7. Implement State Machine for Fetch Status
  - **Depends on**: Task 1 (modifies useContent hook)
  - [x] 7.1 Update useContent hook to use status field
    - Replace `loading` boolean with `status` state
    - Implement state transition validation
    - Update return type to include `status` field
    - Ensure backward compatibility by deriving `loading` from `status`
    - _Requirements: 15.1, 15.2, 15.3, 15.5_
  
  - [ ]* 7.2 Write property test for success state transition
    - **Property 13: Success State Transition**
    - **Validates: Requirements 15.1**
  
  - [ ]* 7.3 Write property test for error state transition
    - **Property 14: Error State Transition**
    - **Validates: Requirements 15.2**
  
  - [ ]* 7.4 Write property test for loading state resolution
    - **Property 3: Loading State Resolution**
    - **Validates: Requirements 3.4, 15.3**

- [ ] 8. Implement Retry Logic with Exponential Backoff
  - **Depends on**: Task 1 (stable hooks), Task 3 (API validation)
  - [ ] 8.1 Create retry utility function
    - Create `fetchWithRetry` function in `src/lib/api.ts`
    - Implement exponential backoff (1s, 2s, 4s)
    - Limit to maximum 3 retry attempts
    - Make retry config parameterizable
    - _Requirements: 10.5, 10.6_
  
  - [ ] 8.2 Integrate retry logic into fetch functions
    - Wrap API calls with `fetchWithRetry`
    - Use appropriate retry config per fetch type
    - _Requirements: 10.5, 10.6_
  
  - [ ]* 8.3 Write property test for retry backoff
    - **Property 11: Retry Exponential Backoff**
    - **Validates: Requirements 10.6**
  
  - [ ]* 8.4 Write unit tests for retry functionality
    - Test retry button triggers refetch
    - Test max retry limit
    - _Requirements: 10.5_
  
  - [ ]* 8.5 Write unit tests for parameterized retry config
    - Test different retry delays
    - Test different max retry counts
    - Test different backoff multipliers
    - _Requirements: 10.6_

- [ ] 9. Checkpoint - Verify Page Components and Error Handling
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Improve Error Handling and User Feedback
  - **Depends on**: Task 1, Task 7 (requires stable hooks and status field)
  - [ ] 10.1 Enhance error messages
    - Update error handling in useContent hook
    - Provide user-friendly error messages
    - Include retry option for retryable errors
    - _Requirements: 10.2, 10.3, 10.4, 10.5_
  
  - [ ] 10.2 Add offline content fallback
    - Check Memory_Manager cache when offline
    - Display cached content with offline indicator
    - Show offline empty state if no cache available
    - _Requirements: 10.3_
  
  - [ ]* 10.3 Write property test for error message display
    - **Property 10: Error Message Display**
    - **Validates: Requirements 10.2**
  
  - [ ]* 10.4 Write unit tests for offline handling
    - Test offline indicator display
    - Test cached content display when offline
    - Test empty state when no cache available
    - _Requirements: 10.3, 10.4_

- [ ] 11. Implement Cache Management Improvements
  - **Depends on**: Task 1 (modifies useContent hook)
  - [ ] 11.1 Add cache bypass option
    - Ensure `enableMemoryManagement: false` skips cache operations
    - Test cache is not used when disabled
    - _Requirements: 9.4_
  
  - [ ] 11.2 Implement cache expiration
    - Add timestamp to cached entries
    - Expire cache after 5 minutes
    - Clear expired entries during idle time
    - _Requirements: 9.2_
  
  - [ ]* 11.3 Write property test for cache round trip
    - **Property 8: Cache Storage and Retrieval Round Trip**
    - **Validates: Requirements 9.2**
  
  - [ ]* 11.4 Write property test for cache bypass
    - **Property 9: Cache Bypass When Disabled**
    - **Validates: Requirements 9.4**

- [ ] 12. Add Accessibility Enhancements (MVP-CRITICAL)
  - **Depends on**: Task 5, Task 6 (requires page components)
  - [ ] 12.1 Add ARIA attributes to content cards
    - Add `role="article"` to content cards
    - Add `aria-label` with content title and duration
    - Add `aria-label` to action buttons
    - Add `aria-pressed` to favorite buttons
    - _Requirements: Design - Accessibility Enhancements_
  
  - [ ] 12.2 Add ARIA attributes to loading and error states
    - Add `role="status"` and `aria-live="polite"` to loading states
    - Add `role="alert"` and `aria-live="assertive"` to error messages
    - Add `aria-busy="true"` during loading
    - Add screen reader text for loading indicators
    - _Requirements: Design - Accessibility Enhancements_
  
  - [ ] 12.3 Create standardized SkeletonCard component
    - Audit existing custom skeleton loaders across all pages
    - Document current skeleton loader patterns
    - Create `src/components/SkeletonCard.tsx`
    - Support size variants (small, medium, large)
    - Support count prop for multiple skeletons
    - Add proper ARIA attributes
    - _Requirements: Design - Skeleton Loader Standardization_
  
  - [ ] 12.4 Update all pages to use SkeletonCard
    - Replace custom skeleton loaders in Home page
    - Replace custom skeleton loaders in Movies page
    - Replace custom skeleton loaders in Series page
    - Replace custom skeleton loaders in Sitcoms page
    - Replace custom skeleton loaders in Kids page
    - Ensure consistent loading experience
    - _Requirements: Design - Skeleton Loader Standardization_

- [ ] 13. Add Property-Based Tests for Core Properties (OPTIONAL)
  - **Depends on**: Task 1, Task 3 (requires stable hooks and validation)
  - [ ]* 13.1 Write property test for video URL extraction
    - **Property 1: Video URL Extraction for All Content**
    - **Validates: Requirements 2.2**
  
  - [ ]* 13.2 Write property test for filter tag validation
    - **Property 2: Filter Tag Validation**
    - **Validates: Requirements 3.2**
  
  - [ ]* 13.3 Write property test for series grouping
    - **Property 4: Series Episode Grouping**
    - **Validates: Requirements 4.2**

- [ ] 14. Add Integration Tests for Critical Flows (OPTIONAL)
  - **Depends on**: Task 1, Task 5, Task 6 (requires all components)
  - [ ]* 14.1 Write integration test for Home page rendering
    - Test Hero section loads without glitching
    - Test all content rows render
    - Test no infinite re-render loops
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 2.1, 2.3, 2.5_
  
  - [ ]* 14.2 Write integration test for Movies page filtering
    - Test navigation to Movies page
    - Test category filter application
    - Test content grid rendering
    - Test loading state resolution
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [ ]* 14.3 Write integration test for Series page grouping
    - Test navigation to Series page
    - Test series grouping logic
    - Test series card rendering
    - Test skeleton loader resolution
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [ ]* 14.4 Write integration test for new page routes
    - Test navigation to Sitcoms page
    - Test navigation to Kids page
    - Test content fetching on both pages
    - Test no black screen or routing errors
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4_

- [ ] 15. Add Performance Monitoring (OPTIONAL)
  - **Depends on**: Task 1, Task 2 (requires refactored hooks and diagnostics)
  - [ ] 15.1 Add fetch performance tracking
    - Track fetch duration in development mode
    - Log slow fetches (>3 seconds)
    - Include collectionId and item count in logs
    - Track cache hit/miss rates
    - Log memory usage statistics
    - _Requirements: Design - Performance Monitoring_
  
  - [ ] 15.2 Add render performance tracking
    - Use useRenderCount in all page components
    - Log excessive re-renders (>10)
    - _Requirements: 11.4_

- [ ] 16. Final Checkpoint - Comprehensive Testing
  - Ensure all MVP-critical tests pass:
    - All unit tests for Tasks 1-12
    - All validation tests for API responses
    - All page rendering tests
    - All routing tests
  - Verify no infinite re-render loops
  - Verify all pages load without glitching
  - Ask the user if questions arise.

## Notes

- **Optional Task Markers**:
  - `*` prefix = Optional property-based or integration test (can be skipped for faster MVP)
  - `(OPTIONAL)` in title = Enhancement task that can be deferred to post-MVP
  - `(MVP-CRITICAL)` in title = Must be completed for MVP release
- Task dependencies are explicitly noted to help with parallel development
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
- The implementation prioritizes fixing the root cause (hook dependencies) before adding new features
- Development diagnostics are added throughout to help identify any remaining issues
- Accessibility enhancements are MVP-critical to ensure the application is usable by all users

## Task Dependency Diagram

```
Task 1 (Fix Hooks) ─┬─→ Task 2 (Diagnostics)
                    ├─→ Task 5 (SitcomsPage)
                    ├─→ Task 6 (KidsPage)
                    ├─→ Task 7 (State Machine)
                    ├─→ Task 8 (Retry Logic) ←─── Task 3 (Validation)
                    ├─→ Task 10 (Error Handling) ←─ Task 7
                    ├─→ Task 11 (Cache)
                    ├─→ Task 13 (Property Tests) ←─ Task 3
                    ├─→ Task 14 (Integration Tests) ←─ Task 5, Task 6
                    └─→ Task 15 (Performance) ←─── Task 2

Task 5, Task 6 ─→ Task 12 (Accessibility)

Critical Path (MVP): Task 1 → Task 5 → Task 6 → Task 12 → Task 16
```
