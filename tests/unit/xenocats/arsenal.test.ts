import { describe, expect, it } from 'vitest';
import { ARENA_CONFIG, type ArenaConfig, createArena } from '@/app/ui/xenocats/arena';
import {
  MAX_PASSIVE_LEVEL,
  MAX_WEAPON_LEVEL,
  PASSIVES,
  type PassiveId,
  PASSIVE_SLOTS,
  WEAPONS,
  WEAPON_SLOTS,
  type WeaponId,
  describeChoice,
  modifiers,
  offerChoices,
  weaponStats,
  xpToNext,
} from '@/app/ui/xenocats/arsenal';
import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
import { createRandom } from '@/app/ui/xenocats/random';

const viewport = { width: 1280, height: 800 };
const still = { x: 0, y: 0 };
const ALL_WEAPONS = Object.keys(WEAPONS) as WeaponId[];
const ALL_PASSIVES = Object.keys(PASSIVES) as PassiveId[];
const none = modifiers(new Map());

function arena(config: Partial<ArenaConfig> = {}, seed = 1) {
  return createArena({ random: createRandom(seed), types: CAT_TYPES, viewport, config });
}

/** A hero nothing wears down, and gems worth nothing (no level-up interrupts). */
const steady: Partial<ArenaConfig> = {
  hero: { ...ARENA_CONFIG.hero, resolve: 1e12 },
  gems: { ...ARENA_CONFIG.gems, value: 0, eliteValue: 0 },
};

describe('experience', () => {
  it('each level needs more than the last, starting small', () => {
    expect(xpToNext(1)).toBe(5);
    for (let level = 1; level < 60; level++) {
      expect(xpToNext(level + 1)).toBeGreaterThan(xpToNext(level));
    }
  });
});

describe('the level-up offer', () => {
  const random = () => createRandom(4);

  it('offers three different choices, four with the Lucky Bell', () => {
    for (let seed = 1; seed < 30; seed++) {
      const offer = offerChoices(new Map([['laser-pointer', 1]]), new Map(), 3, createRandom(seed));
      expect(offer).toHaveLength(3);
      expect(new Set(offer.map((c) => JSON.stringify(c))).size).toBe(3);
    }
    const bell = modifiers(new Map([['lucky-bell', 1]]));
    expect(bell.choices).toBe(4);
    expect(
      offerChoices(new Map(), new Map([['lucky-bell', 1]]), bell.choices, random())
    ).toHaveLength(4);
  });

  it('never offers what is at its highest level', () => {
    const weapons = new Map<WeaponId, number>([['laser-pointer', MAX_WEAPON_LEVEL]]);
    const passives = new Map<PassiveId, number>([
      ['battery', MAX_PASSIVE_LEVEL],
      ['lucky-bell', 1],
    ]);
    for (let seed = 1; seed < 60; seed++) {
      for (const choice of offerChoices(weapons, passives, 4, createRandom(seed))) {
        if (choice.kind === 'weapon') expect(choice.id).not.toBe('laser-pointer');
        if (choice.kind === 'passive') {
          expect(choice.id).not.toBe('battery');
          expect(choice.id).not.toBe('lucky-bell');
        }
      }
    }
  });

  it('offers the next level of what is held, and nothing new once the slots are full', () => {
    const weapons = new Map<WeaponId, number>(
      ALL_WEAPONS.slice(0, WEAPON_SLOTS).map((id) => [id, 2])
    );
    const passives = new Map<PassiveId, number>(
      ALL_PASSIVES.slice(0, PASSIVE_SLOTS).map((id) => [id, 1])
    );
    for (let seed = 1; seed < 60; seed++) {
      for (const choice of offerChoices(weapons, passives, 4, createRandom(seed))) {
        if (choice.kind === 'weapon') {
          expect(weapons.has(choice.id)).toBe(true);
          expect(choice.level).toBe(3);
        }
        if (choice.kind === 'passive') {
          expect(passives.has(choice.id)).toBe(true);
          expect(choice.level).toBe(2);
        }
      }
    }
  });

  it('with everything at its highest, a moment of rest instead', () => {
    const weapons = new Map<WeaponId, number>(
      ALL_WEAPONS.slice(0, WEAPON_SLOTS).map((id) => [id, MAX_WEAPON_LEVEL])
    );
    const passives = new Map<PassiveId, number>(
      ALL_PASSIVES.slice(0, PASSIVE_SLOTS).map((id) => [id, PASSIVES[id].maxLevel])
    );
    const offer = offerChoices(weapons, passives, 3, random());
    expect(offer).toEqual([{ kind: 'restore' }]);
    expect(describeChoice(offer[0]).name).toBe('A Moment of Rest');
  });

  it('every choice has a name and a line in the game’s voice', () => {
    for (const id of ALL_WEAPONS) {
      expect(describeChoice({ kind: 'weapon', id, level: 1 }).name).toBe(WEAPONS[id].name);
      expect(describeChoice({ kind: 'weapon', id, level: 3 }).name).toContain('level 3');
    }
    for (const id of ALL_PASSIVES) expect(PASSIVES[id].description.length).toBeGreaterThan(10);
  });
});

describe('the passives', () => {
  it('each does what it says', () => {
    const at = (id: PassiveId, level = 3) => modifiers(new Map([[id, level]]));
    expect(at('rubber-chicken').speed).toBeGreaterThan(none.speed);
    expect(at('battery').cooldown).toBeLessThan(none.cooldown);
    expect(at('catnip').area).toBeGreaterThan(none.area);
    expect(at('scissors', MAX_PASSIVE_LEVEL).count).toBeGreaterThan(none.count);
    expect(at('wool-sweater').maxResolve).toBeGreaterThan(none.maxResolve);
    expect(at('warm-milk').recovery).toBeGreaterThan(none.recovery);
    expect(at('long-whiskers').pickup).toBeGreaterThan(none.pickup);
    expect(at('stern-look').might).toBeGreaterThan(none.might);
    expect(at('lucky-bell', 1).choices).toBe(4);
    // ...and reach the weapons.
    const plain = weaponStats('cat-treats', 1, none);
    const tuned = weaponStats(
      'cat-treats',
      1,
      modifiers(
        new Map([
          ['battery', 5],
          ['catnip', 5],
          ['scissors', 5],
          ['stern-look', 5],
        ])
      )
    );
    expect(tuned.cooldownMs).toBeLessThan(plain.cooldownMs);
    expect(tuned.area).toBeGreaterThan(plain.area);
    expect(tuned.count).toBeGreaterThan(plain.count);
    expect(tuned.damage).toBeGreaterThan(plain.damage);
  });
});

describe('every weapon, at level 1 and at its top level', () => {
  /** A run with only `id`, at `level`, cats all round; how many it sent home, and the arena. */
  function trial(id: WeaponId, level: number, ms = 25_000) {
    const a = arena({
      ...steady,
      startingWeapons: [id],
      startingLevel: level,
      escalation: [[0, 60]],
      cats: { ...ARENA_CONFIG.cats, eliteShare: 0 },
    });
    while (a.state().time < ms) a.step(still);
    return { sent: a.state().sentHome, a };
  }

  for (const id of ALL_WEAPONS) {
    it(`${id}: grows stronger with its levels, and sends cats home at both`, () => {
      const one = weaponStats(id, 1, none);
      const top = weaponStats(id, MAX_WEAPON_LEVEL, none);
      expect(top.damage).toBeGreaterThan(one.damage);
      expect(top.area).toBeGreaterThanOrEqual(one.area);
      expect(top.count).toBeGreaterThanOrEqual(one.count);
      if (one.cooldownMs > 0) expect(top.cooldownMs).toBeLessThan(one.cooldownMs);
      const low = trial(id, 1).sent;
      const high = trial(id, MAX_WEAPON_LEVEL).sent;
      expect(low).toBeGreaterThan(0);
      expect(high).toBeGreaterThan(low);
    });
  }

  it('the Laser Pointer at its top level aims several beams at once', () => {
    const a = arena({ ...steady, startingLevel: 8, escalation: [[0, 60]] });
    let most = 0;
    while (a.state().time < 15_000) {
      a.step(still);
      most = Math.max(most, a.drainEvents().filter((e) => e.kind === 'laser').length);
    }
    expect(most).toBe(weaponStats('laser-pointer', 8, none).count);
  });

  it('Cat Treats fly in a spread of their count', () => {
    const a = arena({ ...steady, startingWeapons: ['cat-treats'], escalation: [[0, 20]] });
    while (a.state().projectiles === 0 && a.state().time < 20_000) a.step(still);
    expect(a.state().projectiles).toBe(weaponStats('cat-treats', 1, none).count);
  });

  it('the Can Opener’s blades circle him at their reach; the Thunderous Vacuum touches only what is near', () => {
    const blades = arena({ ...steady, startingWeapons: ['can-opener'], startingLevel: 8 });
    const s = weaponStats('can-opener', 8, none);
    expect(blades.blades()).toHaveLength(s.count);
    for (const blade of blades.blades()) expect(Math.hypot(blade.x, blade.y)).toBeCloseTo(s.area);
    const zone = arena({
      ...steady,
      startingWeapons: ['thunderous-vacuum'],
      escalation: [[0, 40]],
      cats: { ...ARENA_CONFIG.cats, homesickness: [1e9, 1e9] },
    });
    const radius = weaponStats('thunderous-vacuum', 1, none).area;
    // Long enough for the slowest cats to walk in from off screen.
    while (zone.state().time < 20_000) zone.step(still);
    for (const cat of zone.cats()) {
      if (Math.hypot(cat.x, cat.y) > radius + 30) expect(cat.homesickness).toBe(0);
    }
    expect(zone.cats().some((c) => c.homesickness > 0)).toBe(true);
  });

  it('a Hairball bursts into smaller ones, as many as its count', () => {
    const a = arena({
      ...steady,
      startingWeapons: ['hairball'],
      escalation: [[0, 30]],
      cats: { ...ARENA_CONFIG.cats, homesickness: [1e9, 1e9] },
    });
    let most = 0;
    while (a.state().time < 15_000) {
      a.step(still);
      most = Math.max(most, a.projectiles().filter((p) => p.bit).length);
    }
    expect(most).toBeGreaterThanOrEqual(weaponStats('hairball', 1, none).count);
  });

  it('a Yarn Ball stays on the screen, bouncing off its edges', () => {
    const a = arena({ ...steady, startingWeapons: ['yarn-ball'], escalation: [[0, 0]] });
    let seen = 0;
    while (a.state().time < 3000) {
      a.step(still);
      for (const p of a.projectiles()) {
        seen++;
        expect(Math.abs(p.x)).toBeLessThanOrEqual(viewport.width / 2 + 20);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(viewport.height / 2 + 20);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('the Vacuum Cleaner draws the cats round him in', () => {
    const a = arena({
      ...steady,
      startingWeapons: ['vacuum-cleaner'],
      escalation: [[0, 30]],
      cats: { ...ARENA_CONFIG.cats, homesickness: [1e9, 1e9], speed: [0, 0] },
    });
    // Cats that do not walk: only the vacuum moves them. All thirty first, then he
    // walks among them; any cat that moves was drawn in, from within its reach.
    while (a.state().cats < 30) a.step(still);
    const area = weaponStats('vacuum-cleaner', 1, none).area;
    const where = new Map(a.cats().map((c) => [c.id, { x: c.x, y: c.y }]));
    let pulled = 0;
    while (a.state().time < 30_000) {
      const hero = { ...a.state().hero };
      // Towards the nearest cat.
      const target = a
        .cats()
        .reduce((p, c) =>
          Math.hypot(c.x - hero.x, c.y - hero.y) < Math.hypot(p.x - hero.x, p.y - hero.y) ? c : p
        );
      const d = Math.hypot(target.x - hero.x, target.y - hero.y) || 1;
      // Not onto it: a cat at his feet is not drawn anywhere.
      a.step(d < 120 ? still : { x: (target.x - hero.x) / d, y: (target.y - hero.y) / d });
      for (const cat of a.cats()) {
        const before = where.get(cat.id)!;
        if (Math.hypot(cat.x - before.x, cat.y - before.y) < 1e-9) continue;
        pulled++;
        // From within its reach, towards him.
        expect(Math.hypot(before.x - hero.x, before.y - hero.y)).toBeLessThan(area + 10);
        expect(Math.hypot(cat.x - hero.x, cat.y - hero.y)).toBeLessThan(
          Math.hypot(before.x - hero.x, before.y - hero.y)
        );
        where.set(cat.id, { x: cat.x, y: cat.y });
      }
    }
    expect(pulled).toBeGreaterThan(0);
  });
});

describe('what each weapon does, at level 1 and at level 8', () => {
  /** A run with only `id` at `level`, cats that never go home, all round him. */
  function only(id: WeaponId, level: number, cats = 60) {
    return arena({
      ...steady,
      startingWeapons: [id],
      startingLevel: level,
      escalation: [[0, cats]],
      cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [1e9, 1e9] },
    });
  }

  for (const level of [1, MAX_WEAPON_LEVEL]) {
    it(`level ${level}: each firing is as many beams, treats, droplets, bits and jumps as its count`, () => {
      const counts: Partial<Record<WeaponId, number>> = {};
      for (const id of [
        'laser-pointer',
        'cat-treats',
        'spray-bottle',
        'yarn-ball',
        'laser-pointer-deluxe',
      ] as WeaponId[]) {
        const a = only(id, level);
        let most = 0;
        while (a.state().time < 20_000) {
          const before = a.state().projectiles;
          a.step(still);
          const events = a.drainEvents();
          if (!events.some((e) => e.kind === 'fired')) continue;
          const lasers = events.filter((e) => e.kind === 'laser').length;
          const launched = a.state().projectiles - before;
          most = Math.max(
            most,
            WEAPONS[id].kind === 'beam' || WEAPONS[id].kind === 'chain' ? lasers : launched
          );
        }
        counts[id] = most;
        expect(most, id).toBe(weaponStats(id, level, none).count);
      }
      // A hairball, ended, bursts into its count of bits.
      const h = only('hairball', level, 30);
      let bits = 0;
      while (h.state().time < 20_000) {
        h.step(still);
        bits = Math.max(bits, h.projectiles().filter((p) => p.bit).length);
      }
      expect(bits).toBeGreaterThanOrEqual(weaponStats('hairball', level, none).count);
    });

    it(`level ${level}: every weapon that fires waits its cooldown between firings`, () => {
      for (const id of ALL_WEAPONS) {
        const s = weaponStats(id, level, none);
        if (s.cooldownMs === 0) continue;
        const a = only(id, level);
        const times: number[] = [];
        while (a.state().time < 25_000) {
          a.step(still);
          for (const e of a.drainEvents()) if (e.kind === 'fired') times.push(a.state().time);
        }
        expect(times.length, id).toBeGreaterThan(2);
        for (let i = 1; i < times.length; i++) {
          expect(times[i] - times[i - 1], id).toBeGreaterThanOrEqual(s.cooldownMs - 1);
        }
        // ...and no longer than that, with cats always in reach.
        expect(Math.min(...times.slice(1).map((t, i) => t - times[i])), id).toBeLessThan(
          s.cooldownMs + 50
        );
      }
    });

    it(`level ${level}: a thrown thing touches as many cats as its pierce, then it is spent`, () => {
      for (const id of ['cat-treats', 'spray-bottle', 'hairball'] as WeaponId[]) {
        const pierce = weaponStats(id, level, none).pierce;
        const a = only(id, level, 200);
        let spentSeen = false;
        while (a.state().time < 20_000) {
          a.step(still);
          for (const p of a.projectiles()) {
            if (p.bit) continue;
            // Never more than its pierce; a shot with none left is never still flying.
            expect(p.touched.length + p.pierce, id).toBe(pierce);
            expect(p.pierce, id).toBeGreaterThanOrEqual(1);
            if (p.touched.length === pierce - 1) spentSeen = true;
          }
        }
        expect(spentSeen, id).toBe(true);
      }
    });
  }
});

describe('levels in a run', () => {
  it('cats sent home leave gems; gathered, they bring a level, and the run waits for a choice', () => {
    const a = arena({
      hero: { ...ARENA_CONFIG.hero, resolve: 1e12 },
      escalation: [[0, 40]],
    });
    while (!a.choices() && a.state().time < 60_000) a.step(still);
    const offer = a.choices();
    expect(offer).not.toBeNull();
    expect(a.state().level).toBe(2);
    expect(offer!.length).toBe(3);
    // The run waits.
    const time = a.state().time;
    for (let i = 0; i < 30; i++) a.step(still);
    expect(a.state().time).toBe(time);
    // A new weapon chosen: held from then on, and the run goes on.
    const pick = offer!.findIndex((c) => c.kind === 'weapon' && c.level === 1);
    if (pick >= 0) {
      const chosen = offer![pick];
      a.choose(pick);
      expect(a.state().weapons.map((w) => w.id)).toContain(chosen.kind === 'weapon' && chosen.id);
    } else {
      a.choose(0);
    }
    a.step(still);
    expect(a.state().time).toBeGreaterThan(time);
  });

  it('a seeded five-minute run, choices made for it, ends with the screen full of attacks', () => {
    const a = arena({ hero: { ...ARENA_CONFIG.hero, resolve: 1e12 }, stepMs: 50 }, 11);
    let most = 0;
    while (a.state().time < 300_000) {
      const offer = a.choices();
      if (offer) {
        // Weapons first, new or better, as a player bent on attacks would.
        const weapon = offer.findIndex((c) => c.kind === 'weapon');
        a.choose(weapon >= 0 ? weapon : 0);
        continue;
      }
      // He walks a wide circle, gathering what falls.
      const t = a.state().time / 1500;
      a.step({ x: -Math.sin(t), y: Math.cos(t) });
      if (a.state().time > 240_000) {
        most = Math.max(most, a.state().projectiles + a.beams().length + a.blades().length);
      }
    }
    expect(a.state().weapons.length).toBe(6);
    expect(a.state().level).toBeGreaterThan(20);
    // Many attacks alive at once: things in flight, beams, blades.
    expect(most).toBeGreaterThan(30);
  }, 60_000);
});
