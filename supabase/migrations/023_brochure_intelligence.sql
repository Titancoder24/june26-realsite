-- Brochure Intelligence Module
-- Smart brochure links with lead capture, page/section analytics, and intent scoring

-- Storage bucket for brochure PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brochures',
  'brochures',
  true,
  52428800,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS brochures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  experience_id UUID REFERENCES experiences(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_agent UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  file_url TEXT NOT NULL,
  original_file_name TEXT,
  page_count INT NOT NULL DEFAULT 0,
  viewer_mode TEXT NOT NULL DEFAULT 'pdf' CHECK (viewer_mode IN ('pdf', 'flipbook')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, slug)
);

CREATE TABLE IF NOT EXISTS brochure_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brochure_id UUID NOT NULL REFERENCES brochures(id) ON DELETE CASCADE,
  page_number INT NOT NULL,
  width NUMERIC,
  height NUMERIC,
  thumbnail_url TEXT,
  text_content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brochure_id, page_number)
);

CREATE TABLE IF NOT EXISTS brochure_page_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brochure_id UUID NOT NULL REFERENCES brochures(id) ON DELETE CASCADE,
  page_number INT NOT NULL,
  section_id TEXT NOT NULL,
  label TEXT NOT NULL,
  category TEXT,
  x NUMERIC NOT NULL DEFAULT 0,
  y NUMERIC NOT NULL DEFAULT 0,
  width NUMERIC NOT NULL DEFAULT 1,
  height NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brochure_id, page_number, section_id)
);

CREATE TABLE IF NOT EXISTS brochure_consent_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brochure_id UUID NOT NULL REFERENCES brochures(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  session_id UUID,
  consent_version TEXT NOT NULL DEFAULT '1.0',
  notice_version TEXT NOT NULL DEFAULT '1.0',
  status TEXT NOT NULL DEFAULT 'given' CHECK (status IN ('given', 'withdrawn')),
  data_categories JSONB NOT NULL DEFAULT '[]',
  purpose TEXT,
  given_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at TIMESTAMPTZ,
  user_agent_hash TEXT,
  ip_hash TEXT
);

CREATE TABLE IF NOT EXISTS brochure_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brochure_id UUID NOT NULL REFERENCES brochures(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  campaign_link_id TEXT,
  visitor_id TEXT,
  device TEXT,
  browser TEXT,
  os TEXT,
  screen_width INT,
  screen_height INT,
  language TEXT,
  timezone TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  consent_status TEXT NOT NULL DEFAULT 'given',
  consent_receipt_id UUID REFERENCES brochure_consent_receipts(id) ON DELETE SET NULL,
  viewer_mode TEXT NOT NULL DEFAULT 'pdf',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  total_seconds INT NOT NULL DEFAULT 0,
  intent_score INT NOT NULL DEFAULT 0,
  lead_status TEXT NOT NULL DEFAULT 'cold' CHECK (lead_status IN ('cold', 'warm', 'hot')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE brochure_consent_receipts
  ADD CONSTRAINT brochure_consent_receipts_session_fk
  FOREIGN KEY (session_id) REFERENCES brochure_sessions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS brochure_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES brochure_sessions(id) ON DELETE CASCADE,
  brochure_id UUID NOT NULL REFERENCES brochures(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  page_number INT,
  section_id TEXT,
  x NUMERIC,
  y NUMERIC,
  viewport JSONB,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brochure_page_dwell (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES brochure_sessions(id) ON DELETE CASCADE,
  brochure_id UUID NOT NULL REFERENCES brochures(id) ON DELETE CASCADE,
  page_number INT NOT NULL,
  seconds INT NOT NULL DEFAULT 0,
  view_count INT NOT NULL DEFAULT 0,
  max_scroll_percent NUMERIC NOT NULL DEFAULT 0,
  max_zoom NUMERIC NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, page_number)
);

CREATE TABLE IF NOT EXISTS brochure_section_dwell (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brochure_id UUID NOT NULL REFERENCES brochures(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES brochure_sessions(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  page_number INT NOT NULL,
  section_id TEXT NOT NULL,
  section_label TEXT,
  visible_seconds INT NOT NULL DEFAULT 0,
  view_count INT NOT NULL DEFAULT 0,
  max_visible_percent NUMERIC NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, page_number, section_id)
);

CREATE TABLE IF NOT EXISTS brochure_heatmap_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brochure_id UUID NOT NULL REFERENCES brochures(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES brochure_sessions(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  page_number INT NOT NULL,
  event_type TEXT NOT NULL,
  x NUMERIC NOT NULL,
  y NUMERIC NOT NULL,
  width NUMERIC,
  height NUMERIC,
  intensity NUMERIC NOT NULL DEFAULT 1,
  viewport_width INT,
  viewport_height INT,
  zoom NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brochure_scroll_depth (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brochure_id UUID NOT NULL REFERENCES brochures(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES brochure_sessions(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  page_number INT NOT NULL,
  scroll_bucket TEXT NOT NULL,
  seconds INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, page_number, scroll_bucket)
);

CREATE TABLE IF NOT EXISTS brochure_lead_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES brochure_sessions(id) ON DELETE CASCADE,
  brochure_id UUID NOT NULL REFERENCES brochures(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  score INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'cold' CHECK (status IN ('cold', 'warm', 'hot')),
  signals JSONB NOT NULL DEFAULT '[]',
  recommended_action TEXT,
  ai_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brochures_org ON brochures(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brochures_slug ON brochures(slug);
CREATE INDEX IF NOT EXISTS idx_brochure_sessions_brochure ON brochure_sessions(brochure_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_brochure_sessions_lead ON brochure_sessions(lead_id);
CREATE INDEX IF NOT EXISTS idx_brochure_events_session ON brochure_events(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_brochure_page_dwell_session ON brochure_page_dwell(session_id);
CREATE INDEX IF NOT EXISTS idx_brochure_section_dwell_session ON brochure_section_dwell(session_id);
CREATE INDEX IF NOT EXISTS idx_brochure_heatmap_session ON brochure_heatmap_points(session_id, page_number);
CREATE INDEX IF NOT EXISTS idx_brochure_lead_scores_brochure ON brochure_lead_scores(brochure_id, score DESC);

-- RLS
ALTER TABLE brochures ENABLE ROW LEVEL SECURITY;
ALTER TABLE brochure_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE brochure_page_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE brochure_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE brochure_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE brochure_page_dwell ENABLE ROW LEVEL SECURITY;
ALTER TABLE brochure_section_dwell ENABLE ROW LEVEL SECURITY;
ALTER TABLE brochure_heatmap_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE brochure_scroll_depth ENABLE ROW LEVEL SECURITY;
ALTER TABLE brochure_lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE brochure_consent_receipts ENABLE ROW LEVEL SECURITY;

-- Org members can read their brochures
CREATE POLICY brochures_org_read ON brochures FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY brochure_pages_org_read ON brochure_pages FOR SELECT
  USING (brochure_id IN (SELECT id FROM brochures WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY brochure_sections_org_read ON brochure_page_sections FOR SELECT
  USING (brochure_id IN (SELECT id FROM brochures WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY brochure_sessions_org_read ON brochure_sessions FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY brochure_events_org_read ON brochure_events FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY brochure_page_dwell_org_read ON brochure_page_dwell FOR SELECT
  USING (brochure_id IN (SELECT id FROM brochures WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY brochure_section_dwell_org_read ON brochure_section_dwell FOR SELECT
  USING (brochure_id IN (SELECT id FROM brochures WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY brochure_heatmap_org_read ON brochure_heatmap_points FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY brochure_scroll_org_read ON brochure_scroll_depth FOR SELECT
  USING (brochure_id IN (SELECT id FROM brochures WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY brochure_scores_org_read ON brochure_lead_scores FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY brochure_consent_org_read ON brochure_consent_receipts FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Storage policies for brochures bucket
CREATE POLICY brochures_storage_public_read ON storage.objects FOR SELECT
  USING (bucket_id = 'brochures');

CREATE POLICY brochures_storage_org_upload ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'brochures'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM profiles WHERE id = auth.uid()
    )
  );
