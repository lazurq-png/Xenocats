import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ARENA_CONFIG, createArena } from '@/app/ui/xenocats/arena';
import { MAX_WEAPON_LEVEL, type WeaponId } from '@/app/ui/xenocats/arsenal';
import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
import { createRandom } from '@/app/ui/xenocats/random';
import { CROWD_ARSENAL } from '@/app/ui/xenocats/test-hooks';

// Whether a change to the Survival simulation changed the game: a fingerprint of
// three seeded, crowded runs, run on demand, never in CI. A change meant to leave the
// game as it was (a speed change, a refactor) prints the same fingerprints before and
// after it; one meant to change the game prints others. Prints them; asserts only that
// the runs were crowded, never a fingerprint, so a change to the game fails nothing.
//
//   npx vitest run -c vitest.bench.config.mts tests/bench/arena-fingerprint
//
// Run it on the base (git stash, or a checkout of it), then on the change: the same
// lines, or the change moved something. Each run hashes every cat's position and
// homesickness every 100 steps of 2,400, and every gem at the end.

const RUNS: { name: string; size: number; gemValue: number; weapons: readonly WeaponId[] }[] = [
  // At the gem cap: gems worth nothing pile up, so every drop scans the most gems.
  { name: '2,000 cats, the gem cap', size: 2000, gemValue: 0, weapons: CROWD_ARSENAL },
  // Gems worth something: level-ups come, with their choices.
  { name: '2,000 cats, level-ups', size: 2000, gemValue: 1, weapons: CROWD_ARSENAL },
  // Toys that call the cats and Cucumbers they run from (the lure and flight steps).
  {
    name: '600 cats, toys and Cucumbers',
    size: 600,
    gemValue: 1,
    weapons: ['squeak-symphony', 'cucumber', 'infinite-laser'],
  },
];

function fingerprint(run: (typeof RUNS)[number]) {
  const arena = createArena({
    random: createRandom(11),
    types: CAT_TYPES,
    viewport: { width: 1280, height: 800 },
    config: {
      escalation: [[0, run.size]],
      startingWeapons: run.weapons,
      startingLevel: MAX_WEAPON_LEVEL,
      hero: { ...ARENA_CONFIG.hero, resolve: 1e9 },
      arrivalShare: 40,
      gems: { ...ARENA_CONFIG.gems, value: run.gemValue, eliteValue: run.gemValue * 6 },
      chestReach: -1,
    },
  });
  const hash = createHash('sha256');
  for (let i = 0; i < 2400; i++) {
    arena.step({ x: Math.cos(i / 90), y: Math.sin(i / 90) });
    if (i % 100 === 99) {
      for (const cat of arena.cats()) hash.update(`${cat.x},${cat.y},${cat.homesickness};`);
    }
  }
  for (const gem of arena.gems()) hash.update(`${gem.x},${gem.y},${gem.value};`);
  return { run: run.name, cats: arena.cats().length, fingerprint: hash.digest('hex').slice(0, 16) };
}

describe('the arena, seeded', () => {
  it('fingerprints of three crowded runs', () => {
    const rows = RUNS.map(fingerprint);
    console.table(rows);
    for (const [i, row] of rows.entries()) {
      expect(row.cats, row.run).toBeGreaterThan(RUNS[i].size * 0.5);
    }
  });
});
