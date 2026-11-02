-- Rollback for Error Logging and Tracking Migration

-- Drop all error logging tables
DROP TABLE IF EXISTS alert_history;
DROP TABLE IF EXISTS error_summary_hourly;
DROP TABLE IF EXISTS error_logs;

-- Log rollback if audit table exists
INSERT INTO security_audit_log (event_type, event_data, created_at) 
VALUES ('MIGRATION_002_ROLLED_BACK', 'Error logging tables removed', unixepoch())
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='security_audit_log');