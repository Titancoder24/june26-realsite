-- Video job timing + AI quality guard metadata
ALTER TABLE walkthrough_video_jobs ADD COLUMN IF NOT EXISTS validation_result JSONB;
ALTER TABLE walkthrough_video_jobs ADD COLUMN IF NOT EXISTS generation_duration_ms INTEGER;
