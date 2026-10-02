import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCatEngine, type TryAttack } from '@/app/ui/xenocats/cat-engine';
import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
import { CAT_CONFIG } from '@/app/ui/xenocats/config';
import {
  INTENSITIES,
  INTENSITY_CONFIG,
  INTENSITY_KEY,
  getIntensity,
  parseIntensity,
  setIntensity,
  subscribeIntensity,
} from '@/app/ui/xenocats/intensity';
import { createRandom } from '@/app/ui/xenocats/random';

// The cat intensity setting: calm, normal or chaos.

describe('the levels', () => {
  it('normal is the cats as they were; none is zero; chaos keeps to five', () => {
    expect(INTENSITY_CONFIG.normal).toEqual({
      maxCats: CAT_CONFIG.maxCats,
      firstSpawnMs: CAT_CONFIG.firstSpawnMs,
      spawnEveryMs: CAT_CONFIG.spawnEveryMs,
    });
    for (const level of INTENSITIES) {
      expect(INTENSITY_CONFIG[level].maxCats, level).toBeGreaterThan(0);
      expect(INTENSITY_CONFIG[level].maxCats, level).toBeLessThanOrEqual(5);
    }
    expect(INTENSITY_CONFIG.chaos.maxCats).toBe(5);
    // Calm comes less often than normal, chaos more often.
    expect(INTENSITY_CONFIG.calm.spawnEveryMs[0]).toBeGreaterThan(CAT_CONFIG.spawnEveryMs[1]);
    expect(INTENSITY_CONFIG.chaos.spawnEveryMs[1]).toBeLessThan(CAT_CONFIG.spawnEveryMs[0]);
  });

  it('anything unknown reads as normal', () => {
    expect(parseIntensity('calm')).toBe('calm');
    expect(parseIntensity('chaos')).toBe('chaos');
    for (const value of [null, undefined, '', 'off', 'none', 'CHAOS']) {
      expect(parseIntensity(value)).toBe('normal');
    }
  });
});

/** Cats spawned over ten simulated minutes at a level (none ever attacks). */
function spawnsAt(level: (typeof INTENSITIES)[number]) {
  const engine = createCatEngine({
    random: createRandom(7),
    types: CAT_TYPES,
    viewport: { width: 1200, height: 800 },
    autoSpawn: true,
  });
  engine.configure(INTENSITY_CONFIG[level]);
  const never: TryAttack = () => false;
  let most = 0;
  for (let now = 0; now <= 600_000; now += 50) {
    engine.tick(now, { x: 600, y: 400 }, never);
    most = Math.max(most, engine.cats().length);
  }
  return most;
}

describe('the engine at each level', () => {
  it('holds at most the level’s cats at once: 2 calm, 5 chaos', () => {
    expect(spawnsAt('calm')).toBe(2);
    expect(spawnsAt('normal')).toBe(5);
    expect(spawnsAt('chaos')).toBe(5);
  });

  it('never lets a setting exceed five or reach zero', () => {
    const engine = createCatEngine({
      random: createRandom(1),
      types: CAT_TYPES,
      viewport: { width: 1200, height: 800 },
      autoSpawn: true,
    });
    engine.configure({ maxCats: 50 });
    expect(engine.config.maxCats).toBe(5);
    engine.configure({ maxCats: 0 });
    expect(engine.config.maxCats).toBe(1);
  });

  it('chaos brings the first cat sooner than calm', () => {
    const firstAt = (level: (typeof INTENSITIES)[number]) => {
      const engine = createCatEngine({
        random: createRandom(3),
        types: CAT_TYPES,
        viewport: { width: 1200, height: 800 },
        autoSpawn: true,
      });
      engine.configure(INTENSITY_CONFIG[level]);
      for (let now = 0; now <= 60_000; now += 50) {
        engine.tick(now, { x: 600, y: 400 }, () => false);
        if (engine.cats().length > 0) return now;
      }
      return Infinity;
    };
    expect(firstAt('chaos')).toBeLessThanOrEqual(3_000);
    expect(firstAt('calm')).toBeGreaterThanOrEqual(10_000);
  });
});

describe('remembered in localStorage', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubWindow(storage: Partial<Storage>) {
    const listeners: (() => void)[] = [];
    vi.stubGlobal('window', {
      localStorage: storage,
      addEventListener: (_: string, listener: () => void) => listeners.push(listener),
      removeEventListener: () => {},
    });
  }

  it('stores the choice and tells subscribers', () => {
    const store = new Map<string, string>();
    stubWindow({
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => void store.set(key, value),
    });
    expect(getIntensity()).toBe('normal');
    const onChange = vi.fn();
    const unsubscribe = subscribeIntensity(onChange);
    setIntensity('chaos');
    expect(store.get(INTENSITY_KEY)).toBe('chaos');
    expect(getIntensity()).toBe('chaos');
    expect(onChange).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
