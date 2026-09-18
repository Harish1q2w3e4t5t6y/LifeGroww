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
  const { habits: store, updateHabits, syncStatus, isInitialized } = useSync();
  const key = monthKey(year, month);
  const daysCount = new Date(year, month + 1, 0).getDate();

  // Seed the current month's habit list if it does not yet exist in the store.
  //
  // CRITICAL SAFETY RULES — this effect must NEVER fire:
  //   1. Before isInitialized is true  → React state may still hold empty defaults,
  //      not the data fetched from Supabase. Writing at this point would erase the
  //      user's real server data (the confirmed root cause of the production bug).
  //   2. While any data operation is in progress (loading / saving / retry) → an
  //      in-flight request may have stale or partial state. Wait for it to settle.
  //
  // Only when isInitialized is true AND syncStatus is "synced" / "failed" / "offline"
  // can we be certain that store reflects confirmed server data (or confirmed no-data
  // for a new user), making it safe to write a new month scaffold.
  useEffect(() => {
    if (!isInitialized) return;
    if (syncStatus === "loading" || syncStatus === "saving" || syncStatus === "retry") return;
    if (!store.months[key]) {
      updateHabits((prev) => {
        if (prev.months[key]) return prev;
        const seed = findLatestMonthHabits(prev.months) ?? DEFAULT_HABITS;
        return {
          ...prev,
          months: {
            ...prev.months,
            [key]: { habits: seed.map((h) => ({ ...h })), days: {} }
          }
        };
      });
    }
  }, [key, store, updateHabits, syncStatus, isInitialized]);

  const monthData: MonthData = store.months[key] ?? { habits: [], days: {} };

  // Per-day data (checks, mood, sleep, notes) — scoped to just this month.
  const update = useCallback(
    async (fn: (m: MonthData) => MonthData) => {
      await updateHabits((prev) => {
        const currentMonthData = prev.months[key] ?? { habits: [], days: {} };
        const nextMonthData = fn(currentMonthData);
        return {
          ...prev,
          months: {
            ...prev.months,
            [key]: nextMonthData
          }
        };
      });
    },
    [key, updateHabits]
  );

  // The habit *list itself* (add/rename/delete/reorder) — applied across
  // months, not just the one currently on screen. Each month used to keep
  // its own independent copy, snapshotted only once when that month was
  // first created, so editing a habit later never reached any other month —
  // "add a habit today" wouldn't show up next month, a rename wouldn't
  // apply to months you'd already visited, etc. `scope` controls how far a
  // change reaches: renames/reorders apply everywhere (it's still the same
  // habit), while adding or deleting only affects the current month onward
  // so past history isn't rewritten.
  const updateHabitsAcrossMonths = useCallback(
    (transform: (habits: Habit[], monthKey: string) => Habit[], scope: "all" | "current-and-future") => {
      return updateHabits((prev) => {
        const nextMonths: Record<string, MonthData> = {};
        for (const [monthKeyIter, monthData] of Object.entries(prev.months)) {
          if (scope === "current-and-future" && monthKeyIter < key) {
            nextMonths[monthKeyIter] = monthData;
          } else {
            nextMonths[monthKeyIter] = { ...monthData, habits: transform(monthData.habits, monthKeyIter) };
          }
        }
        return { ...prev, months: nextMonths };
      });
    },
    [key, updateHabits]
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
      const newHabit: Habit = { id: crypto.randomUUID(), name: name.trim(), emoji };
      // Only this month onward — a habit you add today wasn't being tracked
      // in past months, so it shouldn't retroactively appear (and lower)
      // their completion stats.
      await updateHabitsAcrossMonths((habits) => [...habits, newHabit], "current-and-future");
    },
    [updateHabitsAcrossMonths]
  );

  const updateHabit = useCallback(
    async (id: string, patch: Partial<Habit>) => {
      // Every month — it's a rename/emoji change to the same habit, not a
      // new one, so history should read consistently everywhere.
      await updateHabitsAcrossMonths(
        (habits) => habits.map((h) => (h.id === id ? { ...h, ...patch } : h)),
        "all"
      );
    },
    [updateHabitsAcrossMonths]
  );

  const deleteHabit = useCallback(
    async (id: string) => {
      // Only this month onward — deleting a habit stops tracking it going
      // forward without erasing the history you already built up for it.
      await updateHabitsAcrossMonths((habits) => habits.filter((h) => h.id !== id), "current-and-future");
    },
    [updateHabitsAcrossMonths]
  );

  const moveHabit = useCallback(
    async (id: string, dir: -1 | 1) => {
      // Every month — keep display order consistent wherever the habit appears.
      await updateHabitsAcrossMonths((habits) => {
        const idx = habits.findIndex((h) => h.id === id);
        const j = idx + dir;
        if (idx < 0 || j < 0 || j >= habits.length) return habits;
        const arr = [...habits];
        [arr[idx], arr[j]] = [arr[j], arr[idx]];
        return arr;
      }, "all");
    },
    [updateHabitsAcrossMonths]
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
    await updateHabits((prev) => ({
      ...prev,
      theme: prev.theme === "dark" ? "light" : "dark"
    }));
  }, [updateHabits]);

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
