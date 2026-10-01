// Fight a cat, Survival mode, as a pure state machine: time, the pointer and the
// random source are passed in, so tests drive it tick by tick (like cat-engine.ts).
//
// Cats arrive in waves from the edges of the screen and chase the pointer. One that
// reaches it lands its attack and costs a life; clicking one banishes it. A wave is
// survived once all its cats have arrived and none is left. Every wave brings more
// cats, sooner and faster. The score is the number of waves survived.

import type { CatType } from './cat-types';
import { CAT_CONFIG } from './config';
import type { Size, Vec } from './effects';
import type { Random } from './random';

export type SurvivalConfig = {
  lives: number;
  /** Never more cats on screen than this. */
  maxCats: number;
  /** An attack lands when a cat's centre comes this close to the pointer, px. */
  hitRadius: number;
  /** A click banishes a cat whose centre is at most this far away, px. */
  clickRadius: number;
  /** New cats appear at least this far from the pointer, px. */
  keepAwayFromPointer: number;
  /** The quiet moment before each wave, ms. */
  breakMs: number;
  /** Wave 1; every later wave grows from it (waveSpec). */
  firstWave: WaveSpec;
  /** Each wave: one more cat, spawns this much sooner, cats this much faster. */
  countStep: number;
  spawnFactor: number;
  speedFactor: number;
  minSpawnEveryMs: number;
  maxSpeed: number;
};

export type WaveSpec = {
  /** How many cats the wave brings. */
  count: number;
  /** Time between two arrivals, ms. */
  spawnEveryMs: number;
  /** How fast its cats chase the pointer, px/s. */
  speed: number;
};

export const SURVIVAL_CONFIG: SurvivalConfig = {
  lives: 3,
  maxCats: CAT_CONFIG.maxCats,
  hitRadius: 24,
  clickRadius: CAT_CONFIG.catSize / 2,
  keepAwayFromPointer: 240,
  breakMs: 1500,
  firstWave: { count: 3, spawnEveryMs: 1800, speed: 80 },
  countStep: 1,
  spawnFactor: 0.88,
  speedFactor: 1.15,
  minSpawnEveryMs: 350,
  maxSpeed: 520,
};

/** What wave `n` (1-based) brings. */
export function waveSpec(n: number, config: SurvivalConfig = SURVIVAL_CONFIG): WaveSpec {
  const grown = Math.max(n, 1) - 1;
  const { firstWave } = config;
  return {
    count: firstWave.count + grown * config.countStep,
    spawnEveryMs: Math.max(
      firstWave.spawnEveryMs * config.spawnFactor ** grown,
      config.minSpawnEveryMs
    ),
    speed: Math.min(firstWave.speed * config.speedFactor ** grown, config.maxSpeed),
  };
}

export type FightCat = {
  id: number;
  typeId: string;
  /** The cat's centre, px. */
  x: number;
  y: number;
  /** px/s. */
  speed: number;
};

export type SurvivalStatus = 'playing' | 'over';

export type SurvivalSnapshot = {
  status: SurvivalStatus;
  lives: number;
  /** The wave under way (or about to start), 1-based. */
  wave: number;
  /** Waves survived so far: the score. */
  score: number;
  cats: readonly FightCat[];
};

export type Survival = ReturnType<typeof createSurvival>;

export function createSurvival(options: {
  random: Random;
  types: readonly CatType[];
  viewport: Size;
  /** The game clock when it starts. */
  now: number;
  config?: Partial<SurvivalConfig>;
}) {
  const { random, types } = options;
  const config: SurvivalConfig = { ...SURVIVAL_CONFIG, ...options.config };
  let viewport = options.viewport;
  let status: SurvivalStatus = 'playing';
  let lives = config.lives;
  let wave = 1;
  let score = 0;
  let spawned = 0;
  let nextSpawnAt = options.now + config.breakMs;
  let lastTick = options.now;
  let cats: FightCat[] = [];
  let nextId = 1;

  /**
   * A point just inside a random edge, away from the pointer; on a screen too small
   * for that, the farthest edge point tried. Null only when there is no room at all.
   */
  function edgeSpot(pointer: Vec): Vec | null {
    const inset = CAT_CONFIG.catSize / 2;
    const { width, height } = viewport;
    if (width < inset * 2 || height < inset * 2) return null;
    let farthest: Vec | null = null;
    let farthestDistance = -1;
    for (let attempt = 0; attempt < 20; attempt++) {
      const along = random.next();
      const side = random.int(0, 3);
      const spot =
        side === 0
          ? { x: inset + along * (width - 2 * inset), y: inset }
          : side === 1
            ? { x: width - inset, y: inset + along * (height - 2 * inset) }
            : side === 2
              ? { x: inset + along * (width - 2 * inset), y: height - inset }
              : { x: inset, y: inset + along * (height - 2 * inset) };
      const distance = Math.hypot(spot.x - pointer.x, spot.y - pointer.y);
      if (distance >= config.keepAwayFromPointer) return spot;
      if (distance > farthestDistance) {
        farthest = spot;
        farthestDistance = distance;
      }
    }
    return farthest;
  }

  const snapshot = (): SurvivalSnapshot => ({
    status,
    lives,
    wave,
    score,
    cats: cats.map((cat) => ({ ...cat })),
  });

  return {
    config,

    resize(size: Size) {
      viewport = size;
    },

    snapshot,

    /**
     * Advances the game to `now`: spawns, moves every cat towards `pointer`, and
     * lands the attacks of those that reach it. `room` caps the cats on screen
     * below `maxCats` (other cats already there count against the limit).
     * Returns the cats whose attack landed this tick, already removed.
     */
    tick(now: number, pointer: Vec, room: number = config.maxCats): FightCat[] {
      if (status === 'over') return [];
      const dt = Math.max(now - lastTick, 0) / 1000;
      lastTick = now;
      const spec = waveSpec(wave, config);
      const limit = Math.min(config.maxCats, Math.max(room, 0));

      // Arrivals that are due, one at a time, while there is room. A spawn that
      // cannot happen yet (full screen, no spot) is retried on the next tick.
      while (spawned < spec.count && now >= nextSpawnAt && cats.length < limit) {
        const spot = edgeSpot(pointer);
        if (!spot || types.length === 0) break;
        cats.push({ id: nextId++, typeId: random.pick(types).id, ...spot, speed: spec.speed });
        spawned++;
        nextSpawnAt = now + spec.spawnEveryMs;
      }

      const landed: FightCat[] = [];
      cats = cats.filter((cat) => {
        const dx = pointer.x - cat.x;
        const dy = pointer.y - cat.y;
        const distance = Math.hypot(dx, dy);
        const step = cat.speed * dt;
        if (distance <= config.hitRadius + step) {
          landed.push({ ...cat, x: pointer.x, y: pointer.y });
          return false;
        }
        cat.x += (dx / distance) * step;
        cat.y += (dy / distance) * step;
        return true;
      });

      lives = Math.max(lives - landed.length, 0);
      if (lives === 0) {
        status = 'over';
        cats = [];
        return landed;
      }

      if (spawned >= spec.count && cats.length === 0) {
        score++;
        wave++;
        spawned = 0;
        nextSpawnAt = now + config.breakMs;
      }
      return landed;
    },

    /** A click at `point`: banishes the nearest cat within reach. Returns it, or null. */
    click(point: Vec): FightCat | null {
      if (status === 'over') return null;
      let nearest: FightCat | null = null;
      let best = config.clickRadius;
      for (const cat of cats) {
        const distance = Math.hypot(cat.x - point.x, cat.y - point.y);
        if (distance <= best) {
          best = distance;
          nearest = cat;
        }
      }
      if (nearest) cats = cats.filter((cat) => cat !== nearest);
      return nearest;
    },
  };
}

/** Where the page keeps the best score (localStorage). */
export const SURVIVAL_BEST_KEY = 'xenocats:survival-best';

/** The best score after a game that scored `score`. */
export const bestScore = (previous: number | null, score: number) => Math.max(previous ?? 0, score);

/**
 * Time that stops while the game is paused. `real` is any monotonic clock
 * (performance.now()); `now` returns the game time it maps to.
 */
export function createGameClock(start: number) {
  let offset = start;
  let pausedAt: number | null = null;
  return {
    now(real: number): number {
      return (pausedAt ?? real) - offset;
    },
    pause(real: number) {
      pausedAt ??= real;
    },
    resume(real: number) {
      if (pausedAt === null) return;
      offset += real - pausedAt;
      pausedAt = null;
    },
    isPaused(): boolean {
      return pausedAt !== null;
    },
  };
}
