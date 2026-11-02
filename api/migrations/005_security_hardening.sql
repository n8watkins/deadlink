-- Phase 8: Security Hardening Database Schema
-- Fixes Phase 7 Critical Issues and adds production monitoring

-- Rate limiting table (fixes Phase 7 Critical Issue #3: Bypassable rate limiting)
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);

-- Security events logging for monitoring and compliance
CREATE TABLE IF NOT EXISTS security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  details TEXT, -- JSON
  ip_address TEXT,
  user_agent TEXT,
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_security_events_type_time ON security_events(event_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_ip_time ON security_events(ip_address, timestamp);

-- Performance optimization indexes (addresses Phase 7 Medium Priority Issue #7)
CREATE INDEX IF NOT EXISTS idx_click_events_compound ON click_events(slug, timestamp, is_bot);
CREATE INDEX IF NOT EXISTS idx_links_owner_status ON links(owner_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_click_events_analytics ON click_events(timestamp, is_bot, country);
CREATE INDEX IF NOT EXISTS idx_click_events_country_time ON click_events(country, timestamp);
CREATE INDEX IF NOT EXISTS idx_click_events_user_agent ON click_events(user_agent_hash, timestamp);

-- Production monitoring tables
CREATE TABLE IF NOT EXISTS performance_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  dimensions TEXT, -- JSON
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_name_time ON performance_metrics(metric_name, timestamp);

-- System health tracking
CREATE TABLE IF NOT EXISTS system_health (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component TEXT NOT NULL,
  status TEXT NOT NULL, -- healthy, degraded, down
  details TEXT, -- JSON
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_system_health_component_time ON system_health(component, timestamp);

-- Error tracking and alerting
CREATE TABLE IF NOT EXISTS error_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  error_type TEXT NOT NULL,
  error_message TEXT,
  stack_trace TEXT,
  request_data TEXT, -- JSON
  user_id TEXT,
  ip_address TEXT,
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_error_events_type_time ON error_events(error_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_error_events_user ON error_events(user_id, timestamp);

-- Configuration management
CREATE TABLE IF NOT EXISTS config_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  data_type TEXT NOT NULL DEFAULT 'string', -- string, integer, boolean, json
  description TEXT,
  updated_at INTEGER NOT NULL,
  updated_by TEXT
);

-- Insert default configuration
INSERT OR REPLACE INTO config_settings VALUES
('rate_limit_per_minute', '60', 'integer', 'Default rate limit per minute', strftime('%s', 'now') * 1000, 'system'),
('rate_limit_per_hour', '1000', 'integer', 'Default rate limit per hour', strftime('%s', 'now') * 1000, 'system'),
('rate_limit_per_day', '10000', 'integer', 'Default rate limit per day', strftime('%s', 'now') * 1000, 'system'),
('bot_detection_threshold', '50', 'integer', 'Bot detection score threshold', strftime('%s', 'now') * 1000, 'system'),
('analytics_retention_days', '365', 'integer', 'Analytics data retention period', strftime('%s', 'now') * 1000, 'system'),
('security_events_retention_days', '90', 'integer', 'Security events retention period', strftime('%s', 'now') * 1000, 'system');

-- Create views for monitoring dashboards
CREATE VIEW IF NOT EXISTS daily_stats AS
SELECT 
  DATE(timestamp/1000, 'unixepoch') as date,
  COUNT(*) as total_clicks,
  COUNT(CASE WHEN is_bot = 0 THEN 1 END) as human_clicks,
  COUNT(CASE WHEN is_bot = 1 THEN 1 END) as bot_clicks,
  COUNT(DISTINCT ip_hash) as unique_visitors,
  COUNT(DISTINCT slug) as unique_links
FROM click_events
WHERE timestamp >= (strftime('%s', 'now') - 2592000) * 1000 -- Last 30 days
GROUP BY date
ORDER BY date DESC;

-- Security monitoring view
CREATE VIEW IF NOT EXISTS security_summary AS
SELECT 
  event_type,
  COUNT(*) as event_count,
  COUNT(DISTINCT ip_address) as unique_ips,
  MAX(timestamp) as latest_event
FROM security_events
WHERE timestamp >= (strftime('%s', 'now') - 86400) * 1000 -- Last 24 hours
GROUP BY event_type
ORDER BY event_count DESC;

-- System health dashboard view  
CREATE VIEW IF NOT EXISTS health_status AS
SELECT 
  component,
  status,
  COUNT(*) as status_count,
  MAX(timestamp) as last_check
FROM system_health
WHERE timestamp >= (strftime('%s', 'now') - 3600) * 1000 -- Last hour
GROUP BY component, status
ORDER BY component, last_check DESC;