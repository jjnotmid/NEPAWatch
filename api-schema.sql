-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  developer_name TEXT NOT NULL,
  app_name TEXT,
  email TEXT NOT NULL,
  use_case TEXT,
  key TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  requests_today INT NOT NULL DEFAULT 0,
  total_requests BIGINT NOT NULL DEFAULT 0,
  last_request_at TIMESTAMPTZ,
  last_reset_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

-- API Request Logs table
CREATE TABLE IF NOT EXISTS api_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint TEXT,
  query_params TEXT,
  status_code INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;

-- Public can apply for API keys (insert only)
CREATE POLICY "api_keys_public_insert" ON api_keys
  FOR INSERT WITH CHECK (true);
