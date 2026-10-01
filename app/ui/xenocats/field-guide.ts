// The cat field guide: what this visitor has seen of each cat type, kept in
// localStorage. Times met (a cat of that type turned up), attacks survived (its
// attack hit you and you lived), and tamed (the Taming collection, taming.ts).
//
// Pure parsing and counting, plus a tiny store for React (useSyncExternalStore)
// that notifies this tab when a count changes and other tabs through `storage`.

import type { CatType } from './cat-types';
import { CAT_TYPES } from './cat-types';
import { TAMED_KEY, type TamedCollection, addTamed, parseCollection } from './taming';

export const GUIDE_KEY = 'xenocats:guide';

export type TypeStats = { met: number; survived: number };
export type GuideStats = Readonly<Record<string, TypeStats>>;

const count = (value: unknown) =>
  Number.isInteger(value) && (value as number) > 0 ? (value as number) : 0;

/** Reads stored stats; anything malformed or not a known type is dropped. */
export function parseStats(raw: string | null, types: readonly CatType[]): GuideStats {
  if (!raw) return {};
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const known = new Set(types.map((type) => type.id));
  const stats: Record<string, TypeStats> = {};
  for (const [id, entry] of Object.entries(value)) {
    if (!known.has(id) || typeof entry !== 'object' || entry === null) continue;
    const { met, survived } = entry as Record<string, unknown>;
    const parsed = { met: count(met), survived: count(survived) };
    if (parsed.met > 0 || parsed.survived > 0) stats[id] = parsed;
  }
  return stats;
}

/** The stats with one more `field` for `typeId`. */
export function addStat(stats: GuideStats, typeId: string, field: keyof TypeStats): GuideStats {
  const current = stats[typeId] ?? { met: 0, survived: 0 };
  return { ...stats, [typeId]: { ...current, [field]: current[field] + 1 } };
}

export type Guide = { stats: GuideStats; tamed: TamedCollection };

/** One cat type's line in the guide. */
export const entryFor = (guide: Guide, typeId: string) => ({
  met: guide.stats[typeId]?.met ?? 0,
  survived: guide.stats[typeId]?.survived ?? 0,
  tamed: guide.tamed[typeId] ?? 0,
});

/** True for a visitor who has not met, survived or tamed any cat yet. */
export const isEmptyGuide = (guide: Guide) =>
  Object.keys(guide.stats).length === 0 && Object.keys(guide.tamed).length === 0;

// ------------------------------------------------------------------ the store

const EMPTY: Guide = { stats: {}, tamed: {} };
const listeners = new Set<() => void>();
let cached: { raw: string; guide: Guide } | null = null;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked or full: the guide just doesn't remember this one.
  }
}

/** The guide as stored; the same object until something changes (for React). */
export function getGuide(): Guide {
  const stats = read(GUIDE_KEY);
  const tamed = read(TAMED_KEY);
  const raw = `${stats}\u0000${tamed}`;
  if (cached?.raw !== raw) {
    cached = {
      raw,
      guide: { stats: parseStats(stats, CAT_TYPES), tamed: parseCollection(tamed, CAT_TYPES) },
    };
  }
  return cached.guide;
}

export const getServerGuide = () => EMPTY;

export function subscribeGuide(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

const notify = () => {
  for (const listener of listeners) listener();
};

/** A cat of `typeId` turned up, or its attack hit and was survived. */
export function recordStat(typeId: string, field: keyof TypeStats) {
  if (!CAT_TYPES.some((type) => type.id === typeId)) return;
  write(GUIDE_KEY, JSON.stringify(addStat(getGuide().stats, typeId, field)));
  notify();
}

/** A cat of `typeId` was tamed: one more in the collection. */
export function recordTamed(typeId: string) {
  if (!CAT_TYPES.some((type) => type.id === typeId)) return;
  write(TAMED_KEY, JSON.stringify(addTamed(getGuide().tamed, typeId)));
  notify();
}
