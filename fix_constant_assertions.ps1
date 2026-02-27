# Fix assertions on constants (assert!(true) warnings)

Write-Host "Fixing assertions on constants..."

# force_refresh_test.rs - Remove assert!(true) statements
$file = "src-tauri/src/force_refresh_test.rs"
if (Test-Path $file) {
    $lines = Get-Content $file
    $newLines = @()
    $skipNext = 0
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($skipNext -gt 0) {
            $skipNext--
            continue
        }
        
        $line = $lines[$i]
        
        # Skip multi-line assert!(true, ...) statements
        if ($line -match '^\s*assert!\(\s*$' -and $i -lt ($lines.Count - 2)) {
            $nextLine = $lines[$i + 1]
            if ($nextLine -match '^\s*true,\s*$') {
                # Skip this assert and the next 2 lines (true, message, closing paren)
                $skipNext = 2
                continue
            }
        }
        
        # Skip single-line assert!(true, "message")
        if ($line -match '^\s*assert!\(true,.*\);\s*$') {
            continue
        }
        
        $newLines += $line
    }
    
    $newLines | Set-Content $file -Encoding UTF8
    Write-Host "  Fixed $file"
}

# security_logging_integration_test.rs
$file = "src-tauri/src/security_logging_integration_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '^\s*assert!\(true\);\s*$', '', 'Multiline'
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

# security_logging_e2e_test.rs - Multiple assert!(true) statements
$file = "src-tauri/src/security_logging_e2e_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Remove all assert!(true, "message") statements
    $content = $content -replace '^\s*assert!\(true,\s*"[^"]*"\);\s*\r?\n', '', 'Multiline'
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

Write-Host "`nDone! Fixed assertions on constants."
