// What Survival keeps between runs, in localStorage under versioned keys. Anything
// unreadable or corrupt reads as a fresh start; nothing here ever throws.

import { type Graphics, parseGraphics } from './graphics';

/** The run lengths on offer, in minutes (the first is the game's own). */
export const RUN_LENGTHS = [5, 10, 15] as const;
export type RunLength = (typeof RUN_LENGTHS)[number];

/**
 * The longest five-minute run survived, ms. Version 2: the arena (the wave game kept
 * waves). It was the only best before run lengths came, so it stays the five-minute one.
 */
export const SURVIVAL_BEST_KEY = 'xenocats:survival:v2:best-ms';

/** Where the best time of a run of this length is kept. */
export const bestKey = (length: RunLength) =>
  length === 5 ? SURVIVAL_BEST_KEY : `${SURVIVAL_BEST_KEY}:${length}`;

/** A stored best time, or null for none (missing, corrupt, or not a sane time). */
export function parseBest(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 && value < 24 * 3_600_000 ? Math.round(value) : null;
}

/** The best time after a run that lasted `ms`. */
export const bestOf = (previous: number | null, ms: number) => Math.max(previous ?? 0, ms);

export function readBest(length: RunLength = 5): number | null {
  try {
    return parseBest(window.localStorage.getItem(bestKey(length)));
  } catch {
    return null;
  }
}

export function writeBest(ms: number, length: RunLength = 5) {
  try {
    window.localStorage.setItem(bestKey(length), String(Math.round(ms)));
  } catch {
    // Storage blocked or full: the best time just isn't kept.
  }
}

export const SURVIVAL_LENGTH_KEY = 'xenocats:survival:v1:length';

/** A stored run length in minutes; anything else (missing, corrupt) is five. */
export const parseLength = (raw: string | null): RunLength =>
  RUN_LENGTHS.find((length) => String(length) === raw) ?? 5;

const lengthListeners = new Set<() => void>();
/** The choice, when storage is blocked: it lasts until the page is left. */
let lengthInMemory: RunLength | null = null;

export function readLength(): RunLength {
  if (lengthInMemory) return lengthInMemory;
  try {
    return parseLength(window.localStorage.getItem(SURVIVAL_LENGTH_KEY));
  } catch {
    return 5;
  }
}

export function writeLength(length: RunLength) {
  try {
    window.localStorage.setItem(SURVIVAL_LENGTH_KEY, String(length));
  } catch {
    // Storage blocked: the choice lasts until the page is left.
    lengthInMemory = length;
  }
  for (const listener of lengthListeners) listener();
}

/** For useSyncExternalStore: the stored run length, and changes to it (here or in another tab). */
export function subscribeLength(onChange: () => void) {
  lengthListeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    lengthListeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
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

export const SURVIVAL_GRAPHICS_KEY = 'xenocats:survival:v1:graphics';
/** Set once a run has switched itself to light graphics: it does so only once. */
export const SURVIVAL_GRAPHICS_AUTO_KEY = 'xenocats:survival:v1:graphics-auto';

const graphicsListeners = new Set<() => void>();
/** The choice, when storage is blocked: it lasts until the page is left. */
let graphicsInMemory: Graphics | null = null;
let graphicsAutoInMemory = false;

export function readGraphics(): Graphics {
  if (graphicsInMemory) return graphicsInMemory;
  try {
    return parseGraphics(window.localStorage.getItem(SURVIVAL_GRAPHICS_KEY));
  } catch {
    return 'full';
  }
}

export function writeGraphics(graphics: Graphics) {
  try {
    window.localStorage.setItem(SURVIVAL_GRAPHICS_KEY, graphics);
  } catch {
    // Storage blocked: the choice lasts until the page is left.
    graphicsInMemory = graphics;
  }
  for (const listener of graphicsListeners) listener();
}

/** Whether a run has switched itself to light graphics before. */
export function readGraphicsAuto(): boolean {
  if (graphicsAutoInMemory) return true;
  try {
    return window.localStorage.getItem(SURVIVAL_GRAPHICS_AUTO_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeGraphicsAuto() {
  try {
    window.localStorage.setItem(SURVIVAL_GRAPHICS_AUTO_KEY, '1');
  } catch {
    graphicsAutoInMemory = true;
  }
}

/** For useSyncExternalStore: the stored graphics setting, and changes to it. */
export function subscribeGraphics(onChange: () => void) {
  graphicsListeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    graphicsListeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}
