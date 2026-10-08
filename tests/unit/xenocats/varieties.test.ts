import { describe, expect, it } from 'vitest';
import {
  ARENA_CONFIG,
  type ArenaCat,
  type ArenaConfig,
  createArena,
} from '@/app/ui/xenocats/arena';
import { HERO_SVGS, VARIETY_SVG } from '@/app/ui/xenocats/arena-art';
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
  // No secret cat (progression.test.ts): these tests are about the schedule.
  secretCat: { afterMs: Infinity, stillMs: 0 },
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
    // The horde opens with plain cats; the xenocats visit on a clock of their own.
    expect(arrivalsAt(0).map((a) => a.who)).toEqual(['basic']);
    expect(SCHEDULE.xenocats).toEqual({ from: 15_000, everyMs: [8_000, 15_000] });
    expect(
      arrivalsAt(300_000)
        .map((a) => a.who)
        .sort()
    ).toEqual(
      ['basic', 'box', 'comforter', 'fat', 'hissing', 'laser', 'possessed', 'zoomies'].sort()
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
      // Soon after its window opens: within a minute, longer for a rare one (a
      // weight below 1 waits in proportion, at most two minutes).
      const allowance = Math.min(60_000 / Math.min(arrival.weight, 1), 120_000);
      expect(seen!, arrival.who).toBeLessThan(arrival.from + allowance);
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

describe('the drawings', () => {
  it('every variety and every hero has a whole SVG, every colour filled in', () => {
    const drawings = [
      ...(Object.keys(VARIETIES) as VarietyId[]).map((id) => [id, VARIETY_SVG[id]] as const),
      ...Object.entries(HERO_SVGS),
    ];
    expect(drawings.length).toBe(Object.keys(VARIETIES).length + 3);
    for (const [id, svg] of drawings) {
      expect(svg, id).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*>/);
      expect(svg.trimEnd(), id).toMatch(/<\/svg>$/);
      // A colour or shape left out of a template reads "undefined".
      expect(svg, id).not.toContain('undefined');
      // Every attribute's quotes are closed.
      expect((svg.match(/"/g) ?? []).length % 2, id).toBe(0);
    }
  });
});

describe('the Purring Cat', () => {
  it('comforts the cats around it (several, more): they lose Homesickness, the rest keep theirs; no Purring Cat soothes another', () => {
    // The Vacuum Cleaner hurts only when it fires (every 3.2 s): between firings,
    // only the purring changes a cat's Homesickness.
    const purring: Schedule = {
      arrivals: [
        { from: 0, who: 'basic', weight: 3 },
        { from: 0, who: 'comforter', weight: 1 },
      ],
      swarms: { from: Infinity, everyMs: 1, size: [0, 0] },
      bosses: [],
    };
    const a = arena({
      schedule: purring,
      escalation: [[0, 40]],
      startingWeapons: ['vacuum-cleaner'],
    });
    const { radius, perSecond } = VARIETIES.comforter.soothes!;
    const dt = a.config.stepMs / 1000;
    let soothed = 0;
    let kept = 0;
    // Seen: a cat in two Purring Cats' reach; a Purring Cat in another's.
    let doubly = 0;
    let purringInReach = 0;
    while (a.state().time < 40_000) {
      const before = new Map(a.cats().map((c) => [c.id, c.homesickness]));
      a.step(still);
      if (a.drainEvents().some((e) => e.kind === 'fired')) continue;
      const purrers = a.cats().filter((c) => c.variety === 'comforter');
      for (const cat of a.cats()) {
        const was = before.get(cat.id);
        if (was === undefined) continue;
        if (
          cat.variety === 'comforter' &&
          purrers.some(
            (p) => p !== cat && Math.hypot(p.x - cat.x, p.y - cat.y) <= radius + cat.radius
          )
        ) {
          purringInReach++;
        }
        // Each Purring Cat in reach comforts it (several add up).
        const purringNear =
          cat.variety === 'comforter'
            ? 0
            : purrers.filter((p) => Math.hypot(p.x - cat.x, p.y - cat.y) <= radius + cat.radius)
                .length;
        if (purringNear > 0) {
          expect(cat.homesickness).toBeCloseTo(Math.max(was - purringNear * perSecond * dt, 0), 9);
          if (was > 0) soothed++;
          if (was > 0 && purringNear > 1) doubly++;
        } else {
          expect(cat.homesickness).toBe(was);
          if (was > 0) kept++;
        }
      }
    }
    expect(soothed).toBeGreaterThan(20);
    expect(kept).toBeGreaterThan(20);
    expect(doubly).toBeGreaterThan(0);
    expect(purringInReach).toBeGreaterThan(0);
  });

  it('comes from 2:10, now and then', () => {
    const at = SCHEDULE.arrivals.find((a) => a.who === 'comforter')!;
    expect(at.from).toBe(130_000);
    expect(at.weight).toBeLessThan(1);
  });
});

describe('the xenocats are special, not the horde', () => {
  it('each visiting xenocat, sent home, leaves a chest: a visit is an event', () => {
    const a = arena(
      {
        ...watch,
        stepMs: 50,
        startingWeapons: ['infinite-laser'],
        startingLevel: 8,
        // No horde at all: only the visits.
        escalation: [[0, 0]],
        schedule: { ...only('basic'), xenocats: { from: 1000, everyMs: [2000, 2000] } },
      },
      4
    );
    let visits = 0;
    while (a.state().time < 30_000) {
      a.step(still);
      for (const e of a.drainEvents()) if (e.kind === 'xenocat') visits++;
    }
    // Nobody opens them here (chestReach -1): they lie where the cats went home.
    const chests = a.chests().length;
    expect(visits).toBeGreaterThan(10);
    // The last few may still be walking in.
    expect(chests).toBeGreaterThanOrEqual(visits - 3);
    expect(chests).toBeLessThanOrEqual(visits);
  });

  /** Everything that came in a seeded five-minute run, once each, as it arrived. */
  function arrivals(seed: number) {
    // Strong weapons keep the field small (and the test quick); every step is seen.
    const a = arena(
      {
        ...watch,
        stepMs: 50,
        startingWeapons: ['infinite-laser', 'thunderous-vacuum'],
        startingLevel: 8,
      },
      seed
    );
    const seen = new Map<number, Pick<ArenaCat, 'type' | 'variety' | 'swarm' | 'elite'>>();
    const events: { kind: string; type?: number; elite?: boolean }[] = [];
    while (a.state().time < 300_000 && a.state().status !== 'over') {
      a.step(still);
      for (const cat of a.cats()) {
        if (!seen.has(cat.id)) {
          seen.set(cat.id, {
            type: cat.type,
            variety: cat.variety,
            swarm: cat.swarm,
            elite: cat.elite,
          });
        }
      }
      for (const e of a.drainEvents())
        if (e.kind === 'xenocat' || e.kind === 'boss') events.push(e);
    }
    return { cats: [...seen.values()], events };
  }

  it('no ordinary arrival or swarm cat is a xenocat; they come rarely, as elites and as the bosses', () => {
    expect(arrivalsAt(300_000).some((a) => a.who === 'xenocat')).toBe(false);
    let xenocats = 0;
    let ordinary = 0;
    let elites = 0;
    let bosses = 0;
    for (const seed of [1]) {
      const { cats, events } = arrivals(seed);
      for (const cat of cats) {
        if (cat.swarm > 0) expect(cat.type, 'a swarm kitten').toBe(-1);
        else if (cat.variety === 'mega') {
          // A boss: a Mega Cat's size, a xenocat's face.
          expect(cat.type).toBeGreaterThanOrEqual(0);
          bosses++;
        } else if (cat.variety) {
          expect(cat.type, cat.variety).toBe(-1);
          expect(cat.elite).toBe(false);
          ordinary++;
        } else {
          expect(cat.type).toBeGreaterThanOrEqual(0);
          xenocats++;
          if (cat.elite) elites++;
        }
      }
      // Each xenocat and each boss is announced, with its face.
      const announced = events.filter((e) => e.kind === 'xenocat');
      expect(announced).toHaveLength(cats.filter((c) => !c.variety && c.swarm === 0).length);
      for (const e of events) expect(CAT_TYPES[e.type!]).toBeDefined();
    }
    expect(xenocats).toBeGreaterThan(0);
    expect(elites).toBeGreaterThan(0);
    expect(bosses).toBe(SCHEDULE.bosses.length);
    // Rare, by the clock: at most one every 8 s of the five minutes, however large
    // the horde, and a few in a hundred of the arrivals.
    expect(xenocats).toBeLessThanOrEqual(300_000 / SCHEDULE.xenocats!.everyMs[0]);
    expect(xenocats / (xenocats + ordinary)).toBeLessThan(0.08);
  }, 120_000);
});
