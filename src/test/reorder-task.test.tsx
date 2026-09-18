/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTasks } from "../hooks/useTasks";
import type { Task } from "@/lib/types";

const mockUpdateTasks = vi.fn();
let mockTasks: Record<string, Task[]>;

vi.mock("@/context/SyncContext", () => ({
  useSync: () => ({ tasks: mockTasks, updateTasks: mockUpdateTasks }),
}));

function makeTask(id: string): Task {
  return {
    id,
    title: id,
    quadrant: "q1",
    completed: false,
    status: "pending",
    priority: "low",
    createdAt: new Date().toISOString(),
  };
}

describe("useTasks - reorderTask direction", () => {
  beforeEach(() => {
    mockUpdateTasks.mockClear();
    mockTasks = {
      personal: [],
      professional: [makeTask("A"), makeTask("B"), makeTask("C"), makeTask("D"), makeTask("E")],
    };
  });

  it("places the dragged task after the drop target when dragging downward", async () => {
    const { result } = renderHook(() => useTasks("professional" as any));

    // A starts before D — dragging it down onto D means it has moved past D,
    // so it should land right after D, not still in front of it.
    await act(async () => {
      await result.current.reorderTask("A", "D");
    });

    const nextTasks = mockUpdateTasks.mock.calls[0][1] as Task[];
    expect(nextTasks.map((t) => t.id)).toEqual(["B", "C", "D", "A", "E"]);
  });

  it("places the dragged task before the drop target when dragging upward", async () => {
    const { result } = renderHook(() => useTasks("professional" as any));

    // E starts after B — dragging it up onto B should land it right before B.
    await act(async () => {
      await result.current.reorderTask("E", "B");
    });

    const nextTasks = mockUpdateTasks.mock.calls[0][1] as Task[];
    expect(nextTasks.map((t) => t.id)).toEqual(["A", "E", "B", "C", "D"]);
  });
});
