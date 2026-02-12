# Gateway Production Test Script
# This script runs a quick production test of the gateway failover mechanism

Write-Host "=== Gateway Production Failover Test ===" -ForegroundColor Cyan
Write-Host ""

# Change to src-tauri directory
Set-Location -Path "$PSScriptRoot\..\src-tauri"

Write-Host "Running production gateway connectivity test..." -ForegroundColor Yellow
Write-Host "This will make real network calls to Odysee API gateways." -ForegroundColor Yellow
Write-Host ""

# Run the connectivity test with a reasonable timeout
$env:RUST_LOG = "info"
cargo test test_production_gateway_connectivity -- --ignored --nocapture --test-threads=1 2>&1 | Tee-Object -Variable testOutput

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Gateway connectivity test PASSED" -ForegroundColor Green
    Write-Host ""
    
    # Run the failover mechanism test
    Write-Host "Running failover mechanism test..." -ForegroundColor Yellow
    cargo test test_production_failover_mechanism -- --ignored --nocapture --test-threads=1 2>&1 | Tee-Object -Variable failoverOutput
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Failover mechanism test PASSED" -ForegroundColor Green
        Write-Host ""
        Write-Host "=== All Production Tests PASSED ===" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "✗ Failover mechanism test FAILED" -ForegroundColor Red
        Write-Host "Check the output above for details." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host ""
    Write-Host "✗ Gateway connectivity test FAILED" -ForegroundColor Red
    Write-Host "Check the output above for details." -ForegroundColor Red
    Write-Host ""
    Write-Host "Possible causes:" -ForegroundColor Yellow
    Write-Host "  - No internet connection" -ForegroundColor Yellow
    Write-Host "  - Odysee gateways are down" -ForegroundColor Yellow
    Write-Host "  - Firewall blocking connections" -ForegroundColor Yellow
    Write-Host "  - Rate limiting (HTTP 429)" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Gateway logs location:" -ForegroundColor Cyan
Write-Host "  Windows: %APPDATA%\kiyya-desktop\logs\gateway.log" -ForegroundColor Gray
Write-Host "  macOS: ~/Library/Application Support/kiyya-desktop/logs/gateway.log" -ForegroundColor Gray
Write-Host "  Linux: ~/.local/share/kiyya-desktop/logs/gateway.log" -ForegroundColor Gray
Write-Host ""
