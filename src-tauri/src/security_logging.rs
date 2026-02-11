//! Security Logging Module
//!
//! This module provides dedicated security event logging for the Kiyya application.
//! All security-related events are logged to a separate security.log file for audit purposes.
//!
//! ## Security Events Logged
//!
//! - Path security violations (attempts to access files outside app data directory)
//! - Input validation failures (malformed inputs, injection attempts)
//! - SQL injection attempts (detected through sanitization failures)
//! - Network security violations (attempts to access unauthorized domains)
//! - Encryption key operations (key generation, access, deletion)
//! - Authentication/authorization failures
//!
//! ## Log Format
//!
//! Security logs use a structured format:
//! ```
//! TIMESTAMP | SEVERITY | EVENT_TYPE | DETAILS | SOURCE
//! ```
//!
//! ## Usage
//!
//! ```rust
//! use crate::security_logging::{log_security_event, SecurityEvent, SecuritySeverity};
//!
//! // Log a path security violation
//! log_security_event(SecurityEvent::PathViolation {
//!     attempted_path: "/etc/passwd".to_string(),
//!     source: "validate_path".to_string(),
//! });
//!
//! // Log an input validation failure
//! log_security_event(SecurityEvent::InputValidationFailure {
//!     input_type: "claim_id".to_string(),
//!     reason: "Contains null bytes".to_string(),
//!     source: "validate_claim_id".to_string(),
//! });
//! ```

use crate::path_security;
use std::fs::OpenOptions;
use std::io::Write;
use tracing::{warn, error, info};

/// Security event types that can be logged
#[derive(Debug, Clone)]
pub enum SecurityEvent {
    /// Path security violation - attempt to access files outside app data directory
    PathViolation {
        attempted_path: String,
        source: String,
    },
    
    /// Input validation failure - malformed or suspicious input
    InputValidationFailure {
        input_type: String,
        reason: String,
        source: String,
    },
    
    /// SQL injection attempt detected
    SqlInjectionAttempt {
        input: String,
        context: String,
        source: String,
    },
    
    /// Network security violation - attempt to access unauthorized domain
    NetworkViolation {
        attempted_url: String,
        reason: String,
        source: String,
    },
    
    /// Encryption key operation
    EncryptionKeyOperation {
        operation: String, // "generate", "access", "delete", "export", "import"
        success: bool,
        details: Option<String>,
    },
    
    /// Authentication failure (for future use)
    AuthenticationFailure {
        reason: String,
        source: String,
    },
    
    /// Authorization failure (for future use)
    AuthorizationFailure {
        resource: String,
        reason: String,
        source: String,
    },
    
    /// Rate limiting triggered
    RateLimitTriggered {
        endpoint: String,
        retry_after_seconds: u64,
    },
    
    /// Suspicious activity detected
    SuspiciousActivity {
        activity_type: String,
        details: String,
        source: String,
    },
}

/// Security event severity levels
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SecuritySeverity {
    /// Informational - normal security operations
    Info,
    /// Warning - suspicious but not necessarily malicious
    Warning,
    /// Critical - confirmed security violation or attack attempt
    Critical,
}

impl SecurityEvent {
    /// Determines the severity level of a security event
    pub fn severity(&self) -> SecuritySeverity {
        match self {
            SecurityEvent::PathViolation { .. } => SecuritySeverity::Critical,
            SecurityEvent::InputValidationFailure { .. } => SecuritySeverity::Warning,
            SecurityEvent::SqlInjectionAttempt { .. } => SecuritySeverity::Critical,
            SecurityEvent::NetworkViolation { .. } => SecuritySeverity::Critical,
            SecurityEvent::EncryptionKeyOperation { success, .. } => {
                if *success {
                    SecuritySeverity::Info
                } else {
                    SecuritySeverity::Warning
                }
            }
            SecurityEvent::AuthenticationFailure { .. } => SecuritySeverity::Warning,
            SecurityEvent::AuthorizationFailure { .. } => SecuritySeverity::Warning,
            SecurityEvent::RateLimitTriggered { .. } => SecuritySeverity::Info,
            SecurityEvent::SuspiciousActivity { .. } => SecuritySeverity::Warning,
        }
    }
    
    /// Returns the event type as a string
    pub fn event_type(&self) -> &str {
        match self {
            SecurityEvent::PathViolation { .. } => "PATH_VIOLATION",
            SecurityEvent::InputValidationFailure { .. } => "INPUT_VALIDATION_FAILURE",
            SecurityEvent::SqlInjectionAttempt { .. } => "SQL_INJECTION_ATTEMPT",
            SecurityEvent::NetworkViolation { .. } => "NETWORK_VIOLATION",
            SecurityEvent::EncryptionKeyOperation { .. } => "ENCRYPTION_KEY_OPERATION",
            SecurityEvent::AuthenticationFailure { .. } => "AUTHENTICATION_FAILURE",
            SecurityEvent::AuthorizationFailure { .. } => "AUTHORIZATION_FAILURE",
            SecurityEvent::RateLimitTriggered { .. } => "RATE_LIMIT_TRIGGERED",
            SecurityEvent::SuspiciousActivity { .. } => "SUSPICIOUS_ACTIVITY",
        }
    }
    
    /// Formats the event details as a string
    pub fn details(&self) -> String {
        match self {
            SecurityEvent::PathViolation { attempted_path, source } => {
                format!("Attempted to access path '{}' from {}", attempted_path, source)
            }
            SecurityEvent::InputValidationFailure { input_type, reason, source } => {
                format!("Validation failed for {} in {}: {}", input_type, source, reason)
            }
            SecurityEvent::SqlInjectionAttempt { input, context, source } => {
                format!("Possible SQL injection in {} from {}: '{}'", context, source, input)
            }
            SecurityEvent::NetworkViolation { attempted_url, reason, source } => {
                format!("Network violation from {}: {} - {}", source, attempted_url, reason)
            }
            SecurityEvent::EncryptionKeyOperation { operation, success, details } => {
                let status = if *success { "SUCCESS" } else { "FAILURE" };
                let detail_str = details.as_ref().map(|d| format!(" - {}", d)).unwrap_or_default();
                format!("Encryption key {}: {}{}", operation, status, detail_str)
            }
            SecurityEvent::AuthenticationFailure { reason, source } => {
                format!("Authentication failed from {}: {}", source, reason)
            }
            SecurityEvent::AuthorizationFailure { resource, reason, source } => {
                format!("Authorization failed for resource '{}' from {}: {}", resource, source, reason)
            }
            SecurityEvent::RateLimitTriggered { endpoint, retry_after_seconds } => {
                format!("Rate limit triggered for {}: retry after {} seconds", endpoint, retry_after_seconds)
            }
            SecurityEvent::SuspiciousActivity { activity_type, details, source } => {
                format!("Suspicious activity '{}' from {}: {}", activity_type, source, details)
            }
        }
    }
}

/// Logs a security event to the dedicated security.log file
///
/// This function writes security events to a separate log file for audit purposes.
/// Events are also logged to the standard logging system based on severity.
///
/// # Arguments
///
/// * `event` - The security event to log
///
/// # Examples
///
/// ```rust
/// log_security_event(SecurityEvent::PathViolation {
///     attempted_path: "/etc/passwd".to_string(),
///     source: "validate_path".to_string(),
/// });
/// ```
pub fn log_security_event(event: SecurityEvent) {
    let timestamp = chrono::Utc::now().to_rfc3339();
    let severity = event.severity();
    let event_type = event.event_type();
    let details = event.details();
    
    let severity_str = match severity {
        SecuritySeverity::Info => "INFO",
        SecuritySeverity::Warning => "WARNING",
        SecuritySeverity::Critical => "CRITICAL",
    };
    
    let log_entry = format!(
        "{} | {} | {} | {}\n",
        timestamp,
        severity_str,
        event_type,
        details
    );
    
    // Write to security.log file in app data directory using path validation
    if let Ok(log_file_path) = path_security::validate_subdir_path("logs", "security.log") {
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
    
    // Also log to standard logging system based on severity
    match severity {
        SecuritySeverity::Info => {
            info!("SECURITY: {}", log_entry.trim());
        }
        SecuritySeverity::Warning => {
            warn!("SECURITY: {}", log_entry.trim());
        }
        SecuritySeverity::Critical => {
            error!("SECURITY: {}", log_entry.trim());
        }
    }
}

/// Logs multiple security events in batch
///
/// This is useful when multiple related security events need to be logged together.
pub fn log_security_events(events: Vec<SecurityEvent>) {
    for event in events {
        log_security_event(event);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_security_event_severity() {
        let path_violation = SecurityEvent::PathViolation {
            attempted_path: "/etc/passwd".to_string(),
            source: "test".to_string(),
        };
        assert_eq!(path_violation.severity(), SecuritySeverity::Critical);
        
        let input_failure = SecurityEvent::InputValidationFailure {
            input_type: "claim_id".to_string(),
            reason: "Invalid format".to_string(),
            source: "test".to_string(),
        };
        assert_eq!(input_failure.severity(), SecuritySeverity::Warning);
        
        let key_op_success = SecurityEvent::EncryptionKeyOperation {
            operation: "generate".to_string(),
            success: true,
            details: None,
        };
        assert_eq!(key_op_success.severity(), SecuritySeverity::Info);
        
        let key_op_failure = SecurityEvent::EncryptionKeyOperation {
            operation: "access".to_string(),
            success: false,
            details: Some("Key not found".to_string()),
        };
        assert_eq!(key_op_failure.severity(), SecuritySeverity::Warning);
    }

    #[test]
    fn test_security_event_type() {
        let event = SecurityEvent::SqlInjectionAttempt {
            input: "'; DROP TABLE users--".to_string(),
            context: "search_query".to_string(),
            source: "test".to_string(),
        };
        assert_eq!(event.event_type(), "SQL_INJECTION_ATTEMPT");
    }

    #[test]
    fn test_security_event_details() {
        let event = SecurityEvent::NetworkViolation {
            attempted_url: "https://evil.com/malware".to_string(),
            reason: "Domain not in approved list".to_string(),
            source: "validate_external_url".to_string(),
        };
        let details = event.details();
        assert!(details.contains("evil.com"));
        assert!(details.contains("validate_external_url"));
    }

    #[test]
    fn test_log_security_event() {
        // This test just verifies the function doesn't panic
        let event = SecurityEvent::RateLimitTriggered {
            endpoint: "api.odysee.com".to_string(),
            retry_after_seconds: 60,
        };
        log_security_event(event);
    }

    #[test]
    fn test_log_multiple_events() {
        let events = vec![
            SecurityEvent::InputValidationFailure {
                input_type: "url".to_string(),
                reason: "Invalid protocol".to_string(),
                source: "test".to_string(),
            },
            SecurityEvent::SuspiciousActivity {
                activity_type: "rapid_requests".to_string(),
                details: "100 requests in 1 second".to_string(),
                source: "test".to_string(),
            },
        ];
        log_security_events(events);
    }
}
