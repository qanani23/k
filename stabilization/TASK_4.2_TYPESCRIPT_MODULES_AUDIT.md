# Task 4.2: TypeScript Modules Audit Report

**Date:** 2026-02-22  
**Task:** Audit TypeScript modules for unused functions, types, imports, and dead modules  
**Requirements:** 1.1, 1.3, 1.4

## Executive Summary

Comprehensive audit of TypeScript modules completed using ESLint analysis. Found **48 errors** and **449 warnings** across the codebase. The audit identified unused variables, unused imports, unused functions, and code quality issues.

## Methodology

1. **ESLint Analysis:** Ran `npx eslint . --ext ts,tsx` to identify unused code
2. **Export Analysis:** Searched for all exported functions, types, and interfaces
3. **Import Analysis:** Cross-referenced exports with imports to identify unused exports
4. **Manual Review:** Reviewed specific modules for dead code patterns

## Key Findings Summary

### Critical Issues (Errors - 48 total)

#### Unused Variables and Parameters
- **src/components/PlayerModal.refactored.tsx:**
  - Line 136: `currentTime` defined but never used
  - Line 139: `buffered` defined but never used
  - Line 193: `handleBuffering` assigned but never used

- **src/hooks/useContent.ts:**
  - Line 603: `seriesKey` assigned but never used

- **src/i18n/index.ts:**
  - Line 82: `variables` parameter defined but never used

- **src/lib/idle.ts:**
  - Line 31: `IdleCallback` type defined but never used
  - Line 52: `deadline` parameter defined but never used

- **src/lib/memoryManager.ts:**
  - Line 200: `now` variable assigned but never used

- **src/lib/player/PlayerAdapter.ts:**
  - Line 156: `url` parameter defined but never used
  - Line 156: `type` parameter defined but never used
  - Line 173: `oldQuality` assigned but never used
  - Line 289: `url` parameter defined but never used
  - Line 289: `type` parameter defined but never used
  - Line 293: `qualities` parameter defined but never used
  - Line 297: `quality` parameter defined but never used
  - Line 309: `time` parameter defined but never used

#### Test Files with Unused Imports/Variables
- **tests/e2e/app.spec.ts:** Line 182: `initialTitle` unused
- **tests/e2e/offline-functionality.spec.ts:** Line 12: `Page` import unused
- **tests/e2e/workflows.spec.ts:** Lines 134, 301: `initialText`, `hasRomance` unused
- **tests/integration/movies-page-filtering.test.tsx:** Lines 15, 231, 314, 334: Multiple unused variables
- **tests/integration/offline-functionality.test.ts:** Line 14: `waitFor` import unused
- **tests/integration/series-page-grouping.test.tsx:** Lines 17, 303: `Playlist`, `user` unused
- **tests/property/api.wrapper.property.test.ts:** Line 25: `channelIdArb` unused
- **tests/property/memoryManager.cacheRoundTrip.property.test.ts:** Line 1: `beforeEach` import unused
- **tests/property/series.grouping.property.test.ts:** Line 230: `series` unused
- **tests/property/useContent.errorMessageDisplay.property.test.ts:** Line 51: `limitArb` unused
- **tests/unit/DownloadsPage.test.tsx:** Line 2: `within` import unused
- **tests/unit/Home.test.tsx:** Line 379: `user` unused
- **tests/unit/MoviesPage.test.tsx:** Line 4: `BrowserRouter` import unused
- **tests/unit/Search.test.tsx:** Line 182: Unnecessary escape character
- **tests/unit/SeriesDetail.test.tsx:** Line 5: `SeriesInfo` import unused
- **tests/unit/SeriesPage.retry.test.tsx:** Line 194: `initialHTML` unused
- **tests/unit/aria-labels.test.tsx:** Lines 5-7: `DownloadsPage`, `FavoritesPage`, `SettingsPage` imports unused
- **tests/unit/codec.test.ts:** Line 7: `Hls` import unused
- **tests/unit/quality.test.ts:** Lines 317, 359: `currentQuality` should be const
- **tests/unit/series.ui.test.tsx:** Lines 281, 299: `_invalidSeason` unused
- **tests/unit/workflow-integration.test.tsx:** Lines 93, 157, 282: Multiple unused parameters

### Warnings (449 total)

#### Type Safety Issues (Most Common)
- **@typescript-eslint/no-explicit-any:** 300+ instances of `any` type usage
  - Affects: api.ts, errors.ts, hooks, components, test files
  - Recommendation: Replace with proper TypeScript types

#### React Hooks Issues
- **react-hooks/exhaustive-deps:** Missing dependencies in useEffect/useMemo/useCallback
  - src/App.tsx: Lines 117, 155
  - src/components/PlayerModal.tsx: Lines 299, 302, 336
  - src/components/RowCarousel.tsx: Line 93
  - src/hooks/useContent.ts: Lines 72, 82, 381

#### Code Quality Issues
- **@typescript-eslint/no-non-null-assertion:** 100+ instances of forbidden `!` operator
  - Affects: Multiple files including series.ts, PlayerModal.tsx, test files
  - Recommendation: Use proper null checks

- **@typescript-eslint/ban-ts-comment:** 2 instances of @ts-ignore instead of @ts-expect-error
  - src/test/setup.ts: Lines 20, 24

## Module-by-Module Analysis

### Source Modules (src/)

#### 1. **src/lib/idle.ts** - PARTIALLY UNUSED
**Status:** Has unused exports
- `IdleCallback` type: Defined but never used (Line 31)
- `deadline` parameter: Unused in callback (Line 52)
- **Recommendation:** Remove unused type, prefix unused parameter with `_`

#### 2. **src/lib/codec.ts** - ACTIVELY USED
**Status:** Used in PlayerModal.tsx
- Exports: `checkContentCompatibility`, `isHLSSupported`, `isMP4CodecSupported`
- **Recommendation:** Keep - actively used for video playback

#### 3. **src/lib/player/PlayerAdapter.ts** - HAS UNUSED PARAMETERS
**Status:** Active but has stub methods
- Multiple unused parameters in stub methods (Lines 156, 289, 293, 297, 309)
- `oldQuality` variable unused (Line 173)
- **Recommendation:** Prefix unused parameters with `_` or implement methods

#### 4. **src/lib/memoryManager.ts** - HAS UNUSED VARIABLE
**Status:** Active
- `now` variable assigned but never used (Line 200)
- **Recommendation:** Remove unused variable

#### 5. **src/hooks/useContent.ts** - HAS UNUSED VARIABLE
**Status:** Active
- `seriesKey` assigned but never used (Line 603)
- **Recommendation:** Remove or use the variable

#### 6. **src/i18n/index.ts** - HAS UNUSED PARAMETER
**Status:** Active
- `variables` parameter unused (Line 82)
- **Recommendation:** Prefix with `_` or implement functionality

#### 7. **src/components/PlayerModal.refactored.tsx** - HAS UNUSED CODE
**Status:** Refactored version with unused code
- `currentTime`, `buffered`, `handleBuffering` unused
- **Recommendation:** Remove unused code or complete implementation

### Type Definitions (src/types/index.ts)

**Status:** Comprehensive type definitions
- All types appear to be used throughout the application
- No dead type definitions identified
- **Recommendation:** Keep all types

### Configuration Modules

#### 1. **src/config/categories.ts** - FULLY USED
**Status:** Active
- All exports used in content filtering and categorization
- **Recommendation:** Keep all exports

### Test Files

**Status:** Multiple unused imports and variables
- Most issues are in test files (not production code)
- Common pattern: Imported but not used in specific tests
- **Recommendation:** Clean up test imports in Phase 2

## Dead Modules Analysis

### No Dead Modules Found

All TypeScript modules in `src/` are either:
1. Directly imported and used
2. Part of the type system
3. Configuration files actively referenced

**Modules Verified:**
- ✅ src/lib/api.ts - Used throughout app
- ✅ src/lib/codec.ts - Used in PlayerModal
- ✅ src/lib/errors.ts - Used for error handling
- ✅ src/lib/idle.ts - Used for idle task scheduling
- ✅ src/lib/images.ts - Used for image handling
- ✅ src/lib/memoryManager.ts - Used for caching
- ✅ src/lib/quality.ts - Used for quality selection
- ✅ src/lib/search.ts - Used in search functionality
- ✅ src/lib/semver.ts - Used for version comparison
- ✅ src/lib/series.ts - Used for series grouping
- ✅ src/lib/storage.ts - Used for local storage
- ✅ src/lib/player/PlayerAdapter.ts - Used in player components
- ✅ src/hooks/* - All hooks actively used
- ✅ src/components/* - All components actively used
- ✅ src/pages/* - All pages actively used
- ✅ src/types/index.ts - Type definitions used throughout
- ✅ src/config/categories.ts - Configuration actively used

## Unused Imports Summary

### Production Code (src/)
1. **src/lib/idle.ts:** `IdleCallback` type unused
2. **src/i18n/index.ts:** `variables` parameter unused
3. **src/lib/memoryManager.ts:** `now` variable unused
4. **src/hooks/useContent.ts:** `seriesKey` variable unused
5. **src/lib/player/PlayerAdapter.ts:** Multiple unused parameters
6. **src/components/PlayerModal.refactored.tsx:** Multiple unused variables

### Test Files (tests/)
- 30+ instances of unused imports/variables in test files
- Most are in e2e, integration, property, and unit test files
- Not critical for production but should be cleaned up

## Recommendations by Priority

### Priority 1: Fix Production Code Errors (Phase 2)
1. Remove unused variables in src/lib/memoryManager.ts
2. Remove unused variables in src/hooks/useContent.ts
3. Prefix unused parameters with `_` in src/lib/player/PlayerAdapter.ts
4. Fix or remove unused code in src/components/PlayerModal.refactored.tsx
5. Fix unused parameter in src/i18n/index.ts
6. Remove unused `IdleCallback` type in src/lib/idle.ts

### Priority 2: Improve Type Safety (Phase 2)
1. Replace 300+ instances of `any` with proper types
2. Add proper null checks instead of `!` operator
3. Fix React hooks dependency arrays

### Priority 3: Clean Up Test Files (Phase 2)
1. Remove unused imports in test files
2. Remove unused variables in test files
3. Fix prefer-const issues

### Priority 4: Code Quality (Phase 3)
1. Replace @ts-ignore with @ts-expect-error
2. Fix unnecessary escape characters
3. Improve function type definitions

## Phase 2 Cleanup Actions

### Safe to Delete (After Verification)
1. `IdleCallback` type in src/lib/idle.ts (if truly unused)
2. Unused variables in production code (6 instances)
3. Unused imports in test files (30+ instances)

### Requires Implementation or Removal
1. **src/components/PlayerModal.refactored.tsx:** Complete implementation or remove file
2. **src/lib/player/PlayerAdapter.ts:** Implement stub methods or document as intentional

### Requires Refactoring
1. Replace `any` types with proper TypeScript types (300+ instances)
2. Fix React hooks dependencies (10+ instances)
3. Replace non-null assertions with proper checks (100+ instances)

## Verification Commands

```bash
# Run ESLint to see all issues
npm run lint

# Run ESLint with auto-fix for simple issues
npm run lint:fix

# Check TypeScript compilation
npm run type-check

# Run tests to ensure nothing breaks
npm test
```

## Conclusion

The TypeScript codebase is generally well-structured with no dead modules. The main issues are:

1. **Unused variables/parameters:** 48 errors that should be fixed
2. **Type safety:** 300+ uses of `any` that should be replaced with proper types
3. **Code quality:** 100+ non-null assertions and React hooks issues

All modules are actively used. The cleanup effort should focus on:
- Removing unused variables and parameters
- Improving type safety
- Fixing React hooks dependencies
- Cleaning up test file imports

**Status:** ✅ Audit Complete - Ready for Phase 2 Cleanup
