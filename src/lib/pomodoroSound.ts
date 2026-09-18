// Pomodoro tick + meditation bell.
//
// The tick used to run on its own independent setTimeout chain, re-derived
// from Date.now() and only loosely aligned to the seconds shown on screen
// (the display uses Math.round, the old scheduler aligned to raw
// millisecond-boundary crossings — a mismatch of up to ~500ms, on top of
// setTimeout's own jitter). That's what caused the audible drift. There is
// no independent scheduling now: playTick() is called directly by the
// component, in the same effect that already recomputes the on-screen
// countdown — so the sound literally cannot land on a different second than
// the number does.
import { isSoundEnabled } from "./soundSettings";

let ctx: AudioContext | null = null;
let tickGain: GainNode | null = null;
let tickCount = 0;

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

// A short burst of filtered noise (not a pure tone) reads as a mechanical
// "click" the way a real clock escapement sounds, rather than an electronic
// blip. Alternating the filter's center frequency between calls gives the
// classic tick / tock timbre difference of a real clock.
function noiseBurst(c: AudioContext, durationSec: number): AudioBuffer {
  const length = Math.max(1, Math.floor(c.sampleRate * durationSec));
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function playTickNow() {
  const c = getCtx();
  if (!c || !tickGain) return;
  tickCount += 1;
  const isTick = tickCount % 2 === 1;

  const noise = c.createBufferSource();
  noise.buffer = noiseBurst(c, 0.03);

  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = isTick ? 2600 : 1900;
  filter.Q.value = 3.5;

  const g = c.createGain();
  const t0 = c.currentTime;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(1, t0 + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035);

  noise.connect(filter).connect(g).connect(tickGain);
  noise.start(t0);
  noise.stop(t0 + 0.05);
}

// Enables the tick output. Call once when a session starts (or unmutes) —
// does not itself schedule anything; the caller decides exactly when each
// tick fires by calling playTick().
export function startTicking() {
  if (!isSoundEnabled("pomoTick")) {
    stopTicking();
    return;
  }
  const c = getCtx();
  if (!c) return;
  if (tickGain) return;
  tickGain = c.createGain();
  tickGain.gain.value = 0.7;
  tickGain.connect(c.destination);
}

export function stopTicking() {
  if (tickGain) {
    try {
      tickGain.disconnect();
    } catch {
      // ignore
    }
    tickGain = null;
  }
}

// Plays exactly one tick. Call this from the same place that updates the
// visible countdown, so the sound and the number change together.
export function playTick() {
  if (!tickGain) return;
  playTickNow();
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
