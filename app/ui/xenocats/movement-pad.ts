// The on-screen movement pad (movement-pad-view.tsx), for touch screens: a thumb
// held on it walks the character the way the WASD keys do. Pure: no DOM, so it is
// tested in Node.
//
// The pad is a circle. A touch in its middle (the dead zone) walks nowhere; one
// further out walks in whichever of the eight WASD ways points nearest to it, as a
// unit vector, a diagonal no faster than a straight line — the very vector
// `walkDirection` (walking.ts) gives for those keys held.

import type { Vec } from './effects';
import { walkDirection } from './walking';

/** The pad's diameter, px: room for a thumb, and to aim it. */
export const PAD_SIZE = 144;

/** The knob's diameter, px. */
export const KNOB_SIZE = 56;

/** The middle of the pad that walks nowhere, as a share of its radius. */
export const DEAD_ZONE = 0.25;

/** The keys each of the eight ways would hold, from east, clockwise (screen y grows down). */
const SECTORS: readonly (readonly string[])[] = [
  ['KeyD'],
  ['KeyD', 'KeyS'],
  ['KeyS'],
  ['KeyA', 'KeyS'],
  ['KeyA'],
  ['KeyA', 'KeyW'],
  ['KeyW'],
  ['KeyD', 'KeyW'],
];

/**
 * The way a touch at `touch` on a pad centred at `centre`, of radius `radius`,
 * walks the character: what WASD would give, or zero with no touch (released) or
 * inside the dead zone.
 */
export function padDirection(
  touch: Vec | null,
  centre: Vec,
  radius: number,
  deadZone = DEAD_ZONE
): Vec {
  if (!touch) return { x: 0, y: 0 };
  const dx = touch.x - centre.x;
  const dy = touch.y - centre.y;
  if (Math.hypot(dx, dy) < deadZone * radius) return { x: 0, y: 0 };
  const sector = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
  return walkDirection(SECTORS[sector]);
}

/** Where the knob is drawn for a touch: under the thumb, but never off the pad. */
export function knobOffset(touch: Vec | null, centre: Vec, radius: number): Vec {
  if (!touch) return { x: 0, y: 0 };
  const dx = touch.x - centre.x;
  const dy = touch.y - centre.y;
  const length = Math.hypot(dx, dy);
  if (length <= radius) return { x: dx, y: dy };
  return { x: (dx / length) * radius, y: (dy / length) * radius };
}
