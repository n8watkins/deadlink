-- Add owner_id to links table if it doesn't exist
ALTER TABLE links ADD COLUMN owner_id TEXT REFERENCES users(id);

-- Create index for owner_id
CREATE INDEX IF NOT EXISTS idx_links_owner ON links(owner_id);

-- Update existing links table structure if needed
CREATE INDEX IF NOT EXISTS idx_links_owner_created ON links(owner_id, created_at);