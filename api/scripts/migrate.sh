#!/bin/bash

# Database Migration Script for Dead Link Switchboard
# Applies migrations to D1 database

set -e

# Configuration
DB_NAME="dead-link-db"
MIGRATIONS_DIR="./migrations"
MIGRATIONS_TABLE="schema_migrations"

# Environment check
if [ -z "$1" ]; then
    echo "Usage: $0 <environment> [specific_migration]"
    echo "Example: $0 development"
    echo "Example: $0 production 001_security_enhancements.sql"
    exit 1
fi

ENVIRONMENT=$1
SPECIFIC_MIGRATION=$2

# Function to execute SQL based on environment
execute_sql() {
    local sql=$1
    if [ "$ENVIRONMENT" = "production" ]; then
        wrangler d1 execute "$DB_NAME" --remote --command "$sql"
    else
        wrangler d1 execute "$DB_NAME" --local --command "$sql"
    fi
}

# Function to execute SQL file
execute_file() {
    local file=$1
    if [ "$ENVIRONMENT" = "production" ]; then
        wrangler d1 execute "$DB_NAME" --remote --file "$file"
    else
        wrangler d1 execute "$DB_NAME" --local --file "$file"
    fi
}

echo "Starting migration process for $ENVIRONMENT environment..."

# Create migrations table if it doesn't exist
echo "Ensuring migrations table exists..."
execute_sql "CREATE TABLE IF NOT EXISTS $MIGRATIONS_TABLE (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT UNIQUE NOT NULL,
    applied_at INTEGER NOT NULL,
    checksum TEXT NOT NULL
);"

# Get list of applied migrations
echo "Checking applied migrations..."
APPLIED_MIGRATIONS=$(execute_sql "SELECT filename FROM $MIGRATIONS_TABLE;" | tail -n +2 || echo "")

# Function to calculate file checksum
calculate_checksum() {
    sha256sum "$1" | cut -d' ' -f1
}

# Function to apply a single migration
apply_migration() {
    local migration_file=$1
    local filename=$(basename "$migration_file")
    local checksum=$(calculate_checksum "$migration_file")
    
    echo "Applying migration: $filename"
    
    # Start transaction
    echo "BEGIN TRANSACTION;" > /tmp/migration_transaction.sql
    cat "$migration_file" >> /tmp/migration_transaction.sql
    echo "INSERT INTO $MIGRATIONS_TABLE (filename, applied_at, checksum) VALUES ('$filename', unixepoch(), '$checksum');" >> /tmp/migration_transaction.sql
    echo "COMMIT;" >> /tmp/migration_transaction.sql
    
    # Execute migration
    if execute_file "/tmp/migration_transaction.sql"; then
        echo "✓ Migration $filename applied successfully"
        return 0
    else
        echo "✗ Migration $filename failed"
        return 1
    fi
}

# Apply migrations
if [ ! -z "$SPECIFIC_MIGRATION" ]; then
    # Apply specific migration
    MIGRATION_FILE="$MIGRATIONS_DIR/$SPECIFIC_MIGRATION"
    if [ ! -f "$MIGRATION_FILE" ]; then
        echo "Error: Migration file not found: $MIGRATION_FILE"
        exit 1
    fi
    
    # Check if already applied
    if echo "$APPLIED_MIGRATIONS" | grep -q "^$SPECIFIC_MIGRATION$"; then
        echo "Migration $SPECIFIC_MIGRATION has already been applied"
        exit 0
    fi
    
    apply_migration "$MIGRATION_FILE"
else
    # Apply all pending migrations
    PENDING_COUNT=0
    
    for migration_file in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
        filename=$(basename "$migration_file")
        
        # Check if already applied
        if echo "$APPLIED_MIGRATIONS" | grep -q "^$filename$"; then
            echo "✓ Migration $filename already applied"
            continue
        fi
        
        # Apply migration
        if apply_migration "$migration_file"; then
            ((PENDING_COUNT++))
        else
            echo "Migration failed. Stopping process."
            exit 1
        fi
    done
    
    if [ $PENDING_COUNT -eq 0 ]; then
        echo "No pending migrations found"
    else
        echo "Applied $PENDING_COUNT migration(s) successfully"
    fi
fi

# Verify database integrity
echo "Verifying database integrity..."
execute_sql "PRAGMA integrity_check;"

# Show current migration status
echo ""
echo "Current migration status:"
execute_sql "SELECT filename, datetime(applied_at, 'unixepoch') as applied_at FROM $MIGRATIONS_TABLE ORDER BY id DESC LIMIT 10;"

echo "Migration process completed!"