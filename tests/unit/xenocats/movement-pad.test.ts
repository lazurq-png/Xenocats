import { describe, expect, it } from 'vitest';
import { DEAD_ZONE, knobOffset, padDirection } from '@/app/ui/xenocats/movement-pad';
import { walkDirection } from '@/app/ui/xenocats/walking';

const centre = { x: 100, y: 100 };
const radius = 72;
/** A touch `distance` px from the centre, at `degrees` (0 is east, 90 is down). */
const at = (degrees: number, distance = 50) => ({
  x: centre.x + Math.cos((degrees * Math.PI) / 180) * distance,
  y: centre.y + Math.sin((degrees * Math.PI) / 180) * distance,
});

describe('the movement pad walks as WASD does', () => {
  it('walks nowhere with the thumb in the middle', () => {
    expect(padDirection(centre, centre, radius)).toEqual({ x: 0, y: 0 });
  });

  it('each of the four ways gives what its key gives', () => {
    expect(padDirection(at(0), centre, radius)).toEqual(walkDirection(['KeyD']));
    expect(padDirection(at(90), centre, radius)).toEqual(walkDirection(['KeyS']));
    expect(padDirection(at(180), centre, radius)).toEqual(walkDirection(['KeyA']));
    expect(padDirection(at(270), centre, radius)).toEqual(walkDirection(['KeyW']));
  });

  it('a diagonal gives what two keys give: no faster than a straight line', () => {
    expect(padDirection(at(45), centre, radius)).toEqual(walkDirection(['KeyD', 'KeyS']));
    expect(padDirection(at(135), centre, radius)).toEqual(walkDirection(['KeyA', 'KeyS']));
    expect(padDirection(at(225), centre, radius)).toEqual(walkDirection(['KeyA', 'KeyW']));
    expect(padDirection(at(315), centre, radius)).toEqual(walkDirection(['KeyD', 'KeyW']));
    expect(Math.hypot(...Object.values(padDirection(at(45), centre, radius)))).toBeCloseTo(1);
  });

  it('snaps to the nearest of the eight ways', () => {
    expect(padDirection(at(20), centre, radius)).toEqual(walkDirection(['KeyD']));
    expect(padDirection(at(25), centre, radius)).toEqual(walkDirection(['KeyD', 'KeyS']));
    expect(padDirection(at(-20), centre, radius)).toEqual(walkDirection(['KeyD']));
    expect(padDirection(at(-25), centre, radius)).toEqual(walkDirection(['KeyD', 'KeyW']));
  });

  it('has a dead zone in the middle', () => {
    const edge = DEAD_ZONE * radius;
    expect(padDirection(at(0, edge - 1), centre, radius)).toEqual({ x: 0, y: 0 });
    expect(padDirection(at(0, edge + 1), centre, radius)).toEqual({ x: 1, y: 0 });
  });

  it('walks on with the thumb slid off the pad, and stops when it is let go', () => {
    expect(padDirection(at(90, radius * 3), centre, radius)).toEqual({ x: 0, y: 1 });
    expect(padDirection(null, centre, radius)).toEqual({ x: 0, y: 0 });
  });

  it('draws the knob under the thumb, but never off the pad', () => {
    expect(knobOffset(at(0, 30), centre, radius)).toEqual({ x: 30, y: 0 });
    const far = knobOffset(at(90, radius * 2), centre, radius);
    expect(far.x).toBeCloseTo(0);
    expect(far.y).toBeCloseTo(radius);
    expect(knobOffset(null, centre, radius)).toEqual({ x: 0, y: 0 });
  });
});
