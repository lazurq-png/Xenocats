// Steps a Survival arena in a loop that cannot hang. `arena.step()` returns without
// moving the clock while a level-up's choice waits or the run is over, so a bare
// `while (a.state().time < N) a.step(still)` would spin for ever, and Vitest's
// timeout cannot interrupt synchronous code. These throw instead.

import type { Arena } from '@/app/ui/xenocats/arena';

const still = { x: 0, y: 0 };

/** More iterations than any test here needs (5 minutes at 60 steps a second is 18 000). */
const MAX_STEPS = 100_000;

/**
 * Runs `step` (by default a step standing still) while `going()` holds. Throws if an
 * iteration neither moves the arena's clock nor answers a waiting choice, or after
 * `maxSteps` iterations.
 */
export function stepWhile(
  a: Arena,
  going: () => unknown,
  step: () => void = () => a.step(still),
  maxSteps = MAX_STEPS
): void {
  for (let n = 0; going(); n++) {
    if (n >= maxSteps) {
      throw new Error(`the arena loop ran ${maxSteps} steps (${a.state().time} ms) without ending`);
    }
    const time = a.state().time;
    const offer = a.choices();
    step();
    // Choosing does not move the clock: an iteration that answered (or changed) the
    // offer has done something.
    if (a.state().time === time && (offer === null || a.choices() === offer)) {
      const { status } = a.state();
      const waits = a.choices() ? 'a level-up choice waits' : 'no choice waits';
      throw new Error(`an arena step did not move the clock from ${time} ms (${status}, ${waits})`);
    }
  }
}

/** Runs `step` until the arena's clock reaches `ms` (see `stepWhile`). */
export function stepTo(a: Arena, ms: number, step?: () => void): void {
  stepWhile(a, () => a.state().time < ms, step);
}
