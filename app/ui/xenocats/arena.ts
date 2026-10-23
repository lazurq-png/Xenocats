// Survival, the arena (/cats/survival): a time-survival game in the manner of
// Vampire Survivors, as a pure simulation. Time, input and the random source are
// passed in, it advances in fixed steps, and nothing here touches the DOM, so a
// seeded run plays out the same every time and is tested in Node. arena-view.tsx
// draws it.
//
// The hero (a Keeper; two in local co-op, each a Keeper record of his own) walks
// an endless arena; the cats of the twenty xenocat types and the varieties
// (varieties.ts) pour in from just off screen on every side and walk at the
// nearest. Attacks are automatic: positioning is the skill. His weapons (arsenal.ts)
// fire on their own, starting with his character's (progression.ts); every cat
// they touch grows homesick, and enough Homesickness and a cat is beamed home.
// Nothing is ever killed. A cat sent home leaves an experience gem; gathered gems
// bring levels (shared in co-op), and each level pauses the run for a choice (each
// player in turn): a new weapon, a better one, or a passive. A cat that reaches him
// drains his Resolve (each type its own amount), and he is untouchable for a moment
// after. A few cats are elites, and also lay their xenocat effect on him (Cryo
// freezes him, Gravi slows him, Mirror turns his controls round...), one effect at
// a time. Cats keep coming, more and more, until the frame rate says no more
// (frame-guard.ts). The run ends when no Keeper stands (in co-op one is down until
// the other has lasted long enough), when he gives up, or at the time goal, when
// the Matriarch comes and nothing sends her home.

import {
  BASE_WEAPONS,
  type Choice,
  DEFAULT_SLOTS,
  type Slots,
  MAX_WEAPON_LEVEL,
  type Modifiers,
  type PassiveId,
  WEAPONS,
  type WeaponId,
  type WeaponKind,
  type WeaponStats,
  FUSIONS,
  evolutionFor,
  fusionFor,
  modifiers,
  offerChoices,
  upgradesLeft,
  PASSIVES,
  weaponStats,
  xpToNext,
} from './arsenal';
import {
  type AttackShape,
  MEGA_SHAPE,
  type MegaPattern,
  burstAngles,
  matriarchPatternAt,
  megaPatternAt,
  steer,
} from './cat-attacks';
import type { CatType } from './cat-types';
import { type Vec } from './effects';
import { createArenaGrid } from './arena-grid';
import { SCHEDULE, type Schedule, VARIETIES, type VarietyId, arrivalsAt } from './varieties';
import type { Random } from './random';

export type ArenaConfig = {
  /** One step of the simulation, ms. */
  stepMs: number;
  /** The run's time goal, ms: then the Matriarch comes. */
  timeGoalMs: number;
  /**
   * A run longer than five minutes keeps its crowd at the peak, and the cats that
   * arrive after `fromMs` are tougher: each minute past it adds this share of their
   * Homesickness limit and of their speed (the speed up to `maxSpeedFactor` times).
   */
  toughness: {
    fromMs: number;
    homesicknessPerMin: number;
    speedPerMin: number;
    maxSpeedFactor: number;
    /**
     * An endless run never stops growing, so no Keeper outlasts it for ever. From
     * `fromMs`, each minute compounds what a touch (or a shot) takes from his Resolve
     * by `drainPerMin`, whenever the cat arrived; and the speed has no cap, cats that
     * arrive later gaining `speedPerMin` a minute instead, until they outrun him.
     */
    endless: { fromMs: number; drainPerMin: number; speedPerMin: number };
  };
  hero: {
    /** px/s. */
    speed: number;
    /** His Resolve when the run begins. */
    resolve: number;
    /** After a cat reaches him he cannot be reached again for this long, ms. */
    untouchableMs: number;
    /** A cat reaches him when their centres come this close, px. */
    reach: number;
  };
  cats: {
    /** px/s, slowest and fastest, by type. */
    speed: readonly [number, number];
    /** Homesickness a cat can take before it goes home, by type. */
    homesickness: readonly [number, number];
    /** Resolve a cat drains on reaching the hero, by type. */
    drain: readonly [number, number];
    /** The share of cats that are elites (their xenocat effect lands on the hero). */
    eliteShare: number;
    /** An elite's effect on the hero lasts at most this long, ms. */
    effectMaxMs: number;
    /** Cats appear this far beyond the edge of the screen, px. */
    spawnMargin: number;
    /** Never more cats than this, whatever the frame rate allows. */
    hardCap: number;
    /**
     * Up to this many, cats come whatever the frame-rate guard says: it only holds
     * back the growth beyond, so a slow screen still gets a game.
     */
    guardFree: number;
    /** A cat is touched by what comes within this of its centre (plus its size), px. */
    radius: number;
  };
  /**
   * How many cats the arena aims to hold, by the time into the run: points of
   * [ms, cats], straight lines between them, the last held after.
   */
  escalation: readonly (readonly [number, number])[];
  /** At most this many cats arrive a second, as a share of those still missing. */
  arrivalShare: number;
  /** What he starts with, and when those first fire, ms. */
  startingWeapons: readonly WeaponId[];
  firstShotMs: number;
  /** The level they start at (a test's way to try a weapon at its best). */
  startingLevel: number;
  /** Passives he starts with, at level 1. */
  startingPassives: readonly PassiveId[];
  gems: {
    /** Gems this near (times Long Whiskers) fly to him, px. */
    pickup: number;
    /** How fast, px/s. */
    speed: number;
    /** Experience a gem from a plain cat, and from an elite. */
    value: number;
    eliteValue: number;
    /** Beyond this many gems lying about, a new one adds to an old one. */
    cap: number;
    /** A gem dropped this near another joins it: one bigger gem, px. */
    merge: number;
  };
  matriarch: {
    /** px/s: faster than the hero. */
    speed: number;
    reach: number;
  };
  /**
   * An elite xenocat near a Keeper winds up an attack (shaped by its effect), standing
   * still and warning where it will go, then lets it loose: a burst of shots on every
   * side, one at where he stood; a slow shot that follows him; or a dash, the elite
   * itself charging at him and turning after him as it goes. None stays where it was
   * aimed, so stepping out of the warning is not enough: he must get out of its way.
   * What reaches him drains his Resolve and lays the elite's effect on him. Then it
   * rests for `cooldownMs`.
   */
  eliteAttack: {
    /** A bolt or a dash begins within this of a Keeper, px (well inside the smallest screen). */
    range: number;
    /** A burst begins within this, px. */
    burstRange: number;
    windUpMs: number;
    cooldownMs: number;
    /** A burst's shots: how many, px/s, their size, how long they fly, ms. */
    burst: { shots: number; speed: number; radius: number; lifeMs: number };
    /** A bolt: px/s, its size, how long it flies and follows him, ms, and how fast it turns, rad/s. */
    bolt: { speed: number; radius: number; lifeMs: number; homingMs: number; turn: number };
    /** A dash: px/s, how long, ms, how fast it turns after him, rad/s; its lane's width as warned, px. */
    dash: { speed: number; ms: number; turn: number; width: number };
  };
  /**
   * The bosses attack too, each warned and wound up, standing still. The Mega Cat goes
   * round three: it pounces where the Keeper stood (landing on that spot), charges
   * along a lane through it (straight on, as wide as itself), and looses a volley of
   * shots on every side. The Matriarch calls a ring of kittens round where he stood
   * and, the next time, looses a volley of her own.
   */
  bossAttack: {
    pounce: {
      /** It begins within this of a Keeper (and not already on him), px. */
      range: number;
      windUpMs: number;
      /** Its rest after each of its attacks, whichever, ms. */
      cooldownMs: number;
      /** What it lands on, px, round where he was. */
      radius: number;
    };
    charge: {
      /** It begins within this of a Keeper, px. */
      range: number;
      windUpMs: number;
      /** px/s, and for how long, ms. */
      speed: number;
      ms: number;
    };
    volley: {
      /** It begins within this of a Keeper, px. */
      range: number;
      windUpMs: number;
      /** How many shots, px/s, their size, how long they fly, ms. */
      shots: number;
      speed: number;
      radius: number;
      lifeMs: number;
    };
    summon: {
      /** The Matriarch's first call, and then one this often, ms after she comes. */
      firstMs: number;
      everyMs: number;
      windUpMs: number;
      /** The ring of kittens is this wide, round where he was, px; this many. */
      ringRadius: number;
      kittens: number;
      /** She calls only from this far off, px: not once she is on him. */
      minDistance: number;
    };
  };
  /**
   * Pickups a cat sent home may leave (arena.ts, pickupFor): the share of cats that do;
   * how long one lies, ms; at most so many lie; a fish restores this share of his
   * Resolve; a magnet draws every gem in for `magnetMs`; a bell stops the cats on
   * screen for `bellMs`.
   */
  pickups: {
    chance: number;
    lifeMs: number;
    cap: number;
    fishShare: number;
    magnetMs: number;
    bellMs: number;
  };
  /** Chests lying on the Keepers' start (a test's way to reach a chest at once). */
  startingChests: number;
  /** Golden chests lying on the Keepers' start (the same, for a boss's chest). */
  startingGoldenChests: number;
  /**
   * A boss sent home: the mothership takes it, and a ring of light spreads from where it
   * stood, sending home every cat it reaches but another boss; it scatters `loot` gems,
   * each `lootValue` times a plain cat's, round the spot, and leaves a golden chest. The chest holds 1, 3 or 5
   * rewards (each an evolution, a fusion, or a level-up), by `weights`.
   */
  bossHome: {
    ringMs: number;
    ringRadius: number;
    loot: number;
    lootValue: number;
    rewards: readonly number[];
    weights: readonly number[];
  };
  /** Which cats come when (varieties.ts). */
  schedule: Schedule;
  laserCat: {
    /** It stops this far from him, px, and fires from there. */
    range: number;
    everyMs: number;
    /** Its shots: px/s, and their size, px. */
    shotSpeed: number;
    shotRadius: number;
  };
  /** He picks a chest up within this, px. */
  chestReach: number;
  /** The base weapons a level-up may offer (the progression keeps some back). */
  availableWeapons: readonly WeaponId[];
  /** How many weapons and passives each Keeper can hold: more in a longer run. */
  slots: Slots;
  /**
   * What the run brings from before (the Tailor's work, progression.ts): multipliers on
   * the passives' modifiers of the same names, Resolve a second and level-up choices
   * added, more passive slots, revivals, and more rerolls and skips.
   */
  boost: {
    might: number;
    pickup: number;
    drain: number;
    cooldown: number;
    area: number;
    duration: number;
    xp: number;
    luck: number;
    recovery: number;
    choices: number;
    passiveSlots: number;
    revivals: number;
    rerolls: number;
    skips: number;
  };
  /**
   * At a level-up a Keeper may ask for new choices (a reroll) or take a little experience
   * and no choice (a skip): so many of each a run, and a skip is worth this share of the
   * experience the next level needs.
   */
  levelUp: { rerolls: number; skips: number; skipXpShare: number };
  /**
   * The secret cat, named nowhere until it is found: once a run, from `afterMs` into it, when he has
   * stood still for `stillMs`, it comes and sits by him.
   */
  secretCat: { afterMs: number; stillMs: number };
  /** A second Keeper (local co-op), with his own weapons, pace and Resolve; or null. */
  secondPlayer: {
    startingWeapons: readonly WeaponId[];
    speed: number;
    resolve: number;
    /** Passives he starts with, at level 1 (a test's way to set up an evolution). */
    startingPassives?: readonly PassiveId[];
  } | null;
  coop: {
    /** The two start this far apart, px. */
    startGap: number;
    /** The shared camera zooms out to keep both in view, up to this (2 = twice as much). */
    maxZoomOut: number;
    /** Kept this far inside the screen's edges at the widest, px; beyond, one cannot walk on. */
    margin: number;
    /** A downed Keeper stands again if the other lasts this long, ms. */
    reviveMs: number;
  };
  /**
   * A small screen sees no less of the arena: the camera shows at least `minView`
   * arena px across the screen's narrower side, zooming out up to `maxZoom` (so
   * the Keeper and the cats stay big enough to read). A larger screen is unzoomed.
   */
  view: { minView: number; maxZoom: number };
  /** The spatial grid's cell, px. */
  cellSize: number;
};

export const ARENA_CONFIG: ArenaConfig = {
  stepMs: 1000 / 60,
  timeGoalMs: 5 * 60_000,
  toughness: {
    fromMs: 5 * 60_000,
    homesicknessPerMin: 0.3,
    speedPerMin: 0.03,
    maxSpeedFactor: 1.45,
    // An endless run is meant to be over by about 20:00, however well he is armed: cats
    // ×1.1 quick at 8:00 reach ×2 by 16:00 and ×2.5 by 20:00, where the hissing outrun
    // his 210 px/s; a touch takes six times as much by 16:00, fifteen times by 20:00.
    endless: { fromMs: 8 * 60_000, drainPerMin: 0.25, speedPerMin: 0.12 },
  },
  hero: { speed: 210, resolve: 100, untouchableMs: 700, reach: 30 },
  cats: {
    speed: [45, 95],
    homesickness: [16, 34],
    drain: [4, 11],
    // About a third of what it was (0.4): an elite is an event, and it now attacks.
    eliteShare: 0.13,
    effectMaxMs: 2500,
    spawnMargin: 60,
    hardCap: 6000,
    guardFree: 40,
    radius: 16,
  },
  // A few cats in the first half minute, dozens by one minute, hundreds by two and
  // a half, and from four minutes as many as the frame rate allows.
  escalation: [
    [0, 3],
    [30_000, 8],
    [60_000, 45],
    [150_000, 320],
    [240_000, 2500],
    [300_000, 6000],
  ],
  arrivalShare: 0.5,
  startingWeapons: ['laser-pointer'],
  firstShotMs: 550,
  startingLevel: 1,
  startingPassives: [],
  gems: { pickup: 100, speed: 520, value: 1, eliteValue: 6, cap: 1500, merge: 32 },
  matriarch: { speed: 330, reach: 70 },
  eliteAttack: {
    range: 300,
    burstRange: 220,
    windUpMs: 900,
    cooldownMs: 3500,
    // Slower than he walks: a step aside, between two shots, is enough.
    burst: { shots: 8, speed: 170, radius: 9, lifeMs: 3000 },
    // A little quicker than he walks, but it turns slowly: a late step aside, not a run.
    bolt: { speed: 230, radius: 11, lifeMs: 3500, homingMs: 2500, turn: 1.6 },
    dash: { speed: 560, ms: 750, turn: 2.4, width: 40 },
  },
  bossAttack: {
    pounce: { range: 420, windUpMs: 1100, cooldownMs: 6000, radius: 120 },
    charge: { range: 520, windUpMs: 1000, speed: 760, ms: 800 },
    volley: { range: 600, windUpMs: 1200, shots: 16, speed: 190, radius: 13, lifeMs: 4000 },
    summon: {
      firstMs: 3000,
      everyMs: 8000,
      windUpMs: 1300,
      ringRadius: 150,
      kittens: 10,
      minDistance: 260,
    },
  },
  pickups: {
    chance: 0.002,
    lifeMs: 15_000,
    cap: 24,
    fishShare: 0.25,
    magnetMs: 2000,
    bellMs: 2000,
  },
  startingChests: 0,
  startingGoldenChests: 0,
  bossHome: {
    ringMs: 900,
    ringRadius: 560,
    loot: 12,
    lootValue: 3,
    rewards: [1, 3, 5],
    weights: [0.5, 0.35, 0.15],
  },
  schedule: SCHEDULE,
  laserCat: { range: 280, everyMs: 2500, shotSpeed: 420, shotRadius: 8 },
  chestReach: 36,
  availableWeapons: BASE_WEAPONS,
  slots: DEFAULT_SLOTS,
  boost: {
    might: 1,
    pickup: 1,
    drain: 1,
    cooldown: 1,
    area: 1,
    duration: 1,
    xp: 1,
    luck: 1,
    recovery: 0,
    choices: 0,
    passiveSlots: 0,
    revivals: 0,
    rerolls: 0,
    skips: 0,
  },
  levelUp: { rerolls: 1, skips: 1, skipXpShare: 0.3 },
  secretCat: { afterMs: 60_000, stillMs: 20_000 },
  secondPlayer: null,
  coop: { startGap: 80, maxZoomOut: 1.6, margin: 80, reviveMs: 30_000 },
  // The view is the browser window, not the screen: a 1366 × 768 laptop's window is
  // about 650 px tall. So a phone sees about as much as the smallest common laptop
  // window, and every desktop window from there up is unzoomed: a
  // 390 px phone zooms out 1.64, a 360 px one 1.78; nothing beyond 1.8.
  view: { minView: 640, maxZoom: 1.8 },
  cellSize: 64,
};

/** The weapons and passives a run of each length lets him hold. */
export const SLOTS_BY_LENGTH: Readonly<Record<number, Slots>> = {
  5: DEFAULT_SLOTS,
  10: { weapons: 8, passives: 8 },
  15: { weapons: 10, passives: 10 },
};

/** An endless run (minutes 0) has no time goal and no limit on slots. */
export const ENDLESS_SLOTS: Slots = { weapons: Infinity, passives: Infinity };

/** How long an endless run's schedule of Mega Cats reaches, ms: far past any run. */
const ENDLESS_SCHEDULE_MS = 24 * 3_600_000;

/**
 * What a run of `minutes` changes in the config: its time goal (when the Matriarch
 * comes), a Mega Cat every two minutes before it, and the slots it has. Five minutes
 * is the config as it is. Minutes 0 is an endless run: the Matriarch never comes,
 * the Mega Cats keep coming, the cats keep toughening, and he can hold any number of
 * weapons and passives.
 */
export function runLengthConfig(minutes: number): Partial<ArenaConfig> {
  const endless = minutes === 0;
  const goal = endless ? Infinity : minutes * 60_000;
  const bosses: number[] = [];
  const last = endless ? ENDLESS_SCHEDULE_MS : goal;
  for (let at = 120_000; at < last; at += 120_000) bosses.push(at);
  return {
    timeGoalMs: goal,
    schedule: { ...SCHEDULE, bosses },
    slots: endless ? ENDLESS_SLOTS : (SLOTS_BY_LENGTH[minutes] ?? DEFAULT_SLOTS),
  };
}

/** How many cats the arena aims to hold `ms` into the run. */
export function catsWanted(ms: number, escalation = ARENA_CONFIG.escalation): number {
  if (ms <= escalation[0][0]) return escalation[0][1];
  for (let i = 1; i < escalation.length; i++) {
    const [t1, n1] = escalation[i];
    if (ms <= t1) {
      const [t0, n0] = escalation[i - 1];
      return Math.round(n0 + ((n1 - n0) * (ms - t0)) / (t1 - t0));
    }
  }
  return escalation[escalation.length - 1][1];
}

/** What an elite's xenocat effect does to the hero. */
export type HeroEffect =
  | { kind: 'freeze' }
  | { kind: 'slow'; factor: number }
  | { kind: 'reverse' }
  | { kind: 'axis'; horizontal: boolean }
  | { kind: 'push'; way: 'away' | 'toward' | 'down' | 'fixed'; speed: number }
  | { kind: 'jump'; distance: number }
  | { kind: 'jitter'; px: number }
  | { kind: 'veil' };

/** Each xenocat effect, by id, as it lands on the hero; what is only seen is a veil. */
export const HERO_EFFECTS: Readonly<Record<string, HeroEffect>> = {
  freeze: { kind: 'freeze' },
  heavy: { kind: 'slow', factor: 0.35 },
  giant: { kind: 'slow', factor: 0.6 },
  delay: { kind: 'slow', factor: 0.5 },
  reverse: { kind: 'reverse' },
  'axis-lock': { kind: 'axis', horizontal: true },
  knockback: { kind: 'push', way: 'away', speed: 420 },
  bounce: { kind: 'push', way: 'away', speed: 300 },
  magnet: { kind: 'push', way: 'toward', speed: 160 },
  orbit: { kind: 'push', way: 'toward', speed: 110 },
  spiral: { kind: 'push', way: 'toward', speed: 130 },
  fall: { kind: 'push', way: 'down', speed: 160 },
  drift: { kind: 'push', way: 'fixed', speed: 120 },
  drunk: { kind: 'push', way: 'fixed', speed: 90 },
  teleport: { kind: 'jump', distance: 220 },
  jitter: { kind: 'jitter', px: 6 },
  vanish: { kind: 'veil' },
  blur: { kind: 'veil' },
  decoys: { kind: 'veil' },
  tiny: { kind: 'veil' },
};

export type { AttackShape, MegaPattern };

/** The attack an elite's effect (the hero effect's kind) gives it. */
export type EliteShape = Exclude<AttackShape, 'blast'>;
export function attackShapeOf(effect: HeroEffect): EliteShape {
  switch (effect.kind) {
    case 'freeze':
    case 'slow':
      return 'burst';
    case 'push':
      return effect.way === 'toward' ? 'burst' : 'bolt';
    case 'jump':
    case 'jitter':
      return 'bolt';
    default:
      return 'dash';
  }
}

/** An attack winding up (an elite's or a boss's), for the view to warn with. */
export type Telegraph = {
  shape: AttackShape;
  /** The cat. */
  x: number;
  y: number;
  /** Where the Keeper was when it began. */
  aimX: number;
  aimY: number;
  /** A blast's radius; a bolt's or a burst's shots' size. */
  radius: number;
  /** A dash's lane (or how far a burst's spokes are drawn), and the lane's width, px. */
  length: number;
  width: number;
  /** A burst's shots (its spokes); 0 for the rest. */
  count: number;
  /** A boss's (the Mega Cat's or the Matriarch's). */
  boss: boolean;
  /** 0 as it begins, 1 as it is let loose. */
  progress: number;
};

/** What a cat fired, in flight: a Laser Cat's shot, an elite's, or a boss's. */
export type EnemyShot = {
  kind: 'laser' | 'elite' | 'boss';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  until: number;
  drain: number;
  /** The xenocat type whose effect it lays (an elite's), else -1. */
  type: number;
  variety: VarietyId | null;
  /** It turns toward the nearest Keeper until then, at most `turn` rad/s. */
  homingUntil: number;
  turn: number;
};

/** Most cats' shots in flight at once: an elite's burst in a crowd adds no more. */
export const ENEMY_SHOT_CAP = 400;

/** How far a burst's spokes, and a volley's, are drawn while it winds up, px. */
export const BURST_WARNING = 120;
export const VOLLEY_WARNING = 220;

export type ArenaCat = {
  id: number;
  /** A variety (varieties.ts), or null for one of the twenty xenocat types. */
  variety: VarietyId | null;
  /** For a xenocat, its index into the run's types; -1 for a variety. */
  type: number;
  /** Touched within this of its centre, px. */
  radius: number;
  /** A zooming cat's way, and when it turns next; a sniper's next shot. */
  heading: number;
  turnAt: number;
  shotAt: number;
  /** The kitten swarm it came with, or 0. */
  swarm: number;
  /** A xenocat's visit (schedule `xenocats`): it leaves a chest when sent home. */
  visitor: boolean;
  x: number;
  y: number;
  speed: number;
  homesickness: number;
  /** How much it can take. */
  limit: number;
  drain: number;
  elite: boolean;
  /** An elite's attack: when it lands (0 while none winds up), where it aimed, and when it may begin next. */
  windUntil: number;
  aimX: number;
  aimY: number;
  nextAttackAt: number;
  /** How many attacks it has let loose (a Mega Cat's next pattern is by this). */
  attacks: number;
  /** Dashing (an elite's dash, a Mega Cat's charge) until then, this fast, turning at most `dashTurn` rad/s. */
  dashUntil: number;
  dashVx: number;
  dashVy: number;
  dashTurn: number;
  /** Held still until (a Peacock Tail's touch, a box), slowed until (a puddle), scorched until. */
  stunUntil: number;
  slowUntil: number;
  vulnUntil: number;
  /** Startled by a Cucumber: it runs from (fleeX, fleeY) until then. */
  fleeUntil: number;
  fleeX: number;
  fleeY: number;
  /**
   * Swatted by a Frying Pan: it flies this way (px/s) until then, and each cat it
   * lands among (by id, `flungHits`, itself first) takes `flungDamage`, once.
   */
  flungUntil: number;
  flungVx: number;
  flungVy: number;
  flungDamage: number;
  flungHits: number[];
  /** The weapon that swatted it. */
  flungBy: WeaponId | null;
  /** The weapon whose homesickness reached it last (credited if it goes home), or null. */
  lastHitBy: WeaponId | null;
};

/** Something a weapon set down that stays a while: a toy, a box, a puddle. */
export type Patch = {
  kind: 'toy' | 'box' | 'puddle';
  weapon: WeaponId;
  x: number;
  y: number;
  /** Where it hurts or holds, px. */
  radius: number;
  /** A toy's squeak carries this far, px. */
  reach: number;
  until: number;
  /** Homesickness a second, to each cat in it. */
  damage: number;
  /** A box takes at most this many cats. */
  capacity: number;
  /** A Squeak Symphony's last note, and a Cardboard Castle's slow field. */
  finale: number;
  moat: boolean;
};

/** A swing of the Feather Wand: from him, this way, this far, this wide (half-angle). */
export type Sweep = {
  x: number;
  y: number;
  angle: number;
  reach: number;
  half: number;
  until: number;
};

/** A Hair Dryer's jet this step. */
export type Jet = { x: number; y: number; angle: number; reach: number; half: number };

/** A Frying Pan's swing, from him at a cat, fading until `until`. */
export type Swat = { x: number; y: number; angle: number; until: number };

/** A Static Sock clinging to a cat (`host`, by id), where that cat stands. */
export type Sock = {
  weapon: WeaponId;
  host: number;
  x: number;
  y: number;
  /** Sparks it has left to give, the next at `nextAt`. */
  sparksLeft: number;
  nextAt: number;
  damage: number;
  /** How far a spark leaps, px, and how long it shows, ms. */
  area: number;
  showMs: number;
  owner: number;
};

/** Each evolved weapon a fusion takes in, and the fused weapon it becomes part of. */
const FUSED_FROM = new Map<WeaponId, WeaponId>(
  FUSIONS.flatMap((f) => f.from.map((id) => [id, f.to] as const))
);

/** A Static Sock sparks this often, ms. */
export const SOCK_SPARK_MS = 350;
/** Most socks clinging at once; the oldest falls off. */
export const SOCK_CAP = 24;
/** How far a Static Sock looks for a cat to cling to, px. */
export const SOCK_THROW_RANGE = 400;
/** A swatted cat gives this share of the swat to each cat it lands among, at most so many. */
export const SWAT_BOWL_SHARE = 0.5;
export const SWAT_BOWL_MAX = 4;
/** A Cucumber startles the cats this many times its size from where it lands. */
export const SCARE_REACH = 8;
/** A startled cat runs at this much its own speed. */
export const FLEE_FACTOR = 1.4;

/** A scorched cat takes this much more from every weapon. */
export const SCORCH_FACTOR = 1.5;
/** A cat the Heatwave Fan's blades touch stays scorched this long, ms. */
export const HEATWAVE_SCORCH_MS = 2000;
/** A puddle, or a castle's moat, slows the cats in it to this share of their speed. */
export const SLOW_FACTOR = 0.5;
/** Most patches on the field at once; the oldest give way. */
export const PATCH_CAP = 48;
/** Most things in flight at once for the Banquet's crumbs to be added to. */
export const CRUMB_LIMIT = 700;
/** The Bottomless Saucer sends out its milk waves this often, ms, and they fly this fast, px/s. */
export const MILK_WAVE_EVERY_MS = 1500;
export const MILK_WAVE_SPEED = 380;
/** A Yarn Apocalypse ball slows the cats it touches for this long, ms. */
export const TANGLE_MS = 1500;
/** A Monsoon puddle: how wide, and how long it lasts, ms. */
export const RAIN_PUDDLE_RADIUS = 70;
export const RAIN_PUDDLE_MS = 2500;
/** A Jacuzzi's puddle: how wide, and how long it lasts, ms. */
export const PUDDLE_RADIUS = 90;
export const PUDDLE_MS = 4000;

/** Something a weapon fired, in flight. */
export type Projectile = {
  weapon: WeaponId;
  /** A hairball's bits do not burst again. */
  bit: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  /** Cats it may still touch. */
  pierce: number;
  until: number;
  /** The cats it has touched (by id), each only once. */
  touched: number[];
  /**
   * How many more times it splits when it bounces (the Yarn Apocalypse's); for a
   * Monsoon droplet, 1 if it leaves a puddle where it ends.
   */
  splits: number;
  /**
   * A Banquet crumb looks for the nearest cat again at this time; a boomerang (its
   * `splits` 1 while it goes out) turns home at this time.
   */
  retargetAt: number;
  /** Whose weapon fired it (the Keeper's index). */
  owner: number;
};

/** The Yarn Apocalypse's balls stop splitting at this many at once. */
export const YARN_APOCALYPSE_CAP = 96;

/** The Forbidden Catnip Vacuum's burst: cats this close to him go home, px (before Catnip). */
export const GULP_BURST_RADIUS = 170;

export type Gem = { x: number; y: number; value: number };
/** A chest lying about; a boss's is golden. */
export type Chest = { x: number; y: number; golden: boolean };
/** A ring of light spreading from where a boss was sent home, from `start`. */
export type Ring = { x: number; y: number; start: number };

/**
 * How big a gem is, by the experience it holds: gems that joined grow a size and change
 * colour (arena-view draws each size its own colour). 0 is a single cat's gem.
 */
export function gemSize(value: number): 0 | 1 | 2 | 3 {
  if (value >= 30) return 3;
  if (value >= 10) return 2;
  if (value >= 3) return 1;
  return 0;
}

/** What a cat sent home may leave besides its gem. */
export type PickupKind = 'fish' | 'magnet' | 'bell';
export type Pickup = { x: number; y: number; kind: PickupKind; until: number };

/**
 * Whether the cat with this id leaves a pickup when it is sent home, and which: by a hash
 * of its id, so it draws nothing from the run's random source (the seeded runs are the
 * same as before). Of the ones left, half are fish, three in ten magnets, a fifth bells.
 */
export function pickupFor(id: number, chance: number): PickupKind | null {
  if ((Math.imul(id, 2654435761) >>> 0) / 4294967296 >= chance) return null;
  const roll = (Math.imul(id + 7, 40503) >>> 0) % 10;
  return roll < 5 ? 'fish' : roll < 8 ? 'magnet' : 'bell';
}

/**
 * A weapon held: its level and when it next fires. A fused weapon also keeps its
 * parents', which go on firing as they did (each its own clock), with its own
 * `readyAt` for what it adds.
 */
type Held = {
  level: number;
  readyAt: number;
  parts?: Map<WeaponId, { level: number; readyAt: number }>;
};

/** One player's hero: where he is, his Resolve, his own weapons and passives. */
type Keeper = {
  /** Rerolls and skips he has left this run. */
  rerollsLeft: number;
  skipsLeft: number;
  /**
   * Where he looks, radians (the screen's): at the crosshair, else at the cat his first
   * aiming weapon targets now (looked for five times a second), else null.
   */
  aimAngle: number | null;
  lookAt: number;
  /** The way he last walked, radians. */
  walkAngle: number;
  /** When the Bottomless Saucer sends out its next milk waves. */
  waveAt: number;
  /** The Hair Dryer's way between two looks for a cat, and when it looks next. */
  jetAngle: number;
  jetAt: number;
  /** 0 for player 1, 1 for player 2. */
  index: number;
  x: number;
  y: number;
  /** His character's pace and Resolve, before the passives. */
  speed: number;
  baseResolve: number;
  resolve: number;
  untouchableUntil: number;
  facing: number;
  /**
   * Where he aims, in the arena, when the player aims with a crosshair (desktop,
   * player 1); null when his weapons find their own cats.
   */
  aim: Vec | null;
  /** An elite's effect on him, while it lasts. */
  effect: { effect: HeroEffect; until: number; from: Vec; way: Vec } | null;
  weapons: Map<WeaponId, Held>;
  passives: Map<PassiveId, number>;
  /** The passives his weapons took in as they evolved: they count, at their highest, and hold no slot. */
  absorbed: Map<PassiveId, number>;
  mods: Modifiers;
  revivals: number;
  /** When his Resolve ran out while the other went on (co-op); null while he stands. */
  downedAt: number | null;
  /** The Forbidden Catnip Vacuum's burst, when it comes (after its pull). */
  gulpAt: number;
  /** What the burst after the Forbidden Catnip Vacuum's pull does, and whose it is. */
  gulpDamage: number;
  gulpBy: WeaponId | null;
};

export type ArenaEvent =
  | { kind: 'sent-home'; x: number; y: number; type: number; variety: VarietyId | null }
  | {
      kind: 'hero-hit';
      type: number;
      variety: VarietyId | null;
      elite: boolean;
      /** Which Keeper (0 for player 1, 1 for player 2). */
      player: number;
      /** How: a touch, a shot, a dash (or a charge), a pounce. */
      how: 'touch' | 'shot' | 'dash' | 'pounce';
    }
  /** A Mega Cat has come, wearing the face of xenocat `type`. */
  | { kind: 'boss'; x: number; y: number; type: number }
  /** A xenocat (one with artwork) has come: rare, and an elite as often as not. */
  | { kind: 'xenocat'; type: number; elite: boolean }
  /** An elite (or a boss) begins to wind up an attack; an elite lets its attack loose. */
  | { kind: 'wind-up'; x: number; y: number; type: number; shape: AttackShape }
  | { kind: 'elite-attack'; x: number; y: number; type: number; shape: EliteShape }
  /** The Mega Cat pounced, and on how many. */
  | { kind: 'boss-pounce'; x: number; y: number; hits: number }
  /** A boss let a charge or a volley loose (the Matriarch's volley too). */
  | { kind: 'boss-attack'; x: number; y: number; pattern: 'charge' | 'volley' }
  /** A pickup was left, or taken. */
  | { kind: 'pickup-left'; pickup: PickupKind; x: number; y: number }
  | { kind: 'pickup-taken'; pickup: PickupKind; player: number }
  | { kind: 'boss-summon'; x: number; y: number; kittens: number }
  /**
   * A chest was opened: the rewards it held, and the picks those gave (an evolution, a
   * fusion or a level-up each); fewer when he had too little left to upgrade.
   */
  | { kind: 'chest'; x: number; y: number; golden: boolean; rewards: number; picks: number }
  /** A boss was sent home: the mothership came for it. */
  | { kind: 'boss-home'; x: number; y: number; type: number }
  | { kind: 'laser'; from: Vec; to: Vec }
  | { kind: 'level-up'; level: number }
  | { kind: 'evolution'; from: WeaponId; to: WeaponId }
  /** Two evolved weapons became one at a chest. */
  | { kind: 'fusion'; from: readonly [WeaponId, WeaponId]; to: WeaponId }
  /** The secret cat has come. */
  | { kind: 'secret'; id: 'neighbour' }
  /** His Resolve was spent, and half of it returned (Second Wind, or the other lasted). */
  | { kind: 'revived'; player: number; by: 'second-wind' | 'ally' }
  /** In co-op, a Keeper's Resolve is spent while the other goes on: he is down. */
  | { kind: 'downed'; player: number }
  | { kind: 'fired'; weapon: WeaponId }
  | { kind: 'matriarch' }
  | { kind: 'over'; outcome: ArenaOutcome };

/** A Can Opener blade's own size, px. */
export const BLADE_RADIUS = 20;

/** How a run ended: his Resolve spent, given up, or the time goal reached. */
export type ArenaOutcome = 'spent' | 'gave-up' | 'goal';

export type Arena = ReturnType<typeof createArena>;

/**
 * A run. `types` are the cats that can come (by index); `viewport` is how much of
 * the arena the screen shows around the hero, so cats appear just off it.
 */
export function createArena(options: {
  random: Random;
  types: readonly CatType[];
  viewport: { width: number; height: number };
  config?: Partial<ArenaConfig>;
}) {
  const { random, types } = options;
  const config: ArenaConfig = { ...ARENA_CONFIG, ...options.config };
  let viewport = options.viewport;
  const grid = createArenaGrid(config.cellSize);
  const near: number[] = [];

  let time = 0;
  let status: 'playing' | 'over' = 'playing';
  let outcome: ArenaOutcome | null = null;
  /** The passives held, and what the run brought from before (the boost). */
  const boosted = (m: Modifiers): Modifiers => ({
    ...m,
    might: m.might * config.boost.might,
    pickup: m.pickup * config.boost.pickup,
    drain: m.drain * config.boost.drain,
    cooldown: m.cooldown * config.boost.cooldown,
    area: m.area * config.boost.area,
    duration: m.duration * config.boost.duration,
    xp: m.xp * config.boost.xp,
    luck: m.luck * config.boost.luck,
    recovery: m.recovery + config.boost.recovery,
    choices: m.choices + config.boost.choices,
  });
  /** How many weapons and passives a Keeper can hold, with the Tailor's extra pockets. */
  const slots = { ...config.slots, passives: config.slots.passives + config.boost.passiveSlots };

  function newKeeper(
    index: number,
    at: Vec,
    own: { startingWeapons: readonly WeaponId[]; speed: number; resolve: number },
    startingPassives: readonly PassiveId[]
  ): Keeper {
    const weapons = new Map<WeaponId, Held>();
    for (const id of own.startingWeapons) {
      weapons.set(id, { level: config.startingLevel, readyAt: config.firstShotMs });
    }
    const passives = new Map<PassiveId, number>(startingPassives.map((id) => [id, 1]));
    return {
      index,
      x: at.x,
      y: at.y,
      speed: own.speed,
      baseResolve: own.resolve,
      resolve: own.resolve,
      untouchableUntil: 0,
      facing: 1,
      aim: null,
      effect: null,
      weapons,
      passives,
      absorbed: new Map(),
      mods: boosted(modifiers(passives)),
      jetAngle: 0,
      jetAt: 0,
      waveAt: 0,
      rerollsLeft: config.levelUp.rerolls + config.boost.rerolls + modifiers(passives).rerolls,
      skipsLeft: config.levelUp.skips + config.boost.skips,
      aimAngle: null,
      lookAt: 0,
      walkAngle: 0,
      revivals: config.boost.revivals,
      downedAt: null,
      gulpAt: Infinity,
      gulpDamage: 0,
      gulpBy: null,
    };
  }

  // The Keepers: one, or two side by side in co-op (config.secondPlayer).
  const first = {
    startingWeapons: config.startingWeapons,
    speed: config.hero.speed,
    resolve: config.hero.resolve,
  };
  const keepers: Keeper[] = config.secondPlayer
    ? [
        newKeeper(0, { x: -config.coop.startGap / 2, y: 0 }, first, config.startingPassives),
        newKeeper(
          1,
          { x: config.coop.startGap / 2, y: 0 },
          config.secondPlayer,
          config.secondPlayer.startingPassives ?? []
        ),
      ]
    : [newKeeper(0, { x: 0, y: 0 }, first, config.startingPassives)];
  /** The Keeper being dealt with now: whose walk, weapons and touch. */
  let hero = keepers[0];
  /**
   * The weapon whose work is being done now (each place a weapon hurts sets it), and
   * what each weapon held in the run has done: homesickness given, cats sent home
   * (each cat to the weapon that reached it last). Counted here, so every view reads
   * the same numbers.
   */
  type Tally = { homesickness: number; sentHome: number };
  const tally = new Map<WeaponId, Tally>();
  /** The weapon credited now (the one dealing, or the fused one it is part of), and its counts. */
  let dealtBy: WeaponId | null = null;
  let dealtTo: Tally | null = null;
  /** Names the weapon whose work is done next (null: none, nothing is counted). */
  function deal(id: WeaponId | null) {
    if (id === null) {
      dealtBy = null;
      dealtTo = null;
      return;
    }
    dealtBy = creditOf(id);
    dealtTo = tally.get(dealtBy) ?? null;
    if (!dealtTo) {
      dealtTo = { homesickness: 0, sentHome: 0 };
      tally.set(dealtBy, dealtTo);
    }
  }
  const everHeld = new Set<WeaponId>(keepers.flatMap((k) => [...k.weapons.keys()]));
  let sentHome = 0;
  let windUpsBegun = 0;
  /** How many elites are winding up an attack now (kept, not counted: state() is read every frame). */
  let windingUp = 0;
  /** Of them, the Mega Cats; and the Matriarch's call, if she is making one. */
  let megaWinding = 0;
  /** How many boss wind-ups have begun in the run (the HUD data and the tests read it). */
  let bossWindUpsBegun = 0;
  const pickups: Pickup[] = [];
  let pickupsTaken = 0;
  let lastPickup: PickupKind | null = null;
  /** Until this time every gem is drawn in (a magnet). */
  let magnetUntil = 0;
  let matriarchWind = 0;
  let matriarchAim: Vec = { x: 0, y: 0 };
  let matriarchNextAt = Infinity;
  /** How many calls she has made: summons and volleys by turns. */
  let matriarchCalls = 0;
  /** One wind-up ended, wherever it was: landed, held still, or the cat went home. */
  function stopWinding(cat: ArenaCat) {
    windingUp--;
    if (cat.variety === 'mega') megaWinding--;
  }
  let nextId = 1;
  // How long he has stood still; whether the secret cat has come.
  let stillFor = 0;
  let secretCame = false;
  // The cats: live ones in `cats`, sent-home ones kept in `spare` to be reused.
  const cats: ArenaCat[] = [];
  const spare: ArenaCat[] = [];
  let arrivals = 0;
  let matriarch: Vec | null = null;
  let events: ArenaEvent[] = [];
  // Kitten swarms (how many of each are left), bosses come, chests lie about.
  let nextSwarm = config.schedule.swarms.from;
  let swarmId = 0;
  let nextXenocat = config.schedule.xenocats?.from ?? Infinity;
  const swarms = new Map<number, number>();
  let bossesCome = 0;
  const chests: Chest[] = [
    ...Array.from({ length: config.startingChests }, () => ({ x: 0, y: 0, golden: false })),
    ...Array.from({ length: config.startingGoldenChests }, () => ({ x: 0, y: 0, golden: true })),
  ];
  // The rings of light a boss sent home leaves, spreading.
  const rings: Ring[] = [];
  // What the cats fire: the Laser Cats', the elites' and the bosses' shots.
  const shots: EnemyShot[] = [];
  const spareShots: EnemyShot[] = [];
  /** Fires a cat's shot from `from` at `angle`, unless too many fly already. */
  function catFires(
    from: Vec,
    angle: number,
    s: Pick<EnemyShot, 'kind' | 'radius' | 'drain' | 'type' | 'variety' | 'turn'> & {
      speed: number;
      lifeMs: number;
      homingMs: number;
    }
  ) {
    if (shots.length >= ENEMY_SHOT_CAP) return;
    const shot = spareShots.pop() ?? ({} as EnemyShot);
    shot.kind = s.kind;
    shot.x = from.x;
    shot.y = from.y;
    shot.vx = Math.cos(angle) * s.speed;
    shot.vy = Math.sin(angle) * s.speed;
    shot.radius = s.radius;
    shot.until = time + s.lifeMs;
    shot.drain = s.drain;
    shot.type = s.type;
    shot.variety = s.variety;
    shot.homingUntil = time + s.homingMs;
    shot.turn = s.turn;
    shots.push(shot);
  }

  // What the weapons fired.
  const projectiles: Projectile[] = [];
  const spareProjectiles: Projectile[] = [];
  // A beam fired from a Keeper (`follows`) moves with him while it shows.
  const beams: { from: Vec; to: Vec; until: number; follows?: Vec }[] = [];
  const patches: Patch[] = [];
  // This step's toys among the patches, gathered before the cats walk (lureOf): every
  // cat looks at these, not at every puddle and box (night run 2026-10-17, E12).
  const toys: Patch[] = [];
  const sweeps: Sweep[] = [];
  const jets: Jet[] = [];
  const swats: Swat[] = [];
  const socks: Sock[] = [];
  // Each sock's cat, as last found (the same index as in `socks`).
  const sockHosts: ArenaCat[] = [];
  // The swatted cats in flight this step (indices), for the cats they land among.
  const flying: number[] = [];
  // Experience.
  const gems: Gem[] = [];
  let xp = 0;
  let level = 1;
  let pending = 0;
  let choosing: Choice[] | null = null;
  /** Whose turn it is to choose (co-op: player 1, then player 2, each level). */
  let chooser = 0;

  const maxResolveOf = (k: Keeper) => k.baseResolve + k.mods.maxResolve;
  const maxResolve = () => maxResolveOf(hero);
  const standing = (k: Keeper) => k.downedAt === null;

  /**
   * The shared camera: on the one Keeper, or between the two. Its zoom is the
   * screen's own (baseZoom: out on a small screen), and in co-op out further, up to
   * that times config.coop.maxZoomOut, to keep both in view. The screen then shows
   * the viewport times `zoom` of the arena.
   */
  function camera(): { x: number; y: number; zoom: number } {
    const base = baseZoom();
    if (keepers.length === 1) return { x: keepers[0].x, y: keepers[0].y, zoom: base };
    const [a, b] = keepers;
    const m = config.coop.margin;
    const zoom = Math.min(
      base * config.coop.maxZoomOut,
      Math.max(
        base,
        (Math.abs(a.x - b.x) + 2 * m) / viewport.width,
        (Math.abs(a.y - b.y) + 2 * m) / viewport.height
      )
    );
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, zoom };
  }

  /** The screen's own zoom, before co-op's: out on a small screen (config.view). */
  function baseZoom() {
    const narrower = Math.min(viewport.width, viewport.height);
    if (narrower <= 0) return 1;
    return Math.min(Math.max(config.view.minView / narrower, 1), config.view.maxZoom);
  }

  /**
   * The tether: at the camera's widest, neither can walk further from the other.
   * Only this step's walk is held back (`from` is where he stood): if they are
   * already further apart (the window shrank), he is not moved, only kept from
   * going further.
   */
  function tether(k: Keeper, from: Vec) {
    if (keepers.length < 2) return;
    const other = keepers[1 - k.index];
    const widest = baseZoom() * config.coop.maxZoomOut;
    const spanX = Math.max(
      viewport.width * widest - 2 * config.coop.margin,
      Math.abs(from.x - other.x)
    );
    const spanY = Math.max(
      viewport.height * widest - 2 * config.coop.margin,
      Math.abs(from.y - other.y)
    );
    k.x = Math.min(Math.max(k.x, other.x - spanX), other.x + spanX);
    k.y = Math.min(Math.max(k.y, other.y - spanY), other.y + spanY);
  }

  /** The standing Keeper nearest a point (the first, if none stands). */
  function nearestKeeper(x: number, y: number): Keeper {
    let best = keepers[0];
    let bestD = Infinity;
    for (const k of keepers) {
      if (!standing(k)) continue;
      const d = (k.x - x) ** 2 + (k.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    return best;
  }

  /** A type's own numbers, the same every time: spread between the config's bounds. */
  const byType = (type: number, [low, high]: readonly [number, number], salt: number) => {
    const share = ((types[type].number * salt) % 11) / 10;
    return low + (high - low) * share;
  };

  /** A point just off screen, at `angle` from its centre. */
  function offScreen(angle: number, extra = 0): Vec {
    const cam = camera();
    const reach =
      (Math.hypot(viewport.width, viewport.height) / 2) * cam.zoom +
      config.cats.spawnMargin +
      extra;
    return { x: cam.x + Math.cos(angle) * reach, y: cam.y + Math.sin(angle) * reach };
  }

  /** A new cat (pooled), at `at`. */
  function newCat(at: Vec): ArenaCat {
    const cat = spare.pop() ?? ({} as ArenaCat);
    cat.id = nextId++;
    cat.x = at.x;
    cat.y = at.y;
    cat.homesickness = 0;
    cat.heading = 0;
    cat.turnAt = 0;
    cat.shotAt = time + config.laserCat.everyMs;
    cat.swarm = 0;
    cat.visitor = false;
    cat.windUntil = 0;
    cat.aimX = 0;
    cat.aimY = 0;
    cat.nextAttackAt = 0;
    cat.attacks = 0;
    cat.dashUntil = 0;
    cat.dashVx = 0;
    cat.dashVy = 0;
    cat.dashTurn = 0;
    cat.stunUntil = 0;
    cat.slowUntil = 0;
    cat.vulnUntil = 0;
    cat.fleeUntil = 0;
    cat.fleeX = 0;
    cat.fleeY = 0;
    cat.flungUntil = 0;
    cat.flungVx = 0;
    cat.flungVy = 0;
    cat.flungDamage = 0;
    cat.flungHits ??= [];
    cat.flungHits.length = 0;
    cat.lastHitBy = null;
    cat.flungBy = null;
    cats.push(cat);
    return cat;
  }

  /** A cat arriving late in a long run is tougher and quicker (config.toughness). */
  function toughen(cat: ArenaCat) {
    const t = config.toughness;
    // A five-minute run has no long peak: the seconds until the Matriarch arrives stay as they were.
    if (config.timeGoalMs <= t.fromMs) return;
    const minutes = Math.max(time - t.fromMs, 0) / 60_000;
    if (minutes === 0) return;
    cat.limit *= 1 + minutes * t.homesicknessPerMin;
    if (Number.isFinite(config.timeGoalMs)) {
      cat.speed *= Math.min(1 + minutes * t.speedPerMin, t.maxSpeedFactor);
      return;
    }
    const before = (Math.min(time, t.endless.fromMs) - t.fromMs) / 60_000;
    const after = Math.max(time - t.endless.fromMs, 0) / 60_000;
    cat.speed *= 1 + Math.max(before, 0) * t.speedPerMin + after * t.endless.speedPerMin;
  }

  /** What a touch worth `drain` takes from a Keeper now: an endless run's grows (config.toughness). */
  function drainNow(drain: number, k: Keeper) {
    const e = config.toughness.endless;
    const minutes = Number.isFinite(config.timeGoalMs) ? 0 : Math.max(time - e.fromMs, 0) / 60_000;
    return drain * k.mods.drain * (1 + e.drainPerMin) ** minutes;
  }

  function spawnXenocat(at: Vec) {
    const type = random.int(0, types.length - 1);
    const cat = newCat(at);
    cat.variety = null;
    cat.type = type;
    cat.radius = config.cats.radius;
    cat.speed = byType(type, config.cats.speed, 7);
    cat.limit = byType(type, config.cats.homesickness, 3);
    cat.drain = Math.round(byType(type, config.cats.drain, 5));
    cat.elite = random.next() < config.cats.eliteShare;
    toughen(cat);
    events.push({ kind: 'xenocat', type, elite: cat.elite });
    return cat;
  }

  function spawnVariety(id: VarietyId, at: Vec): ArenaCat {
    const variety = VARIETIES[id];
    const cat = newCat(at);
    cat.variety = id;
    cat.type = -1;
    cat.radius = variety.radius;
    cat.speed = variety.speed;
    cat.limit = variety.homesickness;
    cat.drain = variety.drain;
    cat.elite = false;
    toughen(cat);
    return cat;
  }

  /** A spot on the screen, at least `away` from him: where a cat that sits is found. */
  function onScreen(away: number): Vec {
    const cam = camera();
    const angle = random.next() * 2 * Math.PI;
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));
    // How far the screen reaches that way (40 px in from its edge), so a narrow
    // screen keeps the cat on it: nearer than `away` only if the screen is that small.
    const edge = Math.min(
      cos > 1e-6 ? ((viewport.width * cam.zoom) / 2 - 40) / cos : Infinity,
      sin > 1e-6 ? ((viewport.height * cam.zoom) / 2 - 40) / sin : Infinity
    );
    const near = Math.min(away, edge / 2);
    const reach = random.range(near, Math.max(edge, near));
    return { x: cam.x + Math.cos(angle) * reach, y: cam.y + Math.sin(angle) * reach };
  }

  /** One arrival: who comes is drawn from what the schedule allows now, by weight. */
  function spawnCat() {
    const at = offScreen(random.next() * 2 * Math.PI);
    const open = arrivalsAt(time, config.schedule);
    let pick = random.next() * open.reduce((sum, a) => sum + a.weight, 0);
    let who: VarietyId | 'xenocat' = 'xenocat';
    for (const a of open) {
      pick -= a.weight;
      if (pick < 0) {
        who = a.who;
        break;
      }
    }
    if (who === 'xenocat') spawnXenocat(at);
    // A cat that sits is found on the screen, sitting calmly: off it, nobody would
    // ever meet it.
    else spawnVariety(who, VARIETIES[who].gait === 'sit' ? onScreen(200) : at);
  }

  /**
   * A cat left far behind him (he walked on; it sits, or it is slow) comes round
   * again: just off the screen if it walks, on it if it sits. So the horde stays
   * where he is, and none counts for nothing.
   */
  function bringBack(cat: ArenaCat, cam: { x: number; y: number }, far: number) {
    if (Math.hypot(cat.x - cam.x, cat.y - cam.y) <= far + cat.radius) return;
    const sits = cat.variety !== null && VARIETIES[cat.variety].gait === 'sit';
    const at = sits ? onScreen(200) : offScreen(random.next() * 2 * Math.PI, cat.radius);
    cat.x = at.x;
    cat.y = at.y;
  }

  /** The swarms and the bosses the schedule has come to. */
  function spawnEvents(spawn: boolean) {
    const { swarms: plan, bosses } = config.schedule;
    if (time >= nextSwarm) {
      nextSwarm = time + plan.everyMs;
      if (spawn && cats.length < config.cats.hardCap) {
        const size = Math.min(
          random.int(plan.size[0], plan.size[1]),
          config.cats.hardCap - cats.length
        );
        const id = ++swarmId;
        const angle = random.next() * 2 * Math.PI;
        const centre = offScreen(angle);
        for (let k = 0; k < size; k++) {
          const kitten = spawnVariety('kitten', {
            x: centre.x + random.range(-40, 40),
            y: centre.y + random.range(-40, 40),
          });
          kitten.swarm = id;
          // A swarm counts as an elite: its last kitten home leaves a chest.
          kitten.elite = true;
        }
        swarms.set(id, size);
      }
    }
    // A xenocat's visit: rare by the clock, not a share of the horde.
    const visits = config.schedule.xenocats;
    if (visits && time >= nextXenocat) {
      nextXenocat = time + random.range(visits.everyMs[0], visits.everyMs[1]);
      if (spawn && cats.length < config.cats.hardCap) {
        const visitor = spawnXenocat(offScreen(random.next() * 2 * Math.PI));
        visitor.visitor = true;
      }
    }
    while (bossesCome < bosses.length && time >= bosses[bossesCome]) {
      bossesCome++;
      const at = offScreen(random.next() * 2 * Math.PI, VARIETIES.mega.radius);
      const boss = spawnVariety('mega', at);
      // A Mega Cat's size and strength, and one of the xenocats' faces.
      boss.type = random.int(0, types.length - 1);
      events.push({ kind: 'boss', x: at.x, y: at.y, type: boss.type });
    }
  }

  /** Every cat homesick enough goes home, leaving a gem; the objects are kept for reuse. */
  function sweepHome() {
    for (let i = cats.length - 1; i >= 0; i--) {
      const cat = cats[i];
      if (cat.homesickness < cat.limit) continue;
      events.push({
        kind: 'sent-home',
        x: cat.x,
        y: cat.y,
        type: cat.type,
        variety: cat.variety,
      });
      sentHome++;
      if (cat.lastHitBy) {
        const counts = tally.get(cat.lastHitBy);
        if (counts) counts.sentHome++;
      }
      if (cat.windUntil > 0) stopWinding(cat);
      dropGem(cat.x, cat.y, cat.elite ? config.gems.eliteValue : config.gems.value);
      // The best Cookie Jar among the Keepers standing makes pickups likelier.
      let luck = 1;
      for (const k of keepers) if (standing(k)) luck = Math.max(luck, k.mods.luck);
      const left = pickupFor(cat.id, config.pickups.chance * luck);
      if (left && pickups.length < config.pickups.cap) {
        pickups.push({ x: cat.x, y: cat.y, kind: left, until: time + config.pickups.lifeMs });
        events.push({ kind: 'pickup-left', pickup: left, x: cat.x, y: cat.y });
      }
      // A boss, an elite, a visiting xenocat, or the last kitten of a swarm
      // leaves a chest.
      let chest = cat.variety === 'mega' || cat.visitor || (cat.elite && cat.swarm === 0);
      if (cat.swarm !== 0) {
        const left = (swarms.get(cat.swarm) ?? 1) - 1;
        if (left <= 0) {
          swarms.delete(cat.swarm);
          chest = true;
        } else swarms.set(cat.swarm, left);
      }
      const boss = cat.variety === 'mega';
      if (chest) chests.push({ x: cat.x, y: cat.y, golden: boss });
      if (boss) {
        events.push({ kind: 'boss-home', x: cat.x, y: cat.y, type: cat.type });
        rings.push({ x: cat.x, y: cat.y, start: time });
        for (let k = 0; k < config.bossHome.loot; k++) {
          const angle = random.next() * 2 * Math.PI;
          const far = 50 + random.next() * 70;
          dropGem(
            cat.x + Math.cos(angle) * far,
            cat.y + Math.sin(angle) * far,
            config.bossHome.lootValue * config.gems.value
          );
        }
      }
      cats[i] = cats[cats.length - 1];
      cats.pop();
      spare.push(cat);
    }
  }

  /** Each boss's ring of light spreads; every cat it reaches (but a boss) goes home. */
  function spreadRings() {
    const { ringMs, ringRadius } = config.bossHome;
    for (let r = rings.length - 1; r >= 0; r--) {
      const ring = rings[r];
      const radius = (Math.min(time - ring.start, ringMs) / ringMs) * ringRadius;
      for (const i of within(ring, radius)) {
        const cat = cats[i];
        if (cat.variety !== 'mega') cat.homesickness = Math.max(cat.homesickness, cat.limit);
      }
      if (time - ring.start >= ringMs) rings.splice(r, 1);
    }
  }

  function dropGem(x: number, y: number, value: number) {
    // Near another gem, it joins it (the nearest): one bigger gem.
    let join: Gem | null = null;
    let best = config.gems.merge ** 2;
    for (const gem of gems) {
      const d = (gem.x - x) ** 2 + (gem.y - y) ** 2;
      if (d <= best) {
        best = d;
        join = gem;
      }
    }
    if (join) join.value += value;
    // Too many lying about: it adds to one already there.
    else if (gems.length >= config.gems.cap) gems[random.int(0, gems.length - 1)].value += value;
    else gems.push({ x, y, value });
  }

  function end(how: ArenaOutcome) {
    if (status === 'over') return;
    status = 'over';
    // Past the time goal the run was won, however it then ended.
    outcome = how === 'spent' && time >= config.timeGoalMs ? 'goal' : how;
    events.push({ kind: 'over', outcome });
  }

  /** Lays an elite's effect on the hero, if none is on him; whether it did. */
  function afflict(cat: ArenaCat): boolean {
    if (cat.variety !== null) return false;
    return afflictBy(cat.type, cat);
  }

  /** Lays xenocat `typeIndex`'s effect on the hero, as from `from`, if none is on him; whether it did. */
  function afflictBy(typeIndex: number, from: Vec): boolean {
    if (hero.effect && time < hero.effect.until) return false;
    const type = types[typeIndex];
    const kind = HERO_EFFECTS[type.effect.id];
    if (!kind) return false;
    const until =
      time + Math.min(type.effect.durationMs, config.cats.effectMaxMs) * (1 - hero.mods.guard);
    const away = { x: hero.x - from.x, y: hero.y - from.y };
    const length = Math.hypot(away.x, away.y) || 1;
    const angle = random.next() * 2 * Math.PI;
    let way = { x: away.x / length, y: away.y / length };
    if (kind.kind === 'push') {
      if (kind.way === 'toward') way = { x: -way.x, y: -way.y };
      else if (kind.way === 'down') way = { x: 0, y: 1 };
      else if (kind.way === 'fixed') way = { x: Math.cos(angle), y: Math.sin(angle) };
    }
    if (kind.kind === 'jump') {
      const before = { x: hero.x, y: hero.y };
      hero.x += Math.cos(angle) * kind.distance;
      hero.y += Math.sin(angle) * kind.distance;
      // In co-op, not out of the other's sight.
      tether(hero, before);
    }
    hero.effect = { effect: kind, until, from: { x: from.x, y: from.y }, way };
    return true;
  }

  /**
   * A cat's attack (a shot, a dash, a pounce) reaches Keeper `k`: it drains his Resolve,
   * he is untouchable for a moment, and an elite's lays its effect on him.
   */
  function strike(
    k: Keeper,
    drain: number,
    who: { type: number; variety: VarietyId | null; elite: boolean },
    how: 'shot' | 'dash' | 'pounce',
    from: Vec
  ) {
    k.resolve = Math.max(k.resolve - drainNow(drain, k), 0);
    k.untouchableUntil = time + config.hero.untouchableMs + k.mods.grace;
    events.push({
      kind: 'hero-hit',
      type: who.type,
      variety: who.variety,
      elite: who.elite,
      player: k.index,
      how,
    });
    if (!who.elite || who.type < 0) return;
    const was = hero;
    hero = k;
    afflictBy(who.type, from);
    hero = was;
  }

  /** A cat begins to dash at `angle`: this fast, for so long, turning after him at most `turn` rad/s. */
  function startDash(cat: ArenaCat, angle: number, speed: number, ms: number, turn: number) {
    cat.dashUntil = time + ms;
    cat.dashVx = Math.cos(angle) * speed;
    cat.dashVy = Math.sin(angle) * speed;
    cat.dashTurn = turn;
  }

  /** A dashing cat's step: on, turning after the nearest Keeper if it may, striking whom it reaches. */
  function dashStep(cat: ArenaCat, dt: number) {
    if (cat.dashTurn > 0) {
      const k = nearestKeeper(cat.x, cat.y);
      const v = steer(cat.dashVx, cat.dashVy, k.x - cat.x, k.y - cat.y, cat.dashTurn * dt);
      cat.dashVx = v.vx;
      cat.dashVy = v.vy;
    }
    cat.x += cat.dashVx * dt;
    cat.y += cat.dashVy * dt;
    for (const k of keepers) {
      if (!standing(k) || time < k.untouchableUntil) continue;
      if (Math.hypot(k.x - cat.x, k.y - cat.y) > cat.radius + config.hero.reach / 2) continue;
      strike(k, cat.drain, cat, 'dash', cat);
    }
  }

  /** A boss's volley: shots on every side of `from`, the first at `aim`. */
  function volley(from: Vec, aim: Vec, drain: number, variety: VarietyId) {
    const v = config.bossAttack.volley;
    for (const turn of burstAngles(Math.atan2(aim.y - from.y, aim.x - from.x), v.shots)) {
      catFires(from, turn, {
        kind: 'boss',
        radius: v.radius,
        drain,
        type: -1,
        variety,
        speed: v.speed,
        lifeMs: v.lifeMs,
        homingMs: 0,
        turn: 0,
      });
    }
  }

  /**
   * The Mega Cat near a Keeper stands still, winds up its next attack (its patterns go
   * round), then lets it loose: it pounces where he stood (a Keeper still within the
   * radius loses Resolve, and it goes on from there), charges through that spot, or
   * looses a volley. Returns whether it spends this step on it.
   */
  function megaAttacks(cat: ArenaCat, target: Keeper, d: number): boolean {
    const b = config.bossAttack;
    const pattern = megaPatternAt(cat.attacks);
    if (cat.windUntil > 0) {
      if (time < cat.windUntil) return true;
      cat.windUntil = 0;
      stopWinding(cat);
      cat.attacks++;
      cat.nextAttackAt = time + b.pounce.cooldownMs;
      if (pattern === 'charge') {
        const angle = Math.atan2(cat.aimY - cat.y, cat.aimX - cat.x);
        startDash(cat, angle, b.charge.speed, b.charge.ms, 0);
        events.push({ kind: 'boss-attack', x: cat.x, y: cat.y, pattern });
        return true;
      }
      if (pattern === 'volley') {
        volley(cat, { x: cat.aimX, y: cat.aimY }, cat.drain / 2, 'mega');
        events.push({ kind: 'boss-attack', x: cat.x, y: cat.y, pattern });
        return true;
      }
      cat.x = cat.aimX;
      cat.y = cat.aimY;
      let hits = 0;
      for (const k of keepers) {
        if (!standing(k) || time < k.untouchableUntil) continue;
        if (Math.hypot(k.x - cat.aimX, k.y - cat.aimY) > b.pounce.radius + config.hero.reach / 2) {
          continue;
        }
        strike(k, cat.drain, cat, 'pounce', cat);
        hits++;
      }
      events.push({ kind: 'boss-pounce', x: cat.x, y: cat.y, hits });
      return true;
    }
    if (time < cat.nextAttackAt || d > b[pattern].range) return false;
    // It pounces only at one it is not already on.
    if (pattern === 'pounce' && d <= b.pounce.radius) return false;
    cat.windUntil = time + b[pattern].windUpMs;
    cat.aimX = target.x;
    cat.aimY = target.y;
    windUpsBegun++;
    windingUp++;
    megaWinding++;
    bossWindUpsBegun++;
    events.push({
      kind: 'wind-up',
      x: cat.x,
      y: cat.y,
      type: cat.type,
      shape: MEGA_SHAPE[pattern],
    });
    return true;
  }

  /** The attack an elite xenocat winds up, or null for a cat that has none. */
  function attackOf(cat: ArenaCat): EliteShape | null {
    if (!cat.elite || cat.variety !== null || cat.type < 0) return null;
    const kind = HERO_EFFECTS[types[cat.type].effect.id];
    return kind ? attackShapeOf(kind) : null;
  }

  /**
   * An elite near a Keeper winds up, standing still, aimed where he is; then lets its
   * attack loose (config.eliteAttack). Returns whether the elite spends this step on it
   * (no walking).
   */
  function eliteAttacks(cat: ArenaCat, target: Keeper, d: number): boolean {
    const shape = attackOf(cat);
    if (!shape) return false;
    const a = config.eliteAttack;
    if (cat.windUntil > 0) {
      if (time < cat.windUntil) return true;
      cat.windUntil = 0;
      stopWinding(cat);
      cat.attacks++;
      cat.nextAttackAt = time + a.cooldownMs;
      const angle = Math.atan2(cat.aimY - cat.y, cat.aimX - cat.x);
      const own = { kind: 'elite' as const, drain: cat.drain, type: cat.type, variety: null };
      if (shape === 'burst') {
        const { shots: count, speed, radius, lifeMs } = a.burst;
        for (const turn of burstAngles(angle, count)) {
          catFires(cat, turn, { ...own, radius, speed, lifeMs, homingMs: 0, turn: 0 });
        }
      } else if (shape === 'bolt') {
        catFires(cat, angle, { ...own, ...a.bolt });
      } else startDash(cat, angle, a.dash.speed, a.dash.ms, a.dash.turn);
      events.push({ kind: 'elite-attack', x: cat.x, y: cat.y, type: cat.type, shape });
      return true;
    }
    const begins = shape === 'burst' ? a.burstRange : a.range;
    if (time >= cat.nextAttackAt && d <= begins) {
      cat.windUntil = time + a.windUpMs;
      cat.aimX = target.x;
      cat.aimY = target.y;
      windUpsBegun++;
      windingUp++;
      events.push({ kind: 'wind-up', x: cat.x, y: cat.y, type: cat.type, shape });
      return true;
    }
    return false;
  }

  /** The hero's walk this step, after any effect on him. */
  function heroStep(input: Vec, dt: number) {
    const active = hero.effect && time < hero.effect.until ? hero.effect : null;
    let { x, y } = input;
    let speed = hero.speed * hero.mods.speed;
    if (active) {
      const e = active.effect;
      if (e.kind === 'freeze') speed = 0;
      else if (e.kind === 'slow') speed *= e.factor;
      else if (e.kind === 'reverse') [x, y] = [-x, -y];
      else if (e.kind === 'axis') y = 0;
      else if (e.kind === 'push') {
        hero.x += active.way.x * e.speed * dt;
        hero.y += active.way.y * e.speed * dt;
      } else if (e.kind === 'jitter') {
        hero.x += random.range(-e.px, e.px);
        hero.y += random.range(-e.px, e.px);
      }
    }
    hero.x += x * speed * dt;
    hero.y += y * speed * dt;
    if (x !== 0) hero.facing = Math.sign(x);
    // Frozen, he turns no way: the stick moves nothing.
    if ((x !== 0 || y !== 0) && speed > 0) hero.walkAngle = Math.atan2(y, x);
  }

  /** The toy that calls this cat, if one is near enough: where it goes instead. */
  function lureOf(cat: ArenaCat): Patch | null {
    if (toys.length === 0 || cat.variety === 'mega') return null;
    let best: Patch | null = null;
    let bestD = Infinity;
    for (const p of toys) {
      const d = (p.x - cat.x) ** 2 + (p.y - cat.y) ** 2;
      if (d <= p.reach * p.reach && d < bestD) {
        best = p;
        bestD = d;
      }
    }
    return best;
  }

  /** A cat's step: held still, slowed or called away by what his weapons set down, or its own way. */
  function moveCat(cat: ArenaCat, dt: number) {
    if (time < cat.flungUntil) {
      // Swatted, it flies, whatever else holds it, and loses its wind-up.
      cat.x += cat.flungVx * dt;
      cat.y += cat.flungVy * dt;
      loseWindUp(cat);
      return;
    }
    if (time < cat.stunUntil) {
      // Held still, an elite loses its wind-up (or its dash): it must begin again.
      loseWindUp(cat);
      return;
    }
    if (time < cat.dashUntil) {
      dashStep(cat, dt);
      return;
    }
    const slowed = time < cat.slowUntil;
    const speed = cat.speed;
    if (slowed) cat.speed = speed * SLOW_FACTOR;
    if (time < cat.fleeUntil) {
      // Startled, it runs from where the Cucumber landed, and forgets its attack.
      loseWindUp(cat);
      const dx = cat.x - cat.fleeX;
      const dy = cat.y - cat.fleeY;
      const d = Math.hypot(dx, dy) || 1;
      cat.x += (dx / d) * cat.speed * FLEE_FACTOR * dt;
      cat.y += (dy / d) * cat.speed * FLEE_FACTOR * dt;
    } else walkCat(cat, dt);
    cat.speed = speed;
  }

  /**
   * An elite (or a Mega Cat) winding up an attack loses it: it must begin again, after
   * its own rest. A dash stops where it is.
   */
  function loseWindUp(cat: ArenaCat) {
    cat.dashUntil = 0;
    if (cat.windUntil > 0) {
      cat.windUntil = 0;
      stopWinding(cat);
      cat.nextAttackAt =
        time +
        (cat.variety === 'mega'
          ? config.bossAttack.pounce.cooldownMs
          : config.eliteAttack.cooldownMs);
    }
  }

  /** A cat's step, its own way. */
  function walkCat(cat: ArenaCat, dt: number) {
    const target = nearestKeeper(cat.x, cat.y);
    const dx = target.x - cat.x;
    const dy = target.y - cat.y;
    const d = Math.hypot(dx, dy) || 1;
    const gait = cat.variety ? VARIETIES[cat.variety].gait : 'walk';
    if (gait === 'sit') return;
    if (cat.elite && eliteAttacks(cat, target, d)) return;
    if (cat.variety === 'mega' && megaAttacks(cat, target, d)) return;
    const toy = lureOf(cat);
    if (toy) {
      const tx = toy.x - cat.x;
      const ty = toy.y - cat.y;
      const td = Math.hypot(tx, ty);
      // It comes for the toy and mills about it.
      if (td > 8) {
        const stepLength = Math.min(cat.speed * 1.2 * dt, td);
        cat.x += (tx / td) * stepLength;
        cat.y += (ty / td) * stepLength;
      }
      return;
    }
    if (gait === 'zoom') {
      // A new way now and then: roughly at him, give or take a right angle.
      if (time >= cat.turnAt) {
        cat.heading = Math.atan2(dy, dx) + random.range(-Math.PI / 2, Math.PI / 2);
        cat.turnAt = time + random.range(350, 900);
      }
      cat.x += Math.cos(cat.heading) * cat.speed * dt;
      cat.y += Math.sin(cat.heading) * cat.speed * dt;
      return;
    }
    let speed = cat.speed;
    if (gait === 'charge' && d < 250) speed *= 1.9;
    if (gait === 'snipe') {
      if (time >= cat.shotAt && d < config.laserCat.range + 120) {
        cat.shotAt = time + config.laserCat.everyMs;
        catFires(cat, Math.atan2(dy, dx), {
          kind: 'laser',
          radius: config.laserCat.shotRadius,
          drain: cat.drain,
          type: -1,
          variety: 'laser',
          speed: config.laserCat.shotSpeed,
          lifeMs: 2500,
          homingMs: 0,
          turn: 0,
        });
      }
      if (d <= config.laserCat.range) return;
    }
    const stepLength = Math.min(speed * dt, d);
    cat.x += (dx / d) * stepLength;
    cat.y += (dy / d) * stepLength;
  }

  /** Indices of this step's Purring Cats (varieties that soothe). */
  const soothers: number[] = [];

  /**
   * Every Purring Cat comforts the cats around it: each within its reach (itself
   * and other Purring Cats aside) loses a little Homesickness, never below none.
   */
  function soothe(dt: number) {
    soothers.length = 0;
    for (let i = 0; i < cats.length; i++) {
      const variety = cats[i].variety;
      if (variety !== null && VARIETIES[variety].soothes) soothers.push(i);
    }
    for (const i of soothers) {
      const purring = cats[i];
      const { radius, perSecond } = VARIETIES[purring.variety!].soothes!;
      for (const j of within(purring, radius)) {
        const cat = cats[j];
        if (cat.variety !== null && VARIETIES[cat.variety].soothes) continue;
        cat.homesickness = Math.max(cat.homesickness - perSecond * dt, 0);
      }
    }
  }

  /**
   * The cats' shots fly (a bolt turning after the nearest Keeper while it may); one that
   * reaches a Keeper is spent, and drains his Resolve (an elite's lays its effect too).
   */
  function moveShots(dt: number) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const shot = shots[i];
      if (time < shot.homingUntil && shot.turn > 0) {
        const k = nearestKeeper(shot.x, shot.y);
        const v = steer(shot.vx, shot.vy, k.x - shot.x, k.y - shot.y, shot.turn * dt);
        shot.vx = v.vx;
        shot.vy = v.vy;
      }
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      let hit = false;
      for (const k of keepers) {
        if (!standing(k)) continue;
        if (Math.hypot(shot.x - k.x, shot.y - k.y) > config.hero.reach / 2 + shot.radius) continue;
        hit = true;
        if (time >= k.untouchableUntil) {
          strike(k, shot.drain, { ...shot, elite: shot.kind === 'elite' }, 'shot', shot);
        }
        break;
      }
      if (hit || time >= shot.until) {
        shots[i] = shots[shots.length - 1];
        shots.pop();
        spareShots.push(shot);
      }
    }
  }

  // ------------------------------------------------------------------ the weapons

  /**
   * Homesickness from a weapon of `kind`: nothing, to a cat it passes through. An
   * elite (not a swarm's kitten) or a Mega Cat takes more by the Reading Glasses of
   * the Keeper whose weapon it is (`hero`; for what lies on the ground, player 1).
   */
  function hurt(cat: ArenaCat, amount: number, kind: WeaponKind) {
    if (cat.variety && VARIETIES[cat.variety].immuneTo?.includes(kind)) return;
    if ((cat.elite && cat.swarm === 0) || cat.variety === 'mega') amount *= hero.mods.elite;
    const given = time < cat.vulnUntil ? amount * SCORCH_FACTOR : amount;
    cat.homesickness += given;
    if (dealtTo === null) return;
    dealtTo.homesickness += given;
    cat.lastHitBy = dealtBy;
  }

  /** A weapon that is now part of a fused one he holds counts for the fused one. */
  function creditOf(id: WeaponId): WeaponId {
    const fused = FUSED_FROM.get(id);
    return fused !== undefined && hero.weapons.has(fused) ? fused : id;
  }

  /** Indices of this step's cats bigger than the cats' size (not in the grid). */
  const bigCats: number[] = [];

  /** The cats that may be within `range` of a point: the grid's, and the big ones. */
  function gather(x: number, y: number, range: number) {
    grid.query(x, y, range + config.cats.radius, near);
    for (const i of bigCats) near.push(i);
  }

  const inRange: number[] = [];
  /**
   * Every cat within `range` of a point, counting from its edge (indices), in no
   * order, into a list reused from call to call: read it before the next call.
   */
  function within(at: Vec, range: number): number[] {
    gather(at.x, at.y, range);
    inRange.length = 0;
    for (const i of near) {
      const cat = cats[i];
      const reach = range + cat.radius;
      if ((cat.x - at.x) ** 2 + (cat.y - at.y) ** 2 <= reach * reach) inRange.push(i);
    }
    return inRange;
  }

  /** The `count` nearest cats within `range` of a point, nearest first (indices). */
  function nearest(at: Vec, range: number, count: number, skip?: Set<number>): number[] {
    gather(at.x, at.y, range);
    const found: { i: number; d: number }[] = [];
    for (const i of near) {
      const cat = cats[i];
      if (skip?.has(cat.id)) continue;
      const d = (cat.x - at.x) ** 2 + (cat.y - at.y) ** 2;
      if (d <= (range + cat.radius) ** 2) found.push({ i, d });
    }
    found.sort((a, b) => a.d - b.d || a.i - b.i);
    return found.slice(0, count).map((f) => f.i);
  }

  /** A beam from `from` along (ux, uy): every cat in front, near its line, grows homesick. */
  function beam(
    from: Vec,
    ux: number,
    uy: number,
    length: number,
    width: number,
    damage: number,
    kind: WeaponKind = 'beam'
  ) {
    const to = { x: from.x + ux * length, y: from.y + uy * length };
    beams.push({ from: { ...from }, to, until: time + 180, follows: from });
    events.push({ kind: 'laser', from: { ...from }, to: { ...to } });
    gather(from.x + (ux * length) / 2, from.y + (uy * length) / 2, length / 2 + width);
    for (const i of near) {
      const cat = cats[i];
      const along = (cat.x - from.x) * ux + (cat.y - from.y) * uy;
      // (A cat right on him counts as in front: up to the same half pixel.)
      if (along < -0.5 || along > length) continue;
      const across = Math.abs((cat.x - from.x) * uy - (cat.y - from.y) * ux);
      if (across > width + cat.radius) continue;
      hurt(cat, damage, kind);
    }
  }

  /** How near a cat comes before it reaches him: its size counts. */
  const reachOf = (cat: ArenaCat) => config.hero.reach + cat.radius - config.cats.radius;

  /** The way from the hero to a point; the way he faces if it is on him. */
  function towards(at: Vec): Vec {
    const dx = at.x - hero.x;
    const dy = at.y - hero.y;
    const length = Math.hypot(dx, dy);
    return length < 0.5 ? { x: hero.facing, y: 0 } : { x: dx / length, y: dy / length };
  }

  /** The way from the hero to a cat; the way he faces if it stands on him. */
  const aim = (cat: ArenaCat): Vec => towards(cat);

  /** Between the beams or treats of one firing: they fan out round the way he aims. */
  const FAN = 0.16;

  /**
   * Aimed with a crosshair: of the cats he can reach (within `range` of him), the
   * `count` nearest the crosshair, nearest first. A far crosshair picks the cats
   * on its side of him, never one past his reach.
   */
  function nearestAimed(aimed: Vec, range: number, count: number): number[] {
    return nearest(hero, range, Infinity)
      .map((i) => ({ i, d: (cats[i].x - aimed.x) ** 2 + (cats[i].y - aimed.y) ** 2 }))
      .sort((a, b) => a.d - b.d || a.i - b.i)
      .slice(0, count)
      .map((found) => found.i);
  }

  function launch(
    p: Omit<Projectile, 'touched' | 'splits' | 'owner' | 'retargetAt'> & {
      splits?: number;
      owner?: number;
    }
  ) {
    const projectile = spareProjectiles.pop() ?? ({ touched: [] } as unknown as Projectile);
    Object.assign(projectile, p);
    projectile.splits = p.splits ?? 0;
    projectile.retargetAt = 0;
    projectile.owner = p.owner ?? hero.index;
    projectile.touched.length = 0;
    projectiles.push(projectile);
  }

  /** Fires a weapon that fires; false if it found nothing to fire at (it waits). */
  function fire(id: WeaponId, s: WeaponStats): boolean {
    const kind = WEAPONS[id].kind;
    // Aimed with a crosshair: what goes one way goes towards it, cat or no cat.
    const aimed = hero.aim;
    if (kind === 'beam' && aimed) {
      const way = Math.atan2(towards(aimed).y, towards(aimed).x);
      for (let k = 0; k < s.count; k++) {
        const turn = way + (k - (s.count - 1) / 2) * FAN;
        beam(hero, Math.cos(turn), Math.sin(turn), s.area, 16, s.damage);
      }
      return true;
    }
    if (kind === 'beam') {
      const targets = nearest(hero, s.area, s.count);
      if (targets.length === 0) return false;
      for (const i of targets) {
        const way = aim(cats[i]);
        beam(hero, way.x, way.y, s.area, 16, s.damage);
      }
      return true;
    }
    if (kind === 'chain') {
      const hit = new Set<number>();
      let from: Vec = { x: hero.x, y: hero.y };
      for (let jump = 0; jump < s.count; jump++) {
        // Aimed, the first jump goes to the cat he can reach nearest the crosshair.
        const [i] =
          jump === 0 && aimed ? nearestAimed(aimed, s.area, 1) : nearest(from, s.area, 1, hit);
        if (i === undefined) break;
        const cat = cats[i];
        hit.add(cat.id);
        hurt(cat, s.damage, 'chain');
        const to = { x: cat.x, y: cat.y };
        beams.push({ from, to, until: time + s.durationMs });
        events.push({ kind: 'laser', from, to });
        from = to;
      }
      return hit.size > 0;
    }
    if (kind === 'web') {
      // Beams at every cat near him (aimed: those he can reach nearest the
      // crosshair), each joined to the next: a web, all the time.
      const targets = aimed ? nearestAimed(aimed, s.area, s.count) : nearest(hero, s.area, s.count);
      if (targets.length === 0) return false;
      let from: Vec | null = null;
      for (const i of targets) {
        const cat = cats[i];
        const way = aim(cat);
        // Still a laser: whatever refuses lasers refuses this.
        beam(hero, way.x, way.y, s.area, 16, s.damage);
        const to = { x: cat.x, y: cat.y };
        if (from) beams.push({ from, to, until: time + s.durationMs });
        from = to;
      }
      return true;
    }
    if (kind === 'gulp') {
      const targets = within(hero, s.area);
      if (targets.length === 0) return false;
      for (const i of targets) {
        const cat = cats[i];
        const d = Math.hypot(cat.x - hero.x, cat.y - hero.y);
        const keep = Math.max(d * (1 - s.speed), reachOf(cat) + 6);
        if (d > keep) {
          cat.x = hero.x + ((cat.x - hero.x) * keep) / d;
          cat.y = hero.y + ((cat.y - hero.y) * keep) / d;
        }
      }
      hero.gulpAt = time + s.durationMs;
      hero.gulpDamage = s.damage;
      hero.gulpBy = id;
      return true;
    }
    if (kind === 'pull') {
      const targets = within(hero, s.area);
      if (targets.length === 0) return false;
      for (const i of targets) {
        const cat = cats[i];
        // Drawn in, a share of the way, but not onto him.
        const d = Math.hypot(cat.x - hero.x, cat.y - hero.y);
        const keep = Math.max(d * (1 - s.speed), reachOf(cat) + 6);
        if (d > keep) {
          cat.x = hero.x + ((cat.x - hero.x) * keep) / d;
          cat.y = hero.y + ((cat.y - hero.y) * keep) / d;
        }
        hurt(cat, s.damage, 'pull');
      }
      return true;
    }
    if (kind === 'sweep') {
      let base: number;
      if (aimed) base = Math.atan2(towards(aimed).y, towards(aimed).x);
      else {
        const [i] = nearest(hero, s.area, 1);
        if (i === undefined) return false;
        base = Math.atan2(aim(cats[i]).y, aim(cats[i]).x);
      }
      // So many sectors, evenly round him; from four they tile the circle.
      const half = Math.min(0.95, Math.PI / s.count);
      for (let k = 0; k < s.count; k++) {
        sweeps.push({
          x: hero.x,
          y: hero.y,
          angle: base + (k * 2 * Math.PI) / s.count,
          reach: s.area,
          half,
          until: time + 240,
        });
      }
      for (const i of within(hero, s.area)) {
        const cat = cats[i];
        const toCat = Math.atan2(cat.y - hero.y, cat.x - hero.x);
        let struck = false;
        for (let k = 0; k < s.count && !struck; k++) {
          const turn = base + (k * 2 * Math.PI) / s.count;
          const apart = Math.abs(Math.atan2(Math.sin(toCat - turn), Math.cos(toCat - turn)));
          struck = apart <= half;
        }
        if (!struck) continue;
        hurt(cat, s.damage, 'sweep');
        // Knocked back, but not the big ones.
        if (cat.radius <= config.cats.radius * 1.5) {
          const d = Math.hypot(cat.x - hero.x, cat.y - hero.y) || 1;
          cat.x += ((cat.x - hero.x) / d) * s.speed;
          cat.y += ((cat.y - hero.y) / d) * s.speed;
        }
        // The Peacock Tail strikes them still; the Cast-Iron Skillet dazes them.
        if (
          (id === 'peacock-tail' || id === 'cast-iron-skillet') &&
          cat.radius <= config.cats.radius * 1.5
        ) {
          cat.stunUntil = Math.max(cat.stunUntil, time + s.durationMs);
        }
      }
      return true;
    }
    if (kind === 'lure') {
      let at: Vec;
      if (aimed && Math.hypot(aimed.x - hero.x, aimed.y - hero.y) <= 650) at = aimed;
      else {
        const [i] = nearest(hero, 450, 1);
        if (i === undefined) return false;
        at = { x: cats[i].x, y: cats[i].y };
      }
      for (let k = 0; k < s.count; k++) {
        // The first on the spot, the rest in a ring round it.
        const turn = (k * 2 * Math.PI) / s.count;
        const ring = k === 0 ? 0 : 50;
        addPatch({
          kind: 'toy',
          weapon: id,
          x: at.x + Math.cos(turn) * ring,
          y: at.y + Math.sin(turn) * ring,
          radius: s.area,
          reach: s.speed,
          until: time + s.durationMs,
          damage: s.damage,
          capacity: 0,
          finale: id === 'squeak-symphony' ? s.damage * 8 : 0,
          moat: false,
        });
      }
      return true;
    }
    if (kind === 'trap') {
      const targets = nearest(hero, 520, s.count);
      if (targets.length === 0) return false;
      for (const i of targets) {
        addPatch({
          kind: 'box',
          weapon: id,
          x: cats[i].x,
          y: cats[i].y,
          radius: s.area,
          reach: 0,
          until: time + s.durationMs,
          damage: s.damage,
          capacity: s.pierce,
          finale: 0,
          moat: id === 'cardboard-castle',
        });
      }
      return true;
    }
    if (kind === 'swat') {
      const targets = aimed ? nearestAimed(aimed, s.area, s.count) : nearest(hero, s.area, s.count);
      if (targets.length === 0) return false;
      for (const i of targets) {
        const cat = cats[i];
        const way = aim(cat);
        swats.push({ x: hero.x, y: hero.y, angle: Math.atan2(way.y, way.x), until: time + 240 });
        hurt(cat, s.damage, 'swat');
        // Sent flying, but not the big ones: `speed` px over `durationMs`.
        if (cat.radius > config.cats.radius * 1.5) continue;
        const flight = Math.max(s.durationMs, 1) / 1000;
        cat.flungUntil = time + s.durationMs;
        cat.flungVx = (way.x * s.speed) / flight;
        cat.flungVy = (way.y * s.speed) / flight;
        cat.flungDamage = s.damage * SWAT_BOWL_SHARE;
        cat.flungBy = id;
        cat.flungHits.length = 0;
        cat.flungHits.push(cat.id);
      }
      return true;
    }
    if (kind === 'cling') {
      const [i] = aimed
        ? nearestAimed(aimed, SOCK_THROW_RANGE, 1)
        : nearest(hero, SOCK_THROW_RANGE, 1);
      if (i === undefined) return false;
      if (socks.length >= SOCK_CAP) {
        socks.shift();
        sockHosts.shift();
      }
      const host = cats[i];
      socks.push({
        weapon: id,
        host: host.id,
        x: host.x,
        y: host.y,
        sparksLeft: s.count,
        nextAt: time + SOCK_SPARK_MS,
        damage: s.damage,
        area: s.area,
        showMs: s.durationMs,
        owner: hero.index,
      });
      sockHosts.push(host);
      return true;
    }
    const base = { weapon: id, bit: false, x: hero.x, y: hero.y, radius: s.area, damage: s.damage };
    if (kind === 'spread' || kind === 'burst' || kind === 'boomerang' || kind === 'scare') {
      let way: Vec;
      if (aimed) way = towards(aimed);
      else {
        const [i] = nearest(hero, 650, 1);
        if (i === undefined) return false;
        way = aim(cats[i]);
      }
      const angle = Math.atan2(way.y, way.x);
      const shots = kind === 'burst' || kind === 'scare' ? 1 : s.count;
      for (let k = 0; k < shots; k++) {
        const turn = angle + (k - (shots - 1) / 2) * FAN;
        launch({
          ...base,
          vx: Math.cos(turn) * s.speed,
          vy: Math.sin(turn) * s.speed,
          pierce: s.pierce,
          // A boomerang turns home halfway, and may take as long again to come back.
          until: time + (kind === 'boomerang' ? s.durationMs * 2 : s.durationMs),
          splits: kind === 'boomerang' ? 1 : 0,
        });
        if (kind === 'boomerang')
          projectiles[projectiles.length - 1].retargetAt = time + s.durationMs / 2;
      }
      return true;
    }
    if (kind === 'arc') {
      // A wide arc, the way he faces (aimed: towards the crosshair).
      const facing = aimed
        ? Math.atan2(towards(aimed).y, towards(aimed).x)
        : hero.facing > 0
          ? 0
          : Math.PI;
      const spread = Math.PI * 0.6;
      for (let k = 0; k < s.count; k++) {
        const turn = facing + (k / Math.max(s.count - 1, 1) - 0.5) * spread;
        launch({
          ...base,
          radius: 6 + s.area / 20,
          vx: Math.cos(turn) * s.speed,
          vy: Math.sin(turn) * s.speed,
          pierce: s.pierce,
          until: time + (s.durationMs * s.area) / 70,
          // Monsoon: every eighth droplet leaves a puddle where it ends.
          splits: id === 'monsoon' && k % 8 === 0 ? 1 : 0,
        });
      }
      return true;
    }
    if (kind === 'bounce') {
      for (let k = 0; k < s.count; k++) {
        // Any way at all; aimed, within a quarter turn of the crosshair's way.
        const turn = aimed
          ? Math.atan2(towards(aimed).y, towards(aimed).x) + (random.next() - 0.5) * (Math.PI / 2)
          : random.next() * 2 * Math.PI;
        launch({
          ...base,
          vx: Math.cos(turn) * s.speed,
          vy: Math.sin(turn) * s.speed,
          pierce: Infinity,
          until: time + s.durationMs,
          // The Yarn Apocalypse's "pierce" is how often each ball splits.
          splits: id === 'yarn-apocalypse' ? s.pierce : 0,
        });
      }
      return true;
    }
    return true;
  }

  /** The Can Opener's blades round him, now. */
  function bladesOf(s: WeaponStats): Vec[] {
    return Array.from({ length: s.count }, (_, k) => {
      const angle = (time / 1000) * s.speed + (k * 2 * Math.PI) / s.count;
      return { x: hero.x + Math.cos(angle) * s.area, y: hero.y + Math.sin(angle) * s.area };
    });
  }

  function addPatch(patch: Patch) {
    if (patches.length >= PATCH_CAP) patches.shift();
    patches.push(patch);
  }

  /** The Hair Dryer's jets this step: cats in them are blown back, and hurt, all the time. */
  function blowAir(id: WeaponId, s: WeaponStats, dt: number) {
    let base: number;
    if (hero.aim) base = Math.atan2(towards(hero.aim).y, towards(hero.aim).x);
    else {
      // The nearest cat is looked for five times a second; between, the jet holds its way.
      if (time >= hero.jetAt) {
        hero.jetAt = time + 200;
        const [i] = nearest(hero, s.area * 1.4, 1);
        hero.jetAngle =
          i === undefined
            ? hero.facing > 0
              ? 0
              : Math.PI
            : Math.atan2(aim(cats[i]).y, aim(cats[i]).x);
      }
      base = hero.jetAngle;
    }
    const first = jets.length;
    for (let k = 0; k < s.count; k++) {
      jets.push({
        x: hero.x,
        y: hero.y,
        angle: base + (k * 2 * Math.PI) / s.count,
        reach: s.area,
        half: 0.5,
      });
    }
    for (const i of within(hero, s.area)) {
      const cat = cats[i];
      const toCat = Math.atan2(cat.y - hero.y, cat.x - hero.x);
      let inside = false;
      for (let k = first; k < jets.length && !inside; k++) {
        const apart = Math.abs(
          Math.atan2(Math.sin(toCat - jets[k].angle), Math.cos(toCat - jets[k].angle))
        );
        inside = apart <= jets[k].half;
      }
      if (!inside) continue;
      hurt(cat, s.damage * dt, 'blow');
      if (cat.radius <= config.cats.radius * 1.5) {
        const d = Math.hypot(cat.x - hero.x, cat.y - hero.y) || 1;
        cat.x += ((cat.x - hero.x) / d) * s.speed * dt;
        cat.y += ((cat.y - hero.y) / d) * s.speed * dt;
      }
      if (id === 'scorch-dryer') cat.vulnUntil = time + 2500;
    }
  }

  /** Each swatted cat in flight hurts the cats it lands among, each once. */
  function bowl() {
    for (const i of flying) {
      const cat = cats[i];
      for (const j of within(cat, cat.radius)) {
        const other = cats[j];
        // (Itself first in the list, then those it has bowled over.)
        if (cat.flungHits.length > SWAT_BOWL_MAX) break;
        if (cat.flungHits.includes(other.id)) continue;
        cat.flungHits.push(other.id);
        deal(cat.flungBy);
        hurt(other, cat.flungDamage, 'swat');
      }
    }
  }

  /** Whether `cat` is still the live cat with this id (sent home, its object waits for reuse). */
  const isLive = (cat: ArenaCat | undefined, id: number) =>
    cat !== undefined && cat.id === id && cat.homesickness < cat.limit;

  /**
   * The nearest cat within `range` of a point, other than `not`, that is not already going
   * home (homesick enough, it stays in the list until this step's sweepHome).
   */
  function nearestLive(at: Vec, range: number, not: ArenaCat | undefined): ArenaCat | null {
    for (const i of nearest(at, range, 8)) {
      const cat = cats[i];
      if (cat !== not && cat.homesickness < cat.limit) return cat;
    }
    return null;
  }

  /**
   * Each Static Sock goes where its cat goes and sparks when it is time: its cat, and
   * the nearest other cat within its reach. A sock whose cat was sent home leaps to
   * the nearest cat; with none near, or its sparks spent, it falls off.
   */
  function updateSocks() {
    for (let n = socks.length - 1; n >= 0; n--) {
      const sock = socks[n];
      let host = sockHosts[n];
      if (!isLive(host, sock.host)) {
        const next = nearestLive(sock, sock.area, host);
        if (!next) {
          socks.splice(n, 1);
          sockHosts.splice(n, 1);
          continue;
        }
        host = next;
        sockHosts[n] = host;
        sock.host = host.id;
      }
      sock.x = host.x;
      sock.y = host.y;
      if (time < sock.nextAt) continue;
      sock.nextAt = time + SOCK_SPARK_MS;
      hero = keepers[sock.owner] ?? keepers[0];
      deal(sock.weapon);
      hurt(host, sock.damage, 'cling');
      const friend = nearestLive(sock, sock.area, host);
      if (friend) {
        hurt(friend, sock.damage, 'cling');
        const from = { x: host.x, y: host.y };
        const to = { x: friend.x, y: friend.y };
        beams.push({ from, to, until: time + sock.showMs });
        events.push({ kind: 'laser', from, to });
      }
      if (--sock.sparksLeft <= 0) {
        socks.splice(n, 1);
        sockHosts.splice(n, 1);
      }
    }
    hero = keepers[0];
  }

  /** A Cucumber seen where it lands: the small cats round it run (its slices do the hurting). */
  function startle(p: Projectile) {
    const owner = keepers[p.owner];
    const s = weaponStats(p.weapon, owner.weapons.get(p.weapon)?.level ?? 1, owner.mods);
    for (const i of within(p, s.area * SCARE_REACH)) {
      const cat = cats[i];
      if (cat.radius > config.cats.radius * 1.5) continue;
      cat.fleeUntil = Math.max(cat.fleeUntil, time + s.durationMs);
      cat.fleeX = p.x;
      cat.fleeY = p.y;
    }
  }

  /** What his weapons set down works, and gives out. */
  function updatePatches(dt: number) {
    for (let n = patches.length - 1; n >= 0; n--) {
      const p = patches[n];
      deal(p.weapon);
      if (time >= p.until) {
        if (p.finale > 0) {
          for (const i of within(p, p.radius * 1.6)) hurt(cats[i], p.finale, 'lure');
        }
        patches.splice(n, 1);
        continue;
      }
      if (p.kind === 'toy') {
        for (const i of within(p, p.radius)) hurt(cats[i], p.damage * dt, 'lure');
      } else if (p.kind === 'puddle') {
        for (const i of within(p, p.radius)) {
          hurt(cats[i], p.damage * dt, 'burst');
          cats[i].slowUntil = Math.max(cats[i].slowUntil, time + 100);
        }
      } else {
        // A box takes the cats in it, up to its capacity, and keeps them.
        let held = 0;
        for (const i of within(p, p.radius)) {
          const cat = cats[i];
          if (held >= p.capacity) break;
          if (cat.radius > config.cats.radius * 1.5) continue;
          held++;
          cat.stunUntil = Math.max(cat.stunUntil, time + 100);
          hurt(cat, p.damage * dt, 'trap');
        }
        if (p.moat) {
          for (const i of within(p, p.radius * 2)) {
            cats[i].slowUntil = Math.max(cats[i].slowUntil, time + 100);
          }
        }
      }
    }
    for (let n = sweeps.length - 1; n >= 0; n--) {
      if (time >= sweeps[n].until) sweeps.splice(n, 1);
    }
    for (let n = swats.length - 1; n >= 0; n--) {
      if (time >= swats[n].until) swats.splice(n, 1);
    }
  }

  /** How far the weapons that go for the nearest cat look for it, px, by kind (null: they do not aim). */
  function lookRange(id: WeaponId, s: WeaponStats): number | null {
    switch (WEAPONS[id].kind) {
      case 'beam':
      case 'chain':
      case 'web':
      case 'sweep':
      case 'swat':
        return s.area;
      case 'spread':
      case 'burst':
      case 'boomerang':
      case 'scare':
        return 650;
      case 'cling':
        return SOCK_THROW_RANGE;
      case 'lure':
        return 450;
      case 'trap':
        return 520;
      case 'blow':
        // Where the jet looks for a cat (blowAir): the tool points where the air goes.
        return s.area * 1.4;
      default:
        return null;
    }
  }

  /** Where this Keeper looks: the crosshair, else the cat his first aiming weapon would fire at. */
  function updateAim() {
    if (hero.aim) {
      hero.aimAngle = Math.atan2(towards(hero.aim).y, towards(hero.aim).x);
      return;
    }
    if (time < hero.lookAt) return;
    hero.lookAt = time + 200;
    hero.aimAngle = null;
    for (const [id, held] of activeWeapons(hero)) {
      const range = lookRange(id, weaponStats(id, held.level, hero.mods));
      if (range === null) continue;
      const [i] = nearest(hero, range, 1);
      if (i !== undefined) {
        const way = aim(cats[i]);
        hero.aimAngle = Math.atan2(way.y, way.x);
      }
      return;
    }
  }

  /** One weapon, this step: blades and zones all the time, the rest when they are ready. */
  function runWeapon(id: WeaponId, held: { level: number; readyAt: number }, dt: number) {
    deal(id);
    const s = weaponStats(id, held.level, hero.mods);
    const kind = WEAPONS[id].kind;
    if (kind === 'orbit') {
      // Each blade, all the time, to every cat it passes through.
      for (const blade of bladesOf(s)) {
        for (const i of within(blade, BLADE_RADIUS)) {
          hurt(cats[i], s.damage * dt, 'orbit');
          // The Heatwave Fan's blades scorch what they touch.
          if (id === 'heatwave-fan') {
            cats[i].vulnUntil = Math.max(cats[i].vulnUntil, time + HEATWAVE_SCORCH_MS);
          }
        }
      }
      // The Bottomless Saucer also spills: a wave of milk from each saucer, outward.
      if (id === 'bottomless-saucer' && time >= hero.waveAt) {
        hero.waveAt = time + MILK_WAVE_EVERY_MS;
        for (const saucer of bladesOf(s)) {
          const out = Math.atan2(saucer.y - hero.y, saucer.x - hero.x);
          launch({
            weapon: id,
            bit: true,
            x: saucer.x,
            y: saucer.y,
            vx: Math.cos(out) * MILK_WAVE_SPEED,
            vy: Math.sin(out) * MILK_WAVE_SPEED,
            radius: 16,
            damage: s.damage * 0.5,
            pierce: 6,
            until: time + 800,
          });
        }
      }
    } else if (kind === 'zone') {
      for (const i of within(hero, s.area)) {
        hurt(cats[i], s.damage * dt, 'zone');
        // Near the Grandfather Clock, time drags: the cats slow.
        if (id === 'grandfather-clock') cats[i].slowUntil = Math.max(cats[i].slowUntil, time + 100);
      }
    } else if (kind === 'blow') {
      blowAir(id, s, dt);
    } else if (time >= held.readyAt && fire(id, s)) {
      held.readyAt = time + s.cooldownMs;
      events.push({ kind: 'fired', weapon: id });
    }
  }

  /** What a fused weapon adds to what its two parents go on doing. */
  function fusedExtra(id: WeaponId, held: Held) {
    if (time < held.readyAt) return;
    deal(id);
    const s = weaponStats(id, held.level, hero.mods);
    if (id === 'thunderstorm') {
      // Lightning: the wet (slowed) cats first, then the nearest.
      const near = nearest(hero, s.area, Infinity);
      if (near.length === 0) return;
      const wet = near.filter((i) => cats[i].slowUntil > time);
      const dry = near.filter((i) => cats[i].slowUntil <= time);
      for (const i of [...wet, ...dry].slice(0, s.count)) {
        // Lightning is still a laser's: whatever refuses lasers refuses it.
        hurt(cats[i], s.damage, 'beam');
        beams.push({
          from: { x: hero.x, y: hero.y },
          to: { x: cats[i].x, y: cats[i].y },
          until: time + s.durationMs,
        });
      }
    } else if (id === 'scorching-maw') {
      // Everything the pull reaches is scorched.
      const reached = within(hero, s.area);
      if (reached.length === 0) return;
      for (const i of reached) cats[i].vulnUntil = Math.max(cats[i].vulnUntil, time + s.durationMs);
    } else if (id === 'yarn-feast') {
      // The whole table goes after the cats: a ring of crumbs that chase.
      if (nearest(hero, 650, 1).length === 0) return;
      for (let k = 0; k < s.count; k++) {
        const turn = (k * 2 * Math.PI) / s.count;
        launch({
          weapon: 'banquet',
          bit: true,
          x: hero.x,
          y: hero.y,
          vx: Math.cos(turn) * s.speed,
          vy: Math.sin(turn) * s.speed,
          radius: s.area,
          damage: s.damage,
          pierce: s.pierce,
          until: time + s.durationMs,
        });
      }
    } else if (id === 'grand-slam') {
      // The court lights up: a spark from him to each of the nearest cats.
      const near = nearest(hero, s.area, s.count);
      if (near.length === 0) return;
      for (const i of near) {
        hurt(cats[i], s.damage, 'chain');
        const to = { x: cats[i].x, y: cats[i].y };
        beams.push({ from: { x: hero.x, y: hero.y }, to, until: time + s.durationMs });
      }
    } else if (id === 'kitchen-sink') {
      // Pickles all round him, outward.
      if (nearest(hero, 650, 1).length === 0) return;
      for (let k = 0; k < s.count; k++) {
        const turn = (k * 2 * Math.PI) / s.count;
        launch({
          weapon: 'pickle-jar',
          bit: true,
          x: hero.x,
          y: hero.y,
          vx: Math.cos(turn) * s.speed,
          vy: Math.sin(turn) * s.speed,
          radius: s.area,
          damage: s.damage,
          pierce: s.pierce,
          until: time + s.durationMs,
        });
      }
    } else if (id === 'clockwork-gale') {
      // A moment that will not pass: every cat near him stands still (not the big ones).
      const reached = within(hero, s.area);
      if (reached.length === 0) return;
      for (const i of reached) {
        const cat = cats[i];
        hurt(cat, s.damage, 'zone');
        if (cat.radius <= config.cats.radius * 1.5) {
          cat.stunUntil = Math.max(cat.stunUntil, time + s.durationMs);
        }
      }
    } else if (id === 'milk-symphony') {
      // Every toy in earshot spills milk, outward.
      const toys = patches.filter((p) => p.kind === 'toy');
      if (toys.length === 0) return;
      for (const toy of toys) {
        for (let k = 0; k < s.count; k++) {
          const turn = (k * 2 * Math.PI) / s.count;
          launch({
            weapon: 'bottomless-saucer',
            bit: true,
            x: toy.x,
            y: toy.y,
            vx: Math.cos(turn) * s.speed,
            vy: Math.sin(turn) * s.speed,
            radius: s.area,
            damage: s.damage,
            pierce: s.pierce,
            until: time + s.durationMs,
          });
        }
      }
    }
    held.readyAt = time + s.cooldownMs;
  }

  /** Every weapon he holds that works by itself, a fused one as its two parents. */
  function* activeWeapons(k: Keeper): Generator<[WeaponId, { level: number; readyAt: number }]> {
    for (const [id, held] of k.weapons) {
      if (held.parts) yield* held.parts;
      else yield [id, held];
    }
  }

  function swingWeapons(dt: number) {
    updateAim();
    deal(null);
    if (time >= hero.gulpAt) {
      hero.gulpAt = Infinity;
      deal(hero.gulpBy);
      for (const i of within(hero, GULP_BURST_RADIUS * hero.mods.area)) {
        hurt(cats[i], hero.gulpDamage, 'gulp');
      }
    }
    for (const [id, held] of hero.weapons) {
      if (held.parts) {
        for (const [part, partHeld] of held.parts) runWeapon(part, partHeld, dt);
        fusedExtra(id, held);
      } else runWeapon(id, held, dt);
    }
  }

  function yarnApocalypseBalls() {
    let n = 0;
    for (const p of projectiles) if (p.weapon === 'yarn-apocalypse') n++;
    return n;
  }

  function moveProjectiles(dt: number) {
    const cam = camera();
    const w = viewport.width * cam.zoom;
    const h = viewport.height * cam.zoom;
    const left = cam.x - w / 2;
    const top = cam.y - h / 2;
    for (let n = projectiles.length - 1; n >= 0; n--) {
      const p = projectiles[n];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // A Banquet crumb goes for the nearest cat it has not touched, looking afresh now and then.
      if (p.bit && p.weapon === 'banquet' && time >= p.retargetAt) {
        p.retargetAt = time + 120;
        // The nearest cat it has not touched (one pass, nothing allocated).
        gather(p.x, p.y, 320);
        let best = -1;
        let bestD = 320 * 320;
        for (const i of near) {
          const c = cats[i];
          if (p.touched.includes(c.id)) continue;
          const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
        if (best >= 0) {
          const d = Math.sqrt(bestD) || 1;
          p.vx = ((cats[best].x - p.x) / d) * 380;
          p.vy = ((cats[best].y - p.y) / d) * 380;
        }
      }
      if (p.weapon === 'yarn-ball' || p.weapon === 'yarn-apocalypse') {
        // Off the edges of the screen, as he walks.
        let bounced = false;
        if (p.x < left || p.x > left + w) {
          p.vx = Math.sign(cam.x - p.x) * Math.abs(p.vx);
          bounced = true;
        }
        if (p.y < top || p.y > top + h) {
          p.vy = Math.sign(cam.y - p.y) * Math.abs(p.vy);
          bounced = true;
        }
        // The Apocalypse's balls split in two where they bounce, up to a limit.
        if (bounced && p.splits > 0 && yarnApocalypseBalls() < YARN_APOCALYPSE_CAP) {
          p.splits--;
          // The other half goes off at a right angle, but back onto the screen.
          let vx = -p.vy;
          let vy = p.vx;
          if (p.x < left || p.x > left + w) vx = Math.sign(cam.x - p.x) * Math.abs(vx);
          if (p.y < top || p.y > top + h) vy = Math.sign(cam.y - p.y) * Math.abs(vy);
          launch({
            weapon: p.weapon,
            bit: false,
            x: p.x,
            y: p.y,
            vx,
            vy,
            radius: p.radius,
            damage: p.damage,
            pierce: Infinity,
            until: p.until,
            splits: p.splits,
            owner: p.owner,
          });
        }
      }
      // Its Keeper's passives count where it lands (hurt), and its weapon is credited.
      hero = keepers[p.owner] ?? keepers[0];
      deal(p.weapon);
      const kind = WEAPONS[p.weapon].kind;
      if (kind === 'boomerang') {
        // Halfway, it turns for his hand, and may touch every cat again on the way back.
        if (p.splits > 0 && time >= p.retargetAt) {
          p.splits = 0;
          p.touched.length = 0;
          p.pierce = weaponStats(
            p.weapon,
            hero.weapons.get(p.weapon)?.level ?? 1,
            hero.mods
          ).pierce;
        }
        if (p.splits === 0) {
          const dx = hero.x - p.x;
          const dy = hero.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d < 24) p.until = time;
          else {
            const v = Math.hypot(p.vx, p.vy);
            p.vx = (dx / d) * v;
            p.vy = (dy / d) * v;
          }
        }
      }
      for (const i of within(p, p.radius)) {
        const cat = cats[i];
        if (p.pierce <= 0 || p.touched.includes(cat.id)) continue;
        p.touched.push(cat.id);
        hurt(cat, p.damage, WEAPONS[p.weapon].kind);
        // The Yarn Apocalypse's balls tangle the cats they pass through.
        if (p.weapon === 'yarn-apocalypse')
          cat.slowUntil = Math.max(cat.slowUntil, time + TANGLE_MS);
        p.pierce--;
      }
      // A boomerang spent on cats still comes back: only its time ends it.
      if ((p.pierce <= 0 && kind !== 'boomerang') || time >= p.until) {
        // A Cucumber is seen where it ends, and bursts into slices as a hairball does.
        if (kind === 'scare' && !p.bit) startle(p);
        // A hairball (or a tub) bursts into smaller ones where it ends.
        if ((kind === 'burst' || kind === 'scare') && !p.bit) {
          const owner = keepers[p.owner];
          const s = weaponStats(p.weapon, owner.weapons.get(p.weapon)?.level ?? 1, owner.mods);
          if (p.weapon === 'jacuzzi') {
            addPatch({
              kind: 'puddle',
              weapon: p.weapon,
              x: p.x,
              y: p.y,
              radius: PUDDLE_RADIUS,
              reach: 0,
              until: time + PUDDLE_MS,
              damage: s.damage / 3,
              capacity: 0,
              finale: 0,
              moat: false,
            });
          }
          for (let k = 0; k < s.count; k++) {
            const turn = (k * 2 * Math.PI) / s.count;
            launch({
              weapon: p.weapon,
              owner: p.owner,
              bit: true,
              x: p.x,
              y: p.y,
              vx: Math.cos(turn) * s.speed * 0.8,
              vy: Math.sin(turn) * s.speed * 0.8,
              radius: p.radius * 0.6,
              damage: p.damage * 0.6,
              pierce: 2,
              until: time + 500,
            });
          }
        }
        // A Banquet treat that fed a cat leaves a crumb that goes after another.
        if (
          p.weapon === 'banquet' &&
          !p.bit &&
          p.touched.length > 0 &&
          projectiles.length < CRUMB_LIMIT
        ) {
          launch({
            weapon: 'banquet',
            owner: p.owner,
            bit: true,
            x: p.x,
            y: p.y,
            vx: 0,
            vy: 0,
            radius: p.radius * 0.7,
            damage: p.damage * 0.5,
            pierce: 2,
            until: time + 900,
          });
          // It knows the cats its treat fed: it goes after another.
          projectiles[projectiles.length - 1].touched.push(...p.touched);
        }
        // A Monsoon droplet marked for it leaves a puddle that slows the cats in it.
        if (p.weapon === 'monsoon' && p.splits > 0) {
          addPatch({
            kind: 'puddle',
            weapon: p.weapon,
            x: p.x,
            y: p.y,
            radius: RAIN_PUDDLE_RADIUS,
            reach: 0,
            until: time + RAIN_PUDDLE_MS,
            damage: p.damage / 3,
            capacity: 0,
            finale: 0,
            moat: false,
          });
        }
        projectiles[n] = projectiles[projectiles.length - 1];
        projectiles.pop();
        spareProjectiles.push(p);
      }
    }
    hero = keepers[0];
  }

  // --------------------------------------------------------------- experience

  /** Pickups lying about are drawn in like gems; taken, they work. */
  function gatherPickups(dt: number) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      if (time >= p.until) {
        pickups.splice(i, 1);
        continue;
      }
      const k = nearestKeeper(p.x, p.y);
      const dx = k.x - p.x;
      const dy = k.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 14) {
        if (d <= config.gems.pickup * k.mods.pickup) {
          // Slower than a gem, so there is time to see it.
          const move = Math.min(config.gems.speed * 0.6 * dt, d);
          p.x += (dx / d) * move;
          p.y += (dy / d) * move;
        }
        continue;
      }
      pickups.splice(i, 1);
      pickupsTaken++;
      lastPickup = p.kind;
      events.push({ kind: 'pickup-taken', pickup: p.kind, player: k.index });
      if (p.kind === 'fish') {
        k.resolve = Math.min(
          k.resolve + config.pickups.fishShare * maxResolveOf(k),
          maxResolveOf(k)
        );
      } else if (p.kind === 'magnet') {
        magnetUntil = time + config.pickups.magnetMs;
      } else {
        // The cats on the screen stop (the big ones, a Mega Cat, are not stopped by a bell).
        const cam = camera();
        const reach = (Math.hypot(viewport.width, viewport.height) / 2) * cam.zoom;
        for (const cat of cats) {
          if (cat.radius > config.cats.radius * 1.5) continue;
          if (Math.hypot(cat.x - cam.x, cat.y - cam.y) > reach) continue;
          cat.stunUntil = Math.max(cat.stunUntil, time + config.pickups.bellMs);
        }
      }
    }
  }

  function gatherGems(dt: number) {
    for (let i = gems.length - 1; i >= 0; i--) {
      const gem = gems[i];
      const k = nearestKeeper(gem.x, gem.y);
      const reach = time < magnetUntil ? Infinity : config.gems.pickup * k.mods.pickup;
      const dx = k.x - gem.x;
      const dy = k.y - gem.y;
      const d = Math.hypot(dx, dy);
      if (d <= 14) {
        xp += gem.value * k.mods.xp;
        gems[i] = gems[gems.length - 1];
        gems.pop();
      } else if (d <= reach) {
        const move = Math.min(config.gems.speed * dt, d);
        gem.x += (dx / d) * move;
        gem.y += (dy / d) * move;
      }
    }
    while (xp >= xpToNext(level)) {
      xp -= xpToNext(level);
      level++;
      pending++;
      // A Hot Water Bottle gives some Resolve back at each level.
      for (const k of keepers) {
        if (standing(k) && k.mods.levelHeal > 0) {
          k.resolve = Math.min(k.resolve + k.mods.levelHeal, maxResolveOf(k));
        }
      }
      events.push({ kind: 'level-up', level });
    }
    for (let i = chests.length - 1; i >= 0; i--) {
      const chest = chests[i];
      const opener = keepers.find(
        (k) => standing(k) && Math.hypot(chest.x - k.x, chest.y - k.y) <= config.chestReach
      );
      if (!opener) continue;
      // Whoever opens it: his weapon may evolve.
      hero = opener;
      chests.splice(i, 1);
      // A golden chest holds 1, 3 or 5 rewards; a plain one, one.
      let rewards = 1;
      if (chest.golden) {
        const { rewards: counts, weights } = config.bossHome;
        let roll = random.next() * weights.reduce((sum, w) => sum + w, 0);
        rewards = counts[counts.length - 1];
        for (let k = 0; k < counts.length; k++) {
          roll -= weights[k];
          if (roll < 0) {
            rewards = counts[k];
            break;
          }
        }
      }
      const opened = { kind: 'chest' as const, x: chest.x, y: chest.y, golden: chest.golden };
      // Before what the rewards bring (an evolution's announcement comes after the chest).
      const event = { ...opened, rewards, picks: 0 };
      events.push(event);
      for (let k = 0; k < rewards; k++) if (reward()) event.picks++;
    }
    hero = keepers[0];
    if (pending > 0 && !choosing) offer();
  }

  /**
   * One reward from a chest, for `hero`: two evolved weapons that fuse do, in their
   * place; else a weapon ready to evolve does; otherwise a level-up, while there is
   * something left to upgrade. A reward with nothing left for it is nothing: false.
   */
  function reward(): boolean {
    const carried = new Map([...hero.weapons].map(([id, w]) => [id, w.level] as const));
    const fusion = fusionFor(carried);
    const evolution = fusion ? null : evolutionFor(carried, hero.passives);
    if (fusion) {
      const parts = new Map(
        fusion.from.map((id) => [id, { level: MAX_WEAPON_LEVEL, readyAt: time }] as const)
      );
      for (const id of fusion.from) hero.weapons.delete(id);
      hero.weapons.set(fusion.to, { level: MAX_WEAPON_LEVEL, readyAt: time, parts });
      everHeld.add(fusion.to);
      events.push({ kind: 'fusion', from: fusion.from, to: fusion.to });
    } else if (evolution) {
      hero.weapons.delete(evolution.from);
      hero.weapons.set(evolution.to, { level: MAX_WEAPON_LEVEL, readyAt: time });
      // The passive becomes part of it, at its highest level, and frees its slot.
      hero.passives.delete(evolution.with);
      hero.absorbed.set(evolution.with, PASSIVES[evolution.with].maxLevel);
      remod(hero);
      everHeld.add(evolution.to);
      events.push({ kind: 'evolution', from: evolution.from, to: evolution.to });
    } else if (keepers.some((k) => standing(k) && upgradesLeftOf(k) > pending)) pending++;
    else return false;
    return true;
  }

  /** How many level-ups a Keeper could still use (arsenal.ts, upgradesLeft). */
  function upgradesLeftOf(k: Keeper) {
    const held = new Map([...k.weapons].map(([id, w]) => [id, w.level] as const));
    return upgradesLeft(held, k.passives, config.availableWeapons, slots);
  }

  /** A Keeper's passives changed: his modifiers again, the Resolve added, and the Loaded Dice's rerolls. */
  function remod(k: Keeper) {
    const before = maxResolveOf(k);
    const rerollsBefore = k.mods.rerolls;
    k.mods = boosted(modifiers(new Map([...k.passives, ...k.absorbed])));
    k.resolve += maxResolveOf(k) - before;
    k.rerollsLeft += k.mods.rerolls - rerollsBefore;
  }

  /** After a Keeper's choice or skip: the next player chooses for the same level, then the next level. */
  function nextChooser() {
    if (chooser + 1 < keepers.length) chooser++;
    else {
      chooser = 0;
      pending--;
    }
    if (pending > 0) offer();
  }

  /**
   * The waiting level-up's choices, for the Keeper whose turn it is. One with
   * nothing left to learn is not asked (the run does not stop for him): a sip of
   * Resolve, and the turn passes.
   */
  function offer() {
    const k = keepers[chooser];
    const held = new Map([...k.weapons].map(([id, w]) => [id, w.level] as const));
    choosing = offerChoices(
      held,
      k.passives,
      k.mods.choices,
      random,
      config.availableWeapons,
      slots
    );
    if (choosing.length > 0) return;
    choosing = null;
    k.resolve = Math.min(k.resolve + 30, maxResolveOf(k));
    nextChooser();
  }

  return {
    config,

    resize(size: { width: number; height: number }) {
      viewport = size;
    },

    /**
     * Player 1 aims at `point` in the arena (the crosshair, desktop only), or, with
     * null, his weapons find their own cats again. The vacuums and the blades that
     * circle him never aim, so it changes nothing for them.
     */
    aimAt(point: Vec | null) {
      keepers[0].aim = point && { x: point.x, y: point.y };
    },

    /**
     * One step of `config.stepMs`: the hero walks the way `input` points (a unit
     * vector, or zero), and in co-op player 2 the way `input2` does; cats come
     * (while `spawn` allows), walk, reach them or are sent home. Nothing moves while
     * a level-up's choice waits.
     */
    step(input: Vec, spawn = true, input2: Vec = { x: 0, y: 0 }) {
      if (status === 'over' || choosing) return;
      const dt = config.stepMs / 1000;
      time += config.stepMs;
      for (const k of keepers) {
        if (!standing(k)) continue;
        hero = k;
        const from = { x: k.x, y: k.y };
        heroStep(k.index === 0 ? input : input2, dt);
        tether(k, from);
        k.resolve = Math.min(k.resolve + k.mods.recovery * dt, maxResolve());
      }
      hero = keepers[0];

      // Arrivals: towards how many the arena wants now, a share a second at most.
      // While the frame-rate guard says no, only up to `guardFree`.
      const wanted = Math.min(
        catsWanted(time, config.escalation),
        config.cats.hardCap,
        spawn ? Infinity : config.cats.guardFree
      );
      spawnEvents(spawn);
      // The secret cat, once, to Keepers who have stood still long enough.
      const still =
        input.x === 0 &&
        input.y === 0 &&
        (keepers.length === 1 || (input2.x === 0 && input2.y === 0));
      stillFor = still ? stillFor + config.stepMs : 0;
      if (!secretCame && time >= config.secretCat.afterMs && stillFor >= config.secretCat.stillMs) {
        secretCame = true;
        spawnVariety('neighbour', onScreen(120));
        events.push({ kind: 'secret', id: 'neighbour' });
      }
      if (cats.length < wanted) {
        arrivals += Math.max(wanted - cats.length, 1) * config.arrivalShare * dt + dt;
        while (arrivals >= 1 && cats.length < wanted) {
          spawnCat();
          arrivals -= 1;
        }
      } else {
        arrivals = 0;
      }

      // The cats walk at the nearest Keeper; the grid is rebuilt from where they stand.
      toys.length = 0;
      for (const p of patches) if (p.kind === 'toy') toys.push(p);
      grid.clear();
      // The few big cats (bigger than the cats' size) are kept apart, so every
      // search looks a cat's size further, not the biggest one's.
      bigCats.length = 0;
      // How far is too far behind: once a step, not once a cat.
      const cam = camera();
      const far =
        ((Math.hypot(viewport.width, viewport.height) / 2) * cam.zoom + config.cats.spawnMargin) *
        2;
      flying.length = 0;
      for (let i = 0; i < cats.length; i++) {
        const cat = cats[i];
        moveCat(cat, dt);
        if (time < cat.flungUntil) flying.push(i);
        bringBack(cat, cam, far);
        if (cat.radius > config.cats.radius) bigCats.push(i);
        else grid.insert(i, cat.x, cat.y);
      }
      moveShots(dt);
      soothe(dt);
      deal(null);
      bowl();
      deal(null);

      // Reached: one drain per moment for each Keeper, an elite's effect on top.
      for (const k of keepers) {
        if (!standing(k) || time < k.untouchableUntil) continue;
        hero = k;
        gather(k.x, k.y, config.hero.reach);
        for (const i of near) {
          const cat = cats[i];
          // (The Neighbour's Cat drains nothing: it only sits there.)
          if (cat.drain === 0) continue;
          if ((cat.x - k.x) ** 2 + (cat.y - k.y) ** 2 > reachOf(cat) ** 2) continue;
          k.resolve = Math.max(k.resolve - drainNow(cat.drain, k), 0);
          k.untouchableUntil = time + config.hero.untouchableMs + k.mods.grace;
          events.push({
            kind: 'hero-hit',
            type: cat.type,
            variety: cat.variety,
            elite: cat.elite,
            player: k.index,
            how: 'touch',
          });
          if (cat.elite) afflict(cat);
          break;
        }
      }

      // Spent: Second Wind if he has it; in co-op he is down until the other has
      // lasted long enough; the run ends when no Keeper stands.
      for (const k of keepers) {
        hero = k;
        if (!standing(k)) {
          if (time - (k.downedAt ?? time) >= config.coop.reviveMs) {
            k.downedAt = null;
            k.resolve = maxResolve() / 2;
            k.untouchableUntil = time + config.hero.untouchableMs;
            events.push({ kind: 'revived', player: k.index, by: 'ally' });
          }
          continue;
        }
        if (k.resolve <= 0 && k.revivals > 0) {
          k.revivals--;
          k.resolve = maxResolve() / 2;
          events.push({ kind: 'revived', player: k.index, by: 'second-wind' });
        }
        if (k.resolve <= 0) {
          k.downedAt = time;
          k.effect = null;
          if (keepers.length > 1) events.push({ kind: 'downed', player: k.index });
        }
      }
      hero = keepers[0];
      if (!keepers.some(standing)) {
        end('spent');
        return;
      }

      // Their weapons; what flies; then every cat homesick enough goes home.
      jets.length = 0;
      for (const k of keepers) {
        if (!standing(k)) continue;
        hero = k;
        swingWeapons(dt);
      }
      hero = keepers[0];
      // Each of these names the weapon of what it works (deal), or nothing is counted.
      deal(null);
      updatePatches(dt);
      deal(null);
      moveProjectiles(dt);
      deal(null);
      updateSocks();
      deal(null);
      spreadRings();
      sweepHome();
      for (let i = beams.length - 1; i >= 0; i--) if (beams[i].until <= time) beams.splice(i, 1);
      for (const b of beams) {
        if (!b.follows) continue;
        const dx = b.follows.x - b.from.x;
        const dy = b.follows.y - b.from.y;
        b.from.x += dx;
        b.from.y += dy;
        b.to.x += dx;
        b.to.y += dy;
      }
      gatherGems(dt);
      gatherPickups(dt);

      // The time goal: the Matriarch comes, and ends the run when she reaches one.
      if (time >= config.timeGoalMs) {
        if (!matriarch) {
          const cam = camera();
          const reach =
            (Math.hypot(viewport.width, viewport.height) / 2) * cam.zoom + config.cats.spawnMargin;
          matriarch = { x: cam.x - reach, y: cam.y };
          matriarchNextAt = time + config.bossAttack.summon.firstMs;
          events.push({ kind: 'matriarch' });
        }
        const target = nearestKeeper(matriarch.x, matriarch.y);
        const dx = target.x - matriarch.x;
        const dy = target.y - matriarch.y;
        const d = Math.hypot(dx, dy) || 1;
        const call = config.bossAttack.summon;
        let calling = false;
        if (matriarchWind > 0) {
          calling = true;
          if (time >= matriarchWind && matriarchPatternAt(matriarchCalls) === 'volley') {
            // Her volley: shots on every side, the first at where he stood.
            matriarchWind = 0;
            windingUp--;
            matriarchCalls++;
            matriarchNextAt = time + call.everyMs;
            volley(matriarch, matriarchAim, VARIETIES.mega.drain / 2, 'mega');
            events.push({ kind: 'boss-attack', x: matriarch.x, y: matriarch.y, pattern: 'volley' });
            calling = false;
          } else if (time >= matriarchWind) {
            // The kittens come, in a ring round where he stood.
            matriarchWind = 0;
            windingUp--;
            matriarchCalls++;
            matriarchNextAt = time + call.everyMs;
            let came = 0;
            for (let k = 0; k < call.kittens && cats.length < config.cats.hardCap; k++) {
              const turn = (k * 2 * Math.PI) / call.kittens;
              spawnVariety('kitten', {
                x: matriarchAim.x + Math.cos(turn) * call.ringRadius,
                y: matriarchAim.y + Math.sin(turn) * call.ringRadius,
              });
              came++;
            }
            events.push({
              kind: 'boss-summon',
              x: matriarchAim.x,
              y: matriarchAim.y,
              kittens: came,
            });
            calling = false;
          }
        } else if (time >= matriarchNextAt && d > call.minDistance) {
          const pattern = matriarchPatternAt(matriarchCalls);
          matriarchWind =
            time + (pattern === 'volley' ? config.bossAttack.volley.windUpMs : call.windUpMs);
          matriarchAim = { x: target.x, y: target.y };
          windUpsBegun++;
          bossWindUpsBegun++;
          windingUp++;
          calling = true;
          events.push({
            kind: 'wind-up',
            x: matriarch.x,
            y: matriarch.y,
            type: -1,
            shape: pattern === 'volley' ? 'burst' : 'blast',
          });
        }
        // She stands still while she calls.
        if (!calling) {
          const move = Math.min(config.matriarch.speed * dt, d);
          matriarch.x += (dx / d) * move;
          matriarch.y += (dy / d) * move;
        }
        if (d <= config.matriarch.reach) end('goal');
      }
    },

    /** The level-up's choices waiting, or null. */
    choices: (): readonly Choice[] | null => choosing,
    /** The level the waiting choice is for (several can wait after one gem). */
    choiceLevel: (): number => level - pending + 1,

    /** Takes the level-up's choice `index`; the run goes on (or the next level's choice comes). */
    choose(index: number) {
      if (!choosing) return;
      hero = keepers[chooser];
      const choice = choosing[Math.min(Math.max(index, 0), choosing.length - 1)];
      if (choice.kind === 'weapon') {
        const held = hero.weapons.get(choice.id);
        if (held) held.level = choice.level;
        else {
          hero.weapons.set(choice.id, { level: 1, readyAt: time + 200 });
          everHeld.add(choice.id);
        }
      } else {
        hero.passives.set(choice.id, choice.level);
        remod(hero);
      }
      hero = keepers[0];
      choosing = null;
      nextChooser();
    },

    /**
     * Asks for new choices instead of these, if he has a reroll left: false if not. The
     * new ones are not the same as the old, when the pool allows.
     */
    reroll(): boolean {
      const k = keepers[chooser];
      if (!choosing || k.rerollsLeft <= 0) return false;
      k.rerollsLeft--;
      const before = choosing.map((c) => c.kind + c.id).join();
      for (let tries = 0; tries < 6; tries++) {
        offer();
        const now = choosing!.map((c) => c.kind + c.id).join();
        if (now !== before) break;
      }
      return true;
    },

    /**
     * Takes no choice and a little experience instead (a share of what the next level
     * needs), if he has a skip left: false if not.
     */
    skip(): boolean {
      const k = keepers[chooser];
      if (!choosing || k.skipsLeft <= 0) return false;
      k.skipsLeft--;
      xp += xpToNext(level) * config.levelUp.skipXpShare;
      choosing = null;
      nextChooser();
      return true;
    },

    /** What the Keeper whose choice waits has left to ask for. */
    levelUpUses: (): { rerolls: number; skips: number } => ({
      rerolls: keepers[chooser].rerollsLeft,
      skips: keepers[chooser].skipsLeft,
    }),

    /** Whose choice the waiting level-up is: 0 for player 1, 1 for player 2. */
    chooser: (): number => chooser,

    /** The hero gives up: the run ends where it stands. */
    giveUp() {
      end('gave-up');
    },

    /** What happened since the last call (sounds, flashes): handed over once. */
    drainEvents(): ArenaEvent[] {
      const out = events;
      events = [];
      return out;
    },

    /** The live cats, as they stand (read, do not keep: the objects are reused). */
    cats: (): readonly ArenaCat[] => cats,
    projectiles: (): readonly Projectile[] => projectiles,
    gems: (): readonly Gem[] => gems,
    /** The pickups lying about. */
    pickups: (): readonly Pickup[] => pickups,
    /** Lays a pickup (a test's way to have one where it wants). */
    layPickup(kind: PickupKind, at: Vec) {
      pickups.push({ x: at.x, y: at.y, kind, until: time + config.pickups.lifeMs });
    },
    beams: (): readonly { from: Vec; to: Vec }[] => beams,
    /** Where the Can Opener's blades are, and the Thunderous Vacuum's reach (or null). */
    blades: (): Vec[] => {
      const all: Vec[] = [];
      for (const k of keepers) {
        if (!standing(k)) continue;
        hero = k;
        for (const [id, held] of activeWeapons(k)) {
          if (WEAPONS[id].kind === 'orbit')
            all.push(...bladesOf(weaponStats(id, held.level, k.mods)));
        }
      }
      hero = keepers[0];
      return all;
    },
    /** Each standing Keeper's zones (the Thunderous Vacuum, the clocks): where, and how far they reach. */
    zones: (): { x: number; y: number; radius: number; weapon: WeaponId }[] =>
      keepers.flatMap((k) => {
        if (!standing(k)) return [];
        const all: { x: number; y: number; radius: number; weapon: WeaponId }[] = [];
        for (const [id, held] of activeWeapons(k)) {
          if (WEAPONS[id].kind !== 'zone') continue;
          const radius = weaponStats(id, held.level, k.mods).area;
          all.push({ x: k.x, y: k.y, radius, weapon: id });
        }
        return all;
      }),
    /** The shared camera (one Keeper: on him, at the screen's own zoom). */
    camera,
    /** Every attack winding up now (the elites' and the bosses'), for the view to warn with. */
    telegraphs: (): Telegraph[] => {
      const all: Telegraph[] = [];
      if (windingUp === 0) return all;
      const b = config.bossAttack;
      const progress = (until: number, windUpMs: number) =>
        Math.min(1, Math.max(0, 1 - (until - time) / windUpMs));
      const warn = (
        t: Omit<Telegraph, 'radius' | 'length' | 'width' | 'count'> & Partial<Telegraph>
      ) => all.push({ radius: 0, length: 0, width: 0, count: 0, ...t });
      if (matriarchWind > 0 && matriarch) {
        const at = { x: matriarch.x, y: matriarch.y, aimX: matriarchAim.x, aimY: matriarchAim.y };
        if (matriarchPatternAt(matriarchCalls) === 'volley') {
          warn({
            ...at,
            shape: 'burst',
            boss: true,
            radius: b.volley.radius,
            length: VOLLEY_WARNING,
            count: b.volley.shots,
            progress: progress(matriarchWind, b.volley.windUpMs),
          });
        } else {
          warn({
            ...at,
            shape: 'blast',
            boss: true,
            radius: b.summon.ringRadius,
            progress: progress(matriarchWind, b.summon.windUpMs),
          });
        }
      }
      const a = config.eliteAttack;
      for (const cat of cats) {
        if (cat.windUntil <= 0) continue;
        const at = { x: cat.x, y: cat.y, aimX: cat.aimX, aimY: cat.aimY };
        if (cat.variety === 'mega') {
          const pattern = megaPatternAt(cat.attacks);
          const p = progress(cat.windUntil, b[pattern].windUpMs);
          if (pattern === 'pounce') {
            warn({ ...at, shape: 'blast', boss: true, radius: b.pounce.radius, progress: p });
          } else if (pattern === 'charge') {
            warn({
              ...at,
              shape: 'dash',
              boss: true,
              length: (b.charge.speed * b.charge.ms) / 1000,
              width: cat.radius * 2,
              progress: p,
            });
          } else {
            warn({
              ...at,
              shape: 'burst',
              boss: true,
              radius: b.volley.radius,
              length: VOLLEY_WARNING,
              count: b.volley.shots,
              progress: p,
            });
          }
          continue;
        }
        const shape = attackOf(cat);
        if (!shape) continue;
        const p = progress(cat.windUntil, a.windUpMs);
        if (shape === 'burst') {
          warn({
            ...at,
            shape,
            boss: false,
            radius: a.burst.radius,
            length: BURST_WARNING,
            count: a.burst.shots,
            progress: p,
          });
        } else if (shape === 'bolt') {
          warn({ ...at, shape, boss: false, radius: a.bolt.radius, progress: p });
        } else {
          warn({
            ...at,
            shape,
            boss: false,
            length: (a.dash.speed * a.dash.ms) / 1000,
            width: a.dash.width,
            progress: p,
          });
        }
      }
      return all;
    },
    /** What his weapons have set down (toys, boxes, puddles), and this step's swings and jets. */
    patches: (): readonly Patch[] => patches,
    sweeps: (): readonly Sweep[] => sweeps,
    jets: (): readonly Jet[] => jets,
    /** The Frying Pan's swings, fading. */
    swats: (): readonly Swat[] => swats,
    /**
     * What each weapon held in the run did (evolved and fused ones included, every
     * Keeper's together): homesickness given and cats sent home, most homesickness
     * first. A weapon after it fused counts for the fused one.
     */
    weaponReport: (): { id: WeaponId; homesickness: number; sentHome: number }[] =>
      [...new Set([...everHeld, ...tally.keys()])]
        .map((id) => ({ id, homesickness: 0, sentHome: 0, ...tally.get(id) }))
        .sort(
          (a, b) =>
            b.homesickness - a.homesickness || b.sentHome - a.sentHome || a.id.localeCompare(b.id)
        ),
    /** The Static Socks clinging to cats, where those cats stand. */
    socks: (): readonly Sock[] => socks,
    matriarch: (): Vec | null => matriarch,
    chests: (): readonly Chest[] => chests,
    /** The rings of light spreading from where bosses were sent home. */
    rings: (): readonly Ring[] => rings,
    /** The cats' shots in flight (read, do not keep: the objects are reused). */
    shots: (): readonly EnemyShot[] => shots,

    state() {
      const first = keepers[0];
      const active = first.effect && time < first.effect.until ? first.effect.effect.kind : null;
      return {
        time,
        /** The run's length: when the Matriarch comes, ms (Infinity: an endless run). */
        goalMs: config.timeGoalMs,
        /** How many weapons and passives each Keeper can hold. */
        slots,
        status,
        outcome,
        /** Player 1's Keeper (the only one, alone). */
        hero: {
          x: first.x,
          y: first.y,
          resolve: first.resolve,
          maxResolve: maxResolveOf(first),
          facing: first.facing,
          untouchable: time < first.untouchableUntil,
          effect: active,
        },
        /** Every Keeper: one, or two in co-op. */
        heroes: keepers.map((k) => ({
          x: k.x,
          y: k.y,
          resolve: k.resolve,
          maxResolve: maxResolveOf(k),
          facing: k.facing,
          rerollsLeft: k.rerollsLeft,
          skipsLeft: k.skipsLeft,
          /** The way he looks, radians (the screen's): his aim, else the way he walks. */
          lookAngle: k.aimAngle ?? k.walkAngle,
          untouchable: time < k.untouchableUntil,
          effect: k.effect && time < k.effect.until ? k.effect.effect.kind : null,
          down: !standing(k),
          /** How long until a downed Keeper stands again, ms (0 while he stands). */
          backIn: k.downedAt === null ? 0 : Math.max(k.downedAt + config.coop.reviveMs - time, 0),
          weapons: [...k.weapons].map(([id, held]) => ({ id, level: held.level })),
          passives: [...k.passives].map(([id, l]) => ({ id, level: l })),
        })),
        chooser,
        cats: cats.length,
        /** How many elites are winding up an attack now. */
        windUps: windingUp,
        /** Pickups lying about, taken so far, and the last one taken. */
        pickups: pickups.length,
        pickupsTaken,
        lastPickup,
        bossWindUpsBegun,
        /** What a boss is winding up: the Matriarch's call (a summon or a volley), else a Mega Cat's attack. */
        bossWindUp: ((): MegaPattern | 'summon' | null => {
          if (matriarchWind > 0) return matriarchPatternAt(matriarchCalls);
          if (megaWinding === 0) return null;
          for (const cat of cats) {
            if (cat.variety === 'mega' && cat.windUntil > 0) return megaPatternAt(cat.attacks);
          }
          return null;
        })(),
        windUpsBegun,
        sentHome,
        level,
        xp,
        xpToNext: xpToNext(level),
        weapons: [...first.weapons].map(([id, held]) => ({ id, level: held.level })),
        passives: [...first.passives].map(([id, l]) => ({ id, level: l })),
        projectiles: projectiles.length,
        gems: gems.length,
        chests: chests.length,
        /** The oldest Mega Cat on the field (by id): its Homesickness, for its bar. */
        boss: (() => {
          let boss: ArenaCat | null = null;
          for (const cat of cats) {
            if (cat.variety === 'mega' && (!boss || cat.id < boss.id)) boss = cat;
          }
          return boss ? { homesickness: boss.homesickness, limit: boss.limit } : null;
        })(),
      };
    },
  };
}
