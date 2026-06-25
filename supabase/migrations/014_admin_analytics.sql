-- Platform API usage tracking for Super Admin analytics

CREATE TABLE IF NOT EXISTS api_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL,
  operation TEXT NOT NULL,
  model TEXT,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  experience_id UUID REFERENCES experiences(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'queued')),
  tokens_estimated INT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created ON api_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_provider ON api_usage_logs(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_operation ON api_usage_logs(operation, created_at DESC);

ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS api_usage_logs_service ON api_usage_logs;
CREATE POLICY api_usage_logs_service ON api_usage_logs FOR ALL USING (false);
