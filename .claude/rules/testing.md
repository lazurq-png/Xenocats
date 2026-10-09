# Testing Rules

Tests provide the feedback loop that allows coding agents to work autonomously. Open this when planning coverage or triaging test failures.

**In this repository:** unit tests use Vitest (`npm test`, `tests/unit/`,
Node environment, `TZ=UTC`); browser tests use Playwright with Chromium
(`npm run test:e2e`, `tests/e2e/`), which starts its own `next dev` on port
`3100`, or `next start` over an existing build with `E2E_SERVER=start`. Test logic that does not need the database in `tests/unit/` by importing
modules that do not open a connection (`app/lib/schemas.ts`, not
`app/lib/actions.ts`). Browser tests run against the `xenocats_test` schema,
rebuilt from the migrations and seed data before every run
(`tests/e2e/global-setup.ts`), so they may log in (`user@nextmail.com` /
`123456`) and submit forms that write. A spec that needs a session, not the
login form, starts with the one `tests/e2e/auth.setup.ts` saves once per run
(`test.use({ storageState: DEMO_USER })`, `tests/e2e/demo-user.ts`). A wait for
something the page does in its own time (a cat's attack, a nap) runs the page's
clock on (`page.clock.install()`, then `clock.runFor`) instead of sitting
through it, as `cats.spec.ts` does. A form's validation errors, field by field,
are a jsdom test (`tests/unit/forms.test.tsx`), not a browser one. The tests run in parallel against that
one schema: a test that writes creates its own rows and asserts only on them,
never on counts or on seed rows another test may change. Tests that need the
database skip when no `POSTGRES_URL` is configured, or with `E2E_NO_DATABASE=1`
(the server is unreachable). The schema is shared: two machines running the
suite at once drop it under each other. The queries in `app/lib/data.ts` are
tested in Vitest by `tests/unit/data.test.ts`, against its own schema
(`xenocats_vitest`, rebuilt when the file runs), so they never meet the browser
tests' rows. That file is opt-in: it runs only with `DATABASE_TESTS=1` (CI's
"Database tests" step sets it), so a plain `npm test` never touches a
database; opted in, it skips the same way.

---

## Test Behavior

Prefer testing observable behavior and important invariants.

Avoid tests that unnecessarily lock implementation details.

A refactor should not break a test merely because an internal helper was renamed if the externally observable behavior is unchanged.

---

## New Features

For new behavior, consider coverage for:

- normal behavior
- important edge cases
- expected failures
- validation
- authorization
- persistence
- integration behavior
- UI interaction where relevant

Do not mechanically create tests for every line.

Test meaningful behavior.

---

## Bug Fixes

Whenever practical, create a regression test that demonstrates the original failure.

Preferred sequence:

```text
test fails
   ↓
fix
   ↓
test passes
```

This provides evidence that the fix addresses the actual bug.

---

## Test Selection

Start with the narrowest relevant test.

For example:

```text
specific test
    ↓
module tests
    ↓
integration tests
    ↓
full suite
```

Use broader validation when the change warrants it.

In this repository the module step is `npm run test:affected -- --base <ref>`
(`scripts/affected-tests.mjs`): `vitest related` over the changed files, and
the browser specs that visit a route the change reaches, plus the opt-in
database tests (a `database:` line) when a query or the schema changed. It prints `FULL` for a
change it cannot place; take that, and never shrink its selection by hand. A
new spec must name the routes it visits as paths (`page.goto('/cats')`, a
`toHaveURL` regex) so the selector can find it; `tests/unit/affected-tests.test.ts`
fails for a spec no route reaches. The full suites still run at the points
`.claude/skills/night-run/SKILL.md` §2.1 names, and CI runs them on every push to `Nightrun` or `main` (and pull
requests into either).

---

## Flaky Tests

Do not simply retry flaky tests indefinitely.

Investigate:

- timing
- shared state
- order dependence
- external services
- race conditions
- cleanup
- nondeterminism

A test that passes only after repeated retries is not reliable evidence.

---

## Test Failures

When a test fails:

1. read the failure
2. determine whether the change caused it
3. inspect the relevant implementation
4. identify root cause
5. repair the implementation or test as appropriate
6. rerun

Do not modify assertions simply to make the suite green.

---

## Definition of Done

A task is not complete merely because:

- code compiles
- one test passes
- the agent believes it is correct

Completion requires:

- acceptance criteria satisfied
- appropriate tests
- relevant validation
- final diff review

---

## Test Quality

Avoid:

- meaningless snapshot expansion
- excessive mocking
- testing private implementation details
- duplicate coverage without value
- tests that encode accidental behavior

Prefer tests that remain useful as the code evolves.
