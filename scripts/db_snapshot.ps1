# Database Backup Script for Windows PowerShell
# Creates a timestamped backup of the Kiyya Desktop database with SHA256 checksum

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-DefaultDbPath {
    $appData = [Environment]::GetFolderPath('ApplicationData')
    return Join-Path $appData ".kiyya\app.db"
}

$dbPath = if ($env:DB_PATH) { $env:DB_PATH } else { Get-DefaultDbPath }
$dbPath = [Environment]::ExpandEnvironmentVariables($dbPath)

$backupDir = ".\backups"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $backupDir "${timestamp}-db.sqlite"
$metadataFile = Join-Path $backupDir "${timestamp}-db.metadata.json"

Write-Host ""
Write-Host "WARNING: Database backups may contain Personally Identifiable Information (PII)" -ForegroundColor Yellow
Write-Host "Handle backups securely and do not share them publicly." -ForegroundColor Yellow
Write-Host ""

if (-not (Test-Path $dbPath)) {
    Write-Host "Error: Database file not found at: $dbPath" -ForegroundColor Red
    Write-Host "Set DB_PATH environment variable to specify a different location."
    Write-Host ""
    Write-Host "Default path:"
    Write-Host "  - Windows: %APPDATA%\.kiyya\app.db"
    exit 1
}

Write-Host "Backing up database..."
Write-Host "  Source: $dbPath"
Write-Host "  Destination: $backupFile"
Copy-Item -Path $dbPath -Destination $backupFile -Force

Write-Host "Calculating checksum..."
$hash = Get-FileHash -Path $backupFile -Algorithm SHA256
$checksum = $hash.Hash.ToLower()

$fileInfo = Get-Item $backupFile
$fileSize = $fileInfo.Length
$isoTimestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

$metadata = @{
    timestamp = $isoTimestamp
    source_path = $dbPath
    backup_path = $backupFile
    checksum_algorithm = "SHA256"
    checksum = $checksum
    file_size_bytes = $fileSize
    platform = "Windows"
    hostname = $env:COMPUTERNAME
    pii_warning = "This backup may contain Personally Identifiable Information. Handle securely."
}

$metadata | ConvertTo-Json -Depth 10 | Set-Content -Path $metadataFile -Encoding UTF8

Write-Host ""
Write-Host "Backup created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Backup details:"
Write-Host "  File: $backupFile"
Write-Host "  Metadata: $metadataFile"
Write-Host "  Size: $fileSize bytes"
Write-Host "  SHA256: $checksum"
Write-Host ""
Write-Host "To restore this backup:"
Write-Host "  Copy-Item -Path '$backupFile' -Destination '$dbPath' -Force"
Write-Host ""
Write-Host "To verify backup integrity:"
Write-Host "  Get-FileHash -Path '$backupFile' -Algorithm SHA256"
Write-Host "  Expected checksum: $checksum"
Write-Host ""
