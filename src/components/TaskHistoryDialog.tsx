import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { QUADRANT_META, type Quadrant, type Task } from "@/lib/types";
import { groupTasksByDay, type HistoryEntry, type HistoryKind } from "@/lib/taskHistory";
import { toLocalDateString } from "@/lib/recurring-engine";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const KIND_STYLE: Record<HistoryKind, { label: string; chip: string; dot: string }> = {
  completed: {
    label: "Completed",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  due: {
    label: "Due",
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    dot: "bg-sky-500",
  },
  overdue: {
    label: "Overdue",
    chip: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
    dot: "bg-red-500",
  },
};
const KIND_ORDER: HistoryKind[] = ["overdue", "due", "completed"];
const QUADRANT_DOT: Record<Quadrant, string> = { q1: "bg-q1", q2: "bg-q2", q3: "bg-q3", q4: "bg-q4" };

function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const total = Math.ceil((offset + daysInMonth) / 7) * 7;
  return Array.from({ length: total }, (_, i) => new Date(year, month, 1 - offset + i));
}

function countKinds(entries: HistoryEntry[] | undefined): Record<HistoryKind, number> {
  const counts: Record<HistoryKind, number> = { completed: 0, due: 0, overdue: 0 };
  entries?.forEach((e) => counts[e.kind]++);
  return counts;
}

function timeOf(entry: HistoryEntry): string | null {
  if (entry.approximate) return null;
  const iso = entry.kind === "completed" ? entry.task.completedAt : entry.task.dueDate;
  if (!iso || /^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
}

export function TaskHistoryDialog({ open, onOpenChange, tasks }: Props) {
  const todayStr = toLocalDateString(new Date());
  const [cursor, setCursor] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }));
  const [selected, setSelected] = useState(todayStr);

  // Re-evaluate "overdue" against the current time each time the calendar is opened.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (open) setNow(new Date());
  }, [open]);
  const byDay = useMemo(() => groupTasksByDay(tasks, now), [tasks, now]);
  const cells = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);

  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`;
  const monthTotals = useMemo(() => {
    const totals: Record<HistoryKind, number> = { completed: 0, due: 0, overdue: 0 };
    byDay.forEach((entries, day) => {
      if (!day.startsWith(monthPrefix)) return;
      entries.forEach((e) => totals[e.kind]++);
    });
    return totals;
  }, [byDay, monthPrefix]);

  const selectedEntries = useMemo(
    () => [...(byDay.get(selected) ?? [])].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)),
    [byDay, selected]
  );

  const shiftMonth = (delta: number) =>
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const goToday = () => {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
    setSelected(todayStr);
  };

  const selectedLabel = new Date(`${selected}T12:00:00`).toLocaleDateString([], {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Task History</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => shiftMonth(-1)}
            className="h-7 w-7 grid place-items-center rounded-md border border-border/60 hover:bg-muted transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <div className="text-sm font-medium min-w-[120px] text-center">
            {MONTHS[cursor.month]} {cursor.year}
          </div>
          <button
            onClick={() => shiftMonth(1)}
            className="h-7 w-7 grid place-items-center rounded-md border border-border/60 hover:bg-muted transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={goToday}
            className="h-7 px-2.5 rounded-md border border-border/60 text-xs hover:bg-muted transition-colors"
          >
            Today
          </button>
          <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
            {(["completed", "due", "overdue"] as HistoryKind[]).map((k) => (
              <span key={k} className="flex items-center gap-1">
                <span className={cn("h-2 w-2 rounded-full", KIND_STYLE[k].dot)} />
                {KIND_STYLE[k].label} <span className="tabular-nums text-foreground">{monthTotals[k]}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-[10px] uppercase tracking-wide text-muted-foreground text-center py-1">
              {d}
            </div>
          ))}
          {cells.map((date) => {
            const key = toLocalDateString(date);
            const inMonth = date.getMonth() === cursor.month;
            const counts = countKinds(byDay.get(key));
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className={cn(
                  "h-14 sm:h-16 rounded-md border p-1 flex flex-col items-start justify-between text-left transition-colors",
                  inMonth ? "border-border/50 hover:bg-muted/60" : "border-transparent opacity-40 hover:opacity-70",
                  key === selected && "border-primary bg-primary/10",
                )}
                aria-label={`${key}: ${counts.completed} completed, ${counts.due} due, ${counts.overdue} overdue`}
              >
                <span
                  className={cn(
                    "text-[11px] tabular-nums leading-none",
                    key === todayStr && "h-5 w-5 -m-0.5 grid place-items-center rounded-full bg-primary text-primary-foreground font-semibold",
                  )}
                >
                  {date.getDate()}
                </span>
                <span className="flex flex-wrap gap-0.5">
                  {KIND_ORDER.filter((k) => counts[k] > 0).map((k) => (
                    <span
                      key={k}
                      className={cn("text-[9px] leading-none tabular-nums rounded border px-1 py-0.5", KIND_STYLE[k].chip)}
                    >
                      {counts[k]}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        <div className="border-t border-border pt-3 space-y-2">
          <div className="text-xs font-medium">{selectedLabel}</div>
          {selectedEntries.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2">No completed or due tasks on this day.</div>
          ) : (
            <ul className="space-y-1.5">
              {selectedEntries.map((entry) => {
                const time = timeOf(entry);
                return (
                  <li
                    key={entry.task.id}
                    className="flex items-center gap-2 rounded-md border border-border/50 bg-card/60 px-2.5 py-1.5"
                  >
                    <span
                      className={cn("h-2.5 w-2.5 rounded-full shrink-0", QUADRANT_DOT[entry.task.quadrant])}
                      title={QUADRANT_META[entry.task.quadrant].title}
                    />
                    <span
                      className={cn(
                        "text-xs truncate flex-1",
                        entry.kind === "completed" && "line-through text-muted-foreground",
                      )}
                      title={entry.task.title}
                    >
                      {entry.task.title}
                    </span>
                    <span className="hidden sm:inline text-[10px] text-muted-foreground shrink-0">
                      {QUADRANT_META[entry.task.quadrant].title}
                    </span>
                    {time && <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">{time}</span>}
                    {entry.approximate && (
                      <span className="text-[10px] text-muted-foreground shrink-0" title="Completed before completion dates were recorded; shown on its due or created date">
                        approx.
                      </span>
                    )}
                    <span className={cn("text-[10px] rounded border px-1.5 py-0.5 shrink-0", KIND_STYLE[entry.kind].chip)}>
                      {KIND_STYLE[entry.kind].label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
