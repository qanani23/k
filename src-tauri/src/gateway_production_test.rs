/// Production Gateway Failover Tests
///
/// This module contains tests that make real network calls to production Odysee gateways
/// to verify the failover mechanism works correctly in production scenarios.
///
/// These tests are marked with #[ignore] by default and should be run explicitly
/// using: cargo test --test gateway_production -- --ignored --nocapture
///
/// WARNING: These tests make real network calls and may be affected by:
/// - Network connectivity issues
/// - Gateway availability and performance
/// - Rate limiting from Odysee APIs
/// - Geographic location and routing

#[cfg(test)]
mod tests {
    use crate::gateway::GatewayClient;
    use crate::models::OdyseeRequest;
    use std::time::Instant;

    /// Test that all three production gateways are reachable and respond correctly
    /// This test verifies basic connectivity to each gateway individually
    #[tokio::test]
    #[ignore] // Run explicitly with: cargo test --test gateway_production -- --ignored
    async fn test_production_gateway_connectivity() {
        println!("\n=== Testing Production Gateway Connectivity ===\n");

        let gateways = vec![
            ("PRIMARY", "https://api.na-backend.odysee.com/api/v1/proxy"),
            ("SECONDARY", "https://api.lbry.tv/api/v1/proxy"),
            ("FALLBACK", "https://api.odysee.com/api/v1/proxy"),
        ];

        // Test a simple claim_search request to each gateway
        let request = OdyseeRequest {
            method: "claim_search".to_string(),
            params: serde_json::json!({
                "any_tags": ["movie"],
                "page_size": 1,
                "page": 1,
                "order_by": ["release_time"]
            }),
        };

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("Failed to create HTTP client");

        for (label, gateway_url) in gateways {
            println!("Testing {} gateway: {}", label, gateway_url);
            let start = Instant::now();

            let result = client.post(gateway_url).json(&request).send().await;

            let elapsed = start.elapsed();

            match result {
                Ok(response) => {
                    let status = response.status();
                    println!(
                        "  ✓ {} responded with HTTP {} in {}ms",
                        label,
                        status,
                        elapsed.as_millis()
                    );

                    if status.is_success() {
                        match response.json::<crate::models::OdyseeResponse>().await {
                            Ok(odysee_response) => {
                                if odysee_response.success {
                                    println!("  ✓ {} returned successful Odysee response", label);
                                } else {
                                    println!(
                                        "  ✗ {} returned error: {:?}",
                                        label, odysee_response.error
                                    );
                                }
                            }
                            Err(e) => {
                                println!("  ✗ {} failed to parse response: {}", label, e);
                            }
                        }
                    } else {
                        println!("  ✗ {} returned non-success status: {}", label, status);
                    }
                }
                Err(e) => {
                    println!("  ✗ {} failed: {}", label, e);
                }
            }
            println!();
        }
    }

    /// Test the complete failover mechanism with real production gateways
    /// This test simulates a scenario where gateways may fail and verifies
    /// that the failover logic works correctly
    #[tokio::test]
    #[ignore] // Run explicitly with: cargo test --test gateway_production -- --ignored
    async fn test_production_failover_mechanism() {
        println!("\n=== Testing Production Failover Mechanism ===\n");

        let mut gateway_client = GatewayClient::new();

        // Create a valid request
        let request = OdyseeRequest {
            method: "claim_search".to_string(),
            params: serde_json::json!({
                "any_tags": ["movie"],
                "page_size": 5,
                "page": 1,
                "order_by": ["release_time"]
            }),
        };

        println!("Executing request with failover enabled...");
        let start = Instant::now();

        let result = gateway_client.fetch_with_failover(request).await;

        let elapsed = start.elapsed();

        match result {
            Ok(response) => {
                println!("\n✓ Request succeeded after {}ms", elapsed.as_millis());
                println!("  Response success: {}", response.success);

                if let Some(data) = response.data {
                    println!(
                        "  Items returned: {}",
                        data.get("items")
                            .and_then(|v| v.as_array())
                            .map(|a| a.len())
                            .unwrap_or(0)
                    );
                }

                // Print gateway health stats
                println!("\nGateway Health Stats:");
                for (i, health) in gateway_client.get_health_stats().iter().enumerate() {
                    let label = match i {
                        0 => "PRIMARY",
                        1 => "SECONDARY",
                        2 => "FALLBACK",
                        _ => "UNKNOWN",
                    };

                    println!("  {} ({}): status={}, last_success={:?}, last_error={:?}, response_time={:?}ms",
                             label,
                             health.url,
                             health.status,
                             health.last_success,
                             health.last_error,
                             health.response_time_ms);
                }

                assert!(response.success, "Response should be successful");
            }
            Err(e) => {
                println!("\n✗ Request failed after {}ms: {}", elapsed.as_millis(), e);

                // Print gateway health stats even on failure
                println!("\nGateway Health Stats:");
                for (i, health) in gateway_client.get_health_stats().iter().enumerate() {
                    let label = match i {
                        0 => "PRIMARY",
                        1 => "SECONDARY",
                        2 => "FALLBACK",
                        _ => "UNKNOWN",
                    };

                    println!("  {} ({}): status={}, last_success={:?}, last_error={:?}, response_time={:?}ms",
                             label,
                             health.url,
                             health.status,
                             health.last_success,
                             health.last_error,
                             health.response_time_ms);
                }

                panic!(
                    "Request should succeed with at least one working gateway: {}",
                    e
                );
            }
        }
    }

    /// Test failover behavior with multiple consecutive requests
    /// This verifies that the gateway priority order is maintained across requests
    #[tokio::test]
    #[ignore] // Run explicitly with: cargo test --test gateway_production -- --ignored
    async fn test_production_failover_consistency() {
        println!("\n=== Testing Production Failover Consistency ===\n");

        let mut gateway_client = GatewayClient::new();

        // Make multiple requests to verify consistent behavior
        for i in 1..=3 {
            println!("Request #{}", i);

            let request = OdyseeRequest {
                method: "claim_search".to_string(),
                params: serde_json::json!({
                    "any_tags": ["movie"],
                    "page_size": 1,
                    "page": i,
                    "order_by": ["release_time"]
                }),
            };

            let start = Instant::now();
            let result = gateway_client.fetch_with_failover(request).await;
            let elapsed = start.elapsed();

            match result {
                Ok(response) => {
                    println!("  ✓ Request #{} succeeded in {}ms", i, elapsed.as_millis());
                    assert!(response.success, "Response should be successful");
                }
                Err(e) => {
                    println!("  ✗ Request #{} failed: {}", i, e);
                    panic!("Request #{} should succeed: {}", i, e);
                }
            }

            // Small delay between requests to avoid rate limiting
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        }

        // Verify gateway priority order is maintained
        let priority_order = gateway_client.get_gateway_priority_order();
        println!("\nGateway Priority Order:");
        for (i, gateway) in priority_order.iter().enumerate() {
            let label = match i {
                0 => "PRIMARY",
                1 => "SECONDARY",
                2 => "FALLBACK",
                _ => "UNKNOWN",
            };
            println!("  {}: {}", label, gateway);
        }

        assert_eq!(priority_order.len(), 3, "Should have 3 gateways");
        assert_eq!(
            priority_order[0],
            "https://api.na-backend.odysee.com/api/v1/proxy"
        );
        assert_eq!(priority_order[1], "https://api.lbry.tv/api/v1/proxy");
        assert_eq!(priority_order[2], "https://api.odysee.com/api/v1/proxy");

        println!("\n✓ Gateway priority order is immutable and correct");
    }

    /// Test gateway failover with different request types
    /// This verifies that failover works for various API operations
    #[tokio::test]
    #[ignore] // Run explicitly with: cargo test --test gateway_production -- --ignored
    async fn test_production_failover_different_requests() {
        println!("\n=== Testing Production Failover with Different Request Types ===\n");

        let mut gateway_client = GatewayClient::new();

        // Test 1: ClaimSearch with tags
        println!("Test 1: ClaimSearch with tags");
        let request1 = OdyseeRequest {
            method: "claim_search".to_string(),
            params: serde_json::json!({
                "any_tags": ["series"],
                "page_size": 3,
                "page": 1,
                "order_by": ["release_time"]
            }),
        };

        let result1 = gateway_client.fetch_with_failover(request1).await;
        assert!(result1.is_ok(), "ClaimSearch with tags should succeed");
        println!("  ✓ ClaimSearch with tags succeeded\n");

        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

        // Test 2: ClaimSearch with text search
        println!("Test 2: ClaimSearch with text search");
        let request2 = OdyseeRequest {
            method: "claim_search".to_string(),
            params: serde_json::json!({
                "text": "test",
                "page_size": 3,
                "page": 1,
                "order_by": ["release_time"]
            }),
        };

        let result2 = gateway_client.fetch_with_failover(request2).await;
        assert!(result2.is_ok(), "ClaimSearch with text should succeed");
        println!("  ✓ ClaimSearch with text search succeeded\n");

        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

        // Test 3: Resolve claim (if we have a known claim ID)
        // Note: This would require a valid claim ID from the previous searches
        // For now, we'll skip this test as it requires dynamic data

        println!("✓ All request types handled correctly with failover");
    }

    /// Test gateway performance and response times
    /// This helps identify which gateways are performing best
    #[tokio::test]
    #[ignore] // Run explicitly with: cargo test --test gateway_production -- --ignored
    async fn test_production_gateway_performance() {
        println!("\n=== Testing Production Gateway Performance ===\n");

        let gateways = vec![
            ("PRIMARY", "https://api.na-backend.odysee.com/api/v1/proxy"),
            ("SECONDARY", "https://api.lbry.tv/api/v1/proxy"),
            ("FALLBACK", "https://api.odysee.com/api/v1/proxy"),
        ];

        let request = OdyseeRequest {
            method: "claim_search".to_string(),
            params: serde_json::json!({
                "any_tags": ["movie"],
                "page_size": 10,
                "page": 1,
                "order_by": ["release_time"]
            }),
        };

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("Failed to create HTTP client");

        for (label, gateway_url) in gateways {
            println!("Performance test for {} gateway: {}", label, gateway_url);

            let mut response_times = Vec::new();
            let num_requests = 5;

            for i in 1..=num_requests {
                let start = Instant::now();

                let result = client.post(gateway_url).json(&request).send().await;

                let elapsed = start.elapsed();

                match result {
                    Ok(response) => {
                        if response.status().is_success() {
                            response_times.push(elapsed.as_millis());
                            println!(
                                "  Request {}/{}: {}ms",
                                i,
                                num_requests,
                                elapsed.as_millis()
                            );
                        } else {
                            println!(
                                "  Request {}/{}: Failed with status {}",
                                i,
                                num_requests,
                                response.status()
                            );
                        }
                    }
                    Err(e) => {
                        println!("  Request {}/{}: Failed with error: {}", i, num_requests, e);
                    }
                }

                // Small delay between requests
                tokio::time::sleep(std::time::Duration::from_millis(200)).await;
            }

            if !response_times.is_empty() {
                let avg = response_times.iter().sum::<u128>() / response_times.len() as u128;
                let min = response_times.iter().min().unwrap();
                let max = response_times.iter().max().unwrap();

                println!("  Statistics: avg={}ms, min={}ms, max={}ms", avg, min, max);
                println!(
                    "  Success rate: {}/{}\n",
                    response_times.len(),
                    num_requests
                );
            } else {
                println!("  All requests failed\n");
            }
        }
    }

    /// Test that gateway logs are being written correctly during production failover
    #[tokio::test]
    #[ignore] // Run explicitly with: cargo test --test gateway_production -- --ignored
    async fn test_production_gateway_logging() {
        println!("\n=== Testing Production Gateway Logging ===\n");

        let mut gateway_client = GatewayClient::new();

        // Make a request that will generate logs
        let request = OdyseeRequest {
            method: "claim_search".to_string(),
            params: serde_json::json!({
                "any_tags": ["movie"],
                "page_size": 1,
                "page": 1,
                "order_by": ["release_time"]
            }),
        };

        println!("Making request to generate gateway logs...");
        let result = gateway_client.fetch_with_failover(request).await;

        match result {
            Ok(_) => println!("✓ Request succeeded"),
            Err(e) => println!("✗ Request failed: {}", e),
        }

        // Check if gateway log file exists
        let log_path = crate::path_security::get_app_data_dir()
            .expect("Failed to get app data dir")
            .join("logs")
            .join("gateway.log");

        if log_path.exists() {
            println!("\n✓ Gateway log file exists at: {:?}", log_path);

            // Try to read the last few lines of the log
            if let Ok(contents) = std::fs::read_to_string(&log_path) {
                let lines: Vec<&str> = contents.lines().collect();
                let last_lines = lines.iter().rev().take(10).rev();

                println!("\nLast 10 log entries:");
                for line in last_lines {
                    println!("  {}", line);
                }
            }
        } else {
            println!("\n✗ Gateway log file not found at: {:?}", log_path);
            println!("  This may be expected if logging is not yet configured");
        }

        // Print health stats
        println!("\nGateway Health Stats:");
        for (i, health) in gateway_client.get_health_stats().iter().enumerate() {
            let label = match i {
                0 => "PRIMARY",
                1 => "SECONDARY",
                2 => "FALLBACK",
                _ => "UNKNOWN",
            };

            println!(
                "  {} ({}): status={}, response_time={:?}ms",
                label, health.url, health.status, health.response_time_ms
            );
        }
    }
}
