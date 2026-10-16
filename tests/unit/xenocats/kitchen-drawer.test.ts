// The second arsenal: six weapons and six passives more, their evolutions and three
// fusions, and the slots a run of each length allows. (arsenal.test.ts's own loops
// already hold every evolution and fusion, these among them, to its rules.)

import { describe, expect, it } from 'vitest';
import { ARENA_CONFIG, type ArenaConfig, createArena } from '@/app/ui/xenocats/arena';
import {
  BASE_WEAPONS,
  EVOLUTIONS,
  FUSIONS,
  MAX_WEAPON_LEVEL,
  PASSIVES,
  PASSIVE_SLOTS,
  type PassiveId,
  WEAPONS,
  WEAPON_SLOTS,
  type WeaponId,
  describeChoice,
  loadout,
  modifiers,
  offerChoices,
  passiveChanges,
  weaponStats,
} from '@/app/ui/xenocats/arsenal';
import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
import { createRandom } from '@/app/ui/xenocats/random';

const viewport = { width: 1280, height: 800 };
const still = { x: 0, y: 0 };
const none = modifiers(new Map());
const ALL_PASSIVES = Object.keys(PASSIVES) as PassiveId[];

function arena(config: Partial<ArenaConfig> = {}, seed = 1) {
  return createArena({ random: createRandom(seed), types: CAT_TYPES, viewport, config });
}

/** Only the twenty xenocat types: no swarms, no bosses. */
const xenocatsOnly: Partial<ArenaConfig> = {
  schedule: {
    arrivals: [{ from: 0, who: 'xenocat', weight: 1 }],
    swarms: { from: Infinity, everyMs: 1, size: [0, 0] },
    bosses: [],
  },
};

/** A hero nothing wears down, no chests, and gems worth nothing (no level-up interrupts). */
const steady: Partial<ArenaConfig> = {
  ...xenocatsOnly,
  chestReach: -1,
  hero: { ...ARENA_CONFIG.hero, resolve: 1e12 },
  gems: { ...ARENA_CONFIG.gems, value: 0, eliteValue: 0 },
};

const NEW_WEAPONS: WeaponId[] = [
  'tennis-ball',
  'frying-pan',
  'static-sock',
  'cucumber',
  'ceiling-fan',
  'alarm-clock',
];
const NEW_PASSIVES: PassiveId[] = [
  'tape-measure',
  'oven-mitts',
  'reading-glasses',
  'cookie-jar',
  'hot-water-bottle',
  'loaded-dice',
];

describe('the kitchen drawer: six weapons and six passives more', () => {
  it('each new weapon is offered, levels to 8, and evolves with one of the new passives', () => {
    for (const id of NEW_WEAPONS) {
      expect(BASE_WEAPONS).toContain(id);
      expect(WEAPONS[id].levels).toHaveLength(MAX_WEAPON_LEVEL);
      const evolution = EVOLUTIONS.find((e) => e.from === id);
      expect(evolution, id).toBeDefined();
      expect(NEW_PASSIVES).toContain(evolution!.with);
    }
    // Each new passive evolves exactly one of them.
    const used = EVOLUTIONS.filter((e) => NEW_WEAPONS.includes(e.from)).map((e) => e.with);
    expect(new Set(used).size).toBe(6);
    expect(BASE_WEAPONS).toHaveLength(20);
    expect(ALL_PASSIVES).toHaveLength(20);
  });

  it('three new fusions, each of two of the new evolved weapons', () => {
    const newEvolved = new Set(
      EVOLUTIONS.filter((e) => NEW_WEAPONS.includes(e.from)).map((e) => e.to)
    );
    const fusions = FUSIONS.filter((f) => f.from.some((id) => newEvolved.has(id)));
    expect(fusions.map((f) => f.to).sort()).toEqual([
      'clockwork-gale',
      'grand-slam',
      'kitchen-sink',
    ]);
    for (const f of fusions) for (const id of f.from) expect(newEvolved.has(id), id).toBe(true);
  });

  it('every new passive says what it gives', () => {
    for (const id of NEW_PASSIVES) {
      expect(passiveChanges(id, 1).length, id).toBeGreaterThan(0);
      expect(describeChoice({ kind: 'passive', id, level: 1 }).change, id).not.toBeNull();
    }
    expect(PASSIVES['loaded-dice'].maxLevel).toBe(3);
  });

  it('Tape Measure: what is thrown flies faster; what circles or pulls does not speed up', () => {
    const tape = modifiers(new Map([['tape-measure', 5]]));
    expect(weaponStats('tennis-ball', 1, tape).speed).toBeCloseTo(
      weaponStats('tennis-ball', 1, none).speed * 1.6
    );
    expect(weaponStats('cucumber', 1, tape).speed).toBeGreaterThan(
      weaponStats('cucumber', 1, none).speed
    );
    expect(weaponStats('can-opener', 1, tape).speed).toBe(weaponStats('can-opener', 1, none).speed);
    expect(weaponStats('vacuum-cleaner', 1, tape).speed).toBe(
      weaponStats('vacuum-cleaner', 1, none).speed
    );
  });

  /** Cats all round him, none sent home: the Homesickness given in `ms`. */
  function given(config: Partial<ArenaConfig>, ms = 10_000) {
    const a = arena({
      ...steady,
      startingWeapons: ['alarm-clock'],
      startingLevel: MAX_WEAPON_LEVEL,
      escalation: [[0, 40]],
      ...config,
      cats: { ...ARENA_CONFIG.cats, ...config.cats, homesickness: [1e9, 1e9] },
    });
    while (a.state().time < ms) a.step(still);
    return a.cats().reduce((sum, cat) => sum + cat.homesickness, 0);
  }

  it('Reading Glasses: elites grow more homesick, plain cats do not', () => {
    const elites = { cats: { ...ARENA_CONFIG.cats, eliteShare: 1 } };
    const ratio = given({ ...elites, startingPassives: ['reading-glasses'] }) / given(elites);
    expect(ratio).toBeCloseTo(1.15, 2);
    const plain = { cats: { ...ARENA_CONFIG.cats, eliteShare: 0 } };
    expect(given({ ...plain, startingPassives: ['reading-glasses'] })).toBeCloseTo(given(plain), 6);
  });

  it('Oven Mitts: a cat that reaches him drains less of his Resolve', () => {
    const firstDrain = (passives: PassiveId[]) => {
      const a = arena({
        ...steady,
        startingWeapons: [],
        startingPassives: passives,
        escalation: [[0, 20]],
      });
      const full = a.state().hero.resolve;
      while (a.state().hero.resolve === full && a.state().time < 30_000) a.step(still);
      return full - a.state().hero.resolve;
    };
    const bare = firstDrain([]);
    expect(bare).toBeGreaterThan(0);
    expect(firstDrain(['oven-mitts'])).toBeCloseTo(bare * 0.92, 4);
  });

  it('Cookie Jar: the cats sent home leave more pickups', () => {
    const left = (passives: PassiveId[]) => {
      const a = arena({
        ...steady,
        startingWeapons: ['alarm-clock'],
        startingLevel: MAX_WEAPON_LEVEL,
        startingPassives: passives,
        escalation: [[0, 60]],
        cats: { ...ARENA_CONFIG.cats, eliteShare: 0 },
        pickups: { ...ARENA_CONFIG.pickups, chance: 0.05 },
      });
      let n = 0;
      while (a.state().time < 30_000) {
        a.step(still);
        n += a.drainEvents().filter((e) => e.kind === 'pickup-left').length;
      }
      return n;
    };
    expect(left(['cookie-jar'])).toBeGreaterThan(left([]));
  });

  it('Hot Water Bottle: some Resolve returns at each level', () => {
    const atFirstLevel = (passives: PassiveId[]) => {
      const a = arena({
        ...steady,
        startingWeapons: ['alarm-clock'],
        startingPassives: passives,
        escalation: [[0, 30]],
        cats: { ...ARENA_CONFIG.cats, eliteShare: 0 },
        gems: { ...ARENA_CONFIG.gems, value: 1, eliteValue: 6 },
      });
      while (a.state().time < 60_000) {
        a.step(still);
        if (a.drainEvents().some((e) => e.kind === 'level-up')) break;
      }
      return a.state().hero;
    };
    const without = atFirstLevel([]);
    // He was reached before he levelled: there is Resolve to give back.
    expect(without.resolve).toBeLessThan(without.maxResolve - 4);
    expect(atFirstLevel(['hot-water-bottle']).resolve).toBeCloseTo(without.resolve + 4, 4);
  });

  it('Loaded Dice: each level taken is another reroll', () => {
    const rerolls = (a: ReturnType<typeof arena>) => a.state().heroes[0].rerollsLeft;
    expect(rerolls(arena({ startingPassives: ['loaded-dice'] })) - rerolls(arena())).toBe(1);
    // Taken at a level-up (a chest at his feet brings one).
    for (let seed = 1; seed < 200; seed++) {
      const a = arena(
        { ...xenocatsOnly, escalation: [[0, 0]], startingChests: 1, chestReach: 36 },
        seed
      );
      a.step(still);
      const dice = a.choices()!.findIndex((c) => c.kind === 'passive' && c.id === 'loaded-dice');
      if (dice < 0) continue;
      const before = rerolls(a);
      a.choose(dice);
      expect(rerolls(a)).toBe(before + 1);
      return;
    }
    throw new Error('No seed offered the Loaded Dice.');
  });

  /**
   * A run that starts holding `weapons` at their top level, with `chests` at his feet
   * (one fuses a pair; without a pair it would bring a level-up, and the run would wait).
   */
  function fused(weapons: WeaponId[], chests = 1) {
    return arena({
      ...steady,
      chestReach: ARENA_CONFIG.chestReach,
      startingWeapons: weapons,
      startingLevel: MAX_WEAPON_LEVEL,
      startingChests: chests,
      escalation: [[0, 60]],
      cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [1e9, 1e9] },
    });
  }

  it('the Kitchen Sink sends pickles all round him; the Clockwork Gale stops the cats', () => {
    const sink = fused(['cast-iron-skillet', 'pickle-jar']);
    let pickles = 0;
    while (sink.state().time < 9_000) {
      sink.step(still);
      pickles = Math.max(
        pickles,
        sink.projectiles().filter((p) => p.bit && p.weapon === 'pickle-jar').length
      );
    }
    expect(sink.state().weapons.map((w) => w.id)).toEqual(['kitchen-sink']);
    expect(pickles).toBeGreaterThanOrEqual(WEAPONS['kitchen-sink'].levels[0].count);

    const gale = fused(['heatwave-fan', 'grandfather-clock']);
    let stopped = 0;
    while (gale.state().time < 25_000) {
      gale.step(still);
      const now = gale.state().time;
      stopped = Math.max(stopped, gale.cats().filter((c) => c.stunUntil > now).length);
    }
    expect(gale.state().weapons.map((w) => w.id)).toEqual(['clockwork-gale']);
    expect(stopped).toBeGreaterThan(5);
  });

  it('the Heatwave Fan scorches what its blades touch; each zone weapon draws its own zone', () => {
    const fan = fused(['heatwave-fan'], 0);
    let scorched = false;
    while (fan.state().time < 25_000 && !scorched) {
      fan.step(still);
      scorched = fan.cats().some((c) => c.vulnUntil > fan.state().time);
    }
    expect(scorched).toBe(true);
    const zones = arena({ ...steady, startingWeapons: ['alarm-clock', 'thunderous-vacuum'] });
    expect(zones.zones().map((z) => z.weapon)).toEqual(['alarm-clock', 'thunderous-vacuum']);
  });
});

describe('slots: more in a longer run, no limit in an endless one', () => {
  const six = new Map(BASE_WEAPONS.slice(0, 6).map((id) => [id, 1] as const));
  const sixPassives = new Map(ALL_PASSIVES.slice(0, 6).map((id) => [id, 1] as const));
  /** How many different weapons and passives he does not hold are ever offered. */
  const newOnes = (slots: { weapons: number; passives: number }) => {
    const weapons = new Set<string>();
    const passives = new Set<string>();
    for (let seed = 1; seed < 60; seed++) {
      for (const c of offerChoices(six, sixPassives, 40, createRandom(seed), BASE_WEAPONS, slots)) {
        if (c.kind === 'weapon' && c.level === 1) weapons.add(c.id);
        if (c.kind === 'passive' && c.level === 1) passives.add(c.id);
      }
    }
    return { weapons: weapons.size, passives: passives.size };
  };

  it('six held of each: a five-minute run offers no new one, a longer or endless one every other', () => {
    expect(newOnes({ weapons: WEAPON_SLOTS, passives: PASSIVE_SLOTS })).toEqual({
      weapons: 0,
      passives: 0,
    });
    expect(newOnes({ weapons: 8, passives: 8 })).toEqual({ weapons: 14, passives: 14 });
    expect(newOnes({ weapons: Infinity, passives: Infinity })).toEqual({
      weapons: 14,
      passives: 14,
    });
  });

  it('the pause menu counts the slots of the run, or none', () => {
    const weapons = [{ id: 'laser-pointer' as const, level: 1 }];
    expect(loadout(weapons, [], { weapons: 10, passives: 10 }).freeWeaponSlots).toBe(9);
    const endless = loadout(weapons, [], { weapons: Infinity, passives: Infinity });
    expect(endless.freeWeaponSlots).toBe(Infinity);
    expect(endless.freePassiveSlots).toBe(Infinity);
  });
});
