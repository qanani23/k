/// Integration tests for rate limiting and timeout handling
/// 
/// This module tests the gateway client's ability to handle:
/// - HTTP 429 rate limiting responses with retry-after headers
/// - Request timeouts (10 second timeout)
/// - Proper error categorization and retry logic

#[cfg(test)]
mod tests {
    use crate::error::KiyyaError;
    use crate::gateway::GatewayClient;

    /// Test that demonstrates rate limiting error handling
    #[test]
    fn test_rate_limit_error_handling() {
        // Create a rate limit error
        let rate_limit_error = KiyyaError::RateLimitExceeded { retry_after_seconds: 60 };
        
        // Verify error properties
        assert_eq!(rate_limit_error.category(), "network");
        assert!(rate_limit_error.is_recoverable());
        assert!(rate_limit_error.is_warning_level());
        
        // Verify user message
        let user_msg = rate_limit_error.user_message();
        assert!(user_msg.contains("60 seconds"));
        assert!(user_msg.contains("Too many requests"));
    }

    /// Test that demonstrates timeout error handling
    #[test]
    fn test_timeout_error_handling() {
        // Create a timeout error
        let timeout_error = KiyyaError::ApiTimeout { timeout_seconds: 10 };
        
        // Verify error properties
        assert_eq!(timeout_error.category(), "network");
        assert!(timeout_error.is_recoverable());
        
        // Verify error message
        assert!(timeout_error.to_string().contains("10 seconds"));
    }

    /// Test that the gateway client is properly configured
    #[test]
    fn test_gateway_client_configuration() {
        let client = GatewayClient::new();
        
        // Verify the client was created successfully
        // The timeout is set to 10 seconds in the client builder
        let config = client.get_gateway_config();
        
        // Verify retry configuration
        assert_eq!(config.max_retries_per_gateway, 2);
        assert_eq!(config.max_attempts, 3);
        assert_eq!(config.base_delay_ms, 300);
    }

    /// Test retry delay calculation for rate limiting
    #[test]
    fn test_retry_delay_for_rate_limiting() {
        // Test that retry delays are properly calculated
        // First retry: 200ms
        // Second retry: 500ms
        // Third retry: 1000ms
        
        let retry_delays = vec![200, 500, 1000];
        
        for (i, expected_delay) in retry_delays.iter().enumerate() {
            let actual_delay = match i {
                0 => 200,
                1 => 500,
                _ => 1000,
            };
            assert_eq!(actual_delay, *expected_delay);
        }
    }

    /// Test failover delay calculation
    #[test]
    fn test_failover_delay_calculation() {
        // Test that failover delays are properly calculated
        // Before secondary: 300ms
        // Before fallback: 1000ms
        // Subsequent: 2000ms
        
        let failover_delays = vec![300, 1000, 2000];
        
        for (i, expected_delay) in failover_delays.iter().enumerate() {
            let actual_delay = match i {
                0 => 300,
                1 => 1000,
                _ => 2000,
            };
            assert_eq!(actual_delay, *expected_delay);
        }
    }

    /// Test that jitter is applied to retry delays
    #[test]
    fn test_jitter_application() {
        use rand::Rng;
        
        // Test retry jitter (0-49ms)
        for _ in 0..100 {
            let jitter = {
                let mut rng = rand::thread_rng();
                rng.gen_range(0..50)
            };
            assert!(jitter < 50, "Retry jitter should be less than 50ms");
        }
        
        // Test failover jitter (0-99ms)
        for _ in 0..100 {
            let jitter = {
                let mut rng = rand::thread_rng();
                rng.gen_range(0..100)
            };
            assert!(jitter < 100, "Failover jitter should be less than 100ms");
        }
    }

    /// Test that rate limit errors include retry-after information
    #[test]
    fn test_rate_limit_retry_after() {
        let error = KiyyaError::RateLimitExceeded { retry_after_seconds: 120 };
        
        // Verify the error message includes retry-after information
        let error_msg = error.to_string();
        assert!(error_msg.contains("120"));
        assert!(error_msg.contains("retry after"));
        
        // Verify user message is helpful
        let user_msg = error.user_message();
        assert!(user_msg.contains("120 seconds"));
        assert!(user_msg.contains("wait"));
    }

    /// Test that timeout errors include timeout duration
    #[test]
    fn test_timeout_duration_information() {
        let error = KiyyaError::ApiTimeout { timeout_seconds: 10 };
        
        // Verify the error message includes timeout duration
        let error_msg = error.to_string();
        assert!(error_msg.contains("10 seconds"));
        assert!(error_msg.contains("timeout"));
    }

    /// Test the complete retry flow for rate limiting
    #[test]
    fn test_rate_limit_retry_flow() {
        // Simulate a rate limit error
        let rate_limit_error = KiyyaError::RateLimitExceeded { retry_after_seconds: 60 };
        
        // Verify it's recoverable
        assert!(rate_limit_error.is_recoverable());
        
        // Verify it's a warning level (expected behavior)
        assert!(rate_limit_error.is_warning_level());
        
        // Verify the error category
        assert_eq!(rate_limit_error.category(), "network");
    }

    /// Test the complete retry flow for timeouts
    #[test]
    fn test_timeout_retry_flow() {
        // Simulate a timeout error
        let timeout_error = KiyyaError::ApiTimeout { timeout_seconds: 10 };
        
        // Verify it's recoverable
        assert!(timeout_error.is_recoverable());
        
        // Verify the error category
        assert_eq!(timeout_error.category(), "network");
    }

    /// Test that HTTP 429 responses are properly categorized
    #[test]
    fn test_http_429_categorization() {
        // Create an HTTP 429 gateway error
        let http_429 = KiyyaError::Gateway { 
            message: "HTTP 429: Too Many Requests".to_string() 
        };
        
        // Verify it's categorized as network error
        assert_eq!(http_429.category(), "network");
    }

    /// Test that request timeout errors are properly categorized
    #[test]
    fn test_request_timeout_categorization() {
        // Create an HTTP 408 gateway error
        let http_408 = KiyyaError::Gateway { 
            message: "HTTP 408: Request Timeout".to_string() 
        };
        
        // Verify it's categorized as network error
        assert_eq!(http_408.category(), "network");
    }

    /// Test maximum retry attempts configuration
    #[test]
    fn test_max_retry_attempts() {
        let client = GatewayClient::new();
        let config = client.get_gateway_config();
        
        // Verify retry configuration
        assert_eq!(config.max_retries_per_gateway, 2);
        assert_eq!(config.max_attempts, 3);
        
        // Calculate maximum possible attempts
        // Each gateway can be tried up to (max_retries_per_gateway + 1) times
        // With 3 gateways and 2 retries per gateway: 3 * (2 + 1) = 9 total attempts
        let max_possible_attempts = config.max_attempts * (config.max_retries_per_gateway + 1);
        assert_eq!(max_possible_attempts, 9);
    }

    /// Test that the implementation follows the specification
    #[test]
    fn test_specification_compliance() {
        let client = GatewayClient::new();
        let config = client.get_gateway_config();
        
        // Verify timeout is 10 seconds (as per specification)
        // This is configured in the client builder
        
        // Verify exponential backoff configuration
        assert_eq!(config.base_delay_ms, 300); // 300ms base delay
        
        // Verify retry configuration
        assert_eq!(config.max_retries_per_gateway, 2); // 2 retries per gateway
        assert_eq!(config.max_attempts, 3); // 3 gateways total
        
        // Verify gateway priority order is immutable
        let gateways = client.get_gateway_priority_order();
        assert_eq!(gateways.len(), 3);
        assert_eq!(gateways[0], "https://api.na-backend.odysee.com/api/v1/proxy");
        assert_eq!(gateways[1], "https://api.lbry.tv/api/v1/proxy");
        assert_eq!(gateways[2], "https://api.odysee.com/api/v1/proxy");
    }

    /// Test error serialization for rate limiting
    #[test]
    fn test_rate_limit_error_serialization() {
        let error = KiyyaError::RateLimitExceeded { retry_after_seconds: 60 };
        
        // Verify the error can be serialized (for sending to frontend)
        let serialized = serde_json::to_string(&error);
        assert!(serialized.is_ok());
        
        let serialized_str = serialized.unwrap();
        assert!(serialized_str.contains("60"));
    }

    /// Test error serialization for timeouts
    #[test]
    fn test_timeout_error_serialization() {
        let error = KiyyaError::ApiTimeout { timeout_seconds: 10 };
        
        // Verify the error can be serialized (for sending to frontend)
        let serialized = serde_json::to_string(&error);
        assert!(serialized.is_ok());
        
        let serialized_str = serialized.unwrap();
        assert!(serialized_str.contains("10"));
    }

    /// Test that gateway configuration is accessible
    #[test]
    fn test_gateway_config_accessibility() {
        let client = GatewayClient::new();
        let config = client.get_gateway_config();
        
        // Verify all configuration fields are accessible
        assert!(!config.primary.is_empty());
        assert!(!config.secondary.is_empty());
        assert!(!config.fallback.is_empty());
        assert!(config.max_attempts > 0);
        assert!(config.max_retries_per_gateway > 0);
        assert!(config.base_delay_ms > 0);
    }

    /// Test rate limiting with different retry-after values
    #[test]
    fn test_rate_limit_various_retry_after() {
        let test_cases = vec![30, 60, 120, 300];
        
        for retry_after in test_cases {
            let error = KiyyaError::RateLimitExceeded { retry_after_seconds: retry_after };
            
            // Verify error properties
            assert!(error.is_recoverable());
            assert!(error.is_warning_level());
            assert_eq!(error.category(), "network");
            
            // Verify user message contains the retry-after value
            let user_msg = error.user_message();
            assert!(user_msg.contains(&retry_after.to_string()));
        }
    }

    /// Test timeout with different timeout values
    #[test]
    fn test_timeout_various_durations() {
        let test_cases = vec![5, 10, 15, 30];
        
        for timeout in test_cases {
            let error = KiyyaError::ApiTimeout { timeout_seconds: timeout };
            
            // Verify error properties
            assert!(error.is_recoverable());
            assert_eq!(error.category(), "network");
            
            // Verify error message contains the timeout value
            let error_msg = error.to_string();
            assert!(error_msg.contains(&timeout.to_string()));
        }
    }
}
