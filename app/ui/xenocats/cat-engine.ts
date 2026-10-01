// The cats' lifecycle and spawner, as a pure state machine: time, the cursor and
// the attack itself are passed in, so tests drive it tick by tick.
//
//   appearing → sleeping → waking → ready → attacking → leaving → (gone)
//
// `ready` is where a cat waits while another cat's effect is still running: only
// one effect runs at a time, so its attack is retried every tick until accepted.
// A summoned cat skips sleeping and waking, unless it is summoned asleep.
//
// A sleeping cat with the pointer resting on it for `petMs` is petted: it purrs and
// sleeps on for at least `petSleepMs`. A sleeping cat clicked (`poke`) wakes at once,
// angry: its attack is `angryFactor` times stronger (effects.ts `strengthen`).

import type { CatType } from './cat-types';
import { CAT_CONFIG, type CatConfig, type Range } from './config';
import type { Size, Vec } from './effects';
import type { Random } from './random';

export type CatPhase = 'appearing' | 'sleeping' | 'waking' | 'ready' | 'attacking' | 'leaving';

export type Cat = {
  id: number;
  typeId: string;
  /** Top-left corner, px. */
  x: number;
  y: number;
  phase: CatPhase;
  phaseStartedAt: number;
  /** When this phase ends; Infinity while `ready`. */
  phaseEndsAt: number;
  /** Summoned cats attack as soon as they have arrived. */
  eager: boolean;
  /** Clicked awake: its attack is stronger. */
  angry: boolean;
  /** Has purred at least once. */
  petted: boolean;
  /** Since when the pointer has rested on it while it sleeps, or null. */
  petSince: number | null;
};

/** Called when a cat is ready to pounce; false while another effect still runs. */
export type TryAttack = (cat: Cat, type: CatType, centre: Vec) => boolean;

export type CatEngine = ReturnType<typeof createCatEngine>;

export function createCatEngine(options: {
  random: Random;
  types: readonly CatType[];
  viewport: Size;
  config?: Partial<CatConfig>;
  /** False on pages where cats only come when summoned (tests, the /cats page). */
  autoSpawn?: boolean;
}) {
  const { random, types } = options;
  const config: CatConfig = { ...CAT_CONFIG, ...options.config };
  const autoSpawn = options.autoSpawn ?? true;
  let viewport = options.viewport;
  let cats: Cat[] = [];
  let nextId = 1;
  let nextSpawnAt: number | null = null;

  const typeOf = (cat: Cat) => types.find((type) => type.id === cat.typeId)!;
  const between = ([min, max]: Range) => random.range(min, max);
  const centreOf = (cat: { x: number; y: number }): Vec => ({
    x: cat.x + config.catSize / 2,
    y: cat.y + config.catSize / 2,
  });

  /** True if `point` is on the cat's square. */
  const covers = (cat: Cat, point: Vec) =>
    point.x >= cat.x &&
    point.x <= cat.x + config.catSize &&
    point.y >= cat.y &&
    point.y <= cat.y + config.catSize;

  function setPhase(cat: Cat, phase: CatPhase, at: number, lasts: number) {
    cat.phase = phase;
    cat.phaseStartedAt = at;
    cat.phaseEndsAt = at + lasts;
  }

  /** A free spot: on screen, off the cursor, not on another cat. Null if none is found. */
  function findSpot(cursor: Vec | null): Vec | null {
    const { catSize, margin, keepAwayFromCursor } = config;
    const maxX = viewport.width - catSize - margin;
    const maxY = viewport.height - catSize - margin;
    if (maxX < margin || maxY < margin) return null;
    for (let attempt = 0; attempt < 30; attempt++) {
      const spot = { x: random.range(margin, maxX), y: random.range(margin, maxY) };
      const centre = centreOf(spot);
      if (cursor && Math.hypot(centre.x - cursor.x, centre.y - cursor.y) < keepAwayFromCursor) {
        continue;
      }
      const crowded = cats.some((other) => {
        const c = centreOf(other);
        // Two squares overlap unless they are a full cat apart on at least one axis.
        return Math.abs(centre.x - c.x) < catSize && Math.abs(centre.y - c.y) < catSize;
      });
      if (!crowded) return spot;
    }
    return null;
  }

  function spawn(type: CatType, now: number, cursor: Vec | null, eager: boolean): Cat | null {
    if (cats.length >= config.maxCats) return null;
    const spot = findSpot(cursor);
    if (!spot) return null;
    const cat: Cat = {
      id: nextId++,
      typeId: type.id,
      ...spot,
      phase: 'appearing',
      phaseStartedAt: now,
      phaseEndsAt: now + type.entranceMs,
      eager,
      angry: false,
      petted: false,
      petSince: null,
    };
    cats.push(cat);
    return cat;
  }

  return {
    config,

    resize(size: Size) {
      viewport = size;
    },

    cats(): readonly Cat[] {
      return cats;
    },

    centreOf,

    /**
     * Brings a cat of `typeId` on screen now; it attacks as soon as it has arrived,
     * or, `asleep`, first sleeps and wakes like a spawned cat. Null, and nothing
     * changes, when `maxCats` are already on screen, the type is unknown, or there
     * is no free spot.
     */
    summon(
      typeId: string,
      now: number,
      cursor: Vec | null,
      { asleep = false }: { asleep?: boolean } = {}
    ): Cat | null {
      const type = types.find((t) => t.id === typeId);
      return type ? spawn(type, now, cursor, !asleep) : null;
    },

    /**
     * A click at `point`: a sleeping cat under it wakes at once, angry. Returns
     * that cat, or null if the click hit no sleeping cat.
     */
    poke(point: Vec, now: number): Cat | null {
      const cat = cats.find((c) => c.phase === 'sleeping' && covers(c, point));
      if (!cat) return null;
      cat.angry = true;
      cat.petSince = null;
      setPhase(cat, 'waking', now, config.wakeMs);
      return cat;
    },

    /**
     * Advances every cat to `now`. Returns true if anything a renderer shows
     * changed. `onPurr` is called for each cat petted this tick.
     */
    tick(
      now: number,
      cursor: Vec | null,
      tryAttack: TryAttack,
      onPurr: (cat: Cat) => void = () => {}
    ): boolean {
      let changed = false;

      for (const cat of cats) {
        if (cat.phase !== 'sleeping' || !cursor || !covers(cat, cursor)) {
          cat.petSince = null;
          continue;
        }
        cat.petSince ??= now;
        if (now - cat.petSince >= config.petMs) {
          cat.petSince = now;
          cat.phaseEndsAt = Math.max(cat.phaseEndsAt, now + config.petSleepMs);
          if (!cat.petted) changed = true;
          cat.petted = true;
          onPurr(cat);
        }
      }

      if (autoSpawn) {
        nextSpawnAt ??= now + between(config.firstSpawnMs);
        if (now >= nextSpawnAt) {
          nextSpawnAt = now + between(config.spawnEveryMs);
          if (types.length > 0 && spawn(random.pick(types), now, cursor, false)) changed = true;
        }
      }

      for (const cat of cats) {
        const type = typeOf(cat);
        // Catch up through every phase that has already ended.
        for (;;) {
          if (cat.phase === 'ready') {
            if (!tryAttack(cat, type, centreOf(cat))) break;
            setPhase(cat, 'attacking', now, config.attackMs);
            changed = true;
            continue;
          }
          if (now < cat.phaseEndsAt) break;
          const at = cat.phaseEndsAt;
          changed = true;
          if (cat.phase === 'appearing') {
            if (cat.eager) setPhase(cat, 'ready', at, Infinity);
            else setPhase(cat, 'sleeping', at, between(config.sleepMs));
          } else if (cat.phase === 'sleeping') {
            setPhase(cat, 'waking', at, config.wakeMs);
          } else if (cat.phase === 'waking') {
            setPhase(cat, 'ready', at, Infinity);
          } else if (cat.phase === 'attacking') {
            setPhase(cat, 'leaving', at, type.exitMs);
          } else {
            // Finished leaving: marked for removal below.
            cat.phaseEndsAt = -Infinity;
            break;
          }
        }
      }

      const before = cats.length;
      cats = cats.filter((cat) => cat.phaseEndsAt !== -Infinity);
      return changed || cats.length !== before;
    },
  };
}
