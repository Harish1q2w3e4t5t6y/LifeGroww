import { useEffect, useRef } from "react";
import type { Task } from "@/lib/types";
import { playDeadlineAlert, playHourlyChime } from "@/lib/eventSounds";
import { isSoundEnabled } from "@/lib/soundSettings";

const FIRED_KEY = "eisenhower.deadlines-fired.v1";

function loadFired(): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}
function saveFired(s: Set<string>) {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify([...s]));
  } catch {
    // ignore
  }
}

function notify(title: string, body: string) {
  try {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") {
      new Notification(title, { body });
    }
  } catch {
    // ignore
  }
}

/** Watches tasks for deadlines; plays alert + browser notification once per task. */
export function useDeadlineWatcher(tasks: Task[]) {
  const firedRef = useRef<Set<string>>(loadFired());
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  useEffect(() => {
    // Ask for notification permission once.
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      const fired = firedRef.current;
      // Prune fired ids no longer referencing a due date match.
      const valid = new Set<string>();
      let mutated = false;
      for (const t of tasksRef.current) {
        if (!t.dueDate) continue;
        const key = `${t.id}@${t.dueDate}`;
        const due = new Date(t.dueDate).getTime();
        if (isNaN(due)) continue;
        if (due <= now && !t.completed) {
          if (!fired.has(key)) {
            fired.add(key);
            mutated = true;
            playDeadlineAlert();
            notify("Task deadline reached", t.title);
          }
        }
        valid.add(key);
      }
      // Drop stale entries (dates changed / task removed) so future re-dues re-fire.
      for (const k of [...fired]) {
        if (!valid.has(k)) {
          fired.delete(k);
          mutated = true;
        }
      }
      if (mutated) saveFired(fired);
    };
    check();
    const id = window.setInterval(check, 15000);
    return () => window.clearInterval(id);
  }, []);
}

/** Plays the hourly chime once at each top-of-hour, when enabled. */
export function useHourlyChime() {
  useEffect(() => {
    let timeoutId: number | null = null;
    const scheduleNext = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(now.getHours() + 1, 0, 0, 50);
      const delay = next.getTime() - now.getTime();
      timeoutId = window.setTimeout(() => {
        if (isSoundEnabled("hourly")) playHourlyChime();
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, []);
}
