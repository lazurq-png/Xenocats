import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ARENA_CONFIG,
  type ArenaConfig,
  HERO_EFFECTS,
  attackShapeOf,
  catsWanted,
  createArena,
  runLengthConfig,
} from '@/app/ui/xenocats/arena';
import { createArenaGrid } from '@/app/ui/xenocats/arena-grid';
import { WEAPONS } from '@/app/ui/xenocats/arsenal';
import {
  SURVIVAL_BEST_KEY,
  bestKey,
  bestOf,
  clockText,
  parseBest,
  parseLength,
  readBest,
  readLength,
  subscribeLength,
  writeBest,
  writeLength,
} from '@/app/ui/xenocats/arena-storage';
import { SCHEDULE } from '@/app/ui/xenocats/varieties';
import { CAT_TYPES, catTypeById } from '@/app/ui/xenocats/cat-types';
import { createFrameGuard } from '@/app/ui/xenocats/frame-guard';
import { createRandom } from '@/app/ui/xenocats/random';

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
  while (a.state().time < ms && a.state().status === 'playing') a.step(input, spawn);
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
      while (a.state().time < 60_000 && !a.drainEvents().some((e) => e.kind === 'hero-hit')) {
        a.step(still);
      }
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
  });

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
    while (a.state().time < 40_000) {
      a.step(still);
      for (const e of a.drainEvents()) {
        if (e.kind === 'laser') lasers++;
        if (e.kind === 'sent-home') home++;
      }
    }
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
    while (b.state().time < 20_000) {
      b.step(still);
      for (const e of b.drainEvents()) if (e.kind === 'laser') times.push(b.state().time);
    }
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
      cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [1e9, 1e9] },
      firstShotMs: 20_000,
    });
    let beam: { from: { x: number; y: number }; to: { x: number; y: number } } | null = null;
    while (!beam && a.state().time < 30_000) {
      a.step(still);
      for (const e of a.drainEvents()) if (e.kind === 'laser') beam = e;
    }
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
    while (a.state().status === 'playing' && a.state().time < 320_000) {
      a.step(still);
      for (const e of a.drainEvents()) seen.push(e.kind);
    }
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
    while (a.state().status !== 'over' && a.state().time < 300_000) {
      // The same policy for both: the first of each level-up's offer.
      if (a.choices()) {
        a.choose(0);
        continue;
      }
      const t = a.state().time / 4000;
      a.step(walking ? { x: Math.cos(t), y: Math.sin(t) } : { x: 0, y: 0 });
    }
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
    });
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
    // A cat arriving at 10:00 has 5 minutes of toughness: +75% Homesickness, +10% speed.
    const late = Math.max(...a.cats().map((cat) => cat.limit));
    expect(late).toBeGreaterThan(limit * 1.7);
    expect(late).toBeLessThanOrEqual(limit * 1.75 + 1e-9);
    expect(Math.max(...a.cats().map((cat) => cat.speed))).toBeGreaterThan(speed * 1.09);
    expect(Math.max(...a.cats().map((cat) => cat.speed))).toBeLessThanOrEqual(speed * 1.1 + 1e-9);
  });

  it('a five-minute run stays as it was after 5:00, until the Matriarch reaches him', () => {
    const a = arena({
      ...plain,
      timeGoalMs: 300_000,
      matriarch: { ...ARENA_CONFIG.matriarch, speed: 0 },
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

  it('a stored length is five, ten or fifteen, else five', () => {
    expect(parseLength('10')).toBe(10);
    expect(parseLength('15')).toBe(15);
    expect(parseLength('5')).toBe(5);
    for (const raw of [null, '', '7', 'abc', '10.5', '-5'])
      expect(parseLength(raw), String(raw)).toBe(5);
  });

  it('five minutes keeps the old key, so a best from before counts as the five-minute best', () => {
    expect(bestKey(5)).toBe(SURVIVAL_BEST_KEY);
    expect(new Set([bestKey(5), bestKey(10), bestKey(15)]).size).toBe(3);
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
    while (a.state().time < 180_000) {
      a.step(still);
      for (const e of a.drainEvents()) {
        if (e.kind !== 'xenocat') continue;
        xenocats++;
        if (e.elite) elites++;
      }
    }
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

  it('draws its shape from the effect: a ring for the freezes and pulls, a blast for the pushes, a line for the rest', () => {
    expect(attackShapeOf(HERO_EFFECTS.freeze)).toBe('ring');
    expect(attackShapeOf(HERO_EFFECTS.heavy)).toBe('ring');
    expect(attackShapeOf(HERO_EFFECTS.magnet)).toBe('ring');
    expect(attackShapeOf(HERO_EFFECTS.knockback)).toBe('blast');
    expect(attackShapeOf(HERO_EFFECTS.fall)).toBe('blast');
    expect(attackShapeOf(HERO_EFFECTS.teleport)).toBe('blast');
    expect(attackShapeOf(HERO_EFFECTS.jitter)).toBe('blast');
    expect(attackShapeOf(HERO_EFFECTS.reverse)).toBe('line');
    expect(attackShapeOf(HERO_EFFECTS['axis-lock'])).toBe('line');
    expect(attackShapeOf(HERO_EFFECTS.vanish)).toBe('line');
  });

  it('never begins out of range: a blast winds up only once the elite is within range of the Keeper', () => {
    const a = lone('pulsar-siamese');
    const wind = until(a, 'wind-up');
    if (wind.kind !== 'wind-up') throw new Error('x');
    const h = heroAt(a);
    expect(Math.hypot(wind.x - h.x, wind.y - h.y)).toBeLessThanOrEqual(
      ARENA_CONFIG.eliteAttack.range + 5
    );
    expect(wind.shape).toBe('blast');
    // And it came from outside that range: nothing attacked before it was near.
    expect(a.state().time).toBeGreaterThan(2000);
  });

  it('a ring begins only when the Keeper is inside it', () => {
    const a = lone('cryo-persian');
    const wind = until(a, 'wind-up');
    if (wind.kind !== 'wind-up') throw new Error('x');
    const h = heroAt(a);
    expect(wind.shape).toBe('ring');
    expect(Math.hypot(wind.x - h.x, wind.y - h.y)).toBeLessThanOrEqual(
      ARENA_CONFIG.eliteAttack.ringRadius + 5
    );
    expect(ARENA_CONFIG.eliteAttack.ringWindUpMs).toBeGreaterThan(
      ARENA_CONFIG.eliteAttack.windUpMs
    );
  });

  it('winds up for its time, standing still, warning where it will land; then lands', () => {
    const a = lone('pulsar-siamese');
    const wind = until(a, 'wind-up');
    if (wind.kind !== 'wind-up') throw new Error('x');
    const began = a.state().time;
    const aimed = { x: heroAt(a).x, y: heroAt(a).y };
    expect(a.state().windUps).toBe(1);
    const [warning] = a.telegraphs();
    expect(warning).toMatchObject({
      shape: 'blast',
      x: wind.x,
      y: wind.y,
      aimX: aimed.x,
      aimY: aimed.y,
    });
    expect(warning.progress).toBeLessThan(0.2);
    const cat = () => a.cats().find((c) => c.elite)!;
    const place = { x: cat().x, y: cat().y };
    const strike = until(a, 'elite-attack');
    expect(a.state().time - began).toBeGreaterThanOrEqual(ARENA_CONFIG.eliteAttack.windUpMs - 1);
    expect(a.state().time - began).toBeLessThanOrEqual(ARENA_CONFIG.eliteAttack.windUpMs + 100);
    expect({ x: cat().x, y: cat().y }).toEqual(place);
    expect(strike).toMatchObject({ kind: 'elite-attack', hits: 1 });
    expect(heroAt(a).effect).not.toBeNull();
    expect(a.state().windUps).toBe(0);
    expect(a.telegraphs()).toEqual([]);
  });

  it('a Keeper who stays where he was is hit; one who walks out of the shape during the wind-up is not', () => {
    const stay = lone('pulsar-siamese');
    until(stay, 'wind-up');
    expect(until(stay, 'elite-attack')).toMatchObject({ hits: 1 });

    const away = lone('pulsar-siamese');
    const wind = until(away, 'wind-up');
    if (wind.kind !== 'wind-up') throw new Error('x');
    // Straight away from the elite: the blast lands where he was.
    const h = heroAt(away);
    const len = Math.hypot(h.x - wind.x, h.y - wind.y);
    const outward = { x: (h.x - wind.x) / len, y: (h.y - wind.y) / len };
    const strike = until(away, 'elite-attack', outward);
    expect(strike).toMatchObject({ hits: 0 });
    expect(heroAt(away).effect).toBeNull();
  });

  it('a ring is dodged by stepping out of it', () => {
    const stay = lone('cryo-persian');
    until(stay, 'wind-up');
    expect(until(stay, 'elite-attack')).toMatchObject({ hits: 1 });
    expect(heroAt(stay).effect).toBe('freeze');

    const away = lone('cryo-persian');
    const wind = until(away, 'wind-up');
    if (wind.kind !== 'wind-up') throw new Error('x');
    const h = heroAt(away);
    const len = Math.hypot(h.x - wind.x, h.y - wind.y) || 1;
    const strike = until(away, 'elite-attack', {
      x: (h.x - wind.x) / len,
      y: (h.y - wind.y) / len,
    });
    expect(strike).toMatchObject({ hits: 0 });
    expect(heroAt(away).effect).toBeNull();
  });

  it('a ring is dodged even from beside the elite, with a moment to react', () => {
    for (const id of ['cryo-persian', 'magneto-bengal']) {
      const a = lone(id);
      until(a, 'wind-up');
      until(a, 'elite-attack');
      // He stood; the elite walked up and touched him, and the next ring begins beside him.
      const wind = until(a, 'wind-up');
      if (wind.kind !== 'wind-up') throw new Error('x');
      const h = heroAt(a);
      const len = Math.hypot(h.x - wind.x, h.y - wind.y) || 1;
      expect(len, id).toBeLessThan(60);
      const outward = { x: (h.x - wind.x) / len, y: (h.y - wind.y) / len };
      // A third of a second to notice, then straight out.
      for (let i = 0; i < 6; i++) a.step(still);
      const strike = until(a, 'elite-attack', outward);
      expect(strike, id).toMatchObject({ kind: 'elite-attack', hits: 0 });
    }
  });

  it('a line is dodged by stepping aside', () => {
    const stay = lone('laser-ocicat');
    until(stay, 'wind-up');
    expect(until(stay, 'elite-attack')).toMatchObject({ hits: 1 });

    const aside = lone('laser-ocicat');
    const wind = until(aside, 'wind-up');
    if (wind.kind !== 'wind-up') throw new Error('x');
    const h = heroAt(aside);
    const len = Math.hypot(h.x - wind.x, h.y - wind.y) || 1;
    // Across the line from the elite to him.
    const sideways = { x: -(h.y - wind.y) / len, y: (h.x - wind.x) / len };
    expect(until(aside, 'elite-attack', sideways)).toMatchObject({ hits: 0 });
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
