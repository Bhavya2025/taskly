-- ============================================================
-- Taskly – Project images migration
-- Run in Supabase dashboard → SQL Editor → New query → Run
-- ============================================================

-- 1. Add image_url column to projects table
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS image_url text DEFAULT NULL;

-- ============================================================
-- Storage bucket: "project-images"
-- Create in Supabase dashboard → Storage → New bucket
-- Name: project-images
-- Make it PUBLIC (toggle "Public bucket" on)
-- Then run the RLS policies below
-- ============================================================

-- 2. RLS policy: users can upload/update their own project images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname = 'project-images: owner upload'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "project-images: owner upload"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (
          bucket_id = 'project-images' AND
          (storage.foldername(name))[1] = auth.uid()::text
        )
    $pol$;
  END IF;
END $$;

-- 3. RLS policy: users can update their own project images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname = 'project-images: owner update'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "project-images: owner update"
        ON storage.objects FOR UPDATE
        TO authenticated
        USING (
          bucket_id = 'project-images' AND
          (storage.foldername(name))[1] = auth.uid()::text
        )
    $pol$;
  END IF;
END $$;

-- 4. RLS policy: users can delete their own project images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname = 'project-images: owner delete'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "project-images: owner delete"
        ON storage.objects FOR DELETE
        TO authenticated
        USING (
          bucket_id = 'project-images' AND
          (storage.foldername(name))[1] = auth.uid()::text
        )
    $pol$;
  END IF;
END $$;

-- 5. RLS policy: public read access (bucket is public)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname = 'project-images: public read'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "project-images: public read"
        ON storage.objects FOR SELECT
        TO public
        USING (bucket_id = 'project-images')
    $pol$;
  END IF;
END $$;
