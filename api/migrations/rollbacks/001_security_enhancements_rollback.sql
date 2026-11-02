-- Rollback for Security Enhancements Migration
-- WARNING: This will remove all security improvements!

-- Drop new tables
DROP TABLE IF EXISTS security_audit_log;
DROP TABLE IF EXISTS api_rate_limits;
DROP TABLE IF EXISTS email_verification_tokens;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS sessions;

-- Remove columns from users table
-- SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
CREATE TABLE users_backup AS 
SELECT id, email, api_key, plan, created_at, updated_at, last_login, status
FROM users;

DROP TABLE users;

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_login INTEGER,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted'))
);

INSERT INTO users SELECT * FROM users_backup;
DROP TABLE users_backup;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Log rollback
INSERT INTO security_audit_log (event_type, event_data, created_at) 
VALUES ('MIGRATION_001_ROLLED_BACK', 'Security enhancements migration rolled back', unixepoch())
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='security_audit_log');