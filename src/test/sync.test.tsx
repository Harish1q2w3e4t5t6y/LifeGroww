/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, act } from "@testing-library/react";
import { SyncProvider, useSync } from "../context/SyncContext";

// Setup mocks
vi.mock("@/lib/supabase", () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    upsert: vi.fn()
  };
  return {
    supabase: mockSupabase,
    isSupabaseConfigured: true
  };
});

const mockUser = { id: "test-user-123", email: "test@example.com" };
vi.mock("../context/AuthContext", () => {
  return {
    useAuth: () => ({
      user: mockUser
    })
  };
});

import { supabase } from "@/lib/supabase";

describe("SyncContext - Synchronization Engine E2E", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Default mock behavior for Supabase client
    const mockSingle = supabase.maybeSingle as any;
    mockSingle.mockResolvedValue({
      data: {
        tasks: { personal: [], professional: [] },
        habits: { months: {}, theme: "dark" },
        settings: { appSettings: { accent: "blue", reportLayout: "compact", showCompleted: true } }
      },
      error: null
    });

    const mockUpsert = supabase.upsert as any;
    mockUpsert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SyncProvider>{children}</SyncProvider>
  );

  it("should initialize state from localStorage on startup", async () => {
    localStorage.setItem("eisenhower.theme", "light");
    localStorage.setItem("eisenhower.workspace.v1", "personal");
    
    const { result } = renderHook(() => useSync(), { wrapper });

    expect(result.current.settings.theme).toBe("light");
    expect(result.current.settings.workspace).toBe("personal");
  });

  it("should perform online tasks write immediately and change status to synced", async () => {
    const { result } = renderHook(() => useSync(), { wrapper });

    const newTask = {
      id: "1",
      title: "Test Task",
      quadrant: "q1" as const,
      completed: false,
      status: "pending" as const,
      priority: "low" as const,
      createdAt: new Date().toISOString()
    };

    // Ensure online is true
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });

    const upsertSpy = vi.spyOn(supabase, "upsert");

    await act(async () => {
      await result.current.updateTasks("professional", [newTask]);
    });

    // Verify Supabase upsert was called with updated tasks
    expect(upsertSpy).toHaveBeenCalled();
    expect(result.current.syncStatus).toBe("synced");
    expect(result.current.tasks.professional).toHaveLength(1);
    expect(result.current.tasks.professional[0].title).toBe("Test Task");
  });

  it("should save locally and mark dirty if offline", async () => {
    const { result } = renderHook(() => useSync(), { wrapper });

    // Set offline
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current.isOnline).toBe(false);

    const newTask = {
      id: "2",
      title: "Offline Task",
      quadrant: "q2" as const,
      completed: false,
      status: "pending" as const,
      priority: "low" as const,
      createdAt: new Date().toISOString()
    };

    await act(async () => {
      await result.current.updateTasks("professional", [newTask]);
    });

    // State updates immediately, but status is pending and local dirty flag is true
    expect(result.current.tasks.professional).toHaveLength(1);
    expect(result.current.syncStatus).toBe("pending");
    expect(localStorage.getItem("eisenhower.sync.dirty")).toContain('"tasks":true');
  });

  it("should automatically retry and push modifications once connection is restored", async () => {
    const { result } = renderHook(() => useSync(), { wrapper });

    // Start offline
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    const newTask = {
      id: "3",
      title: "Queued Task",
      quadrant: "q3" as const,
      completed: false,
      status: "pending" as const,
      priority: "low" as const,
      createdAt: new Date().toISOString()
    };

    await act(async () => {
      await result.current.updateTasks("professional", [newTask]);
    });

    expect(result.current.syncStatus).toBe("pending");

    // Clear upsert mock call list
    const upsertSpy = vi.spyOn(supabase, "upsert");
    upsertSpy.mockClear();

    // Restoration of network connection
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    // Advance fake timers to trigger retry loop
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(upsertSpy).toHaveBeenCalled();
    expect(result.current.syncStatus).toBe("synced");
    expect(localStorage.getItem("eisenhower.sync.dirty")).toContain('"tasks":false');
  });

  it("should handle server failures gracefully and store data in queue", async () => {
    const { result } = renderHook(() => useSync(), { wrapper });

    // Force server failure
    const mockUpsert = supabase.upsert as any;
    mockUpsert.mockResolvedValue({ error: { message: "Database timeout" } });

    const newTask = {
      id: "4",
      title: "Fail Task",
      quadrant: "q4" as const,
      completed: false,
      status: "pending" as const,
      priority: "low" as const,
      createdAt: new Date().toISOString()
    };

    await act(async () => {
      await result.current.updateTasks("professional", [newTask]);
    });

    // Status transitions to failed, but local state is preserved
    expect(result.current.syncStatus).toBe("failed");
    expect(result.current.lastError).toBe("Database timeout");
    expect(result.current.tasks.professional).toHaveLength(1);
    expect(localStorage.getItem("eisenhower.sync.dirty")).toContain('"tasks":true');
  });
});
