import { useEffect, useState } from "react";
import { TaskCompleteEffect } from "@/components/TaskCompleteEffect";
import { subscribeTaskCompleteEffect, type TaskCompleteEffectPayload } from "@/lib/taskCompleteEffectBus";

/**
 * Mounted once at the app root (alongside <Toaster />/<Sonner />). Renders
 * whichever "marked done" animation was last fired via the bus, independent
 * of the TaskCard that fired it — see taskCompleteEffectBus.ts for why.
 */
export function TaskCompleteEffectHost() {
  const [active, setActive] = useState<TaskCompleteEffectPayload | null>(null);

  useEffect(() => subscribeTaskCompleteEffect(setActive), []);

  if (!active) return null;

  return (
    <TaskCompleteEffect
      type={active.type}
      origin={active.origin}
      title={active.title}
      onDone={() => setActive(null)}
    />
  );
}
