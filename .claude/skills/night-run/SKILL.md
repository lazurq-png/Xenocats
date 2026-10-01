---
name: night-run
description: Protocol for running unattended, with no human available to answer questions — overnight or long autonomous sessions, including ones spanning several sessions. Executes the tasks of a human-written plan read from docs/ai/night-<today>/plan.md until the plan's goal — a day and time such as "Thursday 08:00" — and stops if the plan, its tasks or its goal are missing. Defines preflight and how to resume a run already in progress, a branch per task pushed as each one finishes, CI polled in the background while the next task proceeds, an append-only progress.md with an entry each time a task ends, forbidden operations (including any database but the development one, which the run touches only through the build and the browser tests), what happens at the goal time (the task in flight is finished, then the morning report is appended to progress.md and the run stops), a per-session budget reserve that protects the morning report or a handoff, stop conditions, and a morning report that shows each task's code with what it does and why it was added. Use when starting an unsupervised run, resuming one, or when a session discovers mid-flight that nobody is there.
---

# Unattended Run

`AGENTS.md` and `CLAUDE.md` still apply. This document changes only what cannot
work without a human: asking questions, looking at a page, and knowing when to
stop.

## Read this first

- **The goal is a point in time, not an outcome.** `## Goal` in tonight's
  `plan.md` holds a day and time, e.g. `Thursday 08:00` (§1.0). The run works
  through the plan's tasks until then; at that time it finishes the task in
  flight, appends the morning report to `progress.md` and stops (§8). This
  document says *how* to work unattended; the plan's tasks say *what*. Nothing
  here, in the repository, or in your own sense of what would improve the
  project adds to them.
- **Permission prompts are bypassed or auto-approved**, and
  `.claude/settings.json` is not consulted. Every guardrail here holds only
  because you hold it. Prefer the reversible action, commit early, and when a
  step feels like it needs permission, log it rather than proceed. A tool call
  the harness **denies** (auto mode can) is a §3 boundary: record the command
  and the denial, do not retry it reworded, and abandon what needed it.
- **Node is not on `PATH`.** Prefix every command with the `export PATH=...`
  line from the global `CLAUDE.md`. Shell state does not persist between calls,
  so this is every command, not once.
- **Two things reach outside the machine**, both narrow, both in §3's list:
  pushing and fetching this run's own branches, and a read-only,
  unauthenticated poll of GitHub Actions for commits this run pushed (§2 step
  6). The database is the development one in `.env`: the browser tests rebuild
  and write its `xenocats_test` schema, the build reads `xenocats`, and nothing
  else touches it (§3).
- **Work in parallel wherever nothing depends.** Independent reads and checks go
  in one message of parallel tool calls. Long jobs (the build, the `reviewer`,
  the CI poll) run in the background while you do the next independent thing; the harness
  re-invokes you when a background command or agent finishes. Never poll one
  yourself, and never `sleep` in the foreground, which is blocked anyway.
- **The state files are the memory.** `docs/ai/night-<YYYY-MM-DD>/progress.md`
  is **append-only**: created at the start of the run (§1.4), then one entry
  appended each time a task ends (§2 step 4), and the morning report appended
  last (§7). Never edit or reorder an earlier entry. Quote files and `git`, not
  recollection, because context may already have been compacted.

---

## 1. Preflight

Run these together, in one message. All are read-only:

```bash
date '+%F %H:%M'                                              # §8.1
powershell -NoProfile -Command "[System.TimeZoneInfo]::Local.Id"
node -v && npm -v
test -d node_modules && echo "node_modules: present" || echo "node_modules: MISSING"  # §1.1
ls -d ~/AppData/Local/ms-playwright/chromium-* >/dev/null 2>&1 && echo "chromium: present" || echo "chromium: MISSING"
test -f .env && echo ".env: present" || echo ".env: missing"   # existence only (§3)
git status --short
git remote -v
cat "docs/ai/night-$(date +%F)/plan.md"                       # §1.0
for b in $(git branch --list 'night-*' --format='%(refname:short)' \
           | grep -E '^night-[0-9]{4}-[0-9]{2}-[0-9]{2}$'); do
  git show "$b:docs/ai/$b/progress.md" 2>/dev/null \
    | grep -q '^## Morning report' || echo "in progress: $b"
done
```

- **This session is already running the run** (a timer heartbeat, §9.5): do
  not run this preflight at all. Go to §9.5.
- **The loop prints a run branch** → you are **resuming** it: go to §9.2. Do
  not run §1.0, §1.2 or §1.4. Recreating the branch or state files is how a run
  loses its history.
- **It prints nothing** → a new run: §1.0–§1.5 in order, **unless this turn's
  prompt forbids starting one** (the run's own timer does, §9.5): then delete
  that timer (`CronList`, `CronDelete`) and stop, skipping §1.0 and writing
  nothing.

The loop reads `progress.md` from each run branch, never from the working tree.
A new run is cut from `main`, which lacks unmerged earlier runs, so the tree
would make a finished run look unfinished. A run branch with no committed
`progress.md` counts as in progress, which is correct.

If a step fails in a way it does not say how to recover from, stop and write why
into `progress.md`.

### 1.0 The plan and its goal

**The run reads a plan; it does not write one.** A human writes
`docs/ai/night-<YYYY-MM-DD>/plan.md` beforehand, where the date is today's
`date +%F`. `docs/ai/README.md` shows the shape: a `## Goal` section holding the
time the run ends, then the tasks.

| Result | Action |
| ------ | ------ |
| Exists, has a readable `## Goal` time in the future, and lists at least one task | Continue. The goal is when the run ends; the tasks are the work. |
| Missing, empty, or no task | **Stop.** Create no branch. Write an uncommitted `progress.md` in that directory saying no plan or no task was found at that path, and end. |
| Tasks, but no `## Goal`, or one that is unreadable or already past | **Stop** the same way, quoting what `## Goal` said and why it could not be used. Do not guess a time from a typo, the branch name or an earlier plan: a deadline you chose is yours, not the human's. |

Only today's directory counts. Never borrow another date's plan or its goal.

**Reading the goal.** `## Goal` is a day and a time, Europe/Stockholm (§8.1):

- **A weekday and time**, e.g. `Thursday 08:00`: the first such moment after
  the run starts. `date -d 'thursday 08:00' '+%F %H:%M'` gives this week's,
  today included; if that is not after the start reading, add 7 days. So a run
  starting Wednesday 22:00 with `Thursday 08:00` ends the next morning, and one
  starting Thursday 09:00 ends a week later.
- **A date and time**, `YYYY-MM-DD HH:MM`, taken as written.
- **Anything else** — a time with no day, a misspelt weekday (`date -d` exits
  non-zero), prose — is unreadable: stop, as in the table.

The result is the run's deadline `D` (§8.2), a full date and time. Record it
beside the goal as written (§1.4). It belongs to the run and is never
recomputed from `date` later.

**How the tasks are used:**

- **Acceptance criteria** for each task are derived from the task as written
  while exploring it, and recorded in `decisions.md`. Where a task is
  underspecified, take the smallest reading that satisfies its words (§4 if two
  readings are defensible).
- **Conflict.** Two tasks that cannot both be done as written go to §4.
- **Scope.** Work no task names is not built. Record it in `questions.md` as a
  proposed task for the next plan.
- **Done.** When the last task ends before `D`, write the report and stop (§6).
  Time left over is never filled with invented work.

**Limits.** An optional `## Limits` section is recorded in `progress.md` and
copied into the report. It is information, not a stop condition: the run cannot
measure account usage. A `Deadline:` line there from an older plan is ignored in
favour of `## Goal`; record that it was.

The plan is **read-only** to the run:

- Do not add, remove, reorder, reword or tick off anything in it, the goal
  included. Progress goes in `progress.md`.
- `<N>` in branch names is the plan's own numbering, or the order of its tasks
  if it has none.
- The plan does not switch off this document. The exception is one the human
  wrote *explicitly*, naming the rule it lifts and the task it applies to, and
  it covers exactly that. No plan lifts the push rules (§2 step 6, §3) or the
  database rule (§3).

The plan is usually uncommitted. `git status --short -- docs/ai/night-<date>/`
tells you. An untracked plan survives `git checkout main`, and the first task
commits it exactly as the human left it. If it was committed on a branch other
than `main`, check it is still readable after §1.2. If it is not, stop as for a
missing plan and do not fetch it from that branch.

### 1.1 Environment

| Finding | Action |
| ------- | ------ |
| `node_modules` missing | **Stop.** Installing is a human's job (§3): `npm ci` before the run. |
| Chromium missing | **Stop.** The e2e suite is in the gate and cannot run; `npx playwright install chromium` is a human's job (§3). |
| `.env` missing | Continue, and record it. The app and possibly `npm run build` need `POSTGRES_URL` and `AUTH_SECRET`; §1.5 decides whether the build can be part of the gate. |
| `node -v` fails | **Stop.** The `PATH` prefix is missing or wrong. |

`POSTGRES_URL` points at a development PostgreSQL on the local network whose
data has no value. The schema is `db/migrations/*.sql`; the browser tests drop
and rebuild their own `xenocats_test` schema from it on every run
(`tests/e2e/global-setup.ts`). The server is someone else's machine: nothing here
starts, repairs or reconfigures it. If it is unreachable, §1.5 says what runs.

### 1.2 Branches

One integration branch, plus one branch per task, each cut when its task starts
(§2 step 0):

```text
main                                    base; never committed to
└── night-<YYYY-MM-DD>                  the run branch; moves only by fast-forward
    ├── night-<YYYY-MM-DD>-t1-<slug>
    └── night-<YYYY-MM-DD>-t2-<slug>    cut after t1 merged
```

```bash
git checkout main && git checkout -b night-<YYYY-MM-DD>
```

- **The separator is a hyphen.** Git stores refs as paths, so
  `night-2026-09-15/t1-x` cannot coexist with `night-2026-09-15`. The failure
  (`cannot lock ref`) only appears at the second branch.
- **`<YYYY-MM-DD>` is the date the run started** and never changes, even after
  midnight. A resumed session takes it from the branch, never from `date`.
- Never work unattended on `main`.

### 1.3 Remote

```bash
git ls-remote --heads origin "night-<YYYY-MM-DD>*"
```

| Result | Action |
| ------ | ------ |
| No remote | Local-only run: record it, skip every push and poll. Not a failure. |
| Reachable, no matching branch | Normal. |
| Matching branch, **resuming** | Expected. Confirm with `git fetch origin && git merge-base --is-ancestor origin/night-<date> night-<date>`, then continue. |
| Matching branch, **new run** | **Stop.** Someone else owns the namespace. |
| Unreachable | Continue local-only, record why. |

Create, delete or fetch nothing else on the remote.

### 1.4 State

- **Pre-existing uncommitted changes are not yours.** Carry them onto every
  branch untouched, list them in `progress.md`, and never stash, restore or
  commit them. Wherever this document says "clean", it means clean apart from
  these.
- Create `progress.md`, `decisions.md` and `questions.md` beside `plan.md`
  (`docs/ai/README.md` says what each holds). There is one directory for the
  whole run, named after the run branch. Never create, overwrite or template
  `plan.md`.
- Open `progress.md` with a `## Run start` entry, before the first task: **the
  plan's goal, quoted verbatim**, the **deadline it resolves to as a full date
  and time** (§1.0), e.g. `Goal: "Thursday 08:00" → Deadline: 2026-10-01
  08:00`, the wall clock, the session's budget figure (§8.5), and anything under
  `## Limits`. The budget thresholds are proportions of that starting figure,
  and compaction will lose it if it is not written down. From here on
  `progress.md` only grows at its end.
- **Arm the timer** (§9.5) right after the run-start entry, so that from here on
  a usage limit or a stalled turn cannot end the run.

### 1.5 Baseline

Run the three checks in parallel. None of them writes anything tracked:

```bash
npm run lint > docs/ai/night-<YYYY-MM-DD>/lint-baseline.txt 2>&1; echo "exit $?"
npx next typegen && npx tsc --noEmit; echo "exit $?"
npm test; echo "exit $?"
npm run build; echo "exit $?"
npm run test:e2e; echo "exit $?"
```

`next typegen` comes first because `tsconfig.json` includes route types
generated under `.next/`, and stale ones fail `tsc` for no reason in the code.
The e2e suite starts its own `next dev` on port 3100 with a throwaway
`AUTH_SECRET` (`playwright.config.ts`); it needs Chromium
(`npx playwright install chromium`, a human's job before the run).

- **Lint and type check must exit 0.** ESLint exits non-zero on errors only, so
  record the warning count too: the saved report is what later runs are diffed
  against.
- **The build** must exit 0 to join the gate. If it fails *only* because the
  environment is missing or unreachable (no `.env`, `POSTGRES_URL` unset, the
  database refusing connections), it is left out of the gate for the whole run:
  record that, with the error line, and say in the report that no task was
  built. Any other build failure is a red baseline.
- **Tests**: every test script in `package.json` (today `npm test`, Vitest in
  `tests/unit/`, and `npm run test:e2e`, Playwright in `tests/e2e/`) is in the
  baseline and the gate, and must exit 0. Browser tests may log in and submit
  writing forms: they run against `xenocats_test`, rebuilt before every run.
- **Database unreachable** (the e2e global setup fails to connect: the machine
  is off the network, or the server is down): record the error line, and run
  the e2e suite as `E2E_NO_DATABASE=1 npm run test:e2e` for the rest of the
  run, which skips the tests that need it. The build leaves the gate too, as
  above. Report every task's database-backed behaviour as checked by reading
  only (§5). Re-try the plain command at each task start; when it passes again,
  record that and return to it.
- **Side effects of the checks.** `next dev` and `next build` rewrite the
  tracked `next-env.d.ts`, and `next dev` (re-)adds an agent-rules block to
  `AGENTS.md`. Neither is part of any task. After the checks, if either file
  differs and was not dirty at preflight and the task did not edit it, put it
  back with `git checkout -- <that file>`. This is the one place a checkout of
  a file is right: it undoes a tool, not the task's work. Never stage them.

**A red baseline makes the repair task #1**, on
`night-<YYYY-MM-DD>-t0-baseline`, through §2 like any task and never on `main`.
It is the one task the plan does not have to name, because no other task can be
verified until it is done. If it stays red after three cycles, stop the run.
Record that the requested work did not start, and why.

---

## 2. The task loop

`CLAUDE.md` §1 applies per task (explore, plan, implement, verify, review), with
these additions.

0. **Read clock and budget, then cut the branch** from the run branch:

   ```bash
   date '+%F %H:%M'
   git checkout night-<YYYY-MM-DD> && git status --short
   git rev-parse HEAD                      # the task's base SHA -- record it (§7)
   git checkout -b night-<YYYY-MM-DD>-t<N>-<slug>
   ```

   At or past `D`, or past the budget roundup (§8.2, §8.5), do not start it.
   Note the clock, budget and **base SHA** in `current-task.txt` in your
   scratchpad directory, which survives compaction; they go into the task's
   `progress.md` entry when it ends (step 4). The base SHA is what the morning
   report diffs the task's code against.

1. **Verify before committing.** All of these must exit 0, run in parallel as
   in §1.5. **Never commit on a failing or unrun check.**

   ```bash
   npm run lint
   npx next typegen && npx tsc --noEmit
   npm run build                                       # only if in the gate (§1.5)
   npx prettier --check <every file this task changed>
   npm test; npm run test:e2e                          # every test script that exists (§1.5)
   ```

   Then undo the checks' side effects on `next-env.d.ts` and `AGENTS.md`
   (§1.5) before staging.

   A task that adds a test script adds it to the gate from its own commit on.

   - **Workflow lint** joins the gate only if the task changed a workflow (any
     output from `git diff --name-only night-<date> -- .github/workflows/` or
     `git ls-files --others --exclude-standard -- .github/workflows/`), or a
     workflow is known to have failed, including by step 6's poll:

     ```bash
     ~/Binaries/actionlint/actionlint.exe \
       -shellcheck ~/Binaries/shellcheck/shellcheck.exe \
       -pyflakes ~/Binaries/pyflakes/Scripts/pyflakes.exe
     ```

     Always pass both tool paths. On its own, actionlint silently skips the
     shellcheck and pyflakes rules when it cannot find the tools, and still
     reports clean. If any of the three executables is missing, the task
     cannot be verified: abandon it (§3) and name the missing tool.

   - **Lint diff.** Diff the lint output against `lint-baseline.txt`. A new
     warning is either fixed or recorded in `decisions.md` with its reason.
     Warnings do not spend the three-cycle budget (§6).
   - **Formatting** applies to the task's own files only: `npx prettier --write
     <those files>`. Never `npm run format`, which rewrites the whole
     repository, and not every file there matches `.prettierrc`.
   - **Say what ran behaviour.** A clean type check and build prove the code
     compiles, not that it does what the task asked; only tests run it. Say
     which acceptance criteria (§1.0) a test covers and which only the
     reviewer's reading covers.
   - **Undoing an experiment**: reverse your own edit. **Never
     `git checkout <file>` or `git restore <file>` to undo one.** That restores
     the last commit and throws away the task's uncommitted work.

2. **UI work cannot be seen.** Nobody looks at a page unattended. A UI task is
   verified by an e2e test in `tests/e2e/` that performs the interaction the
   change affects, and passes. Pages behind the login are reachable too: log
   in as the seeded demo user (`.claude/rules/testing.md`). Report UI work as **tested in a
   browser, not seen** (or **built, not seen**), and name what a human should
   look at.

3. **Independent review.** For a non-trivial task, dispatch the `reviewer`
   subagent **in the background, at the same moment as step 1's final
   checks**. Give it the task description as the plan wrote it, not your
   reasoning, and let it find the diff itself. If the checks then force a
   non-trivial change, have it re-review. Act on every finding, or record in
   `decisions.md` why not. "The reviewer was wrong" is an acceptable entry;
   silence is not. Unattended, this is the only review the change gets.

4. **Record, then commit.** The task is complete: **append** its entry to the
   end of `progress.md`, headed `## T<N> — <task> (completed)`, and update the
   other state files on the task branch before staging, so the evidence travels
   with the diff. The entry holds:

   - branch and base SHA, clock and budget at start (step 0), and the clock at
     completion;
   - **What the code does**: per file or group of files, the behaviour it adds
     or changes, in plain words;
   - **Why it was added**: the plan task it answers, and any non-obvious choice,
     with its `decisions.md` reference;
   - the verification actually run, with real results (exit codes, lint warning
     count against the baseline), and the reviewer's verdict and what was done
     about it;
   - the CI outcome of the previous task (step 6), if it has resolved since.

   Write the what and the why now, while the context is fresh. The morning
   report copies them (§7). The entry cannot contain its own SHA, or whether the
   push or CI succeeded. Those go into the next task's entry and the report.

   A task that ends any other way — provisional (§4) or abandoned (§3, §6) —
   gets an appended entry too, headed `(provisional)` or `(abandoned)`, with its
   branch and why. It is committed with the next task, or with the report.

   **Gate:** if the previous task's CI poll (step 6) has not resolved yet, wait
   for its notification before this commit. Do something else useful meanwhile,
   or end the turn and let the notification resume you. If it failed, handle
   that first (step 6).

   One commit per task, on the task branch:

   ```text
   <what changed, imperative, one line>

   <why, and what verification was actually run>

   Unattended run: docs/ai/night-<YYYY-MM-DD>/
   ```

   Add whatever attribution lines this session is instructed to add.

5. **Merge.** Only after a complete, green, reviewed task:

   ```bash
   git checkout night-<YYYY-MM-DD>
   git merge --ff-only night-<YYYY-MM-DD>-t<N>-<slug>
   ```

   A refused `--ff-only` means something this protocol does not model is
   writing to the run's branches: **stop the run**. Never fall back to a merge
   commit or a rebase.

6. **Push.**

   ```bash
   git push --set-upstream origin night-<YYYY-MM-DD>-t<N>-<slug>
   git push origin night-<YYYY-MM-DD>
   ```

   A **rejected push**: record it, push nothing further for the rest of the
   run, and keep working locally. No PRs, ever. Local-only runs skip this step.

   **Then poll CI in the background**, if the pushed commit has a workflow
   (`git ls-tree -r --name-only HEAD -- .github/workflows/` prints something).
   If it has none, record "pushed; no CI" and move on. Otherwise start the poll
   with the Bash tool's `run_in_background: true`, record `CI: pending` for the
   task, and **go straight on to the next task**:

   ```bash
   node .claude/skills/night-run/ci-poll.mjs "$(git rev-parse HEAD)" \
     night-<date>-t<N>-<slug> night-<date>
   ```

   It waits 5 minutes, then checks every 3, and exits once every named branch
   has a completed run, after 30 minutes, or after two API errors in a row. A
   `PROVISIONAL:` branch (§4) is pushed alone, so pass only its own name. When
   the notification arrives, note the outcome in `current-task.txt`; it goes
   into the next task's `progress.md` entry (step 4), or the report:

   - **All `success`** → "CI passed", with the run URLs. This is the only
     outcome that may say so.
   - **`UNOBSERVED`, `cancelled` or `skipped`** → "pushed; CI not observed",
     and why. Never infer a result.
   - **`failure` the run cannot fix** → CI's environment, not the code: a
     repository setting is missing or wrong, or the runner image changed
     (e.g. the *Start PostgreSQL* step fails: no preinstalled PostgreSQL, or
     TLS off), shown by the failing job's
     name and step and by the same check passing locally. Record "CI failed:
     environment (<what is missing>)" and put in `questions.md` exactly what a
     human must set. Spend **no** repair cycle on it, and do not count it toward
     §6's stop condition: no code change can fix it, and §3 forbids the run
     from changing GitHub settings. Later tasks' CI will fail the same way;
     record each, and keep working.
   - **`failure`** otherwise → a verification failure found late. It continues
     this task's three-cycle count (`.claude/rules/debugging.md` §8):
     1. Name the failing jobs: append `/jobs` to the run's API URL
        (`https://api.github.com/repos/<owner>/<repo>/actions/runs/<id>/jobs`,
        the repository from `git remote get-url origin`, as the run URL shows).
        Do not fetch logs, which needs auth and is outside §3's exception.
     2. Park the task in flight. Stash **only the paths it touched**
        (`git stash push -- <paths>`), never the pre-existing changes.
     3. Check out task N's branch (still the run-branch tip, since step 4's
        gate kept the next task from merging). Reproduce the failure locally
        with the matching check, fix it in a **new commit** (never `--amend`,
        because the commit is pushed), then steps 1–6 again: fast-forward,
        push both, poll the new SHA.
     4. Return: `git checkout <in-flight branch> && git merge --ff-only
        night-<date> && git stash pop`. The in-flight branch has no commits of
        its own (one commit per task, at the end), so this fast-forward always
        succeeds.
     5. On the third failed cycle, leave task N's branches pushed as they are
        (nothing pushed may be rewritten), record the three hypotheses and what
        each CI run showed, and continue. A failure that does not reproduce
        locally is evidence that the environments differ (CI's secrets, a
        fresh `npm ci`, Linux). Record that; do not guess. A second task
        reaching three cycles stops the run (§6).

   The API allows 60 unauthenticated requests an hour and one poll makes at
   most 10, so never run more than one poll at a time outside a CI-fix cycle.

7. **Never commit directly to the run branch.** It moves only by fast-forward,
   which is what makes `--ff-only` a real check. Anything left to record goes
   in the next task's commit, or the report's.

**Provisional work** (built on a §4 assumption) is one commit prefixed
`PROVISIONAL:`, on its own task branch, **pushed but never merged**, so no later
task inherits the assumption. Name the branch in `questions.md`.

**Abandoned work** (§3, §6) stays on its local branch, unmerged and unpushed. A
pushed branch reads as an offer. Name it in `progress.md` and do not delete it.

---

## 3. Forbidden operations

Never, unattended:

- `git push --force` / `--force-with-lease`, `--delete`, `--tags`, or a push to
  anything outside this run's `night-<YYYY-MM-DD>` namespace: never `main`,
  never a ref this run did not create. Check the name before every push.
- Opening a pull request.
- Rewriting history (`rebase`, `commit --amend`, `reset --hard`) except over
  your own uncommitted work. Once pushed, never.
- Stashing, restoring or discarding changes you did not make in this run.
- **Any database but the development one, or touching it by hand.** The run
  reaches the database only through `npm run test:e2e` (which rebuilds
  `xenocats_test`) and the build (which reads `xenocats`). Never run SQL or
  `npm run db:*` yourself, never touch the `xenocats` schema or anything else
  on that server, and never a hosted database. A schema change is a new file in
  `db/migrations/` (never an edit to an applied one), written when the plan asks
  for it and proved by the e2e run that rebuilds the test schema from it.
  Applying it to `xenocats` is a human's `npm run db:migrate`; say so in
  `questions.md`.
- Reading, printing or writing `.env` or any `.env*` file, or writing a real
  credential anywhere. `test -f .env` is the only permitted contact. Pushed, a
  secret is a disclosure, not a mess.
- Adding, removing or upgrading a dependency, or running `npm install` in any
  form. `next`, `react` and `react-dom` are `latest` in `package.json`, so even
  a bare `npm install` can move them. Whether a dependency earns its place is a
  human's decision.
- `npm run format` or `prettier --write .` — they reformat files the task did
  not touch.
- Weakening a check to make something pass: `eslint-disable` comments,
  `@ts-ignore` / `@ts-expect-error`, an `any` cast that silences a type error,
  or loosening `eslint.config.mjs` or `tsconfig.json` (`AGENTS.md` §19).
- Installing software, changing `PATH` beyond the per-command prefix, or
  modifying anything outside this repository.
- Deleting a file you did not create in this run.
- Contacting any external service, **except** `git push`/`fetch` to `origin`
  for this run's branches; the §2 step 6 poll (`ci-poll.mjs` and the `/jobs`
  lookup): read-only, no token, only on commits this run pushed; and the
  development database, through the build and the browser tests above.

**If a task needs one of these, abandon it.** Write in `questions.md` what was
needed, which rule blocked it, and the exact command or diff for a human to
approve verbatim. Then:

```bash
git restore -- <paths this task touched>    # never a bare `git restore .`: pre-existing changes are not yours
git checkout night-<YYYY-MM-DD>
```

Do not implement up to the boundary. A half-applied change is worse than none.

---

## 4. Ambiguity: park and continue

When a requirement has two defensible readings — judged against the task's own
words and the rest of the plan, not your preference — or a fork appears that
`AGENTS.md` §18 would have you ask about:

1. In `questions.md`: the question, each option with its consequence for the
   plan's tasks, your recommendation, and what you did meanwhile.
2. Take the **smallest reversible** interpretation: cheapest to undo, not most
   likely right.
3. Build it as a `PROVISIONAL:` commit on its own branch. Push it, do not merge
   it (§2), and name the branch beside the question.
4. Continue with the next independent task. If a task depends on the answer,
   park it too.

---

## 5. Task fitness

The plan chooses the tasks; this section only says how to treat them.

Logic that needs no database is provable by a Vitest test (import
`app/lib/schemas.ts`, not `app/lib/actions.ts`, which opens a connection), and
pages, including those behind the login and forms that write, by a Playwright
test against `xenocats_test`. Behaviour no test exercises is verified only by
reading.
Do such tasks when the plan asks for them, and report each acceptance criterion
as **checked by command** or **checked by reading only**.

Primarily visual work and matters of taste are the weakest unattended tasks:
nobody sees the result (§2 step 2). Build what the plan asks, report it as
built, not seen, and never extend it beyond the task.

---

## 6. Stop conditions

End the run (merge, push and delete nothing further) when:

- **The plan or its tasks are missing, or its goal is missing, unreadable or
  already past** (§1.0).
- **`node_modules` or Chromium is missing** (§1.1).
- **A second task hits three failed verify → repair cycles.** The first one
  just gets abandoned (§3), with all three hypotheses recorded
  (`.claude/rules/debugging.md` §8), and the run moves on.
- **The baseline stays red** after three attempts (§1.5).
- **The remote already holds this run's namespace** at the start of a new run
  (§1.3).
- **A `--ff-only` merge is refused** (§2 step 5).
- **The clock reaches the goal time `D`** (§8.2). No new task starts; the task
  in flight is finished (§8.4), then the morning report is appended and the run
  stops.
- **The budget reaches roundup** (§8.5). That ends the *session*. It ends the
  *run* only if this session owes the report; otherwise hand off (§9.3).
- **The plan's tasks are done** before `D`. Write the report and stop. Stopping
  early with a clean record is a success. **Do not invent work** to fill the
  time. Work you think the plan is missing goes in the report as proposed
  tasks.

A rejected push is **not** a stop. It ends pushing, not work.

On stopping: the tree clean or its state explained, `progress.md` current,
outstanding CI polls resolved or recorded as pending, and the run branch at the
last task that passed its checks.

---

## 7. Morning report

The **run's** last act. It is a task like any other, on
`night-<YYYY-MM-DD>-t<N>-report`, merged and pushed, and it is **appended as the
last part of `progress.md`**, under exactly `## Morning report`, after the final
task's entry. Nothing is appended after it. §1 recognises a finished run by that
heading. It is never cut short for the clock (§8.4). An earlier session appends
§9.3's handoff instead, which carries the same content.

**Before writing it, let every outstanding CI poll resolve** (or reach its own
30-minute timeout). The report's own push is not waited on.

Build it from `plan.md`, `progress.md`, `questions.md` and `git`, not from
memory. It contains:

- **Goal**: the plan's `## Goal` quoted verbatim, the deadline it resolved to,
  the clock when the report was started, and **what ended the run**: the goal
  time, the task list running out, the budget, or a stop condition.
- **Tasks**: every task in the plan with its outcome — completed, provisional,
  abandoned, or not started (and why: the goal time came, or a dependency was
  parked). For each completed task's acceptance criteria, whether the evidence
  was a command or only reading (§5).
- **Completed**: a table of task, branch, SHA, verification actually run, and
  CI outcome. Use "CI passed" only with a `success` in hand and the run URL,
  otherwise "CI failed, fixed in N cycles (job)", "abandoned after 3 CI cycles
  (job)", "pushed; CI not observed", "pushed; no CI", "not pushed: rejected" or
  "local-only".
- **Code by task** (below).
- **Provisional**: what was built, on which question, on which branch.
- **Abandoned**: the task, why, what it needed, and its local branch.
- **Questions**: the `questions.md` queue, most consequential first, including
  any proposed tasks for the next plan.
- **Clock and budget**: the starting figures (§1.4), and the reading at each
  task's start and completion; how far past `D` the last task ran, if it did.
- **State**: the run branch and tip, which branches reached the remote,
  anything uncommitted, whether the build was in the gate, and the lint warning
  count against the baseline.
- **What nothing has checked**: at minimum, which acceptance criteria only a
  reading covers (§5), that nobody looked at the pages, and that no change was
  exercised against a production database (there is none yet).

### Code by task

For every completed and provisional task, the report shows the code the task
added, then says what it does and why it was added. Generate the diffs from git
rather than retyping them. That keeps them exact, and they never need to pass
through your context:

```bash
# tasks.txt, in your scratchpad directory: one line per task, <N> <base SHA> <task branch>
while read -r n base br; do
  stat=$(git diff --shortstat "$base" "$br" -- . ':(exclude)docs/ai/')
  printf '#### T%s — `%s`\n\n<!-- T%s what/why -->\n\n' "$n" "$br" "$n"
  printf '<details><summary>Code: %s</summary>\n\n~~~~diff\n' "$stat"
  git diff "$base" "$br" -- . ':(exclude)docs/ai/'
  printf '~~~~\n\n</details>\n\n'
done < tasks.txt > code.md                  # both in the scratchpad, never the repo
```

The range runs from the task's base SHA to its branch tip. The state files are
excluded. Then replace each `<!-- T<N> what/why -->` marker with that task's
entry from §2 step 4:

- **What it does**: per file or group of files, in behavioural terms, e.g.
  "`app/lib/actions.ts`: `deleteInvoice` now refuses an unknown id instead of
  reporting success".
- **Why it was added**: the plan task, plus any non-obvious choice (`D<n>`).

Put the section inside the morning report, after the Completed table. The
tilde fence survives backtick fences in diffed Markdown. The collapsed
`<details>` keeps the report readable. A task whose diff is only state files
says so in one line instead of an empty block.

Report only what was observed. "Could not verify X" is useful. A claimed
passing check that never ran is a lie the morning will act on. Under a tight
budget, cut prose, never facts.

---

## 8. Deadlines: the clock and the budget

The run ends at whichever comes first: the **goal time** `D` (§8.1–§8.4), which
the plan sets, or the session **budget** (§8.5). If the account's usage limit
runs out first, the run pauses until the timer's next firing after it resets
(§9.5); §2's commit-and-push per task bounds what an interrupted turn loses. Both reserve room for the report instead of leaving it the
remainder.

### 8.1 Reading the clock

**Never `TZ='Europe/Stockholm' date`.** Git Bash here has no zoneinfo and
silently returns GMT (measured 2026-09-16: two hours early, identical to
`TZ=UTC`). The machine clock is on Stockholm time, so use `date '+%F %H:%M'`.
Its `WEST` label is wrong but cosmetic. Always read the date together with the
time.

If preflight's time-zone id is not `W. Europe Standard Time`, record that, and
read the time with:

```bash
powershell -NoProfile -Command "[System.TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, [System.TimeZoneInfo]::FindSystemTimeZoneById('W. Europe Standard Time')).ToString('yyyy-MM-dd HH:mm')"
```

In that case resolve the goal's weekday (§1.0) against that reading too, not
against `date`.

### 8.2 The checkpoints

**The deadline `D` is the plan's `## Goal`, resolved to a full date and time
when the run started** (§1.0): `Thursday 08:00` read on Wednesday 2026-09-30
gives `2026-10-01 08:00`. It belongs to the run. A resumed session copies it
from `progress.md` and never recomputes it. Compare full dated readings, never
times alone: 23:10 on the 30th is not "after 07:30" on the 1st.

Read clock and budget at every task start (§2 step 0) and completion (§2
step 4).

| From | Rule |
| ---- | ---- |
| before `D` | Tasks start as normal. |
| `D`  | **Goal time.** No new task. The task in flight is finished (§8.4). Then the morning report is appended to `progress.md` (§7), and the run stops. |

### 8.3 Estimating

This repository's first run is recorded in
`docs/ai/night-2026-09-25/progress.md` (its tasks' start times give their
lengths; T9 took 16 minutes). On the project this protocol came
from, the median task took **~20 minutes** (range 3–50), and the `reviewer` took
4–7 minutes of that. `npm run build` and the e2e suite are the slowest local
checks; time them and record it. CI overlaps the next task (§2 step 6), so it
adds wall-clock time only when it fails, and at the very end, where the report
waits on the last poll.
Replace these figures with this repository's own once a run has produced them.
A task started shortly before `D` runs past it by up to its own length; that is
expected, and the report says by how much (§7).

### 8.4 At the goal time: finish the task in flight

At `D`, **run the task in flight to completion** through the whole of §2:
gate, reviewer, commit, merge, push, and its appended `progress.md` entry. The
clock does not shorten any of it. **Never traded for time: the reviewer pass
and a passing gate.**

The task still ends the ways any task can: abandoned after three failed
verify → repair cycles (`.claude/rules/debugging.md` §8), or on a forbidden
operation (§3), or at the budget ceiling (§8.5). When it has ended, write the
report; start nothing else. The report itself is never cut for the clock.

### 8.5 The budget

**Read** the harness's `<total_tokens>N tokens left</total_tokens>` at the same
checkpoints as the clock. Do not estimate it. Thresholds are proportions of the
figure **this session** started with, and whichever of the two numbers is larger
applies:

| Remaining | Rule |
| --------- | ---- |
| below the **reserve** (next table) | **Roundup.** Start nothing new. Finish the task in flight only if its change is written, its verification is green or running and expected to pass, the `reviewer` has run or there is room for it, and no failure is unresolved; otherwise abandon it (§3). Then close out: the report if this session owes it, otherwise the handoff (§9.3). |
| below 4%, or 40k | **Ceiling.** Abandon, and close out now. |

| This session | Reserve | Closes with |
| ------------ | ------- | ----------- |
| is final: at or past `D`, or less than one task's length before it | **30%**, or 150k | the morning report (§7) |
| otherwise; another session can follow | **10%**, or 60k | the handoff (§9.3) |

Misjudging which session is final is safe, because a handoff is written to
serve as the report (§9.3).

For scale, a run on the source project used 4.7% of 15M tokens for preflight,
17 tasks and the report, about 40k per task. Keep reading the figure anyway,
because the run that does end on budget needs its report most. The
`reviewer`'s own usage is billed to the subagent, not to this figure.

**No figure visible:** say so in the report, and round the session up after five
completed tasks, handing off first if it is more than one task's length before `D`. After a context
compaction, trust `progress.md` over memory.

---

## 9. Running across sessions

The run branch and `docs/ai/night-<YYYY-MM-DD>/` *are* the run. A session only
holds them for a while, and nothing of its conversation survives it. A timer
heartbeat is not a new session (§9.5).

### 9.1 What a session owes the next

The run branch with every completed task merged and pushed. State files current,
with the goal and its deadline quoted, an appended entry for every task that
ended, holding real verification output, its base SHA and its what/why (§2 step
4), and every CI outcome observed. A handoff (§9.3) as the last entry.

### 9.2 Resuming

Reached from §1. Do not re-run §1.0, §1.2 or §1.4.

```bash
git checkout night-<YYYY-MM-DD>     # the date comes from the branch, not `date`
git status --short
git log --oneline main..HEAD
```

1. Read the state files, starting with `progress.md`'s last entry: that is the
   handoff. Take the goal from `plan.md`, and check it matches the copy in
   `progress.md`. If the human has changed it since, the plan wins: resolve the
   new text against the run's start reading in `progress.md` (§1.0), append the
   change and the new deadline, and use that. If the new time is unreadable or
   already past, write the report and stop.
2. Re-run §1.1 and §1.5 (the baseline is a claim you inherit). Compare the lint
   output against the existing `lint-baseline.txt` and never overwrite it.
3. Append a new session heading to `progress.md` with this session's starting
   clock and budget (its own denominator), and copy the deadline as it stands.
4. Any CI recorded as `pending` belongs to a poll that died with the old
   session. Run the poll again once on that SHA. A task that was in flight
   when the old session ended has no entry; if its branch has no commit, start
   it again from §2 step 0.
5. Pick up an abandoned task only if it was abandoned for budget. The
   three-cycle limit belongs to the run and does not reset.
6. Arm the timer if this session has none (§9.5).
7. Continue at §2 step 0. The resume entry is committed with the next task.

### 9.3 The handoff

What a session writes instead of the morning report when it stops before `D`:
appended to `progress.md` on `night-<YYYY-MM-DD>-t<N>-handoff`, merged and
pushed. Head it `## Handoff`, **never** `## Morning report`, or §1 will treat
the run as finished.

It states why the session stopped, where the run is (its tip, which tasks are
done and which remain), anything in flight and why it was left, the next
session's first step in one sentence, and **everything §7 requires, including
Code by task**. If no session follows, this is the
morning report, so write it for the person at breakfast. Never write anything
that only makes sense if another session comes.

### 9.4 The run is still one run

These carry across sessions and never reset: the three-cycle limit, the dated
deadline, the append-only `progress.md`, and parked questions (a later session inherits the
decision and the `PROVISIONAL:` branch). Only the budget is per session.

### 9.5 The timer: heartbeats and usage limits

A run is started with a plain **`/night-run`**. The run then arms its own timer
(§1.4, §9.2 step 6), a recurring Claude Code job that fires in this session
every 20 minutes whenever the session is idle (a firing during a turn waits for
it to end). It keeps firing however the previous turn ended, so a run cut off by
the account's **usage limit** resumes by itself at the first firing after the
limit resets: within one interval, plus up to 10% jitter. Firings while the
limit is still in force fail and cost nothing.

**Arming it.** `CronList` first; if any job whose prompt invokes the night-run
skill exists (this one, or a human's `/loop` that says it is the run's timer),
do nothing.
Otherwise `CronCreate` with `cron: "7,27,47 * * * *"`, `recurring: true` and
exactly this prompt:

```text
Run unattended. Invoke the night-run skill. If this session already holds the run, this is a heartbeat (§9.5). Otherwise, if a night-* run branch exists whose progress.md has no "## Morning report", resume it (§9.2). Otherwise stop immediately: skip §1.0, create no branch, write no file, and delete this timer.
```

The prompt can only continue a run, never start one, so a firing after the run
has ended writes nothing. Record the job id in `current-task.txt`.

- **Started under a `/loop`.** A human may instead start with `/loop <interval>
  <prompt>`, whose prompt invokes this skill and may allow starting a run; then
  that loop is the timer, §1.4 finds it with `CronList` and arms nothing, and
  ending deletes that loop. A self-paced `/loop` (no interval) lives
  only as long as every turn ends with `ScheduleWakeup`; a turn the usage limit
  cuts off never gets there, and the run dies. If a run is under one, arm the
  timer anyway and stop calling `ScheduleWakeup`.
- **The timer lives in this session.** It is gone if the editor or terminal
  closes or the machine sleeps; then a human resumes with a new session (§9.2).
  It expires after 7 days, far beyond any run.
- **Tell a heartbeat from a new session** by your own context: if this
  conversation already holds this run's preflight or task work, it is a
  heartbeat. After a compaction, `progress.md` on the run branch, with this
  session's heading and no handoff after it, says the same.
- **On a heartbeat**, run no preflight, no baseline and no §9.2 resume. Read
  the clock and budget, `git status --short`, `git branch --show-current`,
  `current-task.txt` in the scratchpad and the last entry of `progress.md`, then
  carry on where they say:
  - a background job (build, `reviewer`, CI poll) still running → nothing to
    do; end the turn and let its notification or the next firing resume you;
  - a task in flight → continue it from its current step;
  - between tasks → §2 step 0 for the next one, or, at or past `D`, the
    morning report (§8.2).
- **After an interruption** (a usage limit, or a turn that ended mid-step):
  nothing from the cut-off turn is trusted. A background job started before it
  may have finished while the limit was in force, and its notification is then
  lost: check whether it is still running and read its output file rather than
  waiting for it; if neither is available, run it again. A check whose result
  is not in `current-task.txt` or `progress.md` is re-run. Edits on disk are
  kept and re-verified, never assumed done. Append the gap (from when to when)
  to `progress.md` with the next entry; the report lists it under Clock (§7).
- **Ending:** once the morning report (§7) is pushed, or any §6 stop condition
  has ended the run, delete the timer: `CronList`, then `CronDelete` on the
  job whose prompt invokes the night-run skill. A
  firing that finds `## Morning report` already on the run branch deletes it
  and does nothing else. A session that hands off (§9.3) deletes its timer
  too: the next session is started by a human with `/night-run`, and arms its
  own.
- **Past the goal time:** a firing after `D`, for example the first one after a
  usage limit resets, finishes a task still in flight (§8.4), writes the report
  if none exists and deletes the timer. It starts no new task.
