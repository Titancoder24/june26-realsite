-- Sales Training Datasets
-- Agent-provided context for ChatGPT-style training: pasted text, brochure/page URLs, and uploaded PDFs/text.

CREATE TABLE IF NOT EXISTS sales_training_datasets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('text', 'url', 'pdf', 'file')),
  source_url TEXT,
  file_name TEXT,
  mime_type TEXT,
  text_content TEXT NOT NULL,
  char_count INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_training_session_datasets (
  session_id UUID NOT NULL REFERENCES sales_training_sessions(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES sales_training_datasets(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, dataset_id)
);

CREATE INDEX IF NOT EXISTS idx_sales_training_datasets_org ON sales_training_datasets(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_training_datasets_agent ON sales_training_datasets(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_training_session_datasets_dataset ON sales_training_session_datasets(dataset_id);

ALTER TABLE sales_training_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_training_session_datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_training_datasets_org_read ON sales_training_datasets FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY sales_training_datasets_agent_insert ON sales_training_datasets FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND agent_id = auth.uid()
  );

CREATE POLICY sales_training_datasets_owner_update ON sales_training_datasets FOR UPDATE
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND agent_id = auth.uid()
  );

CREATE POLICY sales_training_session_datasets_org_read ON sales_training_session_datasets FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY sales_training_session_datasets_agent_insert ON sales_training_session_datasets FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM sales_training_sessions
      WHERE sales_training_sessions.id = sales_training_session_datasets.session_id
        AND sales_training_sessions.agent_id = auth.uid()
    )
  );
