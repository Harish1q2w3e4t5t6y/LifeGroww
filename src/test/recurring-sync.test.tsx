/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { SyncProvider, useSync } from "../context/SyncContext";
import { toLocalDateString } from "@/lib/recurring-engine";
import type { RecurringConfig } from "@/lib/types";

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
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));

import { supabase } from "@/lib/supabase";

const daily = (startDate: string): RecurringConfig => ({
  id: "cfg-1",
  workspace: "professional",
  quadrant: "q1",
  taskName: "Daily review",
  schedule: "daily",
  enabled: true,
  startDate,
});

const wrapper = ({ children }: { children: React.ReactNode }) => <SyncProvider>{children}</SyncProvider>;

function mockServer(settings: Record<string, unknown>) {
  (supabase as any).maybeSingle.mockResolvedValue({
    data: {
      tasks: { personal: [], professional: [] },
      habits: { months: {}, theme: "dark" },
      settings: { appSettings: {}, theme: "dark", workspace: "professional", ...settings },
    },
    error: null,
  });
}

describe("recurring tasks appear without a page refresh", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    (supabase as any).upsert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the task as soon as a recurring task is added", async () => {
    mockServer({});
    const { result } = renderHook(() => useSync(), { wrapper });
    await waitFor(() => expect(result.current.isInitialized).toBe(true));

    await act(async () => {
      await result.current.updateSetting("recurringConfigs", [daily(toLocalDateString(new Date()))]);
    });

    await waitFor(() => expect(result.current.tasks.professional).toHaveLength(1));
  });

  it("creates the next occurrence when the day changes while the site stays open", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 1, 23, 50));
    mockServer({ recurringConfigs: [daily("2026-11-01")] });

    const { result } = renderHook(() => useSync(), { wrapper });
    await waitFor(() => expect(result.current.tasks.professional).toHaveLength(1));

    vi.setSystemTime(new Date(2026, 10, 2, 0, 10));
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(result.current.tasks.professional).toHaveLength(2));
  });
});
