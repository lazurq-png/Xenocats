// Walking a game character with the keyboard, which way it faces, and a game clock
// that stands still while a game is paused. Shared by the fight games (fight.tsx,
// arena-view.tsx) and the movement pad (movement-pad.ts).

import type { Vec } from './effects';

/** Where WASD and the arrow keys walk the character (KeyboardEvent.code). */
const WALK_KEYS: Readonly<Record<string, Vec>> = {
  KeyW: { x: 0, y: -1 },
  KeyA: { x: -1, y: 0 },
  KeyS: { x: 0, y: 1 },
  KeyD: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowDown: { x: 0, y: 1 },
  ArrowRight: { x: 1, y: 0 },
};

export const isWalkKey = (code: string) => code in WALK_KEYS;

/**
 * The way the held keys walk the character: a unit vector, or zero when none (or
 * only opposite ones) are held. A diagonal is no faster than a straight line.
 */
export function walkDirection(held: Iterable<string>): Vec {
  const keys = new Set(held);
  let x = 0;
  let y = 0;
  for (const code of keys) {
    const way = WALK_KEYS[code];
    if (!way) continue;
    x += way.x;
    y += way.y;
  }
  // WASD and an arrow key for the same way count once.
  x = Math.sign(x);
  y = Math.sign(y);
  const length = Math.hypot(x, y);
  return length === 0 ? { x: 0, y: 0 } : { x: x / length, y: y / length };
}

export const FACINGS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'] as const;
export type Facing = (typeof FACINGS)[number];

/** Which of eight ways the character at `from` faces to look at `to` (screen y grows down). */
export function facingTowards(from: Vec, to: Vec): Facing {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const eighth = Math.round(angle / (Math.PI / 4));
  return FACINGS[((eighth % 8) + 8) % 8];
}

/**
 * Time that stops while the game is paused. `real` is any monotonic clock
 * (performance.now()); `now` returns the game time it maps to.
 */
export function createGameClock(start: number) {
  let offset = start;
  let pausedAt: number | null = null;
  return {
    now(real: number): number {
      return (pausedAt ?? real) - offset;
    },
    pause(real: number) {
      pausedAt ??= real;
    },
    resume(real: number) {
      if (pausedAt === null) return;
      offset += real - pausedAt;
      pausedAt = null;
    },
    isPaused(): boolean {
      return pausedAt !== null;
    },
  };
}
