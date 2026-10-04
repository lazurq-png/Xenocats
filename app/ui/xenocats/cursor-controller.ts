// The fake cursor's state machine, with no DOM and no clock of its own: callers pass
// the pointer position and the time in, so tests can drive it frame by frame.
//
// Without `stack`, one effect runs at a time and a second attack is refused until it
// ends (the games). With it (the page's cursor), cats attack at the same time: a new
// effect is drawn on top of those still running (as combos.ts `layer` does), each
// ending on its own; and one that has a combo with a running effect fuses with it
// into that combo instead.

import { combineLooks, findCombo } from './combos';
import {
  type CursorLook,
  type Effect,
  MAX_EFFECT_MS,
  type Size,
  type Vec,
  restingLook,
} from './effects';
import { type Random, createRandom, freshSeed } from './random';

type Attack = {
  effect: Effect;
  startedAt: number;
  start: Vec;
  cat: Vec;
  roll: number;
  /** The effect's own state from its previous frame. */
  state: unknown;
  /** What this effect drew on its previous frame, or null before its first. */
  look: CursorLook | null;
  /** When the previous frame of this attack ran, or null before its first. */
  lastFrameAt: number | null;
};

export type CursorController = ReturnType<typeof createCursorController>;

export function createCursorController(options: {
  viewport: Size;
  random?: Random;
  /** Cats attack at the same time: effects stack, and fuse into combos. */
  stack?: boolean;
}) {
  const random = options.random ?? createRandom(freshSeed());
  const stack = options.stack ?? false;
  let viewport = options.viewport;
  let real: Vec | null = null;
  /** False while the pointer is outside the page; the fake cursor then hides. */
  let present = false;
  let pendingDelta: Vec = { x: 0, y: 0 };
  let look: CursorLook = { ...restingLook({ x: 0, y: 0 }), visible: false };
  /** Oldest first: each is drawn on top of the ones before it. */
  let attacks: Attack[] = [];

  const running = (now: number) =>
    attacks.filter((attack) => now - attack.startedAt < attack.effect.durationMs);

  return {
    /** The real pointer moved to `point`. */
    pointerMove(point: Vec) {
      if (real) {
        pendingDelta = {
          x: pendingDelta.x + point.x - real.x,
          y: pendingDelta.y + point.y - real.y,
        };
      }
      real = point;
      present = true;
    },

    /** The pointer left the page (or the window lost focus). Hidden until it moves again. */
    pointerLeave() {
      present = false;
    },

    resize(size: Size) {
      viewport = size;
    },

    /**
     * Starts `effect` from a cat at `cat`. Returns false, and changes nothing,
     * before the pointer has been seen, or, without `stack`, while another effect
     * is active. With `stack`, an effect that has a combo with a running one
     * replaces it with that combo, started afresh.
     */
    attack(effect: Effect, cat: Vec, now: number): boolean {
      const duration = effect.durationMs;
      if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_EFFECT_MS) {
        // The page stays disturbed for the whole effect: an unbounded one never ends.
        throw new RangeError(`Effect "${effect.id}" must last 1–${MAX_EFFECT_MS} ms.`);
      }
      if (!real) return false;
      const active = running(now);
      if (active.length > 0 && !stack) return false;
      let started = effect;
      const partner = active.find((attack) => findCombo(attack.effect.id, effect.id));
      if (partner) {
        started = findCombo(partner.effect.id, effect.id)!.effect;
        active.splice(active.indexOf(partner), 1);
      }
      attacks = [
        ...active,
        {
          effect: started,
          startedAt: now,
          // Where the cursor is drawn now: a stacked effect starts from there.
          start: active.length > 0 ? { x: look.x, y: look.y } : real,
          cat,
          roll: random.next(),
          state: undefined,
          look: null,
          lastFrameAt: null,
        },
      ];
      return true;
    },

    /** True while an effect runs. */
    isActive(now: number): boolean {
      return running(now).length > 0;
    },

    /** Where the fake cursor was last drawn, or null before the pointer has been seen. */
    position(): Vec | null {
      return real ? { x: look.x, y: look.y } : null;
    },

    /** False while the pointer is outside the page (or the window is unfocused). */
    isPresent(): boolean {
      return present;
    },

    /** The running effect's id; stacked ones joined by "+", oldest first. Null if none. */
    activeEffectId(now: number): string | null {
      const active = running(now);
      return active.length > 0 ? active.map((attack) => attack.effect.id).join('+') : null;
    },

    /** Advances one frame and returns how the fake cursor should look. */
    frame(now: number): CursorLook {
      const delta = pendingDelta;
      pendingDelta = { x: 0, y: 0 };
      if (!real) return look;

      // Ended effects drop out; the cursor snaps back onto what is left (or the
      // real pointer, when nothing is).
      attacks = running(now);
      let drawn: CursorLook | null = null;
      for (const attack of attacks) {
        // Each effect sees the cursor where the effects under it put it.
        const under = drawn ? { x: drawn.x, y: drawn.y } : real;
        const result = attack.effect.step({
          real: under,
          delta,
          previous: attack.look ?? drawn ?? look,
          start: attack.start,
          cat: attack.cat,
          elapsed: Math.max(now - attack.startedAt, 0),
          dt: attack.lastFrameAt === null ? 0 : Math.max(now - attack.lastFrameAt, 0),
          viewport,
          roll: attack.roll,
          state: attack.state,
        });
        attack.state = result.state;
        attack.look = result.look;
        attack.lastFrameAt = now;
        drawn = drawn ? combineLooks(drawn, result.look) : result.look;
      }
      look = drawn ?? restingLook(real);
      return present ? look : { ...look, visible: false, decoys: undefined };
    },
  };
}
