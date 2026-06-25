-- Image Walkthrough: enhancement fields + depth view setting

ALTER TABLE image_walkthrough_nodes
  ADD COLUMN IF NOT EXISTS original_image_url TEXT,
  ADD COLUMN IF NOT EXISTS enhanced_image_url TEXT,
  ADD COLUMN IF NOT EXISTS enhancement_status TEXT DEFAULT 'pending'
    CHECK (enhancement_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  ADD COLUMN IF NOT EXISTS enhancement_error TEXT,
  ADD COLUMN IF NOT EXISTS enhancement_model TEXT,
  ADD COLUMN IF NOT EXISTS enhancement_completed_at TIMESTAMPTZ;

UPDATE image_walkthrough_nodes
SET original_image_url = image_url
WHERE original_image_url IS NULL AND image_url IS NOT NULL;

UPDATE image_walkthrough_nodes
SET enhancement_status = 'pending'
WHERE enhancement_status IS NULL;

ALTER TABLE image_walkthrough_settings
  ADD COLUMN IF NOT EXISTS enable_depth_view BOOLEAN DEFAULT false;

ALTER TABLE image_walkthrough_checklists
  ADD COLUMN IF NOT EXISTS images_enhanced BOOLEAN DEFAULT false;
