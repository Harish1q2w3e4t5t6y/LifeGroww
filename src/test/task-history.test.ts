import { describe, it, expect } from "vitest";
import { groupTasksByDay } from "@/lib/taskHistory";
import type { Task } from "@/lib/types";

const base: Task = {
  id: "t",
  title: "Task",
  quadrant: "q1",
  completed: false,
  status: "pending",
  priority: "low",
  createdAt: new Date(2026, 9, 1, 9, 0).toISOString(),
};

const now = new Date(2026, 9, 20, 12, 0);

describe("groupTasksByDay", () => {
  it("places a completed task on its completion day", () => {
    const task = { ...base, id: "a", completed: true, status: "done" as const, completedAt: new Date(2026, 9, 15, 18, 30).toISOString() };
    const entries = groupTasksByDay([task], now).get("2026-10-15");
    expect(entries).toEqual([{ task, kind: "completed", approximate: false }]);
  });

  it("falls back to due date (approximate) for tasks completed before completedAt existed", () => {
    const task = { ...base, id: "b", completed: true, status: "done" as const, dueDate: new Date(2026, 9, 12, 10, 0).toISOString() };
    const entries = groupTasksByDay([task], now).get("2026-10-12");
    expect(entries?.[0]).toMatchObject({ kind: "completed", approximate: true });
  });

  it("marks open tasks as due or overdue relative to now", () => {
    const future = { ...base, id: "c", dueDate: new Date(2026, 9, 25, 10, 0).toISOString() };
    const past = { ...base, id: "d", dueDate: new Date(2026, 9, 18, 10, 0).toISOString() };
    const byDay = groupTasksByDay([future, past], now);
    expect(byDay.get("2026-10-25")?.[0].kind).toBe("due");
    expect(byDay.get("2026-10-18")?.[0].kind).toBe("overdue");
  });

  it("treats a date-only due date as due until the end of that day", () => {
    const today = { ...base, id: "e", dueDate: "2026-10-20" };
    expect(groupTasksByDay([today], now).get("2026-10-20")?.[0].kind).toBe("due");
  });

  it("leaves out open tasks with no due date", () => {
    expect(groupTasksByDay([{ ...base, id: "f" }], now).size).toBe(0);
  });
});
