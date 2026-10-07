import { describe, expect, it } from 'vitest';
import {
  ARENA_CONFIG,
  type ArenaConfig,
  HERO_EFFECTS,
  catsWanted,
  createArena,
} from '@/app/ui/xenocats/arena';
import { createArenaGrid } from '@/app/ui/xenocats/arena-grid';
import { bestOf, clockText, parseBest } from '@/app/ui/xenocats/arena-storage';
import { CAT_TYPES, catTypeById } from '@/app/ui/xenocats/cat-types';
import { createFrameGuard } from '@/app/ui/xenocats/frame-guard';
import { createRandom } from '@/app/ui/xenocats/random';

const viewport = { width: 1280, height: 800 };
const still = { x: 0, y: 0 };

function arena(config: Partial<ArenaConfig> = {}, seed = 1, types = CAT_TYPES) {
  return createArena({ random: createRandom(seed), types, viewport, config });
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
          laser: { ...ARENA_CONFIG.laser, cooldownMs: 1e12 },
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
        laser: { ...ARENA_CONFIG.laser, cooldownMs: 1e9 },
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
        laser: { ...ARENA_CONFIG.laser, cooldownMs: 1e12 },
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
      laser: { ...ARENA_CONFIG.laser, cooldownMs: 1e12 },
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
      laser: { ...ARENA_CONFIG.laser, cooldownMs: 1e12 },
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
    expect(a.state().weapons).toEqual(['laser-pointer']);
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
      expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(ARENA_CONFIG.laser.cooldownMs - 1);
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
      laser: { ...ARENA_CONFIG.laser, cooldownMs: 40_000 },
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
      laser: { ...ARENA_CONFIG.laser, cooldownMs: 1e12 },
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
