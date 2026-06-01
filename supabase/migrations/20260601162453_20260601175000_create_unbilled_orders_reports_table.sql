/*
  # Create unbilled_orders_reports table

  1. New Tables
    - `unbilled_orders_reports`
      - `id` (uuid, primary key)
      - `tab_id` (uuid, references portal_tabs)
      - `report_date` (text) — display date from the report header
      - `report_data` (jsonb) — array of parsed order objects
      - `uploaded_by` (text) — uploader name
      - `locked` (boolean, default false)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Anon SELECT, INSERT, UPDATE, DELETE all permitted
      (same pattern as ar_reports, ap_reports, collections_reports)
*/

CREATE TABLE IF NOT EXISTS unbilled_orders_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id      uuid NOT NULL,
  report_date text NOT NULL DEFAULT '',
  report_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  uploaded_by text NOT NULL DEFAULT '',
  locked      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE unbilled_orders_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can select unbilled orders reports"
  ON unbilled_orders_reports FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can insert unbilled orders reports"
  ON unbilled_orders_reports FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can delete unbilled orders reports"
  ON unbilled_orders_reports FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Anyone can update unbilled orders reports"
  ON unbilled_orders_reports FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
