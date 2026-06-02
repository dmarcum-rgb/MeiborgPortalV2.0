/*
  # Create carrier_pay_reports table

  1. New Tables
    - `carrier_pay_reports`
      - `id` (uuid, primary key)
      - `tab_id` (text, not null) — portal tab this report belongs to
      - `pulled_at` (text) — human-readable timestamp of when data was pulled
      - `report_data` (jsonb) — array of CarrierPayee objects
      - `pulled_by` (text) — name of user who pulled
      - `created_at` (timestamptz, default now())
  2. Security
    - Enable RLS
    - Anon can select, insert, delete (same pattern as ap_reports)
*/

CREATE TABLE IF NOT EXISTS carrier_pay_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id text NOT NULL,
  pulled_at text NOT NULL DEFAULT '',
  report_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  pulled_by text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE carrier_pay_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select carrier pay reports"
  ON carrier_pay_reports FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert carrier pay reports"
  ON carrier_pay_reports FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can delete carrier pay reports"
  ON carrier_pay_reports FOR DELETE
  TO anon
  USING (true);
