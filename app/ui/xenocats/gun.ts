// What a cat's attack on the ranger does to its gun (Fight a cat, Survival). Pure,
// like effects.ts: the effect running, the ranger's look and the aim go in, the shot
// comes out.
//
// Most effects reach the gun without help: a beam leaves the ranger and flies at the
// crosshair, and the attack moves both (drift, teleport, magnet, orbit, delay,
// spiral...). Every shot also takes on the ranger's look: a tiny ranger fires tiny
// beams that must come closer to hit, a giant one big beams; vanished, its beams
// are invisible; blurred, blurry. The rest is per effect, below.

import type { CursorLook, Vec } from './effects';
import type { Random } from './random';
import { NORMAL_SHOT, type ShotStyle } from './survival';

export type Shot = { from: Vec; to: Vec; style: ShotStyle };

/** Beams never shrink or grow past these, whatever the ranger's size. */
export const SHOT_SCALE: readonly [number, number] = [0.25, 2];

/** The effects that jam the gun: no shot fires while they run. */
export const JAMMING = new Set(['freeze', 'knockback']);

/** Heavy: the gun reloads this many times slower and its beams fly this much slower. */
export const HEAVY_RELOAD = 2.5;
export const HEAVY_SPEED = 0.3;

/** Jitter and Drunk: a shot leaves up to this far off the aim, radians. */
export const SPREAD: Readonly<Record<string, number>> = {
  jitter: 0.35,
  drunk: 0.6,
};

/** Fall: beams drop like stones, px/s². */
export const FALL_GRAVITY = 1400;

/** Bounce: beams come back off the screen's edges this many times. */
export const BOUNCE_TIMES = 3;

function rotate(point: Vec, around: Vec, angle: number): Vec {
  const dx = point.x - around.x;
  const dy = point.y - around.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: around.x + dx * cos - dy * sin, y: around.y + dx * sin + dy * cos };
}

/**
 * The shot the ranger, drawn as `ranger`, fires at `aim` while `effectId` runs on
 * it (null: none). Null when the gun is jammed.
 */
export function shotFor(
  effectId: string | null,
  ranger: CursorLook,
  aim: Vec,
  random: Random
): Shot | null {
  if (effectId && JAMMING.has(effectId)) return null;
  const [smallest, biggest] = SHOT_SCALE;
  const style: ShotStyle = {
    ...NORMAL_SHOT,
    scale: Math.min(Math.max(ranger.scale, smallest), biggest),
    opacity: ranger.visible ? ranger.opacity : 0,
    blur: ranger.blur,
    tint: ranger.tint,
  };
  let from: Vec = { x: ranger.x, y: ranger.y };
  let to = aim;

  switch (effectId) {
    case 'heavy':
      style.reload = HEAVY_RELOAD;
      style.speed = HEAVY_SPEED;
      break;
    case 'reverse':
      // The aim mirrored through the ranger: the shot goes out behind it.
      to = { x: 2 * from.x - aim.x, y: 2 * from.y - aim.y };
      break;
    case 'jitter':
    case 'drunk':
      to = rotate(aim, from, random.range(-SPREAD[effectId], SPREAD[effectId]));
      break;
    case 'decoys': {
      // Every ranger on screen looks alike; the shot leaves from any one of them.
      const rangers = [from, ...(ranger.decoys ?? [])];
      const chosen = random.pick(rangers);
      to = { x: aim.x + chosen.x - from.x, y: aim.y + chosen.y - from.y };
      from = chosen;
      break;
    }
    case 'fall':
      style.gravity = FALL_GRAVITY;
      break;
    case 'bounce':
      style.bounces = BOUNCE_TIMES;
      break;
    case 'axis-lock': {
      // Straight sideways or straight up and down, whichever is nearer the aim.
      const dx = aim.x - from.x;
      const dy = aim.y - from.y;
      to = Math.abs(dx) >= Math.abs(dy) ? { x: aim.x, y: from.y } : { x: from.x, y: aim.y };
      break;
    }
  }
  return { from, to, style };
}
