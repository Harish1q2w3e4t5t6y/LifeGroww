import { useCallback, useEffect, useState } from "react";
import { fetchHabits, saveHabits } from "@/lib/db";

export type Habit = { id: string; name: string; emoji: string };
export type DayLog = {
  checks: Record<string, boolean>;
  mood?: number;
  sleep?: number;
  notes?: string;
};
export type MonthData = { habits: Habit[]; days: Record<number, DayLog> };
export type Store = { months: Record<string, MonthData>; theme: "dark" | "light" };

const KEY = "habitgame:v1";

const DEFAULT_HABITS: Habit[] = [
  { id: "wake", name: "Wake up 05:00", emoji: "⏰" },
  { id: "stretch", name: "Stretching", emoji: "🤸" },
  { id: "gym", name: "Gym", emoji: "💪" },
  { id: "read", name: "Reading", emoji: "📖" },
  { id: "plan", name: "Day Planning", emoji: "🗓️" },
  { id: "work", name: "Project Work", emoji: "🎯" },
  { id: "sugar", name: "No Sugar", emoji: "🚫" },
];

export const monthKey = (year: number, month: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}`;

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {}
  return { months: {}, theme: "dark" };
}

function saveStore(s: Store) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

function findLatestMonthHabits(months: Record<string, MonthData>): Habit[] | null {
  const keys = Object.keys(months).sort();
  for (let i = keys.length - 1; i >= 0; i--) {
    const m = months[keys[i]];
    if (m?.habits?.length) return m.habits;
  }
  return null;
}

export function useHabitStore(year: number, month: number) {
  const [store, setStore] = useState<Store>(() => loadStore());
  const key = monthKey(year, month);
  const daysCount = new Date(year, month + 1, 0).getDate();

  // ensure month data exists
  useEffect(() => {
    setStore((s) => {
      if (s.months[key]) return s;
      const seed = findLatestMonthHabits(s.months) ?? DEFAULT_HABITS;
      return {
        ...s,
        months: { ...s.months, [key]: { habits: seed.map((h) => ({ ...h })), days: {} } },
      };
    });
  }, [key]);

  // Fetch from Supabase on mount, override local store.
  useEffect(() => {
    console.log("[useHabitStore] Fetching habits from Supabase...");
    fetchHabits().then((remote) => {
      if (!remote) {
        console.log("[useHabitStore] No habit data found in Supabase.");
        return;
      }
      const remoteStore = remote as Store;
      if (!remoteStore.months) return;
      console.log("[useHabitStore] Loaded habits from Supabase:", remoteStore);
      setStore(remoteStore);
      saveStore(remoteStore); // hydrate localStorage
    });
  }, []);

  // Persist to localStorage immediately, Supabase debounced.
  useEffect(() => {
    saveStore(store);
    saveHabits(store);
  }, [store]);

  const monthData: MonthData = store.months[key] ?? { habits: DEFAULT_HABITS, days: {} };

  const update = (fn: (m: MonthData) => MonthData) =>
    setStore((s) => ({ ...s, months: { ...s.months, [key]: fn(s.months[key] ?? { habits: DEFAULT_HABITS, days: {} }) } }));

  const toggleCheck = useCallback((habitId: string, day: number) => {
    update((m) => {
      const dayLog = m.days[day] ?? { checks: {} };
      const checks = { ...dayLog.checks, [habitId]: !dayLog.checks[habitId] };
      return { ...m, days: { ...m.days, [day]: { ...dayLog, checks } } };
    });
  }, [key]);

  const addHabit = useCallback((name: string, emoji = "✨") => {
    if (!name.trim()) return;
    update((m) => ({ ...m, habits: [...m.habits, { id: crypto.randomUUID(), name: name.trim(), emoji }] }));
  }, [key]);

  const updateHabit = useCallback((id: string, patch: Partial<Habit>) => {
    update((m) => ({ ...m, habits: m.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) }));
  }, [key]);

  const deleteHabit = useCallback((id: string) => {
    update((m) => ({ ...m, habits: m.habits.filter((h) => h.id !== id) }));
  }, [key]);

  const moveHabit = useCallback((id: string, dir: -1 | 1) => {
    update((m) => {
      const idx = m.habits.findIndex((h) => h.id === id);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= m.habits.length) return m;
      const arr = [...m.habits];
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return { ...m, habits: arr };
    });
  }, [key]);

  const setDayMeta = useCallback((day: number, patch: Partial<DayLog>) => {
    update((m) => {
      const dayLog = m.days[day] ?? { checks: {} };
      return { ...m, days: { ...m.days, [day]: { ...dayLog, ...patch } } };
    });
  }, [key]);

  const toggleTheme = useCallback(() => {
    setStore((s) => ({ ...s, theme: s.theme === "dark" ? "light" : "dark" }));
  }, []);

  return { store, monthData, daysCount, toggleCheck, addHabit, updateHabit, deleteHabit, moveHabit, setDayMeta, toggleTheme };
}

export function computeStats(monthData: MonthData, days: number, todayDay?: number) {
  const habits = monthData.habits;
  const goal = habits.length * days;
  let completed = 0;
  const perHabit: Record<string, number> = {};
  const perDay: { day: number; pct: number; done: number }[] = [];

  for (const h of habits) perHabit[h.id] = 0;

  for (let d = 1; d <= days; d++) {
    const log = monthData.days[d];
    let doneToday = 0;
    for (const h of habits) {
      if (log?.checks?.[h.id]) {
        completed++;
        perHabit[h.id]++;
        doneToday++;
      }
    }
    perDay.push({ day: d, done: doneToday, pct: habits.length ? Math.round((doneToday / habits.length) * 100) : 0 });
  }

  const analysis = habits.map((h) => ({
    id: h.id,
    name: h.name,
    emoji: h.emoji,
    goal: days,
    achieved: perHabit[h.id],
    pct: days ? Math.round((perHabit[h.id] / days) * 100) : 0,
  }));

  // weekly buckets (5 weeks)
  const weeks = [0, 0, 0, 0, 0];
  const weekGoals = [0, 0, 0, 0, 0];
  for (let d = 1; d <= days; d++) {
    const w = Math.min(4, Math.floor((d - 1) / 7));
    weeks[w] += perDay[d - 1].done;
    weekGoals[w] += habits.length;
  }
  const weekPcts = weeks.map((w, i) => (weekGoals[i] ? Math.round((w / weekGoals[i]) * 100) : 0));

  // streaks: consecutive days where ALL habits checked
  let longest = 0, current = 0, running = 0;
  const upto = todayDay ?? days;
  for (let d = 1; d <= upto; d++) {
    const log = monthData.days[d];
    const all = habits.length > 0 && habits.every((h) => log?.checks?.[h.id]);
    if (all) {
      running++;
      longest = Math.max(longest, running);
    } else {
      running = 0;
    }
  }
  // current streak = trailing run
  for (let d = upto; d >= 1; d--) {
    const log = monthData.days[d];
    const all = habits.length > 0 && habits.every((h) => log?.checks?.[h.id]);
    if (all) current++;
    else break;
  }

  const consistency = perDay.slice(0, upto).filter((p) => p.done > 0).length;
  const consistencyPct = upto ? Math.round((consistency / upto) * 100) : 0;

  const todayIdx = todayDay ? todayDay - 1 : -1;
  const today =
    todayIdx >= 0
      ? { done: perDay[todayIdx].done, total: habits.length, pct: perDay[todayIdx].pct }
      : { done: 0, total: habits.length, pct: 0 };

  return {
    goal,
    completed,
    left: Math.max(0, goal - completed),
    pct: goal ? Math.round((completed / goal) * 100) : 0,
    perHabit,
    perDay,
    analysis,
    weeks: weekPcts,
    longestStreak: longest,
    currentStreak: current,
    consistency: consistencyPct,
    today,
  };
}
