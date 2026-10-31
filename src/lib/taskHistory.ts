import type { Task } from "@/lib/types";
import { parseLocalDateString, toLocalDateString } from "@/lib/recurring-engine";

export type HistoryKind = "completed" | "due" | "overdue";

export interface HistoryEntry {
  task: Task;
  kind: HistoryKind;
  /** Completion date was not recorded (task finished before completedAt existed). */
  approximate: boolean;
}

function dayOf(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : toLocalDateString(new Date(iso));
}

/**
 * Places each task on one calendar day (YYYY-MM-DD, local time):
 * completed tasks on the day they were completed; open tasks with a due date
 * on their due day (overdue once that moment has passed). Open tasks with no
 * due date have no day and are left out.
 */
export function groupTasksByDay(tasks: Task[], now: Date = new Date()): Map<string, HistoryEntry[]> {
  const byDay = new Map<string, HistoryEntry[]>();
  const add = (day: string, entry: HistoryEntry) => {
    const list = byDay.get(day);
    if (list) list.push(entry);
    else byDay.set(day, [entry]);
  };

  for (const task of tasks) {
    if (task.completed) {
      if (task.completedAt) {
        add(dayOf(task.completedAt), { task, kind: "completed", approximate: false });
      } else {
        const fallback = task.recurringDate ?? task.dueDate ?? task.createdAt;
        if (fallback) add(dayOf(fallback), { task, kind: "completed", approximate: true });
      }
    } else if (task.dueDate) {
      let due: Date;
      if (/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) {
        due = parseLocalDateString(task.dueDate);
        due.setHours(23, 59, 59, 999);
      } else {
        due = new Date(task.dueDate);
      }
      add(dayOf(task.dueDate), { task, kind: due.getTime() < now.getTime() ? "overdue" : "due", approximate: false });
    }
  }
  return byDay;
}
