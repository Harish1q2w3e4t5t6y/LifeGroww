import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { DEFAULT_COMPLETION_ANIMATION, useAppSettings } from "@/hooks/useAppSettings";

const syncState = vi.hoisted(() => ({ settings: {} as Record<string, unknown> }));

vi.mock("@/context/SyncContext", () => ({
  useSync: () => ({ settings: syncState.settings, updateSetting: vi.fn() }),
}));

describe("useAppSettings completionAnimation", () => {
  it("keeps a saved animation that still exists", () => {
    syncState.settings = { appSettings: { completionAnimation: "laser" } };
    expect(renderHook(() => useAppSettings()).result.current.completionAnimation).toBe("laser");
  });

  it("falls back to the default when the saved animation was removed", () => {
    syncState.settings = { appSettings: { completionAnimation: "pixel" } };
    expect(renderHook(() => useAppSettings()).result.current.completionAnimation).toBe(DEFAULT_COMPLETION_ANIMATION);
  });
});
