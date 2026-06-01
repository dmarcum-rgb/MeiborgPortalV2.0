/*
  # Fix avatar storage policies

  The avatars bucket INSERT policy was missing a WITH CHECK clause and was
  restricted to authenticated users only. The admin panel uses the anon key,
  so uploads were silently failing (no error thrown but file never saved).

  Changes:
  - Drop and recreate INSERT policy to allow anon role with proper WITH CHECK
  - Drop and recreate UPDATE policy similarly
*/

DROP POLICY IF EXISTS "Authenticated avatar upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated avatar update" ON storage.objects;

CREATE POLICY "Allow avatar upload"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Allow avatar update"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'avatars')
  WITH CHECK (bucket_id = 'avatars');
