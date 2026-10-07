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
