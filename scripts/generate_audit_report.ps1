# Automated Audit Script
Write-Host "Starting audit..." -ForegroundColor Cyan
$AuditDir = "stabilization"
if (-not (Test-Path $AuditDir)) { New-Item -ItemType Directory -Path $AuditDir | Out-Null }
$WarningsFile = Join-Path $AuditDir "audit_warnings.txt"
$ClippyFile = Join-Path $AuditDir "audit_clippy.txt"
$CommandsFile = Join-Path $AuditDir "tauri_command_defs.txt"
$BuilderFile = Join-Path $AuditDir "tauri_builder.txt"
$DynamicFile = Join-Path $AuditDir "dynamic_invocation_patterns.txt"
$JsonReport = Join-Path $AuditDir "audit_report.json"

Write-Host "Step 1: Build warnings..." -ForegroundColor Yellow
Push-Location src-tauri
cargo build 2>&1 | Tee-Object -FilePath "..\$WarningsFile"
Pop-Location
Write-Host "Done" -ForegroundColor Green

Write-Host "Step 2: Clippy..." -ForegroundColor Yellow
Push-Location src-tauri
cargo clippy --all-targets --all-features 2>&1 | Tee-Object -FilePath "..\$ClippyFile"
Pop-Location
Write-Host "Done" -ForegroundColor Green

Write-Host "Step 3: Tauri commands..." -ForegroundColor Yellow
if (Get-Command rg -ErrorAction SilentlyContinue) {
    rg "#\[tauri::command\]" -n src-tauri/src/ 2>&1 | Out-File $CommandsFile
} else {
    "ripgrep not found" | Out-File $CommandsFile
}
Write-Host "Done" -ForegroundColor Green

Write-Host "Step 4: Builder registrations..." -ForegroundColor Yellow
if (Get-Command rg -ErrorAction SilentlyContinue) {
    $pattern = 'invoke_handler\(|tauri::Builder'
    & rg $pattern -n src-tauri/src/ 2>&1 | Out-File $BuilderFile
} else {
    "ripgrep not found" | Out-File $BuilderFile
}
Write-Host "Done" -ForegroundColor Green

Write-Host "Step 5: Dynamic patterns..." -ForegroundColor Yellow
if (Get-Command rg -ErrorAction SilentlyContinue) {
    "=== Dynamic Invocation Patterns ===" | Out-File $DynamicFile
    "" | Out-File $DynamicFile -Append
    "Template literals:" | Out-File $DynamicFile -Append
    rg 'fetch_\$\{.*?\}' -n src/ 2>&1 | Out-File $DynamicFile -Append
    "" | Out-File $DynamicFile -Append
    "Array joins:" | Out-File $DynamicFile -Append
    rg "\[.*fetch.*\]\.join\(" -n src/ 2>&1 | Out-File $DynamicFile -Append
    "" | Out-File $DynamicFile -Append
    "Dynamic invokes:" | Out-File $DynamicFile -Append
    rg "invoke\(.*\$\{" -n src/ 2>&1 | Out-File $DynamicFile -Append
} else {
    "ripgrep not found" | Out-File $DynamicFile
}
Write-Host "Done" -ForegroundColor Green

Write-Host "Step 6: JSON report..." -ForegroundColor Yellow
$wc = 0; $cc = 0; $tc = 0; $df = $false
if (Test-Path $WarningsFile) { $wc = (Select-String -Path $WarningsFile -Pattern "warning:" -AllMatches).Count }
if (Test-Path $ClippyFile) { $cc = (Select-String -Path $ClippyFile -Pattern "warning:" -AllMatches).Count }
if (Test-Path $CommandsFile) { $tc = (Select-String -Path $CommandsFile -Pattern "#\[tauri::command\]" -AllMatches).Count }
if (Test-Path $DynamicFile) { $df = (Get-Content $DynamicFile -Raw) -match "src/" }

$json = @{
    audit_metadata = @{ timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"); platform = "windows"; script_version = "1.0.0" }
    summary = @{ total_warnings = $wc; clippy_warnings = $cc; tauri_commands_found = $tc; dynamic_patterns_found = $df }
    files = @{ warnings = $WarningsFile; clippy = $ClippyFile; commands = $CommandsFile; builder = $BuilderFile; dynamic_patterns = $DynamicFile }
}
$json | ConvertTo-Json -Depth 10 | Out-File $JsonReport -Encoding UTF8
Write-Host "Done" -ForegroundColor Green

Write-Host ""
Write-Host "Audit Complete!" -ForegroundColor Cyan
Write-Host "Results in: $AuditDir" -ForegroundColor Cyan
