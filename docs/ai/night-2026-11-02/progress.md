# Progress — night-2026-11-02

Append-only log of the night run of 2026-11-02; the morning report, once written, sits at the top.

## Run start

- Goal: "Tuesday 18:00" → Deadline: 2026-11-03 18:00
- Wall clock at start: 2026-11-02 22:34 (time zone W. Europe Standard Time)
- Limits: none (the plan has no `## Limits` section)
- Branch: `Nightrun`, reused (an earlier run's, 2026-10-17, level with `main`: fast-forwarded to `main` a207ca9). Run date recorded in its git description.
- Remote: `origin` reachable; `origin/Nightrun` at 39dee30, which `main` contains; no branch of this date on the remote.
- Environment: Node v24.22.0, npm 11.19.1, `node_modules` present, Chromium present, `.env` present.
- Pre-existing uncommitted changes: none.
- Timer: the human's `/loop 20m` job (dabf402a) is the run's timer.
- Baseline (§1.5), all exit 0, run one after another:
  - `npm run lint`: 0 errors, 0 warnings (9 s); saved as `lint-baseline.txt`
  - `npx next typegen && npx tsc --noEmit`: clean (5 s)
  - `npm test`: 50 files passed, 1 skipped; 1113 tests passed, 42 skipped (25 s)
  - `DATABASE_TESTS=1 npx vitest run tests/unit/data`: 42 passed, 0 skipped (5 s)
  - `npm run build`: exit 0 (12 s); in the gate
  - `E2E_WORKERS=4 npm run test:e2e` (next dev): 162 passed, 2 skipped (the two opt-in benchmark specs) (140 s)
  - `E2E_WORKERS=4 E2E_SERVER=start npm run test:e2e`: 162 passed, 2 skipped (104 s)
  - Leftovers before the heavy jobs: none found.

## T1 — Verify the database's certificate in production (completed)

- Branch `2026-11-02-t1-verify-db-cert`, base a207ca9. Started 2026-11-02 22:40, completed 22:47.
- **What the code does:**
  - `app/lib/db-ssl.ts` (new): `databaseSsl(env)` returns `'verify-full'` when `VERCEL=1`, else `'require'`.
  - `app/lib/db.ts`: the app's one client takes its `ssl` option from `databaseSsl()`.
  - `tests/unit/db-ssl.test.ts` (new, in CI's "Unit tests (dashboard)" step): the choice for `VERCEL` set to `1`, unset, empty, `0`.
  - `tests/unit/data.test.ts`: "TLS to the database" — against the real (self-signed) server, the non-Vercel mode connects encrypted and the Vercel mode is refused with a certificate error.
- **What it brings:** on Vercel the app now refuses a database server whose certificate is not Neon's, so someone able to intercept the connection can no longer read or alter the data in transit; local and CI connections are unchanged.
- Decisions: D1–D4. Questions: Q1, Q2.
- **Verification** (full-suite point: the selector printed `FULL` for e2e, `app/lib/db-ssl.ts` reaches `auth.ts`):
  - prettier on the 5 changed files: clean; `npm run lint`: 0 errors, 0 warnings (baseline 0); `tsc`: clean; actionlint (with shellcheck and pyflakes; the task changed `ci.yml`): clean.
  - `npm test`: 51 files passed, 1 skipped; 1115 passed, 43 skipped (baseline 1113 / 42: +2 new tests, +1 new database test skipped without opt-in).
  - `DATABASE_TESTS=1 npx vitest run tests/unit/data`: 43 passed, 0 skipped (baseline 42, +1 new).
  - `npm run build`: exit 0.
  - `E2E_WORKERS=4 npm run test:e2e`: 162 passed, 2 skipped; `E2E_SERVER=start`: 162 passed, 2 skipped (same as baseline).
  - Criteria (a)–(c) checked by command; (d) checked by command against the self-signed development server only; Neon itself by reading only (Q1).
- **Reviewer:** approved, no defects. Its two notes (production unprovable from here; `db.mjs` unverified) became Q1 and Q2.
