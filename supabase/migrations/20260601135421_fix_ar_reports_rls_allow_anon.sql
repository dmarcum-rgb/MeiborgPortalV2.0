/*
  # Fix ar_reports RLS to allow anon access

  The portal uses a custom lock screen (not Supabase auth), so auth.uid() is
  always null. Replace all ar_reports policies with anon-accessible ones.
*/

DROP POLICY IF EXISTS "Authenticated users can delete AR reports" ON ar_reports;
DROP POLICY IF EXISTS "Authenticated users can insert AR reports" ON ar_reports;
DROP POLICY IF EXISTS "Authenticated users can read AR reports" ON ar_reports;
DROP POLICY IF EXISTS "Authenticated users can update AR reports" ON ar_reports;

CREATE POLICY "Anyone can read AR reports"
  ON ar_reports FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert AR reports"
  ON ar_reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update AR reports"
  ON ar_reports FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete AR reports"
  ON ar_reports FOR DELETE
  TO anon, authenticated
  USING (true);
