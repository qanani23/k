# Fix useless vec warnings in remaining files

$fixes = @(
    @{
        file = "src-tauri/src/diagnostics_test.rs"
        old = 'let required_components = vec![
        "system_info.txt",
        "database_metadata.txt",
        "logs/recent_1.log",
        "error_logs.txt",
        "logs/gateway.log",
        "config.txt",
    ];'
        new = 'let required_components = [
        "system_info.txt",
        "database_metadata.txt",
        "logs/recent_1.log",
        "error_logs.txt",
        "logs/gateway.log",
        "config.txt",
    ];'
    },
    @{
        file = "src-tauri/src/hero_stream_filter_test.rs"
        line = 14
        old = 'let _tags = vec!["hero_trailer".to_string()];'
        new = 'let _tags = ["hero_trailer".to_string()];'
    },
    @{
        file = "src-tauri/src/hero_stream_filter_test.rs"
        line = 47
        old = 'let _tags = vec!["movie".to_string()];'
        new = 'let _tags = ["movie".to_string()];'
    },
    @{
        file = "src-tauri/src/hero_stream_filter_test.rs"
        line = 123
        old = 'let tags = vec!["hero_trailer".to_string()];'
        new = 'let tags = ["hero_trailer".to_string()];'
    }
)

foreach ($fix in $fixes) {
    $file = $fix.file
    if (Test-Path $file) {
        Write-Host "Processing $file..."
        $content = Get-Content $file -Raw
        $content = $content -replace [regex]::Escape($fix.old), $fix.new
        Set-Content $file $content -NoNewline
        Write-Host "  Fixed $file"
    }
}

Write-Host "`nDone! Fixed useless vec warnings."
