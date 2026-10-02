import { describe, expect, it, vi } from 'vitest';
import { type Cat, type TryAttack, createCatEngine } from '@/app/ui/xenocats/cat-engine';
import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
import { CAT_CONFIG } from '@/app/ui/xenocats/config';
import {
  type CursorLook,
  type Effect,
  MAX_EFFECT_MS,
  fall,
  freeze,
  heavy,
  knockback,
  orbit,
  restingLook,
  strengthen,
} from '@/app/ui/xenocats/effects';
import { createRandom } from '@/app/ui/xenocats/random';

const viewport = { width: 1200, height: 800 };
const never: TryAttack = () => false;
const { petMs, petSleepMs, angryFactor, catSize } = CAT_CONFIG;

/** One cat summoned asleep, its first tick done: it is asleep at `sleepsFrom`. */
function sleepingCat() {
  const engine = createCatEngine({
    random: createRandom(4),
    types: CAT_TYPES,
    viewport,
    autoSpawn: false,
  });
  const cat = engine.summon('void-tabby', 0, null, { asleep: true })!;
  const entrance = CAT_TYPES.find((t) => t.id === 'void-tabby')!.entranceMs;
  engine.tick(entrance, null, never);
  expect(cat.phase).toBe('sleeping');
  const on = { x: cat.x + catSize / 2, y: cat.y + catSize / 2 };
  return { engine, cat, on, sleepsFrom: entrance, wakesAt: cat.phaseEndsAt };
}

describe('petting a sleeping cat', () => {
  it('a pointer resting on it for a second makes it purr', () => {
    const { engine, cat, on, sleepsFrom } = sleepingCat();
    const purr = vi.fn();
    engine.tick(sleepsFrom + 10, on, never, purr);
    engine.tick(sleepsFrom + 10 + petMs - 20, on, never, purr);
    expect(purr).not.toHaveBeenCalled();
    engine.tick(sleepsFrom + 10 + petMs, on, never, purr);
    expect(purr).toHaveBeenCalledTimes(1);
    expect(purr.mock.calls[0][0]).toBe(cat);
    expect(cat.petted).toBe(true);
  });

  it('delays its waking: it sleeps on while petted, and a while after', () => {
    const { engine, cat, on, sleepsFrom, wakesAt } = sleepingCat();
    // Pet it right up to (and well past) when it would have woken.
    let now = sleepsFrom;
    for (; now <= wakesAt + 3000; now += 50) engine.tick(now, on, never);
    expect(cat.phase).toBe('sleeping');
    // The pointer leaves: it still sleeps for petSleepMs after the last purr.
    const away = { x: 0, y: 0 };
    engine.tick(now, away, never);
    expect(cat.phase).toBe('sleeping');
    for (const end = now + petSleepMs + 100; now <= end; now += 50) engine.tick(now, away, never);
    expect(cat.phase).not.toBe('sleeping');
  });

  it('moving off the cat starts the second over', () => {
    const { engine, on, sleepsFrom } = sleepingCat();
    const purr = vi.fn();
    engine.tick(sleepsFrom + 10, on, never, purr);
    engine.tick(sleepsFrom + 600, { x: 0, y: 0 }, never, purr);
    engine.tick(sleepsFrom + 700, on, never, purr);
    engine.tick(sleepsFrom + 1500, on, never, purr);
    expect(purr).not.toHaveBeenCalled();
  });

  it('a pointer that has left the page pets nothing', () => {
    const { engine, sleepsFrom } = sleepingCat();
    const purr = vi.fn();
    for (let now = sleepsFrom; now < sleepsFrom + 3000; now += 50) {
      engine.tick(now, null, never, purr);
    }
    expect(purr).not.toHaveBeenCalled();
  });

  it('only sleeping cats are petted', () => {
    const engine = createCatEngine({
      random: createRandom(4),
      types: CAT_TYPES,
      viewport,
      autoSpawn: false,
    });
    const cat = engine.summon('void-tabby', 0, null)!;
    const on = { x: cat.x + 5, y: cat.y + 5 };
    const purr = vi.fn();
    for (let now = 0; now < 3000; now += 50) engine.tick(now, on, never, purr);
    expect(purr).not.toHaveBeenCalled();
  });
});

describe('clicking a sleeping cat', () => {
  it('wakes it at once, angry', () => {
    const { engine, cat, on, sleepsFrom } = sleepingCat();
    expect(engine.poke(on, sleepsFrom + 100)).toBe(cat);
    expect(cat.phase).toBe('waking');
    expect(cat.angry).toBe(true);
    expect(cat.phaseEndsAt).toBe(sleepsFrom + 100 + CAT_CONFIG.wakeMs);
  });

  it('a click beside it, or on an awake cat, does nothing', () => {
    const { engine, cat, sleepsFrom } = sleepingCat();
    expect(engine.poke({ x: cat.x - 5, y: cat.y - 5 }, sleepsFrom + 100)).toBeNull();
    expect(cat.phase).toBe('sleeping');
    const awake = engine.summon('gravi-coon', sleepsFrom, null)!;
    expect(engine.poke({ x: awake.x + 5, y: awake.y + 5 }, sleepsFrom + 100)).toBeNull();
    expect(awake.angry).toBe(false);
  });

  it('the angry cat attacks with its effect made stronger', () => {
    const { engine, on, sleepsFrom } = sleepingCat();
    engine.poke(on, sleepsFrom);
    const seen: Cat[] = [];
    const attack: TryAttack = (cat) => {
      seen.push({ ...cat });
      return true;
    };
    for (let now = sleepsFrom; now < sleepsFrom + 3000; now += 50) engine.tick(now, null, attack);
    expect(seen).toHaveLength(1);
    expect(seen[0].angry).toBe(true);
  });
});

/**
 * Runs `effect` for `ms`, the real pointer starting at `from` and moving by `move`
 * each frame, as a real pointer does; returns the looks.
 */
function run<S>(effect: Effect<S>, ms: number, from = { x: 600, y: 400 }, move = { x: 0, y: 0 }) {
  const looks: CursorLook[] = [];
  let real = from;
  let previous = restingLook(real);
  let state: S | undefined;
  for (let elapsed = 0; elapsed <= ms; elapsed += 16) {
    real = { x: real.x + move.x, y: real.y + move.y };
    const frame = effect.step({
      real,
      delta: move,
      previous,
      start: { x: 600, y: 400 },
      cat: { x: 500, y: 400 },
      elapsed,
      dt: 16,
      viewport,
      roll: 0.3,
      state,
    });
    state = frame.state;
    previous = frame.look;
    looks.push(frame.look);
  }
  return looks;
}

describe('a stronger effect', () => {
  it('lasts longer, never past the limit', () => {
    expect(strengthen(knockback, angryFactor).durationMs).toBe(
      Math.round(knockback.durationMs * angryFactor)
    );
    expect(strengthen(knockback, 100).durationMs).toBe(MAX_EFFECT_MS);
    expect(strengthen(knockback, angryFactor).id).toBe(knockback.id);
  });

  it('throws the cursor further', () => {
    const plain = run(knockback, 400).at(-1)!;
    const strong = run(strengthen(knockback, angryFactor), 400).at(-1)!;
    expect(strong.x - 600).toBeCloseTo((plain.x - 600) * angryFactor, 5);
  });

  it('does not compound an effect that builds on its previous look', () => {
    // Fall drops the cursor from where it was each frame: the stronger one ends
    // exactly 1.5 times as far below the pointer, not more each frame.
    const step = { x: 2, y: 0 };
    const from = { x: 600, y: 200 };
    const plain = run(fall, 1000, from, step);
    const strong = run(strengthen(fall, angryFactor), 1000, from, step);
    const below = (looks: CursorLook[]) => looks.at(-1)!.y - from.y;
    expect(below(plain)).toBeGreaterThan(50);
    expect(below(strong)).toBeCloseTo(below(plain) * angryFactor, 5);
  });

  it('keeps an effect that places the cursor elsewhere on its own path', () => {
    // Freeze holds the cursor where the attack began, however the mouse moves.
    const step = { x: 5, y: 3 };
    for (const look of run(strengthen(freeze, angryFactor), 1000, { x: 600, y: 400 }, step)) {
      expect({ x: look.x, y: look.y }).toEqual({ x: 600, y: 400 });
    }
    // Heavy (30% speed) keeps its speed; it only lasts longer.
    const plain = run(heavy, 500, { x: 600, y: 400 }, step);
    const strong = run(strengthen(heavy, angryFactor), 500, { x: 600, y: 400 }, step);
    expect(strong.map((l) => [l.x, l.y])).toEqual(plain.map((l) => [l.x, l.y]));
    expect(strengthen(orbit, angryFactor).durationMs).toBe(
      Math.round(orbit.durationMs * angryFactor)
    );
  });
});
