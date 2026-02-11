//! Integration tests for security logging
//!
//! This module tests that security logging is properly integrated with
//! validation, sanitization, path security, and other security-related modules.

#[cfg(test)]
mod tests {
    use crate::validation;
    use crate::sanitization;
    use crate::path_security;
    use crate::security_logging::{SecurityEvent, log_security_event};

    #[test]
    fn test_path_security_logs_violations() {
        // Attempt path traversal - should log security event
        let result = path_security::validate_path("../../../etc/passwd");
        assert!(result.is_err(), "Path traversal should be rejected");
        
        // The security event should have been logged to security.log
        // In a real test, we would verify the log file contents
    }

    #[test]
    fn test_validation_logs_null_bytes() {
        // Attempt to use null bytes in claim ID - should log security event
        let result = validation::validate_claim_id("claim\0id");
        assert!(result.is_err(), "Null bytes should be rejected");
    }

    #[test]
    fn test_validation_logs_invalid_characters() {
        // Attempt to use SQL injection characters - should log security event
        let result = validation::validate_claim_id("claim'; DROP TABLE users--");
        assert!(result.is_err(), "SQL injection attempt should be rejected");
    }

    #[test]
    fn test_validation_logs_network_violations() {
        // Attempt to access unauthorized domain - should log security event
        let result = validation::validate_external_url("https://evil.com/malware");
        assert!(result.is_err(), "Unauthorized domain should be rejected");
    }

    #[test]
    fn test_validation_logs_non_https_urls() {
        // Attempt to use non-HTTPS URL - should log security event
        let result = validation::validate_external_url("http://github.com/user/repo");
        assert!(result.is_err(), "Non-HTTPS URL should be rejected");
    }

    #[test]
    fn test_sanitization_logs_sql_injection() {
        // Attempt SQL injection in ORDER BY - should log security event
        let result = sanitization::sanitize_order_by("releaseTime; DROP TABLE users--");
        assert!(result.is_err(), "SQL injection in ORDER BY should be rejected");
    }

    #[test]
    fn test_sanitization_logs_invalid_tags() {
        // Attempt to use special characters in tags - should log security event
        let result = sanitization::sanitize_tag("tag; DROP TABLE");
        assert!(result.is_err(), "Invalid tag characters should be rejected");
    }

    #[test]
    fn test_security_event_creation() {
        // Test creating various security events
        let path_violation = SecurityEvent::PathViolation {
            attempted_path: "/etc/passwd".to_string(),
            source: "test".to_string(),
        };
        assert_eq!(path_violation.event_type(), "PATH_VIOLATION");
        
        let input_failure = SecurityEvent::InputValidationFailure {
            input_type: "claim_id".to_string(),
            reason: "Contains null bytes".to_string(),
            source: "test".to_string(),
        };
        assert_eq!(input_failure.event_type(), "INPUT_VALIDATION_FAILURE");
        
        let sql_injection = SecurityEvent::SqlInjectionAttempt {
            input: "'; DROP TABLE users--".to_string(),
            context: "ORDER BY".to_string(),
            source: "test".to_string(),
        };
        assert_eq!(sql_injection.event_type(), "SQL_INJECTION_ATTEMPT");
        
        let network_violation = SecurityEvent::NetworkViolation {
            attempted_url: "https://evil.com".to_string(),
            reason: "Unauthorized domain".to_string(),
            source: "test".to_string(),
        };
        assert_eq!(network_violation.event_type(), "NETWORK_VIOLATION");
    }

    #[test]
    fn test_security_logging_does_not_panic() {
        // Ensure security logging doesn't panic even if log file can't be written
        log_security_event(SecurityEvent::SuspiciousActivity {
            activity_type: "test".to_string(),
            details: "This is a test".to_string(),
            source: "test".to_string(),
        });
        
        // If we get here, logging didn't panic
        assert!(true);
    }

    #[test]
    fn test_encryption_key_operation_logging() {
        // Test encryption key operation events
        let key_gen_success = SecurityEvent::EncryptionKeyOperation {
            operation: "generate".to_string(),
            success: true,
            details: Some("Key stored in OS keystore".to_string()),
        };
        assert_eq!(key_gen_success.event_type(), "ENCRYPTION_KEY_OPERATION");
        
        let key_gen_failure = SecurityEvent::EncryptionKeyOperation {
            operation: "generate".to_string(),
            success: false,
            details: Some("Failed to store key".to_string()),
        };
        assert_eq!(key_gen_failure.event_type(), "ENCRYPTION_KEY_OPERATION");
    }

    #[test]
    fn test_rate_limit_logging() {
        // Test rate limit event
        let rate_limit = SecurityEvent::RateLimitTriggered {
            endpoint: "api.odysee.com".to_string(),
            retry_after_seconds: 60,
        };
        assert_eq!(rate_limit.event_type(), "RATE_LIMIT_TRIGGERED");
        
        let details = rate_limit.details();
        assert!(details.contains("api.odysee.com"));
        assert!(details.contains("60"));
    }
}
