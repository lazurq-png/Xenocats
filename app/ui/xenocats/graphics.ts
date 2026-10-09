// Survival's Graphics setting: full, or light. Light drops what costs the most to draw
// on a weak machine (the glows, the columns of light where a cat went home) and draws
// the canvas at one pixel to a pixel, however sharp the screen. It changes nothing in
// the simulation. Full is the default; a run that measures the machine below the frame
// floor in its first seconds switches to light once and says so (the choice stays the
// player's to change back).

export type Graphics = 'full' | 'light';

/** A stored setting; anything else (missing, corrupt) is full. */
export const parseGraphics = (raw: string | null): Graphics => (raw === 'light' ? 'light' : 'full');

/** The pixel ratio the canvas is drawn at: the screen's, or 1 in light graphics. */
export const pixelRatioFor = (graphics: Graphics, devicePixelRatio: number): number =>
  graphics === 'light' ? 1 : Math.max(devicePixelRatio || 1, 1);

/** The machine is judged on the frames from this long into a run (the start-up frames are skipped)... */
export const AUTO_JUDGE_FROM_MS = 1500;
/** ...over at least this long (a mean, not a single hitch)... */
export const AUTO_WINDOW_MS = 2000;
/** ...and only until this long into the run. */
export const AUTO_JUDGE_UNTIL_MS = 9000;
/** Frames the mean needs behind it before it is believed. */
export const AUTO_MIN_FRAMES = 30;

/**
 * Whether a run should switch itself to light graphics now: full is set, it has not
 * done so before, it is early in the run, and the mean frame rate over the judging
 * window (frames counted from `AUTO_JUDGE_FROM_MS`: `windowFrames` of them in
 * `windowMs`) is below the frame guard's floor. A mean, so one stalled frame on a good
 * machine does not tip it: the switch is for good.
 */
export function shouldGoLight(o: {
  graphics: Graphics;
  switchedBefore: boolean;
  runMs: number;
  windowMs: number;
  windowFrames: number;
  floorFps: number;
}): boolean {
  if (o.graphics !== 'full' || o.switchedBefore) return false;
  if (o.runMs > AUTO_JUDGE_UNTIL_MS) return false;
  if (o.windowMs < AUTO_WINDOW_MS || o.windowFrames < AUTO_MIN_FRAMES) return false;
  return o.windowFrames / (o.windowMs / 1000) < o.floorFps;
}
