// Walking a game character with the keyboard. Shared by the arena (arena-view.tsx)
// and the movement pad (movement-pad.ts).

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

/** In local co-op: player 1 walks with WASD, player 2 with the arrow keys. */
export const PLAYER_KEYS: readonly ReadonlySet<string>[] = [
  new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']),
  new Set(['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']),
];

/**
 * The way the held keys walk the character: a unit vector, or zero when none (or
 * only opposite ones) are held. A diagonal is no faster than a straight line. With
 * `only`, just those keys count (one player's, in co-op).
 */
export function walkDirection(held: Iterable<string>, only?: ReadonlySet<string>): Vec {
  const keys = new Set(held);
  let x = 0;
  let y = 0;
  for (const code of keys) {
    const way = WALK_KEYS[code];
    if (!way || (only && !only.has(code))) continue;
    x += way.x;
    y += way.y;
  }
  // WASD and an arrow key for the same way count once.
  x = Math.sign(x);
  y = Math.sign(y);
  const length = Math.hypot(x, y);
  return length === 0 ? { x: 0, y: 0 } : { x: x / length, y: y / length };
}
