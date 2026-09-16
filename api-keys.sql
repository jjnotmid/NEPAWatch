-- Run once in Supabase SQL Editor
-- Developer dashboard support: link keys to accounts

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS user_id uuid;     -- owning account (null = unclaimed legacy key)
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS name text;        -- friendly label shown in the dashboard

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
