import { useCallback, useEffect } from "react";
import { useSync } from "@/context/SyncContext";

export type WorkspaceId = "professional" | "personal";

export const WORKSPACES: { id: WorkspaceId; label: string; emoji: string }[] = [
  { id: "professional", label: "Professional", emoji: "💼" },
  { id: "personal", label: "Personal", emoji: "🏠" },
];

export function useWorkspace() {
  const { settings, updateSetting } = useSync();
  const workspace: WorkspaceId = settings.workspace === "personal"
    ? "personal"
    : "professional";

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("workspace-personal", workspace === "personal");
    html.classList.toggle("workspace-professional", workspace === "professional");
  }, [workspace]);

  const setWorkspace = useCallback(
    async (w: WorkspaceId) => {
      await updateSetting("workspace", w);
    },
    [updateSetting]
  );

  return { workspace, setWorkspace };
}
