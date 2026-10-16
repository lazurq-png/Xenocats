// The second arsenal: six weapons and six passives more, their evolutions and three
// fusions, and the slots a run of each length allows. (arsenal.test.ts's own loops
// already hold every evolution and fusion, these among them, to its rules.)

import { describe, expect, it } from 'vitest';
import {
  ARENA_CONFIG,
  type ArenaCat,
  type ArenaConfig,
  createArena,
} from '@/app/ui/xenocats/arena';
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

describe('the kitchen drawer: four ways of working no other weapon has', () => {
  /** One weapon at `level`, cats nothing sends home all round him. */
  function lab(id: WeaponId, level = 1, crowd = 60) {
    return arena({
      ...steady,
      startingWeapons: [id],
      startingLevel: level,
      escalation: [[0, crowd]],
      cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [1e9, 1e9] },
    });
  }
  /** Steps until `id` fires (true), or 20 s pass. */
  function untilFired(a: ReturnType<typeof arena>, id: WeaponId) {
    while (a.state().time < 20_000) {
      a.step(still);
      if (a.drainEvents().some((e) => e.kind === 'fired' && e.weapon === id)) return true;
    }
    return false;
  }
  /** Steps until the crowd has come round him (so what is thrown has cats to land among). */
  function gathered(a: ReturnType<typeof arena>, cats = 30) {
    const near = () => a.cats().filter((c) => distance(a, c) < 300).length;
    while (near() < cats && a.state().time < 30_000) a.step(still);
    expect(near()).toBeGreaterThanOrEqual(cats);
    // What fired while they came is past.
    a.drainEvents();
    return a;
  }
  const distance = (a: ReturnType<typeof arena>, at: { x: number; y: number }) =>
    Math.hypot(at.x - a.state().hero.x, at.y - a.state().hero.y);

  it('each has a kind of its own, and none of the other weapons has it', () => {
    const own = {
      'tennis-ball': 'boomerang',
      'frying-pan': 'swat',
      'static-sock': 'cling',
      cucumber: 'scare',
    } as const;
    for (const [id, kind] of Object.entries(own)) {
      expect(WEAPONS[id as WeaponId].kind, id).toBe(kind);
      const others = (Object.keys(WEAPONS) as WeaponId[]).filter((other) => other !== id);
      expect(
        others.filter((other) => WEAPONS[other].kind === kind),
        id
      ).toEqual([]);
    }
  });

  it('Tennis Ball: served out, it turns halfway and comes back to his hand', () => {
    const a = lab('tennis-ball');
    expect(untilFired(a, 'tennis-ball')).toBe(true);
    const ball = a.projectiles().find((p) => p.weapon === 'tennis-ball')!;
    const served = a.state().time;
    const { durationMs } = weaponStats('tennis-ball', 1, none);
    let furthest = 0;
    let last = 0;
    let lastSeen = served;
    while (a.projectiles().includes(ball) && a.state().time < served + durationMs * 3) {
      last = distance(a, ball);
      furthest = Math.max(furthest, last);
      lastSeen = a.state().time;
      a.step(still);
    }
    // Out a long way, then back to him, after its half time was spent going out.
    expect(furthest).toBeGreaterThan(200);
    expect(last).toBeLessThan(40);
    expect(lastSeen - served).toBeGreaterThan(durationMs / 2);
    // Gone once home, long before its time would have ended it.
    expect(a.projectiles().includes(ball)).toBe(false);
  });

  it('Tennis Ball: a ball spent on cats going out still comes back, and may touch them again', () => {
    const a = gathered(lab('tennis-ball', 1, 120));
    expect(untilFired(a, 'tennis-ball')).toBe(true);
    // The one just served (launched last).
    const ball = a.projectiles().findLast((p) => p.weapon === 'tennis-ball')!;
    expect(ball.splits).toBe(1);
    let touchedOut = 0;
    let touchedBack = 0;
    let back = false;
    while (a.projectiles().includes(ball) && a.state().time < 20_000) {
      if (ball.splits === 0) back = true;
      if (back) touchedBack = Math.max(touchedBack, ball.touched.length);
      else touchedOut = Math.max(touchedOut, ball.touched.length);
      a.step(still);
    }
    expect(back).toBe(true);
    expect(touchedOut).toBeGreaterThan(0);
    expect(touchedBack).toBeGreaterThan(0);
  });

  it('Frying Pan: the cat it swats flies away from him, and hurts the cats it lands among', () => {
    const a = lab('frying-pan', 1, 120);
    expect(untilFired(a, 'frying-pan')).toBe(true);
    const now = a.state().time;
    const flying = a.cats().filter((c) => c.flungUntil > now);
    expect(flying).toHaveLength(weaponStats('frying-pan', 1, none).count);
    expect(a.swats()).toHaveLength(1);
    const cat = flying[0];
    const id = cat.id;
    const from = distance(a, cat);
    // Only the pan hurts: every other homesick cat was bowled over by the one it swatted.
    while (a.state().time < now + 400) a.step(still);
    const flown = a.cats().find((c) => c.id === id)!;
    expect(distance(a, flown) - from).toBeGreaterThan(100);
    const bowled = a.cats().filter((c) => c.id !== id && c.homesickness > 0);
    expect(bowled.length).toBeGreaterThan(0);
    expect(bowled.length).toBeLessThanOrEqual(4);
    for (const c of bowled) {
      expect(c.homesickness).toBeCloseTo(weaponStats('frying-pan', 1, none).damage * 0.5, 6);
    }
  });

  it('Static Sock: it clings to a cat, walks with it, sparks at a friend, and falls off when spent', () => {
    const a = lab('static-sock');
    expect(untilFired(a, 'static-sock')).toBe(true);
    expect(a.socks()).toHaveLength(1);
    const sock = a.socks()[0];
    const host = a.cats().find((c) => c.id === sock.host)!;
    const sparks = weaponStats('static-sock', 1, none).count;
    let beams = 0;
    let sparked = 0;
    let last = host.homesickness;
    // Its own: the first sock, until it falls off (the next is thrown later).
    while (a.socks().includes(sock)) {
      a.step(still);
      if (!a.socks().includes(sock)) break;
      // Where its cat goes, it goes.
      const now = a.cats().find((c) => c.id === sock.host)!;
      expect({ x: sock.x, y: sock.y }).toEqual({ x: now.x, y: now.y });
      if (sock.host === host.id && host.homesickness > last) {
        sparked++;
        last = host.homesickness;
      }
      beams = Math.max(beams, a.beams().length);
    }
    // Its cat took a spark each time (until the next sock came), a friend with each.
    expect(sparked).toBeGreaterThanOrEqual(sparks - 1);
    expect(beams).toBeGreaterThan(0);
  });

  it('Static Sock: when its cat goes home it leaves it for a live cat, never the one going', () => {
    const a = lab('static-sock');
    expect(untilFired(a, 'static-sock')).toBe(true);
    const sock = a.socks()[0];
    const going = a.cats().find((c) => c.id === sock.host)!;
    // Its cat is sent home (by something else) before the sock's turn.
    going.homesickness = going.limit;
    a.step(still);
    expect(sock.host).not.toBe(going.id);
    expect(a.cats().some((c) => c.id === sock.host && c.homesickness < c.limit)).toBe(true);
    expect(a.cats().some((c) => c.id === going.id)).toBe(false);
  });

  it('the four together fill the screen: a fixed build of the kitchen drawer at its best', () => {
    const a = arena({
      ...steady,
      startingWeapons: ['tennis-ball', 'frying-pan', 'static-sock', 'cucumber'],
      startingLevel: MAX_WEAPON_LEVEL,
      escalation: [[0, 120]],
      cats: { ...ARENA_CONFIG.cats, eliteShare: 0 },
    });
    let most = 0;
    while (a.state().time < 60_000) {
      a.step(still);
      most = Math.max(
        most,
        a.state().projectiles + a.beams().length + a.swats().length + a.socks().length
      );
    }
    // As busy as the four were as spread, sweep, chain and burst (29 then, 26 now: D10).
    expect(most).toBeGreaterThan(20);
  });

  it('Cucumber: where it lands the small cats run from it, and it still bursts into slices', () => {
    const a = gathered(lab('cucumber', 1, 120));
    const { durationMs, count } = weaponStats('cucumber', 1, none);
    // It may land the step it is thrown (on a cat close by): step until cats are
    // startled this very step (they run for its whole time from now).
    let running: ArenaCat[] = [];
    while (running.length === 0 && a.state().time < 20_000) {
      a.step(still);
      running = a.cats().filter((c) => c.fleeUntil === a.state().time + durationMs);
    }
    expect(running.length).toBeGreaterThan(0);
    // The step it landed: its slices are all in flight (in a crowd they are spent by the next).
    expect(
      a.projectiles().filter((p) => p.weapon === 'cucumber' && p.bit).length
    ).toBeGreaterThanOrEqual(count);
    // They run away from where it landed.
    const before = running.map((c) => ({ id: c.id, d: Math.hypot(c.x - c.fleeX, c.y - c.fleeY) }));
    for (let i = 0; i < 5; i++) a.step(still);
    for (const { id, d } of before) {
      const cat = a.cats().find((c) => c.id === id);
      if (cat && cat.fleeUntil > a.state().time && cat.flungUntil <= a.state().time) {
        expect(Math.hypot(cat.x - cat.fleeX, cat.y - cat.fleeY)).toBeGreaterThan(d);
      }
    }
    // Other weapons startle nobody.
    const laser = lab('laser-pointer', MAX_WEAPON_LEVEL, 120);
    while (laser.state().time < 10_000) laser.step(still);
    expect(laser.cats().some((c) => c.fleeUntil > 0)).toBe(false);
  });
});
