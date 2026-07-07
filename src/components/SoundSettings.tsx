import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  getSoundSettings,
  setSoundSetting,
  subscribeSoundSettings,
  type SoundSettings as Settings,
} from "@/lib/soundSettings";
import { cn } from "@/lib/utils";

const ROWS: { key: keyof Omit<Settings, "master">; label: string }[] = [
  { key: "taskComplete", label: "Task Completion" },
  { key: "pomoTick", label: "Pomodoro Tick" },
  { key: "pomoBell", label: "Pomodoro End Bell" },
  { key: "deadline", label: "Deadline Alert" },
  { key: "hourly", label: "Hourly Chime" },
];

export function SoundSettingsButton() {
  const [settings, setSettings] = useState<Settings>(() => getSoundSettings());

  useEffect(() => {
    const unsub = subscribeSoundSettings(setSettings);
    return () => {
      unsub();
    };
  }, []);

  const master = settings.master;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "h-7 w-7 grid place-items-center rounded-md border border-border/60 bg-card/70 transition-colors",
            master
              ? "text-muted-foreground hover:text-foreground hover:bg-card"
              : "text-destructive hover:bg-card"
          )}
          aria-label="Sound settings"
          title="Sound settings"
        >
          {master ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="snd-master" className="text-xs font-semibold">
            Master Sound
          </Label>
          <Switch
            id="snd-master"
            checked={settings.master}
            onCheckedChange={(v) => setSoundSetting("master", v)}
          />
        </div>
        <div className="h-px bg-border" />
        <div className="space-y-2">
          {ROWS.map((r) => (
            <div key={r.key} className="flex items-center justify-between">
              <Label
                htmlFor={`snd-${r.key}`}
                className={cn("text-xs", !master && "opacity-50")}
              >
                {r.label}
              </Label>
              <Switch
                id={`snd-${r.key}`}
                disabled={!master}
                checked={settings[r.key]}
                onCheckedChange={(v) => setSoundSetting(r.key, v)}
              />
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
