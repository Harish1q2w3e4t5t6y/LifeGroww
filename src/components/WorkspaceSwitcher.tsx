import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, Briefcase } from "lucide-react";
import { WORKSPACES, type WorkspaceId } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";

interface Props {
  workspace: WorkspaceId;
  onChange: (w: WorkspaceId) => void;
}

export function WorkspaceSwitcher({ workspace, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const current = WORKSPACES.find((w) => w.id === workspace) ?? WORKSPACES[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="h-7 px-2 grid grid-flow-col items-center gap-1 rounded-md border border-border/60 bg-card/70 text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
          aria-label={`Workspace: ${current.label}`}
          title={`Workspace: ${current.label}`}
        >
          <Briefcase className="h-3.5 w-3.5" />
          <span className="text-[11px] font-medium hidden sm:inline">{current.emoji}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 pt-1 pb-0.5">
          Workspace
        </div>
        {WORKSPACES.map((w) => (
          <button
            key={w.id}
            onClick={() => {
              onChange(w.id);
              setOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-accent transition-colors",
              w.id === workspace && "bg-accent"
            )}
          >
            <span className="text-base leading-none">{w.emoji}</span>
            <span className="flex-1 text-left">{w.label}</span>
            {w.id === workspace && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
