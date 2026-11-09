-- ============================================================
-- Home Stock (experimental) — Supabase setup. NO LOGIN: anyone who opens
-- /stock can see and change the stock list (by choice: family use only).
-- Run in Supabase Dashboard → SQL Editor → New Query → paste → Run.
-- Safe to run again (also upgrades the earlier login-based version).
-- Lifegrow's own table (user_data) and its login protection are not touched.
-- To remove everything again, run src/stock/supabase-remove.sql.
-- ============================================================

create table if not exists public.stock_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  quantity    integer not null default 0 check (quantity >= 0),
  photo_path  text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Upgrade from the earlier login-based version, if it was run before
-- (its rule must go before the column it uses).
drop policy if exists "stock_items_own"    on public.stock_items;
alter table public.stock_items drop column if exists owner_id;

-- Open to everyone (no login), but only this table.
alter table public.stock_items enable row level security;
drop policy if exists "stock_items_public" on public.stock_items;
create policy "stock_items_public" on public.stock_items
  for all to anon, authenticated
  using (true)
  with check (true);
grant select, insert, update, delete on public.stock_items to anon, authenticated;

-- Types tree (e.g. Shirt → Formal → Full sleeve), as deep as needed.
create table if not exists public.stock_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  parent_id   uuid references public.stock_categories(id) on delete restrict,
  created_at  timestamptz not null default now()
);
create index if not exists stock_categories_parent_idx on public.stock_categories (parent_id);

alter table public.stock_categories enable row level security;
drop policy if exists "stock_categories_public" on public.stock_categories;
create policy "stock_categories_public" on public.stock_categories
  for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.stock_categories to anon, authenticated;

-- Each item's type and optional details.
alter table public.stock_items add column if not exists category_id uuid references public.stock_categories(id) on delete set null;
alter table public.stock_items add column if not exists price  numeric(12, 2) check (price is null or price >= 0);
alter table public.stock_items add column if not exists size   text check (size  is null or char_length(size)  <= 40);
alter table public.stock_items add column if not exists color  text check (color is null or char_length(color) <= 40);
alter table public.stock_items add column if not exists notes  text check (notes is null or char_length(notes) <= 1000);
create index if not exists stock_items_category_idx on public.stock_items (category_id);

-- Family-wide settings (shared by every phone), e.g. "type is required".
create table if not exists public.stock_settings (
  key    text primary key,
  value  jsonb not null
);
alter table public.stock_settings enable row level security;
drop policy if exists "stock_settings_public" on public.stock_settings;
create policy "stock_settings_public" on public.stock_settings
  for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.stock_settings to anon, authenticated;

-- + / − buttons: change the count in one step on the server, so two phones
-- tapping at the same time both count, and it never goes below zero.
create or replace function public.stock_adjust(item_id uuid, delta integer)
returns public.stock_items
language sql
security invoker
set search_path = public
as $$
  update public.stock_items
     set quantity = greatest(quantity + delta, 0),
         updated_at = now()
   where id = item_id
  returning *;
$$;
grant execute on function public.stock_adjust(uuid, integer) to anon, authenticated;

-- Photos: a public bucket (anyone with a photo's link can view it), max 2 MB each.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stock-photos', 'stock-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true;

drop policy if exists "stock_photos_read"   on storage.objects;
drop policy if exists "stock_photos_insert" on storage.objects;
drop policy if exists "stock_photos_update" on storage.objects;
drop policy if exists "stock_photos_delete" on storage.objects;

create policy "stock_photos_read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'stock-photos');
create policy "stock_photos_insert" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'stock-photos');
create policy "stock_photos_update" on storage.objects for update to anon, authenticated
  using (bucket_id = 'stock-photos');
create policy "stock_photos_delete" on storage.objects for delete to anon, authenticated
  using (bucket_id = 'stock-photos');
