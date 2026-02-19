# Database Backup Scripts

This directory contains cross-platform database backup scripts for the Kiyya Desktop application.

## ⚠️ IMPORTANT: PII WARNING

**Database backups may contain Personally Identifiable Information (PII).**

- Handle backups securely
- Do not share backups publicly
- Store backups in secure locations
- Delete old backups when no longer needed
- Ensure backups are encrypted if stored remotely

## Scripts

### Unix/Linux/macOS: `db_snapshot.sh`

Bash script for Unix-based systems.

**Usage:**
```bash
# Use default database path
./scripts/db_snapshot.sh

# Specify custom database path
DB_PATH=/path/to/custom/app.db ./scripts/db_snapshot.sh
```

**Default Database Paths:**
- **macOS**: `~/Library/Application Support/kiyya/app.db`
- **Linux**: `~/.kiyya/app.db`

### Windows: `db_snapshot.ps1`

PowerShell script for Windows systems.

**Usage:**
```powershell
# Use default database path
.\scripts\db_snapshot.ps1

# Specify custom database path
$env:DB_PATH = "C:\path\to\custom\app.db"
.\scripts\db_snapshot.ps1
```

**Default Database Path:**
- **Windows**: `%APPDATA%\.kiyya\app.db`

## Backup Output

Both scripts create two files in the `backups/` directory:

1. **`<timestamp>-db.sqlite`** - The database backup file
2. **`<timestamp>-db.metadata.json`** - Metadata file containing:
   - Timestamp (ISO 8601 format)
   - Source database path
   - Backup file path
   - SHA256 checksum
   - File size in bytes
   - Platform information
   - Hostname
   - PII warning

## Restoring a Backup

### Unix/Linux/macOS
```bash
cp backups/<timestamp>-db.sqlite ~/.kiyya/app.db
```

### Windows
```powershell
Copy-Item -Path "backups\<timestamp>-db.sqlite" -Destination "$env:APPDATA\.kiyya\app.db" -Force
```

## Verifying Backup Integrity

### Unix/Linux/macOS
```bash
# Using sha256sum (Linux)
sha256sum backups/<timestamp>-db.sqlite

# Using shasum (macOS)
shasum -a 256 backups/<timestamp>-db.sqlite

# Compare with checksum in metadata file
```

### Windows
```powershell
Get-FileHash -Path "backups\<timestamp>-db.sqlite" -Algorithm SHA256

# Compare with checksum in metadata file
```

## Environment Variables

Both scripts support the `DB_PATH` environment variable to override the default database location:

- **Unix/Linux/macOS**: `DB_PATH=/custom/path/app.db ./scripts/db_snapshot.sh`
- **Windows**: `$env:DB_PATH = "C:\custom\path\app.db"; .\scripts\db_snapshot.ps1`

## Requirements

### Unix/Linux/macOS
- Bash shell
- `sha256sum` (Linux) or `shasum` (macOS)
- `date` command
- `stat` command

### Windows
- PowerShell 5.0 or later
- `Get-FileHash` cmdlet (built-in)

## Troubleshooting

### "Database file not found" error
- Verify the database path is correct
- Check if the application has been run at least once (to create the database)
- Use the `DB_PATH` environment variable to specify a custom location

### Permission errors
- Ensure you have read access to the source database
- Ensure you have write access to the `backups/` directory
- On Unix/Linux/macOS, ensure the script is executable: `chmod +x scripts/db_snapshot.sh`

### Checksum verification fails
- The backup file may be corrupted
- Do not use this backup for restoration
- Create a new backup from the source database
