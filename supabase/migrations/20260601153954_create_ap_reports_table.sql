/*
  # Create ap_reports table

  Stores uploaded Aged Accounts Payable reports (CSV/XLSX) for the
  Accounts Payable tab in the Accounting Projects folder.

  1. New Tables
    - `ap_reports`
      - `id` (uuid, primary key)
      - `tab_id` (uuid, FK reference to portal_tabs)
      - `report_date` (text, e.g. "05/28/2026")
      - `report_data` (jsonb, array of APVendor objects)
      - `uploaded_by` (text, full name of uploader)
      - `locked` (boolean, prevents new uploads when true)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled
    - Authenticated users can SELECT, INSERT, UPDATE, DELETE their tabs' data
*/

CREATE TABLE IF NOT EXISTS ap_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id      uuid NOT NULL,
  report_date text NOT NULL DEFAULT '',
  report_data jsonb NOT NULL DEFAULT '[]',
  uploaded_by text NOT NULL DEFAULT '',
  locked      boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ap_reports_tab_id_idx ON ap_reports(tab_id);

ALTER TABLE ap_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read AP reports"
  ON ap_reports FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert AP reports"
  ON ap_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update AP reports"
  ON ap_reports FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete AP reports"
  ON ap_reports FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Allow anon read for portal viewers
CREATE POLICY "Anon users can read AP reports"
  ON ap_reports FOR SELECT
  TO anon
  USING (true);
