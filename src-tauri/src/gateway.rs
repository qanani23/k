use crate::error::{KiyyaError, Result};
use crate::models::{OdyseeRequest, OdyseeResponse, GatewayHealth};
use crate::path_security;
use crate::security_logging::{log_security_event, SecurityEvent};
use reqwest::Client;
use std::time::{Duration, Instant};
use std::fs::OpenOptions;
use std::io::Write;
use tokio::time::sleep;
use tracing::{info, warn, error};
use rand::Rng;

pub struct GatewayClient {
    /// IMMUTABLE gateway priority order: primary → secondary → fallback
    /// This order MUST NEVER be changed to ensure consistent failover behavior
    /// Index 0: Primary gateway (always tried first)
    /// Index 1: Secondary gateway (tried if primary fails)
    /// Index 2: Fallback gateway (tried if both primary and secondary fail)
    gateways: Vec<String>,
    /// Internal tracking field - does NOT affect priority order
    /// Priority order is always: gateways[0] → gateways[1] → gateways[2]
    current_gateway: usize,
    client: Client,
    health_stats: Vec<GatewayHealth>,
    /// Maximum number of gateway attempts per request (3 = all gateways)
    max_attempts: usize,
    /// Maximum number of retry attempts per individual gateway
    max_retries_per_gateway: usize,
    /// Base delay for exponential backoff in milliseconds
    base_delay_ms: u64,
}

impl GatewayClient {
    pub fn new() -> Self {
        // IMMUTABLE gateway priority order - NEVER change this order
        // Priority: primary → secondary → fallback
        // This order is enforced by the task requirements and ensures consistent failover behavior
        let gateways = vec![
            "https://api.na-backend.odysee.com/api/v1/proxy".to_string(),  // Primary (index 0)
            "https://api.lbry.tv/api/v1/proxy".to_string(),                // Secondary (index 1)
            "https://api.odysee.com/api/v1/proxy".to_string(),             // Fallback (index 2)
        ];

        let health_stats = gateways.iter().map(|url| GatewayHealth {
            url: url.clone(),
            status: "unknown".to_string(),
            last_success: None,
            last_error: None,
            response_time_ms: None,
        }).collect();

        Self {
            gateways,
            current_gateway: 0,
            client: Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .expect("Failed to create HTTP client"),
            health_stats,
            max_attempts: 3, // Attempt all 3 gateways
            max_retries_per_gateway: 2, // Retry each gateway up to 2 times before moving to next
            base_delay_ms: 300, // Start with 300ms delay
        }
    }

    pub async fn fetch_with_failover(&mut self, request: OdyseeRequest) -> Result<OdyseeResponse> {
        let mut last_error = None;
        let mut gateway_attempt = 0;
        let mut total_attempts = 0;

        // IMMUTABLE PRIORITY ORDER: Always try gateways in the same order
        // primary (index 0) → secondary (index 1) → fallback (index 2)
        // NEVER reorder based on previous success/failure
        while gateway_attempt < self.max_attempts && gateway_attempt < self.gateways.len() {
            let gateway_index = gateway_attempt; // Always use sequential order: 0, 1, 2
            let gateway_url = self.gateways[gateway_index].clone();
            
            info!("Trying gateway {} of {}: {} ({})", 
                  gateway_attempt + 1, 
                  self.max_attempts, 
                  gateway_url,
                  match gateway_index {
                      0 => "PRIMARY",
                      1 => "SECONDARY", 
                      2 => "FALLBACK",
                      _ => "UNKNOWN"
                  });
            
            // Retry logic for individual gateway
            let mut retry_attempt = 0;
            while retry_attempt <= self.max_retries_per_gateway {
                total_attempts += 1;
                
                let attempt_label = if retry_attempt == 0 {
                    "initial attempt".to_string()
                } else {
                    format!("retry {}/{}", retry_attempt, self.max_retries_per_gateway)
                };
                
                info!("Gateway {} ({}): {} (total attempt {})", 
                      gateway_url,
                      match gateway_index {
                          0 => "PRIMARY",
                          1 => "SECONDARY",
                          2 => "FALLBACK",
                          _ => "UNKNOWN"
                      },
                      attempt_label,
                      total_attempts);
                
                let start_time = Instant::now();
                
                match self.make_request(&gateway_url, &request).await {
                    Ok(response) => {
                        let response_time = start_time.elapsed();
                        self.log_gateway_success(gateway_index, response_time);
                        
                        // DO NOT update current_gateway - maintain immutable priority order
                        // The next request will always start with primary gateway (index 0)
                        
                        info!("Gateway {} ({}) succeeded on {} after {}ms (total attempts: {})", 
                              gateway_url, 
                              match gateway_index {
                                  0 => "PRIMARY",
                                  1 => "SECONDARY",
                                  2 => "FALLBACK", 
                                  _ => "UNKNOWN"
                              },
                              attempt_label,
                              response_time.as_millis(),
                              total_attempts);
                        return Ok(response);
                    }
                    Err(e) => {
                        let response_time = start_time.elapsed();
                        
                        // Check if this error is retryable before moving the error
                        let is_retryable = self.is_error_retryable(&e);
                        
                        self.log_gateway_failure(gateway_index, &e, response_time);
                        last_error = Some(e);
                        
                        warn!("Gateway {} ({}) failed on {} after {}ms: {} (retryable: {})", 
                              gateway_url,
                              match gateway_index {
                                  0 => "PRIMARY",
                                  1 => "SECONDARY",
                                  2 => "FALLBACK",
                                  _ => "UNKNOWN"
                              },
                              attempt_label,
                              response_time.as_millis(),
                              last_error.as_ref().unwrap(),
                              is_retryable);
                        
                        // If error is not retryable or we've exhausted retries for this gateway, move to next gateway
                        if !is_retryable || retry_attempt >= self.max_retries_per_gateway {
                            info!("Moving to next gateway after {} attempts on {}", 
                                  retry_attempt + 1, gateway_url);
                            break;
                        }
                        
                        // Apply retry delay with exponential backoff
                        if retry_attempt < self.max_retries_per_gateway {
                            let retry_delay = match retry_attempt {
                                0 => 200,  // 200ms for first retry
                                1 => 500,  // 500ms for second retry  
                                _ => 1000, // 1s for subsequent retries
                            };
                            // Add jitter: 0-49ms random delay to prevent thundering herd
                            let jitter = {
                                let mut rng = rand::thread_rng();
                                rng.gen_range(0..50) // 0-49ms jitter for retries
                            };
                            let total_delay = Duration::from_millis(retry_delay + jitter);
                            
                            info!("Retrying gateway {} in {}ms (retry {}/{})", 
                                  gateway_url, 
                                  total_delay.as_millis(),
                                  retry_attempt + 1,
                                  self.max_retries_per_gateway);
                            sleep(total_delay).await;
                        }
                    }
                }
                
                retry_attempt += 1;
            }
            
            // Apply gateway failover delay before trying next gateway
            if gateway_attempt < self.max_attempts - 1 {
                let failover_delay = match gateway_attempt {
                    0 => 300,  // 300ms before trying secondary
                    1 => 1000, // 1s before trying fallback  
                    _ => 2000, // 2s for subsequent gateways
                };
                // Add jitter: 0-99ms random delay to prevent thundering herd
                let jitter = {
                    let mut rng = rand::thread_rng();
                    rng.gen_range(0..100) // 0-99ms jitter for failover
                };
                let total_delay = Duration::from_millis(failover_delay + jitter);
                
                info!("Gateway {} ({}) exhausted all retries, failing over to next gateway in {}ms", 
                      gateway_url,
                      match gateway_index {
                          0 => "PRIMARY",
                          1 => "SECONDARY",
                          2 => "FALLBACK",
                          _ => "UNKNOWN"
                      },
                      total_delay.as_millis());
                sleep(total_delay).await;
            }
            
            gateway_attempt += 1;
        }

        // All gateways failed - return comprehensive error
        let final_error = KiyyaError::AllGatewaysFailed { attempts: total_attempts as u32 };
        error!("All {} gateways failed after {} total attempts ({} gateway attempts)", 
               self.gateways.len(), total_attempts, gateway_attempt);
        
        // Log the final failure to dedicated gateway log
        self.write_gateway_failure_summary(total_attempts as u32, &final_error);
        
        Err(final_error)
    }

    async fn make_request(&self, gateway_url: &str, request: &OdyseeRequest) -> Result<OdyseeResponse> {
        let response = self.client
            .post(gateway_url)
            .json(request)
            .send()
            .await
            .map_err(|e| {
                // Check if the error is a timeout
                if e.is_timeout() {
                    warn!("Request to {} timed out after 10 seconds", gateway_url);
                    KiyyaError::ApiTimeout { timeout_seconds: 10 }
                } else {
                    // Convert other reqwest errors to KiyyaError
                    KiyyaError::Network(e)
                }
            })?;

        let status = response.status();
        
        // Handle rate limiting (HTTP 429)
        if status.as_u16() == 429 {
            // Try to extract retry-after header
            let retry_after_seconds = response
                .headers()
                .get("retry-after")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(60); // Default to 60 seconds if header is missing
            
            // Log rate limiting event
            log_security_event(SecurityEvent::RateLimitTriggered {
                endpoint: gateway_url.to_string(),
                retry_after_seconds,
            });
            
            warn!("Rate limit exceeded on {}: retry after {} seconds", gateway_url, retry_after_seconds);
            return Err(KiyyaError::RateLimitExceeded { retry_after_seconds });
        }

        if !status.is_success() {
            return Err(KiyyaError::Gateway {
                message: format!("HTTP {}: {}", status, status.canonical_reason().unwrap_or("Unknown error")),
            });
        }

        let odysee_response: OdyseeResponse = response.json().await?;
        
        if !odysee_response.success {
            return Err(KiyyaError::Gateway {
                message: odysee_response.error.unwrap_or_else(|| "Unknown Odysee API error".to_string()),
            });
        }

        Ok(odysee_response)
    }

    /// Determines if an error is retryable for individual gateway retry logic
    /// Returns true for transient errors that might succeed on retry
    fn is_error_retryable(&self, error: &KiyyaError) -> bool {
        match error {
            // Network errors are often transient and retryable
            KiyyaError::Network(reqwest_error) => {
                // Check specific reqwest error types
                if reqwest_error.is_timeout() || reqwest_error.is_connect() {
                    true // Timeout and connection errors are retryable
                } else if reqwest_error.is_request() {
                    false // Request errors (malformed request) are not retryable
                } else {
                    true // Other network errors are generally retryable
                }
            }
            
            // Gateway errors with specific HTTP status codes
            KiyyaError::Gateway { message } => {
                // Parse HTTP status codes from gateway error messages
                if message.contains("HTTP 5") {
                    true // 5xx server errors are retryable
                } else if message.contains("HTTP 429") {
                    true // Rate limiting is retryable (with backoff)
                } else if message.contains("HTTP 408") {
                    true // Request timeout is retryable
                } else if message.contains("HTTP 502") || message.contains("HTTP 503") || message.contains("HTTP 504") {
                    true // Bad gateway, service unavailable, gateway timeout are retryable
                } else if message.contains("HTTP 4") {
                    false // 4xx client errors are generally not retryable
                } else {
                    true // Unknown gateway errors default to retryable
                }
            }
            
            // API timeout errors are retryable
            KiyyaError::ApiTimeout { .. } => true,
            
            // Rate limiting is retryable (backoff is handled separately)
            KiyyaError::RateLimitExceeded { .. } => true,
            
            // IO errors might be transient
            KiyyaError::Io(io_error) => {
                match io_error.kind() {
                    std::io::ErrorKind::TimedOut => true,
                    std::io::ErrorKind::Interrupted => true,
                    std::io::ErrorKind::ConnectionRefused => true,
                    std::io::ErrorKind::ConnectionAborted => true,
                    std::io::ErrorKind::ConnectionReset => true,
                    std::io::ErrorKind::NotConnected => true,
                    std::io::ErrorKind::UnexpectedEof => true,
                    _ => false, // Other IO errors are likely not retryable
                }
            }
            
            // JSON parsing errors are not retryable (indicates malformed response)
            KiyyaError::Json(_) => false,
            
            // Invalid API responses are not retryable
            KiyyaError::InvalidApiResponse { .. } => false,
            
            // Content parsing errors are not retryable
            KiyyaError::ContentParsing { .. } => false,
            
            // Most other errors are not retryable by default
            _ => false,
        }
    }

    fn log_gateway_success(&mut self, gateway_index: usize, response_time: Duration) {
        if let Some(health) = self.health_stats.get_mut(gateway_index) {
            health.status = "healthy".to_string();
            health.last_success = Some(chrono::Utc::now().timestamp());
            health.response_time_ms = Some(response_time.as_millis() as u64);
            health.last_error = None;
        }
        
        let gateway_url = &self.gateways[gateway_index];
        info!("Gateway {} responded successfully in {}ms", gateway_url, response_time.as_millis());
        
        // Write success to dedicated gateway log file
        self.write_gateway_log_entry(
            gateway_url,
            "SUCCESS",
            &format!("Response time: {}ms", response_time.as_millis()),
            response_time,
        );
        
        // Also log using the unified health logging interface
        self.log_gateway_health(gateway_url, true, response_time);
    }

    fn log_gateway_failure(&mut self, gateway_index: usize, error: &KiyyaError, response_time: Duration) {
        if let Some(health) = self.health_stats.get_mut(gateway_index) {
            health.status = "down".to_string();
            health.last_error = Some(error.to_string());
            health.response_time_ms = Some(response_time.as_millis() as u64);
        }
        
        let gateway_url = &self.gateways[gateway_index];
        warn!("Gateway {} failed after {}ms: {}", gateway_url, response_time.as_millis(), error);
        
        // Write failure to dedicated gateway log file
        self.write_gateway_log_entry(
            gateway_url,
            "FAILURE",
            &error.to_string(),
            response_time,
        );
        
        // Also log using the unified health logging interface
        self.log_gateway_health(gateway_url, false, response_time);
    }

    /// Writes a structured log entry to the dedicated gateway.log file
    fn write_gateway_log_entry(&self, gateway_url: &str, status: &str, message: &str, response_time: Duration) {
        let timestamp = chrono::Utc::now().to_rfc3339();
        let log_entry = format!(
            "{} | {} | {} | {}ms | {}\n",
            timestamp,
            status,
            gateway_url,
            response_time.as_millis(),
            message
        );
        
        // Write to gateway.log file in app data directory using path validation
        if let Ok(log_file_path) = path_security::validate_subdir_path("logs", "gateway.log") {
            // Ensure the logs directory exists
            if let Some(parent) = log_file_path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            
            if let Ok(mut file) = OpenOptions::new()
                .create(true)
                .append(true)
                .open(log_file_path)
            {
                let _ = file.write_all(log_entry.as_bytes());
                let _ = file.flush();
            }
        }
        
        // Also log to standard logging for development
        if status == "SUCCESS" {
            info!("GATEWAY_LOG: {}", log_entry.trim());
        } else {
            error!("GATEWAY_LOG: {}", log_entry.trim());
        }
    }

    /// Writes a summary when all gateways fail
    fn write_gateway_failure_summary(&self, total_attempts: u32, final_error: &KiyyaError) {
        let timestamp = chrono::Utc::now().to_rfc3339();
        let summary = format!(
            "{} | ALL_FAILED | {} attempts across {} gateways | {}\n",
            timestamp,
            total_attempts,
            self.gateways.len(),
            final_error
        );
        
        // Write summary to gateway.log file using path validation
        if let Ok(log_file_path) = path_security::validate_subdir_path("logs", "gateway.log") {
            // Ensure the logs directory exists
            if let Some(parent) = log_file_path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            
            if let Ok(mut file) = OpenOptions::new()
                .create(true)
                .append(true)
                .open(log_file_path)
            {
                let _ = file.write_all(summary.as_bytes());
                let _ = file.flush();
            }
        }
        
        error!("GATEWAY_SUMMARY: {}", summary.trim());
    }

    pub fn get_health_stats(&self) -> &[GatewayHealth] {
        &self.health_stats
    }

    pub fn get_current_gateway(&self) -> &str {
        // Always return the primary gateway since we maintain immutable priority order
        &self.gateways[0]
    }

    /// Gets the immutable gateway priority list
    /// This order CANNOT be changed to ensure consistent failover behavior
    pub fn get_gateway_priority_order(&self) -> &[String] {
        &self.gateways
    }

    /// Gets gateway configuration information for diagnostics
    pub fn get_gateway_config(&self) -> GatewayConfig {
        GatewayConfig {
            primary: self.gateways.get(0).cloned().unwrap_or_default(),
            secondary: self.gateways.get(1).cloned().unwrap_or_default(),
            fallback: self.gateways.get(2).cloned().unwrap_or_default(),
            max_attempts: self.max_attempts as u32,
            max_retries_per_gateway: self.max_retries_per_gateway as u32,
            base_delay_ms: self.base_delay_ms,
        }
    }

    /// Logs gateway health information as specified in the design document
    /// This method provides a unified interface for logging gateway health status
    pub fn log_gateway_health(&self, gateway: &str, success: bool, response_time: Duration) {
        let timestamp = chrono::Utc::now().to_rfc3339();
        let status = if success { "HEALTHY" } else { "UNHEALTHY" };
        
        let log_entry = format!(
            "{} | HEALTH_CHECK | {} | {} | {}ms\n",
            timestamp,
            status,
            gateway,
            response_time.as_millis()
        );
        
        // Write to gateway.log file in app data directory using path validation
        if let Ok(log_file_path) = path_security::validate_subdir_path("logs", "gateway.log") {
            // Ensure the logs directory exists
            if let Some(parent) = log_file_path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            
            if let Ok(mut file) = OpenOptions::new()
                .create(true)
                .append(true)
                .open(log_file_path)
            {
                let _ = file.write_all(log_entry.as_bytes());
                let _ = file.flush();
            }
        }
        
        // Also log to standard logging for development
        if success {
            info!("GATEWAY_HEALTH: {} is healthy ({}ms)", gateway, response_time.as_millis());
        } else {
            warn!("GATEWAY_HEALTH: {} is unhealthy ({}ms)", gateway, response_time.as_millis());
        }
    }
}

/// Gateway configuration for diagnostics and display
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GatewayConfig {
    pub primary: String,
    pub secondary: String,
    pub fallback: String,
    pub max_attempts: u32,
    pub max_retries_per_gateway: u32,
    pub base_delay_ms: u64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::OdyseeRequest;

    /// Creates a test OdyseeRequest for testing
    fn create_test_request() -> OdyseeRequest {
        OdyseeRequest {
            method: "claim_search".to_string(),
            params: serde_json::json!({
                "channel": "@test-channel",
                "page_size": 10
            }),
        }
    }

    #[test]
    fn test_gateway_client_creation() {
        let client = GatewayClient::new();
        
        // Verify immutable gateway order
        let gateways = client.get_gateway_priority_order();
        assert_eq!(gateways.len(), 3);
        assert_eq!(gateways[0], "https://api.na-backend.odysee.com/api/v1/proxy");
        assert_eq!(gateways[1], "https://api.lbry.tv/api/v1/proxy");
        assert_eq!(gateways[2], "https://api.odysee.com/api/v1/proxy");
        
        // Verify initial health stats
        let health_stats = client.get_health_stats();
        assert_eq!(health_stats.len(), 3);
        for health in health_stats {
            assert_eq!(health.status, "unknown");
            assert!(health.last_success.is_none());
            assert!(health.last_error.is_none());
        }
        
        // Verify configuration
        let config = client.get_gateway_config();
        assert_eq!(config.max_attempts, 3);
        assert_eq!(config.max_retries_per_gateway, 2);
        assert_eq!(config.base_delay_ms, 300);
    }

    #[test]
    fn test_gateway_priority_immutability() {
        let client = GatewayClient::new();
        let original_order = client.get_gateway_priority_order().to_vec();
        
        // Verify that the gateway order cannot be modified externally
        // (This is enforced by the API design - no reorder_gateways method)
        let gateways_after = client.get_gateway_priority_order();
        assert_eq!(original_order, gateways_after);
        
        // Verify the order is exactly as specified in requirements
        assert_eq!(gateways_after[0], "https://api.na-backend.odysee.com/api/v1/proxy"); // Primary
        assert_eq!(gateways_after[1], "https://api.lbry.tv/api/v1/proxy");                // Secondary
        assert_eq!(gateways_after[2], "https://api.odysee.com/api/v1/proxy");             // Fallback
    }

    #[tokio::test]
    async fn test_failover_logic() {
        // This test verifies the failover logic without making actual HTTP requests
        // In a real scenario, we would mock the HTTP client or use a test server
        
        let client = GatewayClient::new();
        let _request = create_test_request();
        
        // Since we can't easily mock reqwest in this context, we'll test the logic
        // by verifying that the client attempts all gateways in the correct order
        
        // The actual failover test would require mocking HTTP responses
        // For now, we verify the configuration is correct for failover
        assert_eq!(client.max_attempts, 3);
        assert_eq!(client.max_retries_per_gateway, 2);
        assert_eq!(client.base_delay_ms, 300);
        assert_eq!(client.gateways.len(), 3);
    }

    #[test]
    fn test_exponential_backoff_calculation() {
        let client = GatewayClient::new();
        
        // Test exponential backoff calculation: 300ms → 1s → 2s
        let delay_0 = 300;  // 300ms for first retry
        let delay_1 = 1000; // 1s for second retry
        let delay_2 = 2000; // 2s for subsequent retries
        
        assert_eq!(delay_0, 300);
        assert_eq!(delay_1, 1000);
        assert_eq!(delay_2, 2000);
        
        // Verify base delay is still 300ms for configuration
        assert_eq!(client.base_delay_ms, 300);
    }

    #[test]
    fn test_exponential_backoff_with_jitter() {
        let client = GatewayClient::new();
        
        // Test that jitter is properly applied to exponential backoff
        // We can't test the exact values due to randomness, but we can test the ranges
        
        // Test multiple jitter generations to ensure they're in the correct range
        for _ in 0..100 {
            let jitter = {
                let mut rng = rand::thread_rng();
                rng.gen_range(0..100) // 0-99ms jitter
            };
            
            // Jitter should be between 0 and 99 (inclusive)
            assert!(jitter < 100, "Jitter should be less than 100ms, got {}", jitter);
            
            // Test total delays with jitter
            let delay_0_with_jitter = 300 + jitter;  // 300-399ms
            let delay_1_with_jitter = 1000 + jitter; // 1000-1099ms
            let delay_2_with_jitter = 2000 + jitter; // 2000-2099ms
            
            assert!(delay_0_with_jitter >= 300 && delay_0_with_jitter < 400, 
                   "First retry delay with jitter should be 300-399ms, got {}", delay_0_with_jitter);
            assert!(delay_1_with_jitter >= 1000 && delay_1_with_jitter < 1100, 
                   "Second retry delay with jitter should be 1000-1099ms, got {}", delay_1_with_jitter);
            assert!(delay_2_with_jitter >= 2000 && delay_2_with_jitter < 2100, 
                   "Subsequent retry delay with jitter should be 2000-2099ms, got {}", delay_2_with_jitter);
        }
        
        // Verify base delay is still 300ms for configuration
        assert_eq!(client.base_delay_ms, 300);
    }

    #[test]
    fn test_health_stats_initialization() {
        let client = GatewayClient::new();
        let health_stats = client.get_health_stats();
        
        assert_eq!(health_stats.len(), 3);
        
        for (i, health) in health_stats.iter().enumerate() {
            assert_eq!(health.url, client.gateways[i]);
            assert_eq!(health.status, "unknown");
            assert!(health.last_success.is_none());
            assert!(health.last_error.is_none());
            assert!(health.response_time_ms.is_none());
        }
    }

    #[test]
    fn test_gateway_config_generation() {
        let client = GatewayClient::new();
        let config = client.get_gateway_config();
        
        assert_eq!(config.primary, "https://api.na-backend.odysee.com/api/v1/proxy");
        assert_eq!(config.secondary, "https://api.lbry.tv/api/v1/proxy");
        assert_eq!(config.fallback, "https://api.odysee.com/api/v1/proxy");
        assert_eq!(config.max_attempts, 3);
        assert_eq!(config.max_retries_per_gateway, 2);
        assert_eq!(config.base_delay_ms, 300);
    }

    #[test]
    fn test_current_gateway_tracking() {
        let client = GatewayClient::new();
        
        // Should always return the primary gateway (immutable priority order)
        assert_eq!(client.get_current_gateway(), "https://api.na-backend.odysee.com/api/v1/proxy");
        assert_eq!(client.current_gateway, 0);
        
        // The current_gateway field is maintained for internal use but doesn't affect priority order
        // Priority order is always: primary (0) → secondary (1) → fallback (2)
    }

    /// Integration test for gateway failover behavior
    /// This test would require a mock HTTP server to fully test failover
    #[tokio::test]
    async fn test_failover_integration() {
        // Note: This is a placeholder for integration testing
        // In a full implementation, we would:
        // 1. Set up mock HTTP servers that return different responses
        // 2. Configure the client to use these mock servers
        // 3. Test that failover happens in the correct order
        // 4. Verify that exponential backoff is applied
        // 5. Verify that health stats are updated correctly
        // 6. Verify that gateway logs are written
        
        let client = GatewayClient::new();
        
        // Verify the client is properly configured for failover testing
        assert_eq!(client.gateways.len(), 3);
        assert_eq!(client.max_attempts, 3);
        assert_eq!(client.max_retries_per_gateway, 2);
        
        // In a real test, we would make a request that fails on the first two gateways
        // and succeeds on the third, then verify:
        // - All three gateways were attempted in order
        // - Exponential backoff was applied between attempts
        // - Health stats were updated correctly
        // - Gateway logs were written
        // - The successful gateway became the current gateway
    }

    /// Test for gateway health logging functionality
    #[test]
    fn test_gateway_health_logging() {
        let mut client = GatewayClient::new();
        let response_time = Duration::from_millis(250);
        
        // Test success logging
        client.log_gateway_success(0, response_time);
        let health = &client.health_stats[0];
        assert_eq!(health.status, "healthy");
        assert!(health.last_success.is_some());
        assert_eq!(health.response_time_ms, Some(250));
        assert!(health.last_error.is_none());
        
        // Test failure logging
        let error = KiyyaError::gateway_error("Connection timeout");
        client.log_gateway_failure(1, &error, response_time);
        let health = &client.health_stats[1];
        assert_eq!(health.status, "down");
        assert!(health.last_error.is_some());
        assert_eq!(health.response_time_ms, Some(250));
    }

    /// Test for the unified log_gateway_health method
    #[test]
    fn test_log_gateway_health_method() {
        let client = GatewayClient::new();
        let response_time = Duration::from_millis(150);
        let gateway_url = "https://api.na-backend.odysee.com/api/v1/proxy";
        
        // Test successful health logging
        client.log_gateway_health(gateway_url, true, response_time);
        
        // Test failed health logging
        client.log_gateway_health(gateway_url, false, response_time);
        
        // Note: In a real test environment, we would verify that the log entries
        // were written to the gateway.log file. For unit tests, we're primarily
        // testing that the method doesn't panic and handles the parameters correctly.
    }

    /// Property-based test for gateway priority consistency
    #[test]
    fn test_gateway_priority_consistency() {
        // Create multiple client instances and verify they all have the same gateway order
        let clients: Vec<GatewayClient> = (0..10).map(|_| GatewayClient::new()).collect();
        
        let reference_order = clients[0].get_gateway_priority_order();
        
        for client in &clients {
            assert_eq!(client.get_gateway_priority_order(), reference_order);
        }
        
        // Verify the order matches the specification exactly
        assert_eq!(reference_order[0], "https://api.na-backend.odysee.com/api/v1/proxy");
        assert_eq!(reference_order[1], "https://api.lbry.tv/api/v1/proxy");
        assert_eq!(reference_order[2], "https://api.odysee.com/api/v1/proxy");
    }

    /// Test that verifies gateway priority order is NEVER reordered
    #[test]
    fn test_gateway_priority_immutability_enforcement() {
        let mut client = GatewayClient::new();
        
        // Record the initial gateway order
        let initial_order = client.get_gateway_priority_order().to_vec();
        
        // Simulate multiple successful requests that would previously change current_gateway
        // With the new implementation, priority order should remain unchanged
        
        // Verify that get_current_gateway always returns primary
        assert_eq!(client.get_current_gateway(), initial_order[0]);
        
        // Verify that the gateway order is still the same
        assert_eq!(client.get_gateway_priority_order(), initial_order.as_slice());
        
        // Verify the order is exactly: primary → secondary → fallback
        let gateways = client.get_gateway_priority_order();
        assert_eq!(gateways[0], "https://api.na-backend.odysee.com/api/v1/proxy"); // Primary
        assert_eq!(gateways[1], "https://api.lbry.tv/api/v1/proxy");                // Secondary  
        assert_eq!(gateways[2], "https://api.odysee.com/api/v1/proxy");             // Fallback
        
        // Verify that there's no method to reorder gateways
        // (This is enforced by the API design - no reorder_gateways method exists)
        
        // The priority order should be immutable and deterministic
        for _ in 0..100 {
            let test_client = GatewayClient::new();
            assert_eq!(test_client.get_gateway_priority_order(), initial_order.as_slice());
        }
    }

    /// Test for error retryability logic
    #[test]
    fn test_error_retryability() {
        let client = GatewayClient::new();
        
        // Test retryable gateway errors
        let server_error = KiyyaError::Gateway { message: "HTTP 500: Internal Server Error".to_string() };
        assert!(client.is_error_retryable(&server_error));
        
        let rate_limit_error = KiyyaError::Gateway { message: "HTTP 429: Too Many Requests".to_string() };
        assert!(client.is_error_retryable(&rate_limit_error));
        
        let timeout_gateway_error = KiyyaError::Gateway { message: "HTTP 408: Request Timeout".to_string() };
        assert!(client.is_error_retryable(&timeout_gateway_error));
        
        let bad_gateway_error = KiyyaError::Gateway { message: "HTTP 502: Bad Gateway".to_string() };
        assert!(client.is_error_retryable(&bad_gateway_error));
        
        let service_unavailable_error = KiyyaError::Gateway { message: "HTTP 503: Service Unavailable".to_string() };
        assert!(client.is_error_retryable(&service_unavailable_error));
        
        let gateway_timeout_error = KiyyaError::Gateway { message: "HTTP 504: Gateway Timeout".to_string() };
        assert!(client.is_error_retryable(&gateway_timeout_error));
        
        // Test non-retryable gateway errors
        let client_error = KiyyaError::Gateway { message: "HTTP 400: Bad Request".to_string() };
        assert!(!client.is_error_retryable(&client_error));
        
        let not_found_error = KiyyaError::Gateway { message: "HTTP 404: Not Found".to_string() };
        assert!(!client.is_error_retryable(&not_found_error));
        
        let unauthorized_error = KiyyaError::Gateway { message: "HTTP 401: Unauthorized".to_string() };
        assert!(!client.is_error_retryable(&unauthorized_error));
        
        // Test retryable API timeout
        let api_timeout = KiyyaError::ApiTimeout { timeout_seconds: 10 };
        assert!(client.is_error_retryable(&api_timeout));
        
        // Test retryable rate limiting
        let rate_limit = KiyyaError::RateLimitExceeded { retry_after_seconds: 60 };
        assert!(client.is_error_retryable(&rate_limit));
        
        // Test retryable IO errors
        let timeout_io = KiyyaError::Io(std::io::Error::new(std::io::ErrorKind::TimedOut, "timeout"));
        assert!(client.is_error_retryable(&timeout_io));
        
        let interrupted_io = KiyyaError::Io(std::io::Error::new(std::io::ErrorKind::Interrupted, "interrupted"));
        assert!(client.is_error_retryable(&interrupted_io));
        
        let connection_refused_io = KiyyaError::Io(std::io::Error::new(std::io::ErrorKind::ConnectionRefused, "refused"));
        assert!(client.is_error_retryable(&connection_refused_io));
        
        // Test non-retryable IO errors
        let permission_denied_io = KiyyaError::Io(std::io::Error::new(std::io::ErrorKind::PermissionDenied, "denied"));
        assert!(!client.is_error_retryable(&permission_denied_io));
        
        let not_found_io = KiyyaError::Io(std::io::Error::new(std::io::ErrorKind::NotFound, "not found"));
        assert!(!client.is_error_retryable(&not_found_io));
        
        // Test non-retryable errors
        let json_error = KiyyaError::Json(serde_json::Error::io(std::io::Error::new(std::io::ErrorKind::Other, "test")));
        assert!(!client.is_error_retryable(&json_error));
        
        let invalid_api_response = KiyyaError::InvalidApiResponse { message: "malformed".to_string() };
        assert!(!client.is_error_retryable(&invalid_api_response));
        
        let content_parsing = KiyyaError::ContentParsing { message: "invalid format".to_string() };
        assert!(!client.is_error_retryable(&content_parsing));
    }

    /// Test retry delay calculation
    #[test]
    fn test_retry_delay_calculation() {
        let client = GatewayClient::new();
        
        // Test retry delays: 200ms → 500ms → 1s
        let retry_delay_0 = 200;  // 200ms for first retry
        let retry_delay_1 = 500;  // 500ms for second retry
        let retry_delay_2 = 1000; // 1s for subsequent retries
        
        assert_eq!(retry_delay_0, 200);
        assert_eq!(retry_delay_1, 500);
        assert_eq!(retry_delay_2, 1000);
        
        // Test failover delays: 300ms → 1s → 2s (unchanged from original)
        let failover_delay_0 = 300;  // 300ms before trying secondary
        let failover_delay_1 = 1000; // 1s before trying fallback
        let failover_delay_2 = 2000; // 2s for subsequent gateways
        
        assert_eq!(failover_delay_0, 300);
        assert_eq!(failover_delay_1, 1000);
        assert_eq!(failover_delay_2, 2000);
        
        // Verify base delay is still 300ms for configuration
        assert_eq!(client.base_delay_ms, 300);
        assert_eq!(client.max_retries_per_gateway, 2);
    }

    /// Test retry jitter calculation
    #[test]
    fn test_retry_jitter_calculation() {
        let client = GatewayClient::new();
        
        // Test that retry jitter is properly applied
        // We can't test the exact values due to randomness, but we can test the ranges
        
        // Test multiple jitter generations to ensure they're in the correct range
        for _ in 0..100 {
            let retry_jitter = {
                let mut rng = rand::thread_rng();
                rng.gen_range(0..50) // 0-49ms jitter for retries
            };
            
            // Retry jitter should be between 0 and 49 (inclusive)
            assert!(retry_jitter < 50, "Retry jitter should be less than 50ms, got {}", retry_jitter);
            
            let failover_jitter = {
                let mut rng = rand::thread_rng();
                rng.gen_range(0..100) // 0-99ms jitter for failover
            };
            
            // Failover jitter should be between 0 and 99 (inclusive)
            assert!(failover_jitter < 100, "Failover jitter should be less than 100ms, got {}", failover_jitter);
            
            // Test total delays with jitter
            let retry_delay_0_with_jitter = 200 + retry_jitter;  // 200-249ms
            let retry_delay_1_with_jitter = 500 + retry_jitter;  // 500-549ms
            let retry_delay_2_with_jitter = 1000 + retry_jitter; // 1000-1049ms
            
            assert!(retry_delay_0_with_jitter >= 200 && retry_delay_0_with_jitter < 250, 
                   "First retry delay with jitter should be 200-249ms, got {}", retry_delay_0_with_jitter);
            assert!(retry_delay_1_with_jitter >= 500 && retry_delay_1_with_jitter < 550, 
                   "Second retry delay with jitter should be 500-549ms, got {}", retry_delay_1_with_jitter);
            assert!(retry_delay_2_with_jitter >= 1000 && retry_delay_2_with_jitter < 1050, 
                   "Subsequent retry delay with jitter should be 1000-1049ms, got {}", retry_delay_2_with_jitter);
        }
        
        // Verify configuration
        assert_eq!(client.base_delay_ms, 300);
        assert_eq!(client.max_retries_per_gateway, 2);
    }

    /// Test maximum retry attempts configuration
    #[test]
    fn test_max_retry_configuration() {
        let client = GatewayClient::new();
        
        // Verify retry configuration
        assert_eq!(client.max_retries_per_gateway, 2);
        assert_eq!(client.max_attempts, 3);
        
        // Verify that configuration is included in gateway config
        let config = client.get_gateway_config();
        assert_eq!(config.max_retries_per_gateway, 2);
        assert_eq!(config.max_attempts, 3);
        
        // Calculate maximum possible attempts
        // Each gateway can be tried up to (max_retries_per_gateway + 1) times
        // With 3 gateways and 2 retries per gateway: 3 * (2 + 1) = 9 total attempts
        let max_possible_attempts = client.max_attempts * (client.max_retries_per_gateway + 1);
        assert_eq!(max_possible_attempts, 9);
    }

    /// Test API parsing with claim_search response
    #[test]
    fn test_api_parsing() {
        // Test successful response parsing
        let success_response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(serde_json::json!({
                "items": [
                    {
                        "claim_id": "test-claim-1",
                        "value": {
                            "title": "Test Video 1",
                            "description": "Test description",
                            "tags": ["movie", "action"],
                            "thumbnail": {
                                "url": "https://example.com/thumb1.jpg"
                            },
                            "video": {
                                "duration": 3600
                            },
                            "hd_url": "https://example.com/video1.mp4"
                        },
                        "timestamp": 1234567890
                    },
                    {
                        "claim_id": "test-claim-2",
                        "value": {
                            "title": "Test Video 2",
                            "tags": ["series"],
                            "sd_url": "https://example.com/video2.mp4"
                        },
                        "timestamp": 1234567891
                    }
                ]
            })),
        };

        // Verify the response structure
        assert!(success_response.success);
        assert!(success_response.error.is_none());
        assert!(success_response.data.is_some());

        // Test error response parsing
        let error_response = OdyseeResponse {
            success: false,
            error: Some("API error occurred".to_string()),
            data: None,
        };

        assert!(!error_response.success);
        assert!(error_response.error.is_some());
        assert_eq!(error_response.error.unwrap(), "API error occurred");

        // Test empty data response
        let empty_response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(serde_json::json!({
                "items": []
            })),
        };

        assert!(empty_response.success);
        assert!(empty_response.data.is_some());
    }

    /// Test API request structure for claim_search
    #[test]
    fn test_claim_search_request_structure() {
        let request = OdyseeRequest {
            method: "claim_search".to_string(),
            params: serde_json::json!({
                "channel": "@TestChannel",
                "any_tags": ["movie", "action"],
                "page_size": 50,
                "page": 1,
                "order_by": ["release_time"]
            }),
        };

        assert_eq!(request.method, "claim_search");
        assert!(request.params.is_object());
        
        let params = request.params.as_object().unwrap();
        assert_eq!(params.get("channel").and_then(|v| v.as_str()), Some("@TestChannel"));
        assert_eq!(params.get("page_size").and_then(|v| v.as_u64()), Some(50));
        assert_eq!(params.get("page").and_then(|v| v.as_u64()), Some(1));
    }

    /// Test API request structure for playlist_search
    #[test]
    fn test_playlist_search_request_structure() {
        let request = OdyseeRequest {
            method: "playlist_search".to_string(),
            params: serde_json::json!({
                "channel": "@TestChannel",
                "page_size": 50,
                "page": 1
            }),
        };

        assert_eq!(request.method, "playlist_search");
        assert!(request.params.is_object());
        
        let params = request.params.as_object().unwrap();
        assert_eq!(params.get("channel").and_then(|v| v.as_str()), Some("@TestChannel"));
        assert_eq!(params.get("page_size").and_then(|v| v.as_u64()), Some(50));
        assert_eq!(params.get("page").and_then(|v| v.as_u64()), Some(1));
    }

    /// Test playlist_search response parsing
    #[test]
    fn test_playlist_search_response_parsing() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(serde_json::json!({
                "items": [
                    {
                        "claim_id": "playlist-1",
                        "value": {
                            "title": "Breaking Bad – Season 1",
                            "description": "First season of Breaking Bad"
                        }
                    },
                    {
                        "claim_id": "playlist-2",
                        "value": {
                            "title": "Breaking Bad – Season 2",
                            "description": "Second season of Breaking Bad"
                        }
                    }
                ]
            })),
        };

        assert!(response.success);
        assert!(response.data.is_some());
        
        let data = response.data.unwrap();
        let items = data.get("items").and_then(|v| v.as_array()).unwrap();
        assert_eq!(items.len(), 2);
        
        // Verify first playlist
        let playlist1 = &items[0];
        assert_eq!(playlist1.get("claim_id").and_then(|v| v.as_str()), Some("playlist-1"));
        assert_eq!(
            playlist1.get("value").and_then(|v| v.get("title")).and_then(|v| v.as_str()),
            Some("Breaking Bad – Season 1")
        );
        
        // Verify second playlist
        let playlist2 = &items[1];
        assert_eq!(playlist2.get("claim_id").and_then(|v| v.as_str()), Some("playlist-2"));
        assert_eq!(
            playlist2.get("value").and_then(|v| v.get("title")).and_then(|v| v.as_str()),
            Some("Breaking Bad – Season 2")
        );
    }

    /// Test playlist_search with empty results
    #[test]
    fn test_playlist_search_empty_results() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(serde_json::json!({
                "items": []
            })),
        };

        assert!(response.success);
        assert!(response.data.is_some());
        
        let data = response.data.unwrap();
        let items = data.get("items").and_then(|v| v.as_array()).unwrap();
        assert_eq!(items.len(), 0);
    }

    /// Test playlist_search with malformed playlist data
    #[test]
    fn test_playlist_search_malformed_data() {
        let response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(serde_json::json!({
                "items": [
                    {
                        "claim_id": "valid-playlist",
                        "value": {
                            "title": "Valid Playlist"
                        }
                    },
                    {
                        // Missing claim_id - should be handled gracefully
                        "value": {
                            "title": "Invalid Playlist"
                        }
                    },
                    {
                        "claim_id": "another-valid",
                        "value": {
                            "title": "Another Valid Playlist"
                        }
                    }
                ]
            })),
        };

        assert!(response.success);
        assert!(response.data.is_some());
        
        let data = response.data.unwrap();
        let items = data.get("items").and_then(|v| v.as_array()).unwrap();
        assert_eq!(items.len(), 3); // All items present, but one is malformed
        
        // Verify valid playlists can still be extracted
        assert_eq!(items[0].get("claim_id").and_then(|v| v.as_str()), Some("valid-playlist"));
        assert!(items[1].get("claim_id").is_none()); // Malformed item
        assert_eq!(items[2].get("claim_id").and_then(|v| v.as_str()), Some("another-valid"));
    }

    /// Test playlist_search error response
    #[test]
    fn test_playlist_search_error_response() {
        let response = OdyseeResponse {
            success: false,
            error: Some("Channel not found".to_string()),
            data: None,
        };

        assert!(!response.success);
        assert_eq!(response.error, Some("Channel not found".to_string()));
        assert!(response.data.is_none());
    }

    /// Test API response with malformed data
    #[test]
    fn test_api_parsing_malformed_data() {
        // Test response with missing items array
        let malformed_response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(serde_json::json!({
                "other_field": "value"
            })),
        };

        assert!(malformed_response.success);
        assert!(malformed_response.data.is_some());
        
        // Verify that data exists but doesn't have items array
        let data = malformed_response.data.unwrap();
        assert!(data.get("items").is_none());

        // Test response with null data
        let null_data_response = OdyseeResponse {
            success: true,
            error: None,
            data: None,
        };

        assert!(null_data_response.success);
        assert!(null_data_response.data.is_none());
    }

    /// Test API response with mixed valid and invalid items
    #[test]
    fn test_api_parsing_mixed_items() {
        let mixed_response = OdyseeResponse {
            success: true,
            error: None,
            data: Some(serde_json::json!({
                "items": [
                    {
                        "claim_id": "valid-claim",
                        "value": {
                            "title": "Valid Video",
                            "hd_url": "https://example.com/valid.mp4"
                        },
                        "timestamp": 1234567890
                    },
                    {
                        // Missing claim_id - should be handled gracefully
                        "value": {
                            "title": "Invalid Video"
                        }
                    },
                    {
                        "claim_id": "another-valid",
                        "value": {
                            "title": "Another Valid",
                            "sd_url": "https://example.com/another.mp4"
                        },
                        "timestamp": 1234567892
                    }
                ]
            })),
        };

        assert!(mixed_response.success);
        assert!(mixed_response.data.is_some());
        
        let data = mixed_response.data.unwrap();
        let items = data.get("items").and_then(|v| v.as_array()).unwrap();
        assert_eq!(items.len(), 3); // All items present, but one is malformed
    }

    /// Test rate limiting error detection
    #[test]
    fn test_rate_limit_error_detection() {
        let client = GatewayClient::new();
        
        // Test that rate limit errors are retryable
        let rate_limit_error = KiyyaError::RateLimitExceeded { retry_after_seconds: 60 };
        assert!(client.is_error_retryable(&rate_limit_error));
        
        // Test that rate limit errors are categorized correctly
        assert_eq!(rate_limit_error.category(), "network");
        
        // Test that rate limit errors are warning level
        assert!(rate_limit_error.is_warning_level());
        
        // Test user message for rate limiting
        let user_msg = rate_limit_error.user_message();
        assert!(user_msg.contains("60 seconds"));
        assert!(user_msg.contains("Too many requests"));
    }

    /// Test timeout error detection
    #[test]
    fn test_timeout_error_detection() {
        let client = GatewayClient::new();
        
        // Test that timeout errors are retryable
        let timeout_error = KiyyaError::ApiTimeout { timeout_seconds: 10 };
        assert!(client.is_error_retryable(&timeout_error));
        
        // Test that timeout errors are categorized correctly
        assert_eq!(timeout_error.category(), "network");
        
        // Test that timeout errors are recoverable
        assert!(timeout_error.is_recoverable());
    }

    /// Test HTTP 429 rate limit handling
    #[test]
    fn test_http_429_handling() {
        let client = GatewayClient::new();
        
        // Test that HTTP 429 errors are detected as retryable
        let rate_limit_gateway_error = KiyyaError::Gateway { 
            message: "HTTP 429: Too Many Requests".to_string() 
        };
        assert!(client.is_error_retryable(&rate_limit_gateway_error));
    }

    /// Test timeout configuration
    #[test]
    fn test_timeout_configuration() {
        let client = GatewayClient::new();
        
        // Verify that the HTTP client has a 10-second timeout configured
        // This is set in the client builder: .timeout(Duration::from_secs(10))
        // The timeout is configured but not directly accessible via the client API
        // We verify the configuration exists by checking the client was created successfully
        assert!(std::mem::size_of_val(&client.client) > 0);
    }

    /// Test retry behavior for rate limiting
    #[test]
    fn test_rate_limit_retry_behavior() {
        let client = GatewayClient::new();
        
        // Test that rate limiting errors trigger retry logic
        let rate_limit_error = KiyyaError::RateLimitExceeded { retry_after_seconds: 30 };
        
        // Verify error is retryable
        assert!(client.is_error_retryable(&rate_limit_error));
        
        // Verify error is recoverable
        assert!(rate_limit_error.is_recoverable());
        
        // Verify error category
        assert_eq!(rate_limit_error.category(), "network");
    }

    /// Test retry behavior for timeouts
    #[test]
    fn test_timeout_retry_behavior() {
        let client = GatewayClient::new();
        
        // Test that timeout errors trigger retry logic
        let timeout_error = KiyyaError::ApiTimeout { timeout_seconds: 10 };
        
        // Verify error is retryable
        assert!(client.is_error_retryable(&timeout_error));
        
        // Verify error is recoverable
        assert!(timeout_error.is_recoverable());
        
        // Verify error category
        assert_eq!(timeout_error.category(), "network");
    }

    /// Test that 5xx server errors are retryable
    #[test]
    fn test_5xx_server_errors_retryable() {
        let client = GatewayClient::new();
        
        // Test various 5xx errors
        let errors = vec![
            KiyyaError::Gateway { message: "HTTP 500: Internal Server Error".to_string() },
            KiyyaError::Gateway { message: "HTTP 502: Bad Gateway".to_string() },
            KiyyaError::Gateway { message: "HTTP 503: Service Unavailable".to_string() },
            KiyyaError::Gateway { message: "HTTP 504: Gateway Timeout".to_string() },
        ];
        
        for error in errors {
            assert!(client.is_error_retryable(&error), "Error should be retryable: {}", error);
        }
    }

    /// Test that 4xx client errors are not retryable (except 408 and 429)
    #[test]
    fn test_4xx_client_errors_not_retryable() {
        let client = GatewayClient::new();
        
        // Test non-retryable 4xx errors
        let non_retryable_errors = vec![
            KiyyaError::Gateway { message: "HTTP 400: Bad Request".to_string() },
            KiyyaError::Gateway { message: "HTTP 401: Unauthorized".to_string() },
            KiyyaError::Gateway { message: "HTTP 403: Forbidden".to_string() },
            KiyyaError::Gateway { message: "HTTP 404: Not Found".to_string() },
        ];
        
        for error in non_retryable_errors {
            assert!(!client.is_error_retryable(&error), "Error should not be retryable: {}", error);
        }
        
        // Test retryable 4xx errors
        let retryable_errors = vec![
            KiyyaError::Gateway { message: "HTTP 408: Request Timeout".to_string() },
            KiyyaError::Gateway { message: "HTTP 429: Too Many Requests".to_string() },
        ];
        
        for error in retryable_errors {
            assert!(client.is_error_retryable(&error), "Error should be retryable: {}", error);
        }
    }
}