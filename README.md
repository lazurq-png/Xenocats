# Xenocat Analytics

An invoices-and-customers dashboard, haunted by alien cats that go after your
cursor. Built with the Next.js App Router, PostgreSQL and Tailwind CSS.

- `/`: the landing page
- `/login`: sign in, with a username or an email
- `/signup`: make an account with a username
- `/dashboard`: overview, invoices and customers (needs a session)
- `/dashboard/settings`: change your password
- `/cats`: every cat, with a button to summon it
- `/cats/survival`: Survival, a run of 5, 10 or 15 minutes, or an endless one,
  against the horde

## First run

From a clone to the app running on your machine:

1. **Node 24 and npm.** Then `npm ci`, and `npx playwright install chromium` if
   you will run the browser tests.
2. **PostgreSQL 17, with TLS on.** The app connects with `ssl: 'require'` and
   refuses a server without TLS, so a local server needs a certificate; a
   self-signed one will do (`ssl = on`, `ssl_cert_file` and `ssl_key_file` in
   `postgresql.conf`). Make a database and a role that may create schemas in it.
   The app's tables live in a schema of their own (`xenocats`), never in `public`.
3. **`.env`.** Copy `.env.example` to `.env` and fill it in: `POSTGRES_URL` names
   the server, the database and the schema, e.g.
   `postgres://user:password@localhost:5432/xenocats?sslmode=require&search_path=xenocats`;
   `AUTH_SECRET` is any long random string
   (`node -e "console.log(crypto.randomBytes(32).toString('base64'))"` prints one);
   `AUTH_URL` is `http://localhost:3000`.
4. **The schema and the demo data.** `npm run db:migrate` creates the schema and
   applies `db/migrations/`; `npm run db:seed` loads the demo data from
   `app/lib/placeholder-data.ts`. (`npm run db:reset` drops the schema and does
   both again. Seeding and resetting refuse any host outside the private network
   ranges.)
5. **`npm run dev`**, then open http://localhost:3000 and log in as the demo user:
   `user@nextmail.com`, password `123456`.

## Development

The app reads `POSTGRES_URL`, `AUTH_SECRET` and `AUTH_URL` from `.env`, and
optionally `LOGIN_MAX_FAILURES` and `LOGIN_LOCK_MINUTES`: after that many
failed logins in a row a login name (a username or an email) is refused for
that many minutes (default 5 and 15). `LOGIN_ADDRESS_MAX_FAILURES` (default 20) does the
same for one client address, across every name it tries, for the same minutes.
`SIGNUP_MAX_PER_DAY` caps the accounts made from one address a day
(default 2). The address is believed only from a proxy that sets it: on Vercel
`X-Real-IP`; elsewhere set `TRUSTED_PROXY_HEADER` to `x-real-ip` or
`x-forwarded-for` (the last entry), and only if the proxy in front of the app
overwrites that header. Without one, every client shares the one daily sign-up
limit, and failed logins are counted per login name only.

## Checks

| Check | Command |
| ----- | ------- |
| Lint | `npm run lint` (ESLint 9, `eslint-config-next` core-web-vitals) |
| Format | `npx prettier --check <the files you changed>` (`npx prettier --check .` for all) |
| Type check | `npx next typegen && npx tsc --noEmit` |
| Unit tests | `npm test` (Vitest, `tests/unit/`) |
| Database tests | `DATABASE_TESTS=1 npx vitest run tests/unit/data` (opt-in; their own schema, `xenocats_vitest`) |
| Browser tests | `npm run test:e2e` (Playwright and Chromium, `tests/e2e/`; their own schema, `xenocats_test`) |
| Affected tests | `npm run test:affected -- --base <ref> [--run]` (the unit and browser tests a change can reach) |
| Build | `npm run build` |
| Speed benchmarks | By hand, never in CI; they print timings and assert no speed. The Survival step: `npx vitest run -c vitest.bench.config.mts` (`tests/bench/`). Its drawing, in Chromium throttled as a weak machine: `BENCH=1 E2E_NO_CAT_DEPS=1 npx playwright test tests/e2e/benchmark.spec.ts` |
| In a browser | `npm run dev`, then open http://localhost:3000 |

CI (`.github/workflows/ci.yml`) runs lint, the format and type checks, the unit,
database and browser tests and the build on pushes to `dev` and `Nightrun` and on
pull requests into `Nightrun`, `dev` and `main` (a pull request from `dev` into
`main` that CI already passed on `dev` skips them; `CLAUDE.md` §9).

## Design

The visual design comes from the Canva mockup "Xenocat Analytics website
mockup": a midnight background, lime and violet accents, Orbitron headings,
Montserrat on the public pages and Roboto in the dashboard. Its colours are
Tailwind tokens in the `@theme` block of `app/ui/global.css` (`void`, `panel`, `line`, `plasma`,
`aura`, `cream`), its fonts are in `app/ui/fonts.tsx`, and its artwork (cats,
hero, logo marks, avatars) is in `public/xenocats/`.

## Design tool context

`.superdesign/init/*.md` (components, extractable components, layouts, pages,
routes, theme) describe the app for the Superdesign design agent: what it reads
before it proposes a design, so its mockups use the app's own primitives, tokens
and routes. Nothing in the app, its build or its tests reads them. They are a snapshot:
when a change alters what they describe, update them with it, or they go stale.
