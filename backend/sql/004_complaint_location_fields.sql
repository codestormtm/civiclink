ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(9,6),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(9,6),
  ADD COLUMN IF NOT EXISTS address_text TEXT,
  ADD COLUMN IF NOT EXISTS location_source VARCHAR(50);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'complaints_latitude_check'
  ) THEN
    ALTER TABLE complaints
      ADD CONSTRAINT complaints_latitude_check
      CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'complaints_longitude_check'
  ) THEN
    ALTER TABLE complaints
      ADD CONSTRAINT complaints_longitude_check
      CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
  END IF;
END $$;
