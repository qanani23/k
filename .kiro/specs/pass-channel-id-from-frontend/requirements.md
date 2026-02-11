# Requirements Document

## Introduction

This specification addresses the hero content loading issue in the Kiyya Desktop application. Currently, the hero content fails to load because the Rust backend cannot access the CHANNEL_ID environment variable at runtime. The backend defaults to "@YourChannelName" which doesn't exist on Odysee, causing content fetching to fail.

The solution involves passing the channel ID from the frontend (where it's available via Vite environment variables) to the Rust backend as a parameter in Tauri commands, eliminating the dependency on runtime environment variables.

## Glossary

- **Backend**: The Rust/Tauri backend that handles API calls to Odysee
- **Frontend**: The TypeScript/Svelte frontend that renders the UI
- **Channel_ID**: The Odysee channel identifier (format: @channelname:claimid)
- **Tauri_Command**: A Rust function exposed to the frontend via Tauri's IPC mechanism
- **Hero_Content**: Featured content displayed prominently on the home page
- **API_Wrapper**: The TypeScript module (src/lib/api.ts) that wraps Tauri command invocations

## Requirements

### Requirement 1: Backend Channel ID Parameter

**User Story:** As a backend developer, I want Tauri commands to accept channel ID as a parameter, so that the backend doesn't depend on runtime environment variables.

#### Acceptance Criteria

1. WHEN the fetch_channel_claims command is invoked, THE Backend SHALL accept a channel_id parameter of type String
2. WHEN the fetch_playlists command is invoked, THE Backend SHALL accept a channel_id parameter of type String
3. WHEN a channel_id parameter is provided, THE Backend SHALL use it instead of reading from environment variables
4. WHEN a channel_id parameter is empty or invalid, THE Backend SHALL return a validation error
5. THE Backend SHALL validate that channel_id starts with '@' character

### Requirement 2: Frontend Channel ID Configuration

**User Story:** As a frontend developer, I want to read the channel ID from Vite environment variables, so that it can be passed to backend commands.

#### Acceptance Criteria

1. WHEN the API wrapper initializes, THE Frontend SHALL read VITE_CHANNEL_ID from import.meta.env
2. WHEN VITE_CHANNEL_ID is not set, THE Frontend SHALL use '@kiyyamovies:b' as the default value
3. WHEN calling backend commands that require channel_id, THE Frontend SHALL pass the configured channel ID
4. THE Frontend SHALL validate that the channel ID is not empty before passing to backend

### Requirement 3: API Wrapper Updates

**User Story:** As a frontend developer, I want the API wrapper to automatically include channel ID in backend calls, so that I don't have to manually pass it every time.

#### Acceptance Criteria

1. WHEN fetchChannelClaims is called, THE API_Wrapper SHALL include channel_id in the Tauri command invocation
2. WHEN fetchPlaylists is called, THE API_Wrapper SHALL include channel_id in the Tauri command invocation
3. WHEN fetchHeroContent is called, THE API_Wrapper SHALL pass channel_id to the underlying fetchChannelClaims call
4. THE API_Wrapper SHALL maintain backward compatibility with existing function signatures

### Requirement 4: Validation and Error Handling

**User Story:** As a system administrator, I want proper validation of channel IDs, so that invalid configurations are caught early.

#### Acceptance Criteria

1. WHEN a channel_id does not start with '@', THE Backend SHALL return a validation error with a descriptive message
2. WHEN a channel_id is an empty string, THE Backend SHALL return a validation error
3. WHEN validation fails, THE Backend SHALL log the validation error with the invalid value
4. WHEN validation succeeds, THE Backend SHALL proceed with the API request using the validated channel_id

### Requirement 5: Hero Content Loading

**User Story:** As an end user, I want the hero content to load successfully on the home page, so that I can see featured content.

#### Acceptance Criteria

1. WHEN the home page loads, THE Frontend SHALL fetch hero content using the configured channel ID
2. WHEN hero content is fetched, THE Backend SHALL use the provided channel_id parameter
3. WHEN the API request succeeds, THE Frontend SHALL display the hero content
4. WHEN the API request fails due to invalid channel_id, THE Frontend SHALL display an appropriate error message

### Requirement 6: Testing and Verification

**User Story:** As a QA engineer, I want E2E tests to verify hero content loading, so that regressions are caught automatically.

#### Acceptance Criteria

1. WHEN E2E tests run, THE System SHALL verify that hero content loads successfully
2. WHEN E2E tests run, THE System SHALL verify that the correct channel ID is being used
3. WHEN E2E tests run with an invalid channel ID, THE System SHALL verify that appropriate errors are returned
4. THE System SHALL ensure all existing tests continue to pass after the changes
