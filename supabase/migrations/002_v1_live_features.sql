-- V1 Live: slugs, storage, vector search, auth triggers, public policies

ALTER TABLE experiences ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_experiences_slug ON experiences(slug);
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_entry ON knowledge_embeddings(knowledge_entry_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_embeddings_entry_unique ON knowledge_embeddings(knowledge_entry_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'organization_admin')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Vector similarity search for RAG
CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_organization_id uuid,
  p_property_id uuid
)
RETURNS TABLE (
  id uuid,
  category text,
  title text,
  content text,
  source_type text,
  source_id uuid,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ke.id,
    ke.category,
    ke.title,
    ke.content,
    ke.source_type,
    ke.source_id,
    1 - (emb.embedding <=> query_embedding) AS similarity
  FROM knowledge_embeddings emb
  JOIN knowledge_entries ke ON ke.id = emb.knowledge_entry_id
  WHERE ke.organization_id = p_organization_id
    AND ke.property_id = p_property_id
    AND ke.approved = true
    AND 1 - (emb.embedding <=> query_embedding) > match_threshold
  ORDER BY emb.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Public buyer read policies
CREATE POLICY public_published_experiences_slug ON experiences FOR SELECT
  USING (status = 'published');

CREATE POLICY public_tour_scenes ON tour_360_scenes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM experiences e WHERE e.id = tour_360_scenes.experience_id AND e.status = 'published'
  ));

CREATE POLICY public_splat_worlds ON splat_worlds FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM experiences e WHERE e.id = splat_worlds.experience_id AND e.status = 'published'
  ));

CREATE POLICY public_floor_maps ON floor_maps FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM experiences e WHERE e.id = floor_maps.experience_id AND e.status = 'published'
  ) OR experience_id IS NULL);

CREATE POLICY public_checkpoints ON checkpoints FOR SELECT
  USING (visibility = 'public' AND EXISTS (
    SELECT 1 FROM experiences e WHERE e.id = checkpoints.experience_id AND e.status = 'published'
  ));

-- Storage bucket for media
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY media_upload ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');

CREATE POLICY media_read ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

CREATE POLICY media_delete ON storage.objects FOR DELETE
  USING (bucket_id = 'media' AND auth.role() = 'authenticated');

-- Job queue helper: pending worldlabs jobs view
CREATE OR REPLACE VIEW pending_worldlabs_jobs AS
SELECT * FROM worldlabs_jobs
WHERE status IN (
  'worldlabs_generation_requested',
  'worldlabs_processing',
  'worldlabs_media_uploaded'
)
AND failed_at IS NULL;
