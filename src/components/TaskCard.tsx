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

const PRIORITY_BG: Record<Priority, string> = {
  low: "bg-green-50 border-green-200 dark:bg-green-950/50 dark:border-green-900/60",
  medium: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/50 dark:border-yellow-900/60",
  high: "bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-900/60",
};

const PRIORITY_ICON: Record<Priority, string> = {
  low: "text-green-600 dark:text-green-400",
  medium: "text-yellow-600 dark:text-yellow-400",
  high: "text-red-600 dark:text-red-400",
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
    className:
      "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30",
  },
  done: {
    label: "Done",
    className:
      "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30",
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
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...(editing ? {} : attributes)}
      {...(editing ? {} : listeners)}
      className={cn(
        "group flex items-center gap-2 rounded-md px-2 py-1.5 shadow-sm border",
        task.completed
          ? "bg-zinc-100 border-zinc-200 text-zinc-600 dark:bg-zinc-950/60 dark:border-zinc-900 dark:text-white"
          : isOverdue
          ? "bg-red-50 border-red-200 text-card-foreground dark:bg-red-950/40 dark:border-red-900/60"
          : cn("text-card-foreground", PRIORITY_BG[task.priority]),
        !editing && "cursor-grab active:cursor-grabbing",
        "touch-none transition-all hover:shadow-md",
        (isDragging || dragging) && "opacity-50",
        task.completed && "opacity-60"
      )}
    >
      <Checkbox
        checked={task.completed}
        onCheckedChange={() => {
          if (!task.completed) playCompleteSound();
          onToggle(task.id);
        }}
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
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          <p
            className={cn(
              "text-[13px] leading-tight break-words min-w-0 flex-1 max-h-[2.4em] overflow-y-auto pr-0.5",
              task.completed && "line-through"
            )}
            title={task.title}
          >
            {task.title}
          </p>
          {isOverdue && (
            <span className="shrink-0 text-[9px] leading-none uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded border bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30">
              Overdue
            </span>
          )}
          <span
            className={cn(
              "shrink-0 text-[9px] leading-none uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded border",
              STATUS_BADGE[task.status].className
            )}
          >
            {STATUS_BADGE[task.status].label}
          </span>
        </div>
      )}

      {!editing && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onSetPriority?.(task.id, NEXT_PRIORITY[task.priority]);
          }}
          className={cn(
            "transition-opacity",
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
            "transition-opacity",
            task.status === "in_progress"
              ? "text-orange-500 opacity-100"
              : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-orange-500"
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
                "transition-opacity flex items-center gap-0.5",
                task.dueDate
                  ? isOverdue
                    ? "opacity-100 text-red-600 dark:text-red-400"
                    : "opacity-100 text-muted-foreground hover:text-foreground"
                  : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
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
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
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
            onDelete(task.id);
          }}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
          aria-label="Delete"
          title="Delete"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
