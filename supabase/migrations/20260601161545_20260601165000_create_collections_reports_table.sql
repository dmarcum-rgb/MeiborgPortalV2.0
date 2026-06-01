/*
  # Create collections_reports table

  1. New Tables
    - `collections_reports`
      - `id` (uuid, primary key)
      - `tab_id` (uuid, references portal_tabs)
      - `report_date` (text) — display date from the report header
      - `report_data` (jsonb) — array of customer collection records
      - `uploaded_by` (text) — name of the team member who uploaded
      - `locked` (boolean, default false) — prevents uploads when true
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS
    - Anon SELECT, INSERT, DELETE, UPDATE all permitted (same pattern as ap_reports / ar_reports)
      so the portal (which uses the anon key) can read, write, and toggle lock without auth
*/

CREATE TABLE IF NOT EXISTS collections_reports (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id     uuid NOT NULL,
  report_date text NOT NULL DEFAULT '',
  report_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  uploaded_by text NOT NULL DEFAULT '',
  locked      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE collections_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can select collections reports"
  ON collections_reports FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can insert collections reports"
  ON collections_reports FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can delete collections reports"
  ON collections_reports FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Anyone can update collections reports"
  ON collections_reports FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
