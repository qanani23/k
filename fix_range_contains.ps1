# Fix manual range contains warnings

Write-Host "Fixing manual range contains..."

# Fix gateway.rs (6 occurrences)
$file = "src-tauri/src/gateway.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace 'delay_0_with_jitter >= 300 && delay_0_with_jitter < 400', '(300..400).contains(&delay_0_with_jitter)'
    $content = $content -replace 'delay_1_with_jitter >= 1000 && delay_1_with_jitter < 1100', '(1000..1100).contains(&delay_1_with_jitter)'
    $content = $content -replace 'delay_2_with_jitter >= 2000 && delay_2_with_jitter < 2100', '(2000..2100).contains(&delay_2_with_jitter)'
    $content = $content -replace 'retry_delay_0_with_jitter >= 200 && retry_delay_0_with_jitter < 250', '(200..250).contains(&retry_delay_0_with_jitter)'
    $content = $content -replace 'retry_delay_1_with_jitter >= 500 && retry_delay_1_with_jitter < 550', '(500..550).contains(&retry_delay_1_with_jitter)'
    $content = $content -replace 'retry_delay_2_with_jitter >= 1000 && retry_delay_2_with_jitter < 1050', '(1000..1050).contains(&retry_delay_2_with_jitter)'
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

# Fix gateway_failover_property_test.rs (2 occurrences)
$file = "src-tauri/src/gateway_failover_property_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace 'retry_delay_0_with_jitter >= 200 && retry_delay_0_with_jitter < 250', '(200..250).contains(&retry_delay_0_with_jitter)'
    $content = $content -replace 'failover_delay_0_with_jitter >= 300 && failover_delay_0_with_jitter < 400', '(300..400).contains(&failover_delay_0_with_jitter)'
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

# Fix http_range_property_test.rs (3 implicit saturating sub)
$file = "src-tauri/src/http_range_property_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Fix first occurrence (lines 36-40)
    $content = $content -replace 'let start = if suffix >= file_size \{\s+0\s+\} else \{\s+file_size - suffix\s+\};', 'let start = file_size.saturating_sub(suffix);'
    # Fix second occurrence (lines 137-141)
    $content = $content -replace 'let expected_start = if suffix >= file_size \{\s+0\s+\} else \{\s+file_size - suffix\s+\};', 'let expected_start = file_size.saturating_sub(suffix);'
    # Fix third occurrence (line 186)
    $content = $content -replace 'let end = if start > gap \{ start - gap \} else \{ 0 \};', 'let end = start.saturating_sub(gap);'
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

Write-Host "`nDone! Fixed range contains and saturating sub."
