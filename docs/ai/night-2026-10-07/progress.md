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
