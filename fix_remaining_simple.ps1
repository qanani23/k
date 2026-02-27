# Fix remaining simple clippy warnings

Write-Host "Fixing remaining simple issues..."

# Fix search_test.rs len comparison
$file = "src-tauri/src/search_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace 'results\.len\(\) >= 1,', '!results.is_empty(),'
    # Fix bool comparisons
    $content = $content -replace 'db\.fts5_available == true', 'db.fts5_available'
    $content = $content -replace 'db\.fts5_available == false', '!db.fts5_available'
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

# Fix path_security.rs needless return
$file = "src-tauri/src/path_security.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace 'return Ok\(test_dir\);', 'Ok(test_dir)'
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

# Fix database.rs absurd comparison
$file = "src-tauri/src/database.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Remove the useless >= 0 check for unsigned type
    $content = $content -replace 'assert!\(version >= 0, "Database version should be non-negative"\);', '// Version is u32, always non-negative'
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

# Fix database_initialization_test.rs bool comparisons
$file = "src-tauri/src/database_initialization_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace 'fts5_available == true', 'fts5_available'
    $content = $content -replace 'fts5_available == false', '!fts5_available'
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

# Fix integration_test.rs bool comparisons and absurd comparison
$file = "src-tauri/src/integration_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace 'fts5_available == true', 'fts5_available'
    $content = $content -replace 'fts5_available == false', '!fts5_available'
    # Remove useless >= 0 check
    $content = $content -replace 'assert!\(favorites\.len\(\) >= 0, "Database should be operational"\);', '// favorites.len() is always >= 0 (usize)'
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

# Fix sql_injection_test.rs needless borrow
$file = "src-tauri/src/sql_injection_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace 'prop_assert!\(sanitized\.contains\(&column\)\);', 'prop_assert!(sanitized.contains(column));'
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

# Fix response_structure_property_test.rs len comparison
$file = "src-tauri/src/response_structure_property_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace 'content\.video_urls\.len\(\) >= 1,', '!content.video_urls.is_empty(),'
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

# Fix migration_property_test.rs needless range loop
$file = "src-tauri/src/migration_property_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace 'for i in 0\.\.applied_versions\.len\(\) \{', 'for (i, _) in applied_versions.iter().enumerate() {'
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

Write-Host "`nDone! Fixed remaining simple issues."
