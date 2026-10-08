// The cats of Survival beyond the twenty xenocat types (arena.ts): varieties that
// arrive over the five minutes, each its own size, pace, staying power and way of
// moving, so the horde grows more numerous, more durable, faster and more absurd.
// Pure data, no DOM; their drawings are in arena-art.ts.

import type { WeaponKind } from './arsenal';

export type VarietyId =
  | 'basic'
  | 'zoomies'
  | 'hissing'
  | 'fat'
  | 'kitten'
  | 'box'
  | 'laser'
  | 'possessed'
  | 'mega'
  | 'comforter'
  // Never in the schedule: it comes only when it chooses to (arena.ts, secretCat).
  | 'neighbour';

/** How a variety moves (arena.ts reads it). */
export type Gait =
  /** Straight at him. */
  | 'walk'
  /** Darts one way, then another, now and then. */
  | 'zoom'
  /** Walks at him, and charges once near. */
  | 'charge'
  /** Sits in its box. */
  | 'sit'
  /** Keeps its distance, and fires at him. */
  | 'snipe';

export type Variety = {
  name: string;
  /** In the game's voice. */
  description: string;
  gait: Gait;
  /** px/s. */
  speed: number;
  /** Homesickness it can take before it goes home. */
  homesickness: number;
  /** Resolve it drains on reaching him. */
  drain: number;
  /** Its size: touched within this of its centre, px; drawn at twice it. */
  radius: number;
  /** Weapons of these kinds pass through it. */
  immuneTo?: readonly WeaponKind[];
  /** It comforts the cats around it: within `radius`, each loses this much Homesickness a second. */
  soothes?: { radius: number; perSecond: number };
};

export const VARIETIES: Readonly<Record<VarietyId, Variety>> = {
  basic: {
    name: 'Basic Cat',
    description: 'Slow, numerous, and mostly harmless. Mostly.',
    gait: 'walk',
    speed: 42,
    homesickness: 10,
    drain: 2,
    radius: 14,
  },
  zoomies: {
    name: 'Zoomies Cat',
    description: 'Extremely fast. Where it is going, not even it knows.',
    gait: 'zoom',
    speed: 190,
    homesickness: 14,
    drain: 4,
    radius: 13,
  },
  hissing: {
    name: 'Hissing Cat',
    description: 'Comes on with intent, and takes a great deal of persuading.',
    gait: 'charge',
    speed: 95,
    homesickness: 70,
    drain: 8,
    radius: 16,
  },
  fat: {
    name: 'Fat Cat',
    description: 'Very slow. Enormous. Almost impossible to move.',
    gait: 'walk',
    speed: 24,
    homesickness: 280,
    drain: 14,
    radius: 34,
  },
  kitten: {
    name: 'Kitten',
    description: 'Tiny. They never come alone.',
    gait: 'walk',
    speed: 80,
    homesickness: 6,
    drain: 1,
    radius: 9,
  },
  box: {
    name: 'Box Cat',
    description: 'It sits in its box, perfectly calm. It is not leaving.',
    gait: 'sit',
    speed: 0,
    homesickness: 650,
    drain: 6,
    radius: 26,
  },
  laser: {
    name: 'Laser Cat',
    description: 'It keeps its distance, and returns fire.',
    gait: 'snipe',
    speed: 70,
    homesickness: 40,
    drain: 5,
    radius: 16,
  },
  possessed: {
    name: 'Possessed Cat',
    description: 'Something looks out through its eyes. Lasers pass straight through.',
    gait: 'walk',
    speed: 60,
    homesickness: 90,
    drain: 9,
    radius: 16,
    immuneTo: ['beam', 'chain'],
  },
  mega: {
    name: 'Mega Cat',
    description: 'An orange tabby of unreasonable size. It has come for the Keeper.',
    gait: 'walk',
    speed: 34,
    homesickness: 4500,
    drain: 25,
    radius: 90,
  },
  comforter: {
    name: 'Purring Cat',
    description: 'It purrs, and the cats around it forget that they wished to go home.',
    gait: 'walk',
    speed: 40,
    homesickness: 260,
    drain: 3,
    // The cats' own size, so it stays in the grid (a bigger one is searched always).
    radius: 16,
    // Less than the Laser Pointer gives at its first level (about 18 a second), so
    // one Purring Cat only slows it. Weaker work (the Thunderous Vacuum's first level,
    // 10) or two Purring Cats together hold a cat back until one is sent home first.
    soothes: { radius: 140, perSecond: 12 },
  },
  neighbour: {
    name: 'The Neighbour’s Cat',
    description: 'It sits beside him, as if it had always lived here. It has not.',
    gait: 'sit',
    speed: 0,
    homesickness: 900,
    drain: 0,
    radius: 18,
  },
};

export type Schedule = {
  /** From this time each variety (or the xenocats) may come, with this weight. */
  arrivals: readonly { from: number; who: VarietyId | 'xenocat'; weight: number }[];
  /** Kitten swarms: the first, then one every so often, so many kittens each. */
  swarms: { from: number; everyMs: number; size: readonly [number, number] };
  /** When a Mega Cat arrives, ms into the run. */
  bosses: readonly number[];
};

/**
 * Over the five minutes: plain cats and xenocats first, then the zoomies, swarms of
 * kittens, the hissing, boxes, snipers, the purring, the fat and the possessed; a
 * Mega Cat at two minutes and again at four.
 */
export const SCHEDULE: Schedule = {
  arrivals: [
    { from: 0, who: 'basic', weight: 6 },
    { from: 0, who: 'xenocat', weight: 4 },
    { from: 20_000, who: 'zoomies', weight: 2 },
    { from: 60_000, who: 'hissing', weight: 2 },
    { from: 90_000, who: 'box', weight: 0.4 },
    { from: 120_000, who: 'laser', weight: 1 },
    { from: 130_000, who: 'comforter', weight: 0.6 },
    { from: 150_000, who: 'fat', weight: 0.8 },
    { from: 180_000, who: 'possessed', weight: 1.2 },
  ],
  swarms: { from: 45_000, everyMs: 25_000, size: [12, 20] },
  bosses: [120_000, 240_000],
};

/** Which varieties may come at `ms`, with their weights. */
export function arrivalsAt(ms: number, schedule: Schedule = SCHEDULE) {
  return schedule.arrivals.filter((a) => a.from <= ms);
}
