# Implementation Plan: Pass Channel ID from Frontend

## Overview

This implementation plan breaks down the fix for the hero content loading issue into discrete coding steps. The approach is to first update the backend to accept channel_id as a parameter, then update the frontend to pass it, and finally add comprehensive testing to ensure correctness.

## Tasks

- [x] 1. Add backend validation for channel ID
  - Add `validate_channel_id` function to `src-tauri/src/validation.rs`
  - Validate that channel_id is non-empty
  - Validate that channel_id starts with '@' character
  - Return descriptive validation errors
  - _Requirements: 1.5, 4.1, 4.2_

- [x] 2. Update backend command signatures
  - [x] 2.1 Update fetch_channel_claims command signature
    - Add `channel_id: String` parameter as first parameter
    - Replace `std::env::var("CHANNEL_ID")` with validation call
    - Use validated channel_id in OdyseeRequest
    - _Requirements: 1.1, 1.3_
  
  - [x] 2.2 Update fetch_playlists command signature
    - Add `channel_id: String` parameter as first parameter
    - Replace `std::env::var("CHANNEL_ID")` with validation call
    - Use validated channel_id in OdyseeRequest
    - _Requirements: 1.2, 1.3_
  
  - [x] 2.3 Write property test for channel ID parameter usage
    - **Property 1: Channel ID parameter usage**
    - **Validates: Requirements 1.3, 5.2**
  
  - [x] 2.4 Write property test for invalid channel ID rejection
    - **Property 2: Invalid channel ID rejection**
    - **Validates: Requirements 1.4, 4.2**

- [x] 3. Update frontend API wrapper
  - [x] 3.1 Add CHANNEL_ID constant to api.ts
    - Read from `import.meta.env.VITE_CHANNEL_ID`
    - Provide fallback to '@kiyyamovies:b'
    - _Requirements: 2.1, 2.2_

  
  - [x] 3.2 Update fetchChannelClaims function
    - Add `channel_id: CHANNEL_ID` to invoke parameters
    - Maintain existing function signature for backward compatibility
    - _Requirements: 2.3, 3.1_
  
  - [x] 3.3 Update fetchPlaylists function
    - Add `channel_id: CHANNEL_ID` to invoke parameters
    - _Requirements: 2.3, 3.2_
  
  - [x] 3.4 Verify convenience functions work correctly
    - Ensure fetchByTag passes channel_id through fetchChannelClaims
    - Ensure fetchHeroContent passes channel_id through fetchByTag
    - _Requirements: 3.3_
  
  - [x] 3.5 Write property test for API wrapper channel ID inclusion
    - **Property 5: API wrapper channel ID inclusion**
    - **Validates: Requirements 2.3, 3.1, 3.2, 3.3**

- [x] 4. Add validation property tests
  - [x] 4.1 Write property test for channel ID format validation
    - **Property 3: Channel ID format validation**
    - **Validates: Requirements 1.5, 4.1**
  
  - [x] 4.2 Write property test for valid channel ID acceptance
    - **Property 4: Valid channel ID acceptance**
    - **Validates: Requirements 4.4**

- [x] 5. Add unit tests for edge cases
  - [x] 5.1 Write unit test for empty channel ID
    - Test that empty string returns validation error
    - _Requirements: 4.2_
  
  - [x] 5.2 Write unit test for channel ID without '@'
    - Test that strings not starting with '@' return validation error
    - _Requirements: 4.1_
  
  - [x] 5.3 Write unit test for valid channel ID formats
    - Test '@channelname:claimid' format
    - Test '@channelname' format (without claim ID)
    - _Requirements: 1.5_
  
  - [x] 5.4 Write unit test for frontend default fallback
    - Test that CHANNEL_ID constant uses fallback when env var not set
    - _Requirements: 2.2_

- [x] 6. Update E2E tests
  - [x] 6.1 Verify hero content loads successfully
    - Test that home page displays hero content
    - Test that correct channel ID is used
    - _Requirements: 5.1, 5.2_
  
  - [x] 6.2 Test error handling for invalid channel ID
    - Mock invalid channel ID scenario
    - Verify appropriate error is displayed
    - _Requirements: 5.4_

- [x] 7. Checkpoint - Ensure all tests pass
  - Run all unit tests and verify they pass
  - Run all property tests and verify they pass
  - Run E2E tests and verify hero content loads
  - Ask the user if questions arise

## Notes

- Each task references specific requirements for traceability
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The checkpoint ensures incremental validation before completion
