// What the Keeper can carry in Survival (arena.ts): fourteen weapons that fire on their
// own, up to level 8, and passives that make him or his weapons better, up to level
// 5; at most six of each. Each level-up offers three choices (four with the Lucky
// Bell), drawn from what he does not yet have at its highest level. A weapon at its
// highest level, held with its passive, evolves when he opens a chest (EVOLUTIONS).
// Pure data and rules, no DOM: arena.ts makes the weapons fire.

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
  | 'laser-pointer-deluxe'
  | 'feather-wand'
  | 'squeaky-toy'
  | 'cardboard-box'
  | 'hair-dryer'
  | 'bath-tub'
  // Evolved: never offered, only reached by evolution.
  | 'infinite-laser'
  | 'forbidden-catnip-vacuum'
  | 'yarn-apocalypse'
  | 'banquet'
  | 'monsoon'
  | 'bottomless-saucer'
  | 'peacock-tail'
  | 'squeak-symphony'
  | 'cardboard-castle'
  | 'scorch-dryer'
  | 'jacuzzi';

export type PassiveId =
  | 'rubber-chicken'
  | 'battery'
  | 'catnip'
  | 'scissors'
  | 'wool-sweater'
  | 'warm-milk'
  | 'long-whiskers'
  | 'stern-look'
  | 'lucky-bell'
  | 'egg-timer'
  | 'slippers'
  | 'cushion'
  | 'fish-bowl'
  | 'tin-foil';

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

/** What one level adds to the level before it: each stat named is added to. */
export type Step = Partial<WeaponStats>;

/** One set of stats at every level: an evolved weapon does not grow. */
function fixed(stats: WeaponStats): WeaponStats[] {
  return Array.from({ length: MAX_WEAPON_LEVEL }, () => stats);
}

/**
 * Level 1's stats, then what each of levels 2 to 8 adds (seven steps). Every level
 * changes something the player notices (levelChanges), and its card says exactly
 * that, so a level never passes unseen.
 */
function ladder(base: WeaponStats, steps: readonly Step[]): WeaponStats[] {
  if (steps.length !== MAX_WEAPON_LEVEL - 1) throw new Error('A ladder has seven steps.');
  const all = [base];
  for (const step of steps) {
    const before = all[all.length - 1];
    const next = { ...before };
    for (const key of Object.keys(step) as (keyof WeaponStats)[]) {
      // Rounded: the speeds that are shares and turns (the vacuum's pull, the
      // blades') keep two decimals.
      next[key] = Math.round((before[key] + (step[key] ?? 0)) * 100) / 100;
    }
    all.push(next);
  }
  return all;
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
  | 'chain'
  /** Beams at every cat near him, joined to one another, all the time. */
  | 'web'
  /** Pulls every cat far round him in, then sends those close home at once. */
  | 'gulp'
  /** A swing of feathers across a sector round him: damage, and cats knocked back. */
  | 'sweep'
  /** A toy set down among the cats: every cat near it comes for it, and is hurt there. */
  | 'lure'
  /** A box set down on the cats: whichever cats it takes are held in it, and hurt. */
  | 'trap'
  /** A jet of hot air the way he faces: cats in it are pushed back, and hurt, all the time. */
  | 'blow';

export type WeaponInfo = {
  name: string;
  /** In the game's voice. */
  description: string;
  kind: WeaponKind;
  /** What its count counts, one of them ("beam"): the level-up cards' word. */
  unit: string;
  levels: readonly WeaponStats[];
};

export const WEAPONS: Readonly<Record<WeaponId, WeaponInfo>> = {
  'laser-pointer': {
    name: 'Laser Pointer',
    description: 'A red dot no cat can ignore. Whatever it touches grows homesick.',
    kind: 'beam',
    unit: 'beam',
    levels: ladder(
      { cooldownMs: 1100, damage: 20, area: 300, count: 1, speed: 0, durationMs: 180, pierce: 99 },
      [
        { count: 1 },
        { damage: 8 },
        { cooldownMs: -220 },
        { count: 1 },
        { damage: 9, area: 60 },
        { cooldownMs: -230 },
        { count: 1, damage: 8, area: 60 },
      ]
    ),
  },
  'cat-treats': {
    name: 'Cat Treats',
    description: 'Thrown in a spread. Delicious, and yet they make a cat long for home.',
    kind: 'spread',
    unit: 'treat',
    levels: ladder(
      { cooldownMs: 1300, damage: 14, area: 9, count: 3, speed: 420, durationMs: 1400, pierce: 2 },
      [
        { count: 2 },
        { damage: 5, pierce: 1 },
        { cooldownMs: -300 },
        { count: 2, area: 2 },
        { damage: 5, pierce: 1, speed: 100 },
        { cooldownMs: -300, durationMs: 300 },
        { count: 2, damage: 6, pierce: 1, area: 2 },
      ]
    ),
  },
  'vacuum-cleaner': {
    name: 'Vacuum Cleaner',
    description: 'Now and then it draws the nearest cats in, protesting.',
    kind: 'pull',
    unit: 'pull',
    levels: ladder(
      {
        cooldownMs: 3200,
        damage: 6,
        area: 170,
        count: 1,
        speed: 0.35,
        durationMs: 300,
        pierce: 99,
      },
      [
        { area: 40 },
        { damage: 4 },
        { cooldownMs: -450 },
        { speed: 0.12, area: 45 },
        { damage: 4 },
        { cooldownMs: -850 },
        { damage: 4, area: 45, speed: 0.13 },
      ]
    ),
  },
  'spray-bottle': {
    name: 'Spray Bottle',
    description: 'Water in a wide arc. No cat has ever forgiven it.',
    kind: 'arc',
    unit: 'droplet',
    levels: ladder(
      { cooldownMs: 1500, damage: 10, area: 70, count: 6, speed: 360, durationMs: 500, pierce: 2 },
      [
        { count: 3 },
        { damage: 4, area: 20 },
        { cooldownMs: -300 },
        { count: 3, pierce: 1 },
        { damage: 5, area: 25, speed: 100 },
        { cooldownMs: -400, durationMs: 150 },
        { count: 4, damage: 5, area: 25, pierce: 1 },
      ]
    ),
  },
  'yarn-ball': {
    name: 'Yarn Ball',
    description: 'It bounces about the screen, and no cat can let it pass.',
    kind: 'bounce',
    unit: 'ball',
    levels: ladder(
      {
        cooldownMs: 3500,
        damage: 12,
        area: 12,
        count: 1,
        speed: 300,
        durationMs: 3000,
        pierce: 99,
      },
      [
        { count: 1 },
        { damage: 5, durationMs: 500 },
        { cooldownMs: -600 },
        { count: 1, area: 3 },
        { damage: 5, speed: 80, durationMs: 500 },
        { cooldownMs: -700 },
        { count: 1, damage: 4, area: 3, durationMs: 500 },
      ]
    ),
  },
  'can-opener': {
    name: 'Can Opener',
    description: 'Blades that circle him. The sound alone sends cats home.',
    kind: 'orbit',
    unit: 'blade',
    levels: ladder(
      { cooldownMs: 0, damage: 55, area: 70, count: 1, speed: 2.6, durationMs: 0, pierce: 99 },
      [
        { count: 1 },
        { damage: 20 },
        { count: 1, area: 20 },
        { speed: 0.8 },
        { count: 1, damage: 20 },
        { area: 20, speed: 0.8 },
        { count: 1, damage: 15 },
      ]
    ),
  },
  hairball: {
    name: 'Hairball',
    description: 'Coughed up at a cat. It bursts into smaller, worse hairballs.',
    kind: 'burst',
    unit: 'piece',
    levels: ladder(
      { cooldownMs: 2000, damage: 22, area: 14, count: 4, speed: 330, durationMs: 900, pierce: 1 },
      [
        { count: 1 },
        { damage: 7 },
        { cooldownMs: -400, count: 1 },
        { area: 3, speed: 70 },
        { count: 1, damage: 7, durationMs: 300 },
        { cooldownMs: -400, count: 1 },
        { count: 1, damage: 8, area: 3 },
      ]
    ),
  },
  'thunderous-vacuum': {
    name: 'Thunderous Vacuum',
    description: 'A vast and terrible hum. Every cat near him wishes it were elsewhere.',
    kind: 'zone',
    unit: 'zone',
    levels: ladder(
      { cooldownMs: 0, damage: 10, area: 110, count: 1, speed: 0, durationMs: 0, pierce: 99 },
      [
        { area: 20 },
        { damage: 5 },
        { area: 20 },
        { damage: 5 },
        { area: 20 },
        { damage: 5 },
        { damage: 5, area: 20 },
      ]
    ),
  },
  'laser-pointer-deluxe': {
    name: 'Laser Pointer Deluxe',
    description: 'The red dot, refined: it leaps from cat to cat.',
    kind: 'chain',
    unit: 'jump',
    levels: ladder(
      { cooldownMs: 1600, damage: 18, area: 220, count: 3, speed: 0, durationMs: 220, pierce: 99 },
      [
        { count: 1 },
        { damage: 6 },
        { cooldownMs: -300, count: 1 },
        { area: 40 },
        { count: 1, damage: 6 },
        { cooldownMs: -400, count: 1 },
        { count: 1, damage: 6, area: 40 },
      ]
    ),
  },
  'feather-wand': {
    name: 'Feather Wand',
    description: 'A swish of feathers. Every cat in the swing forgets what it came for.',
    kind: 'sweep',
    unit: 'swing',
    levels: ladder(
      { cooldownMs: 1400, damage: 16, area: 150, count: 1, speed: 90, durationMs: 200, pierce: 99 },
      [
        { count: 1 },
        { damage: 6 },
        { cooldownMs: -250 },
        { area: 30 },
        { count: 1, damage: 5 },
        { speed: 40 },
        { cooldownMs: -250, damage: 6 },
      ]
    ),
  },
  'squeaky-toy': {
    name: 'Squeaky Toy',
    description: 'Set down among the cats. Every cat nearby comes to see, and stays to squeak.',
    kind: 'lure',
    unit: 'toy',
    levels: ladder(
      // Damage is a second's worth, to every cat at the toy; speed is how far the squeak carries.
      {
        cooldownMs: 3800,
        damage: 14,
        area: 55,
        count: 1,
        speed: 260,
        durationMs: 3200,
        pierce: 99,
      },
      [
        { count: 1 },
        { damage: 6 },
        { durationMs: 700 },
        { speed: 60 },
        { count: 1, cooldownMs: -500 },
        { damage: 6, area: 15 },
        { count: 1, durationMs: 800 },
      ]
    ),
  },
  'cardboard-box': {
    name: 'Cardboard Box',
    description: 'If it fits, it sits. A cat taken by a box stays in it until the box gives out.',
    kind: 'trap',
    unit: 'carton',
    levels: ladder(
      // Damage is a second's worth, to each cat held; pierce is how many a box can hold.
      { cooldownMs: 4200, damage: 12, area: 38, count: 1, speed: 0, durationMs: 4000, pierce: 4 },
      [
        { count: 1 },
        { damage: 6 },
        { pierce: 2 },
        { durationMs: 800, area: 8 },
        { count: 1, damage: 5 },
        { cooldownMs: -700, pierce: 2 },
        { count: 1, damage: 6, area: 8 },
      ]
    ),
  },
  'hair-dryer': {
    name: 'Hair Dryer',
    description: 'A gale of warm air. Nothing with fur has ever stood in it for long.',
    kind: 'blow',
    unit: 'jet',
    levels: ladder(
      // Continuous: damage a second, and speed is how fast the cats are blown back, px/s.
      { cooldownMs: 0, damage: 16, area: 190, count: 1, speed: 140, durationMs: 0, pierce: 99 },
      [
        { count: 1 },
        { damage: 8 },
        { area: 30 },
        { speed: 60 },
        { count: 1, damage: 6 },
        { area: 30 },
        { damage: 8, speed: 60 },
      ]
    ),
  },
  'bath-tub': {
    name: 'Bath Tub',
    description: 'Thrown at a cat. It bursts, and what is in it goes everywhere.',
    kind: 'burst',
    unit: 'bubble',
    levels: ladder(
      { cooldownMs: 3000, damage: 30, area: 18, count: 6, speed: 260, durationMs: 1100, pierce: 1 },
      [
        { count: 2 },
        { damage: 10 },
        { cooldownMs: -500 },
        { area: 4, speed: 40 },
        { count: 2, damage: 10 },
        { cooldownMs: -500, durationMs: 300 },
        { count: 2, damage: 12, area: 4 },
      ]
    ),
  },
  'infinite-laser': {
    name: 'Infinite Laser',
    description: 'The red dot, without end. The screen is a web of it.',
    kind: 'web',
    unit: 'beam',
    levels: fixed({
      cooldownMs: 150,
      damage: 22,
      area: 520,
      count: 14,
      speed: 0,
      durationMs: 180,
      pierce: 99,
    }),
  },
  'forbidden-catnip-vacuum': {
    name: 'Forbidden Catnip Vacuum',
    description:
      'It should not exist. It draws in every cat for a long way, then sends them all home.',
    kind: 'gulp',
    unit: 'pull',
    levels: fixed({
      cooldownMs: 4000,
      // Given once, at the burst, to every cat close to him.
      damage: 600,
      // How far it pulls from.
      area: 560,
      count: 1,
      // The share of the way each cat is drawn in.
      speed: 0.85,
      // From the pull to the burst, ms.
      durationMs: 700,
      pierce: 99,
    }),
  },
  'yarn-apocalypse': {
    name: 'Yarn Apocalypse',
    description: 'The yarn splits each time it bounces. Nobody will ever wind it up again.',
    kind: 'bounce',
    unit: 'ball',
    levels: fixed({
      cooldownMs: 2600,
      damage: 30,
      area: 16,
      count: 4,
      speed: 380,
      durationMs: 6000,
      // How many times each ball splits, at most.
      pierce: 4,
    }),
  },
  banquet: {
    name: 'Banquet',
    description: 'Treats in every direction at once. Every cat is invited; every cat goes home.',
    kind: 'spread',
    unit: 'treat',
    levels: fixed({
      cooldownMs: 500,
      damage: 40,
      area: 14,
      // A ring of treats: a spread turns 0.16 rad between each, so 39 go almost all
      // the way round him (348°).
      count: 39,
      speed: 560,
      durationMs: 1800,
      pierce: 8,
    }),
  },
  monsoon: {
    name: 'Monsoon',
    description: 'The bottle, but the sky. A wall of water the way he faces, and it does not stop.',
    kind: 'arc',
    unit: 'droplet',
    levels: fixed({
      cooldownMs: 600,
      damage: 30,
      // The arc's droplets: bigger, and they fly further.
      area: 220,
      count: 32,
      speed: 520,
      durationMs: 650,
      pierce: 8,
    }),
  },
  'bottomless-saucer': {
    name: 'Bottomless Saucer',
    description: 'Warm milk, circling him without end. No cat has ever refused it.',
    kind: 'orbit',
    unit: 'saucer',
    levels: fixed({
      cooldownMs: 0,
      damage: 160,
      area: 130,
      count: 8,
      speed: 4.6,
      durationMs: 0,
      pierce: 99,
    }),
  },
  'peacock-tail': {
    name: 'Peacock Tail',
    description: 'A fan of eyes, all the way round. Every cat it brushes is struck still.',
    kind: 'sweep',
    unit: 'swing',
    levels: fixed({
      cooldownMs: 700,
      damage: 34,
      area: 260,
      // Six sectors: nearly all the way round him.
      count: 6,
      speed: 160,
      // How long a cat it touches is held still, ms.
      durationMs: 1500,
      pierce: 99,
    }),
  },
  'squeak-symphony': {
    name: 'Squeak Symphony',
    description: 'Three toys, a crescendo, and a last note that no cat nearby survives.',
    kind: 'lure',
    unit: 'toy',
    levels: fixed({
      cooldownMs: 2600,
      damage: 40,
      area: 90,
      count: 3,
      speed: 420,
      durationMs: 3800,
      pierce: 99,
    }),
  },
  'cardboard-castle': {
    name: 'Cardboard Castle',
    description: 'Towers, a moat, a drawbridge. Cats near it slow to a crawl; those in it stay.',
    kind: 'trap',
    unit: 'carton',
    levels: fixed({
      cooldownMs: 3000,
      damage: 40,
      area: 70,
      count: 4,
      speed: 0,
      durationMs: 7000,
      pierce: 12,
    }),
  },
  'scorch-dryer': {
    name: 'Scorch Dryer',
    description: 'Hot enough to singe. A scorched cat takes half again from everything else.',
    kind: 'blow',
    unit: 'jet',
    levels: fixed({
      cooldownMs: 0,
      damage: 50,
      area: 300,
      count: 3,
      speed: 240,
      durationMs: 0,
      pierce: 99,
    }),
  },
  jacuzzi: {
    name: 'Jacuzzi',
    description: 'The tub, but much more of it. Every splash leaves a puddle cats cannot cross.',
    kind: 'burst',
    unit: 'bubble',
    levels: fixed({
      cooldownMs: 1800,
      damage: 60,
      area: 22,
      count: 10,
      speed: 300,
      durationMs: 1300,
      pierce: 1,
    }),
  },
};

/**
 * A weapon at its highest level and its passive, held together, become another. A
 * secret one is named nowhere in the game until it has been found (the codex).
 */
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
];

/** The weapons a level-up may offer: all but the evolved ones. */
export const BASE_WEAPONS: readonly WeaponId[] = (Object.keys(WEAPONS) as WeaponId[]).filter(
  (id) => !EVOLUTIONS.some((e) => e.to === id)
);

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
    // What lasts, lasts longer; what passes through cats (not the unlimited) passes through more.
    durationMs: base.durationMs * mods.duration,
    pierce: base.pierce < 99 ? base.pierce + mods.pierce : base.pierce,
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
  available: readonly WeaponId[] = BASE_WEAPONS
): Choice[] {
  const pool: Choice[] = [];
  for (const id of available) {
    // A weapon that has evolved is gone for good: its evolution holds its place.
    if (EVOLUTIONS.some((e) => e.from === id && weapons.has(e.to))) continue;
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

const percent = (after: number, before: number) => Math.round((after / before - 1) * 100);

/** What a weapon's area is, in its level-up card's words. */
const AREA_WORD: Readonly<Record<WeaponKind, string>> = {
  beam: 'reach',
  chain: 'reach',
  web: 'reach',
  pull: 'reach',
  gulp: 'reach',
  zone: 'reach',
  orbit: 'reach',
  spread: 'size',
  bounce: 'size',
  burst: 'size',
  arc: 'range',
  sweep: 'reach',
  lure: 'size',
  trap: 'size',
  blow: 'reach',
};

/** What a weapon's speed is, in its level-up card's words. */
const SPEED_WORD: Partial<Record<WeaponKind, string>> = {
  pull: 'pull',
  orbit: 'turning speed',
  sweep: 'knockback',
  lure: 'squeak range',
  blow: 'push',
};

/**
 * What `level` of a weapon adds to the level before it: one phrase for each stat it
 * changes, and nothing for one it does not ("+1 beam", "+40% homesickness"). Read
 * from the stats themselves, so a card and what the level does cannot disagree.
 * Level 1 (and an evolved weapon, which does not grow) adds nothing.
 */
export function levelChanges(id: WeaponId, level: number): string[] {
  const { levels, kind, unit } = WEAPONS[id];
  if (level < 2 || level > levels.length) return [];
  const before = levels[level - 2];
  const after = levels[level - 1];
  const changes: string[] = [];
  const more = (n: number, one: string) => `+${n} ${one}${n === 1 ? '' : 's'}`;
  if (after.count !== before.count) changes.push(more(after.count - before.count, unit));
  if (after.damage !== before.damage) {
    changes.push(`+${percent(after.damage, before.damage)}% homesickness`);
  }
  if (after.cooldownMs !== before.cooldownMs) {
    changes.push(`fires ${-percent(after.cooldownMs, before.cooldownMs)}% sooner`);
  }
  if (after.area !== before.area) {
    changes.push(`+${percent(after.area, before.area)}% ${AREA_WORD[kind]}`);
  }
  if (after.speed !== before.speed) {
    const word = SPEED_WORD[kind] ?? 'speed';
    changes.push(`+${percent(after.speed, before.speed)}% ${word}`);
  }
  if (after.durationMs !== before.durationMs) {
    changes.push(`lasts ${percent(after.durationMs, before.durationMs)}% longer`);
  }
  if (after.pierce !== before.pierce) {
    const n = after.pierce - before.pierce;
    changes.push(
      `${kind === 'trap' ? 'holds' : 'passes through'} ${n} more cat${n === 1 ? '' : 's'}`
    );
  }
  return changes;
}

const tenth = (n: number) => Math.round(n * 10) / 10;

/** The kinds whose count means nothing to the arena: the vacuums pull and hum as one. */
const UNCOUNTED: readonly WeaponKind[] = ['pull', 'zone', 'gulp'];

/** What Scissors adds one of, in the cards' words: "beam, treat, … or jump". */
const COUNTED = (() => {
  const units = [
    ...new Set(
      BASE_WEAPONS.filter((id) => !UNCOUNTED.includes(WEAPONS[id].kind)).map(
        (id) => WEAPONS[id].unit
      )
    ),
  ];
  return `${units.slice(0, -1).join(', ')} or ${units[units.length - 1]}`;
})();

/** Each of the passives' modifiers, as a level-up card says what one step of it adds. */
const MODIFIER_WORDS: { [K in keyof Modifiers]: (step: number) => string } = {
  speed: (step) => `+${Math.round(step * 100)}% walking speed`,
  cooldown: (step) => `weapons ready ${Math.round(-step * 100)}% sooner`,
  area: (step) => `+${Math.round(step * 100)}% weapon reach`,
  count: (step) => `+${step} ${COUNTED} for each weapon that fires them`,
  maxResolve: (step) => `+${step} Resolve`,
  recovery: (step) => `+${tenth(step)} Resolve a second`,
  pickup: (step) => `+${Math.round(step * 100)}% pickup reach`,
  might: (step) => `+${Math.round(step * 100)}% homesickness`,
  choices: (step) => `+${step} choice at every level`,
  duration: (step) => `what his weapons make lasts ${Math.round(step * 100)}% longer`,
  pierce: (step) => `+${step} cat through each shot, and in each carton`,
  grace: (step) => `untouchable ${Math.round(step)} ms longer after a hit`,
  xp: (step) => `+${Math.round(step * 100)}% experience from gems`,
  guard: (step) => `elite effects on him last ${Math.round(step * 100)}% shorter`,
};

/**
 * What `level` of a passive adds to the level before it (level 1: to having none),
 * read from `modifiers` itself. Every level of a passive adds the same.
 */
export function passiveChanges(id: PassiveId, level: number): string[] {
  if (level < 1 || level > PASSIVES[id].maxLevel) return [];
  const before = modifiers(new Map(level > 1 ? [[id, level - 1]] : []));
  const after = modifiers(new Map([[id, level]]));
  return (Object.keys(MODIFIER_WORDS) as (keyof Modifiers)[])
    .filter((key) => Math.abs(after[key] - before[key]) > 1e-9)
    .map((key) => MODIFIER_WORDS[key](after[key] - before[key]));
}

/**
 * A choice's name, its line in the game's voice, and what taking it changes (none
 * for a new weapon: its line says what it does), for the level-up dialog.
 */
export function describeChoice(choice: Choice): {
  name: string;
  description: string;
  change: string | null;
} {
  if (choice.kind === 'restore') {
    return {
      name: 'A Moment of Rest',
      description: 'Nothing more to learn. Some Resolve returns.',
      change: null,
    };
  }
  const info = choice.kind === 'weapon' ? WEAPONS[choice.id] : PASSIVES[choice.id];
  const changes =
    choice.kind === 'weapon'
      ? levelChanges(choice.id, choice.level)
      : passiveChanges(choice.id, choice.level);
  return {
    name: choice.level === 1 ? info.name : `${info.name}, level ${choice.level}`,
    description: info.description,
    change: changes.length > 0 ? `${capitalise(changes.join(', '))}.` : null,
  };
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** What a passive at `level` gives in all, read from `modifiers` (e.g. "+20% walking speed"). */
export function passiveTotal(id: PassiveId, level: number): string[] {
  if (level < 1) return [];
  const none = modifiers(new Map());
  const held = modifiers(new Map([[id, Math.min(level, PASSIVES[id].maxLevel)]]));
  return (Object.keys(MODIFIER_WORDS) as (keyof Modifiers)[])
    .filter((key) => Math.abs(held[key] - none[key]) > 1e-9)
    .map((key) => MODIFIER_WORDS[key](held[key] - none[key]));
}

/** What a Keeper carries, as the pause menu shows it. */
export type Loadout = {
  weapons: {
    id: WeaponId;
    name: string;
    level: number;
    /** An evolved weapon does not grow: its highest level is the one it has. */
    maxLevel: number;
    evolved: boolean;
    /** What the next level adds (levelChanges), or null at the top or evolved. */
    next: string | null;
  }[];
  freeWeaponSlots: number;
  passives: { id: PassiveId; name: string; level: number; maxLevel: number; gives: string }[];
  freePassiveSlots: number;
  /**
   * Each evolution he has started (holds its weapon or its passive), not yet made,
   * and still possible (a missing weapon or passive has a free slot to come into):
   * what is still missing, or, with nothing missing, `ready` for the one the next
   * chest he opens evolves (evolutionFor: the first ready, in EVOLUTIONS' order)
   * and `after` naming it for any other ready one. A secret one is never named
   * here: the codex keeps it until it is found.
   */
  evolutions: {
    from: WeaponId;
    with: PassiveId;
    to: WeaponId;
    missing: string[];
    ready: boolean;
    after: WeaponId | null;
  }[];
};

export function loadout(
  weapons: readonly { id: WeaponId; level: number }[],
  passives: readonly { id: PassiveId; level: number }[]
): Loadout {
  const weaponLevels = new Map(weapons.map((w) => [w.id, w.level] as const));
  const passiveLevels = new Map(passives.map((p) => [p.id, p.level] as const));
  const evolvedIds = new Set(EVOLUTIONS.map((e) => e.to));
  // What the next chest he opens evolves, by the chest's own rule.
  const first = evolutionFor(weaponLevels, passiveLevels);
  return {
    weapons: weapons.map(({ id, level }) => {
      const evolved = evolvedIds.has(id);
      const maxLevel = evolved ? level : MAX_WEAPON_LEVEL;
      const changes = evolved || level >= maxLevel ? [] : levelChanges(id, level + 1);
      return {
        id,
        name: WEAPONS[id].name,
        level,
        maxLevel,
        evolved,
        next: changes.length > 0 ? `${capitalise(changes.join(', '))}.` : null,
      };
    }),
    freeWeaponSlots: Math.max(WEAPON_SLOTS - weapons.length, 0),
    passives: passives.map(({ id, level }) => ({
      id,
      name: PASSIVES[id].name,
      level,
      maxLevel: PASSIVES[id].maxLevel,
      gives: `${capitalise(passiveTotal(id, level).join(', '))}.`,
    })),
    freePassiveSlots: Math.max(PASSIVE_SLOTS - passives.length, 0),
    evolutions: EVOLUTIONS.filter(
      (e) =>
        !e.secret &&
        !weaponLevels.has(e.to) &&
        (weaponLevels.has(e.from) || passiveLevels.has(e.with)) &&
        // A piece he lacks must have a slot to come into, or it is out of reach.
        (weaponLevels.has(e.from) || weapons.length < WEAPON_SLOTS) &&
        (passiveLevels.has(e.with) || passives.length < PASSIVE_SLOTS)
    ).map((e) => {
      const level = weaponLevels.get(e.from);
      const missing: string[] = [];
      if (level === undefined) missing.push(`the ${WEAPONS[e.from].name}`);
      else if (level < MAX_WEAPON_LEVEL) {
        missing.push(`the ${WEAPONS[e.from].name} at level ${MAX_WEAPON_LEVEL} (now ${level})`);
      }
      if (!passiveLevels.has(e.with)) missing.push(`the ${PASSIVES[e.with].name}`);
      const done = missing.length === 0;
      return {
        from: e.from,
        with: e.with,
        to: e.to,
        missing,
        ready: done && first?.to === e.to,
        after: done && first && first.to !== e.to ? first.to : null,
      };
    }),
  };
}

/** An evolution, announced with due gravity. */
export function evolutionText(from: WeaponId, to: WeaponId): string {
  return `${the(WEAPONS[from].name, 'The')} is no more. In its place: ${the(WEAPONS[to].name, 'the')}.`;
}

/** A name with its article ("the Yarn Ball"), unless it brings its own ("The Matriarch"). */
const the = (name: string, article: 'The' | 'the') =>
  /^The /.test(name) ? name : `${article} ${name}`;
