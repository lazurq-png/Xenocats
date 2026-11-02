# Night run 2026-11-02

## Goal

Tuesday 08:00

## Tasks

In order of priority: the ones near the top matter most if the night runs short.

1. **Verify the database's certificate in production.** `app/lib/db.ts` connects
   with `ssl: 'require'`, which the `postgres` library takes as "encrypt, but
   accept any certificate", and the option overrides the URL's `sslmode`. On
   Vercel (`VERCEL=1`) connect with `'verify-full'`; elsewhere keep `'require'`,
   since the development and CI servers use self-signed certificates. Done: the
   choice is a small tested function, and local and CI runs connect as before.
2. **One session check per request.** Every `auth()` call runs the session query
   (`isCurrentSession`), and the dashboard overview calls it three times beside
   the proxy's (cards, latest invoices, revenue chart). Memoise the session per
   request with React `cache()` (`app/lib/session.ts`). Done: a test shows one
   query for several calls in one request.
3. **A login limit per client address.** `app/lib/login-limit.ts` limits one
   login name; one address can still try many names, and anyone can lock a known
   name. Add a per-address count in front of it, keyed as `sign-up-limit.ts`
   keys addresses, and prune `login_failures` rows whose lock and count have
   expired. Done: tests for the address limit, the per-name limit unchanged, and
   the pruning.
4. **Drop `customers.image_url`.** No code reads or writes it, and `main`,
   `dev` and `Nightrun` no longer name it (`docs/backlog.md`). A new migration
   drops the column; `tests/unit/data.test.ts` stops inserting it; the backlog
   entry comes out. Applying it to Neon stays a human's `db:migrate`: say so in
   `questions.md`.
5. **"Pending" means unpaid and not yet due, everywhere.** The dashboard's
   Pending card and chart and the customers table's Pending total add up every
   unpaid invoice, overdue included, while the invoice list splits Pending from
   Overdue. Relabel those figures "Unpaid" (the backlog's option (a)), and take
   the entry out of the backlog.
6. **One time zone.** Invoices are dated by the UTC day while `CURRENT_DATE` is
   the database session's day. Set `TimeZone: 'UTC'` on the app's connection
   (the backlog's option (a)), with tests for an invoice created near midnight;
   take the entry out of the backlog.
7. **Plausibility checks on leaderboard runs** (question Q3 of the
   2026-10-17 run). `recordSurvivalRun` checks only time and rate. Refuse a run
   whose cats sent home are more than the game could send home in its time, from
   the game's own numbers. Done: tests at the limit and past it.
8. **Co-op patches and swatted cats get an owner** (Q5 of the 2026-10-17 run).
   They use player 1's passives and credit whoever made them. Done: each uses
   its own player's passives and credits that player, with a co-op test.
9. **CI.** In `.github/workflows/ci.yml`: a `concurrency` group that cancels a
   superseded run on the same branch; `npx prettier --check .` in the checks
   job; the database-tests step fails when nothing passed (the backlog's guard);
   on pull requests into `main`, list new `db/migrations/*` files in the job
   summary so a deploy is never ahead of Neon. Add `.github/dependabot.yml`
   (npm weekly, minor and patch grouped, and GitHub Actions), targeting `dev`.
10. **Small cleanups.** Remove `scripts/seed.js` (gone) from `tsconfig.json`'s
    `include`; `"dev": "next dev"` (Turbopack is the default);
    `poweredByHeader: false` in `next.config.ts`; a warning at startup in
    production when no trusted proxy header is configured for the sign-up
    limit (`sign-up-limit.ts`).
11. **First run in the README.** A section that takes a new contributor from
    clone to a running app: PostgreSQL with TLS, `.env`, `db:migrate`,
    `db:seed`, `npm run dev`, the demo login. And `.env.example` with every key
    the app reads, commented, with no values. **This task lifts §3's rule on
    `.env*` files for writing `.env.example` only**; `.env` itself stays
    untouched. Also: a short table of the checks in the README, which
    `CLAUDE.md` §9 then points to rather than the other way round, and a line
    on what `.superdesign/init/*.md` are for.
12. **CI, more.** On pull requests, `actions/dependency-review-action` (it fails
    only on vulnerabilities a pull request adds, so today's zod advisory does not
    turn CI red), and a CodeQL workflow for JavaScript and TypeScript. Add
    `"engines": { "node": ">=24" }` to `package.json` and an `.nvmrc` holding
    `24` (no dependency changes).
13. **Survival specs on the page's clock.** `tests/e2e/survival.spec.ts` waits
    in real time and fails under CPU load (CLAUDE.md §9). Drive its timed
    waits with `page.clock`, as `cats.spec.ts` does. Done: the specs pass at
    6 workers three times in a row, where they failed before.
14. **Unit test groups by folder.** The `Unit tests (...)` steps in `ci.yml`
    list files by hand. Make them Vitest projects (or directories) chosen by
    glob, keeping the jsdom files in a jsdom group, so a new test file needs no
    CI edit; keep the "Every test file is in a group" step true or replace it
    with an equivalent check. Update `.claude/rules/testing.md` to match.
15. **Cache the leaderboard.** `/cats` reads every finished run on every
    request. Cache `fetchLeaderboard`'s board with a tag that
    `recordSurvivalRun` revalidates, without enabling Cache Components for the
    whole app; the viewer's own row stays per request.
16. **A shorter session.** Set the session's `maxAge` to 7 days (it is Auth.js's
    default of 30), so a stolen cookie works for a week at most. Test it in
    `tests/unit/auth-config`.
17. **A Content-Security-Policy with a nonce.** `script-src 'unsafe-inline'`
    leaves XSS defence to React's escaping alone. Build the CSP per request in
    `proxy.ts` with a nonce, as Next's documentation shows, keep the other
    headers in `next.config.ts`, and keep `next dev`'s allowances. Done:
    `security-headers.spec.ts` checks the nonce, and every browser spec passes
    under both `next dev` and `next start`.
18. **Rules load where they apply.** `.claude/rules/*.md` all load in every
    session (about 31 KB). Give `frontend.md`, `backend.md`, `database.md`,
    `testing.md` and `security-review.md` `paths:` frontmatter for the files
    they govern; `architecture.md` and `debugging.md` stay loaded. Update
    `CLAUDE.md` §2 and `.claude/README.md`'s "How rules load".
19. **A shorter `CLAUDE.md`.** 596 lines against Claude Code's target of under
    200. Keep the repository map, the checks, the environment and database
    facts, and the pointers; move the generic process sections (§§3, 5, 7, 10,
    12–14) to `.claude/docs/`, losing no rule specific to this repository.
    Replace "read `AGENTS.md` first" with an `@AGENTS.md` import, which is the
    only way Claude Code loads it beside a `CLAUDE.md`. Where `.claude/docs/`
    repeats the same loop three times, keep one copy and link to it.
20. **A real `.claude/settings.json`.** Deny rules that mirror the night-run
    skill's §3 (`git push --force`, `--delete`, reading or editing `.env`,
    `npm install`), which hold even in bypass mode, and a PreToolUse hook that
    refuses `db:seed` and `db:reset` when `POSTGRES_URL` names a host outside the
    private ranges. Nothing that blocks what the skill allows a run to do. Update
    the three documents that say the repository has none (`.claude/README.md`,
    `.claude/docs/ai-workflow.md`, the skill's "Read this first") and add to
    `.claude/agents/reviewer.md` that it never commits or pushes.
21. **A `verify` skill.** `.claude/skills/verify/SKILL.md`: CLAUDE.md §9's
    sequence for a change (Prettier on the changed files, lint, type check,
    `npm run test:affected`), cheapest first, stopping at the first failure.
22. **Split the largest game modules.** `app/ui/xenocats/arena.ts` (3,925
    lines), `arena-view.tsx` (1,951) and `arsenal.ts` (1,800), by concern
    (spawning, weapons, collision, drawing). No behaviour change: every
    existing test passes untouched, and the Survival benchmark moves no more
    than its noise.

## Exploration

Speed on a weak machine (where a step of the simulation's cat loop goes, Q9 of
the 2026-10-17 run); security and quality.
