// The pointer while the page holds pointer lock (Fight a cat). The browser then
// hides the system pointer and reports only how far the mouse moved, so the game
// keeps the pointer's position itself, and a cat's attack moves that position, not
// a drawing laid over it: when the effect ends, the pointer stays where the effect
// left it instead of snapping back. No DOM and no clock, like cursor-controller.ts,
// whose effect stepping it reuses.

import { createCursorController } from './cursor-controller';
import {
  type CursorLook,
  type Effect,
  type Size,
  type Vec,
  clampToViewport,
  restingLook,
} from './effects';
import type { Random } from './random';

export type LockedPointer = ReturnType<typeof createLockedPointer>;

export function createLockedPointer(options: { viewport: Size; start: Vec; random: Random }) {
  const controller = createCursorController({ viewport: options.viewport, random: options.random });
  let viewport = options.viewport;
  /** Where the mouse alone has taken the pointer: the effect's input. */
  let moved = clampToViewport(options.start, viewport);
  let look: CursorLook = restingLook(moved);
  let wasActive = false;
  controller.pointerMove(moved);

  return {
    /** The mouse moved by (dx, dy): `movementX` / `movementY` under pointer lock. */
    move(dx: number, dy: number) {
      moved = clampToViewport({ x: moved.x + dx, y: moved.y + dy }, viewport);
      controller.pointerMove(moved);
    },

    resize(size: Size) {
      viewport = size;
      controller.resize(size);
      moved = clampToViewport(moved, viewport);
      controller.pointerMove(moved);
    },

    /** Starts `effect` from a cat at `cat`. False while another effect still runs. */
    attack(effect: Effect, cat: Vec, now: number): boolean {
      return controller.attack(effect, cat, now);
    },

    activeEffectId(now: number): string | null {
      return controller.activeEffectId(now);
    },

    /** Advances one frame; returns where the pointer is and how it looks. */
    frame(now: number): CursorLook {
      const active = controller.isBlocking(now);
      if (wasActive && !active) {
        // The effect is over: the pointer is where the effect put it.
        moved = clampToViewport({ x: look.x, y: look.y }, viewport);
        controller.pointerMove(moved);
      }
      wasActive = active;
      look = controller.frame(now);
      return look;
    },

    /** Where the pointer is: what clicks hit and what cats chase. */
    position(): Vec {
      return { x: look.x, y: look.y };
    },
  };
}
