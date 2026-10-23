// Survival with a controller (the browser's Gamepad API, in its "standard" layout):
// what a pad's state means for the game. Pure: it reads plain snapshots of the pads,
// so it is tested in Node; gamepad-view.ts polls the browser for them.
//
// The left stick walks (as far as it is pushed, never faster than a key), or the
// d-pad does (as the WASD keys would). The buttons work the menus: A picks, B goes
// back, Y rerolls a level-up, X skips it, Start pauses and resumes, and the d-pad or
// a flick of the stick moves between the buttons. Two pads in co-op: the first
// connected is player 1's, the second player 2's.

import type { Vec } from './effects';
import { walkDirection } from './walking';

/** What is read of a pad: as `Gamepad` has it, and no more. */
export type PadSnapshot = {
  index: number;
  connected: boolean;
  axes: readonly number[];
  buttons: readonly { pressed: boolean }[];
};

/** What a pad's buttons do in the menus. */
export type PadAction =
  'confirm' | 'back' | 'pause' | 'reroll' | 'skip' | 'up' | 'down' | 'left' | 'right';

/** The standard layout's buttons, by action. */
export const PAD_BUTTONS: Readonly<Record<PadAction, readonly number[]>> = {
  confirm: [0],
  back: [1],
  skip: [2],
  reroll: [3],
  // Start, and Select/Back too: both are "the menu" on one pad or another.
  pause: [9, 8],
  up: [12],
  down: [13],
  left: [14],
  right: [15],
};

/** The middle of the stick that walks nowhere (its drift), as a share of its reach. */
export const STICK_DEAD_ZONE = 0.2;
/** A stick pushed this far counts as a d-pad press in the menus. */
export const STICK_FLICK = 0.6;

/**
 * The way a pad walks the character: the left stick, out of its dead zone, scaled so
 * the edge of the dead zone is a standstill and the rim full speed (at most 1, as a
 * key); else the d-pad, as the WASD keys; else nowhere.
 */
export function padWalk(pad: PadSnapshot | null, deadZone = STICK_DEAD_ZONE): Vec {
  if (!pad) return { x: 0, y: 0 };
  const x = pad.axes[0] ?? 0;
  const y = pad.axes[1] ?? 0;
  const length = Math.hypot(x, y);
  if (length > deadZone) {
    const strength = Math.min((length - deadZone) / (1 - deadZone), 1);
    return { x: (x / length) * strength, y: (y / length) * strength };
  }
  const pressed = (i: number) => pad.buttons[i]?.pressed === true;
  const keys: string[] = [];
  if (pressed(12)) keys.push('KeyW');
  if (pressed(13)) keys.push('KeyS');
  if (pressed(14)) keys.push('KeyA');
  if (pressed(15)) keys.push('KeyD');
  return keys.length > 0 ? walkDirection(keys) : { x: 0, y: 0 };
}

/** The actions a pad holds down now (the stick flicked counts as the d-pad). */
export function padHeld(pad: PadSnapshot): Set<PadAction> {
  const held = new Set<PadAction>();
  for (const [action, buttons] of Object.entries(PAD_BUTTONS) as [PadAction, number[]][]) {
    if (buttons.some((i) => pad.buttons[i]?.pressed === true)) held.add(action);
  }
  const x = pad.axes[0] ?? 0;
  const y = pad.axes[1] ?? 0;
  if (Math.abs(x) >= STICK_FLICK && Math.abs(x) >= Math.abs(y)) held.add(x > 0 ? 'right' : 'left');
  if (Math.abs(y) >= STICK_FLICK && Math.abs(y) > Math.abs(x)) held.add(y > 0 ? 'down' : 'up');
  return held;
}

/** What was pressed since: held now and not before (a held button presses once). */
export function newlyPressed(
  before: ReadonlySet<PadAction>,
  now: ReadonlySet<PadAction>
): PadAction[] {
  return [...now].filter((action) => !before.has(action));
}

/** The connected pads in the order they came (by index): player 1's first, at most two. */
export function padsByPlayer(pads: readonly (PadSnapshot | null)[]): PadSnapshot[] {
  return pads
    .filter((p): p is PadSnapshot => p !== null && p.connected)
    .sort((a, b) => a.index - b.index)
    .slice(0, 2);
}

/**
 * Reads the pads once a frame and remembers what each held, so a press is seen once.
 * `read` returns each player's walk (player 1's, player 2's), and the presses since the
 * last read, each with its player (0 or 1).
 */
export function createPadReader() {
  const before = new Map<number, Set<PadAction>>();
  return {
    read(pads: readonly (PadSnapshot | null)[]) {
      const players = padsByPlayer(pads);
      const presses: { player: number; action: PadAction }[] = [];
      const seen = new Set<number>();
      players.forEach((pad, player) => {
        seen.add(pad.index);
        const held = padHeld(pad);
        for (const action of newlyPressed(before.get(pad.index) ?? new Set(), held)) {
          presses.push({ player, action });
        }
        before.set(pad.index, held);
      });
      for (const index of [...before.keys()]) if (!seen.has(index)) before.delete(index);
      return {
        walks: [padWalk(players[0] ?? null), padWalk(players[1] ?? null)] as const,
        pads: players.length,
        presses,
      };
    },
  };
}
