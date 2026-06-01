/*
  # Add portal_folders table and link portal_tabs to folders

  ## Summary
  Enables grouping of portal sidebar tabs into collapsible folders.
  Admins can create named folders, then drag tabs into them.
  Tabs without a folder_id continue to appear flat in the sidebar.

  ## Changes

  ### New Table: portal_folders
  - `id` (uuid, PK)
  - `label` (text) — display name shown in sidebar
  - `sort_order` (int) — position among top-level sidebar items
  - `is_open` (boolean) — default collapsed state stored server-side
  - `created_at` (timestamptz)

  ### Modified Table: portal_tabs
  - Added `folder_id` (uuid, nullable FK → portal_folders ON DELETE SET NULL)
    A tab with folder_id = NULL stays at the top level.

  ## Security
  - RLS enabled on portal_folders
  - Same permissive anon policy as portal_tabs (internal portal with password gate)
*/

CREATE TABLE IF NOT EXISTS portal_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT 'New Folder',
  sort_order int NOT NULL DEFAULT 0,
  is_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE portal_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view portal folders"
  ON portal_folders FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anon can insert portal folders"
  ON portal_folders FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update portal folders"
  ON portal_folders FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete portal folders"
  ON portal_folders FOR DELETE
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS portal_folders_sort_idx ON portal_folders (sort_order);

-- Add folder_id to portal_tabs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'portal_tabs' AND column_name = 'folder_id'
  ) THEN
    ALTER TABLE portal_tabs
      ADD COLUMN folder_id uuid REFERENCES portal_folders(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS portal_tabs_folder_idx ON portal_tabs (folder_id);
