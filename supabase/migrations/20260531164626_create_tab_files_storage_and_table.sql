/*
  # Create tab_files table and storage bucket policies

  ## Summary
  Adds file attachment support to portal tabs. The AI department can upload
  PDFs, Word docs, Excel sheets, and other files to any tab. Employees see
  them as downloadable cards.

  ## New Tables

  ### portal_tab_files
  - `id` (uuid, PK)
  - `tab_id` (uuid, FK → portal_tabs, CASCADE DELETE)
  - `file_name` (text) — original filename shown to users
  - `file_url` (text) — public URL in Supabase storage
  - `file_size` (bigint) — bytes
  - `file_type` (text) — MIME type
  - `sort_order` (int)
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Public SELECT (all employees can see/download files)
  - Anon INSERT/UPDATE/DELETE (guarded by frontend password gate)
*/

CREATE TABLE IF NOT EXISTS portal_tab_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id uuid NOT NULL REFERENCES portal_tabs(id) ON DELETE CASCADE,
  file_name text NOT NULL DEFAULT '',
  file_url text NOT NULL DEFAULT '',
  file_size bigint NOT NULL DEFAULT 0,
  file_type text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE portal_tab_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tab files"
  ON portal_tab_files FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anon can insert tab files"
  ON portal_tab_files FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update tab files"
  ON portal_tab_files FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete tab files"
  ON portal_tab_files FOR DELETE
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS portal_tab_files_tab_idx ON portal_tab_files (tab_id, sort_order);
