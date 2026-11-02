-- Dead Link Switchboard Database Schema
-- Phase 2: Links API with Authentication
-- Phase 3: Health Check System
-- Phase 4: Analytics & Bot Filtering

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_login INTEGER,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted'))
);

-- Links metadata table
CREATE TABLE IF NOT EXISTS links (
    slug TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    clicks INTEGER DEFAULT 0,
    last_clicked INTEGER,
    status TEXT DEFAULT 'live' CHECK (status IN ('live', 'paused', 'disabled', 'fallback_1', 'fallback_2', 'fallback_3', 'dead')),
    last_health_check INTEGER,
    health_check_failures INTEGER DEFAULT 0,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Click analytics table
CREATE TABLE IF NOT EXISTS clicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    clicked_at INTEGER NOT NULL,
    ip_hash TEXT,
    country TEXT,
    user_agent TEXT,
    referrer TEXT,
    success BOOLEAN DEFAULT TRUE,
    redirect_url TEXT,
    FOREIGN KEY (slug) REFERENCES links(slug)
);

-- User plan limits table
CREATE TABLE IF NOT EXISTS plan_limits (
    plan TEXT PRIMARY KEY,
    links_limit INTEGER NOT NULL,
    clicks_per_month INTEGER NOT NULL,
    api_requests_per_minute INTEGER NOT NULL,
    analytics_retention_days INTEGER NOT NULL,
    fallback_urls_limit INTEGER NOT NULL
);

-- Health check run history (Phase 3)
CREATE TABLE IF NOT EXISTS health_check_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_at INTEGER NOT NULL,
    links_checked INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL
);

-- Link status change history (Phase 3)
CREATE TABLE IF NOT EXISTS link_status_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_at INTEGER NOT NULL,
    reason TEXT,
    FOREIGN KEY (slug) REFERENCES links(slug)
);

-- Insert default plan limits
INSERT OR REPLACE INTO plan_limits (plan, links_limit, clicks_per_month, api_requests_per_minute, analytics_retention_days, fallback_urls_limit) VALUES
('free', 100, 10000, 60, 30, 3),
('pro', 5000, 100000, 300, 365, 10),
('enterprise', -1, -1, 1000, -1, 50);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_links_owner ON links(owner_id);
CREATE INDEX IF NOT EXISTS idx_links_status ON links(status);
CREATE INDEX IF NOT EXISTS idx_links_updated ON links(updated_at);
CREATE INDEX IF NOT EXISTS idx_clicks_slug ON clicks(slug);
CREATE INDEX IF NOT EXISTS idx_clicks_date ON clicks(clicked_at);
CREATE INDEX IF NOT EXISTS idx_clicks_success ON clicks(success);
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Health check indexes (Phase 3)
CREATE INDEX IF NOT EXISTS idx_health_runs_date ON health_check_runs(run_at);
CREATE INDEX IF NOT EXISTS idx_status_changes_slug ON link_status_changes(slug);
CREATE INDEX IF NOT EXISTS idx_status_changes_date ON link_status_changes(changed_at);
CREATE INDEX IF NOT EXISTS idx_links_health_check ON links(last_health_check);

-- Phase 4: Analytics & Bot Filtering Tables

-- Click events table for detailed analytics
CREATE TABLE IF NOT EXISTS click_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    is_bot INTEGER NOT NULL DEFAULT 0,
    bot_score INTEGER DEFAULT 0,
    country TEXT,
    city TEXT,
    referer_domain TEXT,
    user_agent_hash TEXT,
    ip_hash TEXT,
    cf_bot_score INTEGER,
    asn INTEGER,
    timezone TEXT,
    FOREIGN KEY (slug) REFERENCES links(slug)
);

-- Daily click summary for fast queries
CREATE TABLE IF NOT EXISTS click_summary_daily (
    date TEXT NOT NULL,
    slug TEXT NOT NULL,
    human_clicks INTEGER DEFAULT 0,
    bot_clicks INTEGER DEFAULT 0,
    unique_countries INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    top_referer TEXT,
    PRIMARY KEY (date, slug),
    FOREIGN KEY (slug) REFERENCES links(slug)
);

-- Global statistics for system overview
CREATE TABLE IF NOT EXISTS global_stats (
    stat_name TEXT PRIMARY KEY,
    stat_value INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Bot detection patterns and scores for tuning
CREATE TABLE IF NOT EXISTS bot_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern TEXT NOT NULL UNIQUE,
    pattern_type TEXT NOT NULL, -- 'user_agent', 'ip_range', 'behavior'
    score INTEGER NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    last_match INTEGER
);

-- Add analytics columns to existing links table
ALTER TABLE links ADD COLUMN total_clicks INTEGER DEFAULT 0;
ALTER TABLE links ADD COLUMN human_clicks INTEGER DEFAULT 0;
ALTER TABLE links ADD COLUMN bot_clicks INTEGER DEFAULT 0;
ALTER TABLE links ADD COLUMN last_click_at INTEGER;
ALTER TABLE links ADD COLUMN top_country TEXT;
ALTER TABLE links ADD COLUMN top_referer TEXT;

-- Analytics indexes for performance
CREATE INDEX IF NOT EXISTS idx_click_events_slug_time ON click_events(slug, timestamp);
CREATE INDEX IF NOT EXISTS idx_click_events_country ON click_events(country);
CREATE INDEX IF NOT EXISTS idx_click_events_bot ON click_events(is_bot);
CREATE INDEX IF NOT EXISTS idx_click_events_timestamp ON click_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_click_summary_date ON click_summary_daily(date);
CREATE INDEX IF NOT EXISTS idx_click_events_bot_score ON click_events(bot_score);
CREATE INDEX IF NOT EXISTS idx_click_events_ip_hash ON click_events(ip_hash);

-- Insert default bot patterns
INSERT OR IGNORE INTO bot_patterns (pattern, pattern_type, score, created_at) VALUES
-- Definite bots (100% score)
('googlebot', 'user_agent', 100, strftime('%s', 'now') * 1000),
('bingbot', 'user_agent', 100, strftime('%s', 'now') * 1000),
('yandexbot', 'user_agent', 100, strftime('%s', 'now') * 1000),
('baiduspider', 'user_agent', 100, strftime('%s', 'now') * 1000),
('facebookexternalhit', 'user_agent', 100, strftime('%s', 'now') * 1000),
('twitterbot', 'user_agent', 100, strftime('%s', 'now') * 1000),
('linkedinbot', 'user_agent', 100, strftime('%s', 'now') * 1000),
('whatsapp', 'user_agent', 100, strftime('%s', 'now') * 1000),
('telegram', 'user_agent', 100, strftime('%s', 'now') * 1000),
('slackbot', 'user_agent', 100, strftime('%s', 'now') * 1000),
('discordbot', 'user_agent', 100, strftime('%s', 'now') * 1000),

-- Crawlers (90% score)
('spider', 'user_agent', 90, strftime('%s', 'now') * 1000),
('crawler', 'user_agent', 90, strftime('%s', 'now') * 1000),
('scraper', 'user_agent', 90, strftime('%s', 'now') * 1000),
('bot', 'user_agent', 90, strftime('%s', 'now') * 1000),

-- Suspicious tools (75% score)
('curl', 'user_agent', 75, strftime('%s', 'now') * 1000),
('wget', 'user_agent', 75, strftime('%s', 'now') * 1000),
('python-requests', 'user_agent', 75, strftime('%s', 'now') * 1000),
('postman', 'user_agent', 75, strftime('%s', 'now') * 1000),
('insomnia', 'user_agent', 75, strftime('%s', 'now') * 1000),
('httpclient', 'user_agent', 75, strftime('%s', 'now') * 1000),
('okhttp', 'user_agent', 75, strftime('%s', 'now') * 1000),
('apache-httpclient', 'user_agent', 75, strftime('%s', 'now') * 1000);

-- Initialize global stats
INSERT OR IGNORE INTO global_stats (stat_name, stat_value, updated_at) VALUES
('total_clicks', 0, strftime('%s', 'now') * 1000),
('human_clicks', 0, strftime('%s', 'now') * 1000),
('bot_clicks', 0, strftime('%s', 'now') * 1000),
('unique_visitors_today', 0, strftime('%s', 'now') * 1000),
('bot_detection_accuracy', 95, strftime('%s', 'now') * 1000);