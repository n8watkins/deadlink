-- MVP Features Migration
-- Adds support for password reset, API keys, webhooks, and more

-- Policy acceptances table for GDPR
CREATE TABLE IF NOT EXISTS policy_acceptances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    policy_type TEXT NOT NULL CHECK (policy_type IN ('privacy', 'terms', 'both')),
    version TEXT NOT NULL,
    accepted_at INTEGER NOT NULL,
    ip_address TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    key_prefix TEXT NOT NULL,
    scopes TEXT NOT NULL, -- JSON array
    last_used_at INTEGER,
    expires_at INTEGER,
    created_at INTEGER NOT NULL,
    revoked_at INTEGER,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT NOT NULL, -- JSON array
    is_active INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    last_triggered_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Webhook delivery logs
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webhook_id TEXT NOT NULL,
    event TEXT NOT NULL,
    url TEXT NOT NULL,
    status_code INTEGER,
    attempt INTEGER DEFAULT 1,
    delivered_at INTEGER NOT NULL,
    response_time INTEGER,
    success INTEGER DEFAULT 0,
    error_message TEXT
);

-- Usage notifications table
CREATE TABLE IF NOT EXISTS usage_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    warnings TEXT, -- JSON
    sent_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Add new columns to links table
ALTER TABLE links ADD COLUMN expires_at INTEGER;
ALTER TABLE links ADD COLUMN category TEXT;
ALTER TABLE links ADD COLUMN custom_slug INTEGER DEFAULT 0;

-- Add new columns to users table for enhanced features
ALTER TABLE users ADD COLUMN terms_accepted_at INTEGER;
ALTER TABLE users ADD COLUMN privacy_accepted_at INTEGER;
ALTER TABLE users ADD COLUMN notification_preferences TEXT DEFAULT '{"email": true, "webhook": true}';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_policy_acceptances_user ON policy_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_usage_notifications_user ON usage_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_links_expires ON links(expires_at);
CREATE INDEX IF NOT EXISTS idx_links_category ON links(category);

-- Create view for expired links
CREATE VIEW IF NOT EXISTS expired_links AS
SELECT * FROM links 
WHERE expires_at IS NOT NULL 
  AND expires_at < unixepoch()
  AND status = 'live';

-- Update plan limits for MVP
UPDATE plan_limits SET 
    api_requests_per_minute = 60,
    webhook_limit = 3,
    custom_domains = 0
WHERE plan = 'free';

UPDATE plan_limits SET 
    api_requests_per_minute = 300,
    webhook_limit = 10,
    custom_domains = 1
WHERE plan = 'pro';

UPDATE plan_limits SET 
    api_requests_per_minute = 1000,
    webhook_limit = 50,
    custom_domains = 10
WHERE plan = 'enterprise';

-- Add audit log entry
INSERT INTO security_audit_log (event_type, event_data, created_at) VALUES
('MIGRATION_003_APPLIED', 'MVP features migration applied', unixepoch());