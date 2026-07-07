import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Settings as SettingsIcon, Sun, Moon, RotateCcw, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ACCENT_META,
  REPORT_LAYOUTS,
  useAppSettings,
  type Accent,
} from "@/hooks/useAppSettings";

export function AppSettingsButton({
  showCompleted: propShowCompleted,
  setShowCompleted: propSetShowCompleted,
}: {
  showCompleted?: boolean;
  setShowCompleted?: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const { accent, reportLayout, showCompleted: localShowCompleted, setAccent, setReportLayout, resetReportLayout, setShowCompleted: localSetShowCompleted } =
    useAppSettings();

  const showCompleted = propShowCompleted !== undefined ? propShowCompleted : localShowCompleted;
  const setShowCompleted = propSetShowCompleted !== undefined ? propSetShowCompleted : localSetShowCompleted;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="h-7 w-7 grid place-items-center rounded-md border border-border/60 bg-card/70 text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
          aria-label="Settings"
          title="Settings"
        >
          <SettingsIcon className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3 space-y-3">
        {/* Theme */}
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Theme</div>
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => theme !== "light" && toggle()}
              className={cn(
                "flex items-center justify-center gap-1.5 h-8 rounded-md border text-xs transition-colors",
                theme === "light"
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border hover:bg-accent text-muted-foreground"
              )}
            >
              <Sun className="h-3.5 w-3.5" /> Light
            </button>
            <button
              onClick={() => theme !== "dark" && toggle()}
              className={cn(
                "flex items-center justify-center gap-1.5 h-8 rounded-md border text-xs transition-colors",
                theme === "dark"
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border hover:bg-accent text-muted-foreground"
              )}
            >
              <Moon className="h-3.5 w-3.5" /> Dark
            </button>
          </div>
        </div>

        {/* Accent */}
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Accent color
          </div>
          <div className="flex items-center gap-1.5">
            {(Object.keys(ACCENT_META) as Accent[]).map((a) => (
              <button
                key={a}
                onClick={() => setAccent(a)}
                className={cn(
                  "h-6 w-6 rounded-full border-2 grid place-items-center transition-all",
                  accent === a ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                )}
                style={{ background: ACCENT_META[a].swatch }}
                aria-label={ACCENT_META[a].label}
                title={ACCENT_META[a].label}
              >
                {accent === a && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>

        {/* Report layout */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Report layout
            </div>
            <button
              onClick={resetReportLayout}
              className="text-[10px] flex items-center gap-1 text-muted-foreground hover:text-foreground"
              title="Reset report layout"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {REPORT_LAYOUTS.map((l) => (
              <button
                key={l.id}
                onClick={() => setReportLayout(l.id)}
                className={cn(
                  "text-left px-2 py-1.5 rounded-md border text-[11px] transition-colors",
                  reportLayout === l.id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-accent"
                )}
                title={l.description}
              >
                <div className="font-medium">{l.label}</div>
                <div className="text-muted-foreground text-[9px]">{l.description}</div>
              </button>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Applies to Habit Tracker charts.
          </div>
        </div>

        {/* Hide Completed Tasks */}
        <div className="flex items-center gap-2 pt-2.5 border-t border-border">
          <Checkbox
            id="show-completed-toggle"
            checked={showCompleted}
            onCheckedChange={(checked) => setShowCompleted(!!checked)}
            className="h-3.5 w-3.5"
          />
          <label
            htmlFor="show-completed-toggle"
            className="text-xs font-medium leading-none cursor-pointer text-foreground/80 select-none"
          >
            Show Completed Tasks
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}
