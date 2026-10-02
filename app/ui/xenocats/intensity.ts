// How hard the cats haunt the dashboard: calm, normal or chaos — how often they
// come and how many at once. There is no zero: the cats are not optional. Chaos
// still keeps to the five-cat limit. Remembered in localStorage, like the sound.

import { CAT_CONFIG, type CatConfig } from './config';

export const INTENSITIES = ['calm', 'normal', 'chaos'] as const;
export type Intensity = (typeof INTENSITIES)[number];

export const INTENSITY_LABELS: Record<Intensity, string> = {
  calm: 'Calm',
  normal: 'Normal',
  chaos: 'Chaos',
};

/** What each level changes. Normal is the cats as they have always been. */
export const INTENSITY_CONFIG: Record<
  Intensity,
  Pick<CatConfig, 'maxCats' | 'firstSpawnMs' | 'spawnEveryMs'>
> = {
  calm: { maxCats: 2, firstSpawnMs: [10_000, 20_000], spawnEveryMs: [25_000, 45_000] },
  normal: {
    maxCats: CAT_CONFIG.maxCats,
    firstSpawnMs: CAT_CONFIG.firstSpawnMs,
    spawnEveryMs: CAT_CONFIG.spawnEveryMs,
  },
  chaos: { maxCats: 5, firstSpawnMs: [1_000, 3_000], spawnEveryMs: [2_500, 6_000] },
};

export const INTENSITY_KEY = 'xenocats:intensity';

/** A stored or submitted value as a level: anything unknown is normal. */
export const parseIntensity = (value: string | null | undefined): Intensity =>
  INTENSITIES.find((level) => level === value) ?? 'normal';

let memory: Intensity | null = null;
const listeners = new Set<() => void>();

/** The stored level; normal if none, or if storage is blocked. */
export function getIntensity(): Intensity {
  if (memory) return memory;
  try {
    return parseIntensity(window.localStorage.getItem(INTENSITY_KEY));
  } catch {
    return 'normal';
  }
}

export function setIntensity(level: Intensity) {
  try {
    window.localStorage.setItem(INTENSITY_KEY, level);
  } catch {
    // Storage blocked: the choice lasts until the page is left.
    memory = level;
  }
  for (const listener of listeners) listener();
}

/** For useSyncExternalStore: changes here or in another tab. */
export function subscribeIntensity(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}
