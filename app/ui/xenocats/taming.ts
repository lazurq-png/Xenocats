// Fight a cat, Taming mode, as a pure state machine (time and the ranger passed in).
//
// The ranger (walked with WASD, or the movement pad on a touch screen) carries
// treats to the cats. Treats turn up at random spots, a few at a time, and vanish
// if nobody picks them up; walking over one picks it up, one at a time. One cat at
// a time wanders the screen. While the ranger has no treat the cat keeps away: it
// flees a ranger who comes close, each type in its own way derived from its attack
// (DODGES), and attacks from a distance with its own effect. While the ranger
// carries a treat it stops all that and comes over; when they touch, the treat is
// given and the cat is tamed, and the next one comes. Nothing is ever lost.

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
  /** How fast the ranger walks, px/s (the game moves it; Survival's pace). */
  rangerSpeed: number;
  /** The ranger touches the cat within this distance of its centre, px. */
  catchRadius: number;
  /** Without a treat, the ranger this near makes the cat flee, px. */
  noticeRadius: number;
  /** Without a treat, the cat attacks the ranger from this near, px. */
  attackRange: number;
  /** How often it attacks while the ranger is in range, ms. */
  attackEveryMs: number;
  /** How fast a wandering cat walks, px/s. */
  walkSpeed: number;
  /** How fast a cat comes to a ranger carrying a treat, px/s. */
  approachSpeed: number;
  /** After a dodge the cat stays put this long before it flees again, ms. */
  calmMs: number;
  /** The pause before the next cat, ms. */
  breakMs: number;
  /** A new cat appears at least this far from the ranger, px. */
  keepAwayFromRanger: number;
  /** A new treat appears this often, ms, while there are fewer than `maxTreats`. */
  treatEveryMs: number;
  maxTreats: number;
  /** A treat nobody picks up vanishes after this long, ms. */
  treatLifeMs: number;
  /** The ranger picks a treat up within this distance of it, px. */
  pickupRadius: number;
};

export const TAMING_CONFIG: TamingConfig = {
  rangerSpeed: 280,
  catchRadius: CAT_CONFIG.catSize / 2 + 16,
  noticeRadius: 160,
  attackRange: 320,
  attackEveryMs: 2500,
  walkSpeed: 90,
  approachSpeed: 170,
  calmMs: 600,
  breakMs: 1200,
  keepAwayFromRanger: 240,
  treatEveryMs: 1800,
  maxTreats: 3,
  treatLifeMs: 9000,
  pickupRadius: 40,
};

/** What a cat can be won over with. Emoji for now: placeholders for real artwork. */
export const TREATS = [
  { kind: 'fish', name: 'Fish', emoji: '🐟' },
  { kind: 'catnip', name: 'Catnip', emoji: '🌿' },
  { kind: 'yarn', name: 'Yarn', emoji: '🧶' },
  { kind: 'milk', name: 'Milk', emoji: '🥛' },
] as const;

export type TreatKind = (typeof TREATS)[number]['kind'];

export const treatInfo = (kind: TreatKind) => TREATS.find((treat) => treat.kind === kind)!;

export type Treat = { id: number; kind: TreatKind; x: number; y: number; expiresAt: number };

export type TamingCat = {
  id: number;
  typeId: string;
  /** Centre, px. */
  x: number;
  y: number;
  /** What it is doing: a dodge's kind while dodging. */
  doing: 'wandering' | 'coming' | DodgeKind;
};

export type TamingSnapshot = {
  cat: TamingCat | null;
  treats: readonly Treat[];
  /** The treat the ranger carries, if any. */
  carrying: TreatKind | null;
  /** Type ids tamed this game, in order. */
  tamed: readonly string[];
};

/** What happened in one tick. */
export type TamingEvents = {
  /** The type id of a cat tamed this tick. */
  tamed: string | null;
  /** The cat, if it attacked the ranger this tick (its effect lands on the ranger). */
  attack: TamingCat | null;
  /** A treat the ranger picked up this tick. */
  picked: TreatKind | null;
};

type Motion = { from: Vec; to: Vec; startsAt: number; endsAt: number; kind: DodgeKind };

export type Taming = ReturnType<typeof createTaming>;

/**
 * Taming with treats. Time and the ranger's position are passed in, and anything
 * random comes from `random`, so it is tested in Node.
 */
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
  let nextAttackAt = -Infinity;
  let wanderTo: Vec | null = null;
  let treats: Treat[] = [];
  let nextTreatAt = options.now;
  let carrying: TreatKind | null = null;
  let tamed: string[] = [];

  const inset = CAT_CONFIG.catSize / 2;
  const randomSpot = (): Vec => ({
    x: random.range(inset, Math.max(viewport.width - inset, inset + 1)),
    y: random.range(inset, Math.max(viewport.height - inset, inset + 1)),
  });
  const view = (c: TamingCat): TamingCat => ({
    id: c.id,
    typeId: c.typeId,
    x: c.x,
    y: c.y,
    doing: c.doing,
  });

  function spawnCat(ranger: Vec, now: number) {
    let spot = randomSpot();
    for (let attempt = 0; attempt < 20; attempt++) {
      if (Math.hypot(spot.x - ranger.x, spot.y - ranger.y) >= config.keepAwayFromRanger) break;
      spot = randomSpot();
    }
    const type = random.pick(types);
    cat = { id: nextId++, typeId: type.id, type, ...spot, doing: 'wandering' };
    motion = null;
    wanderTo = null;
    calmUntil = -Infinity;
    // A moment to see it before it first attacks.
    nextAttackAt = now + config.attackEveryMs / 2;
  }

  /** Walks the cat towards `to` at `speed` for `dt` seconds; true once it is there. */
  function walk(to: Vec, speed: number, dt: number): boolean {
    if (!cat) return true;
    const dx = to.x - cat.x;
    const dy = to.y - cat.y;
    const distance = Math.hypot(dx, dy);
    const step = speed * dt;
    if (distance <= step) {
      cat.x = to.x;
      cat.y = to.y;
      return true;
    }
    cat.x += (dx / distance) * step;
    cat.y += (dy / distance) * step;
    return false;
  }

  /** The treats: old ones vanish, new ones come, and one under the ranger is picked up. */
  function tickTreats(now: number, ranger: Vec): TreatKind | null {
    treats = treats.filter((treat) => treat.expiresAt > now);
    if (now >= nextTreatAt) {
      if (treats.length < config.maxTreats) {
        const kind = random.pick(TREATS).kind;
        treats = [
          ...treats,
          { id: nextId++, kind, ...randomSpot(), expiresAt: now + config.treatLifeMs },
        ];
      }
      nextTreatAt = now + config.treatEveryMs;
    }
    if (carrying) return null;
    const reached = treats.find(
      (treat) => Math.hypot(treat.x - ranger.x, treat.y - ranger.y) <= config.pickupRadius
    );
    if (!reached) return null;
    treats = treats.filter((treat) => treat !== reached);
    carrying = reached.kind;
    return reached.kind;
  }

  return {
    config,

    resize(size: Size) {
      viewport = size;
    },

    snapshot(): TamingSnapshot {
      return { cat: cat ? view(cat) : null, treats: [...treats], carrying, tamed: [...tamed] };
    },

    /**
     * Advances to `now`, the ranger at `ranger`. `room` is how many more cats the
     * screen may hold (others count against the limit); no cat comes while it is 0.
     */
    tick(now: number, ranger: Vec, room = 1): TamingEvents {
      const dt = Math.max(now - lastTick, 0) / 1000;
      lastTick = now;
      const events: TamingEvents = { tamed: null, attack: null, picked: tickTreats(now, ranger) };

      if (!cat) {
        if (now >= nextCatAt && room > 0 && types.length > 0) spawnCat(ranger, now);
        return events;
      }

      // A dodge under way (or waiting for a slow cat to react) runs to its end.
      if (motion) {
        if (now < motion.startsAt) return events;
        const t = Math.min((now - motion.startsAt) / (motion.endsAt - motion.startsAt), 1);
        const eased = 1 - (1 - t) ** 3;
        cat.x = motion.from.x + (motion.to.x - motion.from.x) * eased;
        cat.y = motion.from.y + (motion.to.y - motion.from.y) * eased;
        cat.doing = motion.kind;
        if (t < 1) return events;
        motion = null;
        calmUntil = now + config.calmMs;
        wanderTo = null;
      }

      // A treat in hand: the cat stops fleeing and attacking and comes for it. When
      // they touch, the treat is given, the cat is tamed, and the next one comes.
      if (carrying) {
        cat.doing = 'coming';
        walk(ranger, config.approachSpeed, dt);
        if (Math.hypot(ranger.x - cat.x, ranger.y - cat.y) <= config.catchRadius) {
          const id = cat.typeId;
          tamed = [...tamed, id];
          cat = null;
          carrying = null;
          nextCatAt = now + config.breakMs;
          events.tamed = id;
        }
        return events;
      }

      const distance = Math.hypot(ranger.x - cat.x, ranger.y - cat.y);

      // No treat: the cat keeps away, attacking from a distance...
      if (distance <= config.attackRange && now >= nextAttackAt) {
        nextAttackAt = now + config.attackEveryMs;
        events.attack = view(cat);
      }

      // ...and fleeing a ranger who comes close, each kind in its own way.
      if (distance <= config.noticeRadius && now >= calmUntil) {
        const style = dodgeFor(cat.type);
        const startsAt = now + style.reactMs;
        motion = {
          from: { x: cat.x, y: cat.y },
          to: dodgeTarget(style, cat, ranger, viewport, random),
          startsAt,
          endsAt: startsAt + style.durationMs,
          kind: style.kind,
        };
        return events;
      }

      cat.doing = 'wandering';
      wanderTo ??= randomSpot();
      if (walk(wanderTo, config.walkSpeed, dt)) wanderTo = null;
      return events;
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
