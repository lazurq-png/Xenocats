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
