# Questions — night-2026-11-02

What needs a human: the question, the options and their consequences, the recommendation, and what was done meanwhile.

## Q1 — Check that a Vercel preview still reaches Neon (T1)

T1 makes the app check Neon's certificate and host name on Vercel (`ssl: 'verify-full'`). Nothing local or in CI can connect to Neon, so whether Neon's certificate chains to a CA in Node's store, and the host in Vercel's `POSTGRES_URL` matches it, is unchecked. Both are very likely (Neon uses a public CA). If either fails, every page that reads the database fails on Vercel.
**Recommendation:** open a preview deployment of `Nightrun` (or `dev`) and log in before this reaches `main`. Meanwhile: nothing; the change is merged on `Nightrun`.

## Q2 — Proposed task: check the certificate in `scripts/db.mjs` too

`npm run db:migrate` against Neon connects with the URL's `sslmode`, which `postgres` takes as "accept any certificate" for `require`. Options: (a) `sslmode=verify-full` in the URL a human uses for Neon (documentation only); (b) `db.mjs` uses `verify-full` for any host outside the private ranges. Recommendation: (b), as a task in the next plan. Not done: the plan's task names `app/lib/db.ts` only.

## Q3 — The login address limit is off without a trusted proxy (T3)

T3 counts failed logins per client address only where a trusted proxy header says what the address is: on Vercel (`VERCEL=1`, `x-real-ip`) or with `TRUSTED_PROXY_HEADER` set. Elsewhere every client is 'unknown', and counting them together would let a few strangers' typos lock everyone out (D13). Options: (a) as built: off without a proxy; (b) count 'unknown' as one client, with a much higher limit; (c) log a warning at startup in production without a proxy header (plan task 10 does this for the sign-up limit). Recommendation: (a), with task 10's warning naming both limits. Meanwhile: (a).

## Q4 — Apply migration 0013 to Neon before deploying T3

`db/migrations/0013_login_failures_last_attempt.sql` adds `login_failures.last_attempt`. The code from T3 on names that column in every login attempt, so a deployment that reaches Neon before the migration does would fail every login. **A human must run `npm run db:migrate` against Neon before `main` (or a preview using Neon) runs this code.** The code before T3 does not name the column, so migrating first is safe.

## Q5 — Apply migration 0014 to Neon, after checking no deployment names `image_url` (T4)

`db/migrations/0014_drop_customer_image_url.sql` drops `customers.image_url`. **A human runs `npm run db:migrate` against Neon**, after confirming every deployment using Neon (production on `main`, and any preview) runs code that never names the column: `main` since #31, and `Nightrun` from this run's start (fast-forwarded to `main`). A preview of an older branch would fail on its customer and invoice pages. Migrations 0013 (Q4) and 0014 go together; 0013 is needed first by T3's code, and 0014 needs nothing from the code.

## Q6 — `docs/backlog.md`'s "Login lockout: what it does not cover" lists a per-address limit as not built

T3 built it. The entry's first bullet is now out of date; the run left it, since no task names that entry. Recommendation: drop the bullet when merging.

## Q7 — Vercel and `engines.node` (T12)

`package.json` now says `"engines": { "node": ">=24" }`. Vercel picks a project's Node version from it, and with a range that opens upward it may move to a newer major when Vercel offers one. Options: (a) keep `>=24` as the plan said; (b) `24.x`, which pins the major on Vercel and still says "24 or newer" to nobody else. Recommendation: (b) if production should change major only on purpose. Meanwhile: (a), as written.
(Added after T12's review: CI tests on Node 24 exactly, `node-version: 24`, so with `>=24` production on Vercel could run a major CI never tested. That favours (b).)

## Q8 — `package-lock.json` does not repeat the new `engines` (T12)

npm copies the root package's `engines` into the lockfile's root entry; the run added it to `package.json` by hand, since any `npm install` is a human's (§3). `npm ci` does not mind, but the next `npm install` (a Dependabot pull request, say) will add those three lines, unexplained, to an unrelated change. **For a human:** `npm install --package-lock-only` adds just them, changing no dependency.

## Q9 — Everyone logs in again once when T16 deploys

T16 signs out any session made before it (its token has no login time; D92), so on the deploy to production every signed-in user is sent to the login once. The alternative, a week's grace for those sessions, left a stolen pre-deploy cookie usable for up to 30 days and could outlive a sign-out (the reviewer's finding). Recommendation: accept the one re-login; deploy when it bothers fewest. Nothing to do otherwise.

## Q10 — Proposed task: split `createArena` and the view's drawing (T22)

T22 moved what stands outside the two closures; `createArena` is still about 3,000 lines (spawning, weapons, collision, the step) and `arena-view.tsx`'s `draw` about 470. Splitting them means turning the closure's shared state into an object the parts take: a rewrite. Recommendation: a supervised task, done one concern at a time (spawning first: `spawnCat`, `spawnEvents`, the arrivals), with the arena's tests and a seeded run's full state compared before and after each; the drawing only with someone to look at the canvas. Meanwhile: nothing.

## Q11 — Where a crowded frame goes (E1, E3; for the next speed task)

Profiled tonight: a crowded simulation step (E1, D127) and a crowded frame in headless Chromium with ×4 CPU throttling (E3, D131). Over half the frame is the browser's own work, likely software raster of the canvas, which a GPU would change; of the JavaScript, the simulation is about twice the drawing. E1 made the step 4–8% faster (the grid's keys). **Recommendation:** profile one crowded run on a real weak machine with Chrome's Performance panel, headed, GPU on, before the next drawing change; if the simulation dominates there too, `separate`, `walkCat` and `moveCat` are where its time goes.

## Q12 — The login's open redirect, found and fixed (E8)

For a human to know: before E8, a link to `/login?callbackUrl=//evil.example/...` made the login try to send the visitor to `evil.example`; the browser's `pushState` refused, so the visitor was left on the login page instead (D140). Production (`main`) has the same default; the fix (D141, a `redirect` callback) reaches it with the next merge. Nothing for a human to decide; worth knowing for the release notes.

## Q13 — Proposed task: the test selector and `tests/bench/` (E11)

`scripts/affected-tests.mjs` prints `FULL` for a change to `tests/bench/` (D147), so a benchmark edit costs the whole of every suite, though neither `npm test` nor `npm run test:e2e` runs those files. **Proposal for the next plan:** select nothing for `tests/bench/` (as for `docs/`), with a case in `tests/unit/affected-tests.test.ts`. A change to the selector runs the full suites at its own gate (§2.1). Needs no decision beyond putting it in a plan.
