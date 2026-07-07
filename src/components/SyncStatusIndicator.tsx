import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSync } from "@/context/SyncContext";
import { Cloud, CloudLightning, CloudOff, CloudRain, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function SyncStatusIndicator() {
  const { syncStatus, lastSyncTime, lastError, isOnline, pendingOps, forceSync } = useSync();

  const getStatusDetails = () => {
    switch (syncStatus) {
      case "loading":
        return {
          icon: <RefreshCw className="h-3.5 w-3.5 text-blue-400 animate-spin" />,
          text: "Loading data...",
          colorClass: "text-blue-400 border-blue-500/20 bg-blue-500/5",
          label: "☁ Loading"
        };
      case "saving":
        return {
          icon: <RefreshCw className="h-3.5 w-3.5 text-indigo-400 animate-spin" />,
          text: "Saving to server...",
          colorClass: "text-indigo-400 border-indigo-500/20 bg-indigo-500/5",
          label: "☁ Saving"
        };
      case "synced":
        return {
          icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
          text: "Synced successfully",
          colorClass: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
          label: "✓ Synced"
        };
      case "failed":
        return {
          icon: <CloudLightning className="h-3.5 w-3.5 text-rose-400" />,
          text: "Save Failed",
          colorClass: "text-rose-400 border-rose-500/20 bg-rose-500/5",
          label: "❌ Save Failed"
        };
      case "offline":
        return {
          icon: <CloudOff className="h-3.5 w-3.5 text-orange-400" />,
          text: "Offline Mode",
          colorClass: "text-orange-400 border-orange-500/20 bg-orange-500/5",
          label: "⚠ Offline"
        };
      case "retry":
        return {
          icon: <RefreshCw className="h-3.5 w-3.5 text-amber-400 animate-spin" />,
          text: "Pending retry...",
          colorClass: "text-amber-400 border-amber-500/20 bg-amber-500/5",
          label: "⚠ Pending Retry"
        };
      default:
        return {
          icon: <Cloud className="h-3.5 w-3.5 text-muted-foreground" />,
          text: "Unknown state",
          colorClass: "text-muted-foreground border-border bg-muted/5",
          label: "Unknown"
        };
    }
  };

  const status = getStatusDetails();

  const formatTime = (date: Date | null) => {
    if (!date) return "Never";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "h-7 px-2.5 flex items-center gap-1.5 rounded-md border text-[11px] font-medium transition-all duration-200 select-none hover:brightness-110",
            status.colorClass
          )}
          aria-label="Cloud sync status"
        >
          {status.icon}
          <span className="hidden sm:inline">{status.label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3 space-y-3 bg-card border border-border shadow-xl rounded-lg text-foreground">
        <div className="flex items-center justify-between pb-2 border-b border-border/60">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Database Sync Status</h4>
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-semibold border", status.colorClass)}>
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current State:</span>
            <span className="font-semibold">{status.text}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Last Synced:</span>
            <span className="font-medium text-foreground/80">{formatTime(lastSyncTime)}</span>
          </div>

          {pendingOps.length > 0 && (
            <div className="space-y-1">
              <span className="text-muted-foreground block">Pending Sync Changes:</span>
              <div className="bg-muted/40 p-2 rounded border border-border/40 text-[10px] space-y-1 font-mono">
                {pendingOps.map((op, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    <span>{op} changes pending</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lastError && (
            <div className="space-y-1">
              <span className="text-rose-400 font-semibold block text-[10px] uppercase">Last Error:</span>
              <div className="bg-rose-500/5 text-rose-400 p-2 rounded border border-rose-500/20 text-[10px] leading-relaxed break-words font-mono">
                {lastError}
              </div>
            </div>
          )}
        </div>

        {isOnline && (syncStatus === "failed" || pendingOps.length > 0) && (
          <button
            onClick={() => forceSync()}
            className="w-full h-8 flex items-center justify-center gap-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/95 transition-all shadow-sm"
          >
            <Cloud className="h-3.5 w-3.5" />
            Sync Now
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
