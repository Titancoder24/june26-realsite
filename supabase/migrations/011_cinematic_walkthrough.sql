-- AI Cinematic Walkthrough — separate module from scene_intelligence

ALTER TABLE experiences DROP CONSTRAINT IF EXISTS experiences_type_check;
ALTER TABLE experiences ADD CONSTRAINT experiences_type_check
  CHECK (type IN (
    '360_realistic', 'worldlabs_splat', 'immersive_world', 'mobile_360_capture',
    'scene_intelligence', 'cinematic_walkthrough'
  ));

-- Uploaded property images (originals never overwritten)
CREATE TABLE walkthrough_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  original_image_url TEXT NOT NULL,
  enhanced_image_url TEXT,
  thumbnail_url TEXT,
  mobile_crop_url TEXT,
  desktop_crop_url TEXT,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  width INT,
  height INT,
  upload_status TEXT NOT NULL DEFAULT 'uploaded' CHECK (upload_status IN ('uploaded', 'processing', 'ready', 'failed')),
  enhancement_status TEXT NOT NULL DEFAULT 'pending' CHECK (enhancement_status IN ('pending', 'processing', 'completed', 'failed', 'skipped', 'approved', 'rejected')),
  enhancement_model TEXT,
  enhancement_prompt TEXT,
  enhancement_error TEXT,
  approved_by_user BOOLEAN DEFAULT false,
  ai_analysis JSONB DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  included BOOLEAN DEFAULT true,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_walkthrough_images_experience ON walkthrough_images(experience_id);
CREATE INDEX idx_walkthrough_images_order ON walkthrough_images(experience_id, sort_order);

CREATE TABLE walkthrough_enhancement_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  image_id UUID NOT NULL REFERENCES walkthrough_images(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  model TEXT,
  prompt TEXT,
  result_url TEXT,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_walkthrough_enhancement_jobs_image ON walkthrough_enhancement_jobs(image_id);

-- Walkthrough scenes (separate from property_scenes)
CREATE TABLE walkthrough_scenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  image_id UUID REFERENCES walkthrough_images(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  room_type TEXT,
  caption TEXT,
  image_url TEXT NOT NULL,
  edited_image_url TEXT,
  thumbnail_url TEXT,
  scene_order INT NOT NULL DEFAULT 0,
  is_start_scene BOOLEAN DEFAULT false,
  motion_type TEXT NOT NULL DEFAULT 'push_in',
  motion_config JSONB DEFAULT '{"duration": 5, "easing": "easeInOut"}',
  duration NUMERIC DEFAULT 5,
  edit_config JSONB DEFAULT '{}',
  mobile_crop JSONB DEFAULT '{"x": 0, "y": 0, "width": 1, "height": 1}',
  desktop_crop JSONB DEFAULT '{"x": 0, "y": 0, "width": 1, "height": 1}',
  ai_context TEXT,
  quality_notes TEXT,
  warnings JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_walkthrough_scenes_experience ON walkthrough_scenes(experience_id);
CREATE INDEX idx_walkthrough_scenes_order ON walkthrough_scenes(experience_id, scene_order);

CREATE TABLE walkthrough_annotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scene_id UUID NOT NULL REFERENCES walkthrough_scenes(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  short_description TEXT,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'room_feature',
  x_position NUMERIC NOT NULL CHECK (x_position >= 0 AND x_position <= 1),
  y_position NUMERIC NOT NULL CHECK (y_position >= 0 AND y_position <= 1),
  visibility TEXT NOT NULL DEFAULT 'public',
  cta_type TEXT,
  cta_label TEXT,
  media_url TEXT,
  ai_context TEXT,
  rag_enabled BOOLEAN DEFAULT true,
  rag_entry_id UUID REFERENCES knowledge_entries(id) ON DELETE SET NULL,
  crm_tracking_enabled BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_walkthrough_annotations_scene ON walkthrough_annotations(scene_id);

-- Production readiness checklist
CREATE TABLE walkthrough_checklists (
  experience_id UUID PRIMARY KEY REFERENCES experiences(id) ON DELETE CASCADE,
  images_uploaded BOOLEAN DEFAULT false,
  images_enhanced BOOLEAN DEFAULT false,
  scenes_created BOOLEAN DEFAULT false,
  scene_order_approved BOOLEAN DEFAULT false,
  motion_added BOOLEAN DEFAULT false,
  annotations_added BOOLEAN DEFAULT false,
  property_rag_added BOOLEAN DEFAULT false,
  ai_tested BOOLEAN DEFAULT false,
  viewer_previewed BOOLEAN DEFAULT false,
  ready_to_publish BOOLEAN DEFAULT false,
  warnings JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat-style RAG input sessions
CREATE TABLE walkthrough_rag_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id),
  title TEXT DEFAULT 'Property knowledge chat',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE walkthrough_rag_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES walkthrough_rag_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  extracted_entries JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_walkthrough_rag_messages_session ON walkthrough_rag_messages(session_id);

-- Buyer viewer events (walkthrough-specific)
CREATE TABLE viewer_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES buyer_sessions(id) ON DELETE SET NULL,
  experience_id UUID REFERENCES experiences(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  scene_id UUID REFERENCES walkthrough_scenes(id) ON DELETE SET NULL,
  annotation_id UUID REFERENCES walkthrough_annotations(id) ON DELETE SET NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_viewer_events_experience ON viewer_events(experience_id);
CREATE INDEX idx_viewer_events_session ON viewer_events(session_id);

-- Link knowledge entries to walkthrough scenes/annotations
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS walkthrough_scene_id UUID REFERENCES walkthrough_scenes(id) ON DELETE SET NULL;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS walkthrough_annotation_id UUID REFERENCES walkthrough_annotations(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE walkthrough_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE walkthrough_enhancement_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE walkthrough_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE walkthrough_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE walkthrough_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE walkthrough_rag_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE walkthrough_rag_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE viewer_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_walkthrough_images ON walkthrough_images FOR ALL
  USING (organization_id = auth_user_org_id());

CREATE POLICY org_walkthrough_enhancement_jobs ON walkthrough_enhancement_jobs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM walkthrough_images wi
    WHERE wi.id = walkthrough_enhancement_jobs.image_id
      AND wi.organization_id = auth_user_org_id()
  ));

CREATE POLICY org_walkthrough_scenes ON walkthrough_scenes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM experiences e
    WHERE e.id = walkthrough_scenes.experience_id
      AND e.organization_id = auth_user_org_id()
  ));

CREATE POLICY org_walkthrough_annotations ON walkthrough_annotations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM experiences e
    WHERE e.id = walkthrough_annotations.experience_id
      AND e.organization_id = auth_user_org_id()
  ));

CREATE POLICY org_walkthrough_checklists ON walkthrough_checklists FOR ALL
  USING (EXISTS (
    SELECT 1 FROM experiences e
    WHERE e.id = walkthrough_checklists.experience_id
      AND e.organization_id = auth_user_org_id()
  ));

CREATE POLICY org_walkthrough_rag_sessions ON walkthrough_rag_sessions FOR ALL
  USING (organization_id = auth_user_org_id());

CREATE POLICY org_walkthrough_rag_messages ON walkthrough_rag_messages FOR ALL
  USING (EXISTS (
    SELECT 1 FROM walkthrough_rag_sessions s
    WHERE s.id = walkthrough_rag_messages.session_id
      AND s.organization_id = auth_user_org_id()
  ));

CREATE POLICY org_viewer_events ON viewer_events FOR ALL
  USING (organization_id = auth_user_org_id());

-- Public read for published walkthrough experiences
CREATE POLICY public_walkthrough_scenes ON walkthrough_scenes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM experiences e
    WHERE e.id = walkthrough_scenes.experience_id
      AND e.type = 'cinematic_walkthrough'
      AND e.status IN ('published', 'ready_for_review')
  ));

CREATE POLICY public_walkthrough_annotations ON walkthrough_annotations FOR SELECT
  USING (
    visibility = 'public'
    AND EXISTS (
      SELECT 1 FROM experiences e
      WHERE e.id = walkthrough_annotations.experience_id
        AND e.type = 'cinematic_walkthrough'
        AND e.status IN ('published', 'ready_for_review')
    )
  );
