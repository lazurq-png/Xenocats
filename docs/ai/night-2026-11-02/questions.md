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
