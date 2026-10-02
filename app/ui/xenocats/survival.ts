// Fight a cat, Survival mode, as a pure state machine: time, the player, the aim
// and the random source are passed in, so tests drive it tick by tick (like
// cat-engine.ts).
//
// The player is a character, walked with WASD, whose gun fires a homing beam at
// the crosshair by itself, at a steady rate. Cats arrive in waves from the edges of the screen and chase the
// character. Each cat pounces once, 1 to 3 s after it arrives: its attack scrambles
// the character and the crosshair, but costs nothing. A cat that touches the
// character lands its attack, leaves, and costs a life. A beam that hits a cat sends
// it home. A wave is survived once all its cats have arrived and none is left.
// Every wave brings more cats, sooner and faster. The score is the waves survived.

import type { CatType } from './cat-types';
import { CAT_CONFIG, type Range } from './config';
import { type Size, type Vec, direction } from './effects';
import type { Random } from './random';

export type SurvivalConfig = {
  lives: number;
  /** Never more cats on screen than this. */
  maxCats: number;
  /** A cat touches the character when their centres come this close, px. */
  touchRadius: number;
  /** New cats appear at least this far from the character, px. */
  keepAwayFromPlayer: number;
  /** A cat pounces this long after it arrives, ms. */
  attackAfterMs: Range;
  /** How fast WASD walks the character, px/s. */
  playerSpeed: number;
  /** How fast a beam flies, px/s. */
  beamSpeed: number;
  /** A beam hits a cat whose centre is at most this far from its path, px. */
  beamRadius: number;
  /** Beams leave the gun this far from the character's centre, px. */
  muzzleOffset: number;
  /** The gun fires by itself, one beam this often, ms. */
  fireEveryMs: number;
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
  /** How fast its cats chase the character, px/s. */
  speed: number;
};

export const SURVIVAL_CONFIG: SurvivalConfig = {
  lives: 3,
  maxCats: CAT_CONFIG.maxCats,
  touchRadius: 40,
  keepAwayFromPlayer: 240,
  attackAfterMs: [1000, 3000],
  playerSpeed: 280,
  beamSpeed: 1100,
  beamRadius: CAT_CONFIG.catSize / 2,
  muzzleOffset: 30,
  fireEveryMs: 350,
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
  /** When it pounces (game time), or null once it has. */
  attackAt: number | null;
};

/** How a shot flies and looks: a cat's attack on the ranger changes it (gun.ts). */
export type ShotStyle = {
  /** Size, and the reach of its hit, against a normal beam. */
  scale: number;
  /** Flight speed against beamSpeed. */
  speed: number;
  /** The wait for the next shot against fireEveryMs. */
  reload: number;
  /** Pulls the beam down as it flies, px/s². */
  gravity: number;
  /** How many times it bounces off the screen's edges before it may leave. */
  bounces: number;
  opacity: number;
  /** Blur radius, px. */
  blur: number;
  /** A coloured glow (e.g. ice), as a CSS colour. */
  tint?: string;
};

export const NORMAL_SHOT: ShotStyle = {
  scale: 1,
  speed: 1,
  reload: 1,
  gravity: 0,
  bounces: 0,
  opacity: 1,
  blur: 0,
};

export type Beam = {
  id: number;
  /** The beam's head, px. */
  x: number;
  y: number;
  /** Its velocity, px/s. */
  vx: number;
  vy: number;
} & Omit<ShotStyle, 'speed' | 'reload'>;

export type SurvivalStatus = 'playing' | 'over';

export type SurvivalSnapshot = {
  status: SurvivalStatus;
  lives: number;
  /** The wave under way (or about to start), 1-based. */
  wave: number;
  /** Waves survived so far: the score. */
  score: number;
  cats: readonly FightCat[];
  beams: readonly Beam[];
};

/** What happened in one tick. Cats in `touched` and `beamed` are already gone. */
export type SurvivalEvents = {
  /** Reached the character: each landed its attack and cost a life. */
  touched: FightCat[];
  /** Pounced from where they are: their attack costs nothing. */
  pounced: FightCat[];
  /** Hit by a beam and sent home. */
  beamed: FightCat[];
};

const NOTHING: SurvivalEvents = { touched: [], pounced: [], beamed: [] };

/** How far `point` is from the segment `a`–`b`. */
function distanceToSegment(point: Vec, a: Vec, b: Vec): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const length = abx * abx + aby * aby;
  const t =
    length === 0
      ? 0
      : Math.min(Math.max(((point.x - a.x) * abx + (point.y - a.y) * aby) / length, 0), 1);
  return Math.hypot(point.x - (a.x + t * abx), point.y - (a.y + t * aby));
}

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
  let nextFireAt = options.now;
  let lastTick = options.now;
  let cats: FightCat[] = [];
  let beams: Beam[] = [];
  let nextId = 1;

  /**
   * A point just inside a random edge, away from the character; on a screen too
   * small for that, the farthest edge point tried. Null only when there is no room.
   */
  function edgeSpot(player: Vec): Vec | null {
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
      const distance = Math.hypot(spot.x - player.x, spot.y - player.y);
      if (distance >= config.keepAwayFromPlayer) return spot;
      if (distance > farthestDistance) {
        farthest = spot;
        farthestDistance = distance;
      }
    }
    return farthest;
  }

  const offScreen = (point: Vec) => {
    const margin = config.beamRadius;
    return (
      point.x < -margin ||
      point.y < -margin ||
      point.x > viewport.width + margin ||
      point.y > viewport.height + margin
    );
  };

  /** A beam with bounces left that has crossed an edge comes back off it. */
  function bounce(beam: Beam) {
    const { width, height } = viewport;
    if (beam.bounces > 0 && (beam.x < 0 || beam.x > width)) {
      beam.x = beam.x < 0 ? -beam.x : 2 * width - beam.x;
      beam.vx = -beam.vx;
      beam.bounces--;
    }
    if (beam.bounces > 0 && (beam.y < 0 || beam.y > height)) {
      beam.y = beam.y < 0 ? -beam.y : 2 * height - beam.y;
      beam.vy = -beam.vy;
      beam.bounces--;
    }
  }

  const snapshot = (): SurvivalSnapshot => ({
    status,
    lives,
    wave,
    score,
    cats: cats.map((cat) => ({ ...cat })),
    beams: beams.map((beam) => ({ ...beam })),
  });

  return {
    config,

    resize(size: Size) {
      viewport = size;
    },

    snapshot,

    /**
     * Fires a beam from the character at `player` towards `aim`, unless the gun is
     * still recharging (the page calls it every frame). Returns the beam, or null.
     */
    fire(now: number, player: Vec, aim: Vec, style: Partial<ShotStyle> = {}): Beam | null {
      if (status === 'over' || now < nextFireAt) return null;
      const { speed, reload, ...look } = { ...NORMAL_SHOT, ...style };
      nextFireAt = now + config.fireEveryMs * reload;
      const way = direction(player, aim, -Math.PI / 2);
      const beam = {
        id: nextId++,
        x: player.x + way.x * config.muzzleOffset * look.scale,
        y: player.y + way.y * config.muzzleOffset * look.scale,
        vx: way.x * config.beamSpeed * speed,
        vy: way.y * config.beamSpeed * speed,
        ...look,
      };
      beams.push(beam);
      return { ...beam };
    },

    /**
     * Advances the game to `now`: spawns, flies the beams, moves every cat towards
     * the character at `player`, and reports what happened. `room` caps the cats on
     * screen below `maxCats` (other cats already there count against the limit).
     */
    tick(now: number, player: Vec, room: number = config.maxCats): SurvivalEvents {
      if (status === 'over') return NOTHING;
      const dt = Math.max(now - lastTick, 0) / 1000;
      lastTick = now;
      const spec = waveSpec(wave, config);
      const limit = Math.min(config.maxCats, Math.max(room, 0));

      // Arrivals that are due, one at a time, while there is room. A spawn that
      // cannot happen yet (full screen, no spot) is retried on the next tick.
      while (spawned < spec.count && now >= nextSpawnAt && cats.length < limit) {
        const spot = edgeSpot(player);
        if (!spot || types.length === 0) break;
        cats.push({
          id: nextId++,
          typeId: random.pick(types).id,
          ...spot,
          speed: spec.speed,
          attackAt: now + random.range(...config.attackAfterMs),
        });
        spawned++;
        nextSpawnAt = now + spec.spawnEveryMs;
      }

      // Each beam flies its whole step as a segment, so a long frame cannot carry it
      // past a cat; it hits the first cat along that segment. A small beam needs a
      // closer hit, a big one less.
      const beamed: FightCat[] = [];
      beams = beams.filter((beam) => {
        beam.vy += beam.gravity * dt;
        const from = { x: beam.x, y: beam.y };
        const to = { x: beam.x + beam.vx * dt, y: beam.y + beam.vy * dt };
        let hit: FightCat | null = null;
        let nearest = Infinity;
        for (const cat of cats) {
          if (distanceToSegment(cat, from, to) > config.beamRadius * beam.scale) continue;
          const along = (cat.x - from.x) * beam.vx + (cat.y - from.y) * beam.vy;
          if (along < nearest) {
            nearest = along;
            hit = cat;
          }
        }
        if (hit) {
          beamed.push({ ...hit });
          cats = cats.filter((cat) => cat !== hit);
          return false;
        }
        beam.x = to.x;
        beam.y = to.y;
        bounce(beam);
        return !offScreen(beam);
      });

      const touched: FightCat[] = [];
      const pounced: FightCat[] = [];
      cats = cats.filter((cat) => {
        const dx = player.x - cat.x;
        const dy = player.y - cat.y;
        const distance = Math.hypot(dx, dy);
        const step = cat.speed * dt;
        if (distance <= config.touchRadius + step) {
          touched.push({ ...cat, x: player.x, y: player.y });
          return false;
        }
        cat.x += (dx / distance) * step;
        cat.y += (dy / distance) * step;
        if (cat.attackAt !== null && now >= cat.attackAt) {
          cat.attackAt = null;
          pounced.push({ ...cat });
        }
        return true;
      });

      lives = Math.max(lives - touched.length, 0);
      if (lives === 0) {
        status = 'over';
        cats = [];
        beams = [];
        return { touched, pounced, beamed };
      }

      if (spawned >= spec.count && cats.length === 0) {
        score++;
        wave++;
        spawned = 0;
        nextSpawnAt = now + config.breakMs;
      }
      return { touched, pounced, beamed };
    },
  };
}

/** Where WASD and the arrow keys walk the character (KeyboardEvent.code). */
const WALK_KEYS: Readonly<Record<string, Vec>> = {
  KeyW: { x: 0, y: -1 },
  KeyA: { x: -1, y: 0 },
  KeyS: { x: 0, y: 1 },
  KeyD: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowDown: { x: 0, y: 1 },
  ArrowRight: { x: 1, y: 0 },
};

export const isWalkKey = (code: string) => code in WALK_KEYS;

/**
 * The way the held keys walk the character: a unit vector, or zero when none (or
 * only opposite ones) are held. A diagonal is no faster than a straight line.
 */
export function walkDirection(held: Iterable<string>): Vec {
  const keys = new Set(held);
  let x = 0;
  let y = 0;
  for (const code of keys) {
    const way = WALK_KEYS[code];
    if (!way) continue;
    x += way.x;
    y += way.y;
  }
  // WASD and an arrow key for the same way count once.
  x = Math.sign(x);
  y = Math.sign(y);
  const length = Math.hypot(x, y);
  return length === 0 ? { x: 0, y: 0 } : { x: x / length, y: y / length };
}

export const FACINGS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'] as const;
export type Facing = (typeof FACINGS)[number];

/** Which of eight ways the character at `from` faces to look at `to` (screen y grows down). */
export function facingTowards(from: Vec, to: Vec): Facing {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const eighth = Math.round(angle / (Math.PI / 4));
  return FACINGS[((eighth % 8) + 8) % 8];
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
