# Fix final remaining issues

Write-Host "Fixing final issues..."

# Fix duplicate attribute in commands.rs and main.rs
$file = "src-tauri/src/commands.rs"
if (Test-Path $file) {
    $lines = Get-Content $file
    $newLines = @()
    $seenTest = $false
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        
        # Skip duplicate #[cfg(test)] if we've already seen one in this test module
        if ($line -match '^\s*#\[cfg\(test\)\]') {
            if ($seenTest -and $i -gt 0 -and $newLines[-1] -match '^\s*#\[cfg\(test\)\]') {
                continue
            }
            $seenTest = $true
        }
        
        $newLines += $line
    }
    
    $newLines | Set-Content $file -Encoding UTF8
    Write-Host "  Fixed $file"
}

# Fix empty line after doc comment in force_refresh_test.rs
$file = "src-tauri/src/force_refresh_test.rs"
if (Test-Path $file) {
    $lines = Get-Content $file
    $newLines = @()
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        
        # Remove empty line before #[cfg(test)]
        if ($line -match '^\s*$' -and $i -lt ($lines.Count - 1)) {
            $nextLine = $lines[$i + 1]
            if ($nextLine -match '^\s*#\[cfg\(test\)\]' -and $i -gt 0) {
                $prevLine = $lines[$i - 1]
                if ($prevLine -match '^\s*(///|/\*\*)' -or $prevLine -match '\*/$') {
                    continue
                }
            }
        }
        
        $newLines += $line
    }
    
    $newLines | Set-Content $file -Encoding UTF8
    Write-Host "  Fixed $file"
}

# Fix empty line after doc comment in filesystem_access_test.rs
$file = "src-tauri/src/filesystem_access_test.rs"
if (Test-Path $file) {
    $lines = Get-Content $file
    $newLines = @()
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        
        # Remove empty line before #[cfg(test)]
        if ($line -match '^\s*$' -and $i -lt ($lines.Count - 1)) {
            $nextLine = $lines[$i + 1]
            if ($nextLine -match '^\s*#\[cfg\(test\)\]' -and $i -gt 0) {
                $prevLine = $lines[$i - 1]
                if ($prevLine -match '^\s*(///|/\*\*)' -or $prevLine -match '\*/$') {
                    continue
                }
            }
        }
        
        $newLines += $line
    }
    
    $newLines | Set-Content $file -Encoding UTF8
    Write-Host "  Fixed $file"
}

# Fix unused variables
$file = "src-tauri/src/database.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace 'let version = ', 'let _version = '
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

$file = "src-tauri/src/integration_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '(\s+)let favorites = ', '$1let _favorites = '
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

# Fix dead code warnings - add #[allow(dead_code)]
$file = "src-tauri/src/security_logging_e2e_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '(\s+)fn get_security_log_path', '$1#[allow(dead_code)]$1fn get_security_log_path'
    $content = $content -replace '(\s+)fn read_security_log', '$1#[allow(dead_code)]$1fn read_security_log'
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

$file = "src-tauri/src/migration_property_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '(\s+)fn migration_version_strategy', '$1#[allow(dead_code)]$1fn migration_version_strategy'
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

# Fix boolean logic bugs in search_test.rs, database_initialization_test.rs, integration_test.rs
$file = "src-tauri/src/search_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Replace the entire assert with a simpler one
    $content = $content -replace 'assert!\(db\.fts5_available \|\| !db\.fts5_available\);', '// FTS5 availability is a boolean value'
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

$file = "src-tauri/src/database_initialization_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace 'assert!\(\s+fts5_available \|\| !fts5_available,', '// FTS5 availability is a boolean value'
    $content = $content -replace '\s+"FTS5 availability should be a boolean value"\s+\);', ''
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

$file = "src-tauri/src/integration_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace 'assert!\(\s+fts5_available \|\| !fts5_available,', '// FTS5 availability is a boolean value'
    $content = $content -replace '\s+"FTS5 availability should be a boolean value"\s+\);', ''
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

Write-Host "`nDone! Fixed final issues."
