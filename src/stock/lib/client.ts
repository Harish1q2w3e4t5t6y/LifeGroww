// Home Stock has no login: it talks to Supabase as a public visitor. It uses
// its own client with no saved session, so a Lifegrow login on the same phone
// is never touched or sent along.
import { createClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL as string) || "";
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "";

export const stockConfigured = !!(url && anonKey);

export const stockSupabase = stockConfigured
  ? createClient(url, anonKey, {
      auth: { storageKey: "home-stock.auth", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : (null as unknown as ReturnType<typeof createClient>);
