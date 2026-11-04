// Pure data operations for the MCP server.
//
// Everything here works on a plain copy of one user's `user_data` row
// (tasks, habits, settings) and returns a new copy. No network, no Supabase,
// so it can be unit-tested directly. The rules mirror what the web app does
// (src/hooks/useTasks.ts, src/lib/habit-store.ts, src/context/SyncContext.tsx)
// so a change made from ChatGPT looks exactly like one made in the app.

import { randomUUID } from "node:crypto";
import type { Task, Quadrant, Priority, TaskStatus, RecurringConfig, Habit } from "../../src/lib/types.js";
import {
  syncTaskCompletionToHabits,
  syncHabitCompletionToTasks,
  type HabitsStore,
  type MonthData,
} from "../../src/lib/recurring-engine.js";

export type Workspace = "personal" | "professional";
export const WORKSPACES: Workspace[] = ["personal", "professional"];

export interface UserData {
  tasks: Record<string, Task[]>;
  habits: HabitsStore;
  settings: Record<string, unknown>;
}

export class NotFoundError extends Error {}

// Same seed list the app uses when a month has never been opened.
const DEFAULT_HABITS: Habit[] = [
  { id: "wake", name: "Wake up 05:00", emoji: "⏰" },
  { id: "stretch", name: "Stretching", emoji: "🤸" },
  { id: "gym", name: "Gym", emoji: "💪" },
  { id: "read", name: "Reading", emoji: "📖" },
  { id: "plan", name: "Day Planning", emoji: "🗓️" },
  { id: "work", name: "Project Work", emoji: "🎯" },
  { id: "sugar", name: "No Sugar", emoji: "🚫" },
];

/** Fills in the defaults the app itself starts from when a row (or a part of it) is empty. */
export function normalizeUserData(row: Partial<UserData> | null | undefined): UserData {
  const tasks = (row?.tasks && typeof row.tasks === "object" ? row.tasks : {}) as Record<string, Task[]>;
  const habits = (row?.habits && typeof row.habits === "object" ? row.habits : {}) as Partial<HabitsStore>;
  return {
    tasks: {
      ...tasks,
      personal: Array.isArray(tasks.personal) ? tasks.personal : [],
      professional: Array.isArray(tasks.professional) ? tasks.professional : [],
    },
    habits: { theme: habits.theme ?? "dark", months: habits.months ?? {} },
    settings: (row?.settings && typeof row.settings === "object" ? row.settings : {}) as Record<string, unknown>,
  };
}

function recurringConfigs(data: UserData): RecurringConfig[] {
  return Array.isArray(data.settings.recurringConfigs) ? (data.settings.recurringConfigs as RecurringConfig[]) : [];
}

function findTask(data: UserData, id: string): { workspace: Workspace; index: number; task: Task } {
  for (const workspace of WORKSPACES) {
    const index = data.tasks[workspace].findIndex((t) => t.id === id);
    if (index !== -1) return { workspace, index, task: data.tasks[workspace][index] };
  }
  throw new NotFoundError(`No task with id "${id}". Call list_tasks to get current ids.`);
}

function replaceTask(data: UserData, workspace: Workspace, index: number, task: Task): UserData {
  const list = [...data.tasks[workspace]];
  list[index] = task;
  return { ...data, tasks: { ...data.tasks, [workspace]: list } };
}

// ── Tasks ────────────────────────────────────────────────────────────────

export interface TaskView extends Task {
  workspace: Workspace;
}

export function listTasks(
  data: UserData,
  filter: { workspace?: Workspace; quadrant?: Quadrant; status?: "open" | "done" | "all" } = {},
): TaskView[] {
  const status = filter.status ?? "open";
  const workspaces = filter.workspace ? [filter.workspace] : WORKSPACES;
  return workspaces.flatMap((workspace) =>
    data.tasks[workspace]
      .filter((t) => !filter.quadrant || t.quadrant === filter.quadrant)
      .filter((t) => (status === "all" ? true : status === "done" ? t.completed : !t.completed))
      .map((t) => ({ ...t, workspace })),
  );
}

export interface NewTaskInput {
  title: string;
  quadrant: Quadrant;
  workspace: Workspace;
  description?: string;
  dueDate?: string;
  priority?: Priority;
}

export function addTask(data: UserData, input: NewTaskInput, now = new Date()): { data: UserData; task: TaskView } {
  const task: Task = {
    id: randomUUID(),
    createdAt: now.toISOString(),
    completed: false,
    status: "pending",
    priority: input.priority ?? "low",
    title: input.title.trim(),
    quadrant: input.quadrant,
    ...(input.description ? { description: input.description } : {}),
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
  };
  const list = [...data.tasks[input.workspace], task];
  return {
    data: { ...data, tasks: { ...data.tasks, [input.workspace]: list } },
    task: { ...task, workspace: input.workspace },
  };
}

export interface TaskChanges {
  title?: string;
  description?: string | null;
  quadrant?: Quadrant;
  priority?: Priority;
  dueDate?: string | null;
  status?: TaskStatus;
  workspace?: Workspace;
}

export function updateTask(data: UserData, id: string, changes: TaskChanges, now = new Date()): { data: UserData; task: TaskView } {
  const found = findTask(data, id);
  let next: UserData = data;
  let task: Task = { ...found.task };

  if (changes.title !== undefined) task.title = changes.title.trim();
  if (changes.quadrant !== undefined) task.quadrant = changes.quadrant;
  if (changes.priority !== undefined) task.priority = changes.priority;
  if (changes.description !== undefined) {
    if (changes.description === null || changes.description === "") delete task.description;
    else task.description = changes.description;
  }
  if (changes.dueDate !== undefined) {
    if (changes.dueDate === null || changes.dueDate === "") delete task.dueDate;
    else task.dueDate = changes.dueDate;
  }

  // Status "done" is the same thing as completing the task, so route it through
  // setTaskCompleted to keep linked habits in step.
  if (changes.status !== undefined) {
    const wantsDone = changes.status === "done";
    if (wantsDone !== task.completed) {
      next = replaceTask(next, found.workspace, found.index, task);
      const res = setTaskCompleted(next, id, wantsDone, now);
      next = res.data;
      task = { ...res.task };
      delete (task as Partial<TaskView>).workspace;
    }
    if (!wantsDone) task.status = changes.status;
  }

  next = replaceTask(next, found.workspace, found.index, task);

  if (changes.workspace && changes.workspace !== found.workspace) {
    const from = next.tasks[found.workspace].filter((t) => t.id !== id);
    const to = [...next.tasks[changes.workspace], task];
    next = { ...next, tasks: { ...next.tasks, [found.workspace]: from, [changes.workspace]: to } };
    return { data: next, task: { ...task, workspace: changes.workspace } };
  }
  return { data: next, task: { ...task, workspace: found.workspace } };
}

export function setTaskCompleted(data: UserData, id: string, completed: boolean, now = new Date()): { data: UserData; task: TaskView } {
  const found = findTask(data, id);
  const task: Task = {
    ...found.task,
    completed,
    status: completed ? "done" : "pending",
    completedAt: completed ? now.toISOString() : undefined,
  };
  if (!completed) delete task.completedAt;

  let next = replaceTask(data, found.workspace, found.index, task);
  if (found.task.completed !== completed) {
    const res = syncTaskCompletionToHabits(task, completed, next.habits, recurringConfigs(next));
    if (res.changed) next = { ...next, habits: res.updatedHabits };
  }
  return { data: next, task: { ...task, workspace: found.workspace } };
}

export function deleteTask(data: UserData, id: string): { data: UserData; task: TaskView } {
  const found = findTask(data, id);
  const list = data.tasks[found.workspace].filter((t) => t.id !== id);
  return {
    data: { ...data, tasks: { ...data.tasks, [found.workspace]: list } },
    task: { ...found.task, workspace: found.workspace },
  };
}

// ── Habits ───────────────────────────────────────────────────────────────

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDate(date: string): { monthKey: string; day: number } {
  const m = DATE_RE.exec(date);
  if (!m) throw new Error(`Date must look like YYYY-MM-DD, got "${date}".`);
  const day = Number(m[3]);
  const daysInMonth = new Date(Number(m[1]), Number(m[2]), 0).getDate();
  if (Number(m[2]) < 1 || Number(m[2]) > 12 || day < 1 || day > daysInMonth) {
    throw new Error(`"${date}" is not a real calendar date.`);
  }
  return { monthKey: `${m[1]}-${m[2]}`, day };
}

function latestHabitsBefore(months: Record<string, MonthData>, monthKey: string): Habit[] | null {
  const keys = Object.keys(months).filter((k) => k <= monthKey).sort();
  for (let i = keys.length - 1; i >= 0; i--) {
    if (months[keys[i]]?.habits?.length) return months[keys[i]].habits;
  }
  const later = Object.keys(months).sort().find((k) => months[k]?.habits?.length);
  return later ? months[later].habits : null;
}

/** The habit list for a month, as the app would show it (seeding it the same way if the month is new). */
export function habitsForMonth(data: UserData, monthKey: string): Habit[] {
  const month = data.habits.months[monthKey];
  if (month?.habits?.length) return month.habits;
  return latestHabitsBefore(data.habits.months, monthKey) ?? DEFAULT_HABITS;
}

export interface HabitDayView {
  date: string;
  habits: Array<Habit & { done: boolean }>;
  mood?: number;
  sleep?: number;
  notes?: string;
}

export function getHabitDay(data: UserData, date: string): HabitDayView {
  const { monthKey, day } = parseDate(date);
  const log = data.habits.months[monthKey]?.days?.[day];
  const checks = log?.checks ?? {};
  return {
    date,
    habits: habitsForMonth(data, monthKey).map((h) => ({ ...h, done: !!checks[h.id] })),
    ...(log?.mood !== undefined ? { mood: log.mood } : {}),
    ...(log?.sleep !== undefined ? { sleep: log.sleep } : {}),
    ...(log?.notes ? { notes: log.notes } : {}),
  };
}

export function setHabitCheck(data: UserData, habitId: string, date: string, done: boolean): { data: UserData; day: HabitDayView } {
  const { monthKey, day } = parseDate(date);
  const habitList = habitsForMonth(data, monthKey);
  if (!habitList.some((h) => h.id === habitId)) {
    const ids = habitList.map((h) => `${h.id} (${h.name})`).join(", ");
    throw new NotFoundError(`No habit with id "${habitId}" in ${monthKey}. Habits: ${ids}.`);
  }

  const existing = data.habits.months[monthKey];
  const month: MonthData = existing?.habits?.length
    ? { ...existing, days: { ...(existing.days ?? {}) } }
    : { habits: habitList.map((h) => ({ ...h })), days: { ...(existing?.days ?? {}) } };
  const log = month.days[day] ?? { checks: {} };
  month.days[day] = { ...log, checks: { ...(log.checks ?? {}), [habitId]: done } };

  let next: UserData = {
    ...data,
    habits: { ...data.habits, months: { ...data.habits.months, [monthKey]: month } },
  };

  const wasDone = !!existing?.days?.[day]?.checks?.[habitId];
  if (wasDone !== done) {
    const res = syncHabitCompletionToTasks(habitId, day, monthKey, done, next.tasks, recurringConfigs(next));
    if (res.changed) next = { ...next, tasks: res.updatedTasks };
  }
  return { data: next, day: getHabitDay(next, date) };
}
