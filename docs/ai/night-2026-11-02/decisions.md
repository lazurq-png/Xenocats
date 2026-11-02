# Decisions — night-2026-11-02

Numbered non-obvious choices, with their reasons.

## T1 — Verify the database's certificate in production

- **D1** Acceptance criteria: (a) `app/lib/db.ts` connects with `ssl: 'verify-full'` when `VERCEL=1`, `'require'` otherwise; (b) the choice is a small function with its own unit test; (c) local and CI runs connect as before (`'require'`); (d) evidence that `'verify-full'` really checks the certificate.
- **D2** The function lives in its own module, `app/lib/db-ssl.ts`, not in `db.ts`, so a unit test can import it without creating the database client. It takes `env` as `trustedProxyHeader` (`sign-up-limit.ts`) does.
- **D3** For (d), an opt-in database test (`tests/unit/data.test.ts`, "TLS to the database") connects to the development or CI server, both self-signed, with the Vercel mode and expects a certificate error, and with the other mode expects `pg_stat_ssl.ssl = true`. It cannot show that Neon's certificate passes; see Q1.
- **D4** `scripts/db.mjs` (migrations, run by a human against Neon) still follows the URL's `sslmode` and so does not check the certificate either. That is outside the task's words (it names `app/lib/db.ts`); it is proposed in Q2 instead.

## T2 — One session check per request

- **D5** Acceptance criteria: (a) `app/lib/session.ts` reads the session through React `cache()`, so the overview's three components share one `auth()` (one `isCurrentSession` query) per request; (b) a test shows one call for several in one request, and a new call in the next request.
- **D6** Only `currentUserId()` goes through the cached `currentSession()`. The direct `auth()` calls in `actions.ts`, the export route, `cats/survival/page.tsx` and `leaderboard.tsx` each run once per request on their own page or action, so caching them saves nothing; they stay as they are.
- **D7** The test loads React's server build (the one Next gives Server Components; the client build's `cache` never memoises) and gives it a per-request cache through its dispatcher's `getCacheForType`, as React's server renderer does. That is a private React detail; if it changes, `cache` calls through and the test fails on its count rather than passing silently. A real Flight render in Vitest would need the `react-server` condition for the whole run.

## T3 — A login limit per client address

- **D8** Acceptance criteria: (a) each login attempt from a known client address is counted under that address, before the login name, keyed as the sign-up limit keys addresses (`clientKey`: HMAC of the address block with `AUTH_SECRET`); (b) past its limit the address is refused before any name is counted or any password compared; (c) the per-name lockout behaves as before; (d) `login_failures` rows whose lock and count have run out are pruned; (e) tests for each.
- **D9** Same table, own key prefix (`login-address:<hash>`), same counting statement (`claimAttempt`), so concurrent attempts are held to N as names are. A new column `last_attempt` (migration 0013) is needed: without a time, "a count that has expired" cannot be told from a live one.
- **D10** A success refunds its own attempt for the address (and the lock that attempt set, if it was the Nth) rather than clearing the address's count; clearing would let a client with an account of its own reset the count between guesses at other names.
- **D11** An address's count is forgotten after `lockMinutes` without an attempt (`forgetAfterMinutes`), so the failures of a shared address (an office, a NAT) do not pile up over weeks. A login name's count does not do this (criterion (c)): it gets `null`, which leaves its statement's outcome as before.
- **D12** Defaults: 20 failures per address (`LOGIN_ADDRESS_MAX_FAILURES`), locked for the same `LOGIN_LOCK_MINUTES`. Four times the per-name 5, so one household mistyping a few names is not locked; a guesser at one address gets 20 tries per 15 minutes across all names instead of 5 per name.
- **D13** No trusted proxy header (`trustedProxyHeader()` is null, as in development, CI and any deployment off Vercel without `TRUSTED_PROXY_HEADER`): every client's address is 'unknown', so the address count is skipped there, and only the login name is counted. The sign-up limit counts 'unknown' as one client instead; for logins that would let a few strangers' typos lock out every user. See Q3.
- **D14** Pruning runs on every login attempt that gets past the name's count, before the user lookup, so both a right and a wrong password pay for it (the time still tells nothing). It deletes rows whose lock has run out (the next attempt would start from 1 anyway, so no behaviour changes) and rows with no lock and no attempt for a day. The last is the one change a login name sees: fewer than N failures, then a day without an attempt, are forgotten.
- **D15** A locked address gets its own error code (`ADDRESS_LOCKED`) and message ("Too many failed logins from here."), since "for this account" would be wrong when the account is not locked.
- **D16** Two existing unit tests changed in what they match, not in what they assert: `credentials.test.ts` now looks for `DELETE FROM login_failures WHERE email` (the clear) instead of any `DELETE FROM login_failures` (which pruning also is), and `login-limit.test.ts` expects the count's parameters to be N, M and the quiet spell (null for a name).
- **D17** No browser test for the address limit: the test server has no trusted proxy, so every request is 'unknown' (D13) and the limit is off there. It is covered by unit tests (`credentials.test.ts`) and the real-database tests (`data.test.ts`); the existing `login-limit.spec.ts` covers the per-name limit in the browser.
- **D18** After the review: a quiet spell resets a count only when no lock is set (a lock set under a larger `LOGIN_LOCK_MINUTES` would otherwise let attempts through while it ran); pruning catches and logs its own errors, so housekeeping never fails a login; the README names `LOGIN_ADDRESS_MAX_FAILURES`.

## T4 — Drop `customers.image_url`

- **D19** Acceptance criteria: (a) a new migration (0014) drops the column, keeping every row; (b) `tests/unit/data.test.ts` inserts `image_url` nowhere it would no longer exist; (c) the backlog entry is gone; (d) `questions.md` says Neon's migration is a human's.
- **D20** The `image_url` inserts left in `data.test.ts` are all in "migrations on existing rows", on schemas migrated only up to 0011 or earlier, where 0001 makes the column `NOT NULL`: they model data from before 0012, and must name it. None runs on a schema with 0014. So (b) holds with them in place; removing them would break those tests, not finish the task. The new 0014 test inserts it only before 0014, and a customer without it after.
- **D21** `DROP COLUMN image_url`, not `IF EXISTS`: every database has had it since 0001, and a missing column would mean a schema these migrations did not make, which should fail loudly.
- **D22** `app/ui/customer-avatar.tsx`'s comment named 0012 as the column's end; it now names 0014. `.superdesign/init/components.md` (a design-tool snapshot of the component) still says "the stored `image_url`", which stays true as history; left alone.

## T5 — "Pending" means unpaid and not yet due, everywhere

- **D23** Acceptance criteria: (a) the dashboard's card, the revenue chart (legend, bar titles, the table of its figures, its caption) and the customer list's total (desktop header and phone label), which count every unpaid invoice, say "Unpaid"; (b) the invoice list, its filter, the status pill, the invoice form and the CSV keep "Pending" for unpaid and not yet due; (c) the backlog entry is gone.
- **D24** Labels only: the data's names (`pending` in `fetchCardData` and the monthly totals, `total_pending` and its `?sort=total_pending`) stay, so no query, bookmarked URL or test of the data changes. The skeleton's column list follows the table.
- **D25** A browser test (`dashboard.spec.ts`, "totals of every unpaid invoice") checks both pages for "Unpaid" and for no "Pending" heading or column; no existing test named those labels.

## T6 — One time zone

- **D26** Acceptance criteria: (a) the app's connection (`app/lib/db.ts`) starts every session with `TimeZone: 'UTC'`; (b) a test shows an invoice made today (UTC) is "due in 30 days" and not overdue by the app's own queries even where the server's day is another; (c) the backlog entry is gone.
- **D27** "Near midnight" made deterministic: the test cannot move the database's clock, so it takes a session zone that is across midnight from UTC at whatever hour it runs (UTC−12 before noon UTC, UTC+14 after), shows that session disagrees (another `CURRENT_DATE`, not 30 days), and that the app's connection does not. The other test (`current_setting('TimeZone')` is UTC on the app's client) is the one that fails without the change here: the development server already runs on GMT, so the first would pass without it.
- **D28** Only the app's client. The browser tests', database tests' and `scripts/db.mjs`'s own connections are not the app's and keep the server's zone; nothing in them reads `CURRENT_DATE` to decide what the app shows. A `TimeZone` in the URL would still override this (postgres.js puts URL parameters last), which is the explicit way to choose another.
- **D29** The backlog's "Decisions for a human" section is empty after T5 and T6; it now says "None open." rather than being removed, so the file's structure stays.
- **D30** After the review: the zone across midnight is chosen inside the test, just before its query (it was chosen at file load, a moment earlier, which could straddle noon UTC); a comment names the test that guards the change and the one that shows what it means.
- **D31** A flake, not identified: in T6's gate the full `npm test` ran 1 failed, 1126 passed (23:23), while the reviewer was running `tsc`/`next typegen`/ESLint beside it. The gate script kept only the summary lines, so which test failed is lost. Four full runs on the final state afterwards: 1127 passed, 52 skipped each, 0 failed. Recorded as a flake of unknown cause; from T7 on every gate keeps the whole output of each test command in the scratchpad, so a failure can be named. See the morning report's suggested rule changes.
