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

## T2 — Four of the kitchen drawer's weapons each work in a way of their own (completed)

- Branch `2026-10-17-t2-weapon-kinds`, base c690e7b. Started 00:49, completed 01:41.
- **What the code does.** `arsenal.ts`: four new weapon kinds, `boomerang`, `swat`, `cling` and `scare`, given to the Tennis Ball, Frying Pan, Static Sock and Cucumber, with new lines in the game's voice. Their stats are unchanged. Tape Measure speeds the two thrown kinds, and the level-up cards have words for the new kinds. `arena.ts`: the Tennis Ball turns home halfway and can touch every cat again on the way back. The Frying Pan sends each small cat it swats flying, and that cat bowls over up to 4 others for half the swat. The Static Sock clings to a cat, follows it, sparks every 350 ms at it and its nearest live friend, and leaves a cat that goes home for a live one. The Cucumber still bursts into slices, and the small cats near where it lands run from that spot for its duration. Flying or startled cats lose an elite wind-up. New `swats()` and `socks()` accessors. `varieties.ts`: the laser-proof variety stays immune to the sock's sparks. `arena-art.ts`: `KIT_SVG`, SVG art for the ball, the pan, the sock, the cucumber and a startle mark. `arena-view.tsx` draws them: the spinning ball and cucumber, the pan swung at each swatted cat, the sock on its cat, "!" over a startled cat. Ceiling Fan and Alarm Clock and all evolutions and fusions keep their kinds. Tests: `kitchen-drawer.test.ts` gains 8 (each kind is unique, the ball comes back, a spent ball still returns and touches again, the swat flies and bowls ≤4 at half damage, the sock follows, sparks and falls off, the sock leaves a cat going home, the cucumber startles and still bursts, the four together fill the screen). `arsenal.test.ts`: the Scissors text names "spark"; the seeded 5-minute screen-full run moved from seed 3 to seed 4, its chooser counting a sock as one (D10). `survival.spec.ts`: the level-up card regex knows the "Cats drain" and "Cats leave" cards (D12).
- **What it brings.** A player who picks one of these four now gets something no other weapon does: a ball that comes back, a pan that bowls cats into each other, a sock that rides a cat, a cucumber that scatters the crowd. Before, they were the old weapons with new numbers. Decisions: D7–D12.
- **Verification.** prettier (8 files) ok; lint exit 0, 0 warnings (baseline 0); typegen + tsc exit 0. Selector: `vitest related` over 7 files (417 passed, final state), build exit 0, 13 e2e specs. The first gate run had 121 passed / 2 skipped. After the reviewer's fixes, the second run had 1 failure (D12: the regex, not the change), 120 passed. After the regex fix it passed 4 of 4 alone, and the final run of the 13 specs had 121 passed / 2 skipped. The evolution measure passed for all 17 evolutions; the "balance: positioning is the skill" tests passed unchanged. Acceptance: (a), (c), (d), (e) checked by command; (b) built, **not seen** (no test renders the art); (f) by D8.
- **For a human to look at (built, not seen).** In Survival with each of the four (e.g. `?seed=` and a level-up choice): the pan sprite swung 14 px out from him at each swatted cat, fading over 240 ms; the sock (22 px) on its cat, offset up and right; the "!" startle mark (18 px) over each running cat, many at once in a crowd; the spinning tennis ball and whole cucumber (at least 16 px); the cucumber's slices, still plain green dots. Also: evolving one of the four returns it to its old kind of behaviour (D8), which may feel like a loss.
- **Reviewer.** First pass: request changes. (1) Medium: the seed move; answered in D10/D11 with a fixed-build test. (2) Low: a sock could re-land on a cat going home; fixed, with a test. (3), (4) are notes for the report. Re-review: approve, with one caveat about the old baseline (D11).
- **CI of T1** (c690e7b): CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/38978021196.

## T3 — The results screen says what each weapon did (completed)

- Branch `2026-10-17-t3-weapon-results`, base ac2e365. Started 01:42, completed 01:58.
- **What the code does.** `arena.ts`: the simulation counts, for each weapon, the homesickness it gave (what the cat actually took) and the cats it sent home (each cat to the weapon that hurt it last). Every place a weapon hurts names it with `deal(id)`; between phases nothing is named, so nothing is miscounted. A weapon that is part of a fused one he holds counts for the fused one. New `weaponReport()`: every weapon held in the run (starting, chosen, evolved into, fused into), highest homesickness first. `arena-view.tsx`: the results show "What each weapon did", an ordered list named by its heading, one line per weapon ("Laser Pointer: 1,234 homesickness, 12 cats sent home"). Tests: `weapon-report.test.ts` (new, 50: a held, unfired weapon listed with 0; the counts add up to the homesickness on the cats, for every one of the 47 weapons and fusions; sent home counted once each, adding up to the run's total; a fusion lists both parents and the fused weapon, the parents frozen from the fusion on; a chosen weapon joins the list). `survival.spec.ts`: a seeded run's results list the Laser Pointer with non-zero homesickness, and the pickup test now takes level-ups while it waits (D17).
- **What it brings.** At the end of a run the player can see which weapons actually did the work, and so which are worth choosing, in a list a screen reader reads line by line. Decisions: D13–D17.
- **Verification.** prettier (4 files) ok; lint exit 0, 0 warnings; typegen + tsc exit 0. Selector: `vitest related` over 4 files (452 passed), build exit 0, 13 e2e specs. The first gate run had 122 passed, but the tree changed during it (the reviewer's fix, and a mutation check run by mistake during the gate), so it was not counted. In the rerun, 1 failed (D17: the pickup test, which never took a level-up) and 121 passed. After the fix it passed 5 of 5 alone, and the final run of the 13 specs had 122 passed / 2 skipped. The coverage test was checked able to fail: with one credit site removed, 25 of 50 failed. Acceptance: (a), (c), (d), (e) checked by command; (b), the screen-reader reading, checked by reading only (the markup: `ol` + `aria-labelledby`, whole sentences); the page was not seen.
- **Reviewer.** Approve; two Low. The `hurt` cost was fixed (D16), and the co-op credit nuance was left and proposed as Q5. Re-review: approve; D14's wording was corrected.
- **CI of T2** (ac2e365): CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/38982801164.

## T3 — CI failed; repair cycle 1 (repaired)

- CI on `Nightrun` at e87e678 (T3's tip): failure, https://github.com/lazurq-png/Xenocats/actions/runs/38984121581. Job "Lint, type check, unit tests", step "Every test file is in a group": `tests/unit/xenocats/weapon-report.test.ts` was in no unit-test group in `ci.yml`. The other three jobs (dev-server browser tests, production build + browser tests, already-tested) passed. The cause is the run's code, not CI's environment. Reproduced locally with the step's own loop: `weapon-report.test.ts` missing, and T4's still-uncommitted `character-bests.test.ts` too.
- T4 (in flight) was parked with `git stash push -u` on its own five paths; T3's branch was checked out.
- The obvious fix, listing the file in `ci.yml`, needs the workflow linters, and `actionlint`, `shellcheck` and `pyflakes` are not on `PATH` (Q6). So the 50 tests moved into `arena.test.ts` (in the games group) and `weapon-report.test.ts` was deleted (a file this run created). The selector then printed `FULL` (a deleted file), so the full suites ran.
- Full run 1: `npm test` 1008 passed / 34 skipped; database tests 34 passed; build exit 0; `next dev` suite **2 failed**, 151 passed: `invoices.spec.ts:41` ("an invoice is created and listed", a strict-mode error over 2 rows for one amount) and `survival.spec.ts:251` (Q7, out of time under load; 5/5 alone). The invoice test failed 2/10 alone, and **2/10 on `main` (a62b5e4)** too, so it predates this run. A probe showed one POST per creation and, a second later, one row, and the failure's page snapshot has one row in the accessible tree. The second `tr` is a hidden copy of the streamed table that the strict locator counts (the spec already noted "for a moment can be there twice").
- Full run 2 (both browser suites only): `next dev` 1 failed (the invoice test again), 152 passed; `next start` 153 passed.
- So the spec's `rowsFor` now matches visible rows only (`filter({ visible: true })`). Afterwards: the whole invoices spec ×8, 41 passed; the test ×20, 21 passed (with the setup).
- During this, a `git stash push` naming a deleted path failed. A later `git stash pop` then applied T4's parked changes onto T3's branch. They were parked again (the stash's file list checked: 5 files) and the deletion restaged; nothing was lost.
- Full run 3 on the final state (02:30): `npm test` 1008 passed / 34 skipped; database tests 34 passed; build exit 0; `next dev` suite 153 passed / 2 skipped; `next start` 153 passed / 2 skipped. prettier and lint (0 warnings) and tsc clean. The group check reproduced locally: exit 0. No reviewer pass: the repair moves tests unchanged and narrows one test locator, and touches no app code. Decisions for it (D21, D22) are written with T4, whose parked changes hold `decisions.md`.

## T4 — Each character's best for each run length, with the day it was set (completed)

- Branch `2026-10-17-t4-character-bests`, base e87e678 at its start; parked during T3's CI repair, and fast-forwarded to 6731373 before its commit. Started 01:58, completed 02:35 (the repair took 02:05–02:31 of it).
- **What the code does.** `arena-storage.ts`: a best per run length and character (`xenocats:survival:v1:character-best:<5|10|15|endless>:<character>`, `{ms, date}`), kept when a run is longer than the one kept (a tie keeps the older day); anything unreadable, an impossible day included, reads as none; blocked storage keeps nothing and throws nothing; `dayOf` (the player's local day) and `dayText` ("17 Oct 2026"). The overall bests and their keys are unchanged. `arena-view.tsx`: at a run's end each character who went out (both in co-op) is credited; the lobby shows, under the overall best, "Each character's best (<length>)", a list naming each character the player has, with "3:12, set 17 Oct 2026" or "none yet". Tests: `game-settings.test.tsx` gains 8 (keys, parsing, longer/shorter/tie, lengths apart, Endless, old bests kept, no time, blocked storage, the day). `survival.spec.ts`: a finished seeded run shows its time as the Keeper's best with the day, kept after a reload, and none at 10 minutes.
- **What it brings.** A player can see how far each character has got at each run length, and when, so trying a new character no longer hides behind the best of another; the bests kept from before still count as before. Decisions: D18–D20, D23.
- **Verification.** prettier (4 files) ok; lint exit 0, 0 warnings; typegen + tsc exit 0; CI's group check locally exit 0. Selector: `vitest related` over 4 files (153 passed), build exit 0, 13 e2e specs (123 passed / 2 skipped). The first gate (before the reviewer's fixes, and before the repair) had 103 / build / 123 passed. Acceptance: (a), (b), (d), (e) checked by command; (c) checked by command (the overall-best keys and reading unchanged, in a unit test); co-op credit of both characters by reading only; the lobby was not seen.
- **Reviewer.** Approve; two Low findings, both fixed (D23): the floored time, and the real-day check. No re-review: both are a line each, under unit tests.
- **CI of T3**: failed at e87e678 (repair cycle 1, above); after the repair, CI passed at 6731373, https://github.com/lazurq-png/Xenocats/actions/runs/38986741978. (d96d760, the deletion alone, was pushed too; its run was not polled.)

## T5 — The 2026-10-09 checkpoint 3 review's leftovers (completed)

- Branch `2026-10-17-t5-leftovers`, base 67cfa59. Started 02:36, completed 02:42.
- **What the code does.** `arena.ts`: a Mega Cat that loses its pounce's wind-up (held still, or any of T2's new ways) now rests the pounce's 6 s before the next, not an elite's 3.5 s. `arena.test.ts`: a test holds a winding Mega Cat still and checks its rest (it failed before the fix: 17,900 against 20,400); the Matriarch test now counts her wind-ups as well as calls, with a control run that does call, so it fails when the distance rule is removed (checked: 2 calls against 0). `survival.spec.ts`: the two reroll/skip tests are one (button reroll, a number past the choices, X to skip), with every assertion of both.
- **What it brings.** A Mega Cat stunned mid-pounce no longer comes back sooner than one that pounced. Two tests now guard what they claim to, and the suite plays one fewer seeded run to a level-up. Decisions: D24–D26.
- **Verification.** prettier (3 files) ok; lint exit 0, 0 warnings; typegen + tsc exit 0. Selector: `vitest related` (453 passed), build exit 0, 13 e2e specs (122 passed / 2 skipped). The merged e2e test 3 of 3 alone. Acceptance: all three checked by command (the mutation checks above for the two unit tests).
- **Reviewer.** Approve; one Low: D26 understated what the merge leaves untested (the R key, and the Skip button click). Corrected.
- **CI of T4** (67cfa59): CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/38987151281.

## T6 — The customers page can be sorted (completed)

- Branch `2026-10-17-t6-customer-sort`, base 3d92164. Started 02:42, completed 02:50.
- **What the code does.** `schemas.ts`: the sortable columns (name, total invoices, total pending, total paid) and the two directions, read from the URL with a fallback to name, ascending. `data.ts`: `fetchFilteredCustomers` takes a sort and direction, checks them again, and orders by a fixed SQL fragment for the column (never the URL's text), then by name and id. `sort-button.tsx` (new, client): the header's button, which sorts ascending first and turns round on a second press, keeping the search in the URL. `table.tsx`: the four headers are buttons, each `th` with `aria-sort`. `page.tsx`: passes `?sort=`/`?dir=` through. Tests: `data.test.ts` (each column both ways against the seed's own numbers; unknown, injection-looking and empty values sort by name; an unknown direction is ascending), `schemas.test.ts` (the parsers), `customers.spec.ts` (Total Paid twice: ascending, then descending, kept after a reload, with `aria-sort` and the URL).
- **What it brings.** Whoever keeps the books can see at once which customers owe the most, or have paid the most, and share or bookmark that view, since the sort is in the URL. Decisions: D27–D29.
- **Verification.** prettier (8 files) ok; lint exit 0, 0 warnings; typegen + tsc exit 0. Selector: `vitest related` (122 passed / 35 skipped), database tests (its `database:` line) 35 passed, 0 skipped; build exit 0; 26 e2e specs, 154 passed / 2 skipped. The new e2e test ran 17/17 (×4 with its spec) after it was made to check each read on its own (D29). Acceptance: all checked by command; the look of the headers is not seen.
- **Reviewer.** Approve, no defects; it noted the `next dev` rewrite of `AGENTS.md`, reverted by the gate as each time.
- **CI of T5** (3d92164): **CI failed**, https://github.com/lazurq-png/Xenocats/actions/runs/38987634906, job *Browser tests (dev server)* only (smoke, security headers, dashboard login). Not reproduced locally: the job's command passed 3/3 warm and 1/1 cold on T5's tree (T6 parked meanwhile). T5 does not reach those specs. Recorded, not repaired (Q8, as the 2026-10-09 run's D67); T6's run decides, and a repeat is repaired as a verification failure.

## Usage-limit gap

- 02:56 → 04:51: the account's usage limit. The checkpoint's range reviewer, cut off mid-review, was resumed from where it stopped. T6's CI poll had resolved meanwhile (below).

## Checkpoint 1 (after T1–T6, range a62b5e4..0838c39) (completed)

- Branch `2026-10-17-c1-checkpoint`, base 0838c39. Started 02:53, completed 05:05 (the gap above inside it).
- **Tests.** Every changed behaviour has a test that fails without it, apart from the recorded gaps: art and drawing (not seen), co-op crediting of both characters (T4), a Skip click (D26). Filled now: the R key's reroll (fusion test), a Cucumber check that could check nothing, the Possessed Cat's immunity to the sock (new, mutation-checked), and no Server Action from a hooked run (leaderboard e2e). No test of removed behaviour, no duplicate. Nothing deleted. D32.
- **Quality and security.** The reviewer on the range, security rules in scope: approve, five Low, four acted on (D31) and one known (Q5).
- **Speed.** Base against tip, side by side (D30): simulation +7% / +3% / +5% (500 / 2000 / 6000 cats), render −5% / −2% fps (500 / 2000 cats). All under 10%; nothing to chase.
- **Full suites.** prettier, lint (0 warnings), tsc clean; `npm test` 1020 passed / 35 skipped; database tests 35 passed; build exit 0; `next dev` 154 passed / 2 skipped; `next start` 154 passed / 2 skipped.
- **What it brings.** The first six tasks are checked as a whole: tested, reviewed for security, not slower beyond the plan's line. The gaps that remain are written down.
- **CI of T6** (0838c39): CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/38988415991. T5's dev-server failure (Q8) did not repeat there.

## E1 — started 05:05: the touch spec's flaky second summon (Q1) (kind: bugs)

## E1 — The touch spec's flaky second summon (Q1) (abandoned: not reproduced)

- Branch `2026-10-17-e1-touch-flake`, base 8a9348e, no commit. Started 05:06, ended 05:12.
- The baseline's one failure (`touch.spec.ts:48`, the second Summon's tap not registering during the knockback) did not come back: 15 of 15 runs at 4 workers, and 40 of 40 at 10 workers, a heavier load than the full suite's. A likely cause is that the tap lands while the 250 ms fling (`KNOCKBACK_FLIGHT_MS`) is still moving the card's buttons, since the test taps as soon as the first button has moved 20 px. But that is a guess the runs could not confirm, and §2.1 says to find the cause before fixing a flake. Left as it was; Q1 stays open, with the traces of a failing run (`trace.zip`) as what would settle it.

## E2 — started 05:07: all beams in one path, one stroke and one glow a frame (kind: speed on a weak machine)

## E2 — All beams in one path, one stroke and one glow a frame (abandoned: moved no number, reverted)

- Branch `2026-10-17-e2-beam-path`, base 8a9348e, no commit. Started 05:13, ended 05:16.
- Tried: the beams drawn as one path with a single `stroke()` (so one `shadowBlur` pass) instead of one path and stroke each. Render benchmark (×4 CPU, full graphics, two runs): 500 cats 44.5 / 44.4 fps (before, at the checkpoint: 44.5 / 43.9), 2000 cats 22.4 / 21.6 (before 21.1 / 22.2). That is within the run-to-run spread, so it was reverted, as the plan says: there are too few beams on screen at once for their glow to be the cost. The candidate list's other items (cat bitmaps at drawn size, one path per colour for gems and shots, the HUD's React updates) remain for the next speed turn.

## E3 — started 05:10: a cap on the customers and invoices one account can create (kind: security and quality)

## E3 — A cap on the customers and invoices one account can create (completed)

- Branch `2026-10-17-e3-account-caps`, base 8a9348e. Started 05:16, completed 05:19 (the gate's reruns included).
- **What the code does.** `actions.ts`: `createCustomer` inserts only while the account holds fewer than 1,000 customers, and `createInvoice` only while it holds fewer than 10,000 invoices, each checked inside the `INSERT`. When an invoice insert matches nothing, a second query says whether the account is full (a message naming the cap) or the customer is not the user's (as before). `schemas.ts`: the two caps (`MAX_CUSTOMERS_PER_ACCOUNT`, `MAX_INVOICES_PER_ACCOUNT`). `create-form.tsx`: a live region for a message that blames no field, so the cap, or a database error, is shown at last. Tests: `actions.test.ts` (both refusals, and the parameters the insert gets; two existing tests updated for the new statement), `forms.test.tsx` (the form at the cap shows the message in a live region).
- **What it brings.** One signed-in account can no longer fill the database through the dashboard's Server Actions, and the account's own pages stay usable: the invoice form's customer list and the "export all" stay within what they can show. Decisions: D33, D34.
- **Verification.** prettier (5 files) ok; lint exit 0, 0 warnings; typegen + tsc exit 0. Selector: `vitest related` (125 passed / 35 skipped), build exit 0, 26 e2e specs (154 passed / 2 skipped; the customer and invoice creating specs run the new SQL). Acceptance (D33): both caps and their messages checked by command (unit, jsdom); the SQL against a real database only through the browser tests' creates under the cap. The cap itself is never reached against a database.
- **Reviewer.** Request changes, one Low: the form never showed the message. Fixed (D34). Re-review: approve.
- **CI of checkpoint 1** (8a9348e): CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/38997431684.

## E4 — started 05:20: the fusion pause-menu test without a wall-clock deadline (Q7) (kind: bugs)

## E4 — The fusion pause-menu test without its long wait (Q7) (completed)

- Branch `2026-10-17-e4-fusion-deadline`, base 93be7a5. Started 05:20, completed 05:30.
- **What the code does.** `survival.spec.ts`: "the pause menu marks a fused weapon and a new one with different tiers" plays its seeded run at speed 12 instead of 4, with the reason in its comment. Nothing else changes.
- **What it brings.** A test that took 38–96 s and ran out of its 120 s under a loaded full suite (T3's repair) now takes about 4 s, so it no longer fails for the machine's speed, and every browser run is a minute or so shorter. Decisions: D35.
- **Verification.** prettier ok; lint exit 0, 0 warnings; typegen + tsc exit 0. Selector: `vitest related` (no unit test reaches a spec; exit 0), build exit 0, `survival.spec.ts` (37 passed). The test 20/20 at 10 workers. No reviewer: one test parameter (D35).
- **CI of E3** (93be7a5): CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/38998356771.

## E5 — started 05:32: the arena state read only when the HUD updates, not every frame (kind: speed on a weak machine)

## E5 — The arena state read only when the HUD updates (abandoned: moved no number, reverted)

- Branch `2026-10-17-e5-state-per-hud`, base 0afca64, no commit. Started 05:32, ended 05:36.
- Tried: skipping the HUD's `arena.state()` (which maps the heroes and weapons and scans every cat for the boss bar) on frames where the HUD does not update. The HUD was already limited to about 7 updates a second, which answers the plan's candidate. The render benchmark looked better at first (46.8 / 45.7 fps at 500 cats and 23.6 / 22.6 at 2000, against 43.9–44.5 and 21.1–22.4 earlier tonight). Measured interleaved (without the change, then with it), the two were identical: 46.0 / 46.0 and 21.9 / 21.8. The earlier difference was the machine. Reverted. `draw` builds its own `state()` each frame too, so the cost saved was only ever one of two.
- Lesson kept for the rest of the run: compare speed only interleaved, before and after in turn, never against figures from earlier in the night.

## E6 — started 05:36: the invoice edit form shows why a save failed (kind: security and quality)

## E6 — The invoice edit form shows why a save failed (completed)

- Branch `2026-10-17-e6-edit-form-message`, base 0afca64. Started 05:36, completed 05:40.
- **What the code does.** `edit-form.tsx`: a live region for a message that comes with no field error (signed out, not an invoice, the invoice gone meanwhile, a database error), and a `customer-error` region beside the customer select, named by its `aria-describedby`, for a customer the action refuses. `forms.test.tsx`: two jsdom tests through the real action, the invoice gone ("No such invoice." in a live region) and its customer no longer the user's ("That customer does not exist." beside the field).
- **What it brings.** Saving an invoice that cannot be saved no longer does nothing: the user is told why, and a screen reader says so. Decisions: D36.
- **Verification.** prettier ok; lint exit 0, 0 warnings; typegen + tsc exit 0. Selector: `vitest related` (`forms.test.tsx` 7 passed), build exit 0, 11 e2e specs (35 passed). The first new test fails without the region (checked). The look of the messages is not seen.
- **Reviewer.** Approve, one Low: a refused customer was still silent. Fixed, with the second test (D36).
- **CI of E4** (0afca64): CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/38999120604.

## Checkpoint 2 (after E1–E6, range 8a9348e..bb93a87) (completed)

- Branch `2026-10-17-c2-checkpoint`, base bb93a87. Started 05:41, completed 05:54. One item late: due after E5, run after E6 (D37).
- **Tests.** Every changed behaviour in the range has a test that fails without it (the reviewer's reading, and the run's own checks in D33–D36). The exception: the caps' SQL is never reached against a database at the cap. No test of removed behaviour, no duplicate. One test was a time bomb (below), fixed. A scan of the other tests for fixed dates found no other.
- **Quality and security.** The reviewer on the range, security rules in scope: request changes, one Medium. E3's cap test used a fixed due date and would have failed from 2026-11-09. Fixed and checked with the clock moved to 2026-12-01 (D37). Nothing else.
- **Speed.** No Survival code in the range. Simulation and render match checkpoint 1 (D37); nothing to chase.
- **Full suites.** prettier, lint (0 warnings), tsc clean; `npm test` 1025 passed / 35 skipped; database tests 35 passed; build exit 0; `next dev` 154 passed / 2 skipped; `next start` 154 passed / 2 skipped.
- **What it brings.** The exploration so far is checked as a whole, and a test that would have broken every build in three weeks no longer will.
- **CI of E6** (bb93a87): CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/38999705681.

## E7 — started 05:56: cat sprites rasterised at the size they are drawn (kind: speed on a weak machine)

## E7 — Cat sprites rasterised at the size they are drawn (abandoned: moved no number, reverted)

- Branch `2026-10-17-e7-sprite-size`, base 3ebff87, no commit. Started 05:58, ended 06:00.
- Before it, the turn's "bugs" reading (`cat-engine.ts`'s phases and combos, the arena view's frame loop and hidden-tab handling, every event listener's removal) found nothing to change, so it made no item.
- Tried: the xenocat and variety bitmaps made at their drawn size times the screen's pixel ratio (1 or 2), instead of 88 px and 128 px scaled down on every draw. Measured interleaved, two pairs (×4 CPU, full graphics, pixel ratio 1, where the downscale was): 500 cats 46.9 / 46.5 fps before against 46.7 / 46.3 after; 2000 cats 21.9 / 22.4 against 22.1 / 21.8. No change, so it was reverted. The browser's scaled `drawImage` is evidently not what limits this benchmark. Of the plan's candidates, only "one path and fill per colour for gems and shots" is left untried.

## E8 — started 06:01: a leaderboard name cannot stack accents into a tower (kind: security and quality)

## E8 — A leaderboard name cannot stack accents into a tower (completed)

- Branch `2026-10-17-e8-name-marks`, base 3ebff87. Started 06:01, completed 06:13.
- **What the code does.** `schemas.ts` (`LeaderboardName`, used by the leaderboard Server Action and its form): a combining mark must follow a letter, digit or mark ("An accent must be on a letter."), and four or more marks that sit on one spot (non-spacing Mn, or enclosing Me) in a row are refused ("A letter can carry at most three accents."). Spacing marks are not counted. `input-safeguards.test.ts`: real names that pass (Vietnamese, a decomposed ë, two marks NFC reorders, Devanagari, and four Burmese ones with four or five marks), and towers and stray marks refused, each with its message. The marks are written as code points.
- **What it brings.** Nobody can deface the public leaderboard with a name that draws over the other rows, while names in Burmese, Devanagari, Thai and the other scripts checked still go on it. Decisions: D38.
- **Verification.** prettier ok; lint exit 0, 0 warnings; typegen + tsc exit 0. Selector: `vitest related` (128 passed / 35 skipped), build exit 0, 26 e2e specs (154 passed / 2 skipped). The tower test fails under the old rule (it passes 19 marks). The board's look with a long accented name is not seen.
- **Reviewer.** Request changes: one Medium (four-mark Burmese names were refused; now only Mn and Me are counted) and one Low (the stray-mark message); both fixed. Re-review: approve, one Low (enclosing marks), fixed.

## E9 — started 06:16: gems and shots drawn as one path and one fill per colour (kind: speed on a weak machine)

## E9 — Gems and shots drawn as one path and one fill per colour (abandoned: slower, reverted)

- Branch `2026-10-17-e9-batched-fills`, base 5647901, no commit. Started 06:15, ended 06:20.
- Before it, the turn's "bugs" work found nothing to change: two shuffled-order unit runs (`--sequence.shuffle`, seeds 8581 and 6954) passed in full, and a reading of the elite attacks found nothing.
- Tried (the plan's candidate "one path and fill per colour for gems and shots"): each colour's gems and plain shots gathered into one `Path2D` and filled once. Measured interleaved, two pairs (×4 CPU, full graphics): 500 cats 45.5 / 45.6 fps before against 39.5 / 38.7 after (−14%), and frames over 50 ms 31 / 30 against 47 / 58; 2000 cats 22.4 / 22.6 against 19.9 / 19.6. Slower, so it was reverted. One fill of a path with hundreds of subpaths costs this canvas more than hundreds of small fills. That is worth knowing before anyone tries the same with other layers.
- With this, every speed candidate the plan named has been tried (E2, E5, E7, E9). None moved the render benchmark, one made it worse. The benchmark's cost lies elsewhere, most likely in the cats' `drawImage`s themselves and the glow passes; measuring where (a profile of one frame) is proposed in Q9 rather than guessed at.

## E10 — started 06:30: the HUD updated four times a second, not seven (kind: speed on a weak machine)

## E10 — The HUD updated four times a second, not seven (completed)

- Branch `2026-10-17-e10-hud-rate`, base 5647901. Started 06:20, completed 06:34.
- **What the code does.** `arena-view.tsx`: during a run the HUD's React state is updated every 250 ms (`HUD_EVERY_MS`) instead of every 150, at once still at a run's end or a waiting level-up. `survival.spec.ts`: `settled()` reads twice 600 ms apart, so a HUD update always falls between. Before the change, temporary timing of one crowded frame's draw passes and steps (reverted, not committed) found that the draw is a tenth of the frame, and that React's re-render at each HUD update is a large part of the rest (Q9).
- **What it brings.** Survival runs about 9% faster in frames a second on a slow machine (the ×4-CPU benchmark at 500 and 2000 cats), with fewer stalled frames, at the cost of a clock and Resolve bar that change four times a second, not seven. It also shows where the next, bigger gain is (Q9). Decisions: D39.
- **Verification.** prettier ok; lint exit 0, 0 warnings; typegen + tsc exit 0. Selector: `vitest related` (no unit test reaches the view; exit 0), build exit 0, 13 e2e specs (122 passed / 2 skipped); after the `settled()` fix, `survival.spec.ts` 37 passed. Speed measured interleaved, two pairs (D39). The HUD's look at four updates a second is not seen.
- **Reviewer.** Approve, one Low (`settled()`), fixed.
- **CI of E8** (5647901): CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/39001766508.

## Checkpoint 3 (after E7–E10, range 3ebff87..4d96904) (completed)

- Branch `2026-10-17-c3-checkpoint`, base 4d96904. Started 06:35, completed 06:42.
- **Tests.** Every changed behaviour in the range has a test that fails without it (the reviewer's reading, checked case by case), except E10's update rate, which no test pins: a test would only lock in a tuning number. One case could not fail (the precomposed "Nguyễn"); it is now typed decomposed. No test of removed behaviour, no duplicate.
- **Quality and security.** The reviewer on the range, security rules in scope: approve, two Low, both handled (D40). E10's entry has the wrong start time: the item started at 06:30, after ten minutes of profiling from 06:20 that the entry counts in.
- **Speed.** Simulation unchanged; the render gain in the range is E10's (+9%, D39).
- **Full suites.** prettier, lint (0 warnings), tsc clean; `npm test` 1026 passed / 35 skipped; database tests 35 passed; build exit 0; `next dev` 154 passed / 2 skipped; `next start` 154 passed / 2 skipped.
- **What it brings.** E8 and E10 are checked together, and the one test that proved nothing now does.
- **CI of E10** (4d96904): CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/39003051008.

## E11 — started 06:43: the HUD rendered on its own, not by the whole arena view (kind: speed on a weak machine)

## E11 — The HUD rendered on its own, not by the whole arena view (completed)

- Branch `2026-10-17-e11-hud-alone`, base d098a91. Started 06:44, completed 07:07.
- **What the code does.** `survival-hud.tsx` (new): the HUD's type, a small store (`createHudStore`), the play area's `data-` attributes (`hudData`, the same 24 names and defaults), and the Mega Cat's bar and the top bar (`BossBar`, `HudBar`, the same markup, ARIA and Pause button) following the store with `useSyncExternalStore`. `arena-view.tsx`: the frame loop writes the store where it set React state; a layout effect writes the `data-` attributes onto the play area at once and at each update; the HUD is updated every 150 ms again (`HUD_EVERY_MS`). `survival.spec.ts`: `settled()`'s comment. `game-settings.test.tsx`: three tests (the store, the attribute list and defaults, and the bar following the store while its parent renders once).
- **What it brings.** A HUD update no longer re-renders the whole arena view. Survival runs about 7–8% faster on a slow machine than after E10, and 17–20% faster than at the evening's start, with the clock and bars as smooth as before. Decisions: D41.
- **Verification.** prettier ok; lint exit 0, 0 warnings; typegen + tsc exit 0. Selector: `vitest related` (16 passed; 16 again after the reviewer's list check), build exit 0, 13 e2e specs (122 passed / 2 skipped). Before them, `survival.spec.ts` with `leaderboard.spec.ts` 41 passed. Speed measured interleaved, two rounds of three (D41). The HUD's look is not seen.
- **Reviewer.** Approve, two Low: the tests' file (by D21) and the attribute list (now checked in full).
- **CI of checkpoint 3** (d098a91): CI passed, https://github.com/lazurq-png/Xenocats/actions/runs/39003584874.
