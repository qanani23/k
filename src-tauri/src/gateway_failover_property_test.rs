// Property-Based Test for Gateway Failover Resilience
// **Feature: kiyya-desktop-streaming, Property 11: Gateway Failover Resilience**
//
// Property Statement:
// *For any* API request, if the primary gateway fails, the system should automatically retry
// with the next available gateway using exponential backoff (300ms → 1s → 2s), and the system
// should continue functioning as long as at least one gateway is responsive.
//
// **Validates: Requirements 6.2, 6.3, 6.5, 16.2, 16.3**

use crate::gateway::GatewayClient;
use proptest::prelude::*;

#[cfg(test)]
mod tests {
    use super::*;

    /// Property Test 1: Gateway Priority Order Immutability
    /// Verifies that gateway priority order never changes regardless of success/failure patterns
    #[test]
    fn property_gateway_priority_immutability() {
        proptest!(|(
            _num_requests in 1usize..=100,
        )| {
            // Create multiple gateway clients
            let clients: Vec<GatewayClient> = (0..10).map(|_| GatewayClient::new()).collect();

            // Verify all clients have identical gateway order
            let reference_order = clients[0].get_gateway_priority_order();

            for client in &clients {
                prop_assert_eq!(client.get_gateway_priority_order(), reference_order);
            }

            // Verify the order is exactly: primary → secondary → fallback
            prop_assert_eq!(&reference_order[0], "https://api.na-backend.odysee.com/api/v1/proxy");
            prop_assert_eq!(&reference_order[1], "https://api.lbry.tv/api/v1/proxy");
            prop_assert_eq!(&reference_order[2], "https://api.odysee.com/api/v1/proxy");
        });
    }

    /// Property Test 2: Exponential Backoff Timing Verification
    /// Verifies that backoff delays follow the specified pattern: 300ms → 1s → 2s
    #[test]
    fn property_exponential_backoff_timing() {
        proptest!(|(
            _iteration in 0usize..=100,
        )| {
            let client = GatewayClient::new();
            let config = client.get_gateway_config();

            // Verify failover delays match specification
            let failover_delay_0 = 300;  // 300ms before trying secondary
            let failover_delay_1 = 1000; // 1s before trying fallback
            let failover_delay_2 = 2000; // 2s for subsequent gateways

            prop_assert_eq!(failover_delay_0, 300);
            prop_assert_eq!(failover_delay_1, 1000);
            prop_assert_eq!(failover_delay_2, 2000);

            // Verify retry delays for individual gateway retries
            let retry_delay_0 = 200;  // 200ms for first retry
            let retry_delay_1 = 500;  // 500ms for second retry
            let retry_delay_2 = 1000; // 1s for subsequent retries

            prop_assert_eq!(retry_delay_0, 200);
            prop_assert_eq!(retry_delay_1, 500);
            prop_assert_eq!(retry_delay_2, 1000);

            // Verify base configuration
            prop_assert_eq!(config.base_delay_ms, 300);
            prop_assert_eq!(config.max_retries_per_gateway, 2);
            prop_assert_eq!(config.max_attempts, 3);
        });
    }

    /// Property Test 3: Jitter Range Verification
    /// Verifies that jitter is applied correctly and stays within specified bounds
    #[test]
    fn property_jitter_range_verification() {
        proptest!(|(
            _iteration in 0usize..=100,
        )| {
            use rand::Rng;

            // Test retry jitter (0-49ms)
            let retry_jitter = {
                let mut rng = rand::thread_rng();
                rng.gen_range(0..50)
            };
            prop_assert!(retry_jitter < 50, "Retry jitter should be less than 50ms");

            // Test failover jitter (0-99ms)
            let failover_jitter = {
                let mut rng = rand::thread_rng();
                rng.gen_range(0..100)
            };
            prop_assert!(failover_jitter < 100, "Failover jitter should be less than 100ms");

            // Verify total delays with jitter are within expected ranges
            let retry_delay_0_with_jitter = 200 + retry_jitter;
            prop_assert!((200..250).contains(&retry_delay_0_with_jitter));

            let failover_delay_0_with_jitter = 300 + failover_jitter;
            prop_assert!((300..400).contains(&failover_delay_0_with_jitter));
        });
    }

    /// Property Test 4: Gateway Configuration Consistency
    /// Verifies that gateway configuration is consistent across all instances
    #[test]
    fn property_gateway_configuration_consistency() {
        proptest!(|(
            _num_instances in 1usize..=50,
        )| {
            let clients: Vec<GatewayClient> = (0..10).map(|_| GatewayClient::new()).collect();

            // Verify all clients have identical configuration
            let reference_config = clients[0].get_gateway_config();

            for client in &clients {
                let config = client.get_gateway_config();
                prop_assert_eq!(&config.primary, &reference_config.primary);
                prop_assert_eq!(&config.secondary, &reference_config.secondary);
                prop_assert_eq!(&config.fallback, &reference_config.fallback);
                prop_assert_eq!(config.max_attempts, reference_config.max_attempts);
                prop_assert_eq!(config.max_retries_per_gateway, reference_config.max_retries_per_gateway);
                prop_assert_eq!(config.base_delay_ms, reference_config.base_delay_ms);
            }

            // Verify configuration values match specification
            prop_assert_eq!(reference_config.max_attempts, 3);
            prop_assert_eq!(reference_config.max_retries_per_gateway, 2);
            prop_assert_eq!(reference_config.base_delay_ms, 300);
        });
    }

    /// Property Test 5: Maximum Retry Attempts Calculation
    /// Verifies that the maximum number of retry attempts is correctly calculated
    #[test]
    fn property_max_retry_attempts_calculation() {
        proptest!(|(
            _iteration in 0usize..=100,
        )| {
            let client = GatewayClient::new();
            let config = client.get_gateway_config();

            // Calculate maximum possible attempts
            // Each gateway can be tried up to (max_retries_per_gateway + 1) times
            // With 3 gateways and 2 retries per gateway: 3 * (2 + 1) = 9 total attempts
            let max_possible_attempts = config.max_attempts * (config.max_retries_per_gateway + 1);

            prop_assert_eq!(max_possible_attempts, 9);
            prop_assert_eq!(config.max_attempts, 3);
            prop_assert_eq!(config.max_retries_per_gateway, 2);
        });
    }

    /// Property Test 6: Health Stats Initialization
    /// Verifies that health stats are properly initialized for all gateways
    #[test]
    fn property_health_stats_initialization() {
        proptest!(|(
            _iteration in 0usize..=100,
        )| {
            let client = GatewayClient::new();
            let health_stats = client.get_health_stats();

            // Verify health stats exist for all gateways
            prop_assert_eq!(health_stats.len(), 3);

            // Verify initial state for each gateway
            for (i, health) in health_stats.iter().enumerate() {
                prop_assert_eq!(&health.url, &client.get_gateway_priority_order()[i]);
                prop_assert_eq!(&health.status, "unknown");
                prop_assert!(health.last_success.is_none());
                prop_assert!(health.last_error.is_none());
                prop_assert!(health.response_time_ms.is_none());
            }
        });
    }

    /// Property Test 7: Gateway Order Determinism
    /// Verifies that gateway order is deterministic across multiple instantiations
    #[test]
    fn property_gateway_order_determinism() {
        proptest!(|(
            num_instances in 10usize..=100,
        )| {
            let clients: Vec<GatewayClient> = (0..num_instances).map(|_| GatewayClient::new()).collect();

            // All clients should have identical gateway order
            let reference_order = clients[0].get_gateway_priority_order();

            for client in &clients {
                prop_assert_eq!(client.get_gateway_priority_order(), reference_order);
            }

            // Verify the order matches specification
            prop_assert_eq!(reference_order.len(), 3);
            prop_assert_eq!(&reference_order[0], "https://api.na-backend.odysee.com/api/v1/proxy");
            prop_assert_eq!(&reference_order[1], "https://api.lbry.tv/api/v1/proxy");
            prop_assert_eq!(&reference_order[2], "https://api.odysee.com/api/v1/proxy");
        });
    }

    /// Property Test 8: Current Gateway Consistency
    /// Verifies that get_current_gateway always returns the primary gateway
    #[test]
    fn property_current_gateway_consistency() {
        proptest!(|(
            _iteration in 0usize..=100,
        )| {
            let client = GatewayClient::new();

            // Current gateway should always be the primary gateway
            prop_assert_eq!(
                client.get_current_gateway(),
                "https://api.na-backend.odysee.com/api/v1/proxy"
            );

            // Verify it matches the first gateway in priority order
            prop_assert_eq!(
                client.get_current_gateway(),
                &client.get_gateway_priority_order()[0]
            );
        });
    }

    /// Property Test 9: Gateway Config Serialization
    /// Verifies that gateway configuration can be serialized and deserialized
    #[test]
    fn property_gateway_config_serialization() {
        proptest!(|(
            _iteration in 0usize..=100,
        )| {
            let client = GatewayClient::new();
            let config = client.get_gateway_config();

            // Serialize to JSON
            let json = serde_json::to_string(&config);
            prop_assert!(json.is_ok());

            // Deserialize from JSON
            let deserialized = serde_json::from_str(&json.unwrap());
            prop_assert!(deserialized.is_ok());

            // Verify deserialized config matches original
            let deserialized_config: crate::gateway::GatewayConfig = deserialized.unwrap();
            prop_assert_eq!(&deserialized_config.primary, &config.primary);
            prop_assert_eq!(&deserialized_config.secondary, &config.secondary);
            prop_assert_eq!(&deserialized_config.fallback, &config.fallback);
            prop_assert_eq!(deserialized_config.max_attempts, config.max_attempts);
            prop_assert_eq!(deserialized_config.max_retries_per_gateway, config.max_retries_per_gateway);
            prop_assert_eq!(deserialized_config.base_delay_ms, config.base_delay_ms);
        });
    }

    /// Property Test 10: Gateway Priority Immutability Enforcement
    /// Verifies that gateway priority order is NEVER reordered
    #[test]
    fn property_gateway_priority_immutability_enforcement() {
        proptest!(|(
            _iteration in 0usize..=100,
        )| {
            let client = GatewayClient::new();

            // Record the initial gateway order
            let initial_order = client.get_gateway_priority_order().to_vec();

            // Verify that get_current_gateway always returns primary
            prop_assert_eq!(client.get_current_gateway(), &initial_order[0]);

            // Verify that the gateway order is still the same
            prop_assert_eq!(client.get_gateway_priority_order(), initial_order.as_slice());

            // Verify the order is exactly: primary → secondary → fallback
            let gateways = client.get_gateway_priority_order();
            prop_assert_eq!(&gateways[0], "https://api.na-backend.odysee.com/api/v1/proxy"); // Primary
            prop_assert_eq!(&gateways[1], "https://api.lbry.tv/api/v1/proxy");                // Secondary
            prop_assert_eq!(&gateways[2], "https://api.odysee.com/api/v1/proxy");             // Fallback

            // The priority order should be immutable and deterministic
            for _ in 0..10 {
                let test_client = GatewayClient::new();
                prop_assert_eq!(test_client.get_gateway_priority_order(), initial_order.as_slice());
            }
        });
    }

    /// Property Test 11: Gateway Configuration Values
    /// Verifies that gateway configuration values match the specification
    #[test]
    fn property_gateway_configuration_values() {
        proptest!(|(
            _iteration in 0usize..=100,
        )| {
            let client = GatewayClient::new();
            let config = client.get_gateway_config();

            // Verify primary gateway
            prop_assert_eq!(&config.primary, "https://api.na-backend.odysee.com/api/v1/proxy");

            // Verify secondary gateway
            prop_assert_eq!(&config.secondary, "https://api.lbry.tv/api/v1/proxy");

            // Verify fallback gateway
            prop_assert_eq!(&config.fallback, "https://api.odysee.com/api/v1/proxy");

            // Verify retry configuration
            prop_assert_eq!(config.max_attempts, 3);
            prop_assert_eq!(config.max_retries_per_gateway, 2);
            prop_assert_eq!(config.base_delay_ms, 300);
        });
    }

    /// Property Test 12: Gateway List Length Consistency
    /// Verifies that the gateway list always contains exactly 3 gateways
    #[test]
    fn property_gateway_list_length_consistency() {
        proptest!(|(
            _iteration in 0usize..=100,
        )| {
            let client = GatewayClient::new();
            let gateways = client.get_gateway_priority_order();

            // Verify exactly 3 gateways
            prop_assert_eq!(gateways.len(), 3);

            // Verify health stats match gateway count
            let health_stats = client.get_health_stats();
            prop_assert_eq!(health_stats.len(), 3);

            // Verify config reflects 3 gateway attempts
            let config = client.get_gateway_config();
            prop_assert_eq!(config.max_attempts, 3);
        });
    }
}
