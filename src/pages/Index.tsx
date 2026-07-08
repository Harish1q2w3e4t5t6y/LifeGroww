import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, Check, Moon, Sun, LayoutDashboard, LogOut, MoreHorizontal, Briefcase, Home, Layers, CalendarClock } from "lucide-react";
import { Link } from "react-router-dom";
import { RecurringTasksManagerDialog } from "@/components/RecurringTasksManagerDialog";
import type { Habit } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTasks } from "@/hooks/useTasks";
import { useTheme } from "@/hooks/useTheme";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAppSettings } from "@/hooks/useAppSettings";
import { QUADRANT_META, type Quadrant, type Task } from "@/lib/types";
import { TaskCard } from "@/components/TaskCard";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { SoundSettingsButton } from "@/components/SoundSettings";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { AppSettingsButton } from "@/components/AppSettings";
import { useDeadlineWatcher, useHourlyChime } from "@/hooks/useNotifications";
import { useAuth } from "@/context/AuthContext";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSync } from "@/context/SyncContext";


const bgColor: Record<Quadrant, string> = {
  q1: "bg-q1/40",
  q2: "bg-q2/40",
  q3: "bg-q3/40",
  q4: "bg-q4/40",
};
const ringColor: Record<Quadrant, string> = {
  q1: "ring-q1",
  q2: "ring-q2",
  q3: "ring-q3",
  q4: "ring-q4",
};

function Quad({
  quadrant,
  tasks,
  onToggle,
  onDelete,
  onRename,
  onSetStatus,
  onSetDueDate,
  onSetPriority,
  onAdd,
  activeId,
}: {
  quadrant: Quadrant;
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onSetStatus: (id: string, status: import("@/lib/types").TaskStatus) => void;
  onSetDueDate: (id: string, dueDate: string | undefined) => void;
  onSetPriority: (id: string, priority: import("@/lib/types").Priority) => void;
  onAdd: (q: Quadrant, title: string) => void;
  activeId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: quadrant });
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const meta = QUADRANT_META[quadrant];

  const submit = () => {
    const v = value.trim();
    if (v) onAdd(quadrant, v);
    setValue("");
    setAdding(false);
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative flex flex-col h-auto md:h-full min-h-[220px] md:min-h-0 overflow-hidden transition-all p-4",
        bgColor[quadrant],
        isOver && cn("ring-2 ring-inset", ringColor[quadrant])
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-lg md:text-xl font-bold tracking-tight text-foreground/80">{meta.title}</h2>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{meta.subtitle}</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="h-7 w-7 grid place-items-center rounded-md bg-card/60 hover:bg-card border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Add task"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {adding && (
          <div className="flex items-center gap-1.5 bg-card rounded-md px-2 py-1.5 border border-primary/40 shadow-sm">
            <Input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") {
                  setValue("");
                  setAdding(false);
                }
              }}
              onBlur={submit}
              placeholder="Task name..."
              className="h-6 px-1 border-0 shadow-none focus-visible:ring-0 text-[13px]"
            />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={submit}
              className="text-primary"
              aria-label="Confirm"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onToggle={onToggle}
              onDelete={onDelete}
              onRename={onRename}
              onSetStatus={onSetStatus}
              onSetDueDate={onSetDueDate}
              onSetPriority={onSetPriority}
              dragging={activeId === t.id}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && !adding && (
          <div className="h-full min-h-24 flex items-center justify-center">
            <p className="text-xs text-muted-foreground/60 italic">Drop or add tasks here</p>
          </div>
        )}
      </div>
    </div>
  );
}

const Index = () => {
  const { user, logout } = useAuth();
  const { workspace, setWorkspace } = useWorkspace();
  const { showCompleted, setShowCompleted } = useAppSettings(); // apply accent settings globally & get showCompleted
  const { tasks, addTask, removeTask, reorderTask, toggleTask, renameTask, setTaskStatus, setTaskDueDate, setTaskPriority } = useTasks(workspace);
  useDeadlineWatcher(tasks);
  useHourlyChime();
  const { theme, toggle: toggleTheme } = useTheme();
  const [activeId, setActiveId] = useState<string | null>(null);

  const { habits } = useSync();
  const [managerOpen, setManagerOpen] = useState(false);

  const habitsList = useMemo(() => {
    const list: Habit[] = [];
    const ids = new Set<string>();
    for (const monthKey of Object.keys(habits.months || {})) {
      const m = habits.months[monthKey];
      if (m && m.habits) {
        for (const h of m.habits) {
          if (!ids.has(h.id)) {
            ids.add(h.id);
            list.push(h);
          }
        }
      }
    }
    return list;
  }, [habits]);


  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const byQuadrant: Record<Quadrant, Task[]> = { q1: [], q2: [], q3: [], q4: [] };
  const visibleTasks = showCompleted ? tasks : tasks.filter((t) => !t.completed);
  visibleTasks.forEach((t) => byQuadrant[t.quadrant]?.push(t));

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const activeId = String(e.active.id);
    const overId = String(e.over.id);
    if (activeId === overId) return;
    reorderTask(activeId, overId);
  };

  const handleAdd = (quadrant: Quadrant, title: string) => {
    addTask({ title, quadrant, priority: "low" });
  };

  const activeTask = tasks.find((t) => t.id === activeId) ?? null;

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-border bg-card/60 backdrop-blur-sm">
        <button
          onClick={() => setWorkspace(workspace === "personal" ? "professional" : "personal")}
          className="flex items-center gap-2 text-foreground hover:text-primary transition-colors cursor-pointer select-none text-left"
          title={`Switch to ${workspace === "personal" ? "Professional" : "Personal"} Workspace`}
        >
          <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-primary/60 grid place-items-center text-primary-foreground font-bold text-sm shrink-0">E</div>
          <span className="text-xs sm:text-sm font-bold truncate max-w-[120px] sm:max-w-none">
            {workspace === "personal" ? "Personal" : "Professional"}
          </span>
        </button>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <SyncStatusIndicator />
          <PomodoroTimer />
          
          <button
            onClick={() => setWorkspace(workspace === "personal" ? "professional" : "personal")}
            className="h-7 px-2 flex items-center gap-1 rounded-md border border-border/60 bg-card/70 text-muted-foreground hover:text-foreground hover:bg-card transition-colors shrink-0"
            title={`Switch to ${workspace === "personal" ? "Professional" : "Personal"} Workspace`}
          >
            {workspace === "personal" ? <Home className="h-3.5 w-3.5" /> : <Briefcase className="h-3.5 w-3.5" />}
            <span className="text-[11px] font-medium hidden sm:inline">
              {workspace === "personal" ? "Personal" : "Professional"}
            </span>
          </button>
          
          <button
            onClick={toggleTheme}
            className="h-7 w-7 grid place-items-center rounded-md border border-border/60 bg-card/70 text-muted-foreground hover:text-foreground hover:bg-card transition-colors shrink-0"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          <button
            onClick={() => setManagerOpen(true)}
            className="h-7 w-7 grid place-items-center rounded-md border border-border/60 bg-card/70 text-muted-foreground hover:text-foreground hover:bg-card transition-colors shrink-0"
            title="Recurring Tasks Manager"
          >
            <CalendarClock className="h-3.5 w-3.5" />
          </button>

          {/* Desktop/Tablet secondary controls */}
          <div className="hidden sm:flex items-center gap-1.5">
            <SoundSettingsButton />
            <Link
              to="/dashboard"
              className="h-7 w-7 grid place-items-center rounded-md border border-border/60 bg-card/70 text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
              aria-label="Open habit dashboard"
              title="Habit Dashboard"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
            </Link>
            <AppSettingsButton showCompleted={showCompleted} setShowCompleted={setShowCompleted} />
            {user && (
              <button
                onClick={logout}
                className="h-7 w-7 grid place-items-center rounded-md border border-border/60 bg-card/70 text-muted-foreground hover:text-destructive hover:bg-card transition-colors"
                aria-label="Sign Out"
                title="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Mobile dropdown for secondary controls */}
          <div className="sm:hidden">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="h-7 w-7 grid place-items-center rounded-md border border-border/60 bg-card/70 text-muted-foreground hover:text-foreground hover:bg-card transition-colors shrink-0"
                  aria-label="More options"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-48 p-2 flex flex-col gap-1.5 bg-neutral-950 border border-white/10 text-white rounded-lg shadow-xl z-50">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/50 px-2 py-1">More Options</div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-white/5 text-xs text-muted-foreground hover:text-white transition-colors">
                    <span>Sound Alerts</span>
                    <SoundSettingsButton />
                  </div>
                  <Link
                    to="/dashboard"
                    className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-white/5 text-xs text-muted-foreground hover:text-white transition-colors"
                  >
                    <span>Habits Game</span>
                    <LayoutDashboard className="h-3.5 w-3.5" />
                  </Link>
                  <div className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-white/5 text-xs text-muted-foreground hover:text-white transition-colors">
                    <span>Settings</span>
                    <AppSettingsButton showCompleted={showCompleted} setShowCompleted={setShowCompleted} />
                  </div>
                  {user && (
                    <button
                      onClick={logout}
                      className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-red-500/10 text-xs text-red-400 hover:text-red-300 transition-colors w-full text-left"
                    >
                      <span>Sign Out</span>
                      <LogOut className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

      </header>

      <main className="flex-1 relative overflow-y-auto md:overflow-hidden">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 md:grid-rows-2 h-auto md:h-full">
            <Quad quadrant="q1" tasks={byQuadrant.q1} onToggle={toggleTask} onDelete={removeTask} onRename={renameTask} onSetStatus={setTaskStatus} onSetDueDate={setTaskDueDate} onSetPriority={setTaskPriority} onAdd={handleAdd} activeId={activeId} />
            <Quad quadrant="q2" tasks={byQuadrant.q2} onToggle={toggleTask} onDelete={removeTask} onRename={renameTask} onSetStatus={setTaskStatus} onSetDueDate={setTaskDueDate} onSetPriority={setTaskPriority} onAdd={handleAdd} activeId={activeId} />
            <Quad quadrant="q3" tasks={byQuadrant.q3} onToggle={toggleTask} onDelete={removeTask} onRename={renameTask} onSetStatus={setTaskStatus} onSetDueDate={setTaskDueDate} onSetPriority={setTaskPriority} onAdd={handleAdd} activeId={activeId} />
            <Quad quadrant="q4" tasks={byQuadrant.q4} onToggle={toggleTask} onDelete={removeTask} onRename={renameTask} onSetStatus={setTaskStatus} onSetDueDate={setTaskDueDate} onSetPriority={setTaskPriority} onAdd={handleAdd} activeId={activeId} />

          </div>

          <div className="pointer-events-none absolute inset-0 hidden md:block">
            <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border" />
          </div>

          <DragOverlay dropAnimation={null}>
            {activeTask && (
              <div className="rotate-2">
                <TaskCard task={activeTask} onToggle={() => {}} onDelete={() => {}} />
              </div>
            )}
          </DragOverlay>
        </DndContext>

      </main>

      <RecurringTasksManagerDialog
        open={managerOpen}
        onOpenChange={setManagerOpen}
        habitsList={habitsList}
      />
    </div>
  );
};

export default Index;
