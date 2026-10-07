// Survival, the arena (/cats/survival): a time-survival game in the manner of
// Vampire Survivors, as a pure simulation. Time, input and the random source are
// passed in, it advances in fixed steps, and nothing here touches the DOM, so a
// seeded run plays out the same every time and is tested in Node. arena-view.tsx
// draws it.
//
// The hero walks an endless arena; the cats of the twenty xenocat types pour in
// from just off screen on every side and walk at him. Attacks are automatic:
// positioning is the skill. His Laser Pointer points at the nearest cat every so
// often, and every cat its beam touches grows homesick; enough Homesickness and a
// cat is beamed home. Nothing is ever killed. A cat that reaches him drains his
// Resolve (each type its own amount), and he is untouchable for a moment after. A
// few cats are elites, and also lay their xenocat effect on him (Cryo freezes him,
// Gravi slows him, Mirror turns his controls round...), one effect at a time.
// Cats keep coming, more and more, until the frame rate says no more (frame-guard.ts).
// The run ends when his Resolve is spent, when he gives up, or at the time goal,
// when the Matriarch comes for him and no laser can send her home.

import type { CatType } from './cat-types';
import { type Vec } from './effects';
import { createArenaGrid } from './arena-grid';
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
  };
  /**
   * How many cats the arena aims to hold, by the time into the run: points of
   * [ms, cats], straight lines between them, the last held after.
   */
  escalation: readonly (readonly [number, number])[];
  /** At most this many cats arrive a second, as a share of those still missing. */
  arrivalShare: number;
  laser: {
    cooldownMs: number;
    /** How far the beam reaches, px. */
    range: number;
    /** Cats this near the beam's line are touched by it, px. */
    width: number;
    /** Homesickness each touch gives. */
    homesickness: number;
    /** How long a beam is seen, ms. */
    showMs: number;
  };
  matriarch: {
    /** px/s: faster than the hero. */
    speed: number;
    reach: number;
  };
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
  laser: { cooldownMs: 1100, range: 300, width: 16, homesickness: 20, showMs: 180 },
  matriarch: { speed: 330, reach: 70 },
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
  /** Index into the run's types. */
  type: number;
  x: number;
  y: number;
  speed: number;
  homesickness: number;
  /** How much it can take. */
  limit: number;
  drain: number;
  elite: boolean;
};

export type ArenaEvent =
  | { kind: 'sent-home'; x: number; y: number; type: number }
  | { kind: 'hero-hit'; type: number; elite: boolean }
  | { kind: 'laser'; from: Vec; to: Vec }
  | { kind: 'matriarch' }
  | { kind: 'over'; outcome: ArenaOutcome };

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
  let laserReadyAt = config.laser.cooldownMs / 2;
  const beams: { from: Vec; to: Vec; until: number }[] = [];
  let matriarch: Vec | null = null;
  let events: ArenaEvent[] = [];

  /** A type's own numbers, the same every time: spread between the config's bounds. */
  const byType = (type: number, [low, high]: readonly [number, number], salt: number) => {
    const share = ((types[type].number * salt) % 11) / 10;
    return low + (high - low) * share;
  };

  function spawnCat() {
    // Just off screen, all round.
    const angle = random.next() * 2 * Math.PI;
    const reach = Math.hypot(viewport.width, viewport.height) / 2 + config.cats.spawnMargin;
    const type = random.int(0, types.length - 1);
    const cat = spare.pop() ?? ({} as ArenaCat);
    cat.id = nextId++;
    cat.type = type;
    cat.x = hero.x + Math.cos(angle) * reach;
    cat.y = hero.y + Math.sin(angle) * reach;
    cat.speed = byType(type, config.cats.speed, 7);
    cat.homesickness = 0;
    cat.limit = byType(type, config.cats.homesickness, 3);
    cat.drain = Math.round(byType(type, config.cats.drain, 5));
    cat.elite = random.next() < config.cats.eliteShare;
    cats.push(cat);
  }

  function sendHome(index: number) {
    const cat = cats[index];
    events.push({ kind: 'sent-home', x: cat.x, y: cat.y, type: cat.type });
    sentHome++;
    // Swap-remove, and keep the object for the next cat.
    cats[index] = cats[cats.length - 1];
    cats.pop();
    spare.push(cat);
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
    let speed = config.hero.speed;
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

  function fireLaser() {
    grid.query(hero.x, hero.y, config.laser.range, near);
    let target: ArenaCat | null = null;
    let best = config.laser.range ** 2;
    for (const i of near) {
      const cat = cats[i];
      const d = (cat.x - hero.x) ** 2 + (cat.y - hero.y) ** 2;
      if (d <= best) {
        best = d;
        target = cat;
      }
    }
    if (!target) return false;
    const dx = target.x - hero.x;
    const dy = target.y - hero.y;
    const length = Math.hypot(dx, dy);
    // A cat standing right on him gives no direction: he points the way he faces.
    const ux = length < 0.5 ? hero.facing : dx / length;
    const uy = length < 0.5 ? 0 : dy / length;
    const to = { x: hero.x + ux * config.laser.range, y: hero.y + uy * config.laser.range };
    beams.push({ from: { x: hero.x, y: hero.y }, to, until: time + config.laser.showMs });
    events.push({ kind: 'laser', from: { x: hero.x, y: hero.y }, to });
    // Every cat near the beam's line, within its reach, grows homesick.
    const hit: number[] = [];
    for (const i of near) {
      const cat = cats[i];
      const along = (cat.x - hero.x) * ux + (cat.y - hero.y) * uy;
      // (A cat right on him counts as in front: up to the same half pixel.)
      if (along < -0.5 || along > config.laser.range) continue;
      const across = Math.abs((cat.x - hero.x) * uy - (cat.y - hero.y) * ux);
      if (across > config.laser.width + 12) continue;
      cat.homesickness += config.laser.homesickness;
      if (cat.homesickness >= cat.limit) hit.push(i);
    }
    // Highest index first, so swap-removal leaves the others where they are.
    hit.sort((a, b) => b - a);
    for (const i of hit) sendHome(i);
    return true;
  }

  return {
    config,

    resize(size: { width: number; height: number }) {
      viewport = size;
    },

    /**
     * One step of `config.stepMs`: the hero walks the way `input` points (a unit
     * vector, or zero), cats come (while `spawn` allows), walk, reach him or are
     * sent home.
     */
    step(input: Vec, spawn = true) {
      if (status === 'over') return;
      const dt = config.stepMs / 1000;
      time += config.stepMs;
      heroStep(input, dt);

      // Arrivals: towards how many the arena wants now, a share a second at most.
      // While the frame-rate guard says no, only up to `guardFree`.
      const wanted = Math.min(
        catsWanted(time, config.escalation),
        config.cats.hardCap,
        spawn ? Infinity : config.cats.guardFree
      );
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
      for (let i = 0; i < cats.length; i++) {
        const cat = cats[i];
        const dx = hero.x - cat.x;
        const dy = hero.y - cat.y;
        const d = Math.hypot(dx, dy) || 1;
        const stepLength = Math.min(cat.speed * dt, d);
        cat.x += (dx / d) * stepLength;
        cat.y += (dy / d) * stepLength;
        grid.insert(i, cat.x, cat.y);
      }

      // Reached: one drain per moment, an elite's effect on top.
      if (time >= hero.untouchableUntil) {
        grid.query(hero.x, hero.y, config.hero.reach, near);
        for (const i of near) {
          const cat = cats[i];
          if ((cat.x - hero.x) ** 2 + (cat.y - hero.y) ** 2 > config.hero.reach ** 2) continue;
          hero.resolve = Math.max(hero.resolve - cat.drain, 0);
          hero.untouchableUntil = time + config.hero.untouchableMs;
          events.push({ kind: 'hero-hit', type: cat.type, elite: cat.elite });
          if (cat.elite) afflict(cat);
          break;
        }
        if (hero.resolve <= 0) {
          end('spent');
          return;
        }
      }

      if (time >= laserReadyAt && fireLaser()) laserReadyAt = time + config.laser.cooldownMs;
      for (let i = beams.length - 1; i >= 0; i--) if (beams[i].until <= time) beams.splice(i, 1);

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
    beams: (): readonly { from: Vec; to: Vec }[] => beams,
    matriarch: (): Vec | null => matriarch,

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
          maxResolve: config.hero.resolve,
          facing: hero.facing,
          untouchable: time < hero.untouchableUntil,
          effect: active,
        },
        cats: cats.length,
        sentHome,
        weapons: ['laser-pointer'] as const,
      };
    },
  };
}
