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
import { Plus, Check, Moon, Sun, LayoutDashboard, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
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
        "relative flex flex-col h-full overflow-hidden transition-all p-4",
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
      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card/60 backdrop-blur-sm">
        <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-primary/60 grid place-items-center text-primary-foreground font-bold text-sm">E</div>
        <h1 className="text-sm font-semibold">Eisenhower Matrix</h1>
        <div className="ml-auto flex items-center gap-1.5">
          <SyncStatusIndicator />
          <PomodoroTimer />
          <SoundSettingsButton />
          <Link
            to="/dashboard"
            className="h-7 w-7 grid place-items-center rounded-md border border-border/60 bg-card/70 text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
            aria-label="Open habit dashboard"
            title="Habit Dashboard"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
          </Link>
          <WorkspaceSwitcher workspace={workspace} onChange={setWorkspace} />
          <AppSettingsButton showCompleted={showCompleted} setShowCompleted={setShowCompleted} />
          <button
            onClick={toggleTheme}
            className="h-7 w-7 grid place-items-center rounded-md border border-border/60 bg-card/70 text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
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

      </header>

      <main className="flex-1 relative overflow-hidden">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 grid-rows-4 md:grid-rows-2 h-full">
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
    </div>
  );
};

export default Index;
