# Questions — night run 2026-10-07

What needed a human: the question, the options and their consequences, the recommendation, and what was done meanwhile.

## Q1 — Should CI's "Database tests" step fail when every database test skipped? (proposed task, not built)

From T1's review. With the tests opt-in, a CI step that lost its `DATABASE_TESTS: '1'` (or its `POSTGRES_URL`) would report green with 17 skipped tests. Option: run the step with a reporter check (e.g. fail if the vitest JSON summary shows 0 passed). Recommendation: a one-line guard in the next plan; low urgency. Meanwhile: nothing changed.
