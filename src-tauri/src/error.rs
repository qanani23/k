use thiserror::Error;

/// Comprehensive error types for the Kiyya desktop streaming application.
///
/// This enum covers all possible error conditions that can occur throughout
/// the application, from network failures to encryption issues. Each error
/// type provides detailed context to help with debugging and user feedback.
#[derive(Error, Debug)]
pub enum KiyyaError {
    // External library errors (automatic conversion)
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON parsing error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Task join error: {0}")]
    TaskJoin(#[from] tokio::task::JoinError),

    #[error("Keyring error: {0}")]
    Keyring(#[from] keyring::Error),

    #[error("Base64 decode error: {0}")]
    Base64Decode(#[from] base64::DecodeError),

    #[error("URL parsing error: {0}")]
    UrlParse(#[from] url::ParseError),

    #[error("Regex error: {0}")]
    Regex(#[from] regex::Error),

    #[error("Zip error: {0}")]
    Zip(#[from] zip::result::ZipError),

    // Gateway and API errors
    #[error("Gateway error: {message}")]
    Gateway { message: String },

    #[error("All gateways failed after {attempts} attempts")]
    AllGatewaysFailed { attempts: u32 },

    #[error("API rate limit exceeded: retry after {retry_after_seconds} seconds")]
    RateLimitExceeded { retry_after_seconds: u64 },

    #[error("Invalid API response: {message}")]
    InvalidApiResponse { message: String },

    #[error("API timeout: operation took longer than {timeout_seconds} seconds")]
    ApiTimeout { timeout_seconds: u64 },

    // Content and parsing errors
    #[error("Content parsing error: {message}")]
    ContentParsing { message: String },

    #[error("Content not found: {claim_id}")]
    ContentNotFound { claim_id: String },

    #[error("Invalid content format: expected {expected}, got {actual}")]
    InvalidContentFormat { expected: String, actual: String },

    #[error("Missing required field: {field_name} in {context}")]
    MissingRequiredField { field_name: String, context: String },

    #[error("Unsupported content type: {content_type}")]
    UnsupportedContentType { content_type: String },

    // Download and storage errors
    #[error("Download error: {message}")]
    Download { message: String },

    #[error("Insufficient disk space: required {required} bytes, available {available} bytes")]
    InsufficientDiskSpace { required: u64, available: u64 },

    #[error("Download interrupted: {bytes_downloaded} of {total_bytes} bytes downloaded")]
    DownloadInterrupted {
        bytes_downloaded: u64,
        total_bytes: u64,
    },

    #[error("File corruption detected: {file_path}")]
    FileCorruption { file_path: String },

    #[error("Vault access denied: {path}")]
    VaultAccessDenied { path: String },

    // Encryption and security errors
    #[error("Encryption error: {message}")]
    Encryption { message: String },

    #[error("Decryption failed: {message}")]
    DecryptionFailed { message: String },

    #[error("Key management error: {message}")]
    KeyManagement { message: String },

    #[error("Security violation: {message}")]
    SecurityViolation { message: String },

    // Server and streaming errors
    #[error("Server error: {message}")]
    Server { message: String },

    #[error("Invalid range: {range}")]
    InvalidRange { range: String },

    #[error("Stream not available: {stream_id}")]
    StreamNotAvailable { stream_id: String },

    #[error("Concurrent stream limit exceeded: max {max_streams} streams")]
    ConcurrentStreamLimit { max_streams: u32 },

    #[error("Port binding failed: {port}")]
    PortBindingFailed { port: u16 },

    // Database and migration errors
    #[error("Migration error: {message}")]
    Migration { message: String },

    #[error("Database corruption detected: {details}")]
    DatabaseCorruption { details: String },

    #[error("Schema version mismatch: expected {expected}, found {found}")]
    SchemaVersionMismatch { expected: u32, found: u32 },

    #[error("Transaction rollback failed: {message}")]
    TransactionRollbackFailed { message: String },

    // Cache and TTL errors
    #[error("Cache error: {message}")]
    Cache { message: String },

    #[error("Cache TTL expired: {item_id}")]
    CacheTtlExpired { item_id: String },

    #[error("Cache size limit exceeded: {current_size} bytes")]
    CacheSizeLimitExceeded { current_size: u64 },

    // Version and update errors
    #[error("Version comparison error: {message}")]
    VersionComparison { message: String },

    #[error("Update manifest invalid: {message}")]
    UpdateManifestInvalid { message: String },

    #[error("Update check failed: {message}")]
    UpdateCheckFailed { message: String },

    #[error("Forced update required: current {current}, minimum {minimum}")]
    ForcedUpdateRequired { current: String, minimum: String },

    // Configuration and validation errors
    #[error("Configuration error: {message}")]
    Configuration { message: String },

    #[error("Invalid configuration value: {key} = {value}")]
    InvalidConfigurationValue { key: String, value: String },

    #[error("Validation error: {field} - {message}")]
    Validation { field: String, message: String },

    #[error("Invalid input: {message}")]
    InvalidInput { message: String },

    // Search and query errors
    #[error("Search error: {message}")]
    Search { message: String },

    #[error("Query timeout: {query} took longer than {timeout_ms} ms")]
    QueryTimeout { query: String, timeout_ms: u64 },

    #[error("Invalid search query: {query}")]
    InvalidSearchQuery { query: String },

    // Playlist and series errors
    #[error("Playlist error: {message}")]
    Playlist { message: String },

    #[error("Series parsing error: {title} - {message}")]
    SeriesParsing { title: String, message: String },

    #[error("Episode ordering error: {series_key} - {message}")]
    EpisodeOrdering { series_key: String, message: String },

    // Codec and compatibility errors
    #[error("Codec not supported: {codec}")]
    CodecNotSupported { codec: String },

    #[error("Platform compatibility error: {message}")]
    PlatformCompatibility { message: String },

    #[error("Media format error: {format} - {message}")]
    MediaFormat { format: String, message: String },

    // Generic application errors
    #[error("Application initialization failed: {message}")]
    ApplicationInit { message: String },

    #[error("Resource unavailable: {resource}")]
    ResourceUnavailable { resource: String },

    #[error("Operation timeout: {operation} exceeded {timeout_ms} ms")]
    OperationTimeout { operation: String, timeout_ms: u64 },

    #[error("Internal error: {message}")]
    Internal { message: String },
}

impl serde::Serialize for KiyyaError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl KiyyaError {
    /// Creates a gateway error with context
    pub fn gateway_error(message: impl Into<String>) -> Self {
        Self::Gateway {
            message: message.into(),
        }
    }

    /// Creates a download error with context
    pub fn download_error(message: impl Into<String>) -> Self {
        Self::Download {
            message: message.into(),
        }
    }

    /// Creates an encryption error with context
    pub fn encryption_error(message: impl Into<String>) -> Self {
        Self::Encryption {
            message: message.into(),
        }
    }

    /// Creates a server error with context
    pub fn server_error(message: impl Into<String>) -> Self {
        Self::Server {
            message: message.into(),
        }
    }

    /// Creates a content parsing error with context
    pub fn content_parsing_error(message: impl Into<String>) -> Self {
        Self::ContentParsing {
            message: message.into(),
        }
    }

    /// Creates a migration error with context
    pub fn migration_error(message: impl Into<String>) -> Self {
        Self::Migration {
            message: message.into(),
        }
    }

    /// Creates a configuration error with context
    pub fn configuration_error(message: impl Into<String>) -> Self {
        Self::Configuration {
            message: message.into(),
        }
    }

    /// Creates a validation error with field and message
    pub fn validation_error(field: impl Into<String>, message: impl Into<String>) -> Self {
        Self::Validation {
            field: field.into(),
            message: message.into(),
        }
    }

    /// Creates an internal error with context
    pub fn internal_error(message: impl Into<String>) -> Self {
        Self::Internal {
            message: message.into(),
        }
    }

    /// Checks if this error is recoverable (can be retried)
    pub fn is_recoverable(&self) -> bool {
        match self {
            // Network errors are often recoverable
            Self::Network(_)
            | Self::Gateway { .. }
            | Self::ApiTimeout { .. }
            | Self::RateLimitExceeded { .. } => true,

            // Download interruptions can be resumed
            Self::DownloadInterrupted { .. } => true,

            // Cache errors are usually recoverable
            Self::Cache { .. } | Self::CacheTtlExpired { .. } => true,

            // Query timeouts can be retried
            Self::QueryTimeout { .. } => true,

            // Most other errors are not recoverable
            _ => false,
        }
    }

    /// Checks if this error should be logged as a warning vs error
    pub fn is_warning_level(&self) -> bool {
        match self {
            // Cache misses and TTL expiration are expected
            Self::CacheTtlExpired { .. } => true,

            // Rate limiting is expected behavior
            Self::RateLimitExceeded { .. } => true,

            // Content not found might be expected
            Self::ContentNotFound { .. } => true,

            // Stream not available is expected when content is removed
            Self::StreamNotAvailable { .. } => true,

            // Most other errors should be logged as errors
            _ => false,
        }
    }

    /// Gets the error category for metrics and debugging
    pub fn category(&self) -> &'static str {
        match self {
            Self::Database(_)
            | Self::Migration { .. }
            | Self::DatabaseCorruption { .. }
            | Self::SchemaVersionMismatch { .. }
            | Self::TransactionRollbackFailed { .. } => "database",

            Self::Network(_)
            | Self::Gateway { .. }
            | Self::AllGatewaysFailed { .. }
            | Self::RateLimitExceeded { .. }
            | Self::InvalidApiResponse { .. }
            | Self::ApiTimeout { .. } => "network",

            Self::Io(_)
            | Self::InsufficientDiskSpace { .. }
            | Self::FileCorruption { .. }
            | Self::VaultAccessDenied { .. } => "filesystem",

            Self::Encryption { .. }
            | Self::DecryptionFailed { .. }
            | Self::KeyManagement { .. }
            | Self::SecurityViolation { .. } => "security",

            Self::Server { .. }
            | Self::InvalidRange { .. }
            | Self::StreamNotAvailable { .. }
            | Self::ConcurrentStreamLimit { .. }
            | Self::PortBindingFailed { .. } => "server",

            Self::ContentParsing { .. }
            | Self::ContentNotFound { .. }
            | Self::InvalidContentFormat { .. }
            | Self::MissingRequiredField { .. }
            | Self::UnsupportedContentType { .. } => "content",

            Self::Download { .. } | Self::DownloadInterrupted { .. } => "download",

            Self::Cache { .. }
            | Self::CacheTtlExpired { .. }
            | Self::CacheSizeLimitExceeded { .. } => "cache",

            Self::VersionComparison { .. }
            | Self::UpdateManifestInvalid { .. }
            | Self::UpdateCheckFailed { .. }
            | Self::ForcedUpdateRequired { .. } => "update",

            Self::Search { .. } | Self::QueryTimeout { .. } | Self::InvalidSearchQuery { .. } => {
                "search"
            }

            Self::Playlist { .. } | Self::SeriesParsing { .. } | Self::EpisodeOrdering { .. } => {
                "series"
            }

            Self::CodecNotSupported { .. }
            | Self::PlatformCompatibility { .. }
            | Self::MediaFormat { .. } => "media",

            _ => "general",
        }
    }

    /// Creates a user-friendly error message for display in the UI
    pub fn user_message(&self) -> String {
        match self {
            Self::Network(_) => {
                "Network connection failed. Please check your internet connection.".to_string()
            }
            Self::AllGatewaysFailed { .. } => {
                "All servers are currently unavailable. Please try again later.".to_string()
            }
            Self::InsufficientDiskSpace {
                required,
                available,
            } => {
                format!(
                    "Not enough disk space. Need {} MB, but only {} MB available.",
                    required / (1024 * 1024),
                    available / (1024 * 1024)
                )
            }
            Self::ContentNotFound { .. } => "The requested content could not be found.".to_string(),
            Self::DownloadInterrupted { .. } => {
                "Download was interrupted. You can resume it later.".to_string()
            }
            Self::DecryptionFailed { .. } => {
                "Failed to decrypt content. Your encryption key may be invalid.".to_string()
            }
            Self::ForcedUpdateRequired { .. } => {
                "A required update is available. Please update the application to continue."
                    .to_string()
            }
            Self::CodecNotSupported { .. } => {
                "This video format is not supported on your device.".to_string()
            }
            Self::RateLimitExceeded {
                retry_after_seconds,
            } => {
                format!(
                    "Too many requests. Please wait {} seconds before trying again.",
                    retry_after_seconds
                )
            }
            _ => "An unexpected error occurred. Please try again.".to_string(),
        }
    }
}

/// Result type alias for convenience
pub type Result<T> = std::result::Result<T, KiyyaError>;

/// Error context extension trait for adding context to errors
pub trait ErrorContext<T> {
    fn with_context(self, context: &str) -> Result<T>;
    fn with_context_fn<F>(self, f: F) -> Result<T>
    where
        F: FnOnce() -> String;
}

impl<T, E> ErrorContext<T> for std::result::Result<T, E>
where
    E: Into<KiyyaError>,
{
    fn with_context(self, context: &str) -> Result<T> {
        self.map_err(|e| {
            let original_error = e.into();
            KiyyaError::internal_error(format!("{}: {}", context, original_error))
        })
    }

    fn with_context_fn<F>(self, f: F) -> Result<T>
    where
        F: FnOnce() -> String,
    {
        self.map_err(|e| {
            let original_error = e.into();
            KiyyaError::internal_error(format!("{}: {}", f(), original_error))
        })
    }
}

impl<T> ErrorContext<T> for Option<T> {
    fn with_context(self, context: &str) -> Result<T> {
        self.ok_or_else(|| KiyyaError::internal_error(context.to_string()))
    }

    fn with_context_fn<F>(self, f: F) -> Result<T>
    where
        F: FnOnce() -> String,
    {
        self.ok_or_else(|| KiyyaError::internal_error(f()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_categories() {
        assert_eq!(KiyyaError::gateway_error("test").category(), "network");
        assert_eq!(KiyyaError::download_error("test").category(), "download");
        assert_eq!(KiyyaError::encryption_error("test").category(), "security");
    }

    #[test]
    fn test_error_recoverability() {
        assert!(KiyyaError::gateway_error("test").is_recoverable());
        assert!(!KiyyaError::encryption_error("test").is_recoverable());
        assert!(KiyyaError::DownloadInterrupted {
            bytes_downloaded: 100,
            total_bytes: 200
        }
        .is_recoverable());
    }

    #[test]
    fn test_warning_level() {
        assert!(KiyyaError::CacheTtlExpired {
            item_id: "test".to_string()
        }
        .is_warning_level());
        assert!(!KiyyaError::encryption_error("test").is_warning_level());
    }

    #[test]
    fn test_user_messages() {
        let error = KiyyaError::InsufficientDiskSpace {
            required: 1024 * 1024 * 100,
            available: 1024 * 1024 * 50,
        };
        let message = error.user_message();
        assert!(message.contains("100 MB"));
        assert!(message.contains("50 MB"));
    }

    #[test]
    fn test_error_context() {
        let result: std::result::Result<(), std::io::Error> = Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "file not found",
        ));

        let with_context = result.with_context("Failed to read config file");
        assert!(with_context.is_err());
        assert!(with_context
            .unwrap_err()
            .to_string()
            .contains("Failed to read config file"));
    }
}
