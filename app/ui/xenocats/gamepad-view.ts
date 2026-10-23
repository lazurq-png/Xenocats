// Survival's controllers in the browser (gamepad.ts says what their state means).
// The browser does not tell when a pad's buttons change, so once a pad is connected
// they are read every frame until none is; with no pad, nothing runs.

import { type RefObject, useEffect, useRef } from 'react';
import type { Vec } from './effects';
import { type PadAction, createPadReader } from './gamepad';

export type PadState = {
  /** Player 1's walk, and player 2's (zero without a pad). */
  walks: readonly [Vec, Vec];
  /** How many pads are connected (two at most count). */
  pads: number;
};

const NONE: PadState = {
  walks: [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ],
  pads: 0,
};

/**
 * Reads the controllers while any is connected: their walks in the returned ref (the
 * game loop reads it each frame), and each button press, as it comes, to `onPress`
 * (the latest one given), with the player whose pad it was and how many pads there are.
 */
export function useGamepads(
  onPress: (player: number, action: PadAction, pads: number) => void
): RefObject<PadState> {
  const state = useRef<PadState>(NONE);
  const handler = useRef(onPress);
  useEffect(() => {
    handler.current = onPress;
  });
  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
    const reader = createPadReader();
    let frame = 0;
    const poll = () => {
      let list: (Gamepad | null)[] = [];
      try {
        list = Array.from(navigator.getGamepads());
      } catch {
        // Kept from the page (a permissions policy): no pads, then.
      }
      const read = reader.read(list);
      state.current = { walks: read.walks, pads: read.pads };
      if (read.presses.length > 0) markPadInput();
      for (const press of read.presses) handler.current(press.player, press.action, read.pads);
      frame = read.pads > 0 ? requestAnimationFrame(poll) : 0;
    };
    const start = () => {
      if (frame === 0) frame = requestAnimationFrame(poll);
    };
    window.addEventListener('gamepadconnected', start);
    // A mouse, a finger or a key takes over again: focus shows as the browser decides.
    window.addEventListener('pointerdown', clearPadInput, true);
    window.addEventListener('keydown', clearPadInput, true);
    // One look now, for a pad already connected (it stops at once if there is none).
    start();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('gamepadconnected', start);
      window.removeEventListener('pointerdown', clearPadInput, true);
      window.removeEventListener('keydown', clearPadInput, true);
      clearPadInput();
    };
  }, []);
  return state;
}

/**
 * A controller moves focus by script, which the browser does not count as a reason to
 * show it (:focus-visible is for keys): the arrow keys showed what was chosen, the d-pad
 * moved the same focus unseen. While a pad works the menus the page is marked, and
 * global.css rings whatever has focus.
 */
function markPadInput() {
  document.documentElement.dataset.input = 'pad';
}
function clearPadInput() {
  delete document.documentElement.dataset.input;
}

/**
 * A menu worked with a pad, as the arrow keys and Enter work it: the d-pad moves focus
 * between its enabled controls (round at the ends), and A presses the one in focus (or,
 * with none in focus, puts it on the first).
 */
export function menuPress(container: HTMLElement | null, action: PadAction) {
  if (!container) return;
  const controls = Array.from(
    container.querySelectorAll<HTMLElement>('button, input, select, a[href]')
  ).filter((el) => !(el as HTMLButtonElement).disabled);
  if (controls.length === 0) return;
  const at = controls.indexOf(document.activeElement as HTMLElement);
  if (action === 'confirm') {
    if (at >= 0) controls[at].click();
    else controls[0].focus();
    return;
  }
  const step =
    action === 'down' || action === 'right' ? 1 : action === 'up' || action === 'left' ? -1 : 0;
  if (step === 0) return;
  const next = at < 0 ? (step > 0 ? 0 : controls.length - 1) : at + step;
  controls[(next + controls.length) % controls.length].focus();
}
