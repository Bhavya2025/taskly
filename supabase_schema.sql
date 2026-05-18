-- ============================================================
-- Taskly – Supabase schema
-- Run this entire file in: Supabase dashboard → SQL Editor → New query → Run
-- ============================================================

-- Projects table
create table if not exists projects (
  id           text        primary key,
  user_id      uuid        references auth.users(id) on delete cascade not null,
  name         text        not null,
  emoji        text        default '📝',
  color        text        default '#6c63ff',
  theme        text,
  summary      text        default '',
  task_count   integer     default 0,
  tasks_done   integer     default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Board data table (stores full columns + tasks JSON per project)
create table if not exists board_data (
  project_id   text        primary key references projects(id) on delete cascade,
  user_id      uuid        references auth.users(id) on delete cascade not null,
  columns      jsonb       default '[]'::jsonb,
  tasks        jsonb       default '[]'::jsonb,
  updated_at   timestamptz default now()
);

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table projects   enable row level security;
alter table board_data enable row level security;

-- Users can only see and edit their own rows
create policy "projects: owner access"
  on projects for all
  using (auth.uid() = user_id);

create policy "board_data: owner access"
  on board_data for all
  using (auth.uid() = user_id);

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Enable Realtime on the projects table so deletions sync across browsers
alter publication supabase_realtime add table projects;

-- ============================================================
-- Done! Now go back to the app and sign up for the first time.
-- ============================================================
