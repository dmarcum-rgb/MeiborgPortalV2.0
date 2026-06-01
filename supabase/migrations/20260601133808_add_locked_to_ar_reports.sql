/*
  # Add locked column to ar_reports

  Adds a boolean `locked` column so the report can be locked to prevent
  accidental replacement. Default is false (unlocked).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ar_reports' AND column_name = 'locked'
  ) THEN
    ALTER TABLE ar_reports ADD COLUMN locked boolean NOT NULL DEFAULT false;
  END IF;
END $$;
