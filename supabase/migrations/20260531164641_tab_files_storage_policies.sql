/*
  # Storage policies for tab-files bucket

  Allow public read and anon write access to the tab-files storage bucket.
*/

CREATE POLICY "Public can read tab-files"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'tab-files');

CREATE POLICY "Anon can upload tab-files"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'tab-files');

CREATE POLICY "Anon can delete tab-files"
  ON storage.objects FOR DELETE
  TO anon
  USING (bucket_id = 'tab-files');
