# Workflow Tests Documentation

## Overview

This document describes the complete user workflow tests implemented for the Kiyya desktop streaming application. These tests verify end-to-end user journeys through the application, ensuring that all components work together correctly.

## Test Categories

### 1. End-to-End Workflow Tests (`tests/e2e/workflows.spec.ts`)

These tests use Playwright to verify complete user workflows in a browser environment.

#### Content Discovery to Playback Workflow
**Test**: `should complete full workflow from home to video playback`

**Steps**:
1. Navigate to home page
2. Verify hero section loads
3. Navigate to Movies category
4. Verify movies page loads with content
5. Click on first movie card
6. Verify navigation to movie detail page
7. Verify movie detail page elements
8. Find and click play button
9. Verify player modal opens
10. Verify video player controls
11. Verify close button exists
12. Close player
13. Verify player closed

**Validates**: Requirements 1, 3, 9, 15

#### Search to Content Discovery Workflow
**Test**: `should complete search workflow from query to results`

**Steps**:
1. Navigate to home page
2. Open search
3. Verify search input appears
4. Enter search query
5. Submit search
6. Verify navigation to search results
7. Verify search page displays
8. Check for search results or empty state

**Validates**: Requirements 5, 9, 15

#### Favorites Management Workflow
**Test**: `should complete favorites workflow from adding to viewing`

**Steps**:
1. Navigate to home page
2. Find hero favorite button
3. Get initial button state
4. Click favorite button
5. Verify button state changed
6. Navigate to favorites page
7. Verify favorites page loads
8. Check for favorites content or empty state

**Validates**: Requirements 7, 9, 15

#### Download and Offline Playback Workflow
**Test**: `should complete download workflow from initiation to offline playback`

**Steps**:
1. Navigate to home page
2. Navigate to movies page
3. Find movie card with download button
4. Click on movie to go to detail page
5. Find download button
6. Click download button
7. Navigate to downloads page
8. Verify downloads page loads
9. Check for active downloads tab
10. Switch to offline content tab
11. Check for offline content or empty state

**Validates**: Requirements 4, 7, 9, 15

#### Settings and Theme Management Workflow
**Test**: `should complete settings workflow including theme change`

**Steps**:
1. Navigate to home page
2. Navigate to settings page
3. Verify settings page loads
4. Check current theme
5. Find theme toggle buttons
6. Click opposite theme button
7. Verify theme changed
8. Navigate back to home
9. Verify home page loads

**Validates**: Requirements 9, 12, 15

#### Category Navigation and Filtering Workflow
**Test**: `should complete category navigation workflow with filters`

**Steps**:
1. Navigate to home page
2. Open Movies dropdown
3. Verify dropdown menu appears
4. Check for filter options
5. Click on a filter if available
6. Verify URL contains filter parameter
7. Verify filtered content page loads
8. Verify content loads or empty state

**Validates**: Requirements 1, 9, 15

#### Keyboard Navigation Workflow
**Test**: `should complete keyboard navigation workflow`

**Steps**:
1. Navigate to home page
2. Start keyboard navigation with Tab
3. Verify focus is visible
4. Continue tabbing through elements
5. Test Escape key
6. Test Enter key on focused element

**Validates**: Requirements 9, 15

#### Error Recovery Workflow
**Test**: `should handle network errors and retry`

**Steps**:
1. Set up network failure for first request
2. Navigate to home page
3. Check for error state or successful load
4. If error, try retry
5. Verify recovery

**Validates**: Requirements 6, 11, 15

#### Accessibility with Screen Reader Workflow
**Test**: `should provide accessible navigation for screen readers`

**Steps**:
1. Navigate to home page
2. Verify ARIA labels on navigation elements
3. Verify heading hierarchy
4. Verify interactive elements have proper roles
5. Verify links have proper roles

**Validates**: Requirements 9, 15

#### Reduced Motion Preferences Workflow
**Test**: `should respect reduced motion preferences throughout app`

**Steps**:
1. Set reduced motion preference
2. Navigate to home page
3. Verify hero section loads without animations
4. Verify content is immediately visible
5. Verify action buttons are immediately visible
6. Navigate to different pages
7. Verify page transitions work without animations
8. Navigate back to home
9. Verify home page loads without animations

**Validates**: Requirements 9, 10, 15

#### Multi-Page Navigation Flow Workflow
**Test**: `should complete multi-page navigation maintaining state`

**Steps**:
1. Start at home page
2. Get hero title (for state verification)
3. Navigate to Movies
4. Navigate to Series
5. Navigate to Favorites
6. Navigate to Downloads
7. Navigate to Settings
8. Navigate back to Home
9. Verify hero state persisted (session persistence)
10. Verify navigation still works

**Validates**: Requirements 1, 7, 9, 10, 15

### 2. Unit Workflow Integration Tests (`tests/unit/workflow-integration.test.tsx`)

These tests verify integration between components using mocked Tauri API calls.

#### Content Discovery Flow Integration
**Test**: `should integrate NavBar navigation with content pages`

**Validates**: Integration between NavBar component and content fetching

#### Search to Results Flow Integration
**Test**: `should integrate search input with results display`

**Validates**: Integration between search input and results rendering

#### Favorites Management Flow Integration
**Test**: `should integrate favorite button with favorites storage`

**Validates**: Integration between favorite buttons and SQLite storage

#### Download to Offline Playback Flow Integration
**Test**: `should integrate download initiation with progress tracking`

**Validates**: Integration between download commands and progress events

#### Quality Selection Flow Integration
**Test**: `should integrate quality selector with video player`

**Validates**: Integration between quality selector UI and video source changes

#### Theme Management Flow Integration
**Test**: `should integrate theme toggle with persistent storage`

**Validates**: Integration between theme toggle and app config storage

#### Error Recovery Flow Integration
**Test**: `should integrate error handling with retry mechanisms`

**Validates**: Integration between error detection and retry logic

#### Keyboard Navigation Flow Integration
**Test**: `should integrate keyboard events with focus management`

**Validates**: Integration between keyboard events and focus state

#### Series Navigation Flow Integration
**Test**: `should integrate season expansion with episode display`

**Validates**: Integration between season UI and episode data

#### Update Check Flow Integration
**Test**: `should integrate update check with version comparison`

**Validates**: Integration between manifest fetching and version comparison

#### Offline Mode Flow Integration
**Test**: `should integrate offline detection with content availability`

**Validates**: Integration between offline detection and content filtering

#### Progress Tracking Flow Integration
**Test**: `should integrate playback progress with resume functionality`

**Validates**: Integration between progress saving and resume logic

#### Category Filtering Flow Integration
**Test**: `should integrate category selection with filtered content display`

**Validates**: Integration between category filters and content fetching

#### Related Content Flow Integration
**Test**: `should integrate content detail with related recommendations`

**Validates**: Integration between content detail and related content fetching

## Running the Tests

### Run All Workflow Tests
```bash
npm run test:all
```

### Run E2E Workflow Tests Only
```bash
npm run test:e2e -- tests/e2e/workflows.spec.ts
```

### Run Unit Workflow Integration Tests Only
```bash
npm test -- tests/unit/workflow-integration.test.tsx --run
```

### Run Specific Workflow Test
```bash
npm run test:e2e -- tests/e2e/workflows.spec.ts -g "Content Discovery to Playback"
```

## Test Environment Requirements

### E2E Tests
- Require the application to be running (either dev or preview mode)
- Use Playwright for browser automation
- Can run in headless or headed mode
- Support multiple browsers (Chromium, Firefox, WebKit)

### Unit Integration Tests
- Run in Node.js environment with jsdom
- Use Vitest as test runner
- Mock Tauri API calls
- Fast execution (no browser required)

## Test Data

All tests use deterministic test data where possible:
- Mocked API responses for predictable behavior
- Fixed content IDs and titles
- Controlled timing for animations and transitions
- Consistent theme and settings

## Coverage

These workflow tests provide coverage for:
- ✅ Complete user journeys from start to finish
- ✅ Integration between multiple components
- ✅ State management across navigation
- ✅ Error handling and recovery
- ✅ Accessibility features
- ✅ Keyboard navigation
- ✅ Theme management
- ✅ Offline functionality
- ✅ Download workflows
- ✅ Search functionality
- ✅ Favorites management
- ✅ Video playback
- ✅ Quality selection
- ✅ Series navigation
- ✅ Category filtering

## Maintenance

When adding new features:
1. Add corresponding workflow tests
2. Update this documentation
3. Ensure tests are deterministic
4. Mock external dependencies
5. Verify tests pass in CI/CD

## CI/CD Integration

These tests are integrated into the CI/CD pipeline:
- Unit workflow tests run on every commit
- E2E workflow tests run on pull requests
- All tests must pass before merge
- Coverage reports are generated automatically

## Known Limitations

1. **E2E Tests**: Some tests may be skipped in CI if they require specific environment setup
2. **Browser Compatibility**: E2E tests primarily target Chromium in CI
3. **Timing**: Some tests use timeouts for animations - may need adjustment for slower systems
4. **Mocking**: Unit tests mock Tauri API - may not catch all integration issues

## Future Improvements

- [ ] Add visual regression testing for workflows
- [ ] Implement performance benchmarks for workflows
- [ ] Add more edge case scenarios
- [ ] Improve test data generation
- [ ] Add workflow tests for error scenarios
- [ ] Implement workflow tests for update scenarios
- [ ] Add workflow tests for emergency disable scenarios
