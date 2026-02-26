@echo off
echo Creating PowerShell audit script...
(
echo # Automated Audit Script for Windows
echo $ErrorActionPreference = "Continue"
echo.
echo Write-Host "Kiyya Desktop - Automated Audit Report" -ForegroundColor Cyan
echo Write-Host "Timestamp: $((Get-Date^).ToUniversalTime(^).ToString('yyyy-MM-dd HH:mm:ss UTC'^)^)"
echo Write-Host ""
echo.
echo # Create output directory
echo $AuditDir = "stabilization"
echo if (-not (Test-Path $AuditDir^)^) { New-Item -ItemType Directory -Path $AuditDir ^| Out-Null }
echo.
echo # Output files
echo $WarningsFile = Join-Path $AuditDir "audit_warnings.txt"
echo $ClippyFile = Join-Path $AuditDir "audit_clippy.txt"
echo $CommandsFile = Join-Path $AuditDir "tauri_command_defs.txt"
echo $BuilderFile = Join-Path $AuditDir "tauri_builder.txt"
echo $DynamicFile = Join-Path $AuditDir "dynamic_invocation_patterns.txt"
echo $JsonReport = Join-Path $AuditDir "audit_report.json"
echo.
echo Write-Host "Step 1: Capturing cargo build warnings..." -ForegroundColor Yellow
echo Push-Location src-tauri
echo cargo build 2^>^&1 ^| Tee-Object -FilePath "..\$WarningsFile"
echo Pop-Location
echo Write-Host "Done: Build warnings saved" -ForegroundColor Green
echo Write-Host ""
echo.
echo Write-Host "Step 2: Running cargo clippy..." -ForegroundColor Yellow
echo Push-Location src-tauri
echo cargo clippy --all-targets --all-features 2^>^&1 ^| Tee-Object -FilePath "..\$ClippyFile"
echo Pop-Location
echo Write-Host "Done: Clippy output saved" -ForegroundColor Green
echo Write-Host ""
echo.
echo Write-Host "Step 3: Discovering Tauri commands..." -ForegroundColor Yellow
echo if (Get-Command rg -ErrorAction SilentlyContinue^) {
echo     rg "#\[tauri::command\]" -n src-tauri/src/ 2^>^&1 ^| Out-File $CommandsFile
echo     Write-Host "Done: Tauri commands found" -ForegroundColor Green
echo } else {
echo     "ripgrep not found" ^| Out-File $CommandsFile
echo     Write-Host "Warning: ripgrep not found" -ForegroundColor Yellow
echo }
echo Write-Host ""
echo.
echo Write-Host "Step 4: Finding builder registrations..." -ForegroundColor Yellow
echo if (Get-Command rg -ErrorAction SilentlyContinue^) {
echo     $p = 'invoke_handler\(^|tauri::Builder'
echo     ^& rg $p -n src-tauri/src/ 2^>^&1 ^| Out-File $BuilderFile
echo     Write-Host "Done: Builder registrations found" -ForegroundColor Green
echo } else {
echo     Write-Host "Warning: ripgrep not found" -ForegroundColor Yellow
echo }
echo Write-Host ""
echo.
echo Write-Host "Step 5: Detecting dynamic patterns..." -ForegroundColor Yellow
echo if (Get-Command rg -ErrorAction SilentlyContinue^) {
echo     "=== Dynamic Invocation Patterns ===" ^| Out-File $DynamicFile
echo     "" ^| Out-File $DynamicFile -Append
echo     "Searching for template literals..." ^| Out-File $DynamicFile -Append
echo     rg 'fetch_\$\{.*?\}' -n src/ 2^>^&1 ^| Out-File $DynamicFile -Append
echo     "" ^| Out-File $DynamicFile -Append
echo     "Searching for array joins..." ^| Out-File $DynamicFile -Append
echo     rg "\[.*fetch.*\]\.join\(" -n src/ 2^>^&1 ^| Out-File $DynamicFile -Append
echo     "" ^| Out-File $DynamicFile -Append
echo     "Searching for dynamic invokes..." ^| Out-File $DynamicFile -Append
echo     rg "invoke\(.*\$\{" -n src/ 2^>^&1 ^| Out-File $DynamicFile -Append
echo     Write-Host "Done: Dynamic pattern analysis complete" -ForegroundColor Green
echo } else {
echo     Write-Host "Warning: ripgrep not found" -ForegroundColor Yellow
echo }
echo Write-Host ""
echo.
echo Write-Host "Step 6: Generating JSON report..." -ForegroundColor Yellow
echo $wc = 0; $cc = 0; $tc = 0; $df = $false
echo if (Test-Path $WarningsFile^) { $wc = (Select-String -Path $WarningsFile -Pattern "warning:" -AllMatches^).Count }
echo if (Test-Path $ClippyFile^) { $cc = (Select-String -Path $ClippyFile -Pattern "warning:" -AllMatches^).Count }
echo if (Test-Path $CommandsFile^) { $tc = (Select-String -Path $CommandsFile -Pattern "#\[tauri::command\]" -AllMatches^).Count }
echo if (Test-Path $DynamicFile^) { $df = (Get-Content $DynamicFile -Raw^) -match "src/" }
echo.
echo $json = @{
echo     audit_metadata = @{ timestamp = (Get-Date^).ToUniversalTime(^).ToString("yyyy-MM-ddTHH:mm:ssZ"^); platform = "windows"; script_version = "1.0.0" }
echo     summary = @{ total_warnings = $wc; clippy_warnings = $cc; tauri_commands_found = $tc; dynamic_patterns_found = $df }
echo     files = @{ warnings = $WarningsFile; clippy = $ClippyFile; commands = $CommandsFile; builder = $BuilderFile; dynamic_patterns = $DynamicFile }
echo }
echo $json ^| ConvertTo-Json -Depth 10 ^| Out-File $JsonReport -Encoding UTF8
echo Write-Host "Done: JSON report saved" -ForegroundColor Green
echo Write-Host ""
echo.
echo Write-Host "Audit Complete!" -ForegroundColor Cyan
echo Write-Host "Check stabilization/ directory for results" -ForegroundColor Cyan
) > scripts\generate_audit_report.ps1

echo PowerShell script created successfully!
echo Run: powershell -ExecutionPolicy Bypass -File scripts\generate_audit_report.ps1
