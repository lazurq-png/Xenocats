import { describe, expect, it } from 'vitest';
import { ARENA_CONFIG, createArena } from '@/app/ui/xenocats/arena';
import { MAX_WEAPON_LEVEL } from '@/app/ui/xenocats/arsenal';
import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
import { createRandom } from '@/app/ui/xenocats/random';
import { CROWD_ARSENAL } from '@/app/ui/xenocats/test-hooks';

// The Survival simulation's step cost, with a crowd and a late-game arsenal (the six
// evolved weapons at level 8). Seeded, so the same crowd every run; the times are the
// machine's. Prints a table; asserts only that the crowd was there, never a time.
//
//   npx vitest run -c vitest.bench.config.mts
//
// Each size: warm up until the crowd has arrived (the arena adds a share a second at
// most), then time `MEASURED` steps with the Keeper walking in a circle, so the cats
// keep closing on him and the weapons keep firing.

const SIZES = [500, 2000, 6000];
const WARMUP_STEPS = 900;
const MEASURED = 600;
const viewport = { width: 1280, height: 800 };

const at = (sorted: number[], q: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

function bench(size: number) {
  const arena = createArena({
    random: createRandom(7),
    types: CAT_TYPES,
    viewport,
    config: {
      escalation: [[0, size]],
      startingWeapons: CROWD_ARSENAL,
      startingLevel: MAX_WEAPON_LEVEL,
      hero: { ...ARENA_CONFIG.hero, resolve: 1e9 },
      // The arsenal sends cats home as fast as they come; new ones arrive fast enough
      // to keep the crowd the size asked for.
      arrivalShare: 40,
      // No level-up may stop the run: gems worth nothing, chests out of reach.
      gems: { ...ARENA_CONFIG.gems, value: 0, eliteValue: 0 },
      chestReach: -1,
    },
  });
  const walk = (i: number) => ({ x: Math.cos(i / 90), y: Math.sin(i / 90) });
  for (let i = 0; i < WARMUP_STEPS; i++) arena.step(walk(i));
  const times: number[] = [];
  for (let i = 0; i < MEASURED; i++) {
    const t0 = performance.now();
    arena.step(walk(WARMUP_STEPS + i));
    times.push(performance.now() - t0);
  }
  const sorted = [...times].sort((a, b) => a - b);
  return {
    wanted: size,
    cats: arena.cats().length,
    'median ms': Number(at(sorted, 0.5).toFixed(3)),
    'p95 ms': Number(at(sorted, 0.95).toFixed(3)),
    'max ms': Number(sorted[sorted.length - 1].toFixed(3)),
    'steps/s at median': Math.round(1000 / at(sorted, 0.5)),
  };
}

describe('the arena step', () => {
  it('step cost with 500, 2000 and 6000 cats and a full late-game arsenal', () => {
    const rows = SIZES.map(bench);
    console.table(rows);
    for (const row of rows) {
      expect(row.cats, `${row.wanted} wanted`).toBeGreaterThan(row.wanted * 0.5);
    }
  });
});
