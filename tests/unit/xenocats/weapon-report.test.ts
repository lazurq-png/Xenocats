// What each weapon did in a run (arena.weaponReport): counted in the simulation, as
// the results screen shows it.

import { describe, expect, it } from 'vitest';
import { ARENA_CONFIG, type ArenaConfig, createArena } from '@/app/ui/xenocats/arena';
import { FUSIONS, MAX_WEAPON_LEVEL, WEAPONS, type WeaponId } from '@/app/ui/xenocats/arsenal';
import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
import { createRandom } from '@/app/ui/xenocats/random';

const viewport = { width: 1280, height: 800 };
const still = { x: 0, y: 0 };

/** Xenocats only, a hero nothing wears down, no level-ups or chests unless asked. */
function arena(weapons: WeaponId[], config: Partial<ArenaConfig> = {}) {
  return createArena({
    random: createRandom(5),
    types: CAT_TYPES,
    viewport,
    config: {
      schedule: {
        arrivals: [{ from: 0, who: 'xenocat', weight: 1 }],
        swarms: { from: Infinity, everyMs: 1, size: [0, 0] },
        bosses: [],
      },
      chestReach: -1,
      hero: { ...ARENA_CONFIG.hero, resolve: 1e12 },
      gems: { ...ARENA_CONFIG.gems, value: 0, eliteValue: 0 },
      startingWeapons: weapons,
      escalation: [[0, 40]],
      ...config,
    },
  });
}
const run = (a: ReturnType<typeof arena>, ms: number) => {
  while (a.state().time < ms) a.step(still);
  return a;
};
/** Cats nothing sends home: all the homesickness given is still on them. */
const tough = {
  cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [1e9, 1e9] as [number, number] },
};

describe('what each weapon did', () => {
  it('a weapon held but not yet fired is listed with nothing done', () => {
    const a = arena(['laser-pointer']);
    expect(a.weaponReport()).toEqual([{ id: 'laser-pointer', homesickness: 0, sentHome: 0 }]);
  });

  it('every bit of homesickness given is counted, to the weapon that gave it', () => {
    const a = run(arena(['laser-pointer', 'can-opener'], tough), 15_000);
    const report = a.weaponReport();
    expect(report.map((w) => w.id).sort()).toEqual(['can-opener', 'laser-pointer']);
    for (const w of report) expect(w.homesickness, w.id).toBeGreaterThan(0);
    const onCats = a.cats().reduce((sum, c) => sum + c.homesickness, 0);
    const counted = report.reduce((sum, w) => sum + w.homesickness, 0);
    expect(counted).toBeCloseTo(onCats, 3);
    // Highest first.
    expect(report[0].homesickness).toBeGreaterThanOrEqual(report[1].homesickness);
  });

  // Every place a weapon hurts names it: nothing given goes uncounted, for any weapon
  // (a fused one is held as its two parents, fused at a chest at his feet).
  for (const id of Object.keys(WEAPONS) as WeaponId[]) {
    it(`${WEAPONS[id].name}: all it gives is counted for it`, () => {
      const fusion = FUSIONS.find((f) => f.to === id);
      const a = run(
        arena(fusion ? [...fusion.from] : [id], {
          ...tough,
          startingLevel: MAX_WEAPON_LEVEL,
          escalation: [[0, 60]],
          ...(fusion ? { startingChests: 1, chestReach: ARENA_CONFIG.chestReach } : {}),
        }),
        8_000
      );
      const report = a.weaponReport();
      const onCats = a.cats().reduce((sum, c) => sum + c.homesickness, 0);
      expect(onCats, id).toBeGreaterThan(0);
      expect(report.reduce((sum, w) => sum + w.homesickness, 0)).toBeCloseTo(onCats, 3);
      if (fusion) expect(report.find((w) => w.id === id)?.homesickness, id).toBeGreaterThan(0);
    });
  }

  it('each cat sent home is counted once, for the weapon that reached it last', () => {
    const a = run(arena(['laser-pointer', 'spray-bottle']), 30_000);
    const report = a.weaponReport();
    expect(a.state().sentHome).toBeGreaterThan(10);
    expect(report.reduce((sum, w) => sum + w.sentHome, 0)).toBe(a.state().sentHome);
    for (const w of report) expect(w.sentHome, w.id).toBeGreaterThan(0);
  });

  it('one weapon alone is credited with every cat sent home', () => {
    const a = run(arena(['cat-treats']), 30_000);
    expect(a.weaponReport()).toEqual([
      expect.objectContaining({ id: 'cat-treats', sentHome: a.state().sentHome }),
    ]);
    expect(a.state().sentHome).toBeGreaterThan(0);
  });

  it('two evolved weapons that fuse: both listed for what they did, the fused one for the rest', () => {
    const a = arena(['infinite-laser', 'monsoon'], {
      ...tough,
      startingLevel: MAX_WEAPON_LEVEL,
      startingChests: 1,
      chestReach: ARENA_CONFIG.chestReach,
      escalation: [[0, 60]],
    });
    let atFusion: Record<string, number> | null = null;
    while (a.state().time < 20_000) {
      a.step(still);
      if (!atFusion && a.drainEvents().some((e) => e.kind === 'fusion')) {
        atFusion = Object.fromEntries(a.weaponReport().map((w) => [w.id, w.homesickness]));
      }
    }
    expect(atFusion).not.toBeNull();
    const after = Object.fromEntries(a.weaponReport().map((w) => [w.id, w.homesickness]));
    expect(Object.keys(after).sort()).toEqual(['infinite-laser', 'monsoon', 'thunderstorm']);
    // The parents' work since goes to the Thunderstorm they are part of.
    expect(after['infinite-laser']).toBe(atFusion!['infinite-laser']);
    expect(after.monsoon).toBe(atFusion!.monsoon);
    expect(after.thunderstorm).toBeGreaterThan(0);
  });

  it('a weapon chosen at a level-up joins the list', () => {
    const a = arena(['laser-pointer'], {
      gems: { ...ARENA_CONFIG.gems, value: 50, eliteValue: 50 },
    });
    while (!a.choices() && a.state().time < 60_000) a.step(still);
    const offer = a.choices()!;
    const pick = offer.findIndex((c) => c.kind === 'weapon' && c.level === 1);
    expect(pick).toBeGreaterThanOrEqual(0);
    const chosen = offer[pick];
    a.choose(pick);
    expect(a.weaponReport().map((w) => w.id)).toContain(chosen.kind === 'weapon' && chosen.id);
  });
});
