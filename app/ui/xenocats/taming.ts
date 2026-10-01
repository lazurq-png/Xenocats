// Fight a cat, Taming mode, as a pure state machine (time and pointer passed in).
//
// One cat at a time wanders the screen. A pointer moving near it makes it dodge, each
// cat type in its own way, derived from its attack (DODGES). A pointer that keeps
// still makes it curious: it walks over and stops beneath it. Holding the pointer
// still on a cat for 2 s tames it, and the next cat comes.

import type { CatType } from './cat-types';
import { CAT_CONFIG } from './config';
import { type Size, type Vec, clampToViewport } from './effects';
import type { Random } from './random';

export type DodgeKind =
  /** Runs straight away from the pointer. */
  | 'dash'
  /** Vanishes and reappears somewhere else, at least `distance` from the pointer. */
  | 'blink'
  /** Steps aside, at right angles to the pointer. */
  | 'sidestep'
  /** Hops a short way in a random direction, away rather than towards. */
  | 'hop'
  /** Circles round the pointer by `distance` radians, a little further out. */
  | 'circle'
  /** Jumps to the mirror image of where it was, through the pointer. */
  | 'mirror'
  /** Drops straight down. */
  | 'drop'
  /** Moves away along one axis only, the one it is further along. */
  | 'axis';

export type Dodge = {
  kind: DodgeKind;
  /** px; radians for `circle`. */
  distance: number;
  /** How long the dodge takes, ms. */
  durationMs: number;
  /** How long the cat takes to notice the pointer before it dodges, ms. */
  reactMs: number;
};

const dodge = (kind: DodgeKind, distance: number, durationMs: number, reactMs = 0): Dodge => ({
  kind,
  distance,
  durationMs,
  reactMs,
});

/** Each attack's way of dodging, keyed by effect id. */
export const DODGES: Readonly<Record<string, Dodge>> = {
  // Void Tabby vanishes; Quantum Kitten teleports; Decoy Burmese and Smoke Bombay
  // slip away behind a decoy or a puff of smoke.
  vanish: dodge('blink', 260, 150),
  teleport: dodge('blink', 400, 60),
  decoys: dodge('blink', 200, 220),
  blur: dodge('blink', 160, 320),
  // Knockback and magnet push; the heavy and the giant lumber off; the lagging one
  // runs, but late.
  knockback: dodge('dash', 320, 250),
  magnet: dodge('dash', 200, 420),
  heavy: dodge('dash', 90, 900),
  giant: dodge('dash', 220, 700),
  delay: dodge('dash', 180, 400, 800),
  bounce: dodge('dash', 280, 300),
  // Static and drunk cats hop about; the tiny one in tiny hops.
  jitter: dodge('hop', 70, 120),
  drunk: dodge('hop', 120, 520),
  tiny: dodge('hop', 40, 100),
  // The cold one steps aside, slowly.
  freeze: dodge('sidestep', 70, 750),
  // Drifters, orbiters and spirals circle round the pointer.
  drift: dodge('circle', 0.8, 1200),
  orbit: dodge('circle', 1.6, 600),
  spiral: dodge('circle', 2.4, 900),
  reverse: dodge('mirror', 0, 300),
  fall: dodge('drop', 220, 450),
  'axis-lock': dodge('axis', 240, 260),
};

/** A cat type's dodge; a plain dash for an attack DODGES does not know. */
export const dodgeFor = (type: CatType): Dodge => DODGES[type.effect.id] ?? dodge('dash', 200, 400);

/**
 * Where a cat at `cat` dodges to from a pointer at `pointer`, on screen. Pure:
 * anything random comes from `random`.
 */
export function dodgeTarget(
  style: Dodge,
  cat: Vec,
  pointer: Vec,
  viewport: Size,
  random: Random
): Vec {
  const inset = CAT_CONFIG.catSize / 2;
  const keep = (point: Vec) =>
    clampToViewport(
      {
        x: Math.min(Math.max(point.x, inset), viewport.width - inset),
        y: Math.min(Math.max(point.y, inset), viewport.height - inset),
      },
      viewport
    );
  const dx = cat.x - pointer.x;
  const dy = cat.y - pointer.y;
  const length = Math.hypot(dx, dy);
  // Away from the pointer; any direction if it is right on top of the cat.
  const angle = length < 1e-6 ? random.next() * 2 * Math.PI : Math.atan2(dy, dx);
  const away = { x: Math.cos(angle), y: Math.sin(angle) };
  const { distance } = style;

  switch (style.kind) {
    case 'dash':
      return keep({ x: cat.x + away.x * distance, y: cat.y + away.y * distance });
    case 'blink': {
      for (let attempt = 0; attempt < 20; attempt++) {
        const spot = keep({
          x: random.range(inset, viewport.width - inset),
          y: random.range(inset, viewport.height - inset),
        });
        if (Math.hypot(spot.x - pointer.x, spot.y - pointer.y) >= distance) return spot;
      }
      return keep({ x: cat.x + away.x * distance, y: cat.y + away.y * distance });
    }
    case 'sidestep': {
      const side = random.next() < 0.5 ? 1 : -1;
      return keep({ x: cat.x - away.y * side * distance, y: cat.y + away.x * side * distance });
    }
    case 'hop': {
      // Within a half-circle facing away from the pointer.
      const turn = angle + (random.next() - 0.5) * Math.PI;
      return keep({ x: cat.x + Math.cos(turn) * distance, y: cat.y + Math.sin(turn) * distance });
    }
    case 'circle': {
      const radius = Math.max(length, inset) + 40;
      const turn = angle + (random.next() < 0.5 ? 1 : -1) * distance;
      return keep({
        x: pointer.x + Math.cos(turn) * radius,
        y: pointer.y + Math.sin(turn) * radius,
      });
    }
    case 'mirror':
      return keep({ x: pointer.x - dx, y: pointer.y - dy });
    case 'drop':
      return keep({ x: cat.x, y: cat.y + distance });
    case 'axis':
      return Math.abs(dx) >= Math.abs(dy)
        ? keep({ x: cat.x + Math.sign(dx || 1) * distance, y: cat.y })
        : keep({ x: cat.x, y: cat.y + Math.sign(dy || 1) * distance });
  }
}

export type TamingConfig = {
  /** Holding still on a cat this long tames it, ms. */
  tameMs: number;
  /** The pointer is on the cat within this distance of its centre, px. */
  catchRadius: number;
  /** A pointer that moves within this distance of the cat makes it dodge, px. */
  noticeRadius: number;
  /** A pointer is still while it stays within this distance, px. */
  stillPx: number;
  /** A pointer still this long makes the cat curious: it walks over, ms. */
  curiousAfterMs: number;
  /** How fast a wandering or curious cat walks, px/s. */
  walkSpeed: number;
  /** After a dodge the cat ignores the pointer this long, so it can be approached, ms. */
  calmMs: number;
  /** The pause before the next cat, ms. */
  breakMs: number;
  /** A new cat appears at least this far from the pointer, px. */
  keepAwayFromPointer: number;
};

export const TAMING_CONFIG: TamingConfig = {
  tameMs: 2000,
  catchRadius: CAT_CONFIG.catSize / 2,
  noticeRadius: 140,
  stillPx: 6,
  curiousAfterMs: 1000,
  walkSpeed: 110,
  calmMs: 500,
  breakMs: 1200,
  keepAwayFromPointer: 240,
};

export type TamingCat = {
  id: number;
  typeId: string;
  /** Centre, px. */
  x: number;
  y: number;
  /** What it is doing: a dodge's kind while dodging. */
  doing: 'wandering' | 'curious' | 'held' | DodgeKind;
};

export type TamingSnapshot = {
  cat: TamingCat | null;
  /** How far along the 2 s hold is, 0–1. */
  hold: number;
  /** Type ids tamed this game, in order. */
  tamed: readonly string[];
};

type Motion = { from: Vec; to: Vec; startsAt: number; endsAt: number; kind: DodgeKind };

export type Taming = ReturnType<typeof createTaming>;

export function createTaming(options: {
  random: Random;
  types: readonly CatType[];
  viewport: Size;
  now: number;
  config?: Partial<TamingConfig>;
}) {
  const { random, types } = options;
  const config: TamingConfig = { ...TAMING_CONFIG, ...options.config };
  let viewport = options.viewport;
  let cat: (TamingCat & { type: CatType }) | null = null;
  let nextCatAt = options.now + config.breakMs;
  let nextId = 1;
  let lastTick = options.now;
  let motion: Motion | null = null;
  let calmUntil = -Infinity;
  let wanderTo: Vec | null = null;
  /** Where the pointer has been keeping still, and since when. */
  let still: { at: Vec; since: number } | null = null;
  let holdSince: number | null = null;
  let tamed: string[] = [];

  const inset = CAT_CONFIG.catSize / 2;
  const randomSpot = (): Vec => ({
    x: random.range(inset, Math.max(viewport.width - inset, inset + 1)),
    y: random.range(inset, Math.max(viewport.height - inset, inset + 1)),
  });

  function spawn(pointer: Vec) {
    let spot = randomSpot();
    for (let attempt = 0; attempt < 20; attempt++) {
      if (Math.hypot(spot.x - pointer.x, spot.y - pointer.y) >= config.keepAwayFromPointer) break;
      spot = randomSpot();
    }
    const type = random.pick(types);
    cat = { id: nextId++, typeId: type.id, type, ...spot, doing: 'wandering' };
    motion = null;
    wanderTo = null;
    holdSince = null;
    calmUntil = -Infinity;
  }

  /** Walks the cat towards `to` for `dt` seconds; true once it is there. */
  function walk(to: Vec, dt: number): boolean {
    if (!cat) return true;
    const dx = to.x - cat.x;
    const dy = to.y - cat.y;
    const distance = Math.hypot(dx, dy);
    const step = config.walkSpeed * dt;
    if (distance <= step) {
      cat.x = to.x;
      cat.y = to.y;
      return true;
    }
    cat.x += (dx / distance) * step;
    cat.y += (dy / distance) * step;
    return false;
  }

  const holdProgress = (now: number) =>
    holdSince === null ? 0 : Math.min((now - holdSince) / config.tameMs, 1);

  return {
    config,

    resize(size: Size) {
      viewport = size;
    },

    snapshot(now: number): TamingSnapshot {
      return {
        cat: cat ? { id: cat.id, typeId: cat.typeId, x: cat.x, y: cat.y, doing: cat.doing } : null,
        hold: holdProgress(now),
        tamed: [...tamed],
      };
    },

    /**
     * Advances to `now`. `room` is how many more cats the screen may hold (others
     * count against the limit); no cat comes while it is 0. Returns the type id of
     * a cat tamed this tick, or null.
     */
    tick(now: number, pointer: Vec, room = 1): string | null {
      const dt = Math.max(now - lastTick, 0) / 1000;
      lastTick = now;

      // Is the pointer keeping still?
      const moved =
        !still || Math.hypot(pointer.x - still.at.x, pointer.y - still.at.y) > config.stillPx;
      if (moved) still = { at: pointer, since: now };
      const stillFor = now - still!.since;

      if (!cat) {
        if (now >= nextCatAt && room > 0 && types.length > 0) spawn(pointer);
        return null;
      }

      // A dodge under way (or waiting for a slow cat to react) runs to its end.
      if (motion) {
        if (now < motion.startsAt) return null;
        const t = Math.min((now - motion.startsAt) / (motion.endsAt - motion.startsAt), 1);
        const eased = 1 - (1 - t) ** 3;
        cat.x = motion.from.x + (motion.to.x - motion.from.x) * eased;
        cat.y = motion.from.y + (motion.to.y - motion.from.y) * eased;
        cat.doing = motion.kind;
        if (t < 1) return null;
        motion = null;
        calmUntil = now + config.calmMs;
        wanderTo = null;
      }

      const distance = Math.hypot(pointer.x - cat.x, pointer.y - cat.y);

      // A pointer moving close by: dodge.
      if (moved && distance <= config.noticeRadius && now >= calmUntil) {
        const style = dodgeFor(cat.type);
        const startsAt = now + style.reactMs;
        motion = {
          from: { x: cat.x, y: cat.y },
          to: dodgeTarget(style, cat, pointer, viewport, random),
          startsAt,
          endsAt: startsAt + style.durationMs,
          kind: style.kind,
        };
        holdSince = null;
        return null;
      }

      // Held: the pointer is on the cat and keeping still.
      if (!moved && distance <= config.catchRadius) {
        holdSince ??= now;
        cat.doing = 'held';
        if (now - holdSince >= config.tameMs) {
          const id = cat.typeId;
          tamed = [...tamed, id];
          cat = null;
          holdSince = null;
          nextCatAt = now + config.breakMs;
          return id;
        }
        return null;
      }
      holdSince = null;

      // A still pointer draws the cat over; otherwise it wanders.
      if (stillFor >= config.curiousAfterMs) {
        cat.doing = 'curious';
        walk(pointer, dt);
        wanderTo = null;
      } else {
        cat.doing = 'wandering';
        wanderTo ??= randomSpot();
        if (walk(wanderTo, dt)) wanderTo = null;
      }
      return null;
    },
  };
}

/** Tamed cats kept in localStorage: how many of each type, by id. */
export type TamedCollection = Readonly<Record<string, number>>;

export const TAMED_KEY = 'xenocats:tamed';

/** Reads a stored collection; anything malformed, or not a known type, is dropped. */
export function parseCollection(raw: string | null, types: readonly CatType[]): TamedCollection {
  if (!raw) return {};
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const known = new Set(types.map((type) => type.id));
  const collection: Record<string, number> = {};
  for (const [id, count] of Object.entries(value)) {
    if (known.has(id) && Number.isInteger(count) && (count as number) > 0) {
      collection[id] = count as number;
    }
  }
  return collection;
}

/** The collection with one more cat of `typeId`. */
export const addTamed = (collection: TamedCollection, typeId: string): TamedCollection => ({
  ...collection,
  [typeId]: (collection[typeId] ?? 0) + 1,
});
