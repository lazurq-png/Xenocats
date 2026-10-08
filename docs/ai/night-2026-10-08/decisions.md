# Decisions — night run 2026-10-08

Non-obvious choices, numbered `D1`, `D2`, …, each with its reason, including acceptance criteria derived for an underspecified task.

## T1 — Taming is removed; `/cats` has one Play button

**D1 — Files removed** (the plan's task 1 lifts §3's "deleting a file you did not create" for these). Each was found by its importers before and after (`grep -rl "from './<module>'"`):

| File | Why it only served Taming |
| ---- | ------------------------- |
| `app/cats/taming/page.tsx` | Taming's page; `/cats/taming` now falls to the site's not-found page. |
| `app/ui/xenocats/fight.tsx` | The Taming game itself (its only importer was `fight-page.tsx`'s Taming branch). |
| `app/ui/xenocats/taming.ts` | Taming's rules and its tamed-cat collection (`xenocats:tamed`). |
| `app/ui/xenocats/player-sprite.tsx` | The ranger drawn by `fight.tsx` only (Survival draws its Keeper on the canvas, `arena-art.ts`). |
| `app/ui/xenocats/locked-pointer.ts` | Pointer lock for `fight.tsx` only. |
| `tests/unit/xenocats/taming.test.ts`, `tests/unit/xenocats/locked-pointer.test.ts` | Tests of the two removed modules. |
| `tests/e2e/fight.spec.ts` | Every test drove Taming; its one other test (links from `/cats` to both games) is replaced by the Play-link test in `survival.spec.ts`. |

**D2 — Shared modules: what went, what stayed.**
- `walking.ts`: `FACINGS`, `Facing`, `facingTowards` and `createGameClock` were used only by `fight.tsx` and `player-sprite.tsx`; removed with their unit tests. `walkDirection`, `isWalkKey` and `PLAYER_KEYS` stay (the arena and the movement pad).
- `field-guide.ts`: the guide's "tamed" count read Taming's collection; removed (type, store, `recordTamed`). The guide keeps met and survived. The card shows two counts, not three. Old `xenocats:tamed` data in a browser is simply no longer read (the plan: no clean-up); an e2e test stores some and checks it is not shown.
- `fight-page.tsx`: renders only Survival; the `kind` prop, the cat layer and the fake cursor it set up for Taming are gone. The name stays (it is the game page's wrapper; renaming it would only add churn).
- `global.css`: the ranger's walking animation (`xenocat-player-*`) and the old beam classes (`xenocat-beam`, `-home`, `-column`, not the `xenocat-beam` keyframes the effects use) had no user left; removed.
- Kept: `fake-cursor.tsx`'s `hide()` (last called by `fight.tsx`): a general part of the cursor's API, with `isHidden()` still read by `cat-layer.tsx` and covered by `fake-cursor.test.tsx`; removing it would change the cats' code for no gain. `movement-pad*`, `walking.ts`, `cursor-controller.ts`, `field-guide.ts` stay (Survival, the dashboard's cats, the gallery).
- `.github/workflows/ci.yml`: the unit groups no longer name the two removed test files, and the browser groups no longer name `tests/e2e/fight` (a filter that matches no file would make `vitest run` fail). The steps are renamed "(Survival)".
- `README.md`: the `/cats/taming` route line removed. `CLAUDE.md` names no Taming file, so it needs no change.

**D3 — Acceptance criteria.** `/cats`'s "Fight a cat" section holds exactly one link, "Play", to `/cats/survival`, and describes Survival only; `/cats/taming` answers 404 with the site's not-found page; no module, test or CI step names a removed file; every remaining suite passes.

**D4 — Review.** The `reviewer` requested changes with one Medium finding: `tests/unit/affected-tests.test.ts` used the deleted `tests/e2e/fight.spec.ts` as its example of an existing spec (one assertion failed, one no longer checked anything). Already found by the gate's `npm test` and fixed as the reviewer recommends: both lines now use `tests/e2e/survival.spec.ts` (another `/cats` spec, outside the invoices area). A two-line fixture change, so no re-review; `npm test` and both full browser suites ran after it. The reviewer also asks a human to look at the gallery card's two counts (`grid-cols-2`).

## T2 — Every upgrade does what it says, every time it is taken

**D5 — Cause.** Two rules made picks change nothing visible. Scissors added `floor(level / 2)` (+1 at level 5), so picks 1 and 3 added no projectile. A weapon's stats were interpolated from level 1 to level 8 with counts rounded down (`levels()`), so the Laser Pointer's beams went 1,1,1,2,2,3,3,4: three of its seven level-ups added no beam and changed the rest by 5–15%. The level-up card showed only the weapon's general line.

**D6 — Weapons climb a ladder.** `levels(growth)` is replaced by `ladder(base, steps)`: level 1's stats and seven explicit steps, each adding to the level before. Every step changes something noticeable: one more of what it fires, one more cat passed through, or a stat at least 10% better (a unit test holds every level to that). Each weapon's level 8 is exactly its old level 8 (compared stat by stat before the tests), so the strongest weapons and the evolutions they lead to are unchanged; only the way up differs. Steps alternate between more of what it fires, homesickness and firing sooner, with size, speed or duration joining them.

**D7 — The card says exactly what.** `levelChanges(id, level)` reads the change from the two levels' stats and names each changed stat in one phrase ("+1 beam", "+40% homesickness", "fires 20% sooner", "+20% reach", "lasts 21% longer", "passes through 1 more cat"); `passiveChanges(id, level)` does the same from `modifiers`. `describeChoice` returns the joined phrases as `change`, shown on its own line on the card (`data-testid="choice-change"`). Because the text is computed from the numbers the game uses, card and effect cannot disagree; task 5's pause menu will reuse both functions. A new weapon's card keeps only its own line (it has no level before). Each weapon gains a `unit` (its count's word).

**D8 — Passives: the same step every pick.** Scissors now adds `+1` per level (+5 at level 5, was +3). The other passives were already linear; a unit test now holds every passive to an equal, non-zero step from its first pick.

**D9 — Balance.** Weapons are a little stronger on the way up (more of what they fire earlier) and Scissors at its top adds two more of everything. The seeded balance test ("positioning is the skill", `arena.test.ts`) and every arsenal and arena test pass unchanged; no assertion was adjusted.

**D10 — Review.** Approve, with three Low findings. (1) Scissors' card said "+1 of what each weapon fires", but the three vacuums (`pull`, `zone`, `gulp`) never read their count: the card now names what it adds to, derived from the weapons that use a count ("+1 beam, treat, droplet, ball, blade, piece or jump for each weapon that fires them"). Giving the vacuums a count meaning was the other option; it is a game-design change beyond the task, so not taken. (2) The e2e card check could pass with no card checked: it now counts the cards that name a change and requires at least one. (3) Not changed: a passive's card gives its constant step as a share of the base (Battery: 8 points of cooldown per pick, so its 5th pick is 11.8% sooner than its 4th), while a weapon's gives the change from its previous level. That is what "the same step each time" means; worth knowing for task 5's pause menu.

**D11 — `.next/dev/types` in the gate.** `tsconfig.json` includes `.next/dev/types/**/*.ts`, which `next dev` (started by the browser tests) writes and can leave half-written when the test server is stopped. Twice now it failed `tsc` and once `npm run build` with an error in `validator.ts` and nothing in the code. From here on the gate deletes `.next/dev/types` (this run's own generated output) before the type check and before the build. CI starts from a fresh checkout, so it never sees one.

## T3 — Sound settings in the lobby and the pause menu

**D12 — One component, the site's one setting.** `game-settings.tsx` holds Survival's settings (a "Settings" fieldset), rendered in the lobby (under the Keepers, on touch screens too) and in the pause menu (between its line and its buttons). Its Sound checkbox reads and writes `sounds.ts`'s existing setting through `subscribeSound`/`getSoundEnabled`/`setSoundEnabled`: default on, stored as `xenocats:sound`, unchanged. The arena's sound player already asks `getSoundEnabled` before every sound, so the switch takes effect at once; the dashboard's speaker shows the same state. Task 4 adds the aim choice to the same component.

**D13 — A checkbox, not a second speaker button.** A labelled checkbox in a fieldset fits a settings group, is reached with Tab and switched with Space, and reads as "Sound, checkbox, checked". Resume stays the button the pause menu focuses (the menu focuses its first `button`; the checkbox is an `input`). While paused the game handles only Escape, so Space reaches the checkbox.

**D14 — Acceptance criteria.** In the lobby and the pause menu, on desktop and touch: a Sound checkbox showing the site's sound setting; switching it in either place changes `xenocats:sound` at once and holds after Resume, in the other place and after a reload. All by command (two e2e tests).

**D15 — Review.** Approve, one Low finding, fixed: with sound off when a run starts, Start's `unlock()` creates no audio context; switching sound on in the pause menu then created it later, from the frame loop, outside any gesture, which a browser that needs one (Safari, iOS) would leave suspended for the rest of the run (the Survival page has no cat layer to unlock it on a later gesture). The checkbox now also calls `sharedSoundPlayer().unlock()` when it is switched on, inside the click or tap. Not observable in a test (no test can hear); checked by reading. Also noted by the reviewer, not changed: the fieldset is left-aligned inside the pause panel's centred text; a human should look at both places at phone width.
