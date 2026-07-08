import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, CalendarClock } from "lucide-react";
import { useSync } from "@/context/SyncContext";
import type { RecurringConfig, Habit } from "@/lib/types";
import { toast } from "sonner";
import { RecurringConfigDialog } from "./RecurringConfigDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habitsList: Habit[];
}

export function RecurringTasksManagerDialog({ open, onOpenChange, habitsList }: Props) {
  const { settings, updateSetting, habits } = useSync();
  const configs = (settings.recurringConfigs as RecurringConfig[] | undefined) || [];

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<RecurringConfig | undefined>(undefined);

  const handleSaveConfig = async (newConfig: Omit<RecurringConfig, "id">) => {
    let updatedConfigs: RecurringConfig[];
    if (editingConfig && editingConfig.id) {
      const idx = configs.findIndex((c) => c.id === editingConfig.id);
      if (idx !== -1) {
        updatedConfigs = [...configs];
        updatedConfigs[idx] = { ...configs[idx], ...newConfig };
      } else {
        updatedConfigs = [...configs];
      }
    } else {
      updatedConfigs = [...configs, { id: crypto.randomUUID(), ...newConfig }];
    }
    await updateSetting("recurringConfigs", updatedConfigs);
    toast.success("Recurring configuration saved!");
  };

  const handleDeleteConfig = async (id: string) => {
    const updated = configs.filter((c) => c.id !== id);
    await updateSetting("recurringConfigs", updated);
    toast.success("Recurring configuration deleted.");
  };

  // Helper to find habit meta across all months
  const findHabitMeta = (habitId: string) => {
    for (const monthKey of Object.keys(habits.months || {})) {
      const m = habits.months[monthKey];
      if (m && m.habits) {
        const found = m.habits.find((h) => h.id === habitId);
        if (found) return found;
      }
    }
    return null;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[620px] bg-neutral-950 text-white border border-white/10 p-5 rounded-lg shadow-xl z-50">
          <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-white/10">
            <DialogTitle className="text-sm font-semibold tracking-tight text-white/90 flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4 text-primary" />
              <span>Recurring Tasks Manager</span>
            </DialogTitle>
            <button
              onClick={() => {
                setEditingConfig(undefined);
                setEditorOpen(true);
              }}
              className="h-7 px-3 flex items-center gap-1 rounded bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
              style={{ background: "var(--dashboard-accent, #10b981)" }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Task</span>
            </button>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs max-h-[350px] overflow-y-auto pr-1">
            {configs.length === 0 ? (
              <div className="py-12 text-center text-white/40 border border-dashed border-white/10 rounded-md">
                No recurring tasks configured. Create one to automate your matrix!
              </div>
            ) : (
              <div className="overflow-x-auto border border-white/10 rounded-md">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-white/5 text-white/50 border-b border-white/10">
                      <th className="p-2">Task Name</th>
                      <th className="p-2">Linked Habit</th>
                      <th className="p-2">Workspace</th>
                      <th className="p-2">Quadrant</th>
                      <th className="p-2">Schedule</th>
                      <th className="p-2">Status</th>
                      <th className="p-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {configs.map((config) => {
                      const habitMeta = config.habitId ? findHabitMeta(config.habitId) : null;
                      return (
                        <tr key={config.id} className="hover:bg-white/[0.02] border-b border-white/5">
                          <td className="p-2 font-medium">{config.taskName}</td>
                          <td className="p-2 text-white/60">
                            {habitMeta ? (
                              <span className="inline-flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded text-[10px]">
                                <span>{habitMeta.emoji}</span>
                                <span>{habitMeta.name}</span>
                              </span>
                            ) : (
                              <span className="text-white/40 italic">None</span>
                            )}
                          </td>
                          <td className="p-2 text-white/80 capitalize">
                            {config.workspace === "personal" ? "🏠 Personal" : "💼 Professional"}
                          </td>
                          <td className="p-2">
                            <span className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] uppercase font-semibold">
                              {config.quadrant === "q1" ? "Q1: Do" :
                               config.quadrant === "q2" ? "Q2: Schedule" :
                               config.quadrant === "q3" ? "Q3: Delegate" :
                               "Q4: Delete"}
                            </span>
                          </td>
                          <td className="p-2 text-white/60 capitalize">
                            {config.schedule === "custom" 
                              ? `Every ${config.customValue} ${config.customUnit}`
                              : config.schedule}
                          </td>
                          <td className="p-2">
                            <button
                              onClick={async () => {
                                const updated = configs.map((c) => c.id === config.id ? { ...c, enabled: !c.enabled } : c);
                                await updateSetting("recurringConfigs", updated);
                                toast.success(config.enabled ? "Task disabled" : "Task enabled");
                              }}
                              className={`px-2 py-0.5 rounded text-[9px] font-semibold border ${
                                config.enabled
                                  ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/30"
                                  : "bg-red-950/40 text-red-400 border-red-500/30"
                              }`}
                            >
                              {config.enabled ? "Active" : "Disabled"}
                            </button>
                          </td>
                          <td className="p-2 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingConfig(config);
                                  setEditorOpen(true);
                                }}
                                className="p-1 hover:bg-white/10 rounded text-white/70 hover:text-white"
                                title="Edit"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteConfig(config.id)}
                                className="p-1 hover:bg-red-950/40 rounded text-red-400/80 hover:text-red-400"
                                title="Delete"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <RecurringConfigDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        habitId={editingConfig?.habitId}
        habitName={editingConfig?.habitId ? findHabitMeta(editingConfig.habitId)?.name : undefined}
        initialConfig={editingConfig}
        habitsList={habitsList}
        onSave={handleSaveConfig}
      />
    </>
  );
}
