# Install actionlint on Windows
# This script downloads and installs actionlint for GitHub Actions workflow validation

$ErrorActionPreference = "Stop"

Write-Host "Installing actionlint..." -ForegroundColor Cyan

# Check if running on Windows
if ($IsWindows -or $env:OS -match "Windows") {
    Write-Host "Detected Windows OS" -ForegroundColor Green
    
    # Create temp directory
    $tempDir = Join-Path $env:TEMP "actionlint-install"
    New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
    
    # Download latest release
    $version = "1.6.27"  # Latest stable version
    $downloadUrl = "https://github.com/rhysd/actionlint/releases/download/v$version/actionlint_$($version)_windows_amd64.zip"
    $zipFile = Join-Path $tempDir "actionlint.zip"
    
    Write-Host "Downloading actionlint v$version..." -ForegroundColor Yellow
    try {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $zipFile -UseBasicParsing
        Write-Host "Download complete!" -ForegroundColor Green
    } catch {
        Write-Host "Failed to download actionlint: $_" -ForegroundColor Red
        exit 1
    }
    
    # Extract
    Write-Host "Extracting..." -ForegroundColor Yellow
    Expand-Archive -Path $zipFile -DestinationPath $tempDir -Force
    
    # Install to user's local bin
    $installDir = "$env:USERPROFILE\.local\bin"
    New-Item -ItemType Directory -Force -Path $installDir | Out-Null
    
    $exePath = Join-Path $tempDir "actionlint.exe"
    $targetPath = Join-Path $installDir "actionlint.exe"
    
    Copy-Item -Path $exePath -Destination $targetPath -Force
    Write-Host "Installed to: $targetPath" -ForegroundColor Green
    
    # Check if directory is in PATH
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($currentPath -notlike "*$installDir*") {
        Write-Host "`nAdding $installDir to PATH..." -ForegroundColor Yellow
        [Environment]::SetEnvironmentVariable(
            "Path",
            "$currentPath;$installDir",
            "User"
        )
        Write-Host "PATH updated! Please restart your terminal." -ForegroundColor Green
    }
    
    # Cleanup
    Remove-Item -Path $tempDir -Recurse -Force
    
    Write-Host "`n✅ actionlint installed successfully!" -ForegroundColor Green
    Write-Host "`nTo use actionlint, either:" -ForegroundColor Cyan
    Write-Host "  1. Restart your terminal (to load updated PATH)" -ForegroundColor White
    Write-Host "  2. Or run: $targetPath .github/workflows/stabilization.yml" -ForegroundColor White
    
} else {
    Write-Host "This script is for Windows only." -ForegroundColor Red
    Write-Host "On Linux/macOS, install with:" -ForegroundColor Yellow
    Write-Host "  brew install actionlint  # macOS" -ForegroundColor White
    Write-Host "  go install github.com/rhysd/actionlint/cmd/actionlint@latest  # Linux" -ForegroundColor White
    exit 1
}
