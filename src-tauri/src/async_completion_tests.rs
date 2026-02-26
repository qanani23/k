// Async completion verification tests
// Tests that all async Tauri commands complete properly without hanging

use crate::commands::*;
use std::time::Duration;
use tokio::time::timeout;

// Test timeout duration - commands should complete within this time
const TEST_TIMEOUT: Duration = Duration::from_secs(30);

#[tokio::test]
async fn test_test_connection_completes_within_timeout() {
    let result = timeout(TEST_TIMEOUT, test_connection()).await;
    
    assert!(result.is_ok(), "test_connection timed out after 30 seconds");
    let response = result.unwrap();
    assert!(response.is_ok(), "test_connection returned error: {:?}", response.err());
    assert_eq!(response.unwrap(), "tauri-backend-alive");
}

#[tokio::test]
async fn test_build_cdn_playback_url_test_completes_within_timeout() {
    let claim_id = "test-claim-123".to_string();
    
    let result = timeout(
        TEST_TIMEOUT,
        async { build_cdn_playback_url_test(claim_id.clone()) }
    ).await;
    
    assert!(result.is_ok(), "build_cdn_playback_url_test timed out after 30 seconds");
    let url = result.unwrap();
    assert!(url.contains(&claim_id), "URL should contain claim_id");
    assert!(url.contains("master.m3u8"), "URL should contain master.m3u8");
}

#[tokio::test]
async fn test_get_recent_crashes_completes_within_timeout() {
    let limit = 10usize;
    
    let result = timeout(TEST_TIMEOUT, get_recent_crashes(limit)).await;
    
    assert!(result.is_ok(), "get_recent_crashes timed out after 30 seconds");
    let crashes = result.unwrap();
    assert!(crashes.is_ok(), "get_recent_crashes returned error: {:?}", crashes.err());
}

#[tokio::test]
async fn test_clear_crash_log_completes_within_timeout() {
    let result = timeout(TEST_TIMEOUT, clear_crash_log()).await;
    
    assert!(result.is_ok(), "clear_crash_log timed out after 30 seconds");
    let clear_result = result.unwrap();
    assert!(clear_result.is_ok(), "clear_crash_log returned error: {:?}", clear_result.err());
}

// Test that async functions can be called concurrently
#[tokio::test]
async fn test_concurrent_async_calls_complete() {
    let handles: Vec<tokio::task::JoinHandle<()>> = vec![
        tokio::spawn(async move {
            let _ = test_connection().await;
        }),
        tokio::spawn(async move {
            let _ = build_cdn_playback_url_test("claim1".to_string());
        }),
        tokio::spawn(async move {
            let _ = test_connection().await;
        }),
        tokio::spawn(async move {
            let _ = build_cdn_playback_url_test("claim2".to_string());
        }),
    ];
    
    let result = timeout(TEST_TIMEOUT, async {
        for handle in handles {
            let _ = handle.await;
        }
    }).await;
    
    assert!(result.is_ok(), "Concurrent async calls timed out or blocked each other");
}

// Test that async functions return quickly for simple operations
#[tokio::test]
async fn test_simple_async_calls_return_quickly() {
    let quick_timeout = Duration::from_secs(1);
    
    let result = timeout(quick_timeout, test_connection()).await;
    assert!(result.is_ok(), "test_connection should complete within 1 second");
    
    let result = timeout(quick_timeout, async {
        build_cdn_playback_url_test("test".to_string())
    }).await;
    assert!(result.is_ok(), "build_cdn_playback_url_test should complete within 1 second");
}

// Test parsing functions complete without hanging
#[tokio::test]
async fn test_parsing_functions_complete() {
    use serde_json::json;
    use crate::models::OdyseeResponse;
    
    let response = OdyseeResponse {
        success: true,
        error: None,
        data: Some(json!({
            "items": []
        })),
    };
    
    let result = timeout(TEST_TIMEOUT, async {
        parse_claim_search_response(response)
    }).await;
    
    assert!(result.is_ok(), "parse_claim_search_response timed out");
}

#[tokio::test]
async fn test_playlist_parsing_completes() {
    use serde_json::json;
    use crate::models::OdyseeResponse;
    
    let response = OdyseeResponse {
        success: true,
        error: None,
        data: Some(json!({
            "items": []
        })),
    };
    
    let result = timeout(TEST_TIMEOUT, async {
        parse_playlist_search_response(response)
    }).await;
    
    assert!(result.is_ok(), "parse_playlist_search_response timed out");
}
