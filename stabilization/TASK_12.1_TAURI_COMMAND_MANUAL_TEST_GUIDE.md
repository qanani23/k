# Task 12.1: Manual Tauri Command Testing Guide

## Overview

This document provides a comprehensive guide for manually testing all registered Tauri commands from the DevTools Console. Each command is listed with its parameters, expected behavior, and test instructions.

## Testing Environment

- **Application**: Kiyya Desktop
- **Test Method**: DevTools Console (F12 → Console tab)
- **Command Invocation**: `window.__TAURI__.invoke('command_name', { params })`

## Complete List of Registered Tauri Commands

Based on `src-tauri/src/main.rs` (lines 234-263), the following 29 commands are registered:

### Test/Diagnostic Commands (2)

1. **test_connection**
2. **build_cdn_playback_url_test**

### Content Discovery Commands (3)

3. **fetch_channel_claims**
4. **fetch_playlists**
5. **resolve_claim**

### Download Commands (3)

6. **download_movie_quality**
7. **stream_offline**
8. **delete_offline**

### Progress and State Commands (6)

9. **save_progress**
10. **get_progress**
11. **save_favorite**
12. **remove_favorite**
13. **get_favorites**
14. **is_favorite**

### Configuration and Diagnostics Commands (4)

15. **get_app_config**
16. **update_settings**
17. **get_diagnostics**
18. **collect_debug_package**

### Crash Reporting Commands (2)

19. **get_recent_crashes**
20. **clear_crash_log**

### Cache Management Commands (6)

21. **invalidate_cache_item**
22. **invalidate_cache_by_tags**
23. **clear_all_cache**
24. **cleanup_expired_cache**
25. **get_cache_stats**
26. **get_memory_stats**
27. **optimize_database_memory**

### External Commands (2)

28. **open_external**

---

## Detailed Testing Instructions

### 1. test_connection

**Purpose**: Verify Tauri IPC connectivity

**Parameters**: None

**Test Command**:
```javascript
window.__TAURI__.invoke('test_connection')
  .then(res => console.log('✅ test_connection:', res))
  .catch(err => console.error('❌ test_connection:', err));
```

**Expected Result**: `"tauri-backend-alive"`

**Pass Criteria**: 
- Returns string "tauri-backend-alive"
- No timeout
- No errors

---

### 2. build_cdn_playback_url_test

**Purpose**: Test CDN URL construction

**Parameters**: 
- `claim_id` (String): Claim identifier

**Test Command**:
```javascript
window.__TAURI__.invoke('build_cdn_playback_url_test', { 
  claimId: 'test-claim-123' 
})
  .then(res => console.log('✅ build_cdn_playback_url_test:', res))
  .catch(err => console.error('❌ build_cdn_playback_url_test:', err));
```

**Expected Result**: CDN URL string (e.g., `"https://cloud.odysee.live/content/test-claim-123/master.m3u8"`)

**Pass Criteria**:
- Returns valid HTTPS URL
- Contains claim_id in path
- Ends with "master.m3u8"
- No timeout

---

### 3. fetch_channel_claims

**Purpose**: Fetch content items from a channel

**Parameters**:
- `channelId` (String): Channel identifier (required)
- `anyTags` (Array<String>): Optional tags filter
- `text` (String): Optional text search
- `limit` (Number): Optional page size
- `page` (Number): Optional page number
- `forceRefresh` (Boolean): Optional cache bypass
- `streamTypes` (Array<String>): Optional stream type filter

**Test Command**:
```javascript
window.__TAURI__.invoke('fetch_channel_claims', { 
  channelId: '@kiyyamovies:b',
  limit: 10,
  page: 1
})
  .then(res => console.log('✅ fetch_channel_claims:', res))
  .catch(err => console.error('❌ fetch_channel_claims:', err));
```

**Expected Result**: Array of ContentItem objects

**Pass Criteria**:
- Returns array (may be empty)
- No timeout
- No errors
- Items have required fields (claim_id, title, etc.)

---

### 4. fetch_playlists

**Purpose**: Fetch playlists from a channel

**Parameters**:
- `channelId` (String): Channel identifier (required)

**Test Command**:
```javascript
window.__TAURI__.invoke('fetch_playlists', { 
  channelId: '@kiyyamovies:b'
})
  .then(res => console.log('✅ fetch_playlists:', res))
  .catch(err => console.error('❌ fetch_playlists:', err));
```

**Expected Result**: Array of Playlist objects

**Pass Criteria**:
- Returns array (may be empty)
- No timeout
- No errors

---

### 5. resolve_claim

**Purpose**: Resolve a specific claim by ID or URI

**Parameters**:
- `claimIdOrUri` (String): Claim ID or URI (required)

**Test Command**:
```javascript
window.__TAURI__.invoke('resolve_claim', { 
  claimIdOrUri: 'test-claim-id'
})
  .then(res => console.log('✅ resolve_claim:', res))
  .catch(err => console.error('❌ resolve_claim:', err));
```

**Expected Result**: ContentItem object

**Pass Criteria**:
- Returns ContentItem object
- No timeout
- Handles invalid claim_id gracefully

---

### 6. download_movie_quality

**Purpose**: Download content at specified quality

**Parameters**:
- `claimId` (String): Claim identifier (required)
- `quality` (String): Quality level (required)
- `url` (String): Download URL (required)

**Test Command**:
```javascript
// Note: This requires valid download URL and will actually start a download
// Test with caution or use mock data
window.__TAURI__.invoke('download_movie_quality', { 
  claimId: 'test-claim',
  quality: '720p',
  url: 'https://example.com/test.mp4'
})
  .then(res => console.log('✅ download_movie_quality:', res))
  .catch(err => console.error('❌ download_movie_quality:', err));
```

**Expected Result**: Success (undefined) or error

**Pass Criteria**:
- Command completes without hanging
- Validation errors are clear
- No timeout

---

### 7. stream_offline

**Purpose**: Start streaming offline content

**Parameters**:
- `claimId` (String): Claim identifier (required)
- `quality` (String): Quality level (required)

**Test Command**:
```javascript
window.__TAURI__.invoke('stream_offline', { 
  claimId: 'test-claim',
  quality: '720p'
})
  .then(res => console.log('✅ stream_offline:', res))
  .catch(err => console.error('❌ stream_offline:', err));
```

**Expected Result**: StreamOfflineResponse with URL and port

**Pass Criteria**:
- Returns object with url and port
- Or returns clear error if content not found
- No timeout

---

### 8. delete_offline

**Purpose**: Delete offline content

**Parameters**:
- `claimId` (String): Claim identifier (required)
- `quality` (String): Quality level (required)

**Test Command**:
```javascript
window.__TAURI__.invoke('delete_offline', { 
  claimId: 'test-claim',
  quality: '720p'
})
  .then(res => console.log('✅ delete_offline:', res))
  .catch(err => console.error('❌ delete_offline:', err));
```

**Expected Result**: Success (undefined) or error

**Pass Criteria**:
- Command completes
- Handles non-existent content gracefully
- No timeout

---

### 9. save_progress

**Purpose**: Save playback progress

**Parameters**:
- `claimId` (String): Claim identifier (required)
- `positionSeconds` (Number): Playback position (required)
- `quality` (String): Quality level (required)

**Test Command**:
```javascript
window.__TAURI__.invoke('save_progress', { 
  claimId: 'test-claim',
  positionSeconds: 120,
  quality: '720p'
})
  .then(res => console.log('✅ save_progress:', res))
  .catch(err => console.error('❌ save_progress:', err));
```

**Expected Result**: Success (undefined)

**Pass Criteria**:
- Command completes
- No timeout
- No errors

---

### 10. get_progress

**Purpose**: Retrieve playback progress

**Parameters**:
- `claimId` (String): Claim identifier (required)

**Test Command**:
```javascript
window.__TAURI__.invoke('get_progress', { 
  claimId: 'test-claim'
})
  .then(res => console.log('✅ get_progress:', res))
  .catch(err => console.error('❌ get_progress:', err));
```

**Expected Result**: ProgressData object or null

**Pass Criteria**:
- Returns object or null
- No timeout
- No errors

---

### 11. save_favorite

**Purpose**: Save item to favorites

**Parameters**:
- `claimId` (String): Claim identifier (required)
- `title` (String): Item title (required)
- `thumbnailUrl` (String): Optional thumbnail URL

**Test Command**:
```javascript
window.__TAURI__.invoke('save_favorite', { 
  claimId: 'test-claim',
  title: 'Test Movie',
  thumbnailUrl: 'https://example.com/thumb.jpg'
})
  .then(res => console.log('✅ save_favorite:', res))
  .catch(err => console.error('❌ save_favorite:', err));
```

**Expected Result**: Success (undefined)

**Pass Criteria**:
- Command completes
- No timeout
- No errors

---

### 12. remove_favorite

**Purpose**: Remove item from favorites

**Parameters**:
- `claimId` (String): Claim identifier (required)

**Test Command**:
```javascript
window.__TAURI__.invoke('remove_favorite', { 
  claimId: 'test-claim'
})
  .then(res => console.log('✅ remove_favorite:', res))
  .catch(err => console.error('❌ remove_favorite:', err));
```

**Expected Result**: Success (undefined)

**Pass Criteria**:
- Command completes
- No timeout
- No errors

---

### 13. get_favorites

**Purpose**: Retrieve all favorites

**Parameters**: None

**Test Command**:
```javascript
window.__TAURI__.invoke('get_favorites')
  .then(res => console.log('✅ get_favorites:', res))
  .catch(err => console.error('❌ get_favorites:', err));
```

**Expected Result**: Array of FavoriteItem objects

**Pass Criteria**:
- Returns array (may be empty)
- No timeout
- No errors

---

### 14. is_favorite

**Purpose**: Check if item is favorited

**Parameters**:
- `claimId` (String): Claim identifier (required)

**Test Command**:
```javascript
window.__TAURI__.invoke('is_favorite', { 
  claimId: 'test-claim'
})
  .then(res => console.log('✅ is_favorite:', res))
  .catch(err => console.error('❌ is_favorite:', err));
```

**Expected Result**: Boolean (true/false)

**Pass Criteria**:
- Returns boolean
- No timeout
- No errors

---

### 15. get_app_config

**Purpose**: Retrieve application configuration

**Parameters**: None

**Test Command**:
```javascript
window.__TAURI__.invoke('get_app_config')
  .then(res => console.log('✅ get_app_config:', res))
  .catch(err => console.error('❌ get_app_config:', err));
```

**Expected Result**: AppConfig object

**Pass Criteria**:
- Returns config object with all fields
- No timeout
- No errors

---

### 16. update_settings

**Purpose**: Update application settings

**Parameters**:
- `settings` (Object): Key-value pairs of settings

**Test Command**:
```javascript
window.__TAURI__.invoke('update_settings', { 
  settings: {
    theme: 'dark',
    cache_ttl_minutes: '30'
  }
})
  .then(res => console.log('✅ update_settings:', res))
  .catch(err => console.error('❌ update_settings:', err));
```

**Expected Result**: Success (undefined)

**Pass Criteria**:
- Command completes
- No timeout
- Validation errors are clear

---

### 17. get_diagnostics

**Purpose**: Collect diagnostic information

**Parameters**: None

**Test Command**:
```javascript
window.__TAURI__.invoke('get_diagnostics')
  .then(res => console.log('✅ get_diagnostics:', res))
  .catch(err => console.error('❌ get_diagnostics:', err));
```

**Expected Result**: DiagnosticsData object

**Pass Criteria**:
- Returns diagnostics object
- No timeout
- No errors

---

### 18. collect_debug_package

**Purpose**: Create debug package for troubleshooting

**Parameters**: None

**Test Command**:
```javascript
window.__TAURI__.invoke('collect_debug_package')
  .then(res => console.log('✅ collect_debug_package:', res))
  .catch(err => console.error('❌ collect_debug_package:', err));
```

**Expected Result**: String path to debug package

**Pass Criteria**:
- Returns file path string
- No timeout
- No errors

---

### 19. get_recent_crashes

**Purpose**: Retrieve recent crash reports

**Parameters**:
- `limit` (Number): Maximum number of crashes to return

**Test Command**:
```javascript
window.__TAURI__.invoke('get_recent_crashes', { 
  limit: 10
})
  .then(res => console.log('✅ get_recent_crashes:', res))
  .catch(err => console.error('❌ get_recent_crashes:', err));
```

**Expected Result**: Array of CrashReport objects

**Pass Criteria**:
- Returns array (may be empty)
- No timeout
- No errors

---

### 20. clear_crash_log

**Purpose**: Clear crash log

**Parameters**: None

**Test Command**:
```javascript
window.__TAURI__.invoke('clear_crash_log')
  .then(res => console.log('✅ clear_crash_log:', res))
  .catch(err => console.error('❌ clear_crash_log:', err));
```

**Expected Result**: Success (undefined)

**Pass Criteria**:
- Command completes
- No timeout
- No errors

---

### 21. invalidate_cache_item

**Purpose**: Invalidate cache for specific item

**Parameters**:
- `claimId` (String): Claim identifier (required)

**Test Command**:
```javascript
window.__TAURI__.invoke('invalidate_cache_item', { 
  claimId: 'test-claim'
})
  .then(res => console.log('✅ invalidate_cache_item:', res))
  .catch(err => console.error('❌ invalidate_cache_item:', err));
```

**Expected Result**: Boolean (true if invalidated, false if not found)

**Pass Criteria**:
- Returns boolean
- No timeout
- No errors

---

### 22. invalidate_cache_by_tags

**Purpose**: Invalidate cache by tags

**Parameters**:
- `tags` (Array<String>): Tags to invalidate (required)

**Test Command**:
```javascript
window.__TAURI__.invoke('invalidate_cache_by_tags', { 
  tags: ['hero', 'movies']
})
  .then(res => console.log('✅ invalidate_cache_by_tags:', res))
  .catch(err => console.error('❌ invalidate_cache_by_tags:', err));
```

**Expected Result**: Number (count of invalidated items)

**Pass Criteria**:
- Returns number
- No timeout
- No errors

---

### 23. clear_all_cache

**Purpose**: Clear all cached items

**Parameters**: None

**Test Command**:
```javascript
window.__TAURI__.invoke('clear_all_cache')
  .then(res => console.log('✅ clear_all_cache:', res))
  .catch(err => console.error('❌ clear_all_cache:', err));
```

**Expected Result**: Number (count of cleared items)

**Pass Criteria**:
- Returns number
- No timeout
- No errors

---

### 24. cleanup_expired_cache

**Purpose**: Remove expired cache entries

**Parameters**: None

**Test Command**:
```javascript
window.__TAURI__.invoke('cleanup_expired_cache')
  .then(res => console.log('✅ cleanup_expired_cache:', res))
  .catch(err => console.error('❌ cleanup_expired_cache:', err));
```

**Expected Result**: Number (count of cleaned items)

**Pass Criteria**:
- Returns number
- No timeout
- No errors

---

### 25. get_cache_stats

**Purpose**: Get cache statistics

**Parameters**: None

**Test Command**:
```javascript
window.__TAURI__.invoke('get_cache_stats')
  .then(res => console.log('✅ get_cache_stats:', res))
  .catch(err => console.error('❌ get_cache_stats:', err));
```

**Expected Result**: CacheStats object

**Pass Criteria**:
- Returns stats object
- No timeout
- No errors

---

### 26. get_memory_stats

**Purpose**: Get memory statistics

**Parameters**: None

**Test Command**:
```javascript
window.__TAURI__.invoke('get_memory_stats')
  .then(res => console.log('✅ get_memory_stats:', res))
  .catch(err => console.error('❌ get_memory_stats:', err));
```

**Expected Result**: MemoryStats object

**Pass Criteria**:
- Returns stats object
- No timeout
- No errors

---

### 27. optimize_database_memory

**Purpose**: Optimize database memory usage

**Parameters**: None

**Test Command**:
```javascript
window.__TAURI__.invoke('optimize_database_memory')
  .then(res => console.log('✅ optimize_database_memory:', res))
  .catch(err => console.error('❌ optimize_database_memory:', err));
```

**Expected Result**: Success (undefined)

**Pass Criteria**:
- Command completes
- No timeout
- No errors

---

### 28. open_external

**Purpose**: Open URL in external browser

**Parameters**:
- `url` (String): URL to open (required)

**Test Command**:
```javascript
window.__TAURI__.invoke('open_external', { 
  url: 'https://odysee.com'
})
  .then(res => console.log('✅ open_external:', res))
  .catch(err => console.error('❌ open_external:', err));
```

**Expected Result**: Success (undefined)

**Pass Criteria**:
- Command completes
- Browser opens (if valid URL)
- Validation errors are clear
- No timeout

---

## Testing Procedure

### Step 1: Start Application
```bash
npm run tauri:dev
```

### Step 2: Open DevTools
Press F12 or right-click → Inspect

### Step 3: Navigate to Console Tab

### Step 4: Run Test Commands
Copy and paste each test command from this guide into the console.

### Step 5: Document Results
Record the following for each command:
- ✅ Pass: Command completed successfully
- ⚠️ Warning: Command completed with warnings
- ❌ Fail: Command failed, timed out, or hung
- 📝 Notes: Any additional observations

### Step 6: Create Test Results Document
Document all findings in `stabilization/TASK_12.1_TEST_RESULTS.md`

---

## Batch Testing Script

For convenience, here's a script to test all commands at once:

```javascript
// Batch test all Tauri commands
const testResults = [];

async function testCommand(name, params = {}) {
  console.log(`Testing: ${name}`);
  try {
    const result = await window.__TAURI__.invoke(name, params);
    console.log(`✅ ${name}:`, result);
    testResults.push({ command: name, status: 'pass', result });
  } catch (err) {
    console.error(`❌ ${name}:`, err);
    testResults.push({ command: name, status: 'fail', error: err.toString() });
  }
}

// Run all tests
(async () => {
  // Test commands
  await testCommand('test_connection');
  await testCommand('build_cdn_playback_url_test', { claimId: 'test-123' });
  
  // Content discovery
  await testCommand('fetch_channel_claims', { channelId: '@kiyyamovies:b', limit: 5 });
  await testCommand('fetch_playlists', { channelId: '@kiyyamovies:b' });
  
  // Configuration
  await testCommand('get_app_config');
  await testCommand('get_diagnostics');
  
  // Favorites
  await testCommand('get_favorites');
  await testCommand('is_favorite', { claimId: 'test-claim' });
  
  // Cache
  await testCommand('get_cache_stats');
  await testCommand('get_memory_stats');
  await testCommand('cleanup_expired_cache');
  
  // Crash reporting
  await testCommand('get_recent_crashes', { limit: 5 });
  
  // Progress
  await testCommand('get_progress', { claimId: 'test-claim' });
  
  console.log('\n=== TEST SUMMARY ===');
  console.table(testResults);
  
  const passed = testResults.filter(r => r.status === 'pass').length;
  const failed = testResults.filter(r => r.status === 'fail').length;
  console.log(`Passed: ${passed}/${testResults.length}`);
  console.log(`Failed: ${failed}/${testResults.length}`);
})();
```

---

## Requirements Validation

This testing guide addresses the following requirements:

- **Requirement 6.1**: Identify all defined Tauri commands ✅
- **Requirement 6.2**: Verify each command is registered in the Tauri builder ✅
- **Requirement 6.3**: Verify no command hangs or fails to return ✅
- **Requirement 6.4**: Verify all async calls return properly ✅

---

## Next Steps

After completing manual testing:
1. Document results in `stabilization/TASK_12.1_TEST_RESULTS.md`
2. Report any issues found
3. Verify no commands hang or timeout
4. Confirm all commands complete successfully or return clear errors
5. Mark task 12.1 as complete
