-- Spatial Sales Platform — Production V1 Schema
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  branding JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users profile (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  email TEXT,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'viewer',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  project_type TEXT,
  city TEXT,
  locality TEXT,
  address TEXT,
  rera_number TEXT,
  status TEXT DEFAULT 'active',
  possession_timeline TEXT,
  branding JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Properties
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  property_type TEXT,
  unit_type TEXT,
  configuration TEXT,
  tower TEXT,
  floor TEXT,
  facing TEXT,
  area NUMERIC,
  price_min NUMERIC,
  price_max NUMERIC,
  availability TEXT DEFAULT 'available',
  furnishing_status TEXT,
  publish_status TEXT DEFAULT 'draft',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Experiences
CREATE TABLE experiences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('360_realistic', 'worldlabs_splat', 'future_inhouse_splat')),
  status TEXT NOT NULL DEFAULT 'draft',
  published_url TEXT,
  primary_experience BOOLEAN DEFAULT false,
  viewer_config JSONB DEFAULT '{}',
  ai_agent_id UUID,
  floor_map_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Media assets
CREATE TABLE media_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  content_type TEXT,
  file_size BIGINT,
  asset_type TEXT,
  worldlabs_media_asset_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- World Labs jobs
CREATE TABLE worldlabs_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  operation_id TEXT,
  world_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  model TEXT DEFAULT 'default',
  input_media_asset_ids JSONB DEFAULT '[]',
  world_prompt_payload JSONB DEFAULT '{}',
  raw_operation_response JSONB,
  raw_world_response JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_code TEXT,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Splat worlds
CREATE TABLE splat_worlds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  worldlabs_job_id UUID REFERENCES worldlabs_jobs(id),
  world_id TEXT,
  world_marble_url TEXT,
  thumbnail_url TEXT,
  caption TEXT,
  spz_100k_url TEXT,
  spz_500k_url TEXT,
  spz_full_res_url TEXT,
  collider_mesh_url TEXT,
  pano_url TEXT,
  model TEXT,
  default_start_position JSONB DEFAULT '{}',
  viewer_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 360 tour scenes
CREATE TABLE tour_360_scenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  initial_yaw NUMERIC DEFAULT 0,
  initial_pitch NUMERIC DEFAULT 0,
  is_start_scene BOOLEAN DEFAULT false,
  hotspots JSONB DEFAULT '[]',
  ai_context TEXT,
  floor_map_pin_id UUID,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Floor maps
CREATE TABLE floor_maps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  experience_id UUID REFERENCES experiences(id),
  image_url TEXT NOT NULL,
  name TEXT,
  pins JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Checkpoints
CREATE TABLE checkpoints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES tour_360_scenes(id),
  title TEXT NOT NULL,
  description TEXT,
  checkpoint_type TEXT NOT NULL DEFAULT 'info',
  position JSONB DEFAULT '{}',
  visibility_radius NUMERIC,
  ai_context TEXT,
  cta_type TEXT,
  cta_label TEXT,
  visibility TEXT DEFAULT 'public',
  analytics_enabled BOOLEAN DEFAULT true,
  internal_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge entries (RAG)
CREATE TABLE knowledge_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_type TEXT DEFAULT 'manual',
  source_id UUID,
  approved BOOLEAN DEFAULT false,
  version INT DEFAULT 1,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge embeddings
CREATE TABLE knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  knowledge_entry_id UUID NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  embedding vector(1536),
  model TEXT DEFAULT 'text-embedding-3-small',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI agents
CREATE TABLE ai_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  voice_id TEXT,
  language TEXT DEFAULT 'en',
  model_config JSONB DEFAULT '{}',
  greeting TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Buyer sessions
CREATE TABLE buyer_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  property_id UUID NOT NULL REFERENCES properties(id),
  experience_id UUID REFERENCES experiences(id),
  lead_id UUID,
  device TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

-- Session participants (family)
CREATE TABLE session_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES buyer_sessions(id) ON DELETE CASCADE,
  display_name TEXT,
  role TEXT DEFAULT 'guest',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  consent_voice BOOLEAN DEFAULT false,
  consent_chat BOOLEAN DEFAULT false
);

-- WebRTC sessions
CREATE TABLE webrtc_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_session_id UUID NOT NULL REFERENCES buyer_sessions(id) ON DELETE CASCADE,
  room_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation messages
CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES buyer_sessions(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  retrieved_sources JSONB DEFAULT '[]',
  confidence_score NUMERIC,
  sensitive_topic BOOLEAN DEFAULT false,
  fallback_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  project_id UUID REFERENCES projects(id),
  property_id UUID NOT NULL REFERENCES properties(id),
  session_id UUID REFERENCES buyer_sessions(id),
  name TEXT,
  phone TEXT,
  email TEXT,
  country TEXT,
  city TEXT,
  source TEXT,
  campaign TEXT,
  device TEXT,
  intent_score INT DEFAULT 20,
  intent_signals JSONB DEFAULT '[]',
  group_intent_score INT,
  lead_status TEXT DEFAULT 'new',
  assigned_agent UUID REFERENCES profiles(id),
  next_follow_up TIMESTAMPTZ,
  first_visit TIMESTAMPTZ DEFAULT NOW(),
  last_visit TIMESTAMPTZ DEFAULT NOW(),
  total_sessions INT DEFAULT 1,
  total_time_seconds INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead events (CRM timeline)
CREATE TABLE lead_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  session_id UUID REFERENCES buyer_sessions(id),
  property_id UUID NOT NULL REFERENCES properties(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Intent scores history
CREATE TABLE intent_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  score INT NOT NULL,
  signals JSONB DEFAULT '[]',
  explanation JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics events
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES buyer_sessions(id),
  property_id UUID REFERENCES properties(id),
  organization_id UUID REFERENCES organizations(id),
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Heatmap points
CREATE TABLE heatmap_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES buyer_sessions(id),
  property_id UUID NOT NULL REFERENCES properties(id),
  experience_id UUID REFERENCES experiences(id),
  experience_type TEXT,
  x NUMERIC,
  y NUMERIC,
  z NUMERIC,
  scene_id UUID,
  dwell_seconds INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign links
CREATE TABLE campaign_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  property_id UUID NOT NULL REFERENCES properties(id),
  experience_id UUID REFERENCES experiences(id),
  slug TEXT UNIQUE NOT NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  sales_agent_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin audit logs
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES profiles(id),
  organization_id UUID REFERENCES organizations(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  reason TEXT,
  payload JSONB DEFAULT '{}',
  severity TEXT DEFAULT 'info',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_properties_project ON properties(project_id);
CREATE INDEX idx_experiences_property ON experiences(property_id);
CREATE INDEX idx_knowledge_property ON knowledge_entries(property_id);
CREATE INDEX idx_knowledge_org ON knowledge_entries(organization_id);
CREATE INDEX idx_leads_org ON leads(organization_id);
CREATE INDEX idx_lead_events_lead ON lead_events(lead_id);
CREATE INDEX idx_worldlabs_jobs_status ON worldlabs_jobs(status);
CREATE INDEX idx_buyer_sessions_property ON buyer_sessions(property_id);

-- RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE worldlabs_jobs ENABLE ROW LEVEL SECURITY;

-- Helper: get user's org
CREATE OR REPLACE FUNCTION auth_user_org_id() RETURNS UUID AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Org isolation policies
CREATE POLICY org_projects ON projects FOR ALL USING (organization_id = auth_user_org_id());
CREATE POLICY org_properties ON properties FOR ALL USING (organization_id = auth_user_org_id());
CREATE POLICY org_experiences ON experiences FOR ALL USING (organization_id = auth_user_org_id());
CREATE POLICY org_knowledge ON knowledge_entries FOR ALL USING (organization_id = auth_user_org_id());
CREATE POLICY org_leads ON leads FOR ALL USING (organization_id = auth_user_org_id());
CREATE POLICY org_lead_events ON lead_events FOR ALL USING (organization_id = auth_user_org_id());
CREATE POLICY org_worldlabs ON worldlabs_jobs FOR ALL USING (organization_id = auth_user_org_id());
CREATE POLICY own_profile ON profiles FOR ALL USING (id = auth.uid() OR organization_id = auth_user_org_id());

-- Public read for published experiences (buyer viewer)
CREATE POLICY public_published_experiences ON experiences FOR SELECT
  USING (status = 'published');
