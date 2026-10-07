# Progress — night run 2026-10-07

Append-only. One entry per task, appended when it ends; the morning report last.

## Run start

- Run branch: `night-2026-10-07`, cut from `main` at `4fb5f5c` (the plan is committed on `main`, in `89fb032`/`15cc54b`).
- Goal: "Thursday 08:30" → **Deadline: 2026-10-08 08:30** (Europe/Stockholm; machine time zone `W. Europe Standard Time`).
- Wall clock at start: 2026-10-07 14:21 (Wednesday).
- Session budget at start: 14,898,083 tokens. Reserve: 10% (1.49M) while another session can follow, 30% (4.47M) when final; ceiling 4% (596k).
- Limits (from the plan, information only): "The run cannot see the account's usage limit; if it runs out, the session pauses until the timer's next firing after it resets, and the per-task commit and push bound the loss. Last run lost about 7 of its 18 hours to such pauses."
- Environment: node v24.19.0, npm 11.17.0; `node_modules` present; Chromium present; `.env` present (existence only checked).
- Remote: `origin` = github.com/lazurq-png/Xenocats, reachable, no `night-2026-10-07*` branches.
- Pre-existing uncommitted changes: none.
- Timer: the human's `/loop 20m` (cron job `0151a2f2`, `*/20 * * * *`) is this run's timer; no other armed (§9.5).

### Baseline (§1.5), 14:22–14:35

| Check | Result | Time |
| ----- | ------ | ---- |
| `npm run lint` | exit 0, **0 warnings** (`lint-baseline.txt`) | 74 s |
| `npx next typegen && npx tsc --noEmit` | exit 0 | 42 s |
| `E2E_NO_DATABASE=1 npm test` (plan: until T1 merges) | exit 0 — 34 files passed, 1 skipped (`data.test.ts`); 484 tests passed, 17 skipped | 60 s |
| `npm run build` | exit 0 — **in the gate** | 15 s |
| `npm run test:e2e` (next dev) | exit 0 — 101 passed | 167 s |
| `E2E_SERVER=start npm run test:e2e` | exit 0 — 101 passed | 109 s |

Note: the first attempt was invalid. I stopped a background baseline to fix its exit codes (piped into `tail` without `pipefail`), but its child script kept running alongside the rerun; the two overlapped, and under that load `keyboard.spec.ts:129` ("every control on the dashboard pages has a name") timed out in `next dev`. The build and both e2e runs were then repeated alone (above), with no stray process left (`ps`, port 3100 checked). Not counted as a flake: the cause was the overlap.
Database reachable (the e2e global setup rebuilt `xenocats_test`).

## T1 — Database unit tests are opt-in (completed)

- Branch `night-2026-10-07-t1-db-tests-opt-in`, base `4fb5f5c`. Start 14:35 (budget 14,874,783); completed 14:42 (budget ~14,860,000).
- **What the code does**
  - `tests/unit/data.test.ts`: `databaseUrl()` returns no URL unless `DATABASE_TESTS` is exactly `1` (and still none with `E2E_NO_DATABASE`), so every block in the file skips and nothing connects. Header comment says so.
  - `.github/workflows/ci.yml`: the *build* job's "Database tests" step sets `DATABASE_TESTS: '1'`, so CI still runs them on its own database.
  - `CLAUDE.md` §9, `.claude/rules/testing.md`: describe the opt-in and the command to opt in.
- **Why it was added**: plan task 1 (resolves last run's Q6, option (a)): a plain `npm test` must never touch a database. D1 (`E2E_NO_DATABASE` still skips), D2 (opted-in path not run locally).
- **Verification**
  - prettier (LF-normalised, as runs 09-25 D3 / 10-01 D1): `data.test.ts`, `testing.md`, `ci.yml` exit 0; `CLAUDE.md` was already unformatted on the base, and its Prettier diff is unchanged in kind (the file's own `*emphasis*` style on the edited line).
  - `npm run lint` exit 0, 0 warnings (= baseline). `next typegen && tsc --noEmit` exit 0. `npm run build` exit 0.
  - `test:affected` selection: unit `vitest related tests/unit/data.test.ts`; e2e 0 specs.
  - With `POSTGRES_URL` pointed at a dead port (`127.0.0.1:1`, so no real database could be reached): no `DATABASE_TESTS` → 1 file skipped, 17 tests skipped; `DATABASE_TESTS=true` → skipped; `DATABASE_TESTS=1` → attempted `db.mjs reset`, `ECONNREFUSED 127.0.0.1:1` (the opt-in path is live). Criterion 1 checked by command; criterion 2 by CI (poll below); criterion 3 by reading.
  - Reviewer: approve, no findings; one observation → D3 / Q1.

## T2 — Each cat hits page elements the way it hits the pointer (completed)

- Branch `night-2026-10-07-t2-element-hits`, base `60801d2`. Start 14:43 (budget ~14,855,000); completed 15:21 (budget ~14,654,000). The first edits were made on the run branch before the task branch was cut (14:55); uncommitted, they carried over unchanged, and nothing was committed to the run branch.
- **What the code does**
  - `app/ui/xenocats/puppets.ts`: an element under attack no longer wanders or gets a "weird twist". Its effect runs on a pointer held still at the element's centre, and the element goes where the effect puts that pointer and looks as the cursor would (hidden, frosted, smoke = blur x3 + grey, shrunk, grown). It moves only if the attack moves a still pointer. The effect runs in the span its centre may cover (`span()`), so its box stays in the viewport (Pinball bounces it off the edges), and one already partly off screen is never pulled in or pushed further off. The level's `fling` scales only attacks that throw the pointer some way (`amplify: 'offset'`); the ones that put it somewhere (spiral, orbit, magnet, bounce) put the element there at every level. `release()` now sets the saved style before removing it, which fixes elements being left with `style=""` in Chromium (D8).
  - `app/ui/xenocats/page-hits.ts`: only target selection remains. `PAGE_HITS`, the CSS hit kinds, `applyHits`, `hitPage`, `hitText` and scrambled or swapped text are gone. Calm now has puppet settings too (half the throw, size within 0.5–1.6x) at its smaller reach.
  - `app/ui/xenocats/fake-cursor.tsx`: every intensity, and touch screens, hit the page through the puppets; touch screens run their own animation frames while a hit lasts.
  - `app/ui/global.css`: the CSS for the removed hit kinds and the text overlay is deleted; the page clipping while elements are displaced stays.
  - `app/ui/settings/cat-intensity.tsx`: calm and chaos descriptions match the new behaviour.
  - Tests: `tests/unit/xenocats/puppets.test.ts` holds the mapping table (all 20 cats and 6 combos) and checks every row (motion and look) against the engine, at normal; the attacks that put the pointer somewhere again at calm, in chaos and as a panel; every element inside the viewport in chaos for every effect; never pulled further off screen; exact revert. `page-hits.test.ts` keeps the selection tests (the `hitPage` cases now go through `pickTargets`); scramble, CSS-kind and push tests removed with the code. `fake-cursor.test.tsx`: calm Vanish hides in place, touch Jitter shakes. `tests/e2e/cats.spec.ts`: one test per cat that summons it and checks every element it touched is back exactly; Smoke Bombay's smoked elements stay where they were; Pinball Devon's elements are displaced over 100 px and stay inside the viewport. The calm test asserts a half-distance throw; the scrambled-text test is removed with the behaviour. `touch.spec.ts`: the touched button is thrown, then back exactly.
- **Why it was added**: plan task 2. The mapping table is D4; calm through the same engine D5; staying on screen D6; twists removed D7; the `style=""` fix D8; clicks unchanged D9 (Q2, a requirement not met); five cats now leave elements alone (Q3).
- **Verification** (gate run alone, 15:14–15:20; the selector printed FULL because of `global.css`, so every suite ran in full)
  - prettier (LF-normalised) on the 11 changed files: clean. `npm run lint` exit 0, 0 warnings (= baseline). `next typegen && tsc --noEmit` exit 0.
  - `npm test` (plain, since T1): 34 files passed, 1 skipped; 493 tests passed, 17 skipped (the database tests, opt-in).
  - `npm run build` exit 0. `npm run test:e2e` (next dev): 120 passed. `E2E_SERVER=start npm run test:e2e`: 120 passed.
  - An earlier gate run (before the review fixes) had lint, type check, unit and build green, then lost its `next dev` server mid-suite (49 tests failed at 0 ms) while the reviewer ran vitest in parallel. It was stopped for the review fixes; the reviewer's re-check then ran read-only.
  - Acceptance criteria: 1–5 and 7 checked by command (the unit table, the per-cat e2e tests); 3 (the table in decisions.md) by reading too; 6, exact revert, by command (unit and per-cat e2e, which found D8); focused fields by the existing `pickTargets` unit test; clicks not changed (Q2). **Tested in a browser, not seen**: nobody has looked at how the smoke, frost or bouncing look on the dashboard pages.
  - Reviewer: request changes (fling for fixed-point effects at calm/chaos/panels; stale intensity descriptions; clicks), the first two fixed, re-review approve (D11).
- **CI of T1** (`60801d2`): the run branch passed every job, including "Database tests" ([run](https://github.com/lazurq-png/Xenocats/actions/runs/37622699500)); the task branch's run of the same commit failed in "Browser tests (dev server)" ([run](https://github.com/lazurq-png/Xenocats/actions/runs/37622695999)), step "Browser tests (smoke, branding, dashboard, login, settings, headers, states, keyboard, intensity)". Identical tree, so no repair; Q4.
