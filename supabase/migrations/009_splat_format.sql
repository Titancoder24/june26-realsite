ALTER TABLE splat_worlds ADD COLUMN IF NOT EXISTS splat_format TEXT DEFAULT 'spz';

UPDATE splat_worlds SET splat_format = 'spz' WHERE provider = 'spaitial' AND splat_format IS NULL;
