import { afterEach, describe, expect, it, vi } from 'vitest';
import { ARENA_CONFIG, type ArenaConfig, createArena } from '@/app/ui/xenocats/arena';
import { EVOLUTIONS, MAX_WEAPON_LEVEL, WEAPONS, type WeaponId } from '@/app/ui/xenocats/arsenal';
import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
import {
  CHARACTERS,
  MILESTONES,
  PROGRESS_KEY,
  type Progress,
  type RunResult,
  SECRET_CAT,
  UPGRADES,
  applyRun,
  availableWeapons,
  buyCharacter,
  buyUpgrade,
  chooseCharacter,
  codexEntries,
  freshProgress,
  hasCharacter,
  parseProgress,
  readProgress,
  runConfig,
  serializeProgress,
  tuftsFor,
  unlockedBy,
  upgradeCost,
  writeProgress,
} from '@/app/ui/xenocats/progression';
import { createRandom } from '@/app/ui/xenocats/random';

const run = (over: Partial<RunResult> = {}): RunResult => ({
  timeMs: 0,
  sentHome: 0,
  level: 1,
  found: [],
  ...over,
});
const rich = (tufts: number): Progress => ({ ...freshProgress(), tufts });

describe('tufts', () => {
  it('one for every 5 s survived, one for every 20 cats sent home', () => {
    expect(tuftsFor({ timeMs: 0, sentHome: 0 })).toBe(0);
    expect(tuftsFor({ timeMs: 4999, sentHome: 19 })).toBe(0);
    expect(tuftsFor({ timeMs: 60_000, sentHome: 400 })).toBe(12 + 20);
  });

  it('a five-minute run earns what it always did; each second past 5:00 earns twice as much', () => {
    // The old rule, for the first five minutes: one tuft a 5 s.
    expect(tuftsFor({ timeMs: 300_000, sentHome: 0 })).toBe(60);
    expect(tuftsFor({ timeMs: 299_999, sentHome: 0 })).toBe(59);
    // Then one every 2.5 s: ten minutes is 60 + 120, fifteen 60 + 240.
    expect(tuftsFor({ timeMs: 302_499, sentHome: 0 })).toBe(60);
    expect(tuftsFor({ timeMs: 302_500, sentHome: 0 })).toBe(61);
    expect(tuftsFor({ timeMs: 600_000, sentHome: 0 })).toBe(180);
    expect(tuftsFor({ timeMs: 900_000, sentHome: 0 })).toBe(300);
    // Cats sent home count the same in every run.
    expect(tuftsFor({ timeMs: 600_000, sentHome: 400 })).toBe(180 + 20);
    // A longer run is worth more than its length alone.
    expect(tuftsFor({ timeMs: 600_000, sentHome: 0 })).toBeGreaterThan(
      2 * tuftsFor({ timeMs: 300_000, sentHome: 0 })
    );
  });

  it('a run adds its tufts to what he had', () => {
    const after = applyRun(rich(7), run({ timeMs: 30_000, sentHome: 40 }));
    expect(after.earned).toBe(8);
    expect(after.progress.tufts).toBe(15);
  });
});

describe('milestones', () => {
  it('are reached by a run that does what they ask, once', () => {
    const first = applyRun(freshProgress(), run({ timeMs: 200_000, sentHome: 1200, level: 21 }));
    expect(first.reached.sort()).toEqual(['level-20', 'send-1000', 'survive-2', 'survive-3']);
    const again = applyRun(first.progress, run({ timeMs: 200_000, sentHome: 1200, level: 21 }));
    expect(again.reached).toEqual([]);
    expect(again.progress.milestones).toHaveLength(4);
  });

  it('Survive 10:00 and Survive 15:00 need a run that long, and unlock a household weapon each', () => {
    const ten = applyRun(freshProgress(), run({ timeMs: 600_000 }));
    expect(ten.reached).toContain('survive-10');
    expect(ten.reached).not.toContain('survive-15');
    const fifteen = applyRun(freshProgress(), run({ timeMs: 900_000 }));
    expect(fifteen.reached).toEqual(expect.arrayContaining(['survive-10', 'survive-15']));
    // A moment short of either.
    expect(applyRun(freshProgress(), run({ timeMs: 599_999 })).reached).not.toContain('survive-10');
    expect(applyRun(freshProgress(), run({ timeMs: 899_999 })).reached).not.toContain('survive-15');
    // A five-minute run's time stops at its goal: it can never reach either.
    expect(applyRun(freshProgress(), run({ timeMs: 300_000 })).reached).not.toContain('survive-10');
    // What each unlocks is told where milestones are told.
    expect(MILESTONES['survive-10'].text).toBe('Survive 10:00');
    expect(unlockedBy('survive-10')).toContain('Hair Dryer');
    expect(unlockedBy('survive-15')).toContain('Cardboard Box');
    // Reached once, kept.
    const again = applyRun(ten.progress, run({ timeMs: 600_000 }));
    expect(again.reached).toEqual([]);
  });

  it('are not reached a moment short', () => {
    const short = applyRun(freshProgress(), run({ timeMs: 119_999, sentHome: 999, level: 19 }));
    expect(short.reached).toEqual([]);
  });

  it('keep weapons back until reached, and a level-up never offers those', () => {
    const fresh = availableWeapons(freshProgress());
    expect(fresh).not.toContain('thunderous-vacuum');
    expect(fresh).not.toContain('laser-pointer-deluxe');
    expect(fresh).not.toContain('hairball');
    // The longer runs' milestones keep a household weapon each back.
    expect(fresh).not.toContain('hair-dryer');
    expect(fresh).not.toContain('cardboard-box');
    expect(fresh).toContain('laser-pointer');
    expect(fresh).toContain('feather-wand');
    const later = availableWeapons({ ...freshProgress(), milestones: ['survive-3', 'level-20'] });
    expect(later).toContain('thunderous-vacuum');
    expect(later).toContain('hairball');
    expect(later).not.toContain('laser-pointer-deluxe');
    expect(later).not.toContain('hair-dryer');
    const long = availableWeapons({ ...freshProgress(), milestones: ['survive-10'] });
    expect(long).toContain('hair-dryer');
    expect(long).not.toContain('cardboard-box');
    expect(availableWeapons({ ...freshProgress(), milestones: ['survive-15'] })).toContain(
      'cardboard-box'
    );

    // In a run: never offered, whatever comes.
    const a = createArena({
      random: createRandom(3),
      types: CAT_TYPES,
      viewport: { width: 1280, height: 800 },
      config: {
        ...runConfig(freshProgress(), ARENA_CONFIG),
        hero: { ...ARENA_CONFIG.hero, resolve: 1e12 },
        stepMs: 50,
      },
    });
    const locked: WeaponId[] = [
      'thunderous-vacuum',
      'laser-pointer-deluxe',
      'hairball',
      'hair-dryer',
      'cardboard-box',
    ];
    let offers = 0;
    // Three minutes: the larger pool of weapons changes the seeded run, which now has 3 level-ups
    // in two minutes, where the check wants more than 3.
    while (a.state().time < 180_000) {
      const offer = a.choices();
      if (offer) {
        offers++;
        for (const c of offer) expect(c.kind === 'weapon' && locked.includes(c.id)).toBe(false);
        a.choose(0);
      } else a.step({ x: 1, y: 0 });
    }
    expect(offers).toBeGreaterThan(3);
  }, 30_000);
});

describe('the Tailor', () => {
  it('each level costs more than the last, and none past the highest', () => {
    for (const id of Object.keys(UPGRADES) as (keyof typeof UPGRADES)[]) {
      const max = UPGRADES[id].maxLevel;
      for (let level = 1; level < max; level++) {
        expect(upgradeCost(id, level)!).toBeGreaterThan(upgradeCost(id, level - 1)!);
      }
      expect(upgradeCost(id, max)).toBeNull();
    }
  });

  it('sells the next level for its cost, and nothing he cannot pay for', () => {
    const bought = buyUpgrade(rich(40), 'stubbornness')!;
    expect(bought.upgrades.stubbornness).toBe(1);
    expect(bought.tufts).toBe(30);
    const second = buyUpgrade(bought, 'stubbornness')!;
    expect(second.upgrades.stubbornness).toBe(2);
    expect(second.tufts).toBe(30 - upgradeCost('stubbornness', 1)!);
    expect(buyUpgrade(rich(24), 'stubbornness')!.tufts).toBe(14);
    expect(buyUpgrade(rich(9), 'stubbornness')).toBeNull();
    const full = { ...rich(1e6), upgrades: { 'second-wind': 1 } };
    expect(buyUpgrade(full, 'second-wind')).toBeNull();
  });

  it('what he bought goes out with him', () => {
    const progress: Progress = {
      ...freshProgress(),
      upgrades: {
        stubbornness: 2,
        sternness: 3,
        'brisk-step': 5,
        'long-arms': 1,
        'second-wind': 1,
      },
    };
    const config = runConfig(progress, ARENA_CONFIG);
    expect(config.hero!.resolve).toBe(ARENA_CONFIG.hero.resolve + 20);
    expect(config.hero!.speed).toBeCloseTo(ARENA_CONFIG.hero.speed * 1.2);
    expect(config.boost).toEqual({ might: 1.15, pickup: 1.1, revivals: 1 });
  });
});

describe('characters', () => {
  it('the Keeper from the start; the Night Porter after surviving 2:00; the Housekeeper for tufts', () => {
    const fresh = freshProgress();
    expect(hasCharacter(fresh, 'keeper')).toBe(true);
    expect(hasCharacter(fresh, 'night-porter')).toBe(false);
    expect(hasCharacter(fresh, 'housekeeper')).toBe(false);
    const survived = applyRun(fresh, run({ timeMs: 125_000 })).progress;
    expect(hasCharacter(survived, 'night-porter')).toBe(true);
    expect(buyCharacter(rich(149), 'housekeeper')).toBeNull();
    const hired = buyCharacter(rich(200), 'housekeeper')!;
    expect(hasCharacter(hired, 'housekeeper')).toBe(true);
    expect(hired.tufts).toBe(50);
    expect(buyCharacter(hired, 'housekeeper')).toBeNull();
    expect(buyCharacter(rich(1000), 'night-porter')).toBeNull();
  });

  it('in co-op, player 2 goes out as a character player 1 has, with the Tailor’s work', () => {
    const progress: Progress = {
      ...freshProgress(),
      milestones: ['survive-2'],
      upgrades: { stubbornness: 1, 'brisk-step': 2 },
    };
    expect(runConfig(progress, ARENA_CONFIG).secondPlayer).toBeNull();
    expect(runConfig(progress, ARENA_CONFIG, 'night-porter').secondPlayer).toEqual({
      startingWeapons: ['spray-bottle'],
      resolve: ARENA_CONFIG.hero.resolve - 15 + 10,
      speed: ARENA_CONFIG.hero.speed * 1.12 * 1.08,
    });
    // One player 1 does not have: the Keeper instead.
    expect(runConfig(progress, ARENA_CONFIG, 'housekeeper').secondPlayer!.startingWeapons).toEqual([
      'laser-pointer',
    ]);
  });

  it('only one he has can be chosen, and he starts with that one’s weapon and bias', () => {
    expect(chooseCharacter(freshProgress(), 'night-porter').character).toBe('keeper');
    const porter = chooseCharacter(
      { ...freshProgress(), milestones: ['survive-2'] },
      'night-porter'
    );
    expect(porter.character).toBe('night-porter');
    const config = runConfig(porter, ARENA_CONFIG);
    expect(config.startingWeapons).toEqual([CHARACTERS['night-porter'].weapon]);
    expect(config.hero!.speed).toBeCloseTo(ARENA_CONFIG.hero.speed * 1.12);
    expect(config.hero!.resolve).toBe(ARENA_CONFIG.hero.resolve - 15);
    // Each character, a different starting weapon.
    const weapons = Object.values(CHARACTERS).map((c) => c.weapon);
    expect(new Set(weapons).size).toBe(weapons.length);
  });
});

describe('the codex and the secrets', () => {
  it('shows ??? until an entry is found, then its name', () => {
    const fresh = codexEntries(freshProgress());
    expect(fresh.every((e) => e.name === '???' && !e.found)).toBe(true);
    const found = applyRun(freshProgress(), run({ found: ['bottomless-saucer', 'nonsense'] }));
    const entries = codexEntries(found.progress);
    expect(entries.find((e) => e.id === 'bottomless-saucer')).toEqual({
      id: 'bottomless-saucer',
      name: 'Bottomless Saucer',
      found: true,
    });
    expect(found.progress.found).toEqual(['bottomless-saucer']);
  });

  it('the hidden evolution is a secret: Can Opener + Warm Milk, with a chest', () => {
    const secret = EVOLUTIONS.filter((e) => e.secret);
    expect(secret).toEqual([
      { from: 'can-opener', with: 'warm-milk', to: 'bottomless-saucer', secret: true },
    ]);
    // Like the others, by a chest: every cat an elite, he walks to the first chest.
    const a = createArena({
      random: createRandom(2),
      types: CAT_TYPES,
      viewport: { width: 1280, height: 800 },
      config: {
        startingWeapons: ['can-opener'],
        startingLevel: MAX_WEAPON_LEVEL,
        startingPassives: ['warm-milk'],
        hero: { ...ARENA_CONFIG.hero, resolve: 1e12 },
        gems: { ...ARENA_CONFIG.gems, value: 0, eliteValue: 0 },
        cats: { ...ARENA_CONFIG.cats, eliteShare: 1 },
        schedule: {
          arrivals: [{ from: 0, who: 'xenocat', weight: 1 }],
          swarms: { from: Infinity, everyMs: 1, size: [0, 0] },
          bosses: [],
        },
      },
    });
    let evolved = false;
    while (!evolved && a.state().time < 120_000) {
      const { x, y } = a.state().hero;
      const chest = a.chests()[0];
      const d = chest ? Math.hypot(chest.x - x, chest.y - y) || 1 : 1;
      a.step(chest ? { x: (chest.x - x) / d, y: (chest.y - y) / d } : { x: 0, y: 0 });
      evolved = a.drainEvents().some((e) => e.kind === 'evolution' && e.to === 'bottomless-saucer');
    }
    expect(evolved).toBe(true);
    expect(a.state().weapons.map((w) => w.id)).toEqual(['bottomless-saucer']);
    // Its blades, more of them than the Can Opener ever had.
    expect(a.blades().length).toBe(WEAPONS['bottomless-saucer'].levels[0].count);
  });

  /** A run where nothing wears him down and nothing interrupts. */
  function quiet(config: Partial<ArenaConfig> = {}) {
    return createArena({
      random: createRandom(5),
      types: CAT_TYPES,
      viewport: { width: 1280, height: 800 },
      config: {
        hero: { ...ARENA_CONFIG.hero, resolve: 1e12 },
        gems: { ...ARENA_CONFIG.gems, value: 0, eliteValue: 0 },
        chestReach: -1,
        stepMs: 50,
        ...config,
      },
    });
  }

  it('the secret cat comes to a Keeper who stands still 20 s, after the first minute, once', () => {
    const a = quiet();
    let came: number[] = [];
    let present = 0;
    while (a.state().time < 120_000) {
      a.step({ x: 0, y: 0 });
      if (a.drainEvents().some((e) => e.kind === 'secret')) {
        came.push(a.state().time);
        present = a.cats().filter((c) => c.variety === SECRET_CAT).length;
      }
    }
    // (A step is a sixtieth of a second: the first step at or past each mark.)
    expect(came).toHaveLength(1);
    expect(came[0]).toBeGreaterThanOrEqual(60_000);
    expect(came[0]).toBeLessThan(60_000 + a.config.stepMs);
    // It is in the field, sitting on the screen, and takes nothing from him.
    expect(present).toBe(1);
    const neighbour = a.cats().find((c) => c.variety === SECRET_CAT);
    if (neighbour) expect(neighbour.drain).toBe(0);

    // Walking, he never meets it.
    const b = quiet();
    came = [];
    while (b.state().time < 120_000) {
      const t = b.state().time / 3000;
      b.step({ x: Math.cos(t), y: Math.sin(t) });
      if (b.drainEvents().some((e) => e.kind === 'secret')) came.push(b.state().time);
    }
    expect(came).toEqual([]);
  });

  it('walking onto it costs him nothing: it does not touch him', () => {
    // Only the secret cat: no other cat comes.
    const a = quiet({ escalation: [[0, 0]], hero: { ...ARENA_CONFIG.hero, resolve: 100 } });
    while (!a.drainEvents().some((e) => e.kind === 'secret')) a.step({ x: 0, y: 0 });
    const neighbour = a.cats().find((c) => c.variety === SECRET_CAT)!;
    const hits: string[] = [];
    for (let i = 0; i < 200; i++) {
      const { x, y } = a.state().hero;
      const d = Math.hypot(neighbour.x - x, neighbour.y - y) || 1;
      a.step(d > 2 ? { x: (neighbour.x - x) / d, y: (neighbour.y - y) / d } : { x: 0, y: 0 });
      for (const e of a.drainEvents()) if (e.kind === 'hero-hit') hits.push(String(e.variety));
    }
    expect(Math.hypot(neighbour.x - a.state().hero.x, neighbour.y - a.state().hero.y)).toBeLessThan(
      a.config.hero.reach
    );
    expect(hits).toEqual([]);
    expect(a.state().hero.resolve).toBe(100);
  });

  it('it needs the full 20 s: still 19 s, then a step, then still again', () => {
    const a = quiet();
    const secrets: number[] = [];
    const step = (input: { x: number; y: number }) => {
      a.step(input);
      if (a.drainEvents().some((e) => e.kind === 'secret')) secrets.push(a.state().time);
    };
    while (a.state().time < 60_000) step({ x: 1, y: 0 });
    while (a.state().time < 79_000) step({ x: 0, y: 0 });
    step({ x: 1, y: 0 });
    expect(secrets).toEqual([]);
    const from = a.state().time;
    while (a.state().time < from + 20_000) step({ x: 0, y: 0 });
    expect(secrets).toHaveLength(1);
    expect(secrets[0]).toBeCloseTo(from + 20_000, -1);
  });
});

describe('Second Wind', () => {
  it('once a run, spent Resolve comes back by half; the second time the run ends', () => {
    const a = createArena({
      random: createRandom(1),
      types: CAT_TYPES,
      viewport: { width: 1280, height: 800 },
      config: {
        startingWeapons: [],
        escalation: [[0, 60]],
        boost: { might: 1, pickup: 1, revivals: 1 },
      },
    });
    const kinds: string[] = [];
    while (a.state().status !== 'over' && a.state().time < 300_000) {
      a.step({ x: 0, y: 0 });
      for (const e of a.drainEvents())
        if (e.kind === 'revived' || e.kind === 'over') kinds.push(e.kind);
    }
    expect(kinds).toEqual(['revived', 'over']);
  });
});

describe('storage', () => {
  const sample: Progress = {
    tufts: 42,
    upgrades: { sternness: 2, 'second-wind': 1 },
    milestones: ['survive-2'],
    bought: ['housekeeper'],
    character: 'night-porter',
    found: ['infinite-laser', SECRET_CAT],
  };

  it('round-trips', () => {
    expect(parseProgress(serializeProgress(sample))).toEqual(sample);
  });

  it('nothing stored, or anything corrupt, reads as a fresh start', () => {
    for (const raw of [null, '', 'not json', '42', 'null', '[]', '{"version":1,"tufts":"many"}']) {
      const progress = parseProgress(raw);
      expect(progress.tufts).toBe(0);
      expect(progress.character).toBe('keeper');
    }
  });

  it('what cannot be right is dropped, the rest kept', () => {
    const progress = parseProgress(
      JSON.stringify({
        version: 1,
        tufts: -5,
        upgrades: { sternness: 99, 'flying-boots': 3, 'brisk-step': 'two' },
        milestones: ['survive-2', 'survive-99'],
        bought: ['housekeeper', 'astronaut'],
        character: 'housekeeper',
        found: ['yarn-apocalypse', 'unicorn'],
      })
    );
    expect(progress).toEqual({
      tufts: 0,
      upgrades: { sternness: UPGRADES.sternness.maxLevel },
      milestones: ['survive-2'],
      bought: ['housekeeper'],
      character: 'housekeeper',
      found: ['yarn-apocalypse'],
    });
    // A character he does not have cannot be the one chosen.
    expect(parseProgress(JSON.stringify({ version: 1, character: 'housekeeper' })).character).toBe(
      'keeper'
    );
  });

  it('an older or newer version starts afresh, cleanly', () => {
    for (const version of [0, 2, undefined]) {
      expect(parseProgress(JSON.stringify({ ...sample, version }))).toEqual(freshProgress());
    }
  });

  describe('in the browser’s storage', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('is kept under its versioned key, and read back', () => {
      const store = new Map<string, string>();
      vi.stubGlobal('window', {
        localStorage: {
          getItem: (k: string) => store.get(k) ?? null,
          setItem: (k: string, v: string) => store.set(k, v),
        },
      });
      expect(readProgress()).toEqual(freshProgress());
      writeProgress(sample);
      expect(JSON.parse(store.get(PROGRESS_KEY)!).version).toBe(1);
      expect(readProgress()).toEqual(sample);
      // The same object while nothing changes (useSyncExternalStore needs it).
      expect(readProgress()).toBe(readProgress());
    });

    it('blocked storage is a fresh start, and never throws', () => {
      vi.stubGlobal('window', {
        localStorage: {
          getItem: () => {
            throw new Error('blocked');
          },
          setItem: () => {
            throw new Error('blocked');
          },
        },
      });
      expect(readProgress()).toEqual(freshProgress());
      expect(() => writeProgress(sample)).not.toThrow();
    });
  });
});

describe('what a milestone unlocks, as the results say it', () => {
  it('names each weapon and character a milestone brings', () => {
    expect(unlockedBy('survive-2')).toBe('Now available: The Night Porter.');
    expect(unlockedBy('survive-3')).toBe('Now available: Thunderous Vacuum.');
    expect(unlockedBy('send-1000')).toBe('Now available: Laser Pointer Deluxe.');
    expect(unlockedBy('level-20')).toBe('Now available: Hairball.');
  });
});
