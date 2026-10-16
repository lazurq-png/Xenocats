# Progress — night run 2026-10-17

Append-only. One entry per task, appended when it ends; the morning report is inserted at the top.

## Run start

- Goal: "2026-10-17 10:00" → Deadline: 2026-10-17 10:00
- Started 2026-10-17 00:28 (Europe/Stockholm, `W. Europe Standard Time`).
- Limits (plan): information only; a run of about ten hours that may meet the account's usage limit.
- Timer: the prompt was pasted as `/loop 20m …` text, but `CronList` showed no job, so the §9.4 timer was armed (cron `7,27,47 * * * *`, job 8c5d59df).
- Environment: node v24.22.0, npm 11.19.1, node_modules present, Chromium present, .env present (existence only). Remote origin reachable; no `Nightrun` or `2026-10-17-*` branches there.
- Pre-existing uncommitted changes: none. The plan is committed on `main` (cdab0b5).
- Plan note: its `## Design decisions` "Order" names tasks 7 and 8 and a checkpoint 2 after task 8, but `## Tasks` lists only 1–6. The run does tasks 1–6, checkpoint 1, then a checkpoint 2 only as the plan's "after every 5th exploration item" schedule gives one (D1).
- Plan note: `## Exploration` says "four kinds" but names three (bugs; speed on a weak machine; security and quality). The run rotates through the three named (D1).
- Baseline: see the next entry.

## Baseline (2026-10-17 00:38)

Green. Lint exit 0, 0 warnings (`lint-baseline.txt`), 9 s. `next typegen` + `tsc` exit 0, 9 s. `npm test`: 46 files passed / 1 skipped, 946 tests passed / 34 skipped, 43 s. Database tests (`DATABASE_TESTS=1`): 34 passed, 0 skipped, 11 s. `npm run build` exit 0, 15 s (in the gate). `npm run test:e2e` (next dev, 4 workers): first run exit 1, with 1 failed, 80 not run (they wait on `cat-attacks`) and 72 passed in 76 s. The failure: `touch.spec.ts:7` "on a touch screen the fake cursor stays off…", at line 48, where `summon-status` read "Pulsar Siamese is on its way." and not "…, and will nap". It passed 5 of 5 alone (`--repeat-each 5`), and the full suite's second run passed (151 passed, 2 skipped, 138 s). Recorded as a flake (Q1). `E2E_SERVER=start npm run test:e2e`: 151 passed, 2 skipped, 115 s. The `AGENTS.md` heading rewrite by `next dev` was reverted with `git checkout -- AGENTS.md` after each browser run.

The machine had a foreign process busy throughout: `vitest run tests/unit/xenocats tests/unit/actions.test.ts` (PIDs 11888, 16300 and worker 7968), started 2026-10-16 22:23, before this run, using about one core. It is not a §2.3 leftover (not a test server or Playwright browser), so it was left alone (Q2).

## T1 — A run that used a test hook is never ranked (completed)

- Branch `2026-10-17-t1-hooks-unranked`, base a62b5e4. Started 00:38, completed 00:49.
- **What the code does.** `test-hooks.ts`: a new `activeTestHooks(search)` names the hooks a URL puts in effect (seed, speed, boss, fps, crowd, elite, fusion, pickups; an unusable value counts as none), built on `parseTestHooks`. `arena-view.tsx`: a run's rankability is now "no hook in effect" (before, a seed and the frame counter were let through); a hooked run never calls `startSurvivalRun`. `leaderboard-entry.tsx`: a hooked run's results show one line naming the hooks ("Not ranked on the leaderboard: this run used test settings (?seed=).") in place of the name form. `playwright.config.ts`: the `survival` browser group now waits for the login setup, so a spec there can use the demo user's session. Tests: `test-hooks.test.ts` (none in effect → rankable; each hook alone, in order, and every `TestHooks` field nameable); `leaderboard.spec.ts` (a signed-in seeded run offers no entry; the hook message names both hooks; the two existing runs drop the seed they no longer may use).
- **What it brings.** Nobody can put a seeded, sped-up or otherwise hooked run on the leaderboard from the game any more, and the player is told why, while every hook still works for the tests. What the server itself cannot check is written down, with stronger options proposed (Q3). Decisions: D2–D6.
- **Verification.** prettier (6 files) ok; lint exit 0, 0 warnings (baseline 0); typegen + tsc exit 0. Selector: `FULL` (`playwright.config.ts`), so the full suites ran: `npm test` 950 passed / 34 skipped, exit 0; database tests 34 passed, 0 skipped; build exit 0; `npm run test:e2e` 152 passed / 2 skipped; `E2E_SERVER=start` 152 passed / 2 skipped. Acceptance: (a), (b), (d), (e) checked by command (unit and e2e); (c) checked by the full browser suites, which use the hooks throughout. That a hooked run makes no `startSurvivalRun` call is checked by reading only.
- **Reviewer.** Approve, no findings. It noted that the no-`startSurvivalRun` claim is covered by reading only (recorded above).
