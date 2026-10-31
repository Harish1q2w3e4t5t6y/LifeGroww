import { useEffect, useRef } from "react";
import { rand, clamp, runPhysicsLoop } from "@/lib/taskEffectPhysics";
import type { AnimEffectProps } from "./types";

const SQUASH_MS = 170;
const BURST_FADE_MS = 140;
const DROP_COUNT = 30;
const GRAVITY = 1100;

interface Drop {
  x: number; y: number;
  vx: number; vy: number;
  size: number; life: number;
}

/** The task loses its rigid shape — it squashes into a soft pill — then
 * bursts into glowing droplets in the accent color that stretch along their
 * direction of travel and fall away under gravity. */
export function LiquidSplashEffect({ origin, title, onDone }: AnimEffectProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dropRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const drops = useRef<Drop[] | null>(null);
  if (drops.current === null) {
    drops.current = Array.from({ length: DROP_COUNT }, () => {
      const angle = Math.random() < 0.75 ? rand(-Math.PI, 0) : rand(0.2, Math.PI - 0.2);
      const speed = rand(120, 420);
      return {
        x: rand(0.1, 0.9) * origin.width,
        y: origin.height / 2 + rand(-0.25, 0.25) * origin.height,
        vx: Math.cos(angle) * speed * 1.2,
        vy: Math.sin(angle) * speed,
        size: rand(3, 10),
        life: rand(600, 1100),
      };
    });
  }

  useEffect(() => {
    const list = drops.current!;
    return runPhysicsLoop({
      minEndMs: 900,
      maxEndMs: 2400,
      step: (elapsed) => {
        const card = cardRef.current;
        if (card) {
          if (elapsed < SQUASH_MS) {
            const k = elapsed / SQUASH_MS;
            const e = k * k;
            card.style.transform = `scale(${1 + 0.06 * e}, ${1 - 0.35 * e})`;
            card.style.borderRadius = `${6 + (origin.height / 2 - 6) * e}px`;
            card.style.opacity = "1";
          } else {
            const k = clamp((elapsed - SQUASH_MS) / BURST_FADE_MS, 0, 1);
            card.style.transform = `scale(${1.06 + 0.08 * k}, ${0.65 - 0.2 * k})`;
            card.style.opacity = String(1 - k);
          }
        }
        let allDone = elapsed > SQUASH_MS + BURST_FADE_MS;
        for (let i = 0; i < list.length; i++) {
          const d = list[i];
          const el = dropRefs.current[i];
          if (!el) continue;
          const age = elapsed - SQUASH_MS;
          if (age < 0) { allDone = false; continue; }
          const s = age / 1000;
          const lifeT = clamp(age / d.life, 0, 1);
          allDone = allDone && lifeT >= 1;
          const dx = d.vx * s;
          const dy = d.vy * s + 0.5 * GRAVITY * s * s;
          const vyNow = d.vy + GRAVITY * s;
          const speedNow = Math.hypot(d.vx, vyNow);
          const angle = Math.atan2(vyNow, d.vx);
          const stretch = 1 + Math.min(speedNow / 600, 1.2);
          const shrink = 1 - lifeT * 0.6;
          el.style.transform =
            `translate(${dx}px, ${dy}px) rotate(${angle}rad) scale(${stretch * shrink}, ${shrink / Math.sqrt(stretch)})`;
          el.style.opacity = String(lifeT < 0.6 ? 1 : 1 - (lifeT - 0.6) / 0.4);
        }
        return allDone;
      },
      onDone,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden" aria-hidden="true">
      <div
        ref={cardRef}
        className="border border-border bg-card shadow-lg flex items-center px-2 overflow-hidden"
        style={{
          position: "fixed", left: origin.x, top: origin.y, width: origin.width, height: origin.height,
          borderRadius: 6, boxShadow: "0 0 18px hsl(var(--primary) / 0.45)",
        }}
      >
        <span className="text-[13px] truncate text-card-foreground">{title}</span>
      </div>
      {drops.current!.map((d, i) => (
        <span
          key={i}
          ref={(el) => { dropRefs.current[i] = el; }}
          className="absolute rounded-full"
          style={{
            left: origin.x + d.x - d.size / 2, top: origin.y + d.y - d.size / 2,
            width: d.size, height: d.size,
            opacity: 0,
            background: "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.75), hsl(var(--primary)) 45%)",
            boxShadow: "0 0 6px hsl(var(--primary) / 0.6)",
          }}
        />
      ))}
    </div>
  );
}
