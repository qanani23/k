# Fix bool assert comparison warnings

Write-Host "Fixing bool assert comparisons..."

# logging.rs:394
$file = "src-tauri/src/logging.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace 'assert_eq!\(config\.enable_file, true\);', 'assert!(config.enable_file);'
    $content = $content -replace '!std::env::var\("LOG_LEVEL"\)\.is_err\(\)', 'std::env::var("LOG_LEVEL").is_ok()'
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

# logging_test.rs
$file = "src-tauri/src/logging_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace 'assert_eq!\(config\.enable_file, true\);', 'assert!(config.enable_file);'
    $content = $content -replace 'assert_eq!\(config\.enable_console, false\);', 'assert!(!config.enable_console);'
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

# force_refresh_test.rs
$file = "src-tauri/src/force_refresh_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Fix unwrap_or on None
    $content = $content -replace 'let force_refresh: Option<bool> = None;\s+let should_force_refresh = force_refresh\.unwrap_or\(false\);', 'let should_force_refresh = false;'
    # Fix unwrap_or on Some(true)
    $content = $content -replace 'let force_refresh: Option<bool> = Some\(true\);\s+let should_force_refresh = force_refresh\.unwrap_or\(false\);', 'let should_force_refresh = true;'
    # Fix unwrap_or on Some(false)
    $content = $content -replace 'let force_refresh: Option<bool> = Some\(false\);\s+let should_force_refresh = force_refresh\.unwrap_or\(false\);', 'let should_force_refresh = false;'
    # Fix assert_eq with false
    $content = $content -replace 'assert_eq!\(\s*should_force_refresh,\s*false,', 'assert!(!should_force_refresh,'
    # Fix assert_eq with true
    $content = $content -replace 'assert_eq!\(\s*should_force_refresh,\s*true,', 'assert!(should_force_refresh,'
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

# encryption_key_management_test.rs:436
$file = "src-tauri/src/encryption_key_management_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace 'assert_eq!\(encrypted_value, true, "Should store boolean flag"\);', 'assert!(encrypted_value, "Should store boolean flag");'
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

Write-Host "`nDone! Fixed bool assert comparisons."
