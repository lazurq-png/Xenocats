# Questions

## Q1 — a flaky co-op e2e test (found in T7's gate; no human decision needed, an exploration candidate)

`survival.spec.ts` "two Keepers at one keyboard: each walks with his own keys, and a level-up asks both in turn" failed once in 12-spec gate run 1 (`getByTestId('survival-level-up')` heading `/Level \d+\. Player 1, choose one\./` not visible within 5 s, line 502 after a 40 s wait for the dialog) and passed in run 2 of the same selection and 4 of 4 times alone (`--repeat-each 4`). The test depends on `speed=6` timing and 12 workers share the CPU. Likely cause (unverified): the dialog was visible, but for a chooser other than Player 1, or the heading rendered after the 5 s expect under load. Look at it as an exploration "bugs / flaky tests" item.
