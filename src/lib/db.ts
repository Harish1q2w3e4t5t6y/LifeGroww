import { supabase, isSupabaseConfigured } from "@/lib/supabase";

async function getUser() {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error("[db.ts] [Auth] Error getting user:", error.message);
      return null;
    }
    return data.user ?? null;
  } catch (err) {
    console.error("[db.ts] [Auth] Exception in getUser:", err);
    return null;
  }
}

export async function fetchTasks(): Promise<Record<string, unknown[]> | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const user = await getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("user_data")
      .select("tasks")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[db.ts] [SELECT] [Failure] Error fetching tasks:", error.message);
      throw error;
    }
    return data?.tasks ? (data.tasks as Record<string, unknown[]>) : null;
  } catch {
    return null;
  }
}

export async function saveTasks(workspace: string, tasks: unknown[]): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const user = await getUser();
    if (!user) return;

    // Fetch existing first to avoid overwriting other workspaces
    const { data, error: fetchError } = await supabase
      .from("user_data")
      .select("tasks")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) {
      console.error("[db.ts] [UPDATE] [Failure] Error fetching existing tasks:", fetchError.message);
      throw fetchError;
    }

    const currentTasks = (data?.tasks as Record<string, unknown[]>) || {};
    const nextTasks = { ...currentTasks, [workspace]: tasks };

    const { error } = await supabase
      .from("user_data")
      .upsert({ user_id: user.id, tasks: nextTasks }, { onConflict: "user_id" });

    if (error) {
      console.error("[db.ts] [UPDATE] [Failure] Error saving tasks:", error.message);
      throw error;
    }
  } catch (err) {
    console.error("[db.ts] [UPDATE] [Failure] Save tasks error:", err);
  }
}

export async function fetchHabits(): Promise<unknown | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const user = await getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("user_data")
      .select("habits")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[db.ts] [SELECT] [Failure] Error fetching habits:", error.message);
      throw error;
    }
    return data?.habits ?? null;
  } catch {
    return null;
  }
}

export async function saveHabits(store: unknown): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const user = await getUser();
    if (!user) return;

    const { error } = await supabase
      .from("user_data")
      .upsert({ user_id: user.id, habits: store }, { onConflict: "user_id" });

    if (error) {
      console.error("[db.ts] [UPDATE] [Failure] Error saving habits:", error.message);
      throw error;
    }
  } catch (err) {
    console.error("[db.ts] [UPDATE] [Failure] Save habits error:", err);
  }
}

export async function fetchSettings(): Promise<Record<string, unknown> | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const user = await getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("user_data")
      .select("settings")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[db.ts] [SELECT] [Failure] Error fetching settings:", error.message);
      throw error;
    }
    return data?.settings ? (data.settings as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const user = await getUser();
    if (!user) return;

    // Fetch existing first to merge settings
    const { data, error: fetchError } = await supabase
      .from("user_data")
      .select("settings")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) {
      console.error("[db.ts] [UPDATE] [Failure] Error fetching existing settings:", fetchError.message);
      throw fetchError;
    }

    const currentSettings = (data?.settings as Record<string, unknown>) || {};
    const nextSettings = { ...currentSettings, [key]: value };

    const { error } = await supabase
      .from("user_data")
      .upsert({ user_id: user.id, settings: nextSettings }, { onConflict: "user_id" });

    if (error) {
      console.error("[db.ts] [UPDATE] [Failure] Error saving setting:", error.message);
      throw error;
    }
  } catch (err) {
    console.error("[db.ts] [UPDATE] [Failure] Save setting error:", err);
  }
}

export function clearTasksCache() {}
export function clearSettingsCache() {}
