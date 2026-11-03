// Survival's arsenal (arsenal.ts): evolutions and fusions, the passives, what they
// add up to, and what a level-up offers. Split out of arsenal.ts, which re-exports
// all of it, so a module may import it from either.

import type { Random } from './random';
import {
  MAX_WEAPON_LEVEL,
  MAX_PASSIVE_LEVEL,
  type Slots,
  DEFAULT_SLOTS,
  type WeaponId,
  type PassiveId,
  type WeaponStats,
  type WeaponKind,
  WEAPONS,
} from './arsenal-weapons';

export type Evolution = { from: WeaponId; with: PassiveId; to: WeaponId; secret?: true };

export const EVOLUTIONS: readonly Evolution[] = [
  { from: 'laser-pointer', with: 'battery', to: 'infinite-laser' },
  { from: 'vacuum-cleaner', with: 'catnip', to: 'forbidden-catnip-vacuum' },
  { from: 'yarn-ball', with: 'scissors', to: 'yarn-apocalypse' },
  { from: 'cat-treats', with: 'long-whiskers', to: 'banquet' },
  { from: 'spray-bottle', with: 'wool-sweater', to: 'monsoon' },
  { from: 'can-opener', with: 'warm-milk', to: 'bottomless-saucer', secret: true },
  { from: 'feather-wand', with: 'cushion', to: 'peacock-tail' },
  { from: 'squeaky-toy', with: 'egg-timer', to: 'squeak-symphony' },
  { from: 'cardboard-box', with: 'slippers', to: 'cardboard-castle' },
  { from: 'hair-dryer', with: 'tin-foil', to: 'scorch-dryer' },
  { from: 'bath-tub', with: 'fish-bowl', to: 'jacuzzi' },
  { from: 'tennis-ball', with: 'tape-measure', to: 'serve-machine' },
  { from: 'frying-pan', with: 'oven-mitts', to: 'cast-iron-skillet' },
  { from: 'static-sock', with: 'reading-glasses', to: 'static-storm' },
  { from: 'cucumber', with: 'cookie-jar', to: 'pickle-jar' },
  { from: 'ceiling-fan', with: 'hot-water-bottle', to: 'heatwave-fan' },
  { from: 'alarm-clock', with: 'loaded-dice', to: 'grandfather-clock' },
  { from: 'laser-pointer-deluxe', with: 'stern-look', to: 'laser-light-show' },
  { from: 'hairball', with: 'lucky-bell', to: 'lucky-furball' },
  { from: 'thunderous-vacuum', with: 'rubber-chicken', to: 'roaring-upright' },
];

/**
 * Two evolved weapons, held together, become one at a chest (before an evolution
 * is made): it fires what both fired, and something of its own, and takes one
 * weapon slot instead of two. Never offered at a level-up.
 */
export type Fusion = { from: readonly [WeaponId, WeaponId]; to: WeaponId };

export const FUSIONS: readonly Fusion[] = [
  { from: ['infinite-laser', 'monsoon'], to: 'thunderstorm' },
  { from: ['forbidden-catnip-vacuum', 'scorch-dryer'], to: 'scorching-maw' },
  { from: ['yarn-apocalypse', 'banquet'], to: 'yarn-feast' },
  { from: ['bottomless-saucer', 'squeak-symphony'], to: 'milk-symphony' },
  { from: ['serve-machine', 'static-storm'], to: 'grand-slam' },
  { from: ['cast-iron-skillet', 'pickle-jar'], to: 'kitchen-sink' },
  { from: ['heatwave-fan', 'grandfather-clock'], to: 'clockwork-gale' },
  { from: ['peacock-tail', 'laser-light-show'], to: 'peacock-prism' },
  { from: ['jacuzzi', 'lucky-furball'], to: 'bubble-bath' },
  { from: ['cardboard-castle', 'roaring-upright'], to: 'fort-hoover' },
];

/** The weapons a level-up may offer: all but the evolved and the fused ones. */
export const BASE_WEAPONS: readonly WeaponId[] = (Object.keys(WEAPONS) as WeaponId[]).filter(
  (id) => !EVOLUTIONS.some((e) => e.to === id) && !FUSIONS.some((f) => f.to === id)
);

/** The fusion a chest opened now would make, if any: the first whose two are held. */
export function fusionFor(weapons: ReadonlyMap<WeaponId, number>): Fusion | null {
  for (const fusion of FUSIONS) {
    if (fusion.from.every((id) => weapons.has(id)) && !weapons.has(fusion.to)) return fusion;
  }
  return null;
}

/** The evolved weapons the fused ones held have absorbed. */
export function absorbedBy(weapons: ReadonlyMap<WeaponId, number>): Set<WeaponId> {
  const absorbed = new Set<WeaponId>();
  for (const fusion of FUSIONS)
    if (weapons.has(fusion.to)) for (const id of fusion.from) absorbed.add(id);
  return absorbed;
}

/**
 * The passives a weapon took in when it evolved (they are part of it now, at their
 * highest level): its evolution's, or, fused, both its parents'. None for a base weapon.
 */
export function passivesIn(id: WeaponId): PassiveId[] {
  const fusion = FUSIONS.find((f) => f.to === id);
  if (fusion) return fusion.from.flatMap(passivesIn);
  const evolution = EVOLUTIONS.find((e) => e.to === id);
  return evolution ? [evolution.with] : [];
}

/** The evolution a chest opened now would bring, if any: the first that is ready. */
export function evolutionFor(
  weapons: ReadonlyMap<WeaponId, number>,
  passives: ReadonlyMap<PassiveId, number>
): Evolution | null {
  for (const evolution of EVOLUTIONS) {
    if (
      weapons.get(evolution.from) === MAX_WEAPON_LEVEL &&
      (passives.get(evolution.with) ?? 0) > 0 &&
      !weapons.has(evolution.to)
    ) {
      return evolution;
    }
  }
  return null;
}

export type PassiveInfo = {
  name: string;
  description: string;
  /** Usually MAX_PASSIVE_LEVEL; the Lucky Bell has one, the Loaded Dice three. */
  maxLevel: number;
};

export const PASSIVES: Readonly<Record<PassiveId, PassiveInfo>> = {
  'rubber-chicken': {
    name: 'Rubber Chicken',
    description: 'Squeaks with every step. He walks faster, to be rid of the sound.',
    maxLevel: MAX_PASSIVE_LEVEL,
  },
  battery: {
    name: 'Battery',
    description: 'Fresh, and warm. His weapons ready themselves sooner.',
    maxLevel: MAX_PASSIVE_LEVEL,
  },
  catnip: {
    name: 'Catnip',
    description: 'A pocketful. His weapons reach further.',
    maxLevel: MAX_PASSIVE_LEVEL,
  },
  scissors: {
    name: 'Scissors',
    description: 'For cutting things in two. More of what his weapons fire.',
    maxLevel: MAX_PASSIVE_LEVEL,
  },
  'wool-sweater': {
    name: 'Wool Sweater',
    description: 'Knitted long ago. More Resolve.',
    maxLevel: MAX_PASSIVE_LEVEL,
  },
  'warm-milk': {
    name: 'Warm Milk',
    description: 'He sips, and his Resolve slowly returns.',
    maxLevel: MAX_PASSIVE_LEVEL,
  },
  'long-whiskers': {
    name: 'Long Whiskers',
    description: 'Borrowed. He gathers experience from further off.',
    maxLevel: MAX_PASSIVE_LEVEL,
  },
  'stern-look': {
    name: 'Stern Look',
    description: 'Practised in the mirror. Every touch makes a cat more homesick.',
    maxLevel: MAX_PASSIVE_LEVEL,
  },
  'lucky-bell': {
    name: 'Lucky Bell',
    description: 'A small brass bell. One more choice at every level.',
    maxLevel: 1,
  },
  'egg-timer': {
    name: 'Egg Timer',
    description: 'It ticks louder than it should. What his weapons make lasts longer.',
    maxLevel: MAX_PASSIVE_LEVEL,
  },
  slippers: {
    name: 'Slippers',
    description: 'Soft, and silent on any floor. What his weapons fire goes through more cats.',
    maxLevel: MAX_PASSIVE_LEVEL,
  },
  cushion: {
    name: 'Cushion',
    description: 'Somewhere soft to land. He stays untouchable a little longer after a hit.',
    maxLevel: MAX_PASSIVE_LEVEL,
  },
  'fish-bowl': {
    name: 'Fish Bowl',
    description: 'Something to stare at, and learn from. Gems are worth more.',
    maxLevel: MAX_PASSIVE_LEVEL,
  },
  'tin-foil': {
    name: 'Tin Foil',
    description: 'A hat, for reasons. The tricks of the elite cats wear off sooner.',
    maxLevel: MAX_PASSIVE_LEVEL,
  },
  'tape-measure': {
    name: 'Tape Measure',
    description: 'He has worked out the distances. What his weapons throw flies faster.',
    maxLevel: MAX_PASSIVE_LEVEL,
  },
  'oven-mitts': {
    name: 'Oven Mitts',
    description: 'Thick, and quilted. A cat that reaches him takes less of his Resolve.',
    maxLevel: MAX_PASSIVE_LEVEL,
  },
  'reading-glasses': {
    name: 'Reading Glasses',
    description: 'He looks closer. The elites and the Mega Cats grow more homesick.',
    maxLevel: MAX_PASSIVE_LEVEL,
  },
  'cookie-jar': {
    name: 'Cookie Jar',
    description: 'Never quite empty. The cats sent home leave more behind them.',
    maxLevel: MAX_PASSIVE_LEVEL,
  },
  'hot-water-bottle': {
    name: 'Hot Water Bottle',
    description: 'Tucked under the coat. Each level he reaches, some Resolve returns.',
    maxLevel: MAX_PASSIVE_LEVEL,
  },
  'loaded-dice': {
    name: 'Loaded Dice',
    description: 'They land how he likes. Another reroll, for the rest of the run.',
    maxLevel: 3,
  },
};

/** What the passives held add up to. */
export type Modifiers = {
  speed: number;
  cooldown: number;
  area: number;
  /** Added to every weapon's count. */
  count: number;
  maxResolve: number;
  /** Resolve a second. */
  recovery: number;
  pickup: number;
  might: number;
  choices: number;
  /** Multiplies how long what a weapon makes lasts. */
  duration: number;
  /** Added to how many cats one thing a weapon fires or places can take. */
  pierce: number;
  /** Added to the moment he is untouchable after a hit, ms. */
  grace: number;
  /** Multiplies the experience a gem gives. */
  xp: number;
  /** The share an elite's effect on him is cut by. */
  guard: number;
  /** Multiplies how fast what a weapon throws flies (THROWN). */
  velocity: number;
  /** Multiplies the Resolve a cat (or its shot, or a boss) drains from him. */
  drain: number;
  /** Multiplies the Homesickness his weapons give elites and Mega Cats. */
  elite: number;
  /** Multiplies how often a cat sent home leaves a pickup. */
  luck: number;
  /** Resolve he regains at each level reached. */
  levelHeal: number;
  /** Rerolls added to what he has left. */
  rerolls: number;
};

export function modifiers(passives: ReadonlyMap<PassiveId, number>): Modifiers {
  const level = (id: PassiveId) => passives.get(id) ?? 0;
  return {
    speed: 1 + 0.1 * level('rubber-chicken'),
    cooldown: 1 - 0.08 * level('battery'),
    area: 1 + 0.1 * level('catnip'),
    count: level('scissors'),
    maxResolve: 20 * level('wool-sweater'),
    recovery: 0.4 * level('warm-milk'),
    pickup: 1 + 0.25 * level('long-whiskers'),
    might: 1 + 0.1 * level('stern-look'),
    choices: 3 + level('lucky-bell'),
    duration: 1 + 0.12 * level('egg-timer'),
    pierce: level('slippers'),
    grace: 120 * level('cushion'),
    xp: 1 + 0.12 * level('fish-bowl'),
    guard: 0.15 * level('tin-foil'),
    velocity: 1 + 0.12 * level('tape-measure'),
    drain: 1 - 0.08 * level('oven-mitts'),
    elite: 1 + 0.15 * level('reading-glasses'),
    luck: 1 + 0.3 * level('cookie-jar'),
    levelHeal: 4 * level('hot-water-bottle'),
    rerolls: level('loaded-dice'),
  };
}

/** The kinds whose speed is how fast what they throw flies (Tape Measure's). */
const THROWN: readonly WeaponKind[] = ['spread', 'burst', 'arc', 'bounce', 'boomerang', 'scare'];

/** A weapon's stats at `level`, with the passives' modifiers. */
export function weaponStats(id: WeaponId, level: number, mods: Modifiers): WeaponStats {
  const base = WEAPONS[id].levels[Math.min(Math.max(level, 1), MAX_WEAPON_LEVEL) - 1];
  return {
    ...base,
    speed: THROWN.includes(WEAPONS[id].kind) ? base.speed * mods.velocity : base.speed,
    cooldownMs: base.cooldownMs * mods.cooldown,
    damage: base.damage * mods.might,
    area: base.area * mods.area,
    count: base.count + mods.count,
    // What lasts, lasts longer; what passes through cats (not the unlimited) passes through more.
    durationMs: base.durationMs * mods.duration,
    pierce: base.pierce < 99 ? base.pierce + mods.pierce : base.pierce,
  };
}

/** Experience needed from `level` to the next. */
export function xpToNext(level: number): number {
  // The square term is small for a five-minute run's levels, and makes the last of a long
  // run's (every weapon and passive at its best) cost about twice what they did. The cube
  // is smaller still early (a few per cent by level 10) and the most of all late (level
  // 100 costs about 80% more): a late run sends cats home by the thousand, and every
  // weapon at its best should not come before twenty minutes or so.
  const n = Math.max(level - 1, 0);
  return Math.round(5 + n * 9 + n ** 2 * 0.4 + n ** 3 * 0.004);
}

export type Choice =
  | { kind: 'weapon'; id: WeaponId; level: number }
  | { kind: 'passive'; id: PassiveId; level: number };

/**
 * A level-up's choices: new weapons or passives while there are slots, or the next
 * level of one held, never one at its highest level; `count` of them, all
 * different, at random. With nothing left, none.
 */
export function offerChoices(
  weapons: ReadonlyMap<WeaponId, number>,
  passives: ReadonlyMap<PassiveId, number>,
  count: number,
  random: Random,
  available: readonly WeaponId[] = BASE_WEAPONS,
  slots: Slots = DEFAULT_SLOTS
): Choice[] {
  const pool: Choice[] = [];
  const absorbed = absorbedBy(weapons);
  for (const id of available) {
    // A weapon that has evolved is gone for good: its evolution holds its place, or a
    // fused weapon that took the evolution up.
    if (EVOLUTIONS.some((e) => e.from === id && (weapons.has(e.to) || absorbed.has(e.to)))) {
      continue;
    }
    const level = weapons.get(id);
    if (level === undefined) {
      if (weapons.size < slots.weapons) pool.push({ kind: 'weapon', id, level: 1 });
    } else if (level < MAX_WEAPON_LEVEL) pool.push({ kind: 'weapon', id, level: level + 1 });
  }
  // A passive an evolved weapon took in is part of it now: never offered again.
  const takenIn = new Set([...weapons.keys()].flatMap(passivesIn));
  for (const id of Object.keys(PASSIVES) as PassiveId[]) {
    if (takenIn.has(id)) continue;
    const level = passives.get(id);
    if (level === undefined) {
      if (passives.size < slots.passives) pool.push({ kind: 'passive', id, level: 1 });
    } else if (level < PASSIVES[id].maxLevel) pool.push({ kind: 'passive', id, level: level + 1 });
  }
  const picked: Choice[] = [];
  while (picked.length < count && pool.length > 0) {
    picked.push(pool.splice(random.int(0, pool.length - 1), 1)[0]);
  }
  return picked;
}

/**
 * How many level-ups a Keeper could still use, by offerChoices' rules: every level
 * left on what he holds, and every level of what still has a slot to come into (the
 * most levels first, when the slots run out before the candidates).
 */
export function upgradesLeft(
  weapons: ReadonlyMap<WeaponId, number>,
  passives: ReadonlyMap<PassiveId, number>,
  available: readonly WeaponId[] = BASE_WEAPONS,
  slots: Slots = DEFAULT_SLOTS
): number {
  const absorbed = absorbedBy(weapons);
  let left = 0;
  let newWeapons = 0;
  for (const id of available) {
    if (EVOLUTIONS.some((e) => e.from === id && (weapons.has(e.to) || absorbed.has(e.to)))) {
      continue;
    }
    const level = weapons.get(id);
    if (level === undefined) newWeapons++;
    else left += MAX_WEAPON_LEVEL - level;
  }
  left += Math.min(newWeapons, Math.max(slots.weapons - weapons.size, 0)) * MAX_WEAPON_LEVEL;
  const takenIn = new Set([...weapons.keys()].flatMap(passivesIn));
  const newPassives: number[] = [];
  for (const id of Object.keys(PASSIVES) as PassiveId[]) {
    if (takenIn.has(id)) continue;
    const level = passives.get(id);
    if (level === undefined) newPassives.push(PASSIVES[id].maxLevel);
    else left += PASSIVES[id].maxLevel - level;
  }
  const free = Math.max(slots.passives - passives.size, 0);
  for (const max of newPassives.sort((a, b) => b - a).slice(0, free)) left += max;
  return left;
}
