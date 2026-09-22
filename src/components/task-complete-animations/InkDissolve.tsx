import { useEffect, useRef } from "react";
import { rand, clamp, runPhysicsLoop, makeParticle, type Particle } from "@/lib/taskEffectPhysics";
import type { AnimEffectProps } from "./types";

const JITTER_MS = 140;
const PARTICLE_COUNT = 32;

/** The task behaves like wet ink: the surface goes unstable, dark specks
 * separate outward from the click point at wildly different speeds while
 * the card itself becomes progressively transparent, and the last
 * particles simply evaporate rather than being cut off by a fade. */
export function InkDissolveEffect({ origin, title, onDone }: AnimEffectProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const clickX = useRef(rand(0.2, 0.5) * origin.width);
  const clickY = useRef(rand(0.3, 0.7) * origin.height);

  const dots = useRef<{ x: number; y: number; life: number }[] | null>(null);
  if (dots.current === null) {
    dots.current = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: clickX.current + rand(-origin.width * 0.4, origin.width * 0.4),
      y: clickY.current + rand(-origin.height * 0.3, origin.height * 0.3),
      life: rand(900, 2200),
    }));
  }

  useEffect(() => {
    const points = dots.current!;
    const particles: Particle[] = points.map(() => {
      const speed = rand(20, 260); // huge variance — some barely drift, some shoot away
      const angle = rand(0, Math.PI * 2);
      return makeParticle(1, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - rand(0, 30),
        friction: 0.9,
      });
    });

    const stop = runPhysicsLoop({
      minEndMs: 1400,
      maxEndMs: 2600,
      step: (elapsed) => {
        let allDone = true;
        if (cardRef.current) {
          const dissolveT = clamp((elapsed - JITTER_MS) / 1600, 0, 1);
          cardRef.current.style.opacity = String(1 - dissolveT);
        }
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const meta = points[i];
          const el = dotRefs.current[i];
          if (!el) continue;
          const age = elapsed - JITTER_MS;
          if (age < 0) { allDone = false; continue; }

          p.vx *= Math.pow(p.friction, 1 / 60);
          p.vy *= Math.pow(p.friction, 1 / 60);
          p.dx += p.vx / 60;
          p.dy += p.vy / 60;

          const lifeT = clamp(age / meta.life, 0, 1);
          const done = lifeT >= 1;
          allDone = allDone && done;
          el.style.transform = `translate(${p.dx}px, ${p.dy}px) scale(${1 - lifeT * 0.4})`;
          el.style.opacity = String((1 - lifeT) * 0.85);
        }
        return allDone;
      },
      onDone,
    });

    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardBase: React.CSSProperties = {
    position: "fixed", left: origin.x, top: origin.y, width: origin.width, height: origin.height,
  };

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden" aria-hidden="true">
      <div
        ref={cardRef}
        className="tce-ink-jitter rounded-md border border-border bg-card shadow-lg flex items-center px-2 overflow-hidden"
        style={cardBase}
      >
        <span className="text-[13px] truncate text-card-foreground">{title}</span>
      </div>
      {dots.current!.map((d, i) => (
        <span
          key={i}
          ref={(el) => { dotRefs.current[i] = el; }}
          className="absolute rounded-full bg-foreground/70"
          style={{
            left: origin.x + d.x, top: origin.y + d.y,
            width: rand(2, 4.5), height: rand(2, 4.5),
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
}
