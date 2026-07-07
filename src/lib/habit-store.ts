import { useCallback, useEffect } from "react";
import { useSync } from "@/context/SyncContext";

export type Habit = { id: string; name: string; emoji: string };
export type DayLog = {
  checks: Record<string, boolean>;
  mood?: number;
  sleep?: number;
  notes?: string;
};
export type MonthData = { habits: Habit[]; days: Record<number, DayLog> };
export type Store = { months: Record<string, MonthData>; theme: "dark" | "light" };

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

function findLatestMonthHabits(months: Record<string, MonthData>): Habit[] | null {
  const keys = Object.keys(months).sort();
  for (let i = keys.length - 1; i >= 0; i--) {
    const m = months[keys[i]];
    if (m?.habits?.length) return m.habits;
  }
  return null;
}

export function useHabitStore(year: number, month: number) {
  const { habits: store, updateHabits, syncStatus } = useSync();
  const key = monthKey(year, month);
  const daysCount = new Date(year, month + 1, 0).getDate();

  // ensure month data exists — but ONLY seed after sync engine has fully loaded
  // and NEVER seed during loading/saving to prevent overwriting server data
  useEffect(() => {
    if (syncStatus === "loading" || syncStatus === "saving") return;
    if (!store.months[key]) {
      const seed = findLatestMonthHabits(store.months) ?? DEFAULT_HABITS;
      const updated: Store = {
        ...store,
        months: {
          ...store.months,
          [key]: { habits: seed.map((h) => ({ ...h })), days: {} }
        }
      };
      updateHabits(updated);
    }
  }, [key, store, updateHabits, syncStatus]);

  const monthData: MonthData = store.months[key] ?? { habits: [], days: {} };

  const update = useCallback(
    async (fn: (m: MonthData) => MonthData) => {
      const currentMonthData = store.months[key] ?? { habits: [], days: {} };
      const nextMonthData = fn(currentMonthData);
      const updated: Store = {
        ...store,
        months: {
          ...store.months,
          [key]: nextMonthData
        }
      };
      await updateHabits(updated);
    },
    [key, store, updateHabits]
  );

  const toggleCheck = useCallback(
    async (habitId: string, day: number) => {
      await update((m) => {
        const dayLog = m.days[day] ?? { checks: {} };
        const checks = { ...dayLog.checks, [habitId]: !dayLog.checks[habitId] };
        return { ...m, days: { ...m.days, [day]: { ...dayLog, checks } } };
      });
    },
    [update]
  );

  const addHabit = useCallback(
    async (name: string, emoji = "✨") => {
      if (!name.trim()) return;
      await update((m) => ({
        ...m,
        habits: [...m.habits, { id: crypto.randomUUID(), name: name.trim(), emoji }],
      }));
    },
    [update]
  );

  const updateHabit = useCallback(
    async (id: string, patch: Partial<Habit>) => {
      await update((m) => ({
        ...m,
        habits: m.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)),
      }));
    },
    [update]
  );

  const deleteHabit = useCallback(
    async (id: string) => {
      await update((m) => ({
        ...m,
        habits: m.habits.filter((h) => h.id !== id),
      }));
    },
    [update]
  );

  const moveHabit = useCallback(
    async (id: string, dir: -1 | 1) => {
      await update((m) => {
        const idx = m.habits.findIndex((h) => h.id === id);
        const j = idx + dir;
        if (idx < 0 || j < 0 || j >= m.habits.length) return m;
        const arr = [...m.habits];
        [arr[idx], arr[j]] = [arr[j], arr[idx]];
        return { ...m, habits: arr };
      });
    },
    [update]
  );

  const setDayMeta = useCallback(
    async (day: number, patch: Partial<DayLog>) => {
      await update((m) => {
        const dayLog = m.days[day] ?? { checks: {} };
        return { ...m, days: { ...m.days, [day]: { ...dayLog, ...patch } } };
      });
    },
    [update]
  );

  const toggleTheme = useCallback(async () => {
    const updated: Store = {
      ...store,
      theme: store.theme === "dark" ? "light" : "dark"
    };
    await updateHabits(updated);
  }, [store, updateHabits]);

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
