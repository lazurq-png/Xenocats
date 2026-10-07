// What the Keeper can carry in Survival (arena.ts): nine weapons that fire on their
// own, up to level 8, and passives that make him or his weapons better, up to level
// 5; at most six of each. Each level-up offers three choices (four with the Lucky
// Bell), drawn from what he does not yet have at its highest level. Pure data and
// rules, no DOM: arena.ts makes the weapons fire.

import type { Random } from './random';

export const MAX_WEAPON_LEVEL = 8;
export const MAX_PASSIVE_LEVEL = 5;
export const WEAPON_SLOTS = 6;
export const PASSIVE_SLOTS = 6;

export type WeaponId =
  | 'laser-pointer'
  | 'cat-treats'
  | 'vacuum-cleaner'
  | 'spray-bottle'
  | 'yarn-ball'
  | 'can-opener'
  | 'hairball'
  | 'thunderous-vacuum'
  | 'laser-pointer-deluxe';

export type PassiveId =
  | 'rubber-chicken'
  | 'battery'
  | 'catnip'
  | 'scissors'
  | 'wool-sweater'
  | 'warm-milk'
  | 'long-whiskers'
  | 'stern-look'
  | 'lucky-bell';

/** A weapon at one level, before the passives. */
export type WeaponStats = {
  /** Between two firings, ms (continuous weapons: unused). */
  cooldownMs: number;
  /** Homesickness each touch gives (continuous weapons: a second). */
  damage: number;
  /** Its reach, size or radius, px. */
  area: number;
  /** How many: beams, treats, droplets, balls, blades, jumps. */
  count: number;
  /** px/s, for what flies. */
  speed: number;
  /** How long what it makes lasts, ms. */
  durationMs: number;
  /** How many cats one thing it fires can touch before it is spent. */
  pierce: number;
};

type Growth = { [K in keyof WeaponStats]: readonly [number, number] };

/** Level 1 at the first value, level 8 at the second, evenly between; counts rounded down. */
function levels(growth: Growth): WeaponStats[] {
  return Array.from({ length: MAX_WEAPON_LEVEL }, (_, i) => {
    const t = i / (MAX_WEAPON_LEVEL - 1);
    const at = ([a, b]: readonly [number, number]) => a + (b - a) * t;
    return {
      cooldownMs: Math.round(at(growth.cooldownMs)),
      damage: Math.round(at(growth.damage)),
      area: Math.round(at(growth.area)),
      count: Math.floor(at(growth.count) + 1e-9),
      // Not rounded: some speeds are shares and turns (the vacuum's pull, the blades').
      speed: Math.round(at(growth.speed) * 100) / 100,
      durationMs: Math.round(at(growth.durationMs)),
      pierce: Math.floor(at(growth.pierce) + 1e-9),
    };
  });
}

export type WeaponKind =
  /** Beams at the nearest cats, at once. */
  | 'beam'
  /** Things fired at the nearest cat, in a spread. */
  | 'spread'
  /** Pulls the cats round him in. */
  | 'pull'
  /** Droplets in an arc the way he faces. */
  | 'arc'
  /** Balls that bounce round the screen. */
  | 'bounce'
  /** Blades that circle him. */
  | 'orbit'
  /** A ball that bursts into smaller ones. */
  | 'burst'
  /** A zone round him. */
  | 'zone'
  /** A beam that jumps from cat to cat. */
  | 'chain';

export type WeaponInfo = {
  name: string;
  /** In the game's voice. */
  description: string;
  kind: WeaponKind;
  levels: readonly WeaponStats[];
};

export const WEAPONS: Readonly<Record<WeaponId, WeaponInfo>> = {
  'laser-pointer': {
    name: 'Laser Pointer',
    description: 'A red dot no cat can ignore. Whatever it touches grows homesick.',
    kind: 'beam',
    levels: levels({
      cooldownMs: [1100, 650],
      damage: [20, 45],
      area: [300, 420],
      count: [1, 4],
      speed: [0, 0],
      durationMs: [180, 180],
      pierce: [99, 99],
    }),
  },
  'cat-treats': {
    name: 'Cat Treats',
    description: 'Thrown in a spread. Delicious, and yet they make a cat long for home.',
    kind: 'spread',
    levels: levels({
      cooldownMs: [1300, 700],
      damage: [14, 30],
      area: [9, 13],
      count: [3, 9],
      speed: [420, 520],
      durationMs: [1400, 1700],
      pierce: [2, 5],
    }),
  },
  'vacuum-cleaner': {
    name: 'Vacuum Cleaner',
    description: 'Now and then it draws the nearest cats in, protesting.',
    kind: 'pull',
    levels: levels({
      cooldownMs: [3200, 1900],
      damage: [6, 18],
      area: [170, 300],
      count: [1, 1],
      speed: [0.35, 0.6],
      durationMs: [300, 300],
      pierce: [99, 99],
    }),
  },
  'spray-bottle': {
    name: 'Spray Bottle',
    description: 'Water in a wide arc. No cat has ever forgiven it.',
    kind: 'arc',
    levels: levels({
      cooldownMs: [1500, 800],
      damage: [10, 24],
      area: [70, 140],
      count: [6, 16],
      speed: [360, 460],
      durationMs: [500, 650],
      pierce: [2, 4],
    }),
  },
  'yarn-ball': {
    name: 'Yarn Ball',
    description: 'It bounces about the screen, and no cat can let it pass.',
    kind: 'bounce',
    levels: levels({
      cooldownMs: [3500, 2200],
      damage: [12, 26],
      area: [12, 18],
      count: [1, 4],
      speed: [300, 380],
      durationMs: [3000, 4500],
      pierce: [99, 99],
    }),
  },
  'can-opener': {
    name: 'Can Opener',
    description: 'Blades that circle him. The sound alone sends cats home.',
    kind: 'orbit',
    levels: levels({
      cooldownMs: [0, 0],
      damage: [55, 110],
      area: [70, 110],
      count: [1, 5],
      speed: [2.6, 4.2],
      durationMs: [0, 0],
      pierce: [99, 99],
    }),
  },
  hairball: {
    name: 'Hairball',
    description: 'Coughed up at a cat. It bursts into smaller, worse hairballs.',
    kind: 'burst',
    levels: levels({
      cooldownMs: [2000, 1200],
      damage: [22, 44],
      area: [14, 20],
      count: [4, 9],
      speed: [330, 400],
      durationMs: [900, 1200],
      pierce: [1, 1],
    }),
  },
  'thunderous-vacuum': {
    name: 'Thunderous Vacuum',
    description: 'A vast and terrible hum. Every cat near him wishes it were elsewhere.',
    kind: 'zone',
    levels: levels({
      cooldownMs: [0, 0],
      damage: [10, 30],
      area: [110, 190],
      count: [1, 1],
      speed: [0, 0],
      durationMs: [0, 0],
      pierce: [99, 99],
    }),
  },
  'laser-pointer-deluxe': {
    name: 'Laser Pointer Deluxe',
    description: 'The red dot, refined: it leaps from cat to cat.',
    kind: 'chain',
    levels: levels({
      cooldownMs: [1600, 900],
      damage: [18, 36],
      area: [220, 300],
      count: [3, 8],
      speed: [0, 0],
      durationMs: [220, 220],
      pierce: [99, 99],
    }),
  },
};

export type PassiveInfo = {
  name: string;
  description: string;
  /** Usually MAX_PASSIVE_LEVEL; the Lucky Bell has one. */
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
};

export function modifiers(passives: ReadonlyMap<PassiveId, number>): Modifiers {
  const level = (id: PassiveId) => passives.get(id) ?? 0;
  return {
    speed: 1 + 0.1 * level('rubber-chicken'),
    cooldown: 1 - 0.08 * level('battery'),
    area: 1 + 0.1 * level('catnip'),
    count: Math.floor(level('scissors') / 2) + (level('scissors') === MAX_PASSIVE_LEVEL ? 1 : 0),
    maxResolve: 20 * level('wool-sweater'),
    recovery: 0.4 * level('warm-milk'),
    pickup: 1 + 0.25 * level('long-whiskers'),
    might: 1 + 0.1 * level('stern-look'),
    choices: 3 + level('lucky-bell'),
  };
}

/** A weapon's stats at `level`, with the passives' modifiers. */
export function weaponStats(id: WeaponId, level: number, mods: Modifiers): WeaponStats {
  const base = WEAPONS[id].levels[Math.min(Math.max(level, 1), MAX_WEAPON_LEVEL) - 1];
  return {
    ...base,
    cooldownMs: base.cooldownMs * mods.cooldown,
    damage: base.damage * mods.might,
    area: base.area * mods.area,
    count: base.count + mods.count,
  };
}

/** Experience needed from `level` to the next. */
export function xpToNext(level: number): number {
  return Math.round(5 + (level - 1) * 9 + Math.max(level - 1, 0) ** 1.6 * 0.8);
}

export type Choice =
  | { kind: 'weapon'; id: WeaponId; level: number }
  | { kind: 'passive'; id: PassiveId; level: number }
  /** Nothing left to offer: a sip of Resolve instead. */
  | { kind: 'restore' };

/**
 * A level-up's choices: new weapons or passives while there are slots, or the next
 * level of one held, never one at its highest level; `count` of them, all
 * different, at random. With nothing left, a sip of Resolve.
 */
export function offerChoices(
  weapons: ReadonlyMap<WeaponId, number>,
  passives: ReadonlyMap<PassiveId, number>,
  count: number,
  random: Random,
  available: readonly WeaponId[] = Object.keys(WEAPONS) as WeaponId[]
): Choice[] {
  const pool: Choice[] = [];
  for (const id of available) {
    const level = weapons.get(id);
    if (level === undefined) {
      if (weapons.size < WEAPON_SLOTS) pool.push({ kind: 'weapon', id, level: 1 });
    } else if (level < MAX_WEAPON_LEVEL) pool.push({ kind: 'weapon', id, level: level + 1 });
  }
  for (const id of Object.keys(PASSIVES) as PassiveId[]) {
    const level = passives.get(id);
    if (level === undefined) {
      if (passives.size < PASSIVE_SLOTS) pool.push({ kind: 'passive', id, level: 1 });
    } else if (level < PASSIVES[id].maxLevel) pool.push({ kind: 'passive', id, level: level + 1 });
  }
  if (pool.length === 0) return [{ kind: 'restore' }];
  const picked: Choice[] = [];
  while (picked.length < count && pool.length > 0) {
    picked.push(pool.splice(random.int(0, pool.length - 1), 1)[0]);
  }
  return picked;
}

/** A choice's name and line, for the level-up dialog. */
export function describeChoice(choice: Choice): { name: string; description: string } {
  if (choice.kind === 'restore') {
    return {
      name: 'A Moment of Rest',
      description: 'Nothing more to learn. Some Resolve returns.',
    };
  }
  const info = choice.kind === 'weapon' ? WEAPONS[choice.id] : PASSIVES[choice.id];
  return {
    name: choice.level === 1 ? info.name : `${info.name}, level ${choice.level}`,
    description: info.description,
  };
}
