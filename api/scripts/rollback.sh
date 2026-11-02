#!/bin/bash

# Database Rollback Script for Dead Link Switchboard
# Rolls back migrations from D1 database

set -e

# Configuration
DB_NAME="dead-link-db"
MIGRATIONS_DIR="./migrations"
ROLLBACKS_DIR="./migrations/rollbacks"
MIGRATIONS_TABLE="schema_migrations"

# Environment check
if [ -z "$1" ]; then
    echo "Usage: $0 <environment> [steps]"
    echo "Example: $0 development       # Roll back last migration"
    echo "Example: $0 production 3      # Roll back last 3 migrations"
    exit 1
fi

ENVIRONMENT=$1
STEPS=${2:-1}

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

echo "Starting rollback process for $ENVIRONMENT environment..."
echo "Rolling back $STEPS migration(s)..."

# Ensure rollbacks directory exists
mkdir -p "$ROLLBACKS_DIR"

# Get last N applied migrations
MIGRATIONS_TO_ROLLBACK=$(execute_sql "SELECT filename FROM $MIGRATIONS_TABLE ORDER BY id DESC LIMIT $STEPS;" | tail -n +2)

if [ -z "$MIGRATIONS_TO_ROLLBACK" ]; then
    echo "No migrations to roll back"
    exit 0
fi

# Confirm rollback
echo "The following migrations will be rolled back:"
echo "$MIGRATIONS_TO_ROLLBACK"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Rollback cancelled"
    exit 0
fi

# Create backup before rollback
echo "Creating backup before rollback..."
./scripts/db-backup.sh "$ENVIRONMENT"

# Roll back each migration
ROLLED_BACK=0
while IFS= read -r migration_filename; do
    if [ -z "$migration_filename" ]; then
        continue
    fi
    
    echo "Rolling back: $migration_filename"
    
    # Look for rollback file
    ROLLBACK_FILE="$ROLLBACKS_DIR/${migration_filename%.sql}_rollback.sql"
    
    if [ -f "$ROLLBACK_FILE" ]; then
        # Execute rollback file
        echo "Executing rollback script: $ROLLBACK_FILE"
        
        # Start transaction
        echo "BEGIN TRANSACTION;" > /tmp/rollback_transaction.sql
        cat "$ROLLBACK_FILE" >> /tmp/rollback_transaction.sql
        echo "DELETE FROM $MIGRATIONS_TABLE WHERE filename = '$migration_filename';" >> /tmp/rollback_transaction.sql
        echo "COMMIT;" >> /tmp/rollback_transaction.sql
        
        if execute_file "/tmp/rollback_transaction.sql"; then
            echo "✓ Rolled back $migration_filename successfully"
            ((ROLLED_BACK++))
        else
            echo "✗ Rollback failed for $migration_filename"
            echo "Database may be in an inconsistent state. Please restore from backup."
            exit 1
        fi
    else
        echo "Warning: No rollback script found for $migration_filename"
        echo "Manual intervention may be required"
        
        # Just remove from migrations table
        execute_sql "DELETE FROM $MIGRATIONS_TABLE WHERE filename = '$migration_filename';"
        echo "✓ Removed $migration_filename from migrations table"
        ((ROLLED_BACK++))
    fi
done <<< "$MIGRATIONS_TO_ROLLBACK"

echo ""
echo "Rolled back $ROLLED_BACK migration(s) successfully"

# Verify database integrity
echo "Verifying database integrity..."
execute_sql "PRAGMA integrity_check;"

# Show current migration status
echo ""
echo "Current migration status:"
execute_sql "SELECT filename, datetime(applied_at, 'unixepoch') as applied_at FROM $MIGRATIONS_TABLE ORDER BY id DESC LIMIT 10;"

echo "Rollback process completed!"