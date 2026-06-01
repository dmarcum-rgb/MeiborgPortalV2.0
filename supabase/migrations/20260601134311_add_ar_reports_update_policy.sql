/*
  # Add UPDATE policy for ar_reports

  The lock button calls UPDATE on ar_reports but no UPDATE policy existed,
  causing the update to silently fail. This adds the missing policy.
*/

CREATE POLICY "Authenticated users can update AR reports"
  ON ar_reports FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
