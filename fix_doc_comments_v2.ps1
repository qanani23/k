# Fix empty lines after doc comments in Rust test files

$files = @(
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

$fixedCount = 0

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Processing $file..."
        $lines = Get-Content $file
        $newLines = @()
        $i = 0
        
        while ($i -lt $lines.Count) {
            $currentLine = $lines[$i]
            
            # Check if current line is empty and next line is #[cfg(test)]
            if ($i -lt ($lines.Count - 1)) {
                $nextLine = $lines[$i + 1]
                
                # If current line is empty and next line starts with #[cfg(test)]
                if ($currentLine -match '^\s*$' -and $nextLine -match '^\s*#\[cfg\(test\)\]') {
                    # Check if previous line was a doc comment
                    if ($i -gt 0) {
                        $prevLine = $lines[$i - 1]
                        if ($prevLine -match '^\s*(///|/\*\*)' -or $prevLine -match '\*/$') {
                            # Skip this empty line
                            Write-Host "  Removed empty line before #[cfg(test)] at line $($i + 1)"
                            $fixedCount++
                            $i++
                            continue
                        }
                    }
                }
            }
            
            $newLines += $currentLine
            $i++
        }
        
        # Write back to file
        $newLines | Set-Content $file -Encoding UTF8
        Write-Host "  Processed $file"
    } else {
        Write-Host "  File not found: $file"
    }
}

Write-Host "`nDone! Fixed $fixedCount empty lines."
Write-Host "Run 'cargo clippy --all-targets --all-features -- -D warnings' to verify"
