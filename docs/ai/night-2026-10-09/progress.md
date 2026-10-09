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
