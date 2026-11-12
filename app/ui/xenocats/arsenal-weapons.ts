// Survival's arsenal (arsenal.ts): the weapons, their kinds, levels and stats, as a
// table. Split out of arsenal.ts, which re-exports all of it, so a module may
// import it from either.

export const MAX_WEAPON_LEVEL = 8;
export const MAX_PASSIVE_LEVEL = 5;
/** The slots of a five-minute run (the game's own); a longer run has more (Slots). */
export const WEAPON_SLOTS = 6;
export const PASSIVE_SLOTS = 6;

/** How many weapons and passives he can hold at once (Infinity: no limit). */
export type Slots = { weapons: number; passives: number };

export const DEFAULT_SLOTS: Slots = { weapons: WEAPON_SLOTS, passives: PASSIVE_SLOTS };

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
  | 'tennis-ball'
  | 'frying-pan'
  | 'static-sock'
  | 'cucumber'
  | 'ceiling-fan'
  | 'alarm-clock'
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
  | 'jacuzzi'
  | 'serve-machine'
  | 'cast-iron-skillet'
  | 'static-storm'
  | 'pickle-jar'
  | 'heatwave-fan'
  | 'grandfather-clock'
  | 'laser-light-show'
  | 'lucky-furball'
  | 'roaring-upright'
  // Fused: two evolved weapons made one at a chest (FUSIONS); never offered.
  | 'thunderstorm'
  | 'scorching-maw'
  | 'yarn-feast'
  | 'milk-symphony'
  | 'grand-slam'
  | 'kitchen-sink'
  | 'clockwork-gale'
  | 'peacock-prism'
  | 'bubble-bath'
  | 'fort-hoover';

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
  | 'tin-foil'
  | 'tape-measure'
  | 'oven-mitts'
  | 'reading-glasses'
  | 'cookie-jar'
  | 'hot-water-bottle'
  | 'loaded-dice';

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
  | 'blow'
  /** Balls served at the nearest cat that turn at the end of their flight and come back to him. */
  | 'boomerang'
  /** A swing at the nearest cats: each is sent flying, and bowls over the cats it lands among. */
  | 'swat'
  /** A sock that clings to a cat and walks with it, sparking to the cats near it as it goes. */
  | 'cling'
  /** Thrown at the nearest cat: where it lands, the cats round it are startled and run away. */
  | 'scare'
  /** Two evolved weapons in one: both fire, and something of its own besides. */
  | 'fused';

export type WeaponInfo = {
  name: string;
  /** In the game's voice. */
  description: string;
  kind: WeaponKind;
  /** What its count counts, one of them ("beam"): the level-up cards' word. */
  unit: string;
  levels: readonly WeaponStats[];
};

/**
 * The stats of a fused weapon are its own extra, not its parents' (they keep firing
 * as they did): every `cooldownMs`, `count` of its own things of `damage`.
 */
type FusedId =
  | 'thunderstorm'
  | 'scorching-maw'
  | 'yarn-feast'
  | 'milk-symphony'
  | 'grand-slam'
  | 'kitchen-sink'
  | 'clockwork-gale'
  | 'peacock-prism'
  | 'bubble-bath'
  | 'fort-hoover';

const FUSED_WEAPONS: Readonly<Record<FusedId, WeaponInfo>> = {
  thunderstorm: {
    name: 'Thunderstorm',
    description: 'The laser web and the monsoon, together. Lightning finds the wet cats first.',
    kind: 'fused',
    unit: 'strike',
    levels: fixed({
      cooldownMs: 2000,
      damage: 120,
      area: 450,
      count: 6,
      speed: 0,
      durationMs: 180,
      pierce: 99,
    }),
  },
  'scorching-maw': {
    name: 'Scorching Maw',
    description:
      'It draws in every cat for a long way, hot air at its back. Whatever it draws in is scorched.',
    kind: 'fused',
    unit: 'scorch',
    levels: fixed({
      cooldownMs: 4000,
      damage: 0,
      area: 560,
      count: 1,
      speed: 0,
      // How long a scorched cat stays so, ms.
      durationMs: 3000,
      pierce: 99,
    }),
  },
  'yarn-feast': {
    name: 'Yarn Feast',
    description:
      'Yarn that tangles, treats that chase. Now and then the whole table goes after the cats.',
    kind: 'fused',
    unit: 'crumb',
    levels: fixed({
      cooldownMs: 3000,
      damage: 300,
      area: 16,
      count: 24,
      speed: 380,
      durationMs: 900,
      pierce: 2,
    }),
  },
  'milk-symphony': {
    name: 'Milk Symphony',
    description:
      'Saucers that circle, toys that squeak. Every toy in earshot spills a little milk on the cats.',
    kind: 'fused',
    unit: 'wave',
    levels: fixed({
      cooldownMs: 3000,
      damage: 90,
      area: 16,
      count: 6,
      speed: 380,
      durationMs: 800,
      pierce: 6,
    }),
  },
  'grand-slam': {
    name: 'Grand Slam',
    description:
      'Every ball served with a charge in it. Now and then the whole court lights up, cat to cat.',
    kind: 'fused',
    unit: 'strike',
    levels: fixed({
      cooldownMs: 1800,
      damage: 140,
      area: 480,
      count: 8,
      speed: 0,
      durationMs: 200,
      pierce: 99,
    }),
  },
  'kitchen-sink': {
    name: 'Kitchen Sink',
    description:
      'Everything but, and then that too. The skillet swings; the pickles fly out all round him.',
    kind: 'fused',
    unit: 'slice',
    levels: fixed({
      cooldownMs: 2400,
      damage: 220,
      area: 18,
      count: 20,
      speed: 420,
      durationMs: 900,
      pierce: 4,
    }),
  },
  'clockwork-gale': {
    name: 'Clockwork Gale',
    description:
      'The fan, the clock, and a moment that will not pass. Now and then every cat near him stops still.',
    kind: 'fused',
    unit: 'stop',
    levels: fixed({
      cooldownMs: 5000,
      damage: 80,
      area: 420,
      count: 1,
      speed: 0,
      // How long the cats stand still, ms.
      durationMs: 1800,
      pierce: 99,
    }),
  },
  'peacock-prism': {
    name: 'Peacock Prism',
    description:
      'Feathers that catch the light, and a light that will not stay still. Now and then it shines out every way at once.',
    kind: 'fused',
    unit: 'ray',
    levels: fixed({
      cooldownMs: 1800,
      damage: 110,
      // How far the rays reach, px.
      area: 520,
      count: 12,
      speed: 0,
      durationMs: 200,
      pierce: 99,
    }),
  },
  'bubble-bath': {
    name: 'Bubble Bath',
    description:
      'Bubbles everywhere, and the bath overflows. Now and then a ring of bubbles, and a puddle round his feet.',
    kind: 'fused',
    unit: 'bubble',
    levels: fixed({
      cooldownMs: 2600,
      damage: 80,
      area: 20,
      count: 16,
      speed: 330,
      durationMs: 1300,
      pierce: 3,
    }),
  },
  'fort-hoover': {
    name: 'Fort Hoover',
    description:
      'A castle with a vacuum in its keep. Now and then the nearest cats are boxed where they stand.',
    kind: 'fused',
    unit: 'box',
    levels: fixed({
      cooldownMs: 3000,
      damage: 70,
      // A box's size, px; it reaches for cats this far, px (speed).
      area: 70,
      count: 5,
      speed: 420,
      durationMs: 3500,
      // Cats a box takes.
      pierce: 8,
    }),
  },
};

export const WEAPONS: Readonly<Record<WeaponId, WeaponInfo>> = {
  ...FUSED_WEAPONS,
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
  'tennis-ball': {
    name: 'Tennis Ball',
    description:
      'Served hard at the nearest cat, straight through it, and back again. It always comes back.',
    kind: 'boomerang',
    unit: 'ball',
    levels: ladder(
      // Out for half its time, then home to his hand: pierce is the cats it passes each way.
      { cooldownMs: 1700, damage: 24, area: 11, count: 1, speed: 560, durationMs: 1200, pierce: 4 },
      [
        { count: 1 },
        { damage: 8, pierce: 1 },
        { cooldownMs: -300 },
        { count: 1, speed: 80 },
        { damage: 8, pierce: 2 },
        { cooldownMs: -300, area: 3 },
        { count: 1, damage: 8, pierce: 2 },
      ]
    ),
  },
  'frying-pan': {
    name: 'Frying Pan',
    description:
      'A short swing, and a ringing sound. The cat it meets flies, and lands on its friends.',
    kind: 'swat',
    unit: 'swing',
    levels: ladder(
      // Count is the swings, a cat each; speed is how far one flies, px, over durationMs.
      {
        cooldownMs: 1800,
        damage: 30,
        area: 110,
        count: 1,
        speed: 140,
        durationMs: 200,
        pierce: 99,
      },
      [
        { damage: 10 },
        { count: 1 },
        { cooldownMs: -300 },
        { area: 25, speed: 30 },
        { damage: 10 },
        { count: 1, cooldownMs: -200 },
        { damage: 12, area: 25 },
      ]
    ),
  },
  'static-sock': {
    name: 'Static Sock',
    description:
      'Rubbed on the carpet until it crackles, then thrown. It clings to a cat, and sparks at its friends.',
    kind: 'cling',
    unit: 'spark',
    levels: ladder(
      // Count is the sparks a sock gives before it falls off; area how far one leaps;
      // durationMs how long a spark shows.
      { cooldownMs: 1400, damage: 14, area: 170, count: 4, speed: 0, durationMs: 160, pierce: 99 },
      [
        { count: 2 },
        { damage: 5 },
        { cooldownMs: -250 },
        { count: 2, area: 30 },
        { damage: 5 },
        { cooldownMs: -250, count: 1 },
        { count: 2, damage: 6, area: 30 },
      ]
    ),
  },
  cucumber: {
    name: 'Cucumber',
    description:
      'No cat has ever trusted one. Thrown among them, it bursts into slices, and every cat near it runs.',
    kind: 'scare',
    unit: 'slice',
    levels: ladder(
      // Count is the slices it bursts into, as a hairball; durationMs how long the cats it
      // startles run, ms (and its flight).
      { cooldownMs: 2400, damage: 26, area: 15, count: 5, speed: 300, durationMs: 1000, pierce: 1 },
      [
        { count: 1 },
        { damage: 8 },
        { cooldownMs: -400 },
        { count: 2, area: 3 },
        { damage: 8, speed: 60 },
        { cooldownMs: -400, durationMs: 200 },
        { count: 2, damage: 10, area: 3 },
      ]
    ),
  },
  'ceiling-fan': {
    name: 'Ceiling Fan',
    description: 'Wide blades that turn slowly round him. No cat walks under one willingly.',
    kind: 'orbit',
    unit: 'blade',
    levels: ladder(
      // Damage a second, to every cat a blade passes through; speed is its turn, rad/s.
      { cooldownMs: 0, damage: 45, area: 85, count: 2, speed: 1.8, durationMs: 0, pierce: 99 },
      [
        { damage: 15 },
        { count: 1 },
        { area: 15 },
        { speed: 0.5, damage: 10 },
        { count: 1 },
        { area: 15, damage: 15 },
        { count: 1, speed: 0.5 },
      ]
    ),
  },
  'alarm-clock': {
    name: 'Alarm Clock',
    description: 'It rings, and rings, and does not stop. Every cat near him wishes it would.',
    kind: 'zone',
    unit: 'ring',
    levels: ladder(
      // Damage a second, to every cat in reach.
      { cooldownMs: 0, damage: 7, area: 150, count: 1, speed: 0, durationMs: 0, pierce: 99 },
      [
        { damage: 3 },
        { area: 25 },
        { damage: 3 },
        { area: 25 },
        { damage: 4 },
        { area: 25 },
        { damage: 5, area: 25 },
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
    description:
      'The yarn splits each time it bounces, and tangles every cat it passes. Nobody will wind it up again.',
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
    description:
      'Treats in every direction at once, and the crumbs go looking for seconds. Every cat is invited.',
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
    description:
      'The bottle, but the sky. A wall of water the way he faces, and it leaves puddles behind.',
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
    description: 'Warm milk, circling him without end, and spilling. No cat has ever refused it.',
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
      speed: 40,
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
  'serve-machine': {
    name: 'Serve Machine',
    description: 'It never tires, and it never misses. A volley of balls, through everything.',
    kind: 'spread',
    unit: 'ball',
    levels: fixed({
      cooldownMs: 700,
      damage: 60,
      area: 15,
      count: 7,
      speed: 760,
      durationMs: 1400,
      pierce: 14,
    }),
  },
  'cast-iron-skillet': {
    name: 'Cast-Iron Skillet',
    description: 'Heavy, and hot. A swing all the way round him, and every cat it rings is dazed.',
    kind: 'sweep',
    unit: 'swing',
    levels: fixed({
      cooldownMs: 900,
      damage: 120,
      area: 190,
      // Four sectors: all the way round him.
      count: 4,
      speed: 220,
      // How long a cat it rings stands dazed, ms.
      durationMs: 1200,
      pierce: 99,
    }),
  },
  'static-storm': {
    name: 'Static Storm',
    description: 'The whole house crackles. Sparks leap from cat to cat and never seem to land.',
    kind: 'chain',
    unit: 'jump',
    levels: fixed({
      cooldownMs: 450,
      damage: 36,
      area: 260,
      count: 18,
      speed: 0,
      durationMs: 200,
      pierce: 99,
    }),
  },
  'pickle-jar': {
    name: 'Pickle Jar',
    description: 'A whole jar of them, thrown. Brine everywhere, and the cats cannot stand it.',
    kind: 'burst',
    unit: 'slice',
    levels: fixed({
      cooldownMs: 1300,
      damage: 70,
      area: 22,
      count: 14,
      speed: 340,
      durationMs: 1200,
      pierce: 2,
    }),
  },
  'heatwave-fan': {
    name: 'Heatwave Fan',
    description:
      'The fan, blowing hot. A cat its blades touch is scorched, and takes more from everything.',
    kind: 'orbit',
    unit: 'blade',
    levels: fixed({
      cooldownMs: 0,
      damage: 130,
      area: 125,
      count: 6,
      speed: 2.8,
      durationMs: 0,
      pierce: 99,
    }),
  },
  'laser-light-show': {
    name: 'Laser Light Show',
    description:
      'The red dot puts on a show. It leaps further and more often, and the cats cannot look away.',
    kind: 'chain',
    unit: 'jump',
    levels: fixed({
      cooldownMs: 700,
      damage: 48,
      area: 320,
      count: 12,
      speed: 0,
      durationMs: 220,
      pierce: 99,
    }),
  },
  'lucky-furball': {
    name: 'Lucky Furball',
    description: 'Coughed up for luck, and it brings some. It bursts wider, into bigger pieces.',
    kind: 'burst',
    unit: 'piece',
    levels: fixed({
      cooldownMs: 1100,
      damage: 55,
      area: 20,
      count: 12,
      speed: 380,
      durationMs: 1100,
      pierce: 2,
    }),
  },
  'roaring-upright': {
    name: 'Roaring Upright',
    description:
      'The vacuum at full roar, squeaking as it goes. Every cat near him wishes it were anywhere else.',
    kind: 'zone',
    unit: 'zone',
    levels: fixed({
      cooldownMs: 0,
      damage: 45,
      area: 250,
      count: 1,
      speed: 0,
      durationMs: 0,
      pierce: 99,
    }),
  },
  'grandfather-clock': {
    name: 'Grandfather Clock',
    description: 'Every chime is a minute long. Cats near him slow to a crawl, and grow homesick.',
    kind: 'zone',
    unit: 'ring',
    levels: fixed({
      cooldownMs: 0,
      damage: 30,
      area: 280,
      count: 1,
      speed: 0,
      durationMs: 0,
      pierce: 99,
    }),
  },
};

/**
 * A weapon at its highest level and its passive, held together, become another. A
 * secret one is named nowhere in the game until it has been found (the codex).
 */
