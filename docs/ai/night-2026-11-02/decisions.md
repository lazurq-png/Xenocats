# Decisions — night-2026-11-02

Numbered non-obvious choices, with their reasons.

## T1 — Verify the database's certificate in production

- **D1** Acceptance criteria: (a) `app/lib/db.ts` connects with `ssl: 'verify-full'` when `VERCEL=1`, `'require'` otherwise; (b) the choice is a small function with its own unit test; (c) local and CI runs connect as before (`'require'`); (d) evidence that `'verify-full'` really checks the certificate.
- **D2** The function lives in its own module, `app/lib/db-ssl.ts`, not in `db.ts`, so a unit test can import it without creating the database client. It takes `env` as `trustedProxyHeader` (`sign-up-limit.ts`) does.
- **D3** For (d), an opt-in database test (`tests/unit/data.test.ts`, "TLS to the database") connects to the development or CI server, both self-signed, with the Vercel mode and expects a certificate error, and with the other mode expects `pg_stat_ssl.ssl = true`. It cannot show that Neon's certificate passes; see Q1.
- **D4** `scripts/db.mjs` (migrations, run by a human against Neon) still follows the URL's `sslmode` and so does not check the certificate either. That is outside the task's words (it names `app/lib/db.ts`); it is proposed in Q2 instead.
