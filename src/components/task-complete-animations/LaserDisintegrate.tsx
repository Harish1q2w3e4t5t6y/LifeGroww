import { useEffect, useRef } from "react";
import { rand, clamp, runPhysicsLoop } from "@/lib/taskEffectPhysics";
import type { AnimEffectProps } from "./types";

const SWEEP_START_MS = 120;
const SWEEP_MS = 650;
const BEAM_FADE_MS = 160;
const PARTICLE_COUNT = 46;
const EMBER_COLORS = ["#22d3ee", "#67e8f9", "#a78bfa", "#f0abfc"];
const BEAM_GLOW = "0 0 8px 2px rgba(34,211,238,0.9), 0 0 24px 6px rgba(34,211,238,0.45)";

interface Bit {
  x: number; y: number;
  spawn: number; life: number;
  vx: number; vy: number; gravity: number;
  size: number;
  ember: boolean;
  color: string;
}

/** A glowing laser line sweeps across the task left to right, erasing it as
 * it passes. Neon embers lift off the beam while grey "digital ash" drops
 * away beneath it. */
export function LaserDisintegrateEffect({ origin, title, onDone }: AnimEffectProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const beamRef = useRef<HTMLDivElement | null>(null);
  const bitRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const bits = useRef<Bit[] | null>(null);
  if (bits.current === null) {
    bits.current = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const frac = clamp(i / PARTICLE_COUNT + rand(-0.02, 0.02), 0, 1);
      const ember = Math.random() < 0.7;
      return {
        x: frac * origin.width,
        y: rand(0.1, 0.9) * origin.height,
        spawn: SWEEP_START_MS + frac * SWEEP_MS,
        life: ember ? rand(500, 1100) : rand(700, 1300),
        vx: ember ? rand(-30, 60) : rand(-20, 20),
        vy: ember ? rand(-140, -40) : rand(10, 40),
        gravity: ember ? -20 : 120,
        size: ember ? rand(2, 3.5) : rand(2, 3),
        ember,
        color: EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)],
      };
    });
  }

  useEffect(() => {
    const list = bits.current!;
    return runPhysicsLoop({
      minEndMs: 1000,
      maxEndMs: 2600,
      step: (elapsed) => {
        const p = clamp((elapsed - SWEEP_START_MS) / SWEEP_MS, 0, 1);
        if (cardRef.current) cardRef.current.style.clipPath = `inset(0 0 0 ${p * 100}%)`;
        if (beamRef.current) {
          const sinceEnd = elapsed - SWEEP_START_MS - SWEEP_MS;
          const beamOpacity = elapsed < SWEEP_START_MS ? 0 : sinceEnd <= 0 ? 1 : clamp(1 - sinceEnd / BEAM_FADE_MS, 0, 1);
          beamRef.current.style.opacity = String(beamOpacity);
          beamRef.current.style.transform = `translateX(${p * origin.width}px)`;
        }
        let allDone = elapsed > SWEEP_START_MS + SWEEP_MS + BEAM_FADE_MS;
        for (let i = 0; i < list.length; i++) {
          const b = list[i];
          const el = bitRefs.current[i];
          if (!el) continue;
          const age = elapsed - b.spawn;
          if (age < 0) { allDone = false; continue; }
          const s = age / 1000;
          const lifeT = clamp(age / b.life, 0, 1);
          allDone = allDone && lifeT >= 1;
          const dx = b.vx * s;
          const dy = b.vy * s + 0.5 * b.gravity * s * s;
          el.style.transform = `translate(${dx}px, ${dy}px) scale(${1 - lifeT * 0.5})`;
          el.style.opacity = String(1 - lifeT);
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
        className="rounded-md border border-border bg-card shadow-lg flex items-center px-2 overflow-hidden"
        style={{ position: "fixed", left: origin.x, top: origin.y, width: origin.width, height: origin.height }}
      >
        <span className="text-[13px] truncate text-card-foreground">{title}</span>
      </div>
      <div
        ref={beamRef}
        className="rounded-full"
        style={{
          position: "fixed", left: origin.x - 1.5, top: origin.y - 6,
          width: 3, height: origin.height + 12,
          background: "#a5f3fc", boxShadow: BEAM_GLOW, opacity: 0,
        }}
      />
      {bits.current!.map((b, i) => (
        <span
          key={i}
          ref={(el) => { bitRefs.current[i] = el; }}
          className={b.ember ? "absolute rounded-full" : "absolute bg-muted-foreground"}
          style={{
            left: origin.x + b.x, top: origin.y + b.y,
            width: b.size, height: b.size,
            opacity: 0,
            ...(b.ember ? { background: b.color, boxShadow: `0 0 6px 1px ${b.color}` } : {}),
          }}
        />
      ))}
    </div>
  );
}
