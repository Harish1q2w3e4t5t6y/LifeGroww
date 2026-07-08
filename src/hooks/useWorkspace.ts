import { useCallback, useEffect } from "react";
import { useSync } from "@/context/SyncContext";

export type WorkspaceId = "professional" | "personal" | "all";

export const WORKSPACES: { id: WorkspaceId; label: string; emoji: string }[] = [
  { id: "professional", label: "Professional", emoji: "💼" },
  { id: "personal", label: "Personal", emoji: "🏠" },
  { id: "all", label: "Both", emoji: "🌐" },
];

export function useWorkspace() {
  const { settings, updateSetting } = useSync();
  const workspace: WorkspaceId = settings.workspace === "personal"
    ? "personal"
    : settings.workspace === "all"
    ? "all"
    : "professional";

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("workspace-personal", workspace === "personal");
    html.classList.toggle("workspace-professional", workspace === "professional");
    html.classList.toggle("workspace-all", workspace === "all");
  }, [workspace]);

  const setWorkspace = useCallback(
    async (w: WorkspaceId) => {
      await updateSetting("workspace", w);
    },
    [updateSetting]
  );

  return { workspace, setWorkspace };
}
