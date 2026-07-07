import { useCallback, useEffect } from "react";
import { useSync } from "@/context/SyncContext";

export function useTheme() {
  const { settings, updateSetting } = useSync();

  const theme: "light" | "dark" = settings.theme === "light" || settings.theme === "dark"
    ? settings.theme
    : "dark"; // Default to dark theme as requested for this Eisenhower app

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggle = useCallback(
    async () => {
      const next = theme === "dark" ? "light" : "dark";
      await updateSetting("theme", next);
    },
    [theme, updateSetting]
  );

  return { theme, toggle };
}
