-- Platform-wide settings for Super Admin (AI provider toggle, credentials)

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Only service role / platform admin via API (no direct client access)
CREATE POLICY platform_settings_service ON platform_settings FOR ALL
  USING (false);

-- Defaults
INSERT INTO platform_settings (key, value) VALUES
  ('walkthrough_ai_provider', '"openrouter"'),
  ('vertex_ai_config', '{"planner_model":"gemini-3.5-flash","video_model":"veo-3.1-lite-generate-001","location":"us-central1"}'),
  ('super_admin', '{"username":"superadmin","email":"superadmin@realsite.platform","configured":false}')
ON CONFLICT (key) DO NOTHING;
