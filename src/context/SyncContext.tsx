import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "./AuthContext";
import type { Task } from "@/lib/types";
import type { Store as HabitsStore } from "@/lib/habit-store";

export type SyncStatus = "synced" | "syncing" | "pending" | "failed";

interface SyncContextType {
  tasks: Record<string, Task[]>;
  habits: HabitsStore;
  settings: Record<string, unknown>;
  syncStatus: SyncStatus;
  lastSyncTime: Date | null;
  lastError: string | null;
  isOnline: boolean;
  pendingOps: string[];
  
  updateTasks: (workspace: string, newTasks: Task[]) => Promise<void>;
  updateHabits: (newHabits: HabitsStore) => Promise<void>;
  updateSetting: (key: string, value: unknown) => Promise<void>;
  forceSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

// LocalStorage Keys
const KEYS = {
  tasks: (w: string) => `eisenhower.tasks.v1:${w}`,
  habits: "habitgame:v1",
  settings: "eisenhower.appSettings.v1",
  workspace: "eisenhower.workspace.v1",
  theme: "eisenhower.theme",
  dirty: "eisenhower.sync.dirty",
  lastSync: "eisenhower.sync.lastSyncTime"
};

// Robust error string extractor
const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as any).message);
  }
  return String(err);
};

// Initial states loading from LocalStorage
const loadLocalTasks = (): Record<string, Task[]> => {
  const personalRaw = localStorage.getItem(KEYS.tasks("personal"));
  const professionalRaw = localStorage.getItem(KEYS.tasks("professional"));
  return {
    personal: personalRaw ? JSON.parse(personalRaw) : [],
    professional: professionalRaw ? JSON.parse(professionalRaw) : []
  };
};

const loadLocalHabits = (): HabitsStore => {
  const raw = localStorage.getItem(KEYS.habits);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return { months: {}, theme: "dark" };
    }
  }
  return { months: {}, theme: "dark" };
};

const loadLocalSettings = (): Record<string, unknown> => {
  const appSettingsRaw = localStorage.getItem(KEYS.settings);
  const workspaceRaw = localStorage.getItem(KEYS.workspace);
  const themeRaw = localStorage.getItem(KEYS.theme);
  
  const appSettings = appSettingsRaw ? JSON.parse(appSettingsRaw) : { accent: "blue", reportLayout: "compact", showCompleted: true };
  const workspace = workspaceRaw === "personal" ? "personal" : "professional";
  const theme = themeRaw === "light" || themeRaw === "dark" ? themeRaw : "dark";
  
  return {
    appSettings,
    workspace,
    theme
  };
};

const loadLocalDirty = (): Record<string, boolean> => {
  const raw = localStorage.getItem(KEYS.dirty);
  return raw ? JSON.parse(raw) : { tasks: false, habits: false, settings: false };
};

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  // App States
  const [tasks, setTasksState] = useState<Record<string, Task[]>>(() => loadLocalTasks());
  const [habits, setHabitsState] = useState<HabitsStore>(() => loadLocalHabits());
  const [settings, setSettingsState] = useState<Record<string, unknown>>(() => loadLocalSettings());
  
  // Sync Status States
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => {
    const raw = localStorage.getItem(KEYS.lastSync);
    return raw ? new Date(raw) : null;
  });
  const [lastError, setLastError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== "undefined" ? navigator.onLine : true);
  
  // Dirty queue in ref and storage to track synchronization tasks
  const dirtyRef = useRef<Record<string, boolean>>(loadLocalDirty());
  const syncInProgress = useRef<boolean>(false);
  const retryTimer = useRef<number | null>(null);

  // Refs to store the latest state, allowing callbacks to bypass dependency rebuild loops
  const tasksRef = useRef(tasks);
  const habitsRef = useRef(habits);
  const settingsRef = useRef(settings);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { habitsRef.current = habits; }, [habits]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Update localStorage dirty flags
  const setDirty = (key: "tasks" | "habits" | "settings", val: boolean) => {
    dirtyRef.current = { ...dirtyRef.current, [key]: val };
    localStorage.setItem(KEYS.dirty, JSON.stringify(dirtyRef.current));
    
    // Update visual sync state
    const hasDirty = Object.values(dirtyRef.current).some(v => v);
    if (hasDirty) {
      setSyncStatus(prev => prev === "syncing" ? "syncing" : "pending");
    } else {
      setSyncStatus("synced");
    }
  };

  const getPendingOps = useCallback(() => {
    const ops: string[] = [];
    if (dirtyRef.current.tasks) ops.push("Tasks");
    if (dirtyRef.current.habits) ops.push("Habits");
    if (dirtyRef.current.settings) ops.push("Settings / Preferences");
    return ops;
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saveStateToLocal = (key: "tasks" | "habits" | "settings", data: any) => {
    if (key === "tasks") {
      localStorage.setItem(KEYS.tasks("personal"), JSON.stringify(data.personal || []));
      localStorage.setItem(KEYS.tasks("professional"), JSON.stringify(data.professional || []));
    } else if (key === "habits") {
      localStorage.setItem(KEYS.habits, JSON.stringify(data));
    } else if (key === "settings") {
      if (data.appSettings) localStorage.setItem(KEYS.settings, JSON.stringify(data.appSettings));
      if (data.workspace) localStorage.setItem(KEYS.workspace, data.workspace);
      if (data.theme) localStorage.setItem(KEYS.theme, data.theme);
    }
  };

  // Sync state to Supabase
  const pushToSupabase = useCallback(async (userId: string) => {
    if (syncInProgress.current || !isOnline || !isSupabaseConfigured) return;
    
    const keysToSync = Object.keys(dirtyRef.current).filter(k => dirtyRef.current[k]) as Array<"tasks" | "habits" | "settings">;
    if (keysToSync.length === 0) return;
    
    syncInProgress.current = true;
    setSyncStatus("syncing");
    setLastError(null);

    try {
      const payload: Record<string, unknown> = { user_id: userId };
      
      // Load current values via stable references
      payload.tasks = tasksRef.current;
      payload.habits = habitsRef.current;
      payload.settings = settingsRef.current;

      const { error } = await supabase
        .from("user_data")
        .upsert(payload, { onConflict: "user_id" });

      if (error) {
        throw error;
      }

      keysToSync.forEach(k => setDirty(k, false));
      setSyncStatus("synced");
      const now = new Date();
      setLastSyncTime(now);
      localStorage.setItem(KEYS.lastSync, now.toISOString());
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err);
      console.error("[SyncEngine] ❌ Sync failed:", errMsg);
      setSyncStatus("failed");
      setLastError(errMsg || "Network or server failure");
    } finally {
      syncInProgress.current = false;
    }
  }, [isOnline]);

  // Sync queue runner logic
  useEffect(() => {
    if (user && isOnline) {
      const hasDirty = Object.values(dirtyRef.current).some(v => v);
      if (hasDirty) {
        pushToSupabase(user.id);
      }
    }
  }, [user, isOnline, pushToSupabase]);

  // Connection status listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus("pending");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Periodic retry loop when failed or pending
  useEffect(() => {
    const startRetryTimer = () => {
      retryTimer.current = window.setInterval(() => {
        if (user && isOnline && !syncInProgress.current) {
          const hasDirty = Object.values(dirtyRef.current).some(v => v);
          if (hasDirty) {
            pushToSupabase(user.id);
          }
        }
      }, 5000);
    };

    startRetryTimer();

    return () => {
      if (retryTimer.current) window.clearInterval(retryTimer.current);
    };
  }, [user, isOnline, pushToSupabase]);

  // Pull initial state from Supabase on startup / user login
  useEffect(() => {
    const pullFromSupabase = async (userId: string) => {
      if (!isSupabaseConfigured) return;
      
      try {
        const { data, error } = await supabase
          .from("user_data")
          .select("tasks, habits, settings")
          .eq("user_id", userId)
          .maybeSingle();
        
        if (error) throw error;
        
        if (data) {
          const localDirty = dirtyRef.current;
          
          setTasksState(prev => {
            const next = localDirty.tasks ? prev : (data.tasks || { personal: [], professional: [] });
            saveStateToLocal("tasks", next);
            return next;
          });
          
          setHabitsState(prev => {
            const next = localDirty.habits ? prev : (data.habits || { months: {}, theme: "dark" });
            saveStateToLocal("habits", next);
            return next;
          });
          
          setSettingsState(prev => {
            const next = localDirty.settings ? prev : (data.settings || loadLocalSettings());
            saveStateToLocal("settings", next);
            return next;
          });

          if (!localDirty.tasks && !localDirty.habits && !localDirty.settings) {
            setSyncStatus("synced");
          }
          const now = new Date();
          setLastSyncTime(now);
          localStorage.setItem(KEYS.lastSync, now.toISOString());
        } else {
          setDirty("tasks", true);
          setDirty("habits", true);
          setDirty("settings", true);
        }
      } catch (err: unknown) {
        const errMsg = getErrorMessage(err);
        console.error("[SyncEngine] ❌ Load remote data failed:", errMsg);
        setSyncStatus("failed");
        setLastError(errMsg || "Failed to load remote data");
      }
    };

    const userId = user?.id;
    if (userId) {
      pullFromSupabase(userId);
    } else {
      setTasksState({ personal: [], professional: [] });
      setHabitsState({ months: {}, theme: "dark" });
      setSettingsState({ appSettings: { accent: "blue", reportLayout: "compact", showCompleted: true }, workspace: "professional", theme: "dark" });
    }
  }, [user?.id]);

  // Mutation Methods
  const updateTasks = useCallback(async (workspace: string, newTasks: Task[]) => {
    const updatedTasks = { ...tasksRef.current, [workspace]: newTasks };
    
    if (!isOnline || !user) {
      setTasksState(updatedTasks);
      saveStateToLocal("tasks", updatedTasks);
      setDirty("tasks", true);
      return;
    }

    setSyncStatus("syncing");
    setLastError(null);
    try {
      const payload = {
        user_id: user.id,
        tasks: updatedTasks,
        habits: habitsRef.current,
        settings: settingsRef.current
      };
      const { error } = await supabase
        .from("user_data")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;

      setTasksState(updatedTasks);
      saveStateToLocal("tasks", updatedTasks);
      setDirty("tasks", false);
      setSyncStatus("synced");
      setLastSyncTime(new Date());
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err);
      console.warn("[SyncEngine] Server tasks write failed, falling back to pending sync...", errMsg);
      setTasksState(updatedTasks);
      saveStateToLocal("tasks", updatedTasks);
      setDirty("tasks", true);
      setSyncStatus("failed");
      setLastError(errMsg || "Write failed, cached locally");
    }
  }, [isOnline, user]);

  const updateHabits = useCallback(async (newHabits: HabitsStore) => {
    if (!isOnline || !user) {
      setHabitsState(newHabits);
      saveStateToLocal("habits", newHabits);
      setDirty("habits", true);
      return;
    }

    setSyncStatus("syncing");
    setLastError(null);
    try {
      const payload = {
        user_id: user.id,
        tasks: tasksRef.current,
        habits: newHabits,
        settings: settingsRef.current
      };
      const { error } = await supabase
        .from("user_data")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;

      setHabitsState(newHabits);
      saveStateToLocal("habits", newHabits);
      setDirty("habits", false);
      setSyncStatus("synced");
      setLastSyncTime(new Date());
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err);
      console.warn("[SyncEngine] Server habits write failed, falling back to pending sync...", errMsg);
      setHabitsState(newHabits);
      saveStateToLocal("habits", newHabits);
      setDirty("habits", true);
      setSyncStatus("failed");
      setLastError(errMsg || "Write failed, cached locally");
    }
  }, [isOnline, user]);

  const updateSetting = useCallback(async (key: string, value: unknown) => {
    const updatedSettings = { ...settingsRef.current, [key]: value };
    
    if (!isOnline || !user) {
      setSettingsState(updatedSettings);
      saveStateToLocal("settings", updatedSettings);
      setDirty("settings", true);
      return;
    }

    setSyncStatus("syncing");
    setLastError(null);
    try {
      const payload = {
        user_id: user.id,
        tasks: tasksRef.current,
        habits: habitsRef.current,
        settings: updatedSettings
      };
      const { error } = await supabase
        .from("user_data")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;

      setSettingsState(updatedSettings);
      saveStateToLocal("settings", updatedSettings);
      setDirty("settings", false);
      setSyncStatus("synced");
      setLastSyncTime(new Date());
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err);
      console.warn("[SyncEngine] Server settings write failed, falling back to pending sync...", errMsg);
      setSettingsState(updatedSettings);
      saveStateToLocal("settings", updatedSettings);
      setDirty("settings", true);
      setSyncStatus("failed");
      setLastError(errMsg || "Write failed, cached locally");
    }
  }, [isOnline, user]);

  const forceSync = async () => {
    if (user && isOnline && !syncInProgress.current) {
      await pushToSupabase(user.id);
    }
  };

  return (
    <SyncContext.Provider
      value={{
        tasks,
        habits,
        settings,
        syncStatus,
        lastSyncTime,
        lastError,
        isOnline,
        pendingOps: getPendingOps(),
        updateTasks,
        updateHabits,
        updateSetting,
        forceSync
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error("useSync must be used within a SyncProvider");
  }
  return context;
};
