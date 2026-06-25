-- Scene Intelligence Builder: cinematic motion scenes with flat-image annotations

ALTER TABLE experiences DROP CONSTRAINT IF EXISTS experiences_type_check;
ALTER TABLE experiences ADD CONSTRAINT experiences_type_check
  CHECK (type IN (
    '360_realistic', 'worldlabs_splat', 'immersive_world', 'mobile_360_capture',
    'scene_intelligence'
  ));

-- Property scenes (flat images with motion + editor state)
CREATE TABLE property_scenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  edited_image_url TEXT,
  thumbnail_url TEXT,
  scene_order INT NOT NULL DEFAULT 0,
  is_start_scene BOOLEAN DEFAULT false,
  motion_type TEXT NOT NULL DEFAULT 'push_in',
  motion_config JSONB DEFAULT '{"duration": 8, "easing": "ease-in-out"}',
  duration NUMERIC DEFAULT 8,
  edit_config JSONB DEFAULT '{}',
  mobile_crop JSONB DEFAULT '{"x": 0, "y": 0, "width": 1, "height": 1}',
  desktop_crop JSONB DEFAULT '{"x": 0, "y": 0, "width": 1, "height": 1}',
  ai_context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_property_scenes_experience ON property_scenes(experience_id);
CREATE INDEX idx_property_scenes_order ON property_scenes(experience_id, scene_order);

-- Scene annotations (normalized flat-image pins)
CREATE TABLE scene_annotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scene_id UUID NOT NULL REFERENCES property_scenes(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  short_description TEXT,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'room_feature',
  x_position NUMERIC NOT NULL CHECK (x_position >= 0 AND x_position <= 1),
  y_position NUMERIC NOT NULL CHECK (y_position >= 0 AND y_position <= 1),
  depth_layer TEXT DEFAULT 'midground',
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

CREATE INDEX idx_scene_annotations_scene ON scene_annotations(scene_id);
CREATE INDEX idx_scene_annotations_experience ON scene_annotations(experience_id);

-- Link knowledge entries to scenes/annotations for three-layer RAG
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS scene_id UUID REFERENCES property_scenes(id) ON DELETE SET NULL;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS annotation_id UUID REFERENCES scene_annotations(id) ON DELETE SET NULL;

-- Public read policies for published scene intelligence experiences
CREATE POLICY public_property_scenes ON property_scenes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM experiences e
    WHERE e.id = property_scenes.experience_id
      AND e.status IN ('published', 'ready_for_review')
  ));

CREATE POLICY public_scene_annotations ON scene_annotations FOR SELECT
  USING (
    visibility = 'public'
    AND EXISTS (
      SELECT 1 FROM experiences e
      WHERE e.id = scene_annotations.experience_id
        AND e.status IN ('published', 'ready_for_review')
    )
  );
