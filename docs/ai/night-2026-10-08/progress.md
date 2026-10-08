# Progress — night run 2026-10-08

Append-only. One entry per task, appended when it ends; the morning report is inserted at the top.

## Run start

- Goal: "Friday 07:00" → **Deadline: 2026-10-09 07:00** (Europe/Stockholm; machine time zone `W. Europe Standard Time`).
- Clock at start: 2026-10-08 14:24. Budget at start: 14,971,497 tokens (reserve 10% ≈ 1.5M with a session to follow; 30% ≈ 4.5M when final).
- Run branch `night-2026-10-08`, cut from `main` at `ae34cbc`. Remote `origin` reachable; no `night-2026-10-08*` branch there. Tree clean at preflight (no pre-existing changes).
- Environment: node v24.19.0, npm 11.17.0, `node_modules` and Chromium present, `.env` present.
- Timer: the human's `/loop 20m` job `ffa0ab35` (every 20 minutes) is the run's timer; no other armed.
- Limits (from the plan): information only. The run cannot see the account's usage limit; if it runs out, the session pauses until the timer's next firing after it resets, and the per-task commit and push bound the loss.

### Baseline (§1.5), 14:25–14:35

All green, run one after another on `ae34cbc`:

- `npm run lint`: exit 0, **0 warnings** (`lint-baseline.txt`), 95 s.
- `next typegen && tsc --noEmit`: exit 0, 42 s.
- `npm test`: exit 0; 44 files passed, 1 skipped; 664 tests passed, 17 skipped (the opt-in database tests); 57 s.
- `DATABASE_TESTS=1 npx vitest run tests/unit/data`: exit 0; 17 passed, none skipped; 29 s.
- `npm run build`: exit 0, 50 s. The build is in the gate.
- `npm run test:e2e` (next dev): exit 0, 131 passed, 3.2 min.
- `E2E_SERVER=start npm run test:e2e`: exit 0, 131 passed, 2.1 min.
- `next-env.d.ts` and `AGENTS.md` unchanged after the checks.

## T1 — Taming is removed; `/cats` has one Play button (completed)

- Branch `night-2026-10-08-t1-remove-taming`, base `ae34cbc`. Start 14:35 (budget ~14,967,000); completed 14:50 (budget ~14,902,000).
- **What the code does**
  - `/cats` (`cat-gallery.tsx`): the "Fight a cat" section describes Survival only and holds one link, **Play**, to `/cats/survival`. The field guide counts met and survived per cat; the "Tamed" count is gone (`field-guide.ts`).
  - Removed: `/cats/taming` (now the site's 404 page), `fight.tsx`, `taming.ts`, `player-sprite.tsx`, `locked-pointer.ts`, their unit tests and `tests/e2e/fight.spec.ts`; Taming-only helpers in `walking.ts` and dead ranger/beam CSS in `global.css`. `fight-page.tsx` renders Survival only.
  - CI (`ci.yml`): test groups no longer name the removed files; the browser steps are named "(Survival)". `README.md` drops the `/cats/taming` route.
  - Tests: `survival.spec.ts` checks the single Play link opens Survival and `/cats/taming` answers 404; `field-guide.spec.ts` checks an old Taming collection is not shown; the unit tests follow the smaller field guide and `walking.ts`.
- **What it brings**: one game instead of two, so `/cats` points straight at Survival and about 1,700 lines of a game nobody was to play again stop costing test and review time. Decisions: D1–D4.
- **Verification** (the selector printed FULL for the deleted page, so every suite ran)
  - prettier on the 13 changed files (staged LF content; the working tree is CRLF via `core.autocrlf`): clean after formatting two test files.
  - `npm run lint` exit 0, 0 warnings (= baseline). `next typegen && tsc --noEmit` exit 0, after deleting `.next/dev/types`, stale route types this run's own baseline `next dev` wrote while `/cats/taming` existed.
  - `actionlint` (with shellcheck and pyflakes) exit 0; CI's "every test file is in a group" loop, run locally: no file missing.
  - `npm test`: first run 1 failed (`affected-tests.test.ts` named the deleted spec), fixed; then 42 files passed, 1 skipped; 639 passed, 17 skipped.
  - `DATABASE_TESTS=1 npx vitest run tests/unit/data`: 17 passed. `npm run build` exit 0.
  - `npm run test:e2e` (next dev): 127 passed. `E2E_SERVER=start npm run test:e2e`: 127 passed.
  - Acceptance criteria (D3): all checked by command (the browser tests above), except "describes Survival only", checked by reading.
- **Reviewer**: request changes, one Medium finding (the same selector test), fixed as recommended (D4). **Tested in a browser, not seen**: a human should look at `/cats`'s Fight a cat section and a field-guide card with two counts.

## T2 — Every upgrade does what it says, every time it is taken (completed)

- Branch `night-2026-10-08-t2-upgrades-say-what-they-do`, base `6ea1b52`. Start 14:51 (budget ~14,899,000); completed 15:06 (budget ~14,834,000).
- **CI of T1** (`6ea1b52`): **CI passed** on both branches ([run branch](https://github.com/lazurq-png/Xenocats/actions/runs/37779817805), [task branch](https://github.com/lazurq-png/Xenocats/actions/runs/37779813384)).
- **What the code does**
  - `arsenal.ts`: each of the nine base weapons climbs an explicit ladder (level 1, then seven steps), every step something the player notices; level 8 is exactly the old level 8. Scissors adds one more of what weapons fire per pick (was `floor(level / 2)`). `levelChanges` and `passiveChanges` say what a level adds, read from the stats; `describeChoice` returns it as `change`.
  - `arena-view.tsx`: the level-up card shows that change on a line of its own (e.g. "+1 beam.", "Fires 20% sooner.", "+10% walking speed.").
  - Tests: `arsenal.test.ts` holds every weapon level to naming each stat it changes and nothing else, to a noticeable change, and every passive to an equal step; `survival.spec.ts` checks the cards of a real level-up name their change.
- **What it brings**: every level-up now visibly improves something and the card says exactly what, so a player choosing Scissors or a weapon level gets what they picked instead of an invisible half-step. Decisions: D5–D11.
- **Verification**
  - prettier (staged content) clean; `npm run lint` exit 0, 0 warnings (= baseline); `next typegen && tsc --noEmit` exit 0 (after clearing `.next/dev/types`, D11).
  - Selector: unit `vitest related` over 4 files: 5 files, 158 passed. e2e: 11 specs, 93 passed (next dev), before and after the review fixes. The two level-up tests also passed 3 of 3 each (`--repeat-each 3`).
  - `npm run build` exit 0 (after clearing `.next/dev/types`; the first attempt failed on a half-written `validator.ts`, D11).
  - The balance test and every arena, co-op, progression and variety test pass unchanged (82).
  - Acceptance criteria: all checked by command.
- **Reviewer**: approve with three Low findings; two fixed (Scissors' card wording, the e2e check counting what it checked), one recorded (D10).

## T3 — Sound settings in the lobby and the pause menu (completed)

- Branch `night-2026-10-08-t3-sound-settings`, base `12191a6`. Start 15:06 (budget ~14,832,000); completed 15:14 (budget ~14,809,000).
- **CI of T2** (`12191a6`): **CI passed** on both branches ([run branch](https://github.com/lazurq-png/Xenocats/actions/runs/37781697981), [task branch](https://github.com/lazurq-png/Xenocats/actions/runs/37781694245)).
- **What the code does**
  - `game-settings.tsx` (new): a "Settings" fieldset with a Sound checkbox bound to the site's sound setting (`sounds.ts`); switching it on also unlocks audio inside that click or tap.
  - `arena-view.tsx`: the settings appear in Survival's lobby (desktop and touch) and in its pause menu.
  - `survival.spec.ts`: on desktop (keyboard) and touch (tap), sound switched off in the pause menu holds after Resume, shows in the lobby, and (desktop) is switched back from the lobby and kept after a reload.
- **What it brings**: a player can silence the game, or bring the sound back, without leaving it, on a phone too, where the dashboard's speaker button is nowhere in reach. Decisions: D12–D15.
- **Verification**
  - prettier (staged content) clean; `npm run lint` exit 0, 0 warnings (= baseline); `tsc --noEmit` exit 0 (`.next/dev/types` cleared, D11).
  - Selector: no unit test relates to the three files ("No test files found", exit 0); e2e: 11 specs, 95 passed on next dev, before and after the review fix. The two new tests also passed 2 of 2 each.
  - `npm run build` exit 0.
  - Acceptance criteria (D14): all by command, except that switching off silences the game at once and switching on in a run can be heard: by reading (`play()` asks `getSoundEnabled` before every sound; D15).
- **Reviewer**: approve, one Low finding fixed (D15). **Tested in a browser, not seen**: a human should look at the Settings in the lobby and the pause menu at phone width.
