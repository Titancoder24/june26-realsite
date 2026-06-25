-- Image Walkthrough: Google Maps / Street View inspired image navigation (flat + panorama-ready)

ALTER TABLE experiences DROP CONSTRAINT IF EXISTS experiences_type_check;
ALTER TABLE experiences ADD CONSTRAINT experiences_type_check
  CHECK (type IN (
    '360_realistic', 'worldlabs_splat', 'immersive_world', 'mobile_360_capture',
    'scene_intelligence', 'cinematic_walkthrough', 'image_walkthrough'
  ));

CREATE TABLE IF NOT EXISTS image_walkthrough_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  original_filename TEXT,
  display_name TEXT DEFAULT 'Needs Review',
  room_type TEXT DEFAULT 'unknown',
  zone TEXT,
  floor_label TEXT,
  description TEXT,
  media_type TEXT NOT NULL DEFAULT 'flat' CHECK (media_type IN ('flat', 'equirectangular')),
  ai_confidence NUMERIC,
  ai_reasoning TEXT,
  ai_analysis JSONB DEFAULT '{}',
  node_order INT DEFAULT 0,
  is_start_node BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iw_nodes_experience ON image_walkthrough_nodes(experience_id);
CREATE INDEX IF NOT EXISTS idx_iw_nodes_property ON image_walkthrough_nodes(property_id);

CREATE TABLE IF NOT EXISTS image_walkthrough_hotspots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  from_node_id UUID NOT NULL REFERENCES image_walkthrough_nodes(id) ON DELETE CASCADE,
  to_node_id UUID REFERENCES image_walkthrough_nodes(id) ON DELETE SET NULL,
  x_position NUMERIC NOT NULL CHECK (x_position >= 0 AND x_position <= 1),
  y_position NUMERIC NOT NULL CHECK (y_position >= 0 AND y_position <= 1),
  label TEXT NOT NULL DEFAULT 'Go',
  direction TEXT DEFAULT 'forward',
  transition_type TEXT DEFAULT 'fade',
  ai_suggested BOOLEAN DEFAULT false,
  confidence NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iw_hotspots_from ON image_walkthrough_hotspots(from_node_id);
CREATE INDEX IF NOT EXISTS idx_iw_hotspots_experience ON image_walkthrough_hotspots(experience_id);

CREATE TABLE IF NOT EXISTS image_walkthrough_annotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES image_walkthrough_nodes(id) ON DELETE CASCADE,
  x_position NUMERIC NOT NULL CHECK (x_position >= 0 AND x_position <= 1),
  y_position NUMERIC NOT NULL CHECK (y_position >= 0 AND y_position <= 1),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'feature',
  icon_type TEXT DEFAULT 'info',
  ai_context TEXT,
  knowledge_entry_id UUID REFERENCES knowledge_entries(id) ON DELETE SET NULL,
  ai_suggested BOOLEAN DEFAULT false,
  confidence NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iw_annotations_node ON image_walkthrough_annotations(node_id);

CREATE TABLE IF NOT EXISTS image_walkthrough_settings (
  experience_id UUID PRIMARY KEY REFERENCES experiences(id) ON DELETE CASCADE,
  start_node_id UUID REFERENCES image_walkthrough_nodes(id) ON DELETE SET NULL,
  navigation_mode TEXT DEFAULT 'hotspot' CHECK (navigation_mode IN ('hotspot', 'list', 'both')),
  enable_minimap BOOLEAN DEFAULT true,
  enable_ai_chat BOOLEAN DEFAULT true,
  enable_annotations BOOLEAN DEFAULT true,
  panorama_ready BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS image_walkthrough_checklists (
  experience_id UUID PRIMARY KEY REFERENCES experiences(id) ON DELETE CASCADE,
  images_uploaded BOOLEAN DEFAULT false,
  ai_analysis_completed BOOLEAN DEFAULT false,
  start_node_selected BOOLEAN DEFAULT false,
  navigation_connected BOOLEAN DEFAULT false,
  annotations_added BOOLEAN DEFAULT false,
  preview_checked BOOLEAN DEFAULT false,
  ready_to_publish BOOLEAN DEFAULT false,
  warnings JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE image_walkthrough_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_walkthrough_hotspots ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_walkthrough_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_walkthrough_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_walkthrough_checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_iw_nodes ON image_walkthrough_nodes;
CREATE POLICY org_iw_nodes ON image_walkthrough_nodes FOR ALL
  USING (organization_id = auth_user_org_id());

DROP POLICY IF EXISTS org_iw_hotspots ON image_walkthrough_hotspots;
CREATE POLICY org_iw_hotspots ON image_walkthrough_hotspots FOR ALL
  USING (EXISTS (
    SELECT 1 FROM experiences e WHERE e.id = image_walkthrough_hotspots.experience_id AND e.organization_id = auth_user_org_id()
  ));

DROP POLICY IF EXISTS org_iw_annotations ON image_walkthrough_annotations;
CREATE POLICY org_iw_annotations ON image_walkthrough_annotations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM experiences e WHERE e.id = image_walkthrough_annotations.experience_id AND e.organization_id = auth_user_org_id()
  ));

DROP POLICY IF EXISTS org_iw_settings ON image_walkthrough_settings;
CREATE POLICY org_iw_settings ON image_walkthrough_settings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM experiences e WHERE e.id = image_walkthrough_settings.experience_id AND e.organization_id = auth_user_org_id()
  ));

DROP POLICY IF EXISTS org_iw_checklists ON image_walkthrough_checklists;
CREATE POLICY org_iw_checklists ON image_walkthrough_checklists FOR ALL
  USING (EXISTS (
    SELECT 1 FROM experiences e WHERE e.id = image_walkthrough_checklists.experience_id AND e.organization_id = auth_user_org_id()
  ));

-- Public read for published image walkthroughs
DROP POLICY IF EXISTS public_iw_nodes ON image_walkthrough_nodes;
CREATE POLICY public_iw_nodes ON image_walkthrough_nodes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM experiences e
    WHERE e.id = image_walkthrough_nodes.experience_id
      AND e.type = 'image_walkthrough'
      AND e.status IN ('published', 'ready_for_review')
  ));

DROP POLICY IF EXISTS public_iw_hotspots ON image_walkthrough_hotspots;
CREATE POLICY public_iw_hotspots ON image_walkthrough_hotspots FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM experiences e
    WHERE e.id = image_walkthrough_hotspots.experience_id
      AND e.type = 'image_walkthrough'
      AND e.status IN ('published', 'ready_for_review')
  ));

DROP POLICY IF EXISTS public_iw_annotations ON image_walkthrough_annotations;
CREATE POLICY public_iw_annotations ON image_walkthrough_annotations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM experiences e
    WHERE e.id = image_walkthrough_annotations.experience_id
      AND e.type = 'image_walkthrough'
      AND e.status IN ('published', 'ready_for_review')
  ));

DROP POLICY IF EXISTS public_iw_settings ON image_walkthrough_settings;
CREATE POLICY public_iw_settings ON image_walkthrough_settings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM experiences e
    WHERE e.id = image_walkthrough_settings.experience_id
      AND e.type = 'image_walkthrough'
      AND e.status IN ('published', 'ready_for_review')
  ));
