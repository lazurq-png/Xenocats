import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ARENA_CONFIG,
  gemSize,
  type ArenaConfig,
  HERO_EFFECTS,
  attackShapeOf,
  catsWanted,
  createArena,
  pickupFor,
  runLengthConfig,
} from '@/app/ui/xenocats/arena';
import { createArenaGrid } from '@/app/ui/xenocats/arena-grid';
import { FUSIONS, MAX_WEAPON_LEVEL, WEAPONS, type WeaponId } from '@/app/ui/xenocats/arsenal';
import {
  SURVIVAL_BEST_KEY,
  bestKey,
  bestOf,
  clockText,
  parseBest,
  parseLength,
  SURVIVAL_GRAPHICS_KEY,
  readBest,
  readGraphics,
  readGraphicsAuto,
  readLength,
  subscribeGraphics,
  subscribeLength,
  writeGraphics,
  writeGraphicsAuto,
  writeBest,
  writeLength,
} from '@/app/ui/xenocats/arena-storage';
import { SCHEDULE, VARIETIES } from '@/app/ui/xenocats/varieties';
import {
  AUTO_JUDGE_FROM_MS,
  AUTO_JUDGE_UNTIL_MS,
  AUTO_MIN_FRAMES,
  AUTO_WINDOW_MS,
  parseGraphics,
  pixelRatioFor,
  shouldGoLight,
} from '@/app/ui/xenocats/graphics';
import {
  type Direction,
  DRAWN_DIRECTIONS,
  directionOf,
  directionOfAngle,
  facesAway,
  spriteOf,
} from '@/app/ui/xenocats/hero-direction';
import { CAT_TYPES, catTypeById } from '@/app/ui/xenocats/cat-types';
import { createFrameGuard } from '@/app/ui/xenocats/frame-guard';
import { createRandom } from '@/app/ui/xenocats/random';
import { stepTo, stepWhile } from './step-arena';

const viewport = { width: 1280, height: 800 };
const still = { x: 0, y: 0 };

/** Only the twenty xenocat types, as before the varieties: no swarms, no bosses. */
const xenocatsOnly: Partial<ArenaConfig> = {
  schedule: {
    arrivals: [{ from: 0, who: 'xenocat', weight: 1 }],
    swarms: { from: Infinity, everyMs: 1, size: [0, 0] },
    bosses: [],
  },
};

/** Gems worth nothing and chests out of reach: no level-up interrupts. */
const noLevels = {
  ...xenocatsOnly,
  gems: { ...ARENA_CONFIG.gems, value: 0, eliteValue: 0 },
  chestReach: -1,
};

function arena(config: Partial<ArenaConfig> = {}, seed = 1, types = CAT_TYPES) {
  return createArena({
    random: createRandom(seed),
    types,
    viewport,
    config: { ...noLevels, ...config },
  });
}

/** Steps until `ms` of game time, the hero walking `input`. */
function runTo(a: ReturnType<typeof arena>, ms: number, input = still, spawn = true) {
  stepWhile(
    a,
    () => a.state().time < ms && a.state().status === 'playing',
    () => a.step(input, spawn)
  );
}

/** A hero nothing can wear down, for watching the arena itself. */
const unbreakable = { hero: { ...ARENA_CONFIG.hero, resolve: 1e12 } };

describe('the hero', () => {
  it('walks the way he is told, at his speed, and faces it', () => {
    const a = arena({ escalation: [[0, 0]] });
    runTo(a, 1000, { x: 1, y: 0 });
    expect(a.state().hero.x).toBeCloseTo(ARENA_CONFIG.hero.speed, -1);
    expect(a.state().hero.y).toBe(0);
    runTo(a, 1500, { x: -1, y: 0 });
    expect(a.state().hero.facing).toBe(-1);
  });

  it('a cat that reaches him drains his Resolve, then he is untouchable for a moment', () => {
    // One kind of cat, made slow and hard to send home, coming at a hero who stands.
    const a = arena({
      escalation: [[0, 1]],
      cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [1e9, 1e9] },
    });
    let hits: number[] = [];
    for (let i = 0; i < 60 * 30 && hits.length < 3; i++) {
      a.step(still);
      for (const e of a.drainEvents()) if (e.kind === 'hero-hit') hits = [...hits, a.state().time];
    }
    expect(hits.length).toBe(3);
    expect(a.state().hero.resolve).toBeLessThan(ARENA_CONFIG.hero.resolve);
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i] - hits[i - 1]).toBeGreaterThanOrEqual(ARENA_CONFIG.hero.untouchableMs);
    }
  });

  it('each type drains its own amount', () => {
    const drained = new Set<number>();
    for (const type of CAT_TYPES.slice(0, 6)) {
      // One cat of the type, never sent home: what its first touch takes.
      const a = arena(
        {
          escalation: [[0, 1]],
          cats: { ...ARENA_CONFIG.cats, eliteShare: 0 },
          startingWeapons: [],
        },
        1,
        [type]
      );
      stepWhile(
        a,
        () => a.state().time < 60_000 && !a.drainEvents().some((e) => e.kind === 'hero-hit'),
        () => {
          a.step(still);
        }
      );
      drained.add(ARENA_CONFIG.hero.resolve - a.state().hero.resolve);
    }
    expect(drained.size).toBeGreaterThan(1);
  });

  it('his Resolve spent, the run is over', () => {
    const a = arena({ hero: { ...ARENA_CONFIG.hero, resolve: 5 }, escalation: [[0, 30]] });
    runTo(a, 120_000);
    expect(a.state().status).toBe('over');
    expect(a.state().outcome).toBe('spent');
    expect(a.drainEvents().some((e) => e.kind === 'over')).toBe(true);
  });

  it('giving up ends the run where it stands', () => {
    const a = arena();
    runTo(a, 2000);
    a.giveUp();
    expect(a.state()).toMatchObject({ status: 'over', outcome: 'gave-up', time: a.state().time });
    const time = a.state().time;
    a.step(still);
    expect(a.state().time).toBe(time);
  });
});

describe('elites', () => {
  it('every xenocat effect has a way of landing on the hero', () => {
    for (const type of CAT_TYPES) expect(HERO_EFFECTS[type.effect.id], type.id).toBeDefined();
  });

  /** A hero reached by elites of one type only; his state just after the first hit. */
  function afterElite(typeId: string, input = { x: 1, y: 0 }) {
    const a = arena(
      {
        escalation: [[0, 1]],
        cats: { ...ARENA_CONFIG.cats, eliteShare: 1, homesickness: [1e9, 1e9] },
        startingWeapons: [],
      },
      1,
      [catTypeById(typeId)!]
    );
    for (let i = 0; i < 60 * 30; i++) {
      a.step(still);
      if (a.drainEvents().some((e) => e.kind === 'hero-hit')) break;
    }
    const before = { ...a.state().hero };
    for (let i = 0; i < 30; i++) a.step(input);
    return { before, after: a.state().hero };
  }

  it('Cryo freezes him, Gravi slows him, Mirror turns his controls round', () => {
    const frozen = afterElite('cryo-persian');
    expect(frozen.after.effect).toBe('freeze');
    expect(frozen.after.x).toBeCloseTo(frozen.before.x, 5);
    const slowed = afterElite('gravi-coon');
    expect(slowed.after.effect).toBe('slow');
    expect(slowed.after.x - slowed.before.x).toBeLessThan(ARENA_CONFIG.hero.speed * 0.5 * 0.4);
    const reversed = afterElite('mirror-sphynx');
    expect(reversed.after.x).toBeLessThan(reversed.before.x);
  });

  it('one effect at a time: another elite reaching him meanwhile changes nothing', () => {
    // Elites of two kinds, reaching him again and again (untouchable only briefly).
    const a = arena(
      {
        escalation: [[0, 30]],
        cats: { ...ARENA_CONFIG.cats, eliteShare: 1, homesickness: [1e9, 1e9] },
        hero: { ...ARENA_CONFIG.hero, resolve: 1e9, untouchableMs: 100 },
        startingWeapons: [],
      },
      3,
      [catTypeById('cryo-persian')!, catTypeById('gravi-coon')!]
    );
    let current: string | null = null;
    let since = 0;
    let effects = 0;
    let hitsDuringEffect = 0;
    for (let i = 0; i < 60 * 40; i++) {
      a.step(still);
      const time = a.state().time;
      const hit = a.drainEvents().some((e) => e.kind === 'hero-hit');
      const effect = a.state().hero.effect;
      // While one may still last it stays the one, whoever else reaches him; once
      // it has run its course another may follow at once.
      const mayHaveEnded = time - since >= ARENA_CONFIG.cats.effectMaxMs;
      if (current !== null && effect !== null && !mayHaveEnded) {
        expect(effect).toBe(current);
        if (hit) hitsDuringEffect++;
      }
      if (effect !== null && (current === null || (effect !== current && mayHaveEnded))) {
        effects++;
        since = time;
      }
      current = effect;
    }
    expect(effects).toBeGreaterThan(1);
    expect(hitsDuringEffect).toBeGreaterThan(0);
  });

  it('plain cats lay none', () => {
    const a = arena({
      escalation: [[0, 40]],
      cats: { ...ARENA_CONFIG.cats, eliteShare: 0 },
      hero: { ...ARENA_CONFIG.hero, resolve: 1e9 },
    });
    for (let i = 0; i < 60 * 20; i++) {
      a.step(still);
      expect(a.state().hero.effect).toBeNull();
    }
  });
});

describe('the horde', () => {
  it('cats appear just off screen, all round, and walk at the hero', () => {
    const a = arena({ ...unbreakable, escalation: [[0, 40]] });
    a.step(still);
    runTo(a, 3000);
    const half = Math.hypot(viewport.width, viewport.height) / 2;
    const cats = a.cats();
    expect(cats.length).toBeGreaterThan(5);
    const sides = new Set(
      cats.map((c) => `${Math.sign(Math.round(c.x))}${Math.sign(Math.round(c.y))}`)
    );
    expect(sides.size).toBeGreaterThanOrEqual(3);
    const distances = cats.map((c) => Math.hypot(c.x, c.y));
    expect(Math.max(...distances)).toBeLessThanOrEqual(half + ARENA_CONFIG.cats.spawnMargin + 1);
    const before = cats.map((c) => Math.hypot(c.x, c.y));
    const ids = cats.map((c) => c.id);
    a.step(still);
    const after = a.cats();
    for (let i = 0; i < ids.length; i++) {
      const cat = after.find((c) => c.id === ids[i]);
      if (cat) expect(Math.hypot(cat.x, cat.y)).toBeLessThanOrEqual(before[i]);
    }
  });

  it('escalates on time: a few at first, dozens by a minute, hundreds by two and a half, thousands by four', () => {
    expect(catsWanted(0)).toBe(3);
    // A seeded run, the laser kept quiet so the count shows the arrivals alone.
    const a = arena({
      ...unbreakable,
      stepMs: 50,
      startingWeapons: [],
    });
    const at = (ms: number) => {
      runTo(a, ms);
      return a.state().cats;
    };
    const first = at(20_000);
    expect(first).toBeGreaterThanOrEqual(2);
    expect(first).toBeLessThanOrEqual(10);
    expect(at(60_000)).toBeGreaterThanOrEqual(24);
    expect(at(150_000)).toBeGreaterThanOrEqual(200);
    expect(at(240_000)).toBeGreaterThanOrEqual(1000);
    // (Four minutes of a growing crowd: a few seconds, more beside the other files.)
  }, 20_000);

  it('while the frame-rate guard says no, only the first few cats come; more when it says yes', () => {
    const free = ARENA_CONFIG.cats.guardFree;
    const a = arena({
      ...unbreakable,
      escalation: [[0, 400]],
      startingWeapons: [],
    });
    runTo(a, 20_000, still, false);
    // Even a screen too slow from the start gets a game...
    expect(a.state().cats).toBe(free);
    // ...and no more than that until the guard allows it.
    runTo(a, 25_000, still, true);
    expect(a.state().cats).toBeGreaterThan(free);
  });
});

describe('the Laser Pointer', () => {
  it('points at the nearest cat; enough homesickness sends a cat home', () => {
    const a = arena({
      ...unbreakable,
      escalation: [[0, 6]],
      cats: { ...ARENA_CONFIG.cats, eliteShare: 0 },
    });
    let lasers = 0;
    let home = 0;
    runTo(a, 1);
    stepTo(a, 40_000, () => {
      a.step(still);
      for (const e of a.drainEvents()) {
        if (e.kind === 'laser') lasers++;
        if (e.kind === 'sent-home') home++;
      }
    });
    expect(lasers).toBeGreaterThan(5);
    expect(home).toBeGreaterThan(0);
    expect(a.state().sentHome).toBe(home);
    expect(a.state().weapons).toEqual([{ id: 'laser-pointer', level: 1 }]);
  });

  it('fires no more often than its cooldown, and not at a cat out of range', () => {
    const a = arena({ ...unbreakable, escalation: [[0, 0]] });
    runTo(a, 10_000);
    expect(a.drainEvents().filter((e) => e.kind === 'laser')).toEqual([]);
    const b = arena({ ...unbreakable, escalation: [[0, 30]] });
    const times: number[] = [];
    stepTo(b, 20_000, () => {
      b.step(still);
      for (const e of b.drainEvents()) if (e.kind === 'laser') times.push(b.state().time);
    });
    for (let i = 1; i < times.length; i++) {
      expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(
        WEAPONS['laser-pointer'].levels[0].cooldownMs - 1
      );
    }
  });
});

describe('the laser, with a cat right on the Keeper', () => {
  it('points the way he faces, and touches nothing behind him', () => {
    // Cats from every side reach him before the laser first fires (at 20 s).
    const a = arena({
      ...unbreakable,
      escalation: [[0, 30]],
      // (Not eased apart: the cat on him stays on him.)
      cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [1e9, 1e9], spacing: 0 },
      firstShotMs: 20_000,
    });
    let beam: { from: { x: number; y: number }; to: { x: number; y: number } } | null = null;
    stepWhile(
      a,
      () => !beam && a.state().time < 30_000,
      () => {
        a.step(still);
        for (const e of a.drainEvents()) if (e.kind === 'laser') beam = e;
      }
    );
    expect(beam).not.toBeNull();
    const cats = a.cats();
    expect(cats.some((c) => Math.hypot(c.x, c.y) < 0.5)).toBe(true);
    const ux = beam!.to.x - beam!.from.x;
    const uy = beam!.to.y - beam!.from.y;
    const touched = cats.filter((c) => c.homesickness > 0);
    const behind = cats.filter((c) => c.x * ux + c.y * uy < -1);
    expect(behind.length).toBeGreaterThan(0);
    for (const cat of touched) expect(cat.x * ux + cat.y * uy).toBeGreaterThanOrEqual(-0.5);
    // The cat on him is the one aimed at: it is touched too.
    for (const cat of cats.filter((c) => Math.hypot(c.x, c.y) < 0.5)) {
      expect(cat.homesickness).toBeGreaterThan(0);
    }
    expect(touched.length).toBeLessThan(cats.length);
  });
});

describe('the time goal', () => {
  it('at five minutes the Matriarch comes, and ends the run when she reaches him', () => {
    const a = arena({ ...unbreakable, stepMs: 50, escalation: [[0, 0]] });
    const seen: string[] = [];
    stepWhile(
      a,
      () => a.state().status === 'playing' && a.state().time < 320_000,
      () => {
        a.step(still);
        for (const e of a.drainEvents()) seen.push(e.kind);
      }
    );
    expect(a.state().time).toBeGreaterThanOrEqual(ARENA_CONFIG.timeGoalMs);
    expect(seen).toContain('matriarch');
    expect(a.state().outcome).toBe('goal');
  });

  it('his Resolve spent after the time goal still counts as the goal reached', () => {
    // No cat until five minutes, then a crowd; the Matriarch never arrives.
    const a = arena({
      stepMs: 50,
      escalation: [
        [0, 0],
        [ARENA_CONFIG.timeGoalMs, 0],
        [ARENA_CONFIG.timeGoalMs + 1, 60],
      ],
      matriarch: { ...ARENA_CONFIG.matriarch, speed: 0 },
      hero: { ...ARENA_CONFIG.hero, resolve: 10 },
      startingWeapons: [],
    });
    runTo(a, ARENA_CONFIG.timeGoalMs + 120_000);
    expect(a.state().status).toBe('over');
    expect(a.state().hero.resolve).toBe(0);
    expect(a.state().time).toBeGreaterThan(ARENA_CONFIG.timeGoalMs);
    expect(a.state().outcome).toBe('goal');
  });

  it('nothing sends the Matriarch home: she is not a cat the laser can touch', () => {
    const a = arena({ ...unbreakable, stepMs: 50, escalation: [[0, 0]] });
    runTo(a, ARENA_CONFIG.timeGoalMs + 50);
    expect(a.matriarch()).not.toBeNull();
    expect(a.cats().length).toBe(0);
  });
});

describe('a seeded run', () => {
  it('plays out the same every time', () => {
    const play = () => {
      const a = arena({}, 42);
      runTo(a, 60_000, { x: 0.6, y: 0.8 });
      const s = a.state();
      return [s.time, s.cats, s.sentHome, s.hero.resolve, Math.round(s.hero.x)];
    };
    expect(play()).toEqual(play());
  });
});

describe('the spatial grid', () => {
  it('finds every point within the radius, as checking them all would', () => {
    const random = createRandom(9);
    const points = Array.from({ length: 500 }, () => ({
      x: random.range(-1000, 1000),
      y: random.range(-1000, 1000),
    }));
    const grid = createArenaGrid(64);
    points.forEach((p, i) => grid.insert(i, p.x, p.y));
    const out: number[] = [];
    for (let q = 0; q < 50; q++) {
      const at = { x: random.range(-1000, 1000), y: random.range(-1000, 1000) };
      const radius = random.range(10, 300);
      const found = grid
        .query(at.x, at.y, radius, out)
        .filter((i) => Math.hypot(points[i].x - at.x, points[i].y - at.y) <= radius)
        .sort((a, b) => a - b);
      const brute = points
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => Math.hypot(p.x - at.x, p.y - at.y) <= radius)
        .map(({ i }) => i);
      expect(found).toEqual(brute);
    }
    grid.clear();
    expect(grid.query(0, 0, 2000, out)).toEqual([]);
  });
});

describe('the frame-rate guard', () => {
  it('stops cats coming below the floor, and lets them come again above the resume mark', () => {
    const guard = createFrameGuard({ floorFps: 40, resumeFps: 50, smoothing: 0.5 });
    expect(guard.allowsSpawning()).toBe(true);
    for (let i = 0; i < 20; i++) guard.record(1000 / 60);
    expect(guard.allowsSpawning()).toBe(true);
    for (let i = 0; i < 20; i++) guard.record(1000 / 30);
    expect(guard.allowsSpawning()).toBe(false);
    // Between the two marks: still no.
    for (let i = 0; i < 20; i++) guard.record(1000 / 45);
    expect(guard.allowsSpawning()).toBe(false);
    for (let i = 0; i < 20; i++) guard.record(1000 / 60);
    expect(guard.allowsSpawning()).toBe(true);
    expect(guard.fps()).toBeGreaterThan(55);
  });
});

describe('the best time', () => {
  it('keeps the longer run, and reads anything unreadable as none', () => {
    expect(bestOf(null, 61_000)).toBe(61_000);
    expect(bestOf(90_000, 61_000)).toBe(90_000);
    expect(parseBest(null)).toBeNull();
    expect(parseBest('not a number')).toBeNull();
    expect(parseBest('-5')).toBeNull();
    expect(parseBest('1e99')).toBeNull();
    expect(parseBest('123456')).toBe(123456);
    expect(clockText(0)).toBe('0:00');
    expect(clockText(65_400)).toBe('1:05');
    expect(clockText(300_000)).toBe('5:00');
  });
});

describe('balance: positioning is the skill', () => {
  /**
   * How long a Keeper lasts in the game as configured (seeded; stepped at 50 ms, as
   * the arsenal's simulation tests are), standing still or walking a wide circle. The
   * secret cat is left out: it comes only to a Keeper who stands still, and his
   * laser would spend itself on a cat that does no harm — another effect than this.
   */
  function lasts(seed: number, walking: boolean) {
    const a = createArena({
      random: createRandom(seed),
      types: CAT_TYPES,
      viewport,
      config: { stepMs: 50, secretCat: { afterMs: Infinity, stillMs: Infinity } },
    });
    stepWhile(
      a,
      () => a.state().status !== 'over' && a.state().time < 300_000,
      () => {
        // The same policy for both: the first of each level-up's offer.
        if (a.choices()) {
          a.choose(0);
          return;
        }
        const t = a.state().time / 4000;
        a.step(walking ? { x: Math.cos(t), y: Math.sin(t) } : { x: 0, y: 0 });
      }
    );
    return a.state().time;
  }

  it('a Keeper who stands still is worn down early; one who keeps walking lasts much longer', () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    const still = seeds.map((seed) => lasts(seed, false));
    const walking = seeds.map((seed) => lasts(seed, true));
    const ratios = seeds.map((_, i) => walking[i] / still[i]).sort((a, b) => a - b);
    // Standing still: gone within the first two minutes, every time.
    for (const ms of still) expect(ms).toBeLessThan(100_000);
    // Walking: twice as long in the middle of the seeds; more than half as long again
    // on all but one; past two minutes on most. (Counts, not every seed, so a change
    // that only reshuffles the shared random draws does not fail it on one seed.)
    expect((ratios[3] + ratios[4]) / 2).toBeGreaterThan(2);
    expect(ratios.filter((r) => r > 1.5).length).toBeGreaterThanOrEqual(7);
    expect(walking.filter((ms) => ms > 120_000).length).toBeGreaterThanOrEqual(6);
  }, 60_000);
});

describe('the camera on a small screen', () => {
  const at = (viewport: { width: number; height: number }, coop = false) =>
    createArena({
      random: createRandom(1),
      types: CAT_TYPES,
      viewport,
      config: coop
        ? { secondPlayer: { startingWeapons: ['spray-bottle'], speed: 210, resolve: 100 } }
        : {},
    });
  const narrower = (v: { width: number; height: number }) => Math.min(v.width, v.height);

  it('a desktop or a tablet sees the arena unzoomed', () => {
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 1920, height: 1080 },
      { width: 768, height: 1024 },
      // Browser windows, not screens: a laptop's bars take 80 to 130 px.
      { width: 1366, height: 650 },
      { width: 1280, height: 720 },
      { width: 1536, height: 730 },
    ]) {
      expect(at(viewport).camera().zoom, `${viewport.width}×${viewport.height}`).toBe(1);
    }
  });

  it('a phone sees at least as much as the rule says, across its narrower side', () => {
    const { minView, maxZoom } = ARENA_CONFIG.view;
    // About as much as the smallest common laptop window shows across its narrower
    // side (1366 × 768 with a browser's bars: about 650): at least 640.
    expect(minView).toBeGreaterThanOrEqual(640);
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
      { width: 360, height: 740 },
    ]) {
      const { zoom } = at(viewport).camera();
      expect(zoom).toBeGreaterThan(1);
      expect(zoom).toBeLessThanOrEqual(maxZoom);
      // What the screen shows of the arena, across its narrower side.
      expect(narrower(viewport) * zoom).toBeCloseTo(minView);
    }
  });

  it('a very small screen zooms out no further than keeps the cats readable', () => {
    const { zoom } = at({ width: 280, height: 500 }).camera();
    expect(zoom).toBe(ARENA_CONFIG.view.maxZoom);
  });

  it('a resized window changes the zoom with it', () => {
    const a = at({ width: 1280, height: 800 });
    a.resize({ width: 390, height: 844 });
    expect(a.camera().zoom).toBeCloseTo(ARENA_CONFIG.view.minView / 390);
    a.resize({ width: 1280, height: 800 });
    expect(a.camera().zoom).toBe(1);
  });

  it('co-op on a phone: starts at the phone’s zoom, and zooms out on top of it', () => {
    const viewport = { width: 390, height: 844 };
    const base = ARENA_CONFIG.view.minView / 390;
    const a = at(viewport, true);
    expect(a.camera().zoom).toBeCloseTo(base);
    // Player 1 walks left, player 2 right: the camera widens, up to its co-op limit.
    for (let i = 0; i < 600; i++) a.step({ x: -1, y: 0 }, false, { x: 1, y: 0 });
    const { zoom } = a.camera();
    expect(zoom).toBeGreaterThan(base);
    expect(zoom).toBeLessThanOrEqual(base * ARENA_CONFIG.coop.maxZoomOut + 1e-9);
  });
});

describe('the run length', () => {
  it('five minutes is the game as it was: the same goal, bosses and cats', () => {
    expect(runLengthConfig(5)).toEqual({
      timeGoalMs: 300_000,
      schedule: { ...SCHEDULE, bosses: [120_000, 240_000] },
      slots: ARENA_CONFIG.slots,
    });
    expect(ARENA_CONFIG.slots).toEqual({ weapons: 6, passives: 6 });
    expect(SCHEDULE.bosses).toEqual([120_000, 240_000]);
    const play = (config: Partial<ArenaConfig>) => {
      const a = arena({ ...unbreakable, stepMs: 50, schedule: SCHEDULE, ...config }, 3);
      runTo(a, 150_000);
      return JSON.stringify([a.cats(), a.state().sentHome]);
    };
    expect(play(runLengthConfig(5))).toBe(play({}));
  });

  it('ten and fifteen minutes: the goal moves, and a Mega Cat comes every two minutes before it', () => {
    expect(runLengthConfig(10).timeGoalMs).toBe(600_000);
    expect(runLengthConfig(10).schedule?.bosses).toEqual([120_000, 240_000, 360_000, 480_000]);
    expect(runLengthConfig(15).timeGoalMs).toBe(900_000);
    expect(runLengthConfig(15).schedule?.bosses).toEqual(
      [1, 2, 3, 4, 5, 6, 7].map((n) => n * 120_000)
    );
  });

  it('a longer run holds more: 8 weapons and 8 passives at ten minutes, 10 of each at fifteen', () => {
    expect(runLengthConfig(10).slots).toEqual({ weapons: 8, passives: 8 });
    expect(runLengthConfig(15).slots).toEqual({ weapons: 10, passives: 10 });
  });

  it('a ten-minute run offers a seventh weapon where a five-minute one offers none', () => {
    // Six weapons held: does any level-up offer a new one?
    const six: WeaponId[] = [
      'laser-pointer',
      'cat-treats',
      'spray-bottle',
      'yarn-ball',
      'can-opener',
      'feather-wand',
    ];
    // A chest under him at the start: opened at once, it brings a level-up's offer.
    // Over twenty seeds, whether any offer has a weapon he does not hold.
    const offersNew = (minutes: number) =>
      Array.from({ length: 20 }, (_, seed) => {
        const a = arena(
          {
            escalation: [[0, 0]],
            startingWeapons: six,
            startingChests: 1,
            chestReach: ARENA_CONFIG.chestReach,
            ...runLengthConfig(minutes),
          },
          seed + 1
        );
        a.step(still);
        return a.choices()!.some((c) => c.kind === 'weapon' && c.level === 1);
      }).some(Boolean);
    expect(offersNew(5)).toBe(false);
    expect(offersNew(10)).toBe(true);
    expect(offersNew(0)).toBe(true);
  });

  it('endless: no goal, so no Matriarch; the Mega Cats keep coming; no limit on slots', () => {
    const endless = runLengthConfig(0);
    expect(endless.timeGoalMs).toBe(Infinity);
    expect(endless.slots).toEqual({ weapons: Infinity, passives: Infinity });
    const bosses = endless.schedule!.bosses;
    expect(bosses.slice(0, 3)).toEqual([120_000, 240_000, 360_000]);
    // Every two minutes, for far longer than anyone plays.
    expect(bosses[bosses.length - 1]).toBeGreaterThan(20 * 3_600_000);
    const a = arena({ ...unbreakable, stepMs: 50, escalation: [[0, 0]], ...endless });
    runTo(a, 920_000);
    expect(a.matriarch()).toBeNull();
    expect(a.state().status).toBe('playing');
    expect(a.state().goalMs).toBe(Infinity);
    expect(a.state().slots.weapons).toBe(Infinity);
  });

  it('the Matriarch comes at the chosen time, not at five minutes', () => {
    const a = arena({ ...unbreakable, stepMs: 50, escalation: [[0, 0]], ...runLengthConfig(10) });
    runTo(a, 310_000);
    expect(a.matriarch()).toBeNull();
    expect(a.state().status).toBe('playing');
    runTo(a, 610_000);
    expect(a.matriarch()).not.toBeNull();
    expect(a.state().goalMs).toBe(600_000);
  });

  // Plain cats only, arriving all the time, and nothing to send them home.
  const plain = {
    ...unbreakable,
    stepMs: 50,
    startingWeapons: [],
    // Not the secret cat, which sits by a Keeper who stands still.
    secretCat: { afterMs: Infinity, stillMs: Infinity },
    escalation: [
      [0, 10],
      [300_000, 10],
      [900_000, 400],
    ] as [number, number][],
    schedule: {
      arrivals: [{ from: 0, who: 'basic' as const, weight: 1 }],
      swarms: { from: Infinity, everyMs: 1, size: [0, 0] as [number, number] },
      bosses: [],
    },
    timeGoalMs: 15 * 60_000,
  };

  it('cats are as strong at five minutes as they always were, and tougher after', () => {
    const base = ARENA_CONFIG.cats;
    expect(base).toBeDefined();
    const a = arena(plain);
    runTo(a, 300_000);
    const limits = new Set(a.cats().map((cat) => cat.limit));
    const speeds = new Set(a.cats().map((cat) => cat.speed));
    expect(limits.size).toBe(1);
    expect(speeds.size).toBe(1);
    const [limit] = limits;
    const [speed] = speeds;
    runTo(a, 600_000);
    // A cat arriving at 10:00 has 5 minutes of toughness: +150% Homesickness, +15% speed.
    const late = Math.max(...a.cats().map((cat) => cat.limit));
    expect(late).toBeGreaterThan(limit * 2.45);
    expect(late).toBeLessThanOrEqual(limit * 2.5 + 1e-9);
    expect(Math.max(...a.cats().map((cat) => cat.speed))).toBeGreaterThan(speed * 1.14);
    expect(Math.max(...a.cats().map((cat) => cat.speed))).toBeLessThanOrEqual(speed * 1.15 + 1e-9);
  });

  it('a five-minute run stays as it was after 5:00, until the Matriarch reaches him', () => {
    const a = arena({
      ...plain,
      timeGoalMs: 300_000,
      matriarch: { ...ARENA_CONFIG.matriarch, speed: 0 },
      // Not the kittens she calls: they are weaker cats of their own.
      bossAttack: {
        ...ARENA_CONFIG.bossAttack,
        summon: { ...ARENA_CONFIG.bossAttack.summon, firstMs: Infinity },
      },
    });
    runTo(a, 300_000);
    const [limit] = new Set(a.cats().map((cat) => cat.limit));
    const [speed] = new Set(a.cats().map((cat) => cat.speed));
    runTo(a, 330_000);
    expect(a.matriarch()).not.toBeNull();
    expect(new Set(a.cats().map((cat) => cat.limit))).toEqual(new Set([limit]));
    expect(new Set(a.cats().map((cat) => cat.speed))).toEqual(new Set([speed]));
  });

  it('they grow quicker only up to the cap', () => {
    const a = arena({
      ...plain,
      toughness: { ...ARENA_CONFIG.toughness, speedPerMin: 1, maxSpeedFactor: 1.3 },
    });
    runTo(a, 300_000);
    const [speed] = new Set(a.cats().map((cat) => cat.speed));
    runTo(a, 480_000);
    expect(Math.max(...a.cats().map((cat) => cat.speed))).toBeCloseTo(speed * 1.3, 6);
  });

  it('in an endless run the cats grow quicker past the cap, and keep growing', () => {
    // (The endless growth brought forward to 6:00 and steepened, so the test is short.)
    const toughness = {
      ...ARENA_CONFIG.toughness,
      endless: { ...ARENA_CONFIG.toughness.endless, fromMs: 360_000, speedPerMin: 1 },
    };
    const a = arena({ ...runLengthConfig(0), ...plain, timeGoalMs: Infinity, toughness });
    runTo(a, 300_000);
    const [speed] = new Set(a.cats().map((cat) => cat.speed));
    runTo(a, 420_000);
    // A cat arriving at 7:00: a minute at 3%, then a minute at 100%.
    const at7 = Math.max(...a.cats().map((cat) => cat.speed));
    expect(at7).toBeGreaterThan(speed * toughness.maxSpeedFactor);
    expect(at7).toBeLessThanOrEqual(speed * (2 + ARENA_CONFIG.toughness.speedPerMin) + 1e-9);
    runTo(a, 480_000);
    expect(Math.max(...a.cats().map((cat) => cat.speed))).toBeGreaterThan(at7);
  });

  /** What each touch took from his Resolve, by when it landed: one Basic Cat (drain 2), no weapons. */
  function touches(config: Partial<ArenaConfig>, until: number) {
    const a = arena({
      ...plain,
      hero: { ...ARENA_CONFIG.hero, resolve: 1e6 },
      escalation: [[0, 1]],
      ...config,
      // Not the Mega Cats a run length brings: one Basic Cat, alone.
      schedule: plain.schedule,
    });
    const taken: { time: number; loss: number }[] = [];
    stepWhile(
      a,
      () => a.state().time < until,
      () => {
        const before = a.state().hero.resolve;
        a.step(still);
        if (a.drainEvents().some((e) => e.kind === 'hero-hit')) {
          taken.push({ time: a.state().time, loss: before - a.state().hero.resolve });
        }
      }
    );
    return taken;
  }

  it('in an endless run a touch takes more each minute past the endless mark, from cats of any age', () => {
    // (The mark brought forward to 1:00, and each minute doubling, so the test is short.)
    const endless = { ...ARENA_CONFIG.toughness.endless, fromMs: 60_000, drainPerMin: 1 };
    const taken = touches(
      {
        ...runLengthConfig(0),
        timeGoalMs: Infinity,
        toughness: { ...ARENA_CONFIG.toughness, endless },
      },
      180_000
    );
    // The one cat came in the first second and never went home: it still hurts more.
    expect(taken.filter((t) => t.time < 60_000).length).toBeGreaterThan(0);
    expect(taken.filter((t) => t.time > 150_000).length).toBeGreaterThan(0);
    for (const { time, loss } of taken) {
      const expected = 2 * 2 ** (Math.max(time - 60_000, 0) / 60_000);
      expect(loss, `at ${time} ms`).toBeCloseTo(expected, 6);
    }
  });

  it('a run with a length never grows its touches', () => {
    const endless = { ...ARENA_CONFIG.toughness.endless, fromMs: 60_000, drainPerMin: 1 };
    const taken = touches(
      { ...runLengthConfig(15), toughness: { ...ARENA_CONFIG.toughness, endless } },
      180_000
    );
    expect(taken.filter((t) => t.time > 150_000).length).toBeGreaterThan(0);
    for (const { loss } of taken) expect(loss).toBe(2);
  });

  it('the crowd stays at its peak past five minutes', () => {
    expect(catsWanted(300_000)).toBe(catsWanted(900_000));
    expect(catsWanted(600_000)).toBe(ARENA_CONFIG.cats.hardCap);
  });
});

describe('the best time per run length', () => {
  afterEach(() => vi.unstubAllGlobals());

  const stubStorage = () => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
      },
    });
    return store;
  };

  it('a stored length is five, ten, fifteen or endless (0), else five', () => {
    expect(parseLength('10')).toBe(10);
    expect(parseLength('15')).toBe(15);
    expect(parseLength('5')).toBe(5);
    expect(parseLength('0')).toBe(0);
    for (const raw of [null, '', '7', 'abc', '10.5', '-5', 'endless'])
      expect(parseLength(raw), String(raw)).toBe(5);
  });

  it('five minutes keeps the old key, so a best from before counts as the five-minute best', () => {
    expect(bestKey(5)).toBe(SURVIVAL_BEST_KEY);
    expect(new Set([bestKey(5), bestKey(10), bestKey(15), bestKey(0)]).size).toBe(4);
    expect(bestKey(0)).toBe(`${SURVIVAL_BEST_KEY}:endless`);
    const store = stubStorage();
    store.set(SURVIVAL_BEST_KEY, '250000');
    expect(readBest()).toBe(250_000);
    expect(readBest(5)).toBe(250_000);
    expect(readBest(10)).toBeNull();
  });

  it('with storage blocked, the length chosen lasts until the page is left', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    expect(readLength()).toBe(5);
    let told = 0;
    const stop = subscribeLength(() => told++);
    writeLength(15);
    expect(readLength()).toBe(15);
    expect(told).toBe(1);
    stop();
    // Endless (0) is kept too.
    writeLength(0);
    expect(readLength()).toBe(0);
    writeLength(5);
    expect(told).toBe(1);
    expect(readLength()).toBe(5);
    // And no best time is kept, but nothing throws.
    expect(() => writeBest(100_000, 10)).not.toThrow();
    expect(readBest(10)).toBeNull();
  });

  it('each length keeps its own best', () => {
    stubStorage();
    writeBest(400_000, 10);
    writeBest(120_000, 5);
    expect(readBest(10)).toBe(400_000);
    expect(readBest(5)).toBe(120_000);
    expect(readBest(15)).toBeNull();
  });
});

describe('elites', () => {
  it('are about a third as common as they were: 13% of the xenocats', () => {
    expect(ARENA_CONFIG.cats.eliteShare).toBe(0.13);
    const a = arena({ ...unbreakable, stepMs: 50, escalation: [[0, 150]] }, 11);
    let xenocats = 0;
    let elites = 0;
    stepTo(a, 180_000, () => {
      a.step(still);
      for (const e of a.drainEvents()) {
        if (e.kind !== 'xenocat') continue;
        xenocats++;
        if (e.elite) elites++;
      }
    });
    expect(xenocats).toBeGreaterThan(300);
    expect(elites / xenocats).toBeGreaterThan(0.09);
    expect(elites / xenocats).toBeLessThan(0.17);
  });
});

describe('an elite attack', () => {
  /** One elite of this type at a time, no weapons, a Keeper nothing can wear down. */
  const lone = (id: string, config: Partial<ArenaConfig> = {}) =>
    arena(
      {
        ...unbreakable,
        stepMs: 50,
        escalation: [[0, 1]],
        startingWeapons: [],
        secretCat: { afterMs: Infinity, stillMs: Infinity },
        cats: { ...ARENA_CONFIG.cats, eliteShare: 1 },
        ...config,
      },
      1,
      [catTypeById(id)!]
    );
  type Event = ReturnType<ReturnType<typeof lone>['drainEvents']>[number];

  /** Steps (the Keeper still, or walking) until an event of this kind, and says it. */
  function until(a: ReturnType<typeof lone>, kind: Event['kind'], input = still) {
    for (let i = 0; i < 4000; i++) {
      a.step(input);
      for (const e of a.drainEvents()) if (e.kind === kind) return e;
    }
    throw new Error(`no ${kind}`);
  }
  const heroAt = (a: ReturnType<typeof lone>) => a.state().hero;

  it('draws its attack from the effect: a burst for the freezes and pulls, a bolt for the pushes, a dash for the rest', () => {
    expect(attackShapeOf(HERO_EFFECTS.freeze)).toBe('burst');
    expect(attackShapeOf(HERO_EFFECTS.heavy)).toBe('burst');
    expect(attackShapeOf(HERO_EFFECTS.magnet)).toBe('burst');
    expect(attackShapeOf(HERO_EFFECTS.knockback)).toBe('bolt');
    expect(attackShapeOf(HERO_EFFECTS.fall)).toBe('bolt');
    expect(attackShapeOf(HERO_EFFECTS.teleport)).toBe('bolt');
    expect(attackShapeOf(HERO_EFFECTS.jitter)).toBe('bolt');
    expect(attackShapeOf(HERO_EFFECTS.reverse)).toBe('dash');
    expect(attackShapeOf(HERO_EFFECTS['axis-lock'])).toBe('dash');
    expect(attackShapeOf(HERO_EFFECTS.vanish)).toBe('dash');
  });

  it('never begins out of range: a bolt or a dash within its range, a burst nearer', () => {
    const e = ARENA_CONFIG.eliteAttack;
    for (const [id, shape, range] of [
      ['pulsar-siamese', 'bolt', e.range],
      ['laser-ocicat', 'dash', e.range],
      ['cryo-persian', 'burst', e.burstRange],
    ] as const) {
      const a = lone(id);
      const wind = until(a, 'wind-up');
      if (wind.kind !== 'wind-up') throw new Error('x');
      const h = heroAt(a);
      expect(wind.shape, id).toBe(shape);
      expect(Math.hypot(wind.x - h.x, wind.y - h.y), id).toBeLessThanOrEqual(range + 5);
      // And it came from outside that range: nothing attacked before it was near.
      expect(a.state().time, id).toBeGreaterThan(2000);
    }
  });

  it('winds up for its time, standing still, warning where it will go; then lets it loose', () => {
    const a = lone('pulsar-siamese');
    const wind = until(a, 'wind-up');
    if (wind.kind !== 'wind-up') throw new Error('x');
    const began = a.state().time;
    const aimed = { x: heroAt(a).x, y: heroAt(a).y };
    expect(a.state().windUps).toBe(1);
    const [warning] = a.telegraphs();
    expect(warning).toMatchObject({
      shape: 'bolt',
      boss: false,
      x: wind.x,
      y: wind.y,
      aimX: aimed.x,
      aimY: aimed.y,
      radius: ARENA_CONFIG.eliteAttack.bolt.radius,
    });
    expect(warning.progress).toBeLessThan(0.2);
    const cat = () => a.cats().find((c) => c.elite)!;
    const place = { x: cat().x, y: cat().y };
    const loose = until(a, 'elite-attack');
    expect(a.state().time - began).toBeGreaterThanOrEqual(ARENA_CONFIG.eliteAttack.windUpMs - 1);
    expect(a.state().time - began).toBeLessThanOrEqual(ARENA_CONFIG.eliteAttack.windUpMs + 100);
    expect({ x: cat().x, y: cat().y }).toEqual(place);
    expect(loose).toMatchObject({ kind: 'elite-attack', shape: 'bolt' });
    // One shot, the elite's, on its way to where he stood.
    const shots = a.shots().filter((s) => s.kind === 'elite');
    expect(shots).toHaveLength(1);
    const [shot] = shots;
    const toAim = Math.atan2(aimed.y - place.y, aimed.x - place.x);
    expect(Math.abs(Math.atan2(shot.vy, shot.vx) - toAim)).toBeLessThan(0.05);
    expect(a.state().windUps).toBe(0);
    expect(a.telegraphs()).toEqual([]);
  });

  /**
   * Winds an elite of `id` up, walks the Keeper `way` (a unit vector, or a function of
   * the elite's place and his) until it lets loose, then stands him still for `ms`;
   * says how far he then was from where it aimed, and the hits of each kind meanwhile.
   */
  function dodge(
    id: string,
    way: (
      from: { x: number; y: number },
      him: { x: number; y: number }
    ) => { x: number; y: number },
    ms: number
  ) {
    const a = lone(id);
    const wind = until(a, 'wind-up');
    if (wind.kind !== 'wind-up') throw new Error('x');
    const aim = { ...heroAt(a) };
    until(a, 'elite-attack', way(wind, aim));
    const out = Math.hypot(heroAt(a).x - aim.x, heroAt(a).y - aim.y);
    const hits = { touch: 0, shot: 0, dash: 0, pounce: 0 };
    const end = a.state().time + ms;
    while (a.state().time < end) {
      a.step(still);
      for (const e of a.drainEvents()) if (e.kind === 'hero-hit') hits[e.how]++;
    }
    return { a, out, hits };
  }
  const outward = (from: { x: number; y: number }, him: { x: number; y: number }) => {
    const len = Math.hypot(him.x - from.x, him.y - from.y) || 1;
    return { x: (him.x - from.x) / len, y: (him.y - from.y) / len };
  };
  const sideways = (from: { x: number; y: number }, him: { x: number; y: number }) => {
    const o = outward(from, him);
    return { x: -o.y, y: o.x };
  };

  it('a bolt follows a Keeper who stepped out of where it was aimed, and lays its effect on him', () => {
    const { a, out, hits } = dodge('pulsar-siamese', outward, 3000);
    // Well out of where it was aimed (an old blast's reach there, 70 px) when it flew...
    expect(out).toBeGreaterThan(150);
    // ...and it reached him all the same.
    expect(hits.shot).toBe(1);
    expect(heroAt(a).effect).not.toBeNull();
  });

  it('a burst flies on past its warning: walking straight out is no escape, a step between its shots is', () => {
    // Straight out from the elite: along the spoke aimed at him.
    const out = dodge('cryo-persian', outward, 3000);
    expect(out.out).toBeGreaterThan(150);
    expect(out.hits.shot).toBe(1);
    expect(heroAt(out.a).effect).toBe('freeze');
    // A step aside, a third of a second, between two spokes: every shot flies past.
    const a = lone('cryo-persian');
    const wind = until(a, 'wind-up');
    if (wind.kind !== 'wind-up') throw new Error('x');
    const step = sideways(wind, heroAt(a));
    for (let i = 0; i < 6; i++) a.step(step);
    until(a, 'elite-attack');
    let shot = 0;
    for (let i = 0; i < 40; i++) {
      a.step(still);
      for (const e of a.drainEvents()) if (e.kind === 'hero-hit' && e.how === 'shot') shot++;
    }
    expect(shot).toBe(0);
    // They have flown on past him, all eight.
    const him = heroAt(a);
    const flying = a.shots().filter((s) => s.kind === 'elite');
    expect(flying).toHaveLength(ARENA_CONFIG.eliteAttack.burst.shots);
    for (const s of flying) {
      expect(Math.hypot(s.x - wind.x, s.y - wind.y)).toBeGreaterThan(
        Math.hypot(him.x - wind.x, him.y - wind.y)
      );
    }
  });

  it('a dash turns after a Keeper who stepped out of its lane, and strikes him', () => {
    const { a, out, hits } = dodge('laser-ocicat', sideways, 1200);
    // Well out of the lane it was warned along (its width) when it set off...
    expect(out).toBeGreaterThan(ARENA_CONFIG.eliteAttack.dash.width * 2);
    // ...and it ran him down all the same.
    expect(hits.dash).toBe(1);
    expect(heroAt(a).effect).not.toBeNull();
  });

  it('a dash is warned as a lane, and stops when the elite is held still', () => {
    const a = lone('laser-ocicat');
    until(a, 'wind-up');
    const [warning] = a.telegraphs();
    const d = ARENA_CONFIG.eliteAttack.dash;
    expect(warning).toMatchObject({
      shape: 'dash',
      length: (d.speed * d.ms) / 1000,
      width: d.width,
    });
    until(a, 'elite-attack', { x: 0, y: -1 });
    const dashing = a.cats().find((c) => c.elite)!;
    expect(dashing.dashUntil).toBeGreaterThan(a.state().time);
    dashing.stunUntil = a.state().time + 500;
    a.step(still);
    expect(dashing.dashUntil).toBe(0);
    const place = { x: dashing.x, y: dashing.y };
    a.step(still);
    expect({ x: dashing.x, y: dashing.y }).toEqual(place);
  });

  it('the count of elites winding up falls when one is held still, or sent home, mid-wind-up', () => {
    // The cats are the arena's own objects: held and made homesick here by hand.
    const held = lone('pulsar-siamese');
    until(held, 'wind-up');
    expect(held.state().windUps).toBe(1);
    const winding = held.cats().find((c) => c.windUntil > 0)!;
    winding.stunUntil = held.state().time + 2000;
    held.step(still);
    expect(winding.windUntil).toBe(0);
    expect(held.state().windUps).toBe(0);
    expect(held.telegraphs()).toEqual([]);

    const home = lone('pulsar-siamese');
    until(home, 'wind-up');
    const going = home.cats().find((c) => c.windUntil > 0)!;
    going.homesickness = going.limit;
    home.step(still);
    expect(home.cats().some((c) => c.id === going.id)).toBe(false);
    expect(home.state().windUps).toBe(0);
    expect(home.state().windUpsBegun).toBe(1);
  });

  it('rests between attacks, and an ordinary cat never attacks', () => {
    const a = lone('pulsar-siamese');
    until(a, 'wind-up');
    until(a, 'elite-attack');
    const landed = a.state().time;
    const again = until(a, 'wind-up');
    expect(again.kind).toBe('wind-up');
    expect(a.state().time - landed).toBeGreaterThanOrEqual(
      ARENA_CONFIG.eliteAttack.cooldownMs - 100
    );

    const plain = lone('pulsar-siamese', { cats: { ...ARENA_CONFIG.cats, eliteShare: 0 } });
    for (let i = 0; i < 1200; i++) {
      plain.step(still);
      for (const e of plain.drainEvents())
        expect(['wind-up', 'elite-attack']).not.toContain(e.kind);
    }
  });
});

describe('which way a Keeper faces', () => {
  // East, clockwise on the screen (y grows downward), 45° apart.
  const ORDER: Direction[] = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  const eighth = Math.PI / 4;

  it('each of the eight directions is the 45° sector centred on it', () => {
    ORDER.forEach((direction, k) => {
      const centre = k * eighth;
      expect(directionOfAngle(centre), direction).toBe(direction);
      // Well inside its sector, either side.
      expect(directionOfAngle(centre + eighth * 0.4), direction).toBe(direction);
      expect(directionOfAngle(centre - eighth * 0.4), direction).toBe(direction);
      // Full turns, either way, change nothing.
      expect(directionOfAngle(centre + 2 * Math.PI), direction).toBe(direction);
      expect(directionOfAngle(centre - 4 * Math.PI), direction).toBe(direction);
    });
  });

  it('at every boundary the way tips over just past it, and an exact boundary goes clockwise', () => {
    ORDER.forEach((direction, k) => {
      const next = ORDER[(k + 1) % 8];
      const boundary = k * eighth + eighth / 2;
      expect(directionOfAngle(boundary - 1e-9), `just before ${next}`).toBe(direction);
      expect(directionOfAngle(boundary + 1e-9), `just past ${direction}`).toBe(next);
    });
    // Exactly between east and south-east.
    expect(directionOfAngle(Math.PI / 8)).toBe('SE');
  });

  it('a way (dx right, dy down) names the same direction; no way at all is east', () => {
    expect(directionOf(1, 0)).toBe('E');
    expect(directionOf(1, 1)).toBe('SE');
    expect(directionOf(0, 1)).toBe('S');
    expect(directionOf(-1, 1)).toBe('SW');
    expect(directionOf(-1, 0)).toBe('W');
    expect(directionOf(-1, -1)).toBe('NW');
    expect(directionOf(0, -1)).toBe('N');
    expect(directionOf(1, -1)).toBe('NE');
    expect(directionOf(0, 0)).toBe('E');
    expect(directionOfAngle(Number.NaN)).toBe('E');
    expect(directionOfAngle(Infinity)).toBe('E');
  });

  it('five are drawn; the other three are those mirrored', () => {
    expect(DRAWN_DIRECTIONS).toEqual(['N', 'NE', 'E', 'SE', 'S']);
    for (const d of DRAWN_DIRECTIONS) expect(spriteOf(d)).toEqual({ drawn: d, mirrored: false });
    expect(spriteOf('SW')).toEqual({ drawn: 'SE', mirrored: true });
    expect(spriteOf('W')).toEqual({ drawn: 'E', mirrored: true });
    expect(spriteOf('NW')).toEqual({ drawn: 'NE', mirrored: true });
    // He holds his tool behind him when he faces away.
    expect(ORDER.filter(facesAway)).toEqual(['NW', 'N', 'NE']);
  });

  /** One Keeper with the Laser Pointer, cats coming one at a time (none: a quiet arena). */
  function look(cats: number, config: Partial<ArenaConfig> = {}) {
    return arena({ ...unbreakable, stepMs: 50, escalation: [[0, cats]], ...config });
  }
  const lookAngle = (a: ReturnType<typeof look>) => a.state().heroes[0].lookAngle;

  it('with nothing to aim at he looks the way he walked last', () => {
    const a = look(0);
    expect(lookAngle(a)).toBe(0);
    a.step({ x: 0, y: -1 });
    expect(directionOfAngle(lookAngle(a))).toBe('N');
    a.step({ x: -1, y: 1 });
    expect(directionOfAngle(lookAngle(a))).toBe('SW');
    // Standing still, he keeps looking where he was.
    for (let i = 0; i < 20; i++) a.step(still);
    expect(directionOfAngle(lookAngle(a))).toBe('SW');
  });

  it('with the crosshair he looks at it, the moment it moves', () => {
    const a = look(0);
    for (let k = 0; k < 8; k++) {
      const angle = k * eighth;
      a.aimAt({ x: Math.cos(angle) * 300, y: Math.sin(angle) * 300 });
      a.step(still);
      expect(lookAngle(a)).toBeCloseTo(angle > Math.PI ? angle - 2 * Math.PI : angle, 6);
      expect(directionOfAngle(lookAngle(a))).toBe(ORDER[k]);
    }
    // Put away, he goes back to the way he walked.
    a.aimAt(null);
    a.step({ x: 1, y: 0 });
    expect(directionOfAngle(lookAngle(a))).toBe('E');
  });

  it('with automatic aim he looks at the cat his first aiming weapon would fire at', () => {
    const a = look(1, { cats: { ...ARENA_CONFIG.cats, homesickness: [1e9, 1e9] } });
    let checked = 0;
    for (let i = 0; i < 4000 && checked < 3; i++) {
      a.step(still);
      const h = a.state().hero;
      const near = a
        .cats()
        .filter((c) => Math.hypot(c.x - h.x, c.y - h.y) < 280)
        .sort((p, q) => Math.hypot(p.x - h.x, p.y - h.y) - Math.hypot(q.x - h.x, q.y - h.y))[0];
      // Only a cat well away from east, where he looks before he has a cat to look at.
      if (!near || Math.abs(Math.atan2(near.y - h.y, near.x - h.x)) < 1.2) continue;
      // He looks for a cat five times a second, so give him a moment to have seen it.
      for (let j = 0; j < 6; j++) a.step(still);
      const now = a.cats()[0];
      const toCat = Math.atan2(now.y - h.y, now.x - h.x);
      const apart = Math.abs(
        Math.atan2(Math.sin(lookAngle(a) - toCat), Math.cos(lookAngle(a) - toCat))
      );
      expect(apart).toBeLessThan(0.6);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('he looks for a cat with his first weapon that aims, and skips those that do not', () => {
    const quiet = { cats: { ...ARENA_CONFIG.cats, homesickness: [1e9, 1e9] as [number, number] } };
    const faced = (weapons: WeaponId[]) => {
      const a = look(1, { startingWeapons: weapons, ...quiet });
      const seen = new Set<string>();
      for (let i = 0; i < 4000; i++) {
        a.step(still);
        seen.add(directionOfAngle(lookAngle(a)));
      }
      return seen;
    };
    // The vacuum's hum aims at nothing: he never turns from the way he walked (east).
    expect([...faced(['thunderous-vacuum'])]).toEqual(['E']);
    // With a laser behind it he turns to the cats, though the vacuum comes first.
    expect(faced(['thunderous-vacuum', 'laser-pointer']).size).toBeGreaterThan(1);
    expect(faced(['laser-pointer']).size).toBeGreaterThan(1);
    // The Hair Dryer (the Hairdresser's own) looks where its jet looks, so the tool points where the air goes.
    expect(faced(['hair-dryer']).size).toBeGreaterThan(1);
  });

  it('in co-op each Keeper looks his own way: the crosshair is player 1’s alone', () => {
    const a = arena({
      ...unbreakable,
      stepMs: 50,
      escalation: [[0, 0]],
      secondPlayer: { startingWeapons: ['spray-bottle'], speed: 210, resolve: 1e12 },
    });
    a.aimAt({ x: 300, y: 0 });
    a.step(still, true, { x: 0, y: -1 });
    const [first, second] = a.state().heroes;
    expect(directionOfAngle(first.lookAngle)).toBe('E');
    expect(directionOfAngle(second.lookAngle)).toBe('N');
  });
});

describe('the Graphics setting', () => {
  afterEach(() => vi.unstubAllGlobals());

  const stubStorage = (blocked = false) => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => {
          if (blocked) throw new Error('blocked');
          return store.get(key) ?? null;
        },
        setItem: (key: string, value: string) => {
          if (blocked) throw new Error('blocked');
          store.set(key, value);
        },
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    return store;
  };

  it('a stored setting is full or light; anything else is full', () => {
    expect(parseGraphics('light')).toBe('light');
    expect(parseGraphics('full')).toBe('full');
    for (const raw of [null, '', 'Light', 'dark', '1'])
      expect(parseGraphics(raw), String(raw)).toBe('full');
  });

  it('is kept in the browser, and told to those who watch it', () => {
    const store = stubStorage();
    expect(readGraphics()).toBe('full');
    let told = 0;
    const stop = subscribeGraphics(() => told++);
    writeGraphics('light');
    expect(store.get(SURVIVAL_GRAPHICS_KEY)).toBe('light');
    expect(readGraphics()).toBe('light');
    expect(told).toBe(1);
    stop();
    writeGraphics('full');
    expect(told).toBe(1);
    expect(readGraphics()).toBe('full');
  });

  it('light draws at one pixel to a pixel, however sharp the screen; full at the screen’s own', () => {
    expect(pixelRatioFor('light', 2)).toBe(1);
    expect(pixelRatioFor('light', 3)).toBe(1);
    expect(pixelRatioFor('full', 2)).toBe(2);
    expect(pixelRatioFor('full', 1)).toBe(1);
    // A missing or nonsense ratio is one.
    expect(pixelRatioFor('full', 0)).toBe(1);
    expect(pixelRatioFor('full', Number.NaN)).toBe(1);
  });

  // 25 fps for 3 s of the judging window: 75 frames in 3000 ms.
  const slow = {
    graphics: 'full' as const,
    switchedBefore: false,
    runMs: 4500,
    windowMs: 3000,
    windowFrames: 75,
    floorFps: 40,
  };

  it('a run switches itself to light only for a slow machine, early, once', () => {
    expect(shouldGoLight(slow)).toBe(true);
    // A machine at or above the floor keeps full graphics (40 fps: 80 frames in 2000 ms).
    expect(shouldGoLight({ ...slow, windowMs: 2000, windowFrames: 80 })).toBe(false);
    expect(shouldGoLight({ ...slow, windowMs: 2000, windowFrames: 79 })).toBe(true);
    expect(shouldGoLight({ ...slow, windowMs: 3000, windowFrames: 180 })).toBe(false);
    // Light already, or switched before (the player changed it back): never again.
    expect(shouldGoLight({ ...slow, graphics: 'light' })).toBe(false);
    expect(shouldGoLight({ ...slow, switchedBefore: true })).toBe(false);
    // Not on too short a window, nor too few frames, nor after the first seconds.
    expect(shouldGoLight({ ...slow, windowMs: AUTO_WINDOW_MS - 1, windowFrames: 40 })).toBe(false);
    expect(shouldGoLight({ ...slow, windowMs: AUTO_WINDOW_MS, windowFrames: 40 })).toBe(true);
    expect(shouldGoLight({ ...slow, windowMs: 3000, windowFrames: AUTO_MIN_FRAMES - 1 })).toBe(
      false
    );
    expect(shouldGoLight({ ...slow, windowMs: 3000, windowFrames: AUTO_MIN_FRAMES })).toBe(true);
    expect(shouldGoLight({ ...slow, runMs: AUTO_JUDGE_UNTIL_MS })).toBe(true);
    expect(shouldGoLight({ ...slow, runMs: AUTO_JUDGE_UNTIL_MS + 1 })).toBe(false);
    expect(AUTO_JUDGE_FROM_MS).toBeLessThan(AUTO_JUDGE_UNTIL_MS);
  });

  it('one stalled frame on a good machine does not tip it: the mean decides', () => {
    // 2 s at 60 fps (120 frames), with one 250 ms stall in it: a mean of 55 fps.
    const frames = 120;
    const ms = (frames - 1) * 16 + 250;
    expect(shouldGoLight({ ...slow, windowMs: ms, windowFrames: frames })).toBe(false);
    // The same stall on a machine that really is slow still counts with the rest.
    expect(shouldGoLight({ ...slow, windowMs: 3000, windowFrames: 60 })).toBe(true);
  });

  it('the one switch is remembered', () => {
    const store = stubStorage();
    expect(readGraphicsAuto()).toBe(false);
    writeGraphicsAuto();
    expect(readGraphicsAuto()).toBe(true);
    expect(store.size).toBe(1);
  });

  it('with storage blocked the choice and the flag last until the page is left', async () => {
    // Fresh module state: the fallbacks are module-level.
    vi.resetModules();
    stubStorage(true);
    const fresh = await import('@/app/ui/xenocats/arena-storage');
    expect(fresh.readGraphics()).toBe('full');
    expect(fresh.readGraphicsAuto()).toBe(false);
    fresh.writeGraphics('light');
    expect(fresh.readGraphics()).toBe('light');
    expect(() => fresh.writeGraphicsAuto()).not.toThrow();
    expect(fresh.readGraphicsAuto()).toBe(true);
  });
});

describe('the bosses attack', () => {
  const noCats = { startingWeapons: [], secretCat: { afterMs: Infinity, stillMs: Infinity } };
  const MEGA_DRAIN = 25;

  /** The Mega Cat alone, from the start, and a Keeper with Resolve to lose. */
  const mega = () =>
    arena({
      ...noCats,
      stepMs: 50,
      escalation: [[0, 0]],
      schedule: { ...xenocatsOnly.schedule!, bosses: [0] },
    });
  type Run = ReturnType<typeof mega>;
  type Ev = ReturnType<Run['drainEvents']>[number];

  function until(a: Run, kind: Ev['kind'], input = still) {
    for (let i = 0; i < 6000; i++) {
      a.step(input);
      for (const e of a.drainEvents()) if (e.kind === kind) return e;
    }
    throw new Error(`no ${kind}`);
  }
  const bigOne = (a: Run) => a.cats().find((c) => c.variety === 'mega')!;

  it('the Mega Cat near a Keeper stands still and winds up, warning where it will land', () => {
    const a = mega();
    const wind = until(a, 'wind-up');
    if (wind.kind !== 'wind-up') throw new Error('x');
    expect(wind.shape).toBe('blast');
    const h = a.state().hero;
    expect(Math.hypot(wind.x - h.x, wind.y - h.y)).toBeLessThanOrEqual(
      ARENA_CONFIG.bossAttack.pounce.range + 5
    );
    expect(a.state().bossWindUp).toBe('pounce');
    expect(a.state().windUps).toBe(1);
    const [warning] = a.telegraphs();
    expect(warning).toMatchObject({
      shape: 'blast',
      aimX: h.x,
      aimY: h.y,
      radius: ARENA_CONFIG.bossAttack.pounce.radius,
    });
    const place = { x: bigOne(a).x, y: bigOne(a).y };
    for (let i = 0; i < 10; i++) a.step(still);
    expect({ x: bigOne(a).x, y: bigOne(a).y }).toEqual(place);
  });

  it('it lands where the Keeper stood: a Keeper who stayed loses Resolve, one who walked away does not', () => {
    const stay = mega();
    until(stay, 'wind-up');
    const before = stay.state().hero.resolve;
    const strike = until(stay, 'boss-pounce');
    expect(strike).toMatchObject({ kind: 'boss-pounce', hits: 1 });
    expect(stay.state().hero.resolve).toBe(before - MEGA_DRAIN);
    // It is where he stood now.
    const there = bigOne(stay);
    const him = stay.state().hero;
    expect(Math.hypot(there.x - him.x, there.y - him.y)).toBeLessThan(5);
    expect(stay.state().bossWindUp).toBeNull();

    const away = mega();
    const wind = until(away, 'wind-up');
    if (wind.kind !== 'wind-up') throw new Error('x');
    const h = away.state().hero;
    const len = Math.hypot(h.x - wind.x, h.y - wind.y) || 1;
    // Out from the Mega Cat, after a third of a second to notice.
    for (let i = 0; i < 6; i++) away.step(still);
    const full = away.state().hero.resolve;
    const dodge = until(away, 'boss-pounce', { x: (h.x - wind.x) / len, y: (h.y - wind.y) / len });
    expect(dodge).toMatchObject({ hits: 0 });
    expect(away.state().hero.resolve).toBe(full);
  });

  it('a Mega Cat sent home mid-wind-up leaves no wind-up behind', () => {
    const a = mega();
    until(a, 'wind-up');
    expect(a.state().bossWindUp).toBe('pounce');
    expect(a.state().bossWindUpsBegun).toBe(1);
    const big = bigOne(a);
    big.homesickness = big.limit;
    a.step(still);
    expect(a.cats().some((c) => c.variety === 'mega')).toBe(false);
    expect(a.state().windUps).toBe(0);
    expect(a.state().bossWindUp).toBeNull();
    expect(a.telegraphs()).toEqual([]);
  });

  it('held still mid-wind-up, it loses the pounce and rests its own time, not an elite’s', () => {
    const a = mega();
    until(a, 'wind-up');
    expect(a.state().bossWindUp).toBe('pounce');
    // Held still (a box, a bell): the pounce is lost.
    const big = bigOne(a);
    big.stunUntil = a.state().time + 200;
    a.step(still);
    expect(a.state().bossWindUp).toBeNull();
    const held = a.state().time;
    const { cooldownMs } = ARENA_CONFIG.bossAttack.pounce;
    expect(cooldownMs).not.toBe(ARENA_CONFIG.eliteAttack.cooldownMs);
    expect(big.nextAttackAt).toBe(held + cooldownMs);
    // And it winds up again only after its own rest.
    until(a, 'wind-up');
    expect(a.state().time - held).toBeGreaterThanOrEqual(cooldownMs);
  });

  it('it rests between attacks', () => {
    const a = mega();
    until(a, 'wind-up');
    until(a, 'boss-pounce');
    const landed = a.state().time;
    // It lands on him; he walks off, and it follows.
    for (let i = 0; i < 60; i++) a.step({ x: 1, y: 0 });
    until(a, 'wind-up');
    expect(a.state().time - landed).toBeGreaterThanOrEqual(
      ARENA_CONFIG.bossAttack.pounce.cooldownMs - 100
    );
  });

  it('its attacks go round, each warned its own way: a pounce, a charge, a volley, and a pounce again', () => {
    // A Keeper nothing wears down, so the run lasts through four.
    const a = arena({
      ...noCats,
      ...unbreakable,
      stepMs: 50,
      escalation: [[0, 0]],
      schedule: { ...xenocatsOnly.schedule!, bosses: [0] },
    });
    const b = ARENA_CONFIG.bossAttack;
    const seen: { shape: string; windUp: string | null; warning: Record<string, unknown> }[] = [];
    for (let n = 0; n < 4; n++) {
      const wind = until(a, 'wind-up');
      if (wind.kind !== 'wind-up') throw new Error('x');
      const [warning] = a.telegraphs();
      seen.push({ shape: wind.shape, windUp: a.state().bossWindUp, warning: { ...warning } });
      // Out of the way of each, so the run goes on as it would.
      for (let i = 0; i < 40; i++) a.step({ x: 0, y: 1 });
    }
    expect(seen.map((s) => [s.shape, s.windUp])).toEqual([
      ['blast', 'pounce'],
      ['dash', 'charge'],
      ['burst', 'volley'],
      ['blast', 'pounce'],
    ]);
    expect(seen[1].warning).toMatchObject({
      shape: 'dash',
      boss: true,
      length: (b.charge.speed * b.charge.ms) / 1000,
      width: VARIETIES.mega.radius * 2,
    });
    expect(seen[2].warning).toMatchObject({ shape: 'burst', boss: true, count: b.volley.shots });
  });

  /** A Mega Cat whose next attack is `pattern`, alone with a Keeper. */
  const megaReady = (pattern: 'charge' | 'volley') => {
    const a = mega();
    a.step(still);
    bigOne(a).attacks = pattern === 'charge' ? 1 : 2;
    return a;
  };

  it('a charge runs along its lane through where he stood, and on: one still in it is struck, one who stepped aside is not', () => {
    const stay = megaReady('charge');
    const wind = until(stay, 'wind-up');
    if (wind.kind !== 'wind-up') throw new Error('x');
    expect(stay.state().bossWindUp).toBe('charge');
    const from = { x: bigOne(stay).x, y: bigOne(stay).y };
    const before = stay.state().hero.resolve;
    const loose = until(stay, 'boss-attack');
    expect(loose).toMatchObject({ pattern: 'charge' });
    let struck = 0;
    for (let i = 0; i < 20; i++) {
      stay.step(still);
      for (const e of stay.drainEvents()) if (e.kind === 'hero-hit' && e.how === 'dash') struck++;
    }
    expect(struck).toBe(1);
    expect(stay.state().hero.resolve).toBe(before - MEGA_DRAIN);
    // It ran on, well past him, the whole lane.
    const ran = Math.hypot(bigOne(stay).x - from.x, bigOne(stay).y - from.y);
    const { speed, ms } = ARENA_CONFIG.bossAttack.charge;
    expect(ran).toBeGreaterThan(((speed * ms) / 1000) * 0.9);

    const aside = megaReady('charge');
    const w = until(aside, 'wind-up');
    if (w.kind !== 'wind-up') throw new Error('x');
    const h = aside.state().hero;
    const len = Math.hypot(h.x - w.x, h.y - w.y) || 1;
    const step = { x: -(h.y - w.y) / len, y: (h.x - w.x) / len };
    until(aside, 'boss-attack', step);
    let missed = 0;
    for (let i = 0; i < 20; i++) {
      aside.step(still);
      for (const e of aside.drainEvents()) if (e.kind === 'hero-hit' && e.how === 'dash') missed++;
    }
    expect(missed).toBe(0);
  });

  it('a volley looses its shots on every side, one at where he stood, and they fly on to reach him', () => {
    const a = megaReady('volley');
    const wind = until(a, 'wind-up');
    if (wind.kind !== 'wind-up') throw new Error('x');
    expect(a.state().bossWindUp).toBe('volley');
    const aim = { ...a.state().hero };
    const from = { x: bigOne(a).x, y: bigOne(a).y };
    until(a, 'boss-attack');
    const shots = a.shots().filter((s) => s.kind === 'boss');
    expect(shots).toHaveLength(ARENA_CONFIG.bossAttack.volley.shots);
    const toAim = Math.atan2(aim.y - from.y, aim.x - from.x);
    expect(
      shots.some(
        (s) =>
          Math.abs(
            Math.atan2(
              Math.sin(Math.atan2(s.vy, s.vx) - toAim),
              Math.cos(Math.atan2(s.vy, s.vx) - toAim)
            )
          ) < 0.01
      )
    ).toBe(true);
    let hit = 0;
    for (let i = 0; i < 80; i++) {
      a.step(still);
      for (const e of a.drainEvents()) if (e.kind === 'hero-hit' && e.how === 'shot') hit++;
    }
    expect(hit).toBe(1);
  });

  /** The Matriarch alone: her goal soon, and she is slow, so the call comes first. */
  const matriarch = () =>
    arena({
      ...noCats,
      stepMs: 50,
      escalation: [[0, 0]],
      timeGoalMs: 5_000,
      matriarch: { ...ARENA_CONFIG.matriarch, speed: 40 },
    });

  it('the Matriarch stops and winds up a call, and a ring of kittens comes where the Keeper stood', () => {
    const a = matriarch();
    const wind = until(a, 'wind-up');
    if (wind.kind !== 'wind-up') throw new Error('x');
    expect(wind.type).toBe(-1);
    expect(a.state().bossWindUp).toBe('summon');
    const h = { x: a.state().hero.x, y: a.state().hero.y };
    const [warning] = a.telegraphs();
    expect(warning).toMatchObject({
      shape: 'blast',
      aimX: h.x,
      aimY: h.y,
      radius: ARENA_CONFIG.bossAttack.summon.ringRadius,
    });
    // She stands still while she calls.
    const place = { ...a.matriarch()! };
    for (let i = 0; i < 10; i++) a.step(still);
    expect(a.matriarch()).toEqual(place);
    const call = until(a, 'boss-summon');
    expect(call).toMatchObject({
      kind: 'boss-summon',
      kittens: ARENA_CONFIG.bossAttack.summon.kittens,
    });
    const kittens = a.cats().filter((c) => c.variety === 'kitten');
    expect(kittens).toHaveLength(ARENA_CONFIG.bossAttack.summon.kittens);
    for (const k of kittens) {
      expect(Math.hypot(k.x - h.x, k.y - h.y)).toBeCloseTo(
        ARENA_CONFIG.bossAttack.summon.ringRadius,
        0
      );
    }
    expect(a.state().bossWindUp).toBeNull();
  });

  it('a Keeper who walks away is not in the ring when it closes', () => {
    const a = matriarch();
    const wind = until(a, 'wind-up');
    if (wind.kind !== 'wind-up') throw new Error('x');
    const h = { ...a.state().hero };
    const len = Math.hypot(h.x - wind.x, h.y - wind.y) || 1;
    until(a, 'boss-summon', { x: (h.x - wind.x) / len, y: (h.y - wind.y) / len });
    const now = a.state().hero;
    // Well outside the ring's reach of where he stood; the kittens are still gathering.
    expect(Math.hypot(now.x - h.x, now.y - h.y)).toBeGreaterThan(
      ARENA_CONFIG.bossAttack.summon.ringRadius
    );
    expect(
      a.cats().filter((c) => c.variety === 'kitten' && Math.hypot(c.x - now.x, c.y - now.y) < 40)
    ).toHaveLength(0);
  });

  it('her next call is a volley: warned as a burst, its shots flying out from her', () => {
    // A Keeper her kittens do not wear down before it.
    const a = arena({
      ...noCats,
      ...unbreakable,
      stepMs: 50,
      escalation: [[0, 0]],
      timeGoalMs: 5_000,
      matriarch: { ...ARENA_CONFIG.matriarch, speed: 40 },
    });
    until(a, 'wind-up');
    until(a, 'boss-summon');
    const wind = until(a, 'wind-up');
    if (wind.kind !== 'wind-up') throw new Error('x');
    expect(wind.shape).toBe('burst');
    expect(a.state().bossWindUp).toBe('volley');
    const [warning] = a.telegraphs();
    expect(warning).toMatchObject({
      shape: 'burst',
      boss: true,
      count: ARENA_CONFIG.bossAttack.volley.shots,
    });
    const her = { ...a.matriarch()! };
    expect(until(a, 'boss-attack')).toMatchObject({ pattern: 'volley', x: her.x, y: her.y });
    expect(a.shots().filter((s) => s.kind === 'boss')).toHaveLength(
      ARENA_CONFIG.bossAttack.volley.shots
    );
    expect(a.state().bossWindUp).toBeNull();
  });

  it('the Matriarch calls again after her rest, and never once she is on him', () => {
    const a = matriarch();
    until(a, 'wind-up');
    until(a, 'boss-summon');
    const first = a.state().time;
    until(a, 'wind-up');
    expect(a.state().time - first).toBeGreaterThanOrEqual(
      ARENA_CONFIG.bossAttack.summon.everyMs - 100
    );
    // She calls only from afar: with a minimum distance beyond any she has, she never
    // begins to, all the way in; the same run with her own minimum does begin.
    const approach = (minDistance: number) => {
      const near = arena({
        ...noCats,
        stepMs: 50,
        escalation: [[0, 0]],
        timeGoalMs: 1_000,
        matriarch: { ...ARENA_CONFIG.matriarch, speed: 300 },
        bossAttack: {
          ...ARENA_CONFIG.bossAttack,
          summon: { ...ARENA_CONFIG.bossAttack.summon, firstMs: 0, minDistance },
        },
      });
      let calls = 0;
      stepWhile(
        near,
        () => near.state().status === 'playing' && near.state().time < 10_000,
        () => {
          near.step(still);
          for (const e of near.drainEvents()) {
            if ((e.kind === 'wind-up' && e.type === -1) || e.kind === 'boss-summon') calls++;
          }
        }
      );
      return { calls, outcome: near.state().outcome };
    };
    expect(approach(ARENA_CONFIG.bossAttack.summon.minDistance).calls).toBeGreaterThan(0);
    expect(approach(5000)).toEqual({ calls: 0, outcome: 'goal' });
  });
});

describe('chests', () => {
  /** Elites only, a Mega Cat at once, nothing picked up and nothing sent home but by hand. */
  const elites = (config: Partial<ArenaConfig> = {}) =>
    arena({
      ...unbreakable,
      stepMs: 50,
      escalation: [[0, 8]],
      startingWeapons: [],
      chestReach: -1,
      gems: { ...ARENA_CONFIG.gems, value: 0, eliteValue: 0 },
      cats: { ...ARENA_CONFIG.cats, eliteShare: 1 },
      schedule: { ...xenocatsOnly.schedule!, bosses: [] },
      secretCat: { afterMs: Infinity, stillMs: Infinity },
      ...config,
    });
  /** Sends every elite home now (by hand: the cats are the arena's own); how many went. */
  const sendElitesHome = (a: ReturnType<typeof elites>) => {
    const going = a.cats().filter((c) => c.elite);
    for (const cat of going) cat.homesickness = cat.limit;
    a.step(still);
    return going.length;
  };
  const plain = (a: ReturnType<typeof elites>) => a.chests().filter((c) => !c.golden).length;

  it('a plain chest is left at most once in the gap, however many elites go home', () => {
    const { chestGapMs } = ARENA_CONFIG;
    expect(chestGapMs).toBe(40_000);
    const a = elites();
    stepTo(a, 5_000);
    expect(sendElitesHome(a)).toBeGreaterThan(2);
    // Several elites at once: one chest.
    expect(plain(a)).toBe(1);
    // More, inside the gap: none.
    stepTo(a, 20_000);
    expect(sendElitesHome(a)).toBeGreaterThan(0);
    expect(plain(a)).toBe(1);
    // After it: one more.
    stepTo(a, 5_000 + chestGapMs + 1_000);
    expect(sendElitesHome(a)).toBeGreaterThan(0);
    expect(plain(a)).toBe(2);
  });

  it('a gap of 0 leaves a chest for each, as before', () => {
    const a = elites({ chestGapMs: 0 });
    stepTo(a, 5_000);
    const went = sendElitesHome(a);
    expect(plain(a)).toBe(went);
  });

  it("a boss's golden chest always comes, inside the gap too", () => {
    const a = elites({ schedule: { ...xenocatsOnly.schedule!, bosses: [3_000] } });
    stepTo(a, 5_000);
    sendElitesHome(a);
    expect(plain(a)).toBe(1);
    const boss = a.cats().find((c) => c.variety === 'mega')!;
    boss.homesickness = boss.limit;
    a.step(still);
    expect(a.chests().filter((c) => c.golden)).toHaveLength(1);
    expect(plain(a)).toBe(1);
  });
});

describe('pickups', () => {
  const quiet = { secretCat: { afterMs: Infinity, stillMs: Infinity } };

  it('a cat sent home leaves one rarely, by a hash of its id: fish, magnet or bell, five, three, two in ten', () => {
    expect(ARENA_CONFIG.pickups.chance).toBe(0.002);
    let any = 0;
    const kinds = { fish: 0, magnet: 0, bell: 0 };
    for (let id = 1; id <= 200_000; id++) {
      const kind = pickupFor(id, ARENA_CONFIG.pickups.chance);
      if (kind) {
        any++;
        kinds[kind]++;
      }
    }
    // 400 expected of 200 000; the hash is not random but is even.
    expect(any).toBeGreaterThan(320);
    expect(any).toBeLessThan(480);
    expect(kinds.fish / any).toBeGreaterThan(0.42);
    expect(kinds.fish / any).toBeLessThan(0.58);
    expect(kinds.magnet / any).toBeGreaterThan(0.2);
    expect(kinds.magnet / any).toBeLessThan(0.4);
    expect(kinds.bell / any).toBeGreaterThan(0.12);
    expect(kinds.bell / any).toBeLessThan(0.28);
    // The same id, the same answer; none at chance 0, every one at chance 1.
    expect(pickupFor(12345, 0.5)).toBe(pickupFor(12345, 0.5));
    for (let id = 1; id < 200; id++) {
      expect(pickupFor(id, 0)).toBeNull();
      expect(pickupFor(id, 1)).not.toBeNull();
    }
  });

  it('draws nothing from the random source: with their effects off, the same seeded run with and without the chance', () => {
    const play = (chance: number) => {
      const a = arena(
        {
          ...unbreakable,
          stepMs: 50,
          // Taken, they do nothing here, so only the drawing of random numbers could differ.
          pickups: { ...ARENA_CONFIG.pickups, chance, fishShare: 0, magnetMs: 0, bellMs: 0 },
        },
        5
      );
      runTo(a, 60_000);
      return JSON.stringify([a.cats().map((c) => [c.id, c.x, c.y]), a.state().sentHome]);
    };
    expect(play(0)).toBe(play(0.9));
  });

  it('a cat sent home may leave one where it stood, up to the cap, and it goes after its time', () => {
    const a = arena({
      ...unbreakable,
      stepMs: 50,
      escalation: [[0, 40]],
      pickups: { ...ARENA_CONFIG.pickups, chance: 1, cap: 3, lifeMs: 4000 },
    });
    let left = 0;
    let most = 0;
    stepTo(a, 30_000, () => {
      a.step(still);
      for (const e of a.drainEvents()) if (e.kind === 'pickup-left') left++;
      most = Math.max(most, a.pickups().length);
    });
    expect(left).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(3);
    // One laid far from him lies out its time and is gone.
    const b = arena({ ...unbreakable, stepMs: 50, escalation: [[0, 0]], ...quiet });
    b.layPickup('fish', { x: 5000, y: 5000 });
    runTo(b, ARENA_CONFIG.pickups.lifeMs - 500);
    expect(b.pickups()).toHaveLength(1);
    runTo(b, ARENA_CONFIG.pickups.lifeMs + 500);
    expect(b.pickups()).toHaveLength(0);
  });

  it('a pickup near him is drawn in and taken: the state says so', () => {
    const a = arena({ ...unbreakable, stepMs: 50, escalation: [[0, 0]], ...quiet });
    a.layPickup('bell', { x: 80, y: 0 });
    expect(a.state().pickups).toBe(1);
    let taken: unknown = null;
    for (let i = 0; i < 100 && !taken; i++) {
      a.step(still);
      taken = a.drainEvents().find((e) => e.kind === 'pickup-taken');
    }
    expect(taken).toMatchObject({ kind: 'pickup-taken', pickup: 'bell', player: 0 });
    expect(a.state()).toMatchObject({ pickups: 0, pickupsTaken: 1, lastPickup: 'bell' });
  });

  it('a fish restores a quarter of his Resolve, never beyond all of it', () => {
    // A cat on him wears it down; then a fish.
    const a = arena({
      stepMs: 50,
      escalation: [[0, 6]],
      startingWeapons: [],
      ...quiet,
    });
    let worn = 100;
    stepWhile(
      a,
      () => a.state().hero.resolve > 80 && a.state().time < 60_000,
      () => {
        a.step(still);
        worn = a.state().hero.resolve;
      }
    );
    expect(worn).toBeLessThanOrEqual(80);
    const max = a.state().hero.maxResolve;
    a.layPickup('fish', { x: a.state().hero.x, y: a.state().hero.y });
    a.step(still);
    const after = a.state().hero.resolve;
    // Up by a quarter of the most (25), less at most what one more touch took in that step
    // (a plain cat drains 11 at the most).
    expect(after).toBeGreaterThanOrEqual(worn + max * ARENA_CONFIG.pickups.fishShare - 11);
    expect(after).toBeLessThanOrEqual(max);

    const full = arena({ ...unbreakable, stepMs: 50, escalation: [[0, 0]], ...quiet });
    full.layPickup('fish', { x: 0, y: 0 });
    full.step(still);
    expect(full.state().hero.resolve).toBeLessThanOrEqual(full.state().hero.maxResolve);
    expect(full.state().pickupsTaken).toBe(1);
  });

  it('gems dropped near each other join into one bigger gem, a size and colour up', () => {
    // He picks nothing up, so every gem stays where it fell.
    const a = arena({
      ...unbreakable,
      stepMs: 50,
      escalation: [[0, 60]],
      gems: { ...ARENA_CONFIG.gems, pickup: 0 },
    });
    const { value, eliteValue } = ARENA_CONFIG.gems;
    // Each cat's gem is 1 (an elite's 6): one worth more is gems that joined.
    stepWhile(
      a,
      () => !a.gems().some((g) => g.value > eliteValue) && a.state().time < 60_000,
      () => {
        if (a.choices()) a.choose(0);
        else a.step(still);
      }
    );
    expect(a.gems().some((g) => g.value > eliteValue)).toBe(true);
    // Not the cap's doing (beyond it, a new gem adds to an old one anywhere).
    expect(a.gems().length).toBeLessThan(ARENA_CONFIG.gems.cap);
    expect(gemSize(value)).toBe(0);
    expect(gemSize(eliteValue)).toBe(1);
    expect(gemSize(10)).toBe(2);
    expect(gemSize(30)).toBe(3);
  });

  it('a magnet draws every gem on the arena to him', () => {
    // No elites: one's bolt could knock him far off while the gems fly.
    const a = arena({
      ...unbreakable,
      stepMs: 50,
      escalation: [[0, 60]],
      cats: { ...ARENA_CONFIG.cats, eliteShare: 0 },
    });
    const far = () =>
      a.gems().filter((g) => Math.hypot(g.x - a.state().hero.x, g.y - a.state().hero.y) > 160)
        .length;
    // Gems lie where the laser sent cats home, beyond the pull of his pickup reach.
    stepWhile(
      a,
      () => far() < 3 && a.state().time < 120_000,
      () => {
        if (a.choices()) a.choose(0);
        else a.step(still);
      }
    );
    expect(far()).toBeGreaterThanOrEqual(3);
    // (The gems lying far off now: one a cat leaves later is not drawn in yet.)
    const lying = a
      .gems()
      .filter((g) => Math.hypot(g.x - a.state().hero.x, g.y - a.state().hero.y) > 160);
    a.layPickup('magnet', { x: a.state().hero.x, y: a.state().hero.y });
    for (let i = 0; i < 24; i++) {
      if (a.choices()) a.choose(0);
      else a.step(still);
    }
    const stillFar = lying.filter(
      (g) =>
        a.gems().includes(g) && Math.hypot(g.x - a.state().hero.x, g.y - a.state().hero.y) > 160
    );
    expect(stillFar).toHaveLength(0);
  });

  it('a bell stops the cats on the screen for a moment, and they go on after', () => {
    const a = arena({
      ...unbreakable,
      stepMs: 50,
      escalation: [[0, 30]],
      startingWeapons: [],
      cats: { ...ARENA_CONFIG.cats, eliteShare: 0 },
      ...quiet,
    });
    runTo(a, 20_000, still, true);
    expect(a.cats().length).toBeGreaterThan(5);
    a.layPickup('bell', { x: 0, y: 0 });
    a.step(still);
    const stopped = a.cats().filter((c) => c.stunUntil > a.state().time);
    expect(stopped.length).toBeGreaterThan(5);
    const place = new Map(stopped.map((c) => [c.id, [c.x, c.y]]));
    for (let i = 0; i < 10; i++) a.step(still);
    for (const c of stopped) {
      if (c.stunUntil > a.state().time) expect([c.x, c.y]).toEqual(place.get(c.id));
    }
    runTo(a, a.state().time + ARENA_CONFIG.pickups.bellMs + 500);
    expect(a.cats().some((c) => c.stunUntil > a.state().time)).toBe(false);
  });
});

describe('reroll and skip at a level-up', () => {
  /** A run with gems worth a level each, the laser sending cats home all round. */
  function levelling(config: Partial<ArenaConfig> = {}, seed = 3) {
    return createArena({
      random: createRandom(seed),
      types: CAT_TYPES,
      viewport,
      config: {
        ...unbreakable,
        stepMs: 50,
        escalation: [[0, 30]],
        schedule: xenocatsOnly.schedule,
        gems: { ...ARENA_CONFIG.gems, value: 40, eliteValue: 40 },
        ...config,
      },
    });
  }
  type Run = ReturnType<typeof levelling>;
  const untilChoosing = (a: Run) => {
    for (let i = 0; i < 4000 && !a.choices(); i++) a.step(still);
    expect(a.choices()).not.toBeNull();
  };
  const ids = (a: Run) =>
    a
      .choices()!
      .map((c) => `${c.kind}:${c.id}`)
      .join(' ');

  it('each Keeper has one reroll and one skip a run, and the Tailor’s upgrades add to them', () => {
    expect(ARENA_CONFIG.levelUp).toEqual({ rerolls: 1, skips: 1, skipXpShare: 0.3 });
    expect(levelling().levelUpUses()).toEqual({ rerolls: 1, skips: 1 });
    const more = levelling({ boost: { ...ARENA_CONFIG.boost, rerolls: 2, skips: 3 } });
    expect(more.levelUpUses()).toEqual({ rerolls: 3, skips: 4 });
  });

  it('a reroll asks for new choices, spends a use, and the level-up waits for a choice as before', () => {
    const a = levelling();
    untilChoosing(a);
    const level = a.state().level;
    const before = ids(a);
    expect(a.reroll()).toBe(true);
    expect(ids(a)).not.toBe(before);
    expect(a.levelUpUses()).toEqual({ rerolls: 0, skips: 1 });
    // None left: refused, and the choices stay.
    const now = ids(a);
    expect(a.reroll()).toBe(false);
    expect(ids(a)).toBe(now);
    // Nothing else moved: the same level, still waiting, a choice goes on as usual.
    expect(a.state().level).toBe(level);
    a.choose(0);
    expect(a.state().level).toBe(level);
  });

  it('with nothing left to learn, a level-up asks nothing and the run goes on', () => {
    // One weapon and no passives: only the laser's levels to choose.
    // (No time goal: standing still, he gathers only the gems that fall near him.)
    const a = levelling({
      availableWeapons: ['laser-pointer'],
      slots: { weapons: 1, passives: 0 },
      timeGoalMs: Infinity,
    });
    let asked = 0;
    for (let i = 0; i < 16000 && a.state().level < MAX_WEAPON_LEVEL + 3; i++) {
      if (a.choices()) {
        asked++;
        a.choose(0);
      } else a.step(still);
    }
    expect(a.state().level).toBeGreaterThanOrEqual(MAX_WEAPON_LEVEL + 3);
    expect(a.state().weapons).toEqual([{ id: 'laser-pointer', level: MAX_WEAPON_LEVEL }]);
    expect(asked).toBe(MAX_WEAPON_LEVEL - 1);
  });

  it('a reroll is not offered when nothing waits', () => {
    const a = levelling();
    expect(a.reroll()).toBe(false);
    expect(a.skip()).toBe(false);
    expect(a.levelUpUses()).toEqual({ rerolls: 1, skips: 1 });
  });

  it('the Tailor’s Lucky Coat Button offers one more choice; his Spare Pocket holds one more passive', () => {
    const plain = levelling();
    untilChoosing(plain);
    const lucky = levelling({ boost: { ...ARENA_CONFIG.boost, choices: 1 } });
    untilChoosing(lucky);
    expect(lucky.choices()!.length).toBe(plain.choices()!.length + 1);
    const pocket = levelling({ boost: { ...ARENA_CONFIG.boost, passiveSlots: 2 } });
    expect(pocket.state().slots.passives).toBe(ARENA_CONFIG.slots.passives + 2);
    expect(pocket.state().slots.weapons).toBe(ARENA_CONFIG.slots.weapons);
  });

  it('a skip takes no choice and 30% of the experience the next level needs instead', () => {
    const a = levelling({ gems: { ...ARENA_CONFIG.gems, value: 8, eliteValue: 8 } });
    untilChoosing(a);
    const { xp, xpToNext, level } = a.state();
    const held = a
      .state()
      .weapons.map((w) => `${w.id}${w.level}`)
      .join();
    expect(a.skip()).toBe(true);
    // No choice was taken; the level-up is over (or the next waits).
    expect(
      a
        .state()
        .weapons.map((w) => `${w.id}${w.level}`)
        .join()
    ).toBe(held);
    expect(a.state().xp).toBeCloseTo(xp + xpToNext * 0.3, 6);
    expect(a.state().level).toBe(level);
    expect(a.levelUpUses()).toEqual({ rerolls: 1, skips: 0 });
    // None left: refused, and a choice that waits stays.
    if (a.choices()) {
      const waiting = ids(a);
      expect(a.skip()).toBe(false);
      expect(ids(a)).toBe(waiting);
    }
  });

  it('a skip lets the run go on', () => {
    const a = levelling();
    untilChoosing(a);
    const pending = a.state().level;
    expect(a.skip()).toBe(true);
    // More level-ups may wait behind this one (the gems here are worth a level each): choose
    // them, and the run goes on.
    for (let i = 0; i < 50 && a.choices(); i++) a.choose(0);
    expect(a.choices()).toBeNull();
    const time = a.state().time;
    a.step(still);
    expect(a.state().time).toBeGreaterThan(time);
    expect(a.state().level).toBeGreaterThanOrEqual(pending);
  });

  it('in co-op each Keeper has his own, and they go on to the other player’s choice', () => {
    const a = levelling({
      secondPlayer: { startingWeapons: ['spray-bottle'], speed: 210, resolve: 1e12 },
    });
    untilChoosing(a);
    expect(a.chooser()).toBe(0);
    expect(a.skip()).toBe(true);
    // Player 1 has used his skip; now player 2 chooses, with his own to spend.
    expect(a.chooser()).toBe(1);
    expect(a.levelUpUses()).toEqual({ rerolls: 1, skips: 1 });
    expect(a.reroll()).toBe(true);
    const [first, second] = a.state().heroes;
    expect([first.rerollsLeft, first.skipsLeft]).toEqual([1, 0]);
    expect([second.rerollsLeft, second.skipsLeft]).toEqual([0, 1]);
  });

  it('rerolls give choices that differ from the last, whatever the seed', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const a = levelling({}, seed);
      untilChoosing(a);
      const before = ids(a);
      a.reroll();
      expect(ids(a), `seed ${seed}`).not.toBe(before);
    }
  });
});

// What each weapon did in a run (arena.weaponReport): counted in the simulation, as
// the results screen shows it.
/** Xenocats only, a hero nothing wears down, no level-ups or chests unless asked. */
function reportArena(weapons: WeaponId[], config: Partial<ArenaConfig> = {}) {
  return createArena({
    random: createRandom(5),
    types: CAT_TYPES,
    viewport,
    config: {
      schedule: {
        arrivals: [{ from: 0, who: 'xenocat', weight: 1 }],
        swarms: { from: Infinity, everyMs: 1, size: [0, 0] },
        bosses: [],
      },
      chestReach: -1,
      hero: { ...ARENA_CONFIG.hero, resolve: 1e12 },
      gems: { ...ARENA_CONFIG.gems, value: 0, eliteValue: 0 },
      startingWeapons: weapons,
      escalation: [[0, 40]],
      ...config,
    },
  });
}
const runFor = (a: ReturnType<typeof reportArena>, ms: number) => {
  stepTo(a, ms);
  return a;
};
/** Cats nothing sends home: all the homesickness given is still on them. */
const toughCats = {
  cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [1e9, 1e9] as [number, number] },
};

describe('what each weapon did', () => {
  it('a weapon held but not yet fired is listed with nothing done', () => {
    const a = reportArena(['laser-pointer']);
    expect(a.weaponReport()).toEqual([{ id: 'laser-pointer', homesickness: 0, sentHome: 0 }]);
  });

  it('every bit of homesickness given is counted, to the weapon that gave it', () => {
    const a = runFor(reportArena(['laser-pointer', 'can-opener'], toughCats), 15_000);
    const report = a.weaponReport();
    expect(report.map((w) => w.id).sort()).toEqual(['can-opener', 'laser-pointer']);
    for (const w of report) expect(w.homesickness, w.id).toBeGreaterThan(0);
    const onCats = a.cats().reduce((sum, c) => sum + c.homesickness, 0);
    const counted = report.reduce((sum, w) => sum + w.homesickness, 0);
    expect(counted).toBeCloseTo(onCats, 3);
    // Highest first.
    expect(report[0].homesickness).toBeGreaterThanOrEqual(report[1].homesickness);
  });

  // Every place a weapon hurts names it: nothing given goes uncounted, for any weapon
  // (a fused one is held as its two parents, fused at a chest at his feet).
  for (const id of Object.keys(WEAPONS) as WeaponId[]) {
    it(`${WEAPONS[id].name}: all it gives is counted for it`, () => {
      const fusion = FUSIONS.find((f) => f.to === id);
      const a = runFor(
        reportArena(fusion ? [...fusion.from] : [id], {
          ...toughCats,
          startingLevel: MAX_WEAPON_LEVEL,
          escalation: [[0, 60]],
          ...(fusion ? { startingChests: 1, chestReach: ARENA_CONFIG.chestReach } : {}),
        }),
        8_000
      );
      const report = a.weaponReport();
      const onCats = a.cats().reduce((sum, c) => sum + c.homesickness, 0);
      expect(onCats, id).toBeGreaterThan(0);
      expect(report.reduce((sum, w) => sum + w.homesickness, 0)).toBeCloseTo(onCats, 3);
      if (fusion) expect(report.find((w) => w.id === id)?.homesickness, id).toBeGreaterThan(0);
    });
  }

  it('each cat sent home is counted once, for the weapon that reached it last', () => {
    const a = runFor(reportArena(['laser-pointer', 'spray-bottle']), 30_000);
    const report = a.weaponReport();
    expect(a.state().sentHome).toBeGreaterThan(10);
    expect(report.reduce((sum, w) => sum + w.sentHome, 0)).toBe(a.state().sentHome);
    for (const w of report) expect(w.sentHome, w.id).toBeGreaterThan(0);
  });

  it('one weapon alone is credited with every cat sent home', () => {
    const a = runFor(reportArena(['cat-treats']), 30_000);
    expect(a.weaponReport()).toEqual([
      expect.objectContaining({ id: 'cat-treats', sentHome: a.state().sentHome }),
    ]);
    expect(a.state().sentHome).toBeGreaterThan(0);
  });

  it('two evolved weapons that fuse: both listed for what they did, the fused one for the rest', () => {
    const a = reportArena(['infinite-laser', 'monsoon'], {
      ...toughCats,
      startingLevel: MAX_WEAPON_LEVEL,
      startingChests: 1,
      chestReach: ARENA_CONFIG.chestReach,
      escalation: [[0, 60]],
    });
    let atFusion: Record<string, number> | null = null;
    stepTo(a, 20_000, () => {
      a.step(still);
      if (!atFusion && a.drainEvents().some((e) => e.kind === 'fusion')) {
        atFusion = Object.fromEntries(a.weaponReport().map((w) => [w.id, w.homesickness]));
      }
    });
    expect(atFusion).not.toBeNull();
    const after = Object.fromEntries(a.weaponReport().map((w) => [w.id, w.homesickness]));
    expect(Object.keys(after).sort()).toEqual(['infinite-laser', 'monsoon', 'thunderstorm']);
    // The parents' work since goes to the Thunderstorm they are part of.
    expect(after['infinite-laser']).toBe(atFusion!['infinite-laser']);
    expect(after.monsoon).toBe(atFusion!.monsoon);
    expect(after.thunderstorm).toBeGreaterThan(0);
  });

  it('a weapon chosen at a level-up joins the list', () => {
    const a = reportArena(['laser-pointer'], {
      gems: { ...ARENA_CONFIG.gems, value: 50, eliteValue: 50 },
    });
    stepWhile(a, () => !a.choices() && a.state().time < 60_000);
    const offer = a.choices()!;
    const pick = offer.findIndex((c) => c.kind === 'weapon' && c.level === 1);
    expect(pick).toBeGreaterThanOrEqual(0);
    const chosen = offer[pick];
    a.choose(pick);
    expect(a.weaponReport().map((w) => w.id)).toContain(chosen.kind === 'weapon' && chosen.id);
  });
});
