-- ============================================================
-- 001_user_data.sql
-- Run this once in Supabase SQL Editor:
--   Dashboard → SQL Editor → New Query → paste → Run
-- ============================================================

create table if not exists public.user_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.user_data enable row level security;

-- Policy: each user can only read/write their own row
create policy "Users can manage their own data"
  on public.user_data
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
