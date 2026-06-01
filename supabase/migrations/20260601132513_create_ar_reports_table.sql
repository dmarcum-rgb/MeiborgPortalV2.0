/*
  # Create ar_reports table

  Persists the most recently uploaded Accounts Receivable xlsx report per tab,
  storing the parsed JSON so the report survives page refreshes.

  1. New Tables
    - `ar_reports`
      - `id` (uuid, primary key)
      - `tab_id` (uuid, references portal_tabs)
      - `report_date` (text) - date string from the report header
      - `report_data` (jsonb) - parsed customer array
      - `uploaded_by` (text) - full name of uploader
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Authenticated users can select and insert (department access is handled at app level)
    - Only the most recent row per tab_id matters; app upserts by deleting old first
*/

CREATE TABLE IF NOT EXISTS ar_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id      uuid NOT NULL,
  report_date text NOT NULL DEFAULT '',
  report_data jsonb NOT NULL DEFAULT '[]',
  uploaded_by text NOT NULL DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE ar_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read AR reports"
  ON ar_reports FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert AR reports"
  ON ar_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete AR reports"
  ON ar_reports FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS ar_reports_tab_id_idx ON ar_reports(tab_id);
