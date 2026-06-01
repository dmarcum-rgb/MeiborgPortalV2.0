/*
  # Fix AP reports anon INSERT and DELETE policies

  The portal uses the anon key, but INSERT and DELETE were restricted to
  authenticated users only. This prevented uploads from saving at all,
  which also meant reportId was never set and locking had nothing to update.

  Changes:
  - Add anon INSERT policy on ap_reports
  - Add anon DELETE policy on ap_reports
*/

CREATE POLICY "Anon users can insert AP reports"
  ON ap_reports FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can delete AP reports"
  ON ap_reports FOR DELETE
  TO anon
  USING (true);
