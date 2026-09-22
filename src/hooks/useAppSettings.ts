import { useCallback, useEffect, useMemo } from "react";
import { useSync } from "@/context/SyncContext";

export type Accent = "blue" | "green" | "purple" | "orange" | "red";
export type ReportLayout = "compact" | "balanced" | "focus" | "large" | "xl" | "max";
export type CompletionAnimation = "classic" | "ink";

const ACCENTS: Accent[] = ["blue", "green", "purple", "orange", "red"];

export const ACCENT_META: Record<Accent, { label: string; swatch: string }> = {
  blue:   { label: "Blue",   swatch: "hsl(220 60% 50%)" },
  green:  { label: "Green",  swatch: "hsl(150 60% 42%)" },
  purple: { label: "Purple", swatch: "hsl(265 60% 55%)" },
  orange: { label: "Orange", swatch: "hsl(25 90% 55%)" },
  red:    { label: "Red",    swatch: "hsl(0 75% 55%)" },
};

export const REPORT_LAYOUTS: {
  id: ReportLayout;
  label: string;
  rows: string;
  description: string;
}[] = [
  { id: "compact",  label: "Compact",   rows: "minmax(0,3fr) minmax(0,2fr)", description: "Tracker-heavy" },
  { id: "balanced", label: "Balanced",  rows: "minmax(0,1fr) minmax(0,1fr)", description: "Even split" },
  { id: "focus",    label: "Focus",     rows: "minmax(0,2fr) minmax(0,3fr)", description: "Slightly larger graphs" },
  { id: "large",    label: "Large",     rows: "minmax(0,1fr) minmax(0,2fr)", description: "Larger graphs" },
  { id: "xl",       label: "XL",        rows: "minmax(0,2fr) minmax(0,5fr)", description: "Very large graphs" },
  { id: "max",      label: "Max",       rows: "minmax(0,1fr) minmax(0,4fr)", description: "Maximum graph view" },
];

export const DEFAULT_LAYOUT: ReportLayout = "compact";

export const COMPLETION_ANIMATIONS: { id: CompletionAnimation; label: string; description: string }[] = [
  { id: "classic", label: "Classic", description: "Simple shrink & fade" },
  { id: "ink", label: "Ink Dissolve", description: "Dissolves into drifting ink particles" },
];

export const DEFAULT_COMPLETION_ANIMATION: CompletionAnimation = "ink";

interface Settings {
  accent: Accent;
  reportLayout: ReportLayout;
  showCompleted: boolean;
  completionAnimation: CompletionAnimation;
}

const DEFAULTS: Settings = {
  accent: "blue",
  reportLayout: DEFAULT_LAYOUT,
  showCompleted: true,
  completionAnimation: DEFAULT_COMPLETION_ANIMATION,
};

export function useAppSettings() {
  const { settings, updateSetting } = useSync();
  // Merge per-field so existing accounts saved before a new setting (e.g.
  // completionAnimation) was added still get that field's default instead
  // of undefined. Memoized so it's referentially stable across renders
  // where settings.appSettings hasn't changed (the callbacks below depend
  // on it).
  const appSettings: Settings = useMemo(
    () => ({ ...DEFAULTS, ...(settings.appSettings as Partial<Settings> | undefined) }),
    [settings.appSettings]
  );

  // Sync accent classes to DOM
  useEffect(() => {
    const html = document.documentElement;
    ACCENTS.forEach((a) => {
      html.classList.toggle(`accent-${a}`, a === appSettings.accent);
    });
  }, [appSettings.accent]);

  const setAccent = useCallback(
    async (accent: Accent) => {
      await updateSetting("appSettings", { ...appSettings, accent });
    },
    [appSettings, updateSetting]
  );

  const setReportLayout = useCallback(
    async (reportLayout: ReportLayout) => {
      await updateSetting("appSettings", { ...appSettings, reportLayout });
    },
    [appSettings, updateSetting]
  );

  const resetReportLayout = useCallback(
    async () => {
      await updateSetting("appSettings", { ...appSettings, reportLayout: DEFAULT_LAYOUT });
    },
    [appSettings, updateSetting]
  );

  const setShowCompleted = useCallback(
    async (showCompleted: boolean) => {
      await updateSetting("appSettings", { ...appSettings, showCompleted });
    },
    [appSettings, updateSetting]
  );

  const setCompletionAnimation = useCallback(
    async (completionAnimation: CompletionAnimation) => {
      await updateSetting("appSettings", { ...appSettings, completionAnimation });
    },
    [appSettings, updateSetting]
  );

  return { ...appSettings, setAccent, setReportLayout, resetReportLayout, setShowCompleted, setCompletionAnimation };
}

export function getReportLayoutRows(id: ReportLayout): string {
  return REPORT_LAYOUTS.find((l) => l.id === id)?.rows ?? REPORT_LAYOUTS[0].rows;
}
