# Decisions — night run 2026-10-07

Numbered D1, D2, … Each with its reason. Acceptance criteria derived for each task are recorded here.

## T1 — Database unit tests are opt-in

Acceptance criteria (from the task's words):
1. `tests/unit/data.test.ts` runs only when `DATABASE_TESTS=1`; otherwise every block in it skips, so plain `npm test` opens no database connection.
2. CI's "Database tests" step sets `DATABASE_TESTS=1`, so CI still runs them.
3. `CLAUDE.md` §9, `.claude/rules/testing.md` and the file's header comment describe the new behaviour.

**D1 — `E2E_NO_DATABASE=1` still skips them when opted in.** The task adds a gate; it does not ask to remove the old one, and `E2E_NO_DATABASE` is the documented "server unreachable" switch for every database-backed test. Keeping it is the smaller change. Only the exact value `1` opts in (the task says `DATABASE_TESTS=1`), so `DATABASE_TESTS=0` does not.

**D2 — the opted-in path is not run locally.** Running `DATABASE_TESTS=1` would write `xenocats_vitest` on the development server, which this run may touch only through the browser tests and the build (skill §3; the plan's "Databases" decision). Criterion 2 is proved by CI's "Database tests" step (polled), criterion 1's skip path by a local run.

**D3 — reviewer's observation, not acted on.** The reviewer approved with no findings and noted that if CI's `DATABASE_TESTS` were ever dropped, the "Database tests" step would pass green with every test skipped. True of any skip gate; making that step fail when the file is fully skipped is not asked for. Proposed as Q1.
