-- Phase 4: Analytics & Bot Filtering Database Schema
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

-- Performance indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_click_events_slug_time ON click_events(slug, timestamp);
CREATE INDEX IF NOT EXISTS idx_click_events_country ON click_events(country);
CREATE INDEX IF NOT EXISTS idx_click_events_bot ON click_events(is_bot);
CREATE INDEX IF NOT EXISTS idx_click_events_timestamp ON click_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_click_summary_date ON click_summary_daily(date);
CREATE INDEX IF NOT EXISTS idx_click_events_bot_score ON click_events(bot_score);
CREATE INDEX IF NOT EXISTS idx_click_events_ip_hash ON click_events(ip_hash);

-- Add analytics columns to existing links table
ALTER TABLE links ADD COLUMN total_clicks INTEGER DEFAULT 0;
ALTER TABLE links ADD COLUMN human_clicks INTEGER DEFAULT 0;
ALTER TABLE links ADD COLUMN bot_clicks INTEGER DEFAULT 0;
ALTER TABLE links ADD COLUMN last_click_at INTEGER;
ALTER TABLE links ADD COLUMN top_country TEXT;
ALTER TABLE links ADD COLUMN top_referer TEXT;

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