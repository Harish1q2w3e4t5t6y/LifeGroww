import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "./AuthContext";
import type { Task, RecurringConfig } from "@/lib/types";
import type { Store as HabitsStore } from "@/lib/habit-store";
import {
  generateScheduledTasks,
  syncTaskCompletionToHabits,
  syncHabitCompletionToTasks,
  toLocalDateString,
} from "@/lib/recurring-engine";

export type SyncStatus = "loading" | "saving" | "synced" | "failed" | "offline" | "retry";

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
    return String((err as Record<string, unknown>).message);
  }
  return String(err);
};

const loadLocalDirty = (): Record<string, boolean> => {
  const raw = localStorage.getItem(KEYS.dirty);
  return raw ? JSON.parse(raw) : { tasks: false, habits: false, settings: false };
};

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  // App States initialized to clean defaults (localStorage reads bypassed as primary source of truth)
  const [tasks, setTasksState] = useState<Record<string, Task[]>>({ personal: [], professional: [] });
  const [habits, setHabitsState] = useState<HabitsStore>({ months: {}, theme: "dark" });
  const [settings, setSettingsState] = useState<Record<string, unknown>>({
    appSettings: { accent: "blue", reportLayout: "compact", showCompleted: true },
    workspace: "professional",
    theme: "dark"
  });
  
  // Sync Status States
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => {
    const raw = localStorage.getItem(KEYS.lastSync);
    return raw ? new Date(raw) : null;
  });
  const [lastError, setLastError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== "undefined" ? navigator.onLine : true);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  
  // Dirty queue in ref and storage to track synchronization tasks for offline mode
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
  };

  const getPendingOps = useCallback(() => {
    const ops: string[] = [];
    if (dirtyRef.current.tasks) ops.push("Tasks");
    if (dirtyRef.current.habits) ops.push("Habits");
    if (dirtyRef.current.settings) ops.push("Settings / Preferences");
    return ops;
  }, []);

  // Update local storage representation of clean state (only as a backup cache)
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
    setSyncStatus("retry");
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

  // Sync queue runner logic (only triggers when online and initialized)
  useEffect(() => {
    if (user && isOnline && isInitialized) {
      const hasDirty = Object.values(dirtyRef.current).some(v => v);
      if (hasDirty) {
        pushToSupabase(user.id);
      }
    }
  }, [user, isOnline, pushToSupabase, isInitialized]);

  // Connection status listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus("offline");
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
        if (user && isOnline && !syncInProgress.current && isInitialized) {
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
  }, [user, isOnline, pushToSupabase, isInitialized]);

  // Pull initial state from Supabase on startup / user login (Server-First Load)
  useEffect(() => {
    const pullFromSupabase = async (userId: string) => {
      if (!isSupabaseConfigured) {
        setIsInitialized(true);
        return;
      }
      setSyncStatus("loading");
      
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
            const next = localDirty.settings ? prev : (data.settings || { appSettings: { accent: "blue", reportLayout: "compact", showCompleted: true }, workspace: "professional", theme: "dark" });
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
          // Row does not exist: Initialize React states to defaults.
          // STARTUP SAFETY: DO NOT WRITE (NO UPDATE, NO UPSERT, NO SAVE) during startup.
          setTasksState({ personal: [], professional: [] });
          setHabitsState({ months: {}, theme: "dark" });
          setSettingsState({ appSettings: { accent: "blue", reportLayout: "compact", showCompleted: true }, workspace: "professional", theme: "dark" });
          setSyncStatus("synced");
        }
      } catch (err: unknown) {
        const errMsg = getErrorMessage(err);
        console.error("[SyncEngine] ❌ Load remote data failed:", errMsg);
        setSyncStatus("failed");
        setLastError(errMsg || "Failed to load remote data");
      } finally {
        setIsInitialized(true);
      }
    };

    const userId = user?.id;
    if (userId) {
      setIsInitialized(false);
      pullFromSupabase(userId);
    } else {
      setTasksState({ personal: [], professional: [] });
      setHabitsState({ months: {}, theme: "dark" });
      setSettingsState({ appSettings: { accent: "blue", reportLayout: "compact", showCompleted: true }, workspace: "professional", theme: "dark" });
      setIsInitialized(true);
    }
  }, [user?.id]);

  // Mutation Methods - Wait-for-Server confirmation before updating local state when online
  const updateTasks = useCallback(async (workspace: string, newTasks: Task[]) => {
    if (!isInitialized) return;

    let updatedHabits = habitsRef.current;
    let habitsChanged = false;

    const oldTasksList = tasksRef.current[workspace] || [];
    const configs = Array.isArray(settingsRef.current.recurringConfigs) ? (settingsRef.current.recurringConfigs as RecurringConfig[]) : [];

    if (configs.length > 0) {
      for (const newTask of newTasks) {
        if (newTask.recurringConfigId) {
          const oldTask = oldTasksList.find((t) => t.id === newTask.id);
          const oldCompleted = oldTask ? oldTask.completed : false;
          if (newTask.completed !== oldCompleted) {
            const res = syncTaskCompletionToHabits(newTask, newTask.completed, updatedHabits, configs);
            if (res.changed) {
              updatedHabits = res.updatedHabits;
              habitsChanged = true;
            }
          }
        }
      }
    }

    const updatedTasks = { ...tasksRef.current, [workspace]: newTasks };

    // 1. If Offline: update local state immediately and queue dirty flag
    if (!isOnline || !user) {
      setTasksState(updatedTasks);
      saveStateToLocal("tasks", updatedTasks);
      setDirty("tasks", true);
      if (habitsChanged) {
        setHabitsState(updatedHabits);
        saveStateToLocal("habits", updatedHabits);
        setDirty("habits", true);
      }
      setSyncStatus("offline");
      return;
    }

    // 2. If Online: Attempt server update FIRST. Wait for Supabase response before updating UI.
    setSyncStatus("saving");
    setLastError(null);
    try {
      const payload = {
        user_id: user.id,
        tasks: updatedTasks,
        habits: updatedHabits,
        settings: settingsRef.current
      };
      
      const { error } = await supabase
        .from("user_data")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;

      // Confirmed by server: update state & local cache
      setTasksState(updatedTasks);
      saveStateToLocal("tasks", updatedTasks);
      setDirty("tasks", false);

      if (habitsChanged) {
        setHabitsState(updatedHabits);
        saveStateToLocal("habits", updatedHabits);
        setDirty("habits", false);
      }

      setSyncStatus("synced");
      setLastSyncTime(new Date());
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err);
      console.warn("[SyncEngine] Server tasks write failed:", errMsg);
      setSyncStatus("failed");
      setLastError(errMsg || "Write failed");
    }
  }, [isOnline, user, isInitialized]);

  const updateHabits = useCallback(async (newHabits: HabitsStore) => {
    if (!isInitialized) return;
    
    let updatedTasks = { ...tasksRef.current };
    let tasksChanged = false;
    const configs = Array.isArray(settingsRef.current.recurringConfigs) ? (settingsRef.current.recurringConfigs as RecurringConfig[]) : [];

    if (configs.length > 0) {
      const oldHabits = habitsRef.current;
      const newMonths = newHabits.months || {};
      const oldMonths = oldHabits.months || {};

      for (const monthKey of Object.keys(newMonths)) {
        const newMonth = newMonths[monthKey] || { days: {} };
        const oldMonth = oldMonths[monthKey] || { days: {} };

        for (const dayStr of Object.keys(newMonth.days || {})) {
          const day = parseInt(dayStr);
          const newDay = newMonth.days[day] || { checks: {} };
          const oldDay = oldMonth.days[day] || { checks: {} };

          const newChecks = newDay.checks || {};
          const oldChecks = oldDay.checks || {};

          for (const habitId of Object.keys(newChecks)) {
            if (newChecks[habitId] !== oldChecks[habitId]) {
              const res = syncHabitCompletionToTasks(
                habitId,
                day,
                monthKey,
                !!newChecks[habitId],
                updatedTasks,
                configs
              );
              if (res.changed) {
                updatedTasks = res.updatedTasks;
                tasksChanged = true;
              }
            }
          }
          for (const habitId of Object.keys(oldChecks)) {
            if (newChecks[habitId] === undefined) {
              const res = syncHabitCompletionToTasks(
                habitId,
                day,
                monthKey,
                false,
                updatedTasks,
                configs
              );
              if (res.changed) {
                updatedTasks = res.updatedTasks;
                tasksChanged = true;
              }
            }
          }
        }
      }
    }

    // 1. If Offline: update local state immediately and queue dirty flag
    if (!isOnline || !user) {
      setHabitsState(newHabits);
      saveStateToLocal("habits", newHabits);
      setDirty("habits", true);
      if (tasksChanged) {
        setTasksState(updatedTasks);
        saveStateToLocal("tasks", updatedTasks);
        setDirty("tasks", true);
      }
      setSyncStatus("offline");
      return;
    }

    // 2. If Online: Attempt server update FIRST. Wait for Supabase response before updating UI.
    setSyncStatus("saving");
    setLastError(null);
    try {
      const payload = {
        user_id: user.id,
        tasks: updatedTasks,
        habits: newHabits,
        settings: settingsRef.current
      };
      
      const { error } = await supabase
        .from("user_data")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;

      // Confirmed by server: update state & local cache
      setHabitsState(newHabits);
      saveStateToLocal("habits", newHabits);
      setDirty("habits", false);

      if (tasksChanged) {
        setTasksState(updatedTasks);
        saveStateToLocal("tasks", updatedTasks);
        setDirty("tasks", false);
      }

      setSyncStatus("synced");
      setLastSyncTime(new Date());
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err);
      console.warn("[SyncEngine] Server habits write failed:", errMsg);
      setSyncStatus("failed");
      setLastError(errMsg || "Write failed");
    }
  }, [isOnline, user, isInitialized]);

  const updateSetting = useCallback(async (key: string, value: unknown) => {
    if (!isInitialized) return;
    const updatedSettings = { ...settingsRef.current, [key]: value };
    
    // 1. If Offline: update local state immediately and queue dirty flag
    if (!isOnline || !user) {
      setSettingsState(updatedSettings);
      saveStateToLocal("settings", updatedSettings);
      setDirty("settings", true);
      setSyncStatus("offline");
      return;
    }

    // 2. If Online: Attempt server update FIRST. Wait for Supabase response before updating UI.
    setSyncStatus("saving");
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

      // Confirmed by server: update state & local cache
      setSettingsState(updatedSettings);
      saveStateToLocal("settings", updatedSettings);
      setDirty("settings", false);
      setSyncStatus("synced");
      setLastSyncTime(new Date());
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err);
      console.warn("[SyncEngine] Server settings write failed:", errMsg);
      setSyncStatus("failed");
      setLastError(errMsg || "Write failed");
    }
  }, [isOnline, user, isInitialized]);

  // Trigger scheduler on settings changes or init
  const lastConfigsHash = useRef("");
  useEffect(() => {
    if (!isInitialized) return;
    const configs = Array.isArray(settings.recurringConfigs) ? (settings.recurringConfigs as RecurringConfig[]) : [];
    const hash = JSON.stringify(configs);
    if (hash === lastConfigsHash.current) return;
    lastConfigsHash.current = hash;

    if (configs.length === 0) return;
    const todayStr = toLocalDateString(new Date());
    const { updatedTasks, generatedCount } = generateScheduledTasks(tasksRef.current, configs, todayStr);

    if (generatedCount > 0) {
      console.log(`[Scheduler] Generated ${generatedCount} recurring tasks.`);
      setTasksState(updatedTasks);
      saveStateToLocal("tasks", updatedTasks);
      setDirty("tasks", true);
    }
  }, [isInitialized, settings.recurringConfigs]);

  const forceSync = async () => {
    if (user && isOnline && !syncInProgress.current && isInitialized) {
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
      {!isInitialized && import.meta.env.MODE !== "test" ? (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-neutral-950 text-white space-y-4">
          <div className="h-10 w-10 rounded-md bg-gradient-to-br from-primary to-primary/60 grid place-items-center text-primary-foreground font-bold text-lg animate-pulse">
            E
          </div>
          <div className="text-sm font-medium tracking-wide text-white/70 animate-pulse">
            Loading your matrix...
          </div>
        </div>
      ) : (
        children
      )}
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
