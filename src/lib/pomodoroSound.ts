// Pomodoro tick + meditation bell. Tick is scheduled directly on AudioContext
// clock so ticks stay synchronized with the countdown seconds.
import { isSoundEnabled } from "./soundSettings";

let ctx: AudioContext | null = null;
let tickGain: GainNode | null = null;
let tickTimeout: number | null = null;
let activeEndsAt: number | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function playTickNow() {
  const c = getCtx();
  if (!c || !tickGain) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "triangle";
  osc.frequency.value = 1800;
  const t0 = c.currentTime;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(1, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
  osc.connect(g).connect(tickGain);
  osc.start(t0);
  osc.stop(t0 + 0.08);
}

function scheduleNextTick() {
  if (activeEndsAt === null) return;
  const now = Date.now();
  const remaining = activeEndsAt - now;
  if (remaining <= 0) return;
  // Next display-second boundary: countdown decrements each time
  // (endsAt - now) crosses a whole-second mark.
  const delay = remaining % 1000 === 0 ? 1000 : remaining % 1000;
  tickTimeout = window.setTimeout(() => {
    playTickNow();
    scheduleNextTick();
  }, delay);
}

export function startTicking(endsAt: number) {
  if (!isSoundEnabled("pomoTick")) {
    stopTicking();
    return;
  }
  const c = getCtx();
  if (!c) return;
  stopTicking();
  tickGain = c.createGain();
  tickGain.gain.value = 0.7;
  tickGain.connect(c.destination);
  activeEndsAt = endsAt;
  scheduleNextTick();
}

export function stopTicking() {
  if (tickTimeout !== null) {
    window.clearTimeout(tickTimeout);
    tickTimeout = null;
  }
  if (tickGain) {
    try {
      tickGain.disconnect();
    } catch {
      // ignore
    }
    tickGain = null;
  }
  activeEndsAt = null;
}

// Calming meditation-style bell (~3s decay). Layered sines with harmonics.
function playBell(baseFreq: number) {
  if (!isSoundEnabled("pomoBell")) return;
  const c = getCtx();
  if (!c) return;
  const master = c.createGain();
  master.gain.value = 0.6;
  master.connect(c.destination);

  const partials = [
    { mult: 1, gain: 1.0 },
    { mult: 2.0, gain: 0.5 },
    { mult: 3.01, gain: 0.28 },
    { mult: 4.2, gain: 0.16 },
    { mult: 5.4, gain: 0.08 },
  ];

  const now = c.currentTime;
  const dur = 3.0;

  for (const p of partials) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.value = baseFreq * p.mult;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(p.gain, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g).connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  }
}

export function playWorkEndSound() {
  playBell(528);
}

export function playBreakEndSound() {
  playBell(528);
}
