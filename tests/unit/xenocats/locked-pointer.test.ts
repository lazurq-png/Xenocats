import { describe, expect, it } from 'vitest';
import { KNOCKBACK_DISTANCE, heavy, knockback, vanish } from '@/app/ui/xenocats/effects';
import { createLockedPointer } from '@/app/ui/xenocats/locked-pointer';
import { createRandom } from '@/app/ui/xenocats/random';

const viewport = { width: 1200, height: 800 };

const pointer = (start = { x: 600, y: 400 }) =>
  createLockedPointer({ viewport, start, random: createRandom(1) });

/** Frames every 16 ms from `from` to `to`. */
function frames(p: ReturnType<typeof pointer>, from: number, to: number) {
  for (let now = from; now <= to; now += 16) p.frame(now);
}

describe('the locked pointer', () => {
  it('moves by the mouse’s movement, and stays on screen', () => {
    const p = pointer();
    p.move(30, -20);
    p.frame(0);
    expect(p.position()).toEqual({ x: 630, y: 380 });
    p.move(5000, 5000);
    p.frame(16);
    expect(p.position()).toEqual({ x: 1199, y: 799 });
  });

  it('an attack moves the pointer itself: it stays where the effect left it', () => {
    const p = pointer();
    p.frame(0);
    // A cat to the left knocks the pointer to the right.
    expect(p.attack(knockback, { x: 500, y: 400 }, 0)).toBe(true);
    frames(p, 0, knockback.durationMs + 100);
    expect(p.activeEffectId(knockback.durationMs + 100)).toBeNull();
    expect(p.position().x).toBeCloseTo(600 + KNOCKBACK_DISTANCE, 0);
    // The mouse carries on from there, not from where it was before the attack.
    p.move(10, 0);
    p.frame(knockback.durationMs + 200);
    expect(p.position().x).toBeCloseTo(600 + KNOCKBACK_DISTANCE + 10, 0);
  });

  it('a slowing attack leaves the pointer short of where the mouse went', () => {
    const p = pointer();
    p.frame(0);
    p.attack(heavy, { x: 0, y: 0 }, 0);
    for (let now = 16; now <= 1000; now += 16) {
      p.move(10, 0);
      p.frame(now);
    }
    frames(p, 1016, heavy.durationMs + 100);
    const x = p.position().x;
    expect(x).toBeLessThan(600 + 62 * 10);
    expect(x).toBeGreaterThan(600);
  });

  it('only one effect at a time', () => {
    const p = pointer();
    p.frame(0);
    expect(p.attack(vanish, { x: 0, y: 0 }, 0)).toBe(true);
    expect(p.attack(knockback, { x: 0, y: 0 }, 100)).toBe(false);
    expect(p.activeEffectId(100)).toBe('vanish');
    expect(p.frame(100).visible).toBe(false);
    frames(p, 116, vanish.durationMs + 50);
    expect(p.frame(vanish.durationMs + 66).visible).toBe(true);
  });
});
