// Shared building blocks for the task-completion physics animation
// (src/components/task-complete-animations/InkDissolve.tsx): a lightweight
// particle model plus a driver that runs a real requestAnimationFrame loop
// and ends naturally once the particles actually finish, rather than on a
// fixed timer.

export function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export interface Particle {
  dx: number; dy: number;
  vx: number; vy: number;
  rot: number; vrot: number;
  scale: number;
  opacity: number;
  mass: number;
  friction: number;
  restitution: number;
  bounces: number;
  settled: boolean;
  extra?: Record<string, number>;
}

export function makeParticle(mass: number, overrides?: Partial<Particle>): Particle {
  return {
    dx: 0, dy: 0, vx: 0, vy: 0, rot: 0, vrot: 0,
    scale: 1, opacity: 1, mass,
    friction: 0.965, restitution: 0.28, bounces: 0, settled: false,
    ...overrides,
  };
}

export interface PhysicsLoopOptions {
  minEndMs?: number;
  maxEndMs?: number;
  settleHoldMs?: number;
  fadeMs?: number;
  /** Called every frame with elapsed ms + dt seconds. Return true once every
   * particle this effect manages is resolved (settled / offscreen / vanished). */
  step: (elapsed: number, dt: number) => boolean;
  onDone: () => void;
}

/**
 * Runs a requestAnimationFrame loop until `step` reports everything is
 * resolved, holds briefly, then calls onDone — instead of running out a
 * fixed arbitrary timeout regardless of how quickly the simulation
 * actually finished.
 */
export function runPhysicsLoop(opts: PhysicsLoopOptions): () => void {
  const minEndMs = opts.minEndMs ?? 900;
  const maxEndMs = opts.maxEndMs ?? 3200;
  const settleHoldMs = opts.settleHoldMs ?? 180;
  const fadeMs = opts.fadeMs ?? 350;

  let raf: number | null = null;
  let startTime: number | null = null;
  let lastTime: number | null = null;
  let resolvedAt: number | null = null;
  let endTime = maxEndMs;

  const frame = (now: number) => {
    if (startTime === null) {
      startTime = now;
      lastTime = now;
    }
    const elapsed = now - startTime;
    const dt = Math.min(0.032, (now - (lastTime ?? now)) / 1000);
    lastTime = now;

    const allResolved = opts.step(elapsed, dt);

    if (resolvedAt === null && allResolved) {
      resolvedAt = elapsed;
      endTime = clamp(resolvedAt + settleHoldMs + fadeMs, minEndMs, maxEndMs);
    }

    if (elapsed < endTime) {
      raf = requestAnimationFrame(frame);
    } else {
      opts.onDone();
    }
  };

  raf = requestAnimationFrame(frame);
  return () => {
    if (raf !== null) cancelAnimationFrame(raf);
  };
}
