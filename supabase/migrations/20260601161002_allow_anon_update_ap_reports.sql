/*
  # Allow anon users to update AP reports (lock/unlock)

  The portal uses the anon key, so the existing authenticated-only UPDATE
  policy blocks lock toggling. This matches the AR reports behavior.
*/

CREATE POLICY "Anon users can update AP reports"
  ON ap_reports
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
