# Decisions

## T1 — browser tests can pause the cats

**D1 — Acceptance criteria (derived).** (a) With `window.__xenocatsPaused === true` at page load, the cat layer starts no loop (no cat on its own, no effect) and `summon()` returns false; (b) nothing in `app/` sets the flag, and there is no button, setting or stored value; (c) `tests/e2e/fixtures.ts` exports `test` with `catsPaused` (default true) which injects the flag via `addInitScript`; (d) every spec imports `test` from it; (e) the `cat-attacks` project runs first with `catsPaused: false` and every other group depends on it; (f) a unit test and an e2e test show the pause; (g) the testing docs say so.

**D2 — What "paused" covers.** The whole provider effect is skipped (resize listener, poke/pet handlers, sound unlock, frame loop) and `summon` is refused, not just the spawner. A summon on `/cats` is "a cat comes", so a spec that summons needs `cat-attacks`. The flag is read once in `useState`, so it cannot flip mid-page. The Survival arena has its own engine and does not use this provider, so it is untouched.

**D3 — Specs and their projects.** `cat-attacks` (unpaused, device Desktop Chrome, as before; `touch.spec.ts` keeps its Pixel 7 from its own `test.use`): `cats` (cat effects), `cats-link` (/cats summons), `pet-cat` (petting/poking), `touch` (summons on touch), `intensity` (chaos brings cats), `field-guide` (summons, met counts), `sound` (summons for sounds), `keyboard` (one test summons a cat with Enter), `security-headers` (one test summons a cat under the CSP). The last two also hold tests that do not need cats; a spec is in one group (CI checks it), so the whole file runs unpaused rather than splitting it. Paused group: `smoke`, `branding`, `dashboard`, `login-limit`, `change-password`, `cat-states`, `dashboard-range`, `customers`, `invoices` group, `survival`. The old `cats` and `sound` groups are gone into `cat-attacks`; `LOGGED_IN` now names `cat-attacks` (cats-link uses the demo user).

**D4 — Targeted runs: `--no-deps` is not enough.** Measured: `playwright test --list tests/e2e/dashboard.spec.ts` lists 73 `[cat-attacks]` tests too, so a file filter still runs the dependency project in full. `--no-deps` would also drop the `setup` project, and the logged-in specs need its session (signed with the run's throwaway `AUTH_SECRET`, so a session from an earlier run is invalid). So `playwright.config.ts` reads `E2E_NO_CAT_DEPS`: set, the groups do not wait for `cat-attacks` and keep `setup`. `scripts/affected-tests.mjs` prefixes it to a selection of specs (via `env` when it runs them) and leaves a FULL run alone; CI's dev-server job sets it for its three named specs. Repair-cycle runs of a single spec set it too. This deviates from the plan's "use `--no-deps`" for that reason.

**D5 — CI group list.** CI's "Every test file is in a group" step greps `GROUPS` in the config; it still works (each spec appears once). The ci.yml comment listing the groups was updated.

**D6 — Reviewer's findings.** (1) `playwright/.auth/demo-user.json` churn: a tracked file the tests rewrite; restored with `git checkout --` before staging, never committed. (2) `E2E_NO_CAT_DEPS` is compared with `'1'`: fixed. (3) A red `cat-attacks` project holds back every other group (Playwright skips dependents): by the plan's design ("the cat tests always run first"); the escape hatch is `E2E_NO_CAT_DEPS=1`.

**D7 — A pre-existing timeout, fixed with a limit.** `tests/unit/xenocats/puppets.test.ts` "the element never leaves the viewport, even flung by chaos" took 5.2–5.3 s inside a full `npm test` and timed out at the default 5 s. It failed identically on a stashed, unmodified tree (so not this task) but passed in the baseline run an hour earlier (87 s run, machine less busy), and passes alone in ~1 s. Gave that one test a 20 s limit; no assertion changed.

## T9 — a yardstick for the game's speed

**D8 — Acceptance criteria (derived).** (a) A seeded simulation benchmark: step cost with 500, 2000 and 6000 cats and a full late-game arsenal, median and p95 per step, as a table, not run by `npm test`; (b) a seeded in-browser render benchmark under CPU throttling, on demand, not in the gate: frames a second and long frames over 20 s of a crowded, effect-heavy run; (c) a hidden `?fps=1` hook showing frame time and cat count in the arena, bounded like the others; (d) first numbers in `progress.md`; how to run each in `decisions.md`.

**D9 — How to run them.**
- Simulation: `npx vitest run -c vitest.bench.config.mts` (`tests/bench/arena-step.test.ts`; a config of its own, so `npm test` and CI never run it; `disableConsoleIntercept` so the table prints). 900 warm-up steps, 600 measured, the Keeper walking a circle.
- Render: `BENCH=1 E2E_NO_CAT_DEPS=1 npx playwright test tests/e2e/benchmark.spec.ts` (in the `survival` group, skipped without `BENCH=1`, so the gate and CI skip it; serial, because two runs side by side measure each other; `BENCH_THROTTLE=4` is the default CPU slowdown through CDP `Emulation.setCPUThrottlingRate`). Prints one table row per crowd (500 and 2000): frames, fps, median and p95 frame time, frames over 50 ms.
- Run it on an idle machine, twice; the numbers below agree within a few percent run to run on this one.

**D10 — Two extra hooks.** The plan names `?fps=1`. Reaching "a crowded, effect-heavy run" at speed 1 needs the run to start there, so `?crowd=N` (whole number 1–6000, anything else is no hook) too: it wants N cats from the first second, gives the Keeper the six evolved weapons (`CROWD_ARSENAL`) at level 8, 1e9 Resolve, gems worth nothing and chests out of reach (no level-up stops the run), `arrivalShare: 40` (the arsenal sends cats home about as fast as they come; the default share left 109 of 500 on screen), and turns the frame guard off (under throttling it would stop the crowd arriving, which is the game's own defence, not what is being measured). The simulation benchmark gives the arena the same settings. Nothing is at stake in a single-player game, as for the other hooks.

**D11 — Why evolved weapons.** The heaviest weapons the game has today (web, gulp, bouncing yarn, spread, arcs, orbit): a late-game arsenal for the yardstick. Tasks 3–5 add weapons later; the checkpoint benchmark runs will show what they cost, and `CROWD_ARSENAL` stays as is so numbers stay comparable.

## Baseline numbers (2026-10-09, this PC, idle, seed 7)

Simulation, per step (`tests/bench/arena-step.test.ts`):

| wanted | cats | median ms | p95 ms | max ms |
| ------ | ---- | --------- | ------ | ------ |
| 500 | 483 | 0.397 | 0.708 | 1.913 |
| 2000 | 1979 | 0.757 | 1.367 | 1.78 |
| 6000 | 5939 | 2.232 | 3.573 | 5.23 |

Render, 20 s, CPU 4× slower (`tests/e2e/benchmark.spec.ts`), two runs each:

| crowd | cats | fps | median ms | p95 ms | frames > 50 ms |
| ----- | ---- | --- | --------- | ------ | -------------- |
| 500 | 466 / 495 | 26.6 / 27.1 | 33.3 | 66.7 | 78 / 87 |
| 2000 | 1991 / 1936 | 13.9 / 14.1 | 66.6 | 183.3 | 157 / 160 |

**D12 — Reviewer's findings (T9).** (1) A `?crowd=` run that reaches the time goal records a best time and milestones, like `?speed=50` or `?seed=` runs always have; accepted, as D10 says nothing is at stake in a single-player game, and left unchanged. (2) `BENCH=1` is now compared with `'1'`, and the spec says to run it by its path (other specs beside it would disturb the frames).
