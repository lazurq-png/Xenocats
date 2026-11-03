// Survival's arena (arena.ts): the shapes of what is in it (cats, shots, patches,
// events), its constants and its small pure helpers. Split out of arena.ts, which
// re-exports all of it, so a module may import it from either.

import { type Modifiers, type PassiveId, type WeaponId, FUSIONS } from './arsenal';
import type { AttackShape, MegaPattern } from './cat-attacks';
import type { Vec } from './effects';
import type { Gait, VarietyId } from './varieties';

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
  /** How it moves: its variety's gait, a xenocat's 'walk'. Kept, not looked up each step. */
  gait: Gait;
  /** How it comforts the cats round it (its variety's), or null: kept, not looked up. */
  soothes: Readonly<{ radius: number; perSecond: number }> | null;
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
  /** Whose swat sent it flying (the Keeper's index): his passives, his credit. */
  flungOwner: number;
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
  /** Whose weapon set it down (the Keeper's index): his passives, his credit. */
  owner: number;
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
export const FUSED_FROM = new Map<WeaponId, WeaponId>(
  FUSIONS.flatMap((f) => f.from.map((id) => [id, f.to] as const))
);

/** The Purring Cats comfort every this many steps (soothe). */
export const SOOTHE_TURNS = 4;
/** A quarter of the cats are eased apart each step, each off at most this many it overlaps. */
export const SEPARATE_TURNS = 4;
export const SEPARATE_NEIGHBOURS = 4;

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
export type Held = {
  level: number;
  readyAt: number;
  parts?: Map<WeaponId, { level: number; readyAt: number }>;
};

/** One player's hero: where he is, his Resolve, his own weapons and passives. */
export type Keeper = {
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
