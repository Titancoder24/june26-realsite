-- Mobile Web Capture & Walkthrough Builder

-- New experience type for phone-guided capture workflow
ALTER TABLE experiences DROP CONSTRAINT IF EXISTS experiences_type_check;
ALTER TABLE experiences ADD CONSTRAINT experiences_type_check
  CHECK (type IN ('360_realistic', 'worldlabs_splat', 'future_inhouse_splat', 'mobile_360_capture'));

-- Room capture plan (checklist item per room/area)
CREATE TABLE capture_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL,
  room_type TEXT DEFAULT 'custom',
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'capturing', 'processing', 'needs_retake', 'complete')),
  quality_score TEXT,
  scene_id UUID REFERENCES tour_360_scenes(id) ON DELETE SET NULL,
  notes TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual angle photos captured per room
CREATE TABLE capture_frames (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  capture_room_id UUID NOT NULL REFERENCES capture_rooms(id) ON DELETE CASCADE,
  angle_label TEXT NOT NULL,
  image_url TEXT NOT NULL,
  media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  sort_order INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backend stitching jobs (browser uploads frames, server creates scene)
CREATE TABLE stitch_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  capture_room_id UUID NOT NULL REFERENCES capture_rooms(id) ON DELETE CASCADE,
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'needs_more_angles')),
  result_scene_id UUID REFERENCES tour_360_scenes(id) ON DELETE SET NULL,
  stitched_image_url TEXT,
  frame_count INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_capture_rooms_experience ON capture_rooms(experience_id);
CREATE INDEX idx_capture_rooms_org ON capture_rooms(organization_id);
CREATE INDEX idx_capture_frames_room ON capture_frames(capture_room_id);
CREATE INDEX idx_stitch_jobs_room ON stitch_jobs(capture_room_id);
CREATE INDEX idx_stitch_jobs_experience ON stitch_jobs(experience_id);

ALTER TABLE capture_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE capture_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE stitch_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_capture_rooms ON capture_rooms FOR ALL USING (organization_id = auth_user_org_id());
CREATE POLICY org_capture_frames ON capture_frames FOR ALL USING (
  EXISTS (SELECT 1 FROM capture_rooms cr WHERE cr.id = capture_frames.capture_room_id AND cr.organization_id = auth_user_org_id())
);
CREATE POLICY org_stitch_jobs ON stitch_jobs FOR ALL USING (organization_id = auth_user_org_id());

ALTER PUBLICATION supabase_realtime ADD TABLE stitch_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE capture_rooms;
