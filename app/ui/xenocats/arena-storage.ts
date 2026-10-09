// What Survival keeps between runs, in localStorage under versioned keys. Anything
// unreadable or corrupt reads as a fresh start; nothing here ever throws.

/** The longest run survived, ms. Version 2: the arena (the wave game kept waves). */
export const SURVIVAL_BEST_KEY = 'xenocats:survival:v2:best-ms';

/** A stored best time, or null for none (missing, corrupt, or not a sane time). */
export function parseBest(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 && value < 24 * 3_600_000 ? Math.round(value) : null;
}

/** The best time after a run that lasted `ms`. */
export const bestOf = (previous: number | null, ms: number) => Math.max(previous ?? 0, ms);

export function readBest(): number | null {
  try {
    return parseBest(window.localStorage.getItem(SURVIVAL_BEST_KEY));
  } catch {
    return null;
  }
}

export function writeBest(ms: number) {
  try {
    window.localStorage.setItem(SURVIVAL_BEST_KEY, String(Math.round(ms)));
  } catch {
    // Storage blocked or full: the best time just isn't kept.
  }
}

/** "m:ss" for a time in ms. */
export function clockText(ms: number): string {
  const seconds = Math.floor(Math.max(ms, 0) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** How player 1 aims on a computer: his weapons find their own cats, or the mouse. */
export type AimMode = 'auto' | 'crosshair';

export const SURVIVAL_AIM_KEY = 'xenocats:survival:v1:aim';

/** A stored aim mode; anything else (missing, corrupt) is automatic. */
export const parseAim = (raw: string | null): AimMode =>
  raw === 'crosshair' ? 'crosshair' : 'auto';

const aimListeners = new Set<() => void>();
/** The choice, when storage is blocked: it lasts until the page is left. */
let aimInMemory: AimMode | null = null;

export function readAim(): AimMode {
  if (aimInMemory) return aimInMemory;
  try {
    return parseAim(window.localStorage.getItem(SURVIVAL_AIM_KEY));
  } catch {
    return 'auto';
  }
}

export function writeAim(mode: AimMode) {
  try {
    window.localStorage.setItem(SURVIVAL_AIM_KEY, mode);
  } catch {
    // Storage blocked: the choice lasts until the page is left.
    aimInMemory = mode;
  }
  for (const listener of aimListeners) listener();
}

/** For useSyncExternalStore: the stored aim mode, and changes to it (here or in another tab). */
export function subscribeAim(onChange: () => void) {
  aimListeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    aimListeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}
