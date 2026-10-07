import { describe, expect, it } from 'vitest';
import {
  ARENA_CONFIG,
  type ArenaCat,
  type ArenaConfig,
  createArena,
} from '@/app/ui/xenocats/arena';
import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
import { createRandom } from '@/app/ui/xenocats/random';
import {
  SCHEDULE,
  type Schedule,
  VARIETIES,
  type VarietyId,
  arrivalsAt,
} from '@/app/ui/xenocats/varieties';

const viewport = { width: 1280, height: 800 };
const still = { x: 0, y: 0 };

/** A Keeper nothing wears down, with no weapons and no level-ups to interrupt. */
const watch: Partial<ArenaConfig> = {
  hero: { ...ARENA_CONFIG.hero, resolve: 1e12 },
  startingWeapons: [],
  gems: { ...ARENA_CONFIG.gems, value: 0, eliteValue: 0 },
  chestReach: -1,
};

/** Only one variety comes, steadily. */
const only = (who: VarietyId): Schedule => ({
  arrivals: [{ from: 0, who, weight: 1 }],
  swarms: { from: Infinity, everyMs: 1, size: [0, 0] },
  bosses: [],
});

function arena(config: Partial<ArenaConfig> = {}, seed = 1) {
  return createArena({
    random: createRandom(seed),
    types: CAT_TYPES,
    viewport,
    config: { ...watch, ...config },
  });
}

function runTo(a: ReturnType<typeof arena>, ms: number, input = still) {
  while (a.state().time < ms) a.step(input);
}

/** How far a cat went in `ms`, and the cats of a variety as they stand. */
function trackOne(who: VarietyId, ms: number) {
  const a = arena({ schedule: only(who), escalation: [[0, 1]] });
  while (a.cats().length === 0) a.step(still);
  const cat = a.cats()[0];
  const id = cat.id;
  const from = { x: cat.x, y: cat.y };
  // `ms` from when it arrived.
  runTo(a, a.state().time + ms);
  const now = a.cats().find((c) => c.id === id)!;
  return { a, from, now };
}

describe('the varieties', () => {
  it('each has its own pace, staying power and size', () => {
    const v = VARIETIES;
    expect(v.basic.speed).toBeLessThan(v.zoomies.speed);
    expect(v.zoomies.speed).toBe(Math.max(...Object.values(v).map((x) => x.speed)));
    expect(v.hissing.homesickness).toBeGreaterThan(v.basic.homesickness);
    expect(v.fat.speed).toBeLessThan(v.basic.speed);
    expect(v.fat.radius).toBeGreaterThan(v.basic.radius * 2);
    expect(v.fat.homesickness).toBeGreaterThan(v.hissing.homesickness);
    expect(v.kitten.radius).toBeLessThan(v.basic.radius);
    expect(v.box.speed).toBe(0);
    expect(v.box.homesickness).toBeGreaterThan(v.fat.homesickness);
    expect(v.mega.radius).toBeGreaterThan(v.fat.radius * 2);
    expect(v.mega.homesickness).toBeGreaterThan(v.box.homesickness);
    for (const variety of Object.values(v)) expect(variety.description.length).toBeGreaterThan(10);
  });

  it('a Basic Cat walks straight at him; a Fat Cat, much slower', () => {
    const basic = trackOne('basic', 3000);
    const fat = trackOne('fat', 3000);
    const gone = (t: ReturnType<typeof trackOne>) =>
      Math.hypot(t.from.x, t.from.y) - Math.hypot(t.now.x, t.now.y);
    expect(gone(basic)).toBeCloseTo(VARIETIES.basic.speed * 3, -1);
    expect(gone(fat)).toBeCloseTo(VARIETIES.fat.speed * 3, -1);
  });

  it('a Zoomies Cat darts about, changing its way, and gets nowhere straight', () => {
    const a = arena({ schedule: only('zoomies'), escalation: [[0, 1]] });
    while (a.cats().length === 0) a.step(still);
    const id = a.cats()[0].id;
    const headings = new Set<number>();
    let travelled = 0;
    let last = { ...a.cats()[0] };
    while (a.state().time < 5000) {
      a.step(still);
      const cat = a.cats().find((c) => c.id === id);
      if (!cat) break;
      headings.add(Math.round(cat.heading * 100));
      travelled += Math.hypot(cat.x - last.x, cat.y - last.y);
      last = { ...cat };
    }
    expect(headings.size).toBeGreaterThan(4);
    expect(travelled).toBeGreaterThan(VARIETIES.zoomies.speed * 4);
  });

  it('a Hissing Cat charges once it is near', () => {
    const a = arena({ schedule: only('hissing'), escalation: [[0, 1]] });
    let far = 0;
    let near = 0;
    let last: ArenaCat | null = null;
    while (a.state().time < 20_000) {
      a.step(still);
      const cat = a.cats()[0];
      if (!cat) continue;
      if (last && last.id === cat.id) {
        const step = Math.hypot(cat.x - last.x, cat.y - last.y);
        if (Math.hypot(cat.x, cat.y) > 300) far = Math.max(far, step);
        else if (Math.hypot(cat.x, cat.y) > 60) near = Math.max(near, step);
      }
      last = { ...cat };
    }
    expect(near).toBeGreaterThan(far * 1.5);
  });

  it('a Box Cat sits where it came, and takes a great deal to send home', () => {
    const box = trackOne('box', 10_000);
    expect(box.now).toMatchObject({ x: box.from.x, y: box.from.y });
    expect(box.now.limit).toBe(VARIETIES.box.homesickness);
  });

  it('a Laser Cat keeps its distance and fires at him; its shots drain his Resolve', () => {
    const a = arena({
      schedule: only('laser'),
      escalation: [[0, 1]],
      hero: { ...ARENA_CONFIG.hero, resolve: 100 },
    });
    let shotsSeen = 0;
    let hits = 0;
    while (a.state().time < 30_000 && a.state().status === 'playing') {
      a.step(still);
      shotsSeen = Math.max(shotsSeen, a.shots().length);
      for (const e of a.drainEvents()) if (e.kind === 'hero-hit' && e.variety === 'laser') hits++;
    }
    expect(shotsSeen).toBeGreaterThan(0);
    expect(hits).toBeGreaterThan(0);
    expect(a.state().hero.resolve).toBeLessThan(100);
    // It never came closer than its range.
    for (const cat of a.cats()) {
      expect(Math.hypot(cat.x, cat.y)).toBeGreaterThanOrEqual(ARENA_CONFIG.laserCat.range - 5);
    }
  });

  it('a Possessed Cat lets lasers pass straight through, but not treats', () => {
    const lasers = arena({
      schedule: only('possessed'),
      escalation: [[0, 4]],
      startingWeapons: ['laser-pointer', 'laser-pointer-deluxe'],
      startingLevel: 8,
    });
    runTo(lasers, 20_000);
    expect(lasers.cats().length).toBeGreaterThan(0);
    for (const cat of lasers.cats()) expect(cat.homesickness).toBe(0);
    expect(lasers.state().sentHome).toBe(0);
    const treats = arena({
      schedule: only('possessed'),
      escalation: [[0, 4]],
      startingWeapons: ['cat-treats'],
      startingLevel: 8,
    });
    runTo(treats, 20_000);
    expect(treats.state().sentHome).toBeGreaterThan(0);
  });

  it('kittens come in swarms of a dozen or more at once, and the last one home leaves a chest', () => {
    const swarm: Schedule = {
      arrivals: [{ from: 0, who: 'basic', weight: 1 }],
      swarms: { from: 1000, everyMs: 1e9, size: [12, 20] },
      bosses: [],
    };
    const a = arena({ schedule: swarm, escalation: [[0, 0]] });
    runTo(a, 1000 + ARENA_CONFIG.stepMs);
    const kittens = a.cats().filter((c) => c.variety === 'kitten');
    expect(kittens.length).toBeGreaterThanOrEqual(12);
    expect(kittens.length).toBeLessThanOrEqual(20);
    // Together, from one side.
    const xs = kittens.map((k) => k.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(100);
    // Sent home, all of them: one chest.
    const b = arena({
      schedule: swarm,
      escalation: [[0, 0]],
      startingWeapons: ['thunderous-vacuum'],
      startingLevel: 8,
    });
    runTo(b, 30_000);
    expect(b.state().sentHome).toBeGreaterThanOrEqual(12);
    expect(b.cats().filter((c) => c.variety === 'kitten')).toHaveLength(0);
    expect(b.state().chests).toBe(1);
  });
});

describe('keeping the horde where he is', () => {
  it('a Box Cat is found on the screen, sitting', () => {
    const a = arena({ schedule: only('box'), escalation: [[0, 10]] });
    runTo(a, 8000);
    expect(a.cats().length).toBeGreaterThan(3);
    for (const cat of a.cats()) {
      expect(Math.abs(cat.x)).toBeLessThan(viewport.width / 2);
      expect(Math.abs(cat.y)).toBeLessThan(viewport.height / 2);
    }
  });

  it('on a narrow phone, a Box Cat is still found wholly on the screen', () => {
    const phone = { width: 390, height: 844 };
    const a = createArena({
      random: createRandom(3),
      types: CAT_TYPES,
      viewport: phone,
      config: { ...watch, schedule: only('box'), escalation: [[0, 10]] },
    });
    runTo(a, 8000);
    expect(a.cats().length).toBeGreaterThan(3);
    for (const cat of a.cats()) {
      expect(Math.abs(cat.x)).toBeLessThanOrEqual(phone.width / 2 - 40 + 1e-6);
      expect(Math.abs(cat.y)).toBeLessThanOrEqual(phone.height / 2 - 40 + 1e-6);
    }
  });

  it('late in a run, Box Cats stay a small share, and no cat is left far behind', () => {
    const a = arena({ stepMs: 50, startingWeapons: ['laser-pointer', 'cat-treats'] }, 5);
    while (a.state().time < 270_000) {
      // He walks a wide circle, leaving whatever sits behind him.
      const t = a.state().time / 6000;
      a.step({ x: -Math.sin(t), y: Math.cos(t) });
    }
    const cats = a.cats();
    const boxes = cats.filter((c) => c.variety === 'box').length;
    expect(cats.length).toBeGreaterThan(500);
    expect(boxes / cats.length).toBeLessThan(0.05);
    const { x, y } = a.state().hero;
    const far =
      (Math.hypot(viewport.width, viewport.height) / 2 + ARENA_CONFIG.cats.spawnMargin) * 2;
    for (const cat of cats)
      expect(Math.hypot(cat.x - x, cat.y - y)).toBeLessThanOrEqual(far + cat.radius + 10);
  }, 60_000);

  it('a swarm never takes the horde past its hard cap', () => {
    const swarm: Schedule = {
      arrivals: [{ from: 0, who: 'basic', weight: 1 }],
      swarms: { from: 1000, everyMs: 1e9, size: [20, 20] },
      bosses: [],
    };
    const a = arena({
      schedule: swarm,
      escalation: [[0, 0]],
      cats: { ...ARENA_CONFIG.cats, hardCap: 8 },
    });
    runTo(a, 2000);
    expect(a.cats().length).toBe(8);
  });

  it('with two Mega Cats on the field, the bar follows the older', () => {
    const two: Schedule = {
      arrivals: [{ from: 0, who: 'basic', weight: 1 }],
      swarms: { from: Infinity, everyMs: 1, size: [0, 0] },
      bosses: [1000, 2000],
    };
    const a = arena({
      schedule: two,
      escalation: [[0, 0]],
      startingWeapons: ['thunderous-vacuum'],
      startingLevel: 8,
    });
    runTo(a, 20_000);
    const megas = a.cats().filter((c) => c.variety === 'mega');
    expect(megas).toHaveLength(2);
    const older = megas.reduce((p, c) => (c.id < p.id ? c : p));
    expect(a.state().boss).toEqual({ homesickness: older.homesickness, limit: older.limit });
  });
});

describe('the schedule', () => {
  it('opens to each variety in turn', () => {
    expect(arrivalsAt(0).map((a) => a.who)).toEqual(['basic', 'xenocat']);
    expect(
      arrivalsAt(300_000)
        .map((a) => a.who)
        .sort()
    ).toEqual(
      ['basic', 'box', 'fat', 'hissing', 'laser', 'possessed', 'xenocat', 'zoomies'].sort()
    );
  });

  it('in a seeded run, each variety first appears in its window, and not before', () => {
    const a = arena({ stepMs: 50 }, 3);
    const first = new Map<string, number>();
    while (a.state().time < 260_000) {
      a.step(still);
      for (const cat of a.cats()) {
        const who = cat.variety ?? 'xenocat';
        if (!first.has(who)) first.set(who, a.state().time);
      }
    }
    for (const arrival of SCHEDULE.arrivals) {
      const seen = first.get(arrival.who);
      expect(seen, arrival.who).toBeDefined();
      expect(seen!, arrival.who).toBeGreaterThanOrEqual(arrival.from);
      // Within a minute of its window opening (a rare one, or few cats wanted, waits).
      expect(seen!, arrival.who).toBeLessThan(arrival.from + 60_000);
    }
    expect(first.get('kitten')).toBeGreaterThanOrEqual(SCHEDULE.swarms.from);
    expect(first.get('kitten')).toBeLessThan(SCHEDULE.swarms.from + 1000);
    expect(first.get('mega')).toBeGreaterThanOrEqual(SCHEDULE.bosses[0]);
    expect(first.get('mega')).toBeLessThan(SCHEDULE.bosses[0] + 1000);
  }, 60_000);
});

describe('the Mega Cat', () => {
  it('arrives when the schedule says, with its own bar; sent home, it leaves a chest', () => {
    const boss: Schedule = {
      arrivals: [{ from: 0, who: 'basic', weight: 1 }],
      swarms: { from: Infinity, everyMs: 1, size: [0, 0] },
      bosses: [5000],
    };
    const a = arena({
      schedule: boss,
      escalation: [[0, 0]],
      startingWeapons: ['thunderous-vacuum', 'can-opener', 'cat-treats'],
      startingLevel: 8,
    });
    let arrived = false;
    while (a.state().time < 4900) a.step(still);
    expect(a.state().boss).toBeNull();
    while (!arrived && a.state().time < 6000) {
      a.step(still);
      arrived = a.drainEvents().some((e) => e.kind === 'boss');
    }
    expect(arrived).toBe(true);
    expect(a.state().boss).toMatchObject({ limit: VARIETIES.mega.homesickness });
    while (a.state().boss && a.state().time < 300_000) a.step(still);
    expect(a.state().boss).toBeNull();
    expect(a.state().chests).toBe(1);
  }, 60_000);

  it('a chest he walks over gives a level-up (until weapons evolve)', () => {
    const boss: Schedule = {
      arrivals: [{ from: 0, who: 'basic', weight: 1 }],
      swarms: { from: Infinity, everyMs: 1, size: [0, 0] },
      bosses: [1000],
    };
    const a = arena({
      schedule: boss,
      escalation: [[0, 0]],
      startingWeapons: ['thunderous-vacuum', 'can-opener', 'cat-treats'],
      startingLevel: 8,
      chestReach: ARENA_CONFIG.chestReach,
    });
    while (a.state().chests === 0 && a.state().time < 300_000) a.step(still);
    const chest = a.chests()[0];
    const level = a.state().level;
    // Walk to it.
    while (!a.choices() && a.state().time < 400_000) {
      const { x, y } = a.state().hero;
      const d = Math.hypot(chest.x - x, chest.y - y) || 1;
      a.step({ x: (chest.x - x) / d, y: (chest.y - y) / d });
    }
    expect(a.choices()).not.toBeNull();
    expect(a.state().chests).toBe(0);
    a.choose(0);
    expect(a.state().level).toBe(level);
  }, 60_000);
});
