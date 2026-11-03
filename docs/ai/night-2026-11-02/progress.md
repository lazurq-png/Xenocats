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

## T2 — One session check per request (completed)

- Branch `2026-11-02-t2-session-once`, base 61c6fc7. Started 2026-11-02 22:48, completed 22:50.
- **What the code does:**
  - `app/lib/session.ts`: `currentSession = cache(() => auth())`, the request's session read once; `currentUserId()` reads it.
  - `tests/unit/session.test.ts` (new, in CI's "Unit tests (dashboard)" step): four concurrent calls in one request make one `auth()` call; the next request makes its own; a signed-out request redirects every caller to the login.
- **What it brings:** the dashboard overview now checks the session against the database once per page instead of three times (plus the proxy's), so each overview load makes two fewer queries, and a revoked session is still refused on the next request.
- Decisions: D5–D7.
- **Verification:** prettier on the 3 changed files: clean; lint: 0 errors, 0 warnings (baseline 0); tsc: clean; actionlint (ci.yml changed): clean. The test fails (2 of 3) with `cache()` taken out, and passes with it. Selection (`test:affected --base Nightrun`): `vitest related` → 1 file, 3 passed; build: exit 0; e2e: 18 specs (dashboard, customers, invoices and others reaching `currentUserId`), 54 passed, 0 skipped, 0 failed. (a) and (b) checked by command, against React's server cache imitated (D7); that it dedupes in a real Next render is checked by reading only.
- **Reviewer:** approved, no defects.
- **T1's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41531462962 (Nightrun at 61c6fc7).

## T3 — A login limit per client address (completed)

- Branch `2026-11-02-t3-login-address-limit`, base d3578ca. Started 2026-11-02 22:53, completed 23:08.
- **What the code does:**
  - `db/migrations/0013_login_failures_last_attempt.sql` (new): `login_failures.last_attempt`, `NOT NULL DEFAULT now()`.
  - `app/lib/login-limit.ts`: `claimAttempt` records `last_attempt` and, given `forgetAfterMinutes`, restarts a count left quiet that long with no lock set; `addressLimits()` (20 failures, `LOGIN_ADDRESS_MAX_FAILURES`; the login lock minutes); `addressKey()`; `refundAttempt()` gives back one attempt and the lock it set; `pruneLoginFailures()` deletes rows whose lock ran out, or with no lock and no attempt for a day, logging rather than throwing on failure; `ADDRESS_LOCKED`.
  - `app/lib/credentials.ts`: with a client key, counts the address before the name and refuses a locked address before counting the name or comparing a password; prunes after the name's count; a success clears the name and refunds the address's attempt.
  - `auth.ts`: `authorize` keys the trusted proxy's client address (`clientAddress`, `clientKey`), none when it is 'unknown', and throws `AddressLocked` for `ADDRESS_LOCKED`.
  - `app/lib/actions.ts`: `authenticate` says "Too many failed logins from here. Try again later." for a locked address.
  - `README.md`: `LOGIN_ADDRESS_MAX_FAILURES`, and that without a trusted proxy failed logins are counted per name only.
  - Tests: `credentials.test.ts` (+6: address counted first under its prefix, locked address refused before the name or a comparison, success refunds, failure does not, no proxy counts the name only, a failing prune fails no login), `login-limit.test.ts` (+3: `addressLimits`, `addressKey`, the quiet spell as a parameter), `data.test.ts` (+6 against the database: an address's count forgotten after a quiet spell and a name's not, a shorter spell no reset, a spell never ends a running lock, refund, pruning, migration 0013 on existing rows with the older app still writing).
- **What it brings:** one client address can no longer try password after password across many login names, nor lock name after name: on Vercel it gets 20 failed logins per 15 minutes in all. The `login_failures` table stops growing with every name ever mistyped.
- Decisions: D8–D18. Questions: Q3, Q4 (**migrate Neon before deploying**).
- **Verification** (full-suite point: the selector printed `FULL`, `credentials.ts` reaches `auth.ts`; run on the final state after the review fixes):
  - prettier on the changed files: clean; lint: 0 errors, 0 warnings (baseline 0); tsc: clean.
  - `npm test`: 52 files passed, 1 skipped; 1127 passed, 49 skipped (T2's 1118 + 9 new unit tests; 6 new database tests skipped without opt-in).
  - `DATABASE_TESTS=1 npx vitest run tests/unit/data`: 49 passed, 0 skipped (43 + 6).
  - `npm run build`: exit 0. `E2E_WORKERS=4 npm run test:e2e`: 162 passed, 2 skipped; `E2E_SERVER=start`: 162 passed, 2 skipped (as the baseline).
  - Criteria (a)–(e) checked by command against the database and fakes; the address limit end to end through `auth.ts` (headers to key) is checked by reading only (D17).
- **Reviewer:** approved; three Low findings (prune could fail a login; a quiet spell could reset during a running lock; README silent), all fixed (D18) and re-reviewed: approved.
- **T2's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41532246608 (Nightrun at d3578ca).

## T4 — Drop `customers.image_url` (completed)

- Branch `2026-11-02-t4-drop-image-url`, base 74aaac6. Started 2026-11-02 23:08, completed 23:15.
- **What the code does:**
  - `db/migrations/0014_drop_customer_image_url.sql` (new): `ALTER TABLE customers DROP COLUMN image_url`, with the order it must be applied in.
  - `tests/unit/data.test.ts`: "0014 drops the image column and keeps every customer" — on a schema migrated to 0013, customers with and without an image survive 0014, the column is gone, and a customer is made without it.
  - `app/ui/customer-avatar.tsx`: its comment names 0014 as where the column went.
  - `docs/backlog.md`: the "Drop `customers.image_url`" entry is removed.
- **What it brings:** the schema no longer carries a column nothing uses, so a reader of the database or a future query cannot mistake the course's leftover image paths for live data.
- Decisions: D19–D22. Questions: Q5 (**migrate Neon only once no deployment names the column**), Q6.
- **Verification** (full-suite point: `FULL`, the schema changed): prettier on the changed TS files: clean; lint: 0 errors, 0 warnings; tsc: clean; `npm test`: 1127 passed, 50 skipped; database tests: 50 passed, 0 skipped (+1); build: exit 0; e2e under `next dev` and `next start`: 162 passed, 2 skipped each, on a test schema rebuilt with 0014. (a)–(c) checked by command; (d) in Q5.
- **Reviewer:** approved, no defects. Its note (old Nightrun previews on Neon would break after 0014) is in Q5.
- **T3's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41534587801 (Nightrun at 74aaac6).

## T5 — "Pending" means unpaid and not yet due, everywhere (completed)

- Branch `2026-11-02-t5-unpaid-label`, base 6852499. Started 2026-11-02 23:15, completed 23:20.
- **What the code does:**
  - `app/ui/dashboard/cards.tsx`: the card that sums every unpaid invoice is titled "Unpaid".
  - `app/ui/dashboard/revenue-chart.tsx`: legend, bar titles, the screen-reader table's caption and column say "unpaid"; the component's comment says why.
  - `app/ui/customers/table.tsx`, `app/ui/skeletons.tsx`: "Total Unpaid" on desktop and in its skeleton, "Unpaid" on a phone.
  - `tests/e2e/dashboard.spec.ts`: "totals of every unpaid invoice" — the overview's card heading, chart legend and chart column, and the customer list's column, say Unpaid and nowhere Pending.
  - `docs/backlog.md`: the "'Pending' means two things" entry is removed.
- **What it brings:** a user reading the dashboard no longer sees a Pending total that includes overdue invoices while the invoice list's Pending filter (not yet due) shows none of them; "Pending" now means one thing across the app.
- Decisions: D23–D25.
- **Verification:** prettier on the 5 changed files: clean; lint: 0 errors, 0 warnings; tsc: clean. Selection: `vitest related` found no unit test for these files (none exists; exit 0); build: exit 0; e2e: 14 specs, 43 passed, 0 skipped. After the reviewer's finding, the changed spec alone (`dashboard.spec.ts`, the only file the fix touched): 5 passed. **Tested in a browser, not seen**: a human should look at the overview card and chart legend, and the customer list on a phone and on a desktop. (a)–(c) checked by command (the browser test); (b) by reading only (no file of it changed).
- **Reviewer:** approved; one Low finding (the legend check matched the card heading instead, so it could not fail), fixed: the legend is now found as its own list item.
- **T4's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41535623142 (Nightrun at 6852499).

## T6 — One time zone (completed)

- Branch `2026-11-02-t6-utc-timezone`, base 02d44a1. Started 2026-11-02 23:20, completed 23:30.
- **What the code does:**
  - `app/lib/db.ts`: the app's client starts every session with `TimeZone: 'UTC'`, so `CURRENT_DATE` is the UTC day the app dates invoices by.
  - `tests/unit/data.test.ts`: "one time zone" — an invoice made today is due in 30 days and not overdue by the app's queries, where a session on a zone across midnight from UTC gets another day and another count; and the app's sessions report `TimeZone` UTC and today's UTC date (fails without the change: the development server is on GMT).
  - `docs/backlog.md`: the "One time zone" entry is removed; "Decisions for a human" now says "None open."
- **What it brings:** on a database server not on UTC, an invoice made in the hours around midnight is no longer "due in 29 (or 31) days", and an invoice due today is no longer counted overdue (or not) by the server's clock rather than the app's.
- Decisions: D26–D31.
- **Verification** (full-suite point: `FULL`, `db.ts` reaches `auth.ts`): prettier, lint (0 errors, 0 warnings), tsc: clean. `npm test`: first run 1 failed, 1126 passed (D31: an unidentified flake); four runs on the final state: 1127 passed, 52 skipped, 0 failed. Database tests: 52 passed, 0 skipped (+2), on the final state. Build: exit 0. E2E under `next dev`: 163 passed, 2 skipped; under `next start`: 163 passed, 2 skipped (+1 since the baseline: T5's test). The build and e2e ran before the review's test-only edit, which changes no file they use. (a)–(c) checked by command.
- **Reviewer:** approved; two Low notes on the test (the user-facing half passes without the change where the server is on UTC's day; the zone was chosen at load time), both addressed (D30).
- **T5's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41536402867 (Nightrun at 02d44a1).

## T7 — Plausibility checks on leaderboard runs (completed)

- Branch `2026-11-02-t7-run-plausibility`, base ffd90d0. Started 2026-11-02 23:30, completed 23:52.
- **What the code does:**
  - `app/ui/xenocats/arena.ts`: `mostSentHome(ms, minutes)`, the most cats a run of that length can have sent home by the arena's clock `ms`: every cat that can have come, each spawn source at its most, from the config's own numbers (D33).
  - `app/lib/actions.ts`: `recordSurvivalRun` reads the run's length and the time since it started, and refuses a claim of more cats than `mostSentHome` allows at the time the run reports, or, for a timed run reported at its goal, at the time since it started (D38, D41); the `UPDATE` is pinned to that length.
  - `app/ui/xenocats/leaderboard-entry.tsx`: the refusal also says "or it could not be checked".
  - Tests: `arena.test.ts` (+2: the bound grows with the time; a strong seeded run, both fusions at the highest level, stays under it to its goal and past it with a Matriarch that never comes near), `actions.test.ts` (+2 and updated fakes: at the limit and one past it; at the goal held to the time since it started; below the goal and endless held to the reported time), `data.test.ts` (against the database: at the goal past the elapsed bound refused, an early run past its own refused, at the goal within the bound saved, at its own limit saved, an endless run past its bound refused).
- **What it brings:** a forged leaderboard run claiming far more cats sent home than could ever have come in its time is now refused by the server, while no run the game can play is (D34: the strongest run measured is a third to a fifth of the bound).
- Decisions: D32–D41.
- **Verification:** prettier on the 6 changed files: clean; lint: 0 errors, 0 warnings; tsc: clean. Selection, on the final state: `vitest related` → 10 files, 596 passed, 52 skipped; database tests: 52 passed, 0 skipped; build: exit 0; e2e: 4 specs (benchmark, leaderboard, phone, survival), 47 passed, 2 skipped (the two opt-in benchmark specs). After the last reviewer note, a test-only change: `actions.test.ts` 57 passed, and a comment in `data.test.ts`. (a)–(d) checked by command; that the bound holds for every possible run is checked by reading the spawn sources (D33) and by the seeded runs, not exhaustively.
- **Reviewer:** first pass Request Changes, one Medium (a timed run reports its time stopped at the goal while its cats go on: the bound could refuse an honest run) and one Low (the refusal's wording); fixed (D38, D39). Second pass: approve, one Low (the elapsed bound applied to every run, loosening it); fixed (D41). Third pass: approve, no findings; its optional endless-run test added.
- **T6's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41537849608 (Nightrun at ffd90d0).

## T8 — Co-op patches and swatted cats get an owner (completed)

- Branch `2026-11-02-t8-coop-owners`, base ca4a668. Started 2026-11-02 23:52, completed 2026-11-03 00:01.
- **What the code does:**
  - `app/ui/xenocats/arena.ts`: a patch (toy, box, puddle) records the Keeper whose weapon laid it (`owner`), and a swatted cat the Keeper who swatted it (`flungOwner`); while they hurt cats, that Keeper is the one whose passives apply and whose weapons decide the credit (a fused weapon's parent counts for the fused one he holds).
  - `tests/unit/xenocats/coop.test.ts`: "what each Keeper leaves behind is his" — player 2's toy, box and swatted cats hurt elites by his Reading Glasses (×1.15; before, ×1.00 and ×1.10); once his Jacuzzi is part of his Bubble Bath, its puddles count for the Bubble Bath.
- **What it brings:** in co-op, player 2's toys, boxes, puddles and swatted cats now use his own passives, and his weapon report credits his fused weapons with their work; before, they used player 1's, so his passives and his fusions were short-changed.
- Decisions: D42–D46.
- **Verification:** prettier, lint (0 errors, 0 warnings), tsc: clean. Both new tests fail with the arena change stashed and pass with it. Selection: `vitest related` → 10 files, 598 passed, 52 skipped; build: exit 0; e2e: 4 specs, 47 passed, 2 skipped. (a)–(c) checked by command.
- **Reviewer:** approved, no defects.
- **T7's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41540733887 (Nightrun at ca4a668).

## T9 — CI (completed)

- Branch `2026-11-02-t9-ci-concurrency`, base d3cb6bc. Started 2026-11-03 00:01, completed 00:08.
- **What the code does:**
  - `.github/workflows/ci.yml`: a `concurrency` group (the workflow and the pull request, else the ref) cancels a run a newer push supersedes; the checks job runs `npx prettier --check .` (and the type check runs even if formatting failed); the database-tests step fails unless at least one test passed (`scripts/ci-passed.mjs` reads Vitest's JSON report); a new `migrations` job, on pull requests into `main`, lists the migrations the pull request adds in the job summary, with a warning on each, to migrate Neon first.
  - `scripts/ci-passed.mjs` (new) and `tests/unit/ci-passed.test.ts` (new, in "Unit tests (dashboard)").
  - `.github/dependabot.yml` (new): npm weekly, minor and patch in one group, and GitHub Actions weekly, both as pull requests into `dev`.
  - `docs/backlog.md`: the "CI's database tests can pass with every test skipped" entry is removed.
- **What it brings:** CI stops spending runners on commits a newer push replaced, catches unformatted files and a database-test step that silently tested nothing, and a release to production now says in its pull request which migrations Neon needs first; dependency updates arrive on their own, tested on `dev`.
- Decisions: D47–D52.
- **Verification** (full-suite point: `FULL`, the new script is outside what the selector traces): prettier on the changed files: clean; `npx prettier --check .`: clean; lint: 0 errors, 0 warnings; tsc: clean; actionlint with shellcheck and pyflakes: clean (and after the review's edit). The guard tried on real Vitest reports (52 passed: exit 0; all skipped: exit 1), and the migrations job's script run locally (lists 0013 and 0014 for `main`...`Nightrun`; "None." with no new file). `npm test`: 53 files passed, 1 skipped; 1136 passed, 52 skipped; database tests: 52 passed; build: exit 0; e2e under `next dev` and `next start`: 163 passed, 2 skipped each. What the workflow does on GitHub (cancelling, the summary, Dependabot) is checked by reading only until its CI run.
- **Reviewer:** approved; one Low (a formatting failure would skip the type check), fixed (D52). Its note on `CLAUDE.md` §9 is D51.
- **T8's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41541961155 (Nightrun at d3cb6bc).

## T10 — Small cleanups (completed)

- Branch `2026-11-02-t10-small-cleanups`, base 9bbc934. Started 2026-11-03 00:08, completed 00:16.
- **What the code does:**
  - `tsconfig.json`: `scripts/seed.js`, long gone, is out of `include`.
  - `package.json`: `"dev": "next dev"` (Turbopack is Next 16's default).
  - `next.config.ts`: `poweredByHeader: false`; `tests/e2e/security-headers.spec.ts` checks no page response carries `X-Powered-By`.
  - `app/lib/sign-up-limit.ts`: `proxyWarning(env)`, the warning a production server gives without a trusted proxy header; `instrumentation.ts` (new) prints it once when a Node.js server instance starts. `tests/unit/input-safeguards.test.ts` tests when it speaks.
- **What it brings:** someone deploying off Vercel without a proxy header now learns at startup that the sign-up and login address limits have fallen back, instead of finding out from abuse; responses no longer advertise the framework; the configuration no longer names a file that is not there.
- Decisions: D53–D56.
- **Verification** (full-suite point: `FULL`, `package.json` and `instrumentation.ts` changed): prettier on the changed files: clean; lint: 0 errors, 0 warnings; tsc: clean. The warning seen on a real `next start` after a build (D54). `npm test`: 53 files passed, 1 skipped; 1137 passed, 52 skipped; database tests: 52 passed; build: exit 0; e2e under `next dev` and `next start`: 163 passed, 2 skipped each. (a)–(d) checked by command.
- **Reviewer:** approved, no defects; its note on `playwright.config.ts` is D55.
- **T9's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41543017299 (Nightrun at 9bbc934): the new concurrency group, formatting step and database-test guard ran green on GitHub.

## T11 — First run in the README (completed)

- Branch `2026-11-02-t11-first-run-readme`, base 00dd2b8. Started 2026-11-03 00:17, completed 00:23.
- **What the code does:**
  - `README.md`: "First run" (Node and npm; PostgreSQL 17 with TLS and a role that may create schemas; `.env` from `.env.example`; `db:migrate`, `db:seed`; `npm run dev` and the demo login), "Checks" (the table of checks, with the opt-in database tests, and what CI runs when), and "Design tool context" (what `.superdesign/init/*.md` are).
  - `.env.example` (new): every key the app reads, commented, with no values.
  - `CLAUDE.md` §9: points to the README's table instead of holding its own; §18's reference follows. `.claude/README.md`: its pointer to the table follows too.
- **What it brings:** a new contributor can go from a clone to a running app, logged in, from the README alone, with a template for `.env` that names every setting; the list of checks lives in one place, where a human looks first.
- Decisions: D57–D63.
- **Verification:** documentation only: `test:affected` selects nothing (0 unit files, 0 specs); `npx prettier --check .`: clean (Markdown is not checked; `.env.example` has no parser); lint: 0 errors, 0 warnings; build: exit 0. `.env.example` parses with `node --env-file` (all keys empty). The first-run steps checked by reading against `scripts/db.mjs`, `app/lib/db.ts` and the seed; not run from a fresh clone.
- **Reviewer:** Request Changes, three Low (a false claim that `.superdesign` is regenerated; an inaccurate CI sentence; a stale pointer in `.claude/README.md`), all fixed (D63); re-review: approved.
- **T10's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41544149321 (Nightrun at 00dd2b8).

## T12 — CI, more (completed)

- Branch `2026-11-02-t12-ci-more`, base dfc823f. Started 2026-11-03 00:23, completed 00:29.
- **What the code does:**
  - `.github/workflows/ci.yml`: a `dependency-review` job on pull requests (`actions/dependency-review-action`), failing on a vulnerability the pull request adds.
  - `.github/workflows/codeql.yml` (new): CodeQL for JavaScript and TypeScript on pull requests into `Nightrun`, `dev` and `main`, pushes to `dev`, and weekly; not on pushes to `Nightrun` (D66).
  - `package.json`: `"engines": { "node": ">=24" }`. `.nvmrc` (new): `24`.
- **What it brings:** a pull request that brings in a vulnerable dependency, or code CodeQL flags (injection, unsafe redirects and the like), now says so before it is merged; a contributor's version manager and npm both know the project needs Node 24.
- Decisions: D64–D70 (D69: a slip, `npm ci --dry-run` run once; nothing changed). Questions: Q7, Q8.
- **Verification** (full-suite point: `package.json` changed): prettier on the changed files: clean; actionlint with shellcheck and pyflakes: clean; lint: 0 errors, 0 warnings; tsc: clean; `npm test`: 1137 passed, 52 skipped; database tests: 52 passed; build: exit 0; e2e under `next dev` and `next start`: 163 passed, 2 skipped each. Whether dependency review and CodeQL pass on GitHub is checked by reading only until the first pull request runs them (neither runs on a push to `Nightrun`).
- **Reviewer:** approved; two Low notes became Q7 and Q8 (D70).
- **T11's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41544905982 (Nightrun at dfc823f).

## T13 — Survival specs on the page's clock (completed)

- Branch `2026-11-02-t13-survival-clock`, base 1ab6978. Started 2026-11-03 00:29, completed 00:46.
- **What the code does:**
  - `tests/e2e/survival.spec.ts`: `openArena` installs the page's clock; `runUntil` runs it on a step at a time until what a test waits for comes, failing after a stated amount of page time; 28 waits for the run (time, cats, cats sent home, level-ups, a pickup, wind-ups, the boss bar, the facing) use it, and three fixed real-time waits became `clock.runFor`. The slow-screen test keeps the page's own clock.
- **What it brings:** the Survival specs no longer depend on how busy the machine is: the run gets exactly the page time a test asks for, at a steady 60 frames a second, so a slow CI runner or a crowded local run cannot starve them, and a seeded run plays the same each time. They also run faster: the spec alone took 29 s at 4 workers.
- Decisions: D71–D75 (D72: the failure it was meant to cure did not reproduce before the change, at 6 or 10 workers).
- **Verification:** prettier, lint (0 errors, 0 warnings), tsc: clean; build: exit 0. Before the change, the full browser suite at 6 workers: 163 passed, 2 skipped, twice; at 10 workers: the same, twice. After: at 6 workers three times in a row: 163 passed, 2 skipped, 0 failed each (1.6 min each, against 1.8–1.9 before). The selection on the final state (`survival.spec.ts`, 4 workers): 41 passed. (a) and (b) checked by command; (c) by reading (every `runUntil` throws at its limit; the reviewer traced each).
- **Reviewer:** approved; one Low (a stale comment), fixed (D75).
- **T12's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41545782312 (Nightrun at 1ab6978).

## T14 — Unit test groups by folder (completed)

- Branch `2026-11-02-t14-unit-groups`, base 9d249f2. Started 2026-11-03 00:46, completed 00:54.
- **What the code does:**
  - `vitest.config.mts`: four Vitest projects that choose their own files: `dashboard` (`tests/unit/` outside `xenocats/`), `cats` (`tests/unit/xenocats/`), `jsdom` (every file with the jsdom environment line), `database` (`data.test.ts`).
  - `.github/workflows/ci.yml`: one step per project (`npx vitest run --project …`) in place of four hand-written file lists; the database step runs its project; "Every test file is in a group" checks the unit files with `scripts/unit-projects.mjs` (new), the specs as before.
  - `.claude/rules/testing.md` ("A new test file goes in a CI group"), `CLAUDE.md` §9 and `.claude/agents/reviewer.md` say so.
- **What it brings:** a new unit test file runs in CI with no edit anywhere, a new folder of them too; a file can no longer be left out of CI by forgetting to list it, nor run twice by a prefix (two did: D81).
- Decisions: D76–D81.
- **Verification** (full-suite point: `vitest.config.mts` changed): prettier, actionlint, lint (0 errors, 0 warnings), tsc: clean; `node scripts/unit-projects.mjs`: 54 files, each in one project; tried with a stray file (failed, then landed in `dashboard`); each project as CI runs it: 228 + 713 + 196 = 1,137 passed, as `npm test` before; `npm test`: 1,137 passed, 52 skipped; database project with `DATABASE_TESTS=1`: 52 passed, guard accepts it; build: exit 0; e2e under `next dev` and `next start`: 163 passed, 2 skipped each. (a)–(e) checked by command.
- **Reviewer:** approved, no defects (D81).
- **T13's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41547904895 (Nightrun at 9d249f2).

## T15 — Cache the leaderboard (completed)

- Branch `2026-11-02-t15-cache-leaderboard`, base 890d1e3. Started 2026-11-03 00:54, completed 01:05.
- **What the code does:**
  - `app/lib/data.ts`: `fetchLeaderboard` reads the board (each length's top ten) from Next's data cache (`unstable_cache`, tag `leaderboard`, keyed by the schema, at most 60 s old) and the signed-in viewer's own best from the database on every request; both from one ranking (`rankedBests`). The cached rows carry no user id; the viewer's row on the board is found by its place and run.
  - `app/lib/actions.ts`: `recordSurvivalRun` updates the tag (`updateTag`) when a run is saved.
  - Tests: `tests/unit/leaderboard-cache.test.ts` (new): the board read once across requests until the tag is updated, the viewer's row every time, the key, the tag and the limit; `actions.test.ts` checks the tag update; the `next/cache` mocks gained `unstable_cache` and `updateTag`.
- **What it brings:** `/cats` no longer ranks every finished run for every visitor: the board is read from the database about once a minute, or at once after a save, and a visitor who is not signed in costs no board query at all; a player still sees their own new run on the board straight after saving it.
- Decisions: D82–D87.
- **Verification** (on the final state): prettier, lint (0 errors, 0 warnings), tsc: clean; selection: `vitest related` → 5 files, 73 passed, 52 skipped; database tests: 52 passed; build: exit 0; e2e: 14 specs under `next dev`, 129 passed, 2 skipped; and `leaderboard.spec.ts` under `next start` (where the data cache is the production one): 5 passed. (a)–(e) checked by command; the expiry timing (60 s, stale-while-revalidate) is Next's, checked by reading.
- **Reviewer:** Request Changes, two Medium (no time limit; a key not tied to the schema), both fixed (D87); re-review: approved.
- **T14's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41548860797 (Nightrun at 890d1e3).

## T16 — A shorter session (completed)

- Branch `2026-11-02-t16-session-max-age`, base ab2ca6d. Started 2026-11-03 01:05, completed 01:16.
- **What the code does:**
  - `auth.config.ts`: the session lasts 7 days (`session.maxAge`, Auth.js's default 30); the token records when its login was made (`loginAt`), and the `jwt` callback signs out a token whose login is over 7 days old, or that has no login time (made before this change), before it asks the database.
  - `tests/unit/auth-config.test.ts`: the setting; a login past its week signed out without a database query, one inside it checked and kept; a token from before signed out; the existing session tests carry a login time.
- **What it brings:** a stolen session cookie now works for at most a week after its login, however often it is used, where before a cookie in use could last indefinitely and an idle one thirty days.
- Decisions: D88–D92. Questions: Q9 (every signed-in user logs in again once at deploy).
- **Verification** (full-suite point: `auth.config.ts` changed; on the final state): prettier, lint (0 errors, 0 warnings), tsc: clean; `npm test`: 54 files passed, 1 skipped; 1,143 passed, 52 skipped; database tests: 52 passed; build: exit 0; e2e under `next dev` and `next start`: 163 passed, 2 skipped each (every logged-in spec signs in afresh, so its token has a login time). (a)–(c) checked by command; that Auth.js re-issues the cookie on use and clears it on `null` is checked by reading `@auth/core` (the reviewer's).
- **Reviewer:** approved, one Low (the grace week for old tokens let a stolen pre-deploy cookie live 30 days and outlive a sign-out), fixed (D92); re-review: approved.
- **T15's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41550169634 (Nightrun at ab2ca6d).

## T17 — A Content-Security-Policy with a nonce (completed)

- Branch `2026-11-02-t17-csp-nonce`, base 26c0663. Started 2026-11-03 01:16, completed 04:34. **Gap:** the account's usage limit stopped the run from about 01:20 to 04:21; the task was in flight (uncommitted), and was resumed from its notes, every check re-run.
- **What the code does:**
  - `app/lib/csp.ts` (new): the policy, and a fresh 128-bit nonce; `script-src 'self' 'nonce-…' 'strict-dynamic'`, no `'unsafe-inline'` for scripts; `next dev` keeps `'unsafe-eval'` and `ws:`/`wss:`.
  - `proxy.ts`: builds the policy for each request and puts it on the response and on the request Next renders from (which puts the nonce on its scripts); re-asks `authorized` and redirects to the login as next-auth would (D97).
  - `app/layout.tsx`: every page renders per request (`connection()`), so every page gets the nonce.
  - `next.config.ts`: keeps the other security headers; the CSP is gone from it.
  - Tests: `tests/unit/csp.test.ts` (new); `security-headers.spec.ts`: every page's scripts carry that response's nonce, new each time, and an injected inline handler is blocked; `smoke.spec.ts`: the login redirect keeps its `callbackUrl`.
- **What it brings:** script injected into a page (an attribute handler, a `<script>` in markup) no longer runs, where `'unsafe-inline'` let it: React's escaping is no longer the only defence against cross-site scripting.
- Decisions: D93–D100.
- **Verification** (full-suite point: the root layout and `proxy.ts` changed; on the final state): prettier, lint (0 errors, 0 warnings), tsc: clean; `npm test`: 55 files passed, 1 skipped; 1,147 passed, 52 skipped; database tests: 52 passed (before the last, proxy-only, edit); build: exit 0, only the icon and the global error page prerendered; e2e under `next dev`: 165 passed, 2 skipped; under `next start`: 165 passed, 2 skipped. (a)–(e) checked by command.
- **Reviewer:** approved; two Low (a re-check stricter than next-auth's; no CSP on responses the matcher skips), acted on (D100).
- **T16's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41551587948 (Nightrun at 26c0663).

## T18 — Rules load where they apply (completed)

- Branch `2026-11-02-t18-rules-paths`, base 61c45e6. Started 2026-11-03 04:34, completed 04:40.
- **What the code does:**
  - `.claude/rules/frontend.md`, `backend.md`, `database.md`, `testing.md`, `security-review.md`: `paths:` frontmatter naming the files each governs (D102, D104); `architecture.md` and `debugging.md` unchanged, loaded in every session.
  - `CLAUDE.md` §2 (which load when, and to open a scoped rule a task needs before it has read one of its files) and §18's tree; `.claude/README.md` ("How rules load", with a table of what loads each rule; the tree; the new-repo steps).
- **What it brings:** a session carries only the rules for what it touches, instead of all seven (about 31 KB) every time: a task on the cats no longer brings the database and security rules into its context, and one on the schema still gets them.
- Decisions: D101–D104.
- **Verification:** documentation only: `test:affected` selects nothing; each frontmatter checked to be a `paths:` list of quoted globs, and every glob to match at least one file today. That Claude Code loads a scoped rule on reading a matching file is checked by reading its documentation, not by a session.
- **Reviewer:** approved; three Low (the new-repo steps, two security files, the README's table), all acted on (D104).
- **T17's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41573002396 (Nightrun at 61c45e6): the nonce and every browser spec green on GitHub too.

## T19 — A shorter `CLAUDE.md` (completed)

- Branch `2026-11-02-t19-shorter-claude-md`, base a8645d6. Started 2026-11-03 04:40, completed 04:48.
- **What the code does:**
  - `CLAUDE.md`: imports `AGENTS.md` (`@AGENTS.md`) instead of telling a session to read it; §§3, 5, 7, 10, 12–14 (exploration, implementation, context, debugging, parallel work, review, minimality) are one-line pointers; the repository map, the checks, the environment and database facts and every other section stay. 487 lines, from 588.
  - `.claude/docs/working-practices.md` (new): those seven sections, word for word, under their numbers.
  - `.claude/docs/ai-workflow.md`: the closing diagram that drew the loop a third time is gone.
  - `.claude/README.md`, `CLAUDE.md` §18: the new doc listed.
- **What it brings:** `AGENTS.md` is now loaded into every Claude session as it was meant to be read, instead of relying on each session to open it; `CLAUDE.md` keeps what is about this repository in front, with the general practice a link away.
- Decisions: D105–D110 (D107: the under-200 target is not reached; why, and what would reach it).
- **Verification:** documentation only (no tests select); every moved section compared with its copy (the reviewer, line by line); every outside reference to a `CLAUDE.md` section number checked to still resolve.
- **Reviewer:** approved; two Low (the new doc unlisted; a leftover heading), both fixed (D110).
- **T18's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41573526298 (Nightrun at a8645d6).

## T20 — A real `.claude/settings.json` (completed)

- Branch `2026-11-02-t20-settings`, base ca6767e. Started 2026-11-03 04:48, completed 05:02.
- **What the code does:**
  - `.claude/settings.json` (new): deny rules, through the Bash tool, for force-pushing and deleting branches in their several spellings, `npm install`/`i`/`add`/`uninstall`/`update`, and `cat .env`; through the file tools, for reading or editing `.env`, `.env.local`, `.env.production`. A PreToolUse hook for the Bash and PowerShell tools.
  - `.claude/hooks/guard-db.mjs` (new): refuses a command that seeds or resets when the URL it would use (inline, the environment's or `.env`'s) names a host outside the private ranges; `tests/unit/guard-db.test.ts` (new) tests it as functions and as the hook.
  - `.claude/README.md`, `.claude/docs/ai-workflow.md`, the night-run skill's "Read this first" and `CLAUDE.md` §18: what is enforced, by which route, and what remains instruction; `.claude/agents/reviewer.md`: it never commits or pushes.
- **What it brings:** a run with permissions bypassed can no longer force-push, delete a branch, change dependencies or read `.env` through the shell tool it uses most, nor seed or reset a database on the internet, by mistake or by a bad instruction: these hold even when no one is there to say no.
- Decisions: D111–D116 (D116: the hook's false positive on commands that only quote the words).
- **Verification:** prettier, lint (0 errors, 0 warnings), tsc: clean; `tests/unit/guard-db.test.ts`: 6 passed; build: exit 0; no spec selected (`test:affected`); a dry-run push in the run's own form passed the rules, and `test -f .env` still works; the hook was seen refusing live, twice (D116). That the harness matches the deny patterns as documented is checked by reading only.
- **Reviewer:** Request Changes (two Medium: PowerShell not covered, push forms missed; three Low), all acted on (D115); re-review: approved.
- **T19's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41574133723 (Nightrun at ca6767e).

## T21 — A `verify` skill (completed)

- Branch `2026-11-02-t21-verify-skill`, base 88141ee. Started 2026-11-03 04:54, completed 04:57. (T20's entry above says it completed at 05:02; the clock read 04:53. The entry is left as written.)
- **What the code does:**
  - `.claude/skills/verify/SKILL.md` (new; `/verify`): the changed files, as the selector finds them; then Prettier on them, lint, the type check, the test groups when tests moved, and `npm run test:affected --run`, cheapest first, stopping at the first failure; how to repair (rerun what failed, then everything once on the final state); what it leaves out (the build, `next start`, a browser, actionlint, each with its command); how to report.
  - `CLAUDE.md` §9 and §18, `.claude/README.md`: the skill listed.
- **What it brings:** one command, `/verify`, runs a change's checks in this repository's order with its rules (changed files only, the selector, never in parallel, the final state reported), instead of each session assembling them from §9.
- Decisions: D117–D121.
- **Verification:** documentation only (no tests select); the skill's steps were run on this change and passed (prettier, lint 0 warnings, tsc, a selection of nothing); the harness listed the skill as soon as the file existed. Every command in it checked against `package.json` and `scripts/affected-tests.mjs` (the reviewer's).
- **Reviewer:** Request Changes (one Medium: a repair would not recheck the earlier steps; four Low), all applied (D120); re-review approved with two Low, applied (D121).
- **T20's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41574901154 (Nightrun at 88141ee).

## T22 — Split the largest game modules (completed, in part: see D124, Q10)

- Branch `2026-11-02-t22-split-arena`, base 723ffb5. Started 2026-11-03 04:59, completed 05:10.
- **What the code does:**
  - `app/ui/xenocats/arena.ts`: keeps `createArena`; its configuration moves to `arena-config.ts`, its types, constants and small helpers to `arena-model.ts`; it re-exports both. 3,999 → 3,108 lines.
  - `app/ui/xenocats/arsenal.ts`: now its header and re-exports of `arsenal-weapons.ts` (the weapon table), `arsenal-rules.ts` (evolutions, fusions, passives, modifiers, stats, choices) and `arsenal-words.ts` (what a choice or a loadout says).
  - `app/ui/xenocats/arena-view.tsx`: its constants and helpers outside the component move to `arena-view-parts.ts`, which it imports. 1,951 → 1,841 lines.
  - Every line moved unchanged (the reviewer compared them); no import elsewhere changed.
- **What it brings:** the arsenal's table, rules and words, and the arena's configuration and model, can each be read and changed in a file of its own; the inside of the simulation and of the drawing, which the task also named, is not split (D124), and is proposed as a supervised task (Q10).
- Decisions: D122–D126.
- **Verification** (on the final state): prettier, lint (0 errors, 0 warnings), tsc (with unused names checked too): clean; no test file changed; `npm test`: 56 files passed, 1 skipped; 1,153 passed, 52 skipped; build: exit 0; the selection (benchmark, leaderboard, phone, security headers, survival) under `next dev`: 54 passed, 2 skipped; the same specs but the benchmark under `next start`: 54 passed; the benchmark twice before and after (D126). (b)–(d) checked by command; (a) in part (D124).
- **Reviewer:** approved, no defects; one Low on scope (the closures not split), which is D124 and Q10.
- **T21's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41575403748 (Nightrun at 723ffb5).

## E1 — started 05:11: where a crowded simulation step spends its time, and its grid's keys (kind: speed)

## E1 — where a crowded simulation step spends its time, and its grid's keys (completed)

- Branch `2026-11-02-e1-grid-keys`, base 88c44a5. Started 2026-11-03 05:11, completed 05:19.
- **What the code does:**
  - `app/ui/xenocats/arena-grid.ts`: a cell's key is packed into 15 bits per coordinate, a small integer, instead of a number near 2^41.
  - `tests/unit/xenocats/arena.test.ts`: the grid finds exactly what checking every point finds, also millions of px from the start, where cells share keys.
- **What it brings:** each simulation step of a crowded run is 4–8% faster (D128), on any machine, with every result the same; and the profile (D127) says where the rest of a step goes, for the next speed item.
- Decisions: D127–D129.
- **Verification:** prettier, lint (0 errors, 0 warnings), tsc: clean; the step benchmark, three interleaved pairs (D128); selection: `vitest related` → 10 files, 599 passed, 52 skipped; build: exit 0; e2e: 5 specs, 54 passed, 2 skipped. After the review, a comment's wording only; the grid tests rerun: 2 passed.
- **Reviewer:** approved, no findings; its note on the comment's range applied.
- **T22's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41576513827 (Nightrun at 88c44a5).

## E2 — started 05:18: the backlog's login-lockout entry, after T3 (kind: security and quality)

## E2 — the backlog's login-lockout entry, after T3 (completed)

- Branch `2026-11-02-e2-backlog-lockout`, base dc75dd8. Started 2026-11-03 05:18, completed 05:22. (E1's entry above says it completed at 05:19; the clock read 05:17.)
- **What the code does:** `docs/backlog.md`: "Login lockout: what it does not cover" names what T3 built and what still is not covered (many addresses against one name, one address against four, no proxy header).
- **What it brings:** the backlog no longer proposes work already done, and says plainly what a determined attacker can still do to a known name.
- Decisions: D130.
- **Verification:** documentation only: no tests select; read against `app/lib/login-limit.ts`, `credentials.ts` and T3's decisions (D8–D18). No reviewer (D130).
- **E1's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41577223422 (Nightrun at dc75dd8).

## E3 — started 05:20: where a crowded frame goes in the browser (kind: speed)

## E3 — where a crowded frame goes in the browser (completed)

- Branch `2026-11-02-e3-frame-profile`, base 64e365d. Started 2026-11-03 05:20, completed 05:28.
- **What the code does:** nothing in the app: a measurement, recorded (D131, D132) and turned into a proposed next speed task (Q11).
- **What it brings:** the next speed work aims where a crowded frame actually spends its time, and knows the render benchmark may be measuring a software canvas no player has.
- Decisions: D131–D132. Questions: Q11.
- **Verification:** the profiles themselves (D131). The two throwaway servers ran under `timeout` on ports 3201 and 3202 and ended by themselves (checked: no `next` process on either left). No tests select a documentation change.
- **E2's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41577753007 (Nightrun at 64e365d).

## E4 — started 05:29: the type check refuses unused locals and imports (kind: security and quality)

## E4 — the type check refuses unused locals and imports (completed)

- Branch `2026-11-02-e4-no-unused-locals`, base b460ded. Started 2026-11-03 05:29, completed 05:34.
- **What the code does:** `tsconfig.json`: `"noUnusedLocals": true`, so `tsc` (and `next build`) refuse an unused import, variable or function.
- **What it brings:** a refactor that leaves an import behind, as T22's first attempt did unseen, now fails the type check in the gate and in CI instead of staying in the code.
- Decisions: D133–D134.
- **Verification** (full-suite point: `tsconfig.json` changed): lint 0 errors, 0 warnings; tsc clean, and a probe file with an unused import and variable refused (D133); `npm test`: 56 files passed, 1 skipped; 1,154 passed, 52 skipped; database tests: 52 passed; build: exit 0, `tsconfig.json` unchanged by it; e2e under `next dev` and `next start`: 165 passed, 2 skipped each.
- **Reviewer:** approved, no findings (Next does not rewrite the option; `noUnusedParameters` would flag the actions' `prevState`, as D134 says).
- **E3's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41578309130 (Nightrun at b460ded).

## E5 — started 05:34: a cat's step without Math.hypot (kind: speed)

## E5 — a cat's step without Math.hypot (completed)

- Branch `2026-11-02-e5-walkcat-sqrt`, base 2130b74. Started 2026-11-03 05:34, completed 05:39.
- **What the code does:** `app/ui/xenocats/arena.ts`: `walkCat` takes the distance to the nearest Keeper as `Math.sqrt(dx*dx + dy*dy)` instead of `Math.hypot`.
- **What it brings:** a crowded simulation step is about 4% faster at 2,000 cats and 6% at 6,000 (D135), on top of E1's, with play the same.
- Decisions: D135–D136.
- **Verification:** prettier, lint (0 errors, 0 warnings), tsc: clean; the step benchmark, three interleaved pairs (D135); the cats project: 714 passed; selection: `vitest related` → 10 files, 599 passed, 52 skipped; build: exit 0; e2e: 5 specs, 54 passed, 2 skipped.
- **Reviewer:** approved, no defects; one Low (D136 named the other calls wrongly; `bringBack` runs per cat per step too), corrected.
- **E4's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41578892048 (Nightrun at 2130b74).

## E6 — started 05:40: CLAUDE.md §9's account of CI, after T9, T12 and T14 (kind: security and quality)

## E6 — CLAUDE.md §9's account of CI (completed)

- Branch `2026-11-02-e6-claude-ci-facts`, base 9fd5b2a. Started 2026-11-03 05:40, completed 09:22. **Gap:** the account's usage limit stopped the run from about 05:41 to 09:21, with this item's edit made and uncommitted; resumed from the tree.
- **What the code does:** `CLAUDE.md` §9: what CI runs, job by job, as it is after tonight's T9, T12 and T14.
- **What it brings:** an agent reading §9 to know what CI will check (and what it will not) reads what the workflows do now, not what they did yesterday.
- Decisions: D137.
- **Verification:** documentation only: every claim checked against `.github/workflows/ci.yml` and `codeql.yml` (by `grep` of the jobs, steps and triggers it names). No tests select.
- **E5's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41579397991 (Nightrun at 9fd5b2a).

## E7 — started 09:23: bringBack without a square root (kind: speed)

## E7 — bringBack without a square root (completed)

- Branch `2026-11-02-e7-bringback-squared`, base 6b8fb47. Started 2026-11-03 09:23, completed 09:27.
- **What the code does:** `app/ui/xenocats/arena.ts`: `bringBack` compares a cat's squared distance from the camera with the squared limit, instead of taking `Math.hypot`.
- **What it brings:** a crowded simulation step is another 5–6% faster at 2,000 and 6,000 cats (D138); with E1 and E5, a crowded step tonight went from about 1.10 to about 0.95 ms at 2,000 cats on this machine.
- Decisions: D138.
- **Verification:** prettier, lint (0 errors, 0 warnings), tsc: clean; the step benchmark, three interleaved pairs (D138); the cats project: 714 passed; selection: `vitest related` → 599 passed, 52 skipped; build: exit 0; e2e: 5 specs, 54 passed, 2 skipped.
- **Reviewer:** approved, nothing to fix (the limit is always well above zero, so the squared comparison is the same).
- **E6's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41602813593 (Nightrun at 6b8fb47).

## E8 — started 09:29: a test that the login never sends a visitor to another site (kind: security and quality)

## E8 — the login never sends a visitor to another site: a test, and the open redirect it found (completed)

- Branch `2026-11-02-e8-callback-redirect-test`, base bf9bb25. Started 2026-11-03 09:29, completed 09:42.
- **What the code does:**
  - `auth.config.ts`: a `redirect` callback: a login's or sign-out's address is resolved as a browser would, kept only if it is on this site, and given back with one leading slash; anything else goes to the home page.
  - `tests/unit/auth-config.test.ts`: the callback, for same-site addresses and ten forms of another site.
  - `tests/e2e/dashboard.spec.ts`: logging in with five forms of an outside `callbackUrl` leaves the visitor on this site.
- **What it brings:** a link carrying `/login?callbackUrl=//evil.example/...` no longer makes the login try to send the visitor to that site (D140): it was one step from an open redirect, held back only by the browser's `pushState` rule, and it left the visitor stuck on the login page. Now they land on the site.
- Decisions: D139–D142. Questions: Q12.
- **Verification** (full-suite point: `auth.config.ts` changed): lint (0 errors, 0 warnings), tsc: clean; the e2e test failed before the fix (the `pushState` `SecurityError`, D140) and passes after; `npm test`: 1,157 passed, 52 skipped; database tests: 52 passed; build: exit 0; e2e under `next dev` and `next start`: 166 passed, 2 skipped each. After the re-review, test-only edits: `auth-config.test.ts` 17 passed, `dashboard.spec.ts` 6 passed.
- **Reviewer:** Request Changes (High: the first test could not fail), fixed, which exposed the bug, fixed too; re-review approved with two Low, applied (D142).
- **E7's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41603550693 (Nightrun at bf9bb25).

## E9 — started 09:42: gathering gems without Math.hypot (kind: speed)

## E9 — gathering gems without Math.hypot (completed)

- Branch `2026-11-02-e9-gems-sqrt`, base fb2866b. Started 2026-11-03 09:42, completed 09:47.
- **What the code does:** `app/ui/xenocats/arena.ts`: `gatherGems` takes a gem's distance to the nearest Keeper as `Math.sqrt(dx*dx + dy*dy)` instead of `Math.hypot`.
- **What it brings:** a step is about 5% faster at 500 cats and 2–3% at 2,000, where many gems lie about (D143); with E1, E5 and E7, a 2,000-cat step tonight went from about 1.10 ms to about 0.90 on this machine.
- Decisions: D143.
- **Verification:** prettier, lint (0 errors, 0 warnings), tsc: clean; the step benchmark, three interleaved pairs (D143); the cats project: 714 passed; selection: `vitest related` → 599 passed, 52 skipped; build: exit 0; e2e: 5 specs, 54 passed, 2 skipped.
- **Reviewer:** none: the change E5's reviewer examined, repeated (D143).
- **E8's CI:** CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41605256495 (Nightrun at fb2866b).

## E10 — started 09:47: a test for the startup warning (kind: security and quality)

## E10 — a test for the startup warning (completed)

- Branch `2026-11-02-e10-instrumentation-test`, base `3bcb5d9`; started 09:4x, completed 09:51.
- **What the code does:** `tests/unit/instrumentation.test.ts` (new) calls the server's startup hook, `register()` in `instrumentation.ts`, with the environment stubbed, and checks that it warns once in production on Node.js with no trusted proxy header, says nothing with `VERCEL=1`, `TRUSTED_PROXY_HEADER` set or in development, and does nothing in the edge runtime. No application code changed.
- **What it brings:** the warning that the login address limit is off (T10) can no longer be dropped by a refactor without a test failing, so an operator deploying behind no trusted proxy keeps being told. Decisions: D144.
- **Verification:** prettier 0; lint 0, 0 warnings (baseline 0); `next typegen` + `tsc` 0; `test:affected --base Nightrun`: unit `vitest related tests/unit/instrumentation.test.ts`, e2e 0 specs; that ran 1 file, 3 passed (3), exit 0. The test was shown able to fail (the runtime guard removed for one run: 1 failed, 2 passed; restored, no diff). The file lands in the `dashboard` project with no config edit (unit-projects: 58 files, each in one project). Reviewer: none, a test-only change (D144).
- **Previous item's CI:** E9 (`3bcb5d9`) pending at this entry; its outcome goes in E11's entry.

## E11 — started 09:54: the last per-cat Math.hypot calls, in the lure, the flight and the push apart (kind: speed)

## E11 — the last per-cat Math.hypot calls, measured; a lure scenario for the benchmark (completed)

- Branch `2026-11-02-e11-hypot-lure-flee`, base `fa9b9b9`; started 09:54, completed 10:02.
- **What the code does:** `tests/bench/arena-step.test.ts` (the on-demand step benchmark, never in `npm test` or CI) gains a second table: the same crowd of 2,000 and 6,000 cats with an arsenal that lays toys and throws Cucumbers (the Squeak Symphony, the Squeaky Toy, the Cucumber, the Infinite Laser), so the lure and flight steps are measured; `bench` takes the arsenal as an argument. No application code changed: the `Math.hypot` → `Math.sqrt` change this item measured was not kept, since it was no faster at 6,000 cats.
- **What it brings:** the next speed change to how cats follow toys or flee can be measured, which the benchmark could not do before; and the run knows that the remaining `hypot` calls are not where a crowded step's time goes. Decisions: D145–D147; Q13.
- **Verification:** prettier 0; lint 0, 0 warnings (baseline 0); `next typegen` + `tsc` 0 (after one fix: `SIZES.map(bench)` passed `map`'s index as the arsenal, D146); the benchmark: 2 passed (first table 500/2,000/6,000 cats at 0.439/0.905/2.274 ms, as at E9). `test:affected --base Nightrun` printed `FULL` (a file under `tests/bench/`, D147), so the full suites ran: `npm test` 57 files passed, 1 skipped; 1160 passed, 52 skipped (E8's full point: 1153 more tests since, from E8 and E10, none fewer); database tests 52 passed (52); build 0; `test:e2e` 166 passed, 2 skipped; `E2E_SERVER=start` 166 passed, 2 skipped (as at E8). `node scripts/unit-projects.mjs`: 58 files, each in one project. Reviewer: none, a benchmark-only change (D146).
- **Previous items' CI:** E9 (`3bcb5d9`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41605927695; E10 (`fa9b9b9`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41606600438.

## E12 — started 10:04: a Cross-Origin-Opener-Policy header (kind: security and quality)

## E12 — a Cross-Origin-Opener-Policy header (completed)

- Branch `2026-11-02-e12-opener-policy`, base `d9aafa8`; started 10:04, completed 10:10.
- **What the code does:** `next.config.ts` sends `Cross-Origin-Opener-Policy: same-origin` on every response, beside the other security headers. `tests/e2e/security-headers.spec.ts` checks it on `/`, `/login`, `/cats` and `/dashboard`, and a new test opens `/login` as a popup from `about:blank` and finds that the popup has no `window.opener`.
- **What it brings:** a page of another site that opens this one (a popup, a link with a target) can no longer reach into its window or be reached from it, closing a route to cross-window leaks and to steering a visitor's other tab. Decisions: D148–D150.
- **Verification:** prettier 0; lint 0, 0 warnings (baseline 0); `next typegen` + `tsc` 0. Both tests shown able to fail (header removed for one run: 2 failed, the header undefined and the opener present; restored, no diff). `test:affected --base Nightrun` printed `FULL` (`next.config.ts`), so the full suites ran: `npm test` 57 files passed, 1 skipped; 1160 passed, 52 skipped (as at E11); database tests 52 passed (52); build 0; `test:e2e` 167 passed, 2 skipped; `E2E_SERVER=start` 167 passed, 2 skipped (E11: 166; the one more is the popup test). Reviewer: approved, no findings (D150).
- **Previous item's CI:** E11 (`d9aafa8`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41607862096.
- Built and tested in a browser, not seen: a human may open the site from a link on another site and check nothing changed.

## E13 — started 10:12: a grid for the gems a cat sent home joins (kind: speed)

## E13 — a grid for the gems a cat sent home joins, measured (completed)

- Branch `2026-11-02-e13-gem-grid`, base `a22c179`; started 10:12, completed 10:14.
- **What the code does:** nothing changes in the code: the change this item measured made the step slower and was not kept. The item is the record of the measurement (D151, D152).
- **What it brings:** the next speed work skips a dead end (an index for the gems costs more than the scan it would replace) and starts from a current profile of where a crowded step goes. Decisions: D151–D152.
- **Verification:** a fingerprint of every gem and cat over 2,400 seeded steps, old code against new, matched in three runs (so the tried change kept the game's choices); three interleaved timing pairs of the step benchmark showed it slower at every size (D152). `arena.ts` restored to its base: `git diff a22c179 -- app/` is empty. Only `docs/ai/` changes: prettier does not check Markdown; `test:affected` selects nothing. Reviewer: none, no code changed.
- **Previous item's CI:** E12 (`a22c179`) pending at this entry; its outcome goes in E14's entry.

## E14 — started 10:16: checkouts that leave no token behind (kind: security and quality)

## E14 — checkouts that leave no token behind (completed)

- Branch `2026-11-02-e14-checkout-credentials`, base `c2507a0`; started 10:16, completed 10:18.
- **What the code does:** every `actions/checkout` step in `.github/workflows/ci.yml` (five) and `codeql.yml` (one) sets `persist-credentials: false`, so the job's GitHub token is no longer written into `.git/config` for the steps after it; a comment beside `ci.yml`'s `permissions:` says why.
- **What it brings:** the code CI runs after checkout (npm packages' install scripts, the build, the tests, and the change under test itself) can no longer read the workflow's token from disk, which narrows what a compromised dependency or a hostile pull request could do with it. Decisions: D153–D155.
- **Verification:** actionlint with shellcheck and pyflakes 0; prettier on both workflows 0; lint 0, 0 warnings (baseline 0); `next typegen` + `tsc` 0; `test:affected --base Nightrun` selects no test (unit 0, e2e 0). The *checks*, *build* and *e2e* jobs' checkouts are exercised by CI's run of this push; *migrations*, *dependency-review* and CodeQL's are checked by reading only until a pull request (D154). Reviewer: approved; its one Low did not hold (D155).
- **Previous items' CI:** E12 (`a22c179`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41608886766; E13 (`c2507a0`) pending at this entry; its outcome goes in E15's entry.

## E15 — started 10:22: why a crowded step's own lines are slow: cat shapes, copies, culling (kind: speed)

## E15 — why a crowded step's own lines are slow: cat shapes, copies, culling (completed)

- Branch `2026-11-02-e15-step-shapes`, base `ff6f9c3`; started 10:22, completed 10:23.
- **What the code does:** nothing changes in the code. The item checked, by reading and from E13's profile, the causes a change could remove from a crowded step's own time, and found none (D156).
- **What it brings:** the next speed work need not look again at cat shapes, per-frame copies or off-screen drawing, and knows a line-level profile needs source maps; the remaining gain is structural, for a plan (D157). Decisions: D156–D157.
- **Verification:** reading only, and the listing of every assigned cat field against what creation sets (no field outside it). Only `docs/ai/` changes; `test:affected` selects nothing. Reviewer: none, no code changed.
- **Previous items' CI:** E13 (`c2507a0`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41609614907; E14 (`ff6f9c3`) pending at this entry; its outcome goes in E16's entry.

## E16 — started 10:27: the test selector skips the on-demand benchmarks (kind: security and quality)

## E16 — the test selector skips the on-demand benchmarks (completed)

- Branch `2026-11-02-e16-selector-bench`, base `77536f6`; started 10:27, completed 10:32.
- **What the code does:** `scripts/affected-tests.mjs` (`npm run test:affected`) counts `tests/bench/` and `vitest.bench.config.mts` among the changes that need no test run, beside the artwork scripts; `tests/unit/affected-tests.test.ts` checks that a change to either selects no unit test and no spec.
- **What it brings:** a change to the speed benchmarks no longer costs a run of every suite (E11's did: about six minutes for files no suite runs), so the next speed work can change its benchmark at the price of the benchmark alone. Decisions: D158–D159; it answers Q13.
- **Verification:** prettier 0; lint 0, 0 warnings (baseline 0); `next typegen` + `tsc` 0; the selector's tests 41 passed (41), the new one shown able to fail (the entries removed for one run: 1 failed, 40 passed; restored, no diff). The selector printed `FULL` for itself (§2.1), so the full suites ran: `npm test` 57 files passed, 1 skipped; 1161 passed, 52 skipped (E12: 1160, the one more is the new test); database tests 52 passed (52); build 0; `test:e2e` 167 passed, 2 skipped; `E2E_SERVER=start` 167 passed, 2 skipped (as at E12). Reviewer: approved, no findings (D159).
- **Previous items' CI:** E14 (`ff6f9c3`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41610335444; E15 (`77536f6`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41611061607.

## E17 — started 10:34: the grid's cells round the camera in an array, not a Map (kind: speed)

## E17 — the grid's cells round the camera in an array, not a Map (completed)

- Branch `2026-11-02-e17-dense-grid`, base `3d6bab0`; started 10:34, completed 10:42.
- **What the code does:** `app/ui/xenocats/arena-grid.ts`: `clear` takes an optional window, and the cells in it are kept in an array, found by their position, instead of being hashed into a `Map`; cells outside it are in the `Map` as before. `app/ui/xenocats/arena.ts` gives both grids, each step, the window where every cat lies (the camera ± the distance beyond which cats are brought back, and two cells more). Every query gives the same ids in the same order as before. `tests/unit/xenocats/arena.test.ts` compares a windowed grid with a plain one as the window moves and resizes.
- **What it brings:** a crowded Survival step is 6–8% faster at every crowd size (2,000 cats about 0.93 → 0.86 ms), for the same game: seeded runs are unchanged. The largest single gain of the run's speed work. Decisions: D160–D162.
- **Verification:** prettier 0; lint 0, 0 warnings (baseline 0); `next typegen` + `tsc` 0; seeded fingerprints old against new, three runs, identical (D161); the step benchmark, three interleaved pairs (D161). `test:affected --base Nightrun`: unit `vitest related` over the three files → 10 files, 600 passed, 52 skipped (on the final test); the cats project 715 passed (715); build 0; e2e 5 specs (benchmark, leaderboard, phone, security-headers, survival) → 55 passed, 2 skipped. The grid test shown able to fail by three planted bugs (D162). Reviewer: approved; its two Low findings acted on (D162); after that change (the test file only) the unit selection and the cats project were rerun, passing as above; the build and specs read no test file.
- **Previous items' CI:** E16 (`3d6bab0`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41611939580.

## E18 — started 10:47: the README names the speed benchmarks (kind: security and quality)

## E18 — the README names the speed benchmarks (completed)

- Branch `2026-11-02-e18-readme-benchmarks`, base `7768d7f`; started 10:49, completed 10:49.
- **What the code does:** `README.md`'s Checks table gains a row for the two speed benchmarks, run by hand and never in CI: the Survival step (`npx vitest run -c vitest.bench.config.mts`) and its drawing in throttled Chromium (`BENCH=1 E2E_NO_CAT_DEPS=1 npx playwright test tests/e2e/benchmark.spec.ts`). No code changes.
- **What it brings:** whoever takes up the speed work next (Q11, D157) finds how to measure it where the other checks are listed, not only by reading the test folders. Decisions: D163.
- **Verification:** both commands run as the README now writes them: the step benchmark 2 passed; the render benchmark 3 passed (48.1 s). `test:affected --base Nightrun` selects nothing (a Markdown file; prettier does not check Markdown). Reviewer: none, a one-line documentation change.
- **Previous item's CI:** E17 (`7768d7f`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41613112778.

## E19 — started 10:50: separate reads its cell without copying it (kind: speed)

## E19 — separate reads its cell without copying it (completed)

- Branch `2026-11-02-e19-separate-cell`, base `d503de9`; started 10:50, completed 10:55.
- **What the code does:** `app/ui/xenocats/arena-grid.ts` gains `cellAt`, which gives a point's own cell as the grid holds it (read-only) instead of a copy; `separate` in `app/ui/xenocats/arena.ts`, which eases piled-up cats apart, reads its cat's cell and the big cats' cell that way, in the same order as before. `tests/unit/xenocats/arena.test.ts` checks `cellAt` against a query of radius 0.
- **What it brings:** a crowded Survival step 5–9% faster again on top of E17 (2,000 cats about 0.85 → 0.80 ms, 6,000 about 2.17 → 1.98), with seeded runs unchanged. Decisions: D164–D166.
- **Verification:** prettier 0; lint 0, 0 warnings (baseline 0); `next typegen` + `tsc` 0; seeded fingerprints old against new, three runs, identical; the step benchmark, three interleaved pairs (D165); the new test shown able to fail (a planted off-by-one cell). `test:affected --base Nightrun`: unit `vitest related` over the three files → 10 files, 601 passed, 52 skipped; the cats project 716 passed (716); build 0; e2e 5 specs (benchmark, leaderboard, phone, security-headers, survival) → 55 passed, 2 skipped. Reviewer: approved, no findings (D166).
- **A correction to E18's entry:** it says E18 started at 10:49; its heading, written when it started, says 10:47, which is right.
- **Previous item's CI:** E18 (`d503de9`) pending at this entry; its outcome goes in E20's entry.

## E20 — started 10:55: a fingerprint of seeded runs, to show a refactor changed no game (kind: security and quality)

## E20 — a fingerprint of seeded runs, to show a refactor changed no game (completed)

- Branch `2026-11-02-e20-run-fingerprint`, base `f902d94`; started 10:55, completed 10:56.
- **What the code does:** `tests/bench/arena-fingerprint.test.ts` (new, run by hand with the step benchmark's config, never in CI) plays three seeded, crowded Survival runs and prints a fingerprint of each: every cat's position and homesickness every 100 steps, and every gem at the end. `README.md`'s benchmark row names it.
- **What it brings:** the next speed change or refactor of the simulation can show in one command that it left the game as it was (the same three lines before and after), instead of a script written again each time, as E13, E17 and E19 did. Decisions: D167.
- **Verification:** prettier 0; lint 0, 0 warnings (baseline 0); `tsc` 0; the tool run: 1 passed, the fingerprints `0f741d43bd8015d9`, `0cfdc9b1adbc2ecb`, `ab3b9f378e0e8819` (E17's and E19's); with a one-line change to the game, three others (D167). `test:affected --base Nightrun` selects nothing (`tests/bench/` and Markdown; E16 working as meant). Reviewer: none, a tool run on demand (D167).
- **Previous item's CI:** E18 (`d503de9`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41614146900; E19 (`f902d94`) pending at this entry; its outcome goes in E21's entry.

## E21 — started 11:00: within reads the cells in place, not a copy of them (kind: speed)

## E21 — within reads the cells in place, measured (completed)

- Branch `2026-11-02-e21-within-lists`, base `82b9d09`; started 11:00, completed 11:02.
- **What the code does:** nothing changes in the code: the change this item measured gained nothing and was not kept (D168).
- **What it brings:** the next speed work knows that E19's in-place read pays off only where a search reads a crowded cell for a few ids (as `separate` does), not for `within`'s small searches. Decisions: D168.
- **Verification:** with the change, E20's fingerprints unchanged (`0f741d43bd8015d9`, `0cfdc9b1adbc2ecb`, `ab3b9f378e0e8819`); three interleaved timing pairs of the step benchmark, no gain (D168). `git diff 82b9d09 -- app/` is empty. Only `docs/ai/` changes; `test:affected` selects nothing. Reviewer: none, no code changed.
- **Previous items' CI:** E19 (`f902d94`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41614870251; E20 (`82b9d09`) pending at this entry; its outcome goes in E22's entry.

## E22 — started 11:06: a test that no shared cache may keep a page behind the login (kind: security and quality)

## E22 — a test that no shared cache may keep a page behind the login (completed)

- Branch `2026-11-02-e22-private-cache`, base `008ee79`; started 11:05, completed 11:13.
- **What the code does:** `tests/e2e/security-headers.spec.ts` gains a test, signed in as the demo user, that each of the nine pages under `app/dashboard/` (a seeded customer's invoice and the customer among them) answers 200 and says `Cache-Control: no-store`.
- **What it brings:** a page behind the login made static, given a revalidation time, or sent a cache header in `next.config.ts` would let a CDN (Vercel's) keep one account's invoices and serve them to someone else; CI's *build* job (`next start`) now fails on it. Before, only the CSV export's header was tested. Decisions: D169–D170.
- **Verification:** prettier 0; lint 0, 0 warnings (baseline 0); `next typegen` + `tsc` 0. Shown able to fail: with a cacheable static file in its list (under `next dev`), and with a `Cache-Control: public, max-age=3600` for `/dashboard/settings` planted in `next.config.ts`, built and run under `next start` (`Received: "public, max-age=3600"`); both put back byte for byte, and rebuilt. `test:affected --base Nightrun`: unit, no test file; e2e `security-headers.spec.ts`; on the final state, build 0, the spec under `next dev` 10 passed, under `E2E_SERVER=start` 10 passed. Reviewer: approved; two Low findings acted on (D170), the spec rerun on both servers after.
- **Previous items' CI:** E20 (`82b9d09`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41615589626; E21 (`008ee79`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41616345032.

## E23 — started 11:14: the gem grid again, now the grid has its window (kind: speed)

## E23 — the gem grid again, now the grid has its window, measured (completed)

- Branch `2026-11-02-e23-gem-grid-window`, base `4f4f877`; started 11:14, completed 11:15.
- **What the code does:** nothing changes in the code: the change this item measured made the step slower again and was not kept (D171).
- **What it brings:** E13's dead end is now settled with its one excuse removed, so no later speed work spends an item on an index for the gems. Decisions: D171.
- **Verification:** with the change, E20's fingerprints unchanged (`0f741d43bd8015d9`, `0cfdc9b1adbc2ecb`, `ab3b9f378e0e8819`); three interleaved timing pairs of the step benchmark, slower at every size (D171). `git diff 4f4f877 -- app/` is empty. Only `docs/ai/` changes; `test:affected` selects nothing. Reviewer: none, no code changed.
- **A correction to E22's entry:** it says E22 started at 11:05; its heading, written when it started, says 11:06, which is right.
- **Previous item's CI:** E22 (`4f4f877`) pending at this entry; its outcome goes in E24's entry.

## E24 — started 11:23: lint rules for comparisons and loops that cannot be right (kind: security and quality)

## E24 — lint rules for comparisons and loops that cannot be right (completed)

- Branch `2026-11-02-e24-lint-rules`, base `c6e22bb`; started 11:23, completed 14:23.
- **A gap:** the account's usage limit stopped the run from about 11:25 to 14:21 (the reviewer was cut off; the full suites, already running, finished in it). Nothing from before it was trusted: the suites' output files were read, and the reviewer resumed.
- **What the code does:** `eslint.config.mjs` turns on, for every linted file, six rules that catch comparisons and loops that cannot be what was meant: `eqeqeq` (allowing `== null`), `no-self-compare`, `no-constant-binary-expression`, `no-unmodified-loop-condition`, `no-unreachable-loop`, `no-template-curly-in-string`. The tree already keeps them: no code changed.
- **What it brings:** a later change (a human's or a night run's) that compares a value with itself, writes `==`, writes a condition whose result is fixed, a loop that cannot end or cannot repeat, or `${}` in a plain string now fails `npm run lint` and CI, instead of reaching review. Decisions: D172–D173.
- **Verification:** `npm run lint` 0, 0 warnings (baseline 0); `eslint . --max-warnings 0` 0; each rule shown to fire on a probe file (deleted); prettier 0; `next typegen` + `tsc` 0. `test:affected --base Nightrun` printed `FULL` (`eslint.config.mjs`), so the full suites ran: `npm test` 57 files passed, 1 skipped; 1163 passed, 52 skipped (E16: 1161; two more since, E17's and E19's grid tests); database tests 52 passed (52); build 0; `test:e2e` 168 passed, 2 skipped; `E2E_SERVER=start` 168 passed, 2 skipped (E16: 167; one more since, E22's). Reviewer: approved; its nit acted on (D173), lint rerun after.
- **Previous items' CI:** E22 (`4f4f877`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41617490339; E23 (`c6e22bb`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41618262176.

## E25 — started 14:24: a cat keeps its gait, not looked up by its variety each step (kind: speed)

## E25 — a cat keeps its gait, not looked up by its variety each step (completed)

- Branch `2026-11-02-e25-cat-gait`, base `632ede0`; started 14:24, completed 14:30.
- **What the code does:** `ArenaCat` (`app/ui/xenocats/arena-model.ts`) gains `gait`, how the cat moves, set when it spawns (`spawnXenocat`: `'walk'`; `spawnVariety`: its variety's); `walkCat`, `separate` and `bringBack` in `arena.ts` read it instead of looking the variety up in `VARIETIES` for every cat every step. `tests/unit/xenocats/varieties.test.ts` checks every cat's gait against its variety's, every step of a run in which every variety comes.
- **What it brings:** a crowded Survival step 3–11% faster again, most at the largest crowds (6,000 cats about 2.00 → 1.79 ms), with seeded runs unchanged: after E17, E19 and this, a 6,000-cat step is about a quarter faster than at E9. Decisions: D174–D175.
- **Verification:** prettier 0; lint 0, 0 warnings (baseline 0); `next typegen` + `tsc` 0; E20's fingerprints unchanged; the step benchmark, three interleaved pairs (D174); the new test shown able to fail (D174). `test:affected --base Nightrun`: unit `vitest related` over the three files → 10 files, 602 passed, 52 skipped (on the final test); the cats project 717 passed (717); build 0; e2e 5 specs (benchmark, leaderboard, phone, security-headers, survival) → 56 passed, 2 skipped. Reviewer: request changes, one Medium (a timeout), acted on (D175); the unit selection and cats project rerun after.
- **Previous item's CI:** E24 (`632ede0`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41643902854.

## E26 — started 14:32: what the afternoon's security reading found sound, recorded; Q13 closed (kind: security and quality)

## E26 — what the afternoon's security reading found sound, recorded; Q13 closed (completed)

- Branch `2026-11-02-e26-security-reading`, base `7df6752`; started 14:32, completed 14:32.
- **What the code does:** nothing changes in the code. `decisions.md` records what was read and found sound (every data-changing Server Action refuses a caller without a session, by a test; the bcrypt cost; E24's two leftover lint rules, not worth turning on), and lists where this run's other security readings are (D176); `questions.md` closes Q13, answered by E16 (D177).
- **What it brings:** the next run's security exploration starts from what this one has read, instead of reading it again; and the next plan does not take up a proposal already done. Decisions: D176–D177.
- **Verification:** reading only (the test lines named in D176 were found by search and read). Only `docs/ai/` changes; `test:affected` selects nothing. Reviewer: none, no code changed.
- **A correction to E25's entry:** it says a 6,000-cat step is "about a quarter faster than at E9"; its own figures (E9 2.27–2.32 ms, E25 about 1.79) give about a fifth.
- **Previous item's CI:** E25 (`7df6752`) pending at this entry; its outcome goes in E27's entry.

## E27 — started 14:36: a cat keeps what it is immune to, not looked up at every hit (kind: speed)

## E27 — a cat keeps what it is immune to, measured (completed)

- Branch `2026-11-02-e27-cat-immunity`, base `c89945b`; started 14:36, completed 14:38.
- **What the code does:** nothing changes in the code: the change this item measured gained too little to keep (D178).
- **What it brings:** the next speed work knows the cached-field pattern of E25 pays only for what is read for every cat every step, not per hit. Decisions: D178.
- **Verification:** with the change, E20's fingerprints unchanged; three interleaved timing pairs of the step benchmark, no gain at 500 or 6,000 cats (D178). `git diff c89945b -- app/` is empty. Only `docs/ai/` changes; `test:affected` selects nothing. Reviewer: none, no code changed.
- **Previous item's CI:** E25 (`7df6752`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41644987876; E26 (`c89945b`) pending at this entry; its outcome goes in E28's entry.

## E28 — started 14:42: a test that CI's Playwright image matches the locked Playwright (kind: security and quality)

## E28 — a test that CI's Playwright image matches the locked Playwright (completed)

- Branch `2026-11-02-e28-playwright-image`, base `2eaa8e4`; started 14:42, completed 14:43.
- **What the code does:** `tests/unit/ci-playwright-image.test.ts` (new) checks that every Playwright container image named in `.github/workflows/ci.yml` has the tag of the `@playwright/test` version locked in `package-lock.json`, and says which tag to move when not.
- **What it brings:** Dependabot's weekly update of Playwright, which moves the lockfile but not CI's image, now fails a unit test on its own pull request, saying what to change, instead of leaving CI's browser jobs on a mismatched browser image. Decisions: D179.
- **Verification:** prettier 0; lint 0, 0 warnings (baseline 0); `tsc` 0; the test 1 passed, and shown able to fail (D179); `node scripts/unit-projects.mjs`: 59 files, each in one project (dashboard 23). `test:affected --base Nightrun`: unit `vitest related tests/unit/ci-playwright-image.test.ts` → 1 passed (1); e2e 0 specs. Reviewer: none, a test-only change (D179).
- **Previous items' CI:** E26 (`c89945b`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41645822623; E27 (`2eaa8e4`) pending at this entry; its outcome goes in E29's entry.

## E29 — started 14:48: the gem scan passes over a gem too far on x alone (kind: speed)

## E29 — the gem scan passes over a gem too far on x alone, measured (completed)

- Branch `2026-11-02-e29-gem-scan`, base `cb1cc7c`; started 14:48, completed 14:49.
- **What the code does:** nothing changes in the code: the change this item measured made the step slower and was not kept (D180).
- **What it brings:** a current profile of a crowded step after E25, and a third dead end on `dropGem` recorded (an early rejection costs more than it skips), so the scan is left as it is. Decisions: D180.
- **Verification:** with the change, E20's fingerprints unchanged; three interleaved timing pairs, slower at every size (D180). `git diff cb1cc7c -- app/` is empty. Only `docs/ai/` changes; `test:affected` selects nothing. Reviewer: none, no code changed.
- **Previous items' CI:** E27 (`2eaa8e4`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41646616015; E28 (`cb1cc7c`) pending at this entry; its outcome goes in E30's entry.

## E30 — started 14:53: a test that every page behind the login turns a visitor without a session away (kind: security and quality)

## E30 — a test that every page behind the login turns a visitor without a session away (completed)

- Branch `2026-11-02-e30-signed-out-pages`, base `9ae43b5`; started 14:53, completed 14:58.
- **What the code does:** `tests/e2e/smoke.spec.ts` gains a test that each of the nine pages under `app/dashboard/`, and an invoice path ending in `.png` that the proxy's matcher skips, answers a visitor without a session with a temporary redirect (307) to `/login`, and that it was the proxy (a `callbackUrl`) or, for the `.png` path, the page's own check (none) that answered.
- **What it brings:** a gap in either lock on the pages behind the login (a page left out of the proxy's reach, or a page that stops checking its user where the proxy does not) now fails a test in both CI browser jobs, where before only `/dashboard` itself was tested. Decisions: D181–D182.
- **Verification:** prettier 0; lint 0, 0 warnings (baseline 0); `tsc` 0. Shown able to fail twice: the invoice page's own check removed (`look.png` answered 404), and `.png` taken out of the matcher's exclusions (`answered by the page`); both put back byte for byte. `test:affected --base Nightrun`: unit, no test file; e2e `smoke.spec.ts`; build 0; on the final state the spec under `next dev` 8 passed, under `E2E_SERVER=start` 8 passed. Reviewer: approved; three Low findings acted on (D182), the spec rerun on both servers after.
- **Previous items' CI:** E28 (`cb1cc7c`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41647431543; E29 (`9ae43b5`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41648242954.

## E31 — started 14:59: moveCat writes a cat's speed back only when it slowed it (kind: speed)

## E31 — moveCat writes a cat's speed back only when it slowed it, measured (completed)

- Branch `2026-11-02-e31-movecat-speed`, base `e353a4c`; started 14:59, completed 15:00.
- **What the code does:** nothing changes in the code: the change this item measured gained nothing and was not kept (D183).
- **What it brings:** one more candidate in `moveCat` ruled out by measurement. Decisions: D183.
- **Verification:** with the change, E20's fingerprints unchanged; three interleaved timing pairs, overlapping at every size (D183). `git diff e353a4c -- app/` is empty. Only `docs/ai/` changes; `test:affected` selects nothing. Reviewer: none, no code changed.
- **Previous item's CI:** E30 (`e353a4c`) pending at this entry; its outcome goes in E32's entry.

## E32 — started 15:08: an address with a port counts as the address (kind: security and quality)

## E32 — an address with a port counts as the address (completed)

- Branch `2026-11-02-e32-address-port`, base `036c53e`; started 15:08, completed 15:16.
- **What the code does:** `clientAddress` in `app/lib/sign-up-limit.ts`, which reads the client's address from the trusted proxy's header for the sign-up limit and the per-address login limit, now drops a port the proxy wrote with it (`203.0.113.7:51234`, `[2001:db8::1]:51234`, `::ffff:203.0.113.7:51234`) and an IPv6 address's brackets; a bare address passes unchanged. `tests/unit/input-safeguards.test.ts` checks each form, and that two ports of one client are one count.
- **What it brings:** behind a proxy that writes the client's port into `X-Forwarded-For` (Azure's Application Gateway does), each connection had counted as a new client, so the sign-up limit and the login lockout by address (T3) could never be reached; now they count the client. Decisions: D184–D185.
- **A slip, recorded:** while probing `addressBlock`, a stray `cat > /tmp/ab.test.ts` with no input created an empty file outside the repository and hung the command (§3: nothing outside the repository). The command was stopped and the file, made by this run moments before, removed. Nothing else outside the repository was touched.
- **Verification:** prettier 0; lint 0, 0 warnings (baseline 0); `next typegen` + `tsc` 0; the new test fails on the code before (D184) and on the first version of the fix (D185). `test:affected --base Nightrun` printed `FULL` (`sign-up-limit.ts` reaches `auth.ts`), so the full suites ran: `npm test` 58 files passed, 1 skipped; 1166 passed, 52 skipped (E24: 1163; three more since, E25's, E28's and this one); database tests 52 passed (52); build 0; `test:e2e` 169 passed, 2 skipped; `E2E_SERVER=start` 169 passed, 2 skipped (E24: 168; one more since, E30's). After the reviewer's two Low findings (D185): `npm test` 1166 passed, 52 skipped; `login-limit` and `signup` specs 5 passed. Reviewer: approved; both findings acted on.
- **Previous items' CI:** E30 (`e353a4c`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41649166879; E31 (`036c53e`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41650058945.

## E33 — started 15:17: a cat keeps whether it soothes, not looked up by soothe (kind: speed)

## E33 — a cat keeps whether it soothes, not looked up by soothe (completed)

- Branch `2026-11-02-e33-cat-soothes`, base `a8a7680`; started 15:17, completed 15:21.
- **What the code does:** `ArenaCat` gains `soothes` (a Purring Cat's comfort, read-only, or `null`), set beside `gait` when a cat spawns; `soothe` in `arena.ts` reads it instead of looking up each cat's variety, for every cat and every cat near a Purring Cat. E25's every-step test in `varieties.test.ts` checks it too.
- **What it brings:** a late, crowded Survival step about 3% faster at 6,000 cats, where Purring Cats come in hundreds, with seeded runs unchanged. Decisions: D186–D187.
- **Verification:** prettier 0; lint 0, 0 warnings (baseline 0); `next typegen` + `tsc` 0; E20's fingerprints unchanged; the step benchmark, three interleaved pairs (D186); the extended test shown able to fail (D186). `test:affected --base Nightrun`: unit `vitest related` over the three files → 10 files, 602 passed, 52 skipped (again after D187's type); the cats project 717 passed (717); build 0; e2e 5 specs → 56 passed, 2 skipped. Reviewer: approved, no findings; its optional hardening taken (D187).
- **Previous item's CI:** E32 (`a8a7680`) pending at this entry; its outcome goes in E34's entry.

## E34 — started 15:22: the login limits' keys, read; email case parked as Q14 (kind: security and quality)

## E34 — the login limits' keys, read; email case parked as Q14 (completed)

- Branch `2026-11-02-e34-login-key-reading`, base `8ecb119`; started 15:22, completed 15:22.
- **What the code does:** nothing changes in the code. `decisions.md` records that the login limits' other keys hold (the trusted header's name, the per-name key: no spelling of a login escapes its account's lock; D188); `questions.md` asks Q14: an email logs in only as stored, case and all.
- **What it brings:** after E32's fix to the address key, the rest of what the limits count is known to be sound; and a human can decide Q14 (a sign-in quirk, and its migration) with the options laid out. Decisions: D188; Q14.
- **Verification:** reading only (the code and the test lines named in D188). Only `docs/ai/` changes; `test:affected` selects nothing. Reviewer: none, no code changed.
- **Previous items' CI:** E32 (`a8a7680`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41652083696; E33 (`8ecb119`) pending at this entry; its outcome goes in E35's entry.

## E35 — started 15:28: where the run's speed work leaves a crowded step, measured (kind: speed)

## E35 — where the run's speed work leaves a crowded step, measured (completed)

- Branch `2026-11-02-e35-speed-record`, base `aaba75d`; started 15:28, completed 15:29.
- **What the code does:** nothing changes in the code. `decisions.md` records the step benchmark on the run's latest code against its figures before any speed change, and which item gave what (D189).
- **What it brings:** one place that says what this run's speed work bought (a crowded step about a third less: 6,000 cats 2.7 → 1.76 ms), what was tried and dropped, and where the next speed task should start. Decisions: D189.
- **Verification:** the step benchmark run three times (2 passed each; the figures in D189). Only `docs/ai/` changes; `test:affected` selects nothing. Reviewer: none, no code changed.
- **Previous items' CI:** E33 (`8ecb119`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41652961597; E34 (`aaba75d`) pending at this entry; its outcome goes in E36's entry.

## E36 — started 15:33: the backlog says how a proxy's port is counted (kind: security and quality)

## E36 — the backlog says how a proxy's port is counted (completed)

- Branch `2026-11-02-e36-backlog-ports`, base `7f46a77`; started 15:33, completed 15:33.
- **What the code does:** nothing changes in the code. `docs/backlog.md`'s login-lockout entry says that behind a proxy writing the client's port with its address, the address alone is counted (E32).
- **What it brings:** the backlog, which the next plans are written from, matches what the address limit now does. Decisions: D190.
- **Verification:** reading only (the export's search, D190). Markdown only: prettier does not check it; `test:affected` selects nothing. Reviewer: none, a one-sentence documentation change.
- **Previous items' CI:** E34 (`aaba75d`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41653841138; E35 (`7f46a77`) pending at this entry; its outcome goes in E37's entry.

## E37 — started 15:38: the nearest Keeper, when there is one, without measuring (kind: speed)

## E37 — the nearest Keeper, when there is one, without measuring, measured (completed)

- Branch `2026-11-02-e37-one-keeper`, base `e6bc313`; started 15:38, completed 15:39.
- **What the code does:** nothing changes in the code: the change this item measured did not clear the bar the run keeps (D191).
- **What it brings:** one more per-cat call ruled out by measurement. Decisions: D191.
- **Verification:** with the change, E20's fingerprints unchanged; three interleaved timing pairs, about 2% at 2,000 cats, overlapping at 6,000 (D191). `git diff e6bc313 -- app/` is empty. Only `docs/ai/` changes; `test:affected` selects nothing. Reviewer: none, no code changed.
- **Previous items' CI:** E35 (`7f46a77`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41654774657; E36 (`e6bc313`) pending at this entry; its outcome goes in E38's entry.

## E38 — started 15:44: one list of what this run leaves for the next plan (kind: security and quality)

## E38 — one list of what this run leaves for the next plan (completed)

- Branch `2026-11-02-e38-next-plan`, base `c527f59`; started 15:44, completed 15:44.
- **What the code does:** nothing changes in the code. `questions.md` gains Q15: the proposed tasks this run leaves, in one ordered list, and what it read and found sound.
- **What it brings:** whoever writes the next plan has one list to choose from, instead of forty decisions to read. Decisions: D192; Q15.
- **Verification:** reading only (each item's source named in Q15). Only `docs/ai/` changes; `test:affected` selects nothing. Reviewer: none, no code changed.
- **Previous items' CI:** E36 (`e6bc313`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41655687657; E37 (`c527f59`) pending at this entry; its outcome goes in E39's entry.

## E39 — started 15:49: what a call of separate reads, counted (kind: speed)

## E39 — what a call of separate reads, counted (completed)

- Branch `2026-11-02-e39-separate-measure`, base `c4c4ea0`; started 15:49, completed 15:50.
- **What the code does:** nothing changes in the code. `decisions.md` records what one call of `separate` reads (14.2 neighbours of a 17.6-cat cell; a quarter stop early) and a change measured and dropped (D193).
- **What it brings:** the next speed task knows where `separate`'s time goes (cells too large for its reach) and that the gain there changes the game, so it is a plan's decision. Decisions: D193.
- **Verification:** a throwaway counter over the crowd benchmark (removed); with the dropped change, E20's fingerprints unchanged and three interleaved timing pairs overlapping (D193). `git diff c4c4ea0 -- app/` is empty. Only `docs/ai/` changes; `test:affected` selects nothing. Reviewer: none, no code changed.
- **Previous items' CI:** E37 (`c527f59`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41656593664; E38 (`c4c4ea0`) pending at this entry; its outcome goes in E40's entry.

## E40 — started 15:58: what a page past the proxy is served without (kind: security and quality)

## E40 — what a page past the proxy is served without (completed)

- Branch `2026-11-02-e40-png-csp-reading`, base `86eed62`; started 15:58, completed 15:58.
- **What the code does:** nothing changes in the code. `decisions.md` records that the one rendered page a path past the proxy can reach (the invoice page, by an id ending in `.png`) is always its not-found page, which holds nothing to inject into, so its missing Content-Security-Policy guards nothing (D194).
- **What it brings:** the gap E30's test exposed is known to be harmless today, with the condition that would make it matter, so nobody needs to chase it, and someone adding such a route knows. Decisions: D194.
- **Verification:** reading only (every route with a dynamic segment, and the invoice page's id check). Only `docs/ai/` changes; `test:affected` selects nothing. Reviewer: none, no code changed.
- **Previous items' CI:** E38 (`c4c4ea0`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41657479553; E39 (`86eed62`) pending at this entry; its outcome goes in E41's entry.

## E41 — started 16:03: how much of the step's gain reaches a crowded frame, measured (kind: speed)

## E41 — how much of the step's gain reaches a crowded frame, measured (completed)

- Branch `2026-11-02-e41-frame-record`, base `8d765e2`; started 16:03, completed 16:06.
- **What the code does:** nothing changes in the code. `decisions.md` records the render benchmark before and after this run's speed changes (D195).
- **What it brings:** what the player of a crowded run gets from the speed work: with 2,000 cats on a throttled browser, about 10–14% more frames (about 40 → 45 fps) and fewer slow ones. Decisions: D195.
- **Verification:** the render benchmark, two interleaved pairs (3 passed each run; figures in D195); the app's files copied in for the old side and restored (`git diff -- app/` empty after). Only `docs/ai/` changes; `test:affected` selects nothing. Reviewer: none, no code changed.
- **Previous items' CI:** E39 (`86eed62`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41658865207; E40 (`8d765e2`) pending at this entry; its outcome goes in E42's entry.

## E42 — started 16:08: a test that names every route ending in a dynamic segment (kind: security and quality)

## E42 — a test that names every route ending in a dynamic segment (completed)

- Branch `2026-11-02-e42-dynamic-routes`, base `c59d647`; started 16:08, completed 16:09.
- **What the code does:** `tests/unit/dynamic-routes.test.ts` (new) finds every page and route handler under `app/` whose last path segment is dynamic and fails if there is one besides the invoice page, saying what to check before adding it.
- **What it brings:** the one way E40's gap could become a hole (a new route that a path ending in `.png` reaches past the proxy and its security headers) now stops at a test with instructions, instead of shipping unnoticed. Decisions: D196.
- **Verification:** prettier 0; lint 0, 0 warnings (baseline 0); `tsc` 0; the test 1 passed, and shown able to fail (a planted route, deleted after); `node scripts/unit-projects.mjs`: 60 files, each in one project (dashboard 24). `test:affected --base Nightrun`: unit `vitest related tests/unit/dynamic-routes.test.ts` → 1 passed; e2e 0 specs. Reviewer: none, a test-only change (D196).
- **Previous items' CI:** E40 (`8d765e2`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41659773111; E41 (`c59d647`) pending at this entry; its outcome goes in E43's entry.

## E43 — started 16:13: how long the lists of cats a projectile touched get, counted (kind: speed)

## E43 — how long the lists of cats a projectile touched get, counted (completed)

- Branch `2026-11-02-e43-touched-set`, base `7f22056`; started 16:13, completed 16:14.
- **What the code does:** nothing changes in the code. `decisions.md` records that the one possibly quadratic check in `moveProjectiles` is small in practice (D197).
- **What it brings:** a suspicion about the projectile step settled by counting, so no later item rewrites it for nothing. Decisions: D197.
- **Verification:** a throwaway counter over the step benchmark (removed; `git diff 7f22056 -- app/` empty). Only `docs/ai/` changes; `test:affected` selects nothing. Reviewer: none, no code changed.
- **Previous items' CI:** E41 (`c59d647`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41660688578; E42 (`7f22056`) pending at this entry; its outcome goes in E44's entry.

## E44 — started 16:18: the README says what the proxy header counts behind two proxies, and with a port (kind: security and quality)

## E44 — the README says what the proxy header counts behind two proxies, and with a port (completed)

- Branch `2026-11-02-e44-readme-proxy`, base `37c6070`; started 16:18, completed 16:19.
- **What the code does:** nothing changes in the code. `README.md`'s paragraph on the login and sign-up limits says that behind two proxies the last `X-Forwarded-For` entry is the outer proxy's address (every client one count), what to set up instead, and that a port is dropped.
- **What it brings:** an operator deploying behind a CDN and a load balancer learns before going live that the per-address limits would then count everyone as one client, and how to avoid it. Decisions: D198.
- **Verification:** reading only (`clientAddress` takes the right-most entry, D184). Markdown only: prettier does not check it; `test:affected` selects nothing. Reviewer: none, a documentation change.
- **Previous items' CI:** E42 (`7f22056`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41661621023; E43 (`37c6070`) pending at this entry; its outcome goes in E45's entry.

## E45 — started 16:24: the arrivals open now, kept until the next one opens (kind: speed)

## E45 — the arrivals open now, kept until the next one opens, measured (completed)

- Branch `2026-11-02-e45-open-arrivals`, base `2b2b74f`; started 16:24, completed 16:25.
- **What the code does:** nothing changes in the code: the change this item measured gained nothing and was not kept (D199).
- **What it brings:** the arrivals ruled out as a cost of the step's own body, by measurement. Decisions: D199.
- **Verification:** with the change, E20's fingerprints unchanged; three interleaved timing pairs, overlapping at every size (D199). `git diff 2b2b74f -- app/` is empty. Only `docs/ai/` changes; `test:affected` selects nothing. Reviewer: none, no code changed.
- **Previous items' CI:** E43 (`37c6070`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41662543463; E44 (`2b2b74f`) pending at this entry; its outcome goes in E46's entry.

## E46 — started 16:29: a warning when the trusted proxy header is named but missing (kind: security and quality)

## E46 — a warning when the trusted proxy header is named but missing (completed)

- Branch `2026-11-02-e46-missing-header`, base `fbfb0e0`; started 16:29, completed 16:36.
- **What the code does:** `clientAddress` in `app/lib/sign-up-limit.ts` warns once a server instance, in production, when a trusted proxy header is named (`TRUSTED_PROXY_HEADER` or `VERCEL=1`) but a request comes without a usable address in it; the message names the header, never what the request held. What it returns is unchanged. `tests/unit/proxy-header-warning.test.ts` (new) checks when it speaks and when not.
- **What it brings:** a proxy that does not set the header the app trusts (a misconfiguration that silently makes every client share one sign-up limit and one failed-login count) is now said in the server's log, where before only the case of no header named was. Decisions: D200–D201.
- **Verification:** prettier 0; lint 0, 0 warnings (baseline 0); `next typegen` + `tsc` 0; the new test fails on the code before (D200). `test:affected --base Nightrun` printed `FULL` (`sign-up-limit.ts` reaches `auth.ts`), so the full suites ran: `npm test` 60 files passed, 1 skipped; 1169 passed, 52 skipped (E32: 1166; three more since: E42's and this item's two); database tests 52 passed (52); build 0; `test:e2e` 169 passed, 2 skipped; `E2E_SERVER=start` 169 passed, 2 skipped (as at E32; E42's test is a unit test). After the reviewer's findings: `npm test` 1170 passed, 52 skipped (D201). Reviewer: approved; its Low and two Nits acted on.
- **Previous items' CI:** E44 (`2b2b74f`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41663466258; E45 (`fbfb0e0`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41664356570.

## E47 — started 16:37: where in the step's own body a crowded step goes, by line (kind: speed)

## E47 — where in the step's own body a crowded step goes, by line (completed)

- Branch `2026-11-02-e47-step-lines`, base `36c5dd5`; started 16:37, completed 16:38.
- **What the code does:** `tests/bench/profile-step.mjs` (new, run by hand) bundles the Survival arena into plain JavaScript and profiles a crowded run under Node, printing each function's share and the hottest lines with their source; its output goes to the git-ignored `test-results/profile-step/`. No application code changed.
- **What it brings:** the next speed task can see which lines a crowded step spends its time on, which no profile this run could show until now; and `decisions.md` records what it shows today (D202). Decisions: D202.
- **Verification:** prettier 0; lint 0 on it (and the tree, 0 warnings); the tool run: 1,949 cats, 0.706 ms a step, the tables printed (D202); its output ignored by git (`git check-ignore`). `tests/bench/` selects nothing (E16). Reviewer: none, a tool run on demand (D202).
- **Previous item's CI:** E46 (`36c5dd5`) pending at this entry; its outcome goes in E48's entry.

## E48 — started 16:42: the README names the step profiler (kind: security and quality)

## E48 — the README names the step profiler (completed)

- Branch `2026-11-02-e48-readme-profile`, base `dc4055d`; started 16:42, completed 16:42.
- **What the code does:** nothing changes in the code. `README.md`'s benchmark row names `node tests/bench/profile-step.mjs` (E47).
- **What it brings:** the next speed task finds the line-level profiler where the other checks are listed. Decisions: D203.
- **Verification:** the command as written was run in E47 (the tables printed). Markdown only: prettier does not check it; `test:affected` selects nothing. Reviewer: none, a one-line documentation change.
- **Previous item's CI:** E46 (`36c5dd5`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41665694030; E47 (`dc4055d`) pending at this entry; its outcome goes in E49's entry.

## E49 — started 16:47: whether emptying a cell list costs its refill, measured (kind: speed)

## E49 — whether emptying a cell list costs its refill, measured (completed)

- Branch `2026-11-02-e49-cell-refill`, base `045d794`; started 16:47, completed 16:48.
- **What the code does:** nothing changes in the code. `decisions.md` records a measured cost in the grid (emptying its cell lists makes them grow again each step) and why it was not built now (D204).
- **What it brings:** the next speed task has a known, sized gain to weigh (about 1.5% of a crowded step) and what it would cost to take. Decisions: D204.
- **Verification:** a micro-benchmark in the scratchpad (three runs each way, the same results both ways); the arena's figure scaled from E47's profile, not measured in the arena. Only `docs/ai/` changes; `test:affected` selects nothing. Reviewer: none, no code changed.
- **Previous item's CI:** E47 (`dc4055d`) CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/41666590552; E48 (`045d794`) pending at this entry; its outcome goes in E50's entry, or the morning report.
