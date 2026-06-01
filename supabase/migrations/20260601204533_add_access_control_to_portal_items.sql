/*
  # Add access control to portal folders and tabs

  Adds two JSONB columns to both portal_folders and portal_tabs:
  - `allowed_departments` (text[]): list of department names that can see this item.
    NULL = visible to everyone.
  - `allowed_members` (text[]): list of team member full_name values that can see this item.
    NULL = visible to everyone.

  Access rule: if BOTH are NULL, item is public to all portal users.
  If either is set, the user must match at least one entry in either list.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portal_folders' AND column_name = 'allowed_departments'
  ) THEN
    ALTER TABLE portal_folders ADD COLUMN allowed_departments text[] DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portal_folders' AND column_name = 'allowed_members'
  ) THEN
    ALTER TABLE portal_folders ADD COLUMN allowed_members text[] DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portal_tabs' AND column_name = 'allowed_departments'
  ) THEN
    ALTER TABLE portal_tabs ADD COLUMN allowed_departments text[] DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portal_tabs' AND column_name = 'allowed_members'
  ) THEN
    ALTER TABLE portal_tabs ADD COLUMN allowed_members text[] DEFAULT NULL;
  END IF;
END $$;
