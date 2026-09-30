# Questions — night-2026-09-25

## Q1 — Git author email is a placeholder

Every commit this run makes is authored as
`Martin Larsson <id+lazurq-png@users.noreply.github.com>`. `id` is not a real
GitHub user id, so GitHub will not link these commits to the account. The run
does not change git config (§3: nothing outside the task's files).

- **Fix for future commits:** `git config user.email "<your numeric id>+lazurq-png@users.noreply.github.com"`
  (GitHub → Settings → Emails shows the exact address).
- **Existing commits** keep the placeholder unless history is rewritten, which
  would need a force-push. Recommendation: fix the config and leave history.

## Q2 — `POSTGRES_URL` is not usable locally

`npm run build` connects to `127.0.0.1:5432`, the `postgres` library's default
when `POSTGRES_URL` is unset, so the local `.env` does not provide a reachable
`POSTGRES_URL`. Consequences: the build is not part of this run's gate, and any
check that renders a database-backed page cannot run locally.

- **Fix:** put the hosted database's connection string in `.env` as
  `POSTGRES_URL=...` (and `AUTH_SECRET`), then `npm run build` should pass.

## Q3 — Upgrade `@types/node` (22.10.7 → ≥22.12)?

Vite 7/8 (and so current Vitest and `@vitejs/plugin-react`) declare an optional
peer `@types/node@"^20.19.0 || >=22.12.0"`. With 22.10.7 pinned, `npm install`
prints `ERESOLVE overriding peer dependency` and `@vitejs/plugin-react` /
`vite-tsconfig-paths` could not be installed at all (D2). Not a blocker: tests
and the type check pass without them.

- **Option A (recommended):** `npm install -D @types/node@^22.12` — types only,
  clears the warning, and allows the Vite plugins later if ever wanted.
- **Option B:** leave it; the warning stays.

Addendum (T2): `AUTH_SECRET` is missing locally too — `next dev` logged
`MissingSecret` until the Playwright config supplied a throwaway one (D4). The
running app needs a real one in `.env` for login to work.

## Q4 — Add the `POSTGRES_URL` repository secret (resolved: T2 CI build passed)

CI's *build* job reads `secrets.POSTGRES_URL` (plan task 2). Until it is set in
GitHub → Settings → Secrets and variables → Actions, that job fails on every push
with a connection error, while *checks* and *e2e* are unaffected (D4). The run
records such failures as "CI failed: environment" and spends no repair cycles on
them (SKILL.md §2 step 6).

## Q5 — Stop tracking `next-env.d.ts`?

It is already in `.gitignore`, but tracked, and `next dev` / `next build` keep
rewriting it with different content (D6). Recommendation:
`git rm --cached next-env.d.ts` and commit. The run does not, because removing a
file from the repository is reserved for a human (§3).

## Q6 — Keep the Next.js agent-rules block in `AGENTS.md`?

Committed in T2 (D5). If you do not want it, delete the block and add
`agentRules: false` to `next.config.ts`; otherwise `next dev` re-adds it.

## Q7 — Delete `app/lib/placeholder-data.ts` and change the demo password?

Nothing imports `app/lib/placeholder-data.ts` any more (it fed the deleted seed
route), yet it is still listed in `tsconfig.json` and still contains the
course's demo login, `user@nextmail.com` / `123456`. If the hosted database was
seeded from it, that login works on the deployed dashboard for anyone who has
read the Next.js course.

- **Recommended:** change that user's password in the database (a write the run
  may not make), then delete the file and its `tsconfig.json` entry (a deletion
  the plan did not permit).

## Q8 — Leftovers from the course branding

T10 replaced every visible Acme name and logo, but left three files in place
because deleting or renaming a file the run did not create is reserved for a
human (§3):

- `app/ui/acme-logo.tsx` now holds the Xenocat logo (`XenocatLogo`). Suggest
  `git mv app/ui/acme-logo.tsx app/ui/xenocat-logo.tsx` and updating its four
  imports.
- `public/hero-desktop.png` and `public/hero-mobile.png` show the Acme dashboard
  and are no longer used (the home page draws its own preview). Suggest deleting.
- `app/ui/home.module.css` (the course's black triangle) is no longer used.
  Suggest deleting.
- `public/opengraph-image.png` and `metadataBase` in `app/layout.tsx` still come
  from the course (`next-learn-dashboard.vercel.sh`); a real domain and share
  image are a product decision.
