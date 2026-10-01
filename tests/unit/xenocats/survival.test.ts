import { describe, expect, it } from 'vitest';
import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
import { createRandom } from '@/app/ui/xenocats/random';
import {
  type FightCat,
  SURVIVAL_CONFIG,
  bestScore,
  createGameClock,
  createSurvival,
  waveSpec,
} from '@/app/ui/xenocats/survival';

const viewport = { width: 1200, height: 800 };
const centre = { x: 600, y: 400 };

function game(seed = 1, config = {}) {
  return createSurvival({ random: createRandom(seed), types: CAT_TYPES, viewport, now: 0, config });
}

/** Ticks every `step` ms from `from` to `to`; returns every cat whose attack landed. */
function run(
  g: ReturnType<typeof game>,
  from: number,
  to: number,
  options: { pointer?: { x: number; y: number }; room?: number; each?: () => void } = {},
  step = 20
) {
  const landed: FightCat[] = [];
  for (let now = from; now <= to; now += step) {
    landed.push(...g.tick(now, options.pointer ?? centre, options.room));
    options.each?.();
  }
  return landed;
}

/** Clicks every cat on screen, every tick: nothing ever lands. */
const banishAll = (g: ReturnType<typeof game>) => () => {
  for (const cat of g.snapshot().cats) g.click(cat);
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

  it('a wave is survived once all its cats have come and gone; the score counts them', () => {
    const g = game();
    run(g, 0, 60_000, { each: banishAll(g) });
    const snap = g.snapshot();
    expect(snap.status).toBe('playing');
    expect(snap.lives).toBe(SURVIVAL_CONFIG.lives);
    expect(snap.score).toBeGreaterThanOrEqual(3);
    expect(snap.wave).toBe(snap.score + 1);
  });

  it('brings exactly the wave’s number of cats', () => {
    const g = game();
    const seen = new Set<number>();
    run(g, 0, 30_000, {
      each: () => {
        if (g.snapshot().wave > 1) return;
        for (const cat of g.snapshot().cats) seen.add(cat.id);
        banishAll(g)();
      },
    });
    expect(g.snapshot().wave).toBeGreaterThan(1);
    expect(seen.size).toBe(waveSpec(1).count);
  });
});

describe('never more than five cats', () => {
  it('stays at five or fewer, however long the cats chase', () => {
    // Cats that never arrive (a pointer they cannot reach in time) pile up.
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

describe('attacks and lives', () => {
  it('cats arrive at an edge, away from the pointer, and chase it', () => {
    const g = game();
    run(g, 0, SURVIVAL_CONFIG.breakMs);
    const [cat] = g.snapshot().cats;
    expect(cat).toBeDefined();
    const distance = (c: { x: number; y: number }) => Math.hypot(c.x - centre.x, c.y - centre.y);
    expect(distance(cat)).toBeGreaterThanOrEqual(SURVIVAL_CONFIG.keepAwayFromPointer);
    run(g, SURVIVAL_CONFIG.breakMs + 20, SURVIVAL_CONFIG.breakMs + 1000);
    const later = g.snapshot().cats.find((c) => c.id === cat.id)!;
    expect(distance(later)).toBeLessThan(distance(cat));
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

  it('a cat that reaches the pointer lands its attack, leaves, and costs a life', () => {
    const g = game();
    const landed = run(g, 0, 20_000);
    expect(landed.length).toBeGreaterThan(0);
    const first = landed[0];
    expect(first).toMatchObject(centre);
    expect(g.snapshot().cats.find((c) => c.id === first.id)).toBeUndefined();
  });

  it('three landed attacks end the game; the score is the waves survived', () => {
    const g = game();
    const landed = run(g, 0, 60_000);
    const snap = g.snapshot();
    expect(landed).toHaveLength(SURVIVAL_CONFIG.lives);
    expect(snap.status).toBe('over');
    expect(snap.lives).toBe(0);
    expect(snap.cats).toHaveLength(0);
    expect(snap.score).toBe(0);
    // Nothing more happens once it is over.
    expect(g.tick(70_000, centre)).toEqual([]);
    expect(g.click(centre)).toBeNull();
  });
});

describe('clicking', () => {
  it('banishes the cat under the click, and only that one', () => {
    const g = game(5, { firstWave: { count: 2, spawnEveryMs: 10, speed: 1 } });
    run(g, 0, SURVIVAL_CONFIG.breakMs + SURVIVAL_CONFIG.minSpawnEveryMs + 20);
    const [a, b] = g.snapshot().cats;
    expect(b).toBeDefined();
    expect(g.click({ x: a.x + 10, y: a.y - 10 })).toMatchObject({ id: a.id });
    expect(g.snapshot().cats.map((c) => c.id)).toEqual([b.id]);
  });

  it('misses a cat further away than its reach', () => {
    const g = game(5, { firstWave: { count: 1, spawnEveryMs: 10, speed: 1 } });
    run(g, 0, SURVIVAL_CONFIG.breakMs + 20);
    const [cat] = g.snapshot().cats;
    expect(g.click({ x: cat.x + SURVIVAL_CONFIG.clickRadius + 1, y: cat.y })).toBeNull();
    expect(g.snapshot().cats).toHaveLength(1);
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

  it('a paused game does not move on: no cat comes closer', () => {
    const g = game();
    const clock = createGameClock(0);
    for (let real = 0; real <= 2000; real += 20) g.tick(clock.now(real), centre);
    const before = g.snapshot().cats;
    clock.pause(2000);
    for (let real = 2000; real <= 30_000; real += 20) g.tick(clock.now(real), centre);
    expect(g.snapshot().cats).toEqual(before);
    expect(g.snapshot().lives).toBe(SURVIVAL_CONFIG.lives);
  });
});
