-- Property Walkthrough — Veo motion assets, video jobs, extended scenes/annotations

-- Persisted AI plan per experience
CREATE TABLE walkthrough_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tour_title TEXT,
  property_type TEXT,
  flow_warnings JSONB DEFAULT '[]',
  plan_json JSONB NOT NULL DEFAULT '{}',
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (experience_id)
);

CREATE INDEX idx_walkthrough_plans_experience ON walkthrough_plans(experience_id);

-- Veo / OpenRouter video generation jobs
CREATE TABLE walkthrough_video_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scene_id UUID NOT NULL REFERENCES walkthrough_scenes(id) ON DELETE CASCADE,
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'submitted', 'processing', 'completed', 'failed', 'retrying')),
  model TEXT NOT NULL DEFAULT 'google/veo-3.1-lite',
  prompt TEXT NOT NULL,
  openrouter_job_id TEXT,
  polling_url TEXT,
  unsigned_url TEXT,
  stored_video_url TEXT,
  video_url_720p TEXT,
  video_url_1080p TEXT,
  video_url_mobile TEXT,
  poster_url TEXT,
  resolution TEXT,
  aspect_ratio TEXT,
  duration NUMERIC,
  error TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_walkthrough_video_jobs_scene ON walkthrough_video_jobs(scene_id);
CREATE INDEX idx_walkthrough_video_jobs_experience ON walkthrough_video_jobs(experience_id);
CREATE INDEX idx_walkthrough_video_jobs_status ON walkthrough_video_jobs(status);

-- Extend scenes for Veo motion + timeline
ALTER TABLE walkthrough_scenes ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE walkthrough_scenes ADD COLUMN IF NOT EXISTS veo_prompt TEXT;
ALTER TABLE walkthrough_scenes ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE walkthrough_scenes ADD COLUMN IF NOT EXISTS video_url_720p TEXT;
ALTER TABLE walkthrough_scenes ADD COLUMN IF NOT EXISTS video_url_1080p TEXT;
ALTER TABLE walkthrough_scenes ADD COLUMN IF NOT EXISTS video_url_mobile TEXT;
ALTER TABLE walkthrough_scenes ADD COLUMN IF NOT EXISTS poster_url TEXT;
ALTER TABLE walkthrough_scenes ADD COLUMN IF NOT EXISTS timeline_start NUMERIC DEFAULT 0;
ALTER TABLE walkthrough_scenes ADD COLUMN IF NOT EXISTS timeline_end NUMERIC;
ALTER TABLE walkthrough_scenes ADD COLUMN IF NOT EXISTS scene_status TEXT DEFAULT 'draft';

-- Extend images with room detection fields
ALTER TABLE walkthrough_images ADD COLUMN IF NOT EXISTS room_type TEXT;
ALTER TABLE walkthrough_images ADD COLUMN IF NOT EXISTS quality_score NUMERIC;
ALTER TABLE walkthrough_images ADD COLUMN IF NOT EXISTS ai_caption TEXT;
ALTER TABLE walkthrough_images ADD COLUMN IF NOT EXISTS ai_description TEXT;

-- Extend annotations with pin styling
ALTER TABLE walkthrough_annotations ADD COLUMN IF NOT EXISTS pin_style TEXT DEFAULT 'default';
ALTER TABLE walkthrough_annotations ADD COLUMN IF NOT EXISTS icon_type TEXT DEFAULT 'pin';
ALTER TABLE walkthrough_annotations ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);
ALTER TABLE walkthrough_annotations ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id);

-- Checklist: motion video gate
ALTER TABLE walkthrough_checklists ADD COLUMN IF NOT EXISTS motion_videos_generated BOOLEAN DEFAULT false;

-- Backfill organization_id on scenes
UPDATE walkthrough_scenes ws
SET organization_id = e.organization_id
FROM experiences e
WHERE e.id = ws.experience_id AND ws.organization_id IS NULL;

-- RLS
ALTER TABLE walkthrough_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE walkthrough_video_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_walkthrough_plans ON walkthrough_plans FOR ALL
  USING (organization_id = auth_user_org_id());

CREATE POLICY org_walkthrough_video_jobs ON walkthrough_video_jobs FOR ALL
  USING (organization_id = auth_user_org_id());

CREATE POLICY public_walkthrough_video_jobs ON walkthrough_video_jobs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM experiences e
    WHERE e.id = walkthrough_video_jobs.experience_id
      AND e.type = 'cinematic_walkthrough'
      AND e.status IN ('published', 'ready_for_review')
  ));
