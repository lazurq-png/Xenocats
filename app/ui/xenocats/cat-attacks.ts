// The cats' attacks, as geometry (arena.ts does the rest): which of the bosses'
// patterns comes next, the angles of a burst of shots, and how a homing shot or a
// dashing cat turns toward its Keeper. Pure, and drawing nothing from the run's
// random source, so a seeded run plays out the same every time.

/** What an elite's or a boss's attack looks like while it winds up, and what it then is. */
export type AttackShape =
  /** A spot round where the Keeper stood, landed on all at once (the Mega Cat's pounce, the Matriarch's call). */
  | 'blast'
  /** The cat itself charges along a lane, through where he stood. */
  | 'dash'
  /** Shots flying out on every side, one of them at him. */
  | 'burst'
  /** One slow shot that follows him. */
  | 'bolt';

/** The Mega Cat's attacks, one after the other, round again. */
export type MegaPattern = 'pounce' | 'charge' | 'volley';
export const MEGA_PATTERNS: readonly MegaPattern[] = ['pounce', 'charge', 'volley'];

/** How each of the Mega Cat's attacks is warned. */
export const MEGA_SHAPE: Readonly<Record<MegaPattern, AttackShape>> = {
  pounce: 'blast',
  charge: 'dash',
  volley: 'burst',
};

/** The pattern of a Mega Cat's attack after `begun` attacks. */
export const megaPatternAt = (begun: number): MegaPattern =>
  MEGA_PATTERNS[begun % MEGA_PATTERNS.length];

/** The Matriarch's calls: kittens round him, then a volley of shots, round again. */
export type MatriarchPattern = 'summon' | 'volley';
export const matriarchPatternAt = (begun: number): MatriarchPattern =>
  begun % 2 === 0 ? 'summon' : 'volley';

/** The ways `count` shots fly from a burst, evenly round, the first at `aim` (radians). */
export function burstAngles(aim: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => aim + (i * 2 * Math.PI) / count);
}

/**
 * A velocity turned toward a point by at most `maxTurn` radians, its speed kept:
 * how a homing shot or a dashing cat follows the Keeper without turning on a coin.
 */
export function steer(
  vx: number,
  vy: number,
  dx: number,
  dy: number,
  maxTurn: number
): { vx: number; vy: number } {
  const speed = Math.hypot(vx, vy);
  if (speed === 0 || (dx === 0 && dy === 0) || maxTurn <= 0) return { vx, vy };
  const now = Math.atan2(vy, vx);
  const want = Math.atan2(dy, dx);
  const off = Math.atan2(Math.sin(want - now), Math.cos(want - now));
  const turned = now + Math.max(-maxTurn, Math.min(maxTurn, off));
  return { vx: Math.cos(turned) * speed, vy: Math.sin(turned) * speed };
}
