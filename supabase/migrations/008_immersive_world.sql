-- Immersive World (SpAItial Echo) experience type + job provider tracking

ALTER TABLE experiences DROP CONSTRAINT IF EXISTS experiences_type_check;
ALTER TABLE experiences ADD CONSTRAINT experiences_type_check
  CHECK (type IN ('360_realistic', 'worldlabs_splat', 'immersive_world', 'mobile_360_capture'));

-- Track which 3D provider generated the job
ALTER TABLE worldlabs_jobs ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'worldlabs';
ALTER TABLE splat_worlds ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'worldlabs';
ALTER TABLE splat_worlds ADD COLUMN IF NOT EXISTS viewer_url TEXT;
