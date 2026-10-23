import { describe, expect, it } from 'vitest';
import {
  type PadSnapshot,
  STICK_DEAD_ZONE,
  createPadReader,
  newlyPressed,
  padHeld,
  padWalk,
  padsByPlayer,
} from '@/app/ui/xenocats/gamepad';

/** A standard pad: these axes, these buttons held (by index). */
function pad(index: number, axes: [number, number] = [0, 0], held: number[] = []): PadSnapshot {
  return {
    index,
    connected: true,
    axes: [...axes, 0, 0],
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: held.includes(i) })),
  };
}

describe('a controller', () => {
  it('walks with the left stick, as far as it is pushed, never faster than a key', () => {
    // Inside the dead zone (a stick's drift): nowhere.
    expect(padWalk(pad(0, [0.1, -0.1]))).toEqual({ x: 0, y: 0 });
    // Pushed right to the rim: full speed that way.
    const right = padWalk(pad(0, [1, 0]));
    expect(right.x).toBeCloseTo(1);
    expect(right.y).toBeCloseTo(0);
    // Half way out: slower, the same way.
    const half = padWalk(pad(0, [0, 0.6]));
    expect(half.x).toBeCloseTo(0);
    expect(half.y).toBeCloseTo((0.6 - STICK_DEAD_ZONE) / (1 - STICK_DEAD_ZONE));
    // A square stick's corner reads past 1: still no faster than a key.
    const corner = padWalk(pad(0, [1, 1]));
    expect(Math.hypot(corner.x, corner.y)).toBeCloseTo(1);
    expect(corner.x).toBeCloseTo(corner.y);
    // No pad: nowhere.
    expect(padWalk(null)).toEqual({ x: 0, y: 0 });
  });

  it('walks with the d-pad as the WASD keys do, a diagonal no faster', () => {
    expect(padWalk(pad(0, [0, 0], [12]))).toEqual({ x: 0, y: -1 });
    expect(padWalk(pad(0, [0, 0], [15]))).toEqual({ x: 1, y: 0 });
    const diagonal = padWalk(pad(0, [0, 0], [13, 14]));
    expect(diagonal.x).toBeCloseTo(-Math.SQRT1_2);
    expect(diagonal.y).toBeCloseTo(Math.SQRT1_2);
    // The stick, when pushed, comes first.
    expect(padWalk(pad(0, [-1, 0], [15])).x).toBeCloseTo(-1);
  });

  it('works the menus: A, B, X, Y, Start, the d-pad, and a flick of the stick', () => {
    expect([...padHeld(pad(0, [0, 0], [0]))]).toEqual(['confirm']);
    expect([...padHeld(pad(0, [0, 0], [1]))]).toEqual(['back']);
    expect([...padHeld(pad(0, [0, 0], [2]))]).toEqual(['skip']);
    expect([...padHeld(pad(0, [0, 0], [3]))]).toEqual(['reroll']);
    expect([...padHeld(pad(0, [0, 0], [9]))]).toEqual(['pause']);
    expect([...padHeld(pad(0, [0, 0], [13]))]).toEqual(['down']);
    expect([...padHeld(pad(0, [0, 0.9]))]).toEqual(['down']);
    expect([...padHeld(pad(0, [-0.9, 0.2]))]).toEqual(['left']);
    // A small tilt is a walk, not a menu move.
    expect([...padHeld(pad(0, [0.4, 0]))]).toEqual([]);
  });

  it('presses once for a button held down', () => {
    const before = padHeld(pad(0, [0, 0], [0]));
    expect(newlyPressed(new Set(), before)).toEqual(['confirm']);
    expect(newlyPressed(before, padHeld(pad(0, [0, 0], [0])))).toEqual([]);
    expect(newlyPressed(before, padHeld(pad(0, [0, 0], [0, 9])))).toEqual(['pause']);
  });

  it('gives player 1 the first pad connected and player 2 the second, at most two', () => {
    const players = padsByPlayer([null, pad(3), pad(1), { ...pad(0), connected: false }, pad(5)]);
    expect(players.map((p) => p.index)).toEqual([1, 3]);
  });

  it('reads a frame at a time: each player’s walk, and each press once, with its player', () => {
    const reader = createPadReader();
    const first = reader.read([pad(0, [1, 0], [9]), pad(1, [0, -1])]);
    expect(first.pads).toBe(2);
    expect(first.walks[0].x).toBeCloseTo(1);
    expect(first.walks[1].y).toBeCloseTo(-1);
    // A stick pushed all the way is a flick as well as a walk.
    expect(first.presses).toEqual([
      { player: 0, action: 'pause' },
      { player: 0, action: 'right' },
      { player: 1, action: 'up' },
    ]);
    // Held on: no press again. Player 2 presses A.
    const next = reader.read([pad(0, [1, 0], [9]), pad(1, [0, -1], [0])]);
    expect(next.presses).toEqual([{ player: 1, action: 'confirm' }]);
    // Player 2's pad goes: one pad, and player 2 walks nowhere.
    const alone = reader.read([pad(0)]);
    expect(alone.pads).toBe(1);
    expect(alone.walks[1]).toEqual({ x: 0, y: 0 });
  });
});
