import { useCallback, useEffect } from "react";
import { useSync } from "@/context/SyncContext";

export type Accent = "blue" | "green" | "purple" | "orange" | "red";
export type ReportLayout = "compact" | "balanced" | "focus" | "large" | "xl" | "max";

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

interface Settings {
  accent: Accent;
  reportLayout: ReportLayout;
  showCompleted: boolean;
}

const DEFAULTS: Settings = { accent: "blue", reportLayout: DEFAULT_LAYOUT, showCompleted: true };

export function useAppSettings() {
  const { settings, updateSetting } = useSync();
  const appSettings: Settings = settings.appSettings || DEFAULTS;

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

  return { ...appSettings, setAccent, setReportLayout, resetReportLayout, setShowCompleted };
}

export function getReportLayoutRows(id: ReportLayout): string {
  return REPORT_LAYOUTS.find((l) => l.id === id)?.rows ?? REPORT_LAYOUTS[0].rows;
}
