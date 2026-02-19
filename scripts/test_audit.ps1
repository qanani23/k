# Test audit script - simplified version
Write-Host "Testing audit script..." -ForegroundColor Cyan
$AuditDir = "stabilization"
if (-not (Test-Path $AuditDir)) { 
    New-Item -ItemType Directory -Path $AuditDir | Out-Null 
    Write-Host "Created $AuditDir directory" -ForegroundColor Green
}

Write-Host "Checking for ripgrep..." -ForegroundColor Yellow
if (Get-Command rg -ErrorAction SilentlyContinue) {
    Write-Host "ripgrep found!" -ForegroundColor Green
} else {
    Write-Host "ripgrep NOT found - install from: https://github.com/BurntSushi/ripgrep" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Test complete!" -ForegroundColor Cyan
