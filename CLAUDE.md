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
| UI | `app/ui/**` — Tailwind 3, `@heroicons/react`, `clsx` |
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
* `.claude/rules/review.md` — adversarial review of a finished diff
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
* task plans
* handoffs

for durable knowledge.

Do not rely on the assumption that previous conversational context will remain available.

When a long task becomes too large for the current context, preserve the important state before continuing.

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

Do not repeatedly rediscover information that can be captured in a durable task artifact.

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
this repository's recurring failure modes.

Unattended, "ideally" becomes "always": it is the only review a change will get
before it is committed. Give it the task, not your reasoning —
`.claude/skills/night-run/SKILL.md` §2.

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
| Build      | `npm run build`                                  |
| Format     | `npx prettier --check <the files you changed>`   |
| Browser    | `npm run dev`, then open `http://localhost:3000` |

Use **npm**: the lockfile is `package-lock.json`. The `pnpm` block in
`package.json` is a leftover and nothing reads it. Node is not on `PATH`; prefix
commands as the global `CLAUDE.md` describes. Every check needs `node_modules`,
installed with `npm ci`; the browser tests also need Chromium
(`npx playwright install chromium`).

Run `next typegen` before `tsc`: `tsconfig.json` includes the route types Next
generates under `.next/`, and stale ones (from a build before a route was
deleted) fail the type check for no reason in the code.

`npm run test:e2e` starts its own `next dev` on port 3100 with a throwaway
`AUTH_SECRET`. Before the tests, `tests/e2e/global-setup.ts` drops and rebuilds
the `xenocats_test` schema on the database `POSTGRES_URL` names, and the test
server uses that schema, so browser tests may log in and submit forms. Without
a `POSTGRES_URL`, or with `E2E_NO_DATABASE=1` when the server is unreachable
(off its network), the tests that need it skip; otherwise an unreachable server
fails the whole suite.
`E2E_SERVER=start npm run test:e2e` runs the same tests against `next start`
instead, which needs an existing `npm run build`. `next dev` also (re-)adds a Next.js agent-rules block
to `AGENTS.md` when it detects an AI agent, and flips `next-env.d.ts` between
its dev and build variants; neither is part of a task's change.

`npm test` includes `tests/unit/data.test.ts`, which runs every query in
`app/lib/data.ts` against a real database: it drops and rebuilds its own
`xenocats_vitest` schema (and a scratch `xenocats_vitest_migrations`) on the
server `POSTGRES_URL` names, and skips like the browser tests do — no URL, or
`E2E_NO_DATABASE=1`. In CI it runs in the *build* job, which has a database.

`lint` exits non-zero on **errors only**; warnings print without failing, so a
clean exit does not mean an empty report. Read the output; do not report "lint
passed" as though it found nothing.

Formatting is per file. `npm run format` rewrites the whole repository, and not
every file matches `.prettierrc` (`app/query/route.ts` is indented with tabs),
so it produces a drive-by diff. Run `prettier --check` / `--write` on the files
the task changed.

The running app, and possibly `npm run build` where a page prerenders, need
`POSTGRES_URL`, `AUTH_SECRET` and `AUTH_URL` in `.env`. **`POSTGRES_URL` is a
development database** on the local network, holding no data of value: the app
uses its `xenocats` schema, the browser tests `xenocats_test`, the database unit
tests `xenocats_vitest`. The URL carries
the schema as `?search_path=`. The schema is defined by `db/migrations/*.sql`;
`npm run db:migrate` applies new ones, `db:seed` loads
`app/lib/placeholder-data.ts`, and `db:reset` rebuilds a schema from scratch.
`seed` and `reset` refuse any host outside the private network ranges. There is
no production database yet: one is built later with `db:migrate`, by a human.

**CI** (`.github/workflows/ci.yml`) runs on every push and pull request, in
three jobs: *checks* (lint, type check, unit tests); *build* — `npm run build`
over a migrated and seeded `xenocats` schema, then the browser tests against
`next start` (`E2E_SERVER=start`); and *e2e* — the browser tests against
`next dev`. The *build* and *e2e* jobs start the PostgreSQL preinstalled on the
runner (TLS on, throwaway password), so CI needs no repository secret and no
outside database, and runs the database tests too. Each job that starts Next
makes its own throwaway `AUTH_SECRET`. It runs on GitHub, not on your machine: never
report a CI result you have not observed.
The one sanctioned way to observe one is the night-run skill's read-only poll
of the public Actions API for a commit that run pushed
(`.claude/skills/night-run/SKILL.md` §2 step 6) — a narrow, documented case,
not licence to check CI any other way.

A clean type check and build prove the code compiles, not that a page works.
For UI changes run the app and look (`.claude/rules/frontend.md`). When running
unattended there is nobody to look: a Playwright test that performs the changed
interaction is the substitute, and still does not prove the page looks right.
Say so rather than implying the page was seen.

Start with the narrowest useful verification.

Expand verification when the change has broader impact.

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

For large tasks, maintain durable progress.

A useful task state includes:

* objective
* current understanding
* decisions made
* files changed
* remaining work
* verification status
* unresolved risks

Do not keep critical state exclusively in the conversation.

When handing work to another agent or resuming after interruption, leave enough information for the next agent to continue without reconstructing the entire investigation.

That state lives in `docs/ai/<branch>/` — `plan.md`, `progress.md`,
`decisions.md`, `questions.md`. See `docs/ai/README.md` for what belongs in
each. It is committed on the branch it describes, so the reasoning stays
attached to the diff it explains.

Unattended runs must maintain it; there is no conversation for a human to read
afterwards, so these files are the entire record of what happened. Such a run
spans several branches — one per task, plus an integration branch it merges and
pushes each finished task onto (`.claude/skills/night-run/SKILL.md` §1.2, §2)
— but keeps a single directory, named after the integration branch.

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

If no human is available to answer — an unattended run — do not wait. Write the
question, the options and your recommendation to the run's `questions.md`, take
the smallest reversible interpretation, commit that work separately and flag it
provisional, then continue. `.claude/skills/night-run/SKILL.md` governs this;
AGENTS.md §18 states the same rule for tool-agnostic agents.

---

## 17. Final Response

For meaningful engineering tasks, provide a concise completion report:

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
├── agents/     — specialized subagents dispatched by name (reviewer)
├── rules/      — domain-specific reference docs (see §2), opened on demand
├── skills/     — reusable procedural workflows, invoked as slash commands
│                 (code-review, night-run)
├── docs/       — supporting human-readable process docs (workflow, task
│                 template, prompt patterns) — not auto-loaded
└── settings.example.json — inert template; no settings.json is defined here
```

There is no single validation command. Verification is the commands in §9's
table, run separately.

Use `.claude/skills/code-review/` for an adversarial review pass over a diff —
see §13 for when to run it.

Use `.claude/skills/night-run/` when this session is running unattended (no
human available to answer). It executes the tasks of the plan a human wrote in
`docs/ai/night-<date>/plan.md` until that plan's `## Goal` — a day and time such
as `Thursday 08:00` — then finishes the task in flight, appends the morning
report to `progress.md` and stops. It stops if the plan, its tasks or a readable
goal are missing, and when the tasks run out early it stops rather than
inventing work. It keeps `progress.md` append-only, one entry per finished
task. It defines the
preflight, the branch-per-task and commit cadence, when a finished task's branch
may be pushed and to where, the durable state files, the forbidden operations —
including any write to the project's only database — the deadline (the
plan's goal time), the per-session budget reserve, and the stop
conditions. `docs/ai/README.md` has the plan template.

A run may span several sessions; its §9 covers resuming one, and what a session
must leave behind for the next. The state files in `docs/ai/<branch>/` are the
only handover — nothing of the conversation survives — which is why they are
made current before every commit rather than at the end.

Do not improvise unattended operation without it — least of all the push rules,
which are the only part of this repository's agent protocol that reaches another
machine, and the database rule, since there is no copy of that data to fall back
on.

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
