import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fetchSettings, saveSetting } from "@/lib/db";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Settings, Minimize2, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  startTicking,
  stopTicking,
  playTick,
  playWorkEndSound,
  playBreakEndSound,
} from "@/lib/pomodoroSound";

type Mode = "focus" | "break";

interface PomoState {
  mode: Mode;
  running: boolean;
  endsAt: number | null;
  remaining: number;
  muted: boolean;
  focusMin: number;
  breakMin: number;
}

const STORAGE_KEY = "pomodoro-state-v1";

function loadState(): PomoState {
  const defaults: PomoState = {
    mode: "focus",
    running: false,
    endsAt: null,
    remaining: 30 * 60,
    muted: false,
    focusMin: 30,
    breakMin: 5,
  };
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<PomoState>;
    const mode: Mode = parsed.mode === "break" ? "break" : "focus";
    const focusMin = typeof parsed.focusMin === "number" && parsed.focusMin > 0 ? parsed.focusMin : 30;
    const breakMin = typeof parsed.breakMin === "number" && parsed.breakMin > 0 ? parsed.breakMin : 5;
    return {
      mode,
      running: !!parsed.running,
      endsAt: typeof parsed.endsAt === "number" ? parsed.endsAt : null,
      remaining:
        typeof parsed.remaining === "number"
          ? parsed.remaining
          : (mode === "focus" ? focusMin : breakMin) * 60,
      muted: !!parsed.muted,
      focusMin,
      breakMin,
    };
  } catch {
    return defaults;
  }
}

function format(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const r = (s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}

export function PomodoroTimer() {
  const [state, setState] = useState<PomoState>(() => loadState());
  const [now, setNow] = useState(() => Date.now());
  const tickingActive = useRef(false);
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const [overlayMounted, setOverlayMounted] = useState(false);

  const remaining =
    state.running && state.endsAt !== null
      ? Math.max(0, Math.round((state.endsAt - now) / 1000))
      : state.remaining;

  const isFocus = state.mode === "focus";
  const focusModeActive = state.running && isFocus;

  // A fresh focus session should always show the fade-out overlay, even if
  // the person dismissed it during a previous session.
  useEffect(() => {
    if (focusModeActive) setOverlayDismissed(false);
  }, [focusModeActive]);

  // Mount the overlay a tick after it should show, so the opacity/blur
  // transition actually has a starting state to animate from.
  useEffect(() => {
    if (focusModeActive && !overlayDismissed) {
      const t = setTimeout(() => setOverlayMounted(true), 20);
      return () => clearTimeout(t);
    }
    setOverlayMounted(false);
  }, [focusModeActive, overlayDismissed]);

  // Persist full timer state to localStorage (for page-refresh continuity).
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  // Fetch pomodoro settings from Supabase on mount, override local state.
  useEffect(() => {
    console.log("[PomodoroTimer] Fetching pomodoro settings from Supabase...");
    fetchSettings().then((remote) => {
      if (!remote?.pomodoro) {
        console.log("[PomodoroTimer] No pomodoro settings found in Supabase.");
        return;
      }
      console.log("[PomodoroTimer] Loaded pomodoro settings from Supabase:", remote.pomodoro);
      const p = remote.pomodoro as { focusMin?: number; breakMin?: number; muted?: boolean };
      setState((s) => ({
        ...s,
        focusMin: typeof p.focusMin === "number" && p.focusMin > 0 ? p.focusMin : s.focusMin,
        breakMin: typeof p.breakMin === "number" && p.breakMin > 0 ? p.breakMin : s.breakMin,
        muted: typeof p.muted === "boolean" ? p.muted : s.muted,
      }));
    });
  }, []);

  // Sync settings-only fields (not running timer state) to Supabase.
  const { focusMin, breakMin, muted } = state;
  useEffect(() => {
    saveSetting("pomodoro", { focusMin, breakMin, muted });
  }, [focusMin, breakMin, muted]);

  useEffect(() => {
    if (!state.running) return;
    // Fast enough that this loop — not the tick's own timer — decides
    // exactly when the displayed second changes, so a tick tied to that
    // change lands within ~100ms of the real boundary instead of ~500ms+.
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [state.running]);

  useEffect(() => {
    const shouldTick = state.running && !state.muted && state.endsAt !== null;
    if (shouldTick) {
      startTicking();
      tickingActive.current = true;
    } else if (!shouldTick && tickingActive.current) {
      stopTicking();
      tickingActive.current = false;
    }
    return () => {
      if (tickingActive.current) {
        stopTicking();
        tickingActive.current = false;
      }
    };
  }, [state.running, state.muted, state.endsAt]);

  // The single source of truth for "when did the countdown's second change" —
  // the same `remaining` value rendered on screen. Playing the tick here,
  // and only here, is what guarantees sound and display can't drift apart.
  const prevRemainingRef = useRef<number | null>(null);
  useEffect(() => {
    if (!state.running || state.muted) {
      prevRemainingRef.current = null;
      return;
    }
    const prev = prevRemainingRef.current;
    prevRemainingRef.current = remaining;
    if (prev !== null && remaining !== prev) {
      playTick();
    }
  }, [remaining, state.running, state.muted]);

  useEffect(() => {
    if (!state.running || state.endsAt === null) return;
    if (now < state.endsAt) return;
    const finishedMode = state.mode;
    const nextMode: Mode = finishedMode === "focus" ? "break" : "focus";
    const nextDuration = (nextMode === "focus" ? state.focusMin : state.breakMin) * 60;
    const nextEndsAt = Date.now() + nextDuration * 1000;

    if (!state.muted) {
      if (finishedMode === "focus") playWorkEndSound();
      else playBreakEndSound();
    }

    toast({
      title: finishedMode === "focus" ? "Focus session complete!" : "Break over!",
      description:
        finishedMode === "focus"
          ? `Time for a ${state.breakMin}-minute break.`
          : "Let's get back to work.",
    });

    setState((s) => ({
      ...s,
      mode: nextMode,
      running: true,
      endsAt: nextEndsAt,
      remaining: nextDuration,
    }));
  }, [now, state.running, state.endsAt, state.mode, state.muted, state.focusMin, state.breakMin]);

  const start = useCallback(() => {
    setState((s) => {
      if (s.running) return s;
      const dflt = (s.mode === "focus" ? s.focusMin : s.breakMin) * 60;
      const secs = s.remaining > 0 ? s.remaining : dflt;
      return { ...s, running: true, endsAt: Date.now() + secs * 1000, remaining: secs };
    });
  }, []);

  const pause = useCallback(() => {
    setState((s) => {
      if (!s.running || s.endsAt === null) return s;
      const rem = Math.max(0, Math.round((s.endsAt - Date.now()) / 1000));
      return { ...s, running: false, endsAt: null, remaining: rem };
    });
  }, []);

  const reset = useCallback(() => {
    setState((s) => ({
      ...s,
      running: false,
      endsAt: null,
      remaining: (s.mode === "focus" ? s.focusMin : s.breakMin) * 60,
    }));
  }, []);

  const toggleMute = useCallback(() => {
    setState((s) => ({ ...s, muted: !s.muted }));
  }, []);

  const updateDurations = useCallback((focusMin: number, breakMin: number) => {
    setState((s) => {
      const f = Math.max(1, Math.min(180, Math.floor(focusMin) || 30));
      const b = Math.max(1, Math.min(60, Math.floor(breakMin) || 5));
      const newRemaining = s.running
        ? s.remaining
        : (s.mode === "focus" ? f : b) * 60;
      return { ...s, focusMin: f, breakMin: b, remaining: newRemaining };
    });
  }, []);

  return (
    <div className="group flex items-center gap-1.5 rounded-md border border-border/60 bg-card/70 px-2 py-1 text-xs shadow-sm">
      <span
        className={cn(
          "font-semibold",
          isFocus ? "text-foreground" : "text-primary"
        )}
      >
        {isFocus ? "Focus" : "Break"}
      </span>
      <span className="font-mono tabular-nums text-sm font-semibold text-foreground min-w-[3.25rem] text-center">
        {format(remaining)}
      </span>
      <div
        className={cn(
          "flex items-center gap-0.5 overflow-hidden transition-all duration-200",
          "max-w-[10rem] opacity-100 sm:max-w-0 sm:opacity-0 sm:group-hover:max-w-[10rem] sm:group-hover:opacity-100 sm:group-focus-within:max-w-[10rem] sm:group-focus-within:opacity-100"
        )}
      >
        {!state.running ? (
          <button
            onClick={start}
            className="h-6 w-6 grid place-items-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label={state.remaining > 0 && state.remaining < (state.mode === "focus" ? state.focusMin : state.breakMin) * 60 ? "Resume" : "Start"}
            title={state.remaining > 0 && state.remaining < (state.mode === "focus" ? state.focusMin : state.breakMin) * 60 ? "Resume" : "Start"}
          >
            <Play className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={pause}
            className="h-6 w-6 grid place-items-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Pause"
            title="Pause"
          >
            <Pause className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={reset}
          className="h-6 w-6 grid place-items-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Reset"
          title="Reset"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={toggleMute}
          className="h-6 w-6 grid place-items-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          aria-label={state.muted ? "Unmute" : "Mute"}
          title={state.muted ? "Unmute" : "Mute"}
        >
          {state.muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="h-6 w-6 grid place-items-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Settings"
              title="Settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-3 space-y-2">
            <div className="space-y-1">
              <Label htmlFor="focus-min" className="text-xs">Focus (min)</Label>
              <Input
                id="focus-min"
                type="number"
                min={1}
                max={180}
                value={state.focusMin}
                onChange={(e) => updateDurations(Number(e.target.value), state.breakMin)}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="break-min" className="text-xs">Break (min)</Label>
              <Input
                id="break-min"
                type="number"
                min={1}
                max={60}
                value={state.breakMin}
                onChange={(e) => updateDurations(state.focusMin, Number(e.target.value))}
                className="h-7 text-xs"
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {focusModeActive && !overlayDismissed && (
        <FocusOverlay
          mounted={overlayMounted}
          remaining={remaining}
          focusMin={state.focusMin}
          muted={state.muted}
          onPause={pause}
          onToggleMute={toggleMute}
          onDismiss={() => setOverlayDismissed(true)}
        />
      )}

      {focusModeActive && overlayDismissed && (
        <button
          onClick={() => setOverlayDismissed(false)}
          className="fixed bottom-5 right-5 z-[100] h-11 px-4 flex items-center gap-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-[0_0_20px_-4px_hsl(var(--primary)/0.7)] hover:opacity-90 transition-opacity"
        >
          <Flame className="h-3.5 w-3.5" />
          Back to Focus · {format(remaining)}
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Distraction Fade-Out Focus Mode — a full-screen overlay shown while a focus
   session is running. Everything else stays mounted underneath, untouched;
   the blurred backdrop is what makes it fade away, not per-element changes.
───────────────────────────────────────────────────────────────────────────── */
function FocusOverlay({
  mounted,
  remaining,
  focusMin,
  muted,
  onPause,
  onToggleMute,
  onDismiss,
}: {
  mounted: boolean;
  remaining: number;
  focusMin: number;
  muted: boolean;
  onPause: () => void;
  onToggleMute: () => void;
  onDismiss: () => void;
}) {
  const totalSec = focusMin * 60;
  const progressPct = totalSec > 0 ? Math.min(100, Math.max(0, ((totalSec - remaining) / totalSec) * 100)) : 0;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 transition-all duration-700",
        mounted ? "opacity-100 backdrop-blur-2xl bg-background/75" : "opacity-0 backdrop-blur-none bg-background/0"
      )}
    >
      <button
        onClick={onDismiss}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 h-9 w-9 grid place-items-center rounded-full border border-border/60 bg-card/70 text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        aria-label="Peek at your matrix (timer keeps running)"
        title="Peek at your matrix — timer keeps running"
      >
        <Minimize2 className="h-4 w-4" />
      </button>

      <div
        className={cn(
          "flex flex-col items-center gap-6 transition-all duration-700 delay-100",
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        )}
      >
        <div className="flex items-center gap-2 text-primary">
          <Flame className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-[0.2em]">Focus</span>
        </div>

        <div className="font-mono tabular-nums text-7xl sm:text-8xl md:text-9xl font-bold text-foreground [text-shadow:0_0_60px_hsl(var(--primary)/0.35)]">
          {format(remaining)}
        </div>

        <div className="w-64 sm:w-80 h-1 rounded-full bg-border/50 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-1000 ease-linear"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onPause}
            className="h-11 px-5 flex items-center gap-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-[0_0_24px_-4px_hsl(var(--primary)/0.7)] hover:opacity-90 transition-opacity"
          >
            <Pause className="h-4 w-4" />
            Pause
          </button>
          <button
            onClick={onToggleMute}
            className="h-11 w-11 grid place-items-center rounded-full border border-border/60 bg-card/70 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={muted ? "Unmute" : "Mute"}
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
