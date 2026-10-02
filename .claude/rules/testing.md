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
`123456`) and submit forms that write. The tests run in parallel against that
one schema: a test that writes creates its own rows and asserts only on them,
never on counts or on seed rows another test may change. Tests that need the
database skip when no `POSTGRES_URL` is configured, or with `E2E_NO_DATABASE=1`
(the server is unreachable). The schema is shared: two machines running the
suite at once drop it under each other. The queries in `app/lib/data.ts` are
tested in Vitest by `tests/unit/data.test.ts`, against its own schema
(`xenocats_vitest`, rebuilt when the file runs), so they never meet the browser
tests' rows; it skips the same way.

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
