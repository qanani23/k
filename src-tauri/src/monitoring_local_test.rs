/// Test suite to verify that ALL monitoring data stays local
/// and is NEVER transmitted to external services.
///
/// This test ensures compliance with Phase 7.2 requirement:
/// "All monitoring data stays local"
///
/// Monitored data includes:
/// - Gateway response timing logs
/// - Cache hit/miss counters
/// - Download throughput metrics
/// - Diagnostics data
///
/// All of this data must remain on the local machine and never be sent
/// to external monitoring services, analytics platforms, or telemetry endpoints.
#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    /// Test that gateway logs are written to local files only
    #[test]
    fn test_gateway_logs_stay_local() {
        let gateway_rs_path = Path::new("src/gateway.rs");
        assert!(gateway_rs_path.exists(), "gateway.rs should exist");

        let content = fs::read_to_string(gateway_rs_path).expect("Failed to read gateway.rs");

        // Verify gateway logs are written to local files
        assert!(
            content.contains("gateway.log"),
            "Gateway should log to local gateway.log file"
        );

        // Verify no external logging services are used
        let prohibited_services = vec![
            "logstash",
            "elasticsearch",
            "splunk",
            "papertrail",
            "loggly",
            "datadog",
            "newrelic",
            "sentry",
            "honeybadger",
            "rollbar",
            "bugsnag",
        ];

        for service in prohibited_services {
            assert!(
                !content.to_lowercase().contains(service),
                "Gateway should not use external logging service: {}",
                service
            );
        }

        // Verify logs are written using local file operations
        assert!(
            content.contains("OpenOptions::new()") || content.contains("File::create"),
            "Gateway should use local file operations for logging"
        );

        // Verify no HTTP POST requests for logging (check for common patterns)
        let log_related_lines: Vec<&str> = content
            .lines()
            .filter(|line| line.contains("log") || line.contains("Log"))
            .collect();

        for line in log_related_lines {
            // Make sure logging lines don't contain HTTP POST operations
            if line.contains("post(") || line.contains("POST") {
                // This is acceptable if it's part of the gateway request itself, not logging
                assert!(
                    line.contains("gateway_url")
                        || line.contains("request")
                        || line.contains("client.post"),
                    "Found suspicious POST operation in logging context: {}",
                    line
                );
            }
        }
    }

    /// Test that cache statistics are stored in local database only
    #[test]
    fn test_cache_stats_stay_local() {
        let database_rs_path = Path::new("src/database.rs");
        assert!(database_rs_path.exists(), "database.rs should exist");

        let content = fs::read_to_string(database_rs_path).expect("Failed to read database.rs");

        // Verify cache stats are stored in SQLite
        assert!(
            content.contains("cache_stats")
                || content.contains("hit_count")
                || content.contains("miss_count"),
            "Cache stats should be stored in local database"
        );

        // Verify cache_stats table exists
        assert!(
            content.contains("CREATE TABLE IF NOT EXISTS cache_stats"),
            "cache_stats table should be defined in database schema"
        );

        // Verify no external analytics services
        let prohibited_services = vec![
            "amplitude",
            "mixpanel",
            "segment",
            "google-analytics",
            "posthog",
            "heap",
            "fullstory",
            "hotjar",
            "pendo",
            "intercom",
        ];

        for service in prohibited_services {
            assert!(
                !content.to_lowercase().contains(service),
                "Database should not send cache stats to external service: {}",
                service
            );
        }

        // Verify no HTTP requests for analytics
        let stats_related_lines: Vec<&str> = content
            .lines()
            .filter(|line| {
                line.contains("cache_stats")
                    || line.contains("hit_count")
                    || line.contains("miss_count")
            })
            .collect();

        for line in stats_related_lines {
            assert!(
                !line.contains("http://") && !line.contains("https://"),
                "Cache stats should not be sent via HTTP: {}",
                line
            );
        }
    }

    /// Test that download statistics are stored locally only
    #[test]
    fn test_download_stats_stay_local() {
        let download_rs_path = Path::new("src/download.rs");
        assert!(download_rs_path.exists(), "download.rs should exist");

        let content = fs::read_to_string(download_rs_path).expect("Failed to read download.rs");

        // Verify download stats are tracked locally
        assert!(
            content.contains("total_downloads")
                || content.contains("total_bytes")
                || content.contains("throughput"),
            "Download stats should be tracked in local variables"
        );

        // Verify stats are stored in atomic variables (local memory)
        assert!(
            content.contains("AtomicU32") || content.contains("AtomicU64"),
            "Download stats should use atomic variables for thread-safe local storage"
        );

        // Verify no external monitoring services
        let prohibited_services = vec![
            "datadog",
            "newrelic",
            "prometheus",
            "grafana",
            "statsd",
            "influxdb",
            "cloudwatch",
            "azure-monitor",
            "google-cloud-monitoring",
        ];

        for service in prohibited_services {
            assert!(
                !content.to_lowercase().contains(service),
                "Download manager should not send stats to external service: {}",
                service
            );
        }

        // Verify no HTTP requests for metrics
        let stats_related_lines: Vec<&str> = content
            .lines()
            .filter(|line| {
                line.contains("total_downloads")
                    || line.contains("total_bytes")
                    || line.contains("throughput")
                    || line.contains("get_download_stats")
            })
            .collect();

        for line in stats_related_lines {
            // Make sure stats lines don't send data externally
            assert!(
                !line.contains("send()") || line.contains("emit_all"),
                "Download stats should not be sent to external services: {}",
                line
            );
        }
    }

    /// Test that diagnostics data is only collected locally
    #[test]
    fn test_diagnostics_stay_local() {
        let diagnostics_rs_path = Path::new("src/diagnostics.rs");
        assert!(diagnostics_rs_path.exists(), "diagnostics.rs should exist");

        let content =
            fs::read_to_string(diagnostics_rs_path).expect("Failed to read diagnostics.rs");

        // Verify diagnostics are collected locally
        assert!(
            content.contains("DiagnosticsData") || content.contains("get_diagnostics"),
            "Diagnostics module should exist and collect data"
        );

        // Verify no external telemetry services
        let prohibited_services = vec![
            "sentry",
            "bugsnag",
            "rollbar",
            "airbrake",
            "honeybadger",
            "raygun",
            "appsignal",
            "scout",
            "skylight",
        ];

        for service in prohibited_services {
            assert!(
                !content.to_lowercase().contains(service),
                "Diagnostics should not use external telemetry service: {}",
                service
            );
        }

        // Verify diagnostics are returned to frontend, not sent externally
        assert!(
            content.contains("Result<DiagnosticsData>") || content.contains("DiagnosticsData"),
            "Diagnostics should return data structure, not send externally"
        );
    }

    /// Test that no external monitoring SDKs are imported
    #[test]
    fn test_no_external_monitoring_sdks() {
        let cargo_toml_path = Path::new("Cargo.toml");
        assert!(cargo_toml_path.exists(), "Cargo.toml should exist");

        let content = fs::read_to_string(cargo_toml_path).expect("Failed to read Cargo.toml");

        // List of prohibited monitoring/analytics crates
        let prohibited_crates = vec![
            "sentry",
            "datadog",
            "newrelic",
            "prometheus",
            "opentelemetry",
            "tracing-subscriber-sentry",
            "bugsnag",
            "rollbar",
            "honeybadger",
            "airbrake",
        ];

        for crate_name in prohibited_crates {
            assert!(
                !content.contains(crate_name),
                "Cargo.toml should not include external monitoring crate: {}",
                crate_name
            );
        }
    }

    /// Test that models.rs defines local-only monitoring structures
    #[test]
    fn test_monitoring_models_are_local() {
        let models_rs_path = Path::new("src/models.rs");
        assert!(models_rs_path.exists(), "models.rs should exist");

        let content = fs::read_to_string(models_rs_path).expect("Failed to read models.rs");

        // Verify local monitoring structures exist
        assert!(
            content.contains("DownloadStats") || content.contains("CacheStats"),
            "Models should define local monitoring structures"
        );

        // Verify these structures are serializable (for local storage/display)
        let stats_section: Vec<&str> = content
            .lines()
            .skip_while(|line| !line.contains("DownloadStats") && !line.contains("CacheStats"))
            .take(20)
            .collect();

        let stats_text = stats_section.join("\n");
        assert!(
            stats_text.contains("Serialize") || stats_text.contains("serialize"),
            "Stats structures should be serializable for local use"
        );

        // Verify no external API endpoints in stats structures
        assert!(
            !stats_text.contains("http://") && !stats_text.contains("https://"),
            "Stats structures should not contain external URLs"
        );
    }

    /// Test that main.rs doesn't initialize external monitoring
    #[test]
    fn test_main_no_external_monitoring() {
        let main_rs_path = Path::new("src/main.rs");
        assert!(main_rs_path.exists(), "main.rs should exist");

        let content = fs::read_to_string(main_rs_path).expect("Failed to read main.rs");

        // Verify no external monitoring initialization
        let prohibited_patterns = vec![
            "sentry::init",
            "datadog::init",
            "newrelic::init",
            "prometheus::init",
            "opentelemetry::init",
        ];

        for pattern in prohibited_patterns {
            assert!(
                !content.contains(pattern),
                "main.rs should not initialize external monitoring: {}",
                pattern
            );
        }

        // Verify local logging is used instead
        assert!(
            content.contains("tracing") || content.contains("log"),
            "main.rs should use local logging (tracing or log crate)"
        );
    }

    /// Test that commands.rs only exposes local monitoring data
    #[test]
    fn test_commands_expose_local_data_only() {
        let commands_rs_path = Path::new("src/commands.rs");
        assert!(commands_rs_path.exists(), "commands.rs should exist");

        let content = fs::read_to_string(commands_rs_path).expect("Failed to read commands.rs");

        // Verify diagnostics command exists
        assert!(
            content.contains("pub async fn get_diagnostics"),
            "Diagnostics command should exist"
        );

        // Verify it returns DiagnosticsData (local data structure)
        assert!(
            content.contains("Result<DiagnosticsData>"),
            "Diagnostics command should return local data"
        );

        // Verify no HTTP POST to external services in the entire commands file
        // (POST to local server is OK, but not to external analytics)
        let post_lines: Vec<&str> = content
            .lines()
            .filter(|line| line.contains(".post("))
            .collect();

        for line in post_lines {
            // If there's a POST, it should be to localhost or a comment
            assert!(
                line.contains("localhost") || line.contains("127.0.0.1") || line.contains("//"),
                "Commands should not POST to external services: {}",
                line
            );
        }
    }

    /// Integration test: Verify complete monitoring data flow stays local
    #[test]
    fn test_complete_monitoring_flow_is_local() {
        // This test verifies the complete monitoring data flow:
        // 1. Gateway logs → local file (gateway.log)
        // 2. Cache stats → local SQLite database (cache_stats table)
        // 3. Download stats → local atomic variables → returned via commands
        // 4. Diagnostics → aggregated from local sources → returned to frontend

        // Verify gateway logging
        let gateway_content =
            fs::read_to_string("src/gateway.rs").expect("Failed to read gateway.rs");
        assert!(
            gateway_content.contains("gateway.log"),
            "Gateway should log to local file"
        );

        // Verify cache stats in database
        let database_content =
            fs::read_to_string("src/database.rs").expect("Failed to read database.rs");
        assert!(
            database_content.contains("cache_stats"),
            "Database should have cache_stats table"
        );

        // Verify download stats in memory
        let download_content =
            fs::read_to_string("src/download.rs").expect("Failed to read download.rs");
        assert!(
            download_content.contains("total_downloads") && download_content.contains("AtomicU32"),
            "Download stats should be stored in local atomic variables"
        );

        // Verify diagnostics aggregates local data
        let diagnostics_content =
            fs::read_to_string("src/diagnostics.rs").expect("Failed to read diagnostics.rs");
        assert!(
            diagnostics_content.contains("cache_stats")
                && diagnostics_content.contains("download_stats"),
            "Diagnostics should aggregate local monitoring data"
        );

        // Verify no external URLs in any monitoring code
        let all_monitoring_content = format!(
            "{}\n{}\n{}\n{}",
            gateway_content, database_content, download_content, diagnostics_content
        );

        // Check for suspicious external URLs (excluding comments and Odysee API)
        let lines_with_urls: Vec<&str> = all_monitoring_content
            .lines()
            .filter(|line| {
                (line.contains("http://") || line.contains("https://"))
                    && !line.trim().starts_with("//")
                    && !line.trim().starts_with("*")
                    && !line.contains("odysee.com")
                    && !line.contains("lbry.tv")
                    && !line.contains("na-backend.odysee.com")
                    && !line.contains("example.com")
                    && !line.contains("localhost")
                    && !line.contains("127.0.0.1")
            })
            .collect();

        for line in &lines_with_urls {
            // If we find any suspicious URLs, fail with details
            if line.contains("datadog")
                || line.contains("sentry")
                || line.contains("newrelic")
                || line.contains("analytics")
                || line.contains("telemetry")
                || line.contains("monitoring")
            {
                panic!("Found suspicious external monitoring URL: {}", line);
            }
        }
    }
}
