-- ============================================================
-- Taskly – User profiles schema (run AFTER supabase_schema.sql)
-- Supabase dashboard → SQL Editor → New query → Run
-- ============================================================

create table if not exists user_profiles (
  user_id        uuid        primary key references auth.users(id) on delete cascade,
  display_name   text        default '',
  avatar_animal  text        default 'cat',
  avatar_color   text        default '#6c63ff',
  global_theme   text        default 'dark',
  sound_enabled  boolean     default true,
  updated_at     timestamptz default now()
);

alter table user_profiles enable row level security;

create policy "profiles: owner access"
  on user_profiles for all
  using (auth.uid() = user_id);
