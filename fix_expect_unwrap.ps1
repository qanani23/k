# Fix expect_fun_call and unnecessary_unwrap warnings

Write-Host "Fixing expect and unwrap issues..."

# Fix filesystem_access_test.rs unnecessary_unwrap (2 occurrences)
$file = "src-tauri/src/filesystem_access_test.rs"
if (Test-Path $file) {
    $lines = Get-Content $file
    $newLines = @()
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        
        # Pattern 1: if result.is_ok() { let validated_path = result.unwrap();
        if ($line -match '^\s*if result\.is_ok\(\) \{' -and $i -lt ($lines.Count - 1)) {
            $nextLine = $lines[$i + 1]
            if ($nextLine -match '^\s*let validated_path = result\.unwrap\(\);') {
                # Replace with if let Ok
                if ($line -match '^\s*') {
                    $indent = $matches[0]
                } else {
                    $indent = ''
                }
                $newLines += "$indent" + "if let Ok(validated_path) = result {"
                $i++ # Skip the unwrap line
                continue
            }
        }
        
        $newLines += $line
    }
    
    $newLines | Set-Content $file -Encoding UTF8
    Write-Host "  Fixed $file"
}

# Fix migrations_error_handling_test.rs expect_fun_call
$file = "src-tauri/src/migrations_error_handling_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.expect\(&format!\("Migration version \{\} not found in history", version\)\)', '.unwrap_or_else(|| panic!("Migration version {} not found in history", version))'
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

# Fix integration_test.rs expect_fun_call (5 occurrences)
$file = "src-tauri/src/integration_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.expect\(&format!\("Failed to create database on cycle \{\}", i\)\)', '.unwrap_or_else(|_| panic!("Failed to create database on cycle {}", i))'
    $content = $content -replace '\.expect\(&format!\("Failed to run migrations on cycle \{\}", i\)\)', '.unwrap_or_else(|_| panic!("Failed to run migrations on cycle {}", i))'
    $content = $content -replace '\.expect\(&format!\("Failed to get favorites on cycle \{\}", i\)\)', '.unwrap_or_else(|_| panic!("Failed to get favorites on cycle {}", i))'
    $content = $content -replace '\.expect\(&format!\("Failed to save favorite \{\}", i\)\)', '.unwrap_or_else(|_| panic!("Failed to save favorite {}", i))'
    $content = $content -replace '\.expect\(&format!\("Failed to check favorite \{\}", i\)\)', '.unwrap_or_else(|_| panic!("Failed to check favorite {}", i))'
    $content = $content -replace 'table_exists\(&db_path, table\)\.expect\(&format!\("Failed to check table \{\}", table\)\)', 'table_exists(&db_path, table).unwrap_or_else(|_| panic!("Failed to check table {}", table))'
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

# Fix migration_clean_run_test.rs expect_fun_call (4 occurrences)
$file = "src-tauri/src/migration_clean_run_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace 'table_exists\(&db_path, table\)\.expect\(&format!\("Failed to check \{\} table", table\)\)', 'table_exists(&db_path, table).unwrap_or_else(|_| panic!("Failed to check {} table", table))'
    $content = $content -replace '\.expect\(&format!\("Failed to get table info for \{\}", table\)\)', '.unwrap_or_else(|_| panic!("Failed to get table info for {}", table))'
    $content = $content -replace '\.expect\(&format!\("Failed to collect columns for \{\}", table\)\)', '.unwrap_or_else(|_| panic!("Failed to collect columns for {}", table))'
    $content = $content -replace '\.expect\(&format!\("Failed to query columns for \{\}", table\)\)', '.unwrap_or_else(|_| panic!("Failed to query columns for {}", table))'
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

# Fix hero_stream_filter_test.rs unnecessary_literal_unwrap (2 occurrences)
$file = "src-tauri/src/hero_stream_filter_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Replace Some(vec![...]).unwrap() with just vec![...]
    $content = $content -replace 'let stream_types = Some\(vec!\["stream"\.to_string\(\)\]\);\s+\n\s+let result = parse_claim_search_response\(\s+\n\s+OdyseeResponse \{\s+\n\s+success: true,\s+\n\s+data: Some\(json!\(\{\s+\n\s+"items": claims\s+\n\s+\}\)\),\s+\n\s+error: None,\s+\n\s+\},\s+\n\s+stream_types\.unwrap\(\),', 'let stream_types = vec!["stream".to_string()];\n        let result = parse_claim_search_response(\n            OdyseeResponse {\n                success: true,\n                data: Some(json!({\n                    "items": claims\n                })),\n                error: None,\n            },\n            stream_types,'
    Set-Content $file $content -NoNewline
    Write-Host "  Fixed $file"
}

Write-Host "`nDone! Fixed expect and unwrap issues."
