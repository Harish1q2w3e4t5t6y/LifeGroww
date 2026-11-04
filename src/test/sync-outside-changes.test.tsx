/* eslint-disable @typescript-eslint/no-explicit-any */
// Changes made outside this tab (ChatGPT via the MCP server, another device)
// must show up here, so a later edit in this tab doesn't save an old copy
// over them.
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { SyncProvider, useSync } from "../context/SyncContext";
import type { Task } from "@/lib/types";

let realtimeCallback: (() => void) | null = null;
vi.mock("@/lib/supabase", () => {
  const channel = {
    on: vi.fn((_type: string, _filter: unknown, cb: () => void) => {
      realtimeCallback = cb;
      return channel;
    }),
    subscribe: vi.fn(() => channel),
  };
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    upsert: vi.fn(),
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  };
  return { supabase: mockSupabase, isSupabaseConfigured: true };
});

const mockUser = { id: "u1", email: "a@b.c" };
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: mockUser, loading: false }) }));

import { supabase } from "@/lib/supabase";

const task = (id: string, title: string): Task => ({
  id,
  title,
  quadrant: "q1",
  completed: false,
  status: "pending",
  priority: "low",
  createdAt: "2026-11-01T09:00:00.000Z",
});

const row = (professional: Task[]) => ({
  data: {
    tasks: { personal: [], professional },
    habits: { months: {}, theme: "dark" },
    settings: { appSettings: { accent: "blue", reportLayout: "focus", showCompleted: true }, theme: "dark", workspace: "professional" },
  },
  error: null,
});

const wrapper = ({ children }: { children: React.ReactNode }) => <SyncProvider>{children}</SyncProvider>;

async function renderReady() {
  const hook = renderHook(() => useSync(), { wrapper });
  await waitFor(() => expect(hook.result.current.isInitialized).toBe(true));
  await waitFor(() => expect(hook.result.current.syncStatus).toBe("synced"));
  return hook;
}

function showTab() {
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("SyncContext - picks up changes made outside this tab", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    realtimeCallback = null;
    (supabase as any).maybeSingle.mockReset();
    (supabase as any).upsert.mockReset();
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    (supabase as any).maybeSingle.mockResolvedValue(row([task("a", "Mine")]));
    (supabase as any).upsert.mockResolvedValue({ error: null });
  });

  it("reloads quietly when the tab comes back into view", async () => {
    const { result } = await renderReady();
    (supabase as any).maybeSingle.mockResolvedValue(row([task("a", "Mine"), task("b", "From ChatGPT")]));

    await act(async () => showTab());

    await waitFor(() => expect(result.current.tasks.professional.map((t) => t.id)).toEqual(["a", "b"]));
    expect(result.current.isInitialized).toBe(true);
  });

  it("then saves the next edit on top of the outside change instead of over it", async () => {
    const { result } = await renderReady();
    (supabase as any).maybeSingle.mockResolvedValue(row([task("a", "Mine"), task("b", "From ChatGPT")]));
    await act(async () => showTab());
    await waitFor(() => expect(result.current.tasks.professional).toHaveLength(2));

    await act(async () => {
      await result.current.updateTasks("professional", [...result.current.tasks.professional, task("c", "New here")]);
    });

    const saved = (supabase as any).upsert.mock.calls.at(-1)[0];
    expect(saved.tasks.professional.map((t: Task) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("reloads when Supabase Realtime reports the row changed", async () => {
    const { result } = await renderReady();
    expect((supabase as any).channel).toHaveBeenCalled();
    (supabase as any).maybeSingle.mockResolvedValue(row([task("b", "From ChatGPT")]));

    await act(async () => realtimeCallback?.());

    await waitFor(() => expect(result.current.tasks.professional.map((t) => t.id)).toEqual(["b"]));
  });

  it("keeps unsaved offline edits rather than replacing them", async () => {
    const { result } = await renderReady();
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    await act(async () => {
      await result.current.updateTasks("professional", [task("a", "Mine"), task("off", "Offline edit")]);
    });
    // The offline edit is still being uploaded when the reload triggers fire.
    (supabase as any).upsert.mockImplementation(() => new Promise(() => {}));
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    (supabase as any).maybeSingle.mockResolvedValue(row([task("x", "Server")]));

    await act(async () => showTab());
    await act(async () => realtimeCallback?.());

    expect(result.current.tasks.professional.map((t) => t.id)).toEqual(["a", "off"]);
  });

  it("drops a reload that finishes after a newer edit in this tab", async () => {
    const { result } = await renderReady();
    let resolveRefresh: (v: unknown) => void = () => {};
    (supabase as any).maybeSingle.mockImplementationOnce(() => new Promise((r) => (resolveRefresh = r)));

    await act(async () => showTab()); // reload starts and waits
    await act(async () => {
      await result.current.updateTasks("professional", [task("a", "Mine"), task("c", "Typed meanwhile")]);
    });
    await act(async () => resolveRefresh(row([task("old", "Stale server copy")])));

    expect(result.current.tasks.professional.map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("unsubscribes from Realtime on unmount", async () => {
    const { unmount } = await renderReady();
    unmount();
    expect((supabase as any).removeChannel).toHaveBeenCalled();
  });
});
