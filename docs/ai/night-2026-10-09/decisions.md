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

## T7 — choose how long a run lasts

**D13 — Acceptance criteria (derived).** (a) The lobby offers Run length 5 / 10 / 15 minutes, 5 by default, remembered in `localStorage` (`xenocats:survival:v1:length`), keyboard-reachable radios with a visible label, on desktop and touch; (b) 5 minutes is the game unchanged (same goal, bosses at 2:00 and 4:00, identical seeded run: unit test); (c) 10 and 15: the crowd stays at the 5:00 peak, cats arriving after 5:00 are tougher, a Mega Cat every two minutes, the Matriarch at the chosen time; (d) HUD, results and pause menu show the length; (e) the best time is per length, the old key being the 5-minute best; (f) unit tests on the simulation, e2e that 10 minutes survives a reload and the HUD shows `/ 10:00`.

**D14 — The toughness curve.** `ARENA_CONFIG.toughness`: from 5:00, each full minute adds **15% to a cat's Homesickness limit** and **2% to its speed** (speed capped at ×1.3), applied to a cat when it arrives (xenocats, varieties and Mega Cats alike). So a cat arriving at 10:00 needs 1.75× the Homesickness and moves 1.10× as fast as at 5:00; at 15:00, 2.5× and 1.20×. A cat already on the field keeps what it arrived with. Nothing changes at or before 5:00 (the factor is exactly 1), which keeps the 5-minute balance tests unchanged. The crowd needs no change: `catsWanted` already stays at its last escalation point (6000) past 5:00; the frame guard still caps it on a weak machine.

**D15 — Where the length lives.** `RUN_LENGTHS`, `parseLength`/`readLength`/`writeLength`/`subscribeLength` and the per-length best are in `arena-storage.ts` beside the aim setting (same pattern, in-memory fallback when storage is blocked); `runLengthConfig(minutes)` in `arena.ts` builds the goal and boss times (every 2:00 before the goal). A run keeps the length it started with (`lengthRef`), so changing the radios (disabled while a run lasts) cannot change it. The `?boss=` hook adds its boss to that run's bosses. The lobby sentence "Last five minutes" became "Last for the whole run length"; the "Longest survived" line now says its length; the existing e2e expectation of that line was updated for the 5-minute text.

**D16 — Reviewer's finding (T7), fixed.** The simulation keeps stepping after 5:00 in a five-minute run, until the Matriarch reaches him (about 10 s), so cats arriving then got a (tiny) toughness. `toughen()` now returns at once when the run's goal is not past `toughness.fromMs`, so a five-minute run is exactly as before; a test steps a five-minute run to 5:30 and compares limits and speeds (it fails without the guard). D14's "exactly 1 at or before 5:00" was true but not enough.

## T8 — elites are rarer, and attack when a player comes close

**D17 — Acceptance criteria (derived).** (a) Elites about a third as common (xenocat `eliteShare` 0.4 → 0.13); (b) an elite near a Keeper winds up an attack drawn from its xenocat's effect, with a visible wind-up (a telegraph drawn on the canvas, and `data-windups` / `data-windups-begun` on the play area), then a cooldown; touching it still lays its effect; (c) every attack lands where the Keeper was when the wind-up began, so one who moves out of the shape is not hit; (d) unit tests: the elite share over a seeded run, out of range never attacks, in range winds up then attacks, a Keeper who moves away is not hit; (e) e2e: a seeded run with an elite shows a wind-up.

**D18 — The numbers.** `ARENA_CONFIG.cats.eliteShare` 0.13 (0.4 / 3 = 0.133, rounded down; measured 9–17% over a seeded 3-minute, 300+ xenocat run). `eliteAttack`: a blast or a line begins when an elite is within **300 px** of a Keeper (the smallest screen shows at least 640 px across, so well inside it); wind-up **900 ms**, cooldown **3.5 s** (the first attack may begin as soon as the elite is in range). The elite stands still from the start of its wind-up until the attack has landed. Shapes, from the effect's kind (`attackShapeOf`): **ring** round the elite (freezes and slows: radius 130; the pulls, `push toward`: radius 200; it begins only once a Keeper is inside it), **blast** at the Keeper's position when the wind-up began (pushes away/down/fixed, teleport, jitter: radius 70), **line** from the elite through that position (reverse, axis lock and the veils: 330 long, 44 wide). A Keeper's body counts half the hero's reach (15 px) beyond the shape's edge. A hit lays the effect as a touch does (`afflict`: it does nothing while another effect lasts), and takes no Resolve: only touching an elite drains. In co-op every standing Keeper in the shape is hit; the aim is the nearest Keeper's. Swarm kittens flagged "elite" for their chest never attack (only xenocats do).

**D19 — Test hook `?elite=1`.** With elites at 13% and a still Keeper dying within a minute, a seeded run rarely reaches a wind-up; `?elite=1` makes every xenocat an elite for the run and, like `?crowd=`, switches the frame guard off (with it on, a busy machine stopped the xenocats' visits, and the same seed gave runs that never saw an elite: found as a 2-in-4 failure with four browsers at once). The e2e watches `data-windups-begun` from inside the page (`waitForFunction`) because the run is over in seconds. `windUps` and `windUpsBegun` are in `state()`; `telegraphs()` gives the view what to draw. The wind-up's drawing is a filling translucent shape; not seen (built, not seen).

**D20 — Balance.** The seeded balance tests of the 5-minute run needed no change (the whole `tests/unit/xenocats` suite passes with the new share and attacks).

**D21 — Reviewer's findings (T8).** (1) Medium, fixed: a ring begins with the Keeper inside it, even beside the elite, and the first numbers (radii 130/200, wind-up 900 ms) could not be left from adjacent at 210 px/s with any reaction time. Rings are now smaller (freeze/slow 110, pull 140) with a longer wind-up (`ringWindUpMs` 1100); a unit test makes the Keeper wait a third of a second beside the elite, then walk out, for a freeze ring and a pull ring, and fails with the first numbers. A blast needs 85 px and a line 37 px of clearance, so they were fine. (2) Low, fixed: `elite-attack.hits` counts only attacks that took (`afflict` returns whether it did). (3) Low: the economy (elites drop a 6-value gem and a chest) shrinks with the share; measured below. (4) Low, accepted: the e2e watches `data-windups-begun`, not the wind-up's duration (the HUD refreshes every 150 ms real time, which a 0.9 s wind-up at `speed=8` can fall between); the telegraph drawing is exercised by the e2e run (it draws while the test runs) but not seen.

**D22 — The economy, measured (finding 3).** Seeds 1–3, the default 5-minute config, a Keeper walking a circle with 1e9 Resolve, taking the first choice at every level-up, 300 s of game time. Elite share 0.4 → 0.13: level reached 22 / 28 / 22 → 25 / 30 / 24 (no loss: level comes from the plain cats' gems); chests opened 11 / 11 / 13 → 8 / 10 / 13 (fewer by 0–3, since elites' chests are only part of them: swarms, bosses and visitors give the rest); wind-ups begun 16 / 13 / 10 → 3 / 6 / 2 (a Keeper who keeps walking meets few). Accepted: pacing is unchanged and chests are a little rarer.
