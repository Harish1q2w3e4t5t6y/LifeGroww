/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { SyncProvider } from "../context/SyncContext";
import { useHabitStore } from "../lib/habit-store";

// Online, authenticated Supabase session so syncStatus resolves out of
// "loading" and the seed/mutation paths run for real.
vi.mock("@/lib/supabase", () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    upsert: vi.fn(),
  };
  return { supabase: mockSupabase, isSupabaseConfigured: true };
});

const mockUser = { id: "test-user-123", email: "test@example.com" };
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));

import { supabase } from "@/lib/supabase";

describe("useHabitStore - concurrent mutation regression", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    const mockSingle = supabase.maybeSingle as any;
    mockSingle.mockResolvedValue({
      data: {
        tasks: { personal: [], professional: [] },
        habits: { months: {}, theme: "dark" },
        settings: { appSettings: { accent: "blue", reportLayout: "focus", showCompleted: true }, theme: "dark", workspace: "professional" },
      },
      error: null,
    });

    const mockUpsert = supabase.upsert as any;
    mockUpsert.mockResolvedValue({ error: null });

    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SyncProvider>{children}</SyncProvider>
  );

  it("keeps both changes when two checkboxes are toggled before the first write resolves", async () => {
    const { result } = renderHook(() => useHabitStore(2026, 0), { wrapper });

    await waitFor(() => {
      expect(result.current.monthData).toBeDefined();
    });

    await act(async () => {
      await result.current.addHabit("Read", "📖");
    });

    const habitId = result.current.monthData.habits[0].id;
    expect(habitId).toBeTruthy();

    // Fire both toggles without awaiting the first — a fast double-click on
    // two different day cells produces exactly this: toggleCheck(day 1)
    // starts its async updateHabits() call, and toggleCheck(day 2) starts
    // before that call's Supabase round-trip has completed.
    await act(async () => {
      await Promise.all([
        result.current.toggleCheck(habitId, 1),
        result.current.toggleCheck(habitId, 2),
      ]);
    });

    expect(result.current.monthData.days[1]?.checks[habitId]).toBe(true);
    expect(result.current.monthData.days[2]?.checks[habitId]).toBe(true);
  });
});

describe("useHabitStore - habit list changes propagate across months", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    // Three pre-existing months, each with its own (currently identical)
    // habit list, as if seeded independently before this fix — the scenario
    // the bug report described: "if I change a habit it won't reflect in
    // the next month."
    const existingHabit = { id: "h-existing", name: "Stretch", emoji: "🤸" };
    const mockSingle = supabase.maybeSingle as any;
    mockSingle.mockResolvedValue({
      data: {
        tasks: { personal: [], professional: [] },
        habits: {
          months: {
            "2026-01": { habits: [{ ...existingHabit }], days: {} },
            "2026-02": { habits: [{ ...existingHabit }], days: {} },
            "2026-03": { habits: [{ ...existingHabit }], days: {} },
          },
          theme: "dark",
        },
        settings: { appSettings: { accent: "blue", reportLayout: "focus", showCompleted: true }, theme: "dark", workspace: "professional" },
      },
      error: null,
    });

    const mockUpsert = supabase.upsert as any;
    mockUpsert.mockResolvedValue({ error: null });

    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SyncProvider>{children}</SyncProvider>
  );

  it("adds a new habit to the current and future months, but not past months", async () => {
    // February (month index 1) is "current" for this test.
    const { result } = renderHook(() => useHabitStore(2026, 1), { wrapper });
    await waitFor(() => expect(result.current.monthData.habits.length).toBe(1));

    await act(async () => {
      await result.current.addHabit("Meditate", "🧘");
    });

    const allMonths = result.current.store.months;
    expect(allMonths["2026-01"].habits.map((h) => h.name)).toEqual(["Stretch"]);
    expect(allMonths["2026-02"].habits.map((h) => h.name)).toEqual(["Stretch", "Meditate"]);
    expect(allMonths["2026-03"].habits.map((h) => h.name)).toEqual(["Stretch", "Meditate"]);
  });

  it("renames a habit in every month, including past ones", async () => {
    const { result } = renderHook(() => useHabitStore(2026, 1), { wrapper });
    await waitFor(() => expect(result.current.monthData.habits.length).toBe(1));

    await act(async () => {
      await result.current.updateHabit("h-existing", { name: "Stretching", emoji: "🧘‍♂️" });
    });

    const allMonths = result.current.store.months;
    expect(allMonths["2026-01"].habits[0].name).toBe("Stretching");
    expect(allMonths["2026-02"].habits[0].name).toBe("Stretching");
    expect(allMonths["2026-03"].habits[0].name).toBe("Stretching");
  });

  it("deletes a habit from the current and future months, but keeps it in past months", async () => {
    const { result } = renderHook(() => useHabitStore(2026, 1), { wrapper });
    await waitFor(() => expect(result.current.monthData.habits.length).toBe(1));

    await act(async () => {
      await result.current.deleteHabit("h-existing");
    });

    const allMonths = result.current.store.months;
    expect(allMonths["2026-01"].habits.map((h) => h.id)).toEqual(["h-existing"]);
    expect(allMonths["2026-02"].habits).toEqual([]);
    expect(allMonths["2026-03"].habits).toEqual([]);
  });
});
