-- Harden sales training vector memory function search path.

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
SET search_path = public
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
