// Central sound preferences with subscription support.
export type SoundKey =
  | "taskComplete"
  | "pomoTick"
  | "pomoBell"
  | "deadline"
  | "hourly";

export interface SoundSettings {
  master: boolean;
  taskComplete: boolean;
  pomoTick: boolean;
  pomoBell: boolean;
  deadline: boolean;
  hourly: boolean;
}

const KEY = "eisenhower.sound-settings.v1";

const DEFAULTS: SoundSettings = {
  master: true,
  taskComplete: true,
  pomoTick: true,
  pomoBell: true,
  deadline: true,
  hourly: false,
};

let current: SoundSettings = load();
const listeners = new Set<(s: SoundSettings) => void>();

function load(): SoundSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<SoundSettings>) };
  } catch {
    return DEFAULTS;
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
}

export function getSoundSettings(): SoundSettings {
  return current;
}

export function setSoundSetting<K extends keyof SoundSettings>(
  key: K,
  value: SoundSettings[K]
) {
  current = { ...current, [key]: value };
  persist();
  listeners.forEach((l) => l(current));
}

export function subscribeSoundSettings(fn: (s: SoundSettings) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isSoundEnabled(key: SoundKey): boolean {
  return current.master && current[key];
}
