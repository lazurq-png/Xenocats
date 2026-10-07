// Survival's test hooks, read from the page's URL (decisions.md, D30 and D46):
// `?seed=` fixes the run's random source, `?speed=` (up to 50) makes time pass
// that much faster, `?boss=` (seconds) brings a Mega Cat that early, besides the
// schedule's. Anyone can set them; nothing is at stake in a single-player game, so
// each is only bounded: anything unusable reads as no hook at all.

export type TestHooks = { seed: number; speed: number; boss: number | null };

/** The hooks in a URL's query string (`location.search`); `freshSeed` when none is set. */
export function parseTestHooks(search: string, freshSeed: () => number): TestHooks {
  const params = new URLSearchParams(search);
  const seed = Number(params.get('seed'));
  const speed = Number(params.get('speed'));
  const boss = params.has('boss') ? Number(params.get('boss')) : NaN;
  return {
    seed: Number.isInteger(seed) && seed > 0 ? seed : freshSeed(),
    speed: Number.isFinite(speed) && speed >= 1 ? Math.min(speed, 50) : 1,
    boss: Number.isFinite(boss) && boss >= 0 ? boss * 1000 : null,
  };
}
