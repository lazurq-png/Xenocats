import { describe, expect, it } from 'vitest';
import { walkDirection } from '@/app/ui/xenocats/walking';

describe('walking', () => {
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
});
