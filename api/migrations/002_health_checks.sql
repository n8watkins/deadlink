-- Phase 3: Health Check System Database Schema
-- Add tables for health check monitoring and status tracking

-- Health check run history
CREATE TABLE IF NOT EXISTS health_check_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_at INTEGER NOT NULL,
    links_checked INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL
);

-- Link status change history
CREATE TABLE IF NOT EXISTS link_status_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_at INTEGER NOT NULL,
    reason TEXT,
    FOREIGN KEY (slug) REFERENCES links(slug)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_health_runs_date ON health_check_runs(run_at);
CREATE INDEX IF NOT EXISTS idx_status_changes_slug ON link_status_changes(slug);
CREATE INDEX IF NOT EXISTS idx_status_changes_date ON link_status_changes(changed_at);

-- Add columns to links table for health check tracking
ALTER TABLE links ADD COLUMN last_health_check INTEGER;
ALTER TABLE links ADD COLUMN health_check_failures INTEGER DEFAULT 0;