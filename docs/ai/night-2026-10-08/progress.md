# Progress — night run 2026-10-08

Append-only. One entry per task, appended when it ends; the morning report is inserted at the top.

## Morning report

### Goal

- Plan's goal: "Friday 07:00" → **Deadline: 2026-10-09 07:00**. Report started 2026-10-09 10:26.
- **What ended the run: the goal time.** The goal had passed when the run resumed. The account's usage limit stopped session 1 on 2026-10-08 at about 18:24, two minutes into T11. Its `/loop` timer did not resume it after the limit reset (20:20). The PC was in connected standby all night, and the session's process was not running to fire it (see Clock). The run sat idle until a human started session 2 at 09:12. So under §8.4 the task in flight, T11, was finished. Task 12, checkpoint 2 and the exploration the plan scheduled were never started.
- The plan named exploration kinds (the Survival game, bugs); none ran.

### Index

| Task | Outcome | Branch | Base → tip | CI | What it brings |
| ---- | ------- | ------ | ---------- | -- | -------------- |
| T1 | completed | `night-2026-10-08-t1-remove-taming` | `ae34cbc` → `6ea1b52` | CI passed | One game instead of two: `/cats` points straight at Survival, and about 1,700 lines of Taming are gone. |
| T2 | completed | `night-2026-10-08-t2-upgrades-say-what-they-do` | `6ea1b52` → `12191a6` | CI passed | Every level-up visibly improves something, and its card says exactly what. |
| T3 | completed | `night-2026-10-08-t3-sound-settings` | `12191a6` → `2549bd6` | CI passed | Sound on or off from the game's lobby and pause menu, phones included. |
| T4 | completed | `night-2026-10-08-t4-crosshair` | `2549bd6` → `bd2d94a` | CI passed | A desktop player can aim the weapons with a crosshair. |
| T5 | completed | `night-2026-10-08-t5-pause-stats` | `bd2d94a` → `d88d6df` | CI passed | The pause menu shows weapons, passives, free slots, evolutions within reach and the run so far. |
| Checkpoint 1 | completed | `night-2026-10-08-c1-checkpoint` | `d88d6df` → `c42d98e` | CI passed | T1–T5 reviewed together; the new settings are tested below the browser. |
| T6 | completed | `night-2026-10-08-t6-artwork-cats-special` | `c42d98e` → `4335656` | CI passed | The twenty artwork cats are rare visits, elites and boss faces, not crowd fodder. |
| T7 | completed | `night-2026-10-08-t7-phone-zoom` | `4335656` → `3d18903` | CI passed | On a phone, cats are seen coming about as far off as on a laptop; desktop unchanged. |
| T8 | completed | `night-2026-10-08-t8-touch-pet` | `3d18903` → `7c6b3a5` | CI passed | A held finger pets a sleeping cat on a touch screen; a tap still wakes it. |
| T9 | completed | `night-2026-10-08-t9-artwork-colours` | `7c6b3a5` → `2cf047e` | CI passed | Three cats look like the same cat awake and asleep. |
| T10 | completed | `night-2026-10-08-t10-landing-header` | `2cf047e` → `3973479` | CI passed | The landing page offers "Log in" and "Meet the cats" once each, in the hero. |
| T11 | completed | `night-2026-10-08-t11-own-data` | `3973479` → `38a92d2` | CI failed, fixed in 1 cycle (*e2e*: Browser tests (invoices), D58); then CI passed ([run branch](https://github.com/lazurq-png/Xenocats/actions/runs/37904152559), [task branch](https://github.com/lazurq-png/Xenocats/actions/runs/37904147806)) | Each account sees and changes only its own customers and invoices, even by guessed ids or direct action calls. |
| T12 | not started: the goal time had passed when the run resumed (Q4) | — | — | — | — |
| Checkpoint 2 | not started: the goal time had passed | — | — | — | — |

A task's code: `git diff <base> <tip> -- . ':(exclude)docs/ai/'`. Each task's entry below has what it does, its verification, its reviewer's verdict and its CI run URLs.

### Questions (most consequential first)

- **Q3. The development database needs `npm run db:migrate` before its dashboard works again.** T11's queries need `customers.owner_id`, which `xenocats` does not have yet. With one user there, the migration gives them every customer. With several, it stops, changing nothing, and its comment says how to assign owners. Every existing login is signed out once.
- **Q6. Keep the PC awake during a night run.** It was in connected standby all night, so the timer that should have resumed the run after the usage limit never fired. Setting a human must make before the next run.
- **Q4.** Task 12 (sign-up) was not started; put it in the next plan as written. Its prerequisite, T11, is merged.
- **Q5.** `login-limit.spec.ts` "a successful login starts the count again" fails about 1 run in 4 against `next start`. Shown on the base commit without T11, so it is older than tonight. The cause is in the test (a cookie revived after `clearCookies()`), and so is the proposed fix.
- **Q1.** How much of the arena a phone shows, and how small the Keeper may be (T7): look at it on a phone. It is one constant.
- **Q2.** Petting a sleeping cat with a held finger on a real iPhone and Android phone (T8): iOS's long-press gestures may cancel it.
- Plus one flake under load, recorded but not a question: Survival's "a level-up stops the run for a choice…" failed once in T11's first `next start` run, then passed 5 of 5 alone.

### Clock and budget

- Session 1: started 2026-10-08 14:24 with 14,971,497 tokens. Stopped by the usage limit at about 18:24 with about 14,425,000 left (T1–T10 and checkpoint 1 done, T11 begun).
- **Gap: 2026-10-08 ~18:24 → 2026-10-09 09:12**, about 14 h 50 min; about 12 h 35 min of it before the goal. Session 1's timer never fired in it. What the record shows:
  - Session 1's transcript: the limit at 18:24:43; a CI notification at 18:30:00 that met the limit again; then nothing until 09:03:39, when it was resumed with a notice that its previous process had ended.
  - Windows' system log: the PC in connected standby from 14:24:39 ("Idle Timeout") to 08:50:39 ("Input Mouse"). No shutdown or restart, and no crash in the application log.
  - VS Code: a new launch at 09:02:01.

  So the process holding the `/loop` timer was not running to fire it after 20:20: suspended in standby, then gone by morning. The record does not show which, or when it ended. Session-only timers cannot outlive their process. Session 1's restored `/loop` fired at 09:29:59, after the resume, and it stood down.
- Session 2: started 2026-10-09 09:12 with 14,909,198 tokens; 14,699,175 at the report's start. The run's last task (T11, with its CI repair) completed at 10:18, 3 h 18 min past the deadline: all of it resumption after the gap, none of it a task overrunning.

### State

- Run branch `night-2026-10-08` at `38a92d2` (before this report's commit). It and all twelve task and checkpoint branches are on `origin`. Nothing provisional, nothing abandoned. Nothing uncommitted.
- The build was in the gate for every task. Lint warnings: 0, as at the baseline.
- Timer `760fdd62` is deleted once this report is pushed.

### What nothing has checked

- **Nobody looked at a page.** Each UI task was tested in a browser, not seen. The entries name what a human should look at: `/cats`'s Play section (T1), the level-up cards (T2), the game's settings, crosshair and pause menu (T3–T5), artwork cats in a run (T6), the game on a phone (T7, Q1), petting on a real phone (T8, Q2), the three recoloured cat images (T9, built, not seen), the landing header (T10), and a second account's empty dashboard (T11).
- Acceptance criteria covered by reading only are listed in each task's decisions. For T11, that is that no other code path touches customers or invoices (`grep`).
- No change was exercised against a production database (there is none). Migration 0005 was proved on the test schemas, on a scratch schema with existing rows, and in CI's fresh database. It has **not** been applied to `xenocats` (Q3).

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

## T4 — Aim with a crosshair (desktop option) (completed)

- Branch `night-2026-10-08-t4-crosshair`, base `2549bd6`. Start 15:15 (budget ~14,807,000); completed 15:39 (budget ~14,733,000).
- **CI of T3** (`2549bd6`): **CI passed** on both branches ([run branch](https://github.com/lazurq-png/Xenocats/actions/runs/37782783189), [task branch](https://github.com/lazurq-png/Xenocats/actions/runs/37782778649)).
- **What the code does**
  - `arena.ts`: `aimAt(point | null)` gives player 1 an aim point; aimed, the beams, treats, hairballs, spray and yarn go towards it (cat or no cat), the chain's first jump and the web take the reachable cats nearest it. The vacuums and the circling blades are untouched; with no aim point everything is as before.
  - `arena-view.tsx`: with the crosshair chosen (desktop only), the mouse's screen position becomes an arena point under the camera each frame, a crosshair is drawn there and the cursor is hidden over the play area; reset at each run's start.
  - `game-settings.tsx`, `arena-storage.ts`: "Aim: Automatic / Crosshair" in the lobby's and the pause menu's Settings on a computer, stored as `xenocats:survival:v1:aim`, automatic by default.
  - Tests: unit tests per aiming weapon kind (shots within their fan of the crosshair; chain and web stay in reach and take the cats nearest it), the five non-aiming weapons unchanged, and the crosshair put away; e2e: the choice on desktop and not on touch, the crosshair following the mouse, switched off in the pause menu, kept after a reload.
- **What it brings**: a desktop player can choose where the Keeper's weapons fire instead of leaving it to the nearest cat, so aiming becomes a skill alongside positioning. Decisions: D16–D20.
- **Verification**
  - prettier (staged content) clean; `npm run lint` exit 0, 0 warnings; `tsc --noEmit` exit 0 (`.next/dev/types` cleared).
  - `vitest related` over 6 files: 5 files, 168 passed. e2e: 11 specs, 97 passed (next dev), before and after the review fixes; the two new tests 2 of 2 each.
  - `npm run build` exit 0.
  - Acceptance criteria (D19): all by command except how the crosshair looks (reading only).
- **Reviewer**: request changes (one Medium, two Low), all fixed; re-review approve (D20). **Tested in a browser, not seen**: a human should look at the crosshair and the Aim choice.

## T5 — The pause menu shows the run so far (completed)

- Branch `night-2026-10-08-t5-pause-stats`, base `bd2d94a`. Start 15:38 (budget ~14,728,000); completed 15:56 (budget ~14,680,000). (T4's entry gives its completion as 15:39; the clock read 15:37.)
- **CI of T4** (`bd2d94a`): **CI passed** on both branches ([run branch](https://github.com/lazurq-png/Xenocats/actions/runs/37785833828), [task branch](https://github.com/lazurq-png/Xenocats/actions/runs/37785828899)).
- **What the code does**
  - `arsenal.ts`: `loadout(weapons, passives)` and `passiveTotal`: each weapon at its level of its highest (evolved marked) and what its next level adds, each passive and what it gives in all, the free slots, and the evolutions within reach with what is missing, which one the next chest he opens evolves, and none that can no longer come. The secret evolution is never named.
  - `pause-summary.tsx` (new), `arena-view.tsx`: the pause menu shows the run (time, level and experience, Resolve, cats sent home) and, per Keeper, weapons, passives and evolutions; read from a snapshot taken when the run pauses; the panel scrolls inside itself on a small screen; Resume stays focused.
  - Tests: unit tests of the loadout (levels, slots, next level in the cards' words, passives' totals, evolution hints against `evolutionFor`, out-of-reach and secret ones, a seeded run after three level-ups); e2e on desktop and touch, each after a level-up, checking the choice taken is listed at its level and the slot counts agree.
- **What it brings**: a player can stop and see what they are carrying, what each next level would add, how many slots are left and how close an evolution is, so their next choices are informed instead of remembered. Decisions: D21–D26.
- **Verification**
  - prettier (staged content) clean; `npm run lint` exit 0, 0 warnings; `tsc --noEmit` exit 0.
  - `vitest related` over 5 files: 5 files, 176 passed; after the re-review's test change, `arsenal.test.ts` 94 passed. e2e: 11 specs, 99 passed (next dev) before and after the review fixes; the two new tests 2 of 2 each.
  - `npm run build` exit 0.
  - Acceptance criteria (D24, D25): by command except co-op's two sections and how the menu looks (reading only).
- **Reviewer**: request changes (one Medium, four Low), all fixed; re-review approve with one Low, fixed (D25, D26). **Tested in a browser, not seen**: a human should look at the pause menu on a phone and with co-op.

## Checkpoint 1 (completed)

- Branch `night-2026-10-08-c1-checkpoint`, base `d88d6df`. Start 15:55 (budget ~14,678,000); completed 16:05 (budget ~14,663,000). (T5's entry gives its completion as 15:56; the clock read 15:54.)
- **CI of T5** (`d88d6df`): **CI passed** on both branches ([run branch](https://github.com/lazurq-png/Xenocats/actions/runs/37788108362), [task branch](https://github.com/lazurq-png/Xenocats/actions/runs/37788103387)).
- **What was checked, found and changed**: tests over tasks 1–5 (D27): one gap closed with `game-settings.test.tsx` (the aim setting's storage and the settings component), added to CI's jsdom group. Quality and security review over the whole range (D28): approve, no findings; two observations recorded.
- **What it brings**: the night's first five changes are reviewed together and the new settings are covered below the browser tests, so a later task that breaks them fails in seconds instead of minutes. Decisions: D27–D28.
- **Verification (a full-suite point)**: prettier (staged content) clean; `npm run lint` exit 0, 0 warnings; `tsc --noEmit` exit 0; `actionlint` (with shellcheck, pyflakes) exit 0 and CI's group check passes; `npm test`: 43 files passed, 1 skipped, 674 passed, 17 skipped; database tests: 17 passed; `npm run build` exit 0; `npm run test:e2e` (next dev): 133 passed; `E2E_SERVER=start npm run test:e2e`: 133 passed.

## T6 — Regular enemies are the drawn cats; the 20 artwork cats are special (completed)

- Branch `night-2026-10-08-t6-artwork-cats-special`, base `c42d98e`. Start 16:06 (budget ~14,661,000); completed 17:13 (budget ~14,570,000).
- **CI of checkpoint 1** (`c42d98e`): **CI passed** on both branches ([run branch](https://github.com/lazurq-png/Xenocats/actions/runs/37789568172), [task branch](https://github.com/lazurq-png/Xenocats/actions/runs/37789562810)).
- **What the code does**
  - `varieties.ts`: the horde is drawn cats only (basic 8, the Zoomies Cat from 10 s and the Hissing Cat from 40 s at weight 3); the twenty xenocats visit on a clock of their own (`SCHEDULE.xenocats`: from 15 s, every 8–15 s).
  - `arena.ts`: a visiting xenocat is an elite 40% of the time and leaves a chest when sent home (`visitor`); each Mega Cat boss wears a random xenocat's face (`type`); new `xenocat` event and the boss event's `type`.
  - `arena-view.tsx`: a boss is drawn with its face's artwork (a 256 px bitmap); notices: "A giant X has come for the Keeper.", and each xenocat kind's first visit in a run ("X has come.", "…, and it means it." for an elite), never over a boss, evolution or downed/revived notice.
  - Tests: unit tests of the arrivals (no ordinary or swarm cat a xenocat; visits rare by the clock, some elites, every boss with a face) and of the visit's chest; the schedule test describes the new schedule; coop's and one arsenal fixture keep their old elite share (D31); the boss e2e checks its notice; `startRun` waits 15 s (D33).
- **What it brings**: the twenty finished cats are no longer fodder in the crowd: each is a visit worth noticing, with a chest for sending it home, and the bosses wear their faces, while the horde, the time-goal balance and the evolutions stay as they were. Decisions: D29–D35.
- **Verification**
  - prettier (staged content) clean; `npm run lint` exit 0, 0 warnings; `tsc --noEmit` exit 0.
  - Unit, one file at a time on the final code: arena 23, varieties 22, arsenal 94, coop 15, progression 24, all passed.
  - Seeded measurements (temporary scripts, not kept): survival times and chests/attacks per run (D30, D34).
  - `npm run build` exit 0. e2e: 11 specs, 99 passed (next dev), on the final code; the Mega Cat test 3 of 3; one load flake fixed at its cause (D33).
  - Acceptance criteria (D32, D34): by command except how a boss with artwork looks and the notice rules (reading only).
- **Reviewer**: request changes (notices flooding as "rare" was a share; an upscaled boss), redesigned; re-review approve with two Low, handled (D34, D35). **Tested in a browser, not seen**: a human should look at a boss with a cat's face and the notices.

## T7 — Survival is not too zoomed in on a phone (completed)

- Branch `night-2026-10-08-t7-phone-zoom`, base `4335656`. Start 17:10 (budget ~14,567,000); completed 17:44 (budget ~14,518,000). (T6's entry gives its completion as 17:13; the clock read 17:09.)
- **CI of T6** (`4335656`): **CI passed** on both branches ([run branch](https://github.com/lazurq-png/Xenocats/actions/runs/37798434158), [task branch](https://github.com/lazurq-png/Xenocats/actions/runs/37798430443)).
- **What the code does**
  - `arena.ts`: the camera's zoom starts from the screen's own (`baseZoom`, `ARENA_CONFIG.view`): at least 640 arena px across the window's narrower side, up to 1.8; every desktop window of 650 px or more stays at 1, a 390 px phone zooms out 1.64. Co-op zooms out on top of it, and the tether follows.
  - `arena-view.tsx`: the play area exposes `data-zoom`; a comment.
  - Tests: unit tests of the camera (desktop windows unzoomed, phones see the minimum, the cap, a resize, co-op on top); e2e: zoom 1 on desktop, the rule's zoom on a Pixel 7. Also: a test that measured a phone's screen unzoomed now uses the zoom (D38); the level-up e2e's poll takes waiting choices (D40); the five-minute arsenal test's time budget (D42).
- **What it brings**: on a phone the player now sees cats coming from about as far away as on a laptop, instead of meeting them at the screen's edge, while every desktop window plays exactly as before. Decisions: D36–D42; questions.md Q1 asks a human to look.
- **Verification**
  - prettier (staged content) clean; `npm run lint` exit 0, 0 warnings; `tsc --noEmit` exit 0.
  - `vitest related` over 6 files: 183 passed. e2e: 11 specs, 101 passed (next dev) on the final camera rule; the camera tests 2 of 2; the level-up test 3 of 3 after its fix.
  - `npm run build` exit 0.
  - Acceptance criteria (D37): by command except readability at the zoom (reading only; Q1).
- **Reviewer**: request changes (640 reframed the plan's measure); then request changes (768 zoomed out laptop windows); then approve with two Low notes, added to Q1 (D39, D41, D42). **Tested in a browser, not seen**: a human should play it on a phone.

## T8 — Pet a sleeping cat on a touch screen (completed)

- Branch `night-2026-10-08-t8-touch-pet`, base `3d18903`. Start 17:44 (budget ~14,516,000); completed 17:59 (budget ~14,480,000).
- **CI of T7** (`3d18903`): **CI passed** on both branches ([run branch](https://github.com/lazurq-png/Xenocats/actions/runs/37803147151), [task branch](https://github.com/lazurq-png/Xenocats/actions/runs/37803142059)).
- **What the code does**
  - `cat-layer.tsx`: a touch or pen press on a sleeping cat is held instead of poking at once: while held, the finger is the pointer the engine pets by (`petMs`, purring, sleeping on); released sooner it was a tap, and the cat wakes angry; a cancelled press (a scroll) does neither; only the holding finger counts. The mouse is unchanged.
  - `cat-engine.ts`: `sleepingAt(point)`, the sleeping cat under a point.
  - Tests: unit (jsdom) — a held touch pets, a tap wakes angry and never reaches what lies beneath, a second finger changes nothing, a cancelled press does neither; e2e on a Pixel 7 — a long press pets, a tap wakes angry.
- **What it brings**: on a phone a sleeping cat can now be petted, as on a computer, instead of only woken angry; a quick tap still wakes it. Decisions: D43–D45; questions.md Q2 asks for a check on a real iPhone.
- **Verification**
  - prettier (staged content) clean; `npm run lint` exit 0, 0 warnings; `tsc --noEmit` exit 0.
  - `vitest related` over 4 files: 6 files, 64 passed; after the review fixes the layer, engine and petting tests 44 passed.
  - `npm run build` exit 0. e2e: the selector's 22 specs, 137 passed (next dev), before and after the review fixes; the two new touch tests 2 of 2.
  - Acceptance criteria (D44): by command; a real phone's long-press gestures by nothing (Q2).
- **Reviewer**: approve with four Low; two fixed (multi-touch, a comment), one kept by rule, one to Q2 (D45). **Tested in a browser, not seen**: a human should hold a finger on a sleeping cat on a phone.

## T9 — Three cats' artwork colours (completed)

- Branch `night-2026-10-08-t9-artwork-colours`, base `7c6b3a5`. Start 18:00 (budget ~14,478,000); completed 18:13 (budget ~14,452,000).
- **CI of T8** (`7c6b3a5`): **CI passed** on both branches ([run branch](https://github.com/lazurq-png/Xenocats/actions/runs/37805336453), [task branch](https://github.com/lazurq-png/Xenocats/actions/runs/37805331786)).
- **What the code does**
  - `public/xenocats/cats/laser-ocicat-awake.webp`: fur less pale and yellow (saturation and hue matched to its asleep pose); the visor left as it was.
  - `public/xenocats/cats/titan-forest-cat-asleep.webp`: fur lightened to its awake pose's lightness.
  - `public/xenocats/cats/gravi-coon-asleep.webp`: fur turned to its awake pose's colour.
  - `docs/ai/night-2026-10-08/fur.cjs` (new): measures a cat's fur (hue, saturation, lightness) and adjusts it within a hue band, leaving alpha and other pixels alone; refuses a missing number.
- **What it brings**: three cats look like the same cat awake and asleep, with no new artwork needed; and the next colour fix is a measured command, not a guess. Decisions: D46–D48.
- **Verification**
  - The fur measured before and after against the other pose (D46, D48), reproduced byte for byte by the reviewer; size, format and alpha unchanged.
  - `tests/unit/xenocats/cat-art.test.tsx`: 9 passed. prettier on the script clean; `npm run lint` exit 0, 0 warnings.
  - Selector: no unit test; e2e the 22 specs reaching the images' pages, 137 passed (next dev), before and after the review fixes. `npm run build` exit 0.
  - **Built, not seen**: a human should look at `laser-ocicat-awake.webp`, `titan-forest-cat-asleep.webp` and `gravi-coon-asleep.webp` beside their other poses.
- **Reviewer**: request changes (the visor recoloured; noses, antenna bulbs, the script's arguments), all handled (D48).

## T10 — The landing page's header loses its two links (completed)

- Branch `night-2026-10-08-t10-landing-header`, base `2cf047e`. Start 18:13 (budget ~14,452,000); completed 18:21 (budget ~14,427,000).
- **CI of T9** (`2cf047e`): **CI passed** on both branches ([run branch](https://github.com/lazurq-png/Xenocats/actions/runs/37807067648), [task branch](https://github.com/lazurq-png/Xenocats/actions/runs/37807063682)).
- **What the code does**
  - `app/page.tsx`: the header's navigation ("Log in" and "Meet the cats") is gone; the header holds the logo; the hero's links are unchanged.
  - `smoke.spec.ts`: the test of the removed header links is replaced by one at 1280 and 390 px: exactly one "Log in" and one "Meet the cats" link, both in the hero, visible, leading where they did; the header holds only the logo.
- **What it brings**: the landing page says "Log in" and "Meet the cats" once each, in the hero, instead of twice. Decisions: D49.
- **Verification**
  - prettier (staged content) clean; `npm run lint` exit 0, 0 warnings; `tsc --noEmit` exit 0.
  - Selector: no unit test relates; e2e the 3 specs reaching `/`: 17 passed (next dev), twice. `npm run build` exit 0.
  - Acceptance criteria: by command. **Tested in a browser, not seen**: a human should look at `/`'s header with only the logo.
- **Reviewer**: approve, no findings.

## Session 2 — resumed 2026-10-09 09:12

- **Gap**: session 1 stopped on the account's usage limit on 2026-10-08 at about 18:24 (its message: "resets 8:20pm"), two minutes into T11. Its `/loop 20m` timer (`ffa0ab35`) never resumed it: per that session's own transcript, no firing came between 18:21 and 09:30, and its process ended and was restarted at some point (it reported a "previous session ended" notice). A human started this session with `/night-run` at 09:12. Time lost: about 14 h 50 min, of which about 12 h 35 min were before the goal time (07:00): T11, T12 and the exploration the plan scheduled for the night were never started in it.
- Clock 2026-10-09 09:12, budget 14,909,198 (this session's own denominator). **Deadline: 2026-10-09 07:00** (unchanged; already past), so under §8.4 only the task in flight, T11, is finished, then the morning report. T12 and exploration do not start.
- §9.2: remote branches match the local ones (`origin/night-2026-10-08` = `3973479`). T10's CI was re-polled (below). Timer re-armed: `760fdd62` (`7,27,47 * * * *`).
- **Baseline re-run** (§1.5), 09:12–09:27 on `3973479`, T11's uncommitted work stashed: lint exit 0, 0 warnings (= `lint-baseline.txt`), 113 s; `next typegen && tsc --noEmit` exit 0, 58 s; `npm test` 685 passed, 17 skipped, 126 s; database tests 17 passed, 6 s; `npm run build` exit 0, 43 s; `npm run test:e2e` 138 passed, 4.5 min; `E2E_SERVER=start` 138 passed, 2.6 min.
- **Session 1 woke at 09:30.** Its timer fired at 09:30 (why then, and not after the limit reset at 20:20, its transcript does not show), and it ran read-only checks and staged T11's files (`git add`, no content changed), then saw this session's state, stopped and deleted its timer. Nothing else it did reached the tree. Its checks ran beside this session's gate (whose first steps it overlapped): the gate's later steps were judged accordingly (below).

## T11 — Each account has its own customers and invoices (completed)

- Branch `night-2026-10-08-t11-own-data`, base `3973479`. Start 2026-10-08 18:22 (session 1, budget ~14,425,000), cut off at about 18:24; resumed 2026-10-09 09:12 (budget 14,909,198); completed 09:57 (budget ~14,743,000).
- **CI of T10** (`3973479`): **CI passed** on both branches ([run branch](https://github.com/lazurq-png/Xenocats/actions/runs/37808190533), [task branch](https://github.com/lazurq-png/Xenocats/actions/runs/37808186098)).
- **What the code does**
  - `db/migrations/0005_customer_owners.sql` (new): each customer has an owner, a user (required, kept from deletion while they own customers, indexed). Existing customers go to the only user. With customers and not exactly one user it stops, changing nothing, and says how to assign them by hand and run it again.
  - `scripts/db.mjs`: the seeded customers are the demo user's.
  - `auth.config.ts`: the session carries the user's id. A session without one (a login from before this change) is signed out.
  - `app/lib/session.ts` (new) and every dashboard page and panel: data is read for the signed-in user's id, taken from the session.
  - `app/lib/data.ts`: every query is the owner's: lists, search, counts, totals, the chart, single invoices and customers, the export.
  - `app/lib/actions.ts`: creating, changing and deleting invoices and customers touch only the user's own. An invoice is created for, or moved to, only the user's own customers. Another account's rows get the same reply as unknown ones.
  - `app/dashboard/invoices/export/route.ts`: the CSV holds only the user's invoices.
  - `app/dashboard/invoices/[id]/edit/page.tsx`: a malformed id is not-found, as on the other id pages.
  - Tests:
    - database tests: two accounts never see each other's rows, and the real actions refuse the other's and change nothing; migration 0005 on existing rows, one user, two users and empty;
    - unit tests: the session's id, the owner passed by every action and the export, the refusals;
    - `tests/e2e/own-data.spec.ts` (new): a second user gets not-found for the demo user's invoice and customer, and empty lists, overview, export and invoice form.
  - CI: the new spec is in the invoices group of both browser jobs.
- **What it brings**: each account now has its own customers and invoices. A user can no longer see, search, export or change anyone else's, even by guessing an id or posting to an action directly. That is the prerequisite for letting people sign up (task 12). Decisions: D50–D57. Questions: Q3 (a human runs `npm run db:migrate` on `xenocats` before the development dashboard works again), Q5.
- **Verification** (the selector printed FULL for `auth.config.ts`, and the plan asked for every suite)
  - prettier on the staged content of the 22 changed code files: clean (the `.sql` has no Prettier parser). `npm run lint` exit 0, **0 warnings** (= baseline). `next typegen && tsc --noEmit` exit 0. `actionlint` (with shellcheck and pyflakes) exit 0. CI's "every test file is in a group" loop, run locally: none missing.
  - `npm test`: 691 passed, 24 skipped. `DATABASE_TESTS=1 npx vitest run tests/unit/data`: **24 passed**, none skipped (17 before, plus 4 two-account and 3 migration tests).
  - `npm run build` exit 0, twice. No page reads the database at build time any more: each now reads the session.
  - `npm run test:e2e` (next dev): **139 passed**. The new spec: 3 of 3 alone (dev), 3 of 3 (start).
  - `E2E_SERVER=start npm run test:e2e`:
    - First run: 137 passed, 2 failed. Survival's "a level-up stops the run for a choice…" then passed 5 of 5 alone; nothing it touches changed, so it is recorded as a flake under load. Login-limit's "a successful login starts the count again" failed 1 of 5 alone, and **3 of 10 on the base commit without T11**: an older flake, its cause and fix in Q5.
    - After the reviewer's fix and a rebuild, the full suite again: **139 passed**.
  - `next-env.d.ts` and `AGENTS.md` unchanged.
  - Acceptance criteria (D57): by command, except "no other code path touches customers or invoices", checked by reading and `grep`.
- **Reviewer**: approve, one Low: the spec's demo invoice could be one another spec deletes mid-run, making the not-found check prove nothing. Fixed: it picks the oldest invoice, a seeded one, and passed 3 of 3 on each server. The reviewer could not run the database or browser tests (the gate was using them); both ran here, as above.
- **Not seen**: nobody looked at a page. A human should log in as a second user (none exists in `xenocats`; Q3) and look at the empty dashboard.

## T11 — CI repair, cycle 1 (completed)

- **CI of T11** (`5465a6d`): **CI failed** on both branches ([run branch](https://github.com/lazurq-png/Xenocats/actions/runs/37901985058), [task branch](https://github.com/lazurq-png/Xenocats/actions/runs/37901981307)). The jobs: *checks* passed, *build* (next start) passed, *e2e* (next dev) failed, in its step "Browser tests (invoices)".
- **What the code does**: `tests/e2e/own-data.spec.ts` asserts the visible copy of each text only, so a hidden copy React keeps while streaming no longer trips Playwright's strict mode. No app code changed.
- **What it brings**: T11's new browser test holds on CI's cold dev server, so the run's CI goes green on the change that gives each account its own data. Decisions: D58.
- **Verification**: reproduced cold (`.next` deleted, the invoices group alone, `CI=1`): failed with the strict-mode error. After the fix, the same cold run with retries off twice, 18 of 18 each. The spec 5 of 5 warm (dev), 3 of 3 against `next start` after `npm run build` (exit 0). prettier clean; `npm run lint` exit 0, 0 warnings; `tsc --noEmit` exit 0. The selector picked only this spec. Reviewer: not re-run, since the change is test-only and limited to how the spec locates text.
- Completed 10:18 (budget ~14,722,000).
