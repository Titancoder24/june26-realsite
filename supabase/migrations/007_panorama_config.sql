-- Pannellum panorama metadata (haov, vaov, vOffset, hfov) per scene
ALTER TABLE tour_360_scenes
  ADD COLUMN IF NOT EXISTS panorama_config JSONB DEFAULT '{}';
