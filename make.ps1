# PowerShell equivalent of Makefile for Windows
# Usage: .\make.ps1 <target>

param(
    [Parameter(Position=0)]
    [string]$Target = "help"
)

function Show-Help {
    Write-Host "Kiyya Desktop - Stabilization Build Script" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Available targets:"
    Write-Host "  build-backend       - Build Rust backend (cargo build)"
    Write-Host "  build-frontend      - Build frontend (npm run build)"
    Write-Host "  build               - Build both backend and frontend"
    Write-Host "  test                - Run all tests (backend + frontend lint)"
    Write-Host "  clean               - Clean build artifacts"
    Write-Host "  audit               - Generate audit report"
    Write-Host "  snapshot            - Create database backup"
    Write-Host "  test-backup-restore - Test backup creation and restoration"
    Write-Host "  format              - Format code (Rust + JS/TS)"
    Write-Host "  check-format        - Check code formatting without changes"
    Write-Host "  coverage            - Measure test coverage"
    Write-Host "  security-audit      - Run security audit (cargo audit)"
    Write-Host "  ipc-smoke           - Run IPC smoke test"
    Write-Host "  validate-workflow   - Validate GitHub Actions workflow"
    Write-Host ""
}

function Build-Backend {
    Write-Host "Building Rust backend..." -ForegroundColor Yellow
    Push-Location src-tauri
    cargo build
    $exitCode = $LASTEXITCODE
    Pop-Location
    if ($exitCode -ne 0) { exit $exitCode }
}

function Build-Frontend {
    Write-Host "Building frontend..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

function Build-All {
    Build-Backend
    Build-Frontend
    Write-Host "Build complete!" -ForegroundColor Green
}

function Run-Tests {
    Write-Host "Running backend tests..." -ForegroundColor Yellow
    Push-Location src-tauri
    cargo test
    $exitCode = $LASTEXITCODE
    Pop-Location
    if ($exitCode -ne 0) { exit $exitCode }
    
    Write-Host "Running frontend lint..." -ForegroundColor Yellow
    npm run lint
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    
    Write-Host "All tests passed!" -ForegroundColor Green
}

function Clean-All {
    Write-Host "Cleaning build artifacts..." -ForegroundColor Yellow
    Push-Location src-tauri
    cargo clean
    Pop-Location
    
    Write-Host "Cleaning node_modules and dist..." -ForegroundColor Yellow
    if (Test-Path "node_modules") { Remove-Item -Recurse -Force node_modules }
    if (Test-Path "dist") { Remove-Item -Recurse -Force dist }
    
    Write-Host "Clean complete!" -ForegroundColor Green
}

function Run-Audit {
    Write-Host "Generating audit report..." -ForegroundColor Yellow
    if (Test-Path "scripts\generate_audit_report.ps1") {
        & "scripts\generate_audit_report.ps1"
    } else {
        Write-Host "Audit script not found!" -ForegroundColor Red
        exit 1
    }
    Write-Host "Audit report generated!" -ForegroundColor Green
}

function Create-Snapshot {
    Write-Host "Creating database backup..." -ForegroundColor Yellow
    if (Test-Path "scripts\db_snapshot.ps1") {
        & "scripts\db_snapshot.ps1"
    } else {
        Write-Host "Snapshot script not found!" -ForegroundColor Red
        exit 1
    }
    Write-Host "Database backup created!" -ForegroundColor Green
}

function Format-Code {
    Write-Host "Formatting Rust code..." -ForegroundColor Yellow
    Push-Location src-tauri
    cargo fmt
    Pop-Location
    
    Write-Host "Formatting frontend code..." -ForegroundColor Yellow
    $formatCmd = npm run format 2>&1
    if ($LASTEXITCODE -ne 0) {
        npx prettier --write "src/**/*.{js,jsx,ts,tsx,json,css,md}"
    }
    
    Write-Host "Code formatting complete!" -ForegroundColor Green
}

function Check-Format {
    Write-Host "Checking Rust code formatting..." -ForegroundColor Yellow
    Push-Location src-tauri
    cargo fmt -- --check
    $exitCode = $LASTEXITCODE
    Pop-Location
    if ($exitCode -ne 0) { exit $exitCode }
    
    Write-Host "Checking frontend code formatting..." -ForegroundColor Yellow
    $formatCmd = npm run format:check 2>&1
    if ($LASTEXITCODE -ne 0) {
        npx prettier --check "src/**/*.{js,jsx,ts,tsx,json,css,md}"
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    
    Write-Host "Format check complete!" -ForegroundColor Green
}

function Measure-Coverage {
    Write-Host "Measuring test coverage..." -ForegroundColor Yellow
    Write-Host "Checking for cargo-tarpaulin..." -ForegroundColor Yellow
    
    $tarpaulinCheck = cargo tarpaulin --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Installing cargo-tarpaulin..." -ForegroundColor Yellow
        cargo install cargo-tarpaulin
    }
    
    Write-Host "Running coverage measurement..." -ForegroundColor Yellow
    Push-Location src-tauri
    cargo tarpaulin --out Xml --out Html --output-dir ../stabilization
    $exitCode = $LASTEXITCODE
    Pop-Location
    
    if ($exitCode -eq 0) {
        Write-Host "Coverage report generated in stabilization/tarpaulin-report.html" -ForegroundColor Green
    } else {
        exit $exitCode
    }
}

function Run-SecurityAudit {
    Write-Host "Running security audit..." -ForegroundColor Yellow
    Push-Location src-tauri
    cargo audit
    $exitCode = $LASTEXITCODE
    Pop-Location
    if ($exitCode -ne 0) { exit $exitCode }
    Write-Host "Security audit complete!" -ForegroundColor Green
}

function Run-IpcSmoke {
    Write-Host "Running IPC smoke test..." -ForegroundColor Yellow
    if (Test-Path "scripts\ipc_smoke_test.js") {
        node scripts/ipc_smoke_test.js
    } elseif (Test-Path "scripts\ipc_smoke_test.ps1") {
        & "scripts\ipc_smoke_test.ps1"
    } else {
        Write-Host "IPC smoke test script not found!" -ForegroundColor Red
        exit 1
    }
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "IPC smoke test complete!" -ForegroundColor Green
}

function Validate-Workflow {
    Write-Host "Validating GitHub Actions workflow..." -ForegroundColor Yellow
    if (Test-Path "scripts\validate-workflow.js") {
        node scripts/validate-workflow.js
    } else {
        Write-Host "Workflow validation script not found!" -ForegroundColor Red
        exit 1
    }
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "Workflow validation complete!" -ForegroundColor Green
}

function Test-BackupRestore {
    Write-Host "Testing backup creation and restoration..." -ForegroundColor Yellow
    if (Test-Path "scripts\test_backup_restore.js") {
        node scripts/test_backup_restore.js
    } else {
        Write-Host "Backup restore test script not found!" -ForegroundColor Red
        exit 1
    }
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "Backup restoration test complete!" -ForegroundColor Green
}

# Main switch
switch ($Target.ToLower()) {
    "help" { Show-Help }
    "build-backend" { Build-Backend }
    "build-frontend" { Build-Frontend }
    "build" { Build-All }
    "test" { Run-Tests }
    "clean" { Clean-All }
    "audit" { Run-Audit }
    "snapshot" { Create-Snapshot }
    "test-backup-restore" { Test-BackupRestore }
    "format" { Format-Code }
    "check-format" { Check-Format }
    "coverage" { Measure-Coverage }
    "security-audit" { Run-SecurityAudit }
    "ipc-smoke" { Run-IpcSmoke }
    "validate-workflow" { Validate-Workflow }
    default {
        Write-Host "Unknown target: $Target" -ForegroundColor Red
        Write-Host ""
        Show-Help
        exit 1
    }
}
