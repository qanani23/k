# Design Document: Pass Channel ID from Frontend

## Overview

This design addresses the hero content loading issue by modifying the architecture to pass the channel ID from the frontend to the backend as a parameter, rather than relying on runtime environment variables. The solution involves updating Tauri command signatures, adding validation logic, and modifying the frontend API wrapper to include the channel ID in all relevant calls.

The key insight is that Vite environment variables (VITE_*) are only available at build time in the frontend, not at runtime in the Rust backend. By passing the channel ID as a parameter through Tauri's IPC mechanism, we maintain clean separation of concerns while ensuring the backend has access to the necessary configuration.

## Architecture

### Current Architecture (Problematic)

```
Frontend (src/lib/api.ts)
  ↓ (calls Tauri command without channel_id)
Backend (src-tauri/src/commands.rs)
  ↓ (tries to read CHANNEL_ID from env at runtime)
  ↓ (fails, defaults to "@YourChannelName")
Odysee API
  ↓ (returns empty results for non-existent channel)
```

### New Architecture (Solution)

```
Frontend (src/lib/api.ts)
  ↓ (reads VITE_CHANNEL_ID from import.meta.env)
  ↓ (passes channel_id parameter to Tauri command)
Backend (src-tauri/src/commands.rs)
  ↓ (receives channel_id as parameter)
  ↓ (validates channel_id format)
  ↓ (uses validated channel_id in API request)
Odysee API
  ↓ (returns content for valid channel)
```

### Data Flow

1. **Application Startup**: Frontend reads `import.meta.env.VITE_CHANNEL_ID` (defaults to '@kiyyamovies:b')
2. **API Call**: Frontend invokes Tauri command with channel_id parameter
3. **Validation**: Backend validates channel_id format (must start with '@')
4. **API Request**: Backend uses validated channel_id in Odysee API request
5. **Response**: Backend returns content items to frontend

## Components and Interfaces

### Backend Changes (src-tauri/src/commands.rs)

#### Updated Command Signatures

```rust
#[command]
pub async fn fetch_channel_claims(
    channel_id: String,  // NEW PARAMETER
    any_tags: Option<Vec<String>>,
    text: Option<String>,
    limit: Option<u32>,
    page: Option<u32>,
    force_refresh: Option<bool>,
    state: State<'_, AppState>,
) -> Result<Vec<ContentItem>>

#[command]
pub async fn fetch_playlists(
    channel_id: String,  // NEW PARAMETER
    state: State<'_, AppState>,
) -> Result<Vec<Playlist>>
```

#### Validation Logic

Add a new validation function in the validation module:

```rust
pub fn validate_channel_id(channel_id: &str) -> Result<String> {
    if channel_id.is_empty() {
        return Err(KiyyaError::Validation {
            field: "channel_id".to_string(),
            message: "Channel ID cannot be empty".to_string(),
        });
    }
    
    if !channel_id.starts_with('@') {
        return Err(KiyyaError::Validation {
            field: "channel_id".to_string(),
            message: "Channel ID must start with '@'".to_string(),
        });
    }
    
    Ok(channel_id.to_string())
}
```

#### Command Implementation Updates

Replace the environment variable reads:

```rust
// OLD CODE (remove):
let channel_id = std::env::var("CHANNEL_ID")
    .unwrap_or_else(|_| "@YourChannelName".to_string());

// NEW CODE (add validation):
let validated_channel_id = validation::validate_channel_id(&channel_id)?;
```

### Frontend Changes (src/lib/api.ts)

#### Channel ID Configuration

Add a constant at the top of the file:

```typescript
// Read channel ID from environment with fallback
const CHANNEL_ID = import.meta.env.VITE_CHANNEL_ID || '@kiyyamovies:b';
```

#### Updated API Functions

```typescript
export const fetchChannelClaims = async (params: {
  any_tags?: string[];
  text?: string;
  limit?: number;
  page?: number;
  force_refresh?: boolean;
}): Promise<ContentItem[]> => {
  return await invoke('fetch_channel_claims', {
    channel_id: CHANNEL_ID,  // NEW PARAMETER
    ...params
  });
};

export const fetchPlaylists = async (): Promise<Playlist[]> => {
  return await invoke('fetch_playlists', {
    channel_id: CHANNEL_ID  // NEW PARAMETER
  });
};
```

#### Convenience Functions

Update convenience functions to ensure they pass channel_id:

```typescript
export const fetchByTag = async (
  tag: string, 
  limit: number = 50, 
  forceRefresh: boolean = false
): Promise<ContentItem[]> => {
  return await fetchChannelClaims({ 
    any_tags: [tag], 
    limit, 
    force_refresh: forceRefresh 
  });
};

export const fetchHeroContent = async (limit: number = 20): Promise<ContentItem[]> => {
  return await fetchByTag('hero_trailer', limit);
};
```

## Data Models

No changes to existing data models are required. The channel ID is passed as a simple string parameter.

### Channel ID Format

- **Type**: String
- **Format**: `@channelname:claimid`
- **Example**: `@kiyyamovies:b`
- **Validation**: Must start with '@' character, cannot be empty

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified the following testable properties:

**Potentially Redundant Properties:**
- Property 1.3 (backend uses provided channel_id) and Property 5.2 (backend uses provided channel_id) are identical
- Property 4.1 (validation error for channel_id without '@') is a specific case of Property 1.5 (validation that channel_id starts with '@')
- Properties 3.1, 3.2, and 3.3 all test that channel_id is included in API calls - these can be combined into one comprehensive property

**Consolidated Properties:**
- Combine 1.3 and 5.2 into a single property about backend using provided channel_id
- Combine 1.5 and 4.1 into a single property about '@' validation
- Combine 3.1, 3.2, and 3.3 into a single property about API wrapper including channel_id

### Properties

Property 1: Channel ID parameter usage
*For any* valid channel_id string, when passed to fetch_channel_claims or fetch_playlists, the backend should use that exact channel_id value in the Odysee API request (not read from environment variables)
**Validates: Requirements 1.3, 5.2**

Property 2: Invalid channel ID rejection
*For any* string that does not start with '@' or is empty, when passed as channel_id to backend commands, the backend should return a validation error
**Validates: Requirements 1.4, 4.2**

Property 3: Channel ID format validation
*For any* channel_id string, the validation should pass if and only if the string starts with '@' and is non-empty
**Validates: Requirements 1.5, 4.1**

Property 4: Valid channel ID acceptance
*For any* channel_id string that starts with '@' and is non-empty, when passed to backend commands, the backend should proceed with the API request using the validated channel_id
**Validates: Requirements 4.4**

Property 5: API wrapper channel ID inclusion
*For any* call to fetchChannelClaims, fetchPlaylists, or fetchHeroContent, the API wrapper should include the configured channel_id parameter in the Tauri command invocation
**Validates: Requirements 2.3, 3.1, 3.2, 3.3**

## Error Handling

### Validation Errors

The backend will return validation errors in the following cases:

1. **Empty Channel ID**: When channel_id is an empty string
   - Error type: `KiyyaError::Validation`
   - Message: "Channel ID cannot be empty"
   - Field: "channel_id"

2. **Invalid Format**: When channel_id doesn't start with '@'
   - Error type: `KiyyaError::Validation`
   - Message: "Channel ID must start with '@'"
   - Field: "channel_id"

### Error Propagation

Validation errors will be:
- Logged at the backend with the invalid value
- Returned to the frontend as Result::Err
- Displayed to the user with appropriate error messages

### Fallback Behavior

The frontend provides a default channel ID ('@kiyyamovies:b') when VITE_CHANNEL_ID is not set, ensuring the application always has a valid channel ID configured.

## Testing Strategy

### Unit Tests

Unit tests will verify specific examples and edge cases:

1. **Backend Validation Tests**:
   - Test empty string rejection
   - Test channel_id without '@' rejection
   - Test valid channel_id acceptance
   - Test channel_id with special characters

2. **Frontend Configuration Tests**:
   - Test VITE_CHANNEL_ID is read correctly
   - Test default fallback value
   - Test channel_id is included in API calls

3. **Integration Tests**:
   - Test E2E flow from frontend to backend
   - Test hero content loads with valid channel_id
   - Test error handling with invalid channel_id

### Property-Based Tests

Property tests will verify universal properties across all inputs (minimum 100 iterations each):

1. **Property Test 1: Channel ID Parameter Usage**
   - Generate random valid channel IDs (starting with '@')
   - Verify backend uses the provided value in API requests
   - Tag: **Feature: pass-channel-id-from-frontend, Property 1: Channel ID parameter usage**

2. **Property Test 2: Invalid Channel ID Rejection**
   - Generate random invalid channel IDs (not starting with '@' or empty)
   - Verify all return validation errors
   - Tag: **Feature: pass-channel-id-from-frontend, Property 2: Invalid channel ID rejection**

3. **Property Test 3: Channel ID Format Validation**
   - Generate random strings
   - Verify validation passes if and only if string starts with '@' and is non-empty
   - Tag: **Feature: pass-channel-id-from-frontend, Property 3: Channel ID format validation**

4. **Property Test 4: Valid Channel ID Acceptance**
   - Generate random valid channel IDs
   - Verify backend proceeds with API request for all valid inputs
   - Tag: **Feature: pass-channel-id-from-frontend, Property 4: Valid channel ID acceptance**

5. **Property Test 5: API Wrapper Channel ID Inclusion**
   - Test all API wrapper functions
   - Verify channel_id is included in every Tauri command invocation
   - Tag: **Feature: pass-channel-id-from-frontend, Property 5: API wrapper channel ID inclusion**

### Testing Library

For Rust property-based testing, we will use **proptest** (already used in the codebase).
For TypeScript property-based testing, we will use **fast-check**.

Each property test will run a minimum of 100 iterations to ensure comprehensive coverage through randomization.
