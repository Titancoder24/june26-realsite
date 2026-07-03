-- Sales Training Vector Memory
-- Stores embeddings for training messages so the coach can retrieve relevant prior history.

CREATE TABLE IF NOT EXISTS sales_training_message_embeddings (
  message_id UUID PRIMARY KEY REFERENCES sales_training_messages(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sales_training_sessions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('agent', 'buyer', 'coach', 'system')),
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_training_message_embeddings_org ON sales_training_message_embeddings(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_training_message_embeddings_agent ON sales_training_message_embeddings(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_training_message_embeddings_session ON sales_training_message_embeddings(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_training_message_embeddings_vector ON sales_training_message_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE sales_training_message_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_training_message_embeddings_org_read ON sales_training_message_embeddings FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY sales_training_message_embeddings_agent_insert ON sales_training_message_embeddings FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND agent_id = auth.uid()
  );

CREATE OR REPLACE FUNCTION match_sales_training_memory(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_organization_id uuid,
  p_agent_id uuid,
  p_session_id uuid DEFAULT NULL
)
RETURNS TABLE (
  message_id uuid,
  session_id uuid,
  role text,
  content text,
  similarity float,
  created_at timestamptz
)
LANGUAGE sql STABLE
AS $$
  SELECT
    emb.message_id,
    emb.session_id,
    emb.role,
    emb.content,
    1 - (emb.embedding <=> query_embedding) AS similarity,
    emb.created_at
  FROM sales_training_message_embeddings emb
  WHERE emb.organization_id = p_organization_id
    AND emb.agent_id = p_agent_id
    AND (p_session_id IS NULL OR emb.session_id = p_session_id)
    AND 1 - (emb.embedding <=> query_embedding) > match_threshold
  ORDER BY emb.embedding <=> query_embedding
  LIMIT match_count;
$$;
