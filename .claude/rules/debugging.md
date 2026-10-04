# Debugging Rules

Do not begin debugging by guessing at a patch. Use evidence.

---

## 1. Reproduce

First establish whether the problem can be reproduced.

Record:

- input
- environment
- expected behavior
- actual behavior
- relevant error
- frequency
- relevant state

If reproduction is impossible, identify what evidence is available instead.

### Reproducing a CI failure

CI always starts cold: a fresh checkout, a fresh `npm run build`, an empty
`.next/cache` (including the image optimizer's `.next/cache/images`), a new
database and a new browser profile. A local machine is warm, and warm state can
hide the failure — a cached image, a reused build or leftover data turns a
deterministic CI failure into a local pass.

So before reproducing a CI failure, match its starting state:

- delete `.next/cache` (or the whole `.next`) and rebuild, as the job does
- run the job's exact command and environment (`CI=1`, `E2E_SERVER=start` for
  the *build* job, the same test files together, the same worker count)
- let the browser tests' global setup rebuild their schema, as it does in CI

A local pass from a warm machine is not evidence that CI's failure is flaky or
fixed. If the failure still does not reproduce cold, ask for the job's
Playwright traces (`trace.zip` from the retry) rather than guessing.

---

## 2. Trace

Follow the actual execution path.

Inspect:

- entry point
- inputs
- transformations
- state changes
- external calls
- persistence
- error handling

Do not stop at the first suspicious line.

---

## 3. Hypothesize

Form plausible explanations.

A useful hypothesis should be testable.

Example:

> The request is authorized against the current user's tenant, but the database lookup is not scoped to that tenant.

This is better than:

> Something is wrong with permissions.

---

## 4. Gather Evidence

Use:

- logs
- stack traces
- tests
- targeted instrumentation
- code inspection
- database state
- network behavior
- browser behavior

Eliminate hypotheses based on evidence.

---

## 5. Root Cause

Do not patch symptoms when the underlying cause is identifiable.

Before changing code, be able to explain:

- what failed
- why it failed
- why the failure occurs
- why the proposed fix prevents recurrence

---

## 6. Fix

Make the smallest appropriate fix.

Avoid unrelated cleanup.

If the fix changes behavior, add or update regression coverage.

---

## 7. Verify

Verify the original failure again.

Then run broader validation as appropriate.

Preferred sequence:

```text
original failure
     ↓
fix
     ↓
original case passes
     ↓
regression test passes
     ↓
broader validation
```

---

## 8. Repeated Failure

If several attempted fixes fail:

Stop patching.

Reassess:

- the root-cause hypothesis
- assumptions
- environment
- reproduction
- architecture
- test validity

Repeated unsuccessful patches are evidence that the current model is probably wrong.

### The limit is three

Three consecutive verify → repair cycles against the *same* failure and you stop
fixing. A fourth attempt is not persistence; it is evidence that the hypothesis
is wrong and you are now editing code at random.

Supervised, that means: state the failure, what you tried, and what each attempt
ruled out — then ask.

Unattended, there is nobody to ask, so the count is a hard stop for that task:

1. `git checkout --` / `git restore` the task's changes, leaving the tree at the
   last verified-green commit. A half-repaired failure is worse than none.
2. Record in `progress.md`: the exact failure output, each of the three
   hypotheses, and what each attempt eliminated.
3. Move to the next independent task. Do not retry this one later in the same
   run under a different description.

The three attempts are worth more as a documented elimination than as a fourth
guess. Count cycles against one failure — a *different* failure surfacing after a
genuine fix resets the count.

---

## 9. Completion Report

For significant debugging work, report:

- root cause
- evidence
- fix
- regression coverage
- validation
- remaining uncertainty
