// Play a short, pleasant "ding" using WebAudio (no assets needed).
import { isSoundEnabled } from "./soundSettings";

let ctx: AudioContext | null = null;

export function playCompleteSound() {
  if (!isSoundEnabled("taskComplete")) return;
  try {
    if (typeof window === "undefined") return;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    // Two-note pleasant chime: E5 -> A5
    const notes = [
      { freq: 659.25, start: 0, dur: 0.18 },
      { freq: 880.0, start: 0.09, dur: 0.28 },
    ];
    const master = ctx.createGain();
    master.gain.value = 0.12;
    master.connect(ctx.destination);

    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = n.freq;
      const t0 = now + n.start;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(1, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
      osc.connect(gain).connect(master);
      osc.start(t0);
      osc.stop(t0 + n.dur + 0.02);
    }
  } catch {
    // ignore
  }
}
