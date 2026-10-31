import { useEffect, type ComponentType } from "react";
import { createPortal } from "react-dom";
import type { CompletionAnimation } from "@/hooks/useAppSettings";
import type { AnimEffectProps } from "./task-complete-animations/types";
import { InkDissolveEffect } from "./task-complete-animations/InkDissolve";
import { LaserDisintegrateEffect } from "./task-complete-animations/LaserDisintegrate";
import { LiquidSplashEffect } from "./task-complete-animations/LiquidSplash";

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

// "classic" has no entry: TaskCard's own plain shrink+fade handles it.
const EFFECTS: Partial<Record<CompletionAnimation, ComponentType<AnimEffectProps>>> = {
  ink: InkDissolveEffect,
  laser: LaserDisintegrateEffect,
  liquid: LiquidSplashEffect,
};

/**
 * Renders the selected marked-done animation (see
 * src/components/task-complete-animations/), portaled to document.body so it
 * plays across the whole page — launched from `origin`, the task's actual
 * on-screen rect — instead of being clipped to the small card or tied to its
 * React lifecycle.
 *
 * Self-contained: calls `onDone` on its own once it finishes (natural
 * settle-based ending, not a fixed timeout — see taskEffectPhysics.ts's
 * runPhysicsLoop), independent of whatever fired it (see
 * taskCompleteEffectBus.ts — the task row itself is usually long gone from
 * the DOM by the time this finishes).
 */
export function TaskCompleteEffect({ type, origin, title, onDone }: Props) {
  const Effect = EFFECTS[type];

  useEffect(() => {
    if (!Effect) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  if (!Effect) return null;

  return createPortal(<Effect origin={origin} title={title} onDone={onDone} />, document.body);
}
