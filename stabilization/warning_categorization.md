# Warning Categorization Report

**Generated:** 2026-02-23T00:27:27.364Z

**Total Warnings:** 360

## Summary by Warning Type

| Warning Type | Count |
|--------------|-------|
| unknown | 146 |
| unused_function | 47 |
| unused_constant | 38 |
| unused_struct | 32 |
| unused_import | 28 |
| unused_variable | 21 |
| unused_method | 9 |
| unused_field | 8 |
| clippy_useless_format | 8 |
| clippy_explicit_auto_deref | 5 |

## Summary by Module

| Module | Warning Count |
|--------|---------------|
| models.rs | 104 |
| commands.rs | 39 |
| error_logging.rs | 19 |
| database.rs | 15 |
| gateway.rs | 15 |
| encryption.rs | 11 |
| download.rs | 9 |
| diagnostics.rs | 9 |
| force_refresh_test.rs | 9 |
| integration_test.rs | 9 |

## Detailed Breakdown by Type

### unknown (146 warnings)

**commands.rs** (17 warnings):
- Line 2386: #[test]
- Line 2387: #[test]
- Line 2388: #[test]
- Line 2389: #[test]
- Line 2390: #[test]
- Line 2391: #[test]
- Line 2392: #[test]
- Line 2393: #[test]
- Line 2394: #[test]
- Line 2395: #[test]
- Line 2396: #[test]
- Line 2397: #[test]
- Line 2398: #[test]
- Line 2399: #[test]
- Line 2400: #[test]
- Line 2401: #[test]
- Line 2403: #[test]

**models.rs** (14 warnings):
- Line 552: `new`
- Line 641: `from_header`
- Line 908: `parse`
- Line 552: `new`
- Line 641: `from_header`
- Line 908: `parse`
- Line 420: `impl`
- Line 843: `1.60.0`
- Line 843: `1.60.0`
- Line 843: `1.60.0`
- Line 848: `1.60.0`
- Line 942: `to_string(&self) -> String`
- Line 1051: #[test]
- Line 681: `to_content_range`

**gateway.rs** (11 warnings):
- Line 349: `if`
- Line 351: `if`
- Line 356: `if`
- Line 545: `self.gateways.get(0)`
- Line 902: let mut client = GatewayClient::new();
- Line 741: `Range::contains`
- Line 746: `Range::contains`
- Line 751: `Range::contains`
- Line 1121: `Range::contains`
- Line 1126: `Range::contains`
- Line 1131: `Range::contains`

**force_refresh_test.rs** (9 warnings):
- Line 5: mod tests {
- Line 20: `true`
- Line 44: `true`
- Line 54: `unwrap_or()`
- Line 57: `assert_eq!`
- Line 67: `unwrap_or()`
- Line 70: `assert_eq!`
- Line 80: `unwrap_or()`
- Line 83: `assert_eq!`

**integration_test.rs** (9 warnings):
- Line 277: fts5_available == true || fts5_available == false,
- Line 277: fts5_available == true || fts5_available == false,
- Line 408: `expect`
- Line 411: `expect`
- Line 427: `expect`
- Line 468: `expect`
- Line 474: `expect`
- Line 538: `expect`
- Line 427: assert!(favorites.len() >= 0, "Database should be

**input_validation_test.rs** (8 warnings):
- Line 4: mod tests {
- Line 130: `vec!`
- Line 132: `vec!`
- Line 135: `vec!`
- Line 141: `vec!`
- Line 142: `vec!`
- Line 143: `vec!`
- Line 403: `vec!`

**hero_stream_filter_test.rs** (6 warnings):
- Line 15: `unwrap()`
- Line 124: `unwrap()`
- Line 14: `vec!`
- Line 47: `vec!`
- Line 64: `vec!`
- Line 123: `vec!`

**migration_clean_run_test.rs** (5 warnings):
- Line 8: mod migration_clean_run_tests {
- Line 115: `expect`
- Line 353: `expect`
- Line 359: `expect`
- Line 357: `expect`

**encryption.rs** (3 warnings):
- Line 35: pub fn load_encryption_from_keystore(&mut self) -> Result<bo...
- Line 35: pub fn load_encryption_from_keystore(&mut self) -> Result<bo...
- Line 268: `chunk_idx`

**security_logging.rs** (3 warnings):
- Line 50: `PathViolation`
- Line 50: `PathViolation`
- Line 84: `AuthenticationFailure`

**database.rs** (3 warnings):
- Line 2189: `.filter_map(..)`
- Line 2791: assert!(content.tags.len() > 0, "tags should be present");
- Line 2791: assert!(version >= 0, "Database version should be non-negati...

**rate_limit_timeout_test.rs** (3 warnings):
- Line 6: mod tests {
- Line 71: `vec!`
- Line 91: `vec!`

**filesystem_access_test.rs** (3 warnings):
- Line 14: mod tests {
- Line 167: `unwrap`
- Line 381: `unwrap`

**logging_test.rs** (3 warnings):
- Line 30: `assert_eq!`
- Line 47: `assert_eq!`
- Line 48: `assert_eq!`

**search_test.rs** (3 warnings):
- Line 146: results.len() >= 1,
- Line 218: assert!(db.fts5_available == true || db.fts5_available == fa...
- Line 218: assert!(db.fts5_available == true || db.fts5_available == fa...

**http_range_property_test.rs** (3 warnings):
- Line 36: |             };
- Line 137: |         };
- Line 186: let end = if start > gap { start - gap } else { 0 };

**validation.rs** (3 warnings):
- Line 587: `vec!`
- Line 590: `vec!`
- Line 591: `vec!`

**error_logging.rs** (2 warnings):
- Line 53: `new`
- Line 53: `new`

**diagnostics.rs** (2 warnings):
- Line 355: `push_str()`
- Line 378: `push_str()`

**path_security.rs** (2 warnings):
- Line 147: if path_str.starts_with(r"\\?\") {
- Line 38: `return`

**response_structure_property_test.rs** (2 warnings):
- Line 14: mod response_structure_property_tests {
- Line 187: content.video_urls.len() >= 1,

**migrations_error_handling_test.rs** (2 warnings):
- Line 471: mod property_tests {
- Line 778: `expect`

**channel_id_parameter_property_test.rs** (2 warnings):
- Line 9: mod channel_id_parameter_tests {
- Line 298: mod invalid_channel_id_rejection_tests {

**migration_property_test.rs** (2 warnings):
- Line 6: mod migration_property_tests {
- Line 147: `i`

**encryption_key_management_test.rs** (2 warnings):
- Line 12: mod encryption_key_management_tests {
- Line 437: `assert_eq!`

**gateway_failover_property_test.rs** (2 warnings):
- Line 102: `Range::contains`
- Line 105: `Range::contains`

**database_initialization_test.rs** (2 warnings):
- Line 228: fts5_available == true || fts5_available == false,
- Line 228: fts5_available == true || fts5_available == false,

**crash_reporting.rs** (1 warnings):
- Line 30: `1.60.0`

**server.rs** (1 warnings):
- Line 329: |             };

**monitoring_local_test.rs** (1 warnings):
- Line 14: mod tests {

**security_restrictions_test.rs** (1 warnings):
- Line 10: mod tests {

**cache_ttl_property_test.rs** (1 warnings):
- Line 9: mod cache_ttl_property_tests {

**cdn_builder_determinism_property_test.rs** (1 warnings):
- Line 8: mod cdn_builder_determinism_tests {

**missing_direct_urls_property_test.rs** (1 warnings):
- Line 9: mod missing_direct_urls_property_tests {

**valid_claim_id_property_test.rs** (1 warnings):
- Line 13: mod valid_claim_id_property_tests {

**missing_claim_id_property_test.rs** (1 warnings):
- Line 8: mod missing_claim_id_property_tests {

**partial_success_property_test.rs** (1 warnings):
- Line 11: mod partial_success_property_tests {

**error_structure_property_test.rs** (1 warnings):
- Line 10: mod error_structure_property_tests {

**channel_id_format_validation_property_test.rs** (1 warnings):
- Line 8: mod channel_id_format_validation_tests {

**valid_channel_id_acceptance_property_test.rs** (1 warnings):
- Line 8: mod valid_channel_id_acceptance_tests {

**download_resumable_atomic_property_test.rs** (1 warnings):
- Line 17: mod download_resumable_atomic_property_tests {

**tag_immutability_test.rs** (1 warnings):
- Line 1: mod tests {

**gateway_production_test.rs** (1 warnings):
- Line 13: mod tests {

**migration_older_db_test.rs** (1 warnings):
- Line 8: mod migration_older_db_tests {

**logging.rs** (1 warnings):
- Line 265: `assert_eq!`

**security_logging_integration_test.rs** (1 warnings):
- Line 109: `true`

**diagnostics_test.rs** (1 warnings):
- Line 216: `vec!`

### unused_function (47 warnings)

**models.rs** (18 warnings):
- Line 793: `is_base_tag`
- Line 798: `is_filter_tag`
- Line 803: `base_tag_for_filter`
- Line 819: `is_valid_quality`
- Line 824: `next_lower_quality`
- Line 829: `quality_score`
- Line 846: `get_series_regex`
- Line 861: `parse_series_title`
- Line 882: `generate_series_key`
- Line 793: `is_base_tag`
- Line 798: `is_filter_tag`
- Line 803: `base_tag_for_filter`
- Line 819: `is_valid_quality`
- Line 824: `next_lower_quality`
- Line 829: `quality_score`
- Line 846: `get_series_regex`
- Line 861: `parse_series_title`
- Line 882: `generate_series_key`

**error_logging.rs** (14 warnings):
- Line 123: `log_error`
- Line 189: `log_error_simple`
- Line 194: `mark_error_resolved`
- Line 341: `cleanup_old_errors`
- Line 363: `get_error_code`
- Line 399: `log_result_error`
- Line 412: `log_result_error_simple`
- Line 123: `log_error`
- Line 189: `log_error_simple`
- Line 194: `mark_error_resolved`
- Line 341: `cleanup_old_errors`
- Line 363: `get_error_code`
- Line 399: `log_result_error`
- Line 412: `log_result_error_simple`

**main.rs** (6 warnings):
- Line 343: `run_startup_migrations`
- Line 355: `check_emergency_disable`
- Line 431: `show_emergency_disable_message`
- Line 343: `run_startup_migrations`
- Line 355: `check_emergency_disable`
- Line 431: `show_emergency_disable_message`

**commands.rs** (2 warnings):
- Line 206: `validate_cdn_reachability`
- Line 206: `validate_cdn_reachability`

**logging.rs** (2 warnings):
- Line 161: `init_logging_with_config`
- Line 161: `init_logging_with_config`

**migrations.rs** (2 warnings):
- Line 694: `get_migrations`
- Line 694: `get_migrations`

**security_logging.rs** (2 warnings):
- Line 313: `log_security_events`
- Line 313: `log_security_events`

**migration_property_test.rs** (1 warnings):
- Line 77: `migration_version_strategy`

### unused_constant (38 warnings)

**models.rs** (32 warnings):
- Line 757: `SERIES`
- Line 758: `MOVIE`
- Line 759: `SITCOM`
- Line 760: `KIDS`
- Line 761: `HERO_TRAILER`
- Line 764: `COMEDY_MOVIES`
- Line 765: `ACTION_MOVIES`
- Line 766: `ROMANCE_MOVIES`
- Line 769: `COMEDY_SERIES`
- Line 770: `ACTION_SERIES`
- Line 771: `ROMANCE_SERIES`
- Line 774: `COMEDY_KIDS`
- Line 775: `ACTION_KIDS`
- Line 778: `BASE_TAGS`
- Line 781: `FILTER_TAGS`
- Line 816: `QUALITY_LEVELS`
- Line 757: `SERIES`
- Line 758: `MOVIE`
- Line 759: `SITCOM`
- Line 760: `KIDS`
- Line 761: `HERO_TRAILER`
- Line 764: `COMEDY_MOVIES`
- Line 765: `ACTION_MOVIES`
- Line 766: `ROMANCE_MOVIES`
- Line 769: `COMEDY_SERIES`
- Line 770: `ACTION_SERIES`
- Line 771: `ROMANCE_SERIES`
- Line 774: `COMEDY_KIDS`
- Line 775: `ACTION_KIDS`
- Line 778: `BASE_TAGS`
- Line 781: `FILTER_TAGS`
- Line 816: `QUALITY_LEVELS`

**encryption.rs** (6 warnings):
- Line 15: `KEYRING_SERVICE`
- Line 16: `KEYRING_USER`
- Line 18: `KEY_SIZE`
- Line 15: `KEYRING_SERVICE`
- Line 16: `KEYRING_USER`
- Line 18: `KEY_SIZE`

### unused_struct (32 warnings)

**models.rs** (28 warnings):
- Line 301: `SeriesInfo`
- Line 309: `Season`
- Line 317: `Episode`
- Line 446: `ClaimSearchParams`
- Line 456: `PlaylistSearchParams`
- Line 481: `StreamOfflineRequest`
- Line 494: `VersionManifest`
- Line 539: `UpdateState`
- Line 612: `GatewayConfig`
- Line 634: `RangeRequest`
- Line 705: `EncryptionConfig`
- Line 725: `Migration`
- Line 853: `ParsedSeries`
- Line 900: `Version`
- Line 301: `SeriesInfo`
- Line 309: `Season`
- Line 317: `Episode`
- Line 446: `ClaimSearchParams`
- Line 456: `PlaylistSearchParams`
- Line 481: `StreamOfflineRequest`
- Line 494: `VersionManifest`
- Line 539: `UpdateState`
- Line 612: `GatewayConfig`
- Line 634: `RangeRequest`
- Line 705: `EncryptionConfig`
- Line 725: `Migration`
- Line 853: `ParsedSeries`
- Line 900: `Version`

**error_logging.rs** (2 warnings):
- Line 42: `ErrorContext`
- Line 42: `ErrorContext`

**logging.rs** (2 warnings):
- Line 142: `LoggingConfig`
- Line 142: `LoggingConfig`

### unused_import (28 warnings)

**commands.rs** (10 warnings):
- Line 1: `crate::database::Database`
- Line 3: `crate::download::DownloadManager`
- Line 5: `crate::gateway::GatewayClient`
- Line 8: `crate::server::LocalServer`
- Line 16: `debug`
- Line 1: `crate::database::Database`
- Line 3: `crate::download::DownloadManager`
- Line 5: `crate::gateway::GatewayClient`
- Line 8: `crate::server::LocalServer`
- Line 16: `debug`

**models.rs** (4 warnings):
- Line 2: `DateTime`
- Line 5: `uuid::Uuid`
- Line 2: `DateTime`
- Line 5: `uuid::Uuid`

**download.rs** (3 warnings):
- Line 5: `futures_util::StreamExt`
- Line 5: `futures_util::StreamExt`
- Line 758: `create_dir_all`

**path_security.rs** (2 warnings):
- Line 23: `SecurityEvent`
- Line 23: `SecurityEvent`

**migrations_error_handling_test.rs** (2 warnings):
- Line 4: `KiyyaError`
- Line 5: `MigrationInfo`

**logging.rs** (1 warnings):
- Line 250: `std::fs`

**server.rs** (1 warnings):
- Line 672: `Duration`

**logging_test.rs** (1 warnings):
- Line 2: `std::fs`

**filesystem_access_test.rs** (1 warnings):
- Line 21: `std::path::PathBuf`

**valid_claim_id_property_test.rs** (1 warnings):
- Line 17: `build_cdn_playback_url`

**diagnostics_test.rs** (1 warnings):
- Line 5: `std::path::Path`

**migration_property_test.rs** (1 warnings):
- Line 10: `crate::database::Database`

### unused_variable (21 warnings)

**migration_older_db_test.rs** (7 warnings):
- Line 333: `db`
- Line 410: `db`
- Line 496: `db`
- Line 597: `db`
- Line 673: `db`
- Line 714: `db`
- Line 787: `db`

**database.rs** (4 warnings):
- Line 652: `cache_ttl`
- Line 2077: `cache_ttl`
- Line 652: `cache_ttl`
- Line 2077: `cache_ttl`

**main.rs** (2 warnings):
- Line 245: `app`
- Line 245: `app`

**hero_stream_filter_test.rs** (2 warnings):
- Line 14: `tags`
- Line 47: `tags`

**download.rs** (1 warnings):
- Line 944: `supports_range`

**server.rs** (1 warnings):
- Line 945: `encrypted_file_size`

**migrations_error_handling_test.rs** (1 warnings):
- Line 683: `original_error_msg`

**database_initialization_test.rs** (1 warnings):
- Line 93: `db`

**database_optimization_test.rs** (1 warnings):
- Line 46: `db`

**encryption_key_management_test.rs** (1 warnings):
- Line 111: `db`

### unused_method (9 warnings)

**models.rs** (4 warnings):
- Line 510: `is_emergency_disabled`
- Line 510: `is_emergency_disabled`
- Line 515: `validate`
- Line 942: `to_string`

**database.rs** (2 warnings):
- Line 121: `get_connection`
- Line 121: `get_connection`

**download.rs** (2 warnings):
- Line 611: `get_content_length`
- Line 611: `get_content_length`

**error_logging.rs** (1 warnings):
- Line 70: `with_stack_trace`

### unused_field (8 warnings)

**database.rs** (2 warnings):
- Line 18: `connection_pool`
- Line 18: `connection_pool`

**encryption.rs** (2 warnings):
- Line 23: `encrypted_size`
- Line 23: `encrypted_size`

**gateway.rs** (2 warnings):
- Line 22: `current_gateway`
- Line 22: `current_gateway`

**server.rs** (2 warnings):
- Line 17: `vault_path`
- Line 17: `vault_path`

### clippy_useless_format (8 warnings)

**diagnostics.rs** (7 warnings):
- Line 151: `format!`
- Line 156: `format!`
- Line 186: `format!`
- Line 220: `format!`
- Line 238: `format!`
- Line 258: `format!`
- Line 467: `format!`

**database.rs** (1 warnings):
- Line 487: `format!`

### clippy_explicit_auto_deref (5 warnings)

**commands.rs** (5 warnings):
- Line 833: diagnostics::collect_diagnostics(&*gateway, &*server, &*db,
- Line 833: diagnostics::collect_diagnostics(&*gateway, &*server, &*db,
- Line 833: diagnostics::collect_diagnostics(&*gateway, &*server, &*db,
- Line 833: diagnostics::collect_diagnostics(&*gateway, &*server, &*db,
- Line 859: diagnostics::collect_debug_package(&*db, vault_path,

### unused_assignment (4 warnings)

**database.rs** (2 warnings):
- Line 815: `param_index`
- Line 815: `param_index`

**gateway.rs** (2 warnings):
- Line 70: `last_error`
- Line 70: `last_error`

### clippy_redundant_closure (4 warnings)

**commands.rs** (3 warnings):
- Line 872: crate::crash_reporting::get_recent_crashes(limit).map_err(|e...
- Line 881: crate::crash_reporting::clear_crash_log().map_err(|e|
- Line 974: .map_err(|e| KiyyaError::Io(e))?;

**download.rs** (1 warnings):
- Line 34: .map_err(|e| KiyyaError::Network(e))?;

### unused_parens (2 warnings)

**download.rs** (2 warnings):
- Line 722: ((total_bytes as f64 / (total_duration_ms as f64 / 1000.0))
- Line 722: ((total_bytes as f64 / (total_duration_ms as f64 / 1000.0))

### unused_associated_item (2 warnings)

**models.rs** (2 warnings):
- Line 734: `new`
- Line 734: `new`

### unused_static (2 warnings)

**models.rs** (2 warnings):
- Line 843: `SERIES_REGEX`
- Line 843: `SERIES_REGEX`

### clippy_needless_borrows (2 warnings)

**commands.rs** (1 warnings):
- Line 972: .args(&["/c", "start", &validated_url])

**sql_injection_test.rs** (1 warnings):
- Line 57: prop_assert!(sanitized.contains(&column));

### clippy_too_many_arguments (1 warnings)

**commands.rs** (1 warnings):
- Line 261: | ) -> Result<Vec<ContentItem>> {

### clippy_collapsible_match (1 warnings)

**database.rs** (1 warnings):
- Line 2050: `if let`

## Detailed Breakdown by Module

### models.rs (104 warnings)

**unused_constant** (32):
- Line 757: `SERIES`
- Line 758: `MOVIE`
- Line 759: `SITCOM`
- Line 760: `KIDS`
- Line 761: `HERO_TRAILER`
- Line 764: `COMEDY_MOVIES`
- Line 765: `ACTION_MOVIES`
- Line 766: `ROMANCE_MOVIES`
- Line 769: `COMEDY_SERIES`
- Line 770: `ACTION_SERIES`
- Line 771: `ROMANCE_SERIES`
- Line 774: `COMEDY_KIDS`
- Line 775: `ACTION_KIDS`
- Line 778: `BASE_TAGS`
- Line 781: `FILTER_TAGS`
- Line 816: `QUALITY_LEVELS`
- Line 757: `SERIES`
- Line 758: `MOVIE`
- Line 759: `SITCOM`
- Line 760: `KIDS`
- Line 761: `HERO_TRAILER`
- Line 764: `COMEDY_MOVIES`
- Line 765: `ACTION_MOVIES`
- Line 766: `ROMANCE_MOVIES`
- Line 769: `COMEDY_SERIES`
- Line 770: `ACTION_SERIES`
- Line 771: `ROMANCE_SERIES`
- Line 774: `COMEDY_KIDS`
- Line 775: `ACTION_KIDS`
- Line 778: `BASE_TAGS`
- Line 781: `FILTER_TAGS`
- Line 816: `QUALITY_LEVELS`

**unused_struct** (28):
- Line 301: `SeriesInfo`
- Line 309: `Season`
- Line 317: `Episode`
- Line 446: `ClaimSearchParams`
- Line 456: `PlaylistSearchParams`
- Line 481: `StreamOfflineRequest`
- Line 494: `VersionManifest`
- Line 539: `UpdateState`
- Line 612: `GatewayConfig`
- Line 634: `RangeRequest`
- Line 705: `EncryptionConfig`
- Line 725: `Migration`
- Line 853: `ParsedSeries`
- Line 900: `Version`
- Line 301: `SeriesInfo`
- Line 309: `Season`
- Line 317: `Episode`
- Line 446: `ClaimSearchParams`
- Line 456: `PlaylistSearchParams`
- Line 481: `StreamOfflineRequest`
- Line 494: `VersionManifest`
- Line 539: `UpdateState`
- Line 612: `GatewayConfig`
- Line 634: `RangeRequest`
- Line 705: `EncryptionConfig`
- Line 725: `Migration`
- Line 853: `ParsedSeries`
- Line 900: `Version`

**unused_function** (18):
- Line 793: `is_base_tag`
- Line 798: `is_filter_tag`
- Line 803: `base_tag_for_filter`
- Line 819: `is_valid_quality`
- Line 824: `next_lower_quality`
- Line 829: `quality_score`
- Line 846: `get_series_regex`
- Line 861: `parse_series_title`
- Line 882: `generate_series_key`
- Line 793: `is_base_tag`
- Line 798: `is_filter_tag`
- Line 803: `base_tag_for_filter`
- Line 819: `is_valid_quality`
- Line 824: `next_lower_quality`
- Line 829: `quality_score`
- Line 846: `get_series_regex`
- Line 861: `parse_series_title`
- Line 882: `generate_series_key`

**unknown** (14):
- Line 552: `new`
- Line 641: `from_header`
- Line 908: `parse`
- Line 552: `new`
- Line 641: `from_header`
- Line 908: `parse`
- Line 420: `impl`
- Line 843: `1.60.0`
- Line 843: `1.60.0`
- Line 843: `1.60.0`
- Line 848: `1.60.0`
- Line 942: `to_string(&self) -> String`
- Line 1051: #[test]
- Line 681: `to_content_range`

**unused_import** (4):
- Line 2: `DateTime`
- Line 5: `uuid::Uuid`
- Line 2: `DateTime`
- Line 5: `uuid::Uuid`

**unused_method** (4):
- Line 510: `is_emergency_disabled`
- Line 510: `is_emergency_disabled`
- Line 515: `validate`
- Line 942: `to_string`

**unused_associated_item** (2):
- Line 734: `new`
- Line 734: `new`

**unused_static** (2):
- Line 843: `SERIES_REGEX`
- Line 843: `SERIES_REGEX`

### commands.rs (39 warnings)

**unknown** (17):
- Line 2386: #[test]
- Line 2387: #[test]
- Line 2388: #[test]
- Line 2389: #[test]
- Line 2390: #[test]
- Line 2391: #[test]
- Line 2392: #[test]
- Line 2393: #[test]
- Line 2394: #[test]
- Line 2395: #[test]
- Line 2396: #[test]
- Line 2397: #[test]
- Line 2398: #[test]
- Line 2399: #[test]
- Line 2400: #[test]
- Line 2401: #[test]
- Line 2403: #[test]

**unused_import** (10):
- Line 1: `crate::database::Database`
- Line 3: `crate::download::DownloadManager`
- Line 5: `crate::gateway::GatewayClient`
- Line 8: `crate::server::LocalServer`
- Line 16: `debug`
- Line 1: `crate::database::Database`
- Line 3: `crate::download::DownloadManager`
- Line 5: `crate::gateway::GatewayClient`
- Line 8: `crate::server::LocalServer`
- Line 16: `debug`

**clippy_explicit_auto_deref** (5):
- Line 833: diagnostics::collect_diagnostics(&*gateway, &*server, &*db,
- Line 833: diagnostics::collect_diagnostics(&*gateway, &*server, &*db,
- Line 833: diagnostics::collect_diagnostics(&*gateway, &*server, &*db,
- Line 833: diagnostics::collect_diagnostics(&*gateway, &*server, &*db,
- Line 859: diagnostics::collect_debug_package(&*db, vault_path,

**clippy_redundant_closure** (3):
- Line 872: crate::crash_reporting::get_recent_crashes(limit).map_err(|e...
- Line 881: crate::crash_reporting::clear_crash_log().map_err(|e|
- Line 974: .map_err(|e| KiyyaError::Io(e))?;

**unused_function** (2):
- Line 206: `validate_cdn_reachability`
- Line 206: `validate_cdn_reachability`

**clippy_too_many_arguments** (1):
- Line 261: | ) -> Result<Vec<ContentItem>> {

**clippy_needless_borrows** (1):
- Line 972: .args(&["/c", "start", &validated_url])

### error_logging.rs (19 warnings)

**unused_function** (14):
- Line 123: `log_error`
- Line 189: `log_error_simple`
- Line 194: `mark_error_resolved`
- Line 341: `cleanup_old_errors`
- Line 363: `get_error_code`
- Line 399: `log_result_error`
- Line 412: `log_result_error_simple`
- Line 123: `log_error`
- Line 189: `log_error_simple`
- Line 194: `mark_error_resolved`
- Line 341: `cleanup_old_errors`
- Line 363: `get_error_code`
- Line 399: `log_result_error`
- Line 412: `log_result_error_simple`

**unused_struct** (2):
- Line 42: `ErrorContext`
- Line 42: `ErrorContext`

**unknown** (2):
- Line 53: `new`
- Line 53: `new`

**unused_method** (1):
- Line 70: `with_stack_trace`

### database.rs (15 warnings)

**unused_variable** (4):
- Line 652: `cache_ttl`
- Line 2077: `cache_ttl`
- Line 652: `cache_ttl`
- Line 2077: `cache_ttl`

**unknown** (3):
- Line 2189: `.filter_map(..)`
- Line 2791: assert!(content.tags.len() > 0, "tags should be present");
- Line 2791: assert!(version >= 0, "Database version should be non-negati...

**unused_assignment** (2):
- Line 815: `param_index`
- Line 815: `param_index`

**unused_field** (2):
- Line 18: `connection_pool`
- Line 18: `connection_pool`

**unused_method** (2):
- Line 121: `get_connection`
- Line 121: `get_connection`

**clippy_useless_format** (1):
- Line 487: `format!`

**clippy_collapsible_match** (1):
- Line 2050: `if let`

### gateway.rs (15 warnings)

**unknown** (11):
- Line 349: `if`
- Line 351: `if`
- Line 356: `if`
- Line 545: `self.gateways.get(0)`
- Line 902: let mut client = GatewayClient::new();
- Line 741: `Range::contains`
- Line 746: `Range::contains`
- Line 751: `Range::contains`
- Line 1121: `Range::contains`
- Line 1126: `Range::contains`
- Line 1131: `Range::contains`

**unused_assignment** (2):
- Line 70: `last_error`
- Line 70: `last_error`

**unused_field** (2):
- Line 22: `current_gateway`
- Line 22: `current_gateway`

### encryption.rs (11 warnings)

**unused_constant** (6):
- Line 15: `KEYRING_SERVICE`
- Line 16: `KEYRING_USER`
- Line 18: `KEY_SIZE`
- Line 15: `KEYRING_SERVICE`
- Line 16: `KEYRING_USER`
- Line 18: `KEY_SIZE`

**unknown** (3):
- Line 35: pub fn load_encryption_from_keystore(&mut self) -> Result<bo...
- Line 35: pub fn load_encryption_from_keystore(&mut self) -> Result<bo...
- Line 268: `chunk_idx`

**unused_field** (2):
- Line 23: `encrypted_size`
- Line 23: `encrypted_size`

### download.rs (9 warnings)

**unused_import** (3):
- Line 5: `futures_util::StreamExt`
- Line 5: `futures_util::StreamExt`
- Line 758: `create_dir_all`

**unused_parens** (2):
- Line 722: ((total_bytes as f64 / (total_duration_ms as f64 / 1000.0))
- Line 722: ((total_bytes as f64 / (total_duration_ms as f64 / 1000.0))

**unused_method** (2):
- Line 611: `get_content_length`
- Line 611: `get_content_length`

**clippy_redundant_closure** (1):
- Line 34: .map_err(|e| KiyyaError::Network(e))?;

**unused_variable** (1):
- Line 944: `supports_range`

### diagnostics.rs (9 warnings)

**clippy_useless_format** (7):
- Line 151: `format!`
- Line 156: `format!`
- Line 186: `format!`
- Line 220: `format!`
- Line 238: `format!`
- Line 258: `format!`
- Line 467: `format!`

**unknown** (2):
- Line 355: `push_str()`
- Line 378: `push_str()`

### force_refresh_test.rs (9 warnings)

**unknown** (9):
- Line 5: mod tests {
- Line 20: `true`
- Line 44: `true`
- Line 54: `unwrap_or()`
- Line 57: `assert_eq!`
- Line 67: `unwrap_or()`
- Line 70: `assert_eq!`
- Line 80: `unwrap_or()`
- Line 83: `assert_eq!`

### integration_test.rs (9 warnings)

**unknown** (9):
- Line 277: fts5_available == true || fts5_available == false,
- Line 277: fts5_available == true || fts5_available == false,
- Line 408: `expect`
- Line 411: `expect`
- Line 427: `expect`
- Line 468: `expect`
- Line 474: `expect`
- Line 538: `expect`
- Line 427: assert!(favorites.len() >= 0, "Database should be

### main.rs (8 warnings)

**unused_function** (6):
- Line 343: `run_startup_migrations`
- Line 355: `check_emergency_disable`
- Line 431: `show_emergency_disable_message`
- Line 343: `run_startup_migrations`
- Line 355: `check_emergency_disable`
- Line 431: `show_emergency_disable_message`

**unused_variable** (2):
- Line 245: `app`
- Line 245: `app`

### input_validation_test.rs (8 warnings)

**unknown** (8):
- Line 4: mod tests {
- Line 130: `vec!`
- Line 132: `vec!`
- Line 135: `vec!`
- Line 141: `vec!`
- Line 142: `vec!`
- Line 143: `vec!`
- Line 403: `vec!`

### migration_older_db_test.rs (8 warnings)

**unused_variable** (7):
- Line 333: `db`
- Line 410: `db`
- Line 496: `db`
- Line 597: `db`
- Line 673: `db`
- Line 714: `db`
- Line 787: `db`

**unknown** (1):
- Line 8: mod migration_older_db_tests {

### hero_stream_filter_test.rs (8 warnings)

**unknown** (6):
- Line 15: `unwrap()`
- Line 124: `unwrap()`
- Line 14: `vec!`
- Line 47: `vec!`
- Line 64: `vec!`
- Line 123: `vec!`

**unused_variable** (2):
- Line 14: `tags`
- Line 47: `tags`

### logging.rs (6 warnings)

**unused_struct** (2):
- Line 142: `LoggingConfig`
- Line 142: `LoggingConfig`

**unused_function** (2):
- Line 161: `init_logging_with_config`
- Line 161: `init_logging_with_config`

**unused_import** (1):
- Line 250: `std::fs`

**unknown** (1):
- Line 265: `assert_eq!`

### security_logging.rs (5 warnings)

**unknown** (3):
- Line 50: `PathViolation`
- Line 50: `PathViolation`
- Line 84: `AuthenticationFailure`

**unused_function** (2):
- Line 313: `log_security_events`
- Line 313: `log_security_events`

### server.rs (5 warnings)

**unused_field** (2):
- Line 17: `vault_path`
- Line 17: `vault_path`

**unknown** (1):
- Line 329: |             };

**unused_import** (1):
- Line 672: `Duration`

**unused_variable** (1):
- Line 945: `encrypted_file_size`

### migrations_error_handling_test.rs (5 warnings)

**unused_import** (2):
- Line 4: `KiyyaError`
- Line 5: `MigrationInfo`

**unknown** (2):
- Line 471: mod property_tests {
- Line 778: `expect`

**unused_variable** (1):
- Line 683: `original_error_msg`

### migration_clean_run_test.rs (5 warnings)

**unknown** (5):
- Line 8: mod migration_clean_run_tests {
- Line 115: `expect`
- Line 353: `expect`
- Line 359: `expect`
- Line 357: `expect`

### path_security.rs (4 warnings)

**unused_import** (2):
- Line 23: `SecurityEvent`
- Line 23: `SecurityEvent`

**unknown** (2):
- Line 147: if path_str.starts_with(r"\\?\") {
- Line 38: `return`

### logging_test.rs (4 warnings)

**unknown** (3):
- Line 30: `assert_eq!`
- Line 47: `assert_eq!`
- Line 48: `assert_eq!`

**unused_import** (1):
- Line 2: `std::fs`

### filesystem_access_test.rs (4 warnings)

**unknown** (3):
- Line 14: mod tests {
- Line 167: `unwrap`
- Line 381: `unwrap`

**unused_import** (1):
- Line 21: `std::path::PathBuf`

### migration_property_test.rs (4 warnings)

**unknown** (2):
- Line 6: mod migration_property_tests {
- Line 147: `i`

**unused_import** (1):
- Line 10: `crate::database::Database`

**unused_function** (1):
- Line 77: `migration_version_strategy`

### rate_limit_timeout_test.rs (3 warnings)

**unknown** (3):
- Line 6: mod tests {
- Line 71: `vec!`
- Line 91: `vec!`

### encryption_key_management_test.rs (3 warnings)

**unknown** (2):
- Line 12: mod encryption_key_management_tests {
- Line 437: `assert_eq!`

**unused_variable** (1):
- Line 111: `db`

### database_initialization_test.rs (3 warnings)

**unknown** (2):
- Line 228: fts5_available == true || fts5_available == false,
- Line 228: fts5_available == true || fts5_available == false,

**unused_variable** (1):
- Line 93: `db`

### search_test.rs (3 warnings)

**unknown** (3):
- Line 146: results.len() >= 1,
- Line 218: assert!(db.fts5_available == true || db.fts5_available == fa...
- Line 218: assert!(db.fts5_available == true || db.fts5_available == fa...

### http_range_property_test.rs (3 warnings)

**unknown** (3):
- Line 36: |             };
- Line 137: |         };
- Line 186: let end = if start > gap { start - gap } else { 0 };

### validation.rs (3 warnings)

**unknown** (3):
- Line 587: `vec!`
- Line 590: `vec!`
- Line 591: `vec!`

### migrations.rs (2 warnings)

**unused_function** (2):
- Line 694: `get_migrations`
- Line 694: `get_migrations`

### valid_claim_id_property_test.rs (2 warnings)

**unknown** (1):
- Line 13: mod valid_claim_id_property_tests {

**unused_import** (1):
- Line 17: `build_cdn_playback_url`

### response_structure_property_test.rs (2 warnings)

**unknown** (2):
- Line 14: mod response_structure_property_tests {
- Line 187: content.video_urls.len() >= 1,

### channel_id_parameter_property_test.rs (2 warnings)

**unknown** (2):
- Line 9: mod channel_id_parameter_tests {
- Line 298: mod invalid_channel_id_rejection_tests {

### diagnostics_test.rs (2 warnings)

**unused_import** (1):
- Line 5: `std::path::Path`

**unknown** (1):
- Line 216: `vec!`

### gateway_failover_property_test.rs (2 warnings)

**unknown** (2):
- Line 102: `Range::contains`
- Line 105: `Range::contains`

### crash_reporting.rs (1 warnings)

**unknown** (1):
- Line 30: `1.60.0`

### monitoring_local_test.rs (1 warnings)

**unknown** (1):
- Line 14: mod tests {

### security_restrictions_test.rs (1 warnings)

**unknown** (1):
- Line 10: mod tests {

### cache_ttl_property_test.rs (1 warnings)

**unknown** (1):
- Line 9: mod cache_ttl_property_tests {

### cdn_builder_determinism_property_test.rs (1 warnings)

**unknown** (1):
- Line 8: mod cdn_builder_determinism_tests {

### missing_direct_urls_property_test.rs (1 warnings)

**unknown** (1):
- Line 9: mod missing_direct_urls_property_tests {

### missing_claim_id_property_test.rs (1 warnings)

**unknown** (1):
- Line 8: mod missing_claim_id_property_tests {

### partial_success_property_test.rs (1 warnings)

**unknown** (1):
- Line 11: mod partial_success_property_tests {

### error_structure_property_test.rs (1 warnings)

**unknown** (1):
- Line 10: mod error_structure_property_tests {

### channel_id_format_validation_property_test.rs (1 warnings)

**unknown** (1):
- Line 8: mod channel_id_format_validation_tests {

### valid_channel_id_acceptance_property_test.rs (1 warnings)

**unknown** (1):
- Line 8: mod valid_channel_id_acceptance_tests {

### download_resumable_atomic_property_test.rs (1 warnings)

**unknown** (1):
- Line 17: mod download_resumable_atomic_property_tests {

### tag_immutability_test.rs (1 warnings)

**unknown** (1):
- Line 1: mod tests {

### gateway_production_test.rs (1 warnings)

**unknown** (1):
- Line 13: mod tests {

### database_optimization_test.rs (1 warnings)

**unused_variable** (1):
- Line 46: `db`

### sql_injection_test.rs (1 warnings)

**clippy_needless_borrows** (1):
- Line 57: prop_assert!(sanitized.contains(&column));

### security_logging_integration_test.rs (1 warnings)

**unknown** (1):
- Line 109: `true`

