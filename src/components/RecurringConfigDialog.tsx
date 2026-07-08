import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { RecurringConfig, Quadrant, ScheduleType, CustomUnit, Habit } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habitId?: string;
  habitName?: string;
  initialConfig?: RecurringConfig;
  habitsList?: Habit[];
  onSave: (config: Omit<RecurringConfig, "id">) => void;
}

export function RecurringConfigDialog({
  open,
  onOpenChange,
  habitId,
  habitName,
  initialConfig,
  habitsList = [],
  onSave,
}: Props) {
  const [enabled, setEnabled] = useState(false);
  const [workspace, setWorkspace] = useState<"personal" | "professional">("personal");
  const [quadrant, setQuadrant] = useState<Quadrant>("q2");
  const [taskName, setTaskName] = useState("");
  const [schedule, setSchedule] = useState<ScheduleType>("daily");
  const [customValue, setCustomValue] = useState(1);
  const [customUnit, setCustomUnit] = useState<CustomUnit>("days");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [linkedHabitId, setLinkedHabitId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (open) {
      if (initialConfig) {
        setEnabled(initialConfig.enabled);
        setWorkspace(initialConfig.workspace);
        setQuadrant(initialConfig.quadrant);
        setTaskName(initialConfig.taskName);
        setSchedule(initialConfig.schedule);
        setCustomValue(initialConfig.customValue || 1);
        setCustomUnit(initialConfig.customUnit || "days");
        setStartDate(initialConfig.startDate);
        setEndDate(initialConfig.endDate || "");
        setLinkedHabitId(initialConfig.habitId);
      } else {
        setEnabled(true);
        setWorkspace("personal");
        setQuadrant("q2");
        setTaskName(habitName || "");
        setSchedule("daily");
        setCustomValue(1);
        setCustomUnit("days");
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, "0");
        const d = String(today.getDate()).padStart(2, "0");
        setStartDate(`${y}-${m}-${d}`);
        setEndDate("");
        setLinkedHabitId(habitId);
      }
    }
  }, [open, initialConfig, habitName, habitId]);

  const handleSave = () => {
    onSave({
      habitId: linkedHabitId || undefined,
      workspace,
      quadrant,
      taskName: taskName.trim() || habitName || "Recurring Task",
      schedule,
      customValue: schedule === "custom" ? customValue : undefined,
      customUnit: schedule === "custom" ? customUnit : undefined,
      enabled,
      startDate: startDate || new Date().toISOString().split("T")[0],
      endDate: endDate || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] bg-neutral-950 text-white border border-white/10 p-5 rounded-lg shadow-xl z-50">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold tracking-tight text-white/90">
            {habitId ? `Sync Habit: ${habitName}` : initialConfig ? "Edit Recurring Task" : "New Recurring Task"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Enabled Checkbox */}
          <div className="flex items-center space-x-2 bg-white/5 p-2 rounded border border-white/5">
            <Checkbox
              id="enabled"
              checked={enabled}
              onCheckedChange={(checked) => setEnabled(!!checked)}
            />
            <Label htmlFor="enabled" className="text-white/80 cursor-pointer font-medium">
              Enable Task Synchronization
            </Label>
          </div>

          {enabled && (
            <>
              {/* Task Title */}
              <div className="space-y-1.5">
                <Label htmlFor="taskName" className="text-white/60">Task Title</Label>
                <Input
                  id="taskName"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder={habitName || "Enter task name..."}
                  className="h-8 bg-white/5 border-white/10 text-white placeholder-white/30 text-xs focus-visible:ring-primary focus-visible:ring-1"
                />
              </div>

              {/* Connected Habit */}
              <div className="space-y-1.5">
                <Label htmlFor="habitId" className="text-white/60">Connected Habit (Optional)</Label>
                <select
                  id="habitId"
                  value={linkedHabitId || ""}
                  onChange={(e) => setLinkedHabitId(e.target.value || undefined)}
                  className="w-full h-8 px-2 bg-neutral-900 border border-white/10 text-white rounded text-xs outline-none focus:border-primary"
                >
                  <option value="">-- None --</option>
                  {habitsList.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.emoji} {h.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Workspace */}
              <div className="space-y-1.5">
                <Label className="text-white/60">Workspace</Label>
                <RadioGroup
                  value={workspace}
                  onValueChange={(val) => setWorkspace(val as "personal" | "professional")}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-1.5">
                    <RadioGroupItem value="personal" id="ws-personal" className="border-white/20 text-primary" />
                    <Label htmlFor="ws-personal" className="text-white/80 cursor-pointer">Personal Matrix</Label>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <RadioGroupItem value="professional" id="ws-professional" className="border-white/20 text-primary" />
                    <Label htmlFor="ws-professional" className="text-white/80 cursor-pointer">Professional Matrix</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Target Quadrant */}
              <div className="space-y-1.5">
                <Label className="text-white/60">Target Quadrant</Label>
                <select
                  value={quadrant}
                  onChange={(e) => setQuadrant(e.target.value as Quadrant)}
                  className="w-full h-8 px-2 bg-neutral-900 border border-white/10 text-white rounded text-xs outline-none focus:border-primary"
                >
                  <option value="q1">Q1: Important & Urgent (Do)</option>
                  <option value="q2">Q2: Important & Not Urgent (Schedule)</option>
                  <option value="q3">Q3: Not Important & Urgent (Delegate)</option>
                  <option value="q4">Q4: Not Important & Not Urgent (Delete)</option>
                </select>
              </div>

              {/* Schedule Select */}
              <div className="space-y-1.5">
                <Label className="text-white/60">Recurring Schedule</Label>
                <select
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value as ScheduleType)}
                  className="w-full h-8 px-2 bg-neutral-900 border border-white/10 text-white rounded text-xs outline-none focus:border-primary"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="3months">Every 3 Months</option>
                  <option value="6months">Every 6 Months</option>
                  <option value="yearly">Yearly</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {/* Custom Schedule Details */}
              {schedule === "custom" && (
                <div className="flex items-center gap-2 bg-white/5 p-2 rounded border border-white/5">
                  <span className="text-white/60">Every</span>
                  <Input
                    type="number"
                    min={1}
                    value={customValue}
                    onChange={(e) => setCustomValue(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 h-7 bg-neutral-900 border-white/10 text-center text-xs"
                  />
                  <select
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value as CustomUnit)}
                    className="h-7 bg-neutral-900 border border-white/10 text-white rounded px-2 text-xs outline-none"
                  >
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                  </select>
                </div>
              )}

              {/* Start & End Dates */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="startDate" className="text-white/60">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-7 bg-white/5 border-white/10 text-white text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="endDate" className="text-white/60">End Date (Optional)</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-7 bg-white/5 border-white/10 text-white text-xs"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 mt-4">
          <button
            onClick={() => onOpenChange(false)}
            className="h-7 px-3 text-[11px] font-medium text-white/60 hover:text-white bg-transparent border border-white/10 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="h-7 px-4 text-[11px] font-semibold text-neutral-950 bg-primary hover:opacity-90 rounded transition-opacity"
            style={{ background: "var(--dashboard-accent, #10b981)" }}
          >
            Save Configuration
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
