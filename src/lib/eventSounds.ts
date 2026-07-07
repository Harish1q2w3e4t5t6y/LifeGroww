// Distinct sounds for deadline alerts and hourly chime, plus shared AudioContext helper.
import { isSoundEnabled } from "./soundSettings";

let ctx: AudioContext | null = null;

export function getSharedCtx(): AudioContext | null {
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

// Loud but pleasant deadline alert: rising 3-note arpeggio with a soft square lead.
export function playDeadlineAlert() {
  if (!isSoundEnabled("deadline")) return;
  const c = getSharedCtx();
  if (!c) return;
  const master = c.createGain();
  master.gain.value = 0.9;
  master.connect(c.destination);

  const notes = [
    { freq: 784, t: 0.0, dur: 0.35 }, // G5
    { freq: 988, t: 0.18, dur: 0.35 }, // B5
    { freq: 1319, t: 0.36, dur: 0.55 }, // E6
    { freq: 1319, t: 0.75, dur: 0.7 }, // E6 sustained
  ];
  const now = c.currentTime;
  for (const n of notes) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "triangle";
    osc.frequency.value = n.freq;
    const t0 = now + n.t;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(1, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + n.dur + 0.05);
  }
}

// Grandfather-clock style chime: two low bell tones over ~2 seconds.
export function playHourlyChime() {
  if (!isSoundEnabled("hourly")) return;
  const c = getSharedCtx();
  if (!c) return;
  const master = c.createGain();
  master.gain.value = 0.55;
  master.connect(c.destination);

  const strikes = [
    { base: 392, t: 0.0 }, // G4
    { base: 293.66, t: 0.55 }, // D4
  ];
  const partials = [
    { mult: 1, gain: 1.0 },
    { mult: 2.01, gain: 0.45 },
    { mult: 3.0, gain: 0.22 },
    { mult: 4.2, gain: 0.1 },
  ];
  const now = c.currentTime;
  const dur = 1.4;
  for (const s of strikes) {
    for (const p of partials) {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = "sine";
      osc.frequency.value = s.base * p.mult;
      const t0 = now + s.t;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(p.gain, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    }
  }
}
