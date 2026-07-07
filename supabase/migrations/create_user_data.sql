-- Run this in Supabase Dashboard > SQL Editor

create table if not exists public.user_data (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  tasks    jsonb not null default '{}',
  habits   jsonb not null default '{}',
  settings jsonb not null default '{}'
);

alter table public.user_data enable row level security;

create policy "select_own" on public.user_data for select using (auth.uid() = user_id);
create policy "insert_own" on public.user_data for insert with check (auth.uid() = user_id);
create policy "update_own" on public.user_data for update using (auth.uid() = user_id);
create policy "delete_own" on public.user_data for delete using (auth.uid() = user_id);
