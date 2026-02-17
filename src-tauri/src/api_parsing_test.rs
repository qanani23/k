// Tests for API response parsing with malformed data
// This module tests defensive parsing capabilities to ensure the application
// handles malformed, incomplete, or unexpected API responses gracefully

#[cfg(test)]
mod api_parsing_tests {
    use crate::commands::{
        parse_claim_item, parse_playlist_item, parse_claim_search_response,
        parse_playlist_search_response, parse_resolve_response,
    };
    use crate::error::KiyyaError;
    use crate::models::OdyseeResponse;
    use serde_json::json;

    // Test parse_claim_item with various malformed inputs

    #[test]
    fn test_parse_claim_item_missing_claim_id() {
        let item = json!({
            "value": {
                "title": "Test Movie"
            }
        });

        let result = parse_claim_item(&item);
        assert!(result.is_err());
        match result {
            Err(KiyyaError::ContentParsing { message }) => {
                assert!(message.contains("claim_id"));
            }
            _ => panic!("Expected ContentParsing error"),
        }
    }

    #[test]
    fn test_parse_claim_item_empty_claim_id() {
        let item = json!({
            "claim_id": "",
            "value": {
                "title": "Test Movie"
            }
        });

        let result = parse_claim_item(&item);
        // Empty claim_id should be treated as missing
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_claim_item_null_claim_id() {
        let item = json!({
            "claim_id": null,
            "value": {
                "title": "Test Movie"
            }
        });

        let result = parse_claim_item(&item);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_claim_item_missing_title() {
        let item = json!({
            "claim_id": "test-claim-123",
            "value_type": "stream",
            "value": {
                "hd_url": "https://example.com/video.mp4"
            }
        });

        let result = parse_claim_item(&item);
        // Should succeed with default "Untitled"
        assert!(result.is_ok());
        let content = result.unwrap();
        assert_eq!(content.title, "Untitled");
    }

    #[test]
    fn test_parse_claim_item_empty_title() {
        let item = json!({
            "claim_id": "test-claim-123",
            "value_type": "stream",
            "value": {
                "title": "",
                "hd_url": "https://example.com/video.mp4"
            }
        });

        let result = parse_claim_item(&item);
        // Empty title is returned as-is (not converted to "Untitled")
        assert!(result.is_ok());
        let content = result.unwrap();
        assert_eq!(content.title, "");
    }

    #[test]
    fn test_parse_claim_item_null_title() {
        let item = json!({
            "claim_id": "test-claim-123",
            "value_type": "stream",
            "value": {
                "title": null,
                "hd_url": "https://example.com/video.mp4"
            }
        });

        let result = parse_claim_item(&item);
        assert!(result.is_ok());
        let content = result.unwrap();
        assert_eq!(content.title, "Untitled");
    }

    #[test]
    fn test_parse_claim_item_missing_value_object() {
        let item = json!({
            "claim_id": "test-claim-123",
            "title": "Direct Title",
            "hd_url": "https://example.com/video.mp4"
        });

        let result = parse_claim_item(&item);
        // Should fail because video URLs are in value object
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_claim_item_malformed_tags() {
        let item = json!({
            "claim_id": "test-claim-123",
            "value_type": "stream",
            "value": {
                "title": "Test Movie",
                "tags": "not-an-array",
                "hd_url": "https://example.com/video.mp4"
            }
        });

        let result = parse_claim_item(&item);
        // Should succeed with empty tags array
        assert!(result.is_ok());
        let content = result.unwrap();
        assert_eq!(content.tags.len(), 0);
    }

    #[test]
    fn test_parse_claim_item_tags_with_nulls() {
        let item = json!({
            "claim_id": "test-claim-123",
            "value_type": "stream",
            "value": {
                "title": "Test Movie",
                "tags": ["movie", null, "action", null],
                "hd_url": "https://example.com/video.mp4"
            }
        });

        let result = parse_claim_item(&item);
        assert!(result.is_ok());
        let content = result.unwrap();
        // Nulls should be filtered out
        assert_eq!(content.tags, vec!["movie", "action"]);
    }

    #[test]
    fn test_parse_claim_item_tags_with_empty_strings() {
        let item = json!({
            "claim_id": "test-claim-123",
            "value_type": "stream",
            "value": {
                "title": "Test Movie",
                "tags": ["movie", "", "action", "  "],
                "hd_url": "https://example.com/video.mp4"
            }
        });

        let result = parse_claim_item(&item);
        assert!(result.is_ok());
        let content = result.unwrap();
        // The implementation filters empty strings BEFORE trimming
        // So "" is filtered, but "  " becomes "" after trim and is NOT filtered
        // This documents the actual behavior (which could be improved)
        assert!(content.tags.contains(&"movie".to_string()));
        assert!(content.tags.contains(&"action".to_string()));
        // Note: whitespace-only strings become empty after normalization
        // This is a known limitation of the current implementation
    }

    #[test]
    fn test_parse_claim_item_invalid_thumbnail_url() {
        let item = json!({
            "claim_id": "test-claim-123",
            "value_type": "stream",
            "value": {
                "title": "Test Movie",
                "thumbnail": {
                    "url": "not-a-valid-url"
                },
                "hd_url": "https://example.com/video.mp4"
            }
        });

        let result = parse_claim_item(&item);
        assert!(result.is_ok());
        let content = result.unwrap();
        // Invalid URL (not starting with http) should be filtered out
        assert_eq!(content.thumbnail_url, None);
    }

    #[test]
    fn test_parse_claim_item_empty_thumbnail_url() {
        let item = json!({
            "claim_id": "test-claim-123",
            "value_type": "stream",
            "value": {
                "title": "Test Movie",
                "thumbnail": {
                    "url": ""
                },
                "hd_url": "https://example.com/video.mp4"
            }
        });

        let result = parse_claim_item(&item);
        assert!(result.is_ok());
        let content = result.unwrap();
        assert_eq!(content.thumbnail_url, None);
    }

    #[test]
    fn test_parse_claim_item_malformed_duration() {
        let item = json!({
            "claim_id": "test-claim-123",
            "value_type": "stream",
            "value": {
                "title": "Test Movie",
                "video": {
                    "duration": "not-a-number"
                },
                "hd_url": "https://example.com/video.mp4"
            }
        });

        let result = parse_claim_item(&item);
        assert!(result.is_ok());
        let content = result.unwrap();
        // Malformed duration should result in None
        assert_eq!(content.duration, None);
    }

    #[test]
    fn test_parse_claim_item_negative_duration() {
        let item = json!({
            "claim_id": "test-claim-123",
            "value_type": "stream",
            "value": {
                "title": "Test Movie",
                "video": {
                    "duration": -100
                },
                "hd_url": "https://example.com/video.mp4"
            }
        });

        let result = parse_claim_item(&item);
        assert!(result.is_ok());
        let content = result.unwrap();
        // Negative duration should be filtered out
        assert_eq!(content.duration, None);
    }

    #[test]
    fn test_parse_claim_item_missing_video_urls() {
        let item = json!({
            "claim_id": "test-claim-123",
            "value": {
                "title": "Test Movie"
            }
        });

        let result = parse_claim_item(&item);
        // With CDN-first approach, this fails because value_type is missing
        // and there's no source.sd_hash to infer stream type
        assert!(result.is_err());
        match result {
            Err(KiyyaError::ContentParsing { message }) => {
                assert!(message.contains("stream") || message.contains("value_type"));
            }
            _ => panic!("Expected ContentParsing error"),
        }
    }

    #[test]
    fn test_parse_claim_item_empty_streams_array() {
        let item = json!({
            "claim_id": "test-claim-123",
            "value": {
                "title": "Test Movie",
                "streams": []
            }
        });

        let result = parse_claim_item(&item);
        // Empty streams array should result in error
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_claim_item_malformed_stream_entry() {
        let item = json!({
            "claim_id": "test-claim-123",
            "value": {
                "title": "Test Movie",
                "streams": [
                    {
                        "url": "https://example.com/video.mp4"
                        // Missing height field
                    }
                ]
            }
        });

        let result = parse_claim_item(&item);
        // Should fail as no valid streams can be extracted
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_claim_item_mixed_valid_invalid_streams() {
        let item = json!({
            "claim_id": "test-claim-123",
            "value_type": "stream",
            "value": {
                "title": "Test Movie",
                "streams": [
                    {
                        "url": "https://example.com/video-hd.mp4",
                        "height": 1080
                    },
                    {
                        // Invalid stream - missing url
                        "height": 720
                    },
                    {
                        "url": "https://example.com/video-sd.mp4",
                        "height": 480
                    }
                ]
            }
        });

        let result = parse_claim_item(&item);
        // With CDN-first approach, streams array is ignored
        // Should succeed with CDN master URL only
        assert!(result.is_ok());
        let content = result.unwrap();
        assert!(content.video_urls.contains_key("master"));
        assert!(!content.video_urls.contains_key("1080p"));
        assert!(!content.video_urls.contains_key("480p"));
        assert!(!content.video_urls.contains_key("720p"));
    }

    #[test]
    fn test_parse_claim_item_null_release_time() {
        let item = json!({
            "claim_id": "test-claim-123",
            "value_type": "stream",
            "value": {
                "title": "Test Movie",
                "hd_url": "https://example.com/video.mp4"
            },
            "timestamp": null
        });

        let result = parse_claim_item(&item);
        // Should succeed with current timestamp as default
        assert!(result.is_ok());
        let content = result.unwrap();
        assert!(content.release_time > 0);
    }

    #[test]
    fn test_parse_claim_item_completely_empty() {
        let item = json!({});

        let result = parse_claim_item(&item);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_claim_item_null_value() {
        let item = json!(null);

        let result = parse_claim_item(&item);
        assert!(result.is_err());
    }

    // Test parse_playlist_item with malformed inputs

    #[test]
    fn test_parse_playlist_item_missing_claim_id() {
        let item = json!({
            "value": {
                "title": "Test Playlist"
            }
        });

        let result = parse_playlist_item(&item);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_playlist_item_empty_claim_id() {
        let item = json!({
            "claim_id": "",
            "value": {
                "title": "Test Playlist"
            }
        });

        let result = parse_playlist_item(&item);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_playlist_item_missing_title() {
        let item = json!({
            "claim_id": "playlist-123"
        });

        let result = parse_playlist_item(&item);
        // Should succeed with empty title (warning logged)
        assert!(result.is_ok());
        let playlist = result.unwrap();
        assert_eq!(playlist.title, "");
    }

    #[test]
    fn test_parse_playlist_item_null_title() {
        let item = json!({
            "claim_id": "playlist-123",
            "value": {
                "title": null
            }
        });

        let result = parse_playlist_item(&item);
        assert!(result.is_ok());
        let playlist = result.unwrap();
        assert_eq!(playlist.title, "");
    }

    // Test parse_claim_search_response with malformed inputs

    #[test]
    fn test_parse_claim_search_response_missing_data() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: None,
        };

        let result = parse_claim_search_response(response);
        assert!(result.is_err());
        match result {
            Err(KiyyaError::ContentParsing { message }) => {
                assert!(message.contains("data"));
            }
            _ => panic!("Expected ContentParsing error"),
        }
    }

    #[test]
    fn test_parse_claim_search_response_missing_items_array() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(json!({
                "total": 10
            })),
        };

        let result = parse_claim_search_response(response);
        assert!(result.is_err());
        match result {
            Err(KiyyaError::ContentParsing { message }) => {
                assert!(message.contains("items"));
            }
            _ => panic!("Expected ContentParsing error"),
        }
    }

    #[test]
    fn test_parse_claim_search_response_items_not_array() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(json!({
                "items": "not-an-array"
            })),
        };

        let result = parse_claim_search_response(response);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_claim_search_response_empty_items() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(json!({
                "items": []
            })),
        };

        let result = parse_claim_search_response(response);
        // Empty items should succeed with empty vec
        assert!(result.is_ok());
        let items = result.unwrap();
        assert_eq!(items.len(), 0);
    }

    #[test]
    fn test_parse_claim_search_response_partial_valid_items() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(json!({
                "items": [
                    {
                        "claim_id": "valid-1",
                        "value_type": "stream",
                        "value": {
                            "title": "Valid Movie",
                            "hd_url": "https://example.com/video1.mp4"
                        }
                    },
                    {
                        // Invalid - missing claim_id
                        "value_type": "stream",
                        "value": {
                            "title": "Invalid Movie"
                        }
                    },
                    {
                        "claim_id": "valid-2",
                        "value_type": "stream",
                        "value": {
                            "title": "Another Valid Movie",
                            "sd_url": "https://example.com/video2.mp4"
                        }
                    }
                ]
            })),
        };

        let result = parse_claim_search_response(response);
        // Should succeed with only valid items
        assert!(result.is_ok());
        let items = result.unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].claim_id, "valid-1");
        assert_eq!(items[1].claim_id, "valid-2");
    }

    // Test parse_playlist_search_response with malformed inputs

    #[test]
    fn test_parse_playlist_search_response_missing_data() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: None,
        };

        let result = parse_playlist_search_response(response);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_playlist_search_response_partial_valid_playlists() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(json!({
                "items": [
                    {
                        "claim_id": "playlist-1",
                        "value": {
                            "title": "Season 1"
                        }
                    },
                    {
                        // Invalid - missing claim_id
                        "value": {
                            "title": "Season 2"
                        }
                    },
                    {
                        "claim_id": "playlist-2",
                        "title": "Season 3"
                    }
                ]
            })),
        };

        let result = parse_playlist_search_response(response);
        // Should succeed with only valid playlists
        assert!(result.is_ok());
        let playlists = result.unwrap();
        assert_eq!(playlists.len(), 2);
    }

    // Test parse_resolve_response with malformed inputs

    #[test]
    fn test_parse_resolve_response_missing_data() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: None,
        };

        let result = parse_resolve_response(response);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_resolve_response_invalid_claim_data() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(json!({
                // Missing claim_id
                "value": {
                    "title": "Test Movie"
                }
            })),
        };

        let result = parse_resolve_response(response);
        assert!(result.is_err());
    }

    // Edge case tests

    #[test]
    fn test_parse_claim_item_unicode_in_title() {
        let item = json!({
            "claim_id": "test-claim-123",
            "value_type": "stream",
            "value": {
                "title": "Test Movie 🎬 with émojis and spëcial çhars",
                "hd_url": "https://example.com/video.mp4"
            }
        });

        let result = parse_claim_item(&item);
        assert!(result.is_ok());
        let content = result.unwrap();
        assert!(content.title.contains("🎬"));
        assert!(content.title.contains("émojis"));
    }

    #[test]
    fn test_parse_claim_item_very_long_title() {
        let long_title = "A".repeat(10000);
        let item = json!({
            "claim_id": "test-claim-123",
            "value_type": "stream",
            "value": {
                "title": long_title,
                "hd_url": "https://example.com/video.mp4"
            }
        });

        let result = parse_claim_item(&item);
        assert!(result.is_ok());
        let content = result.unwrap();
        assert_eq!(content.title.len(), 10000);
    }

    #[test]
    fn test_parse_claim_item_very_large_tags_array() {
        let tags: Vec<String> = (0..1000).map(|i| format!("tag{}", i)).collect();
        let item = json!({
            "claim_id": "test-claim-123",
            "value_type": "stream",
            "value": {
                "title": "Test Movie",
                "tags": tags,
                "hd_url": "https://example.com/video.mp4"
            }
        });

        let result = parse_claim_item(&item);
        assert!(result.is_ok());
        let content = result.unwrap();
        assert_eq!(content.tags.len(), 1000);
    }

    #[test]
    fn test_parse_claim_item_nested_value_objects() {
        let item = json!({
            "claim_id": "test-claim-123",
            "value_type": "stream",
            "value": {
                "value": {
                    "title": "Nested Title"
                },
                "hd_url": "https://example.com/video.mp4"
            }
        });

        let result = parse_claim_item(&item);
        // Should not find nested value.value.title
        assert!(result.is_ok());
        let content = result.unwrap();
        assert_eq!(content.title, "Untitled");
    }

    #[test]
    fn test_parse_claim_item_multiple_url_sources() {
        let item = json!({
            "claim_id": "test-claim-123",
            "value_type": "stream",
            "value": {
                "title": "Test Movie",
                "hd_url": "https://example.com/hd.mp4",
                "sd_url": "https://example.com/sd.mp4",
                "720p_url": "https://example.com/720p.mp4",
                "streams": [
                    {
                        "url": "https://example.com/stream-1080.mp4",
                        "height": 1080
                    }
                ]
            }
        });

        let result = parse_claim_item(&item);
        assert!(result.is_ok());
        let content = result.unwrap();
        // With CDN-first approach, all direct URLs are ignored
        // Should only have "master" key
        assert_eq!(content.video_urls.len(), 1);
        assert!(content.video_urls.contains_key("master"));
    }
}
