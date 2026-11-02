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
