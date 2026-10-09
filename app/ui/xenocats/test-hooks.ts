// Survival's test hooks, read from the page's URL (decisions.md, D30 and D46):
// `?seed=` fixes the run's random source, `?speed=` (up to 50) makes time pass
// that much faster, `?boss=` (seconds) brings a Mega Cat that early, besides the
// schedule's. Two more serve the speed benchmarks (tests/e2e/benchmark.spec.ts):
// `?fps=1` shows the frame time and cat count in the arena, and `?crowd=N` (up to
// 6000) wants N cats from the first second and gives the Keeper a late-game arsenal
// and Resolve that outlasts them. Anyone can set them; nothing is at stake in a
// single-player game, so each is only bounded: anything unusable reads as no hook at all.

import type { WeaponId } from './arsenal';

export type TestHooks = {
  seed: number;
  speed: number;
  boss: number | null;
  fps: boolean;
  crowd: number | null;
  /** Every xenocat is an elite (the elites' attacks are otherwise rare to see). */
  elite: boolean;
};

/** What `?crowd=` arms the Keeper with, each at the highest level: the evolved weapons. */
export const CROWD_ARSENAL: readonly WeaponId[] = [
  'infinite-laser',
  'forbidden-catnip-vacuum',
  'yarn-apocalypse',
  'banquet',
  'monsoon',
  'bottomless-saucer',
];

export const MAX_CROWD = 6000;

/** The hooks in a URL's query string (`location.search`); `freshSeed` when none is set. */
export function parseTestHooks(search: string, freshSeed: () => number): TestHooks {
  const params = new URLSearchParams(search);
  const seed = Number(params.get('seed'));
  const speed = Number(params.get('speed'));
  const boss = params.has('boss') ? Number(params.get('boss')) : NaN;
  const crowd = Number(params.get('crowd'));
  return {
    seed: Number.isInteger(seed) && seed > 0 ? seed : freshSeed(),
    speed: Number.isFinite(speed) && speed >= 1 ? Math.min(speed, 50) : 1,
    boss: Number.isFinite(boss) && boss >= 0 ? boss * 1000 : null,
    fps: params.get('fps') === '1',
    elite: params.get('elite') === '1',
    crowd: Number.isInteger(crowd) && crowd >= 1 ? Math.min(crowd, MAX_CROWD) : null,
  };
}
