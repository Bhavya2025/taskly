-- ============================================================
-- Taskly – Avatar storage schema
-- Run in Supabase dashboard → SQL Editor → New query → Run
-- ALSO: Go to Storage → New bucket → name "avatars" → toggle Public ON
-- ============================================================

-- 1. Add avatar_url column to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT NULL;

-- 2. Storage bucket RLS policies (run after creating the "avatars" bucket)
--    Allow each user to manage only their own folder

-- Allow authenticated users to upload/update their own avatar
CREATE POLICY "avatars: owner upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars: owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars: owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow anyone to read avatars (public bucket, still good to have explicit policy)
CREATE POLICY "avatars: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
