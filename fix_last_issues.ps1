# Fix last remaining issues

Write-Host "Fixing last issues..."

# Fix security_logging_integration_test.rs - remove assert!(true)
$file = "src-tauri/src/security_logging_integration_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\s+assert!\(true\);', ''
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

# Fix security_logging_e2e_test.rs - remove all assert!(true, "message") statements
$file = "src-tauri/src/security_logging_e2e_test.rs"
if (Test-Path $file) {
    $lines = Get-Content $file
    $newLines = @()
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        
        # Skip lines with assert!(true, "message")
        if ($line -match '^\s*assert!\(true,\s*"[^"]*"\);') {
            continue
        }
        
        $newLines += $line
    }
    
    $newLines | Set-Content $file -Encoding UTF8
    Write-Host "  Fixed $file"
}

# Fix hero_stream_filter_test.rs - remove Some().unwrap()
$file = "src-tauri/src/hero_stream_filter_test.rs"
if (Test-Path $file) {
    $lines = Get-Content $file
    $newLines = @()
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        
        # Replace Some(vec![...]) with just vec![...]
        if ($line -match 'let stream_types = Some\(vec!\["stream"\.to_string\(\)\]\);') {
            $newLines += '        let stream_types = vec!["stream".to_string()];'
            continue
        }
        
        # Remove .unwrap() from stream_types
        if ($line -match 'stream_types\.unwrap\(\),') {
            $newLines += '            stream_types,'
            continue
        }
        
        $newLines += $line
    }
    
    $newLines | Set-Content $file -Encoding UTF8
    Write-Host "  Fixed $file"
}

# Fix invisible character in filesystem_access_test.rs
$file = "src-tauri/src/filesystem_access_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw -Encoding UTF8
    # Remove zero-width spaces and other invisible characters
    $content = $content -replace '[\u200B-\u200D\uFEFF]', ''
    Set-Content $file $content -NoNewline -Encoding UTF8
    Write-Host "  Fixed $file"
}

# Fix main.rs duplicate attribute
$file = "src-tauri/src/main.rs"
if (Test-Path $file) {
    $lines = Get-Content $file
    $newLines = @()
    $prevLine = ""
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        
        # Skip duplicate #![deny(warnings)]
        if ($line -match '^\s*#!\[deny\(warnings\)\]' -and $prevLine -match '^\s*#!\[deny\(warnings\)\]') {
            continue
        }
        
        $newLines += $line
        $prevLine = $line
    }
    
    $newLines | Set-Content $file -Encoding UTF8
    Write-Host "  Fixed $file"
}

Write-Host "`nDone! Fixed last issues."
