#!/bin/bash
# Database Backup Script for Unix/Linux/macOS
# Creates a timestamped backup of the Kiyya Desktop database with SHA256 checksum

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Determine default DB path based on OS
get_default_db_path() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        echo "$HOME/Library/Application Support/kiyya/app.db"
    else
        # Linux
        echo "$HOME/.kiyya/app.db"
    fi
}

# Get DB path from environment variable or use default
DB_PATH="${DB_PATH:-$(get_default_db_path)}"

# Expand tilde if present
DB_PATH="${DB_PATH/#\~/$HOME}"

# Create backup directory
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Define backup file paths
BACKUP_FILE="${BACKUP_DIR}/${TIMESTAMP}-db.sqlite"
METADATA_FILE="${BACKUP_DIR}/${TIMESTAMP}-db.metadata.json"

# PII Warning
echo -e "${YELLOW}⚠️  WARNING: Database backups may contain Personally Identifiable Information (PII)${NC}"
echo -e "${YELLOW}   Handle backups securely and do not share them publicly.${NC}"
echo ""

# Check if source database exists
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}✗ Error: Database file not found at: $DB_PATH${NC}"
    echo "  Set DB_PATH environment variable to specify a different location."
    echo ""
    echo "Default paths:"
    echo "  - macOS: ~/Library/Application Support/kiyya/app.db"
    echo "  - Linux: ~/.kiyya/app.db"
    exit 1
fi

# Copy database file
echo "Backing up database..."
echo "  Source: $DB_PATH"
echo "  Destination: $BACKUP_FILE"
cp "$DB_PATH" "$BACKUP_FILE"

# Calculate SHA256 checksum
echo "Calculating checksum..."
if command -v sha256sum &> /dev/null; then
    CHECKSUM=$(sha256sum "$BACKUP_FILE" | awk '{print $1}')
elif command -v shasum &> /dev/null; then
    CHECKSUM=$(shasum -a 256 "$BACKUP_FILE" | awk '{print $1}')
else
    echo -e "${RED}✗ Error: Neither sha256sum nor shasum found. Cannot calculate checksum.${NC}"
    exit 1
fi

# Get file size
FILE_SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE" 2>/dev/null)

# Create metadata file
cat > "$METADATA_FILE" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "source_path": "$DB_PATH",
  "backup_path": "$BACKUP_FILE",
  "checksum_algorithm": "SHA256",
  "checksum": "$CHECKSUM",
  "file_size_bytes": $FILE_SIZE,
  "platform": "$OSTYPE",
  "hostname": "$(hostname)",
  "pii_warning": "This backup may contain Personally Identifiable Information. Handle securely."
}
EOF

# Success message
echo -e "${GREEN}✓ Backup created successfully!${NC}"
echo ""
echo "Backup details:"
echo "  File: $BACKUP_FILE"
echo "  Metadata: $METADATA_FILE"
echo "  Size: $FILE_SIZE bytes"
echo "  SHA256: $CHECKSUM"
echo ""
echo "To restore this backup:"
echo "  cp $BACKUP_FILE $DB_PATH"
echo ""
echo "To verify backup integrity:"
if command -v sha256sum &> /dev/null; then
    echo "  echo \"$CHECKSUM  $BACKUP_FILE\" | sha256sum -c"
elif command -v shasum &> /dev/null; then
    echo "  echo \"$CHECKSUM  $BACKUP_FILE\" | shasum -a 256 -c"
fi
