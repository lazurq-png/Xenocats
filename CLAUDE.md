# CLAUDE.md

# Claude Code Operating Instructions

This file contains Claude Code-specific instructions.

The repository-wide engineering contract is defined in `AGENTS.md`. Read and follow it first.

This file defines how Claude should operate within that contract.

---

## 1. Operating Model

Use the following default loop for non-trivial engineering work:

**Explore → Plan → Implement → Verify → Review**

When verification fails:

**Repair → Verify → Review**

Do not skip exploration simply because the requested change appears straightforward if the task touches unfamiliar or interconnected code.

Do not produce a long plan for trivial changes.

Match investigation depth to task risk.

---

## 2. Start With Repository Context

Before implementing a significant task:

1. Read `AGENTS.md`.
2. Inspect the relevant project structure.
3. Locate the existing implementation.
4. Locate related tests.
5. Search for similar patterns.
6. Inspect relevant configuration.
7. Determine the smallest appropriate change.

Use repository evidence rather than assumptions about frameworks or conventions.

If the repository contains more specific instructions in nested directories, follow those instructions for files in their scope.

### This repository

Xenocat Analytics (`README.md`): an invoices and customers dashboard behind a
login, haunted by alien cats. It started as the Next.js App Router course's
dashboard; the course's look and assets have since been replaced.

| Concern | Where |
| ------- | ----- |
| Routes and pages | `app/` (App Router): `app/dashboard/**` (overview, invoices, customers), `app/login/` |
| Data reads | `app/lib/data.ts` — raw SQL through `postgres` tagged templates |
| Mutations | `app/lib/actions.ts` — Server Actions (`'use server'`), validated with zod |
| Types | `app/lib/definitions.ts` |
| Auth | `auth.ts` (NextAuth v5 beta, credentials + bcrypt), `auth.config.ts` (the `authorized` callback), `proxy.ts` (runs it on every request outside its matcher's exclusions) |
| UI | `app/ui/**` — Tailwind 4 (theme in `app/ui/global.css`), `@heroicons/react`, `clsx` |
| Schema and seed data | `db/migrations/*.sql`, `scripts/db.mjs` (`npm run db:migrate` / `db:seed` / `db:reset`), `app/lib/placeholder-data.ts` |

There is no ORM and no ADR record of decisions. The schema is the numbered SQL
files in `db/migrations/`, applied by `scripts/db.mjs` (`npm run db:migrate`).

If the task touches a specific domain, read the matching reference in `.claude/rules/` before implementing:

* `.claude/rules/architecture.md` — boundaries, layering, refactors
* `.claude/rules/frontend.md` — UI, accessibility, state, browser-facing work
* `.claude/rules/backend.md` — APIs, services, validation, errors, transactions
* `.claude/rules/database.md` — schemas, migrations, persistence, data integrity
* `.claude/rules/testing.md` — coverage strategy, flaky tests, definition of done
* `.claude/rules/debugging.md` — evidence-driven failure diagnosis
* `.claude/rules/security-review.md` — authn/authz, secrets, payments, external input

These are not auto-loaded — open the one(s) relevant to the task based on what the work touches.

---

## 3. Exploration

Exploration should answer the questions necessary to make a good implementation decision.

Prioritize:

* relevant symbols
* callers
* implementations
* tests
* configuration
* data flow
* API boundaries
* error handling
* neighboring patterns

Avoid reading large numbers of unrelated files.

Do not start editing simply because you have found one plausible implementation.

---

## 4. Planning

Create a plan before substantial implementation when the task involves:

* multiple files
* architectural changes
* database changes
* external integrations
* security-sensitive behavior
* complicated debugging
* uncertain ownership
* non-trivial migrations

A useful plan contains:

* current behavior
* desired behavior
* affected components
* implementation approach
* verification strategy
* risks
* open questions

The plan should be actionable rather than descriptive.

---

## 5. Implementation

Implement the smallest sufficient change.

Prefer existing:

* utilities
* components
* services
* repositories
* validation
* error handling
* state-management patterns
* API conventions

Avoid introducing a new abstraction unless the existing architecture cannot reasonably support the requested behavior.

Do not mix unrelated cleanup into feature work.

---

## 6. Use the Repository as Persistent Memory

Important project knowledge should live in the repository.

Use:

* `AGENTS.md`
* `CLAUDE.md`
* `.claude/rules/`
* documentation
* architecture records

for durable knowledge: what stays true about the project.

The state of a task in progress is not project knowledge. Supervised work keeps
it in the conversation and writes no task-state files (§11).

---

## 7. Context Management

Prefer targeted context over indiscriminate context.

Search for the exact:

* function
* class
* component
* endpoint
* error
* schema
* test
* configuration value

that matters.

Read surrounding code only when needed to understand behavior.

Before making a large edit, confirm that the relevant implementation and its callers are understood.

Do not repeatedly rediscover information already established in the conversation.

---

## 8. Subagents

Use specialized subagents when the task benefits from independent investigation or review.

Good uses include:

* repository exploration
* architecture investigation
* security review
* test analysis
* independent code review
* isolated research

Do not delegate tiny tasks merely to increase parallelism.

When using multiple agents:

* give each a narrow objective
* provide relevant context
* avoid overlapping edits
* prefer independent investigation over competing modifications
* synthesize results before implementation

For high-risk changes, an independent reviewer should ideally evaluate the implementation without relying on the builder's assumptions.

`.claude/agents/reviewer.md` is the standing reviewer for this — dispatch it by
name. It has no Edit or Write tool, follows the `code-review` skill, and knows
this repository's recurring failure modes. Give it the task, not your
reasoning, and let it find the diff itself.

---

## 9. Verification

Verification is mandatory for meaningful code changes.

In this repository the checks that exist are:

| Check      | Command                                          |
| ---------- | ------------------------------------------------ |
| Lint       | `npm run lint` (ESLint 9, `eslint-config-next` core-web-vitals) |
| Type check | `npx next typegen && npx tsc --noEmit`           |
| Unit tests | `npm test` (Vitest, `tests/unit/`)               |
| Browser tests | `npm run test:e2e` (Playwright + Chromium, `tests/e2e/`) |
| Affected tests | `npm run test:affected -- --base <ref> [--run]` (the unit and browser tests a change can reach) |
| Build      | `npm run build`                                  |
| Format     | `npx prettier --check <the files you changed>`   |
| Browser    | `npm run dev`, then open `http://localhost:3000` |

Use **npm**: the lockfile is `package-lock.json`. The `pnpm` block in
`package.json` is a leftover and nothing reads it. Node 24 is installed
system-wide and on `PATH`; no prefix is needed. Every check needs `node_modules`,
installed with `npm ci`; the browser tests also need Chromium
(`npx playwright install chromium`).

Run `next typegen` before `tsc`: `tsconfig.json` includes the route types Next
generates under `.next/`, and stale ones (from a build before a route was
deleted) fail the type check for no reason in the code.

`npm run test:e2e` starts its own `next dev` on port 3100 with a throwaway
`AUTH_SECRET`. Before the tests, `tests/e2e/global-setup.ts` drops and rebuilds
the `xenocats_test` schema on the database `POSTGRES_URL` names, and the test
server uses that schema, so browser tests may log in and submit forms. Every spec imports `test` from `tests/e2e/fixtures.ts`, whose `catsPaused` option (true by default) sets a window flag before each page loads so the dashboard's cats do not come: only the `cat-attacks` project (the specs that need a cat to come or be summoned) turns it off, and every other group waits for that project. A run of a few named specs sets `E2E_NO_CAT_DEPS=1` to skip the wait (`--no-deps` would also skip the login setup). Without
a `POSTGRES_URL`, or with `E2E_NO_DATABASE=1` when the server is unreachable
(its service stopped), the tests that need it skip; otherwise an unreachable server
fails the whole suite. It runs 4 browsers at once locally, and Playwright's
default (half the cores) in CI; `E2E_WORKERS` sets another. At the local
default of 6, the timing-sensitive Survival specs (`survival.spec.ts`) failed
from CPU load alone and passed when rerun by themselves; at 4 they pass and the
suite finishes sooner. A night run always uses 4 (the night-run skill).
`E2E_SERVER=start npm run test:e2e` runs the same tests against `next start`
instead, which needs an existing `npm run build`. When `next dev` detects an AI
agent, it rewrites the Next.js agent-rules block at the end of `AGENTS.md`. The
block is committed, so this normally changes nothing; a diff to it means a newer
Next changed the block's text. That diff is not part of a task's change: revert
it with `git checkout -- AGENTS.md` unless the task itself edited `AGENTS.md`.

`tests/unit/data.test.ts` runs every query in `app/lib/data.ts` against a real
database, and is **opt-in**: it runs only with `DATABASE_TESTS=1`
(`DATABASE_TESTS=1 npx vitest run tests/unit/data`), so a plain `npm test`
never touches a database. Opted in, it drops and rebuilds its own
`xenocats_vitest` schema (and a scratch `xenocats_vitest_migrations`) on the
server `POSTGRES_URL` names, and still skips like the browser tests do — no
URL, or `E2E_NO_DATABASE=1`. In CI the *build* job's "Database tests" step sets
it, on that job's database.

`lint` exits non-zero on **errors only**; warnings print without failing, so a
clean exit does not mean an empty report. Read the output; do not report "lint
passed" as though it found nothing.

Every file Prettier checks matches `.prettierrc`, so `npx prettier --check .`
should pass. `.prettierignore` leaves out Markdown (Prettier would pad its
tables), `.claude/worktrees/` (other sessions' checkouts) and `tsconfig.json`
(Next rewrites it in its own layout); Prettier skips those even when named.
A task still formats only the files it changed.

The running app, and possibly `npm run build` where a page prerenders, need
`POSTGRES_URL`, `AUTH_SECRET` and `AUTH_URL` in `.env`. **`POSTGRES_URL` is a
development database**: PostgreSQL 17 on the development PC itself
(`localhost:5432`, the Windows service `postgresql-x64-17`, TLS on with a
self-signed certificate because the app requires TLS), holding no data of value.
Vercel's preview and production deployments use their own `POSTGRES_URL`
(Neon), set in Vercel and never in `.env`. The app
uses its `xenocats` schema, the browser tests `xenocats_test`, the database unit
tests `xenocats_vitest`. The URL carries
the schema as `?search_path=`. The schema is defined by `db/migrations/*.sql`;
`npm run db:migrate` applies new ones, `db:seed` loads
`app/lib/placeholder-data.ts`, and `db:reset` rebuilds a schema from scratch.
`seed` and `reset` refuse any host outside the private network ranges. The
**production database** is Neon PostgreSQL, used by Vercel's preview and
production deployments; treat its data as real. No build or deploy migrates it:
a new migration reaches it only when a human runs `db:migrate` against it.
Never point `.env` at it, and never seed or reset it.

**CI** (`.github/workflows/ci.yml`) runs only where work is merged: on pushes
to `Nightrun` and `dev` and on pull requests into `Nightrun`, `dev` or `main`.
Merging into `main` runs nothing (its pull request was tested; the merge only
deploys, through Vercel). A pull request from `dev` into `main` skips the
tests when `main` changes no file `dev` lacks (its own commits are only the
merges of earlier releases) and CI already passed on that exact `dev` commit (the
workflow's *tested* job); any other pull request into `main` runs them. A push of any other
branch, a night run's task branches included, runs nothing; those are checked
locally. It has three jobs: *checks* (lint, type check, unit tests); *build* — `npm run build`
over a migrated and seeded `xenocats` schema, then every browser test against
`next start` (`E2E_SERVER=start`), in one `playwright test`; and *e2e* — the
specs for what differs under `next dev` (smoke, security headers, the dashboard
login) against it. The browser specs' groups are projects in
`playwright.config.ts` (`GROUPS`); a new spec goes in one, which the *checks*
job verifies. The *build* and *e2e* jobs run inside the Playwright image
(`mcr.microsoft.com/playwright`, its tag the locked `@playwright/test` version),
so Chromium is not installed on every run. Each starts a throwaway PostgreSQL
service container, which `scripts/ci-database.mjs` switches TLS on for and
points `POSTGRES_URL` at. So CI needs no repository secret and no outside
database, and runs the database tests too. Each job that starts Next
makes its own throwaway `AUTH_SECRET`. It runs on GitHub, not on your machine: never
report a CI result you have not observed. Do not check CI from a supervised
session; the night-run skill's read-only poll is the one exception.

A clean type check and build prove the code compiles, not that a page works.
For UI changes run the app and look (`.claude/rules/frontend.md`). A Playwright
test proves an interaction works, not that the page looks right.

Start with the narrowest useful verification.

Expand verification when the change has broader impact.

**Run the selection, not the suites.** `npm test` and `npm run test:e2e` in
full are for a `FULL` selection or when the user asks; CI runs every suite
wherever work is merged, so a local full run of a change the selector placed
proves nothing CI will not. `npm run test:affected` compares the tree with
`--base` (by default whichever of `main`, `dev`, `Nightrun` is nearest: on one of
them, the uncommitted work) and
prints the tests to run: `vitest related` over the changed files, and the browser
specs that visit a route the change reaches. A change behind the dashboard's cats
(`cat-layer.tsx`) selects only the cat-attacks specs there, since every other spec
runs with the cats paused. For a change to a query, the schema
or the database tests themselves it also prints a `database:` line, naming the
opt-in database tests that `vitest related` would skip. When it cannot place a changed file
(configuration, auth, the root layout, seed data, the schema) it says `FULL`
and names the file; then run the full suites. Cheap checks go first (prettier,
lint, type check), the slow ones after, one at a time: the browser tests are
timing-sensitive and fail under load. While repairing, rerun only the failing
test (`npx playwright test <spec> -g "<title>"`, `--last-failed`), then the
selection once on the final state.

Never report a verification result that was not actually observed.

---

## 10. Debugging

When a test, command, or runtime behavior fails:

1. reproduce it
2. inspect the exact failure
3. identify the relevant execution path
4. form a hypothesis
5. gather evidence
6. make the smallest fix
7. rerun verification

Avoid random trial-and-error edits.

If the same strategy fails repeatedly, stop and reassess the hypothesis.

---

## 11. Long-Running Tasks

For a large supervised task, keep its state in the conversation:

* objective
* current understanding
* decisions made
* files changed
* remaining work
* verification status
* unresolved risks

Restate it when it changes, so that it survives a context compaction.

Supervised work writes **no task-state files**: nothing in `docs/ai/`. That
directory holds night runs' state (`docs/ai/night-<YYYY-MM-DD>/`, defined by
`.claude/skills/night-run/SKILL.md`); an older run's directory is removed once its
open items are carried to `docs/backlog.md`.
Supervised work neither adds to it nor needs to read the night-run skill.

---

## 12. Parallelization

Parallelize independent work when it reduces total task time.

Examples:

* one agent maps architecture
* one agent investigates tests
* one agent performs security review
* one agent evaluates an isolated subsystem

Do not have multiple agents modify the same files unless the workflow explicitly supports conflict resolution.

For parallel implementation, use isolated worktrees or equivalent isolation.

---

## 13. Code Review

Before declaring substantial work complete, review the resulting diff.

Ask:

* Does this actually solve the requested problem?
* Did the implementation follow existing architecture?
* Did it introduce unnecessary complexity?
* Are edge cases covered?
* Are contracts preserved?
* Are errors handled correctly?
* Are security boundaries intact?
* Are tests meaningful?
* Did unrelated files change?
* Is there anything a skeptical reviewer would question?

Review the final state, not merely the edits made during implementation.

---

## 14. Minimality

Minimality means avoiding unnecessary complexity, not avoiding necessary code.

Prefer:

* direct solutions
* established project patterns
* small interfaces
* localized changes
* explicit behavior

Avoid:

* speculative extensibility
* premature abstractions
* unnecessary wrappers
* broad refactors
* unrelated dependency changes

---

## 15. Generated Files

Identify the source of truth before modifying generated output.

If generated code changes:

1. modify the source
2. run the generator
3. inspect the output
4. verify it

Do not manually patch generated artifacts unless explicitly required.

---

## 16. Human Interaction

Do not ask for approval for ordinary implementation decisions that fall clearly within the task.

Ask when the task requires a material product or architecture decision that cannot reasonably be inferred.

Examples:

* two incompatible interpretations of requirements
* destructive database behavior
* breaking public API changes
* irreversible external operations
* unclear security requirements

When asking, explain the actual decision and its consequences rather than asking a vague "what should I do?"

---

## 17. Final Response

For meaningful engineering tasks, provide a concise completion report. This is
the repository's one completion-report format; `AGENTS.md` §21 and the
templates in `.claude/docs/` point here.

### Summary

What changed.

### Verification

What was run and what passed or failed.

### Notes

Important implementation or compatibility considerations.

### Remaining Issues

Only include genuine unresolved items.

Do not include generic statements such as "everything should work" without evidence.

---

## 18. Claude-Specific Assets

This repository's `.claude/` directory is structured as follows:

```text
.claude/
├── README.md   — how these files fit together, and how to copy them to a new repo
├── agents/     — specialized subagents dispatched by name (reviewer)
├── rules/      — domain-specific reference docs (see §2), opened on demand
├── skills/     — reusable procedural workflows, invoked as slash commands
│                 (code-review; night-run, with its CI poll ci-poll.mjs)
├── docs/       — supporting human-readable process docs (workflow, task
│                 template, prompt patterns) — not auto-loaded
└── settings.example.json — inert template; no settings.json is defined here
```

There is no single validation command. Verification is the commands in §9's
table, run separately.

Use `.claude/skills/code-review/` for an adversarial review pass over a diff —
see §13 for when to run it.

Use `.claude/skills/night-run/` only when this session is running unattended
(no human available to answer). It runs the tasks of the plan a human wrote in
`docs/ai/night-<date>/plan.md` until the plan's goal time, and defines
everything that differs without a human: asking questions, verifying UI,
branches, pushes, CI, state files, forbidden operations and stopping. Supervised
work does not need it. Do not improvise unattended operation without it — least
of all the push rules, which reach another machine, and the database rule, which
keeps a run's writes inside the test schemas so the shared development data
stays as people left it.

`.claude/agents/reviewer.md` is the standing independent reviewer — see §8 and
§13. Add further specialized subagents only if the task mix justifies them; a
dedicated security-reviewer is the likeliest next one, since this app already
has authentication and Server Actions that write to its database.

Keep these complementary to `AGENTS.md`.

Do not duplicate the entire repository engineering contract in Claude-specific files.

---

# Default Claude Behavior

Unless the task explicitly calls for another approach:

**Explore the relevant system.
Plan proportional to risk.
Implement the smallest sufficient change.
Verify with evidence.
Review the final diff.
Report what actually happened.**
