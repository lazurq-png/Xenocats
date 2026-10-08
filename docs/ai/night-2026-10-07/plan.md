# Night run 2026-10-07

## Goal

Thursday 08:30

## Limits

Information only. The run cannot see the account's usage limit; if it runs out,
the session pauses until the timer's next firing after it resets, and the
per-task commit and push bound the loss. Last run lost about 7 of its 18 hours
to such pauses.

## Design decisions (made by the human; the run does not revisit them)

- **Order.** Tasks 1–5, checkpoint 1, tasks 6–11 (the Survival game series),
  checkpoint 2, then task 12 until the goal time.
- **Dependencies.** A task whose prerequisite (named in the task) was abandoned
  or parked is parked too (§4), with the reason in `progress.md`; the run goes
  on with the next task that does not depend on it.
- **Databases.** Only the development server in `.env` (a private address), and
  on it only the test schemas: `xenocats_test` through the browser tests, and
  `xenocats` read by the build. Never the retired hosted (Neon/Vercel)
  database, never a write to `xenocats`, never `npm run db:*`. No task tonight
  needs a migration.
- **`npm test` until task 1 is merged**: run it as `E2E_NO_DATABASE=1 npm test`
  (§3; last run's Q6). From task 1's merge on, plain `npm test`.
- **CI's fight group** (last run's Q1) was worked on by hand after the last run
  (`3029fe1`, `725512b`, `3833756`, `bf694b5`). The first task's CI poll shows
  whether it now passes. If only that group still fails, record it as
  "inherited fight-group failure (Q1)" and spend **no** repair cycle on it:
  three were already spent.
- **No new dependencies.** Task 3's sound files are assets, not dependencies.
  The game (tasks 6–11) is built on the browser's Canvas 2D API, with no game
  or rendering library.
- **No Superdesign, and no restyling of the existing cats.** The 20 cat types'
  art stays as it is. The one exception is the Survival game's own art, below.
- **The cats' existing rules still hold** everywhere outside the Survival game:
  never more than 5 cats on screen, one effect at a time, the keyboard never
  affected, no off switch, cats and effects hidden from assistive technology,
  every page effect reverts exactly.

## Checkpoint (after task 5, after task 11, then after every 5th item of task 12)

A task like any other (`night-2026-10-07-c<N>-checkpoint`, through the whole of
§2), covering everything merged since the previous checkpoint:

1. **Tests.** Is every changed behaviour covered by a test that would fail
   without it? Is every test still relevant: no test of removed behaviour, no
   duplicate, no test that cannot fail? Add what is missing. A test that no
   longer tests anything relevant may be rewritten or removed, with the reason
   in `decisions.md`. _Explicitly lifts §3's "deleting a file you did not
   create" for test files under `tests/` only._
2. **Quality and security.** Dispatch the `reviewer` on the range since the last
   checkpoint, with `.claude/rules/security-review.md` in scope. Fix every
   finding within the checkpoint, or record why not.
3. Append a `## Checkpoint <N>` entry to `progress.md`: what was checked, found
   and changed. Then continue with the next task.

## Tasks

1. **Database unit tests are opt-in.** `tests/unit/data.test.ts` runs only when
   `DATABASE_TESTS=1` is set, and skips otherwise, so a plain `npm test` never
   touches a database. CI's "Database tests" step sets it, so CI still runs
   them. Update what describes the old behaviour: `CLAUDE.md` §9,
   `.claude/rules/testing.md`, and the file's own header comment. (Resolves last
   run's Q6, option (a).)

2. **Each cat hits page elements the way it hits the pointer.** Today, above
   calm intensity, almost every attack makes elements wander, shake or sway
   (`app/ui/xenocats/puppets.ts` gives every puppet a base `wander` path that
   the effect then acts on). Instead, an element under attack does what the
   attack does to the pointer, and nothing else: **no base wandering**, and an
   element only moves if the attack moves the pointer. For example:
   - **Smoke Bombay** (`blur`): elements are hidden behind a smoke screen where
     they stand. They do not move.
   - **Pinball Devon** (`bounce`): elements fly off in a random direction and
     bounce off the edges of the viewport until the attack ends.
   - **Cryo Persian** (`freeze`): elements freeze in place (frost, no motion).
   - **Void Tabby** (`vanish`): elements disappear in place.
   - **Munchkin Mite** / **Titan Forest Cat** (`tiny` / `giant`): elements
     shrink / grow in place.

   Derive the rest from each effect in `app/ui/xenocats/effects.ts`, all 20
   cats and the combos (`combos.ts`), and record the mapping as one table in
   `decisions.md`: cat, effect, what it does to the pointer, what it does to an
   element. The calm-intensity hits (`PAGE_HITS` in `page-hits.ts`) follow the
   same mapping at their smaller reach. Shaking is right only for an attack
   that shakes the pointer (`jitter`). Everything still reverts exactly; clicks
   are never blocked (they land where the real pointer is); focused fields are
   never touched. Unit tests: for every effect, whether an element moves, and in
   which way, is what the table says. E2E on `/cats`, summoning each cat in
   turn: Smoke Bombay leaves an element's box where it was while it is
   obscured; Pinball Devon displaces it and keeps it inside the viewport;
   every element is back exactly when the attack ends.

3. **Cats sound like cats.** Replace the synthesized attack, wake-up and
   arrival sounds (`app/ui/xenocats/sounds.ts`) with real cat recordings
   (meows, hisses, chirps, growls, purrs), so that each cat type still has its
   own distinct attack sound. Recordings can be few: one recording may serve
   several cats if it is varied by playback rate, filter or segment, played
   through the existing Web Audio graph. The speaker toggle, its default, its
   storage and the autoplay rule stay as they are. Where a file fails to load,
   that sound falls back to its current synthesized version.

   _Explicitly lifts §3's "contacting any external service" for task 3 only,_
   limited to this:
   - HTTPS GET requests to `commons.wikimedia.org` (its search and file-info
     API) and `upload.wikimedia.org` (the files). No other host.
   - Only files whose Commons licence is **public domain or CC0**. Check the
     licence in the file's metadata, not its title or description.
   - Prefer Commons' MP3 transcode of an Ogg file. Download into a new, empty
     directory in the scratchpad first, and keep a file only if its first bytes
     are an MP3 header (`ID3` or an MPEG frame sync) and it is at most 200 KB.
     All files together stay under 2 MB.
   - Kept files go in `public/xenocats/sounds/`, beside a `CREDITS.md` listing
     for each file its Commons page URL, author and licence.
   - If no suitable public-domain/CC0 recordings can be found, keep the
     synthesized sounds, record what was searched in `progress.md` and
     `questions.md`, and end the task as abandoned.

   Unit tests: every cat type, wake-up and arrival maps to a sound; every file
   that a sound names exists in `public/xenocats/sounds/` and is listed in
   `CREDITS.md`. E2E: the sound files are served, and the toggle still works.

4. **The fight games get pages of their own; a movement pad.**
   - **Pages.** Survival and Taming each move out of the overlay on `/cats`
     (`app/ui/xenocats/fight.tsx`) onto a page of their own: `/cats/survival`
     and `/cats/taming`. The "Fight a cat" section on `/cats` becomes two links
     to them. Each page is the game: a heading, the HUD (lives, wave, score;
     or the taming state), Start, and the play area filling the page. Not a
     modal or an overlay, so no `role="dialog"`. Everything else about the
     games is unchanged: pointer lock and its fallback, Esc ends the game,
     losing focus or the lock pauses it, best score and tamed collection in
     `localStorage`, the field-guide stats, sounds, at most 5 cats. Leaving the
     page ends the game and releases the lock. Both pages are public like
     `/cats`.
   - **Touch devices** (no precise pointer, detected as the last run's T8
     does): both pages say the game needs a keyboard and mouse, for now. The
     current Survival is not made playable on touch: task 6 replaces it.
   - **The movement pad**, built here for task 5 and the Survival game (tasks
     6–11) to use: an on-screen joystick or four-way pad, operated by touch,
     large enough for a thumb, giving the same walk direction WASD gives
     (`walkDirection` in `survival.ts` or its equivalent). A component of its
     own, plus a pure module mapping touch input to a walk direction. It is
     hidden from assistive technology like the rest of the game's visuals (the
     keyboard path is the accessible one), and the page does not scroll or
     zoom while it is held. Task 4 builds it and does not yet place it in a
     game.
   - Tests: unit tests for the pad's input mapping (centre, each direction,
     diagonals, a dead zone, release). E2E: `/cats` links to both pages; each
     page starts its game (the fallback path, as now); move the existing fight
     tests onto the new pages; a touch device profile shows the "needs a
     keyboard and mouse" notice. Report the pages as tested in a browser, not
     seen. The pad's browser test comes with its first use (task 5).

5. **Taming with treats.** Needs task 4 (its Taming page and movement pad).
   Taming changes from "hold the pointer still on the cat" to carrying a treat
   to it:
   - **The ranger.** Taming gets Survival's ranger: walked with WASD on
     desktop and the movement pad on touch, **with no gun**. Taming is then
     playable on touch devices, replacing task 4's notice on this page, with
     the pad shown only on touch devices.
     Pointer lock and its fallback stay as in Survival; the pointer no longer
     tames anything.
   - **Treats.** Small pickups spawn at random spots on the play area (fish,
     catnip, yarn and the like), a few at a time, each vanishing after a while
     if not picked up; how many, how often and how long are in the config.
     Walking the ranger over one picks it up. The ranger carries one treat at
     a time, and its HUD shows which. Treats are **emoji placeholders**
     (🐟, 🌿, 🧶 …), small and styled to sit on the dark theme; no new
     artwork. List them in the report as waiting for a Superdesign pass.
   - **Cats.** Still one cat at a time. While the ranger carries **no** treat,
     the cat keeps away: it flees the ranger (each type in its own way, the
     existing `DODGES`) and, from a range set in the config, **attacks it**
     with its own attack effect, at an interval set in the config. The effect
     lands on the ranger as it does in Survival (drift, freeze, reverse …).
     There are no lives and nothing is lost; the effects just make treats
     harder to reach. While the ranger **carries** a treat, the cat stops
     attacking and fleeing and comes to the ranger; when they touch, the
     treat is given and the cat is tamed. The treat is used up, and the next
     cat comes.
   - Unchanged: the tamed collection in `localStorage`, the field-guide
     "tamed" stat, sounds, Esc ends the game, losing focus or the lock pauses
     it, at most 5 cats on screen, the visuals hidden from assistive
     technology.
   - Tests: unit tests in `taming.ts` (pure, time passed in) for treat
     spawning, expiry and pickup, carrying one at a time, flee and ranged
     attack without a treat, approach with one, taming on touch, and the treat
     used up. Rewrite the tests of the old 2-second rule to the new rule. E2E
     on `/cats/taming`, in both the desktop fallback and a touch device
     profile: walk to a treat, carry it to the cat, the cat is tamed and
     appears in the collection. Report as tested in a browser, not seen.

### The Survival game (tasks 6–11)

Survival becomes a **Vampire Survivors-style time-survival roguelite** on
`/cats/survival`, replacing the wave game there. One character in an endless
arena. **Attacks happen automatically: positioning is the skill.** Cats pour in
from every side; sent-home cats drop experience; experience buys level-ups;
level-ups offer upgrades; weapons evolve into absurd late-game machines; the run
ends at the time goal or when the hero gives up. The escalation is the point:
_a few cats → a lot of cats → hundreds → the entire screen is cats → the hero
has become a god and the cats are experiencing an unprecedented cosmic
catastrophe._

**Rules for tasks 6–11** (and for task 12's game items):

- **Tone: deadpan send-home.** The hero does not hate cats; he just wants to
  send them home. Nothing is ever killed: a defeated cat is **beamed home** in
  a flash. A cat's health bar is its **Homesickness**; the counter reads
  **Cats sent home**. Weapons keep the names below, but their hits send cats
  home. Everything is presented with the seriousness of a gothic survival
  game; the game never winks at how ridiculous it is. Name what the plan does
  not (the hero's own health, the currency, the final cat) in that voice, and
  record the names in `decisions.md`.
- **Art.** _Explicitly lifts the design decision "no new artwork" for tasks
  6–11 and task 12's game items, for the game's own art only:_ the run draws
  new SVG for the hero, the new enemy varieties, weapons, projectiles,
  experience gems, chests and pickups, in the site's palette
  (`tailwind.config.ts`) and in the style of the existing cats (which it may
  build on: `CatSprite`'s `look` system and the 20 types' art). Cats must stay
  recognizably cats. The existing 20 cat types are reused as enemies with their
  art unchanged. List every new drawing in the report as **drawn by the run,
  not seen**, for a later Superdesign pass.
- **The cat limit.** _Explicitly lifts "never more than 5 cats on screen" and
  "one effect at a time on the page" inside the Survival game only._ Spawning
  is uncapped and escalates toward thousands; the game measures frame time and
  **stops adding cats while the frame rate is below a floor set in the
  config**, so a weak machine gets fewer cats, not a slideshow. Every other
  page keeps the 5-cat rule, and the ambient cat layer does not run on the game
  page.
- **Performance.** Canvas 2D: each sprite is rasterized once to an offscreen
  bitmap and drawn from there; collision and targeting go through a spatial
  grid, not all-pairs; cats, projectiles and gems are pooled, not allocated per
  frame. The simulation is pure and deterministic (seeded `Random`, time passed
  in, fixed time step), in modules with no DOM, so it is unit-tested in Node.
- **Run length.** Short runs: a **5-minute** time goal (config). At the goal an
  unbeatable final cat arrives and ends the run, as the Reaper does in Vampire
  Survivors. Otherwise the run ends when the hero's health is gone. Escalation
  is tuned so that roughly: a few cats in the first 30 s, dozens by 1 min,
  hundreds by 2½ min, as many as the frame rate allows by 4 min.
- **Controls.** WASD (arrow keys too in single player), task 4's movement pad
  on touch, Esc or losing focus pauses (a pause menu with Resume and Give up).
  No pointer lock: nothing is aimed. **Level-up pauses the game.** Its choice
  is a real, accessible dialog: choices picked by 1–4, or arrows and Enter, or
  a tap; focus moves into it and back; it is announced. The canvas and its
  visuals are hidden from assistive technology; the HUD (time, level, health,
  cats sent home) is text.
- **Testing a canvas.** E2E cannot see the canvas, so the page exposes the
  game's state as text and `data-` attributes (time, level, health, cats on
  screen, cats sent home, weapons held), which the tests read. A URL parameter
  for a fixed seed, and one that speeds up time, are acceptable test hooks:
  nothing is at stake in a single-player game kept in `localStorage`. Record
  any hook in `decisions.md`.
- **Sounds.** Through task 3's sound module (recordings or the synthesized
  fallback, the same toggle): sent home, level-up, evolution, boss arrival,
  hero hit. A cap on how many play at once (config), so hundreds of cats
  never make noise soup.
- **Storage.** Everything persistent is in `localStorage` under versioned keys;
  unreadable or corrupt data reads as a fresh start, never a crash.

6. **The arena, the hero and the horde.** Needs task 4 (the page and the
   movement pad).
   - `/cats/survival` becomes the new game. Its start screen has Start, the
     best time survived, and the controls. The old wave game is retired.
     _Explicitly lifts §3's "deleting a file you did not create" for task 6,
     for the old Survival's modules and their tests that nothing uses any more
     after this task (e.g. `gun.ts`, the wave logic in `survival.ts`)._
     Whatever Taming (task 5) still uses stays.
   - An **endless arena**: the camera follows the hero; a subtle tiled floor in
     the site's dark colours so movement shows; cats spawn just off-screen in
     every direction.
   - **The hero** (new SVG): walks as above. Has a health bar; **contact with a
     cat drains it** (each variety its own amount); brief invulnerability after
     a hit. **Rare effects**: a small share of cats (config) are _elites_ of
     the 20 xenocat types and also apply their xenocat effect to the hero on
     contact (Cryo freezes him briefly, Gravi slows him, Mirror reverses his
     controls…), one effect at a time on the hero.
   - **The horde**: cats of the 20 existing types walk toward the hero;
     escalating spawns and the frame-rate guard as above.
   - **The starting weapon, the Laser Pointer**: every few seconds it points a
     laser at nearby cats; anything it touches grows homesick. Enough
     homesickness sends a cat home.
   - The time goal and the final cat; a results screen (time survived, cats
     sent home); the best time kept.
   - Tests: unit tests for movement, contact damage and invulnerability, elite
     effects, the spawn curve (a seeded simulation reaches each escalation
     stage on time), the frame-rate guard (adding stops below the floor and
     resumes above it), the spatial grid against a brute-force check, the time
     goal. E2E (desktop and a touch device profile): start, walk, the laser
     sends a cat home, the hero gives up (or the time goal arrives, with the
     speed hook), the results screen shows, the best time is kept.

7. **Experience, level-ups and the arsenal.** Needs task 6.
   - Sent-home cats drop **experience gems**; the hero collects them within a
     pickup radius; an experience curve gives levels.
   - **Level-up**: the game pauses and offers 3 choices (4 with a passive that
     adds one) of new weapons, weapon levels, or passives, drawn from what the
     hero does not yet have maxed. Weapons level up to 8, passives to 5.
     Up to 6 weapons and 6 passives are held, as in Vampire Survivors.
   - **Weapons** (all automatic): Laser Pointer (task 6, now with levels);
     **Cat Treats** — treats fired in a spread that somehow make cats
     homesick despite being delicious; **Vacuum Cleaner** — periodically sucks
     nearby cats toward the hero; **Spray Bottle** — water droplets in a wide
     arc; **Yarn Ball** — bounces around the screen; **Can Opener** — orbiting
     blades; **Hairball** — a projectile that bursts into smaller hairballs;
     **Thunderous Vacuum** — a giant zone of homesickness; **Laser Pointer
     Deluxe** — a beam that ricochets between targets.
   - **Passives**, at least: **Rubber Chicken** (movement speed), **Battery**,
     **Catnip** and **Scissors** (the evolution ingredients of task 9, each
     also useful on its own, e.g. cooldown, area, projectile count), and a few
     standard ones (max health, recovery, pickup radius, might) named in the
     game's voice.
   - Tests: unit tests for the experience curve, the offer (never offers what
     is maxed or would exceed the slots), each weapon's behaviour at level 1 and
     its top level (targets, area, cooldown), and that a seeded 5-minute
     simulation with automatic choices ends with the screen full of attacks
     (many projectiles alive at once). E2E: a level-up dialog appears, is
     picked by keyboard (1–4) and by tap on a touch profile, and the game
     resumes with the new weapon held.

8. **The cats escalate: varieties and a boss.** Needs task 6.
   - New varieties, each with its own SVG and behaviour, introduced over the
     run: **Basic Cat** (slow, numerous, mostly harmless); **Zoomies Cat**
     (extremely fast, unpredictable direction changes); **Hissing Cat**
     (aggressive approach, more homesickness needed); **Fat Cat** (very slow,
     enormous, extremely durable); **Kitten Swarm** (tiny cats arriving in
     huge groups, classified as an elite); **Box Cat** (a cat sitting calmly in
     a cardboard box, with a giant health bar, surprisingly hard to send home);
     **Laser Cat** (fires laser beams at the hero from range); **Possessed
     Cat** (supernatural-looking, ignores some kinds of attack — which kinds,
     in the config); **Mega Cat** (a boss: an enormous orange tabby that fills
     a large part of the screen, with its own Homesickness bar at the top,
     arriving at set times).
   - The 20 xenocat types stay in the mix, and remain the source of elites
     (task 6).
   - The spawn schedule (config) introduces the varieties over the 5 minutes so
     the cats become progressively more numerous, durable, fast and
     ridiculous. Bosses and elites drop a **chest** (used by task 9; until
     then, a chest gives a level-up).
   - Tests: unit tests per variety (speed, durability, behaviour, Possessed's
     immunity, Laser Cat's shots, Kitten Swarm's group size), the schedule (each
     variety first appears in its window in a seeded run), the boss's arrival
     and its chest. E2E with the speed hook: a boss arrives and its bar shows.

9. **Weapon evolution.** Needs tasks 7 and 8 (weapons, passives, chests).
   A weapon at its top level, held together with its passive, evolves when
   the hero opens a chest, as in Vampire Survivors. At least:
   - **Laser Pointer + Battery → Infinite Laser**: the screen becomes a
     continuous web of laser beams.
   - **Vacuum Cleaner + Catnip → Forbidden Catnip Vacuum**: pulls enormous
     groups of cats toward the hero before sending them home all at once.
   - **Yarn Ball + Scissors → Yarn Apocalypse**: the yarn balls split
     repeatedly and bounce around the arena, an enormous knitting-related
     disaster.

   More pairs may be added if they come naturally. An evolution announces
   itself (text and sound) with the same seriousness as everything else.
   Tests: unit tests for each evolution's condition (top level + passive +
   chest; not without each part), that the evolved weapon replaces the base
   one, and its behaviour. E2E with the seed and speed hooks if a path can be
   made reliable; otherwise record that evolutions are covered by unit tests
   only.

10. **Persistent progression and unlocks.** Needs task 7; the secrets need
    task 9.
    - Each run earns a currency (named in the game's voice) from time
      survived and cats sent home. A **shop** on the start screen sells
      permanent upgrades (e.g. max health, might, speed, pickup radius,
      revival), each with levels and rising costs.
    - **Weapons unlock** by milestones (e.g. survive 3 minutes, send 1000 cats
      home in one run, reach level 20); locked weapons are never offered.
    - **Characters**: at least three heroes, each the hero re-dressed (run-drawn
      SVG) with a different starting weapon and stat bias, unlocked by
      milestones or bought. The start screen picks one.
    - **Secrets**: at least one hidden evolution not listed anywhere until
      found, and a secret cat that appears only under a condition (record it
      in `decisions.md`, not in the UI). A codex on the start screen shows
      what has been found, and "???" for what has not.
    - Tests: unit tests for earning, buying, the milestones, the secrets'
      conditions, and the storage (round-trip, corrupt data reads as fresh,
      an older version migrates or resets cleanly). E2E: finish a run, the
      currency is earned and kept after a reload, an upgrade is bought.

11. **Local co-op for two.** Needs tasks 6 and 7.
    - The start screen chooses one or two players. Player 1 walks with WASD,
      player 2 with the arrow keys; each picks a hero (task 10's, if built).
      Co-op is keyboard only; touch stays single player.
    - **Shared camera**: keeps both heroes in view, zooming out to a limit set
      in the config; beyond it, a hero cannot walk further from the other.
    - **Shared experience, own choices**: one experience bar; at a level-up
      each player picks their own upgrade in turn (player 1, then player 2),
      the dialog saying whose turn it is. Each hero has their own weapons and
      health.
    - **Downed and revived**: a hero whose health runs out is downed; if the
      other survives 30 s (config), the downed hero revives. The run ends when
      both are down. The results screen shows both.
    - Tests: unit tests for the two players' input, the camera and the tether,
      the turn order at level-up, downed and revive, the end of the run. E2E:
      two players start, each moves with their keys, a level-up asks both in
      turn.

12. **Exploration, until the goal time.** When tasks 1–11 and the checkpoints
    are done, parked or abandoned, keep improving the project **until `D`**.
    _Explicitly lifts §6's "do not invent work" and "the plan's tasks are done
    before `D`. Write the report and stop", and §1.0's "work no task names is
    not built" and "Done. When the last task ends before `D`, write the report
    and stop", for this task only._

    **This task does not run out.** Last run's exploration produced one item
    and then stopped 70 minutes before the goal, reporting that "the plan's
    tasks ran out". That reading is wrong for this task:
    - **Start a new item whenever the clock reads before `D`**, however close
      to it. An item that runs past `D` is expected (§8.3, §8.4): it is
      finished, and the report says by how much.
    - **A pending CI poll is not a reason to stop.** Wait for it at the next
      commit as §2 step 4 says. The report waits for the last poll too (§7),
      so it may be written well after `D`. That is expected.
    - **Time lost to a usage-limit pause is lost.** It is never a reason to
      stop earlier.
    - Task 12 ends only at `D`, at the budget roundup (§8.5), or on a §6 stop
      condition. "What ended the run" in the report is one of those, never
      "the tasks ran out".

    How items work:
    - Each item is its own task (`night-2026-10-07-t12-<n>-<slug>`) through
      the whole of §2, merged like planned work.
    - Before starting an item, append to `progress.md` what it is and its kind.
    - Rotate between five kinds: **the Survival game** (new enemy cats, each
      with run-drawn SVG and a behaviour that makes it play differently, not
      just another skin; new weapons, passives and evolution pairs; balance
      passes on spawn curves, weapon numbers and costs, each backed by a seeded
      simulation test), dashboard features, tests, security and quality, cat
      behaviour bugs. Game items need task 6 merged. A security problem found
      at any point jumps the queue. Last run's open proposals are good
      candidates where nothing below forbids them: Q7 (lockout follow-ups),
      Q9 (end other sessions after a password change), and anything the
      checkpoints raise.
    - Not in exploration: new art or restyling for anything outside the
      Survival game, anything that needs a new dependency, Superdesign, an
      outside service (task 3's lift does not carry over), online
      multiplayer, or any database but the test schemas above (Q2's `pg_trgm`
      extension included). Those go to `questions.md`. None of §3's other
      rules are lifted.
    - The checkpoint runs after every 5th item.
