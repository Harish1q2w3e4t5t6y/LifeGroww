import { useEffect, useState } from "react";
import { fetchSettings, saveSetting } from "@/lib/db";

export type WorkspaceId = "professional" | "personal";

const KEY = "eisenhower.workspace.v1";

export const WORKSPACES: { id: WorkspaceId; label: string; emoji: string }[] = [
  { id: "professional", label: "Professional", emoji: "💼" },
  { id: "personal", label: "Personal", emoji: "🏠" },
];

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<WorkspaceId>(() => {
    const v = localStorage.getItem(KEY);
    return v === "personal" ? "personal" : "professional";
  });

  // Fetch from Supabase on mount, override local workspace.
  useEffect(() => {
    console.log("[useWorkspace] Fetching workspace settings from Supabase...");
    fetchSettings().then((remote) => {
      if (!remote?.workspace) {
        console.log("[useWorkspace] No workspace setting found in Supabase.");
        return;
      }
      const w = remote.workspace === "personal" ? "personal" : "professional";
      console.log(`[useWorkspace] Loaded workspace from Supabase: ${w}`);
      setWorkspace(w);
      localStorage.setItem(KEY, w);
    });
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, workspace);
    document.documentElement.classList.toggle("workspace-personal", workspace === "personal");
    document.documentElement.classList.toggle("workspace-professional", workspace === "professional");
    saveSetting("workspace", workspace);
  }, [workspace]);

  return { workspace, setWorkspace };
}
