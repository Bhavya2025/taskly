-- ============================================================
-- Taskly – Trash system migration
-- Run in Supabase dashboard → SQL Editor → New query → Run
-- ============================================================

-- 1. Add soft-delete column
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- 2. REPLICA IDENTITY FULL — makes Realtime send the FULL old row on UPDATE and DELETE
--    This is required so Realtime filters work correctly and we get user_id in all events
ALTER TABLE projects REPLICA IDENTITY FULL;

-- 3. Make sure the projects table is in the Realtime publication
--    (safe to run even if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'projects'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE projects;
  END IF;
END $$;
