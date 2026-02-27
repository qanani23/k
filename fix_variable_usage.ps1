# Fix variable usage in integration_test.rs

Write-Host "Fixing variable usage..."

$file = "src-tauri/src/integration_test.rs"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    
    # Find all instances where _favorites or _fts5_available are used after assignment
    # We need to check if the variable is used in subsequent lines
    
    $lines = Get-Content $file
    $newLines = @()
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        
        # Check if this line assigns _favorites
        if ($line -match 'let _favorites = ') {
            # Look ahead to see if favorites is used (without underscore)
            $usedLater = $false
            for ($j = $i + 1; $j -lt [Math]::Min($i + 20, $lines.Count); $j++) {
                if ($lines[$j] -match '\bfavorites\b' -and $lines[$j] -notmatch 'let _favorites') {
                    $usedLater = $true
                    break
                }
            }
            
            if ($usedLater) {
                # Remove the underscore
                $line = $line -replace 'let _favorites = ', 'let favorites = '
            }
        }
        
        # Check if this line assigns _fts5_available
        if ($line -match 'let _fts5_available = ') {
            # Look ahead to see if fts5_available is used (without underscore)
            $usedLater = $false
            for ($j = $i + 1; $j -lt [Math]::Min($i + 20, $lines.Count); $j++) {
                if ($lines[$j] -match '\bfts5_available\b' -and $lines[$j] -notmatch 'let _fts5_available') {
                    $usedLater = $true
                    break
                }
            }
            
            if ($usedLater) {
                # Remove the underscore
                $line = $line -replace 'let _fts5_available = ', 'let fts5_available = '
            }
        }
        
        $newLines += $line
    }
    
    $newLines | Set-Content $file -Encoding UTF8
    Write-Host "  Fixed $file"
}

Write-Host "`nDone! Fixed variable usage."
