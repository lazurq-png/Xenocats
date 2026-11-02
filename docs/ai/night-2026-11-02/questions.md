# Questions — night-2026-11-02

What needs a human: the question, the options and their consequences, the recommendation, and what was done meanwhile.

## Q1 — Check that a Vercel preview still reaches Neon (T1)

T1 makes the app check Neon's certificate and host name on Vercel (`ssl: 'verify-full'`). Nothing local or in CI can connect to Neon, so whether Neon's certificate chains to a CA in Node's store, and the host in Vercel's `POSTGRES_URL` matches it, is unchecked. Both are very likely (Neon uses a public CA). If either fails, every page that reads the database fails on Vercel.
**Recommendation:** open a preview deployment of `Nightrun` (or `dev`) and log in before this reaches `main`. Meanwhile: nothing; the change is merged on `Nightrun`.

## Q2 — Proposed task: check the certificate in `scripts/db.mjs` too

`npm run db:migrate` against Neon connects with the URL's `sslmode`, which `postgres` takes as "accept any certificate" for `require`. Options: (a) `sslmode=verify-full` in the URL a human uses for Neon (documentation only); (b) `db.mjs` uses `verify-full` for any host outside the private ranges. Recommendation: (b), as a task in the next plan. Not done: the plan's task names `app/lib/db.ts` only.
