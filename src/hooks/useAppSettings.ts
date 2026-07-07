import { useCallback, useEffect, useState } from "react";
import { fetchSettings, saveSetting } from "@/lib/db";

export type Accent = "blue" | "green" | "purple" | "orange" | "red";
export type ReportLayout = "compact" | "balanced" | "focus" | "large" | "xl" | "max";

const KEY = "eisenhower.appSettings.v1";
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

function parseSettings(raw: unknown): Settings {
  const parsed = raw as Partial<Settings>;
  return {
    accent: ACCENTS.includes(parsed?.accent as Accent) ? (parsed.accent as Accent) : "blue",
    reportLayout:
      REPORT_LAYOUTS.some((l) => l.id === parsed?.reportLayout)
        ? (parsed.reportLayout as ReportLayout)
        : DEFAULT_LAYOUT,
    showCompleted: parsed?.showCompleted ?? true,
  };
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return parseSettings(JSON.parse(raw));
  } catch {
    return DEFAULTS;
  }
}

export function useAppSettings() {
  const [settings, setSettings] = useState<Settings>(() => load());

  // Fetch from Supabase on mount, override local settings.
  useEffect(() => {
    console.log("[useAppSettings] Fetching app settings from Supabase...");
    fetchSettings().then((remote) => {
      if (!remote?.appSettings) {
        console.log("[useAppSettings] No app settings found in Supabase.");
        return;
      }
      console.log("[useAppSettings] Loaded app settings from Supabase:", remote.appSettings);
      const parsed = parseSettings(remote.appSettings);
      setSettings(parsed);
      localStorage.setItem(KEY, JSON.stringify(parsed));
    });
  }, []);

  // Persist to localStorage + Supabase on every settings change.
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings));
    const html = document.documentElement;
    ACCENTS.forEach((a) => html.classList.toggle(`accent-${a}`, a === settings.accent));
    saveSetting("appSettings", settings);
  }, [settings]);

  const setAccent = useCallback(
    (accent: Accent) => setSettings((s) => ({ ...s, accent })),
    []
  );
  const setReportLayout = useCallback(
    (reportLayout: ReportLayout) => setSettings((s) => ({ ...s, reportLayout })),
    []
  );
  const resetReportLayout = useCallback(
    () => setSettings((s) => ({ ...s, reportLayout: DEFAULT_LAYOUT })),
    []
  );
  const setShowCompleted = useCallback(
    (showCompleted: boolean) => setSettings((s) => ({ ...s, showCompleted })),
    []
  );

  return { ...settings, setAccent, setReportLayout, resetReportLayout, setShowCompleted };
}

export function getReportLayoutRows(id: ReportLayout): string {
  return REPORT_LAYOUTS.find((l) => l.id === id)?.rows ?? REPORT_LAYOUTS[0].rows;
}
