// Survival's arena (arena.ts): its configuration, the run lengths and the numbers
// that follow from them. Split out of arena.ts, which re-exports all of it, so a
// module may import it from either.

import { BASE_WEAPONS, DEFAULT_SLOTS, type Slots, type PassiveId, type WeaponId } from './arsenal';
import { SCHEDULE, type Schedule } from './varieties';

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
    /**
     * Two cats may come this close, as a share of their sizes added, before they are eased
     * apart (separate); 0: never (a test's way to have cats stay exactly where they are).
     */
    spacing: number;
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
  /**
   * A plain chest (an elite's, a visitor's, a swarm's last kitten's) is left at most
   * this often, ms: a late run sends elites home by the dozen, and a chest each would
   * hand him every evolution in minutes. A boss's golden chest always comes.
   */
  chestGapMs: number;
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
    spacing: 0.6,
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
  chestGapMs: 40_000,
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
export const ENDLESS_SCHEDULE_MS = 24 * 3_600_000;

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

/**
 * The most cats a Survival run of `minutes` (0: endless) can have sent home `ms`
 * into it: every cat that can have come by then, since none goes home twice. From
 * the config's own numbers, each source at its most: the arrivals at the rate
 * `step` adds them with the horde at none of what it wants, every kitten swarm at
 * its largest, a xenocat's visit at the shortest gap, every Mega Cat due, the
 * secret cat and the Matriarch's kittens. So a run played in this config never
 * passes it, and one that claims more was not played (the leaderboard refuses it,
 * recordSurvivalRun). Test hooks that change the config keep their runs off the
 * board anyway (leaderboard-entry.tsx). `ms` is the arena's clock, not the time
 * a run reports: a timed run's results stop at its goal, while cats go on going home
 * until the Matriarch reaches him, so the leaderboard passes the time since the run
 * really started.
 */
export function mostSentHome(
  ms: number,
  minutes: number,
  base: ArenaConfig = ARENA_CONFIG
): number {
  const config: ArenaConfig = { ...base, ...runLengthConfig(minutes) };
  // A step's time is up to a step past the time the run reports.
  const t = Math.max(0, ms) + config.stepMs;
  const { swarms, xenocats, bosses } = config.schedule;
  // Arrivals: each step adds max(wanted - cats, 1) × share × dt + dt, so at most
  // (wanted × share + 1) a second; wanted only grows, so a whole second at its end's.
  // Past the escalation's last point it wants the same, so those seconds are one sum.
  let cats = 1;
  const seconds = Math.ceil(t / 1000);
  const rising = Math.min(
    seconds,
    Math.ceil(config.escalation[config.escalation.length - 1][0] / 1000)
  );
  const perSecond = (ms: number) =>
    Math.max(Math.min(catsWanted(ms, config.escalation), config.cats.hardCap), 1) *
      config.arrivalShare +
    1;
  for (let second = 1; second <= rising; second++) cats += perSecond(second * 1000);
  cats += (seconds - rising) * perSecond(Infinity);
  if (t >= swarms.from)
    cats += (Math.floor((t - swarms.from) / swarms.everyMs) + 1) * swarms.size[1];
  if (xenocats && t >= xenocats.from) {
    cats += Math.floor((t - xenocats.from) / xenocats.everyMs[0]) + 1;
  }
  cats += bosses.filter((at) => at <= t).length;
  // The secret cat, once.
  cats += 1;
  const call = config.bossAttack.summon;
  const calling = config.timeGoalMs + call.firstMs;
  if (t >= calling) cats += (Math.floor((t - calling) / call.everyMs) + 1) * call.kittens;
  return Math.ceil(cats);
}

/** What an elite's xenocat effect does to the hero. */
