# Progress — night run 2026-10-09

Append-only. One entry per task, appended when it ends; the morning report is inserted at the top.

## Run start

- Goal: "Sunday 20:00" → Deadline: 2026-10-11 20:00
- Started 2026-10-09 15:53 (Europe/Stockholm, `W. Europe Standard Time`). Budget at start: 14,900,000 tokens.
- Limits (plan): information only; the run spans a weekend and will meet usage limits. Timer job armed (cron `7,27,47 * * * *`).
- Environment: node v24.19.0, npm 11.17.0, node_modules present, Chromium present, .env present. Remote origin reachable; no `Nightrun` or `2026-10-09-*` branches there.
- Pre-existing uncommitted changes: none (apart from the untracked plan).
- Baseline: pending.

## Baseline (2026-10-09 16:10)

All green, nothing red: lint exit 0 (0 warnings, saved in `lint-baseline.txt`); `next typegen` + `tsc` exit 0; `npm test` 44 files passed / 1 skipped, 695 tests passed / 24 skipped, 1m41s; database tests `DATABASE_TESTS=1` 24 passed, 0 skipped, 6s; `npm run build` exit 0, 36s (in the gate); `npm run test:e2e` (next dev) 133 passed, 3m31s; `E2E_SERVER=start npm run test:e2e` 133 passed, 2m10s. Side effect `playwright/.auth/demo-user.json` restored with `git checkout --` (a tool artefact, not task work).

## T1 — Browser tests can pause the cat attacks, and only they can (completed)

- Branch `2026-10-09-t1-pause-cats`, base `903da06`. Started 2026-10-09 16:04 (budget 14.89M tokens), completed 16:50 (14.83M).
- **What the code does.** `app/ui/xenocats/cat-layer.tsx`: with the window property `__xenocatsPaused === true` at page load (read once), the cat layer starts no loop (no cat, no effect, no poking) and refuses `summon`. Nothing in the app sets it. `tests/e2e/fixtures.ts`: the `test` every spec now imports, with a `catsPaused` option (default true) that injects the flag with `addInitScript`. `playwright.config.ts`: a `cat-attacks` project (cats, cats-link, pet-cat, touch, intensity, field-guide, sound, keyboard, security-headers; unpaused) which every other group depends on. `E2E_NO_CAT_DEPS=1` drops that dependency for a run of named specs (a file filter still runs dependencies in full, 73 tests measured; `--no-deps` would drop the login setup too); `scripts/affected-tests.mjs` and CI's dev-server job use it. Docs (`CLAUDE.md` §9, `.claude/rules/testing.md`) say so. Tests: cat-layer unit tests (paused refuses summon and spawns nothing; unpaused control), an affected-tests unit test, and a `dashboard.spec.ts` e2e (chaos on the paused dashboard shows no cat after 15 s of page time). Also: `puppets.test.ts` "never leaves the viewport" gets a 20 s timeout (failed at 5.2 s in a loaded full run, also on unmodified main).
- **What it brings.** The browser tests of invoices, customers, login and the rest no longer have a cat land on them at random, so they stop being timing-sensitive to cat attacks; the specs that test the cats run first with them on.
- Decisions: D1–D7.
- **Verification (all observed).** prettier on changed files (clean apart from `CLAUDE.md`, `.claude/rules/testing.md`, `ci.yml`, which were not clean before either); `npm run lint` exit 0, 0 warnings (baseline 0); `next typegen` + `tsc` exit 0; `npm test` 44 files passed/1 skipped, 698 passed/24 skipped; `DATABASE_TESTS=1` data tests 24 passed; `npm run build` exit 0; `npm run test:e2e` (dev) 134 passed, 3m14s (baseline 133, 3m31s); `E2E_SERVER=start` 134 passed, 2m10s (baseline 2m10s). The selector printed FULL (config change), so the full suites ran. Acceptance criteria: the pause and its refusal of summon are checked by command (unit + e2e); "no user can reach it" only by reading (and the reviewer's).
- **Reviewer:** Approve; three Low findings (demo-user.json churn restored and not committed; `E2E_NO_CAT_DEPS` now compared with `'1'`; a red `cat-attacks` holds back the other groups, by the plan's design, recorded in D6).
- Full-e2e time before/after: dev 3m31s → 3m14s, start 2m10s → 2m10s.
- Previous task CI: none yet.

## T9 — A yardstick for the game's speed on a weak machine (completed)

- Branch `2026-10-09-t9-benchmarks`, base `21e7f9c`. Started 2026-10-09 16:28 (budget 14.82M tokens), completed 17:05 (14.76M).
- **What the code does.** `tests/bench/arena-step.test.ts` + `vitest.bench.config.mts`: a seeded simulation benchmark (500, 2000, 6000 cats, six evolved weapons at level 8), printing median/p95/max ms per step; run with `npx vitest run -c vitest.bench.config.mts`, outside `npm test`. `tests/e2e/benchmark.spec.ts` (in the `survival` group, skipped unless `BENCH=1`): 20 s of a crowded run at 500 and 2000 cats under CDP CPU throttling ×4, printing fps, median/p95 frame time and frames over 50 ms. Two hooks in `test-hooks.ts`/`arena-view.tsx`: `?fps=1` (a frame-time and cat-count line in the arena, `survival-fps`) and `?crowd=N` (see D10). Unit tests on both hooks; e2e tests that `?fps=1` shows the line only when set and `?crowd=300` brings a crowd, the arsenal and no level-up.
- **What it brings.** Every later speed change can be measured before and after on the same seeded crowd, on this laptop or a throttled one, instead of by feel; the checkpoints compare against the baseline below.
- Decisions: D8–D12. How to run each benchmark: D9.
- **Baseline (idle PC, seed 7).** Simulation per step: 500 wanted (483 cats) median 0.397 ms, p95 0.708; 2000 (1979) 0.757 / 1.367; 6000 (5939) 2.232 / 3.573. Render, ×4 CPU, 20 s, two runs: 500 cats 26.6 / 27.1 fps, median 33.3 ms, p95 66.7, 78 / 87 frames over 50 ms; 2000 cats 13.9 / 14.1 fps, median 66.6 ms, p95 183.3, 157 / 160 frames over 50 ms.
- **Verification (observed).** prettier clean on changed files; `npm run lint` exit 0, 0 warnings; `tsc` exit 0; `vitest related` over the changed files and the affected-tests unit test passed; `npm run build` exit 0; selector printed FULL (playwright.config.ts), so `npm run test:e2e` on `next dev` 136 passed, 2 skipped (the benchmarks), 3m23s; `E2E_SERVER=start` 136 passed, 2 skipped, 2m30s. Acceptance: the hooks and the benchmark's runnability are checked by command; the numbers are single-machine.
- **Reviewer:** Approve; two Low findings, one accepted (a `?crowd=` run records best time like `?speed=` does), one fixed (`BENCH` compared with `'1'`, run-by-path note).
- Previous task CI (T1, merge `21e7f9c` on Nightrun): CI passed — https://github.com/lazurq-png/Xenocats/actions/runs/37944417369

## T7 — Choose how long a run lasts: 5, 10 or 15 minutes (completed)

- Branch `2026-10-09-t7-run-length`, base `43570c2`. Started 2026-10-09 16:51 (budget 14.75M tokens), completed 17:35 (14.70M). (T9's entry above says "completed 17:05"; its real clock time was about 16:50.)
- **What the code does.** `arena.ts`: `runLengthConfig(minutes)` (goal, and a Mega Cat every 2:00 before it), `ARENA_CONFIG.toughness` (from 5:00 each minute adds 15% Homesickness limit and 2% speed, speed capped ×1.3, to cats that arrive; none in a five-minute run), `state().goalMs`. `arena-storage.ts`: the stored run length (default 5, in-memory fallback) and the best time per length (the old key is the 5-minute best). `arena-view.tsx`: a "Run length" fieldset of three radios in the lobby (disabled during a run), the run keeps the length it started with, the HUD shows `/ 10:00`, the results show the length (and the goal text names it), the best line names its length. `pause-summary.tsx`: a "Run length" row. Also `tests/e2e/survival.spec.ts`: a new e2e, and the "Longest survived" expectation names its length. Unit tests: five minutes unchanged (same seeded run, same config, stays as it was after 5:00 until the Matriarch arrives), goal and bosses for 10 and 15, the Matriarch at the chosen time, cats tougher at 10:00 and capped speed, the crowd flat past 5:00, parse/keys/per-length bests.
- **What it brings.** A player who has beaten five minutes can now ask for ten or fifteen, with a crowd that stays at its peak, tougher cats and a Mega Cat every two minutes, and gets a best time for each length.
- Decisions: D13–D16. Questions: Q1 (a flaky co-op test noticed in the gate).
- **Verification (observed).** prettier clean; `npm run lint` exit 0, 0 warnings; `tsc` exit 0; `vitest related` 6 files / 197 tests passed; `arena.test.ts` 38 passed; `npm run build` exit 0; selector (12 specs, `E2E_NO_CAT_DEPS=1`): run 1 107 passed, 2 skipped, 1 failed (Q1, the co-op test), run 2 108 passed, 2 skipped, 0 failed; the failing test passed 4 of 4 alone. The seeded 5-minute balance tests are unchanged and pass. Not run in full (no full-suite point): `npm test`, the full e2e suites. UI: tested in a browser, not seen — what a human should look at: the lobby's Run length radios (spacing, touch size) and the pause menu row.
- **Reviewer:** Request Changes — one Medium (toughness applied in the seconds after 5:00 of a five-minute run, while the Matriarch walks in): fixed with a guard and a test that fails without it (D16); everything else checked fine.
- Previous task CI (T9, merge `43570c2` on Nightrun): CI passed — https://github.com/lazurq-png/Xenocats/actions/runs/37947324301. The `playwright/.auth/demo-user.json` churn that T9's commit carried by mistake is restored here.
