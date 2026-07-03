-- Additional indexes for sales training foreign keys and dashboard queries.

CREATE INDEX IF NOT EXISTS idx_sales_training_messages_org ON sales_training_messages(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_training_messages_agent ON sales_training_messages(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_training_voice_calls_org ON sales_training_voice_calls(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_training_voice_calls_agent ON sales_training_voice_calls(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_training_session_datasets_org ON sales_training_session_datasets(organization_id, created_at DESC);
