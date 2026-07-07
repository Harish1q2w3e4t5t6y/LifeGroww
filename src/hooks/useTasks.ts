import { useCallback, useEffect, useRef, useState } from "react";
import type { Task, Quadrant } from "@/lib/types";
import type { WorkspaceId } from "@/hooks/useWorkspace";
import { fetchTasks, saveTasks } from "@/lib/db";

const BASE_KEY = "eisenhower.tasks.v1";
const LEGACY_KEY = "eisenhower.tasks.v1"; // pre-workspace single key
const QUADRANTS: Quadrant[] = ["q1", "q2", "q3", "q4"];

const keyFor = (w: WorkspaceId) => `${BASE_KEY}:${w}`;

function load(w: WorkspaceId): Task[] {
  try {
    let raw = localStorage.getItem(keyFor(w));
    // Migrate legacy single-store to "professional" workspace.
    if (!raw && w === "professional") {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy && legacy !== "[]") {
        raw = legacy;
        localStorage.setItem(keyFor(w), legacy);
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Task[];
    return parsed.map((t) => ({
      ...t,
      status: t.status ?? (t.completed ? "done" : "pending"),
      priority: t.priority ?? "low",
    }));
  } catch {
    return [];
  }
}

// Order per quadrant: overdue-active (oldest deadline first), then remaining active
// (manual order), then completed (manual order).
function normalize(tasks: Task[]): Task[] {
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
  const [tasks, setTasks] = useState<Task[]>(() => normalize(load(workspace)));
  const workspaceRef = useRef(workspace);
  // Guard: don't write local state back to Supabase until after we've loaded remote.
  const isSynced = useRef(false);

  // Swap task list when workspace changes.
  useEffect(() => {
    if (workspaceRef.current === workspace) return;
    workspaceRef.current = workspace;
    isSynced.current = false;
    setTasks(normalize(load(workspace)));
  }, [workspace]);

  // Fetch from Supabase on mount / workspace change, override local state.
  useEffect(() => {
    isSynced.current = false;
    console.log(`[useTasks] Fetching tasks for workspace: ${workspace}`);
    fetchTasks().then((remote) => {
      if (remote && Array.isArray(remote[workspace])) {
        const remoteTasks = (remote[workspace] as Task[]).map((t) => ({
          ...t,
          status: t.status ?? (t.completed ? "done" : "pending"),
          priority: t.priority ?? "low",
        }));
        console.log(`[useTasks] Loaded tasks from Supabase:`, remoteTasks);
        setTasks(normalize(remoteTasks));
        localStorage.setItem(keyFor(workspace), JSON.stringify(remoteTasks));
      } else {
        console.log(`[useTasks] No tasks found in Supabase for workspace: ${workspace}`);
      }
      isSynced.current = true;
    });
  }, [workspace]);

  // Persist: localStorage immediately, Supabase debounced.
  useEffect(() => {
    localStorage.setItem(keyFor(workspace), JSON.stringify(tasks));
    if (!isSynced.current) return; // skip until remote load completes
    saveTasks(workspace, tasks);
  }, [tasks, workspace]);

  // Re-normalize every 30s so tasks moving into overdue reorder themselves.
  useEffect(() => {
    const id = window.setInterval(() => {
      setTasks((prev) => {
        const next = normalize(prev);
        for (let i = 0; i < next.length; i++) {
          if (next[i] !== prev[i]) return next;
        }
        return prev;
      });
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  const addTask = useCallback(
    (t: Omit<Task, "id" | "createdAt" | "completed" | "status"> & { completed?: boolean; status?: Task["status"] }) => {
      setTasks((prev) =>
        normalize([
          ...prev,
          {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            completed: false,
            status: "pending",
            priority: "low",
            ...t,
          },
        ])
      );
    },
    []
  );

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toggleTask = useCallback((id: string) => {
    setTasks((prev) =>
      normalize(
        prev.map((t) => {
          if (t.id !== id) return t;
          const completed = !t.completed;
          return { ...t, completed, status: completed ? "done" : "pending" };
        })
      )
    );
  }, []);

  const setTaskStatus = useCallback((id: string, status: Task["status"]) => {
    setTasks((prev) =>
      normalize(
        prev.map((t) => {
          if (t.id !== id) return t;
          const completed = status === "done";
          return { ...t, status, completed };
        })
      )
    );
  }, []);

  const setTaskDueDate = useCallback((id: string, dueDate: string | undefined) => {
    setTasks((prev) =>
      normalize(prev.map((t) => (t.id === id ? { ...t, dueDate } : t)))
    );
  }, []);

  const reorderTask = useCallback((activeId: string, overId: string) => {
    setTasks((prev) => {
      const active = prev.find((t) => t.id === activeId);
      if (!active) return prev;

      let dstQ: Quadrant;
      let anchorId: string | null = null;
      if ((QUADRANTS as string[]).includes(overId)) {
        dstQ = overId as Quadrant;
      } else {
        const overTask = prev.find((t) => t.id === overId);
        if (!overTask) return prev;
        dstQ = overTask.quadrant;
        anchorId = overId;
      }

      const without = prev.filter((t) => t.id !== activeId);
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

      return normalize(inserted);
    });
  }, []);

  const renameTask = useCallback((id: string, title: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
  }, []);

  const setTaskPriority = useCallback((id: string, priority: Task["priority"]) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, priority } : t)));
  }, []);

  return { tasks, addTask, removeTask, toggleTask, reorderTask, renameTask, setTaskStatus, setTaskDueDate, setTaskPriority };
}
