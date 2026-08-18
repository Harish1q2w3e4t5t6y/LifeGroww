# Supabase

## Client Initialization (`src/lib/supabase.ts`)

The Supabase client is initialized using environment variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The file checks for the existence of these variables and exports a boolean flag `isSupabaseConfigured`. If the configuration is missing, the client instance is strongly typed but initialized as `null`, and the app gracefully downgrades to local-storage-only behavior.

## Row Level Security (RLS)

While not explicitly detailed in the front-end code, the schema design implicitly requires Row Level Security (RLS) on the `user_data` table.

A typical RLS policy for this table would be:
```sql
-- Allow users to SELECT their own row
create policy "Users can view own user_data"
  on user_data for select
  using ( auth.uid() = user_id );

-- Allow users to INSERT/UPDATE their own row
create policy "Users can update own user_data"
  on user_data for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own user_data"
  on user_data for update
  using ( auth.uid() = user_id );
```

## Environment Variables
The application expects the following in a `.env` or `.env.local` file:
```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```
Without these, the application cannot authenticate users or perform cloud synchronization.
