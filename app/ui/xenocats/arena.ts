// Survival, the arena (/cats/survival): a time-survival game in the manner of
// Vampire Survivors, as a pure simulation. Time, input and the random source are
// passed in, it advances in fixed steps, and nothing here touches the DOM, so a
// seeded run plays out the same every time and is tested in Node. arena-view.tsx
// draws it.
//
// The hero walks an endless arena; the cats of the twenty xenocat types pour in
// from just off screen on every side and walk at him. Attacks are automatic:
// positioning is the skill. His weapons (arsenal.ts) fire on their own, starting
// with the Laser Pointer; every cat they touch grows homesick, and enough
// Homesickness and a cat is beamed home. Nothing is ever killed. A cat sent home
// leaves an experience gem; gathered gems bring levels, and each level pauses the
// run for a choice: a new weapon, a better one, or a passive. A cat that reaches
// him drains his Resolve (each type its own amount), and he is untouchable for a
// moment after. A few cats are elites, and also lay their xenocat effect on him
// (Cryo freezes him, Gravi slows him, Mirror turns his controls round...), one
// effect at a time. Cats keep coming, more and more, until the frame rate says no
// more (frame-guard.ts). The run ends when his Resolve is spent, when he gives up,
// or at the time goal, when the Matriarch comes for him and nothing sends her home.

import {
  type Choice,
  type Modifiers,
  type PassiveId,
  WEAPONS,
  type WeaponId,
  type WeaponKind,
  type WeaponStats,
  modifiers,
  offerChoices,
  weaponStats,
  xpToNext,
} from './arsenal';
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
  };
  matriarch: {
    /** px/s: faster than the hero. */
    speed: number;
    reach: number;
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
  /** The spatial grid's cell, px. */
  cellSize: number;
};

export const ARENA_CONFIG: ArenaConfig = {
  stepMs: 1000 / 60,
  timeGoalMs: 5 * 60_000,
  hero: { speed: 210, resolve: 100, untouchableMs: 700, reach: 30 },
  cats: {
    speed: [45, 95],
    homesickness: [16, 34],
    drain: [4, 11],
    eliteShare: 0.04,
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
  gems: { pickup: 100, speed: 520, value: 1, eliteValue: 6, cap: 1500 },
  matriarch: { speed: 330, reach: 70 },
  schedule: SCHEDULE,
  laserCat: { range: 280, everyMs: 2500, shotSpeed: 420, shotRadius: 8 },
  chestReach: 36,
  cellSize: 64,
};

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
  x: number;
  y: number;
  speed: number;
  homesickness: number;
  /** How much it can take. */
  limit: number;
  drain: number;
  elite: boolean;
};

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
};

export type Gem = { x: number; y: number; value: number };

export type ArenaEvent =
  | { kind: 'sent-home'; x: number; y: number; type: number; variety: VarietyId | null }
  | { kind: 'hero-hit'; type: number; variety: VarietyId | null; elite: boolean }
  | { kind: 'boss'; x: number; y: number }
  | { kind: 'chest'; x: number; y: number }
  | { kind: 'laser'; from: Vec; to: Vec }
  | { kind: 'level-up'; level: number }
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
  const hero = { x: 0, y: 0, resolve: config.hero.resolve, untouchableUntil: 0, facing: 1 };
  let effect: { effect: HeroEffect; until: number; from: Vec; way: Vec } | null = null;
  let sentHome = 0;
  let nextId = 1;
  // The cats: live ones in `cats`, sent-home ones kept in `spare` to be reused.
  const cats: ArenaCat[] = [];
  const spare: ArenaCat[] = [];
  let arrivals = 0;
  let matriarch: Vec | null = null;
  let events: ArenaEvent[] = [];
  // Kitten swarms (how many of each are left), bosses come, chests lie about.
  let nextSwarm = config.schedule.swarms.from;
  let swarmId = 0;
  const swarms = new Map<number, number>();
  let bossesCome = 0;
  const chests: Vec[] = [];
  // The Laser Cats' shots.
  type Shot = { x: number; y: number; vx: number; vy: number; until: number; drain: number };
  const shots: Shot[] = [];
  const spareShots: Shot[] = [];

  // The arsenal.
  const weapons = new Map<WeaponId, { level: number; readyAt: number }>();
  for (const id of config.startingWeapons) {
    weapons.set(id, { level: config.startingLevel, readyAt: config.firstShotMs });
  }
  const passives = new Map<PassiveId, number>();
  let mods: Modifiers = modifiers(passives);
  const projectiles: Projectile[] = [];
  const spareProjectiles: Projectile[] = [];
  const beams: { from: Vec; to: Vec; until: number }[] = [];
  // Experience.
  const gems: Gem[] = [];
  let xp = 0;
  let level = 1;
  let pending = 0;
  let choosing: Choice[] | null = null;

  const maxResolve = () => config.hero.resolve + mods.maxResolve;

  /** A type's own numbers, the same every time: spread between the config's bounds. */
  const byType = (type: number, [low, high]: readonly [number, number], salt: number) => {
    const share = ((types[type].number * salt) % 11) / 10;
    return low + (high - low) * share;
  };

  /** A point just off screen, at `angle` from him. */
  function offScreen(angle: number, extra = 0): Vec {
    const reach = Math.hypot(viewport.width, viewport.height) / 2 + config.cats.spawnMargin + extra;
    return { x: hero.x + Math.cos(angle) * reach, y: hero.y + Math.sin(angle) * reach };
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
    cats.push(cat);
    return cat;
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
    return cat;
  }

  /** A spot on the screen, at least `away` from him: where a cat that sits is found. */
  function onScreen(away: number): Vec {
    const angle = random.next() * 2 * Math.PI;
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));
    // How far the screen reaches that way (40 px in from its edge), so a narrow
    // screen keeps the cat on it: nearer than `away` only if the screen is that small.
    const edge = Math.min(
      cos > 1e-6 ? (viewport.width / 2 - 40) / cos : Infinity,
      sin > 1e-6 ? (viewport.height / 2 - 40) / sin : Infinity
    );
    const near = Math.min(away, edge / 2);
    const reach = random.range(near, Math.max(edge, near));
    return { x: hero.x + Math.cos(angle) * reach, y: hero.y + Math.sin(angle) * reach };
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
  function bringBack(cat: ArenaCat) {
    const far = (Math.hypot(viewport.width, viewport.height) / 2 + config.cats.spawnMargin) * 2;
    if (Math.hypot(cat.x - hero.x, cat.y - hero.y) <= far + cat.radius) return;
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
    while (bossesCome < bosses.length && time >= bosses[bossesCome]) {
      bossesCome++;
      const at = offScreen(random.next() * 2 * Math.PI, VARIETIES.mega.radius);
      spawnVariety('mega', at);
      events.push({ kind: 'boss', x: at.x, y: at.y });
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
      dropGem(cat.x, cat.y, cat.elite ? config.gems.eliteValue : config.gems.value);
      // A boss, an elite, or the last kitten of a swarm leaves a chest.
      let chest = cat.variety === 'mega' || (cat.elite && cat.swarm === 0);
      if (cat.swarm !== 0) {
        const left = (swarms.get(cat.swarm) ?? 1) - 1;
        if (left <= 0) {
          swarms.delete(cat.swarm);
          chest = true;
        } else swarms.set(cat.swarm, left);
      }
      if (chest) chests.push({ x: cat.x, y: cat.y });
      cats[i] = cats[cats.length - 1];
      cats.pop();
      spare.push(cat);
    }
  }

  function dropGem(x: number, y: number, value: number) {
    // Too many lying about: it adds to one already there.
    if (gems.length >= config.gems.cap) gems[random.int(0, gems.length - 1)].value += value;
    else gems.push({ x, y, value });
  }

  function end(how: ArenaOutcome) {
    if (status === 'over') return;
    status = 'over';
    // Past the time goal the run was won, however it then ended.
    outcome = how === 'spent' && time >= config.timeGoalMs ? 'goal' : how;
    events.push({ kind: 'over', outcome });
  }

  /** Lays an elite's effect on the hero, if none is on him. */
  function afflict(cat: ArenaCat) {
    if (effect && time < effect.until) return;
    if (cat.variety !== null) return;
    const type = types[cat.type];
    const kind = HERO_EFFECTS[type.effect.id];
    if (!kind) return;
    const until = time + Math.min(type.effect.durationMs, config.cats.effectMaxMs);
    const away = { x: hero.x - cat.x, y: hero.y - cat.y };
    const length = Math.hypot(away.x, away.y) || 1;
    const angle = random.next() * 2 * Math.PI;
    let way = { x: away.x / length, y: away.y / length };
    if (kind.kind === 'push') {
      if (kind.way === 'toward') way = { x: -way.x, y: -way.y };
      else if (kind.way === 'down') way = { x: 0, y: 1 };
      else if (kind.way === 'fixed') way = { x: Math.cos(angle), y: Math.sin(angle) };
    }
    if (kind.kind === 'jump') {
      hero.x += Math.cos(angle) * kind.distance;
      hero.y += Math.sin(angle) * kind.distance;
    }
    effect = { effect: kind, until, from: { x: cat.x, y: cat.y }, way };
  }

  /** The hero's walk this step, after any effect on him. */
  function heroStep(input: Vec, dt: number) {
    const active = effect && time < effect.until ? effect : null;
    let { x, y } = input;
    let speed = config.hero.speed * mods.speed;
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
  }

  /** A cat's step, its own way. */
  function moveCat(cat: ArenaCat, dt: number) {
    const dx = hero.x - cat.x;
    const dy = hero.y - cat.y;
    const d = Math.hypot(dx, dy) || 1;
    const gait = cat.variety ? VARIETIES[cat.variety].gait : 'walk';
    if (gait === 'sit') return;
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
        const shot = spareShots.pop() ?? ({} as Shot);
        shot.x = cat.x;
        shot.y = cat.y;
        shot.vx = (dx / d) * config.laserCat.shotSpeed;
        shot.vy = (dy / d) * config.laserCat.shotSpeed;
        shot.until = time + 2500;
        shot.drain = cat.drain;
        shots.push(shot);
      }
      if (d <= config.laserCat.range) return;
    }
    const stepLength = Math.min(speed * dt, d);
    cat.x += (dx / d) * stepLength;
    cat.y += (dy / d) * stepLength;
  }

  /** The Laser Cats' shots fly; one that reaches him drains his Resolve. */
  function moveShots(dt: number) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const shot = shots[i];
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      const hit =
        Math.hypot(shot.x - hero.x, shot.y - hero.y) <=
        config.hero.reach / 2 + config.laserCat.shotRadius;
      if (hit && time >= hero.untouchableUntil) {
        hero.resolve = Math.max(hero.resolve - shot.drain, 0);
        hero.untouchableUntil = time + config.hero.untouchableMs;
        events.push({ kind: 'hero-hit', type: -1, variety: 'laser', elite: false });
      }
      if (hit || time >= shot.until) {
        shots[i] = shots[shots.length - 1];
        shots.pop();
        spareShots.push(shot);
      }
    }
  }

  // ------------------------------------------------------------------ the weapons

  /** Homesickness from a weapon of `kind`: nothing, to a cat it passes through. */
  function hurt(cat: ArenaCat, amount: number, kind: WeaponKind) {
    if (cat.variety && VARIETIES[cat.variety].immuneTo?.includes(kind)) return;
    cat.homesickness += amount;
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
    beams.push({ from: { ...from }, to, until: time + 180 });
    events.push({ kind: 'laser', from: { ...from }, to });
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

  /** The way from the hero to a cat; the way he faces if it stands on him. */
  function aim(cat: ArenaCat): Vec {
    const dx = cat.x - hero.x;
    const dy = cat.y - hero.y;
    const length = Math.hypot(dx, dy);
    return length < 0.5 ? { x: hero.facing, y: 0 } : { x: dx / length, y: dy / length };
  }

  function launch(p: Omit<Projectile, 'touched'>) {
    const projectile = spareProjectiles.pop() ?? ({ touched: [] } as unknown as Projectile);
    Object.assign(projectile, p);
    projectile.touched.length = 0;
    projectiles.push(projectile);
  }

  /** Fires a weapon that fires; false if it found nothing to fire at (it waits). */
  function fire(id: WeaponId, s: WeaponStats): boolean {
    const kind = WEAPONS[id].kind;
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
        const [i] = nearest(from, s.area, 1, hit);
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
    const base = { weapon: id, bit: false, x: hero.x, y: hero.y, radius: s.area, damage: s.damage };
    if (kind === 'spread' || kind === 'burst') {
      const [i] = nearest(hero, 650, 1);
      if (i === undefined) return false;
      const way = aim(cats[i]);
      const angle = Math.atan2(way.y, way.x);
      const shots = kind === 'burst' ? 1 : s.count;
      for (let k = 0; k < shots; k++) {
        const turn = angle + (k - (shots - 1) / 2) * 0.16;
        launch({
          ...base,
          vx: Math.cos(turn) * s.speed,
          vy: Math.sin(turn) * s.speed,
          pierce: s.pierce,
          until: time + s.durationMs,
        });
      }
      return true;
    }
    if (kind === 'arc') {
      // A wide arc, the way he faces.
      const facing = hero.facing > 0 ? 0 : Math.PI;
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
        });
      }
      return true;
    }
    if (kind === 'bounce') {
      for (let k = 0; k < s.count; k++) {
        const turn = random.next() * 2 * Math.PI;
        launch({
          ...base,
          vx: Math.cos(turn) * s.speed,
          vy: Math.sin(turn) * s.speed,
          pierce: Infinity,
          until: time + s.durationMs,
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

  function swingWeapons(dt: number) {
    for (const [id, held] of weapons) {
      const s = weaponStats(id, held.level, mods);
      const kind = WEAPONS[id].kind;
      if (kind === 'orbit') {
        // Each blade, all the time, to every cat it passes through.
        for (const blade of bladesOf(s)) {
          for (const i of within(blade, BLADE_RADIUS)) hurt(cats[i], s.damage * dt, 'orbit');
        }
      } else if (kind === 'zone') {
        for (const i of within(hero, s.area)) hurt(cats[i], s.damage * dt, 'zone');
      } else if (time >= held.readyAt && fire(id, s)) {
        held.readyAt = time + s.cooldownMs;
        events.push({ kind: 'fired', weapon: id });
      }
    }
  }

  function moveProjectiles(dt: number) {
    const left = hero.x - viewport.width / 2;
    const top = hero.y - viewport.height / 2;
    for (let n = projectiles.length - 1; n >= 0; n--) {
      const p = projectiles[n];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.weapon === 'yarn-ball') {
        // Off the edges of the screen, as he walks.
        if (p.x < left || p.x > left + viewport.width)
          p.vx = Math.sign(hero.x - p.x) * Math.abs(p.vx);
        if (p.y < top || p.y > top + viewport.height)
          p.vy = Math.sign(hero.y - p.y) * Math.abs(p.vy);
      }
      for (const i of within(p, p.radius)) {
        const cat = cats[i];
        if (p.pierce <= 0 || p.touched.includes(cat.id)) continue;
        p.touched.push(cat.id);
        hurt(cat, p.damage, WEAPONS[p.weapon].kind);
        p.pierce--;
      }
      if (p.pierce <= 0 || time >= p.until) {
        // A hairball bursts into smaller ones where it ends.
        if (p.weapon === 'hairball' && !p.bit) {
          const s = weaponStats('hairball', weapons.get('hairball')?.level ?? 1, mods);
          for (let k = 0; k < s.count; k++) {
            const turn = (k * 2 * Math.PI) / s.count;
            launch({
              weapon: 'hairball',
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
        projectiles[n] = projectiles[projectiles.length - 1];
        projectiles.pop();
        spareProjectiles.push(p);
      }
    }
  }

  // --------------------------------------------------------------- experience

  function gatherGems(dt: number) {
    const reach = config.gems.pickup * mods.pickup;
    for (let i = gems.length - 1; i >= 0; i--) {
      const gem = gems[i];
      const dx = hero.x - gem.x;
      const dy = hero.y - gem.y;
      const d = Math.hypot(dx, dy);
      if (d <= 14) {
        xp += gem.value;
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
      events.push({ kind: 'level-up', level });
    }
    for (let i = chests.length - 1; i >= 0; i--) {
      const chest = chests[i];
      if (Math.hypot(chest.x - hero.x, chest.y - hero.y) > config.chestReach) continue;
      chests.splice(i, 1);
      events.push({ kind: 'chest', x: chest.x, y: chest.y });
      pending++;
    }
    if (pending > 0 && !choosing) offer();
  }

  function offer() {
    const held = new Map([...weapons].map(([id, w]) => [id, w.level] as const));
    choosing = offerChoices(held, passives, mods.choices, random);
  }

  return {
    config,

    resize(size: { width: number; height: number }) {
      viewport = size;
    },

    /**
     * One step of `config.stepMs`: the hero walks the way `input` points (a unit
     * vector, or zero), cats come (while `spawn` allows), walk, reach him or are
     * sent home. Nothing moves while a level-up's choice waits.
     */
    step(input: Vec, spawn = true) {
      if (status === 'over' || choosing) return;
      const dt = config.stepMs / 1000;
      time += config.stepMs;
      heroStep(input, dt);
      hero.resolve = Math.min(hero.resolve + mods.recovery * dt, maxResolve());

      // Arrivals: towards how many the arena wants now, a share a second at most.
      // While the frame-rate guard says no, only up to `guardFree`.
      const wanted = Math.min(
        catsWanted(time, config.escalation),
        config.cats.hardCap,
        spawn ? Infinity : config.cats.guardFree
      );
      spawnEvents(spawn);
      if (cats.length < wanted) {
        arrivals += Math.max(wanted - cats.length, 1) * config.arrivalShare * dt + dt;
        while (arrivals >= 1 && cats.length < wanted) {
          spawnCat();
          arrivals -= 1;
        }
      } else {
        arrivals = 0;
      }

      // The cats walk at him; the grid is rebuilt from where they now stand.
      grid.clear();
      // The few big cats (bigger than the cats' size) are kept apart, so every
      // search looks a cat's size further, not the biggest one's.
      bigCats.length = 0;
      for (let i = 0; i < cats.length; i++) {
        const cat = cats[i];
        moveCat(cat, dt);
        bringBack(cat);
        if (cat.radius > config.cats.radius) bigCats.push(i);
        else grid.insert(i, cat.x, cat.y);
      }
      moveShots(dt);

      // Reached: one drain per moment, an elite's effect on top.
      if (time >= hero.untouchableUntil) {
        gather(hero.x, hero.y, config.hero.reach);
        for (const i of near) {
          const cat = cats[i];
          if ((cat.x - hero.x) ** 2 + (cat.y - hero.y) ** 2 > reachOf(cat) ** 2) continue;
          hero.resolve = Math.max(hero.resolve - cat.drain, 0);
          hero.untouchableUntil = time + config.hero.untouchableMs;
          events.push({ kind: 'hero-hit', type: cat.type, variety: cat.variety, elite: cat.elite });
          if (cat.elite) afflict(cat);
          break;
        }
      }
      if (hero.resolve <= 0) {
        end('spent');
        return;
      }

      // His weapons; what flies; then every cat homesick enough goes home.
      swingWeapons(dt);
      moveProjectiles(dt);
      sweepHome();
      for (let i = beams.length - 1; i >= 0; i--) if (beams[i].until <= time) beams.splice(i, 1);
      gatherGems(dt);

      // The time goal: the Matriarch comes, and ends the run when she reaches him.
      if (time >= config.timeGoalMs) {
        if (!matriarch) {
          const reach = Math.hypot(viewport.width, viewport.height) / 2 + config.cats.spawnMargin;
          matriarch = { x: hero.x - reach, y: hero.y };
          events.push({ kind: 'matriarch' });
        }
        const dx = hero.x - matriarch.x;
        const dy = hero.y - matriarch.y;
        const d = Math.hypot(dx, dy) || 1;
        const move = Math.min(config.matriarch.speed * dt, d);
        matriarch.x += (dx / d) * move;
        matriarch.y += (dy / d) * move;
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
      const choice = choosing[Math.min(Math.max(index, 0), choosing.length - 1)];
      if (choice.kind === 'weapon') {
        const held = weapons.get(choice.id);
        if (held) held.level = choice.level;
        else weapons.set(choice.id, { level: 1, readyAt: time + 200 });
      } else if (choice.kind === 'passive') {
        const before = maxResolve();
        passives.set(choice.id, choice.level);
        mods = modifiers(passives);
        // More Resolve to hold: he gains what was added.
        hero.resolve += maxResolve() - before;
      } else {
        hero.resolve = Math.min(hero.resolve + 30, maxResolve());
      }
      pending--;
      choosing = null;
      if (pending > 0) offer();
    },

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
    beams: (): readonly { from: Vec; to: Vec }[] => beams,
    /** Where the Can Opener's blades are, and the Thunderous Vacuum's reach (or null). */
    blades: (): Vec[] => {
      const held = weapons.get('can-opener');
      return held ? bladesOf(weaponStats('can-opener', held.level, mods)) : [];
    },
    zone: (): number | null => {
      const held = weapons.get('thunderous-vacuum');
      return held ? weaponStats('thunderous-vacuum', held.level, mods).area : null;
    },
    matriarch: (): Vec | null => matriarch,
    chests: (): readonly Vec[] => chests,
    shots: (): readonly { x: number; y: number }[] => shots,

    state() {
      const active = effect && time < effect.until ? effect.effect.kind : null;
      return {
        time,
        status,
        outcome,
        hero: {
          x: hero.x,
          y: hero.y,
          resolve: hero.resolve,
          maxResolve: maxResolve(),
          facing: hero.facing,
          untouchable: time < hero.untouchableUntil,
          effect: active,
        },
        cats: cats.length,
        sentHome,
        level,
        xp,
        xpToNext: xpToNext(level),
        weapons: [...weapons].map(([id, held]) => ({ id, level: held.level })),
        passives: [...passives].map(([id, l]) => ({ id, level: l })),
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
