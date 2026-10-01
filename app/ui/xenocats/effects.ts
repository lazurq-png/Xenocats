// What a cat's attack does to the fake cursor. Browsers cannot move or slow the real
// pointer, so the page hides it and draws a fake one; an effect decides, frame by
// frame, where that fake cursor is and how it looks.
//
// Every effect is a pure function of its input: no clock, no DOM, no Math.random.
// Anything random derives from `roll` (in [0, 1)), fixed once per attack — an effect
// that wants fresh numbers every frame seeds `createRandom` from it (with the moment,
// or with what it keeps in its `state`).

import { createRandom } from './random';

export type Vec = { x: number; y: number };
export type Size = { width: number; height: number };

export type CursorLook = {
  x: number;
  y: number;
  visible: boolean;
  /** 1 is normal size; the cursor scales from its tip. */
  scale: number;
  /** Blur radius in px. */
  blur: number;
  opacity: number;
  /** Extra, identical-looking cursors drawn at these points (at most MAX_DECOYS). */
  decoys?: Vec[];
  /** A coloured glow round the cursor (e.g. ice), as a CSS colour. */
  tint?: string;
};

export const MAX_DECOYS = 4;

/** Longest an effect may run; clicks are blocked for its whole duration. */
export const MAX_EFFECT_MS = 10_000;

export type EffectInput<S = unknown> = {
  /** The real pointer, now. */
  real: Vec;
  /** How far the real pointer moved since the previous frame. */
  delta: Vec;
  /** The fake cursor on the previous frame. */
  previous: CursorLook;
  /** The real pointer when the attack began. */
  start: Vec;
  /** The centre of the attacking cat. */
  cat: Vec;
  /** Milliseconds since the attack began. */
  elapsed: number;
  /** Milliseconds since the previous frame of this attack (0 on its first frame). */
  dt: number;
  viewport: Size;
  /** One random number in [0, 1), fixed for the whole attack. */
  roll: number;
  /** What this effect returned as `state` on its previous frame; undefined on the first. */
  state: S | undefined;
};

export type EffectFrame<S = unknown> = {
  look: CursorLook;
  /** Carried to the next frame of this attack as `input.state` (velocity, history, ...). */
  state?: S;
};

export type Effect<S = unknown> = {
  id: string;
  /** Shown on the /cats page, e.g. "Vanish". */
  name: string;
  /** One line for the /cats page. */
  description: string;
  /** At most MAX_EFFECT_MS. */
  durationMs: number;
  /**
   * 'offset' for an effect that draws the cursor at an offset from the real
   * pointer: made stronger, the offset grows. Others place it elsewhere (a fixed
   * point, the cat, their own path), and are only made longer (`strengthen`).
   */
  amplify?: 'offset';
  step(input: EffectInput<S>): EffectFrame<S>;
};

export const restingLook = (at: Vec): CursorLook => ({
  x: at.x,
  y: at.y,
  visible: true,
  scale: 1,
  blur: 0,
  opacity: 1,
});

export function clampToViewport(point: Vec, viewport: Size): Vec {
  return {
    x: Math.min(Math.max(point.x, 0), Math.max(viewport.width - 1, 0)),
    y: Math.min(Math.max(point.y, 0), Math.max(viewport.height - 1, 0)),
  };
}

/** A unit vector from `from` towards `to`, or one pointing at `fallbackAngle` if they coincide. */
export function direction(from: Vec, to: Vec, fallbackAngle: number): Vec {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return { x: Math.cos(fallbackAngle), y: Math.sin(fallbackAngle) };
  return { x: dx / length, y: dy / length };
}

const easeOutCubic = (t: number) => 1 - (1 - Math.min(Math.max(t, 0), 1)) ** 3;

export const vanish: Effect = {
  id: 'vanish',
  name: 'Vanish',
  description: 'Your cursor disappears for 3 seconds.',
  durationMs: 3000,
  step: ({ real }) => ({ look: { ...restingLook(real), visible: false } }),
};

export const HEAVY_SPEED = 0.3;

export const heavy: Effect = {
  id: 'heavy',
  name: 'Heavy',
  description: 'Your cursor moves at 30% speed for 5 seconds.',
  durationMs: 5000,
  step: ({ previous, delta, viewport }) => ({
    look: restingLook(
      clampToViewport(
        { x: previous.x + delta.x * HEAVY_SPEED, y: previous.y + delta.y * HEAVY_SPEED },
        viewport
      )
    ),
  }),
};

export const KNOCKBACK_DISTANCE = 300;
export const KNOCKBACK_FLIGHT_MS = 250;

export const knockback: Effect = {
  id: 'knockback',
  amplify: 'offset',
  name: 'Knockback',
  description: 'Your cursor is flung 300 px away from the cat.',
  durationMs: 1500,
  step: ({ real, start, cat, elapsed, viewport, roll }) => {
    const away = direction(cat, start, roll * 2 * Math.PI);
    const distance = KNOCKBACK_DISTANCE * easeOutCubic(elapsed / KNOCKBACK_FLIGHT_MS);
    return {
      look: restingLook(
        clampToViewport({ x: real.x + away.x * distance, y: real.y + away.y * distance }, viewport)
      ),
    };
  },
};

export const reverse: Effect = {
  id: 'reverse',
  name: 'Reverse',
  description: 'Your cursor moves the opposite way for 4 seconds.',
  durationMs: 4000,
  step: ({ previous, delta, viewport }) => ({
    look: restingLook(
      clampToViewport({ x: previous.x - delta.x, y: previous.y - delta.y }, viewport)
    ),
  }),
};

export const JITTER_PX = 15;
export const JITTER_STEP_MS = 40;

export const jitter: Effect = {
  id: 'jitter',
  amplify: 'offset',
  name: 'Jitter',
  description: 'Your cursor shakes for 4 seconds.',
  durationMs: 4000,
  step: ({ real, elapsed, roll, viewport }) => {
    // A new offset every JITTER_STEP_MS, the same for the same moment of the same
    // attack: pure, and independent of the frame rate.
    const slot = Math.floor(elapsed / JITTER_STEP_MS);
    const random = createRandom(Math.floor(roll * 2 ** 31) ^ Math.imul(slot + 1, 0x9e3779b1));
    const offset = {
      x: random.range(-JITTER_PX, JITTER_PX),
      y: random.range(-JITTER_PX, JITTER_PX),
    };
    return {
      look: restingLook(clampToViewport({ x: real.x + offset.x, y: real.y + offset.y }, viewport)),
    };
  },
};

export const ICE = '#7dd3fc';

export const freeze: Effect = {
  id: 'freeze',
  name: 'Freeze',
  description: 'Your cursor is frozen in place for 2.5 seconds.',
  durationMs: 2500,
  step: ({ start }) => ({ look: { ...restingLook(start), tint: ICE } }),
};

export const DRIFT_PX_PER_S = 110;

export const drift: Effect = {
  id: 'drift',
  amplify: 'offset',
  name: 'Drift',
  description: 'Your cursor is pushed steadily in one direction for 5 seconds.',
  durationMs: 5000,
  step: ({ real, elapsed, roll, viewport }) => {
    const angle = roll * 2 * Math.PI;
    const distance = (DRIFT_PX_PER_S * elapsed) / 1000;
    return {
      look: restingLook(
        clampToViewport(
          { x: real.x + Math.cos(angle) * distance, y: real.y + Math.sin(angle) * distance },
          viewport
        )
      ),
    };
  },
};

const easeInOut = (t: number) => {
  const c = Math.min(Math.max(t, 0), 1);
  return c < 0.5 ? 2 * c * c : 1 - (-2 * c + 2) ** 2 / 2;
};

export const TELEPORT_JUMPS = 3;
export const TELEPORT_EVERY_MS = 800;
export const TELEPORT_MARGIN = 40;

type TeleportState = { jump: number; anchor: Vec; spot: Vec };

export const teleport: Effect<TeleportState> = {
  id: 'teleport',
  amplify: 'offset',
  name: 'Teleport',
  description: 'Your cursor jumps to a random spot, three times.',
  durationMs: TELEPORT_JUMPS * TELEPORT_EVERY_MS,
  step: ({ real, elapsed, roll, viewport, state }) => {
    const jump = Math.min(Math.floor(elapsed / TELEPORT_EVERY_MS), TELEPORT_JUMPS - 1);
    let current = state;
    if (!current || current.jump !== jump) {
      // A new jump: a random spot (the same for the same jump of the same attack),
      // and from there the cursor follows the pointer's movement.
      const random = createRandom(Math.floor(roll * 2 ** 31) ^ Math.imul(jump + 1, 0x85ebca6b));
      const spot = {
        x: random.range(
          TELEPORT_MARGIN,
          Math.max(viewport.width - TELEPORT_MARGIN, TELEPORT_MARGIN)
        ),
        y: random.range(
          TELEPORT_MARGIN,
          Math.max(viewport.height - TELEPORT_MARGIN, TELEPORT_MARGIN)
        ),
      };
      current = { jump, anchor: real, spot };
    }
    const at = clampToViewport(
      {
        x: current.spot.x + real.x - current.anchor.x,
        y: current.spot.y + real.y - current.anchor.y,
      },
      viewport
    );
    return { look: restingLook(at), state: current };
  },
};

export const MAGNET_PULL = 0.75;
export const MAGNET_RAMP_MS = 600;

export const magnet: Effect = {
  id: 'magnet',
  name: 'Magnet',
  description: 'Your cursor is pulled towards the cat for 4 seconds.',
  durationMs: 4000,
  step: ({ real, cat, elapsed, viewport }) => {
    const pull = MAGNET_PULL * easeInOut(elapsed / MAGNET_RAMP_MS);
    return {
      look: restingLook(
        clampToViewport(
          { x: real.x + (cat.x - real.x) * pull, y: real.y + (cat.y - real.y) * pull },
          viewport
        )
      ),
    };
  },
};

export const ORBIT_PERIOD_MS = 1200;
export const ORBIT_RADIUS: readonly [number, number] = [70, 140];

export const orbit: Effect = {
  id: 'orbit',
  name: 'Orbit',
  description: 'Your cursor circles the cat for 3 seconds.',
  durationMs: 3000,
  step: ({ start, cat, elapsed, viewport, roll }) => {
    const away = direction(cat, start, roll * 2 * Math.PI);
    const reach = Math.hypot(start.x - cat.x, start.y - cat.y);
    const radius = Math.min(Math.max(reach, ORBIT_RADIUS[0]), ORBIT_RADIUS[1]);
    const angle = Math.atan2(away.y, away.x) + (2 * Math.PI * elapsed) / ORBIT_PERIOD_MS;
    return {
      look: restingLook(
        clampToViewport(
          { x: cat.x + Math.cos(angle) * radius, y: cat.y + Math.sin(angle) * radius },
          viewport
        )
      ),
    };
  },
};

export const DECOY_COUNT = 3;
export const DECOY_RING: readonly [number, number] = [80, 160];

export const decoys: Effect = {
  id: 'decoys',
  amplify: 'offset',
  name: 'Decoys',
  description: 'Four identical cursors for 5 seconds. Which one is yours?',
  durationMs: 5000,
  step: ({ real, start, roll, viewport }) => {
    // Three extra cursors on a ring round yours, at fixed offsets for the whole
    // attack (laid out once, from where the pointer was when it began). They are spread evenly over the arc that faces into the screen — the
    // whole circle mid-screen, half of it by an edge, a quarter in a corner — so
    // none lands on another, on yours, or against the edge.
    const random = createRandom(Math.floor(roll * 2 ** 31) ^ 0x27d4eb2d);
    const [, reachMax] = DECOY_RING;
    const blockedX = start.x < reachMax || start.x > viewport.width - 1 - reachMax;
    const blockedY = start.y < reachMax || start.y > viewport.height - 1 - reachMax;
    const arc = blockedX && blockedY ? Math.PI / 2 : blockedX || blockedY ? Math.PI : 2 * Math.PI;
    const inward = Math.atan2(viewport.height / 2 - start.y, viewport.width / 2 - start.x);
    const centre =
      arc === 2 * Math.PI
        ? random.next() * 2 * Math.PI
        : blockedX && blockedY
          ? inward
          : blockedX
            ? start.x < viewport.width / 2
              ? 0
              : Math.PI
            : start.y < viewport.height / 2
              ? Math.PI / 2
              : -Math.PI / 2;
    const step = arc / DECOY_COUNT;
    const extra = Array.from({ length: DECOY_COUNT }, (_, i) => {
      const angle = centre + (i - (DECOY_COUNT - 1) / 2) * step + random.range(-0.15, 0.15) * step;
      const reach = random.range(DECOY_RING[0], DECOY_RING[1]);
      return clampToViewport(
        { x: real.x + Math.cos(angle) * reach, y: real.y + Math.sin(angle) * reach },
        viewport
      );
    });
    return { look: { ...restingLook(real), decoys: extra } };
  },
};

export const DRUNK_AMPLITUDE = 40;

export const drunk: Effect = {
  id: 'drunk',
  amplify: 'offset',
  name: 'Drunk',
  description: 'Your cursor wobbles about for 5 seconds.',
  durationMs: 5000,
  step: ({ real, elapsed, viewport }) => {
    // Two slightly different periods, so the wobble never quite repeats.
    const t = elapsed / 1000;
    const x = real.x + DRUNK_AMPLITUDE * Math.sin(2 * Math.PI * t * 0.9);
    const y = real.y + DRUNK_AMPLITUDE * 0.6 * Math.sin(2 * Math.PI * t * 1.37 + 1);
    return { look: restingLook(clampToViewport({ x, y }, viewport)) };
  },
};

export const TINY_SCALE = 0.25;

export const tiny: Effect = {
  id: 'tiny',
  name: 'Tiny',
  description: 'Your cursor shrinks to a quarter of its size for 6 seconds.',
  durationMs: 6000,
  step: ({ real }) => ({ look: { ...restingLook(real), scale: TINY_SCALE } }),
};

export const GIANT_SCALE = 4;

export const giant: Effect = {
  id: 'giant',
  name: 'Giant',
  description: 'Your cursor grows to four times its size for 5 seconds.',
  durationMs: 5000,
  step: ({ real }) => ({ look: { ...restingLook(real), scale: GIANT_SCALE } }),
};

export const DELAY_MS = 800;

type DelayState = { trail: { at: number; pos: Vec }[] };

export const delay: Effect<DelayState> = {
  id: 'delay',
  name: 'Delay',
  description: 'Your cursor follows you 0.8 seconds late for 5 seconds.',
  durationMs: 5000,
  step: ({ real, start, elapsed, state }) => {
    // Remember where the pointer was; show where it was DELAY_MS ago.
    const trail = [...(state?.trail ?? [{ at: 0, pos: start }]), { at: elapsed, pos: real }];
    const target = elapsed - DELAY_MS;
    let shown = trail[0].pos;
    for (let i = trail.length - 1; i >= 0; i--) {
      if (trail[i].at <= target) {
        const next = trail[i + 1];
        const from = trail[i];
        shown =
          next && next.at > from.at
            ? {
                x:
                  from.pos.x +
                  ((next.pos.x - from.pos.x) * (target - from.at)) / (next.at - from.at),
                y:
                  from.pos.y +
                  ((next.pos.y - from.pos.y) * (target - from.at)) / (next.at - from.at),
              }
            : from.pos;
        break;
      }
    }
    // Keep only what can still be needed.
    const keepFrom = trail.findIndex((point) => point.at > target) - 1;
    return { look: restingLook(shown), state: { trail: trail.slice(Math.max(keepFrom, 0)) } };
  },
};

export const FALL_PX_PER_S = 260;

export const fall: Effect = {
  id: 'fall',
  amplify: 'offset',
  name: 'Fall',
  description: 'Your cursor sinks towards the bottom unless you keep moving up, for 4 seconds.',
  durationMs: 4000,
  step: ({ previous, delta, dt, viewport }) => ({
    look: restingLook(
      clampToViewport(
        { x: previous.x + delta.x, y: previous.y + delta.y + (FALL_PX_PER_S * dt) / 1000 },
        viewport
      )
    ),
  }),
};

export const BLUR_PX = 4;

export const blur: Effect = {
  id: 'blur',
  name: 'Blur',
  description: 'Your cursor goes blurry and half-transparent for 5 seconds.',
  durationMs: 5000,
  step: ({ real }) => ({ look: { ...restingLook(real), blur: BLUR_PX, opacity: 0.5 } }),
};

export const SPIRAL_TURNS = 2;
export const SPIRAL_MS = 4000;

export const spiral: Effect = {
  id: 'spiral',
  name: 'Spiral',
  description: 'Your cursor spirals in to the middle of the screen over 4 seconds.',
  durationMs: SPIRAL_MS,
  step: ({ start, elapsed, viewport }) => {
    const centre = { x: viewport.width / 2, y: viewport.height / 2 };
    const t = easeInOut(elapsed / SPIRAL_MS);
    const reach = Math.hypot(start.x - centre.x, start.y - centre.y) * (1 - t);
    const angle =
      Math.atan2(start.y - centre.y, start.x - centre.x) + t * SPIRAL_TURNS * 2 * Math.PI;
    return {
      look: restingLook(
        clampToViewport(
          { x: centre.x + Math.cos(angle) * reach, y: centre.y + Math.sin(angle) * reach },
          viewport
        )
      ),
    };
  },
};

export const BOUNCE_MIN_PX_PER_S = 700;

type BounceState = { pos: Vec; velocity: Vec };

export const bounce: Effect<BounceState> = {
  id: 'bounce',
  name: 'Bounce',
  description: 'Your cursor flies off and bounces around the screen for 4 seconds.',
  durationMs: 4000,
  step: ({ real, cat, dt, viewport, roll, state }) => {
    // Launched away from the cat, at least BOUNCE_MIN_PX_PER_S; after that it keeps
    // its momentum and bounces off the screen's edges like a pinball.
    let { pos, velocity } = state ?? {
      pos: real,
      velocity: (() => {
        const away = direction(cat, real, roll * 2 * Math.PI);
        return { x: away.x * BOUNCE_MIN_PX_PER_S, y: away.y * BOUNCE_MIN_PX_PER_S };
      })(),
    };
    const seconds = dt / 1000;
    let x = pos.x + velocity.x * seconds;
    let y = pos.y + velocity.y * seconds;
    const maxX = Math.max(viewport.width - 1, 0);
    const maxY = Math.max(viewport.height - 1, 0);
    let vx = velocity.x;
    let vy = velocity.y;
    if (x < 0) [x, vx] = [-x, Math.abs(vx)];
    if (x > maxX) [x, vx] = [2 * maxX - x, -Math.abs(vx)];
    if (y < 0) [y, vy] = [-y, Math.abs(vy)];
    if (y > maxY) [y, vy] = [2 * maxY - y, -Math.abs(vy)];
    pos = clampToViewport({ x, y }, viewport);
    velocity = { x: vx, y: vy };
    return { look: restingLook(pos), state: { pos, velocity } };
  },
};

export const axisLock: Effect = {
  id: 'axis-lock',
  name: 'Axis lock',
  description: 'Your cursor moves only sideways, or only up and down, for 5 seconds.',
  durationMs: 5000,
  step: ({ previous, delta, roll, viewport }) => {
    const horizontal = roll < 0.5;
    return {
      look: restingLook(
        clampToViewport(
          horizontal
            ? { x: previous.x + delta.x, y: previous.y }
            : { x: previous.x, y: previous.y + delta.y },
          viewport
        )
      ),
    };
  },
};

/** What a strengthened effect carries between frames: the effect's own state and look. */
type Strengthened<S> = { inner: S | undefined; look: CursorLook | null };

/**
 * The same effect, `factor` times stronger: it lasts that much longer (within
 * MAX_EFFECT_MS), blurs and grows or shrinks the cursor that much more, and, for an
 * effect that draws the cursor at an offset from the real pointer (`amplify:
 * 'offset'`), moves it that much further (decoys too). An effect that places the
 * cursor elsewhere keeps its path: freeze stays frozen, orbit circles the cat. The
 * effect itself still sees its own, unstrengthened previous look, so one that
 * builds on it does not compound. An angry cat attacks with this (cat-engine.ts).
 */
export function strengthen<S>(effect: Effect<S>, factor: number): Effect<Strengthened<S>> {
  return {
    id: effect.id,
    name: effect.name,
    description: effect.description,
    amplify: effect.amplify,
    durationMs: Math.min(Math.round(effect.durationMs * factor), MAX_EFFECT_MS),
    step(input) {
      const own = input.state;
      const frame = effect.step({
        ...input,
        previous: own?.look ?? input.previous,
        state: own?.inner,
      });
      const { look } = frame;
      const away = (point: Vec): Vec =>
        effect.amplify !== 'offset'
          ? point
          : clampToViewport(
              {
                x: input.real.x + (point.x - input.real.x) * factor,
                y: input.real.y + (point.y - input.real.y) * factor,
              },
              input.viewport
            );
      return {
        look: {
          ...look,
          ...away(look),
          blur: look.blur * factor,
          scale: look.scale ** factor,
          ...(look.decoys ? { decoys: look.decoys.map(away) } : {}),
        },
        state: { inner: frame.state, look },
      };
    },
  };
}
