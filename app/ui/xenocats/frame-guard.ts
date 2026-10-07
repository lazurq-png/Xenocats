// The Survival arena's frame-rate guard: the game measures how long its frames
// take, and stops adding cats while the frame rate is below a floor, so a weak
// machine gets fewer cats rather than a slideshow. It starts adding them again once
// the rate is back above a higher mark, so it does not flicker on and off at the
// floor. Pure: frame times are passed in.

export type FrameGuardConfig = {
  /** Below this many frames a second, no new cat comes. */
  floorFps: number;
  /** Cats come again once the rate is back above this. */
  resumeFps: number;
  /** How much each new frame counts in the running average (0–1). */
  smoothing: number;
};

export type FrameGuard = ReturnType<typeof createFrameGuard>;

export function createFrameGuard(config: FrameGuardConfig) {
  let averageMs: number | null = null;
  let allowing = true;
  return {
    /** Records how long a frame took, ms. */
    record(frameMs: number) {
      if (!(frameMs > 0) || !Number.isFinite(frameMs)) return;
      averageMs =
        averageMs === null ? frameMs : averageMs + (frameMs - averageMs) * config.smoothing;
      const fps = 1000 / averageMs;
      if (allowing && fps < config.floorFps) allowing = false;
      else if (!allowing && fps > config.resumeFps) allowing = true;
    },
    /** Frames a second, smoothed; null before the first frame. */
    fps: () => (averageMs === null ? null : 1000 / averageMs),
    /** Whether new cats may come. */
    allowsSpawning: () => allowing,
  };
}
