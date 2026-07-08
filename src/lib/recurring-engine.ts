import type { Task, RecurringConfig, Habit } from "@/lib/types";

export interface MonthData {
  habits: Habit[];
  days: Record<number, {
    checks: Record<string, boolean>;
    mood?: number;
    sleep?: number;
    notes?: string;
  }>;
}

export interface HabitsStore {
  theme: string;
  months: Record<string, MonthData>;
}

// Timezone-safe local YYYY-MM-DD converters
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseLocalDateString(str: string): Date {
  if (!str || typeof str !== "string" || !str.includes("-")) {
    return new Date();
  }
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

// Computes expected occurrence dates based on config schedule up to target date
export function getOccurrencesUpTo(config: RecurringConfig, todayStr: string): string[] {
  if (!config.enabled) return [];
  if (!config.startDate || typeof config.startDate !== "string" || !config.startDate.includes("-")) {
    return [];
  }
  if (config.startDate > todayStr) return [];

  const occurrences: string[] = [];
  let current = parseLocalDateString(config.startDate);
  const today = parseLocalDateString(todayStr);
  const end = config.endDate ? parseLocalDateString(config.endDate) : null;

  // Max safety break to prevent infinite loops in bad configs
  let iterations = 0;
  while (current <= today && iterations < 1000) {
    iterations++;
    if (end && current > end) break;
    occurrences.push(toLocalDateString(current));

    if (config.schedule === "daily") {
      current = addDays(current, 1);
    } else if (config.schedule === "weekly") {
      current = addDays(current, 7);
    } else if (config.schedule === "monthly") {
      current = addMonths(current, 1);
    } else if (config.schedule === "3months") {
      current = addMonths(current, 3);
    } else if (config.schedule === "6months") {
      current = addMonths(current, 6);
    } else if (config.schedule === "yearly") {
      current = addYears(current, 1);
    } else if (config.schedule === "custom") {
      const val = config.customValue || 1;
      if (config.customUnit === "days") {
        current = addDays(current, val);
      } else if (config.customUnit === "weeks") {
        current = addDays(current, val * 7);
      } else if (config.customUnit === "months") {
        current = addMonths(current, val);
      } else {
        current = addDays(current, 1);
      }
    } else {
      break;
    }
  }

  return occurrences;
}

// Scans configs, checks for existing occurrences in tasks list, and appends missing ones
export function generateScheduledTasks(
  allTasks: Record<string, Task[]>,
  configs: RecurringConfig[],
  todayStr: string
): { updatedTasks: Record<string, Task[]>; generatedCount: number } {
  let generatedCount = 0;
  const updatedTasks: Record<string, Task[]> = {
    personal: [...(allTasks.personal || [])],
    professional: [...(allTasks.professional || [])],
  };

  for (const config of configs) {
    if (!config.enabled) continue;
    const occurrences = getOccurrencesUpTo(config, todayStr);
    const workspaceTasks = updatedTasks[config.workspace] || [];

    for (const occDate of occurrences) {
      const exists = workspaceTasks.some(
        (t) => t.recurringConfigId === config.id && t.recurringDate === occDate
      );
      if (!exists) {
        const newTask: Task = {
          id: crypto.randomUUID(),
          title: config.taskName,
          completed: false,
          status: "pending",
          priority: "low",
          quadrant: config.quadrant,
          createdAt: new Date().toISOString(),
          recurringConfigId: config.id,
          recurringDate: occDate,
        };
        updatedTasks[config.workspace].push(newTask);
        generatedCount++;
      }
    }
  }

  return { updatedTasks, generatedCount };
}

// Syncs a generated task completion back to the source habit checker
export function syncTaskCompletionToHabits(
  task: Task,
  completed: boolean,
  habits: HabitsStore,
  configs: RecurringConfig[]
): { updatedHabits: HabitsStore; changed: boolean } {
  if (!task.recurringConfigId || !task.recurringDate) {
    return { updatedHabits: habits, changed: false };
  }

  const config = configs.find((c) => c.id === task.recurringConfigId);
  if (!config || !config.habitId) {
    return { updatedHabits: habits, changed: false };
  }

  const [yStr, mStr, dStr] = task.recurringDate.split("-");
  const year = parseInt(yStr);
  const monthIndex = parseInt(mStr) - 1;
  const day = parseInt(dStr);

  const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  const updatedHabits = { ...habits };
  if (!updatedHabits.months) updatedHabits.months = {};
  if (!updatedHabits.months[key]) {
    updatedHabits.months[key] = { habits: [], days: {} };
  }

  const monthData = { ...updatedHabits.months[key] };
  if (!monthData.days) monthData.days = {};

  const dayData = monthData.days[day] ? { ...monthData.days[day] } : { checks: {} };
  if (!dayData.checks) dayData.checks = {};

  const currentlyChecked = !!dayData.checks[config.habitId];
  if (currentlyChecked === completed) {
    return { updatedHabits: habits, changed: false };
  }

  dayData.checks = { ...dayData.checks, [config.habitId]: completed };
  monthData.days = { ...monthData.days, [day]: dayData };
  updatedHabits.months = { ...updatedHabits.months, [key]: monthData };

  return { updatedHabits, changed: true };
}

// Syncs a toggled habit completion back to its generated task
export function syncHabitCompletionToTasks(
  habitId: string,
  day: number,
  monthKey: string,
  checked: boolean,
  allTasks: Record<string, Task[]>,
  configs: RecurringConfig[]
): { updatedTasks: Record<string, Task[]>; changed: boolean } {
  const config = configs.find((c) => c.habitId === habitId && c.enabled);
  if (!config) {
    return { updatedTasks: allTasks, changed: false };
  }

  const dateStr = `${monthKey}-${String(day).padStart(2, "0")}`;
  const workspace = config.workspace;
  const list = allTasks[workspace] || [];

  const taskIndex = list.findIndex(
    (t) => t.recurringConfigId === config.id && t.recurringDate === dateStr
  );

  if (taskIndex === -1) {
    if (checked) {
      const newTask: Task = {
        id: crypto.randomUUID(),
        title: config.taskName,
        completed: true,
        status: "done",
        priority: "low",
        quadrant: config.quadrant,
        createdAt: new Date().toISOString(),
        recurringConfigId: config.id,
        recurringDate: dateStr,
      };
      const updatedTasks = {
        ...allTasks,
        [workspace]: [...list, newTask],
      };
      return { updatedTasks, changed: true };
    }
    return { updatedTasks: allTasks, changed: false };
  }

  const task = list[taskIndex];
  if (task.completed === checked) {
    return { updatedTasks: allTasks, changed: false };
  }

  const updatedTask = {
    ...task,
    completed: checked,
    status: (checked ? "done" : "pending") as Task["status"],
  };

  const updatedList = [...list];
  updatedList[taskIndex] = updatedTask;

  const updatedTasks = {
    ...allTasks,
    [workspace]: updatedList,
  };

  return { updatedTasks, changed: true };
}
