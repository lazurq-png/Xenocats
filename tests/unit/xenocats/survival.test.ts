import { describe, expect, it } from 'vitest';
import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
import { createRandom } from '@/app/ui/xenocats/random';
import {
  type FightCat,
  SURVIVAL_CONFIG,
  bestScore,
  createGameClock,
  createSurvival,
  facingTowards,
  walkDirection,
  waveSpec,
} from '@/app/ui/xenocats/survival';

const viewport = { width: 1200, height: 800 };
const centre = { x: 600, y: 400 };

function game(seed = 1, config = {}) {
  return createSurvival({ random: createRandom(seed), types: CAT_TYPES, viewport, now: 0, config });
}

/** Ticks every `step` ms from `from` to `to`; collects what happened. */
function run(
  g: ReturnType<typeof game>,
  from: number,
  to: number,
  options: {
    player?: { x: number; y: number };
    room?: number;
    each?: (now: number) => void;
  } = {},
  step = 20
) {
  const touched: FightCat[] = [];
  const pounced: FightCat[] = [];
  const beamed: FightCat[] = [];
  for (let now = from; now <= to; now += step) {
    options.each?.(now);
    const events = g.tick(now, options.player ?? centre, options.room);
    touched.push(...events.touched);
    pounced.push(...events.pounced);
    beamed.push(...events.beamed);
  }
  return { touched, pounced, beamed };
}

/** Fires at the nearest cat whenever the gun is ready: the ranger at the centre. */
const shootNearest = (g: ReturnType<typeof game>) => (now: number) => {
  const [nearest] = [...g.snapshot().cats].sort(
    (a, b) =>
      Math.hypot(a.x - centre.x, a.y - centre.y) - Math.hypot(b.x - centre.x, b.y - centre.y)
  );
  if (nearest) g.fire(now, centre, nearest);
};

describe('waves', () => {
  it('each wave brings more cats, sooner and faster', () => {
    for (let n = 1; n < 12; n++) {
      const now = waveSpec(n);
      const next = waveSpec(n + 1);
      expect(next.count).toBeGreaterThan(now.count);
      expect(next.spawnEveryMs).toBeLessThanOrEqual(now.spawnEveryMs);
      expect(next.speed).toBeGreaterThanOrEqual(now.speed);
    }
    expect(waveSpec(2).spawnEveryMs).toBeLessThan(waveSpec(1).spawnEveryMs);
    expect(waveSpec(2).speed).toBeGreaterThan(waveSpec(1).speed);
  });

  it('speed and frequency stop growing at their limits', () => {
    expect(waveSpec(200).spawnEveryMs).toBe(SURVIVAL_CONFIG.minSpawnEveryMs);
    expect(waveSpec(200).speed).toBe(SURVIVAL_CONFIG.maxSpeed);
  });

  it('a wave is survived once all its cats have come and been beamed home', () => {
    const g = game();
    const { beamed, touched } = run(g, 0, 30_000, { each: shootNearest(g) });
    const snap = g.snapshot();
    expect(touched).toEqual([]);
    expect(snap.status).toBe('playing');
    expect(snap.lives).toBe(SURVIVAL_CONFIG.lives);
    expect(snap.score).toBeGreaterThanOrEqual(3);
    expect(snap.wave).toBe(snap.score + 1);
    expect(beamed.length).toBeGreaterThanOrEqual(waveSpec(1).count + waveSpec(2).count);
  });

  it('brings exactly the wave’s number of cats', () => {
    const g = game();
    const seen = new Set<number>();
    run(g, 0, 30_000, {
      each: (now) => {
        if (g.snapshot().wave > 1) return;
        for (const cat of g.snapshot().cats) seen.add(cat.id);
        shootNearest(g)(now);
      },
    });
    expect(g.snapshot().wave).toBeGreaterThan(1);
    expect(seen.size).toBe(waveSpec(1).count);
  });
});

describe('never more than five cats', () => {
  it('stays at five or fewer, however long the cats chase', () => {
    // Cats that never arrive (a ranger they cannot reach in time) pile up.
    const g = game(3, { firstWave: { count: 40, spawnEveryMs: 50, speed: 1 } });
    let most = 0;
    run(g, 0, 20_000, { each: () => (most = Math.max(most, g.snapshot().cats.length)) });
    expect(most).toBe(5);
  });

  it('leaves room for cats that are already on screen', () => {
    const g = game(3, { firstWave: { count: 40, spawnEveryMs: 50, speed: 1 } });
    let most = 0;
    run(g, 0, 20_000, {
      room: 2,
      each: () => (most = Math.max(most, g.snapshot().cats.length)),
    });
    expect(most).toBe(2);
  });
});

describe('cats chase the ranger', () => {
  const distance = (c: { x: number; y: number }, to = centre) => Math.hypot(c.x - to.x, c.y - to.y);

  it('cats arrive at an edge, away from the ranger, and walk towards it', () => {
    const g = game();
    run(g, 0, SURVIVAL_CONFIG.breakMs);
    const [cat] = g.snapshot().cats;
    expect(cat).toBeDefined();
    expect(distance(cat)).toBeGreaterThanOrEqual(SURVIVAL_CONFIG.keepAwayFromPlayer);
    run(g, SURVIVAL_CONFIG.breakMs + 20, SURVIVAL_CONFIG.breakMs + 1000);
    const later = g.snapshot().cats.find((c) => c.id === cat.id)!;
    expect(distance(later)).toBeLessThan(distance(cat));
  });

  it('follows the ranger where it walks', () => {
    const g = game(2, { firstWave: { count: 1, spawnEveryMs: 10, speed: 200 } });
    run(g, 0, SURVIVAL_CONFIG.breakMs);
    const corner = { x: 100, y: 100 };
    const [cat] = g.snapshot().cats;
    run(g, SURVIVAL_CONFIG.breakMs + 20, SURVIVAL_CONFIG.breakMs + 300, { player: corner });
    const later = g.snapshot().cats.find((c) => c.id === cat.id)!;
    expect(distance(later, corner)).toBeLessThan(distance(cat, corner));
  });

  it('cats still arrive on a screen too small to keep their distance', () => {
    const small = createSurvival({
      random: createRandom(1),
      types: CAT_TYPES,
      viewport: { width: 400, height: 400 },
      now: 0,
    });
    for (let now = 0; now <= SURVIVAL_CONFIG.breakMs; now += 20)
      small.tick(now, { x: 200, y: 200 });
    expect(small.snapshot().cats).toHaveLength(1);
  });
});

describe('attacks and lives', () => {
  it('every cat pounces once, 1 to 3 s after it arrives, and that costs no life', () => {
    // Slow cats: none reaches the ranger, so only the pounces happen.
    const g = game(4, { firstWave: { count: 4, spawnEveryMs: 200, speed: 1 } });
    const arrived = new Map<number, number>();
    const { pounced, touched } = run(g, 0, 8000, {
      each: (now) => {
        for (const cat of g.snapshot().cats) if (!arrived.has(cat.id)) arrived.set(cat.id, now);
      },
    });
    expect(touched).toEqual([]);
    expect(pounced.map((c) => c.id).sort()).toEqual([...arrived.keys()].sort());
    expect(arrived.size).toBe(4);
    const [min, max] = SURVIVAL_CONFIG.attackAfterMs;
    for (const cat of g.snapshot().cats) {
      expect(cat.attackAt).toBeNull();
    }
    // Each pounce came within its window (one tick of slack either side).
    const g2 = game(4, { firstWave: { count: 4, spawnEveryMs: 200, speed: 1 } });
    const seenAt = new Map<number, number>();
    for (let now = 0; now <= 8000; now += 20) {
      const { pounced } = g2.tick(now, centre);
      for (const cat of g2.snapshot().cats) if (!seenAt.has(cat.id)) seenAt.set(cat.id, now);
      for (const cat of pounced) {
        const after = now - seenAt.get(cat.id)!;
        expect(after).toBeGreaterThanOrEqual(min - 20);
        expect(after).toBeLessThanOrEqual(max + 20);
      }
    }
    expect(g.snapshot().lives).toBe(SURVIVAL_CONFIG.lives);
  });

  it('a cat that touches the ranger lands its attack, leaves, and costs a life', () => {
    const g = game();
    const { touched } = run(g, 0, 20_000);
    expect(touched.length).toBeGreaterThan(0);
    const first = touched[0];
    expect(first).toMatchObject(centre);
    expect(g.snapshot().cats.find((c) => c.id === first.id)).toBeUndefined();
  });

  it('three touches end the game; the score is the waves survived', () => {
    const g = game();
    const { touched } = run(g, 0, 60_000);
    const snap = g.snapshot();
    expect(touched).toHaveLength(SURVIVAL_CONFIG.lives);
    expect(snap.status).toBe('over');
    expect(snap.lives).toBe(0);
    expect(snap.cats).toHaveLength(0);
    expect(snap.beams).toHaveLength(0);
    expect(snap.score).toBe(0);
    // Nothing more happens once it is over.
    expect(g.tick(70_000, centre)).toEqual({ touched: [], pounced: [], beamed: [] });
    expect(g.fire(70_000, centre, { x: 0, y: 0 })).toBeNull();
  });
});

describe('the homing beam', () => {
  /** A game with one slow cat on screen; returns the game and that cat. */
  function oneCat(seed = 5) {
    const g = game(seed, { firstWave: { count: 1, spawnEveryMs: 10, speed: 1 } });
    run(g, 0, SURVIVAL_CONFIG.breakMs);
    const [cat] = g.snapshot().cats;
    return { g, cat, at: SURVIVAL_CONFIG.breakMs + 20 };
  }

  it('leaves the gun towards the aim and sends the cat it hits home', () => {
    const { g, cat, at } = oneCat();
    const beam = g.fire(at, centre, cat)!;
    const way = Math.hypot(cat.x - centre.x, cat.y - centre.y);
    const speed = SURVIVAL_CONFIG.beamSpeed;
    expect(beam.vx).toBeCloseTo(((cat.x - centre.x) / way) * speed);
    expect(beam.vy).toBeCloseTo(((cat.y - centre.y) / way) * speed);
    expect(Math.hypot(beam.x - centre.x, beam.y - centre.y)).toBeCloseTo(
      SURVIVAL_CONFIG.muzzleOffset
    );
    const { beamed } = run(g, at, at + 2000);
    expect(beamed.map((c) => c.id)).toEqual([cat.id]);
    // Gone; its wave (of one) is survived, so the next one is on its way.
    expect(g.snapshot().cats.find((c) => c.id === cat.id)).toBeUndefined();
    expect(g.snapshot().score).toBe(1);
    expect(g.snapshot().beams).toEqual([]);
  });

  it('misses a cat it is not aimed at, and is gone once off screen', () => {
    const { g, cat, at } = oneCat();
    // Straight away from the cat.
    g.fire(at, centre, { x: 2 * centre.x - cat.x, y: 2 * centre.y - cat.y });
    const { beamed } = run(g, at, at + 2000);
    expect(beamed).toEqual([]);
    expect(g.snapshot().cats).toHaveLength(1);
    expect(g.snapshot().beams).toEqual([]);
  });

  it('cannot fly past a cat in one long frame', () => {
    const { g, cat, at } = oneCat();
    g.fire(at, centre, cat);
    // One 2 s frame carries the beam 2200 px, far past the cat.
    expect(g.tick(at + 2000, centre).beamed.map((c) => c.id)).toEqual([cat.id]);
  });

  it('fires at most once per recharge', () => {
    const { g, at } = oneCat();
    const aim = { x: 0, y: 0 };
    expect(g.fire(at, centre, aim)).not.toBeNull();
    expect(g.fire(at + SURVIVAL_CONFIG.fireEveryMs - 1, centre, aim)).toBeNull();
    expect(g.fire(at + SURVIVAL_CONFIG.fireEveryMs, centre, aim)).not.toBeNull();
  });

  it('hits only the nearer of two cats in its path', () => {
    const g = game(5, { firstWave: { count: 2, spawnEveryMs: 10, speed: 0 } });
    run(g, 0, SURVIVAL_CONFIG.breakMs + SURVIVAL_CONFIG.minSpawnEveryMs + 20);
    const [a, b] = g.snapshot().cats;
    expect(b).toBeDefined();
    // Fire from just beyond `a`, on the line from `b` through `a`: `a` is first.
    const way = { x: a.x - b.x, y: a.y - b.y };
    const length = Math.hypot(way.x, way.y);
    const from = { x: a.x + (way.x / length) * 100, y: a.y + (way.y / length) * 100 };
    const at = SURVIVAL_CONFIG.breakMs + SURVIVAL_CONFIG.minSpawnEveryMs + 40;
    g.fire(at, from, b);
    expect(g.tick(at + 2000, from).beamed.map((c) => c.id)).toEqual([a.id]);
  });
});

describe('a shot changed by an attack', () => {
  function oneCat(seed = 5) {
    const g = game(seed, { firstWave: { count: 1, spawnEveryMs: 10, speed: 0 } });
    run(g, 0, SURVIVAL_CONFIG.breakMs);
    const [cat] = g.snapshot().cats;
    return { g, cat, at: SURVIVAL_CONFIG.breakMs + 20 };
  }

  /** Aims to pass `offset` px beside the cat's centre. */
  const beside = (cat: { x: number; y: number }, offset: number) => {
    const way = { x: cat.x - centre.x, y: cat.y - centre.y };
    const length = Math.hypot(way.x, way.y);
    return { x: cat.x - (way.y / length) * offset, y: cat.y + (way.x / length) * offset };
  };

  it('a small beam must pass closer to hit; a big one hits from further off', () => {
    const near = SURVIVAL_CONFIG.beamRadius * 0.6;
    const small = oneCat();
    small.g.fire(small.at, centre, beside(small.cat, near), { scale: 0.25 });
    expect(run(small.g, small.at, small.at + 2000).beamed).toEqual([]);

    const normal = oneCat();
    normal.g.fire(normal.at, centre, beside(normal.cat, near));
    expect(run(normal.g, normal.at, normal.at + 2000).beamed).toHaveLength(1);

    const far = SURVIVAL_CONFIG.beamRadius * 1.6;
    const big = oneCat();
    big.g.fire(big.at, centre, beside(big.cat, far), { scale: 2 });
    expect(run(big.g, big.at, big.at + 2000).beamed).toHaveLength(1);
  });

  it('reloads slower and flies slower when told to', () => {
    const { g, at } = oneCat();
    const aim = { x: 0, y: 0 };
    const beam = g.fire(at, centre, aim, { reload: 2, speed: 0.5 })!;
    expect(Math.hypot(beam.vx, beam.vy)).toBeCloseTo(SURVIVAL_CONFIG.beamSpeed / 2);
    expect(g.fire(at + SURVIVAL_CONFIG.fireEveryMs, centre, aim)).toBeNull();
    expect(g.fire(at + 2 * SURVIVAL_CONFIG.fireEveryMs, centre, aim)).not.toBeNull();
  });

  it('a falling beam curves down', () => {
    const { g, at } = oneCat();
    g.fire(at, centre, { x: centre.x + 100, y: centre.y }, { gravity: 1400, speed: 0.2 });
    g.tick(at + 200, centre);
    const [beam] = g.snapshot().beams;
    expect(beam.vy).toBeGreaterThan(0);
    expect(beam.y).toBeGreaterThan(centre.y);
  });

  it('a bouncing beam comes back off the edge, then leaves', () => {
    const { g, at } = oneCat();
    g.fire(at, centre, { x: centre.x + 100, y: centre.y }, { bounces: 1 });
    // 1100 px/s from x 630: past the right edge (1200) within 0.6 s.
    for (let now = at + 20; now <= at + 700; now += 20) g.tick(now, centre);
    const [beam] = g.snapshot().beams;
    expect(beam.vx).toBeLessThan(0);
    expect(beam.bounces).toBe(0);
    for (let now = at + 720; now <= at + 3000; now += 20) g.tick(now, centre);
    expect(g.snapshot().beams).toEqual([]);
  });
});

describe('walking and facing', () => {
  it('WASD and the arrow keys walk the ranger; a diagonal is no faster', () => {
    expect(walkDirection([])).toEqual({ x: 0, y: 0 });
    expect(walkDirection(['KeyD'])).toEqual({ x: 1, y: 0 });
    expect(walkDirection(['ArrowUp'])).toEqual({ x: 0, y: -1 });
    const diagonal = walkDirection(['KeyW', 'KeyA']);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1);
    expect(diagonal.x).toBeLessThan(0);
    expect(diagonal.y).toBeLessThan(0);
    // Opposite keys cancel; the same way twice counts once; other keys are ignored.
    expect(walkDirection(['KeyA', 'KeyD'])).toEqual({ x: 0, y: 0 });
    expect(walkDirection(['KeyS', 'ArrowDown'])).toEqual({ x: 0, y: 1 });
    expect(walkDirection(['KeyQ', 'Space'])).toEqual({ x: 0, y: 0 });
  });

  it('faces the aim in eight directions', () => {
    const at = (dx: number, dy: number) => facingTowards(centre, { x: 600 + dx, y: 400 + dy });
    expect(at(100, 0)).toBe('e');
    expect(at(100, 100)).toBe('se');
    expect(at(0, 100)).toBe('s');
    expect(at(-100, 100)).toBe('sw');
    expect(at(-100, 0)).toBe('w');
    expect(at(-100, -100)).toBe('nw');
    expect(at(0, -100)).toBe('n');
    expect(at(100, -100)).toBe('ne');
    // Nearly east is still east.
    expect(at(100, 30)).toBe('e');
  });
});

describe('best score', () => {
  it('keeps the higher of the old best and the new score', () => {
    expect(bestScore(null, 0)).toBe(0);
    expect(bestScore(null, 4)).toBe(4);
    expect(bestScore(6, 4)).toBe(6);
    expect(bestScore(6, 9)).toBe(9);
  });
});

describe('game clock', () => {
  it('stands still while paused', () => {
    const clock = createGameClock(1000);
    expect(clock.now(1500)).toBe(500);
    clock.pause(1500);
    expect(clock.isPaused()).toBe(true);
    expect(clock.now(9000)).toBe(500);
    clock.resume(9000);
    expect(clock.isPaused()).toBe(false);
    expect(clock.now(9100)).toBe(600);
  });

  it('a paused game does not move on: no cat comes closer, no beam flies', () => {
    const g = game();
    const clock = createGameClock(0);
    for (let real = 0; real <= 2000; real += 20) g.tick(clock.now(real), centre);
    g.fire(clock.now(2000), centre, { x: 0, y: 0 });
    const before = g.snapshot();
    clock.pause(2000);
    for (let real = 2000; real <= 30_000; real += 20) g.tick(clock.now(real), centre);
    expect(g.snapshot().cats).toEqual(before.cats);
    expect(g.snapshot().beams).toEqual(before.beams);
    expect(g.snapshot().lives).toBe(SURVIVAL_CONFIG.lives);
  });
});
