# `docs/ai/` — durable task state

Agent work that spans many files, sessions or an unattended night keeps its state
here, one directory per branch: `docs/ai/<branch>/`. It is committed on the
branch it describes, so the reasoning stays attached to the diff it explains.

| File | Written by | Holds |
| ---- | ---------- | ----- |
| `plan.md` | **a human** | The goal (when the run ends) and the tasks. An agent never creates, edits or ticks it off. |
| `progress.md` | the agent | Append-only log: a run-start entry, then one entry appended each time a task ends, with its base SHA, what the code does, why it was added, and the verification actually run. An unattended run's morning report is appended last. |
| `decisions.md` | the agent | Non-obvious choices, numbered `D1`, `D2`, …, each with its reason, including acceptance criteria derived for an underspecified task. |
| `questions.md` | the agent | What needed a human: the question, the options and their consequences, the recommendation, and what was done meanwhile. |

## Unattended runs

`.claude/skills/night-run/SKILL.md` reads `docs/ai/night-<YYYY-MM-DD>/plan.md`,
where the date is the night the run starts. The run does the plan's tasks and
nothing else, until the time in the plan's `## Goal`. It **stops without doing
anything** if the plan or its tasks are missing, or the goal is missing,
unreadable or already past.

Write the plan before starting the run:

```markdown
# Night run <YYYY-MM-DD>

## Goal

<Weekday HH:MM, e.g. Thursday 08:00 — or YYYY-MM-DD HH:MM. Europe/Stockholm.>

## Limits

<Optional. Anything the run should know and report, e.g. weekly usage at start.>

## Tasks

1. <task> — <what "done" looks like, if it is not obvious>
2. <task>
```

- **The goal is when the run ends, not what it achieves.** A weekday means the
  first such moment after the run starts, so `Thursday 08:00` written on a
  Wednesday evening means the next morning. At that time the run finishes the
  task in flight, appends the morning report to `progress.md`, and stops. If
  the tasks run out first, it stops then.
- **The tasks are the whole of the work.** Work no task names is not built. It
  comes back as a proposed task in the morning report.
- **Lifting a rule** of the protocol for one task must be written explicitly,
  naming the rule and the task. No plan lifts the push rules or the database
  rule.
- The plan can stay uncommitted. The run's first task commits it exactly as you
  left it.

### Before you start it

The run cannot fix any of these, and most of them end it silently:

1. **Everything the run should build on is on `main`.** The run branch is cut
   from `main`; work left on another branch is not there.
2. `npm ci` and `npx playwright install chromium` have been run.
3. `.env` holds `POSTGRES_URL` (the development database, with
   `?search_path=xenocats`), `AUTH_SECRET` and `AUTH_URL`, and the machine is on
   the network that reaches the database server. Off that network the run still
   works, but skips the build and every test that needs the database.
4. The plan is at `docs/ai/night-<today>/plan.md`, dated the day you start the
   run: a run started after midnight looks for the new date.
5. A `git push` works without a prompt (credentials cached). A credential
   dialog at 03:00 waits for nobody.
6. The session runs with permission prompts off (bypass or auto mode), the
   machine will not sleep, and the editor or terminal stays open: closing it
   ends the session.
7. Start it with **`/loop /night-run`** (no interval). The loop re-arms itself
   each turn and stops itself when the run ends.
