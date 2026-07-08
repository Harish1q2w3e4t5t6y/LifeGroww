import { useCallback, useEffect, useState, useMemo } from "react";
import type { Task, Quadrant } from "@/lib/types";
import type { WorkspaceId } from "@/hooks/useWorkspace";
import { useSync } from "@/context/SyncContext";

const QUADRANTS: Quadrant[] = ["q1", "q2", "q3", "q4"];
const EMPTY_TASKS: Task[] = [];

// Order per quadrant: overdue-active (oldest deadline first), then remaining active
// (manual order), then completed (manual order).
function normalize(tasks: Task[], _tick?: number): Task[] {
  const now = Date.now();
  const out: Task[] = [];
  for (const q of QUADRANTS) {
    const inQ = tasks.filter((t) => t.quadrant === q);
    const active = inQ.filter((t) => !t.completed);
    const done = inQ.filter((t) => t.completed);
    const overdue = active
      .filter((t) => t.dueDate && new Date(t.dueDate).getTime() < now)
      .sort(
        (a, b) =>
          new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
      );
    const overdueIds = new Set(overdue.map((t) => t.id));
    const rest = active.filter((t) => !overdueIds.has(t.id));
    out.push(...overdue, ...rest, ...done);
  }
  return out;
}

export function useTasks(workspace: WorkspaceId = "professional") {
  const { tasks: allTasks, updateTasks } = useSync();
  const [tick, setTick] = useState(0);

  // Force re-normalization every 30s for overdue task sorting
  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  const currentWorkspaceTasks = useMemo(() => {
    return allTasks[workspace] || EMPTY_TASKS;
  }, [allTasks, workspace]);

  const tasks = useMemo(() => {
    return normalize(currentWorkspaceTasks, tick);
  }, [currentWorkspaceTasks, tick]);

  const addTask = useCallback(
    async (t: Omit<Task, "id" | "createdAt" | "completed" | "status"> & { completed?: boolean; status?: Task["status"] }) => {
      const newTask: Task = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        completed: false,
        status: "pending",
        priority: "low",
        ...t,
      };
      const targetList = allTasks[workspace] || [];
      const nextTasks = [...targetList, newTask];
      await updateTasks(workspace, nextTasks);
    },
    [allTasks, workspace, updateTasks]
  );

  const removeTask = useCallback(async (id: string) => {
    const targetList = allTasks[workspace] || [];
    const nextTasks = targetList.filter((t) => t.id !== id);
    await updateTasks(workspace, nextTasks);
  }, [allTasks, workspace, updateTasks]);

  const toggleTask = useCallback(async (id: string) => {
    const targetList = allTasks[workspace] || [];
    const nextTasks = targetList.map((t) => {
      if (t.id !== id) return t;
      const completed = !t.completed;
      return { ...t, completed, status: completed ? "done" : "pending" };
    });
    await updateTasks(workspace, nextTasks);
  }, [allTasks, workspace, updateTasks]);

  const setTaskStatus = useCallback(async (id: string, status: Task["status"]) => {
    const targetList = allTasks[workspace] || [];
    const nextTasks = targetList.map((t) => {
      if (t.id !== id) return t;
      const completed = status === "done";
      return { ...t, status, completed };
    });
    await updateTasks(workspace, nextTasks);
  }, [allTasks, workspace, updateTasks]);

  const setTaskDueDate = useCallback(async (id: string, dueDate: string | undefined) => {
    const targetList = allTasks[workspace] || [];
    const nextTasks = targetList.map((t) => (t.id === id ? { ...t, dueDate } : t));
    await updateTasks(workspace, nextTasks);
  }, [allTasks, workspace, updateTasks]);

  const reorderTask = useCallback(async (activeId: string, overId: string) => {
    const targetList = allTasks[workspace] || [];
    const active = targetList.find((t) => t.id === activeId);
    if (!active) return;

    let dstQ: Quadrant;
    let anchorId: string | null = null;
    if ((QUADRANTS as string[]).includes(overId)) {
      dstQ = overId as Quadrant;
    } else {
      const overTask = targetList.find((t) => t.id === overId);
      if (!overTask) return;
      dstQ = overTask.quadrant;
      anchorId = overId;
    }

    const without = targetList.filter((t) => t.id !== activeId);
    const moved: Task = { ...active, quadrant: dstQ };

    let inserted: Task[];
    if (anchorId) {
      const idx = without.findIndex((t) => t.id === anchorId);
      inserted = [...without.slice(0, idx), moved, ...without.slice(idx)];
    } else {
      const lastIdx = (() => {
        for (let i = without.length - 1; i >= 0; i--) {
          if (without[i].quadrant === dstQ) return i;
        }
        return -1;
      })();
      inserted = [
        ...without.slice(0, lastIdx + 1),
        moved,
        ...without.slice(lastIdx + 1),
      ];
    }

    await updateTasks(workspace, inserted);
  }, [allTasks, workspace, updateTasks]);

  const renameTask = useCallback(async (id: string, title: string) => {
    const targetList = allTasks[workspace] || [];
    const nextTasks = targetList.map((t) => (t.id === id ? { ...t, title } : t));
    await updateTasks(workspace, nextTasks);
  }, [allTasks, workspace, updateTasks]);

  const setTaskPriority = useCallback(async (id: string, priority: Task["priority"]) => {
    const targetList = allTasks[workspace] || [];
    const nextTasks = targetList.map((t) => (t.id === id ? { ...t, priority } : t));
    await updateTasks(workspace, nextTasks);
  }, [allTasks, workspace, updateTasks]);

  return { tasks, addTask, removeTask, toggleTask, reorderTask, renameTask, setTaskStatus, setTaskDueDate, setTaskPriority };
}
