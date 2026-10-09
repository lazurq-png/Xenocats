# `docs/ai/` — durable task state

Agent work that spans many files, sessions or an unattended night keeps its state
here, one directory per branch: `docs/ai/<branch>/`. It is committed on the
branch it describes, so the reasoning stays attached to the diff it explains.

| File | Written by | Holds |
| ---- | ---------- | ----- |
| `plan.md` | **a human** | The goal (when the run ends) and the tasks. An agent never creates, edits or ticks it off. |
| `progress.md` | the agent | Append-only log: a run-start entry, then one entry appended each time a task ends, with its base SHA, what the code does, what it brings the project (its choices are in `decisions.md`), and the verification actually run. An unattended run's morning report, an index of its tasks, is inserted at the top. |
| `decisions.md` | the agent | Non-obvious choices, numbered `D1`, `D2`, …, each with its reason, including acceptance criteria derived for an underspecified task. |
| `questions.md` | the agent | What needed a human: the question, the options and their consequences, the recommendation, and what was done meanwhile. |

## Unattended runs

`.claude/skills/night-run/SKILL.md` reads `docs/ai/night-<YYYY-MM-DD>/plan.md`,
where the date is the night the run starts. That directory is the run's, though
its branches are named differently: the integration branch is always `Nightrun`,
and each task's is `<YYYY-MM-DD>-t<N>-<slug>`. The run does the plan's tasks and
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

## Exploration

<The kinds of work the run picks for itself once the tasks are done, until the
goal time, e.g. tests; security and quality; dashboard features. Optionally,
candidates to start with and anything exploration must leave alone.>
```

- **The goal is when the run ends, not what it achieves.** A weekday means the
  first such moment after the run starts, so `Thursday 08:00` written on a
  Wednesday evening means the next morning. At that time the run finishes the
  task in flight, writes the morning report at the top of `progress.md`, and stops.
  It never stops early for lack of work: once the tasks are done it explores,
  building small improvements of the kinds under `## Exploration`, until the
  goal time. Without that section it uses tests, security and quality, and
  bugs found by reading the code.
- **The tasks and the exploration kinds are the whole of the work.** Anything
  else comes back as a proposed task in the morning report.
- **Lifting a rule** of the protocol for one task must be written explicitly,
  naming the rule and the task. No plan lifts the push rules or the database
  rule.
- The plan can stay uncommitted. The run's first task commits it exactly as you
  left it.

### Before you start it

The run cannot fix any of these, and most of them end it silently:

1. **Everything the run should build on is on `main`.** The run branch is cut
   from `main`; work left on another branch is not there.
2. **The last run's `Nightrun` branch is merged or deleted**, locally and on
   `origin`. Every run's integration branch has that one name, so while the old
   one exists a new run stops at preflight. Its task branches
   (`<YYYY-MM-DD>-t<N>-<slug>`) are named by date and need not be removed.
3. `npm ci` and `npx playwright install chromium` have been run.
4. `.env` holds `POSTGRES_URL` (the development database, with
   `?search_path=xenocats`), `AUTH_SECRET` and `AUTH_URL`, and the machine is on
   the network that reaches the database server. Off that network the run still
   works, but skips the build and every test that needs the database.
5. The plan is at `docs/ai/night-<today>/plan.md`, dated the day you start the
   run: a run started after midnight looks for the new date.
6. A `git push` works without a prompt (credentials cached). A credential
   dialog at 03:00 waits for nobody.
7. The session runs with permission prompts off (bypass mode), the machine will
   not sleep, and the terminal stays open: closing it ends the session. The
   run's timer lives inside the `claude` process, so it cannot fire while the
   PC sleeps. The 2026-10-08 run lost its whole night that way (its Q6).
8. Start it from the Claude CLI, as the next section says, with the prompt
   below sent as one message. The `/loop` is the run's timer: it fires every 20
   minutes whenever the session is idle, however the last turn ended, so a run
   stopped by the usage limit (even during preflight) resumes within about 20
   minutes of the limit resetting. If nothing has started a minute after
   sending it, send it once more without `/loop 20m`. Never use `/loop` without
   an interval: that form dies at the first usage limit.

```text
/loop 20m Run unattended: no human is available until the plan's goal time. Invoke the night-run skill and follow it exactly. This /loop is the run's timer (§9.5): arm no other timer, and when the run ends delete this loop (CronList, CronDelete). Decide which case this firing is, first match wins: (1) this session already holds the run → heartbeat (§9.5); (2) the loop in the skill's §1 prints the Nightrun branch as in progress (its deadline not yet passed, or no morning report) → resume it (§9.2); (3) no branch Nightrun exists and docs/ai/night-<today>/plan.md exists → start a new run (§1); (4) otherwise → stop immediately: skip §1.0, create no branch, write no file, and delete this loop. The plan's goal is the deadline; its tasks, then exploration of the kinds it names, are the only work, and the run never stops early for lack of work.
```

### Starting it from the CLI

Runs start from the Claude CLI (`claude.exe`, in `~/.local/bin`) in a terminal
of its own, not from the VS Code extension or VS Code's built-in terminal:
closing VS Code, or VS Code restarting itself for an update, would end the run.

1. **Keep the PC awake.** Plug it in. On a laptop, leave the lid open, or set
   "When I close the lid" to *Do nothing* on mains power (Control Panel → Power
   Options): nothing below stops a closed lid from sleeping. Pause Windows
   Update for the length of the run, so it cannot restart the PC. Then open a
   PowerShell window and leave it open for the whole run:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File "$HOME\Binaries\keep-awake\keep-awake.ps1"
   ```

   It keeps the PC and screen awake while its window is open and changes no
   setting. Locking the screen (Win+L) is fine.

2. **Open a second window** (Windows Terminal, PowerShell) in the repository,
   with Node, git and the CLI on `PATH`:

   ```powershell
   cd $HOME\Projects\Xenocats
   $env:PATH = "$HOME\Binaries\node;$HOME\Binaries\git\cmd;$HOME\.local\bin;$env:PATH"
   git checkout main; git pull; git status --short    # main is current; the plan may be untracked
   claude --permission-mode bypassPermissions -n "night-<YYYY-MM-DD>"
   ```

   Use the **interactive** session as shown, never `claude -p`: print mode ends
   after one answer, and the `/loop` timer ends with it. `-n` names the session
   so `/resume` finds it.

3. **Paste the `/loop 20m …` prompt** above into the session as one message and
   press Enter. The run's first lines are its preflight; within a few minutes
   `progress.md` gets its `## Run start` entry and the branch `Nightrun` exists.

4. **Leave both windows open** until the goal time. To check on it from
   elsewhere: the `Nightrun` branch and its CI runs on GitHub, and
   `docs/ai/night-<date>/progress.md` on that branch.

**If the window closed or the PC restarted mid-run,** reopen it the same way
with `--continue`, which brings back the last conversation in this directory,
and its `/loop` with it:

```powershell
claude --continue --permission-mode bypassPermissions
```

If no `/loop` fires within 20 minutes, paste the prompt again. Case (1) or (2)
picks the run up where its state files say. Never start a second session while
the first is still running: two sessions would work the same branches at once.

**To end a run early,** close the CLI window. Every finished task is already
committed and pushed; the task in flight is left uncommitted on its branch.
`/night-run` in a new session resumes the run later, until its goal time.
