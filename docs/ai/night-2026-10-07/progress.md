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

## T8 — The cats escalate: varieties and a boss (completed)

- Branch `night-2026-10-07-t8-varieties`, base `eda85d0`. Start 20:17 (budget ~14,124,000); completed 21:01 (budget ~13,911,000).
- **CI of T7** (`eda85d0`): **task-branch run passed** ([run](https://github.com/lazurq-png/Xenocats/actions/runs/37665677397)). The run-branch run of the same commit was **cancelled** ([run](https://github.com/lazurq-png/Xenocats/actions/runs/37665681753)), so its result was not observed. The tree is the same one that passed.
- **What the code does**
  - `app/ui/xenocats/varieties.ts` (new): nine varieties, each with its own pace, Homesickness, drain, size, gait and immunities:
    - Basic.
    - Zoomies: zigzags.
    - Hissing: charges.
    - Fat.
    - Kitten: comes in swarms.
    - Box Cat: sits.
    - Laser Cat: fires from range.
    - Possessed: immune to the two laser weapons.
    - Mega Cat: the boss.
    
    It also holds the schedule that brings them in over five minutes, with kitten swarms from 0:45 and Mega Cats at 2:00 and 4:00.
  - `app/ui/xenocats/arena.ts`:
    - Arrivals are drawn from the schedule by weight. The 20 xenocat types stay in the mix and still supply the elites.
    - Each cat moves by its gait, and a cat's size counts for every weapon and for touch.
    - Possessed immunity applies through one `hurt()`. Laser Cat shots drain his Resolve.
    - Mega Cat, a xenocat elite or a swarm's last kitten drops a chest, and walking over one gives a level-up.
    - `state().boss` exposes the oldest Mega Cat on the field.
    - Sitting cats appear on the screen, and cats left far behind are brought round again.
    - Big cats are searched from their own short list, and the Laser Cat shots are pooled.
  - `app/ui/xenocats/arena-view.tsx`:
    - Each variety is drawn at its size, along with chests and the red shots.
    - A labelled Mega Cat meter appears at the top ("Homesickness N%"). It does not block touches.
    - The boss and chests have sounds.
    - A `?boss=` test hook (D46).
  - `app/ui/xenocats/arena-art.ts`: one sitting-cat drawing dressed nine ways.
  - Tests:
    - `tests/unit/xenocats/varieties.test.ts` (new, 17): each variety's speed, durability and behaviour; Possessed immunity; Laser Cat shots; swarm size and the hard cap; each variety first appearing in its window in a seeded run; the boss's arrival, chest and bar; Box Cats on screen (desktop and a 390×844 phone); no pile-up and no straggler at 4:30.
    - `arena.test.ts` and `arsenal.test.ts`: presets keep them on xenocats only (D47).
    - `survival.spec.ts`: a Mega Cat arrives (`?boss=3`) and its meter shows. The level-up tests tolerate queued level-ups.
    - CI's games group names the new unit test.
- **Why it was added**: plan task 8 (D43–D50).
- **Acceptance criteria**
  - Covered by the unit tests and the browser test above: all of the task's list.
  - Checked by reading only: how the drawings look, and the balance (first guesses).
  - **Tested in a browser, not seen.**
- **Drawn by the run, not seen**: the nine variety cats, chests and the Laser Cats' shots (D48). For a human to look at on a phone: whether the HUD wraps over the Mega Cat's bar (D50).
- **Reviewer**: request changes with five findings (Box Cats piling up off screen, Med; the bar over the movement pad; grid searches widened by the boss's size; the bar jumping between two bosses; swarm cap and shot pooling). All were fixed and tested (D49). Re-review: approve with two Low findings (a sitting cat off a narrow phone screen; an unused constant), both fixed (D50).
- **Gate**
  - Full gate, after the D49 fixes (`GATE_FULL=1`), all exit 0:
    - Prettier on 10 files, lint 0 warnings, type check, group check, actionlint 0.
    - `npm test`: 38 files, 546 passed (17 skipped).
    - Build.
    - `npm run test:e2e`: 123 passed.
    - `E2E_SERVER=start npm run test:e2e`: 123 passed.
  - Final code, after the D50 fixes, all exit 0:
    - Prettier, lint 0 warnings, type check, group check, build.
    - Affected unit tests (`vitest related`): 3 files, 69 passed.
    - Affected browser specs (12, survival included): 92 passed.
  - An earlier gate run stopped at prettier on `decisions.md`. That state file was not prettier-formatted at base, and earlier gates never included it, so it was left out of the rerun.

## T9 — Weapon evolution (completed)

- Branch `night-2026-10-07-t9-evolution`, base `e46787d`. Start 21:01 (budget ~13,911,000); completed 21:17 (budget ~13,828,000).
- **CI of T8** (`e46787d`): **CI passed** on both branches ([task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37671323802), [run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37671324124)).
- **What the code does**
  - `app/ui/xenocats/arsenal.ts`:
    - Three evolved weapons:
      - **Infinite Laser** (a constant web of beams, joined cat to cat).
      - **Forbidden Catnip Vacuum** (pulls every cat from far off, then sends those close home at once).
      - **Yarn Apocalypse** (balls that split at each bounce, up to a limit).
    - `EVOLUTIONS` pairs Laser Pointer + Battery, Vacuum Cleaner + Catnip and Yarn Ball + Scissors.
    - `evolutionFor()` checks the conditions: weapon at level 8, passive held, not evolved already.
    - `BASE_WEAPONS` lists the only weapons a level-up offers. A weapon that has evolved is never offered again.
    - `evolutionText()` gives the announcement.
  - `app/ui/xenocats/arena.ts`:
    - Opening a chest while a pair is ready evolves the weapon in place of the level-up. The evolved weapon takes the base one's place and slot, and an `evolution` event is sent.
    - New weapon kinds `web` and `gulp`, and the yarn's splitting.
    - A config-only `startingPassives` for the tests.
  - `app/ui/xenocats/arena-view.tsx`: the announcement is a `role="status"` line ("The Yarn Ball is no more. In its place: the Yarn Apocalypse."), shown for 5 s with a sound. The Apocalypse's balls are drawn in a deeper pink.
  - Tests: 20 new in `tests/unit/xenocats/arsenal.test.ts`:
    - Each pair evolves with all three parts, but not one level short, not without the passive, and not without a chest.
    - The evolved weapon replaces the base one.
    - The pure rule, and that neither an evolved weapon nor an evolved-away base weapon is ever offered.
    - The announcement's text.
    - Each evolved weapon's behaviour: the web's count, joins and continuity; the vacuum's far pull and its burst of at least 10 cats at once; the yarn splitting beyond its throw and splits heading back onto the screen.
    - The per-weapon "grows with its levels" test now covers the base weapons only.
- **Why it was added**: plan task 9 (D51–D55).
- **Acceptance criteria**
  - Covered by the unit tests: all of the task's list except the e2e item.
  - **E2E: none.** As the task allows, evolutions are recorded as covered by unit tests only (D54).
  - The announcement in the page is **built, not seen**, and not browser-tested.
  - Checked by reading only: how the evolved weapons look, and their balance.
- **Drawn by the run**: nothing new. The evolved weapons reuse the beams and the yarn.
- **Reviewer**: request changes with three findings (Med: the base weapon re-offered after evolving; Low: yarn splits spent at the edge; Low: D52's cap wording). All were fixed, and the two code fixes are tested; both tests failed with the fixes removed (D55). Re-review: approve, no findings.
- **Gate** (final code; the selection, not FULL, as nothing outside the game changed). All exit 0:
  - Prettier on 4 files, lint 0 warnings, type check, group check, build.
  - Affected unit tests: 3 files, 89 passed.
  - Affected browser specs (12, survival included): 92 passed.
  - The same gate also passed on the code before the review fixes (87 unit, 92 e2e).

## T10 — Persistent progression and unlocks (completed)

- Branch `night-2026-10-07-t10-progression`, base `82fabe3`. Start 21:18 (budget ~13,825,000); completed 00:37 (budget ~13,730,000).
- **Gap: about 21:30 to 00:20, nothing ran.** The session hit its usage limit ("You've hit your session limit · resets 12:20am"). The first reviewer stopped with that error. The gate had finished at 21:31 (one browser test failed; see Gate), and work resumed at 00:20.
- **CI of T9** (`82fabe3`):
  - [Task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37673322361): **passed**.
  - [Run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37673321921): **cancelled**. Its result was not observed; it ran the same tree.
- **What the code does**
  - `app/ui/xenocats/progression.ts` (new):
    - **Tufts of fur**: one for every 5 s survived and one for every 20 cats sent home.
    - **Milestones**: survive 2:00 and 3:00, send 1000 home in a run, reach level 20. Three of them unlock a weapon (Thunderous Vacuum, Laser Pointer Deluxe, Hairball); the first unlocks a character.
    - **The Tailor**: five upgrades with rising costs (Stubbornness, Sternness, Brisk Step, Long Arms, Second Wind).
    - **Three characters**:
      - The Keeper: free.
      - The Night Porter: Spray Bottle, faster, frailer; unlocked by surviving 2:00.
      - The Housekeeper: Vacuum Cleaner, sturdier, slower; engaged for 150 tufts.
    - **The codex.**
    - `applyRun` and `runConfig`.
    - Versioned storage: `xenocats:survival:v1:progress`. Corrupt data or another version reads as a fresh start; bad entries are dropped one by one.
  - `app/ui/xenocats/progression-view.tsx` (new): the start screen's panel. It shows the tufts, a character radio group, the Tailor's buttons (`aria-disabled` when they cannot be used) and the codex ("???" until found).
  - `arena.ts`:
    - New config: `availableWeapons` (locked weapons are never offered), `boost` (might, pickup reach, revivals) and `secretCat`.
    - Second Wind revives him once.
    - The secret cat comes once a run to a Keeper standing still for 20 s after the first minute. It drains nothing.
    - Every circling weapon's blades are drawn.
  - `arsenal.ts`: the hidden evolution, Can Opener + Warm Milk → Bottomless Saucer.
  - `varieties.ts` and `arena-art.ts`: the Neighbour's Cat, and `heroSvg` with the two re-dressed characters.
  - `arena-view.tsx`:
    - A run starts from the stored progress and is applied to it when it ends.
    - The results show the tufts gathered and the milestones reached, with what they unlocked.
    - The Second Wind notice.
    - The intro line no longer names one weapon.
  - Tests:
    - `tests/unit/xenocats/progression.test.ts` (new, 22) covers earning, milestones, locked weapons in a run, the Tailor, characters, the codex, the hidden evolution by a chest, the secret cat's condition and its harmlessness, Second Wind, and storage (round trip, corrupt data, dropped entries, versions 0, 2 and none, the browser store, blocked storage).
    - `survival.spec.ts`: a run gathers tufts, kept after a reload. The Tailor sells Stubbornness, it is kept after a reload, and the next run starts with 110 Resolve.
    - `varieties.test.ts` turns the secret cat off.
    - CI's games group names the new unit test.
- **Why it was added**: plan task 10 (D56–D64). The secrets are recorded in D60 and nowhere in the UI.
- **Acceptance criteria**
  - Covered by tests: all of the task's list.
  - Choosing a character and the codex in the page: unit tests of their rules only.
  - **Tested in a browser, not seen.** A human should look at the start-screen panel at phone and desktop width.
- **Drawn by the run, not seen**: the Night Porter and the Housekeeper (the hero re-dressed), and the Neighbour's Cat (D61).
- **Reviewer**:
  - First review: approve with six Low findings: the secret cat counted as a hit; "the The Bottomless Saucer"; disabled buttons that looked enabled; focus lost when a button vanished; the intro's Laser Pointer; a weak assertion. All were fixed (D63). The contact fix's test failed with the fix removed.
  - Re-review: approve, no findings.
- **Gate**
  - First full gate (21:31): `npm run test:e2e` had 1 failed and 124 passed. The new Tailor test asserted that a 17-tuft upgrade was buyable with 15 tufts left, which was a test bug (repair cycle 1, D64).
  - Full gate after the fix (`GATE_FULL=1`, as `ci.yml` changed), all exit 0:
    - Actionlint 0, prettier on 11 files, lint 0 warnings, type check, group check.
    - `npm test`: 39 files, 592 passed (17 skipped).
    - Build.
    - `npm run test:e2e`: 125 passed.
    - `E2E_SERVER=start npm run test:e2e`: 125 passed.
  - Final code, after the review fixes (the affected selection), all exit 0:
    - Prettier, lint, type check, group check, build.
    - Unit: 4 files, 115 passed.
    - Browser: 94 passed.

## T11 — Local co-op for two (completed)

- Branch `night-2026-10-07-t11-coop`, base `07e46e4`. Start 00:38 (budget ~13,727,000); completed 01:03 (budget ~13,617,000).
- **CI of T10** (`07e46e4`): **CI passed** on both branches ([task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37697284595), [run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37697284251)).
- **What the code does**
  - `app/ui/xenocats/arena.ts`:
    - One `Keeper` record per player: position, the character's pace and Resolve, effect, weapons, passives, modifiers, revivals, and when he went down. The code runs per Keeper through a `hero` binding, so one player plays exactly as before. Every existing unit test, seeded runs included, passed unchanged after the restructure.
    - New: `config.secondPlayer`, `config.coop` (start gap, `maxZoomOut` 1.6, margin, `reviveMs` 30 s) and `step(input, spawn, input2)`.
    - A shared `camera()` between the two, zooming out to the limit. A tether keeps them within the widest view; it only holds back a step's added distance and never makes a Keeper jump.
    - Cats, Laser Cat shots and the Matriarch go for the nearest standing Keeper. Arrivals, sitting cats and the Yarn's bounces work from the camera's screen.
    - **Downed** Keepers lie still. They stand again after 30 s if the other lasts. The run ends when none stands.
    - Level-ups and chests ask player 1, then player 2 (`chooser()`), each from his own arsenal. Gems are shared, flying to the nearest Keeper.
    - Events: `downed`; `revived` says whose and how; `hero-hit` says whose.
    - `zones()` replaces `zone()`.
  - `app/ui/xenocats/walking.ts`: `PLAYER_KEYS` (WASD, arrows) and `walkDirection(held, only)`.
  - `app/ui/xenocats/progression.ts`: `runConfig(progress, base, second)` builds player 2 from a character player 1 has, with the Tailor's work.
  - `app/ui/xenocats/arena-view.tsx`:
    - The start screen's "Keepers" choice (One / Two, at one keyboard) and "Player 2 goes out as", keyboard only. On touch, one Keeper.
    - Each player's keys; drawing through the zoomed camera; both Keepers, marked P1/P2, a downed one lying pale.
    - "Player 2 Resolve" with "Down, back in N s".
    - The level-up dialog says whose turn it is and is remounted for each turn, so it is announced.
    - Notices for downed and revived.
    - The results list both Keepers (character, weapons, down at the end).
    - Test attributes: `data-players`, `data-chooser`, `data-hero2-x`, `data-hero2-y`, `data-down`.
  - Tests:
    - `tests/unit/xenocats/coop.test.ts` (new, 12):
      - The keys, and each input walking its own Keeper.
      - Own weapons; alone, one Keeper.
      - The camera between them and zooming to its limit; the tether; no jump when the window shrinks.
      - The turn order at a level-up, each choice his own; one experience bar.
      - Downed and revived at 30 s; a downed Keeper still; both down ends the run.
    - `progression.test.ts`: player 2's config.
    - `survival.spec.ts`: two Keepers start, D walks only player 1 and the left arrow only player 2, and a level-up asks player 1 then player 2 for the same level (the dialog named for player 2, focus in it).
    - CI's games group names `coop`.
- **Why it was added**: plan task 11 (D65–D71).
- **Acceptance criteria**
  - Covered by tests: all of the task's list.
  - Built, not seen or browser-tested: the camera's zoom on screen, the downed/revived notices and the co-op results.
  - **Tested in a browser, not seen.**
  - Known trade (reviewer's note): after a window shrink or an elite's teleport at full span, a Keeper may stay partly off the screen until they walk closer. They are not pulled together, only kept from parting further.
- **Drawn by the run**: nothing new. The "P1"/"P2" labels are text on the canvas.
- **Reviewer**:
  - First review: request changes. Medium: player 2's turn not announced. Low: the downed notice's hard-coded seconds; a jump when the window shrank; player 2's config untested; a dead accessor. All were fixed (D71), and the jump's test failed with the fix removed.
  - Re-review: approve, two notes (above, and an exact float comparison that passes).
- **Gate**
  - Full gate before the review fixes (`GATE_FULL=1`, as `ci.yml` changed), all exit 0:
    - Actionlint 0, prettier on 7 files, lint 0 warnings, type check, group check.
    - `npm test`: 40 files, 604 passed (17 skipped).
    - Build.
    - `npm run test:e2e`: 126 passed.
    - `E2E_SERVER=start npm run test:e2e`: 126 passed.
  - Final code, after the review fixes (the affected selection), all exit 0:
    - Prettier on 8 files, lint, type check, group check, build.
    - Unit: 9 files, 162 passed.
    - Browser: 95 passed.
  - One run of `survival.spec.ts` alone, on a cold dev server during development, failed the Mega Cat test's first assertion (no boss yet). The run had reached 13 s before the first read, past the boss at 3 s. The next run, and every gate since, passed it. Recorded, not changed.

## Checkpoint 2 (completed)

- Branch `night-2026-10-07-c2-checkpoint`, base `1f4e3ea`; covers `0153196..1f4e3ea` (T6–T11). Start 01:04 (budget ~13,613,000); completed 01:18 (budget ~13,573,000).
- **CI of T11** (`1f4e3ea`): **CI passed** on both branches ([run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37699958601), [task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37699958188)).
- **1. Tests.** Every behaviour changed in the range was checked against a test that would fail without it (D72).
  - **Added:**
    - The start-screen panel in the page: choosing a character, and the codex (`survival.spec.ts`).
    - Every drawing is a whole SVG (`varieties.test.ts`).
    - In co-op: a downed Keeper does not fire or get touched and the cats walk at the other; a chest evolves the opener's weapon; a teleport cannot carry a Keeper past the tether. Each failed with its guard removed.
  - **Rewritten:** two co-op tests that could not fail for what they claimed ("one experience bar", "each choice is his own").
  - **Removed:** nothing.
  - **Covered by reading only, newly recorded:** the results' "Now available" line, `testHooks()`'s handling of bad values, and Laser Cat shots skipping a downed Keeper.
- **2. Quality and security.** The reviewer read the whole range with `.claude/rules/security-review.md` in scope: the URL hooks, stored progress, markup, listeners and timers, and the per-step loop.
  - Approve, with six Low findings, all acted on (D73):
    1. A camera object built per cat per step since T11.
    2. A teleport past the tether in co-op.
    3. Tests missing for a downed Keeper and the chest opener.
    4. The "one experience bar" test could not fail.
    5. The "each choice is his own" assertion was weak.
    6. Stale headers and comments (the arena's, the art's, the player sprite's), plus a dead export and an unread attribute.
  - Re-review: approve, no findings. **No security finding.**
- **What changed** (code):
  - `arena.ts`: the camera once a step; the tether after a teleport; `heroes[].passives`; `secondPlayer.startingPassives` (config, for a test); the header and `step` doc.
  - `arena-art.ts`: the header, and the unused `HERO_SVG` removed.
  - `arena-view.tsx`: `data-best-key` and its import removed.
  - `player-sprite.tsx`: comments only.
  - The tests above.
- **Verification** (a full-suite point; `GATE_FULL=1`), all exit 0:
  - Prettier on 7 files, lint 0 warnings, type check, group check.
  - `npm test`: 40 files, 609 passed (17 skipped).
  - Build.
  - `npm run test:e2e`: 127 passed.
  - `E2E_SERVER=start npm run test:e2e`: 127 passed.

## T12 item 1 — started 01:19: a comforting cat (kind: the Survival game)

A new variety whose behaviour changes how a run plays: a cat that purrs, and every cat near it forgets a little of its homesickness, so the horde around it is slow to send home until it is dealt with first. Its own run-drawn SVG, a place in the schedule, unit tests of its behaviour.

## T12 item 1 — the Purring Cat (completed)

- Branch `night-2026-10-07-t12-1-comforter`, base `b9eec4a`. Start 01:19 (budget ~13,571,000); completed 01:33 (budget ~13,535,000).
- **CI of checkpoint 2** (`b9eec4a`): **CI passed** on both branches ([task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37701496841), [run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37701496164)).
- **What the code does**
  - `varieties.ts`: a new variety, **the Purring Cat** (D74). It walks at him and has 260 Homesickness. Every cat within 140 px of it loses 12 Homesickness a second, several Purring Cats adding up and none soothing another. It is in the schedule from 2:10, rarer than most.
  - `arena.ts`: `soothe()` applies the comfort once a step, after the cats move and before the weapons.
  - `arena-art.ts`: its drawing.
  - `arena-view.tsx`: a faint warm halo, drawn under everything else.
  - Tests in `varieties.test.ts`:
    - The exact comfort between the Vacuum Cleaner's firings: each cat in reach loses exactly 12 a second per Purring Cat, and every other cat keeps its own. Both the "several add up" case and the "a Purring Cat in another's reach" case are shown to occur. The test failed with the comfort switched off.
    - Its place in the schedule.
  - The seeded schedule test gives a rare variety longer in proportion to its weight (D74).
- **Why it was added**: plan task 12, an exploration item of the kind "the Survival game".
- **Acceptance**
  - The behaviour is unit-tested, exactly.
  - **Built, not seen**: the drawing and the halo.
  - The balance is a first guess (D75, D76). A Purring Cat must be sent home first, or met with more than one weapon's first level.
- **Drawn by the run, not seen**: the Purring Cat (a long-haired cream cat, eyes closed, purring arcs) and its halo.
- **Reviewer**
  - First review: approve, four Low findings, all acted on (D75):
    - it was a "big cat" searched everywhere;
    - its halo was drawn over gems and chests;
    - its comfort cancelled the Laser Pointer's first level;
    - the test did not show its overlap cases occurring.
  - Re-review: approve, one wording note acted on (D76).
- **Gate** (the selection), all exit 0:
  - Prettier, lint 0 warnings, type check, group check, build.
  - Unit: 5 files, 133 passed.
  - Browser: 96 passed.
  - The gate ran on the code before the review fixes and again after them, passing both times. After the second run only a comment changed (D76); prettier, lint and the type check passed on it.

## T12 item 2 — started 01:37: a due date on the invoice forms (kind: dashboard features)

The 2026-10-01 run's Q4: every invoice is due 30 days after its date, and the forms neither show nor change it. The create and edit forms get a due-date field (30 days by default), validated not before the invoice's date and not absurdly far after it, with the database's check as the last word.

## T12 item 2 — a due date on the invoice forms (completed)

- Branch `night-2026-10-07-t12-2-due-date`, base `b754102`. Start 01:37 (budget ~13,530,000); completed 01:46 (budget ~13,473,000).
- **CI of T12 item 1** (`b754102`): **CI passed** on both branches ([task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37702759354), [run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37702759276)).
- **What the code does** (D77, D78)
  - The create and edit invoice forms have a "Due date" field. On create it defaults to 30 days after today, worked out on the server; on edit it shows the stored date. Its errors appear in its own described region.
  - The Server Actions validate it:
    - a real calendar date (zod);
    - not before the invoice's date;
    - at most a year after it.
  - `createInvoice` stores it instead of always "date + 30". `updateInvoice` reads the invoice's own date to check against, and stores it.
  - The database's own check (`invoices_due_date_check`) becomes the field's error, not "Database Error".
  - `updateInvoice` now refuses a non-UUID id. It answers "No such invoice." for an unknown one, or one deleted between its read and its write.
  - `fetchInvoiceById` returns the two dates.
  - No migration.
- **Why it was added**: plan task 12, an exploration item of the kind "dashboard features". It answers the 2026-10-01 run's Q4.
- **Tests**:
  - `schemas.test.ts`: the due date's format, real dates, `addDays`, the bounds.
  - `actions.test.ts`: create and update store it; out-of-range dates refused with nothing written; the database's check reported as the field's error; bad, unknown or vanished ids.
  - `invoices.spec.ts`: the 30-day default, a chosen date kept, one before the invoice's date refused in its error region, a later one saved.
  - **`data.test.ts`'s expectation for `fetchInvoiceById` was updated but not run.** That file is opt-in, and this run may not run it; CI's "Database tests" step is its check.
- **Acceptance**: the task's words are covered by the tests above. **Tested in a browser, not seen**: a human should look at the forms' new field at phone and desktop width.
- **Reviewer** (security, backend, frontend and database rules in scope): approve, three Low findings.
  - Fixed: an invoice deleted mid-update was reported saved (now tested).
  - Fixed: the edit form's help text described creation.
  - Recorded: invoices are dated by the UTC day (D78).
  - **No security finding.** The session is checked first, the input is validated, error messages are fixed strings, and SQL is parameterised.
- **Gate** (the selection), all exit 0:
  - Prettier on 11 files, lint 0 warnings, type check, group check, build.
  - Unit: 3 files, 79 passed (`data.test.ts` skipped, opt-in).
  - Browser: 52 passed.
  - The same gate passed on the code before the review fixes.

## T12 item 3 — started 01:47: tests for what checkpoint 2 left to reading (kind: tests)

Checkpoint 2 recorded three Survival behaviours covered by reading only: the URL test hooks' handling of bad values (`testHooks()`), the results' "Now available: …" line (`unlockedBy`), and Laser Cat shots passing over a downed Keeper. The first two move out of the page into pure functions so they can be tested; all three get unit tests.

## T12 item 3 — tests for what checkpoint 2 left to reading (completed)

- Branch `night-2026-10-07-t12-3-tests`, base `1af4360`. Start 01:47 (budget ~13,470,000); completed 01:55 (budget ~13,453,000).
- **CI of T12 item 2** (`1af4360`): the poll was still running at this commit. The result goes into the next entry, including the "Database tests" step, which is the only check of `data.test.ts`'s new expectation.
- **What changed** (D79)
  - `testHooks()` moved from `arena-view.tsx` into `test-hooks.ts` as `parseTestHooks(search, freshSeed)`, unchanged.
  - `unlockedBy` moved into `progression.ts`, unchanged.
  - New tests:
    - `test-hooks.test.ts` (new, 5, in CI's games group): every hook and every kind of bad value.
    - `progression.test.ts`: the "Now available" line for each milestone.
    - `coop.test.ts`: Laser Cat shots cross a downed Keeper without hitting him. This test failed with the guard removed.
- **Why it was added**: plan task 12, an exploration item of the kind "tests". It closes D72's "covered by reading only" list.
- **Reviewer**: approve, no findings. It traced every hook case and the shot test against the code.
- **Gate** (FULL, as `ci.yml` changed), all exit 0:
  - Actionlint 0, prettier on 7 files, lint 0 warnings, type check, group check.
  - `npm test`: 41 files, 630 passed (17 skipped).
  - Build.
  - `npm run test:e2e`: 128 passed.
  - `E2E_SERVER=start npm run test:e2e`: 128 passed.

## T12 item 4 — started 01:56: an unknown email takes as long as a wrong password (kind: security and quality)

The 2026-10-01 run's Q7 noted that a login for an email with no account skips the bcrypt comparison, so it answers measurably faster than a wrong password for a real one, which tells an attacker which emails have accounts. The sign-in will compare against a hash of an unknown string in that case too.

## T12 item 4 — an unknown email takes as long as a wrong password (completed)

- Branch `night-2026-10-07-t12-4-login-timing`, base `59bc71b`. Start 01:56 (budget ~13,451,000); completed 02:12 (budget ~13,422,000).
- **CI of T12 item 2** (`1af4360`): **CI passed** on both branches ([task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37704078471), [run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37704078436)). This includes the build job's "Database tests" step, so `data.test.ts`'s new `fetchInvoiceById` expectation, which this run could not run, passed on CI's database.
- **CI of T12 item 3** (`59bc71b`): **CI passed** on both branches ([run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37704925232), [task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37704925983)).
- **What the code does** (D80, D81)
  - A login for an email with no account now makes the same one bcrypt comparison as a wrong password. It compares against a hash of a random string, made when the server starts, at the stored hashes' cost. The response time therefore no longer tells which emails have accounts.
  - The sign-in's decision moved from `auth.ts` into `app/lib/credentials.ts` (`checkCredentials`), unchanged in behaviour.
  - `app/lib/password-check.ts` (new) holds `passwordMatches` and `BCRYPT_COST`. The password change uses the constant.
- **Why it was added**: plan task 12, an exploration item of the kind "security and quality". It is the 2026-10-01 run's Q7, last point. Left from that Q7: a limit per client address, and pruning `login_failures`.
- **Tests**
  - `password-check.test.ts` (new, 3): right and wrong passwords; an unknown email still makes one comparison at the stored cost; the seed's cost.
  - `credentials.test.ts` (new, 4), against a fake database with real bcrypt:
    - the right password signs in and clears failures;
    - a wrong password and an unknown email each cost exactly one comparison;
    - a locked email is refused before any comparison;
    - malformed credentials reach nothing.
  - Both are in CI's unit group. Each failed with the fix it guards removed: the comparison skipped, or the call site changed to skip unknown users.
  - The timing itself is not measured, since a timing assertion would be flaky. The tests pin the work done instead.
- **Reviewer** (security rules in scope): approve, two Low findings, both acted on (D81): the first unknown email in a process did twice the work, and no test guarded the sign-in's call site. Re-review: approve, no findings.
- **Gate** (FULL: `ci.yml` and the sign-in changed), all exit 0:
  - Actionlint 0, prettier on 7 files, lint 0 warnings, type check, group check.
  - `npm test`: 43 files, 637 passed (17 skipped).
  - Build.
  - `npm run test:e2e`: 128 passed, the login and lockout browser tests included.
  - `E2E_SERVER=start npm run test:e2e`: 128 passed.

## T12 item 5 — started 02:24: cats left off screen when the window shrinks (kind: cat behaviour bugs)

`engine.resize` only records the new size: a cat placed near the right or bottom edge of a wider window stays where it was when the window narrows (or a phone turns from landscape to portrait) — off the screen, where it sleeps unseen, cannot be petted or clicked, attacks a spot where nothing is, and still counts toward the five on screen. Cats will be kept on the screen when it changes size.

## T12 item 5 — cats kept on screen when it narrows (completed)

- Branch `night-2026-10-07-t12-5-cats-on-resize`, base `a47938f`. Start 02:24 (budget ~13,420,000); completed 02:33 (budget ~13,369,000).
- **CI of T12 item 4** (`a47938f`): **CI passed** on both branches ([task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37706457233), [run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37706456752)).
- **The bug** (D82): when the window narrowed, or a phone turned upright, cats near the old right or bottom edge were left off the screen. There they slept unseen, could be neither petted nor woken, attacked a spot where nothing is, and still counted toward the five.
- **What the code does** (D82–D84)
  - `cat-engine.ts` `resize` moves any cat the new screen no longer holds in to its edge. If that spot is taken, it slides along the edges to the nearest free one; where there is none (a tiny screen), the cats share. A cat that fits is left where it is.
  - `cat-layer.tsx` redraws when a cat moved, and gives the engine the page's own size, which excludes a scrollbar.
- **Why it was added**: plan task 12, an exploration item of the kind "cat behaviour bugs". The bug was found by reading the engine.
- **Tests**
  - `cat-engine.test.ts`: narrowed to 300 × 600, each cat is inside, none overlap, and those that fitted are unmoved; widening moves nothing; on a screen smaller than a cat, every cat sits at its corner. The first failed without the fix, and the no-overlap check failed without the slide.
  - `cats.spec.ts`: four sleeping cats summoned from the keyboard on a 1280 px window, then the window narrowed to 300 × 700. Every cat is still there and drawn inside. This failed without the fix and passed 3 of 3 runs with it.
- **Not changed, sent to a human (questions.md Q8)**: after a background tab returns, a cat whose sleep ran out pounces at once without the waking warning. That behaviour is deliberate and tested in the engine, so it is a product question.
- **Known limit** (D84): a scrollbar that appears without a resize is not noticed until the next resize. This is never worse than before.
- **Reviewer**
  - First review: approve, three Low and a nit, all acted on (D83): cats stacking at the edge, the scrollbar, a test that could pass with no cats, the tiny screen.
  - Re-review: approve, two Low: a test made immune to a click waking a cat; the scrollbar limit recorded (D84).
- **Gate** (the selection, every browser spec, as the cat layer is on every page), all exit 0:
  - Prettier, lint 0 warnings, type check, group check, build.
  - Unit: 5 files, 60 passed.
  - Browser: 129 passed.

## Checkpoint 3 (completed)

- Branch `night-2026-10-07-c3-checkpoint`, base `145ff32`; covers `b9eec4a..145ff32` (T12 items 1–5). Start 02:34 (budget ~13,366,000); completed 05:33 (budget ~13,350,000).
- **Gap: about 02:35 to 05:20, nothing ran.** The session hit its usage limit again ("resets 5:20am"). The first range reviewer stopped with that error, and the review was redone at 05:20.
- **CI of T12 item 5** (`145ff32`): **CI passed** on both branches ([task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37708326382), [run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37708326018)).
- **1. Tests.** Every behaviour changed in the range has a test that fails without it; each item's entry names them.
  - **Added:** `updateInvoice` turning the database's due-date check into the field's error (the create path already had one). It failed with that branch disabled.
  - **Removed:** nothing. No test is of removed behaviour, a duplicate, or unable to fail.
  - **Covered by reading only, recorded:** the cats' screen measured from the page's client size (D85).
- **2. Quality and security.** The reviewer read the whole range with `.claude/rules/security-review.md` in scope: the actions, the sign-in and its timing, the forms and data, the cat engine, the arena, and how the items interact.
  - **No security or correctness finding.**
  - Three Low findings, all acted on (D85): the test above; the edit form now names the invoice date it was given but did not use; the reading-only note.
- **What changed** (code): `app/ui/invoices/edit-form.tsx` (help text) and `tests/unit/actions.test.ts`.
- **Verification** (a full-suite point; `GATE_FULL=1`), all exit 0:
  - Prettier, lint 0 warnings, type check, group check.
  - `npm test`: 43 files, 640 passed (17 skipped).
  - Build.
  - `npm run test:e2e`: 129 passed.
  - `E2E_SERVER=start npm run test:e2e`: 129 passed.
