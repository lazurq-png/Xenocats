# Progress — night run 2026-10-07

Append-only. One entry per task, appended when it ends; the morning report last.

## Run start

- Run branch: `night-2026-10-07`, cut from `main` at `4fb5f5c` (the plan is committed on `main`, in `89fb032`/`15cc54b`).
- Goal: "Thursday 08:30" → **Deadline: 2026-10-08 08:30** (Europe/Stockholm; machine time zone `W. Europe Standard Time`).
- Wall clock at start: 2026-10-07 14:21 (Wednesday).
- Session budget at start: 14,898,083 tokens. Reserve: 10% (1.49M) while another session can follow, 30% (4.47M) when final; ceiling 4% (596k).
- Limits (from the plan, information only): "The run cannot see the account's usage limit; if it runs out, the session pauses until the timer's next firing after it resets, and the per-task commit and push bound the loss. Last run lost about 7 of its 18 hours to such pauses."
- Environment: node v24.19.0, npm 11.17.0; `node_modules` present; Chromium present; `.env` present (existence only checked).
- Remote: `origin` = github.com/lazurq-png/Xenocats, reachable, no `night-2026-10-07*` branches.
- Pre-existing uncommitted changes: none.
- Timer: the human's `/loop 20m` (cron job `0151a2f2`, `*/20 * * * *`) is this run's timer; no other armed (§9.5).

### Baseline (§1.5), 14:22–14:35

| Check | Result | Time |
| ----- | ------ | ---- |
| `npm run lint` | exit 0, **0 warnings** (`lint-baseline.txt`) | 74 s |
| `npx next typegen && npx tsc --noEmit` | exit 0 | 42 s |
| `E2E_NO_DATABASE=1 npm test` (plan: until T1 merges) | exit 0 — 34 files passed, 1 skipped (`data.test.ts`); 484 tests passed, 17 skipped | 60 s |
| `npm run build` | exit 0 — **in the gate** | 15 s |
| `npm run test:e2e` (next dev) | exit 0 — 101 passed | 167 s |
| `E2E_SERVER=start npm run test:e2e` | exit 0 — 101 passed | 109 s |

Note: the first attempt was invalid. I stopped a background baseline to fix its exit codes (piped into `tail` without `pipefail`), but its child script kept running alongside the rerun; the two overlapped, and under that load `keyboard.spec.ts:129` ("every control on the dashboard pages has a name") timed out in `next dev`. The build and both e2e runs were then repeated alone (above), with no stray process left (`ps`, port 3100 checked). Not counted as a flake: the cause was the overlap.
Database reachable (the e2e global setup rebuilt `xenocats_test`).

## T1 — Database unit tests are opt-in (completed)

- Branch `night-2026-10-07-t1-db-tests-opt-in`, base `4fb5f5c`. Start 14:35 (budget 14,874,783); completed 14:42 (budget ~14,860,000).
- **What the code does**
  - `tests/unit/data.test.ts`: `databaseUrl()` returns no URL unless `DATABASE_TESTS` is exactly `1` (and still none with `E2E_NO_DATABASE`), so every block in the file skips and nothing connects. Header comment says so.
  - `.github/workflows/ci.yml`: the *build* job's "Database tests" step sets `DATABASE_TESTS: '1'`, so CI still runs them on its own database.
  - `CLAUDE.md` §9, `.claude/rules/testing.md`: describe the opt-in and the command to opt in.
- **Why it was added**: plan task 1 (resolves last run's Q6, option (a)): a plain `npm test` must never touch a database. D1 (`E2E_NO_DATABASE` still skips), D2 (opted-in path not run locally).
- **Verification**
  - prettier (LF-normalised, as runs 09-25 D3 / 10-01 D1): `data.test.ts`, `testing.md`, `ci.yml` exit 0; `CLAUDE.md` was already unformatted on the base, and its Prettier diff is unchanged in kind (the file's own `*emphasis*` style on the edited line).
  - `npm run lint` exit 0, 0 warnings (= baseline). `next typegen && tsc --noEmit` exit 0. `npm run build` exit 0.
  - `test:affected` selection: unit `vitest related tests/unit/data.test.ts`; e2e 0 specs.
  - With `POSTGRES_URL` pointed at a dead port (`127.0.0.1:1`, so no real database could be reached): no `DATABASE_TESTS` → 1 file skipped, 17 tests skipped; `DATABASE_TESTS=true` → skipped; `DATABASE_TESTS=1` → attempted `db.mjs reset`, `ECONNREFUSED 127.0.0.1:1` (the opt-in path is live). Criterion 1 checked by command; criterion 2 by CI (poll below); criterion 3 by reading.
  - Reviewer: approve, no findings; one observation → D3 / Q1.

## T2 — Each cat hits page elements the way it hits the pointer (completed)

- Branch `night-2026-10-07-t2-element-hits`, base `60801d2`. Start 14:43 (budget ~14,855,000); completed 15:21 (budget ~14,654,000). The first edits were made on the run branch before the task branch was cut (14:55); uncommitted, they carried over unchanged, and nothing was committed to the run branch.
- **What the code does**
  - `app/ui/xenocats/puppets.ts`: an element under attack no longer wanders or gets a "weird twist". Its effect runs on a pointer held still at the element's centre, and the element goes where the effect puts that pointer and looks as the cursor would (hidden, frosted, smoke = blur x3 + grey, shrunk, grown). It moves only if the attack moves a still pointer. The effect runs in the span its centre may cover (`span()`), so its box stays in the viewport (Pinball bounces it off the edges), and one already partly off screen is never pulled in or pushed further off. The level's `fling` scales only attacks that throw the pointer some way (`amplify: 'offset'`); the ones that put it somewhere (spiral, orbit, magnet, bounce) put the element there at every level. `release()` now sets the saved style before removing it, which fixes elements being left with `style=""` in Chromium (D8).
  - `app/ui/xenocats/page-hits.ts`: only target selection remains. `PAGE_HITS`, the CSS hit kinds, `applyHits`, `hitPage`, `hitText` and scrambled or swapped text are gone. Calm now has puppet settings too (half the throw, size within 0.5–1.6x) at its smaller reach.
  - `app/ui/xenocats/fake-cursor.tsx`: every intensity, and touch screens, hit the page through the puppets; touch screens run their own animation frames while a hit lasts.
  - `app/ui/global.css`: the CSS for the removed hit kinds and the text overlay is deleted; the page clipping while elements are displaced stays.
  - `app/ui/settings/cat-intensity.tsx`: calm and chaos descriptions match the new behaviour.
  - Tests: `tests/unit/xenocats/puppets.test.ts` holds the mapping table (all 20 cats and 6 combos) and checks every row (motion and look) against the engine, at normal; the attacks that put the pointer somewhere again at calm, in chaos and as a panel; every element inside the viewport in chaos for every effect; never pulled further off screen; exact revert. `page-hits.test.ts` keeps the selection tests (the `hitPage` cases now go through `pickTargets`); scramble, CSS-kind and push tests removed with the code. `fake-cursor.test.tsx`: calm Vanish hides in place, touch Jitter shakes. `tests/e2e/cats.spec.ts`: one test per cat that summons it and checks every element it touched is back exactly; Smoke Bombay's smoked elements stay where they were; Pinball Devon's elements are displaced over 100 px and stay inside the viewport. The calm test asserts a half-distance throw; the scrambled-text test is removed with the behaviour. `touch.spec.ts`: the touched button is thrown, then back exactly.
- **Why it was added**: plan task 2. The mapping table is D4; calm through the same engine D5; staying on screen D6; twists removed D7; the `style=""` fix D8; clicks unchanged D9 (Q2, a requirement not met); five cats now leave elements alone (Q3).
- **Verification** (gate run alone, 15:14–15:20; the selector printed FULL because of `global.css`, so every suite ran in full)
  - prettier (LF-normalised) on the 11 changed files: clean. `npm run lint` exit 0, 0 warnings (= baseline). `next typegen && tsc --noEmit` exit 0.
  - `npm test` (plain, since T1): 34 files passed, 1 skipped; 493 tests passed, 17 skipped (the database tests, opt-in).
  - `npm run build` exit 0. `npm run test:e2e` (next dev): 120 passed. `E2E_SERVER=start npm run test:e2e`: 120 passed.
  - An earlier gate run (before the review fixes) had lint, type check, unit and build green, then lost its `next dev` server mid-suite (49 tests failed at 0 ms) while the reviewer ran vitest in parallel. It was stopped for the review fixes; the reviewer's re-check then ran read-only.
  - Acceptance criteria: 1–5 and 7 checked by command (the unit table, the per-cat e2e tests); 3 (the table in decisions.md) by reading too; 6, exact revert, by command (unit and per-cat e2e, which found D8); focused fields by the existing `pickTargets` unit test; clicks not changed (Q2). **Tested in a browser, not seen**: nobody has looked at how the smoke, frost or bouncing look on the dashboard pages.
  - Reviewer: request changes (fling for fixed-point effects at calm/chaos/panels; stale intensity descriptions; clicks), the first two fixed, re-review approve (D11).
- **CI of T1** (`60801d2`): the run branch passed every job, including "Database tests" ([run](https://github.com/lazurq-png/Xenocats/actions/runs/37622699500)); the task branch's run of the same commit failed in "Browser tests (dev server)" ([run](https://github.com/lazurq-png/Xenocats/actions/runs/37622695999)), step "Browser tests (smoke, branding, dashboard, login, settings, headers, states, keyboard, intensity)". Identical tree, so no repair; Q4.

## T3 — Cats sound like cats (abandoned)

- Branch `night-2026-10-07-t3-cat-sounds` (local only, no commits), base `a094fbf`. Start 15:21 (budget ~14,651,000); abandoned 15:31 (budget ~14,599,000).
- **Why it was abandoned:** the harness's auto-mode classifier denied, as "Untrusted Code Integration", the edit that wired the downloaded recordings into `app/ui/xenocats/sounds.ts`. Under the skill (Read this first: a denied call is a §3 boundary), it was not retried in another form, and the task was abandoned. Right after that, a plain read of the T2 CI poll's output together with `git status` was denied the same way (see T2's CI below).
- **What had been done, all undone** (`git restore -- app/ui/xenocats/sounds.ts`, the added `public/xenocats/sounds/` removed; nothing committed):
  - Searched Commons (API search, `filetype:audio`) for cat meows, hisses, purrs, growls, kittens and chirps; 64 candidates, licences read from each file's `extmetadata` (`License`). Public domain or CC0, and real cat calls: "Meow of a pleading cat.oga" (PD, Heismark), "Meow of a Siamese cat - freemaster2.wav" (CC0, freemaster2), "2015-11-24.νιαούρισμα.Νιάου.noise reduced.flac" (CC0, Tsester), "Cat hissing - Zabuhailo.wav" (CC0, Zabuhailo), plus PD purrs (not needed: the task leaves the purr out). No PD/CC0 growl or chirp was found; those were to be made by varying the meows and the hiss.
  - Fetched their MP3 transcodes from `upload.wikimedia.org` (only that host and `commons.wikimedia.org`), into a new scratch directory. All four kept files start with an MP3 header and are at most 105 KB; 185 KB together. Two purrs over 200 KB were rejected.
  - Measured the calls in each (decoded in Playwright's Chromium): pleading meow 0.3–0.6, 3.8–4.6, 6.8–7.4, 9.5–9.9, 10.3–11.1 s; Siamese 0.3–1.0 s; Greek meow 0.2–0.9 s; hiss 0.9–2.1 s.
- **What a human must approve to do it** (questions.md Q5).
- **CI of T2** (`a094fbf`): the poll ran to its end, but reading its output was denied by the harness (as above), so the result is **not observed**. It must not be re-read another way (the denial forbids it); the next push polls its own commit.

## T4 — The fight games get pages of their own; a movement pad (completed)

- Branch `night-2026-10-07-t4-game-pages`, base `a094fbf`. Start 15:30 (budget ~14,596,000); completed 15:48 (budget ~14,512,000).
- **What the code does**
  - `app/cats/survival/page.tsx`, `app/cats/taming/page.tsx`: two new public pages, each with the `/cats` header ("Back to the cats") and one game.
  - `app/ui/xenocats/fight-page.tsx`: gives a game page the cat and cursor providers (no cat comes on its own), or, on a device without a precise pointer, a notice that the game needs a keyboard and mouse.
  - `app/ui/xenocats/fight.tsx`: takes its game as a prop (`kind`). It is no longer a portal or a modal dialog: its play area is a full-page layer of the game's own page, with the HUD along its top, and while a game runs everything else on the page is `inert`, so Tab never lands behind it. The game itself is unchanged.
  - `app/ui/xenocats/cat-gallery.tsx`: the "Fight a cat" section is two links, Play Survival and Play Taming. Summon is no longer disabled during a game, since none runs there.
  - `app/ui/xenocats/movement-pad.ts` (pure) and `movement-pad-view.tsx` (component): the touch movement pad, not yet placed in a game. A thumb on it walks the character in the WASD way nearest to it (`walkDirection` of the same keys), with a dead zone in the middle and nothing when released. It is 144 px across with a knob that follows the thumb, hidden from assistive technology, and stops the page scrolling or zooming while held.
- **Why it was added**: plan task 4 (D12–D16).
- **Verification** (gate run alone, 15:41–15:47; the selector printed FULL because the pad reaches no route yet)
  - prettier (LF-normalised) on the 9 changed files: clean. lint exit 0, 0 warnings (= baseline). typegen + tsc exit 0.
  - `npm test`: 35 files passed, 1 skipped; 500 passed, 17 skipped (database tests, opt-in). Includes the pad's 7 unit tests.
  - `npm run build` exit 0. `npm run test:e2e` (next dev): 124 passed. `E2E_SERVER=start npm run test:e2e`: 124 passed.
  - Acceptance criteria checked by command (e2e): `/cats` links to both pages; each page starts its game (fallback path) and the existing fight tests pass there (Esc, pause and resume, pointer lock, best score, tamed collection); leaving mid-game releases the lock and leaves nothing inert; no `role="dialog"`; Tab stays in the play area (fails without the fix); the touch profile shows the notice on both pages. The pad's mapping is checked by unit tests (centre, four ways, diagonals, snapping, dead zone, release, knob). Checked by reading only: the pad's scroll and zoom blocking (its browser test comes with task 5, as the plan says). **Tested in a browser, not seen**: nobody has looked at the two pages or the pad.
  - Reviewer: request changes (focus behind the play area; a test that demanded pointer lock; duplicated page shells, optional). The first two fixed, re-review approve (D16).
- **CI of T2**: not observed (see T3's entry).

## T4 — CI repair, cycle 1 (completed)

- **CI of T4** (`b08df21`) failed on both branches ([run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37631428777), [task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37631412535)): job "Lint, type check, unit tests", step "Every test file is in a group". Every other job passed, both browser jobs included. Cause: T4's new `tests/unit/xenocats/movement-pad.test.ts` was named in no unit-test group in `ci.yml`, and the run's gate did not include that check.
- Fix (16:04, on `night-2026-10-07-t4-game-pages`, T5 parked in a stash of its own paths): the file is added to the "cats, games, page, sound" group. Reproduced first: CI's own check run locally against the committed `ci.yml` printed `MISSING tests/unit/xenocats/movement-pad.test.ts`; with the fix it exits 0. The check is now part of this run's local gate.
- Verification (gate, FULL because a workflow changed): prettier, actionlint (with shellcheck and pyflakes) exit 0, lint 0 warnings, type check, group check, `npm test` 500 passed / 17 skipped, build, `test:e2e` 124 passed on next dev and 124 on next start. Not reviewed separately: a one-line configuration fix.

## T5 — Taming with treats (completed)

- Branch `night-2026-10-07-t5-taming-treats`, base `b08df21`, fast-forwarded to `2edb420` (T4's CI repair) while parked. Start 15:48 (budget ~14,508,000); completed 16:20 (budget ~14,412,000).
- **What the code does**
  - `app/ui/xenocats/taming.ts`: new rules, still pure. Treats (fish, catnip, yarn, milk) turn up at random spots, at most a few at a time, and vanish after a while; walking over one picks it up, one at a time. Without a treat, the one cat flees a ranger who comes close (its old `DODGES` way) and attacks it from a distance at an interval. With a treat, the cat comes to the ranger, and on contact it is tamed and the treat used up; the next cat follows. `tick(now, ranger)` returns what happened (tamed, attack, picked). Every number is in `TAMING_CONFIG`.
  - `app/ui/xenocats/fight.tsx`: Taming has Survival's ranger, unarmed. It walks with the held keys, or the movement pad when none is held, and a cat's attack lands on it as in Survival (drift, freeze, reverse…). The HUD shows "Carrying: Fish" (or "nothing") and the cats tamed this game. Treats are drawn as emoji discs. The pad shows only on touch screens. The pointer plays no part: under pointer lock it is hidden, in the desktop fallback the fake cursor stays so End game can be found, and on touch no lock is requested. The touch HUD says "Tap End game to stop."
  - `app/ui/xenocats/fight-page.tsx`: on a touch screen Taming is played (with the pad); only Survival shows the keyboard-and-mouse notice.
  - `app/ui/xenocats/player-sprite.tsx`: `armed={false}` draws the ranger without its gun.
  - Tests: `taming.test.ts` keeps the dodge and collection tests and replaces the 2-second-hold tests with tests for treats (spawning, the cap, expiry, pickup one at a time), the cat without a treat (ranged attacks at the interval and not from afar, fleeing, never tamed empty-handed), with one (it comes, is tamed on contact, the treat used up, the next cat comes; a cat mid-dodge comes once the dodge ends), and a game walked with the pad's `padDirection`. `fight.spec.ts`: the two old Taming tests are replaced by "walk to a treat, carry it to the cat, tamed, in the collection" (desktop fallback, WASD) and "without a treat the cat keeps away". The touch profile now plays Taming with the pad (real touch events); Survival still shows the notice.
- **Why it was added**: plan task 5 (D17–D22).
- **Verification**
  - Final gate (16:12–16:18, on the state after the review fixes): prettier on the 6 changed files, lint exit 0 with 0 warnings (= baseline), type check, CI's group check, `test:affected` selection (unit: 3 files, 37 passed; e2e: 22 specs, 124 passed on next dev).
  - The new Taming browser tests, run three times each before the review: 12 of 12 passed.
  - Acceptance criteria checked by command (unit + e2e): treats, pickup, carrying one, flee and ranged attack, approach, taming and the treat used up, the collection, desktop and touch. Checked by reading only: the attack's effect landing on the ranger (the same `LockedPointer` path as Survival's, not asserted by a test), the field-guide "tamed" stat (unchanged call), sounds. **Tested in a browser, not seen**: nobody has looked at the treats, the unarmed ranger or the pad in play.
  - Reviewer: approve with three Low findings; two fixed, one partly (D22). Not re-reviewed.
- **Waiting for a Superdesign pass**: the treat emoji (🐟 🌿 🧶 🥛) and the unarmed ranger.
- **CI of T4**: failed (a test file in no CI group), repaired in one cycle; see "T4 — CI repair, cycle 1" above. The repair's own CI is reported below.
- **CI of the T4 repair** (`2edb420`): **CI passed** on both branches ([run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37634618640), [task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37634615554)).

## Checkpoint 1 (completed)

- Branch `night-2026-10-07-c1-checkpoint`, base `fe169d5`; covers `4fb5f5c..fe169d5` (T1, T2, T4 and its CI repair, T5). Start 16:19 (budget ~14,410,000); completed 16:33 (budget ~14,387,000).
- **CI of T5** (`fe169d5`): **CI passed** on both branches ([run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37635776113), [task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37635771876)).
- **1. Tests.** Checked every behaviour changed in the range against a test that would fail without it. Added: `tests/unit/xenocats/movement-pad-view.test.tsx` (the pad component: hidden from assistive technology, each change of way reported once, zero on release, cancel and unmount, a second finger ignored, `touchmove` blocked only while held), named in CI's jsdom group; and, in `fight.spec.ts`, Taming's "the cat's attack lands on the ranger". The "keeps away" test was restructured after it failed twice in four runs (the ranger picked up a treat on the way, and the cat rightly came); 16 of 16 over four repeats afterwards (D23). Nothing removed: no test of removed behaviour, no duplicate, none that cannot fail. Still covered by reading only: T1's opt-in path (by a manual run and CI's "Database tests" step; Q6).
- **2. Quality and security.** The reviewer read the whole range with `.claude/rules/security-review.md` in scope (auth on the new routes, input and storage, DOM side effects, removed code, docs): approve, four Low findings; three fixed (stale comments, a dead ternary, README's routes), one sent to a human (Q6: the night-run skill should say how to run the opt-in database tests) (D24). No security finding.
- **What changed** (code): `.github/workflows/ci.yml` (the new test in a group), `README.md` (the game routes), comments in `fight.tsx`, `puppets.ts`, `global.css`, the `fight-page.tsx` ternary, the tests above.
- **Verification** (a full-suite point): actionlint (with shellcheck and pyflakes) exit 0; prettier on the 6 changed code files; lint exit 0, 0 warnings; type check; CI's group check; `npm test` 36 files passed, 1 skipped, 510 tests passed, 17 skipped; build; `npm run test:e2e` 124 passed; `E2E_SERVER=start npm run test:e2e` 124 passed.

## T6 — The arena, the hero and the horde (completed)

- Branch `night-2026-10-07-t6-survival-arena`, base `0153196`. Start 16:33 (budget ~14,385,000); completed 19:40 (budget ~14,250,000). **Gap**: the session sat idle from about 16:48 to 19:20 (several timer firings arrived together at 19:20): most likely the account's usage limit; about 2½ hours lost.
- **CI of checkpoint 1** (`0153196`): **CI passed** on both branches ([run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37637560580), [task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37637555165)).
- **What the code does**
  - `app/ui/xenocats/arena.ts` (new): Survival as a pure simulation in fixed 1/60 s steps, seeded. The Keeper walks an endless arena. Cats of the twenty types appear just off screen all round and walk at him, more and more as time passes (a few at first, dozens by a minute, hundreds by two and a half, thousands by four), and each that reaches him drains his Resolve by its type's own amount; then he is untouchable for a moment. Elites (4 %) also lay their xenocat effect on him (freeze, slow, reversed controls, pushes, a jump, a shake, a veil), one at a time. His Laser Pointer fires every 1.1 s at the nearest cat; every cat along its beam grows homesick, and enough sends it home. At five minutes the Matriarch comes; the run ends when she reaches him, when his Resolve is spent, or when he gives up.
  - `arena-grid.ts` (new): the spatial grid all nearness questions go through. `frame-guard.ts` (new): measures frame times; below 40 fps no more cats come beyond the first 40, until above 50 again. `arena-storage.ts` (new): the best time under a versioned key, corrupt data read as none. `arena-art.ts` (new): the Keeper's SVG.
  - `arena-view.tsx` (new): the game on `/cats/survival`. It has a start screen (Start, the longest time survived, the controls), a full-page canvas with a text HUD (time, Resolve, cats sent home), the camera on the Keeper over a tiled floor, the cats drawn from bitmaps made once, beams and beamed-home columns, and an accessible pause menu (Resume, Give up) on Esc, lost focus or the Pause button. The results screen shows the time survived and cats sent home; the best time is kept. Walking is WASD or the arrows, or the movement pad on touch screens. Sounds are capped at 3 per 300 ms, and the field guide still counts cats met and attacks survived. Test hooks: `?seed=`, `?speed=`.
  - `fight-page.tsx`: Survival is the arena on any device (no notice any more); Taming keeps the cat and cursor providers. `fight.tsx`: Taming only now. `walking.ts` (new): the walk keys, facing and game clock that Taming and the pad use, moved out of the retired `survival.ts`.
  - Retired (deleted, as the plan allows): `survival.ts`, `gun.ts` and their unit tests.
  - `scripts/affected-tests.mjs`: a spec's longer path counts for the area it belongs to (`/cats/survival` for `/cats`), not for another's.
  - Tests: `tests/unit/xenocats/arena.test.ts` (22: movement, contact drain per type and untouchability, Resolve spent, giving up, every effect mapped, Cryo/Gravi/Mirror on the Keeper, one effect at a time, plain cats lay none, spawning just off screen all round and walking at him, the escalation on time in a seeded run, the guard, the laser and its cooldown and range, a cat on the Keeper, the time goal and the Matriarch, spent-after-the-goal, determinism, the grid against brute force, the guard's hysteresis, the best time). `walking.test.ts`; `tests/e2e/survival.spec.ts` (desktop: a run with time, the laser sending cats home, Esc pausing with time standing still, giving up, the results and the best time kept after a reload; WASD; lost focus pauses. Touch: the pad walks him, the laser sends cats home, Pause leads to giving up). `fight.spec.ts` keeps Taming, the links, Taming's leave-the-page and pause tests. CI's groups updated.
- **Why it was added**: plan task 6 (D25–D34).
- **Verification**: see the gate below. The Survival spec passed 12 of 12 over three repeats. Acceptance criteria by command: everything in the task's test list (unit and e2e), on desktop and touch. By reading only: how the arena looks (the floor, sprites, beams, the Keeper), the sound cap, the frame guard on a real slow device. The time goal is covered by unit tests only (D30). **Tested in a browser, not seen.**
- **Drawn by the run, not seen** (for a Superdesign pass): the Keeper, the floor, the laser beam, the beamed-home column, the elites' ring, the homesickness bars; the Matriarch is Titan Forest Cat's own art, enlarged.
- Reviewer: request changes (the guard could leave a slow screen empty; the laser had no direction with a cat on the Keeper; a weak test), all fixed; re-review approve with two Low findings, both fixed (D34).
- **Gate** (final, 19:32–19:38; FULL: files deleted and the selector changed): prettier on 20 files, lint exit 0 with 0 warnings, type check, CI group check, `npm test` 36 files passed / 1 skipped, 500 passed / 17 skipped, build, `test:e2e` 120 passed on next dev and 120 on next start. Two earlier gate runs: the first failed on the selector test (fixed, D34); the second passed before the re-review fixes.

## T7 — Experience, level-ups and the arsenal (completed)

- Branch `night-2026-10-07-t7-arsenal`, base `21c407a`. Start 19:39 (budget ~14,247,000); completed 20:16 (budget ~14,124,000).
- **CI of T6** (`21c407a`): **CI passed** on both branches ([run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37660689356), [task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37660685677)).
- **What the code does**
  - `app/ui/xenocats/arsenal.ts` (new): the nine weapons (Laser Pointer, Cat Treats, Vacuum Cleaner, Spray Bottle, Yarn Ball, Can Opener, Hairball, Thunderous Vacuum, Laser Pointer Deluxe), each with eight levels of stats. It also holds the nine passives (Rubber Chicken, Battery, Catnip, Scissors, Wool Sweater, Warm Milk, Long Whiskers, Stern Look, Lucky Bell) and what they add up to, the experience curve, and the level-up offer: three choices, or four with the Lucky Bell. Choices are new weapons or passives while slots remain (six each), or the next level of one held, never one at its highest; with nothing left, a moment of rest.
  - `app/ui/xenocats/arena.ts`: every weapon acts on its own each step (beams, spreads, droplets, bouncing balls, orbiting blades, a bursting ball, a zone, a beam that leaps from cat to cat, a pull). A shot touches as many cats as its pierce. Cats homesick enough are swept home once a step and leave a gem; gems near him fly to him; experience brings levels; a level stops the run until a choice is made (`choices`, `choose`, `choiceLevel`). The passives change his speed, Resolve, recovery, pickup reach and the weapons' cooldown, reach, count and homesickness.
  - `app/ui/xenocats/arena-view.tsx`: the HUD shows the level and an experience bar. A level-up opens a modal dialog ("Level N. Choose one."), with focus on the first choice, picked with 1–4, the arrow keys and Enter, or a tap; afterwards focus returns to the play area and the run goes on. The canvas draws gems, shots, blades, the zone and leaping beams; a level-up chirps. The play area carries `data-level` and `data-weapons`.
  - Tests: `tests/unit/xenocats/arsenal.test.ts` (new, 30). It covers the curve and the offer (distinct, never maxed, the slot limits, the fourth choice, rest when all is maxed), the passives, and every weapon at levels 1 and 8: stats grow, it sends cats home, each firing is its count, it waits its cooldown, and pierce is exact. It also checks the Can Opener's blades, the zone's reach, a Yarn Ball staying on screen and the Vacuum's pull, then levels in a run (gems, the pause, the choice) and a seeded five-minute run ending with more than 30 attacks alive at once. `arena.test.ts` keeps its tests (gems worth nothing there, so no level-up interrupts). `survival.spec.ts`: the level-up dialog by keyboard (focus, arrows, the run waiting, a weapon by its number, held at its level) and by tap; the other tests take any level-up's first choice and play on. CI's games group names the new unit test.
- **Why it was added**: plan task 7 (D35–D42).
- **Verification**: the final gate below. The two level-up browser tests passed 12 of 12 over two repeats (with the rest of the spec). Acceptance criteria by command: all of the task's list. By reading only: how the shots, blades, zone and gems look; the balance (first guesses). **Tested in a browser, not seen.**
- **Drawn by the run, not seen**: gems, shots (treats, droplets, yarn, hairballs), the blades, the zone (D41).
- Reviewer: approve with four Low findings (pierce off by one; behaviour tested mostly at level 1; allocation in the hot loop; the dialog's level with several pending), all fixed; re-review approve (D42).
- **Gate** (final code, FULL because `ci.yml` changed): prettier on 7 files, lint 0 warnings, type check, group check, `npm test` 37 files / 530 passed (17 skipped), build — all exit 0. `E2E_SERVER=start npm run test:e2e`: 122 passed. `npm run test:e2e` (next dev), run twice on the same code: each time 121 passed and 1 failed, a different test unrelated to this task each time (`customers.spec.ts:36` `toHaveValue`; then `keyboard.spec.ts:97` `toHaveURL`); each passed 5 of 5 run alone (Q7). Before the review fixes, the same gate passed in full on both servers (122 each). Committed on that evidence: the protocol reruns a flake alone rather than the suite until it passes, and says so here instead of calling the gate clean.
