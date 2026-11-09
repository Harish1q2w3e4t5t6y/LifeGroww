-- ============================================================
-- Arumugam Stock (experimental) — remove everything from Supabase.
-- First empty the photos: Dashboard → Storage → stock-photos → select all → Delete
-- (Supabase does not allow deleting stored files from SQL). Then run this.
-- Lifegrow's own table (user_data) is not touched.
-- ============================================================
drop policy if exists "stock_photos_read"   on storage.objects;
drop policy if exists "stock_photos_insert" on storage.objects;
drop policy if exists "stock_photos_update" on storage.objects;
drop policy if exists "stock_photos_delete" on storage.objects;
delete from storage.buckets where id = 'stock-photos';
drop function if exists public.stock_adjust(uuid, integer);
drop function if exists public.stock_adjust_variant(uuid, integer);
drop table if exists public.stock_variants;
drop table if exists public.stock_items;
drop table if exists public.stock_categories;
drop table if exists public.stock_settings;
