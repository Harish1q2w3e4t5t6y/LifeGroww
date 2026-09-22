import { useEffect, useMemo, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X, Pencil, Zap, Clock, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Task, TaskStatus, Priority } from "@/lib/types";
import { playCompleteSound } from "@/lib/sound";
import { useAppSettings } from "@/hooks/useAppSettings";
import { fireTaskCompleteEffect } from "@/lib/taskCompleteEffectBus";

const NEXT_PRIORITY: Record<Priority, Priority> = {
  low: "medium",
  medium: "high",
  high: "low",
};

interface Props {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  onSetStatus?: (id: string, status: TaskStatus) => void;
  onSetDueDate?: (id: string, dueDate: string | undefined) => void;
  onSetPriority?: (id: string, priority: Priority) => void;
  dragging?: boolean;
}

// Each priority and status gets its own distinct color family.
const PRIORITY_BG: Record<Priority, string> = {
  low: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-900/60",
  medium: "bg-amber-50 border-amber-200 dark:bg-amber-500/15 dark:border-amber-500/30",
  high: "bg-rose-50 border-rose-200 dark:bg-rose-950/50 dark:border-rose-900/60",
};

const PRIORITY_ICON: Record<Priority, string> = {
  low: "text-emerald-600 dark:text-emerald-400",
  medium: "text-amber-600 dark:text-amber-400",
  high: "text-rose-600 dark:text-rose-400",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const STATUS_BADGE: Record<TaskStatus, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "bg-muted text-muted-foreground border-border",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30",
  },
  done: {
    label: "Done",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30",
  },
};

// Convert ISO string <-> value expected by <input type="datetime-local">.
function isoToLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToIso(v: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function formatCountdown(iso: string): { text: string; overdue: boolean } {
  const target = new Date(iso).getTime();
  const diff = target - Date.now();
  const overdue = diff < 0;
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  let text: string;
  if (days >= 1) text = `${days}d ${hours % 24}h`;
  else if (hours >= 1) text = `${hours}h ${mins % 60}m`;
  else text = `${mins}m`;
  return { text: overdue ? `${text} late` : `in ${text}`, overdue };
}

export function TaskCard({
  task,
  onToggle,
  onDelete,
  onRename,
  onSetStatus,
  onSetDueDate,
  onSetPriority,
  dragging,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, disabled: false });

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.title);
  const savedRef = useRef(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<string>(isoToLocalInput(task.dueDate));

  // Checking a task off (or deleting it) plays a shrink-and-fade exit before
  // the underlying data actually changes, instead of the row just vanishing
  // the instant the checkbox toggles. Re-opening a completed task (unchecking
  // it) skips this — there's nothing leaving in that direction.
  //
  // This exit ONLY plays when the row is actually about to disappear from
  // the list (showCompleted is off, so the parent will filter it out right
  // after). When showCompleted is on, the same task stays at the same spot
  // in the array — React keeps reusing this exact component instance — so
  // collapsing it here would leave it permanently stuck at 0 height/opacity
  // with nothing to ever reset `leaving` back to false. Completing a task
  // in that mode just flips its data in place instead; the row re-renders
  // with its normal "done" styling (checked box, strikethrough) rather than
  // vanishing.
  const [leaving, setLeaving] = useState(false);
  const EXIT_MS = 260;

  useEffect(() => {
    if (!task.completed) setLeaving(false);
  }, [task.completed]);

  // For non-"classic" completion animations, a big fullscreen effect plays
  // on top of the whole page (fired via the bus to <TaskCompleteEffectHost>
  // at the app root — see taskCompleteEffectBus.ts for why it can't just
  // render locally), launched from this row's on-screen position at the
  // moment it's checked off. It's entirely decoupled from `leaving` below —
  // the row still collapses out of the list at its normal fast pace
  // regardless of how long the celebratory overlay takes, so completing
  // several tasks quickly never feels blocked by the animation.
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { completionAnimation, showCompleted } = useAppSettings();

  // Priority color change wipes in from the flag button's side (right) instead
  // of the background snapping instantly. `baseColorPriority` is what the row's
  // own background shows — it holds the *old* color while an overlay in the new
  // color grows in from the right; once that finishes, the base catches up and
  // the (now invisible, fully-grown) overlay is dropped.
  const prevPriorityRef = useRef(task.priority);
  const [baseColorPriority, setBaseColorPriority] = useState(task.priority);
  const [priorityWiping, setPriorityWiping] = useState(false);
  const WIPE_MS = 500;

  useEffect(() => {
    if (task.priority === prevPriorityRef.current) return;
    prevPriorityRef.current = task.priority;
    setPriorityWiping(false);
    const raf = requestAnimationFrame(() => setPriorityWiping(true));
    const done = window.setTimeout(() => {
      setBaseColorPriority(task.priority);
      setPriorityWiping(false);
    }, WIPE_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(done);
    };
  }, [task.priority]);

  const handleToggle = () => {
    if (task.completed) {
      onToggle(task.id);
      return;
    }
    playCompleteSound();
    if (completionAnimation !== "classic" && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      fireTaskCompleteEffect({
        type: completionAnimation,
        origin: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        title: task.title,
      });
    }
    if (showCompleted) {
      // The row is staying put — just flip the data so it re-renders with
      // its normal "done" styling, no collapse.
      onToggle(task.id);
      return;
    }
    setLeaving(true);
    window.setTimeout(() => onToggle(task.id), EXIT_MS);
  };

  const handleDelete = () => {
    setLeaving(true);
    window.setTimeout(() => onDelete(task.id), EXIT_MS);
  };

  useEffect(() => {
    if (!editing) setValue(task.title);
  }, [task.title, editing]);
  useEffect(() => {
    setDraftDate(isoToLocalInput(task.dueDate));
  }, [task.dueDate]);

  const save = () => {
    if (savedRef.current) return;
    savedRef.current = true;
    const v = value.trim();
    if (v && v !== task.title) onRename?.(task.id, v);
    setEditing(false);
  };
  const cancel = () => {
    savedRef.current = true;
    setValue(task.title);
    setEditing(false);
  };

  const countdown = useMemo(
    () => (task.dueDate ? formatCountdown(task.dueDate) : null),
    [task.dueDate]
  );
  const isOverdue = !!countdown?.overdue && !task.completed;

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        cardRef.current = el;
      }}
      style={{
        transform: CSS.Translate.toString(transform),
        // Explicit property list (not a plain "all") so this doesn't silently
        // swallow the hover/color transitions already declared via Tailwind's
        // transition-all class below — inline `transition` always wins over a
        // class for the same CSS property, so those need to be named here too.
        transition: [
          "background-color 200ms ease, border-color 200ms ease, box-shadow 200ms ease",
          transition,
          "max-height 260ms ease, margin-top 260ms ease, padding 260ms ease, opacity 260ms ease",
        ]
          .filter(Boolean)
          .join(", "),
        maxHeight: leaving ? "0px" : "80px",
        overflow: "hidden",
        ...(leaving ? { marginTop: 0, paddingTop: 0, paddingBottom: 0, opacity: 0 } : {}),
      }}
      {...(editing ? {} : attributes)}
      {...(editing ? {} : listeners)}
      className={cn(
        "group relative isolate rounded-md px-2 py-1.5 shadow-sm border",
        task.completed
          ? "bg-zinc-100 border-zinc-200 text-zinc-600 dark:bg-zinc-950/60 dark:border-zinc-900 dark:text-white"
          : isOverdue
          ? "bg-red-50 border-red-200 text-card-foreground dark:bg-red-950/40 dark:border-red-900/60"
          : cn("text-card-foreground", PRIORITY_BG[baseColorPriority]),
        !editing && "cursor-grab active:cursor-grabbing",
        "touch-none transition-all hover:shadow-md hover:-translate-y-px animate-[task-row-in_0.25s_ease-out]",
        (isDragging || dragging) && "opacity-50",
        task.completed && "opacity-60",
        leaving && "scale-95"
      )}
    >
      {!task.completed && !isOverdue && (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 rounded-md z-0 origin-right transition-transform duration-500 ease-out",
            PRIORITY_BG[task.priority]
          )}
          style={{ transform: priorityWiping ? "scaleX(1)" : "scaleX(0)" }}
        />
      )}
      <div className="relative z-10 flex flex-wrap items-center gap-1.5 w-full">
      <Checkbox
        checked={task.completed}
        onCheckedChange={handleToggle}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="h-3.5 w-3.5"
      />
      {editing ? (
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          onFocus={() => {
            savedRef.current = false;
          }}
          onBlur={save}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="h-6 px-1 border-0 shadow-none focus-visible:ring-0 text-[13px] flex-1"
        />
      ) : (
        <div className="flex-1 flex items-center gap-1.5 min-w-[90px]">
          <p
            className={cn(
              // Smaller text on mobile so more of the title fits per line
              // (cards are half-width there, in the 2x2 grid).
              "text-[11px] sm:text-[13px] leading-tight min-w-0 flex-1 pr-0.5",
              // Full title text on every breakpoint, wrapping up to ~2 lines
              // with internal scroll for anything longer. The quadrant panel
              // itself scrolls for overflow, so taller cards on mobile don't
              // break the single-screen Matrix layout.
              "whitespace-normal break-words max-h-[2.4em] overflow-y-auto",
              task.completed && "line-through"
            )}
            title={task.title}
          >
            {task.title}
          </p>
          {isOverdue && (
            <span className="hidden sm:inline-flex shrink-0 text-[9px] leading-none uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded border bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30">
              Overdue
            </span>
          )}
          <span
            className={cn(
              "hidden sm:inline-flex shrink-0 text-[9px] leading-none uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded border",
              STATUS_BADGE[task.status].className
            )}
          >
            {STATUS_BADGE[task.status].label}
          </span>
        </div>
      )}

      {/* Action icons wrap onto their own row as a group on narrow screens
          instead of individually squeezing the title down to a few
          characters per line. Hidden entirely on mobile — just the task
          text + checkbox there, per request; still full on tablet/desktop. */}
      <div className="hidden sm:flex items-center gap-0.5 ml-auto shrink-0">
      {!editing && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onSetPriority?.(task.id, NEXT_PRIORITY[task.priority]);
          }}
          className={cn(
            "transition-opacity p-1 sm:p-0.5 shrink-0",
            PRIORITY_ICON[task.priority],
            "opacity-100 hover:brightness-110"
          )}
          aria-label={`Priority: ${PRIORITY_LABEL[task.priority]} (click to change)`}
          title={`Priority: ${PRIORITY_LABEL[task.priority]} — click to cycle`}
        >
          <Flag className="h-3.5 w-3.5" fill="currentColor" strokeWidth={1.5} />
        </button>
      )}

      {!editing && !task.completed && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onSetStatus?.(
              task.id,
              task.status === "in_progress" ? "pending" : "in_progress"
            );
          }}
          className={cn(
            "transition-opacity p-1 sm:p-0.5 shrink-0",
            task.status === "in_progress"
              ? "text-orange-500 opacity-100"
              : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-orange-500"
          )}
          aria-label={
            task.status === "in_progress"
              ? "Set to pending"
              : "Set to in progress"
          }
          title={
            task.status === "in_progress"
              ? "Set to Pending"
              : "Set to In Progress"
          }
        >
          <Zap className="h-3.5 w-3.5" />
        </button>
      )}

      {!editing && (
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "transition-opacity flex items-center gap-0.5 p-1 sm:p-0.5 shrink-0",
                task.dueDate
                  ? isOverdue
                    ? "opacity-100 text-red-600 dark:text-red-400"
                    : "opacity-100 text-muted-foreground hover:text-foreground"
                  : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-foreground"
              )}
              aria-label={task.dueDate ? "Edit deadline" : "Set deadline"}
              title={task.dueDate ? `Deadline: ${new Date(task.dueDate).toLocaleString()}` : "Set deadline"}
            >
              <Clock className="h-3.5 w-3.5" />
              {countdown && (
                <span className="text-[9px] font-medium hidden sm:inline">
                  {countdown.text}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-60 p-3 space-y-2"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="text-xs font-semibold text-foreground">
              {task.dueDate ? "Edit deadline" : "Set deadline"}
            </div>
            <input
              type="datetime-local"
              value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)}
              className="w-full h-8 px-2 rounded border border-input bg-background text-xs"
            />
            <div className="flex items-center justify-between gap-1">
              {task.dueDate ? (
                <button
                  onClick={() => {
                    onSetDueDate?.(task.id, undefined);
                    setDateOpen(false);
                  }}
                  className="text-[11px] text-destructive hover:underline"
                >
                  Remove
                </button>
              ) : <span />}
              <div className="flex gap-1">
                <button
                  onClick={() => setDateOpen(false)}
                  className="text-[11px] px-2 py-1 rounded hover:bg-accent text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const iso = localInputToIso(draftDate);
                    onSetDueDate?.(task.id, iso);
                    setDateOpen(false);
                  }}
                  className="text-[11px] px-2 py-1 rounded bg-primary text-primary-foreground hover:opacity-90"
                >
                  Save
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {!editing && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setValue(task.title);
            setEditing(true);
          }}
          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity p-1 sm:p-0.5 shrink-0"
          aria-label="Edit"
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      {!editing && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity p-1 sm:p-0.5 shrink-0"
          aria-label="Delete"
          title="Delete"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      </div>
      </div>
    </div>
  );
}
