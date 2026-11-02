# `.claude/` — Claude Code Steering Documents

This directory is what the Claude Code extension (VS Code) and CLI read when working in this repository. Copy this whole folder, plus the top-level `AGENTS.md` and `CLAUDE.md`, into a new project's root to bootstrap the same operating model there.

## How the pieces fit together

```text
AGENTS.md              engineering contract — architecture, testing, security, scope,
                        completion standards. Always relevant.
CLAUDE.md               Claude Code operating model — always loaded by the extension/CLI
.claude/
├── README.md           this file
├── agents/             subagents dispatched by name (reviewer: independent review,
│                        no Edit or Write tool)
├── rules/              domain reference docs — loaded in every session (none has
│                        `paths:` frontmatter); CLAUDE.md §2 maps tasks to them
├── skills/              reusable procedures invoked as slash commands
│                        (/code-review; /night-run, with its CI poll ci-poll.mjs)
├── docs/                 supporting human-readable process docs — workflow narrative,
│                          a task-request template, and ready-to-paste prompt patterns
└── settings.example.json       copy to settings.json and adjust permissions/hooks
                                 (not yet done here — settings.json does not exist)
```

This repository has **no single validation entry point.** Verification is
these commands, run separately (npm, since the lockfile is `package-lock.json`;
`node_modules` from `npm ci`):

```text
npm run lint                            # ESLint; errors fail, warnings are advisory
npx next typegen && npx tsc --noEmit    # type check, with fresh route types
npm test                                # Vitest unit tests (tests/unit/)
npm run test:e2e                        # Playwright browser tests (tests/e2e/), own dev server on :3100
npm run build                           # next build; may read the database while prerendering
npx prettier --check <changed files>    # never `npm run format`, which rewrites everything
```

`npm run dev` runs the app. It needs `.env` (`POSTGRES_URL`, `AUTH_SECRET`,
`AUTH_URL`). `POSTGRES_URL` is a development PostgreSQL 17 on this PC
(`localhost:5432`, TLS on; schema `xenocats`; the browser tests rebuild their own `xenocats_test`). The
schema lives in `db/migrations/`; `npm run db:migrate`, `db:seed` and `db:reset`
manage it.

CI (`.github/workflows/ci.yml`) runs three jobs on pushes to `Nightrun` and
`dev` and on pull requests into `Nightrun`, `dev` or `main` (a merge into `main`,
and other branches, run none; a pull request from `dev` into `main` skips them when
that exact commit already passed on `dev`):
lint + type check + unit tests; the build followed by the browser tests against
`next start`; and the browser tests against `next dev`. The last two start the
runner's own PostgreSQL, so CI uses no outside database and no secret.

### How rules load

Claude Code loads a rule file in `.claude/rules/` at launch, alongside
`CLAUDE.md`, unless the file has `paths:` frontmatter (a list of globs); one
with `paths:` loads only when Claude reads or edits a file that matches. None
of these rules has `paths:`, so all of them are in context in every session,
and `CLAUDE.md` §2 says which applies to which kind of task (frontend, backend,
database, testing, debugging, architecture, security-review). Reviewing a diff
is the `code-review` skill.

To keep a rule out of sessions that never touch its area, give it `paths:`.
A nested `CLAUDE.md` scopes guidance by location the same way: Claude Code
loads one when it works with files in that directory.

### Unattended operation

`.claude/skills/night-run/SKILL.md` is the protocol for running with no human
available. It executes the tasks of the plan a human writes in
`docs/ai/night-<date>/plan.md` (template in `docs/ai/README.md`) until the day
and time in that plan's `## Goal`, then finishes the task in flight, writes the
morning report at the top of `progress.md` and stops. It stops at once if the plan or goal
is missing. It covers
preflight, a branch per task merged onto a run branch and pushed as each one
finishes, durable state under `docs/ai/night-<date>/`, forbidden operations, and
stop conditions. It is invoked by the `/loop 20m` prompt in `docs/ai/README.md`
rather than auto-loaded, so it costs nothing during ordinary supervised work. Unattended sessions run with permission prompts bypassed, and
this repository has no `settings.json` deny rules or hooks, so its guardrails
are honoured by instruction, not enforced by the harness.

### Code review

`.claude/skills/code-review/SKILL.md` is an adversarial-review checklist (correctness,
security, data integrity, compatibility, concurrency, error handling, tests,
performance) — invoke it with `/code-review` or by asking Claude to review the current
diff.

## Setting this up in a new repo

1. Copy `AGENTS.md`, `CLAUDE.md`, and this `.claude/` folder into the repo root.
2. Give the repo a real verification command and name it in `CLAUDE.md` §9 —
   that table is what `AGENTS.md` §13 expects agents to run for "verification."
   Whether it is one script or two commands matters less than that every stage
   runs a real check. A stage that echoes a heading and prints success without
   checking anything is worse than no stage at all: it manufactures the evidence
   those sections exist to require. (The project these files came from learned
   that the other way round too — a `validate` wrapper was removed and three
   documents went on citing it for weeks.)
3. Copy `.claude/settings.example.json` to `.claude/settings.json` only if you
   want to pre-approve specific commands/permissions; otherwise omit it and let
   the extension prompt as usual. In a run started with permissions bypassed
   its `allow` list has no effect, but its `deny` list still blocks: deny rules
   hold in every permission mode. This repository has none, so `night-run`'s
   forbidden operations are held by instruction alone.
4. Trim `.claude/rules/*.md` and `.claude/docs/*.md` down to what the project
   actually needs — delete the domains that don't apply (e.g. `database.md` for
   a repo with no persistence layer).
5. Update the curated list in `CLAUDE.md`'s "Start With Repository Context"
   section if you remove or rename any rule file.
6. Rewrite `.claude/skills/night-run/SKILL.md` for the new project: its
   preflight (§1), verification gate (§2 step 1) and forbidden operations (§3)
   name this repository's tools, base branch and database. The rest — the
   plan-and-goal-time contract, branches, deadlines, budget, report — is portable.
7. Commit all of it — `CLAUDE.md`/`AGENTS.md` are meant to be checked into the
   repo so every contributor's agent sees the same contract, the same way a
   project's `CLAUDE.md` already works in this machine's other repos.
