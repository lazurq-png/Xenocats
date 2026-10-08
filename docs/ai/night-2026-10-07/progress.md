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
- **Why it was added**: plan task 2. The mapping table is D4; calm through the same engine D5; staying on screen D6; twists removed D7; the `style=""` fix D8; clicks never blocked D9 (Q2, confirmed as intended); five cats now leave elements alone (Q3).
- **Verification** (gate run alone, 15:14–15:20; the selector printed FULL because of `global.css`, so every suite ran in full)
  - prettier (LF-normalised) on the 11 changed files: clean. `npm run lint` exit 0, 0 warnings (= baseline). `next typegen && tsc --noEmit` exit 0.
  - `npm test` (plain, since T1): 34 files passed, 1 skipped; 493 tests passed, 17 skipped (the database tests, opt-in).
  - `npm run build` exit 0. `npm run test:e2e` (next dev): 120 passed. `E2E_SERVER=start npm run test:e2e`: 120 passed.
  - An earlier gate run (before the review fixes) had lint, type check, unit and build green, then lost its `next dev` server mid-suite (49 tests failed at 0 ms) while the reviewer ran vitest in parallel. It was stopped for the review fixes; the reviewer's re-check then ran read-only.
  - Acceptance criteria: 1–5 and 7 checked by command (the unit table, the per-cat e2e tests); 3 (the table in decisions.md) by reading too; 6, exact revert, by command (unit and per-cat e2e, which found D8); focused fields by the existing `pickTargets` unit test; clicks not blocked, as intended (Q2). **Tested in a browser, not seen**: nobody has looked at how the smoke, frost or bouncing look on the dashboard pages.
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

## T12 item 6 — started 05:34: two more evolution pairs (kind: the Survival game)

New evolution pairs for two base weapons that had none: Cat Treats with Long Whiskers, and Spray Bottle with Wool Sweater. Each evolved weapon is named in the game's voice and does what its base does at a scale the base never reaches, backed by a seeded simulation test that it sends home more than its base at the top level.

## T12 item 6 — two more evolution pairs (completed)

- Branch `night-2026-10-07-t12-6-evolutions`, base `23b9f87`. Start 05:34 (budget ~13,348,000); completed 05:44 (budget ~13,323,000).
- **CI of checkpoint 3** (`23b9f87`): **CI passed** on both branches ([task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37723213036), [run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37723212965)).
- **What the code does** (D86, D87)
  - **Cat Treats + Long Whiskers → Banquet**: a ring of 39 treats, every 0.5 s.
  - **Spray Bottle + Wool Sweater → Monsoon**: the bottle's arc with 32 bigger, longer-flying droplets.
  - Both are data only on the existing `spread` and `arc` kinds, with their own shot colours. The codex lists seven entries.
  - `evolutionText` no longer puts "the" before a name that brings its own "The".
- **Why it was added**: plan task 12, an exploration item of the kind "the Survival game". Task 9 allowed more pairs.
- **Tests** (`arsenal.test.ts`)
  - The existing evolution tests now cover both pairs: the condition with all three parts, refusal without each part, replacement, never offered.
  - Seeded simulations: each evolved weapon sends home more than 1.5 times what its base does, over 30 s against sturdy cats.
  - The Banquet's throw is a ring: no gap wider than an eighth of a turn, which Cat Treats' fan fails.
  - Every evolution's announcement never reads "the The".
  - `survival.spec.ts`: the codex now counts six "???".
- **Reviewer**: request changes:
  - Medium: the Banquet was a 211° fan with a test that could not tell.
  - Low: "the The Banquet", the second time this run made that slip (T10's D63).
  - Both fixed (D87), the second at its cause.
  - Re-review: approve.
- **Gate** (the selection), all exit 0:
  - Prettier, lint 0 warnings, type check, group check, build.
  - Unit: 5 files, 145 passed.
  - Browser: 97 passed.
  - The same gate passed before the review fixes.

## T12 item 7 — started 05:46: the invoice list shows each invoice's due date (kind: dashboard features)

Item 2 let an invoice be due when its form says; the list still shows only its date, so a chosen due date is visible only on the invoice's own page. The list gains a "Due" column (and a due line on the phone layout).

## T12 item 7 — the invoice list shows due dates (completed)

- Branch `night-2026-10-07-t12-7-due-column`, base `8ab4311`. Start 05:46 (budget ~13,321,000); completed 05:55 (budget ~13,297,000).
- **CI of T12 item 6** (`8ab4311`): **CI passed** on both branches ([run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37724133044), [task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37724133677)).
- **What the code does** (D88, D89)
  - `fetchFilteredInvoices` returns each invoice's due date.
  - The list's table has a "Due" column, and the phone layout a "Due …" line under the date.
  - The table now scrolls sideways on its own where its columns need more room, as the customers table does.
- **Why it was added**: plan task 12, an exploration item of the kind "dashboard features". It follows item 2, where a chosen due date was otherwise visible only on the invoice's own page.
- **Tests**
  - `invoices.spec.ts`: the "Due" header, and the list row showing the due date chosen on the form; at 390 px, the cards show "Due <date>".
  - `data.test.ts` (opt-in; CI runs it): the row carries the seeded due date.
- **Tested in a browser, not seen**: a human should look at the invoice list at 768 and 1024 px (the sideways scroll) and on a phone.
- **Reviewer**: approve, three Low findings: the table's overflow (fixed), dates in the formatting process's time zone (recorded; pre-existing), the phone line untested (tested now). All in D89.
- **Gate** (the selection), all exit 0:
  - Prettier, lint 0 warnings, type check, group check, build.
  - Unit (`data.test.ts` skipped, opt-in).
  - Browser: 53 passed.
  - The same gate passed before the review fixes (52).

## T12 item 8 — started 05:58: the dev-server flakes of Q7 (kind: tests)

This run's Q7 recorded two browser tests that each failed once under the full `next dev` suite and passed when rerun: the customer create/edit/delete test (a `toHaveValue` on the edit form) and the dashboard-by-keyboard test (a `toHaveURL`), both on a dashboard page's first visit, which `next dev` compiles on demand, with the default 5-second wait. Reproduce first; then fix the waits, not the assertions.

## T12 item 8 — the dev-server flakes of Q7 (completed)

- Branch `night-2026-10-07-t12-8-dev-flakes`, base `3f417dc`. Start 05:58 (budget ~13,296,000); completed 06:09 (budget ~13,261,000).
- **CI of T12 item 7** (`3f417dc`): **split result.**
  - [Task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37724939274): **passed** every job.
  - [Run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37724939389) of the same tree: **failed** in the build job's step "Browser tests against next start (invoices)". Its other two jobs passed.
  - Which test failed is not visible without logs. No repair was attempted on an identical tree that passed elsewhere (questions.md Q9).
- **What was found** (D90): reproduced from a cold `.next` under load (eight workers, four repeats). 15 of 28 failed, the snapshots showing the login form still submitting when the 5-second `toHaveURL` ran out. This is a busy `next dev` compiling a route on its first visit, not a defect.
  - At four workers (Playwright's default here) the same cold run passed 28 of 28 before and after the change. The fix's effect on a rare flake cannot be shown statistically in one night, and Q7 stays open.
- **What changed** (D90, D91)
  - In `customers.spec.ts` and `keyboard.spec.ts`, every page-change wait that still had 5 s gets 15 s (`NAVIGATION`). That is the specs' own pattern after a submit. The customer test also checks it reached the edit page, and its overall timeout is 60 s.
  - No assertion was weakened, no global timeout raised, no retry added.
  - The same exposure in ten other specs is left for a plan (Q9).
- **Why it was added**: plan task 12, an exploration item of the kind "tests". It is this run's Q7.
- **Reviewer**: approve, four Low findings: the other specs (recorded, Q9), the test timeout (fixed), a comment (left), "four workers" inexact (corrected, D91).
- **Gate** (the selection), all exit 0: prettier, lint 0 warnings, type check, group check, build; the two specs, 7 passed.

## T12 item 9 — started 06:11: no debug logging of invoice data (kind: security and quality)

`fetchInvoiceById` still printed every invoice it loaded (`console.log(invoice)`: its customer, amount and status) to the server's log each time an invoice's edit page opened — data the logs need not hold (the security rules: never log unnecessary personal information). The line goes, and a lint rule keeps debug logging out of the app's code.

## T12 item 9 — no debug logging of invoice data (completed)

- Branch `night-2026-10-07-t12-9-no-debug-log`, base `93c9524`. Start 06:11 (budget ~13,260,000); completed 06:37 (budget ~13,234,000).
- **CI of T12 item 8** (`93c9524`): **CI passed** on both branches ([task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37726072663), [run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37726072950)).
- **What the code does** (D92)
  - `fetchInvoiceById` no longer prints each invoice it loads to the server's log.
  - ESLint's `no-console` now holds the app's own code to `console.error` and `console.warn`. The rule failed on the leftover line before its removal.
- **Why it was added**: plan task 12, an exploration item of the kind "security and quality". The security rules forbid unnecessary personal or financial data in logs.
- **Also fixed: two regressions from item 7's tests**, found by this item's full-suite gate (D93, D94). Both were browser tests meeting `next start`'s streamed pages:
  - the filter spec's "Due" check matched the list's new column heading;
  - item 7's own row check did not first wait for exactly one row.
  - Each was fixed in the test, and each passed repeated runs against `next start` (20 of 20, then 40 of 40).
  - The first is almost certainly item 7's run-branch CI failure (Q9, now explained).
  - Item 7's gate had run only `next dev`'s affected specs, which is why it missed them.
- **Reviewer** (security rules in scope): approve, no findings. It confirmed that the `postgres` library keeps a failed query's text and parameters out of printed errors unless debug is on. One caveat, recorded: a database error's `detail` can quote a refused row's values, and no current path leaks anything sensitive that way. The two test repairs came after the review and were not re-reviewed (small, test-only, D93/D94).
- **Gate** (FULL: lint configuration changed), on the third run, all exit 0:
  - Prettier on 4 files, lint 0 warnings, type check, group check.
  - `npm test`: 43 files, 650 passed (17 skipped).
  - Build.
  - `npm run test:e2e`: 130 passed.
  - `E2E_SERVER=start npm run test:e2e`: 130 passed.
  - The first two runs each failed one `next start` browser test (the regressions above): repair cycles 1 and 2, on different failures.

## T12 item 10 — started 06:40: looking for cat behaviour bugs by random play (kind: cat behaviour bugs)

Item 5 found a cat behaviour bug by reading the engine. This item looks for more by playing the cat engine at random — summons asleep and awake, clicks, window sizes, intensity changes, ticks of every length, the pointer on and off the page — and checking after every step what must always hold: never more than five cats, every cat on the screen, positions numbers, combo partners each other's, phases known and timed. Whatever it finds is fixed; what it checks stays as a test.

## T12 item 10 — looking for cat behaviour bugs by random play (completed)

- Branch `night-2026-10-07-t12-10-cat-invariants`, base `3c4e2dc`. Start 06:40 (budget ~13,231,000); completed 06:48 (budget ~13,205,000).
- **CI of T12 item 9** (`3c4e2dc`): **CI passed** on both branches ([run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37728357592), [task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37728357913)), the invoice step against `next start` included.
- **Result** (D95): **no bug found.** The cat engine was played at random: summons, clicks, window sizes from 60 to 1600 px, intensity changes, ticks of every length, the pointer on and off the page. Every invariant held after every step.
- **Kept as a test**: `tests/unit/xenocats/cat-engine-invariants.test.ts` (new, in CI's cats/Node step; about 50 ms). After every step it requires:
  - at most five cats, all on the screen;
  - positions are numbers;
  - every phase is known, and timed except "ready";
  - combo partners exist and point back, one pair at a time.
  - After play, every cat that was on screen leaves, given time.
  - It failed with item 5's resize fix removed.
- **Sent to a human**: Q10, whether a held touch should pet a sleeping cat. On a phone a sleeping cat can only be angered today.
- **Why it was added**: plan task 12, an exploration item of the kind "cat behaviour bugs".
- **Reviewer**: approve, three Low findings and a nit, all acted on (D96): the test ran twice in CI, a cat stuck in "ready" was invisible to it, a missing partner was accepted, and the cat size was a copy.
- **Gate**
  - Full gate (FULL, as `ci.yml` changed), all exit 0: actionlint 0, prettier, lint 0 warnings, type check, group check; `npm test` 44 files, 651 passed (17 skipped); build; `npm run test:e2e` 130 passed; `E2E_SERVER=start npm run test:e2e` 130 passed.
  - After the review's changes (test file and CI group only): actionlint 0, prettier, lint, type check, group check, and the test itself passed.

## Checkpoint 4 (completed)

- Branch `night-2026-10-07-c4-checkpoint`, base `03d24e1`; covers `23b9f87..03d24e1` (T12 items 6–10). Start 06:49 (budget ~13,204,000); completed 06:59 (budget ~13,190,000).
- **CI of T12 item 10** (`03d24e1`): **CI passed** on both branches ([run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37729209303), [task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37729209595)).
- **1. Tests.** Every behaviour changed in the range has a test that fails without it; each item's entry names them.
  - **Strengthened:** the phone layout's due line now proves it shows the invoice's own due date, not only that a line is there.
  - **Removed:** nothing. No test is of removed behaviour, a duplicate, or unable to fail.
  - **Recorded:** the list query's new column is checked by a browser test and the opt-in database test (CI runs it), not by a plain `npm test`.
- **2. Quality and security.** The reviewer read the range with `.claude/rules/security-review.md` in scope: logging, the lint rule, the invoice data, the CI groups, the arsenal, and how the items interact.
  - **No security or correctness finding.**
  - Two Low findings and a nit, all handled (D97): the phone test strengthened; the database-test coverage recorded; "The Cat Treats is no more." left as the product's voice.
- **What changed** (code): `tests/e2e/invoices.spec.ts` (the phone test).
- **Verification** (a full-suite point; `GATE_FULL=1`), all exit 0:
  - Prettier, lint 0 warnings, type check, group check.
  - `npm test`: 44 files, 651 passed (17 skipped).
  - Build.
  - `npm run test:e2e`: 130 passed.
  - `E2E_SERVER=start npm run test:e2e`: 130 passed.

## T12 item 11 — started 07:03: positioning is the skill, as a seeded balance test (kind: the Survival game)

The series' first rule is that attacks are automatic and "positioning is the skill". A seeded simulation of the real game (full schedule, all varieties, level-ups taken) compares a Keeper who stands still with one who keeps walking, over several seeds, and pins the difference as a balance test, so a later change to the numbers cannot quietly make standing still as good as moving.

## T12 item 11 — positioning is the skill, as a seeded balance test (completed)

- Branch `night-2026-10-07-t12-11-balance`, base `b0366dc`. Start 07:01 (budget ~13,188,000); completed 07:05 (budget ~13,170,000).
- **CI of checkpoint 4** (`b0366dc`): the poll was still running at this commit; the result goes into the next entry.
- **What was measured** (D98, D99): the game as configured (the full schedule, varieties, bosses, chests; stepped at 50 ms), eight seeds, the secret cat left out, the same level-up policy (the first of each offer).
  - A Keeper standing still was worn down at 66–76 s.
  - One walking a wide circle lasted 124–175 s, 1.7 to 2.7 times as long.
  - **No number changed**: the series' rule "positioning is the skill" holds as things stand.
- **What changed**: `tests/unit/xenocats/arena.test.ts` gains "balance: positioning is the skill" (about 1.8 s). It requires:
  - standing still ends before 1:40 on every seed;
  - walking lasts more than 1.5× as long on at least seven, past 2:00 on at least six, and twice as long at the median.
  - It fails if a change makes standing still as good as moving, or the opening unwinnable.
- **Not claimed**: that a skilled player reaches the 5-minute goal; that would need a smarter bot than a test should hold.
- **Sent to a human**: Q11, whether weapons should aim at the harmless secret cat.
- **Why it was added**: plan task 12, an exploration item of the kind "the Survival game" (a balance check backed by a seeded simulation).
- **Reviewer**: request changes. Medium: the secret cat skewed the stand-still runs. Low: "same choices" wrong, per-seed checks brittle, "the real game" inexact. All acted on, with the measurement redone (D99). The test-only changes after the review were not re-reviewed.
- **Gate** (the selection), all exit 0: prettier, lint 0 warnings, type check, group check; `arena.test.ts` 23 passed.

## T12 item 12 — started 07:08: an unpaid invoice says how long until it is due (kind: dashboard features)

An invoice's own page gives its due date, but not how near it is. For an unpaid invoice, the page says "Due today", "Due in N days" or "Overdue by N days" under the due date, worked out from today; a paid invoice shows only the date.

## T12 item 12 — an unpaid invoice says how long until it is due (completed)

- Branch `night-2026-10-07-t12-12-due-in`, base `79720ea`. Start 07:08 (budget ~13,168,000); completed 07:19 (budget ~13,137,000).
- **CI of checkpoint 4** (`b0366dc`): **CI passed** on both branches ([run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37730061355), [task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37730061349)).
- **CI of T12 item 11** (`79720ea`): **CI passed** on both branches ([run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37730509926), [task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37730510301)).
- **What the code does** (D100–D102)
  - An unpaid invoice's own page says "Due today", "Due in N days" or "Overdue by N days" under its due date: red when overdue, quiet otherwise. A paid invoice shows only the date.
  - The database counts the days (`due_date - CURRENT_DATE`) by the same day its overdue rule uses, so the text and the overdue badge always agree. `dueText(days)` words the number.
- **Why it was added**: plan task 12, an exploration item of the kind "dashboard features".
- **Tests**
  - `utils.test.ts`: the wording.
  - `data.test.ts` (opt-in; CI runs it): the count is a whole number, and long past for a 2023 invoice.
  - `invoice-detail.spec.ts`: a new invoice "Due in 30 days" (29–31 accepted, Q12), a seeded overdue one "Overdue by N days", a paid one with no such line.
- **Tested in a browser, not seen.**
- **Sent to a human**: Q12, one time zone for the database's "today". The app dates invoices by UTC, while `CURRENT_DATE` follows the server's setting.
- **Reviewer**
  - First review: request changes. Medium: the text and the overdue badge used two different "todays". Fixed by counting in the database (D101).
  - Re-review: approve, one Low (the 30-day test's dependency on the database's time zone), acted on (D102).
- **Gate** (the selection, on the code after D101), all exit 0:
  - Prettier on 7 files, lint 0 warnings, type check, group check, build.
  - Unit: 2 files, 15 passed (`data.test.ts` skipped, opt-in).
  - Browser: 54 passed.
  - The last change (the test's 29–31) was run alone (1 passed) with prettier, lint and the type check.
  - An earlier gate passed on the first version.

## T12 item 13 — started 07:21: every spec waits for a busy dev server after logging in (kind: tests)

Item 8 gave the two specs that flaked a 15-second wait after a page change; ten others still wait the default 5 seconds after the login redirect — the same first-visit compile under `next dev` (questions.md Q9) — and the invoice spec after its edit link. They get the same wait.

## T12 item 13 — every spec waits for a busy dev server after logging in (completed)

- Branch `night-2026-10-07-t12-13-login-waits`, base `77ebb8a`. Start 07:21 (budget ~13,135,000); completed 07:31 (budget ~13,118,000).
- **CI of T12 item 12** (`77ebb8a`): **CI passed** on both branches ([task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37731639076), [run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37731639108)).
- **What changed** (D103, D104)
  - Every remaining page-change wait of the kind item 8 diagnosed now allows 15 s instead of 5: a first visit compiling under a busy `next dev`. That covers the login's redirect in ten specs, the invoice edit link, `cats-link`'s `/cats` and return, the invoice list in `cat-states`, and the invoice detail page.
  - `invoice-detail` and `cats-link` allow 60 s per test, as their waits now add up past the default 30.
  - Only timeouts changed. No matcher or pattern was weakened, and no retry or global timeout was added.
- **Why it was added**: plan task 12, an exploration item of the kind "tests". It answers Q9's remaining waits.
- **Reviewer**: approve, two Low and a nit, all acted on (D104): test timeouts, a description, four more waits.
- **Gate**
  - Full gate (FULL), all exit 0: prettier, lint 0 warnings, type check, group check; `npm test` 44 files, 653 passed (17 skipped); build; `npm run test:e2e` 131 passed; `E2E_SERVER=start npm run test:e2e` 131 passed.
  - After the review's changes (the selection): prettier, lint, type check, group check, build; 32 browser tests passed.

## T12 item 14 — started 07:33: the agents' rules name routes that no longer exist (kind: security and quality)

The standing reviewer is told the schema lives in `app/seed/route.ts` and that `app/seed/route.ts` and `app/query/route.ts` leak database errors; `.claude/rules/backend.md` says the only route handlers are those seed/query routes. Both were deleted (`a1e8040`); the schema is `db/migrations/*.sql`, and the one route handler, the invoice CSV export, checks the session itself. A reviewer pointed at files that do not exist reviews the wrong surface. The factual references are corrected; no guardrail is touched.

## T12 item 14 — the agents' rules name routes that no longer exist (completed)

- Branch `night-2026-10-07-t12-14-stale-routes`, base `edc2ace`. Started 07:33, before the goal. Completed 10:26, **after the goal (08:30)**, as the task in flight at it.
- **Gap: about 07:35 to 10:20, nothing ran.** The session hit its usage limit a third time ("resets 10:20am"). The first reviewer of this item stopped with that error, and the review was redone at 10:20.
- **CI of T12 item 13** (`edc2ace`): **CI passed** on both branches ([task-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37732819680), [run-branch run](https://github.com/lazurq-png/Xenocats/actions/runs/37732819170)).
- **What changed** (D105): documentation only.
  - `.claude/agents/reviewer.md`: the schema is `db/migrations/*.sql`, not `app/seed/route.ts`; the "leaked errors" example no longer cites the deleted seed and query routes.
  - `.claude/rules/backend.md`: the app's one route handler is the invoice CSV export, which checks the session itself.
  - No guardrail touched: the reviewer's "never request `/seed`, or run SQL" and "only copy of its data" stay as written.
- **Why it was added**: plan task 12, an exploration item of the kind "security and quality". A reviewer pointed at files that no longer exist reviews the wrong surface.
- **Reviewer**: approve, no findings. It verified each fact and that no guardrail was loosened.
- **Gate**: prettier on both files, lint 0 warnings, type check, group check, build, all exit 0.
  - The selection had nothing to run (no code). The gate script reported "failed" at that step only because its output filter found no lines.
  - Run directly, `npm run build` exit 0 and `npm run test:affected -- --run` exit 0 ("nothing to run").

## Morning report

### Goal

- The plan's goal, verbatim: "Thursday 08:30" → deadline **2026-10-08 08:30** (Europe/Stockholm).
- Report started 2026-10-08 10:32, after the last task's CI poll resolved.
- **What ended the run: the goal time.** At 08:30 the session was paused at the account's usage limit, which reset at 10:20. Item 14 of task 12 was the task in flight. It was finished at 10:26, 1 h 56 min past the deadline, entirely because of that pause; its own work took about 10 minutes. No new task was started after 08:30.
- **About 8 h 30 min were lost to three usage-limit pauses**, each recorded in the entry it interrupted. Nothing ran in that time; the timer's firings queued and resumed the run each time.
  - About 16:48–19:20, in T6.
  - About 21:30–00:20, in T10.
  - About 02:35–05:20, in checkpoint 3.
  - About 07:35–10:20, in T12 item 14.

### Tasks

| Plan task | Outcome |
| --------- | ------- |
| 1. Database unit tests are opt-in | **Completed** |
| 2. Element hits (each cat does to page elements what it does to the pointer) | **Completed** |
| 3. Real cat sounds | **Abandoned**: the harness refused the integration of downloaded recordings (Q5) |
| 4. Game pages and the movement pad | **Completed**, with one CI repair cycle |
| 5. Taming with treats | **Completed** |
| Checkpoint 1 | **Completed** |
| 6. The arena, the hero and the horde | **Completed** |
| 7. Experience, level-ups and the arsenal | **Completed** |
| 8. Varieties and a boss | **Completed** |
| 9. Weapon evolution | **Completed** (e2e: unit-tested only, as the task allows, D54) |
| 10. Persistent progression and unlocks | **Completed** |
| 11. Local co-op for two | **Completed** |
| Checkpoint 2 | **Completed** |
| 12. Exploration until the goal time | **14 items completed**, with checkpoints 3 and 4 after items 5 and 10 |

The task 12 items, in the plan's rotation:

1. The Purring Cat (the game).
2. A due date on the invoice forms (dashboard).
3. Tests for what checkpoint 2 left to reading (tests).
4. An unknown email's login timing (security).
5. Cats kept on screen when the window narrows (cat behaviour bug).
6. Two evolution pairs (the game).
7. A Due column in the invoice list (dashboard).
8. The dev-server flakes (tests).
9. No debug logging of invoice data (security).
10. A random-play invariant test of the cats (cat behaviour; no bug found).
11. A seeded balance test (the game).
12. "Due in N days" on an unpaid invoice (dashboard).
13. Every spec's page-change waits (tests).
14. Stale route references in the agents' rules (quality).

**Evidence.** Each task's entry above says which acceptance criteria a command (a test, the gate) covered and which only a reading did. The decisions file lists them as `D1`–`D105`. In short:
- **Commands covered** every behaviour in the simulation, storage, actions, forms and lists.
- **Only reading covers:**
  - how every new drawing looks: varieties, characters, the Purring Cat, the halo;
  - how the canvas looks (the camera's zoom, notices, the co-op results);
  - T9's evolution announcement in the page;
  - the time-zone-dependent formatting of dates (Q12).

### Completed

The task-branch run and the run-branch run of the same commit both appear where both were observed.

| Task | Branch | SHA | Verification run | CI |
| ---- | ------ | --- | ---------------- | -- |
| T1 | `night-2026-10-07-t1-db-tests-opt-in` | `60801d2` | Full gate | Run branch: CI passed ([37622699500](https://github.com/lazurq-png/Xenocats/actions/runs/37622699500)). Task branch, same tree: **CI failed** in the dev-server browser job ([37622695999](https://github.com/lazurq-png/Xenocats/actions/runs/37622695999)); not repaired, as the identical tree passed (Q4) |
| T2 | `night-2026-10-07-t2-element-hits` | `a094fbf` | Full gate | Pushed; CI not observed (the read was denied by the harness) |
| T4 | `night-2026-10-07-t4-game-pages` | `b08df21`, `2edb420` | Full gate | CI failed ("Every test file is in a group", checks job), fixed in 1 cycle; fix CI passed |
| T5 | `night-2026-10-07-t5-taming-treats` | `fe169d5` | Selection gate | CI passed ([37635776113](https://github.com/lazurq-png/Xenocats/actions/runs/37635776113), [37635771876](https://github.com/lazurq-png/Xenocats/actions/runs/37635771876)) |
| C1 | `night-2026-10-07-c1-checkpoint` | `0153196` | Full gate | CI passed ([37637560580](https://github.com/lazurq-png/Xenocats/actions/runs/37637560580), [37637555165](https://github.com/lazurq-png/Xenocats/actions/runs/37637555165)) |
| T6 | `night-2026-10-07-t6-survival-arena` | `21c407a` | Full gate | CI passed ([37660689356](https://github.com/lazurq-png/Xenocats/actions/runs/37660689356), [37660685677](https://github.com/lazurq-png/Xenocats/actions/runs/37660685677)) |
| T7 | `night-2026-10-07-t7-arsenal` | `eda85d0` | Full gate (dev-server flakes rerun alone, Q7) | Task branch: CI passed ([37665677397](https://github.com/lazurq-png/Xenocats/actions/runs/37665677397)); run branch cancelled, not observed |
| T8 | `night-2026-10-07-t8-varieties` | `e46787d` | Full gate | CI passed ([37671323802](https://github.com/lazurq-png/Xenocats/actions/runs/37671323802), [37671324124](https://github.com/lazurq-png/Xenocats/actions/runs/37671324124)) |
| T9 | `night-2026-10-07-t9-evolution` | `82fabe3` | Selection gate | Task branch: CI passed ([37673322361](https://github.com/lazurq-png/Xenocats/actions/runs/37673322361)); run branch cancelled, not observed |
| T10 | `night-2026-10-07-t10-progression` | `07e46e4` | Full gate | CI passed ([37697284595](https://github.com/lazurq-png/Xenocats/actions/runs/37697284595), [37697284251](https://github.com/lazurq-png/Xenocats/actions/runs/37697284251)) |
| T11 | `night-2026-10-07-t11-coop` | `1f4e3ea` | Full gate | CI passed ([37699958601](https://github.com/lazurq-png/Xenocats/actions/runs/37699958601), [37699958188](https://github.com/lazurq-png/Xenocats/actions/runs/37699958188)) |
| C2 | `night-2026-10-07-c2-checkpoint` | `b9eec4a` | Full gate | CI passed ([37701496841](https://github.com/lazurq-png/Xenocats/actions/runs/37701496841), [37701496164](https://github.com/lazurq-png/Xenocats/actions/runs/37701496164)) |
| T12.1 | `night-2026-10-07-t12-1-comforter` | `b754102` | Selection gate | CI passed ([37702759354](https://github.com/lazurq-png/Xenocats/actions/runs/37702759354), [37702759276](https://github.com/lazurq-png/Xenocats/actions/runs/37702759276)) |
| T12.2 | `night-2026-10-07-t12-2-due-date` | `1af4360` | Selection gate | CI passed ([37704078471](https://github.com/lazurq-png/Xenocats/actions/runs/37704078471), [37704078436](https://github.com/lazurq-png/Xenocats/actions/runs/37704078436)), "Database tests" included |
| T12.3 | `night-2026-10-07-t12-3-tests` | `59bc71b` | Full gate | CI passed ([37704925232](https://github.com/lazurq-png/Xenocats/actions/runs/37704925232), [37704925983](https://github.com/lazurq-png/Xenocats/actions/runs/37704925983)) |
| T12.4 | `night-2026-10-07-t12-4-login-timing` | `a47938f` | Full gate | CI passed ([37706457233](https://github.com/lazurq-png/Xenocats/actions/runs/37706457233), [37706456752](https://github.com/lazurq-png/Xenocats/actions/runs/37706456752)) |
| T12.5 | `night-2026-10-07-t12-5-cats-on-resize` | `145ff32` | Selection gate (all specs) | CI passed ([37708326382](https://github.com/lazurq-png/Xenocats/actions/runs/37708326382), [37708326018](https://github.com/lazurq-png/Xenocats/actions/runs/37708326018)) |
| C3 | `night-2026-10-07-c3-checkpoint` | `23b9f87` | Full gate | CI passed ([37723213036](https://github.com/lazurq-png/Xenocats/actions/runs/37723213036), [37723212965](https://github.com/lazurq-png/Xenocats/actions/runs/37723212965)) |
| T12.6 | `night-2026-10-07-t12-6-evolutions` | `8ab4311` | Selection gate | CI passed ([37724133044](https://github.com/lazurq-png/Xenocats/actions/runs/37724133044), [37724133677](https://github.com/lazurq-png/Xenocats/actions/runs/37724133677)) |
| T12.7 | `night-2026-10-07-t12-7-due-column` | `3f417dc` | Selection gate (`next dev` only) | Task branch: CI passed ([37724939274](https://github.com/lazurq-png/Xenocats/actions/runs/37724939274)). Run branch: **CI failed**, `next start` invoices step ([37724939389](https://github.com/lazurq-png/Xenocats/actions/runs/37724939389)), from a test this item broke; fixed in T12.9 (D93) |
| T12.8 | `night-2026-10-07-t12-8-dev-flakes` | `93c9524` | Selection gate | CI passed ([37726072663](https://github.com/lazurq-png/Xenocats/actions/runs/37726072663), [37726072950](https://github.com/lazurq-png/Xenocats/actions/runs/37726072950)) |
| T12.9 | `night-2026-10-07-t12-9-no-debug-log` | `3c4e2dc` | Full gate (third run; two repairs, D93–D94) | CI passed ([37728357592](https://github.com/lazurq-png/Xenocats/actions/runs/37728357592), [37728357913](https://github.com/lazurq-png/Xenocats/actions/runs/37728357913)) |
| T12.10 | `night-2026-10-07-t12-10-cat-invariants` | `03d24e1` | Full gate | CI passed ([37729209303](https://github.com/lazurq-png/Xenocats/actions/runs/37729209303), [37729209595](https://github.com/lazurq-png/Xenocats/actions/runs/37729209595)) |
| C4 | `night-2026-10-07-c4-checkpoint` | `b0366dc` | Full gate | CI passed ([37730061355](https://github.com/lazurq-png/Xenocats/actions/runs/37730061355), [37730061349](https://github.com/lazurq-png/Xenocats/actions/runs/37730061349)) |
| T12.11 | `night-2026-10-07-t12-11-balance` | `79720ea` | Selection gate | CI passed ([37730509926](https://github.com/lazurq-png/Xenocats/actions/runs/37730509926), [37730510301](https://github.com/lazurq-png/Xenocats/actions/runs/37730510301)) |
| T12.12 | `night-2026-10-07-t12-12-due-in` | `77ebb8a` | Selection gate | CI passed ([37731639076](https://github.com/lazurq-png/Xenocats/actions/runs/37731639076), [37731639108](https://github.com/lazurq-png/Xenocats/actions/runs/37731639108)) |
| T12.13 | `night-2026-10-07-t12-13-login-waits` | `edc2ace` | Full gate | CI passed ([37732819680](https://github.com/lazurq-png/Xenocats/actions/runs/37732819680), [37732819170](https://github.com/lazurq-png/Xenocats/actions/runs/37732819170)) |
| T12.14 | `night-2026-10-07-t12-14-stale-routes` | `f8b643d` | Gate: prettier, lint, type check, build; no tests to run (docs only) | CI passed ([37749572327](https://github.com/lazurq-png/Xenocats/actions/runs/37749572327), [37749572885](https://github.com/lazurq-png/Xenocats/actions/runs/37749572885)) |

### Code by task

The code each task added, generated from git. Each section runs from the task's base to its branch tip, with the state files left out.

#### T1 — `night-2026-10-07-t1-db-tests-opt-in`

Database unit tests (`tests/unit/data.test.ts`) run only with `DATABASE_TESTS=1`; CI's "Database tests" step sets it, so a plain `npm test` never writes a schema. Why: plan task 1 (D1–D3).

<details><summary>Code: 4 files changed, 17 insertions(+), 8 deletions(-)</summary>

~~~~diff
diff --git a/.claude/rules/testing.md b/.claude/rules/testing.md
index a0ee8f6..12d6f13 100644
--- a/.claude/rules/testing.md
+++ b/.claude/rules/testing.md
@@ -18,7 +18,9 @@ database skip when no `POSTGRES_URL` is configured, or with `E2E_NO_DATABASE=1`
 suite at once drop it under each other. The queries in `app/lib/data.ts` are
 tested in Vitest by `tests/unit/data.test.ts`, against its own schema
 (`xenocats_vitest`, rebuilt when the file runs), so they never meet the browser
-tests' rows; it skips the same way.
+tests' rows. That file is opt-in: it runs only with `DATABASE_TESTS=1` (CI's
+"Database tests" step sets it), so a plain `npm test` never touches a
+database; opted in, it skips the same way.
 
 ---
 
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 2ee9234..1ef172f 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -162,6 +162,8 @@ jobs:
       - name: Database tests
         if: ${{ !cancelled() && steps.database.outcome == 'success' }}
         run: npx vitest run tests/unit/data
+        env:
+          DATABASE_TESTS: '1'
       - uses: actions/upload-artifact@v4
         if: failure()
         with:
diff --git a/CLAUDE.md b/CLAUDE.md
index 28f7a6a..6bf0783 100644
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -269,11 +269,14 @@ instead, which needs an existing `npm run build`. `next dev` also (re-)adds a Ne
 to `AGENTS.md` when it detects an AI agent, and flips `next-env.d.ts` between
 its dev and build variants; neither is part of a task's change.
 
-`npm test` includes `tests/unit/data.test.ts`, which runs every query in
-`app/lib/data.ts` against a real database: it drops and rebuilds its own
+`tests/unit/data.test.ts` runs every query in `app/lib/data.ts` against a real
+database, and is **opt-in**: it runs only with `DATABASE_TESTS=1`
+(`DATABASE_TESTS=1 npx vitest run tests/unit/data`), so a plain `npm test`
+never touches a database. Opted in, it drops and rebuilds its own
 `xenocats_vitest` schema (and a scratch `xenocats_vitest_migrations`) on the
-server `POSTGRES_URL` names, and skips like the browser tests do — no URL, or
-`E2E_NO_DATABASE=1`. In CI it runs in the *build* job, which has a database.
+server `POSTGRES_URL` names, and still skips like the browser tests do — no
+URL, or `E2E_NO_DATABASE=1`. In CI the *build* job's "Database tests" step sets
+it, on that job's database.
 
 `lint` exits non-zero on **errors only**; warnings print without failing, so a
 clean exit does not mean an empty report. Read the output; do not report "lint
diff --git a/tests/unit/data.test.ts b/tests/unit/data.test.ts
index 983fabe..d675b0b 100644
--- a/tests/unit/data.test.ts
+++ b/tests/unit/data.test.ts
@@ -11,12 +11,14 @@ import { formatCurrency } from '@/app/lib/utils';
 // real database: its own schema,
 // `xenocats_vitest`, on the server POSTGRES_URL names (the environment's, else
 // .env's), rebuilt from db/migrations and the seed before this file runs. The
-// browser tests use `xenocats_test`, so the two suites never meet. Like them,
-// these skip without a URL, or with E2E_NO_DATABASE=1 (the server is unreachable).
+// browser tests use `xenocats_test`, so the two suites never meet.
+// Opt-in: they run only with DATABASE_TESTS=1 (CI's "Database tests" step sets
+// it), so a plain `npm test` never touches a database. Even then they skip
+// without a URL, or with E2E_NO_DATABASE=1 (the server is unreachable).
 // The expected values are worked out from the seed (placeholder-data.ts).
 
 function databaseUrl(schema: string): string | null {
-  if (process.env.E2E_NO_DATABASE) return null;
+  if (process.env.DATABASE_TESTS !== '1' || process.env.E2E_NO_DATABASE) return null;
   let base = process.env.POSTGRES_URL;
   if (!base) {
     try {
~~~~

</details>

#### T2 — `night-2026-10-07-t2-element-hits`

Each cat's attack now does to a page element what it does to the pointer (`page-hits.ts`, `puppets.ts`), with exact restore; per-cat browser tests. Why: plan task 2 (D4–D11).

<details><summary>Code: 11 files changed, 592 insertions(+), 760 deletions(-)</summary>

~~~~diff
diff --git a/app/ui/global.css b/app/ui/global.css
index 159fd3d..250dd04 100644
--- a/app/ui/global.css
+++ b/app/ui/global.css
@@ -1228,62 +1228,6 @@ input[type='number']::-webkit-outer-spin-button {
   }
 }
 
-/* Cats hitting the page around the pointer (app/ui/xenocats/page-hits.ts). Every
-   rule is keyed on data-xenocat-hit, so removing the attribute ends it. */
-[data-xenocat-hit] {
-  transition:
-    transform 180ms ease-out,
-    filter 180ms ease-out;
-}
-[data-xenocat-hit='shake'] {
-  animation: xenocat-hit-shake 0.12s linear infinite;
-}
-@keyframes xenocat-hit-shake {
-  0%,
-  100% {
-    transform: translate(0, 0);
-  }
-  25% {
-    transform: translate(
-      calc(var(--xenocat-hit-amount, 3) * 1px),
-      calc(var(--xenocat-hit-amount, 3) * -1px)
-    );
-  }
-  75% {
-    transform: translate(
-      calc(var(--xenocat-hit-amount, 3) * -1px),
-      calc(var(--xenocat-hit-amount, 3) * 1px)
-    );
-  }
-}
-[data-xenocat-hit='wobble'] {
-  animation: xenocat-hit-wobble 0.9s ease-in-out infinite;
-}
-@keyframes xenocat-hit-wobble {
-  0%,
-  100% {
-    transform: rotate(calc(var(--xenocat-hit-amount, 6) * 1deg));
-  }
-  50% {
-    transform: rotate(calc(var(--xenocat-hit-amount, 6) * -1deg));
-  }
-}
-[data-xenocat-hit='tilt'] {
-  transform: rotate(calc(var(--xenocat-hit-amount, 12) * 1deg)) !important;
-}
-[data-xenocat-hit='blur'] {
-  filter: blur(calc(var(--xenocat-hit-amount, 4) * 1px)) !important;
-}
-[data-xenocat-hit='flip'] {
-  transform: scaleX(-1) !important;
-}
-[data-xenocat-hit='glow'] {
-  filter: drop-shadow(0 0 4px var(--xenocat-hit-color))
-    drop-shadow(0 0 10px var(--xenocat-hit-color)) !important;
-}
-[data-xenocat-hit='push'] {
-  transform: translate(var(--xenocat-hit-dx, 0), var(--xenocat-hit-dy, 0)) !important;
-}
 /* While cats fling page elements about (puppets.ts), the page clips what flies
    off it rather than growing to hold it. The html element keeps the scrolling (an
    overflow of its own stops body's from passing to the viewport), and the body
@@ -1295,22 +1239,6 @@ html[data-xenocat-puppets] body {
   overflow: clip;
   min-height: 100vh;
 }
-/* Scrambled or swapped text: the real text turns transparent (and stays what
-   assistive technology reads); the shown text is generated content whose alt text
-   is empty, so it is never read out. */
-[data-xenocat-hit='text'] {
-  position: relative;
-  -webkit-text-fill-color: transparent;
-}
-[data-xenocat-hit='text']::after {
-  content: attr(data-xenocat-hit-text) / '';
-  position: absolute;
-  inset: 0;
-  overflow: hidden;
-  white-space: nowrap;
-  -webkit-text-fill-color: currentcolor;
-  pointer-events: none;
-}
 
 /* A cat clicked awake glows red until it has attacked and gone. */
 .xenocat-angry {
diff --git a/app/ui/settings/cat-intensity.tsx b/app/ui/settings/cat-intensity.tsx
index 140a9d2..db4ea61 100644
--- a/app/ui/settings/cat-intensity.tsx
+++ b/app/ui/settings/cat-intensity.tsx
@@ -12,9 +12,9 @@ import {
 } from '@/app/ui/xenocats/intensity';
 
 const DESCRIPTIONS: Record<Intensity, string> = {
-  calm: 'Now and then, at most two at once. They only nudge what is near your pointer.',
+  calm: 'Now and then, at most two at once. They only hit what is near your pointer.',
   normal: 'The cats as they have always been: they knock the page about, panels and all.',
-  chaos: 'Often, up to five at once, and the page goes wild: things fly right off it.',
+  chaos: 'Often, up to five at once, and the page goes wild: things fly across it.',
 };
 
 /** Calm, normal or chaos: how hard the cats haunt the dashboard. Saved in this browser. */
diff --git a/app/ui/xenocats/fake-cursor.tsx b/app/ui/xenocats/fake-cursor.tsx
index a2f77ad..208da40 100644
--- a/app/ui/xenocats/fake-cursor.tsx
+++ b/app/ui/xenocats/fake-cursor.tsx
@@ -5,7 +5,7 @@ import { type CursorController, createCursorController } from './cursor-controll
 import { type CursorKind, cursorKindFor } from './cursor-kind';
 import { type CursorLook, type Effect, MAX_DECOYS, type Vec } from './effects';
 import { getIntensity } from './intensity';
-import { HIT_LEVELS, hitPage, hitText, pickTargets } from './page-hits';
+import { HIT_LEVELS, pickTargets } from './page-hits';
 import { createPuppetTheatre } from './puppets';
 import { type Random, createRandom, freshSeed } from './random';
 
@@ -113,6 +113,8 @@ export function XenocatCursorProvider({
   const touchRef = useRef<Vec | null>(null);
   const touchUntilRef = useRef(0);
   const touchTimerRef = useRef(0);
+  // There is no draw loop on a touch screen: the frames that move the hit elements.
+  const touchFrameRef = useRef(0);
 
   useEffect(() => {
     nowRef.current = now;
@@ -228,6 +230,8 @@ export function XenocatCursorProvider({
     if (enabled) return;
     const endTouchHit = () => {
       window.clearTimeout(touchTimerRef.current);
+      cancelAnimationFrame(touchFrameRef.current);
+      touchFrameRef.current = 0;
       touchUntilRef.current = 0;
       restoreHitsRef.current?.();
       restoreHitsRef.current = null;
@@ -251,10 +255,23 @@ export function XenocatCursorProvider({
           const time = nowRef.current();
           if (!touch || time < touchUntilRef.current) return false;
           restoreHitsRef.current?.();
-          restoreHitsRef.current = hitPage(document.body, effect.id, touch, cat, random);
+          restoreHitsRef.current = null;
+          // The calm reach at every intensity: only the elements near the touch.
+          const { reach, puppets } = HIT_LEVELS.calm;
+          const targets = pickTargets(document.body, touch, reach, random);
           // Nothing near the touch: the cat pounces at nothing.
-          if (!restoreHitsRef.current) return true;
+          if (targets.length === 0) return true;
+          theatre.add(targets, effect, cat, time, puppets);
+          restoreHitsRef.current = () => theatre.clear();
           touchUntilRef.current = time + effect.durationMs;
+          cancelAnimationFrame(touchFrameRef.current);
+          const step = () => {
+            touchFrameRef.current = 0;
+            const at = nowRef.current();
+            theatre.frame(at, { width: window.innerWidth, height: window.innerHeight });
+            if (theatre.isActive(at)) touchFrameRef.current = requestAnimationFrame(step);
+          };
+          step();
           window.clearTimeout(touchTimerRef.current);
           touchTimerRef.current = window.setTimeout(() => {
             touchUntilRef.current = 0;
@@ -265,24 +282,18 @@ export function XenocatCursorProvider({
         }
         const time = nowRef.current();
         if (!controller.attack(effect, cat, time)) return false;
-        // Every attack also hits the page around the pointer, until no effect runs:
-        // calm, with a nudge; above it, attacking the elements as it does the cursor
-        // (page-hits.ts, puppets.ts). Stacked attacks pile their hits up; they are
-        // put back newest first, so each element ends as it was before the first.
+        // Every attack also hits the page elements around the pointer, as far as
+        // the intensity reaches, attacking them as it does the cursor (page-hits.ts,
+        // puppets.ts). Stacked attacks pile their hits up; they are put back newest
+        // first, so each element ends as it was before the first.
         const pointer = controller.position();
         const earlier = restoreHitsRef.current;
-        const level = HIT_LEVELS[getIntensity()];
         let hits: (() => void) | null = null;
-        if (pointer && level.puppets) {
+        if (pointer) {
+          const level = HIT_LEVELS[getIntensity()];
           const targets = pickTargets(document.body, pointer, level.reach, random);
           theatre.add(targets, effect, cat, time, level.puppets);
-          const text = hitText(targets, effect.id, random);
-          hits = () => {
-            text?.();
-            theatre.clear();
-          };
-        } else if (pointer) {
-          hits = hitPage(document.body, effect.id, pointer, cat, random);
+          hits = () => theatre.clear();
         }
         restoreHitsRef.current =
           earlier && hits
diff --git a/app/ui/xenocats/page-hits.ts b/app/ui/xenocats/page-hits.ts
index 5adc755..a26ce09 100644
--- a/app/ui/xenocats/page-hits.ts
+++ b/app/ui/xenocats/page-hits.ts
@@ -1,73 +1,24 @@
-// What a cat's attack does to the page around the pointer. Which elements it hits
-// and how depends on the cat intensity (intensity.ts):
+// Which page elements a cat's attack hits, around the pointer (or, on a touch
+// screen, the last touch). Each hit element is then attacked as the cursor is: it
+// becomes a puppet (puppets.ts) that does what the attack does to a pointer held
+// still where it stands, and nothing else. How many elements are hit and how far
+// they go depends on the cat intensity (intensity.ts):
 //
-//   calm     the elements near the pointer (buttons, links, text, cards, table
-//            rows, inputs) get an effect matched to the attack — a shake, tilt,
-//            blur, flip or glow, a push, or scrambled or swapped text.
-//   normal   more elements, whole panels (frames) and a few anywhere on screen are
-//            attacked the way the cursor is: each becomes a puppet of the mouse
-//            under the cat's effect (puppets.ts). Scrambled or swapped text too.
-//   chaos    most of the screen, flung much further: things fly off the page.
+//   calm     a few elements near the pointer (buttons, links, text, cards, table
+//            rows, inputs), thrown half as far as the cursor would be.
+//   normal   more elements, whole panels (frames) and a few anywhere on screen,
+//            thrown as far as the cursor.
+//   chaos    most of the screen, thrown much further (but never off it).
 //
-// It all reverts exactly when the attack ends.
-//
-// How it stays reversible: an effect only adds `data-xenocat-hit*` attributes and
-// a few `--xenocat-hit-*` custom properties, which CSS rules in global.css turn
-// into the effect. The restore function puts the `style` attribute back exactly as
-// it was (absent stays absent) and removes the attributes. Text is never
-// rewritten: scrambled or swapped text is drawn by a `::after` whose CSS alt text
-// is empty, over the real text made transparent, so assistive technology reads
-// the real text throughout. A focused or editable field is never given text.
+// It all reverts exactly when the attack ends (puppets.ts puts each `style`
+// attribute back as it was). Text is never touched, and the field being typed in
+// is never hit at all.
 
 import { CAT_CONFIG } from './config';
 import type { Vec } from './effects';
 import type { Intensity } from './intensity';
 import type { Random } from './random';
 
-export type HitKind =
-  'shake' | 'wobble' | 'tilt' | 'blur' | 'flip' | 'glow' | 'push' | 'scramble' | 'swap';
-
-export type HitStyle = {
-  kind: HitKind;
-  /** shake/wobble/blur: px or deg; tilt: deg; push: px. */
-  amount?: number;
-  /** push: away from the cat, towards it, or a fixed direction. */
-  direction?: 'away' | 'toward' | 'down' | 'up' | 'sideways';
-  /** glow: a CSS colour. */
-  color?: string;
-};
-
-/** Each attack's (and combo's) effect on the page when calm, keyed by effect id. */
-export const PAGE_HITS: Readonly<Record<string, HitStyle>> = {
-  vanish: { kind: 'blur', amount: 6 },
-  heavy: { kind: 'push', amount: 18, direction: 'down' },
-  knockback: { kind: 'push', amount: 40, direction: 'away' },
-  reverse: { kind: 'flip' },
-  jitter: { kind: 'shake', amount: 3 },
-  freeze: { kind: 'glow', color: '#7dd3fc' },
-  drift: { kind: 'push', amount: 24, direction: 'away' },
-  teleport: { kind: 'swap' },
-  magnet: { kind: 'push', amount: 30, direction: 'toward' },
-  orbit: { kind: 'tilt', amount: 12 },
-  decoys: { kind: 'scramble' },
-  drunk: { kind: 'wobble', amount: 6 },
-  tiny: { kind: 'shake', amount: 1.5 },
-  giant: { kind: 'shake', amount: 6 },
-  delay: { kind: 'blur', amount: 2 },
-  fall: { kind: 'push', amount: 40, direction: 'down' },
-  blur: { kind: 'blur', amount: 4 },
-  spiral: { kind: 'tilt', amount: 25 },
-  bounce: { kind: 'push', amount: 20, direction: 'up' },
-  'axis-lock': { kind: 'push', amount: 30, direction: 'sideways' },
-  // The combos (combos.ts), each from its two attacks.
-  'ice-puck': { kind: 'glow', color: '#7dd3fc' },
-  slingshot: { kind: 'push', amount: 50, direction: 'away' },
-  hangover: { kind: 'wobble', amount: 10 },
-  'ghost-jump': { kind: 'swap' },
-  pulsar: { kind: 'shake', amount: 8 },
-  'static-fog': { kind: 'blur', amount: 5 },
-};
-
 /** How far an attack reaches on the page. */
 export type HitReach = {
   /** Elements this near the pointer, px, and at most this many of them. */
@@ -83,19 +34,16 @@ export type HitReach = {
 export type HitLevel = {
   reach: HitReach;
   /**
-   * Null: the calm CSS effects (PAGE_HITS). Otherwise every hit element is
-   * attacked as the cursor is (puppets.ts), its displacement multiplied by
-   * `fling` (by `frameFling` for a whole panel), and its size kept within `scale`.
+   * Every hit element is attacked as the cursor is (puppets.ts), its
+   * displacement, for an attack that throws the pointer some way from where it
+   * is (`amplify: 'offset'`), multiplied by `fling` (by `frameFling` for a whole
+   * panel), and its size kept within `scale`.
    */
   puppets: {
     fling: number;
     frameFling: number;
     scale: readonly [number, number];
-    /** The chance an element also gets a weird twist (puppets.ts `twistFor`). */
-    weird: number;
-    /** Wild twists (upside down, mirrored, squashed) instead of slight ones. */
-    wild: boolean;
-  } | null;
+  };
 };
 
 export const HIT_LEVELS: Readonly<Record<Intensity, HitLevel>> = {
@@ -106,15 +54,15 @@ export const HIT_LEVELS: Readonly<Record<Intensity, HitLevel>> = {
       anywhere: 0,
       frames: false,
     },
-    puppets: null,
+    puppets: { fling: 0.5, frameFling: 0.5, scale: [0.5, 1.6] },
   },
   normal: {
     reach: { radius: 220, max: 8, anywhere: 4, frames: true },
-    puppets: { fling: 1, frameFling: 0.5, scale: [0.25, 2], weird: 0.15, wild: false },
+    puppets: { fling: 1, frameFling: 0.5, scale: [0.25, 2] },
   },
   chaos: {
     reach: { radius: 400, max: 14, anywhere: 12, frames: true },
-    puppets: { fling: 2.5, frameFling: 1.5, scale: [0.1, 4], weird: 0.6, wild: true },
+    puppets: { fling: 2.5, frameFling: 1.5, scale: [0.1, 4] },
   },
 };
 
@@ -220,139 +168,6 @@ export function pickAnywhere<T>(
   return extra;
 }
 
-/**
- * The same text with the letters of each word shuffled, spaces and punctuation in
- * place. A word that shuffles back to itself gets its first two letters swapped.
- */
-export function scrambleText(text: string, random: Random): string {
-  return text.replace(/[\p{L}\p{N}]{2,}/gu, (word) => {
-    const letters = [...word];
-    for (let i = letters.length - 1; i > 0; i--) {
-      const j = random.int(0, i);
-      [letters[i], letters[j]] = [letters[j], letters[i]];
-    }
-    const out = letters.join('');
-    if (out !== word || new Set(word).size === 1) return out;
-    return letters[1] + letters[0] + letters.slice(2).join('');
-  });
-}
-
-/** True for an element whose only content is text: its text can be drawn over. */
-function isTextLeaf(element: Element): boolean {
-  if (element.children.length > 0) return false;
-  if (element.matches('input, select, textarea, [contenteditable], [contenteditable] *')) {
-    return false;
-  }
-  return (element.textContent ?? '').trim().length > 0;
-}
-
-/** A focused or editable field, or anything around one, never has its text touched. */
-function mayTouchText(element: Element): boolean {
-  const active = element.ownerDocument.activeElement;
-  if (active && active !== element.ownerDocument.body && element.contains(active)) return false;
-  return isTextLeaf(element);
-}
-
-const PROPERTIES = [
-  '--xenocat-hit-amount',
-  '--xenocat-hit-dx',
-  '--xenocat-hit-dy',
-  '--xenocat-hit-color',
-] as const;
-
-export const HIT_ATTRIBUTE = 'data-xenocat-hit';
-export const TEXT_ATTRIBUTE = 'data-xenocat-hit-text';
-
-/**
- * Applies `style` to `targets` for an attack by a cat centred at `cat`. Returns
- * the function that puts every target back exactly as it was.
- */
-export function applyHits(
-  targets: readonly HTMLElement[],
-  style: HitStyle,
-  cat: Vec,
-  random: Random
-): () => void {
-  const saved = targets.map((element) => ({
-    element,
-    styleAttribute: element.getAttribute('style'),
-    hit: element.getAttribute(HIT_ATTRIBUTE),
-    text: element.getAttribute(TEXT_ATTRIBUTE),
-  }));
-
-  const set = (element: HTMLElement, name: (typeof PROPERTIES)[number], value: string) =>
-    element.style.setProperty(name, value);
-  // No inline style for text: the CSS hides the real text with a transparent text
-  // fill and paints the shown text in the element's own colour.
-  const textOver = (element: HTMLElement, text: string) => {
-    element.setAttribute(TEXT_ATTRIBUTE, text);
-    element.setAttribute(HIT_ATTRIBUTE, 'text');
-  };
-
-  if (style.kind === 'scramble') {
-    for (const element of targets) {
-      if (mayTouchText(element)) textOver(element, scrambleText(element.textContent!, random));
-      else element.setAttribute(HIT_ATTRIBUTE, 'shake');
-    }
-  } else if (style.kind === 'swap') {
-    // Pairs of text elements trade their text; anything left over shakes.
-    const texts = targets.filter(mayTouchText);
-    for (let i = 0; i + 1 < texts.length; i += 2) {
-      const [a, b] = [texts[i], texts[i + 1]];
-      const [textA, textB] = [a.textContent!, b.textContent!];
-      textOver(a, textB);
-      textOver(b, textA);
-    }
-    for (const element of targets) {
-      if (!element.hasAttribute(TEXT_ATTRIBUTE)) element.setAttribute(HIT_ATTRIBUTE, 'shake');
-    }
-  } else {
-    for (const element of targets) {
-      if (style.amount !== undefined) set(element, '--xenocat-hit-amount', String(style.amount));
-      if (style.color) set(element, '--xenocat-hit-color', style.color);
-      if (style.kind === 'push') {
-        const { x, y } = pushVector(element, style, cat);
-        set(element, '--xenocat-hit-dx', `${x}px`);
-        set(element, '--xenocat-hit-dy', `${y}px`);
-      }
-      element.setAttribute(HIT_ATTRIBUTE, style.kind);
-    }
-  }
-
-  return () => {
-    for (const { element, styleAttribute, hit, text } of saved) {
-      // The very text it had, not a re-serialisation of it.
-      if (styleAttribute === null) element.removeAttribute('style');
-      else element.setAttribute('style', styleAttribute);
-      if (hit === null) element.removeAttribute(HIT_ATTRIBUTE);
-      else element.setAttribute(HIT_ATTRIBUTE, hit);
-      if (text === null) element.removeAttribute(TEXT_ATTRIBUTE);
-      else element.setAttribute(TEXT_ATTRIBUTE, text);
-    }
-  };
-}
-
-function pushVector(element: HTMLElement, style: HitStyle, cat: Vec): Vec {
-  const amount = style.amount ?? 20;
-  const rect = element.getBoundingClientRect();
-  const centre = { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
-  const dx = centre.x - cat.x;
-  const dy = centre.y - cat.y;
-  const length = Math.hypot(dx, dy) || 1;
-  switch (style.direction) {
-    case 'toward':
-      return { x: (-dx / length) * amount, y: (-dy / length) * amount };
-    case 'down':
-      return { x: 0, y: amount };
-    case 'up':
-      return { x: 0, y: -amount };
-    case 'sideways':
-      return { x: Math.sign(dx || 1) * amount, y: 0 };
-    default:
-      return { x: (dx / length) * amount, y: (dy / length) * amount };
-  }
-}
-
 function containsFocusedField(element: Element): boolean {
   const active = element.ownerDocument.activeElement;
   return (
@@ -384,39 +199,3 @@ export function pickTargets(
   const viewport = { width: window.innerWidth, height: window.innerHeight };
   return [...near, ...pickAnywhere(candidates, near, reach.anywhere, viewport, contains, random)];
 }
-
-/** Text effects (scrambled or swapped text) for the attacks that have one. */
-export function hitText(
-  targets: readonly HTMLElement[],
-  effectId: string,
-  random: Random
-): (() => void) | null {
-  const style = PAGE_HITS[effectId];
-  if (!style || (style.kind !== 'scramble' && style.kind !== 'swap')) return null;
-  return targets.length > 0 ? applyHits(targets, style, { x: 0, y: 0 }, random) : null;
-}
-
-/**
- * Hits the page around `pointer` with the calm CSS effects for an attack whose
- * effect is `effectId`, by a cat centred at `cat`. Returns the restore function,
- * or null if nothing was hit.
- */
-export function hitPage(
-  root: ParentNode,
-  effectId: string,
-  pointer: Vec,
-  cat: Vec,
-  random: Random,
-  options: { radius?: number; max?: number } = {}
-): (() => void) | null {
-  const style = PAGE_HITS[effectId];
-  if (!style) return null;
-  const calm = HIT_LEVELS.calm.reach;
-  const targets = pickTargets(
-    root,
-    pointer,
-    { ...calm, radius: options.radius ?? calm.radius, max: options.max ?? calm.max },
-    random
-  );
-  return targets.length > 0 ? applyHits(targets, style, cat, random) : null;
-}
diff --git a/app/ui/xenocats/puppets.ts b/app/ui/xenocats/puppets.ts
index 8be750b..b3fa158 100644
--- a/app/ui/xenocats/puppets.ts
+++ b/app/ui/xenocats/puppets.ts
@@ -1,14 +1,19 @@
-// Page elements attacked the way the cursor is (page-hits.ts, above calm). Each hit
-// element becomes a puppet for as long as the attack lasts, moving on its own, not
-// with the mouse: it wanders along a path of its own (`wander`), as if an unseen
-// hand held it, and the cat's effect acts on that as it does on the cursor and the
-// mouse — Pinball bounces it about the screen, Spiral draws it in to the middle,
-// Reverse runs its wandering backwards, Heavy drags it, Delay makes it lag, Vanish
-// hides it, Giant grows it, and so on. Its displacement is multiplied by the
-// intensity's `fling` (chaos throws things off the page), and some elements get a
-// weird twist on top.
+// Page elements attacked the way the cursor is (page-hits.ts). Each hit element
+// becomes a puppet for as long as the attack lasts, and does what the attack does
+// to a pointer held still where the element stands, and nothing else: it moves
+// only if the attack moves that pointer. Pinball flings it off to bounce about the
+// screen, Spiral draws it in to the middle, Knockback throws it away from the cat,
+// Static shakes it; Freeze frosts it, Vanish hides it, Smoke hides it behind a
+// smoke screen, Tiny and Giant shrink and grow it, all where it stands; and an
+// attack that only changes how the pointer follows the mouse (Heavy, Reverse,
+// Delay, Axis lock, Decoys) leaves a still element as it is. The level's `fling`
+// scales how far an attack that throws the pointer some way (Knockback, Drift,
+// Static, Teleport, Fall …) throws the element (calm: half as far as the cursor);
+// one that puts the pointer somewhere (Spiral, Orbit, Magnet, Pinball) puts the
+// element there at every level. It stays on screen, as the cursor does: its box never leaves the viewport, or,
+// for one that was partly off it already, goes no further off than it was.
 //
-// It only writes the `translate`, `scale`, `rotate`, `opacity` and `filter` inline
+// It only writes the `translate`, `scale`, `opacity` and `filter` inline
 // properties, and puts the `style` attribute back exactly as it was when the last
 // attack on the element ends. An element hit by stacked attacks moves by all of
 // them at once.
@@ -18,58 +23,26 @@ import { type CursorLook, type Effect, type Size, type Vec, restingLook } from '
 import type { HitLevel } from './page-hits';
 import type { Random } from './random';
 
-export type PuppetLevel = NonNullable<HitLevel['puppets']>;
-
-/** A weird twist on an element: turned, and stretched or flipped. */
-export type Twist = { rotate: number; scaleX: number; scaleY: number };
-
-const NO_TWIST: Twist = { rotate: 0, scaleX: 1, scaleY: 1 };
+export type PuppetLevel = HitLevel['puppets'];
 
 /** Set on <html> while any element is a puppet: the page clips what flies off it. */
 export const PUPPETS_ATTRIBUTE = 'data-xenocat-puppets';
 
-/** How far an element wanders from where it was, px, before any effect. */
-export const WANDER_PX = 60;
-
-/** One axis of a wander: a sway of its own speed, starting where the element is. */
-type Sway = { speed: number; phase: number };
+/** An element's blur is the cursor's times this: enough to hide it, as smoke would. */
+export const SMOKE_BLUR_SCALE = 3;
 
-/** Where a wander has taken an element `seconds` in, from where it was. */
-export function wander(sways: readonly [Sway, Sway], seconds: number): Vec {
-  const [x, y] = sways.map(
-    ({ speed, phase }) => WANDER_PX * (Math.sin(speed * seconds + phase) - Math.sin(phase))
-  );
-  return { x, y };
-}
-
-/** Whether an element gets a twist, and which: slight, or (`wild`) anything goes. */
-export function twistFor(random: Random, weird: number, wild: boolean): Twist {
-  if (random.next() >= weird) return NO_TWIST;
-  if (!wild) {
-    const size = random.range(0.9, 1.1);
-    return { rotate: random.range(-8, 8), scaleX: size, scaleY: size };
-  }
-  const side = random.next() < 0.5 ? -1 : 1;
-  const twists: Twist[] = [
-    { rotate: 180, scaleX: 1, scaleY: 1 }, // upside down
-    { rotate: 0, scaleX: -1, scaleY: 1 }, // mirrored
-    { rotate: 0, scaleX: 1.5, scaleY: 0.6 }, // squashed
-    { rotate: 0, scaleX: 0.7, scaleY: 1.5 }, // stretched
-    { rotate: side * random.range(25, 60), scaleX: 1, scaleY: 1 }, // leaning
-    { rotate: side * random.range(5, 20), scaleX: 1.6, scaleY: 1.6 }, // huge
-    { rotate: 0, scaleX: 0.5, scaleY: 0.5 }, // shrunk
-  ];
-  return random.pick(twists);
+/**
+ * Where an element's centre may go on one axis: anywhere that keeps the element
+ * inside the viewport, widened to take in where it is now (so one already partly
+ * off screen, or bigger than the screen, is never pulled in either).
+ */
+export function span(centre: number, size: number, viewport: number): [number, number] {
+  return [Math.min(size / 2, centre), Math.max(viewport - size / 2, centre)];
 }
 
 type Puppet = {
   effect: Effect;
   startedAt: number;
-  /** The element's centre when the attack began. */
-  home: Vec;
-  /** Its own wandering path, and where that had taken it on the previous frame. */
-  sways: [Sway, Sway];
-  wandered: Vec;
   cat: Vec;
   roll: number;
   fling: number;
@@ -78,7 +51,14 @@ type Puppet = {
   lastFrameAt: number | null;
 };
 
-type Strings = { element: HTMLElement; style: string | null; twist: Twist; puppets: Puppet[] };
+type Strings = {
+  element: HTMLElement;
+  style: string | null;
+  /** Its centre and size when the first attack on it began, before anything moved it. */
+  home: Vec;
+  size: Size;
+  puppets: Puppet[];
+};
 
 export type PuppetTheatre = ReturnType<typeof createPuppetTheatre>;
 
@@ -86,18 +66,15 @@ export function createPuppetTheatre(options: { random: Random }) {
   const { random } = options;
   const strings = new Map<HTMLElement, Strings>();
   let level: PuppetLevel | null = null;
-  // Between 0.3 and 0.8 sways a second, at any point in the sway.
-  const sway = (): Sway => ({
-    speed: 2 * Math.PI * random.range(0.3, 0.8),
-    phase: random.range(0, 2 * Math.PI),
-  });
 
   const ended = (puppet: Puppet, now: number) => now - puppet.startedAt >= puppet.effect.durationMs;
 
   function release(entry: Strings) {
-    // The very text it had, not a re-serialisation of it.
+    // The very text it had, not a re-serialisation of it. Set before it is removed:
+    // Chromium writes CSSOM changes to the attribute lazily, and removing it alone
+    // left a pending write to land afterwards, as an empty style="".
+    entry.element.setAttribute('style', entry.style ?? '');
     if (entry.style === null) entry.element.removeAttribute('style');
-    else entry.element.setAttribute('style', entry.style);
     strings.delete(entry.element);
   }
 
@@ -121,26 +98,28 @@ export function createPuppetTheatre(options: { random: Random }) {
       for (const element of targets) {
         let entry = strings.get(element);
         if (!entry) {
+          const rect = element.getBoundingClientRect();
           entry = {
             element,
             style: element.getAttribute('style'),
-            twist: twistFor(random, settings.weird, settings.wild),
+            home: { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 },
+            size: { width: rect.right - rect.left, height: rect.bottom - rect.top },
             puppets: [],
           };
           strings.set(element, entry);
         }
-        const rect = element.getBoundingClientRect();
         const frame = element.matches('[data-xenocat-frame]');
         entry.puppets.push({
           effect,
           startedAt: now,
-          home: { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 },
-          sways: [sway(), sway()],
-          wandered: { x: 0, y: 0 },
           cat,
           // Each element its own roll: teleports and drifts go their own ways.
           roll: random.next(),
-          fling: frame ? settings.frameFling : settings.fling,
+          // Only an attack that throws the pointer some way from where it is goes
+          // further or less far; one that puts it somewhere (the middle, round the
+          // cat, bouncing off the edges) puts the element there at every level, as
+          // `strengthen` does for an angry cat (effects.ts).
+          fling: effect.amplify !== 'offset' ? 1 : frame ? settings.frameFling : settings.fling,
           state: undefined,
           look: null,
           lastFrameAt: null,
@@ -167,46 +146,51 @@ export function createPuppetTheatre(options: { random: Random }) {
           release(entry);
           continue;
         }
+        const { home, size } = entry;
+        // The effect runs as it does on the cursor, in a "screen" that is the span
+        // the element's centre may cover: its edges are where the element's box
+        // meets the viewport's, so a pinball bounces it off them.
+        const [left, right] = span(home.x, size.width, viewport.width);
+        const [top, bottom] = span(home.y, size.height, viewport.height);
+        const area = { width: right - left + 1, height: bottom - top + 1 };
+        const into = (point: Vec): Vec => ({ x: point.x - left, y: point.y - top });
+        const still = into(home);
         let dx = 0;
         let dy = 0;
         let look: CursorLook | null = null;
         for (const puppet of entry.puppets) {
-          // Where its wandering alone would have taken it: the effect's "pointer".
           const elapsed = Math.max(now - puppet.startedAt, 0);
-          const wandered = wander(puppet.sways, elapsed / 1000);
-          const real = { x: puppet.home.x + wandered.x, y: puppet.home.y + wandered.y };
-          const delta = { x: wandered.x - puppet.wandered.x, y: wandered.y - puppet.wandered.y };
-          puppet.wandered = wandered;
+          // A pointer held still where the element stands.
           const result = puppet.effect.step({
-            real,
-            delta,
-            previous: puppet.look ?? restingLook(real),
-            start: puppet.home,
-            cat: puppet.cat,
+            real: still,
+            delta: { x: 0, y: 0 },
+            previous: puppet.look ?? restingLook(still),
+            start: still,
+            cat: into(puppet.cat),
             elapsed,
             dt: puppet.lastFrameAt === null ? 0 : Math.max(now - puppet.lastFrameAt, 0),
-            viewport,
+            viewport: area,
             roll: puppet.roll,
             state: puppet.state,
           });
           puppet.state = result.state;
           puppet.look = result.look;
           puppet.lastFrameAt = now;
-          dx += (result.look.x - puppet.home.x) * puppet.fling;
-          dy += (result.look.y - puppet.home.y) * puppet.fling;
+          dx += (result.look.x - still.x) * puppet.fling;
+          dy += (result.look.y - still.y) * puppet.fling;
           look = look ? combineLooks(look, result.look) : result.look;
         }
         if (!look) continue;
-        const { twist } = entry;
-        const size = Math.min(Math.max(look.scale, smallest), biggest);
+        dx = Math.min(Math.max(home.x + dx, left), right) - home.x;
+        dy = Math.min(Math.max(home.y + dy, top), bottom) - home.y;
+        const scale = Math.min(Math.max(look.scale, smallest), biggest);
         const style = entry.element.style;
         style.translate = `${Math.round(dx)}px ${Math.round(dy)}px`;
-        style.scale = `${twist.scaleX * size} ${twist.scaleY * size}`;
-        style.rotate = `${twist.rotate}deg`;
+        style.scale = String(scale);
         style.opacity = String(look.visible ? look.opacity : 0);
         style.filter =
           [
-            look.blur > 0 ? `blur(${look.blur}px)` : '',
+            look.blur > 0 ? `blur(${look.blur * SMOKE_BLUR_SCALE}px) grayscale(1)` : '',
             look.tint ? `drop-shadow(0 0 4px ${look.tint}) drop-shadow(0 0 10px ${look.tint})` : '',
           ]
             .filter(Boolean)
diff --git a/tests/e2e/cats.spec.ts b/tests/e2e/cats.spec.ts
index 71f4298..69a8b6b 100644
--- a/tests/e2e/cats.spec.ts
+++ b/tests/e2e/cats.spec.ts
@@ -526,17 +526,25 @@ test('all 20 cats are on /cats, and a sixth summon is refused while five are on
   await expect(page.locator('[data-cat-type="hypno-rex"]')).toHaveCount(0);
 });
 
-test('calm: an attack nudges the page elements near the pointer, and puts them back exactly', async ({
+/** How far an element has been moved, px (its inline `translate`). */
+const translated = (element: ReturnType<Page['getByTestId']>) =>
+  element.evaluate((el) => {
+    const [x, y] = (el as HTMLElement).style.translate.split(' ').map(parseFloat);
+    return Math.hypot(x || 0, y || 0);
+  });
+
+test('calm: an attack flings the elements near the pointer as it does the cursor, half as far, and puts them back exactly', async ({
   page,
 }) => {
   await openCats(page, { intensity: 'calm' });
   const button = page.getByTestId('summon-pulsar-siamese');
-  await summon(page, 'pulsar-siamese');
+  await button.evaluate((el) => el.scrollIntoView({ block: 'center' }));
   const before = await button.evaluate((el) => el.outerHTML);
-  // Pulsar Siamese's knockback pushes the button under the pointer away from it.
+  await summon(page, 'pulsar-siamese');
+  // Knockback flings the cursor 300 px from the cat; the button goes half as far.
   await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'knockback');
-  await expect(button).toHaveAttribute('data-xenocat-hit', 'push');
-  await expect.poll(() => button.evaluate((el) => getComputedStyle(el).transform)).not.toBe('none');
+  await expect.poll(() => translated(button)).toBeGreaterThan(60);
+  expect(await translated(button)).toBeLessThanOrEqual(151);
   // When the effect ends (1.5 s) the button is exactly as it was.
   await expect(fakeCursor(page)).toHaveAttribute('data-effect', '', { timeout: 5000 });
   await expect.poll(() => button.evaluate((el) => el.outerHTML)).toBe(before);
@@ -565,44 +573,114 @@ test('normal: an attack flings the element under the pointer as it does the curs
   await expect.poll(() => button.evaluate((el) => el.outerHTML)).toBe(before);
 });
 
-test('an attack scrambles the text near the pointer for the eye only, then restores it', async ({
-  page,
-}) => {
-  await openCats(page);
-  const card = page.getByTestId('cat-card-decoy-burmese');
-  // The card minus its field-guide counts, which rightly change as the cat is met
-  // and attacks (field-guide.spec.ts).
-  const textsOf = () =>
-    card.evaluate((el) => {
-      const copy = el.cloneNode(true) as Element;
-      copy.querySelector('[data-testid="guide-entry"]')?.remove();
-      return Array.from(copy.querySelectorAll('*'), (child) => child.textContent);
-    });
-  const htmlOf = () =>
-    card.evaluate((el) => {
-      const copy = el.cloneNode(true) as Element;
-      copy.querySelector('[data-testid="guide-entry"]')?.remove();
-      return copy.outerHTML;
+/**
+ * Marks every page element an attack could reach with the inline style it has now
+ * (attribute absent and attribute empty told apart), to be compared with later.
+ */
+const markStyles = (page: Page) =>
+  page.evaluate(() => {
+    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
+      if (el.closest('[aria-hidden="true"], [data-xenocat-ignore]')) continue;
+      el.dataset.e2eStyle = el.hasAttribute('style') ? `=${el.getAttribute('style')}` : 'none';
+    }
+  });
+
+/** The marked elements whose inline style is not what it was when marked. */
+const restyled = (page: Page) =>
+  page.evaluate(() =>
+    Array.from(document.querySelectorAll<HTMLElement>('[data-e2e-style]'))
+      .filter((el) => {
+        const now = el.hasAttribute('style') ? `=${el.getAttribute('style')}` : 'none';
+        return now !== el.dataset.e2eStyle;
+      })
+      .map((el) => el.outerHTML.slice(0, 120))
+  );
+
+/** The elements an attack is acting on right now, with their boxes and displacement. */
+const hit = (page: Page) =>
+  page.evaluate(() =>
+    Array.from(document.querySelectorAll<HTMLElement>('body *'))
+      .filter((el) => el.style.translate !== '')
+      .map((el) => {
+        const r = el.getBoundingClientRect();
+        // "0px 0px" reads back as "0px": a missing y is 0.
+        const [dx = 0, dy = 0] = el.style.translate.split(' ').map((v) => parseFloat(v) || 0);
+        el.dataset.e2eHit = '';
+        return {
+          box: [r.left, r.top, r.right, r.bottom].map(Math.round),
+          dx,
+          dy,
+          filter: el.style.filter,
+          scale: el.style.scale,
+        };
+      })
+  );
+
+// Each cat in turn. Every element its attack hits does what the attack does to the
+// pointer (decisions.md D4); here, two of them closely, and for all twenty: every
+// element is back exactly as it was when the attack ends.
+for (const type of CAT_TYPES) {
+  test(`${type.name}: the page elements it hits are back exactly when its attack ends`, async ({
+    page,
+  }) => {
+    test.setTimeout(30_000);
+    await openCats(page);
+    const button = page.getByTestId(`summon-${type.id}`);
+    await button.evaluate((el) => el.scrollIntoView({ block: 'center' }));
+    await markStyles(page);
+    await summon(page, type.id);
+    await expect(fakeCursor(page)).toHaveAttribute('data-effect', type.effect.id);
+    await expect.poll(async () => (await hit(page)).length).toBeGreaterThan(0);
+
+    if (type.id === 'smoke-bombay') {
+      // Hidden behind smoke where they stand: smoked, and not moved at all.
+      const smoked = await hit(page);
+      for (const element of smoked) {
+        expect(element.filter).toMatch(/blur\(.+\) grayscale\(1\)/);
+        expect([element.dx, element.dy]).toEqual([0, 0]);
+        expect(element.scale).toBe('1');
+      }
+      // Each box where it was: the same as once the smoke has gone.
+      const during = await page.evaluate(() =>
+        Array.from(document.querySelectorAll<HTMLElement>('[data-e2e-hit]'), (el) => {
+          const r = el.getBoundingClientRect();
+          return [r.left, r.top, r.right, r.bottom].map(Math.round);
+        })
+      );
+      await expect(fakeCursor(page)).toHaveAttribute('data-effect', '', { timeout: 10_000 });
+      await expect.poll(() => restyled(page)).toEqual([]);
+      const after = await page.evaluate(() =>
+        Array.from(document.querySelectorAll<HTMLElement>('[data-e2e-hit]'), (el) => {
+          const r = el.getBoundingClientRect();
+          return [r.left, r.top, r.right, r.bottom].map(Math.round);
+        })
+      );
+      expect(during).toEqual(after);
+    }
+
+    if (type.id === 'pinball-devon') {
+      // Flung off, bouncing about, and never off the screen (nor further off than
+      // an element already was: its box less its displacement).
+      const size = page.viewportSize()!;
+      let furthest = 0;
+      for (let i = 0; i < 10; i++) {
+        for (const { box, dx, dy } of await hit(page)) {
+          const [left, top, right, bottom] = box;
+          furthest = Math.max(furthest, Math.hypot(dx, dy));
+          expect(left).toBeGreaterThanOrEqual(Math.min(0, left - dx) - 1);
+          expect(top).toBeGreaterThanOrEqual(Math.min(0, top - dy) - 1);
+          expect(right).toBeLessThanOrEqual(Math.max(size.width, right - dx) + 1);
+          expect(bottom).toBeLessThanOrEqual(Math.max(size.height, bottom - dy) + 1);
+        }
+        await page.waitForTimeout(150);
+      }
+      expect(furthest).toBeGreaterThan(100);
+    }
+
+    await expect(fakeCursor(page)).toHaveAttribute('data-effect', '', {
+      timeout: type.effect.durationMs + 5000,
     });
-  const texts = await textsOf();
-  const before = await htmlOf();
-  await summon(page, 'decoy-burmese');
-  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'decoys');
-  const scrambled = card.locator('[data-xenocat-hit="text"]').first();
-  await expect(scrambled).toBeAttached();
-  const shown = await scrambled.getAttribute('data-xenocat-hit-text');
-  expect(shown).not.toBe(await scrambled.textContent());
-  // The real text, which assistive technology reads, never changes.
-  await expect(card.getByRole('heading', { name: 'Decoy Burmese' })).toBeVisible();
-  expect(await textsOf()).toEqual(texts);
-  // After the effect (5 s) nothing is left of it.
-  await expect(card.locator('[data-xenocat-hit]')).toHaveCount(0, { timeout: 8000 });
-  // The card is exactly as it was before the cat came, and its guide entry carries
-  // nothing of the effect either.
-  expect(await htmlOf()).toBe(before);
-  await expect(
-    card
-      .getByTestId('guide-entry')
-      .locator('xpath=descendant-or-self::*[@style or @data-xenocat-hit-text]')
-  ).toHaveCount(0);
-});
+    await expect.poll(() => restyled(page)).toEqual([]);
+    await expect(page.locator('html')).not.toHaveAttribute('data-xenocat-puppets');
+  });
+}
diff --git a/tests/e2e/touch.spec.ts b/tests/e2e/touch.spec.ts
index 014cc0d..f9acbcb 100644
--- a/tests/e2e/touch.spec.ts
+++ b/tests/e2e/touch.spec.ts
@@ -26,11 +26,20 @@ test('on a touch screen the fake cursor stays off, and a cat attacks the page ar
   await expect(page.getByTestId('fake-cursor')).toHaveCount(0);
   expect(await page.locator('html').getAttribute('class')).not.toContain('xenocat-cursor-hidden');
 
-  // Once the cat has arrived it attacks: the button that was touched is pushed…
-  const before = await button.evaluate((el) =>
-    el.outerHTML.replace(/ data-xenocat-hit="[^"]*"/, '')
-  );
-  await expect(button).toHaveAttribute('data-xenocat-hit', 'push', { timeout: 5000 });
+  // Once the cat has arrived it attacks: the button that was touched is flung
+  // away, as the knockback flings a pointer… (It has no inline style of its own:
+  // any there now is the attack's.)
+  const before = await button.evaluate((el) => el.outerHTML.replace(/ style="[^"]*"/, ''));
+  await expect
+    .poll(
+      () =>
+        button.evaluate((el) => {
+          const [x, y] = (el as HTMLElement).style.translate.split(' ').map(parseFloat);
+          return Math.hypot(x || 0, y || 0);
+        }),
+      { timeout: 5000 }
+    )
+    .toBeGreaterThan(20);
   // …and a tap meanwhile still goes through: the card's other Summon button
   // summons.
   const status = page.getByTestId('summon-status');
@@ -38,6 +47,5 @@ test('on a touch screen the fake cursor stays off, and a cat attacks the page ar
   await asleep.tap();
   await expect(status).toContainText('Pulsar Siamese is on its way, and will nap');
   // When the effect is over (1.5 s) it is exactly as it was.
-  await expect(button).not.toHaveAttribute('data-xenocat-hit', { timeout: 5000 });
-  expect(await button.evaluate((el) => el.outerHTML)).toBe(before);
+  await expect.poll(() => button.evaluate((el) => el.outerHTML), { timeout: 5000 }).toBe(before);
 });
diff --git a/tests/unit/xenocats/combos.test.ts b/tests/unit/xenocats/combos.test.ts
index 29f06f6..c0ca071 100644
--- a/tests/unit/xenocats/combos.test.ts
+++ b/tests/unit/xenocats/combos.test.ts
@@ -12,7 +12,6 @@ import {
   knockback,
   restingLook,
 } from '@/app/ui/xenocats/effects';
-import { PAGE_HITS } from '@/app/ui/xenocats/page-hits';
 import { createRandom } from '@/app/ui/xenocats/random';
 
 const viewport = { width: 1200, height: 800 };
@@ -66,10 +65,6 @@ describe('the combos', () => {
     }
   });
 
-  it('each hits the page too, like every attack', () => {
-    for (const { effect } of COMBOS) expect(PAGE_HITS[effect.id], effect.id).toBeDefined();
-  });
-
   it('an angry combo throws the cursor further only where its parts do', () => {
     expect(comboBy('ghost-jump').effect.amplify).toBe('offset');
     expect(comboBy('static-fog').effect.amplify).toBe('offset');
diff --git a/tests/unit/xenocats/fake-cursor.test.tsx b/tests/unit/xenocats/fake-cursor.test.tsx
index 84035cb..6b20a23 100644
--- a/tests/unit/xenocats/fake-cursor.test.tsx
+++ b/tests/unit/xenocats/fake-cursor.test.tsx
@@ -201,7 +201,7 @@ describe('XenocatCursorProvider', () => {
     await waitFor(() => expect(save.outerHTML).toBe(before));
   });
 
-  it('calm: an attack only nudges the page near the pointer', async () => {
+  it('calm: an attack hits the page near the pointer as it does the cursor', async () => {
     window.localStorage.setItem(INTENSITY_KEY, 'calm');
     try {
       mockPointer(true);
@@ -215,8 +215,9 @@ describe('XenocatCursorProvider', () => {
       act(() => {
         cursor.attack(vanish, { x: 300, y: 300 });
       });
-      expect(save.getAttribute('data-xenocat-hit')).toBe('blur');
-      expect(save.style.opacity).toBe('');
+      // Vanish hides the button where it stands.
+      await waitFor(() => expect(save.style.opacity).toBe('0'));
+      expect(save.style.translate).toBe('0px 0px');
       clock = vanish.durationMs;
       await waitFor(() => expect(save.outerHTML).toBe(before));
     } finally {
@@ -252,20 +253,31 @@ describe('on a touch screen', () => {
     expect(screen.queryByTestId('fake-cursor')).toBeNull();
     const save = screen.getByText('Save');
     save.getBoundingClientRect = () =>
-      ({ left: 0, top: 0, right: 60, bottom: 20, x: 0, y: 0, width: 60, height: 20 }) as DOMRect;
+      ({
+        left: 100,
+        top: 100,
+        right: 160,
+        bottom: 120,
+        x: 100,
+        y: 100,
+        width: 60,
+        height: 20,
+      }) as DOMRect;
     const before = save.outerHTML;
 
     // No touch yet: nothing to attack.
     expect(cursor.attack(quickJitter, { x: 300, y: 300 })).toBe(false);
     expect(cursor.touchPoint()).toBeNull();
 
-    fireEvent.pointerDown(window, { clientX: 10, clientY: 10, pointerType: 'touch' });
-    expect(cursor.touchPoint()).toEqual({ x: 10, y: 10 });
+    fireEvent.pointerDown(window, { clientX: 110, clientY: 110, pointerType: 'touch' });
+    expect(cursor.touchPoint()).toEqual({ x: 110, y: 110 });
     expect(cursor.position()).toBeNull();
     act(() => {
       expect(cursor.attack(quickJitter, { x: 300, y: 300 })).toBe(true);
     });
-    expect(save.getAttribute('data-xenocat-hit')).toBe('shake');
+    // Jitter shakes the button: it is moved, a little.
+    expect(save.style.translate).not.toBe('');
+    expect(save.style.translate).not.toBe('0px 0px');
     expect(cursor.isBusy()).toBe(true);
     // One at a time.
     expect(cursor.attack(quickJitter, { x: 300, y: 300 })).toBe(false);
@@ -291,7 +303,7 @@ describe('on a touch screen', () => {
     act(() => {
       expect(cursor.attack({ ...vanish, durationMs: 5000 }, { x: 300, y: 300 })).toBe(true);
     });
-    expect(save.hasAttribute('data-xenocat-hit')).toBe(false);
+    expect(save.hasAttribute('style')).toBe(false);
     expect(cursor.isBusy()).toBe(false);
     fireEvent.click(save, { detail: 1 });
     expect(onClick).toHaveBeenCalledTimes(1);
@@ -307,9 +319,9 @@ describe('on a touch screen', () => {
     act(() => {
       cursor.attack({ ...jitter, durationMs: 5000 }, { x: 300, y: 300 });
     });
-    expect(save.hasAttribute('data-xenocat-hit')).toBe(true);
+    expect(save.hasAttribute('style')).toBe(true);
     cleanup();
-    expect(save.hasAttribute('data-xenocat-hit')).toBe(false);
+    expect(save.hasAttribute('style')).toBe(false);
   });
 });
 
diff --git a/tests/unit/xenocats/page-hits.test.ts b/tests/unit/xenocats/page-hits.test.ts
index 52c48bd..e51d1e2 100644
--- a/tests/unit/xenocats/page-hits.test.ts
+++ b/tests/unit/xenocats/page-hits.test.ts
@@ -1,18 +1,10 @@
 // @vitest-environment jsdom
 import { afterEach, describe, expect, it } from 'vitest';
-import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
 import {
   HIT_LEVELS,
-  HIT_ATTRIBUTE,
-  PAGE_HITS,
-  TEXT_ATTRIBUTE,
-  applyHits,
   distanceToRect,
-  hitPage,
-  hitText,
   pickAnywhere,
   pickTargets,
-  scrambleText,
   selectTargets,
 } from '@/app/ui/xenocats/page-hits';
 import { createRandom } from '@/app/ui/xenocats/random';
@@ -34,11 +26,9 @@ function place(element: Element, left: number, top: number, width: number, heigh
     ({ ...rect(left, top, width, height), x: left, y: top, width, height }) as DOMRect;
 }
 
-describe('every attack hits the page', () => {
-  it('each cat type has a page effect', () => {
-    for (const type of CAT_TYPES) expect(PAGE_HITS[type.effect.id], type.id).toBeDefined();
-  });
-});
+/** The ids of the elements a calm attack at `pointer` hits. */
+const calmTargets = (pointer: { x: number; y: number }) =>
+  pickTargets(document.body, pointer, HIT_LEVELS.calm.reach, createRandom(1)).map((el) => el.id);
 
 describe('target selection', () => {
   const none = () => false;
@@ -79,26 +69,16 @@ describe('target selection', () => {
     ).toEqual([]);
   });
 
-  it('hitPage skips the cats, the cursor and anything hidden from assistive technology', () => {
+  it('skips the cats, the cursor and anything hidden from assistive technology', () => {
     document.body.innerHTML = `
       <button id="ok">Pay</button>
       <div aria-hidden="true"><button id="cat">cat</button></div>
       <div data-xenocat-ignore><p id="game">game</p></div>`;
     for (const id of ['ok', 'cat', 'game']) place(document.getElementById(id)!, 10, 10, 50, 20);
-    const restore = hitPage(
-      document.body,
-      'jitter',
-      { x: 20, y: 20 },
-      { x: 0, y: 0 },
-      createRandom(1)
-    );
-    expect(document.getElementById('ok')!.getAttribute(HIT_ATTRIBUTE)).toBe('shake');
-    expect(document.getElementById('cat')!.hasAttribute(HIT_ATTRIBUTE)).toBe(false);
-    expect(document.getElementById('game')!.hasAttribute(HIT_ATTRIBUTE)).toBe(false);
-    restore!();
+    expect(calmTargets({ x: 20, y: 20 })).toEqual(['ok']);
   });
 
-  it('hitPage leaves a field being typed in alone, and skips hidden 1 px labels', () => {
+  it('leaves a field being typed in alone, and skips hidden 1 px labels', () => {
     document.body.innerHTML = `
       <label id="sr" class="sr-only" for="q">Search</label>
       <div data-xenocat-card id="box"><input id="q" /></div>
@@ -108,18 +88,7 @@ describe('target selection', () => {
     place(document.getElementById('q')!, 10, 10, 150, 20);
     place(document.getElementById('ok')!, 10, 50, 50, 20);
     (document.getElementById('q') as HTMLInputElement).focus();
-    const restore = hitPage(
-      document.body,
-      'reverse',
-      { x: 20, y: 20 },
-      { x: 0, y: 0 },
-      createRandom(1)
-    );
-    for (const id of ['sr', 'q', 'box']) {
-      expect(document.getElementById(id)!.hasAttribute(HIT_ATTRIBUTE), id).toBe(false);
-    }
-    expect(document.getElementById('ok')!.getAttribute(HIT_ATTRIBUTE)).toBe('flip');
-    restore!();
+    expect(calmTargets({ x: 20, y: 20 })).toEqual(['ok']);
   });
 
   it('hits a table row as a whole', () => {
@@ -128,25 +97,14 @@ describe('target selection', () => {
     place(document.getElementById('row')!, 0, 0, 300, 30);
     place(document.getElementById('a')!, 0, 0, 150, 30);
     place(document.getElementById('b')!, 150, 0, 150, 30);
-    const restore = hitPage(
-      document.body,
-      'jitter',
-      { x: 20, y: 10 },
-      { x: 0, y: 0 },
-      createRandom(1)
-    );
-    expect(document.getElementById('row')!.getAttribute(HIT_ATTRIBUTE)).toBe('shake');
-    expect(document.getElementById('a')!.hasAttribute(HIT_ATTRIBUTE)).toBe(false);
-    restore!();
+    expect(calmTargets({ x: 20, y: 10 })).toEqual(['row']);
   });
 
-  it('hitPage hits nothing, and returns null, with nothing near or on screen', () => {
+  it('hits nothing with nothing near or on screen', () => {
     document.body.innerHTML = '<button id="far">Far</button>';
     // Off screen (jsdom's window is 1024 × 768).
     place(document.getElementById('far')!, 900, 900, 50, 20);
-    expect(
-      hitPage(document.body, 'jitter', { x: 0, y: 0 }, { x: 0, y: 0 }, createRandom(1))
-    ).toBeNull();
+    expect(calmTargets({ x: 0, y: 0 })).toEqual([]);
   });
 });
 
@@ -178,12 +136,11 @@ describe('attacks that move elements reach further', () => {
     expect(one).toHaveLength(1);
   });
 
-  it('calm reaches only what is near the pointer; normal and chaos reach panels and far off', () => {
+  it('calm reaches only what is near the pointer, moved less; normal and chaos reach panels and far off', () => {
     const { calm, normal, chaos } = HIT_LEVELS;
-    expect(calm.puppets).toBeNull();
     expect(calm.reach).toMatchObject({ anywhere: 0, frames: false });
+    expect(calm.puppets.fling).toBeLessThan(normal.puppets.fling);
     for (const level of [normal, chaos]) {
-      expect(level.puppets).not.toBeNull();
       expect(level.reach.frames).toBe(true);
       expect(level.reach.anywhere).toBeGreaterThan(0);
     }
@@ -191,8 +148,7 @@ describe('attacks that move elements reach further', () => {
     expect(chaos.reach.max + chaos.reach.anywhere).toBeGreaterThan(
       normal.reach.max + normal.reach.anywhere
     );
-    expect(chaos.puppets!.fling).toBeGreaterThan(normal.puppets!.fling);
-    expect(chaos.puppets!.weird).toBeGreaterThan(normal.puppets!.weird);
+    expect(chaos.puppets.fling).toBeGreaterThan(normal.puppets.fling);
   });
 
   it('pickTargets takes panels and elements anywhere on screen, but never a field being typed in', () => {
@@ -216,102 +172,4 @@ describe('attacks that move elements reach further', () => {
     // Calm: no panels and nothing far off; the text inside the panel instead.
     expect(ids(HIT_LEVELS.calm.reach)).toEqual(['text']);
   });
-
-  it('hitText scrambles or swaps text for the attacks that do, and nothing else', () => {
-    document.body.innerHTML = '<p id="a">Paid</p><p id="b">Pending</p>';
-    const targets = ['a', 'b'].map((id) => document.getElementById(id)!);
-    expect(hitText(targets, 'bounce', createRandom(1))).toBeNull();
-    const restore = hitText(targets, 'teleport', createRandom(1))!;
-    expect(targets[0].getAttribute(TEXT_ATTRIBUTE)).toBe('Pending');
-    restore();
-    expect(targets[0].hasAttribute(TEXT_ATTRIBUTE)).toBe(false);
-  });
-});
-
-describe('scrambled text', () => {
-  it('shuffles letters within words and keeps spaces and punctuation', () => {
-    const text = 'Create invoice, now!';
-    const out = scrambleText(text, createRandom(3));
-    expect(out).not.toBe(text);
-    expect(out).toHaveLength(text.length);
-    expect(out.replace(/[\p{L}]/gu, '_')).toBe(text.replace(/[\p{L}]/gu, '_'));
-    const sorted = (s: string) => [...s.replace(/[^\p{L}]/gu, '')].sort().join('');
-    expect(sorted(out)).toBe(sorted(text));
-  });
-});
-
-describe('every effect reverts exactly', () => {
-  const page = `
-    <div data-xenocat-card class="card" id="card">
-      <h2 id="title">Total paid</h2>
-      <p id="sum" style="color: red">$1,200.00</p>
-      <a href="/x" id="link" class="link">Details</a>
-      <button id="btn" style="transform: translateX(2px); margin: 0px">Pay now</button>
-    </div>
-    <input id="field" value="typing" />`;
-
-  for (const [effectId, style] of Object.entries(PAGE_HITS)) {
-    it(`${effectId} (${style.kind})`, () => {
-      document.body.innerHTML = page;
-      const field = document.getElementById('field') as HTMLInputElement;
-      field.focus();
-      const before = document.body.innerHTML;
-      const texts = Array.from(document.querySelectorAll('*'), (el) => el.textContent);
-      const targets = ['title', 'sum', 'link', 'btn', 'field'].map((id) =>
-        document.getElementById(id)!
-      );
-      targets.forEach((el, i) => place(el, 10 + i * 60, 10, 50, 20));
-
-      const restore = applyHits(targets, style, { x: 0, y: 0 }, createRandom(7));
-      // Something happened to every target...
-      for (const el of targets) expect(el.hasAttribute(HIT_ATTRIBUTE), el.id).toBe(true);
-      // ...but the real text (what assistive technology reads) never changed,
-      // focus stayed put, and the focused field got no text.
-      expect(Array.from(document.querySelectorAll('*'), (el) => el.textContent)).toEqual(texts);
-      expect(document.activeElement).toBe(field);
-      expect(field.hasAttribute(TEXT_ATTRIBUTE)).toBe(false);
-      expect(field.value).toBe('typing');
-
-      restore();
-      expect(document.body.innerHTML).toBe(before);
-      expect(document.activeElement).toBe(field);
-    });
-  }
-
-  it('scrambling draws other text over the real text', () => {
-    document.body.innerHTML = '<p id="p">Latest invoices</p>';
-    const p = document.getElementById('p')!;
-    const restore = applyHits([p], PAGE_HITS.decoys, { x: 0, y: 0 }, createRandom(2));
-    expect(p.getAttribute(HIT_ATTRIBUTE)).toBe('text');
-    const shown = p.getAttribute(TEXT_ATTRIBUTE)!;
-    expect(shown).not.toBe('Latest invoices');
-    expect(shown).toHaveLength('Latest invoices'.length);
-    expect(p.textContent).toBe('Latest invoices');
-    restore();
-    expect(p.outerHTML).toBe('<p id="p">Latest invoices</p>');
-  });
-
-  it('swapping trades the text of two elements', () => {
-    document.body.innerHTML = '<p id="a">Paid</p><p id="b">Pending</p>';
-    const [a, b] = [document.getElementById('a')!, document.getElementById('b')!];
-    const restore = applyHits([a, b], PAGE_HITS.teleport, { x: 0, y: 0 }, createRandom(2));
-    expect(a.getAttribute(TEXT_ATTRIBUTE)).toBe('Pending');
-    expect(b.getAttribute(TEXT_ATTRIBUTE)).toBe('Paid');
-    restore();
-    expect(document.body.innerHTML).toBe('<p id="a">Paid</p><p id="b">Pending</p>');
-  });
-
-  it('a push moves away from the cat, or towards it for the magnet', () => {
-    document.body.innerHTML = '<button id="b">Go</button>';
-    const button = document.getElementById('b')!;
-    place(button, 100, 100, 20, 20);
-    const cat = { x: 0, y: 110 };
-    let restore = applyHits([button], PAGE_HITS.knockback, cat, createRandom(1));
-    expect(parseFloat(button.style.getPropertyValue('--xenocat-hit-dx'))).toBeGreaterThan(0);
-    restore();
-    restore = applyHits([button], PAGE_HITS.magnet, cat, createRandom(1));
-    expect(parseFloat(button.style.getPropertyValue('--xenocat-hit-dx'))).toBeLessThan(0);
-    restore();
-    expect(button.outerHTML).toBe('<button id="b">Go</button>');
-  });
 });
diff --git a/tests/unit/xenocats/puppets.test.ts b/tests/unit/xenocats/puppets.test.ts
index ff39bcf..c27a8f5 100644
--- a/tests/unit/xenocats/puppets.test.ts
+++ b/tests/unit/xenocats/puppets.test.ts
@@ -1,22 +1,17 @@
 // @vitest-environment jsdom
 import { afterEach, describe, expect, it } from 'vitest';
+import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
+import { COMBOS } from '@/app/ui/xenocats/combos';
 import {
   type Effect,
+  ICE,
+  JITTER_PX,
+  DRUNK_AMPLITUDE,
   bounce,
-  giant,
-  heavy,
-  restingLook,
-  reverse,
-  spiral,
-  vanish,
+  knockback,
 } from '@/app/ui/xenocats/effects';
 import { HIT_LEVELS } from '@/app/ui/xenocats/page-hits';
-import {
-  PUPPETS_ATTRIBUTE,
-  WANDER_PX,
-  createPuppetTheatre,
-  twistFor,
-} from '@/app/ui/xenocats/puppets';
+import { PUPPETS_ATTRIBUTE, createPuppetTheatre, span } from '@/app/ui/xenocats/puppets';
 import { createRandom } from '@/app/ui/xenocats/random';
 
 afterEach(() => {
@@ -24,22 +19,26 @@ afterEach(() => {
 });
 
 const viewport = { width: 1200, height: 800 };
-const cat = { x: 100, y: 100 };
-const normal = { ...HIT_LEVELS.normal.puppets!, weird: 0 };
-const chaos = { ...HIT_LEVELS.chaos.puppets!, weird: 0 };
+const cat = { x: 200, y: 200 };
+const home = { x: 400, y: 300 };
+const { calm, normal, chaos } = {
+  calm: HIT_LEVELS.calm.puppets,
+  normal: HIT_LEVELS.normal.puppets,
+  chaos: HIT_LEVELS.chaos.puppets,
+};
 
-/** An element whose centre is at (x, y), 100 × 40 px. */
-function element(x: number, y: number, attributes = '') {
+/** An element whose centre is at (x, y), 100 × 40 px unless told otherwise. */
+function element(x: number, y: number, attributes = '', width = 100, height = 40) {
   document.body.insertAdjacentHTML('beforeend', `<button ${attributes}>Pay</button>`);
   const button = document.body.lastElementChild as HTMLElement;
   button.getBoundingClientRect = () =>
     ({
-      left: x - 50,
-      top: y - 20,
-      right: x + 50,
-      bottom: y + 20,
-      width: 100,
-      height: 40,
+      left: x - width / 2,
+      top: y - height / 2,
+      right: x + width / 2,
+      bottom: y + height / 2,
+      width,
+      height,
     }) as DOMRect;
   return button;
 }
@@ -50,111 +49,306 @@ const moved = (el: HTMLElement) => {
   return { x, y: y ?? 0 };
 };
 
-/** Lets the "pointer" through as it is: what the element does is its own wandering alone. */
-const follow: Effect = {
-  id: 'follow',
-  name: 'Follow',
-  description: 'test only',
-  durationMs: 3000,
-  step: ({ real }) => ({ look: restingLook(real) }),
+type Frame = {
+  at: number;
+  d: { x: number; y: number };
+  scale: number;
+  opacity: string;
+  filter: string;
 };
 
+/** One element under `effect`, frame by frame for as long as it lasts, then one frame after. */
+function run(effect: Effect, settings = normal, at = home, attributes = '', seed = 5) {
+  const theatre = createPuppetTheatre({ random: createRandom(seed) });
+  const el = element(at.x, at.y, attributes);
+  theatre.add([el], effect, cat, 0, settings);
+  const frames: Frame[] = [];
+  for (let now = 0; now < effect.durationMs; now += 16) {
+    theatre.frame(now, viewport);
+    frames.push({
+      at: now,
+      d: moved(el),
+      scale: Number(el.style.scale),
+      opacity: el.style.opacity,
+      filter: el.style.filter,
+    });
+  }
+  theatre.frame(effect.durationMs, viewport);
+  return { frames, el, theatre };
+}
+
+const length = (v: { x: number; y: number }) => Math.hypot(v.x, v.y);
+const centre = (f: Frame, from = home) => ({ x: from.x + f.d.x, y: from.y + f.d.y });
+const toCat = (f: Frame) => length({ x: centre(f).x - cat.x, y: centre(f).y - cat.y });
+const at = (frames: Frame[], ms: number) => frames.find((f) => f.at >= ms)!;
+const last = (frames: Frame[]) => frames[frames.length - 1];
+
+type Motion =
+  | 'still'
+  | 'shakes'
+  | 'away'
+  | 'drifts'
+  | 'jumps'
+  | 'toward'
+  | 'circles'
+  | 'sways'
+  | 'falls'
+  | 'spirals'
+  | 'bounces'
+  | 'away, then back';
+type Look = 'plain' | 'hidden' | 'frost' | 'smoke' | 'shrinks' | 'grows' | 'pulses' | 'faint';
+
 /**
- * One element under `effect` (and the same element under `follow`, wandering the
- * same way: the same seed gives the same path), run to `until` ms.
+ * What every attack does to a page element, as decisions.md's table says (D4): it
+ * moves only if the attack moves a pointer held still, and looks as the cursor does.
  */
-function compare(effect: Effect, until: number, settings = normal) {
-  const run = (e: Effect) => {
-    const theatre = createPuppetTheatre({ random: createRandom(7) });
-    const button = element(600, 400);
-    theatre.add([button], e, cat, 0, settings);
-    for (let now = 0; now <= until; now += 16) theatre.frame(now, viewport);
-    return moved(button);
-  };
-  return { under: run(effect), alone: run(follow) };
-}
+const TABLE: Record<string, { moves: Motion; looks: Look }> = {
+  vanish: { moves: 'still', looks: 'hidden' },
+  heavy: { moves: 'still', looks: 'plain' },
+  knockback: { moves: 'away', looks: 'plain' },
+  reverse: { moves: 'still', looks: 'plain' },
+  jitter: { moves: 'shakes', looks: 'plain' },
+  freeze: { moves: 'still', looks: 'frost' },
+  drift: { moves: 'drifts', looks: 'plain' },
+  teleport: { moves: 'jumps', looks: 'plain' },
+  magnet: { moves: 'toward', looks: 'plain' },
+  orbit: { moves: 'circles', looks: 'plain' },
+  decoys: { moves: 'still', looks: 'plain' },
+  drunk: { moves: 'sways', looks: 'plain' },
+  tiny: { moves: 'still', looks: 'shrinks' },
+  giant: { moves: 'still', looks: 'grows' },
+  delay: { moves: 'still', looks: 'plain' },
+  fall: { moves: 'falls', looks: 'plain' },
+  blur: { moves: 'still', looks: 'smoke' },
+  spiral: { moves: 'spirals', looks: 'plain' },
+  bounce: { moves: 'bounces', looks: 'plain' },
+  'axis-lock': { moves: 'still', looks: 'plain' },
+  // The combos.
+  'ice-puck': { moves: 'bounces', looks: 'frost' },
+  slingshot: { moves: 'away, then back', looks: 'plain' },
+  hangover: { moves: 'sways', looks: 'plain' },
+  'ghost-jump': { moves: 'jumps', looks: 'faint' },
+  pulsar: { moves: 'still', looks: 'pulses' },
+  'static-fog': { moves: 'shakes', looks: 'smoke' },
+};
 
-describe('page elements attacked as the cursor is', () => {
-  it('move on their own, the mouse nowhere involved, each on a path of its own', () => {
-    const theatre = createPuppetTheatre({ random: createRandom(1) });
-    const a = element(300, 300);
-    const b = element(900, 500);
-    theatre.add([a, b], follow, cat, 0, normal);
-    const seen = new Set<string>();
-    for (let now = 0; now <= 2000; now += 100) {
-      theatre.frame(now, viewport);
-      seen.add(a.style.translate);
-      expect(Math.hypot(moved(a).x, moved(a).y)).toBeLessThanOrEqual(2 * WANDER_PX * Math.SQRT2);
+const EFFECTS: Effect[] = [
+  ...CAT_TYPES.map((type) => type.effect),
+  ...COMBOS.map((combo) => combo.effect),
+];
+
+function expectMotion(moves: Motion, frames: Frame[]) {
+  const distances = frames.map((f) => length(f.d));
+  const furthest = Math.max(...distances);
+  switch (moves) {
+    case 'still':
+      for (const f of frames) expect(f.d).toEqual({ x: 0, y: 0 });
+      break;
+    case 'shakes': {
+      expect(furthest).toBeGreaterThan(0);
+      expect(furthest).toBeLessThanOrEqual(JITTER_PX * Math.SQRT2 + 1);
+      expect(new Set(frames.map((f) => `${f.d.x},${f.d.y}`)).size).toBeGreaterThan(10);
+      break;
+    }
+    case 'away': {
+      const end = last(frames).d;
+      expect(length(end)).toBeGreaterThan(200);
+      // Away from the cat: the same way as from the cat to the element.
+      expect(end.x * (home.x - cat.x) + end.y * (home.y - cat.y)).toBeGreaterThan(0);
+      break;
+    }
+    case 'drifts': {
+      const [one, two] = [at(frames, 1000).d, at(frames, 2000).d];
+      expect(length(two)).toBeGreaterThan(length(one) + 50);
+      // One way all along.
+      expect(Math.abs(Math.atan2(one.y, one.x) - Math.atan2(two.y, two.x))).toBeLessThan(0.05);
+      break;
+    }
+    case 'jumps': {
+      // A few spots, and nothing in between: it jumps, it does not slide.
+      const spots = new Set(frames.map((f) => `${f.d.x},${f.d.y}`));
+      expect(spots.size).toBeGreaterThan(1);
+      expect(spots.size).toBeLessThanOrEqual(3);
+      expect(furthest).toBeGreaterThan(50);
+      break;
+    }
+    case 'toward':
+      expect(toCat(last(frames))).toBeLessThan(toCat(frames[0]) / 2);
+      break;
+    case 'circles': {
+      const rest = frames.slice(1);
+      for (const f of rest) expect(Math.abs(toCat(f) - 140)).toBeLessThan(3);
+      const angles = rest.map((f) => Math.atan2(centre(f).y - cat.y, centre(f).x - cat.x));
+      expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(Math.PI);
+      break;
+    }
+    case 'sways': {
+      expect(furthest).toBeGreaterThan(10);
+      expect(furthest).toBeLessThanOrEqual(DRUNK_AMPLITUDE * Math.SQRT2 + 1);
+      expect(frames.some((f) => f.d.x > 5)).toBe(true);
+      expect(frames.some((f) => f.d.x < -5)).toBe(true);
+      break;
+    }
+    case 'falls': {
+      for (const f of frames) expect(f.d.x).toBe(0);
+      for (let i = 1; i < frames.length; i++) {
+        expect(frames[i].d.y).toBeGreaterThanOrEqual(frames[i - 1].d.y);
+      }
+      expect(last(frames).d.y).toBeGreaterThan(200);
+      break;
+    }
+    case 'spirals': {
+      const end = centre(last(frames));
+      expect(length({ x: end.x - 600, y: end.y - 400 })).toBeLessThan(60);
+      break;
+    }
+    case 'bounces': {
+      expect(furthest).toBeGreaterThan(200);
+      // Off the edges and back: it turns round at least once on each axis... or one.
+      const steps = frames.slice(1).map((f, i) => ({
+        x: f.d.x - frames[i].d.x,
+        y: f.d.y - frames[i].d.y,
+      }));
+      const turned = (axis: 'x' | 'y') =>
+        steps.some((s) => s[axis] > 0) && steps.some((s) => s[axis] < 0);
+      expect(turned('x') || turned('y')).toBe(true);
+      break;
     }
-    expect(seen.size).toBeGreaterThan(10);
-    expect(moved(a)).not.toEqual(moved(b));
+    case 'away, then back': {
+      const flung = toCat(at(frames, 1000));
+      expect(flung).toBeGreaterThan(toCat(frames[0]) + 100);
+      expect(toCat(last(frames))).toBeLessThan(toCat(frames[0]));
+      break;
+    }
+  }
+}
+
+function expectLook(looks: Look, frames: Frame[]) {
+  const mid = at(frames, 200);
+  if (looks !== 'hidden' && looks !== 'smoke' && looks !== 'faint') {
+    for (const f of frames) expect(f.opacity).toBe('1');
+  }
+  if (looks !== 'frost' && looks !== 'smoke') for (const f of frames) expect(f.filter).toBe('');
+  if (!['shrinks', 'grows', 'pulses'].includes(looks)) {
+    for (const f of frames) expect(f.scale).toBe(1);
+  }
+  switch (looks) {
+    case 'hidden':
+      for (const f of frames) expect(f.opacity).toBe('0');
+      break;
+    case 'frost':
+      for (const f of frames) expect(f.filter).toContain(`drop-shadow(0 0 4px ${ICE})`);
+      break;
+    case 'smoke':
+      for (const f of frames) {
+        expect(f.filter).toMatch(/blur\(\d+(\.\d+)?px\) grayscale\(1\)/);
+        expect(Number(f.opacity)).toBeLessThan(1);
+      }
+      break;
+    case 'shrinks':
+      expect(mid.scale).toBeLessThan(1);
+      break;
+    case 'grows':
+      expect(mid.scale).toBeGreaterThan(1);
+      break;
+    case 'pulses':
+      expect(frames.some((f) => f.scale < 1)).toBe(true);
+      expect(frames.some((f) => f.scale > 1)).toBe(true);
+      break;
+    case 'faint':
+      expect(Number(mid.opacity)).toBeGreaterThan(0);
+      expect(Number(mid.opacity)).toBeLessThan(0.5);
+      break;
+  }
+}
+
+describe('every attack does to a page element what it does to the pointer', () => {
+  it('the table covers every cat’s attack and every combo, and nothing else', () => {
+    expect(Object.keys(TABLE).sort()).toEqual(EFFECTS.map((effect) => effect.id).sort());
   });
 
-  it('reverse runs an element’s wandering backwards; heavy drags it', () => {
-    const backwards = compare(reverse, 1500);
-    expect(backwards.under.x).toBeCloseTo(-backwards.alone.x, 0);
-    expect(backwards.under.y).toBeCloseTo(-backwards.alone.y, 0);
-    const dragged = compare(heavy, 1500);
-    expect(Math.hypot(dragged.under.x, dragged.under.y)).toBeLessThan(
-      Math.hypot(dragged.alone.x, dragged.alone.y)
-    );
+  for (const effect of EFFECTS) {
+    const { moves, looks } = TABLE[effect.id] ?? {};
+    it(`${effect.id}: moves ${moves}, looks ${looks}, and is put back exactly`, () => {
+      const { frames, el } = run(effect, normal, home, 'style="color: red;"');
+      expectMotion(moves, frames);
+      expectLook(looks, frames);
+      expect(el.getAttribute('style')).toBe('color: red;');
+      expect(document.documentElement.hasAttribute(PUPPETS_ATTRIBUTE)).toBe(false);
+    });
+  }
+
+  // An attack that puts the pointer somewhere (the middle, round the cat, off the
+  // edges) puts an element there at every level, and a panel too: only how far an
+  // attack *throws* it depends on the level.
+  for (const effect of EFFECTS.filter((e) => e.amplify !== 'offset')) {
+    const { moves } = TABLE[effect.id] ?? {};
+    it(`${effect.id}: moves ${moves} when calm, in chaos, and as a panel`, () => {
+      expectMotion(moves, run(effect, calm).frames);
+      document.body.innerHTML = '';
+      expectMotion(moves, run(effect, chaos).frames);
+      document.body.innerHTML = '';
+      expectMotion(moves, run(effect, normal, home, 'data-xenocat-frame').frames);
+    });
+  }
+
+  it('the element never leaves the viewport, even flung by chaos', () => {
+    for (const effect of EFFECTS) {
+      for (const seed of [1, 2, 3]) {
+        for (const f of run(effect, chaos, home, '', seed).frames) {
+          const c = centre(f);
+          expect(c.x - 50, effect.id).toBeGreaterThanOrEqual(0);
+          expect(c.x + 50, effect.id).toBeLessThanOrEqual(viewport.width);
+          expect(c.y - 20, effect.id).toBeGreaterThanOrEqual(0);
+          expect(c.y + 20, effect.id).toBeLessThanOrEqual(viewport.height);
+        }
+        document.body.innerHTML = '';
+      }
+    }
   });
 
-  it('pinball bounces them about the screen, each its own way', () => {
-    const theatre = createPuppetTheatre({ random: createRandom(3) });
-    const a = element(300, 300);
-    const b = element(900, 500);
-    theatre.add([a, b], bounce, cat, 0, normal);
-    let furthest = 0;
-    for (let now = 0; now <= 2000; now += 16) {
-      theatre.frame(now, viewport);
-      furthest = Math.max(furthest, Math.hypot(moved(a).x, moved(a).y));
+  it('one already partly off screen is never pulled further off, nor pulled in by an attack that does not move it', () => {
+    const top = { x: 600, y: 5 };
+    for (const f of run(knockback, chaos, { ...top }).frames) {
+      expect(f.d.y).toBeGreaterThanOrEqual(0);
     }
-    expect(furthest).toBeGreaterThan(200);
-    expect(moved(a)).not.toEqual(moved(b));
+    const frost = EFFECTS.find((effect) => effect.id === 'freeze')!;
+    for (const f of run(frost, chaos, top).frames) expect(f.d).toEqual({ x: 0, y: 0 });
   });
 
-  it('spiral draws them in to the middle of the screen', () => {
-    const theatre = createPuppetTheatre({ random: createRandom(1) });
-    const button = element(200, 200);
-    theatre.add([button], spiral, cat, 0, normal);
-    for (let now = 0; now < spiral.durationMs; now += 16) theatre.frame(now, viewport);
-    const at = { x: 200 + moved(button).x, y: 200 + moved(button).y };
-    expect(Math.hypot(at.x - 600, at.y - 400)).toBeLessThan(60);
+  it('calm moves an element half as far as normal', () => {
+    const tame = last(run(knockback, calm).frames).d;
+    const full = last(run(knockback, normal).frames).d;
+    expect(tame.x).toBeCloseTo(full.x * calm.fling, -1);
+    expect(tame.y).toBeCloseTo(full.y * calm.fling, -1);
   });
 
-  it('vanish hides them; giant grows them, within the level’s limit', () => {
-    const theatre = createPuppetTheatre({ random: createRandom(1) });
-    const hidden = element(300, 300);
-    const big = element(800, 300);
-    theatre.add([hidden], vanish, cat, 0, normal);
-    theatre.add([big], giant, cat, 0, normal);
-    theatre.frame(100, viewport);
-    expect(hidden.style.opacity).toBe('0');
-    expect(big.style.scale).toBe(`${normal.scale[1]} ${normal.scale[1]}`);
+  it('a panel goes less far than a button when normal', () => {
+    const button = last(run(knockback, normal).frames).d;
+    const panel = last(run(knockback, normal, home, 'data-xenocat-frame').frames).d;
+    expect(panel.x).toBeCloseTo(button.x * normal.frameFling, -1);
   });
+});
 
-  it('chaos flings them further; a panel goes less far when normal', () => {
-    const wild = compare(follow, 1500, chaos);
-    const tame = compare(follow, 1500, normal);
-    expect(wild.under.x).toBeCloseTo(tame.under.x * chaos.fling, 0);
-    const theatre = createPuppetTheatre({ random: createRandom(7) });
-    const panel = element(600, 400, 'data-xenocat-frame');
-    theatre.add([panel], follow, cat, 0, normal);
-    for (let now = 0; now <= 1500; now += 16) theatre.frame(now, viewport);
-    expect(moved(panel).x).toBeCloseTo(tame.under.x * normal.frameFling, 0);
+describe('the span an element may move in', () => {
+  it('keeps its box inside the viewport, or no further out than it is', () => {
+    expect(span(400, 100, 1200)).toEqual([50, 1150]);
+    expect(span(10, 100, 1200)).toEqual([10, 1150]);
+    // Bigger than the screen: it stays where it is.
+    expect(span(600, 1500, 1200)).toEqual([600, 600]);
   });
+});
 
+describe('the theatre', () => {
   it('an element hit by two attacks moves by both', () => {
-    const one = compare(follow, 1000);
     const theatre = createPuppetTheatre({ random: createRandom(7) });
-    const button = element(600, 400);
-    theatre.add([button], follow, cat, 0, normal);
-    theatre.add([button], follow, cat, 0, normal);
-    for (let now = 0; now <= 1000; now += 16) theatre.frame(now, viewport);
-    // Two wanderings at once: further than either alone would go, in all.
-    expect(moved(button)).not.toEqual(one.under);
-    expect(button.style.translate).not.toBe('');
+    const button = element(home.x, home.y);
+    theatre.add([button], knockback, cat, 0, normal);
+    theatre.frame(1000, viewport);
+    const once = moved(button);
+    theatre.add([button], knockback, cat, 1000, normal);
+    theatre.frame(1400, viewport);
+    expect(length(moved(button))).toBeGreaterThan(length(once) + 100);
   });
 
   it('puts the style back exactly when the attack ends, and marks the page while it lasts', () => {
@@ -182,18 +376,3 @@ describe('page elements attacked as the cursor is', () => {
     expect(document.documentElement.hasAttribute(PUPPETS_ATTRIBUTE)).toBe(false);
   });
 });
-
-describe('weird twists', () => {
-  it('never at 0, always at 1; slight when normal, wild in chaos', () => {
-    const random = createRandom(4);
-    for (let i = 0; i < 50; i++) {
-      expect(twistFor(random, 0, true)).toEqual({ rotate: 0, scaleX: 1, scaleY: 1 });
-      const slight = twistFor(random, 1, false);
-      expect(Math.abs(slight.rotate)).toBeLessThanOrEqual(8);
-      expect(slight.scaleX).toBeGreaterThanOrEqual(0.9);
-    }
-    const wild = Array.from({ length: 60 }, () => twistFor(random, 1, true));
-    expect(wild.some((t) => t.rotate === 180)).toBe(true);
-    expect(wild.some((t) => t.scaleX < 0)).toBe(true);
-  });
-});
~~~~

</details>

#### T4 — `night-2026-10-07-t4-game-pages`

Survival and Taming moved onto pages of their own (`/cats/survival`, `/cats/taming`); a touch movement pad (`movement-pad.ts`, `movement-pad-view.tsx`); its CI repair (the unit test named in a CI group). Why: plan task 4 (D12–D16).

<details><summary>Code: 10 files changed, 761 insertions(+), 342 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 1ef172f..33cec4f 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -50,7 +50,7 @@ jobs:
           npx vitest run tests/unit/xenocats/survival tests/unit/xenocats/locked-pointer
           tests/unit/xenocats/taming tests/unit/xenocats/page-hits tests/unit/xenocats/sounds
           tests/unit/xenocats/field-guide tests/unit/xenocats/pet-cat tests/unit/xenocats/combos
-          tests/unit/xenocats/gun tests/unit/xenocats/puppets
+          tests/unit/xenocats/gun tests/unit/xenocats/puppets tests/unit/xenocats/movement-pad
       # A test file in no group would never run: each unit test must be named in a
       # group above, each browser test in a group of both browser jobs below.
       - name: Every test file is in a group
diff --git a/app/cats/survival/page.tsx b/app/cats/survival/page.tsx
new file mode 100644
index 0000000..055ad3e
--- /dev/null
+++ b/app/cats/survival/page.tsx
@@ -0,0 +1,37 @@
+import { Metadata } from 'next';
+import Link from 'next/link';
+import XenocatLogo from '@/app/ui/xenocat-logo';
+import FightPage from '@/app/ui/xenocats/fight-page';
+
+export const metadata: Metadata = {
+  title: 'Survival',
+};
+
+export default function Page() {
+  return (
+    <div className="xenocat-stars min-h-screen bg-void-landing">
+      <a
+        href="#main-content"
+        className="sr-only rounded-xl bg-plasma px-4 py-2 font-semibold text-void focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[10000]"
+      >
+        Skip to main content
+      </a>
+      <main className="mx-auto max-w-[1366px] px-6 pb-12 pt-4 md:px-12">
+        <header className="mb-12 flex items-center justify-between gap-4">
+          <Link href="/" aria-label="Xenocat Analytics home">
+            <XenocatLogo />
+          </Link>
+          <Link
+            href="/cats"
+            className="border-b-2 border-aura-link/70 pb-1 text-[16.5px] font-semibold text-aura-link transition hover:border-aura hover:text-aura"
+          >
+            Back to the cats
+          </Link>
+        </header>
+        <div id="main-content" tabIndex={-1} className="focus-visible:outline-none">
+          <FightPage kind="survival" />
+        </div>
+      </main>
+    </div>
+  );
+}
diff --git a/app/cats/taming/page.tsx b/app/cats/taming/page.tsx
new file mode 100644
index 0000000..ccdb206
--- /dev/null
+++ b/app/cats/taming/page.tsx
@@ -0,0 +1,37 @@
+import { Metadata } from 'next';
+import Link from 'next/link';
+import XenocatLogo from '@/app/ui/xenocat-logo';
+import FightPage from '@/app/ui/xenocats/fight-page';
+
+export const metadata: Metadata = {
+  title: 'Taming',
+};
+
+export default function Page() {
+  return (
+    <div className="xenocat-stars min-h-screen bg-void-landing">
+      <a
+        href="#main-content"
+        className="sr-only rounded-xl bg-plasma px-4 py-2 font-semibold text-void focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[10000]"
+      >
+        Skip to main content
+      </a>
+      <main className="mx-auto max-w-[1366px] px-6 pb-12 pt-4 md:px-12">
+        <header className="mb-12 flex items-center justify-between gap-4">
+          <Link href="/" aria-label="Xenocat Analytics home">
+            <XenocatLogo />
+          </Link>
+          <Link
+            href="/cats"
+            className="border-b-2 border-aura-link/70 pb-1 text-[16.5px] font-semibold text-aura-link transition hover:border-aura hover:text-aura"
+          >
+            Back to the cats
+          </Link>
+        </header>
+        <div id="main-content" tabIndex={-1} className="focus-visible:outline-none">
+          <FightPage kind="taming" />
+        </div>
+      </main>
+    </div>
+  );
+}
diff --git a/app/ui/xenocats/cat-gallery.tsx b/app/ui/xenocats/cat-gallery.tsx
index ff7dd7d..923ec96 100644
--- a/app/ui/xenocats/cat-gallery.tsx
+++ b/app/ui/xenocats/cat-gallery.tsx
@@ -1,5 +1,6 @@
 'use client';
 
+import Link from 'next/link';
 import { memo, useCallback, useState, useSyncExternalStore } from 'react';
 import { Button } from '@/app/ui/button';
 import { XenocatCatsProvider, useXenocats } from './cat-layer';
@@ -7,28 +8,56 @@ import { catArt } from './cat-art';
 import { CatSprite } from './cat-sprite';
 import { CAT_TYPES, type CatType } from './cat-types';
 import { XenocatCursorProvider } from './fake-cursor';
-import Fight from './fight';
 import { entryFor, getGuide, getServerGuide, isEmptyGuide, subscribeGuide } from './field-guide';
 
 /**
  * Every cat type with two Summon buttons: awake, to pounce as soon as it arrives,
  * or asleep, to nap and wake first as the dashboard's cats do (and show both poses'
  * artwork). Cats only come when summoned here, so the page is calm to browse and
- * predictable to test. Above them, Fight a cat; no cat can be summoned during a game.
+ * predictable to test. Above them, Fight a cat: links to the two games' own pages.
  */
 export default function CatGallery() {
-  const [fighting, setFighting] = useState(false);
   return (
     <XenocatCursorProvider>
       <XenocatCatsProvider autoSpawn={false}>
-        <Fight onPlayingChange={setFighting} />
-        <Roster disabled={fighting} />
+        <FightLinks />
+        <Roster />
       </XenocatCatsProvider>
     </XenocatCursorProvider>
   );
 }
 
-function Roster({ disabled }: { disabled: boolean }) {
+const GAME_LINK =
+  'flex h-10 items-center rounded-xl bg-plasma px-4 text-sm font-semibold text-void transition hover:shadow-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plasma active:bg-plasma-dim';
+
+/** The two fight games, each on a page of its own. */
+function FightLinks() {
+  return (
+    <section
+      aria-labelledby="fight-heading"
+      className="mb-10 rounded-2xl border border-line bg-panel p-6"
+    >
+      <h2 id="fight-heading" className="font-display text-2xl font-semibold text-cream">
+        Fight a cat
+      </h2>
+      <p className="mt-2 max-w-2xl text-sm text-aura">
+        <span className="font-semibold text-white">Survival:</span> walk your ranger, aim, and send
+        the cats home before they get you. <span className="font-semibold text-white">Taming:</span>{' '}
+        win a cat over, one at a time.
+      </p>
+      <div className="mt-4 flex flex-wrap gap-4">
+        <Link href="/cats/survival" className={GAME_LINK} data-testid="fight-link-survival">
+          Play Survival
+        </Link>
+        <Link href="/cats/taming" className={GAME_LINK} data-testid="fight-link-taming">
+          Play Taming
+        </Link>
+      </div>
+    </section>
+  );
+}
+
+function Roster() {
   const cats = useXenocats();
   const [status, setStatus] = useState('');
 
@@ -76,13 +105,7 @@ function Roster({ disabled }: { disabled: boolean }) {
       </p>
       <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
         {CAT_TYPES.map((type) => (
-          <CatCard
-            key={type.id}
-            type={type}
-            {...entryFor(guide, type.id)}
-            disabled={disabled}
-            onSummon={summon}
-          />
+          <CatCard key={type.id} type={type} {...entryFor(guide, type.id)} onSummon={summon} />
         ))}
       </ul>
     </>
@@ -95,14 +118,12 @@ const CatCard = memo(function CatCard({
   met,
   survived,
   tamed,
-  disabled,
   onSummon,
 }: {
   type: CatType;
   met: number;
   survived: number;
   tamed: number;
-  disabled: boolean;
   onSummon: (type: CatType, asleep: boolean) => void;
 }) {
   return (
@@ -135,7 +156,6 @@ const CatCard = memo(function CatCard({
           className="justify-center whitespace-nowrap px-1 text-[13px]"
           data-testid={`summon-${type.id}`}
           aria-label={`Summon ${type.name} awake`}
-          disabled={disabled}
           onClick={() => onSummon(type, false)}
         >
           Summon awake
@@ -144,7 +164,6 @@ const CatCard = memo(function CatCard({
           className="justify-center whitespace-nowrap px-1 text-[13px]"
           data-testid={`summon-asleep-${type.id}`}
           aria-label={`Summon ${type.name} asleep`}
-          disabled={disabled}
           onClick={() => onSummon(type, true)}
         >
           Summon asleep
diff --git a/app/ui/xenocats/fight-page.tsx b/app/ui/xenocats/fight-page.tsx
new file mode 100644
index 0000000..6bab365
--- /dev/null
+++ b/app/ui/xenocats/fight-page.tsx
@@ -0,0 +1,48 @@
+'use client';
+
+import { useSyncExternalStore } from 'react';
+import { XenocatCatsProvider } from './cat-layer';
+import { XenocatCursorProvider } from './fake-cursor';
+import Fight, { type Kind } from './fight';
+
+const FINE_POINTER = '(pointer: fine)';
+
+/** Whether the device has a precise pointer (a mouse): the fake cursor's own test. */
+function subscribePointer(onChange: () => void) {
+  if (typeof window.matchMedia !== 'function') return () => {};
+  const query = window.matchMedia(FINE_POINTER);
+  query.addEventListener('change', onChange);
+  return () => query.removeEventListener('change', onChange);
+}
+
+const hasFinePointer = () =>
+  typeof window.matchMedia !== 'function' || window.matchMedia(FINE_POINTER).matches;
+
+/**
+ * A fight game's page (/cats/survival, /cats/taming): the game itself, with the
+ * cats and the fake cursor it plays with. No cat comes on its own here. On a touch
+ * screen (no precise pointer) the page says the game needs a keyboard and mouse.
+ */
+export default function FightPage({ kind }: { kind: Kind }) {
+  // The server cannot know: it renders the game, and a touch screen swaps it out.
+  const fine = useSyncExternalStore(subscribePointer, hasFinePointer, () => true);
+  if (!fine) {
+    return (
+      <div>
+        <h1 className="font-display text-4xl font-semibold text-cream md:text-[52px]">
+          {kind === 'survival' ? 'Survival' : 'Taming'}
+        </h1>
+        <p data-testid="fight-needs-keyboard" className="mt-4 max-w-2xl text-lg text-white">
+          This game needs a keyboard and mouse, for now. Come back on a computer to play it.
+        </p>
+      </div>
+    );
+  }
+  return (
+    <XenocatCursorProvider>
+      <XenocatCatsProvider autoSpawn={false}>
+        <Fight kind={kind} />
+      </XenocatCatsProvider>
+    </XenocatCursorProvider>
+  );
+}
diff --git a/app/ui/xenocats/fight.tsx b/app/ui/xenocats/fight.tsx
index ec3d9d3..ecf7d10 100644
--- a/app/ui/xenocats/fight.tsx
+++ b/app/ui/xenocats/fight.tsx
@@ -1,7 +1,6 @@
 'use client';
 
 import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
-import { createPortal } from 'react-dom';
 import { Button } from '@/app/ui/button';
 import { useXenocats } from './cat-layer';
 import { catArt } from './cat-art';
@@ -29,16 +28,18 @@ import {
 import { type Taming, type TamingSnapshot, createTaming } from './taming';
 import { getGuide, getServerGuide, recordStat, recordTamed, subscribeGuide } from './field-guide';
 
-// Fight a cat, on the /cats page. Start asks for pointer lock: the browser hides the
-// system pointer and the game owns the pointer's position, so the cats attack that
-// pointer itself (locked-pointer.ts). Esc releases the lock and ends the game;
-// losing it any other way (another tab, another window) pauses it. Where pointer
-// lock is refused or missing, the game runs on the page's own pointer instead.
+// Fight a cat, each game on a page of its own (fight-page.tsx): the page is the
+// game, its play area filling the page while a game runs. Start asks for pointer
+// lock: the browser hides the system pointer and the game owns the pointer's
+// position, so the cats attack that pointer itself (locked-pointer.ts). Esc releases
+// the lock and ends the game; losing it any other way (another tab, another window)
+// pauses it, and leaving the page ends it. Where pointer lock is refused or missing,
+// the game runs on the page's own pointer instead.
 //
-// Two games: Survival (survival.ts), where a ranger walked with WASD beams cats home
-// at the crosshair, and Taming (taming.ts), where one cat at a time dodges the
-// pointer and holding still on it for 2 s tames it, into a collection kept in
-// localStorage.
+// Two games: Survival (/cats/survival, survival.ts), where a ranger walked with
+// WASD beams cats home at the crosshair, and Taming (/cats/taming, taming.ts), where
+// one cat at a time dodges the pointer and holding still on it for 2 s tames it,
+// into a collection kept in localStorage.
 //
 // In Survival the ranger and the crosshair are both positions a cat's attack can
 // move (locked-pointer.ts, one each): WASD walks the one, the mouse moves the other,
@@ -46,7 +47,7 @@ import { getGuide, getServerGuide, recordStat, recordTamed, subscribeGuide } fro
 
 type Mode = 'locked' | 'fallback';
 type Phase = 'idle' | 'playing' | 'paused' | 'over';
-type Kind = 'survival' | 'taming';
+export type Kind = 'survival' | 'taming';
 
 type Game = {
   clock: ReturnType<typeof createGameClock>;
@@ -153,17 +154,11 @@ const beamTransform = (beam: Beam) =>
 
 const viewportSize = () => ({ width: window.innerWidth, height: window.innerHeight });
 
-export default function Fight({
-  onPlayingChange,
-}: {
-  /** True from Start until the game is over, paused included. */
-  onPlayingChange?: (playing: boolean) => void;
-}) {
+export default function Fight({ kind }: { kind: Kind }) {
   const cursor = useXenocatCursor();
   const cats = useXenocats();
   const [phase, setPhase] = useState<Phase>('idle');
   const [mode, setMode] = useState<Mode>('fallback');
-  const [kind, setKind] = useState<Kind>('survival');
   const [snap, setSnap] = useState<SurvivalSnapshot | null>(null);
   const [tameSnap, setTameSnap] = useState<TamingSnapshot | null>(null);
   const [pose, setPose] = useState<{ facing: Facing; walking: boolean }>({
@@ -186,7 +181,7 @@ export default function Fight({
   const crosshairRef = useRef<HTMLDivElement>(null);
   const crosshairDecoyRefs = useRef<(HTMLDivElement | null)[]>([]);
   const startRef = useRef<HTMLDivElement>(null);
-  const dialogRef = useRef<HTMLDivElement>(null);
+  const areaRef = useRef<HTMLDivElement>(null);
   // False once the section has gone: a lock request still pending then gives up.
   const mountedRef = useRef(true);
   // Cats move every frame, so the loop moves their elements itself; React renders
@@ -195,14 +190,10 @@ export default function Fight({
   // Set from Start until the game begins: asking for the lock can take a second.
   const startingRef = useRef(false);
 
-  const changePhase = useCallback(
-    (next: Phase) => {
-      phaseRef.current = next;
-      setPhase(next);
-      onPlayingChange?.(next === 'playing' || next === 'paused');
-    },
-    [onPlayingChange]
-  );
+  const changePhase = useCallback((next: Phase) => {
+    phaseRef.current = next;
+    setPhase(next);
+  }, []);
 
   const finish = useCallback(() => {
     const game = gameRef.current;
@@ -240,7 +231,6 @@ export default function Fight({
     gameRef.current = game;
     shownRef.current = '';
     setMode(game.mode);
-    setKind(game.kind);
     setDepartures([]);
     if (game.kind === 'survival') setSnap(game.survival.snapshot());
     else setTameSnap(game.taming.snapshot(0));
@@ -254,7 +244,7 @@ export default function Fight({
     changePhase('playing');
   };
 
-  const start = async (kind: Kind) => {
+  const start = async () => {
     if (startingRef.current || phaseRef.current === 'playing' || phaseRef.current === 'paused') {
       return;
     }
@@ -316,12 +306,33 @@ export default function Fight({
 
   // Move focus into the game when it starts and back to Start when it is over.
   useEffect(() => {
-    if (phase === 'playing' || phase === 'paused') dialogRef.current?.focus();
+    if (phase === 'playing' || phase === 'paused') areaRef.current?.focus();
     if (phase === 'over') startRef.current?.querySelector('button')?.focus();
   }, [phase]);
 
   // The game loop, and everything that can pause or end the game.
   const running = phase === 'playing' || phase === 'paused';
+
+  // While a game runs its play area covers the page, so everything else is made
+  // inert: keyboard focus cannot wander behind it (onto the header's links, or
+  // Start). Only what this marked is unmarked again.
+  useEffect(() => {
+    if (!running) return;
+    const area = areaRef.current;
+    if (!area) return;
+    const marked: Element[] = [];
+    for (let node: Element = area; node.parentElement; node = node.parentElement) {
+      for (const sibling of Array.from(node.parentElement.children)) {
+        if (sibling === node || sibling.hasAttribute('inert')) continue;
+        sibling.setAttribute('inert', '');
+        marked.push(sibling);
+      }
+      if (node.parentElement === document.body) break;
+    }
+    return () => {
+      for (const element of marked) element.removeAttribute('inert');
+    };
+  }, [running]);
   useEffect(() => {
     if (!running) return;
     const game = gameRef.current;
@@ -339,7 +350,7 @@ export default function Fight({
     };
 
     const moveCats = (list: readonly { id: number; x: number; y: number }[]) => {
-      const elements = dialogRef.current?.querySelectorAll<HTMLElement>('[data-cat-id]') ?? [];
+      const elements = areaRef.current?.querySelectorAll<HTMLElement>('[data-cat-id]') ?? [];
       for (const element of elements) {
         const cat = list.find((c) => String(c.id) === element.dataset.catId);
         if (cat) placeCat(element, cat);
@@ -347,7 +358,7 @@ export default function Fight({
     };
 
     const moveBeams = (list: readonly Beam[]) => {
-      const elements = dialogRef.current?.querySelectorAll<HTMLElement>('[data-beam-id]') ?? [];
+      const elements = areaRef.current?.querySelectorAll<HTMLElement>('[data-beam-id]') ?? [];
       for (const element of elements) {
         const beam = list.find((b) => String(b.id) === element.dataset.beamId);
         // A falling or bouncing beam turns as it flies.
@@ -577,324 +588,296 @@ export default function Fight({
     };
   }, [cursor]);
 
-  // The game is a modal dialog: Tab and Shift+Tab stay inside it (on its buttons,
-  // or on the dialog itself when it has none, as under pointer lock).
-  const onDialogKeyDown = (event: React.KeyboardEvent) => {
-    if (event.key !== 'Tab') return;
-    const dialog = dialogRef.current;
-    if (!dialog) return;
-    const buttons = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled])'));
-    if (buttons.length === 0) {
-      event.preventDefault();
-      dialog.focus();
-      return;
-    }
-    const first = buttons[0];
-    const last = buttons[buttons.length - 1];
-    const active = document.activeElement;
-    if (event.shiftKey && (active === first || active === dialog)) {
-      event.preventDefault();
-      last.focus();
-    } else if (!event.shiftKey && active === last) {
-      event.preventDefault();
-      first.focus();
-    }
-  };
-
   const size = CAT_CONFIG.catSize;
   const half = PLAYER_SIZE / 2;
 
   return (
-    <section
-      aria-labelledby="fight-heading"
-      className="mb-10 rounded-2xl border border-line bg-panel p-6"
-    >
-      <h2 id="fight-heading" className="font-display text-2xl font-semibold text-cream">
-        Fight a cat
-      </h2>
-      <p className="mt-2 max-w-2xl text-sm text-aura">
-        <span className="font-semibold text-white">Survival.</span> Walk your ranger with WASD (or
-        the arrow keys), aim with the mouse: the homing beam fires by itself, and a cat it hits is
-        sent home. Cats come in waves, faster and more often each time, and chase you. Each one
-        pounces a moment after it arrives, scrambling you, your aim and your gun; every cat that
-        touches you costs one of 3 lives.
-      </p>
-      <p className="mt-2 max-w-2xl text-sm text-aura">
-        <span className="font-semibold text-white">Taming.</span> One cat at a time, and it dodges
-        your pointer, each kind in its own way. Keep still and it gets curious; hold your pointer
-        still on it for 2 seconds to tame it.
-      </p>
+    <div>
+      <h1 className="font-display text-4xl font-semibold text-cream md:text-[52px]">
+        {kind === 'survival' ? 'Survival' : 'Taming'}
+      </h1>
+      {kind === 'survival' ? (
+        <p className="mt-4 max-w-2xl text-sm text-aura">
+          Walk your ranger with WASD (or the arrow keys), aim with the mouse: the homing beam fires
+          by itself, and a cat it hits is sent home. Cats come in waves, faster and more often each
+          time, and chase you. Each one pounces a moment after it arrives, scrambling you, your aim
+          and your gun; every cat that touches you costs one of 3 lives.
+        </p>
+      ) : (
+        <p className="mt-4 max-w-2xl text-sm text-aura">
+          One cat at a time, and it dodges your pointer, each kind in its own way. Keep still and it
+          gets curious; hold your pointer still on it for 2 seconds to tame it.
+        </p>
+      )}
       <p className="mt-2 max-w-2xl text-sm text-aura">
         Your pointer is locked to the game until you press Esc.
       </p>
       <div ref={startRef} className="mt-4 flex flex-wrap items-center gap-4">
-        <Button data-testid="fight-start" onClick={() => start('survival')} disabled={running}>
-          {phase === 'over' && kind === 'survival' ? 'Play again' : 'Start Survival'}
-        </Button>
-        <Button data-testid="fight-start-taming" onClick={() => start('taming')} disabled={running}>
-          {phase === 'over' && kind === 'taming' ? 'Tame again' : 'Start Taming'}
-        </Button>
-        <p data-testid="fight-best" className="text-sm text-aura">
-          Best:{' '}
-          {best === null ? 'no waves survived yet' : `${best} ${best === 1 ? 'wave' : 'waves'}`}
-        </p>
-        <p data-testid="fight-tamed" className="text-sm text-aura">
-          Tamed: {plural(tamedTotal, 'cat', 'cats')}
-        </p>
+        {kind === 'survival' ? (
+          <>
+            <Button data-testid="fight-start" onClick={() => start()} disabled={running}>
+              {phase === 'over' ? 'Play again' : 'Start Survival'}
+            </Button>
+            <p data-testid="fight-best" className="text-sm text-aura">
+              Best:{' '}
+              {best === null ? 'no waves survived yet' : `${best} ${best === 1 ? 'wave' : 'waves'}`}
+            </p>
+          </>
+        ) : (
+          <>
+            <Button data-testid="fight-start-taming" onClick={() => start()} disabled={running}>
+              {phase === 'over' ? 'Tame again' : 'Start Taming'}
+            </Button>
+            <p data-testid="fight-tamed" className="text-sm text-aura">
+              Tamed: {plural(tamedTotal, 'cat', 'cats')}
+            </p>
+          </>
+        )}
       </div>
       <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-plasma">
         {phase === 'over' ? message : ''}
       </p>
 
-      {running &&
-        (kind === 'survival' ? snap : tameSnap) &&
-        createPortal(
-          <div
-            ref={dialogRef}
-            role="dialog"
-            aria-modal="true"
-            aria-label={kind === 'survival' ? 'Fight a cat: Survival' : 'Fight a cat: Taming'}
-            tabIndex={-1}
-            data-testid="fight-overlay"
-            data-xenocat-ignore
-            data-mode={mode}
-            data-kind={kind}
-            data-phase={phase}
-            onKeyDown={onDialogKeyDown}
-            className="fixed inset-0 z-[9998] select-none bg-void/85 outline-none"
-          >
-            <div className="flex flex-wrap items-center gap-6 p-4 text-sm font-semibold text-cream">
-              {kind === 'survival' && snap && (
-                <>
-                  <p data-testid="fight-lives" data-lives={snap.lives}>
-                    Lives: {snap.lives}
-                  </p>
-                  <p data-testid="fight-wave" data-wave={snap.wave}>
-                    Wave {snap.wave}
-                  </p>
-                  <p data-testid="fight-score">Survived: {snap.score}</p>
-                </>
-              )}
-              {kind === 'taming' && tameSnap && (
-                <>
-                  <p data-testid="fight-tamed-now">Tamed this game: {tameSnap.tamed.length}</p>
-                  <div
-                    role="progressbar"
-                    aria-label="Taming"
-                    aria-valuemin={0}
-                    aria-valuemax={100}
-                    aria-valuenow={Math.round(tameSnap.hold * 100)}
-                    className="h-2 w-32 overflow-hidden rounded-full bg-void"
-                  >
-                    <div
-                      className="h-full bg-plasma"
-                      style={{ width: `${tameSnap.hold * 100}%` }}
-                    />
-                  </div>
-                </>
-              )}
-              <p role="status" className="text-plasma">
-                {message}
-              </p>
-              {mode === 'fallback' && phase === 'playing' && (
-                <Button className="ml-auto" onClick={finish}>
-                  End game
-                </Button>
-              )}
-            </div>
-
-            <div aria-hidden="true">
-              {kind === 'taming' && tameSnap?.cat && (
+      {running && (kind === 'survival' ? snap : tameSnap) && (
+        // The play area: the whole page while a game runs, the HUD along its top.
+        <div
+          ref={areaRef}
+          tabIndex={-1}
+          data-testid="fight-area"
+          data-xenocat-ignore
+          data-mode={mode}
+          data-kind={kind}
+          data-phase={phase}
+          className="fixed inset-0 z-[9998] select-none bg-void outline-none"
+        >
+          <div className="flex flex-wrap items-center gap-6 p-4 text-sm font-semibold text-cream">
+            {kind === 'survival' && snap && (
+              <>
+                <p data-testid="fight-lives" data-lives={snap.lives}>
+                  Lives: {snap.lives}
+                </p>
+                <p data-testid="fight-wave" data-wave={snap.wave}>
+                  Wave {snap.wave}
+                </p>
+                <p data-testid="fight-score">Survived: {snap.score}</p>
+              </>
+            )}
+            {kind === 'taming' && tameSnap && (
+              <>
+                <p data-testid="fight-tamed-now">Tamed this game: {tameSnap.tamed.length}</p>
                 <div
-                  key={tameSnap.cat.id}
-                  data-cat-id={tameSnap.cat.id}
+                  role="progressbar"
+                  aria-label="Taming"
+                  aria-valuemin={0}
+                  aria-valuemax={100}
+                  aria-valuenow={Math.round(tameSnap.hold * 100)}
+                  className="h-2 w-32 overflow-hidden rounded-full bg-void"
+                >
+                  <div className="h-full bg-plasma" style={{ width: `${tameSnap.hold * 100}%` }} />
+                </div>
+              </>
+            )}
+            <p role="status" className="text-plasma">
+              {message}
+            </p>
+            {mode === 'fallback' && phase === 'playing' && (
+              <Button className="ml-auto" onClick={finish}>
+                End game
+              </Button>
+            )}
+          </div>
+
+          <div aria-hidden="true">
+            {kind === 'taming' && tameSnap?.cat && (
+              <div
+                key={tameSnap.cat.id}
+                data-cat-id={tameSnap.cat.id}
+                data-testid="fight-cat"
+                data-cat-type={tameSnap.cat.typeId}
+                data-doing={tameSnap.cat.doing}
+                className="absolute rounded-full"
+                style={{
+                  // Where the cat was when React last drew it; the loop moves it on.
+                  left: tameSnap.cat.x - size / 2,
+                  top: tameSnap.cat.y - size / 2,
+                  width: size,
+                  height: size,
+                  // A blinking cat is gone for a moment; a held one glows as it calms.
+                  opacity: tameSnap.cat.doing === 'blink' ? 0.15 : 1,
+                  boxShadow:
+                    tameSnap.hold > 0
+                      ? `0 0 0 3px rgba(255, 255, 255, ${0.2 + tameSnap.hold * 0.6})`
+                      : undefined,
+                }}
+              >
+                <FightCatSprite typeId={tameSnap.cat.typeId} size={size} />
+              </div>
+            )}
+            {kind === 'survival' &&
+              snap?.cats.map((cat) => (
+                <div
+                  key={cat.id}
+                  data-cat-id={cat.id}
                   data-testid="fight-cat"
-                  data-cat-type={tameSnap.cat.typeId}
-                  data-doing={tameSnap.cat.doing}
-                  className="absolute rounded-full"
+                  data-cat-type={cat.typeId}
+                  data-pounced={cat.attackAt === null}
+                  className={cat.attackAt === null ? 'xenocat-attacking absolute' : 'absolute'}
                   style={{
-                    // Where the cat was when React last drew it; the loop moves it on.
-                    left: tameSnap.cat.x - size / 2,
-                    top: tameSnap.cat.y - size / 2,
+                    left: cat.x - size / 2,
+                    top: cat.y - size / 2,
                     width: size,
                     height: size,
-                    // A blinking cat is gone for a moment; a held one glows as it calms.
-                    opacity: tameSnap.cat.doing === 'blink' ? 0.15 : 1,
-                    boxShadow:
-                      tameSnap.hold > 0
-                        ? `0 0 0 3px rgba(255, 255, 255, ${0.2 + tameSnap.hold * 0.6})`
-                        : undefined,
                   }}
                 >
-                  <FightCatSprite typeId={tameSnap.cat.typeId} size={size} />
+                  <FightCatSprite typeId={cat.typeId} size={size} />
                 </div>
-              )}
-              {kind === 'survival' &&
-                snap?.cats.map((cat) => (
+              ))}
+            {kind === 'survival' &&
+              departures.map((cat) => (
+                <div
+                  key={cat.id}
+                  data-testid="fight-departure"
+                  className="pointer-events-none absolute"
+                  style={{
+                    left: cat.x - size / 2,
+                    top: cat.y - size,
+                    width: size,
+                    height: size * 1.5,
+                  }}
+                  onAnimationEnd={(event) => {
+                    if (event.target !== event.currentTarget.lastElementChild) return;
+                    setDepartures((list) => list.filter((d) => d.id !== cat.id));
+                  }}
+                >
+                  <div className="xenocat-beam-column absolute inset-x-2 bottom-0 top-0 rounded-full" />
                   <div
-                    key={cat.id}
-                    data-cat-id={cat.id}
-                    data-testid="fight-cat"
-                    data-cat-type={cat.typeId}
-                    data-pounced={cat.attackAt === null}
-                    className={cat.attackAt === null ? 'xenocat-attacking absolute' : 'absolute'}
-                    style={{
-                      left: cat.x - size / 2,
-                      top: cat.y - size / 2,
-                      width: size,
-                      height: size,
-                    }}
+                    className="xenocat-beam-home absolute bottom-0 left-0"
+                    style={{ width: size, height: size }}
                   >
                     <FightCatSprite typeId={cat.typeId} size={size} />
                   </div>
-                ))}
-              {kind === 'survival' &&
-                departures.map((cat) => (
-                  <div
-                    key={cat.id}
-                    data-testid="fight-departure"
-                    className="pointer-events-none absolute"
-                    style={{
-                      left: cat.x - size / 2,
-                      top: cat.y - size,
-                      width: size,
-                      height: size * 1.5,
-                    }}
-                    onAnimationEnd={(event) => {
-                      if (event.target !== event.currentTarget.lastElementChild) return;
-                      setDepartures((list) => list.filter((d) => d.id !== cat.id));
-                    }}
-                  >
-                    <div className="xenocat-beam-column absolute inset-x-2 bottom-0 top-0 rounded-full" />
-                    <div
-                      className="xenocat-beam-home absolute bottom-0 left-0"
-                      style={{ width: size, height: size }}
-                    >
-                      <FightCatSprite typeId={cat.typeId} size={size} />
-                    </div>
-                  </div>
-                ))}
-              {kind === 'survival' &&
-                snap?.beams.map((beam) => (
-                  <div
-                    key={beam.id}
-                    data-beam-id={beam.id}
-                    data-testid="fight-beam"
-                    className="pointer-events-none fixed left-0 top-0 h-0 w-0 origin-top-left"
-                    style={{
-                      transform: beamTransform(beam),
-                      opacity: beam.opacity,
-                      filter:
-                        [
-                          beam.blur > 0 ? `blur(${beam.blur}px)` : '',
-                          beam.tint ? `drop-shadow(0 0 4px ${beam.tint})` : '',
-                        ]
-                          .filter(Boolean)
-                          .join(' ') || undefined,
-                    }}
-                  >
-                    <div className="xenocat-beam absolute -left-6 -top-0.5 h-1 w-6 rounded-full" />
-                  </div>
-                ))}
-            </div>
+                </div>
+              ))}
+            {kind === 'survival' &&
+              snap?.beams.map((beam) => (
+                <div
+                  key={beam.id}
+                  data-beam-id={beam.id}
+                  data-testid="fight-beam"
+                  className="pointer-events-none fixed left-0 top-0 h-0 w-0 origin-top-left"
+                  style={{
+                    transform: beamTransform(beam),
+                    opacity: beam.opacity,
+                    filter:
+                      [
+                        beam.blur > 0 ? `blur(${beam.blur}px)` : '',
+                        beam.tint ? `drop-shadow(0 0 4px ${beam.tint})` : '',
+                      ]
+                        .filter(Boolean)
+                        .join(' ') || undefined,
+                  }}
+                >
+                  <div className="xenocat-beam absolute -left-6 -top-0.5 h-1 w-6 rounded-full" />
+                </div>
+              ))}
+          </div>
 
-            {kind === 'survival' && (
-              <div aria-hidden="true">
-                {Array.from({ length: MAX_DECOYS }, (_, i) => (
-                  <div
-                    key={i}
-                    ref={(element) => {
-                      playerDecoyRefs.current[i] = element;
-                    }}
-                    className="pointer-events-none fixed left-0 top-0 h-0 w-0 origin-top-left"
-                    style={{ opacity: 0 }}
-                  >
-                    <div className="absolute" style={{ left: -half, top: -half }}>
-                      <PlayerSprite facing={pose.facing} walking={pose.walking} />
-                    </div>
-                  </div>
-                ))}
+          {kind === 'survival' && (
+            <div aria-hidden="true">
+              {Array.from({ length: MAX_DECOYS }, (_, i) => (
                 <div
-                  ref={playerRef}
-                  data-testid="fight-player"
-                  data-facing={pose.facing}
-                  data-walking={pose.walking}
+                  key={i}
+                  ref={(element) => {
+                    playerDecoyRefs.current[i] = element;
+                  }}
                   className="pointer-events-none fixed left-0 top-0 h-0 w-0 origin-top-left"
                   style={{ opacity: 0 }}
                 >
                   <div className="absolute" style={{ left: -half, top: -half }}>
-                    <PlayerSprite facing={pose.facing} walking={pose.walking} gunRef={gunRef} />
+                    <PlayerSprite facing={pose.facing} walking={pose.walking} />
                   </div>
                 </div>
+              ))}
+              <div
+                ref={playerRef}
+                data-testid="fight-player"
+                data-facing={pose.facing}
+                data-walking={pose.walking}
+                className="pointer-events-none fixed left-0 top-0 h-0 w-0 origin-top-left"
+                style={{ opacity: 0 }}
+              >
+                <div className="absolute" style={{ left: -half, top: -half }}>
+                  <PlayerSprite facing={pose.facing} walking={pose.walking} gunRef={gunRef} />
+                </div>
               </div>
-            )}
+            </div>
+          )}
 
-            {kind === 'survival' && phase === 'playing' && (
-              <div aria-hidden="true">
-                {Array.from({ length: MAX_DECOYS }, (_, i) => (
-                  <div
-                    key={i}
-                    ref={(element) => {
-                      crosshairDecoyRefs.current[i] = element;
-                    }}
-                    className="pointer-events-none fixed left-0 top-0 h-0 w-0 origin-top-left"
-                    style={{ opacity: 0 }}
-                  >
-                    <Crosshair />
-                  </div>
-                ))}
+          {kind === 'survival' && phase === 'playing' && (
+            <div aria-hidden="true">
+              {Array.from({ length: MAX_DECOYS }, (_, i) => (
                 <div
-                  ref={crosshairRef}
-                  data-testid="fight-crosshair"
+                  key={i}
+                  ref={(element) => {
+                    crosshairDecoyRefs.current[i] = element;
+                  }}
                   className="pointer-events-none fixed left-0 top-0 h-0 w-0 origin-top-left"
                   style={{ opacity: 0 }}
                 >
                   <Crosshair />
                 </div>
+              ))}
+              <div
+                ref={crosshairRef}
+                data-testid="fight-crosshair"
+                className="pointer-events-none fixed left-0 top-0 h-0 w-0 origin-top-left"
+                style={{ opacity: 0 }}
+              >
+                <Crosshair />
               </div>
-            )}
-
-            {phase === 'paused' && (
-              <div className="absolute inset-0 z-20 flex items-center justify-center">
-                <div className="rounded-2xl border border-line bg-panel p-6 text-center">
-                  <p className="font-display text-xl text-cream">Paused</p>
-                  <p className="mt-2 text-sm text-aura">The cats wait for you.</p>
-                  <div className="mt-4 flex justify-center gap-3">
-                    <Button onClick={resume}>Resume</Button>
-                    <Button onClick={finish}>End game</Button>
-                  </div>
+            </div>
+          )}
+
+          {phase === 'paused' && (
+            <div className="absolute inset-0 z-20 flex items-center justify-center">
+              <div className="rounded-2xl border border-line bg-panel p-6 text-center">
+                <p className="font-display text-xl text-cream">Paused</p>
+                <p className="mt-2 text-sm text-aura">The cats wait for you.</p>
+                <div className="mt-4 flex justify-center gap-3">
+                  <Button onClick={resume}>Resume</Button>
+                  <Button onClick={finish}>End game</Button>
                 </div>
               </div>
-            )}
+            </div>
+          )}
 
-            {kind === 'taming' && mode === 'locked' && phase === 'playing' && (
-              <div aria-hidden="true">
-                {Array.from({ length: MAX_DECOYS }, (_, i) => (
-                  <div
-                    key={i}
-                    ref={(element) => {
-                      decoyRefs.current[i] = element;
-                    }}
-                    className="pointer-events-none fixed left-0 top-0 origin-top-left"
-                    style={{ opacity: 0 }}
-                  >
-                    <CursorShape kind="arrow" />
-                  </div>
-                ))}
+          {kind === 'taming' && mode === 'locked' && phase === 'playing' && (
+            <div aria-hidden="true">
+              {Array.from({ length: MAX_DECOYS }, (_, i) => (
                 <div
-                  ref={pointerRef}
-                  data-testid="fight-pointer"
+                  key={i}
+                  ref={(element) => {
+                    decoyRefs.current[i] = element;
+                  }}
                   className="pointer-events-none fixed left-0 top-0 origin-top-left"
                   style={{ opacity: 0 }}
                 >
                   <CursorShape kind="arrow" />
                 </div>
+              ))}
+              <div
+                ref={pointerRef}
+                data-testid="fight-pointer"
+                className="pointer-events-none fixed left-0 top-0 origin-top-left"
+                style={{ opacity: 0 }}
+              >
+                <CursorShape kind="arrow" />
               </div>
-            )}
-          </div>,
-          document.body
-        )}
-    </section>
+            </div>
+          )}
+        </div>
+      )}
+    </div>
   );
 }
 
diff --git a/app/ui/xenocats/movement-pad-view.tsx b/app/ui/xenocats/movement-pad-view.tsx
new file mode 100644
index 0000000..ae8e04d
--- /dev/null
+++ b/app/ui/xenocats/movement-pad-view.tsx
@@ -0,0 +1,106 @@
+'use client';
+
+import { useEffect, useRef, useState } from 'react';
+import type { Vec } from './effects';
+import { KNOB_SIZE, PAD_SIZE, knobOffset, padDirection } from './movement-pad';
+
+/**
+ * The movement pad for touch screens (movement-pad.ts): a thumb held on it walks
+ * the character the way WASD does, and `onDirection` hears every change of way,
+ * zero when it is let go. Hidden from assistive technology like the rest of a
+ * game's visuals: the keyboard is the accessible way to walk. While it is held the
+ * page neither scrolls nor zooms.
+ */
+export function MovementPad({
+  onDirection,
+  className,
+}: {
+  onDirection: (direction: Vec) => void;
+  className?: string;
+}) {
+  const padRef = useRef<HTMLDivElement>(null);
+  const [knob, setKnob] = useState<Vec>({ x: 0, y: 0 });
+  const [held, setHeld] = useState(false);
+  const lastRef = useRef<Vec>({ x: 0, y: 0 });
+  const pointerRef = useRef<number | null>(null);
+  // The latest listener, without re-running the effects below when it changes.
+  const onDirectionRef = useRef(onDirection);
+  useEffect(() => {
+    onDirectionRef.current = onDirection;
+  }, [onDirection]);
+
+  const report = (direction: Vec) => {
+    const last = lastRef.current;
+    if (last.x === direction.x && last.y === direction.y) return;
+    lastRef.current = direction;
+    onDirectionRef.current(direction);
+  };
+
+  const follow = (event: React.PointerEvent) => {
+    const pad = padRef.current;
+    if (!pad) return;
+    const box = pad.getBoundingClientRect();
+    const centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
+    const touch = { x: event.clientX, y: event.clientY };
+    const radius = box.width / 2;
+    setKnob(knobOffset(touch, centre, radius));
+    report(padDirection(touch, centre, radius));
+  };
+
+  const release = () => {
+    pointerRef.current = null;
+    setHeld(false);
+    setKnob({ x: 0, y: 0 });
+    report({ x: 0, y: 0 });
+  };
+
+  // A second finger elsewhere on the page would still pinch-zoom it, and a swipe
+  // that wandered off the pad would scroll it: neither while the pad is held.
+  useEffect(() => {
+    if (!held) return;
+    const stop = (event: TouchEvent) => event.preventDefault();
+    document.addEventListener('touchmove', stop, { passive: false });
+    return () => document.removeEventListener('touchmove', stop);
+  }, [held]);
+
+  // Taken off the page while held: the character stops.
+  useEffect(() => () => onDirectionRef.current({ x: 0, y: 0 }), []);
+
+  return (
+    <div
+      ref={padRef}
+      aria-hidden="true"
+      data-testid="movement-pad"
+      data-held={held}
+      className={`relative touch-none select-none rounded-full border-2 border-line bg-panel/70 ${className ?? ''}`}
+      style={{ width: PAD_SIZE, height: PAD_SIZE }}
+      onPointerDown={(event) => {
+        if (pointerRef.current !== null) return;
+        pointerRef.current = event.pointerId;
+        event.currentTarget.setPointerCapture?.(event.pointerId);
+        setHeld(true);
+        follow(event);
+      }}
+      onPointerMove={(event) => {
+        if (event.pointerId === pointerRef.current) follow(event);
+      }}
+      onPointerUp={(event) => {
+        if (event.pointerId === pointerRef.current) release();
+      }}
+      onPointerCancel={(event) => {
+        if (event.pointerId === pointerRef.current) release();
+      }}
+    >
+      <div
+        className="absolute rounded-full bg-plasma/80 shadow-[0_0_12px_rgba(193,232,56,0.5)]"
+        style={{
+          width: KNOB_SIZE,
+          height: KNOB_SIZE,
+          left: PAD_SIZE / 2 - KNOB_SIZE / 2 - 2,
+          top: PAD_SIZE / 2 - KNOB_SIZE / 2 - 2,
+          transform: `translate(${knob.x}px, ${knob.y}px)`,
+        }}
+      />
+    </div>
+  );
+}
diff --git a/app/ui/xenocats/movement-pad.ts b/app/ui/xenocats/movement-pad.ts
new file mode 100644
index 0000000..9d6194d
--- /dev/null
+++ b/app/ui/xenocats/movement-pad.ts
@@ -0,0 +1,61 @@
+// The on-screen movement pad (movement-pad-view.tsx), for touch screens: a thumb
+// held on it walks the character the way the WASD keys do. Pure: no DOM, so it is
+// tested in Node.
+//
+// The pad is a circle. A touch in its middle (the dead zone) walks nowhere; one
+// further out walks in whichever of the eight WASD ways points nearest to it, as a
+// unit vector, a diagonal no faster than a straight line — the very vector
+// `walkDirection` (survival.ts) gives for those keys held.
+
+import type { Vec } from './effects';
+import { walkDirection } from './survival';
+
+/** The pad's diameter, px: room for a thumb, and to aim it. */
+export const PAD_SIZE = 144;
+
+/** The knob's diameter, px. */
+export const KNOB_SIZE = 56;
+
+/** The middle of the pad that walks nowhere, as a share of its radius. */
+export const DEAD_ZONE = 0.25;
+
+/** The keys each of the eight ways would hold, from east, clockwise (screen y grows down). */
+const SECTORS: readonly (readonly string[])[] = [
+  ['KeyD'],
+  ['KeyD', 'KeyS'],
+  ['KeyS'],
+  ['KeyA', 'KeyS'],
+  ['KeyA'],
+  ['KeyA', 'KeyW'],
+  ['KeyW'],
+  ['KeyD', 'KeyW'],
+];
+
+/**
+ * The way a touch at `touch` on a pad centred at `centre`, of radius `radius`,
+ * walks the character: what WASD would give, or zero with no touch (released) or
+ * inside the dead zone.
+ */
+export function padDirection(
+  touch: Vec | null,
+  centre: Vec,
+  radius: number,
+  deadZone = DEAD_ZONE
+): Vec {
+  if (!touch) return { x: 0, y: 0 };
+  const dx = touch.x - centre.x;
+  const dy = touch.y - centre.y;
+  if (Math.hypot(dx, dy) < deadZone * radius) return { x: 0, y: 0 };
+  const sector = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
+  return walkDirection(SECTORS[sector]);
+}
+
+/** Where the knob is drawn for a touch: under the thumb, but never off the pad. */
+export function knobOffset(touch: Vec | null, centre: Vec, radius: number): Vec {
+  if (!touch) return { x: 0, y: 0 };
+  const dx = touch.x - centre.x;
+  const dy = touch.y - centre.y;
+  const length = Math.hypot(dx, dy);
+  if (length <= radius) return { x: dx, y: dy };
+  return { x: (dx / length) * radius, y: (dy / length) * radius };
+}
diff --git a/tests/e2e/fight.spec.ts b/tests/e2e/fight.spec.ts
index 3b07347..01c9cf2 100644
--- a/tests/e2e/fight.spec.ts
+++ b/tests/e2e/fight.spec.ts
@@ -1,13 +1,18 @@
-import { type Page, expect, test } from '@playwright/test';
+import { type Page, devices, expect, test } from '@playwright/test';
 import { SURVIVAL_BEST_KEY } from '@/app/ui/xenocats/survival';
 import { TAMED_KEY } from '@/app/ui/xenocats/taming';
 
-// Fight a cat on /cats (no login, no database). Most tests take the fallback path:
+// The fight games on their own pages, /cats/survival and /cats/taming (no login, no
+// database). Most tests take the fallback path:
 // pointer lock is removed before the page loads, so the game runs with the fake
 // cursor. The "under pointer lock" tests keep it: headless Chromium grants the lock
 // and reports mouse movement, so the locked path can be played too.
 
-async function openFight(page: Page, best?: number, { lock = false } = {}) {
+async function openFight(
+  page: Page,
+  best?: number,
+  { lock = false, game = 'survival' }: { lock?: boolean; game?: 'survival' | 'taming' } = {}
+) {
   await page.addInitScript(
     ({ key, best, lock }) => {
       if (!lock) {
@@ -21,8 +26,10 @@ async function openFight(page: Page, best?: number, { lock = false } = {}) {
     { key: SURVIVAL_BEST_KEY, best, lock }
   );
   await page.setViewportSize({ width: 1280, height: 800 });
-  await page.goto('/cats');
-  await expect(page.getByRole('heading', { name: 'Fight a cat' })).toBeVisible();
+  await page.goto(`/cats/${game}`);
+  await expect(
+    page.getByRole('heading', { level: 1, name: game === 'survival' ? 'Survival' : 'Taming' })
+  ).toBeVisible();
   // The fake cursor takes over on the first pointer move after hydration.
   let nudge = 0;
   await expect
@@ -35,7 +42,7 @@ async function openFight(page: Page, best?: number, { lock = false } = {}) {
 
 async function start(page: Page) {
   await page.getByTestId('fight-start').click();
-  const overlay = page.getByTestId('fight-overlay');
+  const overlay = page.getByTestId('fight-area');
   await expect(overlay).toBeVisible();
   await expect(overlay).toHaveAttribute('data-mode', 'fallback');
   return overlay;
@@ -92,8 +99,6 @@ test('Survival: the self-firing beam sends every cat of a wave home; Esc ends th
   await expect(page.getByTestId('fight-lives')).toHaveText('Lives: 3');
   await expect(page.getByTestId('fight-wave')).toHaveText('Wave 1');
   await expect(page.getByTestId('fight-player').locator('svg').first()).toBeVisible();
-  // No cat can be summoned during a game.
-  await expect(page.getByTestId('summon-void-tabby')).toBeDisabled();
 
   // Keep the crosshair on the nearest cat until wave 1 is over: the gun fires by
   // itself. It is a real-time game: cats scramble the ranger, its aim and its gun,
@@ -103,7 +108,7 @@ test('Survival: the self-firing beam sends every cat of a wave home; Esc ends th
   await expect
     .poll(
       async () => {
-        if ((await page.getByTestId('fight-overlay').count()) === 0) {
+        if ((await page.getByTestId('fight-area').count()) === 0) {
           await start(page);
           mouse = { x: 640, y: 400 };
         }
@@ -120,13 +125,12 @@ test('Survival: the self-firing beam sends every cat of a wave home; Esc ends th
   await expect(page.getByTestId('fight-score')).toHaveText('Survived: 1');
 
   await page.keyboard.press('Escape');
-  await expect(page.getByTestId('fight-overlay')).toHaveCount(0);
+  await expect(page.getByTestId('fight-area')).toHaveCount(0);
   await expect(page.getByRole('status').filter({ hasText: 'Game over' })).toHaveText(
     'Game over. You survived 1 wave. Best: 1.'
   );
   await expect(page.getByTestId('fight-best')).toHaveText('Best: 1 wave');
   expect(await page.evaluate((key) => localStorage.getItem(key), SURVIVAL_BEST_KEY)).toBe('1');
-  await expect(page.getByTestId('summon-void-tabby')).toBeEnabled();
   await expect(page.getByTestId('fight-start')).toHaveText('Play again');
 });
 
@@ -217,10 +221,10 @@ test('Taming: a still pointer draws the cat over, holding still on it tames it i
   page,
 }) => {
   test.setTimeout(60_000);
-  await openFight(page);
+  await openFight(page, undefined, { game: 'taming' });
   await expect(page.getByTestId('fight-tamed')).toHaveText('Tamed: 0 cats');
   await page.getByTestId('fight-start-taming').click();
-  const overlay = page.getByTestId('fight-overlay');
+  const overlay = page.getByTestId('fight-area');
   await expect(overlay).toHaveAttribute('data-kind', 'taming');
   await expect(overlay).toHaveAttribute('data-mode', 'fallback');
   // Keep still: the cat appears, gets curious after 1 s and walks over at 110 px/s.
@@ -244,7 +248,7 @@ test('Taming: a still pointer draws the cat over, holding still on it tames it i
 
 test('Taming: a pointer moving at the cat makes it dodge', async ({ page }) => {
   test.setTimeout(60_000);
-  await openFight(page);
+  await openFight(page, undefined, { game: 'taming' });
   await page.getByTestId('fight-start-taming').click();
   await page.mouse.move(100, 100);
   const cat = page.getByTestId('fight-cat');
@@ -307,16 +311,21 @@ test('Survival: losing focus pauses the game, and the cats wait; Resume carries
   const at = await cat.boundingBox();
   await page.waitForTimeout(600);
   expect(await cat.boundingBox()).toEqual(at);
-  // The paused game is a modal dialog: Tab cycles through its own buttons only.
-  const resume = overlay.getByRole('button', { name: 'Resume' });
-  const end = overlay.getByRole('button', { name: 'End game' });
-  await resume.focus();
-  await page.keyboard.press('Tab');
-  await expect(end).toBeFocused();
-  await page.keyboard.press('Tab');
-  await expect(resume).toBeFocused();
-  await page.keyboard.press('Shift+Tab');
-  await expect(end).toBeFocused();
+  // The game is the page, not a dialog. What the play area covers (the header's
+  // links, Start) is inert while it runs: Tab never lands on anything hidden.
+  await expect(page.getByRole('dialog')).toHaveCount(0);
+  await expect(overlay.getByRole('button', { name: 'End game' })).toBeVisible();
+  const focusIsVisible = () =>
+    page.evaluate(() => {
+      const active = document.activeElement;
+      const area = document.querySelector('[data-testid="fight-area"]');
+      return active === document.body || active === null || !!area?.contains(active);
+    });
+  await overlay.getByRole('button', { name: 'Resume' }).focus();
+  for (const key of ['Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
+    await page.keyboard.press(key);
+    expect(await focusIsVisible(), key).toBe(true);
+  }
   await overlay.getByRole('button', { name: 'Resume' }).click();
   await expect(overlay).toHaveAttribute('data-phase', 'playing');
   await expect.poll(() => cat.boundingBox()).not.toEqual(at);
@@ -332,7 +341,7 @@ test('Survival under pointer lock: the mouse moves the crosshair, and losing the
   const mouse = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
   await page.mouse.move(mouse.x, mouse.y);
   await startButton.click();
-  const overlay = page.getByTestId('fight-overlay');
+  const overlay = page.getByTestId('fight-area');
   await expect(overlay).toHaveAttribute('data-mode', /locked|fallback/);
   // Some headless browsers refuse pointer lock (the game then takes the fallback
   // path, tested above); there is nothing to test here then.
@@ -395,7 +404,7 @@ test('Survival under pointer lock: the mouse moves the crosshair, and losing the
   await page.evaluate(() => document.exitPointerLock());
   expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
   if (focused) {
-    await expect(page.getByTestId('fight-overlay')).toHaveCount(0);
+    await expect(page.getByTestId('fight-area')).toHaveCount(0);
     await expect(page.getByRole('status').filter({ hasText: 'Game over' })).toContainText(
       'Game over. You survived'
     );
@@ -404,3 +413,64 @@ test('Survival under pointer lock: the mouse moves the crosshair, and losing the
     await expect(overlay.getByRole('button', { name: 'Resume' })).toBeVisible();
   }
 });
+
+test('/cats links to both games, each on a page of its own', async ({ page }) => {
+  await page.setViewportSize({ width: 1280, height: 800 });
+  await page.goto('/cats');
+  await expect(page.getByRole('heading', { name: 'Fight a cat' })).toBeVisible();
+  await page.getByRole('link', { name: 'Play Survival' }).click();
+  await expect(page).toHaveURL(/\/cats\/survival$/);
+  await expect(page.getByRole('heading', { level: 1, name: 'Survival' })).toBeVisible();
+  await expect(page.getByTestId('fight-start')).toBeVisible();
+  await page.goto('/cats');
+  await page.getByRole('link', { name: 'Play Taming' }).click();
+  await expect(page).toHaveURL(/\/cats\/taming$/);
+  await expect(page.getByRole('heading', { level: 1, name: 'Taming' })).toBeVisible();
+  await expect(page.getByTestId('fight-start-taming')).toBeVisible();
+});
+
+test('Survival: leaving the page mid-game ends the game and releases the pointer lock', async ({
+  page,
+}) => {
+  test.setTimeout(30_000);
+  await page.setViewportSize({ width: 1280, height: 800 });
+  await page.goto('/cats');
+  await page.getByRole('link', { name: 'Play Survival' }).click();
+  await expect(page.getByRole('heading', { level: 1, name: 'Survival' })).toBeVisible();
+  let nudge = 0;
+  await expect
+    .poll(async () => {
+      await page.mouse.move(640 + (nudge++ % 2), 400);
+      return page.locator('html').getAttribute('class');
+    })
+    .toContain('xenocat-cursor-hidden');
+  await page.getByTestId('fight-start').click();
+  const area = page.getByTestId('fight-area');
+  // Some headless browsers refuse pointer lock; then the game runs on the fallback.
+  await expect(area).toHaveAttribute('data-mode', /locked|fallback/);
+  const locked = (await area.getAttribute('data-mode')) === 'locked';
+  // Back to /cats inside the app: the game's page goes away.
+  await page.goBack();
+  await expect(page.getByRole('heading', { name: 'Fight a cat' })).toBeVisible();
+  await expect(area).toHaveCount(0);
+  if (locked) expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
+  // Nothing is left inert on the page it came back to.
+  await expect(page.locator('[inert]')).toHaveCount(0);
+});
+
+test.describe('on a touch screen', () => {
+  // A phone's screen and touch input (its browser type cannot change inside a group).
+  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 7'];
+  test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });
+
+  for (const game of ['survival', 'taming'] as const) {
+    test(`/cats/${game} says the game needs a keyboard and mouse`, async ({ page }) => {
+      await page.goto(`/cats/${game}`);
+      await expect(page.getByTestId('fight-needs-keyboard')).toHaveText(
+        'This game needs a keyboard and mouse, for now. Come back on a computer to play it.'
+      );
+      await expect(page.getByTestId('fight-start')).toHaveCount(0);
+      await expect(page.getByTestId('fight-start-taming')).toHaveCount(0);
+    });
+  }
+});
diff --git a/tests/unit/xenocats/movement-pad.test.ts b/tests/unit/xenocats/movement-pad.test.ts
new file mode 100644
index 0000000..552405b
--- /dev/null
+++ b/tests/unit/xenocats/movement-pad.test.ts
@@ -0,0 +1,58 @@
+import { describe, expect, it } from 'vitest';
+import { DEAD_ZONE, knobOffset, padDirection } from '@/app/ui/xenocats/movement-pad';
+import { walkDirection } from '@/app/ui/xenocats/survival';
+
+const centre = { x: 100, y: 100 };
+const radius = 72;
+/** A touch `distance` px from the centre, at `degrees` (0 is east, 90 is down). */
+const at = (degrees: number, distance = 50) => ({
+  x: centre.x + Math.cos((degrees * Math.PI) / 180) * distance,
+  y: centre.y + Math.sin((degrees * Math.PI) / 180) * distance,
+});
+
+describe('the movement pad walks as WASD does', () => {
+  it('walks nowhere with the thumb in the middle', () => {
+    expect(padDirection(centre, centre, radius)).toEqual({ x: 0, y: 0 });
+  });
+
+  it('each of the four ways gives what its key gives', () => {
+    expect(padDirection(at(0), centre, radius)).toEqual(walkDirection(['KeyD']));
+    expect(padDirection(at(90), centre, radius)).toEqual(walkDirection(['KeyS']));
+    expect(padDirection(at(180), centre, radius)).toEqual(walkDirection(['KeyA']));
+    expect(padDirection(at(270), centre, radius)).toEqual(walkDirection(['KeyW']));
+  });
+
+  it('a diagonal gives what two keys give: no faster than a straight line', () => {
+    expect(padDirection(at(45), centre, radius)).toEqual(walkDirection(['KeyD', 'KeyS']));
+    expect(padDirection(at(135), centre, radius)).toEqual(walkDirection(['KeyA', 'KeyS']));
+    expect(padDirection(at(225), centre, radius)).toEqual(walkDirection(['KeyA', 'KeyW']));
+    expect(padDirection(at(315), centre, radius)).toEqual(walkDirection(['KeyD', 'KeyW']));
+    expect(Math.hypot(...Object.values(padDirection(at(45), centre, radius)))).toBeCloseTo(1);
+  });
+
+  it('snaps to the nearest of the eight ways', () => {
+    expect(padDirection(at(20), centre, radius)).toEqual(walkDirection(['KeyD']));
+    expect(padDirection(at(25), centre, radius)).toEqual(walkDirection(['KeyD', 'KeyS']));
+    expect(padDirection(at(-20), centre, radius)).toEqual(walkDirection(['KeyD']));
+    expect(padDirection(at(-25), centre, radius)).toEqual(walkDirection(['KeyD', 'KeyW']));
+  });
+
+  it('has a dead zone in the middle', () => {
+    const edge = DEAD_ZONE * radius;
+    expect(padDirection(at(0, edge - 1), centre, radius)).toEqual({ x: 0, y: 0 });
+    expect(padDirection(at(0, edge + 1), centre, radius)).toEqual({ x: 1, y: 0 });
+  });
+
+  it('walks on with the thumb slid off the pad, and stops when it is let go', () => {
+    expect(padDirection(at(90, radius * 3), centre, radius)).toEqual({ x: 0, y: 1 });
+    expect(padDirection(null, centre, radius)).toEqual({ x: 0, y: 0 });
+  });
+
+  it('draws the knob under the thumb, but never off the pad', () => {
+    expect(knobOffset(at(0, 30), centre, radius)).toEqual({ x: 30, y: 0 });
+    const far = knobOffset(at(90, radius * 2), centre, radius);
+    expect(far.x).toBeCloseTo(0);
+    expect(far.y).toBeCloseTo(radius);
+    expect(knobOffset(null, centre, radius)).toEqual({ x: 0, y: 0 });
+  });
+});
~~~~

</details>

#### T5 — `night-2026-10-07-t5-taming-treats`

Taming with treats: the ranger walks (keys or pad), carries treats to cats to tame them (`taming.ts`, `fight.tsx`). Why: plan task 5 (D17–D22).

<details><summary>Code: 7 files changed, 680 insertions(+), 361 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 1ef172f..33cec4f 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -50,7 +50,7 @@ jobs:
           npx vitest run tests/unit/xenocats/survival tests/unit/xenocats/locked-pointer
           tests/unit/xenocats/taming tests/unit/xenocats/page-hits tests/unit/xenocats/sounds
           tests/unit/xenocats/field-guide tests/unit/xenocats/pet-cat tests/unit/xenocats/combos
-          tests/unit/xenocats/gun tests/unit/xenocats/puppets
+          tests/unit/xenocats/gun tests/unit/xenocats/puppets tests/unit/xenocats/movement-pad
       # A test file in no group would never run: each unit test must be named in a
       # group above, each browser test in a group of both browser jobs below.
       - name: Every test file is in a group
diff --git a/app/ui/xenocats/fight-page.tsx b/app/ui/xenocats/fight-page.tsx
index 6bab365..8fd79f1 100644
--- a/app/ui/xenocats/fight-page.tsx
+++ b/app/ui/xenocats/fight-page.tsx
@@ -21,12 +21,13 @@ const hasFinePointer = () =>
 /**
  * A fight game's page (/cats/survival, /cats/taming): the game itself, with the
  * cats and the fake cursor it plays with. No cat comes on its own here. On a touch
- * screen (no precise pointer) the page says the game needs a keyboard and mouse.
+ * screen (no precise pointer) Taming is walked with the movement pad, and Survival
+ * says it needs a keyboard and mouse.
  */
 export default function FightPage({ kind }: { kind: Kind }) {
-  // The server cannot know: it renders the game, and a touch screen swaps it out.
+  // The server cannot know: it renders the desktop game, and a touch screen swaps it.
   const fine = useSyncExternalStore(subscribePointer, hasFinePointer, () => true);
-  if (!fine) {
+  if (!fine && kind === 'survival') {
     return (
       <div>
         <h1 className="font-display text-4xl font-semibold text-cream md:text-[52px]">
@@ -41,7 +42,7 @@ export default function FightPage({ kind }: { kind: Kind }) {
   return (
     <XenocatCursorProvider>
       <XenocatCatsProvider autoSpawn={false}>
-        <Fight kind={kind} />
+        <Fight kind={kind} touch={!fine} />
       </XenocatCatsProvider>
     </XenocatCursorProvider>
   );
diff --git a/app/ui/xenocats/fight.tsx b/app/ui/xenocats/fight.tsx
index ecf7d10..f4fe18f 100644
--- a/app/ui/xenocats/fight.tsx
+++ b/app/ui/xenocats/fight.tsx
@@ -8,7 +8,7 @@ import { CatSprite } from './cat-sprite';
 import { CAT_TYPES, catTypeById } from './cat-types';
 import { CAT_CONFIG } from './config';
 import { type CursorLook, MAX_DECOYS, type Vec } from './effects';
-import { CursorShape, hideCursor, placeCursor, useXenocatCursor } from './fake-cursor';
+import { hideCursor, placeCursor, useXenocatCursor } from './fake-cursor';
 import { type LockedPointer, createLockedPointer } from './locked-pointer';
 import { PLAYER_SIZE, PlayerSprite, gunTransform } from './player-sprite';
 import { shotFor } from './gun';
@@ -25,7 +25,8 @@ import {
   isWalkKey,
   walkDirection,
 } from './survival';
-import { type Taming, type TamingSnapshot, createTaming } from './taming';
+import { type Taming, type TamingSnapshot, createTaming, treatInfo } from './taming';
+import { MovementPad } from './movement-pad-view';
 import { getGuide, getServerGuide, recordStat, recordTamed, subscribeGuide } from './field-guide';
 
 // Fight a cat, each game on a page of its own (fight-page.tsx): the page is the
@@ -38,8 +39,9 @@ import { getGuide, getServerGuide, recordStat, recordTamed, subscribeGuide } fro
 //
 // Two games: Survival (/cats/survival, survival.ts), where a ranger walked with
 // WASD beams cats home at the crosshair, and Taming (/cats/taming, taming.ts), where
-// one cat at a time dodges the pointer and holding still on it for 2 s tames it,
-// into a collection kept in localStorage.
+// the same ranger, unarmed, carries treats to one cat at a time to tame it, into a
+// collection kept in localStorage. Taming is played on touch screens too, walked
+// with the movement pad (movement-pad-view.tsx); there the pointer is never locked.
 //
 // In Survival the ranger and the crosshair are both positions a cat's attack can
 // move (locked-pointer.ts, one each): WASD walks the one, the mouse moves the other,
@@ -54,7 +56,7 @@ type Game = {
   mode: Mode;
 } & (
   | { kind: 'survival'; survival: Survival; player: LockedPointer; aim: LockedPointer }
-  | { kind: 'taming'; taming: Taming; pointer: LockedPointer | null }
+  | { kind: 'taming'; taming: Taming; ranger: LockedPointer }
 );
 
 type Departure = { id: number; typeId: string; x: number; y: number };
@@ -154,7 +156,14 @@ const beamTransform = (beam: Beam) =>
 
 const viewportSize = () => ({ width: window.innerWidth, height: window.innerHeight });
 
-export default function Fight({ kind }: { kind: Kind }) {
+export default function Fight({
+  kind,
+  touch = false,
+}: {
+  kind: Kind;
+  /** A touch screen: Taming is walked with the movement pad. */
+  touch?: boolean;
+}) {
   const cursor = useXenocatCursor();
   const cats = useXenocats();
   const [phase, setPhase] = useState<Phase>('idle');
@@ -173,8 +182,11 @@ export default function Fight({ kind }: { kind: Kind }) {
   const [message, setMessage] = useState('');
   const gameRef = useRef<Game | null>(null);
   const phaseRef = useRef<Phase>('idle');
-  const pointerRef = useRef<HTMLDivElement>(null);
-  const decoyRefs = useRef<(HTMLDivElement | null)[]>([]);
+  // The way the movement pad is held (zero when it is not).
+  const padRef = useRef<Vec>({ x: 0, y: 0 });
+  const onPad = useCallback((direction: Vec) => {
+    padRef.current = direction;
+  }, []);
   const playerRef = useRef<HTMLDivElement>(null);
   const playerDecoyRefs = useRef<(HTMLDivElement | null)[]>([]);
   const gunRef = useRef<HTMLDivElement>(null);
@@ -207,7 +219,7 @@ export default function Fight({ kind }: { kind: Kind }) {
       setSnap(final);
       setMessage(`Game over. You survived ${plural(final.score, 'wave', 'waves')}. Best: ${kept}.`);
     } else {
-      const tamed = game.taming.snapshot(game.clock.now(performance.now())).tamed.length;
+      const tamed = game.taming.snapshot().tamed.length;
       setMessage(`Taming over. You tamed ${plural(tamed, 'cat', 'cats')}.`);
     }
     setDepartures([]);
@@ -223,8 +235,9 @@ export default function Fight({ kind }: { kind: Kind }) {
     changePhase('paused');
   }, [cursor, changePhase]);
 
-  // The fake cursor gives way to the game's own: the arrow under pointer lock, the
-  // crosshair in Survival.
+  // The fake cursor gives way to the game's own crosshair in Survival, and to the
+  // locked pointer; in Taming's fallback it stays, so End game can be found (the
+  // pointer itself plays no part in Taming).
   const hidesCursor = (game: Game) => game.kind === 'survival' || game.mode === 'locked';
 
   const begin = (game: Game) => {
@@ -233,13 +246,18 @@ export default function Fight({ kind }: { kind: Kind }) {
     setMode(game.mode);
     setDepartures([]);
     if (game.kind === 'survival') setSnap(game.survival.snapshot());
-    else setTameSnap(game.taming.snapshot(0));
+    else setTameSnap(game.taming.snapshot());
     cursor.hide(hidesCursor(game));
-    const stop = game.mode === 'locked' ? 'Press Esc to stop.' : 'Press Esc or End game to stop.';
+    const stop =
+      game.mode === 'locked'
+        ? 'Press Esc to stop.'
+        : touch
+          ? 'Tap End game to stop.'
+          : 'Press Esc or End game to stop.';
     setMessage(
       game.kind === 'survival'
         ? `The cats are coming. Walk with WASD and aim: your beam fires by itself. ${stop}`
-        : `Keep still and a cat will come. Hold still on it to tame it. ${stop}`
+        : `Walk with ${touch ? 'the pad' : 'WASD'} to a treat, then carry it to the cat. ${stop}`
     );
     changePhase('playing');
   };
@@ -249,7 +267,8 @@ export default function Fight({ kind }: { kind: Kind }) {
       return;
     }
     startingRef.current = true;
-    const locked = await requestLock();
+    // A touch screen has no pointer to lock.
+    const locked = touch ? false : await requestLock();
     startingRef.current = false;
     if (!mountedRef.current) {
       if (locked) document.exitPointerLock();
@@ -277,7 +296,7 @@ export default function Fight({ kind }: { kind: Kind }) {
             mode,
             kind,
             taming: createTaming(options),
-            pointer: locked ? position(at) : null,
+            ranger: position({ x: viewport.width / 2, y: viewport.height / 2 }),
           }
     );
   };
@@ -294,7 +313,6 @@ export default function Fight({ kind }: { kind: Kind }) {
       if (!locked) {
         // Refused this time: carry on with the page's pointer.
         game.mode = 'fallback';
-        if (game.kind === 'taming') game.pointer = null;
         setMode('fallback');
       }
     }
@@ -439,6 +457,49 @@ export default function Fight({ kind }: { kind: Kind }) {
       return snapshot;
     };
 
+    // Taming's ranger walks with the held keys, or the pad when none are held.
+    const playTaming = (now: number, game: Extract<Game, { kind: 'taming' }>): TamingSnapshot => {
+      const dt = Math.max(now - lastNow, 0) / 1000;
+      const keys = walkDirection(held);
+      const way = keys.x !== 0 || keys.y !== 0 ? keys : padRef.current;
+      const speed = game.taming.config.rangerSpeed * dt;
+      if (way.x !== 0 || way.y !== 0) game.ranger.move(way.x * speed, way.y * speed);
+      const body = game.ranger.frame(now);
+      const at = { x: body.x, y: body.y };
+      const events = game.taming.tick(now, at, CAT_CONFIG.maxCats - cats.count());
+      if (events.attack) {
+        // Its attack lands on the ranger as it does in Survival.
+        const type = catTypeById(events.attack.typeId);
+        if (type && game.ranger.attack(type.effect, events.attack, now)) {
+          cats.sound(type.id, 'attack');
+        }
+      }
+      if (events.tamed) {
+        recordTamed(events.tamed);
+        cats.sound(events.tamed, 'purr');
+        setMessage(`You tamed ${catTypeById(events.tamed)?.name ?? 'a cat'}!`);
+      }
+      placeWithDecoys(playerRef.current, playerDecoyRefs.current, {
+        ...body,
+        scale: Math.min(body.scale, MAX_PLAYER_SCALE),
+      });
+      if (playerRef.current) {
+        playerRef.current.dataset.effect = game.ranger.activeEffectId(now) ?? '';
+        playerRef.current.dataset.x = String(Math.round(at.x));
+        playerRef.current.dataset.y = String(Math.round(at.y));
+      }
+      const walking = way.x !== 0 || way.y !== 0;
+      // Facing the way it walks; standing, the way it last walked.
+      const facing = walking
+        ? facingTowards(at, { x: at.x + way.x, y: at.y + way.y })
+        : (shown?.facing ?? 'e');
+      if (facing !== shown?.facing || walking !== shown.walking) {
+        shown = { facing, walking };
+        setPose(shown);
+      }
+      return game.taming.snapshot();
+    };
+
     let frameId = 0;
     const loop = () => {
       if (phaseRef.current !== 'playing') {
@@ -447,32 +508,11 @@ export default function Fight({ kind }: { kind: Kind }) {
       } else {
         const now = game.clock.now(performance.now());
         if (game.kind === 'taming') {
-          let at: Vec;
-          if (game.mode === 'locked' && game.pointer) {
-            const look = game.pointer.frame(now);
-            at = { x: look.x, y: look.y };
-            const element = pointerRef.current;
-            if (element) placeCursor(element, look, look);
-            const decoys = look.decoys ?? [];
-            decoyRefs.current.forEach((decoy, i) => {
-              if (!decoy) return;
-              if (i < decoys.length) placeCursor(decoy, decoys[i], look);
-              else hideCursor(decoy);
-            });
-          } else {
-            const viewport = viewportSize();
-            at = cursor.position() ?? { x: viewport.width / 2, y: viewport.height / 2 };
-          }
-          const tamed = game.taming.tick(now, at, CAT_CONFIG.maxCats - cats.count());
-          if (tamed) {
-            recordTamed(tamed);
-            setMessage(`You tamed ${catTypeById(tamed)?.name ?? 'a cat'}!`);
-          }
-          const snapshot = game.taming.snapshot(now);
+          const snapshot = playTaming(now, game);
           hearArrivals(snapshot.cat ? [snapshot.cat] : []);
           moveCats(snapshot.cat ? [snapshot.cat] : []);
-          const { cat, hold } = snapshot;
-          const key = `${cat?.id}|${cat?.doing}|${Math.round(hold * 50)}|${snapshot.tamed.length}`;
+          const { cat, treats, carrying, tamed } = snapshot;
+          const key = `${cat?.id}|${cat?.doing}|${treats.map((t) => t.id).join(',')}|${carrying}|${tamed.length}`;
           if (key !== shownRef.current) {
             shownRef.current = key;
             setTameSnap(snapshot);
@@ -505,10 +545,8 @@ export default function Fight({ kind }: { kind: Kind }) {
 
     const onMouseMove = (event: MouseEvent) => {
       if (phaseRef.current !== 'playing') return;
-      if (game.kind === 'taming') {
-        if (game.pointer && isLocked()) game.pointer.move(event.movementX, event.movementY);
-        return;
-      }
+      // The pointer plays no part in Taming.
+      if (game.kind === 'taming') return;
       if (isLocked()) {
         lastClient = null;
         game.aim.move(event.movementX, event.movementY);
@@ -535,7 +573,7 @@ export default function Fight({ kind }: { kind: Kind }) {
         finish();
         return;
       }
-      if (game.kind !== 'survival' || phaseRef.current !== 'playing') return;
+      if (phaseRef.current !== 'playing') return;
       if (event.ctrlKey || event.metaKey || event.altKey || !isWalkKey(event.code)) return;
       // The arrow keys would scroll the page under the game.
       event.preventDefault();
@@ -554,7 +592,7 @@ export default function Fight({ kind }: { kind: Kind }) {
         game.aim.resize(viewportSize());
       } else {
         game.taming.resize(viewportSize());
-        game.pointer?.resize(viewportSize());
+        game.ranger.resize(viewportSize());
       }
     };
 
@@ -605,13 +643,18 @@ export default function Fight({ kind }: { kind: Kind }) {
         </p>
       ) : (
         <p className="mt-4 max-w-2xl text-sm text-aura">
-          One cat at a time, and it dodges your pointer, each kind in its own way. Keep still and it
-          gets curious; hold your pointer still on it for 2 seconds to tame it.
+          Walk your ranger with {touch ? 'the pad' : 'WASD (or the arrow keys)'} and pick up a treat
+          (fish, catnip, yarn, milk); treats turn up here and there, and do not wait for long. One
+          cat at a time: while you carry nothing it keeps away, each kind in its own way, and
+          attacks you from a distance. Carry a treat and it comes to you: give it the treat, and the
+          cat is tamed.
+        </p>
+      )}
+      {!touch && (
+        <p className="mt-2 max-w-2xl text-sm text-aura">
+          Your pointer is locked to the game until you press Esc.
         </p>
       )}
-      <p className="mt-2 max-w-2xl text-sm text-aura">
-        Your pointer is locked to the game until you press Esc.
-      </p>
       <div ref={startRef} className="mt-4 flex flex-wrap items-center gap-4">
         {kind === 'survival' ? (
           <>
@@ -665,16 +708,17 @@ export default function Fight({ kind }: { kind: Kind }) {
             {kind === 'taming' && tameSnap && (
               <>
                 <p data-testid="fight-tamed-now">Tamed this game: {tameSnap.tamed.length}</p>
-                <div
-                  role="progressbar"
-                  aria-label="Taming"
-                  aria-valuemin={0}
-                  aria-valuemax={100}
-                  aria-valuenow={Math.round(tameSnap.hold * 100)}
-                  className="h-2 w-32 overflow-hidden rounded-full bg-void"
-                >
-                  <div className="h-full bg-plasma" style={{ width: `${tameSnap.hold * 100}%` }} />
-                </div>
+                <p data-testid="fight-carrying" data-carrying={tameSnap.carrying ?? ''}>
+                  Carrying:{' '}
+                  {tameSnap.carrying ? (
+                    <>
+                      <span aria-hidden="true">{treatInfo(tameSnap.carrying).emoji}</span>{' '}
+                      {treatInfo(tameSnap.carrying).name}
+                    </>
+                  ) : (
+                    'nothing'
+                  )}
+                </p>
               </>
             )}
             <p role="status" className="text-plasma">
@@ -702,17 +746,32 @@ export default function Fight({ kind }: { kind: Kind }) {
                   top: tameSnap.cat.y - size / 2,
                   width: size,
                   height: size,
-                  // A blinking cat is gone for a moment; a held one glows as it calms.
+                  // A blinking cat is gone for a moment; one coming for a treat glows.
                   opacity: tameSnap.cat.doing === 'blink' ? 0.15 : 1,
                   boxShadow:
-                    tameSnap.hold > 0
-                      ? `0 0 0 3px rgba(255, 255, 255, ${0.2 + tameSnap.hold * 0.6})`
+                    tameSnap.cat.doing === 'coming'
+                      ? '0 0 0 3px rgba(193, 232, 56, 0.6)'
                       : undefined,
                 }}
               >
                 <FightCatSprite typeId={tameSnap.cat.typeId} size={size} />
               </div>
             )}
+            {kind === 'taming' &&
+              tameSnap?.treats.map((treat) => (
+                // Emoji for now: placeholders until the treats get artwork of their own.
+                <div
+                  key={treat.id}
+                  data-testid="fight-treat"
+                  data-kind={treat.kind}
+                  data-x={Math.round(treat.x)}
+                  data-y={Math.round(treat.y)}
+                  className="absolute flex items-center justify-center rounded-full bg-panel/80 text-xl ring-1 ring-plasma/50"
+                  style={{ left: treat.x - 18, top: treat.y - 18, width: 36, height: 36 }}
+                >
+                  {treatInfo(treat.kind).emoji}
+                </div>
+              ))}
             {kind === 'survival' &&
               snap?.cats.map((cat) => (
                 <div
@@ -782,36 +841,44 @@ export default function Fight({ kind }: { kind: Kind }) {
               ))}
           </div>
 
-          {kind === 'survival' && (
-            <div aria-hidden="true">
-              {Array.from({ length: MAX_DECOYS }, (_, i) => (
-                <div
-                  key={i}
-                  ref={(element) => {
-                    playerDecoyRefs.current[i] = element;
-                  }}
-                  className="pointer-events-none fixed left-0 top-0 h-0 w-0 origin-top-left"
-                  style={{ opacity: 0 }}
-                >
-                  <div className="absolute" style={{ left: -half, top: -half }}>
-                    <PlayerSprite facing={pose.facing} walking={pose.walking} />
-                  </div>
-                </div>
-              ))}
+          {/* The ranger: armed in Survival, empty-handed in Taming. */}
+          <div aria-hidden="true">
+            {Array.from({ length: MAX_DECOYS }, (_, i) => (
               <div
-                ref={playerRef}
-                data-testid="fight-player"
-                data-facing={pose.facing}
-                data-walking={pose.walking}
+                key={i}
+                ref={(element) => {
+                  playerDecoyRefs.current[i] = element;
+                }}
                 className="pointer-events-none fixed left-0 top-0 h-0 w-0 origin-top-left"
                 style={{ opacity: 0 }}
               >
                 <div className="absolute" style={{ left: -half, top: -half }}>
-                  <PlayerSprite facing={pose.facing} walking={pose.walking} gunRef={gunRef} />
+                  <PlayerSprite
+                    facing={pose.facing}
+                    walking={pose.walking}
+                    armed={kind === 'survival'}
+                  />
                 </div>
               </div>
+            ))}
+            <div
+              ref={playerRef}
+              data-testid="fight-player"
+              data-facing={pose.facing}
+              data-walking={pose.walking}
+              className="pointer-events-none fixed left-0 top-0 h-0 w-0 origin-top-left"
+              style={{ opacity: 0 }}
+            >
+              <div className="absolute" style={{ left: -half, top: -half }}>
+                <PlayerSprite
+                  facing={pose.facing}
+                  walking={pose.walking}
+                  armed={kind === 'survival'}
+                  gunRef={gunRef}
+                />
+              </div>
             </div>
-          )}
+          </div>
 
           {kind === 'survival' && phase === 'playing' && (
             <div aria-hidden="true">
@@ -851,29 +918,8 @@ export default function Fight({ kind }: { kind: Kind }) {
             </div>
           )}
 
-          {kind === 'taming' && mode === 'locked' && phase === 'playing' && (
-            <div aria-hidden="true">
-              {Array.from({ length: MAX_DECOYS }, (_, i) => (
-                <div
-                  key={i}
-                  ref={(element) => {
-                    decoyRefs.current[i] = element;
-                  }}
-                  className="pointer-events-none fixed left-0 top-0 origin-top-left"
-                  style={{ opacity: 0 }}
-                >
-                  <CursorShape kind="arrow" />
-                </div>
-              ))}
-              <div
-                ref={pointerRef}
-                data-testid="fight-pointer"
-                className="pointer-events-none fixed left-0 top-0 origin-top-left"
-                style={{ opacity: 0 }}
-              >
-                <CursorShape kind="arrow" />
-              </div>
-            </div>
+          {touch && kind === 'taming' && phase === 'playing' && (
+            <MovementPad onDirection={onPad} className="fixed bottom-8 left-8 z-10" />
           )}
         </div>
       )}
diff --git a/app/ui/xenocats/player-sprite.tsx b/app/ui/xenocats/player-sprite.tsx
index 1f638be..8d813af 100644
--- a/app/ui/xenocats/player-sprite.tsx
+++ b/app/ui/xenocats/player-sprite.tsx
@@ -58,9 +58,12 @@ export function PlayerSprite({
   facing,
   walking,
   gunRef,
+  armed = true,
 }: {
   facing: Facing;
   walking: boolean;
+  /** Carrying the gun (Survival), or empty-handed (Taming). */
+  armed?: boolean;
   /** The gun the game loop turns; decoys leave it pointing the way they face. */
   gunRef?: React.Ref<HTMLDivElement>;
 }) {
@@ -88,7 +91,7 @@ export function PlayerSprite({
       className={walking ? 'xenocat-player xenocat-player-walking' : 'xenocat-player'}
       style={{ position: 'relative', width: PLAYER_SIZE, height: PLAYER_SIZE }}
     >
-      {gunBehind(facing) && gun}
+      {armed && gunBehind(facing) && gun}
       <svg
         width={PLAYER_SIZE}
         height={PLAYER_SIZE}
@@ -166,7 +169,7 @@ export function PlayerSprite({
           )}
         </g>
       </svg>
-      {!gunBehind(facing) && gun}
+      {armed && !gunBehind(facing) && gun}
     </div>
   );
 }
diff --git a/app/ui/xenocats/taming.ts b/app/ui/xenocats/taming.ts
index 3561229..398d636 100644
--- a/app/ui/xenocats/taming.ts
+++ b/app/ui/xenocats/taming.ts
@@ -1,9 +1,13 @@
-// Fight a cat, Taming mode, as a pure state machine (time and pointer passed in).
+// Fight a cat, Taming mode, as a pure state machine (time and the ranger passed in).
 //
-// One cat at a time wanders the screen. A pointer moving near it makes it dodge, each
-// cat type in its own way, derived from its attack (DODGES). A pointer that keeps
-// still makes it curious: it walks over and stops beneath it. Holding the pointer
-// still on a cat for 2 s tames it, and the next cat comes.
+// The ranger (walked with WASD, or the movement pad on a touch screen) carries
+// treats to the cats. Treats turn up at random spots, a few at a time, and vanish
+// if nobody picks them up; walking over one picks it up, one at a time. One cat at
+// a time wanders the screen. While the ranger has no treat the cat keeps away: it
+// flees a ranger who comes close, each type in its own way derived from its attack
+// (DODGES), and attacks from a distance with its own effect. While the ranger
+// carries a treat it stops all that and comes over; when they touch, the treat is
+// given and the cat is tamed, and the next one comes. Nothing is ever lost.
 
 import type { CatType } from './cat-types';
 import { CAT_CONFIG } from './config';
@@ -149,38 +153,66 @@ export function dodgeTarget(
 }
 
 export type TamingConfig = {
-  /** Holding still on a cat this long tames it, ms. */
-  tameMs: number;
-  /** The pointer is on the cat within this distance of its centre, px. */
+  /** How fast the ranger walks, px/s (the game moves it; Survival's pace). */
+  rangerSpeed: number;
+  /** The ranger touches the cat within this distance of its centre, px. */
   catchRadius: number;
-  /** A pointer that moves within this distance of the cat makes it dodge, px. */
+  /** Without a treat, the ranger this near makes the cat flee, px. */
   noticeRadius: number;
-  /** A pointer is still while it stays within this distance, px. */
-  stillPx: number;
-  /** A pointer still this long makes the cat curious: it walks over, ms. */
-  curiousAfterMs: number;
-  /** How fast a wandering or curious cat walks, px/s. */
+  /** Without a treat, the cat attacks the ranger from this near, px. */
+  attackRange: number;
+  /** How often it attacks while the ranger is in range, ms. */
+  attackEveryMs: number;
+  /** How fast a wandering cat walks, px/s. */
   walkSpeed: number;
-  /** After a dodge the cat ignores the pointer this long, so it can be approached, ms. */
+  /** How fast a cat comes to a ranger carrying a treat, px/s. */
+  approachSpeed: number;
+  /** After a dodge the cat stays put this long before it flees again, ms. */
   calmMs: number;
   /** The pause before the next cat, ms. */
   breakMs: number;
-  /** A new cat appears at least this far from the pointer, px. */
-  keepAwayFromPointer: number;
+  /** A new cat appears at least this far from the ranger, px. */
+  keepAwayFromRanger: number;
+  /** A new treat appears this often, ms, while there are fewer than `maxTreats`. */
+  treatEveryMs: number;
+  maxTreats: number;
+  /** A treat nobody picks up vanishes after this long, ms. */
+  treatLifeMs: number;
+  /** The ranger picks a treat up within this distance of it, px. */
+  pickupRadius: number;
 };
 
 export const TAMING_CONFIG: TamingConfig = {
-  tameMs: 2000,
-  catchRadius: CAT_CONFIG.catSize / 2,
-  noticeRadius: 140,
-  stillPx: 6,
-  curiousAfterMs: 1000,
-  walkSpeed: 110,
-  calmMs: 500,
+  rangerSpeed: 280,
+  catchRadius: CAT_CONFIG.catSize / 2 + 16,
+  noticeRadius: 160,
+  attackRange: 320,
+  attackEveryMs: 2500,
+  walkSpeed: 90,
+  approachSpeed: 170,
+  calmMs: 600,
   breakMs: 1200,
-  keepAwayFromPointer: 240,
+  keepAwayFromRanger: 240,
+  treatEveryMs: 1800,
+  maxTreats: 3,
+  treatLifeMs: 9000,
+  pickupRadius: 40,
 };
 
+/** What a cat can be won over with. Emoji for now: placeholders for real artwork. */
+export const TREATS = [
+  { kind: 'fish', name: 'Fish', emoji: '🐟' },
+  { kind: 'catnip', name: 'Catnip', emoji: '🌿' },
+  { kind: 'yarn', name: 'Yarn', emoji: '🧶' },
+  { kind: 'milk', name: 'Milk', emoji: '🥛' },
+] as const;
+
+export type TreatKind = (typeof TREATS)[number]['kind'];
+
+export const treatInfo = (kind: TreatKind) => TREATS.find((treat) => treat.kind === kind)!;
+
+export type Treat = { id: number; kind: TreatKind; x: number; y: number; expiresAt: number };
+
 export type TamingCat = {
   id: number;
   typeId: string;
@@ -188,21 +220,36 @@ export type TamingCat = {
   x: number;
   y: number;
   /** What it is doing: a dodge's kind while dodging. */
-  doing: 'wandering' | 'curious' | 'held' | DodgeKind;
+  doing: 'wandering' | 'coming' | DodgeKind;
 };
 
 export type TamingSnapshot = {
   cat: TamingCat | null;
-  /** How far along the 2 s hold is, 0–1. */
-  hold: number;
+  treats: readonly Treat[];
+  /** The treat the ranger carries, if any. */
+  carrying: TreatKind | null;
   /** Type ids tamed this game, in order. */
   tamed: readonly string[];
 };
 
+/** What happened in one tick. */
+export type TamingEvents = {
+  /** The type id of a cat tamed this tick. */
+  tamed: string | null;
+  /** The cat, if it attacked the ranger this tick (its effect lands on the ranger). */
+  attack: TamingCat | null;
+  /** A treat the ranger picked up this tick. */
+  picked: TreatKind | null;
+};
+
 type Motion = { from: Vec; to: Vec; startsAt: number; endsAt: number; kind: DodgeKind };
 
 export type Taming = ReturnType<typeof createTaming>;
 
+/**
+ * Taming with treats. Time and the ranger's position are passed in, and anything
+ * random comes from `random`, so it is tested in Node.
+ */
 export function createTaming(options: {
   random: Random;
   types: readonly CatType[];
@@ -219,10 +266,11 @@ export function createTaming(options: {
   let lastTick = options.now;
   let motion: Motion | null = null;
   let calmUntil = -Infinity;
+  let nextAttackAt = -Infinity;
   let wanderTo: Vec | null = null;
-  /** Where the pointer has been keeping still, and since when. */
-  let still: { at: Vec; since: number } | null = null;
-  let holdSince: number | null = null;
+  let treats: Treat[] = [];
+  let nextTreatAt = options.now;
+  let carrying: TreatKind | null = null;
   let tamed: string[] = [];
 
   const inset = CAT_CONFIG.catSize / 2;
@@ -230,28 +278,36 @@ export function createTaming(options: {
     x: random.range(inset, Math.max(viewport.width - inset, inset + 1)),
     y: random.range(inset, Math.max(viewport.height - inset, inset + 1)),
   });
+  const view = (c: TamingCat): TamingCat => ({
+    id: c.id,
+    typeId: c.typeId,
+    x: c.x,
+    y: c.y,
+    doing: c.doing,
+  });
 
-  function spawn(pointer: Vec) {
+  function spawnCat(ranger: Vec, now: number) {
     let spot = randomSpot();
     for (let attempt = 0; attempt < 20; attempt++) {
-      if (Math.hypot(spot.x - pointer.x, spot.y - pointer.y) >= config.keepAwayFromPointer) break;
+      if (Math.hypot(spot.x - ranger.x, spot.y - ranger.y) >= config.keepAwayFromRanger) break;
       spot = randomSpot();
     }
     const type = random.pick(types);
     cat = { id: nextId++, typeId: type.id, type, ...spot, doing: 'wandering' };
     motion = null;
     wanderTo = null;
-    holdSince = null;
     calmUntil = -Infinity;
+    // A moment to see it before it first attacks.
+    nextAttackAt = now + config.attackEveryMs / 2;
   }
 
-  /** Walks the cat towards `to` for `dt` seconds; true once it is there. */
-  function walk(to: Vec, dt: number): boolean {
+  /** Walks the cat towards `to` at `speed` for `dt` seconds; true once it is there. */
+  function walk(to: Vec, speed: number, dt: number): boolean {
     if (!cat) return true;
     const dx = to.x - cat.x;
     const dy = to.y - cat.y;
     const distance = Math.hypot(dx, dy);
-    const step = config.walkSpeed * dt;
+    const step = speed * dt;
     if (distance <= step) {
       cat.x = to.x;
       cat.y = to.y;
@@ -262,8 +318,28 @@ export function createTaming(options: {
     return false;
   }
 
-  const holdProgress = (now: number) =>
-    holdSince === null ? 0 : Math.min((now - holdSince) / config.tameMs, 1);
+  /** The treats: old ones vanish, new ones come, and one under the ranger is picked up. */
+  function tickTreats(now: number, ranger: Vec): TreatKind | null {
+    treats = treats.filter((treat) => treat.expiresAt > now);
+    if (now >= nextTreatAt) {
+      if (treats.length < config.maxTreats) {
+        const kind = random.pick(TREATS).kind;
+        treats = [
+          ...treats,
+          { id: nextId++, kind, ...randomSpot(), expiresAt: now + config.treatLifeMs },
+        ];
+      }
+      nextTreatAt = now + config.treatEveryMs;
+    }
+    if (carrying) return null;
+    const reached = treats.find(
+      (treat) => Math.hypot(treat.x - ranger.x, treat.y - ranger.y) <= config.pickupRadius
+    );
+    if (!reached) return null;
+    treats = treats.filter((treat) => treat !== reached);
+    carrying = reached.kind;
+    return reached.kind;
+  }
 
   return {
     config,
@@ -272,92 +348,80 @@ export function createTaming(options: {
       viewport = size;
     },
 
-    snapshot(now: number): TamingSnapshot {
-      return {
-        cat: cat ? { id: cat.id, typeId: cat.typeId, x: cat.x, y: cat.y, doing: cat.doing } : null,
-        hold: holdProgress(now),
-        tamed: [...tamed],
-      };
+    snapshot(): TamingSnapshot {
+      return { cat: cat ? view(cat) : null, treats: [...treats], carrying, tamed: [...tamed] };
     },
 
     /**
-     * Advances to `now`. `room` is how many more cats the screen may hold (others
-     * count against the limit); no cat comes while it is 0. Returns the type id of
-     * a cat tamed this tick, or null.
+     * Advances to `now`, the ranger at `ranger`. `room` is how many more cats the
+     * screen may hold (others count against the limit); no cat comes while it is 0.
      */
-    tick(now: number, pointer: Vec, room = 1): string | null {
+    tick(now: number, ranger: Vec, room = 1): TamingEvents {
       const dt = Math.max(now - lastTick, 0) / 1000;
       lastTick = now;
-
-      // Is the pointer keeping still?
-      const moved =
-        !still || Math.hypot(pointer.x - still.at.x, pointer.y - still.at.y) > config.stillPx;
-      if (moved) still = { at: pointer, since: now };
-      const stillFor = now - still!.since;
+      const events: TamingEvents = { tamed: null, attack: null, picked: tickTreats(now, ranger) };
 
       if (!cat) {
-        if (now >= nextCatAt && room > 0 && types.length > 0) spawn(pointer);
-        return null;
+        if (now >= nextCatAt && room > 0 && types.length > 0) spawnCat(ranger, now);
+        return events;
       }
 
       // A dodge under way (or waiting for a slow cat to react) runs to its end.
       if (motion) {
-        if (now < motion.startsAt) return null;
+        if (now < motion.startsAt) return events;
         const t = Math.min((now - motion.startsAt) / (motion.endsAt - motion.startsAt), 1);
         const eased = 1 - (1 - t) ** 3;
         cat.x = motion.from.x + (motion.to.x - motion.from.x) * eased;
         cat.y = motion.from.y + (motion.to.y - motion.from.y) * eased;
         cat.doing = motion.kind;
-        if (t < 1) return null;
+        if (t < 1) return events;
         motion = null;
         calmUntil = now + config.calmMs;
         wanderTo = null;
       }
 
-      const distance = Math.hypot(pointer.x - cat.x, pointer.y - cat.y);
+      // A treat in hand: the cat stops fleeing and attacking and comes for it. When
+      // they touch, the treat is given, the cat is tamed, and the next one comes.
+      if (carrying) {
+        cat.doing = 'coming';
+        walk(ranger, config.approachSpeed, dt);
+        if (Math.hypot(ranger.x - cat.x, ranger.y - cat.y) <= config.catchRadius) {
+          const id = cat.typeId;
+          tamed = [...tamed, id];
+          cat = null;
+          carrying = null;
+          nextCatAt = now + config.breakMs;
+          events.tamed = id;
+        }
+        return events;
+      }
+
+      const distance = Math.hypot(ranger.x - cat.x, ranger.y - cat.y);
+
+      // No treat: the cat keeps away, attacking from a distance...
+      if (distance <= config.attackRange && now >= nextAttackAt) {
+        nextAttackAt = now + config.attackEveryMs;
+        events.attack = view(cat);
+      }
 
-      // A pointer moving close by: dodge.
-      if (moved && distance <= config.noticeRadius && now >= calmUntil) {
+      // ...and fleeing a ranger who comes close, each kind in its own way.
+      if (distance <= config.noticeRadius && now >= calmUntil) {
         const style = dodgeFor(cat.type);
         const startsAt = now + style.reactMs;
         motion = {
           from: { x: cat.x, y: cat.y },
-          to: dodgeTarget(style, cat, pointer, viewport, random),
+          to: dodgeTarget(style, cat, ranger, viewport, random),
           startsAt,
           endsAt: startsAt + style.durationMs,
           kind: style.kind,
         };
-        holdSince = null;
-        return null;
-      }
-
-      // Held: the pointer is on the cat and keeping still.
-      if (!moved && distance <= config.catchRadius) {
-        holdSince ??= now;
-        cat.doing = 'held';
-        if (now - holdSince >= config.tameMs) {
-          const id = cat.typeId;
-          tamed = [...tamed, id];
-          cat = null;
-          holdSince = null;
-          nextCatAt = now + config.breakMs;
-          return id;
-        }
-        return null;
+        return events;
       }
-      holdSince = null;
 
-      // A still pointer draws the cat over; otherwise it wanders.
-      if (stillFor >= config.curiousAfterMs) {
-        cat.doing = 'curious';
-        walk(pointer, dt);
-        wanderTo = null;
-      } else {
-        cat.doing = 'wandering';
-        wanderTo ??= randomSpot();
-        if (walk(wanderTo, dt)) wanderTo = null;
-      }
-      return null;
+      cat.doing = 'wandering';
+      wanderTo ??= randomSpot();
+      if (walk(wanderTo, config.walkSpeed, dt)) wanderTo = null;
+      return events;
     },
   };
 }
diff --git a/tests/e2e/fight.spec.ts b/tests/e2e/fight.spec.ts
index 01c9cf2..bc87d65 100644
--- a/tests/e2e/fight.spec.ts
+++ b/tests/e2e/fight.spec.ts
@@ -217,71 +217,145 @@ test('Survival: a cat that touches the ranger costs a life', async ({ page }) =>
     .toBeLessThan(3);
 });
 
-test('Taming: a still pointer draws the cat over, holding still on it tames it into the collection', async ({
+/** What the Taming game shows: the ranger, the treats, what it carries, cats tamed this game. */
+const tamingState = (page: Page) =>
+  page.evaluate(() => {
+    const ranger = document.querySelector<HTMLElement>('[data-testid="fight-player"]');
+    const treats = Array.from(
+      document.querySelectorAll<HTMLElement>('[data-testid="fight-treat"]'),
+      (el) => ({ x: Number(el.dataset.x), y: Number(el.dataset.y) })
+    );
+    const carrying =
+      document.querySelector<HTMLElement>('[data-testid="fight-carrying"]')?.dataset.carrying ?? '';
+    const tamed = document.querySelector('[data-testid="fight-tamed-now"]')?.textContent ?? '';
+    return {
+      ranger:
+        ranger?.dataset.x !== undefined
+          ? { x: Number(ranger.dataset.x), y: Number(ranger.dataset.y) }
+          : null,
+      treats,
+      carrying,
+      tamed,
+    };
+  });
+
+/**
+ * Walks the ranger to the nearest treat (re-aiming as it goes: a cat's attack can
+ * push it about or turn its controls round), then stands still with the treat until
+ * the cat comes and is tamed. `steer` holds the ranger's way: -1, 0 or 1 on each axis.
+ */
+async function fetchTreatAndTame(
+  page: Page,
+  steer: (way: { x: number; y: number }) => Promise<void>
+) {
+  await expect
+    .poll(
+      async () => {
+        const state = await tamingState(page);
+        if (state.tamed.endsWith(': 1')) {
+          await steer({ x: 0, y: 0 });
+          return 'tamed';
+        }
+        if (state.carrying || !state.ranger || state.treats.length === 0) {
+          await steer({ x: 0, y: 0 });
+          return state.carrying ? 'carrying' : 'waiting';
+        }
+        const { ranger } = state;
+        const near = state.treats.reduce((a, b) =>
+          Math.hypot(a.x - ranger.x, a.y - ranger.y) <= Math.hypot(b.x - ranger.x, b.y - ranger.y)
+            ? a
+            : b
+        );
+        const axis = (d: number) => (Math.abs(d) < 12 ? 0 : Math.sign(d));
+        await steer({ x: axis(near.x - ranger.x), y: axis(near.y - ranger.y) });
+        return 'walking';
+      },
+      { timeout: 50_000, intervals: [60] }
+    )
+    .toBe('tamed');
+}
+
+test('Taming: walk to a treat, carry it to the cat, and the cat is tamed into the collection', async ({
   page,
 }) => {
-  test.setTimeout(60_000);
+  test.setTimeout(90_000);
   await openFight(page, undefined, { game: 'taming' });
   await expect(page.getByTestId('fight-tamed')).toHaveText('Tamed: 0 cats');
   await page.getByTestId('fight-start-taming').click();
-  const overlay = page.getByTestId('fight-area');
-  await expect(overlay).toHaveAttribute('data-kind', 'taming');
-  await expect(overlay).toHaveAttribute('data-mode', 'fallback');
-  // Keep still: the cat appears, gets curious after 1 s and walks over at 110 px/s.
-  await page.mouse.move(400, 400);
-  const cat = page.getByTestId('fight-cat');
-  await expect(cat).toBeVisible();
-  const typeId = await cat.getAttribute('data-cat-type');
-  await expect(cat).toHaveAttribute('data-doing', 'held', { timeout: 20_000 });
-  await expect(overlay.getByTestId('fight-tamed-now')).toHaveText('Tamed this game: 1', {
-    timeout: 5_000,
+  const area = page.getByTestId('fight-area');
+  await expect(area).toHaveAttribute('data-mode', 'fallback');
+  // Empty-handed, and unarmed.
+  await expect(page.getByTestId('fight-carrying')).toHaveText('Carrying: nothing');
+  await expect(page.getByTestId('fight-player')).toBeAttached();
+  await expect(page.getByTestId('fight-treat').first()).toBeAttached({ timeout: 5000 });
+  // No movement pad with a keyboard and mouse.
+  await expect(page.getByTestId('movement-pad')).toHaveCount(0);
+
+  // WASD, held and let go as the ranger needs.
+  const held = new Set<string>();
+  const hold = async (key: string, on: boolean) => {
+    if (on && !held.has(key)) {
+      held.add(key);
+      await page.keyboard.down(key);
+    } else if (!on && held.has(key)) {
+      held.delete(key);
+      await page.keyboard.up(key);
+    }
+  };
+  await fetchTreatAndTame(page, async ({ x, y }) => {
+    await hold('d', x > 0);
+    await hold('a', x < 0);
+    await hold('s', y > 0);
+    await hold('w', y < 0);
   });
 
-  await page.keyboard.press('Escape');
+  await expect(page.getByRole('status').filter({ hasText: 'You tamed' })).toBeVisible();
+  await area.getByRole('button', { name: 'End game' }).click();
   await expect(page.getByRole('status').filter({ hasText: 'Taming over' })).toHaveText(
     'Taming over. You tamed 1 cat.'
   );
+  // Into the collection, kept after a reload.
   await expect(page.getByTestId('fight-tamed')).toHaveText('Tamed: 1 cat');
   const stored = await page.evaluate((key) => localStorage.getItem(key), TAMED_KEY);
-  expect(JSON.parse(stored!)).toEqual({ [typeId!]: 1 });
+  expect(Object.values(JSON.parse(stored!) as Record<string, number>)).toEqual([1]);
 });
 
-test('Taming: a pointer moving at the cat makes it dodge', async ({ page }) => {
+test('Taming: without a treat the cat keeps away from the ranger', async ({ page }) => {
   test.setTimeout(60_000);
   await openFight(page, undefined, { game: 'taming' });
   await page.getByTestId('fight-start-taming').click();
-  await page.mouse.move(100, 100);
   const cat = page.getByTestId('fight-cat');
-  await expect(cat).toBeVisible();
-  // A quick dodge (a teleport takes 60 ms) shows in data-doing for a frame or two,
-  // too briefly for polling: record every value the page ever sets instead.
-  await page.evaluate(() => {
-    const seen = new Set<string>();
-    (window as unknown as { doings: Set<string> }).doings = seen;
-    new MutationObserver(() => {
-      const doing = document.querySelector('[data-testid="fight-cat"]')?.getAttribute('data-doing');
-      if (doing) seen.add(doing);
-    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-doing'] });
-  });
-  const dodges = ['dash', 'blink', 'sidestep', 'hop', 'circle', 'mirror', 'drop', 'axis'];
-  let step = 0;
-  await expect
-    .poll(
-      async () => {
-        const box = await cat.boundingBox();
-        if (box) {
-          // Wiggle towards the cat, inside its notice radius.
-          const x = box.x + box.width / 2 - 60 + (step++ % 2) * 20;
-          await page.mouse.move(x, box.y + box.height / 2);
-        }
-        const seen = await page.evaluate(() =>
-          Array.from((window as unknown as { doings: Set<string> }).doings)
-        );
-        return seen.some((doing) => dodges.includes(doing));
-      },
-      { timeout: 15_000, intervals: [50] }
-    )
-    .toBe(true);
+  await expect(cat).toBeVisible({ timeout: 5000 });
+  // Walk straight at it, empty-handed: it never lets the ranger reach it.
+  const held = new Set<string>();
+  const doings = new Set<string>();
+  for (let i = 0; i < 60; i++) {
+    const ranger = (await tamingState(page)).ranger;
+    const box = await cat.boundingBox();
+    if (!ranger || !box) continue;
+    const c = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
+    doings.add((await cat.getAttribute('data-doing')) ?? '');
+    for (const [key, on] of [
+      ['d', c.x > ranger.x + 12],
+      ['a', c.x < ranger.x - 12],
+      ['s', c.y > ranger.y + 12],
+      ['w', c.y < ranger.y - 12],
+    ] as const) {
+      if (on && !held.has(key)) {
+        held.add(key);
+        await page.keyboard.down(key);
+      } else if (!on && held.has(key)) {
+        held.delete(key);
+        await page.keyboard.up(key);
+      }
+    }
+    await page.waitForTimeout(100);
+  }
+  for (const key of held) await page.keyboard.up(key);
+  // It dodged (in its own way) at least once, and nothing was tamed.
+  expect([...doings].some((d) => d !== '' && d !== 'wandering' && d !== 'coming')).toBe(true);
+  expect(doings.has('coming')).toBe(false);
+  await expect(page.getByTestId('fight-tamed-now')).toHaveText('Tamed this game: 0');
 });
 
 test('Survival: a lower score leaves the best score alone; End game stops it too', async ({
@@ -463,14 +537,52 @@ test.describe('on a touch screen', () => {
   const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 7'];
   test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });
 
-  for (const game of ['survival', 'taming'] as const) {
-    test(`/cats/${game} says the game needs a keyboard and mouse`, async ({ page }) => {
-      await page.goto(`/cats/${game}`);
-      await expect(page.getByTestId('fight-needs-keyboard')).toHaveText(
-        'This game needs a keyboard and mouse, for now. Come back on a computer to play it.'
-      );
-      await expect(page.getByTestId('fight-start')).toHaveCount(0);
-      await expect(page.getByTestId('fight-start-taming')).toHaveCount(0);
+  test('/cats/survival says the game needs a keyboard and mouse', async ({ page }) => {
+    await page.goto('/cats/survival');
+    await expect(page.getByTestId('fight-needs-keyboard')).toHaveText(
+      'This game needs a keyboard and mouse, for now. Come back on a computer to play it.'
+    );
+    await expect(page.getByTestId('fight-start')).toHaveCount(0);
+  });
+
+  test('/cats/taming is played with the movement pad: a treat carried to the cat tames it', async ({
+    page,
+  }) => {
+    test.setTimeout(90_000);
+    await page.goto('/cats/taming');
+    await expect(page.getByTestId('fight-needs-keyboard')).toHaveCount(0);
+    // A tap before hydration is lost: tap until the game starts.
+    const area = page.getByTestId('fight-area');
+    await expect
+      .poll(async () => {
+        if ((await area.count()) === 0) await page.getByTestId('fight-start-taming').tap();
+        return area.count();
+      })
+      .toBe(1);
+    // Never locked on a touch screen.
+    await expect(area).toHaveAttribute('data-mode', 'fallback');
+    const pad = page.getByTestId('movement-pad');
+    await expect(pad).toBeVisible();
+    await expect(pad).toHaveAttribute('aria-hidden', 'true');
+    const box = (await pad.boundingBox())!;
+    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
+    // Real touches on the pad: a thumb put down, slid, and lifted.
+    const cdp = await page.context().newCDPSession(page);
+    let down = false;
+    await fetchTreatAndTame(page, async ({ x, y }) => {
+      if (x === 0 && y === 0) {
+        if (down) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
+        down = false;
+        return;
+      }
+      const point = { x: centre.x + x * 50, y: centre.y + y * 50 };
+      await cdp.send('Input.dispatchTouchEvent', {
+        type: down ? 'touchMove' : 'touchStart',
+        touchPoints: [point],
+      });
+      down = true;
     });
-  }
+    await area.getByRole('button', { name: 'End game' }).tap();
+    await expect(page.getByTestId('fight-tamed')).toHaveText('Tamed: 1 cat');
+  });
 });
diff --git a/tests/unit/xenocats/taming.test.ts b/tests/unit/xenocats/taming.test.ts
index 18d9dac..b89635c 100644
--- a/tests/unit/xenocats/taming.test.ts
+++ b/tests/unit/xenocats/taming.test.ts
@@ -1,9 +1,11 @@
 import { describe, expect, it } from 'vitest';
 import { CAT_TYPES, catTypeById } from '@/app/ui/xenocats/cat-types';
+import { PAD_SIZE, padDirection } from '@/app/ui/xenocats/movement-pad';
 import { createRandom } from '@/app/ui/xenocats/random';
 import {
   DODGES,
   TAMING_CONFIG,
+  TREATS,
   addTamed,
   createTaming,
   dodgeFor,
@@ -81,124 +83,215 @@ describe('dodging', () => {
 
   it('a pointer moving close makes the cat dodge away', () => {
     const g = gameWith('pulsar-siamese'); // knockback: dashes 320 px
-    const cat = g.snapshot(TAMING_CONFIG.breakMs).cat!;
-    const near = { x: cat.x - 60, y: cat.y };
+    const cat = g.snapshot().cat!;
+    // On the cat's side nearer the edge: it runs off into open screen, not a wall.
+    const near = { x: cat.x + 60 * Math.sign(cat.x - 600 || 1), y: cat.y };
     let now = TAMING_CONFIG.breakMs + 16;
     g.tick(now, near);
     for (now += 16; now < TAMING_CONFIG.breakMs + 600; now += 16) g.tick(now, near);
-    const after = g.snapshot(now).cat!;
+    const after = g.snapshot().cat!;
     expect(distance(after, near)).toBeGreaterThan(distance(cat, near) + 100);
   });
 
   it('the lagging cat notices late', () => {
     const g = gameWith('lag-ragamuffin'); // delay: reacts after 800 ms
-    const cat = g.snapshot(TAMING_CONFIG.breakMs).cat!;
-    const near = { x: cat.x - 60, y: cat.y };
+    const cat = g.snapshot().cat!;
+    // On the cat's side nearer the edge: it runs off into open screen, not a wall.
+    const near = { x: cat.x + 60 * Math.sign(cat.x - 600 || 1), y: cat.y };
     let now = TAMING_CONFIG.breakMs + 16;
     g.tick(now, near);
     for (now += 16; now < TAMING_CONFIG.breakMs + 700; now += 16) g.tick(now, near);
-    expect(g.snapshot(now).cat).toMatchObject({ x: cat.x, y: cat.y });
+    expect(g.snapshot().cat).toMatchObject({ x: cat.x, y: cat.y });
     for (; now < TAMING_CONFIG.breakMs + 1600; now += 16) g.tick(now, near);
-    expect(distance(g.snapshot(now).cat!, cat)).toBeGreaterThan(50);
+    expect(distance(g.snapshot().cat!, cat)).toBeGreaterThan(50);
   });
 });
 
-describe('taming: hold still on the cat for 2 s', () => {
-  /** Keeps the pointer still at `at` from `from` to `to`; returns any cat tamed. */
-  function hold(
-    g: ReturnType<typeof gameWith>,
-    at: { x: number; y: number },
-    from: number,
-    to: number
-  ) {
-    let tamed: string | null = null;
-    for (let now = from; now <= to; now += 16) tamed = g.tick(now, at) ?? tamed;
-    return tamed;
+/** A game with one cat type, its treats and cat on their own clock; the ranger far off. */
+function treatGame(config: Partial<typeof TAMING_CONFIG> = {}, typeId = 'void-tabby', seed = 1) {
+  return createTaming({
+    random: createRandom(seed),
+    types: [catTypeById(typeId)!],
+    viewport,
+    now: 0,
+    config,
+  });
+}
+
+/** Runs from `from` to `to` (16 ms frames), the ranger where `at` says; returns every event. */
+function run(
+  g: ReturnType<typeof treatGame>,
+  from: number,
+  to: number,
+  at: (now: number) => { x: number; y: number }
+) {
+  const events = { tamed: [] as string[], attacks: [] as number[], picked: [] as string[] };
+  for (let now = from; now <= to; now += 16) {
+    const e = g.tick(now, at(now));
+    if (e.tamed) events.tamed.push(e.tamed);
+    if (e.attack) events.attacks.push(now);
+    if (e.picked) events.picked.push(e.picked);
   }
+  return events;
+}
 
-  it('a still pointer draws the cat over, and two seconds on it tames the cat', () => {
-    const pointer = { x: 100, y: 100 };
-    const g = gameWith('void-tabby', pointer);
-    const start = TAMING_CONFIG.breakMs;
-    // Curious after 1 s, then it walks over (at most ~1300 px at 110 px/s), then 2 s.
-    const tamed = hold(g, pointer, start + 16, start + 20_000);
-    expect(tamed).toBe('void-tabby');
-    const snap = g.snapshot(start + 20_000);
-    expect(snap.tamed).toContain('void-tabby');
-  });
-
-  it('is tamed two seconds after the hold begins, not before', () => {
-    // Wait for the cat to come to a still pointer, and time the hold from there.
-    const pointer = { x: 100, y: 100 };
-    const g = gameWith('void-tabby', pointer);
-    const start = TAMING_CONFIG.breakMs;
-    let now = start + 16;
-    for (; now < start + 20_000; now += 16) {
-      g.tick(now, pointer);
-      if (g.snapshot(now).cat?.doing === 'held') break;
-    }
-    expect(g.snapshot(now).cat?.doing).toBe('held');
-    const heldAt = now;
-    let tamedAt: number | null = null;
-    for (now += 16; now < heldAt + 3000; now += 16) {
-      if (g.tick(now, pointer)) {
-        tamedAt = now;
-        break;
-      }
+const corner = { x: 5, y: 5 };
+
+describe('treats', () => {
+  it('turn up at random spots, a few at a time, as often as the config says', () => {
+    const g = treatGame({ treatEveryMs: 1000, maxTreats: 3, treatLifeMs: 60_000 });
+    run(g, 0, 500, () => corner);
+    expect(g.snapshot().treats).toHaveLength(1);
+    run(g, 516, 2100, () => corner);
+    expect(g.snapshot().treats).toHaveLength(3);
+    // Never more than the most at once.
+    run(g, 2116, 10_000, () => corner);
+    const { treats } = g.snapshot();
+    expect(treats).toHaveLength(3);
+    expect(new Set(treats.map((t) => `${t.x},${t.y}`)).size).toBe(3);
+    for (const treat of treats) {
+      expect(TREATS.map((t) => t.kind)).toContain(treat.kind);
+      expect(treat.x).toBeGreaterThan(0);
+      expect(treat.x).toBeLessThan(viewport.width);
     }
-    expect(tamedAt).not.toBeNull();
-    expect(tamedAt! - heldAt).toBeGreaterThanOrEqual(TAMING_CONFIG.tameMs);
-    expect(tamedAt! - heldAt).toBeLessThan(TAMING_CONFIG.tameMs + 50);
   });
 
-  it('moving during the hold starts it over (and the cat dodges)', () => {
-    const pointer = { x: 100, y: 100 };
-    const g = gameWith('void-tabby', pointer);
-    let now = TAMING_CONFIG.breakMs + 16;
-    for (; now < 30_000; now += 16) {
-      g.tick(now, pointer);
-      if (g.snapshot(now).cat?.doing === 'held') break;
-    }
-    for (const end = now + 1500; now < end; now += 16) g.tick(now, pointer);
-    expect(g.snapshot(now).hold).toBeGreaterThan(0.6);
-    // A twitch of 10 px: no longer still.
-    expect(g.tick(now + 16, { x: 110, y: 100 })).toBeNull();
-    expect(g.snapshot(now + 16).hold).toBe(0);
-    expect(g.snapshot(now + 16).tamed).toEqual([]);
-  });
-
-  it('a pointer resting next to the cat, not on it, does not tame it', () => {
-    const start = TAMING_CONFIG.breakMs;
-    // A cat that never walks, so the pointer stays just off it.
-    const shy = createTaming({
-      random: createRandom(1),
-      types: [catTypeById('void-tabby')!],
-      viewport,
-      now: 0,
-      config: { curiousAfterMs: Infinity, walkSpeed: 0 },
-    });
-    shy.tick(0, { x: 0, y: 0 });
-    shy.tick(start, { x: 0, y: 0 });
-    const shyCat = shy.snapshot(start).cat!;
-    const beside = { x: shyCat.x + TAMING_CONFIG.catchRadius + 5, y: shyCat.y };
-    // The pointer lands just off the cat (which dodges), then keeps still; with no
-    // walking, the cat never comes back under it.
-    let tamed: string | null = null;
-    for (let now = start + 16; now < start + 5000; now += 16) {
-      tamed = shy.tick(now, beside) ?? tamed;
+  it('vanish when nobody picks them up', () => {
+    const g = treatGame({ treatEveryMs: 100_000, treatLifeMs: 2000 });
+    run(g, 0, 1984, () => corner);
+    expect(g.snapshot().treats).toHaveLength(1);
+    run(g, 2000, 2016, () => corner);
+    expect(g.snapshot().treats).toHaveLength(0);
+  });
+
+  it('walking over one picks it up; one at a time', () => {
+    const g = treatGame({ treatEveryMs: 100, maxTreats: 2, treatLifeMs: 60_000 });
+    run(g, 0, 200, () => corner);
+    const [first, second] = g.snapshot().treats;
+    expect(second).toBeDefined();
+    const e = g.tick(216, first);
+    expect(e.picked).toBe(first.kind);
+    expect(g.snapshot().carrying).toBe(first.kind);
+    expect(g.snapshot().treats.map((t) => t.id)).not.toContain(first.id);
+    // Already carrying one: walking over another leaves it where it is.
+    expect(g.tick(232, second).picked).toBeNull();
+    expect(g.snapshot().carrying).toBe(first.kind);
+    expect(g.snapshot().treats.map((t) => t.id)).toContain(second.id);
+  });
+});
+
+describe('the cat, without a treat', () => {
+  it('attacks the ranger from a distance, as often as the config says, and not from afar', () => {
+    const g = treatGame({ treatEveryMs: 1e9, walkSpeed: 0, attackEveryMs: 1000 });
+    run(g, 0, TAMING_CONFIG.breakMs, () => corner);
+    const cat = g.snapshot().cat!;
+    // Inside the attack range but outside the flee radius: it stays and attacks.
+    const near = { x: cat.x + 250 * Math.sign(600 - cat.x || 1), y: cat.y };
+    const events = run(g, TAMING_CONFIG.breakMs + 16, TAMING_CONFIG.breakMs + 4000, () => near);
+    expect(events.attacks.length).toBeGreaterThanOrEqual(3);
+    for (let i = 1; i < events.attacks.length; i++) {
+      expect(events.attacks[i] - events.attacks[i - 1]).toBeGreaterThanOrEqual(1000);
     }
-    expect(tamed).toBeNull();
-    expect(shy.snapshot(start + 5000).hold).toBe(0);
+    // Far off: no attacks.
+    const far = run(g, TAMING_CONFIG.breakMs + 4016, TAMING_CONFIG.breakMs + 8000, () => ({
+      x: cat.x > 600 ? 0 : viewport.width,
+      y: cat.y > 400 ? 0 : viewport.height,
+    }));
+    expect(far.attacks).toEqual([]);
+  });
+
+  it('flees a ranger who comes close', () => {
+    const g = treatGame({ treatEveryMs: 1e9 }, 'pulsar-siamese'); // knockback: dashes 320 px
+    run(g, 0, TAMING_CONFIG.breakMs, () => corner);
+    const cat = g.snapshot().cat!;
+    // On the cat's side nearer the edge: it runs off into open screen, not a wall.
+    const near = { x: cat.x + 60 * Math.sign(cat.x - 600 || 1), y: cat.y };
+    run(g, TAMING_CONFIG.breakMs + 16, TAMING_CONFIG.breakMs + 600, () => near);
+    expect(distance(g.snapshot().cat!, near)).toBeGreaterThan(distance(cat, near) + 100);
+    expect(g.snapshot().tamed).toEqual([]);
+  });
+
+  it('is never tamed by touching it empty-handed', () => {
+    const g = treatGame({ treatEveryMs: 1e9 });
+    run(g, 0, TAMING_CONFIG.breakMs, () => corner);
+    const events = run(g, TAMING_CONFIG.breakMs + 16, 20_000, () => g.snapshot().cat ?? corner);
+    expect(events.tamed).toEqual([]);
   });
+});
 
-  it('after a cat is tamed, the next one comes', () => {
-    const pointer = { x: 100, y: 100 };
-    const g = gameWith('void-tabby', pointer);
+describe('the cat, with a treat in hand', () => {
+  /** A game whose ranger has picked up a treat, the cat on screen, at time `now`. */
+  function carrying(typeId = 'void-tabby') {
+    const g = treatGame({ treatEveryMs: 100, maxTreats: 1, treatLifeMs: 60_000 }, typeId);
+    run(g, 0, TAMING_CONFIG.breakMs, () => corner);
+    const treat = g.snapshot().treats[0];
+    const now = TAMING_CONFIG.breakMs + 16;
+    expect(g.tick(now, treat).picked).toBe(treat.kind);
+    return { g, now, at: { x: treat.x, y: treat.y } };
+  }
+
+  it('stops attacking and fleeing, and comes to the ranger', () => {
+    const { g, now, at } = carrying();
+    const before = distance(g.snapshot().cat!, at);
+    const events = run(g, now + 16, now + 400, () => at);
+    expect(events.attacks).toEqual([]);
+    // Still on its way (not tamed yet), and nearer.
+    const cat = g.snapshot().cat;
+    expect(cat).not.toBeNull();
+    expect(cat!.doing).toBe('coming');
+    expect(distance(cat!, at)).toBeLessThan(before);
+  });
+
+  it('is tamed when they touch; the treat is used up, and the next cat comes', () => {
+    const { g, now, at } = carrying();
+    const events = run(g, now + 16, now + 15_000, () => at);
+    expect(events.tamed).toEqual(['void-tabby']);
+    expect(events.attacks).toEqual([]);
+    expect(g.snapshot().tamed).toEqual(['void-tabby']);
+    expect(g.snapshot().carrying).toBeNull();
+    // A new cat, which keeps away again: no treat in hand.
+    run(g, now + 15_016, now + 15_000 + TAMING_CONFIG.breakMs + 32, () => corner);
+    expect(g.snapshot().cat).not.toBeNull();
+    expect(g.snapshot().cat!.doing).not.toBe('coming');
+  });
+
+  it('even a cat mid-dodge comes once its dodge ends', () => {
+    const g = treatGame({ treatEveryMs: 100, maxTreats: 1, treatLifeMs: 60_000 }, 'gravi-coon');
+    run(g, 0, TAMING_CONFIG.breakMs, () => corner);
+    const cat = g.snapshot().cat!;
+    // Startle it, then fetch the treat while it lumbers off.
     let now = TAMING_CONFIG.breakMs + 16;
-    for (; now < 30_000; now += 16) if (g.tick(now, pointer)) break;
-    expect(g.snapshot(now).cat).toBeNull();
-    for (const end = now + TAMING_CONFIG.breakMs + 32; now < end; now += 16) g.tick(now, pointer);
-    expect(g.snapshot(now).cat).not.toBeNull();
+    g.tick(now, { x: cat.x - 40, y: cat.y });
+    const treat = g.snapshot().treats[0];
+    now += 16;
+    expect(g.tick(now, treat).picked).toBe(treat.kind);
+    const events = run(g, now + 16, now + 15_000, () => treat);
+    expect(events.tamed).toEqual(['gravi-coon']);
+  });
+});
+
+describe('taming on a touch screen', () => {
+  it('a ranger walked with the movement pad carries a treat to the cat and tames it', () => {
+    const g = treatGame({ treatEveryMs: 100, maxTreats: 1, treatLifeMs: 60_000 });
+    const pad = { x: 100, y: 700 };
+    let ranger = { x: 600, y: 400 };
+    let tamed: string | null = null;
+    for (let now = 0; now < 30_000 && !tamed; now += 16) {
+      const { treats, carrying } = g.snapshot();
+      // The thumb pushes the pad towards the treat; with one in hand it lets go.
+      const target = carrying ? null : (treats[0] ?? null);
+      const thumb = target
+        ? {
+            x: pad.x + Math.sign(Math.round(target.x - ranger.x)) * 50,
+            y: pad.y + Math.sign(Math.round(target.y - ranger.y)) * 50,
+          }
+        : null;
+      const way = padDirection(thumb, pad, PAD_SIZE / 2);
+      const step = (TAMING_CONFIG.rangerSpeed * 16) / 1000;
+      ranger = { x: ranger.x + way.x * step, y: ranger.y + way.y * step };
+      tamed = g.tick(now, ranger).tamed;
+    }
+    expect(tamed).toBe('void-tabby');
   });
 });
 
@@ -206,9 +299,9 @@ describe('never more than five cats', () => {
   it('no cat comes while the screen is full of other cats', () => {
     const g = createTaming({ random: createRandom(1), types: CAT_TYPES, viewport, now: 0 });
     for (let now = 0; now < 10_000; now += 16) g.tick(now, { x: 100, y: 100 }, 0);
-    expect(g.snapshot(10_000).cat).toBeNull();
+    expect(g.snapshot().cat).toBeNull();
     g.tick(10_016, { x: 100, y: 100 }, 1);
-    expect(g.snapshot(10_016).cat).not.toBeNull();
+    expect(g.snapshot().cat).not.toBeNull();
   });
 });
 
~~~~

</details>

#### Checkpoint 1 — `night-2026-10-07-c1-checkpoint`

Checkpoint 1: tests added (the pad view, Taming's attack), a restructured flaky test, stale comments and README routes. Why: the plan's checkpoint (D23–D24).

<details><summary>Code: 8 files changed, 150 insertions(+), 37 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 33cec4f..c3003aa 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -44,6 +44,7 @@ jobs:
         run: >-
           npx vitest run tests/unit/xenocats/cursor-kind tests/unit/xenocats/fake-cursor
           tests/unit/xenocats/cat-layer tests/unit/xenocats/cat-art tests/unit/xenocats/cat-sprite
+          tests/unit/xenocats/movement-pad-view
       - name: Unit tests (cats, games, page, sound)
         if: ${{ !cancelled() }}
         run: >-
diff --git a/README.md b/README.md
index eec3b76..1e34cf0 100644
--- a/README.md
+++ b/README.md
@@ -7,6 +7,8 @@ cursor. Built with the Next.js App Router, PostgreSQL and Tailwind CSS.
 - `/login`: sign in
 - `/dashboard`: overview, invoices and customers (needs a session)
 - `/cats`: every cat, with a button to summon it
+- `/cats/survival`: Survival, a game against the cats (keyboard and mouse)
+- `/cats/taming`: Taming, carrying treats to the cats (also on touch screens)
 
 ## Development
 
diff --git a/app/ui/global.css b/app/ui/global.css
index 250dd04..2847bc0 100644
--- a/app/ui/global.css
+++ b/app/ui/global.css
@@ -1228,8 +1228,8 @@ input[type='number']::-webkit-outer-spin-button {
   }
 }
 
-/* While cats fling page elements about (puppets.ts), the page clips what flies
-   off it rather than growing to hold it. The html element keeps the scrolling (an
+/* While cats move page elements about (puppets.ts), the page clips whatever
+   overflows it (an element grown past the edge) rather than growing to hold it. The html element keeps the scrolling (an
    overflow of its own stops body's from passing to the viewport), and the body
    clips at the page's edges. */
 html[data-xenocat-puppets] {
diff --git a/app/ui/xenocats/fight-page.tsx b/app/ui/xenocats/fight-page.tsx
index 8fd79f1..265e61e 100644
--- a/app/ui/xenocats/fight-page.tsx
+++ b/app/ui/xenocats/fight-page.tsx
@@ -30,9 +30,7 @@ export default function FightPage({ kind }: { kind: Kind }) {
   if (!fine && kind === 'survival') {
     return (
       <div>
-        <h1 className="font-display text-4xl font-semibold text-cream md:text-[52px]">
-          {kind === 'survival' ? 'Survival' : 'Taming'}
-        </h1>
+        <h1 className="font-display text-4xl font-semibold text-cream md:text-[52px]">Survival</h1>
         <p data-testid="fight-needs-keyboard" className="mt-4 max-w-2xl text-lg text-white">
           This game needs a keyboard and mouse, for now. Come back on a computer to play it.
         </p>
diff --git a/app/ui/xenocats/fight.tsx b/app/ui/xenocats/fight.tsx
index f4fe18f..e6b67ac 100644
--- a/app/ui/xenocats/fight.tsx
+++ b/app/ui/xenocats/fight.tsx
@@ -197,7 +197,7 @@ export default function Fight({
   // False once the section has gone: a lock request still pending then gives up.
   const mountedRef = useRef(true);
   // Cats move every frame, so the loop moves their elements itself; React renders
-  // only when what it shows changes (a cat comes or goes, a life, a wave, the hold).
+  // only when what it shows changes (a cat comes or goes, a life, a wave, a treat).
   const shownRef = useRef('');
   // Set from Start until the game begins: asking for the lock can take a second.
   const startingRef = useRef(false);
diff --git a/app/ui/xenocats/puppets.ts b/app/ui/xenocats/puppets.ts
index b3fa158..30b09fd 100644
--- a/app/ui/xenocats/puppets.ts
+++ b/app/ui/xenocats/puppets.ts
@@ -25,7 +25,7 @@ import type { Random } from './random';
 
 export type PuppetLevel = HitLevel['puppets'];
 
-/** Set on <html> while any element is a puppet: the page clips what flies off it. */
+/** Set on <html> while any element is a puppet: the page clips what overflows it (a grown element). */
 export const PUPPETS_ATTRIBUTE = 'data-xenocat-puppets';
 
 /** An element's blur is the cursor's times this: enough to hide it, as smoke would. */
diff --git a/tests/e2e/fight.spec.ts b/tests/e2e/fight.spec.ts
index bc87d65..38ec749 100644
--- a/tests/e2e/fight.spec.ts
+++ b/tests/e2e/fight.spec.ts
@@ -320,42 +320,72 @@ test('Taming: walk to a treat, carry it to the cat, and the cat is tamed into th
   expect(Object.values(JSON.parse(stored!) as Record<string, number>)).toEqual([1]);
 });
 
-test('Taming: without a treat the cat keeps away from the ranger', async ({ page }) => {
-  test.setTimeout(60_000);
+test('Taming: without a treat the cat keeps away from the ranger, and attacks it', async ({
+  page,
+}) => {
+  test.setTimeout(90_000);
   await openFight(page, undefined, { game: 'taming' });
   await page.getByTestId('fight-start-taming').click();
-  const cat = page.getByTestId('fight-cat');
-  await expect(cat).toBeVisible({ timeout: 5000 });
-  // Walk straight at it, empty-handed: it never lets the ranger reach it.
+  await expect(page.getByTestId('fight-cat')).toBeVisible({ timeout: 5000 });
+  // Read at one instant: the ranger, the cat and what it is doing, the effect on the
+  // ranger, and whether a treat is in hand.
+  const look = () =>
+    page.evaluate(() => {
+      const ranger = document.querySelector<HTMLElement>('[data-testid="fight-player"]');
+      const cat = document.querySelector<HTMLElement>('[data-testid="fight-cat"]');
+      const box = cat?.getBoundingClientRect();
+      return {
+        ranger: ranger?.dataset.x
+          ? { x: Number(ranger.dataset.x), y: Number(ranger.dataset.y) }
+          : null,
+        cat: box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null,
+        doing: cat?.dataset.doing ?? '',
+        effect: ranger?.dataset.effect ?? '',
+        carrying:
+          document.querySelector<HTMLElement>('[data-testid="fight-carrying"]')?.dataset.carrying ??
+          '',
+      };
+    });
   const held = new Set<string>();
-  const doings = new Set<string>();
-  for (let i = 0; i < 60; i++) {
-    const ranger = (await tamingState(page)).ranger;
-    const box = await cat.boundingBox();
-    if (!ranger || !box) continue;
-    const c = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
-    doings.add((await cat.getAttribute('data-doing')) ?? '');
-    for (const [key, on] of [
-      ['d', c.x > ranger.x + 12],
-      ['a', c.x < ranger.x - 12],
-      ['s', c.y > ranger.y + 12],
-      ['w', c.y < ranger.y - 12],
-    ] as const) {
-      if (on && !held.has(key)) {
-        held.add(key);
-        await page.keyboard.down(key);
-      } else if (!on && held.has(key)) {
-        held.delete(key);
-        await page.keyboard.up(key);
-      }
+  const hold = async (key: string, on: boolean) => {
+    if (on && !held.has(key)) {
+      held.add(key);
+      await page.keyboard.down(key);
+    } else if (!on && held.has(key)) {
+      held.delete(key);
+      await page.keyboard.up(key);
+    }
+  };
+  // Walk straight at the cat, empty-handed, until it has dodged and attacked. A treat
+  // picked up on the way changes the game (the cat comes for it): start a new one.
+  let dodged = false;
+  let attacked = false;
+  for (let i = 0; i < 300 && !(dodged && attacked); i++) {
+    const state = await look();
+    if (state.carrying) {
+      for (const key of [...held]) await hold(key, false);
+      await page.getByTestId('fight-area').getByRole('button', { name: 'End game' }).click();
+      await page.getByTestId('fight-start-taming').click();
+      await expect(page.getByTestId('fight-carrying')).toHaveText('Carrying: nothing');
+      continue;
+    }
+    // Empty-handed, it never comes to the ranger.
+    expect(state.doing).not.toBe('coming');
+    if (!['', 'wandering', 'coming'].includes(state.doing)) dodged = true;
+    if (state.effect !== '') attacked = true;
+    if (state.ranger && state.cat) {
+      const { ranger, cat } = state;
+      await hold('d', cat.x > ranger.x + 12);
+      await hold('a', cat.x < ranger.x - 12);
+      await hold('s', cat.y > ranger.y + 12);
+      await hold('w', cat.y < ranger.y - 12);
     }
     await page.waitForTimeout(100);
   }
-  for (const key of held) await page.keyboard.up(key);
-  // It dodged (in its own way) at least once, and nothing was tamed.
-  expect([...doings].some((d) => d !== '' && d !== 'wandering' && d !== 'coming')).toBe(true);
-  expect(doings.has('coming')).toBe(false);
-  await expect(page.getByTestId('fight-tamed-now')).toHaveText('Tamed this game: 0');
+  for (const key of [...held]) await hold(key, false);
+  // It dodged, in its own way, and its attack landed on the ranger as in Survival.
+  expect(dodged).toBe(true);
+  expect(attacked).toBe(true);
 });
 
 test('Survival: a lower score leaves the best score alone; End game stops it too', async ({
diff --git a/tests/unit/xenocats/movement-pad-view.test.tsx b/tests/unit/xenocats/movement-pad-view.test.tsx
new file mode 100644
index 0000000..d036745
--- /dev/null
+++ b/tests/unit/xenocats/movement-pad-view.test.tsx
@@ -0,0 +1,82 @@
+// @vitest-environment jsdom
+import { cleanup, fireEvent, render, screen } from '@testing-library/react';
+import { afterEach, describe, expect, it, vi } from 'vitest';
+import { PAD_SIZE } from '@/app/ui/xenocats/movement-pad';
+import { MovementPad } from '@/app/ui/xenocats/movement-pad-view';
+
+afterEach(cleanup);
+
+/** Renders the pad with a fixed box (jsdom has no layout): its centre at (100, 100). */
+function renderPad() {
+  const onDirection = vi.fn();
+  render(<MovementPad onDirection={onDirection} />);
+  const pad = screen.getByTestId('movement-pad');
+  pad.getBoundingClientRect = () =>
+    ({
+      left: 100 - PAD_SIZE / 2,
+      top: 100 - PAD_SIZE / 2,
+      right: 100 + PAD_SIZE / 2,
+      bottom: 100 + PAD_SIZE / 2,
+      width: PAD_SIZE,
+      height: PAD_SIZE,
+    }) as DOMRect;
+  // jsdom has no pointer capture.
+  pad.setPointerCapture = vi.fn();
+  return { pad, onDirection };
+}
+
+const touch = (x: number, y: number) => ({ pointerId: 1, clientX: x, clientY: y });
+
+describe('the movement pad', () => {
+  it('is hidden from assistive technology, and takes no part in scrolling or zooming', () => {
+    const { pad } = renderPad();
+    expect(pad.getAttribute('aria-hidden')).toBe('true');
+    expect(pad.className).toContain('touch-none');
+  });
+
+  it('reports the way a held thumb points, each change once, and zero when let go', () => {
+    const { pad, onDirection } = renderPad();
+    fireEvent.pointerDown(pad, touch(150, 100));
+    expect(onDirection).toHaveBeenLastCalledWith({ x: 1, y: 0 });
+    expect(pad.dataset.held).toBe('true');
+    // Still east: nothing new to report.
+    fireEvent.pointerMove(pad, touch(160, 102));
+    expect(onDirection).toHaveBeenCalledTimes(1);
+    fireEvent.pointerMove(pad, touch(100, 160));
+    expect(onDirection).toHaveBeenLastCalledWith({ x: 0, y: 1 });
+    fireEvent.pointerUp(pad, touch(100, 160));
+    expect(onDirection).toHaveBeenLastCalledWith({ x: 0, y: 0 });
+    expect(pad.dataset.held).toBe('false');
+  });
+
+  it('ignores a second finger while one holds it, and stops on a cancelled touch', () => {
+    const { pad, onDirection } = renderPad();
+    fireEvent.pointerDown(pad, touch(150, 100));
+    fireEvent.pointerDown(pad, { ...touch(50, 100), pointerId: 2 });
+    fireEvent.pointerMove(pad, { ...touch(50, 100), pointerId: 2 });
+    expect(onDirection).toHaveBeenLastCalledWith({ x: 1, y: 0 });
+    fireEvent.pointerCancel(pad, touch(150, 100));
+    expect(onDirection).toHaveBeenLastCalledWith({ x: 0, y: 0 });
+  });
+
+  it('stops the page scrolling or zooming while held, and only then', () => {
+    const { pad } = renderPad();
+    const swipe = () => {
+      const event = new Event('touchmove', { bubbles: true, cancelable: true });
+      document.body.dispatchEvent(event);
+      return event.defaultPrevented;
+    };
+    expect(swipe()).toBe(false);
+    fireEvent.pointerDown(pad, touch(150, 100));
+    expect(swipe()).toBe(true);
+    fireEvent.pointerUp(pad, touch(150, 100));
+    expect(swipe()).toBe(false);
+  });
+
+  it('stops the character if it is taken off the page while held', () => {
+    const { pad, onDirection } = renderPad();
+    fireEvent.pointerDown(pad, touch(150, 100));
+    cleanup();
+    expect(onDirection).toHaveBeenLastCalledWith({ x: 0, y: 0 });
+  });
+});
~~~~

</details>

#### T6 — `night-2026-10-07-t6-survival-arena`

Survival replaced by the arena: a pure seeded simulation (`arena.ts`), the grid, the frame guard, best-time storage, the canvas view; the old wave game and gun removed. Why: plan task 6 (D25–D34).

<details><summary>Code: 24 files changed, 2071 insertions(+), 1910 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index c3003aa..32af821 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -48,10 +48,10 @@ jobs:
       - name: Unit tests (cats, games, page, sound)
         if: ${{ !cancelled() }}
         run: >-
-          npx vitest run tests/unit/xenocats/survival tests/unit/xenocats/locked-pointer
+          npx vitest run tests/unit/xenocats/arena tests/unit/xenocats/walking tests/unit/xenocats/locked-pointer
           tests/unit/xenocats/taming tests/unit/xenocats/page-hits tests/unit/xenocats/sounds
           tests/unit/xenocats/field-guide tests/unit/xenocats/pet-cat tests/unit/xenocats/combos
-          tests/unit/xenocats/gun tests/unit/xenocats/puppets tests/unit/xenocats/movement-pad
+          tests/unit/xenocats/puppets tests/unit/xenocats/movement-pad
       # A test file in no group would never run: each unit test must be named in a
       # group above, each browser test in a group of both browser jobs below.
       - name: Every test file is in a group
@@ -143,9 +143,9 @@ jobs:
         env:
           E2E_SERVER: start
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/cats
-      - name: Browser tests against next start (fight)
+      - name: Browser tests against next start (fight games)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
-        run: npx playwright test tests/e2e/fight --output test-results/fight
+        run: npx playwright test tests/e2e/fight tests/e2e/survival --output test-results/fight
         env:
           E2E_SERVER: start
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/fight
@@ -234,9 +234,9 @@ jobs:
         run: npx playwright test tests/e2e/cats tests/e2e/cats-link tests/e2e/pet-cat tests/e2e/touch --output test-results/cats
         env:
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/cats
-      - name: Browser tests (fight)
+      - name: Browser tests (fight games)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
-        run: npx playwright test tests/e2e/fight --output test-results/fight
+        run: npx playwright test tests/e2e/fight tests/e2e/survival --output test-results/fight
         env:
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/fight
       - name: Browser tests (sound, field guide)
diff --git a/README.md b/README.md
index 1e34cf0..5ba62f3 100644
--- a/README.md
+++ b/README.md
@@ -7,7 +7,7 @@ cursor. Built with the Next.js App Router, PostgreSQL and Tailwind CSS.
 - `/login`: sign in
 - `/dashboard`: overview, invoices and customers (needs a session)
 - `/cats`: every cat, with a button to summon it
-- `/cats/survival`: Survival, a game against the cats (keyboard and mouse)
+- `/cats/survival`: Survival, five minutes in an endless arena against the horde
 - `/cats/taming`: Taming, carrying treats to the cats (also on touch screens)
 
 ## Development
diff --git a/app/ui/xenocats/arena-art.ts b/app/ui/xenocats/arena-art.ts
new file mode 100644
index 0000000..9903540
--- /dev/null
+++ b/app/ui/xenocats/arena-art.ts
@@ -0,0 +1,22 @@
+// The Survival arena's own artwork, drawn by the run as SVG in the site's palette
+// (tailwind.config.ts): the hero, the Keeper. A placeholder until a Superdesign pass.
+// The cats are the twenty xenocat types' own artwork (cat-art.ts), unchanged.
+
+const VOID = '#070b14';
+const LINE = '#2d2f47';
+const AURA = '#9d86ff';
+const PLASMA = '#c1e838';
+const CREAM = '#e0e0b3';
+
+/** The Keeper: a long dark coat, a pale face under a hood, a laser pointer held out. */
+export const HERO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
+  <ellipse cx="32" cy="58" rx="16" ry="4" fill="${VOID}" opacity="0.6"/>
+  <path d="M20 54 L24 26 Q32 18 40 26 L44 54 Q32 58 20 54 Z" fill="${LINE}" stroke="${AURA}" stroke-width="2"/>
+  <path d="M32 30 L32 54" stroke="${AURA}" stroke-width="1.5" opacity="0.7"/>
+  <path d="M21 26 Q32 6 43 26 Q32 20 21 26 Z" fill="${LINE}" stroke="${AURA}" stroke-width="2"/>
+  <ellipse cx="32" cy="24" rx="7" ry="6" fill="${CREAM}"/>
+  <rect x="27" y="22.5" width="10" height="3" rx="1.5" fill="${VOID}"/>
+  <path d="M41 36 L52 33" stroke="${CREAM}" stroke-width="3.5" stroke-linecap="round"/>
+  <rect x="50" y="30.5" width="9" height="4" rx="1.5" fill="${AURA}"/>
+  <circle cx="59.5" cy="32.5" r="2" fill="${PLASMA}"/>
+</svg>`;
diff --git a/app/ui/xenocats/arena-grid.ts b/app/ui/xenocats/arena-grid.ts
new file mode 100644
index 0000000..be4de50
--- /dev/null
+++ b/app/ui/xenocats/arena-grid.ts
@@ -0,0 +1,53 @@
+// A spatial grid for the Survival arena (arena.ts): the world cut into square
+// cells, each holding the ids of what stands in it, so "who is near this point" asks
+// a few cells instead of every cat. Rebuilt every step; its cell lists are reused,
+// not reallocated. Pure, no DOM.
+
+export type ArenaGrid = ReturnType<typeof createArenaGrid>;
+
+export function createArenaGrid(cellSize: number) {
+  const cells = new Map<number, number[]>();
+  /** The lists in use this step; emptied (not dropped) by `clear`. */
+  const used: number[][] = [];
+  // Cell coordinates packed into one number: room for ±2^20 cells each way.
+  const key = (cx: number, cy: number) => (cx + 1_048_576) * 2_097_152 + (cy + 1_048_576);
+
+  return {
+    cellSize,
+
+    clear() {
+      for (const list of used) list.length = 0;
+      used.length = 0;
+    },
+
+    insert(id: number, x: number, y: number) {
+      const k = key(Math.floor(x / cellSize), Math.floor(y / cellSize));
+      let list = cells.get(k);
+      if (!list) {
+        list = [];
+        cells.set(k, list);
+      }
+      if (list.length === 0) used.push(list);
+      list.push(id);
+    },
+
+    /**
+     * The ids in every cell within `radius` of (x, y), into `out` (emptied first).
+     * A superset of what is truly within `radius`: the caller checks distances.
+     */
+    query(x: number, y: number, radius: number, out: number[]): number[] {
+      out.length = 0;
+      const x0 = Math.floor((x - radius) / cellSize);
+      const x1 = Math.floor((x + radius) / cellSize);
+      const y0 = Math.floor((y - radius) / cellSize);
+      const y1 = Math.floor((y + radius) / cellSize);
+      for (let cx = x0; cx <= x1; cx++) {
+        for (let cy = y0; cy <= y1; cy++) {
+          const list = cells.get(key(cx, cy));
+          if (list) for (const id of list) out.push(id);
+        }
+      }
+      return out;
+    },
+  };
+}
diff --git a/app/ui/xenocats/arena-storage.ts b/app/ui/xenocats/arena-storage.ts
new file mode 100644
index 0000000..adc2e9c
--- /dev/null
+++ b/app/ui/xenocats/arena-storage.ts
@@ -0,0 +1,37 @@
+// What Survival keeps between runs, in localStorage under versioned keys. Anything
+// unreadable or corrupt reads as a fresh start; nothing here ever throws.
+
+/** The longest run survived, ms. Version 2: the arena (the wave game kept waves). */
+export const SURVIVAL_BEST_KEY = 'xenocats:survival:v2:best-ms';
+
+/** A stored best time, or null for none (missing, corrupt, or not a sane time). */
+export function parseBest(raw: string | null): number | null {
+  if (raw === null) return null;
+  const value = Number(raw);
+  return Number.isFinite(value) && value > 0 && value < 24 * 3_600_000 ? Math.round(value) : null;
+}
+
+/** The best time after a run that lasted `ms`. */
+export const bestOf = (previous: number | null, ms: number) => Math.max(previous ?? 0, ms);
+
+export function readBest(): number | null {
+  try {
+    return parseBest(window.localStorage.getItem(SURVIVAL_BEST_KEY));
+  } catch {
+    return null;
+  }
+}
+
+export function writeBest(ms: number) {
+  try {
+    window.localStorage.setItem(SURVIVAL_BEST_KEY, String(Math.round(ms)));
+  } catch {
+    // Storage blocked or full: the best time just isn't kept.
+  }
+}
+
+/** "m:ss" for a time in ms. */
+export function clockText(ms: number): string {
+  const seconds = Math.floor(Math.max(ms, 0) / 1000);
+  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
+}
diff --git a/app/ui/xenocats/arena-view.tsx b/app/ui/xenocats/arena-view.tsx
new file mode 100644
index 0000000..6eead7a
--- /dev/null
+++ b/app/ui/xenocats/arena-view.tsx
@@ -0,0 +1,584 @@
+'use client';
+
+import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
+import { Button } from '@/app/ui/button';
+import { type Arena, ARENA_CONFIG, type ArenaOutcome, createArena } from './arena';
+import { HERO_SVG } from './arena-art';
+import { SURVIVAL_BEST_KEY, bestOf, clockText, readBest, writeBest } from './arena-storage';
+import { catArt } from './cat-art';
+import { CAT_TYPES } from './cat-types';
+import { recordStat } from './field-guide';
+import { createFrameGuard } from './frame-guard';
+import { MovementPad } from './movement-pad-view';
+import { createRandom, freshSeed } from './random';
+import { type SoundPlayer, sharedSoundPlayer, soundsFor } from './sounds';
+import { isWalkKey, walkDirection } from './walking';
+import type { Vec } from './effects';
+
+// Survival, the arena (arena.ts), drawn on a canvas that fills the page while a run
+// lasts. The simulation runs in fixed steps, as many each frame as the time that
+// passed asks for; the canvas is drawn once a frame, the cats from bitmaps made
+// once from their artwork. The HUD is text, and the run's state is also on the
+// play area as data- attributes for the browser tests. The canvas and everything
+// drawn on it are hidden from assistive technology.
+//
+// Test hooks, read from the page's address when a run starts: `?seed=` fixes the
+// random source, `?speed=` (up to 50) makes time pass that much faster.
+
+type Screen = 'start' | 'playing' | 'paused' | 'results';
+
+/** Cats drawn this size, px. */
+const CAT_SIZE = 44;
+const HERO_SIZE = 56;
+/** The floor's tiles, px. */
+const TILE = 96;
+/** A game step more than this behind is dropped: the game slows rather than freezing. */
+const MAX_STEPS_PER_FRAME = 240;
+/** Never more than this many sounds start within `SOUND_WINDOW_MS`. */
+const MAX_SOUNDS = 3;
+const SOUND_WINDOW_MS = 300;
+
+const FRAME_GUARD = { floorFps: 40, resumeFps: 50, smoothing: 0.1 };
+
+type Flash = { x: number; y: number; until: number };
+
+type Hud = {
+  time: number;
+  resolve: number;
+  maxResolve: number;
+  sentHome: number;
+  cats: number;
+  heroX: number;
+  heroY: number;
+  effect: string | null;
+};
+
+const OUTCOME_TEXT: Record<ArenaOutcome, string> = {
+  spent: 'His Resolve is spent. The cats remain.',
+  'gave-up': 'He has given up. The cats remain.',
+  goal: 'Five minutes, and the night is survived. The cats remain.',
+};
+
+function testHooks(): { seed: number; speed: number } {
+  const params = new URLSearchParams(window.location.search);
+  const seed = Number(params.get('seed'));
+  const speed = Number(params.get('speed'));
+  return {
+    seed: Number.isInteger(seed) && seed > 0 ? seed : freshSeed(),
+    speed: Number.isFinite(speed) && speed >= 1 ? Math.min(speed, 50) : 1,
+  };
+}
+
+/** A bitmap of `src`, `size` px square, drawn once; null until it has loaded. */
+function bitmapOf(src: string, size: number, onReady: () => void): () => HTMLCanvasElement | null {
+  let ready: HTMLCanvasElement | null = null;
+  const image = new Image();
+  image.onload = () => {
+    const canvas = document.createElement('canvas');
+    canvas.width = size;
+    canvas.height = size;
+    canvas.getContext('2d')?.drawImage(image, 0, 0, size, size);
+    ready = canvas;
+    onReady();
+  };
+  image.src = src;
+  return () => ready;
+}
+
+function subscribeBest(onChange: () => void) {
+  window.addEventListener('storage', onChange);
+  return () => window.removeEventListener('storage', onChange);
+}
+
+export default function ArenaGame({ touch = false }: { touch?: boolean }) {
+  const [screen, setScreen] = useState<Screen>('start');
+  const [hud, setHud] = useState<Hud | null>(null);
+  const [outcome, setOutcome] = useState<ArenaOutcome | null>(null);
+  // The finished run's numbers, kept for the results screen.
+  const [result, setResult] = useState<{ time: number; sentHome: number } | null>(null);
+  const best = useSyncExternalStore(subscribeBest, readBest, () => null);
+  const arenaRef = useRef<Arena | null>(null);
+  const screenRef = useRef<Screen>('start');
+  const canvasRef = useRef<HTMLCanvasElement>(null);
+  const areaRef = useRef<HTMLDivElement>(null);
+  const pauseRef = useRef<HTMLDivElement>(null);
+  const resultsRef = useRef<HTMLElement>(null);
+  const padRef = useRef<Vec>({ x: 0, y: 0 });
+  const speedRef = useRef(1);
+  const playerRef = useRef<SoundPlayer | null>(null);
+  const onPad = useCallback((direction: Vec) => {
+    padRef.current = direction;
+  }, []);
+
+  const show = useCallback((next: Screen) => {
+    screenRef.current = next;
+    setScreen(next);
+  }, []);
+
+  const finish = useCallback(
+    (how: ArenaOutcome) => {
+      const arena = arenaRef.current;
+      if (!arena) return;
+      const time = Math.min(arena.state().time, arena.config.timeGoalMs);
+      writeBest(bestOf(readBest(), time));
+      setResult({ time, sentHome: arena.state().sentHome });
+      setOutcome(how);
+      show('results');
+    },
+    [show]
+  );
+
+  const start = () => {
+    const { seed, speed } = testHooks();
+    speedRef.current = speed;
+    playerRef.current ??= sharedSoundPlayer();
+    // The click that started the run is the gesture sound needs.
+    playerRef.current.unlock();
+    arenaRef.current = createArena({
+      random: createRandom(seed),
+      types: CAT_TYPES,
+      viewport: { width: window.innerWidth, height: window.innerHeight },
+    });
+    setOutcome(null);
+    setHud(null);
+    show('playing');
+  };
+
+  const pause = useCallback(() => {
+    if (screenRef.current === 'playing') show('paused');
+  }, [show]);
+  const resume = () => {
+    if (screenRef.current === 'paused') show('playing');
+  };
+  const giveUp = () => {
+    arenaRef.current?.giveUp();
+    finish('gave-up');
+  };
+
+  const running = screen === 'playing' || screen === 'paused';
+
+  // Focus: into the play area when a run starts, onto Resume when paused, onto
+  // Play again when it is over.
+  useEffect(() => {
+    if (screen === 'playing') areaRef.current?.focus();
+    if (screen === 'paused') pauseRef.current?.querySelector('button')?.focus();
+    if (screen === 'results') resultsRef.current?.querySelector('button')?.focus();
+  }, [screen]);
+
+  // While a run lasts its play area covers the page: everything else is inert, so
+  // focus cannot wander behind it. Only what this marked is unmarked again.
+  useEffect(() => {
+    if (!running) return;
+    const area = areaRef.current;
+    if (!area) return;
+    const marked: Element[] = [];
+    for (let node: Element = area; node.parentElement; node = node.parentElement) {
+      for (const sibling of Array.from(node.parentElement.children)) {
+        if (sibling === node || sibling.hasAttribute('inert')) continue;
+        sibling.setAttribute('inert', '');
+        marked.push(sibling);
+      }
+      if (node.parentElement === document.body) break;
+    }
+    return () => {
+      for (const element of marked) element.removeAttribute('inert');
+    };
+  }, [running]);
+
+  // The run: input, the fixed-step loop, drawing, sounds.
+  useEffect(() => {
+    if (!running) return;
+    const arena = arenaRef.current;
+    const canvas = canvasRef.current;
+    const context = canvas?.getContext('2d');
+    if (!arena || !canvas || !context) return;
+
+    let dirty = true;
+    const redraw = () => {
+      dirty = true;
+    };
+    const sprites = CAT_TYPES.map((type) => {
+      const art = catArt(type.id, 'awake');
+      return art ? bitmapOf(art, CAT_SIZE * 2, redraw) : () => null;
+    });
+    const hero = bitmapOf(
+      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(HERO_SVG)}`,
+      HERO_SIZE * 2,
+      redraw
+    );
+    const titan = CAT_TYPES.findIndex((type) => type.id === 'titan-forest-cat');
+
+    const guard = createFrameGuard(FRAME_GUARD);
+    const held = new Set<string>();
+    const flashes: Flash[] = [];
+    const met = new Set<number>();
+    const sounds: number[] = [];
+    let carry = 0;
+    let last = performance.now();
+    let lastHud = 0;
+    let frameId = 0;
+
+    const sound = (play: () => void) => {
+      const now = performance.now();
+      while (sounds.length > 0 && now - sounds[0] > SOUND_WINDOW_MS) sounds.shift();
+      if (sounds.length >= MAX_SOUNDS) return;
+      sounds.push(now);
+      play();
+    };
+
+    const resize = () => {
+      const ratio = window.devicePixelRatio || 1;
+      canvas.width = Math.round(window.innerWidth * ratio);
+      canvas.height = Math.round(window.innerHeight * ratio);
+      context.setTransform(ratio, 0, 0, ratio, 0, 0);
+      arena.resize({ width: window.innerWidth, height: window.innerHeight });
+      dirty = true;
+    };
+    resize();
+
+    const draw = (time: number) => {
+      const width = window.innerWidth;
+      const height = window.innerHeight;
+      const state = arena.state();
+      const camX = state.hero.x - width / 2;
+      const camY = state.hero.y - height / 2;
+      context.fillStyle = '#070b14';
+      context.fillRect(0, 0, width, height);
+      // The floor: faint tiles that slide as he walks.
+      context.strokeStyle = 'rgba(45, 47, 71, 0.55)';
+      context.lineWidth = 1;
+      context.beginPath();
+      for (let x = -(((camX % TILE) + TILE) % TILE); x < width; x += TILE) {
+        context.moveTo(x + 0.5, 0);
+        context.lineTo(x + 0.5, height);
+      }
+      for (let y = -(((camY % TILE) + TILE) % TILE); y < height; y += TILE) {
+        context.moveTo(0, y + 0.5);
+        context.lineTo(width, y + 0.5);
+      }
+      context.stroke();
+
+      // The beams.
+      context.strokeStyle = '#c1e838';
+      context.shadowColor = '#c1e838';
+      context.shadowBlur = 12;
+      context.lineWidth = 3;
+      for (const beam of arena.beams()) {
+        context.beginPath();
+        context.moveTo(beam.from.x - camX, beam.from.y - camY);
+        context.lineTo(beam.to.x - camX, beam.to.y - camY);
+        context.stroke();
+      }
+      context.shadowBlur = 0;
+
+      // The cats; an elite ringed, a homesick one with its bar.
+      const half = CAT_SIZE / 2;
+      for (const cat of arena.cats()) {
+        const x = cat.x - camX;
+        const y = cat.y - camY;
+        if (x < -CAT_SIZE || y < -CAT_SIZE || x > width + CAT_SIZE || y > height + CAT_SIZE) {
+          continue;
+        }
+        const bitmap = sprites[cat.type]();
+        if (bitmap) context.drawImage(bitmap, x - half, y - half, CAT_SIZE, CAT_SIZE);
+        else {
+          context.fillStyle = CAT_TYPES[cat.type].palette.body;
+          context.beginPath();
+          context.arc(x, y, half * 0.7, 0, 2 * Math.PI);
+          context.fill();
+        }
+        if (cat.elite) {
+          context.strokeStyle = '#9d86ff';
+          context.lineWidth = 2;
+          context.beginPath();
+          context.arc(x, y, half + 2, 0, 2 * Math.PI);
+          context.stroke();
+        }
+        if (cat.homesickness > 0) {
+          context.fillStyle = 'rgba(7, 11, 20, 0.8)';
+          context.fillRect(x - half, y - half - 6, CAT_SIZE, 4);
+          context.fillStyle = '#9d86ff';
+          context.fillRect(x - half, y - half - 6, (CAT_SIZE * cat.homesickness) / cat.limit, 4);
+        }
+      }
+
+      // Beamed home: a column of light where each one stood.
+      for (let i = flashes.length - 1; i >= 0; i--) {
+        const flash = flashes[i];
+        const left = flash.until - time;
+        if (left <= 0) {
+          flashes.splice(i, 1);
+          continue;
+        }
+        context.fillStyle = `rgba(193, 232, 56, ${(left / 300) * 0.55})`;
+        context.fillRect(flash.x - camX - 8, flash.y - camY - 60, 16, 70);
+      }
+
+      // The Matriarch.
+      const matriarch = arena.matriarch();
+      if (matriarch && titan >= 0) {
+        const size = CAT_SIZE * 4;
+        const bitmap = sprites[titan]();
+        context.shadowColor = '#9d86ff';
+        context.shadowBlur = 30;
+        if (bitmap) {
+          context.drawImage(
+            bitmap,
+            matriarch.x - camX - size / 2,
+            matriarch.y - camY - size / 2,
+            size,
+            size
+          );
+        }
+        context.shadowBlur = 0;
+      }
+
+      // The Keeper, flickering while untouchable, faint under a veil.
+      const keeper = hero();
+      if (keeper && !(state.hero.untouchable && Math.floor(time / 90) % 2 === 0)) {
+        context.save();
+        context.globalAlpha = state.hero.effect === 'veil' ? 0.35 : 1;
+        context.translate(width / 2, height / 2);
+        if (state.hero.facing < 0) context.scale(-1, 1);
+        if (state.hero.effect === 'freeze') {
+          context.shadowColor = '#7dd3fc';
+          context.shadowBlur = 16;
+        }
+        context.drawImage(keeper, -HERO_SIZE / 2, -HERO_SIZE / 2, HERO_SIZE, HERO_SIZE);
+        context.restore();
+      }
+    };
+
+    const frame = () => {
+      frameId = requestAnimationFrame(frame);
+      const now = performance.now();
+      const real = Math.min(now - last, 250);
+      last = now;
+      if (screenRef.current !== 'playing') {
+        held.clear();
+        if (dirty) {
+          draw(now);
+          dirty = false;
+        }
+        return;
+      }
+      guard.record(real);
+      carry += real * speedRef.current;
+      const keys = walkDirection(held);
+      const input = keys.x !== 0 || keys.y !== 0 ? keys : padRef.current;
+      let steps = 0;
+      while (carry >= arena.config.stepMs && steps < MAX_STEPS_PER_FRAME) {
+        arena.step(input, guard.allowsSpawning());
+        carry -= arena.config.stepMs;
+        steps++;
+      }
+      if (steps === MAX_STEPS_PER_FRAME) carry = 0;
+
+      const player = playerRef.current;
+      let over: ArenaOutcome | null = null;
+      const hits: number[] = [];
+      for (const event of arena.drainEvents()) {
+        if (event.kind === 'sent-home') {
+          flashes.push({ x: event.x, y: event.y, until: now + 300 });
+          if (player) sound(() => player.play(soundsFor(CAT_TYPES[event.type]).purr));
+        } else if (event.kind === 'hero-hit') {
+          hits.push(event.type);
+          if (player) sound(() => player.play(soundsFor(CAT_TYPES[event.type]).attack));
+        } else if (event.kind === 'matriarch' && titan >= 0 && player) {
+          player.play(soundsFor(CAT_TYPES[titan]).wake);
+        } else if (event.kind === 'over') {
+          over = event.outcome;
+        }
+      }
+      // An attack that did not end the run was survived (the field guide counts it).
+      if (!over) for (const type of hits) recordStat(CAT_TYPES[type].id, 'survived');
+      // Each type in the field guide, once a run, as it is first met.
+      for (const cat of arena.cats()) {
+        if (met.has(cat.type)) continue;
+        met.add(cat.type);
+        recordStat(CAT_TYPES[cat.type].id, 'met');
+      }
+      draw(now);
+      dirty = false;
+
+      const state = arena.state();
+      if (over || now - lastHud > 150) {
+        lastHud = now;
+        setHud({
+          time: state.time,
+          resolve: state.hero.resolve,
+          maxResolve: state.hero.maxResolve,
+          sentHome: state.sentHome,
+          cats: state.cats,
+          heroX: Math.round(state.hero.x),
+          heroY: Math.round(state.hero.y),
+          effect: state.hero.effect,
+        });
+      }
+      if (over) finish(over);
+    };
+    frameId = requestAnimationFrame(frame);
+
+    const onKeyDown = (event: KeyboardEvent) => {
+      if (event.key === 'Escape') {
+        event.preventDefault();
+        if (screenRef.current === 'playing') show('paused');
+        else if (screenRef.current === 'paused') show('playing');
+        return;
+      }
+      if (screenRef.current !== 'playing') return;
+      if (event.ctrlKey || event.metaKey || event.altKey || !isWalkKey(event.code)) return;
+      // The arrow keys would scroll the page under the game.
+      event.preventDefault();
+      held.add(event.code);
+    };
+    const onKeyUp = (event: KeyboardEvent) => {
+      held.delete(event.code);
+    };
+    const onHidden = () => {
+      if (document.visibilityState === 'hidden') pause();
+    };
+    window.addEventListener('keydown', onKeyDown);
+    window.addEventListener('keyup', onKeyUp);
+    window.addEventListener('blur', pause);
+    window.addEventListener('resize', resize);
+    document.addEventListener('visibilitychange', onHidden);
+    return () => {
+      cancelAnimationFrame(frameId);
+      window.removeEventListener('keydown', onKeyDown);
+      window.removeEventListener('keyup', onKeyUp);
+      window.removeEventListener('blur', pause);
+      window.removeEventListener('resize', resize);
+      document.removeEventListener('visibilitychange', onHidden);
+    };
+  }, [running, finish, pause, show]);
+
+  return (
+    <div>
+      <h1 className="font-display text-4xl font-semibold text-cream md:text-[52px]">Survival</h1>
+      <p className="mt-4 max-w-2xl text-sm text-aura">
+        The cats come from every side, and they do not stop coming. The Keeper does not hate them;
+        he only wishes them home. His Laser Pointer finds them on its own: where you stand is
+        everything. Each touch of a cat wears down his Resolve. Last five minutes, and the Matriarch
+        herself will come for him.
+      </p>
+      <p className="mt-2 max-w-2xl text-sm text-aura">
+        {touch
+          ? 'Walk with the pad. Tap Pause to stop for a moment.'
+          : 'Walk with WASD or the arrow keys. Esc pauses.'}
+      </p>
+      <div className="mt-4 flex flex-wrap items-center gap-4">
+        <Button data-testid="survival-start" onClick={start} disabled={running}>
+          {screen === 'results' ? 'Play again' : 'Start Survival'}
+        </Button>
+        <p data-testid="survival-best" data-best={best ?? ''} className="text-sm text-aura">
+          Longest survived: {best === null ? 'none yet' : clockText(best)}
+        </p>
+      </div>
+
+      {screen === 'results' && result && outcome && (
+        <section
+          ref={resultsRef}
+          aria-labelledby="results-heading"
+          data-testid="survival-results"
+          data-outcome={outcome}
+          className="mt-6 max-w-xl rounded-2xl border border-line bg-panel p-6"
+        >
+          <h2 id="results-heading" className="font-display text-2xl font-semibold text-cream">
+            The run is over
+          </h2>
+          <p role="status" className="mt-2 text-sm text-plasma">
+            {OUTCOME_TEXT[outcome]}
+          </p>
+          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm text-white">
+            <dt className="text-aura">Time survived</dt>
+            <dd data-testid="survival-result-time">{clockText(result.time)}</dd>
+            <dt className="text-aura">Cats sent home</dt>
+            <dd data-testid="survival-result-sent-home">{result.sentHome}</dd>
+          </dl>
+          <Button className="mt-4" onClick={start}>
+            Play again
+          </Button>
+        </section>
+      )}
+
+      {running && (
+        // The play area: the whole page while a run lasts.
+        <div
+          ref={areaRef}
+          tabIndex={-1}
+          data-testid="survival-area"
+          data-xenocat-ignore
+          data-screen={screen}
+          data-time={hud?.time ?? 0}
+          data-resolve={hud?.resolve ?? ARENA_CONFIG.hero.resolve}
+          data-cats={hud?.cats ?? 0}
+          data-sent-home={hud?.sentHome ?? 0}
+          data-hero-x={hud?.heroX ?? 0}
+          data-hero-y={hud?.heroY ?? 0}
+          data-effect={hud?.effect ?? ''}
+          data-weapons="laser-pointer"
+          data-best-key={SURVIVAL_BEST_KEY}
+          className="fixed inset-0 z-[9998] select-none overflow-hidden bg-void outline-none"
+        >
+          <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
+          <div className="relative flex flex-wrap items-center gap-6 p-4 text-sm font-semibold text-cream">
+            <p data-testid="survival-time">
+              Time {clockText(hud?.time ?? 0)} / {clockText(ARENA_CONFIG.timeGoalMs)}
+            </p>
+            <div className="flex items-center gap-2">
+              <span id="resolve-label">Resolve</span>
+              <div
+                role="meter"
+                aria-labelledby="resolve-label"
+                aria-valuemin={0}
+                aria-valuemax={hud?.maxResolve ?? ARENA_CONFIG.hero.resolve}
+                aria-valuenow={hud?.resolve ?? ARENA_CONFIG.hero.resolve}
+                className="h-2 w-32 overflow-hidden rounded-full bg-panel"
+              >
+                <div
+                  className="h-full bg-plasma"
+                  style={{
+                    width: `${(100 * (hud?.resolve ?? 1)) / (hud?.maxResolve ?? 1)}%`,
+                  }}
+                />
+              </div>
+              <span data-testid="survival-resolve">{Math.ceil(hud?.resolve ?? 100)}</span>
+            </div>
+            <p data-testid="survival-sent-home">Cats sent home: {hud?.sentHome ?? 0}</p>
+            {screen === 'playing' && (
+              <Button className="ml-auto" onClick={pause}>
+                Pause
+              </Button>
+            )}
+          </div>
+
+          {screen === 'paused' && (
+            <div
+              ref={pauseRef}
+              role="dialog"
+              aria-modal="true"
+              aria-labelledby="pause-heading"
+              className="absolute inset-0 z-20 flex items-center justify-center bg-void/60"
+            >
+              <div className="rounded-2xl border border-line bg-panel p-6 text-center">
+                <h2 id="pause-heading" className="font-display text-xl text-cream">
+                  Paused
+                </h2>
+                <p className="mt-2 text-sm text-aura">The cats wait. They are patient.</p>
+                <div className="mt-4 flex justify-center gap-3">
+                  <Button onClick={resume}>Resume</Button>
+                  <Button onClick={giveUp}>Give up</Button>
+                </div>
+              </div>
+            </div>
+          )}
+
+          {touch && screen === 'playing' && (
+            <MovementPad onDirection={onPad} className="fixed bottom-8 left-8 z-10" />
+          )}
+        </div>
+      )}
+    </div>
+  );
+}
diff --git a/app/ui/xenocats/arena.ts b/app/ui/xenocats/arena.ts
new file mode 100644
index 0000000..eb9653e
--- /dev/null
+++ b/app/ui/xenocats/arena.ts
@@ -0,0 +1,476 @@
+// Survival, the arena (/cats/survival): a time-survival game in the manner of
+// Vampire Survivors, as a pure simulation. Time, input and the random source are
+// passed in, it advances in fixed steps, and nothing here touches the DOM, so a
+// seeded run plays out the same every time and is tested in Node. arena-view.tsx
+// draws it.
+//
+// The hero walks an endless arena; the cats of the twenty xenocat types pour in
+// from just off screen on every side and walk at him. Attacks are automatic:
+// positioning is the skill. His Laser Pointer points at the nearest cat every so
+// often, and every cat its beam touches grows homesick; enough Homesickness and a
+// cat is beamed home. Nothing is ever killed. A cat that reaches him drains his
+// Resolve (each type its own amount), and he is untouchable for a moment after. A
+// few cats are elites, and also lay their xenocat effect on him (Cryo freezes him,
+// Gravi slows him, Mirror turns his controls round...), one effect at a time.
+// Cats keep coming, more and more, until the frame rate says no more (frame-guard.ts).
+// The run ends when his Resolve is spent, when he gives up, or at the time goal,
+// when the Matriarch comes for him and no laser can send her home.
+
+import type { CatType } from './cat-types';
+import { type Vec } from './effects';
+import { createArenaGrid } from './arena-grid';
+import type { Random } from './random';
+
+export type ArenaConfig = {
+  /** One step of the simulation, ms. */
+  stepMs: number;
+  /** The run's time goal, ms: then the Matriarch comes. */
+  timeGoalMs: number;
+  hero: {
+    /** px/s. */
+    speed: number;
+    /** His Resolve when the run begins. */
+    resolve: number;
+    /** After a cat reaches him he cannot be reached again for this long, ms. */
+    untouchableMs: number;
+    /** A cat reaches him when their centres come this close, px. */
+    reach: number;
+  };
+  cats: {
+    /** px/s, slowest and fastest, by type. */
+    speed: readonly [number, number];
+    /** Homesickness a cat can take before it goes home, by type. */
+    homesickness: readonly [number, number];
+    /** Resolve a cat drains on reaching the hero, by type. */
+    drain: readonly [number, number];
+    /** The share of cats that are elites (their xenocat effect lands on the hero). */
+    eliteShare: number;
+    /** An elite's effect on the hero lasts at most this long, ms. */
+    effectMaxMs: number;
+    /** Cats appear this far beyond the edge of the screen, px. */
+    spawnMargin: number;
+    /** Never more cats than this, whatever the frame rate allows. */
+    hardCap: number;
+    /**
+     * Up to this many, cats come whatever the frame-rate guard says: it only holds
+     * back the growth beyond, so a slow screen still gets a game.
+     */
+    guardFree: number;
+  };
+  /**
+   * How many cats the arena aims to hold, by the time into the run: points of
+   * [ms, cats], straight lines between them, the last held after.
+   */
+  escalation: readonly (readonly [number, number])[];
+  /** At most this many cats arrive a second, as a share of those still missing. */
+  arrivalShare: number;
+  laser: {
+    cooldownMs: number;
+    /** How far the beam reaches, px. */
+    range: number;
+    /** Cats this near the beam's line are touched by it, px. */
+    width: number;
+    /** Homesickness each touch gives. */
+    homesickness: number;
+    /** How long a beam is seen, ms. */
+    showMs: number;
+  };
+  matriarch: {
+    /** px/s: faster than the hero. */
+    speed: number;
+    reach: number;
+  };
+  /** The spatial grid's cell, px. */
+  cellSize: number;
+};
+
+export const ARENA_CONFIG: ArenaConfig = {
+  stepMs: 1000 / 60,
+  timeGoalMs: 5 * 60_000,
+  hero: { speed: 210, resolve: 100, untouchableMs: 700, reach: 30 },
+  cats: {
+    speed: [45, 95],
+    homesickness: [16, 34],
+    drain: [4, 11],
+    eliteShare: 0.04,
+    effectMaxMs: 2500,
+    spawnMargin: 60,
+    hardCap: 6000,
+    guardFree: 40,
+  },
+  // A few cats in the first half minute, dozens by one minute, hundreds by two and
+  // a half, and from four minutes as many as the frame rate allows.
+  escalation: [
+    [0, 3],
+    [30_000, 8],
+    [60_000, 45],
+    [150_000, 320],
+    [240_000, 2500],
+    [300_000, 6000],
+  ],
+  arrivalShare: 0.5,
+  laser: { cooldownMs: 1100, range: 300, width: 16, homesickness: 20, showMs: 180 },
+  matriarch: { speed: 330, reach: 70 },
+  cellSize: 64,
+};
+
+/** How many cats the arena aims to hold `ms` into the run. */
+export function catsWanted(ms: number, escalation = ARENA_CONFIG.escalation): number {
+  if (ms <= escalation[0][0]) return escalation[0][1];
+  for (let i = 1; i < escalation.length; i++) {
+    const [t1, n1] = escalation[i];
+    if (ms <= t1) {
+      const [t0, n0] = escalation[i - 1];
+      return Math.round(n0 + ((n1 - n0) * (ms - t0)) / (t1 - t0));
+    }
+  }
+  return escalation[escalation.length - 1][1];
+}
+
+/** What an elite's xenocat effect does to the hero. */
+export type HeroEffect =
+  | { kind: 'freeze' }
+  | { kind: 'slow'; factor: number }
+  | { kind: 'reverse' }
+  | { kind: 'axis'; horizontal: boolean }
+  | { kind: 'push'; way: 'away' | 'toward' | 'down' | 'fixed'; speed: number }
+  | { kind: 'jump'; distance: number }
+  | { kind: 'jitter'; px: number }
+  | { kind: 'veil' };
+
+/** Each xenocat effect, by id, as it lands on the hero; what is only seen is a veil. */
+export const HERO_EFFECTS: Readonly<Record<string, HeroEffect>> = {
+  freeze: { kind: 'freeze' },
+  heavy: { kind: 'slow', factor: 0.35 },
+  giant: { kind: 'slow', factor: 0.6 },
+  delay: { kind: 'slow', factor: 0.5 },
+  reverse: { kind: 'reverse' },
+  'axis-lock': { kind: 'axis', horizontal: true },
+  knockback: { kind: 'push', way: 'away', speed: 420 },
+  bounce: { kind: 'push', way: 'away', speed: 300 },
+  magnet: { kind: 'push', way: 'toward', speed: 160 },
+  orbit: { kind: 'push', way: 'toward', speed: 110 },
+  spiral: { kind: 'push', way: 'toward', speed: 130 },
+  fall: { kind: 'push', way: 'down', speed: 160 },
+  drift: { kind: 'push', way: 'fixed', speed: 120 },
+  drunk: { kind: 'push', way: 'fixed', speed: 90 },
+  teleport: { kind: 'jump', distance: 220 },
+  jitter: { kind: 'jitter', px: 6 },
+  vanish: { kind: 'veil' },
+  blur: { kind: 'veil' },
+  decoys: { kind: 'veil' },
+  tiny: { kind: 'veil' },
+};
+
+export type ArenaCat = {
+  id: number;
+  /** Index into the run's types. */
+  type: number;
+  x: number;
+  y: number;
+  speed: number;
+  homesickness: number;
+  /** How much it can take. */
+  limit: number;
+  drain: number;
+  elite: boolean;
+};
+
+export type ArenaEvent =
+  | { kind: 'sent-home'; x: number; y: number; type: number }
+  | { kind: 'hero-hit'; type: number; elite: boolean }
+  | { kind: 'laser'; from: Vec; to: Vec }
+  | { kind: 'matriarch' }
+  | { kind: 'over'; outcome: ArenaOutcome };
+
+/** How a run ended: his Resolve spent, given up, or the time goal reached. */
+export type ArenaOutcome = 'spent' | 'gave-up' | 'goal';
+
+export type Arena = ReturnType<typeof createArena>;
+
+/**
+ * A run. `types` are the cats that can come (by index); `viewport` is how much of
+ * the arena the screen shows around the hero, so cats appear just off it.
+ */
+export function createArena(options: {
+  random: Random;
+  types: readonly CatType[];
+  viewport: { width: number; height: number };
+  config?: Partial<ArenaConfig>;
+}) {
+  const { random, types } = options;
+  const config: ArenaConfig = { ...ARENA_CONFIG, ...options.config };
+  let viewport = options.viewport;
+  const grid = createArenaGrid(config.cellSize);
+  const near: number[] = [];
+
+  let time = 0;
+  let status: 'playing' | 'over' = 'playing';
+  let outcome: ArenaOutcome | null = null;
+  const hero = { x: 0, y: 0, resolve: config.hero.resolve, untouchableUntil: 0, facing: 1 };
+  let effect: { effect: HeroEffect; until: number; from: Vec; way: Vec } | null = null;
+  let sentHome = 0;
+  let nextId = 1;
+  // The cats: live ones in `cats`, sent-home ones kept in `spare` to be reused.
+  const cats: ArenaCat[] = [];
+  const spare: ArenaCat[] = [];
+  let arrivals = 0;
+  let laserReadyAt = config.laser.cooldownMs / 2;
+  const beams: { from: Vec; to: Vec; until: number }[] = [];
+  let matriarch: Vec | null = null;
+  let events: ArenaEvent[] = [];
+
+  /** A type's own numbers, the same every time: spread between the config's bounds. */
+  const byType = (type: number, [low, high]: readonly [number, number], salt: number) => {
+    const share = ((types[type].number * salt) % 11) / 10;
+    return low + (high - low) * share;
+  };
+
+  function spawnCat() {
+    // Just off screen, all round.
+    const angle = random.next() * 2 * Math.PI;
+    const reach = Math.hypot(viewport.width, viewport.height) / 2 + config.cats.spawnMargin;
+    const type = random.int(0, types.length - 1);
+    const cat = spare.pop() ?? ({} as ArenaCat);
+    cat.id = nextId++;
+    cat.type = type;
+    cat.x = hero.x + Math.cos(angle) * reach;
+    cat.y = hero.y + Math.sin(angle) * reach;
+    cat.speed = byType(type, config.cats.speed, 7);
+    cat.homesickness = 0;
+    cat.limit = byType(type, config.cats.homesickness, 3);
+    cat.drain = Math.round(byType(type, config.cats.drain, 5));
+    cat.elite = random.next() < config.cats.eliteShare;
+    cats.push(cat);
+  }
+
+  function sendHome(index: number) {
+    const cat = cats[index];
+    events.push({ kind: 'sent-home', x: cat.x, y: cat.y, type: cat.type });
+    sentHome++;
+    // Swap-remove, and keep the object for the next cat.
+    cats[index] = cats[cats.length - 1];
+    cats.pop();
+    spare.push(cat);
+  }
+
+  function end(how: ArenaOutcome) {
+    if (status === 'over') return;
+    status = 'over';
+    // Past the time goal the run was won, however it then ended.
+    outcome = how === 'spent' && time >= config.timeGoalMs ? 'goal' : how;
+    events.push({ kind: 'over', outcome });
+  }
+
+  /** Lays an elite's effect on the hero, if none is on him. */
+  function afflict(cat: ArenaCat) {
+    if (effect && time < effect.until) return;
+    const type = types[cat.type];
+    const kind = HERO_EFFECTS[type.effect.id];
+    if (!kind) return;
+    const until = time + Math.min(type.effect.durationMs, config.cats.effectMaxMs);
+    const away = { x: hero.x - cat.x, y: hero.y - cat.y };
+    const length = Math.hypot(away.x, away.y) || 1;
+    const angle = random.next() * 2 * Math.PI;
+    let way = { x: away.x / length, y: away.y / length };
+    if (kind.kind === 'push') {
+      if (kind.way === 'toward') way = { x: -way.x, y: -way.y };
+      else if (kind.way === 'down') way = { x: 0, y: 1 };
+      else if (kind.way === 'fixed') way = { x: Math.cos(angle), y: Math.sin(angle) };
+    }
+    if (kind.kind === 'jump') {
+      hero.x += Math.cos(angle) * kind.distance;
+      hero.y += Math.sin(angle) * kind.distance;
+    }
+    effect = { effect: kind, until, from: { x: cat.x, y: cat.y }, way };
+  }
+
+  /** The hero's walk this step, after any effect on him. */
+  function heroStep(input: Vec, dt: number) {
+    const active = effect && time < effect.until ? effect : null;
+    let { x, y } = input;
+    let speed = config.hero.speed;
+    if (active) {
+      const e = active.effect;
+      if (e.kind === 'freeze') speed = 0;
+      else if (e.kind === 'slow') speed *= e.factor;
+      else if (e.kind === 'reverse') [x, y] = [-x, -y];
+      else if (e.kind === 'axis') y = 0;
+      else if (e.kind === 'push') {
+        hero.x += active.way.x * e.speed * dt;
+        hero.y += active.way.y * e.speed * dt;
+      } else if (e.kind === 'jitter') {
+        hero.x += random.range(-e.px, e.px);
+        hero.y += random.range(-e.px, e.px);
+      }
+    }
+    hero.x += x * speed * dt;
+    hero.y += y * speed * dt;
+    if (x !== 0) hero.facing = Math.sign(x);
+  }
+
+  function fireLaser() {
+    grid.query(hero.x, hero.y, config.laser.range, near);
+    let target: ArenaCat | null = null;
+    let best = config.laser.range ** 2;
+    for (const i of near) {
+      const cat = cats[i];
+      const d = (cat.x - hero.x) ** 2 + (cat.y - hero.y) ** 2;
+      if (d <= best) {
+        best = d;
+        target = cat;
+      }
+    }
+    if (!target) return false;
+    const dx = target.x - hero.x;
+    const dy = target.y - hero.y;
+    const length = Math.hypot(dx, dy);
+    // A cat standing right on him gives no direction: he points the way he faces.
+    const ux = length < 0.5 ? hero.facing : dx / length;
+    const uy = length < 0.5 ? 0 : dy / length;
+    const to = { x: hero.x + ux * config.laser.range, y: hero.y + uy * config.laser.range };
+    beams.push({ from: { x: hero.x, y: hero.y }, to, until: time + config.laser.showMs });
+    events.push({ kind: 'laser', from: { x: hero.x, y: hero.y }, to });
+    // Every cat near the beam's line, within its reach, grows homesick.
+    const hit: number[] = [];
+    for (const i of near) {
+      const cat = cats[i];
+      const along = (cat.x - hero.x) * ux + (cat.y - hero.y) * uy;
+      // (A cat right on him counts as in front: up to the same half pixel.)
+      if (along < -0.5 || along > config.laser.range) continue;
+      const across = Math.abs((cat.x - hero.x) * uy - (cat.y - hero.y) * ux);
+      if (across > config.laser.width + 12) continue;
+      cat.homesickness += config.laser.homesickness;
+      if (cat.homesickness >= cat.limit) hit.push(i);
+    }
+    // Highest index first, so swap-removal leaves the others where they are.
+    hit.sort((a, b) => b - a);
+    for (const i of hit) sendHome(i);
+    return true;
+  }
+
+  return {
+    config,
+
+    resize(size: { width: number; height: number }) {
+      viewport = size;
+    },
+
+    /**
+     * One step of `config.stepMs`: the hero walks the way `input` points (a unit
+     * vector, or zero), cats come (while `spawn` allows), walk, reach him or are
+     * sent home.
+     */
+    step(input: Vec, spawn = true) {
+      if (status === 'over') return;
+      const dt = config.stepMs / 1000;
+      time += config.stepMs;
+      heroStep(input, dt);
+
+      // Arrivals: towards how many the arena wants now, a share a second at most.
+      // While the frame-rate guard says no, only up to `guardFree`.
+      const wanted = Math.min(
+        catsWanted(time, config.escalation),
+        config.cats.hardCap,
+        spawn ? Infinity : config.cats.guardFree
+      );
+      if (cats.length < wanted) {
+        arrivals += Math.max(wanted - cats.length, 1) * config.arrivalShare * dt + dt;
+        while (arrivals >= 1 && cats.length < wanted) {
+          spawnCat();
+          arrivals -= 1;
+        }
+      } else {
+        arrivals = 0;
+      }
+
+      // The cats walk at him; the grid is rebuilt from where they now stand.
+      grid.clear();
+      for (let i = 0; i < cats.length; i++) {
+        const cat = cats[i];
+        const dx = hero.x - cat.x;
+        const dy = hero.y - cat.y;
+        const d = Math.hypot(dx, dy) || 1;
+        const stepLength = Math.min(cat.speed * dt, d);
+        cat.x += (dx / d) * stepLength;
+        cat.y += (dy / d) * stepLength;
+        grid.insert(i, cat.x, cat.y);
+      }
+
+      // Reached: one drain per moment, an elite's effect on top.
+      if (time >= hero.untouchableUntil) {
+        grid.query(hero.x, hero.y, config.hero.reach, near);
+        for (const i of near) {
+          const cat = cats[i];
+          if ((cat.x - hero.x) ** 2 + (cat.y - hero.y) ** 2 > config.hero.reach ** 2) continue;
+          hero.resolve = Math.max(hero.resolve - cat.drain, 0);
+          hero.untouchableUntil = time + config.hero.untouchableMs;
+          events.push({ kind: 'hero-hit', type: cat.type, elite: cat.elite });
+          if (cat.elite) afflict(cat);
+          break;
+        }
+        if (hero.resolve <= 0) {
+          end('spent');
+          return;
+        }
+      }
+
+      if (time >= laserReadyAt && fireLaser()) laserReadyAt = time + config.laser.cooldownMs;
+      for (let i = beams.length - 1; i >= 0; i--) if (beams[i].until <= time) beams.splice(i, 1);
+
+      // The time goal: the Matriarch comes, and ends the run when she reaches him.
+      if (time >= config.timeGoalMs) {
+        if (!matriarch) {
+          const reach = Math.hypot(viewport.width, viewport.height) / 2 + config.cats.spawnMargin;
+          matriarch = { x: hero.x - reach, y: hero.y };
+          events.push({ kind: 'matriarch' });
+        }
+        const dx = hero.x - matriarch.x;
+        const dy = hero.y - matriarch.y;
+        const d = Math.hypot(dx, dy) || 1;
+        const move = Math.min(config.matriarch.speed * dt, d);
+        matriarch.x += (dx / d) * move;
+        matriarch.y += (dy / d) * move;
+        if (d <= config.matriarch.reach) end('goal');
+      }
+    },
+
+    /** The hero gives up: the run ends where it stands. */
+    giveUp() {
+      end('gave-up');
+    },
+
+    /** What happened since the last call (sounds, flashes): handed over once. */
+    drainEvents(): ArenaEvent[] {
+      const out = events;
+      events = [];
+      return out;
+    },
+
+    /** The live cats, as they stand (read, do not keep: the objects are reused). */
+    cats: (): readonly ArenaCat[] => cats,
+    beams: (): readonly { from: Vec; to: Vec }[] => beams,
+    matriarch: (): Vec | null => matriarch,
+
+    state() {
+      const active = effect && time < effect.until ? effect.effect.kind : null;
+      return {
+        time,
+        status,
+        outcome,
+        hero: {
+          x: hero.x,
+          y: hero.y,
+          resolve: hero.resolve,
+          maxResolve: config.hero.resolve,
+          facing: hero.facing,
+          untouchable: time < hero.untouchableUntil,
+          effect: active,
+        },
+        cats: cats.length,
+        sentHome,
+        weapons: ['laser-pointer'] as const,
+      };
+    },
+  };
+}
diff --git a/app/ui/xenocats/fight-page.tsx b/app/ui/xenocats/fight-page.tsx
index 265e61e..d8a66c8 100644
--- a/app/ui/xenocats/fight-page.tsx
+++ b/app/ui/xenocats/fight-page.tsx
@@ -1,9 +1,12 @@
 'use client';
 
 import { useSyncExternalStore } from 'react';
+import ArenaGame from './arena-view';
 import { XenocatCatsProvider } from './cat-layer';
 import { XenocatCursorProvider } from './fake-cursor';
-import Fight, { type Kind } from './fight';
+import Fight from './fight';
+
+export type Kind = 'survival' | 'taming';
 
 const FINE_POINTER = '(pointer: fine)';
 
@@ -19,28 +22,19 @@ const hasFinePointer = () =>
   typeof window.matchMedia !== 'function' || window.matchMedia(FINE_POINTER).matches;
 
 /**
- * A fight game's page (/cats/survival, /cats/taming): the game itself, with the
- * cats and the fake cursor it plays with. No cat comes on its own here. On a touch
- * screen (no precise pointer) Taming is walked with the movement pad, and Survival
- * says it needs a keyboard and mouse.
+ * A fight game's page. Survival (/cats/survival) is the arena (arena-view.tsx): it
+ * needs neither the page's cats nor its fake cursor, so neither runs there. Taming
+ * (/cats/taming) plays with both, with no cat coming on its own. On a touch screen
+ * (no precise pointer) either game is walked with the movement pad.
  */
 export default function FightPage({ kind }: { kind: Kind }) {
   // The server cannot know: it renders the desktop game, and a touch screen swaps it.
   const fine = useSyncExternalStore(subscribePointer, hasFinePointer, () => true);
-  if (!fine && kind === 'survival') {
-    return (
-      <div>
-        <h1 className="font-display text-4xl font-semibold text-cream md:text-[52px]">Survival</h1>
-        <p data-testid="fight-needs-keyboard" className="mt-4 max-w-2xl text-lg text-white">
-          This game needs a keyboard and mouse, for now. Come back on a computer to play it.
-        </p>
-      </div>
-    );
-  }
+  if (kind === 'survival') return <ArenaGame touch={!fine} />;
   return (
     <XenocatCursorProvider>
       <XenocatCatsProvider autoSpawn={false}>
-        <Fight kind={kind} touch={!fine} />
+        <Fight touch={!fine} />
       </XenocatCatsProvider>
     </XenocatCursorProvider>
   );
diff --git a/app/ui/xenocats/fight.tsx b/app/ui/xenocats/fight.tsx
index e6b67ac..2c570f8 100644
--- a/app/ui/xenocats/fight.tsx
+++ b/app/ui/xenocats/fight.tsx
@@ -9,86 +9,39 @@ import { CAT_TYPES, catTypeById } from './cat-types';
 import { CAT_CONFIG } from './config';
 import { type CursorLook, MAX_DECOYS, type Vec } from './effects';
 import { hideCursor, placeCursor, useXenocatCursor } from './fake-cursor';
+import { getGuide, getServerGuide, recordStat, recordTamed, subscribeGuide } from './field-guide';
 import { type LockedPointer, createLockedPointer } from './locked-pointer';
-import { PLAYER_SIZE, PlayerSprite, gunTransform } from './player-sprite';
-import { shotFor } from './gun';
-import {
-  type Beam,
-  type Facing,
-  SURVIVAL_BEST_KEY,
-  type Survival,
-  type SurvivalSnapshot,
-  bestScore,
-  createGameClock,
-  createSurvival,
-  facingTowards,
-  isWalkKey,
-  walkDirection,
-} from './survival';
-import { type Taming, type TamingSnapshot, createTaming, treatInfo } from './taming';
 import { MovementPad } from './movement-pad-view';
-import { getGuide, getServerGuide, recordStat, recordTamed, subscribeGuide } from './field-guide';
-
-// Fight a cat, each game on a page of its own (fight-page.tsx): the page is the
-// game, its play area filling the page while a game runs. Start asks for pointer
-// lock: the browser hides the system pointer and the game owns the pointer's
-// position, so the cats attack that pointer itself (locked-pointer.ts). Esc releases
-// the lock and ends the game; losing it any other way (another tab, another window)
-// pauses it, and leaving the page ends it. Where pointer lock is refused or missing,
-// the game runs on the page's own pointer instead.
-//
-// Two games: Survival (/cats/survival, survival.ts), where a ranger walked with
-// WASD beams cats home at the crosshair, and Taming (/cats/taming, taming.ts), where
-// the same ranger, unarmed, carries treats to one cat at a time to tame it, into a
-// collection kept in localStorage. Taming is played on touch screens too, walked
-// with the movement pad (movement-pad-view.tsx); there the pointer is never locked.
-//
-// In Survival the ranger and the crosshair are both positions a cat's attack can
-// move (locked-pointer.ts, one each): WASD walks the one, the mouse moves the other,
-// and every attack hits both.
+import { PLAYER_SIZE, PlayerSprite } from './player-sprite';
+import { type Taming, type TamingSnapshot, createTaming, treatInfo } from './taming';
+import { type Facing, createGameClock, facingTowards, isWalkKey, walkDirection } from './walking';
+
+// Taming, on its own page (/cats/taming, fight-page.tsx): the page is the game, its
+// play area filling the page while a game runs. A ranger, unarmed, carries treats
+// to one cat at a time to tame it (taming.ts), into a collection kept in
+// localStorage. It walks with WASD, or on a touch screen with the movement pad
+// (movement-pad-view.tsx); the ranger is a position a cat's attack can move
+// (locked-pointer.ts). On a computer Start asks for pointer lock, which only puts
+// the system pointer out of the way: the pointer plays no part. Esc releases the
+// lock and ends the game; losing it any other way (another tab, another window)
+// pauses it, and leaving the page ends it. Where pointer lock is refused or
+// missing, or on a touch screen, the game runs without it.
 
 type Mode = 'locked' | 'fallback';
 type Phase = 'idle' | 'playing' | 'paused' | 'over';
-export type Kind = 'survival' | 'taming';
 
 type Game = {
   clock: ReturnType<typeof createGameClock>;
   mode: Mode;
-} & (
-  | { kind: 'survival'; survival: Survival; player: LockedPointer; aim: LockedPointer }
-  | { kind: 'taming'; taming: Taming; ranger: LockedPointer }
-);
-
-type Departure = { id: number; typeId: string; x: number; y: number };
+  taming: Taming;
+  ranger: LockedPointer;
+};
 
 /** The ranger never grows more than this under a cat's attack (Giant would be 4×). */
 const MAX_PLAYER_SCALE = 2;
 
 const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
 
-function readBest(): number | null {
-  try {
-    const value = Number(window.localStorage.getItem(SURVIVAL_BEST_KEY));
-    return Number.isInteger(value) && value > 0 ? value : null;
-  } catch {
-    return null;
-  }
-}
-
-/** Another tab may set a new best. */
-function subscribeBest(onChange: () => void) {
-  window.addEventListener('storage', onChange);
-  return () => window.removeEventListener('storage', onChange);
-}
-
-function writeBest(score: number) {
-  try {
-    window.localStorage.setItem(SURVIVAL_BEST_KEY, String(score));
-  } catch {
-    // Storage blocked or full: the best score just isn't kept.
-  }
-}
-
 /** Asks for pointer lock on <body>. Resolves false if it is missing or refused. */
 function requestLock(): Promise<boolean> {
   const target = document.body;
@@ -135,7 +88,7 @@ function placeCat(element: HTMLElement, at: Vec) {
   element.style.top = `${at.y - CAT_CONFIG.catSize / 2}px`;
 }
 
-/** Draws something centred on its element (the ranger, the crosshair) and its decoys. */
+/** Draws the ranger centred on its element, and its decoys. */
 function placeWithDecoys(
   element: HTMLElement | null,
   decoys: readonly (HTMLElement | null)[],
@@ -150,33 +103,24 @@ function placeWithDecoys(
   });
 }
 
-/** A beam drawn at its head, along its flight, at its size. */
-const beamTransform = (beam: Beam) =>
-  `translate3d(${beam.x}px, ${beam.y}px, 0) rotate(${Math.atan2(beam.vy, beam.vx)}rad) scale(${beam.scale})`;
-
 const viewportSize = () => ({ width: window.innerWidth, height: window.innerHeight });
 
 export default function Fight({
-  kind,
   touch = false,
 }: {
-  kind: Kind;
-  /** A touch screen: Taming is walked with the movement pad. */
+  /** A touch screen: the ranger is walked with the movement pad. */
   touch?: boolean;
 }) {
   const cursor = useXenocatCursor();
   const cats = useXenocats();
   const [phase, setPhase] = useState<Phase>('idle');
   const [mode, setMode] = useState<Mode>('fallback');
-  const [snap, setSnap] = useState<SurvivalSnapshot | null>(null);
   const [tameSnap, setTameSnap] = useState<TamingSnapshot | null>(null);
   const [pose, setPose] = useState<{ facing: Facing; walking: boolean }>({
     facing: 'e',
     walking: false,
   });
-  const [departures, setDepartures] = useState<Departure[]>([]);
   // Read on every render, so what a game just wrote shows at once.
-  const best = useSyncExternalStore(subscribeBest, readBest, () => null);
   const guide = useSyncExternalStore(subscribeGuide, getGuide, getServerGuide);
   const tamedTotal = Object.values(guide.tamed).reduce((sum, count) => sum + count, 0);
   const [message, setMessage] = useState('');
@@ -189,15 +133,12 @@ export default function Fight({
   }, []);
   const playerRef = useRef<HTMLDivElement>(null);
   const playerDecoyRefs = useRef<(HTMLDivElement | null)[]>([]);
-  const gunRef = useRef<HTMLDivElement>(null);
-  const crosshairRef = useRef<HTMLDivElement>(null);
-  const crosshairDecoyRefs = useRef<(HTMLDivElement | null)[]>([]);
   const startRef = useRef<HTMLDivElement>(null);
   const areaRef = useRef<HTMLDivElement>(null);
-  // False once the section has gone: a lock request still pending then gives up.
+  // False once the page has gone: a lock request still pending then gives up.
   const mountedRef = useRef(true);
-  // Cats move every frame, so the loop moves their elements itself; React renders
-  // only when what it shows changes (a cat comes or goes, a life, a wave, a treat).
+  // The cat moves every frame, so the loop moves its element itself; React renders
+  // only when what it shows changes (a cat comes or goes, a treat, a tamed cat).
   const shownRef = useRef('');
   // Set from Start until the game begins: asking for the lock can take a second.
   const startingRef = useRef(false);
@@ -212,17 +153,8 @@ export default function Fight({
     if (!game || phaseRef.current === 'over' || phaseRef.current === 'idle') return;
     if (document.pointerLockElement) document.exitPointerLock();
     cursor.hide(false);
-    if (game.kind === 'survival') {
-      const final = game.survival.snapshot();
-      const kept = bestScore(readBest(), final.score);
-      writeBest(kept);
-      setSnap(final);
-      setMessage(`Game over. You survived ${plural(final.score, 'wave', 'waves')}. Best: ${kept}.`);
-    } else {
-      const tamed = game.taming.snapshot().tamed.length;
-      setMessage(`Taming over. You tamed ${plural(tamed, 'cat', 'cats')}.`);
-    }
-    setDepartures([]);
+    const tamed = game.taming.snapshot().tamed.length;
+    setMessage(`Taming over. You tamed ${plural(tamed, 'cat', 'cats')}.`);
     changePhase('over');
   }, [cursor, changePhase]);
 
@@ -235,18 +167,15 @@ export default function Fight({
     changePhase('paused');
   }, [cursor, changePhase]);
 
-  // The fake cursor gives way to the game's own crosshair in Survival, and to the
-  // locked pointer; in Taming's fallback it stays, so End game can be found (the
-  // pointer itself plays no part in Taming).
-  const hidesCursor = (game: Game) => game.kind === 'survival' || game.mode === 'locked';
+  // The fake cursor gives way to the locked pointer; in the fallback it stays, so
+  // End game can be found (the pointer itself plays no part in Taming).
+  const hidesCursor = (game: Game) => game.mode === 'locked';
 
   const begin = (game: Game) => {
     gameRef.current = game;
     shownRef.current = '';
     setMode(game.mode);
-    setDepartures([]);
-    if (game.kind === 'survival') setSnap(game.survival.snapshot());
-    else setTameSnap(game.taming.snapshot());
+    setTameSnap(game.taming.snapshot());
     cursor.hide(hidesCursor(game));
     const stop =
       game.mode === 'locked'
@@ -255,9 +184,7 @@ export default function Fight({
           ? 'Tap End game to stop.'
           : 'Press Esc or End game to stop.';
     setMessage(
-      game.kind === 'survival'
-        ? `The cats are coming. Walk with WASD and aim: your beam fires by itself. ${stop}`
-        : `Walk with ${touch ? 'the pad' : 'WASD'} to a treat, then carry it to the cat. ${stop}`
+      `Walk with ${touch ? 'the pad' : 'WASD'} to a treat, then carry it to the cat. ${stop}`
     );
     changePhase('playing');
   };
@@ -275,30 +202,17 @@ export default function Fight({
       return;
     }
     const viewport = viewportSize();
-    const at: Vec = cursor.position() ?? { x: viewport.width / 2, y: viewport.height / 2 };
-    const clock = createGameClock(performance.now());
-    const mode: Mode = locked ? 'locked' : 'fallback';
     const options = { random: cursor.random, types: CAT_TYPES, viewport, now: 0 };
-    const position = (start: Vec) =>
-      createLockedPointer({ viewport, start, random: cursor.random });
-    begin(
-      kind === 'survival'
-        ? {
-            clock,
-            mode,
-            kind,
-            survival: createSurvival(options),
-            player: position({ x: viewport.width / 2, y: viewport.height / 2 }),
-            aim: position(at),
-          }
-        : {
-            clock,
-            mode,
-            kind,
-            taming: createTaming(options),
-            ranger: position({ x: viewport.width / 2, y: viewport.height / 2 }),
-          }
-    );
+    begin({
+      clock: createGameClock(performance.now()),
+      mode: locked ? 'locked' : 'fallback',
+      taming: createTaming(options),
+      ranger: createLockedPointer({
+        viewport,
+        start: { x: viewport.width / 2, y: viewport.height / 2 },
+        random: cursor.random,
+      }),
+    });
   };
 
   const resume = async () => {
@@ -311,7 +225,7 @@ export default function Fight({
         return;
       }
       if (!locked) {
-        // Refused this time: carry on with the page's pointer.
+        // Refused this time: carry on without it.
         game.mode = 'fallback';
         setMode('fallback');
       }
@@ -328,7 +242,6 @@ export default function Fight({
     if (phase === 'over') startRef.current?.querySelector('button')?.focus();
   }, [phase]);
 
-  // The game loop, and everything that can pause or end the game.
   const running = phase === 'playing' || phase === 'paused';
 
   // While a game runs its play area covers the page, so everything else is made
@@ -351,114 +264,35 @@ export default function Fight({
       for (const element of marked) element.removeAttribute('inert');
     };
   }, [running]);
+
+  // The game loop, and everything that can pause or end the game.
   useEffect(() => {
     if (!running) return;
     const game = gameRef.current;
     if (!game) return;
 
-    // Each game cat makes its arrival sound once, when it first shows up.
+    // Each cat makes its arrival sound once, when it first shows up.
     const heard = new Set<number>();
-    const hearArrivals = (list: readonly { id: number; typeId: string }[]) => {
-      for (const cat of list) {
-        if (heard.has(cat.id)) continue;
-        heard.add(cat.id);
-        cats.sound(cat.typeId, 'arrive');
-        recordStat(cat.typeId, 'met');
-      }
+    const hearArrival = (cat: { id: number; typeId: string } | null) => {
+      if (!cat || heard.has(cat.id)) return;
+      heard.add(cat.id);
+      cats.sound(cat.typeId, 'arrive');
+      recordStat(cat.typeId, 'met');
     };
 
-    const moveCats = (list: readonly { id: number; x: number; y: number }[]) => {
-      const elements = areaRef.current?.querySelectorAll<HTMLElement>('[data-cat-id]') ?? [];
-      for (const element of elements) {
-        const cat = list.find((c) => String(c.id) === element.dataset.catId);
-        if (cat) placeCat(element, cat);
-      }
+    const moveCat = (cat: { id: number; x: number; y: number } | null) => {
+      if (!cat) return;
+      const element = areaRef.current?.querySelector<HTMLElement>(`[data-cat-id="${cat.id}"]`);
+      if (element) placeCat(element, cat);
     };
 
-    const moveBeams = (list: readonly Beam[]) => {
-      const elements = areaRef.current?.querySelectorAll<HTMLElement>('[data-beam-id]') ?? [];
-      for (const element of elements) {
-        const beam = list.find((b) => String(b.id) === element.dataset.beamId);
-        // A falling or bouncing beam turns as it flies.
-        if (beam) element.style.transform = beamTransform(beam);
-      }
-    };
-
-    // Survival's input: the walk keys held. The gun fires by itself.
+    // The walk keys held.
     const held = new Set<string>();
     let shown: { facing: Facing; walking: boolean } | null = null;
-    // Without pointer lock the aim moves by how far the page's pointer moved.
-    let lastClient: Vec | null = cursor.position();
     let lastNow = game.clock.now(performance.now());
 
-    const playSurvival = (
-      now: number,
-      game: Extract<Game, { kind: 'survival' }>
-    ): SurvivalSnapshot => {
-      const dt = Math.max(now - lastNow, 0) / 1000;
-      const way = walkDirection(held);
-      const speed = game.survival.config.playerSpeed * dt;
-      if (way.x !== 0 || way.y !== 0) game.player.move(way.x * speed, way.y * speed);
-
-      const body = game.player.frame(now);
-      const look = game.aim.frame(now);
-      const player = { x: body.x, y: body.y };
-      const aim = { x: look.x, y: look.y };
-      // The ranger's attack reaches its gun too (gun.ts): null while it is jammed.
-      const shot = shotFor(
-        game.player.activeEffectId(now),
-        { ...body, scale: Math.min(body.scale, MAX_PLAYER_SCALE) },
-        aim,
-        cursor.random
-      );
-      if (shot) game.survival.fire(now, shot.from, shot.to, shot.style);
-      const { touched, pounced, beamed } = game.survival.tick(
-        now,
-        player,
-        CAT_CONFIG.maxCats - cats.count()
-      );
-
-      // Every attack hits the ranger and the crosshair alike; one effect at a time
-      // on each, but a cat touching during another's effect still costs a life.
-      for (const cat of [...touched, ...pounced]) {
-        const type = catTypeById(cat.typeId);
-        if (!type) continue;
-        const hitPlayer = game.player.attack(type.effect, cat, now);
-        const hitAim = game.aim.attack(type.effect, cat, now);
-        if (hitPlayer || hitAim) cats.sound(type.id, 'attack');
-      }
-      for (const cat of beamed) cats.sound(cat.typeId, 'purr');
-      if (beamed.length > 0) setDepartures((list) => [...list, ...beamed]);
-
-      const snapshot = game.survival.snapshot();
-      // An attack that did not end the game was survived.
-      if (snapshot.status === 'playing') {
-        for (const cat of [...touched, ...pounced]) recordStat(cat.typeId, 'survived');
-      }
-
-      placeWithDecoys(playerRef.current, playerDecoyRefs.current, {
-        ...body,
-        scale: Math.min(body.scale, MAX_PLAYER_SCALE),
-      });
-      placeWithDecoys(crosshairRef.current, crosshairDecoyRefs.current, look);
-      const angle = Math.atan2(aim.y - player.y, aim.x - player.x);
-      if (gunRef.current) gunRef.current.style.transform = gunTransform(angle);
-      if (playerRef.current)
-        playerRef.current.dataset.effect = game.player.activeEffectId(now) ?? '';
-      if (crosshairRef.current) {
-        crosshairRef.current.dataset.effect = game.aim.activeEffectId(now) ?? '';
-      }
-      const facing = facingTowards(player, aim);
-      const walking = way.x !== 0 || way.y !== 0;
-      if (facing !== shown?.facing || walking !== shown.walking) {
-        shown = { facing, walking };
-        setPose(shown);
-      }
-      return snapshot;
-    };
-
-    // Taming's ranger walks with the held keys, or the pad when none are held.
-    const playTaming = (now: number, game: Extract<Game, { kind: 'taming' }>): TamingSnapshot => {
+    // The ranger walks with the held keys, or the pad when none are held.
+    const playTaming = (now: number): TamingSnapshot => {
       const dt = Math.max(now - lastNow, 0) / 1000;
       const keys = walkDirection(held);
       const way = keys.x !== 0 || keys.y !== 0 ? keys : padRef.current;
@@ -468,7 +302,7 @@ export default function Fight({
       const at = { x: body.x, y: body.y };
       const events = game.taming.tick(now, at, CAT_CONFIG.maxCats - cats.count());
       if (events.attack) {
-        // Its attack lands on the ranger as it does in Survival.
+        // Its attack lands on the ranger: drift, freeze, reverse…
         const type = catTypeById(events.attack.typeId);
         if (type && game.ranger.attack(type.effect, events.attack, now)) {
           cats.sound(type.id, 'attack');
@@ -507,33 +341,14 @@ export default function Fight({
         held.clear();
       } else {
         const now = game.clock.now(performance.now());
-        if (game.kind === 'taming') {
-          const snapshot = playTaming(now, game);
-          hearArrivals(snapshot.cat ? [snapshot.cat] : []);
-          moveCats(snapshot.cat ? [snapshot.cat] : []);
-          const { cat, treats, carrying, tamed } = snapshot;
-          const key = `${cat?.id}|${cat?.doing}|${treats.map((t) => t.id).join(',')}|${carrying}|${tamed.length}`;
-          if (key !== shownRef.current) {
-            shownRef.current = key;
-            setTameSnap(snapshot);
-          }
-        } else {
-          const snapshot = playSurvival(now, game);
-          hearArrivals(snapshot.cats);
-          moveCats(snapshot.cats);
-          moveBeams(snapshot.beams);
-          const { status, lives, wave, score } = snapshot;
-          const ids = snapshot.cats.map((cat) => `${cat.id}${cat.attackAt === null ? '!' : ''}`);
-          const beams = snapshot.beams.map((beam) => beam.id);
-          const key = `${status}|${lives}|${wave}|${score}|${ids.join(',')}|${beams.join(',')}`;
-          if (key !== shownRef.current) {
-            shownRef.current = key;
-            setSnap(snapshot);
-          }
-          if (snapshot.status === 'over') {
-            finish();
-            return;
-          }
+        const snapshot = playTaming(now);
+        hearArrival(snapshot.cat);
+        moveCat(snapshot.cat);
+        const { cat, treats, carrying, tamed } = snapshot;
+        const key = `${cat?.id}|${cat?.doing}|${treats.map((t) => t.id).join(',')}|${carrying}|${tamed.length}`;
+        if (key !== shownRef.current) {
+          shownRef.current = key;
+          setTameSnap(snapshot);
         }
         lastNow = now;
       }
@@ -541,21 +356,6 @@ export default function Fight({
     };
     frameId = requestAnimationFrame(loop);
 
-    const isLocked = () => game.mode === 'locked' && document.pointerLockElement === document.body;
-
-    const onMouseMove = (event: MouseEvent) => {
-      if (phaseRef.current !== 'playing') return;
-      // The pointer plays no part in Taming.
-      if (game.kind === 'taming') return;
-      if (isLocked()) {
-        lastClient = null;
-        game.aim.move(event.movementX, event.movementY);
-        return;
-      }
-      const client = { x: event.clientX, y: event.clientY };
-      if (lastClient) game.aim.move(client.x - lastClient.x, client.y - lastClient.y);
-      lastClient = client;
-    };
     let lockLostTimer = 0;
     const onLockChange = () => {
       // The game releasing the lock itself (it is over) is not a loss.
@@ -586,17 +386,10 @@ export default function Fight({
       if (document.visibilityState === 'hidden') pause();
     };
     const onResize = () => {
-      if (game.kind === 'survival') {
-        game.survival.resize(viewportSize());
-        game.player.resize(viewportSize());
-        game.aim.resize(viewportSize());
-      } else {
-        game.taming.resize(viewportSize());
-        game.ranger.resize(viewportSize());
-      }
+      game.taming.resize(viewportSize());
+      game.ranger.resize(viewportSize());
     };
 
-    document.addEventListener('mousemove', onMouseMove);
     document.addEventListener('pointerlockchange', onLockChange);
     document.addEventListener('visibilitychange', onHidden);
     window.addEventListener('keydown', onKeyDown);
@@ -606,7 +399,6 @@ export default function Fight({
     return () => {
       cancelAnimationFrame(frameId);
       window.clearTimeout(lockLostTimer);
-      document.removeEventListener('mousemove', onMouseMove);
       document.removeEventListener('pointerlockchange', onLockChange);
       document.removeEventListener('visibilitychange', onHidden);
       window.removeEventListener('keydown', onKeyDown);
@@ -614,7 +406,7 @@ export default function Fight({
       window.removeEventListener('blur', pause);
       window.removeEventListener('resize', onResize);
     };
-  }, [running, cursor, cats, finish, pause]);
+  }, [running, cats, finish, pause]);
 
   // Leaving the page mid-game: give the pointer back.
   useEffect(() => {
@@ -631,57 +423,31 @@ export default function Fight({
 
   return (
     <div>
-      <h1 className="font-display text-4xl font-semibold text-cream md:text-[52px]">
-        {kind === 'survival' ? 'Survival' : 'Taming'}
-      </h1>
-      {kind === 'survival' ? (
-        <p className="mt-4 max-w-2xl text-sm text-aura">
-          Walk your ranger with WASD (or the arrow keys), aim with the mouse: the homing beam fires
-          by itself, and a cat it hits is sent home. Cats come in waves, faster and more often each
-          time, and chase you. Each one pounces a moment after it arrives, scrambling you, your aim
-          and your gun; every cat that touches you costs one of 3 lives.
-        </p>
-      ) : (
-        <p className="mt-4 max-w-2xl text-sm text-aura">
-          Walk your ranger with {touch ? 'the pad' : 'WASD (or the arrow keys)'} and pick up a treat
-          (fish, catnip, yarn, milk); treats turn up here and there, and do not wait for long. One
-          cat at a time: while you carry nothing it keeps away, each kind in its own way, and
-          attacks you from a distance. Carry a treat and it comes to you: give it the treat, and the
-          cat is tamed.
-        </p>
-      )}
+      <h1 className="font-display text-4xl font-semibold text-cream md:text-[52px]">Taming</h1>
+      <p className="mt-4 max-w-2xl text-sm text-aura">
+        Walk your ranger with {touch ? 'the pad' : 'WASD (or the arrow keys)'} and pick up a treat
+        (fish, catnip, yarn, milk); treats turn up here and there, and do not wait for long. One cat
+        at a time: while you carry nothing it keeps away, each kind in its own way, and attacks you
+        from a distance. Carry a treat and it comes to you: give it the treat, and the cat is tamed.
+      </p>
       {!touch && (
         <p className="mt-2 max-w-2xl text-sm text-aura">
           Your pointer is locked to the game until you press Esc.
         </p>
       )}
       <div ref={startRef} className="mt-4 flex flex-wrap items-center gap-4">
-        {kind === 'survival' ? (
-          <>
-            <Button data-testid="fight-start" onClick={() => start()} disabled={running}>
-              {phase === 'over' ? 'Play again' : 'Start Survival'}
-            </Button>
-            <p data-testid="fight-best" className="text-sm text-aura">
-              Best:{' '}
-              {best === null ? 'no waves survived yet' : `${best} ${best === 1 ? 'wave' : 'waves'}`}
-            </p>
-          </>
-        ) : (
-          <>
-            <Button data-testid="fight-start-taming" onClick={() => start()} disabled={running}>
-              {phase === 'over' ? 'Tame again' : 'Start Taming'}
-            </Button>
-            <p data-testid="fight-tamed" className="text-sm text-aura">
-              Tamed: {plural(tamedTotal, 'cat', 'cats')}
-            </p>
-          </>
-        )}
+        <Button data-testid="fight-start-taming" onClick={() => start()} disabled={running}>
+          {phase === 'over' ? 'Tame again' : 'Start Taming'}
+        </Button>
+        <p data-testid="fight-tamed" className="text-sm text-aura">
+          Tamed: {plural(tamedTotal, 'cat', 'cats')}
+        </p>
       </div>
       <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-plasma">
         {phase === 'over' ? message : ''}
       </p>
 
-      {running && (kind === 'survival' ? snap : tameSnap) && (
+      {running && tameSnap && (
         // The play area: the whole page while a game runs, the HUD along its top.
         <div
           ref={areaRef}
@@ -689,38 +455,23 @@ export default function Fight({
           data-testid="fight-area"
           data-xenocat-ignore
           data-mode={mode}
-          data-kind={kind}
+          data-kind="taming"
           data-phase={phase}
           className="fixed inset-0 z-[9998] select-none bg-void outline-none"
         >
           <div className="flex flex-wrap items-center gap-6 p-4 text-sm font-semibold text-cream">
-            {kind === 'survival' && snap && (
-              <>
-                <p data-testid="fight-lives" data-lives={snap.lives}>
-                  Lives: {snap.lives}
-                </p>
-                <p data-testid="fight-wave" data-wave={snap.wave}>
-                  Wave {snap.wave}
-                </p>
-                <p data-testid="fight-score">Survived: {snap.score}</p>
-              </>
-            )}
-            {kind === 'taming' && tameSnap && (
-              <>
-                <p data-testid="fight-tamed-now">Tamed this game: {tameSnap.tamed.length}</p>
-                <p data-testid="fight-carrying" data-carrying={tameSnap.carrying ?? ''}>
-                  Carrying:{' '}
-                  {tameSnap.carrying ? (
-                    <>
-                      <span aria-hidden="true">{treatInfo(tameSnap.carrying).emoji}</span>{' '}
-                      {treatInfo(tameSnap.carrying).name}
-                    </>
-                  ) : (
-                    'nothing'
-                  )}
-                </p>
-              </>
-            )}
+            <p data-testid="fight-tamed-now">Tamed this game: {tameSnap.tamed.length}</p>
+            <p data-testid="fight-carrying" data-carrying={tameSnap.carrying ?? ''}>
+              Carrying:{' '}
+              {tameSnap.carrying ? (
+                <>
+                  <span aria-hidden="true">{treatInfo(tameSnap.carrying).emoji}</span>{' '}
+                  {treatInfo(tameSnap.carrying).name}
+                </>
+              ) : (
+                'nothing'
+              )}
+            </p>
             <p role="status" className="text-plasma">
               {message}
             </p>
@@ -732,7 +483,7 @@ export default function Fight({
           </div>
 
           <div aria-hidden="true">
-            {kind === 'taming' && tameSnap?.cat && (
+            {tameSnap.cat && (
               <div
                 key={tameSnap.cat.id}
                 data-cat-id={tameSnap.cat.id}
@@ -757,91 +508,23 @@ export default function Fight({
                 <FightCatSprite typeId={tameSnap.cat.typeId} size={size} />
               </div>
             )}
-            {kind === 'taming' &&
-              tameSnap?.treats.map((treat) => (
-                // Emoji for now: placeholders until the treats get artwork of their own.
-                <div
-                  key={treat.id}
-                  data-testid="fight-treat"
-                  data-kind={treat.kind}
-                  data-x={Math.round(treat.x)}
-                  data-y={Math.round(treat.y)}
-                  className="absolute flex items-center justify-center rounded-full bg-panel/80 text-xl ring-1 ring-plasma/50"
-                  style={{ left: treat.x - 18, top: treat.y - 18, width: 36, height: 36 }}
-                >
-                  {treatInfo(treat.kind).emoji}
-                </div>
-              ))}
-            {kind === 'survival' &&
-              snap?.cats.map((cat) => (
-                <div
-                  key={cat.id}
-                  data-cat-id={cat.id}
-                  data-testid="fight-cat"
-                  data-cat-type={cat.typeId}
-                  data-pounced={cat.attackAt === null}
-                  className={cat.attackAt === null ? 'xenocat-attacking absolute' : 'absolute'}
-                  style={{
-                    left: cat.x - size / 2,
-                    top: cat.y - size / 2,
-                    width: size,
-                    height: size,
-                  }}
-                >
-                  <FightCatSprite typeId={cat.typeId} size={size} />
-                </div>
-              ))}
-            {kind === 'survival' &&
-              departures.map((cat) => (
-                <div
-                  key={cat.id}
-                  data-testid="fight-departure"
-                  className="pointer-events-none absolute"
-                  style={{
-                    left: cat.x - size / 2,
-                    top: cat.y - size,
-                    width: size,
-                    height: size * 1.5,
-                  }}
-                  onAnimationEnd={(event) => {
-                    if (event.target !== event.currentTarget.lastElementChild) return;
-                    setDepartures((list) => list.filter((d) => d.id !== cat.id));
-                  }}
-                >
-                  <div className="xenocat-beam-column absolute inset-x-2 bottom-0 top-0 rounded-full" />
-                  <div
-                    className="xenocat-beam-home absolute bottom-0 left-0"
-                    style={{ width: size, height: size }}
-                  >
-                    <FightCatSprite typeId={cat.typeId} size={size} />
-                  </div>
-                </div>
-              ))}
-            {kind === 'survival' &&
-              snap?.beams.map((beam) => (
-                <div
-                  key={beam.id}
-                  data-beam-id={beam.id}
-                  data-testid="fight-beam"
-                  className="pointer-events-none fixed left-0 top-0 h-0 w-0 origin-top-left"
-                  style={{
-                    transform: beamTransform(beam),
-                    opacity: beam.opacity,
-                    filter:
-                      [
-                        beam.blur > 0 ? `blur(${beam.blur}px)` : '',
-                        beam.tint ? `drop-shadow(0 0 4px ${beam.tint})` : '',
-                      ]
-                        .filter(Boolean)
-                        .join(' ') || undefined,
-                  }}
-                >
-                  <div className="xenocat-beam absolute -left-6 -top-0.5 h-1 w-6 rounded-full" />
-                </div>
-              ))}
+            {tameSnap.treats.map((treat) => (
+              // Emoji for now: placeholders until the treats get artwork of their own.
+              <div
+                key={treat.id}
+                data-testid="fight-treat"
+                data-kind={treat.kind}
+                data-x={Math.round(treat.x)}
+                data-y={Math.round(treat.y)}
+                className="absolute flex items-center justify-center rounded-full bg-panel/80 text-xl ring-1 ring-plasma/50"
+                style={{ left: treat.x - 18, top: treat.y - 18, width: 36, height: 36 }}
+              >
+                {treatInfo(treat.kind).emoji}
+              </div>
+            ))}
           </div>
 
-          {/* The ranger: armed in Survival, empty-handed in Taming. */}
+          {/* The ranger, empty-handed. */}
           <div aria-hidden="true">
             {Array.from({ length: MAX_DECOYS }, (_, i) => (
               <div
@@ -853,11 +536,7 @@ export default function Fight({
                 style={{ opacity: 0 }}
               >
                 <div className="absolute" style={{ left: -half, top: -half }}>
-                  <PlayerSprite
-                    facing={pose.facing}
-                    walking={pose.walking}
-                    armed={kind === 'survival'}
-                  />
+                  <PlayerSprite facing={pose.facing} walking={pose.walking} armed={false} />
                 </div>
               </div>
             ))}
@@ -870,41 +549,11 @@ export default function Fight({
               style={{ opacity: 0 }}
             >
               <div className="absolute" style={{ left: -half, top: -half }}>
-                <PlayerSprite
-                  facing={pose.facing}
-                  walking={pose.walking}
-                  armed={kind === 'survival'}
-                  gunRef={gunRef}
-                />
+                <PlayerSprite facing={pose.facing} walking={pose.walking} armed={false} />
               </div>
             </div>
           </div>
 
-          {kind === 'survival' && phase === 'playing' && (
-            <div aria-hidden="true">
-              {Array.from({ length: MAX_DECOYS }, (_, i) => (
-                <div
-                  key={i}
-                  ref={(element) => {
-                    crosshairDecoyRefs.current[i] = element;
-                  }}
-                  className="pointer-events-none fixed left-0 top-0 h-0 w-0 origin-top-left"
-                  style={{ opacity: 0 }}
-                >
-                  <Crosshair />
-                </div>
-              ))}
-              <div
-                ref={crosshairRef}
-                data-testid="fight-crosshair"
-                className="pointer-events-none fixed left-0 top-0 h-0 w-0 origin-top-left"
-                style={{ opacity: 0 }}
-              >
-                <Crosshair />
-              </div>
-            </div>
-          )}
-
           {phase === 'paused' && (
             <div className="absolute inset-0 z-20 flex items-center justify-center">
               <div className="rounded-2xl border border-line bg-panel p-6 text-center">
@@ -918,7 +567,7 @@ export default function Fight({
             </div>
           )}
 
-          {touch && kind === 'taming' && phase === 'playing' && (
+          {touch && phase === 'playing' && (
             <MovementPad onDirection={onPad} className="fixed bottom-8 left-8 z-10" />
           )}
         </div>
@@ -927,25 +576,7 @@ export default function Fight({
   );
 }
 
-/** The aim: a 32 px ring and cross centred on its element. */
-function Crosshair() {
-  return (
-    <svg
-      width="32"
-      height="32"
-      viewBox="0 0 32 32"
-      className="absolute -left-4 -top-4 overflow-visible"
-    >
-      <g stroke="#c1e838" strokeWidth="2" fill="none" strokeLinecap="round">
-        <circle cx="16" cy="16" r="10" />
-        <path d="M16 1v8M16 23v8M1 16h8M23 16h8" />
-      </g>
-      <circle cx="16" cy="16" r="1.6" fill="#c1e838" />
-    </svg>
-  );
-}
-
-// Redrawn every frame as the cats move; the sprite itself never changes.
+// Redrawn as the cat moves; the sprite itself never changes.
 const FightCatSprite = memo(function FightCatSprite({
   typeId,
   size,
diff --git a/app/ui/xenocats/frame-guard.ts b/app/ui/xenocats/frame-guard.ts
new file mode 100644
index 0000000..3d334f7
--- /dev/null
+++ b/app/ui/xenocats/frame-guard.ts
@@ -0,0 +1,36 @@
+// The Survival arena's frame-rate guard: the game measures how long its frames
+// take, and stops adding cats while the frame rate is below a floor, so a weak
+// machine gets fewer cats rather than a slideshow. It starts adding them again once
+// the rate is back above a higher mark, so it does not flicker on and off at the
+// floor. Pure: frame times are passed in.
+
+export type FrameGuardConfig = {
+  /** Below this many frames a second, no new cat comes. */
+  floorFps: number;
+  /** Cats come again once the rate is back above this. */
+  resumeFps: number;
+  /** How much each new frame counts in the running average (0–1). */
+  smoothing: number;
+};
+
+export type FrameGuard = ReturnType<typeof createFrameGuard>;
+
+export function createFrameGuard(config: FrameGuardConfig) {
+  let averageMs: number | null = null;
+  let allowing = true;
+  return {
+    /** Records how long a frame took, ms. */
+    record(frameMs: number) {
+      if (!(frameMs > 0) || !Number.isFinite(frameMs)) return;
+      averageMs =
+        averageMs === null ? frameMs : averageMs + (frameMs - averageMs) * config.smoothing;
+      const fps = 1000 / averageMs;
+      if (allowing && fps < config.floorFps) allowing = false;
+      else if (!allowing && fps > config.resumeFps) allowing = true;
+    },
+    /** Frames a second, smoothed; null before the first frame. */
+    fps: () => (averageMs === null ? null : 1000 / averageMs),
+    /** Whether new cats may come. */
+    allowsSpawning: () => allowing,
+  };
+}
diff --git a/app/ui/xenocats/gun.ts b/app/ui/xenocats/gun.ts
deleted file mode 100644
index 999fb81..0000000
--- a/app/ui/xenocats/gun.ts
+++ /dev/null
@@ -1,105 +0,0 @@
-// What a cat's attack on the ranger does to its gun (Fight a cat, Survival). Pure,
-// like effects.ts: the effect running, the ranger's look and the aim go in, the shot
-// comes out.
-//
-// Most effects reach the gun without help: a beam leaves the ranger and flies at the
-// crosshair, and the attack moves both (drift, teleport, magnet, orbit, delay,
-// spiral...). Every shot also takes on the ranger's look: a tiny ranger fires tiny
-// beams that must come closer to hit, a giant one big beams; vanished, its beams
-// are invisible; blurred, blurry. The rest is per effect, below.
-
-import type { CursorLook, Vec } from './effects';
-import type { Random } from './random';
-import { NORMAL_SHOT, type ShotStyle } from './survival';
-
-export type Shot = { from: Vec; to: Vec; style: ShotStyle };
-
-/** Beams never shrink or grow past these, whatever the ranger's size. */
-export const SHOT_SCALE: readonly [number, number] = [0.25, 2];
-
-/** The effects that jam the gun: no shot fires while they run. */
-export const JAMMING = new Set(['freeze', 'knockback']);
-
-/** Heavy: the gun reloads this many times slower and its beams fly this much slower. */
-export const HEAVY_RELOAD = 2.5;
-export const HEAVY_SPEED = 0.3;
-
-/** Jitter and Drunk: a shot leaves up to this far off the aim, radians. */
-export const SPREAD: Readonly<Record<string, number>> = {
-  jitter: 0.35,
-  drunk: 0.6,
-};
-
-/** Fall: beams drop like stones, px/s². */
-export const FALL_GRAVITY = 1400;
-
-/** Bounce: beams come back off the screen's edges this many times. */
-export const BOUNCE_TIMES = 3;
-
-function rotate(point: Vec, around: Vec, angle: number): Vec {
-  const dx = point.x - around.x;
-  const dy = point.y - around.y;
-  const cos = Math.cos(angle);
-  const sin = Math.sin(angle);
-  return { x: around.x + dx * cos - dy * sin, y: around.y + dx * sin + dy * cos };
-}
-
-/**
- * The shot the ranger, drawn as `ranger`, fires at `aim` while `effectId` runs on
- * it (null: none). Null when the gun is jammed.
- */
-export function shotFor(
-  effectId: string | null,
-  ranger: CursorLook,
-  aim: Vec,
-  random: Random
-): Shot | null {
-  if (effectId && JAMMING.has(effectId)) return null;
-  const [smallest, biggest] = SHOT_SCALE;
-  const style: ShotStyle = {
-    ...NORMAL_SHOT,
-    scale: Math.min(Math.max(ranger.scale, smallest), biggest),
-    opacity: ranger.visible ? ranger.opacity : 0,
-    blur: ranger.blur,
-    tint: ranger.tint,
-  };
-  let from: Vec = { x: ranger.x, y: ranger.y };
-  let to = aim;
-
-  switch (effectId) {
-    case 'heavy':
-      style.reload = HEAVY_RELOAD;
-      style.speed = HEAVY_SPEED;
-      break;
-    case 'reverse':
-      // The aim mirrored through the ranger: the shot goes out behind it.
-      to = { x: 2 * from.x - aim.x, y: 2 * from.y - aim.y };
-      break;
-    case 'jitter':
-    case 'drunk':
-      to = rotate(aim, from, random.range(-SPREAD[effectId], SPREAD[effectId]));
-      break;
-    case 'decoys': {
-      // Every ranger on screen looks alike; the shot leaves from any one of them.
-      const rangers = [from, ...(ranger.decoys ?? [])];
-      const chosen = random.pick(rangers);
-      to = { x: aim.x + chosen.x - from.x, y: aim.y + chosen.y - from.y };
-      from = chosen;
-      break;
-    }
-    case 'fall':
-      style.gravity = FALL_GRAVITY;
-      break;
-    case 'bounce':
-      style.bounces = BOUNCE_TIMES;
-      break;
-    case 'axis-lock': {
-      // Straight sideways or straight up and down, whichever is nearer the aim.
-      const dx = aim.x - from.x;
-      const dy = aim.y - from.y;
-      to = Math.abs(dx) >= Math.abs(dy) ? { x: aim.x, y: from.y } : { x: from.x, y: aim.y };
-      break;
-    }
-  }
-  return { from, to, style };
-}
diff --git a/app/ui/xenocats/movement-pad.ts b/app/ui/xenocats/movement-pad.ts
index 9d6194d..44181c9 100644
--- a/app/ui/xenocats/movement-pad.ts
+++ b/app/ui/xenocats/movement-pad.ts
@@ -5,10 +5,10 @@
 // The pad is a circle. A touch in its middle (the dead zone) walks nowhere; one
 // further out walks in whichever of the eight WASD ways points nearest to it, as a
 // unit vector, a diagonal no faster than a straight line — the very vector
-// `walkDirection` (survival.ts) gives for those keys held.
+// `walkDirection` (walking.ts) gives for those keys held.
 
 import type { Vec } from './effects';
-import { walkDirection } from './survival';
+import { walkDirection } from './walking';
 
 /** The pad's diameter, px: room for a thumb, and to aim it. */
 export const PAD_SIZE = 144;
diff --git a/app/ui/xenocats/player-sprite.tsx b/app/ui/xenocats/player-sprite.tsx
index 8d813af..438ee99 100644
--- a/app/ui/xenocats/player-sprite.tsx
+++ b/app/ui/xenocats/player-sprite.tsx
@@ -1,4 +1,4 @@
-import type { Facing } from './survival';
+import type { Facing } from './walking';
 
 // The cat ranger of Fight a cat, Survival: a 64×64 astronaut seen from above and a
 // little in front, in eight facings. The east side is drawn; the west side mirrors
diff --git a/app/ui/xenocats/survival.ts b/app/ui/xenocats/survival.ts
deleted file mode 100644
index 6a24206..0000000
--- a/app/ui/xenocats/survival.ts
+++ /dev/null
@@ -1,471 +0,0 @@
-// Fight a cat, Survival mode, as a pure state machine: time, the player, the aim
-// and the random source are passed in, so tests drive it tick by tick (like
-// cat-engine.ts).
-//
-// The player is a character, walked with WASD, whose gun fires a homing beam at
-// the crosshair by itself, at a steady rate. Cats arrive in waves from the edges of the screen and chase the
-// character. Each cat pounces once, 1 to 3 s after it arrives: its attack scrambles
-// the character and the crosshair, but costs nothing. A cat that touches the
-// character lands its attack, leaves, and costs a life. A beam that hits a cat sends
-// it home. A wave is survived once all its cats have arrived and none is left.
-// Every wave brings more cats, sooner and faster. The score is the waves survived.
-
-import type { CatType } from './cat-types';
-import { CAT_CONFIG, type Range } from './config';
-import { type Size, type Vec, direction } from './effects';
-import type { Random } from './random';
-
-export type SurvivalConfig = {
-  lives: number;
-  /** Never more cats on screen than this. */
-  maxCats: number;
-  /** A cat touches the character when their centres come this close, px. */
-  touchRadius: number;
-  /** New cats appear at least this far from the character, px. */
-  keepAwayFromPlayer: number;
-  /** A cat pounces this long after it arrives, ms. */
-  attackAfterMs: Range;
-  /** How fast WASD walks the character, px/s. */
-  playerSpeed: number;
-  /** How fast a beam flies, px/s. */
-  beamSpeed: number;
-  /** A beam hits a cat whose centre is at most this far from its path, px. */
-  beamRadius: number;
-  /** Beams leave the gun this far from the character's centre, px. */
-  muzzleOffset: number;
-  /** The gun fires by itself, one beam this often, ms. */
-  fireEveryMs: number;
-  /** The quiet moment before each wave, ms. */
-  breakMs: number;
-  /** Wave 1; every later wave grows from it (waveSpec). */
-  firstWave: WaveSpec;
-  /** Each wave: one more cat, spawns this much sooner, cats this much faster. */
-  countStep: number;
-  spawnFactor: number;
-  speedFactor: number;
-  minSpawnEveryMs: number;
-  maxSpeed: number;
-};
-
-export type WaveSpec = {
-  /** How many cats the wave brings. */
-  count: number;
-  /** Time between two arrivals, ms. */
-  spawnEveryMs: number;
-  /** How fast its cats chase the character, px/s. */
-  speed: number;
-};
-
-export const SURVIVAL_CONFIG: SurvivalConfig = {
-  lives: 3,
-  maxCats: CAT_CONFIG.maxCats,
-  touchRadius: 40,
-  keepAwayFromPlayer: 240,
-  attackAfterMs: [1000, 3000],
-  playerSpeed: 280,
-  beamSpeed: 1100,
-  beamRadius: CAT_CONFIG.catSize / 2,
-  muzzleOffset: 30,
-  fireEveryMs: 350,
-  breakMs: 1500,
-  firstWave: { count: 3, spawnEveryMs: 1800, speed: 80 },
-  countStep: 1,
-  spawnFactor: 0.88,
-  speedFactor: 1.15,
-  minSpawnEveryMs: 350,
-  maxSpeed: 520,
-};
-
-/** What wave `n` (1-based) brings. */
-export function waveSpec(n: number, config: SurvivalConfig = SURVIVAL_CONFIG): WaveSpec {
-  const grown = Math.max(n, 1) - 1;
-  const { firstWave } = config;
-  return {
-    count: firstWave.count + grown * config.countStep,
-    spawnEveryMs: Math.max(
-      firstWave.spawnEveryMs * config.spawnFactor ** grown,
-      config.minSpawnEveryMs
-    ),
-    speed: Math.min(firstWave.speed * config.speedFactor ** grown, config.maxSpeed),
-  };
-}
-
-export type FightCat = {
-  id: number;
-  typeId: string;
-  /** The cat's centre, px. */
-  x: number;
-  y: number;
-  /** px/s. */
-  speed: number;
-  /** When it pounces (game time), or null once it has. */
-  attackAt: number | null;
-};
-
-/** How a shot flies and looks: a cat's attack on the ranger changes it (gun.ts). */
-export type ShotStyle = {
-  /** Size, and the reach of its hit, against a normal beam. */
-  scale: number;
-  /** Flight speed against beamSpeed. */
-  speed: number;
-  /** The wait for the next shot against fireEveryMs. */
-  reload: number;
-  /** Pulls the beam down as it flies, px/s². */
-  gravity: number;
-  /** How many times it bounces off the screen's edges before it may leave. */
-  bounces: number;
-  opacity: number;
-  /** Blur radius, px. */
-  blur: number;
-  /** A coloured glow (e.g. ice), as a CSS colour. */
-  tint?: string;
-};
-
-export const NORMAL_SHOT: ShotStyle = {
-  scale: 1,
-  speed: 1,
-  reload: 1,
-  gravity: 0,
-  bounces: 0,
-  opacity: 1,
-  blur: 0,
-};
-
-export type Beam = {
-  id: number;
-  /** The beam's head, px. */
-  x: number;
-  y: number;
-  /** Its velocity, px/s. */
-  vx: number;
-  vy: number;
-} & Omit<ShotStyle, 'speed' | 'reload'>;
-
-export type SurvivalStatus = 'playing' | 'over';
-
-export type SurvivalSnapshot = {
-  status: SurvivalStatus;
-  lives: number;
-  /** The wave under way (or about to start), 1-based. */
-  wave: number;
-  /** Waves survived so far: the score. */
-  score: number;
-  cats: readonly FightCat[];
-  beams: readonly Beam[];
-};
-
-/** What happened in one tick. Cats in `touched` and `beamed` are already gone. */
-export type SurvivalEvents = {
-  /** Reached the character: each landed its attack and cost a life. */
-  touched: FightCat[];
-  /** Pounced from where they are: their attack costs nothing. */
-  pounced: FightCat[];
-  /** Hit by a beam and sent home. */
-  beamed: FightCat[];
-};
-
-const NOTHING: SurvivalEvents = { touched: [], pounced: [], beamed: [] };
-
-/** How far `point` is from the segment `a`–`b`. */
-function distanceToSegment(point: Vec, a: Vec, b: Vec): number {
-  const abx = b.x - a.x;
-  const aby = b.y - a.y;
-  const length = abx * abx + aby * aby;
-  const t =
-    length === 0
-      ? 0
-      : Math.min(Math.max(((point.x - a.x) * abx + (point.y - a.y) * aby) / length, 0), 1);
-  return Math.hypot(point.x - (a.x + t * abx), point.y - (a.y + t * aby));
-}
-
-export type Survival = ReturnType<typeof createSurvival>;
-
-export function createSurvival(options: {
-  random: Random;
-  types: readonly CatType[];
-  viewport: Size;
-  /** The game clock when it starts. */
-  now: number;
-  config?: Partial<SurvivalConfig>;
-}) {
-  const { random, types } = options;
-  const config: SurvivalConfig = { ...SURVIVAL_CONFIG, ...options.config };
-  let viewport = options.viewport;
-  let status: SurvivalStatus = 'playing';
-  let lives = config.lives;
-  let wave = 1;
-  let score = 0;
-  let spawned = 0;
-  let nextSpawnAt = options.now + config.breakMs;
-  let nextFireAt = options.now;
-  let lastTick = options.now;
-  let cats: FightCat[] = [];
-  let beams: Beam[] = [];
-  let nextId = 1;
-
-  /**
-   * A point just inside a random edge, away from the character; on a screen too
-   * small for that, the farthest edge point tried. Null only when there is no room.
-   */
-  function edgeSpot(player: Vec): Vec | null {
-    const inset = CAT_CONFIG.catSize / 2;
-    const { width, height } = viewport;
-    if (width < inset * 2 || height < inset * 2) return null;
-    let farthest: Vec | null = null;
-    let farthestDistance = -1;
-    for (let attempt = 0; attempt < 20; attempt++) {
-      const along = random.next();
-      const side = random.int(0, 3);
-      const spot =
-        side === 0
-          ? { x: inset + along * (width - 2 * inset), y: inset }
-          : side === 1
-            ? { x: width - inset, y: inset + along * (height - 2 * inset) }
-            : side === 2
-              ? { x: inset + along * (width - 2 * inset), y: height - inset }
-              : { x: inset, y: inset + along * (height - 2 * inset) };
-      const distance = Math.hypot(spot.x - player.x, spot.y - player.y);
-      if (distance >= config.keepAwayFromPlayer) return spot;
-      if (distance > farthestDistance) {
-        farthest = spot;
-        farthestDistance = distance;
-      }
-    }
-    return farthest;
-  }
-
-  const offScreen = (point: Vec) => {
-    const margin = config.beamRadius;
-    return (
-      point.x < -margin ||
-      point.y < -margin ||
-      point.x > viewport.width + margin ||
-      point.y > viewport.height + margin
-    );
-  };
-
-  /** A beam with bounces left that has crossed an edge comes back off it. */
-  function bounce(beam: Beam) {
-    const { width, height } = viewport;
-    if (beam.bounces > 0 && (beam.x < 0 || beam.x > width)) {
-      beam.x = beam.x < 0 ? -beam.x : 2 * width - beam.x;
-      beam.vx = -beam.vx;
-      beam.bounces--;
-    }
-    if (beam.bounces > 0 && (beam.y < 0 || beam.y > height)) {
-      beam.y = beam.y < 0 ? -beam.y : 2 * height - beam.y;
-      beam.vy = -beam.vy;
-      beam.bounces--;
-    }
-  }
-
-  const snapshot = (): SurvivalSnapshot => ({
-    status,
-    lives,
-    wave,
-    score,
-    cats: cats.map((cat) => ({ ...cat })),
-    beams: beams.map((beam) => ({ ...beam })),
-  });
-
-  return {
-    config,
-
-    resize(size: Size) {
-      viewport = size;
-    },
-
-    snapshot,
-
-    /**
-     * Fires a beam from the character at `player` towards `aim`, unless the gun is
-     * still recharging (the page calls it every frame). Returns the beam, or null.
-     */
-    fire(now: number, player: Vec, aim: Vec, style: Partial<ShotStyle> = {}): Beam | null {
-      if (status === 'over' || now < nextFireAt) return null;
-      const { speed, reload, ...look } = { ...NORMAL_SHOT, ...style };
-      nextFireAt = now + config.fireEveryMs * reload;
-      const way = direction(player, aim, -Math.PI / 2);
-      const beam = {
-        id: nextId++,
-        x: player.x + way.x * config.muzzleOffset * look.scale,
-        y: player.y + way.y * config.muzzleOffset * look.scale,
-        vx: way.x * config.beamSpeed * speed,
-        vy: way.y * config.beamSpeed * speed,
-        ...look,
-      };
-      beams.push(beam);
-      return { ...beam };
-    },
-
-    /**
-     * Advances the game to `now`: spawns, flies the beams, moves every cat towards
-     * the character at `player`, and reports what happened. `room` caps the cats on
-     * screen below `maxCats` (other cats already there count against the limit).
-     */
-    tick(now: number, player: Vec, room: number = config.maxCats): SurvivalEvents {
-      if (status === 'over') return NOTHING;
-      const dt = Math.max(now - lastTick, 0) / 1000;
-      lastTick = now;
-      const spec = waveSpec(wave, config);
-      const limit = Math.min(config.maxCats, Math.max(room, 0));
-
-      // Arrivals that are due, one at a time, while there is room. A spawn that
-      // cannot happen yet (full screen, no spot) is retried on the next tick.
-      while (spawned < spec.count && now >= nextSpawnAt && cats.length < limit) {
-        const spot = edgeSpot(player);
-        if (!spot || types.length === 0) break;
-        cats.push({
-          id: nextId++,
-          typeId: random.pick(types).id,
-          ...spot,
-          speed: spec.speed,
-          attackAt: now + random.range(...config.attackAfterMs),
-        });
-        spawned++;
-        nextSpawnAt = now + spec.spawnEveryMs;
-      }
-
-      // Each beam flies its whole step as a segment, so a long frame cannot carry it
-      // past a cat; it hits the first cat along that segment. A small beam needs a
-      // closer hit, a big one less.
-      const beamed: FightCat[] = [];
-      beams = beams.filter((beam) => {
-        beam.vy += beam.gravity * dt;
-        const from = { x: beam.x, y: beam.y };
-        const to = { x: beam.x + beam.vx * dt, y: beam.y + beam.vy * dt };
-        let hit: FightCat | null = null;
-        let nearest = Infinity;
-        for (const cat of cats) {
-          if (distanceToSegment(cat, from, to) > config.beamRadius * beam.scale) continue;
-          const along = (cat.x - from.x) * beam.vx + (cat.y - from.y) * beam.vy;
-          if (along < nearest) {
-            nearest = along;
-            hit = cat;
-          }
-        }
-        if (hit) {
-          beamed.push({ ...hit });
-          cats = cats.filter((cat) => cat !== hit);
-          return false;
-        }
-        beam.x = to.x;
-        beam.y = to.y;
-        bounce(beam);
-        return !offScreen(beam);
-      });
-
-      const touched: FightCat[] = [];
-      const pounced: FightCat[] = [];
-      cats = cats.filter((cat) => {
-        const dx = player.x - cat.x;
-        const dy = player.y - cat.y;
-        const distance = Math.hypot(dx, dy);
-        const step = cat.speed * dt;
-        if (distance <= config.touchRadius + step) {
-          touched.push({ ...cat, x: player.x, y: player.y });
-          return false;
-        }
-        cat.x += (dx / distance) * step;
-        cat.y += (dy / distance) * step;
-        if (cat.attackAt !== null && now >= cat.attackAt) {
-          cat.attackAt = null;
-          pounced.push({ ...cat });
-        }
-        return true;
-      });
-
-      lives = Math.max(lives - touched.length, 0);
-      if (lives === 0) {
-        status = 'over';
-        cats = [];
-        beams = [];
-        return { touched, pounced, beamed };
-      }
-
-      if (spawned >= spec.count && cats.length === 0) {
-        score++;
-        wave++;
-        spawned = 0;
-        nextSpawnAt = now + config.breakMs;
-      }
-      return { touched, pounced, beamed };
-    },
-  };
-}
-
-/** Where WASD and the arrow keys walk the character (KeyboardEvent.code). */
-const WALK_KEYS: Readonly<Record<string, Vec>> = {
-  KeyW: { x: 0, y: -1 },
-  KeyA: { x: -1, y: 0 },
-  KeyS: { x: 0, y: 1 },
-  KeyD: { x: 1, y: 0 },
-  ArrowUp: { x: 0, y: -1 },
-  ArrowLeft: { x: -1, y: 0 },
-  ArrowDown: { x: 0, y: 1 },
-  ArrowRight: { x: 1, y: 0 },
-};
-
-export const isWalkKey = (code: string) => code in WALK_KEYS;
-
-/**
- * The way the held keys walk the character: a unit vector, or zero when none (or
- * only opposite ones) are held. A diagonal is no faster than a straight line.
- */
-export function walkDirection(held: Iterable<string>): Vec {
-  const keys = new Set(held);
-  let x = 0;
-  let y = 0;
-  for (const code of keys) {
-    const way = WALK_KEYS[code];
-    if (!way) continue;
-    x += way.x;
-    y += way.y;
-  }
-  // WASD and an arrow key for the same way count once.
-  x = Math.sign(x);
-  y = Math.sign(y);
-  const length = Math.hypot(x, y);
-  return length === 0 ? { x: 0, y: 0 } : { x: x / length, y: y / length };
-}
-
-export const FACINGS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'] as const;
-export type Facing = (typeof FACINGS)[number];
-
-/** Which of eight ways the character at `from` faces to look at `to` (screen y grows down). */
-export function facingTowards(from: Vec, to: Vec): Facing {
-  const angle = Math.atan2(to.y - from.y, to.x - from.x);
-  const eighth = Math.round(angle / (Math.PI / 4));
-  return FACINGS[((eighth % 8) + 8) % 8];
-}
-
-/** Where the page keeps the best score (localStorage). */
-export const SURVIVAL_BEST_KEY = 'xenocats:survival-best';
-
-/** The best score after a game that scored `score`. */
-export const bestScore = (previous: number | null, score: number) => Math.max(previous ?? 0, score);
-
-/**
- * Time that stops while the game is paused. `real` is any monotonic clock
- * (performance.now()); `now` returns the game time it maps to.
- */
-export function createGameClock(start: number) {
-  let offset = start;
-  let pausedAt: number | null = null;
-  return {
-    now(real: number): number {
-      return (pausedAt ?? real) - offset;
-    },
-    pause(real: number) {
-      pausedAt ??= real;
-    },
-    resume(real: number) {
-      if (pausedAt === null) return;
-      offset += real - pausedAt;
-      pausedAt = null;
-    },
-    isPaused(): boolean {
-      return pausedAt !== null;
-    },
-  };
-}
diff --git a/app/ui/xenocats/walking.ts b/app/ui/xenocats/walking.ts
new file mode 100644
index 0000000..6814e3c
--- /dev/null
+++ b/app/ui/xenocats/walking.ts
@@ -0,0 +1,75 @@
+// Walking a game character with the keyboard, which way it faces, and a game clock
+// that stands still while a game is paused. Shared by the fight games (fight.tsx,
+// arena-view.tsx) and the movement pad (movement-pad.ts).
+
+import type { Vec } from './effects';
+
+/** Where WASD and the arrow keys walk the character (KeyboardEvent.code). */
+const WALK_KEYS: Readonly<Record<string, Vec>> = {
+  KeyW: { x: 0, y: -1 },
+  KeyA: { x: -1, y: 0 },
+  KeyS: { x: 0, y: 1 },
+  KeyD: { x: 1, y: 0 },
+  ArrowUp: { x: 0, y: -1 },
+  ArrowLeft: { x: -1, y: 0 },
+  ArrowDown: { x: 0, y: 1 },
+  ArrowRight: { x: 1, y: 0 },
+};
+
+export const isWalkKey = (code: string) => code in WALK_KEYS;
+
+/**
+ * The way the held keys walk the character: a unit vector, or zero when none (or
+ * only opposite ones) are held. A diagonal is no faster than a straight line.
+ */
+export function walkDirection(held: Iterable<string>): Vec {
+  const keys = new Set(held);
+  let x = 0;
+  let y = 0;
+  for (const code of keys) {
+    const way = WALK_KEYS[code];
+    if (!way) continue;
+    x += way.x;
+    y += way.y;
+  }
+  // WASD and an arrow key for the same way count once.
+  x = Math.sign(x);
+  y = Math.sign(y);
+  const length = Math.hypot(x, y);
+  return length === 0 ? { x: 0, y: 0 } : { x: x / length, y: y / length };
+}
+
+export const FACINGS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'] as const;
+export type Facing = (typeof FACINGS)[number];
+
+/** Which of eight ways the character at `from` faces to look at `to` (screen y grows down). */
+export function facingTowards(from: Vec, to: Vec): Facing {
+  const angle = Math.atan2(to.y - from.y, to.x - from.x);
+  const eighth = Math.round(angle / (Math.PI / 4));
+  return FACINGS[((eighth % 8) + 8) % 8];
+}
+
+/**
+ * Time that stops while the game is paused. `real` is any monotonic clock
+ * (performance.now()); `now` returns the game time it maps to.
+ */
+export function createGameClock(start: number) {
+  let offset = start;
+  let pausedAt: number | null = null;
+  return {
+    now(real: number): number {
+      return (pausedAt ?? real) - offset;
+    },
+    pause(real: number) {
+      pausedAt ??= real;
+    },
+    resume(real: number) {
+      if (pausedAt === null) return;
+      offset += real - pausedAt;
+      pausedAt = null;
+    },
+    isPaused(): boolean {
+      return pausedAt !== null;
+    },
+  };
+}
diff --git a/scripts/affected-tests.mjs b/scripts/affected-tests.mjs
index 4bc3f42..75605df 100644
--- a/scripts/affected-tests.mjs
+++ b/scripts/affected-tests.mjs
@@ -154,14 +154,17 @@ function areasOfRouteFile(routeFile, allAreas) {
 
 const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
 
-// The areas a spec visits: each area's path, as a string or a URL regex, anywhere in it.
+// The areas a spec visits: each area's path, as a string or a URL regex, anywhere in
+// it. A longer path counts for the area it belongs to (/cats/survival for /cats), but
+// not for another area's (/dashboard/invoices is not /dashboard).
 export function specAreas(specText, allAreas) {
   const text = specText.replaceAll('\\/', '/');
-  return allAreas.filter((area) =>
-    area === '/'
-      ? /['"`]\/['"`?#]/.test(text)
-      : new RegExp(`(^|[^\\w-])${escapeRegExp(area)}(?![\\w-]|/[a-z])`).test(text)
-  );
+  return allAreas.filter((area) => {
+    if (area === '/') return /['"`]\/['"`?#]/.test(text);
+    const path = new RegExp(`(^|[^\\w-])(${escapeRegExp(area)}(?:/[\\w-]+)*)(?![\\w-])`, 'g');
+    for (const match of text.matchAll(path)) if (areaOf(match[2]) === area) return true;
+    return false;
+  });
 }
 
 // The selection for a list of changed paths (relative, `/`-separated).
diff --git a/tests/e2e/fight.spec.ts b/tests/e2e/fight.spec.ts
index 38ec749..c0751ef 100644
--- a/tests/e2e/fight.spec.ts
+++ b/tests/e2e/fight.spec.ts
@@ -1,35 +1,26 @@
 import { type Page, devices, expect, test } from '@playwright/test';
-import { SURVIVAL_BEST_KEY } from '@/app/ui/xenocats/survival';
 import { TAMED_KEY } from '@/app/ui/xenocats/taming';
 
-// The fight games on their own pages, /cats/survival and /cats/taming (no login, no
-// database). Most tests take the fallback path:
-// pointer lock is removed before the page loads, so the game runs with the fake
-// cursor. The "under pointer lock" tests keep it: headless Chromium grants the lock
-// and reports mouse movement, so the locked path can be played too.
+// Taming on its own page, /cats/taming, and the links to both games from /cats (no
+// login, no database). Survival, the arena, has its own spec (survival.spec.ts).
+// Most tests take the fallback path: pointer lock is removed before the page loads.
+// The leave-the-page test keeps it: headless Chromium grants the lock.
 
-async function openFight(
-  page: Page,
-  best?: number,
-  { lock = false, game = 'survival' }: { lock?: boolean; game?: 'survival' | 'taming' } = {}
-) {
+async function openFight(page: Page, { lock = false }: { lock?: boolean } = {}) {
   await page.addInitScript(
-    ({ key, best, lock }) => {
+    ({ lock }) => {
       if (!lock) {
         Object.defineProperty(Element.prototype, 'requestPointerLock', {
           value: undefined,
           configurable: true,
         });
       }
-      if (best !== undefined) window.localStorage.setItem(key, String(best));
     },
-    { key: SURVIVAL_BEST_KEY, best, lock }
+    { lock }
   );
   await page.setViewportSize({ width: 1280, height: 800 });
-  await page.goto(`/cats/${game}`);
-  await expect(
-    page.getByRole('heading', { level: 1, name: game === 'survival' ? 'Survival' : 'Taming' })
-  ).toBeVisible();
+  await page.goto('/cats/taming');
+  await expect(page.getByRole('heading', { level: 1, name: 'Taming' })).toBeVisible();
   // The fake cursor takes over on the first pointer move after hydration.
   let nudge = 0;
   await expect
@@ -41,183 +32,13 @@ async function openFight(
 }
 
 async function start(page: Page) {
-  await page.getByTestId('fight-start').click();
-  const overlay = page.getByTestId('fight-area');
-  await expect(overlay).toBeVisible();
-  await expect(overlay).toHaveAttribute('data-mode', 'fallback');
-  return overlay;
-}
-
-/** Where the game drew an element it places itself (the ranger, the crosshair, a beam). */
-async function placed(page: Page, testId: string) {
-  const transform = await page
-    .getByTestId(testId)
-    .last()
-    .evaluate((el) => (el as HTMLElement).style.transform);
-  const [, x, y] = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(transform)!;
-  return { x: Number(x), y: Number(y) };
-}
-
-/**
- * Moves the mouse so the crosshair lands on `target`. The crosshair moves by how far
- * the mouse moves (a cat's attack can leave it apart from the mouse), so this moves
- * the mouse by the distance from the crosshair to the target. Returns the new mouse.
- */
-async function aimAt(
-  page: Page,
-  mouse: { x: number; y: number },
-  target: { x: number; y: number }
-) {
-  const crosshair = await placed(page, 'fight-crosshair');
-  const next = { x: mouse.x + target.x - crosshair.x, y: mouse.y + target.y - crosshair.y };
-  await page.mouse.move(next.x, next.y);
-  return next;
-}
-
-/** The centre of the cat nearest the ranger, or null when there is none. */
-async function nearestCat(page: Page) {
-  const player = await placed(page, 'fight-player').catch(() => null);
-  if (!player) return null;
-  const distance = (c: { x: number; y: number }) => Math.hypot(c.x - player.x, c.y - player.y);
-  let best: { x: number; y: number } | null = null;
-  for (const cat of await page.getByTestId('fight-cat').all()) {
-    const box = await cat.boundingBox({ timeout: 200 }).catch(() => null);
-    if (!box) continue;
-    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
-    if (!best || distance(centre) < distance(best)) best = centre;
-  }
-  return best;
+  await page.getByTestId('fight-start-taming').click();
+  const area = page.getByTestId('fight-area');
+  await expect(area).toBeVisible();
+  await expect(area).toHaveAttribute('data-mode', 'fallback');
+  return area;
 }
 
-test('Survival: the self-firing beam sends every cat of a wave home; Esc ends the game and keeps the best score', async ({
-  page,
-}) => {
-  test.setTimeout(90_000);
-  await openFight(page);
-  await expect(page.getByTestId('fight-best')).toHaveText('Best: no waves survived yet');
-  await start(page);
-  await expect(page.getByTestId('fight-lives')).toHaveText('Lives: 3');
-  await expect(page.getByTestId('fight-wave')).toHaveText('Wave 1');
-  await expect(page.getByTestId('fight-player').locator('svg').first()).toBeVisible();
-
-  // Keep the crosshair on the nearest cat until wave 1 is over: the gun fires by
-  // itself. It is a real-time game: cats scramble the ranger, its aim and its gun,
-  // and three that reach the ranger end the game; then a new game is started (its
-  // score is 0, so the best score below still comes from the wave survived here).
-  let mouse = { x: 640, y: 400 };
-  await expect
-    .poll(
-      async () => {
-        if ((await page.getByTestId('fight-area').count()) === 0) {
-          await start(page);
-          mouse = { x: 640, y: 400 };
-        }
-        const cat = await nearestCat(page);
-        if (cat) mouse = await aimAt(page, mouse, cat).catch(() => mouse);
-        return page
-          .getByTestId('fight-wave')
-          .getAttribute('data-wave', { timeout: 1000 })
-          .catch(() => null);
-      },
-      { timeout: 60_000, intervals: [50] }
-    )
-    .toBe('2');
-  await expect(page.getByTestId('fight-score')).toHaveText('Survived: 1');
-
-  await page.keyboard.press('Escape');
-  await expect(page.getByTestId('fight-area')).toHaveCount(0);
-  await expect(page.getByRole('status').filter({ hasText: 'Game over' })).toHaveText(
-    'Game over. You survived 1 wave. Best: 1.'
-  );
-  await expect(page.getByTestId('fight-best')).toHaveText('Best: 1 wave');
-  expect(await page.evaluate((key) => localStorage.getItem(key), SURVIVAL_BEST_KEY)).toBe('1');
-  await expect(page.getByTestId('fight-start')).toHaveText('Play again');
-});
-
-test('Survival: the gun fires by itself, from the ranger towards the crosshair', async ({
-  page,
-}) => {
-  await openFight(page);
-  await start(page);
-  const player = await placed(page, 'fight-player');
-  // Aim straight up from the ranger, before any cat arrives: beams leave upwards.
-  await aimAt(page, { x: 640, y: 400 }, { x: player.x, y: player.y - 200 });
-  await expect
-    .poll(async () => {
-      const beam = await placed(page, 'fight-beam').catch(() => null);
-      return beam !== null && Math.abs(beam.x - player.x) < 2 && beam.y < player.y - 40;
-    })
-    .toBe(true);
-});
-
-test('Survival: WASD walks the ranger, which faces the crosshair', async ({ page }) => {
-  await openFight(page);
-  await start(page);
-  const player = page.getByTestId('fight-player');
-  const before = await placed(page, 'fight-player');
-  await page.keyboard.down('d');
-  await expect(player).toHaveAttribute('data-walking', 'true');
-  await page.waitForTimeout(400);
-  await page.keyboard.up('d');
-  await expect(player).toHaveAttribute('data-walking', 'false');
-  const after = await placed(page, 'fight-player');
-  expect(after.x).toBeGreaterThan(before.x + 50);
-  expect(Math.abs(after.y - before.y)).toBeLessThan(1);
-
-  let mouse = { x: 640, y: 400 };
-  mouse = await aimAt(page, mouse, { x: after.x - 200, y: after.y });
-  await expect(player).toHaveAttribute('data-facing', 'w');
-  await aimAt(page, mouse, { x: after.x, y: after.y + 200 });
-  await expect(player).toHaveAttribute('data-facing', 's');
-});
-
-test('Survival: a cat pounces soon after it arrives, scrambling the ranger and the crosshair', async ({
-  page,
-}) => {
-  test.setTimeout(30_000);
-  await openFight(page);
-  await start(page);
-  // Aim at a corner, so the beams leave the cats alone.
-  await aimAt(page, { x: 640, y: 400 }, { x: 0, y: 0 });
-  // The first cat arrives after 1.5 s and pounces 1 to 3 s later. Its effect may be
-  // short (Knockback), so record every effect the page ever shows.
-  await page.evaluate(() => {
-    const seen = { player: false, crosshair: false };
-    (window as unknown as { scrambled: typeof seen }).scrambled = seen;
-    new MutationObserver(() => {
-      const effect = (id: string) =>
-        document.querySelector(`[data-testid="${id}"]`)?.getAttribute('data-effect');
-      if (effect('fight-player')) seen.player = true;
-      if (effect('fight-crosshair')) seen.crosshair = true;
-    }).observe(document.body, {
-      subtree: true,
-      attributes: true,
-      attributeFilter: ['data-effect'],
-    });
-  });
-  await expect(page.locator('[data-testid="fight-cat"][data-pounced="true"]').first()).toBeAttached(
-    { timeout: 10_000 }
-  );
-  await expect
-    .poll(() => page.evaluate(() => (window as unknown as { scrambled: object }).scrambled))
-    .toEqual({ player: true, crosshair: true });
-});
-
-test('Survival: a cat that touches the ranger costs a life', async ({ page }) => {
-  test.setTimeout(60_000);
-  await openFight(page);
-  await start(page);
-  // Aim at a corner and let the cats come.
-  await aimAt(page, { x: 640, y: 400 }, { x: 0, y: 0 });
-  await expect
-    .poll(async () => Number(await page.getByTestId('fight-lives').getAttribute('data-lives')), {
-      timeout: 40_000,
-      intervals: [50],
-    })
-    .toBeLessThan(3);
-});
-
-/** What the Taming game shows: the ranger, the treats, what it carries, cats tamed this game. */
 const tamingState = (page: Page) =>
   page.evaluate(() => {
     const ranger = document.querySelector<HTMLElement>('[data-testid="fight-player"]');
@@ -279,7 +100,7 @@ test('Taming: walk to a treat, carry it to the cat, and the cat is tamed into th
   page,
 }) => {
   test.setTimeout(90_000);
-  await openFight(page, undefined, { game: 'taming' });
+  await openFight(page);
   await expect(page.getByTestId('fight-tamed')).toHaveText('Tamed: 0 cats');
   await page.getByTestId('fight-start-taming').click();
   const area = page.getByTestId('fight-area');
@@ -324,7 +145,7 @@ test('Taming: without a treat the cat keeps away from the ranger, and attacks it
   page,
 }) => {
   test.setTimeout(90_000);
-  await openFight(page, undefined, { game: 'taming' });
+  await openFight(page);
   await page.getByTestId('fight-start-taming').click();
   await expect(page.getByTestId('fight-cat')).toBeVisible({ timeout: 5000 });
   // Read at one instant: the ranger, the cat and what it is doing, the effect on the
@@ -388,30 +209,16 @@ test('Taming: without a treat the cat keeps away from the ranger, and attacks it
   expect(attacked).toBe(true);
 });
 
-test('Survival: a lower score leaves the best score alone; End game stops it too', async ({
-  page,
-}) => {
-  await openFight(page, 7);
-  await expect(page.getByTestId('fight-best')).toHaveText('Best: 7 waves');
-  const overlay = await start(page);
-  await overlay.getByRole('button', { name: 'End game' }).click();
-  await expect(page.getByRole('status').filter({ hasText: 'Game over' })).toHaveText(
-    'Game over. You survived 0 waves. Best: 7.'
-  );
-  expect(await page.evaluate((key) => localStorage.getItem(key), SURVIVAL_BEST_KEY)).toBe('7');
-});
-
-test('Survival: losing focus pauses the game, and the cats wait; Resume carries on', async ({
+test('Taming: losing focus pauses the game, and the cat waits; Resume carries on', async ({
   page,
 }) => {
   test.setTimeout(30_000);
   await openFight(page);
   const overlay = await start(page);
   const cat = page.getByTestId('fight-cat').first();
-  await expect(cat).toBeVisible();
+  await expect(cat).toBeVisible({ timeout: 5000 });
   await page.evaluate(() => window.dispatchEvent(new Event('blur')));
   await expect(overlay).toHaveAttribute('data-phase', 'paused');
-  await expect(page.getByTestId('fight-player').locator('svg').first()).toBeVisible();
   const at = await cat.boundingBox();
   await page.waitForTimeout(600);
   expect(await cat.boundingBox()).toEqual(at);
@@ -435,89 +242,6 @@ test('Survival: losing focus pauses the game, and the cats wait; Resume carries
   await expect.poll(() => cat.boundingBox()).not.toEqual(at);
 });
 
-test('Survival under pointer lock: the mouse moves the crosshair, and losing the lock ends it', async ({
-  page,
-}) => {
-  test.setTimeout(30_000);
-  await openFight(page, undefined, { lock: true });
-  const startButton = page.getByTestId('fight-start');
-  const box = (await startButton.boundingBox())!;
-  const mouse = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
-  await page.mouse.move(mouse.x, mouse.y);
-  await startButton.click();
-  const overlay = page.getByTestId('fight-area');
-  await expect(overlay).toHaveAttribute('data-mode', /locked|fallback/);
-  // Some headless browsers refuse pointer lock (the game then takes the fallback
-  // path, tested above); there is nothing to test here then.
-  test.skip(
-    (await overlay.getAttribute('data-mode')) !== 'locked',
-    'This browser refused pointer lock.'
-  );
-  expect(await page.evaluate(() => document.pointerLockElement === document.body)).toBe(true);
-  // The page's fake cursor is hidden; the game draws the ranger and its crosshair.
-  await expect(page.getByTestId('fake-cursor')).toHaveCSS('opacity', '0');
-  await expect(page.getByTestId('fight-player').locator('svg').first()).toBeVisible();
-  await expect(page.getByTestId('fight-crosshair').locator('svg')).toBeVisible();
-
-  // The crosshair moves by the mouse's movement: under lock the browser reports only
-  // how far the mouse moved (movementX/Y), and the game adds that up. The movement
-  // is sent as the browser sends it, not made with page.mouse: under lock, headless
-  // Chrome on Linux (CI) reports each simulated move as a jump to the pointer's
-  // position on the page and straight back, which adds up to no movement at all.
-  // A cat pounces on the crosshair from 2.5 s into the game, and its effect moves
-  // it too (Axis lock holds one axis, Drift pushes it, ...): so the movement is
-  // measured only while no effect runs on it, and measured again if one began.
-  const crosshair = page.getByTestId('fight-crosshair');
-  const calm = async () => ((await crosshair.getAttribute('data-effect')) ?? '') === '';
-  let way = 1;
-  await expect
-    .poll(
-      async () => {
-        if (!(await calm())) return false;
-        const before = await placed(page, 'fight-crosshair');
-        // Back and forth, so the crosshair stays clear of the edges however often.
-        const step = { x: 60 * way, y: -40 * way };
-        way = -way;
-        await page.evaluate(
-          ({ x, y }) =>
-            document.dispatchEvent(
-              new MouseEvent('mousemove', { movementX: x, movementY: y, bubbles: true })
-            ),
-          step
-        );
-        // Let the game draw the move.
-        await page.evaluate(
-          () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
-        );
-        const after = await placed(page, 'fight-crosshair');
-        if (!(await calm())) return false;
-        // Within half a pixel: the positions are read back from decimal strings.
-        return (
-          Math.abs(after.x - (before.x + step.x)) < 0.5 &&
-          Math.abs(after.y - (before.y + step.y)) < 0.5
-        );
-      },
-      { timeout: 20_000, intervals: [100] }
-    )
-    .toBe(true);
-
-  // Losing the lock ends the game if the page still has focus (that is Esc) and
-  // pauses it if not (another window took it). Some headless browsers never give a
-  // page focus, so the test checks whichever this browser reports.
-  const focused = await page.evaluate(() => document.hasFocus());
-  await page.evaluate(() => document.exitPointerLock());
-  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
-  if (focused) {
-    await expect(page.getByTestId('fight-area')).toHaveCount(0);
-    await expect(page.getByRole('status').filter({ hasText: 'Game over' })).toContainText(
-      'Game over. You survived'
-    );
-  } else {
-    await expect(overlay).toHaveAttribute('data-phase', 'paused');
-    await expect(overlay.getByRole('button', { name: 'Resume' })).toBeVisible();
-  }
-});
-
 test('/cats links to both games, each on a page of its own', async ({ page }) => {
   await page.setViewportSize({ width: 1280, height: 800 });
   await page.goto('/cats');
@@ -525,7 +249,7 @@ test('/cats links to both games, each on a page of its own', async ({ page }) =>
   await page.getByRole('link', { name: 'Play Survival' }).click();
   await expect(page).toHaveURL(/\/cats\/survival$/);
   await expect(page.getByRole('heading', { level: 1, name: 'Survival' })).toBeVisible();
-  await expect(page.getByTestId('fight-start')).toBeVisible();
+  await expect(page.getByTestId('survival-start')).toBeVisible();
   await page.goto('/cats');
   await page.getByRole('link', { name: 'Play Taming' }).click();
   await expect(page).toHaveURL(/\/cats\/taming$/);
@@ -533,14 +257,14 @@ test('/cats links to both games, each on a page of its own', async ({ page }) =>
   await expect(page.getByTestId('fight-start-taming')).toBeVisible();
 });
 
-test('Survival: leaving the page mid-game ends the game and releases the pointer lock', async ({
+test('Taming: leaving the page mid-game ends the game and releases the pointer lock', async ({
   page,
 }) => {
   test.setTimeout(30_000);
   await page.setViewportSize({ width: 1280, height: 800 });
   await page.goto('/cats');
-  await page.getByRole('link', { name: 'Play Survival' }).click();
-  await expect(page.getByRole('heading', { level: 1, name: 'Survival' })).toBeVisible();
+  await page.getByRole('link', { name: 'Play Taming' }).click();
+  await expect(page.getByRole('heading', { level: 1, name: 'Taming' })).toBeVisible();
   let nudge = 0;
   await expect
     .poll(async () => {
@@ -548,7 +272,7 @@ test('Survival: leaving the page mid-game ends the game and releases the pointer
       return page.locator('html').getAttribute('class');
     })
     .toContain('xenocat-cursor-hidden');
-  await page.getByTestId('fight-start').click();
+  await page.getByTestId('fight-start-taming').click();
   const area = page.getByTestId('fight-area');
   // Some headless browsers refuse pointer lock; then the game runs on the fallback.
   await expect(area).toHaveAttribute('data-mode', /locked|fallback/);
@@ -567,14 +291,6 @@ test.describe('on a touch screen', () => {
   const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 7'];
   test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });
 
-  test('/cats/survival says the game needs a keyboard and mouse', async ({ page }) => {
-    await page.goto('/cats/survival');
-    await expect(page.getByTestId('fight-needs-keyboard')).toHaveText(
-      'This game needs a keyboard and mouse, for now. Come back on a computer to play it.'
-    );
-    await expect(page.getByTestId('fight-start')).toHaveCount(0);
-  });
-
   test('/cats/taming is played with the movement pad: a treat carried to the cat tames it', async ({
     page,
   }) => {
diff --git a/tests/e2e/survival.spec.ts b/tests/e2e/survival.spec.ts
new file mode 100644
index 0000000..e48627f
--- /dev/null
+++ b/tests/e2e/survival.spec.ts
@@ -0,0 +1,145 @@
+import { type Page, devices, expect, test } from '@playwright/test';
+import { SURVIVAL_BEST_KEY } from '@/app/ui/xenocats/arena-storage';
+
+// Survival, the arena, on /cats/survival (no login, no database). The canvas cannot
+// be read, so the tests read the run's state from the play area's data- attributes
+// and the HUD's text. `?seed=` fixes the run; `?speed=` makes time pass faster.
+
+const area = (page: Page) => page.getByTestId('survival-area');
+const num = async (page: Page, name: string) => Number(await area(page).getAttribute(name));
+
+async function openArena(page: Page, query = '?seed=7') {
+  await page.goto('/cats/survival' + query);
+  await expect(page.getByRole('heading', { level: 1, name: 'Survival' })).toBeVisible();
+}
+
+/** Starts a run; a click before hydration is lost, so click until it starts. */
+async function startRun(page: Page, tap = false) {
+  await expect
+    .poll(async () => {
+      if ((await area(page).count()) === 0) {
+        const button = page.getByTestId('survival-start');
+        if (tap) await button.tap();
+        else await button.click();
+      }
+      return area(page).count();
+    })
+    .toBe(1);
+  await expect(area(page)).toHaveAttribute('data-screen', 'playing');
+}
+
+test.describe('on a computer', () => {
+  test.use({ viewport: { width: 1280, height: 800 } });
+
+  test('a run: time passes, the Laser Pointer sends cats home, Esc pauses, giving up shows the results and keeps the best time', async ({
+    page,
+  }) => {
+    test.setTimeout(60_000);
+    await openArena(page, '?seed=7&speed=3');
+    await expect(page.getByTestId('survival-best')).toHaveText('Longest survived: none yet');
+    // No ambient cats and no fake cursor on the game's page.
+    await expect(page.getByTestId('xenocat')).toHaveCount(0);
+    await startRun(page);
+    await expect(area(page)).toHaveAttribute('data-weapons', 'laser-pointer');
+    expect(await page.locator('html').getAttribute('class')).not.toContain('xenocat-cursor-hidden');
+    // The canvas is hidden from assistive technology; the HUD is text.
+    await expect(page.locator('canvas')).toHaveAttribute('aria-hidden', 'true');
+    await expect(page.getByTestId('survival-time')).toContainText('/ 5:00');
+
+    // Cats come, and the laser sends them home on its own.
+    await expect.poll(() => num(page, 'data-time'), { timeout: 10_000 }).toBeGreaterThan(2000);
+    await expect.poll(() => num(page, 'data-cats'), { timeout: 10_000 }).toBeGreaterThan(0);
+    await expect.poll(() => num(page, 'data-sent-home'), { timeout: 30_000 }).toBeGreaterThan(0);
+    await expect(page.getByTestId('survival-sent-home')).not.toHaveText('Cats sent home: 0');
+
+    // Esc pauses: a dialog, focus on Resume, and time stands still.
+    await page.keyboard.press('Escape');
+    const paused = page.getByRole('dialog', { name: 'Paused' });
+    await expect(paused).toBeVisible();
+    await expect(paused.getByRole('button', { name: 'Resume' })).toBeFocused();
+    const stopped = await num(page, 'data-time');
+    await page.waitForTimeout(600);
+    expect(await num(page, 'data-time')).toBe(stopped);
+    await paused.getByRole('button', { name: 'Resume' }).click();
+    await expect.poll(() => num(page, 'data-time')).toBeGreaterThan(stopped);
+
+    // Giving up ends the run: the results, and the best time kept.
+    await page.keyboard.press('Escape');
+    await page
+      .getByRole('dialog', { name: 'Paused' })
+      .getByRole('button', { name: 'Give up' })
+      .click();
+    const results = page.getByTestId('survival-results');
+    await expect(results).toHaveAttribute('data-outcome', 'gave-up');
+    await expect(results.getByRole('heading', { name: 'The run is over' })).toBeVisible();
+    await expect(page.getByTestId('survival-result-time')).toHaveText(/^\d:\d\d$/);
+    expect(
+      Number(await page.getByTestId('survival-result-sent-home').textContent())
+    ).toBeGreaterThan(0);
+    await expect(results.getByRole('button', { name: 'Play again' })).toBeFocused();
+    await expect(area(page)).toHaveCount(0);
+    const stored = Number(
+      await page.evaluate((key) => localStorage.getItem(key), SURVIVAL_BEST_KEY)
+    );
+    expect(stored).toBeGreaterThan(0);
+    await page.reload();
+    await expect(page.getByTestId('survival-best')).toHaveAttribute('data-best', String(stored));
+    await expect(page.getByTestId('survival-best')).not.toHaveText('Longest survived: none yet');
+  });
+
+  test('WASD walks the hero', async ({ page }) => {
+    await openArena(page);
+    await startRun(page);
+    await expect.poll(() => num(page, 'data-time')).toBeGreaterThan(300);
+    const x0 = await num(page, 'data-hero-x');
+    await page.keyboard.down('d');
+    await expect.poll(() => num(page, 'data-hero-x')).toBeGreaterThan(x0 + 60);
+    await page.keyboard.up('d');
+    const x1 = await num(page, 'data-hero-x');
+    await page.keyboard.down('ArrowLeft');
+    await expect.poll(() => num(page, 'data-hero-x')).toBeLessThan(x1 - 60);
+    await page.keyboard.up('ArrowLeft');
+  });
+
+  test('losing focus pauses the run', async ({ page }) => {
+    await openArena(page);
+    await startRun(page);
+    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
+    await expect(area(page)).toHaveAttribute('data-screen', 'paused');
+    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
+  });
+});
+
+test.describe('on a touch screen', () => {
+  // A phone's screen and touch input (its browser type cannot change inside a group).
+  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 7'];
+  test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });
+
+  test('the movement pad walks the hero, the laser sends cats home, and Pause leads to giving up', async ({
+    page,
+  }) => {
+    test.setTimeout(60_000);
+    await openArena(page, '?seed=7&speed=3');
+    await startRun(page, true);
+    const pad = page.getByTestId('movement-pad');
+    await expect(pad).toBeVisible();
+    const box = (await pad.boundingBox())!;
+    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
+    const x0 = await num(page, 'data-hero-x');
+    // A thumb on the pad, pushed to the right, then lifted.
+    const cdp = await page.context().newCDPSession(page);
+    await cdp.send('Input.dispatchTouchEvent', {
+      type: 'touchStart',
+      touchPoints: [{ x: centre.x + 50, y: centre.y }],
+    });
+    await expect.poll(() => num(page, 'data-hero-x')).toBeGreaterThan(x0 + 60);
+    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
+    await expect.poll(() => num(page, 'data-sent-home'), { timeout: 30_000 }).toBeGreaterThan(0);
+    await area(page).getByRole('button', { name: 'Pause' }).tap();
+    await page
+      .getByRole('dialog', { name: 'Paused' })
+      .getByRole('button', { name: 'Give up' })
+      .tap();
+    await expect(page.getByTestId('survival-results')).toHaveAttribute('data-outcome', 'gave-up');
+  });
+});
diff --git a/tests/unit/affected-tests.test.ts b/tests/unit/affected-tests.test.ts
index 0373c1d..0240e3b 100644
--- a/tests/unit/affected-tests.test.ts
+++ b/tests/unit/affected-tests.test.ts
@@ -21,6 +21,8 @@ describe('affected-tests', () => {
       '/dashboard',
     ]);
     expect(specAreas(`page.goto('/')`, areas)).toEqual(['/']);
+    // A page under an area counts for it (the games are pages of /cats).
+    expect(specAreas(`await page.goto('/cats/survival' + query);`, areas)).toEqual(['/cats']);
     // An asset path is not a route.
     expect(specAreas(`'/xenocats/cats/tabby.png'`, areas)).toEqual([]);
   });
diff --git a/tests/unit/xenocats/arena.test.ts b/tests/unit/xenocats/arena.test.ts
new file mode 100644
index 0000000..967b844
--- /dev/null
+++ b/tests/unit/xenocats/arena.test.ts
@@ -0,0 +1,426 @@
+import { describe, expect, it } from 'vitest';
+import {
+  ARENA_CONFIG,
+  type ArenaConfig,
+  HERO_EFFECTS,
+  catsWanted,
+  createArena,
+} from '@/app/ui/xenocats/arena';
+import { createArenaGrid } from '@/app/ui/xenocats/arena-grid';
+import { bestOf, clockText, parseBest } from '@/app/ui/xenocats/arena-storage';
+import { CAT_TYPES, catTypeById } from '@/app/ui/xenocats/cat-types';
+import { createFrameGuard } from '@/app/ui/xenocats/frame-guard';
+import { createRandom } from '@/app/ui/xenocats/random';
+
+const viewport = { width: 1280, height: 800 };
+const still = { x: 0, y: 0 };
+
+function arena(config: Partial<ArenaConfig> = {}, seed = 1, types = CAT_TYPES) {
+  return createArena({ random: createRandom(seed), types, viewport, config });
+}
+
+/** Steps until `ms` of game time, the hero walking `input`. */
+function runTo(a: ReturnType<typeof arena>, ms: number, input = still, spawn = true) {
+  while (a.state().time < ms && a.state().status === 'playing') a.step(input, spawn);
+}
+
+/** A hero nothing can wear down, for watching the arena itself. */
+const unbreakable = { hero: { ...ARENA_CONFIG.hero, resolve: 1e12 } };
+
+describe('the hero', () => {
+  it('walks the way he is told, at his speed, and faces it', () => {
+    const a = arena({ escalation: [[0, 0]] });
+    runTo(a, 1000, { x: 1, y: 0 });
+    expect(a.state().hero.x).toBeCloseTo(ARENA_CONFIG.hero.speed, -1);
+    expect(a.state().hero.y).toBe(0);
+    runTo(a, 1500, { x: -1, y: 0 });
+    expect(a.state().hero.facing).toBe(-1);
+  });
+
+  it('a cat that reaches him drains his Resolve, then he is untouchable for a moment', () => {
+    // One kind of cat, made slow and hard to send home, coming at a hero who stands.
+    const a = arena({
+      escalation: [[0, 1]],
+      cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [1e9, 1e9] },
+    });
+    let hits: number[] = [];
+    for (let i = 0; i < 60 * 30 && hits.length < 3; i++) {
+      a.step(still);
+      for (const e of a.drainEvents()) if (e.kind === 'hero-hit') hits = [...hits, a.state().time];
+    }
+    expect(hits.length).toBe(3);
+    expect(a.state().hero.resolve).toBeLessThan(ARENA_CONFIG.hero.resolve);
+    for (let i = 1; i < hits.length; i++) {
+      expect(hits[i] - hits[i - 1]).toBeGreaterThanOrEqual(ARENA_CONFIG.hero.untouchableMs);
+    }
+  });
+
+  it('each type drains its own amount', () => {
+    const drained = new Set<number>();
+    for (const type of CAT_TYPES.slice(0, 6)) {
+      // One cat of the type, never sent home: what its first touch takes.
+      const a = arena(
+        {
+          escalation: [[0, 1]],
+          cats: { ...ARENA_CONFIG.cats, eliteShare: 0 },
+          laser: { ...ARENA_CONFIG.laser, cooldownMs: 1e12 },
+        },
+        1,
+        [type]
+      );
+      while (a.state().time < 60_000 && !a.drainEvents().some((e) => e.kind === 'hero-hit')) {
+        a.step(still);
+      }
+      drained.add(ARENA_CONFIG.hero.resolve - a.state().hero.resolve);
+    }
+    expect(drained.size).toBeGreaterThan(1);
+  });
+
+  it('his Resolve spent, the run is over', () => {
+    const a = arena({ hero: { ...ARENA_CONFIG.hero, resolve: 5 }, escalation: [[0, 30]] });
+    runTo(a, 120_000);
+    expect(a.state().status).toBe('over');
+    expect(a.state().outcome).toBe('spent');
+    expect(a.drainEvents().some((e) => e.kind === 'over')).toBe(true);
+  });
+
+  it('giving up ends the run where it stands', () => {
+    const a = arena();
+    runTo(a, 2000);
+    a.giveUp();
+    expect(a.state()).toMatchObject({ status: 'over', outcome: 'gave-up', time: a.state().time });
+    const time = a.state().time;
+    a.step(still);
+    expect(a.state().time).toBe(time);
+  });
+});
+
+describe('elites', () => {
+  it('every xenocat effect has a way of landing on the hero', () => {
+    for (const type of CAT_TYPES) expect(HERO_EFFECTS[type.effect.id], type.id).toBeDefined();
+  });
+
+  /** A hero reached by elites of one type only; his state just after the first hit. */
+  function afterElite(typeId: string, input = { x: 1, y: 0 }) {
+    const a = arena(
+      {
+        escalation: [[0, 1]],
+        cats: { ...ARENA_CONFIG.cats, eliteShare: 1, homesickness: [1e9, 1e9] },
+        laser: { ...ARENA_CONFIG.laser, cooldownMs: 1e9 },
+      },
+      1,
+      [catTypeById(typeId)!]
+    );
+    for (let i = 0; i < 60 * 30; i++) {
+      a.step(still);
+      if (a.drainEvents().some((e) => e.kind === 'hero-hit')) break;
+    }
+    const before = { ...a.state().hero };
+    for (let i = 0; i < 30; i++) a.step(input);
+    return { before, after: a.state().hero };
+  }
+
+  it('Cryo freezes him, Gravi slows him, Mirror turns his controls round', () => {
+    const frozen = afterElite('cryo-persian');
+    expect(frozen.after.effect).toBe('freeze');
+    expect(frozen.after.x).toBeCloseTo(frozen.before.x, 5);
+    const slowed = afterElite('gravi-coon');
+    expect(slowed.after.effect).toBe('slow');
+    expect(slowed.after.x - slowed.before.x).toBeLessThan(ARENA_CONFIG.hero.speed * 0.5 * 0.4);
+    const reversed = afterElite('mirror-sphynx');
+    expect(reversed.after.x).toBeLessThan(reversed.before.x);
+  });
+
+  it('one effect at a time: another elite reaching him meanwhile changes nothing', () => {
+    // Elites of two kinds, reaching him again and again (untouchable only briefly).
+    const a = arena(
+      {
+        escalation: [[0, 30]],
+        cats: { ...ARENA_CONFIG.cats, eliteShare: 1, homesickness: [1e9, 1e9] },
+        hero: { ...ARENA_CONFIG.hero, resolve: 1e9, untouchableMs: 100 },
+        laser: { ...ARENA_CONFIG.laser, cooldownMs: 1e12 },
+      },
+      3,
+      [catTypeById('cryo-persian')!, catTypeById('gravi-coon')!]
+    );
+    let current: string | null = null;
+    let since = 0;
+    let effects = 0;
+    let hitsDuringEffect = 0;
+    for (let i = 0; i < 60 * 40; i++) {
+      a.step(still);
+      const time = a.state().time;
+      const hit = a.drainEvents().some((e) => e.kind === 'hero-hit');
+      const effect = a.state().hero.effect;
+      // While one may still last it stays the one, whoever else reaches him; once
+      // it has run its course another may follow at once.
+      const mayHaveEnded = time - since >= ARENA_CONFIG.cats.effectMaxMs;
+      if (current !== null && effect !== null && !mayHaveEnded) {
+        expect(effect).toBe(current);
+        if (hit) hitsDuringEffect++;
+      }
+      if (effect !== null && (current === null || (effect !== current && mayHaveEnded))) {
+        effects++;
+        since = time;
+      }
+      current = effect;
+    }
+    expect(effects).toBeGreaterThan(1);
+    expect(hitsDuringEffect).toBeGreaterThan(0);
+  });
+
+  it('plain cats lay none', () => {
+    const a = arena({
+      escalation: [[0, 40]],
+      cats: { ...ARENA_CONFIG.cats, eliteShare: 0 },
+      hero: { ...ARENA_CONFIG.hero, resolve: 1e9 },
+    });
+    for (let i = 0; i < 60 * 20; i++) {
+      a.step(still);
+      expect(a.state().hero.effect).toBeNull();
+    }
+  });
+});
+
+describe('the horde', () => {
+  it('cats appear just off screen, all round, and walk at the hero', () => {
+    const a = arena({ ...unbreakable, escalation: [[0, 40]] });
+    a.step(still);
+    runTo(a, 3000);
+    const half = Math.hypot(viewport.width, viewport.height) / 2;
+    const cats = a.cats();
+    expect(cats.length).toBeGreaterThan(5);
+    const sides = new Set(
+      cats.map((c) => `${Math.sign(Math.round(c.x))}${Math.sign(Math.round(c.y))}`)
+    );
+    expect(sides.size).toBeGreaterThanOrEqual(3);
+    const distances = cats.map((c) => Math.hypot(c.x, c.y));
+    expect(Math.max(...distances)).toBeLessThanOrEqual(half + ARENA_CONFIG.cats.spawnMargin + 1);
+    const before = cats.map((c) => Math.hypot(c.x, c.y));
+    const ids = cats.map((c) => c.id);
+    a.step(still);
+    const after = a.cats();
+    for (let i = 0; i < ids.length; i++) {
+      const cat = after.find((c) => c.id === ids[i]);
+      if (cat) expect(Math.hypot(cat.x, cat.y)).toBeLessThanOrEqual(before[i]);
+    }
+  });
+
+  it('escalates on time: a few at first, dozens by a minute, hundreds by two and a half, thousands by four', () => {
+    expect(catsWanted(0)).toBe(3);
+    // A seeded run, the laser kept quiet so the count shows the arrivals alone.
+    const a = arena({
+      ...unbreakable,
+      stepMs: 50,
+      laser: { ...ARENA_CONFIG.laser, cooldownMs: 1e12 },
+    });
+    const at = (ms: number) => {
+      runTo(a, ms);
+      return a.state().cats;
+    };
+    const first = at(20_000);
+    expect(first).toBeGreaterThanOrEqual(2);
+    expect(first).toBeLessThanOrEqual(10);
+    expect(at(60_000)).toBeGreaterThanOrEqual(24);
+    expect(at(150_000)).toBeGreaterThanOrEqual(200);
+    expect(at(240_000)).toBeGreaterThanOrEqual(1000);
+  });
+
+  it('while the frame-rate guard says no, only the first few cats come; more when it says yes', () => {
+    const free = ARENA_CONFIG.cats.guardFree;
+    const a = arena({
+      ...unbreakable,
+      escalation: [[0, 400]],
+      laser: { ...ARENA_CONFIG.laser, cooldownMs: 1e12 },
+    });
+    runTo(a, 20_000, still, false);
+    // Even a screen too slow from the start gets a game...
+    expect(a.state().cats).toBe(free);
+    // ...and no more than that until the guard allows it.
+    runTo(a, 25_000, still, true);
+    expect(a.state().cats).toBeGreaterThan(free);
+  });
+});
+
+describe('the Laser Pointer', () => {
+  it('points at the nearest cat; enough homesickness sends a cat home', () => {
+    const a = arena({
+      ...unbreakable,
+      escalation: [[0, 6]],
+      cats: { ...ARENA_CONFIG.cats, eliteShare: 0 },
+    });
+    let lasers = 0;
+    let home = 0;
+    runTo(a, 1);
+    while (a.state().time < 40_000) {
+      a.step(still);
+      for (const e of a.drainEvents()) {
+        if (e.kind === 'laser') lasers++;
+        if (e.kind === 'sent-home') home++;
+      }
+    }
+    expect(lasers).toBeGreaterThan(5);
+    expect(home).toBeGreaterThan(0);
+    expect(a.state().sentHome).toBe(home);
+    expect(a.state().weapons).toEqual(['laser-pointer']);
+  });
+
+  it('fires no more often than its cooldown, and not at a cat out of range', () => {
+    const a = arena({ ...unbreakable, escalation: [[0, 0]] });
+    runTo(a, 10_000);
+    expect(a.drainEvents().filter((e) => e.kind === 'laser')).toEqual([]);
+    const b = arena({ ...unbreakable, escalation: [[0, 30]] });
+    const times: number[] = [];
+    while (b.state().time < 20_000) {
+      b.step(still);
+      for (const e of b.drainEvents()) if (e.kind === 'laser') times.push(b.state().time);
+    }
+    for (let i = 1; i < times.length; i++) {
+      expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(ARENA_CONFIG.laser.cooldownMs - 1);
+    }
+  });
+});
+
+describe('the laser, with a cat right on the Keeper', () => {
+  it('points the way he faces, and touches nothing behind him', () => {
+    // Cats from every side reach him before the laser first fires (at 20 s).
+    const a = arena({
+      ...unbreakable,
+      escalation: [[0, 30]],
+      cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [1e9, 1e9] },
+      laser: { ...ARENA_CONFIG.laser, cooldownMs: 40_000 },
+    });
+    let beam: { from: { x: number; y: number }; to: { x: number; y: number } } | null = null;
+    while (!beam && a.state().time < 30_000) {
+      a.step(still);
+      for (const e of a.drainEvents()) if (e.kind === 'laser') beam = e;
+    }
+    expect(beam).not.toBeNull();
+    const cats = a.cats();
+    expect(cats.some((c) => Math.hypot(c.x, c.y) < 0.5)).toBe(true);
+    const ux = beam!.to.x - beam!.from.x;
+    const uy = beam!.to.y - beam!.from.y;
+    const touched = cats.filter((c) => c.homesickness > 0);
+    const behind = cats.filter((c) => c.x * ux + c.y * uy < -1);
+    expect(behind.length).toBeGreaterThan(0);
+    for (const cat of touched) expect(cat.x * ux + cat.y * uy).toBeGreaterThanOrEqual(-0.5);
+    // The cat on him is the one aimed at: it is touched too.
+    for (const cat of cats.filter((c) => Math.hypot(c.x, c.y) < 0.5)) {
+      expect(cat.homesickness).toBeGreaterThan(0);
+    }
+    expect(touched.length).toBeLessThan(cats.length);
+  });
+});
+
+describe('the time goal', () => {
+  it('at five minutes the Matriarch comes, and ends the run when she reaches him', () => {
+    const a = arena({ ...unbreakable, stepMs: 50, escalation: [[0, 0]] });
+    const seen: string[] = [];
+    while (a.state().status === 'playing' && a.state().time < 320_000) {
+      a.step(still);
+      for (const e of a.drainEvents()) seen.push(e.kind);
+    }
+    expect(a.state().time).toBeGreaterThanOrEqual(ARENA_CONFIG.timeGoalMs);
+    expect(seen).toContain('matriarch');
+    expect(a.state().outcome).toBe('goal');
+  });
+
+  it('his Resolve spent after the time goal still counts as the goal reached', () => {
+    // No cat until five minutes, then a crowd; the Matriarch never arrives.
+    const a = arena({
+      stepMs: 50,
+      escalation: [
+        [0, 0],
+        [ARENA_CONFIG.timeGoalMs, 0],
+        [ARENA_CONFIG.timeGoalMs + 1, 60],
+      ],
+      matriarch: { ...ARENA_CONFIG.matriarch, speed: 0 },
+      hero: { ...ARENA_CONFIG.hero, resolve: 10 },
+      laser: { ...ARENA_CONFIG.laser, cooldownMs: 1e12 },
+    });
+    runTo(a, ARENA_CONFIG.timeGoalMs + 120_000);
+    expect(a.state().status).toBe('over');
+    expect(a.state().hero.resolve).toBe(0);
+    expect(a.state().time).toBeGreaterThan(ARENA_CONFIG.timeGoalMs);
+    expect(a.state().outcome).toBe('goal');
+  });
+
+  it('nothing sends the Matriarch home: she is not a cat the laser can touch', () => {
+    const a = arena({ ...unbreakable, stepMs: 50, escalation: [[0, 0]] });
+    runTo(a, ARENA_CONFIG.timeGoalMs + 50);
+    expect(a.matriarch()).not.toBeNull();
+    expect(a.cats().length).toBe(0);
+  });
+});
+
+describe('a seeded run', () => {
+  it('plays out the same every time', () => {
+    const play = () => {
+      const a = arena({}, 42);
+      runTo(a, 60_000, { x: 0.6, y: 0.8 });
+      const s = a.state();
+      return [s.time, s.cats, s.sentHome, s.hero.resolve, Math.round(s.hero.x)];
+    };
+    expect(play()).toEqual(play());
+  });
+});
+
+describe('the spatial grid', () => {
+  it('finds every point within the radius, as checking them all would', () => {
+    const random = createRandom(9);
+    const points = Array.from({ length: 500 }, () => ({
+      x: random.range(-1000, 1000),
+      y: random.range(-1000, 1000),
+    }));
+    const grid = createArenaGrid(64);
+    points.forEach((p, i) => grid.insert(i, p.x, p.y));
+    const out: number[] = [];
+    for (let q = 0; q < 50; q++) {
+      const at = { x: random.range(-1000, 1000), y: random.range(-1000, 1000) };
+      const radius = random.range(10, 300);
+      const found = grid
+        .query(at.x, at.y, radius, out)
+        .filter((i) => Math.hypot(points[i].x - at.x, points[i].y - at.y) <= radius)
+        .sort((a, b) => a - b);
+      const brute = points
+        .map((p, i) => ({ p, i }))
+        .filter(({ p }) => Math.hypot(p.x - at.x, p.y - at.y) <= radius)
+        .map(({ i }) => i);
+      expect(found).toEqual(brute);
+    }
+    grid.clear();
+    expect(grid.query(0, 0, 2000, out)).toEqual([]);
+  });
+});
+
+describe('the frame-rate guard', () => {
+  it('stops cats coming below the floor, and lets them come again above the resume mark', () => {
+    const guard = createFrameGuard({ floorFps: 40, resumeFps: 50, smoothing: 0.5 });
+    expect(guard.allowsSpawning()).toBe(true);
+    for (let i = 0; i < 20; i++) guard.record(1000 / 60);
+    expect(guard.allowsSpawning()).toBe(true);
+    for (let i = 0; i < 20; i++) guard.record(1000 / 30);
+    expect(guard.allowsSpawning()).toBe(false);
+    // Between the two marks: still no.
+    for (let i = 0; i < 20; i++) guard.record(1000 / 45);
+    expect(guard.allowsSpawning()).toBe(false);
+    for (let i = 0; i < 20; i++) guard.record(1000 / 60);
+    expect(guard.allowsSpawning()).toBe(true);
+    expect(guard.fps()).toBeGreaterThan(55);
+  });
+});
+
+describe('the best time', () => {
+  it('keeps the longer run, and reads anything unreadable as none', () => {
+    expect(bestOf(null, 61_000)).toBe(61_000);
+    expect(bestOf(90_000, 61_000)).toBe(90_000);
+    expect(parseBest(null)).toBeNull();
+    expect(parseBest('not a number')).toBeNull();
+    expect(parseBest('-5')).toBeNull();
+    expect(parseBest('1e99')).toBeNull();
+    expect(parseBest('123456')).toBe(123456);
+    expect(clockText(0)).toBe('0:00');
+    expect(clockText(65_400)).toBe('1:05');
+    expect(clockText(300_000)).toBe('5:00');
+  });
+});
diff --git a/tests/unit/xenocats/gun.test.ts b/tests/unit/xenocats/gun.test.ts
deleted file mode 100644
index 6ebebfb..0000000
--- a/tests/unit/xenocats/gun.test.ts
+++ /dev/null
@@ -1,103 +0,0 @@
-import { describe, expect, it } from 'vitest';
-import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
-import { type CursorLook, restingLook } from '@/app/ui/xenocats/effects';
-import {
-  BOUNCE_TIMES,
-  FALL_GRAVITY,
-  HEAVY_RELOAD,
-  HEAVY_SPEED,
-  JAMMING,
-  SPREAD,
-  shotFor,
-} from '@/app/ui/xenocats/gun';
-import { createRandom } from '@/app/ui/xenocats/random';
-import { NORMAL_SHOT } from '@/app/ui/xenocats/survival';
-
-const ranger: CursorLook = restingLook({ x: 600, y: 400 });
-const aim = { x: 800, y: 400 };
-const random = () => createRandom(7);
-const angle = (shot: { from: { x: number; y: number }; to: { x: number; y: number } }) =>
-  Math.atan2(shot.to.y - shot.from.y, shot.to.x - shot.from.x);
-
-describe('the gun under a cat’s attack', () => {
-  it('fires a normal beam from the ranger at the aim when nothing runs', () => {
-    expect(shotFor(null, ranger, aim, random())).toEqual({
-      from: { x: 600, y: 400 },
-      to: aim,
-      style: { ...NORMAL_SHOT, tint: undefined },
-    });
-  });
-
-  it('every cat’s attack leaves the gun firing, unless it jams it', () => {
-    for (const type of CAT_TYPES) {
-      const shot = shotFor(type.effect.id, ranger, aim, random());
-      if (JAMMING.has(type.effect.id)) expect(shot).toBeNull();
-      else expect(shot).not.toBeNull();
-    }
-    expect(JAMMING.has('freeze')).toBe(true);
-  });
-
-  it('beams take on the ranger’s size, within limits, and its look', () => {
-    const tiny = shotFor('tiny', { ...ranger, scale: 0.25 }, aim, random())!;
-    expect(tiny.style.scale).toBe(0.25);
-    const giant = shotFor('giant', { ...ranger, scale: 4 }, aim, random())!;
-    expect(giant.style.scale).toBe(2);
-    const vanished = shotFor('vanish', { ...ranger, visible: false }, aim, random())!;
-    expect(vanished.style.opacity).toBe(0);
-    const blurred = shotFor('blur', { ...ranger, blur: 4, opacity: 0.5 }, aim, random())!;
-    expect(blurred.style).toMatchObject({ blur: 4, opacity: 0.5 });
-    const iced = shotFor(null, { ...ranger, tint: '#7dd3fc' }, aim, random())!;
-    expect(iced.style.tint).toBe('#7dd3fc');
-  });
-
-  it('heavy reloads slowly and fires slow beams', () => {
-    const shot = shotFor('heavy', ranger, aim, random())!;
-    expect(shot.style.reload).toBe(HEAVY_RELOAD);
-    expect(shot.style.speed).toBe(HEAVY_SPEED);
-  });
-
-  it('reverse fires the other way', () => {
-    const shot = shotFor('reverse', ranger, aim, random())!;
-    expect(shot.to).toEqual({ x: 400, y: 400 });
-  });
-
-  it('jitter and drunk throw the shot off the aim, within their spread', () => {
-    for (const id of ['jitter', 'drunk']) {
-      const r = random();
-      let off = 0;
-      for (let i = 0; i < 50; i++) {
-        const shot = shotFor(id, ranger, aim, r)!;
-        expect(Math.abs(angle(shot))).toBeLessThanOrEqual(SPREAD[id] + 1e-9);
-        off = Math.max(off, Math.abs(angle(shot)));
-      }
-      expect(off).toBeGreaterThan(0.05);
-    }
-  });
-
-  it('decoys fire from any of the rangers, along the same line', () => {
-    const decoys = [
-      { x: 100, y: 100 },
-      { x: 900, y: 700 },
-    ];
-    const r = random();
-    const froms = new Set<string>();
-    for (let i = 0; i < 40; i++) {
-      const shot = shotFor('decoys', { ...ranger, decoys }, aim, r)!;
-      froms.add(`${shot.from.x},${shot.from.y}`);
-      expect(angle(shot)).toBeCloseTo(0);
-    }
-    expect(froms).toEqual(new Set(['600,400', '100,100', '900,700']));
-  });
-
-  it('fall drops the beams, bounce bounces them', () => {
-    expect(shotFor('fall', ranger, aim, random())!.style.gravity).toBe(FALL_GRAVITY);
-    expect(shotFor('bounce', ranger, aim, random())!.style.bounces).toBe(BOUNCE_TIMES);
-  });
-
-  it('axis lock fires straight sideways or straight up and down', () => {
-    const sideways = shotFor('axis-lock', ranger, { x: 800, y: 450 }, random())!;
-    expect(sideways.to).toEqual({ x: 800, y: 400 });
-    const upright = shotFor('axis-lock', ranger, { x: 650, y: 100 }, random())!;
-    expect(upright.to).toEqual({ x: 600, y: 100 });
-  });
-});
diff --git a/tests/unit/xenocats/movement-pad.test.ts b/tests/unit/xenocats/movement-pad.test.ts
index 552405b..acf75b7 100644
--- a/tests/unit/xenocats/movement-pad.test.ts
+++ b/tests/unit/xenocats/movement-pad.test.ts
@@ -1,6 +1,6 @@
 import { describe, expect, it } from 'vitest';
 import { DEAD_ZONE, knobOffset, padDirection } from '@/app/ui/xenocats/movement-pad';
-import { walkDirection } from '@/app/ui/xenocats/survival';
+import { walkDirection } from '@/app/ui/xenocats/walking';
 
 const centre = { x: 100, y: 100 };
 const radius = 72;
diff --git a/tests/unit/xenocats/survival.test.ts b/tests/unit/xenocats/survival.test.ts
deleted file mode 100644
index 44fad6a..0000000
--- a/tests/unit/xenocats/survival.test.ts
+++ /dev/null
@@ -1,407 +0,0 @@
-import { describe, expect, it } from 'vitest';
-import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
-import { createRandom } from '@/app/ui/xenocats/random';
-import {
-  type FightCat,
-  SURVIVAL_CONFIG,
-  bestScore,
-  createGameClock,
-  createSurvival,
-  facingTowards,
-  walkDirection,
-  waveSpec,
-} from '@/app/ui/xenocats/survival';
-
-const viewport = { width: 1200, height: 800 };
-const centre = { x: 600, y: 400 };
-
-function game(seed = 1, config = {}) {
-  return createSurvival({ random: createRandom(seed), types: CAT_TYPES, viewport, now: 0, config });
-}
-
-/** Ticks every `step` ms from `from` to `to`; collects what happened. */
-function run(
-  g: ReturnType<typeof game>,
-  from: number,
-  to: number,
-  options: {
-    player?: { x: number; y: number };
-    room?: number;
-    each?: (now: number) => void;
-  } = {},
-  step = 20
-) {
-  const touched: FightCat[] = [];
-  const pounced: FightCat[] = [];
-  const beamed: FightCat[] = [];
-  for (let now = from; now <= to; now += step) {
-    options.each?.(now);
-    const events = g.tick(now, options.player ?? centre, options.room);
-    touched.push(...events.touched);
-    pounced.push(...events.pounced);
-    beamed.push(...events.beamed);
-  }
-  return { touched, pounced, beamed };
-}
-
-/** Fires at the nearest cat whenever the gun is ready: the ranger at the centre. */
-const shootNearest = (g: ReturnType<typeof game>) => (now: number) => {
-  const [nearest] = [...g.snapshot().cats].sort(
-    (a, b) =>
-      Math.hypot(a.x - centre.x, a.y - centre.y) - Math.hypot(b.x - centre.x, b.y - centre.y)
-  );
-  if (nearest) g.fire(now, centre, nearest);
-};
-
-describe('waves', () => {
-  it('each wave brings more cats, sooner and faster', () => {
-    for (let n = 1; n < 12; n++) {
-      const now = waveSpec(n);
-      const next = waveSpec(n + 1);
-      expect(next.count).toBeGreaterThan(now.count);
-      expect(next.spawnEveryMs).toBeLessThanOrEqual(now.spawnEveryMs);
-      expect(next.speed).toBeGreaterThanOrEqual(now.speed);
-    }
-    expect(waveSpec(2).spawnEveryMs).toBeLessThan(waveSpec(1).spawnEveryMs);
-    expect(waveSpec(2).speed).toBeGreaterThan(waveSpec(1).speed);
-  });
-
-  it('speed and frequency stop growing at their limits', () => {
-    expect(waveSpec(200).spawnEveryMs).toBe(SURVIVAL_CONFIG.minSpawnEveryMs);
-    expect(waveSpec(200).speed).toBe(SURVIVAL_CONFIG.maxSpeed);
-  });
-
-  it('a wave is survived once all its cats have come and been beamed home', () => {
-    const g = game();
-    const { beamed, touched } = run(g, 0, 30_000, { each: shootNearest(g) });
-    const snap = g.snapshot();
-    expect(touched).toEqual([]);
-    expect(snap.status).toBe('playing');
-    expect(snap.lives).toBe(SURVIVAL_CONFIG.lives);
-    expect(snap.score).toBeGreaterThanOrEqual(3);
-    expect(snap.wave).toBe(snap.score + 1);
-    expect(beamed.length).toBeGreaterThanOrEqual(waveSpec(1).count + waveSpec(2).count);
-  });
-
-  it('brings exactly the wave’s number of cats', () => {
-    const g = game();
-    const seen = new Set<number>();
-    run(g, 0, 30_000, {
-      each: (now) => {
-        if (g.snapshot().wave > 1) return;
-        for (const cat of g.snapshot().cats) seen.add(cat.id);
-        shootNearest(g)(now);
-      },
-    });
-    expect(g.snapshot().wave).toBeGreaterThan(1);
-    expect(seen.size).toBe(waveSpec(1).count);
-  });
-});
-
-describe('never more than five cats', () => {
-  it('stays at five or fewer, however long the cats chase', () => {
-    // Cats that never arrive (a ranger they cannot reach in time) pile up.
-    const g = game(3, { firstWave: { count: 40, spawnEveryMs: 50, speed: 1 } });
-    let most = 0;
-    run(g, 0, 20_000, { each: () => (most = Math.max(most, g.snapshot().cats.length)) });
-    expect(most).toBe(5);
-  });
-
-  it('leaves room for cats that are already on screen', () => {
-    const g = game(3, { firstWave: { count: 40, spawnEveryMs: 50, speed: 1 } });
-    let most = 0;
-    run(g, 0, 20_000, {
-      room: 2,
-      each: () => (most = Math.max(most, g.snapshot().cats.length)),
-    });
-    expect(most).toBe(2);
-  });
-});
-
-describe('cats chase the ranger', () => {
-  const distance = (c: { x: number; y: number }, to = centre) => Math.hypot(c.x - to.x, c.y - to.y);
-
-  it('cats arrive at an edge, away from the ranger, and walk towards it', () => {
-    const g = game();
-    run(g, 0, SURVIVAL_CONFIG.breakMs);
-    const [cat] = g.snapshot().cats;
-    expect(cat).toBeDefined();
-    expect(distance(cat)).toBeGreaterThanOrEqual(SURVIVAL_CONFIG.keepAwayFromPlayer);
-    run(g, SURVIVAL_CONFIG.breakMs + 20, SURVIVAL_CONFIG.breakMs + 1000);
-    const later = g.snapshot().cats.find((c) => c.id === cat.id)!;
-    expect(distance(later)).toBeLessThan(distance(cat));
-  });
-
-  it('follows the ranger where it walks', () => {
-    const g = game(2, { firstWave: { count: 1, spawnEveryMs: 10, speed: 200 } });
-    run(g, 0, SURVIVAL_CONFIG.breakMs);
-    const corner = { x: 100, y: 100 };
-    const [cat] = g.snapshot().cats;
-    run(g, SURVIVAL_CONFIG.breakMs + 20, SURVIVAL_CONFIG.breakMs + 300, { player: corner });
-    const later = g.snapshot().cats.find((c) => c.id === cat.id)!;
-    expect(distance(later, corner)).toBeLessThan(distance(cat, corner));
-  });
-
-  it('cats still arrive on a screen too small to keep their distance', () => {
-    const small = createSurvival({
-      random: createRandom(1),
-      types: CAT_TYPES,
-      viewport: { width: 400, height: 400 },
-      now: 0,
-    });
-    for (let now = 0; now <= SURVIVAL_CONFIG.breakMs; now += 20)
-      small.tick(now, { x: 200, y: 200 });
-    expect(small.snapshot().cats).toHaveLength(1);
-  });
-});
-
-describe('attacks and lives', () => {
-  it('every cat pounces once, 1 to 3 s after it arrives, and that costs no life', () => {
-    // Slow cats: none reaches the ranger, so only the pounces happen.
-    const g = game(4, { firstWave: { count: 4, spawnEveryMs: 200, speed: 1 } });
-    const arrived = new Map<number, number>();
-    const { pounced, touched } = run(g, 0, 8000, {
-      each: (now) => {
-        for (const cat of g.snapshot().cats) if (!arrived.has(cat.id)) arrived.set(cat.id, now);
-      },
-    });
-    expect(touched).toEqual([]);
-    expect(pounced.map((c) => c.id).sort()).toEqual([...arrived.keys()].sort());
-    expect(arrived.size).toBe(4);
-    const [min, max] = SURVIVAL_CONFIG.attackAfterMs;
-    for (const cat of g.snapshot().cats) {
-      expect(cat.attackAt).toBeNull();
-    }
-    // Each pounce came within its window (one tick of slack either side).
-    const g2 = game(4, { firstWave: { count: 4, spawnEveryMs: 200, speed: 1 } });
-    const seenAt = new Map<number, number>();
-    for (let now = 0; now <= 8000; now += 20) {
-      const { pounced } = g2.tick(now, centre);
-      for (const cat of g2.snapshot().cats) if (!seenAt.has(cat.id)) seenAt.set(cat.id, now);
-      for (const cat of pounced) {
-        const after = now - seenAt.get(cat.id)!;
-        expect(after).toBeGreaterThanOrEqual(min - 20);
-        expect(after).toBeLessThanOrEqual(max + 20);
-      }
-    }
-    expect(g.snapshot().lives).toBe(SURVIVAL_CONFIG.lives);
-  });
-
-  it('a cat that touches the ranger lands its attack, leaves, and costs a life', () => {
-    const g = game();
-    const { touched } = run(g, 0, 20_000);
-    expect(touched.length).toBeGreaterThan(0);
-    const first = touched[0];
-    expect(first).toMatchObject(centre);
-    expect(g.snapshot().cats.find((c) => c.id === first.id)).toBeUndefined();
-  });
-
-  it('three touches end the game; the score is the waves survived', () => {
-    const g = game();
-    const { touched } = run(g, 0, 60_000);
-    const snap = g.snapshot();
-    expect(touched).toHaveLength(SURVIVAL_CONFIG.lives);
-    expect(snap.status).toBe('over');
-    expect(snap.lives).toBe(0);
-    expect(snap.cats).toHaveLength(0);
-    expect(snap.beams).toHaveLength(0);
-    expect(snap.score).toBe(0);
-    // Nothing more happens once it is over.
-    expect(g.tick(70_000, centre)).toEqual({ touched: [], pounced: [], beamed: [] });
-    expect(g.fire(70_000, centre, { x: 0, y: 0 })).toBeNull();
-  });
-});
-
-describe('the homing beam', () => {
-  /** A game with one slow cat on screen; returns the game and that cat. */
-  function oneCat(seed = 5) {
-    const g = game(seed, { firstWave: { count: 1, spawnEveryMs: 10, speed: 1 } });
-    run(g, 0, SURVIVAL_CONFIG.breakMs);
-    const [cat] = g.snapshot().cats;
-    return { g, cat, at: SURVIVAL_CONFIG.breakMs + 20 };
-  }
-
-  it('leaves the gun towards the aim and sends the cat it hits home', () => {
-    const { g, cat, at } = oneCat();
-    const beam = g.fire(at, centre, cat)!;
-    const way = Math.hypot(cat.x - centre.x, cat.y - centre.y);
-    const speed = SURVIVAL_CONFIG.beamSpeed;
-    expect(beam.vx).toBeCloseTo(((cat.x - centre.x) / way) * speed);
-    expect(beam.vy).toBeCloseTo(((cat.y - centre.y) / way) * speed);
-    expect(Math.hypot(beam.x - centre.x, beam.y - centre.y)).toBeCloseTo(
-      SURVIVAL_CONFIG.muzzleOffset
-    );
-    const { beamed } = run(g, at, at + 2000);
-    expect(beamed.map((c) => c.id)).toEqual([cat.id]);
-    // Gone; its wave (of one) is survived, so the next one is on its way.
-    expect(g.snapshot().cats.find((c) => c.id === cat.id)).toBeUndefined();
-    expect(g.snapshot().score).toBe(1);
-    expect(g.snapshot().beams).toEqual([]);
-  });
-
-  it('misses a cat it is not aimed at, and is gone once off screen', () => {
-    const { g, cat, at } = oneCat();
-    // Straight away from the cat.
-    g.fire(at, centre, { x: 2 * centre.x - cat.x, y: 2 * centre.y - cat.y });
-    const { beamed } = run(g, at, at + 2000);
-    expect(beamed).toEqual([]);
-    expect(g.snapshot().cats).toHaveLength(1);
-    expect(g.snapshot().beams).toEqual([]);
-  });
-
-  it('cannot fly past a cat in one long frame', () => {
-    const { g, cat, at } = oneCat();
-    g.fire(at, centre, cat);
-    // One 2 s frame carries the beam 2200 px, far past the cat.
-    expect(g.tick(at + 2000, centre).beamed.map((c) => c.id)).toEqual([cat.id]);
-  });
-
-  it('fires at most once per recharge', () => {
-    const { g, at } = oneCat();
-    const aim = { x: 0, y: 0 };
-    expect(g.fire(at, centre, aim)).not.toBeNull();
-    expect(g.fire(at + SURVIVAL_CONFIG.fireEveryMs - 1, centre, aim)).toBeNull();
-    expect(g.fire(at + SURVIVAL_CONFIG.fireEveryMs, centre, aim)).not.toBeNull();
-  });
-
-  it('hits only the nearer of two cats in its path', () => {
-    const g = game(5, { firstWave: { count: 2, spawnEveryMs: 10, speed: 0 } });
-    run(g, 0, SURVIVAL_CONFIG.breakMs + SURVIVAL_CONFIG.minSpawnEveryMs + 20);
-    const [a, b] = g.snapshot().cats;
-    expect(b).toBeDefined();
-    // Fire from just beyond `a`, on the line from `b` through `a`: `a` is first.
-    const way = { x: a.x - b.x, y: a.y - b.y };
-    const length = Math.hypot(way.x, way.y);
-    const from = { x: a.x + (way.x / length) * 100, y: a.y + (way.y / length) * 100 };
-    const at = SURVIVAL_CONFIG.breakMs + SURVIVAL_CONFIG.minSpawnEveryMs + 40;
-    g.fire(at, from, b);
-    expect(g.tick(at + 2000, from).beamed.map((c) => c.id)).toEqual([a.id]);
-  });
-});
-
-describe('a shot changed by an attack', () => {
-  function oneCat(seed = 5) {
-    const g = game(seed, { firstWave: { count: 1, spawnEveryMs: 10, speed: 0 } });
-    run(g, 0, SURVIVAL_CONFIG.breakMs);
-    const [cat] = g.snapshot().cats;
-    return { g, cat, at: SURVIVAL_CONFIG.breakMs + 20 };
-  }
-
-  /** Aims to pass `offset` px beside the cat's centre. */
-  const beside = (cat: { x: number; y: number }, offset: number) => {
-    const way = { x: cat.x - centre.x, y: cat.y - centre.y };
-    const length = Math.hypot(way.x, way.y);
-    return { x: cat.x - (way.y / length) * offset, y: cat.y + (way.x / length) * offset };
-  };
-
-  it('a small beam must pass closer to hit; a big one hits from further off', () => {
-    const near = SURVIVAL_CONFIG.beamRadius * 0.6;
-    const small = oneCat();
-    small.g.fire(small.at, centre, beside(small.cat, near), { scale: 0.25 });
-    expect(run(small.g, small.at, small.at + 2000).beamed).toEqual([]);
-
-    const normal = oneCat();
-    normal.g.fire(normal.at, centre, beside(normal.cat, near));
-    expect(run(normal.g, normal.at, normal.at + 2000).beamed).toHaveLength(1);
-
-    const far = SURVIVAL_CONFIG.beamRadius * 1.6;
-    const big = oneCat();
-    big.g.fire(big.at, centre, beside(big.cat, far), { scale: 2 });
-    expect(run(big.g, big.at, big.at + 2000).beamed).toHaveLength(1);
-  });
-
-  it('reloads slower and flies slower when told to', () => {
-    const { g, at } = oneCat();
-    const aim = { x: 0, y: 0 };
-    const beam = g.fire(at, centre, aim, { reload: 2, speed: 0.5 })!;
-    expect(Math.hypot(beam.vx, beam.vy)).toBeCloseTo(SURVIVAL_CONFIG.beamSpeed / 2);
-    expect(g.fire(at + SURVIVAL_CONFIG.fireEveryMs, centre, aim)).toBeNull();
-    expect(g.fire(at + 2 * SURVIVAL_CONFIG.fireEveryMs, centre, aim)).not.toBeNull();
-  });
-
-  it('a falling beam curves down', () => {
-    const { g, at } = oneCat();
-    g.fire(at, centre, { x: centre.x + 100, y: centre.y }, { gravity: 1400, speed: 0.2 });
-    g.tick(at + 200, centre);
-    const [beam] = g.snapshot().beams;
-    expect(beam.vy).toBeGreaterThan(0);
-    expect(beam.y).toBeGreaterThan(centre.y);
-  });
-
-  it('a bouncing beam comes back off the edge, then leaves', () => {
-    const { g, at } = oneCat();
-    g.fire(at, centre, { x: centre.x + 100, y: centre.y }, { bounces: 1 });
-    // 1100 px/s from x 630: past the right edge (1200) within 0.6 s.
-    for (let now = at + 20; now <= at + 700; now += 20) g.tick(now, centre);
-    const [beam] = g.snapshot().beams;
-    expect(beam.vx).toBeLessThan(0);
-    expect(beam.bounces).toBe(0);
-    for (let now = at + 720; now <= at + 3000; now += 20) g.tick(now, centre);
-    expect(g.snapshot().beams).toEqual([]);
-  });
-});
-
-describe('walking and facing', () => {
-  it('WASD and the arrow keys walk the ranger; a diagonal is no faster', () => {
-    expect(walkDirection([])).toEqual({ x: 0, y: 0 });
-    expect(walkDirection(['KeyD'])).toEqual({ x: 1, y: 0 });
-    expect(walkDirection(['ArrowUp'])).toEqual({ x: 0, y: -1 });
-    const diagonal = walkDirection(['KeyW', 'KeyA']);
-    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1);
-    expect(diagonal.x).toBeLessThan(0);
-    expect(diagonal.y).toBeLessThan(0);
-    // Opposite keys cancel; the same way twice counts once; other keys are ignored.
-    expect(walkDirection(['KeyA', 'KeyD'])).toEqual({ x: 0, y: 0 });
-    expect(walkDirection(['KeyS', 'ArrowDown'])).toEqual({ x: 0, y: 1 });
-    expect(walkDirection(['KeyQ', 'Space'])).toEqual({ x: 0, y: 0 });
-  });
-
-  it('faces the aim in eight directions', () => {
-    const at = (dx: number, dy: number) => facingTowards(centre, { x: 600 + dx, y: 400 + dy });
-    expect(at(100, 0)).toBe('e');
-    expect(at(100, 100)).toBe('se');
-    expect(at(0, 100)).toBe('s');
-    expect(at(-100, 100)).toBe('sw');
-    expect(at(-100, 0)).toBe('w');
-    expect(at(-100, -100)).toBe('nw');
-    expect(at(0, -100)).toBe('n');
-    expect(at(100, -100)).toBe('ne');
-    // Nearly east is still east.
-    expect(at(100, 30)).toBe('e');
-  });
-});
-
-describe('best score', () => {
-  it('keeps the higher of the old best and the new score', () => {
-    expect(bestScore(null, 0)).toBe(0);
-    expect(bestScore(null, 4)).toBe(4);
-    expect(bestScore(6, 4)).toBe(6);
-    expect(bestScore(6, 9)).toBe(9);
-  });
-});
-
-describe('game clock', () => {
-  it('stands still while paused', () => {
-    const clock = createGameClock(1000);
-    expect(clock.now(1500)).toBe(500);
-    clock.pause(1500);
-    expect(clock.isPaused()).toBe(true);
-    expect(clock.now(9000)).toBe(500);
-    clock.resume(9000);
-    expect(clock.isPaused()).toBe(false);
-    expect(clock.now(9100)).toBe(600);
-  });
-
-  it('a paused game does not move on: no cat comes closer, no beam flies', () => {
-    const g = game();
-    const clock = createGameClock(0);
-    for (let real = 0; real <= 2000; real += 20) g.tick(clock.now(real), centre);
-    g.fire(clock.now(2000), centre, { x: 0, y: 0 });
-    const before = g.snapshot();
-    clock.pause(2000);
-    for (let real = 2000; real <= 30_000; real += 20) g.tick(clock.now(real), centre);
-    expect(g.snapshot().cats).toEqual(before.cats);
-    expect(g.snapshot().beams).toEqual(before.beams);
-    expect(g.snapshot().lives).toBe(SURVIVAL_CONFIG.lives);
-  });
-});
diff --git a/tests/unit/xenocats/walking.test.ts b/tests/unit/xenocats/walking.test.ts
new file mode 100644
index 0000000..0a5cdb2
--- /dev/null
+++ b/tests/unit/xenocats/walking.test.ts
@@ -0,0 +1,47 @@
+import { describe, expect, it } from 'vitest';
+import { createGameClock, facingTowards, walkDirection } from '@/app/ui/xenocats/walking';
+
+const centre = { x: 600, y: 400 };
+
+describe('walking and facing', () => {
+  it('WASD and the arrow keys walk the ranger; a diagonal is no faster', () => {
+    expect(walkDirection([])).toEqual({ x: 0, y: 0 });
+    expect(walkDirection(['KeyD'])).toEqual({ x: 1, y: 0 });
+    expect(walkDirection(['ArrowUp'])).toEqual({ x: 0, y: -1 });
+    const diagonal = walkDirection(['KeyW', 'KeyA']);
+    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1);
+    expect(diagonal.x).toBeLessThan(0);
+    expect(diagonal.y).toBeLessThan(0);
+    // Opposite keys cancel; the same way twice counts once; other keys are ignored.
+    expect(walkDirection(['KeyA', 'KeyD'])).toEqual({ x: 0, y: 0 });
+    expect(walkDirection(['KeyS', 'ArrowDown'])).toEqual({ x: 0, y: 1 });
+    expect(walkDirection(['KeyQ', 'Space'])).toEqual({ x: 0, y: 0 });
+  });
+
+  it('faces the aim in eight directions', () => {
+    const at = (dx: number, dy: number) => facingTowards(centre, { x: 600 + dx, y: 400 + dy });
+    expect(at(100, 0)).toBe('e');
+    expect(at(100, 100)).toBe('se');
+    expect(at(0, 100)).toBe('s');
+    expect(at(-100, 100)).toBe('sw');
+    expect(at(-100, 0)).toBe('w');
+    expect(at(-100, -100)).toBe('nw');
+    expect(at(0, -100)).toBe('n');
+    expect(at(100, -100)).toBe('ne');
+    // Nearly east is still east.
+    expect(at(100, 30)).toBe('e');
+  });
+});
+
+describe('game clock', () => {
+  it('stands still while paused', () => {
+    const clock = createGameClock(1000);
+    expect(clock.now(1500)).toBe(500);
+    clock.pause(1500);
+    expect(clock.isPaused()).toBe(true);
+    expect(clock.now(9000)).toBe(500);
+    clock.resume(9000);
+    expect(clock.isPaused()).toBe(false);
+    expect(clock.now(9100)).toBe(600);
+  });
+});
~~~~

</details>

#### T7 — `night-2026-10-07-t7-arsenal`

Experience, level-ups (an accessible dialog) and the arsenal of nine weapons and nine passives (`arsenal.ts`). Why: plan task 7 (D35–D42).

<details><summary>Code: 7 files changed, 1562 insertions(+), 95 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 32af821..0d3bfac 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -48,7 +48,8 @@ jobs:
       - name: Unit tests (cats, games, page, sound)
         if: ${{ !cancelled() }}
         run: >-
-          npx vitest run tests/unit/xenocats/arena tests/unit/xenocats/walking tests/unit/xenocats/locked-pointer
+          npx vitest run tests/unit/xenocats/arena tests/unit/xenocats/arsenal tests/unit/xenocats/walking
+          tests/unit/xenocats/locked-pointer
           tests/unit/xenocats/taming tests/unit/xenocats/page-hits tests/unit/xenocats/sounds
           tests/unit/xenocats/field-guide tests/unit/xenocats/pet-cat tests/unit/xenocats/combos
           tests/unit/xenocats/puppets tests/unit/xenocats/movement-pad
diff --git a/app/ui/xenocats/arena-view.tsx b/app/ui/xenocats/arena-view.tsx
index 6eead7a..043e1d0 100644
--- a/app/ui/xenocats/arena-view.tsx
+++ b/app/ui/xenocats/arena-view.tsx
@@ -2,8 +2,9 @@
 
 import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
 import { Button } from '@/app/ui/button';
-import { type Arena, ARENA_CONFIG, type ArenaOutcome, createArena } from './arena';
+import { type Arena, ARENA_CONFIG, type ArenaOutcome, BLADE_RADIUS, createArena } from './arena';
 import { HERO_SVG } from './arena-art';
+import { type Choice, describeChoice } from './arsenal';
 import { SURVIVAL_BEST_KEY, bestOf, clockText, readBest, writeBest } from './arena-storage';
 import { catArt } from './cat-art';
 import { CAT_TYPES } from './cat-types';
@@ -22,10 +23,21 @@ import type { Vec } from './effects';
 // play area as data- attributes for the browser tests. The canvas and everything
 // drawn on it are hidden from assistive technology.
 //
+// Each level pauses the run for a choice (arsenal.ts): a dialog of three or four,
+// picked with 1–4, the arrow keys and Enter, or a tap; focus moves into it and back.
+//
 // Test hooks, read from the page's address when a run starts: `?seed=` fixes the
 // random source, `?speed=` (up to 50) makes time pass that much faster.
 
-type Screen = 'start' | 'playing' | 'paused' | 'results';
+type Screen = 'start' | 'playing' | 'choosing' | 'paused' | 'results';
+
+/** How each weapon's shots are drawn. */
+const SHOT_COLOR: Record<string, string> = {
+  'cat-treats': '#fbbf24',
+  'spray-bottle': '#7dd3fc',
+  'yarn-ball': '#f472b6',
+  hairball: '#a8865b',
+};
 
 /** Cats drawn this size, px. */
 const CAT_SIZE = 44;
@@ -51,6 +63,10 @@ type Hud = {
   heroX: number;
   heroY: number;
   effect: string | null;
+  level: number;
+  xp: number;
+  xpToNext: number;
+  weapons: string;
 };
 
 const OUTCOME_TEXT: Record<ArenaOutcome, string> = {
@@ -96,6 +112,11 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
   const [outcome, setOutcome] = useState<ArenaOutcome | null>(null);
   // The finished run's numbers, kept for the results screen.
   const [result, setResult] = useState<{ time: number; sentHome: number } | null>(null);
+  // A level-up's choices, while the run waits for one.
+  const [choices, setChoices] = useState<Choice[] | null>(null);
+  // The level the waiting choice is for (several can wait after one gem).
+  const [choiceLevel, setChoiceLevel] = useState(2);
+  const choiceRef = useRef<HTMLDivElement>(null);
   const best = useSyncExternalStore(subscribeBest, readBest, () => null);
   const arenaRef = useRef<Arena | null>(null);
   const screenRef = useRef<Screen>('start');
@@ -155,15 +176,34 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
     finish('gave-up');
   };
 
-  const running = screen === 'playing' || screen === 'paused';
+  /** Takes a level-up's choice; the run goes on, or the next level's choice comes. */
+  const choose = useCallback(
+    (index: number) => {
+      const arena = arenaRef.current;
+      if (!arena || screenRef.current !== 'choosing') return;
+      arena.choose(index);
+      const next = arena.choices();
+      if (next) {
+        setChoices([...next]);
+        setChoiceLevel(arena.choiceLevel());
+      } else {
+        setChoices(null);
+        show('playing');
+      }
+    },
+    [show]
+  );
+
+  const running = screen === 'playing' || screen === 'choosing' || screen === 'paused';
 
-  // Focus: into the play area when a run starts, onto Resume when paused, onto
-  // Play again when it is over.
+  // Focus: into the play area when a run starts (and back after a choice), onto the
+  // first choice at a level-up, onto Resume when paused, onto Play again when over.
   useEffect(() => {
     if (screen === 'playing') areaRef.current?.focus();
+    if (screen === 'choosing') choiceRef.current?.querySelector('button')?.focus();
     if (screen === 'paused') pauseRef.current?.querySelector('button')?.focus();
     if (screen === 'results') resultsRef.current?.querySelector('button')?.focus();
-  }, [screen]);
+  }, [screen, choices]);
 
   // While a run lasts its play area covers the page: everything else is inert, so
   // focus cannot wander behind it. Only what this marked is unmarked again.
@@ -258,6 +298,27 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
       }
       context.stroke();
 
+      // The Thunderous Vacuum's reach, and the gems lying about.
+      const zone = arena.zone();
+      if (zone) {
+        context.fillStyle = `rgba(157, 134, 255, ${0.1 + 0.04 * Math.sin(time / 180)})`;
+        context.beginPath();
+        context.arc(width / 2, height / 2, zone, 0, 2 * Math.PI);
+        context.fill();
+      }
+      for (const gem of arena.gems()) {
+        const x = gem.x - camX;
+        const y = gem.y - camY;
+        if (x < -8 || y < -8 || x > width + 8 || y > height + 8) continue;
+        context.fillStyle = gem.value > 1 ? '#c1e838' : '#9d86ff';
+        context.beginPath();
+        context.moveTo(x, y - 6);
+        context.lineTo(x + 4, y);
+        context.lineTo(x, y + 6);
+        context.lineTo(x - 4, y);
+        context.fill();
+      }
+
       // The beams.
       context.strokeStyle = '#c1e838';
       context.shadowColor = '#c1e838';
@@ -302,6 +363,25 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
         }
       }
 
+      // What his weapons fired, and the Can Opener's blades.
+      for (const shot of arena.projectiles()) {
+        const x = shot.x - camX;
+        const y = shot.y - camY;
+        if (x < -20 || y < -20 || x > width + 20 || y > height + 20) continue;
+        context.fillStyle = SHOT_COLOR[shot.weapon] ?? '#e0e0b3';
+        context.beginPath();
+        context.arc(x, y, Math.max(shot.radius * 0.6, 3), 0, 2 * Math.PI);
+        context.fill();
+      }
+      context.fillStyle = '#e0e0b3';
+      for (const blade of arena.blades()) {
+        context.save();
+        context.translate(blade.x - camX, blade.y - camY);
+        context.rotate(time / 90);
+        context.fillRect(-BLADE_RADIUS, -4, BLADE_RADIUS * 2, 8);
+        context.restore();
+      }
+
       // Beamed home: a column of light where each one stood.
       for (let i = flashes.length - 1; i >= 0; i--) {
         const flash = flashes[i];
@@ -384,6 +464,8 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
         } else if (event.kind === 'hero-hit') {
           hits.push(event.type);
           if (player) sound(() => player.play(soundsFor(CAT_TYPES[event.type]).attack));
+        } else if (event.kind === 'level-up') {
+          if (player) sound(() => player.play(soundsFor(CAT_TYPES[0]).arrive));
         } else if (event.kind === 'matriarch' && titan >= 0 && player) {
           player.play(soundsFor(CAT_TYPES[titan]).wake);
         } else if (event.kind === 'over') {
@@ -413,13 +495,52 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
           heroX: Math.round(state.hero.x),
           heroY: Math.round(state.hero.y),
           effect: state.hero.effect,
+          level: state.level,
+          xp: state.xp,
+          xpToNext: state.xpToNext,
+          weapons: state.weapons.map((w) => `${w.id}:${w.level}`).join(' '),
         });
       }
       if (over) finish(over);
+      else if (arena.choices()) {
+        // The run waits for a choice; the HUD shows the level it is for.
+        carry = 0;
+        setHud((before) =>
+          before
+            ? {
+                ...before,
+                level: state.level,
+                xp: state.xp,
+                xpToNext: state.xpToNext,
+                weapons: state.weapons.map((w) => `${w.id}:${w.level}`).join(' '),
+              }
+            : before
+        );
+        setChoices([...arena.choices()!]);
+        setChoiceLevel(arena.choiceLevel());
+        show('choosing');
+      }
     };
     frameId = requestAnimationFrame(frame);
 
     const onKeyDown = (event: KeyboardEvent) => {
+      if (screenRef.current === 'choosing') {
+        // 1–4 picks; the arrow keys move between the choices (Enter or Space picks).
+        const number = Number(event.key);
+        const buttons = Array.from(
+          choiceRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []
+        );
+        if (Number.isInteger(number) && number >= 1 && number <= buttons.length) {
+          event.preventDefault();
+          choose(number - 1);
+        } else if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) {
+          event.preventDefault();
+          const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
+          const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
+          buttons[(at + step + buttons.length) % buttons.length]?.focus();
+        }
+        return;
+      }
       if (event.key === 'Escape') {
         event.preventDefault();
         if (screenRef.current === 'playing') show('paused');
@@ -451,7 +572,7 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
       window.removeEventListener('resize', resize);
       document.removeEventListener('visibilitychange', onHidden);
     };
-  }, [running, finish, pause, show]);
+  }, [running, finish, pause, show, choose]);
 
   return (
     <div>
@@ -517,7 +638,8 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
           data-hero-x={hud?.heroX ?? 0}
           data-hero-y={hud?.heroY ?? 0}
           data-effect={hud?.effect ?? ''}
-          data-weapons="laser-pointer"
+          data-level={hud?.level ?? 1}
+          data-weapons={hud?.weapons ?? 'laser-pointer:1'}
           data-best-key={SURVIVAL_BEST_KEY}
           className="fixed inset-0 z-[9998] select-none overflow-hidden bg-void outline-none"
         >
@@ -546,6 +668,22 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
               <span data-testid="survival-resolve">{Math.ceil(hud?.resolve ?? 100)}</span>
             </div>
             <p data-testid="survival-sent-home">Cats sent home: {hud?.sentHome ?? 0}</p>
+            <div className="flex items-center gap-2">
+              <span data-testid="survival-level">Level {hud?.level ?? 1}</span>
+              <div
+                role="progressbar"
+                aria-label="Experience"
+                aria-valuemin={0}
+                aria-valuemax={hud?.xpToNext ?? 5}
+                aria-valuenow={hud?.xp ?? 0}
+                className="h-2 w-24 overflow-hidden rounded-full bg-panel"
+              >
+                <div
+                  className="h-full bg-aura"
+                  style={{ width: `${(100 * (hud?.xp ?? 0)) / (hud?.xpToNext ?? 5)}%` }}
+                />
+              </div>
+            </div>
             {screen === 'playing' && (
               <Button className="ml-auto" onClick={pause}>
                 Pause
@@ -553,6 +691,57 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
             )}
           </div>
 
+          {screen === 'choosing' && choices && (
+            <div
+              ref={choiceRef}
+              role="dialog"
+              aria-modal="true"
+              aria-labelledby="level-up-heading"
+              aria-describedby="level-up-help"
+              data-testid="survival-level-up"
+              className="absolute inset-0 z-20 flex items-center justify-center bg-void/60 p-4"
+            >
+              <div className="w-full max-w-lg rounded-2xl border border-line bg-panel p-6">
+                <h2 id="level-up-heading" className="font-display text-xl text-cream">
+                  Level {choiceLevel}. Choose one.
+                </h2>
+                <p id="level-up-help" className="mt-1 text-sm text-aura">
+                  {touch
+                    ? 'Tap a choice.'
+                    : `Press 1 to ${choices.length}, or use the arrow keys and Enter.`}
+                </p>
+                <ol className="mt-4 grid gap-2">
+                  {choices.map((choice, i) => {
+                    const { name, description } = describeChoice(choice);
+                    const kind =
+                      choice.kind === 'weapon'
+                        ? 'Weapon'
+                        : choice.kind === 'passive'
+                          ? 'Passive'
+                          : 'Rest';
+                    return (
+                      <li key={i}>
+                        <button
+                          type="button"
+                          data-choice={choice.kind === 'restore' ? 'restore' : choice.id}
+                          data-kind={choice.kind}
+                          data-level={choice.kind === 'restore' ? '' : choice.level}
+                          onClick={() => choose(i)}
+                          className="w-full rounded-xl border border-line bg-void/70 p-3 text-left text-sm text-white hover:border-aura focus-visible:outline focus-visible:outline-2 focus-visible:outline-plasma"
+                        >
+                          <span className="font-semibold text-plasma">{i + 1}.</span>{' '}
+                          <span className="font-semibold">{name}</span>{' '}
+                          <span className="text-aura">({kind})</span>
+                          <span className="mt-1 block text-aura">{description}</span>
+                        </button>
+                      </li>
+                    );
+                  })}
+                </ol>
+              </div>
+            </div>
+          )}
+
           {screen === 'paused' && (
             <div
               ref={pauseRef}
diff --git a/app/ui/xenocats/arena.ts b/app/ui/xenocats/arena.ts
index eb9653e..78fd769 100644
--- a/app/ui/xenocats/arena.ts
+++ b/app/ui/xenocats/arena.ts
@@ -6,16 +6,30 @@
 //
 // The hero walks an endless arena; the cats of the twenty xenocat types pour in
 // from just off screen on every side and walk at him. Attacks are automatic:
-// positioning is the skill. His Laser Pointer points at the nearest cat every so
-// often, and every cat its beam touches grows homesick; enough Homesickness and a
-// cat is beamed home. Nothing is ever killed. A cat that reaches him drains his
-// Resolve (each type its own amount), and he is untouchable for a moment after. A
-// few cats are elites, and also lay their xenocat effect on him (Cryo freezes him,
-// Gravi slows him, Mirror turns his controls round...), one effect at a time.
-// Cats keep coming, more and more, until the frame rate says no more (frame-guard.ts).
-// The run ends when his Resolve is spent, when he gives up, or at the time goal,
-// when the Matriarch comes for him and no laser can send her home.
+// positioning is the skill. His weapons (arsenal.ts) fire on their own, starting
+// with the Laser Pointer; every cat they touch grows homesick, and enough
+// Homesickness and a cat is beamed home. Nothing is ever killed. A cat sent home
+// leaves an experience gem; gathered gems bring levels, and each level pauses the
+// run for a choice: a new weapon, a better one, or a passive. A cat that reaches
+// him drains his Resolve (each type its own amount), and he is untouchable for a
+// moment after. A few cats are elites, and also lay their xenocat effect on him
+// (Cryo freezes him, Gravi slows him, Mirror turns his controls round...), one
+// effect at a time. Cats keep coming, more and more, until the frame rate says no
+// more (frame-guard.ts). The run ends when his Resolve is spent, when he gives up,
+// or at the time goal, when the Matriarch comes for him and nothing sends her home.
 
+import {
+  type Choice,
+  type Modifiers,
+  type PassiveId,
+  WEAPONS,
+  type WeaponId,
+  type WeaponStats,
+  modifiers,
+  offerChoices,
+  weaponStats,
+  xpToNext,
+} from './arsenal';
 import type { CatType } from './cat-types';
 import { type Vec } from './effects';
 import { createArenaGrid } from './arena-grid';
@@ -56,6 +70,8 @@ export type ArenaConfig = {
      * back the growth beyond, so a slow screen still gets a game.
      */
     guardFree: number;
+    /** A cat is touched by what comes within this of its centre (plus its size), px. */
+    radius: number;
   };
   /**
    * How many cats the arena aims to hold, by the time into the run: points of
@@ -64,16 +80,21 @@ export type ArenaConfig = {
   escalation: readonly (readonly [number, number])[];
   /** At most this many cats arrive a second, as a share of those still missing. */
   arrivalShare: number;
-  laser: {
-    cooldownMs: number;
-    /** How far the beam reaches, px. */
-    range: number;
-    /** Cats this near the beam's line are touched by it, px. */
-    width: number;
-    /** Homesickness each touch gives. */
-    homesickness: number;
-    /** How long a beam is seen, ms. */
-    showMs: number;
+  /** What he starts with, and when those first fire, ms. */
+  startingWeapons: readonly WeaponId[];
+  firstShotMs: number;
+  /** The level they start at (a test's way to try a weapon at its best). */
+  startingLevel: number;
+  gems: {
+    /** Gems this near (times Long Whiskers) fly to him, px. */
+    pickup: number;
+    /** How fast, px/s. */
+    speed: number;
+    /** Experience a gem from a plain cat, and from an elite. */
+    value: number;
+    eliteValue: number;
+    /** Beyond this many gems lying about, a new one adds to an old one. */
+    cap: number;
   };
   matriarch: {
     /** px/s: faster than the hero. */
@@ -97,6 +118,7 @@ export const ARENA_CONFIG: ArenaConfig = {
     spawnMargin: 60,
     hardCap: 6000,
     guardFree: 40,
+    radius: 16,
   },
   // A few cats in the first half minute, dozens by one minute, hundreds by two and
   // a half, and from four minutes as many as the frame rate allows.
@@ -109,7 +131,10 @@ export const ARENA_CONFIG: ArenaConfig = {
     [300_000, 6000],
   ],
   arrivalShare: 0.5,
-  laser: { cooldownMs: 1100, range: 300, width: 16, homesickness: 20, showMs: 180 },
+  startingWeapons: ['laser-pointer'],
+  firstShotMs: 550,
+  startingLevel: 1,
+  gems: { pickup: 100, speed: 520, value: 1, eliteValue: 6, cap: 1500 },
   matriarch: { speed: 330, reach: 70 },
   cellSize: 64,
 };
@@ -176,13 +201,38 @@ export type ArenaCat = {
   elite: boolean;
 };
 
+/** Something a weapon fired, in flight. */
+export type Projectile = {
+  weapon: WeaponId;
+  /** A hairball's bits do not burst again. */
+  bit: boolean;
+  x: number;
+  y: number;
+  vx: number;
+  vy: number;
+  radius: number;
+  damage: number;
+  /** Cats it may still touch. */
+  pierce: number;
+  until: number;
+  /** The cats it has touched (by id), each only once. */
+  touched: number[];
+};
+
+export type Gem = { x: number; y: number; value: number };
+
 export type ArenaEvent =
   | { kind: 'sent-home'; x: number; y: number; type: number }
   | { kind: 'hero-hit'; type: number; elite: boolean }
   | { kind: 'laser'; from: Vec; to: Vec }
+  | { kind: 'level-up'; level: number }
+  | { kind: 'fired'; weapon: WeaponId }
   | { kind: 'matriarch' }
   | { kind: 'over'; outcome: ArenaOutcome };
 
+/** A Can Opener blade's own size, px. */
+export const BLADE_RADIUS = 20;
+
 /** How a run ended: his Resolve spent, given up, or the time goal reached. */
 export type ArenaOutcome = 'spent' | 'gave-up' | 'goal';
 
@@ -215,11 +265,28 @@ export function createArena(options: {
   const cats: ArenaCat[] = [];
   const spare: ArenaCat[] = [];
   let arrivals = 0;
-  let laserReadyAt = config.laser.cooldownMs / 2;
-  const beams: { from: Vec; to: Vec; until: number }[] = [];
   let matriarch: Vec | null = null;
   let events: ArenaEvent[] = [];
 
+  // The arsenal.
+  const weapons = new Map<WeaponId, { level: number; readyAt: number }>();
+  for (const id of config.startingWeapons) {
+    weapons.set(id, { level: config.startingLevel, readyAt: config.firstShotMs });
+  }
+  const passives = new Map<PassiveId, number>();
+  let mods: Modifiers = modifiers(passives);
+  const projectiles: Projectile[] = [];
+  const spareProjectiles: Projectile[] = [];
+  const beams: { from: Vec; to: Vec; until: number }[] = [];
+  // Experience.
+  const gems: Gem[] = [];
+  let xp = 0;
+  let level = 1;
+  let pending = 0;
+  let choosing: Choice[] | null = null;
+
+  const maxResolve = () => config.hero.resolve + mods.maxResolve;
+
   /** A type's own numbers, the same every time: spread between the config's bounds. */
   const byType = (type: number, [low, high]: readonly [number, number], salt: number) => {
     const share = ((types[type].number * salt) % 11) / 10;
@@ -244,14 +311,24 @@ export function createArena(options: {
     cats.push(cat);
   }
 
-  function sendHome(index: number) {
-    const cat = cats[index];
-    events.push({ kind: 'sent-home', x: cat.x, y: cat.y, type: cat.type });
-    sentHome++;
-    // Swap-remove, and keep the object for the next cat.
-    cats[index] = cats[cats.length - 1];
-    cats.pop();
-    spare.push(cat);
+  /** Every cat homesick enough goes home, leaving a gem; the objects are kept for reuse. */
+  function sweepHome() {
+    for (let i = cats.length - 1; i >= 0; i--) {
+      const cat = cats[i];
+      if (cat.homesickness < cat.limit) continue;
+      events.push({ kind: 'sent-home', x: cat.x, y: cat.y, type: cat.type });
+      sentHome++;
+      dropGem(cat.x, cat.y, cat.elite ? config.gems.eliteValue : config.gems.value);
+      cats[i] = cats[cats.length - 1];
+      cats.pop();
+      spare.push(cat);
+    }
+  }
+
+  function dropGem(x: number, y: number, value: number) {
+    // Too many lying about: it adds to one already there.
+    if (gems.length >= config.gems.cap) gems[random.int(0, gems.length - 1)].value += value;
+    else gems.push({ x, y, value });
   }
 
   function end(how: ArenaOutcome) {
@@ -289,7 +366,7 @@ export function createArena(options: {
   function heroStep(input: Vec, dt: number) {
     const active = effect && time < effect.until ? effect : null;
     let { x, y } = input;
-    let speed = config.hero.speed;
+    let speed = config.hero.speed * mods.speed;
     if (active) {
       const e = active.effect;
       if (e.kind === 'freeze') speed = 0;
@@ -309,46 +386,274 @@ export function createArena(options: {
     if (x !== 0) hero.facing = Math.sign(x);
   }
 
-  function fireLaser() {
-    grid.query(hero.x, hero.y, config.laser.range, near);
-    let target: ArenaCat | null = null;
-    let best = config.laser.range ** 2;
+  // ------------------------------------------------------------------ the weapons
+
+  const inRange: number[] = [];
+  /**
+   * Every cat within `range` of a point (indices), in no order, into a list reused
+   * from call to call: read it before the next call.
+   */
+  function within(at: Vec, range: number): number[] {
+    grid.query(at.x, at.y, range, near);
+    inRange.length = 0;
     for (const i of near) {
       const cat = cats[i];
-      const d = (cat.x - hero.x) ** 2 + (cat.y - hero.y) ** 2;
-      if (d <= best) {
-        best = d;
-        target = cat;
-      }
+      if ((cat.x - at.x) ** 2 + (cat.y - at.y) ** 2 <= range * range) inRange.push(i);
     }
-    if (!target) return false;
-    const dx = target.x - hero.x;
-    const dy = target.y - hero.y;
-    const length = Math.hypot(dx, dy);
-    // A cat standing right on him gives no direction: he points the way he faces.
-    const ux = length < 0.5 ? hero.facing : dx / length;
-    const uy = length < 0.5 ? 0 : dy / length;
-    const to = { x: hero.x + ux * config.laser.range, y: hero.y + uy * config.laser.range };
-    beams.push({ from: { x: hero.x, y: hero.y }, to, until: time + config.laser.showMs });
-    events.push({ kind: 'laser', from: { x: hero.x, y: hero.y }, to });
-    // Every cat near the beam's line, within its reach, grows homesick.
-    const hit: number[] = [];
+    return inRange;
+  }
+
+  /** The `count` nearest cats within `range` of a point, nearest first (indices). */
+  function nearest(at: Vec, range: number, count: number, skip?: Set<number>): number[] {
+    grid.query(at.x, at.y, range, near);
+    const found: { i: number; d: number }[] = [];
+    for (const i of near) {
+      const cat = cats[i];
+      if (skip?.has(cat.id)) continue;
+      const d = (cat.x - at.x) ** 2 + (cat.y - at.y) ** 2;
+      if (d <= range * range) found.push({ i, d });
+    }
+    found.sort((a, b) => a.d - b.d || a.i - b.i);
+    return found.slice(0, count).map((f) => f.i);
+  }
+
+  /** A beam from `from` along (ux, uy): every cat in front, near its line, grows homesick. */
+  function beam(from: Vec, ux: number, uy: number, length: number, width: number, damage: number) {
+    const to = { x: from.x + ux * length, y: from.y + uy * length };
+    beams.push({ from: { ...from }, to, until: time + 180 });
+    events.push({ kind: 'laser', from: { ...from }, to });
+    grid.query(from.x + (ux * length) / 2, from.y + (uy * length) / 2, length / 2 + width, near);
     for (const i of near) {
       const cat = cats[i];
-      const along = (cat.x - hero.x) * ux + (cat.y - hero.y) * uy;
+      const along = (cat.x - from.x) * ux + (cat.y - from.y) * uy;
       // (A cat right on him counts as in front: up to the same half pixel.)
-      if (along < -0.5 || along > config.laser.range) continue;
-      const across = Math.abs((cat.x - hero.x) * uy - (cat.y - hero.y) * ux);
-      if (across > config.laser.width + 12) continue;
-      cat.homesickness += config.laser.homesickness;
-      if (cat.homesickness >= cat.limit) hit.push(i);
+      if (along < -0.5 || along > length) continue;
+      const across = Math.abs((cat.x - from.x) * uy - (cat.y - from.y) * ux);
+      if (across > width + config.cats.radius) continue;
+      cat.homesickness += damage;
+    }
+  }
+
+  /** The way from the hero to a cat; the way he faces if it stands on him. */
+  function aim(cat: ArenaCat): Vec {
+    const dx = cat.x - hero.x;
+    const dy = cat.y - hero.y;
+    const length = Math.hypot(dx, dy);
+    return length < 0.5 ? { x: hero.facing, y: 0 } : { x: dx / length, y: dy / length };
+  }
+
+  function launch(p: Omit<Projectile, 'touched'>) {
+    const projectile = spareProjectiles.pop() ?? ({ touched: [] } as unknown as Projectile);
+    Object.assign(projectile, p);
+    projectile.touched.length = 0;
+    projectiles.push(projectile);
+  }
+
+  /** Fires a weapon that fires; false if it found nothing to fire at (it waits). */
+  function fire(id: WeaponId, s: WeaponStats): boolean {
+    const kind = WEAPONS[id].kind;
+    if (kind === 'beam') {
+      const targets = nearest(hero, s.area, s.count);
+      if (targets.length === 0) return false;
+      for (const i of targets) {
+        const way = aim(cats[i]);
+        beam(hero, way.x, way.y, s.area, 16, s.damage);
+      }
+      return true;
+    }
+    if (kind === 'chain') {
+      const hit = new Set<number>();
+      let from: Vec = { x: hero.x, y: hero.y };
+      for (let jump = 0; jump < s.count; jump++) {
+        const [i] = nearest(from, s.area, 1, hit);
+        if (i === undefined) break;
+        const cat = cats[i];
+        hit.add(cat.id);
+        cat.homesickness += s.damage;
+        const to = { x: cat.x, y: cat.y };
+        beams.push({ from, to, until: time + s.durationMs });
+        events.push({ kind: 'laser', from, to });
+        from = to;
+      }
+      return hit.size > 0;
+    }
+    if (kind === 'pull') {
+      const targets = within(hero, s.area);
+      if (targets.length === 0) return false;
+      for (const i of targets) {
+        const cat = cats[i];
+        // Drawn in, a share of the way, but not onto him.
+        const d = Math.hypot(cat.x - hero.x, cat.y - hero.y);
+        const keep = Math.max(d * (1 - s.speed), config.hero.reach + 6);
+        if (d > keep) {
+          cat.x = hero.x + ((cat.x - hero.x) * keep) / d;
+          cat.y = hero.y + ((cat.y - hero.y) * keep) / d;
+        }
+        cat.homesickness += s.damage;
+      }
+      return true;
+    }
+    const base = { weapon: id, bit: false, x: hero.x, y: hero.y, radius: s.area, damage: s.damage };
+    if (kind === 'spread' || kind === 'burst') {
+      const [i] = nearest(hero, 650, 1);
+      if (i === undefined) return false;
+      const way = aim(cats[i]);
+      const angle = Math.atan2(way.y, way.x);
+      const shots = kind === 'burst' ? 1 : s.count;
+      for (let k = 0; k < shots; k++) {
+        const turn = angle + (k - (shots - 1) / 2) * 0.16;
+        launch({
+          ...base,
+          vx: Math.cos(turn) * s.speed,
+          vy: Math.sin(turn) * s.speed,
+          pierce: s.pierce,
+          until: time + s.durationMs,
+        });
+      }
+      return true;
+    }
+    if (kind === 'arc') {
+      // A wide arc, the way he faces.
+      const facing = hero.facing > 0 ? 0 : Math.PI;
+      const spread = Math.PI * 0.6;
+      for (let k = 0; k < s.count; k++) {
+        const turn = facing + (k / Math.max(s.count - 1, 1) - 0.5) * spread;
+        launch({
+          ...base,
+          radius: 6 + s.area / 20,
+          vx: Math.cos(turn) * s.speed,
+          vy: Math.sin(turn) * s.speed,
+          pierce: s.pierce,
+          until: time + (s.durationMs * s.area) / 70,
+        });
+      }
+      return true;
+    }
+    if (kind === 'bounce') {
+      for (let k = 0; k < s.count; k++) {
+        const turn = random.next() * 2 * Math.PI;
+        launch({
+          ...base,
+          vx: Math.cos(turn) * s.speed,
+          vy: Math.sin(turn) * s.speed,
+          pierce: Infinity,
+          until: time + s.durationMs,
+        });
+      }
+      return true;
     }
-    // Highest index first, so swap-removal leaves the others where they are.
-    hit.sort((a, b) => b - a);
-    for (const i of hit) sendHome(i);
     return true;
   }
 
+  /** The Can Opener's blades round him, now. */
+  function bladesOf(s: WeaponStats): Vec[] {
+    return Array.from({ length: s.count }, (_, k) => {
+      const angle = (time / 1000) * s.speed + (k * 2 * Math.PI) / s.count;
+      return { x: hero.x + Math.cos(angle) * s.area, y: hero.y + Math.sin(angle) * s.area };
+    });
+  }
+
+  function swingWeapons(dt: number) {
+    for (const [id, held] of weapons) {
+      const s = weaponStats(id, held.level, mods);
+      const kind = WEAPONS[id].kind;
+      if (kind === 'orbit') {
+        // Each blade, all the time, to every cat it passes through.
+        for (const blade of bladesOf(s)) {
+          for (const i of within(blade, BLADE_RADIUS + config.cats.radius)) {
+            cats[i].homesickness += s.damage * dt;
+          }
+        }
+      } else if (kind === 'zone') {
+        for (const i of within(hero, s.area)) cats[i].homesickness += s.damage * dt;
+      } else if (time >= held.readyAt && fire(id, s)) {
+        held.readyAt = time + s.cooldownMs;
+        events.push({ kind: 'fired', weapon: id });
+      }
+    }
+  }
+
+  function moveProjectiles(dt: number) {
+    const left = hero.x - viewport.width / 2;
+    const top = hero.y - viewport.height / 2;
+    for (let n = projectiles.length - 1; n >= 0; n--) {
+      const p = projectiles[n];
+      p.x += p.vx * dt;
+      p.y += p.vy * dt;
+      if (p.weapon === 'yarn-ball') {
+        // Off the edges of the screen, as he walks.
+        if (p.x < left || p.x > left + viewport.width)
+          p.vx = Math.sign(hero.x - p.x) * Math.abs(p.vx);
+        if (p.y < top || p.y > top + viewport.height)
+          p.vy = Math.sign(hero.y - p.y) * Math.abs(p.vy);
+      }
+      for (const i of within(p, p.radius + config.cats.radius)) {
+        const cat = cats[i];
+        if (p.pierce <= 0 || p.touched.includes(cat.id)) continue;
+        p.touched.push(cat.id);
+        cat.homesickness += p.damage;
+        p.pierce--;
+      }
+      if (p.pierce <= 0 || time >= p.until) {
+        // A hairball bursts into smaller ones where it ends.
+        if (p.weapon === 'hairball' && !p.bit) {
+          const s = weaponStats('hairball', weapons.get('hairball')?.level ?? 1, mods);
+          for (let k = 0; k < s.count; k++) {
+            const turn = (k * 2 * Math.PI) / s.count;
+            launch({
+              weapon: 'hairball',
+              bit: true,
+              x: p.x,
+              y: p.y,
+              vx: Math.cos(turn) * s.speed * 0.8,
+              vy: Math.sin(turn) * s.speed * 0.8,
+              radius: p.radius * 0.6,
+              damage: p.damage * 0.6,
+              pierce: 2,
+              until: time + 500,
+            });
+          }
+        }
+        projectiles[n] = projectiles[projectiles.length - 1];
+        projectiles.pop();
+        spareProjectiles.push(p);
+      }
+    }
+  }
+
+  // --------------------------------------------------------------- experience
+
+  function gatherGems(dt: number) {
+    const reach = config.gems.pickup * mods.pickup;
+    for (let i = gems.length - 1; i >= 0; i--) {
+      const gem = gems[i];
+      const dx = hero.x - gem.x;
+      const dy = hero.y - gem.y;
+      const d = Math.hypot(dx, dy);
+      if (d <= 14) {
+        xp += gem.value;
+        gems[i] = gems[gems.length - 1];
+        gems.pop();
+      } else if (d <= reach) {
+        const move = Math.min(config.gems.speed * dt, d);
+        gem.x += (dx / d) * move;
+        gem.y += (dy / d) * move;
+      }
+    }
+    while (xp >= xpToNext(level)) {
+      xp -= xpToNext(level);
+      level++;
+      pending++;
+      events.push({ kind: 'level-up', level });
+    }
+    if (pending > 0 && !choosing) offer();
+  }
+
+  function offer() {
+    const held = new Map([...weapons].map(([id, w]) => [id, w.level] as const));
+    choosing = offerChoices(held, passives, mods.choices, random);
+  }
+
   return {
     config,
 
@@ -359,13 +664,14 @@ export function createArena(options: {
     /**
      * One step of `config.stepMs`: the hero walks the way `input` points (a unit
      * vector, or zero), cats come (while `spawn` allows), walk, reach him or are
-     * sent home.
+     * sent home. Nothing moves while a level-up's choice waits.
      */
     step(input: Vec, spawn = true) {
-      if (status === 'over') return;
+      if (status === 'over' || choosing) return;
       const dt = config.stepMs / 1000;
       time += config.stepMs;
       heroStep(input, dt);
+      hero.resolve = Math.min(hero.resolve + mods.recovery * dt, maxResolve());
 
       // Arrivals: towards how many the arena wants now, a share a second at most.
       // While the frame-rate guard says no, only up to `guardFree`.
@@ -415,8 +721,12 @@ export function createArena(options: {
         }
       }
 
-      if (time >= laserReadyAt && fireLaser()) laserReadyAt = time + config.laser.cooldownMs;
+      // His weapons; what flies; then every cat homesick enough goes home.
+      swingWeapons(dt);
+      moveProjectiles(dt);
+      sweepHome();
       for (let i = beams.length - 1; i >= 0; i--) if (beams[i].until <= time) beams.splice(i, 1);
+      gatherGems(dt);
 
       // The time goal: the Matriarch comes, and ends the run when she reaches him.
       if (time >= config.timeGoalMs) {
@@ -435,6 +745,33 @@ export function createArena(options: {
       }
     },
 
+    /** The level-up's choices waiting, or null. */
+    choices: (): readonly Choice[] | null => choosing,
+    /** The level the waiting choice is for (several can wait after one gem). */
+    choiceLevel: (): number => level - pending + 1,
+
+    /** Takes the level-up's choice `index`; the run goes on (or the next level's choice comes). */
+    choose(index: number) {
+      if (!choosing) return;
+      const choice = choosing[Math.min(Math.max(index, 0), choosing.length - 1)];
+      if (choice.kind === 'weapon') {
+        const held = weapons.get(choice.id);
+        if (held) held.level = choice.level;
+        else weapons.set(choice.id, { level: 1, readyAt: time + 200 });
+      } else if (choice.kind === 'passive') {
+        const before = maxResolve();
+        passives.set(choice.id, choice.level);
+        mods = modifiers(passives);
+        // More Resolve to hold: he gains what was added.
+        hero.resolve += maxResolve() - before;
+      } else {
+        hero.resolve = Math.min(hero.resolve + 30, maxResolve());
+      }
+      pending--;
+      choosing = null;
+      if (pending > 0) offer();
+    },
+
     /** The hero gives up: the run ends where it stands. */
     giveUp() {
       end('gave-up');
@@ -449,7 +786,18 @@ export function createArena(options: {
 
     /** The live cats, as they stand (read, do not keep: the objects are reused). */
     cats: (): readonly ArenaCat[] => cats,
+    projectiles: (): readonly Projectile[] => projectiles,
+    gems: (): readonly Gem[] => gems,
     beams: (): readonly { from: Vec; to: Vec }[] => beams,
+    /** Where the Can Opener's blades are, and the Thunderous Vacuum's reach (or null). */
+    blades: (): Vec[] => {
+      const held = weapons.get('can-opener');
+      return held ? bladesOf(weaponStats('can-opener', held.level, mods)) : [];
+    },
+    zone: (): number | null => {
+      const held = weapons.get('thunderous-vacuum');
+      return held ? weaponStats('thunderous-vacuum', held.level, mods).area : null;
+    },
     matriarch: (): Vec | null => matriarch,
 
     state() {
@@ -462,14 +810,20 @@ export function createArena(options: {
           x: hero.x,
           y: hero.y,
           resolve: hero.resolve,
-          maxResolve: config.hero.resolve,
+          maxResolve: maxResolve(),
           facing: hero.facing,
           untouchable: time < hero.untouchableUntil,
           effect: active,
         },
         cats: cats.length,
         sentHome,
-        weapons: ['laser-pointer'] as const,
+        level,
+        xp,
+        xpToNext: xpToNext(level),
+        weapons: [...weapons].map(([id, held]) => ({ id, level: held.level })),
+        passives: [...passives].map(([id, l]) => ({ id, level: l })),
+        projectiles: projectiles.length,
+        gems: gems.length,
       };
     },
   };
diff --git a/app/ui/xenocats/arsenal.ts b/app/ui/xenocats/arsenal.ts
new file mode 100644
index 0000000..38576b7
--- /dev/null
+++ b/app/ui/xenocats/arsenal.ts
@@ -0,0 +1,385 @@
+// What the Keeper can carry in Survival (arena.ts): nine weapons that fire on their
+// own, up to level 8, and passives that make him or his weapons better, up to level
+// 5; at most six of each. Each level-up offers three choices (four with the Lucky
+// Bell), drawn from what he does not yet have at its highest level. Pure data and
+// rules, no DOM: arena.ts makes the weapons fire.
+
+import type { Random } from './random';
+
+export const MAX_WEAPON_LEVEL = 8;
+export const MAX_PASSIVE_LEVEL = 5;
+export const WEAPON_SLOTS = 6;
+export const PASSIVE_SLOTS = 6;
+
+export type WeaponId =
+  | 'laser-pointer'
+  | 'cat-treats'
+  | 'vacuum-cleaner'
+  | 'spray-bottle'
+  | 'yarn-ball'
+  | 'can-opener'
+  | 'hairball'
+  | 'thunderous-vacuum'
+  | 'laser-pointer-deluxe';
+
+export type PassiveId =
+  | 'rubber-chicken'
+  | 'battery'
+  | 'catnip'
+  | 'scissors'
+  | 'wool-sweater'
+  | 'warm-milk'
+  | 'long-whiskers'
+  | 'stern-look'
+  | 'lucky-bell';
+
+/** A weapon at one level, before the passives. */
+export type WeaponStats = {
+  /** Between two firings, ms (continuous weapons: unused). */
+  cooldownMs: number;
+  /** Homesickness each touch gives (continuous weapons: a second). */
+  damage: number;
+  /** Its reach, size or radius, px. */
+  area: number;
+  /** How many: beams, treats, droplets, balls, blades, jumps. */
+  count: number;
+  /** px/s, for what flies. */
+  speed: number;
+  /** How long what it makes lasts, ms. */
+  durationMs: number;
+  /** How many cats one thing it fires can touch before it is spent. */
+  pierce: number;
+};
+
+type Growth = { [K in keyof WeaponStats]: readonly [number, number] };
+
+/** Level 1 at the first value, level 8 at the second, evenly between; counts rounded down. */
+function levels(growth: Growth): WeaponStats[] {
+  return Array.from({ length: MAX_WEAPON_LEVEL }, (_, i) => {
+    const t = i / (MAX_WEAPON_LEVEL - 1);
+    const at = ([a, b]: readonly [number, number]) => a + (b - a) * t;
+    return {
+      cooldownMs: Math.round(at(growth.cooldownMs)),
+      damage: Math.round(at(growth.damage)),
+      area: Math.round(at(growth.area)),
+      count: Math.floor(at(growth.count) + 1e-9),
+      // Not rounded: some speeds are shares and turns (the vacuum's pull, the blades').
+      speed: Math.round(at(growth.speed) * 100) / 100,
+      durationMs: Math.round(at(growth.durationMs)),
+      pierce: Math.floor(at(growth.pierce) + 1e-9),
+    };
+  });
+}
+
+export type WeaponKind =
+  /** Beams at the nearest cats, at once. */
+  | 'beam'
+  /** Things fired at the nearest cat, in a spread. */
+  | 'spread'
+  /** Pulls the cats round him in. */
+  | 'pull'
+  /** Droplets in an arc the way he faces. */
+  | 'arc'
+  /** Balls that bounce round the screen. */
+  | 'bounce'
+  /** Blades that circle him. */
+  | 'orbit'
+  /** A ball that bursts into smaller ones. */
+  | 'burst'
+  /** A zone round him. */
+  | 'zone'
+  /** A beam that jumps from cat to cat. */
+  | 'chain';
+
+export type WeaponInfo = {
+  name: string;
+  /** In the game's voice. */
+  description: string;
+  kind: WeaponKind;
+  levels: readonly WeaponStats[];
+};
+
+export const WEAPONS: Readonly<Record<WeaponId, WeaponInfo>> = {
+  'laser-pointer': {
+    name: 'Laser Pointer',
+    description: 'A red dot no cat can ignore. Whatever it touches grows homesick.',
+    kind: 'beam',
+    levels: levels({
+      cooldownMs: [1100, 650],
+      damage: [20, 45],
+      area: [300, 420],
+      count: [1, 4],
+      speed: [0, 0],
+      durationMs: [180, 180],
+      pierce: [99, 99],
+    }),
+  },
+  'cat-treats': {
+    name: 'Cat Treats',
+    description: 'Thrown in a spread. Delicious, and yet they make a cat long for home.',
+    kind: 'spread',
+    levels: levels({
+      cooldownMs: [1300, 700],
+      damage: [14, 30],
+      area: [9, 13],
+      count: [3, 9],
+      speed: [420, 520],
+      durationMs: [1400, 1700],
+      pierce: [2, 5],
+    }),
+  },
+  'vacuum-cleaner': {
+    name: 'Vacuum Cleaner',
+    description: 'Now and then it draws the nearest cats in, protesting.',
+    kind: 'pull',
+    levels: levels({
+      cooldownMs: [3200, 1900],
+      damage: [6, 18],
+      area: [170, 300],
+      count: [1, 1],
+      speed: [0.35, 0.6],
+      durationMs: [300, 300],
+      pierce: [99, 99],
+    }),
+  },
+  'spray-bottle': {
+    name: 'Spray Bottle',
+    description: 'Water in a wide arc. No cat has ever forgiven it.',
+    kind: 'arc',
+    levels: levels({
+      cooldownMs: [1500, 800],
+      damage: [10, 24],
+      area: [70, 140],
+      count: [6, 16],
+      speed: [360, 460],
+      durationMs: [500, 650],
+      pierce: [2, 4],
+    }),
+  },
+  'yarn-ball': {
+    name: 'Yarn Ball',
+    description: 'It bounces about the screen, and no cat can let it pass.',
+    kind: 'bounce',
+    levels: levels({
+      cooldownMs: [3500, 2200],
+      damage: [12, 26],
+      area: [12, 18],
+      count: [1, 4],
+      speed: [300, 380],
+      durationMs: [3000, 4500],
+      pierce: [99, 99],
+    }),
+  },
+  'can-opener': {
+    name: 'Can Opener',
+    description: 'Blades that circle him. The sound alone sends cats home.',
+    kind: 'orbit',
+    levels: levels({
+      cooldownMs: [0, 0],
+      damage: [55, 110],
+      area: [70, 110],
+      count: [1, 5],
+      speed: [2.6, 4.2],
+      durationMs: [0, 0],
+      pierce: [99, 99],
+    }),
+  },
+  hairball: {
+    name: 'Hairball',
+    description: 'Coughed up at a cat. It bursts into smaller, worse hairballs.',
+    kind: 'burst',
+    levels: levels({
+      cooldownMs: [2000, 1200],
+      damage: [22, 44],
+      area: [14, 20],
+      count: [4, 9],
+      speed: [330, 400],
+      durationMs: [900, 1200],
+      pierce: [1, 1],
+    }),
+  },
+  'thunderous-vacuum': {
+    name: 'Thunderous Vacuum',
+    description: 'A vast and terrible hum. Every cat near him wishes it were elsewhere.',
+    kind: 'zone',
+    levels: levels({
+      cooldownMs: [0, 0],
+      damage: [10, 30],
+      area: [110, 190],
+      count: [1, 1],
+      speed: [0, 0],
+      durationMs: [0, 0],
+      pierce: [99, 99],
+    }),
+  },
+  'laser-pointer-deluxe': {
+    name: 'Laser Pointer Deluxe',
+    description: 'The red dot, refined: it leaps from cat to cat.',
+    kind: 'chain',
+    levels: levels({
+      cooldownMs: [1600, 900],
+      damage: [18, 36],
+      area: [220, 300],
+      count: [3, 8],
+      speed: [0, 0],
+      durationMs: [220, 220],
+      pierce: [99, 99],
+    }),
+  },
+};
+
+export type PassiveInfo = {
+  name: string;
+  description: string;
+  /** Usually MAX_PASSIVE_LEVEL; the Lucky Bell has one. */
+  maxLevel: number;
+};
+
+export const PASSIVES: Readonly<Record<PassiveId, PassiveInfo>> = {
+  'rubber-chicken': {
+    name: 'Rubber Chicken',
+    description: 'Squeaks with every step. He walks faster, to be rid of the sound.',
+    maxLevel: MAX_PASSIVE_LEVEL,
+  },
+  battery: {
+    name: 'Battery',
+    description: 'Fresh, and warm. His weapons ready themselves sooner.',
+    maxLevel: MAX_PASSIVE_LEVEL,
+  },
+  catnip: {
+    name: 'Catnip',
+    description: 'A pocketful. His weapons reach further.',
+    maxLevel: MAX_PASSIVE_LEVEL,
+  },
+  scissors: {
+    name: 'Scissors',
+    description: 'For cutting things in two. More of what his weapons fire.',
+    maxLevel: MAX_PASSIVE_LEVEL,
+  },
+  'wool-sweater': {
+    name: 'Wool Sweater',
+    description: 'Knitted long ago. More Resolve.',
+    maxLevel: MAX_PASSIVE_LEVEL,
+  },
+  'warm-milk': {
+    name: 'Warm Milk',
+    description: 'He sips, and his Resolve slowly returns.',
+    maxLevel: MAX_PASSIVE_LEVEL,
+  },
+  'long-whiskers': {
+    name: 'Long Whiskers',
+    description: 'Borrowed. He gathers experience from further off.',
+    maxLevel: MAX_PASSIVE_LEVEL,
+  },
+  'stern-look': {
+    name: 'Stern Look',
+    description: 'Practised in the mirror. Every touch makes a cat more homesick.',
+    maxLevel: MAX_PASSIVE_LEVEL,
+  },
+  'lucky-bell': {
+    name: 'Lucky Bell',
+    description: 'A small brass bell. One more choice at every level.',
+    maxLevel: 1,
+  },
+};
+
+/** What the passives held add up to. */
+export type Modifiers = {
+  speed: number;
+  cooldown: number;
+  area: number;
+  /** Added to every weapon's count. */
+  count: number;
+  maxResolve: number;
+  /** Resolve a second. */
+  recovery: number;
+  pickup: number;
+  might: number;
+  choices: number;
+};
+
+export function modifiers(passives: ReadonlyMap<PassiveId, number>): Modifiers {
+  const level = (id: PassiveId) => passives.get(id) ?? 0;
+  return {
+    speed: 1 + 0.1 * level('rubber-chicken'),
+    cooldown: 1 - 0.08 * level('battery'),
+    area: 1 + 0.1 * level('catnip'),
+    count: Math.floor(level('scissors') / 2) + (level('scissors') === MAX_PASSIVE_LEVEL ? 1 : 0),
+    maxResolve: 20 * level('wool-sweater'),
+    recovery: 0.4 * level('warm-milk'),
+    pickup: 1 + 0.25 * level('long-whiskers'),
+    might: 1 + 0.1 * level('stern-look'),
+    choices: 3 + level('lucky-bell'),
+  };
+}
+
+/** A weapon's stats at `level`, with the passives' modifiers. */
+export function weaponStats(id: WeaponId, level: number, mods: Modifiers): WeaponStats {
+  const base = WEAPONS[id].levels[Math.min(Math.max(level, 1), MAX_WEAPON_LEVEL) - 1];
+  return {
+    ...base,
+    cooldownMs: base.cooldownMs * mods.cooldown,
+    damage: base.damage * mods.might,
+    area: base.area * mods.area,
+    count: base.count + mods.count,
+  };
+}
+
+/** Experience needed from `level` to the next. */
+export function xpToNext(level: number): number {
+  return Math.round(5 + (level - 1) * 9 + Math.max(level - 1, 0) ** 1.6 * 0.8);
+}
+
+export type Choice =
+  | { kind: 'weapon'; id: WeaponId; level: number }
+  | { kind: 'passive'; id: PassiveId; level: number }
+  /** Nothing left to offer: a sip of Resolve instead. */
+  | { kind: 'restore' };
+
+/**
+ * A level-up's choices: new weapons or passives while there are slots, or the next
+ * level of one held, never one at its highest level; `count` of them, all
+ * different, at random. With nothing left, a sip of Resolve.
+ */
+export function offerChoices(
+  weapons: ReadonlyMap<WeaponId, number>,
+  passives: ReadonlyMap<PassiveId, number>,
+  count: number,
+  random: Random,
+  available: readonly WeaponId[] = Object.keys(WEAPONS) as WeaponId[]
+): Choice[] {
+  const pool: Choice[] = [];
+  for (const id of available) {
+    const level = weapons.get(id);
+    if (level === undefined) {
+      if (weapons.size < WEAPON_SLOTS) pool.push({ kind: 'weapon', id, level: 1 });
+    } else if (level < MAX_WEAPON_LEVEL) pool.push({ kind: 'weapon', id, level: level + 1 });
+  }
+  for (const id of Object.keys(PASSIVES) as PassiveId[]) {
+    const level = passives.get(id);
+    if (level === undefined) {
+      if (passives.size < PASSIVE_SLOTS) pool.push({ kind: 'passive', id, level: 1 });
+    } else if (level < PASSIVES[id].maxLevel) pool.push({ kind: 'passive', id, level: level + 1 });
+  }
+  if (pool.length === 0) return [{ kind: 'restore' }];
+  const picked: Choice[] = [];
+  while (picked.length < count && pool.length > 0) {
+    picked.push(pool.splice(random.int(0, pool.length - 1), 1)[0]);
+  }
+  return picked;
+}
+
+/** A choice's name and line, for the level-up dialog. */
+export function describeChoice(choice: Choice): { name: string; description: string } {
+  if (choice.kind === 'restore') {
+    return {
+      name: 'A Moment of Rest',
+      description: 'Nothing more to learn. Some Resolve returns.',
+    };
+  }
+  const info = choice.kind === 'weapon' ? WEAPONS[choice.id] : PASSIVES[choice.id];
+  return {
+    name: choice.level === 1 ? info.name : `${info.name}, level ${choice.level}`,
+    description: info.description,
+  };
+}
diff --git a/tests/e2e/survival.spec.ts b/tests/e2e/survival.spec.ts
index e48627f..48459fd 100644
--- a/tests/e2e/survival.spec.ts
+++ b/tests/e2e/survival.spec.ts
@@ -6,7 +6,35 @@ import { SURVIVAL_BEST_KEY } from '@/app/ui/xenocats/arena-storage';
 // and the HUD's text. `?seed=` fixes the run; `?speed=` makes time pass faster.
 
 const area = (page: Page) => page.getByTestId('survival-area');
-const num = async (page: Page, name: string) => Number(await area(page).getAttribute(name));
+const levelUp = (page: Page) => page.getByTestId('survival-level-up');
+
+/**
+ * A level-up waiting for a choice stops the run; a test of something else takes
+ * the first choice and plays on.
+ */
+async function playOn(page: Page, tap = false) {
+  if ((await levelUp(page).count()) === 0) return;
+  if (tap) await levelUp(page).getByRole('button').first().tap();
+  else await page.keyboard.press('1');
+}
+
+const num = async (page: Page, name: string) => {
+  await playOn(page);
+  return Number(await area(page).getAttribute(name));
+};
+
+/** Pauses the run with Esc (taking any level-up's choice first). */
+async function pauseRun(page: Page) {
+  const paused = page.getByRole('dialog', { name: 'Paused' });
+  await expect
+    .poll(async () => {
+      await playOn(page);
+      if ((await paused.count()) === 0) await page.keyboard.press('Escape');
+      return paused.count();
+    })
+    .toBe(1);
+  return paused;
+}
 
 async function openArena(page: Page, query = '?seed=7') {
   await page.goto('/cats/survival' + query);
@@ -40,7 +68,7 @@ test.describe('on a computer', () => {
     // No ambient cats and no fake cursor on the game's page.
     await expect(page.getByTestId('xenocat')).toHaveCount(0);
     await startRun(page);
-    await expect(area(page)).toHaveAttribute('data-weapons', 'laser-pointer');
+    await expect(area(page)).toHaveAttribute('data-weapons', 'laser-pointer:1');
     expect(await page.locator('html').getAttribute('class')).not.toContain('xenocat-cursor-hidden');
     // The canvas is hidden from assistive technology; the HUD is text.
     await expect(page.locator('canvas')).toHaveAttribute('aria-hidden', 'true');
@@ -53,9 +81,7 @@ test.describe('on a computer', () => {
     await expect(page.getByTestId('survival-sent-home')).not.toHaveText('Cats sent home: 0');
 
     // Esc pauses: a dialog, focus on Resume, and time stands still.
-    await page.keyboard.press('Escape');
-    const paused = page.getByRole('dialog', { name: 'Paused' });
-    await expect(paused).toBeVisible();
+    const paused = await pauseRun(page);
     await expect(paused.getByRole('button', { name: 'Resume' })).toBeFocused();
     const stopped = await num(page, 'data-time');
     await page.waitForTimeout(600);
@@ -64,11 +90,7 @@ test.describe('on a computer', () => {
     await expect.poll(() => num(page, 'data-time')).toBeGreaterThan(stopped);
 
     // Giving up ends the run: the results, and the best time kept.
-    await page.keyboard.press('Escape');
-    await page
-      .getByRole('dialog', { name: 'Paused' })
-      .getByRole('button', { name: 'Give up' })
-      .click();
+    await (await pauseRun(page)).getByRole('button', { name: 'Give up' }).click();
     const results = page.getByTestId('survival-results');
     await expect(results).toHaveAttribute('data-outcome', 'gave-up');
     await expect(results.getByRole('heading', { name: 'The run is over' })).toBeVisible();
@@ -101,9 +123,52 @@ test.describe('on a computer', () => {
     await page.keyboard.up('ArrowLeft');
   });
 
+  test('a level-up stops the run for a choice, made with a number key; the run goes on with it', async ({
+    page,
+  }) => {
+    test.setTimeout(60_000);
+    await openArena(page, '?seed=7&speed=6');
+    await startRun(page);
+    await expect(area(page)).toHaveAttribute('data-level', '1');
+    // He walks about, gathering what the laser leaves.
+    await page.keyboard.down('d');
+    const dialog = levelUp(page);
+    await expect(dialog).toBeVisible({ timeout: 40_000 });
+    await page.keyboard.up('d');
+    await expect(dialog.getByRole('heading', { name: /Level 2\. Choose one\./ })).toBeVisible();
+    await expect(area(page)).toHaveAttribute('data-screen', 'choosing');
+    // Focus in the dialog, on the first choice; the arrow keys move it.
+    const buttons = dialog.getByRole('button');
+    await expect(buttons.first()).toBeFocused();
+    await page.keyboard.press('ArrowDown');
+    await expect(buttons.nth(1)).toBeFocused();
+    // The run waits.
+    const waited = await area(page).getAttribute('data-time');
+    await page.waitForTimeout(500);
+    expect(await area(page).getAttribute('data-time')).toBe(waited);
+    // A new weapon, by its number.
+    const kinds = await buttons.evaluateAll((all) => all.map((b) => b.getAttribute('data-kind')));
+    const pick = Math.max(kinds.indexOf('weapon'), 0);
+    const chosen = await buttons.nth(pick).getAttribute('data-choice');
+    const chosenLevel = await buttons.nth(pick).getAttribute('data-level');
+    await page.keyboard.press(String(pick + 1));
+    await expect(dialog).toHaveCount(0);
+    await expect(area(page)).toHaveAttribute('data-screen', 'playing');
+    await expect(area(page)).toBeFocused();
+    if (kinds[pick] === 'weapon') {
+      await expect(area(page)).toHaveAttribute(
+        'data-weapons',
+        new RegExp(`${chosen}:${chosenLevel}`)
+      );
+    }
+    await expect.poll(() => num(page, 'data-time')).toBeGreaterThan(Number(waited));
+    expect(await num(page, 'data-level')).toBeGreaterThanOrEqual(2);
+  });
+
   test('losing focus pauses the run', async ({ page }) => {
     await openArena(page);
     await startRun(page);
+    await playOn(page);
     await page.evaluate(() => window.dispatchEvent(new Event('blur')));
     await expect(area(page)).toHaveAttribute('data-screen', 'paused');
     await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
@@ -115,6 +180,37 @@ test.describe('on a touch screen', () => {
   const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 7'];
   test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });
 
+  test('a level-up choice is made with a tap', async ({ page }) => {
+    test.setTimeout(60_000);
+    await openArena(page, '?seed=7&speed=6');
+    await startRun(page, true);
+    const pad = page.getByTestId('movement-pad');
+    const box = (await pad.boundingBox())!;
+    const cdp = await page.context().newCDPSession(page);
+    await cdp.send('Input.dispatchTouchEvent', {
+      type: 'touchStart',
+      touchPoints: [{ x: box.x + box.width / 2 + 50, y: box.y + box.height / 2 }],
+    });
+    const dialog = levelUp(page);
+    await expect(dialog).toBeVisible({ timeout: 40_000 });
+    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
+    await expect(dialog).toContainText('Tap a choice.');
+    const buttons = dialog.getByRole('button');
+    const kinds = await buttons.evaluateAll((all) => all.map((b) => b.getAttribute('data-kind')));
+    const pick = Math.max(kinds.indexOf('weapon'), 0);
+    const chosen = await buttons.nth(pick).getAttribute('data-choice');
+    const chosenLevel = await buttons.nth(pick).getAttribute('data-level');
+    await buttons.nth(pick).tap();
+    await expect(dialog).toHaveCount(0);
+    await expect(area(page)).toHaveAttribute('data-screen', 'playing');
+    if (kinds[pick] === 'weapon') {
+      await expect(area(page)).toHaveAttribute(
+        'data-weapons',
+        new RegExp(`${chosen}:${chosenLevel}`)
+      );
+    }
+  });
+
   test('the movement pad walks the hero, the laser sends cats home, and Pause leads to giving up', async ({
     page,
   }) => {
@@ -135,6 +231,7 @@ test.describe('on a touch screen', () => {
     await expect.poll(() => num(page, 'data-hero-x')).toBeGreaterThan(x0 + 60);
     await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
     await expect.poll(() => num(page, 'data-sent-home'), { timeout: 30_000 }).toBeGreaterThan(0);
+    await playOn(page, true);
     await area(page).getByRole('button', { name: 'Pause' }).tap();
     await page
       .getByRole('dialog', { name: 'Paused' })
diff --git a/tests/unit/xenocats/arena.test.ts b/tests/unit/xenocats/arena.test.ts
index 967b844..28338cd 100644
--- a/tests/unit/xenocats/arena.test.ts
+++ b/tests/unit/xenocats/arena.test.ts
@@ -7,6 +7,7 @@ import {
   createArena,
 } from '@/app/ui/xenocats/arena';
 import { createArenaGrid } from '@/app/ui/xenocats/arena-grid';
+import { WEAPONS } from '@/app/ui/xenocats/arsenal';
 import { bestOf, clockText, parseBest } from '@/app/ui/xenocats/arena-storage';
 import { CAT_TYPES, catTypeById } from '@/app/ui/xenocats/cat-types';
 import { createFrameGuard } from '@/app/ui/xenocats/frame-guard';
@@ -15,8 +16,16 @@ import { createRandom } from '@/app/ui/xenocats/random';
 const viewport = { width: 1280, height: 800 };
 const still = { x: 0, y: 0 };
 
+/** Gems worth nothing: no level-up interrupts a test of something else. */
+const noLevels = { gems: { ...ARENA_CONFIG.gems, value: 0, eliteValue: 0 } };
+
 function arena(config: Partial<ArenaConfig> = {}, seed = 1, types = CAT_TYPES) {
-  return createArena({ random: createRandom(seed), types, viewport, config });
+  return createArena({
+    random: createRandom(seed),
+    types,
+    viewport,
+    config: { ...noLevels, ...config },
+  });
 }
 
 /** Steps until `ms` of game time, the hero walking `input`. */
@@ -63,7 +72,7 @@ describe('the hero', () => {
         {
           escalation: [[0, 1]],
           cats: { ...ARENA_CONFIG.cats, eliteShare: 0 },
-          laser: { ...ARENA_CONFIG.laser, cooldownMs: 1e12 },
+          startingWeapons: [],
         },
         1,
         [type]
@@ -106,7 +115,7 @@ describe('elites', () => {
       {
         escalation: [[0, 1]],
         cats: { ...ARENA_CONFIG.cats, eliteShare: 1, homesickness: [1e9, 1e9] },
-        laser: { ...ARENA_CONFIG.laser, cooldownMs: 1e9 },
+        startingWeapons: [],
       },
       1,
       [catTypeById(typeId)!]
@@ -138,7 +147,7 @@ describe('elites', () => {
         escalation: [[0, 30]],
         cats: { ...ARENA_CONFIG.cats, eliteShare: 1, homesickness: [1e9, 1e9] },
         hero: { ...ARENA_CONFIG.hero, resolve: 1e9, untouchableMs: 100 },
-        laser: { ...ARENA_CONFIG.laser, cooldownMs: 1e12 },
+        startingWeapons: [],
       },
       3,
       [catTypeById('cryo-persian')!, catTypeById('gravi-coon')!]
@@ -212,7 +221,7 @@ describe('the horde', () => {
     const a = arena({
       ...unbreakable,
       stepMs: 50,
-      laser: { ...ARENA_CONFIG.laser, cooldownMs: 1e12 },
+      startingWeapons: [],
     });
     const at = (ms: number) => {
       runTo(a, ms);
@@ -231,7 +240,7 @@ describe('the horde', () => {
     const a = arena({
       ...unbreakable,
       escalation: [[0, 400]],
-      laser: { ...ARENA_CONFIG.laser, cooldownMs: 1e12 },
+      startingWeapons: [],
     });
     runTo(a, 20_000, still, false);
     // Even a screen too slow from the start gets a game...
@@ -262,7 +271,7 @@ describe('the Laser Pointer', () => {
     expect(lasers).toBeGreaterThan(5);
     expect(home).toBeGreaterThan(0);
     expect(a.state().sentHome).toBe(home);
-    expect(a.state().weapons).toEqual(['laser-pointer']);
+    expect(a.state().weapons).toEqual([{ id: 'laser-pointer', level: 1 }]);
   });
 
   it('fires no more often than its cooldown, and not at a cat out of range', () => {
@@ -276,7 +285,9 @@ describe('the Laser Pointer', () => {
       for (const e of b.drainEvents()) if (e.kind === 'laser') times.push(b.state().time);
     }
     for (let i = 1; i < times.length; i++) {
-      expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(ARENA_CONFIG.laser.cooldownMs - 1);
+      expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(
+        WEAPONS['laser-pointer'].levels[0].cooldownMs - 1
+      );
     }
   });
 });
@@ -288,7 +299,7 @@ describe('the laser, with a cat right on the Keeper', () => {
       ...unbreakable,
       escalation: [[0, 30]],
       cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [1e9, 1e9] },
-      laser: { ...ARENA_CONFIG.laser, cooldownMs: 40_000 },
+      firstShotMs: 20_000,
     });
     let beam: { from: { x: number; y: number }; to: { x: number; y: number } } | null = null;
     while (!beam && a.state().time < 30_000) {
@@ -336,7 +347,7 @@ describe('the time goal', () => {
       ],
       matriarch: { ...ARENA_CONFIG.matriarch, speed: 0 },
       hero: { ...ARENA_CONFIG.hero, resolve: 10 },
-      laser: { ...ARENA_CONFIG.laser, cooldownMs: 1e12 },
+      startingWeapons: [],
     });
     runTo(a, ARENA_CONFIG.timeGoalMs + 120_000);
     expect(a.state().status).toBe('over');
diff --git a/tests/unit/xenocats/arsenal.test.ts b/tests/unit/xenocats/arsenal.test.ts
new file mode 100644
index 0000000..2d856ef
--- /dev/null
+++ b/tests/unit/xenocats/arsenal.test.ts
@@ -0,0 +1,430 @@
+import { describe, expect, it } from 'vitest';
+import { ARENA_CONFIG, type ArenaConfig, createArena } from '@/app/ui/xenocats/arena';
+import {
+  MAX_PASSIVE_LEVEL,
+  MAX_WEAPON_LEVEL,
+  PASSIVES,
+  type PassiveId,
+  PASSIVE_SLOTS,
+  WEAPONS,
+  WEAPON_SLOTS,
+  type WeaponId,
+  describeChoice,
+  modifiers,
+  offerChoices,
+  weaponStats,
+  xpToNext,
+} from '@/app/ui/xenocats/arsenal';
+import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
+import { createRandom } from '@/app/ui/xenocats/random';
+
+const viewport = { width: 1280, height: 800 };
+const still = { x: 0, y: 0 };
+const ALL_WEAPONS = Object.keys(WEAPONS) as WeaponId[];
+const ALL_PASSIVES = Object.keys(PASSIVES) as PassiveId[];
+const none = modifiers(new Map());
+
+function arena(config: Partial<ArenaConfig> = {}, seed = 1) {
+  return createArena({ random: createRandom(seed), types: CAT_TYPES, viewport, config });
+}
+
+/** A hero nothing wears down, and gems worth nothing (no level-up interrupts). */
+const steady: Partial<ArenaConfig> = {
+  hero: { ...ARENA_CONFIG.hero, resolve: 1e12 },
+  gems: { ...ARENA_CONFIG.gems, value: 0, eliteValue: 0 },
+};
+
+describe('experience', () => {
+  it('each level needs more than the last, starting small', () => {
+    expect(xpToNext(1)).toBe(5);
+    for (let level = 1; level < 60; level++) {
+      expect(xpToNext(level + 1)).toBeGreaterThan(xpToNext(level));
+    }
+  });
+});
+
+describe('the level-up offer', () => {
+  const random = () => createRandom(4);
+
+  it('offers three different choices, four with the Lucky Bell', () => {
+    for (let seed = 1; seed < 30; seed++) {
+      const offer = offerChoices(new Map([['laser-pointer', 1]]), new Map(), 3, createRandom(seed));
+      expect(offer).toHaveLength(3);
+      expect(new Set(offer.map((c) => JSON.stringify(c))).size).toBe(3);
+    }
+    const bell = modifiers(new Map([['lucky-bell', 1]]));
+    expect(bell.choices).toBe(4);
+    expect(
+      offerChoices(new Map(), new Map([['lucky-bell', 1]]), bell.choices, random())
+    ).toHaveLength(4);
+  });
+
+  it('never offers what is at its highest level', () => {
+    const weapons = new Map<WeaponId, number>([['laser-pointer', MAX_WEAPON_LEVEL]]);
+    const passives = new Map<PassiveId, number>([
+      ['battery', MAX_PASSIVE_LEVEL],
+      ['lucky-bell', 1],
+    ]);
+    for (let seed = 1; seed < 60; seed++) {
+      for (const choice of offerChoices(weapons, passives, 4, createRandom(seed))) {
+        if (choice.kind === 'weapon') expect(choice.id).not.toBe('laser-pointer');
+        if (choice.kind === 'passive') {
+          expect(choice.id).not.toBe('battery');
+          expect(choice.id).not.toBe('lucky-bell');
+        }
+      }
+    }
+  });
+
+  it('offers the next level of what is held, and nothing new once the slots are full', () => {
+    const weapons = new Map<WeaponId, number>(
+      ALL_WEAPONS.slice(0, WEAPON_SLOTS).map((id) => [id, 2])
+    );
+    const passives = new Map<PassiveId, number>(
+      ALL_PASSIVES.slice(0, PASSIVE_SLOTS).map((id) => [id, 1])
+    );
+    for (let seed = 1; seed < 60; seed++) {
+      for (const choice of offerChoices(weapons, passives, 4, createRandom(seed))) {
+        if (choice.kind === 'weapon') {
+          expect(weapons.has(choice.id)).toBe(true);
+          expect(choice.level).toBe(3);
+        }
+        if (choice.kind === 'passive') {
+          expect(passives.has(choice.id)).toBe(true);
+          expect(choice.level).toBe(2);
+        }
+      }
+    }
+  });
+
+  it('with everything at its highest, a moment of rest instead', () => {
+    const weapons = new Map<WeaponId, number>(
+      ALL_WEAPONS.slice(0, WEAPON_SLOTS).map((id) => [id, MAX_WEAPON_LEVEL])
+    );
+    const passives = new Map<PassiveId, number>(
+      ALL_PASSIVES.slice(0, PASSIVE_SLOTS).map((id) => [id, PASSIVES[id].maxLevel])
+    );
+    const offer = offerChoices(weapons, passives, 3, random());
+    expect(offer).toEqual([{ kind: 'restore' }]);
+    expect(describeChoice(offer[0]).name).toBe('A Moment of Rest');
+  });
+
+  it('every choice has a name and a line in the game’s voice', () => {
+    for (const id of ALL_WEAPONS) {
+      expect(describeChoice({ kind: 'weapon', id, level: 1 }).name).toBe(WEAPONS[id].name);
+      expect(describeChoice({ kind: 'weapon', id, level: 3 }).name).toContain('level 3');
+    }
+    for (const id of ALL_PASSIVES) expect(PASSIVES[id].description.length).toBeGreaterThan(10);
+  });
+});
+
+describe('the passives', () => {
+  it('each does what it says', () => {
+    const at = (id: PassiveId, level = 3) => modifiers(new Map([[id, level]]));
+    expect(at('rubber-chicken').speed).toBeGreaterThan(none.speed);
+    expect(at('battery').cooldown).toBeLessThan(none.cooldown);
+    expect(at('catnip').area).toBeGreaterThan(none.area);
+    expect(at('scissors', MAX_PASSIVE_LEVEL).count).toBeGreaterThan(none.count);
+    expect(at('wool-sweater').maxResolve).toBeGreaterThan(none.maxResolve);
+    expect(at('warm-milk').recovery).toBeGreaterThan(none.recovery);
+    expect(at('long-whiskers').pickup).toBeGreaterThan(none.pickup);
+    expect(at('stern-look').might).toBeGreaterThan(none.might);
+    expect(at('lucky-bell', 1).choices).toBe(4);
+    // ...and reach the weapons.
+    const plain = weaponStats('cat-treats', 1, none);
+    const tuned = weaponStats(
+      'cat-treats',
+      1,
+      modifiers(
+        new Map([
+          ['battery', 5],
+          ['catnip', 5],
+          ['scissors', 5],
+          ['stern-look', 5],
+        ])
+      )
+    );
+    expect(tuned.cooldownMs).toBeLessThan(plain.cooldownMs);
+    expect(tuned.area).toBeGreaterThan(plain.area);
+    expect(tuned.count).toBeGreaterThan(plain.count);
+    expect(tuned.damage).toBeGreaterThan(plain.damage);
+  });
+});
+
+describe('every weapon, at level 1 and at its top level', () => {
+  /** A run with only `id`, at `level`, cats all round; how many it sent home, and the arena. */
+  function trial(id: WeaponId, level: number, ms = 25_000) {
+    const a = arena({
+      ...steady,
+      startingWeapons: [id],
+      startingLevel: level,
+      escalation: [[0, 60]],
+      cats: { ...ARENA_CONFIG.cats, eliteShare: 0 },
+    });
+    while (a.state().time < ms) a.step(still);
+    return { sent: a.state().sentHome, a };
+  }
+
+  for (const id of ALL_WEAPONS) {
+    it(`${id}: grows stronger with its levels, and sends cats home at both`, () => {
+      const one = weaponStats(id, 1, none);
+      const top = weaponStats(id, MAX_WEAPON_LEVEL, none);
+      expect(top.damage).toBeGreaterThan(one.damage);
+      expect(top.area).toBeGreaterThanOrEqual(one.area);
+      expect(top.count).toBeGreaterThanOrEqual(one.count);
+      if (one.cooldownMs > 0) expect(top.cooldownMs).toBeLessThan(one.cooldownMs);
+      const low = trial(id, 1).sent;
+      const high = trial(id, MAX_WEAPON_LEVEL).sent;
+      expect(low).toBeGreaterThan(0);
+      expect(high).toBeGreaterThan(low);
+    });
+  }
+
+  it('the Laser Pointer at its top level aims several beams at once', () => {
+    const a = arena({ ...steady, startingLevel: 8, escalation: [[0, 60]] });
+    let most = 0;
+    while (a.state().time < 15_000) {
+      a.step(still);
+      most = Math.max(most, a.drainEvents().filter((e) => e.kind === 'laser').length);
+    }
+    expect(most).toBe(weaponStats('laser-pointer', 8, none).count);
+  });
+
+  it('Cat Treats fly in a spread of their count', () => {
+    const a = arena({ ...steady, startingWeapons: ['cat-treats'], escalation: [[0, 20]] });
+    while (a.state().projectiles === 0 && a.state().time < 20_000) a.step(still);
+    expect(a.state().projectiles).toBe(weaponStats('cat-treats', 1, none).count);
+  });
+
+  it('the Can Opener’s blades circle him at their reach; the Thunderous Vacuum touches only what is near', () => {
+    const blades = arena({ ...steady, startingWeapons: ['can-opener'], startingLevel: 8 });
+    const s = weaponStats('can-opener', 8, none);
+    expect(blades.blades()).toHaveLength(s.count);
+    for (const blade of blades.blades()) expect(Math.hypot(blade.x, blade.y)).toBeCloseTo(s.area);
+    const zone = arena({
+      ...steady,
+      startingWeapons: ['thunderous-vacuum'],
+      escalation: [[0, 40]],
+      cats: { ...ARENA_CONFIG.cats, homesickness: [1e9, 1e9] },
+    });
+    const radius = weaponStats('thunderous-vacuum', 1, none).area;
+    // Long enough for the slowest cats to walk in from off screen.
+    while (zone.state().time < 20_000) zone.step(still);
+    for (const cat of zone.cats()) {
+      if (Math.hypot(cat.x, cat.y) > radius + 30) expect(cat.homesickness).toBe(0);
+    }
+    expect(zone.cats().some((c) => c.homesickness > 0)).toBe(true);
+  });
+
+  it('a Hairball bursts into smaller ones, as many as its count', () => {
+    const a = arena({
+      ...steady,
+      startingWeapons: ['hairball'],
+      escalation: [[0, 30]],
+      cats: { ...ARENA_CONFIG.cats, homesickness: [1e9, 1e9] },
+    });
+    let most = 0;
+    while (a.state().time < 15_000) {
+      a.step(still);
+      most = Math.max(most, a.projectiles().filter((p) => p.bit).length);
+    }
+    expect(most).toBeGreaterThanOrEqual(weaponStats('hairball', 1, none).count);
+  });
+
+  it('a Yarn Ball stays on the screen, bouncing off its edges', () => {
+    const a = arena({ ...steady, startingWeapons: ['yarn-ball'], escalation: [[0, 0]] });
+    let seen = 0;
+    while (a.state().time < 3000) {
+      a.step(still);
+      for (const p of a.projectiles()) {
+        seen++;
+        expect(Math.abs(p.x)).toBeLessThanOrEqual(viewport.width / 2 + 20);
+        expect(Math.abs(p.y)).toBeLessThanOrEqual(viewport.height / 2 + 20);
+      }
+    }
+    expect(seen).toBeGreaterThan(0);
+  });
+
+  it('the Vacuum Cleaner draws the cats round him in', () => {
+    const a = arena({
+      ...steady,
+      startingWeapons: ['vacuum-cleaner'],
+      escalation: [[0, 30]],
+      cats: { ...ARENA_CONFIG.cats, homesickness: [1e9, 1e9], speed: [0, 0] },
+    });
+    // Cats that do not walk: only the vacuum moves them. All thirty first, then he
+    // walks among them; any cat that moves was drawn in, from within its reach.
+    while (a.state().cats < 30) a.step(still);
+    const area = weaponStats('vacuum-cleaner', 1, none).area;
+    const where = new Map(a.cats().map((c) => [c.id, { x: c.x, y: c.y }]));
+    let pulled = 0;
+    while (a.state().time < 30_000) {
+      const hero = { ...a.state().hero };
+      // Towards the nearest cat.
+      const target = a
+        .cats()
+        .reduce((p, c) =>
+          Math.hypot(c.x - hero.x, c.y - hero.y) < Math.hypot(p.x - hero.x, p.y - hero.y) ? c : p
+        );
+      const d = Math.hypot(target.x - hero.x, target.y - hero.y) || 1;
+      // Not onto it: a cat at his feet is not drawn anywhere.
+      a.step(d < 120 ? still : { x: (target.x - hero.x) / d, y: (target.y - hero.y) / d });
+      for (const cat of a.cats()) {
+        const before = where.get(cat.id)!;
+        if (Math.hypot(cat.x - before.x, cat.y - before.y) < 1e-9) continue;
+        pulled++;
+        // From within its reach, towards him.
+        expect(Math.hypot(before.x - hero.x, before.y - hero.y)).toBeLessThan(area + 10);
+        expect(Math.hypot(cat.x - hero.x, cat.y - hero.y)).toBeLessThan(
+          Math.hypot(before.x - hero.x, before.y - hero.y)
+        );
+        where.set(cat.id, { x: cat.x, y: cat.y });
+      }
+    }
+    expect(pulled).toBeGreaterThan(0);
+  });
+});
+
+describe('what each weapon does, at level 1 and at level 8', () => {
+  /** A run with only `id` at `level`, cats that never go home, all round him. */
+  function only(id: WeaponId, level: number, cats = 60) {
+    return arena({
+      ...steady,
+      startingWeapons: [id],
+      startingLevel: level,
+      escalation: [[0, cats]],
+      cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [1e9, 1e9] },
+    });
+  }
+
+  for (const level of [1, MAX_WEAPON_LEVEL]) {
+    it(`level ${level}: each firing is as many beams, treats, droplets, bits and jumps as its count`, () => {
+      const counts: Partial<Record<WeaponId, number>> = {};
+      for (const id of [
+        'laser-pointer',
+        'cat-treats',
+        'spray-bottle',
+        'yarn-ball',
+        'laser-pointer-deluxe',
+      ] as WeaponId[]) {
+        const a = only(id, level);
+        let most = 0;
+        while (a.state().time < 20_000) {
+          const before = a.state().projectiles;
+          a.step(still);
+          const events = a.drainEvents();
+          if (!events.some((e) => e.kind === 'fired')) continue;
+          const lasers = events.filter((e) => e.kind === 'laser').length;
+          const launched = a.state().projectiles - before;
+          most = Math.max(
+            most,
+            WEAPONS[id].kind === 'beam' || WEAPONS[id].kind === 'chain' ? lasers : launched
+          );
+        }
+        counts[id] = most;
+        expect(most, id).toBe(weaponStats(id, level, none).count);
+      }
+      // A hairball, ended, bursts into its count of bits.
+      const h = only('hairball', level, 30);
+      let bits = 0;
+      while (h.state().time < 20_000) {
+        h.step(still);
+        bits = Math.max(bits, h.projectiles().filter((p) => p.bit).length);
+      }
+      expect(bits).toBeGreaterThanOrEqual(weaponStats('hairball', level, none).count);
+    });
+
+    it(`level ${level}: every weapon that fires waits its cooldown between firings`, () => {
+      for (const id of ALL_WEAPONS) {
+        const s = weaponStats(id, level, none);
+        if (s.cooldownMs === 0) continue;
+        const a = only(id, level);
+        const times: number[] = [];
+        while (a.state().time < 25_000) {
+          a.step(still);
+          for (const e of a.drainEvents()) if (e.kind === 'fired') times.push(a.state().time);
+        }
+        expect(times.length, id).toBeGreaterThan(2);
+        for (let i = 1; i < times.length; i++) {
+          expect(times[i] - times[i - 1], id).toBeGreaterThanOrEqual(s.cooldownMs - 1);
+        }
+        // ...and no longer than that, with cats always in reach.
+        expect(Math.min(...times.slice(1).map((t, i) => t - times[i])), id).toBeLessThan(
+          s.cooldownMs + 50
+        );
+      }
+    });
+
+    it(`level ${level}: a thrown thing touches as many cats as its pierce, then it is spent`, () => {
+      for (const id of ['cat-treats', 'spray-bottle', 'hairball'] as WeaponId[]) {
+        const pierce = weaponStats(id, level, none).pierce;
+        const a = only(id, level, 200);
+        let spentSeen = false;
+        while (a.state().time < 20_000) {
+          a.step(still);
+          for (const p of a.projectiles()) {
+            if (p.bit) continue;
+            // Never more than its pierce; a shot with none left is never still flying.
+            expect(p.touched.length + p.pierce, id).toBe(pierce);
+            expect(p.pierce, id).toBeGreaterThanOrEqual(1);
+            if (p.touched.length === pierce - 1) spentSeen = true;
+          }
+        }
+        expect(spentSeen, id).toBe(true);
+      }
+    });
+  }
+});
+
+describe('levels in a run', () => {
+  it('cats sent home leave gems; gathered, they bring a level, and the run waits for a choice', () => {
+    const a = arena({
+      hero: { ...ARENA_CONFIG.hero, resolve: 1e12 },
+      escalation: [[0, 40]],
+    });
+    while (!a.choices() && a.state().time < 60_000) a.step(still);
+    const offer = a.choices();
+    expect(offer).not.toBeNull();
+    expect(a.state().level).toBe(2);
+    expect(offer!.length).toBe(3);
+    // The run waits.
+    const time = a.state().time;
+    for (let i = 0; i < 30; i++) a.step(still);
+    expect(a.state().time).toBe(time);
+    // A new weapon chosen: held from then on, and the run goes on.
+    const pick = offer!.findIndex((c) => c.kind === 'weapon' && c.level === 1);
+    if (pick >= 0) {
+      const chosen = offer![pick];
+      a.choose(pick);
+      expect(a.state().weapons.map((w) => w.id)).toContain(chosen.kind === 'weapon' && chosen.id);
+    } else {
+      a.choose(0);
+    }
+    a.step(still);
+    expect(a.state().time).toBeGreaterThan(time);
+  });
+
+  it('a seeded five-minute run, choices made for it, ends with the screen full of attacks', () => {
+    const a = arena({ hero: { ...ARENA_CONFIG.hero, resolve: 1e12 }, stepMs: 50 }, 11);
+    let most = 0;
+    while (a.state().time < 300_000) {
+      const offer = a.choices();
+      if (offer) {
+        // Weapons first, new or better, as a player bent on attacks would.
+        const weapon = offer.findIndex((c) => c.kind === 'weapon');
+        a.choose(weapon >= 0 ? weapon : 0);
+        continue;
+      }
+      // He walks a wide circle, gathering what falls.
+      const t = a.state().time / 1500;
+      a.step({ x: -Math.sin(t), y: Math.cos(t) });
+      if (a.state().time > 240_000) {
+        most = Math.max(most, a.state().projectiles + a.beams().length + a.blades().length);
+      }
+    }
+    expect(a.state().weapons.length).toBe(6);
+    expect(a.state().level).toBeGreaterThan(20);
+    // Many attacks alive at once: things in flight, beams, blades.
+    expect(most).toBeGreaterThan(30);
+  }, 60_000);
+});
~~~~

</details>

#### T8 — `night-2026-10-07-t8-varieties`

Nine cat varieties with their own drawings and gaits, the schedule, kitten swarms, the Mega Cat boss and its bar, chests (`varieties.ts`). Why: plan task 8 (D43–D50).

<details><summary>Code: 9 files changed, 1096 insertions(+), 79 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 0d3bfac..8346dbb 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -48,7 +48,8 @@ jobs:
       - name: Unit tests (cats, games, page, sound)
         if: ${{ !cancelled() }}
         run: >-
-          npx vitest run tests/unit/xenocats/arena tests/unit/xenocats/arsenal tests/unit/xenocats/walking
+          npx vitest run tests/unit/xenocats/arena tests/unit/xenocats/arsenal tests/unit/xenocats/varieties
+          tests/unit/xenocats/walking
           tests/unit/xenocats/locked-pointer
           tests/unit/xenocats/taming tests/unit/xenocats/page-hits tests/unit/xenocats/sounds
           tests/unit/xenocats/field-guide tests/unit/xenocats/pet-cat tests/unit/xenocats/combos
diff --git a/app/ui/xenocats/arena-art.ts b/app/ui/xenocats/arena-art.ts
index 9903540..5df321d 100644
--- a/app/ui/xenocats/arena-art.ts
+++ b/app/ui/xenocats/arena-art.ts
@@ -20,3 +20,77 @@ export const HERO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" heig
   <rect x="50" y="30.5" width="9" height="4" rx="1.5" fill="${AURA}"/>
   <circle cx="59.5" cy="32.5" r="2" fill="${PLASMA}"/>
 </svg>`;
+
+/**
+ * A sitting cat, front on, in a 64×64 box: body, head, ears, eyes, a tail; `extra`
+ * is drawn on top (stripes, a box, a glow). Each variety its own colours.
+ */
+function catSvg(o: {
+  fur: string;
+  belly: string;
+  eyes: string;
+  extra?: string;
+  under?: string;
+}): string {
+  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
+  ${o.under ?? ''}
+  <path d="M46 50 Q60 46 56 30" stroke="${o.fur}" stroke-width="5" fill="none" stroke-linecap="round"/>
+  <ellipse cx="32" cy="46" rx="15" ry="13" fill="${o.fur}"/>
+  <ellipse cx="32" cy="49" rx="8" ry="8" fill="${o.belly}"/>
+  <path d="M19 22 L21 8 L28 17 Z M45 22 L43 8 L36 17 Z" fill="${o.fur}"/>
+  <path d="M21.5 18 L22.5 12 L26 16 Z M42.5 18 L41.5 12 L38 16 Z" fill="${o.belly}"/>
+  <circle cx="32" cy="26" r="12" fill="${o.fur}"/>
+  <ellipse cx="27" cy="25" rx="2.6" ry="3.4" fill="${o.eyes}"/>
+  <ellipse cx="37" cy="25" rx="2.6" ry="3.4" fill="${o.eyes}"/>
+  <path d="M30.5 30 L33.5 30 L32 31.6 Z" fill="${o.belly}"/>
+  ${o.extra ?? ''}
+</svg>`;
+}
+
+/** The varieties' drawings (varieties.ts). Placeholders until a Superdesign pass. */
+export const VARIETY_SVG: Readonly<Record<string, string>> = {
+  basic: catSvg({ fur: '#8a8aa0', belly: '#c9c9d6', eyes: PLASMA }),
+  zoomies: catSvg({
+    fur: '#e8963f',
+    belly: '#f6d3a6',
+    eyes: CREAM,
+    under: `<path d="M2 40 H14 M0 48 H12 M4 56 H14" stroke="${CREAM}" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>`,
+  }),
+  hissing: catSvg({
+    fur: '#1b1d2b',
+    belly: '#3a3d55',
+    eyes: '#ef4444',
+    extra: `<path d="M26 33 L28 31 L30 33 L32 31 L34 33 L36 31 L38 33" stroke="${CREAM}" stroke-width="1.4" fill="none"/>`,
+  }),
+  fat: catSvg({
+    fur: '#e0d0a8',
+    belly: '#f5ecd5',
+    eyes: '#5b4a2e',
+    extra: `<ellipse cx="32" cy="47" rx="20" ry="15" fill="#e0d0a8" opacity="0.55"/>`,
+  }),
+  kitten: catSvg({ fur: '#f3f0ea', belly: '#ffd1dc', eyes: AURA }),
+  box: catSvg({
+    fur: '#6f6f86',
+    belly: '#b6b6c8',
+    eyes: PLASMA,
+    extra: `<path d="M10 38 H54 V60 H10 Z" fill="#b8874f" stroke="#7a5630" stroke-width="2"/><path d="M10 38 L4 30 H22 L26 38 M54 38 L60 30 H42 L38 38" fill="#c99a62" stroke="#7a5630" stroke-width="2"/>`,
+  }),
+  laser: catSvg({
+    fur: '#4b4f6b',
+    belly: '#8e93b5',
+    eyes: '#ef4444',
+    extra: `<rect x="22" y="22" width="20" height="6" rx="3" fill="${VOID}" opacity="0.85"/><circle cx="27" cy="25" r="1.6" fill="#ef4444"/><circle cx="37" cy="25" r="1.6" fill="#ef4444"/>`,
+  }),
+  possessed: catSvg({
+    fur: '#d9dcf2',
+    belly: '#f1f2fb',
+    eyes: AURA,
+    under: `<circle cx="32" cy="34" r="27" fill="${AURA}" opacity="0.18"/>`,
+  }),
+  mega: catSvg({
+    fur: '#e8822f',
+    belly: '#f8c98f',
+    eyes: '#2a1a0a',
+    extra: `<path d="M24 16 L26 21 M32 14 V20 M40 16 L38 21 M20 42 Q24 40 22 46 M44 42 Q40 40 42 46" stroke="#a24e12" stroke-width="2.2" stroke-linecap="round" fill="none"/>`,
+  }),
+};
diff --git a/app/ui/xenocats/arena-view.tsx b/app/ui/xenocats/arena-view.tsx
index 043e1d0..19ad6dc 100644
--- a/app/ui/xenocats/arena-view.tsx
+++ b/app/ui/xenocats/arena-view.tsx
@@ -3,7 +3,7 @@
 import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
 import { Button } from '@/app/ui/button';
 import { type Arena, ARENA_CONFIG, type ArenaOutcome, BLADE_RADIUS, createArena } from './arena';
-import { HERO_SVG } from './arena-art';
+import { HERO_SVG, VARIETY_SVG } from './arena-art';
 import { type Choice, describeChoice } from './arsenal';
 import { SURVIVAL_BEST_KEY, bestOf, clockText, readBest, writeBest } from './arena-storage';
 import { catArt } from './cat-art';
@@ -13,6 +13,7 @@ import { createFrameGuard } from './frame-guard';
 import { MovementPad } from './movement-pad-view';
 import { createRandom, freshSeed } from './random';
 import { type SoundPlayer, sharedSoundPlayer, soundsFor } from './sounds';
+import { SCHEDULE, VARIETIES, type VarietyId } from './varieties';
 import { isWalkKey, walkDirection } from './walking';
 import type { Vec } from './effects';
 
@@ -27,7 +28,8 @@ import type { Vec } from './effects';
 // picked with 1–4, the arrow keys and Enter, or a tap; focus moves into it and back.
 //
 // Test hooks, read from the page's address when a run starts: `?seed=` fixes the
-// random source, `?speed=` (up to 50) makes time pass that much faster.
+// random source, `?speed=` (up to 50) makes time pass that much faster, `?boss=`
+// (seconds) brings a Mega Cat that early, besides the schedule's.
 
 type Screen = 'start' | 'playing' | 'choosing' | 'paused' | 'results';
 
@@ -63,6 +65,8 @@ type Hud = {
   heroX: number;
   heroY: number;
   effect: string | null;
+  /** The Mega Cat on the field, if one is: how homesick, of how much. */
+  boss: { homesickness: number; limit: number } | null;
   level: number;
   xp: number;
   xpToNext: number;
@@ -75,16 +79,21 @@ const OUTCOME_TEXT: Record<ArenaOutcome, string> = {
   goal: 'Five minutes, and the night is survived. The cats remain.',
 };
 
-function testHooks(): { seed: number; speed: number } {
+function testHooks(): { seed: number; speed: number; boss: number | null } {
   const params = new URLSearchParams(window.location.search);
   const seed = Number(params.get('seed'));
   const speed = Number(params.get('speed'));
+  const boss = params.has('boss') ? Number(params.get('boss')) : NaN;
   return {
     seed: Number.isInteger(seed) && seed > 0 ? seed : freshSeed(),
     speed: Number.isFinite(speed) && speed >= 1 ? Math.min(speed, 50) : 1,
+    boss: Number.isFinite(boss) && boss >= 0 ? boss * 1000 : null,
   };
 }
 
+/** A sound for a cat of any kind: a variety sounds like the first xenocat type. */
+const typeOf = (type: number) => CAT_TYPES[type] ?? CAT_TYPES[0];
+
 /** A bitmap of `src`, `size` px square, drawn once; null until it has loaded. */
 function bitmapOf(src: string, size: number, onReady: () => void): () => HTMLCanvasElement | null {
   let ready: HTMLCanvasElement | null = null;
@@ -150,7 +159,7 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
   );
 
   const start = () => {
-    const { seed, speed } = testHooks();
+    const { seed, speed, boss } = testHooks();
     speedRef.current = speed;
     playerRef.current ??= sharedSoundPlayer();
     // The click that started the run is the gesture sound needs.
@@ -159,6 +168,10 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
       random: createRandom(seed),
       types: CAT_TYPES,
       viewport: { width: window.innerWidth, height: window.innerHeight },
+      config:
+        boss === null
+          ? {}
+          : { schedule: { ...SCHEDULE, bosses: [boss, ...SCHEDULE.bosses].sort((a, b) => a - b) } },
     });
     setOutcome(null);
     setHud(null);
@@ -247,6 +260,16 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
       redraw
     );
     const titan = CAT_TYPES.findIndex((type) => type.id === 'titan-forest-cat');
+    const varietySprites = Object.fromEntries(
+      (Object.keys(VARIETIES) as VarietyId[]).map((id) => [
+        id,
+        bitmapOf(
+          `data:image/svg+xml;charset=utf-8,${encodeURIComponent(VARIETY_SVG[id])}`,
+          id === 'mega' ? 256 : 128,
+          redraw
+        ),
+      ])
+    ) as Record<VarietyId, () => HTMLCanvasElement | null>;
 
     const guard = createFrameGuard(FRAME_GUARD);
     const held = new Set<string>();
@@ -332,23 +355,34 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
       }
       context.shadowBlur = 0;
 
+      // The chests lying about.
+      for (const chest of arena.chests()) {
+        const x = chest.x - camX;
+        const y = chest.y - camY;
+        if (x < -20 || y < -20 || x > width + 20 || y > height + 20) continue;
+        context.fillStyle = '#b8874f';
+        context.fillRect(x - 12, y - 8, 24, 16);
+        context.fillStyle = '#c1e838';
+        context.fillRect(x - 3, y - 3, 6, 6);
+      }
+
       // The cats; an elite ringed, a homesick one with its bar.
-      const half = CAT_SIZE / 2;
       for (const cat of arena.cats()) {
         const x = cat.x - camX;
         const y = cat.y - camY;
-        if (x < -CAT_SIZE || y < -CAT_SIZE || x > width + CAT_SIZE || y > height + CAT_SIZE) {
-          continue;
-        }
-        const bitmap = sprites[cat.type]();
-        if (bitmap) context.drawImage(bitmap, x - half, y - half, CAT_SIZE, CAT_SIZE);
+        // A variety is drawn at its own size; a xenocat at the cats' size.
+        const size = cat.variety ? cat.radius * 2.8 : CAT_SIZE;
+        const half = size / 2;
+        if (x < -size || y < -size || x > width + size || y > height + size) continue;
+        const bitmap = cat.variety ? varietySprites[cat.variety]() : sprites[cat.type]();
+        if (bitmap) context.drawImage(bitmap, x - half, y - half, size, size);
         else {
-          context.fillStyle = CAT_TYPES[cat.type].palette.body;
+          context.fillStyle = cat.variety ? '#8a8aa0' : CAT_TYPES[cat.type].palette.body;
           context.beginPath();
           context.arc(x, y, half * 0.7, 0, 2 * Math.PI);
           context.fill();
         }
-        if (cat.elite) {
+        if (cat.elite && !cat.variety) {
           context.strokeStyle = '#9d86ff';
           context.lineWidth = 2;
           context.beginPath();
@@ -357,12 +391,25 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
         }
         if (cat.homesickness > 0) {
           context.fillStyle = 'rgba(7, 11, 20, 0.8)';
-          context.fillRect(x - half, y - half - 6, CAT_SIZE, 4);
+          context.fillRect(x - half, y - half - 6, size, 4);
           context.fillStyle = '#9d86ff';
-          context.fillRect(x - half, y - half - 6, (CAT_SIZE * cat.homesickness) / cat.limit, 4);
+          context.fillRect(
+            x - half,
+            y - half - 6,
+            (size * Math.min(cat.homesickness, cat.limit)) / cat.limit,
+            4
+          );
         }
       }
 
+      // The Laser Cats' shots.
+      context.fillStyle = '#ef4444';
+      for (const shot of arena.shots()) {
+        context.beginPath();
+        context.arc(shot.x - camX, shot.y - camY, 5, 0, 2 * Math.PI);
+        context.fill();
+      }
+
       // What his weapons fired, and the Can Opener's blades.
       for (const shot of arena.projectiles()) {
         const x = shot.x - camX;
@@ -460,10 +507,14 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
       for (const event of arena.drainEvents()) {
         if (event.kind === 'sent-home') {
           flashes.push({ x: event.x, y: event.y, until: now + 300 });
-          if (player) sound(() => player.play(soundsFor(CAT_TYPES[event.type]).purr));
+          if (player) sound(() => player.play(soundsFor(typeOf(event.type)).purr));
         } else if (event.kind === 'hero-hit') {
-          hits.push(event.type);
-          if (player) sound(() => player.play(soundsFor(CAT_TYPES[event.type]).attack));
+          if (event.type >= 0) hits.push(event.type);
+          if (player) sound(() => player.play(soundsFor(typeOf(event.type)).attack));
+        } else if (event.kind === 'boss' && titan >= 0) {
+          if (player) player.play(soundsFor(CAT_TYPES[titan]).wake);
+        } else if (event.kind === 'chest') {
+          if (player) sound(() => player.play(soundsFor(CAT_TYPES[0]).arrive));
         } else if (event.kind === 'level-up') {
           if (player) sound(() => player.play(soundsFor(CAT_TYPES[0]).arrive));
         } else if (event.kind === 'matriarch' && titan >= 0 && player) {
@@ -476,7 +527,7 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
       if (!over) for (const type of hits) recordStat(CAT_TYPES[type].id, 'survived');
       // Each type in the field guide, once a run, as it is first met.
       for (const cat of arena.cats()) {
-        if (met.has(cat.type)) continue;
+        if (cat.type < 0 || met.has(cat.type)) continue;
         met.add(cat.type);
         recordStat(CAT_TYPES[cat.type].id, 'met');
       }
@@ -495,6 +546,7 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
           heroX: Math.round(state.hero.x),
           heroY: Math.round(state.hero.y),
           effect: state.hero.effect,
+          boss: state.boss,
           level: state.level,
           xp: state.xp,
           xpToNext: state.xpToNext,
@@ -639,11 +691,36 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
           data-hero-y={hud?.heroY ?? 0}
           data-effect={hud?.effect ?? ''}
           data-level={hud?.level ?? 1}
+          data-boss={hud?.boss ? Math.round(hud.boss.homesickness) : ''}
           data-weapons={hud?.weapons ?? 'laser-pointer:1'}
           data-best-key={SURVIVAL_BEST_KEY}
           className="fixed inset-0 z-[9998] select-none overflow-hidden bg-void outline-none"
         >
           <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
+          {hud?.boss && (
+            <div
+              data-testid="survival-boss"
+              className="pointer-events-none absolute inset-x-0 top-24 mx-auto flex w-full max-w-md flex-col items-center gap-1 px-4 text-sm font-semibold text-cream"
+            >
+              <span id="boss-label">{VARIETIES.mega.name}</span>
+              <div
+                role="meter"
+                aria-labelledby="boss-label"
+                aria-valuemin={0}
+                aria-valuemax={Math.round(hud.boss.limit)}
+                aria-valuenow={Math.round(hud.boss.homesickness)}
+                aria-valuetext={`Homesickness ${Math.round((100 * hud.boss.homesickness) / hud.boss.limit)}%`}
+                className="h-3 w-full overflow-hidden rounded-full border border-line bg-panel"
+              >
+                <div
+                  className="h-full bg-aura"
+                  style={{
+                    width: `${(100 * Math.min(hud.boss.homesickness, hud.boss.limit)) / hud.boss.limit}%`,
+                  }}
+                />
+              </div>
+            </div>
+          )}
           <div className="relative flex flex-wrap items-center gap-6 p-4 text-sm font-semibold text-cream">
             <p data-testid="survival-time">
               Time {clockText(hud?.time ?? 0)} / {clockText(ARENA_CONFIG.timeGoalMs)}
diff --git a/app/ui/xenocats/arena.ts b/app/ui/xenocats/arena.ts
index 78fd769..d0d510f 100644
--- a/app/ui/xenocats/arena.ts
+++ b/app/ui/xenocats/arena.ts
@@ -24,6 +24,7 @@ import {
   type PassiveId,
   WEAPONS,
   type WeaponId,
+  type WeaponKind,
   type WeaponStats,
   modifiers,
   offerChoices,
@@ -33,6 +34,7 @@ import {
 import type { CatType } from './cat-types';
 import { type Vec } from './effects';
 import { createArenaGrid } from './arena-grid';
+import { SCHEDULE, type Schedule, VARIETIES, type VarietyId, arrivalsAt } from './varieties';
 import type { Random } from './random';
 
 export type ArenaConfig = {
@@ -101,6 +103,18 @@ export type ArenaConfig = {
     speed: number;
     reach: number;
   };
+  /** Which cats come when (varieties.ts). */
+  schedule: Schedule;
+  laserCat: {
+    /** It stops this far from him, px, and fires from there. */
+    range: number;
+    everyMs: number;
+    /** Its shots: px/s, and their size, px. */
+    shotSpeed: number;
+    shotRadius: number;
+  };
+  /** He picks a chest up within this, px. */
+  chestReach: number;
   /** The spatial grid's cell, px. */
   cellSize: number;
 };
@@ -136,6 +150,9 @@ export const ARENA_CONFIG: ArenaConfig = {
   startingLevel: 1,
   gems: { pickup: 100, speed: 520, value: 1, eliteValue: 6, cap: 1500 },
   matriarch: { speed: 330, reach: 70 },
+  schedule: SCHEDULE,
+  laserCat: { range: 280, everyMs: 2500, shotSpeed: 420, shotRadius: 8 },
+  chestReach: 36,
   cellSize: 64,
 };
 
@@ -189,8 +206,18 @@ export const HERO_EFFECTS: Readonly<Record<string, HeroEffect>> = {
 
 export type ArenaCat = {
   id: number;
-  /** Index into the run's types. */
+  /** A variety (varieties.ts), or null for one of the twenty xenocat types. */
+  variety: VarietyId | null;
+  /** For a xenocat, its index into the run's types; -1 for a variety. */
   type: number;
+  /** Touched within this of its centre, px. */
+  radius: number;
+  /** A zooming cat's way, and when it turns next; a sniper's next shot. */
+  heading: number;
+  turnAt: number;
+  shotAt: number;
+  /** The kitten swarm it came with, or 0. */
+  swarm: number;
   x: number;
   y: number;
   speed: number;
@@ -222,8 +249,10 @@ export type Projectile = {
 export type Gem = { x: number; y: number; value: number };
 
 export type ArenaEvent =
-  | { kind: 'sent-home'; x: number; y: number; type: number }
-  | { kind: 'hero-hit'; type: number; elite: boolean }
+  | { kind: 'sent-home'; x: number; y: number; type: number; variety: VarietyId | null }
+  | { kind: 'hero-hit'; type: number; variety: VarietyId | null; elite: boolean }
+  | { kind: 'boss'; x: number; y: number }
+  | { kind: 'chest'; x: number; y: number }
   | { kind: 'laser'; from: Vec; to: Vec }
   | { kind: 'level-up'; level: number }
   | { kind: 'fired'; weapon: WeaponId }
@@ -267,6 +296,16 @@ export function createArena(options: {
   let arrivals = 0;
   let matriarch: Vec | null = null;
   let events: ArenaEvent[] = [];
+  // Kitten swarms (how many of each are left), bosses come, chests lie about.
+  let nextSwarm = config.schedule.swarms.from;
+  let swarmId = 0;
+  const swarms = new Map<number, number>();
+  let bossesCome = 0;
+  const chests: Vec[] = [];
+  // The Laser Cats' shots.
+  type Shot = { x: number; y: number; vx: number; vy: number; until: number; drain: number };
+  const shots: Shot[] = [];
+  const spareShots: Shot[] = [];
 
   // The arsenal.
   const weapons = new Map<WeaponId, { level: number; readyAt: number }>();
@@ -293,22 +332,132 @@ export function createArena(options: {
     return low + (high - low) * share;
   };
 
-  function spawnCat() {
-    // Just off screen, all round.
-    const angle = random.next() * 2 * Math.PI;
-    const reach = Math.hypot(viewport.width, viewport.height) / 2 + config.cats.spawnMargin;
-    const type = random.int(0, types.length - 1);
+  /** A point just off screen, at `angle` from him. */
+  function offScreen(angle: number, extra = 0): Vec {
+    const reach = Math.hypot(viewport.width, viewport.height) / 2 + config.cats.spawnMargin + extra;
+    return { x: hero.x + Math.cos(angle) * reach, y: hero.y + Math.sin(angle) * reach };
+  }
+
+  /** A new cat (pooled), at `at`. */
+  function newCat(at: Vec): ArenaCat {
     const cat = spare.pop() ?? ({} as ArenaCat);
     cat.id = nextId++;
+    cat.x = at.x;
+    cat.y = at.y;
+    cat.homesickness = 0;
+    cat.heading = 0;
+    cat.turnAt = 0;
+    cat.shotAt = time + config.laserCat.everyMs;
+    cat.swarm = 0;
+    cats.push(cat);
+    return cat;
+  }
+
+  function spawnXenocat(at: Vec) {
+    const type = random.int(0, types.length - 1);
+    const cat = newCat(at);
+    cat.variety = null;
     cat.type = type;
-    cat.x = hero.x + Math.cos(angle) * reach;
-    cat.y = hero.y + Math.sin(angle) * reach;
+    cat.radius = config.cats.radius;
     cat.speed = byType(type, config.cats.speed, 7);
-    cat.homesickness = 0;
     cat.limit = byType(type, config.cats.homesickness, 3);
     cat.drain = Math.round(byType(type, config.cats.drain, 5));
     cat.elite = random.next() < config.cats.eliteShare;
-    cats.push(cat);
+  }
+
+  function spawnVariety(id: VarietyId, at: Vec): ArenaCat {
+    const variety = VARIETIES[id];
+    const cat = newCat(at);
+    cat.variety = id;
+    cat.type = -1;
+    cat.radius = variety.radius;
+    cat.speed = variety.speed;
+    cat.limit = variety.homesickness;
+    cat.drain = variety.drain;
+    cat.elite = false;
+    return cat;
+  }
+
+  /** A spot on the screen, at least `away` from him: where a cat that sits is found. */
+  function onScreen(away: number): Vec {
+    const angle = random.next() * 2 * Math.PI;
+    const cos = Math.abs(Math.cos(angle));
+    const sin = Math.abs(Math.sin(angle));
+    // How far the screen reaches that way (40 px in from its edge), so a narrow
+    // screen keeps the cat on it: nearer than `away` only if the screen is that small.
+    const edge = Math.min(
+      cos > 1e-6 ? (viewport.width / 2 - 40) / cos : Infinity,
+      sin > 1e-6 ? (viewport.height / 2 - 40) / sin : Infinity
+    );
+    const near = Math.min(away, edge / 2);
+    const reach = random.range(near, Math.max(edge, near));
+    return { x: hero.x + Math.cos(angle) * reach, y: hero.y + Math.sin(angle) * reach };
+  }
+
+  /** One arrival: who comes is drawn from what the schedule allows now, by weight. */
+  function spawnCat() {
+    const at = offScreen(random.next() * 2 * Math.PI);
+    const open = arrivalsAt(time, config.schedule);
+    let pick = random.next() * open.reduce((sum, a) => sum + a.weight, 0);
+    let who: VarietyId | 'xenocat' = 'xenocat';
+    for (const a of open) {
+      pick -= a.weight;
+      if (pick < 0) {
+        who = a.who;
+        break;
+      }
+    }
+    if (who === 'xenocat') spawnXenocat(at);
+    // A cat that sits is found on the screen, sitting calmly: off it, nobody would
+    // ever meet it.
+    else spawnVariety(who, VARIETIES[who].gait === 'sit' ? onScreen(200) : at);
+  }
+
+  /**
+   * A cat left far behind him (he walked on; it sits, or it is slow) comes round
+   * again: just off the screen if it walks, on it if it sits. So the horde stays
+   * where he is, and none counts for nothing.
+   */
+  function bringBack(cat: ArenaCat) {
+    const far = (Math.hypot(viewport.width, viewport.height) / 2 + config.cats.spawnMargin) * 2;
+    if (Math.hypot(cat.x - hero.x, cat.y - hero.y) <= far + cat.radius) return;
+    const sits = cat.variety !== null && VARIETIES[cat.variety].gait === 'sit';
+    const at = sits ? onScreen(200) : offScreen(random.next() * 2 * Math.PI, cat.radius);
+    cat.x = at.x;
+    cat.y = at.y;
+  }
+
+  /** The swarms and the bosses the schedule has come to. */
+  function spawnEvents(spawn: boolean) {
+    const { swarms: plan, bosses } = config.schedule;
+    if (time >= nextSwarm) {
+      nextSwarm = time + plan.everyMs;
+      if (spawn && cats.length < config.cats.hardCap) {
+        const size = Math.min(
+          random.int(plan.size[0], plan.size[1]),
+          config.cats.hardCap - cats.length
+        );
+        const id = ++swarmId;
+        const angle = random.next() * 2 * Math.PI;
+        const centre = offScreen(angle);
+        for (let k = 0; k < size; k++) {
+          const kitten = spawnVariety('kitten', {
+            x: centre.x + random.range(-40, 40),
+            y: centre.y + random.range(-40, 40),
+          });
+          kitten.swarm = id;
+          // A swarm counts as an elite: its last kitten home leaves a chest.
+          kitten.elite = true;
+        }
+        swarms.set(id, size);
+      }
+    }
+    while (bossesCome < bosses.length && time >= bosses[bossesCome]) {
+      bossesCome++;
+      const at = offScreen(random.next() * 2 * Math.PI, VARIETIES.mega.radius);
+      spawnVariety('mega', at);
+      events.push({ kind: 'boss', x: at.x, y: at.y });
+    }
   }
 
   /** Every cat homesick enough goes home, leaving a gem; the objects are kept for reuse. */
@@ -316,9 +465,25 @@ export function createArena(options: {
     for (let i = cats.length - 1; i >= 0; i--) {
       const cat = cats[i];
       if (cat.homesickness < cat.limit) continue;
-      events.push({ kind: 'sent-home', x: cat.x, y: cat.y, type: cat.type });
+      events.push({
+        kind: 'sent-home',
+        x: cat.x,
+        y: cat.y,
+        type: cat.type,
+        variety: cat.variety,
+      });
       sentHome++;
       dropGem(cat.x, cat.y, cat.elite ? config.gems.eliteValue : config.gems.value);
+      // A boss, an elite, or the last kitten of a swarm leaves a chest.
+      let chest = cat.variety === 'mega' || (cat.elite && cat.swarm === 0);
+      if (cat.swarm !== 0) {
+        const left = (swarms.get(cat.swarm) ?? 1) - 1;
+        if (left <= 0) {
+          swarms.delete(cat.swarm);
+          chest = true;
+        } else swarms.set(cat.swarm, left);
+      }
+      if (chest) chests.push({ x: cat.x, y: cat.y });
       cats[i] = cats[cats.length - 1];
       cats.pop();
       spare.push(cat);
@@ -342,6 +507,7 @@ export function createArena(options: {
   /** Lays an elite's effect on the hero, if none is on him. */
   function afflict(cat: ArenaCat) {
     if (effect && time < effect.until) return;
+    if (cat.variety !== null) return;
     const type = types[cat.type];
     const kind = HERO_EFFECTS[type.effect.id];
     if (!kind) return;
@@ -386,54 +552,141 @@ export function createArena(options: {
     if (x !== 0) hero.facing = Math.sign(x);
   }
 
+  /** A cat's step, its own way. */
+  function moveCat(cat: ArenaCat, dt: number) {
+    const dx = hero.x - cat.x;
+    const dy = hero.y - cat.y;
+    const d = Math.hypot(dx, dy) || 1;
+    const gait = cat.variety ? VARIETIES[cat.variety].gait : 'walk';
+    if (gait === 'sit') return;
+    if (gait === 'zoom') {
+      // A new way now and then: roughly at him, give or take a right angle.
+      if (time >= cat.turnAt) {
+        cat.heading = Math.atan2(dy, dx) + random.range(-Math.PI / 2, Math.PI / 2);
+        cat.turnAt = time + random.range(350, 900);
+      }
+      cat.x += Math.cos(cat.heading) * cat.speed * dt;
+      cat.y += Math.sin(cat.heading) * cat.speed * dt;
+      return;
+    }
+    let speed = cat.speed;
+    if (gait === 'charge' && d < 250) speed *= 1.9;
+    if (gait === 'snipe') {
+      if (time >= cat.shotAt && d < config.laserCat.range + 120) {
+        cat.shotAt = time + config.laserCat.everyMs;
+        const shot = spareShots.pop() ?? ({} as Shot);
+        shot.x = cat.x;
+        shot.y = cat.y;
+        shot.vx = (dx / d) * config.laserCat.shotSpeed;
+        shot.vy = (dy / d) * config.laserCat.shotSpeed;
+        shot.until = time + 2500;
+        shot.drain = cat.drain;
+        shots.push(shot);
+      }
+      if (d <= config.laserCat.range) return;
+    }
+    const stepLength = Math.min(speed * dt, d);
+    cat.x += (dx / d) * stepLength;
+    cat.y += (dy / d) * stepLength;
+  }
+
+  /** The Laser Cats' shots fly; one that reaches him drains his Resolve. */
+  function moveShots(dt: number) {
+    for (let i = shots.length - 1; i >= 0; i--) {
+      const shot = shots[i];
+      shot.x += shot.vx * dt;
+      shot.y += shot.vy * dt;
+      const hit =
+        Math.hypot(shot.x - hero.x, shot.y - hero.y) <=
+        config.hero.reach / 2 + config.laserCat.shotRadius;
+      if (hit && time >= hero.untouchableUntil) {
+        hero.resolve = Math.max(hero.resolve - shot.drain, 0);
+        hero.untouchableUntil = time + config.hero.untouchableMs;
+        events.push({ kind: 'hero-hit', type: -1, variety: 'laser', elite: false });
+      }
+      if (hit || time >= shot.until) {
+        shots[i] = shots[shots.length - 1];
+        shots.pop();
+        spareShots.push(shot);
+      }
+    }
+  }
+
   // ------------------------------------------------------------------ the weapons
 
+  /** Homesickness from a weapon of `kind`: nothing, to a cat it passes through. */
+  function hurt(cat: ArenaCat, amount: number, kind: WeaponKind) {
+    if (cat.variety && VARIETIES[cat.variety].immuneTo?.includes(kind)) return;
+    cat.homesickness += amount;
+  }
+
+  /** Indices of this step's cats bigger than the cats' size (not in the grid). */
+  const bigCats: number[] = [];
+
+  /** The cats that may be within `range` of a point: the grid's, and the big ones. */
+  function gather(x: number, y: number, range: number) {
+    grid.query(x, y, range + config.cats.radius, near);
+    for (const i of bigCats) near.push(i);
+  }
+
   const inRange: number[] = [];
   /**
-   * Every cat within `range` of a point (indices), in no order, into a list reused
-   * from call to call: read it before the next call.
+   * Every cat within `range` of a point, counting from its edge (indices), in no
+   * order, into a list reused from call to call: read it before the next call.
    */
   function within(at: Vec, range: number): number[] {
-    grid.query(at.x, at.y, range, near);
+    gather(at.x, at.y, range);
     inRange.length = 0;
     for (const i of near) {
       const cat = cats[i];
-      if ((cat.x - at.x) ** 2 + (cat.y - at.y) ** 2 <= range * range) inRange.push(i);
+      const reach = range + cat.radius;
+      if ((cat.x - at.x) ** 2 + (cat.y - at.y) ** 2 <= reach * reach) inRange.push(i);
     }
     return inRange;
   }
 
   /** The `count` nearest cats within `range` of a point, nearest first (indices). */
   function nearest(at: Vec, range: number, count: number, skip?: Set<number>): number[] {
-    grid.query(at.x, at.y, range, near);
+    gather(at.x, at.y, range);
     const found: { i: number; d: number }[] = [];
     for (const i of near) {
       const cat = cats[i];
       if (skip?.has(cat.id)) continue;
       const d = (cat.x - at.x) ** 2 + (cat.y - at.y) ** 2;
-      if (d <= range * range) found.push({ i, d });
+      if (d <= (range + cat.radius) ** 2) found.push({ i, d });
     }
     found.sort((a, b) => a.d - b.d || a.i - b.i);
     return found.slice(0, count).map((f) => f.i);
   }
 
   /** A beam from `from` along (ux, uy): every cat in front, near its line, grows homesick. */
-  function beam(from: Vec, ux: number, uy: number, length: number, width: number, damage: number) {
+  function beam(
+    from: Vec,
+    ux: number,
+    uy: number,
+    length: number,
+    width: number,
+    damage: number,
+    kind: WeaponKind = 'beam'
+  ) {
     const to = { x: from.x + ux * length, y: from.y + uy * length };
     beams.push({ from: { ...from }, to, until: time + 180 });
     events.push({ kind: 'laser', from: { ...from }, to });
-    grid.query(from.x + (ux * length) / 2, from.y + (uy * length) / 2, length / 2 + width, near);
+    gather(from.x + (ux * length) / 2, from.y + (uy * length) / 2, length / 2 + width);
     for (const i of near) {
       const cat = cats[i];
       const along = (cat.x - from.x) * ux + (cat.y - from.y) * uy;
       // (A cat right on him counts as in front: up to the same half pixel.)
       if (along < -0.5 || along > length) continue;
       const across = Math.abs((cat.x - from.x) * uy - (cat.y - from.y) * ux);
-      if (across > width + config.cats.radius) continue;
-      cat.homesickness += damage;
+      if (across > width + cat.radius) continue;
+      hurt(cat, damage, kind);
     }
   }
 
+  /** How near a cat comes before it reaches him: its size counts. */
+  const reachOf = (cat: ArenaCat) => config.hero.reach + cat.radius - config.cats.radius;
+
   /** The way from the hero to a cat; the way he faces if it stands on him. */
   function aim(cat: ArenaCat): Vec {
     const dx = cat.x - hero.x;
@@ -469,7 +722,7 @@ export function createArena(options: {
         if (i === undefined) break;
         const cat = cats[i];
         hit.add(cat.id);
-        cat.homesickness += s.damage;
+        hurt(cat, s.damage, 'chain');
         const to = { x: cat.x, y: cat.y };
         beams.push({ from, to, until: time + s.durationMs });
         events.push({ kind: 'laser', from, to });
@@ -484,12 +737,12 @@ export function createArena(options: {
         const cat = cats[i];
         // Drawn in, a share of the way, but not onto him.
         const d = Math.hypot(cat.x - hero.x, cat.y - hero.y);
-        const keep = Math.max(d * (1 - s.speed), config.hero.reach + 6);
+        const keep = Math.max(d * (1 - s.speed), reachOf(cat) + 6);
         if (d > keep) {
           cat.x = hero.x + ((cat.x - hero.x) * keep) / d;
           cat.y = hero.y + ((cat.y - hero.y) * keep) / d;
         }
-        cat.homesickness += s.damage;
+        hurt(cat, s.damage, 'pull');
       }
       return true;
     }
@@ -560,12 +813,10 @@ export function createArena(options: {
       if (kind === 'orbit') {
         // Each blade, all the time, to every cat it passes through.
         for (const blade of bladesOf(s)) {
-          for (const i of within(blade, BLADE_RADIUS + config.cats.radius)) {
-            cats[i].homesickness += s.damage * dt;
-          }
+          for (const i of within(blade, BLADE_RADIUS)) hurt(cats[i], s.damage * dt, 'orbit');
         }
       } else if (kind === 'zone') {
-        for (const i of within(hero, s.area)) cats[i].homesickness += s.damage * dt;
+        for (const i of within(hero, s.area)) hurt(cats[i], s.damage * dt, 'zone');
       } else if (time >= held.readyAt && fire(id, s)) {
         held.readyAt = time + s.cooldownMs;
         events.push({ kind: 'fired', weapon: id });
@@ -587,11 +838,11 @@ export function createArena(options: {
         if (p.y < top || p.y > top + viewport.height)
           p.vy = Math.sign(hero.y - p.y) * Math.abs(p.vy);
       }
-      for (const i of within(p, p.radius + config.cats.radius)) {
+      for (const i of within(p, p.radius)) {
         const cat = cats[i];
         if (p.pierce <= 0 || p.touched.includes(cat.id)) continue;
         p.touched.push(cat.id);
-        cat.homesickness += p.damage;
+        hurt(cat, p.damage, WEAPONS[p.weapon].kind);
         p.pierce--;
       }
       if (p.pierce <= 0 || time >= p.until) {
@@ -646,6 +897,13 @@ export function createArena(options: {
       pending++;
       events.push({ kind: 'level-up', level });
     }
+    for (let i = chests.length - 1; i >= 0; i--) {
+      const chest = chests[i];
+      if (Math.hypot(chest.x - hero.x, chest.y - hero.y) > config.chestReach) continue;
+      chests.splice(i, 1);
+      events.push({ kind: 'chest', x: chest.x, y: chest.y });
+      pending++;
+    }
     if (pending > 0 && !choosing) offer();
   }
 
@@ -680,6 +938,7 @@ export function createArena(options: {
         config.cats.hardCap,
         spawn ? Infinity : config.cats.guardFree
       );
+      spawnEvents(spawn);
       if (cats.length < wanted) {
         arrivals += Math.max(wanted - cats.length, 1) * config.arrivalShare * dt + dt;
         while (arrivals >= 1 && cats.length < wanted) {
@@ -692,33 +951,34 @@ export function createArena(options: {
 
       // The cats walk at him; the grid is rebuilt from where they now stand.
       grid.clear();
+      // The few big cats (bigger than the cats' size) are kept apart, so every
+      // search looks a cat's size further, not the biggest one's.
+      bigCats.length = 0;
       for (let i = 0; i < cats.length; i++) {
         const cat = cats[i];
-        const dx = hero.x - cat.x;
-        const dy = hero.y - cat.y;
-        const d = Math.hypot(dx, dy) || 1;
-        const stepLength = Math.min(cat.speed * dt, d);
-        cat.x += (dx / d) * stepLength;
-        cat.y += (dy / d) * stepLength;
-        grid.insert(i, cat.x, cat.y);
+        moveCat(cat, dt);
+        bringBack(cat);
+        if (cat.radius > config.cats.radius) bigCats.push(i);
+        else grid.insert(i, cat.x, cat.y);
       }
+      moveShots(dt);
 
       // Reached: one drain per moment, an elite's effect on top.
       if (time >= hero.untouchableUntil) {
-        grid.query(hero.x, hero.y, config.hero.reach, near);
+        gather(hero.x, hero.y, config.hero.reach);
         for (const i of near) {
           const cat = cats[i];
-          if ((cat.x - hero.x) ** 2 + (cat.y - hero.y) ** 2 > config.hero.reach ** 2) continue;
+          if ((cat.x - hero.x) ** 2 + (cat.y - hero.y) ** 2 > reachOf(cat) ** 2) continue;
           hero.resolve = Math.max(hero.resolve - cat.drain, 0);
           hero.untouchableUntil = time + config.hero.untouchableMs;
-          events.push({ kind: 'hero-hit', type: cat.type, elite: cat.elite });
+          events.push({ kind: 'hero-hit', type: cat.type, variety: cat.variety, elite: cat.elite });
           if (cat.elite) afflict(cat);
           break;
         }
-        if (hero.resolve <= 0) {
-          end('spent');
-          return;
-        }
+      }
+      if (hero.resolve <= 0) {
+        end('spent');
+        return;
       }
 
       // His weapons; what flies; then every cat homesick enough goes home.
@@ -799,6 +1059,8 @@ export function createArena(options: {
       return held ? weaponStats('thunderous-vacuum', held.level, mods).area : null;
     },
     matriarch: (): Vec | null => matriarch,
+    chests: (): readonly Vec[] => chests,
+    shots: (): readonly { x: number; y: number }[] => shots,
 
     state() {
       const active = effect && time < effect.until ? effect.effect.kind : null;
@@ -824,6 +1086,15 @@ export function createArena(options: {
         passives: [...passives].map(([id, l]) => ({ id, level: l })),
         projectiles: projectiles.length,
         gems: gems.length,
+        chests: chests.length,
+        /** The oldest Mega Cat on the field (by id): its Homesickness, for its bar. */
+        boss: (() => {
+          let boss: ArenaCat | null = null;
+          for (const cat of cats) {
+            if (cat.variety === 'mega' && (!boss || cat.id < boss.id)) boss = cat;
+          }
+          return boss ? { homesickness: boss.homesickness, limit: boss.limit } : null;
+        })(),
       };
     },
   };
diff --git a/app/ui/xenocats/varieties.ts b/app/ui/xenocats/varieties.ts
new file mode 100644
index 0000000..0578ea4
--- /dev/null
+++ b/app/ui/xenocats/varieties.ts
@@ -0,0 +1,158 @@
+// The cats of Survival beyond the twenty xenocat types (arena.ts): varieties that
+// arrive over the five minutes, each its own size, pace, staying power and way of
+// moving, so the horde grows more numerous, more durable, faster and more absurd.
+// Pure data, no DOM; their drawings are in arena-art.ts.
+
+import type { WeaponKind } from './arsenal';
+
+export type VarietyId =
+  'basic' | 'zoomies' | 'hissing' | 'fat' | 'kitten' | 'box' | 'laser' | 'possessed' | 'mega';
+
+/** How a variety moves (arena.ts reads it). */
+export type Gait =
+  /** Straight at him. */
+  | 'walk'
+  /** Darts one way, then another, now and then. */
+  | 'zoom'
+  /** Walks at him, and charges once near. */
+  | 'charge'
+  /** Sits in its box. */
+  | 'sit'
+  /** Keeps its distance, and fires at him. */
+  | 'snipe';
+
+export type Variety = {
+  name: string;
+  /** In the game's voice. */
+  description: string;
+  gait: Gait;
+  /** px/s. */
+  speed: number;
+  /** Homesickness it can take before it goes home. */
+  homesickness: number;
+  /** Resolve it drains on reaching him. */
+  drain: number;
+  /** Its size: touched within this of its centre, px; drawn at twice it. */
+  radius: number;
+  /** Weapons of these kinds pass through it. */
+  immuneTo?: readonly WeaponKind[];
+};
+
+export const VARIETIES: Readonly<Record<VarietyId, Variety>> = {
+  basic: {
+    name: 'Basic Cat',
+    description: 'Slow, numerous, and mostly harmless. Mostly.',
+    gait: 'walk',
+    speed: 42,
+    homesickness: 10,
+    drain: 2,
+    radius: 14,
+  },
+  zoomies: {
+    name: 'Zoomies Cat',
+    description: 'Extremely fast. Where it is going, not even it knows.',
+    gait: 'zoom',
+    speed: 190,
+    homesickness: 14,
+    drain: 4,
+    radius: 13,
+  },
+  hissing: {
+    name: 'Hissing Cat',
+    description: 'Comes on with intent, and takes a great deal of persuading.',
+    gait: 'charge',
+    speed: 95,
+    homesickness: 70,
+    drain: 8,
+    radius: 16,
+  },
+  fat: {
+    name: 'Fat Cat',
+    description: 'Very slow. Enormous. Almost impossible to move.',
+    gait: 'walk',
+    speed: 24,
+    homesickness: 280,
+    drain: 14,
+    radius: 34,
+  },
+  kitten: {
+    name: 'Kitten',
+    description: 'Tiny. They never come alone.',
+    gait: 'walk',
+    speed: 80,
+    homesickness: 6,
+    drain: 1,
+    radius: 9,
+  },
+  box: {
+    name: 'Box Cat',
+    description: 'It sits in its box, perfectly calm. It is not leaving.',
+    gait: 'sit',
+    speed: 0,
+    homesickness: 650,
+    drain: 6,
+    radius: 26,
+  },
+  laser: {
+    name: 'Laser Cat',
+    description: 'It keeps its distance, and returns fire.',
+    gait: 'snipe',
+    speed: 70,
+    homesickness: 40,
+    drain: 5,
+    radius: 16,
+  },
+  possessed: {
+    name: 'Possessed Cat',
+    description: 'Something looks out through its eyes. Lasers pass straight through.',
+    gait: 'walk',
+    speed: 60,
+    homesickness: 90,
+    drain: 9,
+    radius: 16,
+    immuneTo: ['beam', 'chain'],
+  },
+  mega: {
+    name: 'Mega Cat',
+    description: 'An orange tabby of unreasonable size. It has come for the Keeper.',
+    gait: 'walk',
+    speed: 34,
+    homesickness: 4500,
+    drain: 25,
+    radius: 90,
+  },
+};
+
+export type Schedule = {
+  /** From this time each variety (or the xenocats) may come, with this weight. */
+  arrivals: readonly { from: number; who: VarietyId | 'xenocat'; weight: number }[];
+  /** Kitten swarms: the first, then one every so often, so many kittens each. */
+  swarms: { from: number; everyMs: number; size: readonly [number, number] };
+  /** When a Mega Cat arrives, ms into the run. */
+  bosses: readonly number[];
+};
+
+/**
+ * Over the five minutes: plain cats and xenocats first, then the zoomies, swarms of
+ * kittens, the hissing, boxes, snipers, the fat and the possessed; a Mega Cat at
+ * two minutes and again at four.
+ */
+export const SCHEDULE: Schedule = {
+  arrivals: [
+    { from: 0, who: 'basic', weight: 6 },
+    { from: 0, who: 'xenocat', weight: 4 },
+    { from: 20_000, who: 'zoomies', weight: 2 },
+    { from: 60_000, who: 'hissing', weight: 2 },
+    { from: 90_000, who: 'box', weight: 0.4 },
+    { from: 120_000, who: 'laser', weight: 1 },
+    { from: 150_000, who: 'fat', weight: 0.8 },
+    { from: 180_000, who: 'possessed', weight: 1.2 },
+  ],
+  swarms: { from: 45_000, everyMs: 25_000, size: [12, 20] },
+  bosses: [120_000, 240_000],
+};
+
+/** Which varieties may come at `ms`, with their weights. */
+export function arrivalsAt(ms: number, schedule: Schedule = SCHEDULE) {
+  return schedule.arrivals.filter((a) => a.from <= ms);
+}
diff --git a/tests/e2e/survival.spec.ts b/tests/e2e/survival.spec.ts
index 48459fd..3dfbdad 100644
--- a/tests/e2e/survival.spec.ts
+++ b/tests/e2e/survival.spec.ts
@@ -152,19 +152,52 @@ test.describe('on a computer', () => {
     const chosen = await buttons.nth(pick).getAttribute('data-choice');
     const chosenLevel = await buttons.nth(pick).getAttribute('data-level');
     await page.keyboard.press(String(pick + 1));
-    await expect(dialog).toHaveCount(0);
-    await expect(area(page)).toHaveAttribute('data-screen', 'playing');
-    await expect(area(page)).toBeFocused();
+    // Held at the level chosen (a further choice may raise it).
     if (kinds[pick] === 'weapon') {
-      await expect(area(page)).toHaveAttribute(
-        'data-weapons',
-        new RegExp(`${chosen}:${chosenLevel}`)
-      );
+      await expect
+        .poll(async () => {
+          const held = (await area(page).getAttribute('data-weapons')) ?? '';
+          const level = new RegExp(`${chosen}:(\\d)`).exec(held)?.[1];
+          return Number(level ?? 0);
+        })
+        .toBeGreaterThanOrEqual(Number(chosenLevel));
     }
+    // Another level (or a chest) may be waiting already: take those, and play on.
+    await expect
+      .poll(async () => {
+        await playOn(page);
+        return area(page).getAttribute('data-screen');
+      })
+      .toBe('playing');
+    await expect(dialog).toHaveCount(0);
+    await expect(area(page)).toBeFocused();
     await expect.poll(() => num(page, 'data-time')).toBeGreaterThan(Number(waited));
     expect(await num(page, 'data-level')).toBeGreaterThanOrEqual(2);
   });
 
+  test('a Mega Cat arrives, its Homesickness shown in a bar of its own', async ({ page }) => {
+    test.setTimeout(60_000);
+    // `?boss=3`: a Mega Cat at three seconds, besides the schedule's.
+    await openArena(page, '?seed=7&speed=2&boss=3');
+    await startRun(page);
+    await expect(area(page)).toHaveAttribute('data-boss', '');
+    const bar = page.getByTestId('survival-boss');
+    await expect
+      .poll(
+        async () => {
+          await playOn(page);
+          return bar.count();
+        },
+        { timeout: 30_000 }
+      )
+      .toBe(1);
+    await expect(bar).toContainText('Mega Cat');
+    const meter = bar.getByRole('meter', { name: 'Mega Cat' });
+    await expect(meter).toHaveAttribute('aria-valuemax', '4500');
+    await expect(meter).toHaveAttribute('aria-valuetext', /^Homesickness \d+%$/);
+    expect(await area(page).getAttribute('data-boss')).not.toBe('');
+  });
+
   test('losing focus pauses the run', async ({ page }) => {
     await openArena(page);
     await startRun(page);
diff --git a/tests/unit/xenocats/arena.test.ts b/tests/unit/xenocats/arena.test.ts
index 28338cd..5363eb3 100644
--- a/tests/unit/xenocats/arena.test.ts
+++ b/tests/unit/xenocats/arena.test.ts
@@ -16,8 +16,21 @@ import { createRandom } from '@/app/ui/xenocats/random';
 const viewport = { width: 1280, height: 800 };
 const still = { x: 0, y: 0 };
 
-/** Gems worth nothing: no level-up interrupts a test of something else. */
-const noLevels = { gems: { ...ARENA_CONFIG.gems, value: 0, eliteValue: 0 } };
+/** Only the twenty xenocat types, as before the varieties: no swarms, no bosses. */
+const xenocatsOnly: Partial<ArenaConfig> = {
+  schedule: {
+    arrivals: [{ from: 0, who: 'xenocat', weight: 1 }],
+    swarms: { from: Infinity, everyMs: 1, size: [0, 0] },
+    bosses: [],
+  },
+};
+
+/** Gems worth nothing and chests out of reach: no level-up interrupts. */
+const noLevels = {
+  ...xenocatsOnly,
+  gems: { ...ARENA_CONFIG.gems, value: 0, eliteValue: 0 },
+  chestReach: -1,
+};
 
 function arena(config: Partial<ArenaConfig> = {}, seed = 1, types = CAT_TYPES) {
   return createArena({
diff --git a/tests/unit/xenocats/arsenal.test.ts b/tests/unit/xenocats/arsenal.test.ts
index 2d856ef..ef7a5b8 100644
--- a/tests/unit/xenocats/arsenal.test.ts
+++ b/tests/unit/xenocats/arsenal.test.ts
@@ -29,7 +29,18 @@ function arena(config: Partial<ArenaConfig> = {}, seed = 1) {
 }
 
 /** A hero nothing wears down, and gems worth nothing (no level-up interrupts). */
+/** Only the twenty xenocat types, as before the varieties: no swarms, no bosses. */
+const xenocatsOnly: Partial<ArenaConfig> = {
+  schedule: {
+    arrivals: [{ from: 0, who: 'xenocat', weight: 1 }],
+    swarms: { from: Infinity, everyMs: 1, size: [0, 0] },
+    bosses: [],
+  },
+};
+
 const steady: Partial<ArenaConfig> = {
+  ...xenocatsOnly,
+  chestReach: -1,
   hero: { ...ARENA_CONFIG.hero, resolve: 1e12 },
   gems: { ...ARENA_CONFIG.gems, value: 0, eliteValue: 0 },
 };
@@ -273,8 +284,11 @@ describe('every weapon, at level 1 and at its top level', () => {
         const before = where.get(cat.id)!;
         if (Math.hypot(cat.x - before.x, cat.y - before.y) < 1e-9) continue;
         pulled++;
-        // From within its reach, towards him.
-        expect(Math.hypot(before.x - hero.x, before.y - hero.y)).toBeLessThan(area + 10);
+        // From within its reach (counted from the cat's edge), towards him.
+        expect(Math.hypot(before.x - hero.x, before.y - hero.y)).toBeLessThanOrEqual(
+          // (he walks a step before the pull, up to 4 px)
+          area + cat.radius + 5
+        );
         expect(Math.hypot(cat.x - hero.x, cat.y - hero.y)).toBeLessThan(
           Math.hypot(before.x - hero.x, before.y - hero.y)
         );
@@ -410,9 +424,12 @@ describe('levels in a run', () => {
     while (a.state().time < 300_000) {
       const offer = a.choices();
       if (offer) {
-        // Weapons first, new or better, as a player bent on attacks would.
-        const weapon = offer.findIndex((c) => c.kind === 'weapon');
-        a.choose(weapon >= 0 ? weapon : 0);
+        // As a player bent on attacks would: weapons first, the one that throws the
+        // most at its best (the build, not luck, decides how full the screen gets).
+        const throws = (c: (typeof offer)[number]) =>
+          c.kind === 'weapon' ? WEAPONS[c.id].levels[MAX_WEAPON_LEVEL - 1].count : -1;
+        const best = offer.reduce((b, c, i) => (throws(c) > throws(offer[b]) ? i : b), 0);
+        a.choose(best);
         continue;
       }
       // He walks a wide circle, gathering what falls.
diff --git a/tests/unit/xenocats/varieties.test.ts b/tests/unit/xenocats/varieties.test.ts
new file mode 100644
index 0000000..7661725
--- /dev/null
+++ b/tests/unit/xenocats/varieties.test.ts
@@ -0,0 +1,373 @@
+import { describe, expect, it } from 'vitest';
+import {
+  ARENA_CONFIG,
+  type ArenaCat,
+  type ArenaConfig,
+  createArena,
+} from '@/app/ui/xenocats/arena';
+import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
+import { createRandom } from '@/app/ui/xenocats/random';
+import {
+  SCHEDULE,
+  type Schedule,
+  VARIETIES,
+  type VarietyId,
+  arrivalsAt,
+} from '@/app/ui/xenocats/varieties';
+
+const viewport = { width: 1280, height: 800 };
+const still = { x: 0, y: 0 };
+
+/** A Keeper nothing wears down, with no weapons and no level-ups to interrupt. */
+const watch: Partial<ArenaConfig> = {
+  hero: { ...ARENA_CONFIG.hero, resolve: 1e12 },
+  startingWeapons: [],
+  gems: { ...ARENA_CONFIG.gems, value: 0, eliteValue: 0 },
+  chestReach: -1,
+};
+
+/** Only one variety comes, steadily. */
+const only = (who: VarietyId): Schedule => ({
+  arrivals: [{ from: 0, who, weight: 1 }],
+  swarms: { from: Infinity, everyMs: 1, size: [0, 0] },
+  bosses: [],
+});
+
+function arena(config: Partial<ArenaConfig> = {}, seed = 1) {
+  return createArena({
+    random: createRandom(seed),
+    types: CAT_TYPES,
+    viewport,
+    config: { ...watch, ...config },
+  });
+}
+
+function runTo(a: ReturnType<typeof arena>, ms: number, input = still) {
+  while (a.state().time < ms) a.step(input);
+}
+
+/** How far a cat went in `ms`, and the cats of a variety as they stand. */
+function trackOne(who: VarietyId, ms: number) {
+  const a = arena({ schedule: only(who), escalation: [[0, 1]] });
+  while (a.cats().length === 0) a.step(still);
+  const cat = a.cats()[0];
+  const id = cat.id;
+  const from = { x: cat.x, y: cat.y };
+  // `ms` from when it arrived.
+  runTo(a, a.state().time + ms);
+  const now = a.cats().find((c) => c.id === id)!;
+  return { a, from, now };
+}
+
+describe('the varieties', () => {
+  it('each has its own pace, staying power and size', () => {
+    const v = VARIETIES;
+    expect(v.basic.speed).toBeLessThan(v.zoomies.speed);
+    expect(v.zoomies.speed).toBe(Math.max(...Object.values(v).map((x) => x.speed)));
+    expect(v.hissing.homesickness).toBeGreaterThan(v.basic.homesickness);
+    expect(v.fat.speed).toBeLessThan(v.basic.speed);
+    expect(v.fat.radius).toBeGreaterThan(v.basic.radius * 2);
+    expect(v.fat.homesickness).toBeGreaterThan(v.hissing.homesickness);
+    expect(v.kitten.radius).toBeLessThan(v.basic.radius);
+    expect(v.box.speed).toBe(0);
+    expect(v.box.homesickness).toBeGreaterThan(v.fat.homesickness);
+    expect(v.mega.radius).toBeGreaterThan(v.fat.radius * 2);
+    expect(v.mega.homesickness).toBeGreaterThan(v.box.homesickness);
+    for (const variety of Object.values(v)) expect(variety.description.length).toBeGreaterThan(10);
+  });
+
+  it('a Basic Cat walks straight at him; a Fat Cat, much slower', () => {
+    const basic = trackOne('basic', 3000);
+    const fat = trackOne('fat', 3000);
+    const gone = (t: ReturnType<typeof trackOne>) =>
+      Math.hypot(t.from.x, t.from.y) - Math.hypot(t.now.x, t.now.y);
+    expect(gone(basic)).toBeCloseTo(VARIETIES.basic.speed * 3, -1);
+    expect(gone(fat)).toBeCloseTo(VARIETIES.fat.speed * 3, -1);
+  });
+
+  it('a Zoomies Cat darts about, changing its way, and gets nowhere straight', () => {
+    const a = arena({ schedule: only('zoomies'), escalation: [[0, 1]] });
+    while (a.cats().length === 0) a.step(still);
+    const id = a.cats()[0].id;
+    const headings = new Set<number>();
+    let travelled = 0;
+    let last = { ...a.cats()[0] };
+    while (a.state().time < 5000) {
+      a.step(still);
+      const cat = a.cats().find((c) => c.id === id);
+      if (!cat) break;
+      headings.add(Math.round(cat.heading * 100));
+      travelled += Math.hypot(cat.x - last.x, cat.y - last.y);
+      last = { ...cat };
+    }
+    expect(headings.size).toBeGreaterThan(4);
+    expect(travelled).toBeGreaterThan(VARIETIES.zoomies.speed * 4);
+  });
+
+  it('a Hissing Cat charges once it is near', () => {
+    const a = arena({ schedule: only('hissing'), escalation: [[0, 1]] });
+    let far = 0;
+    let near = 0;
+    let last: ArenaCat | null = null;
+    while (a.state().time < 20_000) {
+      a.step(still);
+      const cat = a.cats()[0];
+      if (!cat) continue;
+      if (last && last.id === cat.id) {
+        const step = Math.hypot(cat.x - last.x, cat.y - last.y);
+        if (Math.hypot(cat.x, cat.y) > 300) far = Math.max(far, step);
+        else if (Math.hypot(cat.x, cat.y) > 60) near = Math.max(near, step);
+      }
+      last = { ...cat };
+    }
+    expect(near).toBeGreaterThan(far * 1.5);
+  });
+
+  it('a Box Cat sits where it came, and takes a great deal to send home', () => {
+    const box = trackOne('box', 10_000);
+    expect(box.now).toMatchObject({ x: box.from.x, y: box.from.y });
+    expect(box.now.limit).toBe(VARIETIES.box.homesickness);
+  });
+
+  it('a Laser Cat keeps its distance and fires at him; its shots drain his Resolve', () => {
+    const a = arena({
+      schedule: only('laser'),
+      escalation: [[0, 1]],
+      hero: { ...ARENA_CONFIG.hero, resolve: 100 },
+    });
+    let shotsSeen = 0;
+    let hits = 0;
+    while (a.state().time < 30_000 && a.state().status === 'playing') {
+      a.step(still);
+      shotsSeen = Math.max(shotsSeen, a.shots().length);
+      for (const e of a.drainEvents()) if (e.kind === 'hero-hit' && e.variety === 'laser') hits++;
+    }
+    expect(shotsSeen).toBeGreaterThan(0);
+    expect(hits).toBeGreaterThan(0);
+    expect(a.state().hero.resolve).toBeLessThan(100);
+    // It never came closer than its range.
+    for (const cat of a.cats()) {
+      expect(Math.hypot(cat.x, cat.y)).toBeGreaterThanOrEqual(ARENA_CONFIG.laserCat.range - 5);
+    }
+  });
+
+  it('a Possessed Cat lets lasers pass straight through, but not treats', () => {
+    const lasers = arena({
+      schedule: only('possessed'),
+      escalation: [[0, 4]],
+      startingWeapons: ['laser-pointer', 'laser-pointer-deluxe'],
+      startingLevel: 8,
+    });
+    runTo(lasers, 20_000);
+    expect(lasers.cats().length).toBeGreaterThan(0);
+    for (const cat of lasers.cats()) expect(cat.homesickness).toBe(0);
+    expect(lasers.state().sentHome).toBe(0);
+    const treats = arena({
+      schedule: only('possessed'),
+      escalation: [[0, 4]],
+      startingWeapons: ['cat-treats'],
+      startingLevel: 8,
+    });
+    runTo(treats, 20_000);
+    expect(treats.state().sentHome).toBeGreaterThan(0);
+  });
+
+  it('kittens come in swarms of a dozen or more at once, and the last one home leaves a chest', () => {
+    const swarm: Schedule = {
+      arrivals: [{ from: 0, who: 'basic', weight: 1 }],
+      swarms: { from: 1000, everyMs: 1e9, size: [12, 20] },
+      bosses: [],
+    };
+    const a = arena({ schedule: swarm, escalation: [[0, 0]] });
+    runTo(a, 1000 + ARENA_CONFIG.stepMs);
+    const kittens = a.cats().filter((c) => c.variety === 'kitten');
+    expect(kittens.length).toBeGreaterThanOrEqual(12);
+    expect(kittens.length).toBeLessThanOrEqual(20);
+    // Together, from one side.
+    const xs = kittens.map((k) => k.x);
+    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(100);
+    // Sent home, all of them: one chest.
+    const b = arena({
+      schedule: swarm,
+      escalation: [[0, 0]],
+      startingWeapons: ['thunderous-vacuum'],
+      startingLevel: 8,
+    });
+    runTo(b, 30_000);
+    expect(b.state().sentHome).toBeGreaterThanOrEqual(12);
+    expect(b.cats().filter((c) => c.variety === 'kitten')).toHaveLength(0);
+    expect(b.state().chests).toBe(1);
+  });
+});
+
+describe('keeping the horde where he is', () => {
+  it('a Box Cat is found on the screen, sitting', () => {
+    const a = arena({ schedule: only('box'), escalation: [[0, 10]] });
+    runTo(a, 8000);
+    expect(a.cats().length).toBeGreaterThan(3);
+    for (const cat of a.cats()) {
+      expect(Math.abs(cat.x)).toBeLessThan(viewport.width / 2);
+      expect(Math.abs(cat.y)).toBeLessThan(viewport.height / 2);
+    }
+  });
+
+  it('on a narrow phone, a Box Cat is still found wholly on the screen', () => {
+    const phone = { width: 390, height: 844 };
+    const a = createArena({
+      random: createRandom(3),
+      types: CAT_TYPES,
+      viewport: phone,
+      config: { ...watch, schedule: only('box'), escalation: [[0, 10]] },
+    });
+    runTo(a, 8000);
+    expect(a.cats().length).toBeGreaterThan(3);
+    for (const cat of a.cats()) {
+      expect(Math.abs(cat.x)).toBeLessThanOrEqual(phone.width / 2 - 40 + 1e-6);
+      expect(Math.abs(cat.y)).toBeLessThanOrEqual(phone.height / 2 - 40 + 1e-6);
+    }
+  });
+
+  it('late in a run, Box Cats stay a small share, and no cat is left far behind', () => {
+    const a = arena({ stepMs: 50, startingWeapons: ['laser-pointer', 'cat-treats'] }, 5);
+    while (a.state().time < 270_000) {
+      // He walks a wide circle, leaving whatever sits behind him.
+      const t = a.state().time / 6000;
+      a.step({ x: -Math.sin(t), y: Math.cos(t) });
+    }
+    const cats = a.cats();
+    const boxes = cats.filter((c) => c.variety === 'box').length;
+    expect(cats.length).toBeGreaterThan(500);
+    expect(boxes / cats.length).toBeLessThan(0.05);
+    const { x, y } = a.state().hero;
+    const far =
+      (Math.hypot(viewport.width, viewport.height) / 2 + ARENA_CONFIG.cats.spawnMargin) * 2;
+    for (const cat of cats)
+      expect(Math.hypot(cat.x - x, cat.y - y)).toBeLessThanOrEqual(far + cat.radius + 10);
+  }, 60_000);
+
+  it('a swarm never takes the horde past its hard cap', () => {
+    const swarm: Schedule = {
+      arrivals: [{ from: 0, who: 'basic', weight: 1 }],
+      swarms: { from: 1000, everyMs: 1e9, size: [20, 20] },
+      bosses: [],
+    };
+    const a = arena({
+      schedule: swarm,
+      escalation: [[0, 0]],
+      cats: { ...ARENA_CONFIG.cats, hardCap: 8 },
+    });
+    runTo(a, 2000);
+    expect(a.cats().length).toBe(8);
+  });
+
+  it('with two Mega Cats on the field, the bar follows the older', () => {
+    const two: Schedule = {
+      arrivals: [{ from: 0, who: 'basic', weight: 1 }],
+      swarms: { from: Infinity, everyMs: 1, size: [0, 0] },
+      bosses: [1000, 2000],
+    };
+    const a = arena({
+      schedule: two,
+      escalation: [[0, 0]],
+      startingWeapons: ['thunderous-vacuum'],
+      startingLevel: 8,
+    });
+    runTo(a, 20_000);
+    const megas = a.cats().filter((c) => c.variety === 'mega');
+    expect(megas).toHaveLength(2);
+    const older = megas.reduce((p, c) => (c.id < p.id ? c : p));
+    expect(a.state().boss).toEqual({ homesickness: older.homesickness, limit: older.limit });
+  });
+});
+
+describe('the schedule', () => {
+  it('opens to each variety in turn', () => {
+    expect(arrivalsAt(0).map((a) => a.who)).toEqual(['basic', 'xenocat']);
+    expect(
+      arrivalsAt(300_000)
+        .map((a) => a.who)
+        .sort()
+    ).toEqual(
+      ['basic', 'box', 'fat', 'hissing', 'laser', 'possessed', 'xenocat', 'zoomies'].sort()
+    );
+  });
+
+  it('in a seeded run, each variety first appears in its window, and not before', () => {
+    const a = arena({ stepMs: 50 }, 3);
+    const first = new Map<string, number>();
+    while (a.state().time < 260_000) {
+      a.step(still);
+      for (const cat of a.cats()) {
+        const who = cat.variety ?? 'xenocat';
+        if (!first.has(who)) first.set(who, a.state().time);
+      }
+    }
+    for (const arrival of SCHEDULE.arrivals) {
+      const seen = first.get(arrival.who);
+      expect(seen, arrival.who).toBeDefined();
+      expect(seen!, arrival.who).toBeGreaterThanOrEqual(arrival.from);
+      // Within a minute of its window opening (a rare one, or few cats wanted, waits).
+      expect(seen!, arrival.who).toBeLessThan(arrival.from + 60_000);
+    }
+    expect(first.get('kitten')).toBeGreaterThanOrEqual(SCHEDULE.swarms.from);
+    expect(first.get('kitten')).toBeLessThan(SCHEDULE.swarms.from + 1000);
+    expect(first.get('mega')).toBeGreaterThanOrEqual(SCHEDULE.bosses[0]);
+    expect(first.get('mega')).toBeLessThan(SCHEDULE.bosses[0] + 1000);
+  }, 60_000);
+});
+
+describe('the Mega Cat', () => {
+  it('arrives when the schedule says, with its own bar; sent home, it leaves a chest', () => {
+    const boss: Schedule = {
+      arrivals: [{ from: 0, who: 'basic', weight: 1 }],
+      swarms: { from: Infinity, everyMs: 1, size: [0, 0] },
+      bosses: [5000],
+    };
+    const a = arena({
+      schedule: boss,
+      escalation: [[0, 0]],
+      startingWeapons: ['thunderous-vacuum', 'can-opener', 'cat-treats'],
+      startingLevel: 8,
+    });
+    let arrived = false;
+    while (a.state().time < 4900) a.step(still);
+    expect(a.state().boss).toBeNull();
+    while (!arrived && a.state().time < 6000) {
+      a.step(still);
+      arrived = a.drainEvents().some((e) => e.kind === 'boss');
+    }
+    expect(arrived).toBe(true);
+    expect(a.state().boss).toMatchObject({ limit: VARIETIES.mega.homesickness });
+    while (a.state().boss && a.state().time < 300_000) a.step(still);
+    expect(a.state().boss).toBeNull();
+    expect(a.state().chests).toBe(1);
+  }, 60_000);
+
+  it('a chest he walks over gives a level-up (until weapons evolve)', () => {
+    const boss: Schedule = {
+      arrivals: [{ from: 0, who: 'basic', weight: 1 }],
+      swarms: { from: Infinity, everyMs: 1, size: [0, 0] },
+      bosses: [1000],
+    };
+    const a = arena({
+      schedule: boss,
+      escalation: [[0, 0]],
+      startingWeapons: ['thunderous-vacuum', 'can-opener', 'cat-treats'],
+      startingLevel: 8,
+      chestReach: ARENA_CONFIG.chestReach,
+    });
+    while (a.state().chests === 0 && a.state().time < 300_000) a.step(still);
+    const chest = a.chests()[0];
+    const level = a.state().level;
+    // Walk to it.
+    while (!a.choices() && a.state().time < 400_000) {
+      const { x, y } = a.state().hero;
+      const d = Math.hypot(chest.x - x, chest.y - y) || 1;
+      a.step({ x: (chest.x - x) / d, y: (chest.y - y) / d });
+    }
+    expect(a.choices()).not.toBeNull();
+    expect(a.state().chests).toBe(0);
+    a.choose(0);
+    expect(a.state().level).toBe(level);
+  }, 60_000);
+});
~~~~

</details>

#### T9 — `night-2026-10-07-t9-evolution`

Weapon evolution by chest: Infinite Laser, Forbidden Catnip Vacuum, Yarn Apocalypse, announced in text and sound. Why: plan task 9 (D51–D55).

<details><summary>Code: 4 files changed, 464 insertions(+), 14 deletions(-)</summary>

~~~~diff
diff --git a/app/ui/xenocats/arena-view.tsx b/app/ui/xenocats/arena-view.tsx
index 19ad6dc..a1d0d3c 100644
--- a/app/ui/xenocats/arena-view.tsx
+++ b/app/ui/xenocats/arena-view.tsx
@@ -4,7 +4,7 @@ import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from '
 import { Button } from '@/app/ui/button';
 import { type Arena, ARENA_CONFIG, type ArenaOutcome, BLADE_RADIUS, createArena } from './arena';
 import { HERO_SVG, VARIETY_SVG } from './arena-art';
-import { type Choice, describeChoice } from './arsenal';
+import { type Choice, describeChoice, evolutionText } from './arsenal';
 import { SURVIVAL_BEST_KEY, bestOf, clockText, readBest, writeBest } from './arena-storage';
 import { catArt } from './cat-art';
 import { CAT_TYPES } from './cat-types';
@@ -38,9 +38,13 @@ const SHOT_COLOR: Record<string, string> = {
   'cat-treats': '#fbbf24',
   'spray-bottle': '#7dd3fc',
   'yarn-ball': '#f472b6',
+  'yarn-apocalypse': '#ec4899',
   hairball: '#a8865b',
 };
 
+/** How long an evolution's announcement stays, ms. */
+const NOTICE_MS = 5000;
+
 /** Cats drawn this size, px. */
 const CAT_SIZE = 44;
 const HERO_SIZE = 56;
@@ -125,6 +129,8 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
   const [choices, setChoices] = useState<Choice[] | null>(null);
   // The level the waiting choice is for (several can wait after one gem).
   const [choiceLevel, setChoiceLevel] = useState(2);
+  // An evolution's announcement, for a few seconds.
+  const [notice, setNotice] = useState<string | null>(null);
   const choiceRef = useRef<HTMLDivElement>(null);
   const best = useSyncExternalStore(subscribeBest, readBest, () => null);
   const arenaRef = useRef<Arena | null>(null);
@@ -174,6 +180,7 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
           : { schedule: { ...SCHEDULE, bosses: [boss, ...SCHEDULE.bosses].sort((a, b) => a - b) } },
     });
     setOutcome(null);
+    setNotice(null);
     setHud(null);
     show('playing');
   };
@@ -238,6 +245,12 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
     };
   }, [running]);
 
+  useEffect(() => {
+    if (!notice) return;
+    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
+    return () => window.clearTimeout(timer);
+  }, [notice]);
+
   // The run: input, the fixed-step loop, drawing, sounds.
   useEffect(() => {
     if (!running) return;
@@ -515,6 +528,9 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
           if (player) player.play(soundsFor(CAT_TYPES[titan]).wake);
         } else if (event.kind === 'chest') {
           if (player) sound(() => player.play(soundsFor(CAT_TYPES[0]).arrive));
+        } else if (event.kind === 'evolution') {
+          setNotice(evolutionText(event.from, event.to));
+          if (player) player.play(soundsFor(CAT_TYPES[0]).wake);
         } else if (event.kind === 'level-up') {
           if (player) sound(() => player.play(soundsFor(CAT_TYPES[0]).arrive));
         } else if (event.kind === 'matriarch' && titan >= 0 && player) {
@@ -721,6 +737,13 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
               </div>
             </div>
           )}
+          <p
+            role="status"
+            data-testid="survival-notice"
+            className="pointer-events-none absolute inset-x-0 top-40 px-4 text-center font-display text-lg font-semibold text-plasma"
+          >
+            {notice}
+          </p>
           <div className="relative flex flex-wrap items-center gap-6 p-4 text-sm font-semibold text-cream">
             <p data-testid="survival-time">
               Time {clockText(hud?.time ?? 0)} / {clockText(ARENA_CONFIG.timeGoalMs)}
diff --git a/app/ui/xenocats/arena.ts b/app/ui/xenocats/arena.ts
index d0d510f..783b585 100644
--- a/app/ui/xenocats/arena.ts
+++ b/app/ui/xenocats/arena.ts
@@ -20,12 +20,14 @@
 
 import {
   type Choice,
+  MAX_WEAPON_LEVEL,
   type Modifiers,
   type PassiveId,
   WEAPONS,
   type WeaponId,
   type WeaponKind,
   type WeaponStats,
+  evolutionFor,
   modifiers,
   offerChoices,
   weaponStats,
@@ -87,6 +89,8 @@ export type ArenaConfig = {
   firstShotMs: number;
   /** The level they start at (a test's way to try a weapon at its best). */
   startingLevel: number;
+  /** Passives he starts with, at level 1. */
+  startingPassives: readonly PassiveId[];
   gems: {
     /** Gems this near (times Long Whiskers) fly to him, px. */
     pickup: number;
@@ -148,6 +152,7 @@ export const ARENA_CONFIG: ArenaConfig = {
   startingWeapons: ['laser-pointer'],
   firstShotMs: 550,
   startingLevel: 1,
+  startingPassives: [],
   gems: { pickup: 100, speed: 520, value: 1, eliteValue: 6, cap: 1500 },
   matriarch: { speed: 330, reach: 70 },
   schedule: SCHEDULE,
@@ -244,8 +249,16 @@ export type Projectile = {
   until: number;
   /** The cats it has touched (by id), each only once. */
   touched: number[];
+  /** How many more times it splits when it bounces (the Yarn Apocalypse's). */
+  splits: number;
 };
 
+/** The Yarn Apocalypse's balls stop splitting at this many at once. */
+export const YARN_APOCALYPSE_CAP = 96;
+
+/** The Forbidden Catnip Vacuum's burst: cats this close to him go home, px (before Catnip). */
+export const GULP_BURST_RADIUS = 170;
+
 export type Gem = { x: number; y: number; value: number };
 
 export type ArenaEvent =
@@ -255,6 +268,7 @@ export type ArenaEvent =
   | { kind: 'chest'; x: number; y: number }
   | { kind: 'laser'; from: Vec; to: Vec }
   | { kind: 'level-up'; level: number }
+  | { kind: 'evolution'; from: WeaponId; to: WeaponId }
   | { kind: 'fired'; weapon: WeaponId }
   | { kind: 'matriarch' }
   | { kind: 'over'; outcome: ArenaOutcome };
@@ -312,11 +326,13 @@ export function createArena(options: {
   for (const id of config.startingWeapons) {
     weapons.set(id, { level: config.startingLevel, readyAt: config.firstShotMs });
   }
-  const passives = new Map<PassiveId, number>();
+  const passives = new Map<PassiveId, number>(config.startingPassives.map((id) => [id, 1]));
   let mods: Modifiers = modifiers(passives);
   const projectiles: Projectile[] = [];
   const spareProjectiles: Projectile[] = [];
   const beams: { from: Vec; to: Vec; until: number }[] = [];
+  // The Forbidden Catnip Vacuum's burst, when it comes (after its pull).
+  let gulpAt = Infinity;
   // Experience.
   const gems: Gem[] = [];
   let xp = 0;
@@ -695,9 +711,10 @@ export function createArena(options: {
     return length < 0.5 ? { x: hero.facing, y: 0 } : { x: dx / length, y: dy / length };
   }
 
-  function launch(p: Omit<Projectile, 'touched'>) {
+  function launch(p: Omit<Projectile, 'touched' | 'splits'> & { splits?: number }) {
     const projectile = spareProjectiles.pop() ?? ({ touched: [] } as unknown as Projectile);
     Object.assign(projectile, p);
+    projectile.splits = p.splits ?? 0;
     projectile.touched.length = 0;
     projectiles.push(projectile);
   }
@@ -730,6 +747,37 @@ export function createArena(options: {
       }
       return hit.size > 0;
     }
+    if (kind === 'web') {
+      // Beams at every cat near him, each joined to the next: a web, all the time.
+      const targets = nearest(hero, s.area, s.count);
+      if (targets.length === 0) return false;
+      let from: Vec | null = null;
+      for (const i of targets) {
+        const cat = cats[i];
+        const way = aim(cat);
+        // Still a laser: whatever refuses lasers refuses this.
+        beam(hero, way.x, way.y, s.area, 16, s.damage);
+        const to = { x: cat.x, y: cat.y };
+        if (from) beams.push({ from, to, until: time + s.durationMs });
+        from = to;
+      }
+      return true;
+    }
+    if (kind === 'gulp') {
+      const targets = within(hero, s.area);
+      if (targets.length === 0) return false;
+      for (const i of targets) {
+        const cat = cats[i];
+        const d = Math.hypot(cat.x - hero.x, cat.y - hero.y);
+        const keep = Math.max(d * (1 - s.speed), reachOf(cat) + 6);
+        if (d > keep) {
+          cat.x = hero.x + ((cat.x - hero.x) * keep) / d;
+          cat.y = hero.y + ((cat.y - hero.y) * keep) / d;
+        }
+      }
+      gulpAt = time + s.durationMs;
+      return true;
+    }
     if (kind === 'pull') {
       const targets = within(hero, s.area);
       if (targets.length === 0) return false;
@@ -791,6 +839,8 @@ export function createArena(options: {
           vy: Math.sin(turn) * s.speed,
           pierce: Infinity,
           until: time + s.durationMs,
+          // The Yarn Apocalypse's "pierce" is how often each ball splits.
+          splits: id === 'yarn-apocalypse' ? s.pierce : 0,
         });
       }
       return true;
@@ -807,6 +857,15 @@ export function createArena(options: {
   }
 
   function swingWeapons(dt: number) {
+    if (time >= gulpAt) {
+      gulpAt = Infinity;
+      const gulp = weapons.get('forbidden-catnip-vacuum');
+      if (gulp) {
+        const s = weaponStats('forbidden-catnip-vacuum', gulp.level, mods);
+        for (const i of within(hero, GULP_BURST_RADIUS * mods.area))
+          hurt(cats[i], s.damage, 'gulp');
+      }
+    }
     for (const [id, held] of weapons) {
       const s = weaponStats(id, held.level, mods);
       const kind = WEAPONS[id].kind;
@@ -824,6 +883,12 @@ export function createArena(options: {
     }
   }
 
+  function yarnApocalypseBalls() {
+    let n = 0;
+    for (const p of projectiles) if (p.weapon === 'yarn-apocalypse') n++;
+    return n;
+  }
+
   function moveProjectiles(dt: number) {
     const left = hero.x - viewport.width / 2;
     const top = hero.y - viewport.height / 2;
@@ -831,12 +896,40 @@ export function createArena(options: {
       const p = projectiles[n];
       p.x += p.vx * dt;
       p.y += p.vy * dt;
-      if (p.weapon === 'yarn-ball') {
+      if (p.weapon === 'yarn-ball' || p.weapon === 'yarn-apocalypse') {
         // Off the edges of the screen, as he walks.
-        if (p.x < left || p.x > left + viewport.width)
+        let bounced = false;
+        if (p.x < left || p.x > left + viewport.width) {
           p.vx = Math.sign(hero.x - p.x) * Math.abs(p.vx);
-        if (p.y < top || p.y > top + viewport.height)
+          bounced = true;
+        }
+        if (p.y < top || p.y > top + viewport.height) {
           p.vy = Math.sign(hero.y - p.y) * Math.abs(p.vy);
+          bounced = true;
+        }
+        // The Apocalypse's balls split in two where they bounce, up to a limit.
+        if (bounced && p.splits > 0 && yarnApocalypseBalls() < YARN_APOCALYPSE_CAP) {
+          p.splits--;
+          // The other half goes off at a right angle, but back onto the screen.
+          let vx = -p.vy;
+          let vy = p.vx;
+          if (p.x < left || p.x > left + viewport.width)
+            vx = Math.sign(hero.x - p.x) * Math.abs(vx);
+          if (p.y < top || p.y > top + viewport.height) vy = Math.sign(hero.y - p.y) * Math.abs(vy);
+          launch({
+            weapon: p.weapon,
+            bit: false,
+            x: p.x,
+            y: p.y,
+            vx,
+            vy,
+            radius: p.radius,
+            damage: p.damage,
+            pierce: Infinity,
+            until: p.until,
+            splits: p.splits,
+          });
+        }
       }
       for (const i of within(p, p.radius)) {
         const cat = cats[i];
@@ -902,7 +995,16 @@ export function createArena(options: {
       if (Math.hypot(chest.x - hero.x, chest.y - hero.y) > config.chestReach) continue;
       chests.splice(i, 1);
       events.push({ kind: 'chest', x: chest.x, y: chest.y });
-      pending++;
+      // A weapon ready to evolve does, in its place; otherwise a level-up.
+      const evolution = evolutionFor(
+        new Map([...weapons].map(([id, w]) => [id, w.level] as const)),
+        passives
+      );
+      if (evolution) {
+        weapons.delete(evolution.from);
+        weapons.set(evolution.to, { level: MAX_WEAPON_LEVEL, readyAt: time });
+        events.push({ kind: 'evolution', from: evolution.from, to: evolution.to });
+      } else pending++;
     }
     if (pending > 0 && !choosing) offer();
   }
diff --git a/app/ui/xenocats/arsenal.ts b/app/ui/xenocats/arsenal.ts
index 38576b7..47504ce 100644
--- a/app/ui/xenocats/arsenal.ts
+++ b/app/ui/xenocats/arsenal.ts
@@ -1,8 +1,9 @@
 // What the Keeper can carry in Survival (arena.ts): nine weapons that fire on their
 // own, up to level 8, and passives that make him or his weapons better, up to level
 // 5; at most six of each. Each level-up offers three choices (four with the Lucky
-// Bell), drawn from what he does not yet have at its highest level. Pure data and
-// rules, no DOM: arena.ts makes the weapons fire.
+// Bell), drawn from what he does not yet have at its highest level. A weapon at its
+// highest level, held with its passive, evolves when he opens a chest (EVOLUTIONS).
+// Pure data and rules, no DOM: arena.ts makes the weapons fire.
 
 import type { Random } from './random';
 
@@ -20,7 +21,11 @@ export type WeaponId =
   | 'can-opener'
   | 'hairball'
   | 'thunderous-vacuum'
-  | 'laser-pointer-deluxe';
+  | 'laser-pointer-deluxe'
+  // Evolved: never offered, only reached by evolution.
+  | 'infinite-laser'
+  | 'forbidden-catnip-vacuum'
+  | 'yarn-apocalypse';
 
 export type PassiveId =
   | 'rubber-chicken'
@@ -53,6 +58,11 @@ export type WeaponStats = {
 
 type Growth = { [K in keyof WeaponStats]: readonly [number, number] };
 
+/** One set of stats at every level: an evolved weapon does not grow. */
+function fixed(stats: WeaponStats): WeaponStats[] {
+  return Array.from({ length: MAX_WEAPON_LEVEL }, () => stats);
+}
+
 /** Level 1 at the first value, level 8 at the second, evenly between; counts rounded down. */
 function levels(growth: Growth): WeaponStats[] {
   return Array.from({ length: MAX_WEAPON_LEVEL }, (_, i) => {
@@ -89,7 +99,11 @@ export type WeaponKind =
   /** A zone round him. */
   | 'zone'
   /** A beam that jumps from cat to cat. */
-  | 'chain';
+  | 'chain'
+  /** Beams at every cat near him, joined to one another, all the time. */
+  | 'web'
+  /** Pulls every cat far round him in, then sends those close home at once. */
+  | 'gulp';
 
 export type WeaponInfo = {
   name: string;
@@ -226,8 +240,87 @@ export const WEAPONS: Readonly<Record<WeaponId, WeaponInfo>> = {
       pierce: [99, 99],
     }),
   },
+  'infinite-laser': {
+    name: 'Infinite Laser',
+    description: 'The red dot, without end. The screen is a web of it.',
+    kind: 'web',
+    levels: fixed({
+      cooldownMs: 150,
+      damage: 22,
+      area: 520,
+      count: 14,
+      speed: 0,
+      durationMs: 180,
+      pierce: 99,
+    }),
+  },
+  'forbidden-catnip-vacuum': {
+    name: 'Forbidden Catnip Vacuum',
+    description:
+      'It should not exist. It draws in every cat for a long way, then sends them all home.',
+    kind: 'gulp',
+    levels: fixed({
+      cooldownMs: 4000,
+      // Given once, at the burst, to every cat close to him.
+      damage: 600,
+      // How far it pulls from.
+      area: 560,
+      count: 1,
+      // The share of the way each cat is drawn in.
+      speed: 0.85,
+      // From the pull to the burst, ms.
+      durationMs: 700,
+      pierce: 99,
+    }),
+  },
+  'yarn-apocalypse': {
+    name: 'Yarn Apocalypse',
+    description: 'The yarn splits each time it bounces. Nobody will ever wind it up again.',
+    kind: 'bounce',
+    levels: fixed({
+      cooldownMs: 2600,
+      damage: 30,
+      area: 16,
+      count: 4,
+      speed: 380,
+      durationMs: 6000,
+      // How many times each ball splits, at most.
+      pierce: 4,
+    }),
+  },
 };
 
+/** A weapon at its highest level and its passive, held together, become another. */
+export type Evolution = { from: WeaponId; with: PassiveId; to: WeaponId };
+
+export const EVOLUTIONS: readonly Evolution[] = [
+  { from: 'laser-pointer', with: 'battery', to: 'infinite-laser' },
+  { from: 'vacuum-cleaner', with: 'catnip', to: 'forbidden-catnip-vacuum' },
+  { from: 'yarn-ball', with: 'scissors', to: 'yarn-apocalypse' },
+];
+
+/** The weapons a level-up may offer: all but the evolved ones. */
+export const BASE_WEAPONS: readonly WeaponId[] = (Object.keys(WEAPONS) as WeaponId[]).filter(
+  (id) => !EVOLUTIONS.some((e) => e.to === id)
+);
+
+/** The evolution a chest opened now would bring, if any: the first that is ready. */
+export function evolutionFor(
+  weapons: ReadonlyMap<WeaponId, number>,
+  passives: ReadonlyMap<PassiveId, number>
+): Evolution | null {
+  for (const evolution of EVOLUTIONS) {
+    if (
+      weapons.get(evolution.from) === MAX_WEAPON_LEVEL &&
+      (passives.get(evolution.with) ?? 0) > 0 &&
+      !weapons.has(evolution.to)
+    ) {
+      return evolution;
+    }
+  }
+  return null;
+}
+
 export type PassiveInfo = {
   name: string;
   description: string;
@@ -346,10 +439,12 @@ export function offerChoices(
   passives: ReadonlyMap<PassiveId, number>,
   count: number,
   random: Random,
-  available: readonly WeaponId[] = Object.keys(WEAPONS) as WeaponId[]
+  available: readonly WeaponId[] = BASE_WEAPONS
 ): Choice[] {
   const pool: Choice[] = [];
   for (const id of available) {
+    // A weapon that has evolved is gone for good: its evolution holds its place.
+    if (EVOLUTIONS.some((e) => e.from === id && weapons.has(e.to))) continue;
     const level = weapons.get(id);
     if (level === undefined) {
       if (weapons.size < WEAPON_SLOTS) pool.push({ kind: 'weapon', id, level: 1 });
@@ -383,3 +478,8 @@ export function describeChoice(choice: Choice): { name: string; description: str
     description: info.description,
   };
 }
+
+/** An evolution, announced with due gravity. */
+export function evolutionText(from: WeaponId, to: WeaponId): string {
+  return `The ${WEAPONS[from].name} is no more. In its place: the ${WEAPONS[to].name}.`;
+}
diff --git a/tests/unit/xenocats/arsenal.test.ts b/tests/unit/xenocats/arsenal.test.ts
index ef7a5b8..d10bb49 100644
--- a/tests/unit/xenocats/arsenal.test.ts
+++ b/tests/unit/xenocats/arsenal.test.ts
@@ -1,6 +1,15 @@
 import { describe, expect, it } from 'vitest';
-import { ARENA_CONFIG, type ArenaConfig, createArena } from '@/app/ui/xenocats/arena';
 import {
+  ARENA_CONFIG,
+  type ArenaConfig,
+  type ArenaEvent,
+  GULP_BURST_RADIUS,
+  YARN_APOCALYPSE_CAP,
+  createArena,
+} from '@/app/ui/xenocats/arena';
+import {
+  BASE_WEAPONS,
+  EVOLUTIONS,
   MAX_PASSIVE_LEVEL,
   MAX_WEAPON_LEVEL,
   PASSIVES,
@@ -10,6 +19,8 @@ import {
   WEAPON_SLOTS,
   type WeaponId,
   describeChoice,
+  evolutionFor,
+  evolutionText,
   modifiers,
   offerChoices,
   weaponStats,
@@ -176,7 +187,7 @@ describe('every weapon, at level 1 and at its top level', () => {
     return { sent: a.state().sentHome, a };
   }
 
-  for (const id of ALL_WEAPONS) {
+  for (const id of BASE_WEAPONS) {
     it(`${id}: grows stronger with its levels, and sends cats home at both`, () => {
       const one = weaponStats(id, 1, none);
       const top = weaponStats(id, MAX_WEAPON_LEVEL, none);
@@ -445,3 +456,217 @@ describe('levels in a run', () => {
     expect(most).toBeGreaterThan(30);
   }, 60_000);
 });
+
+describe('evolution', () => {
+  type Run = ReturnType<typeof arena>;
+
+  /** A run where every cat is an elite (each leaves a chest), nothing levels up. */
+  function ready(weapon: WeaponId, level: number, passives: PassiveId[], chestReach = 36) {
+    return arena({
+      ...steady,
+      chestReach,
+      startingWeapons: [weapon],
+      startingLevel: level,
+      startingPassives: passives,
+      escalation: [[0, 20]],
+      cats: { ...ARENA_CONFIG.cats, eliteShare: 1 },
+    });
+  }
+
+  /** He walks to the nearest chest until he opens one; the events of that step. */
+  function openChest(a: Run): ArenaEvent[] {
+    while (a.state().time < 120_000) {
+      const { x, y } = a.state().hero;
+      const [chest] = [...a.chests()].sort(
+        (p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y)
+      );
+      let input = still;
+      if (chest) {
+        const d = Math.hypot(chest.x - x, chest.y - y) || 1;
+        input = { x: (chest.x - x) / d, y: (chest.y - y) / d };
+      }
+      a.step(input);
+      const events = a.drainEvents();
+      if (events.some((e) => e.kind === 'chest')) return events;
+    }
+    throw new Error('no chest opened');
+  }
+
+  const held = (a: Run) => new Map(a.state().weapons.map((w) => [w.id, w.level] as const));
+
+  for (const { from, with: passive, to } of EVOLUTIONS) {
+    describe(`${WEAPONS[from].name} + ${PASSIVES[passive].name} → ${WEAPONS[to].name}`, () => {
+      it('at its top level, with the passive, a chest evolves it in its place', () => {
+        const a = ready(from, MAX_WEAPON_LEVEL, [passive]);
+        const events = openChest(a);
+        expect(events).toContainEqual({ kind: 'evolution', from, to });
+        expect(held(a).has(from)).toBe(false);
+        expect(held(a).get(to)).toBe(MAX_WEAPON_LEVEL);
+        // The chest went to the evolution: no level-up waits.
+        expect(a.choices()).toBeNull();
+      });
+
+      it('one level short, the chest is a level-up instead', () => {
+        const a = ready(from, MAX_WEAPON_LEVEL - 1, [passive]);
+        const events = openChest(a);
+        expect(events.some((e) => e.kind === 'evolution')).toBe(false);
+        expect(held(a).get(from)).toBe(MAX_WEAPON_LEVEL - 1);
+        expect(a.choices()).not.toBeNull();
+      });
+
+      it('without the passive, the chest is a level-up instead', () => {
+        const a = ready(from, MAX_WEAPON_LEVEL, []);
+        const events = openChest(a);
+        expect(events.some((e) => e.kind === 'evolution')).toBe(false);
+        expect(held(a).get(from)).toBe(MAX_WEAPON_LEVEL);
+        expect(a.choices()).not.toBeNull();
+      });
+
+      it('without a chest, nothing evolves', () => {
+        const a = ready(from, MAX_WEAPON_LEVEL, [passive], -1);
+        while (a.state().time < 30_000) a.step(still);
+        expect(a.drainEvents().some((e) => e.kind === 'evolution')).toBe(false);
+        expect(held(a).get(from)).toBe(MAX_WEAPON_LEVEL);
+      });
+    });
+  }
+
+  it('the rules alone: the top level, the passive held, and not evolved already', () => {
+    const top = new Map<WeaponId, number>([['laser-pointer', MAX_WEAPON_LEVEL]]);
+    const battery = new Map<PassiveId, number>([['battery', 1]]);
+    expect(evolutionFor(top, battery)?.to).toBe('infinite-laser');
+    expect(evolutionFor(new Map([['laser-pointer', 7]]), battery)).toBeNull();
+    expect(evolutionFor(top, new Map([['catnip', 5]]))).toBeNull();
+    const both = new Map<WeaponId, number>([...top, ['infinite-laser', MAX_WEAPON_LEVEL]]);
+    expect(evolutionFor(both, battery)).toBeNull();
+  });
+
+  it('an evolved weapon is never offered at a level-up', () => {
+    for (const { to } of EVOLUTIONS) expect(BASE_WEAPONS).not.toContain(to);
+    for (let seed = 1; seed <= 40; seed++) {
+      for (const choice of offerChoices(new Map(), new Map(), 4, createRandom(seed))) {
+        if (choice.kind === 'weapon') expect(BASE_WEAPONS).toContain(choice.id);
+      }
+    }
+    // Held, it is at its top level: never offered again either.
+    const evolved = new Map<WeaponId, number>([['infinite-laser', MAX_WEAPON_LEVEL]]);
+    for (let seed = 1; seed <= 40; seed++) {
+      for (const choice of offerChoices(evolved, new Map(), 4, createRandom(seed))) {
+        expect(choice.kind === 'weapon' && choice.id === 'infinite-laser').toBe(false);
+      }
+    }
+  });
+
+  it('once evolved, the weapon it was is never offered again', () => {
+    for (const { from, to } of EVOLUTIONS) {
+      const held = new Map<WeaponId, number>([[to, MAX_WEAPON_LEVEL]]);
+      for (let seed = 1; seed <= 60; seed++) {
+        for (const choice of offerChoices(held, new Map(), 4, createRandom(seed))) {
+          expect(choice.kind === 'weapon' && choice.id === from, `${from} offered`).toBe(false);
+        }
+      }
+    }
+  });
+
+  it('an evolution announces itself in the game’s voice', () => {
+    expect(evolutionText('yarn-ball', 'yarn-apocalypse')).toBe(
+      'The Yarn Ball is no more. In its place: the Yarn Apocalypse.'
+    );
+  });
+
+  /** A run with only `id`, many cats that never go home unless it sends them. */
+  function evolved(id: WeaponId, cats = 80, homesickness: [number, number] = [1e9, 1e9]) {
+    return arena({
+      ...steady,
+      startingWeapons: [id],
+      startingLevel: MAX_WEAPON_LEVEL,
+      escalation: [[0, cats]],
+      cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness },
+    });
+  }
+
+  it('the Infinite Laser: beams at many cats at once, joined into a web, over and over', () => {
+    const a = evolved('infinite-laser');
+    const s = weaponStats('infinite-laser', MAX_WEAPON_LEVEL, none);
+    let most = 0;
+    let webbed = false;
+    const firings: number[] = [];
+    while (a.state().time < 20_000) {
+      a.step(still);
+      const events = a.drainEvents();
+      if (!events.some((e) => e.kind === 'fired')) continue;
+      firings.push(a.state().time);
+      most = Math.max(most, events.filter((e) => e.kind === 'laser').length);
+      const { x, y } = a.state().hero;
+      // Some beams run cat to cat, not from him.
+      if (a.beams().some((b) => Math.hypot(b.from.x - x, b.from.y - y) > 1)) webbed = true;
+    }
+    expect(most).toBe(s.count);
+    expect(webbed).toBe(true);
+    // Fired again and again: never more than a moment apart once cats are near.
+    const late = firings.filter((t) => t > 10_000);
+    for (let i = 1; i < late.length; i++) {
+      expect(late[i] - late[i - 1]).toBeLessThanOrEqual(s.cooldownMs + a.config.stepMs);
+    }
+    expect(late.length).toBeGreaterThan(30);
+  });
+
+  it('the Forbidden Catnip Vacuum: draws in cats from far off, then sends them home together', () => {
+    // Cats that need a lot, but not a burst's worth.
+    const a = evolved('forbidden-catnip-vacuum', 80, [300, 300]);
+    const s = weaponStats('forbidden-catnip-vacuum', MAX_WEAPON_LEVEL, none);
+    let pulledFar = false;
+    let mostAtOnce = 0;
+    while (a.state().time < 30_000) {
+      const before = new Map(a.cats().map((c) => [c.id, Math.hypot(c.x, c.y)]));
+      const sentBefore = a.state().sentHome;
+      a.step(still);
+      const events = a.drainEvents();
+      if (events.some((e) => e.kind === 'fired')) {
+        // At the pull: cats well beyond the burst came within it.
+        for (const cat of a.cats()) {
+          const was = before.get(cat.id) ?? 0;
+          if (was > s.area * 0.6 && Math.hypot(cat.x, cat.y) < GULP_BURST_RADIUS) pulledFar = true;
+        }
+      }
+      mostAtOnce = Math.max(mostAtOnce, a.state().sentHome - sentBefore);
+    }
+    expect(pulledFar).toBe(true);
+    expect(mostAtOnce).toBeGreaterThanOrEqual(10);
+  });
+
+  it('the Yarn Apocalypse: its balls split as they bounce, up to a limit', () => {
+    const a = evolved('yarn-apocalypse');
+    const s = weaponStats('yarn-apocalypse', MAX_WEAPON_LEVEL, none);
+    let most = 0;
+    while (a.state().time < 30_000) {
+      a.step(still);
+      const balls = a.projectiles().filter((p) => p.weapon === 'yarn-apocalypse').length;
+      most = Math.max(most, balls);
+      expect(balls).toBeLessThanOrEqual(YARN_APOCALYPSE_CAP + s.count);
+    }
+    expect(most).toBeGreaterThan(s.count * 4);
+  });
+
+  it('the Yarn Apocalypse: a ball past the edge, and the half it splits off, head back in', () => {
+    const a = evolved('yarn-apocalypse');
+    const { width, height } = viewport;
+    let outside = 0;
+    while (a.state().time < 20_000) {
+      a.step(still);
+      for (const p of a.projectiles()) {
+        if (p.weapon !== 'yarn-apocalypse') continue;
+        // He stands at the origin: the screen is centred on him.
+        if (Math.abs(p.x) > width / 2) {
+          outside++;
+          expect(Math.sign(p.vx)).toBe(-Math.sign(p.x));
+        }
+        if (Math.abs(p.y) > height / 2) {
+          outside++;
+          expect(Math.sign(p.vy)).toBe(-Math.sign(p.y));
+        }
+      }
+    }
+    expect(outside).toBeGreaterThan(0);
+  });
+});
~~~~

</details>

#### T10 — `night-2026-10-07-t10-progression`

Persistent progression: tufts, the Tailor's upgrades, milestone unlocks, three characters, a hidden evolution, a secret cat, the codex, versioned storage (`progression.ts`, `progression-view.tsx`). Why: plan task 10 (D56–D64).

<details><summary>Code: 11 files changed, 1215 insertions(+), 29 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 8346dbb..22912d3 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -48,7 +48,7 @@ jobs:
       - name: Unit tests (cats, games, page, sound)
         if: ${{ !cancelled() }}
         run: >-
-          npx vitest run tests/unit/xenocats/arena tests/unit/xenocats/arsenal tests/unit/xenocats/varieties
+          npx vitest run tests/unit/xenocats/arena tests/unit/xenocats/arsenal tests/unit/xenocats/varieties tests/unit/xenocats/progression
           tests/unit/xenocats/walking
           tests/unit/xenocats/locked-pointer
           tests/unit/xenocats/taming tests/unit/xenocats/page-hits tests/unit/xenocats/sounds
diff --git a/app/ui/xenocats/arena-art.ts b/app/ui/xenocats/arena-art.ts
index 5df321d..a69e380 100644
--- a/app/ui/xenocats/arena-art.ts
+++ b/app/ui/xenocats/arena-art.ts
@@ -2,24 +2,54 @@
 // (tailwind.config.ts): the hero, the Keeper. A placeholder until a Superdesign pass.
 // The cats are the twenty xenocat types' own artwork (cat-art.ts), unchanged.
 
+import type { VarietyId } from './varieties';
+
 const VOID = '#070b14';
 const LINE = '#2d2f47';
 const AURA = '#9d86ff';
 const PLASMA = '#c1e838';
 const CREAM = '#e0e0b3';
 
-/** The Keeper: a long dark coat, a pale face under a hood, a laser pointer held out. */
-export const HERO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
+/**
+ * A hero: a long coat, a pale face under a hood, an arm held out with `tool` at
+ * its end. The Keeper and the characters (progression.ts) are this one, re-dressed.
+ */
+function heroSvg(o: { coat: string; trim: string; tool: string }): string {
+  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
   <ellipse cx="32" cy="58" rx="16" ry="4" fill="${VOID}" opacity="0.6"/>
-  <path d="M20 54 L24 26 Q32 18 40 26 L44 54 Q32 58 20 54 Z" fill="${LINE}" stroke="${AURA}" stroke-width="2"/>
-  <path d="M32 30 L32 54" stroke="${AURA}" stroke-width="1.5" opacity="0.7"/>
-  <path d="M21 26 Q32 6 43 26 Q32 20 21 26 Z" fill="${LINE}" stroke="${AURA}" stroke-width="2"/>
+  <path d="M20 54 L24 26 Q32 18 40 26 L44 54 Q32 58 20 54 Z" fill="${o.coat}" stroke="${o.trim}" stroke-width="2"/>
+  <path d="M32 30 L32 54" stroke="${o.trim}" stroke-width="1.5" opacity="0.7"/>
+  <path d="M21 26 Q32 6 43 26 Q32 20 21 26 Z" fill="${o.coat}" stroke="${o.trim}" stroke-width="2"/>
   <ellipse cx="32" cy="24" rx="7" ry="6" fill="${CREAM}"/>
   <rect x="27" y="22.5" width="10" height="3" rx="1.5" fill="${VOID}"/>
   <path d="M41 36 L52 33" stroke="${CREAM}" stroke-width="3.5" stroke-linecap="round"/>
-  <rect x="50" y="30.5" width="9" height="4" rx="1.5" fill="${AURA}"/>
-  <circle cx="59.5" cy="32.5" r="2" fill="${PLASMA}"/>
+  ${o.tool}
 </svg>`;
+}
+
+/** The heroes, by character (progression.ts): the Keeper, the Night Porter, the Housekeeper. */
+export const HERO_SVGS = {
+  keeper: heroSvg({
+    coat: LINE,
+    trim: AURA,
+    tool: `<rect x="50" y="30.5" width="9" height="4" rx="1.5" fill="${AURA}"/><circle cx="59.5" cy="32.5" r="2" fill="${PLASMA}"/>`,
+  }),
+  // A shorter, brighter-trimmed coat, and a spray bottle.
+  'night-porter': heroSvg({
+    coat: '#12162b',
+    trim: PLASMA,
+    tool: `<rect x="51" y="27" width="7" height="11" rx="2" fill="#7dd3fc"/><rect x="52.5" y="23" width="4" height="4" fill="${CREAM}"/><path d="M56.5 24 H61" stroke="${CREAM}" stroke-width="2"/>`,
+  }),
+  // A pale apron over the coat, and the vacuum's nozzle.
+  housekeeper: heroSvg({
+    coat: '#4b4f6b',
+    trim: CREAM,
+    tool: `<path d="M28 34 H36 L38 52 H26 Z" fill="${CREAM}" opacity="0.85"/><path d="M52 33 Q58 40 56 50" stroke="${AURA}" stroke-width="3" fill="none"/><rect x="51" y="49" width="10" height="5" rx="2" fill="${LINE}" stroke="${AURA}" stroke-width="1.5"/>`,
+  }),
+} as const;
+
+/** The Keeper. */
+export const HERO_SVG = HERO_SVGS.keeper;
 
 /**
  * A sitting cat, front on, in a 64×64 box: body, head, ears, eyes, a tail; `extra`
@@ -48,7 +78,7 @@ function catSvg(o: {
 }
 
 /** The varieties' drawings (varieties.ts). Placeholders until a Superdesign pass. */
-export const VARIETY_SVG: Readonly<Record<string, string>> = {
+export const VARIETY_SVG: Readonly<Record<VarietyId, string>> = {
   basic: catSvg({ fur: '#8a8aa0', belly: '#c9c9d6', eyes: PLASMA }),
   zoomies: catSvg({
     fur: '#e8963f',
@@ -87,6 +117,13 @@ export const VARIETY_SVG: Readonly<Record<string, string>> = {
     eyes: AURA,
     under: `<circle cx="32" cy="34" r="27" fill="${AURA}" opacity="0.18"/>`,
   }),
+  // The secret cat: a tuxedo, with someone else's collar.
+  neighbour: catSvg({
+    fur: '#1b1d2b',
+    belly: '#f3f0ea',
+    eyes: PLASMA,
+    extra: `<path d="M24 36 Q32 40 40 36" stroke="#ef4444" stroke-width="2.5" fill="none"/><circle cx="32" cy="39.5" r="2" fill="${CREAM}"/>`,
+  }),
   mega: catSvg({
     fur: '#e8822f',
     belly: '#f8c98f',
diff --git a/app/ui/xenocats/arena-view.tsx b/app/ui/xenocats/arena-view.tsx
index a1d0d3c..920c51f 100644
--- a/app/ui/xenocats/arena-view.tsx
+++ b/app/ui/xenocats/arena-view.tsx
@@ -3,14 +3,26 @@
 import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
 import { Button } from '@/app/ui/button';
 import { type Arena, ARENA_CONFIG, type ArenaOutcome, BLADE_RADIUS, createArena } from './arena';
-import { HERO_SVG, VARIETY_SVG } from './arena-art';
-import { type Choice, describeChoice, evolutionText } from './arsenal';
+import { HERO_SVGS, VARIETY_SVG } from './arena-art';
+import { type Choice, WEAPONS, type WeaponId, describeChoice, evolutionText } from './arsenal';
 import { SURVIVAL_BEST_KEY, bestOf, clockText, readBest, writeBest } from './arena-storage';
 import { catArt } from './cat-art';
 import { CAT_TYPES } from './cat-types';
 import { recordStat } from './field-guide';
 import { createFrameGuard } from './frame-guard';
 import { MovementPad } from './movement-pad-view';
+import {
+  CHARACTERS,
+  type CharacterId,
+  MILESTONES,
+  type MilestoneId,
+  WEAPON_UNLOCKS,
+  applyRun,
+  readProgress,
+  runConfig,
+  writeProgress,
+} from './progression';
+import { ProgressionPanel } from './progression-view';
 import { createRandom, freshSeed } from './random';
 import { type SoundPlayer, sharedSoundPlayer, soundsFor } from './sounds';
 import { SCHEDULE, VARIETIES, type VarietyId } from './varieties';
@@ -83,6 +95,22 @@ const OUTCOME_TEXT: Record<ArenaOutcome, string> = {
   goal: 'Five minutes, and the night is survived. The cats remain.',
 };
 
+/** What a milestone unlocks, in a sentence (or nothing). */
+function unlockedBy(id: MilestoneId): string {
+  const names = [
+    ...Object.entries(WEAPON_UNLOCKS)
+      .filter(([, milestone]) => milestone === id)
+      .map(([weapon]) => WEAPONS[weapon as WeaponId].name),
+    ...(Object.keys(CHARACTERS) as CharacterId[])
+      .filter((c) => {
+        const unlock = CHARACTERS[c].unlock;
+        return unlock.kind === 'milestone' && unlock.milestone === id;
+      })
+      .map((c) => CHARACTERS[c].name),
+  ];
+  return names.length > 0 ? `Now available: ${names.join(', ')}.` : '';
+}
+
 function testHooks(): { seed: number; speed: number; boss: number | null } {
   const params = new URLSearchParams(window.location.search);
   const seed = Number(params.get('seed'));
@@ -124,7 +152,12 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
   const [hud, setHud] = useState<Hud | null>(null);
   const [outcome, setOutcome] = useState<ArenaOutcome | null>(null);
   // The finished run's numbers, kept for the results screen.
-  const [result, setResult] = useState<{ time: number; sentHome: number } | null>(null);
+  const [result, setResult] = useState<{
+    time: number;
+    sentHome: number;
+    earned: number;
+    reached: MilestoneId[];
+  } | null>(null);
   // A level-up's choices, while the run waits for one.
   const [choices, setChoices] = useState<Choice[] | null>(null);
   // The level the waiting choice is for (several can wait after one gem).
@@ -141,6 +174,9 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
   const resultsRef = useRef<HTMLElement>(null);
   const padRef = useRef<Vec>({ x: 0, y: 0 });
   const speedRef = useRef(1);
+  // Who went out, and what the run found for the codex.
+  const characterRef = useRef<CharacterId>('keeper');
+  const foundRef = useRef(new Set<string>());
   const playerRef = useRef<SoundPlayer | null>(null);
   const onPad = useCallback((direction: Vec) => {
     padRef.current = direction;
@@ -157,7 +193,15 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
       if (!arena) return;
       const time = Math.min(arena.state().time, arena.config.timeGoalMs);
       writeBest(bestOf(readBest(), time));
-      setResult({ time, sentHome: arena.state().sentHome });
+      const { sentHome, level } = arena.state();
+      const after = applyRun(readProgress(), {
+        timeMs: time,
+        sentHome,
+        level,
+        found: [...foundRef.current],
+      });
+      writeProgress(after.progress);
+      setResult({ time, sentHome, earned: after.earned, reached: after.reached });
       setOutcome(how);
       show('results');
     },
@@ -170,14 +214,22 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
     playerRef.current ??= sharedSoundPlayer();
     // The click that started the run is the gesture sound needs.
     playerRef.current.unlock();
+    const progress = readProgress();
+    characterRef.current = progress.character;
+    foundRef.current = new Set();
     arenaRef.current = createArena({
       random: createRandom(seed),
       types: CAT_TYPES,
       viewport: { width: window.innerWidth, height: window.innerHeight },
-      config:
-        boss === null
+      config: {
+        // His character, what the Tailor sold him, the weapons unlocked.
+        ...runConfig(progress, ARENA_CONFIG),
+        ...(boss === null
           ? {}
-          : { schedule: { ...SCHEDULE, bosses: [boss, ...SCHEDULE.bosses].sort((a, b) => a - b) } },
+          : {
+              schedule: { ...SCHEDULE, bosses: [boss, ...SCHEDULE.bosses].sort((a, b) => a - b) },
+            }),
+      },
     });
     setOutcome(null);
     setNotice(null);
@@ -268,7 +320,7 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
       return art ? bitmapOf(art, CAT_SIZE * 2, redraw) : () => null;
     });
     const hero = bitmapOf(
-      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(HERO_SVG)}`,
+      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(HERO_SVGS[characterRef.current])}`,
       HERO_SIZE * 2,
       redraw
     );
@@ -529,8 +581,15 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
         } else if (event.kind === 'chest') {
           if (player) sound(() => player.play(soundsFor(CAT_TYPES[0]).arrive));
         } else if (event.kind === 'evolution') {
+          foundRef.current.add(event.to);
           setNotice(evolutionText(event.from, event.to));
           if (player) player.play(soundsFor(CAT_TYPES[0]).wake);
+        } else if (event.kind === 'secret') {
+          // Nothing is said: it is simply there. The codex remembers.
+          foundRef.current.add(event.id);
+        } else if (event.kind === 'revived') {
+          setNotice('Second Wind. He is not finished.');
+          if (player) player.play(soundsFor(CAT_TYPES[0]).wake);
         } else if (event.kind === 'level-up') {
           if (player) sound(() => player.play(soundsFor(CAT_TYPES[0]).arrive));
         } else if (event.kind === 'matriarch' && titan >= 0 && player) {
@@ -647,9 +706,9 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
       <h1 className="font-display text-4xl font-semibold text-cream md:text-[52px]">Survival</h1>
       <p className="mt-4 max-w-2xl text-sm text-aura">
         The cats come from every side, and they do not stop coming. The Keeper does not hate them;
-        he only wishes them home. His Laser Pointer finds them on its own: where you stand is
-        everything. Each touch of a cat wears down his Resolve. Last five minutes, and the Matriarch
-        herself will come for him.
+        he only wishes them home. His tools find them on their own: where you stand is everything.
+        Each touch of a cat wears down his Resolve. Last five minutes, and the Matriarch herself
+        will come for him.
       </p>
       <p className="mt-2 max-w-2xl text-sm text-aura">
         {touch
@@ -665,6 +724,8 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
         </p>
       </div>
 
+      {!running && <ProgressionPanel />}
+
       {screen === 'results' && result && outcome && (
         <section
           ref={resultsRef}
@@ -684,7 +745,18 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
             <dd data-testid="survival-result-time">{clockText(result.time)}</dd>
             <dt className="text-aura">Cats sent home</dt>
             <dd data-testid="survival-result-sent-home">{result.sentHome}</dd>
+            <dt className="text-aura">Tufts of fur gathered</dt>
+            <dd data-testid="survival-result-tufts">{result.earned}</dd>
           </dl>
+          {result.reached.length > 0 && (
+            <ul data-testid="survival-result-milestones" className="mt-3 text-sm text-plasma">
+              {result.reached.map((id) => (
+                <li key={id}>
+                  {MILESTONES[id].text}: done. {unlockedBy(id)}
+                </li>
+              ))}
+            </ul>
+          )}
           <Button className="mt-4" onClick={start}>
             Play again
           </Button>
diff --git a/app/ui/xenocats/arena.ts b/app/ui/xenocats/arena.ts
index 783b585..a8bbef5 100644
--- a/app/ui/xenocats/arena.ts
+++ b/app/ui/xenocats/arena.ts
@@ -19,6 +19,7 @@
 // or at the time goal, when the Matriarch comes for him and nothing sends her home.
 
 import {
+  BASE_WEAPONS,
   type Choice,
   MAX_WEAPON_LEVEL,
   type Modifiers,
@@ -119,6 +120,15 @@ export type ArenaConfig = {
   };
   /** He picks a chest up within this, px. */
   chestReach: number;
+  /** The base weapons a level-up may offer (the progression keeps some back). */
+  availableWeapons: readonly WeaponId[];
+  /** What the run brings from before (progression.ts): multipliers, and revivals. */
+  boost: { might: number; pickup: number; revivals: number };
+  /**
+   * The secret cat (decisions.md): once a run, from `afterMs` into it, when he has
+   * stood still for `stillMs`, it comes and sits by him.
+   */
+  secretCat: { afterMs: number; stillMs: number };
   /** The spatial grid's cell, px. */
   cellSize: number;
 };
@@ -158,6 +168,9 @@ export const ARENA_CONFIG: ArenaConfig = {
   schedule: SCHEDULE,
   laserCat: { range: 280, everyMs: 2500, shotSpeed: 420, shotRadius: 8 },
   chestReach: 36,
+  availableWeapons: BASE_WEAPONS,
+  boost: { might: 1, pickup: 1, revivals: 0 },
+  secretCat: { afterMs: 60_000, stillMs: 20_000 },
   cellSize: 64,
 };
 
@@ -269,6 +282,10 @@ export type ArenaEvent =
   | { kind: 'laser'; from: Vec; to: Vec }
   | { kind: 'level-up'; level: number }
   | { kind: 'evolution'; from: WeaponId; to: WeaponId }
+  /** The secret cat has come. */
+  | { kind: 'secret'; id: 'neighbour' }
+  /** His Resolve was spent, and half of it returned (Second Wind). */
+  | { kind: 'revived' }
   | { kind: 'fired'; weapon: WeaponId }
   | { kind: 'matriarch' }
   | { kind: 'over'; outcome: ArenaOutcome };
@@ -304,6 +321,10 @@ export function createArena(options: {
   let effect: { effect: HeroEffect; until: number; from: Vec; way: Vec } | null = null;
   let sentHome = 0;
   let nextId = 1;
+  // How long he has stood still; whether the secret cat has come; revivals left.
+  let stillFor = 0;
+  let secretCame = false;
+  let revivals = config.boost.revivals;
   // The cats: live ones in `cats`, sent-home ones kept in `spare` to be reused.
   const cats: ArenaCat[] = [];
   const spare: ArenaCat[] = [];
@@ -327,7 +348,13 @@ export function createArena(options: {
     weapons.set(id, { level: config.startingLevel, readyAt: config.firstShotMs });
   }
   const passives = new Map<PassiveId, number>(config.startingPassives.map((id) => [id, 1]));
-  let mods: Modifiers = modifiers(passives);
+  /** The passives held, and what the run brought from before (the boost). */
+  const boosted = (m: Modifiers): Modifiers => ({
+    ...m,
+    might: m.might * config.boost.might,
+    pickup: m.pickup * config.boost.pickup,
+  });
+  let mods: Modifiers = boosted(modifiers(passives));
   const projectiles: Projectile[] = [];
   const spareProjectiles: Projectile[] = [];
   const beams: { from: Vec; to: Vec; until: number }[] = [];
@@ -1011,7 +1038,7 @@ export function createArena(options: {
 
   function offer() {
     const held = new Map([...weapons].map(([id, w]) => [id, w.level] as const));
-    choosing = offerChoices(held, passives, mods.choices, random);
+    choosing = offerChoices(held, passives, mods.choices, random, config.availableWeapons);
   }
 
   return {
@@ -1041,6 +1068,13 @@ export function createArena(options: {
         spawn ? Infinity : config.cats.guardFree
       );
       spawnEvents(spawn);
+      // The secret cat, once, to a Keeper who has stood still long enough.
+      stillFor = input.x === 0 && input.y === 0 ? stillFor + config.stepMs : 0;
+      if (!secretCame && time >= config.secretCat.afterMs && stillFor >= config.secretCat.stillMs) {
+        secretCame = true;
+        spawnVariety('neighbour', onScreen(120));
+        events.push({ kind: 'secret', id: 'neighbour' });
+      }
       if (cats.length < wanted) {
         arrivals += Math.max(wanted - cats.length, 1) * config.arrivalShare * dt + dt;
         while (arrivals >= 1 && cats.length < wanted) {
@@ -1070,6 +1104,8 @@ export function createArena(options: {
         gather(hero.x, hero.y, config.hero.reach);
         for (const i of near) {
           const cat = cats[i];
+          // (The Neighbour's Cat drains nothing: it only sits there.)
+          if (cat.drain === 0) continue;
           if ((cat.x - hero.x) ** 2 + (cat.y - hero.y) ** 2 > reachOf(cat) ** 2) continue;
           hero.resolve = Math.max(hero.resolve - cat.drain, 0);
           hero.untouchableUntil = time + config.hero.untouchableMs;
@@ -1078,6 +1114,11 @@ export function createArena(options: {
           break;
         }
       }
+      if (hero.resolve <= 0 && revivals > 0) {
+        revivals--;
+        hero.resolve = maxResolve() / 2;
+        events.push({ kind: 'revived' });
+      }
       if (hero.resolve <= 0) {
         end('spent');
         return;
@@ -1123,7 +1164,7 @@ export function createArena(options: {
       } else if (choice.kind === 'passive') {
         const before = maxResolve();
         passives.set(choice.id, choice.level);
-        mods = modifiers(passives);
+        mods = boosted(modifiers(passives));
         // More Resolve to hold: he gains what was added.
         hero.resolve += maxResolve() - before;
       } else {
@@ -1153,8 +1194,11 @@ export function createArena(options: {
     beams: (): readonly { from: Vec; to: Vec }[] => beams,
     /** Where the Can Opener's blades are, and the Thunderous Vacuum's reach (or null). */
     blades: (): Vec[] => {
-      const held = weapons.get('can-opener');
-      return held ? bladesOf(weaponStats('can-opener', held.level, mods)) : [];
+      const all: Vec[] = [];
+      for (const [id, held] of weapons) {
+        if (WEAPONS[id].kind === 'orbit') all.push(...bladesOf(weaponStats(id, held.level, mods)));
+      }
+      return all;
     },
     zone: (): number | null => {
       const held = weapons.get('thunderous-vacuum');
diff --git a/app/ui/xenocats/arsenal.ts b/app/ui/xenocats/arsenal.ts
index 47504ce..c80508e 100644
--- a/app/ui/xenocats/arsenal.ts
+++ b/app/ui/xenocats/arsenal.ts
@@ -25,7 +25,8 @@ export type WeaponId =
   // Evolved: never offered, only reached by evolution.
   | 'infinite-laser'
   | 'forbidden-catnip-vacuum'
-  | 'yarn-apocalypse';
+  | 'yarn-apocalypse'
+  | 'bottomless-saucer';
 
 export type PassiveId =
   | 'rubber-chicken'
@@ -288,15 +289,33 @@ export const WEAPONS: Readonly<Record<WeaponId, WeaponInfo>> = {
       pierce: 4,
     }),
   },
+  'bottomless-saucer': {
+    name: 'Bottomless Saucer',
+    description: 'Warm milk, circling him without end. No cat has ever refused it.',
+    kind: 'orbit',
+    levels: fixed({
+      cooldownMs: 0,
+      damage: 160,
+      area: 130,
+      count: 8,
+      speed: 4.6,
+      durationMs: 0,
+      pierce: 99,
+    }),
+  },
 };
 
-/** A weapon at its highest level and its passive, held together, become another. */
-export type Evolution = { from: WeaponId; with: PassiveId; to: WeaponId };
+/**
+ * A weapon at its highest level and its passive, held together, become another. A
+ * secret one is named nowhere in the game until it has been found (the codex).
+ */
+export type Evolution = { from: WeaponId; with: PassiveId; to: WeaponId; secret?: true };
 
 export const EVOLUTIONS: readonly Evolution[] = [
   { from: 'laser-pointer', with: 'battery', to: 'infinite-laser' },
   { from: 'vacuum-cleaner', with: 'catnip', to: 'forbidden-catnip-vacuum' },
   { from: 'yarn-ball', with: 'scissors', to: 'yarn-apocalypse' },
+  { from: 'can-opener', with: 'warm-milk', to: 'bottomless-saucer', secret: true },
 ];
 
 /** The weapons a level-up may offer: all but the evolved ones. */
diff --git a/app/ui/xenocats/progression-view.tsx b/app/ui/xenocats/progression-view.tsx
new file mode 100644
index 0000000..1e197f7
--- /dev/null
+++ b/app/ui/xenocats/progression-view.tsx
@@ -0,0 +1,169 @@
+'use client';
+
+// Survival's start screen, below Start: the tufts he has, the character he goes
+// out as, the Tailor's wares, and the codex. Everything here reads and writes the
+// stored progress (progression.ts); the run itself reads it when it starts.
+
+import { useSyncExternalStore } from 'react';
+import { Button } from '@/app/ui/button';
+import {
+  CHARACTERS,
+  type CharacterId,
+  MILESTONES,
+  UPGRADES,
+  type UpgradeId,
+  buyCharacter,
+  buyUpgrade,
+  chooseCharacter,
+  codexEntries,
+  hasCharacter,
+  readProgress,
+  serverProgress,
+  subscribeProgress,
+  upgradeCost,
+  writeProgress,
+} from './progression';
+
+export function useProgress() {
+  return useSyncExternalStore(subscribeProgress, readProgress, serverProgress);
+}
+
+export function ProgressionPanel() {
+  const progress = useProgress();
+
+  return (
+    <div className="mt-6 grid max-w-4xl gap-6 md:grid-cols-2">
+      <section
+        aria-labelledby="characters-heading"
+        className="rounded-2xl border border-line bg-panel p-5"
+      >
+        <h2 id="characters-heading" className="font-display text-xl font-semibold text-cream">
+          Who goes out tonight
+        </h2>
+        <p
+          data-testid="survival-tufts"
+          data-tufts={progress.tufts}
+          className="mt-1 text-sm text-plasma"
+        >
+          Tufts of fur: {progress.tufts}
+        </p>
+        <fieldset className="mt-3">
+          <legend className="sr-only">Character</legend>
+          <ul className="space-y-2">
+            {(Object.keys(CHARACTERS) as CharacterId[]).map((id) => {
+              const character = CHARACTERS[id];
+              const had = hasCharacter(progress, id);
+              const unlock = character.unlock;
+              return (
+                <li key={id} className="text-sm">
+                  <label className="flex items-start gap-2">
+                    <input
+                      type="radio"
+                      name="survival-character"
+                      value={id}
+                      data-testid={`survival-character-${id}`}
+                      checked={progress.character === id}
+                      disabled={!had}
+                      onChange={() => writeProgress(chooseCharacter(readProgress(), id))}
+                      className="mt-1 border-line bg-void text-aura focus:ring-aura"
+                    />
+                    <span>
+                      <span className="font-semibold text-cream">{character.name}</span>
+                      <span className="block text-aura">{character.description}</span>
+                      {!had && unlock.kind === 'milestone' && (
+                        <span className="block text-white">
+                          Locked: {MILESTONES[unlock.milestone].text}.
+                        </span>
+                      )}
+                    </span>
+                  </label>
+                  {unlock.kind === 'cost' && (
+                    <Button
+                      className="ml-6 mt-1"
+                      data-testid={`survival-buy-${id}`}
+                      aria-disabled={had || progress.tufts < unlock.cost}
+                      onClick={() => {
+                        const next = buyCharacter(readProgress(), id);
+                        if (next) writeProgress(next);
+                      }}
+                    >
+                      {had ? 'Engaged' : `Engage for ${unlock.cost} tufts`}
+                    </Button>
+                  )}
+                </li>
+              );
+            })}
+          </ul>
+        </fieldset>
+      </section>
+
+      <section
+        aria-labelledby="tailor-heading"
+        className="rounded-2xl border border-line bg-panel p-5"
+      >
+        <h2 id="tailor-heading" className="font-display text-xl font-semibold text-cream">
+          The Tailor
+        </h2>
+        <p className="mt-1 text-sm text-aura">He alters the coat. Permanently, and for tufts.</p>
+        <ul className="mt-3 space-y-3">
+          {(Object.keys(UPGRADES) as UpgradeId[]).map((id) => {
+            const upgrade = UPGRADES[id];
+            const level = progress.upgrades[id] ?? 0;
+            const cost = upgradeCost(id, level);
+            return (
+              <li
+                key={id}
+                data-testid={`survival-upgrade-${id}`}
+                data-level={level}
+                className="flex flex-wrap items-center justify-between gap-2 text-sm"
+              >
+                <span>
+                  <span className="font-semibold text-cream">
+                    {upgrade.name} {level}/{upgrade.maxLevel}
+                  </span>
+                  <span className="block text-aura">{upgrade.description}</span>
+                </span>
+                <Button
+                  data-testid={`survival-buy-${id}`}
+                  aria-disabled={cost === null || progress.tufts < cost}
+                  aria-label={
+                    cost === null
+                      ? `${upgrade.name}: complete`
+                      : `Buy ${upgrade.name} level ${level + 1} for ${cost} tufts`
+                  }
+                  onClick={() => {
+                    const next = buyUpgrade(readProgress(), id);
+                    if (next) writeProgress(next);
+                  }}
+                >
+                  {cost === null ? 'Complete' : `${cost} tufts`}
+                </Button>
+              </li>
+            );
+          })}
+        </ul>
+      </section>
+
+      <section
+        aria-labelledby="codex-heading"
+        className="rounded-2xl border border-line bg-panel p-5 md:col-span-2"
+      >
+        <h2 id="codex-heading" className="font-display text-xl font-semibold text-cream">
+          Codex
+        </h2>
+        <p className="mt-1 text-sm text-aura">What the nights have shown him.</p>
+        <ul data-testid="survival-codex" className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
+          {codexEntries(progress).map((entry) => (
+            <li
+              key={entry.id}
+              data-found={entry.found}
+              className={entry.found ? 'text-cream' : 'text-white/60'}
+            >
+              {entry.name}
+            </li>
+          ))}
+        </ul>
+      </section>
+    </div>
+  );
+}
diff --git a/app/ui/xenocats/progression.ts b/app/ui/xenocats/progression.ts
new file mode 100644
index 0000000..64b756a
--- /dev/null
+++ b/app/ui/xenocats/progression.ts
@@ -0,0 +1,345 @@
+// What Survival keeps from run to run: the tufts each run gathers, what the Tailor
+// has sold him, the milestones reached (which unlock weapons and characters), the
+// character chosen, and what the codex has found. Pure rules, plus the storage they
+// live in (localStorage, one versioned key; anything unreadable is a fresh start).
+
+import type { ArenaConfig } from './arena';
+import { BASE_WEAPONS, EVOLUTIONS, WEAPONS, type WeaponId } from './arsenal';
+import { VARIETIES } from './varieties';
+
+export const PROGRESS_KEY = 'xenocats:survival:v1:progress';
+export const PROGRESS_VERSION = 1;
+
+/** What one run did, as the progression sees it. */
+export type RunResult = {
+  timeMs: number;
+  sentHome: number;
+  level: number;
+  /** Codex entries met in the run: evolved weapons' ids, the secret cat's. */
+  found: readonly string[];
+};
+
+// ------------------------------------------------------------------ the tufts
+
+/** Tufts a run gathers: one for every 5 s survived, one for every 20 cats sent home. */
+export function tuftsFor(run: Pick<RunResult, 'timeMs' | 'sentHome'>): number {
+  return Math.floor(Math.max(run.timeMs, 0) / 5000) + Math.floor(Math.max(run.sentHome, 0) / 20);
+}
+
+// ----------------------------------------------------------------- milestones
+
+export type MilestoneId = 'survive-2' | 'survive-3' | 'send-1000' | 'level-20';
+
+export const MILESTONES: Readonly<
+  Record<MilestoneId, { text: string; reached: (run: RunResult) => boolean }>
+> = {
+  'survive-2': { text: 'Survive 2:00', reached: (run) => run.timeMs >= 120_000 },
+  'survive-3': { text: 'Survive 3:00', reached: (run) => run.timeMs >= 180_000 },
+  'send-1000': { text: 'Send 1000 cats home in one run', reached: (run) => run.sentHome >= 1000 },
+  'level-20': { text: 'Reach level 20', reached: (run) => run.level >= 20 },
+};
+
+/** Weapons kept from him until a milestone; any other base weapon is his from the start. */
+export const WEAPON_UNLOCKS: Readonly<Partial<Record<WeaponId, MilestoneId>>> = {
+  'thunderous-vacuum': 'survive-3',
+  'laser-pointer-deluxe': 'send-1000',
+  hairball: 'level-20',
+};
+
+// ------------------------------------------------------------------ the Tailor
+
+export type UpgradeId = 'stubbornness' | 'sternness' | 'brisk-step' | 'long-arms' | 'second-wind';
+
+export const UPGRADES: Readonly<
+  Record<UpgradeId, { name: string; description: string; maxLevel: number; baseCost: number }>
+> = {
+  stubbornness: {
+    name: 'Stubbornness',
+    description: 'He begins every run with 10 more Resolve.',
+    maxLevel: 5,
+    baseCost: 10,
+  },
+  sternness: {
+    name: 'Sternness',
+    description: 'Everything he does makes a cat 5% more homesick.',
+    maxLevel: 5,
+    baseCost: 15,
+  },
+  'brisk-step': {
+    name: 'Brisk Step',
+    description: 'He walks 4% faster.',
+    maxLevel: 5,
+    baseCost: 12,
+  },
+  'long-arms': {
+    name: 'Long Arms',
+    description: 'He gathers experience from 10% further off.',
+    maxLevel: 3,
+    baseCost: 10,
+  },
+  'second-wind': {
+    name: 'Second Wind',
+    description: 'Once a run, when his Resolve is spent, half of it returns.',
+    maxLevel: 1,
+    baseCost: 80,
+  },
+};
+
+/** The next level of an upgrade costs more each time; null once it is at its highest. */
+export function upgradeCost(id: UpgradeId, level: number): number | null {
+  const upgrade = UPGRADES[id];
+  if (level >= upgrade.maxLevel) return null;
+  return Math.round(upgrade.baseCost * 1.7 ** level);
+}
+
+// ------------------------------------------------------------------ characters
+
+export type CharacterId = 'keeper' | 'night-porter' | 'housekeeper';
+
+export type Character = {
+  name: string;
+  description: string;
+  weapon: WeaponId;
+  /** Added to his Resolve. */
+  resolve: number;
+  /** Times his pace. */
+  speed: number;
+  /** How he is had: from the start, a milestone, or bought. */
+  unlock:
+    | { kind: 'free' }
+    | { kind: 'milestone'; milestone: MilestoneId }
+    | { kind: 'cost'; cost: number };
+};
+
+export const CHARACTERS: Readonly<Record<CharacterId, Character>> = {
+  keeper: {
+    name: 'The Keeper',
+    description: 'A long coat and a Laser Pointer. He only wishes them home.',
+    weapon: 'laser-pointer',
+    resolve: 0,
+    speed: 1,
+    unlock: { kind: 'free' },
+  },
+  'night-porter': {
+    name: 'The Night Porter',
+    description: 'Quick on the stairs, a Spray Bottle in hand; less Resolve than he admits.',
+    weapon: 'spray-bottle',
+    resolve: -15,
+    speed: 1.12,
+    unlock: { kind: 'milestone', milestone: 'survive-2' },
+  },
+  housekeeper: {
+    name: 'The Housekeeper',
+    description: 'Unhurried, unmoved, and never without the Vacuum Cleaner.',
+    weapon: 'vacuum-cleaner',
+    resolve: 30,
+    speed: 0.92,
+    unlock: { kind: 'cost', cost: 150 },
+  },
+};
+
+// ------------------------------------------------------------------- the codex
+
+/** The secret cat: comes only to a Keeper who stands still (decisions.md, D60). */
+export const SECRET_CAT = 'neighbour';
+
+/** The codex's entries, in order: every evolution (one of them hidden) and the secret cat. */
+export const CODEX: readonly { id: string; name: string }[] = [
+  ...EVOLUTIONS.map((e) => ({ id: e.to, name: WEAPONS[e.to].name })),
+  { id: SECRET_CAT, name: VARIETIES[SECRET_CAT].name },
+];
+
+// ------------------------------------------------------------------- progress
+
+export type Progress = {
+  tufts: number;
+  upgrades: Readonly<Partial<Record<UpgradeId, number>>>;
+  milestones: readonly MilestoneId[];
+  /** Characters bought (those had by milestone or from the start are not listed). */
+  bought: readonly CharacterId[];
+  character: CharacterId;
+  /** Codex entries found. */
+  found: readonly string[];
+};
+
+export function freshProgress(): Progress {
+  return { tufts: 0, upgrades: {}, milestones: [], bought: [], character: 'keeper', found: [] };
+}
+
+const isIn = <K extends string>(record: Readonly<Record<K, unknown>>, key: unknown): key is K =>
+  typeof key === 'string' && Object.prototype.hasOwnProperty.call(record, key);
+
+const CODEX_IDS = new Set(CODEX.map((entry) => entry.id));
+
+/**
+ * Stored progress, or a fresh start for anything missing, corrupt, of another
+ * version, or not sane. Never throws. Unknown entries are dropped one by one.
+ */
+export function parseProgress(raw: string | null): Progress {
+  const fresh = freshProgress();
+  if (raw === null) return fresh;
+  let data: unknown;
+  try {
+    data = JSON.parse(raw);
+  } catch {
+    return fresh;
+  }
+  if (typeof data !== 'object' || data === null) return fresh;
+  const d = data as Record<string, unknown>;
+  // Only this version is read: an older or newer one starts afresh, cleanly.
+  if (d.version !== PROGRESS_VERSION) return fresh;
+  const list = (value: unknown) => (Array.isArray(value) ? value : []);
+  const upgrades: Partial<Record<UpgradeId, number>> = {};
+  if (typeof d.upgrades === 'object' && d.upgrades !== null) {
+    for (const [id, level] of Object.entries(d.upgrades)) {
+      if (isIn(UPGRADES, id) && Number.isInteger(level) && (level as number) > 0) {
+        upgrades[id] = Math.min(level as number, UPGRADES[id].maxLevel);
+      }
+    }
+  }
+  const tufts = Number(d.tufts);
+  const progress: Progress = {
+    tufts: Number.isInteger(tufts) && tufts >= 0 && tufts < 1e9 ? tufts : 0,
+    upgrades,
+    milestones: [...new Set(list(d.milestones).filter((m) => isIn(MILESTONES, m)))],
+    bought: [...new Set(list(d.bought).filter((c) => isIn(CHARACTERS, c)))],
+    character: isIn(CHARACTERS, d.character) ? d.character : 'keeper',
+    found: [...new Set(list(d.found).filter((f) => typeof f === 'string' && CODEX_IDS.has(f)))],
+  };
+  // A character he no longer has (say, a hand-edited store) is not his to choose.
+  if (!hasCharacter(progress, progress.character)) progress.character = 'keeper';
+  return progress;
+}
+
+export function serializeProgress(progress: Progress): string {
+  return JSON.stringify({ version: PROGRESS_VERSION, ...progress });
+}
+
+/** The progress after a run: its tufts, milestones newly reached, entries found. */
+export function applyRun(
+  progress: Progress,
+  run: RunResult
+): { progress: Progress; earned: number; reached: MilestoneId[] } {
+  const earned = tuftsFor(run);
+  const reached = (Object.keys(MILESTONES) as MilestoneId[]).filter(
+    (id) => !progress.milestones.includes(id) && MILESTONES[id].reached(run)
+  );
+  return {
+    earned,
+    reached,
+    progress: {
+      ...progress,
+      tufts: progress.tufts + earned,
+      milestones: [...progress.milestones, ...reached],
+      found: [...new Set([...progress.found, ...run.found.filter((f) => CODEX_IDS.has(f))])],
+    },
+  };
+}
+
+/** Buys the next level of an upgrade; null if it is at its highest or he cannot pay. */
+export function buyUpgrade(progress: Progress, id: UpgradeId): Progress | null {
+  const level = progress.upgrades[id] ?? 0;
+  const cost = upgradeCost(id, level);
+  if (cost === null || cost > progress.tufts) return null;
+  return {
+    ...progress,
+    tufts: progress.tufts - cost,
+    upgrades: { ...progress.upgrades, [id]: level + 1 },
+  };
+}
+
+export function hasCharacter(progress: Progress, id: CharacterId): boolean {
+  const unlock = CHARACTERS[id].unlock;
+  if (unlock.kind === 'free') return true;
+  if (unlock.kind === 'milestone') return progress.milestones.includes(unlock.milestone);
+  return progress.bought.includes(id);
+}
+
+/** Buys a character sold for tufts; null if not for sale, had already, or he cannot pay. */
+export function buyCharacter(progress: Progress, id: CharacterId): Progress | null {
+  const unlock = CHARACTERS[id].unlock;
+  if (unlock.kind !== 'cost' || hasCharacter(progress, id) || unlock.cost > progress.tufts) {
+    return null;
+  }
+  return { ...progress, tufts: progress.tufts - unlock.cost, bought: [...progress.bought, id] };
+}
+
+/** Chooses a character he has; anyone else leaves the choice as it was. */
+export function chooseCharacter(progress: Progress, id: CharacterId): Progress {
+  return hasCharacter(progress, id) ? { ...progress, character: id } : progress;
+}
+
+/** The base weapons a level-up may offer him: those no milestone still keeps from him. */
+export function availableWeapons(progress: Progress): WeaponId[] {
+  return BASE_WEAPONS.filter((id) => {
+    const milestone = WEAPON_UNLOCKS[id];
+    return milestone === undefined || progress.milestones.includes(milestone);
+  });
+}
+
+/** The codex: each entry's name once found, "???" until then. */
+export function codexEntries(progress: Progress): { id: string; name: string; found: boolean }[] {
+  return CODEX.map((entry) => {
+    const found = progress.found.includes(entry.id);
+    return { id: entry.id, name: found ? entry.name : '???', found };
+  });
+}
+
+/** What a run starts with: his character, what the Tailor sold him, what is unlocked. */
+export function runConfig(progress: Progress, base: ArenaConfig): Partial<ArenaConfig> {
+  const character = CHARACTERS[progress.character];
+  const level = (id: UpgradeId) => progress.upgrades[id] ?? 0;
+  return {
+    startingWeapons: [character.weapon],
+    availableWeapons: availableWeapons(progress),
+    hero: {
+      ...base.hero,
+      resolve: Math.max(base.hero.resolve + character.resolve + 10 * level('stubbornness'), 1),
+      speed: base.hero.speed * character.speed * (1 + 0.04 * level('brisk-step')),
+    },
+    boost: {
+      might: 1 + 0.05 * level('sternness'),
+      pickup: 1 + 0.1 * level('long-arms'),
+      revivals: level('second-wind'),
+    },
+  };
+}
+
+// --------------------------------------------------------------------- storage
+
+let cache: { raw: string | null; progress: Progress } | null = null;
+const listeners = new Set<() => void>();
+
+/** The stored progress (the same object while the store is unchanged). */
+export function readProgress(): Progress {
+  let raw: string | null = null;
+  try {
+    raw = window.localStorage.getItem(PROGRESS_KEY);
+  } catch {
+    // Storage blocked: a fresh start, every time.
+  }
+  if (!cache || cache.raw !== raw) cache = { raw, progress: parseProgress(raw) };
+  return cache.progress;
+}
+
+export function writeProgress(progress: Progress) {
+  try {
+    window.localStorage.setItem(PROGRESS_KEY, serializeProgress(progress));
+  } catch {
+    // Storage blocked or full: the progress just isn't kept.
+  }
+  for (const listener of listeners) listener();
+}
+
+/** For useSyncExternalStore: this tab's writes and other tabs'. */
+export function subscribeProgress(onChange: () => void) {
+  listeners.add(onChange);
+  window.addEventListener('storage', onChange);
+  return () => {
+    listeners.delete(onChange);
+    window.removeEventListener('storage', onChange);
+  };
+}
+
+const SERVER_PROGRESS = freshProgress();
+export const serverProgress = () => SERVER_PROGRESS;
diff --git a/app/ui/xenocats/varieties.ts b/app/ui/xenocats/varieties.ts
index 0578ea4..3f0a1c3 100644
--- a/app/ui/xenocats/varieties.ts
+++ b/app/ui/xenocats/varieties.ts
@@ -6,7 +6,17 @@
 import type { WeaponKind } from './arsenal';
 
 export type VarietyId =
-  'basic' | 'zoomies' | 'hissing' | 'fat' | 'kitten' | 'box' | 'laser' | 'possessed' | 'mega';
+  | 'basic'
+  | 'zoomies'
+  | 'hissing'
+  | 'fat'
+  | 'kitten'
+  | 'box'
+  | 'laser'
+  | 'possessed'
+  | 'mega'
+  // Never in the schedule: it comes only when it chooses to (arena.ts, secretCat).
+  | 'neighbour';
 
 /** How a variety moves (arena.ts reads it). */
 export type Gait =
@@ -121,6 +131,15 @@ export const VARIETIES: Readonly<Record<VarietyId, Variety>> = {
     drain: 25,
     radius: 90,
   },
+  neighbour: {
+    name: 'The Neighbour’s Cat',
+    description: 'It sits beside him, as if it had always lived here. It has not.',
+    gait: 'sit',
+    speed: 0,
+    homesickness: 900,
+    drain: 0,
+    radius: 18,
+  },
 };
 
 export type Schedule = {
diff --git a/tests/e2e/survival.spec.ts b/tests/e2e/survival.spec.ts
index 3dfbdad..0838488 100644
--- a/tests/e2e/survival.spec.ts
+++ b/tests/e2e/survival.spec.ts
@@ -206,6 +206,61 @@ test.describe('on a computer', () => {
     await expect(area(page)).toHaveAttribute('data-screen', 'paused');
     await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
   });
+
+  test('a run gathers tufts of fur, kept after a reload', async ({ page }) => {
+    test.setTimeout(60_000);
+    await openArena(page, '?seed=7&speed=10');
+    await expect(page.getByTestId('survival-tufts')).toHaveAttribute('data-tufts', '0');
+    await startRun(page);
+    // Half a minute of the run: at least six tufts for the time alone.
+    await expect.poll(() => num(page, 'data-time'), { timeout: 20_000 }).toBeGreaterThan(30_000);
+    await (await pauseRun(page)).getByRole('button', { name: 'Give up' }).click();
+    const earned = Number(await page.getByTestId('survival-result-tufts').textContent());
+    expect(earned).toBeGreaterThanOrEqual(6);
+    await expect(page.getByTestId('survival-tufts')).toHaveAttribute('data-tufts', String(earned));
+    await page.reload();
+    await expect(page.getByTestId('survival-tufts')).toHaveAttribute('data-tufts', String(earned));
+    await expect(page.getByTestId('survival-tufts')).toHaveText(`Tufts of fur: ${earned}`);
+  });
+
+  test('the Tailor sells an upgrade for tufts; the next run begins with it', async ({ page }) => {
+    await openArena(page);
+    // Tufts from earlier nights.
+    await page.evaluate(() =>
+      localStorage.setItem(
+        'xenocats:survival:v1:progress',
+        JSON.stringify({ version: 1, tufts: 25, upgrades: {}, milestones: [], bought: [] })
+      )
+    );
+    await page.reload();
+    const tufts = page.getByTestId('survival-tufts');
+    await expect(tufts).toHaveAttribute('data-tufts', '25');
+    const stubbornness = page.getByTestId('survival-upgrade-stubbornness');
+    // A click before hydration is lost: buy until it is bought.
+    await expect
+      .poll(async () => {
+        if ((await stubbornness.getAttribute('data-level')) === '0') {
+          await page.getByRole('button', { name: 'Buy Stubbornness level 1 for 10 tufts' }).click();
+        }
+        return stubbornness.getAttribute('data-level');
+      })
+      .toBe('1');
+    await expect(tufts).toHaveAttribute('data-tufts', '15');
+    // The next level costs more, more than he has left; Second Wind (80) too.
+    await expect(
+      page.getByRole('button', { name: 'Buy Stubbornness level 2 for 17 tufts' })
+    ).toBeDisabled();
+    await expect(page.getByTestId('survival-buy-second-wind')).toBeDisabled();
+    await page.reload();
+    await expect(stubbornness).toHaveAttribute('data-level', '1');
+    await expect(tufts).toHaveAttribute('data-tufts', '15');
+    // He goes out with 10 more Resolve.
+    await startRun(page);
+    await expect(page.getByRole('meter', { name: 'Resolve' })).toHaveAttribute(
+      'aria-valuemax',
+      '110'
+    );
+  });
 });
 
 test.describe('on a touch screen', () => {
diff --git a/tests/unit/xenocats/progression.test.ts b/tests/unit/xenocats/progression.test.ts
new file mode 100644
index 0000000..b560d78
--- /dev/null
+++ b/tests/unit/xenocats/progression.test.ts
@@ -0,0 +1,424 @@
+import { afterEach, describe, expect, it, vi } from 'vitest';
+import { ARENA_CONFIG, type ArenaConfig, createArena } from '@/app/ui/xenocats/arena';
+import { EVOLUTIONS, MAX_WEAPON_LEVEL, WEAPONS, type WeaponId } from '@/app/ui/xenocats/arsenal';
+import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
+import {
+  CHARACTERS,
+  PROGRESS_KEY,
+  type Progress,
+  type RunResult,
+  SECRET_CAT,
+  UPGRADES,
+  applyRun,
+  availableWeapons,
+  buyCharacter,
+  buyUpgrade,
+  chooseCharacter,
+  codexEntries,
+  freshProgress,
+  hasCharacter,
+  parseProgress,
+  readProgress,
+  runConfig,
+  serializeProgress,
+  tuftsFor,
+  upgradeCost,
+  writeProgress,
+} from '@/app/ui/xenocats/progression';
+import { createRandom } from '@/app/ui/xenocats/random';
+
+const run = (over: Partial<RunResult> = {}): RunResult => ({
+  timeMs: 0,
+  sentHome: 0,
+  level: 1,
+  found: [],
+  ...over,
+});
+const rich = (tufts: number): Progress => ({ ...freshProgress(), tufts });
+
+describe('tufts', () => {
+  it('one for every 5 s survived, one for every 20 cats sent home', () => {
+    expect(tuftsFor({ timeMs: 0, sentHome: 0 })).toBe(0);
+    expect(tuftsFor({ timeMs: 4999, sentHome: 19 })).toBe(0);
+    expect(tuftsFor({ timeMs: 60_000, sentHome: 400 })).toBe(12 + 20);
+  });
+
+  it('a run adds its tufts to what he had', () => {
+    const after = applyRun(rich(7), run({ timeMs: 30_000, sentHome: 40 }));
+    expect(after.earned).toBe(8);
+    expect(after.progress.tufts).toBe(15);
+  });
+});
+
+describe('milestones', () => {
+  it('are reached by a run that does what they ask, once', () => {
+    const first = applyRun(freshProgress(), run({ timeMs: 200_000, sentHome: 1200, level: 21 }));
+    expect(first.reached.sort()).toEqual(['level-20', 'send-1000', 'survive-2', 'survive-3']);
+    const again = applyRun(first.progress, run({ timeMs: 200_000, sentHome: 1200, level: 21 }));
+    expect(again.reached).toEqual([]);
+    expect(again.progress.milestones).toHaveLength(4);
+  });
+
+  it('are not reached a moment short', () => {
+    const short = applyRun(freshProgress(), run({ timeMs: 119_999, sentHome: 999, level: 19 }));
+    expect(short.reached).toEqual([]);
+  });
+
+  it('keep weapons back until reached, and a level-up never offers those', () => {
+    const fresh = availableWeapons(freshProgress());
+    expect(fresh).not.toContain('thunderous-vacuum');
+    expect(fresh).not.toContain('laser-pointer-deluxe');
+    expect(fresh).not.toContain('hairball');
+    expect(fresh).toContain('laser-pointer');
+    const later = availableWeapons({ ...freshProgress(), milestones: ['survive-3', 'level-20'] });
+    expect(later).toContain('thunderous-vacuum');
+    expect(later).toContain('hairball');
+    expect(later).not.toContain('laser-pointer-deluxe');
+
+    // In a run: never offered, whatever comes.
+    const a = createArena({
+      random: createRandom(3),
+      types: CAT_TYPES,
+      viewport: { width: 1280, height: 800 },
+      config: {
+        ...runConfig(freshProgress(), ARENA_CONFIG),
+        hero: { ...ARENA_CONFIG.hero, resolve: 1e12 },
+        stepMs: 50,
+      },
+    });
+    const locked: WeaponId[] = ['thunderous-vacuum', 'laser-pointer-deluxe', 'hairball'];
+    let offers = 0;
+    while (a.state().time < 120_000) {
+      const offer = a.choices();
+      if (offer) {
+        offers++;
+        for (const c of offer) expect(c.kind === 'weapon' && locked.includes(c.id)).toBe(false);
+        a.choose(0);
+      } else a.step({ x: 1, y: 0 });
+    }
+    expect(offers).toBeGreaterThan(3);
+  }, 30_000);
+});
+
+describe('the Tailor', () => {
+  it('each level costs more than the last, and none past the highest', () => {
+    for (const id of Object.keys(UPGRADES) as (keyof typeof UPGRADES)[]) {
+      const max = UPGRADES[id].maxLevel;
+      for (let level = 1; level < max; level++) {
+        expect(upgradeCost(id, level)!).toBeGreaterThan(upgradeCost(id, level - 1)!);
+      }
+      expect(upgradeCost(id, max)).toBeNull();
+    }
+  });
+
+  it('sells the next level for its cost, and nothing he cannot pay for', () => {
+    const bought = buyUpgrade(rich(40), 'stubbornness')!;
+    expect(bought.upgrades.stubbornness).toBe(1);
+    expect(bought.tufts).toBe(30);
+    const second = buyUpgrade(bought, 'stubbornness')!;
+    expect(second.upgrades.stubbornness).toBe(2);
+    expect(second.tufts).toBe(30 - upgradeCost('stubbornness', 1)!);
+    expect(buyUpgrade(rich(24), 'stubbornness')!.tufts).toBe(14);
+    expect(buyUpgrade(rich(9), 'stubbornness')).toBeNull();
+    const full = { ...rich(1e6), upgrades: { 'second-wind': 1 } };
+    expect(buyUpgrade(full, 'second-wind')).toBeNull();
+  });
+
+  it('what he bought goes out with him', () => {
+    const progress: Progress = {
+      ...freshProgress(),
+      upgrades: {
+        stubbornness: 2,
+        sternness: 3,
+        'brisk-step': 5,
+        'long-arms': 1,
+        'second-wind': 1,
+      },
+    };
+    const config = runConfig(progress, ARENA_CONFIG);
+    expect(config.hero!.resolve).toBe(ARENA_CONFIG.hero.resolve + 20);
+    expect(config.hero!.speed).toBeCloseTo(ARENA_CONFIG.hero.speed * 1.2);
+    expect(config.boost).toEqual({ might: 1.15, pickup: 1.1, revivals: 1 });
+  });
+});
+
+describe('characters', () => {
+  it('the Keeper from the start; the Night Porter after surviving 2:00; the Housekeeper for tufts', () => {
+    const fresh = freshProgress();
+    expect(hasCharacter(fresh, 'keeper')).toBe(true);
+    expect(hasCharacter(fresh, 'night-porter')).toBe(false);
+    expect(hasCharacter(fresh, 'housekeeper')).toBe(false);
+    const survived = applyRun(fresh, run({ timeMs: 125_000 })).progress;
+    expect(hasCharacter(survived, 'night-porter')).toBe(true);
+    expect(buyCharacter(rich(149), 'housekeeper')).toBeNull();
+    const hired = buyCharacter(rich(200), 'housekeeper')!;
+    expect(hasCharacter(hired, 'housekeeper')).toBe(true);
+    expect(hired.tufts).toBe(50);
+    expect(buyCharacter(hired, 'housekeeper')).toBeNull();
+    expect(buyCharacter(rich(1000), 'night-porter')).toBeNull();
+  });
+
+  it('only one he has can be chosen, and he starts with that one’s weapon and bias', () => {
+    expect(chooseCharacter(freshProgress(), 'night-porter').character).toBe('keeper');
+    const porter = chooseCharacter(
+      { ...freshProgress(), milestones: ['survive-2'] },
+      'night-porter'
+    );
+    expect(porter.character).toBe('night-porter');
+    const config = runConfig(porter, ARENA_CONFIG);
+    expect(config.startingWeapons).toEqual([CHARACTERS['night-porter'].weapon]);
+    expect(config.hero!.speed).toBeCloseTo(ARENA_CONFIG.hero.speed * 1.12);
+    expect(config.hero!.resolve).toBe(ARENA_CONFIG.hero.resolve - 15);
+    // Each character, a different starting weapon.
+    const weapons = Object.values(CHARACTERS).map((c) => c.weapon);
+    expect(new Set(weapons).size).toBe(weapons.length);
+  });
+});
+
+describe('the codex and the secrets', () => {
+  it('shows ??? until an entry is found, then its name', () => {
+    const fresh = codexEntries(freshProgress());
+    expect(fresh.every((e) => e.name === '???' && !e.found)).toBe(true);
+    const found = applyRun(freshProgress(), run({ found: ['bottomless-saucer', 'nonsense'] }));
+    const entries = codexEntries(found.progress);
+    expect(entries.find((e) => e.id === 'bottomless-saucer')).toEqual({
+      id: 'bottomless-saucer',
+      name: 'Bottomless Saucer',
+      found: true,
+    });
+    expect(found.progress.found).toEqual(['bottomless-saucer']);
+  });
+
+  it('the hidden evolution is a secret: Can Opener + Warm Milk, with a chest', () => {
+    const secret = EVOLUTIONS.filter((e) => e.secret);
+    expect(secret).toEqual([
+      { from: 'can-opener', with: 'warm-milk', to: 'bottomless-saucer', secret: true },
+    ]);
+    // Like the others, by a chest: every cat an elite, he walks to the first chest.
+    const a = createArena({
+      random: createRandom(2),
+      types: CAT_TYPES,
+      viewport: { width: 1280, height: 800 },
+      config: {
+        startingWeapons: ['can-opener'],
+        startingLevel: MAX_WEAPON_LEVEL,
+        startingPassives: ['warm-milk'],
+        hero: { ...ARENA_CONFIG.hero, resolve: 1e12 },
+        gems: { ...ARENA_CONFIG.gems, value: 0, eliteValue: 0 },
+        cats: { ...ARENA_CONFIG.cats, eliteShare: 1 },
+        schedule: {
+          arrivals: [{ from: 0, who: 'xenocat', weight: 1 }],
+          swarms: { from: Infinity, everyMs: 1, size: [0, 0] },
+          bosses: [],
+        },
+      },
+    });
+    let evolved = false;
+    while (!evolved && a.state().time < 120_000) {
+      const { x, y } = a.state().hero;
+      const chest = a.chests()[0];
+      const d = chest ? Math.hypot(chest.x - x, chest.y - y) || 1 : 1;
+      a.step(chest ? { x: (chest.x - x) / d, y: (chest.y - y) / d } : { x: 0, y: 0 });
+      evolved = a.drainEvents().some((e) => e.kind === 'evolution' && e.to === 'bottomless-saucer');
+    }
+    expect(evolved).toBe(true);
+    expect(a.state().weapons.map((w) => w.id)).toEqual(['bottomless-saucer']);
+    // Its blades, more of them than the Can Opener ever had.
+    expect(a.blades().length).toBe(WEAPONS['bottomless-saucer'].levels[0].count);
+  });
+
+  /** A run where nothing wears him down and nothing interrupts. */
+  function quiet(config: Partial<ArenaConfig> = {}) {
+    return createArena({
+      random: createRandom(5),
+      types: CAT_TYPES,
+      viewport: { width: 1280, height: 800 },
+      config: {
+        hero: { ...ARENA_CONFIG.hero, resolve: 1e12 },
+        gems: { ...ARENA_CONFIG.gems, value: 0, eliteValue: 0 },
+        chestReach: -1,
+        stepMs: 50,
+        ...config,
+      },
+    });
+  }
+
+  it('the secret cat comes to a Keeper who stands still 20 s, after the first minute, once', () => {
+    const a = quiet();
+    let came: number[] = [];
+    let present = 0;
+    while (a.state().time < 120_000) {
+      a.step({ x: 0, y: 0 });
+      if (a.drainEvents().some((e) => e.kind === 'secret')) {
+        came.push(a.state().time);
+        present = a.cats().filter((c) => c.variety === SECRET_CAT).length;
+      }
+    }
+    // (A step is a sixtieth of a second: the first step at or past each mark.)
+    expect(came).toHaveLength(1);
+    expect(came[0]).toBeGreaterThanOrEqual(60_000);
+    expect(came[0]).toBeLessThan(60_000 + a.config.stepMs);
+    // It is in the field, sitting on the screen, and takes nothing from him.
+    expect(present).toBe(1);
+    const neighbour = a.cats().find((c) => c.variety === SECRET_CAT);
+    if (neighbour) expect(neighbour.drain).toBe(0);
+
+    // Walking, he never meets it.
+    const b = quiet();
+    came = [];
+    while (b.state().time < 120_000) {
+      const t = b.state().time / 3000;
+      b.step({ x: Math.cos(t), y: Math.sin(t) });
+      if (b.drainEvents().some((e) => e.kind === 'secret')) came.push(b.state().time);
+    }
+    expect(came).toEqual([]);
+  });
+
+  it('walking onto it costs him nothing: it does not touch him', () => {
+    // Only the secret cat: no other cat comes.
+    const a = quiet({ escalation: [[0, 0]], hero: { ...ARENA_CONFIG.hero, resolve: 100 } });
+    while (!a.drainEvents().some((e) => e.kind === 'secret')) a.step({ x: 0, y: 0 });
+    const neighbour = a.cats().find((c) => c.variety === SECRET_CAT)!;
+    const hits: string[] = [];
+    for (let i = 0; i < 200; i++) {
+      const { x, y } = a.state().hero;
+      const d = Math.hypot(neighbour.x - x, neighbour.y - y) || 1;
+      a.step(d > 2 ? { x: (neighbour.x - x) / d, y: (neighbour.y - y) / d } : { x: 0, y: 0 });
+      for (const e of a.drainEvents()) if (e.kind === 'hero-hit') hits.push(String(e.variety));
+    }
+    expect(Math.hypot(neighbour.x - a.state().hero.x, neighbour.y - a.state().hero.y)).toBeLessThan(
+      a.config.hero.reach
+    );
+    expect(hits).toEqual([]);
+    expect(a.state().hero.resolve).toBe(100);
+  });
+
+  it('it needs the full 20 s: still 19 s, then a step, then still again', () => {
+    const a = quiet();
+    const secrets: number[] = [];
+    const step = (input: { x: number; y: number }) => {
+      a.step(input);
+      if (a.drainEvents().some((e) => e.kind === 'secret')) secrets.push(a.state().time);
+    };
+    while (a.state().time < 60_000) step({ x: 1, y: 0 });
+    while (a.state().time < 79_000) step({ x: 0, y: 0 });
+    step({ x: 1, y: 0 });
+    expect(secrets).toEqual([]);
+    const from = a.state().time;
+    while (a.state().time < from + 20_000) step({ x: 0, y: 0 });
+    expect(secrets).toHaveLength(1);
+    expect(secrets[0]).toBeCloseTo(from + 20_000, -1);
+  });
+});
+
+describe('Second Wind', () => {
+  it('once a run, spent Resolve comes back by half; the second time the run ends', () => {
+    const a = createArena({
+      random: createRandom(1),
+      types: CAT_TYPES,
+      viewport: { width: 1280, height: 800 },
+      config: {
+        startingWeapons: [],
+        escalation: [[0, 60]],
+        boost: { might: 1, pickup: 1, revivals: 1 },
+      },
+    });
+    const kinds: string[] = [];
+    while (a.state().status !== 'over' && a.state().time < 300_000) {
+      a.step({ x: 0, y: 0 });
+      for (const e of a.drainEvents())
+        if (e.kind === 'revived' || e.kind === 'over') kinds.push(e.kind);
+    }
+    expect(kinds).toEqual(['revived', 'over']);
+  });
+});
+
+describe('storage', () => {
+  const sample: Progress = {
+    tufts: 42,
+    upgrades: { sternness: 2, 'second-wind': 1 },
+    milestones: ['survive-2'],
+    bought: ['housekeeper'],
+    character: 'night-porter',
+    found: ['infinite-laser', SECRET_CAT],
+  };
+
+  it('round-trips', () => {
+    expect(parseProgress(serializeProgress(sample))).toEqual(sample);
+  });
+
+  it('nothing stored, or anything corrupt, reads as a fresh start', () => {
+    for (const raw of [null, '', 'not json', '42', 'null', '[]', '{"version":1,"tufts":"many"}']) {
+      const progress = parseProgress(raw);
+      expect(progress.tufts).toBe(0);
+      expect(progress.character).toBe('keeper');
+    }
+  });
+
+  it('what cannot be right is dropped, the rest kept', () => {
+    const progress = parseProgress(
+      JSON.stringify({
+        version: 1,
+        tufts: -5,
+        upgrades: { sternness: 99, 'flying-boots': 3, 'brisk-step': 'two' },
+        milestones: ['survive-2', 'survive-99'],
+        bought: ['housekeeper', 'astronaut'],
+        character: 'housekeeper',
+        found: ['yarn-apocalypse', 'unicorn'],
+      })
+    );
+    expect(progress).toEqual({
+      tufts: 0,
+      upgrades: { sternness: UPGRADES.sternness.maxLevel },
+      milestones: ['survive-2'],
+      bought: ['housekeeper'],
+      character: 'housekeeper',
+      found: ['yarn-apocalypse'],
+    });
+    // A character he does not have cannot be the one chosen.
+    expect(parseProgress(JSON.stringify({ version: 1, character: 'housekeeper' })).character).toBe(
+      'keeper'
+    );
+  });
+
+  it('an older or newer version starts afresh, cleanly', () => {
+    for (const version of [0, 2, undefined]) {
+      expect(parseProgress(JSON.stringify({ ...sample, version }))).toEqual(freshProgress());
+    }
+  });
+
+  describe('in the browser’s storage', () => {
+    afterEach(() => vi.unstubAllGlobals());
+
+    it('is kept under its versioned key, and read back', () => {
+      const store = new Map<string, string>();
+      vi.stubGlobal('window', {
+        localStorage: {
+          getItem: (k: string) => store.get(k) ?? null,
+          setItem: (k: string, v: string) => store.set(k, v),
+        },
+      });
+      expect(readProgress()).toEqual(freshProgress());
+      writeProgress(sample);
+      expect(JSON.parse(store.get(PROGRESS_KEY)!).version).toBe(1);
+      expect(readProgress()).toEqual(sample);
+      // The same object while nothing changes (useSyncExternalStore needs it).
+      expect(readProgress()).toBe(readProgress());
+    });
+
+    it('blocked storage is a fresh start, and never throws', () => {
+      vi.stubGlobal('window', {
+        localStorage: {
+          getItem: () => {
+            throw new Error('blocked');
+          },
+          setItem: () => {
+            throw new Error('blocked');
+          },
+        },
+      });
+      expect(readProgress()).toEqual(freshProgress());
+      expect(() => writeProgress(sample)).not.toThrow();
+    });
+  });
+});
diff --git a/tests/unit/xenocats/varieties.test.ts b/tests/unit/xenocats/varieties.test.ts
index 7661725..7b9486f 100644
--- a/tests/unit/xenocats/varieties.test.ts
+++ b/tests/unit/xenocats/varieties.test.ts
@@ -24,6 +24,8 @@ const watch: Partial<ArenaConfig> = {
   startingWeapons: [],
   gems: { ...ARENA_CONFIG.gems, value: 0, eliteValue: 0 },
   chestReach: -1,
+  // No secret cat (progression.test.ts): these tests are about the schedule.
+  secretCat: { afterMs: Infinity, stillMs: 0 },
 };
 
 /** Only one variety comes, steadily. */
~~~~

</details>

#### T11 — `night-2026-10-07-t11-coop`

Local co-op for two: a Keeper record per player, shared camera and tether, downed and revived, level-ups in turn (`arena.ts`, `walking.ts`, the view). Why: plan task 11 (D65–D71).

<details><summary>Code: 8 files changed, 990 insertions(+), 168 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 22912d3..cad9ea0 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -48,7 +48,7 @@ jobs:
       - name: Unit tests (cats, games, page, sound)
         if: ${{ !cancelled() }}
         run: >-
-          npx vitest run tests/unit/xenocats/arena tests/unit/xenocats/arsenal tests/unit/xenocats/varieties tests/unit/xenocats/progression
+          npx vitest run tests/unit/xenocats/arena tests/unit/xenocats/arsenal tests/unit/xenocats/varieties tests/unit/xenocats/progression tests/unit/xenocats/coop
           tests/unit/xenocats/walking
           tests/unit/xenocats/locked-pointer
           tests/unit/xenocats/taming tests/unit/xenocats/page-hits tests/unit/xenocats/sounds
diff --git a/app/ui/xenocats/arena-view.tsx b/app/ui/xenocats/arena-view.tsx
index 920c51f..0097259 100644
--- a/app/ui/xenocats/arena-view.tsx
+++ b/app/ui/xenocats/arena-view.tsx
@@ -18,15 +18,16 @@ import {
   type MilestoneId,
   WEAPON_UNLOCKS,
   applyRun,
+  hasCharacter,
   readProgress,
   runConfig,
   writeProgress,
 } from './progression';
-import { ProgressionPanel } from './progression-view';
+import { ProgressionPanel, useProgress } from './progression-view';
 import { createRandom, freshSeed } from './random';
 import { type SoundPlayer, sharedSoundPlayer, soundsFor } from './sounds';
 import { SCHEDULE, VARIETIES, type VarietyId } from './varieties';
-import { isWalkKey, walkDirection } from './walking';
+import { PLAYER_KEYS, isWalkKey, walkDirection } from './walking';
 import type { Vec } from './effects';
 
 // Survival, the arena (arena.ts), drawn on a canvas that fills the page while a run
@@ -87,6 +88,15 @@ type Hud = {
   xp: number;
   xpToNext: number;
   weapons: string;
+  /** Each Keeper's Resolve, and whether he is down (co-op: two). */
+  heroes: {
+    resolve: number;
+    maxResolve: number;
+    down: boolean;
+    backIn: number;
+    x: number;
+    y: number;
+  }[];
 };
 
 const OUTCOME_TEXT: Record<ArenaOutcome, string> = {
@@ -157,11 +167,20 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
     sentHome: number;
     earned: number;
     reached: MilestoneId[];
+    /** In co-op: each Keeper, who he went out as, what he carried, how he ended. */
+    keepers: { name: string; weapons: string; down: boolean }[];
   } | null>(null);
   // A level-up's choices, while the run waits for one.
   const [choices, setChoices] = useState<Choice[] | null>(null);
   // The level the waiting choice is for (several can wait after one gem).
   const [choiceLevel, setChoiceLevel] = useState(2);
+  // One Keeper, or two at one keyboard; player 2's character; whose choice it is.
+  const [players, setPlayers] = useState<1 | 2>(1);
+  const [secondCharacter, setSecondCharacter] = useState<CharacterId>('keeper');
+  const [chooser, setChooser] = useState(0);
+  // How many Keepers the run in progress has (the refs are for the loop).
+  const [runPlayers, setRunPlayers] = useState<1 | 2>(1);
+  const progress = useProgress();
   // An evolution's announcement, for a few seconds.
   const [notice, setNotice] = useState<string | null>(null);
   const choiceRef = useRef<HTMLDivElement>(null);
@@ -176,6 +195,7 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
   const speedRef = useRef(1);
   // Who went out, and what the run found for the codex.
   const characterRef = useRef<CharacterId>('keeper');
+  const secondRef = useRef<CharacterId | null>(null);
   const foundRef = useRef(new Set<string>());
   const playerRef = useRef<SoundPlayer | null>(null);
   const onPad = useCallback((direction: Vec) => {
@@ -201,7 +221,18 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
         found: [...foundRef.current],
       });
       writeProgress(after.progress);
-      setResult({ time, sentHome, earned: after.earned, reached: after.reached });
+      const characters = [characterRef.current, secondRef.current ?? 'keeper'];
+      setResult({
+        time,
+        sentHome,
+        earned: after.earned,
+        reached: after.reached,
+        keepers: arena.state().heroes.map((h, i) => ({
+          name: CHARACTERS[characters[i]].name,
+          weapons: h.weapons.map((w) => `${WEAPONS[w.id].name} ${w.level}`).join(', '),
+          down: h.down,
+        })),
+      });
       setOutcome(how);
       show('results');
     },
@@ -214,8 +245,15 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
     playerRef.current ??= sharedSoundPlayer();
     // The click that started the run is the gesture sound needs.
     playerRef.current.unlock();
-    const progress = readProgress();
-    characterRef.current = progress.character;
+    const stored = readProgress();
+    characterRef.current = stored.character;
+    // Co-op is keyboard only: on a touch screen, one Keeper.
+    secondRef.current =
+      !touch && players === 2
+        ? hasCharacter(stored, secondCharacter)
+          ? secondCharacter
+          : 'keeper'
+        : null;
     foundRef.current = new Set();
     arenaRef.current = createArena({
       random: createRandom(seed),
@@ -223,7 +261,7 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
       viewport: { width: window.innerWidth, height: window.innerHeight },
       config: {
         // His character, what the Tailor sold him, the weapons unlocked.
-        ...runConfig(progress, ARENA_CONFIG),
+        ...runConfig(stored, ARENA_CONFIG, secondRef.current),
         ...(boss === null
           ? {}
           : {
@@ -233,6 +271,8 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
     });
     setOutcome(null);
     setNotice(null);
+    setChooser(0);
+    setRunPlayers(secondRef.current ? 2 : 1);
     setHud(null);
     show('playing');
   };
@@ -258,6 +298,7 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
       if (next) {
         setChoices([...next]);
         setChoiceLevel(arena.choiceLevel());
+        setChooser(arena.chooser());
       } else {
         setChoices(null);
         show('playing');
@@ -319,11 +360,14 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
       const art = catArt(type.id, 'awake');
       return art ? bitmapOf(art, CAT_SIZE * 2, redraw) : () => null;
     });
-    const hero = bitmapOf(
-      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(HERO_SVGS[characterRef.current])}`,
-      HERO_SIZE * 2,
-      redraw
+    const heroSprites = [characterRef.current, secondRef.current ?? 'keeper'].map((id) =>
+      bitmapOf(
+        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(HERO_SVGS[id])}`,
+        HERO_SIZE * 2,
+        redraw
+      )
     );
+    const twoPlayers = secondRef.current !== null;
     const titan = CAT_TYPES.findIndex((type) => type.id === 'titan-forest-cat');
     const varietySprites = Object.fromEntries(
       (Object.keys(VARIETIES) as VarietyId[]).map((id) => [
@@ -365,11 +409,15 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
     resize();
 
     const draw = (time: number) => {
-      const width = window.innerWidth;
-      const height = window.innerHeight;
       const state = arena.state();
-      const camX = state.hero.x - width / 2;
-      const camY = state.hero.y - height / 2;
+      // The shared camera: the screen shows the viewport times its zoom (1 alone).
+      const cam = arena.camera();
+      const width = window.innerWidth * cam.zoom;
+      const height = window.innerHeight * cam.zoom;
+      const camX = cam.x - width / 2;
+      const camY = cam.y - height / 2;
+      context.save();
+      context.scale(1 / cam.zoom, 1 / cam.zoom);
       context.fillStyle = '#070b14';
       context.fillRect(0, 0, width, height);
       // The floor: faint tiles that slide as he walks.
@@ -387,11 +435,10 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
       context.stroke();
 
       // The Thunderous Vacuum's reach, and the gems lying about.
-      const zone = arena.zone();
-      if (zone) {
+      for (const zone of arena.zones()) {
         context.fillStyle = `rgba(157, 134, 255, ${0.1 + 0.04 * Math.sin(time / 180)})`;
         context.beginPath();
-        context.arc(width / 2, height / 2, zone, 0, 2 * Math.PI);
+        context.arc(zone.x - camX, zone.y - camY, zone.radius, 0, 2 * Math.PI);
         context.fill();
       }
       for (const gem of arena.gems()) {
@@ -525,20 +572,33 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
         context.shadowBlur = 0;
       }
 
-      // The Keeper, flickering while untouchable, faint under a veil.
-      const keeper = hero();
-      if (keeper && !(state.hero.untouchable && Math.floor(time / 90) % 2 === 0)) {
-        context.save();
-        context.globalAlpha = state.hero.effect === 'veil' ? 0.35 : 1;
-        context.translate(width / 2, height / 2);
-        if (state.hero.facing < 0) context.scale(-1, 1);
-        if (state.hero.effect === 'freeze') {
-          context.shadowColor = '#7dd3fc';
-          context.shadowBlur = 16;
+      // The Keepers, flickering while untouchable, faint under a veil; a downed one
+      // lies on his side, pale. In co-op each is marked with his number.
+      state.heroes.forEach((h, i) => {
+        const keeper = heroSprites[i]();
+        const x = h.x - camX;
+        const y = h.y - camY;
+        if (keeper && !(h.untouchable && !h.down && Math.floor(time / 90) % 2 === 0)) {
+          context.save();
+          context.globalAlpha = h.down ? 0.35 : h.effect === 'veil' ? 0.35 : 1;
+          context.translate(x, y);
+          if (h.down) context.rotate(Math.PI / 2);
+          if (h.facing < 0) context.scale(-1, 1);
+          if (h.effect === 'freeze' && !h.down) {
+            context.shadowColor = '#7dd3fc';
+            context.shadowBlur = 16;
+          }
+          context.drawImage(keeper, -HERO_SIZE / 2, -HERO_SIZE / 2, HERO_SIZE, HERO_SIZE);
+          context.restore();
         }
-        context.drawImage(keeper, -HERO_SIZE / 2, -HERO_SIZE / 2, HERO_SIZE, HERO_SIZE);
-        context.restore();
-      }
+        if (twoPlayers) {
+          context.fillStyle = i === 0 ? '#c1e838' : '#9d86ff';
+          context.font = '600 14px sans-serif';
+          context.textAlign = 'center';
+          context.fillText(`P${i + 1}`, x, y - HERO_SIZE / 2 - 6);
+        }
+      });
+      context.restore();
     };
 
     const frame = () => {
@@ -556,11 +616,13 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
       }
       guard.record(real);
       carry += real * speedRef.current;
-      const keys = walkDirection(held);
+      // Alone, WASD and the arrow keys both walk him; in co-op, each player his own.
+      const keys = walkDirection(held, twoPlayers ? PLAYER_KEYS[0] : undefined);
       const input = keys.x !== 0 || keys.y !== 0 ? keys : padRef.current;
+      const input2 = twoPlayers ? walkDirection(held, PLAYER_KEYS[1]) : { x: 0, y: 0 };
       let steps = 0;
       while (carry >= arena.config.stepMs && steps < MAX_STEPS_PER_FRAME) {
-        arena.step(input, guard.allowsSpawning());
+        arena.step(input, guard.allowsSpawning(), input2);
         carry -= arena.config.stepMs;
         steps++;
       }
@@ -587,8 +649,19 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
         } else if (event.kind === 'secret') {
           // Nothing is said: it is simply there. The codex remembers.
           foundRef.current.add(event.id);
+        } else if (event.kind === 'downed') {
+          setNotice(
+            `Player ${event.player + 1} is down. If the other lasts ${Math.round(arena.config.coop.reviveMs / 1000)} seconds, he will stand again.`
+          );
+          if (player) player.play(soundsFor(CAT_TYPES[0]).attack);
         } else if (event.kind === 'revived') {
-          setNotice('Second Wind. He is not finished.');
+          setNotice(
+            event.by === 'ally'
+              ? `Player ${event.player + 1} stands again.`
+              : twoPlayers
+                ? `Second Wind. Player ${event.player + 1} is not finished.`
+                : 'Second Wind. He is not finished.'
+          );
           if (player) player.play(soundsFor(CAT_TYPES[0]).wake);
         } else if (event.kind === 'level-up') {
           if (player) sound(() => player.play(soundsFor(CAT_TYPES[0]).arrive));
@@ -626,6 +699,14 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
           xp: state.xp,
           xpToNext: state.xpToNext,
           weapons: state.weapons.map((w) => `${w.id}:${w.level}`).join(' '),
+          heroes: state.heroes.map((h) => ({
+            resolve: h.resolve,
+            maxResolve: h.maxResolve,
+            down: h.down,
+            backIn: h.backIn,
+            x: Math.round(h.x),
+            y: Math.round(h.y),
+          })),
         });
       }
       if (over) finish(over);
@@ -645,6 +726,7 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
         );
         setChoices([...arena.choices()!]);
         setChoiceLevel(arena.choiceLevel());
+        setChooser(arena.chooser());
         show('choosing');
       }
     };
@@ -715,6 +797,54 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
           ? 'Walk with the pad. Tap Pause to stop for a moment.'
           : 'Walk with WASD or the arrow keys. Esc pauses.'}
       </p>
+      {!touch && (
+        <fieldset className="mt-4 text-sm text-aura">
+          <legend className="font-semibold text-cream">Keepers</legend>
+          <div className="mt-1 flex flex-wrap gap-4">
+            <label className="flex items-center gap-2">
+              <input
+                type="radio"
+                name="survival-players"
+                data-testid="survival-players-1"
+                checked={players === 1}
+                onChange={() => setPlayers(1)}
+                className="border-line bg-void text-aura focus:ring-aura"
+              />
+              One
+            </label>
+            <label className="flex items-center gap-2">
+              <input
+                type="radio"
+                name="survival-players"
+                data-testid="survival-players-2"
+                checked={players === 2}
+                onChange={() => setPlayers(2)}
+                className="border-line bg-void text-aura focus:ring-aura"
+              />
+              Two, at one keyboard: player 1 walks with WASD, player 2 with the arrow keys
+            </label>
+          </div>
+          {players === 2 && (
+            <label className="mt-2 flex flex-wrap items-center gap-2">
+              Player 2 goes out as
+              <select
+                data-testid="survival-player2-character"
+                value={secondCharacter}
+                onChange={(event) => setSecondCharacter(event.target.value as CharacterId)}
+                className="rounded-lg border-line bg-void py-1 text-sm text-cream focus:ring-aura"
+              >
+                {(Object.keys(CHARACTERS) as CharacterId[])
+                  .filter((id) => hasCharacter(progress, id))
+                  .map((id) => (
+                    <option key={id} value={id}>
+                      {CHARACTERS[id].name}
+                    </option>
+                  ))}
+              </select>
+            </label>
+          )}
+        </fieldset>
+      )}
       <div className="mt-4 flex flex-wrap items-center gap-4">
         <Button data-testid="survival-start" onClick={start} disabled={running}>
           {screen === 'results' ? 'Play again' : 'Start Survival'}
@@ -748,6 +878,18 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
             <dt className="text-aura">Tufts of fur gathered</dt>
             <dd data-testid="survival-result-tufts">{result.earned}</dd>
           </dl>
+          {result.keepers.length > 1 && (
+            <ul data-testid="survival-result-keepers" className="mt-3 space-y-1 text-sm text-white">
+              {result.keepers.map((k, i) => (
+                <li key={i}>
+                  <span className="font-semibold text-cream">
+                    Player {i + 1}, {k.name}
+                  </span>
+                  {k.down ? ' (down at the end)' : ''}: {k.weapons || 'nothing'}.
+                </li>
+              ))}
+            </ul>
+          )}
           {result.reached.length > 0 && (
             <ul data-testid="survival-result-milestones" className="mt-3 text-sm text-plasma">
               {result.reached.map((id) => (
@@ -781,6 +923,11 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
           data-level={hud?.level ?? 1}
           data-boss={hud?.boss ? Math.round(hud.boss.homesickness) : ''}
           data-weapons={hud?.weapons ?? 'laser-pointer:1'}
+          data-players={runPlayers}
+          data-chooser={chooser}
+          data-hero2-x={hud?.heroes[1]?.x ?? ''}
+          data-hero2-y={hud?.heroes[1]?.y ?? ''}
+          data-down={hud?.heroes.map((h) => (h.down ? 1 : 0)).join(' ') ?? ''}
           data-best-key={SURVIVAL_BEST_KEY}
           className="fixed inset-0 z-[9998] select-none overflow-hidden bg-void outline-none"
         >
@@ -821,7 +968,7 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
               Time {clockText(hud?.time ?? 0)} / {clockText(ARENA_CONFIG.timeGoalMs)}
             </p>
             <div className="flex items-center gap-2">
-              <span id="resolve-label">Resolve</span>
+              <span id="resolve-label">{runPlayers === 2 ? 'Player 1 Resolve' : 'Resolve'}</span>
               <div
                 role="meter"
                 aria-labelledby="resolve-label"
@@ -837,8 +984,37 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
                   }}
                 />
               </div>
-              <span data-testid="survival-resolve">{Math.ceil(hud?.resolve ?? 100)}</span>
+              <span data-testid="survival-resolve">
+                {hud?.heroes[0]?.down
+                  ? `Down, back in ${Math.ceil(hud.heroes[0].backIn / 1000)} s`
+                  : Math.ceil(hud?.resolve ?? 100)}
+              </span>
             </div>
+            {hud && hud.heroes.length > 1 && (
+              <div className="flex items-center gap-2">
+                <span id="resolve2-label">Player 2 Resolve</span>
+                <div
+                  role="meter"
+                  aria-labelledby="resolve2-label"
+                  aria-valuemin={0}
+                  aria-valuemax={hud.heroes[1].maxResolve}
+                  aria-valuenow={hud.heroes[1].resolve}
+                  className="h-2 w-32 overflow-hidden rounded-full bg-panel"
+                >
+                  <div
+                    className="h-full bg-aura"
+                    style={{
+                      width: `${(100 * hud.heroes[1].resolve) / hud.heroes[1].maxResolve}%`,
+                    }}
+                  />
+                </div>
+                <span data-testid="survival-resolve2">
+                  {hud.heroes[1].down
+                    ? `Down, back in ${Math.ceil(hud.heroes[1].backIn / 1000)} s`
+                    : Math.ceil(hud.heroes[1].resolve)}
+                </span>
+              </div>
+            )}
             <p data-testid="survival-sent-home">Cats sent home: {hud?.sentHome ?? 0}</p>
             <div className="flex items-center gap-2">
               <span data-testid="survival-level">Level {hud?.level ?? 1}</span>
@@ -865,6 +1041,7 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
 
           {screen === 'choosing' && choices && (
             <div
+              key={chooser}
               ref={choiceRef}
               role="dialog"
               aria-modal="true"
@@ -875,7 +1052,8 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
             >
               <div className="w-full max-w-lg rounded-2xl border border-line bg-panel p-6">
                 <h2 id="level-up-heading" className="font-display text-xl text-cream">
-                  Level {choiceLevel}. Choose one.
+                  Level {choiceLevel}.{' '}
+                  {runPlayers === 2 ? `Player ${chooser + 1}, choose one.` : 'Choose one.'}
                 </h2>
                 <p id="level-up-help" className="mt-1 text-sm text-aura">
                   {touch
diff --git a/app/ui/xenocats/arena.ts b/app/ui/xenocats/arena.ts
index a8bbef5..1e1b5fd 100644
--- a/app/ui/xenocats/arena.ts
+++ b/app/ui/xenocats/arena.ts
@@ -129,6 +129,18 @@ export type ArenaConfig = {
    * stood still for `stillMs`, it comes and sits by him.
    */
   secretCat: { afterMs: number; stillMs: number };
+  /** A second Keeper (local co-op), with his own weapons, pace and Resolve; or null. */
+  secondPlayer: { startingWeapons: readonly WeaponId[]; speed: number; resolve: number } | null;
+  coop: {
+    /** The two start this far apart, px. */
+    startGap: number;
+    /** The shared camera zooms out to keep both in view, up to this (2 = twice as much). */
+    maxZoomOut: number;
+    /** Kept this far inside the screen's edges at the widest, px; beyond, one cannot walk on. */
+    margin: number;
+    /** A downed Keeper stands again if the other lasts this long, ms. */
+    reviveMs: number;
+  };
   /** The spatial grid's cell, px. */
   cellSize: number;
 };
@@ -171,6 +183,8 @@ export const ARENA_CONFIG: ArenaConfig = {
   availableWeapons: BASE_WEAPONS,
   boost: { might: 1, pickup: 1, revivals: 0 },
   secretCat: { afterMs: 60_000, stillMs: 20_000 },
+  secondPlayer: null,
+  coop: { startGap: 80, maxZoomOut: 1.6, margin: 80, reviveMs: 30_000 },
   cellSize: 64,
 };
 
@@ -264,6 +278,8 @@ export type Projectile = {
   touched: number[];
   /** How many more times it splits when it bounces (the Yarn Apocalypse's). */
   splits: number;
+  /** Whose weapon fired it (the Keeper's index). */
+  owner: number;
 };
 
 /** The Yarn Apocalypse's balls stop splitting at this many at once. */
@@ -274,9 +290,40 @@ export const GULP_BURST_RADIUS = 170;
 
 export type Gem = { x: number; y: number; value: number };
 
+/** One player's hero: where he is, his Resolve, his own weapons and passives. */
+type Keeper = {
+  /** 0 for player 1, 1 for player 2. */
+  index: number;
+  x: number;
+  y: number;
+  /** His character's pace and Resolve, before the passives. */
+  speed: number;
+  baseResolve: number;
+  resolve: number;
+  untouchableUntil: number;
+  facing: number;
+  /** An elite's effect on him, while it lasts. */
+  effect: { effect: HeroEffect; until: number; from: Vec; way: Vec } | null;
+  weapons: Map<WeaponId, { level: number; readyAt: number }>;
+  passives: Map<PassiveId, number>;
+  mods: Modifiers;
+  revivals: number;
+  /** When his Resolve ran out while the other went on (co-op); null while he stands. */
+  downedAt: number | null;
+  /** The Forbidden Catnip Vacuum's burst, when it comes (after its pull). */
+  gulpAt: number;
+};
+
 export type ArenaEvent =
   | { kind: 'sent-home'; x: number; y: number; type: number; variety: VarietyId | null }
-  | { kind: 'hero-hit'; type: number; variety: VarietyId | null; elite: boolean }
+  | {
+      kind: 'hero-hit';
+      type: number;
+      variety: VarietyId | null;
+      elite: boolean;
+      /** Which Keeper (0 for player 1, 1 for player 2). */
+      player: number;
+    }
   | { kind: 'boss'; x: number; y: number }
   | { kind: 'chest'; x: number; y: number }
   | { kind: 'laser'; from: Vec; to: Vec }
@@ -284,8 +331,10 @@ export type ArenaEvent =
   | { kind: 'evolution'; from: WeaponId; to: WeaponId }
   /** The secret cat has come. */
   | { kind: 'secret'; id: 'neighbour' }
-  /** His Resolve was spent, and half of it returned (Second Wind). */
-  | { kind: 'revived' }
+  /** His Resolve was spent, and half of it returned (Second Wind, or the other lasted). */
+  | { kind: 'revived'; player: number; by: 'second-wind' | 'ally' }
+  /** In co-op, a Keeper's Resolve is spent while the other goes on: he is down. */
+  | { kind: 'downed'; player: number }
   | { kind: 'fired'; weapon: WeaponId }
   | { kind: 'matriarch' }
   | { kind: 'over'; outcome: ArenaOutcome };
@@ -317,14 +366,62 @@ export function createArena(options: {
   let time = 0;
   let status: 'playing' | 'over' = 'playing';
   let outcome: ArenaOutcome | null = null;
-  const hero = { x: 0, y: 0, resolve: config.hero.resolve, untouchableUntil: 0, facing: 1 };
-  let effect: { effect: HeroEffect; until: number; from: Vec; way: Vec } | null = null;
+  /** The passives held, and what the run brought from before (the boost). */
+  const boosted = (m: Modifiers): Modifiers => ({
+    ...m,
+    might: m.might * config.boost.might,
+    pickup: m.pickup * config.boost.pickup,
+  });
+
+  function newKeeper(
+    index: number,
+    at: Vec,
+    own: { startingWeapons: readonly WeaponId[]; speed: number; resolve: number },
+    startingPassives: readonly PassiveId[]
+  ): Keeper {
+    const weapons = new Map<WeaponId, { level: number; readyAt: number }>();
+    for (const id of own.startingWeapons) {
+      weapons.set(id, { level: config.startingLevel, readyAt: config.firstShotMs });
+    }
+    const passives = new Map<PassiveId, number>(startingPassives.map((id) => [id, 1]));
+    return {
+      index,
+      x: at.x,
+      y: at.y,
+      speed: own.speed,
+      baseResolve: own.resolve,
+      resolve: own.resolve,
+      untouchableUntil: 0,
+      facing: 1,
+      effect: null,
+      weapons,
+      passives,
+      mods: boosted(modifiers(passives)),
+      revivals: config.boost.revivals,
+      downedAt: null,
+      gulpAt: Infinity,
+    };
+  }
+
+  // The Keepers: one, or two side by side in co-op (config.secondPlayer).
+  const first = {
+    startingWeapons: config.startingWeapons,
+    speed: config.hero.speed,
+    resolve: config.hero.resolve,
+  };
+  const keepers: Keeper[] = config.secondPlayer
+    ? [
+        newKeeper(0, { x: -config.coop.startGap / 2, y: 0 }, first, config.startingPassives),
+        newKeeper(1, { x: config.coop.startGap / 2, y: 0 }, config.secondPlayer, []),
+      ]
+    : [newKeeper(0, { x: 0, y: 0 }, first, config.startingPassives)];
+  /** The Keeper being dealt with now: whose walk, weapons and touch. */
+  let hero = keepers[0];
   let sentHome = 0;
   let nextId = 1;
-  // How long he has stood still; whether the secret cat has come; revivals left.
+  // How long he has stood still; whether the secret cat has come.
   let stillFor = 0;
   let secretCame = false;
-  let revivals = config.boost.revivals;
   // The cats: live ones in `cats`, sent-home ones kept in `spare` to be reused.
   const cats: ArenaCat[] = [];
   const spare: ArenaCat[] = [];
@@ -342,32 +439,78 @@ export function createArena(options: {
   const shots: Shot[] = [];
   const spareShots: Shot[] = [];
 
-  // The arsenal.
-  const weapons = new Map<WeaponId, { level: number; readyAt: number }>();
-  for (const id of config.startingWeapons) {
-    weapons.set(id, { level: config.startingLevel, readyAt: config.firstShotMs });
-  }
-  const passives = new Map<PassiveId, number>(config.startingPassives.map((id) => [id, 1]));
-  /** The passives held, and what the run brought from before (the boost). */
-  const boosted = (m: Modifiers): Modifiers => ({
-    ...m,
-    might: m.might * config.boost.might,
-    pickup: m.pickup * config.boost.pickup,
-  });
-  let mods: Modifiers = boosted(modifiers(passives));
+  // What the weapons fired.
   const projectiles: Projectile[] = [];
   const spareProjectiles: Projectile[] = [];
   const beams: { from: Vec; to: Vec; until: number }[] = [];
-  // The Forbidden Catnip Vacuum's burst, when it comes (after its pull).
-  let gulpAt = Infinity;
   // Experience.
   const gems: Gem[] = [];
   let xp = 0;
   let level = 1;
   let pending = 0;
   let choosing: Choice[] | null = null;
+  /** Whose turn it is to choose (co-op: player 1, then player 2, each level). */
+  let chooser = 0;
 
-  const maxResolve = () => config.hero.resolve + mods.maxResolve;
+  const maxResolveOf = (k: Keeper) => k.baseResolve + k.mods.maxResolve;
+  const maxResolve = () => maxResolveOf(hero);
+  const standing = (k: Keeper) => k.downedAt === null;
+
+  /**
+   * The shared camera: on the one Keeper, or between the two, zoomed out (up to
+   * config.coop.maxZoomOut) to keep both in view. The screen then shows the
+   * viewport times `zoom` of the arena.
+   */
+  function camera(): { x: number; y: number; zoom: number } {
+    if (keepers.length === 1) return { x: keepers[0].x, y: keepers[0].y, zoom: 1 };
+    const [a, b] = keepers;
+    const m = config.coop.margin;
+    const zoom = Math.min(
+      config.coop.maxZoomOut,
+      Math.max(
+        1,
+        (Math.abs(a.x - b.x) + 2 * m) / viewport.width,
+        (Math.abs(a.y - b.y) + 2 * m) / viewport.height
+      )
+    );
+    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, zoom };
+  }
+
+  /**
+   * The tether: at the camera's widest, neither can walk further from the other.
+   * Only this step's walk is held back (`from` is where he stood): if they are
+   * already further apart (the window shrank), he is not moved, only kept from
+   * going further.
+   */
+  function tether(k: Keeper, from: Vec) {
+    if (keepers.length < 2) return;
+    const other = keepers[1 - k.index];
+    const spanX = Math.max(
+      viewport.width * config.coop.maxZoomOut - 2 * config.coop.margin,
+      Math.abs(from.x - other.x)
+    );
+    const spanY = Math.max(
+      viewport.height * config.coop.maxZoomOut - 2 * config.coop.margin,
+      Math.abs(from.y - other.y)
+    );
+    k.x = Math.min(Math.max(k.x, other.x - spanX), other.x + spanX);
+    k.y = Math.min(Math.max(k.y, other.y - spanY), other.y + spanY);
+  }
+
+  /** The standing Keeper nearest a point (the first, if none stands). */
+  function nearestKeeper(x: number, y: number): Keeper {
+    let best = keepers[0];
+    let bestD = Infinity;
+    for (const k of keepers) {
+      if (!standing(k)) continue;
+      const d = (k.x - x) ** 2 + (k.y - y) ** 2;
+      if (d < bestD) {
+        bestD = d;
+        best = k;
+      }
+    }
+    return best;
+  }
 
   /** A type's own numbers, the same every time: spread between the config's bounds. */
   const byType = (type: number, [low, high]: readonly [number, number], salt: number) => {
@@ -375,10 +518,14 @@ export function createArena(options: {
     return low + (high - low) * share;
   };
 
-  /** A point just off screen, at `angle` from him. */
+  /** A point just off screen, at `angle` from its centre. */
   function offScreen(angle: number, extra = 0): Vec {
-    const reach = Math.hypot(viewport.width, viewport.height) / 2 + config.cats.spawnMargin + extra;
-    return { x: hero.x + Math.cos(angle) * reach, y: hero.y + Math.sin(angle) * reach };
+    const cam = camera();
+    const reach =
+      (Math.hypot(viewport.width, viewport.height) / 2) * cam.zoom +
+      config.cats.spawnMargin +
+      extra;
+    return { x: cam.x + Math.cos(angle) * reach, y: cam.y + Math.sin(angle) * reach };
   }
 
   /** A new cat (pooled), at `at`. */
@@ -423,18 +570,19 @@ export function createArena(options: {
 
   /** A spot on the screen, at least `away` from him: where a cat that sits is found. */
   function onScreen(away: number): Vec {
+    const cam = camera();
     const angle = random.next() * 2 * Math.PI;
     const cos = Math.abs(Math.cos(angle));
     const sin = Math.abs(Math.sin(angle));
     // How far the screen reaches that way (40 px in from its edge), so a narrow
     // screen keeps the cat on it: nearer than `away` only if the screen is that small.
     const edge = Math.min(
-      cos > 1e-6 ? (viewport.width / 2 - 40) / cos : Infinity,
-      sin > 1e-6 ? (viewport.height / 2 - 40) / sin : Infinity
+      cos > 1e-6 ? ((viewport.width * cam.zoom) / 2 - 40) / cos : Infinity,
+      sin > 1e-6 ? ((viewport.height * cam.zoom) / 2 - 40) / sin : Infinity
     );
     const near = Math.min(away, edge / 2);
     const reach = random.range(near, Math.max(edge, near));
-    return { x: hero.x + Math.cos(angle) * reach, y: hero.y + Math.sin(angle) * reach };
+    return { x: cam.x + Math.cos(angle) * reach, y: cam.y + Math.sin(angle) * reach };
   }
 
   /** One arrival: who comes is drawn from what the schedule allows now, by weight. */
@@ -462,8 +610,10 @@ export function createArena(options: {
    * where he is, and none counts for nothing.
    */
   function bringBack(cat: ArenaCat) {
-    const far = (Math.hypot(viewport.width, viewport.height) / 2 + config.cats.spawnMargin) * 2;
-    if (Math.hypot(cat.x - hero.x, cat.y - hero.y) <= far + cat.radius) return;
+    const cam = camera();
+    const far =
+      ((Math.hypot(viewport.width, viewport.height) / 2) * cam.zoom + config.cats.spawnMargin) * 2;
+    if (Math.hypot(cat.x - cam.x, cat.y - cam.y) <= far + cat.radius) return;
     const sits = cat.variety !== null && VARIETIES[cat.variety].gait === 'sit';
     const at = sits ? onScreen(200) : offScreen(random.next() * 2 * Math.PI, cat.radius);
     cat.x = at.x;
@@ -549,7 +699,7 @@ export function createArena(options: {
 
   /** Lays an elite's effect on the hero, if none is on him. */
   function afflict(cat: ArenaCat) {
-    if (effect && time < effect.until) return;
+    if (hero.effect && time < hero.effect.until) return;
     if (cat.variety !== null) return;
     const type = types[cat.type];
     const kind = HERO_EFFECTS[type.effect.id];
@@ -568,14 +718,14 @@ export function createArena(options: {
       hero.x += Math.cos(angle) * kind.distance;
       hero.y += Math.sin(angle) * kind.distance;
     }
-    effect = { effect: kind, until, from: { x: cat.x, y: cat.y }, way };
+    hero.effect = { effect: kind, until, from: { x: cat.x, y: cat.y }, way };
   }
 
   /** The hero's walk this step, after any effect on him. */
   function heroStep(input: Vec, dt: number) {
-    const active = effect && time < effect.until ? effect : null;
+    const active = hero.effect && time < hero.effect.until ? hero.effect : null;
     let { x, y } = input;
-    let speed = config.hero.speed * mods.speed;
+    let speed = hero.speed * hero.mods.speed;
     if (active) {
       const e = active.effect;
       if (e.kind === 'freeze') speed = 0;
@@ -597,8 +747,9 @@ export function createArena(options: {
 
   /** A cat's step, its own way. */
   function moveCat(cat: ArenaCat, dt: number) {
-    const dx = hero.x - cat.x;
-    const dy = hero.y - cat.y;
+    const target = nearestKeeper(cat.x, cat.y);
+    const dx = target.x - cat.x;
+    const dy = target.y - cat.y;
     const d = Math.hypot(dx, dy) || 1;
     const gait = cat.variety ? VARIETIES[cat.variety].gait : 'walk';
     if (gait === 'sit') return;
@@ -639,13 +790,28 @@ export function createArena(options: {
       const shot = shots[i];
       shot.x += shot.vx * dt;
       shot.y += shot.vy * dt;
-      const hit =
-        Math.hypot(shot.x - hero.x, shot.y - hero.y) <=
-        config.hero.reach / 2 + config.laserCat.shotRadius;
-      if (hit && time >= hero.untouchableUntil) {
-        hero.resolve = Math.max(hero.resolve - shot.drain, 0);
-        hero.untouchableUntil = time + config.hero.untouchableMs;
-        events.push({ kind: 'hero-hit', type: -1, variety: 'laser', elite: false });
+      let hit = false;
+      for (const k of keepers) {
+        if (!standing(k)) continue;
+        if (
+          Math.hypot(shot.x - k.x, shot.y - k.y) >
+          config.hero.reach / 2 + config.laserCat.shotRadius
+        ) {
+          continue;
+        }
+        hit = true;
+        if (time >= k.untouchableUntil) {
+          k.resolve = Math.max(k.resolve - shot.drain, 0);
+          k.untouchableUntil = time + config.hero.untouchableMs;
+          events.push({
+            kind: 'hero-hit',
+            type: -1,
+            variety: 'laser',
+            elite: false,
+            player: k.index,
+          });
+        }
+        break;
       }
       if (hit || time >= shot.until) {
         shots[i] = shots[shots.length - 1];
@@ -738,10 +904,13 @@ export function createArena(options: {
     return length < 0.5 ? { x: hero.facing, y: 0 } : { x: dx / length, y: dy / length };
   }
 
-  function launch(p: Omit<Projectile, 'touched' | 'splits'> & { splits?: number }) {
+  function launch(
+    p: Omit<Projectile, 'touched' | 'splits' | 'owner'> & { splits?: number; owner?: number }
+  ) {
     const projectile = spareProjectiles.pop() ?? ({ touched: [] } as unknown as Projectile);
     Object.assign(projectile, p);
     projectile.splits = p.splits ?? 0;
+    projectile.owner = p.owner ?? hero.index;
     projectile.touched.length = 0;
     projectiles.push(projectile);
   }
@@ -802,7 +971,7 @@ export function createArena(options: {
           cat.y = hero.y + ((cat.y - hero.y) * keep) / d;
         }
       }
-      gulpAt = time + s.durationMs;
+      hero.gulpAt = time + s.durationMs;
       return true;
     }
     if (kind === 'pull') {
@@ -884,17 +1053,17 @@ export function createArena(options: {
   }
 
   function swingWeapons(dt: number) {
-    if (time >= gulpAt) {
-      gulpAt = Infinity;
-      const gulp = weapons.get('forbidden-catnip-vacuum');
+    if (time >= hero.gulpAt) {
+      hero.gulpAt = Infinity;
+      const gulp = hero.weapons.get('forbidden-catnip-vacuum');
       if (gulp) {
-        const s = weaponStats('forbidden-catnip-vacuum', gulp.level, mods);
-        for (const i of within(hero, GULP_BURST_RADIUS * mods.area))
+        const s = weaponStats('forbidden-catnip-vacuum', gulp.level, hero.mods);
+        for (const i of within(hero, GULP_BURST_RADIUS * hero.mods.area))
           hurt(cats[i], s.damage, 'gulp');
       }
     }
-    for (const [id, held] of weapons) {
-      const s = weaponStats(id, held.level, mods);
+    for (const [id, held] of hero.weapons) {
+      const s = weaponStats(id, held.level, hero.mods);
       const kind = WEAPONS[id].kind;
       if (kind === 'orbit') {
         // Each blade, all the time, to every cat it passes through.
@@ -917,8 +1086,11 @@ export function createArena(options: {
   }
 
   function moveProjectiles(dt: number) {
-    const left = hero.x - viewport.width / 2;
-    const top = hero.y - viewport.height / 2;
+    const cam = camera();
+    const w = viewport.width * cam.zoom;
+    const h = viewport.height * cam.zoom;
+    const left = cam.x - w / 2;
+    const top = cam.y - h / 2;
     for (let n = projectiles.length - 1; n >= 0; n--) {
       const p = projectiles[n];
       p.x += p.vx * dt;
@@ -926,12 +1098,12 @@ export function createArena(options: {
       if (p.weapon === 'yarn-ball' || p.weapon === 'yarn-apocalypse') {
         // Off the edges of the screen, as he walks.
         let bounced = false;
-        if (p.x < left || p.x > left + viewport.width) {
-          p.vx = Math.sign(hero.x - p.x) * Math.abs(p.vx);
+        if (p.x < left || p.x > left + w) {
+          p.vx = Math.sign(cam.x - p.x) * Math.abs(p.vx);
           bounced = true;
         }
-        if (p.y < top || p.y > top + viewport.height) {
-          p.vy = Math.sign(hero.y - p.y) * Math.abs(p.vy);
+        if (p.y < top || p.y > top + h) {
+          p.vy = Math.sign(cam.y - p.y) * Math.abs(p.vy);
           bounced = true;
         }
         // The Apocalypse's balls split in two where they bounce, up to a limit.
@@ -940,9 +1112,8 @@ export function createArena(options: {
           // The other half goes off at a right angle, but back onto the screen.
           let vx = -p.vy;
           let vy = p.vx;
-          if (p.x < left || p.x > left + viewport.width)
-            vx = Math.sign(hero.x - p.x) * Math.abs(vx);
-          if (p.y < top || p.y > top + viewport.height) vy = Math.sign(hero.y - p.y) * Math.abs(vy);
+          if (p.x < left || p.x > left + w) vx = Math.sign(cam.x - p.x) * Math.abs(vx);
+          if (p.y < top || p.y > top + h) vy = Math.sign(cam.y - p.y) * Math.abs(vy);
           launch({
             weapon: p.weapon,
             bit: false,
@@ -955,6 +1126,7 @@ export function createArena(options: {
             pierce: Infinity,
             until: p.until,
             splits: p.splits,
+            owner: p.owner,
           });
         }
       }
@@ -968,11 +1140,13 @@ export function createArena(options: {
       if (p.pierce <= 0 || time >= p.until) {
         // A hairball bursts into smaller ones where it ends.
         if (p.weapon === 'hairball' && !p.bit) {
-          const s = weaponStats('hairball', weapons.get('hairball')?.level ?? 1, mods);
+          const owner = keepers[p.owner];
+          const s = weaponStats('hairball', owner.weapons.get('hairball')?.level ?? 1, owner.mods);
           for (let k = 0; k < s.count; k++) {
             const turn = (k * 2 * Math.PI) / s.count;
             launch({
               weapon: 'hairball',
+              owner: p.owner,
               bit: true,
               x: p.x,
               y: p.y,
@@ -995,11 +1169,12 @@ export function createArena(options: {
   // --------------------------------------------------------------- experience
 
   function gatherGems(dt: number) {
-    const reach = config.gems.pickup * mods.pickup;
     for (let i = gems.length - 1; i >= 0; i--) {
       const gem = gems[i];
-      const dx = hero.x - gem.x;
-      const dy = hero.y - gem.y;
+      const k = nearestKeeper(gem.x, gem.y);
+      const reach = config.gems.pickup * k.mods.pickup;
+      const dx = k.x - gem.x;
+      const dy = k.y - gem.y;
       const d = Math.hypot(dx, dy);
       if (d <= 14) {
         xp += gem.value;
@@ -1019,26 +1194,34 @@ export function createArena(options: {
     }
     for (let i = chests.length - 1; i >= 0; i--) {
       const chest = chests[i];
-      if (Math.hypot(chest.x - hero.x, chest.y - hero.y) > config.chestReach) continue;
+      const opener = keepers.find(
+        (k) => standing(k) && Math.hypot(chest.x - k.x, chest.y - k.y) <= config.chestReach
+      );
+      if (!opener) continue;
+      // Whoever opens it: his weapon may evolve.
+      hero = opener;
       chests.splice(i, 1);
       events.push({ kind: 'chest', x: chest.x, y: chest.y });
       // A weapon ready to evolve does, in its place; otherwise a level-up.
       const evolution = evolutionFor(
-        new Map([...weapons].map(([id, w]) => [id, w.level] as const)),
-        passives
+        new Map([...hero.weapons].map(([id, w]) => [id, w.level] as const)),
+        hero.passives
       );
       if (evolution) {
-        weapons.delete(evolution.from);
-        weapons.set(evolution.to, { level: MAX_WEAPON_LEVEL, readyAt: time });
+        hero.weapons.delete(evolution.from);
+        hero.weapons.set(evolution.to, { level: MAX_WEAPON_LEVEL, readyAt: time });
         events.push({ kind: 'evolution', from: evolution.from, to: evolution.to });
       } else pending++;
     }
+    hero = keepers[0];
     if (pending > 0 && !choosing) offer();
   }
 
+  /** The waiting level-up's choices, for the Keeper whose turn it is. */
   function offer() {
-    const held = new Map([...weapons].map(([id, w]) => [id, w.level] as const));
-    choosing = offerChoices(held, passives, mods.choices, random, config.availableWeapons);
+    const k = keepers[chooser];
+    const held = new Map([...k.weapons].map(([id, w]) => [id, w.level] as const));
+    choosing = offerChoices(held, k.passives, k.mods.choices, random, config.availableWeapons);
   }
 
   return {
@@ -1053,12 +1236,19 @@ export function createArena(options: {
      * vector, or zero), cats come (while `spawn` allows), walk, reach him or are
      * sent home. Nothing moves while a level-up's choice waits.
      */
-    step(input: Vec, spawn = true) {
+    step(input: Vec, spawn = true, input2: Vec = { x: 0, y: 0 }) {
       if (status === 'over' || choosing) return;
       const dt = config.stepMs / 1000;
       time += config.stepMs;
-      heroStep(input, dt);
-      hero.resolve = Math.min(hero.resolve + mods.recovery * dt, maxResolve());
+      for (const k of keepers) {
+        if (!standing(k)) continue;
+        hero = k;
+        const from = { x: k.x, y: k.y };
+        heroStep(k.index === 0 ? input : input2, dt);
+        tether(k, from);
+        k.resolve = Math.min(k.resolve + k.mods.recovery * dt, maxResolve());
+      }
+      hero = keepers[0];
 
       // Arrivals: towards how many the arena wants now, a share a second at most.
       // While the frame-rate guard says no, only up to `guardFree`.
@@ -1068,8 +1258,12 @@ export function createArena(options: {
         spawn ? Infinity : config.cats.guardFree
       );
       spawnEvents(spawn);
-      // The secret cat, once, to a Keeper who has stood still long enough.
-      stillFor = input.x === 0 && input.y === 0 ? stillFor + config.stepMs : 0;
+      // The secret cat, once, to Keepers who have stood still long enough.
+      const still =
+        input.x === 0 &&
+        input.y === 0 &&
+        (keepers.length === 1 || (input2.x === 0 && input2.y === 0));
+      stillFor = still ? stillFor + config.stepMs : 0;
       if (!secretCame && time >= config.secretCat.afterMs && stillFor >= config.secretCat.stillMs) {
         secretCame = true;
         spawnVariety('neighbour', onScreen(120));
@@ -1085,7 +1279,7 @@ export function createArena(options: {
         arrivals = 0;
       }
 
-      // The cats walk at him; the grid is rebuilt from where they now stand.
+      // The cats walk at the nearest Keeper; the grid is rebuilt from where they stand.
       grid.clear();
       // The few big cats (bigger than the cats' size) are kept apart, so every
       // search looks a cat's size further, not the biggest one's.
@@ -1099,47 +1293,84 @@ export function createArena(options: {
       }
       moveShots(dt);
 
-      // Reached: one drain per moment, an elite's effect on top.
-      if (time >= hero.untouchableUntil) {
-        gather(hero.x, hero.y, config.hero.reach);
+      // Reached: one drain per moment for each Keeper, an elite's effect on top.
+      for (const k of keepers) {
+        if (!standing(k) || time < k.untouchableUntil) continue;
+        hero = k;
+        gather(k.x, k.y, config.hero.reach);
         for (const i of near) {
           const cat = cats[i];
           // (The Neighbour's Cat drains nothing: it only sits there.)
           if (cat.drain === 0) continue;
-          if ((cat.x - hero.x) ** 2 + (cat.y - hero.y) ** 2 > reachOf(cat) ** 2) continue;
-          hero.resolve = Math.max(hero.resolve - cat.drain, 0);
-          hero.untouchableUntil = time + config.hero.untouchableMs;
-          events.push({ kind: 'hero-hit', type: cat.type, variety: cat.variety, elite: cat.elite });
+          if ((cat.x - k.x) ** 2 + (cat.y - k.y) ** 2 > reachOf(cat) ** 2) continue;
+          k.resolve = Math.max(k.resolve - cat.drain, 0);
+          k.untouchableUntil = time + config.hero.untouchableMs;
+          events.push({
+            kind: 'hero-hit',
+            type: cat.type,
+            variety: cat.variety,
+            elite: cat.elite,
+            player: k.index,
+          });
           if (cat.elite) afflict(cat);
           break;
         }
       }
-      if (hero.resolve <= 0 && revivals > 0) {
-        revivals--;
-        hero.resolve = maxResolve() / 2;
-        events.push({ kind: 'revived' });
+
+      // Spent: Second Wind if he has it; in co-op he is down until the other has
+      // lasted long enough; the run ends when no Keeper stands.
+      for (const k of keepers) {
+        hero = k;
+        if (!standing(k)) {
+          if (time - (k.downedAt ?? time) >= config.coop.reviveMs) {
+            k.downedAt = null;
+            k.resolve = maxResolve() / 2;
+            k.untouchableUntil = time + config.hero.untouchableMs;
+            events.push({ kind: 'revived', player: k.index, by: 'ally' });
+          }
+          continue;
+        }
+        if (k.resolve <= 0 && k.revivals > 0) {
+          k.revivals--;
+          k.resolve = maxResolve() / 2;
+          events.push({ kind: 'revived', player: k.index, by: 'second-wind' });
+        }
+        if (k.resolve <= 0) {
+          k.downedAt = time;
+          k.effect = null;
+          if (keepers.length > 1) events.push({ kind: 'downed', player: k.index });
+        }
       }
-      if (hero.resolve <= 0) {
+      hero = keepers[0];
+      if (!keepers.some(standing)) {
         end('spent');
         return;
       }
 
-      // His weapons; what flies; then every cat homesick enough goes home.
-      swingWeapons(dt);
+      // Their weapons; what flies; then every cat homesick enough goes home.
+      for (const k of keepers) {
+        if (!standing(k)) continue;
+        hero = k;
+        swingWeapons(dt);
+      }
+      hero = keepers[0];
       moveProjectiles(dt);
       sweepHome();
       for (let i = beams.length - 1; i >= 0; i--) if (beams[i].until <= time) beams.splice(i, 1);
       gatherGems(dt);
 
-      // The time goal: the Matriarch comes, and ends the run when she reaches him.
+      // The time goal: the Matriarch comes, and ends the run when she reaches one.
       if (time >= config.timeGoalMs) {
         if (!matriarch) {
-          const reach = Math.hypot(viewport.width, viewport.height) / 2 + config.cats.spawnMargin;
-          matriarch = { x: hero.x - reach, y: hero.y };
+          const cam = camera();
+          const reach =
+            (Math.hypot(viewport.width, viewport.height) / 2) * cam.zoom + config.cats.spawnMargin;
+          matriarch = { x: cam.x - reach, y: cam.y };
           events.push({ kind: 'matriarch' });
         }
-        const dx = hero.x - matriarch.x;
-        const dy = hero.y - matriarch.y;
+        const target = nearestKeeper(matriarch.x, matriarch.y);
+        const dx = target.x - matriarch.x;
+        const dy = target.y - matriarch.y;
         const d = Math.hypot(dx, dy) || 1;
         const move = Math.min(config.matriarch.speed * dt, d);
         matriarch.x += (dx / d) * move;
@@ -1156,25 +1387,37 @@ export function createArena(options: {
     /** Takes the level-up's choice `index`; the run goes on (or the next level's choice comes). */
     choose(index: number) {
       if (!choosing) return;
+      hero = keepers[chooser];
       const choice = choosing[Math.min(Math.max(index, 0), choosing.length - 1)];
       if (choice.kind === 'weapon') {
-        const held = weapons.get(choice.id);
+        const held = hero.weapons.get(choice.id);
         if (held) held.level = choice.level;
-        else weapons.set(choice.id, { level: 1, readyAt: time + 200 });
+        else hero.weapons.set(choice.id, { level: 1, readyAt: time + 200 });
       } else if (choice.kind === 'passive') {
         const before = maxResolve();
-        passives.set(choice.id, choice.level);
-        mods = boosted(modifiers(passives));
+        hero.passives.set(choice.id, choice.level);
+        hero.mods = boosted(modifiers(hero.passives));
         // More Resolve to hold: he gains what was added.
         hero.resolve += maxResolve() - before;
       } else {
         hero.resolve = Math.min(hero.resolve + 30, maxResolve());
       }
-      pending--;
+      hero = keepers[0];
       choosing = null;
-      if (pending > 0) offer();
+      // In co-op the next player chooses for the same level; then the next level.
+      if (chooser + 1 < keepers.length) {
+        chooser++;
+        offer();
+      } else {
+        chooser = 0;
+        pending--;
+        if (pending > 0) offer();
+      }
     },
 
+    /** Whose choice the waiting level-up is: 0 for player 1, 1 for player 2. */
+    chooser: (): number => chooser,
+
     /** The hero gives up: the run ends where it stands. */
     giveUp() {
       end('gave-up');
@@ -1195,41 +1438,71 @@ export function createArena(options: {
     /** Where the Can Opener's blades are, and the Thunderous Vacuum's reach (or null). */
     blades: (): Vec[] => {
       const all: Vec[] = [];
-      for (const [id, held] of weapons) {
-        if (WEAPONS[id].kind === 'orbit') all.push(...bladesOf(weaponStats(id, held.level, mods)));
+      for (const k of keepers) {
+        if (!standing(k)) continue;
+        hero = k;
+        for (const [id, held] of k.weapons) {
+          if (WEAPONS[id].kind === 'orbit')
+            all.push(...bladesOf(weaponStats(id, held.level, k.mods)));
+        }
       }
+      hero = keepers[0];
       return all;
     },
-    zone: (): number | null => {
-      const held = weapons.get('thunderous-vacuum');
-      return held ? weaponStats('thunderous-vacuum', held.level, mods).area : null;
-    },
+    /** Each standing Keeper's Thunderous Vacuum: where, and how far it reaches. */
+    zones: (): { x: number; y: number; radius: number }[] =>
+      keepers.flatMap((k) => {
+        const held = k.weapons.get('thunderous-vacuum');
+        if (!held || !standing(k)) return [];
+        return [
+          { x: k.x, y: k.y, radius: weaponStats('thunderous-vacuum', held.level, k.mods).area },
+        ];
+      }),
+    /** The shared camera (one Keeper: on him, unzoomed). */
+    camera,
     matriarch: (): Vec | null => matriarch,
     chests: (): readonly Vec[] => chests,
     shots: (): readonly { x: number; y: number }[] => shots,
 
     state() {
-      const active = effect && time < effect.until ? effect.effect.kind : null;
+      const first = keepers[0];
+      const active = first.effect && time < first.effect.until ? first.effect.effect.kind : null;
       return {
         time,
         status,
         outcome,
+        /** Player 1's Keeper (the only one, alone). */
         hero: {
-          x: hero.x,
-          y: hero.y,
-          resolve: hero.resolve,
-          maxResolve: maxResolve(),
-          facing: hero.facing,
-          untouchable: time < hero.untouchableUntil,
+          x: first.x,
+          y: first.y,
+          resolve: first.resolve,
+          maxResolve: maxResolveOf(first),
+          facing: first.facing,
+          untouchable: time < first.untouchableUntil,
           effect: active,
         },
+        /** Every Keeper: one, or two in co-op. */
+        heroes: keepers.map((k) => ({
+          x: k.x,
+          y: k.y,
+          resolve: k.resolve,
+          maxResolve: maxResolveOf(k),
+          facing: k.facing,
+          untouchable: time < k.untouchableUntil,
+          effect: k.effect && time < k.effect.until ? k.effect.effect.kind : null,
+          down: !standing(k),
+          /** How long until a downed Keeper stands again, ms (0 while he stands). */
+          backIn: k.downedAt === null ? 0 : Math.max(k.downedAt + config.coop.reviveMs - time, 0),
+          weapons: [...k.weapons].map(([id, held]) => ({ id, level: held.level })),
+        })),
+        chooser,
         cats: cats.length,
         sentHome,
         level,
         xp,
         xpToNext: xpToNext(level),
-        weapons: [...weapons].map(([id, held]) => ({ id, level: held.level })),
-        passives: [...passives].map(([id, l]) => ({ id, level: l })),
+        weapons: [...first.weapons].map(([id, held]) => ({ id, level: held.level })),
+        passives: [...first.passives].map(([id, l]) => ({ id, level: l })),
         projectiles: projectiles.length,
         gems: gems.length,
         chests: chests.length,
diff --git a/app/ui/xenocats/progression.ts b/app/ui/xenocats/progression.ts
index 64b756a..61afc18 100644
--- a/app/ui/xenocats/progression.ts
+++ b/app/ui/xenocats/progression.ts
@@ -285,23 +285,41 @@ export function codexEntries(progress: Progress): { id: string; name: string; fo
   });
 }
 
-/** What a run starts with: his character, what the Tailor sold him, what is unlocked. */
-export function runConfig(progress: Progress, base: ArenaConfig): Partial<ArenaConfig> {
-  const character = CHARACTERS[progress.character];
-  const level = (id: UpgradeId) => progress.upgrades[id] ?? 0;
+/** A Keeper going out as `id`, with the Tailor's work: his weapon, Resolve and pace. */
+function keeperFor(progress: Progress, id: CharacterId, base: ArenaConfig) {
+  const character = CHARACTERS[id];
+  const level = (u: UpgradeId) => progress.upgrades[u] ?? 0;
   return {
     startingWeapons: [character.weapon],
+    resolve: Math.max(base.hero.resolve + character.resolve + 10 * level('stubbornness'), 1),
+    speed: base.hero.speed * character.speed * (1 + 0.04 * level('brisk-step')),
+  };
+}
+
+/**
+ * What a run starts with: his character, what the Tailor sold him, what is
+ * unlocked; and in co-op, player 2 going out as `second` (a character player 1 has).
+ */
+export function runConfig(
+  progress: Progress,
+  base: ArenaConfig,
+  second: CharacterId | null = null
+): Partial<ArenaConfig> {
+  const level = (id: UpgradeId) => progress.upgrades[id] ?? 0;
+  const one = keeperFor(progress, progress.character, base);
+  return {
+    startingWeapons: one.startingWeapons,
     availableWeapons: availableWeapons(progress),
-    hero: {
-      ...base.hero,
-      resolve: Math.max(base.hero.resolve + character.resolve + 10 * level('stubbornness'), 1),
-      speed: base.hero.speed * character.speed * (1 + 0.04 * level('brisk-step')),
-    },
+    hero: { ...base.hero, resolve: one.resolve, speed: one.speed },
     boost: {
       might: 1 + 0.05 * level('sternness'),
       pickup: 1 + 0.1 * level('long-arms'),
       revivals: level('second-wind'),
     },
+    secondPlayer:
+      second === null
+        ? null
+        : keeperFor(progress, hasCharacter(progress, second) ? second : 'keeper', base),
   };
 }
 
diff --git a/app/ui/xenocats/walking.ts b/app/ui/xenocats/walking.ts
index 6814e3c..7103392 100644
--- a/app/ui/xenocats/walking.ts
+++ b/app/ui/xenocats/walking.ts
@@ -18,17 +18,24 @@ const WALK_KEYS: Readonly<Record<string, Vec>> = {
 
 export const isWalkKey = (code: string) => code in WALK_KEYS;
 
+/** In local co-op: player 1 walks with WASD, player 2 with the arrow keys. */
+export const PLAYER_KEYS: readonly ReadonlySet<string>[] = [
+  new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']),
+  new Set(['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']),
+];
+
 /**
  * The way the held keys walk the character: a unit vector, or zero when none (or
- * only opposite ones) are held. A diagonal is no faster than a straight line.
+ * only opposite ones) are held. A diagonal is no faster than a straight line. With
+ * `only`, just those keys count (one player's, in co-op).
  */
-export function walkDirection(held: Iterable<string>): Vec {
+export function walkDirection(held: Iterable<string>, only?: ReadonlySet<string>): Vec {
   const keys = new Set(held);
   let x = 0;
   let y = 0;
   for (const code of keys) {
     const way = WALK_KEYS[code];
-    if (!way) continue;
+    if (!way || (only && !only.has(code))) continue;
     x += way.x;
     y += way.y;
   }
diff --git a/tests/e2e/survival.spec.ts b/tests/e2e/survival.spec.ts
index 0838488..9d8db42 100644
--- a/tests/e2e/survival.spec.ts
+++ b/tests/e2e/survival.spec.ts
@@ -36,6 +36,23 @@ async function pauseRun(page: Page) {
   return paused;
 }
 
+/** A data- number once it has stopped changing (the HUD trails the run a little). */
+async function settled(page: Page, name: string) {
+  let last = NaN;
+  await expect
+    .poll(
+      async () => {
+        const now = await num(page, name);
+        const same = now === last;
+        last = now;
+        return same;
+      },
+      { intervals: [300] }
+    )
+    .toBe(true);
+  return last;
+}
+
 async function openArena(page: Page, query = '?seed=7') {
   await page.goto('/cats/survival' + query);
   await expect(page.getByRole('heading', { level: 1, name: 'Survival' })).toBeVisible();
@@ -207,6 +224,67 @@ test.describe('on a computer', () => {
     await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
   });
 
+  test('two Keepers at one keyboard: each walks with his own keys, and a level-up asks both in turn', async ({
+    page,
+  }) => {
+    test.setTimeout(60_000);
+    await openArena(page, '?seed=7&speed=6');
+    // A click before hydration is lost: choose two until two are chosen.
+    const two = page.getByTestId('survival-players-2');
+    await expect
+      .poll(async () => {
+        await two.check();
+        return page.getByTestId('survival-player2-character').count();
+      })
+      .toBe(1);
+    await startRun(page);
+    await expect(area(page)).toHaveAttribute('data-players', '2');
+    await expect(page.getByRole('meter', { name: 'Player 2 Resolve' })).toBeVisible();
+    await expect.poll(() => area(page).getAttribute('data-hero2-x')).not.toBe('');
+
+    // Player 1 walks right with D; player 2 stays where he is.
+    const x1 = await settled(page, 'data-hero-x');
+    const x2 = await settled(page, 'data-hero2-x');
+    await page.keyboard.down('d');
+    await expect.poll(() => num(page, 'data-hero-x')).toBeGreaterThan(x1 + 40);
+    await page.keyboard.up('d');
+    expect(Math.abs((await settled(page, 'data-hero2-x')) - x2)).toBeLessThan(10);
+    // Player 2 walks left with the left arrow; player 1 stays.
+    const y1 = await settled(page, 'data-hero-x');
+    await page.keyboard.down('ArrowLeft');
+    await expect.poll(() => num(page, 'data-hero2-x')).toBeLessThan(x2 - 40);
+    await page.keyboard.up('ArrowLeft');
+    await settled(page, 'data-hero2-x');
+    expect(Math.abs((await settled(page, 'data-hero-x')) - y1)).toBeLessThan(10);
+
+    // A level-up: player 1 chooses, then player 2, for the same level.
+    const dialog = levelUp(page);
+    await page.keyboard.down('s');
+    await expect(dialog).toBeVisible({ timeout: 40_000 });
+    await page.keyboard.up('s');
+    await expect(
+      dialog.getByRole('heading', { name: /Level \d+\. Player 1, choose one\./ })
+    ).toBeVisible();
+    const level = (await dialog.getByRole('heading').textContent())?.match(/Level (\d+)/)?.[1];
+    await expect(area(page)).toHaveAttribute('data-chooser', '0');
+    await page.keyboard.press('1');
+    await expect(
+      dialog.getByRole('heading', { name: new RegExp(`Level ${level}\\. Player 2, choose one\\.`) })
+    ).toBeVisible();
+    await expect(area(page)).toHaveAttribute('data-chooser', '1');
+    // A new dialog for the new turn: its name says whose, and focus is in it.
+    await expect(page.getByRole('dialog', { name: /Player 2, choose one/ })).toBeVisible();
+    await expect(dialog.getByRole('button').first()).toBeFocused();
+    await page.keyboard.press('1');
+    // Then the run goes on (taking any further level's choices, each in turn).
+    await expect
+      .poll(async () => {
+        await playOn(page);
+        return area(page).getAttribute('data-screen');
+      })
+      .toBe('playing');
+  });
+
   test('a run gathers tufts of fur, kept after a reload', async ({ page }) => {
     test.setTimeout(60_000);
     await openArena(page, '?seed=7&speed=10');
diff --git a/tests/unit/xenocats/coop.test.ts b/tests/unit/xenocats/coop.test.ts
new file mode 100644
index 0000000..2784d47
--- /dev/null
+++ b/tests/unit/xenocats/coop.test.ts
@@ -0,0 +1,250 @@
+import { describe, expect, it } from 'vitest';
+import { ARENA_CONFIG, type ArenaConfig, createArena } from '@/app/ui/xenocats/arena';
+import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
+import { createRandom } from '@/app/ui/xenocats/random';
+import { PLAYER_KEYS, walkDirection } from '@/app/ui/xenocats/walking';
+
+const viewport = { width: 1280, height: 800 };
+const still = { x: 0, y: 0 };
+const right = { x: 1, y: 0 };
+const left = { x: -1, y: 0 };
+
+/** Two Keepers; no cats unless asked; nothing wears them down unless asked. */
+function coop(config: Partial<ArenaConfig> = {}, seed = 1) {
+  return createArena({
+    random: createRandom(seed),
+    types: CAT_TYPES,
+    viewport,
+    config: {
+      hero: { ...ARENA_CONFIG.hero, resolve: 1e12 },
+      secondPlayer: { startingWeapons: ['spray-bottle'], speed: 210, resolve: 1e12 },
+      escalation: [[0, 0]],
+      schedule: {
+        arrivals: [{ from: 0, who: 'xenocat', weight: 1 }],
+        swarms: { from: Infinity, everyMs: 1, size: [0, 0] },
+        bosses: [],
+      },
+      chestReach: -1,
+      secretCat: { afterMs: Infinity, stillMs: 0 },
+      ...config,
+    },
+  });
+}
+
+const run = (a: ReturnType<typeof coop>, ms: number, input = still, input2 = still) => {
+  const until = a.state().time + ms;
+  while (a.state().time < until) a.step(input, true, input2);
+};
+
+describe('two players at one keyboard', () => {
+  it('player 1 walks with WASD, player 2 with the arrow keys', () => {
+    expect(walkDirection(['KeyD', 'ArrowLeft'], PLAYER_KEYS[0])).toEqual({ x: 1, y: 0 });
+    expect(walkDirection(['KeyD', 'ArrowLeft'], PLAYER_KEYS[1])).toEqual({ x: -1, y: 0 });
+    expect(walkDirection(['ArrowUp'], PLAYER_KEYS[0])).toEqual({ x: 0, y: 0 });
+    expect(walkDirection(['KeyW'], PLAYER_KEYS[1])).toEqual({ x: 0, y: 0 });
+    // Alone, either set walks him.
+    expect(walkDirection(['ArrowUp'])).toEqual({ x: 0, y: -1 });
+  });
+
+  it('each input walks its own Keeper', () => {
+    const a = coop();
+    const [one, two] = a.state().heroes;
+    run(a, 1000, right, still);
+    const [one1, two1] = a.state().heroes;
+    expect(one1.x).toBeGreaterThan(one.x + 150);
+    expect(two1.x).toBe(two.x);
+    run(a, 1000, still, { x: 0, y: 1 });
+    const [one2, two2] = a.state().heroes;
+    expect(one2.x).toBe(one1.x);
+    expect(two2.y).toBeGreaterThan(two1.y + 150);
+  });
+
+  it('each starts with his own weapon', () => {
+    const a = coop();
+    expect(a.state().heroes.map((h) => h.weapons.map((w) => w.id))).toEqual([
+      ['laser-pointer'],
+      ['spray-bottle'],
+    ]);
+  });
+
+  it('alone, there is one Keeper and the camera is on him, unzoomed', () => {
+    const a = createArena({ random: createRandom(1), types: CAT_TYPES, viewport });
+    expect(a.state().heroes).toHaveLength(1);
+    a.step(right);
+    const { x, y } = a.state().hero;
+    expect(a.camera()).toEqual({ x, y, zoom: 1 });
+  });
+});
+
+describe('the shared camera and the tether', () => {
+  it('keeps both in view: between them, zooming out as they part, up to its limit', () => {
+    const a = coop();
+    expect(a.camera().zoom).toBe(1);
+    let last = 1;
+    // They walk apart.
+    for (let i = 0; i < 20; i++) {
+      run(a, 500, left, right);
+      const [p, q] = a.state().heroes;
+      const cam = a.camera();
+      expect(cam.x).toBeCloseTo((p.x + q.x) / 2);
+      expect(cam.zoom).toBeGreaterThanOrEqual(last);
+      expect(cam.zoom).toBeLessThanOrEqual(ARENA_CONFIG.coop.maxZoomOut);
+      // Both on the screen the camera shows.
+      const half = (viewport.width * cam.zoom) / 2;
+      expect(Math.abs(p.x - cam.x)).toBeLessThanOrEqual(half);
+      expect(Math.abs(q.x - cam.x)).toBeLessThanOrEqual(half);
+      last = cam.zoom;
+    }
+    expect(last).toBe(ARENA_CONFIG.coop.maxZoomOut);
+  });
+
+  it('if the window shrinks while they are far apart, nobody jumps; they only cannot part further', () => {
+    const a = coop();
+    run(a, 20_000, left, right);
+    const [p, q] = a.state().heroes;
+    a.resize({ width: 800, height: 600 });
+    a.step(still, true, still);
+    const [p1, q1] = a.state().heroes;
+    expect(p1.x).toBe(p.x);
+    expect(q1.x).toBe(q.x);
+    run(a, 1000, left, right);
+    const [p2, q2] = a.state().heroes;
+    expect(q2.x - p2.x).toBeCloseTo(q.x - p.x, 6);
+    // Together again, freely.
+    run(a, 1000, right, left);
+    expect(a.state().heroes[1].x - a.state().heroes[0].x).toBeLessThan(q.x - p.x - 300);
+  });
+
+  it('beyond the widest view, neither can walk further from the other', () => {
+    const a = coop();
+    run(a, 20_000, left, right);
+    const [p, q] = a.state().heroes;
+    const span = viewport.width * ARENA_CONFIG.coop.maxZoomOut - 2 * ARENA_CONFIG.coop.margin;
+    expect(q.x - p.x).toBeCloseTo(span, 0);
+    // Walking back together is free.
+    run(a, 1000, right, left);
+    const [p2, q2] = a.state().heroes;
+    expect(q2.x - p2.x).toBeLessThan(span - 300);
+  });
+});
+
+describe('shared experience, own choices', () => {
+  /** Cats that give experience, Keepers that send them home. */
+  function levelling() {
+    return coop({ escalation: [[0, 30]], hero: { ...ARENA_CONFIG.hero, resolve: 1e12 } });
+  }
+
+  it('at a level-up player 1 chooses, then player 2; each choice is his own', () => {
+    const a = levelling();
+    while (!a.choices() && a.state().time < 60_000) a.step(still, true, still);
+    expect(a.choices()).not.toBeNull();
+    const level = a.choiceLevel();
+    expect(a.chooser()).toBe(0);
+    expect(a.state().chooser).toBe(0);
+    // Player 1's offer is his: never the Laser Pointer as new (he has it).
+    const first = a.choices()!;
+    const pick1 = first.findIndex((c) => c.kind === 'weapon' || c.kind === 'passive');
+    const chosen1 = first[pick1];
+    a.choose(pick1);
+    // The run still waits: now player 2, for the same level.
+    expect(a.choices()).not.toBeNull();
+    expect(a.chooser()).toBe(1);
+    expect(a.choiceLevel()).toBe(level);
+    const second = a.choices()!;
+    const pick2 = second.findIndex((c) => c.kind === 'weapon' || c.kind === 'passive');
+    const chosen2 = second[pick2];
+    a.choose(pick2);
+    expect(a.chooser()).toBe(0);
+    // Each got his own.
+    const [h1, h2] = a.state().heroes;
+    const has = (h: typeof h1, c: typeof chosen1) =>
+      c.kind !== 'weapon' || h.weapons.some((w) => w.id === c.id && w.level === c.level);
+    expect(has(h1, chosen1)).toBe(true);
+    expect(has(h2, chosen2)).toBe(true);
+    if (chosen1.kind === 'weapon' && (chosen2.kind !== 'weapon' || chosen1.id !== chosen2.id)) {
+      expect(h2.weapons.some((w) => w.id === chosen1.id)).toBe(false);
+    }
+  });
+
+  it('one experience bar: either Keeper gathering raises the same level', () => {
+    const a = levelling();
+    let levels = 0;
+    while (a.state().time < 40_000) {
+      if (a.choices()) {
+        a.choose(0);
+        continue;
+      }
+      a.step(still, true, still);
+      levels = a.state().level;
+    }
+    expect(levels).toBeGreaterThan(1);
+    expect(a.state().heroes).toHaveLength(2);
+  });
+});
+
+describe('downed and revived', () => {
+  /** Player 2 is frail, player 1 is not; cats come. */
+  function frailTwo(reviveMs = ARENA_CONFIG.coop.reviveMs) {
+    return coop({
+      escalation: [[0, 40]],
+      secondPlayer: { startingWeapons: [], speed: 210, resolve: 5 },
+      coop: { ...ARENA_CONFIG.coop, reviveMs },
+      gems: { ...ARENA_CONFIG.gems, value: 0, eliteValue: 0 },
+    });
+  }
+
+  it('a Keeper whose Resolve is spent is down; if the other lasts 30 s, he stands again', () => {
+    const a = frailTwo();
+    const events: { kind: string; player?: number; at: number }[] = [];
+    while (a.state().time < 90_000 && !events.some((e) => e.kind === 'revived')) {
+      a.step(still, true, still);
+      for (const e of a.drainEvents()) {
+        if (e.kind === 'downed' || e.kind === 'revived') events.push({ ...e, at: a.state().time });
+      }
+      if (events.length === 1) {
+        // While he is down: he does not move, and the run goes on.
+        expect(a.state().heroes[1].down).toBe(true);
+        expect(a.state().status).toBe('playing');
+      }
+    }
+    expect(events.map((e) => [e.kind, e.player])).toEqual([
+      ['downed', 1],
+      ['revived', 1],
+    ]);
+    expect(events[1].at - events[0].at).toBeGreaterThanOrEqual(ARENA_CONFIG.coop.reviveMs);
+    expect(events[1].at - events[0].at).toBeLessThan(ARENA_CONFIG.coop.reviveMs + 50);
+    const back = a.state().heroes[1];
+    expect(back.down).toBe(false);
+    expect(back.resolve).toBe(back.maxResolve / 2);
+  });
+
+  it('a downed Keeper does not walk', () => {
+    const a = frailTwo();
+    while (!a.state().heroes[1].down && a.state().time < 60_000) a.step(still, true, still);
+    expect(a.state().heroes[1].down).toBe(true);
+    const at = a.state().heroes[1].x;
+    run(a, 1000, still, right);
+    expect(a.state().heroes[1].x).toBe(at);
+  });
+
+  it('the run ends when both are down; the results know both', () => {
+    const a = coop({
+      escalation: [[0, 60]],
+      hero: { ...ARENA_CONFIG.hero, resolve: 5 },
+      startingWeapons: [],
+      secondPlayer: { startingWeapons: [], speed: 210, resolve: 5 },
+    });
+    const kinds: string[] = [];
+    while (a.state().status !== 'over' && a.state().time < 120_000) {
+      a.step(still, true, still);
+      for (const e of a.drainEvents())
+        if (e.kind === 'downed' || e.kind === 'over') kinds.push(e.kind);
+    }
+    expect(a.state().status).toBe('over');
+    expect(a.state().outcome).toBe('spent');
+    // One went down first (or both at once); the run ended with both down.
+    expect(kinds.at(-1)).toBe('over');
+    expect(kinds.filter((k) => k === 'downed').length).toBeGreaterThanOrEqual(1);
+    expect(a.state().heroes.every((h) => h.down)).toBe(true);
+  });
+});
diff --git a/tests/unit/xenocats/progression.test.ts b/tests/unit/xenocats/progression.test.ts
index b560d78..6fac5b0 100644
--- a/tests/unit/xenocats/progression.test.ts
+++ b/tests/unit/xenocats/progression.test.ts
@@ -158,6 +158,24 @@ describe('characters', () => {
     expect(buyCharacter(rich(1000), 'night-porter')).toBeNull();
   });
 
+  it('in co-op, player 2 goes out as a character player 1 has, with the Tailor’s work', () => {
+    const progress: Progress = {
+      ...freshProgress(),
+      milestones: ['survive-2'],
+      upgrades: { stubbornness: 1, 'brisk-step': 2 },
+    };
+    expect(runConfig(progress, ARENA_CONFIG).secondPlayer).toBeNull();
+    expect(runConfig(progress, ARENA_CONFIG, 'night-porter').secondPlayer).toEqual({
+      startingWeapons: ['spray-bottle'],
+      resolve: ARENA_CONFIG.hero.resolve - 15 + 10,
+      speed: ARENA_CONFIG.hero.speed * 1.12 * 1.08,
+    });
+    // One player 1 does not have: the Keeper instead.
+    expect(runConfig(progress, ARENA_CONFIG, 'housekeeper').secondPlayer!.startingWeapons).toEqual([
+      'laser-pointer',
+    ]);
+  });
+
   it('only one he has can be chosen, and he starts with that one’s weapon and bias', () => {
     expect(chooseCharacter(freshProgress(), 'night-porter').character).toBe('keeper');
     const porter = chooseCharacter(
~~~~

</details>

#### Checkpoint 2 — `night-2026-10-07-c2-checkpoint`

Checkpoint 2: co-op tests (downed Keeper, chest opener, teleport tether), the start-screen panel and drawings tested; the camera once a step; stale comments. Why: the plan's checkpoint (D72–D73).

<details><summary>Code: 7 files changed, 253 insertions(+), 62 deletions(-)</summary>

~~~~diff
diff --git a/app/ui/xenocats/arena-art.ts b/app/ui/xenocats/arena-art.ts
index a69e380..48a6b14 100644
--- a/app/ui/xenocats/arena-art.ts
+++ b/app/ui/xenocats/arena-art.ts
@@ -1,6 +1,7 @@
 // The Survival arena's own artwork, drawn by the run as SVG in the site's palette
-// (tailwind.config.ts): the hero, the Keeper. A placeholder until a Superdesign pass.
-// The cats are the twenty xenocat types' own artwork (cat-art.ts), unchanged.
+// (tailwind.config.ts): the heroes (the Keeper and the characters re-dressed) and
+// the varieties of cat. Placeholders until a Superdesign pass. The twenty xenocat
+// types keep their own artwork (cat-art.ts), unchanged.
 
 import type { VarietyId } from './varieties';
 
@@ -48,9 +49,6 @@ export const HERO_SVGS = {
   }),
 } as const;
 
-/** The Keeper. */
-export const HERO_SVG = HERO_SVGS.keeper;
-
 /**
  * A sitting cat, front on, in a 64×64 box: body, head, ears, eyes, a tail; `extra`
  * is drawn on top (stripes, a box, a glow). Each variety its own colours.
diff --git a/app/ui/xenocats/arena-view.tsx b/app/ui/xenocats/arena-view.tsx
index 0097259..0cd3536 100644
--- a/app/ui/xenocats/arena-view.tsx
+++ b/app/ui/xenocats/arena-view.tsx
@@ -5,7 +5,7 @@ import { Button } from '@/app/ui/button';
 import { type Arena, ARENA_CONFIG, type ArenaOutcome, BLADE_RADIUS, createArena } from './arena';
 import { HERO_SVGS, VARIETY_SVG } from './arena-art';
 import { type Choice, WEAPONS, type WeaponId, describeChoice, evolutionText } from './arsenal';
-import { SURVIVAL_BEST_KEY, bestOf, clockText, readBest, writeBest } from './arena-storage';
+import { bestOf, clockText, readBest, writeBest } from './arena-storage';
 import { catArt } from './cat-art';
 import { CAT_TYPES } from './cat-types';
 import { recordStat } from './field-guide';
@@ -928,7 +928,6 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
           data-hero2-x={hud?.heroes[1]?.x ?? ''}
           data-hero2-y={hud?.heroes[1]?.y ?? ''}
           data-down={hud?.heroes.map((h) => (h.down ? 1 : 0)).join(' ') ?? ''}
-          data-best-key={SURVIVAL_BEST_KEY}
           className="fixed inset-0 z-[9998] select-none overflow-hidden bg-void outline-none"
         >
           <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
diff --git a/app/ui/xenocats/arena.ts b/app/ui/xenocats/arena.ts
index 1e1b5fd..644e64e 100644
--- a/app/ui/xenocats/arena.ts
+++ b/app/ui/xenocats/arena.ts
@@ -4,19 +4,22 @@
 // seeded run plays out the same every time and is tested in Node. arena-view.tsx
 // draws it.
 //
-// The hero walks an endless arena; the cats of the twenty xenocat types pour in
-// from just off screen on every side and walk at him. Attacks are automatic:
-// positioning is the skill. His weapons (arsenal.ts) fire on their own, starting
-// with the Laser Pointer; every cat they touch grows homesick, and enough
-// Homesickness and a cat is beamed home. Nothing is ever killed. A cat sent home
-// leaves an experience gem; gathered gems bring levels, and each level pauses the
-// run for a choice: a new weapon, a better one, or a passive. A cat that reaches
-// him drains his Resolve (each type its own amount), and he is untouchable for a
-// moment after. A few cats are elites, and also lay their xenocat effect on him
-// (Cryo freezes him, Gravi slows him, Mirror turns his controls round...), one
-// effect at a time. Cats keep coming, more and more, until the frame rate says no
-// more (frame-guard.ts). The run ends when his Resolve is spent, when he gives up,
-// or at the time goal, when the Matriarch comes for him and nothing sends her home.
+// The hero (a Keeper; two in local co-op, each a Keeper record of his own) walks
+// an endless arena; the cats of the twenty xenocat types and the varieties
+// (varieties.ts) pour in from just off screen on every side and walk at the
+// nearest. Attacks are automatic: positioning is the skill. His weapons (arsenal.ts)
+// fire on their own, starting with his character's (progression.ts); every cat
+// they touch grows homesick, and enough Homesickness and a cat is beamed home.
+// Nothing is ever killed. A cat sent home leaves an experience gem; gathered gems
+// bring levels (shared in co-op), and each level pauses the run for a choice (each
+// player in turn): a new weapon, a better one, or a passive. A cat that reaches him
+// drains his Resolve (each type its own amount), and he is untouchable for a moment
+// after. A few cats are elites, and also lay their xenocat effect on him (Cryo
+// freezes him, Gravi slows him, Mirror turns his controls round...), one effect at
+// a time. Cats keep coming, more and more, until the frame rate says no more
+// (frame-guard.ts). The run ends when no Keeper stands (in co-op one is down until
+// the other has lasted long enough), when he gives up, or at the time goal, when
+// the Matriarch comes and nothing sends her home.
 
 import {
   BASE_WEAPONS,
@@ -130,7 +133,13 @@ export type ArenaConfig = {
    */
   secretCat: { afterMs: number; stillMs: number };
   /** A second Keeper (local co-op), with his own weapons, pace and Resolve; or null. */
-  secondPlayer: { startingWeapons: readonly WeaponId[]; speed: number; resolve: number } | null;
+  secondPlayer: {
+    startingWeapons: readonly WeaponId[];
+    speed: number;
+    resolve: number;
+    /** Passives he starts with, at level 1 (a test's way to set up an evolution). */
+    startingPassives?: readonly PassiveId[];
+  } | null;
   coop: {
     /** The two start this far apart, px. */
     startGap: number;
@@ -412,7 +421,12 @@ export function createArena(options: {
   const keepers: Keeper[] = config.secondPlayer
     ? [
         newKeeper(0, { x: -config.coop.startGap / 2, y: 0 }, first, config.startingPassives),
-        newKeeper(1, { x: config.coop.startGap / 2, y: 0 }, config.secondPlayer, []),
+        newKeeper(
+          1,
+          { x: config.coop.startGap / 2, y: 0 },
+          config.secondPlayer,
+          config.secondPlayer.startingPassives ?? []
+        ),
       ]
     : [newKeeper(0, { x: 0, y: 0 }, first, config.startingPassives)];
   /** The Keeper being dealt with now: whose walk, weapons and touch. */
@@ -609,10 +623,7 @@ export function createArena(options: {
    * again: just off the screen if it walks, on it if it sits. So the horde stays
    * where he is, and none counts for nothing.
    */
-  function bringBack(cat: ArenaCat) {
-    const cam = camera();
-    const far =
-      ((Math.hypot(viewport.width, viewport.height) / 2) * cam.zoom + config.cats.spawnMargin) * 2;
+  function bringBack(cat: ArenaCat, cam: { x: number; y: number }, far: number) {
     if (Math.hypot(cat.x - cam.x, cat.y - cam.y) <= far + cat.radius) return;
     const sits = cat.variety !== null && VARIETIES[cat.variety].gait === 'sit';
     const at = sits ? onScreen(200) : offScreen(random.next() * 2 * Math.PI, cat.radius);
@@ -715,8 +726,11 @@ export function createArena(options: {
       else if (kind.way === 'fixed') way = { x: Math.cos(angle), y: Math.sin(angle) };
     }
     if (kind.kind === 'jump') {
+      const from = { x: hero.x, y: hero.y };
       hero.x += Math.cos(angle) * kind.distance;
       hero.y += Math.sin(angle) * kind.distance;
+      // In co-op, not out of the other's sight.
+      tether(hero, from);
     }
     hero.effect = { effect: kind, until, from: { x: cat.x, y: cat.y }, way };
   }
@@ -1233,8 +1247,9 @@ export function createArena(options: {
 
     /**
      * One step of `config.stepMs`: the hero walks the way `input` points (a unit
-     * vector, or zero), cats come (while `spawn` allows), walk, reach him or are
-     * sent home. Nothing moves while a level-up's choice waits.
+     * vector, or zero), and in co-op player 2 the way `input2` does; cats come
+     * (while `spawn` allows), walk, reach them or are sent home. Nothing moves while
+     * a level-up's choice waits.
      */
     step(input: Vec, spawn = true, input2: Vec = { x: 0, y: 0 }) {
       if (status === 'over' || choosing) return;
@@ -1284,10 +1299,15 @@ export function createArena(options: {
       // The few big cats (bigger than the cats' size) are kept apart, so every
       // search looks a cat's size further, not the biggest one's.
       bigCats.length = 0;
+      // How far is too far behind: once a step, not once a cat.
+      const cam = camera();
+      const far =
+        ((Math.hypot(viewport.width, viewport.height) / 2) * cam.zoom + config.cats.spawnMargin) *
+        2;
       for (let i = 0; i < cats.length; i++) {
         const cat = cats[i];
         moveCat(cat, dt);
-        bringBack(cat);
+        bringBack(cat, cam, far);
         if (cat.radius > config.cats.radius) bigCats.push(i);
         else grid.insert(i, cat.x, cat.y);
       }
@@ -1494,6 +1514,7 @@ export function createArena(options: {
           /** How long until a downed Keeper stands again, ms (0 while he stands). */
           backIn: k.downedAt === null ? 0 : Math.max(k.downedAt + config.coop.reviveMs - time, 0),
           weapons: [...k.weapons].map(([id, held]) => ({ id, level: held.level })),
+          passives: [...k.passives].map(([id, l]) => ({ id, level: l })),
         })),
         chooser,
         cats: cats.length,
diff --git a/app/ui/xenocats/player-sprite.tsx b/app/ui/xenocats/player-sprite.tsx
index 438ee99..2062ae0 100644
--- a/app/ui/xenocats/player-sprite.tsx
+++ b/app/ui/xenocats/player-sprite.tsx
@@ -1,10 +1,10 @@
 import type { Facing } from './walking';
 
-// The cat ranger of Fight a cat, Survival: a 64×64 astronaut seen from above and a
+// The cat ranger of Taming (fight.tsx): a 64×64 astronaut seen from above and a
 // little in front, in eight facings. The east side is drawn; the west side mirrors
-// it. The gun arm is drawn apart and turns to the exact aim: the game loop rotates
-// the element passed as `gunRef` every frame (gunTransform), so the body re-renders
-// only when the facing changes.
+// it. The gun arm, drawn apart to turn to an exact aim through `gunRef`, was the old
+// Survival's; nothing arms him since Survival became the arena (decisions.md, D27),
+// and Taming draws him empty-handed.
 
 export const PLAYER_SIZE = 64;
 
@@ -62,7 +62,7 @@ export function PlayerSprite({
 }: {
   facing: Facing;
   walking: boolean;
-  /** Carrying the gun (Survival), or empty-handed (Taming). */
+  /** Carrying the gun (no game does since D27), or empty-handed (Taming). */
   armed?: boolean;
   /** The gun the game loop turns; decoys leave it pointing the way they face. */
   gunRef?: React.Ref<HTMLDivElement>;
diff --git a/tests/e2e/survival.spec.ts b/tests/e2e/survival.spec.ts
index 9d8db42..85e541d 100644
--- a/tests/e2e/survival.spec.ts
+++ b/tests/e2e/survival.spec.ts
@@ -301,6 +301,47 @@ test.describe('on a computer', () => {
     await expect(page.getByTestId('survival-tufts')).toHaveText(`Tufts of fur: ${earned}`);
   });
 
+  test('a character he has goes out with his own weapon; the codex shows what was found, ??? the rest', async ({
+    page,
+  }) => {
+    await openArena(page);
+    // A returning player: 2:00 survived (the Night Porter is his), one evolution found.
+    await page.evaluate(() =>
+      localStorage.setItem(
+        'xenocats:survival:v1:progress',
+        JSON.stringify({
+          version: 1,
+          tufts: 0,
+          upgrades: {},
+          milestones: ['survive-2'],
+          bought: [],
+          character: 'keeper',
+          found: ['yarn-apocalypse'],
+        })
+      )
+    );
+    await page.reload();
+    const porter = page.getByTestId('survival-character-night-porter');
+    await expect(porter).toBeEnabled();
+    // Not had: the Housekeeper is locked until engaged.
+    await expect(page.getByTestId('survival-character-housekeeper')).toBeDisabled();
+    // A click before hydration is lost: choose until chosen.
+    await expect
+      .poll(async () => {
+        await porter.check();
+        return porter.isChecked();
+      })
+      .toBe(true);
+    const codex = page.getByTestId('survival-codex');
+    await expect(codex.getByText('Yarn Apocalypse')).toBeVisible();
+    await expect(codex.getByRole('listitem').filter({ hasText: '???' })).toHaveCount(4);
+    // Kept after a reload; he goes out as the Night Porter, with the Spray Bottle.
+    await page.reload();
+    await expect(porter).toBeChecked();
+    await startRun(page);
+    await expect(area(page)).toHaveAttribute('data-weapons', 'spray-bottle:1');
+  });
+
   test('the Tailor sells an upgrade for tufts; the next run begins with it', async ({ page }) => {
     await openArena(page);
     // Tufts from earlier nights.
diff --git a/tests/unit/xenocats/coop.test.ts b/tests/unit/xenocats/coop.test.ts
index 2784d47..f63b559 100644
--- a/tests/unit/xenocats/coop.test.ts
+++ b/tests/unit/xenocats/coop.test.ts
@@ -141,44 +141,87 @@ describe('shared experience, own choices', () => {
     const level = a.choiceLevel();
     expect(a.chooser()).toBe(0);
     expect(a.state().chooser).toBe(0);
-    // Player 1's offer is his: never the Laser Pointer as new (he has it).
-    const first = a.choices()!;
-    const pick1 = first.findIndex((c) => c.kind === 'weapon' || c.kind === 'passive');
-    const chosen1 = first[pick1];
-    a.choose(pick1);
+    const arsenal = (i: number) => {
+      const h = a.state().heroes[i];
+      return JSON.stringify([h.weapons, h.passives]);
+    };
+    // Player 1 chooses: his arsenal changes, player 2's does not.
+    const one = arsenal(0);
+    const two = arsenal(1);
+    a.choose(a.choices()!.findIndex((c) => c.kind !== 'restore'));
+    expect(arsenal(0)).not.toBe(one);
+    expect(arsenal(1)).toBe(two);
     // The run still waits: now player 2, for the same level.
     expect(a.choices()).not.toBeNull();
     expect(a.chooser()).toBe(1);
     expect(a.choiceLevel()).toBe(level);
-    const second = a.choices()!;
-    const pick2 = second.findIndex((c) => c.kind === 'weapon' || c.kind === 'passive');
-    const chosen2 = second[pick2];
-    a.choose(pick2);
+    const oneAfter = arsenal(0);
+    a.choose(a.choices()!.findIndex((c) => c.kind !== 'restore'));
+    expect(arsenal(1)).not.toBe(two);
+    expect(arsenal(0)).toBe(oneAfter);
     expect(a.chooser()).toBe(0);
-    // Each got his own.
-    const [h1, h2] = a.state().heroes;
-    const has = (h: typeof h1, c: typeof chosen1) =>
-      c.kind !== 'weapon' || h.weapons.some((w) => w.id === c.id && w.level === c.level);
-    expect(has(h1, chosen1)).toBe(true);
-    expect(has(h2, chosen2)).toBe(true);
-    if (chosen1.kind === 'weapon' && (chosen2.kind !== 'weapon' || chosen1.id !== chosen2.id)) {
-      expect(h2.weapons.some((w) => w.id === chosen1.id)).toBe(false);
+  });
+
+  it('one experience bar: what player 2 alone gathers raises the level they share', () => {
+    // Player 1 has no weapon and stands far off; only player 2 sends cats home,
+    // so every gem falls nearer him.
+    const a = coop({
+      escalation: [[0, 30]],
+      startingWeapons: [],
+      secondPlayer: { startingWeapons: ['laser-pointer'], speed: 210, resolve: 1e12 },
+    });
+    run(a, 10_000, left, still);
+    const sentBefore = a.state().sentHome;
+    while (a.state().time < 60_000 && a.state().level === 1 && !a.choices()) {
+      a.step(still, true, still);
     }
+    expect(a.state().sentHome).toBeGreaterThan(sentBefore);
+    expect(a.state().level).toBeGreaterThan(1);
+    // Player 1, far off, gathered none of it himself.
+    const [p, q] = a.state().heroes;
+    expect(q.x - p.x).toBeGreaterThan(1500);
   });
 
-  it('one experience bar: either Keeper gathering raises the same level', () => {
-    const a = levelling();
-    let levels = 0;
-    while (a.state().time < 40_000) {
+  it('a chest evolves the weapon of the Keeper who opens it', () => {
+    // Player 2 is ready to evolve (Laser Pointer 8 + Battery); player 1 is not.
+    const a = coop({
+      escalation: [[0, 20]],
+      startingLevel: 8,
+      secondPlayer: {
+        startingWeapons: ['laser-pointer'],
+        speed: 210,
+        resolve: 1e12,
+        startingPassives: ['battery'],
+      },
+      chestReach: 36,
+      cats: { ...ARENA_CONFIG.cats, eliteShare: 1 },
+      gems: { ...ARENA_CONFIG.gems, value: 0, eliteValue: 0 },
+    });
+    let evolved: { from: string; to: string } | null = null;
+    while (!evolved && a.state().time < 120_000) {
       if (a.choices()) {
+        // Player 1 opened one: a level-up, not an evolution. Take it and go on.
         a.choose(0);
         continue;
       }
-      a.step(still, true, still);
-      levels = a.state().level;
+      // Player 2 walks to the nearest chest; player 1 stands.
+      const me = a.state().heroes[1];
+      const [chest] = [...a.chests()].sort(
+        (u, v) => Math.hypot(u.x - me.x, u.y - me.y) - Math.hypot(v.x - me.x, v.y - me.y)
+      );
+      let input2 = still;
+      if (chest) {
+        const d = Math.hypot(chest.x - me.x, chest.y - me.y) || 1;
+        input2 = { x: (chest.x - me.x) / d, y: (chest.y - me.y) / d };
+      }
+      a.step(still, true, input2);
+      for (const e of a.drainEvents()) if (e.kind === 'evolution') evolved = e;
     }
-    expect(levels).toBeGreaterThan(1);
-    expect(a.state().heroes).toHaveLength(2);
+    expect(evolved).toEqual({ kind: 'evolution', from: 'laser-pointer', to: 'infinite-laser' });
+    const [h1, h2] = a.state().heroes;
+    expect(h2.weapons.map((w) => w.id)).toContain('infinite-laser');
+    expect(h1.weapons.map((w) => w.id)).toContain('laser-pointer');
+    expect(h1.weapons.map((w) => w.id)).not.toContain('infinite-laser');
   });
 });
 
@@ -218,13 +261,83 @@ describe('downed and revived', () => {
     expect(back.resolve).toBe(back.maxResolve / 2);
   });
 
-  it('a downed Keeper does not walk', () => {
-    const a = frailTwo();
+  it('a downed Keeper does not walk, fire or get touched; the cats walk at the other', () => {
+    // Player 1 has no weapon (every firing is player 2's); player 2 is frail.
+    const a = coop({
+      escalation: [[0, 40]],
+      startingWeapons: [],
+      secondPlayer: { startingWeapons: ['laser-pointer'], speed: 210, resolve: 5 },
+      gems: { ...ARENA_CONFIG.gems, value: 0, eliteValue: 0 },
+    });
+    // Player 1 walks off a way, so the two are well apart.
+    run(a, 3000, left, still);
     while (!a.state().heroes[1].down && a.state().time < 60_000) a.step(still, true, still);
     expect(a.state().heroes[1].down).toBe(true);
+    a.drainEvents();
     const at = a.state().heroes[1].x;
-    run(a, 1000, still, right);
+    let checked = 0;
+    // A while down (less than the 30 s it takes him to stand again).
+    for (let n = 0; n < 600; n++) {
+      const before = new Map(a.cats().map((c) => [c.id, { x: c.x, y: c.y }]));
+      a.step(still, true, right);
+      for (const e of a.drainEvents()) {
+        expect(e.kind, 'fired while down').not.toBe('fired');
+        if (e.kind === 'hero-hit') expect(e.player).toBe(0);
+      }
+      const [p] = a.state().heroes;
+      for (const cat of a.cats()) {
+        const was = before.get(cat.id);
+        if (!was) continue;
+        const dx = cat.x - was.x;
+        const dy = cat.y - was.y;
+        const moved = Math.hypot(dx, dy);
+        // (A cat brought round from far behind jumps: not a walk.)
+        if (moved === 0 || moved > 10) continue;
+        // It walked towards player 1, not the one lying down.
+        const tx = p.x - was.x;
+        const ty = p.y - was.y;
+        expect((dx * tx + dy * ty) / (moved * Math.hypot(tx, ty))).toBeGreaterThan(0.99);
+        checked++;
+      }
+    }
+    expect(a.state().heroes[1].down).toBe(true);
     expect(a.state().heroes[1].x).toBe(at);
+    expect(checked).toBeGreaterThan(100);
+  });
+
+  it('a teleporting elite cannot carry a Keeper beyond the tether', () => {
+    const teleporters = CAT_TYPES.filter((t) => t.effect.id === 'teleport');
+    expect(teleporters.length).toBeGreaterThan(0);
+    const a = createArena({
+      random: createRandom(3),
+      types: teleporters,
+      viewport,
+      config: {
+        hero: { ...ARENA_CONFIG.hero, resolve: 1e12 },
+        startingWeapons: [],
+        secondPlayer: { startingWeapons: [], speed: 210, resolve: 1e12 },
+        escalation: [[0, 30]],
+        cats: { ...ARENA_CONFIG.cats, eliteShare: 1 },
+        schedule: {
+          arrivals: [{ from: 0, who: 'xenocat', weight: 1 }],
+          swarms: { from: Infinity, everyMs: 1, size: [0, 0] },
+          bosses: [],
+        },
+        secretCat: { afterMs: Infinity, stillMs: 0 },
+      },
+    });
+    const span = viewport.width * ARENA_CONFIG.coop.maxZoomOut - 2 * ARENA_CONFIG.coop.margin;
+    const spanY = viewport.height * ARENA_CONFIG.coop.maxZoomOut - 2 * ARENA_CONFIG.coop.margin;
+    let jumps = 0;
+    while (a.state().time < 60_000) {
+      // They keep trying to part, as far as they may.
+      a.step(left, true, right);
+      for (const e of a.drainEvents()) if (e.kind === 'hero-hit' && e.elite) jumps++;
+      const [p, q] = a.state().heroes;
+      expect(Math.abs(q.x - p.x)).toBeLessThanOrEqual(span + 1e-6);
+      expect(Math.abs(q.y - p.y)).toBeLessThanOrEqual(spanY + 1e-6);
+    }
+    expect(jumps).toBeGreaterThan(3);
   });
 
   it('the run ends when both are down; the results know both', () => {
diff --git a/tests/unit/xenocats/varieties.test.ts b/tests/unit/xenocats/varieties.test.ts
index 7b9486f..4753292 100644
--- a/tests/unit/xenocats/varieties.test.ts
+++ b/tests/unit/xenocats/varieties.test.ts
@@ -5,6 +5,7 @@ import {
   type ArenaConfig,
   createArena,
 } from '@/app/ui/xenocats/arena';
+import { HERO_SVGS, VARIETY_SVG } from '@/app/ui/xenocats/arena-art';
 import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
 import { createRandom } from '@/app/ui/xenocats/random';
 import {
@@ -373,3 +374,21 @@ describe('the Mega Cat', () => {
     expect(a.state().level).toBe(level);
   }, 60_000);
 });
+
+describe('the drawings', () => {
+  it('every variety and every hero has a whole SVG, every colour filled in', () => {
+    const drawings = [
+      ...(Object.keys(VARIETIES) as VarietyId[]).map((id) => [id, VARIETY_SVG[id]] as const),
+      ...Object.entries(HERO_SVGS),
+    ];
+    expect(drawings.length).toBe(Object.keys(VARIETIES).length + 3);
+    for (const [id, svg] of drawings) {
+      expect(svg, id).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*>/);
+      expect(svg.trimEnd(), id).toMatch(/<\/svg>$/);
+      // A colour or shape left out of a template reads "undefined".
+      expect(svg, id).not.toContain('undefined');
+      // Every attribute's quotes are closed.
+      expect((svg.match(/"/g) ?? []).length % 2, id).toBe(0);
+    }
+  });
+});
~~~~

</details>

#### T12 item 1 — `night-2026-10-07-t12-1-comforter`

The Purring Cat: a variety that comforts the cats around it (`soothe` in `arena.ts`). Why: task 12, the Survival game (D74–D76).

<details><summary>Code: 5 files changed, 151 insertions(+), 5 deletions(-)</summary>

~~~~diff
diff --git a/app/ui/xenocats/arena-art.ts b/app/ui/xenocats/arena-art.ts
index 48a6b14..5c63e03 100644
--- a/app/ui/xenocats/arena-art.ts
+++ b/app/ui/xenocats/arena-art.ts
@@ -115,6 +115,13 @@ export const VARIETY_SVG: Readonly<Record<VarietyId, string>> = {
     eyes: AURA,
     under: `<circle cx="32" cy="34" r="27" fill="${AURA}" opacity="0.18"/>`,
   }),
+  // A long-haired cream cat, eyes closed, purring (the arcs).
+  comforter: catSvg({
+    fur: '#efe3c8',
+    belly: '#fbf5e6',
+    eyes: '#5b4a2e',
+    extra: `<ellipse cx="27" cy="25" rx="3.2" ry="3.6" fill="#efe3c8"/><ellipse cx="37" cy="25" rx="3.2" ry="3.6" fill="#efe3c8"/><path d="M24 25.5 Q27 27.5 30 25.5 M34 25.5 Q37 27.5 40 25.5" stroke="#5b4a2e" stroke-width="1.6" fill="none"/><path d="M48 14 Q52 18 48 22 M52 10 Q58 18 52 26" stroke="${AURA}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.8"/>`,
+  }),
   // The secret cat: a tuxedo, with someone else's collar.
   neighbour: catSvg({
     fur: '#1b1d2b',
diff --git a/app/ui/xenocats/arena-view.tsx b/app/ui/xenocats/arena-view.tsx
index 0cd3536..da97fbf 100644
--- a/app/ui/xenocats/arena-view.tsx
+++ b/app/ui/xenocats/arena-view.tsx
@@ -434,6 +434,21 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
       }
       context.stroke();
 
+      // The Purring Cats' comfort: a faint warm halo as far as it reaches (to a
+      // cat's edge), under everything else so the gems and chests stay clear.
+      context.fillStyle = 'rgba(239, 227, 200, 0.07)';
+      for (const cat of arena.cats()) {
+        const soothes = cat.variety ? VARIETIES[cat.variety].soothes : undefined;
+        if (!soothes) continue;
+        const reach = soothes.radius + arena.config.cats.radius;
+        const x = cat.x - camX;
+        const y = cat.y - camY;
+        if (x < -reach || y < -reach || x > width + reach || y > height + reach) continue;
+        context.beginPath();
+        context.arc(x, y, reach, 0, 2 * Math.PI);
+        context.fill();
+      }
+
       // The Thunderous Vacuum's reach, and the gems lying about.
       for (const zone of arena.zones()) {
         context.fillStyle = `rgba(157, 134, 255, ${0.1 + 0.04 * Math.sin(time / 180)})`;
diff --git a/app/ui/xenocats/arena.ts b/app/ui/xenocats/arena.ts
index 644e64e..9894140 100644
--- a/app/ui/xenocats/arena.ts
+++ b/app/ui/xenocats/arena.ts
@@ -798,6 +798,30 @@ export function createArena(options: {
     cat.y += (dy / d) * stepLength;
   }
 
+  /** Indices of this step's Purring Cats (varieties that soothe). */
+  const soothers: number[] = [];
+
+  /**
+   * Every Purring Cat comforts the cats around it: each within its reach (itself
+   * and other Purring Cats aside) loses a little Homesickness, never below none.
+   */
+  function soothe(dt: number) {
+    soothers.length = 0;
+    for (let i = 0; i < cats.length; i++) {
+      const variety = cats[i].variety;
+      if (variety !== null && VARIETIES[variety].soothes) soothers.push(i);
+    }
+    for (const i of soothers) {
+      const purring = cats[i];
+      const { radius, perSecond } = VARIETIES[purring.variety!].soothes!;
+      for (const j of within(purring, radius)) {
+        const cat = cats[j];
+        if (cat.variety !== null && VARIETIES[cat.variety].soothes) continue;
+        cat.homesickness = Math.max(cat.homesickness - perSecond * dt, 0);
+      }
+    }
+  }
+
   /** The Laser Cats' shots fly; one that reaches him drains his Resolve. */
   function moveShots(dt: number) {
     for (let i = shots.length - 1; i >= 0; i--) {
@@ -1312,6 +1336,7 @@ export function createArena(options: {
         else grid.insert(i, cat.x, cat.y);
       }
       moveShots(dt);
+      soothe(dt);
 
       // Reached: one drain per moment for each Keeper, an elite's effect on top.
       for (const k of keepers) {
diff --git a/app/ui/xenocats/varieties.ts b/app/ui/xenocats/varieties.ts
index 3f0a1c3..351de51 100644
--- a/app/ui/xenocats/varieties.ts
+++ b/app/ui/xenocats/varieties.ts
@@ -15,6 +15,7 @@ export type VarietyId =
   | 'laser'
   | 'possessed'
   | 'mega'
+  | 'comforter'
   // Never in the schedule: it comes only when it chooses to (arena.ts, secretCat).
   | 'neighbour';
 
@@ -46,6 +47,8 @@ export type Variety = {
   radius: number;
   /** Weapons of these kinds pass through it. */
   immuneTo?: readonly WeaponKind[];
+  /** It comforts the cats around it: within `radius`, each loses this much Homesickness a second. */
+  soothes?: { radius: number; perSecond: number };
 };
 
 export const VARIETIES: Readonly<Record<VarietyId, Variety>> = {
@@ -131,6 +134,20 @@ export const VARIETIES: Readonly<Record<VarietyId, Variety>> = {
     drain: 25,
     radius: 90,
   },
+  comforter: {
+    name: 'Purring Cat',
+    description: 'It purrs, and the cats around it forget that they wished to go home.',
+    gait: 'walk',
+    speed: 40,
+    homesickness: 260,
+    drain: 3,
+    // The cats' own size, so it stays in the grid (a bigger one is searched always).
+    radius: 16,
+    // Less than the Laser Pointer gives at its first level (about 18 a second), so
+    // one Purring Cat only slows it. Weaker work (the Thunderous Vacuum's first level,
+    // 10) or two Purring Cats together hold a cat back until one is sent home first.
+    soothes: { radius: 140, perSecond: 12 },
+  },
   neighbour: {
     name: 'The Neighbour’s Cat',
     description: 'It sits beside him, as if it had always lived here. It has not.',
@@ -153,8 +170,8 @@ export type Schedule = {
 
 /**
  * Over the five minutes: plain cats and xenocats first, then the zoomies, swarms of
- * kittens, the hissing, boxes, snipers, the fat and the possessed; a Mega Cat at
- * two minutes and again at four.
+ * kittens, the hissing, boxes, snipers, the purring, the fat and the possessed; a
+ * Mega Cat at two minutes and again at four.
  */
 export const SCHEDULE: Schedule = {
   arrivals: [
@@ -164,6 +181,7 @@ export const SCHEDULE: Schedule = {
     { from: 60_000, who: 'hissing', weight: 2 },
     { from: 90_000, who: 'box', weight: 0.4 },
     { from: 120_000, who: 'laser', weight: 1 },
+    { from: 130_000, who: 'comforter', weight: 0.6 },
     { from: 150_000, who: 'fat', weight: 0.8 },
     { from: 180_000, who: 'possessed', weight: 1.2 },
   ],
diff --git a/tests/unit/xenocats/varieties.test.ts b/tests/unit/xenocats/varieties.test.ts
index 4753292..3f5f486 100644
--- a/tests/unit/xenocats/varieties.test.ts
+++ b/tests/unit/xenocats/varieties.test.ts
@@ -291,7 +291,17 @@ describe('the schedule', () => {
         .map((a) => a.who)
         .sort()
     ).toEqual(
-      ['basic', 'box', 'fat', 'hissing', 'laser', 'possessed', 'xenocat', 'zoomies'].sort()
+      [
+        'basic',
+        'box',
+        'comforter',
+        'fat',
+        'hissing',
+        'laser',
+        'possessed',
+        'xenocat',
+        'zoomies',
+      ].sort()
     );
   });
 
@@ -309,8 +319,10 @@ describe('the schedule', () => {
       const seen = first.get(arrival.who);
       expect(seen, arrival.who).toBeDefined();
       expect(seen!, arrival.who).toBeGreaterThanOrEqual(arrival.from);
-      // Within a minute of its window opening (a rare one, or few cats wanted, waits).
-      expect(seen!, arrival.who).toBeLessThan(arrival.from + 60_000);
+      // Soon after its window opens: within a minute, longer for a rare one (a
+      // weight below 1 waits in proportion, at most two minutes).
+      const allowance = Math.min(60_000 / Math.min(arrival.weight, 1), 120_000);
+      expect(seen!, arrival.who).toBeLessThan(arrival.from + allowance);
     }
     expect(first.get('kitten')).toBeGreaterThanOrEqual(SCHEDULE.swarms.from);
     expect(first.get('kitten')).toBeLessThan(SCHEDULE.swarms.from + 1000);
@@ -392,3 +404,72 @@ describe('the drawings', () => {
     }
   });
 });
+
+describe('the Purring Cat', () => {
+  it('comforts the cats around it (several, more): they lose Homesickness, the rest keep theirs; no Purring Cat soothes another', () => {
+    // The Vacuum Cleaner hurts only when it fires (every 3.2 s): between firings,
+    // only the purring changes a cat's Homesickness.
+    const purring: Schedule = {
+      arrivals: [
+        { from: 0, who: 'basic', weight: 3 },
+        { from: 0, who: 'comforter', weight: 1 },
+      ],
+      swarms: { from: Infinity, everyMs: 1, size: [0, 0] },
+      bosses: [],
+    };
+    const a = arena({
+      schedule: purring,
+      escalation: [[0, 40]],
+      startingWeapons: ['vacuum-cleaner'],
+    });
+    const { radius, perSecond } = VARIETIES.comforter.soothes!;
+    const dt = a.config.stepMs / 1000;
+    let soothed = 0;
+    let kept = 0;
+    // Seen: a cat in two Purring Cats' reach; a Purring Cat in another's.
+    let doubly = 0;
+    let purringInReach = 0;
+    while (a.state().time < 40_000) {
+      const before = new Map(a.cats().map((c) => [c.id, c.homesickness]));
+      a.step(still);
+      if (a.drainEvents().some((e) => e.kind === 'fired')) continue;
+      const purrers = a.cats().filter((c) => c.variety === 'comforter');
+      for (const cat of a.cats()) {
+        const was = before.get(cat.id);
+        if (was === undefined) continue;
+        if (
+          cat.variety === 'comforter' &&
+          purrers.some(
+            (p) => p !== cat && Math.hypot(p.x - cat.x, p.y - cat.y) <= radius + cat.radius
+          )
+        ) {
+          purringInReach++;
+        }
+        // Each Purring Cat in reach comforts it (several add up).
+        const purringNear =
+          cat.variety === 'comforter'
+            ? 0
+            : purrers.filter((p) => Math.hypot(p.x - cat.x, p.y - cat.y) <= radius + cat.radius)
+                .length;
+        if (purringNear > 0) {
+          expect(cat.homesickness).toBeCloseTo(Math.max(was - purringNear * perSecond * dt, 0), 9);
+          if (was > 0) soothed++;
+          if (was > 0 && purringNear > 1) doubly++;
+        } else {
+          expect(cat.homesickness).toBe(was);
+          if (was > 0) kept++;
+        }
+      }
+    }
+    expect(soothed).toBeGreaterThan(20);
+    expect(kept).toBeGreaterThan(20);
+    expect(doubly).toBeGreaterThan(0);
+    expect(purringInReach).toBeGreaterThan(0);
+  });
+
+  it('comes from 2:10, now and then', () => {
+    const at = SCHEDULE.arrivals.find((a) => a.who === 'comforter')!;
+    expect(at.from).toBe(130_000);
+    expect(at.weight).toBeLessThan(1);
+  });
+});
~~~~

</details>

#### T12 item 2 — `night-2026-10-07-t12-2-due-date`

A due date on the invoice create and edit forms, validated (zod, against the invoice's date, at most a year); `updateInvoice` refuses a non-UUID id. Why: task 12, dashboard features; the 2026-10-01 run's Q4 (D77–D78).

<details><summary>Code: 11 files changed, 351 insertions(+), 23 deletions(-)</summary>

~~~~diff
diff --git a/app/dashboard/invoices/create/page.tsx b/app/dashboard/invoices/create/page.tsx
index 1d3912b..c7b0baf 100644
--- a/app/dashboard/invoices/create/page.tsx
+++ b/app/dashboard/invoices/create/page.tsx
@@ -1,6 +1,7 @@
 import Form from '@/app/ui/invoices/create-form';
 import Breadcrumbs from '@/app/ui/invoices/breadcrumbs';
 import { fetchCustomers } from '@/app/lib/data';
+import { PAYMENT_DAYS, addDays } from '@/app/lib/schemas';
 import { Metadata } from 'next';
 import { connection } from 'next/server';
 
@@ -13,6 +14,8 @@ export default async function Page() {
   // whenever a customer is created, renamed or deleted.
   await connection();
   const customers = await fetchCustomers();
+  // Dated today as the action dates it (UTC), due after the usual term.
+  const today = new Date().toISOString().slice(0, 10);
 
   return (
     <div>
@@ -26,7 +29,7 @@ export default async function Page() {
           },
         ]}
       />
-      <Form customers={customers} />
+      <Form customers={customers} dueDate={addDays(today, PAYMENT_DAYS)} />
     </div>
   );
 }
diff --git a/app/lib/actions.ts b/app/lib/actions.ts
index 1d96403..7b61a53 100644
--- a/app/lib/actions.ts
+++ b/app/lib/actions.ts
@@ -14,6 +14,7 @@ import {
   CustomerId,
   InvoiceId,
   UpdateInvoice,
+  dueDateProblem,
 } from '@/app/lib/schemas';
 
 const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });
@@ -30,10 +31,15 @@ export type State = {
     customerId?: string[];
     amount?: string[];
     status?: string[];
+    dueDate?: string[];
   };
   message?: string | null;
 };
 
+/** The database's own check on the due date (db/migrations/0003) refused it. */
+const isDueDateRefused = (error: unknown) =>
+  (error as { constraint_name?: string })?.constraint_name === 'invoices_due_date_check';
+
 export async function createInvoice(prevState: State, formData: FormData) {
   if (!(await isSignedIn())) {
     return { message: 'You must be logged in to create an invoice.' };
@@ -44,6 +50,7 @@ export async function createInvoice(prevState: State, formData: FormData) {
     customerId: formData.get('customerId'),
     amount: formData.get('amount'),
     status: formData.get('status'),
+    dueDate: formData.get('dueDate'),
   });
 
   // If form validation fails, return errors early. Otherwise, continue.
@@ -55,20 +62,30 @@ export async function createInvoice(prevState: State, formData: FormData) {
   }
 
   // Prepare data for insertion into the database
-  const { customerId, amount, status } = validatedFields.data;
+  const { customerId, amount, status, dueDate } = validatedFields.data;
   // Rounded: amount * 100 is not always a whole number in floating point (10000.37
   // gives 1000037.0000000001), and the column is an integer.
   const amountInCents = Math.round(amount * 100);
   const date = new Date().toISOString().split('T')[0];
-  // Due 30 days after its date: the payment term (db/migrations/0003).
+  // Due when the form says (30 days after its date unless changed), never before it.
+  const problem = dueDateProblem(dueDate, date);
+  if (problem) {
+    return { errors: { dueDate: [problem] }, message: 'Failed to Create Invoice.' };
+  }
 
   // Insert data into the database
   try {
     await sql`
       INSERT INTO invoices (customer_id, amount, status, date, due_date)
-      VALUES (${customerId}, ${amountInCents}, ${status}, ${date}, ${date}::date + 30)
+      VALUES (${customerId}, ${amountInCents}, ${status}, ${date}, ${dueDate})
     `;
   } catch (error) {
+    if (isDueDateRefused(error)) {
+      return {
+        errors: { dueDate: ['The due date cannot be before the invoice date.'] },
+        message: 'Failed to Create Invoice.',
+      };
+    }
     // Log the database error on the server; return only a generic message.
     console.error('Database Error:', error);
     return {
@@ -86,10 +103,16 @@ export async function updateInvoice(id: string, prevState: State, formData: Form
     return { message: 'You must be logged in to update an invoice.' };
   }
 
+  // The id is the caller's: anything but a UUID names no invoice.
+  if (!InvoiceId.safeParse(id).success) {
+    return { message: 'No such invoice.' };
+  }
+
   const validatedFields = UpdateInvoice.safeParse({
     customerId: formData.get('customerId'),
     amount: formData.get('amount'),
     status: formData.get('status'),
+    dueDate: formData.get('dueDate'),
   });
 
   if (!validatedFields.success) {
@@ -99,18 +122,37 @@ export async function updateInvoice(id: string, prevState: State, formData: Form
     };
   }
 
-  const { customerId, amount, status } = validatedFields.data;
+  const { customerId, amount, status, dueDate } = validatedFields.data;
   // Rounded: amount * 100 is not always a whole number in floating point (10000.37
   // gives 1000037.0000000001), and the column is an integer.
   const amountInCents = Math.round(amount * 100);
 
   try {
-    await sql`
+    // The due date is checked against the invoice's own date, which the form
+    // does not change.
+    const [invoice] = await sql<{ date: string }[]>`
+      SELECT to_char(date, 'YYYY-MM-DD') AS date FROM invoices WHERE id = ${id}
+    `;
+    if (!invoice) return { message: 'No such invoice.' };
+    const problem = dueDateProblem(dueDate, invoice.date);
+    if (problem) {
+      return { errors: { dueDate: [problem] }, message: 'Failed to Update Invoice.' };
+    }
+    const updated = await sql`
       UPDATE invoices
-      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
+      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status},
+        due_date = ${dueDate}
       WHERE id = ${id}
     `;
+    // Deleted between the read and the write: nothing was saved.
+    if (updated.count === 0) return { message: 'No such invoice.' };
   } catch (error) {
+    if (isDueDateRefused(error)) {
+      return {
+        errors: { dueDate: ['The due date cannot be before the invoice date.'] },
+        message: 'Failed to Update Invoice.',
+      };
+    }
     console.error('Database Error:', error);
     return { message: 'Database Error: Failed to Update Invoice.' };
   }
diff --git a/app/lib/data.ts b/app/lib/data.ts
index 5e43945..6f18923 100644
--- a/app/lib/data.ts
+++ b/app/lib/data.ts
@@ -268,7 +268,9 @@ export async function fetchInvoiceById(id: string) {
         invoices.id,
         invoices.customer_id,
         invoices.amount,
-        invoices.status
+        invoices.status,
+        to_char(invoices.date, 'YYYY-MM-DD') AS date,
+        to_char(invoices.due_date, 'YYYY-MM-DD') AS due_date
       FROM invoices
       WHERE invoices.id = ${id};
     `;
diff --git a/app/lib/definitions.ts b/app/lib/definitions.ts
index ef5139e..92e1f44 100644
--- a/app/lib/definitions.ts
+++ b/app/lib/definitions.ts
@@ -106,6 +106,9 @@ export type InvoiceForm = {
   customer_id: string;
   amount: number;
   status: 'pending' | 'paid';
+  /** YYYY-MM-DD: its date (the due date cannot be before it), and its due date. */
+  date: string;
+  due_date: string;
 };
 
 /** An invoice and its customer, as the detail page shows them. */
diff --git a/app/lib/schemas.ts b/app/lib/schemas.ts
index 1650128..9bc24d0 100644
--- a/app/lib/schemas.ts
+++ b/app/lib/schemas.ts
@@ -12,12 +12,54 @@ export const FormSchema = z.object({
     invalid_type_error: 'Please select an invoice status.',
   }),
   date: z.string(),
+  /** When it is to be paid: a calendar date, YYYY-MM-DD (checked against its date by the action). */
+  dueDate: z
+    .string({ invalid_type_error: 'Please choose a due date.' })
+    .superRefine((value, context) => {
+      // One message: not a date at all, or a date that does not exist.
+      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
+        context.addIssue({ code: 'custom', message: 'Please choose a due date.' });
+      } else if (!isCalendarDate(value)) {
+        context.addIssue({ code: 'custom', message: 'Please choose a real date.' });
+      }
+    }),
 });
 
 export const CreateInvoice = FormSchema.omit({ id: true, date: true });
 
 export const UpdateInvoice = FormSchema.omit({ id: true, date: true });
 
+/** The payment term an invoice is given unless another due date is chosen, days. */
+export const PAYMENT_DAYS = 30;
+/** A due date can be at most this long after the invoice's date, days. */
+export const MAX_PAYMENT_DAYS = 365;
+
+/** Whether `value` (YYYY-MM-DD) is a date that exists: not 2026-02-30. */
+function isCalendarDate(value: string): boolean {
+  const date = new Date(`${value}T00:00:00Z`);
+  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
+}
+
+/** `date` (YYYY-MM-DD) moved by `days`. */
+export function addDays(date: string, days: number): string {
+  const moved = new Date(`${date}T00:00:00Z`);
+  moved.setUTCDate(moved.getUTCDate() + days);
+  return moved.toISOString().slice(0, 10);
+}
+
+/**
+ * What is wrong with a due date for an invoice dated `invoiceDate`, or null: it may
+ * not come before the invoice's date (the database's check says the same) nor more
+ * than MAX_PAYMENT_DAYS after it. Both are YYYY-MM-DD, so they compare as text.
+ */
+export function dueDateProblem(dueDate: string, invoiceDate: string): string | null {
+  if (dueDate < invoiceDate) return 'The due date cannot be before the invoice date.';
+  if (dueDate > addDays(invoiceDate, MAX_PAYMENT_DAYS)) {
+    return 'The due date can be at most a year after the invoice date.';
+  }
+  return null;
+}
+
 /** A customer as the create and edit forms send it. */
 export const CustomerForm = z.object({
   name: z
diff --git a/app/ui/invoices/create-form.tsx b/app/ui/invoices/create-form.tsx
index 492f39a..bf55134 100644
--- a/app/ui/invoices/create-form.tsx
+++ b/app/ui/invoices/create-form.tsx
@@ -3,6 +3,7 @@
 import { CustomerField } from '@/app/lib/definitions';
 import Link from 'next/link';
 import {
+  CalendarIcon,
   CheckIcon,
   ClockIcon,
   CurrencyDollarIcon,
@@ -12,7 +13,14 @@ import { Button } from '@/app/ui/button';
 import { createInvoice, State } from '@/app/lib/actions';
 import { useActionState } from 'react';
 
-export default function Form({ customers }: { customers: CustomerField[] }) {
+export default function Form({
+  customers,
+  dueDate,
+}: {
+  customers: CustomerField[];
+  /** The due date it gets by default: 30 days after today (on the server). */
+  dueDate: string;
+}) {
   const initialState: State = { message: null, errors: {} };
   const [state, formAction] = useActionState(createInvoice, initialState);
 
@@ -82,6 +90,35 @@ export default function Form({ customers }: { customers: CustomerField[] }) {
           </div>
         </div>
 
+        {/* Due Date */}
+        <div className="mb-4">
+          <label htmlFor="dueDate" className="mb-2 block text-sm font-medium text-white">
+            Due date
+          </label>
+          <div className="relative">
+            <input
+              id="dueDate"
+              name="dueDate"
+              type="date"
+              defaultValue={dueDate}
+              className="peer block w-full rounded-xl border border-line bg-void/70 py-2.5 pl-10 text-sm text-white [color-scheme:dark] focus:border-aura focus:ring-aura"
+              aria-describedby="due-date-help due-date-error"
+            />
+            <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-aura peer-focus:text-plasma" />
+          </div>
+          <p id="due-date-help" className="mt-2 text-xs text-aura">
+            30 days after the invoice date unless you choose otherwise; at most a year.
+          </p>
+          <div id="due-date-error" aria-live="polite" aria-atomic="true">
+            {state.errors?.dueDate &&
+              state.errors.dueDate.map((error: string) => (
+                <p className="mt-2 text-sm text-red-400" key={error}>
+                  {error}
+                </p>
+              ))}
+          </div>
+        </div>
+
         {/* Invoice Status */}
         <fieldset>
           <legend className="mb-2 block text-sm font-medium text-white">
diff --git a/app/ui/invoices/edit-form.tsx b/app/ui/invoices/edit-form.tsx
index 4ff2e5a..66c9a72 100644
--- a/app/ui/invoices/edit-form.tsx
+++ b/app/ui/invoices/edit-form.tsx
@@ -2,6 +2,7 @@
 
 import { CustomerField, InvoiceForm } from '@/app/lib/definitions';
 import {
+  CalendarIcon,
   CheckIcon,
   ClockIcon,
   CurrencyDollarIcon,
@@ -81,6 +82,35 @@ export default function EditInvoiceForm({
           </div>
         </div>
 
+        {/* Due Date */}
+        <div className="mb-4">
+          <label htmlFor="dueDate" className="mb-2 block text-sm font-medium text-white">
+            Due date
+          </label>
+          <div className="relative">
+            <input
+              id="dueDate"
+              name="dueDate"
+              type="date"
+              defaultValue={invoice.due_date}
+              className="peer block w-full rounded-xl border border-line bg-void/70 py-2.5 pl-10 text-sm text-white [color-scheme:dark] focus:border-aura focus:ring-aura"
+              aria-describedby="due-date-help due-date-error"
+            />
+            <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-aura peer-focus:text-plasma" />
+          </div>
+          <p id="due-date-help" className="mt-2 text-xs text-aura">
+            Not before the invoice date, and at most a year after it.
+          </p>
+          <div id="due-date-error" aria-live="polite" aria-atomic="true">
+            {state.errors?.dueDate &&
+              state.errors.dueDate.map((error: string) => (
+                <p className="mt-2 text-sm text-red-400" key={error}>
+                  {error}
+                </p>
+              ))}
+          </div>
+        </div>
+
         {/* Invoice Status */}
         <fieldset>
           <legend className="mb-2 block text-sm font-medium text-white">
diff --git a/tests/e2e/invoices.spec.ts b/tests/e2e/invoices.spec.ts
index a46b01a..b7e7347 100644
--- a/tests/e2e/invoices.spec.ts
+++ b/tests/e2e/invoices.spec.ts
@@ -1,4 +1,5 @@
 import { type Page, expect, test } from '@playwright/test';
+import { addDays } from '@/app/lib/schemas';
 
 // Invoice create, edit and delete through the forms, logged in as the demo user,
 // against the test schema global-setup.ts rebuilds. Each test makes its own
@@ -127,6 +128,50 @@ test('an invoice is edited: a bad amount is refused, then the change is saved',
   await expect(await rowsFor(page, cents)).toHaveCount(0);
 });
 
+test('an invoice is due when the form says: 30 days by default, never before its date', async ({
+  page,
+}) => {
+  test.setTimeout(60_000);
+  await logIn(page);
+  const cents = uniqueCents();
+  // Dated today (the server's date, in UTC, as here).
+  const today = new Date().toISOString().slice(0, 10);
+
+  await openCreateForm(page);
+  const due = page.getByLabel('Due date');
+  await expect(due).toHaveValue(addDays(today, 30));
+  await page.getByLabel('Choose customer').selectOption({ label: 'Amy Burns' });
+  await page.getByLabel('Choose an amount').fill((cents / 100).toFixed(2));
+  await page.getByLabel('Pending').check();
+  await due.fill(addDays(today, 45));
+  await page.getByRole('button', { name: 'Create Invoice' }).click();
+  await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });
+
+  // Kept: the edit form shows it.
+  await (await rowsFor(page, cents)).getByRole('link', { name: 'Edit' }).click();
+  await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]{36}\/edit$/);
+  await page.waitForLoadState('networkidle');
+  await expect(due).toHaveValue(addDays(today, 45));
+  const editUrl = page.url();
+
+  // Before the invoice's date: refused, in the field's own error region.
+  await due.fill(addDays(today, -1));
+  await page.getByRole('button', { name: 'Edit Invoice' }).click();
+  await expect(page.locator('#due-date-error')).toHaveText(
+    'The due date cannot be before the invoice date.'
+  );
+  await expect(due).toHaveAttribute('aria-describedby', 'due-date-help due-date-error');
+  await expect(page).toHaveURL(editUrl);
+
+  // A later one is saved.
+  await due.fill(addDays(today, 60));
+  await page.getByRole('button', { name: 'Edit Invoice' }).click();
+  await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });
+  await page.goto(editUrl);
+  await page.waitForLoadState('networkidle');
+  await expect(due).toHaveValue(addDays(today, 60));
+});
+
 test('an invoice is deleted, and stays deleted after a reload', async ({ page }) => {
   test.setTimeout(60_000);
   await logIn(page);
diff --git a/tests/unit/actions.test.ts b/tests/unit/actions.test.ts
index 1fd7892..d4864db 100644
--- a/tests/unit/actions.test.ts
+++ b/tests/unit/actions.test.ts
@@ -22,6 +22,8 @@ vi.mock('next-auth', () => ({
 vi.mock('next/cache', () => ({ revalidatePath }));
 vi.mock('next/navigation', () => ({ redirect }));
 
+const { addDays } = await import('@/app/lib/schemas');
+
 const {
   createInvoice,
   updateInvoice,
@@ -36,7 +38,13 @@ const {
 
 function invoiceForm(fields: Record<string, string> = {}) {
   const form = new FormData();
-  const values = { customerId: 'c0ffee', amount: '12.50', status: 'paid', ...fields };
+  const values = {
+    customerId: 'c0ffee',
+    amount: '12.50',
+    status: 'paid',
+    dueDate: addDays(new Date().toISOString().slice(0, 10), 30),
+    ...fields,
+  };
   for (const [key, value] of Object.entries(values)) form.set(key, value);
   return form;
 }
@@ -91,30 +99,93 @@ describe('without a session', () => {
 describe('with a session', () => {
   beforeEach(() => auth.mockResolvedValue(signedIn));
 
-  it('createInvoice stores the amount in cents and redirects to the list', async () => {
-    await createInvoice({}, invoiceForm());
+  const today = () => new Date().toISOString().slice(0, 10);
+
+  it('createInvoice stores the amount in cents, dated today, due when the form says', async () => {
+    const due = addDays(today(), 45);
+    await createInvoice({}, invoiceForm({ dueDate: due }));
     expect(sql).toHaveBeenCalledTimes(1);
-    // Dated today, and due 30 days after that date (computed by the database).
-    const today = new Date().toISOString().slice(0, 10);
-    expect(sql.mock.calls[0].slice(1)).toEqual(['c0ffee', 1250, 'paid', today, today]);
-    expect(sql.mock.calls[0][0].join('?')).toContain('?, ?::date + 30)');
+    expect(sql.mock.calls[0].slice(1)).toEqual(['c0ffee', 1250, 'paid', today(), due]);
     expect(revalidatePath).toHaveBeenCalledWith('/dashboard/invoices');
     expect(redirect).toHaveBeenCalledWith('/dashboard/invoices');
   });
 
+  it('createInvoice refuses a due date before today, or more than a year on, and writes nothing', async () => {
+    const before = await createInvoice({}, invoiceForm({ dueDate: addDays(today(), -1) }));
+    expect(before.errors?.dueDate).toEqual(['The due date cannot be before the invoice date.']);
+    const far = await createInvoice({}, invoiceForm({ dueDate: addDays(today(), 366) }));
+    expect(far.errors?.dueDate).toEqual([
+      'The due date can be at most a year after the invoice date.',
+    ]);
+    expect(sql).not.toHaveBeenCalled();
+    expect(redirect).not.toHaveBeenCalled();
+  });
+
+  it("createInvoice reports the database's own due-date check as the field's error", async () => {
+    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
+    sql.mockRejectedValue(
+      Object.assign(new Error('violates check constraint'), {
+        constraint_name: 'invoices_due_date_check',
+      })
+    );
+    const result = await createInvoice({}, invoiceForm());
+    expect(result.errors?.dueDate).toEqual(['The due date cannot be before the invoice date.']);
+    expect(redirect).not.toHaveBeenCalled();
+    consoleError.mockRestore();
+  });
+
   it('createInvoice still validates the form', async () => {
     const result = await createInvoice({}, invoiceForm({ amount: '0' }));
     expect(result.errors?.amount).toEqual(['Please enter an amount greater than $0']);
     expect(sql).not.toHaveBeenCalled();
   });
 
-  it('updateInvoice writes and redirects', async () => {
-    await updateInvoice('i1', {}, invoiceForm({ status: 'pending' }));
-    expect(sql).toHaveBeenCalledTimes(1);
-    expect(sql.mock.calls[0].slice(1)).toEqual(['c0ffee', 1250, 'pending', 'i1']);
+  const invoiceId = 'cc27c14a-0acf-4f4a-a6c9-d45682c144b9';
+
+  it("updateInvoice checks the due date against the invoice's own date, writes and redirects", async () => {
+    sql.mockResolvedValueOnce([{ date: '2026-01-10' }]).mockResolvedValueOnce([]);
+    await updateInvoice(invoiceId, {}, invoiceForm({ status: 'pending', dueDate: '2026-03-01' }));
+    expect(sql).toHaveBeenCalledTimes(2);
+    expect(sql.mock.calls[0].slice(1)).toEqual([invoiceId]);
+    expect(sql.mock.calls[1].slice(1)).toEqual([
+      'c0ffee',
+      1250,
+      'pending',
+      '2026-03-01',
+      invoiceId,
+    ]);
     expect(redirect).toHaveBeenCalledWith('/dashboard/invoices');
   });
 
+  it('updateInvoice refuses a due date before the invoice date, and writes nothing', async () => {
+    sql.mockResolvedValueOnce([{ date: '2026-01-10' }]);
+    const result = await updateInvoice(invoiceId, {}, invoiceForm({ dueDate: '2026-01-09' }));
+    expect(result.errors?.dueDate).toEqual(['The due date cannot be before the invoice date.']);
+    // Only the read of its date.
+    expect(sql).toHaveBeenCalledTimes(1);
+    expect(redirect).not.toHaveBeenCalled();
+  });
+
+  it('updateInvoice says so when the invoice was deleted between the read and the write', async () => {
+    sql
+      .mockResolvedValueOnce([{ date: '2026-01-10' }])
+      .mockResolvedValueOnce(Object.assign([], { count: 0 }));
+    const result = await updateInvoice(invoiceId, {}, invoiceForm({ dueDate: '2026-02-09' }));
+    expect(result).toEqual({ message: 'No such invoice.' });
+    expect(redirect).not.toHaveBeenCalled();
+  });
+
+  it('updateInvoice names no invoice for an id that is not one, or one that does not exist', async () => {
+    expect(await updateInvoice('i1', {}, invoiceForm())).toEqual({ message: 'No such invoice.' });
+    expect(sql).not.toHaveBeenCalled();
+    sql.mockResolvedValueOnce([]);
+    expect(await updateInvoice(invoiceId, {}, invoiceForm())).toEqual({
+      message: 'No such invoice.',
+    });
+    expect(sql).toHaveBeenCalledTimes(1);
+    expect(redirect).not.toHaveBeenCalled();
+  });
+
   it('deleteInvoice deletes and revalidates the list', async () => {
     await deleteInvoice('cc27c14a-0acf-4f4a-a6c9-d45682c144b9');
     expect(sql.mock.calls[0].slice(1)).toEqual(['cc27c14a-0acf-4f4a-a6c9-d45682c144b9']);
@@ -276,12 +347,14 @@ describe('amounts in cents', () => {
     await createInvoice({}, invoiceForm({ amount: '10000.37' }));
     expect(sql.mock.calls[0][2]).toBe(1000037);
     sql.mockClear();
+    // The invoice, dated today (its due date is checked against it).
+    sql.mockResolvedValueOnce([{ date: new Date().toISOString().slice(0, 10) }]);
     await updateInvoice(
       'cc27c14a-0acf-4f4a-a6c9-d45682c144b9',
       {},
       invoiceForm({ amount: '0.29' })
     );
-    expect(sql.mock.calls[0][2]).toBe(29);
+    expect(sql.mock.calls[1][2]).toBe(29);
   });
 });
 
diff --git a/tests/unit/data.test.ts b/tests/unit/data.test.ts
index d675b0b..61af3ab 100644
--- a/tests/unit/data.test.ts
+++ b/tests/unit/data.test.ts
@@ -213,6 +213,8 @@ describe.skipIf(!url)('the queries in app/lib/data.ts', () => {
         customer_id: seeded.customer_id.toLowerCase(),
         amount: 448,
         status: 'paid',
+        date: seeded.date,
+        due_date: seeded.due_date,
       });
 
       const detail = await data.fetchInvoiceDetail(row.id);
diff --git a/tests/unit/schemas.test.ts b/tests/unit/schemas.test.ts
index 345a8a8..f455a5e 100644
--- a/tests/unit/schemas.test.ts
+++ b/tests/unit/schemas.test.ts
@@ -6,11 +6,13 @@ import {
   CustomerId,
   InvoiceId,
   UpdateInvoice,
+  addDays,
+  dueDateProblem,
   parseStatusFilter,
 } from '@/app/lib/schemas';
 
 // The actions pass formData.get(...) straight in, so a missing field arrives as null.
-const valid = { customerId: 'c0ffee', amount: '12.50', status: 'paid' };
+const valid = { customerId: 'c0ffee', amount: '12.50', status: 'paid', dueDate: '2026-11-06' };
 
 describe.each([
   ['CreateInvoice', CreateInvoice],
@@ -19,7 +21,12 @@ describe.each([
   it('accepts a valid invoice and coerces the amount to a number', () => {
     const result = schema.safeParse(valid);
     expect(result.success).toBe(true);
-    expect(result.data).toEqual({ customerId: 'c0ffee', amount: 12.5, status: 'paid' });
+    expect(result.data).toEqual({
+      customerId: 'c0ffee',
+      amount: 12.5,
+      status: 'paid',
+      dueDate: '2026-11-06',
+    });
   });
 
   it.each(['0', '-5', null])('rejects amount %s', (amount) => {
@@ -52,6 +59,25 @@ describe.each([
     expect(schema.safeParse({ ...valid, status: 'overdue' }).success).toBe(false);
   });
 
+  it('asks for a due date when none is given, or one that is not a date', () => {
+    for (const dueDate of [null, '', '6/11/2026', '2026-11-6', '2026-11-06T00:00']) {
+      const result = schema.safeParse({ ...valid, dueDate });
+      expect(result.error?.flatten().fieldErrors.dueDate, String(dueDate)).toEqual([
+        'Please choose a due date.',
+      ]);
+    }
+  });
+
+  it('refuses a due date that does not exist', () => {
+    for (const dueDate of ['2026-02-30', '2026-13-01', '2025-02-29']) {
+      const result = schema.safeParse({ ...valid, dueDate });
+      expect(result.error?.flatten().fieldErrors.dueDate, dueDate).toEqual([
+        'Please choose a real date.',
+      ]);
+    }
+    expect(schema.safeParse({ ...valid, dueDate: '2028-02-29' }).success).toBe(true);
+  });
+
   it('ignores an id or date sent by the client', () => {
     const result = schema.safeParse({ ...valid, id: 'x', date: '2020-01-01' });
     expect(result.data).not.toHaveProperty('id');
@@ -175,3 +201,26 @@ describe('ChangePasswordForm', () => {
     ).toEqual(['The new password must differ from the current one.']);
   });
 });
+
+describe('the due date against the invoice date', () => {
+  it('moves a date by days, across months and years', () => {
+    expect(addDays('2026-10-08', 30)).toBe('2026-11-07');
+    expect(addDays('2026-12-15', 30)).toBe('2027-01-14');
+    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
+  });
+
+  it('may be the invoice date itself, or up to a year after it', () => {
+    expect(dueDateProblem('2026-10-08', '2026-10-08')).toBeNull();
+    expect(dueDateProblem('2026-11-07', '2026-10-08')).toBeNull();
+    expect(dueDateProblem('2027-10-08', '2026-10-08')).toBeNull();
+  });
+
+  it('may not come before it, nor more than a year after it', () => {
+    expect(dueDateProblem('2026-10-07', '2026-10-08')).toBe(
+      'The due date cannot be before the invoice date.'
+    );
+    expect(dueDateProblem('2027-10-09', '2026-10-08')).toBe(
+      'The due date can be at most a year after the invoice date.'
+    );
+  });
+});
~~~~

</details>

#### T12 item 3 — `night-2026-10-07-t12-3-tests`

The URL test-hook parser and the milestone text moved into testable modules; tests for them and for Laser Cat shots over a downed Keeper. Why: task 12, tests; checkpoint 2's reading-only list (D79).

<details><summary>Code: 7 files changed, 119 insertions(+), 31 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index cad9ea0..b4d9b11 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -48,7 +48,7 @@ jobs:
       - name: Unit tests (cats, games, page, sound)
         if: ${{ !cancelled() }}
         run: >-
-          npx vitest run tests/unit/xenocats/arena tests/unit/xenocats/arsenal tests/unit/xenocats/varieties tests/unit/xenocats/progression tests/unit/xenocats/coop
+          npx vitest run tests/unit/xenocats/arena tests/unit/xenocats/arsenal tests/unit/xenocats/varieties tests/unit/xenocats/progression tests/unit/xenocats/coop tests/unit/xenocats/test-hooks
           tests/unit/xenocats/walking
           tests/unit/xenocats/locked-pointer
           tests/unit/xenocats/taming tests/unit/xenocats/page-hits tests/unit/xenocats/sounds
diff --git a/app/ui/xenocats/arena-view.tsx b/app/ui/xenocats/arena-view.tsx
index da97fbf..f7bd3f4 100644
--- a/app/ui/xenocats/arena-view.tsx
+++ b/app/ui/xenocats/arena-view.tsx
@@ -16,7 +16,7 @@ import {
   type CharacterId,
   MILESTONES,
   type MilestoneId,
-  WEAPON_UNLOCKS,
+  unlockedBy,
   applyRun,
   hasCharacter,
   readProgress,
@@ -25,6 +25,7 @@ import {
 } from './progression';
 import { ProgressionPanel, useProgress } from './progression-view';
 import { createRandom, freshSeed } from './random';
+import { parseTestHooks } from './test-hooks';
 import { type SoundPlayer, sharedSoundPlayer, soundsFor } from './sounds';
 import { SCHEDULE, VARIETIES, type VarietyId } from './varieties';
 import { PLAYER_KEYS, isWalkKey, walkDirection } from './walking';
@@ -105,34 +106,6 @@ const OUTCOME_TEXT: Record<ArenaOutcome, string> = {
   goal: 'Five minutes, and the night is survived. The cats remain.',
 };
 
-/** What a milestone unlocks, in a sentence (or nothing). */
-function unlockedBy(id: MilestoneId): string {
-  const names = [
-    ...Object.entries(WEAPON_UNLOCKS)
-      .filter(([, milestone]) => milestone === id)
-      .map(([weapon]) => WEAPONS[weapon as WeaponId].name),
-    ...(Object.keys(CHARACTERS) as CharacterId[])
-      .filter((c) => {
-        const unlock = CHARACTERS[c].unlock;
-        return unlock.kind === 'milestone' && unlock.milestone === id;
-      })
-      .map((c) => CHARACTERS[c].name),
-  ];
-  return names.length > 0 ? `Now available: ${names.join(', ')}.` : '';
-}
-
-function testHooks(): { seed: number; speed: number; boss: number | null } {
-  const params = new URLSearchParams(window.location.search);
-  const seed = Number(params.get('seed'));
-  const speed = Number(params.get('speed'));
-  const boss = params.has('boss') ? Number(params.get('boss')) : NaN;
-  return {
-    seed: Number.isInteger(seed) && seed > 0 ? seed : freshSeed(),
-    speed: Number.isFinite(speed) && speed >= 1 ? Math.min(speed, 50) : 1,
-    boss: Number.isFinite(boss) && boss >= 0 ? boss * 1000 : null,
-  };
-}
-
 /** A sound for a cat of any kind: a variety sounds like the first xenocat type. */
 const typeOf = (type: number) => CAT_TYPES[type] ?? CAT_TYPES[0];
 
@@ -240,7 +213,7 @@ export default function ArenaGame({ touch = false }: { touch?: boolean }) {
   );
 
   const start = () => {
-    const { seed, speed, boss } = testHooks();
+    const { seed, speed, boss } = parseTestHooks(window.location.search, freshSeed);
     speedRef.current = speed;
     playerRef.current ??= sharedSoundPlayer();
     // The click that started the run is the gesture sound needs.
diff --git a/app/ui/xenocats/progression.ts b/app/ui/xenocats/progression.ts
index 61afc18..ea394e6 100644
--- a/app/ui/xenocats/progression.ts
+++ b/app/ui/xenocats/progression.ts
@@ -46,6 +46,22 @@ export const WEAPON_UNLOCKS: Readonly<Partial<Record<WeaponId, MilestoneId>>> =
   hairball: 'level-20',
 };
 
+/** What a milestone unlocks, in a sentence (or nothing). */
+export function unlockedBy(id: MilestoneId): string {
+  const names = [
+    ...Object.entries(WEAPON_UNLOCKS)
+      .filter(([, milestone]) => milestone === id)
+      .map(([weapon]) => WEAPONS[weapon as WeaponId].name),
+    ...(Object.keys(CHARACTERS) as CharacterId[])
+      .filter((c) => {
+        const unlock = CHARACTERS[c].unlock;
+        return unlock.kind === 'milestone' && unlock.milestone === id;
+      })
+      .map((c) => CHARACTERS[c].name),
+  ];
+  return names.length > 0 ? `Now available: ${names.join(', ')}.` : '';
+}
+
 // ------------------------------------------------------------------ the Tailor
 
 export type UpgradeId = 'stubbornness' | 'sternness' | 'brisk-step' | 'long-arms' | 'second-wind';
diff --git a/app/ui/xenocats/test-hooks.ts b/app/ui/xenocats/test-hooks.ts
new file mode 100644
index 0000000..6af78df
--- /dev/null
+++ b/app/ui/xenocats/test-hooks.ts
@@ -0,0 +1,20 @@
+// Survival's test hooks, read from the page's URL (decisions.md, D30 and D46):
+// `?seed=` fixes the run's random source, `?speed=` (up to 50) makes time pass
+// that much faster, `?boss=` (seconds) brings a Mega Cat that early, besides the
+// schedule's. Anyone can set them; nothing is at stake in a single-player game, so
+// each is only bounded: anything unusable reads as no hook at all.
+
+export type TestHooks = { seed: number; speed: number; boss: number | null };
+
+/** The hooks in a URL's query string (`location.search`); `freshSeed` when none is set. */
+export function parseTestHooks(search: string, freshSeed: () => number): TestHooks {
+  const params = new URLSearchParams(search);
+  const seed = Number(params.get('seed'));
+  const speed = Number(params.get('speed'));
+  const boss = params.has('boss') ? Number(params.get('boss')) : NaN;
+  return {
+    seed: Number.isInteger(seed) && seed > 0 ? seed : freshSeed(),
+    speed: Number.isFinite(speed) && speed >= 1 ? Math.min(speed, 50) : 1,
+    boss: Number.isFinite(boss) && boss >= 0 ? boss * 1000 : null,
+  };
+}
diff --git a/tests/unit/xenocats/coop.test.ts b/tests/unit/xenocats/coop.test.ts
index f63b559..87d705b 100644
--- a/tests/unit/xenocats/coop.test.ts
+++ b/tests/unit/xenocats/coop.test.ts
@@ -340,6 +340,36 @@ describe('downed and revived', () => {
     expect(jumps).toBeGreaterThan(3);
   });
 
+  it('Laser Cat shots pass over a downed Keeper', () => {
+    // Only Laser Cats; player 2 is frail; they stand side by side, so shots at
+    // player 1 cross where player 2 lies.
+    const a = coop({
+      escalation: [[0, 30]],
+      startingWeapons: [],
+      secondPlayer: { startingWeapons: [], speed: 210, resolve: 5 },
+      schedule: {
+        arrivals: [{ from: 0, who: 'laser', weight: 1 }],
+        swarms: { from: Infinity, everyMs: 1, size: [0, 0] },
+        bosses: [],
+      },
+    });
+    while (!a.state().heroes[1].down && a.state().time < 60_000) a.step(still, true, still);
+    expect(a.state().heroes[1].down).toBe(true);
+    a.drainEvents();
+    const reach = ARENA_CONFIG.hero.reach / 2 + ARENA_CONFIG.laserCat.shotRadius;
+    let crossed = 0;
+    for (let n = 0; n < 1200; n++) {
+      a.step(still, true, still);
+      for (const e of a.drainEvents()) {
+        if (e.kind === 'hero-hit') expect(e.player, 'a shot hit the downed Keeper').toBe(0);
+        if (e.kind === 'revived') return expect(crossed).toBeGreaterThan(0);
+      }
+      const down = a.state().heroes[1];
+      if (a.shots().some((s) => Math.hypot(s.x - down.x, s.y - down.y) <= reach)) crossed++;
+    }
+    expect(crossed).toBeGreaterThan(0);
+  });
+
   it('the run ends when both are down; the results know both', () => {
     const a = coop({
       escalation: [[0, 60]],
diff --git a/tests/unit/xenocats/progression.test.ts b/tests/unit/xenocats/progression.test.ts
index 6fac5b0..07174dd 100644
--- a/tests/unit/xenocats/progression.test.ts
+++ b/tests/unit/xenocats/progression.test.ts
@@ -22,6 +22,7 @@ import {
   runConfig,
   serializeProgress,
   tuftsFor,
+  unlockedBy,
   upgradeCost,
   writeProgress,
 } from '@/app/ui/xenocats/progression';
@@ -440,3 +441,12 @@ describe('storage', () => {
     });
   });
 });
+
+describe('what a milestone unlocks, as the results say it', () => {
+  it('names each weapon and character a milestone brings', () => {
+    expect(unlockedBy('survive-2')).toBe('Now available: The Night Porter.');
+    expect(unlockedBy('survive-3')).toBe('Now available: Thunderous Vacuum.');
+    expect(unlockedBy('send-1000')).toBe('Now available: Laser Pointer Deluxe.');
+    expect(unlockedBy('level-20')).toBe('Now available: Hairball.');
+  });
+});
diff --git a/tests/unit/xenocats/test-hooks.test.ts b/tests/unit/xenocats/test-hooks.test.ts
new file mode 100644
index 0000000..f914592
--- /dev/null
+++ b/tests/unit/xenocats/test-hooks.test.ts
@@ -0,0 +1,39 @@
+import { describe, expect, it } from 'vitest';
+import { parseTestHooks } from '@/app/ui/xenocats/test-hooks';
+
+const fresh = () => 777;
+const hooks = (search: string) => parseTestHooks(search, fresh);
+
+describe('the URL test hooks', () => {
+  it('none set: a fresh seed, time at its own pace, no early boss', () => {
+    expect(hooks('')).toEqual({ seed: 777, speed: 1, boss: null });
+  });
+
+  it('read as set', () => {
+    expect(hooks('?seed=42&speed=3&boss=2.5')).toEqual({ seed: 42, speed: 3, boss: 2500 });
+    expect(hooks('?boss=0')).toEqual({ seed: 777, speed: 1, boss: 0 });
+  });
+
+  it('a seed that is not a whole number above 0 is no seed', () => {
+    for (const seed of ['0', '-3', '1.5', 'abc', '', 'NaN', 'Infinity']) {
+      expect(hooks(`?seed=${seed}`).seed, seed).toBe(777);
+    }
+  });
+
+  it('time is never slowed, nor sped past 50 times', () => {
+    expect(hooks('?speed=0.5').speed).toBe(1);
+    expect(hooks('?speed=-4').speed).toBe(1);
+    expect(hooks('?speed=abc').speed).toBe(1);
+    expect(hooks('?speed=Infinity').speed).toBe(1);
+    expect(hooks('?speed=100').speed).toBe(50);
+    expect(hooks('?speed=1e308').speed).toBe(50);
+  });
+
+  it('a boss time that is not a time is no early boss', () => {
+    for (const boss of ['-1', 'abc', 'Infinity', '1e400']) {
+      expect(hooks(`?boss=${boss}`).boss, boss).toBeNull();
+    }
+    // Absurdly late is harmless: a boss at Infinity never comes.
+    expect(hooks('?boss=1e306').boss).toBe(Infinity);
+  });
+});
~~~~

</details>

#### T12 item 4 — `night-2026-10-07-t12-4-login-timing`

An unknown email's login makes the same one bcrypt comparison as a wrong password (`password-check.ts`); the sign-in's decision moved to `credentials.ts`, tested. Why: task 12, security; the 2026-10-01 run's Q7 (D80–D81).

<details><summary>Code: 7 files changed, 183 insertions(+), 37 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index b4d9b11..a68f72b 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -32,7 +32,7 @@ jobs:
           npx vitest run tests/unit/actions tests/unit/schemas tests/unit/utils
           tests/unit/auth-config tests/unit/dashboard tests/unit/proxy-matcher tests/unit/seed-data
           tests/unit/csv tests/unit/export-route tests/unit/invoice-status
-          tests/unit/login-limit tests/unit/cat-error tests/unit/affected-tests
+          tests/unit/login-limit tests/unit/password-check tests/unit/credentials tests/unit/cat-error tests/unit/affected-tests
       - name: Unit tests (cats, Node)
         if: ${{ !cancelled() }}
         run: >-
diff --git a/app/lib/actions.ts b/app/lib/actions.ts
index 7b61a53..b2c9cd2 100644
--- a/app/lib/actions.ts
+++ b/app/lib/actions.ts
@@ -6,6 +6,7 @@ import bcryptjs from 'bcryptjs';
 import postgres from 'postgres';
 import { auth, signIn } from '@/auth';
 import { AuthError, type CredentialsSignin } from 'next-auth';
+import { BCRYPT_COST } from '@/app/lib/password-check';
 import { LOCKED, claimAttempt, clearFailures, loginKey, loginLimits } from '@/app/lib/login-limit';
 import {
   ChangePasswordForm,
@@ -380,7 +381,7 @@ export async function changePassword(
       };
     }
     await clearFailures(sql, key);
-    const hash = await bcryptjs.hash(newPassword, 10);
+    const hash = await bcryptjs.hash(newPassword, BCRYPT_COST);
     await sql`UPDATE users SET password = ${hash} WHERE id = ${user.id}`;
   } catch (error) {
     console.error('Database Error:', error);
diff --git a/app/lib/credentials.ts b/app/lib/credentials.ts
new file mode 100644
index 0000000..9d68d56
--- /dev/null
+++ b/app/lib/credentials.ts
@@ -0,0 +1,48 @@
+import type { Sql } from 'postgres';
+import { z } from 'zod';
+import type { User } from '@/app/lib/definitions';
+import { LOCKED, claimAttempt, clearFailures, loginKey, loginLimits } from '@/app/lib/login-limit';
+import { passwordMatches } from '@/app/lib/password-check';
+
+// The credentials sign-in's decision (auth.ts hands NextAuth what it says), kept
+// apart so it can be tested with a fake database.
+
+async function getUser(sql: Sql, email: string): Promise<User | undefined> {
+  try {
+    const user = await sql<User[]>`SELECT * FROM users WHERE email=${email}`;
+    return user[0];
+  } catch (error) {
+    console.error('Failed to fetch user:', error);
+    throw new Error('Failed to fetch user.');
+  }
+}
+
+/**
+ * Who `credentials` sign in as: the user, null for a refusal, or LOCKED for an
+ * email locked out by too many failures.
+ */
+export async function checkCredentials(
+  sql: Sql,
+  credentials: unknown,
+  limits: ReturnType<typeof loginLimits> = loginLimits()
+): Promise<User | null | typeof LOCKED> {
+  const parsedCredentials = z
+    .object({ email: z.string().email(), password: z.string().min(6) })
+    .safeParse(credentials);
+  if (!parsedCredentials.success) return null;
+
+  const { email, password } = parsedCredentials.data;
+  const key = loginKey(email);
+  // Counted before the password is looked at, so a locked email learns nothing
+  // and concurrent attempts cannot get past the limit. An unknown email counts
+  // like a wrong password.
+  if (!(await claimAttempt(sql, key, limits))) return LOCKED;
+  const user = await getUser(sql, email);
+  // Compared even for an unknown email, so the time tells nothing (D80).
+  const passwordsMatch = await passwordMatches(password, user?.password);
+  if (user && passwordsMatch) {
+    await clearFailures(sql, key);
+    return user;
+  }
+  return null;
+}
diff --git a/app/lib/password-check.ts b/app/lib/password-check.ts
new file mode 100644
index 0000000..eaec0f8
--- /dev/null
+++ b/app/lib/password-check.ts
@@ -0,0 +1,21 @@
+import { randomUUID } from 'node:crypto';
+import bcryptjs from 'bcryptjs';
+
+/** The cost every stored password hash is made with (the seed, the password change). */
+export const BCRYPT_COST = 10;
+
+// Made when the module loads, so even the first unknown email takes no longer
+// than a wrong password (only the comparison is left to do).
+const unknownHash = bcryptjs.hash(randomUUID(), BCRYPT_COST);
+
+/**
+ * Whether `password` is the one `hash` was made from. With no hash (no account
+ * has that email) it still compares, against a hash of a string nobody knows made
+ * at the same cost, and answers no: so a login for an unknown email takes as long
+ * as a wrong password, and the time does not tell which emails have accounts.
+ */
+export async function passwordMatches(password: string, hash: string | undefined) {
+  if (hash !== undefined) return bcryptjs.compare(password, hash);
+  await bcryptjs.compare(password, await unknownHash);
+  return false;
+}
diff --git a/auth.ts b/auth.ts
index fb08067..12ec4b3 100644
--- a/auth.ts
+++ b/auth.ts
@@ -1,10 +1,8 @@
 import NextAuth, { CredentialsSignin } from 'next-auth';
 import Credentials from 'next-auth/providers/credentials';
 import { authConfig } from './auth.config';
-import { z } from 'zod';
-import type { User } from '@/app/lib/definitions';
-import { LOCKED, claimAttempt, clearFailures, loginKey, loginLimits } from '@/app/lib/login-limit';
-import bcryptjs from 'bcryptjs';
+import { checkCredentials } from '@/app/lib/credentials';
+import { LOCKED } from '@/app/lib/login-limit';
 import postgres from 'postgres';
 
 /** A refused login for an email that is locked out; `authenticate` says so. */
@@ -14,42 +12,15 @@ class LoginLocked extends CredentialsSignin {
 
 const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });
 
-async function getUser(email: string): Promise<User | undefined> {
-  try {
-    const user = await sql<User[]>`SELECT * FROM users WHERE email=${email}`;
-    return user[0];
-  } catch (error) {
-    console.error('Failed to fetch user:', error);
-    throw new Error('Failed to fetch user.');
-  }
-}
-
 export const { auth, signIn, signOut } = NextAuth({
   ...authConfig,
   providers: [
     Credentials({
+      // The decision is checkCredentials' (app/lib/credentials.ts).
       async authorize(credentials) {
-        const parsedCredentials = z
-          .object({ email: z.string().email(), password: z.string().min(6) })
-          .safeParse(credentials);
-
-        if (parsedCredentials.success) {
-          const { email, password } = parsedCredentials.data;
-          const key = loginKey(email);
-          // Counted before the password is looked at, so a locked email learns
-          // nothing and concurrent attempts cannot get past the limit. An
-          // unknown email counts like a wrong password.
-          if (!(await claimAttempt(sql, key, loginLimits()))) throw new LoginLocked();
-          const user = await getUser(email);
-          const passwordsMatch = user ? await bcryptjs.compare(password, user.password) : false;
-
-          if (user && passwordsMatch) {
-            await clearFailures(sql, key);
-            return user;
-          }
-        }
-
-        return null;
+        const result = await checkCredentials(sql, credentials);
+        if (result === LOCKED) throw new LoginLocked();
+        return result;
       },
     }),
   ],
diff --git a/tests/unit/credentials.test.ts b/tests/unit/credentials.test.ts
new file mode 100644
index 0000000..cec0cab
--- /dev/null
+++ b/tests/unit/credentials.test.ts
@@ -0,0 +1,74 @@
+import bcryptjs from 'bcryptjs';
+import type { Sql } from 'postgres';
+import { afterEach, describe, expect, it, vi } from 'vitest';
+import { checkCredentials } from '@/app/lib/credentials';
+import { LOCKED } from '@/app/lib/login-limit';
+
+// The sign-in's decision against a fake database: the lockout's count, the user
+// lookup and the clearing of failures are answered here; bcrypt is real.
+
+const limits = { maxFailures: 5, lockMinutes: 15 };
+
+async function database(attempt = 1) {
+  const user = {
+    id: 'u1',
+    name: 'User',
+    email: 'user@nextmail.com',
+    password: await bcryptjs.hash('123456', 10),
+  };
+  const statements: string[] = [];
+  const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
+    const text = strings.join('?');
+    statements.push(text);
+    if (text.includes('INSERT INTO login_failures')) return Promise.resolve([{ attempt }]);
+    if (text.includes('FROM users')) {
+      return Promise.resolve(values[0] === user.email ? [user] : []);
+    }
+    return Promise.resolve([]);
+  }) as unknown as Sql;
+  return { sql, user, statements };
+}
+
+describe('checkCredentials', () => {
+  afterEach(() => vi.restoreAllMocks());
+
+  it('the right password: the user, and the failures cleared', async () => {
+    const { sql, user, statements } = await database();
+    expect(await checkCredentials(sql, { email: user.email, password: '123456' }, limits)).toBe(
+      user
+    );
+    expect(statements.some((s) => s.includes('DELETE FROM login_failures'))).toBe(true);
+  });
+
+  it('a wrong password, and an unknown email, are refused after the same one comparison', async () => {
+    const { sql, user, statements } = await database();
+    const compare = vi.spyOn(bcryptjs, 'compare');
+    expect(
+      await checkCredentials(sql, { email: user.email, password: 'wrong!!' }, limits)
+    ).toBeNull();
+    expect(compare).toHaveBeenCalledTimes(1);
+    expect(
+      await checkCredentials(sql, { email: 'nobody@nextmail.com', password: 'wrong!!' }, limits)
+    ).toBeNull();
+    // An unknown email still costs a comparison: the time tells nothing (D80).
+    expect(compare).toHaveBeenCalledTimes(2);
+    expect(statements.some((s) => s.includes('DELETE FROM login_failures'))).toBe(false);
+  });
+
+  it('a locked email is refused as locked, before any comparison', async () => {
+    const { sql, user } = await database(6);
+    const compare = vi.spyOn(bcryptjs, 'compare');
+    expect(await checkCredentials(sql, { email: user.email, password: '123456' }, limits)).toBe(
+      LOCKED
+    );
+    expect(compare).not.toHaveBeenCalled();
+  });
+
+  it('credentials that are not an email and a password reach nothing', async () => {
+    const { sql, statements } = await database();
+    for (const credentials of [{}, { email: 'not-an-email', password: '123456' }, null]) {
+      expect(await checkCredentials(sql, credentials, limits)).toBeNull();
+    }
+    expect(statements).toEqual([]);
+  });
+});
diff --git a/tests/unit/password-check.test.ts b/tests/unit/password-check.test.ts
new file mode 100644
index 0000000..e3f120f
--- /dev/null
+++ b/tests/unit/password-check.test.ts
@@ -0,0 +1,31 @@
+import bcryptjs from 'bcryptjs';
+import { afterEach, describe, expect, it, vi } from 'vitest';
+import { BCRYPT_COST, passwordMatches } from '@/app/lib/password-check';
+
+describe('passwordMatches', () => {
+  afterEach(() => vi.restoreAllMocks());
+
+  it('is true for the password a hash was made from, false for any other', async () => {
+    const hash = await bcryptjs.hash('123456', BCRYPT_COST);
+    expect(await passwordMatches('123456', hash)).toBe(true);
+    expect(await passwordMatches('654321', hash)).toBe(false);
+  });
+
+  it('for an unknown email (no hash) still compares, at the same cost, and says no', async () => {
+    const compare = vi.spyOn(bcryptjs, 'compare');
+    expect(await passwordMatches('123456', undefined)).toBe(false);
+    expect(compare).toHaveBeenCalledTimes(1);
+    const [password, against] = compare.mock.calls[0] as [string, string];
+    expect(password).toBe('123456');
+    // A real bcrypt hash at the stored hashes' cost: the same work as a wrong password.
+    expect(bcryptjs.getRounds(against)).toBe(BCRYPT_COST);
+    // Not one any password a person would type is likely to match: never true.
+    expect(await passwordMatches('', undefined)).toBe(false);
+  });
+
+  it('the stored hashes are made at that cost (the seed and the password change)', async () => {
+    const { readFileSync } = await import('node:fs');
+    expect(readFileSync('scripts/db.mjs', 'utf8')).toMatch(/bcryptjs\.hash\(user\.password, 10\)/);
+    expect(BCRYPT_COST).toBe(10);
+  });
+});
~~~~

</details>

#### T12 item 5 — `night-2026-10-07-t12-5-cats-on-resize`

Cats kept on the screen when the window narrows (`cat-engine.ts` `resize`), sliding to a free spot; the layer measures the page without a scrollbar. Why: task 12, cat behaviour bugs (D82–D84).

<details><summary>Code: 4 files changed, 130 insertions(+), 2 deletions(-)</summary>

~~~~diff
diff --git a/app/ui/xenocats/cat-engine.ts b/app/ui/xenocats/cat-engine.ts
index 98d73e4..e92c06a 100644
--- a/app/ui/xenocats/cat-engine.ts
+++ b/app/ui/xenocats/cat-engine.ts
@@ -171,8 +171,51 @@ export function createCatEngine(options: {
   return {
     config,
 
-    resize(size: Size) {
+    /**
+     * The screen's new size. A cat it no longer holds (the window narrowed, a phone
+     * turned) moves in to its edge, so none is left out of sight, and along it to a
+     * spot no other cat is on, if there is one (on a screen too small for that,
+     * they share). True if any moved.
+     */
+    resize(size: Size): boolean {
       viewport = size;
+      const { catSize, margin } = config;
+      const maxX = Math.max(viewport.width - catSize - margin, margin);
+      const maxY = Math.max(viewport.height - catSize - margin, margin);
+      const clampX = (x: number) => Math.min(Math.max(x, margin), maxX);
+      const clampY = (y: number) => Math.min(Math.max(y, margin), maxY);
+      let moved = false;
+      for (const cat of cats) {
+        let x = clampX(cat.x);
+        let y = clampY(cat.y);
+        if (x === cat.x && y === cat.y) continue;
+        // As findSpot: two cats overlap unless a full cat apart on one axis.
+        const free = (px: number, py: number) =>
+          !cats.some(
+            (other) =>
+              other !== cat && Math.abs(px - other.x) < catSize && Math.abs(py - other.y) < catSize
+          );
+        if (!free(x, y)) {
+          // The nearest free spot a whole cat's step or more away along the edges.
+          search: for (let step = catSize; step <= Math.max(maxX, maxY); step += catSize) {
+            for (const [px, py] of [
+              [x, clampY(y + step)],
+              [x, clampY(y - step)],
+              [clampX(x + step), y],
+              [clampX(x - step), y],
+            ]) {
+              if (free(px, py)) {
+                [x, y] = [px, py];
+                break search;
+              }
+            }
+          }
+        }
+        cat.x = x;
+        cat.y = y;
+        moved = true;
+      }
+      return moved;
     },
 
     /**
diff --git a/app/ui/xenocats/cat-layer.tsx b/app/ui/xenocats/cat-layer.tsx
index 338c270..fde9435 100644
--- a/app/ui/xenocats/cat-layer.tsx
+++ b/app/ui/xenocats/cat-layer.tsx
@@ -107,7 +107,17 @@ export function XenocatCatsProvider({
   const wakeRef = useRef<() => void>(() => {});
 
   useEffect(() => {
-    const onResize = () => engine.resize({ width: window.innerWidth, height: window.innerHeight });
+    const onResize = () => {
+      // A cat the smaller screen no longer holds moves in: draw it there.
+      // The page's own width and height, without a scrollbar: the cat layer's size
+      // (the window's, where the page reports none, as jsdom does).
+      const page = document.documentElement;
+      const width = page.clientWidth || window.innerWidth;
+      const height = page.clientHeight || window.innerHeight;
+      if (engine.resize({ width, height })) {
+        setCats(snapshot(engine));
+      }
+    };
     onResize();
     window.addEventListener('resize', onResize);
 
diff --git a/tests/e2e/cats.spec.ts b/tests/e2e/cats.spec.ts
index 69a8b6b..eac27bd 100644
--- a/tests/e2e/cats.spec.ts
+++ b/tests/e2e/cats.spec.ts
@@ -684,3 +684,39 @@ for (const type of CAT_TYPES) {
     await expect(page.locator('html')).not.toHaveAttribute('data-xenocat-puppets');
   });
 }
+
+test('cats stay on the screen when it narrows, as when a phone is turned upright', async ({
+  page,
+}) => {
+  test.setTimeout(60_000);
+  await openCats(page);
+  // Four cats, asleep (they stay), wherever they land on the wide screen. Summoned
+  // from the keyboard: a click could land on a sleeping cat and wake it instead.
+  for (const type of CAT_TYPES.slice(0, 4)) {
+    await page.getByTestId(`summon-asleep-${type.id}`).focus();
+    await page.keyboard.press('Enter');
+  }
+  const cats = page.getByTestId('xenocat');
+  await expect(cats).toHaveCount(4);
+  await expect(page.locator('[data-testid="xenocat"][data-phase="sleeping"]')).toHaveCount(4);
+  const count = 4;
+  await page.setViewportSize({ width: 300, height: 700 });
+  // Every one is drawn inside the narrow screen, none past its edges.
+  const edges = () =>
+    cats.evaluateAll((all) =>
+      all.map((el) => {
+        const box = el.getBoundingClientRect();
+        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
+      })
+    );
+  await expect
+    .poll(async () => {
+      const boxes = await edges();
+      // All of them still there (asleep), and each inside.
+      return (
+        boxes.length === count &&
+        boxes.every((b) => b.left >= 0 && b.right <= 300 && b.top >= 0 && b.bottom <= 700)
+      );
+    })
+    .toBe(true);
+});
diff --git a/tests/unit/xenocats/cat-engine.test.ts b/tests/unit/xenocats/cat-engine.test.ts
index 68bb4c1..d8cb900 100644
--- a/tests/unit/xenocats/cat-engine.test.ts
+++ b/tests/unit/xenocats/cat-engine.test.ts
@@ -212,6 +212,45 @@ describe('where cats appear', () => {
     expect(e.cats()).toHaveLength(0);
   });
 
+  it('when the screen narrows, a cat it no longer holds moves in to its edge; one it holds stays', () => {
+    const e = engine({ seed: 3 });
+    for (const type of ['void-tabby', 'gravi-coon', 'pulsar-siamese', 'cryo-persian']) {
+      e.summon(type, 0, null, { asleep: true });
+    }
+    const { catSize, margin } = e.config;
+    const before = e.cats().map((c) => ({ x: c.x, y: c.y }));
+    expect(before.some((c) => c.x > 300 - catSize - margin)).toBe(true);
+    expect(e.resize({ width: 300, height: 600 })).toBe(true);
+    e.cats().forEach((cat, i) => {
+      expect(cat.x).toBeGreaterThanOrEqual(margin);
+      expect(cat.x + catSize).toBeLessThanOrEqual(300 - margin);
+      expect(cat.y + catSize).toBeLessThanOrEqual(600 - margin);
+      // One that fitted already has not moved.
+      if (before[i].x + catSize <= 300 - margin && before[i].y + catSize <= 600 - margin) {
+        expect({ x: cat.x, y: cat.y }).toEqual(before[i]);
+      }
+    });
+    // Moved in, they do not land on one another: the narrow screen has room.
+    for (const a of e.cats()) {
+      for (const b of e.cats()) {
+        if (a === b) continue;
+        const apart = Math.abs(a.x - b.x) >= catSize || Math.abs(a.y - b.y) >= catSize;
+        expect(apart, `cats ${a.id} and ${b.id} overlap`).toBe(true);
+      }
+    }
+    // Wider again: nothing to move.
+    expect(e.resize({ width: 1200, height: 800 })).toBe(false);
+  });
+
+  it('on a screen smaller than a cat, every cat sits at its corner', () => {
+    const e = engine({ seed: 3 });
+    e.summon('void-tabby', 0, null, { asleep: true });
+    e.summon('gravi-coon', 0, null, { asleep: true });
+    const { margin } = e.config;
+    e.resize({ width: 50, height: 50 });
+    for (const cat of e.cats()) expect({ x: cat.x, y: cat.y }).toEqual({ x: margin, y: margin });
+  });
+
   it('nowhere, when the viewport is too small for a cat', () => {
     const e = engine();
     e.resize({ width: 50, height: 50 });
~~~~

</details>

#### Checkpoint 3 — `night-2026-10-07-c3-checkpoint`

Checkpoint 3: a test for the edit action's due-date refusal; the edit form names the invoice date. Why: the plan's checkpoint (D85).

<details><summary>Code: 2 files changed, 18 insertions(+), 1 deletion(-)</summary>

~~~~diff
diff --git a/app/ui/invoices/edit-form.tsx b/app/ui/invoices/edit-form.tsx
index 66c9a72..3f413b5 100644
--- a/app/ui/invoices/edit-form.tsx
+++ b/app/ui/invoices/edit-form.tsx
@@ -99,7 +99,7 @@ export default function EditInvoiceForm({
             <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-aura peer-focus:text-plasma" />
           </div>
           <p id="due-date-help" className="mt-2 text-xs text-aura">
-            Not before the invoice date, and at most a year after it.
+            Not before the invoice date ({invoice.date}), and at most a year after it.
           </p>
           <div id="due-date-error" aria-live="polite" aria-atomic="true">
             {state.errors?.dueDate &&
diff --git a/tests/unit/actions.test.ts b/tests/unit/actions.test.ts
index d4864db..b9ed9f3 100644
--- a/tests/unit/actions.test.ts
+++ b/tests/unit/actions.test.ts
@@ -134,6 +134,23 @@ describe('with a session', () => {
     consoleError.mockRestore();
   });
 
+  it("updateInvoice reports the database's own due-date check as the field's error", async () => {
+    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
+    sql.mockResolvedValueOnce([{ date: '2026-01-10' }]).mockRejectedValueOnce(
+      Object.assign(new Error('violates check constraint'), {
+        constraint_name: 'invoices_due_date_check',
+      })
+    );
+    const result = await updateInvoice(
+      'cc27c14a-0acf-4f4a-a6c9-d45682c144b9',
+      {},
+      invoiceForm({ dueDate: '2026-02-09' })
+    );
+    expect(result.errors?.dueDate).toEqual(['The due date cannot be before the invoice date.']);
+    expect(redirect).not.toHaveBeenCalled();
+    consoleError.mockRestore();
+  });
+
   it('createInvoice still validates the form', async () => {
     const result = await createInvoice({}, invoiceForm({ amount: '0' }));
     expect(result.errors?.amount).toEqual(['Please enter an amount greater than $0']);
~~~~

</details>

#### T12 item 6 — `night-2026-10-07-t12-6-evolutions`

Two evolutions: Banquet (Cat Treats + Long Whiskers, a ring of treats) and Monsoon (Spray Bottle + Wool Sweater); no "the The" in announcements. Why: task 12, the Survival game (D86–D87).

<details><summary>Code: 4 files changed, 90 insertions(+), 2 deletions(-)</summary>

~~~~diff
diff --git a/app/ui/xenocats/arena-view.tsx b/app/ui/xenocats/arena-view.tsx
index f7bd3f4..d428c4c 100644
--- a/app/ui/xenocats/arena-view.tsx
+++ b/app/ui/xenocats/arena-view.tsx
@@ -50,7 +50,9 @@ type Screen = 'start' | 'playing' | 'choosing' | 'paused' | 'results';
 /** How each weapon's shots are drawn. */
 const SHOT_COLOR: Record<string, string> = {
   'cat-treats': '#fbbf24',
+  banquet: '#fbbf24',
   'spray-bottle': '#7dd3fc',
+  monsoon: '#38bdf8',
   'yarn-ball': '#f472b6',
   'yarn-apocalypse': '#ec4899',
   hairball: '#a8865b',
diff --git a/app/ui/xenocats/arsenal.ts b/app/ui/xenocats/arsenal.ts
index c80508e..19ace49 100644
--- a/app/ui/xenocats/arsenal.ts
+++ b/app/ui/xenocats/arsenal.ts
@@ -26,6 +26,8 @@ export type WeaponId =
   | 'infinite-laser'
   | 'forbidden-catnip-vacuum'
   | 'yarn-apocalypse'
+  | 'banquet'
+  | 'monsoon'
   | 'bottomless-saucer';
 
 export type PassiveId =
@@ -289,6 +291,37 @@ export const WEAPONS: Readonly<Record<WeaponId, WeaponInfo>> = {
       pierce: 4,
     }),
   },
+  banquet: {
+    name: 'Banquet',
+    description: 'Treats in every direction at once. Every cat is invited; every cat goes home.',
+    kind: 'spread',
+    levels: fixed({
+      cooldownMs: 500,
+      damage: 40,
+      area: 14,
+      // A ring of treats: a spread turns 0.16 rad between each, so 39 go almost all
+      // the way round him (348°).
+      count: 39,
+      speed: 560,
+      durationMs: 1800,
+      pierce: 8,
+    }),
+  },
+  monsoon: {
+    name: 'Monsoon',
+    description: 'The bottle, but the sky. A wall of water the way he faces, and it does not stop.',
+    kind: 'arc',
+    levels: fixed({
+      cooldownMs: 600,
+      damage: 30,
+      // The arc's droplets: bigger, and they fly further.
+      area: 220,
+      count: 32,
+      speed: 520,
+      durationMs: 650,
+      pierce: 8,
+    }),
+  },
   'bottomless-saucer': {
     name: 'Bottomless Saucer',
     description: 'Warm milk, circling him without end. No cat has ever refused it.',
@@ -315,6 +348,8 @@ export const EVOLUTIONS: readonly Evolution[] = [
   { from: 'laser-pointer', with: 'battery', to: 'infinite-laser' },
   { from: 'vacuum-cleaner', with: 'catnip', to: 'forbidden-catnip-vacuum' },
   { from: 'yarn-ball', with: 'scissors', to: 'yarn-apocalypse' },
+  { from: 'cat-treats', with: 'long-whiskers', to: 'banquet' },
+  { from: 'spray-bottle', with: 'wool-sweater', to: 'monsoon' },
   { from: 'can-opener', with: 'warm-milk', to: 'bottomless-saucer', secret: true },
 ];
 
@@ -500,5 +535,9 @@ export function describeChoice(choice: Choice): { name: string; description: str
 
 /** An evolution, announced with due gravity. */
 export function evolutionText(from: WeaponId, to: WeaponId): string {
-  return `The ${WEAPONS[from].name} is no more. In its place: the ${WEAPONS[to].name}.`;
+  return `${the(WEAPONS[from].name, 'The')} is no more. In its place: ${the(WEAPONS[to].name, 'the')}.`;
 }
+
+/** A name with its article ("the Yarn Ball"), unless it brings its own ("The Matriarch"). */
+const the = (name: string, article: 'The' | 'the') =>
+  /^The /.test(name) ? name : `${article} ${name}`;
diff --git a/tests/e2e/survival.spec.ts b/tests/e2e/survival.spec.ts
index 85e541d..7c3722e 100644
--- a/tests/e2e/survival.spec.ts
+++ b/tests/e2e/survival.spec.ts
@@ -334,7 +334,8 @@ test.describe('on a computer', () => {
       .toBe(true);
     const codex = page.getByTestId('survival-codex');
     await expect(codex.getByText('Yarn Apocalypse')).toBeVisible();
-    await expect(codex.getByRole('listitem').filter({ hasText: '???' })).toHaveCount(4);
+    // Six evolutions and the secret cat: one found, the rest unknown.
+    await expect(codex.getByRole('listitem').filter({ hasText: '???' })).toHaveCount(6);
     // Kept after a reload; he goes out as the Night Porter, with the Spray Bottle.
     await page.reload();
     await expect(porter).toBeChecked();
diff --git a/tests/unit/xenocats/arsenal.test.ts b/tests/unit/xenocats/arsenal.test.ts
index d10bb49..dacab7f 100644
--- a/tests/unit/xenocats/arsenal.test.ts
+++ b/tests/unit/xenocats/arsenal.test.ts
@@ -572,6 +572,11 @@ describe('evolution', () => {
     expect(evolutionText('yarn-ball', 'yarn-apocalypse')).toBe(
       'The Yarn Ball is no more. In its place: the Yarn Apocalypse.'
     );
+    expect(evolutionText('cat-treats', 'banquet')).toBe(
+      'The Cat Treats is no more. In its place: the Banquet.'
+    );
+    // Every evolution reads as a sentence: never "the The".
+    for (const { from, to } of EVOLUTIONS) expect(evolutionText(from, to)).not.toMatch(/the The/i);
   });
 
   /** A run with only `id`, many cats that never go home unless it sends them. */
@@ -635,6 +640,47 @@ describe('evolution', () => {
     expect(mostAtOnce).toBeGreaterThanOrEqual(10);
   });
 
+  /**
+   * Cats sent home in 30 s by `id` alone, at its top level, from a steady horde of
+   * sturdy cats: sturdy, so the weapon decides how many go, not how fast they come.
+   */
+  function sentHomeBy(id: WeaponId) {
+    const a = arena({
+      ...steady,
+      startingWeapons: [id],
+      startingLevel: MAX_WEAPON_LEVEL,
+      escalation: [[0, 120]],
+      cats: { ...ARENA_CONFIG.cats, eliteShare: 0, homesickness: [150, 150] },
+    });
+    while (a.state().time < 30_000) a.step(still);
+    return a.state().sentHome;
+  }
+
+  /** The widest gap between the ways one throw's shots fly, radians (a ring has none wide). */
+  function widestGap(id: WeaponId) {
+    const a = evolved(id);
+    while (a.state().projectiles === 0 && a.state().time < 20_000) a.step(still);
+    expect(a.state().projectiles).toBe(weaponStats(id, MAX_WEAPON_LEVEL, none).count);
+    const ways = a
+      .projectiles()
+      .map((p) => Math.atan2(p.vy, p.vx))
+      .sort((u, v) => u - v);
+    let widest = ways[0] + 2 * Math.PI - ways[ways.length - 1];
+    for (let i = 1; i < ways.length; i++) widest = Math.max(widest, ways[i] - ways[i - 1]);
+    return widest;
+  }
+
+  it('the Banquet sends home more than Cat Treats at their best, in a ring', () => {
+    expect(sentHomeBy('banquet')).toBeGreaterThan(sentHomeBy('cat-treats') * 1.5);
+    // A ring: no way out of it is wider than an eighth of a turn; Cat Treats are a fan.
+    expect(widestGap('banquet')).toBeLessThan(Math.PI / 4);
+    expect(widestGap('cat-treats')).toBeGreaterThan(Math.PI);
+  });
+
+  it('Monsoon sends home more than the Spray Bottle at its best', () => {
+    expect(sentHomeBy('monsoon')).toBeGreaterThan(sentHomeBy('spray-bottle') * 1.5);
+  });
+
   it('the Yarn Apocalypse: its balls split as they bounce, up to a limit', () => {
     const a = evolved('yarn-apocalypse');
     const s = weaponStats('yarn-apocalypse', MAX_WEAPON_LEVEL, none);
~~~~

</details>

#### T12 item 7 — `night-2026-10-07-t12-7-due-column`

The invoice list shows a Due column (a due line on phones); the table scrolls on its own. Why: task 12, dashboard features (D88–D89).

<details><summary>Code: 5 files changed, 36 insertions(+), 1 deletion(-)</summary>

~~~~diff
diff --git a/app/lib/data.ts b/app/lib/data.ts
index 6f18923..738f14d 100644
--- a/app/lib/data.ts
+++ b/app/lib/data.ts
@@ -162,6 +162,7 @@ export async function fetchFilteredInvoices(
         invoices.id,
         invoices.amount,
         invoices.date,
+        invoices.due_date,
         invoices.status,
         ${isOverdue()} AS overdue,
         customers.name,
diff --git a/app/lib/definitions.ts b/app/lib/definitions.ts
index 92e1f44..3aaa647 100644
--- a/app/lib/definitions.ts
+++ b/app/lib/definitions.ts
@@ -63,6 +63,7 @@ export type InvoicesTable = {
   email: string;
   image_url: string;
   date: string;
+  due_date: string;
   amount: number;
   status: 'pending' | 'paid';
   /** Pending and past its due date. */
diff --git a/app/ui/invoices/table.tsx b/app/ui/invoices/table.tsx
index be811e0..bb7f87f 100644
--- a/app/ui/invoices/table.tsx
+++ b/app/ui/invoices/table.tsx
@@ -22,7 +22,9 @@ export default async function InvoicesTable({
   const invoices = await fetchFilteredInvoices(query, currentPage, status);
 
   return (
-    <div className="mt-6 flow-root">
+    // Its own sideways scroll where the columns need more room than there is (as the
+    // customers table): the page around it stays put.
+    <div className="mt-6 flow-root overflow-x-auto">
       <div className="inline-block min-w-full align-middle">
         <div data-xenocat-frame className="rounded-2xl border border-line bg-panel p-2 md:pt-0">
           <div className="md:hidden">
@@ -44,6 +46,7 @@ export default async function InvoicesTable({
                       {formatCurrency(invoice.amount)}
                     </p>
                     <p>{formatDateToLocal(invoice.date)}</p>
+                    <p className="text-sm text-aura">Due {formatDateToLocal(invoice.due_date)}</p>
                   </div>
                   <div className="flex justify-end gap-2">
                     <ViewInvoice id={invoice.id} label={label(invoice)} />
@@ -69,6 +72,9 @@ export default async function InvoicesTable({
                 <th scope="col" className="px-3 py-5 font-medium">
                   Date
                 </th>
+                <th scope="col" className="px-3 py-5 font-medium">
+                  Due
+                </th>
                 <th scope="col" className="px-3 py-5 font-medium">
                   Status
                 </th>
@@ -92,6 +98,9 @@ export default async function InvoicesTable({
                   <td className="whitespace-nowrap px-3 py-3">{invoice.email}</td>
                   <td className="whitespace-nowrap px-3 py-3">{formatCurrency(invoice.amount)}</td>
                   <td className="whitespace-nowrap px-3 py-3">{formatDateToLocal(invoice.date)}</td>
+                  <td className="whitespace-nowrap px-3 py-3">
+                    {formatDateToLocal(invoice.due_date)}
+                  </td>
                   <td className="whitespace-nowrap px-3 py-3">
                     <InvoiceStatus status={invoice.status} overdue={invoice.overdue} />
                   </td>
diff --git a/tests/e2e/invoices.spec.ts b/tests/e2e/invoices.spec.ts
index b7e7347..6fe6017 100644
--- a/tests/e2e/invoices.spec.ts
+++ b/tests/e2e/invoices.spec.ts
@@ -1,5 +1,6 @@
 import { type Page, expect, test } from '@playwright/test';
 import { addDays } from '@/app/lib/schemas';
+import { formatDateToLocal } from '@/app/lib/utils';
 
 // Invoice create, edit and delete through the forms, logged in as the demo user,
 // against the test schema global-setup.ts rebuilds. Each test makes its own
@@ -147,6 +148,10 @@ test('an invoice is due when the form says: 30 days by default, never before its
   await page.getByRole('button', { name: 'Create Invoice' }).click();
   await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });
 
+  // The list shows it, under its own heading.
+  await expect(page.getByRole('columnheader', { name: 'Due', exact: true })).toBeVisible();
+  await expect(await rowsFor(page, cents)).toContainText(formatDateToLocal(addDays(today, 45)));
+
   // Kept: the edit form shows it.
   await (await rowsFor(page, cents)).getByRole('link', { name: 'Edit' }).click();
   await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]{36}\/edit$/);
@@ -189,3 +194,17 @@ test('an invoice is deleted, and stays deleted after a reload', async ({ page })
   // A fresh load of the list (a page load waits for the whole streamed table).
   await expect(await rowsFor(page, cents)).toHaveCount(0);
 });
+
+test.describe('on a phone', () => {
+  test.use({ viewport: { width: 390, height: 844 } });
+
+  test('each invoice card shows its due date under its date', async ({ page }) => {
+    await logIn(page);
+    await page.goto('/dashboard/invoices');
+    // The phone layout's cards (the table is hidden at this width).
+    await expect(page.locator('table').first()).toBeHidden();
+    const dues = page.getByText(/^Due [A-Z][a-z]{2} \d{1,2}, \d{4}$/);
+    await expect(dues.first()).toBeVisible();
+    expect(await dues.count()).toBeGreaterThan(0);
+  });
+});
diff --git a/tests/unit/data.test.ts b/tests/unit/data.test.ts
index 61af3ab..29d2373 100644
--- a/tests/unit/data.test.ts
+++ b/tests/unit/data.test.ts
@@ -152,6 +152,11 @@ describe.skipIf(!url)('the queries in app/lib/data.ts', () => {
       expect((await data.fetchFilteredInvoices('44800', 1)).map((row) => row.amount)).toEqual([
         44800,
       ]);
+      // Each row carries its due date (the list shows it).
+      const [due] = await data.fetchFilteredInvoices('44800', 1);
+      expect(day(due.due_date)).toBe(
+        invoices.find((invoice) => invoice.amount === 44800)!.due_date
+      );
       expect(
         (await data.fetchFilteredInvoices('2022-11-14', 1)).map((row) => day(row.date))
       ).toEqual(['2022-11-14']);
~~~~

</details>

#### T12 item 8 — `night-2026-10-07-t12-8-dev-flakes`

Two flaky browser specs' page-change waits get 15 s, as after a submit. Why: task 12, tests; this run's Q7 (D90–D91).

<details><summary>Code: 2 files changed, 20 insertions(+), 11 deletions(-)</summary>

~~~~diff
diff --git a/tests/e2e/customers.spec.ts b/tests/e2e/customers.spec.ts
index 7e86749..4beccad 100644
--- a/tests/e2e/customers.spec.ts
+++ b/tests/e2e/customers.spec.ts
@@ -5,16 +5,18 @@ import { type Page, expect, test } from '@playwright/test';
 // only on it, since the tests run in parallel on one schema.
 test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');
 
+// After a submit or a link, allow for the next page still compiling under a busy
+// next dev, which builds each route on its first visit (questions.md Q7).
+const NAVIGATION = 15_000;
+
 async function logIn(page: Page) {
   await page.goto('/login');
   await page.getByLabel('Email').fill('user@nextmail.com');
   await page.getByLabel('Password', { exact: true }).fill('123456');
   await page.getByRole('button', { name: /log in/i }).click();
-  await expect(page).toHaveURL(/\/dashboard$/);
+  await expect(page).toHaveURL(/\/dashboard$/, { timeout: NAVIGATION });
 }
 
-// After a submit, allow for the redirect's page still compiling under next dev.
-
 /** A customer name no other test (or run) uses. */
 const unique = (what: string) =>
   `${what} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
@@ -24,7 +26,7 @@ async function createCustomer(page: Page, name: string, email: string) {
   await page.getByLabel('Name').fill(name);
   await page.getByLabel('Email').fill(email);
   await page.getByRole('button', { name: 'Create Customer' }).click();
-  await expect(page).toHaveURL(/\/dashboard\/customers$/, { timeout: 15_000 });
+  await expect(page).toHaveURL(/\/dashboard\/customers$/, { timeout: NAVIGATION });
 }
 
 /** The customer list, searched down to `name`. */
@@ -34,6 +36,8 @@ async function findCustomer(page: Page, name: string) {
 }
 
 test('a customer is created, edited and deleted', async ({ page }) => {
+  // Five page changes, each allowed NAVIGATION: more than the default 30 s in all.
+  test.setTimeout(60_000);
   await logIn(page);
   const name = unique('Orbital Snacks');
   const email = `${name.split(' ').pop()}@example.com`;
@@ -45,12 +49,13 @@ test('a customer is created, edited and deleted', async ({ page }) => {
 
   // Edit: the form shows the current values; the list shows the new ones.
   await row.getByRole('link', { name: `Edit ${name}` }).click();
-  await expect(page.getByLabel('Name')).toHaveValue(name);
+  await expect(page).toHaveURL(/\/edit$/, { timeout: NAVIGATION });
+  await expect(page.getByLabel('Name')).toHaveValue(name, { timeout: NAVIGATION });
   await expect(page.getByLabel('Email')).toHaveValue(email);
   const renamed = `${name} Ltd`;
   await page.getByLabel('Name').fill(renamed);
   await page.getByRole('button', { name: 'Save Customer' }).click();
-  await expect(page).toHaveURL(/\/dashboard\/customers$/, { timeout: 15_000 });
+  await expect(page).toHaveURL(/\/dashboard\/customers$/, { timeout: NAVIGATION });
   row = await findCustomer(page, renamed);
   await expect(row).toHaveCount(1);
 
@@ -85,7 +90,7 @@ test('a customer who still has invoices cannot be deleted, and the list says why
   await page.getByLabel('Choose an amount').fill('42');
   await page.getByLabel('Pending').check();
   await page.getByRole('button', { name: 'Create Invoice' }).click();
-  await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });
+  await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: NAVIGATION });
 
   const row = await findCustomer(page, name);
   const remove = row.getByRole('button', { name: `Delete ${name}` });
diff --git a/tests/e2e/keyboard.spec.ts b/tests/e2e/keyboard.spec.ts
index 5ffd24a..7ef6333 100644
--- a/tests/e2e/keyboard.spec.ts
+++ b/tests/e2e/keyboard.spec.ts
@@ -4,6 +4,10 @@ import { type Page, expect, test } from '@playwright/test';
 // ring on everything Tab reaches, and every control named. The cats never touch
 // the keyboard (a plan-wide rule), so these tests do not wait for them to leave.
 
+// After a submit or a link, allow for the next page still compiling under a busy
+// next dev, which builds each route on its first visit (questions.md Q7).
+const NAVIGATION = 15_000;
+
 /**
  * Whether the focused element shows that it has focus the way the app draws it:
  * a solid, opaque outline at least 2px wide (the base :focus-visible rule, or a
@@ -101,7 +105,7 @@ test.describe('logged in', () => {
     await page.getByLabel('Email').fill('user@nextmail.com');
     await page.getByLabel('Password', { exact: true }).fill('123456');
     await page.getByLabel('Password', { exact: true }).press('Enter');
-    await expect(page).toHaveURL(/\/dashboard$/);
+    await expect(page).toHaveURL(/\/dashboard$/, { timeout: NAVIGATION });
     await page.goto('/dashboard');
     await page.waitForLoadState('networkidle');
 
@@ -117,13 +121,13 @@ test.describe('logged in', () => {
     await page.waitForLoadState('networkidle');
     await tabTo(page, (f) => f.tag === 'A' && f.text === 'Invoices');
     await page.keyboard.press('Enter');
-    await expect(page).toHaveURL(/\/dashboard\/invoices$/);
+    await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: NAVIGATION });
     await page.waitForLoadState('networkidle');
 
     // And on to the search, typed into without the mouse.
     await tabTo(page, (f) => f.id === 'search');
     await page.keyboard.type('Amy');
-    await expect(page).toHaveURL(/query=Amy/);
+    await expect(page).toHaveURL(/query=Amy/, { timeout: NAVIGATION });
   });
 
   test('every control on the dashboard pages has a name', async ({ page }) => {
@@ -133,7 +137,7 @@ test.describe('logged in', () => {
     await page.getByLabel('Email').fill('user@nextmail.com');
     await page.getByLabel('Password', { exact: true }).fill('123456');
     await page.getByRole('button', { name: /log in/i }).click();
-    await expect(page).toHaveURL(/\/dashboard$/);
+    await expect(page).toHaveURL(/\/dashboard$/, { timeout: NAVIGATION });
     for (const path of [
       '/dashboard',
       '/dashboard/invoices',
~~~~

</details>

#### T12 item 9 — `night-2026-10-07-t12-9-no-debug-log`

A debug `console.log` of invoice data removed; ESLint `no-console` for the app's code; two invoice browser tests repaired after item 7's column. Why: task 12, security and quality (D92–D94).

<details><summary>Code: 4 files changed, 16 insertions(+), 4 deletions(-)</summary>

~~~~diff
diff --git a/app/lib/data.ts b/app/lib/data.ts
index 738f14d..20063b8 100644
--- a/app/lib/data.ts
+++ b/app/lib/data.ts
@@ -282,8 +282,6 @@ export async function fetchInvoiceById(id: string) {
       amount: invoice.amount / 100,
     }));
 
-    console.log(invoice);
-
     return invoice[0];
   } catch (error) {
     console.error('Database Error:', error);
diff --git a/eslint.config.mjs b/eslint.config.mjs
index 8d76d03..dd2b8e0 100644
--- a/eslint.config.mjs
+++ b/eslint.config.mjs
@@ -3,6 +3,13 @@ import nextVitals from 'eslint-config-next/core-web-vitals';
 
 const eslintConfig = defineConfig([
   ...nextVitals,
+  {
+    // The app logs only what goes wrong (console.error, console.warn): no debug
+    // output, which can carry customers' data into the server's logs. Scripts and
+    // tests may print.
+    files: ['app/**', 'auth.ts', 'auth.config.ts', 'proxy.ts'],
+    rules: { 'no-console': ['error', { allow: ['error', 'warn'] }] },
+  },
   globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
 ]);
 
diff --git a/tests/e2e/invoices-filter.spec.ts b/tests/e2e/invoices-filter.spec.ts
index 42b8803..41efa22 100644
--- a/tests/e2e/invoices-filter.spec.ts
+++ b/tests/e2e/invoices-filter.spec.ts
@@ -145,6 +145,9 @@ test('a new unpaid invoice is due in 30 days: pending, not overdue', async ({ pa
   // The detail page gives its due date: 30 days after today.
   await page.goto(`/dashboard/invoices?query=${tag}`);
   await rows(page).first().getByRole('link', { name: /view/i }).click();
+  // On the invoice's own page (the list has a "Due" column too: the check below must
+  // not run on the list it is leaving).
+  await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]{36}$/, { timeout: 15_000 });
   const due = new Date(Date.now() + 30 * 86_400_000);
   const shown = due.toLocaleDateString('en-US', {
     day: 'numeric',
@@ -152,7 +155,8 @@ test('a new unpaid invoice is due in 30 days: pending, not overdue', async ({ pa
     year: 'numeric',
     timeZone: 'UTC',
   });
-  await expect(page.getByText('Due', { exact: true })).toBeVisible();
+  // The invoice's own "Due" (a term in its details), not the list's column heading.
+  await expect(page.locator('dt').filter({ hasText: /^Due$/ })).toBeVisible();
   await expect(page.getByText(shown)).toHaveCount(1);
 });
 
diff --git a/tests/e2e/invoices.spec.ts b/tests/e2e/invoices.spec.ts
index 6fe6017..38583ca 100644
--- a/tests/e2e/invoices.spec.ts
+++ b/tests/e2e/invoices.spec.ts
@@ -150,7 +150,10 @@ test('an invoice is due when the form says: 30 days by default, never before its
 
   // The list shows it, under its own heading.
   await expect(page.getByRole('columnheader', { name: 'Due', exact: true })).toBeVisible();
-  await expect(await rowsFor(page, cents)).toContainText(formatDateToLocal(addDays(today, 45)));
+  // One row (the list streams in, and for a moment can be there twice), then its date.
+  const listed = await rowsFor(page, cents);
+  await expect(listed).toHaveCount(1);
+  await expect(listed).toContainText(formatDateToLocal(addDays(today, 45)));
 
   // Kept: the edit form shows it.
   await (await rowsFor(page, cents)).getByRole('link', { name: 'Edit' }).click();
~~~~

</details>

#### T12 item 10 — `night-2026-10-07-t12-10-cat-invariants`

A random-play invariant test of the cat engine (no bug found). Why: task 12, cat behaviour bugs (D95–D96).

<details><summary>Code: 2 files changed, 111 insertions(+), 1 deletion(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index a68f72b..ed8a7d7 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -37,7 +37,7 @@ jobs:
         if: ${{ !cancelled() }}
         run: >-
           npx vitest run tests/unit/xenocats/random tests/unit/xenocats/effects
-          tests/unit/xenocats/cursor-controller tests/unit/xenocats/cat-engine
+          tests/unit/xenocats/cursor-controller tests/unit/xenocats/cat-engine tests/unit/xenocats/cat-engine-invariants
           tests/unit/xenocats/cat-types tests/unit/xenocats/intensity
       - name: Unit tests (cats, jsdom)
         if: ${{ !cancelled() }}
diff --git a/tests/unit/xenocats/cat-engine-invariants.test.ts b/tests/unit/xenocats/cat-engine-invariants.test.ts
new file mode 100644
index 0000000..a4d447e
--- /dev/null
+++ b/tests/unit/xenocats/cat-engine-invariants.test.ts
@@ -0,0 +1,110 @@
+import { describe, expect, it } from 'vitest';
+import { type Cat, createCatEngine } from '@/app/ui/xenocats/cat-engine';
+import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
+import { CAT_CONFIG } from '@/app/ui/xenocats/config';
+import { createRandom } from '@/app/ui/xenocats/random';
+
+// The cat engine played at random — cats summoned asleep and awake, clicked, the
+// window resized and the intensity changed, ticks of every length, the pointer on
+// and off the page, attacks that land or wait — and after every step, what must
+// always hold. A seeded run: the same steps every time.
+
+const PHASES = ['appearing', 'sleeping', 'waking', 'ready', 'attacking', 'leaving'];
+
+/** What is wrong with the cats as they stand on a screen of `viewport`, if anything. */
+function problems(cats: readonly Cat[], viewport: { width: number; height: number }) {
+  const found: string[] = [];
+  const { catSize, margin } = CAT_CONFIG;
+  const roomy = viewport.width >= catSize + 2 * margin && viewport.height >= catSize + 2 * margin;
+  if (cats.length > 5) found.push(`${cats.length} cats`);
+  for (const cat of cats) {
+    if (!Number.isFinite(cat.x) || !Number.isFinite(cat.y)) found.push(`cat ${cat.id} nowhere`);
+    if (
+      roomy &&
+      (cat.x < margin ||
+        cat.y < margin ||
+        cat.x + catSize > viewport.width - margin + 1e-9 ||
+        cat.y + catSize > viewport.height - margin + 1e-9)
+    ) {
+      found.push(`cat ${cat.id} off the screen`);
+    }
+    if (!PHASES.includes(cat.phase)) found.push(`cat ${cat.id} in phase ${cat.phase}`);
+    if (cat.phase !== 'ready' && !Number.isFinite(cat.phaseEndsAt)) {
+      found.push(`cat ${cat.id} ${cat.phase} for ever`);
+    }
+    if (cat.comboWith !== null) {
+      const partner = cats.find((other) => other.id === cat.comboWith);
+      if (!partner) found.push(`cat ${cat.id}'s partner is gone`);
+      else if (partner.comboWith !== cat.id) found.push(`cat ${cat.id}'s partner is not`);
+    }
+  }
+  // One combo at a time: a single pair at most.
+  if (cats.filter((cat) => cat.comboWith !== null).length > 2) found.push('more than one pair');
+  return found;
+}
+
+describe('the cats, played at random', () => {
+  it('never more than five, all on the screen, every phase known and timed, partners paired', () => {
+    const seen = new Set<string>();
+    let summoned = 0;
+    let poked = 0;
+    let resized = 0;
+    for (let seed = 1; seed <= 150; seed++) {
+      const play = createRandom(seed * 7919);
+      let viewport = { width: 1200, height: 800 };
+      const engine = createCatEngine({
+        random: createRandom(seed),
+        types: CAT_TYPES,
+        viewport,
+        autoSpawn: play.next() < 0.5,
+      });
+      let now = 0;
+      for (let step = 0; step < 300; step++) {
+        now += play.range(5, 900);
+        const roll = play.next();
+        if (roll < 0.1) {
+          if (engine.summon(play.pick(CAT_TYPES).id, now, null, { asleep: play.next() < 0.5 })) {
+            summoned++;
+          }
+        } else if (roll < 0.2) {
+          const cats = engine.cats();
+          if (cats.length > 0) {
+            const cat = cats[play.int(0, cats.length - 1)];
+            if (engine.poke(engine.centreOf(cat), now)) poked++;
+          }
+        } else if (roll < 0.25) {
+          viewport = {
+            width: Math.round(play.range(60, 1600)),
+            height: Math.round(play.range(60, 1000)),
+          };
+          engine.resize(viewport);
+          resized++;
+        } else if (roll < 0.27) {
+          engine.configure({ maxCats: play.int(1, 5) });
+        }
+        const pointer =
+          play.next() < 0.5
+            ? { x: play.range(0, viewport.width), y: play.range(0, viewport.height) }
+            : null;
+        engine.tick(now, pointer, () => play.next() < 0.8);
+        for (const problem of problems(engine.cats(), viewport))
+          seen.add(`seed ${seed}: ${problem}`);
+      }
+      // And none stays for ever: given time, with the pointer on the page and every
+      // attack landing, each cat on screen now (asleep, ready, paired) has left.
+      const before = new Set(engine.cats().map((cat) => cat.id));
+      for (let wait = 0; wait < 20; wait++) {
+        now += 30_000;
+        engine.tick(now, { x: 1, y: 1 }, () => true);
+      }
+      for (const cat of engine.cats()) {
+        if (before.has(cat.id)) seen.add(`seed ${seed}: cat ${cat.id} stays (${cat.phase})`);
+      }
+    }
+    expect([...seen]).toEqual([]);
+    // It played: cats came, were clicked awake, and the screen changed size.
+    expect(summoned).toBeGreaterThan(500);
+    expect(poked).toBeGreaterThan(100);
+    expect(resized).toBeGreaterThan(1000);
+  });
+});
~~~~

</details>

#### Checkpoint 4 — `night-2026-10-07-c4-checkpoint`

Checkpoint 4: the phone-layout test proves each card's own due date. Why: the plan's checkpoint (D97).

<details><summary>Code: 1 file changed, 19 insertions(+), 5 deletions(-)</summary>

~~~~diff
diff --git a/tests/e2e/invoices.spec.ts b/tests/e2e/invoices.spec.ts
index 38583ca..d7cb80f 100644
--- a/tests/e2e/invoices.spec.ts
+++ b/tests/e2e/invoices.spec.ts
@@ -201,13 +201,27 @@ test('an invoice is deleted, and stays deleted after a reload', async ({ page })
 test.describe('on a phone', () => {
   test.use({ viewport: { width: 390, height: 844 } });
 
-  test('each invoice card shows its due date under its date', async ({ page }) => {
+  test('an invoice card shows its own due date under its date', async ({ page }) => {
+    test.setTimeout(60_000);
     await logIn(page);
-    await page.goto('/dashboard/invoices');
+    // An invoice due 45 days on: not the default, so the card must show its due date.
+    const cents = uniqueCents();
+    const today = new Date().toISOString().slice(0, 10);
+    await openCreateForm(page);
+    await page.getByLabel('Choose customer').selectOption({ label: 'Amy Burns' });
+    await page.getByLabel('Choose an amount').fill((cents / 100).toFixed(2));
+    await page.getByLabel('Pending').check();
+    await page.getByLabel('Due date').fill(addDays(today, 45));
+    await page.getByRole('button', { name: 'Create Invoice' }).click();
+    await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });
+
+    await page.goto(`/dashboard/invoices?query=${cents}`);
     // The phone layout's cards (the table is hidden at this width).
     await expect(page.locator('table').first()).toBeHidden();
-    const dues = page.getByText(/^Due [A-Z][a-z]{2} \d{1,2}, \d{4}$/);
-    await expect(dues.first()).toBeVisible();
-    expect(await dues.count()).toBeGreaterThan(0);
+    // The search leaves only this invoice (its card can show twice for a moment as the
+    // list streams in): its due date, under its date.
+    await expect(
+      page.getByText(`Due ${formatDateToLocal(addDays(today, 45))}`, { exact: true }).first()
+    ).toBeVisible();
   });
 });
~~~~

</details>

#### T12 item 11 — `night-2026-10-07-t12-11-balance`

A seeded balance test: walking outlasts standing still (no number changed). Why: task 12, the Survival game (D98–D99).

<details><summary>Code: 1 file changed, 42 insertions(+)</summary>

~~~~diff
diff --git a/tests/unit/xenocats/arena.test.ts b/tests/unit/xenocats/arena.test.ts
index 5363eb3..6e04a0e 100644
--- a/tests/unit/xenocats/arena.test.ts
+++ b/tests/unit/xenocats/arena.test.ts
@@ -448,3 +448,45 @@ describe('the best time', () => {
     expect(clockText(300_000)).toBe('5:00');
   });
 });
+
+describe('balance: positioning is the skill', () => {
+  /**
+   * How long a Keeper lasts in the game as configured (seeded; stepped at 50 ms, as
+   * the arsenal's simulation tests are), standing still or walking a wide circle. The
+   * secret cat is left out: it comes only to a Keeper who stands still, and his
+   * laser would spend itself on a cat that does no harm — another effect than this.
+   */
+  function lasts(seed: number, walking: boolean) {
+    const a = createArena({
+      random: createRandom(seed),
+      types: CAT_TYPES,
+      viewport,
+      config: { stepMs: 50, secretCat: { afterMs: Infinity, stillMs: Infinity } },
+    });
+    while (a.state().status !== 'over' && a.state().time < 300_000) {
+      // The same policy for both: the first of each level-up's offer.
+      if (a.choices()) {
+        a.choose(0);
+        continue;
+      }
+      const t = a.state().time / 4000;
+      a.step(walking ? { x: Math.cos(t), y: Math.sin(t) } : { x: 0, y: 0 });
+    }
+    return a.state().time;
+  }
+
+  it('a Keeper who stands still is worn down early; one who keeps walking lasts much longer', () => {
+    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
+    const still = seeds.map((seed) => lasts(seed, false));
+    const walking = seeds.map((seed) => lasts(seed, true));
+    const ratios = seeds.map((_, i) => walking[i] / still[i]).sort((a, b) => a - b);
+    // Standing still: gone within the first two minutes, every time.
+    for (const ms of still) expect(ms).toBeLessThan(100_000);
+    // Walking: twice as long in the middle of the seeds; more than half as long again
+    // on all but one; past two minutes on most. (Counts, not every seed, so a change
+    // that only reshuffles the shared random draws does not fail it on one seed.)
+    expect((ratios[3] + ratios[4]) / 2).toBeGreaterThan(2);
+    expect(ratios.filter((r) => r > 1.5).length).toBeGreaterThanOrEqual(7);
+    expect(walking.filter((ms) => ms > 120_000).length).toBeGreaterThanOrEqual(6);
+  }, 60_000);
+});
~~~~

</details>

#### T12 item 12 — `night-2026-10-07-t12-12-due-in`

An unpaid invoice's page says "Due in N days" / "Overdue by N days", counted by the database. Why: task 12, dashboard features (D100–D102).

<details><summary>Code: 7 files changed, 66 insertions(+), 2 deletions(-)</summary>

~~~~diff
diff --git a/app/dashboard/invoices/[id]/page.tsx b/app/dashboard/invoices/[id]/page.tsx
index 372165e..5976f43 100644
--- a/app/dashboard/invoices/[id]/page.tsx
+++ b/app/dashboard/invoices/[id]/page.tsx
@@ -2,7 +2,7 @@ import { Metadata } from 'next';
 import { notFound } from 'next/navigation';
 import { fetchInvoiceDetail } from '@/app/lib/data';
 import { InvoiceId } from '@/app/lib/schemas';
-import { formatCurrency, formatDateToLocal } from '@/app/lib/utils';
+import { dueText, formatCurrency, formatDateToLocal } from '@/app/lib/utils';
 import CustomerAvatar from '@/app/ui/customer-avatar';
 import { DeleteInvoice, UpdateInvoice } from '@/app/ui/invoices/buttons';
 import Breadcrumbs from '@/app/ui/invoices/breadcrumbs';
@@ -65,6 +65,16 @@ export default async function Page(props: { params: Promise<{ id: string }> }) {
             <div key={term} className="rounded-xl bg-void/60 p-4">
               <dt className="text-xs text-aura">{term}</dt>
               <dd className="mt-1 break-all text-base font-medium text-white">{value}</dd>
+              {term === 'Due' && invoice.status === 'pending' && (
+                <dd
+                  data-testid="invoice-due-in"
+                  className={
+                    invoice.overdue ? 'mt-1 text-sm text-red-400' : 'mt-1 text-sm text-aura'
+                  }
+                >
+                  {dueText(invoice.days_until_due)}
+                </dd>
+              )}
             </div>
           ))}
         </dl>
diff --git a/app/lib/data.ts b/app/lib/data.ts
index 20063b8..f930086 100644
--- a/app/lib/data.ts
+++ b/app/lib/data.ts
@@ -300,6 +300,8 @@ export async function fetchInvoiceDetail(id: string) {
         invoices.date,
         invoices.due_date,
         ${isOverdue()} AS overdue,
+        -- Whole days until it is due, by the same day the overdue rule uses.
+        (invoices.due_date - CURRENT_DATE) AS days_until_due,
         customers.id AS customer_id,
         customers.name,
         customers.email
diff --git a/app/lib/definitions.ts b/app/lib/definitions.ts
index 3aaa647..d3e33d9 100644
--- a/app/lib/definitions.ts
+++ b/app/lib/definitions.ts
@@ -121,6 +121,8 @@ export type InvoiceDetail = {
   due_date: string;
   /** Pending and past its due date. */
   overdue: boolean;
+  /** Whole days until its due date (negative once past), by the database's day. */
+  days_until_due: number;
   customer_id: string;
   name: string;
   email: string;
diff --git a/app/lib/utils.ts b/app/lib/utils.ts
index 14da51a..232d254 100644
--- a/app/lib/utils.ts
+++ b/app/lib/utils.ts
@@ -50,3 +50,15 @@ export const parsePage = (value: string | null | undefined): number => {
   const page = Number(value);
   return Number.isSafeInteger(page) && page >= 1 ? page : 1;
 };
+
+/**
+ * How near an unpaid invoice's due date is, from the whole days until it (negative
+ * once past; the database counts them, by the same day its overdue rule uses):
+ * "Due today", "Due in N days", or "Overdue by N days".
+ */
+export function dueText(daysUntilDue: number): string {
+  if (daysUntilDue === 0) return 'Due today';
+  const n = Math.abs(daysUntilDue);
+  const unit = n === 1 ? 'day' : 'days';
+  return daysUntilDue > 0 ? `Due in ${n} ${unit}` : `Overdue by ${n} ${unit}`;
+}
diff --git a/tests/e2e/invoice-detail.spec.ts b/tests/e2e/invoice-detail.spec.ts
index 121f809..c181f54 100644
--- a/tests/e2e/invoice-detail.spec.ts
+++ b/tests/e2e/invoice-detail.spec.ts
@@ -51,6 +51,25 @@ test('an invoice has a detail page, reached from the list', async ({ page }) =>
   await expect(
     page.getByRole('region', { name: 'Amy Burns' }).getByText('Pending', { exact: true })
   ).toBeVisible();
+  // Unpaid, due 30 days on: how near that is, under the due date. (The invoice is
+  // dated by the UTC day, the count made by the database's day: on a database not on
+  // UTC they differ by one for some hours a day — questions.md Q12.)
+  await expect(page.getByTestId('invoice-due-in')).toHaveText(/^Due in (29|30|31) days$/);
+});
+
+test('an overdue invoice says by how long; a paid one says nothing of it', async ({ page }) => {
+  await logIn(page);
+  // The seed's unpaid invoices are long past due.
+  await page.goto('/dashboard/invoices?status=overdue');
+  await page.locator('table tbody tr').first().getByRole('link', { name: /^View/ }).click();
+  await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]{36}$/, { timeout: 15_000 });
+  await expect(page.getByTestId('invoice-due-in')).toHaveText(/^Overdue by \d+ days$/);
+
+  await page.goto('/dashboard/invoices?status=paid');
+  await page.locator('table tbody tr').first().getByRole('link', { name: /^View/ }).click();
+  await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]{36}$/, { timeout: 15_000 });
+  await expect(page.locator('dt').filter({ hasText: /^Due$/ })).toBeVisible();
+  await expect(page.getByTestId('invoice-due-in')).toHaveCount(0);
 });
 
 test('deleting asks first, in a dialog that keeps focus, cancels on Esc and gives focus back', async ({
diff --git a/tests/unit/data.test.ts b/tests/unit/data.test.ts
index 29d2373..2bd8537 100644
--- a/tests/unit/data.test.ts
+++ b/tests/unit/data.test.ts
@@ -233,6 +233,9 @@ describe.skipIf(!url)('the queries in app/lib/data.ts', () => {
       });
       expect(day(detail!.date)).toBe(seeded.date);
       expect(day(detail!.due_date)).toBe(seeded.due_date);
+      // Whole days until it was due: long past (a 2023 invoice), counted by the database.
+      expect(Number.isInteger(detail!.days_until_due)).toBe(true);
+      expect(detail!.days_until_due).toBeLessThan(-365);
 
       const nobody = '00000000-0000-4000-8000-000000000000';
       expect(await data.fetchInvoiceById(nobody)).toBeUndefined();
diff --git a/tests/unit/utils.test.ts b/tests/unit/utils.test.ts
index 4c2dd6a..a4f5d74 100644
--- a/tests/unit/utils.test.ts
+++ b/tests/unit/utils.test.ts
@@ -1,5 +1,11 @@
 import { describe, expect, it } from 'vitest';
-import { formatCurrency, formatDateToLocal, generatePagination, parsePage } from '@/app/lib/utils';
+import {
+  dueText,
+  formatCurrency,
+  formatDateToLocal,
+  generatePagination,
+  parsePage,
+} from '@/app/lib/utils';
 
 describe('formatCurrency', () => {
   it('formats cents as US dollars', () => {
@@ -53,3 +59,13 @@ describe('parsePage', () => {
     }
   });
 });
+
+describe('dueText', () => {
+  it('says how near the due date is, in whole days', () => {
+    expect(dueText(0)).toBe('Due today');
+    expect(dueText(1)).toBe('Due in 1 day');
+    expect(dueText(30)).toBe('Due in 30 days');
+    expect(dueText(-1)).toBe('Overdue by 1 day');
+    expect(dueText(-365)).toBe('Overdue by 365 days');
+  });
+});
~~~~

</details>

#### T12 item 13 — `night-2026-10-07-t12-13-login-waits`

Every remaining page-change wait in the browser specs gets 15 s; two specs 60 s per test. Why: task 12, tests; Q9 (D103–D104).

<details><summary>Code: 10 files changed, 25 insertions(+), 17 deletions(-)</summary>

~~~~diff
diff --git a/tests/e2e/cat-states.spec.ts b/tests/e2e/cat-states.spec.ts
index 0ea4f86..7d377d0 100644
--- a/tests/e2e/cat-states.spec.ts
+++ b/tests/e2e/cat-states.spec.ts
@@ -31,7 +31,7 @@ test.describe('logged in', () => {
     await page.getByLabel('Email').fill('user@nextmail.com');
     await page.getByLabel('Password', { exact: true }).fill('123456');
     await page.getByRole('button', { name: /log in/i }).click();
-    await expect(page).toHaveURL(/\/dashboard$/);
+    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
   });
 
   test('an invoice that does not exist gets the cat 404, with a way back', async ({ page }) => {
@@ -41,7 +41,7 @@ test.describe('logged in', () => {
     await expect(page.getByRole('heading', { level: 1, name: '404 Not Found' })).toBeVisible();
     await expectCat(page, 'cat-sleeping');
     await page.getByRole('link', { name: 'Back to the invoices' }).click();
-    await expect(page).toHaveURL(/\/dashboard\/invoices$/);
+    await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });
   });
 
   test('a search that finds nothing says so, with a cat, in both lists', async ({ page }) => {
diff --git a/tests/e2e/cats-link.spec.ts b/tests/e2e/cats-link.spec.ts
index 4ed5c9e..0bad62b 100644
--- a/tests/e2e/cats-link.spec.ts
+++ b/tests/e2e/cats-link.spec.ts
@@ -6,6 +6,10 @@ import { expect, test } from '@playwright/test';
 // the cats never touch, so no cat on the page can get in the way.
 test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');
 
+// Several page changes per test, each allowed 15 s under a busy next dev: more
+// than the default 30 s in all.
+test.describe.configure({ timeout: 60_000 });
+
 test('cats stop coming on /cats and start again back on the dashboard', async ({ page }) => {
   // Chaos (a first cat within 3 s) keeps the waits short. Before the login, so the
   // dashboard runs at chaos from its first render.
@@ -15,12 +19,12 @@ test('cats stop coming on /cats and start again back on the dashboard', async ({
   await page.getByLabel('Email').fill('user@nextmail.com');
   await page.getByLabel('Password', { exact: true }).fill('123456');
   await page.getByRole('button', { name: /log in/i }).click();
-  await expect(page).toHaveURL(/\/dashboard$/);
+  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
   await expect(page.getByTestId('xenocat-page')).toHaveAttribute('data-cat-intensity', 'chaos');
 
   await page.getByRole('link', { name: 'Meet the cats' }).focus();
   await page.keyboard.press('Enter');
-  await expect(page).toHaveURL(/\/cats$/);
+  await expect(page).toHaveURL(/\/cats$/, { timeout: 15_000 });
   await expect(page.getByRole('heading', { name: 'The cats' })).toBeVisible();
   // Summoned cats only: no intensity, no cat left over from the dashboard, and none
   // arriving in longer than chaos ever takes to bring one.
@@ -31,7 +35,7 @@ test('cats stop coming on /cats and start again back on the dashboard', async ({
 
   await page.getByRole('link', { name: 'Back to the dashboard' }).focus();
   await page.keyboard.press('Enter');
-  await expect(page).toHaveURL(/\/dashboard$/);
+  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
   await expect(page.getByTestId('xenocat-page')).toHaveAttribute('data-cat-intensity', 'chaos');
   await expect
     .poll(() => page.getByTestId('xenocat').count(), { timeout: 4_000 })
diff --git a/tests/e2e/dashboard-range.spec.ts b/tests/e2e/dashboard-range.spec.ts
index cf3d994..fe10659 100644
--- a/tests/e2e/dashboard-range.spec.ts
+++ b/tests/e2e/dashboard-range.spec.ts
@@ -9,7 +9,7 @@ test.beforeEach(async ({ page }) => {
   await page.getByLabel('Email').fill('user@nextmail.com');
   await page.getByLabel('Password', { exact: true }).fill('123456');
   await page.getByRole('button', { name: /log in/i }).click();
-  await expect(page).toHaveURL(/\/dashboard$/);
+  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
 });
 
 test('the home page shows all time by default', async ({ page }) => {
diff --git a/tests/e2e/dashboard.spec.ts b/tests/e2e/dashboard.spec.ts
index 82ca942..636afac 100644
--- a/tests/e2e/dashboard.spec.ts
+++ b/tests/e2e/dashboard.spec.ts
@@ -10,7 +10,7 @@ test('the demo user logs in and the dashboard shows the seeded data', async ({ p
   await page.getByLabel('Password', { exact: true }).fill('123456');
   await page.getByRole('button', { name: /log in/i }).click();
 
-  await expect(page).toHaveURL(/\/dashboard$/);
+  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
   await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
 
   // Searched, so invoices other tests add (they sort first, by date) cannot push it off page 1.
diff --git a/tests/e2e/intensity.spec.ts b/tests/e2e/intensity.spec.ts
index 290e47c..f73f6f1 100644
--- a/tests/e2e/intensity.spec.ts
+++ b/tests/e2e/intensity.spec.ts
@@ -11,7 +11,7 @@ test.beforeEach(async ({ page }) => {
   await page.getByLabel('Email').fill('user@nextmail.com');
   await page.getByLabel('Password', { exact: true }).fill('123456');
   await page.getByRole('button', { name: /log in/i }).click();
-  await expect(page).toHaveURL(/\/dashboard$/);
+  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
 });
 
 test('chaos is chosen on the settings page, remembered, and brings cats at once', async ({
diff --git a/tests/e2e/invoice-detail.spec.ts b/tests/e2e/invoice-detail.spec.ts
index c181f54..80bbff3 100644
--- a/tests/e2e/invoice-detail.spec.ts
+++ b/tests/e2e/invoice-detail.spec.ts
@@ -5,12 +5,16 @@ import { type Page, expect, test } from '@playwright/test';
 // own pending invoice (an amount no other test uses) and asserts only on it.
 test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');
 
+// Several page changes per test, each allowed 15 s under a busy next dev: more
+// than the default 30 s in all.
+test.describe.configure({ timeout: 60_000 });
+
 async function logIn(page: Page) {
   await page.goto('/login');
   await page.getByLabel('Email').fill('user@nextmail.com');
   await page.getByLabel('Password', { exact: true }).fill('123456');
   await page.getByRole('button', { name: /log in/i }).click();
-  await expect(page).toHaveURL(/\/dashboard$/);
+  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
 }
 
 /** Creates a pending invoice for Amy Burns with a unique amount; returns its cents. */
@@ -41,7 +45,7 @@ test('an invoice has a detail page, reached from the list', async ({ page }) =>
   const cents = await createInvoice(page);
   const row = await findInvoice(page, cents);
   await row.getByRole('link', { name: `View invoice for Amy Burns, ${dollars(cents)}` }).click();
-  await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]{36}$/);
+  await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]{36}$/, { timeout: 15_000 });
   await expect(page.getByRole('heading', { name: 'Amy Burns' })).toBeVisible();
   const details = page.locator('dl');
   await expect(details).toContainText(dollars(cents));
@@ -123,7 +127,7 @@ test('deleting from the detail page goes back to the list', async ({ page }) =>
   const cents = await createInvoice(page);
   const row = await findInvoice(page, cents);
   await row.getByRole('link', { name: /^View invoice/ }).click();
-  await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]{36}$/);
+  await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]{36}$/, { timeout: 15_000 });
   const detail = page.url();
   const pageErrors: Error[] = [];
   page.on('pageerror', (error) => pageErrors.push(error));
diff --git a/tests/e2e/invoice-export.spec.ts b/tests/e2e/invoice-export.spec.ts
index 70d9524..dd11652 100644
--- a/tests/e2e/invoice-export.spec.ts
+++ b/tests/e2e/invoice-export.spec.ts
@@ -11,7 +11,7 @@ async function logIn(page: Page) {
   await page.getByLabel('Email').fill('user@nextmail.com');
   await page.getByLabel('Password', { exact: true }).fill('123456');
   await page.getByRole('button', { name: /log in/i }).click();
-  await expect(page).toHaveURL(/\/dashboard$/);
+  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
 }
 
 test('the export is the filtered list as CSV, with formulas made harmless', async ({ page }) => {
diff --git a/tests/e2e/invoices-filter.spec.ts b/tests/e2e/invoices-filter.spec.ts
index 41efa22..ef8a7f9 100644
--- a/tests/e2e/invoices-filter.spec.ts
+++ b/tests/e2e/invoices-filter.spec.ts
@@ -10,7 +10,7 @@ async function logIn(page: Page) {
   await page.getByLabel('Email').fill('user@nextmail.com');
   await page.getByLabel('Password', { exact: true }).fill('123456');
   await page.getByRole('button', { name: /log in/i }).click();
-  await expect(page).toHaveURL(/\/dashboard$/);
+  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
 }
 
 /** The desktop table's rows (the phone list is hidden at this width). */
diff --git a/tests/e2e/invoices.spec.ts b/tests/e2e/invoices.spec.ts
index d7cb80f..132c46d 100644
--- a/tests/e2e/invoices.spec.ts
+++ b/tests/e2e/invoices.spec.ts
@@ -12,7 +12,7 @@ async function logIn(page: Page) {
   await page.getByLabel('Email').fill('user@nextmail.com');
   await page.getByLabel('Password', { exact: true }).fill('123456');
   await page.getByRole('button', { name: /log in/i }).click();
-  await expect(page).toHaveURL(/\/dashboard$/);
+  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
 }
 
 /** An amount in cents that no seeded or other test's invoice has. */
@@ -105,7 +105,7 @@ test('an invoice is edited: a bad amount is refused, then the change is saved',
   await createInvoice(page, cents);
 
   await (await rowsFor(page, cents)).getByRole('link', { name: 'Edit' }).click();
-  await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]{36}\/edit$/);
+  await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]{36}\/edit$/, { timeout: 15_000 });
   await page.waitForLoadState('networkidle');
   const amount = page.getByLabel('Choose an amount');
   expect(Number(await amount.inputValue())).toBe(cents / 100);
@@ -157,7 +157,7 @@ test('an invoice is due when the form says: 30 days by default, never before its
 
   // Kept: the edit form shows it.
   await (await rowsFor(page, cents)).getByRole('link', { name: 'Edit' }).click();
-  await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]{36}\/edit$/);
+  await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]{36}\/edit$/, { timeout: 15_000 });
   await page.waitForLoadState('networkidle');
   await expect(due).toHaveValue(addDays(today, 45));
   const editUrl = page.url();
diff --git a/tests/e2e/security-headers.spec.ts b/tests/e2e/security-headers.spec.ts
index 4e6feca..0f5c373 100644
--- a/tests/e2e/security-headers.spec.ts
+++ b/tests/e2e/security-headers.spec.ts
@@ -66,7 +66,7 @@ test('logged in, the dashboard pages run under the policy', async ({ page }) =>
   await page.getByLabel('Email').fill('user@nextmail.com');
   await page.getByLabel('Password', { exact: true }).fill('123456');
   await page.getByRole('button', { name: /log in/i }).click();
-  await expect(page).toHaveURL(/\/dashboard$/);
+  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
   for (const [path, heading] of [
     ['/dashboard', /captain/i],
     ['/dashboard/invoices', /^invoices$/i],
~~~~

</details>

#### T12 item 14 — `night-2026-10-07-t12-14-stale-routes`

The reviewer's and backend rules' references to the deleted seed/query routes corrected (documentation only). Why: task 12, security and quality (D105).

<details><summary>Code: 2 files changed, 4 insertions(+), 4 deletions(-)</summary>

~~~~diff
diff --git a/.claude/agents/reviewer.md b/.claude/agents/reviewer.md
index 7ac137c..2a57060 100644
--- a/.claude/agents/reviewer.md
+++ b/.claude/agents/reviewer.md
@@ -18,7 +18,7 @@ implementer's assumptions. Do not ask for their justification — read the code.
 2. If the change touches authentication, authorization, sessions, secrets,
    payments, file handling, external requests, or user input, also read
    `.claude/rules/security-review.md`.
-3. If it touches SQL, the schema in `app/seed/route.ts`, or anything that
+3. If it touches SQL, the schema (`db/migrations/*.sql`), or anything that
    writes to the database, also read `.claude/rules/database.md`.
 4. Establish the diff yourself — `git diff`, `git diff --stat`, `git log` — rather
    than trusting a summary you were handed. A description of a change is not the
@@ -64,8 +64,8 @@ A Next.js App Router app (`CLAUDE.md` §2 maps it). Worth checking every time:
   around it swallows the redirect. The existing actions call `revalidatePath`
   and `redirect` after the `try` block — a change that moves them inside is a
   bug.
-- **Leaked errors.** Returning a caught `error` object to the client (as
-  `app/seed/route.ts` and `app/query/route.ts` do) can expose database details.
+- **Leaked errors.** Returning a caught `error` object to the client can expose
+  database details.
   New code should log it server-side and return a generic message, as
   `app/lib/data.ts` does.
 - **Server/client boundary.** A `'use client'` component must not import
diff --git a/.claude/rules/backend.md b/.claude/rules/backend.md
index fda3da3..e8a3266 100644
--- a/.claude/rules/backend.md
+++ b/.claude/rules/backend.md
@@ -15,7 +15,7 @@ proxy.ts + auth.config.ts   — which pages need a session (the `authorized` cal
 app/**/page.tsx             — Server Components; read data by calling app/lib/data.ts
 app/lib/actions.ts          — Server Actions ('use server'): validate with zod, write, revalidate, redirect
 app/lib/data.ts             — every read query, raw SQL via `postgres` tagged templates
-app/**/route.ts             — Route Handlers; only the one-off seed/query routes exist
+app/**/route.ts             — Route Handlers; only the invoice CSV export (it checks the session itself)
 auth.ts                     — NextAuth credentials provider, user lookup, bcrypt compare
 ```
 
~~~~

</details>

### Provisional

None. No question blocked a task; each was recorded and the smallest reading taken.

### Abandoned

**T3, real cat sounds.** It was abandoned at 15:31 on branch `night-2026-10-07-t3-cat-sounds` (local only, no commits).
- **Why:** the harness denied, as "Untrusted Code Integration", the edit that wired downloaded public-domain and CC0 recordings into `sounds.ts`.
- **Undone:** everything it had started was restored.
- **Needed:** a human to approve using downloaded audio, or to supply the files (Q5). The recordings it found, their licences and the timings of their calls are in the T3 entry.

### Questions (most consequential first; details in questions.md)

1. **Q5:** T3's cat recordings need a human. The run may not integrate downloaded files.
2. **Q12:** one time zone for the database's "today". Invoices are dated by UTC, while `CURRENT_DATE` (overdue, "Due in N days") follows the server's setting. Proposed: `TimeZone: 'UTC'` on the app's three connections.
3. **Q4, Q7, Q9:** browser-test flakes under `next dev`.
   - Q4: a split CI result on T1's commit; logs need auth.
   - Q7/Q9: the waits, now fixed by T12 items 8 and 13.
   - A shared `logIn` helper across the specs is proposed.
4. **Q1:** should CI's "Database tests" step fail when every database test skipped? Proposed task.
5. **Q6:** the night-run skill should say how the opt-in database tests are run.
6. **Q2, Q3:** T2's click blocking while elements are displaced, and five cats that do nothing visible to the page. Product decisions.
7. **Game design** (proposed for a plan):
   - Q8: a warning before a cat pounces after a background tab returns.
   - Q10: petting a sleeping cat on a touch screen.
   - Q11: weapons aiming at the harmless secret cat.

### Clock and budget

- **Start:** 2026-10-07 14:21; budget 14,898,083 tokens. Each task's entry gives its start and end, with the budget at each.
- **End:** the report at 2026-10-08 10:32; budget about 13,070,000.
- **Tokens:** about 1.83M used, roughly 12% of the starting figure. The budget never neared its reserve.
- **Overrun:** the last task ran 1 h 56 min past `D`, all of it the usage-limit pause.

### State

- **Run branch:** `night-2026-10-07`. Its tip, before this report, is `f8b643d`.
- **On the remote:** every task branch above and the run branch. T3's branch is local only. Nothing was pushed to `main` and no PR was opened.
- **Uncommitted:** nothing.
- **The build** was in every gate.
- **Lint:** 0 warnings, the same as the baseline (`lint-baseline.txt`). One rule was added, `no-console` for the app's code (T12.9); it only tightens.
- **The database:** only the test schemas were written, through `npm run test:e2e`. The development database's `xenocats` schema was only read, by the build.
  - No migration was added.
  - `data.test.ts` was never run locally (opt-in). CI's "Database tests" step ran it.

### What nothing has checked

- **Nobody looked at any page.**
  - Every UI change is "tested in a browser, not seen".
  - In particular: the Survival canvas (varieties, chests, the boss bar, the camera and P1/P2 in co-op, the Purring Cat's halo), the start-screen panel, the invoice forms' due-date field, and the invoice list's Due column.
  - The detail page's "Due in N days".
  - The invoice table at 768 and 1024 px.
  - Phone layouts.
- **Drawn by the run, not seen**, for a Superdesign pass:
  - the nine varieties (D48) and the Purring Cat (D74);
  - the Night Porter and Housekeeper (D61) and the Neighbour's Cat (D61);
  - chests, Laser Cat shots, gems, the weapons' shots and blades.
- **Balance.** Every number is a first guess: weapons, varieties, the comfort, evolutions, costs. One seeded test checks that positioning matters (D98–D99). Nothing checks that the five-minute goal is reachable by good play.
- **Formatting.** Dates are formatted in the server's time zone (D89, Q12). West of UTC they can read a day early.
- **No production database exists.** No change was run against one.
