import type { CompletionAnimation } from "@/hooks/useAppSettings";
import type { EffectOrigin } from "@/components/TaskCompleteEffect";

export interface TaskCompleteEffectPayload {
  type: CompletionAnimation;
  origin: EffectOrigin;
  title: string;
}

type Listener = (payload: TaskCompleteEffectPayload) => void;

// A single-listener bus (there's only ever one <TaskCompleteEffectHost>
// mounted, at the app root) so a TaskCard can fire a fullscreen "marked
// done" effect that outlives the row itself. The row typically unmounts
// within ~260ms of being checked off (it moves out of the active list),
// but these effects run 2.5-3s — tying the effect to the row's own React
// lifecycle would cut it off mid-animation, so it's hosted separately.
let listener: Listener | null = null;

export function fireTaskCompleteEffect(payload: TaskCompleteEffectPayload) {
  listener?.(payload);
}

export function subscribeTaskCompleteEffect(fn: Listener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}
