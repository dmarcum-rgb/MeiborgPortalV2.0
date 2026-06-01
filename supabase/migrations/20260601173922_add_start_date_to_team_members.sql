/*
  # Add start_date to team_members

  Adds an optional `start_date` (date) column to the `team_members` table
  so admins can record each employee's hire/start date.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE team_members ADD COLUMN start_date date DEFAULT NULL;
  END IF;
END $$;
