/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { SyncProvider, useSync } from "../context/SyncContext";

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

let mockAuthLoading = true;
let mockAuthUser: { id: string; email: string } | null = null;
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: mockAuthUser, loading: mockAuthLoading }),
}));

import { supabase } from "@/lib/supabase";

describe("SyncContext - does not treat 'auth still checking' as 'no user'", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthLoading = true;
    mockAuthUser = null;

    const mockSingle = supabase.maybeSingle as any;
    mockSingle.mockResolvedValue({
      data: {
        tasks: {
          personal: [],
          professional: [
            {
              id: "real-task",
              title: "Real data",
              quadrant: "q1",
              completed: false,
              status: "pending",
              priority: "low",
              createdAt: new Date().toISOString(),
            },
          ],
        },
        habits: {
          months: { "2026-01": { habits: [{ id: "h1", name: "Real habit", emoji: "📖" }], days: {} } },
          theme: "dark",
        },
        settings: {
          appSettings: { accent: "blue", reportLayout: "focus", showCompleted: true },
          theme: "dark",
          workspace: "professional",
        },
      },
      error: null,
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => <SyncProvider>{children}</SyncProvider>;

  it("stays uninitialized while auth is still resolving, instead of flashing empty state", async () => {
    const { result, rerender } = renderHook(() => useSync(), { wrapper });

    // Auth hasn't resolved yet (loading: true) — SyncContext must not have
    // decided "no user" and switched to interactable empty state.
    expect(result.current.isInitialized).toBe(false);

    // Auth resolves: there IS a logged-in user.
    mockAuthUser = { id: "test-user-123", email: "test@example.com" };
    mockAuthLoading = false;
    rerender();

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    // The real, non-empty server data must be what loaded — not empty defaults
    // from a premature "no user" decision made while auth was still checking.
    expect(result.current.habits.months["2026-01"]).toBeDefined();
    expect(result.current.tasks.professional).toHaveLength(1);
  });
});
