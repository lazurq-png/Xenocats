# Night run 2026-10-09

## Goal

Sunday 20:00

## Limits

Information only. The run spans a weekend and will likely meet the account's
usage limit more than once, and possibly its weekly limit. The run cannot see
either. At a limit the session pauses until the timer's next firing after it
resets, and the per-task commit and push bound what is lost. Started from the
Claude CLI (`docs/ai/README.md`, "Starting it from the CLI").

## Design decisions (made by the human; the run does not revisit them)

- **Focus.** The Survival game, the test suite (task 1), and the game's speed on
  a weak machine. Outside them, only tasks 19 and 20. No other dashboard
  features.
- **Order.** 1, 9, 7, 8, 3, **checkpoint 1**, 4, 5, 6, 2, 10, **checkpoint 2**,
  11, 12, 13, 14, 15, **checkpoint 3**, 16, 17, 18, 19, 20, **checkpoint 4**,
  then exploration (`## Exploration`) until the goal time, with a checkpoint
  after every 5th exploration item. Branches keep the plan's numbers
  (`2026-10-09-t9-…` runs second).
- **Dependencies.** 4 needs 3; 5 needs 4; 6 needs 5; 10 needs 9; 11 needs 7 and
  3; 12 needs 2, 3 and 11; 13 needs 8. A task whose prerequisite was abandoned
  or parked is parked too (§4), with the reason in `progress.md`; the run goes on
  with the next task that does not depend on it.
- **"Upgraded" means evolved.** An upgraded weapon is an evolved one: a weapon
  at its highest level, held with its passive, evolved at a chest
  (`EVOLUTIONS` in `arsenal.ts`). Tasks 3, 4, 5 and 6 use the word that way.
- **Databases.** Only the development server in `.env` (a private address), and
  on it only what the skill allows: `xenocats_test` (browser tests),
  `xenocats_vitest` (database tests), and `xenocats` read by the build. Never a
  write to `xenocats`, never `npm run db:*`. No task here needs a migration
  except possibly task 19; if it does, a human applies it to `xenocats`.
- **No new dependencies.** The game stays on the browser's Canvas 2D API. No
  WebGL, no worker rewrite (propose those in `questions.md` instead).
- **No Superdesign.** New art (characters' directions, weapons, passives,
  pickups) is drawn as SVG in `arena-art.ts`, like the game's existing art. The
  20 cat types' artwork is not changed.
- **The cats' existing rules still hold** outside the Survival game: never more
  than 5 cats on screen, one effect at a time, the keyboard never affected, no
  off switch **a user can see or reach** (task 1's pause is for tests only),
  cats and effects hidden from assistive technology, every page effect reverts
  exactly.
- **Settled questions** from earlier runs, not to be reopened: 2026-10-07 Q2
  (clicks are never blocked) and Q11 (weapons may target the Neighbour's Cat).
  2026-10-08 Q1 and Q2 are a human's and are not worked on.
- **Balance.** The existing seeded balance tests must still hold for the
  5-minute run. A task may adjust them only with the reason and the numbers in
  `decisions.md`.

## Checkpoint (after tasks 3, 10, 15 and 20, then after every 5th exploration item)

A task like any other (`2026-10-09-c<N>-checkpoint`, through the whole of §2),
covering everything merged since the previous checkpoint:

1. **Tests.** Is every changed behaviour covered by a test that would fail
   without it? Is every test still relevant: no test of removed behaviour, no
   duplicate, no test that cannot fail? Add what is missing. A test that no
   longer tests anything relevant may be rewritten or removed, with the reason
   in `decisions.md`. _Explicitly lifts §3's "deleting a file you did not
   create" for test files under `tests/` only._
2. **Quality and security.** Dispatch the `reviewer` on the range since the last
   checkpoint, with `.claude/rules/security-review.md` in scope. Fix every
   finding within the checkpoint, or record why not.
3. **Speed.** Run task 9's benchmark (once it exists) and record its numbers
   next to the previous checkpoint's. A slowdown of more than 10% since then is
   a finding: find its cause and fix it within the checkpoint, or record why
   not.
4. Append a `## Checkpoint <N>` entry to `progress.md`: what was checked, found
   and changed. Then continue with the next task.

## Tasks

1. **Browser tests can pause the cat attacks, and only browser tests can.** The
   cats that haunt the dashboard and `/cats` (the cat layer, `cat-layer.tsx`,
   `cat-engine.ts`) get a pause that **no user can see or reach**: no button, no
   setting, no stored value. The browser tests switch it on with a flag Playwright
   injects before each page loads (`page.addInitScript`, setting a `window`
   property the cat layer reads when it starts). It lives in the test code
   alone, so it works the same locally and in CI, with no `.env` and no secret.
   While paused, no cat comes and no cat effect starts. The Survival arena's
   cats are the game, not an attack, and are never paused by it.
   - **A shared fixture** (`tests/e2e/fixtures.ts`): an option `catsPaused`,
     true by default, which every spec uses through its own `test` import.
   - **Two Playwright projects.** `cat-attacks` holds the specs that test the
     cats on or off `/cats` (find them by reading: any spec whose assertions
     need a cat to come or an effect to land; `cats.spec.ts`,
     `cat-states.spec.ts`, `pet-cat.spec.ts`, `cats-link.spec.ts`,
     `intensity.spec.ts` and `field-guide.spec.ts` are the likely ones; check
     each). They run with `catsPaused: false`. Every other spec is in a second
     project that **depends on** `cat-attacks` (`dependencies`), so the cat
     tests always run first, then the rest with the cats paused. Each project
     keeps the devices it has today (`touch.spec.ts` its Pixel 7).
     List every spec and its project, with the reason, in `decisions.md`.
   - **Targeted runs stay targeted.** Check whether running one paused spec
     (`npx playwright test <spec>`) also runs the whole `cat-attacks` project.
     If it does, the gate's selection (`scripts/affected-tests.mjs`, its
     `--run`) and repair-cycle runs use `--no-deps` and name any cat specs they
     need explicitly. The full suites and CI keep the dependency. Changing the
     selector means the full suites run at this task's gate (§2.1).
   - Update what describes the browser tests (`.claude/rules/testing.md`,
     `CLAUDE.md` §9's paragraph on them) in a sentence each.
   Unit test: the cat layer starts no cat while the flag is set, and behaves as
   today without it. E2E: on the dashboard with the cats paused, no cat appears
   in a window longer than chaos intensity's first arrival; a `cat-attacks`
   spec still sees one. Record the full e2e suite's time before and after.

2. **The characters turn to face their aim, weapon pointing at it.** Today each
   character is one SVG (`HERO_SVGS`, `arena-art.ts`), flipped left or right
   with the way he walks (`arena-view.tsx`, `h.facing`). Instead:
   - **Eight directions** for each of the three characters: draw N, NE, E, SE
     and S, and mirror them for SW, W and NW. Same style, palette and size as
     today's art.
   - **What he faces**: with the crosshair (desktop option), the crosshair;
     otherwise the cat his first aiming weapon targets now (the auto-target);
     with no target, the way he walks. The body uses the nearest of the eight
     directions. His starting weapon (Laser Pointer, Spray Bottle, Vacuum
     Cleaner) is drawn in his hands as a separate piece, **rotated to point
     exactly** at the aim, not snapped to eight directions.
   - **Co-op**: each Keeper faces his own aim (the second player always
     auto-targets). A downed Keeper lies as today.
   - The choice of direction is a pure function (angle → direction) beside the
     simulation, unit-tested at every boundary, and the facing is exposed as a
     HUD data attribute (`data-hero-facing`), like the others.
   E2E: with the crosshair on, moving the mouse round the Keeper changes
   `data-hero-facing` through all eight; with automatic aim, he faces a cat
   placed by a seeded run. **Nobody will look at the art tonight: report it as
   built, not seen**, and name what a human should look at.

3. **Ten new things to carry: 5 weapons and 5 passives, each able to evolve.**
   In `arsenal.ts`, drawn and fired like the existing ones:
   - **5 weapons**, each with a full ladder to level 8 whose every level adds
     something its card names (as today), and at least three of them with a
     **behaviour no weapon has today** (a new `WeaponKind`, made to fire in
     `arena.ts`), not a reskin with new numbers. In the game's voice: household
     things that send cats home (e.g. a feather wand, a squeaky toy, a cardboard
     box, a hair dryer, a bath).
   - **5 passives**, each with a ladder to level 5, every pick adding its step
     (as today).
   - **5 evolutions**, one per new weapon, each paired with one of the new
     passives, each to a new evolved weapon (following task 4's rule: its own
     effect, stronger than its base). Each appears in the codex like the
     existing evolutions.
   - Art in `arena-art.ts` for each new projectile or effect; a sound for each
     new weapon if the existing weapons have their own (`sounds.ts`).
   - All ten are offered from the start (task 11 may move some behind a
     milestone). The pause menu, level-up cards and results show them as they
     show the others.
   Record each new item, its kind and its evolution in `decisions.md`. Keep the
   5-minute balance test. Unit tests: every new weapon's levels differ in what
   its card says and nothing else; each new kind fires as described; each
   evolution is reached as the others are. E2E: a seeded run whose level-up
   offers a new weapon, taken, shows it in the pause menu.

4. **Every evolved weapon has an effect of its own, stronger than its base.**
   Today Yarn Apocalypse, Banquet, Monsoon and Bottomless Saucer use the same
   kind as their base weapon (`bounce`, `spread`, `arc`, `orbit`) with bigger
   numbers; Infinite Laser (`web`) and Forbidden Catnip Vacuum (`gulp`) already
   have their own. Give each of the four an effect its base does not have (e.g.
   Monsoon leaves puddles that slow cats; Banquet's treats burst into crumbs
   that chase; Yarn Apocalypse's balls tangle cats they pass; Bottomless
   Saucer's blades throw out milk waves), and check that the two with their own
   kind, and task 3's five, also outclass their base. "Stronger" is measured:
   a seeded test of homesickness dealt per second against a fixed crowd shows
   every evolved weapon above its base at level 8. Record each effect and its
   numbers in `decisions.md`. Unit tests on each new effect. Depends on task 3.

5. **Two evolved weapons fuse into a third tier.** Holding two evolved weapons
   from a fusion pair, a chest fuses them into one **fused** weapon, which frees
   a weapon slot. At least four fusion pairs, covering at least eight of the
   eleven evolved weapons, each fused weapon with its own effect drawn from both
   parents' (e.g. Infinite Laser + Monsoon: a laser storm that arcs through
   water), stronger than either parent by task 4's measure. One fused weapon
   per pair, never offered at a level-up. Fused weapons are codex entries, are
   named in the pause menu (and its "within reach" hints say what a fusion
   still needs), and in the results. Rules in `arsenal.ts` beside
   `EVOLUTIONS`; the chest gives a fusion when one is ready, before an
   evolution. Record the pairs in `decisions.md`. Unit tests: a fusion happens
   only with both parents evolved, at a chest, and frees the slot; each fused
   weapon outdeals both parents. E2E: a seeded run (test hooks) reaching a
   fusion shows the fused weapon in the pause menu. If a seeded run cannot
   reach one in reasonable test time, add a test hook for it, bounded like the
   others (`test-hooks.ts`). Depends on task 4.

6. **Items are coloured by how far they have come.** Everywhere a weapon or
   passive is named in the game (level-up cards, pause menu, results), its name
   or badge takes a colour by its level and tier, from the theme's tokens in
   `tailwind.config.ts` where they fit:
   - weapons: levels 1–2, 3–4, 5–6, 7, 8 (highest) each a step up;
   - passives: levels 1, 2, 3, 4, 5 each a step up, the same colour scale;
   - evolved and fused weapons: a colour of their own each, beyond the highest
     level's.
   One function maps (item, level, tier) to the colour, shared by every place,
   unit-tested. Colour is never the only signal: the level and the tier stay
   written beside it, and every colour keeps the text's contrast at WCAG AA
   against its background (check and record the ratios). E2E: the pause menu
   marks a level-1 and a higher-level weapon with different tiers
   (`data-tier`). Report as tested in a browser, not seen. Depends on task 5.

7. **Choose how long a run lasts: 5, 10 or 15 minutes.** In Survival's lobby, a
   **Run length** choice, 5 minutes by default, remembered in the browser like
   the game's other settings; keyboard reachable and labelled, desktop and touch.
   - **5 minutes** is today's game, unchanged: its balance tests hold as they
     are.
   - **10 and 15 minutes**: the first 5 minutes as today, then a **long peak**:
     the crowd stays at its peak (the frame-rate guard still decides how many a
     machine can take), and cats grow tougher with time past 5:00 (more
     homesickness to send home, a little faster), bosses keep coming every 2
     minutes, and the Matriarch comes at the chosen time instead of 5:00.
   - The HUD's clock, the results and the pause menu show the chosen length.
     The best time is kept **per length**; a stored best from before this task
     counts as the 5-minute best.
   Record the toughness curve in `decisions.md`. Unit tests on the simulation:
   5 minutes unchanged; at 10:00 of a 15-minute run cats are tougher than at
   5:00; the Matriarch comes at the chosen time. E2E: choosing 10 minutes
   survives a reload and the HUD shows `/ 10:00`.

8. **Elites are rarer, and attack when a player comes close.** Today 40% of the
   artwork cats are elites (`eliteShare`), and an elite's effect lands only by
   touch. Instead:
   - Elites come **more seldom**: about a third as often as today (record the
     number and why in `decisions.md`).
   - An elite within a **short distance** of a Keeper (well inside the screen,
     record the number) uses an **attack pattern** drawn from its xenocat's
     effect (e.g. the Laser Ocicat fires a short burst; the Gravity Manx pulls;
     the Cryo Persian throws a frost ring), with a visible **wind-up** before it
     lands so a player can step out of it, then a cooldown. Touching it still
     lays its effect as today.
   - Every attack pattern can be dodged: it aims where the Keeper was at the
     wind-up's start, not where he is when it lands.
   Unit tests: the elite share over a seeded run; an elite out of range never
   attacks, one in range winds up, then attacks; a Keeper who moves away during
   the wind-up is not hit. E2E: a seeded run with an elite near the Keeper
   shows a wind-up (expose it like the HUD's other data).

9. **A yardstick for the game's speed on a weak machine.** Before anything is
   optimised, measure it:
   - A seeded **simulation benchmark** (a Vitest file or a script beside the
     tests, not run by `npm test` unless fast): step cost with 500, 2000 and
     6000 cats and a full late-game arsenal, median and 95th percentile per
     step, printed as a table.
   - A seeded **render benchmark** in the browser (a Playwright spec run on
     demand, not in the gate, under Chromium's CPU throttling, e.g. 4×, through
     CDP): frames per second and long frames over 20 seconds of a crowded,
     effect-heavy run.
   - A hidden **`?fps=1`** test hook (`test-hooks.ts`, bounded like the
     others) that shows frame time and cat count in the arena.
   Record the first numbers in `progress.md` as the baseline every later
   checkpoint and speed item compares against, and how to run each benchmark
   in `decisions.md`.

10. **A Graphics setting: full or light.** In the game's settings (lobby and
    pause menu, where Sound is), **Graphics: full / light**, remembered in the
    browser. Light drops the costly effects: canvas glows (`shadowBlur`), beam
    flashes, the gem shimmer, and caps the canvas's pixel ratio at 1. It changes
    nothing in the simulation. Full is the default, unless the frame guard has
    measured the machine below its floor in the first seconds of a run; then
    the game switches to light once and says so in a short notice (the setting
    stays the player's to change back). Measured with task 9's benchmark:
    record full against light in `decisions.md`. Unit tests on the setting's
    storage and the automatic switch. E2E: switch to light in the pause menu,
    resume, it holds; the lobby shows the same. Depends on task 9.

11. **Milestones for the longer runs.** With task 7's lengths: new milestones
    **Survive 10:00** and **Survive 15:00**, each unlocking something (one or
    two of task 3's weapons, or task 12's character), shown where the
    milestones are today, and tufts that reward a longer run (record the rule).
    A 5-minute run's tufts are unchanged. Unit tests on the milestones and
    tufts. Depends on tasks 7 and 3.

12. **A fourth character.** One who starts with one of task 3's weapons, with a
    name, a line in the game's voice, Resolve and pace that differ from the
    other three, eight-direction art and an aimed weapon as in task 2, unlocked
    by **Survive 10:00** (task 11). Unit tests as for the others; E2E: the
    lobby offers the character once the milestone is reached (stored progress
    set by the test). Report the art as built, not seen. Depends on tasks 2, 3
    and 11.

13. **Bosses attack too.** The Mega Cat and the Matriarch get attack patterns
    of their own, wound up and dodgeable like task 8's (e.g. the Mega Cat's
    pounce at where the Keeper stood; the Matriarch's summoning of a ring of
    kittens). Unit tests on each pattern; E2E: a seeded run with `?boss=` shows
    a boss's wind-up. Depends on task 8.

14. **Things to pick up.** Rarely, a cat sent home leaves one of three pickups,
    drawn in `arena-art.ts`: a **fish** (restores some Resolve), a **magnet**
    (pulls every gem on the arena to the Keeper), a **bell** (stuns every cat on
    screen for a moment). Record the rates in `decisions.md`; keep the
    5-minute balance test. Unit tests on each pickup's effect; E2E: a seeded
    run picks one up and the HUD shows it happen.

15. **Reroll and skip at a level-up.** A level-up card set has **Reroll** (new
    choices) and **Skip** (no choice, a little experience instead), each with a
    small number of uses per run, shown on the buttons. The Tailor sells more
    uses, as he sells his other upgrades. Keyboard reachable, desktop and
    touch. Unit tests on the rules; E2E: reroll changes the choices and spends
    a use.

16. **The results screen says what each weapon did.** For each weapon held in
    the run (evolved and fused included): homesickness dealt and cats sent
    home, highest first, as a list a screen reader reads sensibly. Counted in
    the simulation, not the view. Unit tests on the counting; E2E: the results
    of a seeded run name the starting weapon with a non-zero count.

17. **Best times per length and character, with the date.** Beside the overall
    best, the lobby shows each character's best for the chosen length, with
    the date it was set. Old stored bests are kept (task 7's rule). Unit tests
    on the storage; E2E: a finished seeded run shows its time as that
    character's best.

18. **Gamepad support.** Through the browser's Gamepad API: the left stick (or
    d-pad) moves the Keeper, Start pauses, and the level-up cards, pause menu
    and results can be navigated and chosen. In co-op, a pad can be the second
    player. Keyboard and touch unchanged. Unit tests on the mapping from pad
    state to input (no real pad needed); E2E with a stubbed
    `navigator.getGamepads`.

19. **Create an account from the login page.** Task 12 of
    `docs/ai/night-2026-10-08/plan.md`, as written there (it was never started:
    that run's Q4). Its prerequisite, that run's task 11, is merged.

20. **The login-limit flake.** `login-limit.spec.ts` "a successful login starts
    the count again" fails about 1 run in 4 under `next start`
    (`docs/ai/night-2026-10-08/questions.md`, Q5, with the cause found and a
    fix proposed). Fix the test, not the limit, and show it with
    `--repeat-each 20` against `next start`.

## Exploration

Rotate between three kinds, one item each, in this order:
**speed on a weak machine**, **the Survival game**, **speed on a weak
machine**, **bugs**.

**Speed on a weak machine** is the main kind: this laptop slows down noticeably
when many cats are on screen or many weapon effects are happening. Every speed
item measures before and after with task 9's benchmarks and records both in its
entry; an item that does not move a number is reverted, not merged. Candidates
to start with:

- Glows: replace per-frame `shadowBlur` (beams, the Matriarch, the freeze) with
  glow sprites drawn once and reused.
- Batch drawing: one path and one fill per colour for gems, shots and
  projectiles, instead of a `beginPath`/`fill` per item.
- Cat bitmaps pre-scaled to the size they are drawn at, so `drawImage` does not
  scale a 256 px image down for every cat every frame.
- Cull everything off screen (zones and beams too), and draw nothing smaller
  than a pixel.
- The simulation's hot loops: use the spatial grid (`arena-grid.ts`) for every
  nearest and within query; no allocation per cat per step (reuse arrays and
  vectors); swap-and-pop instead of `splice` in loops.
- Cap the simulation steps per frame, so a slow frame does not ask for more
  steps and get slower still; let game time slow down instead (recorded).
- Merge gems lying close together into bigger ones when there are many.
- The HUD: React state updated at most ~10 times a second, not every frame.
- Sounds: cap how many play at once.
- Let the frame guard also lower the crowd's peak, not only stop arrivals, on
  a machine that stays below its floor.

**The Survival game**: new drawn enemy varieties with a behaviour that plays
differently; sounds for weapons that have none; a chest opening that shows what
it gave; any of tasks 11–18 left unfinished.

**Bugs**: found by reading the game's and the cats' code, and flaky tests.

Not in exploration: dashboard features, anything needing a new dependency,
WebGL, OffscreenCanvas in a worker or another renderer (propose them in
`questions.md` with the benchmark's numbers), Superdesign or any outside
service, new artwork for the 20 cat types, online multiplayer, and the
2026-10-08 run's Q1 and Q2. Those go to `questions.md`.
