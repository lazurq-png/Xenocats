import { describe, expect, it } from 'vitest';
import { createGameClock, facingTowards, walkDirection } from '@/app/ui/xenocats/walking';

const centre = { x: 600, y: 400 };

describe('walking and facing', () => {
  it('WASD and the arrow keys walk the ranger; a diagonal is no faster', () => {
    expect(walkDirection([])).toEqual({ x: 0, y: 0 });
    expect(walkDirection(['KeyD'])).toEqual({ x: 1, y: 0 });
    expect(walkDirection(['ArrowUp'])).toEqual({ x: 0, y: -1 });
    const diagonal = walkDirection(['KeyW', 'KeyA']);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1);
    expect(diagonal.x).toBeLessThan(0);
    expect(diagonal.y).toBeLessThan(0);
    // Opposite keys cancel; the same way twice counts once; other keys are ignored.
    expect(walkDirection(['KeyA', 'KeyD'])).toEqual({ x: 0, y: 0 });
    expect(walkDirection(['KeyS', 'ArrowDown'])).toEqual({ x: 0, y: 1 });
    expect(walkDirection(['KeyQ', 'Space'])).toEqual({ x: 0, y: 0 });
  });

  it('faces the aim in eight directions', () => {
    const at = (dx: number, dy: number) => facingTowards(centre, { x: 600 + dx, y: 400 + dy });
    expect(at(100, 0)).toBe('e');
    expect(at(100, 100)).toBe('se');
    expect(at(0, 100)).toBe('s');
    expect(at(-100, 100)).toBe('sw');
    expect(at(-100, 0)).toBe('w');
    expect(at(-100, -100)).toBe('nw');
    expect(at(0, -100)).toBe('n');
    expect(at(100, -100)).toBe('ne');
    // Nearly east is still east.
    expect(at(100, 30)).toBe('e');
  });
});

describe('game clock', () => {
  it('stands still while paused', () => {
    const clock = createGameClock(1000);
    expect(clock.now(1500)).toBe(500);
    clock.pause(1500);
    expect(clock.isPaused()).toBe(true);
    expect(clock.now(9000)).toBe(500);
    clock.resume(9000);
    expect(clock.isPaused()).toBe(false);
    expect(clock.now(9100)).toBe(600);
  });
});
