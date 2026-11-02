-- Error Logging and Tracking Tables
-- Provides comprehensive error tracking and analytics

-- Error logs table
CREATE TABLE IF NOT EXISTS error_logs (
  id TEXT PRIMARY KEY,
  severity TEXT NOT NULL CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  stack_trace TEXT,
  metadata TEXT, -- JSON string
  user_id TEXT,
  request_id TEXT,
  timestamp INTEGER NOT NULL,
  resolved INTEGER DEFAULT 0,
  resolved_at INTEGER,
  resolved_by TEXT,
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Error summary table for quick analytics
CREATE TABLE IF NOT EXISTS error_summary_hourly (
  hour TEXT NOT NULL, -- YYYY-MM-DD HH:00:00
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  affected_users INTEGER DEFAULT 0,
  PRIMARY KEY (hour, category, severity)
);

-- Alert history table
CREATE TABLE IF NOT EXISTS alert_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  error_id TEXT NOT NULL,
  alert_type TEXT NOT NULL, -- 'webhook', 'email', 'sms'
  recipient TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  success INTEGER DEFAULT 1,
  response TEXT,
  FOREIGN KEY (error_id) REFERENCES error_logs(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs(category);
CREATE INDEX IF NOT EXISTS idx_error_logs_user ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_request ON error_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_error_summary_hour ON error_summary_hourly(hour);
CREATE INDEX IF NOT EXISTS idx_alert_history_error ON alert_history(error_id);

-- Add audit log entry
INSERT INTO security_audit_log (event_type, event_data, created_at) VALUES
('MIGRATION_002_APPLIED', 'Error logging and tracking tables created', unixepoch());