import { describe, expect, it } from 'vitest';
import { ARENA_CONFIG, type ArenaConfig, createArena } from '@/app/ui/xenocats/arena';
import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
import { createRandom } from '@/app/ui/xenocats/random';
import { PLAYER_KEYS, walkDirection } from '@/app/ui/xenocats/walking';

const viewport = { width: 1280, height: 800 };
const still = { x: 0, y: 0 };
const right = { x: 1, y: 0 };
const left = { x: -1, y: 0 };

/** Two Keepers; no cats unless asked; nothing wears them down unless asked. */
function coop(config: Partial<ArenaConfig> = {}, seed = 1) {
  return createArena({
    random: createRandom(seed),
    types: CAT_TYPES,
    viewport,
    config: {
      hero: { ...ARENA_CONFIG.hero, resolve: 1e12 },
      secondPlayer: { startingWeapons: ['spray-bottle'], speed: 210, resolve: 1e12 },
      escalation: [[0, 0]],
      schedule: {
        arrivals: [{ from: 0, who: 'xenocat', weight: 1 }],
        swarms: { from: Infinity, everyMs: 1, size: [0, 0] },
        bosses: [],
      },
      chestReach: -1,
      secretCat: { afterMs: Infinity, stillMs: 0 },
      ...config,
    },
  });
}

const run = (a: ReturnType<typeof coop>, ms: number, input = still, input2 = still) => {
  const until = a.state().time + ms;
  while (a.state().time < until) a.step(input, true, input2);
};

describe('two players at one keyboard', () => {
  it('player 1 walks with WASD, player 2 with the arrow keys', () => {
    expect(walkDirection(['KeyD', 'ArrowLeft'], PLAYER_KEYS[0])).toEqual({ x: 1, y: 0 });
    expect(walkDirection(['KeyD', 'ArrowLeft'], PLAYER_KEYS[1])).toEqual({ x: -1, y: 0 });
    expect(walkDirection(['ArrowUp'], PLAYER_KEYS[0])).toEqual({ x: 0, y: 0 });
    expect(walkDirection(['KeyW'], PLAYER_KEYS[1])).toEqual({ x: 0, y: 0 });
    // Alone, either set walks him.
    expect(walkDirection(['ArrowUp'])).toEqual({ x: 0, y: -1 });
  });

  it('each input walks its own Keeper', () => {
    const a = coop();
    const [one, two] = a.state().heroes;
    run(a, 1000, right, still);
    const [one1, two1] = a.state().heroes;
    expect(one1.x).toBeGreaterThan(one.x + 150);
    expect(two1.x).toBe(two.x);
    run(a, 1000, still, { x: 0, y: 1 });
    const [one2, two2] = a.state().heroes;
    expect(one2.x).toBe(one1.x);
    expect(two2.y).toBeGreaterThan(two1.y + 150);
  });

  it('each starts with his own weapon', () => {
    const a = coop();
    expect(a.state().heroes.map((h) => h.weapons.map((w) => w.id))).toEqual([
      ['laser-pointer'],
      ['spray-bottle'],
    ]);
  });

  it('alone, there is one Keeper and the camera is on him, unzoomed', () => {
    const a = createArena({ random: createRandom(1), types: CAT_TYPES, viewport });
    expect(a.state().heroes).toHaveLength(1);
    a.step(right);
    const { x, y } = a.state().hero;
    expect(a.camera()).toEqual({ x, y, zoom: 1 });
  });
});

describe('the shared camera and the tether', () => {
  it('keeps both in view: between them, zooming out as they part, up to its limit', () => {
    const a = coop();
    expect(a.camera().zoom).toBe(1);
    let last = 1;
    // They walk apart.
    for (let i = 0; i < 20; i++) {
      run(a, 500, left, right);
      const [p, q] = a.state().heroes;
      const cam = a.camera();
      expect(cam.x).toBeCloseTo((p.x + q.x) / 2);
      expect(cam.zoom).toBeGreaterThanOrEqual(last);
      expect(cam.zoom).toBeLessThanOrEqual(ARENA_CONFIG.coop.maxZoomOut);
      // Both on the screen the camera shows.
      const half = (viewport.width * cam.zoom) / 2;
      expect(Math.abs(p.x - cam.x)).toBeLessThanOrEqual(half);
      expect(Math.abs(q.x - cam.x)).toBeLessThanOrEqual(half);
      last = cam.zoom;
    }
    expect(last).toBe(ARENA_CONFIG.coop.maxZoomOut);
  });

  it('if the window shrinks while they are far apart, nobody jumps; they only cannot part further', () => {
    const a = coop();
    run(a, 20_000, left, right);
    const [p, q] = a.state().heroes;
    a.resize({ width: 800, height: 600 });
    a.step(still, true, still);
    const [p1, q1] = a.state().heroes;
    expect(p1.x).toBe(p.x);
    expect(q1.x).toBe(q.x);
    run(a, 1000, left, right);
    const [p2, q2] = a.state().heroes;
    expect(q2.x - p2.x).toBeCloseTo(q.x - p.x, 6);
    // Together again, freely.
    run(a, 1000, right, left);
    expect(a.state().heroes[1].x - a.state().heroes[0].x).toBeLessThan(q.x - p.x - 300);
  });

  it('beyond the widest view, neither can walk further from the other', () => {
    const a = coop();
    run(a, 20_000, left, right);
    const [p, q] = a.state().heroes;
    const span = viewport.width * ARENA_CONFIG.coop.maxZoomOut - 2 * ARENA_CONFIG.coop.margin;
    expect(q.x - p.x).toBeCloseTo(span, 0);
    // Walking back together is free.
    run(a, 1000, right, left);
    const [p2, q2] = a.state().heroes;
    expect(q2.x - p2.x).toBeLessThan(span - 300);
  });
});

describe('shared experience, own choices', () => {
  /** Cats that give experience, Keepers that send them home. */
  function levelling() {
    return coop({ escalation: [[0, 30]], hero: { ...ARENA_CONFIG.hero, resolve: 1e12 } });
  }

  it('at a level-up player 1 chooses, then player 2; each choice is his own', () => {
    const a = levelling();
    while (!a.choices() && a.state().time < 60_000) a.step(still, true, still);
    expect(a.choices()).not.toBeNull();
    const level = a.choiceLevel();
    expect(a.chooser()).toBe(0);
    expect(a.state().chooser).toBe(0);
    // Player 1's offer is his: never the Laser Pointer as new (he has it).
    const first = a.choices()!;
    const pick1 = first.findIndex((c) => c.kind === 'weapon' || c.kind === 'passive');
    const chosen1 = first[pick1];
    a.choose(pick1);
    // The run still waits: now player 2, for the same level.
    expect(a.choices()).not.toBeNull();
    expect(a.chooser()).toBe(1);
    expect(a.choiceLevel()).toBe(level);
    const second = a.choices()!;
    const pick2 = second.findIndex((c) => c.kind === 'weapon' || c.kind === 'passive');
    const chosen2 = second[pick2];
    a.choose(pick2);
    expect(a.chooser()).toBe(0);
    // Each got his own.
    const [h1, h2] = a.state().heroes;
    const has = (h: typeof h1, c: typeof chosen1) =>
      c.kind !== 'weapon' || h.weapons.some((w) => w.id === c.id && w.level === c.level);
    expect(has(h1, chosen1)).toBe(true);
    expect(has(h2, chosen2)).toBe(true);
    if (chosen1.kind === 'weapon' && (chosen2.kind !== 'weapon' || chosen1.id !== chosen2.id)) {
      expect(h2.weapons.some((w) => w.id === chosen1.id)).toBe(false);
    }
  });

  it('one experience bar: either Keeper gathering raises the same level', () => {
    const a = levelling();
    let levels = 0;
    while (a.state().time < 40_000) {
      if (a.choices()) {
        a.choose(0);
        continue;
      }
      a.step(still, true, still);
      levels = a.state().level;
    }
    expect(levels).toBeGreaterThan(1);
    expect(a.state().heroes).toHaveLength(2);
  });
});

describe('downed and revived', () => {
  /** Player 2 is frail, player 1 is not; cats come. */
  function frailTwo(reviveMs = ARENA_CONFIG.coop.reviveMs) {
    return coop({
      escalation: [[0, 40]],
      secondPlayer: { startingWeapons: [], speed: 210, resolve: 5 },
      coop: { ...ARENA_CONFIG.coop, reviveMs },
      gems: { ...ARENA_CONFIG.gems, value: 0, eliteValue: 0 },
    });
  }

  it('a Keeper whose Resolve is spent is down; if the other lasts 30 s, he stands again', () => {
    const a = frailTwo();
    const events: { kind: string; player?: number; at: number }[] = [];
    while (a.state().time < 90_000 && !events.some((e) => e.kind === 'revived')) {
      a.step(still, true, still);
      for (const e of a.drainEvents()) {
        if (e.kind === 'downed' || e.kind === 'revived') events.push({ ...e, at: a.state().time });
      }
      if (events.length === 1) {
        // While he is down: he does not move, and the run goes on.
        expect(a.state().heroes[1].down).toBe(true);
        expect(a.state().status).toBe('playing');
      }
    }
    expect(events.map((e) => [e.kind, e.player])).toEqual([
      ['downed', 1],
      ['revived', 1],
    ]);
    expect(events[1].at - events[0].at).toBeGreaterThanOrEqual(ARENA_CONFIG.coop.reviveMs);
    expect(events[1].at - events[0].at).toBeLessThan(ARENA_CONFIG.coop.reviveMs + 50);
    const back = a.state().heroes[1];
    expect(back.down).toBe(false);
    expect(back.resolve).toBe(back.maxResolve / 2);
  });

  it('a downed Keeper does not walk', () => {
    const a = frailTwo();
    while (!a.state().heroes[1].down && a.state().time < 60_000) a.step(still, true, still);
    expect(a.state().heroes[1].down).toBe(true);
    const at = a.state().heroes[1].x;
    run(a, 1000, still, right);
    expect(a.state().heroes[1].x).toBe(at);
  });

  it('the run ends when both are down; the results know both', () => {
    const a = coop({
      escalation: [[0, 60]],
      hero: { ...ARENA_CONFIG.hero, resolve: 5 },
      startingWeapons: [],
      secondPlayer: { startingWeapons: [], speed: 210, resolve: 5 },
    });
    const kinds: string[] = [];
    while (a.state().status !== 'over' && a.state().time < 120_000) {
      a.step(still, true, still);
      for (const e of a.drainEvents())
        if (e.kind === 'downed' || e.kind === 'over') kinds.push(e.kind);
    }
    expect(a.state().status).toBe('over');
    expect(a.state().outcome).toBe('spent');
    // One went down first (or both at once); the run ended with both down.
    expect(kinds.at(-1)).toBe('over');
    expect(kinds.filter((k) => k === 'downed').length).toBeGreaterThanOrEqual(1);
    expect(a.state().heroes.every((h) => h.down)).toBe(true);
  });
});
