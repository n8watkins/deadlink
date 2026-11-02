#!/bin/bash

# Database Restore Script for Dead Link Switchboard
# Restores D1 database from backup file

set -e

# Configuration
DB_NAME="dead-link-db"
BACKUP_DIR="./backups"

# Environment check
if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <environment> <backup_file>"
    echo "Example: $0 development backups/backup_20240101_120000.sql.gz"
    echo "Example: $0 production latest"
    exit 1
fi

ENVIRONMENT=$1
BACKUP_FILE=$2

# Handle 'latest' option
if [ "$BACKUP_FILE" = "latest" ]; then
    BACKUP_FILE=$(ls -t "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | head -1)
    if [ -z "$BACKUP_FILE" ]; then
        echo "Error: No backup files found in $BACKUP_DIR"
        exit 1
    fi
    echo "Using latest backup: $BACKUP_FILE"
fi

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Verify checksum if available
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ -f "$CHECKSUM_FILE" ]; then
    echo "Verifying backup integrity..."
    EXPECTED_CHECKSUM=$(cat "$CHECKSUM_FILE")
    ACTUAL_CHECKSUM=$(sha256sum "$BACKUP_FILE" | cut -d' ' -f1)
    
    if [ "$EXPECTED_CHECKSUM" != "$ACTUAL_CHECKSUM" ]; then
        echo "Error: Checksum mismatch! Backup file may be corrupted."
        echo "Expected: $EXPECTED_CHECKSUM"
        echo "Actual: $ACTUAL_CHECKSUM"
        exit 1
    fi
    echo "Checksum verified successfully"
fi

# Create temporary directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Decompress backup
echo "Decompressing backup..."
gunzip -c "$BACKUP_FILE" > "$TEMP_DIR/restore.sql"

# Confirm restore
echo "WARNING: This will replace all data in the $ENVIRONMENT database!"
echo "Backup file: $BACKUP_FILE"
echo "Target environment: $ENVIRONMENT"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

# Create backup of current database before restore
echo "Creating backup of current database..."
./scripts/db-backup.sh "$ENVIRONMENT"

# Drop existing tables (be careful!)
echo "Preparing database for restore..."
if [ "$ENVIRONMENT" = "production" ]; then
    # For production, use remote database
    wrangler d1 execute "$DB_NAME" --remote --command "SELECT name FROM sqlite_master WHERE type='table';" | \
    while read table; do
        if [[ $table =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
            echo "Dropping table: $table"
            wrangler d1 execute "$DB_NAME" --remote --command "DROP TABLE IF EXISTS $table;"
        fi
    done
else
    # For development, use local database
    wrangler d1 execute "$DB_NAME" --local --command "SELECT name FROM sqlite_master WHERE type='table';" | \
    while read table; do
        if [[ $table =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
            echo "Dropping table: $table"
            wrangler d1 execute "$DB_NAME" --local --command "DROP TABLE IF EXISTS $table;"
        fi
    done
fi

# Restore database
echo "Restoring database..."
if [ "$ENVIRONMENT" = "production" ]; then
    wrangler d1 execute "$DB_NAME" --remote --file "$TEMP_DIR/restore.sql"
else
    wrangler d1 execute "$DB_NAME" --local --file "$TEMP_DIR/restore.sql"
fi

echo "Database restored successfully!"

# Run any post-restore migrations
if [ -d "./migrations" ]; then
    echo "Checking for post-restore migrations..."
    # Add migration logic here if needed
fi

echo "Restore process completed!"