#!/bin/bash

# Database Backup Script for Dead Link Switchboard
# Backs up D1 database to local SQL file

set -e

# Configuration
DB_NAME="dead-link-db"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"

# Environment check
if [ -z "$1" ]; then
    echo "Usage: $0 <environment>"
    echo "Example: $0 development"
    echo "Example: $0 production"
    exit 1
fi

ENVIRONMENT=$1

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting backup for $ENVIRONMENT environment..."

# Export database schema and data
echo "-- Dead Link Switchboard Database Backup" > "$BACKUP_FILE"
echo "-- Environment: $ENVIRONMENT" >> "$BACKUP_FILE"
echo "-- Timestamp: $(date)" >> "$BACKUP_FILE"
echo "-- Version: $(git describe --tags --always 2>/dev/null || echo 'unknown')" >> "$BACKUP_FILE"
echo "" >> "$BACKUP_FILE"

# Use wrangler to export D1 database
if [ "$ENVIRONMENT" = "production" ]; then
    wrangler d1 export "$DB_NAME" --remote >> "$BACKUP_FILE"
else
    wrangler d1 export "$DB_NAME" --local >> "$BACKUP_FILE"
fi

# Compress backup
gzip "$BACKUP_FILE"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

# Calculate checksum
CHECKSUM=$(sha256sum "$COMPRESSED_FILE" | cut -d' ' -f1)
echo "$CHECKSUM" > "${COMPRESSED_FILE}.sha256"

echo "Backup completed successfully!"
echo "File: $COMPRESSED_FILE"
echo "Size: $(du -h "$COMPRESSED_FILE" | cut -f1)"
echo "SHA256: $CHECKSUM"

# Cleanup old backups (keep last 30 days)
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +30 -delete
find "$BACKUP_DIR" -name "backup_*.sql.gz.sha256" -mtime +30 -delete

# Optional: Upload to cloud storage
if [ ! -z "$BACKUP_BUCKET" ]; then
    echo "Uploading to cloud storage..."
    # Example for S3
    # aws s3 cp "$COMPRESSED_FILE" "s3://$BACKUP_BUCKET/db-backups/"
    # aws s3 cp "${COMPRESSED_FILE}.sha256" "s3://$BACKUP_BUCKET/db-backups/"
    
    # Example for Cloudflare R2
    # wrangler r2 object put "$BACKUP_BUCKET/db-backups/$(basename "$COMPRESSED_FILE")" --file "$COMPRESSED_FILE"
    echo "Cloud upload not configured"
fi

echo "Backup process completed!"