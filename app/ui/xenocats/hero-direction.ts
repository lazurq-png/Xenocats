// Which way a Keeper faces, in eight directions. Pure: an angle (or a way) in, a
// direction out. The art draws five of them (north, north-east, east, south-east,
// south); the other three are those mirrored (north-west, west, south-west).
//
// Angles are the screen's: 0 points right (east), and they grow clockwise because the
// screen's y grows downward, so π/2 points down (south) and -π/2 up (north). A way
// exactly between two directions belongs to the one clockwise of it.

export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/** The directions in order of angle, from east, clockwise, 45° apart. */
const CLOCKWISE: readonly Direction[] = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];

/** The direction an angle (radians, the screen's) points. */
export function directionOfAngle(angle: number): Direction {
  if (!Number.isFinite(angle)) return 'E';
  // Math.round sends a half up, which is the clockwise side.
  const sector = Math.round(angle / (Math.PI / 4));
  return CLOCKWISE[((sector % 8) + 8) % 8];
}

/** The direction a way (dx right, dy down) points; east for no way at all. */
export function directionOf(dx: number, dy: number): Direction {
  if (dx === 0 && dy === 0) return 'E';
  return directionOfAngle(Math.atan2(dy, dx));
}

/** The five directions the art draws. */
export type DrawnDirection = 'N' | 'NE' | 'E' | 'SE' | 'S';
export const DRAWN_DIRECTIONS: readonly DrawnDirection[] = ['N', 'NE', 'E', 'SE', 'S'];

/** What to draw for a direction: one of the five, and whether it is mirrored left to right. */
export function spriteOf(direction: Direction): { drawn: DrawnDirection; mirrored: boolean } {
  switch (direction) {
    case 'SW':
      return { drawn: 'SE', mirrored: true };
    case 'W':
      return { drawn: 'E', mirrored: true };
    case 'NW':
      return { drawn: 'NE', mirrored: true };
    default:
      return { drawn: direction, mirrored: false };
  }
}

/** Whether a Keeper aiming this way holds his weapon behind his body (he faces away). */
export const facesAway = (direction: Direction) =>
  direction === 'N' || direction === 'NE' || direction === 'NW';
