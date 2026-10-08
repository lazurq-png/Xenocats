import { describe, expect, it } from 'vitest';
import {
  type Cat,
  type CatPhase,
  type TryAttack,
  createCatEngine,
} from '@/app/ui/xenocats/cat-engine';
import { CAT_TYPES, catTypeById } from '@/app/ui/xenocats/cat-types';
import { CAT_CONFIG } from '@/app/ui/xenocats/config';
import { createRandom } from '@/app/ui/xenocats/random';

const VOID_ENTRANCE_MS = catTypeById('void-tabby')!.entranceMs;

const viewport = { width: 1200, height: 800 };
const always: TryAttack = () => true;
const never: TryAttack = () => false;

function engine(options: { seed?: number; autoSpawn?: boolean; config?: object } = {}) {
  return createCatEngine({
    random: createRandom(options.seed ?? 1),
    types: CAT_TYPES,
    viewport,
    autoSpawn: options.autoSpawn ?? false,
    config: options.config,
  });
}

/** Ticks every `step` ms from `from` to `to`, calling `each` after every tick. */
function run(
  e: ReturnType<typeof engine>,
  from: number,
  to: number,
  tryAttack: TryAttack,
  each: (now: number) => void = () => {},
  step = 50
) {
  for (let now = from; now <= to; now += step) {
    e.tick(now, { x: 600, y: 400 }, tryAttack);
    each(now);
  }
}

describe('never more than five cats', () => {
  it('the spawner stops at five, however long cats wait to attack', () => {
    const e = engine({
      autoSpawn: true,
      config: { firstSpawnMs: [10, 20], spawnEveryMs: [100, 200] },
    });
    let most = 0;
    run(e, 0, 60_000, never, () => (most = Math.max(most, e.cats().length)));
    expect(most).toBe(CAT_CONFIG.maxCats);
  });

  it('a sixth summon is refused and changes nothing', () => {
    const e = engine();
    for (let i = 0; i < 5; i++) expect(e.summon('void-tabby', 0, null)).not.toBeNull();
    expect(e.summon('void-tabby', 0, null)).toBeNull();
    expect(e.cats()).toHaveLength(5);
  });

  it('counts leaving cats too', () => {
    const e = engine();
    for (let i = 0; i < 5; i++) e.summon('void-tabby', 0, null);
    // All attack straight away and start leaving.
    run(e, 0, VOID_ENTRANCE_MS + CAT_CONFIG.attackMs + 10, always);
    expect(e.cats().every((cat) => cat.phase === 'leaving')).toBe(true);
    expect(e.summon('void-tabby', 2000, null)).toBeNull();
  });
});

describe('lifecycle', () => {
  function phasesOf(e: ReturnType<typeof engine>, tryAttack: TryAttack, until: number) {
    const seen: (CatPhase | 'gone')[] = [];
    run(e, 0, until, tryAttack, () => {
      const phase: CatPhase | 'gone' = e.cats().at(0)?.phase ?? 'gone';
      // 'gone' only counts once a cat has been seen (the first spawn is a moment after 0).
      if (seen.at(-1) !== phase && (phase !== 'gone' || seen.length > 0)) seen.push(phase);
    });
    return seen;
  }

  it('a spawned cat appears, sleeps, wakes, attacks, leaves and is gone', () => {
    const e = engine({
      autoSpawn: true,
      config: { firstSpawnMs: [0, 1], spawnEveryMs: [1e9, 1e9 + 1] },
    });
    expect(phasesOf(e, always, 40_000)).toEqual([
      'appearing',
      'sleeping',
      'waking',
      'attacking',
      'leaving',
      'gone',
    ]);
  });

  it('sleeps for a time inside the configured range', () => {
    const e = engine();
    e.summon('void-tabby', 0, null);
    const cat = e.cats()[0] as Cat;
    cat.eager = false; // behave like a spawned cat
    e.tick(VOID_ENTRANCE_MS, null, always);
    const slept = e.cats()[0].phaseEndsAt - e.cats()[0].phaseStartedAt;
    expect(slept).toBeGreaterThanOrEqual(CAT_CONFIG.sleepMs[0]);
    expect(slept).toBeLessThan(CAT_CONFIG.sleepMs[1]);
  });

  it('a summoned cat skips sleep and attacks once it has arrived', () => {
    const e = engine();
    e.summon('gravi-coon', 0, null);
    expect(phasesOf(e, always, 3000)).toEqual(['appearing', 'attacking', 'leaving', 'gone']);
  });

  it('a cat summoned asleep sleeps and wakes before it attacks, like a spawned cat', () => {
    const e = engine();
    e.summon('gravi-coon', 0, null, { asleep: true });
    expect(phasesOf(e, always, 40_000)).toEqual([
      'appearing',
      'sleeping',
      'waking',
      'attacking',
      'leaving',
      'gone',
    ]);
  });

  it('asks to attack with the cat and its centre', () => {
    const e = engine();
    const cat = e.summon('pulsar-siamese', 0, null)!;
    const calls: unknown[] = [];
    e.tick(1000, null, (c, type, centre) => {
      calls.push([c.id, type.id, centre]);
      return true;
    });
    expect(calls).toEqual([
      [
        cat.id,
        'pulsar-siamese',
        { x: cat.x + CAT_CONFIG.catSize / 2, y: cat.y + CAT_CONFIG.catSize / 2 },
      ],
    ]);
  });
});

describe('one effect at a time', () => {
  it('a cat that cannot attack yet waits, ready, and pounces once the effect ends', () => {
    const e = engine();
    const first = e.summon('void-tabby', 0, null)!;
    const second = e.summon('gravi-coon', 0, null)!;
    // A stand-in for the cursor: accepts one attack at a time, for its effect's duration.
    let busyUntil = 0;
    const cursorLike: (now: number) => TryAttack = (now) => (_cat, type) => {
      if (now < busyUntil) return false;
      busyUntil = now + type.effect.durationMs;
      return true;
    };

    e.tick(1000, null, cursorLike(1000));
    const phases = () => Object.fromEntries(e.cats().map((cat) => [cat.id, cat.phase]));
    expect(phases()).toEqual({ [first.id]: 'attacking', [second.id]: 'ready' });

    // Still busy with the first cat's 3 s vanish.
    e.tick(2500, null, cursorLike(2500));
    expect(phases()[second.id]).toBe('ready');

    e.tick(4000, null, cursorLike(4000));
    expect(phases()[second.id]).toBe('attacking');
  });
});

describe('where cats appear', () => {
  it('fully on screen, off the cursor and never overlapping, across many seeds', () => {
    // A cramped viewport makes near misses (including diagonal ones) likely.
    const cramped = { width: 520, height: 420 };
    const cursor = { x: 260, y: 210 };
    const { catSize, margin, keepAwayFromCursor } = CAT_CONFIG;
    for (let seed = 1; seed <= 60; seed++) {
      const e = engine({ seed });
      e.resize(cramped);
      for (let i = 0; i < 5; i++) e.summon('void-tabby', 0, cursor);
      const cats = e.cats();
      for (const cat of cats) {
        expect(cat.x).toBeGreaterThanOrEqual(margin);
        expect(cat.y).toBeGreaterThanOrEqual(margin);
        expect(cat.x + catSize).toBeLessThanOrEqual(cramped.width - margin);
        expect(cat.y + catSize).toBeLessThanOrEqual(cramped.height - margin);
        const centre = e.centreOf(cat);
        expect(Math.hypot(centre.x - cursor.x, centre.y - cursor.y)).toBeGreaterThanOrEqual(
          keepAwayFromCursor
        );
        for (const other of cats) {
          if (other === cat) continue;
          const c = e.centreOf(other);
          // Squares are apart when a full cat separates them on at least one axis.
          const apart = Math.abs(centre.x - c.x) >= catSize || Math.abs(centre.y - c.y) >= catSize;
          expect(apart, `seed ${seed}: cats ${cat.id} and ${other.id} overlap`).toBe(true);
        }
      }
    }
  });

  it('catches up across a long gap in one tick, as when a background tab resumes, and still wakes in sight', () => {
    const e = engine();
    const cat = e.summon('void-tabby', 0, null)!;
    cat.eager = false; // a spawned cat: appear, sleep, wake, then attack
    e.tick(100_000, null, always);
    const now = e.cats()[0];
    // Its sleep ran out long ago, but it starts waking now, where it can be seen.
    expect(now.phase).toBe('waking');
    expect(now.phaseStartedAt).toBe(100_000);
    e.tick(100_000 + e.config.wakeMs, null, always);
    expect(e.cats()[0].phase).toBe('attacking');
    e.tick(200_000, null, always);
    expect(e.cats()).toHaveLength(0);
  });

  it('when the screen narrows, a cat it no longer holds moves in to its edge; one it holds stays', () => {
    const e = engine({ seed: 3 });
    for (const type of ['void-tabby', 'gravi-coon', 'pulsar-siamese', 'cryo-persian']) {
      e.summon(type, 0, null, { asleep: true });
    }
    const { catSize, margin } = e.config;
    const before = e.cats().map((c) => ({ x: c.x, y: c.y }));
    expect(before.some((c) => c.x > 300 - catSize - margin)).toBe(true);
    expect(e.resize({ width: 300, height: 600 })).toBe(true);
    e.cats().forEach((cat, i) => {
      expect(cat.x).toBeGreaterThanOrEqual(margin);
      expect(cat.x + catSize).toBeLessThanOrEqual(300 - margin);
      expect(cat.y + catSize).toBeLessThanOrEqual(600 - margin);
      // One that fitted already has not moved.
      if (before[i].x + catSize <= 300 - margin && before[i].y + catSize <= 600 - margin) {
        expect({ x: cat.x, y: cat.y }).toEqual(before[i]);
      }
    });
    // Moved in, they do not land on one another: the narrow screen has room.
    for (const a of e.cats()) {
      for (const b of e.cats()) {
        if (a === b) continue;
        const apart = Math.abs(a.x - b.x) >= catSize || Math.abs(a.y - b.y) >= catSize;
        expect(apart, `cats ${a.id} and ${b.id} overlap`).toBe(true);
      }
    }
    // Wider again: nothing to move.
    expect(e.resize({ width: 1200, height: 800 })).toBe(false);
  });

  it('on a screen smaller than a cat, every cat sits at its corner', () => {
    const e = engine({ seed: 3 });
    e.summon('void-tabby', 0, null, { asleep: true });
    e.summon('gravi-coon', 0, null, { asleep: true });
    const { margin } = e.config;
    e.resize({ width: 50, height: 50 });
    for (const cat of e.cats()) expect({ x: cat.x, y: cat.y }).toEqual({ x: margin, y: margin });
  });

  it('nowhere, when the viewport is too small for a cat', () => {
    const e = engine();
    e.resize({ width: 50, height: 50 });
    expect(e.summon('void-tabby', 0, null)).toBeNull();
  });

  it('the same seed gives the same cats in the same places', () => {
    const layout = () => {
      const e = engine({
        seed: 42,
        autoSpawn: true,
        config: { firstSpawnMs: [0, 100], spawnEveryMs: [500, 900] },
      });
      run(e, 0, 5000, never);
      return e.cats().map(({ typeId, x, y }) => ({ typeId, x, y }));
    };
    expect(layout()).toEqual(layout());
    expect(layout().length).toBeGreaterThan(1);
  });

  it('refuses an unknown cat type', () => {
    expect(engine().summon('dog', 0, null)).toBeNull();
  });
});
