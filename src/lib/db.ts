/**
 * db.ts – thin Supabase persistence helpers.
 *
 * Design:
 * - Module-level in-memory caches avoid redundant round-trips and race conditions
 *   when multiple hooks read/write the same column concurrently.
 * - All saves are debounced 500 ms so rapid state updates batch into one upsert.
 * - Every function is a no-op when Supabase is not configured or user is logged
 *   out, allowing localStorage fallback in hooks.
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// ─── helpers ─────────────────────────────────────────────────────────────────

async function getUser() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

// ─── FULL ROW CACHE ─────────────────────────────────────────────────────────

let fullDataCache: { tasks: any; habits: any; settings: any } | null = null;
let fetchPromise: Promise<typeof fullDataCache> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let isFetching = false;

async function fetchFullData() {
  if (fetchPromise) return fetchPromise;
  if (fullDataCache && !isFetching) return fullDataCache;
  if (!isSupabaseConfigured) return null;

  isFetching = true;
  console.log("[db.ts] Starting DB fetch for user data...");

  fetchPromise = (async () => {
    try {
      const user = await getUser();
      if (!user) {
        console.log("[db.ts] No authenticated user found.");
        return null;
      }
      console.log("[db.ts] Authenticated User ID:", user.id);
      
      const { data, error } = await supabase
        .from("user_data")
        .select("tasks, habits, settings")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      
      console.log("[db.ts] SELECT query result:", data);

      // Merge so we don't overwrite any synchronous saves that happened during fetch
      fullDataCache = {
        tasks: data?.tasks ?? fullDataCache?.tasks ?? {},
        habits: data?.habits ?? fullDataCache?.habits ?? {},
        settings: data?.settings ?? fullDataCache?.settings ?? {}
      };
      
      console.log("[db.ts] fetchFullData() output cache populated:", fullDataCache);
      return fullDataCache;
    } catch (err) {
      console.error("[db.ts] Supabase fetch error:", err);
      return null;
    } finally {
      fetchPromise = null;
      isFetching = false;
    }
  })();

  return fetchPromise;
}

function triggerSave() {
  if (!isSupabaseConfigured) return;
  if (saveTimer) clearTimeout(saveTimer);
  
  saveTimer = setTimeout(async () => {
    try {
      const user = await getUser();
      if (!user || !fullDataCache) return;
      console.log("[db.ts] Executing debounced save for user_id:", user.id);
      const { error } = await supabase
        .from("user_data")
        .upsert({ 
          user_id: user.id, 
          tasks: fullDataCache.tasks,
          habits: fullDataCache.habits,
          settings: fullDataCache.settings
        }, { onConflict: "user_id" });
      if (error) throw error;
      console.log("[db.ts] Save successful.");
    } catch (err) {
      console.error("[db.ts] Supabase upsert error:", err);
    }
  }, 500);
}

// ─── TASKS ───────────────────────────────────────────────────────────────────

export async function fetchTasks(): Promise<Record<string, unknown[]> | null> {
  const data = await fetchFullData();
  return data ? data.tasks : null;
}

export function saveTasks(workspace: string, tasks: unknown[]): void {
  if (!isSupabaseConfigured) return;
  if (!fullDataCache) {
    fullDataCache = { tasks: {}, habits: {}, settings: {} };
  }
  fullDataCache.tasks[workspace] = tasks;
  triggerSave();
}

export function clearTasksCache() {
  fullDataCache = null;
}

// ─── HABITS ──────────────────────────────────────────────────────────────────

export async function fetchHabits(): Promise<unknown | null> {
  const data = await fetchFullData();
  return data ? data.habits : null;
}

export function saveHabits(store: unknown): void {
  if (!isSupabaseConfigured) return;
  if (!fullDataCache) {
    fullDataCache = { tasks: {}, habits: {}, settings: {} };
  }
  fullDataCache.habits = store;
  triggerSave();
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────

export async function fetchSettings(): Promise<Record<string, unknown> | null> {
  const data = await fetchFullData();
  return data ? data.settings : null;
}

export function saveSetting(key: string, value: unknown): void {
  if (!isSupabaseConfigured) return;
  if (!fullDataCache) {
    fullDataCache = { tasks: {}, habits: {}, settings: {} };
  }
  fullDataCache.settings[key] = value;
  triggerSave();
}

export function clearSettingsCache() {
  fullDataCache = null;
}
