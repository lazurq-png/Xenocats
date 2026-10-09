import { describe, expect, it } from 'vitest';
import {
  ARENA_CONFIG,
  type ArenaConfig,
  type ArenaEvent,
  GULP_BURST_RADIUS,
  YARN_APOCALYPSE_CAP,
  createArena,
} from '@/app/ui/xenocats/arena';
import {
  BASE_WEAPONS,
  EVOLUTIONS,
  FUSIONS,
  MAX_PASSIVE_LEVEL,
  MAX_WEAPON_LEVEL,
  PASSIVES,
  type PassiveId,
  PASSIVE_SLOTS,
  WEAPONS,
  WEAPON_SLOTS,
  type WeaponId,
  describeChoice,
  evolutionFor,
  evolutionText,
  fusionFor,
  fusionText,
  levelChanges,
  loadout,
  modifiers,
  offerChoices,
  passiveChanges,
  weaponStats,
  xpToNext,
} from '@/app/ui/xenocats/arsenal';
import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
import { createRandom } from '@/app/ui/xenocats/random';
import { TIER_CLASS, TIER_NAMES, type Tier, tierOf, tierStyle } from '@/app/ui/xenocats/item-tier';
import tailwind from '@/tailwind.config';

const config = (a: { config: ArenaConfig }) => a.config;
const stats8 = (id: WeaponId) => weaponStats(id, MAX_WEAPON_LEVEL, modifiers(new Map()));

const viewport = { width: 1280, height: 800 };
const still = { x: 0, y: 0 };
const ALL_WEAPONS = Object.keys(WEAPONS) as WeaponId[];
const ALL_PASSIVES = Object.keys(PASSIVES) as PassiveId[];
const none = modifiers(new Map());

function arena(config: Partial<ArenaConfig> = {}, seed = 1) {
  return createArena({ random: createRandom(seed), types: CAT_TYPES, viewport, config });
}

/** A hero nothing wears down, and gems worth nothing (no level-up interrupts). */
/** Only the twenty xenocat types, as before the varieties: no swarms, no bosses. */
const xenocatsOnly: Partial<ArenaConfig> = {
  schedule: {
    arrivals: [{ from: 0, who: 'xenocat', weight: 1 }],
    swarms: { from: Infinity, everyMs: 1, size: [0, 0] },
    bosses: [],
  },
};

const steady: Partial<ArenaConfig> = {
  ...xenocatsOnly,
  chestReach: -1,
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

describe('every upgrade says what it does, and does it', () => {
  /** The phrase a card uses for each stat (see levelChanges). */
  const PHRASE: Record<string, RegExp> = {
    count: /^\+\d+ [a-z]+$/,
    damage: /^\+\d+% homesickness$/,
    cooldownMs: /^fires \d+% sooner$/,
    area: /^\+\d+% (reach|size|range)$/,
    speed: /^\+\d+% (speed|pull|turning speed|knockback|squeak range|push)$/,
    durationMs: /^lasts \d+% longer$/,
    pierce: /^(passes through|holds) \d+ more cats?$/,
  };

  for (const id of BASE_WEAPONS) {
    it(`${WEAPONS[id].name}: each level names every stat it changes, and only those`, () => {
      const { levels } = WEAPONS[id];
      for (let level = 2; level <= MAX_WEAPON_LEVEL; level++) {
        const before = levels[level - 2];
        const after = levels[level - 1];
        const changed = (Object.keys(PHRASE) as (keyof typeof before)[]).filter(
          (key) => after[key] !== before[key]
        );
        const phrases = levelChanges(id, level);
        expect(phrases, `level ${level}`).toHaveLength(changed.length);
        for (const key of changed) {
          expect(
            phrases.some((phrase) => PHRASE[key].test(phrase)),
            `level ${level}: ${key}`
          ).toBe(true);
        }
        // The numbers are the stats' own.
        if (after.count !== before.count) {
          expect(phrases).toContain(
            `+${after.count - before.count} ${WEAPONS[id].unit}${after.count - before.count === 1 ? '' : 's'}`
          );
        }
        if (after.damage !== before.damage) {
          const pct = Math.round((after.damage / before.damage - 1) * 100);
          expect(phrases).toContain(`+${pct}% homesickness`);
        }
        // Every level is one the player notices: one more of something, or a tenth more.
        const noticed =
          after.count > before.count ||
          after.pierce > before.pierce ||
          (['damage', 'area', 'speed', 'durationMs'] as const).some(
            (key) => before[key] > 0 && after[key] / before[key] >= 1.1
          ) ||
          (before.cooldownMs > 0 && after.cooldownMs / before.cooldownMs <= 0.9);
        expect(noticed, `level ${level}`).toBe(true);
        // ...and it is never a step back.
        expect(after.damage).toBeGreaterThanOrEqual(before.damage);
        expect(after.count).toBeGreaterThanOrEqual(before.count);
        expect(after.cooldownMs).toBeLessThanOrEqual(before.cooldownMs);
      }
      expect(levelChanges(id, 1)).toEqual([]);
    });
  }

  it('the level-up card carries the change; a new weapon its own line only', () => {
    expect(describeChoice({ kind: 'weapon', id: 'laser-pointer', level: 2 }).change).toBe(
      '+1 beam.'
    );
    expect(describeChoice({ kind: 'weapon', id: 'laser-pointer', level: 1 }).change).toBeNull();
    // Scissors names what it adds to: the vacuums pull and hum as one, whatever it says.
    expect(describeChoice({ kind: 'passive', id: 'scissors', level: 1 }).change).toBe(
      '+1 beam, treat, droplet, ball, blade, piece, jump, swing, toy, carton, jet or bubble for each weapon that fires them.'
    );
    expect(describeChoice({ kind: 'restore' }).change).toBeNull();
  });

  it('every pick of a passive adds the same, the first included', () => {
    for (const id of ALL_PASSIVES) {
      const step = (level: number) => {
        const after = modifiers(new Map([[id, level]]));
        const before = modifiers(new Map(level > 1 ? [[id, level - 1]] : []));
        return (Object.keys(after) as (keyof typeof after)[]).map(
          (key) => Math.round((after[key] - before[key]) * 1000) / 1000
        );
      };
      for (let level = 1; level <= PASSIVES[id].maxLevel; level++) {
        expect(step(level), `${id} level ${level}`).toEqual(step(1));
        expect(step(level).some((change) => change !== 0)).toBe(true);
        expect(passiveChanges(id, level), `${id} level ${level}`).toEqual(passiveChanges(id, 1));
        expect(passiveChanges(id, level).length).toBeGreaterThan(0);
      }
    }
  });

  it('Scissors: each pick, one more of what every weapon fires', () => {
    for (let level = 0; level <= MAX_PASSIVE_LEVEL; level++) {
      const mods = modifiers(new Map(level > 0 ? [['scissors', level]] : []));
      expect(mods.count).toBe(level);
      expect(weaponStats('laser-pointer', 1, mods).count).toBe(1 + level);
    }
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

  for (const id of BASE_WEAPONS) {
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
      // No elites: an elite's effect could move him off the centre this measures from.
      cats: { ...ARENA_CONFIG.cats, homesickness: [1e9, 1e9], eliteShare: 0 },
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
        // From within its reach (counted from the cat's edge), towards him.
        expect(Math.hypot(before.x - hero.x, before.y - hero.y)).toBeLessThanOrEqual(
          // (he walks a step before the pull, up to 4 px)
          area + cat.radius + 5
        );
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
        // As a player bent on attacks would: weapons first, the one that throws the
        // most at its best (the build, not luck, decides how full the screen gets).
        const throws = (c: (typeof offer)[number]) =>
          c.kind === 'weapon' ? WEAPONS[c.id].levels[MAX_WEAPON_LEVEL - 1].count : -1;
        const best = offer.reduce((b, c, i) => (throws(c) > throws(offer[b]) ? i : b), 0);
        a.choose(best);
        continue;
      }
      // He walks a wide circle, gathering what falls.
      const t = a.state().time / 1500;
      a.step({ x: -Math.sin(t), y: Math.cos(t) });
      if (a.state().time > 240_000) {
        // Things in flight, beams, blades, and what the household weapons make: jets,
        // swings, toys, boxes and puddles.
        most = Math.max(
          most,
          a.state().projectiles +
            a.beams().length +
            a.blades().length +
            a.jets().length +
            a.sweeps().length +
            a.patches().length
        );
      }
    }
    expect(a.state().weapons.length).toBe(6);
    expect(a.state().level).toBeGreaterThan(20);
    // Many attacks alive at once: things in flight, beams, blades.
    expect(most).toBeGreaterThan(30);
    // A whole five-minute run: about 40 s alone, more beside other test files.
  }, 120_000);
});

describe('evolution', () => {
  type Run = ReturnType<typeof arena>;

  /** A run where every cat is an elite (each leaves a chest), nothing levels up. */
  function ready(weapon: WeaponId, level: number, passives: PassiveId[], chestReach = 36) {
    return arena({
      ...steady,
      chestReach,
      startingWeapons: [weapon],
      startingLevel: level,
      startingPassives: passives,
      escalation: [[0, 20]],
      cats: { ...ARENA_CONFIG.cats, eliteShare: 1 },
    });
  }

  /** He walks to the nearest chest until he opens one; the events of that step. */
  function openChest(a: Run): ArenaEvent[] {
    while (a.state().time < 120_000) {
      const { x, y } = a.state().hero;
      const [chest] = [...a.chests()].sort(
        (p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y)
      );
      let input = still;
      if (chest) {
        const d = Math.hypot(chest.x - x, chest.y - y) || 1;
        input = { x: (chest.x - x) / d, y: (chest.y - y) / d };
      }
      a.step(input);
      const events = a.drainEvents();
      if (events.some((e) => e.kind === 'chest')) return events;
    }
    throw new Error('no chest opened');
  }

  const held = (a: Run) => new Map(a.state().weapons.map((w) => [w.id, w.level] as const));

  for (const { from, with: passive, to } of EVOLUTIONS) {
    describe(`${WEAPONS[from].name} + ${PASSIVES[passive].name} → ${WEAPONS[to].name}`, () => {
      it('at its top level, with the passive, a chest evolves it in its place', () => {
        const a = ready(from, MAX_WEAPON_LEVEL, [passive]);
        const events = openChest(a);
        expect(events).toContainEqual({ kind: 'evolution', from, to });
        expect(held(a).has(from)).toBe(false);
        expect(held(a).get(to)).toBe(MAX_WEAPON_LEVEL);
        // The chest went to the evolution: no level-up waits.
        expect(a.choices()).toBeNull();
      });

      it('one level short, the chest is a level-up instead', () => {
        const a = ready(from, MAX_WEAPON_LEVEL - 1, [passive]);
        const events = openChest(a);
        expect(events.some((e) => e.kind === 'evolution')).toBe(false);
        expect(held(a).get(from)).toBe(MAX_WEAPON_LEVEL - 1);
        expect(a.choices()).not.toBeNull();
      });

      it('without the passive, the chest is a level-up instead', () => {
        const a = ready(from, MAX_WEAPON_LEVEL, []);
        const events = openChest(a);
        expect(events.some((e) => e.kind === 'evolution')).toBe(false);
        expect(held(a).get(from)).toBe(MAX_WEAPON_LEVEL);
        expect(a.choices()).not.toBeNull();
      });

      it('without a chest, nothing evolves', () => {
        const a = ready(from, MAX_WEAPON_LEVEL, [passive], -1);
        while (a.state().time < 30_000) a.step(still);
        expect(a.drainEvents().some((e) => e.kind === 'evolution')).toBe(false);
        expect(held(a).get(from)).toBe(MAX_WEAPON_LEVEL);
      });
    });
  }

  it('the rules alone: the top level, the passive held, and not evolved already', () => {
    const top = new Map<WeaponId, number>([['laser-pointer', MAX_WEAPON_LEVEL]]);
    const battery = new Map<PassiveId, number>([['battery', 1]]);
    expect(evolutionFor(top, battery)?.to).toBe('infinite-laser');
    expect(evolutionFor(new Map([['laser-pointer', 7]]), battery)).toBeNull();
    expect(evolutionFor(top, new Map([['catnip', 5]]))).toBeNull();
    const both = new Map<WeaponId, number>([...top, ['infinite-laser', MAX_WEAPON_LEVEL]]);
    expect(evolutionFor(both, battery)).toBeNull();
  });

  it('an evolved weapon is never offered at a level-up', () => {
    for (const { to } of EVOLUTIONS) expect(BASE_WEAPONS).not.toContain(to);
    for (let seed = 1; seed <= 40; seed++) {
      for (const choice of offerChoices(new Map(), new Map(), 4, createRandom(seed))) {
        if (choice.kind === 'weapon') expect(BASE_WEAPONS).toContain(choice.id);
      }
    }
    // Held, it is at its top level: never offered again either.
    const evolved = new Map<WeaponId, number>([['infinite-laser', MAX_WEAPON_LEVEL]]);
    for (let seed = 1; seed <= 40; seed++) {
      for (const choice of offerChoices(evolved, new Map(), 4, createRandom(seed))) {
        expect(choice.kind === 'weapon' && choice.id === 'infinite-laser').toBe(false);
      }
    }
  });

  it('once evolved, the weapon it was is never offered again', () => {
    for (const { from, to } of EVOLUTIONS) {
      const held = new Map<WeaponId, number>([[to, MAX_WEAPON_LEVEL]]);
      for (let seed = 1; seed <= 60; seed++) {
        for (const choice of offerChoices(held, new Map(), 4, createRandom(seed))) {
          expect(choice.kind === 'weapon' && choice.id === from, `${from} offered`).toBe(false);
        }
      }
    }
  });

  it('an evolution announces itself in the game’s voice', () => {
    expect(evolutionText('yarn-ball', 'yarn-apocalypse')).toBe(
      'The Yarn Ball is no more. In its place: the Yarn Apocalypse.'
    );
    expect(evolutionText('cat-treats', 'banquet')).toBe(
      'The Cat Treats is no more. In its place: the Banquet.'
    );
    // Every evolution reads as a sentence: never "the The".
    for (const { from, to } of EVOLUTIONS) expect(evolutionText(from, to)).not.toMatch(/the The/i);
  });

  /** A run with only `id`, many cats that never go home unless it sends them. */
  function evolved(id: WeaponId, cats = 80, homesickness: [number, number] = [1e9, 1e9]) {
    return arena({
      ...steady,
      startingWeapons: [id],
      startingLevel: MAX_WEAPON_LEVEL,
      escalation: [[0, cats]],
      cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness },
    });
  }

  it('the Infinite Laser: beams at many cats at once, joined into a web, over and over', () => {
    const a = evolved('infinite-laser');
    const s = weaponStats('infinite-laser', MAX_WEAPON_LEVEL, none);
    let most = 0;
    let webbed = false;
    const firings: number[] = [];
    while (a.state().time < 20_000) {
      a.step(still);
      const events = a.drainEvents();
      if (!events.some((e) => e.kind === 'fired')) continue;
      firings.push(a.state().time);
      most = Math.max(most, events.filter((e) => e.kind === 'laser').length);
      const { x, y } = a.state().hero;
      // Some beams run cat to cat, not from him.
      if (a.beams().some((b) => Math.hypot(b.from.x - x, b.from.y - y) > 1)) webbed = true;
    }
    expect(most).toBe(s.count);
    expect(webbed).toBe(true);
    // Fired again and again: never more than a moment apart once cats are near.
    const late = firings.filter((t) => t > 10_000);
    for (let i = 1; i < late.length; i++) {
      expect(late[i] - late[i - 1]).toBeLessThanOrEqual(s.cooldownMs + a.config.stepMs);
    }
    expect(late.length).toBeGreaterThan(30);
  });

  it('the Forbidden Catnip Vacuum: draws in cats from far off, then sends them home together', () => {
    // Cats that need a lot, but not a burst's worth.
    const a = evolved('forbidden-catnip-vacuum', 80, [300, 300]);
    const s = weaponStats('forbidden-catnip-vacuum', MAX_WEAPON_LEVEL, none);
    let pulledFar = false;
    let mostAtOnce = 0;
    while (a.state().time < 30_000) {
      const before = new Map(a.cats().map((c) => [c.id, Math.hypot(c.x, c.y)]));
      const sentBefore = a.state().sentHome;
      a.step(still);
      const events = a.drainEvents();
      if (events.some((e) => e.kind === 'fired')) {
        // At the pull: cats well beyond the burst came within it.
        for (const cat of a.cats()) {
          const was = before.get(cat.id) ?? 0;
          if (was > s.area * 0.6 && Math.hypot(cat.x, cat.y) < GULP_BURST_RADIUS) pulledFar = true;
        }
      }
      mostAtOnce = Math.max(mostAtOnce, a.state().sentHome - sentBefore);
    }
    expect(pulledFar).toBe(true);
    expect(mostAtOnce).toBeGreaterThanOrEqual(10);
  });

  /**
   * Cats sent home in 30 s by `id` alone, at its top level, from a steady horde of
   * sturdy cats: sturdy, so the weapon decides how many go, not how fast they come.
   */
  function sentHomeBy(id: WeaponId) {
    const a = arena({
      ...steady,
      startingWeapons: [id],
      startingLevel: MAX_WEAPON_LEVEL,
      escalation: [[0, 120]],
      cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [150, 150] },
    });
    while (a.state().time < 30_000) a.step(still);
    return a.state().sentHome;
  }

  /** The widest gap between the ways one throw's shots fly, radians (a ring has none wide). */
  function widestGap(id: WeaponId) {
    const a = evolved(id);
    while (a.state().projectiles === 0 && a.state().time < 20_000) a.step(still);
    expect(a.state().projectiles).toBe(weaponStats(id, MAX_WEAPON_LEVEL, none).count);
    const ways = a
      .projectiles()
      .map((p) => Math.atan2(p.vy, p.vx))
      .sort((u, v) => u - v);
    let widest = ways[0] + 2 * Math.PI - ways[ways.length - 1];
    for (let i = 1; i < ways.length; i++) widest = Math.max(widest, ways[i] - ways[i - 1]);
    return widest;
  }

  it('the Banquet sends home more than Cat Treats at their best, in a ring', () => {
    expect(sentHomeBy('banquet')).toBeGreaterThan(sentHomeBy('cat-treats') * 1.5);
    // A ring: no way out of it is wider than an eighth of a turn; Cat Treats are a fan.
    expect(widestGap('banquet')).toBeLessThan(Math.PI / 4);
    expect(widestGap('cat-treats')).toBeGreaterThan(Math.PI);
  });

  it('Monsoon sends home more than the Spray Bottle at its best', () => {
    expect(sentHomeBy('monsoon')).toBeGreaterThan(sentHomeBy('spray-bottle') * 1.5);
  });

  it('the Yarn Apocalypse: its balls split as they bounce, up to a limit', () => {
    const a = evolved('yarn-apocalypse');
    const s = weaponStats('yarn-apocalypse', MAX_WEAPON_LEVEL, none);
    let most = 0;
    while (a.state().time < 30_000) {
      a.step(still);
      const balls = a.projectiles().filter((p) => p.weapon === 'yarn-apocalypse').length;
      most = Math.max(most, balls);
      expect(balls).toBeLessThanOrEqual(YARN_APOCALYPSE_CAP + s.count);
    }
    expect(most).toBeGreaterThan(s.count * 4);
  });

  it('the Yarn Apocalypse: a ball past the edge, and the half it splits off, head back in', () => {
    const a = evolved('yarn-apocalypse');
    const { width, height } = viewport;
    let outside = 0;
    while (a.state().time < 20_000) {
      a.step(still);
      for (const p of a.projectiles()) {
        if (p.weapon !== 'yarn-apocalypse') continue;
        // He stands at the origin: the screen is centred on him.
        if (Math.abs(p.x) > width / 2) {
          outside++;
          expect(Math.sign(p.vx)).toBe(-Math.sign(p.x));
        }
        if (Math.abs(p.y) > height / 2) {
          outside++;
          expect(Math.sign(p.vy)).toBe(-Math.sign(p.y));
        }
      }
    }
    expect(outside).toBeGreaterThan(0);
  });
});

describe('aiming with a crosshair (desktop, player 1)', () => {
  /** Up and to the left of him, well away: a way no weapon would take by itself. */
  const OFFSET = { x: -300, y: -300 };
  const AIM_ANGLE = Math.atan2(OFFSET.y, OFFSET.x);
  const off = (angle: number) =>
    Math.abs(Math.atan2(Math.sin(angle - AIM_ANGLE), Math.cos(angle - AIM_ANGLE)));

  /** A Keeper with only `id` at its top level, no cats ever, aiming or not. */
  function empty(id: WeaponId, aiming: boolean) {
    const a = arena({ ...steady, startingWeapons: [id], startingLevel: MAX_WEAPON_LEVEL });
    const { x, y } = a.state().hero;
    if (aiming) a.aimAt({ x: x + OFFSET.x, y: y + OFFSET.y });
    return a;
  }

  /** What one second of firing sends out, read as the ways it leaves him. */
  function ways(id: WeaponId, aiming: boolean) {
    const a = empty(id, aiming);
    const found: number[] = [];
    for (let n = 0; n < 40; n++) {
      a.step(still, false);
      const hero = a.state().hero;
      for (const p of a.projectiles()) {
        if (!p.bit && Math.hypot(p.x - hero.x, p.y - hero.y) < 60) {
          found.push(Math.atan2(p.vy, p.vx));
        }
      }
      for (const b of a.beams()) found.push(Math.atan2(b.to.y - b.from.y, b.to.x - b.from.x));
    }
    return found;
  }

  // How far round from the crosshair's way each may go: its own fan.
  const AIMING: [WeaponId, number][] = [
    ['laser-pointer', 1.5 * 0.16 + 1e-6],
    ['cat-treats', 4 * 0.16 + 1e-6],
    ['hairball', 1e-6],
    ['spray-bottle', 0.3 * Math.PI + 1e-6],
    ['yarn-ball', Math.PI / 4 + 1e-6],
  ];

  for (const [id, fan] of AIMING) {
    it(`${WEAPONS[id].name}: every shot heads for the crosshair, cat or no cat`, () => {
      const aimed = ways(id, true);
      expect(aimed.length).toBeGreaterThan(0);
      for (const angle of aimed) expect(off(angle)).toBeLessThanOrEqual(fan);
    });
  }

  it('without the crosshair, nothing changes: the beam and the treats wait for a cat', () => {
    expect(ways('laser-pointer', false)).toEqual([]);
    expect(ways('cat-treats', false)).toEqual([]);
    // The bottle still sprays the way he faces (right), away from the crosshair.
    for (const angle of ways('spray-bottle', false)) expect(off(angle)).toBeGreaterThan(1);
  });

  /** A Keeper with only `id`, cats all round, stepped a while; aiming or not. */
  function crowded(id: WeaponId, aiming: boolean, seed = 5) {
    const a = arena(
      {
        ...steady,
        startingWeapons: [id],
        startingLevel: MAX_WEAPON_LEVEL,
        escalation: [[0, 60]],
        cats: { ...ARENA_CONFIG.cats, eliteShare: 0 },
      },
      seed
    );
    const { x, y } = a.state().hero;
    const point = { x: x + OFFSET.x, y: y + OFFSET.y };
    if (aiming) a.aimAt(point);
    return { a, point };
  }

  for (const id of ['laser-pointer-deluxe', 'infinite-laser'] as WeaponId[]) {
    it(`${WEAPONS[id].name}: aimed, it takes the cats in its reach nearest the crosshair, never one past it`, () => {
      const { a, point } = crowded(id, true);
      const area = weaponStats(id, MAX_WEAPON_LEVEL, none).area;
      const key = (v: { x: number; y: number }) => `${v.x},${v.y}`;
      const toAim = (v: { x: number; y: number }) => Math.hypot(v.x - point.x, v.y - point.y);
      let before = new Set<string>();
      let checked = 0;
      for (let n = 0; n < 400; n++) {
        a.step(still);
        const hero = a.state().hero;
        const now = a.beams().filter((b) => !before.has(key(b.from) + key(b.to)));
        before = new Set(a.beams().map((b) => key(b.from) + key(b.to)));
        // What this step's firing reached: the chain's first jump starts at him; the
        // web's lines join its cats.
        const reached = now.flatMap((b) => {
          const fromHim = b.from.x === hero.x && b.from.y === hero.y;
          if (id === 'laser-pointer-deluxe') return fromHim ? [b.to] : [];
          return fromHim ? [] : [b.from, b.to];
        });
        if (reached.length === 0) continue;
        // Weapons fire after the cats move, so those still here stand where they were.
        const inReach = a
          .cats()
          .filter((c) => Math.hypot(c.x - hero.x, c.y - hero.y) <= area + c.radius);
        const farthest = Math.max(...reached.map(toAim));
        for (const end of reached) {
          expect(Math.hypot(end.x - hero.x, end.y - hero.y)).toBeLessThanOrEqual(
            area + 2 * ARENA_CONFIG.cats.radius
          );
        }
        // No cat he could reach, and left out, is nearer the crosshair.
        const chosen = new Set(reached.map(key));
        for (const cat of inReach) {
          if (!chosen.has(key(cat))) expect(toAim(cat)).toBeGreaterThanOrEqual(farthest - 1e-6);
        }
        checked++;
      }
      expect(checked).toBeGreaterThan(0);
    });
  }

  it('the vacuums and the blades never aim: a run is the same with the crosshair or without', () => {
    for (const id of [
      'vacuum-cleaner',
      'thunderous-vacuum',
      'forbidden-catnip-vacuum',
      'can-opener',
      'bottomless-saucer',
    ] as WeaponId[]) {
      const aimed = crowded(id, true).a;
      const free = crowded(id, false).a;
      for (let n = 0; n < 300; n++) {
        aimed.step(still);
        free.step(still);
      }
      expect(aimed.state().sentHome, id).toBe(free.state().sentHome);
      expect(aimed.cats().map((c) => [c.x, c.y])).toEqual(free.cats().map((c) => [c.x, c.y]));
    }
  });

  it('the crosshair can be put away again: null, and the weapons find their own cats', () => {
    const a = empty('laser-pointer', true);
    a.aimAt(null);
    for (let n = 0; n < 40; n++) a.step(still, false);
    expect(a.beams()).toEqual([]);
  });
});

describe('the pause menu: what he carries', () => {
  it('each weapon at its level of its highest, what its next level adds, and the free slots', () => {
    const view = loadout(
      [
        { id: 'laser-pointer', level: 3 },
        { id: 'can-opener', level: MAX_WEAPON_LEVEL },
      ],
      [{ id: 'scissors', level: 2 }]
    );
    expect(view.weapons).toEqual([
      {
        id: 'laser-pointer',
        name: 'Laser Pointer',
        level: 3,
        maxLevel: MAX_WEAPON_LEVEL,
        evolved: false,
        next: 'Fires 20% sooner.',
      },
      {
        id: 'can-opener',
        name: 'Can Opener',
        level: MAX_WEAPON_LEVEL,
        maxLevel: MAX_WEAPON_LEVEL,
        evolved: false,
        next: null,
      },
    ]);
    // The same words as the level-up card for that level.
    expect(view.weapons[0].next).toBe(
      describeChoice({ kind: 'weapon', id: 'laser-pointer', level: 4 }).change
    );
    expect(view.freeWeaponSlots).toBe(WEAPON_SLOTS - 2);
    expect(view.freePassiveSlots).toBe(PASSIVE_SLOTS - 1);
  });

  it('a passive says what it gives in all, at its level', () => {
    const view = loadout(
      [],
      [
        { id: 'scissors', level: 2 },
        { id: 'rubber-chicken', level: 3 },
        { id: 'lucky-bell', level: 1 },
      ]
    );
    expect(view.passives.map((p) => [p.name, p.level, p.maxLevel, p.gives])).toEqual([
      [
        'Scissors',
        2,
        MAX_PASSIVE_LEVEL,
        '+2 beam, treat, droplet, ball, blade, piece, jump, swing, toy, carton, jet or bubble for each weapon that fires them.',
      ],
      ['Rubber Chicken', 3, MAX_PASSIVE_LEVEL, '+30% walking speed.'],
      ['Lucky Bell', 1, 1, '+1 choice at every level.'],
    ]);
    // Equal to what modifiers gives: Scissors 2 adds two to every weapon's count.
    expect(modifiers(new Map([['scissors', 2]])).count).toBe(2);
  });

  it('an evolved weapon is marked, grows no further, and its evolution is no longer within reach', () => {
    const view = loadout(
      [{ id: 'infinite-laser', level: MAX_WEAPON_LEVEL }],
      [{ id: 'battery', level: 1 }]
    );
    expect(view.weapons[0]).toMatchObject({
      evolved: true,
      next: null,
      maxLevel: MAX_WEAPON_LEVEL,
    });
    expect(view.evolutions.find((e) => e.to === 'infinite-laser')).toBeUndefined();
  });

  it('evolutions within reach say what is missing; none missing, the next chest he opens evolves it', () => {
    const started = loadout([{ id: 'laser-pointer', level: 5 }], [{ id: 'catnip', level: 1 }]);
    expect(started.evolutions).toEqual([
      {
        from: 'laser-pointer',
        with: 'battery',
        to: 'infinite-laser',
        missing: ['the Laser Pointer at level 8 (now 5)', 'the Battery'],
        ready: false,
        after: null,
      },
      {
        from: 'vacuum-cleaner',
        with: 'catnip',
        to: 'forbidden-catnip-vacuum',
        missing: ['the Vacuum Cleaner'],
        ready: false,
        after: null,
      },
    ]);
    const ready = loadout(
      [{ id: 'laser-pointer', level: MAX_WEAPON_LEVEL }],
      [{ id: 'battery', level: 1 }]
    );
    expect(ready.evolutions).toEqual([
      {
        from: 'laser-pointer',
        with: 'battery',
        to: 'infinite-laser',
        missing: [],
        ready: true,
        after: null,
      },
    ]);
  });

  it('two ready at once: the one a chest evolves first is ready, the other after it', () => {
    const weapons = [
      { id: 'laser-pointer' as WeaponId, level: MAX_WEAPON_LEVEL },
      { id: 'vacuum-cleaner' as WeaponId, level: MAX_WEAPON_LEVEL },
    ];
    const passives = [
      { id: 'battery' as PassiveId, level: 1 },
      { id: 'catnip' as PassiveId, level: 1 },
    ];
    const view = loadout(weapons, passives);
    // The chest's own rule picks one.
    const first = evolutionFor(
      new Map(weapons.map((w) => [w.id, w.level])),
      new Map(passives.map((p) => [p.id, p.level]))
    )!;
    const readyOnes = view.evolutions.filter((e) => e.ready);
    expect(readyOnes.map((e) => e.to)).toEqual([first.to]);
    for (const e of view.evolutions.filter((e) => !e.ready && e.missing.length === 0)) {
      expect(e.after).toBe(first.to);
    }
    expect(view.evolutions.filter((e) => e.after !== null)).toHaveLength(1);
  });

  it('an evolution whose missing piece has no free slot is out of reach, and not listed', () => {
    // Six passives, none of them the Battery: the Battery can never come.
    const passives = (
      ['rubber-chicken', 'catnip', 'scissors', 'wool-sweater', 'warm-milk', 'stern-look'] as const
    ).map((id) => ({ id, level: 1 }));
    const view = loadout([{ id: 'laser-pointer', level: 3 }], passives);
    expect(view.freePassiveSlots).toBe(0);
    expect(view.evolutions.map((e) => e.to)).not.toContain('infinite-laser');
    // ...while one whose pieces could still come stays: the Vacuum Cleaner has a slot.
    expect(view.evolutions.map((e) => e.to)).toContain('forbidden-catnip-vacuum');
  });

  it('read from a real run: what a seeded arena holds after level-ups is what it lists', () => {
    const a = arena({ ...steady, gems: ARENA_CONFIG.gems, escalation: [[0, 40]] }, 11);
    let choices = 0;
    for (let n = 0; n < 4000 && choices < 3; n++) {
      if (a.choices()) {
        a.choose(0);
        choices++;
      } else a.step(still);
    }
    expect(choices).toBe(3);
    const hero = a.state().heroes[0];
    const view = loadout(hero.weapons, hero.passives);
    expect(view.weapons.map((w) => [w.id, w.level])).toEqual(
      hero.weapons.map((w) => [w.id, w.level])
    );
    expect(view.passives.map((p) => [p.id, p.level])).toEqual(
      hero.passives.map((p) => [p.id, p.level])
    );
    expect(view.freeWeaponSlots).toBe(WEAPON_SLOTS - hero.weapons.length);
    expect(view.freePassiveSlots).toBe(PASSIVE_SLOTS - hero.passives.length);
    // Its evolution hints are the held pieces' and agree with the chest's rule.
    const next = evolutionFor(
      new Map(hero.weapons.map((w) => [w.id, w.level])),
      new Map(hero.passives.map((p) => [p.id, p.level]))
    );
    for (const e of view.evolutions) {
      expect(
        hero.weapons.some((w) => w.id === e.from) || hero.passives.some((p) => p.id === e.with)
      ).toBe(true);
      expect(e.ready).toBe(next?.to === e.to);
    }
    // One starting weapon at level 1, and three choices, each one more level of something.
    const levels =
      hero.weapons.reduce((sum, w) => sum + w.level, 0) +
      hero.passives.reduce((sum, p) => sum + p.level, 0);
    expect(levels).toBe(1 + choices);
  });

  it('never names a secret evolution', () => {
    const secret = EVOLUTIONS.find((e) => e.secret)!;
    const view = loadout(
      [{ id: secret.from, level: MAX_WEAPON_LEVEL }],
      [{ id: secret.with, level: 1 }]
    );
    expect(view.evolutions.map((e) => e.to)).not.toContain(secret.to);
  });
});

describe('the household arsenal: five weapons and five passives, each its own way', () => {
  /** A run with only `id` at `level`, cats all round, a hero nothing wears down. */
  function lab(id: WeaponId, level = MAX_WEAPON_LEVEL, config: Partial<ArenaConfig> = {}) {
    return arena({
      ...steady,
      startingWeapons: [id],
      startingLevel: level,
      escalation: [[0, 40]],
      cats: { ...ARENA_CONFIG.cats, eliteShare: 0 },
      ...config,
    });
  }
  type Run = ReturnType<typeof lab>;
  /** Cats nothing sends home, so what a weapon does to them can be seen. */
  const tough: Partial<ArenaConfig> = {
    cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [1e9, 1e9] },
  };

  /** Steps until the weapon has fired; whether it did within `ms`. */
  function untilFired(a: Run, id: WeaponId, ms = 60_000) {
    while (a.state().time < ms) {
      a.step(still);
      if (a.drainEvents().some((e) => e.kind === 'fired' && e.weapon === id)) return true;
    }
    return false;
  }
  const stats = (id: WeaponId) => weaponStats(id, MAX_WEAPON_LEVEL, none);

  it('fourteen base weapons and five evolved ones are carried; each new one has a name, a unit and a line', () => {
    for (const id of [
      'feather-wand',
      'squeaky-toy',
      'cardboard-box',
      'hair-dryer',
      'bath-tub',
    ] as const) {
      expect(BASE_WEAPONS).toContain(id);
      expect(WEAPONS[id].name.length).toBeGreaterThan(3);
      expect(WEAPONS[id].description.length).toBeGreaterThan(20);
    }
    for (const id of [
      'peacock-tail',
      'squeak-symphony',
      'cardboard-castle',
      'scorch-dryer',
      'jacuzzi',
    ] as const) {
      expect(BASE_WEAPONS).not.toContain(id);
      expect(EVOLUTIONS.some((e) => e.to === id)).toBe(true);
    }
    expect(EVOLUTIONS).toHaveLength(11);
  });

  it('four of the five have a way of working no earlier weapon has: sweep, lure, trap and blow', () => {
    const old = new Set(
      (Object.keys(WEAPONS) as WeaponId[])
        .filter(
          (id) =>
            ![
              'feather-wand',
              'squeaky-toy',
              'cardboard-box',
              'hair-dryer',
              'peacock-tail',
              'squeak-symphony',
              'cardboard-castle',
              'scorch-dryer',
            ].includes(id)
        )
        .map((id) => WEAPONS[id].kind)
    );
    for (const id of ['feather-wand', 'squeaky-toy', 'cardboard-box', 'hair-dryer'] as const) {
      expect(old.has(WEAPONS[id].kind), id).toBe(false);
    }
    expect(WEAPONS['feather-wand'].kind).toBe('sweep');
    expect(WEAPONS['squeaky-toy'].kind).toBe('lure');
    expect(WEAPONS['cardboard-box'].kind).toBe('trap');
    expect(WEAPONS['hair-dryer'].kind).toBe('blow');
  });

  it('Feather Wand: a swing of sectors round him, as many as its count; Peacock Tail also holds the cats it brushes still', () => {
    const wand = lab('feather-wand');
    expect(untilFired(wand, 'feather-wand')).toBe(true);
    expect(wand.sweeps()).toHaveLength(stats('feather-wand').count);
    expect(wand.cats().some((c) => c.stunUntil > wand.state().time)).toBe(false);

    const tail = lab('peacock-tail', MAX_WEAPON_LEVEL, tough);
    expect(untilFired(tail, 'peacock-tail')).toBe(true);
    expect(tail.sweeps()).toHaveLength(6);
    const held = tail.cats().filter((c) => c.stunUntil > tail.state().time);
    expect(held.length).toBeGreaterThan(0);
    // Held still for the time it says, then free.
    const heldAt = held.map((c) => ({ id: c.id, x: c.x, y: c.y }));
    tail.step(still);
    for (const before of heldAt) {
      const now = tail.cats().find((c) => c.id === before.id);
      if (now && now.stunUntil > tail.state().time) {
        expect({ x: now.x, y: now.y }).toEqual({ x: before.x, y: before.y });
      }
    }
  });

  it('Feather Wand: the cats it strikes are knocked back, away from him', () => {
    const a = lab('feather-wand', MAX_WEAPON_LEVEL, {
      cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [1e9, 1e9] },
    });
    const before = new Map<number, number>();
    let moved = 0;
    while (a.state().time < 40_000 && moved === 0) {
      for (const c of a.cats())
        before.set(c.id, Math.hypot(c.x - a.state().hero.x, c.y - a.state().hero.y));
      a.step(still);
      if (a.sweeps().length > 0) {
        for (const c of a.cats()) {
          const was = before.get(c.id);
          const d = Math.hypot(c.x - a.state().hero.x, c.y - a.state().hero.y);
          // A cat walks in at most ~2 px a step; a knock-back is far more.
          if (was !== undefined && d - was > stats('feather-wand').speed * 0.5) moved++;
        }
      }
    }
    expect(moved).toBeGreaterThan(0);
  });

  it('Squeaky Toy: toys set down among the cats call them over; the Symphony’s last note is its own', () => {
    const toys = lab('squeaky-toy', MAX_WEAPON_LEVEL, tough);
    expect(untilFired(toys, 'squeaky-toy')).toBe(true);
    const set = toys.patches().filter((p) => p.kind === 'toy');
    expect(set).toHaveLength(stats('squeaky-toy').count);
    expect(set.every((p) => p.finale === 0)).toBe(true);
    const near = () =>
      toys.cats().filter((c) => set.some((p) => Math.hypot(c.x - p.x, c.y - p.y) <= p.radius))
        .length;
    const first = near();
    for (let i = 0; i < 150; i++) toys.step(still);
    expect(near()).toBeGreaterThan(first);

    const band = lab('squeak-symphony');
    expect(untilFired(band, 'squeak-symphony')).toBe(true);
    expect(band.patches().filter((p) => p.kind === 'toy')).toHaveLength(3);
    expect(band.patches().every((p) => p.finale > 0)).toBe(true);
  });

  it('Squeaky Toy: a cat within its squeak walks to it instead of to him', () => {
    const a = lab('squeaky-toy', MAX_WEAPON_LEVEL, { escalation: [[0, 15]] });
    expect(untilFired(a, 'squeaky-toy')).toBe(true);
    const toy = a.patches().find((p) => p.kind === 'toy')!;
    const called = a
      .cats()
      .filter(
        (c) =>
          Math.hypot(c.x - toy.x, c.y - toy.y) <= toy.reach &&
          Math.hypot(c.x - toy.x, c.y - toy.y) > 40
      );
    expect(called.length).toBeGreaterThan(0);
    const gap = (c: { id: number }) => {
      const now = a.cats().find((x) => x.id === c.id);
      return now ? Math.hypot(now.x - toy.x, now.y - toy.y) : null;
    };
    const before = new Map(called.map((c) => [c.id, gap(c)!]));
    for (let i = 0; i < 40; i++) a.step(still);
    let closer = 0;
    for (const c of called) {
      const now = gap(c);
      if (now !== null && now < before.get(c.id)! - 20) closer++;
    }
    expect(closer).toBeGreaterThan(0);
  });

  it('Cardboard Box: boxes set on the cats hold the cats in them still; the Castle also slows the cats round it', () => {
    const box = lab('cardboard-box', MAX_WEAPON_LEVEL, {
      cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [1e9, 1e9] },
    });
    expect(untilFired(box, 'cardboard-box')).toBe(true);
    const boxes = box.patches().filter((p) => p.kind === 'box');
    expect(boxes.length).toBeGreaterThan(0);
    expect(boxes.length).toBeLessThanOrEqual(stats('cardboard-box').count);
    box.step(still);
    const held = box.cats().filter((c) => c.stunUntil > box.state().time);
    expect(held.length).toBeGreaterThan(0);
    expect(held.length).toBeLessThanOrEqual(boxes.length * stats('cardboard-box').pierce);
    const spots = held.map((c) => ({ id: c.id, x: c.x, y: c.y }));
    for (let i = 0; i < 5; i++) box.step(still);
    for (const spot of spots) {
      const now = box.cats().find((c) => c.id === spot.id);
      if (now && now.stunUntil > box.state().time)
        expect({ x: now.x, y: now.y }).toEqual({ x: spot.x, y: spot.y });
    }
    expect(box.cats().some((c) => c.slowUntil > box.state().time)).toBe(false);

    const castle = lab('cardboard-castle', MAX_WEAPON_LEVEL, {
      cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [1e9, 1e9] },
    });
    expect(untilFired(castle, 'cardboard-castle')).toBe(true);
    for (let i = 0; i < 20; i++) castle.step(still);
    expect(castle.cats().some((c) => c.slowUntil > castle.state().time)).toBe(true);
  });

  it('Hair Dryer: a jet the way he faces for each of its count, always; Scorch Dryer also leaves cats scorched', () => {
    const dryer = lab('hair-dryer', MAX_WEAPON_LEVEL, {
      cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [1e9, 1e9] },
    });
    for (let i = 0; i < 400; i++) dryer.step(still);
    expect(dryer.jets()).toHaveLength(stats('hair-dryer').count);
    expect(dryer.cats().some((c) => c.vulnUntil > dryer.state().time)).toBe(false);

    const scorch = lab('scorch-dryer', MAX_WEAPON_LEVEL, {
      cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [1e9, 1e9] },
    });
    for (let i = 0; i < 400; i++) scorch.step(still);
    expect(scorch.jets()).toHaveLength(3);
    expect(scorch.cats().some((c) => c.vulnUntil > scorch.state().time)).toBe(true);
    // A scorched cat in the jet takes half again what the jet alone does.
    const damage = stats('scorch-dryer').damage;
    const dt = ARENA_CONFIG.stepMs / 1000;
    const inJet = () => {
      const h = scorch.state().hero;
      return scorch.cats().filter((c) => {
        const turn = Math.atan2(c.y - h.y, c.x - h.x);
        return scorch
          .jets()
          .some(
            (j) =>
              Math.hypot(c.x - h.x, c.y - h.y) < j.reach * 0.8 &&
              Math.abs(Math.atan2(Math.sin(turn - j.angle), Math.cos(turn - j.angle))) <
                j.half * 0.8
          );
      });
    };
    let target = inJet().find((c) => c.vulnUntil > scorch.state().time + 100);
    for (let i = 0; i < 3000 && !target; i++) {
      scorch.step(still);
      target = inJet().find((c) => c.vulnUntil > scorch.state().time + 100);
    }
    expect(target).toBeDefined();
    const before = target!.homesickness;
    scorch.step(still);
    const after = scorch.cats().find((c) => c.id === target!.id)!;
    expect(after.homesickness - before).toBeCloseTo(damage * dt * 1.5, 4);
  });

  it('Peacock Tail does not stun a boss, and a box does not hold one', () => {
    const bosses = {
      ...tough,
      schedule: {
        arrivals: [{ from: 0, who: 'xenocat' as const, weight: 1 }],
        swarms: { from: Infinity, everyMs: 1, size: [0, 0] as [number, number] },
        bosses: [0],
      },
    };
    for (const id of ['peacock-tail', 'cardboard-castle'] as const) {
      const a = lab(id, MAX_WEAPON_LEVEL, bosses);
      expect(untilFired(a, id)).toBe(true);
      for (let i = 0; i < 30; i++) a.step(still);
      const mega = a.cats().filter((c) => c.variety === 'mega');
      expect(mega.length, id).toBeGreaterThan(0);
      expect(
        mega.every((c) => c.stunUntil <= a.state().time),
        id
      ).toBe(true);
    }
  });

  it('a cat held still loses its wind-up, if it was an elite', () => {
    const a = lab('peacock-tail', MAX_WEAPON_LEVEL, {
      cats: { ...ARENA_CONFIG.cats, eliteShare: 1, homesickness: [1e9, 1e9] },
    });
    let seen = false;
    for (let i = 0; i < 3000 && !seen; i++) {
      a.step(still);
      const held = a.cats().find((c) => c.stunUntil > a.state().time && c.elite);
      if (held) {
        seen = true;
        expect(held.windUntil).toBe(0);
      }
    }
    expect(seen).toBe(true);
  });

  it('Hair Dryer: cats in the jet are blown back, away from him', () => {
    const a = lab('hair-dryer', MAX_WEAPON_LEVEL, {
      cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [1e9, 1e9] },
      escalation: [[0, 25]],
    });
    // They gather round him; with the jet on them, none stays on top of him.
    for (let i = 0; i < 1200; i++) a.step(still);
    const h = a.state().hero;
    const inJet = a.cats().filter((c) => {
      const turn = Math.atan2(c.y - h.y, c.x - h.x);
      return a
        .jets()
        .some(
          (j) => Math.abs(Math.atan2(Math.sin(turn - j.angle), Math.cos(turn - j.angle))) <= j.half
        );
    });
    expect(inJet.length).toBeGreaterThan(0);
    const nearest = Math.min(...inJet.map((c) => Math.hypot(c.x - h.x, c.y - h.y)));
    // The jet holds cats back from him; without it they would be on him (reach 30 px).
    expect(nearest).toBeGreaterThan(config(a).hero.reach);
  });

  it('Bath Tub bursts into bubbles; the Jacuzzi leaves a puddle that slows the cats in it', () => {
    const tub = lab('bath-tub');
    expect(untilFired(tub, 'bath-tub')).toBe(true);
    let bits = 0;
    while (tub.state().time < 60_000 && bits === 0) {
      tub.step(still);
      bits = tub.projectiles().filter((p) => p.bit).length;
    }
    expect(bits).toBeGreaterThan(0);
    expect(tub.patches().some((p) => p.kind === 'puddle')).toBe(false);

    const jac = lab('jacuzzi', MAX_WEAPON_LEVEL, tough);
    let puddle = false;
    while (jac.state().time < 60_000 && !puddle) {
      jac.step(still);
      puddle = jac.patches().some((p) => p.kind === 'puddle');
    }
    expect(puddle).toBe(true);
    for (let i = 0; i < 60; i++) jac.step(still);
    expect(jac.cats().some((c) => c.slowUntil > jac.state().time)).toBe(true);
  });

  it('each passive adds its step, level by level, and the weapons feel it', () => {
    const at = (id: PassiveId, level: number) => modifiers(new Map([[id, level]]));
    expect(at('egg-timer', 3).duration).toBeCloseTo(1.36, 6);
    expect(weaponStats('squeaky-toy', 1, at('egg-timer', 3)).durationMs).toBeCloseTo(
      3200 * 1.36,
      3
    );
    // What lasts only for a flash is not stretched; nothing from nothing.
    expect(weaponStats('thunderous-vacuum', 1, at('egg-timer', 5)).durationMs).toBe(0);
    expect(at('slippers', 2).pierce).toBe(2);
    expect(weaponStats('cat-treats', 1, at('slippers', 2)).pierce).toBe(
      WEAPONS['cat-treats'].levels[0].pierce + 2
    );
    expect(weaponStats('cardboard-box', 1, at('slippers', 2)).pierce).toBe(6);
    // Unlimited stays unlimited.
    expect(weaponStats('laser-pointer', 1, at('slippers', 5)).pierce).toBe(99);
    expect(at('cushion', 4).grace).toBe(480);
    expect(at('fish-bowl', 5).xp).toBeCloseTo(1.6, 6);
    expect(at('tin-foil', 4).guard).toBeCloseTo(0.6, 6);
    for (const id of ['egg-timer', 'slippers', 'cushion', 'fish-bowl', 'tin-foil'] as const) {
      expect(PASSIVES[id].maxLevel).toBe(MAX_PASSIVE_LEVEL);
      expect(passiveChanges(id, 1).length).toBeGreaterThan(0);
    }
  });

  it('Fish Bowl makes gems worth more, and Cushion keeps him untouchable longer', () => {
    const levelUpTime = (passives: PassiveId[]) => {
      const a = arena(
        {
          ...xenocatsOnly,
          hero: { ...ARENA_CONFIG.hero, resolve: 1e12 },
          // Three gems for the first level, or two with a Fish Bowl.
          gems: { ...ARENA_CONFIG.gems, value: 2.4, eliteValue: 2.4 },
          startingPassives: passives,
          startingWeapons: ['laser-pointer'],
        },
        5
      );
      while (!a.choices() && a.state().time < 120_000) a.step(still);
      return a.state().time;
    };
    expect(levelUpTime(['fish-bowl'])).toBeLessThan(levelUpTime([]));

    // Cats keep coming, so he is hit again the step his grace ends: the shortest gap
    // between two hits is how long he was untouchable.
    const grace = (passives: PassiveId[]) => {
      const a = arena(
        { ...xenocatsOnly, startingPassives: passives, startingWeapons: [], escalation: [[0, 30]] },
        3
      );
      const hits: number[] = [];
      while (a.state().time < 30_000 && hits.length < 8) {
        a.step(still);
        if (a.drainEvents().some((e) => e.kind === 'hero-hit')) hits.push(a.state().time);
      }
      return Math.min(...hits.slice(1).map((t, i) => t - hits[i]));
    };
    expect(grace(['cushion']) - grace([])).toBeGreaterThanOrEqual(100);
  });
});

describe('every evolved weapon has an effect of its own, and outdeals its base', () => {
  /** One weapon at its top level, cats nothing sends home all round; the arena. */
  function lab(id: WeaponId, ms = 20_000) {
    const a = arena({
      ...steady,
      startingWeapons: [id],
      startingLevel: MAX_WEAPON_LEVEL,
      escalation: [[0, 60]],
      cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [1e9, 1e9] },
    });
    while (a.state().time < ms) a.step(still);
    return a;
  }
  /** Homesickness dealt in all, a second, to a crowd nothing sends home. */
  const dealt = (id: WeaponId) => {
    const a = lab(id);
    return a.cats().reduce((sum, cat) => sum + cat.homesickness, 0) / (a.state().time / 1000);
  };

  for (const { from, to } of EVOLUTIONS) {
    it(`${WEAPONS[to].name} deals more homesickness a second than the ${WEAPONS[from].name} at its best`, () => {
      expect(dealt(to), `${to} against ${from}`).toBeGreaterThan(dealt(from));
    });
  }

  it('the Yarn Apocalypse tangles the cats it passes through; the Yarn Ball does not', () => {
    const slowed = (id: WeaponId) => {
      const a = lab(id, 12_000);
      return a.cats().filter((c) => c.slowUntil > a.state().time).length;
    };
    expect(slowed('yarn-apocalypse')).toBeGreaterThan(0);
    expect(slowed('yarn-ball')).toBe(0);
  });

  it('Banquet treats that fed a cat leave crumbs that go after another; Cat Treats leave none', () => {
    const crumbs = (id: WeaponId) => {
      const a = createArena({
        random: createRandom(1),
        types: CAT_TYPES,
        viewport,
        config: {
          ...steady,
          startingWeapons: [id],
          startingLevel: MAX_WEAPON_LEVEL,
          escalation: [[0, 60]],
          cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [1e9, 1e9] },
        },
      });
      let most = 0;
      let steered = false;
      let inherits = false;
      while (a.state().time < 15_000) {
        a.step(still);
        const bits = a.projectiles().filter((p) => p.bit && p.weapon === id);
        most = Math.max(most, bits.length);
        // A crumb is born knowing the cats its treat fed, so it goes after another.
        if (bits.some((p) => p.vx === 0 && p.vy === 0 && p.touched.length > 0)) inherits = true;
        // A crumb that has found a cat flies at its own pace, not at a standstill.
        if (bits.some((p) => Math.hypot(p.vx, p.vy) > 300)) steered = true;
      }
      return { most, steered, inherits };
    };
    const banquet = crumbs('banquet');
    expect(banquet.most).toBeGreaterThan(0);
    expect(banquet.steered).toBe(true);
    expect(banquet.inherits).toBe(true);
    expect(crumbs('cat-treats').most).toBe(0);
  });

  it('Monsoon leaves puddles that slow the cats in them; the Spray Bottle leaves none', () => {
    const rain = lab('monsoon', 12_000);
    const puddles = rain.patches().filter((p) => p.kind === 'puddle' && p.weapon === 'monsoon');
    expect(puddles.length).toBeGreaterThan(0);
    expect(rain.cats().some((c) => c.slowUntil > rain.state().time)).toBe(true);
    expect(lab('spray-bottle', 12_000).patches()).toEqual([]);
  });

  it('the Bottomless Saucer spills a wave of milk from each saucer, outward; the Can Opener does not', () => {
    const waves = (id: WeaponId) => {
      const a = createArena({
        random: createRandom(1),
        types: CAT_TYPES,
        viewport,
        config: {
          ...steady,
          startingWeapons: [id],
          startingLevel: MAX_WEAPON_LEVEL,
          escalation: [[0, 0]],
        },
      });
      let most = 0;
      let outward = true;
      while (a.state().time < 4_000) {
        a.step(still);
        const milk = a.projectiles().filter((p) => p.weapon === id);
        most = Math.max(most, milk.length);
        for (const p of milk) {
          const h = a.state().hero;
          if ((p.x - h.x) * p.vx + (p.y - h.y) * p.vy < 0) outward = false;
        }
      }
      return { most, outward };
    };
    // ...and a wave sends cats home: with cats round him, some wave has touched one.
    const crowd = createArena({
      random: createRandom(1),
      types: CAT_TYPES,
      viewport,
      config: {
        ...steady,
        startingWeapons: ['bottomless-saucer'],
        startingLevel: MAX_WEAPON_LEVEL,
        escalation: [[0, 60]],
        cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [1e9, 1e9] },
      },
    });
    let touched = false;
    while (crowd.state().time < 12_000) {
      crowd.step(still);
      if (
        crowd.projectiles().some((p) => p.weapon === 'bottomless-saucer' && p.touched.length > 0)
      ) {
        touched = true;
      }
    }
    expect(touched).toBe(true);
    const saucer = waves('bottomless-saucer');
    expect(saucer.most).toBe(stats8('bottomless-saucer').count);
    expect(saucer.outward).toBe(true);
    expect(waves('can-opener').most).toBe(0);
  });
});

describe('fusion: two evolved weapons made one at a chest', () => {
  const evolved = new Set(EVOLUTIONS.map((e) => e.to));
  const level8 = (...ids: WeaponId[]) => new Map(ids.map((id) => [id, MAX_WEAPON_LEVEL] as const));

  /** A run that starts holding `weapons` at their top level with `chests` at his feet. */
  function start(weapons: WeaponId[], chests: number, config: Partial<ArenaConfig> = {}) {
    return arena({
      ...steady,
      chestReach: ARENA_CONFIG.chestReach,
      startingWeapons: weapons,
      startingLevel: MAX_WEAPON_LEVEL,
      startingChests: chests,
      escalation: [[0, 60]],
      cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [1e9, 1e9] },
      ...config,
    });
  }
  const held = (a: ReturnType<typeof start>) => a.state().weapons.map((w) => w.id);

  it('there are at least four fusions, of evolved weapons, covering at least eight of the eleven', () => {
    expect(FUSIONS.length).toBeGreaterThanOrEqual(4);
    const used = new Set<WeaponId>();
    for (const fusion of FUSIONS) {
      for (const id of fusion.from) {
        expect(evolved.has(id), id).toBe(true);
        used.add(id);
      }
      expect(evolved.has(fusion.to)).toBe(false);
      expect(fusion.from[0]).not.toBe(fusion.from[1]);
    }
    expect(used.size).toBeGreaterThanOrEqual(8);
    // One fused weapon for each pair.
    expect(new Set(FUSIONS.map((f) => f.to)).size).toBe(FUSIONS.length);
    expect(new Set(FUSIONS.map((f) => [...f.from].sort().join('+'))).size).toBe(FUSIONS.length);
  });

  it('is made only when both are held, and never offered at a level-up', () => {
    expect(fusionFor(level8('infinite-laser'))).toBeNull();
    expect(fusionFor(level8('infinite-laser', 'banquet'))).toBeNull();
    expect(fusionFor(level8('infinite-laser', 'monsoon'))?.to).toBe('thunderstorm');
    expect(fusionFor(level8('infinite-laser', 'monsoon', 'thunderstorm'))).toBeNull();
    for (const { to } of FUSIONS) {
      expect(BASE_WEAPONS).not.toContain(to);
      for (let seed = 1; seed < 40; seed++) {
        const picks = offerChoices(new Map(), new Map(), 3, createRandom(seed));
        expect(picks.some((c) => c.kind === 'weapon' && c.id === to)).toBe(false);
      }
    }
    // The base weapon whose evolution a fused weapon took up is not offered again.
    const offered = (held: Map<WeaponId, number>) => {
      const ids = new Set<WeaponId>();
      for (let seed = 1; seed < 80; seed++) {
        for (const c of offerChoices(held, new Map(), 20, createRandom(seed))) {
          if (c.kind === 'weapon') ids.add(c.id);
        }
      }
      return ids;
    };
    expect(offered(new Map()).has('laser-pointer')).toBe(true);
    expect(offered(level8('thunderstorm')).has('laser-pointer')).toBe(false);
    expect(offered(level8('thunderstorm')).has('spray-bottle')).toBe(false);
    expect(offered(level8('thunderstorm')).has('cat-treats')).toBe(true);
  });

  for (const fusion of FUSIONS) {
    describe(`${WEAPONS[fusion.from[0]].name} + ${WEAPONS[fusion.from[1]].name} → ${WEAPONS[fusion.to].name}`, () => {
      it('a chest fuses the two into one, and frees a slot', () => {
        const a = start([...fusion.from], 1);
        expect(held(a)).toEqual([...fusion.from]);
        a.step(still);
        const events = a.drainEvents();
        expect(events).toContainEqual({ kind: 'fusion', from: fusion.from, to: fusion.to });
        expect(held(a)).toEqual([fusion.to]);
        expect(a.state().weapons[0].level).toBe(MAX_WEAPON_LEVEL);
        // The chest went to the fusion: no level-up waits.
        expect(a.choices()).toBeNull();
        // Two slots were used, now one.
        const view = loadout(a.state().weapons, a.state().passives);
        expect(view.freeWeaponSlots).toBe(WEAPON_SLOTS - 1);
        expect(view.weapons[0].evolved).toBe(true);
      });

      it('with only one of them, the chest is a level-up instead', () => {
        const a = start([fusion.from[0]], 1);
        a.step(still);
        expect(a.drainEvents().some((e) => e.kind === 'fusion')).toBe(false);
        expect(held(a)).toEqual([fusion.from[0]]);
        expect(a.choices()).not.toBeNull();
      });

      it('both parents go on doing what they did, and the fused weapon deals more than either alone', () => {
        const dealt = (weapons: WeaponId[], chests: number) => {
          const a = start(weapons, chests);
          while (a.state().time < 20_000) a.step(still);
          return a.cats().reduce((sum, cat) => sum + cat.homesickness, 0) / (a.state().time / 1000);
        };
        const fused = dealt([...fusion.from], 1);
        // The extra itself adds: more than the same two weapons held apart.
        expect(fused, `${fusion.to} against the pair unfused`).toBeGreaterThan(
          dealt([...fusion.from], 0)
        );
        expect(fused, `${fusion.to} against ${fusion.from[0]}`).toBeGreaterThan(
          dealt([fusion.from[0]], 0)
        );
        expect(fused, `${fusion.to} against ${fusion.from[1]}`).toBeGreaterThan(
          dealt([fusion.from[1]], 0)
        );
      });
    });
  }

  it('a fusion comes before an evolution at the same chests: the first chest fuses, the next evolves', () => {
    const a = start(['infinite-laser', 'monsoon', 'cat-treats'], 2, {
      startingPassives: ['long-whiskers'],
    });
    a.step(still);
    const kinds = a.drainEvents().filter((e) => e.kind === 'fusion' || e.kind === 'evolution');
    expect(kinds.map((e) => e.kind)).toEqual(['fusion', 'evolution']);
    expect(held(a).sort()).toEqual(['banquet', 'thunderstorm']);
  });

  it('the Thunderstorm draws lightning from him to the cats', () => {
    const a = start(['infinite-laser', 'monsoon'], 1);
    let struck = 0;
    while (a.state().time < 12_000) {
      a.step(still);
      struck += a.beams().length;
    }
    expect(struck).toBeGreaterThan(0);
  });

  it('the Scorching Maw scorches the cats it draws in; the Milk Symphony spills milk from the toys; the Yarn Feast sends a ring of crumbs', () => {
    const maw = start(['forbidden-catnip-vacuum', 'scorch-dryer'], 1);
    while (maw.state().time < 9_000) maw.step(still);
    expect(maw.cats().some((c) => c.vulnUntil > maw.state().time)).toBe(true);

    const feast = start(['yarn-apocalypse', 'banquet'], 1);
    let crumbs = 0;
    while (feast.state().time < 9_000) {
      feast.step(still);
      crumbs = Math.max(
        crumbs,
        feast.projectiles().filter((p) => p.bit && p.weapon === 'banquet').length
      );
    }
    expect(crumbs).toBeGreaterThanOrEqual(WEAPONS['yarn-feast'].levels[0].count);

    const milk = start(['bottomless-saucer', 'squeak-symphony'], 1);
    let waves = 0;
    while (milk.state().time < 12_000) {
      milk.step(still);
      const out = milk
        .projectiles()
        .filter((p) => p.bit && p.weapon === 'bottomless-saucer').length;
      waves = Math.max(waves, out);
    }
    // More than the saucers' own waves alone (one per saucer).
    expect(waves).toBeGreaterThan(weaponStats('bottomless-saucer', MAX_WEAPON_LEVEL, none).count);
  });

  it('the pause menu names the fused weapon, and says what a fusion still needs', () => {
    const view = loadout([{ id: 'infinite-laser', level: MAX_WEAPON_LEVEL }], []);
    expect(view.fusions).toEqual([
      {
        from: ['infinite-laser', 'monsoon'],
        to: 'thunderstorm',
        missing: ['the Monsoon'],
        ready: false,
      },
    ]);
    const both = loadout(
      [
        { id: 'infinite-laser', level: MAX_WEAPON_LEVEL },
        { id: 'monsoon', level: MAX_WEAPON_LEVEL },
      ],
      []
    );
    expect(both.fusions[0]).toMatchObject({ to: 'thunderstorm', missing: [], ready: true });
    expect(loadout([{ id: 'laser-pointer', level: 3 }], []).fusions).toEqual([]);
    const done = loadout([{ id: 'thunderstorm', level: MAX_WEAPON_LEVEL }], []);
    expect(done.fusions).toEqual([]);
    expect(done.weapons[0]).toMatchObject({ name: 'Thunderstorm', evolved: true });
    expect(fusionText(['infinite-laser', 'monsoon'], 'thunderstorm')).toContain('Thunderstorm');
  });
});

describe('the colour of how far an item has come', () => {
  const tiers: Tier[] = [1, 2, 3, 4, 5, 6, 7];

  it('a weapon climbs with its level: 1–2, 3–4, 5–6, 7, 8; evolved and fused have colours of their own', () => {
    const byLevel = [1, 2, 3, 4, 5, 6, 7, 8].map((level) =>
      tierOf({ kind: 'weapon', id: 'laser-pointer', level })
    );
    expect(byLevel).toEqual([1, 1, 2, 2, 3, 3, 4, 5]);
    for (const { to } of EVOLUTIONS)
      expect(tierOf({ kind: 'weapon', id: to, level: 8 }), to).toBe(6);
    for (const { to } of FUSIONS) expect(tierOf({ kind: 'weapon', id: to, level: 8 }), to).toBe(7);
    // Whatever level an evolved weapon is held at, it stays beyond the highest level's.
    expect(tierOf({ kind: 'weapon', id: 'infinite-laser', level: 1 })).toBe(6);
  });

  it('a passive climbs a tier a level, 1 to 5, the same scale', () => {
    for (const id of ['rubber-chicken', 'egg-timer', 'tin-foil'] as const) {
      expect([1, 2, 3, 4, 5].map((level) => tierOf({ kind: 'passive', id, level }))).toEqual([
        1, 2, 3, 4, 5,
      ]);
    }
    expect(tierOf({ kind: 'passive', id: 'lucky-bell', level: 1 })).toBe(1);
  });

  it('every tier has its own name and its own colour class, and they are the theme’s tokens', () => {
    expect(new Set(tiers.map((t) => TIER_NAMES[t])).size).toBe(7);
    expect(new Set(tiers.map((t) => TIER_CLASS[t])).size).toBe(7);
    const colours = (tailwind.theme?.extend?.colors as Record<string, Record<string, string>>).tier;
    for (const t of tiers) expect(TIER_CLASS[t]).toBe(`text-tier-${t}`);
    expect(Object.keys(colours).map(Number).sort()).toEqual(tiers);
    expect(new Set(Object.values(colours)).size).toBe(7);
    expect(tierStyle({ kind: 'weapon', id: 'cat-treats', level: 8 })).toEqual({
      tier: 5,
      name: TIER_NAMES[5],
      className: 'text-tier-5',
    });
  });

  it('each colour keeps WCAG AA contrast (4.5 : 1) against the panels it is drawn on', () => {
    const colors = tailwind.theme?.extend?.colors as Record<string, Record<string, string>>;
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const backgrounds = [colors.void.DEFAULT, colors.panel.DEFAULT, colors.panel.raised];
    for (const t of tiers) {
      for (const bg of backgrounds) {
        expect(ratio(colors.tier[t], bg), `tier ${t} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
