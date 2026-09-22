import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { CompletionAnimation } from "@/hooks/useAppSettings";
import { InkDissolveEffect } from "./task-complete-animations/InkDissolve";

export interface EffectOrigin {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  type: CompletionAnimation;
  origin: EffectOrigin;
  title: string;
  onDone: () => void;
}

/**
 * Renders the "Ink Dissolve" marked-done animation (see
 * src/components/task-complete-animations/InkDissolve.tsx), portaled to
 * document.body so it plays across the whole page — launched from
 * `origin`, the task's actual on-screen rect — instead of being clipped to
 * the small card or tied to its React lifecycle. "classic" has nothing to
 * render here (TaskCard's own plain shrink+fade handles it).
 *
 * Self-contained: calls `onDone` on its own once it finishes (natural
 * settle-based ending, not a fixed timeout — see taskEffectPhysics.ts's
 * runPhysicsLoop), independent of whatever fired it (see
 * taskCompleteEffectBus.ts — the task row itself is usually long gone from
 * the DOM by the time this finishes).
 */
export function TaskCompleteEffect({ type, origin, title, onDone }: Props) {
  useEffect(() => {
    if (type !== "ink") onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  if (type !== "ink") return null;

  return createPortal(<InkDissolveEffect origin={origin} title={title} onDone={onDone} />, document.body);
}
