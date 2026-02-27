# Fix empty lines after doc comments in Rust test files

$files = @(
    "src-tauri/src/input_validation_test.rs",
    "src-tauri/src/monitoring_local_test.rs",
    "src-tauri/src/security_restrictions_test.rs",
    "src-tauri/src/filesystem_access_test.rs",
    "src-tauri/src/cache_ttl_property_test.rs",
    "src-tauri/src/cdn_builder_determinism_property_test.rs",
    "src-tauri/src/missing_direct_urls_property_test.rs",
    "src-tauri/src/valid_claim_id_property_test.rs",
    "src-tauri/src/missing_claim_id_property_test.rs",
    "src-tauri/src/response_structure_property_test.rs",
    "src-tauri/src/partial_success_property_test.rs",
    "src-tauri/src/error_structure_property_test.rs",
    "src-tauri/src/migrations_error_handling_test.rs",
    "src-tauri/src/channel_id_parameter_property_test.rs",
    "src-tauri/src/channel_id_format_validation_property_test.rs",
    "src-tauri/src/valid_channel_id_acceptance_property_test.rs",
    "src-tauri/src/migration_property_test.rs",
    "src-tauri/src/download_resumable_atomic_property_test.rs",
    "src-tauri/src/encryption_key_management_test.rs",
    "src-tauri/src/tag_immutability_test.rs",
    "src-tauri/src/gateway_production_test.rs",
    "src-tauri/src/migration_clean_run_test.rs"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Processing $file..."
        $content = Get-Content $file -Raw
        
        # Remove empty line between doc comment and #[cfg(test)]
        $content = $content -replace '(\*\/|\/{3}.*)\r?\n\r?\n(\s*#\[cfg\(test\)\])', '$1' + "`n" + '$2'
        
        Set-Content $file $content -NoNewline
        Write-Host "Fixed $file"
    }
}

Write-Host "Done!"
