/*
  # Create awards_lanes table

  Stores customer award/lane records for the Fleet Files > Awards section.
  Each row represents a specific freight lane awarded to Meiborg by a customer,
  with origin/destination, pricing, and award type details.

  1. New Tables
    - `awards_lanes`
      - `id` (uuid, primary key)
      - `tab_id` (uuid) — links to the Awards portal tab
      - `customer` (text) — customer / shipper name
      - `carrier` (text) — carrier name (e.g. Meiborg Inc)
      - `scac` (text) — Standard Carrier Alpha Code
      - `lane_id` (text) — internal lane identifier
      - `origin_city` (text)
      - `origin_state` (text, 2-char)
      - `origin_zip` (text)
      - `dest_city` (text)
      - `dest_state` (text, 2-char)
      - `dest_zip` (text)
      - `mode` (text) — e.g. OTR, LTL
      - `equipment` (text) — e.g. RUCKLOAD, FLATBED
      - `rpm` (numeric) — rate per mile
      - `min_charge` (numeric) — minimum charge
      - `award_type` (text) — Primary or Backup
      - `annual_volume` (integer) — annual volume allocation (loads)
      - `annual_volume_pct` (numeric) — annual volume allocation percentage 0-100
      - `shipper_city` (text) — for transfer/detailed lane rows
      - `receiver_city` (text)
      - `miles` (integer)
      - `weekly_volume` (text) — e.g. "1 to 3", "5 to 10"
      - `rate` (numeric) — flat rate
      - `notes` (text)
      - `sort_order` (integer)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Anon can read, insert, update, delete (same open pattern as other dept tabs)
*/

CREATE TABLE IF NOT EXISTS awards_lanes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id uuid NOT NULL,
  customer text NOT NULL DEFAULT '',
  carrier text NOT NULL DEFAULT '',
  scac text NOT NULL DEFAULT '',
  lane_id text NOT NULL DEFAULT '',
  origin_city text NOT NULL DEFAULT '',
  origin_state text NOT NULL DEFAULT '',
  origin_zip text NOT NULL DEFAULT '',
  dest_city text NOT NULL DEFAULT '',
  dest_state text NOT NULL DEFAULT '',
  dest_zip text NOT NULL DEFAULT '',
  mode text NOT NULL DEFAULT 'OTR',
  equipment text NOT NULL DEFAULT '',
  rpm numeric(10,4),
  min_charge numeric(12,2),
  award_type text NOT NULL DEFAULT 'Primary',
  annual_volume integer NOT NULL DEFAULT 0,
  annual_volume_pct numeric(5,2) NOT NULL DEFAULT 0,
  shipper_city text NOT NULL DEFAULT '',
  receiver_city text NOT NULL DEFAULT '',
  miles integer,
  weekly_volume text NOT NULL DEFAULT '',
  rate numeric(12,2),
  notes text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE awards_lanes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read awards lanes"
  ON awards_lanes FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert awards lanes"
  ON awards_lanes FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update awards lanes"
  ON awards_lanes FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete awards lanes"
  ON awards_lanes FOR DELETE
  TO anon
  USING (true);
