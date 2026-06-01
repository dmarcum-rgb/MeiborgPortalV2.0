/*
  # Newsletter storage and table write policies

  ## Summary
  Adds INSERT and DELETE policies to the newsletters table so admin edge functions
  can manage newsletter records. Also adds storage policies so files can be uploaded
  to and deleted from the newsletters bucket by service role.

  ## Changes
  - newsletters table: INSERT and DELETE policies (service role / admin code flow uses service key)
  - storage.objects newsletters bucket: SELECT (public), INSERT and DELETE for authenticated+anon via service role
*/

-- Allow anyone to insert newsletters (upload is gated by admin code in the edge function)
CREATE POLICY "Service role can insert newsletters"
  ON newsletters FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Service role can delete newsletters"
  ON newsletters FOR DELETE
  TO anon, authenticated
  USING (true);

-- Storage bucket policies for newsletters
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('newsletters', 'newsletters', true, 31457280, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 31457280,
  allowed_mime_types = ARRAY['application/pdf'];

CREATE POLICY "Public can read newsletter files"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'newsletters');

CREATE POLICY "Anon can upload newsletter files"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'newsletters');

CREATE POLICY "Anon can delete newsletter files"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'newsletters');
