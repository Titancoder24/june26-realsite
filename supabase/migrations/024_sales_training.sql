-- Sales Training Module
-- Production persistence for text and voice roleplay, scoring, manager dashboards, and coaching history.

CREATE TABLE IF NOT EXISTS sales_training_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  scenario_id TEXT NOT NULL,
  scenario_title TEXT NOT NULL,
  training_mode TEXT NOT NULL DEFAULT 'text' CHECK (training_mode IN ('text', 'voice')),
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard', 'elite')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  title TEXT,
  source_context JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_training_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sales_training_sessions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('agent', 'buyer', 'coach', 'system')),
  content TEXT NOT NULL,
  input_mode TEXT NOT NULL DEFAULT 'text' CHECK (input_mode IN ('text', 'voice')),
  transcript_confidence NUMERIC,
  audio_url TEXT,
  audio_duration_seconds NUMERIC,
  provider TEXT,
  model TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_training_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sales_training_sessions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  readiness_score INT NOT NULL DEFAULT 0 CHECK (readiness_score BETWEEN 0 AND 100),
  discovery_score INT NOT NULL DEFAULT 0 CHECK (discovery_score BETWEEN 0 AND 100),
  objection_score INT NOT NULL DEFAULT 0 CHECK (objection_score BETWEEN 0 AND 100),
  product_knowledge_score INT NOT NULL DEFAULT 0 CHECK (product_knowledge_score BETWEEN 0 AND 100),
  empathy_score INT NOT NULL DEFAULT 0 CHECK (empathy_score BETWEEN 0 AND 100),
  closing_score INT NOT NULL DEFAULT 0 CHECK (closing_score BETWEEN 0 AND 100),
  compliance_score INT NOT NULL DEFAULT 0 CHECK (compliance_score BETWEEN 0 AND 100),
  strengths JSONB NOT NULL DEFAULT '[]',
  improvements JSONB NOT NULL DEFAULT '[]',
  manager_summary TEXT,
  next_drill TEXT,
  raw_assessment JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_training_voice_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sales_training_sessions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'elevenlabs',
  stt_model TEXT,
  tts_model TEXT,
  voice_id TEXT,
  transcript TEXT,
  audio_input_url TEXT,
  audio_output_url TEXT,
  duration_seconds NUMERIC,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('processing', 'completed', 'failed')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_training_sessions_org ON sales_training_sessions(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_training_sessions_agent ON sales_training_sessions(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_training_messages_session ON sales_training_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_training_assessments_org ON sales_training_assessments(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_training_assessments_agent ON sales_training_assessments(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_training_voice_calls_session ON sales_training_voice_calls(session_id, created_at DESC);

ALTER TABLE sales_training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_training_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_training_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_training_voice_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_training_sessions_org_read ON sales_training_sessions FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY sales_training_sessions_agent_insert ON sales_training_sessions FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND agent_id = auth.uid()
  );

CREATE POLICY sales_training_sessions_agent_update ON sales_training_sessions FOR UPDATE
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (
      agent_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.organization_id = sales_training_sessions.organization_id
          AND profiles.role IN ('sales_manager', 'project_manager', 'organization_admin', 'platform_admin')
      )
    )
  );

CREATE POLICY sales_training_messages_org_read ON sales_training_messages FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY sales_training_messages_agent_insert ON sales_training_messages FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (agent_id = auth.uid() OR agent_id IS NULL)
  );

CREATE POLICY sales_training_assessments_org_read ON sales_training_assessments FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY sales_training_assessments_agent_insert ON sales_training_assessments FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND agent_id = auth.uid()
  );

CREATE POLICY sales_training_voice_calls_org_read ON sales_training_voice_calls FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY sales_training_voice_calls_agent_insert ON sales_training_voice_calls FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND agent_id = auth.uid()
  );
